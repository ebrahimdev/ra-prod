const fs = require('fs');
const path = require('path');

function incrementVersion() {
    const packageJsonPath = path.join(__dirname, '../../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    const versionParts = packageJson.version.split('.');
    versionParts[2] = parseInt(versionParts[2]) + 1;
    
    packageJson.version = versionParts.join('.');
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    
    console.log(`Version incremented to ${packageJson.version}`);
    return packageJson.version;
}

module.exports = { incrementVersion };