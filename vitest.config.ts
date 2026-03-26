import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src-frontend/tests/setup.ts'],
    include: [
      'src-frontend/**/*.{test,spec}.{ts,tsx}',
      'src-mocap/**/*.{test,spec}.{ts,tsx}',
    ],
    // Exclude Three.js heavy modules that don't run in jsdom (WebGPU, etc.)
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
    ],
    // ── Faster test runs ──────────────────────────────────────────────────
    pool: 'forks',           // isolates each file in a separate process
    fileParallelism: true,
    // Fake timers: opt-in per-test via vi.useFakeTimers()
    // Do NOT enable globally — Three.js RAF needs real timers
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src-frontend/tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        '**/types',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src-frontend'),
      '@mocap': path.resolve(__dirname, './src-mocap'),
      '@shared': path.resolve(__dirname, './src-shared'),
    },
  },
});
