# CLAUDE.md

Project-specific notes for Claude Code working in this repo.

## Architectural boundaries

These rules are mechanically enforced. Do not work around them.

### `src/` is framework-free

`src/` holds the production domain logic (`production-system.ts`, `sqlite-store.ts`,
`release-gate.ts`). It must NOT import:

- `next`, `next/*`
- `react`, `react-dom`, `react-dom/*`

Enforced by ESLint `no-restricted-imports` on `src/**/*.{js,mjs,ts,tsx}` (see
`eslint.config.mjs`). If you need framework code, put it in `app/` instead.

### `server.mjs` is FROZEN

`server.mjs` is the legacy custom Node server. Treat it as a closed surface:

- **No new endpoints** in `server.mjs`. New endpoints go through Next.js Route
  Handlers under `app/api/<name>/route.ts`.
- Existing endpoints stay until the redesign phase that owns that surface
  rewrites them as Route Handlers and wires them into the Next.js app.
- Bug fixes inside `server.mjs` are allowed; growth is not.
- Adding a Route Handler's pathname to the `appRoutes` allow-list in
  `server.mjs` is delegation, NOT a new endpoint. The implementation lives
  in `app/api/<name>/route.js` (or `route.ts`). Phase 3 introduced this
  bridge with `/api/team/activity`.

Reasoning: the rewrite incrementally moves auth/Pix/webhook/RBAC into the
Next.js pipeline. Adding new code to `server.mjs` makes that migration harder
and divergent.

## TypeScript migration

`src/` was migrated to TypeScript with `strict: false` as the baseline. Two
files (`production-system.ts`, `sqlite-store.ts`) carry `// @ts-nocheck`
escape hatches with `TODO(phase-0a-ts)` comments. Tightening types is
incremental work owned by future phases.

`tsx` is used as the runtime loader for Node-driven scripts (`npm run start`,
`npm test`, `npm run readiness:*`). See `package.json` for the exact `node
--import tsx ...` invocations.

## Conventions

- New imports may use the `@/` path alias (resolves to repo root) — see
  `jsconfig.json` / `tsconfig.json`.
- Style is enforced by Prettier (`prettier.config.mjs`) and ESLint
  (`eslint.config.mjs`). Run `npm run check` before committing.
- Tests live in `test/*.test.mjs` and are run via `node --import tsx --test`.

## E2E harness

`npm run e2e` self-bootstraps an isolated production-mode server. It runs
`next build` if `.next/BUILD_ID` is missing, then spawns the server with
`NEXT_DEV=false` on a free port and tears it down on exit. Production mode
is required because React must hydrate for Playwright clicks to fire event
handlers — Next.js dev mode's HMR WebSocket fails under Playwright and
leaves the app non-interactive.

A first run on a fresh clone pays a one-time `next build` cost (~30–60s).
Subsequent runs reuse the build until something invalidates `.next/`.

Smoke (`npm run smoke`) requires an external server already listening on
`SMOKE_BASE_URL` — it does not bootstrap. Use `npm run verify:isolated` for
the self-bootstrapping CI-equivalent (smoke + readiness drills).
