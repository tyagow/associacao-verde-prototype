"use client";

import styles from "./GateDetail.module.css";

/**
 * Detail panel that opens below the gate grid for the currently selected gate.
 *
 * Props:
 *   title     gate title
 *   tone      good|warn|danger|pending (drives header pill color)
 *   summary   short description of current state
 *   meta      array of { label, value } for the metric row
 *   evidence  array of { label, value } for free-text evidence
 *   runHint   optional string telling the operator what command runs the check
 *   onClose   callback to dismiss the detail panel
 *   children  optional inline form for evidence registration
 */
export default function GateDetail({
  title,
  tone = "pending",
  summary,
  meta = [],
  evidence = [],
  runHint,
  onClose,
  children,
}) {
  return (
    <section
      className={`${styles.detail} ${styles[tone] || styles.pending}`}
      aria-label={`Detalhe ${title}`}
    >
      <header className={styles.header}>
        <div>
          <span className={styles.overline}>Detalhe selecionado</span>
          <h3 className={styles.title}>{title}</h3>
          {summary ? <p className={styles.summary}>{summary}</p> : null}
        </div>
        {onClose ? (
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Fechar detalhe"
          >
            Fechar
          </button>
        ) : null}
      </header>

      {meta.length ? (
        <dl className={styles.metrics}>
          {meta.map((entry) => (
            <div key={entry.label}>
              <dt>{entry.label}</dt>
              <dd>
                {entry.value === undefined || entry.value === null || entry.value === ""
                  ? "-"
                  : entry.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {evidence.length ? (
        <dl className={styles.evidence}>
          {evidence.map((entry) => (
            <div key={entry.label}>
              <dt>{entry.label}</dt>
              <dd>{entry.value || "-"}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {runHint ? <p className={styles.run}>{runHint}</p> : null}

      {children ? <div className={styles.formArea}>{children}</div> : null}
    </section>
  );
}
