"use client";

/* Phase 4 — Pedidos & Pix ledgers (rebuild).

   Replaces the legacy single-table view with the mock's two-ledger layout:
     - Top ledger: "Pix pendentes" — countdown column, reconcile/cancel
       inline actions per row.
     - Bottom ledger: "Pedidos pagos" — status pills and per-row actions
       (Etiqueta / Rastrear / Revisar exceção). Filters above narrow the
       list.

   Detail opens in a right-side drawer (OrderDrawer), which mirrors the
   patient CatalogDrawer pattern from Phase 1b: pointer-events + transform
   animation, never display:none, so future E2E selectors stay reachable.

   Hard E2E invariants preserved:
     - Body still contains "Pedidos e Pix" (kicker) and the heading
       "Reservas, pagamentos e reconciliação".
     - [data-filter='ordersQuery'] (input) and [data-filter='ordersStatus']
       (select with awaiting_payment option) still drive filtering.
     - #orders-surface contains a [data-pay='<paymentId>'] button as the
       FIRST visible Pay action when a Pix is pending.
     - After clicking [data-pay], the body shows "Webhook Pix simulado".

   No new endpoints. Existing endpoints used:
     GET  /api/team/dashboard
     POST /api/team/payments/reconcile
     POST /api/team/simulate-pix
     POST /api/team/orders/cancel
*/

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Brand from "../../components/Brand";
import Ledger from "./components/Ledger.jsx";
import OrderRow from "./components/OrderRow.jsx";
import OrderDrawer from "./components/OrderDrawer.jsx";

const TEAM_ROUTES = [
  ["/equipe", "Comando"],
  ["/equipe/pacientes", "Pacientes"],
  ["/equipe/estoque", "Estoque"],
  ["/equipe/pedidos", "Pedidos"],
  ["/equipe/fulfillment", "Fulfillment"],
  ["/equipe/suporte", "Suporte"],
  ["/admin", "Admin"],
];

const moneyFmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default function OrdersClient() {
  const [dashboard, setDashboard] = useState(null);
  const [ordersQuery, setOrdersQuery] = useState("");
  const [ordersStatus, setOrdersStatus] = useState("all");
  const [busyPaymentId, setBusyPaymentId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerSubject, setDrawerSubject] = useState(null); // { kind: "order"|"payment", id }
  // Tick state to keep countdowns live (1s cadence). The dashboard payload
  // is the source of truth; we only re-derive labels per second.
  const [, setNowTick] = useState(0);
  const tickRef = useRef(null);

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

  useEffect(() => {
    tickRef.current = setInterval(() => setNowTick((n) => (n + 1) % 60), 1000);
    return () => clearInterval(tickRef.current);
  }, []);

  const pendingPayments = useMemo(
    () => (dashboard?.payments || []).filter((p) => p.status === "pending"),
    [dashboard],
  );
  const activeReservations = useMemo(
    () => (dashboard?.reservations || []).filter((r) => r.status === "active"),
    [dashboard],
  );
  const paidOrders = useMemo(
    () => (dashboard?.orders || []).filter((order) => order.status !== "awaiting_payment"),
    [dashboard],
  );
  const filteredPaidOrders = useMemo(
    () => filterOrders(paidOrders, ordersQuery, ordersStatus),
    [paidOrders, ordersQuery, ordersStatus],
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
      setDrawerOpen(false);
    } catch (nextError) {
      setError(nextError.message);
    }
  }

  function openOrderDrawer(orderId) {
    setDrawerSubject({ kind: "order", id: orderId });
    setDrawerOpen(true);
  }

  function openPaymentDrawer(paymentId) {
    setDrawerSubject({ kind: "payment", id: paymentId });
    setDrawerOpen(true);
  }

  const drawerOrder = useMemo(() => {
    if (!drawerSubject || !dashboard) return null;
    if (drawerSubject.kind === "order") {
      return (dashboard.orders || []).find((o) => o.id === drawerSubject.id) || null;
    }
    const payment = (dashboard.payments || []).find((p) => p.id === drawerSubject.id);
    if (!payment) return null;
    return (dashboard.orders || []).find((o) => o.id === payment.orderId) || null;
  }, [drawerSubject, dashboard]);

  const drawerPayment = useMemo(() => {
    if (!drawerSubject || !dashboard) return null;
    if (drawerSubject.kind === "payment") {
      return (dashboard.payments || []).find((p) => p.id === drawerSubject.id) || null;
    }
    // Order kind: include payment if it's still pending.
    const order = (dashboard.orders || []).find((o) => o.id === drawerSubject.id);
    if (!order) return null;
    return (
      (dashboard.payments || []).find((p) => p.orderId === order.id && p.status === "pending") ||
      null
    );
  }, [drawerSubject, dashboard]);

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
                    <>
                      <section className="route-summary">
                        <Metric label="Pedidos" value={(dashboard.orders || []).length} />
                        <Metric label="Pix pendentes" value={pendingPayments.length} />
                        <Metric label="Reservas ativas" value={activeReservations.length} />
                      </section>

                      <Ledger
                        title="Pix pendentes"
                        ariaLabel="Pix pendentes"
                        count={pendingPayments.length}
                        tone={pendingPayments.length ? "warn" : undefined}
                        meta={
                          pendingPayments.length ? `${pendingPayments.length} em aberto` : undefined
                        }
                        emptyMessage="Nenhum Pix pendente."
                      >
                        {pendingPayments.map((payment) => {
                          const countdown = describeCountdown(payment.expiresAt);
                          const order = (dashboard.orders || []).find(
                            (o) => o.id === payment.orderId,
                          );
                          return (
                            <OrderRow
                              key={payment.id}
                              variant="pending"
                              primary={{
                                id: payment.orderId,
                                subtitle: `${payment.provider || "pix"} · pending`,
                              }}
                              patient={{
                                name: order?.patientName || "Paciente",
                                summary: summarizeItems(order?.items),
                              }}
                              amount={formatCents(payment.amountCents)}
                              countdown={countdown}
                              onOpen={() => openPaymentDrawer(payment.id)}
                              actions={[
                                {
                                  key: "reconcile",
                                  label:
                                    busyPaymentId === `reconcile:${payment.id}`
                                      ? "Conciliando..."
                                      : "Conciliar",
                                  onClick: () => runPaymentAction(payment.id, "reconcile"),
                                  disabled: busyPaymentId === `reconcile:${payment.id}`,
                                  dataAttr: { key: "reconcile", value: payment.id },
                                },
                                {
                                  key: "pay",
                                  label:
                                    busyPaymentId === `pay:${payment.id}`
                                      ? "Simulando..."
                                      : "Simular webhook pago",
                                  onClick: () => runPaymentAction(payment.id, "pay"),
                                  disabled: busyPaymentId === `pay:${payment.id}`,
                                  tone: "primary",
                                  dataAttr: { key: "pay", value: payment.id },
                                },
                              ]}
                            />
                          );
                        })}
                      </Ledger>

                      <Ledger
                        title="Pedidos pagos"
                        ariaLabel="Pedidos pagos"
                        count={filteredPaidOrders.length}
                        meta={`${filteredPaidOrders.length} no filtro atual`}
                        emptyMessage="Nenhum pedido encontrado para o filtro atual."
                      >
                        {filteredPaidOrders.map((order) => {
                          const status = orderStatusDescriptor(order.status);
                          return (
                            <OrderRow
                              key={order.id}
                              variant="paid"
                              primary={{
                                id: order.id,
                                subtitle: `${order.paymentProvider || "pix"} · ${order.paymentStatus || "—"}`,
                              }}
                              patient={{
                                name: order.patientName || "Paciente",
                                summary: summarizeItems(order.items),
                              }}
                              amount={formatCents(order.totalCents)}
                              statusPill={status}
                              onOpen={() => openOrderDrawer(order.id)}
                              actions={rowActionsForOrder(order, openOrderDrawer)}
                            />
                          );
                        })}
                      </Ledger>
                    </>
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

      <OrderDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        order={drawerOrder}
        payment={drawerPayment}
        busyKey={busyPaymentId}
        onCancelOrder={cancelOrder}
        onPaymentAction={runPaymentAction}
      />
    </>
  );
}

function rowActionsForOrder(order, openOrderDrawer) {
  const actions = [];
  if (order.status === "ready_to_ship") {
    actions.push({
      key: "label",
      label: "Etiqueta",
      onClick: () => openOrderDrawer(order.id),
    });
  } else if (order.status === "sent") {
    actions.push({
      key: "track",
      label: "Rastrear",
      onClick: () => openOrderDrawer(order.id),
    });
  } else if (order.status === "fulfillment_exception") {
    actions.push({
      key: "exception",
      label: "Revisar exceção",
      onClick: () => openOrderDrawer(order.id),
      tone: "danger",
    });
  } else {
    actions.push({
      key: "open",
      label: "Abrir",
      onClick: () => openOrderDrawer(order.id),
    });
  }
  return actions;
}

function Metric({ label, value }) {
  return (
    <article className="card">
      <span className="muted">{label}</span>
      <h2>{value}</h2>
    </article>
  );
}

function describeCountdown(expiresAt) {
  if (!expiresAt) return { label: "sem vencimento", tone: undefined };
  const target = new Date(expiresAt).getTime();
  const now = Date.now();
  const diff = target - now;
  if (diff <= 0) return { label: "expirado", tone: "danger" };
  const totalSec = Math.floor(diff / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return { label: `${hours}h${String(minutes % 60).padStart(2, "0")}`, tone: "warn" };
  }
  if (minutes >= 10) return { label: `${minutes}min`, tone: "warn" };
  return {
    label: `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
    tone: minutes < 5 ? "danger" : "warn",
  };
}

function summarizeItems(items) {
  if (!items || !items.length) return "";
  const head = items
    .slice(0, 2)
    .map((item) => `${item.quantity}× ${item.name}`)
    .join(" · ");
  const extra = items.length > 2 ? ` +${items.length - 2}` : "";
  return `${head}${extra}`;
}

function orderStatusDescriptor(status) {
  const labels = {
    awaiting_payment: "Pix pendente",
    paid_pending_fulfillment: "Pago, aguardando separacao",
    separating: "Em separacao",
    ready_to_ship: "Pronto para envio",
    sent: "Enviado",
    payment_expired: "Pagamento expirado",
    cancelled: "Cancelado",
    fulfillment_exception: "Excecao operacional",
  };
  let tone = "neutral";
  if (status === "sent" || status === "ready_to_ship") tone = "good";
  else if (
    status === "payment_expired" ||
    status === "cancelled" ||
    status === "fulfillment_exception"
  )
    tone = "danger";
  else if (status === "awaiting_payment" || status.startsWith("paid") || status === "separating")
    tone = "warn";
  return { label: labels[status] || status, tone };
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

function formatCents(amountCents) {
  return moneyFmt.format((amountCents || 0) / 100);
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
