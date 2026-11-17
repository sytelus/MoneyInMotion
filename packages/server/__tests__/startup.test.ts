import { describe, expect, it } from 'vitest';
import { listenErrorMessage, listenUrl } from '../src/startup.js';

describe('startup messages', () => {
  it('prints a URL a browser can open for the bound host', () => {
    expect(listenUrl('127.0.0.1', 3001)).toBe('http://127.0.0.1:3001');
    expect(listenUrl('0.0.0.0', 3001)).toBe('http://localhost:3001');
    expect(listenUrl('::1', 3001)).toBe('http://[::1]:3001');
  });

  it('explains a busy port in one plain sentence', () => {
    const error = Object.assign(new Error('listen EADDRINUSE'), { code: 'EADDRINUSE' });
    expect(listenErrorMessage(error, '127.0.0.1', 3001)).toBe(
      'Port 3001 is in use; change it in ~/.moneyinmotion/config.json or stop the other program.',
    );
  });
});
