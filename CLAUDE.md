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

# Build the React webview
npm run build:webview

# Lint and test
npm run lint
npm test

# Development mode (optional)
npm run dev:webview
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
- **React-based SPA** with client-side routing (React Router)
- Single unified webview using ReactWebviewProvider
- Webview-based dashboard with dual authentication options
- Email/password authentication via EmailAuthService
- Google OAuth authentication integration
- Connects to auth and RAG servers
- Uses axios for HTTP requests
- Secure token storage using VSCode Secrets API
- Modern component architecture with React hooks and Context API

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
- **Frontend**: React 19, React Router 6, VSCode Extension API
- **Build Tools**: Vite 6 (for webview bundling)
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
- **React App** (`texgpt/webview-ui/src/`): Single Page Application with routing
  - **AuthContext** (`contexts/AuthContext.jsx`): Global authentication state management
  - **useAuth hook** (`hooks/useAuth.js`): Custom hook for accessing auth state
  - **useVSCode hook** (`hooks/useVSCode.js`): VSCode messaging communication
  - **Auth Pages** (`pages/Auth/`): Login/Signup forms with validation
  - **Dashboard Page** (`pages/Dashboard/`): Main dashboard view
- **ReactWebviewProvider** (`texgpt/src/providers/reactWebviewProvider.js`): Unified webview provider serving React app
- **EmailAuthService** (`texgpt/src/services/emailAuthService.js`): Handles email/password authentication API calls
- **Extension Commands** (`texgpt/extension.js`): VSCode command handlers for authentication actions

### Authentication Flow
1. User enters credentials in React auth form (SignupForm/LoginForm)
2. Form validates input using validation utils
3. Form calls auth function from useAuth hook (AuthContext)
4. AuthContext sends message via useVSCode hook
5. ReactWebviewProvider receives message and executes VSCode command
6. EmailAuthService makes API call to auth server
7. Successful authentication stores JWT tokens securely via VSCode Secrets API
8. Extension sends user data back to React via postMessage
9. AuthContext updates state, triggering UI re-render
10. User is redirected to dashboard via React Router
11. User session persists across extension restarts

### Token Management
- Access tokens stored using VSCode Secrets API
- Refresh tokens for automatic session renewal
- Secure storage with fallback to workspace configuration
- User information cached in extension global state

## Development Patterns

### Backend (Python/Flask)
- Both Flask apps follow modular architecture with separate `api/`, `core/`, `models/`, and `middleware/` directories
- Use of Python virtual environments for isolation
- Configuration management through environment files
- RESTful API design patterns
- JWT-based authentication between services

### Frontend (React/TypeScript)
- **React SPA Architecture**: Single Page Application with client-side routing
- **Component-based**: Reusable components in `components/common/`
- **Page-based routing**: Route-level components in `pages/`
- **Context API**: Global state management (AuthContext)
- **Custom Hooks**: useAuth, useVSCode for reusable logic
- **Functional Components**: Modern React with hooks (useState, useEffect, useCallback)
- **Declarative UI**: React component composition
- **Message Passing**: Webview ↔ Extension communication via postMessage
- **VSCode Integration**: Seamless theme integration using CSS variables

### Build & Development
- **Vite**: Fast bundler with HMR (Hot Module Replacement)
- **Development Mode**: `npm run dev:webview` for live reload
- **Production Build**: `npm run build:webview` creates optimized bundles
- **Build Output**: Bundled app in `dist/webview-ui/` (gitignored)