const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

class ChatWebviewProvider {
    constructor(context, chatService) {
        this._context = context;
        this.chatService = chatService;
    }

    /**
     * Create and show a chat editor panel
     */
    createChatPanel(conversationId = 'new') {
        // Check if editor already open for this conversation
        const existingPanel = this.chatService.getEditor(conversationId);
        if (existingPanel) {
            existingPanel.reveal();
            return existingPanel;
        }

        // Create new panel
        const panel = vscode.window.createWebviewPanel(
            'texgptChat',
            conversationId === 'new' ? 'New Chat' : `Chat ${conversationId}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(this._context.extensionPath, 'dist'))
                ]
            }
        );

        panel.webview.html = this._getHtmlForWebview(panel.webview);

        // Handle messages from the React app
        panel.webview.onDidReceiveMessage(message => {
            this._handleMessage(message, panel, conversationId);
        });

        // Register the panel
        this.chatService.registerEditor(conversationId, panel);

        // Send initial data
        panel.webview.postMessage({
            command: 'init',
            conversationId
        });

        return panel;
    }

    _handleMessage(message, panel, conversationId) {
        switch (message.command) {
            case 'ready':
                // Chat app is ready
                console.log('Chat webview ready:', conversationId);
                break;

            default:
                console.log('Unknown chat message:', message.command);
                break;
        }
    }

    _getHtmlForWebview(webview) {
        const distPath = path.join(this._context.extensionPath, 'dist', 'webview-chat');
        const chatHtmlPath = path.join(distPath, 'chat.html');

        // Check if build exists
        if (!fs.existsSync(chatHtmlPath)) {
            return this._getErrorHtml('Please run "npm run build:chat" to build the chat app.');
        }

        // Read the built chat.html
        let html = fs.readFileSync(chatHtmlPath, 'utf8');

        // Convert asset paths to webview URIs
        const assetsFolderUri = webview.asWebviewUri(
            vscode.Uri.file(path.join(distPath, 'assets'))
        );

        // Replace asset paths
        html = html.replace(/\/assets\//g, assetsFolderUri.toString() + '/');

        // Add CSP
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

        html = html.replace('</head>', `${csp}</head>`);

        return html;
    }

    _getErrorHtml(message) {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>TeXGPT Chat - Error</title>
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

module.exports = ChatWebviewProvider;
