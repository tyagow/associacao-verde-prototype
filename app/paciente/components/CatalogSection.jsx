"use client";

import { useMemo } from "react";
import ProductThumb from "./ProductThumb";
import styles from "./CatalogSection.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// Inline category icons rendered in the filter-chip row. Tiny, minimal-weight
// strokes — the chips lead with the icon to make the row feel like a real
// taxonomy bar instead of unstyled buttons.
function ChipIcon({ kind }) {
  if (kind === "all") {
    return (
      <svg viewBox="0 0 14 14" width="13" height="13" fill="none" aria-hidden="true">
        <circle cx="4" cy="4" r="2" fill="currentColor" opacity="0.85" />
        <circle cx="10" cy="4" r="2" fill="currentColor" opacity="0.85" />
        <circle cx="4" cy="10" r="2" fill="currentColor" opacity="0.85" />
        <circle cx="10" cy="10" r="2" fill="currentColor" opacity="0.85" />
      </svg>
    );
  }
  if (kind === "oil") {
    return (
      <svg viewBox="0 0 14 14" width="13" height="13" fill="none" aria-hidden="true">
        <path
          d="M5 1.5h4v2H5zM5.5 3.5h3v2.5l1 1.5v4a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-4l1-1.5z"
          fill="currentColor"
          opacity="0.85"
        />
      </svg>
    );
  }
  if (kind === "flower") {
    return (
      <svg viewBox="0 0 14 14" width="13" height="13" fill="none" aria-hidden="true">
        <path
          d="M7 1c.4 1.6.6 3.2.6 4.5c0 .4-.2.7-.6.9c-.4-.2-.6-.5-.6-.9C6.4 4.2 6.6 2.6 7 1zM2.4 4c1.4.4 2.7 1.1 3.6 2c.3.3.4.6.3 1c-.4.1-.8 0-1-.3C4.4 5.8 3.3 4.9 2.4 4zM11.6 4c-.9.9-2 1.8-2.9 2.7c-.3.3-.6.4-1 .3c-.1-.4 0-.7.3-1c.9-.9 2.2-1.6 3.6-2zM2.4 10c.9-.9 2-1.8 2.9-2.7c.3-.3.7-.4 1-.3c.1.4 0 .7-.3 1c-.9.9-2.2 1.6-3.6 2zM11.6 10c-1.4-.4-2.7-1.1-3.6-2c-.3-.3-.4-.7-.3-1c.4-.1.7 0 1 .3c.9.9 2 1.8 2.9 2.7z"
          fill="currentColor"
          opacity="0.9"
        />
      </svg>
    );
  }
  if (kind === "edible") {
    return (
      <svg viewBox="0 0 14 14" width="13" height="13" fill="none" aria-hidden="true">
        <ellipse cx="5" cy="8" rx="3.4" ry="3.2" fill="currentColor" opacity="0.85" />
        <ellipse cx="9" cy="6" rx="2.8" ry="2.6" fill="currentColor" opacity="0.55" />
      </svg>
    );
  }
  return null;
}

const DEFAULT_CATEGORIES = [
  { value: "all", label: "Todos", iconKind: "all" },
  { value: "oil", label: "Óleos", iconKind: "oil" },
  { value: "flower", label: "Flores", iconKind: "flower" },
  { value: "edible", label: "Gomas", iconKind: "edible" },
];

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function productCategory(product) {
  if (product.category) return product.category;
  const text = normalizeText(`${product.name} ${product.description} ${product.unit}`);
  if (text.includes("flor") || text.includes("grama") || text.includes("g ")) return "flower";
  if (text.includes("goma") || text.includes("capsula") || text.includes("cx")) return "edible";
  return "oil";
}

/**
 * Compute stock tier for a product. `low` triggers when capacity is unknown
 * but available <= 3, OR when capacity is known and available <= 10% of it.
 * `out` triggers on availableStock <= 0 or an explicit out-of-stock flag.
 */
export function productStockTier(product) {
  const available = Number(product?.availableStock ?? 0);
  if (available <= 0 || product?.outOfStock === true) return "out";
  const capacity = Number(product?.capacity ?? 0);
  if (capacity > 0) {
    if (available <= Math.max(1, Math.floor(capacity * 0.1))) return "low";
  } else if (available <= 3) {
    return "low";
  }
  return "ok";
}

export function filterProducts(products, query, filter) {
  const normalizedQuery = normalizeText(query);
  return products.filter((product) => {
    const cat = productCategory(product);
    const matchesFilter = filter === "all" || cat === filter;
    const haystack = normalizeText(`${product.name} ${product.description} ${product.unit}`);
    const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
    return matchesFilter && matchesQuery;
  });
}

// Eyebrow: short single-line attribute pulled from product metadata (dosage,
// strain hint, or first ~30 chars of description) — surfaces the product's
// character above the title without looking like a paragraph.
function productEyebrow(product) {
  const dosage = String(product?.dosage || "").trim();
  if (dosage) return dosage;
  const unit = String(product?.unit || "").trim();
  const description = String(product?.description || "").trim();
  if (description) {
    const head = description.split(/[·.|–—]/)[0]?.trim();
    if (head && head.length <= 36) return head;
    if (description.length > 32) return description.slice(0, 30).trim() + "…";
    return description;
  }
  return unit || "Produto autorizado";
}

function formatReceitaDate(value) {
  if (!value) return "sem data";
  try {
    return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(
      new Date(`${value}T12:00:00-03:00`),
    );
  } catch {
    return "sem data";
  }
}

function formatConsentDate(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(
      new Date(value),
    );
  } catch {
    return "—";
  }
}

/**
 * Welcome hero for the Pedido tab (empty-cart state).
 * Owns `#patient-summary` so the E2E literal "Receita" stays reachable.
 */
function PedidoWelcomeHero({ patient, productCount = 0 }) {
  const firstName =
    String(patient?.name || "")
      .trim()
      .split(/\s+/)[0] || "de volta";
  const productLabel = productCount === 1 ? "produto liberado" : "produtos liberados";
  return (
    <section id="patient-summary" className={styles.hero} aria-label="Status do paciente e receita">
      {/* Decorative botanical accent — aria-hidden, no layout impact. */}
      <svg className={styles.heroLeaf} viewBox="0 0 80 80" fill="none" aria-hidden="true">
        <g transform="translate(40 40)" fill="var(--green)">
          <path d="M0 -32 Q3 -20 4 -8 Q2 -4 0 0 Q-2 -4 -4 -8 Q-3 -20 0 -32 Z" />
          <path d="M0 -2 Q-8 -14 -18 -22 Q-26 -24 -24 -18 Q-18 -14 -10 -6 Q-4 -2 0 -2 Z" />
          <path d="M0 -2 Q8 -14 18 -22 Q26 -24 24 -18 Q18 -14 10 -6 Q4 -2 0 -2 Z" />
        </g>
      </svg>

      <div className={styles.heroMain}>
        <h1 className={styles.heroTitle}>Bem-vinda de volta, {firstName}</h1>
        <p className={styles.heroLead}>
          Sua receita está válida e você tem <b>{productCount}</b> {productLabel} para pedir hoje.
        </p>
      </div>
      <dl className={styles.heroFacts} aria-label="Resumo do cadastro">
        <div className={styles.heroFact}>
          <dt>Receita</dt>
          <dd>até {formatReceitaDate(patient?.prescriptionExpiresAt)}</dd>
        </div>
        <div className={styles.heroFact}>
          <dt>LGPD</dt>
          <dd>{formatConsentDate(patient?.privacyConsentAt)}</dd>
        </div>
        <div className={styles.heroFact}>
          <dt>Status</dt>
          <dd>
            <span className={styles.heroDot} aria-hidden="true" />
            Liberada
          </dd>
        </div>
      </dl>
    </section>
  );
}

/**
 * Empty-state branch: differentiates "no products at all" from
 * "filter+query produced zero results" with a recovery CTA pair.
 */
function renderEmpty({
  query,
  category,
  categories,
  onQueryChange,
  onCategoryChange,
  productsEmpty,
}) {
  if (productsEmpty) {
    return (
      <div className={styles.empty}>Nenhum produto autorizado encontrado para este filtro.</div>
    );
  }
  const hasQuery = query !== "";
  const isFiltered = category !== "all";
  if (!hasQuery && !isFiltered) {
    return (
      <div className={styles.empty}>Nenhum produto autorizado encontrado para este filtro.</div>
    );
  }
  const catLabel = (categories.find((c) => c.value === category) || {}).label || "esta categoria";
  let heading;
  if (hasQuery && isFiltered) {
    heading = `Sem resultados para "${query}" em ${catLabel}`;
  } else if (hasQuery) {
    heading = `Sem resultados para "${query}"`;
  } else {
    heading = `Sem produtos em ${catLabel}`;
  }
  return (
    <div className={styles.empty}>
      <p className={styles.emptyHeading}>{heading}</p>
      <div className={styles.emptyActions}>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={() => onQueryChange?.("")}
        >
          Limpar busca
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => {
            onQueryChange?.("");
            onCategoryChange?.("all");
          }}
        >
          Ver todos os produtos
        </button>
      </div>
    </div>
  );
}

/**
 * Catalog grid + filter bar for the Pedido tab.
 *
 * Renders the breadcrumb, pagehead, category chips, and the responsive
 * product grid. Products that already exist in `cart` swap their CTA for
 * a qty stepper and gain a green "in cart" border + badge.
 */
export default function CatalogSection({
  products,
  cart,
  patient,
  onAdd,
  onIncrement,
  onDecrement,
  query,
  onQueryChange,
  category,
  onCategoryChange,
  onClear,
  onNotifyRestock,
  categories = DEFAULT_CATEGORIES,
}) {
  // Cart is either a Map<id, qty> or plain object — accept both for safety.
  const getQty = (productId) => {
    if (!cart) return 0;
    if (typeof cart.get === "function") return Number(cart.get(productId) || 0);
    return Number(cart[productId] || 0);
  };

  const cartCount = useMemo(() => {
    if (!cart) return 0;
    if (typeof cart.values === "function") {
      let total = 0;
      for (const value of cart.values()) total += Number(value || 0);
      return total;
    }
    return Object.values(cart).reduce((sum, value) => sum + Number(value || 0), 0);
  }, [cart]);

  const counts = useMemo(() => {
    const acc = { all: 0 };
    for (const product of products) {
      const cat = productCategory(product);
      acc[cat] = (acc[cat] || 0) + 1;
      acc.all += 1;
    }
    return acc;
  }, [products]);

  const visible = useMemo(
    () => filterProducts(products, query, category),
    [products, query, category],
  );

  const activeCategory = category || "all";

  const cartFilled = cartCount > 0;

  return (
    <section className={styles.section} aria-label="Catalogo autorizado">
      {/* Welcome hero owns #patient-summary so the E2E "Receita" literal
          is reachable in both states. When the cart has items it collapses
          to a sr-only block and the breadcrumb takes over visually. */}
      <div className={cartFilled ? styles.heroSr : undefined}>
        <PedidoWelcomeHero patient={patient} productCount={products.length} />
      </div>
      {cartFilled ? (
        <div className={styles.breadcrumb}>
          Pedido em construção &middot; a reserva acontece quando o Pix é gerado.
        </div>
      ) : null}
      <div className={styles.pagehead}>
        <div className={styles.pageheadHead}>
          <span className={styles.eyebrow}>Catálogo</span>
          <h2>Produtos autorizados para você</h2>
          <p className={styles.pageheadLead}>
            Curadoria validada pela equipe da associação. Itens fora de estoque ficam visíveis com
            aviso para você ser notificada quando voltarem.
          </p>
        </div>
        {cartCount > 0 && onClear ? (
          <button type="button" className={styles.clear} onClick={onClear}>
            Limpar carrinho
          </button>
        ) : null}
      </div>

      <div id="catalog-tools" className={styles.tools}>
        <label className={styles.search}>
          <span className="sr-only">Buscar produto autorizado</span>
          <span aria-hidden="true" className={styles.searchIcon}>
            &#128269;
          </span>
          <input
            data-catalog-query
            type="search"
            value={query || ""}
            onChange={(event) => onQueryChange?.(event.target.value)}
            placeholder="Buscar produto autorizado por oleo, flor, goma..."
          />
        </label>

        <div className={styles.cats} role="group" aria-label="Filtrar produtos autorizados">
          {categories.map((c) => {
            const isActive = activeCategory === c.value;
            return (
              <button
                key={c.value}
                type="button"
                data-catalog-filter={c.value}
                className={isActive ? "active" : undefined}
                aria-pressed={isActive}
                onClick={() => onCategoryChange?.(c.value)}
              >
                {c.iconKind ? (
                  <span className={styles.catIcon} aria-hidden="true">
                    <ChipIcon kind={c.iconKind} />
                  </span>
                ) : null}
                <span>{c.label}</span>
                <span className={styles.catN}>{counts[c.value] || 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div id="catalog" className={styles.grid}>
        {visible.length === 0
          ? renderEmpty({
              query: query || "",
              category: activeCategory,
              categories,
              onQueryChange,
              onCategoryChange,
              productsEmpty: products.length === 0,
            })
          : visible.map((product) => {
              const qty = getQty(product.id);
              const inCart = qty > 0;
              const tier = productStockTier(product);
              const stockOut = tier === "out";
              const cat = productCategory(product);
              const eyebrow = productEyebrow(product);
              return (
                <article
                  key={product.id}
                  className={`${styles.product} ${inCart ? styles.productIn : ""} ${stockOut ? styles.productOut : ""}`}
                >
                  <div className={styles.thumbWrap}>
                    <ProductThumb category={cat} productId={product.id} name={product.name} />
                    {inCart ? (
                      <span className={`${styles.badge} ${styles.badgeFrost}`}>
                        &#10003; {qty} no carrinho
                      </span>
                    ) : tier === "low" ? (
                      <span
                        className={`${styles.stockChip} ${styles.stockChipLow}`}
                        data-stock="low"
                      >
                        Últimas {Number(product.availableStock)} un.
                      </span>
                    ) : tier === "out" ? (
                      <span
                        className={`${styles.stockChip} ${styles.stockChipOut}`}
                        data-stock="out"
                      >
                        Esgotado
                      </span>
                    ) : null}
                  </div>
                  <div className={styles.body}>
                    <span className={styles.cardEyebrow}>{eyebrow}</span>
                    <h3>{product.name}</h3>
                    <p className={styles.meta}>
                      {product.unit}
                      {Number.isFinite(Number(product.availableStock))
                        ? ` · ${product.availableStock} em estoque`
                        : ""}
                    </p>
                    <div className={styles.priceRow}>
                      <span className={styles.price}>{money.format(product.priceCents / 100)}</span>
                      <span className={styles.priceUnit}>/un</span>
                    </div>
                    {inCart ? (
                      <div
                        className={styles.qty}
                        role="group"
                        aria-label={`Quantidade de ${product.name}`}
                      >
                        <button
                          type="button"
                          aria-label={`Diminuir ${product.name}`}
                          onClick={() => onDecrement?.(product.id)}
                        >
                          &minus;
                        </button>
                        <span className={styles.qtyValue}>
                          {qty} <span className={styles.qtySuffix}>no carrinho</span>
                        </span>
                        <button
                          type="button"
                          aria-label={`Aumentar ${product.name}`}
                          onClick={() => onIncrement?.(product.id)}
                          disabled={qty >= product.availableStock}
                        >
                          +
                        </button>
                      </div>
                    ) : stockOut ? (
                      <button
                        type="button"
                        className={`${styles.add} ${styles.addRestock}`}
                        onClick={() => onNotifyRestock?.(product.id, product.name)}
                      >
                        Avisar quando voltar
                      </button>
                    ) : (
                      <button
                        type="button"
                        data-add={product.id}
                        className={styles.add}
                        onClick={() => onAdd?.(product.id)}
                      >
                        <span aria-hidden="true" className={styles.addPlus}>
                          +
                        </span>{" "}
                        Adicionar
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
      </div>
    </section>
  );
}
