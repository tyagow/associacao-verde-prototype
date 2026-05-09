"use client";

import Brand from "../../components/Brand";
import styles from "./PatientShell.module.css";

/**
 * PatientShell — Phase 3 outer container for the patient portal (storefront dialect).
 *
 * Renders a sticky topbar (Brand · search field · identity pill · actions) and a
 * work area for children. The login screen, consent gate and blocked screen all
 * still render inside this shell so cross-cutting selectors (#patient-status,
 * #toast, etc.) stay reachable.
 *
 * E2E contract: the `#patient-status` element must remain on the identity pill
 * and must contain the patient's name in the authenticated state. We render
 * `{name} · {memberCode}` when both are provided, otherwise fall back to
 * `statusText` so logged-out / blocked states keep working.
 *
 * Props:
 *   name        — patient display name (or fallback string for logged-out)
 *   memberCode  — short member code (e.g. "APO-1027") rendered after the name
 *   statusText  — fallback text rendered inside #patient-status when no name
 *   statusTone  — "good" | "warn" | "danger" — drives pill colors + dot
 *   search      — optional ReactNode rendered as the centered search field
 *   tabs        — optional ReactNode rendered immediately under the topbar
 *   actions     — optional ReactNode rendered to the right of the identity pill
 *   children    — main work area content
 */
export default function PatientShell({
  name,
  memberCode,
  statusText,
  statusTone = "good",
  search = null,
  tabs = null,
  actions = null,
  children,
}) {
  const toneModifier =
    statusTone === "warn"
      ? styles.pillWarn
      : statusTone === "danger"
        ? styles.pillDanger
        : styles.pillGood;
  const pillClass = `${styles.pill} ${toneModifier}`.trim();
  const pillContent = name ? (memberCode ? `${name} · ${memberCode}` : name) : statusText;

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brandSlot}>
          <Brand />
        </div>
        {search ? (
          <div className={styles.searchSlot}>{search}</div>
        ) : (
          <div className={styles.spacer} />
        )}
        <div className={styles.identity}>
          <span className={pillClass} id="patient-status">
            {pillContent}
          </span>
          {actions ? <div className={styles.actions}>{actions}</div> : null}
        </div>
      </header>
      {tabs}
      <main className={styles.work}>{children}</main>
    </div>
  );
}
