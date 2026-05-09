"use client";

/* Phase 4 — Ledger row.

   Single <tr> with cells: Pedido (mono ID) · Paciente · Itens (count) ·
   SLA/Pix label · Status pill · Total (right-aligned num) · action cell.
   Pix-pending rows render <button data-pay={paymentId}>Pagar</button> in the
   action cell (E2E selector). Clicking the row body opens the drawer; the
   action cell stops propagation.
*/

import styles from "./OrderRow.module.css";

const moneyFmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default function OrderRow({ order, payment, busyKey, selected, onOpen, onPay }) {
  const status = orderStatusDescriptor(order.status);
  const sla = slaLabel(order, payment);
  const itemCount = (order.items || []).reduce((s, it) => s + (it.quantity || 1), 0);
  const isPending = order.status === "awaiting_payment" && payment;
  const payBusy = busyKey === `pay:${payment?.id}`;

  return (
    <tr
      className={selected ? styles.selected : undefined}
      onClick={onOpen}
      data-row-status={order.status}
    >
      <td>
        <span className="mono">{order.id}</span>
      </td>
      <td>
        <div className="who">
          <span className="name">{order.patientName || "Paciente"}</span>
          {order.patientCode ? <span className="meta">{order.patientCode}</span> : null}
        </div>
      </td>
      <td>
        {itemCount} {itemCount === 1 ? "item" : "itens"}
      </td>
      <td>
        <span className={`num ${sla.tone ? styles[`sla_${sla.tone}`] : ""}`.trim()}>
          {sla.label}
        </span>
      </td>
      <td>
        <span className={`pill ${status.tone || ""}`.trim()}>{status.label}</span>
      </td>
      <td className="right num">{moneyFmt.format((order.totalCents || 0) / 100)}</td>
      <td onClick={(e) => e.stopPropagation()}>
        {isPending ? (
          <button
            type="button"
            className="btn ghost mini"
            data-pay={payment.id}
            disabled={payBusy}
            onClick={() => onPay(payment.id)}
          >
            {payBusy ? "…" : "Pagar"}
          </button>
        ) : (
          <button type="button" className={styles.openLink} onClick={onOpen}>
            abrir →
          </button>
        )}
      </td>
    </tr>
  );
}

function slaLabel(order, payment) {
  if (payment && payment.expiresAt) {
    const ms = new Date(payment.expiresAt).getTime() - Date.now();
    if (ms <= 0) return { label: "expirado", tone: "danger" };
    const min = Math.floor(ms / 60000);
    if (min >= 60) return { label: `${Math.floor(min / 60)}h ${min % 60}m`, tone: "warn" };
    const seconds = Math.floor((ms % 60000) / 1000);
    return {
      label: `vence em ${String(min).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
      tone: min < 5 ? "danger" : "warn",
    };
  }
  if (order.status === "sent") return { label: "enviado", tone: "good" };
  if (order.status === "payment_expired") return { label: "expirou", tone: "danger" };
  if (order.paidAt) {
    return {
      label: `pago ${new Date(order.paidAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
      tone: "good",
    };
  }
  return { label: "—" };
}

function orderStatusDescriptor(status) {
  const labels = {
    awaiting_payment: "aguardando",
    paid_pending_fulfillment: "pago — fulfillment",
    separating: "em separação",
    ready_to_ship: "pronto",
    sent: "enviado",
    payment_expired: "expirado",
    cancelled: "cancelado",
    fulfillment_exception: "exceção",
  };
  let tone = "";
  if (status === "sent" || status === "ready_to_ship" || (status && status.startsWith("paid")))
    tone = "ok";
  else if (
    status === "payment_expired" ||
    status === "cancelled" ||
    status === "fulfillment_exception"
  )
    tone = "danger";
  else if (status === "awaiting_payment" || status === "separating") tone = "warn";
  return { label: labels[status] || status, tone };
}
