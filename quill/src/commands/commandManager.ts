import * as vscode from 'vscode';
import { QueryCommand } from './queryCommand';
import { AuthCommand } from './authCommand';
import { UploadCommand } from './uploadCommand';
import { ClearLibraryCommand } from './clearLibraryCommand';
import { DashboardCommand } from './dashboardCommand';
import { SearchResultsCommand } from './searchResultsCommand';

export class CommandManager {
    private queryCommand: QueryCommand;
    private authCommand: AuthCommand;
    private uploadCommand: UploadCommand;
    private clearLibraryCommand: ClearLibraryCommand;
    private dashboardCommand: DashboardCommand;
    private searchResultsCommand: SearchResultsCommand;

    constructor(context: vscode.ExtensionContext) {
        this.queryCommand = new QueryCommand(context);
        this.authCommand = new AuthCommand(context);
        this.uploadCommand = new UploadCommand(context);
        this.clearLibraryCommand = new ClearLibraryCommand(context);
        this.dashboardCommand = new DashboardCommand(context);
        this.searchResultsCommand = new SearchResultsCommand(context);
    }

    registerCommands(context: vscode.ExtensionContext) {
        const queryDisposable = vscode.commands.registerCommand(
            'quill.query', 
            () => this.queryCommand.execute()
        );

        const loginDisposable = vscode.commands.registerCommand(
            'quill.login',
            () => this.authCommand.login()
        );

        const registerDisposable = vscode.commands.registerCommand(
            'quill.register',
            () => this.authCommand.register()
        );

        const logoutDisposable = vscode.commands.registerCommand(
            'quill.logout',
            () => this.authCommand.logout()
        );

        const statusDisposable = vscode.commands.registerCommand(
            'quill.status',
            () => this.authCommand.checkAuthStatus()
        );

        const uploadDisposable = vscode.commands.registerCommand(
            'quill.uploadPdf',
            (uri: vscode.Uri) => this.uploadCommand.execute(uri)
        );

        const clearLibraryDisposable = vscode.commands.registerCommand(
            'quill.clearLibrary',
            () => this.clearLibraryCommand.execute()
        );

        const dashboardDisposable = vscode.commands.registerCommand(
            'quill.dashboard',
            () => this.dashboardCommand.execute()
        );

        const searchResultsDisposable = vscode.commands.registerCommand(
            'quill.searchResults',
            () => this.searchResultsCommand.execute()
        );

        context.subscriptions.push(
            queryDisposable,
            loginDisposable,
            registerDisposable,
            logoutDisposable,
            statusDisposable,
            uploadDisposable,
            clearLibraryDisposable,
            dashboardDisposable,
            searchResultsDisposable
        );
    }
}