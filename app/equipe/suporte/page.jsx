"use client";

import { useEffect, useMemo, useState } from "react";
import Brand from "../../components/Brand";

export default function SupportPage() {
  const [dashboard, setDashboard] = useState(null);
  const [filters, setFilters] = useState({ supportQuery: "", supportStatus: "all" });
  const [selectedPatientId, setSelectedPatientId] = useState("");
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

  async function updateTicket(ticketId, nextStatus) {
    try {
      const payload = await api("/api/team/support-requests", {
        method: "POST",
        body: { ticketId, status: nextStatus },
      });
      await load();
      showToast(`Solicitacao ${statusLabel(payload.ticket?.status || nextStatus).toLowerCase()}.`);
    } catch (updateError) {
      setError(updateError.message);
      showToast(updateError.message);
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

  const cases = useMemo(() => supportCases(dashboard, filters), [dashboard, filters]);
  const selectedCase =
    cases.find((item) => item.patient.id === selectedPatientId) || cases[0] || null;
  const openTickets =
    dashboard?.supportTickets?.filter((ticket) => ticket.status !== "resolved").length || 0;

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
          <a className="ghost" href="/equipe/fulfillment">
            Fulfillment
          </a>
          <a className="ghost active" href="/equipe/suporte">
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
            <a href="/equipe/fulfillment">Fulfillment e envio</a>
            <a className="active" href="/equipe/suporte">
              Suporte ao paciente
            </a>
            <a href="/admin">Admin e compliance</a>
          </aside>
          <section className="surface-stack">
            <article className="panel">
              <div className="section-heading">
                <div>
                  <p className="kicker">Suporte ao paciente</p>
                  <h2>Contexto completo de atendimento</h2>
                  <p className="muted">
                    Elegibilidade, login, pedido, pagamento, reserva, envio, documentos e
                    solicitacoes do paciente.
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
                <section className="route-summary">
                  <Metric label="Atendimentos filtrados" value={cases.length} />
                  <Metric
                    label="Bloqueados"
                    value={cases.filter((item) => !item.patient.eligibility?.allowed).length}
                  />
                  <Metric
                    label="Com Pix pendente"
                    value={
                      cases.filter((item) => item.latestOrder?.status === "awaiting_payment").length
                    }
                  />
                  <Metric label="Solicitacoes abertas" value={openTickets} />
                </section>
                <div className="ledger-section-heading">
                  <h3>Atendimentos filtrados</h3>
                  <span>{cases.length} caso(s)</span>
                </div>
                {cases.length ? (
                  <section className="support-workbench" aria-label="Workbench de suporte">
                    <div className="support-queue" aria-label="Fila de suporte">
                      {cases.map((item) => (
                        <SupportQueueRow
                          key={item.patient.id}
                          item={item}
                          selected={selectedCase?.patient.id === item.patient.id}
                          onSelect={() => setSelectedPatientId(item.patient.id)}
                        />
                      ))}
                    </div>
                    {selectedCase ? (
                      <SupportCasePanel item={selectedCase} onUpdateTicket={updateTicket} />
                    ) : null}
                  </section>
                ) : (
                  <p className="muted">Nenhum atendimento encontrado para o filtro atual.</p>
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

function SupportQueueRow({ item, selected, onSelect }) {
  const { patient, latestOrder, tickets } = item;
  const openTickets = tickets.filter((ticket) => ticket.status !== "resolved").length;
  const ticketTypes = [
    ...new Set(
      tickets.map((ticket) =>
        ticket.type === "access_recovery" ? "Revisao de acesso" : "Suporte",
      ),
    ),
  ];
  return (
    <button
      className={`support-queue-row ${selected ? "active" : ""}`.trim()}
      type="button"
      onClick={onSelect}
    >
      <span className={`support-priority ${patient.eligibility?.allowed ? "" : "danger"}`.trim()}>
        {patient.eligibility?.allowed ? "Liberado" : "Bloqueado"}
      </span>
      <strong>{patient.name}</strong>
      <span>
        {patient.memberCode} · {latestOrder ? statusLabel(latestOrder.status) : "Sem pedido"} ·{" "}
        {openTickets ? `${openTickets} aberta(s)` : "sem ticket aberto"}
        {ticketTypes.length ? ` · ${ticketTypes.join(" / ")}` : ""}
      </span>
    </button>
  );
}

function SupportCasePanel({ item, onUpdateTicket }) {
  const { patient, latestOrder, activeReservation, orders, documents, tickets } = item;
  return (
    <article className="support-case-panel">
      <div className="support-case-head">
        <div>
          <span className="kicker">{patient.memberCode}</span>
          <h3>{patient.name}</h3>
          <p>{patient.eligibility?.reason || "Paciente liberado."}</p>
        </div>
        <span className={`pill ${patient.eligibility?.allowed ? "" : "danger"}`.trim()}>
          {patient.eligibility?.allowed ? "Liberado" : "Bloqueado"}
        </span>
      </div>
      <div className="support-facts">
        <Fact
          label="Ultimo login"
          value={patient.lastLoginAt ? formatDateTime(patient.lastLoginAt) : "Sem login registrado"}
        />
        <Fact
          label="Pedido"
          value={
            latestOrder ? `${latestOrder.id} · ${statusLabel(latestOrder.status)}` : "Sem pedido"
          }
        />
        <Fact
          label="Pix"
          value={
            latestOrder?.paymentStatus
              ? statusLabel(latestOrder.paymentStatus)
              : "Sem pagamento aberto"
          }
        />
        <Fact
          label="Reserva"
          value={
            activeReservation
              ? `Ativa ate ${formatDateTime(activeReservation.expiresAt)}`
              : "Sem reserva ativa"
          }
        />
        <Fact
          label="Envio"
          value={
            latestOrder?.shipment
              ? `${latestOrder.shipment.carrier} · ${latestOrder.shipment.status} · ${latestOrder.shipment.trackingCode || "sem rastreio"}`
              : "Sem envio registrado"
          }
        />
        <Fact label="Documentos" value={`${documents.length} documento(s) registrados`} />
        <Fact label="Historico" value={`${orders.length} pedido(s) encontrados`} />
        <Fact
          label="Solicitacoes"
          value={
            tickets.length
              ? `${tickets.filter((ticket) => ticket.status !== "resolved").length} aberta(s)`
              : "Nenhuma solicitacao aberta"
          }
        />
      </div>
      {tickets.length ? (
        <div className="ticket-list">
          {tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} onUpdateTicket={onUpdateTicket} />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function Fact({ label, value }) {
  return (
    <div className="support-fact-row">
      <strong>{label}</strong>
      <span>{value}</span>
    </div>
  );
}

function TicketCard({ ticket, onUpdateTicket }) {
  return (
    <article className="support-ticket-row">
      <div className="ledger-primary">
        <strong>{ticket.subject}</strong>
        <span>{ticket.message}</span>
        <span>
          {priorityLabel(ticket.priority)} · {statusLabel(ticket.status)} ·{" "}
          {ticket.type === "access_recovery" ? "Revisao de acesso" : "Suporte"} ·{" "}
          {formatDateTime(ticket.createdAt)}
        </span>
        {ticket.accessReason ? <span>Motivo de acesso: {ticket.accessReason}</span> : null}
      </div>
      <div className="ticket-action-row">
        <button
          className="mini"
          type="button"
          onClick={() => onUpdateTicket(ticket.id, "in_progress")}
        >
          Em atendimento
        </button>
        <button
          className="mini"
          type="button"
          onClick={() => onUpdateTicket(ticket.id, "resolved")}
        >
          Resolver
        </button>
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

function statusLabel(status) {
  return (
    {
      awaiting_payment: "Pix pendente",
      paid_pending_fulfillment: "Pago, aguardando separacao",
      separating: "Em separacao",
      ready_to_ship: "Pronto para envio",
      sent: "Enviado",
      payment_expired: "Pagamento expirado",
      pending: "Pix pendente",
      paid: "Pago",
      expired: "Expirado",
      open: "Aberto",
      in_progress: "Em atendimento",
      resolved: "Resolvido",
    }[status] ||
    status ||
    "sem status"
  );
}

function priorityLabel(priority) {
  return (
    {
      urgent: "Urgente",
      high: "Alta",
      normal: "Normal",
    }[priority] || "Normal"
  );
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
