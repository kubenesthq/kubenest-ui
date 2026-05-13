import { expect, test } from '@playwright/test';
import { artifact } from './fixtures';

test('dashboard: renders live fleet/recents surfaces and sidebar Activity route', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expect(page.getByText(/Fleet posture across \d+ cluster/)).toBeVisible();

  // Hero strip now shows the real connected-cluster summary copy.
  await expect(page.getByText('Fleet capacity')).toBeVisible();
  await expect(page.getByText(/connected clusters.*per-cluster sparkline below/i)).toBeVisible();

  // Cluster fleet card now calls out sparklines instead of the previous stub copy.
  await expect(page.getByText('Cluster fleet')).toBeVisible();
  await expect(page.getByText(/capacity sparkline per cluster/i)).toBeVisible();
  await expect(page.getByTestId('cluster-sparkline').first()).toBeVisible({ timeout: 15_000 });

  // Recent deploys remains real-data only.
  await expect(page.getByText('Recent deploys')).toBeVisible();
  const deployRow = page.locator('a[href^="/apps/"]').filter({ hasText: /completed|failed|in_progress|pending/i }).first();
  const emptyState = page.getByText('No deployments yet. Deploy an app to see its history here.');
  await expect(deployRow.or(emptyState)).toBeVisible({ timeout: 15_000 });

  // Activity navigation should route to /activity from the sidebar.
  await page.getByRole('link', { name: 'Activity' }).click();
  await expect(page).toHaveURL(/\/activity(?:\?|$)/);
  await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible();

  await page.screenshot({ path: artifact('dashboard.png'), fullPage: true });
});
