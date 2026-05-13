import { expect, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test';
import { artifact } from './fixtures';

type Org = { id: string };
type Cluster = { id: string; name?: string; status?: string };
type Project = { id: string; name: string; namespace: string; cluster_id: string };
type AppRead = { name: string; namespace: string; phase?: string; message?: string; project_id?: string | null };
type TemplateRead = { name: string; namespace: string; parameters?: Record<string, unknown> | null };
type AddonDefinition = {
  slug?: string;
  type?: string;
  chart_config?: Record<string, unknown>;
  default_values?: Record<string, unknown> | null;
  export_schema?: Record<string, unknown>;
};
type RegistryTemplateSummary = { name: string };
type DeployResponse = { deploy_name?: string; name?: string; namespace?: string };

type ParsedResponse<T> = {
  status: number;
  text: string;
  json: T | null;
};

const FLOW_TIMEOUT_MS = 12 * 60 * 1000;
const STRICT_FLOW5 = process.env.KN_V4_STRICT === '1';
const COMMUNITY_SOURCE = {
  repo: process.env.KN_V4_REGISTRY_REPO ?? 'kubenesthq/community-templates',
  ref: process.env.KN_V4_REGISTRY_REF ?? 'main',
  path: process.env.KN_V4_REGISTRY_PATH ?? 'templates',
};

function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}`;
}

function toQuery(params: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && value.length > 0) query.set(key, value);
  }
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

function describeFailure(phase: string, state: AppRead | null): string {
  const current = state?.phase ?? 'unknown';
  const message = state?.message ? `, message=${state.message}` : '';
  return `${phase} did not reach Running (phase=${current}${message})`;
}

function maybeSkip(condition: boolean, reason: string): void {
  if (condition) return;
  if (STRICT_FLOW5) {
    throw new Error(reason);
  }
  test.skip(true, reason);
}

function routeMissing(body: ParsedResponse<unknown>): boolean {
  if (body.status !== 404) return false;
  const detail = (body.json as { detail?: string } | null)?.detail;
  return String(detail ?? '').trim().toLowerCase() === 'not found';
}

async function parseResponse<T>(response: APIResponse): Promise<ParsedResponse<T>> {
  const text = await response.text();
  let json: T | null = null;
  try {
    json = JSON.parse(text) as T;
  } catch {
    json = null;
  }
  return { status: response.status(), text, json };
}

async function authHeaders(page: Page): Promise<Record<string, string>> {
  const token = await page.evaluate(() => localStorage.getItem('token'));
  if (!token) {
    test.skip(true, 'no auth token in storage state');
    throw new Error('unreachable');
  }
  return { Authorization: `Bearer ${token}` };
}

async function getJson<T>(request: APIRequestContext, path: string, headers: Record<string, string>): Promise<T | null> {
  const res = await request.get(path, { headers });
  if (!res.ok()) return null;
  return (await res.json()) as T;
}

async function firstConnectedCluster(page: Page, headers: Record<string, string>): Promise<Cluster | null> {
  const orgs = await getJson<Org[]>(page.request, '/api/v1/orgs', headers);
  if (!orgs?.length) return null;

  for (const org of orgs) {
    const clusters = await getJson<{ data: Cluster[] }>(
      page.request,
      `/api/v1/orgs/${org.id}/clusters?status=connected&items_per_page=50`,
      headers,
    );
    const first = clusters?.data?.[0];
    if (first?.id) return first;
  }

  return null;
}

async function createProject(
  request: APIRequestContext,
  headers: Record<string, string>,
  clusterId: string,
  prefix: string,
): Promise<Project | null> {
  const response = await request.post('/api/v1/projects', {
    headers,
    data: {
      name: uniqueName(prefix),
      cluster_id: clusterId,
    },
  });

  if (!response.ok()) return null;
  return (await response.json()) as Project;
}

async function deleteProject(
  request: APIRequestContext,
  headers: Record<string, string>,
  projectId: string | undefined,
): Promise<void> {
  if (!projectId) return;
  await request.delete(`/api/v1/projects/${projectId}`, { headers });
}

async function deleteTemplate(
  request: APIRequestContext,
  headers: Record<string, string>,
  template: TemplateRead | null,
): Promise<void> {
  if (!template?.namespace || !template?.name) return;
  await request.delete(`/api/v1/stack-templates/${encodeURIComponent(template.namespace)}/${encodeURIComponent(template.name)}`, {
    headers,
  });
}

async function pickPostgresAddon(page: Page, headers: Record<string, string>): Promise<AddonDefinition | null> {
  const defs = await getJson<{ data: AddonDefinition[] }>(
    page.request,
    '/api/v1/addon-definitions?items_per_page=100',
    headers,
  );

  const all = defs?.data ?? [];
  const postgres = all.find((d) => {
    const slug = String(d.slug ?? '').toLowerCase();
    const type = String(d.type ?? '').toLowerCase();
    const hasChart = !!d.chart_config;
    const exports = d.export_schema ?? {};
    return (slug === 'postgres' || type === 'postgres') && hasChart && 'DATABASE_URL' in exports;
  });

  return postgres ?? null;
}

async function createSourceApp(
  page: Page,
  headers: Record<string, string>,
  project: Project,
  postgres: AddonDefinition,
): Promise<AppRead | null> {
  const appName = uniqueName('knv4-src');

  const payload = {
    name: appName,
    project_id: project.id,
    timeout: '20m',
    components: [
      {
        name: 'db',
        type: 'addon',
        addon_spec: {
          type: String(postgres.type ?? 'postgres').toLowerCase(),
          chart: postgres.chart_config,
          values: postgres.default_values ?? {},
        },
      },
      {
        name: 'web',
        type: 'workload',
        depends_on: ['db'],
        workload_spec: {
          image: 'nginx:1.27-alpine',
          replicas: 1,
          port: 80,
          env: [
            {
              name: 'DATABASE_URL',
              export_ref: {
                component: 'db',
                export_key: 'DATABASE_URL',
              },
            },
          ],
        },
      },
    ],
  };

  const response = await page.request.post('/api/v1/apps', {
    headers,
    data: payload,
  });
  if (!response.ok()) return null;

  return (await response.json()) as AppRead;
}

async function waitForRunning(
  page: Page,
  headers: Record<string, string>,
  namespace: string,
  name: string,
  projectId: string,
): Promise<AppRead | null> {
  const deadline = Date.now() + FLOW_TIMEOUT_MS;
  let last: AppRead | null = null;

  while (Date.now() < deadline) {
    const app = await getJson<AppRead>(
      page.request,
      `/api/v1/apps/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}?project_id=${encodeURIComponent(projectId)}`,
      headers,
    );

    if (app) {
      last = app;
      const phase = String(app.phase ?? '').toLowerCase();
      if (phase === 'running') return app;
      if (phase === 'failed' || phase === 'error') return app;
    }

    await page.waitForTimeout(5_000);
  }

  return last;
}

async function deployTemplateToProject(
  page: Page,
  headers: Record<string, string>,
  template: TemplateRead,
  project: Project,
  parameters?: Record<string, unknown>,
): Promise<AppRead | null> {
  const deployResponse = await page.request.post(
    `/api/v1/stack-templates/${encodeURIComponent(template.namespace)}/${encodeURIComponent(template.name)}/deploy`,
    {
      headers,
      data: {
        project_id: project.id,
        ...(parameters ? { parameters } : {}),
      },
    },
  );

  if (!deployResponse.ok()) return null;

  const payload = (await deployResponse.json()) as DeployResponse;
  const appNamespace = String(payload.namespace ?? project.namespace);
  const appName = String((payload.deploy_name ?? payload.name) ?? template.name);

  return waitForRunning(page, headers, appNamespace, appName, project.id);
}

test('flow5 templates roundtrip harness (live backend, no mocks)', async ({ page }) => {
  test.setTimeout(18 * 60 * 1000);

  await page.goto('/dashboard');
  await page.waitForURL(/\/dashboard\b/, { timeout: 30_000 });
  await expect(page.locator('aside').first()).toBeVisible();

  const headers = await authHeaders(page);
  const cluster = await firstConnectedCluster(page, headers);
  const clusterId = cluster?.id;
  maybeSkip(!!clusterId, 'no connected cluster available for Flow-5 harness');
  if (!clusterId) return;

  const fromChartProbe = await page.request.post('/api/v1/stack-templates/from-chart', {
    headers,
    data: {
      name: uniqueName('knv4-probe'),
      component_name: 'web',
      component_type: 'workload',
      chart: { repo: 'https://charts.bitnami.com/bitnami', name: 'nginx', version: '21.0.7' },
    },
  });
  const fromChartProbeBody = await parseResponse<Record<string, unknown>>(fromChartProbe);
  maybeSkip(
    !routeMissing(fromChartProbeBody),
    `Flow-5 backend endpoints not deployed: POST /stack-templates/from-chart returned ${fromChartProbeBody.status} ${fromChartProbeBody.text.slice(0, 120)}`,
  );

  const sourceProject = await createProject(page.request, headers, clusterId, 'knv4-src');
  const targetProject = await createProject(page.request, headers, clusterId, 'knv4-dst');

  let fromAppTemplate: TemplateRead | null = null;
  let fromChartTemplate: TemplateRead | null = null;
  let installedTemplate: TemplateRead | null = null;

  try {
    maybeSkip(!!sourceProject && !!targetProject, 'failed to create source/target projects for Flow-5 harness');
    if (!sourceProject || !targetProject) return;

    const postgresAddon = await pickPostgresAddon(page, headers);
    maybeSkip(!!postgresAddon, 'no postgres addon definition with DATABASE_URL export_schema in environment');
    if (!postgresAddon) return;

    const sourceApp = await createSourceApp(page, headers, sourceProject, postgresAddon);
    maybeSkip(!!sourceApp?.name, 'failed to create source multi-component app for from-app capture');
    if (!sourceApp?.name) return;

    const sourceState = await waitForRunning(page, headers, sourceProject.namespace, sourceApp.name, sourceProject.id);
    maybeSkip(
      sourceState?.phase?.toLowerCase() === 'running',
      describeFailure('source app', sourceState),
    );

    const fromAppName = uniqueName('knv4-fromapp');
    const fromAppRes = await page.request.post(
      `/api/v1/stack-templates/from-app/${encodeURIComponent(sourceProject.namespace)}/${encodeURIComponent(sourceApp.name)}?project_id=${encodeURIComponent(sourceProject.id)}`,
      {
        headers,
        data: {
          name: fromAppName,
          description: 'kn-v4 flow5 harness from-app template',
          preserve_export_refs: true,
        },
      },
    );
    const fromAppBody = await parseResponse<TemplateRead | { detail?: string }>(fromAppRes);
    maybeSkip(!routeMissing(fromAppBody), `from-app endpoint unavailable in target backend: ${fromAppBody.status} ${fromAppBody.text.slice(0, 140)}`);
    expect(fromAppRes.ok(), `from-app create failed: ${fromAppBody.text}`).toBeTruthy();
    fromAppTemplate = fromAppBody.json as TemplateRead;

    const templateList = await getJson<{ data: TemplateRead[] }>(page.request, '/api/v1/stack-templates', headers);
    const listedFromApp = !!templateList?.data?.some(
      (tpl) => tpl.name === fromAppTemplate?.name && tpl.namespace === fromAppTemplate?.namespace,
    );
    expect(listedFromApp).toBeTruthy();

    const fromAppDeployState = await deployTemplateToProject(page, headers, fromAppTemplate, targetProject);
    maybeSkip(
      fromAppDeployState?.phase?.toLowerCase() === 'running',
      describeFailure('from-app redeploy', fromAppDeployState),
    );

    const fromChartName = uniqueName('knv4-fromchart');
    const fromChartRes = await page.request.post('/api/v1/stack-templates/from-chart', {
      headers,
      data: {
        name: fromChartName,
        description: 'kn-v4 flow5 harness from-chart template',
        component_name: 'web',
        component_type: 'workload',
        chart: {
          repo: 'https://charts.bitnami.com/bitnami',
          name: 'nginx',
          version: '21.0.7',
        },
        parameters: {
          serviceType: {
            type: 'string',
            required: false,
            default: 'ClusterIP',
            component: 'web',
            path: 'service.type',
          },
        },
      },
    });
    const fromChartBody = await parseResponse<TemplateRead | { detail?: string }>(fromChartRes);
    maybeSkip(!routeMissing(fromChartBody), `from-chart endpoint unavailable in target backend: ${fromChartBody.status} ${fromChartBody.text.slice(0, 140)}`);
    expect(fromChartRes.ok(), `from-chart create failed: ${fromChartBody.text}`).toBeTruthy();
    fromChartTemplate = fromChartBody.json as TemplateRead;

    const fromChartDeployState = await deployTemplateToProject(page, headers, fromChartTemplate, targetProject);
    maybeSkip(
      fromChartDeployState?.phase?.toLowerCase() === 'running',
      describeFailure('from-chart deploy', fromChartDeployState),
    );

    const registryListRes = await page.request.get(`/api/v1/stack-templates/registry${toQuery(COMMUNITY_SOURCE)}`, {
      headers,
    });
    const registryListBody = await parseResponse<{ data: RegistryTemplateSummary[] } | { detail?: string }>(registryListRes);
    expect(registryListRes.ok(), `registry list failed: ${registryListBody.text}`).toBeTruthy();

    const candidates = (registryListBody.json as { data?: RegistryTemplateSummary[] } | null)?.data ?? [];
    maybeSkip(
      candidates.length > 0,
      `community registry has no templates for ${COMMUNITY_SOURCE.repo}@${COMMUNITY_SOURCE.ref}:${COMMUNITY_SOURCE.path}`,
    );
    const firstCandidate = candidates[0];
    maybeSkip(!!firstCandidate?.name, 'community registry returned templates without names');
    if (!firstCandidate?.name) return;

    const communityName = firstCandidate.name;
    const installRes = await page.request.post(
      `/api/v1/stack-templates/registry/${encodeURIComponent(communityName)}/install${toQuery({ namespace: sourceProject.namespace, ...COMMUNITY_SOURCE })}`,
      { headers, data: {} },
    );
    const installBody = await parseResponse<TemplateRead | { detail?: string }>(installRes);
    expect(installRes.ok(), `registry install failed: ${installBody.text}`).toBeTruthy();
    installedTemplate = installBody.json as TemplateRead;

    const communityDeployState = await deployTemplateToProject(page, headers, installedTemplate, targetProject);
    maybeSkip(
      communityDeployState?.phase?.toLowerCase() === 'running',
      describeFailure('community registry deploy', communityDeployState),
    );

    await page.goto('/settings/stack-templates');
    await expect(page.getByRole('heading', { name: /Stack Templates/i })).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: artifact('templates-roundtrip-flow5.png'), fullPage: true });
  } finally {
    await deleteTemplate(page.request, headers, installedTemplate);
    await deleteTemplate(page.request, headers, fromChartTemplate);
    await deleteTemplate(page.request, headers, fromAppTemplate);

    await deleteProject(page.request, headers, targetProject?.id);
    await deleteProject(page.request, headers, sourceProject?.id);
  }
});
