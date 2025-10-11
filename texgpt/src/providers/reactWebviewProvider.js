const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

class ReactWebviewProvider {
    constructor(context, emailAuthService) {
        this._context = context;
        this.emailAuthService = emailAuthService;
        this.webviewView = null;
    }

    resolveWebviewView(webviewView) {
        this.webviewView = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            enableCommandUris: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(this._context.extensionPath, 'dist')),
                vscode.Uri.file(path.join(this._context.extensionPath, 'node_modules', '@vscode', 'webview-ui-toolkit'))
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the React app
        webviewView.webview.onDidReceiveMessage(async message => {
            switch (message.command) {
                case 'requestUserData':
                    await this.sendUserData();
                    break;

                case 'signupWithEmail':
                    vscode.commands.executeCommand('texgpt.signupWithEmail', message.email, message.password);
                    break;

                case 'loginWithEmail':
                    vscode.commands.executeCommand('texgpt.loginWithEmail', message.email, message.password);
                    break;

                case 'signup':
                    vscode.commands.executeCommand('texgpt.signup');
                    break;

                case 'logout':
                    vscode.commands.executeCommand('texgpt.logout');
                    break;

                default:
                    break;
            }
        });

        // Send initial user data
        this.sendUserData();
    }

    async sendUserData() {
        if (this.webviewView && this.emailAuthService) {
            const user = await this.emailAuthService.getCurrentUser();
            if (user) {
                this.webviewView.webview.postMessage({
                    command: 'setUser',
                    user: user
                });
            }
        }
    }

    _getHtmlForWebview(webview) {
        const distPath = path.join(this._context.extensionPath, 'dist', 'webview-ui');
        const indexHtmlPath = path.join(distPath, 'index.html');

        // Check if build exists
        if (!fs.existsSync(indexHtmlPath)) {
            return this._getErrorHtml('Please run "npm run build:webview" to build the React app.');
        }

        // Read the built index.html
        let html = fs.readFileSync(indexHtmlPath, 'utf8');

        // Convert asset paths to webview URIs
        const assetsFolderUri = webview.asWebviewUri(
            vscode.Uri.file(path.join(distPath, 'assets'))
        );

        // Get VSCode Webview UI Toolkit URI
        const toolkitUri = webview.asWebviewUri(
            vscode.Uri.file(path.join(this._context.extensionPath, 'node_modules', '@vscode', 'webview-ui-toolkit', 'dist', 'toolkit.js'))
        );

        // Replace asset paths with webview URIs
        html = html.replace(/\/assets\//g, assetsFolderUri.toString() + '/');

        // Inject toolkit script BEFORE React bundle
        const toolkitScript = `<script type="module" src="${toolkitUri}"></script>`;
        html = html.replace('<script type="module"', `${toolkitScript}\n    <script type="module"`);

        // Add CSP (Content Security Policy) for security
        const cspSource = webview.cspSource;
        const csp = `
            <meta http-equiv="Content-Security-Policy" content="
                default-src 'none';
                img-src ${cspSource} https: data:;
                script-src ${cspSource} 'unsafe-inline' 'unsafe-eval';
                style-src ${cspSource} 'unsafe-inline';
                font-src ${cspSource};
            ">
        `;

        // Insert CSP into the head
        html = html.replace('</head>', `${csp}</head>`);

        return html;
    }

    _getErrorHtml(message) {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>TeXGPT - Error</title>
            <style>
                body {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    margin: 0;
                    font-family: var(--vscode-font-family);
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    padding: 20px;
                    text-align: center;
                }
                .error-container {
                    max-width: 400px;
                }
                h1 {
                    font-size: 16px;
                    margin-bottom: 16px;
                }
                p {
                    font-size: 13px;
                    opacity: 0.8;
                }
            </style>
        </head>
        <body>
            <div class="error-container">
                <h1>Build Required</h1>
                <p>${message}</p>
            </div>
        </body>
        </html>`;
    }
}

module.exports = ReactWebviewProvider;
