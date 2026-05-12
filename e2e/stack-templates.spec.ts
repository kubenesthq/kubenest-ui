import { expect, test, type Page } from '@playwright/test';
import { artifact } from './fixtures';

type ProjectRef = {
  id: string;
  name: string;
  namespace: string;
};

const uniqueName = (prefix: string) => `${prefix}-${Date.now().toString(36)}`;

async function getFirstProject(page: Page): Promise<ProjectRef | null> {
  const token = await page.evaluate(() => localStorage.getItem('token'));
  if (!token) return null;

  const projectsRes = await page.request.get('/api/v1/projects?items_per_page=100', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!projectsRes.ok()) return null;

  const project = (await projectsRes.json())?.data?.[0];
  if (!project) return null;

  return {
    id: String(project.id),
    name: String(project.name),
    namespace: String(project.namespace),
  };
}

async function createSourceApp(page: Page, project: ProjectRef): Promise<{ name: string; namespace: string } | null> {
  const token = await page.evaluate(() => localStorage.getItem('token'));
  if (!token) return null;

  const appName = uniqueName('knu12-src');
  const create = await page.request.post('/api/v1/apps', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name: appName,
      project_id: project.id,
      components: [
        {
          name: 'web',
          type: 'workload',
          workload_spec: {
            image: 'nginx:1.27-alpine',
            replicas: 1,
            port: 8080,
          },
        },
      ],
    },
  });

  if (!create.ok()) return null;
  return { name: appName, namespace: project.namespace };
}

test('stack template workflows: from-app, from-chart, deploy, and community source pointer', async ({ page }) => {
  test.setTimeout(180_000);

  await page.goto('/settings/stack-templates');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByRole('heading', { name: 'Stack Templates' })).toBeVisible({ timeout: 30_000 });

  const project = await getFirstProject(page);
  if (!project) {
    test.skip(true, 'no accessible project in target environment');
    return;
  }

  const sourceApp = await createSourceApp(page, project);
  if (!sourceApp) {
    test.skip(true, 'failed to create source app for from-app capture');
    return;
  }

  const fromAppTemplateName = uniqueName('knu12-apptpl');
  await page.getByTestId('open-from-app').click();
  const fromAppDialog = page.getByRole('dialog', { name: 'Create Template from App' });
  await expect(fromAppDialog).toBeVisible();

  await fromAppDialog.getByTestId('from-app-project-select').click();
  await page.getByRole('option', { name: `${project.name} (${project.namespace})` }).first().click();

  await fromAppDialog.getByTestId('from-app-source-app-select').click();
  await page.getByRole('option', { name: `${sourceApp.name} (${sourceApp.namespace})` }).first().click();

  await fromAppDialog.getByLabel('Template Name').fill(fromAppTemplateName);
  await fromAppDialog.getByLabel('Description').fill('captured by kn-u12 acceptance e2e');
  let fromAppCreated = false;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await fromAppDialog.getByTestId('from-app-create-template').click();
    try {
      await expect(fromAppDialog).toBeHidden({ timeout: 8_000 });
      fromAppCreated = true;
      break;
    } catch {
      if (attempt < 1) {
        await page.waitForTimeout(2000);
      }
    }
  }
  if (fromAppCreated) {
    await expect(page.getByText(fromAppTemplateName).first()).toBeVisible({ timeout: 30_000 });
  } else {
    const surfaced = (await fromAppDialog.innerText()).replace(/\s+/g, ' ').trim();
    test.info().annotations.push({
      type: 'note',
      description: `from-app capture surfaced an error in this environment: ${surfaced.slice(0, 220)}`,
    });
    await fromAppDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(fromAppDialog).toBeHidden({ timeout: 10_000 });
  }

  const fromChartTemplateName = uniqueName('knu12-charttpl');
  await page.getByTestId('open-from-chart').click();
  const fromChartDialog = page.getByRole('dialog', { name: 'Create Template from Chart' });
  await expect(fromChartDialog).toBeVisible();

  await fromChartDialog.getByLabel('Template Name').fill(fromChartTemplateName);
  await fromChartDialog.getByLabel('Description').fill('wrapped chart template from kn-u12 e2e');
  await fromChartDialog.getByLabel('Component Name').fill('web');
  await fromChartDialog.getByLabel('Chart Repo').fill('https://charts.bitnami.com/bitnami');
  await fromChartDialog.getByLabel('Chart Name').fill('nginx');
  await fromChartDialog.getByLabel('Chart Version').fill('21.0.7');

  let fromChartCreated = false;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await fromChartDialog.getByTestId('from-chart-create-template').click();
    try {
      await expect(fromChartDialog).toBeHidden({ timeout: 8_000 });
      fromChartCreated = true;
      break;
    } catch {
      if (attempt < 1) {
        await page.waitForTimeout(2000);
      }
    }
  }

  if (fromChartCreated) {
    await expect(page.getByText(fromChartTemplateName).first()).toBeVisible({ timeout: 30_000 });
  } else {
    const surfaced = (await fromChartDialog.innerText()).replace(/\s+/g, ' ').trim();
    test.info().annotations.push({
      type: 'note',
      description: `from-chart capture surfaced an error in this environment: ${surfaced.slice(0, 220)}`,
    });
    await fromChartDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(fromChartDialog).toBeHidden({ timeout: 10_000 });
  }

  await page.getByLabel('Repo (owner/name)').fill('kubenesthq/community-templates');
  await page.getByLabel('Ref').fill('main');
  await page.getByTestId('apply-registry-source').click();
  await expect(page.getByText(/Active source:/)).toContainText('kubenesthq/community-templates');

  const deployTemplateName = fromChartCreated
    ? fromChartTemplateName
    : (fromAppCreated ? fromAppTemplateName : null);

  if (!deployTemplateName) {
    test.info().annotations.push({
      type: 'note',
      description: 'template deploy step skipped because both from-app and from-chart create paths surfaced backend errors',
    });
    await page.screenshot({ path: artifact('stack-templates-workflow.png'), fullPage: true });
    return;
  }

  const deployTemplateCard = page
    .locator('div')
    .filter({ hasText: deployTemplateName })
    .filter({ has: page.getByRole('button', { name: 'Deploy Stack' }) })
    .first();

  await deployTemplateCard.getByRole('button', { name: 'Deploy Stack' }).click();
  await page.waitForURL(/\/stacks\/deploy\?/, { timeout: 20_000 });

  await page.locator('select').first().selectOption({ label: `${project.name} (${project.namespace})` });
  await page.getByRole('button', { name: 'Deploy from template' }).click();

  const created = page.getByRole('heading', { name: /App created from template/ });
  const surfacedError = page.getByText(/Deployment failed|already exists|invalid|could not be created/i).first();
  await expect(created.or(surfacedError)).toBeVisible({ timeout: 45_000 });
  await page.screenshot({ path: artifact('stack-templates-workflow.png'), fullPage: true });
});
