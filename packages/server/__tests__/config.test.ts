import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildConfig, loadConfig, parseConfiguredPort } from '../src/config.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  vi.unstubAllEnvs();
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

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

  it('uses only config.json and ignores former application environment variables', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mim-config-test-'));
    temporaryDirectories.push(directory);
    const configFile = path.join(directory, 'config.json');
    fs.writeFileSync(
      configFile,
      JSON.stringify({ dataRoot: '/file-root', username: 'file-user', port: 4123 }),
      'utf-8',
    );
    vi.stubEnv('MIM_DATA_ROOT', '/environment-root');
    vi.stubEnv('MIM_USERNAME', 'environment-user');
    vi.stubEnv('MIM_PORT', '4999');

    const config = loadConfig({ ensureDirectories: false, configFile });

    expect(config).toMatchObject({
      dataRoot: '/file-root',
      username: 'file-user',
      port: 4123,
    });
  });

  it('creates a complete canonical config file on first use', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mim-config-test-'));
    temporaryDirectories.push(directory);
    const configFile = path.join(directory, '.moneyinmotion', 'config.json');

    const config = loadConfig({ ensureDirectories: false, configFile });
    const saved = JSON.parse(fs.readFileSync(configFile, 'utf-8')) as Record<string, unknown>;

    expect(saved).toEqual({
      dataRoot: config.dataRoot,
      username: config.username,
      port: config.port,
    });
    expect(config.dataRoot).toBe(path.join(os.homedir(), 'mim_root'));
  });
});
