import { test as setup, expect } from '@playwright/test';
import { loginViaUI, AUTH_STATE_PATH } from './fixtures';

/**
 * Auth setup project — runs once before the `chromium` project (see
 * playwright.config.ts `dependencies`). It logs in through the real UI against
 * the real backend (no mocked auth, no synthetic token) and saves the resulting
 * browser storage state — `token` in localStorage, the zustand `auth-storage`
 * blob, and the httpOnly refresh cookie — to e2e/.auth/user.json so the rest of
 * the suite starts authenticated.
 */
setup('authenticate as lakshmi@lakshminp.com', async ({ page }) => {
  await loginViaUI(page);
  const state = await page.context().storageState({ path: AUTH_STATE_PATH });
  const localStorageKeys = state.origins.flatMap((o) => o.localStorage.map((e) => e.name));
  expect(localStorageKeys).toContain('token');
});
