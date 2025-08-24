#!/bin/bash

set -e

SERVER_HOST=${SERVER_HOST:-45.76.61.43}
SERVER_USER=${SERVER_USER:-root}
APP_NAME="auth-server"
DEPLOY_PATH="/opt/ra-prod"
SERVICE_NAME="auth-server"

echo "🚀 Deploying Auth Server to $SERVER_HOST"

# Create deployment directory structure on server
ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST << 'EOF'
    sudo mkdir -p /opt/ra-prod/auth-server
    sudo mkdir -p /opt/ra-prod/backups
    sudo chown -R $USER:$USER /opt/ra-prod
EOF

# Backup current deployment if it exists
ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST << 'EOF'
    if [ -d "/opt/ra-prod/auth-server/current" ]; then
        echo "📦 Creating backup of current deployment"
        sudo cp -r /opt/ra-prod/auth-server/current /opt/ra-prod/backups/auth-server-$(date +%Y%m%d-%H%M%S)
        # Keep only last 5 backups
        sudo find /opt/ra-prod/backups -name "auth-server-*" -type d | sort -r | tail -n +6 | xargs sudo rm -rf
    fi
EOF

# Upload application files
echo "📁 Uploading application files"
rsync -avz --delete \
    --exclude='venv/' \
    --exclude='instance/' \
    --exclude='__pycache__/' \
    --exclude='*.pyc' \
    ./auth-server/ $SERVER_USER@$SERVER_HOST:/opt/ra-prod/auth-server/new/

# Set up virtual environment and install dependencies
ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST << 'EOF'
    cd /opt/ra-prod/auth-server/new
    
    echo "🐍 Setting up Python virtual environment"
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    
    # Create instance directory for database
    mkdir -p instance
    
    # Copy production environment configuration
    if [ -f "/opt/ra-prod/config/auth-server.prod.env" ]; then
        cp /opt/ra-prod/config/auth-server.prod.env .env
        echo "📄 Using existing production configuration"
    else
        echo "⚠️  Warning: No production configuration found. Using defaults."
    fi
    
    echo "🔄 Activating new deployment"
    if [ -d "/opt/ra-prod/auth-server/current" ]; then
        rm -rf /opt/ra-prod/auth-server/current
    fi
    mv /opt/ra-prod/auth-server/new /opt/ra-prod/auth-server/current
EOF

# Install/update systemd service if it doesn't exist
ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST << 'EOF'
    if [ ! -f "/etc/systemd/system/auth-server.service" ]; then
        echo "⚙️ Installing systemd service"
        sudo tee /etc/systemd/system/auth-server.service > /dev/null << 'SERVICE_EOF'
[Unit]
Description=Auth Server Flask Application
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/ra-prod/auth-server/current
Environment=FLASK_ENV=production
Environment=FLASK_APP=app.py
ExecStart=/opt/ra-prod/auth-server/current/venv/bin/python app.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICE_EOF

        sudo systemctl daemon-reload
        sudo systemctl enable auth-server
    fi
EOF

# Restart the service
echo "🔄 Restarting service"
ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST << 'EOF'
    sudo systemctl restart auth-server
    sleep 5
    
    if sudo systemctl is-active --quiet auth-server; then
        echo "✅ Auth Server deployed successfully"
        sudo systemctl status auth-server --no-pager -l
    else
        echo "❌ Auth Server failed to start"
        sudo journalctl -u auth-server --no-pager -l -n 20
        exit 1
    fi
EOF

echo "🎉 Auth Server deployment completed!"