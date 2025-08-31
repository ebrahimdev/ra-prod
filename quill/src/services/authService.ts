import * as vscode from 'vscode';
import axios from 'axios';
import { configManager } from '../utils/configManager';
import { Logger } from '../utils/logger';

export interface User {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
}

export interface AuthTokens {
    access_token: string;
    refresh_token: string;
}

export class AuthService {
    private readonly context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    private getAuthServerUrl(): string {
        const prodConfig = configManager.getProductionConfig();
        const url = prodConfig ? prodConfig.authServerUrl : configManager.getAuthServerUrl();
        Logger.info(`Using auth server URL: ${url}`);
        Logger.info(`Is production build: ${configManager.isProductionBuild()}`);
        return url;
    }

    async login(email: string, password: string): Promise<{ user: User; tokens: AuthTokens }> {
        const response = await axios.post(`${this.getAuthServerUrl()}/api/auth/login`, {
            email,
            password
        });

        const { user, access_token, refresh_token } = response.data;
        
        await this.storeTokens({ access_token, refresh_token });
        await this.storeUser(user);

        return { user, tokens: { access_token, refresh_token } };
    }

    async register(email: string, password: string, firstName: string, lastName: string): Promise<{ user: User; tokens: AuthTokens }> {
        const authServerUrl = this.getAuthServerUrl();
        const endpoint = `${authServerUrl}/api/auth/register`;
        
        Logger.info(`Attempting registration to: ${endpoint}`);
        Logger.info(`Registration data: email=${email}, firstName=${firstName}, lastName=${lastName}`);
        
        try {
            const response = await axios.post(endpoint, {
                email,
                password,
                first_name: firstName,
                last_name: lastName
            });

            Logger.info(`Registration response status: ${response.status}`);
            Logger.info(`Registration response data: ${JSON.stringify(response.data)}`);

            const { user, access_token, refresh_token } = response.data;
            
            await this.storeTokens({ access_token, refresh_token });
            await this.storeUser(user);

            return { user, tokens: { access_token, refresh_token } };
        } catch (error: any) {
            Logger.error(`Registration axios error: ${error.message}`);
            if (error.response) {
                Logger.error(`Response status: ${error.response.status}`);
                Logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
            } else if (error.request) {
                Logger.error(`No response received from server`);
                Logger.error(`Request details: ${JSON.stringify(error.config)}`);
            }
            throw error;
        }
    }

    async getStoredTokens(): Promise<AuthTokens | null> {
        const accessToken = await this.context.secrets.get('access_token');
        const refreshToken = await this.context.secrets.get('refresh_token');

        if (accessToken && refreshToken) {
            return {
                access_token: accessToken,
                refresh_token: refreshToken
            };
        }

        return null;
    }

    async getStoredUser(): Promise<User | null> {
        const userJson = await this.context.secrets.get('user');
        return userJson ? JSON.parse(userJson) : null;
    }

    async refreshToken(): Promise<AuthTokens | null> {
        const tokens = await this.getStoredTokens();
        if (!tokens) return null;

        try {
            const response = await axios.post(`${this.getAuthServerUrl()}/api/auth/refresh`, {}, {
                headers: {
                    'Authorization': `Bearer ${tokens.refresh_token}`
                }
            });

            const newTokens = {
                access_token: response.data.access_token,
                refresh_token: tokens.refresh_token
            };

            await this.storeTokens(newTokens);
            return newTokens;
        } catch (error) {
            await this.logout();
            return null;
        }
    }

    async logout(): Promise<void> {
        await this.context.secrets.delete('access_token');
        await this.context.secrets.delete('refresh_token');
        await this.context.secrets.delete('user');
    }

    async isAuthenticated(): Promise<boolean> {
        const tokens = await this.getStoredTokens();
        return tokens !== null;
    }

    private async storeTokens(tokens: AuthTokens): Promise<void> {
        await this.context.secrets.store('access_token', tokens.access_token);
        await this.context.secrets.store('refresh_token', tokens.refresh_token);
    }

    private async storeUser(user: User): Promise<void> {
        await this.context.secrets.store('user', JSON.stringify(user));
    }
}