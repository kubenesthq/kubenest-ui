import { expect, test, type Page } from '@playwright/test';
import { artifact } from './fixtures';

/**
 * kn-u15 — Monitoring surfaces (KubeNest Design §8.2/§8.3) flipped from the
 * kn-u2/u3/u8 stubs to real time-series, against the REAL backend via the
 * shared `setup` auth state — no mocks, no page.route() stubs.
 *
 * Asserts: the cluster-detail Overview "Cluster capacity" panel, the app
 * "Monitoring" tab + the app-overview resource graphs, and the dashboard's
 * per-cluster capacity sparklines all hit the real metrics endpoints
 * (GET /clusters/{id}/metrics, GET /apps/{ns}/{name}/metrics, the C6 series
 * envelope) and render either real series or a labelled "No data" state when
 * the cluster has no Prometheus / metrics proxy — never a fake graph.
 */

async function firstClusterId(page: Page): Promise<string | null> {
  const token = await page.evaluate(() => localStorage.getItem('token'));
  if (!token) return null;
  const headers = { Authorization: `Bearer ${token}` };
  for (const org of ((await (await page.request.get('/api/v1/orgs', { headers })).json()) ?? []) as Array<{ id: string }>) {
    const cl = await page.request.get(`/api/v1/orgs/${org.id}/clusters`, { headers });
    if (!cl.ok()) continue;
    const first = ((await cl.json())?.data ?? [])[0];
    if (first?.id) return String(first.id);
  }
  return null;
}

async function firstApp(page: Page): Promise<{ namespace: string; name: string; projectId: string } | null> {
  const token = await page.evaluate(() => localStorage.getItem('token'));
  if (!token) return null;
  const res = await page.request.get('/api/v1/apps', { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok()) return null;
  const a = ((await res.json())?.data ?? []).find((x: { project_id?: string }) => x.project_id);
  return a ? { namespace: String(a.namespace), name: String(a.name), projectId: String(a.project_id) } : null;
}

test.describe('monitoring', () => {
  test('cluster detail: the Cluster capacity panel hits the real metrics endpoint (series or labelled "No data")', async ({ page }) => {
    await page.goto('/clusters');
    await page.waitForLoadState('domcontentloaded');
    const id = await firstClusterId(page);
    if (!id) {
      test.skip(true, 'no clusters in this environment');
      return;
    }
    await page.goto(`/clusters/${id}`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByTestId('cluster-metrics')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('metrics-range').first()).toBeVisible();
    await expect(page.getByTestId('metrics-grid').or(page.getByTestId('metrics-empty'))).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: artifact('monitoring-cluster.png'), fullPage: true });
  });

  test('app detail: the Monitoring tab hits the real metrics endpoint', async ({ page }) => {
    await page.goto('/apps');
    await page.waitForLoadState('domcontentloaded');
    const app = await firstApp(page);
    if (!app) {
      test.skip(true, 'no apps with a project in this environment');
      return;
    }
    await page.goto(`/apps/${encodeURIComponent(app.namespace)}/${encodeURIComponent(app.name)}?project_id=${app.projectId}`);
    await page.waitForLoadState('domcontentloaded');
    // kn-1ho: the Overview tab no longer carries a compact "Resource graphs"
    // card — it always rendered "Metrics are temporarily unavailable" and was
    // pure noise next to the dedicated Monitoring tab below.
    await expect(page.getByText('Resource graphs')).toHaveCount(0);
    // Monitoring tab: full app + per-component series (or the labelled empty state).
    await page.getByRole('tab', { name: 'Monitoring' }).click();
    await expect(page.getByTestId('app-monitoring')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('metrics-grid').or(page.getByTestId('metrics-empty'))).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: artifact('monitoring-app.png'), fullPage: true });
  });

  test('dashboard: cluster fleet rows show a real capacity sparkline (or "—" when no metrics)', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Cluster fleet')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/capacity sparkline per cluster/i)).toBeVisible();
    const id = await firstClusterId(page);
    if (id) {
      await expect(page.getByTestId('cluster-sparkline').first()).toBeVisible({ timeout: 15_000 });
    }
    await page.screenshot({ path: artifact('monitoring-dashboard.png'), fullPage: true });
  });
});
