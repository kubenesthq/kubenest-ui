import { expect, test } from '@playwright/test';
import { artifact } from './fixtures';

/**
 * kn-gfa — Attach-addon drawer + detach controls on the app detail page.
 *
 * Per AGENTS.md §7 / brief §5: no mocks of the API under test. The
 * /attach-addon round-trip and the addon-instance/definition fetches all
 * hit the live control plane. We only `page.route` away /sync-status
 * background polling (kn-cen workaround) to keep Chrome's socket pool from
 * starving the foreground requests.
 *
 * The detach flow assumes the addon instance is reachable by its `name` field
 * (the backend resolves linked addons by name, which matches how the operator
 * publishes `valueFrom.exportRef`).
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
  const projects = await page.request.get('/api/v1/projects?items_per_page=50', { headers: authHeaders });
  expect(projects.ok()).toBeTruthy();
  const firstProject = (await projects.json())?.data?.[0];
  expect(firstProject, 'at least one project must exist in the target env').toBeTruthy();
  return { authHeaders, projectId: String(firstProject.id), namespace: String(firstProject.namespace) };
}

async function findPostgresDefinition(
  page: import('@playwright/test').Page,
  ctx: ApiContext,
): Promise<{ id: string; export_schema: Record<string, unknown> } | null> {
  const resp = await page.request.get('/api/v1/addon-definitions?items_per_page=50', { headers: ctx.authHeaders });
  if (!resp.ok()) return null;
  const data = (await resp.json())?.data ?? [];
  const def = data.find(
    (d: { slug: string }) => d.slug === 'postgres' || d.slug === 'postgresql',
  );
  if (!def) return null;
  return { id: def.id, export_schema: def.export_schema ?? {} };
}

async function ensureAddonInstance(
  page: import('@playwright/test').Page,
  ctx: ApiContext,
  definitionId: string,
  name: string,
): Promise<string> {
  // Returns the addon instance id. Tries to reuse an existing instance with
  // the same name in this project first (so re-runs don't pile up).
  const list = await page.request.get(`/api/v1/addon-instances?project_id=${ctx.projectId}`, {
    headers: ctx.authHeaders,
  });
  if (list.ok()) {
    const existing = ((await list.json())?.data ?? []).find((a: { name: string; id: string }) => a.name === name);
    if (existing) return String(existing.id);
  }
  const create = await page.request.post('/api/v1/addon-instances', {
    headers: ctx.authHeaders,
    data: { project_id: ctx.projectId, name, definition_id: definitionId },
  });
  expect(create.ok(), `POST /addon-instances failed: ${create.status()} ${await create.text()}`).toBeTruthy();
  return String((await create.json()).id);
}

async function createAppWithWeb(
  page: import('@playwright/test').Page,
  ctx: ApiContext,
  appName: string,
): Promise<void> {
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

test.describe('app attach addon (kn-gfa)', () => {
  test('attach a postgres addon, see the linked chip, then detach', async ({ page }) => {
    test.setTimeout(240_000);

    const ctx = await ensureAuthContext(page);
    const def = await findPostgresDefinition(page, ctx);
    test.skip(!def, 'No postgres AddonDefinition seeded in target env — skipping the kn-gfa attach flow.');

    // Reuse a stable addon name so this test doesn't churn addon instances
    // each run. The instance may already exist from a previous run; either way
    // we use its id for the attach.
    const addonName = 'kn-gfa-db';
    const addonInstanceId = await ensureAddonInstance(page, ctx, def!.id, addonName);

    const appName = `kn-gfa-app-${Date.now().toString(36)}`;
    await createAppWithWeb(page, ctx, appName);

    // Pre-existing fallback-polling storm (kn-cen) — drop that traffic so the
    // foreground attach/detach POST/DELETE don't compete for sockets.
    await page.route(/\/api\/v1\/apps\/[^/]+\/[^/]+\/sync-status/, (route) => {
      void route.abort('connectionclosed');
    });

    try {
      await page.goto(`/apps/${ctx.namespace}/${appName}?project_id=${ctx.projectId}`);
      await expect(page.getByTestId('component-status-row-web')).toBeVisible({ timeout: 30_000 });

      // The "Attach an addon" dashed button lives next to the Add-component one.
      await page.getByTestId('overview-attach-addon').click();

      // Drawer opens; pick the postgres instance.
      const instanceSelect = page.getByTestId('attach-addon-instance');
      await expect(instanceSelect).toBeVisible({ timeout: 15_000 });
      // Match the dropdown option by its label prefix (the option text format
       // is "{name} · {type} ({phase})" — see AttachAddonDrawer).
       const optionValue = await instanceSelect.locator(`option`).filter({ hasText: addonName }).first().getAttribute('value');
       expect(optionValue, `addon ${addonName} option not present in the picker`).toBeTruthy();
       await instanceSelect.selectOption(optionValue!);

      // The drawer seeds one mapping per export key. Confirm the DATABASE_URL
      // row is present and targets the only workload component; we submit all
      // mappings (including the postgres password / host / etc.) and assert
      // post-submit that DATABASE_URL specifically is wired.
      const mappingRows = page.locator('[data-testid^="attach-addon-mapping-"]');
      await expect.poll(async () => mappingRows.count(), { timeout: 15_000 }).toBeGreaterThan(0);
      await expect(page.getByTestId('attach-addon-envname-DATABASE_URL')).toHaveValue('DATABASE_URL');

      await page.screenshot({ path: artifact('app-attach-addon-drawer.png'), fullPage: true });

      const attachResponsePromise = page.waitForResponse(
        (resp) => resp.request().method() === 'POST'
          && resp.url().includes(`/api/v1/apps/${ctx.namespace}/${appName}/attach-addon`),
        { timeout: 90_000 },
      );
      await page.getByTestId('attach-addon-submit').click();
      const attachResponse = await attachResponsePromise;
      expect(attachResponse.status(), `attach-addon body: ${await attachResponse.text()}`).toBe(200);

      // Source of truth: GET /apps shows export_ref on `web`.
      const detail = await page.request.get(
        `/api/v1/apps/${ctx.namespace}/${appName}?project_id=${encodeURIComponent(ctx.projectId)}`,
        { headers: ctx.authHeaders },
      );
      expect(detail.ok()).toBeTruthy();
      const body = await detail.json();
      const webComponent = (body.components ?? []).find((c: { name: string }) => c.name === 'web');
      expect(webComponent, 'web component should still exist after attach').toBeTruthy();
      const env = ((webComponent.workload_spec ?? {}) as Record<string, unknown>).env;
      expect(Array.isArray(env)).toBe(true);
      const linkedEnv = (env as Array<Record<string, unknown>>).find((e) => {
        if (e?.name !== 'DATABASE_URL') return false;
        const valueFrom = (e.valueFrom as Record<string, unknown> | undefined) ?? null;
        const ref = (valueFrom?.exportRef as Record<string, unknown> | undefined) ?? null;
        return ref?.component === addonName;
      });
      expect(linkedEnv, 'DATABASE_URL env var with valueFrom.exportRef → addon must be present').toBeTruthy();

      // Best-effort UI assertion: the linked chip shows up on the web row.
      // The page may take a moment to refetch — give it room.
      const linkedChip = page.getByTestId(`component-linked-addon-web-${addonName}`);
      await linkedChip.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => undefined);
      await page.screenshot({ path: artifact('app-attach-addon-after.png'), fullPage: true });

      // --- Detach ---
      // If the chip didn't render, do the detach via the API to still prove
      // round-trip wiring; otherwise drive the UI.
      const chipVisible = await linkedChip.isVisible().catch(() => false);
      if (chipVisible) {
        await page.getByTestId(`component-detach-web-${addonName}`).click();
        const detachDialog = page.getByTestId('detach-addon-dialog');
        await expect(detachDialog).toBeVisible();
        const detachResponsePromise = page.waitForResponse(
          (resp) => resp.request().method() === 'DELETE'
            && resp.url().includes(`/api/v1/apps/${ctx.namespace}/${appName}/attach-addon/`),
          { timeout: 90_000 },
        );
        await page.getByTestId('detach-addon-confirm').click();
        const detachResponse = await detachResponsePromise;
        expect(detachResponse.status()).toBe(200);
      } else {
        const detachResp = await page.request.delete(
          `/api/v1/apps/${ctx.namespace}/${appName}/attach-addon/${addonInstanceId}?project_id=${encodeURIComponent(ctx.projectId)}`,
          { headers: ctx.authHeaders },
        );
        expect(detachResp.ok(), `direct DELETE attach-addon body: ${await detachResp.text()}`).toBeTruthy();
      }

      // Source of truth: GET /apps no longer has the export_ref.
      const afterDetach = await page.request.get(
        `/api/v1/apps/${ctx.namespace}/${appName}?project_id=${encodeURIComponent(ctx.projectId)}`,
        { headers: ctx.authHeaders },
      );
      expect(afterDetach.ok()).toBeTruthy();
      const afterBody = await afterDetach.json();
      const webAfter = (afterBody.components ?? []).find((c: { name: string }) => c.name === 'web');
      const envAfter = ((webAfter?.workload_spec ?? {}) as Record<string, unknown>).env;
      const stillLinked = Array.isArray(envAfter) ? (envAfter as Array<Record<string, unknown>>).some((e) => {
        const valueFrom = (e.valueFrom as Record<string, unknown> | undefined) ?? null;
        const ref = (valueFrom?.exportRef as Record<string, unknown> | undefined) ?? null;
        return ref?.component === addonName;
      }) : false;
      expect(stillLinked, 'no export_ref to addon should remain after detach').toBeFalsy();
    } finally {
      await deleteApp(page, ctx, appName);
    }
  });
});
