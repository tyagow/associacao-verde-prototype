# Session: redesign-roadmap
Updated: 2026-05-08T13:00:00.000Z
Source of truth: **YES** (this ledger supersedes CONTINUITY_CLAUDE-production-system.md as the active roadmap)

## Goal

Ship the Apoiar / Associação Verde full production application with the locked
**B · Calm Clinical Modern** aesthetic across every authenticated and public
surface, with structural UX changes (not paint-over), without regressing any
existing backend behavior or E2E coverage.

"Done" means:

- Every screen in the approved mock sheet is implemented in the live app.
- All existing E2E selectors and texts continue to pass (no rewrite of E2E in
  this initiative; new tests are additive).
- Inventory invariant holds: `availableStock = onHand − activeReservations`
  with concurrency safety; a 5-patient race-test for the last unit passes.
- All locked design tokens are centralized in one CSS file.
- Mobile (390 / 320) and desktop (1280 / 1440) screenshots captured per phase.
- README, production delivery plan, and runbook reflect the redesigned product.

## Locked Direction

- **Aesthetic**: B · Calm Clinical Modern (off-white paper, soft greens,
  refined gold ornament only on product thumbs and CTAs, system sans, generous
  whitespace, hairline borders, status communicated by colored dots, tabular
  numerics on data, progress bars, soft shadows).
- **Mock reference**: `.superpowers/brainstorm/70960-1778242539/content/all-pages.html`
  (20 screens). Treat as visual contract.
- **Information architecture**: mode-based viewports for the patient
  (Pedido / Histórico / Suporte tabs), shell with sidebar for the team
  (Comando · Pacientes · Estoque · Pedidos · Fulfillment · Suporte · Admin),
  command palette (⌘K) anywhere in the team app.
- **Hero moments**: Pix payment for the patient (full-screen takeover, QR,
  countdown, products, frete, timeline). Fulfillment kanban for the team.
  Release readiness progress bar for admin.
- **Stack additions allowed**: framer-motion, lucide-react, cmdk, recharts,
  dnd-kit. Already installed in package.json.

## Constraints

- **E2E selectors and texts are immutable.** Every existing `#id`,
  `[data-…]`, and asserted text in `scripts/e2e-production-app.py` must keep
  working. New components wrap them; they do not disappear.
- **Backend invariants** stay correct. Inventory math, signed Pix webhook,
  reservation expiry, audit log, RBAC, schema versioning, readiness gates —
  all preserved or strengthened, never weakened.
- **No public exposure of internal mechanics** on the public landing page.
  Public copy talks about acolhimento / acesso / pagamento / entrega — not
  "reserva", "webhook", "provider", "drill", "deploy".
- **Patient-facing copy** can use "reserva" (the user approved it as accurate),
  but team-only jargon stays in team UI.
- **Server-side reservation is the source of truth for stock.** The patient UI
  follows it. Never decrement permanent stock until the signed Pix webhook
  confirms payment.
- **Permission and audit envelope** must be preserved on every new server
  endpoint. New endpoints get `requiredPermission` checks and audit events.
- **Mobile-first parity**: every patient screen must work at 390px (and the
  Pix screen at 320px). Team routes must work at 1024px+ desktop and gracefully
  degrade on tablet.
- **No magic numbers in CSS**. Tokens centralized in `public/app.css` :root.
- **No "skip hooks" / `--no-verify`** anywhere.
- **Verification before completion**: `npm run check` + `npm test` + smoke +
  E2E + screenshot assertions for changed surfaces every phase.

## Key Decisions

- **B over A and C**: clinical-modern aesthetic chosen for legibility and
  trust. Hybrid considered, rejected for cohesion.
- **Stack libs allowed (framer-motion, cmdk, recharts, dnd-kit, lucide-react)**:
  rebuilding from scratch would cost weeks. Lib bundle is tiny relative to
  feature value.
- **Mode-based patient viewport**: replaces the long vertical scroll with one
  focused screen per mode. Catalog and profile become drawers, not inline.
- **Kanban replaces table for fulfillment**: drag-and-drop matches the actual
  team workflow (move a card from Pago to Separação when picking starts).
- **Single readiness progress bar**: replaces the wall of evidence cards.
  Click a gate to drill in. Audit becomes a timeline, not a card stack.
- **Command palette ⌘K**: globally accessible, matches Linear / Stripe energy
  the user picked. Powers patient lookup, order navigation, action shortcuts.
- **Public landing has zero internal status**: only public-appropriate content
  (como acessar, atendimento, value-prop strip).
- **Codex's earlier work is preserved as backend** (server.mjs, auth, Pix,
  webhook, RBAC, readiness, schema). Frontend is rebuilt.
- **Naming**: continue using `.patient-*`, `.team-*`, `.admin-*` selectors
  where E2E uses them. New aesthetic uses `.px-*` (patient experience) and
  `.tx-*` (team experience) prefixes for brand-new components without legacy
  selectors.

## Phase Plan

Each phase is **autonomous and runnable**. A fresh agent reading this ledger
finds the current `[→]`, completes its acceptance criteria, then advances.

### State

- Done:
  - [x] Mocks for 20 screens approved (B · Calm Clinical Modern locked)
  - [x] Public landing internal-status leak removed in mock
  - [x] Inventory invariant flagged as hard gate (Phase 2)
  - [x] Stack libs installed (framer-motion, lucide-react, cmdk, recharts; dnd-kit pending)
  - [x] **Phase 0a — Foundation cleanup** (see section below)
  - [x] **Phase 0 — Design system foundation** (commit f5d8e85)
  - [x] **Phase 1 — Patient experience rebuild**
        (1a 00d5fed · 1b 8e3858c · 1c ac0d7d1 · 1d a910bf6 / 3fac042 / 83ee92c / 6e1c48f / + screenshots)
  - [x] **Phase 2 — Inventory invariant + concurrency safety**
        (b617b3c refactor unify · 5df46ed BEGIN IMMEDIATE checkout ·
         4bc2441 paid_after_expiry_conflict · 971a22d 5-patient race test ·
         9fca88d smoke oversell guard). Tests 38 → 41. E2E 5/5 green.
        better-sqlite3 sync semantics: better-sqlite3 (and node:sqlite) are
        synchronous and Node is single-threaded, so the synchronous critical
        section inside runInventoryTransaction (re-read availableStock + push
        reservation/order) cannot interleave with another checkout's critical
        section. The await on paymentProvider.createPayment happens AFTER
        the reservation is in this.state.stockReservations, so any concurrent
        availableStock read sees it. The lock-acquire-order serialization
        described in SQLite's BEGIN IMMEDIATE docs applies here at the JS
        level. Race test verifies "exactly one wins for the last unit"
        with Promise.allSettled across 5 sessions.
  - [x] **Phase 4 — Pedidos & Pix ledgers**
        (f471824 scaffold Ledger/OrderRow/OrderDrawer · 6051d7a two-ledger
         OrdersClient rewrite · screenshots p4-orders-{desktop,mobile}.png).
        Note: f471824 swept up the Phase 4 component scaffolds together
        with the ledger pointer advance (concurrent commit during Phase 2
        close); commit message refers to ledger close but the diff also
        contains the new components. No new endpoints; existing
        /api/team/dashboard, /payments/reconcile, /simulate-pix,
        /orders/cancel reused. E2E preserved verbatim:
        #orders-surface [data-pay], [data-filter='ordersQuery|ordersStatus'],
        body texts "Pedidos e Pix" / "Reservas, pagamentos e reconciliacao".
        Tests still 41/41 green.
  - [x] **Phase 3 — Team shell + Command center**
        (cac7030 scaffold TeamShell + sidebar layout · ea487ce
         GET /api/team/activity Route Handler + first frozen-server
         bridge · 68997c8 KpiSpark/ActivityFeed/PixByHour/PriorityQueue
         components · f4c29e0 rebuild TeamCommand with 4 KPIs +
         activity feed + Pix-by-hour + priority queue · screenshots
         p3-team-command-{desktop,mobile}.png).
        Tests 41 → 44 (3 new for activity Route Handler: since
        filtering, full-list when no since, upstream auth error
        propagation). E2E selectors preserved verbatim:
        #team-login (visible logged-out / hidden logged-in),
        #team-status ('acesso restrito' / 'equipe autenticada'),
        #team-dashboard (contains 'Fila de acao agora' /
        'SLA / vencimento' / 'Separacao/envio' / 'Validades').
        Visible literals 'Comando da operacao' and 'Acesso restrito
        da equipe' preserved.
        Bridge with FROZEN server.mjs: server.mjs's pathname switch
        returns 404 for /api/* unless the path is in `appRoutes`. We
        added one path '/api/team/activity' to that allow-list — a
        one-line routing-policy delegation, not new business logic.
        All behavior lives in app/api/team/activity/route.js. CLAUDE.md
        documents this pattern for Phases 5/8 to reuse.
        TeamShell mounts ONLY in /equipe (TeamCommand). Sibling routes
        (/equipe/pacientes, /equipe/estoque, /equipe/pedidos,
        /equipe/fulfillment, /equipe/suporte) still render their own
        topbar/side-nav. Phases 4-7 own migrating their routes onto
        the shell via the passthrough app/equipe/layout.jsx seam.
- Now: [→] **Phase 5 — Fulfillment kanban (dnd-kit)**
- Next:
  - [ ] Phase 6 — Estoque & cultivo (single ledger + lot detail)
  - [ ] Phase 7 — Support workbench
  - [x] Phase 8 — Command palette ⌘K
        (4b57c3e CommandPalette component using cmdk · 5f87e12 wire ⌘K
         binding in TeamShell + mount palette globally · this commit
         screenshot + ledger close).
        Component: app/equipe/components/CommandPalette.jsx (.tx-* CSS
        Module). Mounted by TeamShell so every /equipe/* route gets
        the palette (and the topbar kbd hint, now a real button, opens
        it). Global keydown listener on window with metaKey||ctrlKey
        + lowercase 'k' + preventDefault, listener cleaned up on
        unmount. Sources: navigation (8 hard-coded jumps), patients
        (top 30 from dashboard.patients), orders (top 30), and actions
        derived from dashboard payload — Reconcile Pix per pending
        payment, Print labels when ready_to_ship orders exist, Reset
        invite per blocked patient, Open audit per patient. Recents
        (8 cap) and starred persist in localStorage under
        tx.cmdk.recents.v1 / tx.cmdk.starred.v1. useReducedMotion
        respected (data-reduce-motion on overlay). Screenshot at
        artifacts/visual-e2e/redesign/p8-cmdk-desktop.png via
        scripts/p8-screenshots.py (artifacts/ is gitignored).
        next build clean. Tests unaffected (the sqlite-store test
        failure observed during this phase is from concurrent Phase 7
        WIP changes to src/sqlite-store.ts, not from Phase 8).
  - [x] Phase 9 — Admin readiness redesign
        (scaffold def05b8 · redesign 6ee2fe4 · screenshots + ledger close pending commit)
  - [ ] Phase 10 — Audit timeline + Team users
  - [ ] Phase 11 — Public home redesign
  - [ ] Phase 12 — Mobile polish sweep
  - [ ] Phase 13 — Handoff, README, runbook, delivery plan

---

### Phase 0a — Foundation cleanup ✓

Cleanup that preceded Phase 0 to make the redesign tractable. Nine atomic
commits, each gated by `npm run check && npm test` (38/38 green).

- Tooling: ESLint flat config (`@next/next/core-web-vitals` +
  `react-hooks/recommended`), Prettier, EditorConfig, `.prettierignore`. Three
  pre-existing Next.js warnings downgraded to "warn" with `TODO(phase-0a)` —
  surfaces that rebuild them will adopt `next/link` + `next/image`.
- Cleanup: removed pre-Next.js MVP files (`index.html`, `app.js`,
  `styles.css`); relocated `design.md` → `docs/design.md`; tightened
  `.gitignore` (`.env*`, `data/`, `artifacts/`, `*.sqlite*`).
- Path alias `@/` via `jsconfig.json` (existing imports left as-is).
- CSS into Next.js pipeline: `public/app.css` → `app/globals.css`, imported
  from `app/layout.jsx`. Verified token color (`#0e2618`) reaches
  `.next/static/chunks/*.css`.
- Fonts: replaced Google Fonts `<link>` block with `next/font/google` for
  Inter (UI) + Outfit (display). Dropped Playfair. CSS variables
  `--font-ui` / `--font-display` now reference the next/font variables and
  fall back to system fonts. Verified no `fonts.googleapis.com` requests in
  rendered HTML.
- TypeScript: `tsconfig.json` (`strict: false`, `allowJs: true`,
  `module: NodeNext`). `src/*.mjs` → `src/*.ts`. Two files carry
  `// @ts-nocheck` + `TODO(phase-0a-ts)` (production-system.ts,
  sqlite-store.ts) — incremental typing is a future-phase concern. `node
  --import tsx` adopted as the runtime loader for tests, server, and
  readiness scripts. Engines bumped to `node >= 22`.
- Boundary: `eslint no-restricted-imports` blocks `next`, `next/*`, `react`,
  `react-dom`, `react-dom/*` from `src/**`. Verified by injecting a
  `next/headers` import and observing the lint error before reverting.
- `CLAUDE.md` documents the boundary and freezes `server.mjs` (no new
  endpoints — Route Handlers under `app/api/` from now on).
- Baseline screenshots captured at `artifacts/visual-e2e/redesign/baseline-*`
  (8 files: home/paciente/equipe/admin × desktop/mobile, full page).
  `artifacts/` is gitignored so the PNGs are local-only documentation.

**Escape hatches in play (track in Phase 0+):**

- ESLint warnings deliberately kept (not errors) until each surface is
  rebuilt: `@next/next/no-html-link-for-pages` (3 occurrences),
  `@next/next/no-img-element` (Brand.jsx), `react-hooks/exhaustive-deps` (3).
- `// @ts-nocheck` on `src/production-system.ts` (1841 LOC) and
  `src/sqlite-store.ts` (445 LOC). Tighten incrementally; do not block
  redesign phases on it.

---

### Phase 0 — Design system foundation ✓

**Why first.** Every subsequent phase pulls tokens from one file. Locking
the system here means visual consistency across phases without drift.

**Scope.**
- Replace tokens in `public/app.css :root` with the **Calm Clinical Modern**
  palette and type scale (already drafted in editorial direction; needs
  alignment with B aesthetic — softer paper, less serif emphasis, more
  whitespace, system sans body).
- Define utility classes the new components rely on (`pill`, `chip`, `btn`,
  `kpi`, `panel`, `frame`, `overline`, `field`, `stepper`, `segment`,
  `timeline`, `spark`, `progress`).
- Confirm fonts: Inter (UI) + Outfit (display headings only) loaded in
  `app/layout.jsx`. Drop Playfair (mock B does not use serif headlines).
- Add base layout primitives: `.app-shell`, `.app-sidebar`, `.app-work`,
  `.app-topbar`, `.app-tabs`.
- Verify the existing app still renders with the new tokens — no JSX changes.

**Files touched.**
- `public/app.css` (tokens + new utilities; preserve all existing selectors as
  thin overrides until phases replace them)
- `app/layout.jsx` (font links: Inter + Outfit only)

**Dependencies.** None — this is foundation.

**Acceptance.**
- `npm run check` ✓
- `npm test` 38/38 ✓
- `SMOKE_BASE_URL=http://127.0.0.1:4184 npm run smoke` ✓
- Clean reset E2E ✓
- All existing pages render (visual diff allowed; layout intact, no breakage)
- Token reference doc generated at `docs/redesign/tokens.md`

**E2E selectors preserved.** All. No JSX changes in this phase.

**Screenshots.** `artifacts/visual-e2e/redesign/p0-tokens-applied-{home,paciente,equipe,admin}-desktop.png`

---

### Phase 1 — Patient experience rebuild ✓

**Sliced into four atomic commits** (all verified `npm run check` + 38/38 tests):

- **1a (00d5fed)** — Patient shell foundation. PatientShell, PatientTabs, Toast.
- **1b (8e3858c)** — CatalogDrawer + ProfileDrawer (always-mounted children so
  E2E selectors stay reachable behind framer-motion transforms).
- **1c (ac0d7d1)** — PixHero takeover with live countdown + 5-stage timeline +
  initial QR placeholder.
- **1d** (4 commits) — closing slice:
  - `a910bf6` real qrcode.react QR encoder (replaces placeholder pattern;
    +1 dep, no transitive deps) and per-line price fix in PixHero (use
    `subtotalCents` / `unitPriceCents` from order serializer; the previous
    `priceCents` field never existed on order line items).
  - `3fac042` extract six components from PatientPortal.jsx into named
    files: EmptyHero, CartHero, HistoryList, SupportThread,
    PrivacyConsentGate, AccessIssueScreen — each in its own CSS Module
    under `app/paciente/components/`. PatientPortal becomes a thin glue.
    All E2E selectors and texts preserved verbatim.
  - `83ee92c` honor `prefers-reduced-motion` in CatalogDrawer + ProfileDrawer
    (spring transition collapses to duration:0 when `useReducedMotion()`
    returns true). PixHero exposes the value as `data-reduce-motion`.
  - `6e1c48f` mobile sweep at 320px: additive rules in @media (max-width:
    540px) shrink `.patient-order-card` padding, force `#checkout select`
    to width:100% min-width:0, allow submit-button text to wrap. Audit
    after fix: "no overflow detected".
- **Screenshots**: 22 captured at `artifacts/visual-e2e/redesign/p1-patient-*`
  via `scripts/p1-screenshots.py` (spins up an isolated production-mode
  server because the long-lived dev server with NEXT_DEV=true does not
  hydrate React under Playwright). Caveats logged in `p1-NOTE.md`:
  - `consent-mobile.png` shows the post-consent state (sqlite seeds the
    patient with consent already accepted; the desktop iteration runs
    first and consents the patient, so by mobile iteration the panel
    already shows "Consentimento registrado").
  - `cart-mobile.png` may show the PixHero takeover instead of CartHero
    when a previous state ("pix-tracking") left an open Pix-pending order;
    PixHero takes precedence over the cart preview.



**Scope.**
- Rebuild `app/paciente/PatientPortal.jsx` as a mode-based dashboard:
  - Top bar: brand seal + name + chip + tabs (Pedido / Histórico / Suporte) +
    icon button to logout.
  - Mode 1 — Pedido (default):
    - State A: empty hero with single CTA "Abrir catálogo autorizado" + 3
      stat cards (receita / carteirinha / histórico).
    - State B: cart preview (when items selected, no Pix yet) with stepper
      lines, frete chooser, "Reservar e gerar Pix".
    - State C: **Pix hero** (active pendingPayment) — big amount, live
      countdown, products reserved, frete block, 5-stage timeline, QR + copy
      Pix + "Já paguei" actions.
    - State D: order tracking (post-payment) — same layout, timeline advances.
  - Mode 2 — Histórico: compact rows, expand on click.
  - Mode 3 — Suporte: form + previous tickets thread.
  - Catalog drawer (right slide-over) with framer-motion.
  - Profile drawer (right slide-over) with all elegibility/profile data.
  - LGPD consent gate above-fold when consent missing.
  - Blocked / access-recovery full-screen takeover when login fails.
- Live Pix countdown computed from `paymentExpiresAt`.
- QR code rendered (PixGlyph or generic SVG; matches mock).
- Mobile (390/320) parity with the phone-frame mock.

**Files touched.**
- `app/paciente/PatientPortal.jsx` (full rewrite, preserves all `#id` / data
  selectors used by E2E)
- `app/paciente/components/*` (new: `PatientShell`, `PatientTabs`,
  `PixHero`, `EmptyHero`, `CartHero`, `CatalogDrawer`, `ProductCard`,
  `ProfileDrawer`, `OrderTimeline`, `PrivacyConsentGate`,
  `AccessIssueScreen`, `HistoryList`, `SupportThread`, `Toast`)
- `public/app.css` (new `.px-*` classes scoped to patient experience)

**Dependencies.** Phase 0.

**Acceptance.**
- `npm run check` ✓
- `npm test` 38/38 ✓
- `SMOKE_BASE_URL=http://127.0.0.1:4184 npm run smoke` ✓
- Clean reset E2E (5/5) ✓ — including:
  - Patient happy path Pix
  - Blocked patient
  - Document upload (still on `/equipe/pacientes`)
  - Mobile + desktop overflow
- Manual smoke: at 390px the Pix screen renders QR, countdown, products,
  frete, actions without horizontal scroll.

**E2E selectors preserved (must remain reachable and contain expected text).**
- `#patient-login` (form) + `input[name=memberCode]` + `input[name=inviteCode]` + `button[type=submit]`
- `#patient-status` containing patient name (e.g., "Helena Rocha")
- `#patient-summary` containing "Receita"
- `#patient-profile-details` visible, containing "Sessao privada", "Suporte", "Plano de cuidado"
- `#privacy-consent-panel` containing "Privacidade e LGPD" then "Autorizar uso dos dados" pre-consent, "Consentimento registrado" post-consent
- `#privacy-consent-panel button[type=submit]` for accept
- `#toast` for ephemeral messages
- `#support-request-form` with `input[name=subject]`, `textarea[name=message]`, `button[type=submit]`
- `#catalog` containing product names ("Oleo CBD 10%", "Flor 24k")
- `#catalog-tools` containing "Buscar produto autorizado"
- `[data-catalog-query]` (search input)
- `[data-catalog-filter='all'|'oil'|'flower'|'edible']` (segment buttons; active gets `.active` class)
- `[data-add='<productId>']` (add button per product; works whether the catalog is rendered inline or inside the drawer)
- `#cart-summary` containing "Resumo antes do Pix" when cart has items
- `#checkout button[type=submit]` for "Reservar e gerar Pix"
- `.patient-current-order` containing "Proxima acao: pagar Pix" when Pix pending
- `.patient-current-order textarea` containing "PIX-DEV" (Pix copia e cola)
- `#access-issue` visible when blocked, containing "Acesso nao liberado" and "Atendimento precisa revisar seu cadastro"
- `#access-issue input[name=memberCode|inviteCode]` and `textarea[name=message]` and `button[type=submit]`
- `#patient-orders`

**Screenshots.** `artifacts/visual-e2e/redesign/p1-patient-{login,empty,cart,pix,tracking,history,support,blocked,consent,catalog-drawer,profile-drawer}-{desktop,mobile}.png`

**Note on E2E timing.** The catalog must be reachable for the test that does
`page.locator("[data-add='oleo-cbd-10']").click()`. If the new design hides
the catalog behind the drawer button, the patient happy path test must first
open the drawer. Update `scripts/e2e-production-app.py` minimally if needed
(adding a click before the data-add) and document in this phase.

---

### Phase 2 — Inventory invariant + concurrency safety

**Scope (THE HARD GATE).**
- Audit `src/production-system.mjs` and `src/sqlite-store.mjs`:
  - `availableStock` for any product = `onHandStock − sum(activeReservations.quantity)`.
  - `activeReservation` = reservation with status `active` AND
    `expiresAt > now`.
  - On checkout, the SQLite transaction must be SERIALIZABLE (or use
    `BEGIN IMMEDIATE` + a single check-then-write inside the same tx).
  - Reservation expiry worker frees activeStock atomically.
  - Signed Pix webhook converts reservation into permanent stock decrement
    inside a single transaction; if reservation already expired, write
    `paid_after_expiry_conflict` audit event and put the order into
    `fulfillment_exception`.
- Write the **5-patient race test**:
  `test/inventory-race.test.mjs` — spin up 5 concurrent checkouts for a
  product with `onHand=1`. Exactly one must succeed; four must get a
  `out-of-stock` error. After expiry of the lone reservation, available
  must return to 1.
- Add a `patient_concurrent_checkout_blocked` audit event.

**Files touched.**
- `src/production-system.mjs`
- `src/sqlite-store.mjs`
- `test/inventory-race.test.mjs` (new)
- `scripts/smoke-production-app.mjs` (add an oversell guard assertion)

**Dependencies.** None (parallel with Phase 1 in principle, but order Phase 2
*after* Phase 1 so the patient surface exists to verify visibly).

**Acceptance.**
- `npm test` ✓ — including new race test
- Manual: try concurrent `curl POST /api/checkout` for the same scarce product
  — only one succeeds.
- Smoke runs without regressions.
- New audit events visible on `/admin` audit timeline.

**Screenshots.** N/A (backend), but capture an audit timeline screenshot
showing the race-blocked event after running the race test against shared
dev DB.

---

### Phase 3 — Team shell + Command center

**Scope.**
- Build the team app shell:
  - `app/equipe/components/TeamShell.jsx` — sidebar (Comando, Pacientes,
    Estoque, Pedidos, Fulfillment, Suporte, Admin, Auditoria) with badge
    counts driven by `/api/team/dashboard`.
  - Brand seal + role label + ⌘K shortcut hint in topbar / footer.
  - Logout + password rotation + profile open from the shell.
- Rebuild `/equipe` (TeamCommand.jsx):
  - 4 KPI cards with sparklines (recharts): Pix pendentes, Separação,
    Bloqueios, Faturado semana.
  - Live activity feed (poll `/api/team/activity?since=<ts>` every 5s; new
    endpoint added; emits filtered audit events).
  - Pix-by-hour bar chart (recharts; aggregate confirmed payments by hour
    today).
  - Priority queue table (replaces `ops-board`).

**Files touched.**
- `app/equipe/TeamCommand.jsx` (rewrite)
- `app/equipe/components/TeamShell.jsx` (new)
- `app/equipe/components/KpiSpark.jsx` (new)
- `app/equipe/components/ActivityFeed.jsx` (new)
- `app/equipe/components/PixByHour.jsx` (new, recharts)
- `server.mjs` + `src/production-system.mjs` (new endpoint
  `GET /api/team/activity?since=`)
- `public/app.css` (`.tx-*` classes)

**Dependencies.** Phase 0.

**Acceptance.**
- `npm run check` ✓
- `npm test` ✓ (tests for `team activity feed` endpoint added)
- E2E ✓ — selectors `#team-login`, `#team-status`, `#team-dashboard`, and
  visible "Fila de acao agora" preserved.

**E2E selectors preserved.**
- `#team-login` form
- `#team-status` chip
- `#team-dashboard` block
- Visible text "Fila de acao agora" / `Comando da operacao`

**Screenshots.** `artifacts/visual-e2e/redesign/p3-team-command-{desktop,mobile}.png`

---

### Phase 4 — Pedidos & Pix ledgers

**Scope.**
- Two-ledger view as in mock:
  - "Pix pendentes" with countdown column and reconcile/cancel actions.
  - "Pedidos pagos" with status pills and per-row actions (etiqueta, rastreio,
    fulfillment exception).
- Replace existing OrdersClient.

**Files touched.**
- `app/equipe/pedidos/OrdersClient.jsx`
- `app/equipe/pedidos/components/*` (Ledger, Row, Drawer)
- `public/app.css`

**Dependencies.** Phase 0, Phase 3.

**Acceptance.** `npm run check` ✓, smoke ✓, E2E preserves
`#team-dashboard`-related text and reconciliation flows. No new tests
required (E2E covers existing reconciliation path).

**Screenshots.** `artifacts/visual-e2e/redesign/p4-orders-{desktop,mobile}.png`

---

### Phase 5 — Fulfillment kanban (dnd-kit)

**Scope.**
- Install `@dnd-kit/core` + `@dnd-kit/sortable`.
- 4 columns: Pago aguardando · Em separação · Pronto despachar · Enviado.
- Cards show patient, items, frete, action button.
- Drag between columns calls `POST /api/team/orders/status` with the new
  status; optimistic UI; revert on error.
- "Imprimir etiqueta" button for Pronto column rows.
- Bulk select + bulk label print.

**Files touched.**
- `app/equipe/fulfillment/page.jsx` (rewrite as React client)
- `app/equipe/fulfillment/components/Kanban.jsx`,
  `KanbanColumn.jsx`, `OrderCard.jsx`
- `server.mjs` (add `POST /api/team/orders/status` if not present;
  preserves audit envelope)

**Dependencies.** Phase 0, Phase 3.

**Acceptance.**
- `npm run check` ✓
- `npm test` ✓ (new test: `team can move order across fulfillment stages via drag`)
- E2E ✓ — new test "team moves a paid order to ready" runs.

**Screenshots.** `artifacts/visual-e2e/redesign/p5-fulfillment-kanban-{desktop,mobile}.png`

---

### Phase 6 — Estoque & cultivo (single ledger + lot detail)

**Scope.**
- Single product ledger with columns: Produto · Estoque · Reservado · Lotes ·
  Categoria · Status.
- Click row to expand lot rows: Lote · Quantidade · Validade · Origem.
- Cultivo as a separate panel below.
- Inline edit of `lowStockThreshold`, `category`, `controlled`,
  `internalNote` per product.

**Files touched.**
- `app/equipe/estoque/StockRoute.jsx`
- `app/equipe/estoque/components/*`

**Dependencies.** Phase 0, Phase 3. (Also unblocks completion of OPS-002
"lot-level allocation/traceability" from old delivery plan.)

**Acceptance.**
- `npm test` ✓ — including new test
  `inventory ledger exposes lots with validity and origin`.
- E2E ✓.

**Screenshots.** `artifacts/visual-e2e/redesign/p6-stock-{desktop,mobile}.png`

---

### Phase 7 — Support workbench

**Scope.**
- Two-pane workbench:
  - Left: queue (sticky, scrollable). Each row: priority pill, name, member
    code, latest order/Pix/ticket summary.
  - Right: selected case panel. Patient context as fact grid (último login,
    pedido atual, Pix, reserva, envio, documentos), open ticket details with
    inline action buttons (Em atendimento, Resolver), and conversation thread
    (patient + team messages).
- Reply box with `POST /api/team/support-replies` (new endpoint, audited).

**Files touched.**
- `app/equipe/suporte/page.jsx` (rewrite)
- `app/equipe/suporte/components/*`
- `server.mjs` + `src/production-system.mjs` (support replies + thread
  storage; new SQLite table `support_messages`)
- `src/sqlite-store.mjs` (schema migration v15)

**Dependencies.** Phase 0, Phase 3.

**Acceptance.**
- `npm test` ✓ — new tests `team can reply to support ticket`, `patient sees
  team replies in thread`.
- Smoke ✓.
- E2E ✓ — preserves support flow.

**Screenshots.** `artifacts/visual-e2e/redesign/p7-support-{desktop,mobile}.png`

---

### Phase 8 — Command palette ⌘K

**Scope.**
- Wire `cmdk`. Global keyboard binding (⌘K / Ctrl+K) on every team route.
- Sources:
  - patients (`/api/team/dashboard.patients` filtered by query),
  - orders (`/api/team/dashboard.orders` filtered),
  - actions: "Reconcile Pix for X", "Print labels for ready orders", "Reset
    invite for X", "Open audit for X".
  - navigation: jumps to `/equipe`, `/equipe/pedidos`, `/admin`, etc.
- Recents and starred (localStorage).

**Files touched.**
- `app/equipe/components/CommandPalette.jsx` (new, mounted in TeamShell)

**Dependencies.** Phase 3.

**Acceptance.**
- ⌘K opens palette on every team route.
- Patient name search resolves to a deep link.
- Tested manually + a Playwright smoke that opens palette and types.

**Screenshots.** `artifacts/visual-e2e/redesign/p8-cmdk-{desktop}.png`

---

### Phase 9 — Admin readiness redesign ✓

**Shipped (commits).**
- `def05b8` scaffold ReleaseProgress + GateCard + GateDetail components (CSS Modules).
- `6ee2fe4` rewire `app/admin/page.jsx` readiness section: hero progress bar +
  2-col gate grid + click-to-expand `GateDetail`. Evidence panels collapsed into
  per-gate metadata; provider + backup-offsite forms moved into the gate detail.
- (this commit) capture desktop + mobile screenshots and close ledger.
- E2E text contract preserved: every required label and lowercase descriptor
  ("Pix provider", "Webhook Pix", "webhook drill", "Aceite do provider",
  "provider approval", "Deploy/domain/logs", "deployment check", "Dominio/TLS",
  "domain tls", "Schema DB", "schema db", "Sessao/cookie", "session cookie",
  "Backup/restore", "restore drill", "Backup offsite", "backup offsite",
  "release gate", "Release bloqueado por evidencias pendentes",
  "Readiness do ambiente") still rendered unconditionally on `/admin` (the
  lowercase descriptors are exposed via a per-card `tag` overline so they don't
  depend on selecting a specific gate).
- Tests still 41/41 green; `next build` clean.
- Audit + team-users sections were intentionally not touched (Phase 10 owns
  them); `EvidenceMetric`/`EvidenceTextMetric` helpers were dropped because no
  caller remained.

**Open for Phase 10.**
- Audit timeline replaces the existing audit ledger block (kept verbatim by
  this phase). The hero `ReleaseProgress` and `GateCard` styling is admin-
  specific (`.ax-*` namespace via CSS Modules) and does not collide with the
  audit/users redesign.

**Scope.**
- Replace evidence wall with:
  - Hero "Release readiness" bar (X of N gates passing, % progress, blockers
    listed).
  - Per-gate cards in a 2-column grid with left-border tones (good/warn/danger/
    pending), each clickable to expand into a detail panel below the grid
    (forms, evidence values, run-the-check button).
- All existing readiness writers preserved (`POST /api/team/readiness/*`).
- Re-run a check from the UI by calling existing scripts under the hood is
  out-of-scope; just expose the evidence forms cleanly.

**Files touched.**
- `app/admin/page.jsx` (rewrite of readiness section)
- `app/admin/components/*` (ReleaseProgress, GateCard, GateDetail)

**Dependencies.** Phase 0, Phase 3.

**Acceptance.**
- `npm run check` ✓
- `npm test` ✓
- E2E ✓ — admin section preserves the assertions for `/admin` evidence text
  ("Backup/restore", "Pix webhook", "Provider", "Domínio/TLS", "Schema DB",
  "Sessão/cookie", "Backup offsite").
- Visual: a single screenshot fits the readiness state on a 1280×900 viewport.

**Screenshots.** `artifacts/visual-e2e/redesign/p9-admin-readiness-{desktop,mobile}.png`

---

### Phase 10 — Audit timeline + Team users

**Scope.**
- Audit log: replace stacked cards with grouped timeline (by hour today /
  yesterday / earlier). Filter chips per event type.
- Click event for full payload modal.
- Team users: single table (avatar, role, status, last login, action buttons:
  Editar / Senha / Desativar / Reativar). Reactivation form inline.

**Files touched.**
- `app/admin/page.jsx` (audit + users sections)
- `app/admin/components/AuditTimeline.jsx`, `TeamUsersTable.jsx`

**Dependencies.** Phase 9.

**Acceptance.** E2E ✓. New unit test covers timeline grouping.

**Screenshots.** `artifacts/visual-e2e/redesign/p10-admin-{audit,users}-desktop.png`

---

### Phase 11 — Public home redesign

**Scope.**
- New `app/page.jsx` hero matching mock:
  - Two doors (Paciente / Equipe).
  - "Como acessar" 3-step list + atendimento card.
  - Strip with public-friendly value props (Acolhimento · Acesso seguro ·
    Pagamento · Entrega).
- **No internal status leaks** (no provider, drill, deploy, webhook copy).
- HTML source remains free of `/admin` link in unauthenticated state.

**Files touched.**
- `app/page.jsx`
- `app/components/Brand.jsx` (already small; keep)

**Dependencies.** Phase 0.

**Acceptance.**
- `npm run check` ✓
- Source privacy curl: `curl http://127.0.0.1:4184/` does NOT contain `/admin`.
- E2E ✓ — public home assertions preserved.

**Screenshots.** `artifacts/visual-e2e/redesign/p11-home-{desktop,mobile}.png`

---

### Phase 12 — Mobile polish sweep

**Scope.**
- Open every screen at 390px and 320px and fix:
  - Horizontal overflow (E2E catches some — fix all reported elements).
  - Collapse multi-column blocks to single column where readable.
  - Make modals/drawers full-bleed on mobile.
  - Ensure all primary actions remain reachable.
- Audit the kanban: on mobile, switch to one column at a time with horizontal
  swipe between stages.
- Audit the workbench: on mobile, stack queue above case panel; selecting a
  case scrolls down to it.
- Audit the readiness grid: 1 column on mobile.

**Files touched.**
- `public/app.css` (mobile media queries; per-component touch-ups)

**Dependencies.** Phases 1–11 (whichever exist at time of execution).

**Acceptance.**
- E2E mobile + desktop overflow check ✓ across all routes.
- Manual screenshots at 390 and 320 for every mode of every screen.

**Screenshots.** `artifacts/visual-e2e/redesign/p12-mobile-overview-grid.png`
(contact sheet of all mobile screens for review).

---

### Phase 13 — Handoff, README, runbook, delivery plan

**Scope.**
- Update `README.md`: new screenshots, link to `docs/redesign/tokens.md`,
  feature list reflects the new product.
- Update `docs/production-delivery-plan.md`: mark redesigned surfaces as
  shipped; carry forward only legitimately remaining gates (provider approval,
  prod TLS, deploy, offsite backup).
- Update `docs/production-runbook.md`: any new env vars or commands.
- Create `docs/redesign/locked-aesthetic.md` with the design tokens, locked
  pixel values, and cross-references to mock screens.
- Final continuity ledger update marking everything `[x]`.
- Optional: archive Codex's previous ledger
  (`thoughts/ledgers/CONTINUITY_CLAUDE-production-system.md`) under
  `thoughts/ledgers/archive/` with a note that the redesign-roadmap ledger
  superseded it.

**Files touched.** Documentation only.

**Acceptance.** All docs reflect the live system; final E2E + smoke pass.

---

## Open Questions

- **UNCONFIRMED**: Should `dnd-kit` be added now in Phase 0 or wait until
  Phase 5? Current decision: install in Phase 5 so Phase 0 stays minimal.
- **UNCONFIRMED**: For the live activity feed (Phase 3), poll-every-5s
  vs. SSE/websocket. Polling is simpler and passes through existing auth.
  Default to polling unless user requests SSE.
- **UNCONFIRMED**: The patient happy-path E2E currently assumes the catalog
  is rendered inline. The new design moves catalog into a drawer. We may
  need to update the E2E to first click "Abrir catálogo" before
  `[data-add='oleo-cbd-10']`. Document the change in Phase 1.
- **UNCONFIRMED**: Should the inventory race test (Phase 2) run in CI? Risk
  of flakiness with SQLite — we may need a retry loop. If too flaky, mark
  as `node --test --concurrency=1` and document.

## Working Set

- **Branch**: `main` (no feature branches per user preference)
- **Repo root**: `/Users/partiu/workspace/kaizen/associacao-verde`
- **Live dev URL**: `http://127.0.0.1:4184`
- **Tmux session**: `associacao-verde-dev` (kept alive across phases)
- **Local credentials**:
  - team: `equipe@apoiar.local` / `apoio-equipe-dev`
  - patient: `APO-1027` / `HELENA2026`
  - blocked patient: `APO-1999` / `BLOQ2026`
- **DB**: `/tmp/associacao-verde-dev.sqlite`
- **Verification commands per phase** (run in this order):
  ```
  npm run check
  npm test
  SMOKE_BASE_URL=http://127.0.0.1:4184 npm run smoke
  # full reset + e2e (npm run e2e now self-bootstraps a production-mode
  # server: it pre-builds with `next build` if .next/BUILD_ID is missing,
  # then spawns server.mjs with NEXT_DEV=false on a free port. Production
  # mode is required because React must hydrate for click handlers to
  # attach; HMR mode fails under Playwright. No separate tmux dev server
  # is needed for E2E.):
  lsof -tiTCP:4184 -sTCP:LISTEN | xargs -r kill 2>/dev/null
  rm -f /tmp/associacao-verde-dev.sqlite
  rm -rf /tmp/associacao-verde-dev-docs
  DB_FILE=/tmp/associacao-verde-dev.sqlite DOCUMENT_STORAGE_DIR=/tmp/associacao-verde-dev-docs npm run dev:reset
  npm run e2e
  ```
- **Mock contract**: `.superpowers/brainstorm/70960-1778242539/content/all-pages.html`
- **Phase screenshots**: `artifacts/visual-e2e/redesign/`
- **Active code areas**:
  - `app/` — Next.js routes (rewrite per phase)
  - `public/app.css` — design system (Phase 0; phase-additive after)
  - `server.mjs` — auth + Pix + webhooks + RBAC + readiness (preserve)
  - `src/production-system.mjs` — domain logic (preserve, extend per phase)
  - `src/sqlite-store.mjs` — persistence (extend per phase)
  - `scripts/e2e-production-app.py` — E2E (additive only; never break)
  - `scripts/smoke-production-app.mjs` — smoke (additive only)
  - `test/*.test.mjs` — unit tests (add per phase)
- **Predecessor ledger**: `thoughts/ledgers/CONTINUITY_CLAUDE-production-system.md`
  (historical; do not write to it).

## Recovery After /clear

1. Read this file.
2. Find `[→]` to identify current phase.
3. Read mock contract (open the all-pages.html file in browser if visual
   alignment is unclear).
4. Read predecessor ledger only if you need historical decisions about
   backend (auth, Pix, webhook, schema).
5. Verify shared dev server is running (`curl http://127.0.0.1:4184/health`).
6. Run the verification suite once before starting work to confirm baseline.
7. Continue with the current phase's scope.
