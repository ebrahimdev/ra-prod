#!/usr/bin/env node

const { execSync } = require('child_process');
const { incrementVersion } = require('./src/utils/version');
const fs = require('fs');
const path = require('path');

function runCommand(command, description) {
    console.log(`\n🔄 ${description}...`);
    try {
        execSync(command, { stdio: 'inherit', cwd: __dirname });
        console.log(`✅ ${description} completed`);
    } catch (error) {
        console.error(`❌ ${description} failed:`, error.message);
        process.exit(1);
    }
}

function main() {
    console.log('🚀 Starting Quill extension build process...');
    
    // Increment version
    console.log('\n📝 Incrementing version...');
    const newVersion = incrementVersion();
    
    // Install dependencies
    runCommand('npm install', 'Installing dependencies');
    
    // Compile TypeScript
    runCommand('npm run compile', 'Compiling TypeScript');
    
    // Install vsce locally if not present
    try {
        execSync('npx vsce --version', { stdio: 'ignore' });
    } catch {
        runCommand('npm install vsce', 'Installing vsce locally');
    }
    
    // Package extension
    const packageName = `quill-${newVersion}.vsix`;
    runCommand('npx vsce package', 'Creating VSIX package');
    
    // Uninstall previous version (ignore errors)
    try {
        execSync('code --uninstall-extension quill', { stdio: 'ignore' });
    } catch {
        // Ignore if extension not installed
    }
    
    // Install extension
    runCommand(`code --install-extension ${packageName}`, 'Installing extension in VSCode');
    
    console.log(`\n🎉 Build complete! Extension v${newVersion} installed successfully.`);
    console.log(`📦 Package created: ${packageName}`);
    console.log('💡 Restart VSCode to use the updated extension.');
}

if (require.main === module) {
    main();
}