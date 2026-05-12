import { test, expect } from '@playwright/test';
import { artifact, loginViaUI } from './fixtures';

/**
 * Smoke coverage for the auth + app-shell happy path, against the REAL backend.
 *
 * - "login flow → dashboard" runs with a clean browser context (no shared auth
 *   state) and drives the actual /login form — the canonical no-mocks check.
 * - "authenticated session lands on the dashboard" reuses the storage state the
 *   `setup` project produced, the way every other UI spec will.
 */

test.describe('smoke', () => {
  test('login flow → dashboard', async ({ browser }) => {
    // Fresh context: ignore the shared storageState so we exercise login itself.
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    try {
      await loginViaUI(page);
      await expect(page).toHaveURL(/\/dashboard\b/);
      await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
      await page.screenshot({ path: artifact('smoke-dashboard.png'), fullPage: true });
    } finally {
      await context.close();
    }
  });

  test('authenticated session lands on the dashboard', async ({ page }) => {
    // Uses storageState from the `setup` project (real login, real backend).
    await page.goto('/');
    await page.waitForURL(/\/dashboard\b/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  });
});
