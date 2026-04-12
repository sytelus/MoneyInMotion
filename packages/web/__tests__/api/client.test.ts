import { describe, it, expect, vi, afterEach } from 'vitest';
import { updateConfig, uploadAccountFiles } from '../../src/api/client.js';

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
        dataPath: '/tmp/mim-data',
        port: 70000,
      }),
    ).rejects.toThrow(
      'API PUT /config failed (400): port must be between 1 and 65535',
    );
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
      uploadAccountFiles('acct-checking', [
        new File(['%PDF-1.7'], 'statement.pdf', {
          type: 'application/pdf',
        }),
      ]),
    ).rejects.toThrow(
      'API POST /accounts/acct-checking/upload failed (400): File "statement.pdf" does not match this account\'s file filters (*.csv).',
    );
  });
});
