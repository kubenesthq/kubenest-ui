# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Quality Gates

Before committing UI changes, run (Node 20+ — `.nvmrc` pins 24, the image build's node):

```bash
npm run typecheck && npm run lint && npm run build
```

Behavioural changes also need a Playwright spec under `e2e/` that hits the
**real** backend (no mocked auth, no `page.route()` stubs). See `e2e/README.md`.

```bash
npm run test:e2e                       # fast loop: next dev on :3000 -> live API
npm run test:e2e -- e2e/smoke.spec.ts  # one spec
E2E_BASE_URL=https://app.march-20-demo.kubenestapp.com npm run test:e2e   # full e2e against the deployed UI
```

Ad-hoc screenshots: `page.screenshot({ path: artifact('name.png') })` (helper in
`e2e/fixtures.ts`) — output lands in `artifacts/` (gitignored). Visual baselines
for `toHaveScreenshot()` are committed under `e2e/**-snapshots/`.

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

