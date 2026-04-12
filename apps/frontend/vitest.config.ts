import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

const workspaceRoot = path.resolve(__dirname, '../..');
const frontendRoot = __dirname;

export default defineConfig({
  root: workspaceRoot,
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [path.resolve(frontendRoot, './src/tests/setup.ts')],
    include: [
      'apps/frontend/src/**/*.{test,spec}.{ts,tsx}',
      'apps/frontend/src-mocap/**/*.{test,spec}.{ts,tsx}',
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
        'apps/frontend/src/tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        '**/types',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(frontendRoot, './src'),
      '@mocap': path.resolve(frontendRoot, './src-mocap'),
      '@shared': path.resolve(frontendRoot, './src-shared'),
    },
  },
});
