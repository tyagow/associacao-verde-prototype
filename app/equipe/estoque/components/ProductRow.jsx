"use client";

/* Phase 6 — single product row.

   Click row to expand. Expanded panel hosts inline-edit fields for the four
   ledger metadata properties (lowStockThreshold, category, controlled,
   internalNote) plus the lot detail grid (LotRow children). All edit state
   is optimistic via the parent-supplied `onMetaChange` callback. */

import { useEffect, useState } from "react";
import styles from "./ProductRow.module.css";
import LotRow from "./LotRow.jsx";

const CATEGORY_OPTIONS = [
  ["oil", "Oleo medicinal"],
  ["flower", "Flor medicinal"],
  ["edible", "Produto oral"],
  ["other", "Outro"],
];

const moneyFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function ProductRow({ product, expanded, onToggle, onMetaChange, savingField }) {
  const [draft, setDraft] = useState(initialDraft(product));

  useEffect(() => {
    setDraft(initialDraft(product));
  }, [product.id, product.lowStockThreshold, product.category, product.controlled, product.internalNote]);

  const isLow = product.status === "low";
  const isInactive = product.status === "inactive";

  function commit(field, value) {
    if (value === draft[field]) return;
    setDraft((current) => ({ ...current, [field]: value }));
    onMetaChange(product.id, { [field]: value });
  }

  return (
    <>
      <div
        className={`${styles.row}${isLow ? " " + styles.lowRow : ""}`}
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
      >
        <div className={styles.product}>
          <div className={styles.thumb}>{thumbLabel(product)}</div>
          <div className={styles.productName}>
            <strong>{product.name}</strong>
            <small>
              {product.unit} · {product.controlled ? "controlled" : "open"} ·{" "}
              {moneyFmt.format(product.priceCents / 100)}
            </small>
          </div>
        </div>
        <div className={`${styles.cell}${isLow ? " " + styles.cellLow : ""}`}>
          <strong>
            {product.availableStock} {product.unit}
          </strong>
          <small>limite {product.lowStockThreshold}</small>
        </div>
        <div className={styles.cell}>
          <strong>{product.reserved}</strong>
          <small>{product.reserved ? "em pedidos" : "sem reservas"}</small>
        </div>
        <div className={styles.cell}>
          <strong>{product.lots.length} lote(s)</strong>
          <small>{summarizeLotIds(product.lots)}</small>
        </div>
        <div className={styles.cell}>
          <strong>{categoryLabel(product.category)}</strong>
        </div>
        <span
          className={`${styles.pill} ${
            isInactive ? styles.pillMuted : isLow ? styles.pillWarn : ""
          }`.trim()}
        >
          {isInactive ? "Inativo" : isLow ? "Repor" : "Ativo"}
        </span>
      </div>

      {expanded ? (
        <div className={styles.expand} id={`product-detail-${product.id}`} role="region">
          <div className={styles.editGrid} aria-label="Edicao inline do produto">
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
              {savingField === "lowStockThreshold" ? <span className={styles.saving}>salvando…</span> : null}
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
              {savingField === "category" ? <span className={styles.saving}>salvando…</span> : null}
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
                <option value="false">Nao controlado</option>
              </select>
              {savingField === "controlled" ? <span className={styles.saving}>salvando…</span> : null}
            </label>
            <label>
              Nota interna
              <input
                type="text"
                value={draft.internalNote}
                placeholder="Observacao operacional"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, internalNote: event.target.value }))
                }
                onBlur={(event) => commit("internalNote", event.target.value)}
              />
              {savingField === "internalNote" ? <span className={styles.saving}>salvando…</span> : null}
            </label>
          </div>

          <div className={styles.lots}>
            <div className={styles.lotsHead}>
              <span>Lote</span>
              <span>Quantidade</span>
              <span>Validade</span>
              <span>Origem</span>
            </div>
            {product.lots.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 13 }}>Sem lotes registrados.</p>
            ) : (
              product.lots.map((lot) => <LotRow key={lot.id} lot={lot} />)
            )}
          </div>
        </div>
      ) : null}
    </>
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
      oil: "Oleo medicinal",
      flower: "Flor medicinal",
      edible: "Produto oral",
      other: "Outro",
    }[category] || "Outro"
  );
}

function summarizeLotIds(lots) {
  if (!lots.length) return "Sem lote";
  const ids = lots
    .slice(0, 2)
    .map((lot) => lot.id.replace(/^lot_|^mvt_/, "").slice(0, 6).toUpperCase());
  return ids.join(" · ") + (lots.length > 2 ? ` · +${lots.length - 2}` : "");
}
