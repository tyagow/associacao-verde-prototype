"use client";

import styles from "./CasePanel.module.css";

/**
 * Phase 7 — Selected case panel (RIGHT pane).
 *
 * Patient context as fact grid (Ultimo login, Pedido, Pix, Reserva, Envio,
 * Documentos, Historico, Solicitacoes), followed by the open ticket list
 * with inline `Em atendimento` / `Resolver` buttons. The conversation
 * Thread + ReplyBox are rendered as children below this panel by the
 * Workbench so the panel stays focused on metadata + ticket actions.
 *
 * E2E preserves visible texts: "Ultimo login", "Reserva",
 * "documento(s) registrados", "Duvida sobre renovacao",
 * "Revisao de acesso".
 */
export default function CasePanel({ item, onUpdateTicket, children }) {
  const { patient, latestOrder, activeReservation, orders, documents, tickets } = item;
  const allowed = patient.eligibility?.allowed;
  return (
    <article className={styles.txCase} aria-label="Caso de suporte selecionado">
      <header className={styles.txCaseHead}>
        <div>
          <span className="kicker">{patient.memberCode}</span>
          <h3>{patient.name}</h3>
          <p>{patient.eligibility?.reason || "Paciente liberado para atendimento."}</p>
        </div>
        <span className={`${styles.txCasePill}${allowed ? "" : " " + styles.danger}`}>
          {allowed ? "Liberado" : "Bloqueado"}
        </span>
      </header>

      <dl className={styles.txFacts}>
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
              ? `${tickets.filter((t) => t.status !== "resolved").length} aberta(s)`
              : "Nenhuma solicitacao aberta"
          }
        />
      </dl>

      <div className={styles.txTickets}>
        <span className={styles.txTicketsHead}>Solicitacoes</span>
        {tickets.length === 0 ? (
          <p className={styles.txTicketEmpty}>Nenhuma solicitacao registrada.</p>
        ) : (
          tickets.map((ticket) => (
            <article key={ticket.id} className={styles.txTicket}>
              <strong>{ticket.subject}</strong>
              <span>{ticket.message}</span>
              <span className={styles.txTicketMeta}>
                {priorityLabel(ticket.priority)} · {statusLabel(ticket.status)} ·{" "}
                {ticket.type === "access_recovery" ? "Revisao de acesso" : "Suporte"} ·{" "}
                {formatDateTime(ticket.createdAt)}
              </span>
              {ticket.accessReason ? (
                <span className={styles.txTicketMeta}>Motivo de acesso: {ticket.accessReason}</span>
              ) : null}
              {ticket.status !== "resolved" ? (
                <div className={styles.txTicketActions}>
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
              ) : null}
            </article>
          ))
        )}
      </div>

      {children}
    </article>
  );
}

function Fact({ label, value }) {
  return (
    <div className={styles.txFactRow}>
      <strong>{label}</strong>
      <span>{value}</span>
    </div>
  );
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
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}
