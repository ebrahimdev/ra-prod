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
    sudo chown -R $USER:$USER /opt/ra-prod
EOF

# Upload application files
echo "📁 Uploading application files"
rsync -avz --delete \
    --exclude='venv/' \
    --exclude='__pycache__/' \
    --exclude='*.pyc' \
    --exclude='uploads/' \
    ./rag/ $SERVER_USER@$SERVER_HOST:/opt/ra-prod/rag/new/

# Stop the service first to prevent restart conflicts
ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST << 'EOF'
    sudo systemctl stop rag-server 2>/dev/null || true
    sudo systemctl disable rag-server 2>/dev/null || true
EOF

# Set up virtual environment and install dependencies
ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST << 'EOF'
    cd /opt/ra-prod/rag/new
    
    echo "🐍 Setting up Python 3.10 virtual environment"
    # Remove any existing broken venv
    rm -rf venv
    python3.10 -m venv venv
    source venv/bin/activate
    
    # Upgrade pip with retry logic
    pip install --upgrade pip
    
    echo "📦 Installing Python dependencies (this may take several minutes)..."
    # Install with more robust options
    pip install --no-cache-dir --force-reinstall -r requirements.txt
    
    # Verify critical packages are installed
    echo "🔍 Verifying installations..."
    python -c "import flask; print('✅ Flask installed')" || echo "❌ Flask not installed"
    python -c "import flask_cors; print('✅ Flask-CORS installed')" || echo "❌ Flask-CORS not installed"
    python -c "import torch; print('✅ PyTorch installed')" || echo "❌ PyTorch not installed"
    
    # Create uploads directory
    mkdir -p uploads
    chmod 755 uploads
    
    # Copy production environment configuration
    if [ -f "/opt/ra-prod/config/rag-server.prod.env" ]; then
        cp /opt/ra-prod/config/rag-server.prod.env .env
        echo "📄 Using existing production configuration"
    else
        echo "⚠️  Warning: No production configuration found. Using defaults."
    fi
    
    # Ensure documents database file exists and has proper permissions
    if [ ! -f "documents.db" ]; then
        echo "🗃️ Creating documents database file"
        touch documents.db
    fi
    chmod 664 documents.db
    
    # Test database permissions
    if [ -w "documents.db" ]; then
        echo "✅ Documents database is writable"
        ls -la documents.db
    else
        echo "⚠️ Documents database may have permission issues"
        ls -la documents.db
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

# Update and restart the systemd service
ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST << 'EOF'
    # Reload systemd configuration
    sudo systemctl daemon-reload
    
    # Stop service if running
    sudo systemctl stop rag-server 2>/dev/null || true
    
    # Start service
    echo "🔄 Starting rag-server service"
    sudo systemctl start rag-server
    
    # Wait and check status
    sleep 10
    
    if sudo systemctl is-active --quiet rag-server; then
        echo "✅ RAG Server started successfully"
        sudo systemctl status rag-server --no-pager -l
        
        # Test health endpoint
        echo "🔍 Testing health endpoint..."
        sleep 5
        curl -f http://localhost:5001/health || echo "⚠️ Health endpoint not responding yet"
    else
        echo "❌ RAG Server failed to start"
        echo "📊 Service status:"
        sudo systemctl status rag-server --no-pager -l
        echo "📋 Recent logs:"
        sudo journalctl -u rag-server --no-pager -l -n 30
        exit 1
    fi
EOF

echo "🎉 RAG Server deployment completed!"