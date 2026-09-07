import { test, expect } from '@playwright/test';
import { artifact } from './fixtures';

/**
 * kn-u3 — Clusters list + detail (KubeNest Design) on real data. Exercised
 * against the REAL backend via the shared auth state from the `setup` project —
 * no mocks, no page.route() stubs.
 */
test('clusters: list + detail render real status / secret-free CLI pointer / provisioning, with labelled stubs', async ({ page }) => {
  const legacyInstallCommandResponses: string[] = [];
  page.on('response', (response) => {
    if (response.url().includes('/install-command')) legacyInstallCommandResponses.push(response.url());
  });

  // ── List ──────────────────────────────────────────────────────────────────
  await page.goto('/clusters');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByRole('heading', { name: 'Clusters' })).toBeVisible();

  // The environment has a real connected cluster. Verify it is listed, then
  // register a separate manual cluster through the UI: only a pending cluster
  // renders the safe reconnect pointer.
  const firstClusterLink = page.locator('a[href^="/clusters/"]:not([href="/clusters/new"]):not([href^="/clusters/new/"])').first();
  await expect(firstClusterLink).toBeVisible({ timeout: 12_000 });
  await page.goto('/clusters/new');
  await expect(page.getByRole('button', { name: 'Connect Existing Cluster' })).toBeVisible();
  await page.getByRole('button', { name: 'Connect Existing Cluster' }).click();
  const clusterName = `kn-rnyl-${Date.now().toString(36)}`;
  await page.locator('#name').fill(clusterName);
  await page.locator('#description').fill('Temporary live browser-boundary check');
  const createResponsePromise = page.waitForResponse((response) =>
    response.request().method() === 'POST'
      && response.url().includes('/api/v1/orgs/')
      && response.url().endsWith('/clusters'),
  );
  const registrationForm = page.locator('form');
  await registrationForm.getByRole('button', { name: 'Register Cluster', exact: true }).click();
  const createResponse = await createResponsePromise;
  expect(createResponse.status()).toBe(201);
  const installInstructionsResponsePromise = page.waitForResponse((response) =>
    response.request().method() === 'GET'
      && response.url().includes('/api/v1/clusters/')
      && response.url().endsWith('/install-instructions'),
  );
  await page.waitForURL(/\/clusters\/(?!new(?:\/|$))[^/]+$/, { timeout: 10_000 });
  await page.waitForLoadState('domcontentloaded');

  // ── Detail — Overview (default tab): real status + CLI pointer ───────────
  // Status grid labels.
  await expect(page.getByText('Connection', { exact: true })).toBeVisible();
  await expect(page.getByText('Health', { exact: true })).toBeVisible();
  await expect(page.getByText('Kubernetes', { exact: true })).toBeVisible();
  // The hero shows a connection pill — Connected / Pending / Disconnected.
  await expect(page.getByText(/^(Connected|Pending|Disconnected)$/).first()).toBeVisible();

  // Install instructions are the only browser-facing install surface. They
  // contain a CLI pointer, never the agent JWT or GitOps deploy key.
  await expect(page.getByText('Connect the operator')).toBeVisible();
  const installPre = page.locator('pre').first();
  await expect(installPre).toBeVisible({ timeout: 12_000 });
  const installInstructionsResponse = await installInstructionsResponsePromise;
  expect(installInstructionsResponse.status()).toBe(200);
  const instructions = await installInstructionsResponse.json() as Record<string, unknown>;
  expect(Object.keys(instructions).sort()).toEqual([
    'chart_ref',
    'cli_command',
    'cluster_id',
    'docs_url',
    'hub_url',
    'namespace',
  ]);
  const clusterId = new URL(page.url()).pathname.split('/').at(-1);
  expect(instructions.cluster_id).toBe(clusterId);
  expect(instructions.cli_command).toBe(`kubenest cluster connect --cluster ${clusterId}`);
  await expect(installPre).toHaveText(`kubenest cluster connect --cluster ${clusterId}`);
  expect(legacyInstallCommandResponses).toEqual([]);

  // This manual registration is intentionally pending, so it has no capacity
  // samples yet. Live metric-state coverage is owned by monitoring.spec.ts.
  await page.screenshot({ path: artifact('clusters-detail-overview.png'), fullPage: true });

  // ── Provisioning tab: real jobs (or the labelled empty state) ────────────
  await page.getByRole('tab', { name: 'Provisioning' }).click();
  await expect(page.getByText(/Provisioning jobs|No provisioning jobs for this cluster/).first()).toBeVisible({ timeout: 10_000 });

  // ── RBAC tab: labelled stub naming kn-b15 ────────────────────────────────
  await page.getByRole('tab', { name: 'RBAC' }).click();
  await expect(page.getByText('Role-based access control')).toBeVisible();
  await expect(page.getByText(/kn-b15/)).toBeVisible();

  // ── Projects tab renders ─────────────────────────────────────────────────
  await page.getByRole('tab', { name: 'Projects' }).click();
  await expect(page.getByText('Projects in this cluster')).toBeVisible();

  // This test owns the manual registration it created; remove only that record
  // through the same real browser/backend path.
  await page.getByRole('tab', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Delete cluster' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.waitForURL(/\/clusters$/, { timeout: 10_000 });
});
