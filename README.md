# Mono Repo Structure

This is a mono repo containing:

## rag/
Python backend server with modular architecture:
- `src/api/` - API routes and endpoints
- `src/core/` - Core business logic
- `src/utils/` - Utility functions
- `config/` - Configuration management
- `tests/` - Test files

## quill/
VSCode extension with modular structure:
- `src/commands/` - Command implementations
- `src/providers/` - Service providers
- `src/utils/` - Utility functions

## Getting Started

### Backend (rag)
```bash
cd rag
pip install -r requirements.txt
python app.py
```

### Frontend (quill)
```bash
cd quill
npm install
npm run compile
```# CI/CD Pipeline Ready

The complete CI/CD pipeline is now configured and ready for deployment.

## Quick Status Check
- ✅ GitHub Actions workflow configured
- ✅ SSH keys set up
- ✅ Deployment scripts ready
- ✅ Production configurations prepared

Next: Run the workflow manually or push any changes to trigger deployment.
