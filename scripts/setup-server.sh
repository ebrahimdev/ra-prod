#!/bin/bash

set -e

echo "🚀 Setting up Production Server for ra-prod deployment"
echo "🔧 This script will install required dependencies and configure the server"

# Update system packages
echo "📦 Updating system packages"
apt-get update && apt-get upgrade -y

# Install Python 3.11 and pip
echo "🐍 Installing Python 3.11"
apt-get install -y software-properties-common
add-apt-repository ppa:deadsnakes/ppa -y
apt-get update
apt-get install -y python3.11 python3.11-venv python3.11-dev python3-pip

# Create python3 symlink if it doesn't exist
if [ ! -f /usr/bin/python3 ]; then
    ln -s /usr/bin/python3.11 /usr/bin/python3
fi

# Install Node.js 18 (for future use)
echo "📦 Installing Node.js 18"
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install nginx
echo "🌐 Installing nginx"
apt-get install -y nginx

# Install other utilities
echo "🔧 Installing utilities"
apt-get install -y curl wget git rsync htop tree

# Create deployment directory
echo "📁 Creating deployment directories"
mkdir -p /opt/ra-prod/{auth-server,rag,backups}
chown -R root:root /opt/ra-prod

# Configure nginx
echo "⚙️ Configuring nginx"
cat > /etc/nginx/sites-available/ra-prod << 'EOF'
# Auth Server (Port 5000)
server {
    listen 80;
    server_name _;
    
    # Health check endpoint
    location /health {
        proxy_pass http://127.0.0.1:5000/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Auth API endpoints
    location /api/auth/ {
        proxy_pass http://127.0.0.1:5000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # RAG API endpoints
    location /api/rag/ {
        proxy_pass http://127.0.0.1:5001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Handle file uploads
        client_max_body_size 50M;
    }
    
    # Default to auth server for backward compatibility
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Direct access to Auth Server
server {
    listen 5000;
    server_name _;
    
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Direct access to RAG Server
server {
    listen 5001;
    server_name _;
    
    location / {
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Handle file uploads for RAG server
        client_max_body_size 50M;
    }
}
EOF

# Enable the nginx site
ln -sf /etc/nginx/sites-available/ra-prod /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t

# Configure firewall
echo "🔥 Configuring firewall"
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 5000/tcp
ufw allow 5001/tcp
ufw --force enable

# Create systemd service files
echo "⚙️ Creating systemd service files"

# Auth Server service
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
Environment=FLASK_RUN_HOST=127.0.0.1
Environment=FLASK_RUN_PORT=5000
ExecStart=/opt/ra-prod/auth-server/current/venv/bin/python -m flask run
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# RAG Server service
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
Environment=FLASK_RUN_HOST=127.0.0.1
Environment=FLASK_RUN_PORT=5001
ExecStart=/opt/ra-prod/rag/current/venv/bin/python -m flask run
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
systemctl daemon-reload

# Enable services (but don't start them yet - they'll be started by deployment)
systemctl enable auth-server
systemctl enable rag-server
systemctl enable nginx

# Start nginx
systemctl start nginx
systemctl status nginx --no-pager -l

# Create a simple monitoring script
echo "📊 Creating monitoring script"
cat > /opt/ra-prod/monitor.sh << 'EOF'
#!/bin/bash

echo "=== Ra-prod System Status ==="
echo "Date: $(date)"
echo ""

echo "🔄 Service Status:"
systemctl is-active --quiet auth-server && echo "✅ Auth Server: Running" || echo "❌ Auth Server: Stopped"
systemctl is-active --quiet rag-server && echo "✅ RAG Server: Running" || echo "❌ RAG Server: Stopped"
systemctl is-active --quiet nginx && echo "✅ Nginx: Running" || echo "❌ Nginx: Stopped"

echo ""
echo "🌐 Health Checks:"
curl -s -f http://localhost:5000/health >/dev/null && echo "✅ Auth Server Health: OK" || echo "❌ Auth Server Health: FAIL"
curl -s -f http://localhost:5001/health >/dev/null && echo "✅ RAG Server Health: OK" || echo "❌ RAG Server Health: FAIL"

echo ""
echo "💾 Disk Usage:"
df -h /opt/ra-prod

echo ""
echo "🧠 Memory Usage:"
free -h

echo ""
echo "📊 Process Info:"
ps aux | grep -E "(python|flask)" | grep -v grep
EOF

chmod +x /opt/ra-prod/monitor.sh

# Create log rotation
echo "📝 Setting up log rotation"
cat > /etc/logrotate.d/ra-prod << 'EOF'
/var/log/auth-server.log
/var/log/rag-server.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 root root
}
EOF

# Final summary
echo ""
echo "🎉 Server setup completed successfully!"
echo ""
echo "📋 Summary:"
echo "  - Python 3.11 installed"
echo "  - Node.js 18 installed"  
echo "  - Nginx configured and running"
echo "  - Systemd services created (auth-server, rag-server)"
echo "  - Firewall configured (ports 22, 80, 5000, 5001)"
echo "  - Deployment directory created: /opt/ra-prod"
echo "  - Monitoring script: /opt/ra-prod/monitor.sh"
echo ""
echo "🔧 Next steps:"
echo "  1. Run your deployment scripts to deploy the applications"
echo "  2. Check status with: /opt/ra-prod/monitor.sh"
echo "  3. View logs with: journalctl -u auth-server -f"
echo "                    journalctl -u rag-server -f"
echo ""
echo "✅ Server is ready for deployment!"