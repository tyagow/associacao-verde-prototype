"use client";

import { useState } from "react";
import styles from "./ReplyBox.module.css";

/**
 * Phase 7 — Reply composer.
 *
 * Posts the body to /api/team/support-replies. On success the parent
 * triggers a thread refresh; on failure we surface the error inline
 * without losing the draft.
 */
export default function ReplyBox({ ticketId, onSent }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(event) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) {
      setError("Digite uma resposta antes de enviar.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/team/support-replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, body: trimmed }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao enviar resposta.");
      }
      setBody("");
      onSent?.(payload.message || null);
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.txReply} onSubmit={send} aria-label="Responder paciente">
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Escreva uma resposta para o paciente..."
        disabled={busy}
        aria-label="Mensagem para o paciente"
      />
      <div className={styles.txReplyRow}>
        <span className={styles.txReplyHint}>
          A resposta sera registrada no historico do atendimento e auditada.
        </span>
        <button type="submit" disabled={busy || !body.trim()}>
          {busy ? "Enviando..." : "Enviar resposta"}
        </button>
      </div>
      {error ? <span className={styles.txReplyError}>{error}</span> : null}
    </form>
  );
}
