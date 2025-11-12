const vscode = require('vscode');
const axios = require('axios');

class RagService {
    constructor(context) {
        this.context = context;
        this.loadConfig();
    }

    loadConfig() {
        const extensionPath = vscode.extensions.getExtension('texgpt.texgpt')?.extensionPath;
        if (!extensionPath) {
            throw new Error('Extension path not found');
        }

        // Determine environment
        const isDevelopment = vscode.workspace.getConfiguration('texgpt').get('development', false);

        if (isDevelopment) {
            this.ragServerUrl = 'http://localhost:8000';
        } else {
            this.ragServerUrl = 'https://rag.texgpt.com';
        }
    }

    /**
     * Send a message to the chat API
     * @param {string} message - The user's message
     * @param {string|null} sessionId - Optional session ID (null for new session)
     * @param {string} accessToken - JWT access token
     * @returns {Promise<Object>} Response with session_id, message, etc.
     */
    async sendMessage(message, sessionId, accessToken) {
        try {
            const payload = {
                message: message
            };

            // Include session_id only if it exists
            if (sessionId) {
                payload.session_id = sessionId;
            }

            const response = await axios.post(
                `${this.ragServerUrl}/api/chat/message`,
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken}`
                    },
                    timeout: 30000 // 30 second timeout for AI response
                }
            );

            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('RAG service error:', error);

            if (error.response) {
                return {
                    success: false,
                    error: error.response.data.error || 'Failed to send message'
                };
            } else if (error.request) {
                return {
                    success: false,
                    error: 'Unable to connect to RAG server'
                };
            } else {
                return {
                    success: false,
                    error: error.message || 'Failed to send message'
                };
            }
        }
    }

    /**
     * Get a specific chat session with full message history
     * @param {string} sessionId - Session ID
     * @param {string} accessToken - JWT access token
     * @returns {Promise<Object>} Session data with messages
     */
    async getSession(sessionId, accessToken) {
        try {
            const response = await axios.get(
                `${this.ragServerUrl}/api/chat/sessions/${sessionId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    },
                    timeout: 10000
                }
            );

            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('Get session error:', error);

            if (error.response) {
                return {
                    success: false,
                    error: error.response.data.error || 'Failed to get session'
                };
            } else {
                return {
                    success: false,
                    error: 'Unable to connect to RAG server'
                };
            }
        }
    }

    /**
     * Get all chat sessions for the user
     * @param {string} accessToken - JWT access token
     * @returns {Promise<Object>} List of sessions
     */
    async getSessions(accessToken) {
        try {
            const response = await axios.get(
                `${this.ragServerUrl}/api/chat/sessions`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    },
                    timeout: 10000
                }
            );

            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('Get sessions error:', error);

            if (error.response) {
                return {
                    success: false,
                    error: error.response.data.error || 'Failed to get sessions'
                };
            } else {
                return {
                    success: false,
                    error: 'Unable to connect to RAG server'
                };
            }
        }
    }

    /**
     * Delete a chat session
     * @param {string} sessionId - Session ID
     * @param {string} accessToken - JWT access token
     * @returns {Promise<Object>} Success response
     */
    async deleteSession(sessionId, accessToken) {
        try {
            const response = await axios.delete(
                `${this.ragServerUrl}/api/chat/sessions/${sessionId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    },
                    timeout: 10000
                }
            );

            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('Delete session error:', error);

            if (error.response) {
                return {
                    success: false,
                    error: error.response.data.error || 'Failed to delete session'
                };
            } else {
                return {
                    success: false,
                    error: 'Unable to connect to RAG server'
                };
            }
        }
    }
}

module.exports = RagService;
