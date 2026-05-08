"use client";

/* Phase 4 — generic two-section ledger container.

   Renders a panel with a sticky header (title + meta on the right) and a
   children slot that hosts the rows. Used twice on the orders surface:
   once for "Pix pendentes" (action zone) and once for "Pedidos pagos"
   (acompanhamento). Dumb / props-driven — no data fetching here.

   Aesthetic: B · Calm Clinical Modern. Hairline borders, soft shadow,
   tabular numerics on row data (rows handle their own internal layout).
*/

import styles from "./Ledger.module.css";

export default function Ledger({
  title,
  meta,
  ariaLabel,
  emptyMessage,
  children,
  count,
  tone, // "warn" | "good" | undefined
}) {
  const items = Array.isArray(children) ? children : children ? [children] : [];
  const isEmpty = items.length === 0;

  return (
    <section className={styles.ledger} aria-label={ariaLabel || title}>
      <header className={styles.head}>
        <div className={styles.headLeading}>
          <strong className={styles.title}>{title}</strong>
          {typeof count === "number" ? (
            <span className={`${styles.count} ${tone ? styles[`count_${tone}`] : ""}`.trim()}>
              {count}
            </span>
          ) : null}
        </div>
        {meta ? <div className={styles.headMeta}>{meta}</div> : null}
      </header>

      {isEmpty ? (
        <p className={styles.empty}>{emptyMessage || "Sem registros."}</p>
      ) : (
        <div className={styles.body} role="list">
          {items}
        </div>
      )}
    </section>
  );
}
