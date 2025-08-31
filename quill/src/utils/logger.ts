import * as vscode from 'vscode';

export class Logger {
    private static outputChannel: vscode.OutputChannel;

    static initialize(extensionName: string) {
        this.outputChannel = vscode.window.createOutputChannel(extensionName);
    }

    static info(message: string) {
        const timestamp = new Date().toLocaleTimeString();
        this.outputChannel.appendLine(`[${timestamp}] INFO: ${message}`);
    }

    static error(message: string, error?: any) {
        const timestamp = new Date().toLocaleTimeString();
        this.outputChannel.appendLine(`[${timestamp}] ERROR: ${message}`);
        if (error) {
            this.outputChannel.appendLine(`[${timestamp}] ERROR Details: ${error.toString()}`);
        }
    }

    static warn(message: string) {
        const timestamp = new Date().toLocaleTimeString();
        this.outputChannel.appendLine(`[${timestamp}] WARN: ${message}`);
    }

    static debug(message: string) {
        const timestamp = new Date().toLocaleTimeString();
        this.outputChannel.appendLine(`[${timestamp}] DEBUG: ${message}`);
    }

    static show() {
        this.outputChannel.show();
    }

    static dispose() {
        this.outputChannel.dispose();
    }
}