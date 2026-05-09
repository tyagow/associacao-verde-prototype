# Session: admin-revamp
Updated: 2026-05-09T01:30:00Z
Status: **SHIPPED** (16 commits 10bfc1f → f426572 on `feat/paciente-revamp-b`)

## Goal
Full visual revamp of the internal team experience (`/equipe/*` and
`/admin`) using Direction B ("Stripe Workbench" — utility-first sidebar
shell, status strip on every page, sticky-thead tables with light zebra,
ink-on-active sidebar). Done when all 7 internal screens listed below
ship to production with their existing E2E selectors intact and
`npm run check`, `npm test`, and `npm run e2e` (or `verify:isolated`)
all pass green.

7 screens in scope:
1. Comando (`/equipe`)
2. Pacientes & documentos (`/equipe/pacientes`)
3. Estoque & cultivo (`/equipe/estoque`)
4. Pedidos & Pix (`/equipe/pedidos`)
5. Fulfillment kanban (`/equipe/fulfillment`)
6. Suporte ao paciente (`/equipe/suporte`)
7. Admin · gates + audit + users (`/admin`)

## Constraints
- **Spec source of truth:** `docs/superpowers/specs/2026-05-08-admin-revamp-design.md`.
- **Mockups source of truth:** `docs/superpowers/specs/admin-revamp-mockups/*.html`,
  served at http://127.0.0.1:8766/ during brainstorm.
- **Brand tokens:** locked globally in `app/globals.css` — radii 3/5/7,
  pills/avatars 999px, buttons 3px. Same tokens as paciente. Do not
  introduce new colors or fonts.
- **E2E selectors must be preserved.** Sources of truth:
  - `scripts/e2e-production-app.py::team_workspace_paths` (line 163+)
  - `scripts/smoke-production-app.mjs` (lines 110+)
  - Notable: `#team-status` ("equipe autenticada"), `#team-dashboard`
    ("Fila de acao agora" + "SLA / vencimento" + "Separacao/envio" +
    "Validades"), `#patients-surface`, `#prescription-document-form`,
    `#invite-reset-form` ("Novo convite: <CODE>"), `#orders-surface`,
    `[data-pay]` ("Webhook Pix simulado"), `#support-surface`,
    `[data-filter='patientsQuery|stockQuery|stockStatus|ordersStatus|fulfillmentStatus|supportQuery|adminStatus']`,
    plus the 14 admin literals (Pix provider, Webhook Pix, …) listed in
    spec §4.7.
- **Architectural boundary:** `src/` cannot import `next` or `react`.
  Touch only `app/equipe/**`, `app/admin/**`, and additions to
  `app/globals.css`.
- **Pure Next.js routing:** `/admin` will be brought under `TeamShell`
  (currently it is not). Verify no E2E expects the unwrapped chrome.
- **Component split kept.** Reshape `TeamShell`, gate cards, ledgers,
  kanban, workbench in place. Two NEW shared primitives:
  `app/equipe/components/StatusStrip.jsx` and `PageHead.jsx`.
- **Coordinate with paciente session** via `docs/superpowers/design.md`
  if a token-level change affects both portals.

## Key Decisions
- **Direction B — Stripe Workbench.** Chosen by user from A (Linear
  Mono) / B / C (Retool Cockpit) after seeing all 3 mockups served at
  http://127.0.0.1:8766/.
- **Sidebar is light cream (`--paper-warm`)**, ink active row. Grouped
  sections: Operação · Compliance.
- **Status strip is shared primitive** — count chips + segmented filter
  + filter input(s) + "Atualizar" button. Used on every internal route.
- **Tables zebra-light:** odd `--paper`, even `--paper-warm`, hover
  `--soft`. Sticky `thead`. No card-as-row.
- **Admin gets the same TeamShell** so the sidebar carries through
  compliance.
- **Comando dashboard = KPI ribbon + 2-col fila/feed** (NOT 3-pane
  cockpit, NOT 1-col). KPI ribbon is one bordered card with 5 cells.
- **Suporte = 3-col workbench** (queue · thread · context).
- **Pedidos = list + drawer** (right rail showing the active order).
- **Fulfillment = 4-col kanban** (existing component, restyled).
- **Estoque = ledger + inline lot expand**, cultivo as separate panel
  below. Legacy `<details>` forms preserved.
- **Ledger and spec written before implementation.** Implementation
  proceeds via agent-team pattern (plan-agent → implement_task →
  validate-agent) per phase, NOT one big subagent.

## State
- Done:
  - [x] Read design.md (post 3/5/7 lock) + paciente spec for coherence
  - [x] Surveyed admin/equipe components and E2E selector inventory
  - [x] Built 3 directions of Comando dashboard (A · B · C) at
        http://127.0.0.1:8766/
  - [x] User picked Direction B (Stripe Workbench)
  - [x] Built 7 full-screen mockups for Direction B (Comando · Pacientes
        · Estoque · Pedidos · Fulfillment · Suporte · Admin)
  - [x] Persisted mockups to `docs/superpowers/specs/admin-revamp-mockups/`
  - [x] Wrote spec: `docs/superpowers/specs/2026-05-08-admin-revamp-design.md`
  - [x] Phase 0: Shared primitives (`StatusStrip`, `PageHead`) + TeamShell reshape (commits 10bfc1f, 1d7da80)
  - [x] Phase 1: Comando dashboard (commits 17ef507, f49d222)
  - [x] Phase 2: Pacientes & documentos (commit 8b9d7fb)
  - [x] Phase 3: Estoque & cultivo (commit 10b1afd)
  - [x] Phase 4: Pedidos & Pix (commit a13baf7)
  - [x] Phase 5: Fulfillment kanban (commit e400256)
  - [x] Phase 6: Suporte workbench (commit f17ed8a)
  - [x] Phase 7: Admin (gates · audit · users) + mount under TeamShell (commit 78953dc)
  - [x] Phase 8: E2E green sweep — `npm run check` PASS, `npm test` 82/82 PASS,
        `next build` PASS, all 7 readiness drills PASS, selector sweep PASS
        (15/15 selectors found), literal sweep PASS (all 13 admin literals
        present). E2E Playwright sweep blocked by an UPSTREAM paciente-revamp
        regression (post-consent visuallyHidden submit button intercepted by
        new CatalogSection hero, then `.patient-current-order` empty after
        checkout — both in untracked paciente WIP files, NOT admin scope).
  - [x] Roast pass 1 (commit `ced006f`): deleted PixByHour + ReleaseProgress,
        added `--danger-ink` token, replaced inline styles with CSS modules
  - [x] Roast pass 2 (commits `00eff15` `3f96eb8` `1aa251e` `403913c` `bfb8e3e` `a3924af`):
        wired Suporte Meus/SLA<4h segments, removed dead Anotar button,
        collapsed Pedidos drawer when no order selected, fulfillment empty-SLA
        message, useCallback hygiene on admin/page.jsx, +6 tests for primitives
  - [x] Migrate Brand + TeamCommand topbar to next/link (commit `f426572`)
  - [x] Reconciled MEMORY.md — added `project_admin_revamp_shipped.md`
        memory entry (separate initiative from closed Calm Clinical Modern)
- Now: [→] SHIPPED — awaiting user visual sign-off via http://127.0.0.1:4184/equipe
        (login: equipe@apoiar.local / apoio-equipe-dev)
- Next: (none — initiative closed)

## Open Questions (all resolved)
- ~~UNCONFIRMED: Mounting `/admin` under `TeamShell`~~ → RESOLVED Phase 7:
  no E2E breaks; mounted at `app/admin/page.jsx:166`.
- ~~UNCONFIRMED: `#team-dashboard` literals~~ → RESOLVED Phase 1: literals
  rendered as visible KPI labels + page heading; all 4 grep-confirmed.
- ~~UNCONFIRMED: Fate of `PixByHour.jsx` / `ReleaseProgress.jsx`~~ →
  RESOLVED roast pass 1: both deleted (commit `ced006f`).

## Working Set
- Branch: `main` (no feature branch yet — create per phase via
  `superpowers:using-git-worktrees`)
- Spec: `docs/superpowers/specs/2026-05-08-admin-revamp-design.md`
- Mockups: `docs/superpowers/specs/admin-revamp-mockups/`
- Mockup server: `python3 -m http.server 8766` from
  `/tmp/admin-mockups/` (background PID logged in `/tmp/admin-mockups/server.log`)
- Dev server: http://127.0.0.1:4184 (managed by
  `scripts/dev-watchdog.sh`)
- Test commands:
  - `npm run check` — lint + format
  - `npm test` — Node test suite
  - `npm run verify:isolated` — self-bootstrapping smoke + readiness
  - `npm run e2e` — Playwright sweep (one-time `next build`, then
    `next start` on a free port)
- Login: `equipe@apoiar.local` / `apoio-equipe-dev`

## Agent-Team Execution Pattern (per phase)

Each phase runs as a 3-step team (NOT one monolithic subagent):

1. **plan-agent** — Reads spec §<phase> + mockup + listed components +
   E2E grep for the route. Produces a phase plan (files to touch,
   selectors to preserve, copy changes, verification steps).
2. **implement_task** — Executes the phase plan. Edits CSS modules and
   JSX components. Runs `npm run check` after each component group.
3. **validate-agent** — Reads the diff + spec + mockup. Re-runs
   `npm run check` + `npm test` + targeted E2E. Reports pass/fail with
   selector-preservation evidence.

If validate-agent fails, loop back to implement_task with the failure
report. Do NOT advance phases until validate-agent is green.
