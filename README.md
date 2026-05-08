# Associacao Verde Production Application

Production private operations system for Apoiar / Associacao Verde.

This repository is the full authenticated production application for the
association. It is not a repackaging of the archived browser-only reference:
the production application is the private Next.js app served at `/` with
production surfaces such as `/paciente`, `/equipe`, `/equipe/pacientes`,
`/equipe/estoque`, `/equipe/pedidos`, `/equipe/fulfillment`,
`/equipe/suporte`, and `/admin`.

The patient and team experiences ship under the locked **B · Calm Clinical
Modern** aesthetic. See `docs/redesign/locked-aesthetic.md` for the visual
contract and `docs/redesign/tokens.md` for the canonical token reference.

## Production Scope

Current status: this is a full production application track under active
development, not a temporary demo or single-page reference. Progress is measured
against the patient, team, payment, inventory, compliance, deployment, and QA
gates tracked in:

```text
docs/production-delivery-plan.md
```

The production application implements:

- **Patient experience (mode-based viewport).** Pedido / Histórico / Suporte
  tabs; full-screen Pix takeover with live countdown, QR, copia-e-cola, frete
  block, and 5-stage timeline; catalog and profile as right-slide drawers;
  LGPD consent gate; access-recovery screen for blocked patients; mobile
  parity at 390px and 320px (`prefers-reduced-motion` honored across drawers
  and the Pix hero).
- **Team workspace (TeamShell + ⌘K).** Sidebar app shell mounted across every
  `/equipe/*` route with sidebar badge counts driven by
  `/api/team/dashboard`; global command palette (`cmdk`) bound to ⌘K /
  Ctrl+K with patient/order/action/navigation sources and localStorage
  recents/starred.
- **Command center.** Four KPI cards with sparklines (Pix pendentes,
  Separação, Bloqueios, Faturado semana), live activity feed polling
  `GET /api/team/activity?since=`, Pix-by-hour bar chart, and priority queue.
- **Pedidos & Pix ledgers.** Two-ledger view: Pix pendentes (with countdown
  column and reconcile/cancel actions) and Pedidos pagos (status pills +
  per-row actions).
- **Fulfillment kanban.** Four-column drag-and-drop board (Pago aguardando ·
  Em separação · Pronto despachar · Enviado) backed by `@dnd-kit/core`,
  optimistic UI with revert-on-error, and `team_order_status_changed` audit
  envelope. Mobile drops to single-column-with-tabs.
- **Estoque & cultivo.** Single product ledger with click-to-expand lot
  detail (lot · quantidade · validade · origem), inline edit of metadata
  fields, and a Cultivo sibling panel. Lot data exposes the cultivation
  pipeline.
- **Support workbench.** Two-pane layout (queue left, case panel right);
  patient context fact grid; chronological thread (patient-LEFT,
  team-RIGHT bubbles); reply box backed by `support_messages` (schema v15).
- **Admin readiness redesign.** Hero release-readiness progress bar with a
  2-column gate grid, click-to-expand `GateDetail` panels, grouped audit
  timeline (today / yesterday / earlier) with filter chips and payload
  modal, and a single team-users table with inline reactivation.
- Private patient ordering with server-side session cookies.
- Patient eligibility checks before catalog access and checkout (association
  eligibility, active patient status, valid prescription, valid card).
- SQLite-backed persistence with versioned migrations (current schema v15)
  for patients, products, sessions, stock reservations, stock movements,
  orders, payments, payment events, audit log, and support messages.
- Stock reservation at checkout under `BEGIN IMMEDIATE` with re-read of
  `availableStock` inside the synchronous critical section, and permanent
  stock decrement only after Pix payment confirmation. The 5-patient race
  test on the last unit is in `test/inventory-race.test.mjs`.
- Pix provider abstraction with local `dev-pix` and an Asaas adapter.
- Signed webhook gate for payment confirmation.
- Production refuses to boot with local `dev-pix`; `PAYMENT_PROVIDER=asaas`
  is required for `NODE_ENV=production`.
- Production startup gates for required secrets.

## Architecture Notes

- `server.mjs` is **frozen** to its existing endpoint surface. New API
  endpoints land as Next.js Route Handlers under `app/api/` and are
  delegated to via the `appRoutes` allow-list inside `server.mjs`. See
  `CLAUDE.md` for the frozen-server policy and the bridge pattern reused
  by Phase 5 (`/api/team/orders/status`), Phase 7 (`/api/team/support-replies`,
  `/api/team/support-thread`), and Phase 3 (`/api/team/activity`).
- Domain logic lives in `src/production-system.ts` and is reused by the
  HTTP surface and Route Handlers via a shared singleton.
- Persistence migrations follow an append-only `SCHEMA_MIGRATIONS` array in
  `src/sqlite-store.ts`. New phases append entries (never edit prior).
- All `.tx-*` and `.px-*` CSS Modules are scoped per-feature; design tokens
  live in `app/globals.css :root` and are documented in
  `docs/redesign/tokens.md`.

## Dev Quickstart

```bash
# One-time
npm install

# Long-running watchdog (keeps a dev server alive on :4184 across agent
# resets, idempotent: re-runs do nothing if the server already responds).
tmux new-session -d -s associacao-verde-watchdog "bash scripts/dev-watchdog.sh"

# Or one-shot (if you don't need the watchdog):
PORT=4184 \
  DB_FILE=/tmp/associacao-verde-dev.sqlite \
  DOCUMENT_STORAGE_DIR=/tmp/associacao-verde-dev-docs \
  NEXT_DEV=true \
  node --import tsx server.mjs

# Ensure TIAGO/TIAGO patient exists (idempotent helper).
node scripts/add-dev-user.mjs http://127.0.0.1:4184
```

Open:

```text
http://127.0.0.1:4184/
```

Local development credentials:

```text
Equipe email:    equipe@apoiar.local
Equipe senha:    apoio-equipe-dev
Paciente:        APO-1027 / HELENA2026
Paciente (dev):  TIAGO / TIAGO   (created/refreshed by add-dev-user.mjs)
Webhook Pix:     x-webhook-secret: dev-webhook-secret
```

Local defaults are intentionally development-only. `NODE_ENV=production` fails
closed unless required secrets are provided.

To clear local development data after smoke/E2E runs:

```bash
DB_FILE=/tmp/associacao-verde-dev.sqlite \
DOCUMENT_STORAGE_DIR=/tmp/associacao-verde-dev-docs \
npm run dev:reset
```

The reset command refuses to run when `NODE_ENV=production`.

### Production-style local run

```bash
npm start
```

This serves on the default port (`4174`) without HMR. The watchdog uses
`NEXT_DEV=true` for hot reload during agent work.

## Production Configuration

Required:

```text
NODE_ENV=production
DB_FILE=/persistent/associacao-verde.sqlite
TEAM_PASSWORD=<strong team password>
TEAM_EMAIL=<initial admin email>
SESSION_SECRET=<long random cookie signing secret>
PIX_WEBHOOK_SECRET=<provider webhook secret>
```

For Asaas Pix after account/compliance approval:

```text
PAYMENT_PROVIDER=asaas
ASAAS_API_KEY=<asaas access token>
ASAAS_CUSTOMER_ID=<default Asaas customer id for initial rollout>
ASAAS_BASE_URL=https://api.asaas.com/v3
```

The Asaas adapter creates a `billingType: PIX` charge, retrieves
`/payments/{id}/pixQrCode`, stores the provider payment id, and still only
converts the stock reservation after the signed webhook confirms payment.

## Verify

```bash
npm run check
npm test
npm run readiness:backup-drill
npm run readiness:webhook-drill
LOG_EVIDENCE_REF=<release log reference> npm run readiness:deployment-check
READINESS_DOMAIN_URL=https://<production-domain> npm run readiness:domain-tls
DB_FILE=<current sqlite path> npm run readiness:schema-check
READINESS_BASE_URL=<running app URL> npm run readiness:session-security
npm run readiness:backup-schedule
npm run readiness:release-gate
npm run smoke
npm run e2e
npm run verify:isolated
```

`npm test` currently runs **58/58** unit tests covering inventory invariants,
the 5-patient race on the last unit, fulfillment status transitions,
inventory lots, support thread, audit timeline grouping, the team activity
Route Handler, and the rest of the production surface.

`npm run check` includes a Next.js production build for the private route set.

`npm run readiness:backup-drill` creates a consistent SQLite backup, loads it
through the application store, and writes non-secret restore evidence for
`/admin` and `/api/team/readiness`.

`npm run readiness:webhook-drill` creates an isolated local order, proves an
unsigned Pix webhook is rejected, proves a signed webhook confirms payment and
decrements stock, and writes non-secret evidence for `/admin`.

`npm run readiness:deployment-check` verifies the release URL health endpoint,
protected-route redirect, sessionless catalog denial, and security headers. Use
`LOG_EVIDENCE_REF` to attach the log source reviewed for the release.

`npm run readiness:domain-tls` verifies the production URL uses HTTPS, a public
hostname, a trusted certificate, and a healthy `/health` response. Localhost and
plain HTTP URLs are rejected and keep the `Dominio/TLS` gate pending.

`npm run readiness:schema-check` records SQLite `user_version`, migration
ledger, and required table evidence for `/admin` and the release gate.

`npm run readiness:session-security` logs in through the team path and records
non-secret cookie evidence. Local HTTP can prove the cookie is signed,
`HttpOnly`, `SameSite=Lax`, path-scoped, and bounded by a 12-hour max age;
production release remains blocked until the same check proves a `Secure`
cookie on HTTPS.

`npm run readiness:release-gate` fails until provider approval, production
HTTPS deployment/log evidence, domain/TLS, signed webhook proof, database
schema, production session-cookie security, backup restore proof, and configured
offsite backup proof are all present.

`npm run readiness:backup-schedule` records non-secret offsite backup schedule
evidence. It remains pending unless an offsite target, frequency, retention,
encryption reference, last successful backup, last backup reference, operator,
and restore-drill checksum are present. Admin users can record provider and
offsite backup evidence from `/admin`; approved/configured statuses are rejected
unless the required proof fields are complete.

`npm run e2e` starts an isolated temporary server/database when `E2E_BASE_URL`
is not set, runs the browser checks (production-mode server so React hydrates
under Playwright), and writes visual evidence under `artifacts/visual-e2e/`.

`npm run verify:isolated` starts a temporary local server with its own SQLite
database and private document directory, runs readiness drills, smoke, and E2E,
then removes the temporary data. Use it for repeated release verification so
the shared dev URL is not mutated.

GitHub Actions runs the same production verification in
`.github/workflows/production-ci.yml`.

## Visual Evidence (per redesign phase)

The redesign was shipped in 13 phases. Each phase committed a Python
screenshot script under `scripts/p<N>-screenshots.py` that drives Playwright
against an isolated production-mode server and writes PNGs into
`artifacts/visual-e2e/redesign/p<N>-*-{desktop,mobile}.png`. The
`artifacts/` directory is gitignored, so reproductions are local-only —
re-run the script to regenerate the corresponding evidence:

| Phase | Surface                                                                                    | Script                       |
| ----- | ------------------------------------------------------------------------------------------ | ---------------------------- |
| P0    | Tokens applied across all surfaces                                                         | `scripts/p0-screenshots.py`  |
| P1    | Patient experience (login/empty/cart/Pix/tracking/history/support/blocked/consent/drawers) | `scripts/p1-screenshots.py`  |
| P3    | Team command center                                                                        | `scripts/p3-screenshots.py`  |
| P4    | Pedidos & Pix ledgers                                                                      | `scripts/p4-screenshots.py`  |
| P5    | Fulfillment kanban                                                                         | `scripts/p5-screenshots.py`  |
| P6    | Estoque & cultivo (single ledger)                                                          | `scripts/p6-screenshots.py`  |
| P7    | Support workbench                                                                          | `scripts/p7-screenshots.py`  |
| P8    | Command palette ⌘K                                                                         | `scripts/p8-screenshots.py`  |
| P9    | Admin readiness redesign                                                                   | `scripts/p9-screenshots.py`  |
| P10   | Audit timeline + team users                                                                | `scripts/p10-screenshots.py` |
| P12   | Mobile polish sweep (390 + 320, contact sheet)                                             | `scripts/p12-screenshots.py` |

Run any of them as `python3 scripts/p<N>-screenshots.py` after the dev
server is up. They self-bootstrap an isolated server when needed.

## Deployable Runtime

The repository includes a verified production `Dockerfile` and production
runbook:

```text
docs/production-runbook.md
```

The production health endpoint is:

```text
GET /health
```

## Migration From Archived Reference Data

The production import path is documented in:

```text
docs/migration-from-archive.md
```

Executable importer:

```bash
npm run import:archive -- <archive-export.json> <target.sqlite>
```

## Archived Reference Files

The following files are retained only as archived reference material and are not
the production application:

- `archived-ordering-reference.html`, `archived-ordering-reference.css`, `archived-ordering-reference.js`
- `docs/audio-requirements.md`
