"use client";

import { useState } from "react";
import styles from "./HistoryList.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatDateTime(value) {
  if (!value) return "sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

const STATUS_LABEL = {
  awaiting_payment: "Pix pendente",
  paid_pending_fulfillment: "Pago, aguardando separacao",
  separating: "Em separacao",
  ready_to_ship: "Pronto para envio",
  sent: "Enviado",
  payment_expired: "Pagamento expirado",
};

const STATUS_TEXT = {
  awaiting_payment: "Pix aguardando pagamento. A reserva fica ativa ate o vencimento.",
  paid_pending_fulfillment: "Pagamento confirmado. Equipe preparando separacao.",
  separating: "Pedido em separacao pela equipe.",
  ready_to_ship: "Pedido pronto para envio ou retirada.",
  sent: "Pedido enviado.",
  payment_expired: "Pagamento expirou. Gere um novo pedido para reservar estoque novamente.",
};

function statusTone(status) {
  if (status === "awaiting_payment") return "warn";
  if (status === "payment_expired") return "danger";
  return "";
}

/**
 * History tab list. Wraps #patient-orders. Compact rows, click-to-expand.
 * E2E only asserts that the container with id="patient-orders" exists; the
 * inner shape is free to evolve.
 */
export default function HistoryList({ orders }) {
  return (
    <section id="patient-orders" className={styles["px-history"]}>
      <header className={styles["px-history__head"]}>
        <span className="overline">Historico</span>
        <h3>Historico de pedidos</h3>
      </header>
      {orders.length ? (
        <ul className={styles["px-history__list"]}>
          {orders.map((order) => (
            <HistoryRow order={order} key={order.id} />
          ))}
        </ul>
      ) : (
        <p className="muted">Nenhum pedido criado nesta conta.</p>
      )}
    </section>
  );
}

function HistoryRow({ order }) {
  const [open, setOpen] = useState(false);
  const tone = statusTone(order.status);
  return (
    <li className={`${styles["px-history__row"]} ${open ? styles["is-open"] : ""}`}>
      <button
        type="button"
        className={styles["px-history__summary"]}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <div className={styles["px-history__id"]}>
          <strong>{order.id}</strong>
          <span className={`pill ${tone}`.trim()}>
            {STATUS_LABEL[order.status] || "Em revisao"}
          </span>
        </div>
        <span className={styles["px-history__money"]}>{money.format(order.totalCents / 100)}</span>
      </button>
      {open ? (
        <div className={styles["px-history__detail"]}>
          <p>{STATUS_TEXT[order.status] || "Status em revisao pela equipe."}</p>
          {order.items?.length ? (
            <ul className={styles["px-history__items"]}>
              {order.items.map((item, index) => (
                <li key={`${item.productId || item.name}-${index}`}>
                  {item.quantity} {item.unit || "un"} · {item.name}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="muted">
            {order.deliveryMethod || "Entrega a combinar"}
            {order.paymentExpiresAt ? ` · Pix vence ${formatDateTime(order.paymentExpiresAt)}` : ""}
            {order.shipment
              ? ` · ${order.shipment.carrier} ${order.shipment.trackingCode || ""}`
              : ""}
          </p>
        </div>
      ) : null}
    </li>
  );
}
