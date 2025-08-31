#!/bin/bash

echo "🏗️ Setting up Grafana Log Management Stack (Alloy + Loki + Grafana)"

# Create directories
mkdir -p /opt/log-management/{alloy,loki,grafana-data}
cd /opt/log-management

# Get latest versions
LOKI_VERSION=$(curl -s "https://api.github.com/repos/grafana/loki/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
ALLOY_VERSION=$(curl -s "https://api.github.com/repos/grafana/alloy/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')

echo "📦 Installing Loki ${LOKI_VERSION}..."
wget https://github.com/grafana/loki/releases/download/${LOKI_VERSION}/loki-linux-amd64.zip
unzip loki-linux-amd64.zip
chmod +x loki-linux-amd64
mv loki-linux-amd64 /usr/local/bin/loki
rm loki-linux-amd64.zip

echo "📦 Installing Grafana Alloy ${ALLOY_VERSION}..."
wget https://github.com/grafana/alloy/releases/download/${ALLOY_VERSION}/alloy-linux-amd64.zip
unzip alloy-linux-amd64.zip
chmod +x alloy-linux-amd64
mv alloy-linux-amd64 /usr/local/bin/alloy
rm alloy-linux-amd64.zip

echo "📦 Installing Grafana..."
apt-get update
apt-get install -y software-properties-common wget
wget -q -O - https://packages.grafana.com/gpg.key | apt-key add -
echo "deb https://packages.grafana.com/oss/deb stable main" | tee -a /etc/apt/sources.list.d/grafana.list
apt-get update
apt-get install -y grafana

echo "⚙️ Creating Loki configuration..."
mkdir -p /etc/loki
cat > /etc/loki/config.yaml << 'EOF'
auth_enabled: false

server:
  http_listen_port: 3100

common:
  instance_addr: 127.0.0.1
  path_prefix: /opt/log-management/loki
  storage:
    filesystem:
      chunks_directory: /opt/log-management/loki/chunks
      rules_directory: /opt/log-management/loki/rules
  replication_factor: 1
  ring:
    kvstore:
      store: inmemory

query_range:
  results_cache:
    cache:
      embedded_cache:
        enabled: true
        max_size_mb: 100

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

ruler:
  alertmanager_url: http://localhost:9093

limits_config:
  retention_period: 168h  # 7 days
EOF

echo "⚙️ Creating Alloy configuration..."
mkdir -p /etc/alloy
cat > /etc/alloy/config.alloy << 'EOF'
logging {
  level = "info"
}

// Collect from systemd journal
loki.source.journal "journal" {
  max_age = "12h"
  labels = {
    job = "systemd-journal",
    host = "production-server",
  }
  forward_to = [loki.write.default.receiver]
}

// Collect from auth-server logs specifically
loki.source.journal "auth_server" {
  max_age = "12h"
  matches = "_SYSTEMD_UNIT=auth-server.service"
  labels = {
    job = "auth-server",
    service = "auth-server",
    host = "production-server",
  }
  forward_to = [loki.write.default.receiver]
}

// Collect from rag-server logs specifically  
loki.source.journal "rag_server" {
  max_age = "12h"
  matches = "_SYSTEMD_UNIT=rag-server.service"
  labels = {
    job = "rag-server", 
    service = "rag-server",
    host = "production-server",
  }
  forward_to = [loki.write.default.receiver]
}

// Send logs to Loki
loki.write "default" {
  endpoint {
    url = "http://localhost:3100/loki/api/v1/push"
  }
}
EOF

echo "⚙️ Creating systemd services..."

# Loki service
cat > /etc/systemd/system/loki.service << 'EOF'
[Unit]
Description=Loki Log Aggregation System
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/loki -config.file=/etc/loki/config.yaml
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Alloy service
cat > /etc/systemd/system/alloy.service << 'EOF'
[Unit]
Description=Grafana Alloy
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/alloy run /etc/alloy/config.alloy
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

echo "🚀 Starting services..."
systemctl daemon-reload
systemctl enable loki alloy grafana-server
systemctl start loki
sleep 5
systemctl start alloy
systemctl start grafana-server

echo "🔧 Configuring Grafana..."
# Wait for Grafana to start
sleep 10

# Add Loki as data source
curl -X POST \
  http://admin:admin@localhost:3000/api/datasources \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Loki",
    "type": "loki", 
    "url": "http://localhost:3100",
    "access": "proxy",
    "isDefault": true
  }'

echo "✅ Log management setup complete!"
echo ""
echo "🌐 Access Grafana at: http://45.76.61.43:3000"
echo "📊 Default login: admin/admin (change on first login)"
echo "📋 Loki data source configured automatically"
echo ""
echo "🔍 Service status:"
systemctl status loki --no-pager
systemctl status alloy --no-pager
systemctl status grafana-server --no-pager