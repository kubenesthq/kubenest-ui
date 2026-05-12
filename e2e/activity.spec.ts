import { expect, test } from '@playwright/test';
import { artifact } from './fixtures';

/**
 * kn-u14 — standalone Activity log (KubeNest Design) against the REAL backend.
 *
 * No mocks (AGENTS.md §7 / brief §5): shared `setup` auth state, every
 * assertion against the live control-plane API. Performs a real app action
 * (redeploy) and asserts it surfaces in the Activity feed as a real event.
 */

test.describe('activity log', () => {
  test('renders a real deployment-activity feed', async ({ page }) => {
    await page.goto('/activity');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Activity feed')).toBeVisible();
    // The feed is built from real GET /apps/.../deployments calls — either
    // event rows or the labelled empty state. Never synthetic events.
    const rows = page.locator('[data-testid="activity-event"]');
    const empty = page.getByText(/No apps yet|No deployment activity yet/);
    await expect(rows.first().or(empty)).toBeVisible({ timeout: 25_000 });
    await page.screenshot({ path: artifact('activity-log.png'), fullPage: true });
  });

  test('redeploy an app → it appears in the Activity log as a real event', async ({ page }) => {
    await page.goto('/apps');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2500);

    const appRow = page.locator('table tbody tr.cursor-pointer').first();
    if (!(await appRow.count())) {
      test.skip(true, 'no apps with a project to redeploy');
      return;
    }
    await appRow.click();
    await page.waitForURL(/\/apps\/[^/]+\/[^?]+\?project_id=/, { timeout: 20_000 });
    const appName = ((await page.locator('h1').first().textContent()) ?? '').trim();
    expect(appName.length).toBeGreaterThan(0);

    // Real app action: redeploy. (The button lives on the app-detail header.)
    await page.getByRole('button', { name: /redeploy/i }).first().click();
    // Give the POST /apps/.../redeploy time to be recorded.
    await page.waitForTimeout(3000);

    await page.goto('/activity');
    await page.waitForLoadState('domcontentloaded');

    // An activity event for this app, with real fields (status + relative time).
    await expect
      .poll(async () => page.locator('[data-testid="activity-event"]').filter({ hasText: appName }).count(), {
        timeout: 30_000,
        intervals: [1000, 2000, 3000, 5000],
      })
      .toBeGreaterThan(0);

    const row = page.locator('[data-testid="activity-event"]').filter({ hasText: appName }).first();
    await expect(row).toContainText(/completed|in progress|pending|failed/i);
    await expect(row).toContainText(/\bago\b/);
    await page.screenshot({ path: artifact('activity-after-redeploy.png'), fullPage: true });
  });
});
