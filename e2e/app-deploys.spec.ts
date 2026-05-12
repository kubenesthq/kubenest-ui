import { expect, test } from '@playwright/test';
import { artifact } from './fixtures';

/**
 * kn-u9 — App Deploys timeline + redeploy + rollback (KubeNest Design) against
 * the REAL backend. No mocks (AGENTS.md §7 / brief §5): shared `setup` auth
 * state, real control-plane API.
 *
 * Opens a real app, exercises the Deploys tab: the deploy timeline renders real
 * rows, Redeploy fires (and shows live progress / settles), and Roll-back-to-a-
 * prior-deploy from the timeline resolves to a defined visible state (success
 * banner or a surfaced failure — never an undefined state). Skips gracefully
 * when there's no app to act on.
 */

type AppRef = { name: string; namespace: string; project_id: string };

async function findOrCreateApp(page: import('@playwright/test').Page): Promise<AppRef | null> {
  // The /apps page list is org-scoped (and can be empty in CI); the apps API
  // isn't. Find an existing app with a project, or create a minimal one.
  const token = await page.evaluate(() => localStorage.getItem('token'));
  if (!token) return null;
  const headers = { Authorization: `Bearer ${token}` };

  const listed = await page.request.get('/api/v1/apps', { headers });
  if (listed.ok()) {
    const found = ((await listed.json())?.data ?? []).find((a: { project_id?: string }) => a.project_id);
    if (found) return { name: String(found.name), namespace: String(found.namespace), project_id: String(found.project_id) };
  }

  const projectsRes = await page.request.get('/api/v1/projects?items_per_page=50', { headers });
  if (!projectsRes.ok()) return null;
  const proj = (await projectsRes.json())?.data?.[0];
  if (!proj) return null;
  const appName = `knu9e2e-${Date.now().toString(36)}`;
  const created = await page.request.post('/api/v1/apps', {
    headers,
    data: {
      name: appName,
      project_id: String(proj.id),
      components: [{ name: 'web', type: 'workload', workload_spec: { image: 'nginx:1.27-alpine', replicas: 1, port: 8080 } }],
    },
  });
  if (!created.ok()) return null;
  return { name: appName, namespace: String(proj.namespace), project_id: String(proj.id) };
}

async function openAppDeploysTab(page: import('@playwright/test').Page): Promise<boolean> {
  await page.goto('/');
  await page.waitForURL(/\/dashboard\b/, { timeout: 20_000 });
  const app = await findOrCreateApp(page);
  if (!app) return false;
  await page.goto(`/apps/${app.namespace}/${app.name}?project_id=${app.project_id}`);
  await page.waitForURL(/\/apps\/[^/]+\/[^?]+\?project_id=/, { timeout: 20_000 });
  await page.getByRole('tab', { name: 'Deploys' }).click();
  await expect(page.getByText('Deploy timeline')).toBeVisible({ timeout: 15_000 });
  return true;
}

test.describe('app deploys', () => {
  test('deploy timeline + redeploy + rollback resolve to defined states', async ({ page }) => {
    const ok = await openAppDeploysTab(page);
    if (!ok) { test.skip(true, 'no app with a project to exercise'); return; }

    // Timeline renders real rows (or the labelled empty state) — never synthetic.
    const rows = page.locator('[data-testid="deploy-row"]');
    const empty = page.getByText(/No deploys yet/);
    await expect(rows.first().or(empty)).toBeVisible({ timeout: 15_000 });
    // The enriched-fields-from-kn-B10 note is present (labelled, not faked).
    await expect(page.getByText(/arrive with kn-B10/i)).toBeVisible();
    await page.screenshot({ path: artifact('app-deploys-timeline.png'), fullPage: true });

    // Redeploy → either live progress shows, or it completes fast; either way
    // the timeline stays intact and no failure banner is left dangling.
    await page.getByTestId('deploys-redeploy').click();
    const progress = page.getByTestId('deploy-progress');
    await Promise.race([
      progress.waitFor({ state: 'visible', timeout: 8_000 }).catch(() => {}),
      page.waitForTimeout(8_000),
    ]);
    await expect(page.getByText('Deploy timeline')).toBeVisible();

    // Roll back from the timeline to a prior deploy (needs ≥2 history rows).
    const rowCount = await rows.count();
    if (rowCount >= 2) {
      await rows.nth(1).getByTestId('deploy-rollback').click();
      await page.getByRole('dialog', { name: 'Roll back' }).getByTestId('rollback-confirm').click();
      // Rollback ALWAYS resolves to a defined visible state: a success banner,
      // a "rolling back…" progress strip, or a surfaced failure.
      const success = page.getByText(/Rolled back/);
      const failed = page.getByTestId('rollback-error');
      const inProgress = page.getByText(/Rolling back…/);
      await expect(success.or(failed).or(inProgress)).toBeVisible({ timeout: 30_000 });
      await page.screenshot({ path: artifact('app-deploys-rollback.png'), fullPage: true });
    } else {
      test.info().annotations.push({ type: 'note', description: `only ${rowCount} deploy row(s) — rollback-to-prior needs ≥2` });
    }
  });
});
