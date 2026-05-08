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

Status: **Partial production application, not complete.**

Implemented production work so far:

- Node server with SQLite persistence.
- Next.js private route surfaces for patient and team operations, served by the
  same Node process as the authenticated API.
- Team login with hashed password storage.
- Patient invite/member-code login and eligibility checks.
- Product, patient, prescription document, member card, stock, cultivation,
  order, Pix, webhook, and shipment primitives.
- Pix provider abstraction with local development mode and Asaas adapter.
- Production boot gates for secrets and Pix provider.
- Tests and smoke coverage for core payment, stock, and fulfillment paths.
- Dockerfile, runbook, release gate, and archived-data importer.

Known gaps before production:

- UI/UX is operational and being rebuilt route by route against the Apoiar
  reference direction.
- The server is still compact and needs production-grade route/service
  organization, migrations, and stronger transaction boundaries.
- Payment provider compliance and live credentials are not confirmed.
- Webhook validation must match the final provider's exact signature contract.
- Reservation expiry/reconciliation worker is not production complete.
- Admin/team lifecycle is partially implemented: roles, user creation,
  deactivation, session revocation, and admin temporary-password reset exist;
  team users can rotate their own password; onboarding still needs production
  polish.
- Document storage is metadata-only; secure storage is still required.
- Backups, monitoring, alerting, and deploy target are not live.

## Task Board

### P0 - Product Definition And UX

**UX-001: Define production information architecture**

- Status: in progress
- Acceptance: sitemap covers patient login, purchase, Pix payment, order status,
  support, team dashboard, patient management, prescription management,
  inventory, cultivation, fulfillment, and audit views.
- Evidence: checked-in IA document `docs/production-ux-ia.md`; screenshots and
  wireframes still required.

**UX-002: Redesign patient purchase flow**

- Status: in progress
- Acceptance: patient can sign in, understand eligibility state, browse eligible
  products, build cart, start Pix payment, copy Pix code, and track status on
  mobile without layout issues.
- Evidence: `/paciente` route surface exists and smoke verifies app routes;
  patient status cards, cart summary, Pix copy/paste panel, and order status
  screen are implemented in the Next patient route; browser evidence is captured at
  `artifacts/visual-e2e/patient-cart-pix-mobile.png`; responsive overflow check
  passed for mobile and desktop routes. `npm run e2e` now covers patient
  happy path, blocked-patient denial, profile care-plan visibility, and
  patient-created support request visibility on the team support route.
  Remaining work: patient copy polish and shipment status polish.

**UX-003: Redesign team operations dashboard**

- Status: in progress
- Acceptance: team can scan daily orders, paid orders, low stock, pending
  prescriptions, patient access problems, and fulfillment backlog from one clear
  workspace.
- Evidence: route-level command center, patients, stock/cultivation,
  orders/payments, fulfillment, support, and admin surfaces exist. Each
  operational route now has search/status filters and rendered worklists instead
  of form-only screens. Screenshots exist at `artifacts/visual-e2e/team-command-desktop.png`,
  `artifacts/visual-e2e/team-patients-route-desktop.png`,
  `artifacts/visual-e2e/team-stock-route-desktop.png`,
  `artifacts/visual-e2e/team-orders-route-desktop.png`,
  `artifacts/visual-e2e/team-fulfillment-route-desktop.png`,
  `artifacts/visual-e2e/team-support-route-desktop.png`, and
  `artifacts/visual-e2e/team-admin-route-desktop.png`; `npm run e2e` now covers
  team route filters, Pix confirmation into fulfillment, and responsive route
  layout.

**UX-004: Portuguese copy and association tone pass**

- Status: open
- Acceptance: all user-facing text is Portuguese-first, patient-safe, legal in
  framing, and avoids public ecommerce language.
- Evidence: reviewed copy inventory.

**UX-005: Apoiar Brasil visual system alignment**

- Status: in progress
- Acceptance: private app follows the Apoiar Brasil reference direction:
  deep-green trust framing, white/soft-green content bands, yellow primary
  actions, editorial serif headings, compact cards, acolhimento language, and
  cannabis medicinal safety/legal tone without turning the app into a public
  marketing page.
- Evidence: reference screenshot captured at
  `artifacts/reference/apoiarbrasil-home-desktop.png`; implementation and
  patient/team screenshots still required.

**UX-006: Professional login and access system**

- Status: in progress
- Acceptance: patient and team login are professional entry surfaces with clear
  role separation, security copy, lockout/error feedback, session state, logout,
  mobile layout, and hidden rough forms after successful login.
- Evidence: first branded entry/auth slice implemented in Next route files
  with shared `public/app.css`; browser screenshots written
  to `artifacts/visual-e2e/home-entry-desktop.png`,
  `artifacts/visual-e2e/patient-login-mobile.png`,
  `artifacts/visual-e2e/patient-authenticated-mobile.png`, and
  `artifacts/visual-e2e/team-authenticated-desktop.png`; smoke covers route and
  auth workflow. Remaining work: refine navigation density, error states,
  password reset/onboarding, and production polish.

**UX-007: Patient portal production UX**

- Status: in progress
- Acceptance: patient sees eligibility, prescription/card validity, private
  catalog, cart/reservation, Pix copy/paste, order status, shipment, and support
  direction as one coherent mobile-first workflow.
- Evidence: patient summary cards now show associated patient, eligibility
  reason, prescription/card validity, latest order state, cart summary, Pix
  copy/paste panel, payment expiry, order history, responsible contact, profile
  contact/location, care plan, and support note; mobile screenshots exist
  at `artifacts/visual-e2e/patient-login-mobile.png`,
  `artifacts/visual-e2e/patient-authenticated-mobile.png`, and
  `artifacts/visual-e2e/patient-cart-pix-mobile.png`, plus current profile
  evidence at `artifacts/visual-e2e/patient-profile-management-mobile.png`.
  Support requests are backend-backed and visible to the team support queue.
  Privacy consent is recorded, audited, and visible to the team. Blocked or
  expired patients can request access recovery without receiving catalog access.
  Team users can reset private invite codes without exposing existing invites.
  Remaining work: shipment status polish and copy review.

**UX-008: Team command center production UX**

- Status: in progress
- Acceptance: team sees daily queues and exceptions first: pending Pix, paid
  orders needing fulfillment, low stock, expiring prescriptions/cards, blocked
  patients, shipments needing tracking, and audit/payment-provider readiness.
- Evidence: command center now renders queue cards for pending Pix, fulfillment,
  low stock, blocked patients, expiring validity, and active reservations plus
  an actionable "Fila de acao agora"; desktop screenshot exists at
  `artifacts/visual-e2e/team-command-desktop.png`. Patients, stock, orders,
  fulfillment, support, and admin routes now have search/status filters and
  route-level summaries. Checked-in browser coverage exists in
  `scripts/e2e-production-app.py`. Remaining work: polish provider/admin
  readiness and deepen support context.

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
  sessions are rejected; same-origin mutation guard is in `server.mjs`; login
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

- Status: open
- Acceptance: concurrent checkout cannot oversell stock; reservation and order
  creation are atomic.
- Evidence: concurrency tests against SQLite production store.

**INV-002: Reservation expiry worker**

- Status: complete
- Acceptance: unpaid expired Pix orders release stock reservations safely and
  leave a visible order/payment state for support.
- Evidence: `server.mjs` runs `system.expireReservations()` on an interval;
  `expireReservations()` marks reservation, order, and payment expired and
  writes `reservation_expired`; test `expired reservation releases stock and
expires order plus payment` covers release behavior.

**INV-003: Lot-level stock decrement**

- Status: open
- Acceptance: paid orders decrement specific inventory lots using a clear
  allocation strategy and keep batch/lot traceability.
- Evidence: stock movement tests and team stock ledger UI.

**FUL-001: Fulfillment workflow**

- Status: partial
- Acceptance: team can pick, pack, mark ready, ship, add carrier/tracking, and
  handle cancellation/refund exceptions.
- Evidence: `/api/team/fulfillment`, `/api/team/shipments`,
  `/api/team/orders/cancel`, and `/api/team/orders/exception` cover status
  changes, shipment records, unpaid cancellation with reservation release, and
  paid-order exception/refund-review notes without silent restock. `/equipe`
  fulfillment renders exception/cancel controls. Tests cover unpaid cancellation
  and paid fulfillment exception; smoke verifies both HTTP paths; E2E covers
  route rendering and overflow. Remaining: real carrier/refund provider
  integration and formal SOP for refund approval.

### P0 - Architecture And Data

**ARCH-001: Split server into production modules**

- Status: open
- Acceptance: routes, auth, payment, inventory, orders, patients, documents,
  and persistence are separated with clear module boundaries.
- Evidence: code structure review and tests still passing.

**ARCH-002: Add schema migrations**

- Status: open
- Acceptance: database changes are versioned and replayable across environments;
  startup does not rely only on ad hoc table creation.
- Evidence: migration tests from empty DB and previous DB version.

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

- Status: open
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

- Status: in progress
- Acceptance: team can inspect a patient's latest login, eligibility, cart,
  order, payment, and shipment status without direct DB access.
- Evidence: `/equipe/suporte` route exists with filters and support cards
  combining patient eligibility, prescription/card validity, latest order,
  payment, reservation, shipment, document count, latest login, active session
  expiry, and order history count. Unit test
  `team dashboard exposes patient support login and reservation context` covers
  the dashboard data, and `npm run e2e` asserts the support route renders the
  login/reservation signals. Remaining work: persisted cart visibility and
  deeper support actions. Screenshot:
  `artifacts/visual-e2e/team-support-route-desktop.png`.

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

- Status: in progress
- Acceptance: key screens pass mobile/desktop screenshots, keyboard navigation,
  visible focus, labels, contrast, and no horizontal overflow.
- Evidence: current browser check asserted no horizontal overflow on mobile
  `390x844` and desktop `1440x950` for `/paciente`, `/equipe`,
  `/equipe/pacientes`, `/equipe/estoque`, `/equipe/pedidos`,
  `/equipe/fulfillment`, `/equipe/suporte`, and `/admin`; screenshot artifacts are under
  `artifacts/visual-e2e/`. `npm run e2e` now repeats the overflow assertion.
  Remaining work: route-by-route visual review after each UX rebuild slice.

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

## Immediate Next Sprint

1. Complete UX-001, UX-002, and UX-003 before adding more backend surface area.
2. Complete PAY-001 because provider acceptance can invalidate implementation
   assumptions.
3. Complete ARCH-001 and ARCH-002 before the code grows further.
4. Complete SEC-001 and SEC-002 before any patient data or payment access.
5. Complete QA-001 for the current production app so regressions are visible.

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
