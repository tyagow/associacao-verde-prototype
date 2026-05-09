"use client";

import { useMemo } from "react";
import styles from "./CatalogSection.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const DEFAULT_CATEGORIES = [
  { value: "all", label: "Todos" },
  { value: "oil", label: "Oleos" },
  { value: "flower", label: "Flores" },
  { value: "edible", label: "Gomas" },
];

const CATEGORY_GRADIENTS = {
  oil: "linear-gradient(135deg, var(--green-tint), var(--green))",
  flower: "linear-gradient(135deg, var(--gold-soft), var(--gold-deep))",
  edible: "linear-gradient(135deg, var(--danger-soft), var(--gold))",
  default: "linear-gradient(135deg, var(--gold-soft), var(--gold))",
};

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

function productMonogram(product) {
  const source = String(product.name || "").trim();
  if (!source) return "AB";
  const tokens = source.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    return `${tokens[0][0] || ""}${tokens[1][0] || ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function productThumbStyle(product) {
  if (product.thumbStyle) return { background: product.thumbStyle };
  const cat = productCategory(product);
  return { background: CATEGORY_GRADIENTS[cat] || CATEGORY_GRADIENTS.default };
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
function PedidoWelcomeHero({ patient }) {
  const firstName =
    String(patient?.name || "")
      .trim()
      .split(/\s+/)[0] || "de volta";
  return (
    <section id="patient-summary" className={styles.hero} aria-label="Status do paciente e receita">
      <div className={styles.heroMain}>
        <span className={styles.heroKicker}>Bem-vinda de volta</span>
        <h1 className={styles.heroTitle}>Tudo certo para fazer um pedido, {firstName}</h1>
        <p className={styles.heroLead}>
          Sua receita está válida e você está liberada para comprar produtos autorizados.
        </p>
      </div>
      <div className={styles.heroReceipt}>
        <div>
          Receita válida até <b>{formatReceitaDate(patient?.prescriptionExpiresAt)}</b>
        </div>
        <div>
          LGPD aceita <b>{formatConsentDate(patient?.privacyConsentAt)}</b>
        </div>
        <div>
          Status <b>Liberada</b>
        </div>
      </div>
    </section>
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
        <PedidoWelcomeHero patient={patient} />
      </div>
      {cartFilled ? (
        <div className={styles.breadcrumb}>
          Pedido em construcao &middot; A reserva acontece quando o Pix e gerado
        </div>
      ) : null}
      <div className={styles.pagehead}>
        <h1>Catalogo autorizado</h1>
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
                {c.label}
                <span className={styles.catN}>{counts[c.value] || 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div id="catalog" className={styles.grid}>
        {visible.length === 0 ? (
          <div className={styles.empty}>Nenhum produto autorizado encontrado para este filtro.</div>
        ) : (
          visible.map((product) => {
            const qty = getQty(product.id);
            const inCart = qty > 0;
            const stockOut = product.availableStock <= 0;
            return (
              <article
                key={product.id}
                className={`${styles.product} ${inCart ? styles.productIn : ""}`}
              >
                {inCart ? <span className={styles.badge}>&#10003; {qty} no carrinho</span> : null}
                <div className={styles.thumb} style={productThumbStyle(product)} aria-hidden="true">
                  {productMonogram(product)}
                </div>
                <div className={styles.body}>
                  <h3>{product.name}</h3>
                  <p className={styles.meta}>
                    {product.description || product.unit}
                    <br />
                    {product.availableStock} {product.unit} em estoque
                  </p>
                  <div className={styles.row}>
                    <span className={styles.price}>{money.format(product.priceCents / 100)}</span>
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
                        <span className={styles.qtyValue}>{qty}</span>
                        <button
                          type="button"
                          aria-label={`Aumentar ${product.name}`}
                          onClick={() => onIncrement?.(product.id)}
                          disabled={qty >= product.availableStock}
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        data-add={product.id}
                        className={styles.add}
                        disabled={stockOut}
                        onClick={() => onAdd?.(product.id)}
                      >
                        {stockOut ? "Sem estoque" : "Adicionar"}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
