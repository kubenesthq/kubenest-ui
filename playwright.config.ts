import { defineConfig, devices } from '@playwright/test';

/**
 * KubeNest UI end-to-end test config.
 *
 * Two run modes (see AGENTS.md / e2e/README.md):
 *
 *  1. Fast loop — `npm run test:e2e`
 *     With no `E2E_BASE_URL` set, Playwright boots `next dev` on :3000 with the
 *     Next API proxy pointed at the live backend (`E2E_API_URL`, default the
 *     march-20-demo control plane) and runs the specs against http://localhost:3000.
 *     Per the no-mocks rule, the dev server talks to the REAL backend.
 *
 *  2. Full e2e — `E2E_BASE_URL=https://app.march-20-demo.kubenestapp.com npm run test:e2e`
 *     Runs the exact same specs against the deployed UI. No local server is started.
 *
 * Auth: the `setup` project (e2e/auth.setup.ts) performs a real UI login as
 * lakshmi@lakshminp.com and saves storage state to e2e/.auth/user.json; the
 * `chromium` project reuses it. There is no mocked auth and no fixture token.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const API_URL = process.env.E2E_API_URL ?? 'https://api.march-20-demo.kubenestapp.com';
const SSE_URL = process.env.E2E_SSE_URL ?? `${API_URL}/api/v1/stream`;
const USE_LOCAL_DEV_SERVER = !process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  // Traces / videos / failure screenshots (gitignored). Ad-hoc screenshots from
  // specs go to artifacts/ (see e2e/fixtures.ts `artifact()`); committed visual
  // baselines live next to their spec in e2e/<spec>-snapshots/.
  outputDir: 'test-results',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // The march-20-demo certs are valid, but tolerate self-signed in other envs.
    ignoreHTTPSErrors: true,
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' },
      dependencies: ['setup'],
    },
  ],
  webServer: USE_LOCAL_DEV_SERVER
    ? {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          NEXT_PUBLIC_API_URL: API_URL,
          NEXT_PUBLIC_SSE_URL: SSE_URL,
        },
      }
    : undefined,
});
