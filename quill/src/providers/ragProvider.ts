import axios from 'axios';
import * as vscode from 'vscode';
import { ConfigManager } from '../utils/configManager';
import { AuthService } from '../services/authService';

export class RagProvider {
    private configManager: ConfigManager;
    private authService: AuthService;

    constructor(context: vscode.ExtensionContext) {
        this.configManager = new ConfigManager();
        this.authService = new AuthService(context);
    }

    async query(query: string): Promise<string> {
        const tokens = await this.authService.getStoredTokens();
        
        if (!tokens) {
            throw new Error('Not authenticated. Please login first.');
        }

        console.log(`Making RAG query with token: ${tokens.access_token.substring(0, 20)}...`);
        const baseUrl = this.configManager.getRagServerUrl();
        
        try {
            const response = await axios.post(`${baseUrl}/api/query`, {
                query: query
            }, {
                headers: {
                    'Authorization': `Bearer ${tokens.access_token}`
                }
            });

            return response.data.response;
        } catch (error: any) {
            console.log(`RAG query error:`, error.response?.status, error.response?.data);
            
            if (error.response?.status === 401) {
                console.log('Attempting token refresh...');
                const refreshedTokens = await this.authService.refreshToken();
                if (refreshedTokens) {
                    console.log(`Retrying with refreshed token: ${refreshedTokens.access_token.substring(0, 20)}...`);
                    const response = await axios.post(`${baseUrl}/api/query`, {
                        query: query
                    }, {
                        headers: {
                            'Authorization': `Bearer ${refreshedTokens.access_token}`
                        }
                    });
                    return response.data.response;
                } else {
                    throw new Error('Authentication expired. Please login again.');
                }
            }
            throw error;
        }
    }
}