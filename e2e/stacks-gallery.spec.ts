import { expect, test } from '@playwright/test';
import { artifact } from './fixtures';

/**
 * kn-a7d — /stacks gallery page smoke.
 *
 * Per AGENTS.md §7 / brief §5: real backend, no mocks. The page calls
 * GET /stack-templates and GET /stack-templates/registry; the assertions
 * check that the page actually renders (tabs visible, no error banner)
 * and that switching tabs surfaces either real cards or one of the
 * documented empty states — both prove the data path is wired end-to-end.
 *
 * Deploy / Delete / Install actions are exercised indirectly: the
 * existing e2e/stack-templates.spec.ts and the per-tab cards' testids
 * remain stable so kn-c2l / kn-epw can layer onto this without churn.
 */

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
