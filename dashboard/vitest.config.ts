import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    // Keep jsdom-heavy component suites below their per-test timeout under load.
    maxWorkers: 4,
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
  },
});
