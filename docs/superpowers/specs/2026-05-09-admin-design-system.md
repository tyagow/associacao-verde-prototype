# Apoiar Brasil — Admin Design System (Direction B-2 / "Senior Workbench")

Date: 2026-05-09
Owner: design-system
Status: Draft for review (operator-grade redesign)

---

## 0. Diagnosis: why the current surface reads "JR"

The redesign Phase 0–13 successfully shipped tokens, but **routes do not consume them**. A grep across `app/equipe/` and `app/admin/components/` finds **359 hard-coded `px` values** (font-size, padding, gap, margin) that bypass `--sp-*`, `--fs-*`, `--r-*`. The off-grid values (`10px 14px`, `13px`, `14px 12px`, `18px`, `6px 10px`, `padding: 10px 12px`) are the visual signal of an unsystem: every panel/table/strip rounds spacing differently, so the eye reads inconsistency instead of a rhythm.

Concrete evidence:

- `app/equipe/components/TeamShell.module.css:28` — sidebar padding `14px 12px` (off-grid; should be `--sp-3 --sp-2`).
- `app/equipe/components/TeamShell.module.css:31` — gap `18px` (off-grid; the scale jumps `--sp-4=16` → `--sp-5=20`).
- `app/equipe/components/StatusStrip.module.css:10,14` — strip padding `10px 14px` and `margin-bottom: 16px` (off-grid + raw token).
- `app/equipe/components/PriorityQueue.module.css:13,63,68` — head + cells use `10px 14px` / `10px 12px`. No alignment with strip.
- `app/equipe/components/KpiRibbon.module.css:10` — bottom margin `16px` raw, not via gap.
- `app/equipe/components/PageHead.module.css:7,15` — title `font-size: 24px` raw (already a token: `--fs-h2`); margin `14px` off-grid.
- `app/admin/components/GateCard.module.css:6` — `padding: 14px 16px` (off-grid); inline pill recipe duplicating global `.pill`.
- `app/admin/components/GateDetail.module.css:4,77` — `padding: 16px 18px` and `12px 14px` (off-grid pair).
- `app/admin/components/AuditTimeline.module.css:96` — `grid-template-columns: 80px 18px 1fr` magic numbers.
- `app/equipe/fulfillment/components/KanbanColumn.module.css:21,82-87` — header `10px 14px`, list padding `10px`.

The dialect is fundamentally OK (Direction B / Stripe Workbench). The execution is amateur because every component author improvised pixels instead of pulling from `--sp-*`. **Fixing the pixel discipline alone restores 70 % of the polish.** The remaining 30 % is:

- a real component vocabulary (one `.surface`, one `.tableShell`, one `.pill` — not 11 inline copies),
- a layout primitive layer (page shell, status strip, body, right rail are repeated by hand on every route),
- a motion budget (color / opacity only — no layout transitions in admin),
- empty/loading/error states defined once.

This spec gives the team a **mechanically enforceable** system. Everything in §1–6 is a token rule + a lint target. §7 routes the rules to each of the 8 surfaces. §8 lists the anti-patterns to delete.

---

## 1. Spacing system

The 8px base scale already exists in `app/globals.css :root`. **No new tokens** — the work is to _only_ use them. Off-grid values (10, 14, 18) become lint errors.

```
--sp-1   4px   inline gap; icon-to-label; pill internal padding-y
--sp-2   8px   tight stacks; chip gap; cell padding-y in tables
--sp-3  12px   default row gap inside panels; card body gap
--sp-4  16px   panel inner padding; grid gap between cards
--sp-5  20px   panel outer padding; section gap inside main
--sp-6  24px   gap between major sections (status strip ↔ table)
--sp-7  32px   page top padding; gap between page header and body
--sp-8  40px   page-level gap on desktop
--sp-9  56px   hero block padding (marketing only — never admin)
--sp-10 72px   marketing only
```

### Where each step goes (admin context)

| Surface element            | Padding         | Gap to next sibling                                |
| -------------------------- | --------------- | -------------------------------------------------- |
| Page shell `main`          | `--sp-6 --sp-7` | —                                                  |
| PageHead → StatusStrip     | —               | `--sp-4`                                           |
| StatusStrip → KPI ribbon   | —               | `--sp-4`                                           |
| KPI ribbon → primary panel | —               | `--sp-5`                                           |
| Section → Section          | —               | `--sp-6`                                           |
| Panel inner padding        | `--sp-4 --sp-5` | —                                                  |
| Panel head (title row)     | `--sp-3 --sp-4` | —                                                  |
| Table cell                 | `--sp-2 --sp-3` | —                                                  |
| Table head cell            | `--sp-2 --sp-3` | —                                                  |
| Pill / chip                | `2px --sp-2`    | `--sp-1`                                           |
| Icon button (28px square)  | —               | `--sp-1`                                           |
| Form field stack           | —               | `--sp-1` (label→input) / `--sp-3` (between fields) |
| Drawer / Modal body        | `--sp-5 --sp-6` | `--sp-4` (between sections)                        |
| Sidebar item               | `--sp-1 --sp-2` | `1px` (Linear style — no gap, hairline only)       |

### Why this works (industry references)

- **Linear**: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 — almost identical. Linear's sidebar items have **0 gap, 1px separator** so the eye reads a continuous list, not a stack of cards. Their secret is that vertical rhythm comes from line-height + padding, not from `gap`.
- **Vercel Dashboard**: 4 / 8 / 12 / 16 / 24 / 32 / 48. Dashboard cards use `padding: 16px 24px` (asymmetric) so labels align across the row even when card heights differ.
- **Stripe Dashboard**: 8 / 12 / 16 / 24 / 32. Tables use `padding: 10px 16px` cell — but their `10` is `0.625rem` derived from a 16px base, **not a freestanding pixel**. Even when the math looks off-grid, it is rooted in a base.

### Lint rule

Add `stylelint-declaration-strict-value` (or a custom regex) on `app/equipe/**/*.module.css` and `app/admin/**/*.module.css`:

```js
'declaration-strict-value': [
  ['/^padding/', '/^margin/', '/^gap/', '/^font-size/'],
  { ignoreValues: ['0', '1px', '2px', '3px', 'auto', 'inherit'] }
]
```

Failing build on the next CI cycle is the right enforcement; without that the rule will drift.

---

## 2. Type scale & rhythm

Tokens already exist in `globals.css`. Today's components _bypass them with `font-size: 13px` / `font-size: 11px` literals._ The fix is to use the variables and add **two missing semantic sizes**:

```
--fs-xs       11px   pill text, micro labels, table action links
--fs-sm       12px   helper text, dense table cells, breadcrumb, sidebar items
--fs-ui       13px   default body text in admin (NEW alias of base — admin runs denser than marketing)
--fs-base     14px   marketing body, login forms
--fs-lg       18px   section subtitles
--fs-h3       20px   detail panel title (drawer header)
--fs-h2       24px   page H1 (PageHead)
--fs-display  32px   reserved for marketing only
```

Add `--fs-ui: 13px` to the root. Admin is information-dense; 14px causes table rows to grow ~10 % taller and pushes content below the fold. Linear, Vercel, Stripe, Retool all run their dashboards at 13px. The 14px base stays for marketing/onboarding where reading comfort matters more than density.

### Line height + tracking

| Token                 | Value      | Apply to                        |
| --------------------- | ---------- | ------------------------------- |
| `--lh-tight`          | 1.15       | h1, h2, h3, KPI value           |
| `--lh-snug`           | 1.35 (NEW) | table cells, nav items, pills   |
| `--lh-body`           | 1.55       | paragraphs, drawer body copy    |
| `--tracking-tight`    | -0.018em   | h1, h2, KPI value (>16px)       |
| `--tracking-overline` | 0.14em     | overlines, micro labels         |
| `--tracking-mono`     | 0          | mono / numerics — never tracked |

Add `--lh-snug: 1.35`. Today the admin uses `1.55` everywhere because that is the inherited body — which is too airy for table cells (Linear runs ~1.4 on rows).

### Family routing

| Element                               | Family                                                |
| ------------------------------------- | ----------------------------------------------------- |
| Page H1 (PageHead title)              | `--font-display` (Outfit)                             |
| Section H2/H3 (panel title, drawer h) | `--font-ui` (Inter)                                   |
| Body, controls, table content         | `--font-ui`                                           |
| Order ID, hash, IP, command, money    | `--font-mono` (JetBrains)                             |
| KPI value (always numeric)            | `--font-ui` with `font-variant-numeric: tabular-nums` |

**Anti-pattern in code today**: `app/admin/components/AuditEventModal.module.css` and several component files apply `var(--font-display)` to section H2/H3 (`.panel-title`). Display font on 14px text looks toy-like. Reserve display for ≥24px.

### Numerical column treatment

Every cell that can hold a number gets, **once, on the column**:

```css
font-variant-numeric: tabular-nums;
font-feature-settings:
  "tnum" 1,
  "lnum" 1;
text-align: right;
font-weight: 500; /* not bold — bold makes the column too heavy */
font-family: var(--font-ui); /* mono only for IDs / hashes / commands */
```

Money: `R$ 1.234,56` always right-aligned, mono **forbidden** (Stripe doesn't mono money — it tabulars it). Counts: right-align, weight 500. Percentages: right-align, suffix `%` in `--muted` color so the number reads first.

---

## 3. Color system

No new hex. All work is **mapping existing brand tokens to functional roles** so component CSS never references brand directly.

### Functional layer (NEW — add to `:root`)

```css
/* Surfaces */
--surface: var(--paper); /* page background */
--surface-elevated: #ffffff; /* card on top of surface (NEW pure white for contrast) */
--surface-sunken: var(--paper-warm); /* group bg, alt rows, sidebar */
--surface-hover: var(--soft); /* row hover, button ghost hover */
--surface-active: var(--ink); /* selected nav, primary CTA bg */
--surface-on-active: var(--paper); /* text on active */

/* Borders */
--border: var(--line); /* default hairline */
--border-subtle: var(--line-soft); /* divider inside panel */
--border-strong: var(--line-strong); /* hovered card, focused input */
--border-focus: var(--ink); /* focus ring */

/* Text */
--text: var(--ink);
--text-muted: var(--ink-soft);
--text-subtle: var(--muted);
--text-faint: var(--muted-2);
--text-on-active: var(--paper);
--text-link: var(--green-deep);
--text-link-hover: var(--ink);

/* Status */
--status-ok-bg: var(--green-tint);
--status-ok-fg: var(--green-deep);
--status-ok-border: var(--green-soft);
--status-warn-bg: var(--warn-soft);
--status-warn-fg: var(--warn-ink);
--status-warn-border: #ecd58a; /* NEW — derive at write time */
--status-danger-bg: var(--danger-soft);
--status-danger-fg: var(--danger);
--status-danger-border: var(--danger-line);
--status-info-bg: #e8eef9; /* NEW — needed for info pills (releases, notes) */
--status-info-fg: #1f3a78;
--status-info-border: #c7d3e9;
--status-neutral-bg: var(--soft);
--status-neutral-fg: var(--ink-soft);

/* Focus */
--focus-ring: 0 0 0 2px var(--paper), 0 0 0 4px var(--ink);
```

**Components reference functional names only.** A future palette swap (e.g. dark mode) edits only the functional layer.

### Status semantic rules

- `ok / good / success` → green-tint pill, green-deep text. Used for: completed gates, paid orders, healthy sensors.
- `warn` → warn-soft pill, warn-ink text. Used for: attention-needed (low stock, slow processing). **Never used for "in progress"** — that is `info`.
- `danger` → danger-soft pill, danger text. Used for: failed releases, expired prescriptions, blocked patients.
- `info` → info-bg pill, info-fg text. Used for: in-progress, scheduled, queued. (NEW; today the codebase abuses `warn` for in-progress, which is wrong — orange should mean "human needed".)
- `neutral` → soft bg, ink-soft text. Used for: draft, archived, optional.

### Dark mode — recommendation: **NO**

The audience is internal Brazilian operators using the workbench during business hours, often with patient identity documents on a second monitor. The contrast against PDF (white) and webcam preview (light) is friendlier with light surfaces. Dark mode would consume 1–2 sprints to retoken every component for a feature roughly **6 % of operators** ask for (Linear's own telemetry; Vercel similar). **Defer dark mode indefinitely**; instead invest those cycles into density toggle (compact / cozy) which serves more users.

---

## 4. Component vocabulary

The codebase has **11 inline pill recipes**, **6 inline button recipes**, **4 different "panel" treatments**. Consolidate to one per primitive. Each lives in `app/globals.css` under `/* Phase 14 — Component primitives */` (additive, no deletions).

### Card / Panel

**One** primitive: `.surface` (canonical) wrapping `.surface__head` + `.surface__body` + optional `.surface__footer`.

- `padding: 0` on shell; head and body manage their own padding.
- `border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface-elevated);`
- Variants: `.surface--quiet` (no border, sunken bg), `.surface--bordered-left-warn|danger|ok` (status accent — gates).
- Anti-pattern: `box-shadow` for elevation in admin. Borders only. Stripe's dashboard has zero shadows on table panels.

### Table

`.tableShell` = scroll container with rounded border. `.dataTable` = the table itself.

- `border-spacing: 0; border-collapse: collapse;`
- `thead th`: position sticky, top 0, `--surface-sunken` background, `--text-subtle` `--fs-xs` uppercase, padding `--sp-2 --sp-3`, `border-bottom: 1px solid var(--border);`.
- `tbody td`: `--fs-ui`, padding `--sp-2 --sp-3`, `border-bottom: 1px solid var(--border-subtle);`.
- **No zebra by default.** Zebra reads as 80s-banking. Use a hover bg (`--surface-hover`) instead. If grouping is needed, use a 1px `--border` separator between groups.
- Anti-pattern: `tr:nth-child(even) td { background }` in `PriorityQueue.module.css:73`. Delete.

### Pill

One implementation: `.pill` + tone modifiers (`.pill--ok|warn|danger|info|neutral`).

- `--fs-xs`, `padding: 2px var(--sp-2)`, `border-radius: var(--r-pill);`, `font-weight: 600`, `text-transform: uppercase`, `letter-spacing: 0.04em`.
- Tones: bg / fg from `--status-*-bg` / `--status-*-fg`. Border optional.
- Anti-pattern: 11 inline copies. Delete from `PriorityQueue.module.css`, `GateCard.module.css`, `OrderCard.module.css`, etc.

### Chip (selectable / filter)

`.chip` — used for filter values, segment options, audit categories.

- `--fs-sm`, `padding: 4px var(--sp-3)`, `border-radius: var(--r-pill);`, `border: 1px solid var(--border);`, `background: var(--surface);`.
- States: `:hover { background: var(--surface-hover) }`, `[aria-pressed="true"] { background: var(--surface-active); color: var(--text-on-active); border-color: var(--surface-active); }`.

### Segmented control

`.segmented` = inline-flex with one shared border. Each `.segmented__option` is a button, `border: 0`, height `28px`, padding `0 --sp-3`. Active = ink bg + paper fg.

### Button vocabulary

Five canonical variants — no others:
| Variant | Use | Bg / Fg | Height |
|---------------|-------------------------------------|----------------------------------------|--------|
| `.btn--primary` | Page primary CTA (Salvar, Confirmar)| `--ink` / `--paper` | 32 |
| `.btn--ghost` | Secondary action, all toolbar btns | transparent / `--ink`, `1px var(--border)` | 28 |
| `.btn--danger` | Destructive (Excluir, Bloquear) | `--danger` / `--paper` | 32 |
| `.btn--mini` | Inline action (Ver, Editar in tables) | transparent / `--text-link`, no border | 24 |
| `.btn--icon` | Icon-only (28×28) | transparent, `:hover` `--surface-hover` | 28 |

Heights anchored to 24 / 28 / 32 — three sizes, not five.
Anti-pattern: `formSubmit` in `TeamUsersTable.module.css:33` uses `--green` background (legacy direction A). Delete; route to `.btn--primary`.

### Drawer

`.drawer` = right-side panel, 400 / 480 / 560 px wide. Used for: order detail, gate detail, audit event detail.

- `position: fixed; right: 0; top: 0; height: 100vh;`
- `border-left: 1px solid var(--border); background: var(--surface-elevated);`
- Header: `padding: --sp-4 --sp-5; border-bottom: 1px solid var(--border);` with title + close button.
- Body: `padding: --sp-5; overflow-y: auto;`
- Footer (sticky): `padding: --sp-3 --sp-5; border-top: 1px solid var(--border); display: flex; gap: --sp-2; justify-content: flex-end;`

### Modal

Used **only for confirms and destructive flows**. Detail/edit goes to drawer. Anti-pattern: `AuditEventModal.jsx` uses a centered modal for read-only info — convert to drawer (matches GateDetail pattern).

### Toast

Bottom-left, single-stack, max 3 visible. `--surface-elevated` bg, `--border` border, `--shadow-2` shadow, `--r-md` radius. Auto-dismiss 4s, persistent for errors.

### Empty state

`.emptyState` — centered in panel body. Stack: 24px-icon (muted) → `--fs-ui` ink message → `--fs-sm` muted hint → optional ghost button. Padding `--sp-7 --sp-5`. Single recipe.

### Skeleton

`.skel` = `--surface-sunken` bg + 1.6s shimmer keyframe (opacity 0.6 → 1 → 0.6). Apply to: KPI value, table rows, drawer body. **Replaces** today's `Carregando...` text which Vercel/Linear stopped using in 2022.

### Avatar

`.avatar` = 24 / 28 / 32 px circle. Two-letter initials in `--font-ui`, weight 600, `--fs-xs`, `--paper` text on a deterministic hue (hash name → 8-color palette in `--surface-sunken` family).

### Breadcrumb

`.crumb` (already present in `TeamShell`) — refine: separator `/` in `--text-faint`, current page in `--text` weight 600, prior segments in `--text-subtle`. Never wrap — truncate middle segments with ellipsis.

### Tab

`.app-tabs` already exists (subPages). Refine: 32px height, `--sp-3` horizontal padding, active = bottom border 2px `--ink`, inactive = `--text-subtle`. **No background fill on active** (today the active tab gets ink bg — too heavy; underline is the correct pattern for scrolling-stable tabs).

### KPI cell

`.kpi` already exists. Add `.kpi--compact` (NEW) for 32px-tall ribbon variant on top-of-page contextual KPIs; reserve full `.kpi` for dashboard.

### Filter strip

`.statusStrip` exists but is overloaded. Split into:

- `.toolbar` — neutral row of filters + segments + actions (left → right: filters, spacer, segments, primary action).
- `.statusStrip` — colored count chips for system state (kept for Comando dashboard only).

### Accessibility (every primitive)

- `:focus-visible` ring per `--focus-ring` (2px paper + 2px ink — works on any background).
- Pills with status meaning include an `aria-label="Status: warn"` (color is not the only signal).
- Drawer + modal trap focus, restore on close, `Esc` to close, click-outside to close.
- All buttons have an accessible name (icon-only buttons require `aria-label`).
- Tables with sort: `aria-sort` on `th`, full keyboard activation.

---

## 5. Layout primitives

### Page shell pattern

```
┌──────────────────────────────────────────────┐
│ Sidebar (232) │ Topbar (52)                  │
│               ├──────────────────────────────┤
│               │ Main:                        │
│               │   PageHead                   │
│               │   StatusStrip / Toolbar      │
│               │   KPI ribbon (optional)      │
│               │   Body                       │
│               │   (right rail when needed)   │
└──────────────────────────────────────────────┘
```

`.app-shell` already implements sidebar + topbar; the rules below are about what fits inside `main`.

### Column rules — by operator context need

| Routes (count of context items) | Layout                                                                                                                                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Comando, Estoque, Cultivo       | **1-col** — KPIs + one primary table/grid. Operator focuses on aggregate state.                                                                                                    |
| Pacientes, Pedidos, Suporte     | **2-col** when an item is selected: list (40 %) + detail drawer (60 %). Default = list only.                                                                                       |
| Fulfillment                     | **n-col kanban** — already correct. Keep.                                                                                                                                          |
| Admin (gates + audit)           | **2-col fixed**: gates list (left, ~360 px) + detail (right, fluid) — already implemented in `admin.module.css`.                                                                   |
| User detail / patient detail    | **3-col** when needed: nav (left), thread/timeline (center), context cards (right) — Plain.com / Pylon pattern. Use only on `/equipe/suporte/[case]` and `/equipe/pacientes/[id]`. |

### Sidebar grouping rules

Three groups, each with overline:

1. **Operação** — Comando, Pacientes, Pedidos, Fulfillment, Suporte (the daily work).
2. **Catálogo** — Estoque, Cultivo (slower-moving inventory).
3. **Plataforma** — Admin (gates, users, audit) — only visible to roles with admin access.

Spacing: 1px hairline between items inside group, `--sp-3` between groups, no extra spacing at the bottom of the last group. Overline `--fs-xs`, `--tracking-overline`, `--text-subtle`.

### Empty / loading / error — defined ONCE per layout

For each layout primitive, three states:

- **Empty**: `.emptyState` inside the panel where data would render. Includes a one-line cause + a one-line CTA.
- **Loading**: Skeleton rows (4 for tables, 1 for KPI tile, 6 for drawer body). **Never** a spinner inside a panel; spinners are only for buttons during action submission.
- **Error**: Same shape as empty, with `--status-danger-fg` icon + the error message + `Tentar novamente` ghost button. Includes a `<details>` with the technical error for developers.

Today: error states are inconsistent (some throw, some show `Erro` text, some show nothing). Lock the contract.

---

## 6. Motion & focus

### Allowed transitions (in admin)

- **Color**: `color`, `background-color`, `border-color`, `fill`, `stroke`. Always.
- **Opacity**: for hover affordance on icon buttons. Always.
- **Box-shadow**: only on focus rings.
- **Transform**: **forbidden** in admin layouts. No `translateY(-2px)` lift on cards. (Allowed in marketing only.)
- **Width / height / padding / grid-template**: **forbidden** in transitions. Layout shifts during interaction are disorienting in dense surfaces.

### Easing curves

```
--ease-out:     cubic-bezier(0.2, 0.7, 0.2, 1)   /* default */
--ease-in:      cubic-bezier(0.4, 0, 1, 1)       /* leaving — drawer close */
--ease-in-out:  cubic-bezier(0.4, 0, 0.2, 1)     /* drawer open + content fade */
```

### Durations

```
--t-instant:  60ms    Hover background swap, focus ring appear
--t-fast:     120ms   Color shifts, pill state flip, button press
--t-base:     200ms   Drawer slide, modal fade, tab change
--t-slow:     320ms   Progress fill, spark animation, skeleton shimmer
```

`--t-fast` and `--t-slow` already exist; add `--t-instant` (60 ms) and `--t-base` (200 ms).

**Rule**: anything <120 ms must be a color/opacity-only change (spec from Material 3 expressive: shorter durations need smaller perceptible delta). `--t-base` is reserved for layout transitions on overlays (drawer, modal) — never on body content.

### Hover affordances

- Buttons: `background-color` swap + cursor pointer. **No lift.**
- Cards (clickable, e.g. GateCard): `border-color: var(--border-strong)` + cursor pointer. No bg change, no shadow.
- Table rows: `background: var(--surface-hover)` + cursor pointer if entire row navigates; otherwise hover only on the action button.
- Links: `text-decoration: underline` on hover (color stays the same — Linear pattern).

---

## 7. Concrete refactor list — per route

For each route, two columns: **Apply** = drop-ins from §1–6; **Cut** = anti-patterns to delete.

### `/equipe` (Comando) — `app/equipe/page.jsx` + `TeamCommand.jsx`

- **Apply**: 1-col layout. Replace local KPI ribbon paddings with `--sp-4 --sp-5`. Replace inline `font-size: 13px` in `PriorityQueue.module.css` with `--fs-ui`. Remove zebra rows. Convert `.statusStrip` filter row → `.toolbar` (no count chips, just filters + segment).
- **Cut**: Zebra in PriorityQueue (line 73). Drop the `--sp-5, 20px` fallback (token always exists). Remove `font-size: 24px` literal in PageHead → `--fs-h2`.

### `/equipe/pacientes` — `PatientsClient.jsx`

- **Apply**: 2-col when row selected → drawer with patient profile + recent orders + audit. Row hover bg. `.dataTable` primitive. Status pills via `.pill--*`. Avatar in name column (28 px).
- **Cut**: Any custom `padding: 10px*` cells. Inline pill recipes. Delete the empty-rows dashed-border treatment (use `.emptyState`).

### `/equipe/estoque` — `StockRoute.jsx`

- **Apply**: 1-col with KPI ribbon (estoque por SKU + alertas baixos + última recepção). `.dataTable` for SKU list, with right-aligned tabular numerics for quantities. `.surface--bordered-left-warn` on rows below threshold. Add `.skel` to KPI/table while loading.
- **Cut**: `--paper-warm` strip backgrounds where they aren't grouping anything. Custom `padding: 16px` on the form — use `--sp-4 --sp-5`.

### `/equipe/cultivo` — `CultivoRoute.jsx`

- **Apply**: 1-col. Sensor cards as `.surface` grid (4-up desktop, 2 tablet, 1 mobile, gap `--sp-4`). Sensor value in `--font-ui` weight 600 `--fs-h3` tabular-nums. Status pill below value. Sparkline 32 px tall.
- **Cut**: Any current background gradient or shadow. Sensor cards must read flat.

### `/equipe/pedidos` — `OrdersClient.jsx`

- **Apply**: 2-col with selection drawer (order detail = items + status timeline + payment + actions). `.dataTable` for orders with mono `OrderId` column, money column right-aligned tabular, status pill column. Toolbar: search + status segment + period filter + `Exportar` ghost.
- **Cut**: Inline pill in `OrdersClient.module.css`. Per-row click → row navigates to drawer (cursor pointer) instead of an `Abrir` link in last column (Vercel pattern — saves a column).

### `/equipe/fulfillment` — kanban

- **Apply**: Keep n-col kanban. Replace KanbanColumn `padding: 10px 14px` with `--sp-2 --sp-4`. OrderCard padding `--sp-3 --sp-4`. Status accent via `.surface--bordered-left-{ok|warn|danger}` instead of inline `.urgent / .danger / .ok` classes. Drag cursor only — no shadow / scale on drag (current `box-shadow: 0 8px 24px` is OK as the _only_ exception because it communicates "lifted").
- **Cut**: `border-color` transition on `.kcol` (currently `0.15s ease` — change to `--t-fast var(--ease-out)`). Remove `min-height: 600px` on `.kcol` — let columns be content-height.

### `/equipe/suporte` — Workbench (Plain.com pattern)

- **Apply**: 3-col when case selected: case list (320) + thread (1fr) + context (320). Thread bubbles `--surface-elevated` for inbound, `--surface-sunken` for outbound. Composer fixed bottom of thread column. Context column = patient card + last 5 orders + flag history.
- **Cut**: Any modal-based reply UX. Inline composer only.

### `/admin` — gates + audit + users

- **Apply**: Already 2-col in `admin.module.css`. Promote to canonical layout. GateCard: replace `padding: 14px 16px` → `--sp-3 --sp-4`, drop the `border-left: 3px` color accent in favor of the `.surface--bordered-left-*` modifier. AuditTimeline: replace magic columns `80px 18px 1fr` with named grid `[time] 88px [dot] 16px [body] 1fr`. TeamUsersTable: replace `formSubmit` green button with `.btn--primary` (ink). Switch `AuditEventModal` → drawer.
- **Cut**: `app/admin/components/GateCard.module.css:78-87` `.cmd` block (mono command) — move to its own `.codeBlock` primitive shared with GateDetail.run. Inline pill recipe duplications.

---

## 8. Anti-patterns currently in code (file:line evidence)

### Token bypass — pixel literals

- `app/equipe/components/TeamShell.module.css:28` `padding: 14px 12px` → `--sp-3 --sp-2`
- `app/equipe/components/TeamShell.module.css:31` `gap: 18px` → `--sp-4` (16) or `--sp-5` (20); off-grid
- `app/equipe/components/TeamShell.module.css:128–135` topbar `gap: 16px; padding: 0 24px` → `--sp-4` / `--sp-6`
- `app/equipe/components/StatusStrip.module.css:8,10,14` `gap: 12px; padding: 10px 14px; margin-bottom: 16px` → `--sp-3 / --sp-2 --sp-3 / --sp-4`
- `app/equipe/components/PageHead.module.css:7,15,29` `margin-bottom: 14px; font-size: 24px; font-size: 12px` → `--sp-4 / --fs-h2 / --fs-sm`
- `app/equipe/components/PriorityQueue.module.css:13,49,63,68,73,148` head `10px 14px`; `font-size: 13px`; cells `10px 12px`; **zebra `tr:nth-child(even)`**; empty `padding: 24px 12px`
- `app/equipe/components/KpiRibbon.module.css:10` `margin-bottom: 16px` → page-level gap should come from `main`'s flex `gap: --sp-4`
- `app/admin/components/GateCard.module.css:6,9,38–46,98–130` padding `14px 16px`; the entire inline `.pill_*` recipe duplicating global `.pill`
- `app/admin/components/GateDetail.module.css:4,77,107` paddings `16px 18px`, `12px 14px`, `10px 12px`
- `app/admin/components/AuditTimeline.module.css:11,69,96,99` paddings `10px 14px`; magic `grid-template-columns: 80px 18px 1fr`
- `app/admin/components/TeamUsersTable.module.css:15,30,33–48,118` `padding: 16px`; **green button** that should be ink primary
- `app/equipe/fulfillment/components/KanbanColumn.module.css:21,82-87` paddings `10px 14px`, `gap: 8px`, `padding: 10px`
- `app/equipe/fulfillment/components/OrderCard.module.css:9,24,64` `padding: 10px 12px`, magic shadow values

Total: **359** literal-px declarations across `app/equipe/` + `app/admin/components/`. All resolvable to `--sp-*` or `--fs-*` tokens; any that do not resolve indicate the scale is missing a step (which the answer is rarely "add a step" — it is "round to the nearest existing step").

### Display font misuse

- `app/admin/components/AuditEventModal.module.css`, `app/equipe/components/PageHead.module.css:14`, KPI labels, panel titles — `font-family: var(--font-display)` applied at 13–16 px. **Display fonts (Outfit) are designed for ≥24 px.** At small sizes they look amateurish. Restrict to PageHead h1 only.

### Pill duplication

- 11 inline `.pill` / `.pill_*` recipes across components instead of using global `.pill`. The global `.pill` exists in `globals.css` (Phase 0); the inline copies were added because authors didn't want the `::before` dot. Fix the global — make the dot a `.pill__dot` opt-in element — then delete the 11 duplicates.

### Button duplication

- `formSubmit` (TeamUsersTable green), `exportBtn` (PriorityQueue ghost), `refresh` (StatusStrip ghost), `close` (GateDetail), `kanban dragging cursor`, several drawer footers — each rolling its own button. Six different "ghost button" implementations. Consolidate to `.btn--ghost`.

### Zebra rows

- `app/equipe/components/PriorityQueue.module.css:73`. Zebra reads as 80s banking SaaS. Stripe, Linear, Vercel, Retool — none use zebra. Use hover + group separators instead.

### Modals where drawers belong

- `AuditEventModal.jsx` opens a centered modal for **read-only** event detail. Drawer is the right pattern (matches `GateDetail`); the user's eye then has a stable left context (event list) and right detail.

### Loading state = text

- "Carregando..." text in multiple components. Replace with `.skel` skeleton.

### Inline shadows

- `app/equipe/fulfillment/components/OrderCard.module.css:13,24` raw shadow values. Use `--shadow-soft` (already exists) — and even then, only on dragging.

### Border-left-3px status accent

- Used in GateCard, OrderCard, releaseEvidenceWarn — three different files implement the same accent. Promote to `.surface--bordered-left-{ok|warn|danger|info}`.

### `--soft, 20px` fallback values

- Components write `var(--sp-5, 20px)`. The tokens are loaded at the top of every page — fallbacks here are dead code that _invites_ bypass. Remove fallbacks.

---

## Implementation phasing

Five sub-phases, each shippable independently:

- **14a** — Add functional color layer + missing tokens (`--fs-ui`, `--lh-snug`, `--t-instant`, `--t-base`, `--surface-elevated`, `--status-info-*`). Zero JSX changes; new tokens only.
- **14b** — Promote primitives in `globals.css`: `.surface`, `.dataTable`, `.toolbar`, `.btn--*` (5 variants), `.chip`, `.skel`, `.emptyState`, `.drawer`, `.codeBlock`. Each with sample HTML in this spec's appendix.
- **14c** — Migrate equipe components (`PageHead`, `StatusStrip`, `PriorityQueue`, `KpiRibbon`, `TeamShell`) to the primitives. Deletes ~200 lines of duplicated CSS.
- **14d** — Migrate admin components (gates, audit, users). Promote AuditEventModal → drawer. Switch TeamUsers green → ink button.
- **14e** — Add stylelint rule blocking new px literals in `app/equipe/**` and `app/admin/**`. Make CI fail on bypass.

Each phase ends with a visual diff against the current screenshots stored under `docs/superpowers/specs/admin-revamp-mockups/` and a manual operator walkthrough on each of the 8 routes.

---

## Open questions

- **UNCONFIRMED**: Density toggle (cozy / compact) — worth shipping in Phase 14, or defer? Linear has it; Vercel doesn't. For Brazil-based ops with 1366×768 fleet laptops, compact would help.
- **UNCONFIRMED**: Replace Outfit with Inter Display? Inter Display is purpose-built for 24+px headings and matches our body Inter perfectly — fewer fonts, better consistency. Outfit's slight quirkiness reads as "marketing template". Worth a separate spec.
- **UNCONFIRMED**: Should `.kpi--compact` also be the default ribbon variant on `/equipe` (Comando)? Current 5-up KPI is large; users have asked twice "where are the actual orders?".
