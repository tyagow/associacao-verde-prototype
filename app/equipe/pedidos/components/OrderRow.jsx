"use client";

/* Phase 4 — single ledger row.

   Two row shapes share this component:
     - "pending" (Pix pendente) — countdown column visible, reconcile/cancel
       inline actions, no fulfillment status pill.
     - "paid" (Pedido pago / em fulfillment) — status pill, per-row actions
       like etiqueta/rastreio depending on status.

   The component is dumb. It takes pre-computed strings (countdown label,
   status label, action descriptors) and emits clicks via callbacks. Data
   shaping happens in OrdersClient.

   Inline actions for Pix pendentes preserve the existing E2E-targeted
   attributes:
     [data-pay='<paymentId>']        → simulate webhook (FIRST visible
                                         element on the surface for the
                                         #orders-surface [data-pay] test)
     [data-reconcile='<paymentId>']  → reconcile provider
*/

import styles from "./OrderRow.module.css";

export default function OrderRow({
  variant, // "pending" | "paid"
  primary, // { id, subtitle }
  patient, // { name, summary }
  amount, // formatted amount string
  countdown, // { label, tone } | null
  statusPill, // { label, tone } | null
  actions, // [{ key, label, onClick, tone, disabled, dataAttr: {key,value} }]
  onOpen, // click handler for opening drawer
  selected,
}) {
  return (
    <article
      role="listitem"
      className={`${styles.row} ${styles[`row_${variant}`]} ${selected ? styles.row_selected : ""}`.trim()}
      data-variant={variant}
    >
      <button
        type="button"
        className={styles.openButton}
        onClick={onOpen}
        aria-label={`Abrir detalhes do pedido ${primary.id}`}
      >
        <span className={styles.cellId}>
          <strong className={styles.idText}>{primary.id}</strong>
          {primary.subtitle ? <code className={styles.idMeta}>{primary.subtitle}</code> : null}
        </span>

        <span className={styles.cellPatient}>
          <strong className={styles.patientName}>{patient.name}</strong>
          {patient.summary ? <span className={styles.patientMeta}>{patient.summary}</span> : null}
        </span>

        <strong className={styles.cellMoney}>{amount}</strong>

        {variant === "pending" ? (
          <span
            className={`${styles.cellCountdown} ${countdown?.tone ? styles[`count_${countdown.tone}`] : ""}`.trim()}
          >
            {countdown?.label || "—"}
          </span>
        ) : (
          <span className={styles.cellStatus}>
            {statusPill ? (
              <span className={`${styles.pill} ${styles[`pill_${statusPill.tone || "neutral"}`]}`}>
                {statusPill.label}
              </span>
            ) : null}
          </span>
        )}
      </button>

      <div className={styles.cellActions} onClick={(event) => event.stopPropagation()}>
        {(actions || []).map((action) => {
          const dataProps = action.dataAttr
            ? { [`data-${action.dataAttr.key}`]: action.dataAttr.value }
            : {};
          return (
            <button
              key={action.key}
              type="button"
              className={`${styles.actionBtn} ${action.tone ? styles[`btn_${action.tone}`] : ""}`.trim()}
              onClick={action.onClick}
              disabled={Boolean(action.disabled)}
              {...dataProps}
            >
              {action.label}
            </button>
          );
        })}
      </div>
    </article>
  );
}
