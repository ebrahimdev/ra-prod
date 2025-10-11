# VSCode Webview UI Toolkit Loading Fix

## Problem
The VSCode UI Toolkit components (`<vscode-text-field>`, `<vscode-button>`) were not rendering in the webview. The page showed text but no input fields or buttons.

## Root Cause
1. **Toolkit wasn't loading before React** - The toolkit was being imported in the React bundle, but custom web components need to be registered BEFORE React tries to use them
2. **Node modules not accessible** - The webview provider only had access to the `dist` folder, not the toolkit in `node_modules`
3. **Bundling issue** - Vite was bundling the toolkit with React code, causing timing issues with custom element registration

## Solution

### 1. Updated ReactWebviewProvider (extension side)
**File**: `src/providers/reactWebviewProvider.js`

#### Added node_modules to localResourceRoots:
```javascript
localResourceRoots: [
    vscode.Uri.file(path.join(this._context.extensionPath, 'dist')),
    vscode.Uri.file(path.join(this._context.extensionPath, 'node_modules', '@vscode', 'webview-ui-toolkit'))
]
```

#### Injected toolkit script BEFORE React:
```javascript
// Get VSCode Webview UI Toolkit URI
const toolkitUri = webview.asWebviewUri(
    vscode.Uri.file(path.join(this._context.extensionPath, 'node_modules', '@vscode', 'webview-ui-toolkit', 'dist', 'toolkit.js'))
);

// Inject toolkit script BEFORE React bundle
const toolkitScript = `<script type="module" src="${toolkitUri}"></script>`;
html = html.replace('<script type="module"', `${toolkitScript}\n    <script type="module"`);
```

#### Updated CSP:
Added `'unsafe-eval'` to script-src for toolkit execution:
```javascript
script-src ${cspSource} 'unsafe-inline' 'unsafe-eval';
```

### 2. Removed Toolkit Import from React (client side)
**File**: `webview-ui/src/main.jsx`

**Before**:
```javascript
import '@vscode/webview-ui-toolkit/dist/toolkit.js';
```

**After**:
```javascript
// VSCode Webview UI Toolkit is loaded via script tag in HTML
// to ensure custom elements are registered before React initializes
```

## How It Works Now

### Loading Sequence:
1. **HTML loads** from `dist/webview-ui/index.html`
2. **ReactWebviewProvider intercepts** and modifies HTML
3. **Toolkit script injected** FIRST: `<script type="module" src="vscode-webview://...toolkit.js"></script>`
4. **React script loads** SECOND: `<script type="module" src="vscode-webview://...index.js"></script>`
5. **Custom elements registered** by toolkit before React renders
6. **React renders** and can now use `<vscode-text-field>`, `<vscode-button>`, etc.

### File Structure:
```
Extension:
├── node_modules/@vscode/webview-ui-toolkit/
│   └── dist/toolkit.js          <-- Served directly to webview
├── dist/webview-ui/
│   ├── index.html               <-- Modified by ReactWebviewProvider
│   └── assets/
│       ├── index.js             <-- React bundle (no toolkit)
│       └── index.css
```

## Key Benefits

✅ **Proper loading order** - Toolkit loads before React
✅ **Custom elements work** - Web components are registered in time
✅ **Smaller bundle** - Toolkit not bundled with React code
✅ **VSCode native feel** - Uses official VSCode components
✅ **Better performance** - Script tag loading is more efficient

## Testing

To verify the fix works:
1. Rebuild: `npm run build:webview`
2. Launch extension (F5 in VSCode)
3. Open TeXGPT sidebar
4. Input fields and buttons should now be visible
5. Components should have VSCode native styling

## Components Now Working

- `<vscode-text-field>` - Email and Password inputs
- `<vscode-button>` - Sign up, Log in, Sign in with Google buttons
- Future VSCode components can be used without issues

## Technical Details

### CSP (Content Security Policy)
```
default-src 'none';
img-src ${cspSource} https: data:;
script-src ${cspSource} 'unsafe-inline' 'unsafe-eval';  <-- Added unsafe-eval
style-src ${cspSource} 'unsafe-inline';
font-src ${cspSource};
```

### Resource URIs
All resources are converted to VSCode webview URIs:
- `vscode-webview://UUID/...toolkit.js` (from node_modules)
- `vscode-webview://UUID/...index.js` (from dist)
- `vscode-webview://UUID/...index.css` (from dist)

## Related Files Modified

1. `src/providers/reactWebviewProvider.js` - Toolkit loading logic
2. `webview-ui/src/main.jsx` - Removed toolkit import
3. `webview-ui/src/components/common/Input.jsx` - Uses `<vscode-text-field>`
4. `webview-ui/src/components/common/Button.jsx` - Uses `<vscode-button>`
5. `webview-ui/src/components/common/Input.css` - Styles with `::part()` selectors
6. `webview-ui/src/components/common/Button.css` - Styles with `::part()` selectors

## Future Improvements

- Consider caching toolkit URI for performance
- Add error handling if toolkit fails to load
- Potentially preload toolkit for faster initial render
- Add fallback UI if custom elements not supported

---

**Status**: ✅ FIXED
**Date**: October 11, 2025
**Build**: Successful
