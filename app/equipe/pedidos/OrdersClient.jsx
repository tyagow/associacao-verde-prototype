"use client";

/* Phase 4 — Pedidos & Pix on the Phase 0 chassis (TeamShell + PageHead +
   StatusStrip). Replaces the legacy two-ledger / topbar+side-nav layout
   with a flat <table class="adm"> ledger inside #orders-surface plus a
   permanent right-rail <OrderDrawer> (380px sticky, sibling of the ledger).

   Hard E2E invariants preserved:
     - Body still contains "Pedidos e Pix" (PageHead title).
     - [data-filter='ordersStatus'] (select with awaiting_payment option) and
       [data-filter='ordersQuery'] (input) drive the StatusStrip filter slot.
     - #orders-surface contains the Ledger; first Pix-pending row exposes
       <button data-pay='<paymentId>'>Pagar</button>.
     - After clicking [data-pay], body shows "Webhook Pix simulado".
     - The drawer's own [data-pay] button (Confirmar Pix) sits OUTSIDE
       #orders-surface so it doesn't collide with the row-scoped selector.
*/

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import PageHead from "../components/PageHead";
import StatusStrip from "../components/StatusStrip";
import TeamShell from "../components/TeamShell";

import Ledger from "./components/Ledger.jsx";
import OrderRow from "./components/OrderRow.jsx";
import OrderDrawer from "./components/OrderDrawer.jsx";

import styles from "./OrdersClient.module.css";

export default function OrdersClient() {
  const [session, setSession] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [ordersQuery, setOrdersQuery] = useState("");
  const [ordersStatus, setOrdersStatus] = useState("all");
  const [busyPaymentId, setBusyPaymentId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerSubject, setDrawerSubject] = useState(null); // { kind, id }
  const [, setNowTick] = useState(0);
  const tickRef = useRef(null);

  const loadDashboard = useCallback(async () => {
    setError("");
    const [sessionPayload, dashboardPayload] = await Promise.all([
      api("/api/session").catch(() => ({ session: null })),
      api("/api/team/dashboard"),
    ]);
    setSession(sessionPayload?.session || null);
    setDashboard(dashboardPayload);
    return dashboardPayload;
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
  const expiredPayments = useMemo(
    () => (dashboard?.payments || []).filter((p) => p.status === "expired"),
    [dashboard],
  );
  const paidToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return (dashboard?.payments || []).filter(
      (p) => p.status === "paid" && (p.paidAt || "").slice(0, 10) === today,
    );
  }, [dashboard]);
  const awaitingConfirmation = useMemo(
    () => (dashboard?.payments || []).filter((p) => p.status === "awaiting_confirmation"),
    [dashboard],
  );
  const expiringSoon = useMemo(
    () =>
      pendingPayments.filter((p) => {
        const ms = p.expiresAt ? new Date(p.expiresAt).getTime() - Date.now() : Infinity;
        return ms > 0 && ms < 60 * 60 * 1000;
      }),
    [pendingPayments],
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
      setMessage("Pedido cancelado ou enviado para revisão de exceção.");
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
    if (!drawerOpen || !drawerSubject || !dashboard) return null;
    if (drawerSubject.kind === "order") {
      return (dashboard.orders || []).find((o) => o.id === drawerSubject.id) || null;
    }
    const payment = (dashboard.payments || []).find((p) => p.id === drawerSubject.id);
    if (!payment) return null;
    return (dashboard.orders || []).find((o) => o.id === payment.orderId) || null;
  }, [drawerSubject, dashboard, drawerOpen]);

  const drawerPayment = useMemo(() => {
    if (!drawerOpen || !drawerSubject || !dashboard) return null;
    if (drawerSubject.kind === "payment") {
      return (dashboard.payments || []).find((p) => p.id === drawerSubject.id) || null;
    }
    const order = (dashboard.orders || []).find((o) => o.id === drawerSubject.id);
    if (!order) return null;
    return (
      (dashboard.payments || []).find((p) => p.orderId === order.id && p.status === "pending") ||
      null
    );
  }, [drawerSubject, dashboard, drawerOpen]);

  const combinedRows = useMemo(() => {
    const rows = [];
    if (!dashboard) return rows;
    const orders = dashboard.orders || [];
    for (const p of pendingPayments) {
      const order = orders.find((o) => o.id === p.orderId);
      if (!order) continue;
      if (ordersStatus !== "all" && ordersStatus !== "awaiting_payment") continue;
      if (!matchesOrderQuery(order, ordersQuery)) continue;
      rows.push({ key: `pay-${p.id}`, order, payment: p });
    }
    for (const o of filteredPaidOrders) {
      rows.push({ key: `ord-${o.id}`, order: o, payment: null });
    }
    return rows;
  }, [pendingPayments, dashboard, filteredPaidOrders, ordersStatus, ordersQuery]);

  const activeSubjectId = drawerSubject ? drawerSubject.id : null;

  return (
    <TeamShell
      session={session}
      dashboard={dashboard}
      currentRoute="/equipe/pedidos"
      onLogout={() => (window.location.href = "/api/logout")}
    >
      {/* C2 fix: refresh button lives on the StatusStrip (onRefresh) to
          avoid the duplicated affordance flagged in the cycle-3 audit. */}
      <PageHead
        title="Pedidos e Pix"
        meta={dashboard ? `${(dashboard.orders || []).length} pedidos` : null}
      />

      <StatusStrip
        chips={[
          { label: "Pix vencendo", count: expiringSoon.length, tone: "warn" },
          { label: "aguardando confirmação", count: awaitingConfirmation.length },
          { label: "pagos hoje", count: paidToday.length, tone: "ok" },
          { label: "Pix expirado", count: expiredPayments.length, tone: "danger" },
        ]}
        segments={[
          {
            label: "Tudo",
            count: (dashboard?.orders || []).length,
            active: ordersStatus === "all",
            onClick: () => setOrdersStatus("all"),
          },
          {
            label: "Pix pendente",
            count: pendingPayments.length,
            active: ordersStatus === "awaiting_payment",
            onClick: () => setOrdersStatus("awaiting_payment"),
          },
          {
            label: "Pago",
            count: paidToday.length,
            active: ordersStatus === "paid_pending_fulfillment",
            onClick: () => setOrdersStatus("paid_pending_fulfillment"),
          },
          {
            label: "Expirado",
            count: expiredPayments.length,
            active: ordersStatus === "payment_expired",
            onClick: () => setOrdersStatus("payment_expired"),
          },
          {
            label: "Cancelado",
            active: ordersStatus === "cancelled",
            onClick: () => setOrdersStatus("cancelled"),
          },
        ]}
        filters={
          <>
            <select
              className="filterIn filterIn--w-md"
              data-filter="ordersStatus"
              value={ordersStatus}
              onChange={(event) => setOrdersStatus(event.target.value)}
            >
              <option value="all">Todos os status</option>
              <option value="awaiting_payment">Aguardando pagamento</option>
              <option value="paid_pending_fulfillment">Pago — fulfillment</option>
              <option value="separating">Em separação</option>
              <option value="ready_to_ship">Pronto para envio</option>
              <option value="sent">Enviado</option>
              <option value="payment_expired">Pagamento expirado</option>
              <option value="cancelled">Cancelado</option>
              <option value="fulfillment_exception">Exceção operacional</option>
            </select>
            <input
              className="filterIn"
              data-filter="ordersQuery"
              value={ordersQuery}
              onChange={(event) => setOrdersQuery(event.target.value)}
              placeholder="Filtrar pedidos…"
            />
          </>
        }
        onRefresh={loadDashboard}
        resultCount={combinedRows.length}
        resultLabel="pedidos visíveis"
      />

      {message ? <p className="status">{message}</p> : null}
      {error ? <p className="pill danger">{error}</p> : null}

      <div
        className={styles.ordersGrid}
        data-drawer-open={drawerOpen && drawerSubject ? "true" : "false"}
      >
        <section className="panel" id="orders-surface">
          <header className="ph">
            <h3>Fila de pedidos</h3>
            <span className="meta">
              {(dashboard?.orders || []).length} pedidos · {paidToday.length} pagos hoje ·{" "}
              {pendingPayments.length} Pix abertos
            </span>
          </header>
          {!dashboard && !error ? (
            <div className="adm-stack-2" style={{ padding: "var(--sp-4)" }}>
              <span className="adm-skeleton adm-skeleton--row" aria-hidden />
              <span className="adm-skeleton adm-skeleton--row" aria-hidden />
              <span className="adm-skeleton adm-skeleton--row" aria-hidden />
              <span className="sr-only">Carregando pedidos e Pix...</span>
            </div>
          ) : combinedRows.length === 0 ? (
            <div className="adm-empty-state adm-empty-state--inset">
              <span className="adm-empty-state__title">Nenhum pedido na fila</span>
              <span className="adm-empty-state__hint">
                Quando novos Pix entrarem, aparecem aqui em ordem de chegada.
              </span>
            </div>
          ) : (
            <Ledger>
              {combinedRows.map((row) => {
                const subjectId = row.payment?.id || row.order?.id;
                return (
                  <OrderRow
                    key={row.key}
                    order={row.order}
                    payment={row.payment}
                    busyKey={busyPaymentId}
                    selected={activeSubjectId === subjectId}
                    onOpen={() =>
                      row.payment
                        ? openPaymentDrawer(row.payment.id)
                        : openOrderDrawer(row.order.id)
                    }
                    onPay={(pid) => runPaymentAction(pid, "pay")}
                  />
                );
              })}
            </Ledger>
          )}
        </section>

        {drawerOpen && drawerSubject ? (
          <OrderDrawer
            order={drawerOrder}
            payment={drawerPayment}
            busyKey={busyPaymentId}
            onClose={() => {
              setDrawerOpen(false);
              setDrawerSubject(null);
            }}
            onCancelOrder={cancelOrder}
            onPaymentAction={runPaymentAction}
          />
        ) : null}
      </div>
    </TeamShell>
  );
}

function matchesOrderQuery(order, rawQuery) {
  const query = normalized(rawQuery);
  if (!query) return true;
  const values = [
    order.id,
    order.patientName,
    order.status,
    order.paymentProvider,
    order.paymentStatus,
    order.shipment?.carrier,
    order.shipment?.trackingCode,
    ...(order.items || []).map((item) => `${item.name} ${item.unit}`),
  ];
  return values.some((value) => normalized(value).includes(query));
}

function filterOrders(orders, rawQuery, status) {
  return orders.filter((order) => {
    const matchesStatus = status === "all" || order.status === status;
    return matchesStatus && matchesOrderQuery(order, rawQuery);
  });
}

function normalized(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : {},
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Erro na requisição.");
  }
  return payload;
}
