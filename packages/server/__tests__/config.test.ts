import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { buildConfig, parseConfiguredPort } from '../src/config.js';

describe('server configuration', () => {
  it('accepts only complete integer port values in range', () => {
    expect(parseConfiguredPort('3001')).toBe(3001);
    expect(parseConfiguredPort(65535)).toBe(65535);
    expect(parseConfiguredPort('3001junk')).toBeNull();
    expect(parseConfiguredPort('3.14')).toBeNull();
    expect(parseConfiguredPort(0)).toBeNull();
    expect(parseConfiguredPort(65536)).toBeNull();
  });

  it('validates ports even when configuration is built directly', () => {
    expect(() => buildConfig('/tmp/mim', 'user', 0)).toThrow('port');
    expect(() => buildConfig('/tmp/mim', 'user', 3.14)).toThrow('port');
  });

  it('uses one normalized root for every derived path', () => {
    const config = buildConfig('/tmp/parent/../mim', 'user', 3001);

    expect(config.dataRoot).toBe(path.normalize('/tmp/parent/../mim'));
    expect(config.userDataPath).toBe(path.join(config.dataRoot, 'user'));
    expect(config.statementsDir).toBe(path.join(config.userDataPath, 'Statements'));
  });
});
