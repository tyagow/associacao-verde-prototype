"use client";

import OrderTimeline from "./OrderTimeline";
import styles from "./OrderPaidHero.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

const timeFmt = new Intl.DateTimeFormat("pt-BR", {
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

function monogram(name) {
  if (!name) return "AV";
  const trimmed = String(name).trim();
  if (!trimmed) return "AV";
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.[0] || "";
  const second = parts[1]?.[0] || trimmed[1] || "";
  return (first + second).toUpperCase().slice(0, 2);
}

// Default narrative sublines for each timeline stage. Mock b4.html shows these
// hand-authored descriptions on every paid-order timeline; live previously
// rendered only the timestamp. These descriptions are factually true regardless
// of timestamps so we can render them whenever the stage is done OR current.
const DEFAULT_SUBLINES = {
  "pix-generated": (order) => {
    const total = (order?.totalCents || 0) / 100;
    return `${money.format(total)} · vencimento em 15min`;
  },
  "awaiting-payment": () => null,
  confirmed: () => "Webhook do banco recebido",
  picking: () => "Equipe está conferindo lotes e validando carteirinha",
  shipped: () => "Rastreio será enviado por aqui e e-mail",
};

function inferCurrentStage(status) {
  switch (status) {
    case "paid_pending_fulfillment":
    case "separating":
      return "picking";
    case "ready_to_ship":
      return "picking";
    case "sent":
    case "shipped":
      return "shipped";
    default:
      return "confirmed";
  }
}

export default function OrderPaidHero({ order, events = [] }) {
  if (!order) return null;
  const items = order.items || [];
  const totalCents = order.totalCents || 0;
  const orderId = order.id || "";
  const delivery = order.deliveryMethod || "Entrega a combinar";
  const paidAt = order.paidAt || order.confirmedAt || null;
  const trackingCode = order.trackingCode || orderId;

  const current = inferCurrentStage(order.status);

  // Stage order for "is this stage done or current?" — must match
  // OrderTimeline's STAGES array.
  const STAGE_ORDER = ["pix-generated", "awaiting-payment", "confirmed", "picking", "shipped"];
  const currentIdx = STAGE_ORDER.indexOf(current);

  // Build timestamps + subtitles from events list (or fall back to known order fields).
  const timestamps = {};
  const subtitles = {};
  for (const ev of events) {
    if (!ev || !ev.key) continue;
    if (ev.at) {
      const date = new Date(ev.at);
      timestamps[ev.key] = Number.isNaN(date.getTime()) ? String(ev.at) : timeFmt.format(date);
    }
    if (ev.subline) subtitles[ev.key] = ev.subline;
  }
  // Layer in default narrative sublines for done/current stages where the
  // event payload didn't carry an explicit one. Matches mock b4.html.
  for (const [key, factory] of Object.entries(DEFAULT_SUBLINES)) {
    if (subtitles[key]) continue;
    const idx = STAGE_ORDER.indexOf(key);
    if (idx === -1 || idx > currentIdx) continue;
    const text = factory(order);
    if (text) subtitles[key] = text;
  }

  const statusLabel =
    {
      paid_pending_fulfillment: "pago, aguardando separacao",
      separating: "pago, em separacao",
      ready_to_ship: "pronto para envio",
      sent: "enviado",
      shipped: "enviado",
    }[order?.status] || "pago";

  return (
    <section className={styles["op-wrap"]} aria-label="Pedido pago">
      {orderId ? (
        <p className={styles["op-breadcrumb"]}>
          Pedido <b>{orderId}</b> · {statusLabel}
        </p>
      ) : null}
      <header className={styles["op-hero"]}>
        <div className={styles["op-check"]} aria-hidden="true">
          ✓
        </div>
        <div className={styles["op-headline"]}>
          <span className={styles["op-kicker"]}>Pagamento confirmado</span>
          <h1 className={styles["op-h1"]}>Recebemos o seu Pix</h1>
          <p className={styles["op-lead"]}>
            A equipe está separando o pedido. Você receberá o código de rastreio aqui assim que o
            envio for despachado.
          </p>
        </div>
        <div className={styles["op-receipt"]}>
          {orderId ? <div className={styles["op-receipt-id"]}>{orderId}</div> : null}
          <div>
            Pago em <b>{paidAt ? dateTimeFmt.format(new Date(paidAt)) : "—"}</b>
          </div>
          <div>
            Total <b>{money.format(totalCents / 100)}</b>
          </div>
        </div>
      </header>

      <div className={styles["op-body"]}>
        <section className={styles["op-panel"]}>
          <h2 className={styles["op-panel-h"]}>Status do pedido</h2>
          <p className={styles["op-panel-sub"]}>
            Atualizamos automaticamente conforme a equipe avança.
          </p>
          <OrderTimeline current={current} subtitles={subtitles} timestamps={timestamps} />
        </section>

        <aside className={styles["op-side"]}>
          <div className={styles["op-card"]}>
            <h3 className={styles["op-card-h"]}>
              {items.length} {items.length === 1 ? "produto" : "produtos"} ·{" "}
              {money.format(totalCents / 100)}
            </h3>
            {items.map((item, index) => {
              const subtotal =
                item.subtotalCents != null
                  ? item.subtotalCents
                  : (item.unitPriceCents || 0) * item.quantity;
              return (
                <div
                  className={styles["op-item-line"]}
                  key={`${item.productId || item.name}-${index}`}
                >
                  <div className={styles["op-sq"]} aria-hidden="true">
                    {monogram(item.name)}
                  </div>
                  <div className={styles["op-item-text"]}>
                    <div className={styles["op-item-name"]}>{item.name}</div>
                    <div className={styles["op-item-qty"]}>
                      {item.quantity} {item.unit || "un"}
                    </div>
                  </div>
                  <div className={styles["op-item-price"]}>{money.format(subtotal / 100)}</div>
                </div>
              );
            })}
            <div className={styles["op-total-row"]}>
              <span>Total</span>
              <span>{money.format(totalCents / 100)}</span>
            </div>
          </div>

          <div className={styles["op-ship-card"]}>
            <label>Entrega</label>
            <b>{delivery}</b>
            <p className={styles["op-ship-track"]}>
              Rastreio aparecerá aqui: <span className={styles["op-track"]}>{trackingCode}</span>
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
