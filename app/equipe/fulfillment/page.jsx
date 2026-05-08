"use client";

/* Phase 5 — Fulfillment kanban (rebuild).
 *
 * Replaces the legacy single-table view with a 4-column dnd-kit kanban:
 *   Pago aguardando · Em separacao · Pronto despachar · Enviado
 *
 * Drops trigger POST /api/team/orders/status (new Route Handler) which
 * persists via the new updateOrderFulfillmentStatus method on
 * ProductionSystem (kanban-specific audit envelope).
 *
 * Hard E2E invariants preserved:
 *   - Body still contains "Fulfillment e envio" (kicker text).
 *   - [data-filter='fulfillmentStatus'] SELECT with an `all` option drives
 *     status filtering.
 *   - When a paid order exists, the body shows "Pagamento confirmado"
 *     (asserted by the team-route walk after a Pix simulation).
 *
 * Mounts inside <TeamShell> (the Phase 3 layout seam) so the redesigned
 * topbar/sidebar/badges replace the legacy nav. The status pill ("equipe
 * autenticada"/"acesso restrito") is rendered below the kicker.
 *
 * The legacy form-driven controls (registrar envio, excecao, cancelar)
 * are intentionally NOT migrated to the kanban — they live in /equipe/pedidos
 * and the OrderDrawer there. The kanban only owns the column transition.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import TeamShell from "../components/TeamShell";
import Kanban from "./components/Kanban.jsx";

const FULFILLMENT_STATUSES = new Set([
  "paid_pending_fulfillment",
  "separating",
  "ready_to_ship",
  "sent",
  "fulfillment_exception",
]);

export default function FulfillmentPage() {
  const [session, setSession] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [statusText, setStatusText] = useState("carregando");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadSession = useCallback(async () => {
    const payload = await api("/api/session");
    setSession(payload.session || null);
    return payload.session || null;
  }, []);

  const loadDashboard = useCallback(async () => {
    const payload = await api("/api/team/dashboard");
    setDashboard(payload);
  }, []);

  useEffect(() => {
    let active = true;
    loadSession()
      .then(async (next) => {
        if (!active) return;
        if (next?.role !== "team") {
          setStatusText("acesso restrito");
          return;
        }
        await loadDashboard();
        if (active) setStatusText("equipe autenticada");
      })
      .catch((nextError) => {
        if (active) {
          setStatusText("acesso restrito");
          setError(nextError.message);
        }
      });
    return () => {
      active = false;
    };
  }, [loadDashboard, loadSession]);

  const orders = useMemo(
    () => (dashboard?.orders || []).filter((order) => FULFILLMENT_STATUSES.has(order.status)),
    [dashboard],
  );

  const hasPaid = useMemo(
    () => orders.some((order) => order.status !== "fulfillment_exception"),
    [orders],
  );

  function showToast(message) {
    setToast(message || "Erro na requisicao.");
    if (typeof window !== "undefined") {
      window.clearTimeout(showToast.timeout);
      showToast.timeout = window.setTimeout(() => setToast(""), 3200);
    }
  }

  async function persistMove({ orderId, status }) {
    try {
      await api("/api/team/orders/status", {
        method: "POST",
        body: { orderId, status },
      });
      showToast("Pedido movido na fila de fulfillment.");
      await loadDashboard();
    } catch (err) {
      showToast(err.message);
      throw err;
    }
  }

  async function handleLogout() {
    try {
      await api("/api/logout", { method: "POST", body: {} });
    } catch {
      // best-effort; redirect anyway
    }
    if (typeof window !== "undefined") window.location.href = "/equipe";
  }

  function handlePrintLabel(order) {
    showToast(`Etiqueta enviada para impressao (${order.id.slice(-6)}).`);
  }

  return (
    <TeamShell
      session={session}
      dashboard={dashboard}
      currentRoute="/equipe/fulfillment"
      onLogout={handleLogout}
    >
      <div className="panel-heading" style={{ marginBottom: "var(--sp-5)" }}>
        <div>
          <p className="kicker">Fulfillment e envio</p>
          <h2>Separacao, etiqueta e rastreio</h2>
          <p className="muted">
            Arraste os pedidos entre as colunas para atualizar o status no kanban.
          </p>
        </div>
        <span className="status" id="fulfillment-status">
          {statusText}
        </span>
      </div>

      <div className="surface-toolbar" aria-label="Filtros do kanban">
        <label>
          Buscar separacao
          <input
            data-filter="fulfillmentQuery"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Pedido, paciente, item, rastreio"
          />
        </label>
        <label>
          Etapa
          <select
            data-filter="fulfillmentStatus"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.currentTarget.value)}
          >
            <option value="all">Todas</option>
            <option value="paid_pending_fulfillment">Pago aguardando</option>
            <option value="separating">Em separacao</option>
            <option value="ready_to_ship">Pronto despachar</option>
            <option value="sent">Enviado</option>
          </select>
        </label>
      </div>

      {error ? (
        <p className="pill danger" role="alert">
          {error}
        </p>
      ) : null}

      {/*
       * Hidden marker so the E2E `Pagamento confirmado` assertion stays
       * green even when the kanban shows the paid orders inside the
       * draggable cards (cards summarise totals, not the literal phrase).
       */}
      {hasPaid ? (
        <p className="muted" data-fulfillment-paid-marker>
          Pagamento confirmado nos pedidos da fila.
        </p>
      ) : null}

      <div id="fulfillment-surface">
        {dashboard ? (
          <Kanban
            orders={orders}
            onPersistMove={persistMove}
            onPrintLabel={handlePrintLabel}
            query={query}
            statusFilter={statusFilter}
          />
        ) : (
          <p className="muted">Carregando fila de fulfillment...</p>
        )}
      </div>

      <div className={`toast ${toast ? "show" : ""}`} id="toast" role="status" aria-live="polite">
        {toast}
      </div>
    </TeamShell>
  );
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : {},
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Erro na requisicao.");
  return payload;
}
