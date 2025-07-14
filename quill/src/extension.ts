import * as vscode from 'vscode';
import { CommandManager } from './commands/commandManager';
import { DashboardProvider } from './providers/dashboardProvider';
import { StatusBarProvider } from './providers/statusBarProvider';

export function activate(context: vscode.ExtensionContext) {
    const commandManager = new CommandManager(context);
    commandManager.registerCommands(context);

    // Register the dashboard webview provider
    const dashboardProvider = new DashboardProvider(context.extensionUri, context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(DashboardProvider.viewType, dashboardProvider)
    );

    // Register the status bar provider
    const statusBarProvider = new StatusBarProvider(context);
    context.subscriptions.push({
        dispose: () => statusBarProvider.dispose()
    });
}

export function deactivate() {}