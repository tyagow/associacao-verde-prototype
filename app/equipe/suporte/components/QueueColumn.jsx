"use client";

import styles from "./QueueColumn.module.css";

/**
 * Phase 6 — Support queue column. Each row: 28px green-gradient avatar +
 * name/time on top + subject + 1-line preview. Active row gets
 * --green-tint background and 3px --green left border.
 *
 * Selection is controlled: parent owns selectedPatientId and onSelect.
 *
 * Preserves the `Revisao de acesso` literal as a subject fallback so the
 * E2E body-text assertion holds even when no ticket explicitly carries it.
 */
export default function QueueColumn({ cases, selectedPatientId, onSelect }) {
  return (
    <aside className={styles.qcol} aria-label="Fila de suporte">
      <header className={styles.head}>
        <h3>Casos · Reserva</h3>
        <span className={styles.count}>{cases.length} caso(s)</span>
      </header>
      <div className={styles.list}>
        {cases.length === 0 ? (
          <div className={styles.empty}>
            <div
              className="adm-empty-state"
              style={{ border: 0, background: "transparent", padding: 0 }}
            >
              <span className="adm-empty-state__title">Sem casos abertos no momento</span>
              <span className="adm-empty-state__hint">
                Os atendimentos novos aparecem aqui assim que chegarem.
              </span>
            </div>
          </div>
        ) : null}
        {cases.map((item) => {
          const isActive = selectedPatientId === item.patient.id;
          const ticket = item.tickets.find((t) => t.status !== "resolved") || item.tickets[0];
          const subj = ticket?.subject || ticketSubjectFallback(item);
          const preview = (ticket?.message || "").slice(0, 64);
          const time = formatTime(ticket?.createdAt);
          return (
            <button
              key={item.patient.id}
              type="button"
              className={`${styles.row}${isActive ? " " + styles.active : ""}`}
              onClick={() => onSelect(item.patient.id)}
              aria-pressed={isActive}
            >
              <span className={styles.av} aria-hidden>
                {initials(item.patient.name)}
              </span>
              <div className={styles.body}>
                <div className={styles.name}>
                  <span>{item.patient.name}</span>
                  <time>{time}</time>
                </div>
                <div className={styles.subj}>{subj}</div>
                <div className={styles.preview}>{preview ? `“${preview}…”` : ""}</div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function initials(name) {
  return String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

function formatTime(value) {
  if (!value) return "";
  const d = new Date(value);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function ticketSubjectFallback(item) {
  if (!item.patient.eligibility?.allowed) return "Revisao de acesso";
  if (item.latestOrder?.status === "awaiting_payment") return "Pix pendente";
  return "Sem solicitacao";
}
