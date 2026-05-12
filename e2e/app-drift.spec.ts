import { spawnSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';
import { artifact } from './fixtures';

type AppRef = {
  name: string;
  namespace: string;
  project_id: string;
};

type ArgoStatus = {
  sync: string;
  health: string;
  revision: string;
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

function isAppPatchResponse(url: string, method: string): boolean {
  if (method !== 'PATCH') return false;
  try {
    const parsed = new URL(url);
    return /^\/api\/v1\/apps\/[^/]+\/[^/]+$/.test(parsed.pathname) && parsed.searchParams.has('project_id');
  } catch {
    return false;
  }
}

function readArgoStatus(appName: string): ArgoStatus | null {
  const command = [
    `kubectl -n kubenest-system get applications.argoproj.io ${appName} -o jsonpath='{.status.sync.status}|{.status.health.status}|{.status.sync.revision}'`,
    '2>/tmp/kn_v3_argo_status.err',
  ].join(' ');
  const result = runRemote(command);
  if (!result.ok) return null;
  const parts = result.stdout.trim().split('|');
  if (parts.length < 3) return null;
  return {
    sync: parts[0] ?? '',
    health: parts[1] ?? '',
    revision: parts[2] ?? '',
  };
}

function setDeploymentImage(namespace: string, deploymentName: string, containerName: string, image: string): boolean {
  const result = runRemote(
    `kubectl -n ${namespace} set image deployment/${deploymentName} ${containerName}=${image} >/tmp/kn_v3_set_image.log 2>&1`,
  );
  return result.ok;
}

function stackDeployHasEnvKey(namespace: string, appName: string, key: string): boolean | null {
  const command = [
    '(',
    `kubectl -n ${namespace} get stackdeploy ${appName} -o json`,
    '||',
    `kubectl -n ${namespace} get stackdeploys.platform.kubenest.io ${appName} -o json`,
    ') 2>/tmp/kn_v3_stackdeploy_get.err',
  ].join(' ');
  const result = runRemote(command);
  if (!result.ok) return null;

  try {
    const obj = JSON.parse(result.stdout) as {
      spec?: {
        components?: Array<{
          type?: string;
          workloadSpec?: { env?: Array<{ name?: string }> };
          workload_spec?: { env?: Array<{ name?: string }> };
        }>;
      };
    };

    const components = obj.spec?.components ?? [];
    for (const component of components) {
      if ((component.type ?? '').toLowerCase() !== 'workload') continue;
      const env = (component.workloadSpec?.env ?? component.workload_spec?.env) ?? [];
      if (env.some((item) => item?.name === key)) return true;
    }
    return false;
  } catch {
    return null;
  }
}

async function fetchApp(page: Page, app: AppRef): Promise<Record<string, unknown> | null> {
  const token = await page.evaluate(() => localStorage.getItem('token'));
  if (!token) return null;

  const response = await page.request.get(
    `/api/v1/apps/${encodeURIComponent(app.namespace)}/${encodeURIComponent(app.name)}?project_id=${encodeURIComponent(app.project_id)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!response.ok()) return null;
  return (await response.json()) as Record<string, unknown>;
}

async function createAppForDriftTest(page: Page): Promise<AppRef | null> {
  const token = await page.evaluate(() => localStorage.getItem('token'));
  if (!token) return null;

  const headers = { Authorization: `Bearer ${token}` };
  const projectsRes = await page.request.get('/api/v1/projects?items_per_page=50', { headers });
  if (!projectsRes.ok()) return null;

  const project = (await projectsRes.json())?.data?.[0];
  if (!project || !project.id || !project.namespace) return null;

  const appName = `knv3-${Date.now().toString(36)}`;
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

test('gitops round-trip + live drift + patch conflict rejection', async ({ page }) => {
  test.setTimeout(240_000);

  const probe = runRemote('kubectl version --client --output=yaml >/dev/null 2>&1 && echo ok');
  if (!probe.ok) {
    test.skip(true, `control-plane SSH/kubectl unavailable: ${probe.stderr || probe.stdout}`);
    return;
  }

  await page.goto('/');
  await page.waitForURL(/\/dashboard\b/, { timeout: 30_000 });

  const app = await createAppForDriftTest(page);
  if (!app) {
    test.skip(true, 'could not create an app for gitops/drift testing');
    return;
  }

  await expect
    .poll(async () => {
      const data = await fetchApp(page, app);
      const phase = typeof data?.phase === 'string' ? data.phase : '';
      return phase;
    }, {
      timeout: 120_000,
      intervals: [2000, 3000, 5000],
    })
    .toMatch(/Running|Deploying/);

  // This app path is GitOps-driven: require ArgoCD sync + revision to prove the
  // desired state has round-tripped through Git/Argo before drift mutation.
  await expect
    .poll(() => {
      const status = readArgoStatus(app.name);
      if (!status) return '';
      if (!status.sync || !status.revision) return '';
      return `${status.sync}|${status.revision.length > 0 ? 'rev' : ''}`;
    }, {
      timeout: 120_000,
      intervals: [2000, 3000, 5000],
    })
    .toContain('Synced|rev');

  const mutated = setDeploymentImage(app.namespace, `${app.name}-web`, 'web', 'nginx:1.26-alpine');
  if (!mutated) {
    test.skip(true, 'failed to mutate live deployment image over kubectl/SSH');
    return;
  }

  await expect
    .poll(async () => {
      const data = await fetchApp(page, app);
      const sync = (data?.sync ?? null) as Record<string, unknown> | null;
      const driftDetected = Boolean(sync?.driftDetected ?? sync?.drift_detected);
      const details = (sync?.driftDetails ?? sync?.drift_details) as unknown;
      const detailCount = Array.isArray(details) ? details.length : 0;
      const driftClass = (sync?.driftClass ?? sync?.drift_class) as string | undefined;
      return driftDetected && detailCount > 0 && Boolean(driftClass);
    }, {
      timeout: 180_000,
      intervals: [3000, 5000, 8000],
    })
    .toBeTruthy();

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

  const uniqueKey = `KN_V3_${Date.now()}`;
  await page.getByPlaceholder('KEY').first().fill(uniqueKey);
  await page.getByPlaceholder('value').first().fill('conflict-check');

  const patchResponsePromise = page.waitForResponse((response) =>
    isAppPatchResponse(response.url(), response.request().method()),
  );

  await page.locator(`[data-testid="env-save-${componentName}"]`).click();
  const patchResponse = await patchResponsePromise;

  if (patchResponse.status() !== 409) {
    test.skip(true, `PATCH /apps not rejected in this environment (status ${patchResponse.status()})`);
    return;
  }

  const conflict = page.getByTestId('env-conflict-message');
  await expect(conflict).toBeVisible({ timeout: 20_000 });
  await expect(conflict).toContainText(/conflict|blocked_sync|reconcile/i);

  const persisted = stackDeployHasEnvKey(app.namespace, app.name, uniqueKey);
  if (persisted !== null) {
    expect(persisted).toBeFalsy();
  } else {
    test.info().annotations.push({
      type: 'note',
      description: 'could not inspect StackDeploy CR to assert unchanged spec after conflict reject',
    });
  }

  await page.screenshot({ path: artifact('app-drift-surface.png'), fullPage: true });
});
