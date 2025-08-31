import * as vscode from 'vscode';
import { Logger } from './logger';
import { BUILD_CONFIG } from '../config/buildConfig';

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
        Logger.info(`Using build config - isProduction: ${BUILD_CONFIG.isProduction}`);
        Logger.info(`Auth server URL: ${BUILD_CONFIG.authServerUrl}`);
        return BUILD_CONFIG.authServerUrl;
    }

    getRagServerUrl(): string {
        Logger.info(`RAG server URL: ${BUILD_CONFIG.ragServerUrl}`);
        return BUILD_CONFIG.ragServerUrl;
    }
    
    isProductionBuild(): boolean {
        return BUILD_CONFIG.isProduction;
    }
}

export const configManager = ConfigManager.getInstance();