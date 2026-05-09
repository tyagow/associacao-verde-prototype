"use client";

import styles from "./PriorityQueue.module.css";

/**
 * Phase 1 — Fila prioritaria table.
 *
 * Mixes payment, fulfillment, blocked-patient, low-stock and support rows
 * into one priority table per mockup b-comando.html. Caller (TeamCommand)
 * builds the heterogeneous row list and passes it in.
 *
 * Row shape:
 *   {
 *     kind:    'pix' | 'fulfill' | 'block' | 'stock' | 'support',
 *     id:      string,            // monospace ID column
 *     who:     { name, meta },    // patient / product label
 *     sla:     string,            // free text
 *     status:  { label, tone },   // tone in 'warn'|'danger'|'ok'|''
 *     value:   string,            // formatted right-aligned text
 *     href?:   string,            // action link target
 *   }
 *
 * Header row preserves the literal "SLA / vencimento" required by
 * scripts/e2e-production-app.py:168.
 */
const KIND_LABELS = {
  pix: { label: "Pix", tone: "warn" },
  fulfill: { label: "Fulfill", tone: "ok" },
  block: { label: "Bloqueio", tone: "danger" },
  stock: { label: "Estoque", tone: "warn" },
  support: { label: "Suporte", tone: "" },
};

export default function PriorityQueue({ rows = [], onExport }) {
  return (
    <section className={styles.panel} aria-label="Fila prioritaria">
      <header className={styles.head}>
        <h3 className={styles.title}>Fila prioritaria</h3>
        {onExport ? (
          <button type="button" className={styles.exportBtn} onClick={onExport}>
            Exportar
          </button>
        ) : null}
      </header>
      <div className={styles.tableWrap}>
        <table className={`adm ${styles.table}`}>
          <thead>
            <tr>
              <th style={{ width: 80 }}>Tipo</th>
              <th style={{ width: 110 }}>ID</th>
              <th>Paciente</th>
              <th style={{ width: 150 }}>SLA / vencimento</th>
              <th style={{ width: 140 }}>Status</th>
              <th className={styles.right} style={{ width: 110 }}>
                Valor
              </th>
              <th style={{ width: 70 }} aria-label="acao" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.empty}>
                  Sem itens prioritarios na leitura atual.
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => {
                const kind = KIND_LABELS[row.kind] || { label: row.kind, tone: "" };
                return (
                  <tr key={`${row.kind}-${row.id || idx}`}>
                    <td>
                      <span className={`${styles.pill} ${styles[kind.tone] || ""}`}>
                        {kind.label}
                      </span>
                    </td>
                    <td>
                      <span className={styles.mono}>{row.id || "—"}</span>
                    </td>
                    <td>
                      <div className={styles.who}>
                        <span className={styles.name}>{row.who?.name || "—"}</span>
                        {row.who?.meta ? <span className={styles.meta}>{row.who.meta}</span> : null}
                      </div>
                    </td>
                    <td>
                      <span className={styles.num}>{row.sla || "—"}</span>
                    </td>
                    <td>
                      <span className={`${styles.pill} ${styles[row.status?.tone] || ""}`}>
                        {row.status?.label || "—"}
                      </span>
                    </td>
                    <td className={`${styles.right} ${styles.num}`}>{row.value || "—"}</td>
                    <td>
                      {row.href ? (
                        <a className={styles.action} href={row.href}>
                          ver →
                        </a>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
