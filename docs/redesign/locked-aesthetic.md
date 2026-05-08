# Apoiar — Locked Aesthetic (B · Calm Clinical Modern)

This document is the **visual contract** for the production application.
The redesign initiative (Phases 0–12, closed 2026-05-08) shipped every
patient and team surface against this contract. New work must consume the
locked tokens and primitives without reinvention.

For the canonical token table, see `docs/redesign/tokens.md`. For the
approved screen mocks (20 pages), open
`.superpowers/brainstorm/70960-1778242539/content/all-pages.html` in a
browser — that file is the visual ground truth.

## Aesthetic principles

The production application is **B · Calm Clinical Modern**. Three
alternates were considered (A editorial-warm, B clinical-modern, C
hybrid). B was chosen for legibility and trust; C was rejected for
cohesion.

The principles below are the defining traits. Do not mix in editorial,
ecommerce, or marketing-page energy.

1. **Off-white paper, soft greens.** The primary surface is `--paper`
   (`#fbfcfa`). Greens (`--green`, `--green-deep`, `--green-soft`,
   `--green-tint`) carry brand identity, links, success status, and
   progress fills.
2. **Refined gold ornament only.** `--gold*` is reserved for product
   thumbnails, the live-pulse dot, and the optional gold CTA. Gold is
   ornament — never body text, never primary actions, never status
   states.
3. **System sans first.** Inter (`--font-ui`) carries body, controls,
   tables, and most headings. Outfit (`--font-display`) is reserved for
   display headings only (hero h1, key splash titles). Playfair was
   dropped in Phase 0; serif is not part of the contract.
4. **Generous whitespace.** Use the spacing scale (`--sp-1` … `--sp-10`).
   Cards have `--sp-4` / `--sp-5` inner padding; sections separate at
   `--sp-7`; page-level padding is `--sp-8` on desktop, larger on hero
   blocks.
5. **Hairline borders.** Default border is `1px solid var(--line)`.
   Sub-hairlines inside dense layouts use `--line-soft`. Avoid heavy
   borders or chunky dividers.
6. **Status as colored dots.** Use `.pill--good`, `.pill--warn`,
   `.pill--danger`, `.pill--live`. Avoid full-row red/green floods.
7. **Tabular numerics on data.** Apply `font-feature-settings: "tnum"`
   (or the existing `.kpi__value` rule) to stat values, ledger rows, and
   prices.
8. **Soft shadows.** `--shadow-soft` is the default elevated surface.
   Never harder than `--shadow-2` (login card, popovers) or `--shadow-3`
   (hero phone preview, hero frame).
9. **Motion is restrained.** Default ease is `--ease-out`. Hover swaps
   use `--t-fast` (120ms); UI transitions use `--t-base` (200ms);
   progress fills and panel expansion use `--t-slow` (320ms). Every
   motion-bearing component honors `prefers-reduced-motion` (Phase 1
   patient drawers + Pix hero set the precedent).

## Locked tokens (cross-reference)

The full token table lives in `docs/redesign/tokens.md`. Locked groups:

- **Surface**: `--paper`, `--paper-warm`, `--paper-cool`, `--soft`,
  `--soft-2`.
- **Ink + muted**: `--ink`, `--ink-soft`, `--muted`, `--muted-2`.
- **Hairlines**: `--line`, `--line-soft`, `--line-strong`.
- **Greens**: `--green`, `--green-deep`, `--green-soft`, `--green-tint`
  (legacy `--moss`, `--forest`, `--forest-2` tolerated, do not use in
  new code).
- **Gold (ornament only)**: `--gold`, `--gold-deep`, `--gold-soft`,
  `--gold-on`.
- **Status**: `--warn`, `--warn-soft`, `--warn-ink`, `--good`,
  `--danger`, `--danger-soft`, `--danger-line`.
- **Type families**: `--font-ui`, `--font-display`, `--font-mono`.
- **Type scale**: `--fs-xs` … `--fs-hero`; `--lh-tight`, `--lh-body`;
  `--tracking-tight`, `--tracking-overline`.
- **Spacing**: `--sp-1` … `--sp-10`.
- **Radii**: `--r-xs` … `--r-pill`.
- **Shadow / depth**: `--shadow-soft`, `--shadow-1`, `--shadow-2`,
  `--shadow-3`, `--ring`.
- **Motion**: `--ease-out`, `--t-fast`, `--t-base`, `--t-slow`.

**Rules of use:**

1. Reference the variable, not the literal. `var(--green)`, never
   `#1d8c52`.
2. If a new shade is needed, add it to `:root` in `app/globals.css` AND
   to `docs/redesign/tokens.md` together. Never duplicate a value
   in-place.
3. Status uses dots, not floods.
4. Tabular numerics on data.
5. Hairline borders, soft shadows.

## Locked layout primitives

These additive utility classes (Phase 0) live at the bottom of
`app/globals.css` under the `Phase 0 — Calm Clinical Modern foundation`
fence and consume the tokens above. Treat them as the locked layout
vocabulary; do not invent parallel naming.

### App shell

- `.app-shell` — top-level grid container for authenticated experiences
  (sidebar + work column + topbar/footer).
- `.app-sidebar` — fixed-width sidebar column (used by TeamShell). On
  mobile (≤720px) becomes a horizontally scrollable strip with
  `flex: 0 0 auto` chips (Phase 12 fix; the prior `flex-wrap` forced
  min-content past the viewport once Phase 10 added badge counts).
- `.app-topbar` — top header band with brand seal and inline actions.
- `.app-work` — main work column with column gap `--sp-6`.
- `.app-tabs` (+ `.app-tabs__tab`) — tab strip used by the patient
  experience for Pedido / Histórico / Suporte.

### Surfaces

- `.frame` (+ `.frame__chrome`) — bordered surface with optional chrome
  band (used in mock previews).
- `.panel` (+ `--flush`, `--quiet`, `--soft`) — default elevated card
  surface.

### Status / labels

- `.pill` (+ `--good`, `--warn`, `--danger`, `--live`).
- `.overline` (+ `--green`, `--warn`, `--danger`).

### Selection controls

- `.chip` (+ `.chip__avatar`).
- `.segment` (+ `.segment__option`).

### Buttons

- `.btn` (+ `--primary`, `--ghost`, `--gold`, `--danger`, `--sm`,
  `--lg`).

### Inputs

- `.field` (+ `__label`, `__input`, `__textarea`, `__hint`).

### Data viz

- `.kpi` (+ `__label`, `__value`, `__delta`, `__spark`).
- `.spark` — sparkline frame.
- `.progress` (+ `--warn`, `--danger`).

### Flow

- `.stepper` — horizontal multi-step progress (cart, checkout).
- `.timeline` — vertical multi-stage timeline (Pix hero, audit grouping).

## Per-surface primitives

Surface-specific primitives live in CSS Modules under their owning
feature. They are scoped via `.tx-*` (team experience) and `.px-*`
(patient experience) prefixes for brand-new components without legacy
selectors.

- **PatientShell + PatientTabs + Toast** —
  `app/paciente/components/PatientShell.{jsx,module.css}` (and tabs,
  toast).
- **CatalogDrawer + ProfileDrawer** — right slide-over panels with
  framer-motion; `prefers-reduced-motion` collapses transition to
  `duration: 0`.
- **PixHero** — full-screen takeover with live countdown computed from
  `paymentExpiresAt`; real `qrcode.react` QR encoder; 5-stage timeline.
- **EmptyHero, CartHero, HistoryList, SupportThread, PrivacyConsentGate,
  AccessIssueScreen** — extracted patient surfaces.
- **TeamShell** — sidebar app shell mounted across `/equipe/*`; topbar
  with brand seal + role label + ⌘K hint button.
- **KpiSpark, ActivityFeed, PixByHour, PriorityQueue** — TeamCommand
  building blocks (recharts for sparklines and Pix-by-hour bar chart).
- **CommandPalette** — global ⌘K palette (`cmdk`), mounted by TeamShell
  so every team route gets it. Sources: navigation, patients, orders,
  contextual actions. Recents + starred persist in localStorage under
  `tx.cmdk.recents.v1` / `tx.cmdk.starred.v1`.
- **Kanban + KanbanColumn + OrderCard** — fulfillment kanban
  (`@dnd-kit/core`), 4 columns, optimistic UI, mobile single-column-
  with-tabs at ≤720px.
- **ProductLedger + ProductRow + LotRow + CultivoPanel** — Estoque
  single-ledger UI with click-to-expand lot detail.
- **QueueColumn + CasePanel + Thread + ReplyBox** — support workbench;
  patient-LEFT / team-RIGHT bubbles in the thread.
- **ReleaseProgress + GateCard + GateDetail** — admin readiness hero
  progress bar + 2-column gate grid.
- **AuditTimeline + AuditEventModal + TeamUsersTable + UserRow** —
  admin audit grouping + team users table with inline reactivation.

## Mock cross-reference

Open `.superpowers/brainstorm/70960-1778242539/content/all-pages.html`
in a browser to see the 20 approved screens that this aesthetic targets.
Each redesign phase implemented a subset:

| Phase | Mock screens                                                                                    | Locked components                                                                     |
| ----- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| P0    | Token application across all surfaces                                                           | All Phase 0 utilities + `.app-*` primitives                                           |
| P1    | Patient login, empty, cart, Pix takeover, tracking, history, support, blocked, consent, drawers | `PatientShell`, `PatientTabs`, `PixHero`, `Toast`, drawers                            |
| P3    | Team command center                                                                             | `TeamShell`, `KpiSpark`, `ActivityFeed`, `PixByHour`, `PriorityQueue`                 |
| P4    | Pedidos & Pix ledgers                                                                           | `Ledger`, `OrderRow`, `OrderDrawer`                                                   |
| P5    | Fulfillment kanban                                                                              | `Kanban`, `KanbanColumn`, `OrderCard`                                                 |
| P6    | Estoque & cultivo                                                                               | `ProductLedger`, `ProductRow`, `LotRow`, `CultivoPanel`                               |
| P7    | Support workbench                                                                               | `QueueColumn`, `CasePanel`, `Thread`, `ReplyBox`                                      |
| P8    | Command palette                                                                                 | `CommandPalette`                                                                      |
| P9    | Admin readiness                                                                                 | `ReleaseProgress`, `GateCard`, `GateDetail`                                           |
| P10   | Audit timeline + team users                                                                     | `AuditTimeline`, `AuditEventModal`, `TeamUsersTable`, `UserRow`                       |
| P12   | Mobile sweep at 390 + 320 across all redesigned routes                                          | TeamShell sidebar mobile rules; Kanban single-column tabs; Workbench scroll-into-view |

## Reduced-motion contract

Every motion-bearing component must honor `prefers-reduced-motion`.
Established precedents:

- **CatalogDrawer + ProfileDrawer** (Phase 1d) — spring transition
  collapses to `duration: 0` when `useReducedMotion()` returns true.
- **PixHero** (Phase 1d) — exposes the value as `data-reduce-motion`.
- **CommandPalette** (Phase 8) — `data-reduce-motion` on overlay.

New components must follow the same pattern.

## Mobile contract (Phase 12 sweep)

- All redesigned routes verified at 390x844 + 1440x950 in the E2E
  responsive overflow check.
- `/paciente`, `/equipe`, `/equipe/pacientes`, `/equipe/estoque`,
  `/equipe/pedidos`, `/equipe/fulfillment`, `/equipe/suporte`, `/admin`
  all checked.
- Globals: 540px + 360px safety nets for monospace ids, Pix codes,
  toast safe area, surface-toolbar input stretch.
- TeamShell: at ≤540px the shell caps to `100vw`; topbar wraps with
  shrunken padding; kbd hint hides; sidebar becomes a horizontally
  scrollable strip with fixed-width chips (replaces `flex-wrap` that
  forced min-content past the viewport).
- Kanban: at ≤720px, only the active column renders; tab strip switches
  columns; default tab is the most populated column on breakpoint flip.
  dnd-kit still owns within-column sortable; cross-column moves require
  switching tab first then dropping.
- Workbench: at ≤720px, queue stacks above case panel; patient
  selection auto-scrolls the case panel into view (rAF then
  `scrollIntoView` smooth) with `scroll-margin-top` so the panel is not
  flush.

## What is NOT part of this aesthetic

- No editorial serif headlines (Playfair was dropped in Phase 0).
- No yellow primary actions; primary is `--ink` on `--paper`.
- No status floods (full-row red/green); use pill dots.
- No marketing-page hero patterns; this is a clinical workspace.
- No public exposure of internal mechanics on public surfaces (no
  "reserva", "webhook", "provider", "drill", "deploy" in public copy).
- No magic numbers in CSS; all values come from `:root` tokens.
