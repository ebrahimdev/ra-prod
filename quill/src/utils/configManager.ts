import * as vscode from 'vscode';

export class ConfigManager {
    private static instance: ConfigManager;
    
    private constructor() {}
    
    public static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }

    getAuthServerUrl(): string {
        const config = vscode.workspace.getConfiguration('quill');
        return config.get('authServerUrl', 'http://localhost:5000');
    }

    getRagServerUrl(): string {
        const config = vscode.workspace.getConfiguration('quill');
        return config.get('ragServerUrl', 'http://localhost:5001');
    }
    
    isProductionBuild(): boolean {
        // This will be set during production build process
        return process.env.QUILL_PRODUCTION === 'true';
    }
    
    getProductionConfig() {
        if (this.isProductionBuild()) {
            return {
                authServerUrl: 'http://45.76.61.43:5000',
                ragServerUrl: 'http://45.76.61.43:5001'
            };
        }
        return null;
    }
}

export const configManager = ConfigManager.getInstance();