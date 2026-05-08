# Production Delivery Plan

This is the task map for building Associacao Verde/Apoiar as a production
website and operations system. The goal is the full private application: patient access, team operations, Pix payments, inventory, fulfillment,
compliance, deployment, and QA.

The archived browser-only files are historical/data-import context only; the
work is the complete authenticated production application.

## Goal

Build a production private association system that patients and the team can
actually use:

- Authorized patients can access a private purchase surface only when eligible.
- The association team can manage patients, prescriptions, products, stock,
  orders, payments, and fulfillment.
- Pix payment is integrated through an accepted Brazilian provider.
- Stock is reserved during checkout and permanently decremented only after
  provider-confirmed payment.
- The UI is polished, responsive, Portuguese-first, and appropriate for a
  patient-facing cannabis association workflow.
- The architecture is deployable, secure, observable, backed up, and tested.

The current implementation is a partial production application under active
development. It must keep moving toward the complete production system defined
here until every gate is backed by real evidence.

## Non-Negotiable Completion Gates

- **Product gate:** patient and team flows are usable end to end without hidden
  demo assumptions.
- **UX/UI gate:** the first screen is the production application experience; mobile
  and desktop layouts are reviewed with screenshots.
- **Security gate:** auth, authorization, sessions, CSRF/same-origin mutation
  protection, webhook verification, rate limiting, and audit logs are validated.
- **Payment gate:** provider account is approved for the association use case,
  Pix creation works against the production provider, webhooks are verified against
  the provider contract, and reconciliation is possible.
- **Inventory gate:** reservations, expiry, payment confirmation, stock
  decrement, cancellation, and concurrent checkout behavior are tested.
- **Operations gate:** fulfillment, shipment status, patient support, order
  exceptions, and manual corrections have clear team workflows.
- **Compliance gate:** prescription document handling, consent, privacy,
  retention, and LGPD posture are documented and implemented.
- **Deployment gate:** production environment, domain/TLS, secrets, persistent
  database, backups, logs, health checks, and rollback are tested.
- **QA gate:** automated tests, browser E2E checks, responsive screenshots, and
  production smoke run successfully.

## Current State

Status: **Application UX shipped under the locked B · Calm Clinical Modern
aesthetic. Release blocked only on operations evidence (provider approval,
prod TLS, deploy target, offsite backup).**

The redesign initiative (Phases 0–12) closed on 2026-05-08. Every patient
and team surface is rebuilt against the locked aesthetic; see
`docs/redesign/locked-aesthetic.md` for the visual contract and
`docs/redesign/tokens.md` for the canonical tokens. Mobile parity at 390px
and 320px is verified by the widened E2E overflow check across all
redesigned routes.

Implemented production work:

- Node server with SQLite persistence; schema versioned through migration
  v15 with append-only `SCHEMA_MIGRATIONS` ledger in `src/sqlite-store.ts`.
- Pure Next.js process: every endpoint is a Route Handler under `app/api/`,
  with `middleware.ts` owning origin/CSRF + protected-page enforcement and
  `next.config.mjs::headers()` returning security headers on every
  response. The legacy `server.mjs` wrapper was deleted at the Stage 3
  cutover (`0f033d9`).
- Team login with hashed password storage; team self-service password
  rotation; admin temporary-password reset with old-session revocation.
- Patient invite/member-code login and eligibility checks; patient consent
  recorded with audit envelope; access-recovery flow for blocked patients.
- Product, patient, prescription document, member card, stock, cultivation,
  order, Pix, webhook, support thread (schema v15), and shipment primitives.
- Inventory invariant: `availableStock = onHandStock − activeReservations`
  enforced under `BEGIN IMMEDIATE` with re-read inside the synchronous
  critical section. 5-patient race test on the last unit
  (`test/inventory-race.test.mjs`) and oversell guard in smoke.
- `paid_after_expiry_conflict` audit event + `fulfillment_exception` order
  state for the late paid-after-expiry edge.
- Pix provider abstraction with local development mode and Asaas adapter.
- Signed webhook gate; production refuses to boot with `dev-pix`.
- Production boot gates for secrets and Pix provider.
- 58/58 unit tests across inventory, race, fulfillment status, inventory
  lots, support thread, audit timeline grouping, team activity Route
  Handler, RBAC, audit envelope, and the rest of the production surface.
- Dockerfile, runbook, release gate, and archived-data importer.

Known gaps before production (operations only — application UX is shipped):

- Payment provider compliance and live credentials are not confirmed
  (`PAY-001` blocked on business decision).
- Webhook validation must match the final provider's exact signature
  contract (`PAY-003`).
- Document storage is metadata-only; durable secure storage with integrity
  verification still required for production rollout.
- Production deploy target, real TLS/domain evidence, and real offsite
  backup schedule evidence are pending (`DEP-001`, `DEP-002`).
- Backups, monitoring, alerting, and deploy target are not live.
- Public landing redesign (`UX-009`, deferred from Phase 11) was
  intentionally deferred per operator direction; the existing public home
  remains in place and contains no internal status leaks.

## Task Board

### P0 - Product Definition And UX

**UX-001: Define production information architecture**

- Status: complete
- Acceptance: sitemap covers patient login, purchase, Pix payment, order status,
  support, team dashboard, patient management, prescription management,
  inventory, cultivation, fulfillment, and audit views.
- Evidence: IA document `docs/production-ux-ia.md`; mock contract at
  `.superpowers/brainstorm/70960-1778242539/content/all-pages.html` (20
  approved screens) implemented surface-by-surface across redesign Phases
  1–10.

**UX-002: Redesign patient purchase flow**

- Status: complete (Phase 1; commits 00d5fed · 8e3858c · ac0d7d1 · a910bf6 ·
  3fac042 · 83ee92c · 6e1c48f · screenshots commit 96dd3dc)
- Acceptance: patient can sign in, understand eligibility state, browse eligible
  products, build cart, start Pix payment, copy Pix code, and track status on
  mobile without layout issues.
- Evidence: mode-based PatientPortal (Pedido/Histórico/Suporte tabs);
  full-screen Pix takeover with live countdown, real qrcode.react QR encoder,
  copia-e-cola, frete block, and 5-stage timeline; CatalogDrawer + ProfileDrawer
  with `prefers-reduced-motion` honored; LGPD consent gate + access-recovery
  screen; mobile parity verified at 390px and 320px. Screenshots
  `artifacts/visual-e2e/redesign/p1-patient-*-{desktop,mobile}.png` via
  `scripts/p1-screenshots.py`.

**UX-003: Redesign team operations dashboard**

- Status: complete (Phase 3; commits cac7030 · ea487ce · 68997c8 · f4c29e0 ·
  screenshots 22e4edf)
- Acceptance: team can scan daily orders, paid orders, low stock, pending
  prescriptions, patient access problems, and fulfillment backlog from one clear
  workspace.
- Evidence: TeamShell sidebar app shell mounted across `/equipe/*`; rebuilt
  TeamCommand with 4 KPI cards + sparklines, live activity feed polling
  `/api/team/activity?since=` (Route Handler, frozen-server bridge), Pix-by-hour
  bar chart, and priority queue. Tests 41 → 44 (+3 for activity Route Handler).
  Screenshots `artifacts/visual-e2e/redesign/p3-team-command-{desktop,mobile}.png`.

**UX-004: Portuguese copy and association tone pass**

- Status: in progress
- Acceptance: all user-facing text is Portuguese-first, patient-safe, legal in
  framing, and avoids public ecommerce language.
- Evidence: redesigned surfaces ship Portuguese-first copy and avoid public
  ecommerce framing. Public landing redesign (`UX-009`) was deferred per
  operator direction; existing public home remains free of internal status
  leaks. Final copy inventory pass remains open.

**UX-005: Apoiar Brasil visual system alignment**

- Status: complete (Phase 0 + locked-aesthetic spec)
- Acceptance: private app follows the locked B · Calm Clinical Modern
  aesthetic: off-white paper, soft greens, refined gold ornament only on
  product thumbs and CTAs, system sans, generous whitespace, hairline
  borders, status communicated by colored dots, soft shadows.
- Evidence: tokens centralized in `app/globals.css :root`; canonical
  reference at `docs/redesign/tokens.md`; visual contract at
  `docs/redesign/locked-aesthetic.md`; mock screens at
  `.superpowers/brainstorm/70960-1778242539/content/all-pages.html`.

**UX-006: Professional login and access system**

- Status: complete (Phase 1 patient + Phase 3 team)
- Acceptance: patient and team login are professional entry surfaces with clear
  role separation, security copy, lockout/error feedback, session state, logout,
  mobile layout, and hidden rough forms after successful login.
- Evidence: PatientShell + TeamShell ship branded entry surfaces; smoke +
  E2E selectors `#patient-login`, `#team-login`, `#patient-status`,
  `#team-status` preserved; access-recovery `#access-issue` screen for
  blocked patients; mobile parity at 320/390.

**UX-007: Patient portal production UX**

- Status: complete (Phase 1)
- Acceptance: patient sees eligibility, prescription/card validity, private
  catalog, cart/reservation, Pix copy/paste, order status, shipment, and support
  direction as one coherent mobile-first workflow.
- Evidence: see UX-002. Per-component split (EmptyHero, CartHero,
  HistoryList, SupportThread, PrivacyConsentGate, AccessIssueScreen) keeps
  PatientPortal a thin glue. Privacy consent recorded + audited; team
  invite-code reset without exposing existing invites.

**UX-008: Team command center production UX**

- Status: complete (Phase 3)
- Acceptance: team sees daily queues and exceptions first: pending Pix, paid
  orders needing fulfillment, low stock, expiring prescriptions/cards, blocked
  patients, shipments needing tracking, and audit/payment-provider readiness.
- Evidence: see UX-003. TeamCommand 4-KPI grid + activity feed + priority
  queue. ⌘K command palette (Phase 8) globally accessible via TeamShell.

**UX-009: Public landing redesign**

- Status: deferred (operator direction; not in redesign scope)
- Acceptance: public home reflects Calm Clinical Modern aesthetic with two
  doors (Paciente / Equipe), 3-step "Como acessar" list, atendimento card,
  and value-prop strip; no internal status leaks.
- Evidence: existing public landing remains in place; current implementation
  contains no internal status leaks (no provider, drill, deploy, webhook
  copy). Phase 11 from the redesign roadmap was deferred and is tracked
  here for future scheduling.

### P0 - Security And Access Control

**SEC-001: Role-based team permissions**

- Status: complete
- Acceptance: admin, operations, stock, fulfillment, and support roles have
  explicit permission checks on every team mutation.
- Evidence: `ROLE_PERMISSIONS` in `src/production-system.mjs`, operation-specific
  `requireTeam(..., permission)` checks, admin routes `POST /api/team/users`,
  `POST /api/team/users/status`, and `POST /api/team/users/password`, admin UI
  create/deactivate/reactivate/password-reset controls, smoke coverage for
  restricted user creation, deactivation/session revocation, and password reset,
  team self-service password rotation through `POST /api/team/me/password`,
  plus tests `team roles enforce operation-specific permissions`, `admin can
deactivate team user and revoke active sessions`, and `admin can reset team
user password and revoke old sessions`, and `team user can change own
password and revoke other sessions`.

**SEC-002: Harden sessions and mutations**

- Status: complete
- Acceptance: secure cookies in production, session rotation on login,
  same-origin/CSRF protection, logout, idle expiry, and brute-force throttling.
- Evidence: production cookies use `HttpOnly`, `SameSite=Lax`, and `Secure`;
  every login issues a new server session id; logout clears the session; expired
  sessions are rejected; same-origin mutation guard is in `middleware.ts`; login
  throttling locks repeated failures per IP plus identifier; smoke verifies
  repeated bad team login returns `429`. `npm run readiness:session-security`
  records non-secret cookie evidence and the release gate blocks production
  until HTTPS evidence proves `Secure` in addition to the signed `HttpOnly`
  `SameSite=Lax` cookie.

**SEC-003: Complete audit logging**

- Status: complete
- Acceptance: patient access changes, prescription changes, inventory changes,
  order state changes, payment events, shipment changes, and admin actions are
  audit logged with actor and timestamp.
- Evidence: `ProductionSystem.audit()` records actor/timestamp/details; admin
  surface renders recent audit events; test `critical production actions are
audit logged and visible on dashboard` covers admin user creation, stock,
  patient access, prescription registration/access, checkout, payment
  confirmation, fulfillment, and shipment.

**SEC-004: Secure document storage**

- Status: complete
- Acceptance: prescription files are stored outside the public web root with
  access-controlled retrieval, checksums, retention policy, and no sensitive
  file contents in application logs.
- Evidence: server writes uploaded prescription files to `DOCUMENT_STORAGE_DIR`
  outside `public/`, stores metadata/hash only in SQLite, verifies sha256 on
  download, requires `prescriptions:write` for retrieval, audits
  `prescription_document_accessed`, hides private file paths from dashboard
  documents, and smoke verifies upload/download.

### P0 - Payment

**PAY-001: Confirm provider acceptance**

- Status: blocked
- Blocker: business must confirm Asaas, Mercado Pago, Pagar.me, or another
  Brazilian provider accepts this association/payment use case.
- Acceptance: written provider decision with account status, terms constraints,
  fees, settlement timing, webhook docs, and production credentials path.
- Evidence: provider approval reference recorded through `/admin` readiness or
  `npm run readiness:provider-evidence`; approval stays blocked unless account
  status, acceptance reference, terms, webhook docs, and settlement/fees notes
  are all present.

**PAY-001A: Surface payment readiness inside admin**

- Status: in progress
- Acceptance: admin can see whether the running environment is using the final
  Pix provider, whether secrets/storage/session/webhook prerequisites are
  configured, and which launch gates still need business or operations action.
- Evidence: `GET /api/team/readiness` returns non-secret environment gates and
  `/admin` renders them as readiness cards. Smoke step `admin readiness reports
environment gates` covers the endpoint; `npm run e2e` asserts the admin route
  renders Pix provider, signed webhook drill, and backup/restore readiness.
  `npm run readiness:provider-evidence` records formal provider approval only
  when account, terms, webhook docs, settlement/fees notes, and evidence
  references are present. `/admin` can record the same non-secret provider and
  offsite-backup evidence through admin-only readiness forms.
  `npm run readiness:deployment-check` records release URL health, protected
  route, catalog denial, security-header, and log-reference evidence.
  `npm run readiness:domain-tls` records public hostname and trusted
  certificate evidence and rejects local/plain HTTP URLs.
  `npm run verify:isolated` runs readiness drills, smoke, and browser E2E
  against a temporary SQLite/document store so repeated checks do not mutate the
  shared dev URL. Remaining work: real provider approval and production
  deploy/domain/log artifacts.

**PAY-002: Implement final Pix provider contract**

- Status: in progress
- Acceptance: Pix charge creation, QR code, copia-e-cola, expiry, status lookup,
  idempotency key, and provider errors are handled for the chosen provider.
- Evidence: provider-contract tests with controlled stubs plus sandbox/live-provider smoke when allowed.

**PAY-003: Verify webhook authenticity**

- Status: in progress
- Acceptance: webhook validation uses the final provider's actual signature or
  authentication scheme, rejects replay/invalid events, and handles duplicate
  events idempotently.
- Evidence: `npm run readiness:webhook-drill` proves the current signed Pix
  webhook gate rejects unsigned requests, accepts the configured secret, moves
  the order into fulfillment, and decrements stock only after confirmation.
  `/api/team/readiness` and `/admin` render that non-secret evidence. Remaining
  work: match the final provider's exact signature/replay contract.

**PAY-004: Payment reconciliation and exception handling**

- Status: complete
- Acceptance: team can see pending, paid, expired, failed, refunded, and
  mismatched payments; system can reconcile by provider payment id.
- Evidence: `ProductionSystem.reconcilePayment()` checks provider status, confirms
  paid Pix through the same idempotent stock path, expires provider-overdue
  reservations without physical stock decrement, and records exception states
  when provider/local state conflicts. `/api/team/payments/reconcile` and
  `/equipe/pedidos` expose the operation. Tests cover paid, overdue, and late
  paid-after-expiry reconciliation; smoke verifies the pending provider path.

### P0 - Inventory, Orders, And Fulfillment

**INV-001: Transactional stock reservation**

- Status: complete (Phase 2; commits b617b3c · 5df46ed · 4bc2441 · 971a22d ·
  9fca88d)
- Acceptance: concurrent checkout cannot oversell stock; reservation and order
  creation are atomic.
- Evidence: `runInventoryTransaction` uses `BEGIN IMMEDIATE` with a
  re-read of `availableStock` inside the synchronous critical section
  (better-sqlite3 sync semantics + Node single-threaded JS); the await on
  `paymentProvider.createPayment` happens after the reservation is in
  `state.stockReservations`, so any concurrent availability read sees it.
  5-patient race test on the last unit at `test/inventory-race.test.mjs`
  verifies "exactly one wins" via `Promise.allSettled`. Smoke includes
  oversell guard. `paid_after_expiry_conflict` audit + `fulfillment_exception`
  cover the late paid-after-expiry edge.

**INV-002: Reservation expiry worker**

- Status: complete
- Acceptance: unpaid expired Pix orders release stock reservations safely and
  leave a visible order/payment state for support.
- Evidence: `src/system-instance.ts` runs `system.expireReservations()` on a 60-second interval;
  `expireReservations()` marks reservation, order, and payment expired and
  writes `reservation_expired`; test `expired reservation releases stock and
expires order plus payment` covers release behavior.

**INV-003: Lot-level stock decrement**

- Status: partial (Phase 6 traceability shipped; allocation strategy still
  open)
- Acceptance: paid orders decrement specific inventory lots using a clear
  allocation strategy and keep batch/lot traceability.
- Evidence: Phase 6 (`f422f5c`) ships single product ledger with click-to-
  expand lot rows (id · quantidade · validade · origem). `listProductLots`
  derives lots from `state.inventoryLots` (cultivation pipeline) plus
  synthetic per-stockMovement entries; validity defaults to 12 months from
  `createdAt`; origin is humanized. `inventory-lots` test covers the
  contract. Remaining: explicit lot expiry + supplier metadata as
  first-class fields, and an allocation strategy on payment confirmation
  (FIFO by validity is the natural default).

**FUL-001: Fulfillment workflow**

- Status: shipped UX (Phase 5 kanban); carrier/refund integration still
  partial
- Acceptance: team can pick, pack, mark ready, ship, add carrier/tracking, and
  handle cancellation/refund exceptions.
- Evidence: Phase 5 four-column drag-and-drop kanban
  (`@dnd-kit/core` + `/api/team/orders/status` Route Handler) with
  optimistic UI, revert-on-error, and `team_order_status_changed` audit
  envelope. 5 new tests in `test/fulfillment-status.test.mjs` cover RBAC,
  status validation, lifecycle guard, audit envelope, and idempotent
  same-column drops. Mobile drops to single-column-with-tabs (Phase 12).
  Existing endpoints (`/api/team/fulfillment`, `/api/team/shipments`,
  `/api/team/orders/cancel`, `/api/team/orders/exception`) preserved.
  Remaining: real carrier/refund provider integration and formal SOP for
  refund approval.

### P0 - Architecture And Data

**ARCH-001: Split server into production modules**

- Status: open
- Acceptance: routes, auth, payment, inventory, orders, patients, documents,
  and persistence are separated with clear module boundaries.
- Evidence: code structure review and tests still passing.

**ARCH-002: Add schema migrations**

- Status: complete (Phase 7; commit ea62d88)
- Acceptance: database changes are versioned and replayable across environments;
  startup does not rely only on ad hoc table creation.
- Evidence: `SCHEMA_MIGRATIONS = [{1, initial_json_state_schema},
{15, support_messages_thread}]` in `src/sqlite-store.ts`; `recordMigration`
  loops the array so future phases append entries (never edit prior).
  Sqlite-store reload test asserts both v1 and v15 migration rows.
  `npm run readiness:schema-check` records `user_version`, migration
  ledger, and required-table evidence for `/admin` and the release gate.

**ARCH-003: Strengthen data constraints**

- Status: open
- Acceptance: DB-level constraints and indexes protect ids, unique member codes,
  order references, payment ids, and stock movement integrity.
- Evidence: persistence tests and failed-insert tests.

**ARCH-004: Backup and restore path**

- Status: open
- Acceptance: production DB backup, restore drill, and retention schedule are
  documented and tested.
- Evidence: restore test output in runbook.

### P1 - Team Operations

**OPS-001: Patient onboarding and access lifecycle**

- Status: in progress
- Acceptance: team can create, activate, suspend, renew card, update
  prescription validity, and view why a patient is blocked.
- Evidence: team UI E2E tests.

**OPS-002: Product and price management**

- Status: complete for local product metadata
- Acceptance: team can create, edit, deactivate, price, categorize, and annotate
  products without code changes.
- Evidence: `createProduct()` and `updateProduct()` persist category,
  low-stock threshold, controlled flag, and internal note; `/equipe/estoque`
  renders those fields in create/update forms and product rows; patient catalog
  uses the persisted category before name heuristics. Tests cover category,
  threshold, controlled flag, and notes; smoke asserts metadata through the HTTP
  dashboard; screenshot:
  `artifacts/visual-e2e/team-stock-product-metadata-desktop.png`.

**OPS-003: Support workflow**

- Status: complete (Phase 7; commits ea62d88 · a5c61ef · ec72c6c · 8d3e3ef ·
  eebd42d)
- Acceptance: team can inspect a patient's latest login, eligibility, cart,
  order, payment, and shipment status without direct DB access.
- Evidence: Two-pane workbench under `/equipe/suporte`. Left = QueueColumn
  (priority pill, name, member code, latest summary). Right = CasePanel
  (Ultimo login, Pedido, Pix, Reserva, Envio, Documentos, Historico,
  Solicitacoes; Em atendimento / Resolver actions; chronological Thread
  with patient-LEFT / team-RIGHT bubbles). ReplyBox posts to
  `/api/team/support-replies` (Route Handler bridge) backed by schema v15
  `support_messages` table. Tests +2 in `test/support-thread.test.mjs`
  (RBAC + audit + empty-body rejection; chronological order with seed +
  replies). Screenshots
  `artifacts/visual-e2e/redesign/p7-support-{desktop,mobile}.png`.

### P1 - Compliance And Privacy

**CMP-001: LGPD/privacy implementation**

- Status: open
- Acceptance: privacy policy, consent records, data export/deletion process,
  data minimization, and retention rules are documented and implemented where
  applicable.
- Evidence: patient consent records persist with timestamp/version, audit
  `privacy_consent_accepted`, patient UI and team patient UI render consent
  state, and tests/E2E/smoke cover the consent path. Remaining work: data
  export/deletion process, retention rules, and formal policy text.

**CMP-002: Medical document access policy**

- Status: open
- Acceptance: prescription access is restricted by role, logged, and never
  exposed in patient catalog or public routes.
- Evidence: access-denial tests and audit entries.

### P1 - Deployment And Operations

**DEP-001: Choose production host and topology**

- Status: blocked
- Blocker: deploy target is not confirmed.
- Acceptance: chosen host supports persistent storage/backups or managed DB,
  TLS/domain, secret management, logs, health checks, and rollback.
- Evidence: deployment decision record. Runtime release checks are wired through
  `npm run readiness:deployment-check`, but a production host/domain decision is
  still required.

**DEP-002: Production environment setup**

- Status: in progress
- Acceptance: production secrets, database, domain/TLS, health check, logs, and
  backup schedule are configured.
- Evidence: `/api/team/readiness` and `/admin` now surface non-secret runtime
  gates for provider, database path, private storage, session signing, webhook
  proof, provider acceptance, and backup/restore. `npm run readiness:backup-drill`
  creates a consistent SQLite backup, validates restore loading through the app
  store, and exposes checksum/count evidence in admin readiness.
  `npm run readiness:webhook-drill` exposes signed Pix webhook proof. Production
  `npm run readiness:deployment-check` now exposes health, protected route,
  sessionless catalog denial, security-header, and log-reference proof for a
  release URL. `npm run readiness:domain-tls` records public hostname, trusted
  certificate, issuer, expiry, fingerprint, and `/health` proof for a production
  HTTPS URL. `npm run readiness:backup-schedule` records offsite target,
  frequency, retention, encryption reference, last successful backup, operator,
  last backup reference, and restore-drill checksum evidence.
  `npm run readiness:session-security` records session-cookie attributes and
  keeps production blocked until HTTPS `Secure` cookie proof exists.
  `npm run verify:isolated` keeps release
  verification off the shared local database. Production deploy target,
  real TLS/domain evidence, and real offsite backup schedule evidence are still pending.

**DEP-003: Production smoke and rollback**

- Status: open
- Acceptance: post-deploy smoke covers auth, patient catalog denial, team login,
  Pix creation, webhook negative path, order status, and rollback procedure.
- Evidence: captured smoke output and rollback drill notes.

### P1 - QA And Release

**QA-001: Browser E2E suite**

- Status: in progress
- Acceptance: Playwright covers patient happy path, patient blocked path, team
  dashboard, stock, prescription, payment, and fulfillment flows.
- Evidence: `scripts/e2e-production-app.py` is checked in and exposed as
  `npm run e2e`. It starts an isolated temporary server/database when
  `E2E_BASE_URL` is not provided, covers patient Pix happy path, blocked patient
  denial, team worklist filters, Pix confirmation moving into fulfillment, and
  support login/reservation signals, prescription document upload through the UI,
  and mobile/desktop overflow assertions. Latest run passed and generated
  `artifacts/visual-e2e/e2e-patient-pix-mobile.png`,
  `artifacts/visual-e2e/e2e-patient-blocked-mobile.png`, and
  `artifacts/visual-e2e/e2e-document-upload-desktop.png`, and
  `artifacts/visual-e2e/e2e-team-workspaces-desktop.png`.
  `.github/workflows/production-ci.yml` installs Python Playwright/Chromium and
  runs `npm run check`, `npm test`, `npm run smoke`, and `npm run e2e`.
  Remaining work: confirming the workflow in the remote CI environment.

**QA-002: Responsive route checks**

- Status: complete (Phase 12; commits c89a780 · a69d5b2 · bfe879c · 6c320fa ·
  8f759dc)
- Acceptance: key screens pass mobile/desktop screenshots, keyboard navigation,
  visible focus, labels, contrast, and no horizontal overflow.
- Evidence: `responsive_overflow_check` in `scripts/e2e-production-app.py`
  widened `mobile_routes` from `["/paciente"]` to all redesigned routes
  (`/`, `/paciente`, `/equipe`, `/equipe/pacientes`, `/equipe/estoque`,
  `/equipe/pedidos`, `/equipe/fulfillment`, `/equipe/suporte`, `/admin`)
  at 390x844 mobile + 1440x950 desktop. Real overflow caught by widened
  E2E (Phase 10 sidebar badges pushed `/equipe` to scrollWidth=546 at
  390px); fixed by switching TeamShell sidebar from `flex-wrap` to a
  horizontally scrollable strip with `flex: 0 0 auto` chips. Phase 12
  contact sheet at
  `artifacts/visual-e2e/redesign/p12-mobile-overview-grid.png` composed
  from 18 individual 390/320 screenshots via `scripts/p12-screenshots.py`.

**QA-003: Release checklist**

- Status: in progress
- Acceptance: every P0 task is closed with evidence, P1 launch-critical tasks
  are closed or explicitly waived, and no archived/reference route is presented
  as production.
- Evidence: `npm run readiness:release-gate` now fails until provider approval,
  production HTTPS deployment/log evidence, domain/TLS, signed webhook proof,
  database schema, production session-cookie security, backup restore proof, and
  configured offsite backup proof are all present.
  Current local evidence intentionally fails for provider approval,
  production deploy/logs, domain/TLS, production session-cookie security, and
  offsite backup schedule.

## Redesign Initiative Status (Phases 0–12, closed 2026-05-08)

The Calm Clinical Modern redesign shipped end-to-end across the patient and
team experiences. Phase 13 (this docs close-out) marks the initiative
complete. Remaining work is operations-only:

- `PAY-001` provider approval (business)
- `PAY-003` final provider signature contract (engineering on provider
  decision)
- `DEP-001` host/topology decision
- `DEP-002` real TLS/domain + offsite backup schedule + production
  session-cookie `Secure` cookie evidence
- `DEP-003` post-deploy smoke + rollback drill
- `OPS-001` patient onboarding lifecycle polish
- `CMP-001` LGPD data export/deletion + retention policy text
- `INV-003` lot allocation strategy on payment confirmation (FIFO by
  validity is the natural default; lot expiry + supplier metadata as
  first-class fields)
- `UX-009` public landing redesign (deferred per operator direction)

`npm run readiness:release-gate` is the final mechanical refusal: provider,
deployment, domain/TLS, signed webhook, schema, session-cookie, backup
restore, and offsite backup all gate the release.

## Immediate Next Sprint

1. `PAY-001` business decision on provider — unblocks `PAY-003` and
   production secrets.
2. `DEP-001` and `DEP-002` host/domain/TLS — unblocks
   `readiness:deployment-check`, `readiness:domain-tls`, and
   production-`Secure` `readiness:session-security`.
3. `DEP-002` offsite backup schedule with real evidence.
4. `INV-003` lot allocation strategy on payment confirmation.
5. `CMP-001` LGPD policy text and data export/deletion process.

## Definition Of Done

The work is not done until all of this evidence exists:

- Production URL with TLS and private patient access.
- Production provider Pix flow approved and verified.
- Provider-authenticated webhook confirmation.
- No public unauthenticated product catalog.
- Server-side eligibility enforcement.
- Transaction-safe reservation, expiry, and payment-confirmed stock decrement.
- Team can manage daily operations without database access.
- Secure prescription/document handling.
- Backup and restore proof.
- Passing unit, integration, E2E, smoke, and responsive route checks.
- Release checklist showing every P0 item closed with evidence.
