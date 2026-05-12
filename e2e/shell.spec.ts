import { test, expect } from '@playwright/test';
import { artifact } from './fixtures';

/**
 * kn-u1 — the rebuilt app shell (KubeNest Design): sidebar nav, breadcrumbs, org
 * switcher, ⌘K command palette, 3 themes. Exercised against the REAL backend via
 * the shared auth state from the `setup` project — no mocks, no page.route() stubs.
 */
test('app shell: sidebar, command palette, themes and breadcrumbs work on real data', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('domcontentloaded');

  // ── Sidebar ───────────────────────────────────────────────────────────────
  const sidebar = page.locator('aside').first();
  await expect(sidebar).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Clusters' })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Cloud providers' })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Add-ons catalog' })).toBeVisible();
  await expect(sidebar.getByText('Search…')).toBeVisible();
  // The org switcher button carries the real active org name (loaded from the backend).
  const orgButton = sidebar.locator('button').first();
  await expect(orgButton).toBeVisible();
  expect((await orgButton.innerText()).trim().length).toBeGreaterThan(0);
  await page.screenshot({ path: artifact('shell-dashboard.png'), fullPage: false });

  // ── Theme toggle (3 themes via data-theme on <html>) ─────────────────────
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Theme' }).click();
  await page.getByRole('button', { name: /Mission Control/ }).click();
  await expect(html).toHaveAttribute('data-theme', 'mc');
  await page.screenshot({ path: artifact('shell-theme-mc.png'), fullPage: false });
  await page.getByRole('button', { name: 'Theme' }).click();
  await page.getByRole('button', { name: /Blueprint/ }).click();
  await expect(html).toHaveAttribute('data-theme', 'blueprint');
  await page.getByRole('button', { name: 'Theme' }).click();
  await page.getByRole('button', { name: /^Light/ }).click();
  await expect(html).toHaveAttribute('data-theme', 'light');

  // ── Org switcher modal ───────────────────────────────────────────────────
  await orgButton.click();
  const orgDialog = page.getByRole('dialog', { name: 'Switch organization' });
  await expect(orgDialog).toBeVisible();
  await expect(orgDialog.getByText('Organization settings')).toBeVisible();
  await orgDialog.getByRole('button', { name: 'Close' }).click();
  await expect(orgDialog).toBeHidden();

  // ── Command palette (⌘K, client-side search over real entities) ──────────
  await page.keyboard.press('ControlOrMeta+k');
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  await expect(palette).toBeVisible();
  await expect(palette.getByText('Actions')).toBeVisible();
  // With real backend data the palette shows at least one entity group.
  const entityGroup = palette.getByText(/^(Clusters|Projects|Apps)$/).first();
  await expect(entityGroup).toBeVisible({ timeout: 12_000 });
  await page.screenshot({ path: artifact('shell-command-palette.png') });
  await page.keyboard.press('Escape');
  await expect(palette).toBeHidden();

  // ── Breadcrumbs ──────────────────────────────────────────────────────────
  await page.goto('/clusters');
  await page.waitForLoadState('domcontentloaded');
  const crumbs = page.locator('nav[aria-label="Breadcrumb"]');
  await expect(crumbs.getByText('Clusters')).toBeVisible();
  // If a real cluster row exists, follow it and assert the breadcrumb resolves
  // the cluster's human name (not the raw UUID), then walk the crumb back.
  const firstClusterLink = page
    .locator('main a[href^="/clusters/"]:not([href="/clusters/new"]):not([href^="/clusters/new/"])')
    .first();
  if (await firstClusterLink.count()) {
    const href = (await firstClusterLink.getAttribute('href')) || '';
    const clusterId = href.split('/').filter(Boolean).pop() || '';
    await firstClusterLink.click();
    await page.waitForURL(/\/clusters\/[^/]+/, { timeout: 10_000 });
    await page.waitForLoadState('domcontentloaded');
    await expect(crumbs.getByText('Clusters')).toBeVisible();
    await page.waitForTimeout(2500); // let the cluster fetch resolve the name
    const crumbText = (await crumbs.innerText()).trim();
    expect(crumbText.replace(/\s+/g, '').length).toBeGreaterThan('Clusters'.length);
    if (clusterId.length >= 8) expect(crumbText).not.toContain(clusterId);
    await crumbs.getByRole('link', { name: 'Clusters' }).click();
    await expect(page).toHaveURL(/\/clusters\b/);
  }
});
