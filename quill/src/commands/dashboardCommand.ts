import * as vscode from 'vscode';

export class DashboardCommand {
    constructor(private context: vscode.ExtensionContext) { }

    async execute(): Promise<void> {
        // Focus on the Quill dashboard view in the activity bar
        await vscode.commands.executeCommand('workbench.view.extension.quill');

        // Alternatively, show as a webview panel if preferred
        // This provides flexibility for different access patterns
    }

    async openAsPanel(): Promise<void> {
        // Create a webview panel for the dashboard
        const panel = vscode.window.createWebviewPanel(
            'quillDashboard',
            'Quill RAG Dashboard',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri)]
            }
        );

        // Import and use the same HTML from DashboardProvider
        // This ensures consistency between the activity bar view and panel view
        const { DashboardProvider } = await import('../providers/dashboardProvider');
        const provider = new DashboardProvider(this.context.extensionUri, this.context);

        // Note: We'd need to refactor DashboardProvider to support both view types
        // For now, this is a placeholder for the panel implementation
        panel.webview.html = this.getBasicHtml();

        // Handle disposal
        panel.onDidDispose(() => {
            // Cleanup if needed
        });
    }

    private getBasicHtml(): string {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Quill Dashboard</title>
        </head>
        <body>
            <h1>Quill Dashboard</h1>
            <p>Dashboard functionality coming soon...</p>
            <p>Please use the activity bar view for full functionality.</p>
        </body>
        </html>`;
    }
}