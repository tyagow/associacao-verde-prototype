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

export default function OrdersClient() {
  const [dashboard, setDashboard] = useState(null);
  const [ordersQuery, setOrdersQuery] = useState("");
  const [ordersStatus, setOrdersStatus] = useState("all");
  const [busyPaymentId, setBusyPaymentId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setError("");
    const payload = await api("/api/team/dashboard");
    setDashboard(payload);
    return payload;
  }, []);

  useEffect(() => {
    let active = true;
    loadDashboard().catch((nextError) => {
      if (active) setError(nextError.message);
    });
    return () => {
      active = false;
    };
  }, [loadDashboard]);

  const pendingPayments = useMemo(
    () => (dashboard?.payments || []).filter((payment) => payment.status === "pending"),
    [dashboard],
  );
  const activeReservations = useMemo(
    () => (dashboard?.reservations || []).filter((item) => item.status === "active"),
    [dashboard],
  );
  const filteredOrders = useMemo(
    () => filterOrders(dashboard?.orders || [], ordersQuery, ordersStatus),
    [dashboard, ordersQuery, ordersStatus],
  );

  async function runPaymentAction(paymentId, action) {
    setBusyPaymentId(`${action}:${paymentId}`);
    setError("");
    setMessage("");
    try {
      if (action === "pay") {
        await api("/api/team/simulate-pix", {
          method: "POST",
          body: { paymentId, eventId: `local-${Date.now()}` },
        });
        setMessage("Webhook Pix simulado. Painel atualizado.");
      } else {
        const result = await api("/api/team/payments/reconcile", {
          method: "POST",
          body: { paymentId },
        });
        setMessage(
          result?.payment?.status === "paid"
            ? "Pagamento conciliado como pago."
            : "Conciliacao consultada. Painel atualizado.",
        );
      }
      await loadDashboard();
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusyPaymentId("");
    }
  }

  async function cancelOrder(event, orderId) {
    event.preventDefault();
    const form = event.currentTarget;
    setError("");
    setMessage("");
    try {
      await api("/api/team/orders/cancel", {
        method: "POST",
        body: { orderId, ...Object.fromEntries(new FormData(form)) },
      });
      form.reset();
      await loadDashboard();
      setMessage("Pedido cancelado ou enviado para revisao de excecao.");
    } catch (nextError) {
      setError(nextError.message);
    }
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
          <a className="ghost" href="/equipe/estoque">
            Estoque
          </a>
          <a className="ghost active" href="/equipe/pedidos" aria-current="page">
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
                className={href === "/equipe/pedidos" ? "active" : undefined}
                aria-current={href === "/equipe/pedidos" ? "page" : undefined}
              >
                {label}
              </a>
            ))}
          </aside>

          <section className="surface-stack">
            <section className="surface" data-surface="/equipe/pedidos">
              <article className="panel">
                <div className="section-heading">
                  <div>
                    <p className="kicker">Pedidos e Pix</p>
                    <h2>Reservas, pagamentos e reconciliacao</h2>
                    <p className="muted">
                      Acompanhe Pix pendentes, pedidos pagos, expirados e divergencias de pagamento.
                    </p>
                  </div>
                </div>

                <div className="surface-toolbar" aria-label="Filtro de pedidos">
                  <label>
                    Buscar pedido
                    <input
                      data-filter="ordersQuery"
                      value={ordersQuery}
                      onChange={(event) => setOrdersQuery(event.target.value)}
                      placeholder="Pedido, paciente, produto ou provider"
                    />
                  </label>
                  <label>
                    Status
                    <select
                      data-filter="ordersStatus"
                      value={ordersStatus}
                      onChange={(event) => setOrdersStatus(event.target.value)}
                    >
                      <option value="all">Todos</option>
                      <option value="awaiting_payment">Pix pendente</option>
                      <option value="paid_pending_fulfillment">Pago aguardando separacao</option>
                      <option value="separating">Em separacao</option>
                      <option value="ready_to_ship">Pronto para envio</option>
                      <option value="sent">Enviado</option>
                      <option value="payment_expired">Pagamento expirado</option>
                      <option value="cancelled">Cancelado</option>
                      <option value="fulfillment_exception">Excecao operacional</option>
                    </select>
                  </label>
                </div>

                {message ? <p className="status">{message}</p> : null}
                {error ? <p className="pill danger">{error}</p> : null}

                <div id="orders-surface" className="stack">
                  {!dashboard && !error ? (
                    <p className="muted">Carregando pedidos e Pix...</p>
                  ) : dashboard ? (
                    <OrdersSurface
                      dashboard={dashboard}
                      pendingPayments={pendingPayments}
                      activeReservations={activeReservations}
                      filteredOrders={filteredOrders}
                      busyPaymentId={busyPaymentId}
                      onPaymentAction={runPaymentAction}
                      onCancelOrder={cancelOrder}
                    />
                  ) : (
                    <p className="muted">
                      Entre como equipe para acompanhar pedidos, Pix e reservas.
                    </p>
                  )}
                </div>
              </article>
            </section>
          </section>
        </div>
      </main>
    </>
  );
}

function OrdersSurface({
  dashboard,
  pendingPayments,
  activeReservations,
  filteredOrders,
  busyPaymentId,
  onPaymentAction,
  onCancelOrder,
}) {
  return (
    <>
      <section className="route-summary">
        <Metric label="Pedidos" value={(dashboard.orders || []).length} />
        <Metric label="Pix pendentes" value={pendingPayments.length} />
        <Metric label="Reservas ativas" value={activeReservations.length} />
      </section>

      <div className="ledger-section-heading">
        <h3>Pix pendentes</h3>
        <span>{pendingPayments.length} em aberto</span>
      </div>
      {pendingPayments.length ? (
        <section className="orders-ledger payment-ledger" aria-label="Pix pendentes">
          <div className="orders-ledger-head">
            <span>Pedido</span>
            <span>Valor</span>
            <span>Provider</span>
            <span>Acoes</span>
          </div>
          {pendingPayments.map((payment) => (
            <PaymentCard
              key={payment.id}
              payment={payment}
              busyPaymentId={busyPaymentId}
              onPaymentAction={onPaymentAction}
            />
          ))}
        </section>
      ) : (
        <p className="muted">Nenhum Pix pendente.</p>
      )}

      <div className="ledger-section-heading">
        <h3>Pedidos</h3>
        <span>{filteredOrders.length} no filtro atual</span>
      </div>
      {filteredOrders.length ? (
        <section className="orders-ledger" aria-label="Pedidos">
          <div className="orders-ledger-head">
            <span>Pedido</span>
            <span>Paciente e itens</span>
            <span>Valor</span>
            <span>Status</span>
            <span>Acoes</span>
          </div>
          {filteredOrders.map((order) => (
            <OrderCard key={order.id} order={order} onCancelOrder={onCancelOrder} />
          ))}
        </section>
      ) : (
        <p className="muted">Nenhum pedido encontrado para o filtro atual.</p>
      )}
    </>
  );
}

function PaymentCard({ payment, busyPaymentId, onPaymentAction }) {
  return (
    <article className="orders-ledger-row payment-ledger-row">
      <div className="ledger-primary">
        <strong>{payment.orderId}</strong>
        <span>Expira {formatDateTime(payment.expiresAt)}</span>
      </div>
      <strong className="money">{formatPaymentAmount(payment.amountCents)}</strong>
      <div className="ledger-primary">
        <strong>{payment.provider}</strong>
        <span>{payment.providerPaymentId}</span>
      </div>
      <div className="ledger-actions">
        <button
          className="mini"
          type="button"
          data-reconcile={payment.id}
          disabled={busyPaymentId === `reconcile:${payment.id}`}
          onClick={() => onPaymentAction(payment.id, "reconcile")}
        >
          {busyPaymentId === `reconcile:${payment.id}` ? "Conciliando..." : "Conciliar provider"}
        </button>
        <button
          className="accent"
          type="button"
          data-pay={payment.id}
          disabled={busyPaymentId === `pay:${payment.id}`}
          onClick={() => onPaymentAction(payment.id, "pay")}
        >
          {busyPaymentId === `pay:${payment.id}` ? "Simulando..." : "Simular webhook pago"}
        </button>
      </div>
    </article>
  );
}

function OrderCard({ order, onCancelOrder }) {
  const statusClass =
    order.status.includes("expired") ||
    order.status.includes("exception") ||
    order.status === "cancelled"
      ? "danger"
      : order.status.includes("awaiting")
        ? "warn"
        : "";
  const canReview = [
    "awaiting_payment",
    "paid_pending_fulfillment",
    "separating",
    "ready_to_ship",
  ].includes(order.status);

  return (
    <article className="orders-ledger-row order-management-row">
      <div className="ledger-primary">
        <strong>{order.id}</strong>
        <span>
          {order.paymentProvider || "Pix"} · {order.paymentStatus || "sem pagamento"}
        </span>
      </div>
      <div className="ledger-primary">
        <strong>{order.patientName}</strong>
        <span>
          {(order.items || [])
            .map((item) => `${item.quantity} ${item.unit} ${item.name}`)
            .join(" | ")}
        </span>
        {order.shipment ? (
          <span>
            Envio: {order.shipment.carrier} · {order.shipment.status} ·{" "}
            {order.shipment.trackingCode || "sem rastreio"}
          </span>
        ) : null}
        {order.pix ? <span>Pix copia-e-cola: {order.pix.copiaECola}</span> : null}
        {order.exceptions?.length ? (
          <span>Excecao: {order.exceptions[order.exceptions.length - 1].note}</span>
        ) : null}
      </div>
      <strong className="money">{formatPaymentAmount(order.totalCents)}</strong>
      <span className={`pill ${statusClass}`.trim()}>{orderStatusLabel(order.status)}</span>
      <div className="ledger-actions">
        {canReview ? (
          <details className="row-action-drawer">
            <summary>{order.status === "awaiting_payment" ? "Cancelar" : "Revisar"}</summary>
            <form
              className="order-cancel-inline"
              onSubmit={(event) => onCancelOrder(event, order.id)}
            >
              <label>
                Excecao/cancelamento
                <input
                  name="reason"
                  placeholder={
                    order.status === "awaiting_payment"
                      ? "Motivo para liberar reserva"
                      : "Motivo para revisar reembolso"
                  }
                  required
                />
              </label>
              <button className="mini danger" type="submit">
                {order.status === "awaiting_payment" ? "Cancelar e liberar" : "Revisar excecao"}
              </button>
            </form>
          </details>
        ) : (
          <span className="muted">Sem acao</span>
        )}
      </div>
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

function filterOrders(orders, rawQuery, status) {
  const query = normalized(rawQuery);
  return orders.filter((order) => {
    const matchesQuery = textIncludes(
      [
        order.id,
        order.patientName,
        order.status,
        order.paymentProvider,
        order.paymentStatus,
        order.shipment?.carrier,
        order.shipment?.trackingCode,
        ...(order.items || []).map((item) => `${item.name} ${item.unit}`),
      ],
      query,
    );
    const matchesStatus = status === "all" || order.status === status;
    return matchesQuery && matchesStatus;
  });
}

function textIncludes(values, query) {
  if (!query) return true;
  return values.some((value) => normalized(value).includes(query));
}

function normalized(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function formatPaymentAmount(amountCents) {
  return money.format((amountCents || 0) / 100);
}

function orderStatusLabel(status) {
  return (
    {
      awaiting_payment: "Pix pendente",
      paid_pending_fulfillment: "Pago, aguardando separacao",
      separating: "Em separacao",
      ready_to_ship: "Pronto para envio",
      sent: "Enviado",
      payment_expired: "Pagamento expirado",
      cancelled: "Cancelado",
      fulfillment_exception: "Excecao operacional",
    }[status] || status
  );
}

function formatDateTime(value) {
  if (!value) return "sem vencimento";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
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
