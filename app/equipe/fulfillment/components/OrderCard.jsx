"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import styles from "./OrderCard.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// Map card tone → global .surface--bordered-left-* primitive (left accent).
const TONE_BORDER = {
  urgent: "surface--bordered-left-warn",
  danger: "surface--bordered-left-danger",
  ok: "surface--bordered-left-ok",
  info: "surface--bordered-left-info",
};

// Map status pill tone → global .pill--* modifier.
const PILL_TONE = {
  ok: "pill--good",
  warn: "pill--warn",
  danger: "pill--danger",
  info: "pill--info",
  "": "pill--neutral",
};

/**
 * Phase 5 (revamp) — fulfillment card, b-fulfillment.html visual.
 *
 * Markup: paper bg, 1px line border, 3px radius. Top: mono ID + tone pill.
 * Body: patient name (600) + meta. Footer: timestamp (muted) + total (tabular).
 * Tone classes (`urgent` warn / `danger` / `ok`) add a 3px left border.
 *
 * dnd-kit useSortable wiring + the `Imprimir etiqueta` action button preserved
 * verbatim from the previous Phase 5 implementation.
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

  const tone = cardTone(order);
  const status = statusPill(order);
  const carrier = order.shipment?.carrier;
  const tracking = order.shipment?.trackingCode;
  const itemCount = (order.items || []).reduce((s, it) => s + (it.quantity || 1), 0);
  const meta = [order.patientCode, `${itemCount} ${itemCount === 1 ? "item" : "itens"}`, carrier]
    .filter(Boolean)
    .join(" · ");
  const showLabel = order.status === "ready_to_ship";

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`${styles.kcard} ${TONE_BORDER[tone] || ""} ${isDragging ? styles.dragging : ""}`.trim()}
      data-order-id={order.id}
      data-status={order.status}
      {...attributes}
      {...listeners}
    >
      <div className={styles.top}>
        <span className={styles.id}>{shortId(order.id)}</span>
        <span className={`pill ${PILL_TONE[status.tone] || PILL_TONE[""]}`.trim()}>
          {status.label}
        </span>
      </div>
      <div className={styles.name}>{order.patientName || "Paciente"}</div>
      {meta ? <div className={styles.meta}>{meta}</div> : null}
      <div className={styles.footer}>
        <span className={styles.when}>{footerWhen(order, tracking)}</span>
        <span className={styles.total}>{money.format((order.totalCents || 0) / 100)}</span>
      </div>
      {showLabel ? (
        <button
          type="button"
          className={`mini ${styles.action}`}
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

function shortId(id) {
  if (!id) return "";
  return id.length > 8 ? `#${id.slice(-6)}` : `#${id}`;
}

function cardTone(order) {
  if (order.status === "fulfillment_exception") return "danger";
  if (order.status === "ready_to_ship" || order.status === "sent") return "ok";
  if (order.status === "paid_pending_fulfillment" && minutesSince(order.paidAt) > 60)
    return "urgent";
  if (order.status === "separating") return "urgent";
  return null;
}

function statusPill(order) {
  switch (order.status) {
    case "paid_pending_fulfillment":
      return { label: "SLA hoje", tone: "warn" };
    case "separating":
      // Spec 2026-05-09 §3: "in progress" → info, not warn (warn = needs human).
      return { label: "em separacao", tone: "info" };
    case "ready_to_ship":
      return { label: "etiqueta gerada", tone: "ok" };
    case "sent":
      return {
        label: order.shipment?.status === "delivered" ? "entregue" : "enviado",
        tone: "ok",
      };
    case "fulfillment_exception":
      return { label: "excecao", tone: "danger" };
    default:
      return { label: order.status, tone: "" };
  }
}

function footerWhen(order, tracking) {
  if (tracking) return tracking;
  if (order.status === "sent" && (order.shipment?.shippedAt || order.shipment?.sentAt)) {
    return `enviado ${fmtTime(order.shipment.shippedAt || order.shipment.sentAt)}`;
  }
  if (order.paidAt) return `pago ${fmtTime(order.paidAt)}`;
  return "—";
}

function fmtTime(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function minutesSince(value) {
  if (!value) return Infinity;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return Infinity;
  return (Date.now() - t) / 60000;
}
