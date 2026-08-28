import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@moneyinmotion/core': path.resolve(__dirname, '../core/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['__tests__/**/*.test.{ts,tsx}'],
    setupFiles: ['__tests__/setup.ts'],
  },
});
