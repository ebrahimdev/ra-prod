const vscode = require('vscode');
const path = require('path');
const BaseWebviewProvider = require('./baseWebviewProvider');

class DashboardProvider extends BaseWebviewProvider {
    constructor(context) {
        super(context);
    }

    resolveWebviewView(webviewView) {
        webviewView.webview.options = {
            enableScripts: true,
            enableCommandUris: true,
            localResourceRoots: [
                this._context.extensionUri,
                vscode.Uri.file(path.join(this._context.extensionPath, 'node_modules'))
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'signup':
                    vscode.commands.executeCommand('texgpt.signup');
                    break;
            }
        });
    }

    _getHtmlForWebview(webview) {
        // Load base layout template
        const layoutPath = path.join(this._context.extensionPath, 'src', 'webview', 'base', 'layout.html');
        const layout = this.loadTemplate(layoutPath);
        
        // Load dashboard content
        const contentPath = path.join(this._context.extensionPath, 'src', 'webview', 'dashboard', 'index.html');
        const content = this.loadTemplate(contentPath);
        
        // Create resource URIs
        const replacements = {
            toolkitUri: this.getToolkitUri(webview).toString(),
            baseStyleUri: this.createResourceUri('src/webview/base/base.css', webview).toString(),
            componentStyleUri: this.createResourceUri('src/webview/dashboard/styles.css', webview).toString(),
            componentScriptUri: this.createResourceUri('src/webview/dashboard/script.js', webview).toString(),
            content: content
        };
        
        return this.replaceTemplatePlaceholders(layout, replacements);
    }
}

module.exports = DashboardProvider;