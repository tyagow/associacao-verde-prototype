"use client";

import styles from "./KpiSpark.module.css";

/**
 * Phase 1 — Ribbon cell. One slot inside <KpiRibbon>.
 *
 * Layout per mockup b-comando.html .kpiRow .kpi:
 *   <span class="label">…</span>      // 11px uppercase muted
 *   <span class="value">…</span>      // 28px Outfit, tabular nums
 *   <span class="delta">…</span>      // 11px helper text, optional .up / .down
 */
export default function KpiSpark({ label, value, delta, deltaTone = "" }) {
  const deltaCls = [styles.delta, deltaTone ? styles[deltaTone] : null].filter(Boolean).join(" ");
  return (
    <div className={styles.cell}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      {delta ? <span className={deltaCls}>{delta}</span> : null}
    </div>
  );
}
