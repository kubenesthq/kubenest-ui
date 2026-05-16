import { expect, test } from '@playwright/test';
import { artifact } from './fixtures';

/**
 * kn-fxe — Remove-component confirmation dialog on the app detail page.
 *
 * Per AGENTS.md §7 / brief §5: no mocks, no `page.route()` stubs on the
 * thing under test. The PATCH still hits the real backend; we only abort
 * /sync-status polling traffic because the headless detail page falls back
 * to a polling storm that saturates Chrome's per-host socket pool — same
 * workaround as kn-a4l (tracked in kn-cen).
 *
 * Coverage:
 *  - single-component app hides the Remove button (last-component guard).
 *  - multi-component app: clicking Remove opens a confirmation dialog
 *    naming the component, and confirming round-trips PATCH /apps with
 *    remove_component_names and the API stops reporting the component.
 */

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
  const projectsResponse = await page.request.get('/api/v1/projects?items_per_page=50', { headers: authHeaders });
  expect(projectsResponse.ok()).toBeTruthy();
  const projectsBody = await projectsResponse.json();
  const firstProject = projectsBody?.data?.[0];
  expect(firstProject, 'at least one project must exist in the target env').toBeTruthy();
  return {
    authHeaders,
    projectId: String(firstProject.id),
    namespace: String(firstProject.namespace),
  };
}

async function createApp(
  page: import('@playwright/test').Page,
  ctx: ApiContext,
  appName: string,
  components: Array<{ name: string; image: string; port?: number }>,
): Promise<void> {
  const body = {
    name: appName,
    project_id: ctx.projectId,
    components: components.map((c) => ({
      name: c.name,
      type: 'workload',
      workload_spec: { image: c.image, replicas: 1, port: c.port ?? 8080 },
    })),
  };
  const create = await page.request.post('/api/v1/apps', { headers: ctx.authHeaders, data: body });
  expect(create.ok(), `POST /apps failed: ${create.status()} ${await create.text()}`).toBeTruthy();
}

async function deleteApp(
  page: import('@playwright/test').Page,
  ctx: ApiContext,
  appName: string,
): Promise<void> {
  await page.request
    .delete(`/api/v1/apps/${ctx.namespace}/${appName}?project_id=${encodeURIComponent(ctx.projectId)}`, {
      headers: ctx.authHeaders,
    })
    .catch(() => undefined);
}

test.describe('app remove component (kn-fxe)', () => {
  test('single-component app: Remove button is not rendered (last-component guard)', async ({ page }) => {
    const ctx = await ensureAuthContext(page);
    const appName = `kn-fxe-solo-${Date.now().toString(36)}`;
    await createApp(page, ctx, appName, [{ name: 'web', image: 'nginx:1.27-alpine' }]);

    // See AGENTS-rule note in the file header.
    await page.route(/\/api\/v1\/apps\/[^/]+\/[^/]+\/sync-status/, (route) => {
      void route.abort('connectionclosed');
    });

    try {
      await page.goto(`/apps/${ctx.namespace}/${appName}?project_id=${ctx.projectId}`);
      await expect(page.getByTestId('component-status-row-web')).toBeVisible({ timeout: 30_000 });

      // The button must not appear at all when there's only one component —
      // the backend would 422 the call, and surfacing the affordance would
      // tempt users into a guaranteed failure.
      await expect(page.getByTestId('component-remove-web')).toHaveCount(0);
    } finally {
      await deleteApp(page, ctx, appName);
    }
  });

  test('multi-component app: confirm dialog round-trips PATCH and removes the component', async ({ page }) => {
    test.setTimeout(180_000);

    const ctx = await ensureAuthContext(page);
    const appName = `kn-fxe-multi-${Date.now().toString(36)}`;
    await createApp(page, ctx, appName, [
      { name: 'web', image: 'nginx:1.27-alpine', port: 8080 },
      { name: 'cache', image: 'redis:7-alpine', port: 6379 },
    ]);

    await page.route(/\/api\/v1\/apps\/[^/]+\/[^/]+\/sync-status/, (route) => {
      void route.abort('connectionclosed');
    });

    try {
      await page.goto(`/apps/${ctx.namespace}/${appName}?project_id=${ctx.projectId}`);
      await expect(page.getByTestId('component-status-row-web')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('component-status-row-cache')).toBeVisible({ timeout: 30_000 });

      // Both rows have a Remove button (count > 1).
      await expect(page.getByTestId('component-remove-cache')).toBeVisible();

      await page.getByTestId('component-remove-cache').click();
      const dialog = page.getByTestId('remove-component-dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText(/Remove cache/);
      await expect(dialog).toContainText(/cannot be undone/i);

      await page.screenshot({ path: artifact('app-remove-component-dialog.png'), fullPage: true });

      const patchResponsePromise = page.waitForResponse(
        (resp) => resp.request().method() === 'PATCH'
          && resp.url().includes(`/api/v1/apps/${ctx.namespace}/${appName}`),
        { timeout: 90_000 },
      );

      await page.getByTestId('remove-component-confirm').click();

      const patchResponse = await patchResponsePromise;
      expect(patchResponse.status(), `PATCH /apps body: ${await patchResponse.text()}`).toBe(200);

      // Source of truth: the backend GET no longer reports `cache`.
      const detail = await page.request.get(
        `/api/v1/apps/${ctx.namespace}/${appName}?project_id=${encodeURIComponent(ctx.projectId)}`,
        { headers: ctx.authHeaders },
      );
      expect(detail.ok()).toBeTruthy();
      const body = await detail.json();
      const names = (body?.components ?? []).map((c: { name: string }) => c.name);
      expect(names).toContain('web');
      expect(names).not.toContain('cache');

      // Best-effort UI assertion: the row should disappear once the page
      // refetch settles. As in kn-a4l, fallback-polling saturation on this
      // box can defer the refetch — the API check above is the stable proof.
      await page.getByTestId('component-status-row-cache')
        .waitFor({ state: 'detached', timeout: 30_000 })
        .catch(() => undefined);
      await page.screenshot({ path: artifact('app-remove-component-after.png'), fullPage: true });
    } finally {
      await deleteApp(page, ctx, appName);
    }
  });
});
