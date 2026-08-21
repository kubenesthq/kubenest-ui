import { expect, test } from '@playwright/test';
import { artifact } from './fixtures';

const clusterId = process.env.E2E_RESTORE_DRILL_CLUSTER_ID;

test('restore drill evidence from the real cluster is visible and actionable', async ({ page }) => {
  test.skip(!clusterId, 'E2E_RESTORE_DRILL_CLUSTER_ID identifies the real gate cluster');

  await page.goto(`/clusters/${clusterId}`);
  const card = page.getByTestId('restore-drill-health');
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card.getByText('Verified restore')).toBeVisible();
  await expect(card.getByText(/Passed|Failed|Never run|Stale/)).toBeVisible();

  const failed = card.getByTestId('restore-drill-failure');
  if (await failed.isVisible()) {
    await expect(failed.locator('.font-mono').first()).not.toBeEmpty();
    await expect(failed.locator('p')).not.toBeEmpty();
  } else {
    await expect(card.getByText('PVC data matched')).toBeVisible();
  }

  await page.screenshot({ path: artifact('restore-drill-health.png'), fullPage: true });
});
