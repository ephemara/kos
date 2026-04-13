import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, 'apps/web');

export default defineConfig({
  plugins: [react()],
  root: webRoot,
  publicDir: path.resolve(webRoot, 'public'),
  build: {
    outDir: path.resolve(__dirname, 'dist-mocap'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
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
});
