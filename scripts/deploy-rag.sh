#!/bin/bash

set -e

SERVER_HOST=${SERVER_HOST:-45.76.61.43}
SERVER_USER=${SERVER_USER:-root}
APP_NAME="rag"
DEPLOY_PATH="/opt/ra-prod"
SERVICE_NAME="rag-server"

echo "🚀 Deploying RAG Server to $SERVER_HOST"

# Create deployment directory structure on server
ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST << 'EOF'
    sudo mkdir -p /opt/ra-prod/rag
    sudo mkdir -p /opt/ra-prod/backups
    sudo chown -R $USER:$USER /opt/ra-prod
EOF

# Backup current deployment if it exists
ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST << 'EOF'
    if [ -d "/opt/ra-prod/rag/current" ]; then
        echo "📦 Creating backup of current deployment"
        sudo cp -r /opt/ra-prod/rag/current /opt/ra-prod/backups/rag-$(date +%Y%m%d-%H%M%S)
        # Keep only last 5 backups
        sudo find /opt/ra-prod/backups -name "rag-*" -type d | sort -r | tail -n +6 | xargs sudo rm -rf
    fi
EOF

# Upload application files
echo "📁 Uploading application files"
rsync -avz --delete \
    --exclude='venv/' \
    --exclude='__pycache__/' \
    --exclude='*.pyc' \
    --exclude='uploads/' \
    ./rag/ $SERVER_USER@$SERVER_HOST:/opt/ra-prod/rag/new/

# Set up virtual environment and install dependencies
ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST << 'EOF'
    cd /opt/ra-prod/rag/new
    
    echo "🐍 Setting up Python virtual environment"
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    
    # Create uploads directory
    mkdir -p uploads
    
    # Copy production environment configuration
    if [ -f "/opt/ra-prod/config/rag-server.prod.env" ]; then
        cp /opt/ra-prod/config/rag-server.prod.env .env
        echo "📄 Using existing production configuration"
    else
        echo "⚠️  Warning: No production configuration found. Using defaults."
    fi
    
    # Copy database if it exists from current deployment
    if [ -f "/opt/ra-prod/rag/current/documents.db" ]; then
        echo "📄 Preserving existing database"
        cp /opt/ra-prod/rag/current/documents.db ./documents.db
    fi
    
    # Copy uploads if they exist from current deployment
    if [ -d "/opt/ra-prod/rag/current/uploads" ]; then
        echo "📁 Preserving existing uploads"
        cp -r /opt/ra-prod/rag/current/uploads/* ./uploads/ 2>/dev/null || true
    fi
    
    echo "🔄 Activating new deployment"
    if [ -d "/opt/ra-prod/rag/current" ]; then
        rm -rf /opt/ra-prod/rag/current
    fi
    mv /opt/ra-prod/rag/new /opt/ra-prod/rag/current
EOF

# Install/update systemd service if it doesn't exist
ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST << 'EOF'
    if [ ! -f "/etc/systemd/system/rag-server.service" ]; then
        echo "⚙️ Installing systemd service"
        sudo tee /etc/systemd/system/rag-server.service > /dev/null << 'SERVICE_EOF'
[Unit]
Description=RAG Server Flask Application
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/ra-prod/rag/current
Environment=FLASK_ENV=production
Environment=FLASK_APP=app.py
ExecStart=/opt/ra-prod/rag/current/venv/bin/python app.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICE_EOF

        sudo systemctl daemon-reload
        sudo systemctl enable rag-server
    fi
EOF

# Restart the service
echo "🔄 Restarting service"
ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST << 'EOF'
    sudo systemctl restart rag-server
    sleep 5
    
    if sudo systemctl is-active --quiet rag-server; then
        echo "✅ RAG Server deployed successfully"
        sudo systemctl status rag-server --no-pager -l
    else
        echo "❌ RAG Server failed to start"
        sudo journalctl -u rag-server --no-pager -l -n 20
        exit 1
    fi
EOF

echo "🎉 RAG Server deployment completed!"