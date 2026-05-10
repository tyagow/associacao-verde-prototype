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
        <div className={styles.empty}>
          <div className="adm-empty-state adm-empty-state--inset">
            <span className="adm-empty-state__title">Sem produtos no ledger</span>
            <span className="adm-empty-state__hint">
              Ajuste o filtro ou cadastre um novo produto para acompanhar o estoque.
            </span>
          </div>
        </div>
      ) : (
        <table className="adm">
          <colgroup>
            <col style={{ width: 120 }} />
            <col />
            <col style={{ width: 110 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 56 }} />
          </colgroup>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Produto</th>
              <th>Categoria</th>
              <th className="right">Estoque</th>
              <th className="right">Reservado</th>
              <th className="right">Lotes</th>
              <th>Limiar</th>
              <th>Status</th>
              <th aria-label="Ações" />
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      )}
    </section>
  );
}
