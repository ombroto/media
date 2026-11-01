import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 20000,
    fileParallelism: false,
  },
  resolve: {
    alias: { '@': new URL('./src/', import.meta.url).pathname },
  },
});
