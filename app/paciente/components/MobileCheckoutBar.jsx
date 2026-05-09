"use client";

import styles from "./MobileCheckoutBar.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/**
 * UX10: Floating mobile checkout bar.
 *
 * Always renders the element (so `visible` controls only display); the
 * desktop hide is enforced via @media (min-width: 721px) in CSS.
 */
export default function MobileCheckoutBar({ visible, count, totalCents, busy, onSubmit }) {
  if (!visible) return null;
  const label = `${count} ${count === 1 ? "item" : "itens"} · ${money.format((totalCents || 0) / 100)}`;
  return (
    <div
      className={styles.bar}
      role="region"
      aria-label="Resumo rapido do pedido"
      data-mobile-checkout-bar
    >
      <span className={styles.summary}>{label}</span>
      <button
        type="button"
        className={styles.cta}
        onClick={onSubmit}
        disabled={busy}
        data-mobile-checkout-cta
      >
        Gerar Pix →
      </button>
    </div>
  );
}
