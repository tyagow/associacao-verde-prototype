"use client";

import styles from "./KpiRibbon.module.css";

/**
 * Phase 1 — Bordered ribbon that hosts 5 <KpiSpark> cells per mockup
 * b-comando.html .kpiRow. One outer border, hairline cell separators.
 */
export default function KpiRibbon({ children, ariaLabel = "Indicadores da operacao" }) {
  return (
    <section className={styles.row} aria-label={ariaLabel}>
      {children}
    </section>
  );
}
