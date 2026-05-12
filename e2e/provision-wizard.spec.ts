import { expect, test, type Page } from '@playwright/test';
import { artifact } from './fixtures';

async function firstClusterId(page: Page): Promise<string | null> {
  const token = await page.evaluate(() => localStorage.getItem('token'));
  if (!token) return null;
  const headers = { Authorization: `Bearer ${token}` };
  const orgsRes = await page.request.get('/api/v1/orgs', { headers });
  if (!orgsRes.ok()) return null;
  for (const org of (await orgsRes.json()) as Array<{ id: string }>) {
    const cl = await page.request.get(`/api/v1/orgs/${org.id}/clusters`, { headers });
    if (!cl.ok()) continue;
    const first = ((await cl.json())?.data ?? [])[0];
    if (first?.id) return String(first.id);
  }
  return null;
}

/**
 * kn-u4 — Cluster provision wizard + live per-stage provisioning status (Flow-2
 * UI). Exercised against the REAL backend via the shared `setup` auth state —
 * no mocks, no page.route() stubs.
 *
 * What we assert here, honestly:
 *  - the wizard's provider step renders the real provider catalogue: AWS is
 *    wired and selectable; the rest render "coming soon", disabled, with no
 *    pseudo-success path;
 *  - the wizard walks provider -> credential -> configure -> components ->
 *    review against the user's real credentials list (it stops at Review — it
 *    does NOT click "Provision Cluster", since standing up a real cloud cluster
 *    is the kn-v1 acceptance work, not something to fire from this run);
 *  - the provisioning status page renders the C4 lifecycle as five distinct,
 *    labelled stages with a per-stage detail blurb — never a bare spinner.
 *
 * The happy-path "watch it progress to cluster_ready" / forced-failure round
 * trips need a real provisioning run (10+ min, real cloud spend) and are
 * delegated to the real-cluster acceptance work, the same way the rest of this
 * initiative handles real-cloud behavioural acceptance.
 */

const COMING_SOON = ['gcp', 'azure', 'do', 'metal', 'ssh'] as const;
const STAGE_LABELS = ['Queued', 'Provisioning infrastructure', 'Bootstrapping the cluster', 'Operator registering', 'Cluster ready'] as const;

test.describe('cluster provision wizard', () => {
  test('provider step: AWS is wired/selectable; other providers are "coming soon" with no select path', async ({ page }) => {
    await page.goto('/clusters/new/provision');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Choose a cloud provider')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('provider-grid')).toBeVisible();

    const aws = page.getByTestId('provider-aws');
    await expect(aws).toBeEnabled();
    await expect(aws).toHaveAttribute('data-wired', 'true');

    for (const id of COMING_SOON) {
      const card = page.getByTestId(`provider-${id}`);
      await expect(card).toBeVisible();
      await expect(card).toBeDisabled();
      await expect(card).toHaveAttribute('data-wired', 'false');
      await expect(page.getByTestId(`provider-${id}-coming-soon`)).toBeVisible();
    }

    const next = page.getByTestId('wizard-next');
    await expect(next).toBeDisabled();
    await aws.click();
    await expect(next).toBeEnabled();
    await page.screenshot({ path: artifact('provision-wizard-provider.png'), fullPage: true });

    // Step into the credential picker (real credentials list from the backend).
    await next.click();
    await expect(page.getByText(/Select a .* credential/)).toBeVisible({ timeout: 10_000 });
    const aCred = page.locator('[data-testid^="credential-"]').first();
    const noCreds = page.getByTestId('no-credentials');
    await expect(aCred.or(noCreds)).toBeVisible({ timeout: 10_000 });
    if (await noCreds.isVisible()) {
      await expect(noCreds).toContainText(/no .* credentials configured/i);
      // No AWS credential in this environment — that's the real state; nothing more to walk.
      return;
    }

    // Walk the rest of the wizard against real data — without provisioning anything.
    await aCred.click();
    await expect(next).toBeEnabled();
    await next.click(); // -> configure
    await expect(page.getByText('Cluster Configuration')).toBeVisible();
    await page.getByTestId('cluster-name').fill(`knu4e2e-${Date.now().toString(36)}`);
    await expect(next).toBeEnabled();
    await next.click(); // -> components
    await expect(page.getByText('Platform Components')).toBeVisible();
    await next.click(); // -> review
    await expect(page.getByText('Review & Confirm')).toBeVisible();
    await expect(page.getByText('Amazon Web Services').first()).toBeVisible();
    await expect(page.getByText(/billed by the provider/i)).toBeVisible();
    await page.screenshot({ path: artifact('provision-wizard-review.png'), fullPage: true });
    // Intentionally NOT clicking "Provision Cluster".
  });

  test('provisioning status page renders five distinct lifecycle stages + a labelled per-stage detail (no bare spinner)', async ({ page }) => {
    // Need an authenticated context first so the token is in localStorage.
    await page.goto('/clusters');
    await page.waitForLoadState('domcontentloaded');
    const id = await firstClusterId(page);
    if (!id) {
      test.skip(true, 'no clusters in this environment');
      return;
    }

    await page.goto(`/clusters/${id}/provisioning`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Lifecycle')).toBeVisible({ timeout: 15_000 });

    for (const label of STAGE_LABELS) {
      await expect(page.locator(`[data-stage-label="${label}"]`)).toBeVisible();
    }
    // A per-stage detail blurb is always rendered for whatever state the cluster is in.
    await expect(
      page.getByText(
        /Creating the provisioning job|Queued — waiting|Terraform is creating|Infrastructure is up|Waiting for the KubeNest operator|cluster is ready|couldn.t create the infrastructure|hasn.t registered with KubeNest/i,
      ),
    ).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: artifact('provisioning-status.png'), fullPage: true });
  });
});
