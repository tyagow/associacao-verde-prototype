"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageHead from "../../components/PageHead";
import StatusStrip from "../../components/StatusStrip";
import QueueColumn from "./QueueColumn";
import CasePanel from "./CasePanel";
import ContextColumn from "./ContextColumn";
import Thread from "./Thread";
import ReplyBox from "./ReplyBox";
import styles from "./Workbench.module.css";

/**
 * Phase 6 — Support workbench. 3-column layout (Queue 320 / Case flex / Context 320).
 *
 * Preserves the E2E selectors and texts from the legacy page:
 *   #support-surface, #support-status, [data-filter='supportQuery'],
 *   [data-filter='supportStatus'], "Ultimo login", "Reserva",
 *   "documento(s) registrados", "Suporte ao paciente",
 *   "Duvida sobre renovacao", "Revisao de acesso".
 */
export default function Workbench({ dashboard, onDashboardRefresh, error, status }) {
  const [filters, setFilters] = useState({ supportQuery: "", supportStatus: "all" });
  const [seg, setSeg] = useState("all"); // 'all' | 'mine' | 'sla4'
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

  useEffect(() => {
    if (cases.length === 0) return;
    if (!cases.some((item) => item.patient.id === selectedPatientId)) {
      setSelectedPatientId(cases[0].patient.id);
    }
  }, [cases, selectedPatientId]);

  useEffect(() => {
    setSelectedTicketId("");
    if (!userSelectedRef.current) return;
    userSelectedRef.current = false;
    if (typeof window === "undefined") return;
    const isMobile = window.matchMedia?.("(max-width: 720px)")?.matches;
    if (!isMobile) return;
    const node = caseSectionRef.current;
    if (!node || typeof node.scrollIntoView !== "function") return;
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

  const tickets = dashboard?.supportTickets || [];
  const openCount = tickets.filter((t) => t.status === "open").length;
  const waitingPatient = tickets.filter((t) => t.status === "in_progress").length;
  const today = new Date().toISOString().slice(0, 10);
  const resolvedToday = tickets.filter((t) => {
    if (t.status !== "resolved") return false;
    const day = (t.resolvedAt || t.updatedAt || "").slice(0, 10);
    return day === today;
  }).length;
  const reviewCount = tickets.filter(
    (t) => t.type === "access_recovery" && t.status !== "resolved",
  ).length;
  const renewCount = tickets.filter(
    (t) => t.status !== "resolved" && /renova/i.test(`${t.subject || ""} ${t.message || ""}`),
  ).length;

  return (
    <>
      <PageHead
        title="Suporte ao paciente"
        meta={
          <span id="support-status">
            {openCount} abertos · SLA 24h · {status}
          </span>
        }
        actions={
          <button type="button" className="btn ghost mini" onClick={onDashboardRefresh}>
            ↻ Atualizar
          </button>
        }
      />

      <StatusStrip
        chips={[
          { label: "abertos", count: openCount, tone: openCount ? "warn" : undefined },
          { label: "aguardando paciente", count: waitingPatient },
          { label: "resolvidos hoje", count: resolvedToday, tone: "ok" },
          { label: "Revisão de acesso", count: reviewCount },
          { label: "Dúvida sobre renovação", count: renewCount },
        ]}
        segments={[
          { label: "Tudo", active: seg === "all", onClick: () => setSeg("all") },
          { label: "Meus", active: seg === "mine", onClick: () => setSeg("mine") },
          { label: "SLA < 4h", active: seg === "sla4", onClick: () => setSeg("sla4") },
        ]}
        filters={
          <>
            <input
              data-filter="supportQuery"
              value={filters.supportQuery}
              onChange={onFilterChange}
              placeholder="Buscar paciente, pedido, rastreio…"
              aria-label="Buscar atendimento"
              style={{ minWidth: 180, maxWidth: 260 }}
            />
            <select
              data-filter="supportStatus"
              value={filters.supportStatus}
              onChange={onFilterChange}
              aria-label="Situação"
            >
              <option value="all">Todos</option>
              <option value="blocked">Acesso bloqueado</option>
              <option value="pending_payment">Pix pendente</option>
              <option value="fulfillment">Em separação/envio</option>
              <option value="sent">Enviado</option>
              <option value="no_order">Sem pedido</option>
              <option value="support_open">Solicitação aberta</option>
            </select>
          </>
        }
      />

      <div id="support-surface" className={styles.workbench}>
        {error ? <p className="pill danger">{error}</p> : null}
        {actionError ? <p className="pill danger">{actionError}</p> : null}

        {dashboard ? (
          cases.length ? (
            <div className={styles.cols}>
              <QueueColumn
                cases={cases}
                selectedPatientId={selectedCase?.patient.id || ""}
                onSelect={handleSelectPatient}
              />
              {selectedCase ? (
                <div ref={caseSectionRef} className={styles.caseWrap}>
                  <CasePanel
                    item={selectedCase}
                    ticket={selectedTicket}
                    onUpdateTicket={updateTicket}
                  >
                    <Thread messages={thread.messages} loading={threadLoading} />
                    {threadError ? <p className="pill danger">{threadError}</p> : null}
                    {selectedTicket ? (
                      <ReplyBox
                        ticketId={selectedTicket.id}
                        onSent={async () => {
                          await refreshThread();
                          await onDashboardRefresh?.();
                        }}
                      />
                    ) : null}
                  </CasePanel>
                </div>
              ) : null}
              {selectedCase ? <ContextColumn item={selectedCase} /> : null}
            </div>
          ) : (
            <p className={styles.empty}>Nenhum atendimento encontrado para o filtro atual.</p>
          )
        ) : (
          <p className="muted">Carregando atendimentos...</p>
        )}
      </div>
    </>
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
