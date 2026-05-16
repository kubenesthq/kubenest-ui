import { expect, test } from '@playwright/test';

/**
 * kn-cen regression — the app detail page used to fire /sync-status in a
 * render-loop whenever SSE didn't establish, exhausting Chrome's per-host
 * socket pool (ERR_INSUFFICIENT_RESOURCES) and starving foreground PATCHes
 * (caught in the original kn-a4l e2e).
 *
 * This spec is the canary: it loads the app detail page WITHOUT the
 * `page.route /sync-status -> abort` workaround that kn-a4l / kn-fxe /
 * kn-gfa applied, and asserts the page makes a bounded number of
 * /sync-status calls in the first ~20 seconds. If the storm regresses,
 * the count will balloon into the dozens — exactly the failure mode we
 * fixed.
 *
 * Budget: the page is allowed one initial poll + one fallback-interval
 * tick per 15-second polling cadence. Within ~20 seconds we expect at
 * most ~3 calls (initial + maybe a 15s tick + the 5s clock tick can't
 * trigger one). Set the ceiling generously at 10 so transient retries
 * don't flake the test, but well below the storm regime (which produced
 * 50+ calls per second).
 */

const MAX_SYNC_STATUS_CALLS_IN_20S = 10;

interface ApiContext {
  authHeaders: Record<string, string>;
  projectId: string;
  namespace: string;
}

async function ensureAuthContext(page: import('@playwright/test').Page): Promise<ApiContext> {
  await page.goto('/dashboard');
  await page.waitForLoadState('domcontentloaded');
  const token = await page.evaluate(() => localStorage.getItem('token'));
  expect(token, 'auth setup project must populate localStorage.token').toBeTruthy();
  const authHeaders = { Authorization: `Bearer ${token}` };
  const projects = await page.request.get('/api/v1/projects?items_per_page=50', { headers: authHeaders });
  expect(projects.ok()).toBeTruthy();
  const firstProject = (await projects.json())?.data?.[0];
  expect(firstProject).toBeTruthy();
  return { authHeaders, projectId: String(firstProject.id), namespace: String(firstProject.namespace) };
}

test('app detail page does not storm /sync-status when SSE is flaky (kn-cen regression)', async ({ page }) => {
  test.setTimeout(90_000);
  const ctx = await ensureAuthContext(page);
  const appName = `kn-cen-${Date.now().toString(36)}`;
  const create = await page.request.post('/api/v1/apps', {
    headers: ctx.authHeaders,
    data: {
      name: appName, project_id: ctx.projectId,
      components: [{
        name: 'web', type: 'workload',
        workload_spec: { image: 'nginx:1.27-alpine', replicas: 1, port: 8080 },
      }],
    },
  });
  expect(create.ok(), `POST /apps failed: ${create.status()} ${await create.text()}`).toBeTruthy();

  try {
    let syncStatusCalls = 0;
    page.on('request', (req) => {
      if (
        req.url().includes(`/api/v1/apps/${ctx.namespace}/${appName}/sync-status`)
        && req.method() === 'POST'
      ) {
        syncStatusCalls++;
      }
    });

    await page.goto(`/apps/${ctx.namespace}/${appName}?project_id=${ctx.projectId}`);
    await expect(page.getByTestId('component-status-row-web')).toBeVisible({ timeout: 30_000 });

    // Sit on the page long enough for the initial poll + one fallback tick to
    // happen if SSE doesn't connect, but not long enough for a clean two-tick
    // fallback (15s + 15s = 30s).
    await page.waitForTimeout(20_000);

    // Acceptable: one initial poll + maybe one 15s fallback tick + retries.
    // Unacceptable: dozens or hundreds (the kn-cen storm regime).
    expect(
      syncStatusCalls,
      `Expected <= ${MAX_SYNC_STATUS_CALLS_IN_20S} /sync-status calls in 20s, saw ${syncStatusCalls}. `
      + `kn-cen render-loop polling may have regressed.`,
    ).toBeLessThanOrEqual(MAX_SYNC_STATUS_CALLS_IN_20S);
  } finally {
    await page.request
      .delete(`/api/v1/apps/${ctx.namespace}/${appName}?project_id=${encodeURIComponent(ctx.projectId)}`, {
        headers: ctx.authHeaders,
      })
      .catch(() => undefined);
  }
});
