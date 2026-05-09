"use client";

import styles from "./Thread.module.css";

/**
 * Phase 6 — Conversation thread with alternating bubble alignment.
 *   - patient (paper-warm) left-aligned with a top-left flat corner
 *   - team    (ink/paper) right-aligned with a top-right flat corner
 */
export default function Thread({ messages = [], loading = false }) {
  return (
    <section className={styles.thread} aria-label="Conversa do atendimento">
      {loading ? <p className={styles.empty}>Carregando conversa...</p> : null}
      {!loading && messages.length === 0 ? (
        <p className={styles.empty}>Sem mensagens ainda. Use a resposta abaixo.</p>
      ) : null}
      {messages.map((message) => {
        const side = message.authorType === "team" ? "fromEq" : "fromPat";
        return (
          <article key={message.id} className={`${styles.msg} ${styles[side]}`}>
            <div className={styles.who}>
              {authorLabel(message)} · {formatTime(message.createdAt)}
            </div>
            <p>{message.body}</p>
          </article>
        );
      })}
    </section>
  );
}

function authorLabel(message) {
  if (message.authorType === "team") return `${message.authorName || "Equipe"} (equipe)`;
  return message.authorName || "Paciente";
}

function formatTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}
