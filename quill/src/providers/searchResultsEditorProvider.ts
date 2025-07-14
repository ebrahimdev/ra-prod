import * as vscode from 'vscode';
import { SearchResult } from '../services/documentService';

export class SearchResultsEditorProvider implements vscode.CustomTextEditorProvider {
    public static readonly viewType = 'quill.searchResultsEditor';

    private static currentSearchResults: SearchResult[] = [];
    private static currentQuery: string = '';
    private static searchTimestamp: Date = new Date();

    constructor(private readonly context: vscode.ExtensionContext) {}

    public static updateSearchResults(query: string, results: SearchResult[]) {
        SearchResultsEditorProvider.currentQuery = query;
        SearchResultsEditorProvider.currentSearchResults = results;
        SearchResultsEditorProvider.searchTimestamp = new Date();
    }

    public static async openSearchResults(query: string, results: SearchResult[]) {
        // Update the static data
        this.updateSearchResults(query, results);
        
        // Create a new untitled document with search results content
        const content = this.generateSearchResultsContent(query, results);
        
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

    private static generateSearchResultsContent(query: string, results: SearchResult[]): string {
        const timestamp = this.searchTimestamp.toLocaleString();
        const totalResults = results.length;
        
        let content = `# Search Results Report\n\n`;
        content += `**Query:** "${query}"\n`;
        content += `**Timestamp:** ${timestamp}\n`;
        content += `**Total Results:** ${totalResults}\n\n`;
        content += `---\n\n`;

        if (totalResults === 0) {
            content += `## No Results Found\n\n`;
            content += `No results found for your query.\n\n`;
            content += `### Suggestions:\n`;
            content += `- Try different keywords\n`;
            content += `- Check for typos\n`;
            content += `- Use broader search terms\n`;
            return content;
        }

        // Group results by document
        const resultsByDocument = new Map<number, SearchResult[]>();
        results.forEach(result => {
            if (!resultsByDocument.has(result.document_id)) {
                resultsByDocument.set(result.document_id, []);
            }
            resultsByDocument.get(result.document_id)!.push(result);
        });

        content += `## Results Summary\n\n`;
        content += `Found **${totalResults}** relevant chunks across **${resultsByDocument.size}** document(s).\n\n`;

        // Top similarity scores
        const topResults = results.slice(0, 5);
        if (topResults.length > 0) {
            content += `### 🏆 Top Matches\n\n`;
            topResults.forEach((result, index) => {
                const similarity = (result.similarity * 100).toFixed(1);
                content += `${index + 1}. **${result.document_title}** (${similarity}% similarity)\n`;
                content += `   - ${result.section_title || 'Section'} - Page ${result.page_number || 'Unknown'}\n`;
                const preview = result.content.substring(0, 100).replace(/\n/g, ' ');
                content += `   - *${preview}...*\n\n`;
            });
        }

        content += `---\n\n`;
        content += `## 📖 Detailed Results\n\n`;

        // Results by document
        let globalIndex = 1;
        resultsByDocument.forEach((docResults, documentId) => {
            const firstResult = docResults[0];
            content += `### 📄 ${firstResult.document_title}\n\n`;
            content += `**Document ID:** ${documentId} | **Matches:** ${docResults.length}\n\n`;

            docResults.forEach((result) => {
                const similarity = (result.similarity * 100).toFixed(1);
                content += `#### ${globalIndex}. Match (${similarity}% similarity)\n\n`;
                
                content += `**Metadata:**\n`;
                content += `- **Type:** ${result.chunk_type}\n`;
                if (result.section_title) {
                    content += `- **Section:** ${result.section_title}\n`;
                }
                if (result.page_number) {
                    content += `- **Page:** ${result.page_number}\n`;
                }
                content += `- **Similarity Score:** ${similarity}%\n\n`;
                
                content += `**Content:**\n\n`;
                content += `> ${result.content.replace(/\n/g, '\n> ')}\n\n`;
                content += `---\n\n`;
                globalIndex++;
            });
        });

        // Add analytics section
        content += `## 📊 Search Analytics\n\n`;
        
        // Document distribution
        content += `### Document Distribution\n\n`;
        const sortedDocs = Array.from(resultsByDocument.entries())
            .sort((a, b) => b[1].length - a[1].length);
        
        sortedDocs.forEach(([docId, docResults]) => {
            const docTitle = docResults[0].document_title;
            const percentage = ((docResults.length / totalResults) * 100).toFixed(1);
            content += `- **${docTitle}**: ${docResults.length} matches (${percentage}%)\n`;
        });

        // Similarity score distribution
        content += `\n### Similarity Score Distribution\n\n`;
        const highSim = results.filter(r => r.similarity >= 0.8).length;
        const medSim = results.filter(r => r.similarity >= 0.6 && r.similarity < 0.8).length;
        const lowSim = results.filter(r => r.similarity < 0.6).length;
        
        content += `- **High similarity (≥80%)**: ${highSim} results\n`;
        content += `- **Medium similarity (60-79%)**: ${medSim} results\n`;
        content += `- **Lower similarity (<60%)**: ${lowSim} results\n\n`;

        return content;
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