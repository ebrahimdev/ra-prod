#!/bin/bash

echo "🔧 Fixing Loki configuration for v13 schema"

# Stop Loki service
systemctl stop loki

# Remove old config
rm -f /etc/loki/config.yaml

# Create new config file line by line
echo "auth_enabled: false" > /etc/loki/config.yaml
echo "" >> /etc/loki/config.yaml
echo "server:" >> /etc/loki/config.yaml
echo "  http_listen_port: 3100" >> /etc/loki/config.yaml
echo "  log_level: info" >> /etc/loki/config.yaml
echo "" >> /etc/loki/config.yaml
echo "common:" >> /etc/loki/config.yaml
echo "  instance_addr: 127.0.0.1" >> /etc/loki/config.yaml
echo "  path_prefix: /opt/log-management/loki" >> /etc/loki/config.yaml
echo "  storage:" >> /etc/loki/config.yaml
echo "    filesystem:" >> /etc/loki/config.yaml
echo "      chunks_directory: /opt/log-management/loki/chunks" >> /etc/loki/config.yaml
echo "      rules_directory: /opt/log-management/loki/rules" >> /etc/loki/config.yaml
echo "  replication_factor: 1" >> /etc/loki/config.yaml
echo "  ring:" >> /etc/loki/config.yaml
echo "    kvstore:" >> /etc/loki/config.yaml
echo "      store: inmemory" >> /etc/loki/config.yaml
echo "" >> /etc/loki/config.yaml
echo "query_range:" >> /etc/loki/config.yaml
echo "  results_cache:" >> /etc/loki/config.yaml
echo "    cache:" >> /etc/loki/config.yaml
echo "      embedded_cache:" >> /etc/loki/config.yaml
echo "        enabled: true" >> /etc/loki/config.yaml
echo "        max_size_mb: 100" >> /etc/loki/config.yaml
echo "" >> /etc/loki/config.yaml
echo "schema_config:" >> /etc/loki/config.yaml
echo "  configs:" >> /etc/loki/config.yaml
echo "    - from: 2024-04-01" >> /etc/loki/config.yaml
echo "      store: tsdb" >> /etc/loki/config.yaml
echo "      object_store: filesystem" >> /etc/loki/config.yaml
echo "      schema: v13" >> /etc/loki/config.yaml
echo "      index:" >> /etc/loki/config.yaml
echo "        prefix: index_" >> /etc/loki/config.yaml
echo "        period: 24h" >> /etc/loki/config.yaml
echo "" >> /etc/loki/config.yaml
echo "storage_config:" >> /etc/loki/config.yaml
echo "  tsdb_shipper:" >> /etc/loki/config.yaml
echo "    active_index_directory: /opt/log-management/loki/tsdb-index" >> /etc/loki/config.yaml
echo "    cache_location: /opt/log-management/loki/tsdb-cache" >> /etc/loki/config.yaml
echo "  filesystem:" >> /etc/loki/config.yaml
echo "    directory: /opt/log-management/loki/chunks" >> /etc/loki/config.yaml
echo "" >> /etc/loki/config.yaml
echo "limits_config:" >> /etc/loki/config.yaml
echo "  retention_period: 168h" >> /etc/loki/config.yaml
echo "  ingestion_rate_mb: 16" >> /etc/loki/config.yaml
echo "  ingestion_burst_size_mb: 32" >> /etc/loki/config.yaml

# Create required directories
mkdir -p /opt/log-management/loki/chunks
mkdir -p /opt/log-management/loki/rules  
mkdir -p /opt/log-management/loki/tsdb-index
mkdir -p /opt/log-management/loki/tsdb-cache
chown -R root:root /opt/log-management/loki

# Start Loki
systemctl start loki
sleep 3
systemctl status loki

echo "✅ Loki configuration updated and service restarted"