#!/bin/bash

echo "🔧 Fixing Flask services to bind to 0.0.0.0 instead of 127.0.0.1"

# Stop and disable services
echo "⏹️  Stopping services..."
systemctl stop auth-server rag-server
systemctl disable auth-server rag-server

# Remove old service files
echo "🗑️  Removing old service files..."
rm -f /etc/systemd/system/auth-server.service
rm -f /etc/systemd/system/rag-server.service

# Create auth-server service
echo "📝 Creating auth-server service..."
tee /etc/systemd/system/auth-server.service > /dev/null << 'SERVICE'
[Unit]
Description=Auth Server Flask Application
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/ra-prod/auth-server/current
Environment=FLASK_ENV=production
Environment=HOST=0.0.0.0
Environment=PORT=5000
ExecStart=/opt/ra-prod/auth-server/current/venv/bin/python app.py
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICE

# Create rag-server service  
echo "📝 Creating rag-server service..."
tee /etc/systemd/system/rag-server.service > /dev/null << 'SERVICE'
[Unit]
Description=RAG Server Flask Application
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/ra-prod/rag/current
Environment=FLASK_ENV=production
Environment=HOST=0.0.0.0
Environment=PORT=5001
ExecStart=/opt/ra-prod/rag/current/venv/bin/python app.py
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICE

# Reload and start services
echo "🔄 Reloading systemd and starting services..."
systemctl daemon-reload
systemctl enable auth-server rag-server
systemctl start auth-server rag-server

echo "⏳ Waiting for services to start..."
sleep 5

# Check status
echo "📊 Service status:"
systemctl status auth-server --no-pager
systemctl status rag-server --no-pager

echo ""
echo "🔍 Network binding check:"
netstat -tlnp | grep python

echo ""
echo "✅ Services should now be binding to 0.0.0.0:5000 and 0.0.0.0:5001"