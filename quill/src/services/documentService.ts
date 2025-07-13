import axios from 'axios';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as FormData from 'form-data';
import { AuthService } from './authService';
import { ConfigManager } from '../utils/configManager';

export interface Document {
    id: number;
    title: string;
    filename: string;
    status: string;
    upload_date: string;
    processed_date?: string;
    file_size: number;
    metadata?: any;
}

export interface UploadResponse {
    message: string;
    document: Document;
}

export class DocumentService {
    private authService: AuthService;
    private configManager: ConfigManager;

    constructor(context: vscode.ExtensionContext) {
        this.authService = new AuthService(context);
        this.configManager = new ConfigManager();
    }

    async uploadDocument(filePath: string): Promise<Document> {
        const tokens = await this.authService.getStoredTokens();
        
        if (!tokens) {
            throw new Error('Not authenticated. Please login first.');
        }

        // Validate file
        if (!fs.existsSync(filePath)) {
            throw new Error('File does not exist');
        }

        const stats = fs.statSync(filePath);
        const maxSize = 50 * 1024 * 1024; // 50MB
        
        if (stats.size > maxSize) {
            throw new Error('File too large. Maximum size is 50MB');
        }

        if (!filePath.toLowerCase().endsWith('.pdf')) {
            throw new Error('Only PDF files are allowed');
        }

        const baseUrl = this.configManager.getRagServerUrl();
        
        try {
            // Create form data
            const formData = new FormData();
            formData.append('file', fs.createReadStream(filePath));

            const response = await axios.post(`${baseUrl}/api/documents/upload`, formData, {
                headers: {
                    'Authorization': `Bearer ${tokens.access_token}`,
                    ...formData.getHeaders()
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });

            return response.data.document;
        } catch (error: any) {
            if (error.response?.status === 401) {
                // Try to refresh token and retry
                const refreshedTokens = await this.authService.refreshToken();
                if (refreshedTokens) {
                    const formData = new FormData();
                    formData.append('file', fs.createReadStream(filePath));

                    const response = await axios.post(`${baseUrl}/api/documents/upload`, formData, {
                        headers: {
                            'Authorization': `Bearer ${refreshedTokens.access_token}`,
                            ...formData.getHeaders()
                        },
                        maxContentLength: Infinity,
                        maxBodyLength: Infinity
                    });

                    return response.data.document;
                } else {
                    throw new Error('Authentication expired. Please login again.');
                }
            }
            
            const errorMessage = error.response?.data?.error || error.message || 'Upload failed';
            throw new Error(errorMessage);
        }
    }

    async getDocuments(): Promise<Document[]> {
        const tokens = await this.authService.getStoredTokens();
        
        if (!tokens) {
            throw new Error('Not authenticated. Please login first.');
        }

        const baseUrl = this.configManager.getRagServerUrl();
        
        try {
            const response = await axios.get(`${baseUrl}/api/documents/`, {
                headers: {
                    'Authorization': `Bearer ${tokens.access_token}`
                }
            });

            return response.data.documents;
        } catch (error: any) {
            if (error.response?.status === 401) {
                const refreshedTokens = await this.authService.refreshToken();
                if (refreshedTokens) {
                    const response = await axios.get(`${baseUrl}/api/documents/`, {
                        headers: {
                            'Authorization': `Bearer ${refreshedTokens.access_token}`
                        }
                    });

                    return response.data.documents;
                } else {
                    throw new Error('Authentication expired. Please login again.');
                }
            }
            
            throw new Error('Failed to retrieve documents');
        }
    }

    async deleteDocument(documentId: number): Promise<void> {
        const tokens = await this.authService.getStoredTokens();
        
        if (!tokens) {
            throw new Error('Not authenticated. Please login first.');
        }

        const baseUrl = this.configManager.getRagServerUrl();
        
        try {
            await axios.delete(`${baseUrl}/api/documents/${documentId}`, {
                headers: {
                    'Authorization': `Bearer ${tokens.access_token}`
                }
            });
        } catch (error: any) {
            if (error.response?.status === 401) {
                const refreshedTokens = await this.authService.refreshToken();
                if (refreshedTokens) {
                    await axios.delete(`${baseUrl}/api/documents/${documentId}`, {
                        headers: {
                            'Authorization': `Bearer ${refreshedTokens.access_token}`
                        }
                    });
                } else {
                    throw new Error('Authentication expired. Please login again.');
                }
            } else {
                throw new Error('Failed to delete document');
            }
        }
    }

    async clearAllDocuments(): Promise<{ deleted_count: number; total_documents: number; failed_documents?: string[] }> {
        const tokens = await this.authService.getStoredTokens();
        
        if (!tokens) {
            throw new Error('Not authenticated. Please login first.');
        }

        const baseUrl = this.configManager.getRagServerUrl();
        
        try {
            const response = await axios.delete(`${baseUrl}/api/documents/clear-all`, {
                headers: {
                    'Authorization': `Bearer ${tokens.access_token}`
                }
            });

            return response.data;
        } catch (error: any) {
            if (error.response?.status === 401) {
                const refreshedTokens = await this.authService.refreshToken();
                if (refreshedTokens) {
                    const response = await axios.delete(`${baseUrl}/api/documents/clear-all`, {
                        headers: {
                            'Authorization': `Bearer ${refreshedTokens.access_token}`
                        }
                    });

                    return response.data;
                } else {
                    throw new Error('Authentication expired. Please login again.');
                }
            } else {
                const errorMessage = error.response?.data?.error || 'Failed to clear document library';
                throw new Error(errorMessage);
            }
        }
    }
}