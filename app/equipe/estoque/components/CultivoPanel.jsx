"use client";

/* Phase 3 — Direction B Cultivo panel.

   Sibling of the product ledger; renders active cultivation batches as a
   single <table class="adm"> with stage pills. Read-only — the legacy
   create / advance / harvest / dry / move-to-stock actions live in the
   <details> drawer in StockRoute.jsx. */

import styles from "./CultivoPanel.module.css";

const STAGE_TONE = { growing: "warn", harvested: "warn", dried: "ok", stocked: "" };

export default function CultivoPanel({ batches }) {
  const active = (batches || []).filter((batch) => batch.status !== "stocked");
  return (
    <section className="panel" aria-label="Cultivo ativo">
      <header className="ph">
        <h3>Cultivo em curso</h3>
        <span className="meta">{active.length} lote(s) em andamento</span>
      </header>
      {active.length === 0 ? (
        <div className={styles.empty}>
          <div
            className="adm-empty-state"
            style={{ border: 0, background: "transparent", padding: 0 }}
          >
            <span className="adm-empty-state__title">Sem cultivos ativos</span>
            <span className="adm-empty-state__hint">
              Quando um novo batch entrar em vegetativo, ele aparece aqui.
            </span>
          </div>
        </div>
      ) : (
        <table className="adm">
          <thead>
            <tr>
              <th style={{ width: 120 }}>Batch</th>
              <th>Strain</th>
              <th style={{ width: 130 }}>Plantio</th>
              <th style={{ width: 130 }}>Estimativa</th>
              <th className="right" style={{ width: 90 }}>
                Plantas
              </th>
              <th className="right" style={{ width: 120 }}>
                Estim. (g)
              </th>
              <th style={{ width: 120 }}>Stage</th>
            </tr>
          </thead>
          <tbody>
            {active.map((batch) => {
              const tone = STAGE_TONE[batch.status] ?? "";
              return (
                <tr key={batch.id}>
                  <td>
                    <span className="mono">{batchLabel(batch)}</span>
                  </td>
                  <td>{batch.strain}</td>
                  <td className="num">semana {batch.week}</td>
                  <td className="num">{batch.harvestEta || "—"}</td>
                  <td className="right num">{batch.plants}</td>
                  <td className="right num">{batch.estimatedGrams ?? batch.harvested ?? "—"}</td>
                  <td>
                    <span className={`pill ${tone}`.trim()}>{statusLabel(batch.status)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

function batchLabel(batch) {
  const tail = String(batch.id || "")
    .slice(-4)
    .toUpperCase();
  return `CV-${tail || "0000"}`;
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
