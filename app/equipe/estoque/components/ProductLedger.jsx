"use client";

/* Phase 6 — Product ledger container.

   Single ledger that lists every product as a row (Produto · Estoque ·
   Reservado · Lotes · Categoria · Status). Click expands to lot rows.
   Cultivo lives in a sibling panel below; this component focuses on the
   product matrix only.

   Dumb / props-driven: parent (StockRoute) owns the data fetch, filter
   state, and the inline-edit PATCH callback. */

import styles from "./ProductLedger.module.css";

export default function ProductLedger({
  products,
  filters,
  onFilterChange,
  totals,
  children,
}) {
  return (
    <section className={styles.ledger} aria-label="Produtos, estoque e lotes">
      <header className={styles.head}>
        <strong className={styles.title}>Produtos · estoque · lotes</strong>
        <div className={styles.meta}>
          <span>{products.length} produto(s) listado(s)</span>
        </div>
      </header>

      <div className={styles.kpis}>
        <div className={styles.kpi}>
          <span>Produtos</span>
          <strong>{totals.productCount}</strong>
          <small>total</small>
        </div>
        <div className={`${styles.kpi}${totals.lowStockCount > 0 ? " " + styles.warn : ""}`}>
          <span>Baixo estoque</span>
          <strong>{totals.lowStockCount}</strong>
          <small>repor</small>
        </div>
        <div className={styles.kpi}>
          <span>Reservas ativas</span>
          <strong>{totals.activeReservations}</strong>
          <small>em andamento</small>
        </div>
        <div className={styles.kpi}>
          <span>Lotes</span>
          <strong>{totals.lotCount}</strong>
          <small>rastreados</small>
        </div>
      </div>

      <div className={styles.toolbar} aria-label="Filtro de estoque">
        <label>
          Buscar no estoque
          <input
            data-filter="stockQuery"
            placeholder="Produto, cultivar ou lote"
            value={filters.stockQuery}
            onInput={onFilterChange}
            onChange={onFilterChange}
          />
        </label>
        <label>
          Situacao
          <select
            data-filter="stockStatus"
            value={filters.stockStatus}
            onInput={onFilterChange}
            onChange={onFilterChange}
          >
            <option value="all">Todos</option>
            <option value="low">Baixo estoque</option>
            <option value="inactive">Inativos</option>
            <option value="cultivation">Cultivo ativo</option>
          </select>
        </label>
      </div>

      <div className={styles.thead} role="row">
        <span>Produto</span>
        <span>Estoque</span>
        <span>Reservado</span>
        <span>Lotes</span>
        <span>Categoria</span>
        <span>Status</span>
      </div>

      <div className={styles.body} role="list">
        {products.length === 0 ? (
          <p className={styles.empty}>Nenhum produto encontrado para o filtro atual.</p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
