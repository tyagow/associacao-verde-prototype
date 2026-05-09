"use client";

import { useState } from "react";
import styles from "./ReplyBox.module.css";

const QUICK_REASONS = [
  "Verificando webhook",
  "Pix confirmado",
  "Pedir comprovante",
  "Encaminhar p/ financeiro",
];

/**
 * Phase 6 — Reply composer with quick-reason chips on top, a textarea,
 * and a footer with a single `Enviar →` (primary) button.
 *
 * Note: a separate `Anotar` (internal-note) button was removed because no
 * internal-note backend exists yet. Re-add only when the backend supports
 * a `private: true` flag (or a dedicated /api/team/support/notes route).
 */
export default function ReplyBox({ ticketId, onSent }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function appendChip(text) {
    setBody((current) => (current ? `${current.trimEnd()}\n${text} ` : `${text} `));
  }

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
    <form className={styles.replybox} onSubmit={send} aria-label="Responder paciente">
      <div className={styles.chips}>
        {QUICK_REASONS.map((reason) => (
          <button
            key={reason}
            type="button"
            className={styles.chip}
            onClick={() => appendChip(reason)}
            disabled={busy}
          >
            + {reason}
          </button>
        ))}
      </div>
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Resposta para o paciente (Markdown ok)…"
        disabled={busy}
        aria-label="Mensagem para o paciente"
      />
      <div className={styles.actions}>
        <span className={styles.hint}>visível ao paciente · auditoria registra envio</span>
        <div className={styles.btns}>
          <button type="submit" className="btn primary" disabled={busy || !body.trim()}>
            {busy ? "Enviando..." : "Enviar →"}
          </button>
        </div>
      </div>
      {error ? <span className={styles.error}>{error}</span> : null}
    </form>
  );
}
