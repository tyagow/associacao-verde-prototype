# Admin / Equipe Revamp — Design Spec

**Date:** 2026-05-08
**Status:** Draft awaiting user review
**Surface:** `/admin` and `/equipe/*`
**Direction:** B — Stripe Workbench (utility-first, sidebar shell, status strip on every page, sticky-thead tables with light zebra)
**Mockups:** `docs/superpowers/specs/admin-revamp-mockups/` — served at
http://127.0.0.1:8766/ during brainstorm. Open `index.html` for the menu;
`compare.html` for A / B / C side-by-side.

---

## 1. Goal

Replace the current internal team UX with the utility dialect from
`docs/superpowers/design.md` §2.2. Seven internal screens in scope.
Done when:

- All seven screens match their mockup counterparts.
- All E2E selectors used by `scripts/e2e-production-app.py`,
  `scripts/smoke-production-app.mjs`, and the Node test suite continue
  to resolve.
- `npm run check`, `npm test`, and `npm run e2e` (or
  `npm run verify:isolated`) pass green.
- User signs off after a visual walkthrough on the dev server.

## 2. Scope

In scope (7 screens):

| #   | Screen                        | Mockup file          | Existing component(s)                                          |
| --- | ----------------------------- | -------------------- | -------------------------------------------------------------- |
| 1   | Comando (dashboard)           | `b-comando.html`     | `app/equipe/TeamCommand.jsx` + `equipe/components/*`           |
| 2   | Pacientes & documentos        | `b-pacientes.html`   | `app/equipe/pacientes/PatientsClient.jsx`                      |
| 3   | Estoque & cultivo             | `b-estoque.html`     | `app/equipe/estoque/StockRoute.jsx` + `estoque/components/*`   |
| 4   | Pedidos & Pix                 | `b-pedidos.html`     | `app/equipe/pedidos/OrdersClient.jsx` + `pedidos/components/*` |
| 5   | Fulfillment kanban            | `b-fulfillment.html` | `app/equipe/fulfillment/components/Kanban.jsx`                 |
| 6   | Suporte ao paciente           | `b-suporte.html`     | `app/equipe/suporte/components/Workbench.jsx`                  |
| 7   | Admin (gates · audit · users) | `b-admin.html`       | `app/admin/page.jsx` + `admin/components/*`                    |

Cross-cutting (touched by all 7):

- `app/equipe/components/TeamShell.jsx` + `TeamShell.module.css` — sidebar +
  topbar shell. Reshaped to Direction B (light cream sidebar, ink active
  row, breadcrumb + global search topbar).
- New shared CSS primitive `statusStrip` (count chips + segmented + filter
  input + Atualizar button) used on every page under the pagehead.
- Admin route (`/admin`) currently does NOT mount `TeamShell`. The revamp
  brings it under the same shell so the sidebar carries the operator
  through compliance work as well.

Out of scope:

- `/paciente/**` surfaces (covered by the parallel paciente revamp spec).
- Brand mark / logo work — `Brand` component used as-is.
- Backend API changes — purely a presentation refactor.
- Mobile breakpoint _redesign_ below 768px is best-effort only; this spec
  targets desktop-first ≥1280px (admin works at 1440px) and degrades
  gracefully at ≥1024px and ≥768px.
- New iconography — line SVG glyphs ✓ × ↗ ▾ ⚠ as documented in §2.2 of
  design.md. No emoji-as-icon in admin.

## 3. Visual language (Direction B · Stripe Workbench)

### 3.1 Tokens

Mockups use only the existing tokens in `app/globals.css`. No new colors
or fonts required.

- **Surface:** `--paper` (cards, table rows odd), `--paper-warm` (page bg,
  table rows even, sidebar), `--soft` (chips/hovers), `--paper-cool`
  (rare).
- **Ink:** `--ink` (primary text + sidebar active row + primary CTA),
  `--ink-soft` (secondary), `--muted` (meta), `--muted-2` (tertiary dots).
- **Greens:** `--green` (accents), `--green-deep` (hover/CTA),
  `--green-soft` / `--green-tint` (status pill backgrounds).
- **Status:** `--good` / `--warn` / `--danger` with their `*-soft`
  backgrounds. Patient pill recipe per design.md §1.
- **Hairlines:** `--line` (default), `--line-soft` (sub-divider),
  `--line-strong` (emphasized).
- **Radii:** `--r-sm 3px / --r-md 5px / --r-lg 7px` (locked globally —
  same as paciente). Pills/avatars stay `999px`. Buttons 3px.
- **Type:** `--font-display` (Outfit) for h1/h2 + KPI numbers;
  `--font-ui` (Inter) for body + tables + buttons; mono for IDs and
  hashes; `font-variant-numeric: tabular-nums` on every numeric column.

### 3.2 Shell — sidebar + topbar (every internal route)

- **Sidebar (232px, sticky left, full height).** `--paper-warm` background
  with 1px `--line` right border. Sections grouped with uppercase
  `navhead` labels: **Operação** (Comando · Pacientes · Estoque · Pedidos
  · Fulfillment · Suporte) and **Compliance** (Admin · Auditoria). Each
  link is 28px tall, `--r-sm` radius, `--ink-soft` text. Hover swaps to
  `--soft`. Active row = `--ink` background + `--paper` text. Right-side
  badge counts use `--soft-2` / `--warn-soft` / `--danger-soft`
  recipes; tabular nums.
- **Topbar (52px, sticky top, white).** Left: breadcrumb
  `Equipe / **<page>**`. Center: global search field with magnifier +
  `⌘K` kbd hint, soft surface, `--r-sm` radius. Right: role chip
  (`<name> · <role>`).
- **Footer band (sidebar bottom).** `<email>` + Sair link, top hairline.
- **Cmd-K palette** stays mounted at the shell level (existing
  `CommandPalette.jsx`), invoked by ⌘K / Ctrl+K and by the search field
  click.

### 3.3 Pagehead + status strip (every internal route)

Standardised header pattern under the topbar:

1. **Pagehead row** — h1 (Outfit 24px, `--ink`) on the left;
   meta + actions on the right (e.g. "Atualizado 14:32" + "Atualizar"
   ghost button + primary CTA when relevant).
2. **Status strip** — full-width band, `--paper` surface with `--line`
   border, `--r-sm` radius, 8–10px vertical padding. Contains:
   - **Count chips** (left-justified): `<n> <label>` pills using
     `--soft` / `--warn-soft` / `--danger-soft` / `--green-tint` per
     tone. Tabular nums on the count.
   - **Segmented filter** (right-justified) — small `--ink`-on-active
     buttons (28px tall) for hard slices (Tudo / Pix / Pago / Expirado
     etc.).
   - **Filter inputs / selects** to the right of the segmented group.
     32px tall, 3px radius, `--paper` background, `--line` border.
     Names are taken from the existing E2E `data-filter` attributes —
     **must be preserved verbatim**: `patientsQuery`, `stockQuery`,
     `stockStatus`, `ordersStatus`, `fulfillmentStatus`, `supportQuery`,
     `adminStatus`.
   - **Atualizar** ghost button at far right.

### 3.4 Tables — first-class data surface

- Real `<table>` elements. `font-variant-numeric: tabular-nums` on numeric
  columns. Right-aligned numbers.
- Sticky `thead` with `--paper` background, uppercase `--fs-xs` labels in
  `--muted`, 1px bottom `--line`.
- Body rows zebra: odd = `--paper`, even = `--paper-warm`. Hover = `--soft`
  (no lift, no shadow). Row dividers `--line-soft`.
- Sub-section divider rows (`tr.tgroup`) use `--paper-warm` + uppercase
  `--fs-xs` `--muted` label. Used in Estoque (lots) and Suporte (queue
  groupings); avoid sprinkling elsewhere.
- Status cells are pills (recipe per §1). Action cells are 12px green-deep
  text links with `→` glyph, NOT buttons.

### 3.5 Buttons & forms

- **Primary:** `.btn.primary` — `--ink` bg, `--paper` text, 3px radius,
  32px tall, `13px` font. Hover swaps to `--green-deep`.
- **Ghost:** `.btn.ghost` — transparent, `--line` border, `--ink` text.
  Hover = `--paper-warm`.
- **Mini:** `.btn.mini` — 28px tall, 12px font.
- **Icon button:** 28×28px square, 3px radius, `--line` border.
- **Inputs:** 32px tall, 3px radius, `--paper` bg, `--line` border. Focus
  ring = 2px `--ink` outline, no glow. Inline labels (label · input)
  preferred over stacked.

### 3.6 What's deliberately absent

- No gradient heroes anywhere. Gradients are a paciente decision.
- No emoji-as-icon. Use ✓ × ↗ ▾ ⚠ Unicode or simple line SVG.
- No card-as-row layouts. Tables are tables.
- No hover lift on rows. Background swap only.
- No motion beyond focus rings, sidebar bg swap, and the existing 30s
  poll re-render.

## 4. Screen-by-screen specs

### 4.1 Comando (`b-comando.html`) — `/equipe`

Replaces the current 4-quadrant `TeamCommand.jsx` layout.

- **KPI ribbon (5 columns, single bordered card):** Pix pendentes · Em
  separação · Bloqueados · Estoque baixo · Suporte aberto. Each cell:
  `--fs-xs` uppercase label · 28px Outfit value · 11px delta line.
- **Status strip** as §3.3 (count chips + segmented Tudo/Hoje/SLA +
  Atualizar).
- **2-column body:**
  - Left (`minmax(0,1fr)`): **Fila prioritária** panel — flat table:
    Tipo · ID · Paciente · SLA · Status · Valor. Mixes payment rows,
    fulfillment rows, blocked patients, low-stock alerts, support cases —
    user can filter via the segmented control above.
  - Right (`360px`): **Atividade recente** panel — feed list (time +
    what + who) of last 30 minutes, max 6 items visible, scroll for
    more. Drives off existing `ActivityFeed.jsx` data.
- **Preserve** `#team-status` containing literal "equipe autenticada"
  (read by `login_team` E2E). Preserve `#team-dashboard` with literals
  "Fila de acao agora" / "SLA / vencimento" / "Separacao/envio" /
  "Validades" — these are checked verbatim in
  `team_workspace_paths`. May need a hidden helper span if the redesign
  removes one of those literals from visible chrome.

### 4.2 Pacientes (`b-pacientes.html`) — `/equipe/pacientes`

- Status strip with: total · liberados · bloqueados · vence-30d count
  chips; segmented Todos/Liberados/Bloqueados/Vencendo;
  `[data-filter='patientsQuery']` text input.
- **2-column body:**
  - Left (`#patients-surface` preserved): registry table (Código ·
    Paciente · Receita · LGPD · Status · Último login) → expanded
    "Plano de cuidado" section (Médico · Reavaliação · Endereço, with
    "Plano de cuidado" + "Privacidade" literals preserved) → documents
    list (filename · sha256 hash · pill · baixar) preserving "hash" text
    that the E2E expects.
  - Right rail: two stacked forms:
    - `#prescription-document-form` with `memberCode`, `file`, `note`,
      `expiresAt` fields and the literal "Receita registrada" toast on
      success.
    - `#invite-reset-form` with `memberCode`, `inviteCode`, submit.
      Returns "Novo convite: <CODE>" literal as today.

### 4.3 Estoque (`b-estoque.html`) — `/equipe/estoque`

- Status strip: total products · low count · active lots · cultivos
  count; segmented Todos/Baixo/OK; `[data-filter='stockStatus']` select +
  `[data-filter='stockQuery']` text input. Both must keep the same
  attribute names.
- **Top panel — Ledger de produtos:** flat table (SKU · Produto · Categoria
  · Estoque · Reservado · Lotes · Limiar · Status). Click on a row toggles
  an inline `<tr>` "lots" panel (Lote · Quantidade · Validade · Origem ·
  Reservado · editar) below it. `--paper-warm` background. Inline-editable
  cells (categoria, limiar, internalNote) are dashed-border on hover, edit
  mode swaps to `--paper` bg + 2px `--ink` focus ring (preserves existing
  `commitMeta` optimistic-PATCH behaviour).
- **Bottom panel — Cultivo em curso:** flat table (Batch · Strain · Plantio
  · Estimativa · Plantas · Estim. (g) · Stage). Stage cells are pills.
- **Preserve** existing legacy management forms (`#product-form`,
  `#product-update-form`, `#stock-form`, `#cultivation-form`,
  `#cultivation-update-form`) inside `<details>` drawers below — the
  StockRoute comment (lines 13–20) explicitly notes these must stay in
  the DOM.
- **Preserve** literal "Produtos, estoque e cultivo" in the kicker /
  pagehead.

### 4.4 Pedidos (`b-pedidos.html`) — `/equipe/pedidos`

- Status strip: Pix vencendo · aguardando confirmação · pagos hoje ·
  expirado count chips; segmented Tudo/Pix pendente/Pago/Expirado/Cancelado;
  `[data-filter='ordersStatus']` select + free-text filter.
- **2-column body:**
  - Left (`#orders-surface` preserved): pedidos table (Pedido · Paciente
    · Itens · SLA/Pix · Status · Total · action). Action cell mounts
    `[data-pay]` button on Pix rows (E2E clicks the first one).
  - Right (`380px`): order **drawer** showing PED-XXXX detail — status
    pill, Pix code (mono), vencimento, entrega, line items with 32px
    monogram thumbs, totals (subtotal · frete · total), and the same
    `[data-pay]` button as a primary CTA + ghost "Cancelar".
- **Preserve** literal "Pedidos e Pix" + "Webhook Pix simulado" toast
  literal that fires after `[data-pay]` click.

### 4.5 Fulfillment (`b-fulfillment.html`) — `/equipe/fulfillment`

- Status strip: aguardando separar · separando · prontos · enviados-hoje
  count chips; segmented Tudo/SLA hoje/Atrasados;
  `[data-filter='fulfillmentStatus']` select.
- **4-column kanban** (existing `Kanban.jsx` layout, restyled): Aguardando
  separar (warn dot) · Em separação (warn dot) · Pronto p/ envio (green
  dot) · Enviados hoje (muted dot). Each column has a `--paper-warm`
  surface, `--paper` header bar with `--ink` count pill (warn/danger
  variant), and a vertical stack of order cards.
- **Order cards** are `--paper`, 3px radius, 1px `--line` border. Top
  row: mono ID + status pill. Body: patient name (bold) + meta line.
  Footer: timestamp (muted) + total (tabular num). Urgent cards get a
  3px `--warn` left border; danger get `--danger`; OK get `--green`.
- **Preserve** literals "Fulfillment e envio" and "Pagamento confirmado"
  (E2E asserts the latter appears after a `[data-pay]` click on Pedidos).
- **Drag-and-drop** kept as-is (existing `Kanban.jsx` logic).

### 4.6 Suporte (`b-suporte.html`) — `/equipe/suporte`

Replaces the current `Workbench.jsx` layout with a 3-column workbench.

- Status strip: abertos · aguardando paciente · resolvidos hoje + topic
  chips ("Revisão de acesso", "Dúvida sobre renovação", … preserving
  the E2E literals); segmented Tudo/Meus/SLA<4h;
  `[data-filter='supportQuery']` select.
- **3-column body** wrapped in `#support-surface`:
  - **Queue (320px)** — list of cases. Each item: 28px green-gradient
    avatar + name/time + subject + 1-line preview. Active item gets
    `--green-tint` bg + 3px `--green` left border.
  - **Case panel (flex)** — header with case h2 + meta strip (status
    pill + "aberto há …" + "marcar resolvido" ghost). Thread shows
    paciente messages (`--paper-warm` bubbles, left-aligned) and
    equipe messages (`--ink` bubbles, right-aligned). Reply box: row of
    quick-reason chips ("+ Verificando webhook", "+ Pix confirmado", …)
    - textarea + actions footer (Anotar ghost + Enviar primary).
  - **Context (320px)** — sections: Paciente · Pedido recente · Documentos
    · Casos anteriores. Drives off existing dashboard payload. Must
    contain literal "Ultimo login" + "Reserva" + "documento(s)
    registrados" (E2E asserts these).
- **Preserve** literals "Suporte ao paciente", "Ultimo login", "Reserva",
  "Duvida sobre renovacao", "Revisao de acesso", "documento(s)
  registrados".

### 4.7 Admin (`b-admin.html`) — `/admin`

Mounts the same `TeamShell` so the sidebar/topbar are consistent.

- Status strip: "1 release bloqueado por evidências pendentes" + total
  gates / verdes / amarelos chips; segmented Gates/Auditoria/Usuários;
  `[data-filter='adminStatus']` select preserving the existing values
  (`payment`, …).
- **Release gates · Readiness do ambiente:** 3-column grid of 9 gate
  cards. Each card: title + colored pill (verde/amarelo) · 1-line
  description · monospace command line (`--soft` background) · footer
  with last-run timestamp + "Re-rodar" or "Anexar" CTA.
  - Card titles are the literals the E2E asserts: **Pix provider · Webhook
    Pix · Aceite do provider · Deploy/domain/logs · Domínio/TLS · Schema
    DB · Sessão/cookie · Backup/restore · Backup offsite**, with
    descriptions containing "provider approval", "webhook drill",
    "deployment check", "domain tls", "schema db", "session cookie",
    "restore drill", "backup offsite", "Webhook Pix assinado validado",
    "Release bloqueado por evidencias pendentes", "Readiness do
    ambiente", "release gate" — **all of those literals must remain in
    the DOM.**
- **Auditoria recente (anchored `#auditoria`):** timeline list — time +
  status dot + what/meta. Drives off existing
  `AuditTimeline.jsx` + `groupAuditEvents.js` (timestamps grouped by
  bucket as today). Must contain literal "Auditoria recente".
- **Usuários da equipe** panel beside auditoria: mini-table (Usuário ·
  Papel · Último) + footer with "Trocar papel" ghost + "+ Convidar"
  primary. Drives off `TeamUsersTable.jsx`.

## 5. Component impact matrix

| Component / file                                                      | Action                                                                                                                                                           |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/equipe/components/TeamShell.jsx`                                 | Reshape sidebar groups, topbar (add gsearch), keep `#team-status` + Cmd-K wiring                                                                                 |
| `app/equipe/components/TeamShell.module.css`                          | Rewrite to Direction B (light sidebar, ink active)                                                                                                               |
| `app/equipe/TeamCommand.jsx`                                          | Reshape Comando body (KPI ribbon + 2-col fila/feed); keep `#team-dashboard` literals                                                                             |
| `app/equipe/components/KpiSpark.jsx` + module CSS                     | Repurpose into ribbon cell                                                                                                                                       |
| `app/equipe/components/PriorityQueue.jsx` + CSS                       | Reshape into flat priority table                                                                                                                                 |
| `app/equipe/components/ActivityFeed.jsx` + CSS                        | Right-rail feed restyle                                                                                                                                          |
| `app/equipe/components/PixByHour.jsx` + CSS                           | Demote — keep available but not on Comando (move to Admin or remove if unused)                                                                                   |
| `app/equipe/pacientes/PatientsClient.jsx`                             | New status strip + 2-col layout; keep `#patients-surface`, `#prescription-document-form`, `#invite-reset-form`, "Plano de cuidado" + "Privacidade" literals      |
| `app/equipe/estoque/StockRoute.jsx` + components/\*                   | New status strip; ProductLedger restyle (sticky thead + zebra + lot expand row); CultivoPanel restyle; keep legacy `<details>` drawers + all `data-filter` names |
| `app/equipe/pedidos/OrdersClient.jsx` + components/\*                 | Status strip + Ledger.jsx restyle (zebra + sticky thead); OrderDrawer.jsx restyle; preserve `#orders-surface` + `[data-pay]`                                     |
| `app/equipe/fulfillment/components/Kanban*.jsx` + CSS                 | Restyle columns + cards per §4.5; keep DnD logic                                                                                                                 |
| `app/equipe/suporte/components/Workbench.jsx` + CSS                   | Restyle into 3-col layout + reply chips; preserve `#support-surface` + literals                                                                                  |
| `app/equipe/suporte/components/QueueColumn/CasePanel/Thread/ReplyBox` | CSS rewrite (no React-tree wholesale changes)                                                                                                                    |
| `app/admin/page.jsx`                                                  | Mount under `TeamShell`; rebuild gate cards grid + audit + users                                                                                                 |
| `app/admin/components/GateCard.jsx` + CSS                             | Rewrite to §4.7 card recipe                                                                                                                                      |
| `app/admin/components/GateDetail.jsx` + CSS                           | Restyle to consistent panel pattern                                                                                                                              |
| `app/admin/components/AuditTimeline.jsx` + CSS                        | Restyle list per §4.7                                                                                                                                            |
| `app/admin/components/AuditEventModal.jsx` + CSS                      | Drawer/modal restyle (3px radius, ink CTAs)                                                                                                                      |
| `app/admin/components/ReleaseProgress.jsx` + CSS                      | Repurpose into status-strip count chip set                                                                                                                       |
| `app/admin/components/TeamUsersTable.jsx` + CSS                       | Restyle as mini-table; "Trocar papel" + Convidar                                                                                                                 |
| `app/admin/components/UserRow.jsx` + CSS                              | Inline restyle                                                                                                                                                   |
| `app/admin/admin.module.css`                                          | Rewrite                                                                                                                                                          |
| **NEW** `app/equipe/components/StatusStrip.jsx` + CSS                 | Shared primitive used on every internal route                                                                                                                    |
| **NEW** `app/equipe/components/PageHead.jsx` + CSS                    | Shared primitive (h1 + meta + actions row)                                                                                                                       |

## 6. Constraints & invariants

- **Framework boundary:** `src/` cannot import `next` or `react`. This
  spec touches only `app/equipe/**`, `app/admin/**`, `app/globals.css`
  (additions only), and shared components under `app/equipe/components/`.
- **Single domain instance:** all data still flows through
  `getSystem()`. No new endpoint calls are required.
- **E2E selector inventory** is the contract — see §4 callouts. Before
  each phase, re-grep `scripts/e2e-production-app.py` and
  `scripts/smoke-production-app.mjs` for the file being changed.
- **No new external dependencies.**
- **Mobile (≥1024px):** sidebar collapses to a horizontal strip
  (existing `TeamShell.module.css` already does this). Below 1024px,
  status strip wraps; tables get horizontal scroll inside `panel`.
- **Motion budget:** focus rings, sidebar hover bg swap, 30s poll
  re-render, kanban DnD ghost. Nothing else.

## 7. Risks & open questions

- **Admin route currently does NOT mount TeamShell.** Wrapping it adds
  the sidebar but means Admin is no longer a top-level "kiosk". Verify
  no E2E expects `/admin` without the shell chrome. **Action:** read
  `team_workspace_paths` (line 209+) closely; the only assertions are on
  body text content, so this should be safe.
- **`#team-dashboard` literals.** "Fila de acao agora" / "SLA /
  vencimento" / "Separacao/envio" / "Validades" are checked verbatim.
  The new Comando uses different headings ("Fila de ação agora",
  "Atividade recente", KPI labels). **Action:** keep the original
  literals as visually-hidden helper spans, OR keep them as the actual
  headings (current copy is fine — only the surrounding chrome changes).
- **Audit timeline grouping** lives in `groupAuditEvents.js` — pure
  function, untouched. Just the visual list restyles.
- **CommandPalette** stays mounted as a sibling of `TeamShell` — no
  visual change beyond inheriting button styles.
- **`/admin#auditoria` deep link** (sidebar item "Auditoria") — preserve
  the anchor and ensure the gate grid scrolls past it.
- **PixByHour & ReleaseProgress components.** Currently mounted on
  Comando. Direction B doesn't include them on Comando. Decision: move
  them to Admin (PixByHour as a small panel, ReleaseProgress as the
  status-strip count summary), or retire if unused. Confirm in plan
  phase.

## 8. Verification

Before declaring any phase complete:

1. `npm run check` — lint + format clean.
2. `npm test` — all Node tests pass.
3. `npm run e2e` (or `npm run verify:isolated`) — Playwright sweep
   passes including the team_workspace_paths and overflow checks.
4. Visual smoke: open dev server (`http://127.0.0.1:4184`), log in as
   equipe, walk through all 7 routes. Compare each against
   `docs/superpowers/specs/admin-revamp-mockups/b-*.html`.
5. User sign-off after the visual smoke.

## 9. Out of scope, queued for later

- Mobile redesign below 1024px (best-effort layout, not pixel target).
- New iconography library (using Unicode glyphs + minimal inline SVG).
- Activity feed pagination / time-window controls.
- Admin user invite flow modal (mockup shows a simple form footer; the
  actual invite UX is a separate decision).
- Audit event modal interactions (Filter by actor / by entity / export).
- Real-time websocket updates (current 30s poll stays).

---

**Awaiting user review.** Once approved, the next step is to invoke
`superpowers:writing-plans` to produce the phased implementation plan,
then drive each phase through plan-agent / implement / validate-agent
teams (per user direction).
