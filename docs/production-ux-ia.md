# Production UX Information Architecture

This is the UX map for the Associacao Verde/Apoiar production app. It is
written for the working production product and its patient, team, payment,
inventory, fulfillment, compliance, and admin surfaces.

## Product Principle

The application is a private daily operations system for a cannabis
association. It must feel calm, secure, and useful for repeated work:

- Patients should see only what they are allowed to do now.
- Team members should see the operational queue before forms and details.
- Payment and stock states must be explicit because mistakes affect money,
  medicine access, and inventory.
- The site must avoid public ecommerce language and search-indexable catalog
  behavior.

## Primary Users

**Patient**

- Has a member code and private invite.
- Needs to know whether access is allowed, why it might be blocked, what can be
  requested, and how to pay by Pix.
- Mostly uses mobile.

**Team operator**

- Handles patient access, prescriptions, product stock, Pix/order state, and
  fulfillment during the day.
- Needs a dashboard that prioritizes exceptions and next actions.

**Administrator**

- Manages team access, provider configuration, audit, backups, and release
  readiness.
- Needs evidence, logs, and controls before production launch.

## Navigation Model

The production app must expose production application surfaces. A single long
page is not acceptable for the final product. The current route set is owned by
Next.js so every main area has a professional URL and route boundary.

Required route surfaces:

- `/paciente`: private patient portal, eligibility, catalog, Pix, order history.
- `/equipe`: team command center and daily operational queues.
- `/equipe/pacientes`: patient records, access lifecycle, member cards,
  prescription status, support context.
- `/equipe/estoque`: products, stock, cultivation batches, lots, and movements.
- `/equipe/pedidos`: order reservations, Pix/payment state, reconciliation.
- `/equipe/fulfillment`: picking, packing, shipment, carrier/tracking status.
- `/equipe/suporte`: patient support context across eligibility, latest order,
  payment, shipment, documents, and access blockers.
- `/admin`: team users, roles, audit, payment-provider readiness, production
  gates, backup/restore status.

No legacy alias should be used as the product URL.

## Patient Flow

1. Patient opens `/paciente`.
2. Patient signs in with member code and invite.
3. Server validates active patient, association eligibility, prescription, and
   member card.
4. If blocked, patient sees the exact access problem and support direction.
5. If allowed, patient sees a private catalog with available stock.
6. Patient selects quantities.
7. Server reserves stock and creates Pix.
8. Patient sees order number, Pix copia-e-cola, payment expiry, and delivery
   method.
9. Provider webhook confirms payment.
10. Patient sees paid/fulfillment/shipment status.

Required patient screens:

- Private access screen.
- Eligibility status panel.
- Product request list.
- Cart/reservation summary.
- Pix payment state.
- Order history and shipment state.

## Team Flow

1. Team signs in.
2. Workspace opens on an operations summary, not on data-entry forms.
3. Team sees daily queues:
   - Pix pending.
   - Paid orders awaiting separation.
   - Low stock and active reservations.
   - Blocked patients or expiring prescriptions/cards.
   - Shipments needing tracking.
4. Team handles the queue, then uses management forms for corrections and new
   records.

Required team screens:

- Daily command center.
- Orders and Pix reconciliation.
- Patients, prescriptions, and member cards.
- Products and stock.
- Cultivation and inventory lots.
- Fulfillment and shipments.
- Support context without database access.
- Audit and admin readiness.

## Screen Priorities For Current Build

1. Add route-level surfaces for the required production areas.
2. Keep `/` and the professional route set as the only product URLs.
3. Put patient and team status cards above forms.
4. Group team forms into the correct route surfaces instead of one long wall.
5. Show metrics and queues before management forms.
6. Make mobile forms one-column and keep action buttons readable.
7. Keep all text Portuguese-first and association/patient framed.

## UX Acceptance Criteria

- First viewport communicates this is the private system and offers route
  paths for patient and team operations immediately.
- No production screen presents archived browser-only pages as the product.
- App has distinct surfaces for patient, command center, patients, inventory,
  orders/payments, fulfillment, support, and admin readiness.
- Patient login, catalog, checkout, Pix, and order status are usable on a
  390px-wide mobile viewport.
- Team dashboard is scannable on desktop without reading every form.
- Form groups have clear operational labels.
- Buttons use concrete commands, not vague labels.
- Error/toast messages explain the next action.
- Screenshots exist for patient and team flows before release.
