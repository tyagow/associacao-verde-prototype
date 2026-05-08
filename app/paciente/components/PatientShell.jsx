"use client";

import Brand from "../../components/Brand";
import styles from "./PatientShell.module.css";

/**
 * PatientShell — Phase 1a outer container for the patient portal.
 *
 * Renders a top bar (brand + identity + status chip + actions slot) and a work
 * area for children. Login screen, consent gate and blocked screen still render
 * inside this shell so cross-cutting selectors (#patient-status, #toast, etc.)
 * stay reachable.
 *
 * Props:
 *   name        — patient display name (or fallback string for logged-out)
 *   statusText  — text rendered inside #patient-status (E2E selector)
 *   statusTone  — "good" | "warn" | "danger" (for the .pill modifier)
 *   tabs        — optional ReactNode rendered immediately under the topbar
 *   actions     — optional ReactNode rendered to the right of the topbar (e.g. logout)
 *   children    — main work area content
 */
export default function PatientShell({
  name,
  statusText,
  statusTone = "good",
  tabs = null,
  actions = null,
  children,
}) {
  const toneClass = statusTone ? `pill ${statusTone}` : "pill";
  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brandSlot}>
          <Brand />
        </div>
        <div className={styles.identity}>
          {name ? <span className={styles.identityName}>{name}</span> : null}
          <span className={toneClass} id="patient-status">
            {statusText}
          </span>
        </div>
        <div className={styles.actions}>{actions}</div>
      </header>
      {tabs}
      <main className={styles.work}>{children}</main>
    </div>
  );
}
