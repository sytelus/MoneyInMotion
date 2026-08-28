import js from '@eslint/js';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';

const vitestGlobals = {
  afterEach: 'readonly',
  beforeEach: 'readonly',
  describe: 'readonly',
  expect: 'readonly',
  it: 'readonly',
  test: 'readonly',
  vi: 'readonly',
};

export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**', 'coverage/**'],
  },
  js.configs.recommended,
  {
    files: ['scripts/**/*.mjs', '*.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['packages/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'no-undef': 'off',
      'react-hooks/incompatible-library': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'Buffer', message: 'Core must run without Node Buffer polyfills.' },
        { name: 'process', message: 'Core must not depend on the Node process global.' },
        { name: 'window', message: 'Core must remain independent of browser windows.' },
        { name: 'document', message: 'Core must remain independent of the browser DOM.' },
      ],
    },
  },
  {
    files: ['packages/web/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'Buffer', message: 'Browser code must not require Node Buffer polyfills.' },
        { name: 'process', message: 'Use Vite browser environment values, not process.' },
      ],
    },
  },
  {
    files: ['packages/**/__tests__/**/*.{ts,tsx}', 'packages/**/*.{test,spec}.{ts,tsx}'],
    languageOptions: {
      globals: vitestGlobals,
    },
  },
];
