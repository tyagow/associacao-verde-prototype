"use client";

/* Phase 6 — single lot row.

   Renders inside an expanded ProductRow. Columns mirror the ledger
   contract: Lote · Quantidade · Validade · Origem. */

import styles from "./LotRow.module.css";

export default function LotRow({ lot }) {
  const idLabel = lot.id
    .replace(/^lot_|^mvt_/, "")
    .slice(0, 8)
    .toUpperCase();
  return (
    <div className={styles.row} role="listitem">
      <span className={styles.lotId} data-label="Lote">
        LT-{idLabel}
      </span>
      <span className={styles.qty} data-label="Quantidade">
        {lot.quantity} {lot.unit}
      </span>
      <span className={styles.validity} data-label="Validade">
        {formatValidity(lot.validity)}
      </span>
      <span className={styles.origin} data-label="Origem">
        {lot.origin}
      </span>
    </div>
  );
}

function formatValidity(validity) {
  if (!validity) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(validity);
  if (!match) return validity;
  const [, year, month] = match;
  return `${month}/${year}`;
}
