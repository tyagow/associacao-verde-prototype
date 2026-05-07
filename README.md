# Associacao Verde Prototype

Static browser prototype for a cannabis association operations system, based on the latest WhatsApp audios in `~/Downloads` from 2026-05-07.

## What It Demonstrates

- Patient and responsible-party registration.
- Prescription validity tracking for member card expiration.
- Member card preview and issuance workflow.
- Cultivation batches by week, harvest weight, dry weight, and stock entry.
- Inventory that decreases when an order is created.
- Order workflow from payment to separation, shipping label, and sent status.
- Shipping placeholder for Melhor Envio / GED Log.
- Medical triage placeholder for an online AI-assisted Anvisa-oriented flow.

All data is demo-only and stored in browser `localStorage`.

## Run Locally

```bash
python3 -m http.server 4173
```

Open:

```text
http://127.0.0.1:4173
```

## Best Way To Share With A Client

Use Netlify for the first client review because this is a static prototype with no build step.

1. Go to Netlify and create a new static site.
2. Drag this folder into Netlify Drop, or connect a GitHub repository.
3. Share the generated HTTPS URL with the client.

For a more polished review, connect a GitHub repo and add a custom subdomain such as:

```text
demo.associacaoverde.com.br
```

## Demo Script

1. Start on the dashboard and show the operational queue.
2. Open `Pacientes` and show responsible-party registration plus prescription validity.
3. Show the member card preview, which uses the prescription date as validity.
4. Open `Plantio` and advance a batch through weeks, harvest, dry weight, and stock.
5. Open `Pedidos`, create a new order, and show the stock decreasing immediately.
6. Advance the order through payment, separation, Melhor Envio, and sent.
7. Open `Triagem` to show the integration slot for the medical platform.

