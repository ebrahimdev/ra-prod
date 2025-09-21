const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

class BaseWebviewProvider {
    constructor(context) {
        this._context = context;
    }

    loadTemplate(templatePath) {
        try {
            return fs.readFileSync(templatePath, 'utf8');
        } catch (error) {
            console.error(`Failed to load template from ${templatePath}:`, error);
            return '<div>Error loading template</div>';
        }
    }

    createResourceUri(relativePath, webview) {
        return webview.asWebviewUri(
            vscode.Uri.file(path.join(this._context.extensionPath, relativePath))
        );
    }

    getToolkitUri(webview) {
        return webview.asWebviewUri(
            vscode.Uri.file(
                path.join(this._context.extensionPath, 'node_modules', '@vscode/webview-ui-toolkit', 'dist', 'toolkit.js')
            )
        );
    }

    replaceTemplatePlaceholders(html, replacements) {
        let result = html;
        for (const [placeholder, value] of Object.entries(replacements)) {
            result = result.replace(new RegExp(`{{${placeholder}}}`, 'g'), value);
        }
        return result;
    }
}

module.exports = BaseWebviewProvider;