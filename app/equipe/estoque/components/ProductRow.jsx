"use client";

/* Phase 3 — Direction B product row.

   Emits <tbody> per product. The main <tr> is clickable (role=button); when
   expanded a sibling <tr> spans all 8 columns and houses (a) the inline-edit
   grid for the four meta fields and (b) an inner <table class="adm"> with
   the lot rows. Edit logic + optimistic UI is unchanged from Phase 6. */

import { useEffect, useState } from "react";
import styles from "./ProductRow.module.css";
import LotRow from "./LotRow.jsx";

const CATEGORY_OPTIONS = [
  ["oil", "Óleo medicinal"],
  ["flower", "Flor medicinal"],
  ["edible", "Produto oral"],
  ["other", "Outro"],
];

const moneyFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function ProductRow({ product, expanded, onToggle, onMetaChange, savingField }) {
  const [draft, setDraft] = useState(initialDraft(product));

  useEffect(() => {
    setDraft(initialDraft(product));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    product.id,
    product.lowStockThreshold,
    product.category,
    product.controlled,
    product.internalNote,
  ]);

  const isLow = product.status === "low";
  const isInactive = product.status === "inactive";

  function commit(field, value) {
    if (value === draft[field]) return;
    setDraft((current) => ({ ...current, [field]: value }));
    onMetaChange(product.id, { [field]: value });
  }

  return (
    <tbody className={isLow ? styles.lowGroup : undefined}>
      <tr
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-controls={`product-detail-${product.id}`}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggle();
          }
        }}
        data-product-id={product.id}
        className={styles.row}
      >
        <td>
          <span className="mono">{skuLabel(product)}</span>
        </td>
        <td>
          <div className={styles.product}>
            <span className={styles.thumb} aria-hidden>
              {thumbLabel(product)}
            </span>
            <div className={styles.productName}>
              <span className={styles.name}>{product.name}</span>
              <span className={styles.subline}>
                {product.unit} · {product.controlled ? "controlled" : "open"} ·{" "}
                {moneyFmt.format(product.priceCents / 100)}
              </span>
            </div>
          </div>
        </td>
        <td>
          <span className={styles.editable}>{categoryLabel(product.category)}</span>
        </td>
        <td className="right num">{product.availableStock}</td>
        <td className="right num">{product.reserved}</td>
        <td className="right num">{product.lots.length}</td>
        <td>
          <span className={`${styles.editable} num`}>≤ {product.lowStockThreshold}</span>
        </td>
        <td>
          <span className={`pill ${isInactive ? "" : isLow ? "warn" : "ok"}`.trim()}>
            {isInactive ? "Inativo" : isLow ? "baixo" : "OK"}
          </span>
        </td>
      </tr>

      {expanded ? (
        <tr id={`product-detail-${product.id}`}>
          <td colSpan={8} className={styles.expand}>
            <div className={styles.editGrid} aria-label="Edição inline do produto">
              <label>
                Limite de baixo estoque
                <input
                  type="number"
                  min="0"
                  value={draft.lowStockThreshold}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, lowStockThreshold: event.target.value }))
                  }
                  onBlur={(event) => commit("lowStockThreshold", Number(event.target.value))}
                />
                {savingField === "lowStockThreshold" ? (
                  <span className={styles.saving}>salvando…</span>
                ) : null}
              </label>
              <label>
                Categoria
                <select
                  value={draft.category}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDraft((current) => ({ ...current, category: value }));
                    commit("category", value);
                  }}
                >
                  {CATEGORY_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                {savingField === "category" ? (
                  <span className={styles.saving}>salvando…</span>
                ) : null}
              </label>
              <label>
                Controle
                <select
                  value={draft.controlled ? "true" : "false"}
                  onChange={(event) => {
                    const value = event.target.value === "true";
                    setDraft((current) => ({ ...current, controlled: value }));
                    commit("controlled", value);
                  }}
                >
                  <option value="true">Controlado</option>
                  <option value="false">Não controlado</option>
                </select>
                {savingField === "controlled" ? (
                  <span className={styles.saving}>salvando…</span>
                ) : null}
              </label>
              <label className={styles.wide}>
                Nota interna
                <input
                  type="text"
                  value={draft.internalNote}
                  placeholder="Observação operacional"
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, internalNote: event.target.value }))
                  }
                  onBlur={(event) => commit("internalNote", event.target.value)}
                />
                {savingField === "internalNote" ? (
                  <span className={styles.saving}>salvando…</span>
                ) : null}
              </label>
            </div>

            <div className={styles.lotsWrap}>
              <h4 className={styles.lotsHead}>Lotes ativos · {product.name}</h4>
              {product.lots.length === 0 ? (
                <p className={styles.lotsEmpty}>Sem lotes registrados.</p>
              ) : (
                <table className="adm" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Lote</th>
                      <th className="right">Quantidade</th>
                      <th>Validade</th>
                      <th>Origem</th>
                      <th className="right">Reservado</th>
                      <th aria-label="Ações" />
                    </tr>
                  </thead>
                  <tbody>
                    {product.lots.map((lot) => (
                      <LotRow key={lot.id} lot={lot} />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </td>
        </tr>
      ) : null}
    </tbody>
  );
}

function initialDraft(product) {
  return {
    lowStockThreshold: product.lowStockThreshold ?? 5,
    category: product.category || "other",
    controlled: product.controlled === true,
    internalNote: product.internalNote || "",
  };
}

function thumbLabel(product) {
  if (/cbd/i.test(product.name)) return "CBD";
  if (/full/i.test(product.name)) return "FS";
  if (/flor|24k/i.test(product.name)) return "FLR";
  return product.name.slice(0, 3).toUpperCase();
}

function categoryLabel(category) {
  return (
    {
      oil: "Óleo",
      flower: "Flor",
      edible: "Goma",
      other: "Outro",
    }[category] || "Outro"
  );
}

function skuLabel(product) {
  // Best-effort short SKU from product.id (stable, monospace-friendly).
  const tail = String(product.id || "")
    .replace(/^(prod_|product_)/i, "")
    .slice(-6)
    .toUpperCase();
  return `PRD-${tail || "0000"}`;
}
