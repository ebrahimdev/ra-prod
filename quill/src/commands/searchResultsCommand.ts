import * as vscode from 'vscode';

export class SearchResultsCommand {
    constructor(private context: vscode.ExtensionContext) {}

    async execute() {
        // Focus on the search results view if it exists
        await vscode.commands.executeCommand('quill.searchResults.focus');
    }

    async openSearchResults() {
        // This will be called when we want to show the search results view
        // The view will be shown automatically when it's registered
        await vscode.commands.executeCommand('workbench.view.extension.quill-search-results');
    }
}