"use client";

/* Phase 3 — Lot row inside the expanded product detail.
   Emits a <tr>; relies on the inner table.adm in ProductRow for layout. */

import styles from "./LotRow.module.css";

export default function LotRow({ lot }) {
  const idLabel = String(lot.id || "")
    .replace(/^lot_|^mvt_/, "")
    .slice(0, 8)
    .toUpperCase();
  return (
    <tr>
      <td>
        <span className="mono">LOT-{idLabel || "------"}</span>
      </td>
      <td className="right num">
        {lot.quantity} {lot.unit}
      </td>
      <td className="num">{formatValidity(lot.validity)}</td>
      <td>{lot.origin || "—"}</td>
      <td className="right num">{lot.reserved ?? 0}</td>
      <td className={styles.actions}>
        <button type="button" className="btn ghost mini" disabled aria-label="Editar lote">
          editar
        </button>
      </td>
    </tr>
  );
}

function formatValidity(validity) {
  if (!validity) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(validity);
  if (!match) return validity;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}
