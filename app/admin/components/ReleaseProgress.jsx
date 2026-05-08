"use client";

import styles from "./ReleaseProgress.module.css";

/**
 * Hero "Release readiness" bar.
 *
 * Props:
 *   passing  number of gates currently OK
 *   total    total number of gates
 *   blockers array of gate labels that are not OK (rendered inline as a list)
 *   checkedAt optional ISO timestamp the release-gate snapshot was taken
 */
export default function ReleaseProgress({ passing = 0, total = 0, blockers = [], checkedAt }) {
  const pct = total > 0 ? Math.round((passing / total) * 100) : 0;
  const ok = total > 0 && passing === total;
  return (
    <section
      className={`${styles.bar} ${ok ? styles.ok : styles.pending}`}
      aria-label="Release readiness"
    >
      <div className={styles.grid}>
        <div>
          <span className={styles.overline}>Release readiness</span>
          <h2 className={styles.headline}>
            {passing} de {total} gates passando
          </h2>
          <p className={styles.subline}>
            {ok
              ? "Todos os gates de producao estao completos. Release liberada por evidencias."
              : blockers.length
                ? `Bloqueada por: ${blockers.join(" · ")}.`
                : "Carregando evidencias..."}
          </p>
          {checkedAt ? <p className={styles.muted}>Verificado em {checkedAt}.</p> : null}
        </div>
        <div className={styles.percentBlock}>
          <strong className={styles.percent}>{pct}%</strong>
          <span className={styles.overline}>progresso</span>
        </div>
      </div>
      <div
        className={styles.progress}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span style={{ width: `${pct}%` }} />
      </div>
    </section>
  );
}
