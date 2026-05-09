"use client";

/* Phase 6 — Estoque & cultivo route (rebuild).

   Single product ledger (Produto · Estoque · Reservado · Lotes · Categoria
   · Status) with click-to-expand lot detail (Lote · Quantidade · Validade
   · Origem) and inline edit of lowStockThreshold, category, controlled,
   internalNote per product. Cultivo lives in a sibling panel below.

   Mounts the TeamShell so the sidebar / topbar / footer / Cmd-K palette
   work consistently with the rest of the team app.

   E2E invariants preserved (scripts/e2e-production-app.py):
     - "Produtos, estoque e cultivo" kicker text remains in the body.
     - [data-filter='stockQuery'] and [data-filter='stockStatus'] still
       drive the ledger filter.
     - The legacy management forms (#product-form, #product-update-form,
       #stock-form) stay in the DOM inside the bottom <details> drawers
       so any future selectors remain reachable. The cultivation forms
       (#cultivation-form, #cultivation-update-form, [data-cultivation-
       action]) moved to /equipe/cultivo — see CultivoRoute.jsx.

   Data sources:
     - /api/team/dashboard → session check + cultivation batches +
       reservation totals (legacy payload, untouched).
     - /api/team/inventory-ledger → Phase 6 product+lots payload.
     - POST /api/team/product-meta → inline-edit PATCH (optimistic UI).
*/

import { useCallback, useEffect, useMemo, useState } from "react";

import TeamShell from "../components/TeamShell";
import PageHead from "../components/PageHead";
import StatusStrip from "../components/StatusStrip";
import ProductLedger from "./components/ProductLedger.jsx";
import ProductRow from "./components/ProductRow.jsx";
import { pluralWord } from "../components/pluralize.js";

export default function StockRoute() {
  const [session, setSession] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [filters, setFilters] = useState({ stockQuery: "", stockStatus: "all" });
  const [expandedProductId, setExpandedProductId] = useState(null);
  const [busy, setBusy] = useState("");
  const [savingMeta, setSavingMeta] = useState({}); // { [productId]: fieldName }
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isTeam = session?.role === "team";

  const loadAll = useCallback(async () => {
    setError("");
    const [sessionPayload, dashboardPayload, ledgerPayload] = await Promise.all([
      api("/api/session"),
      api("/api/team/dashboard").catch(() => null),
      api("/api/team/inventory-ledger").catch(() => null),
    ]);
    setSession(sessionPayload.session || null);
    setDashboard(dashboardPayload || null);
    setLedger(ledgerPayload || null);
  }, []);

  useEffect(() => {
    let active = true;
    loadAll().catch((nextError) => {
      if (active) setError(nextError.message);
    });
    return () => {
      active = false;
    };
  }, [loadAll]);

  const products = useMemo(() => ledger?.products || [], [ledger]);
  const batches = useMemo(() => dashboard?.cultivationBatches || [], [dashboard]);
  const reservations = useMemo(
    () => (dashboard?.reservations || []).filter((r) => r.status === "active"),
    [dashboard],
  );

  const filteredProducts = useMemo(() => filterProducts(products, filters), [products, filters]);
  const totals = useMemo(
    () => ({
      productCount: products.length,
      lowStockCount: products.filter((p) => p.status === "low").length,
      activeReservations: reservations.length,
      lotCount: products.reduce((sum, p) => sum + p.lots.length, 0),
    }),
    [products, reservations.length],
  );

  function updateFilter(event) {
    const { filter } = event.currentTarget.dataset;
    const { value } = event.currentTarget;
    setFilters((current) => ({ ...current, [filter]: value }));
  }

  function toggleExpanded(productId) {
    setExpandedProductId((current) => (current === productId ? null : productId));
  }

  async function commitMeta(productId, patch) {
    const [field] = Object.keys(patch);
    // Optimistic UI: update local ledger immediately, send PATCH, then
    // re-fetch on success or roll back on failure.
    const previous = ledger;
    setLedger((current) => optimisticPatch(current, productId, patch));
    setSavingMeta((current) => ({ ...current, [productId]: field }));
    setError("");
    try {
      await api("/api/team/product-meta", {
        method: "POST",
        body: { productId, ...patch },
      });
      setMessage("Produto atualizado.");
      const refreshed = await api("/api/team/inventory-ledger").catch(() => null);
      if (refreshed) setLedger(refreshed);
    } catch (nextError) {
      setLedger(previous);
      setError(nextError.message);
    } finally {
      setSavingMeta((current) => {
        const next = { ...current };
        delete next[productId];
        return next;
      });
    }
  }

  async function logout() {
    setBusy("logout");
    try {
      await api("/api/logout", { method: "POST" });
      setSession(null);
      setDashboard(null);
      setLedger(null);
    } finally {
      setBusy("");
    }
  }

  if (!isTeam) {
    return (
      <main>
        <div className="app-layout">
          <section className="surface-stack">
            <article className="panel">
              <div className="section-heading">
                <div>
                  <p className="kicker">Produtos, estoque e cultivo</p>
                  <h2>Acesso restrito</h2>
                  <p className="muted">Entre como equipe para abrir o estoque privado.</p>
                </div>
              </div>
              {error ? <p className="pill danger">{error}</p> : null}
            </article>
          </section>
        </div>
      </main>
    );
  }

  return (
    <TeamShell
      session={session}
      dashboard={dashboard}
      currentRoute="/equipe/estoque"
      onLogout={logout}
      busy={!!busy}
    >
      <PageHead
        title="Produtos, estoque e cultivo"
        meta={`Atualizado ${formatNow()} · clique no produto para abrir lotes`}
        actions={
          <>
            <button
              type="button"
              className="btn ghost mini"
              onClick={() => openDrawerToForm("#stock-form")}
            >
              + Lote
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => openDrawerToForm("#product-form")}
            >
              + Produto
            </button>
          </>
        }
      />

      <StatusStrip
        chips={[
          { label: "produtos", count: totals.productCount },
          {
            label: "abaixo do limiar",
            count: totals.lowStockCount,
            tone: totals.lowStockCount > 0 ? "warn" : undefined,
          },
          {
            label: pluralWord(totals.lotCount, "lote rastreado", "lotes rastreados"),
            count: totals.lotCount,
          },
          {
            label: pluralWord(
              batches.filter((b) => b.status !== "stocked").length,
              "cultivo em curso",
              "cultivos em curso",
            ),
            count: batches.filter((b) => b.status !== "stocked").length,
            tone: "ok",
          },
        ]}
        segments={[
          {
            label: "Todos",
            count: totals.productCount,
            active: filters.stockStatus === "all",
            onClick: () => setFilters((c) => ({ ...c, stockStatus: "all" })),
          },
          {
            label: "Baixo",
            count: totals.lowStockCount,
            active: filters.stockStatus === "low",
            onClick: () => setFilters((c) => ({ ...c, stockStatus: "low" })),
          },
          {
            label: "OK",
            count: totals.productCount - totals.lowStockCount,
            active: filters.stockStatus === "ok",
            onClick: () => setFilters((c) => ({ ...c, stockStatus: "ok" })),
          },
        ]}
        filters={
          <>
            <label className="srOnly" htmlFor="stock-query">
              Buscar
            </label>
            <input
              id="stock-query"
              data-filter="stockQuery"
              placeholder="Filtrar produtos (CBD, Flor…)"
              value={filters.stockQuery}
              onInput={updateFilter}
              onChange={updateFilter}
            />
            <label className="srOnly" htmlFor="stock-status">
              Situação
            </label>
            <select
              id="stock-status"
              data-filter="stockStatus"
              value={filters.stockStatus}
              onInput={updateFilter}
              onChange={updateFilter}
            >
              <option value="all">Todos os status</option>
              <option value="low">Baixo</option>
              <option value="ok">OK</option>
              <option value="inactive">Inativos</option>
            </select>
          </>
        }
        onRefresh={() => loadAll().catch((nextError) => setError(nextError.message))}
        resultCount={filteredProducts.length}
        resultLabel="produtos visíveis"
      />

      {message ? <p className="status">{message}</p> : null}
      {error ? <p className="pill danger">{error}</p> : null}

      <div className="stack">
        <ProductLedger>
          {filteredProducts.map((product) => (
            <ProductRow
              key={product.id}
              product={product}
              expanded={expandedProductId === product.id}
              onToggle={() => toggleExpanded(product.id)}
              onMetaChange={commitMeta}
              savingField={savingMeta[product.id] || ""}
            />
          ))}
        </ProductLedger>

        <LegacyManagementDrawers
          isTeam={isTeam}
          products={products}
          busy={busy}
          setBusy={setBusy}
          setMessage={setMessage}
          setError={setError}
          reload={loadAll}
        />
      </div>
    </TeamShell>
  );
}

// Legacy management forms preserved as collapsible drawers so any old E2E
// selector or operator workflow keeps working. Behavior is unchanged from
// the pre-Phase-6 route; only the visual home shifted to a <details>.
function LegacyManagementDrawers({
  isTeam,
  products,
  busy,
  setBusy,
  setMessage,
  setError,
  reload,
}) {
  const productOptions = useMemo(
    () =>
      products.map((product) => ({
        value: product.id,
        label: `${product.name} (${product.availableStock} ${product.unit})`,
      })),
    [products],
  );

  async function run(action, success, callback) {
    setBusy(action);
    setError("");
    setMessage("");
    try {
      await callback();
      await reload();
      setMessage(success);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusy("");
    }
  }

  async function submitForm(event, action, success) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form));
    await run(action, success, async () => {
      if (action === "product-create") {
        payload.stock = Number(payload.stock);
        payload.priceReais = Number(payload.priceReais);
        await api("/api/team/products", { method: "POST", body: payload });
      }
      if (action === "product-update") {
        if (!payload.priceReais) delete payload.priceReais;
        await api("/api/team/products/update", { method: "POST", body: payload });
      }
      if (action === "stock-add") {
        payload.quantity = Number(payload.quantity);
        await api("/api/team/stock", { method: "POST", body: payload });
      }
      form.reset();
    });
  }

  return (
    <section className="management-drawers" aria-label="Ações de gestão de estoque">
      <details>
        <summary>Criar produto</summary>
        <form
          id="product-form"
          className="inline-form compact-management-form"
          onSubmit={(event) =>
            submitForm(event, "product-create", "Produto criado no catálogo privado.")
          }
        >
          <label>
            Novo produto
            <input
              name="name"
              placeholder="Oleo CBD 5%"
              required
              disabled={!isTeam || busy === "product-create"}
            />
          </label>
          <label>
            Unidade
            <input
              name="unit"
              placeholder="frasco"
              required
              disabled={!isTeam || busy === "product-create"}
            />
          </label>
          <label>
            Preço R$
            <input
              name="priceReais"
              type="number"
              min="1"
              step="0.01"
              defaultValue="100"
              required
              disabled={!isTeam || busy === "product-create"}
            />
          </label>
          <label>
            Estoque inicial
            <input
              name="stock"
              type="number"
              min="0"
              defaultValue="0"
              required
              disabled={!isTeam || busy === "product-create"}
            />
          </label>
          <label>
            Categoria
            <CategorySelect
              name="category"
              defaultValue="oil"
              disabled={!isTeam || busy === "product-create"}
            />
          </label>
          <label>
            Alerta mínimo
            <input
              name="lowStockThreshold"
              type="number"
              min="0"
              defaultValue="5"
              disabled={!isTeam || busy === "product-create"}
            />
          </label>
          <label>
            Controle
            <ControlSelect
              name="controlled"
              defaultValue="true"
              disabled={!isTeam || busy === "product-create"}
            />
          </label>
          <label className="wide-field">
            Nota interna
            <input
              name="internalNote"
              placeholder="Restrição, lote, receita, cuidado operacional"
              disabled={!isTeam || busy === "product-create"}
            />
          </label>
          <button className="primary" type="submit" disabled={!isTeam || busy === "product-create"}>
            {busy === "product-create" ? "Criando..." : "Criar produto"}
          </button>
        </form>
      </details>

      <details>
        <summary>Editar produto</summary>
        <form
          id="product-update-form"
          className="inline-form compact-management-form"
          onSubmit={(event) =>
            submitForm(event, "product-update", "Produto atualizado no catálogo privado.")
          }
        >
          <label>
            Produto
            <SelectOptions
              name="productId"
              id="product-update-select"
              options={productOptions}
              disabled={!isTeam || !products.length || busy === "product-update"}
            />
          </label>
          <label>
            Preço R$
            <input
              name="priceReais"
              type="number"
              min="1"
              step="0.01"
              placeholder="Novo preco"
              disabled={!isTeam || busy === "product-update"}
            />
          </label>
          <label>
            Disponibilidade
            <select name="active" disabled={!isTeam || busy === "product-update"}>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </label>
          <button
            className="primary"
            type="submit"
            disabled={!isTeam || !products.length || busy === "product-update"}
          >
            {busy === "product-update" ? "Atualizando..." : "Atualizar produto"}
          </button>
        </form>
      </details>

      <details>
        <summary>Adicionar estoque</summary>
        <form
          id="stock-form"
          className="inline-form compact-management-form"
          onSubmit={(event) => submitForm(event, "stock-add", "Estoque atualizado no servidor.")}
        >
          <label>
            Produto
            <SelectOptions
              name="productId"
              id="stock-product"
              options={productOptions}
              disabled={!isTeam || !products.length || busy === "stock-add"}
            />
          </label>
          <label>
            Quantidade
            <input
              name="quantity"
              type="number"
              min="1"
              defaultValue="1"
              required
              disabled={!isTeam || busy === "stock-add"}
            />
          </label>
          <label className="wide-field">
            Observação
            <input
              name="note"
              placeholder="Entrada conferida no estoque"
              disabled={!isTeam || busy === "stock-add"}
            />
          </label>
          <button
            className="primary"
            type="submit"
            disabled={!isTeam || !products.length || busy === "stock-add"}
          >
            {busy === "stock-add" ? "Adicionando..." : "Adicionar estoque"}
          </button>
        </form>
      </details>
      {/*
        Cultivation forms (#cultivation-form, #cultivation-update-form,
        [data-cultivation-action]) moved to /equipe/cultivo. StockRoute
        keeps only product + stock entry forms.
      */}
    </section>
  );
}

function SelectOptions({ options, ...props }) {
  return (
    <select {...props}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function CategorySelect({ ...props }) {
  return (
    <select {...props}>
      <option value="oil">Oleo medicinal</option>
      <option value="flower">Flor medicinal</option>
      <option value="edible">Produto oral</option>
      <option value="other">Outro</option>
    </select>
  );
}

function ControlSelect({ ...props }) {
  return (
    <select {...props}>
      <option value="true">Controlado</option>
      <option value="false">Nao controlado</option>
    </select>
  );
}

/* B1 fix: openDrawerToForm opens the parent <details> before scrolling.
   The legacy stock/cultivation/product forms live inside collapsed
   <details> drawers; without `open=""` the form stays hidden after the
   scrollIntoView fires and operators see "the button does nothing". */
function openDrawerToForm(selector) {
  if (typeof document === "undefined") return;
  const target = document.querySelector(selector);
  if (!target) return;
  const drawer = target.closest("details");
  if (drawer) drawer.open = true;
  // Defer to allow the disclosure to expand before scrolling.
  requestAnimationFrame(() => {
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    const firstInput = target.querySelector("input, select, textarea");
    if (firstInput && typeof firstInput.focus === "function") firstInput.focus();
  });
}

function filterProducts(products, filters) {
  const query = String(filters.stockQuery || "")
    .trim()
    .toLowerCase();
  const status = filters.stockStatus;
  return products.filter((product) => {
    const matchesQuery =
      !query ||
      [
        product.name,
        product.id,
        product.description,
        product.unit,
        product.category,
        product.internalNote,
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(query),
      ) ||
      product.lots.some((lot) =>
        [lot.id, lot.origin, lot.validity].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(query),
        ),
      );
    const matchesStatus =
      status === "all" ||
      (status === "low" && product.status === "low") ||
      (status === "ok" && product.status !== "low" && product.status !== "inactive") ||
      (status === "inactive" && product.status === "inactive");
    return matchesQuery && matchesStatus;
  });
}

function optimisticPatch(ledger, productId, patch) {
  if (!ledger) return ledger;
  return {
    ...ledger,
    products: ledger.products.map((product) =>
      product.id === productId
        ? {
            ...product,
            ...normalizeMetaPatch(patch),
          }
        : product,
    ),
  };
}

function normalizeMetaPatch(patch) {
  const next = { ...patch };
  if ("controlled" in next)
    next.controlled = next.controlled === true || next.controlled === "true";
  if ("lowStockThreshold" in next) next.lowStockThreshold = Number(next.lowStockThreshold);
  return next;
}

function formatNow() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : {},
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Erro na requisição.");
  }
  return payload;
}
