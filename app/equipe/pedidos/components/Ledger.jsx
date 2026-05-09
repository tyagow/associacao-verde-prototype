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
      <colgroup>
        <col style={{ width: 104 }} />
        <col />
        <col style={{ width: 130 }} />
        <col style={{ width: 140 }} />
        <col style={{ width: 130 }} />
        <col style={{ width: 110 }} />
        <col style={{ width: 90 }} />
      </colgroup>
      <thead>
        <tr>
          <th>Pedido</th>
          <th>Paciente</th>
          <th>Itens</th>
          <th>SLA / Pix</th>
          <th>Status</th>
          <th className="right">Total</th>
          <th aria-label="ações"></th>
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}
