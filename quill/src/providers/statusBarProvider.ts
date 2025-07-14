import * as vscode from 'vscode';
import { AuthService } from '../services/authService';

export class StatusBarProvider {
    private statusBarItem: vscode.StatusBarItem;
    private authService: AuthService;
    private updateInterval: NodeJS.Timeout | undefined;

    constructor(context: vscode.ExtensionContext) {
        this.authService = new AuthService(context);
        
        // Create status bar item
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        
        // Set up the status bar item
        this.statusBarItem.command = 'quill.dashboard';
        this.statusBarItem.tooltip = 'Click to open Quill RAG Dashboard';
        
        // Show the status bar item
        this.statusBarItem.show();
        
        // Add to subscriptions for cleanup
        context.subscriptions.push(this.statusBarItem);
        
        // Update status immediately and then periodically
        this.updateStatus();
        this.startPeriodicUpdate();
    }

    private async updateStatus(): Promise<void> {
        try {
            const tokens = await this.authService.getStoredTokens();
            const isAuthenticated = !!tokens;
            
            if (isAuthenticated) {
                this.statusBarItem.text = "$(check) Quill RAG";
                this.statusBarItem.backgroundColor = undefined;
                this.statusBarItem.tooltip = "Quill RAG - Authenticated. Click to open dashboard.";
            } else {
                this.statusBarItem.text = "$(x) Quill RAG";
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
                this.statusBarItem.tooltip = "Quill RAG - Not authenticated. Click to open dashboard and login.";
            }
        } catch (error) {
            // Handle error case
            this.statusBarItem.text = "$(alert) Quill RAG";
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            this.statusBarItem.tooltip = "Quill RAG - Connection error. Click to open dashboard.";
        }
    }

    private startPeriodicUpdate(): void {
        // Update status every 30 seconds
        this.updateInterval = setInterval(() => {
            this.updateStatus();
        }, 30000);
    }

    public forceUpdate(): void {
        this.updateStatus();
    }

    public dispose(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        this.statusBarItem.dispose();
    }
}