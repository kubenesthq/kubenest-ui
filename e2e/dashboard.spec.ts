import { test, expect } from '@playwright/test';
import { artifact } from './fixtures';

/**
 * kn-u2 — Dashboard (KubeNest Design) on real data. Exercised against the REAL
 * backend via the shared auth state from the `setup` project — no mocks, no
 * page.route() stubs.
 */
test('dashboard: hero stats, cluster fleet, recent deploys (real) + a labelled capacity stub', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  // Real counts in the subline.
  await expect(page.getByText(/Fleet posture across \d+ cluster/)).toBeVisible();

  // ── Hero strip: a labelled capacity stub naming kn-b11 — not fake numbers ─
  await expect(page.getByText('Fleet capacity')).toBeVisible();
  await expect(page.getByText(/not yet available.*kn-b11/)).toBeVisible();

  // ── Cluster fleet panel ──────────────────────────────────────────────────
  await expect(page.getByText('Cluster fleet')).toBeVisible();
  await expect(page.getByText(/Capacity & utilisation bars land with kn-b11/)).toBeVisible();
  // At least one real cluster row links into /clusters/<id> (march-20-demo has one).
  await expect(page.locator('a[href^="/clusters/"]:not([href="/clusters/new"]):not([href^="/clusters/new/"])').first()).toBeVisible({ timeout: 12_000 });

  // ── Recent deploys feed — real deployment history ────────────────────────
  await expect(page.getByText('Recent deploys')).toBeVisible();
  // Either a real deploy row (a /apps/... link carrying a status word) or the
  // labelled empty state — never fabricated data.
  const deployRow = page.locator('a[href^="/apps/"]').filter({ hasText: /completed|failed|in_progress|pending/i }).first();
  const emptyState = page.getByText('No deployments yet. Deploy an app to see its history here.');
  await expect(deployRow.or(emptyState)).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: artifact('dashboard.png'), fullPage: true });
});
