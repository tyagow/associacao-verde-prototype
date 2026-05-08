# Production Runbook

## Required Environment

```text
NODE_ENV=production
PORT=4174
DB_FILE=/data/associacao-verde.sqlite
TEAM_PASSWORD=<strong password>
TEAM_EMAIL=<initial admin email>
SESSION_SECRET=<long random secret>
PIX_WEBHOOK_SECRET=<provider webhook signing secret>
PAYMENT_PROVIDER=asaas
```

For Asaas Pix:

```text
PAYMENT_PROVIDER=asaas
ASAAS_API_KEY=<asaas access token>
ASAAS_CUSTOMER_ID=<asaas customer id>
ASAAS_BASE_URL=https://api.asaas.com/v3
```

## Container

```bash
docker build -t associacao-verde-production .
docker run --rm -p 4174:4174 \
  -e DB_FILE=/data/associacao-verde.sqlite \
  -e DOCUMENT_STORAGE_DIR=/data/private-documents \
  -e TEAM_PASSWORD="$TEAM_PASSWORD" \
  -e TEAM_EMAIL="$TEAM_EMAIL" \
  -e SESSION_SECRET="$SESSION_SECRET" \
  -e PIX_WEBHOOK_SECRET="$PIX_WEBHOOK_SECRET" \
  -e PAYMENT_PROVIDER=asaas \
  -e ASAAS_API_KEY="$ASAAS_API_KEY" \
  -e ASAAS_CUSTOMER_ID="$ASAAS_CUSTOMER_ID" \
  -e ASAAS_BASE_URL=https://api.asaas.com/v3 \
  -v associacao-verde-data:/data \
  associacao-verde-production
```

## Health Check

```bash
curl http://127.0.0.1:4174/health
```

Expected fields:

- `ok: true`
- `database`: configured SQLite path
- `paymentProvider`: `dev-pix` or `asaas`
- `production`: `true` in production

## Release Gate

Before deployment:

```bash
npm run check
npm test
DB_FILE=<current sqlite path> npm run readiness:backup-drill
READINESS_BASE_URL=<running app URL> npm run readiness:webhook-drill
READINESS_BASE_URL=<running app URL> \
LOG_EVIDENCE_REF=<log dashboard, deploy id, or release log path> \
npm run readiness:deployment-check
READINESS_DOMAIN_URL=https://<production-domain> npm run readiness:domain-tls
DB_FILE=<current sqlite path> npm run readiness:schema-check
READINESS_BASE_URL=<running app URL> npm run readiness:session-security
npm run readiness:backup-schedule
npm run readiness:release-gate
npm run smoke
npm run e2e
npm run verify:isolated
```

Then run a smoke flow against the deployed URL:

1. `GET /api/catalog` without a session must return `401`.
2. Patient login must require a valid member code plus invite.
3. Checkout must create an `awaiting_payment` order and active reservation.
4. Unsigned Pix webhook must return `401`.
5. Signed paid Pix webhook must mark the order `paid_pending_fulfillment`.
6. Product stock in SQLite must decrement only after the signed paid webhook.

`npm run readiness:webhook-drill` writes non-secret evidence to
`artifacts/readiness/webhook-drill.json` so `/admin` can show when the signed
webhook proof last passed.

`npm run readiness:deployment-check` writes
`artifacts/readiness/deployment-check.json` with health, route protection, and
security-header proof for the URL under release. Production releases must attach
a concrete `LOG_EVIDENCE_REF`.

`npm run readiness:domain-tls` writes `artifacts/readiness/domain-tls.json` with
public hostname, trusted certificate, issuer, expiry, fingerprint, and `/health`
proof. It rejects localhost, IP-only, and non-HTTPS URLs.

`npm run readiness:schema-check` writes `artifacts/readiness/schema-check.json`
with SQLite `user_version`, migration ledger, and required table evidence.

`npm run readiness:session-security` writes
`artifacts/readiness/session-security.json` after logging in through the team
API and checking the session cookie attributes. In production, the release gate
requires the cookie evidence to show `HttpOnly`, `SameSite=Lax`, path `/`, a
signed value, max age of 12 hours or less, and the `Secure` flag over HTTPS.

`npm run readiness:release-gate` is the final release refusal gate. It fails
until provider approval, production HTTPS deployment/log evidence, domain/TLS,
signed webhook proof, database schema, production session-cookie security,
backup restore proof, and configured offsite backup proof are all present.

Before marking offsite backup ready:

```bash
BACKUP_SCHEDULE_STATUS=configured \
BACKUP_OFFSITE_TARGET_REF=<non-secret bucket/provider reference> \
BACKUP_FREQUENCY=<daily/cron reference> \
BACKUP_RETENTION=<retention policy> \
BACKUP_ENCRYPTION_REF=<kms/key policy reference> \
BACKUP_LAST_SUCCESSFUL_AT=<ISO timestamp> \
BACKUP_LAST_REF=<backup object, job, or run id> \
BACKUP_OPERATOR_REF=<operator or runbook reference> \
npm run readiness:backup-schedule
```

The command links the offsite schedule evidence to the latest restore-drill
checksum. Keep it pending until a real offsite target and successful backup run
exist.

Before marking the payment provider gate ready:

```bash
PROVIDER_NAME=asaas \
PROVIDER_APPROVAL_STATUS=approved \
PROVIDER_ACCOUNT_STATUS=<approved account status> \
PROVIDER_EVIDENCE_REF=<approval ticket or document> \
PROVIDER_TERMS_REF=<terms/version reviewed> \
PROVIDER_WEBHOOK_DOCS_REF=<provider webhook docs/version> \
PROVIDER_SETTLEMENT_NOTES=<fees and settlement note> \
npm run readiness:provider-evidence
```

Do not set `PROVIDER_APPROVAL_STATUS=approved` until business approval is
actually confirmed for the association use case.

The same provider fields can be registered from `/admin` by an admin user. The
server rejects an approved status unless provider, account status, approval
reference, terms, webhook docs, and settlement/fees notes are present.

For repeated local release checks, prefer:

```bash
LOG_EVIDENCE_REF=<log dashboard, deploy id, or release log path> \
npm run verify:isolated
```

That command starts a temporary server, SQLite database, and private document
directory, runs readiness drills plus smoke/E2E, then removes the temporary
data so shared local development evidence is not mutated.

## Local Data Reset

Smoke and browser E2E flows create patients, products, orders, documents, and
audit rows. For a clean local development URL after those checks:

```bash
DB_FILE=/tmp/associacao-verde-dev.sqlite \
DOCUMENT_STORAGE_DIR=/tmp/associacao-verde-dev-docs \
npm run dev:reset
```

The reset utility refuses `NODE_ENV=production`.

## Dev Environment

The redesign initiative introduced a long-running watchdog so the dev
server stays available across agent resets and short network blips. It is
**dev-only** and not used in production.

```bash
tmux new-session -d -s associacao-verde-watchdog \
  "bash scripts/dev-watchdog.sh"
```

Behavior:

- Listens on `:4184` (override with `PORT`).
- Uses `DB_FILE=/tmp/associacao-verde-dev.sqlite` and
  `DOCUMENT_STORAGE_DIR=/tmp/associacao-verde-dev-docs` by default.
- Logs to `/tmp/associacao-verde-dev.log`.
- Idempotent: each cycle skips if `/health` is already responsive.
- After a (re)start, runs `node scripts/add-dev-user.mjs` to ensure the
  TIAGO/TIAGO patient exists for quick agent and operator access.

`scripts/add-dev-user.mjs` is also runnable standalone:

```bash
node scripts/add-dev-user.mjs http://127.0.0.1:4184
```

Override credentials via `DEV_PATIENT_CODE`, `DEV_PATIENT_INVITE`, and
`DEV_PATIENT_NAME`.

## Endpoint Architecture

Every endpoint is a Next.js Route Handler under `app/api/<path>/route.js`.
The legacy `server.mjs` wrapper was deleted at the Stage 3 cutover
(`0f033d9`); the app now runs on `next start` (production) / `next dev`
(development) directly. `middleware.ts` owns origin/CSRF + protected-page
enforcement; `next.config.mjs::headers()` returns security headers on
every response. See `CLAUDE.md` for the full architectural boundaries.

## Schema Migrations

Migrations follow an append-only `SCHEMA_MIGRATIONS` array in
`src/sqlite-store.ts`. Current ledger:

```
{ 1,  initial_json_state_schema }
{ 15, support_messages_thread }
```

`recordMigration` loops the array. Future phases append entries; never
edit prior. `npm run readiness:schema-check` records the ledger,
`user_version`, and required-table evidence for the release gate.
