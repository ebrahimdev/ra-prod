import axios from 'axios';
import { ConfigManager } from '../utils/configManager';

export class RagProvider {
    private configManager: ConfigManager;

    constructor() {
        this.configManager = new ConfigManager();
    }

    async query(query: string): Promise<string> {
        const baseUrl = this.configManager.getRagServerUrl();
        
        const response = await axios.post(`${baseUrl}/api/query`, {
            query: query
        });

        return response.data.response;
    }
}