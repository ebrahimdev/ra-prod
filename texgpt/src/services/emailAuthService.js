const vscode = require('vscode');
const axios = require('axios');

class EmailAuthService {
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
            this.authServerUrl = 'http://localhost:8001';
        } else {
            this.authServerUrl = 'https://auth.texgpt.com';
        }
    }

    async register(email, password, firstName = '', lastName = '') {
        try {
            const response = await axios.post(`${this.authServerUrl}/api/auth/register`, {
                email,
                password,
                first_name: firstName,
                last_name: lastName
            }, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            if (response.data.access_token && response.data.refresh_token) {
                await this.storeTokens(response.data.access_token, response.data.refresh_token);
                await this.storeUserInfo(response.data.user);
                return {
                    success: true,
                    user: response.data.user,
                    message: response.data.message
                };
            } else {
                throw new Error('Invalid response from server');
            }
        } catch (error) {
            console.error('Registration error:', error);
            
            if (error.response) {
                return {
                    success: false,
                    error: error.response.data.error || 'Registration failed'
                };
            } else if (error.request) {
                return {
                    success: false,
                    error: 'Unable to connect to authentication server'
                };
            } else {
                return {
                    success: false,
                    error: error.message || 'Registration failed'
                };
            }
        }
    }

    async login(email, password) {
        try {
            const response = await axios.post(`${this.authServerUrl}/api/auth/login`, {
                email,
                password
            }, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            if (response.data.access_token && response.data.refresh_token) {
                await this.storeTokens(response.data.access_token, response.data.refresh_token);
                await this.storeUserInfo(response.data.user);
                return {
                    success: true,
                    user: response.data.user,
                    message: response.data.message
                };
            } else {
                throw new Error('Invalid response from server');
            }
        } catch (error) {
            console.error('Login error:', error);
            
            if (error.response) {
                return {
                    success: false,
                    error: error.response.data.error || 'Login failed'
                };
            } else if (error.request) {
                return {
                    success: false,
                    error: 'Unable to connect to authentication server'
                };
            } else {
                return {
                    success: false,
                    error: error.message || 'Login failed'
                };
            }
        }
    }

    async storeTokens(accessToken, refreshToken) {
        if (this.context && this.context.secrets) {
            await this.context.secrets.store('texgpt.accessToken', accessToken);
            await this.context.secrets.store('texgpt.refreshToken', refreshToken);
        } else {
            // Fallback to global state if secrets API not available
            await this.context.globalState.update('texgpt.accessToken', accessToken);
            await this.context.globalState.update('texgpt.refreshToken', refreshToken);
        }
    }

    async storeUserInfo(user) {
        await this.context.globalState.update('texgpt.user', user);
    }

    async getStoredTokens() {
        if (this.context && this.context.secrets) {
            const accessToken = await this.context.secrets.get('texgpt.accessToken');
            const refreshToken = await this.context.secrets.get('texgpt.refreshToken');
            return { accessToken, refreshToken };
        } else {
            // Fallback to global state
            const accessToken = this.context.globalState.get('texgpt.accessToken');
            const refreshToken = this.context.globalState.get('texgpt.refreshToken');
            return { accessToken, refreshToken };
        }
    }

    async clearStoredData() {
        if (this.context && this.context.secrets) {
            await this.context.secrets.delete('texgpt.accessToken');
            await this.context.secrets.delete('texgpt.refreshToken');
        } else {
            await this.context.globalState.update('texgpt.accessToken', undefined);
            await this.context.globalState.update('texgpt.refreshToken', undefined);
        }
        await this.context.globalState.update('texgpt.user', undefined);
    }

    async isAuthenticated() {
        const { accessToken } = await this.getStoredTokens();
        return !!accessToken;
    }

    async getCurrentUser() {
        return this.context.globalState.get('texgpt.user');
    }
}

module.exports = EmailAuthService;