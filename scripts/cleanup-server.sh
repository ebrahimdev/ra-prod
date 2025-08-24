#!/bin/bash

echo "🧹 Server Cleanup Script for ra-prod"
echo "=====================================/"

# Check available space before cleanup
echo "💾 Disk usage BEFORE cleanup:"
df -h /

echo ""
echo "🔍 Finding space-consuming items..."

# Check largest directories
echo "📊 Largest directories:"
du -h / 2>/dev/null | sort -hr | head -10

echo ""
echo "🗂️ Large files (>100MB):"
find / -type f -size +100M -exec ls -lh {} \; 2>/dev/null | head -10

echo ""
echo "🧹 Starting cleanup..."

# 1. Clean package cache
echo "📦 Cleaning package cache..."
apt-get clean
apt-get autoclean
apt-get autoremove -y

# 2. Clean system logs (keep last 7 days)
echo "📋 Cleaning old system logs..."
journalctl --vacuum-time=7d
journalctl --vacuum-size=100M

# 3. Clean log files
echo "🗒️ Cleaning large log files..."
find /var/log -name "*.log" -type f -size +50M -delete 2>/dev/null
find /var/log -name "*.log.*" -type f -mtime +7 -delete 2>/dev/null

# 4. Clean temporary files
echo "🗑️ Cleaning temporary files..."
rm -rf /tmp/*
rm -rf /var/tmp/*

# 5. Clean old kernels (keep current + 1)
echo "🔧 Cleaning old kernel versions..."
apt-get autoremove --purge -y

# 6. Clean Docker if installed
if command -v docker &> /dev/null; then
    echo "🐳 Cleaning Docker cache..."
    docker system prune -f
    docker image prune -a -f
    docker volume prune -f
else
    echo "🐳 Docker not found, skipping..."
fi

# 7. Clean pip cache
echo "🐍 Cleaning Python pip cache..."
pip cache purge 2>/dev/null || echo "No pip cache to clean"
python3 -m pip cache purge 2>/dev/null || echo "No python3 pip cache to clean"

# 8. Clean npm cache
if command -v npm &> /dev/null; then
    echo "📦 Cleaning npm cache..."
    npm cache clean --force
else
    echo "📦 npm not found, skipping..."
fi

# 9. Clean thumbnail cache
echo "🖼️ Cleaning thumbnail cache..."
rm -rf ~/.cache/thumbnails/*
rm -rf /root/.cache/* 2>/dev/null

# 10. Clean old Python virtual environments if they exist
echo "🐍 Cleaning old venv directories..."
find /opt -name "venv" -type d -path "*/backup*" -exec rm -rf {} \; 2>/dev/null

# 11. Clean deployment backups (keep last 3)
echo "🗃️ Cleaning old deployment backups..."
if [ -d "/opt/ra-prod/backups" ]; then
    cd /opt/ra-prod/backups
    ls -t | tail -n +4 | xargs -r rm -rf
    echo "Kept last 3 backups, removed older ones"
fi

# 12. Clean old coredumps
echo "💥 Cleaning coredumps..."
find /var/crash -name "*.crash" -delete 2>/dev/null
find /var/lib/systemd/coredump -name "core.*" -delete 2>/dev/null

# 13. Clean browser cache if exists
echo "🌐 Cleaning browser cache..."
rm -rf /root/.cache/mozilla/* 2>/dev/null
rm -rf /root/.cache/google-chrome/* 2>/dev/null

echo ""
echo "🎯 Checking specific ra-prod directories..."

# Check ra-prod specific usage
if [ -d "/opt/ra-prod" ]; then
    echo "📊 ra-prod directory usage:"
    du -h /opt/ra-prod/* 2>/dev/null | sort -hr
    
    # Clean any large upload files in RAG server
    if [ -d "/opt/ra-prod/rag/current/uploads" ]; then
        echo "📁 Cleaning large upload files (>50MB)..."
        find /opt/ra-prod/rag/current/uploads -type f -size +50M -ls 2>/dev/null
        find /opt/ra-prod/rag/current/uploads -type f -size +50M -delete 2>/dev/null
    fi
fi

# 14. Free up pagecache, dentries and inodes
echo "🧠 Clearing system cache..."
sync && echo 3 > /proc/sys/vm/drop_caches

echo ""
echo "✅ Cleanup completed!"
echo ""
echo "💾 Disk usage AFTER cleanup:"
df -h /

echo ""
echo "📊 Space freed up:"
echo "Check the difference in available space above"

echo ""
echo "🔍 If still low on space, check these manually:"
echo "- Large files: find / -type f -size +500M 2>/dev/null"
echo "- Directory usage: du -h /opt /var /usr 2>/dev/null | sort -hr | head -10"
echo "- System logs: ls -lah /var/log/"

echo ""
echo "🚨 CRITICAL: If root partition is still >90% full:"
echo "   Consider increasing server disk size or moving large data to external storage"