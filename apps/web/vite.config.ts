import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../..');
const webRoot = __dirname;

export default defineConfig({
  root: webRoot,
  envDir: workspaceRoot,
  publicDir: path.resolve(webRoot, 'public'),
  plugins: [react()],
  server: {
    fs: {
      allow: [workspaceRoot],
    },
  },
  build: {
    outDir: path.resolve(workspaceRoot, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(webRoot, 'index.html'),
        mocap: path.resolve(webRoot, 'mocap-window.html'),
        webcam: path.resolve(webRoot, 'webcam-window.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(webRoot, './src'),
      '@mocap': path.resolve(webRoot, './src-mocap'),
      '@shared': path.resolve(webRoot, './src-shared'),
    },
  },
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
    '__KOS_WEB__': true
  }
});
