"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QueueColumn from "./QueueColumn";
import CasePanel from "./CasePanel";
import Thread from "./Thread";
import ReplyBox from "./ReplyBox";
import styles from "./Workbench.module.css";

/**
 * Phase 7 — Support workbench (LEFT queue + RIGHT case panel + thread).
 *
 * Owns:
 *   - dashboard fetch + filter state
 *   - selected patient/ticket
 *   - thread fetch (per-ticket, via /api/team/support-thread)
 *   - ticket status updates (POST /api/team/support-requests)
 *   - reply post-send refresh
 *
 * Preserves the E2E selectors and texts from the legacy page:
 *   #support-surface, [data-filter='supportQuery'],
 *   [data-filter='supportStatus'], "Ultimo login", "Reserva",
 *   "documento(s) registrados", "Suporte ao paciente",
 *   "Duvida sobre renovacao", "Revisao de acesso".
 */
export default function Workbench({ dashboard, onDashboardRefresh, error, status }) {
  const [filters, setFilters] = useState({ supportQuery: "", supportStatus: "all" });
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [thread, setThread] = useState({ ticket: null, messages: [] });
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState("");
  const [actionError, setActionError] = useState("");
  const caseSectionRef = useRef(null);
  const userSelectedRef = useRef(false);

  const cases = useMemo(() => supportCases(dashboard, filters), [dashboard, filters]);
  const selectedCase =
    cases.find((item) => item.patient.id === selectedPatientId) || cases[0] || null;
  const selectedTicket = useMemo(() => {
    if (!selectedCase) return null;
    return (
      selectedCase.tickets.find((t) => t.id === selectedTicketId) ||
      selectedCase.tickets.find((t) => t.status !== "resolved") ||
      selectedCase.tickets[0] ||
      null
    );
  }, [selectedCase, selectedTicketId]);

  // Auto-pick the first case when filtering changes the list.
  useEffect(() => {
    if (cases.length === 0) return;
    if (!cases.some((item) => item.patient.id === selectedPatientId)) {
      setSelectedPatientId(cases[0].patient.id);
    }
  }, [cases, selectedPatientId]);

  // Reset selected ticket when patient changes. On mobile, also scroll the
  // case panel into view so the user doesn't have to scroll down past the
  // queue strip after picking a case (Phase 12 mobile stack UX).
  useEffect(() => {
    setSelectedTicketId("");
    if (!userSelectedRef.current) return;
    userSelectedRef.current = false;
    if (typeof window === "undefined") return;
    const isMobile = window.matchMedia?.("(max-width: 720px)")?.matches;
    if (!isMobile) return;
    const node = caseSectionRef.current;
    if (!node || typeof node.scrollIntoView !== "function") return;
    // Use rAF so the layout settles after state change before scrolling.
    window.requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [selectedPatientId]);

  const handleSelectPatient = useCallback((id) => {
    userSelectedRef.current = true;
    setSelectedPatientId(id);
  }, []);

  const refreshThread = useCallback(async () => {
    if (!selectedTicket?.id) {
      setThread({ ticket: null, messages: [] });
      return;
    }
    setThreadLoading(true);
    setThreadError("");
    try {
      const response = await fetch(
        `/api/team/support-thread?ticketId=${encodeURIComponent(selectedTicket.id)}`,
        { cache: "no-store" },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Erro ao carregar conversa.");
      setThread({
        ticket: payload.ticket || null,
        messages: Array.isArray(payload.messages) ? payload.messages : [],
      });
    } catch (loadError) {
      setThreadError(loadError.message);
      setThread({ ticket: null, messages: [] });
    } finally {
      setThreadLoading(false);
    }
  }, [selectedTicket?.id]);

  useEffect(() => {
    refreshThread();
  }, [refreshThread]);

  function onFilterChange(event) {
    const { filter } = event.currentTarget.dataset;
    const { value } = event.currentTarget;
    setFilters((current) => ({ ...current, [filter]: value }));
  }

  async function updateTicket(ticketId, nextStatus) {
    setActionError("");
    try {
      const response = await fetch("/api/team/support-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, status: nextStatus }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Erro ao atualizar atendimento.");
      await onDashboardRefresh?.();
    } catch (updateError) {
      setActionError(updateError.message);
    }
  }

  const openTickets = dashboard?.supportTickets?.filter((t) => t.status !== "resolved").length || 0;

  return (
    <article className="panel">
      <div className="section-heading">
        <div>
          <p className="kicker">Suporte ao paciente</p>
          <h2>Contexto completo de atendimento</h2>
          <p className="muted">
            Elegibilidade, login, pedido, pagamento, reserva, envio, documentos e solicitacoes do
            paciente.
          </p>
        </div>
        <span className="status" id="support-status">
          {status}
        </span>
      </div>

      <div className="surface-toolbar" aria-label="Filtro de suporte">
        <label>
          Buscar atendimento
          <input
            data-filter="supportQuery"
            value={filters.supportQuery}
            onChange={onFilterChange}
            placeholder="Paciente, associado, pedido, rastreio ou bloqueio"
          />
        </label>
        <label>
          Situacao
          <select
            data-filter="supportStatus"
            value={filters.supportStatus}
            onChange={onFilterChange}
          >
            <option value="all">Todos</option>
            <option value="blocked">Acesso bloqueado</option>
            <option value="pending_payment">Pix pendente</option>
            <option value="fulfillment">Em separacao/envio</option>
            <option value="sent">Enviado</option>
            <option value="no_order">Sem pedido</option>
            <option value="support_open">Solicitacao aberta</option>
          </select>
        </label>
      </div>

      <div id="support-surface" className="stack">
        {error ? <p className="pill danger">{error}</p> : null}
        {actionError ? <p className="pill danger">{actionError}</p> : null}

        <section className={styles.txWorkbenchSummary} aria-label="Sumario de atendimentos">
          <Metric label="Atendimentos filtrados" value={cases.length} />
          <Metric
            label="Bloqueados"
            value={cases.filter((item) => !item.patient.eligibility?.allowed).length}
          />
          <Metric
            label="Com Pix pendente"
            value={cases.filter((item) => item.latestOrder?.status === "awaiting_payment").length}
          />
          <Metric label="Solicitacoes abertas" value={openTickets} />
        </section>

        {dashboard ? (
          cases.length ? (
            <section className={styles.txWorkbench} aria-label="Workbench de suporte">
              <QueueColumn
                cases={cases}
                selectedPatientId={selectedCase?.patient.id || ""}
                onSelect={handleSelectPatient}
              />
              {selectedCase ? (
                <div ref={caseSectionRef} className={styles.txWorkbenchSection}>
                  <CasePanel item={selectedCase} onUpdateTicket={updateTicket}>
                    {selectedTicket ? (
                      <>
                        <Thread messages={thread.messages} loading={threadLoading} />
                        {threadError ? <p className="pill danger">{threadError}</p> : null}
                        <ReplyBox
                          ticketId={selectedTicket.id}
                          onSent={async () => {
                            await refreshThread();
                            await onDashboardRefresh?.();
                          }}
                        />
                      </>
                    ) : null}
                  </CasePanel>
                </div>
              ) : null}
            </section>
          ) : (
            <p className={styles.txWorkbenchEmpty}>
              Nenhum atendimento encontrado para o filtro atual.
            </p>
          )
        ) : (
          <p className="muted">Carregando atendimentos...</p>
        )}
      </div>
    </article>
  );
}

function Metric({ label, value }) {
  return (
    <article className={styles.txMetric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function supportCases(dashboard, filters) {
  if (!dashboard) return [];
  const query = normalize(filters.supportQuery);
  const status = filters.supportStatus;
  return dashboard.patients
    .map((patient) => {
      const orders = dashboard.orders.filter(
        (order) => order.patientId === patient.id || order.patientName === patient.name,
      );
      const latestOrder = orders[0] || null;
      const activeReservation = latestOrder
        ? dashboard.reservations.find(
            (reservation) =>
              reservation.orderId === latestOrder.id && reservation.status === "active",
          )
        : null;
      const documents = dashboard.prescriptionDocuments.filter(
        (document) =>
          document.memberCode === patient.memberCode || document.patientId === patient.id,
      );
      const tickets = (dashboard.supportTickets || []).filter(
        (ticket) => ticket.patientId === patient.id || ticket.memberCode === patient.memberCode,
      );
      return { patient, orders, latestOrder, activeReservation, documents, tickets };
    })
    .filter((item) => {
      if (status === "blocked") return !item.patient.eligibility?.allowed;
      if (status === "pending_payment") return item.latestOrder?.status === "awaiting_payment";
      if (status === "fulfillment")
        return ["paid_pending_fulfillment", "separating", "ready_to_ship"].includes(
          item.latestOrder?.status,
        );
      if (status === "sent") return item.latestOrder?.status === "sent";
      if (status === "no_order") return !item.latestOrder;
      if (status === "support_open")
        return item.tickets.some((ticket) => ticket.status !== "resolved");
      return true;
    })
    .filter(
      (item) =>
        !query ||
        normalize(
          [
            item.patient.name,
            item.patient.memberCode,
            item.patient.eligibility?.reason,
            ...item.tickets.map((ticket) => `${ticket.subject} ${ticket.message} ${ticket.status}`),
            item.latestOrder?.id,
            item.latestOrder?.shipment?.trackingCode,
          ].join(" "),
        ).includes(query),
    );
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
