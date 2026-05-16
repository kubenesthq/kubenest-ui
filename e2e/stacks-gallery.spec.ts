import { expect, test } from '@playwright/test';
import { artifact } from './fixtures';

/**
 * kn-a7d / kn-c2l — /stacks gallery page smoke + card navigation.
 *
 * Per AGENTS.md §7 / brief §5: real backend, no mocks. Two specs:
 *
 *   1. The page renders both tabs, surfaces either real cards or the
 *      documented empty states, and never shows the error banner.
 *   2. Clicking a My-templates card body lands on the detail page
 *      (kn-epw); clicking the in-card Deploy button skips detail and
 *      goes straight to /stacks/deploy. Both paths are required by
 *      kn-c2l's "inspect, then deploy" UX.
 *
 * Card-nav spec seeds a real template via POST /stack-templates/from-app
 * and cleans up after itself.
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

async function seedTemplate(
  page: import('@playwright/test').Page,
  ctx: ApiContext,
  templateName: string,
): Promise<{ srcApp: string; templateNamespace: string }> {
  const srcApp = `${templateName}-src`;
  const createApp = await page.request.post('/api/v1/apps', {
    headers: ctx.authHeaders,
    data: {
      name: srcApp, project_id: ctx.projectId,
      components: [{ name: 'web', type: 'workload', workload_spec: { image: 'nginx:1.27-alpine', replicas: 1, port: 8080 } }],
    },
  });
  expect(createApp.ok()).toBeTruthy();
  const createTpl = await page.request.post(
    `/api/v1/stack-templates/from-app/${encodeURIComponent(ctx.namespace)}/${encodeURIComponent(srcApp)}?project_id=${encodeURIComponent(ctx.projectId)}`,
    {
      headers: ctx.authHeaders,
      data: { name: templateName, description: 'seeded by kn-c2l e2e', version: '1.0.0', scope: 'project', tags: ['kn-c2l'] },
    },
  );
  expect(createTpl.ok(), `from-app failed: ${createTpl.status()} ${await createTpl.text()}`).toBeTruthy();
  return { srcApp, templateNamespace: String((await createTpl.json()).namespace) };
}

test('the /stacks page renders the gallery with both tabs and at least one populated state', async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto('/stacks');
  await page.waitForLoadState('domcontentloaded');

  // Title + the redirect-to-/apps from the previous page is gone.
  await expect(page.getByRole('heading', { name: 'App templates' })).toBeVisible({ timeout: 20_000 });
  expect(page.url()).toMatch(/\/stacks(?:\?|$)/);

  // Both tabs render with their counts.
  const myTab = page.getByTestId('stacks-tab-my');
  const communityTab = page.getByTestId('stacks-tab-community');
  await expect(myTab).toBeVisible();
  await expect(communityTab).toBeVisible();

  // Default tab is My templates — either a grid renders or the
  // "no templates yet" empty state does. Both are acceptable real-data
  // outcomes; what matters is that the error banner is NOT shown (which
  // would mean the GET failed).
  await expect(page.getByTestId('stacks-error-banner')).toHaveCount(0);
  const myEmpty = page.getByTestId('stacks-my-empty');
  const myGrid = page.getByTestId('stacks-my-grid');
  await expect(myEmpty.or(myGrid)).toBeVisible({ timeout: 20_000 });

  // The search input is wired (kn-c2l will exercise filtering for real).
  const search = page.getByTestId('stacks-search');
  await expect(search).toBeVisible();
  await search.fill('nothing-should-match-this-12345');
  // After a non-matching search, either the filter-empty card shows OR the
  // page was already in the my-empty state (no rows to filter).
  const filterEmpty = page.getByTestId('stacks-filter-empty');
  await expect(filterEmpty.or(myEmpty)).toBeVisible({ timeout: 5_000 });
  await search.fill('');

  // Switch to community — same shape of assertions.
  await communityTab.click();
  await expect(page.getByTestId('stacks-error-banner')).toHaveCount(0);
  const communityEmpty = page.getByTestId('stacks-community-empty');
  const communityGrid = page.getByTestId('stacks-community-grid');
  await expect(communityEmpty.or(communityGrid)).toBeVisible({ timeout: 20_000 });

  await page.screenshot({ path: artifact('stacks-gallery.png'), fullPage: true });
});

test('clicking a My-templates card navigates to the detail page; the in-card Deploy bypasses it (kn-c2l)', async ({ page }) => {
  test.setTimeout(180_000);

  const ctx = await ensureAuthContext(page);
  const templateName = `kn-c2l-${Date.now().toString(36)}`;
  const { srcApp, templateNamespace } = await seedTemplate(page, ctx, templateName);

  try {
    await page.goto('/stacks');
    await expect(page.getByRole('heading', { name: 'App templates' })).toBeVisible({ timeout: 20_000 });

    // The seeded template should appear as a card in the My tab.
    const cardLink = page.getByTestId(`stacks-my-card-link-${templateName}`);
    await expect(cardLink).toBeVisible({ timeout: 20_000 });

    // Clicking the card body navigates to the detail page (kn-epw).
    await cardLink.click();
    await page.waitForURL(new RegExp(`/stacks/${templateNamespace}/${templateName}(?:\\?|$)`), { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: templateName })).toBeVisible({ timeout: 20_000 });

    // Back to the gallery — verify the Deploy shortcut on the card skips
    // detail and jumps straight to the deploy form.
    await page.goto('/stacks');
    await expect(page.getByTestId(`stacks-my-card-link-${templateName}`)).toBeVisible({ timeout: 20_000 });
    await page.getByTestId(`stacks-my-deploy-${templateName}`).click();
    await page.waitForURL(/\/stacks\/deploy\?/, { timeout: 20_000 });
    expect(page.url()).toContain(`ns=${encodeURIComponent(templateNamespace)}`);
    expect(page.url()).toContain(`name=${encodeURIComponent(templateName)}`);
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
