"use client";

/* Phase 4 — Order detail drawer (in-flow right rail).

   Replaces the previous framer-motion slide-over with a sticky panel that
   sits in the orders grid (sibling of #orders-surface, NOT inside it — the
   E2E test scopes its [data-pay] selector to #orders-surface).

   Always rendered. Empty state when no subject is selected. Pix-pending
   subjects show a primary "Confirmar Pix" button (also carries data-pay,
   but lives outside #orders-surface so it does not collide with the row's
   data-pay button that the E2E clicks first).
*/

import styles from "./OrderDrawer.module.css";

const moneyFmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default function OrderDrawer({
  order,
  payment,
  busyKey,
  onClose,
  onCancelOrder,
  onPaymentAction,
}) {
  if (!order && !payment) {
    return (
      <aside className={`panel ${styles.drawer}`}>
        <header className="ph">
          <h3>Detalhes</h3>
        </header>
        <div
          className="adm-empty-state"
          style={{ border: 0, background: "transparent", minHeight: 120 }}
        >
          <span className="adm-empty-state__title">Sem pedido selecionado</span>
          <span className="adm-empty-state__hint">
            Escolha um pedido na fila para ver itens, pagamento e proximos passos.
          </span>
        </div>
      </aside>
    );
  }

  const subjectId = order?.id || payment?.orderId;
  const items = order?.items || [];
  const subtotalCents =
    items.reduce((s, it) => s + (it.subtotalCents || 0), 0) || order?.totalCents || 0;
  const totalCents = order?.totalCents || subtotalCents;
  const cancelable =
    order &&
    ["awaiting_payment", "paid_pending_fulfillment", "separating", "ready_to_ship"].includes(
      order.status,
    );
  const payBusy = busyKey === `pay:${payment?.id}`;

  return (
    <aside className={`panel ${styles.drawer}`}>
      <header className="ph">
        <h3>
          {subjectId} {order?.patientName ? `· ${order.patientName}` : ""}
        </h3>
        <button type="button" className="iconbtn" aria-label="fechar" onClick={onClose}>
          ×
        </button>
      </header>

      <div className={styles.row}>
        <span className={styles.lbl}>Status</span>
        <span className={styles.val}>
          <span className="pill warn">{order?.status || "aguardando pgto"}</span>
        </span>
      </div>
      {payment ? (
        <>
          <div className={styles.row}>
            <span className={styles.lbl}>Pix</span>
            <span className={`${styles.val} mono`}>{payment.providerPaymentId || payment.id}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.lbl}>Vencimento</span>
            <span className={styles.val}>{formatDateTime(payment.expiresAt)}</span>
          </div>
        </>
      ) : null}
      {order?.shipment ? (
        <div className={styles.row}>
          <span className={styles.lbl}>Entrega</span>
          <span className={styles.val}>
            {order.shipment.carrier || "—"}
            {order.shipment.region ? ` · ${order.shipment.region}` : ""}
          </span>
        </div>
      ) : null}

      {items.length ? (
        <div className={styles.lineitems}>
          {items.map((item, idx) => {
            const unit =
              item.unitPriceCents ||
              (item.quantity ? Math.round((item.subtotalCents || 0) / item.quantity) : 0);
            return (
              <div key={idx} className={styles.li}>
                <div className={styles.thumb}>{monogram(item.name)}</div>
                <div>
                  <div style={{ fontWeight: 600 }}>{item.name}</div>
                  <div style={{ color: "var(--muted)", fontSize: 11 }}>
                    {item.quantity}× {moneyFmt.format(unit / 100)}
                  </div>
                </div>
                <div className="num" style={{ fontWeight: 600 }}>
                  {moneyFmt.format((item.subtotalCents || 0) / 100)}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className={styles.row}>
        <span className={styles.lbl}>Subtotal</span>
        <span className={`${styles.val} num`}>{moneyFmt.format(subtotalCents / 100)}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.lbl}>Frete</span>
        <span className={styles.val}>incluso no Pix</span>
      </div>
      <div className={styles.row} style={{ borderBottom: 0 }}>
        <span className={styles.lbl}>
          <strong>Total</strong>
        </span>
        <span className={`${styles.val} num`} style={{ fontSize: 16 }}>
          <strong>{moneyFmt.format(totalCents / 100)}</strong>
        </span>
      </div>

      <div className={styles.actionsRow}>
        {payment ? (
          <button
            type="button"
            className="btn primary"
            data-pay={payment.id}
            disabled={payBusy}
            style={{ flex: 1 }}
            onClick={() => onPaymentAction?.(payment.id, "pay")}
          >
            {payBusy ? "Simulando…" : "Confirmar Pix"}
          </button>
        ) : null}
        {cancelable ? (
          <form
            onSubmit={(event) => onCancelOrder?.(event, order.id)}
            style={{ display: "inline" }}
          >
            <input type="hidden" name="reason" value="Cancelamento via drawer" />
            <button type="submit" className="btn ghost">
              Cancelar
            </button>
          </form>
        ) : null}
      </div>
    </aside>
  );
}

function monogram(name) {
  return (name || "?")
    .replace(/[^A-Za-zÀ-ÿ]/g, "")
    .slice(0, 2)
    .toUpperCase();
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}
