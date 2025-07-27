import * as vscode from 'vscode';
import axios from 'axios';
import { AuthService } from './authService';
import { ConfigManager } from '../utils/configManager';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}

export interface ChatSession {
    id: string;
    messages: ChatMessage[];
    createdAt: string;
    lastActivity: string;
    title?: string;
}

export interface ChatResponse {
    session_id: string;
    message: string;
    timestamp: string;
    user_message: string;
}

export class ChatSessionService {
    private authService: AuthService;
    private configManager: ConfigManager;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.authService = new AuthService(context);
        this.configManager = new ConfigManager();
    }

    /**
     * Generate a unique ID for messages
     */
    private generateMessageId(): string {
        return Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Generate a title for a chat session based on the first message
     */
    private generateSessionTitle(firstMessage: string): string {
        const maxLength = 50;
        if (firstMessage.length <= maxLength) {
            return firstMessage;
        }
        return firstMessage.substring(0, maxLength - 3) + '...';
    }

    /**
     * Save chat session to VSCode global state
     */
    private async saveSession(session: ChatSession): Promise<void> {
        const sessions = await this.getAllSessions();
        sessions[session.id] = session;
        await this.context.globalState.update('quill.chatSessions', sessions);
    }

    /**
     * Get all chat sessions from VSCode global state
     */
    async getAllSessions(): Promise<{[sessionId: string]: ChatSession}> {
        return this.context.globalState.get('quill.chatSessions', {});
    }

    /**
     * Get a specific chat session by ID
     */
    async getSession(sessionId: string): Promise<ChatSession | null> {
        const sessions = await this.getAllSessions();
        return sessions[sessionId] || null;
    }

    /**
     * Create a new chat session
     */
    async createSession(initialMessage?: string): Promise<ChatSession> {
        const sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        const now = new Date().toISOString();
        
        const session: ChatSession = {
            id: sessionId,
            messages: [],
            createdAt: now,
            lastActivity: now,
            title: initialMessage ? this.generateSessionTitle(initialMessage) : 'New Chat'
        };

        await this.saveSession(session);
        return session;
    }

    /**
     * Send a message to the chat API and update the session
     */
    async sendMessage(sessionId: string, userMessage: string): Promise<ChatMessage> {
        const tokens = await this.authService.getStoredTokens();
        
        if (!tokens) {
            throw new Error('Not authenticated. Please login first.');
        }

        const session = await this.getSession(sessionId);
        if (!session) {
            throw new Error('Chat session not found');
        }

        const baseUrl = this.configManager.getRagServerUrl();
        
        try {
            // Create user message
            const userChatMessage: ChatMessage = {
                id: this.generateMessageId(),
                role: 'user',
                content: userMessage,
                timestamp: new Date().toISOString()
            };

            // Add user message to session
            session.messages.push(userChatMessage);
            session.lastActivity = new Date().toISOString();
            
            // Update title if this is the first message
            if (session.messages.length === 1) {
                session.title = this.generateSessionTitle(userMessage);
            }

            // Prepare chat history for API (exclude current message)
            const chatHistory = session.messages.slice(0, -1).map(msg => ({
                role: msg.role,
                content: msg.content
            }));

            const response = await axios.post(`${baseUrl}/api/chat/message`, {
                message: userMessage,
                session_id: sessionId,
                chat_history: chatHistory
            }, {
                headers: {
                    'Authorization': `Bearer ${tokens.access_token}`,
                    'Content-Type': 'application/json'
                }
            });

            const chatResponse: ChatResponse = response.data;

            // Create assistant message
            const assistantMessage: ChatMessage = {
                id: this.generateMessageId(),
                role: 'assistant',
                content: chatResponse.message,
                timestamp: chatResponse.timestamp
            };

            // Add assistant message to session
            session.messages.push(assistantMessage);
            session.lastActivity = chatResponse.timestamp;

            // Save updated session
            await this.saveSession(session);

            return assistantMessage;

        } catch (error: any) {
            if (error.response?.status === 401) {
                // Try to refresh token and retry
                const refreshedTokens = await this.authService.refreshToken();
                if (refreshedTokens) {
                    // Retry the request with refreshed token
                    return this.sendMessage(sessionId, userMessage);
                } else {
                    throw new Error('Authentication expired. Please login again.');
                }
            }
            
            const errorMessage = error.response?.data?.error || error.message || 'Failed to send message';
            throw new Error(errorMessage);
        }
    }

    /**
     * Delete a chat session
     */
    async deleteSession(sessionId: string): Promise<void> {
        const sessions = await this.getAllSessions();
        delete sessions[sessionId];
        await this.context.globalState.update('quill.chatSessions', sessions);
    }

    /**
     * Clear all chat sessions
     */
    async clearAllSessions(): Promise<void> {
        await this.context.globalState.update('quill.chatSessions', {});
    }

    /**
     * Get recent sessions (last 10)
     */
    async getRecentSessions(): Promise<ChatSession[]> {
        const sessions = await this.getAllSessions();
        const sessionList = Object.values(sessions);
        
        // Sort by last activity, most recent first
        sessionList.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
        
        return sessionList.slice(0, 10);
    }
}