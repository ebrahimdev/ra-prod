import * as vscode from 'vscode';

export class ConfigManager {
    getRagServerUrl(): string {
        const config = vscode.workspace.getConfiguration('quill');
        return config.get('ragServerUrl', 'http://localhost:8000');
    }
}