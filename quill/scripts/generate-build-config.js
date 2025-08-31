#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const isProduction = process.env.QUILL_PRODUCTION === 'true';

const config = {
    isProduction,
    authServerUrl: isProduction ? 'http://45.76.61.43:5000' : 'http://localhost:8001',
    ragServerUrl: isProduction ? 'http://45.76.61.43:5001' : 'http://localhost:8000'
};

const configContent = `// This file is generated at build time
export const BUILD_CONFIG = ${JSON.stringify(config, null, 4)};
`;

const configPath = path.join(__dirname, '../src/config/buildConfig.ts');
fs.writeFileSync(configPath, configContent);

console.log(`✅ Build config generated for ${isProduction ? 'production' : 'development'}`);
console.log(`📍 Auth server: ${config.authServerUrl}`);
console.log(`📍 RAG server: ${config.ragServerUrl}`);