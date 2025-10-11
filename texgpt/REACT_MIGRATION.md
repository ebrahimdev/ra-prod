# React Migration Guide

## Overview

The TeXGPT extension has been successfully refactored from vanilla JavaScript to a modern React-based Single Page Application (SPA) with client-side routing.

## New Architecture

### Structure

```
texgpt/
├── webview-ui/                 # React application source
│   ├── src/
│   │   ├── App.jsx            # Root component with routing
│   │   ├── main.jsx           # Entry point
│   │   ├── vscode.js          # VSCode API wrapper
│   │   ├── components/        # Reusable components
│   │   │   ├── Layout.jsx
│   │   │   ├── PrivateRoute.jsx
│   │   │   └── common/
│   │   │       ├── Button.jsx
│   │   │       ├── Input.jsx
│   │   │       └── GoogleIcon.jsx
│   │   ├── pages/             # Page components
│   │   │   ├── Auth/
│   │   │   │   ├── AuthPage.jsx
│   │   │   │   ├── SignupForm.jsx
│   │   │   │   ├── LoginForm.jsx
│   │   │   │   └── GoogleAuth.jsx
│   │   │   ├── Dashboard/
│   │   │   │   └── DashboardPage.jsx
│   │   │   └── NotFound.jsx
│   │   ├── contexts/          # React Context providers
│   │   │   └── AuthContext.jsx
│   │   ├── hooks/             # Custom React hooks
│   │   │   ├── useAuth.js
│   │   │   └── useVSCode.js
│   │   ├── styles/            # Global styles
│   │   │   └── global.css
│   │   └── utils/             # Utility functions
│   │       └── validation.js
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── src/
│   ├── providers/
│   │   └── reactWebviewProvider.js  # Unified webview provider
│   └── services/
│       └── emailAuthService.js      # Auth service (unchanged)
├── dist/                       # Build output (gitignored)
│   └── webview-ui/
├── extension.js                # Extension entry (updated)
└── package.json
```

## Key Features

### 1. Single Page Application (SPA)
- Uses **React Router** with `MemoryRouter` for client-side routing
- Smooth transitions between auth and dashboard views
- No page reloads for navigation

### 2. Modern React Patterns
- **Hooks**: `useState`, `useEffect`, `useCallback`, `useContext`, custom hooks
- **Context API**: Global authentication state management via `AuthContext`
- **Functional Components**: All components use modern functional approach

### 3. Component Architecture
- **Reusable Components**: Button, Input, Layout, GoogleIcon
- **Page Components**: AuthPage, DashboardPage, NotFound
- **Route Protection**: `PrivateRoute` component for authenticated routes
- **Proper Separation**: Components, pages, hooks, contexts, utils

### 4. State Management
- **AuthContext**: Centralized auth state (user, loading, error)
- **VSCode Integration**: Custom `useVSCode` hook for extension communication
- **Persistent State**: Webview state persistence using VSCode's `setState/getState`

### 5. Build System
- **Vite**: Fast, modern build tool with hot module replacement
- **Optimized Output**: Bundled assets in `dist/webview-ui/`
- **Development Mode**: Live reload during development

## Routing Structure

### Routes
- `/` → Redirects to `/auth`
- `/auth` → Authentication page (signup/login)
- `/dashboard` → Dashboard page (protected route)
- `*` → 404 Not Found page

### Route Protection
The `PrivateRoute` component checks authentication status:
- If authenticated → Render protected content
- If not authenticated → Redirect to `/auth`
- If loading → Show loading state

## Development Workflow

### Setup
```bash
cd texgpt
npm install
```

### Development
```bash
# Start Vite dev server (optional, for hot reload)
npm run dev:webview

# Build for production
npm run build:webview
```

### Testing in VS Code
1. Build the webview: `npm run build:webview`
2. Press `F5` in VS Code to launch extension development host
3. Open the TeXGPT sidebar view

## Component Communication

### React → Extension
React components use `useVSCode` hook to send messages:
```javascript
const { login } = useAuth();
login(email, password); // Sends message to extension
```

### Extension → React
Extension sends messages to React via `postMessage`:
```javascript
webviewView.webview.postMessage({
  command: 'setUser',
  user: userData
});
```

### Message Flow
1. User interacts with React UI
2. React component calls auth function from `AuthContext`
3. `AuthContext` sends message via `useVSCode`
4. Extension receives message in `ReactWebviewProvider`
5. Extension executes command (e.g., login)
6. Extension sends response back to React
7. React updates UI based on response

## Styling Approach

### VSCode Theme Variables
All styles use VSCode CSS variables for theme consistency:
- `var(--vscode-editor-background)`
- `var(--vscode-editor-foreground)`
- `var(--vscode-button-background)`
- `var(--vscode-input-border)`
- etc.

### CSS Organization
- **global.css**: Reset, utility classes, base styles
- **Component CSS**: Co-located with components (e.g., `Button.css`)
- **Page CSS**: Co-located with pages (e.g., `AuthPage.css`)

## Migration Benefits

### Before (Vanilla JS)
❌ Multiple HTML templates loaded separately
❌ Vanilla DOM manipulation
❌ Page reloads on state changes
❌ Scattered state management
❌ Difficult to scale and maintain

### After (React)
✅ Single HTML with dynamic routing
✅ Declarative React components
✅ Smooth SPA transitions
✅ Centralized state with Context API
✅ Easy to add new features
✅ Better developer experience
✅ Hot module replacement in dev
✅ Type-safe with potential TypeScript migration

## Extending the Application

### Adding a New Page
1. Create component in `webview-ui/src/pages/NewPage/`
2. Add route in `App.jsx`:
```javascript
<Route path="/new-page" element={<NewPage />} />
```

### Adding a New Reusable Component
1. Create in `webview-ui/src/components/common/`
2. Export and import where needed

### Adding New Auth Methods
1. Add method to `AuthContext`
2. Update `ReactWebviewProvider` message handler
3. Add VSCode command in `extension.js`

## Build & Deployment

### Production Build
```bash
npm run build:webview
```
This creates optimized bundles in `dist/webview-ui/`

### What Gets Built
- **index.html**: Entry HTML file
- **assets/index.js**: Bundled JavaScript (~220KB, 70KB gzipped)
- **assets/index.css**: Bundled CSS (~5KB, 1.2KB gzipped)

### Extension Package
The `dist/` folder is included in the extension package. Users don't need to build anything.

## Troubleshooting

### Build Error
If you see "Please run npm run build:webview":
```bash
cd texgpt
npm run build:webview
```

### Webview Not Loading
1. Check that `dist/webview-ui/index.html` exists
2. Reload the extension development host
3. Check the Developer Tools console for errors

### Styling Issues
1. Ensure you're using VSCode CSS variables
2. Check CSP (Content Security Policy) settings
3. Verify asset paths are correctly transformed

## Future Enhancements

### Potential Improvements
- [ ] Add TypeScript for type safety
- [ ] Implement more dashboard features
- [ ] Add loading skeletons
- [ ] Implement error boundaries
- [ ] Add unit tests with React Testing Library
- [ ] Add E2E tests with Playwright
- [ ] Optimize bundle size with code splitting
- [ ] Add analytics and telemetry
- [ ] Implement dark/light mode toggle (if needed)
- [ ] Add keyboard shortcuts navigation

## Legacy Code Cleanup

The following files are now deprecated and can be removed:
- `src/webview/auth/` (old vanilla JS auth view)
- `src/webview/dashboard/` (old vanilla JS dashboard view)
- `src/webview/base/` (old base templates)
- `src/providers/authProvider.js` (replaced by ReactWebviewProvider)
- `src/providers/dashboardProvider.js` (replaced by ReactWebviewProvider)
- `src/providers/baseWebviewProvider.js` (no longer needed)

**Note**: Keep these files temporarily until you've fully tested the new React implementation.

## Resources

- [React Documentation](https://react.dev)
- [React Router](https://reactrouter.com)
- [Vite Documentation](https://vitejs.dev)
- [VS Code Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [VS Code Extension API](https://code.visualstudio.com/api)

---

**Migration completed successfully! 🎉**
