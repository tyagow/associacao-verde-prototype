"use client";

/* Phase 3 — Lot row inside the expanded product detail.
   Emits a <tr>; relies on the inner table.adm in ProductRow for layout. */

import styles from "./LotRow.module.css";

export default function LotRow({ lot }) {
  // A5 fix: don't synthesize a `LOT-XXXXXXXX` prefix from an internal id.
  // Render the real id with an explicit "id:" hint so it doesn't masquerade
  // as an SOP/printed lot code that operators can search elsewhere.
  const rawId = String(lot.id || "");
  const idLabel = rawId ? rawId.slice(0, 12) : "—";
  return (
    <tr>
      <td>
        <span className="mono" title={rawId || undefined}>
          id: {idLabel}
        </span>
      </td>
      <td className="right num">
        {lot.quantity} {lot.unit}
      </td>
      <td className="num">{formatValidity(lot.validity)}</td>
      <td>{lot.origin || "—"}</td>
      <td className="right num">{lot.reserved ?? 0}</td>
      <td className={styles.actions}>
        <button
          type="button"
          className="btn ghost mini"
          disabled
          aria-label="Editar lote (em breve)"
          title="Edicao inline de lote ainda nao disponivel — use o painel Entrada e cultivo abaixo"
        >
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
