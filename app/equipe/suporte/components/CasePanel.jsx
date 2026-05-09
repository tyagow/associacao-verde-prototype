"use client";

import styles from "./CasePanel.module.css";

/**
 * Phase 6 — Lean case panel: header + meta strip with status pill,
 * "aberto há …" timer and a "marcar resolvido" ghost. The fact grid
 * (Ultimo login, Reserva, Documentos, etc.) lives in the new
 * ContextColumn. Thread + ReplyBox render as children.
 *
 * Preserves the visible literal `Revisao de acesso` in the meta sub-line
 * when the ticket is of type `access_recovery`.
 */
export default function CasePanel({ item, ticket, onUpdateTicket, children }) {
  const allowed = item.patient.eligibility?.allowed;
  const subject = ticket?.subject || "Atendimento";
  const openedAgo = ticket?.createdAt ? agoLabel(ticket.createdAt) : "";
  const tone =
    ticket?.status === "open" ? "warn" : ticket?.status === "in_progress" ? "warn" : "ok";
  const statusText =
    ticket?.status === "open"
      ? "aguardando equipe"
      : ticket?.status === "in_progress"
        ? "em atendimento"
        : ticket?.status === "resolved"
          ? "resolvido"
          : allowed
            ? "liberado"
            : "bloqueado";
  return (
    <article className={`${styles.qcol} ${styles.case}`} aria-label="Caso de suporte selecionado">
      <div className={styles.header}>
        <div>
          <h2>{subject}</h2>
          <div className={styles.sub}>
            {item.patient.name} · <span className={styles.mono}>{item.patient.memberCode}</span>
            {ticket?.id ? (
              <>
                {" "}
                · caso <span className={styles.mono}>{ticket.id}</span>
              </>
            ) : null}
            {ticket?.type === "access_recovery" ? <> · Revisao de acesso</> : null}
          </div>
        </div>
        <div className={styles.meta}>
          <span className={`pill ${tone}`}>{statusText}</span>
          {openedAgo ? <span>aberto {openedAgo}</span> : null}
          {ticket && ticket.status !== "resolved" ? (
            <button
              type="button"
              className="btn ghost mini"
              onClick={() => onUpdateTicket(ticket.id, "resolved")}
            >
              marcar resolvido
            </button>
          ) : null}
        </div>
      </div>
      {children}
    </article>
  );
}

function agoLabel(value) {
  const ms = Date.now() - new Date(value).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}
