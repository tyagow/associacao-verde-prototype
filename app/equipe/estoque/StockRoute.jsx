"use client";

import Brand from "../../components/Brand";
import { useCallback, useEffect, useMemo, useState } from "react";

const TEAM_ROUTES = [
  ["/equipe", "Comando"],
  ["/equipe/pacientes", "Pacientes"],
  ["/equipe/estoque", "Estoque"],
  ["/equipe/pedidos", "Pedidos"],
  ["/equipe/fulfillment", "Fulfillment"],
  ["/equipe/suporte", "Suporte"],
  ["/admin", "Admin"],
];

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function StockRoute() {
  const [session, setSession] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [filters, setFilters] = useState({ stockQuery: "", stockStatus: "all" });
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isTeam = session?.role === "team";

  const loadDashboard = useCallback(async () => {
    const payload = await api("/api/team/dashboard");
    setDashboard(payload);
    return payload;
  }, []);

  const refresh = useCallback(async () => {
    setError("");
    const payload = await api("/api/session");
    const nextSession = payload.session || null;
    setSession(nextSession);
    if (nextSession?.role === "team") {
      await loadDashboard();
    } else {
      setDashboard(null);
    }
  }, [loadDashboard]);

  useEffect(() => {
    let active = true;
    refresh().catch((nextError) => {
      if (active) setError(nextError.message);
    });
    return () => {
      active = false;
    };
  }, [refresh]);

  const products = dashboard?.products || [];
  const batches = dashboard?.cultivationBatches || [];

  const productOptions = useMemo(
    () =>
      products.map((product) => ({
        value: product.id,
        label: `${product.name} (${product.stock} ${product.unit})`,
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

  async function submitForm(event, action, success) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form));
    await run(action, success, async () => {
      await actionPayload(action, payload);
      form.reset();
    });
  }

  async function actionPayload(action, payload) {
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
  }

  async function run(action, success, callback) {
    setBusy(action);
    setError("");
    setMessage("");
    try {
      await callback();
      await loadDashboard();
      setMessage(success);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusy("");
    }
  }

  async function submitCultivationAction(action) {
    const form = document.querySelector("#cultivation-update-form");
    const data = Object.fromEntries(new FormData(form));
    const body = { batchId: data.batchId };
    let path = "/api/team/cultivation-batches/advance";

    if (action === "harvest") {
      path = "/api/team/cultivation-batches/harvest";
      body.harvested = Number(data.amount);
    }
    if (action === "dry") {
      path = "/api/team/cultivation-batches/dry";
      body.dried = Number(data.amount);
    }
    if (action === "stock") {
      path = "/api/team/cultivation-batches/stock";
      body.productId = data.productId;
    }

    await run(`cultivation-${action}`, "Lote de cultivo atualizado.", async () => {
      await api(path, { method: "POST", body });
    });
  }

  function updateFilter(event) {
    const { filter } = event.currentTarget.dataset;
    const { value } = event.currentTarget;
    setFilters((current) => ({ ...current, [filter]: value }));
  }

  return (
    <>
      <header className="topbar">
        <Brand />
        <nav aria-label="Areas do sistema">
          <a className="ghost" href="/paciente">
            Paciente
          </a>
          <a className="ghost" href="/equipe">
            Comando
          </a>
          <a className="ghost" href="/equipe/pacientes">
            Pacientes
          </a>
          <a className="ghost active" href="/equipe/estoque" aria-current="page">
            Estoque
          </a>
          <a className="ghost" href="/equipe/pedidos">
            Pedidos
          </a>
          <a className="ghost" href="/equipe/suporte">
            Suporte
          </a>
          <a className="ghost" href="/admin">
            Admin
          </a>
        </nav>
      </header>

      <main>
        <div className="app-layout">
          <aside className="side-nav" aria-label="Rotas da equipe">
            {TEAM_ROUTES.map(([href, label]) => (
              <a
                key={href}
                href={href}
                className={href === "/equipe/estoque" ? "active" : undefined}
                aria-current={href === "/equipe/estoque" ? "page" : undefined}
              >
                {label}
              </a>
            ))}
          </aside>

          <section className="surface-stack">
            <section className="surface" data-surface="/equipe/estoque">
              <article className="panel">
                <div className="section-heading">
                  <div>
                    <p className="kicker">Produtos, estoque e cultivo</p>
                    <h2>Rastreabilidade de produto e lote</h2>
                    <p className="muted">
                      Entradas, produtos privados, cultivo, colheita, peso seco e lotes no estoque.
                    </p>
                  </div>
                  <span className="status">
                    {isTeam ? "equipe autenticada" : "acesso restrito"}
                  </span>
                </div>

                {message ? <p className="status">{message}</p> : null}
                {error ? <p className="pill danger">{error}</p> : null}

                <div className="surface-toolbar" aria-label="Filtro de estoque">
                  <label>
                    Buscar no estoque
                    <input
                      data-filter="stockQuery"
                      placeholder="Produto, cultivar ou lote"
                      value={filters.stockQuery}
                      onInput={updateFilter}
                      onChange={updateFilter}
                    />
                  </label>
                  <label>
                    Situacao
                    <select
                      data-filter="stockStatus"
                      value={filters.stockStatus}
                      onInput={updateFilter}
                      onChange={updateFilter}
                    >
                      <option value="all">Todos</option>
                      <option value="low">Baixo estoque</option>
                      <option value="inactive">Inativos</option>
                      <option value="cultivation">Cultivo ativo</option>
                    </select>
                  </label>
                </div>

                <StockSurface dashboard={dashboard} filters={filters} />

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
                      <button
                        className="primary"
                        type="submit"
                        disabled={!isTeam || busy === "product-create"}
                      >
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
                        submitForm(
                          event,
                          "product-update",
                          "Produto atualizado no catalogo privado.",
                        )
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
                      <label>
                        Descricao
                        <input
                          name="description"
                          placeholder="Texto interno do catalogo"
                          disabled={!isTeam || busy === "product-update"}
                        />
                      </label>
                      <label>
                        Categoria
                        <CategorySelect
                          name="category"
                          defaultValue=""
                          includeKeep
                          disabled={!isTeam || busy === "product-update"}
                        />
                      </label>
                      <label>
                        Alerta minimo
                        <input
                          name="lowStockThreshold"
                          type="number"
                          min="0"
                          placeholder="Limite de baixo estoque"
                          disabled={!isTeam || busy === "product-update"}
                        />
                      </label>
                      <label>
                        Controle
                        <ControlSelect
                          name="controlled"
                          defaultValue=""
                          includeKeep
                          disabled={!isTeam || busy === "product-update"}
                        />
                      </label>
                      <label>
                        Nota interna
                        <input
                          name="internalNote"
                          placeholder="Observacao operacional"
                          disabled={!isTeam || busy === "product-update"}
                        />
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
                      onSubmit={(event) =>
                        submitForm(event, "stock-add", "Estoque atualizado no servidor.")
                      }
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
                      onSubmit={(event) =>
                        submitForm(event, "cultivation-create", "Lote de cultivo criado.")
                      }
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
                          !isTeam ||
                          !batches.length ||
                          !products.length ||
                          busy === "cultivation-stock"
                        }
                        onClick={() => submitCultivationAction("stock")}
                      >
                        Mover para estoque
                      </button>
                    </form>
                  </details>
                </section>
              </article>
            </section>
          </section>
        </div>
      </main>
    </>
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

function CategorySelect({ includeKeep = false, ...props }) {
  return (
    <select {...props}>
      {includeKeep ? <option value="">Manter</option> : null}
      <option value="oil">Oleo medicinal</option>
      <option value="flower">Flor medicinal</option>
      <option value="edible">Produto oral</option>
      <option value="other">Outro</option>
    </select>
  );
}

function ControlSelect({ includeKeep = false, ...props }) {
  return (
    <select {...props}>
      {includeKeep ? <option value="">Manter</option> : null}
      <option value="true">Controlado</option>
      <option value="false">Nao controlado</option>
    </select>
  );
}

function StockSurface({ dashboard, filters }) {
  if (!dashboard) {
    return (
      <div id="stock-surface" className="stack">
        <p className="muted">Entre como equipe para acompanhar produtos, estoque e cultivo.</p>
      </div>
    );
  }

  const stockRows = filterProducts(dashboard.products, filters);
  const batchRows = filterBatches(dashboard.cultivationBatches, filters);
  const lotRows = filterLots(dashboard.inventoryLots, filters);

  return (
    <div id="stock-surface" className="stack">
      <section className="route-summary">
        <Metric label="Produtos" value={dashboard.products.length} />
        <Metric
          label="Baixo estoque"
          value={
            dashboard.products.filter(
              (product) => product.availableStock <= (product.lowStockThreshold || 5),
            ).length
          }
        />
        <Metric label="Lotes cultivo" value={dashboard.cultivationBatches.length} />
      </section>

      <h3>Produtos filtrados</h3>
      {stockRows.length ? (
        <section className="stock-ledger" aria-label="Produtos filtrados">
          <div className="stock-ledger-head">
            <span>Produto</span>
            <span>Estoque</span>
            <span>Categoria</span>
            <span>Valor</span>
            <span>Status</span>
          </div>
          {stockRows.map((product) => (
            <ProductStockCard key={product.id} product={product} />
          ))}
        </section>
      ) : (
        <p className="muted">Nenhum produto encontrado para o filtro atual.</p>
      )}

      <h3>Cultivo</h3>
      {batchRows.length ? (
        batchRows.map((batch) => <BatchCard key={batch.id} batch={batch} />)
      ) : (
        <p className="muted">Nenhum lote de cultivo encontrado para o filtro atual.</p>
      )}

      <h3>Lotes movidos para estoque</h3>
      {lotRows.length ? (
        lotRows.map((lot) => (
          <article className="order-card" key={lot.id}>
            <strong>{lot.strain}</strong>
            <p>
              {lot.quantity} {lot.unit} - {lot.productId} - {lot.status}
            </p>
          </article>
        ))
      ) : (
        <p className="muted">Nenhum lote movido para estoque no filtro atual.</p>
      )}
    </div>
  );
}

function ProductStockCard({ product }) {
  return (
    <article className="stock-ledger-row">
      <div>
        <h3>{product.name}</h3>
        <p className="muted">{product.description || "Sem descricao interna."}</p>
        {product.internalNote ? (
          <p className="muted">Nota interna: {product.internalNote}</p>
        ) : null}
      </div>
      <div>
        <strong>
          {product.availableStock} {product.unit}
        </strong>
        <p className="muted">
          {product.stock} fisico · alerta {product.lowStockThreshold || 5}
        </p>
      </div>
      <span>
        {categoryLabel(product.category)}
        <small>{product.controlled ? "Controlado" : "Nao controlado"}</small>
      </span>
      <strong>{money.format(product.priceCents / 100)}</strong>
      <span
        className={`pill ${product.availableStock <= (product.lowStockThreshold || 5) ? "warn" : ""}`.trim()}
      >
        {product.active === false ? "inativo" : "ativo"}
      </span>
    </article>
  );
}

function BatchCard({ batch }) {
  return (
    <article className="order-card">
      <strong>
        {batch.strain} - semana {batch.week} - {batch.status}
      </strong>
      <p>
        {batch.plants} plantas - colhido {batch.harvested}g - seco {batch.dried}g - produto{" "}
        {batch.productId || "sem vinculo"}
      </p>
    </article>
  );
}

function Metric({ label, value }) {
  return (
    <article className="card">
      <span className="muted">{label}</span>
      <h2>{value}</h2>
    </article>
  );
}

function filterProducts(products, filters) {
  const query = normalized(filters.stockQuery);
  const status = filters.stockStatus;
  return products.filter((product) => {
    const matchesQuery = textIncludes(
      [
        product.name,
        product.id,
        product.description,
        product.unit,
        product.category,
        product.internalNote,
      ],
      query,
    );
    const matchesStatus =
      status === "all" ||
      (status === "low" && product.availableStock <= (product.lowStockThreshold || 5)) ||
      (status === "inactive" && product.active === false) ||
      status === "cultivation";
    return matchesQuery && matchesStatus;
  });
}

function categoryLabel(category) {
  return (
    {
      oil: "Oleo medicinal",
      flower: "Flor medicinal",
      edible: "Produto oral",
      other: "Outro produto",
    }[category] || "Produto autorizado"
  );
}

function filterBatches(batches, filters) {
  const query = normalized(filters.stockQuery);
  const status = filters.stockStatus;
  return batches.filter((batch) => {
    const matchesQuery = textIncludes([batch.strain, batch.productId, batch.status], query);
    const matchesStatus = status === "all" || status === "cultivation";
    return matchesQuery && matchesStatus;
  });
}

function filterLots(lots, filters) {
  const query = normalized(filters.stockQuery);
  const status = filters.stockStatus;
  return lots.filter((lot) => {
    const matchesQuery = textIncludes([lot.strain, lot.productId, lot.status, lot.unit], query);
    const matchesStatus = status === "all" || status === "cultivation";
    return matchesQuery && matchesStatus;
  });
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : {},
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Erro na requisicao.");
  }
  return payload;
}

function normalized(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function textIncludes(values, query) {
  if (!query) return true;
  return values.some((value) => normalized(value).includes(query));
}
