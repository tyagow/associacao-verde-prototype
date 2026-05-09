"use client";

import { Fragment, useEffect, useState } from "react";
import styles from "./OnboardingSteps.module.css";

const STORAGE_KEY = "av:onboarded:firstOrder";

const STEPS = [
  { n: 1, label: "Escolha produtos no catalogo" },
  { n: 2, label: "Gere o Pix — estoque reservado por 15 min" },
  { n: 3, label: "Pague pelo seu app do banco — atualizamos seu pedido sozinho" },
];

/**
 * UX9: First-time patient onboarding strip.
 * Renders only when `visible === true` and the localStorage dismissal flag
 * is not set. Auto-writes the dismissal flag the first time `visible`
 * goes false (cart populated) so it never re-shows for the same patient.
 */
export default function OnboardingSteps({ visible, onDismiss }) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setDismissed(Boolean(window.localStorage.getItem(STORAGE_KEY)));
    } catch {
      setDismissed(false);
    }
  }, []);

  // Auto-dismiss when the patient leaves the empty state (cart populated
  // or first order created). Persists the flag so it never re-shows.
  useEffect(() => {
    if (!visible && !dismissed) {
      try {
        window.localStorage?.setItem(STORAGE_KEY, "1");
      } catch {
        /* storage unavailable */
      }
    }
  }, [visible, dismissed]);

  if (!visible || dismissed) return null;

  const handleDismiss = () => {
    try {
      window.localStorage?.setItem(STORAGE_KEY, "1");
    } catch {
      /* storage unavailable */
    }
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <section
      className={styles.strip}
      aria-label="Como funciona o pedido"
      data-onboarding="firstOrder"
    >
      <ol className={styles.steps}>
        {STEPS.map((step, idx) => (
          <Fragment key={step.n}>
            {idx > 0 ? <li className={styles.connector} aria-hidden="true" /> : null}
            <li className={styles.step}>
              <span className={styles.num} aria-hidden="true">
                {step.n}
              </span>
              <span className={styles.text}>{step.label}</span>
            </li>
          </Fragment>
        ))}
      </ol>
      <button
        type="button"
        className={styles.dismiss}
        onClick={handleDismiss}
        aria-label="Dispensar dicas iniciais"
      >
        ×
      </button>
    </section>
  );
}
