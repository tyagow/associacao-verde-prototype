"use client";

/* Phase 3 — Product ledger panel.

   Direction B: a single <table class="adm"> wrapped in <section class="panel">
   plus an <header class="ph"> for the panel title. Children are the
   ProductRow instances; each child emits its own <tbody> so we can have a
   per-product zebra/expand strip per the mockup. */

import styles from "./ProductLedger.module.css";

export default function ProductLedger({ children }) {
  const rows = Array.isArray(children) ? children : children ? [children] : [];
  const isEmpty = rows.length === 0;
  return (
    <section className={`panel ${styles.ledgerPanel}`} aria-label="Produtos, estoque e lotes">
      <header className="ph">
        <h3>Ledger de produtos</h3>
        <span className="meta">click no produto para abrir lotes</span>
      </header>
      {isEmpty ? (
        <p className={styles.empty}>Nenhum produto encontrado para o filtro atual.</p>
      ) : (
        <table className="adm">
          <thead>
            <tr>
              <th style={{ width: 120 }}>Identificador</th>
              <th>Produto</th>
              <th style={{ width: 110 }}>Categoria</th>
              <th className="right" style={{ width: 80 }}>
                Estoque
              </th>
              <th className="right" style={{ width: 80 }}>
                Reservado
              </th>
              <th className="right" style={{ width: 80 }}>
                Lotes
              </th>
              <th style={{ width: 120 }}>Limiar</th>
              <th style={{ width: 110 }}>Status</th>
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      )}
    </section>
  );
}
