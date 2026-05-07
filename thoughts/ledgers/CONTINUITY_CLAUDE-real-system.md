# Session: real-system
Updated: 2026-05-07T22:25:54Z

## Goal
Build the real Apoiar/Associacao Verde cannabis association system from the validated MVP direction.

Done means:
- Patients can access a private purchase surface only when authorized.
- The association team can manage products, inventory, orders, patients, prescriptions, and fulfillment.
- A Brazilian payment gate is integrated, with Pix as the first payment method.
- Stock is reserved when an order is started and permanently decremented only after payment confirmation.
- The system has a deployable production architecture, tests for payment/stock/order flows, and a clear migration path from the current static prototype.

## Constraints
- Application context: an assistant-like daily operations system for a cannabis association; code/design must align with that operating model.
- Real access control is mandatory. GitHub Pages/noindex/code gate was only for a mock and is not acceptable for real patients.
- Patient purchase access must require association eligibility, active patient status, and valid prescription/card state.
- Payment and inventory must be server-side. Do not trust browser `localStorage` for real stock or order state.
- Product/payment compliance is a business/legal risk. Confirm payment provider acceptance before implementation.
- Keep Portuguese/Brazilian UX language and Apoiar reference tone: safe, legal, association/patient framing, green/white/yellow palette.
- Avoid building a public ecommerce catalog. The purchase surface should be invite/auth gated and not indexed.

## Key Decisions
- Static prototype remains a reference only. Real system should move to an app with backend persistence, auth, payments, and webhooks.
- Payment gate direction: start with Pix using a Brazilian-capable provider. Candidates from official docs:
  - Mercado Pago Checkout/API supports Pix with QR code/payment link for Brazil.
  - Asaas supports Pix billing, dynamic/static QR codes, billing notifications, webhooks, boleto/card options, and is Brazil-focused.
  - Pagar.me supports Pix transactions in Brazil and can be evaluated as an alternative.
- Inventory decision: do not permanently decrement stock on order draft. Create a reservation at checkout, expire unpaid reservations, and finalize stock decrement on confirmed payment webhook.
- MVP real system should prioritize Pix first, then boleto/card only after compliance/provider account validation.
- Current mock includes a demo access code, seeded products/orders, stock ledger, mobile layout, and stock decrement proof, but it has no real security.

## State
- Done: Transcribed latest WhatsApp audios from Downloads and extracted workflows.
- Done: Created static operations prototype in `index.html`, `styles.css`, `app.js`.
- Done: Created MVP-only sales/order mock in `mvp-apoiareserva-7f3c9.html`, `mvp.css`, `mvp.js`.
- Done: Published GitHub Pages repo under `tyagow/associacao-verde-prototype`.
- Done: Live MVP URL verified at `https://tyagow.github.io/associacao-verde-prototype/mvp-apoiareserva-7f3c9.html`.
- Done: Fixed access gate visibility/cache issue.
- Done: Strengthened mock with 6 fake products, 3 fake orders, stock dashboard, stock movement ledger, stock impact preview, data-version reset, and mobile-friendly cart.
- Done: Live mobile verification after commit `ffe2351`: stale demo data resets, 6 products visible, 3 orders visible, adding stock works, checkout subtracts stock, ledger records movements, no horizontal overflow.
- Now: Define real system architecture and implementation plan for private patient ordering plus Pix payment gate.
- Next: Choose stack and data model.
- Next: Validate payment provider compliance for cannabis association payments.
- Next: Implement auth/eligibility, product catalog, stock reservations, payment creation, webhook confirmation, and fulfillment dashboard.
- Next: Replace mock-only `localStorage` state with database-backed entities and tests.

## Open Questions
- UNCONFIRMED: Which GitHub/deploy target should host the real app: current `tyagow/associacao-verde-prototype`, a new private repo, Railway, Vercel, Render, or another provider?
- UNCONFIRMED: Preferred Brazilian payment provider. Recommendation to evaluate first: Asaas or Mercado Pago for Pix; final choice must consider CNPJ, provider terms, webhook reliability, settlement, fees, and cannabis/association acceptance.
- UNCONFIRMED: Whether payment should be Pix only for launch, or Pix plus boleto/card.
- UNCONFIRMED: Whether stock should reserve for a fixed window such as 15 minutes, 30 minutes, or until payment expiry.
- UNCONFIRMED: Whether patient eligibility data will be created inside this system or imported from Apoiar/D9/existing spreadsheets.
- UNCONFIRMED: Required prescription document handling, LGPD posture, audit logging, and medical/legal compliance requirements.
- UNCONFIRMED: Shipping integration target: Melhor Envio/GED Log first, manual fulfillment first, or both.

## Working Set
- Branch: `main`
- Repo: `git@github-tyagow:tyagow/associacao-verde-prototype.git`
- Live prototype: `https://tyagow.github.io/associacao-verde-prototype/`
- Live MVP mock: `https://tyagow.github.io/associacao-verde-prototype/mvp-apoiareserva-7f3c9.html`
- Latest relevant commit: `ffe2351 Strengthen MVP stock and mobile flow`
- Key mock files:
  - `mvp-apoiareserva-7f3c9.html`
  - `mvp.css`
  - `mvp.js`
  - `README.md`
  - `docs/audio-requirements.md`
- Local smoke commands:
  - `python3 -m http.server 4173`
  - `node --check mvp.js`
- Verified behavior:
  - Access code: `APOIAR2026`
  - Stock add: example Gomas CBD `+3 cx` or `+12 cx`
  - Checkout decrement: example Flor 24k `92 g -> 91 g`
  - Mobile viewport tested: `390x844`

## Real System Sketch
- Frontend: private patient ordering UI plus team operations dashboard.
- Backend: authenticated API for products, inventory, patients, prescriptions, carts/orders, payment creation, webhooks, and fulfillment.
- Database entities:
  - `patients`, `guardians`, `prescriptions`, `memberships`
  - `products`, `inventory_lots`, `stock_movements`, `stock_reservations`
  - `orders`, `order_items`, `payments`, `payment_events`
  - `shipments`, `audit_log`
- Payment flow:
  1. Patient logs in or opens signed invite link.
  2. API checks active association membership and valid prescription.
  3. Patient creates cart.
  4. API creates stock reservation and Pix payment.
  5. Payment provider returns QR code / copia-e-cola / payment URL.
  6. Webhook confirms paid status.
  7. API marks order paid, converts reservation into final stock movement, and queues fulfillment.
  8. Unpaid/expired payment releases reservation.

