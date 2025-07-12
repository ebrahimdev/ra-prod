import * as vscode from 'vscode';
import { CommandManager } from './commands/commandManager';

export function activate(context: vscode.ExtensionContext) {
    const commandManager = new CommandManager(context);
    commandManager.registerCommands(context);
}

export function deactivate() {}