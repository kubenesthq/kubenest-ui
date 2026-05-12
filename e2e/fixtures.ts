import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Shared e2e helpers for the KubeNest UI suite.
 *
 * Test accounts and target environments are documented in the umbrella
 * AGENTS.md (§ "Testing & target environments"). The default account is the
 * march-20-demo control-plane admin; override with E2E_USER / E2E_PASSWORD.
 *
 * Hard rule: every behavioural assertion runs against the REAL backend. No
 * mocked auth, no `page.route()` stubs standing in for API responses, no
 * fixture token. `loginViaUI` drives the actual /login form.
 */
// Not a secret: the public march-20-demo control-plane admin login, the same
// credential documented in the umbrella AGENTS.md. Override per-env if needed.
export const TEST_USER = {
  email: process.env.E2E_USER ?? 'lakshmi@lakshminp.com',
  password: process.env.E2E_PASSWORD ?? 'admin123',
};

/** Where the `setup` project writes shared storage state. */
export const AUTH_STATE_PATH = path.join(here, '.auth', 'user.json');

/** Convention: ad-hoc screenshots land in artifacts/ (gitignored). */
export function artifact(name: string): string {
  return path.join(here, '..', 'artifacts', name);
}

/**
 * Log in through the real /login form and wait until the authenticated app
 * shell (the Dashboard) has rendered. Leaves the page on /dashboard.
 */
export async function loginViaUI(
  page: Page,
  user: { email: string; password: string } = TEST_USER,
): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: /sign in/i }).click();

  // Root page (`/`) redirects authenticated users to /dashboard.
  await page.waitForURL(/\/dashboard\b/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
}
