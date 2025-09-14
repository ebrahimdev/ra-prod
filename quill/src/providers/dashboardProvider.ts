import * as vscode from 'vscode';
import { AuthService } from '../services/authService';

export class DashboardProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'quill.dashboard';

    private _view?: vscode.WebviewView;
    private authService: AuthService;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly context: vscode.ExtensionContext
    ) {
        this.authService = new AuthService(context);
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'signup':
                        this.handleSignup();
                        return;
                    case 'getAuthStatus':
                        this.getAuthStatus();
                        return;
                    case 'devReload':
                        // Developer utility: refresh the webview HTML
                        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
                        return;
                }
            },
            undefined,
            this.context.subscriptions
        );

        // Load initial auth status
        this.getAuthStatus();
    }

    private async getAuthStatus() {
        try {
            const tokens = await this.authService.getStoredTokens();
            const isAuthenticated = !!tokens;

            this._view?.webview.postMessage({
                command: 'authStatus',
                isAuthenticated: isAuthenticated
            });
        } catch (error) {
            this._view?.webview.postMessage({
                command: 'authStatus',
                isAuthenticated: false
            });
        }
    }

    private async handleSignup() {
        vscode.commands.executeCommand('quill.register');
    }

    /**
     * Public method to refresh chat sessions (compatibility with extension.ts)
     */
    public refreshChatSessions() {
        // This method exists for compatibility with the extension command registration
        // The new dashboard doesn't show chat sessions, so this is a no-op
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Quill</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    font-weight: var(--vscode-font-weight);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    margin: 0;
                    padding: 0;
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                }

                .container {
                    text-align: center;
                    padding: 40px 20px;
                    max-width: 300px;
                    width: 100%;
                }

                .logo {
                    font-size: 48px;
                    margin-bottom: 16px;
                    line-height: 1;
                }

                .title {
                    font-size: 24px;
                    font-weight: 600;
                    color: var(--vscode-foreground);
                    margin-bottom: 8px;
                }

                .subtitle {
                    font-size: 14px;
                    color: var(--vscode-descriptionForeground);
                    margin-bottom: 32px;
                    line-height: 1.4;
                }

                .signup-btn {
                    background-color: #007acc;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    margin: 0 20px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    width: calc(100% - 40px);
                    transition: background-color 0.2s ease;
                }

                .signup-btn:hover {
                    background-color: #005a9e;
                }

                .signup-btn:active {
                    transform: translateY(1px);
                }

                .authenticated-message {
                    display: none;
                    text-align: center;
                    color: var(--vscode-testing-iconPassed);
                    font-size: 16px;
                    font-weight: 500;
                }

                .authenticated-subtitle {
                    color: var(--vscode-descriptionForeground);
                    font-size: 14px;
                    margin-top: 8px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div id="unauthenticated-view">
                    <button class="signup-btn" id="signupBtn">Signup</button>
                </div>
                
                <div id="authenticated-view" class="authenticated-message">
                    <div class="authenticated-subtitle">You're all set!</div>
                </div>
            </div>

            <script nonce="${nonce}">
                const vscode = acquireVsCodeApi();
                
                // DEV MODE: Add visual indicator that script is running
                console.log('🪶 Quill Dashboard Loaded - Version: ${Date.now()}');
                
                // Handle messages from extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    switch (message.command) {
                        case 'authStatus':
                            updateAuthStatus(message.isAuthenticated);
                            break;
                        case 'reload':
                            window.location.reload();
                            break;
                    }
                });

                function updateAuthStatus(isAuthenticated) {
                    const unauthenticatedView = document.getElementById('unauthenticated-view');
                    const authenticatedView = document.getElementById('authenticated-view');
                    
                    if (isAuthenticated) {
                        unauthenticatedView.style.display = 'none';
                        authenticatedView.style.display = 'block';
                    } else {
                        unauthenticatedView.style.display = 'block';
                        authenticatedView.style.display = 'none';
                    }
                }

                // Handle signup button click
                document.getElementById('signupBtn').addEventListener('click', () => {
                    vscode.postMessage({ command: 'signup' });
                });

                // DEV MODE: Add keyboard shortcut for quick reload
                document.addEventListener('keydown', (e) => {
                    if (e.ctrlKey && e.shiftKey && e.key === 'R') {
                        console.log('🔄 Dev reload triggered');
                        vscode.postMessage({ command: 'devReload' });
                    }
                });

                // Request initial auth status
                vscode.postMessage({ command: 'getAuthStatus' });
            </script>
        </body>
        </html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}