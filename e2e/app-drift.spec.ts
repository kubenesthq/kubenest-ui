import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';
import { artifact } from './fixtures';

type AppRef = {
  name: string;
  namespace: string;
  project_id: string;
};

const CONTROL_PLANE_SSH_HOST = process.env.E2E_CONTROL_PLANE_SSH_HOST ?? 'root@159.89.162.99';
const CONTROL_PLANE_SSH_KEY = process.env.E2E_CONTROL_PLANE_SSH_KEY ?? `${process.env.HOME}/.ssh/podman-machine-default`;

function runRemote(command: string): { ok: boolean; stdout: string; stderr: string } {
  const result = spawnSync('ssh', ['-i', CONTROL_PLANE_SSH_KEY, CONTROL_PLANE_SSH_HOST, command], {
    encoding: 'utf8',
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function patchAppSync(namespace: string, appName: string, syncBlock: Record<string, unknown>): boolean {
  const payload = JSON.stringify({ status: { sync: syncBlock } });
  const b64 = Buffer.from(payload, 'utf8').toString('base64');

  const command = [
    `payload="$(echo ${b64} | base64 -d)"`,
    '(',
    `kubectl -n ${namespace} patch stackdeploy ${appName} --type merge --subresource=status -p "$payload"`,
    '||',
    `kubectl -n ${namespace} patch stackdeploys.platform.kubenest.io ${appName} --type merge --subresource=status -p "$payload"`,
    ') >/tmp/kn_u10_patch.log 2>&1',
  ].join(' ');

  const result = runRemote(command);
  return result.ok;
}

async function createAppForDriftTest(page: Page): Promise<AppRef | null> {
  const token = await page.evaluate(() => localStorage.getItem('token'));
  if (!token) return null;

  const headers = { Authorization: `Bearer ${token}` };
  const projectsRes = await page.request.get('/api/v1/projects?items_per_page=50', { headers });
  if (!projectsRes.ok()) return null;

  const project = (await projectsRes.json())?.data?.[0];
  if (!project) return null;

  const appName = `knu10-${Date.now().toString(36)}`;
  const createRes = await page.request.post('/api/v1/apps', {
    headers,
    data: {
      name: appName,
      project_id: String(project.id),
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

  if (!createRes.ok()) return null;

  return {
    name: appName,
    namespace: String(project.namespace),
    project_id: String(project.id),
  };
}

test('drift badge/panel renders and conflicting PATCH shows a clear message', async ({ page }) => {
  const probe = runRemote('kubectl version --client --output=yaml >/dev/null 2>&1 && echo ok');
  if (!probe.ok) {
    test.skip(true, `control-plane SSH/kubectl unavailable: ${probe.stderr || probe.stdout}`);
    return;
  }

  await page.goto('/');
  await page.waitForURL(/\/dashboard\b/, { timeout: 30_000 });

  const app = await createAppForDriftTest(page);
  if (!app) {
    test.skip(true, 'could not create an app for drift testing');
    return;
  }

  const blockedSync = {
    desired: 'Synced',
    observed: 'OutOfSync',
    driftDetected: true,
    driftClass: 'blocked_sync',
    driftDetails: [
      {
        resource: `Deployment/${app.name}-web`,
        field: 'spec.template.spec.containers[0].image',
        desired: 'nginx:1.27-alpine',
        observed: 'nginx:1.26-alpine',
        blocked: true,
        reason: 'manual cluster edit diverged from git source',
      },
    ],
    syncSource: 'gitops',
  };

  const patched = patchAppSync(app.namespace, app.name, blockedSync);
  if (!patched) {
    test.skip(true, 'unable to mutate StackDeploy sync state over kubectl/SSH');
    return;
  }

  await page.goto(`/apps/${app.namespace}/${app.name}?project_id=${app.project_id}`);
  await page.waitForURL(/\/apps\/[^/]+\/[^?]+\?project_id=/, { timeout: 30_000 });

  await expect(page.getByTestId('app-drift-badge')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('drift-surface')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('drift-detail-row').first()).toBeVisible({ timeout: 30_000 });

  await page.getByRole('tab', { name: 'Env' }).click();
  const componentSelector = page.locator('[data-testid^="env-component-"]').first();
  await expect(componentSelector).toBeVisible();
  const componentName = (await componentSelector.textContent())?.trim() ?? '';
  expect(componentName.length).toBeGreaterThan(0);

  await page.getByPlaceholder('KEY').first().fill(`KN_U10_${Date.now()}`);
  await page.getByPlaceholder('value').first().fill('conflict-check');
  await page.locator(`[data-testid="env-save-${componentName}"]`).click();

  const conflict = page.getByTestId('env-conflict-message');
  await expect(conflict).toBeVisible({ timeout: 20_000 });
  await expect(conflict).toContainText(/conflict|blocked_sync|reconcile/i);

  await page.screenshot({ path: artifact('app-drift-surface.png'), fullPage: true });
});
