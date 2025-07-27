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
    user_message_id?: string;
    assistant_message_id?: string;
}

export interface SendMessageResult {
    assistantMessage: ChatMessage;
    sessionId: string;
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
     * Get all chat sessions from backend API
     */
    async getAllSessions(): Promise<{[sessionId: string]: ChatSession}> {
        const tokens = await this.authService.getStoredTokens();
        
        if (!tokens) {
            throw new Error('Not authenticated. Please login first.');
        }

        const baseUrl = this.configManager.getRagServerUrl();
        
        try {
            const response = await axios.get(`${baseUrl}/api/chat/sessions`, {
                headers: {
                    'Authorization': `Bearer ${tokens.access_token}`
                }
            });

            const sessions: {[sessionId: string]: ChatSession} = {};
            response.data.sessions.forEach((session: any) => {
                sessions[session.id] = {
                    id: session.id,
                    messages: [], // Will be loaded when needed
                    createdAt: session.created_at,
                    lastActivity: session.last_activity,
                    title: session.title
                };
            });

            return sessions;

        } catch (error: any) {
            if (error.response?.status === 401) {
                const refreshedTokens = await this.authService.refreshToken();
                if (refreshedTokens) {
                    return this.getAllSessions(); // Retry
                } else {
                    throw new Error('Authentication expired. Please login again.');
                }
            }
            
            const errorMessage = error.response?.data?.error || error.message || 'Failed to retrieve chat sessions';
            throw new Error(errorMessage);
        }
    }

    /**
     * Get a specific chat session by ID from backend API
     */
    async getSession(sessionId: string): Promise<ChatSession | null> {
        const tokens = await this.authService.getStoredTokens();
        
        if (!tokens) {
            throw new Error('Not authenticated. Please login first.');
        }

        const baseUrl = this.configManager.getRagServerUrl();
        
        try {
            const response = await axios.get(`${baseUrl}/api/chat/sessions/${sessionId}`, {
                headers: {
                    'Authorization': `Bearer ${tokens.access_token}`
                }
            });

            const sessionData = response.data;
            return {
                id: sessionData.id,
                messages: sessionData.messages.map((msg: any) => ({
                    id: msg.id,
                    role: msg.role as 'user' | 'assistant',
                    content: msg.content,
                    timestamp: msg.timestamp
                })),
                createdAt: sessionData.created_at,
                lastActivity: sessionData.last_activity,
                title: sessionData.title
            };

        } catch (error: any) {
            if (error.response?.status === 404) {
                return null; // Session not found
            }
            
            if (error.response?.status === 401) {
                const refreshedTokens = await this.authService.refreshToken();
                if (refreshedTokens) {
                    return this.getSession(sessionId); // Retry
                } else {
                    throw new Error('Authentication expired. Please login again.');
                }
            }
            
            const errorMessage = error.response?.data?.error || error.message || 'Failed to retrieve chat session';
            throw new Error(errorMessage);
        }
    }

    /**
     * Create a new chat session (backend will create it when first message is sent)
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

        // Note: Session will be created in backend when first message is sent
        return session;
    }

    /**
     * Send a message to the chat API (backend handles session and message storage)
     */
    async sendMessage(sessionId: string, userMessage: string): Promise<SendMessageResult> {
        const tokens = await this.authService.getStoredTokens();
        
        if (!tokens) {
            throw new Error('Not authenticated. Please login first.');
        }

        const baseUrl = this.configManager.getRagServerUrl();
        
        try {
            const response = await axios.post(`${baseUrl}/api/chat/message`, {
                message: userMessage,
                session_id: sessionId === 'new' || sessionId.startsWith('session-') ? undefined : sessionId // Let backend create new session if needed
            }, {
                headers: {
                    'Authorization': `Bearer ${tokens.access_token}`,
                    'Content-Type': 'application/json'
                }
            });

            const chatResponse: ChatResponse = response.data;

            // Return the assistant message and real session ID
            const assistantMessage: ChatMessage = {
                id: chatResponse.assistant_message_id || this.generateMessageId(),
                role: 'assistant',
                content: chatResponse.message,
                timestamp: chatResponse.timestamp
            };

            return {
                assistantMessage,
                sessionId: chatResponse.session_id
            };

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
     * Delete a chat session via backend API
     */
    async deleteSession(sessionId: string): Promise<void> {
        const tokens = await this.authService.getStoredTokens();
        
        if (!tokens) {
            throw new Error('Not authenticated. Please login first.');
        }

        const baseUrl = this.configManager.getRagServerUrl();
        
        try {
            await axios.delete(`${baseUrl}/api/chat/sessions/${sessionId}`, {
                headers: {
                    'Authorization': `Bearer ${tokens.access_token}`
                }
            });

        } catch (error: any) {
            if (error.response?.status === 401) {
                const refreshedTokens = await this.authService.refreshToken();
                if (refreshedTokens) {
                    return this.deleteSession(sessionId); // Retry
                } else {
                    throw new Error('Authentication expired. Please login again.');
                }
            }
            
            const errorMessage = error.response?.data?.error || error.message || 'Failed to delete chat session';
            throw new Error(errorMessage);
        }
    }

    /**
     * Get recent sessions (last 20)
     */
    async getRecentSessions(): Promise<ChatSession[]> {
        const sessions = await this.getAllSessions();
        const sessionList = Object.values(sessions);
        
        // Sessions are already sorted by last activity from backend
        return sessionList.slice(0, 20);
    }
}