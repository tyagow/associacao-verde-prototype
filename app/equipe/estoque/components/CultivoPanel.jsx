"use client";

/* Phase 6 — Cultivo panel.

   Sibling of the product ledger; visualizes active cultivation batches as
   a fact grid (Lote · Plantas · Previsao · Proxima colheita). The legacy
   action forms (criar / avancar / colher / peso seco / mover para estoque)
   stay in the page-level `details` drawer in StockRoute so the data is
   still reachable, but this panel itself stays read-only. */

import styles from "./CultivoPanel.module.css";

export default function CultivoPanel({ batches }) {
  const active = batches.filter((batch) => batch.status !== "stocked");
  return (
    <section className={styles.panel} aria-label="Cultivo ativo">
      <header className={styles.head}>
        <strong className={styles.title}>Cultivo</strong>
        <span className={styles.subtitle}>
          {active.length} lote(s) em andamento
        </span>
      </header>

      {active.length === 0 ? (
        <p className={styles.empty}>Nenhum lote de cultivo ativo no momento.</p>
      ) : (
        active.map((batch) => (
          <div key={batch.id} className={styles.facts}>
            <div className={styles.fact}>
              <span>Lote</span>
              <strong>
                {batch.strain} · semana {batch.week}
              </strong>
              <small>{statusLabel(batch.status)}</small>
            </div>
            <div className={styles.fact}>
              <span>Plantas</span>
              <strong>{batch.plants} plantas</strong>
              <small>cultivo organico</small>
            </div>
            <div className={styles.fact}>
              <span>Colheita</span>
              <strong>{batch.harvested ? `${batch.harvested} g` : "ainda nao colhido"}</strong>
              <small>{batch.dried ? `seco ${batch.dried} g` : "aguardando peso seco"}</small>
            </div>
            <div className={styles.fact}>
              <span>Produto vinculado</span>
              <strong>{batch.productId || "sem vinculo"}</strong>
              <small>destino do lote final</small>
            </div>
          </div>
        ))
      )}
    </section>
  );
}

function statusLabel(status) {
  return (
    {
      growing: "growing",
      harvested: "harvested",
      dried: "dried",
      stocked: "stocked",
    }[status] || status
  );
}
