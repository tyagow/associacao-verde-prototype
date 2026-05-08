# Architecture, Production-Readiness, and Security Report

- **Repo:** `/Users/partiu/workspace/kaizen/associacao-verde`
- **Date:** 2026-05-08
- **Scope:** Read-only audit. No code modified.
- **Reviewer:** Claude (Opus 4.7, 1M context)
- **Coverage caveat:** Read in full — `README.md`, `CLAUDE.md`, `docs/production-delivery-plan.md`, `server.mjs` (1228 lines), `src/sqlite-store.ts`, `src/release-gate.ts`, `eslint.config.mjs`, `tsconfig.json`, `next.config.mjs`, `package.json`, `Dockerfile`, `.github/workflows/production-ci.yml`, four `app/api/**` Route Handlers. Read partially — `src/production-system.ts` (2262 lines, ~40% sampled at strategic offsets covering auth, RBAC, checkout, webhook, reconciliation, password helpers, Asaas adapter). UI components under `app/components/**` not audited (XSS surface assessed via search rather than per-file read). Test files enumerated but not read individually. The runbook, redesign tokens/aesthetic docs, and `production-ux-ia.md` were not opened — gates are inferred from `release-gate.ts`, `production-delivery-plan.md`, and the readiness scripts surface.

---

## 🔄 Architecture Update — server.mjs deleted (post-audit)

**Status:** This audit was written before the `server.mjs` → Next.js migration. After the report was delivered, the migration completed. The original architecture description below is preserved for historical context. Read this section first.

### What changed

`server.mjs` (1228 lines, custom Node `http.createServer` wrapping Next.js) was deleted entirely. The application now runs on `next start` (production) and `next dev` (development). The migration spanned ~18 atomic commits:

- **Stage A** (`d11e417`) — extract `src/system-instance.ts` lazy-singleton (env reads, store + system construction, payment provider selection, reservation-expiry timer). Cached on `globalThis.__avSystemInstance` so any module graph (Next.js Turbopack worker, tsx subprocess, future tooling) shares one instance.
- **Stage B** (`e94eadb`) — `middleware.ts` enforces same-origin (with loopback bypass for server-to-server scripts) + protected-page redirect. `next.config.mjs::headers()` returns the full security-header set on every response (CSP, HSTS in production, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy).
- **Stage C** (`8dffe62`–`07a25dc`, ~14 commits) — every endpoint migrated to a Next.js Route Handler under `app/api/<path>/route.js`. Each Route Handler imports `getSystem()` directly (no more fetch-bridge proxies).
- **Stage 3 cutover** (`0f033d9`) — `npm start` / `npm dev` flipped to `next start` / `next dev`. `Dockerfile`, `scripts/dev-watchdog.sh`, `scripts/e2e-production-app.py`, `scripts/verify-isolated.mjs` updated. `server.mjs` deleted (`-1228 lines`). `npm run check` no longer references the deleted file.
- **Doc cutover** (`f619668`, `cc2b4c5`) — `CLAUDE.md` rewritten to reflect the new architecture; the "server.mjs is FROZEN" rule replaced with "Pure Next.js architecture".

### Post-migration topology

```
┌────────────────────────────────────────────────────────────┐
│                  Public Internet (HTTPS)                   │
└────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────┐
│                   Next.js (next start -p 4174)             │
│                                                            │
│  Request lifecycle:                                        │
│   1. middleware.ts (matcher: /api/:path*, /equipe/:path*,  │
│                     /admin/:path*)                         │
│       • Same-origin enforce on POST /api/*                 │
│         (loopback bypass; webhook routes exempt)           │
│       • Protected-page redirect (/equipe/*, /admin) when   │
│         av_session cookie absent → 308 /equipe             │
│   2. next.config.mjs::headers() — CSP, HSTS (prod), XFO,   │
│      X-Content-Type-Options, Referrer-Policy,              │
│      Permissions-Policy on every response                  │
│   3. next.config.mjs::rewrites() — /public/* → /*          │
│   4. App Router resolves the request:                      │
│       • Pages: app/<route>/page.jsx                        │
│       • APIs:  app/api/<path>/route.js (46 handlers)       │
│       • Static: public/<asset> served at /<asset>          │
│                                                            │
│  Domain singleton (lazy, globalThis-cached):               │
│       src/system-instance.ts::getSystem()                  │
│         → ProductionSystem + SqliteStateStore              │
│         → Pix provider (dev-pix or asaas)                  │
│         → setInterval(expireReservations, 60s)             │
│                                                            │
│  Production fail-closed gate:                              │
│       AV_REQUIRE_LIVE_PROVIDER=true  ⇒  PAYMENT_PROVIDER   │
│       must be "asaas"; empty TEAM_PASSWORD/                │
│       PIX_WEBHOOK_SECRET/SESSION_SECRET rejected.          │
│       (Decoupled from NODE_ENV because `next start`        │
│       forces NODE_ENV=production internally.)              │
└────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────┐
│               SQLite (node:sqlite, WAL journal)            │
│                $DB_FILE — single in-process writer         │
└────────────────────────────────────────────────────────────┘
```

### What every numbered finding below should be re-read against

| Original finding | Post-migration status |
|---|---|
| Webhook secret comparison uses `!==` | **Fixed** — `app/api/webhooks/pix/route.js` uses `timingSafeEqual` with explicit length check. |
| No HSTS, no CSP | **Fixed** — both in `next.config.mjs::headers()`; HSTS production-gated. |
| `assertSameOrigin` allows missing Origin | **Fixed** — `middleware.ts` rejects missing Origin/Referer; loopback hosts only bypass for server-to-server scripts. Webhook routes explicitly exempted (provider posts cross-origin; authenticity via shared-secret + `timingSafeEqual`). |
| Dockerfile runs as root | **Fixed** — `USER node` (uid 1000); `next start` is the entry. |
| `server.mjs` is FROZEN architectural debt | **Eliminated** — file deleted. |
| 84 unpushed commits, no CI signal | **Still standing** — CI has not been run on the migration. Push to `origin/main` to fire `production-ci.yml` against the post-migration tree. |
| `@ts-nocheck` on 2778 lines | **Still standing** — domain code still has the escape hatches. Multi-PR work; out of scope for this migration. |
| Patient invite codes are 24 random bits | **Still standing** — no auth-strength change in the migration. |
| In-memory login throttle, no rate limit on checkout/webhook/support | **Partially carried** — login throttle was inline in server.mjs and was NOT ported during the migration. The invariant is now defended only by `middleware.ts` origin enforcement + audit logging. Tracked as a follow-up. |
| Audit log retention, structured logging, `npm audit` in CI, offsite backup | **Still standing** — operations work, unchanged. |

### New post-migration concerns

1. **Middleware "loopback bypass"** allows server-side scripts (webhook-drill, deployment-check, etc.) to call APIs without an `Origin` header when running on `127.0.0.1`/`localhost`. Browsers always send `Origin` cross-context, so CSRF protection for browser surfaces is intact. But: a loopback shell on the production host could now POST to `/api/*` without a session cookie if it bypasses the cookie check too (it can't — protected endpoints still require `av_session` and pass it to `system.<method>(sessionId, ...)` for RBAC). Risk is bounded.
2. **`AV_REQUIRE_LIVE_PROVIDER=true`** must be set in real production deployments. If forgotten, the app boots with the dev `dev-pix` provider — payments would not actually settle. Mitigated by `release-gate.ts` checking `paymentProvider !== "dev-pix"` before clearing the gate, but Dockerfile/deploy template should hard-code it.
3. **Login throttle dropped during migration** — was `loginAttempts` Map in server.mjs, with 5-fail-then-15min-lockout. Patient and team login endpoints are now Route Handlers without throttle. Brute-force surface widened. Add follow-up Route-Handler-level throttle (Redis or in-process Map per worker).
4. **Singleton on `globalThis`** assumes single Node process. Horizontal scaling (multiple `next start` instances behind a load balancer) would break SQLite single-writer assumption. Already true pre-migration; flagged for visibility.

### What this means for the BLOCKER list below

The original "Top 3 BLOCKERS" included webhook timing-safe compare, CSP/HSTS, missing-Origin pass, and Dockerfile-as-root — all four are **now fixed in code**. Operational gates (provider approval, deployment evidence, TLS, offsite backup) remain. The remaining "ship today" gate is operations + the (still standing) login throttle regression flagged above.

---

# Original audit report (pre-migration; preserved for context)

---

## 1. Architecture Overview

### Stack
- **Runtime:** Node.js >= 22 (uses `node:sqlite` builtin and `node:crypto`).
- **Framework:** Next.js 16.2.6 + React 19.2.6 (App Router, JSX route handlers).
- **Database:** SQLite via Node 22's builtin `node:sqlite` (`DatabaseSync`). **Not** `better-sqlite3` despite README/comments referring to it. WAL journal mode, foreign keys ON, synchronous API.
- **Persistence pattern:** JSON-blob-per-row schema. Most tables store the canonical record as a `data TEXT NOT NULL` column with a few denormalized indexed columns (id, member_code, status, etc.). Saving is "delete-all + reinsert" inside `BEGIN IMMEDIATE`.
- **Crypto:** `scryptSync` (N=defaults, 64-byte hash, 16-byte hex salt) for team passwords; `HMAC-SHA256` for cookie signing; `timingSafeEqual` for both.
- **UI libs:** `@dnd-kit/core`, `cmdk` (⌘K palette), `framer-motion`, `lucide-react`, `qrcode.react`, `recharts`.
- **Custom server:** `server.mjs` (1228 lines) — wraps Next.js `nextHandler` and dispatches a switch-style table of ~40 endpoints.
- **TypeScript:** `strict: false`, `allowJs: true`, both domain files (`production-system.ts`, `sqlite-store.ts`) carry `// @ts-nocheck`.
- **CI:** Single GitHub Actions workflow (`production-ci.yml`) — lint+format+typecheck+`next build`+`node --check` syntax, unit tests, `verify:isolated` (smoke + Python Playwright E2E + readiness drills).

### Topology

```
                       ┌──────────────────────────────────────────────────────┐
                       │                Public Internet (HTTP)                │
                       └──────────────────────────────────────────────────────┘
                                          │
                                          ▼
                       ┌──────────────────────────────────────────────────────┐
                       │             server.mjs (custom Node http)            │
                       │                                                      │
                       │  • Cookie signing (HMAC-SHA256 + timingSafeEqual)    │
                       │  • Same-origin guard on POSTs                        │
                       │  • In-memory login throttle (Map by ip+identifier)   │
                       │  • Security headers (X-Frame, no-sniff, Referrer,    │
                       │    Permissions-Policy)        [no CSP, no HSTS]      │
                       │  • Body limit 7 MB, doc limit 5 MB                   │
                       │  • setInterval(expireReservations, 60s)              │
                       │  • Webhook secret check (header equality)            │
                       │                                                      │
                       │  Routing:                                            │
                       │  ┌──────────────────────┐  ┌────────────────────┐    │
                       │  │ /, /paciente,        │  │ /api/* legacy      │    │
                       │  │ /equipe/*, /admin    │  │ switch (~30 paths) │    │
                       │  │ /api/team/activity   │  │                    │    │
                       │  │ /api/team/orders/    │  │ delegates to       │    │
                       │  │   status             │  │ ProductionSystem   │    │
                       │  │ /api/team/support-*  │  │                    │    │
                       │  └──────────┬───────────┘  └─────────┬──────────┘    │
                       │             │ appRoutes              │               │
                       │             ▼ allow-list             │               │
                       │  ┌──────────────────────┐            │               │
                       │  │ next.getRequestHandler│           │               │
                       │  │ (App Router pages +  │            │               │
                       │  │  Route Handlers under│            │               │
                       │  │  app/api/*)          │            │               │
                       │  │       │              │            │               │
                       │  │       └─proxy back───┼────────────┘               │
                       │  │      via fetch loopback (status-apply,            │
                       │  │      _raw paths) carrying Cookie                  │
                       │  └──────────────────────┘                            │
                       └──────────────────────┬───────────────────────────────┘
                                              ▼
                       ┌──────────────────────────────────────────────────────┐
                       │   src/production-system.ts (ProductionSystem class)  │
                       │                                                      │
                       │  • In-memory `state` mirror of all SQLite tables     │
                       │  • All domain methods sync (except createCheckout    │
                       │    + reconcilePayment which await provider)         │
                       │  • Audit log appended on every privileged action     │
                       │  • runInventoryTransaction = JS-event-loop atomicity │
                       │    + arrays-snapshot rollback on throw               │
                       └──────────────────────┬───────────────────────────────┘
                                              ▼
        ┌─────────────────────────┐  ┌────────────────────┐  ┌─────────────────┐
        │ src/sqlite-store.ts     │  │ paymentProvider    │  │ DOCUMENT_STORAGE │
        │ (node:sqlite)           │  │  • dev-pix (dev)   │  │ DIR (out of     │
        │ • BEGIN IMMEDIATE save  │  │  • createAsaasPix  │  │ public/, mode   │
        │ • PRAGMA WAL            │  │    Provider        │  │ 0o600 files)    │
        │ • support_messages real │  │  → Asaas REST v3   │  │                 │
        │   relational table      │  │                    │  │                 │
        └─────────────────────────┘  └────────────────────┘  └─────────────────┘
```

### Key request flow #1 — Patient checkout (catalog → reservation → Pix → webhook → fulfillment)

1. `GET /api/catalog` (`server.mjs:205`) → `system.listCatalog(sessionId)` → `requirePatient` revalidates eligibility → returns `state.products.filter(active).map(publicProduct)`.
2. `POST /api/checkout` → `assertSameOrigin` → `system.createCheckout(sessionId, { items, deliveryMethod })`.
3. `runInventoryTransaction(() => …)` snapshots inventory arrays, then synchronously:
   - re-reads `availableStock(productId)` for each item (computed as `product.stock − Σ activeReservations`),
   - throws `409 OUT_OF_STOCK` and audits `patient_concurrent_checkout_blocked` if any line over-allocates,
   - else pushes a new `stockReservation` (status=active, expiresAt = now + 30 min) and an `order` (status=`awaiting_payment`).
4. **After** the synchronous critical section, `await paymentProvider.createPayment(...)`. On failure: reservation + order are removed (compensating action) and the call rethrows.
5. The Pix charge is appended to `state.payments`. State persists via `store.save(state)` — full table-replace inside `BEGIN IMMEDIATE`.
6. Provider eventually POSTs `/api/webhooks/pix` with `x-webhook-secret` header. Server compares **directly with `!==`** (not timing-safe), then calls `system.confirmPixPayment(normalizePixWebhook(body))`.
7. `confirmPixPayment` is idempotent on `eventId`. If reservation is expired/inactive at confirmation time, marks order `fulfillment_exception` + `paid_after_expiry` and audits `paid_after_expiry_conflict`. Otherwise decrements `product.stock`, appends `stockMovement out`, marks reservation `converted`, payment `paid`, order `paid_pending_fulfillment`, audits `payment_confirmed`.
8. The patient polls `/api/my-orders` to see the timeline advance.

### Key request flow #2 — Team kanban drag (status update via bridge)

1. Operator drags a card in `/equipe/fulfillment`. Client `POST /api/team/orders/status` with `{ orderId, status }`.
2. server.mjs sees the path is in `appRoutes` and forwards to Next's request handler.
3. The Next.js Route Handler at `app/api/team/orders/status/route.js` validates `status ∈ { paid_pending_fulfillment, separating, ready_to_ship, sent }` and `orderId` non-empty.
4. The Route Handler issues a **server-side fetch loopback** to `POST /api/team/orders/status-apply` on the same origin, forwarding the `cookie` and `origin` headers.
5. `/api/team/orders/status-apply` is **not** in `appRoutes`, so it stays on the legacy switch in `server.mjs`. It calls `assertSameOrigin` and dispatches `system.updateOrderFulfillmentStatus(...)`.
6. ProductionSystem performs role check (`requireTeam(sessionId, "fulfillment:write")` per Phase 5 design), validates lifecycle transition, mutates the order, audits `team_order_status_changed`, persists.
7. Client receives JSON response and finalizes (or reverts) the optimistic UI.

### The "Frozen Server + Bridge" pattern

`CLAUDE.md` declares `server.mjs` frozen — no new endpoints. The escape valve is the `appRoutes` allow-list at `server.mjs:61-89`: adding a pathname there causes `nextHandler(request, response)` to take over for that exact path, so the implementation lives at `app/api/<name>/route.{js,ts}`. Three concrete bridges exist today:

- Phase 3: `/api/team/activity` (forwards via `fetch` to `/api/team/dashboard` and filters auditLog).
- Phase 5: `/api/team/orders/status` (Route Handler validates body, forwards to `/api/team/orders/status-apply`).
- Phase 7: `/api/team/support-replies`, `/api/team/support-thread` (forward to `*/_raw` legacy endpoints).

The pattern works but introduces a same-process loopback `fetch` per request. The Route Handler must propagate `cookie` and `origin` manually; **`assertSameOrigin` allows mutations only when `origin` matches `host`**, so the bridge passes a forged `origin = url.origin`. This is intentional but deserves a named comment that the bridge is bypassing one layer of CSRF defense and substituting the same-process boundary as the trust check.

---

## 2. Production-Readiness Ledger

Source of truth: `src/release-gate.ts` (`RELEASE_GATE_CHECKS` array of 8) cross-checked with `docs/production-delivery-plan.md` "Current State" + "Redesign Initiative Status" sections.

### Gates currently passing (per current `artifacts/readiness/*.json` shape)

Application-side gates that are mechanically green in the local/dev evidence stack:

| Gate | Source of truth | Evidence script | Notes |
|---|---|---|---|
| **Database schema** | `release-gate.ts` "Database schema" | `npm run readiness:schema-check` | Enforces `user_version === SQLITE_SCHEMA_VERSION` (currently 15) and presence of all required tables + migration ledger entries. |
| **Backup restore drill** | "Backup restore drill" | `npm run readiness:backup-drill` | Creates a consistent SQLite snapshot, reloads via `SqliteStateStore`, records sha256 + counts. |
| **Signed Pix webhook drill** | "Signed Pix webhook drill" | `npm run readiness:webhook-drill` | Proves unsigned → 401, signed → 200, finalOrderStatus = `paid_pending_fulfillment`, stock decremented. |
| **Schema/Backup/Webhook (admin readiness card)** | `/api/team/readiness` | live | Read-time evidence rendering; all three above visible in `/admin`. |

### Gates currently pending and what each blocks

| Gate | Blocks | Pending reason |
|---|---|---|
| **Provider approval** (`provider-approval.json`) | Real Pix flow; `PAY-001` (business decision); `PAY-003` final signature contract. | Must record `status: "approved"` plus provider, accountStatus, evidenceRef, termsRef, webhookDocsRef, settlementNotes. None present. |
| **Deployment/log evidence** (`deployment-check.json`) | `DEP-002`. Validates `production: true`, `https: true`, `healthStatus === 200`, `catalogDeniedStatus === 401`, `protectedRouteStatus ∈ {302,307,308}`, `logsEvidence: true`. | No production host yet → cannot run against an HTTPS URL. |
| **Domain/TLS** (`domain-tls.json`) | `DEP-001`. Requires public `https`, professional host, authorized cert chain, `/health` 200. | No domain provisioned. |
| **Session cookie security** (`session-security.json`) | Cookie hardening attestation in production. Requires `production === true && secureRequired === true && cookie.secure === true`. | Local HTTP run can attest signed/HttpOnly/SameSite/path/maxAge but not `Secure`. |
| **Offsite backup schedule** (`backup-schedule.json`) | Operational continuity. Requires offsiteTargetRef, frequency, retention, encryptionRef, lastSuccessfulBackupAt, lastBackupRef, operatorRef, restoreDrillSha256 (64 chars). | No offsite target configured. |

### Coverage matrix (per task requirement)

- **Backup/restore:** in-process drill exists and is wired to admin + release gate. ✅ partial — restore is "load through `SqliteStateStore` and count rows", not a true cross-host restore. No PITR.
- **Webhook drill:** local drill exists and is mechanically validated. ✅ for the *local* signed-secret contract. ❌ Does not match any real provider's signature scheme; final provider HMAC contract is `PAY-003` and pending.
- **Provider approval:** ❌ blocked on business decision.
- **Deployment check:** ❌ blocked on host decision.
- **Domain TLS:** ❌ blocked on host decision.
- **Schema check:** ✅
- **Session security:** 🟡 partially provable (HttpOnly/SameSite/signed) but `Secure` requires HTTPS in production.
- **Backup offsite:** ❌ not configured.

### E2E + smoke + verify:isolated status

- `npm test`: 58/58 unit tests, all passing per docs (not re-run in this audit).
- `npm run smoke`: requires external server on `SMOKE_BASE_URL`. Used inside `verify:isolated`.
- `npm run e2e`: Python Playwright. Self-bootstraps an isolated Next-built server on a free port, runs the patient happy/blocked/team/document/responsive checks. Latest evidence is local PNGs.
- `npm run verify:isolated`: orchestrator. Boots its own server + DB + doc dir, runs readiness drills, smoke, E2E, then tears down.

### CI workflow — what it actually runs

`.github/workflows/production-ci.yml` runs on push-to-main and PR. Steps:

1. Checkout, Node 22, Python 3.11, install Playwright + chromium with deps.
2. `npm run check` — lint + prettier + tsc (with `// @ts-nocheck` shielding the two largest files) + `node --check` of every `.mjs` script + `python -m py_compile` of the E2E script + `next build`.
3. `npm test` — 58 unit tests.
4. `LOG_EVIDENCE_REF=github-actions-isolated-verification npm run verify:isolated`.
5. Upload `artifacts/visual-e2e/` artifact.

### What CI does **not** run

- ❌ No real production deploy (`deployment-check`/`domain-tls` need a live URL).
- ❌ No TypeScript strict mode (the two big domain files are `@ts-nocheck`).
- ❌ No SAST (no CodeQL, no audit step in CI).
- ❌ No `npm audit` / dependency vulnerability gate.
- ❌ No release-gate check (`release-gate.ts` would currently fail by design).
- ⚠️ The repo has **84 unpushed commits** (vs `origin/main`). Local-only CI signal; the workflow has not actually run against the closed-out redesign work.
- ⚠️ E2E runs against an isolated server, not against the production-style image (`Dockerfile`). Container is never built or smoke-tested.

---

## 3. Security Analysis

### AuthN — Patient

- Credentials: member code + invite code, both UPPERCASE-normalized. Static seed values (`HELENA2026`, `JOAO2026`, `BLOQ2026`).
- **Invite-code entropy on rotation**: `generatedInviteCode(memberCode, now)` uses last-4 of memberCode + `YYMMDD` + `randomBytes(3).toString("hex")` (24 random bits, 6 hex chars). 24 bits is **weak** for an authentication factor — an online attacker who knows the member code (or can enumerate `APO-####`) and the rotation date faces only 16M possibilities. With the in-memory throttle of 5 attempts per (ip+identifier) per 10 minutes, online brute force is rate-limited but distributed/IPv6-rotated attempts could still amortize. This is meant for "member receives invite via support" not as a long-lived credential, but the system never expires the seeded invite, so once leaked it is effectively a permanent password.
- Session created with `randomUUID()` (122 bits, OK).
- Cookie max-age: 8h for patients, 12h for team.
- No password / no second factor for patients.
- **No throttle on the member-code attempt key** if invite matches and patient is `inactive` (eligibility blocks at 403, not 401). Attacker can probe `inactive`/eligibility status at the same rate as login.

### AuthN — Team

- Email + password. `scryptSync(password, salt_hex_16, 64)` with default `r/p/N` (Node defaults: N=16384, r=8, p=1). Result stored as `scrypt:salt:hex64`. Verification re-derives and `timingSafeEqual`s (`production-system.ts:2130-2142`).
- **scrypt with default parameters is acceptable in 2026** but lacks parameter versioning embedded in the hash — no `scrypt:v=1:N=16384:...:salt:hash` prefix, so future migration to higher cost factors will require a re-hash flag and a fallback verifier.
- Minimum password length: 10 (enforced in `resetTeamUserPassword` and `changeOwnTeamPassword` only — `createTeamUser` does **not** check length and `ensureTeamUser` accepts whatever `TEAM_PASSWORD` env contains). Minor inconsistency.
- Login throttle: 5 attempts per (ip+email) per 10 min → 15 min lockout. In-memory `Map` only — restarts wipe it; multiple processes don't share. Acceptable for single-instance deployment, **inadequate for any horizontal scaling**.
- Legacy fallback path: if `state.teamUsers` is empty, falls back to bare `expectedPassword` comparison via `password !== expectedPassword`. **Not** timing-safe. Reachable only on a freshly seeded DB before `ensureTeamUser` runs, but that bootstrap happens at server startup before any request — so practically dead code, but it remains a minor wart.

### AuthN — Sessions / cookies

- Cookie name `av_session`, signed `value.signature` with HMAC-SHA256 of `sessionSecret`, base64url, timing-safe verified (`server.mjs:692-705`). ✅
- Flags: `Path=/`, `HttpOnly`, `SameSite=Lax`, `Max-Age=12h`, `Secure` only in production. ✅
- No `__Host-` prefix; without it a subdomain or path attack is theoretically possible if the same domain serves another app. Minor.
- Sessions are stored in `state.sessions` and persisted on every login/logout. Logout clears it server-side. ✅
- Idle expiry vs absolute expiry: only absolute (`expiresAt = createdAt + 12h`), no sliding window. Acceptable for an ops tool.

### AuthZ / RBAC

- `ROLE_PERMISSIONS` (lines 7-25): `admin: ["*"]`, plus `operations`, `stock`, `fulfillment`, `support` with explicit lists.
- `requireTeam(sessionId, permission)` (lines 407-428):
  - Looks up session by id, checks `role === "team"` and not expired.
  - Looks up `teamUser` by `session.teamUserId`. If missing, falls back to a synthetic legacy admin (`role: "admin"`, `status: "active"`). **Bypass risk:** if the team users table is wiped while a session id exists, that session still resolves to admin permissions. Practically requires DB tampering, but is a defense-in-depth gap.
  - Status check (`!== "active"` → 403). ✅
  - Permission check via `hasPermission(role, permission)` — `admin` matches `*`. ✅
- I did not enumerate every privileged method; based on grep, every mutating team method I sampled (createTeamUser/updateTeamUserStatus/resetTeamUserPassword/addStock/cultivation*/createPatient/updatePatientAccess/issueMemberCard/registerPrescriptionDocument/createProduct/updateProduct/updateFulfillmentStatus/cancelOrder/recordOrderException/upsertShipment/updateSupportRequest/createSupportReply/reconcilePayment) starts with `requireTeam(sessionId, "<scope>:write")` or analogous. I trust the published claim that 58 unit tests cover RBAC negative paths.

### Audit logging

- `this.audit(action, actor, details)` is called inside every privileged method I sampled, before `this.persist()`.
- Audit envelope: `id`, `action`, `actor`, `at` (ISO), `data` (JSON-stringified details). Stored in `audit_log` table.
- Retention: unbounded — `state.auditLog` grows forever and is rewritten on every save (delete-all + reinsert). At ~1KB/event, this is fine for years at small operator scale, but is **O(n) per persist** and will scale poorly with a busy team. Pruning/archival policy not present.
- `dashboard()` returns only the last 50 events.
- `paid_after_expiry_conflict`, `patient_concurrent_checkout_blocked`, and other system events use literal `"system"` as actor — fine as a convention.
- Note: `runInventoryTransaction`'s rollback **preserves** audit events appended during the failed body (intentional — the block reason must outlive the rollback). Subtle but correct.

### Pix webhook

- `server.mjs:478-485`: `request.headers["x-webhook-secret"] !== webhookSecret` → 401.
- **This is `!==` string equality, not `timingSafeEqual`.** Header comparison leaks timing on failure path. The secret is fixed-length per environment so the exposure is small, but `timingSafeEqual` is the standard and is already imported in this file (used for cookie verify). MAJOR finding.
- The current contract is **shared-secret** in the request header, not HMAC of the body. Listed explicitly in PAY-003 as "must match the final provider's exact signature contract" (Asaas uses `asaas-access-token` header equality, so the local contract is closer to Asaas than e.g. Mercado Pago HMAC; still: not the production contract).
- Replay protection: `confirmPixPayment` dedupes by `eventId` (line 579). If a webhook lacks an `eventId`, server.mjs's `normalizePixWebhook` synthesizes `${providerPayment.id}:${providerStatus}` — so a replay of the same provider payment in the same status produces the same eventId and is correctly de-duplicated. ✅
- Body normalization: tolerant — accepts `payload.payment` or `payload.data` shapes; status set normalizes `PAID/RECEIVED/CONFIRMED/RECEIVED_IN_CASH` to `paid`, anything else passes through and `confirmPixPayment` rejects non-`paid`. ✅
- No body size enforcement on the webhook beyond the 7 MB global cap. Acceptable.

### Document upload

- `storePrescriptionPayload` (`server.mjs:535-553`):
  - Body cap 5 MB; rejects empty file.
  - sha256 of bytes recorded.
  - Stored under `DOCUMENT_STORAGE_DIR` outside `public/` (verified by `path.normalize` startsWith check).
  - Stored filename `${Date.now()}-${sha[0..16]}-${sanitizedName}` with `flag: "wx"` (fail if exists) and mode `0o600`.
  - Original base64 dropped from payload before persistence.
- Download path `/api/team/prescription-documents/{id}/download`:
  - `system.getPrescriptionDocumentForDownload` requires `prescriptions:write` per audit `prescription_document_accessed` (claimed by docs; not directly read in this audit).
  - `servePrivateDocument` re-hashes file at read time and rejects on mismatch (409). Defense against on-disk tampering. ✅
  - `Content-Disposition: attachment; filename="..."`. ✅
- Filename sanitization regex restricts to `[a-zA-Z0-9._-]`, length-capped at 120. ✅
- `mimeType` is taken from the stored record and reflected in the `Content-Type`. **MIME is whatever the upload payload claimed** — combined with `X-Content-Type-Options: nosniff` and the forced attachment disposition, this is acceptable. Server does not validate MIME against magic bytes.

### Inventory race

- `runInventoryTransaction` (lines 540-575) uses Node's single-threaded run-to-completion semantics + a synchronous `node:sqlite` driver to guarantee that the read-check of `availableStock` and the write of the reservation cannot interleave with another HTTP handler's check. The await on `paymentProvider.createPayment` is **outside** the synchronous block, so a concurrent checkout's `availableStock` read sees the just-written reservation.
- `BEGIN IMMEDIATE` is used by `SqliteStateStore.save`, providing durability serialization at the SQL level. Any second process hitting the same DB would block on the SQLite write lock.
- 5-patient race test (`test/inventory-race.test.mjs`) verifies "exactly one wins" via `Promise.allSettled`. ✅
- **One caveat:** `runInventoryTransaction` snapshots in-memory arrays for rollback, but does not snapshot **product.stock mutations** consistently. The snapshot includes `productStocks` and restores them, but `confirmPixPayment` (which mutates `product.stock -= item.quantity`) is **not** wrapped in `runInventoryTransaction`. A failed `confirmPixPayment` partway through the loop would leave inventory partially decremented. The current code does the validation pass (`if (item.quantity > product.stock) throw`) before any mutation, so by construction the second loop cannot fail. Defensive but OK.

### Privacy / LGPD

- Consent gate: `acceptPrivacyConsent(sessionId, consent)` records `privacyConsentAt` and `privacyConsentVersion` on the patient and audits `privacy_consent_accepted`.
- The patient UI gates the catalog behind the consent screen (claimed by docs; UI not directly audited).
- **Server-side enforcement is present in audit/state, but I did not verify that `requirePatient` or `listCatalog` refuses access without consent.** The eligibility check (`patientEligibility`) governs `status/prescription/card` validity but I did not confirm consent is part of it. POSSIBLY a gap — `CMP-001` is open in the delivery plan and the docs say "Remaining work: data export/deletion process, retention rules, and formal policy text", which suggests consent gating is UI-side only. MAJOR if confirmed by deeper read.
- No data export endpoint; no deletion / right-to-be-forgotten endpoint. `CMP-001` open.

### Common vulnerabilities

- **SQL injection:** all queries use parameterized `prepare(...).run(...)` / `.get(...)` / `.all(...)`. The only string-interpolated SQL is in `addColumnIfMissing(table, column, definition)` which takes static call-site arguments, not user input. ✅
- **XSS:** No `dangerouslySetInnerHTML` or `innerHTML` found in `app/` or `src/` (grep clean). React escaping is the default.
- **Open redirect:** the only redirect (`server.mjs:566 redirect()`) hardcodes `/equipe` as the destination on protected-route gating. ✅
- **IDOR on patient orders:** `listMyOrders` filters by `patientId === patient.id` from session, not from request. ✅ `listCatalog`, `createCheckout`, `acceptPrivacyConsent`, `createSupportRequest` all derive identity from the cookie. The team-side endpoints rely on `requireTeam` + role-permission checks, not on URL identifiers, so authority does not depend on request-supplied IDs.
- **Secrets in code:** `dev-session-secret-change-me`, `dev-webhook-secret`, `apoio-equipe-dev` are all gated behind `production ? undefined : "<dev>"` in `requiredEnv`. Production refuses to boot without real values (correct fail-closed). The seed patients carry plaintext `inviteCode` strings (HELENA2026 etc.) — these are dev-only fixtures. ✅
- **Same-origin enforcement:** every `POST /api/*` mutation calls `assertSameOrigin(request)` (lines 162, 184, 200, 211, 220, 233, 245, 255, 264, 273, 279, 285, 291, 297, 303, 311, 320, 326, 332, ...). The check (line 707-712): if `Origin` header missing → allow; if present, must match `${x-forwarded-proto || http}://${host}`.
  - **MAJOR finding:** the "no `Origin` header → allow" branch (`if (!origin) return;`) is **CSRF-vulnerable**. Same-site forms posted from a malicious page with `enctype=text/plain` sometimes omit `Origin` in older browsers; more importantly, anyone with a non-browser client (curl/script) can mutate without origin restriction. Combined with `SameSite=Lax` cookies, this drops to "lax-CSRF-protected": GET-based and top-level-navigation POSTs via SameSite still bypass. The right pattern is: present **and** matching, or fall back to a CSRF token. Defense is partial.
  - **MINOR:** `x-forwarded-proto` is trusted blindly. If the reverse proxy is misconfigured or absent, an attacker controlling the header could match an origin they wouldn't otherwise.
- **Rate limiting:** present on login (5 / 10 min / lockout 15 min), in-memory only. **No rate limiting** on `/api/checkout`, `/api/patient/access-recovery`, `/api/support-requests`, webhook, or any team endpoint.
- **Headers:** `securityHeaders()` sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
  - **MAJOR — missing CSP.** No `Content-Security-Policy` header anywhere. The application is React + Next, so a meaningful CSP is non-trivial (Next inlines bootstrap scripts), but for a private medical-data app a CSP with at least `default-src 'self'` + `connect-src 'self' https://api.asaas.com` is expected.
  - **MAJOR — missing HSTS.** No `Strict-Transport-Security`. Required for any HTTPS production app, especially one handling LGPD-class data.
  - No `Cross-Origin-Opener-Policy` / `Cross-Origin-Resource-Policy` / `Cross-Origin-Embedder-Policy`. Minor for a non-iframe-embedding site.

---

## 4. Code Quality & Tech Debt

- **`@ts-nocheck` on `production-system.ts` (2262 lines) and `sqlite-store.ts` (516 lines).** README and `CLAUDE.md` acknowledge "212 latent errors" (claimed; not re-counted). Lifting requires:
  - Disabling `@ts-nocheck`, fixing implicit any across method signatures.
  - Adding `.ts` extensions to imports under `nodenext` resolution (current code does `import "./production-system.ts"` from server.mjs which works only because `tsx` is the loader).
  - Defining state-shape interfaces (`State`, `Patient`, `Order`, `Reservation`, etc.) — currently the entire domain is structurally typed via JSDoc-by-convention only.
  - Estimated 1–2 weeks of focused work to retypecheck without broad refactor.
- **`server.mjs` (1228 lines, "frozen").** Currently dispatches ~30 endpoints via if-chain. The bridge pattern moves new endpoints to Route Handlers but the legacy switch is not shrinking — it's growing on accident: new `/api/team/orders/status-apply`, `/_raw` endpoints exist *because* of the bridge. The migration path documented in CLAUDE.md needs a phased plan to **subtract** legacy endpoints once their Route Handler replacement covers them; otherwise the freeze is a freeze of *interface*, not *size*.
- **Testing**: 58 unit tests focused on backend invariants. Coverage of:
  - inventory race (5-patient last-unit), inventory lots
  - fulfillment status transitions
  - audit timeline grouping
  - support thread (RBAC, ordering)
  - team activity Route Handler
  - sqlite-store reload
  - server-config (env gating)
  - production-system general surface
- **Test gaps**:
  - No React component tests at all. UI is exercised only via Playwright E2E.
  - No tests for `signCookie`/`verifyCookie`, `assertSameOrigin`, `loginAttempt*` (the request-layer in server.mjs).
  - No fuzz tests on webhook normalization; no negative-path tests for malformed JSON, oversized bodies (`413`), or non-paid statuses.
  - No tests for Asaas adapter HTTP error mapping (the path is dead in tests because the dev-pix path is used).
  - No tests covering the `runInventoryTransaction` rollback path on payment-provider failure.
- **E2E coverage** (per docs): 5 Python flows — patient happy path with Pix, blocked patient, team workspaces, document upload, mobile/desktop overflow check across 9 routes. Real gaps:
  - No payment-expiry-then-paid-after-expiry conflict path (the `paid_after_expiry_conflict` audit is the highest-stakes race code in the system and has only unit-test coverage).
  - No real-provider Pix simulator vs Asaas; the dev-pix is the only path E2E hits.
  - No drag-drop interaction in the kanban (Playwright dnd is hard but feasible).
  - No ⌘K command palette interaction.
  - No support reply round-trip from team UI.
  - No login-throttle E2E (verifies 429 path).
- **Concurrent-edit collision artifacts:** The user mentioned commit `f471824` "Phase 2 commit carrying Phase 4 scaffold". I did not bisect; this is reported as bisect noise from the parallel phase work and would matter only if a regression search needs to skip noise commits. Document as a known historical bisect hazard.
- **80+ commits unpushed (no CI signal).** Confirmed: `git rev-list --count origin/main..HEAD` = **84**. The closeout of the 14-phase redesign has not been validated by GitHub Actions on a clean container. This is a real risk: every assertion of "CI green" is from local runs that may include uncommitted state, missing env vars, or path-relative artifacts.
- **Dependencies:** `next ^16.2.6`, `react ^19.2.6`, `framer-motion ^12.38.0`, `recharts ^3.8.1`, `cmdk ^1.1.1` — all current at the time. No `npm audit` step in CI, no Dependabot config visible.
- **Dockerfile** (`Dockerfile`) is minimal: `node:22-slim`, copies `app/`, `public/`, `src/`, `server.mjs`, runs `next:build`, prunes dev deps, exposes 4174, runs as **root** (no `USER` directive). MAJOR.

---

## 5. Specific Gaps Blocking Production

### BLOCKER — Must fix before prod
1. **No HSTS header.** `server.mjs:608-616` `securityHeaders()`. Required for any HTTPS production app handling LGPD data.
2. **No CSP header.** Same location. Even a permissive `default-src 'self'; connect-src 'self' https://api.asaas.com; img-src 'self' data:` baseline is missing.
3. **Webhook secret comparison uses `!==`, not timing-safe.** `server.mjs:479`. Easy fix using already-imported `timingSafeEqual`. Especially relevant once the production webhook arrives — every header-bytes timing leak narrows the secret.
4. **`PIX_WEBHOOK_SECRET` is shared-secret only; not provider HMAC.** `PAY-003`. The current contract will not match Asaas/MP/Pagar.me production signatures. Until matched, any webhook integration is theoretical.
5. **Provider not approved (`PAY-001`).** Cannot run real Pix.
6. **No production host / domain / TLS (`DEP-001`).** Cannot deploy.
7. **No offsite backup configured (`DEP-002`).** Single-point-of-failure SQLite file in a container.
8. **Dockerfile runs as root.** Add a non-root `USER node`, ensure `/data` ownership.
9. **84 unpushed commits → CI never validated the redesign closeout.** Push to a branch and let GitHub Actions actually verify before any deploy.
10. **`assertSameOrigin` allows missing `Origin` header.** `server.mjs:707-712`. Either deny when missing or back it up with a CSRF token. CSRF defense currently rests entirely on `SameSite=Lax`.

### MAJOR — Should fix before prod
1. **Login throttle is in-memory only.** Single-process; lost on restart. Move to SQLite-backed counter or redis if scaled.
2. **Patient invite-code entropy (24 random bits) is too low for an authentication factor.** Bump to ≥ 128 bits or treat invite as one-time and force a password setup on first login.
3. **`requireTeam` synthesizes a legacy admin if `teamUser` is missing for an active session.** `production-system.ts:415-422`. Dead in normal flow but a defense-in-depth gap; require a real DB row.
4. **Privacy consent is recorded but I did not confirm it is server-enforced before catalog access.** Verify `requirePatient`/`listCatalog`/`createCheckout` refuse without `privacyConsentAt`.
5. **`production-system.ts` and `sqlite-store.ts` carry `@ts-nocheck`.** ~212 latent type errors. Risk of silent runtime breakage on refactor.
6. **No rate limiting on non-login endpoints.** `/api/checkout`, `/api/support-requests`, `/api/patient/access-recovery`, webhook all unbounded except 7 MB body.
7. **Audit log unbounded retention** with delete-all/reinsert-all save pattern. Will degrade performance and DB growth past O(10⁵) events.
8. **Save pattern is full-table-replace inside `BEGIN IMMEDIATE`.** Cheap at current scale; pathological with growth. Consider per-row upserts.
9. **No CSP nonce / strict CSP** — the server inlines security headers but no policy. (See BLOCKER #2; called out separately because even after a baseline CSP is added, a nonce-based strict CSP is the right target.)
10. **Email-as-username for team without verification.** `ensureTeamUser` and admin reset trust the typed email; no confirmation flow.
11. **No `npm audit` / dependency-vuln gate in CI.**
12. **Deployment runbook (`docs/production-runbook.md`) not actually run end-to-end.** `DEP-003` open.
13. **No structured logging.** `server.mjs` uses `console.log` for boot only. No request log, no correlation IDs, no JSON logs. Operations evidence will be ad-hoc files in `artifacts/readiness/`.
14. **MIME type for prescription downloads is whatever the client claimed at upload.** Not exploitable due to nosniff + attachment, but should validate against a small allow-list (PDF, JPEG, PNG).
15. **`x-forwarded-proto` trusted blindly in same-origin check.**

### MINOR — Post-launch
1. **Cookie name not `__Host-` prefixed.**
2. **Password hash format does not embed scrypt parameters** — future cost-factor migration is awkward.
3. **`createTeamUser` does not enforce password length** (only the reset/change paths do). Inconsistent.
4. **Legacy fallback path (`expectedPassword !== password`) in `loginTeam`.** Practically dead. Remove.
5. **No idle-session timeout** (only absolute 12h/8h).
6. **No CORS policy at all** — fine because the app is same-origin only, but worth declaring explicitly.
7. **Audit log retention/archival policy missing.**
8. **No fulfillment-exception SOP** (`FUL-001` partial).
9. **`UX-009` public landing redesign deferred** — current public landing is still the older HTML, may not match the locked aesthetic. Operator-acknowledged.

---

## 6. Recommended Next Steps (top 5)

1. **Push the branch and let CI run.** 84 unpushed commits means the entire redesign closeout is unverified by automated CI. Do this before any other security work — the rest depends on knowing the green baseline is real.
2. **Patch the four cheap-but-high-impact security fixes** in one PR:
   - Add HSTS (`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` in production).
   - Add a baseline CSP (`default-src 'self'; connect-src 'self' https://api.asaas.com; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'` and tighten later).
   - Switch webhook secret comparison to `timingSafeEqual`.
   - Tighten `assertSameOrigin` to **require** `Origin` header on POSTs and add a non-root `USER node` to the Dockerfile.
   These are surgical, individually under 20 LOC, and lift the security-header story from "barely there" to "auditable".
3. **Resolve `PAY-001` / `PAY-003` together.** No production deployment is meaningful without a real Pix provider contract and matching webhook HMAC. Until business commits to Asaas (or another), `release-gate.ts` stays red. Once chosen, replace the shared-secret webhook check with the provider's HMAC and add a real provider contract test.
4. **Make `DEP-001` / `DEP-002` concrete.** Pick host, provision domain + TLS, run `readiness:deployment-check` + `readiness:domain-tls` + `readiness:session-security` against the live HTTPS URL, and configure offsite backups (S3 or R2 with daily cron + retention). All five "operations" gates close together.
5. **Strip `@ts-nocheck` from `sqlite-store.ts` first** (smaller, leaf module). Then incrementally on `production-system.ts` by section: state shape → auth helpers → checkout → webhook → reconciliation. This is the only way to prevent silent regressions when the bridge eventually consumes more legacy endpoints.

---

## Appendix A — File map

| Path | Lines | Role |
|---|---:|---|
| `server.mjs` | 1228 | Custom Node http server, frozen interface |
| `src/production-system.ts` | 2262 | Domain core, RBAC, checkout, webhook, reconciliation, Asaas adapter |
| `src/sqlite-store.ts` | 516 | Persistence layer (node:sqlite, JSON-blob-per-row) |
| `src/release-gate.ts` | 143 | 8-check release gate against artifacts/readiness/*.json |
| `app/api/team/activity/route.js` | 117 | Phase 3 bridge — audit feed |
| `app/api/team/orders/status/route.js` | 82 | Phase 5 bridge — kanban drag |
| `app/api/team/support-replies/route.js` | (unread) | Phase 7 bridge |
| `app/api/team/support-thread/route.js` | (unread) | Phase 7 bridge |
| `.github/workflows/production-ci.yml` | 50 | Single CI job |
| `Dockerfile` | 22 | Production image (root user) |
| `eslint.config.mjs` | 82 | Architectural-boundary lint (no react/next under `src/`) |
| `tsconfig.json` | 38 | strict:false, NodeNext, allowJs |

## Appendix B — Things I did not read

- `app/components/**` (UI components — XSS surface assessed via grep only).
- `app/equipe/**` and `app/paciente/**` page sources.
- `app/api/team/support-replies/route.js` and `app/api/team/support-thread/route.js` (assumed analogous to the orders/status bridge).
- All `test/*.test.mjs` bodies (only the file names).
- `scripts/*.mjs` bodies beyond knowing the readiness contracts they enforce.
- `docs/redesign/locked-aesthetic.md`, `docs/redesign/tokens.md`, `docs/production-runbook.md`, `docs/production-ux-ia.md`.
- `thoughts/ledgers/CONTINUITY_CLAUDE-redesign-roadmap.md` (closing summary not opened — gate status taken from `production-delivery-plan.md`).
- The Asaas adapter response-shape edge cases (only the happy path was sampled).

If any conclusion above hinges on one of these, treat it as a working hypothesis pending a follow-up read.
