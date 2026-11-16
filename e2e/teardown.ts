import * as fs from 'node:fs';

/** Delete the temporary home and data root created by playwright.config.ts. */
export default function teardown(): void {
  const sandbox = process.env.MIM_E2E_SANDBOX;
  if (sandbox?.includes('mim-e2e-')) fs.rmSync(sandbox, { recursive: true, force: true });
}
