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
