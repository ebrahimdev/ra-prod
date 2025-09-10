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
    
    echo "🐍 Setting up Python virtual environment"
    # Remove any existing broken venv
    rm -rf venv
    
    # Force Python 3.10 usage - fail if not available
    if command -v python3.10 &> /dev/null; then
        echo "Using Python 3.10"
        python3.10 -m venv venv
    else
        echo "❌ ERROR: Python 3.10 is required but not found!"
        echo "Please install Python 3.10 on the server first."
        exit 1
    fi
    
    # Always use the venv pip directly to avoid confusion
    echo "🔧 Using venv pip directly"
    ./venv/bin/pip install --upgrade pip
    
    echo "📦 Installing Python dependencies..."
    echo "Using pip: $(which ./venv/bin/pip)"
    ./venv/bin/pip install --no-cache-dir --force-reinstall -r requirements.txt
    
    # Verify critical packages are installed using the venv python
    echo "🔍 Verifying installations..."
    ./venv/bin/python -c "import flask; print('✅ Flask installed')" || echo "❌ Flask not installed"
    ./venv/bin/python -c "import flask_cors; print('✅ Flask-CORS installed')" || echo "❌ Flask-CORS not installed"
    ./venv/bin/python -c "import sqlalchemy; print('✅ SQLAlchemy installed')" || echo "❌ SQLAlchemy not installed"
    
    # Show what packages are actually installed
    echo "📋 Installed packages:"
    ./venv/bin/pip list | head -10
    
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
    
    echo "🔧 Setting up persistent database and environment"
    
    # Create persistent data directory outside deployment path
    mkdir -p /opt/ra-prod/data
    chmod 755 /opt/ra-prod/data
    
    # Create .env file with absolute database path
    cd /opt/ra-prod/auth-server/current
    cat > .env << 'ENVFILE'
FLASK_ENV=production
DATABASE_URL=sqlite:////opt/ra-prod/data/auth.db
HOST=0.0.0.0
PORT=5000
ENVFILE
    
    echo "🔧 Setting up virtual environment with caching"
    rm -rf venv
    python3.10 -m venv venv
    ./venv/bin/pip install --upgrade pip
    
    # Use persistent pip cache
    export PIP_CACHE_DIR="/opt/ra-prod/.pip-cache"
    mkdir -p "$PIP_CACHE_DIR"
    ./venv/bin/pip install --cache-dir="$PIP_CACHE_DIR" -r requirements.txt
    
    echo "🗃️ Initializing persistent database"
    # Install sqlite3 if needed
    apt-get update && apt-get install -y sqlite3
    
    # Create database with proper permissions if it doesn't exist
    if [ ! -f "/opt/ra-prod/data/auth.db" ]; then
        touch /opt/ra-prod/data/auth.db
        chmod 666 /opt/ra-prod/data/auth.db
    fi
    
    # Initialize database tables using the app
    ./venv/bin/python -c "
from app import create_app
from src.models.database import db
app = create_app()
with app.app_context():
    db.create_all()
    print('✅ Database tables initialized')
"
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
        if curl -f http://localhost:5000/health > /dev/null 2>&1; then
            echo "✅ Health endpoint working"
        else
            echo "❌ Health endpoint failed"
            exit 1
        fi
        
        # Test registration endpoint with dummy data
        echo "🧪 Testing registration endpoint..."
        REGISTRATION_TEST=$(curl -s -X POST http://localhost:5000/api/auth/register \
            -H "Content-Type: application/json" \
            -d '{"email": "deploy-test@example.com", "password": "testpass123", "first_name": "Deploy", "last_name": "Test"}')
        
        if echo "$REGISTRATION_TEST" | grep -q "access_token"; then
            echo "✅ Registration endpoint working correctly"
        elif echo "$REGISTRATION_TEST" | grep -q "Email already registered"; then
            echo "✅ Registration endpoint working (user already exists)"
        else
            echo "❌ Registration endpoint failed:"
            echo "$REGISTRATION_TEST"
            exit 1
        fi
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