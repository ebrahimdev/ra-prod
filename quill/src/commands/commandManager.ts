import * as vscode from 'vscode';
import { QueryCommand } from './queryCommand';

export class CommandManager {
    private queryCommand: QueryCommand;

    constructor() {
        this.queryCommand = new QueryCommand();
    }

    registerCommands(context: vscode.ExtensionContext) {
        const queryDisposable = vscode.commands.registerCommand(
            'quill.query', 
            () => this.queryCommand.execute()
        );

        context.subscriptions.push(queryDisposable);
    }
}