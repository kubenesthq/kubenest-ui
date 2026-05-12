import { expect, test, type Page } from '@playwright/test';
import { artifact } from './fixtures';

/**
 * kn-jub — Addon-instance lifecycle UI (KubeNest Design §7.5 Flow 6 / plan
 * §9.6), backed by the kn-b12 endpoints: PATCH /addon-instances/{id}
 * (values | chart_version -> Helm upgrade + a new revision), GET .../revisions,
 * POST .../rollback; AddonDefinition.version_history / changelog. Exercised
 * against the REAL backend via the shared `setup` auth state — no mocks, no
 * page.route() stubs.
 *
 * Asserts: the addon-instance Values tab edits the Helm values override and
 * saves it as a revision; the Versions tab shows the revision history (newest
 * first, with FAILED-revision errors surfaced) and a chart-version change form;
 * rolling back records another revision. When kn-b12's endpoints aren't
 * deployed in the target backend yet, the mutating round-trip is skipped (the
 * read-only wiring still runs) — the full assertions run once the backend is
 * redeployed (canonical full e2e). The values-edit round-trip re-applies the
 * instance's *current* values (the editor's prefilled fields aren't changed),
 * so the live release isn't actually reconfigured — just a new revision row.
 */

async function findAddonInstance(
  page: Page,
): Promise<{ projectId: string; instanceId: string } | null> {
  const token = await page.evaluate(() => localStorage.getItem('token'));
  if (!token) return null;
  const headers = { Authorization: `Bearer ${token}` };
  const projects = ((await (await page.request.get('/api/v1/projects?items_per_page=50', { headers })).json())?.data ?? []) as Array<{ id: string }>;
  for (const p of projects) {
    const res = await page.request.get(`/api/v1/addon-instances?project_id=${p.id}`, { headers });
    if (!res.ok()) continue;
    const inst = ((await res.json())?.data ?? [])[0] as { id?: string } | undefined;
    if (inst?.id) return { projectId: String(p.id), instanceId: String(inst.id) };
  }
  return null;
}

async function listRevisions(
  page: Page,
  instanceId: string,
): Promise<Array<{ revision_number: number; status: string }> | null> {
  const token = await page.evaluate(() => localStorage.getItem('token'));
  const res = await page.request.get(`/api/v1/addon-instances/${instanceId}/revisions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok()) return null; // kn-b12 not deployed in this backend yet
  return ((await res.json())?.data ?? []) as Array<{ revision_number: number; status: string }>;
}

test.describe('addon-instance lifecycle', () => {
  test('Values & Versions tabs are wired to the real lifecycle endpoints', async ({ page }) => {
    await page.goto('/clusters'); // an authenticated page so the token is in localStorage
    await page.waitForLoadState('domcontentloaded');
    const ref = await findAddonInstance(page);
    if (!ref) {
      test.skip(true, 'no addon instances in this environment');
      return;
    }

    await page.goto(`/projects/${ref.projectId}/addons/${ref.instanceId}`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('tab', { name: 'Values' })).toBeVisible({ timeout: 15_000 });

    // Values tab: a real editor (the exposed_values form, or the raw-JSON fallback) + save-as-revision.
    await page.getByRole('tab', { name: 'Values' }).click();
    await expect(page.getByTestId('addon-values-editor')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('exposed-values-form').or(page.getByTestId('addon-values-json'))).toBeVisible();
    await expect(page.getByTestId('addon-values-save')).toBeVisible();

    // Versions tab: the revision-history card (chart-version form too, when a chart ref is recorded).
    await page.getByRole('tab', { name: 'Versions' }).click();
    await expect(page.getByTestId('addon-revisions')).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: artifact('addon-lifecycle-tabs.png'), fullPage: true });
  });

  test('edit values -> new revision -> roll back (real backend)', async ({ page }) => {
    await page.goto('/clusters');
    await page.waitForLoadState('domcontentloaded');
    const ref = await findAddonInstance(page);
    if (!ref) {
      test.skip(true, 'no addon instances in this environment');
      return;
    }
    const before = await listRevisions(page, ref.instanceId);
    if (before === null) {
      test.skip(true, 'addon-instance lifecycle endpoints (kn-b12) not deployed in this backend yet');
      return;
    }
    const beforeCount = before.length;
    const latestBefore = beforeCount ? Math.max(...before.map((r) => r.revision_number)) : 0;
    const latestBeforeStatus = before.find((r) => r.revision_number === latestBefore)?.status;

    await page.goto(`/projects/${ref.projectId}/addons/${ref.instanceId}`);
    await page.waitForLoadState('domcontentloaded');

    // Save the Values tab — re-apply the current override (prefilled fields left
    // untouched). kn-b12 records a new revision and dispatches a Helm upgrade to
    // the same config; if the operator dispatch can't go out it's recorded as a
    // FAILED revision and the live release is left intact. Either way a row appears.
    await page.getByRole('tab', { name: 'Values' }).click();
    await expect(page.getByTestId('addon-values-editor')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('addon-values-note').fill('e2e: re-apply current values (no change)');
    await page.getByTestId('addon-values-save').click();
    await expect(page.getByTestId('addon-values-saved').or(page.getByTestId('addon-values-submit-error'))).toBeVisible({ timeout: 20_000 });

    // The new revision shows up on the Versions tab.
    await page.getByRole('tab', { name: 'Versions' }).click();
    await expect(page.getByTestId('addon-revisions')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid="addon-revision-row"]')).toHaveCount(beforeCount + 1, { timeout: 15_000 });

    // Roll back to the prior latest revision (when there was one and it didn't FAIL).
    if (latestBefore > 0 && latestBeforeStatus !== 'Failed') {
      const rollbackBtn = page.locator(`[data-testid="addon-revision-row"][data-revision-number="${latestBefore}"] [data-testid="addon-rollback"]`);
      await expect(rollbackBtn).toBeVisible({ timeout: 10_000 });
      await rollbackBtn.click();
      await expect(page.locator('[data-testid="addon-revision-row"]')).toHaveCount(beforeCount + 2, { timeout: 15_000 });
    }
    await page.screenshot({ path: artifact('addon-lifecycle-revisions.png'), fullPage: true });
  });

  test('catalog admin: the addon definition edit page exposes the version-history / changelog drawer', async ({ page }) => {
    await page.goto('/clusters');
    await page.waitForLoadState('domcontentloaded');
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const res = await page.request.get('/api/v1/addon-definitions?items_per_page=20', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const defId = res.ok() ? (((await res.json())?.data ?? [])[0] as { id?: string } | undefined)?.id : undefined;
    if (!defId) {
      test.skip(true, 'no addon definitions in this environment');
      return;
    }
    await page.goto(`/admin/addon-definitions/${defId}/edit`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: 'Version history & changelog' })).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('open-changelog-drawer').click();
    // Either a populated changelog list, or the labelled empty state — both are valid.
    await expect(page.getByTestId('changelog-list').or(page.getByTestId('changelog-empty'))).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: artifact('addon-lifecycle-changelog.png'), fullPage: true });
  });
});
