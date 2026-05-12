# e2e — Playwright end-to-end tests

These specs run against the **real** KubeNest backend (no mocked auth, no
`page.route()` stubs, no fixture data). See the umbrella `AGENTS.md` §"Testing &
target environments" and §7 ("UI testing") for the full rationale and the test
account / target-environment table.

## Layout

| Path | What |
|------|------|
| `playwright.config.ts` (repo root) | env-driven `baseURL`, the `setup` → `chromium` project chain, and the dev-server `webServer` block |
| `e2e/fixtures.ts` | shared helpers: `loginViaUI(page)`, `TEST_USER`, `artifact(name)`, `AUTH_STATE_PATH` |
| `e2e/auth.setup.ts` | the login fixture — real UI login as `lakshmi@lakshminp.com`, saves storage state to `e2e/.auth/user.json` |
| `e2e/*.spec.ts` | the suite. Every UI bead lands a spec here that hits the real backend |
| `e2e/.auth/user.json` | generated storage state (gitignored) |
| `e2e/<spec>-snapshots/` | committed `toHaveScreenshot()` baselines (Playwright-managed) |
| `artifacts/` (repo root) | ad-hoc `page.screenshot({ path: ... })` output — gitignored |
| `test-results/`, `playwright-report/` | Playwright run output — gitignored |

## Running

**Fast loop** — boots `next dev` on `:3000` with the Next API proxy pointed at
the live backend, then runs the specs against `http://localhost:3000`:

```bash
npm run test:e2e
# narrow it down:
npm run test:e2e -- e2e/smoke.spec.ts
npm run test:e2e -- --headed --debug
```

Override the backend the dev server proxies to with `E2E_API_URL`
(default `https://api.march-20-demo.kubenestapp.com`).

**Full e2e** — same specs against the deployed UI (no local server started):

```bash
E2E_BASE_URL=https://app.march-20-demo.kubenestapp.com npm run test:e2e
```

The canonical full-e2e cycle: merge to `main` → GitHub Actions builds the image
→ on the control plane `kubectl rollout restart deployment kubenest-ui -n kubenest-system`
(over SSH) → wait for rollout → run the command above.

## Conventions

- **Screenshots:** `page.screenshot({ path: artifact('name.png') })` — inspect the
  PNG under `artifacts/`. For visual regression use
  `await expect(page).toHaveScreenshot()` and commit the generated baseline
  (`npm run test:e2e -- --update-snapshots`).
- **Auth:** depend on the `setup` project (default) to start authenticated, or
  call `loginViaUI(page)` for a fresh login within a test.
- **No mocks:** if a flow needs backend state that isn't there, seed it via the
  real API — don't stub the response.
- **Account override:** `E2E_USER` / `E2E_PASSWORD` env vars.
