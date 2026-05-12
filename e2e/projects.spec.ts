import { expect, test } from '@playwright/test';
import { artifact } from './fixtures';

/**
 * kn-u6 — Projects list + detail (KubeNest Design) against the REAL backend.
 *
 * No mocks (AGENTS.md §7 / brief §5): the shared `setup` project provides auth
 * state and every assertion runs against the live control-plane API.
 *
 *  - list → detail: real project rows; detail shows the flat apps + addons
 *    sections, the Secrets tab (registry secrets + the kn-B14 per-app rollup
 *    stub), and the RBAC tab as a labelled stub naming kn-B15; Settings = delete.
 *  - create → delete a project end-to-end through the UI.
 */

const uniqueName = (p: string) => `${p}-${Date.now().toString(36)}`; // [a-zA-Z0-9-], ≥3 chars

test.describe('projects', () => {
  test('list → detail: apps & addons, Secrets (kn-B14 rollup stub), RBAC (kn-B15 stub)', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible({ timeout: 20_000 });

    const projectRow = page.locator('a[href^="/projects/"]').first();
    await expect(projectRow).toBeVisible({ timeout: 20_000 });
    await projectRow.click();
    await page.waitForURL(/\/projects\/[^/?]+$/, { timeout: 15_000 });
    await expect(page.getByRole('tablist')).toBeVisible({ timeout: 15_000 });

    // Overview — flat apps + addons sections (real data, or a labelled empty state).
    await expect(page.getByText('Apps running in this project')).toBeVisible();
    await expect(page.getByText(/Managed backing services/)).toBeVisible();

    // Secrets tab — registry secrets + the per-app rollup stub naming kn-B14.
    await page.getByRole('tab', { name: 'Secrets' }).click();
    await expect(page.getByText('Registry pull secrets')).toBeVisible();
    await expect(page.getByText(/needs kn-B14/i)).toBeVisible();

    // RBAC tab — a labelled stub naming kn-B15.
    await page.getByRole('tab', { name: 'RBAC' }).click();
    await expect(page.getByText(/needs kn-B15/i)).toBeVisible();

    // Settings tab — project delete lives here.
    await page.getByRole('tab', { name: 'Settings' }).click();
    await expect(page.getByRole('button', { name: 'Delete project' })).toBeVisible();
    await page.screenshot({ path: artifact('project-detail.png'), fullPage: true });
  });

  test('create then delete a project', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('domcontentloaded');
    const newBtn = page.getByRole('button', { name: 'New project' });
    await expect(newBtn).toBeVisible({ timeout: 20_000 });
    if (await newBtn.isDisabled()) {
      test.skip(true, 'no clusters registered — cannot create a project');
      return;
    }

    await newBtn.click();
    await page.waitForURL(/\/clusters\/[^/]+\/projects\/new$/, { timeout: 15_000 });

    const name = uniqueName('knu6e2e');
    await page.getByPlaceholder('my-project').fill(name);
    await page.getByRole('button', { name: 'Create Project' }).click();

    // Success redirects to /projects/<id>.
    await page.waitForURL(/\/projects\/[^/?]+$/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name })).toBeVisible({ timeout: 15_000 });

    // Delete it from the Settings tab.
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Delete project' }).click();
    await page.getByRole('dialog', { name: 'Delete project' }).getByRole('button', { name: 'Delete project' }).click();
    await page.waitForURL(/\/projects$/, { timeout: 30_000 });
    await expect(page.locator('a[href^="/projects/"]').filter({ hasText: name })).toHaveCount(0);
  });
});
