# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a monorepo containing three main applications:

1. **auth-server/** - Flask authentication service with Google OAuth support
2. **rag/** - Flask RAG (Retrieval-Augmented Generation) service for document processing and AI chat
3. **texgpt/** - VSCode extension that provides AI-powered academic research assistance

## Development Commands

### Python Applications (auth-server & rag)

Both Flask applications follow the same patterns:

```bash
# Setup virtual environment and dependencies
cd auth-server  # or cd rag
python3.10 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run the application
python app.py

# Run tests (if test files exist)
pytest
```

### VSCode Extension (texgpt)

```bash
cd texgpt
npm install
npm run lint
npm test
```

### Development Environment

Use the provided development script to start all services in tmux:

```bash
./start-dev.sh
```

This creates a tmux session with:
- Left pane: RAG server (port 5001)
- Right top: Auth server (port 5000)  
- Right bottom: texgpt directory for extension development

## Architecture

### Auth Server (Port 5000)
- Flask app with JWT authentication
- Google OAuth integration and email/password authentication
- SQLite database for user management
- Session management with Flask-Session
- User registration and login endpoints

### RAG Server (Port 5001)
- Document upload and processing (PDF support)
- Sentence transformers for embeddings (CPU-only)
- SQLite database for document storage
- JWT auth integration with auth-server

### TeXGPT Extension
- VSCode extension for academic research
- Webview-based dashboard with dual authentication options
- Email/password authentication via EmailAuthService
- Google OAuth authentication integration
- Connects to auth and RAG servers
- Uses axios for HTTP requests
- Secure token storage using VSCode Secrets API

## Configuration

### Production Deployment
- Configuration files in `config/` directory
- Automated deployment via GitHub Actions
- Scripts in `scripts/` for server management
- Zero-downtime deployment with backup/restore

### Development
- Local development uses default Flask ports
- Extension configured for local servers during development
- Production builds automatically reconfigure endpoints

## Key Technologies

- **Backend**: Flask, SQLAlchemy, PyJWT, sentence-transformers
- **Frontend**: VSCode Extension API, Webview UI Toolkit
- **Database**: SQLite
- **Authentication**: Google OAuth 2.0, Email/Password, JWT tokens
- **Document Processing**: PyMuPDF, pdfplumber
- **AI/ML**: Hugging Face transformers, CPU-optimized PyTorch

## Authentication Architecture

### Backend Components (Auth Server)
- **User Model** (`auth-server/src/models/user.py`): SQLAlchemy model with bcrypt password hashing
- **AuthService** (`auth-server/src/core/auth_service.py`): Core authentication logic for user creation and validation
- **Auth Routes** (`auth-server/src/api/auth_routes.py`): REST endpoints for registration, login, refresh, and OAuth

### Frontend Components (TeXGPT Extension)
- **EmailAuthService** (`texgpt/src/services/emailAuthService.js`): Handles email/password authentication API calls
- **Dashboard Provider** (`texgpt/src/providers/dashboardProvider.js`): Manages webview communication for auth commands
- **Dashboard Script** (`texgpt/src/webview/dashboard/script.js`): Client-side form validation and user interaction
- **Extension Commands** (`texgpt/extension.js`): VSCode command handlers for authentication actions

### Authentication Flow
1. User enters credentials in dashboard webview
2. Dashboard script validates input and sends message to provider
3. Provider executes VSCode command with user data
4. EmailAuthService makes API call to auth server
5. Successful authentication stores JWT tokens securely
6. User session persists across extension restarts

### Token Management
- Access tokens stored using VSCode Secrets API
- Refresh tokens for automatic session renewal
- Secure storage with fallback to workspace configuration
- User information cached in extension global state

## Development Patterns

- Both Flask apps follow modular architecture with separate `api/`, `core/`, `models/`, and `middleware/` directories
- Use of Python virtual environments for isolation
- Configuration management through environment files
- RESTful API design patterns
- JWT-based authentication between services
- Extension uses command pattern for authentication actions
- Webview communication via message passing