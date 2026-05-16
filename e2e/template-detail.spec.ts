import { expect, test } from '@playwright/test';
import { artifact } from './fixtures';

/**
 * kn-epw — /stacks/[ns]/[name] template detail page smoke.
 *
 * Per AGENTS.md §7 / brief §5: real backend, no mocks. We seed a known
 * template via POST /stack-templates/from-app, navigate to its detail
 * page, assert the header / components / parameters render, and assert
 * the Deploy CTA links to /stacks/deploy with the right query. We also
 * assert the 404 path.
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

async function seedTemplateFromApp(
  page: import('@playwright/test').Page,
  ctx: ApiContext,
  templateName: string,
): Promise<{ srcApp: string; templateNamespace: string }> {
  const srcApp = `${templateName}-src`;
  const createApp = await page.request.post('/api/v1/apps', {
    headers: ctx.authHeaders,
    data: {
      name: srcApp,
      project_id: ctx.projectId,
      components: [{
        name: 'web', type: 'workload',
        workload_spec: { image: 'nginx:1.27-alpine', replicas: 1, port: 8080 },
      }],
    },
  });
  expect(createApp.ok(), `seed app failed: ${createApp.status()} ${await createApp.text()}`).toBeTruthy();

  const createTpl = await page.request.post(
    `/api/v1/stack-templates/from-app/${encodeURIComponent(ctx.namespace)}/${encodeURIComponent(srcApp)}?project_id=${encodeURIComponent(ctx.projectId)}`,
    {
      headers: ctx.authHeaders,
      data: {
        name: templateName,
        description: 'seeded by kn-epw e2e',
        version: '1.0.0',
        scope: 'project',
        tags: ['kn-epw', 'e2e'],
      },
    },
  );
  expect(createTpl.ok(), `from-app failed: ${createTpl.status()} ${await createTpl.text()}`).toBeTruthy();
  const body = await createTpl.json();
  return { srcApp, templateNamespace: String(body.namespace) };
}

test.describe('template detail page (kn-epw)', () => {
  test('renders metadata, components, parameters, and a working Deploy CTA', async ({ page }) => {
    test.setTimeout(180_000);

    const ctx = await ensureAuthContext(page);
    const templateName = `kn-epw-${Date.now().toString(36)}`;
    const { srcApp, templateNamespace } = await seedTemplateFromApp(page, ctx, templateName);

    try {
      await page.goto(`/stacks/${templateNamespace}/${templateName}`);
      await expect(page.getByRole('heading', { name: templateName })).toBeVisible({ timeout: 30_000 });

      // Metadata
      await expect(page.getByText('seeded by kn-epw e2e')).toBeVisible();
      await expect(page.getByTestId('template-detail-tag-kn-epw')).toBeVisible();
      await expect(page.getByTestId('template-detail-tag-e2e')).toBeVisible();

      // Components: the from-app capture preserved a `web` workload row.
      const componentsCard = page.getByTestId('template-detail-components');
      await expect(componentsCard).toBeVisible();
      await expect(page.getByTestId('template-detail-component-web')).toBeVisible();
      await expect(componentsCard).toContainText('nginx:1.27-alpine');

      // Parameters: the seeded app has none, so the empty-state copy shows.
      const parametersCard = page.getByTestId('template-detail-parameters');
      await expect(parametersCard).toBeVisible();
      await expect(parametersCard).toContainText(/No parameters/);

      await page.screenshot({ path: artifact('template-detail.png'), fullPage: true });

      // Deploy CTA links to /stacks/deploy with ns + name.
      const deployLink = page.getByTestId('template-detail-deploy');
      await expect(deployLink).toBeVisible();
      // The button is inside a Link — assert the parent <a> href.
      const href = await deployLink.locator('xpath=ancestor::a').getAttribute('href');
      expect(href).toContain(`/stacks/deploy?ns=${encodeURIComponent(templateNamespace)}`);
      expect(href).toContain(`name=${encodeURIComponent(templateName)}`);
    } finally {
      await page.request
        .delete(`/api/v1/stack-templates/${templateNamespace}/${templateName}`, { headers: ctx.authHeaders })
        .catch(() => undefined);
      await page.request
        .delete(`/api/v1/apps/${ctx.namespace}/${srcApp}?project_id=${encodeURIComponent(ctx.projectId)}`, {
          headers: ctx.authHeaders,
        })
        .catch(() => undefined);
    }
  });

  test('renders a 404 card with a back link for an unknown template', async ({ page }) => {
    await page.goto(`/stacks/kubenest-system/this-template-does-not-exist-${Date.now().toString(36)}`);
    await expect(page.getByTestId('template-not-found')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Template not found/)).toBeVisible();
    await expect(page.getByRole('link', { name: /Templates/ })).toBeVisible();
  });
});
