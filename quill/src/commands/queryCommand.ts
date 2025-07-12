import * as vscode from 'vscode';
import { RagProvider } from '../providers/ragProvider';

export class QueryCommand {
    private ragProvider: RagProvider;

    constructor() {
        this.ragProvider = new RagProvider();
    }

    async execute() {
        const query = await vscode.window.showInputBox({
            prompt: 'Enter your RAG query',
            placeHolder: 'What would you like to know?'
        });

        if (!query) {
            return;
        }

        try {
            const response = await this.ragProvider.query(query);
            vscode.window.showInformationMessage(`Response: ${response}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error}`);
        }
    }
}