#!/bin/bash

echo "🔧 Simple Python fix - using Debian packages without PPA"

# Update package lists
apt-get update

# Install Python 3.10 if available in Debian repos, otherwise use 3.11
if apt-cache show python3.10 &>/dev/null; then
    echo "Installing Python 3.10 from Debian repos"
    apt-get install -y python3.10 python3.10-venv python3.10-dev
    PYTHON_CMD="python3.10"
else
    echo "Python 3.10 not available, using Python 3.11"
    apt-get install -y python3.11 python3.11-venv python3.11-dev
    PYTHON_CMD="python3.11"
fi

echo "✅ Python installed: $PYTHON_CMD"
$PYTHON_CMD --version

# Stop services
systemctl stop auth-server rag-server 2>/dev/null || true

# Update systemd services to use the correct Python
cat > /etc/systemd/system/auth-server.service << EOF
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
ExecStart=/opt/ra-prod/auth-server/current/venv/bin/python app.py
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/rag-server.service << EOF
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

echo "✅ Services updated!"
echo "Now run deployment again - it will use whatever Python version is available."