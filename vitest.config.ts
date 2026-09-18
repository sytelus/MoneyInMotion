import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'core',
          root: './packages/core',
          globals: true,
          include: ['__tests__/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'server',
          root: './packages/server',
          globals: true,
          include: ['__tests__/**/*.test.ts'],
        },
        resolve: {
          alias: {
            '@moneyinmotion/core': new URL('./packages/core/src/index.ts', import.meta.url)
              .pathname,
          },
        },
      },
      {
        test: {
          name: 'web',
          root: './packages/web',
          globals: true,
          environment: 'jsdom',
          include: ['__tests__/**/*.test.{ts,tsx}'],
          setupFiles: ['__tests__/setup.ts'],
        },
        // JSDOM checks semantics, not generated Tailwind layout. Actual styles
        // are compiled by the production build and exercised in Chromium.
        // Avoid resolving a root-CWD Tailwind config for incidental CSS imports.
        css: { postcss: { plugins: [] } },
        resolve: {
          alias: {
            '@moneyinmotion/core': new URL('./packages/core/src/index.ts', import.meta.url)
              .pathname,
          },
        },
      },
    ],
  },
});
