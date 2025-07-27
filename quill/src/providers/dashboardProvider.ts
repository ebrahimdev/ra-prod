import * as vscode from 'vscode';
import * as path from 'path';
import { DocumentService, Document } from '../services/documentService';
import { AuthService } from '../services/authService';
import { RagProvider } from './ragProvider';
import { SearchResultsEditorProvider } from './searchResultsEditorProvider';
import { ChatEditorProvider } from './chatEditorProvider';
import { ChatSessionService } from '../services/chatSessionService';

export class DashboardProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'quill.dashboard';

    private _view?: vscode.WebviewView;
    private documentService: DocumentService;
    private authService: AuthService;
    private ragProvider: RagProvider;
    private chatSessionService: ChatSessionService;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly context: vscode.ExtensionContext
    ) {
        this.documentService = new DocumentService(context);
        this.authService = new AuthService(context);
        this.ragProvider = new RagProvider(context);
        this.chatSessionService = new ChatSessionService(context);
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'refresh':
                        this.refresh();
                        return;
                    case 'deleteDocument':
                        this.handleDeleteDocument(message.documentId);
                        return;
                    case 'uploadFromPath':
                        this.handleUploadFromPath(message.filePath);
                        return;
                    case 'openDocument':
                        this.handleOpenDocument(message.filePath);
                        return;
                    case 'login':
                        this.handleLogin();
                        return;
                    case 'logout':
                        this.handleLogout();
                        return;
                    case 'getAuthStatus':
                        this.getAuthStatus();
                        return;
                    case 'getDocuments':
                        this.getDocuments();
                        return;
                    case 'getWorkspacePdfs':
                        this.getWorkspacePdfs();
                        return;
                    case 'searchDocuments':
                        this.handleSearchDocuments(message.query);
                        return;
                    case 'getChatSessions':
                        this.getChatSessions();
                        return;
                    case 'openChatSession':
                        this.handleOpenChatSession(message.sessionId);
                        return;
                    case 'deleteChatSession':
                        this.handleDeleteChatSession(message.sessionId);
                        return;
                }
            },
            undefined,
            this.context.subscriptions
        );

        // Load initial data
        this.refresh();
    }

    public refresh() {
        if (this._view) {
            this.getAuthStatus();
            this.getDocuments();
            this.getWorkspacePdfs();
            this.getChatSessions();
        }
    }

    private async getAuthStatus() {
        try {
            const tokens = await this.authService.getStoredTokens();
            const isAuthenticated = !!tokens;
            
            this._view?.webview.postMessage({
                command: 'authStatus',
                isAuthenticated: isAuthenticated
            });
        } catch (error) {
            this._view?.webview.postMessage({
                command: 'authStatus',
                isAuthenticated: false
            });
        }
    }

    private async getDocuments() {
        try {
            const documents = await this.documentService.getDocuments();
            this._view?.webview.postMessage({
                command: 'documentsLoaded',
                documents: documents
            });
        } catch (error: any) {
            this._view?.webview.postMessage({
                command: 'error',
                message: error.message || 'Failed to load documents'
            });
        }
    }

    private async handleUploadPdf() {
        try {
            const fileUri = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    'PDF Files': ['pdf']
                },
                openLabel: 'Upload PDF'
            });

            if (fileUri && fileUri[0]) {
                this._view?.webview.postMessage({
                    command: 'uploadStarted'
                });

                const document = await this.documentService.uploadDocument(fileUri[0].fsPath);
                
                this._view?.webview.postMessage({
                    command: 'uploadSuccess',
                    document: document
                });

                // Refresh documents list
                this.getDocuments();
                
                vscode.window.showInformationMessage(`PDF uploaded successfully: ${document.title}`);
            }
        } catch (error: any) {
            this._view?.webview.postMessage({
                command: 'uploadError',
                message: error.message
            });
            vscode.window.showErrorMessage(`Upload failed: ${error.message}`);
        }
    }

    private async handleDeleteDocument(documentId: number) {
        try {
            const confirm = await vscode.window.showWarningMessage(
                'Are you sure you want to delete this document?',
                { modal: true },
                'Delete'
            );

            if (confirm === 'Delete') {
                await this.documentService.deleteDocument(documentId);
                this.getDocuments();
                vscode.window.showInformationMessage('Document deleted successfully');
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Delete failed: ${error.message}`);
        }
    }

    private async handleClearLibrary() {
        try {
            const confirm = await vscode.window.showWarningMessage(
                'Are you sure you want to clear the entire document library? This action cannot be undone.',
                { modal: true },
                'Clear Library'
            );

            if (confirm === 'Clear Library') {
                const result = await this.documentService.clearAllDocuments();
                this.getDocuments();
                vscode.window.showInformationMessage(
                    `Cleared ${result.deleted_count} documents from library`
                );
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Clear library failed: ${error.message}`);
        }
    }

    private async handleLogin() {
        vscode.commands.executeCommand('quill.login');
    }

    private async handleLogout() {
        vscode.commands.executeCommand('quill.logout');
    }

    private async getWorkspacePdfs() {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                this._view?.webview.postMessage({
                    command: 'workspacePdfsLoaded',
                    pdfs: []
                });
                return;
            }

            const pdfFiles = [];
            for (const folder of workspaceFolders) {
                // Scan all PDFs recursively within the workspace folder
                const pattern = new vscode.RelativePattern(folder, '**/*.pdf');
                const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**');
                
                for (const file of files) {
                    const fileName = file.fsPath.split('/').pop() || '';
                    const documentTitle = await this.extractTitleFromPdf(file.fsPath) || 
                                        fileName.replace('.pdf', '').replace(/[-_]/g, ' ');
                    
                    pdfFiles.push({
                        path: file.fsPath,
                        name: fileName,
                        title: documentTitle,
                        workspaceRelativePath: vscode.workspace.asRelativePath(file),
                        isUploaded: false // Will be updated when checking against uploaded documents
                    });
                }
            }

            this._view?.webview.postMessage({
                command: 'workspacePdfsLoaded',
                pdfs: pdfFiles
            });
        } catch (error: any) {
            this._view?.webview.postMessage({
                command: 'error',
                message: `Failed to scan workspace PDFs: ${error.message}`
            });
        }
    }

    private async extractTitleFromPdf(filePath: string): Promise<string | null> {
        try {
            // For now, return null to use filename. In future, could extract actual PDF title
            return null;
        } catch (error) {
            return null;
        }
    }

    private async handleUploadFromPath(filePath: string) {
        try {
            this._view?.webview.postMessage({
                command: 'uploadStarted',
                filePath: filePath
            });

            const document = await this.documentService.uploadDocument(filePath);
            
            this._view?.webview.postMessage({
                command: 'uploadSuccess',
                document: document,
                filePath: filePath
            });

            // Refresh documents and workspace PDFs
            this.getDocuments();
            this.getWorkspacePdfs();
            
            vscode.window.showInformationMessage(`PDF uploaded successfully: ${document.title}`);
        } catch (error: any) {
            this._view?.webview.postMessage({
                command: 'uploadError',
                message: error.message,
                filePath: filePath
            });
            vscode.window.showErrorMessage(`Upload failed: ${error.message}`);
        }
    }

    private async handleOpenDocument(filePath: string) {
        try {
            const uri = vscode.Uri.file(filePath);
            await vscode.commands.executeCommand('vscode.open', uri);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to open document: ${error.message}`);
        }
    }

    private async handleQuery(query: string) {
        try {
            this._view?.webview.postMessage({
                command: 'queryStarted'
            });

            const response = await this.ragProvider.query(query);
            
            this._view?.webview.postMessage({
                command: 'queryResults',
                response: response,
                query: query
            });
        } catch (error: any) {
            this._view?.webview.postMessage({
                command: 'queryError',
                message: error.message
            });
        }
    }

    private async handleSearchDocuments(query: string) {
        try {
            console.log(`[Dashboard] Starting search for query: "${query}"`);
            const searchResponse = await this.documentService.searchDocuments(query);
            
            console.log(`[Dashboard] Search completed. Results count: ${searchResponse.results.length}`);
            console.log(`[Dashboard] LLM response:`, searchResponse.llm_response);
            
            // Send results to dashboard (keeping backward compatibility)
            this._view?.webview.postMessage({
                command: 'searchResults',
                results: searchResponse.results,
                query: query,
                count: searchResponse.results.length
            });
            
            // Open chat session with the search query as initial message
            await ChatEditorProvider.openChatSession(this.context, query);
            
            console.log(`[Dashboard] Sent searchResults message to webview and opened LLM response editor`);
        } catch (error: any) {
            console.error(`[Dashboard] Search error:`, error);
            this._view?.webview.postMessage({
                command: 'searchError',
                message: error.message
            });
        }
    }

    private async getChatSessions() {
        try {
            const sessions = await this.chatSessionService.getRecentSessions();
            this._view?.webview.postMessage({
                command: 'chatSessionsLoaded',
                sessions: sessions
            });
        } catch (error: any) {
            this._view?.webview.postMessage({
                command: 'error',
                message: `Failed to load chat sessions: ${error.message}`
            });
        }
    }

    /**
     * Public method to refresh chat sessions (called by command)
     */
    public refreshChatSessions() {
        this.getChatSessions();
    }

    private async handleOpenChatSession(sessionId: string) {
        try {
            // Open the existing chat session
            await ChatEditorProvider.openChatSession(this.context, undefined, sessionId);
            
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to open chat session: ${error.message}`);
        }
    }

    private async handleDeleteChatSession(sessionId: string) {
        try {
            const confirm = await vscode.window.showWarningMessage(
                'Are you sure you want to delete this chat session?',
                { modal: true },
                'Delete'
            );

            if (confirm === 'Delete') {
                await this.chatSessionService.deleteSession(sessionId);
                
                // Refresh chat sessions
                this.getChatSessions();
                
                vscode.window.showInformationMessage('Chat session deleted successfully');
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to delete chat session: ${error.message}`);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Quill RAG Dashboard</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    font-weight: var(--vscode-font-weight);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    margin: 0;
                    padding: 20px;
                    padding-bottom: 60px; /* Space for sticky auth bar */
                }

                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    padding-bottom: 15px;
                }

                .logo {
                    font-size: 18px;
                    font-weight: bold;
                    color: var(--vscode-textLink-foreground);
                }

                .auth-section {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    padding: 8px 15px;
                    border-top: 1px solid var(--vscode-panel-border);
                    background-color: var(--vscode-panel-background);
                    z-index: 1000;
                    font-size: 12px;
                }

                .auth-status {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                }

                .status-indicator {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background-color: var(--vscode-testing-iconFailed);
                }

                .status-indicator.authenticated {
                    background-color: var(--vscode-testing-iconPassed);
                }

                .status-text {
                    flex: 1;
                }

                .btn {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 13px;
                    margin-right: 8px;
                    margin-bottom: 8px;
                }

                .btn.compact {
                    padding: 4px 8px;
                    font-size: 11px;
                }

                .btn:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }

                .btn.secondary {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }

                .btn.secondary:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                }

                .btn.danger {
                    background-color: var(--vscode-inputValidation-errorBackground);
                    color: var(--vscode-inputValidation-errorForeground);
                }

                .btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .section {
                    margin-bottom: 25px;
                }

                .section-title {
                    font-size: 14px;
                    font-weight: bold;
                    margin-bottom: 15px;
                    color: var(--vscode-settings-headerForeground);
                    border-bottom: 1px solid var(--vscode-panel-border);
                    padding-bottom: 5px;
                }

                .query-section {
                    margin-bottom: 20px;
                }

                .search-container {
                    position: relative;
                    margin-bottom: 20px;
                }

                .query-input {
                    width: 100%;
                    padding: 12px 44px 12px 16px;
                    border: 1px solid var(--vscode-input-border);
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border-radius: 6px;
                    font-family: inherit;
                    font-size: 14px;
                    box-sizing: border-box;
                }

                .query-input:focus {
                    outline: 1px solid var(--vscode-focusBorder);
                    border-color: var(--vscode-focusBorder);
                }

                .search-icon {
                    position: absolute;
                    right: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    cursor: pointer;
                    color: var(--vscode-descriptionForeground);
                    font-size: 16px;
                    user-select: none;
                }

                .search-icon:hover {
                    color: var(--vscode-foreground);
                }

                .search-spinner {
                    position: absolute;
                    right: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .documents-grid {
                    display: grid;
                    gap: 2px;
                }

                .document-card {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 1px 4px;
                    border-radius: 2px;
                    background-color: transparent;
                    cursor: pointer;
                    transition: background-color 0.2s;
                    min-height: 20px;
                    max-height: 22px;
                    position: relative;
                    overflow: hidden;
                }

                .document-card:hover {
                    background-color: var(--vscode-list-hoverBackground);
                }

                .document-indicator {
                    width: 4px;
                    height: 4px;
                    border-radius: 50%;
                    background-color: var(--vscode-testing-iconPassed);
                    flex-shrink: 0;
                }

                .document-indicator.processing {
                    background-color: var(--vscode-testing-iconQueued);
                }

                .document-indicator.failed {
                    background-color: var(--vscode-testing-iconFailed);
                }

                .document-indicator.not-uploaded {
                    background-color: #ffcc00;
                }

                .document-indicator.completed {
                    background-color: transparent;
                    position: relative;
                    width: 12px;
                    height: 12px;
                }

                .document-indicator.completed::after {
                    content: "✓";
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    color: var(--vscode-testing-iconPassed);
                    font-size: 10px;
                    font-weight: bold;
                }

                .document-title {
                    font-size: 11px;
                    color: var(--vscode-editor-foreground);
                    flex: 1;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    line-height: 1.1;
                    z-index: 2;
                    position: relative;
                }

                .progress-bar {
                    position: absolute;
                    top: 0;
                    left: 0;
                    height: 100%;
                    background-color: var(--vscode-progressBar-background);
                    opacity: 0.3;
                    width: 0%;
                    transition: width 0.3s ease;
                    z-index: 1;
                }

                .document-actions {
                    opacity: 0;
                    transition: opacity 0.2s;
                }

                .document-card:hover .document-actions {
                    opacity: 1;
                }

                .document-actions .btn {
                    padding: 1px 4px;
                    font-size: 9px;
                    margin: 0;
                }

                .sync-icon {
                    opacity: 0;
                    transition: opacity 0.2s;
                    cursor: pointer;
                    font-size: 10px;
                    color: var(--vscode-descriptionForeground);
                    padding: 1px;
                    border-radius: 1px;
                }

                .sync-icon:hover {
                    background-color: var(--vscode-toolbar-hoverBackground);
                    color: var(--vscode-foreground);
                }

                .document-card:hover .sync-icon {
                    opacity: 1;
                }

                .chat-history-section {
                    margin-bottom: 30px;
                }

                .chat-history-container {
                    display: grid;
                    gap: 2px;
                    max-height: 148px; /* 5 items × 28px height + 4 gaps × 2px = 148px */
                    overflow-y: auto;
                    overflow-x: hidden;
                    position: relative;
                }

                .chat-history-container::-webkit-scrollbar {
                    width: 0;
                    background: transparent;
                }

                .chat-session-card.fade-bottom {
                    position: relative;
                }

                .chat-session-card.fade-bottom::after {
                    content: '';
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: 100%;
                    background: linear-gradient(transparent 60%, var(--vscode-editor-background));
                    pointer-events: none;
                    z-index: 1;
                }

                .chat-session-card {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 3px 4px;
                    border-radius: 2px;
                    background-color: transparent;
                    cursor: pointer;
                    transition: background-color 0.2s;
                    border: 1px solid transparent;
                    position: relative;
                    min-height: 28px;
                }

                .chat-session-card:hover {
                    background-color: var(--vscode-list-hoverBackground);
                    border-color: var(--vscode-panel-border);
                }

                .chat-session-icon {
                    width: 12px;
                    height: 12px;
                    flex-shrink: 0;
                    font-size: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--vscode-textLink-foreground);
                }

                .chat-session-content {
                    flex: 1;
                    min-width: 0;
                }

                .chat-session-title {
                    font-size: 11px;
                    color: var(--vscode-editor-foreground);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    line-height: 1.1;
                    z-index: 2;
                    position: relative;
                }

                .chat-session-time {
                    font-size: 10px;
                    color: var(--vscode-descriptionForeground);
                    opacity: 0.8;
                }

                .chat-session-actions {
                    opacity: 0;
                    transition: opacity 0.2s;
                    display: flex;
                    gap: 4px;
                }

                .chat-session-card:hover .chat-session-actions {
                    opacity: 1;
                }

                .chat-delete-btn {
                    background: none;
                    border: none;
                    color: var(--vscode-descriptionForeground);
                    cursor: pointer;
                    padding: 1px 2px;
                    border-radius: 2px;
                    font-size: 10px;
                    flex-shrink: 0;
                    margin-left: -6px;
                }

                .chat-delete-btn:hover {
                    background-color: var(--vscode-inputValidation-errorBackground);
                    color: var(--vscode-inputValidation-errorForeground);
                }

                .library-section {
                    margin-bottom: 30px;
                }

                .library-title {
                    font-size: 12px;
                    font-weight: normal;
                    margin-bottom: 10px;
                    color: var(--vscode-descriptionForeground);
                    opacity: 0.7;
                }

                .document-card.lowlight {
                    opacity: 0.5;
                    background-color: transparent;
                }

                .document-card.lowlight:hover {
                    opacity: 0.8;
                    background-color: var(--vscode-list-hoverBackground);
                }

                .document-card.lowlight .document-title {
                    color: var(--vscode-descriptionForeground);
                }

                .document-card.highlight {
                    background-color: var(--vscode-list-activeSelectionBackground);
                    border-left: 3px solid var(--vscode-textLink-foreground);
                    padding-left: 9px;
                }

                .empty-state {
                    text-align: center;
                    padding: 40px 20px;
                    color: var(--vscode-descriptionForeground);
                }

                .loading {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: var(--vscode-descriptionForeground);
                    font-style: italic;
                }

                .spinner {
                    width: 12px;
                    height: 12px;
                    border: 2px solid var(--vscode-panel-border);
                    border-top: 2px solid var(--vscode-progressBar-background);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                .error {
                    color: var(--vscode-inputValidation-errorForeground);
                    background-color: var(--vscode-inputValidation-errorBackground);
                    padding: 8px;
                    border-radius: 4px;
                    margin-bottom: 10px;
                    font-size: 12px;
                }

                .refresh-btn {
                    background: none;
                    border: none;
                    color: var(--vscode-textLink-foreground);
                    cursor: pointer;
                    font-size: 13px;
                    padding: 4px;
                    border-radius: 3px;
                }

                .refresh-btn:hover {
                    background-color: var(--vscode-toolbar-hoverBackground);
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="logo">🪶 Quill RAG Dashboard</div>
                <button class="refresh-btn" id="refreshBtn">↻</button>
            </div>

            <div class="section" id="mainSection" style="display: none;">
                <div class="search-container">
                    <input type="text" class="query-input" id="queryInput" placeholder="Search your research papers...">
                    <span class="search-icon" id="searchIcon">🔍</span>
                    <div class="search-spinner" id="searchSpinner" style="display: none;">
                        <div class="spinner"></div>
                    </div>
                </div>

                <div class="chat-history-section" id="chatHistorySection">
                    <div class="section-title">💬 Chat History</div>
                    <div id="chatHistoryContainer">
                        <div class="loading">
                            <div class="spinner"></div>
                            Loading chat history...
                        </div>
                    </div>
                </div>

                <div class="library-section" id="librarySection">
                    <div class="library-title">Library</div>
                    <div id="documentsContainer">
                        <div class="loading">
                            <div class="spinner"></div>
                            Loading documents...
                        </div>
                    </div>
                </div>
            </div>

            <div class="auth-section" id="authSection">
                <div class="auth-status">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <div class="status-indicator" id="authIndicator"></div>
                        <span class="status-text" id="authStatus">Checking...</span>
                    </div>
                    <div id="authButtons">
                        <button class="btn compact" id="loginBtn">Login</button>
                    </div>
                </div>
            </div>

            <script nonce="${nonce}">
                const vscode = acquireVsCodeApi();
                
                // State management with persistence
                let state = vscode.getState() || {
                    isAuthenticated: false,
                    documents: [],
                    workspacePdfs: [],
                    allPapers: [],
                    uploadingFiles: [] // Stored as array of [key, value] pairs
                };
                
                let isAuthenticated = state.isAuthenticated;
                let documents = state.documents;
                let workspacePdfs = state.workspacePdfs;
                let allPapers = state.allPapers;
                let uploadingFiles = new Map(state.uploadingFiles || []); // Convert back to Map
                let chatSessions = [];
                
                
                // Save state function
                function saveState() {
                    state = {
                        isAuthenticated,
                        documents,
                        workspacePdfs,
                        allPapers,
                        uploadingFiles: Array.from(uploadingFiles.entries()) // Convert Map to Array for storage
                    };
                    vscode.setState(state);
                }

                // Message handling
                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    switch (message.command) {
                        case 'authStatus':
                            updateAuthStatus(message.isAuthenticated);
                            break;
                        case 'documentsLoaded':
                            updateDocuments(message.documents);
                            break;
                        case 'workspacePdfsLoaded':
                            updateWorkspacePdfs(message.pdfs);
                            break;
                        case 'uploadStarted':
                            showUploadProgress(message.filePath);
                            break;
                        case 'uploadSuccess':
                            hideUploadProgress(message.filePath);
                            if (message.document) {
                                completeUpload(message.document.id, message.document.title);
                            }
                            if (message.filePath) {
                                markAsUploaded(message.filePath);
                            }
                            break;
                        case 'uploadError':
                            hideUploadProgress(message.filePath);
                            showError('Upload failed: ' + message.message);
                            // Clean up any stale state
                            if (message.filePath) {
                                markAsUploaded(message.filePath);
                            }
                            break;
                        case 'queryStarted':
                            showQueryProgress();
                            break;
                        case 'queryResults':
                            showQueryResults(message.response, message.query);
                            break;
                        case 'queryError':
                            hideQueryProgress();
                            showError('Query failed: ' + message.message);
                            break;
                        case 'searchResults':
                            console.log('[Webview] Received searchResults message:', message);
                            // Hide the search spinner since search is complete
                            hideSearchLoading();
                            break;
                        case 'searchError':
                            console.log('[Webview] Received searchError message:', message);
                            handleSearchError(message.message);
                            break;
                        case 'chatSessionsLoaded':
                            updateChatSessions(message.sessions);
                            break;
                        case 'error':
                            showError(message.message);
                            break;
                    }
                });

                function updateAuthStatus(authenticated) {
                    isAuthenticated = authenticated;
                    saveState();
                    
                    const indicator = document.getElementById('authIndicator');
                    const status = document.getElementById('authStatus');
                    const buttons = document.getElementById('authButtons');
                    const mainSection = document.getElementById('mainSection');

                    if (authenticated) {
                        indicator.classList.add('authenticated');
                        status.textContent = 'Authenticated';
                        buttons.innerHTML = '<button class="btn compact secondary" id="logoutBtn">Logout</button>';
                        mainSection.style.display = 'block';
                        
                        // Re-attach event listener for logout button
                        setTimeout(() => {
                            const logoutBtn = document.getElementById('logoutBtn');
                            if (logoutBtn) {
                                logoutBtn.addEventListener('click', logout);
                            }
                        }, 0);
                    } else {
                        indicator.classList.remove('authenticated');
                        status.textContent = 'Not authenticated';
                        buttons.innerHTML = '<button class="btn compact" id="loginBtn">Login</button>';
                        mainSection.style.display = 'none';
                        
                        // Re-attach event listener for login button
                        setTimeout(() => {
                            const loginBtn = document.getElementById('loginBtn');
                            if (loginBtn) {
                                loginBtn.addEventListener('click', login);
                            }
                        }, 0);
                    }
                }

                function updateDocuments(docs) {
                    documents = docs;
                    saveState();
                    updateAllPapers();
                }

                function updateWorkspacePdfs(pdfs) {
                    workspacePdfs = pdfs;
                    saveState();
                    updateAllPapers();
                }

                function updateChatSessions(sessions) {
                    chatSessions = sessions;
                    renderChatSessions();
                }

                function updateFadeEffect() {
                    const container = document.getElementById('chatHistoryContainer');
                    if (!container) return;
                    
                    const chatContainer = container.querySelector('.chat-history-container');
                    const sessionCards = container.querySelectorAll('.chat-session-card');
                    
                    if (!chatContainer || sessionCards.length === 0) return;
                    
                    // Remove fade from all cards
                    sessionCards.forEach(card => card.classList.remove('fade-bottom'));
                    
                    // Get container dimensions
                    const containerRect = chatContainer.getBoundingClientRect();
                    const containerBottom = containerRect.bottom;
                    
                    // Find the last visible card
                    let lastVisibleCard = null;
                    for (let i = sessionCards.length - 1; i >= 0; i--) {
                        const cardRect = sessionCards[i].getBoundingClientRect();
                        const cardBottom = cardRect.bottom;
                        
                        // Check if card is visible and within container bounds
                        if (cardRect.top < containerBottom && cardBottom > containerRect.top) {
                            // This is a visible card, check if it's at the bottom edge
                            if (cardBottom > containerBottom - 5) { // 5px tolerance
                                lastVisibleCard = sessionCards[i];
                                break;
                            }
                        }
                    }
                    
                    // Apply fade to the last visible card if there are more items below
                    if (lastVisibleCard && chatContainer.scrollTop + chatContainer.clientHeight < chatContainer.scrollHeight - 5) {
                        lastVisibleCard.classList.add('fade-bottom');
                    }
                }

                function renderChatSessions() {
                    const container = document.getElementById('chatHistoryContainer');
                    
                    if (!container) {
                        console.error('[Webview] chatHistoryContainer not found');
                        return;
                    }
                    
                    if (chatSessions.length === 0) {
                        container.innerHTML = '<div class="empty-state">No chat history yet.<br>Start a conversation by searching!</div>';
                        return;
                    }

                    const sessionsHtml = chatSessions.map(session => {
                        const timeAgo = getTimeAgo(session.lastActivity);
                        
                        return \`
                            <div class="chat-session-card" data-session-id="\${session.id}">
                                <div class="chat-session-icon">💬</div>
                                <div class="chat-session-content">
                                    <div class="chat-session-title">\${session.title}</div>
                                    <div class="chat-session-time">\${timeAgo}</div>
                                </div>
                                <div class="chat-session-actions">
                                    <button class="chat-delete-btn" data-session-id="\${session.id}" title="Delete chat">×</button>
                                </div>
                            </div>
                        \`;
                    }).join('');
                    
                    container.innerHTML = '<div class="chat-history-container">' + sessionsHtml + '</div>';
                    
                    // Apply fade effect to bottom visible item if there are more than 5 sessions
                    if (chatSessions.length > 5) {
                        updateFadeEffect();
                        
                        // Add scroll listener to update fade effect
                        const chatContainer = container.querySelector('.chat-history-container');
                        if (chatContainer) {
                            chatContainer.addEventListener('scroll', updateFadeEffect);
                        }
                    }
                    
                    // Attach event listeners
                    const sessionCards = container.querySelectorAll('.chat-session-card');
                    sessionCards.forEach(card => {
                        card.addEventListener('click', (e) => {
                            // Don't trigger if clicking on delete button
                            if (e.target.closest('.chat-delete-btn')) {
                                return;
                            }
                            const sessionId = card.getAttribute('data-session-id');
                            openChatSession(sessionId);
                        });
                    });
                    
                    const deleteButtons = container.querySelectorAll('.chat-delete-btn');
                    deleteButtons.forEach(button => {
                        button.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const sessionId = button.getAttribute('data-session-id');
                            deleteChatSession(sessionId);
                        });
                    });
                }

                function getTimeAgo(date) {
                    const now = new Date();
                    const inputDate = new Date(date);
                    
                    // Debug logging
                    console.log('[Dashboard] getTimeAgo - now:', now.toISOString(), 'inputDate:', inputDate.toISOString());
                    
                    const diffMs = now.getTime() - inputDate.getTime();
                    const diffMins = Math.floor(diffMs / (1000 * 60));
                    const diffHours = Math.floor(diffMins / 60);
                    const diffDays = Math.floor(diffHours / 24);
                    
                    console.log('[Dashboard] getTimeAgo - diffMs:', diffMs, 'diffMins:', diffMins);
                    
                    if (diffMins < 1) return 'Just now';
                    if (diffMins === 1) return '1 minute ago';
                    if (diffMins < 60) return \`\${diffMins} minutes ago\`;
                    if (diffHours === 1) return '1 hour ago';
                    if (diffHours < 24) return \`\${diffHours} hours ago\`;
                    if (diffDays === 1) return 'Yesterday';
                    if (diffDays < 7) return \`\${diffDays} days ago\`;
                    return inputDate.toLocaleDateString();
                }

                function openChatSession(sessionId) {
                    vscode.postMessage({ command: 'openChatSession', sessionId: sessionId });
                }

                function deleteChatSession(sessionId) {
                    vscode.postMessage({ command: 'deleteChatSession', sessionId: sessionId });
                }

                function updateAllPapers() {
                    // Combine uploaded documents and workspace PDFs
                    const newAllPapers = [];
                    
                    // Add uploaded documents (but skip processing ones if we have active uploads)
                    documents.forEach(doc => {
                        // If this document is in processing status, check if we have an active upload for it
                        if (doc.status === 'processing') {
                            // Check if any of our uploading files could be this document
                            const hasActiveUpload = Array.from(uploadingFiles.keys()).some(filePath => {
                                const fileName = filePath.split('/').pop() || '';
                                const baseFileName = fileName.replace('.pdf', '').replace(/[-_]/g, ' ');
                                return doc.filename === fileName || 
                                       doc.title.toLowerCase().includes(baseFileName.toLowerCase()) ||
                                       baseFileName.toLowerCase().includes(doc.title.toLowerCase());
                            });
                            
                            // Skip this document if we have an active upload for it
                            if (hasActiveUpload) {
                                return;
                            }
                        }
                        
                        newAllPapers.push({
                            id: doc.id,
                            title: getShortTitle(doc.title),
                            type: 'uploaded',
                            status: doc.status,
                            filePath: null,
                            document: doc
                        });
                    });
                    
                    // Add workspace PDFs (check if already uploaded or currently uploading)
                    workspacePdfs.forEach(pdf => {
                        // Check if this PDF is already uploaded by comparing file paths and titles
                        const isUploaded = documents.some(doc => {
                            const docFilename = doc.filename || '';
                            const pdfFilename = pdf.name || '';
                            // Compare by filename or if titles are similar
                            return docFilename === pdfFilename || 
                                   doc.title.toLowerCase().includes(pdf.title.toLowerCase()) ||
                                   pdf.title.toLowerCase().includes(doc.title.toLowerCase());
                        });
                        
                        // Check if this PDF is currently being uploaded
                        const isUploading = uploadingFiles.has(pdf.path);
                        
                        
                        // Only add if not uploaded and not currently uploading
                        if (!isUploaded && !isUploading) {
                            newAllPapers.push({
                                id: pdf.path,
                                title: getShortTitle(pdf.title),
                                type: 'workspace',
                                status: 'not-uploaded',
                                filePath: pdf.path,
                                document: null
                            });
                        }
                    });
                    
                    // Add uploading documents from uploadingFiles Map
                    uploadingFiles.forEach((uploadInfo, filePath) => {
                        const fileName = filePath.split('/').pop() || '';
                        newAllPapers.unshift({
                            id: uploadInfo.id,
                            title: fileName.replace('.pdf', '').replace(/[-_]/g, ' '),
                            type: 'uploading',
                            status: 'processing',
                            filePath: filePath,
                            uploadProgress: uploadInfo.progress
                        });
                    });
                    
                    allPapers = newAllPapers;
                    saveState();
                    renderDocuments(allPapers, 'library');
                }

                function markAsUploaded(filePath) {
                    // Remove from uploading files if it was being tracked
                    if (uploadingFiles.has(filePath)) {
                        uploadingFiles.delete(filePath);
                    }
                    
                    // Filter out workspace PDFs and uploading documents for this file
                    allPapers = allPapers.filter(paper => 
                        paper.filePath !== filePath || 
                        (paper.type !== 'workspace' && paper.type !== 'uploading')
                    );
                    
                    saveState();
                    renderDocuments(allPapers, 'library');
                }

                function renderDocuments(docs, section = 'library', highlightedIds = []) {
                    const containerId = section === 'library' ? 'documentsContainer' : 'resultsContainer';
                    const container = document.getElementById(containerId);
                    
                    console.log('[Webview] renderDocuments: section=' + section + ', containerId=' + containerId + ', container=', container);
                    
                    if (!container) {
                        console.error('[Webview] renderDocuments: Container element ' + containerId + ' not found');
                        return;
                    }
                    
                    if (docs.length === 0) {
                        if (section === 'library') {
                            container.innerHTML = '<div class="empty-state">No documents in library.<br>Upload PDFs using the context menu.</div>';
                        } else {
                            container.innerHTML = '<div class="empty-state">No relevant documents found.</div>';
                        }
                        return;
                    }

                    const grid = docs.map(doc => {
                        const indicatorClass = doc.status === 'completed' ? 'completed' : doc.status;
                        const shortTitle = getShortTitle(doc.title);
                        const isHighlighted = highlightedIds.includes(doc.id);
                        const cardClass = section === 'library' ? 'lowlight' : 'highlight';
                        
                        // Determine if this is a workspace PDF
                        const isWorkspacePdf = doc.type === 'workspace';
                        const isUploading = doc.type === 'uploading';
                        const hasFilePath = doc.filePath;
                        
                        let actions = '';
                        if (isWorkspacePdf) {
                            // Show sync icon for workspace PDFs
                            actions = \`<div class="sync-icon" data-file-path="\${doc.filePath}" title="Upload to library">⇧</div>\`;
                        } else if (!isUploading) {
                            // Show delete button for uploaded documents (not for uploading ones)
                            actions = \`<button class="btn danger" data-doc-id="\${doc.id}">×</button>\`;
                        }
                        
                        const progressWidth = doc.uploadProgress || 0;
                        const progressBar = (doc.status === 'processing' || isUploading) ? \`<div class="progress-bar" style="width: \${progressWidth}%"></div>\` : '';
                        
                        return \`
                            <div class="document-card \${section === 'library' && !isHighlighted ? cardClass : ''}" \${
                                hasFilePath ? \`data-file-path="\${doc.filePath}"\` : ''
                            } data-doc-id="\${doc.id}">
                                \${progressBar}
                                <div class="document-indicator \${indicatorClass}"></div>
                                <div class="document-title">\${shortTitle}</div>
                                <div class="document-actions">
                                    \${actions}
                                </div>
                            </div>
                        \`;
                    }).join('');
                    
                    container.innerHTML = '<div class="documents-grid">' + grid + '</div>';
                    
                    // Attach event listeners to delete buttons
                    const deleteButtons = container.querySelectorAll('.btn.danger');
                    deleteButtons.forEach(button => {
                        button.addEventListener('click', (e) => {
                            const docId = parseInt(e.target.getAttribute('data-doc-id'));
                            deleteDocument(docId);
                        });
                    });
                    
                    // Attach event listeners to sync icons
                    const syncIcons = container.querySelectorAll('.sync-icon');
                    syncIcons.forEach(icon => {
                        icon.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const filePath = e.target.getAttribute('data-file-path');
                            uploadFromPath(filePath);
                        });
                    });
                    
                    // Attach event listeners to document cards for opening files
                    const documentCards = container.querySelectorAll('.document-card[data-file-path]');
                    documentCards.forEach(card => {
                        card.addEventListener('click', (e) => {
                            // Don't trigger if clicking on actions
                            if (e.target.closest('.document-actions')) {
                                return;
                            }
                            const filePath = card.getAttribute('data-file-path');
                            if (filePath) {
                                openDocument(filePath);
                            }
                        });
                    });
                }

                function getShortTitle(title) {
                    // VSCode-style truncation: show ~45 chars then ellipsis
                    if (title.length > 45) {
                        return title.substring(0, 42) + '...';
                    }
                    return title;
                }

                function formatFileSize(bytes) {
                    if (bytes === 0) return '0 Bytes';
                    const k = 1024;
                    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                }

                function showUploadProgress(filePath) {
                    const uploadId = 'upload-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                    
                    // Track this upload in the uploadingFiles Map
                    uploadingFiles.set(filePath, {
                        id: uploadId,
                        progress: 0,
                        startTime: Date.now()
                    });
                    
                    saveState();
                    updateAllPapers(); // This will render the uploading document
                    
                    // Start progress animation
                    simulateUploadProgress(filePath);
                }

                function hideUploadProgress(filePath) {
                    // Remove this upload from tracking
                    if (filePath && uploadingFiles.has(filePath)) {
                        uploadingFiles.delete(filePath);
                        saveState();
                        updateAllPapers(); // Re-render without the uploading document
                    }
                }

                function simulateUploadProgress(filePath) {
                    let progress = 0;
                    const targetTime = 60000; // 60 seconds to reach 95%
                    const updateInterval = 500; // Update every 500ms
                    const totalUpdates = targetTime / updateInterval; // 120 updates
                    const progressPerUpdate = 95 / totalUpdates; // ~0.79% per update
                    
                    const interval = setInterval(() => {
                        // Add some randomness while maintaining consistent timing
                        const randomVariance = (Math.random() - 0.5) * 0.3; // ±0.15%
                        progress += progressPerUpdate + randomVariance;
                        
                        // Ensure we don't exceed 95% or go backwards
                        progress = Math.min(Math.max(progress, 0), 95);
                        
                        updateProgressBar(filePath, progress);
                        
                        if (progress >= 95) {
                            clearInterval(interval);
                        }
                    }, updateInterval);
                }

                function updateProgressBar(filePath, progress) {
                    // Update progress in uploadingFiles Map
                    if (uploadingFiles.has(filePath)) {
                        const uploadInfo = uploadingFiles.get(filePath);
                        uploadInfo.progress = progress;
                        uploadingFiles.set(filePath, uploadInfo);
                        saveState();
                    }
                    
                    // Update the progress bar in the DOM
                    const card = document.querySelector(\`[data-file-path="\${filePath}"] .progress-bar\`);
                    if (card) {
                        card.style.width = progress + '%';
                    }
                }

                function completeUpload(documentId, newTitle) {
                    // The document should appear in the next refresh with proper data
                    // Instead of trying to update the temp card, just refresh the data
                    
                    // Force refresh of documents to get the latest data
                    setTimeout(() => {
                        vscode.postMessage({ command: 'getDocuments' });
                        vscode.postMessage({ command: 'getWorkspacePdfs' });
                    }, 500);
                }

                function showQueryProgress() {
                    const results = document.getElementById('queryResults');
                    results.style.display = 'block';
                    results.innerHTML = '<div class="loading"><div class="spinner"></div>Searching...</div>';
                }

                function showSearchLoading() {
                    const searchSpinner = document.getElementById('searchSpinner');
                    const searchIcon = document.getElementById('searchIcon');
                    
                    if (searchSpinner && searchIcon) {
                        searchIcon.style.display = 'none';
                        searchSpinner.style.display = 'flex';
                    }
                }

                function hideSearchLoading() {
                    const searchSpinner = document.getElementById('searchSpinner');
                    const searchIcon = document.getElementById('searchIcon');
                    
                    if (searchSpinner && searchIcon) {
                        searchSpinner.style.display = 'none';
                        searchIcon.style.display = 'block';
                    }
                }


                function showError(message) {
                    // Find a good place to show the error, or create a toast
                }

                // UI Actions
                function refresh() {
                    vscode.postMessage({ command: 'getAuthStatus' });
                    if (isAuthenticated) {
                        vscode.postMessage({ command: 'getDocuments' });
                        vscode.postMessage({ command: 'getWorkspacePdfs' });
                        vscode.postMessage({ command: 'getChatSessions' });
                    }
                    // Note: updateAllPapers() will be called when the data comes back
                    // through updateDocuments() and updateWorkspacePdfs() which will
                    // properly handle the uploadingFiles filtering
                }

                function login() {
                    vscode.postMessage({ command: 'login' });
                }

                function logout() {
                    vscode.postMessage({ command: 'logout' });
                }

                function deleteDocument(documentId) {
                    vscode.postMessage({ command: 'deleteDocument', documentId: documentId });
                }
                
                function uploadFromPath(filePath) {
                    vscode.postMessage({ command: 'uploadFromPath', filePath: filePath });
                }
                
                function openDocument(filePath) {
                    vscode.postMessage({ command: 'openDocument', filePath: filePath });
                }

                function performSearch() {
                    const query = document.getElementById('queryInput').value.trim();
                    console.log('[Webview] performSearch called with query:', query);
                    
                    if (!query) {
                        console.log('[Webview] Empty query');
                        return;
                    }

                    // Show loading state
                    console.log('[Webview] Showing search loading state');
                    showSearchLoading();

                    // Store current search query for result handling
                    currentSearchQuery = query;
                    console.log('[Webview] Set currentSearchQuery to:', currentSearchQuery);

                    // Send search request to extension
                    console.log('[Webview] Sending searchDocuments message to extension');
                    vscode.postMessage({ command: 'searchDocuments', query: query });
                }

                let currentSearchQuery = '';

                function handleSearchError(errorMessage) {
                    console.error('Search failed:', errorMessage);
                    hideSearchLoading();
                }

                // Initialize event listeners
                function initializeEventListeners() {
                    // Refresh button
                    const refreshBtn = document.getElementById('refreshBtn');
                    if (refreshBtn) {
                        refreshBtn.addEventListener('click', refresh);
                    }

                    // Search icon and input
                    const searchIcon = document.getElementById('searchIcon');
                    if (searchIcon) {
                        searchIcon.addEventListener('click', performSearch);
                    }

                    const queryInput = document.getElementById('queryInput');
                    if (queryInput) {
                        queryInput.addEventListener('keypress', (event) => {
                            if (event.key === 'Enter') {
                                performSearch();
                            }
                        });
                        
                        // Clear search spinner when input is empty
                        queryInput.addEventListener('input', (event) => {
                            const query = event.target.value.trim();
                            if (query.length === 0) {
                                hideSearchLoading();
                            }
                        });
                    }

                    // Initial login button (if present)
                    const loginBtn = document.getElementById('loginBtn');
                    if (loginBtn) {
                        loginBtn.addEventListener('click', login);
                    }
                }

                // Initialize and restore state
                function initialize() {
                    initializeEventListeners();
                    
                    // Restore UI state if we have saved data
                    if (isAuthenticated) {
                        updateAuthStatus(isAuthenticated);
                        
                        // Resume any interrupted uploads first
                        if (uploadingFiles.size > 0) {
                            uploadingFiles.forEach((uploadInfo, filePath) => {
                                // Check if upload has been running too long (>5 minutes)
                                const elapsed = Date.now() - uploadInfo.startTime;
                                if (elapsed > 5 * 60 * 1000) {
                                    // Remove stale upload
                                    uploadingFiles.delete(filePath);
                                } else {
                                    // Resume progress animation from where it left off
                                    simulateUploadProgressFromPoint(filePath, uploadInfo.progress);
                                }
                            });
                            saveState();
                        }
                        
                        // Update UI after cleaning up stale uploads
                        if (documents.length > 0 || workspacePdfs.length > 0 || uploadingFiles.size > 0) {
                            updateAllPapers();
                        }
                    }
                    
                    // Always refresh to get latest data
                    refresh();
                }
                
                function simulateUploadProgressFromPoint(filePath, startProgress) {
                    let progress = Math.max(startProgress, 0);
                    const targetTime = 60000; // 60 seconds total target time
                    const updateInterval = 500; // Update every 500ms
                    const totalUpdates = targetTime / updateInterval; // 120 updates
                    const progressPerUpdate = 95 / totalUpdates; // ~0.79% per update
                    
                    const interval = setInterval(() => {
                        // Add some randomness while maintaining consistent timing
                        const randomVariance = (Math.random() - 0.5) * 0.3; // ±0.15%
                        progress += progressPerUpdate + randomVariance;
                        
                        // Ensure we don't exceed 95% or go backwards
                        progress = Math.min(Math.max(progress, startProgress), 95);
                        
                        updateProgressBar(filePath, progress);
                        
                        if (progress >= 95) {
                            clearInterval(interval);
                        }
                    }, updateInterval);
                }

                // Initialize
                initialize();
            </script>
        </body>
        </html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}