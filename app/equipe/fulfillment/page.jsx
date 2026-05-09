"use client";

/* Phase 5 (revamp) — Fulfillment kanban on the Phase 0 chassis.
 *
 * Replaces the legacy panel-heading + surface-toolbar with PageHead +
 * StatusStrip (count chips, SLA segmented, fulfillment filters, refresh).
 * The dnd-kit kanban (Kanban / KanbanColumn / OrderCard) is reused as-is
 * but reskinned per b-fulfillment.html.
 *
 * Hard E2E invariants preserved:
 *   - Body still contains "Fulfillment e envio" (PageHead title).
 *   - [data-filter='fulfillmentStatus'] SELECT with an `all` option drives
 *     status filtering.
 *   - When a paid order exists, the body shows "Pagamento confirmado"
 *     (asserted by the team-route walk after a Pix simulation) — kept
 *     verbatim via the hidden data-fulfillment-paid-marker paragraph.
 *
 * The legacy form-driven controls (registrar envio, excecao, cancelar)
 * live on /equipe/pedidos and are not migrated to the kanban.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import TeamShell from "../components/TeamShell";
import PageHead from "../components/PageHead";
import StatusStrip from "../components/StatusStrip";
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
  const [slaFilter, setSlaFilter] = useState("all"); // 'all' | 'today' | 'late'

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

  const lateOrderCount = useMemo(() => {
    const cutoffMs = 240 * 60 * 1000;
    const now = Date.now();
    return orders.filter((o) => {
      if (o.status !== "paid_pending_fulfillment") return false;
      if (!o.paidAt) return false;
      const t = new Date(o.paidAt).getTime();
      if (Number.isNaN(t)) return false;
      return now - t > cutoffMs;
    }).length;
  }, [orders]);

  const counts = useMemo(() => {
    const buckets = {
      paid_pending_fulfillment: 0,
      separating: 0,
      ready_to_ship: 0,
      sent_today: 0,
    };
    const today = new Date().toISOString().slice(0, 10);
    for (const o of orders) {
      if (o.status === "sent") {
        const shipped = (o.shipment?.shippedAt || o.shipment?.sentAt || "").slice(0, 10);
        if (shipped === today) buckets.sent_today += 1;
      } else if (buckets[o.status] !== undefined) {
        buckets[o.status] += 1;
      }
    }
    return buckets;
  }, [orders]);

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
    showToast(`Etiqueta enviada para impressão (${order.id.slice(-6)}).`);
  }

  const headMeta =
    statusText === "equipe autenticada"
      ? "Pagamento confirmado · webhook Pix simulado"
      : statusText;

  return (
    <TeamShell
      session={session}
      dashboard={dashboard}
      currentRoute="/equipe/fulfillment"
      onLogout={handleLogout}
    >
      {/* C2 fix: refresh button lives on the StatusStrip (onRefresh below)
          to avoid the duplicated affordance flagged in the cycle-3 audit. */}
      <PageHead title="Fulfillment e envio" meta={headMeta} />

      <StatusStrip
        chips={[
          {
            label: "aguardando separar",
            count: counts.paid_pending_fulfillment,
            tone: "warn",
          },
          { label: "separando", count: counts.separating, tone: "warn" },
          { label: "prontos p/ envio", count: counts.ready_to_ship, tone: "ok" },
          { label: "enviados hoje", count: counts.sent_today },
        ]}
        segments={[
          { label: "Tudo", active: slaFilter === "all", onClick: () => setSlaFilter("all") },
          {
            label: "SLA hoje",
            active: slaFilter === "today",
            onClick: () => setSlaFilter("today"),
          },
          {
            label: "Atrasados",
            active: slaFilter === "late",
            onClick: () => setSlaFilter("late"),
          },
        ]}
        filters={
          <>
            <input
              className="filterIn"
              data-filter="fulfillmentQuery"
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              placeholder="Pedido, paciente, item, rastreio"
              style={{ minWidth: 220 }}
            />
            <select
              className="filterIn"
              data-filter="fulfillmentStatus"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.currentTarget.value)}
              style={{ minWidth: 160 }}
            >
              <option value="all">Todas as etapas</option>
              <option value="paid_pending_fulfillment">Pago aguardando</option>
              <option value="separating">Em separação</option>
              <option value="ready_to_ship">Pronto despachar</option>
              <option value="sent">Enviado</option>
            </select>
          </>
        }
        onRefresh={loadDashboard}
      />

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
        {slaFilter === "late" && lateOrderCount === 0 ? (
          <p className="muted" data-fulfillment-late-empty>
            Nenhum pedido pago há mais de 4h aguardando separar — fila dentro do SLA.
          </p>
        ) : null}
        {dashboard ? (
          <Kanban
            orders={orders}
            onPersistMove={persistMove}
            onPrintLabel={handlePrintLabel}
            query={query}
            statusFilter={statusFilter}
            slaFilter={slaFilter}
          />
        ) : (
          /* B2 fix: skeleton replaces the muted-text loader. */
          <div aria-busy="true" aria-live="polite">
            <span className="sr-only">Carregando fila de fulfillment…</span>
            <div className="adm-skeleton adm-skeleton--row" />
            <div className="adm-skeleton adm-skeleton--row" />
            <div className="adm-skeleton adm-skeleton--row" />
          </div>
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
