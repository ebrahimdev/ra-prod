#!/bin/bash

set -e

echo "🚀 Simple Server Setup for ra-prod deployment (Debian 12)"

# Update system packages
echo "📦 Updating system packages"
apt-get update && apt-get upgrade -y

# Install essential packages
echo "🐍 Installing Python and essential packages"
apt-get install -y python3 python3-venv python3-dev python3-pip curl wget git rsync htop tree nginx

# Verify Python version
echo "Python version:"
python3 --version

# Install Node.js 18 (for future use if needed)
echo "📦 Installing Node.js 18"
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

echo "Node.js version:"
node --version

# Create deployment directory
echo "📁 Creating deployment directories"
mkdir -p /opt/ra-prod/{auth-server,rag,backups,config}
chown -R root:root /opt/ra-prod

# Configure firewall (basic)
echo "🔥 Configuring basic firewall"
apt-get install -y ufw
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 5000/tcp
ufw allow 5001/tcp
ufw --force enable

# Start and enable nginx
echo "🌐 Starting nginx"
systemctl start nginx
systemctl enable nginx

# Create basic nginx config for our apps
echo "⚙️ Creating basic nginx configuration"
cat > /etc/nginx/sites-available/ra-prod << 'EOF'
server {
    listen 80;
    server_name _;
    
    location /api/auth/ {
        proxy_pass http://127.0.0.1:5000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /api/rag/ {
        proxy_pass http://127.0.0.1:5001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
    }
    
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

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

server {
    listen 5001;
    server_name _;
    
    location / {
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
    }
}
EOF

# Enable the nginx site
ln -sf /etc/nginx/sites-available/ra-prod /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t

# Reload nginx
systemctl reload nginx

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
Environment=HOST=127.0.0.1
Environment=PORT=5000
ExecStart=/opt/ra-prod/auth-server/current/venv/bin/python app.py
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
Environment=HOST=127.0.0.1
Environment=PORT=5001
ExecStart=/opt/ra-prod/rag/current/venv/bin/python app.py
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

# Create monitoring script
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
curl -s -f http://localhost:5000/health >/dev/null 2>&1 && echo "✅ Auth Server Health: OK" || echo "❌ Auth Server Health: FAIL"
curl -s -f http://localhost:5001/health >/dev/null 2>&1 && echo "✅ RAG Server Health: OK" || echo "❌ RAG Server Health: FAIL"

echo ""
echo "💾 Disk Usage:"
df -h /opt/ra-prod

echo ""
echo "🧠 Memory Usage:"
free -h
EOF

chmod +x /opt/ra-prod/monitor.sh

echo ""
echo "🎉 Simple server setup completed successfully!"
echo ""
echo "📋 What was installed:"
echo "  - Python 3 with venv support"
echo "  - Node.js 18"
echo "  - Nginx with ra-prod configuration"
echo "  - UFW firewall (ports 22, 80, 5000, 5001)"
echo "  - Systemd services for auth-server and rag-server"
echo "  - Deployment directories: /opt/ra-prod"
echo "  - Monitoring script: /opt/ra-prod/monitor.sh"
echo ""
echo "✅ Server is ready for deployment!"
echo "Now you can run your GitHub Actions workflow or manual deployment scripts."