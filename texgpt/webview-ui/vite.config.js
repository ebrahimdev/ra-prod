import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Determine which app to build based on BUILD_TARGET env variable
const buildTarget = process.env.BUILD_TARGET || 'dashboard';

const configs = {
  dashboard: {
    html: 'index.html',
    outDir: '../dist/webview-ui'
  },
  chat: {
    html: 'chat.html',
    outDir: '../dist/webview-chat'
  }
};

const config = configs[buildTarget];

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: config.outDir,
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, config.html),
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 3000,
    strictPort: true
  }
});
