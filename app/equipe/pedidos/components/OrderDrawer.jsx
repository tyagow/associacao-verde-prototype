"use client";

/* Phase 4 — Order detail drawer (right slide-over).

   Mirrors the patient CatalogDrawer / ProfileDrawer pattern from Phase 1b:
     - framer-motion spring transform on the panel
     - useReducedMotion collapses to duration:0
     - Esc key + close button
     - Backdrop click closes
     - The drawer is always present in the DOM; the open prop only drives
       transform + pointer-events. (Keeps any future E2E hooks reachable.)

   Content: order detail (status, patient, items, frete, audit snippet,
   Pix info if pending, dispatch fields if paid). Optional cancellation
   form for orders that allow it (rendered only when `cancelable=true`).
*/

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import styles from "./OrderDrawer.module.css";

export default function OrderDrawer({
  open,
  onClose,
  order,
  payment, // when present, this is a "Pix pendente" surface (no order on the dashboard yet might still be possible)
  busyKey,
  onCancelOrder, // (event, orderId) => void
  onPaymentAction, // (paymentId, "pay" | "reconcile") => void
}) {
  const closeRef = useRef(null);
  const reduce = useReducedMotion();
  const backdropTransition = reduce ? { duration: 0 } : { duration: 0.18 };
  const panelTransition = reduce
    ? { duration: 0 }
    : { type: "spring", damping: 30, stiffness: 240 };

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    function onKey(event) {
      if (event.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const subject = order || (payment ? { id: payment.orderId } : null);
  const cancelable =
    order &&
    ["awaiting_payment", "paid_pending_fulfillment", "separating", "ready_to_ship"].includes(
      order.status,
    );

  return (
    <div className={`${styles.root} ${open ? styles.rootOpen : ""}`.trim()} aria-hidden={!open}>
      <AnimatePresence>
        {open ? (
          <motion.button
            type="button"
            key="backdrop"
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={backdropTransition}
            onClick={onClose}
            aria-label="Fechar"
            tabIndex={-1}
          />
        ) : null}
      </AnimatePresence>

      <motion.aside
        className={`${styles.panel} ${open ? "" : styles.panelClosed}`.trim()}
        role="dialog"
        aria-modal={open ? "true" : "false"}
        aria-label={`Detalhes do pedido ${subject?.id || ""}`}
        initial={false}
        animate={{ x: open ? 0 : "100%" }}
        transition={panelTransition}
      >
        <header className={styles.header}>
          <div>
            <span className={styles.kicker}>Pedido</span>
            <h2 className={styles.title}>{subject?.id || "—"}</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Fechar drawer"
          >
            ×
          </button>
        </header>

        <div className={styles.body}>
          {payment ? (
            <PixPendingBlock
              payment={payment}
              busyKey={busyKey}
              onPaymentAction={onPaymentAction}
            />
          ) : null}
          {order ? <OrderDetailBlock order={order} /> : null}
          {cancelable ? <CancellationForm order={order} onCancelOrder={onCancelOrder} /> : null}
        </div>
      </motion.aside>
    </div>
  );
}

function PixPendingBlock({ payment, busyKey, onPaymentAction }) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Pix pendente</h3>
      <dl className={styles.factGrid}>
        <Fact label="Valor" value={formatCents(payment.amountCents)} />
        <Fact label="Provider" value={payment.provider || "—"} />
        <Fact label="Provider ID" value={payment.providerPaymentId || "—"} mono />
        <Fact label="Vence" value={formatDateTime(payment.expiresAt)} />
      </dl>
      <div className={styles.actionsRow}>
        <button
          type="button"
          className={styles.btn}
          disabled={busyKey === `reconcile:${payment.id}`}
          onClick={() => onPaymentAction?.(payment.id, "reconcile")}
        >
          {busyKey === `reconcile:${payment.id}` ? "Conciliando…" : "Conciliar provider"}
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          disabled={busyKey === `pay:${payment.id}`}
          onClick={() => onPaymentAction?.(payment.id, "pay")}
        >
          {busyKey === `pay:${payment.id}` ? "Simulando…" : "Simular webhook pago"}
        </button>
      </div>
    </section>
  );
}

function OrderDetailBlock({ order }) {
  const items = order.items || [];
  const exceptions = order.exceptions || [];
  return (
    <>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Resumo</h3>
        <dl className={styles.factGrid}>
          <Fact label="Paciente" value={order.patientName || "—"} />
          <Fact label="Status" value={order.status} />
          <Fact label="Total" value={formatCents(order.totalCents)} />
          <Fact
            label="Pagamento"
            value={`${order.paymentProvider || "—"} · ${order.paymentStatus || "—"}`}
          />
        </dl>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Itens reservados</h3>
        {items.length ? (
          <ul className={styles.itemList}>
            {items.map((item, index) => (
              <li key={index} className={styles.item}>
                <span className={styles.itemName}>
                  {item.quantity}× {item.name}
                </span>
                <span className={styles.itemUnit}>{item.unit}</span>
                {typeof item.subtotalCents === "number" ? (
                  <span className={styles.itemMoney}>{formatCents(item.subtotalCents)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>Sem itens.</p>
        )}
      </section>

      {order.shipment ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Envio</h3>
          <dl className={styles.factGrid}>
            <Fact label="Transportadora" value={order.shipment.carrier || "—"} />
            <Fact label="Status" value={order.shipment.status || "—"} />
            <Fact label="Rastreio" value={order.shipment.trackingCode || "sem rastreio"} mono />
          </dl>
        </section>
      ) : null}

      {order.pix ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Pix</h3>
          <p className={styles.muted}>Copia-e-cola</p>
          <pre className={styles.pixCode}>{order.pix.copiaECola}</pre>
        </section>
      ) : null}

      {exceptions.length ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Exceções</h3>
          <ul className={styles.timeline}>
            {exceptions.map((ex, index) => (
              <li key={index} className={styles.timelineItem}>
                <span className={styles.timelineDate}>{formatDateTime(ex.at)}</span>
                <span className={styles.timelineNote}>{ex.note}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function CancellationForm({ order, onCancelOrder }) {
  const isAwaiting = order.status === "awaiting_payment";
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{isAwaiting ? "Cancelar pedido" : "Revisar exceção"}</h3>
      <form className={styles.cancelForm} onSubmit={(event) => onCancelOrder?.(event, order.id)}>
        <label className={styles.label}>
          {isAwaiting ? "Motivo para liberar reserva" : "Motivo para revisar reembolso"}
          <input
            name="reason"
            placeholder={
              isAwaiting ? "Ex.: paciente desistiu da compra" : "Ex.: ajuste manual em fulfillment"
            }
            required
            className={styles.input}
          />
        </label>
        <button type="submit" className={`${styles.btn} ${styles.btnDanger}`}>
          {isAwaiting ? "Cancelar e liberar" : "Revisar exceção"}
        </button>
      </form>
    </section>
  );
}

function Fact({ label, value, mono }) {
  return (
    <div className={styles.fact}>
      <dt>{label}</dt>
      <dd className={mono ? styles.factMono : ""}>{value}</dd>
    </div>
  );
}

const moneyFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatCents(value) {
  return moneyFmt.format((value || 0) / 100);
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}
