"use client";

import { useEffect, useMemo, useState } from "react";
import Brand from "../../components/Brand";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fulfillmentStatuses = [
  "paid_pending_fulfillment",
  "separating",
  "ready_to_ship",
  "sent",
  "fulfillment_exception",
];

export default function FulfillmentPage() {
  const [dashboard, setDashboard] = useState(null);
  const [filters, setFilters] = useState({ fulfillmentQuery: "", fulfillmentStatus: "all" });
  const [status, setStatus] = useState("carregando");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const payload = await api("/api/team/dashboard");
      setDashboard(payload);
      setStatus("equipe autenticada");
      setError("");
    } catch (loadError) {
      setStatus("acesso restrito");
      setError(loadError.message);
    }
  }

  async function onShipment(event) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await api("/api/team/shipments", {
        method: "POST",
        body: Object.fromEntries(new FormData(form)),
      });
      form.reset();
      await load();
      showToast("Envio registrado no pedido.");
    } catch (submitError) {
      showToast(submitError.message);
    }
  }

  async function updateFulfillment(orderId, nextStatus) {
    try {
      await api("/api/team/fulfillment", { method: "POST", body: { orderId, status: nextStatus } });
      await load();
      showToast("Status de fulfillment atualizado.");
    } catch (updateError) {
      showToast(updateError.message);
    }
  }

  async function onOrderException(event, orderId) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await api("/api/team/orders/exception", {
        method: "POST",
        body: { orderId, ...Object.fromEntries(new FormData(form)) },
      });
      form.reset();
      await load();
      showToast("Excecao operacional registrada no pedido.");
    } catch (submitError) {
      showToast(submitError.message);
    }
  }

  async function onCancelOrder(event, orderId) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await api("/api/team/orders/cancel", {
        method: "POST",
        body: { orderId, ...Object.fromEntries(new FormData(form)) },
      });
      form.reset();
      await load();
      showToast("Pedido marcado para cancelamento/excecao.");
    } catch (submitError) {
      showToast(submitError.message);
    }
  }

  function onFilterChange(event) {
    const { filter } = event.currentTarget.dataset;
    const { value } = event.currentTarget;
    setFilters((current) => ({ ...current, [filter]: value }));
  }

  function showToast(message) {
    setToast(message || "Erro na requisicao.");
    window.clearTimeout(showToast.timeout);
    showToast.timeout = window.setTimeout(() => setToast(""), 3200);
  }

  const orders = useMemo(
    () => filteredOrders(dashboard?.orders || [], filters),
    [dashboard, filters],
  );

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
          <a className="ghost" href="/equipe/estoque">
            Estoque
          </a>
          <a className="ghost" href="/equipe/pedidos">
            Pedidos
          </a>
          <a className="ghost active" href="/equipe/fulfillment">
            Fulfillment
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
        <section className="app-layout">
          <aside className="side-nav" aria-label="Navegacao operacional">
            <a href="/equipe">Comando da equipe</a>
            <a href="/equipe/pacientes">Pacientes e receitas</a>
            <a href="/equipe/estoque">Produtos, estoque e cultivo</a>
            <a href="/equipe/pedidos">Pedidos e Pix</a>
            <a className="active" href="/equipe/fulfillment">
              Fulfillment e envio
            </a>
            <a href="/equipe/suporte">Suporte ao paciente</a>
            <a href="/admin">Admin e compliance</a>
          </aside>

          <section className="surface-stack">
            <article className="panel">
              <div className="section-heading">
                <div>
                  <p className="kicker">Fulfillment e envio</p>
                  <h2>Separacao, etiqueta e rastreio</h2>
                  <p className="muted">
                    Atualize status de separacao, transportadora, servico e codigo de rastreio.
                  </p>
                </div>
                <span className="status" id="fulfillment-status">
                  {status}
                </span>
              </div>

              <div className="surface-toolbar" aria-label="Filtro de fulfillment">
                <label>
                  Buscar separacao
                  <input
                    data-filter="fulfillmentQuery"
                    value={filters.fulfillmentQuery}
                    onChange={onFilterChange}
                    placeholder="Pedido, paciente, item, rastreio"
                  />
                </label>
                <label>
                  Etapa
                  <select
                    data-filter="fulfillmentStatus"
                    value={filters.fulfillmentStatus}
                    onChange={onFilterChange}
                  >
                    <option value="all">Todas</option>
                    <option value="paid_pending_fulfillment">Aguardando separacao</option>
                    <option value="separating">Separacao</option>
                    <option value="ready_to_ship">Pronto para envio</option>
                    <option value="sent">Enviado</option>
                  </select>
                </label>
              </div>

              <div id="fulfillment-surface" className="stack">
                {error ? (
                  <p className="pill danger">{error}</p>
                ) : (
                  <>
                    <section className="route-summary">
                      <Metric
                        label="Fila de separacao"
                        value={
                          orders.filter((order) => order.status === "paid_pending_fulfillment")
                            .length
                        }
                      />
                      <Metric
                        label="Separando"
                        value={orders.filter((order) => order.status === "separating").length}
                      />
                      <Metric
                        label="Prontos/enviados"
                        value={
                          orders.filter((order) => ["ready_to_ship", "sent"].includes(order.status))
                            .length
                        }
                      />
                    </section>
                    <div className="ledger-section-heading">
                      <h3>Fila de separacao</h3>
                      <span>{orders.length} no filtro atual</span>
                    </div>
                    {orders.length ? (
                      <section className="fulfillment-ledger" aria-label="Fila de fulfillment">
                        <div className="fulfillment-ledger-head">
                          <span>Pedido</span>
                          <span>Paciente e itens</span>
                          <span>Envio</span>
                          <span>Status</span>
                          <span>Acoes</span>
                        </div>
                        {orders.map((order) => (
                          <OrderCard
                            key={order.id}
                            order={order}
                            onUpdate={updateFulfillment}
                            onShipment={onShipment}
                            onException={onOrderException}
                            onCancel={onCancelOrder}
                          />
                        ))}
                      </section>
                    ) : (
                      <p className="muted">Nenhum pedido no filtro atual.</p>
                    )}
                  </>
                )}
              </div>
            </article>
          </section>
        </section>
      </main>
      <div className={`toast ${toast ? "show" : ""}`} id="toast" role="status" aria-live="polite">
        {toast}
      </div>
    </>
  );
}

function OrderCard({ order, onUpdate, onShipment, onException, onCancel }) {
  return (
    <article className="fulfillment-ledger-row">
      <div className="ledger-primary">
        <strong>{order.id}</strong>
        <span>{money.format(order.totalCents / 100)} · Pagamento confirmado</span>
      </div>
      <div className="ledger-primary">
        <strong>{order.patientName}</strong>
        <span>
          {order.items.map((item) => `${item.quantity} ${item.unit} ${item.name}`).join(" | ")}
        </span>
        {order.exceptions?.length ? (
          <div className="exception-list">
            {order.exceptions.map((exception) => (
              <p key={exception.id}>
                <strong>{exception.type}:</strong> {exception.note}
              </p>
            ))}
          </div>
        ) : null}
      </div>
      <div className="ledger-primary">
        <strong>{order.shipment?.carrier || "Sem envio"}</strong>
        <span>
          {order.shipment
            ? `${order.shipment.status} · ${order.shipment.trackingCode || "sem rastreio"}`
            : "Aguardando etiqueta e rastreio"}
        </span>
      </div>
      <span className={`pill ${order.status === "fulfillment_exception" ? "danger" : ""}`.trim()}>
        {statusLabel(order.status)}
      </span>
      <div className="ledger-actions">
        <div className="fulfillment-actions">
          <button className="mini" type="button" onClick={() => onUpdate(order.id, "separating")}>
            Separacao
          </button>
          <button
            className="mini"
            type="button"
            onClick={() => onUpdate(order.id, "ready_to_ship")}
          >
            Pronto
          </button>
          <button className="mini" type="button" onClick={() => onUpdate(order.id, "sent")}>
            Enviado
          </button>
        </div>
        <details className="row-action-drawer">
          <summary>Registrar envio</summary>
          <form className="row-drawer-form" onSubmit={onShipment}>
            <input type="hidden" name="orderId" value={order.id} />
            <label>
              Transportadora
              <input name="carrier" placeholder="Melhor Envio / GED Log" required />
            </label>
            <label>
              Rastreio
              <input name="trackingCode" placeholder="BR123..." />
            </label>
            <label>
              Status
              <select name="status" defaultValue="created">
                <option value="created">Criado</option>
                <option value="label_ready">Etiqueta pronta</option>
                <option value="sent">Enviado</option>
              </select>
            </label>
            <button className="mini" type="submit">
              Salvar envio
            </button>
          </form>
        </details>
        <details className="row-action-drawer">
          <summary>Excecao</summary>
          <form className="order-exception-form" onSubmit={(event) => onException(event, order.id)}>
            <label>
              Tipo
              <select name="type" defaultValue="operacional">
                <option value="operacional">Operacional</option>
                <option value="transportadora">Transportadora</option>
                <option value="estoque">Estoque</option>
                <option value="documento">Documento</option>
                <option value="reembolso">Reembolso</option>
              </select>
            </label>
            <label>
              Nota interna
              <input name="note" placeholder="Divergencia, endereco, lote..." required />
            </label>
            <button className="mini" type="submit">
              Registrar
            </button>
          </form>
        </details>
        <details className="row-action-drawer">
          <summary>Cancelar</summary>
          <form
            className="order-exception-form cancel"
            onSubmit={(event) => onCancel(event, order.id)}
          >
            <label>
              Cancelamento/reembolso
              <input
                name="reason"
                placeholder="Motivo para cancelar ou revisar reembolso"
                required
              />
            </label>
            <button className="mini danger" type="submit">
              Cancelar / revisar
            </button>
          </form>
        </details>
      </div>
    </article>
  );
}

function Metric({ label, value }) {
  return (
    <article className="queue-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function filteredOrders(orders, filters) {
  const query = normalize(filters.fulfillmentQuery);
  const status = filters.fulfillmentStatus;
  return orders
    .filter((order) => fulfillmentStatuses.includes(order.status))
    .filter((order) => status === "all" || order.status === status)
    .filter(
      (order) =>
        !query ||
        normalize(
          [
            order.id,
            order.patientName,
            order.shipment?.carrier,
            order.shipment?.trackingCode,
            ...order.items.map((item) => item.name),
          ].join(" "),
        ).includes(query),
    );
}

function statusLabel(status) {
  return (
    {
      paid_pending_fulfillment: "Pago, aguardando separacao",
      separating: "Em separacao",
      ready_to_ship: "Pronto para envio",
      sent: "Enviado",
      fulfillment_exception: "Excecao operacional",
    }[status] || status
  );
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : {},
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Erro na requisicao.");
  return payload;
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
