import { test, expect } from '@playwright/test';

/**
 * kn-u16 — the UI must speak /apps only. The bare-/workloads HTTP surface is gone
 * (backend returns 410, kn-b1). Exercise the main authenticated surfaces against
 * the REAL backend and assert no request ever hits a /workloads* path.
 *
 * Uses the shared storage state from the `setup` project (real login). No mocks,
 * no page.route() stubs. The app keeps an SSE connection open, so `networkidle`
 * never fires — instead we give each route a moment to fire its data fetches.
 */
test('no UI surface calls a /workloads* path', async ({ page }) => {
  const workloadRequests: string[] = [];
  page.on('request', (req) => {
    const pathname = new URL(req.url()).pathname;
    // A `workloads` path segment — covers /workloads, /workloads/{id},
    // /workloads/{id}/redeploy, /projects/{id}/workloads.
    if (pathname.split('/').includes('workloads')) {
      workloadRequests.push(`${req.method()} ${req.url()}`);
    }
  });

  const settle = async () => {
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2500); // let the route's initial API fetches fire
  };

  // Walk the main authenticated routes.
  for (const route of ['/dashboard', '/projects', '/apps', '/clusters']) {
    await page.goto(route);
    await settle();
  }

  // Open the first project detail (apps/addons load there) and the first app
  // detail, if any exist — these are the surfaces that used to hit /workloads*.
  await page.goto('/projects');
  await settle();
  const firstProjectLink = page.locator('a[href^="/projects/"]').first();
  if (await firstProjectLink.count()) {
    await firstProjectLink.click();
    await settle();
  }
  await page.goto('/apps');
  await settle();
  const firstAppLink = page.locator('a[href^="/apps/"]:not([href="/apps/new"])').first();
  if (await firstAppLink.count()) {
    await firstAppLink.click();
    await settle();
  }

  expect(workloadRequests, `unexpected /workloads* request(s):\n${workloadRequests.join('\n')}`).toEqual([]);
});
