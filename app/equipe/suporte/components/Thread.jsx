"use client";

import styles from "./Thread.module.css";

/**
 * Phase 7 — Conversation thread for the selected ticket.
 *
 * Renders the full chronological message list returned by
 * GET /api/team/support-thread. The first message is the synthesized
 * seed pulled from the ticket itself (authorType === "patient"); all
 * subsequent messages come from support_messages (schema v15).
 */
export default function Thread({ messages = [], loading = false }) {
  return (
    <section className={styles.txThread} aria-label="Conversa do atendimento">
      <header className={styles.txThreadHead}>Conversa</header>
      {loading ? <p className={styles.txThreadEmpty}>Carregando conversa...</p> : null}
      {!loading && messages.length === 0 ? (
        <p className={styles.txThreadEmpty}>Sem mensagens ainda. Use a resposta abaixo.</p>
      ) : null}
      {messages.map((message) => (
        <article key={message.id} className={`${styles.txMessage} ${styles[message.authorType]}`}>
          <strong>{authorLabel(message)}</strong>
          <p>{message.body}</p>
          <time dateTime={message.createdAt}>{formatDateTime(message.createdAt)}</time>
        </article>
      ))}
    </section>
  );
}

function authorLabel(message) {
  if (message.authorType === "team") return message.authorName || "Equipe";
  return message.authorName || "Paciente";
}

function formatDateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}
