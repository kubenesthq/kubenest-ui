import { test, expect } from '@playwright/test';
import { artifact } from './fixtures';

/**
 * kn-u3 — Clusters list + detail (KubeNest Design) on real data. Exercised
 * against the REAL backend via the shared auth state from the `setup` project —
 * no mocks, no page.route() stubs.
 */
test('clusters: list + detail render real status / install command / provisioning, with labelled stubs', async ({ page }) => {
  // ── List ──────────────────────────────────────────────────────────────────
  await page.goto('/clusters');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByRole('heading', { name: 'Clusters' })).toBeVisible();

  // The march-20-demo env has at least one cluster; click into it.
  const firstClusterLink = page.locator('a[href^="/clusters/"]:not([href="/clusters/new"]):not([href^="/clusters/new/"])').first();
  await expect(firstClusterLink).toBeVisible({ timeout: 12_000 });
  await firstClusterLink.click();
  await page.waitForURL(/\/clusters\/[^/]+$/, { timeout: 10_000 });
  await page.waitForLoadState('domcontentloaded');

  // ── Detail — Overview (default tab): real status + install command ────────
  // Status grid labels.
  await expect(page.getByText('Connection', { exact: true })).toBeVisible();
  await expect(page.getByText('Health', { exact: true })).toBeVisible();
  await expect(page.getByText('Kubernetes', { exact: true })).toBeVisible();
  // The hero shows a connection pill — Connected / Pending / Disconnected.
  await expect(page.getByText(/^(Connected|Pending|Disconnected)$/).first()).toBeVisible();

  // Install instructions card — the real command from GET /clusters/{id}/install-command.
  await expect(page.getByText('Connect the operator')).toBeVisible();
  const installPre = page.locator('pre').first();
  await expect(installPre).toBeVisible({ timeout: 12_000 });
  await page.waitForTimeout(2000); // let the install-command fetch resolve
  expect((await installPre.innerText()).trim().length).toBeGreaterThan(10);

  // kn-u15 wired the Cluster capacity panel to GET /clusters/{id}/metrics —
  // it renders the series grid or a labelled "No data" state, never the old stub.
  await expect(page.getByTestId('cluster-metrics')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('metrics-grid').or(page.getByTestId('metrics-empty'))).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: artifact('clusters-detail-overview.png'), fullPage: true });

  // ── Provisioning tab: real jobs (or the labelled empty state) ────────────
  await page.getByRole('tab', { name: 'Provisioning' }).click();
  await expect(page.getByText(/Provisioning jobs|No provisioning jobs for this cluster/).first()).toBeVisible({ timeout: 10_000 });

  // ── RBAC tab: labelled stub naming kn-b15 ────────────────────────────────
  await page.getByRole('tab', { name: 'RBAC' }).click();
  await expect(page.getByText('Role-based access control')).toBeVisible();
  await expect(page.getByText(/kn-b15/)).toBeVisible();

  // ── Projects tab renders ─────────────────────────────────────────────────
  await page.getByRole('tab', { name: 'Projects' }).click();
  await expect(page.getByText('Projects in this cluster')).toBeVisible();
});
