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
    sudo chown -R $USER:$USER /opt/ra-prod
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
    
    echo "🐍 Setting up Python 3.10 virtual environment"
    # Remove any existing broken venv
    rm -rf venv
    python3.10 -m venv venv
    source venv/bin/activate
    
    # Upgrade pip
    pip install --upgrade pip
    
    echo "📦 Installing Python dependencies..."
    # Install with more robust options
    pip install --no-cache-dir --force-reinstall -r requirements.txt
    
    # Verify critical packages are installed
    echo "🔍 Verifying installations..."
    python -c "import flask; print('✅ Flask installed')" || echo "❌ Flask not installed"
    python -c "import flask_cors; print('✅ Flask-CORS installed')" || echo "❌ Flask-CORS not installed"
    python -c "import sqlalchemy; print('✅ SQLAlchemy installed')" || echo "❌ SQLAlchemy not installed"
    
    # Copy production environment configuration
    if [ -f "/opt/ra-prod/config/auth-server.prod.env" ]; then
        cp /opt/ra-prod/config/auth-server.prod.env .env
        echo "📄 Using existing production configuration"
    else
        echo "⚠️  Warning: No production configuration found. Using defaults."
    fi
    
    # Create instance directory for database with proper permissions
    mkdir -p instance
    chmod 755 instance
    echo "✅ Database directory created, app will initialize database on first run"
    
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

# Update and restart the systemd service with the new configuration
ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST << 'EOF'
    # Reload systemd configuration
    sudo systemctl daemon-reload
    
    # Stop service if running
    sudo systemctl stop auth-server 2>/dev/null || true
    
    # Start service
    echo "🔄 Starting auth-server service"
    sudo systemctl start auth-server
    
    # Wait and check status
    sleep 10
    
    if sudo systemctl is-active --quiet auth-server; then
        echo "✅ Auth Server started successfully"
        sudo systemctl status auth-server --no-pager -l
        
        # Test health endpoint
        echo "🔍 Testing health endpoint..."
        sleep 5
        curl -f http://localhost:5000/health || echo "⚠️ Health endpoint not responding yet"
    else
        echo "❌ Auth Server failed to start"
        echo "📊 Service status:"
        sudo systemctl status auth-server --no-pager -l
        echo "📋 Recent logs:"
        sudo journalctl -u auth-server --no-pager -l -n 30
        exit 1
    fi
EOF

echo "🎉 Auth Server deployment completed!"