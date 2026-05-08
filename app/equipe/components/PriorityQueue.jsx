"use client";

import styles from "./PriorityQueue.module.css";

/**
 * Phase 3 — Priority queue table. Replaces the legacy .ops-board layout.
 *
 * Preserves the visible text "Fila de acao agora" and "SLA / vencimento"
 * required by E2E (#team-dashboard contains these).
 */
export default function PriorityQueue({ rows = [] }) {
  return (
    <section className={styles.txPriority} aria-label="Fila de acao agora">
      <header className={styles.txPriorityHead}>
        <h3 className={styles.txPriorityTitle}>Fila de acao agora</h3>
        <span className={styles.txPrioritySubtitle}>
          Priorize bloqueios, Pix vencendo e Separacao/envio antes de novas filas.
        </span>
      </header>
      <div className={styles.txPriorityTable} role="table">
        <div className={styles.txPriorityRowHead} role="row">
          <span className={`${styles.txPriorityCell} ${styles.head}`} role="columnheader">
            Prioridade
          </span>
          <span className={`${styles.txPriorityCell} ${styles.head}`} role="columnheader">
            Fila
          </span>
          <span className={`${styles.txPriorityCell} ${styles.head}`} role="columnheader">
            Referencia
          </span>
          <span className={`${styles.txPriorityCell} ${styles.head}`} role="columnheader">
            SLA / vencimento
          </span>
          <span className={`${styles.txPriorityCell} ${styles.head}`} role="columnheader">
            Acao
          </span>
        </div>
        {rows.map((row) => (
          <div className={styles.txPriorityRow} role="row" key={row.label}>
            <span className={styles.txPriorityCell} role="cell">
              <span className={`${styles.txPriorityPill} ${row.tone || ""}`}>{row.priority}</span>
            </span>
            <span className={styles.txPriorityCell} role="cell">
              <span className={styles.txPriorityLabel}>
                <strong>{row.label}</strong>
                <span>{row.detail}</span>
              </span>
            </span>
            <span className={styles.txPriorityCell} role="cell">
              {row.reference}
            </span>
            <span className={styles.txPriorityCell} role="cell">
              {row.sla}
            </span>
            <span className={styles.txPriorityCell} role="cell">
              <a className={styles.txPriorityAction} href={row.href}>
                {row.action} →
              </a>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
