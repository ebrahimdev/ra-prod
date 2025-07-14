import * as vscode from 'vscode';

export class SearchResultsEditorProvider implements vscode.CustomTextEditorProvider {
    public static readonly viewType = 'quill.searchResultsEditor';

    private static currentLLMResponse: string = '';
    private static currentQuery: string = '';
    private static searchTimestamp: Date = new Date();

    constructor(private readonly context: vscode.ExtensionContext) {}

    public static updateSearchResults(query: string, llmResponse: string) {
        SearchResultsEditorProvider.currentQuery = query;
        SearchResultsEditorProvider.currentLLMResponse = llmResponse;
        SearchResultsEditorProvider.searchTimestamp = new Date();
    }

    public static async openSearchResults(query: string, llmResponse: string) {
        // Update the static data
        this.updateSearchResults(query, llmResponse);
        
        // Create a new untitled document with LLM response content
        const content = this.generateSearchResultsContent(query, llmResponse);
        
        const doc = await vscode.workspace.openTextDocument({
            content: content,
            language: 'markdown'
        });
        
        // Show the document in the editor
        const editor = await vscode.window.showTextDocument(doc, {
            preview: false,
            viewColumn: vscode.ViewColumn.Beside
        });

        return editor;
    }

    private static generateSearchResultsContent(query: string, llmResponse: string): string {
        return llmResponse;
    }

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        // This method is required by the interface but we're using a simpler approach
        // with markdown documents, so we don't need to implement complex webview logic here
        webviewPanel.dispose();
    }
}