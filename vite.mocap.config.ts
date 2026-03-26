import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-mocap',
    rollupOptions: {
      input: {
        mocap: path.resolve(__dirname, 'mocap-window.html'),
        webcam: path.resolve(__dirname, 'webcam-window.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@mocap': path.resolve(__dirname, './src-mocap'),
      '@shared': path.resolve(__dirname, './src-shared'),
    },
  },
});
