#!/bin/bash

echo "🗑️ Removing All Deployment Backups"
echo "================================="

# Remove all backup directories
echo "📁 Removing backup directories..."
rm -rf /opt/ra-prod/backups
rm -rf /opt/ra-prod/auth-server/backup*
rm -rf /opt/ra-prod/rag/backup*

# Find and remove any other backup directories
echo "🔍 Finding and removing any other backup directories..."
find /opt/ra-prod -name "*backup*" -type d -exec rm -rf {} \; 2>/dev/null

echo "✅ All deployment backups removed!"

# Check space freed up
echo "💾 Current disk usage:"
df -h /

echo ""
echo "📊 ra-prod directory usage after cleanup:"
du -h /opt/ra-prod/ 2>/dev/null | sort -hr | head -10