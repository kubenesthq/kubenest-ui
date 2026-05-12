import { expect, test } from '@playwright/test';

function isAppPatchResponse(url: string, method: string): boolean {
  if (method !== 'PATCH') return false;
  try {
    const parsed = new URL(url);
    return /^\/api\/v1\/apps\/[^/]+\/[^/]+$/.test(parsed.pathname) && parsed.searchParams.has('project_id');
  } catch {
    return false;
  }
}

test('app detail renders live status/logs, supports env patch, and labels monitoring stub', async ({ page }) => {
  await page.goto('/apps');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  const rows = page.locator('table tbody tr');
  const runningRow = rows.filter({ hasText: 'Running' }).first();
  const rowCount = await rows.count();
  if (rowCount > 0) {
    const runningCount = await runningRow.count();
    if (runningCount > 0) {
      await runningRow.click();
    } else {
      await rows.first().click();
    }
  } else {
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();

    const authHeaders = {
      Authorization: `Bearer ${token}`,
    };

    const projectsResponse = await page.request.get('/api/v1/projects?items_per_page=50', {
      headers: authHeaders,
    });
    expect(projectsResponse.ok()).toBeTruthy();
    const projectsBody = await projectsResponse.json();
    const firstProject = projectsBody?.data?.[0];
    expect(firstProject).toBeTruthy();

    const projectId = String(firstProject.id);
    const namespace = String(firstProject.namespace);
    const appName = `kn-u8-e2e-${Date.now()}`;
    const create = await page.request.post('/api/v1/apps', {
      headers: authHeaders,
      data: {
        name: appName,
        project_id: projectId,
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
    expect(create.ok()).toBeTruthy();
    await page.goto(`/apps/${namespace}/${appName}?project_id=${projectId}`);
  }

  await page.waitForURL(/\/apps\/[^/]+\/[^?]+\?project_id=/, { timeout: 30_000 });

  const statusRow = page.locator('[data-testid^="component-status-row-"]').first();
  await expect(statusRow).toBeVisible();

  await page.getByRole('tab', { name: 'Logs' }).click();
  const logsPane = page.getByTestId('component-log-lines');
  const componentSelectors = page.locator('[data-testid^="logs-component-"]');
  const selectorCount = await componentSelectors.count();
  if (selectorCount > 0) {
    const componentSelector = componentSelectors.first();
    await expect(componentSelector).toBeVisible();
    const componentName = (await componentSelector.textContent())?.trim() ?? '';
    expect(componentName.length).toBeGreaterThan(0);
    await expect(logsPane).toBeVisible();

    await expect
      .poll(async () => {
        const text = await logsPane.innerText();
        return text.includes(`[${componentName}]`) || text.includes('Waiting for log lines');
      }, {
        timeout: 45_000,
        intervals: [1000, 2000, 3000],
      })
      .toBeTruthy();
  } else {
    await expect(page.getByText(/No workload components - logs unavailable/i)).toBeVisible();
  }

  await page.getByRole('tab', { name: 'Env' }).click();
  const envComponentSelector = page.locator('[data-testid^="env-component-"]').first();
  await expect(envComponentSelector).toBeVisible();
  const envComponentName = (await envComponentSelector.textContent())?.trim() ?? '';
  expect(envComponentName.length).toBeGreaterThan(0);
  await envComponentSelector.click();

  const envKey = page.getByPlaceholder('KEY').first();
  const envValue = page.getByPlaceholder('value').first();
  await expect(envKey).toBeVisible();

  const uniqueKey = `KN_U8_E2E_${Date.now()}`;
  await envKey.fill(uniqueKey);
  await envValue.fill('enabled');

  const patchRequest = page.waitForRequest((request) =>
    isAppPatchResponse(request.url(), request.method()),
  );

  await page.locator(`[data-testid="env-save-${envComponentName}"]`).click();

  const request = await patchRequest;
  expect(request.method()).toBe('PATCH');

  await page.getByRole('tab', { name: 'Monitoring' }).click();
  await expect(page.getByText(/needs\s+kn-B11\/metrics/i)).toBeVisible();
});
