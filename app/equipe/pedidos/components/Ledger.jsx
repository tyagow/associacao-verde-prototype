"use client";

/* Phase 4 — Ledger table shell.

   Renders the mockup's <table class="adm"> structure used by /equipe/pedidos.
   Children are <tr> rows (see OrderRow.jsx). Columns: Pedido · Paciente ·
   Itens · SLA / Pix · Status · Total · action cell.
*/

import styles from "./Ledger.module.css";

export default function Ledger({ children }) {
  return (
    <table className={`adm ${styles.table}`}>
      <thead>
        <tr>
          <th style={{ width: 104 }}>Pedido</th>
          <th>Paciente</th>
          <th style={{ width: 130 }}>Itens</th>
          <th style={{ width: 140 }}>SLA / Pix</th>
          <th style={{ width: 130 }}>Status</th>
          <th className="right" style={{ width: 110 }}>
            Total
          </th>
          <th style={{ width: 90 }} aria-label="ações"></th>
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}
