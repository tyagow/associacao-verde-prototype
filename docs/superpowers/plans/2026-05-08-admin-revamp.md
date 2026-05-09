# Admin / Equipe Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to drive this plan phase-by-phase. Each phase dispatches a 3-agent team (plan-agent → implementer → validate-agent). Phases are sequential — Phase 0 is foundation; do not start Phase 1+ before Phase 0 is green. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Apply Direction B (Stripe Workbench) visual language to all 7 internal screens (`/equipe/*` and `/admin`) without breaking E2E selectors or `src/` framework boundary.

**Architecture:** Reshape `TeamShell` (sidebar + topbar) and introduce two shared primitives (`StatusStrip`, `PageHead`). Restyle the existing per-route components in place — no React-tree rewrites. Mount `/admin` under `TeamShell` so the sidebar carries through compliance.

**Tech Stack:** Next.js (App Router) · React 18 client components · CSS Modules · brand tokens in `app/globals.css` (radii 3/5/7, pills 999px, buttons 3px) · Node test runner (`tsx`) · Playwright E2E (`scripts/e2e-production-app.py`).

**Spec:** `docs/superpowers/specs/2026-05-08-admin-revamp-design.md`
**Mockups:** `docs/superpowers/specs/admin-revamp-mockups/` (also served at http://127.0.0.1:8766/)
**Ledger:** `thoughts/ledgers/CONTINUITY_CLAUDE-admin-revamp.md`

---

## Agent-team execution pattern (per phase)

For each phase, dispatch THREE specialised agents in sequence:

1. **plan-agent** (`subagent_type: plan-agent`, `model: opus`) — Reads spec §<phase> + mockup file + listed components + greps E2E for the route. Produces a detailed phase plan saved to `thoughts/shared/plans/admin-revamp/phase-<N>-<slug>.md` with concrete file diffs at the step level.
2. **implementer** (`subagent_type: general-purpose`, `model: opus`) — Executes the phase plan from start to finish. Runs `npm run check` after each major file group. Reports the full list of files changed.
3. **validate-agent** (`subagent_type: validate-agent`, `model: opus`) — Reads the diff vs spec + mockup. Runs `npm run check`, `npm test`, and the targeted E2E for the route. Greps for required E2E selectors. Reports pass / fail with per-selector evidence.

**Loop rule:** if validate-agent fails, dispatch implementer again with the failure report appended. Do NOT advance to the next phase until validate-agent is green.

**Worktree rule:** create one worktree per phase via `git worktree add` so phases can be reviewed independently. Branch naming `feat/admin-revamp-phase-<N>-<slug>`.

---

## Phase 0 — Foundation: shared primitives + TeamShell reshape

**Goal:** Land the new `TeamShell` chrome (light sidebar, breadcrumb topbar, global search, role pill) and two NEW shared primitives (`StatusStrip`, `PageHead`) used by every later phase. Existing routes keep working unchanged because the primitives are new and the TeamShell reshape preserves all existing literals + `#team-status` + Cmd-K wiring.

**Files:**

- Create: `app/equipe/components/StatusStrip.jsx`
- Create: `app/equipe/components/StatusStrip.module.css`
- Create: `app/equipe/components/PageHead.jsx`
- Create: `app/equipe/components/PageHead.module.css`
- Modify: `app/equipe/components/TeamShell.jsx`
- Modify: `app/equipe/components/TeamShell.module.css`
- Modify: `app/globals.css` (add admin-dialect helper utilities only if needed — no new tokens)
- Test: `test/team-shell.test.mjs` (NEW, optional smoke that the shell renders without throwing)

**Selectors / literals to preserve:**

- `#team-status` containing "equipe autenticada"
- `Brand` component intact in topbar left
- `data-cmdk-trigger` on the Cmd-K affordance
- Existing keyboard ⌘K binding
- Sidebar hrefs: `/equipe`, `/equipe/pacientes`, `/equipe/estoque`, `/equipe/pedidos`, `/equipe/fulfillment`, `/equipe/suporte`, `/admin`, `/admin#auditoria`

**Steps (driven by Phase 0 plan-agent — bite-sized list will be in `thoughts/shared/plans/admin-revamp/phase-0-foundation.md`):**

- [ ] Plan-agent produces detailed phase plan
- [ ] Implementer creates `StatusStrip` + `PageHead` primitives w/ CSS modules
- [ ] Implementer reshapes `TeamShell` JSX (groups Operação / Compliance, breadcrumb topbar, global search field, role pill)
- [ ] Implementer rewrites `TeamShell.module.css` to Direction B (light cream sidebar, ink active row, hairline topbar)
- [ ] Implementer runs `npm run check` — fix any lint
- [ ] Validate-agent runs `npm run check` + `npm test` + targeted E2E (just `/equipe` smoke — body must still contain "equipe autenticada")
- [ ] Validate-agent greps for `#team-status`, ⌘K binding, Brand mount
- [ ] Commit on feature branch `feat/admin-revamp-phase-0-foundation`

**Verification commands:**

- `npm run check`
- `npm test`
- `node --import tsx --test test/team-shell.test.mjs` (if added)

---

## Phase 1 — Comando dashboard (`/equipe`)

**Goal:** Replace the current `TeamCommand.jsx` body with a KPI ribbon (5 cells) + 2-column body (priority queue table left, activity feed right), wrapped in `PageHead` + `StatusStrip`.

**Files:**

- Modify: `app/equipe/TeamCommand.jsx`
- Modify: `app/equipe/components/KpiSpark.jsx` + `KpiSpark.module.css` (repurpose into KPI ribbon cell)
- Modify: `app/equipe/components/PriorityQueue.jsx` + `PriorityQueue.module.css` (flat priority table)
- Modify: `app/equipe/components/ActivityFeed.jsx` + `ActivityFeed.module.css` (right-rail feed restyle)
- Decide: `app/equipe/components/PixByHour.jsx` — move to Admin (Phase 7) or remove (decide in Phase 0 plan-agent recommendation; default = move)

**Selectors / literals to preserve:**

- `#team-dashboard` container
- Literals "Fila de acao agora", "SLA / vencimento", "Separacao/envio", "Validades" (verbatim)

**Verification commands:**

- `npm run check && npm test`
- Playwright sweep `/equipe` — see `team_workspace_paths` in `scripts/e2e-production-app.py`

---

## Phase 2 — Pacientes & documentos (`/equipe/pacientes`)

**Goal:** Apply chrome (`PageHead` + `StatusStrip`); rebuild registry table; preserve `#patients-surface`, `#prescription-document-form`, `#invite-reset-form`, "Plano de cuidado", "Privacidade", "Receita registrada", "Novo convite: <CODE>" literals.

**Files:**

- Modify: `app/equipe/pacientes/PatientsClient.jsx`
- Create: `app/equipe/pacientes/PatientsClient.module.css` (extract inline styles)
- Modify: any helper components under `app/equipe/pacientes/`

**Selectors:** `[data-filter='patientsQuery']`, `#patients-surface`, `#prescription-document-form` w/ `memberCode`/`file`/`note`/`expiresAt`, `#invite-reset-form` w/ `memberCode`/`inviteCode`.

---

## Phase 3 — Estoque & cultivo (`/equipe/estoque`)

**Goal:** Apply chrome; restyle `ProductLedger` (sticky thead + zebra + click-to-expand lots row) and `CultivoPanel`. Preserve legacy `<details>` forms (`#product-form`, `#product-update-form`, `#stock-form`, `#cultivation-form`, `#cultivation-update-form`).

**Files:**

- Modify: `app/equipe/estoque/StockRoute.jsx`
- Modify: `app/equipe/estoque/components/ProductLedger.jsx` + `.module.css`
- Modify: `app/equipe/estoque/components/ProductRow.jsx` + `.module.css`
- Modify: `app/equipe/estoque/components/LotRow.jsx` + `.module.css`
- Modify: `app/equipe/estoque/components/CultivoPanel.jsx` + `.module.css`

**Selectors:** `[data-filter='stockQuery']`, `[data-filter='stockStatus']`, "Produtos, estoque e cultivo".

---

## Phase 4 — Pedidos & Pix (`/equipe/pedidos`)

**Goal:** Apply chrome; restyle `Ledger` (zebra table) and `OrderDrawer` (right rail). Preserve `#orders-surface`, `[data-pay]`, "Webhook Pix simulado" toast.

**Files:**

- Modify: `app/equipe/pedidos/OrdersClient.jsx`
- Modify: `app/equipe/pedidos/components/Ledger.jsx` + `.module.css`
- Modify: `app/equipe/pedidos/components/OrderRow.jsx` + `.module.css`
- Modify: `app/equipe/pedidos/components/OrderDrawer.jsx` + `.module.css`

**Selectors:** `[data-filter='ordersStatus']`, `#orders-surface`, `[data-pay]`, "Pedidos e Pix".

---

## Phase 5 — Fulfillment kanban (`/equipe/fulfillment`)

**Goal:** Apply chrome; restyle 4-column kanban + order cards. Preserve "Fulfillment e envio" + "Pagamento confirmado" + DnD logic.

**Files:**

- Modify: `app/equipe/fulfillment/components/Kanban.jsx` + `.module.css`
- Modify: `app/equipe/fulfillment/components/KanbanColumn.jsx` + `.module.css`
- Modify: `app/equipe/fulfillment/components/OrderCard.jsx` + `.module.css`

**Selectors:** `[data-filter='fulfillmentStatus']`, "Fulfillment e envio", "Pagamento confirmado".

---

## Phase 6 — Suporte workbench (`/equipe/suporte`)

**Goal:** Apply chrome; restyle 3-column workbench (queue + thread + context). Add quick-reason chips above reply textarea.

**Files:**

- Modify: `app/equipe/suporte/components/Workbench.jsx` + `.module.css`
- Modify: `app/equipe/suporte/components/QueueColumn.jsx` + `.module.css`
- Modify: `app/equipe/suporte/components/CasePanel.jsx` + `.module.css`
- Modify: `app/equipe/suporte/components/Thread.jsx` + `.module.css`
- Modify: `app/equipe/suporte/components/ReplyBox.jsx` + `.module.css`

**Selectors:** `[data-filter='supportQuery']`, `#support-surface`, "Suporte ao paciente", "Ultimo login", "Reserva", "documento(s) registrados", "Duvida sobre renovacao", "Revisao de acesso".

---

## Phase 7 — Admin · gates · audit · users (`/admin`)

**Goal:** Mount `/admin` under `TeamShell`; rebuild gate cards (3-col grid of 9 cards), audit timeline panel, and users mini-table. Preserve every gate-name + drill-name literal.

**Files:**

- Modify: `app/admin/page.jsx` (mount TeamShell)
- Modify: `app/admin/components/GateCard.jsx` + `.module.css`
- Modify: `app/admin/components/GateDetail.jsx` + `.module.css`
- Modify: `app/admin/components/AuditTimeline.jsx` + `.module.css`
- Modify: `app/admin/components/AuditEventModal.jsx` + `.module.css`
- Modify: `app/admin/components/ReleaseProgress.jsx` + `.module.css`
- Modify: `app/admin/components/TeamUsersTable.jsx` + `.module.css`
- Modify: `app/admin/components/UserRow.jsx` + `.module.css`
- Modify: `app/admin/admin.module.css`

**Selectors / literals (every one MUST appear in DOM):**
"Auditoria recente", "Admin e compliance", "Readiness do ambiente", "release gate", "Release bloqueado por evidencias pendentes", "Pix provider", "Webhook Pix", "webhook drill", "Webhook Pix assinado validado", "Aceite do provider", "provider approval", "Deploy/domain/logs", "deployment check", "Dominio/TLS", "domain tls", "Schema DB", "schema db", "Sessao/cookie", "session cookie", "Backup/restore", "restore drill", "Backup offsite", "backup offsite". Plus `[data-filter='adminStatus']` accepting value `payment`.

---

## Phase 8 — Full E2E sweep + visual sign-off

**Goal:** Full Playwright sweep, mobile overflow check, and user visual walkthrough across all 7 routes.

**Steps:**

- [ ] `npm run verify:isolated` — full isolated smoke + readiness
- [ ] `npm run e2e` — full Playwright sweep including `responsive_overflow_check` at 390px and 1440px
- [ ] Visual smoke: log into dev server (http://127.0.0.1:4184), walk through all 7 routes, compare to mockups
- [ ] Update CLAUDE.md to mention the new `StatusStrip` / `PageHead` primitives + sidebar groups
- [ ] Update `docs/superpowers/design.md` if any token usage drifted (it shouldn't)
- [ ] Mark all phases `[x]` in the ledger
- [ ] User sign-off
- [ ] Squash-merge feature branches into main (optional — depends on user preference)

---

## Self-Review (run after writing this plan)

1. **Spec coverage:** All 7 screens have a phase. ✓ TeamShell reshape and shared primitives are Phase 0. ✓ Admin mount under TeamShell is Phase 7 with the explicit literal list. ✓
2. **Placeholder scan:** No "TBD" / "implement later" — every phase names files and selectors. Each phase delegates step-level code blocks to its own plan-agent file (intentional decomposition for an 8-phase visual revamp; in-line code blocks per step would balloon this file past usefulness).
3. **Type consistency:** Component names match across phases (`PriorityQueue`, `OrdersClient`, `Workbench`, `GateCard`). Selector names match `data-filter` E2E grep. Literals quoted verbatim from `scripts/e2e-production-app.py`.
4. **Decomposition:** Each phase produces working, testable software on its own — Phase 0 ships a no-op-visual chrome upgrade; each subsequent phase upgrades one route in isolation.

If a phase plan-agent finds the spec missing a detail, it must update the spec FIRST (and the ledger), then produce its plan.
