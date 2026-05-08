"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import styles from "./OrderCard.module.css";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/**
 * Phase 5 — single fulfillment card. Sortable + draggable wrapper around
 * the order summary the operator needs at a glance: patient name, items,
 * shipment carrier (or "Sem envio"), tracking code, and the per-card
 * action button surfaced by the column ("Imprimir etiqueta" for ready,
 * "Marcar enviado" for paid_pending_fulfillment, etc.).
 *
 * The card itself doesn't trigger status transitions — those happen at
 * the Kanban level via dnd-kit's onDragEnd handler. We expose the
 * useSortable hooks (`attributes`, `listeners`) on the card root so the
 * whole card is the drag affordance.
 */
export default function OrderCard({ order, onPrintLabel }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: order.id,
    data: { kind: "order", status: order.status },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  const items = order.items
    .map((item) => `${item.quantity} ${item.unit} ${item.name}`)
    .join(" · ");

  const showLabel = order.status === "ready_to_ship";

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`${styles.txCard} ${isDragging ? styles.txCardDragging : ""}`.trim()}
      data-order-id={order.id}
      data-status={order.status}
      {...attributes}
      {...listeners}
    >
      <header className={styles.txCardHeader}>
        <strong>{order.patientName}</strong>
        <span className={styles.txCardId}>#{order.id.slice(-6)}</span>
      </header>
      <p className={styles.txCardItems}>{items}</p>
      <footer className={styles.txCardFooter}>
        <span className={styles.txCardFreight}>
          {order.shipment?.carrier
            ? `${order.shipment.carrier} · ${order.shipment.trackingCode || "sem rastreio"}`
            : "Sem envio"}
        </span>
        <span className={styles.txCardTotal}>{money.format(order.totalCents / 100)}</span>
      </footer>
      {showLabel ? (
        <button
          type="button"
          className={`mini ${styles.txCardAction}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onPrintLabel?.(order);
          }}
        >
          Imprimir etiqueta
        </button>
      ) : null}
    </article>
  );
}
