/**
 * The core journey on synthetic data: configure accounts, upload a statement
 * folder, read the Overview, settle an unclear credit, reload, and back up.
 * Tests run in order and share one temporary data root.
 */
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const statements = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'statements',
);

async function addAccount(page: Page, id: string, title: string, type: string) {
  await page.goto('/accounts');
  await page.getByRole('button', { name: 'Add Account' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Account ID').fill(id);
  await dialog.getByLabel('Account Title').fill(title);
  await dialog.getByLabel('Institution').fill('Generic');
  await dialog.getByLabel('Account Type').selectOption({ label: type });
  await dialog.getByRole('button', { name: 'Create Account' }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByText(title, { exact: true }).locator('visible=true').first(),
  ).toBeVisible();
}

function totals(page: Page) {
  return page.getByRole('region', { name: 'Activity totals' });
}

test('configures accounts and imports a statement folder', async ({ page }) => {
  await addAccount(page, 'checking', 'Checking', 'Checking');
  await addAccount(page, 'card', 'Card', 'Credit Card');

  await page.goto('/imports');
  await page.getByLabel('Choose statement folder').setInputFiles(statements);
  await expect(page.getByText('2 files ready')).toBeVisible();
  await page.getByRole('button', { name: 'Upload and rebuild' }).click();
  await expect(page.getByText(/2 new/).first()).toBeVisible({ timeout: 30_000 });
});

test('reports income, spending net of refunds, and asks about unclear credits', async ({
  page,
}) => {
  await page.goto('/?period=all');
  // Two identical $90 rows in one statement are two purchases, not one.
  await expect(totals(page).getByText('$3,000.00', { exact: true })).toBeVisible();
  await expect(totals(page).getByText('$440.75', { exact: true })).toBeVisible();
  await expect(totals(page).getByText('$2,559.25', { exact: true })).toBeVisible();
  await expect(page.getByText('Some credits need your decision')).toBeVisible();
});

test('a decision is saved as a correction and survives a reload', async ({ page }) => {
  await page.goto('/transactions?flow=undecided&view=list');
  await page.getByRole('checkbox', { name: /Select STATEMENT CREDIT/i }).check();
  await page.getByRole('button', { name: 'Count as income' }).click();
  await page.getByRole('button', { name: 'Preview changes' }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText(/Saved correction/)).toBeVisible();

  await page.goto('/?period=all');
  await page.reload();
  await expect(totals(page).getByText('$3,025.00', { exact: true })).toBeVisible();
  await expect(page.getByText('Some credits need your decision')).toBeHidden();
});

test('creates a full backup', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Create full backup' }).click();
  await expect(page.getByText('Backup saved')).toBeVisible({ timeout: 30_000 });
});
