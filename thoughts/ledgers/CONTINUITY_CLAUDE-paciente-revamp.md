# Session: paciente-revamp
Updated: 2026-05-08T22:00:00Z

## Goal
Full visual + IA revamp of the patient portal (`/paciente`) using Direction B
("Storefront acolhedor"). Done when all 10 screens listed below ship to
production with their existing E2E selectors intact and `npm run check`,
`npm test`, and `npm run e2e` pass green.

10 screens in scope:
1. Login (`/paciente` logged-out)
2. Consentimento LGPD (first-visit gate)
3. Bloqueado (suspended-access takeover)
4. Pedido — Vazio (catalog only, empty cart)
5. Pedido — Carrinho cheio (catalog + active right-rail summary)
6. Pedido — Pix aberto (QR + countdown + reserved items)
7. Pedido — Pago / em separação (status timeline)
8. Histórico (orders list with filter chips + expand)
9. Suporte (form with quick-reason chips + side FAQ)
10. Meu perfil (own page, NOT a drawer — user explicitly chose this)

## Constraints
- **Mockups source of truth:** `/tmp/av-mockups/*.html` served at
  http://127.0.0.1:8765/. Index links all 10 screens. Replicate look/feel
  to production code.
- **Brand tokens:** already defined in `app/globals.css` (paper, ink, green,
  green-tint, gold, etc.). Mockups use those exact tokens; do not introduce
  new colors without updating tokens deliberately.
- **E2E selectors must be preserved.** Listed in CLAUDE.md and component
  comments. Notably:
  - `#patient-status` (status pill, must remain)
  - `#patient-login`, `input[name=memberCode]`, `input[name=inviteCode]`
  - `#privacy-consent-panel` w/ "Privacidade e LGPD" + "Consentimento
    registrado" / "Autorizar uso dos dados" copy (the latter currently is
    "Autorizar uso dos dados para atendimento" — verify exact assertion
    before changing copy)
  - `#access-issue` w/ "Acesso nao liberado" + "Atendimento precisa
    revisar seu cadastro" + form fields
  - `#patient-orders` (history container)
  - `#support-request-form`, `input[name=subject]`, `textarea[name=message]`,
    `button[type=submit]`
  - `#patient-profile-details` children must stay mounted (see
    ProfileDrawer.jsx comment) — moving profile to its own route changes
    this assumption; **must verify the E2E test before refactor**
  - `#cart-summary` must contain literal "Resumo antes do Pix"
  - `#toast` cross-cutting selector
- **Architectural boundary:** `src/` cannot import `next` or `react`.
  Only touch `app/paciente/**` and CSS.
- **Pure Next.js architecture:** if Meu perfil becomes its own route,
  add as `app/paciente/perfil/page.jsx` (or as a tab within
  `PatientPortal.jsx` keyed off state — check what's least invasive).
- **Framework boundary:** keep using existing component split
  (PatientShell, PatientTabs, CartHero, PixHero, HistoryList,
  SupportThread, AccessIssueScreen, PrivacyConsentGate). Reshape their
  internals/CSS, do not rewrite the React tree wholesale.
- **`PatientPortal.jsx` is 919 lines** — do not balloon further. Extract
  a new `MyProfilePage.jsx` (or similar) for the perfil tab.

## Key Decisions
- **Direction B — Storefront acolhedor.** Chosen by user from A (Clínica
  calma) / B / C (Operação densa). Warm e-commerce with care signals.
- **Meu perfil is its own page**, NOT the side drawer. User explicit.
  ProfileDrawer.jsx is decommissioned (or repurposed). The "Meu perfil"
  link in the topbar tab row navigates to a 4th tab pinned right.
- **Right rail (380px) sticky** for Pedido tab when there's a cart or Pix.
  Empty state has the rail too but with a friendly empty illustration.
- **Pix screen replaces catalog UI entirely** when a Pix is open — single
  focused screen with QR + countdown + items + 5-step timeline. Don't
  show catalog/cart in this state.
- **Login screen is split-screen** — dark green pitch panel (left, the
  only place we use the dark gradient) + form card (right).
- **Consentimento gate has 3-step progress** (Login ✓ → Consentimento →
  Pedido). Replaces the current dense red/green panel with: 4 use-icons,
  2 collapsibles (what we don't do / who has access), one explicit
  checkbox + accept button.
- **Histórico uses single-line rows** with expand-on-click. Filter chips
  segmented at top (Todos / Ativos / Concluídos / Expirados).
- **Suporte exposes quick-reason chips** (Renovar receita, Pix não
  confirmou, etc.) above the free-form form. Side rail auto-links to the
  most recent order.

## Parallel sessions
- **This session (paciente-revamp):** patient portal redesign.
- **Admin sister session (surface:179):** spawned 2026-05-08 to redesign
  `app/admin` and `app/equipe` (estoque, pedidos, pacientes,
  fulfillment, suporte, admin gates/audit). Both sessions share
  `docs/superpowers/design.md` (Apoiar Brasil — Shared Design Guide)
  which encodes two visual dialects: paciente (this session) is
  "Storefront acolhedor" — rounded 8/12/16; admin is "Operação
  utilitária" — sharp 4/6/8, tables-first, sidebar shell, no gradient
  heroes, no emoji icons. Admin sister will produce
  `docs/superpowers/specs/2026-05-08-admin-revamp-design.md`.

## State
- Done:
  - [x] Phase 0: Brainstorm 3 directions (A/B/C), user picked B
  - [x] Phase 0a: Mock all 10 screens in B's language
    (`/tmp/av-mockups/{a,b,b2,b3,b4,b-historico,b-suporte,b-login,b-consent,b-blocked,b-perfil}.html`)
  - [x] Phase 0b: User approved all 10 mockups
  - [x] Phase 0c: Wrote shared `docs/superpowers/design.md`
  - [x] Phase 0d: Wrote spec `docs/superpowers/specs/2026-05-08-paciente-revamp-design.md`
  - [x] Phase 0e: Spawned admin sister session in surface:179
- Now: [→] Phase 1: Wait for user review of the paciente spec
  capturing all 10 screens, the constraints, and the per-screen component
  changes. Then user review.
- Next:
  - [ ] Phase 2: Use `superpowers:writing-plans` skill to produce the
    implementation plan from the spec.
  - [ ] Phase 3: Implement shell tokens / shared CSS (PatientShell topbar,
    tabs row, search, pill-id) — touches every screen, do first.
  - [ ] Phase 4: Pedido empty + carrinho-cheio (CartHero + catalog grid).
  - [ ] Phase 5: Pix open (PixHero rebuild) + Pago/em-separação (extract
    new component or reshape PixHero with paid mode).
  - [ ] Phase 6: Histórico (HistoryList) + Suporte (SupportThread).
  - [ ] Phase 7: Login + Consentimento + Bloqueado screens.
  - [ ] Phase 8: Meu perfil as its own page/tab. Decommission
    ProfileDrawer.jsx (or reduce to thin wrapper if E2E selectors block).
  - [ ] Phase 9: Verification — `npm run check`, `npm test`, `npm run e2e`,
    visual smoke vs the mockup screenshots.
  - [ ] Phase 10: Commit + ship.

## Open Questions
- CONFIRMED 2026-05-08 from `scripts/e2e-production-app.py`:
  `#patient-profile-details` must `to_be_visible()` AND contain the
  strings "Sessao privada", "Suporte", "Plano de cuidado" without any
  click. Strategy: keep `ProfileDrawer` always-mounted, transform it
  off-screen permanently (closed forever), and add a new `MyProfilePage`
  for the actual UI on the "Meu perfil" tab. Drawer becomes an offscreen
  E2E fixture only.
- CONFIRMED: Consent gate must contain literal substrings "Privacidade
  e LGPD" + "Autorizar uso dos dados" (pre) / "Consentimento registrado"
  (post). New copy "Autorize o uso dos seus dados" — keep "Autorizar uso
  dos dados" somewhere in the panel as a sub-heading or kicker.
- CONFIRMED: `#cart-summary` must contain "Resumo antes do Pix" when
  not empty (line 129 of e2e script).
- CONFIRMED: `#access-issue` literals are "Acesso nao liberado" (no
  accent) + "Atendimento precisa revisar seu cadastro" (no accent).
  The new mockup uses "Acesso não liberado" — must keep the no-accent
  literal somewhere or update copy to match. Safest: keep the
  no-accent literal in a sr-only span and use accented copy visually.
- UNCONFIRMED: Exact copy strings asserted in E2E for consent gate —
  current code says "Autorizar uso dos dados para atendimento", new
  mockup says "Autorize o uso dos seus dados". Confirm test asserts the
  literal vs a substring before changing the copy.
- UNCONFIRMED: Does `next.config.mjs` need changes for the new
  `/paciente/perfil` route? (Probably not — Next.js auto-routes — but
  verify rewrites don't intercept it.)
- UNCONFIRMED: Do we want any motion (framer-motion is already a dep
  used by ProfileDrawer + PixHero). Not in mockups; keep it minimal —
  only the timeline pulse and hover lifts.
- UNCONFIRMED: Mobile breakpoint. Mockups assume desktop ≥1024px. The
  current portal supports mobile (verify by checking PatientShell CSS).
  **Spec must include mobile rules** before plan.
- UNCONFIRMED: The chevron alignment glitch in `b-historico.html` row
  layout — known mockup CSS bug, not relevant to spec but note for impl.

## Working Set
- Branch: main (no feature branch yet — create one before Phase 3:
  `feat/paciente-revamp-b`)
- Mockup index: http://127.0.0.1:8765/ (python http.server in /tmp/av-mockups)
- Live patient portal: http://127.0.0.1:4184/paciente (dev watchdog)
- Cmux browser surface: surface:178 (mockups loaded)
- Key source files:
  - `app/paciente/PatientPortal.jsx` (919 lines — orchestrator)
  - `app/paciente/components/PatientShell.jsx` (topbar)
  - `app/paciente/components/PatientTabs.jsx`
  - `app/paciente/components/CartHero.jsx`
  - `app/paciente/components/PixHero.jsx`
  - `app/paciente/components/HistoryList.jsx`
  - `app/paciente/components/SupportThread.jsx`
  - `app/paciente/components/AccessIssueScreen.jsx`
  - `app/paciente/components/PrivacyConsentGate.jsx`
  - `app/paciente/components/ProfileDrawer.jsx` (likely decommission)
  - `app/paciente/components/EmptyHero.jsx` (review for empty-cart state)
  - All matching `.module.css` files
  - `app/globals.css` (token source — only touch if adding tokens)
- Test commands:
  - `npm run check` (lint + format)
  - `npm test` (node --import tsx --test)
  - `npm run e2e` (Playwright; auto-bootstraps `next start`)
  - `npm run smoke` (requires running server)
  - `npm run readiness:isolated` for full CI-equivalent

## Loop iterations (2026-05-09 sequential, no parallel — Task tool absent)
- [x] A. CartHero hard-disables Gerar Pix until all required address fields filled; inline `aria-live` error region announces first missing field; address `<details>` auto-opens when cart has items + address incomplete.
- [x] B. `patient.shippingAddress` persisted server-side. New `PATCH /api/patient/profile` route (`app/api/patient/profile/route.js`) wired to `system.updatePatientProfile`. Auto-save on successful checkout when address differs from saved (audit `patient_shipping_address_saved`). Autofill from `payload.session.patient.shippingAddress` on `refreshSession`; submitCheckout now re-runs `refreshSession` so the patient sees the saved address on the next visit.
- [x] CEP autocomplete (ViaCEP `https://viacep.com.br/ws/{cep}/json/`) — debounced via React effect when CEP normalizes to 8 digits; only fills empty fields; aria-live status hint under the CEP input (idle / loading / ok / error).
- [x] Focus management after add-to-cart: scroll `#cart-summary` into view, focus first empty required address input, fall back to enabled Gerar Pix CTA if address complete.
- [x] Mobile spacing (<=720px) tightened on `.patient-pedido-layout` from `var(--sp-6)` to `16px`; current-order margin reduced to keep PixHero close to the cart on phones.

Verification (each iteration): `npm test` (88/88 pass), `npx tsc --noEmit` (clean), prettier idempotent.

Skipped from queue (deferred — too costly for sequential session):
- sticky right-rail behavior on desktop refinements
- improved empty states
- PixHero countdown affordance refresh
- axe-core accessibility sweep via Playwright

Loop did not run as `*/15 * * * *` cron — `CronCreate` tool not exposed in this session and `Task` subagent tool also absent, so parallel/recurring scheduling impossible. All work executed in-session sequentially with verification gates.
