#!/bin/bash

echo "🔧 Fixing server Python 3.10 setup and services"

# Stop all services
systemctl stop auth-server rag-server 2>/dev/null || true

# Install Python 3.10 if not already installed
if ! command -v python3.10 &> /dev/null; then
    echo "🐍 Installing Python 3.10..."
    apt-get update
    apt-get install -y software-properties-common
    add-apt-repository ppa:deadsnakes/ppa -y
    apt-get update
    apt-get install -y python3.10 python3.10-venv python3.10-dev python3.10-distutils
    
    # Install pip for Python 3.10
    curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
    python3.10 get-pip.py
    rm get-pip.py
else
    echo "✅ Python 3.10 already installed"
fi

python3.10 --version

# Update systemd service files to have better error checking
cat > /etc/systemd/system/auth-server.service << 'EOF'
[Unit]
Description=Auth Server Flask Application
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/ra-prod/auth-server/current
Environment=FLASK_ENV=production
Environment=FLASK_APP=app.py
Environment=HOST=127.0.0.1
Environment=PORT=5000
Environment=DATABASE_URL=sqlite:///instance/auth.db
ExecStartPre=/bin/bash -c 'test -f /opt/ra-prod/auth-server/current/venv/bin/python || (echo "Python venv not found" && exit 1)'
ExecStart=/opt/ra-prod/auth-server/current/venv/bin/python app.py
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/rag-server.service << 'EOF'
[Unit]
Description=RAG Server Flask Application
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/ra-prod/rag/current
Environment=FLASK_ENV=production
Environment=FLASK_APP=app.py
Environment=HOST=127.0.0.1
Environment=PORT=5001
ExecStartPre=/bin/bash -c 'test -f /opt/ra-prod/rag/current/venv/bin/python || (echo "Python venv not found" && exit 1)'
ExecStart=/opt/ra-prod/rag/current/venv/bin/python app.py
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable auth-server rag-server

echo "✅ Server Python 3.10 setup complete!"
echo "Now re-run your deployment to create fresh Python 3.10 virtual environments."