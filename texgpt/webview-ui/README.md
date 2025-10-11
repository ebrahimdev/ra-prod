# TeXGPT Webview UI

React-based Single Page Application for the TeXGPT VSCode extension.

## Quick Start

### Install Dependencies
```bash
cd texgpt
npm install
```

### Development
```bash
# Start dev server with hot reload
npm run dev:webview

# Build for production
npm run build:webview
```

## Project Structure

```
src/
├── App.jsx                 # Root component with router setup
├── main.jsx               # React entry point
├── vscode.js              # VSCode API wrapper
├── components/            # Reusable UI components
│   ├── Layout.jsx
│   ├── PrivateRoute.jsx
│   └── common/
│       ├── Button.jsx
│       ├── Input.jsx
│       └── GoogleIcon.jsx
├── pages/                 # Page components
│   ├── Auth/
│   │   ├── AuthPage.jsx        # Main auth container
│   │   ├── SignupForm.jsx      # Signup form
│   │   ├── LoginForm.jsx       # Login form
│   │   └── GoogleAuth.jsx      # Google OAuth button
│   ├── Dashboard/
│   │   └── DashboardPage.jsx   # Main dashboard
│   └── NotFound.jsx            # 404 page
├── contexts/              # React Context providers
│   └── AuthContext.jsx    # Authentication state
├── hooks/                 # Custom React hooks
│   ├── useAuth.js        # Auth context hook
│   └── useVSCode.js      # VSCode messaging hook
├── styles/               # Global styles
│   └── global.css
└── utils/                # Utility functions
    └── validation.js     # Form validation
```

## Tech Stack

- **React 19** - UI library
- **React Router 6** - Client-side routing
- **Vite 6** - Build tool
- **CSS** - Styling with VSCode theme variables

## Key Concepts

### Routing
Uses `MemoryRouter` for client-side routing:
- `/auth` - Authentication page
- `/dashboard` - Dashboard (protected)

### State Management
- **AuthContext** - Global authentication state
- **VSCode State** - Persistent state via VSCode API

### VSCode Communication
```javascript
// Send message to extension
import { postMessage } from './vscode';
postMessage({ command: 'login', email, password });

// Listen for messages
import { useVSCode } from './hooks/useVSCode';
const sendMessage = useVSCode((message) => {
  console.log('Received:', message);
});
```

### Authentication Flow
1. User submits form → `SignupForm`/`LoginForm`
2. Form calls `useAuth()` hook
3. `AuthContext` sends message via `useVSCode`
4. Extension handles message in `ReactWebviewProvider`
5. Extension responds with user data
6. `AuthContext` updates state
7. UI re-renders

## Component Guidelines

### Creating a New Component
```javascript
// src/components/MyComponent.jsx
import React from 'react';
import './MyComponent.css';

const MyComponent = ({ prop1, prop2 }) => {
  return (
    <div className="my-component">
      {/* component content */}
    </div>
  );
};

export default MyComponent;
```

### Using VSCode Theme Variables
```css
.my-component {
  background-color: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  border: 1px solid var(--vscode-widget-border);
}
```

### Common VSCode CSS Variables
- `--vscode-editor-background`
- `--vscode-editor-foreground`
- `--vscode-button-background`
- `--vscode-button-foreground`
- `--vscode-input-background`
- `--vscode-input-foreground`
- `--vscode-input-border`
- `--vscode-focusBorder`
- `--vscode-descriptionForeground`

## Development Tips

### Hot Reload
Run `npm run dev:webview` and make changes. Vite will automatically reload.

### Testing in VSCode
1. Build: `npm run build:webview`
2. Press F5 in VSCode to launch extension
3. Open TeXGPT sidebar

### Debugging
- Open VSCode DevTools: `Help > Toggle Developer Tools`
- Console logs appear in DevTools Console
- React DevTools extension works in webviews

## Build Output

Build creates:
- `../dist/webview-ui/index.html` - Entry HTML
- `../dist/webview-ui/assets/index.js` - Bundled JS (~220KB)
- `../dist/webview-ui/assets/index.css` - Bundled CSS (~5KB)

## Common Tasks

### Add a New Page
1. Create in `src/pages/`
2. Add route in `App.jsx`
3. Build and test

### Add Authentication Method
1. Add method to `AuthContext`
2. Update extension message handlers
3. Add VSCode command if needed

### Modify Styles
1. Edit component CSS files
2. Use VSCode CSS variables
3. Test in both light and dark themes

## Troubleshooting

**Webview not loading?**
- Run `npm run build:webview`
- Reload extension development host

**Styles not applying?**
- Check CSS variable names
- Verify CSP policy
- Clear VSCode cache

**Messages not sending?**
- Check `useVSCode` hook usage
- Verify message command names
- Check extension message handlers

## Resources

- [React Docs](https://react.dev)
- [React Router Docs](https://reactrouter.com)
- [Vite Docs](https://vitejs.dev)
- [VSCode Webview API](https://code.visualstudio.com/api/extension-guides/webview)
