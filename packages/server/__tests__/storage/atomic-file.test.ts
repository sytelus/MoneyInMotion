import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { writeTextFileAtomically } from '../../src/storage/atomic-file.js';

describe('writeTextFileAtomically', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mim-atomic-file-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('replaces a text file without leaving temporary files', () => {
    const filePath = path.join(tempDir, 'data.json');
    fs.writeFileSync(filePath, 'old', 'utf-8');

    writeTextFileAtomically(filePath, 'new');

    expect(fs.readFileSync(filePath, 'utf-8')).toBe('new');
    expect(fs.readdirSync(tempDir)).toEqual(['data.json']);
  });

  it('removes its temporary file when the final rename fails', () => {
    const directoryTarget = path.join(tempDir, 'cannot-replace-directory');
    fs.mkdirSync(directoryTarget);

    expect(() => writeTextFileAtomically(directoryTarget, 'new')).toThrow();
    expect(fs.readdirSync(tempDir)).toEqual(['cannot-replace-directory']);
  });
});
