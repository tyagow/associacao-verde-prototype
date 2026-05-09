"use client";

import styles from "./PatientTabs.module.css";

const TABS = [
  { value: "pedido", label: "Pedido" },
  { value: "historico", label: "Histórico" },
  { value: "suporte", label: "Suporte" },
  { value: "perfil", label: "Meu perfil", align: "end" },
];

/**
 * PatientTabs — Phase 3 sticky tab strip beneath the topbar (storefront dialect).
 *
 * Active style: ink color + 2px ink underline that overlaps the topbar's hairline
 * via `margin-bottom: -1px`. Inactive: muted color, no border. The 4th tab
 * (`perfil`) is right-aligned via `margin-left: auto` per the design spec.
 *
 * Unknown `current` keys do not crash — no tab is marked active in that case.
 *
 * Props:
 *   current  — "pedido" | "historico" | "suporte" | "perfil"
 *   onChange — (value) => void
 */
export default function PatientTabs({ current = "pedido", onChange }) {
  return (
    <nav className={styles.bar} role="tablist" aria-label="Areas do portal do paciente">
      {TABS.map((tab) => {
        const isActive = current === tab.value;
        const classes = [
          styles.tabButton,
          isActive ? styles.tabActive : "",
          tab.align === "end" ? styles.tabEnd : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-current={isActive ? "page" : undefined}
            data-patient-tab={tab.value}
            className={classes}
            onClick={() => onChange?.(tab.value)}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

export const PATIENT_TABS = TABS.map((tab) => tab.value);
