#!/bin/bash

set -e

PROD_SERVER=${PROD_SERVER:-45.76.61.43}
BUILD_DIR="quill"

echo "🏗️ Building production version of Quill extension"

cd $BUILD_DIR

# Install dependencies
echo "📦 Installing dependencies"
npm install

# Create production configuration
echo "⚙️ Configuring for production server: $PROD_SERVER"

# Update configuration to point to production server
cat > src/utils/prodConfig.ts << EOF
// Production configuration - Auto-generated during build
export const PROD_CONFIG = {
    AUTH_SERVER_URL: 'http://$PROD_SERVER:5000',
    RAG_SERVER_URL: 'http://$PROD_SERVER:5001',
    IS_PRODUCTION: true
};
EOF

# Set production environment variable during compilation
export QUILL_PRODUCTION=true

# Increment version for production build
CURRENT_VERSION=$(node -p "require('./package.json').version")
IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
PATCH_VERSION=$((${VERSION_PARTS[2]} + 1))
NEW_VERSION="${VERSION_PARTS[0]}.${VERSION_PARTS[1]}.$PATCH_VERSION"

echo "📈 Bumping version from $CURRENT_VERSION to $NEW_VERSION"
npm version $NEW_VERSION --no-git-tag-version

# Compile TypeScript
echo "🔨 Compiling TypeScript"
npm run compile

# Build VSIX package
echo "📦 Building VSIX package"
# Use npx to avoid Node.js compatibility issues with global vsce
npx --yes @vscode/vsce@latest package

# Clean up production config file
rm -f src/utils/prodConfig.ts

# Reset environment variable
unset QUILL_PRODUCTION

VSIX_FILE=$(ls quill-*.vsix | tail -n1)
echo "✅ Production build completed: $VSIX_FILE"
echo "🎯 Extension configured for server: $PROD_SERVER"

# Create build info
cat > build-info.json << EOF
{
    "version": "$NEW_VERSION",
    "buildDate": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "serverHost": "$PROD_SERVER",
    "vsixFile": "$VSIX_FILE"
}
EOF

echo "📋 Build info saved to build-info.json"