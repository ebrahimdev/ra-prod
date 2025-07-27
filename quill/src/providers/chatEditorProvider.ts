import * as vscode from 'vscode';
import { ChatSessionService, ChatSession, ChatMessage, SendMessageResult } from '../services/chatSessionService';

export class ChatEditorProvider implements vscode.CustomTextEditorProvider {
    public static readonly viewType = 'quill.chatEditor';

    // Track open chat session panels to prevent duplicates
    private static openPanels = new Map<string, vscode.WebviewPanel>();

    private chatSessionService: ChatSessionService;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.chatSessionService = new ChatSessionService(context);
    }

    /**
     * Open a chat session in an editor (new or existing)
     */
    public static async openChatSession(
        context: vscode.ExtensionContext, 
        initialMessage?: string,
        existingSessionId?: string
    ): Promise<vscode.WebviewPanel> {
        const chatSessionService = new ChatSessionService(context);
        let session: ChatSession;
        
        if (existingSessionId) {
            // Check if this session already has an open panel
            const existingPanel = ChatEditorProvider.openPanels.get(existingSessionId);
            if (existingPanel) {
                // Focus the existing panel instead of creating a new one
                existingPanel.reveal(vscode.ViewColumn.Active);
                return existingPanel;
            }
            
            // Try to load existing session
            const existingSession = await chatSessionService.getSession(existingSessionId);
            if (!existingSession) {
                throw new Error('Chat session not found');
            }
            session = existingSession;
        } else {
            // Create new session
            session = await chatSessionService.createSession(initialMessage);
        }
        
        // Create webview panel directly
        const panel = vscode.window.createWebviewPanel(
            'quillChat',
            `Chat: ${session.title}`,
            vscode.ViewColumn.Active,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        // Add panel to tracking
        ChatEditorProvider.openPanels.set(session.id, panel);

        // Track the current session ID (may change for new sessions)
        let currentSessionId = session.id;
        
        // Clean up tracking when panel is disposed
        panel.onDidDispose(() => {
            ChatEditorProvider.openPanels.delete(currentSessionId);
        });

        // Create provider instance to handle the webview
        const provider = new ChatEditorProvider(context);
        
        // Set up the webview content
        panel.webview.html = provider.getWebviewContent(panel.webview, session);

        // Handle messages
        panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'sendMessage':
                        // Update session ID when it changes (for new sessions)
                        const newSessionId = await provider.handleSendMessage(panel, currentSessionId, message.text);
                        if (newSessionId !== currentSessionId) {
                            // Session ID changed, update tracking
                            ChatEditorProvider.openPanels.delete(currentSessionId);
                            ChatEditorProvider.openPanels.set(newSessionId, panel);
                            currentSessionId = newSessionId;
                        }
                        break;
                    case 'loadSession':
                        await provider.handleLoadSession(panel, currentSessionId);
                        break;
                }
            },
            undefined,
            context.subscriptions
        );

        // If there's an initial message and this is a new session, send it automatically
        if (initialMessage && !existingSessionId) {
            setTimeout(async () => {
                const newSessionId = await provider.handleSendMessage(panel, currentSessionId, initialMessage);
                if (newSessionId !== currentSessionId) {
                    // Session ID changed, update tracking
                    ChatEditorProvider.openPanels.delete(currentSessionId);
                    ChatEditorProvider.openPanels.set(newSessionId, panel);
                    currentSessionId = newSessionId;
                }
            }, 500);
        }

        return panel;
    }

    /**
     * Called when our custom editor is opened
     */
    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        // Extract session ID from document content
        let sessionId: string;
        try {
            const docContent = JSON.parse(document.getText());
            sessionId = docContent.sessionId;
        } catch (error) {
            vscode.window.showErrorMessage('Invalid chat session document');
            return;
        }

        // Setup webview
        webviewPanel.webview.options = {
            enableScripts: true,
        };

        // Load the session
        const session = await this.chatSessionService.getSession(sessionId);
        if (!session) {
            vscode.window.showErrorMessage('Chat session not found');
            return;
        }

        // Set initial HTML
        webviewPanel.webview.html = this.getWebviewContent(webviewPanel.webview, session);

        // Track the current session ID
        let currentSessionId = sessionId;

        // Handle messages from the webview
        webviewPanel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'sendMessage':
                        currentSessionId = await this.handleSendMessage(webviewPanel, currentSessionId, message.text);
                        break;
                    case 'loadSession':
                        await this.handleLoadSession(webviewPanel, currentSessionId);
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );

        // Update the title
        webviewPanel.title = `Chat: ${session.title}`;
    }

    /**
     * Handle sending a message
     */
    public async handleSendMessage(
        webviewPanel: vscode.WebviewPanel, 
        sessionId: string, 
        userMessage: string
    ): Promise<string> {
        try {
            // Show loading state
            webviewPanel.webview.postMessage({
                command: 'messageLoading',
                loading: true
            });

            // Send message to API
            const result = await this.chatSessionService.sendMessage(sessionId, userMessage);
            const realSessionId = result.sessionId;
            
            // Get updated session using the real session ID
            const session = await this.chatSessionService.getSession(realSessionId);
            
            // Update webview with new messages
            webviewPanel.webview.postMessage({
                command: 'messagesUpdated',
                messages: session?.messages || []
            });

            webviewPanel.webview.postMessage({
                command: 'messageLoading',
                loading: false
            });

            // If session ID changed (new session was created), refresh dashboard
            if (sessionId !== realSessionId && sessionId.startsWith('session-')) {
                // Add a small delay to ensure backend has committed the session
                setTimeout(() => {
                    vscode.commands.executeCommand('quill.refreshChatSessions');
                }, 500);
            }

            // Return the real session ID so caller can update
            return realSessionId;

        } catch (error: any) {
            webviewPanel.webview.postMessage({
                command: 'messageLoading',
                loading: false
            });

            webviewPanel.webview.postMessage({
                command: 'showError',
                error: error.message
            });

            // Return the original session ID on error
            return sessionId;
        }
    }

    /**
     * Handle loading session data
     */
    public async handleLoadSession(
        webviewPanel: vscode.WebviewPanel, 
        sessionId: string
    ): Promise<void> {
        const session = await this.chatSessionService.getSession(sessionId);
        if (session) {
            webviewPanel.webview.postMessage({
                command: 'messagesUpdated',
                messages: session.messages
            });
        }
    }

    /**
     * Generate the HTML content for the webview
     */
    public getWebviewContent(webview: vscode.Webview, session: ChatSession): string {
        const nonce = this.getNonce();

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
            <title>Chat Session</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    margin: 0;
                    padding: 0;
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                }

                .chat-container {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                    scroll-behavior: smooth;
                }

                .message {
                    margin-bottom: 20px;
                    animation: fadeIn 0.3s ease-in;
                }

                .message.user {
                    text-align: right;
                }

                .message.assistant {
                    text-align: left;
                }

                .message-content {
                    display: inline-block;
                    max-width: 80%;
                    padding: 12px 16px;
                    border-radius: 12px;
                    word-wrap: break-word;
                }

                .message.user .message-content {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: 1px solid var(--vscode-button-border);
                }

                .message.assistant .message-content {
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                }

                .message-timestamp {
                    font-size: 0.8em;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 4px;
                }

                .input-container {
                    padding: 16px;
                    border-top: 1px solid var(--vscode-panel-border);
                    background-color: var(--vscode-panel-background);
                    display: flex;
                    gap: 8px;
                }

                .message-input {
                    flex: 1;
                    padding: 8px 12px;
                    border: 1px solid var(--vscode-input-border);
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border-radius: 6px;
                    font-family: inherit;
                    font-size: inherit;
                    resize: vertical;
                    min-height: 36px;
                    max-height: 120px;
                }

                .message-input:focus {
                    outline: 1px solid var(--vscode-focusBorder);
                    border-color: var(--vscode-focusBorder);
                }

                .send-button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: 1px solid var(--vscode-button-border);
                    padding: 8px 16px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-family: inherit;
                    font-size: inherit;
                    min-width: 60px;
                }

                .send-button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }

                .send-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .loading {
                    text-align: center;
                    color: var(--vscode-descriptionForeground);
                    font-style: italic;
                    padding: 10px;
                }

                .error {
                    background-color: var(--vscode-inputValidation-errorBackground);
                    color: var(--vscode-inputValidation-errorForeground);
                    padding: 8px 12px;
                    border-radius: 6px;
                    margin: 10px 0;
                    border: 1px solid var(--vscode-inputValidation-errorBorder);
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                /* Markdown rendering styles */
                .message-content h1, .message-content h2, .message-content h3 {
                    margin-top: 0;
                    margin-bottom: 8px;
                }

                .message-content p {
                    margin: 8px 0;
                    line-height: 1.5;
                }

                .message-content code {
                    background-color: var(--vscode-textCodeBlock-background);
                    padding: 2px 4px;
                    border-radius: 3px;
                    font-family: var(--vscode-editor-font-family);
                }

                .message-content pre {
                    background-color: var(--vscode-textCodeBlock-background);
                    padding: 12px;
                    border-radius: 6px;
                    overflow-x: auto;
                    margin: 8px 0;
                }

                .message-content blockquote {
                    border-left: 4px solid var(--vscode-textBlockQuote-border);
                    padding-left: 12px;
                    margin: 8px 0;
                    color: var(--vscode-textBlockQuote-foreground);
                    background-color: var(--vscode-textBlockQuote-background);
                }

                .message-content ul, .message-content ol {
                    padding-left: 20px;
                    margin: 8px 0;
                }

                .message-content li {
                    margin: 4px 0;
                }
            </style>
        </head>
        <body>
            <div class="chat-container" id="chatContainer">
                <!-- Messages will be populated by JavaScript -->
            </div>
            
            <div class="input-container">
                <textarea 
                    class="message-input" 
                    id="messageInput" 
                    placeholder="Type your message..."
                    rows="1"
                ></textarea>
                <button class="send-button" id="sendButton">Send</button>
            </div>

            <script nonce="${nonce}">
                const vscode = acquireVsCodeApi();
                
                let isLoading = false;
                let messages = ${JSON.stringify(session.messages)};

                // DOM elements
                const chatContainer = document.getElementById('chatContainer');
                const messageInput = document.getElementById('messageInput');
                const sendButton = document.getElementById('sendButton');

                // Render messages
                function renderMessages() {
                    chatContainer.innerHTML = '';
                    
                    messages.forEach(message => {
                        const messageDiv = document.createElement('div');
                        messageDiv.className = \`message \${message.role}\`;
                        
                        const contentDiv = document.createElement('div');
                        contentDiv.className = 'message-content';
                        
                        // Simple markdown rendering (convert **bold** and *italic*)
                        let content = message.content
                            .replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')
                            .replace(/\\*(.*?)\\*/g, '<em>$1</em>')
                            .replace(/\\n/g, '<br>');
                        
                        contentDiv.innerHTML = content;
                        
                        const timestampDiv = document.createElement('div');
                        timestampDiv.className = 'message-timestamp';
                        timestampDiv.textContent = new Date(message.timestamp).toLocaleTimeString();
                        
                        messageDiv.appendChild(contentDiv);
                        messageDiv.appendChild(timestampDiv);
                        chatContainer.appendChild(messageDiv);
                    });

                    // Scroll to bottom
                    setTimeout(() => {
                        chatContainer.scrollTop = chatContainer.scrollHeight;
                    }, 100);
                }

                // Send message
                function sendMessage() {
                    const text = messageInput.value.trim();
                    if (!text || isLoading) return;

                    // Add user message immediately
                    const userMessage = {
                        id: Date.now().toString(),
                        role: 'user',
                        content: text,
                        timestamp: new Date().toISOString()
                    };
                    
                    messages.push(userMessage);
                    renderMessages();
                    
                    // Clear input
                    messageInput.value = '';
                    
                    // Send to extension
                    vscode.postMessage({
                        command: 'sendMessage',
                        text: text
                    });
                }

                // Event listeners
                sendButton.addEventListener('click', sendMessage);
                
                messageInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                    }
                });

                // Auto-resize textarea
                messageInput.addEventListener('input', () => {
                    messageInput.style.height = 'auto';
                    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
                });

                // Handle messages from extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    switch (message.command) {
                        case 'messagesUpdated':
                            messages = message.messages;
                            renderMessages();
                            break;
                        case 'messageLoading':
                            isLoading = message.loading;
                            sendButton.disabled = isLoading;
                            sendButton.textContent = isLoading ? '...' : 'Send';
                            
                            if (isLoading) {
                                const loadingDiv = document.createElement('div');
                                loadingDiv.className = 'loading';
                                loadingDiv.id = 'loadingIndicator';
                                loadingDiv.textContent = 'Assistant is thinking...';
                                chatContainer.appendChild(loadingDiv);
                                chatContainer.scrollTop = chatContainer.scrollHeight;
                            } else {
                                const loadingDiv = document.getElementById('loadingIndicator');
                                if (loadingDiv) {
                                    loadingDiv.remove();
                                }
                            }
                            break;
                        case 'showError':
                            const errorDiv = document.createElement('div');
                            errorDiv.className = 'error';
                            errorDiv.textContent = 'Error: ' + message.error;
                            chatContainer.appendChild(errorDiv);
                            chatContainer.scrollTop = chatContainer.scrollHeight;
                            break;
                    }
                });

                // Initial render
                renderMessages();
                
                // Focus input
                messageInput.focus();
            </script>
        </body>
        </html>`;
    }

    private getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}