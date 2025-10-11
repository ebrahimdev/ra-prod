# TeXGPT - Quick Start Guide

## Setup & Run (5 minutes)

### 1. Install Dependencies
```bash
cd texgpt
npm install
```

### 2. Build React Webview
```bash
npm run build:webview
```

### 3. Run Extension
- Press `F5` in VSCode (or Run > Start Debugging)
- A new VSCode window will open (Extension Development Host)
- Click the TeXGPT icon in the Activity Bar (book icon)

### 4. Test Features
- **Signup**: Create account with email/password
- **Login**: Login with existing credentials
- **Google OAuth**: Sign in with Google
- **Dashboard**: View dashboard after authentication
- **Logout**: Click logout button

## Development Workflow

### Making Changes to React UI

1. **Edit React files** in `webview-ui/src/`
2. **Rebuild**: `npm run build:webview`
3. **Reload extension**: Press `Ctrl+R` (or `Cmd+R` on Mac) in Extension Development Host

### Development Mode (Hot Reload)
```bash
# Terminal 1: Start Vite dev server
npm run dev:webview

# Terminal 2: Launch extension (F5 in VSCode)
```

**Note**: In dev mode, you'll need to refresh the webview manually after changes.

## Project Structure

```
texgpt/
├── webview-ui/          # React SPA
│   └── src/            # React source code
├── src/
│   ├── providers/      # Extension providers
│   └── services/       # Auth services
├── dist/               # Build output (auto-generated)
├── extension.js        # Extension entry point
└── package.json        # Dependencies & scripts
```

## Common Commands

```bash
# Build React app
npm run build:webview

# Start dev server
npm run dev:webview

# Lint code
npm run lint

# Run tests
npm test
```

## Troubleshooting

### "Build Required" error
```bash
npm run build:webview
```

### Webview not updating
1. Rebuild: `npm run build:webview`
2. Reload extension: Press `Ctrl+R` in Extension Development Host

### Extension not loading
1. Check for errors in Debug Console
2. Open Developer Tools: `Help > Toggle Developer Tools`
3. Check console for errors

### Auth server connection errors
1. Check if auth server is running (port 8001 or 5000)
2. Verify `config/local.json` or `config/production.json`
3. Check network connectivity

## Next Steps

- Read `REACT_MIGRATION.md` for architecture details
- Read `webview-ui/README.md` for component development
- Read `CLAUDE.md` for full project documentation

## Need Help?

- Check the documentation files
- Review React component code in `webview-ui/src/`
- Check VSCode Extension API docs

---

**Happy Coding! 🚀**
