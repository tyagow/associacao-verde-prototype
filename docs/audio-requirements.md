# Audio-Derived Requirements

Source: latest WhatsApp audio files in `~/Downloads`, all dated 2026-05-07 between 18:35 and 18:38.

## Extracted Workflow

1. Planting system
   - Register seed entry.
   - Track the plant week by week.
   - Advance a batch to the next cultivation week.
   - Register harvested weight.
   - Register dry weight.
   - Move dry product out to stock.

2. Inventory and orders
   - Keep stock by product/cultivar.
   - Creating an order must reduce stock.
   - Online order creation should not require manual order-by-order work.
   - Payment integration is required in the production system; the reference shows the payment stage.
   - Shipping integration with Melhor Envio / GED Log is required in the production system; the reference shows the label stage.

3. Patient and responsible-party registration
   - Store patient records.
   - Store responsible-party records when a parent or guardian registers a child.
   - Save the prescription in the patient record.
   - Store prescription validity.

4. Member card
   - Member card validity must follow the prescription validity.
   - The system should include a space to issue the association member card.

5. Medical triage platform
   - Medical care and triage will be online.
   - The triage should follow Anvisa-oriented requirements.
   - AI assistance is planned.
   - This reference reserves the triage surface and shows the expected handoff back into the patient/prescription record.

## Archived Reference Coverage

The archived browser reference captured the original requirement sketch:

- `index.html`: application structure and screens.
- `styles.css`: responsive visual system.
- `app.js`: demo data, local persistence, patient creation, batch advancement, harvest/dry stock logic, order creation, stock decrement, and order status transitions.

The reference does not include production authentication, payment processing, Melhor Envio API calls, document uploads, or medical AI. Those are represented as workflow stages for client validation.
