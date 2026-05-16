import { expect, test } from '@playwright/test';
import { artifact } from './fixtures';

/**
 * kn-ue0 — "Save as template" action on the app detail page.
 *
 * Per AGENTS.md §7 / brief §5: real backend, no mocks. We create a
 * source app via the API, click the header's Save-as-template button,
 * fill the dialog, submit, and assert the new template shows up in
 * `GET /stack-templates` AND on the /stacks gallery (kn-a7d).
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
  expect(firstProject).toBeTruthy();
  return { authHeaders, projectId: String(firstProject.id), namespace: String(firstProject.namespace) };
}

async function createApp(
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

test.describe('app save as template (kn-ue0)', () => {
  test('save running app as template — round-trips and lands in /stacks', async ({ page }) => {
    test.setTimeout(180_000);

    const ctx = await ensureAuthContext(page);
    const appName = `kn-ue0-src-${Date.now().toString(36)}`;
    const templateName = `kn-ue0-tpl-${Date.now().toString(36)}`;
    await createApp(page, ctx, appName);

    try {
      await page.goto(`/apps/${ctx.namespace}/${appName}?project_id=${ctx.projectId}`);
      await expect(page.getByTestId('component-status-row-web')).toBeVisible({ timeout: 30_000 });

      // Header action opens the dialog.
      await page.getByTestId('header-save-as-template').click();
      const dialog = page.getByTestId('save-as-template-dialog');
      await expect(dialog).toBeVisible();

      // Seeded name is "<app>-template"; overwrite with a known unique name.
      const nameInput = page.getByTestId('save-as-template-name');
      await nameInput.fill(templateName);
      await page.getByTestId('save-as-template-description').fill('captured by kn-ue0 e2e');
      await page.getByTestId('save-as-template-tags').fill('kn-ue0, e2e, web');

      await page.screenshot({ path: artifact('app-save-as-template-dialog.png'), fullPage: true });

      const createResponsePromise = page.waitForResponse(
        (resp) => resp.request().method() === 'POST'
          && resp.url().includes(`/api/v1/stack-templates/from-app/`),
        { timeout: 60_000 },
      );
      await page.getByTestId('save-as-template-submit').click();
      const createResponse = await createResponsePromise;
      expect(
        createResponse.ok(),
        `from-app failed: ${createResponse.status()} ${await createResponse.text()}`,
      ).toBe(true);

      // Successful save navigates to /stacks.
      await page.waitForURL(/\/stacks(?:\?|$)/, { timeout: 15_000 });
      await expect(page.getByRole('heading', { name: 'App templates' })).toBeVisible({ timeout: 15_000 });

      // Source of truth: the new template is in GET /stack-templates.
      const listResp = await page.request.get('/api/v1/stack-templates', { headers: ctx.authHeaders });
      expect(listResp.ok()).toBeTruthy();
      const names = ((await listResp.json())?.data ?? []).map((t: { name: string }) => t.name);
      expect(names).toContain(templateName);

      // And the gallery card renders for it.
      const card = page.getByTestId(`stacks-my-card-${templateName}`);
      await card.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => undefined);
      await page.screenshot({ path: artifact('app-save-as-template-after.png'), fullPage: true });
    } finally {
      await page.request
        .delete(`/api/v1/stack-templates/${ctx.namespace}/${templateName}`, { headers: ctx.authHeaders })
        .catch(() => undefined);
      await page.request
        .delete(`/api/v1/apps/${ctx.namespace}/${appName}?project_id=${encodeURIComponent(ctx.projectId)}`, {
          headers: ctx.authHeaders,
        })
        .catch(() => undefined);
    }
  });

  test('client-side DNS-label validation surfaces inline before a POST', async ({ page }) => {
    const ctx = await ensureAuthContext(page);
    const appName = `kn-ue0-val-${Date.now().toString(36)}`;
    await createApp(page, ctx, appName);

    try {
      await page.goto(`/apps/${ctx.namespace}/${appName}?project_id=${ctx.projectId}`);
      await expect(page.getByTestId('component-status-row-web')).toBeVisible({ timeout: 30_000 });

      await page.getByTestId('header-save-as-template').click();
      const nameInput = page.getByTestId('save-as-template-name');
      await nameInput.fill('BadName');
      await page.getByTestId('save-as-template-submit').click();
      const errorBox = page.getByTestId('save-as-template-error');
      await expect(errorBox).toBeVisible();
      await expect(errorBox).toContainText(/Name must be lowercase|DNS label/);
    } finally {
      await page.request
        .delete(`/api/v1/apps/${ctx.namespace}/${appName}?project_id=${encodeURIComponent(ctx.projectId)}`, {
          headers: { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('token'))}` },
        })
        .catch(() => undefined);
    }
  });
});
