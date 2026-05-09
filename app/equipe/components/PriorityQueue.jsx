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
 *
 * Visual primitives (.dataTable, .pill / .pill--*, .btn--ghost,
 * .emptyState) live in globals.css. Local module owns layout chrome
 * (.panel, .head, .who, .action) only.
 */
const KIND_LABELS = {
  pix: { label: "Pix", tone: "warn" },
  fulfill: { label: "Fulfill", tone: "ok" },
  block: { label: "Bloqueio", tone: "danger" },
  stock: { label: "Estoque", tone: "warn" },
  support: { label: "Suporte", tone: "" },
};

// Map internal tone names to global .pill--* modifiers.
const PILL_TONE = {
  ok: "pill--good",
  warn: "pill--warn",
  danger: "pill--danger",
  info: "pill--info",
  "": "pill--neutral",
};

function pillClass(tone) {
  return `pill ${PILL_TONE[tone] || PILL_TONE[""]}`;
}

export default function PriorityQueue({ rows = [], onExport }) {
  return (
    <section className={styles.panel} aria-label="Fila prioritaria">
      <header className={styles.head}>
        <h3 className={styles.title}>Fila prioritaria</h3>
        {onExport ? (
          <button type="button" className="btn btn--ghost btn--sm" onClick={onExport}>
            Exportar
          </button>
        ) : null}
      </header>
      <div className={styles.tableWrap}>
        <table className={`adm dataTable`}>
          <thead>
            <tr>
              <th style={{ width: 80 }}>Tipo</th>
              <th style={{ width: 110 }}>ID</th>
              <th>Paciente</th>
              <th style={{ width: 150 }}>SLA / vencimento</th>
              <th style={{ width: 140 }}>Status</th>
              <th className="num" style={{ width: 110 }}>
                Valor
              </th>
              <th style={{ width: 70 }} aria-label="acao" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="emptyState">
                    <span>Nenhum pedido aguardando agora</span>
                    <span className="emptyState__hint">
                      A fila prioritaria fica calma quando todos os pedidos correm dentro do SLA.
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => {
                const kind = KIND_LABELS[row.kind] || { label: row.kind, tone: "" };
                return (
                  <tr key={`${row.kind}-${row.id || idx}`}>
                    <td>
                      <span className={pillClass(kind.tone)}>{kind.label}</span>
                    </td>
                    <td className="mono">{row.id || "—"}</td>
                    <td>
                      <div className={styles.who}>
                        <span className={styles.name}>{row.who?.name || "—"}</span>
                        {row.who?.meta ? <span className={styles.meta}>{row.who.meta}</span> : null}
                      </div>
                    </td>
                    <td className="num">{row.sla || "—"}</td>
                    <td>
                      <span className={pillClass(row.status?.tone)}>
                        {row.status?.label || "—"}
                      </span>
                    </td>
                    <td className="num">{row.value || "—"}</td>
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
