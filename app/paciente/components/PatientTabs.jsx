"use client";

import styles from "./PatientTabs.module.css";

const TABS = [
  { value: "pedido", label: "Pedido" },
  { value: "historico", label: "Historico" },
  { value: "suporte", label: "Suporte" },
];

/**
 * PatientTabs — Phase 1a tab strip controlling which work-area section is
 * visually active. Inactive sections stay mounted (display:none) so all E2E
 * selectors remain reachable. Phase 1d will tighten this.
 *
 * Props:
 *   current  — "pedido" | "historico" | "suporte"
 *   onChange — (value) => void
 */
export default function PatientTabs({ current = "pedido", onChange }) {
  return (
    <nav
      className={`app-tabs ${styles.bar}`}
      role="tablist"
      aria-label="Areas do portal do paciente"
    >
      {TABS.map((tab) => {
        const isActive = current === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-current={isActive ? "page" : undefined}
            data-patient-tab={tab.value}
            className={`app-tabs__tab ${styles.tabButton} ${isActive ? "is-active" : ""}`.trim()}
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
