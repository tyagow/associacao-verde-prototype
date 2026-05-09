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

### Pure Next.js architecture

`server.mjs` was deleted. The app runs on `next start` (production) and
`next dev` (development). Nothing wraps Next.js anymore.

- **Endpoints**: every endpoint is a Next.js Route Handler under
  `app/api/<path>/route.js`.
- **Origin / CSRF + protected-page guard**: `middleware.ts` at repo root.
  Loopback bypass for server-to-server scripts; browsers always required
  to send `Origin` or `Referer` matching `Host`.
- **Security headers** (CSP, HSTS in production, X-Frame-Options, ...):
  `next.config.mjs::headers()`. Returned on every response.
- **`/public/<asset>` legacy paths**: `next.config.mjs::rewrites()` maps
  them to `/<asset>` (the Next.js convention). New code should reference
  `/<asset>` directly.
- **Domain singleton**: `src/system-instance.ts::getSystem()` lazy-builds
  the `ProductionSystem` + `SqliteStateStore` and caches on `globalThis`.
  Route Handlers import `getSystem()` and share one instance per process.
- **Production fail-closed flag**: `AV_REQUIRE_LIVE_PROVIDER=true` (set
  in real production deploys) demands `PAYMENT_PROVIDER=asaas` and rejects
  empty secrets. NOT keyed on `NODE_ENV` because `next start` forces
  `NODE_ENV=production` internally.

When adding a new endpoint:

1. Create `app/api/<your-path>/route.js`.
2. `import { getSystem } from "@/src/system-instance"` (or relative).
3. Use `readSessionCookie(request.headers.get('cookie'))` from
   `src/route-helpers.ts` to read the session; pass to `system.<method>()`
   for RBAC enforcement. Do NOT read the cookie name directly — it is
   `__Host-av_session` in production and `av_session` in dev, and
   `sessionCookieName()` / `readSessionCookie()` already encapsulate that.
4. Return `Response.json(...)` with explicit status codes.
5. Don't bypass middleware.ts; it owns origin + protected-page checks.

Webhook endpoints (e.g., `/api/webhooks/pix`) are middleware-exempted from
origin enforcement — provider posts cross-origin. Authenticity is enforced
inside the handler via `timingSafeEqual` on a shared secret header.

## TypeScript migration

`src/` was migrated to TypeScript with `strict: false` as the baseline. Two
files (`production-system.ts`, `sqlite-store.ts`) carry `// @ts-nocheck`
escape hatches with `TODO(phase-0a-ts)` comments. Tightening types is
incremental work owned by future phases.

`tsx` is used as the runtime loader for the test suite and the readiness
scripts (`npm test`, `npm run readiness:*`). The web server itself runs
through `next start` / `next dev`, which loads `src/system-instance.ts`
via Turbopack. See `package.json` for the exact `node --import tsx ...`
invocations.

## Conventions

- New imports may use the `@/` path alias (resolves to repo root) — see
  `jsconfig.json` / `tsconfig.json`.
- Style is enforced by Prettier (`prettier.config.mjs`) and ESLint
  (`eslint.config.mjs`). Run `npm run check` before committing.
- Tests live in `test/*.test.mjs` and are run via `node --import tsx --test`.

## E2E harness

`npm run e2e` self-bootstraps an isolated production-mode server. It runs
`next build` if `.next/BUILD_ID` is missing, then spawns
`npx next start -p <free-port>` with `NODE_ENV=development` (so the
fail-closed `AV_REQUIRE_LIVE_PROVIDER` gate stays off) and tears it down
on exit. Production mode is required because React must hydrate for
Playwright clicks to fire event handlers — `next dev`'s HMR WebSocket
fails under Playwright and leaves the app non-interactive.

A first run on a fresh clone pays a one-time `next build` cost (~30–60s).
Subsequent runs reuse the build until something invalidates `.next/`.

Smoke (`npm run smoke`) requires an external server already listening on
`SMOKE_BASE_URL` — it does not bootstrap. Use `npm run verify:isolated` for
the self-bootstrapping CI-equivalent (smoke + readiness drills).

## Dev environment

`scripts/dev-watchdog.sh` runs `next dev -p 4184` inside a tmux session
and self-restarts on crash. Pre-seeded with the dev-mode secrets that
`next dev` requires (TEAM_PASSWORD, PIX_WEBHOOK_SECRET, SESSION_SECRET).
`scripts/dev-down.sh` is the clean shutdown companion.

Dev quick-access patient: `scripts/add-dev-user.mjs` creates `TIAGO/TIAGO`
idempotently. Run after `npm run dev:reset` wipes the SQLite file.

## Admin / Equipe design system

The internal team experience (`/equipe/*` and `/admin`) follows the
**Direction B (Stripe Workbench)** dialect documented in
`docs/superpowers/design.md` §2.2 and codified in
`docs/superpowers/specs/2026-05-09-admin-design-system.md`.

Mockups live under `docs/superpowers/specs/admin-revamp-mockups/`.
Implementation ledger: `thoughts/ledgers/CONTINUITY_CLAUDE-admin-revamp.md`.

### Design tokens (in `app/globals.css`)

- Spacing: `--sp-1` (4px) through `--sp-10` (72px) — 8-px grid
- Surface roles: `--surface-{base,elevated,sunken,hover,active}`
- Border roles: `--border-{default,subtle,emphasis,strong,focus}`
- Text roles: `--text-{primary,secondary,tertiary,quaternary}`
- Status roles: `--status-{success,warn,danger,info,neutral}-{bg,text,dot}`
- Type: `--fs-ui` (13px admin density), `--lh-snug` (1.35)
- Motion: `--ease-out-quad`, `--duration-{fast,base,slow}`
- Radii (locked globally with paciente): `--r-sm 3 / --r-md 5 / --r-lg 7`

### Utility classes

- `.adm-page`, `.adm-stack-1..7`, `.adm-row`, `.adm-grid-{2,3,4}col`,
  `.adm-empty-state`, `.adm-skeleton`

### Promoted primitives

- `.surface` / `.surface--elevated` / `.surface--bordered-left-{ok|warn|danger|info|neutral}`
- `.dataTable` (replaces local table.adm overrides)
- `.toolbar` (status-strip pattern)
- `.btn--{primary,ghost,danger,mini,icon}` (NOT new local button styles)
- `.pill` with `--success/--warn/--danger/--info/--neutral` modifiers
- `.chip` (compact filter / count chip)
- `.skel` (shimmer loader, respects `prefers-reduced-motion`)
- `.emptyState` (with `--sm`, `--lg` modifiers)
- `.drawer` / `.drawer__head` / `.drawer__body` / `.drawer__overlay`
- `.codeBlock` (mono command snippet)

### Anti-patterns to avoid

- DO NOT add new local `.btnGhost` / `.statusPill` / `.cmdBlock` etc. — extend the global primitive instead
- DO NOT introduce new hardcoded `padding: NNpx` — use `var(--sp-N)` tokens (8-px grid)
- DO NOT use display font (`Outfit`) for small UI text below 18px — use Inter (`--font-ui`)
- DO NOT add motion that animates layout (width/height/top/left)
