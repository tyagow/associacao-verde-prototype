"use client";

import styles from "./PageHead.module.css";

/**
 * Phase 0 — PageHead primitive (Direction B).
 *
 * Per spec §3.3: h1 (Outfit 24px, --ink) on the left, meta line + actions
 * on the right (e.g. "Atualizado 14:32" + "Atualizar" + primary CTA).
 *
 * Props:
 *   title:   string — the h1 text
 *   meta?:   ReactNode — small grey meta line (timestamps, counts)
 *   actions?: ReactNode — buttons row, rendered as-is
 */
export default function PageHead({ title, meta, actions }) {
  return (
    <div className={styles.pagehead}>
      <h1 className={styles.title}>{title}</h1>
      {meta || actions ? (
        <div className={styles.right}>
          {meta ? <span className={styles.meta}>{meta}</span> : null}
          {actions ? <div className={styles.actions}>{actions}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
