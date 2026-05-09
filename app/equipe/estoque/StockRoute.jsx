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
       #stock-form, #cultivation-form, #cultivation-update-form) stay in
       the DOM inside the bottom <details> drawers so any future selectors
       remain reachable.

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
import CultivoPanel from "./components/CultivoPanel.jsx";

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
              onClick={() =>
                document
                  .querySelector("#cultivation-form")
                  ?.scrollIntoView({ behavior: "smooth", block: "center" })
              }
            >
              + Lote
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() =>
                document
                  .querySelector("#product-form")
                  ?.scrollIntoView({ behavior: "smooth", block: "center" })
              }
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
          { label: "lotes rastreados", count: totals.lotCount },
          {
            label: "cultivos em curso",
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
              <option value="cultivation">Cultivo ativo</option>
            </select>
          </>
        }
        onRefresh={() => loadAll().catch((nextError) => setError(nextError.message))}
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

        <CultivoPanel batches={batches} />

        <LegacyManagementDrawers
          isTeam={isTeam}
          products={products}
          batches={batches}
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
  batches,
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
  const batchOptions = useMemo(
    () =>
      batches.map((batch) => ({
        value: batch.id,
        label: `${batch.strain} - semana ${batch.week} - ${batch.status}`,
      })),
    [batches],
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
      if (action === "cultivation-create") {
        payload.plants = Number(payload.plants);
        payload.week = Number(payload.week);
        await api("/api/team/cultivation-batches", { method: "POST", body: payload });
      }
      form.reset();
    });
  }

  async function submitCultivationAction(action) {
    const form = document.querySelector("#cultivation-update-form");
    const data = Object.fromEntries(new FormData(form));
    const requestBody = { batchId: data.batchId };
    let path = "/api/team/cultivation-batches/advance";
    if (action === "harvest") {
      path = "/api/team/cultivation-batches/harvest";
      requestBody.harvested = Number(data.amount);
    }
    if (action === "dry") {
      path = "/api/team/cultivation-batches/dry";
      requestBody.dried = Number(data.amount);
    }
    if (action === "stock") {
      path = "/api/team/cultivation-batches/stock";
      requestBody.productId = data.productId;
    }
    await run(`cultivation-${action}`, "Lote de cultivo atualizado.", async () => {
      await api(path, { method: "POST", body: requestBody });
    });
  }

  return (
    <section className="management-drawers" aria-label="Acoes de gestao de estoque">
      <details>
        <summary>Criar produto</summary>
        <form
          id="product-form"
          className="inline-form compact-management-form"
          onSubmit={(event) =>
            submitForm(event, "product-create", "Produto criado no catalogo privado.")
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
            Preco R$
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
            Alerta minimo
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
              placeholder="Restricao, lote, receita, cuidado operacional"
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
            submitForm(event, "product-update", "Produto atualizado no catalogo privado.")
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
            Preco R$
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
        <summary>Entrada e cultivo</summary>
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
            Observacao
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

        <form
          id="cultivation-form"
          className="inline-form compact-management-form"
          onSubmit={(event) => submitForm(event, "cultivation-create", "Lote de cultivo criado.")}
        >
          <label>
            Cultivar
            <input
              name="strain"
              placeholder="24k"
              required
              disabled={!isTeam || busy === "cultivation-create"}
            />
          </label>
          <label>
            Produto vinculado
            <SelectOptions
              name="productId"
              id="cultivation-product"
              options={productOptions}
              disabled={!isTeam || !products.length || busy === "cultivation-create"}
            />
          </label>
          <label>
            Plantas
            <input
              name="plants"
              type="number"
              min="1"
              defaultValue="1"
              required
              disabled={!isTeam || busy === "cultivation-create"}
            />
          </label>
          <label>
            Semana
            <input
              name="week"
              type="number"
              min="1"
              defaultValue="1"
              required
              disabled={!isTeam || busy === "cultivation-create"}
            />
          </label>
          <button
            className="primary"
            type="submit"
            disabled={!isTeam || busy === "cultivation-create"}
          >
            {busy === "cultivation-create" ? "Criando..." : "Criar lote"}
          </button>
        </form>

        <form
          id="cultivation-update-form"
          className="inline-form compact-management-form action-form"
        >
          <label>
            Lote
            <SelectOptions
              name="batchId"
              id="cultivation-batch"
              options={batchOptions}
              disabled={!isTeam || !batches.length || busy.startsWith("cultivation-")}
            />
          </label>
          <label>
            Peso g
            <input
              name="amount"
              type="number"
              min="1"
              defaultValue="1"
              disabled={!isTeam || busy.startsWith("cultivation-")}
            />
          </label>
          <label>
            Produto para estoque
            <SelectOptions
              name="productId"
              id="cultivation-stock-product"
              options={productOptions}
              disabled={!isTeam || !products.length || busy.startsWith("cultivation-")}
            />
          </label>
          <button
            className="primary"
            type="button"
            data-cultivation-action="advance"
            disabled={!isTeam || !batches.length || busy === "cultivation-advance"}
            onClick={() => submitCultivationAction("advance")}
          >
            Avancar semana
          </button>
          <button
            className="primary"
            type="button"
            data-cultivation-action="harvest"
            disabled={!isTeam || !batches.length || busy === "cultivation-harvest"}
            onClick={() => submitCultivationAction("harvest")}
          >
            Colheita
          </button>
          <button
            className="primary"
            type="button"
            data-cultivation-action="dry"
            disabled={!isTeam || !batches.length || busy === "cultivation-dry"}
            onClick={() => submitCultivationAction("dry")}
          >
            Peso seco
          </button>
          <button
            className="primary"
            type="button"
            data-cultivation-action="stock"
            disabled={
              !isTeam || !batches.length || !products.length || busy === "cultivation-stock"
            }
            onClick={() => submitCultivationAction("stock")}
          >
            Mover para estoque
          </button>
        </form>
      </details>
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
      (status === "inactive" && product.status === "inactive") ||
      (status === "cultivation" && true);
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
    throw new Error(payload.error || "Erro na requisicao.");
  }
  return payload;
}
