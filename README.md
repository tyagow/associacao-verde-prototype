# Associacao Verde Production Application

Production private operations system for Apoiar/Associacao Verde.

This repository is the full authenticated production application for the
association. It is not a repackaging of the archived browser-only reference:
the production application is the private Next.js app served at `/` with
production surfaces such as `/paciente`, `/equipe`, `/equipe/pacientes`,
`/equipe/estoque`, `/equipe/pedidos`, `/equipe/fulfillment`,
`/equipe/suporte`, and `/admin`.

## Production Scope

Current status: this is a full production application track under active
development, not a temporary demo or single-page reference. Progress is measured
against the patient, team, payment,
inventory, compliance, deployment, and QA gates tracked in:

```text
docs/production-delivery-plan.md
```

The production application implements:

- Private patient ordering with server-side session cookies.
- Patient eligibility checks before catalog access and checkout:
  association eligibility, active patient status, valid prescription, and valid
  association card.
- Team operations for patients, prescriptions/card validity, products,
  inventory, orders, payments, and fulfillment.
- SQLite-backed persistence with entity tables for patients, products, sessions,
  stock reservations, stock movements, orders, payments, payment events, and
  audit log.
- Stock reservation at checkout and permanent stock decrement only after Pix
  payment confirmation.
- Pix provider abstraction with local `dev-pix` and an Asaas adapter.
- Signed webhook gate for payment confirmation.
- Production refuses to boot with local `dev-pix`; `PAYMENT_PROVIDER=asaas` is
  required for `NODE_ENV=production`.
- Production startup gates for required secrets.

## Run Locally

```bash
npm start
```

Open:

```text
http://127.0.0.1:4174/
```

Local development credentials:

```text
Equipe email: equipe@apoiar.local
Paciente: APO-1027 / HELENA2026
Equipe senha: apoio-equipe-dev
Webhook Pix: x-webhook-secret: dev-webhook-secret
```

Local defaults are intentionally development-only. `NODE_ENV=production` fails
closed unless required secrets are provided.

To clear local development data after smoke/E2E runs:

```bash
DB_FILE=/tmp/associacao-verde-dev.sqlite \
DOCUMENT_STORAGE_DIR=/tmp/associacao-verde-dev-docs \
npm run dev:reset
```

The reset command refuses to run when `NODE_ENV=production`.

## Production Configuration

Required:

```text
NODE_ENV=production
DB_FILE=/persistent/associacao-verde.sqlite
TEAM_PASSWORD=<strong team password>
TEAM_EMAIL=<initial admin email>
SESSION_SECRET=<long random cookie signing secret>
PIX_WEBHOOK_SECRET=<provider webhook secret>
```

For Asaas Pix after account/compliance approval:

```text
PAYMENT_PROVIDER=asaas
ASAAS_API_KEY=<asaas access token>
ASAAS_CUSTOMER_ID=<default Asaas customer id for initial rollout>
ASAAS_BASE_URL=https://api.asaas.com/v3
```

The Asaas adapter creates a `billingType: PIX` charge, retrieves
`/payments/{id}/pixQrCode`, stores the provider payment id, and still only
converts the stock reservation after the signed webhook confirms payment.

## Verify

```bash
npm run check
npm test
npm run readiness:backup-drill
npm run readiness:webhook-drill
LOG_EVIDENCE_REF=<release log reference> npm run readiness:deployment-check
READINESS_DOMAIN_URL=https://<production-domain> npm run readiness:domain-tls
DB_FILE=<current sqlite path> npm run readiness:schema-check
READINESS_BASE_URL=<running app URL> npm run readiness:session-security
npm run readiness:backup-schedule
npm run readiness:release-gate
npm run smoke
npm run e2e
npm run verify:isolated
```

`npm run check` includes a Next.js production build for the private route set.

`npm run readiness:backup-drill` creates a consistent SQLite backup, loads it
through the application store, and writes non-secret restore evidence for
`/admin` and `/api/team/readiness`.

`npm run readiness:webhook-drill` creates an isolated local order, proves an
unsigned Pix webhook is rejected, proves a signed webhook confirms payment and
decrements stock, and writes non-secret evidence for `/admin`.

`npm run readiness:deployment-check` verifies the release URL health endpoint,
protected-route redirect, sessionless catalog denial, and security headers. Use
`LOG_EVIDENCE_REF` to attach the log source reviewed for the release.

`npm run readiness:domain-tls` verifies the production URL uses HTTPS, a public
hostname, a trusted certificate, and a healthy `/health` response. Localhost and
plain HTTP URLs are rejected and keep the `Dominio/TLS` gate pending.

`npm run readiness:schema-check` records SQLite `user_version`, migration
ledger, and required table evidence for `/admin` and the release gate.

`npm run readiness:session-security` logs in through the team path and records
non-secret cookie evidence. Local HTTP can prove the cookie is signed,
`HttpOnly`, `SameSite=Lax`, path-scoped, and bounded by a 12-hour max age;
production release remains blocked until the same check proves a `Secure`
cookie on HTTPS.

`npm run readiness:release-gate` fails until provider approval, production
HTTPS deployment/log evidence, domain/TLS, signed webhook proof, database
schema, production session-cookie security, backup restore proof, and configured
offsite backup proof are all present.

`npm run readiness:backup-schedule` records non-secret offsite backup schedule
evidence. It remains pending unless an offsite target, frequency, retention,
encryption reference, last successful backup, last backup reference, operator,
and restore-drill checksum are present. Admin users can record provider and
offsite backup evidence from `/admin`; approved/configured statuses are rejected
unless the required proof fields are complete.

`npm run e2e` starts an isolated temporary server/database when `E2E_BASE_URL`
is not set, runs the browser checks, and writes visual evidence under
`artifacts/visual-e2e/`.

`npm run verify:isolated` starts a temporary local server with its own SQLite
database and private document directory, runs readiness drills, smoke, and E2E,
then removes the temporary data. Use it for repeated release verification so
the shared dev URL is not mutated.

GitHub Actions runs the same production verification in
`.github/workflows/production-ci.yml`.

## Deployable Runtime

The repository includes a verified production `Dockerfile` and production
runbook:

```text
docs/production-runbook.md
```

The production health endpoint is:

```text
GET /health
```

## Migration From Archived Reference Data

The production import path is documented in:

```text
docs/migration-from-archive.md
```

Executable importer:

```bash
npm run import:archive -- <archive-export.json> <target.sqlite>
```

## Archived Reference Files

The following files are retained only as archived reference material and are not
the production application:

- `index.html`, `styles.css`, `app.js`
- `archived-ordering-reference.html`, `archived-ordering-reference.css`, `archived-ordering-reference.js`
- `docs/audio-requirements.md`
