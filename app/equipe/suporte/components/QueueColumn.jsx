"use client";

import styles from "./QueueColumn.module.css";

/**
 * Phase 7 — Support queue column (LEFT pane of the workbench).
 *
 * Sticky, scrollable list of cases. Each row carries:
 *   - priority pill (Bloqueado / Pix vencendo / Em separacao / Liberado)
 *   - patient name + member code
 *   - one-line summary of the most relevant signal
 *     (latest order status, ticket type, or "sem pedido")
 *
 * Selection is controlled: parent owns selectedPatientId and onSelect.
 */
export default function QueueColumn({ cases, selectedPatientId, onSelect }) {
  return (
    <aside className={styles.txQueue} aria-label="Fila de suporte">
      <header className={styles.txQueueHead}>
        <span className={styles.txQueueTitle}>Atendimentos filtrados</span>
        <span className={styles.txQueueCount}>{cases.length} caso(s)</span>
      </header>
      <div className={styles.txQueueScroll}>
        {cases.length === 0 ? (
          <p className={styles.txQueueEmpty}>Nenhum atendimento encontrado para o filtro atual.</p>
        ) : null}
        {cases.map((item) => {
          const priority = priorityFor(item);
          const summary = summaryFor(item);
          const isActive = selectedPatientId === item.patient.id;
          return (
            <button
              key={item.patient.id}
              type="button"
              className={`${styles.txQueueRow}${isActive ? " " + styles.active : ""}`}
              onClick={() => onSelect(item.patient.id)}
              aria-pressed={isActive}
            >
              <span
                className={`${styles.txQueuePill}${priority.tone ? " " + styles[priority.tone] : ""}`.trim()}
              >
                {priority.label}
              </span>
              <strong className={styles.txQueueName}>{item.patient.name}</strong>
              <span className={styles.txQueueSummary}>
                {item.patient.memberCode} · {summary}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function priorityFor(item) {
  if (!item.patient.eligibility?.allowed) return { label: "Bloqueado", tone: "danger" };
  if (item.tickets.some((t) => t.status === "open" && t.priority === "urgent"))
    return { label: "Urgente", tone: "danger" };
  if (item.tickets.some((t) => t.status === "open" && t.priority === "high"))
    return { label: "Alta", tone: "warn" };
  if (item.latestOrder?.status === "awaiting_payment")
    return { label: "Pix vencendo", tone: "warn" };
  if (item.tickets.some((t) => t.status === "open")) return { label: "Aberto", tone: "warn" };
  if (item.tickets.some((t) => t.status === "in_progress"))
    return { label: "Em atendimento", tone: "warn" };
  return { label: "Liberado", tone: "good" };
}

function summaryFor(item) {
  const openTickets = item.tickets.filter((t) => t.status !== "resolved").length;
  const ticketTypes = [
    ...new Set(
      item.tickets.map((t) => (t.type === "access_recovery" ? "Revisao de acesso" : "Suporte")),
    ),
  ];
  const orderLabel = item.latestOrder ? statusLabel(item.latestOrder.status) : "Sem pedido";
  const ticketsLabel = openTickets ? `${openTickets} aberta(s)` : "sem ticket aberto";
  const typesLabel = ticketTypes.length ? ` · ${ticketTypes.join(" / ")}` : "";
  return `${orderLabel} · ${ticketsLabel}${typesLabel}`;
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
      cancelled: "Cancelado",
      fulfillment_exception: "Excecao operacional",
    }[status] ||
    status ||
    "sem status"
  );
}
