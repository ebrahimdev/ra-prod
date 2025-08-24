# Deployment Guide

## CI/CD Setup for ra-prod

This guide explains how to set up continuous deployment for your ra-prod monorepo to a Linux server.

## Prerequisites

1. **Linux Server**: Debian 12 x64 (IP: 45.76.61.43)
2. **GitHub Repository**: Connected to your codebase
3. **GitHub Secrets**: Required for authentication

## Initial Server Setup

1. **Run the server setup script on your Linux server**:
   ```bash
   # Copy the setup script to your server
   scp scripts/setup-server.sh root@45.76.61.43:~/
   
   # SSH into your server and run setup
   ssh root@45.76.61.43
   chmod +x ~/setup-server.sh
   sudo ./setup-server.sh
   ```

2. **Upload configuration files**:
   ```bash
   # Create config directory on server
   ssh root@45.76.61.43 "mkdir -p /opt/ra-prod/config"
   
   # Upload production configuration files
   scp config/*.env root@45.76.61.43:/opt/ra-prod/config/
   ```

## GitHub Secrets Setup

Configure these secrets in your GitHub repository settings:

### Required Secrets

1. **SSH_PRIVATE_KEY**: 
   - Generate SSH key pair on your local machine
   - Add public key to server's `~/.ssh/authorized_keys`
   - Add private key to GitHub secrets

2. **SERVER_PASSWORD**: 
   - Your server root password: `}Gq5g}n+)-e-Amm`

### Setting up SSH Key (Recommended)

```bash
# Generate SSH key pair
ssh-keygen -t rsa -b 4096 -f ~/.ssh/ra-prod-deploy

# Copy public key to server
ssh-copy-id -i ~/.ssh/ra-prod-deploy.pub root@45.76.61.43

# Add private key content to GitHub Secrets as SSH_PRIVATE_KEY
cat ~/.ssh/ra-prod-deploy
```

## Architecture Overview

### Services

1. **Auth Server** (Port 5000)
   - Flask application for authentication
   - JWT token management
   - User registration/login

2. **RAG Server** (Port 5001)
   - Flask application for RAG functionality
   - Document processing and querying
   - PDF upload and embedding

3. **Nginx Reverse Proxy** (Port 80)
   - Routes requests to appropriate services
   - Handles CORS and file uploads

### Directory Structure

```
/opt/ra-prod/
├── auth-server/
│   ├── current/        # Active deployment
│   └── new/           # Staging area for deployments
├── rag/
│   ├── current/        # Active deployment
│   └── new/           # Staging area for deployments
├── config/            # Production configuration files
├── backups/           # Automatic backups
└── monitor.sh         # System monitoring script
```

## Deployment Process

### Automated Deployment

Every push to `main` branch triggers:

1. **Testing Phase**:
   - Run tests for both Flask applications
   - Build and compile Quill extension

2. **Build Phase**:
   - Create production build of Quill extension
   - Configure extension for production server endpoints

3. **Deployment Phase**:
   - Deploy configuration files
   - Deploy Auth Server with zero downtime
   - Deploy RAG Server with zero downtime
   - Perform health checks

4. **Release Phase**:
   - Create GitHub release with artifacts
   - Include production Quill extension build

### Manual Deployment

You can also deploy manually:

```bash
# Deploy Auth Server only
./scripts/deploy-auth-server.sh

# Deploy RAG Server only  
./scripts/deploy-rag.sh

# Build production Quill extension
./scripts/build-quill-prod.sh
```

## Monitoring

### System Status

```bash
# Run monitoring script on server
ssh root@45.76.61.43 "/opt/ra-prod/monitor.sh"
```

### Service Logs

```bash
# View Auth Server logs
ssh root@45.76.61.43 "journalctl -u auth-server -f"

# View RAG Server logs
ssh root@45.76.61.43 "journalctl -u rag-server -f"

# View Nginx logs
ssh root@45.76.61.43 "tail -f /var/log/nginx/access.log"
```

### Service Management

```bash
# Restart services
ssh root@45.76.61.43 "sudo systemctl restart auth-server"
ssh root@45.76.61.43 "sudo systemctl restart rag-server"

# Check service status
ssh root@45.76.61.43 "sudo systemctl status auth-server rag-server nginx"
```

## Production URLs

- **Auth Server**: http://45.76.61.43:5000
- **RAG Server**: http://45.76.61.43:5001
- **Combined API**: http://45.76.61.43 (via nginx)

## Quill Extension Production Build

The production build of the Quill extension:

1. **Automatically configures** server endpoints to production URLs
2. **Increments version** number for each build
3. **Creates .vsix package** ready for distribution
4. **Available as release artifact** after successful deployment

### Installing Production Extension

1. Download the `.vsix` file from latest GitHub release
2. Install in VS Code: `Extensions > Install from VSIX...`
3. Extension will connect to production servers automatically

## Configuration Files

### Production Environment Variables

- `config/auth-server.prod.env`: Auth server configuration
- `config/rag-server.prod.env`: RAG server configuration  
- `config/production.env`: Shared production settings

### Security Notes

1. **Change JWT secrets** in production environment files
2. **Use HTTPS** in production (update nginx configuration)
3. **Configure firewall** rules as needed
4. **Regular backups** are automated in deployment scripts

## Troubleshooting

### Common Issues

1. **Service won't start**:
   ```bash
   # Check logs
   journalctl -u auth-server -n 50
   journalctl -u rag-server -n 50
   ```

2. **Database issues**:
   ```bash
   # Check database file permissions
   ls -la /opt/ra-prod/*/current/*.db
   ```

3. **Network issues**:
   ```bash
   # Test health endpoints
   curl http://45.76.61.43:5000/health
   curl http://45.76.61.43:5001/health
   ```

### Rolling Back

```bash
# Rollback to previous backup
ssh root@45.76.61.43 << 'EOF'
    cd /opt/ra-prod/backups
    LATEST_BACKUP=$(ls -t auth-server-* | head -n1)
    sudo systemctl stop auth-server
    cp -r "$LATEST_BACKUP" /opt/ra-prod/auth-server/current
    sudo systemctl start auth-server
EOF
```

## Support

For issues related to:
- **Server setup**: Check `/var/log/ra-prod.log` 
- **Deployment**: Check GitHub Actions logs
- **Application**: Check service logs with `journalctl`

## Next Steps

1. Set up SSL certificates for HTTPS
2. Configure domain name instead of IP
3. Add database backups
4. Set up monitoring alerts
5. Configure staging environment