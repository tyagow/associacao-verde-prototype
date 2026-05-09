"use client";

/* Direction B Cultivo panel.
   Renders active cultivation batches as a <table class="adm"> with stage
   pills. Read-only — the create / advance / harvest / dry / move-to-stock
   actions live in CultivoRoute.jsx (under /equipe/cultivo). */

import { pluralize } from "../../components/pluralize.js";
import styles from "./CultivoPanel.module.css";

const STAGE_TONE = { growing: "warn", harvested: "warn", dried: "ok", stocked: "" };

export default function CultivoPanel({ batches }) {
  const active = (batches || []).filter((batch) => batch.status !== "stocked");
  return (
    <section className="panel" aria-label="Cultivo ativo">
      <header className="ph">
        <h3>Cultivo em curso</h3>
        <span className="meta">{pluralize(active.length, "lote", "lotes")} em andamento</span>
      </header>
      {active.length === 0 ? (
        <div className={styles.empty}>
          <div className="adm-empty-state adm-empty-state--inset">
            <span className="adm-empty-state__title">Sem cultivos ativos</span>
            <span className="adm-empty-state__hint">
              Quando um novo batch entrar em vegetativo, ele aparece aqui.
            </span>
          </div>
        </div>
      ) : (
        <table className="adm">
          <colgroup>
            <col style={{ width: 120 }} />
            <col />
            <col style={{ width: 130 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 120 }} />
          </colgroup>
          <thead>
            <tr>
              <th>Lote</th>
              <th>Cultivar</th>
              <th>Semana</th>
              <th>Colheita prevista</th>
              <th className="right">Plantas</th>
              <th className="right">Estim. (g)</th>
              <th>Estágio</th>
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
                    <span className={`pill ${tone}`.trim()}>{stageLabel(batch.status)}</span>
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

export function stageLabel(status) {
  return (
    {
      growing: "vegetativo",
      harvested: "colhido",
      dried: "seco",
      stocked: "estocado",
    }[status] || status
  );
}
