import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../..');
const frontendRoot = __dirname;

export default defineConfig({
  root: frontendRoot,
  envDir: workspaceRoot,
  publicDir: path.resolve(frontendRoot, 'public'),
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
        main: path.resolve(frontendRoot, 'index.html'),
        mocap: path.resolve(frontendRoot, 'mocap-window.html'),
        webcam: path.resolve(frontendRoot, 'webcam-window.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(frontendRoot, './src'),
      '@mocap': path.resolve(frontendRoot, './src-mocap'),
      '@shared': path.resolve(frontendRoot, './src-shared'),
    },
  },
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
    '__KOS_WEB__': true
  }
});
