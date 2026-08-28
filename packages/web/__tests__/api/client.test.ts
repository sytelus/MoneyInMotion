import { describe, it, expect, vi, afterEach } from 'vitest';
import { updateConfig, uploadStatementFolder } from '../../src/api/client.js';

describe('api client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('extracts JSON error messages for JSON requests', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: 'port must be between 1 and 65535',
            status: 400,
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      ),
    );

    await expect(
      updateConfig({
        dataRoot: '/tmp/mim-data',
        port: 70000,
      }),
    ).rejects.toThrow('API PUT /config failed (400): port must be between 1 and 65535');
  });

  it('extracts JSON error messages for multipart uploads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: 'File "statement.pdf" does not match this account\'s file filters (*.csv).',
            status: 400,
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      ),
    );

    await expect(
      uploadStatementFolder([
        {
          file: new File(['%PDF-1.7'], 'statement.pdf', {
            type: 'application/pdf',
          }),
          relativePath: 'selected/acct-checking/statement.pdf',
        },
      ]),
    ).rejects.toThrow(
      'API POST /import/folder failed (400): File "statement.pdf" does not match this account\'s file filters (*.csv).',
    );
  });
});
