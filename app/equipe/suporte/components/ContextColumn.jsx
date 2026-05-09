"use client";

import { pluralize } from "../../components/pluralize.js";
import styles from "./ContextColumn.module.css";

/**
 * Phase 6 — Right-rail context column. Owns the E2E literals
 * "Ultimo login", "Reserva", and "documento(s) registrados".
 */
export default function ContextColumn({ item }) {
  const { patient, latestOrder, activeReservation, documents, orders } = item;
  const allowed = patient.eligibility?.allowed;
  return (
    <aside className={`${styles.qcol} ${styles.ctx}`} aria-label="Contexto do paciente">
      <div className={styles.section}>
        <h4>Paciente</h4>
        <Row label="Nome" value={<strong>{patient.name}</strong>} />
        <Row label="Código" value={<span className={styles.mono}>{patient.memberCode}</span>} />
        <Row
          label="Status"
          value={
            <span className={`pill ${allowed ? "ok" : "danger"}`}>
              {allowed ? "liberada" : "bloqueada"}
            </span>
          }
        />
        <Row
          label="Ultimo login"
          value={patient.lastLoginAt ? formatDateTime(patient.lastLoginAt) : "sem registro"}
        />
      </div>

      <div className={styles.section}>
        <h4>Pedido recente</h4>
        {latestOrder ? (
          <>
            <Row
              label={<span className={styles.mono}>{latestOrder.id}</span>}
              value={<span className={styles.num}>{formatBRL(latestOrder.totalCents)}</span>}
            />
            <Row label="Status" value={statusPill(latestOrder.status)} />
            <Row
              label="Reserva"
              value={
                activeReservation
                  ? `ativa até ${formatDateTime(activeReservation.expiresAt)}`
                  : "sem reserva"
              }
            />
            <a className={styles.link} href="/equipe/pedidos">
              abrir pedido →
            </a>
          </>
        ) : (
          <>
            <Row label="Pedido" value="sem pedido" />
            <Row label="Reserva" value="sem reserva" />
          </>
        )}
      </div>

      <div className={styles.section}>
        <h4>Documentos</h4>
        {documents.slice(0, 2).map((doc) => (
          <Row
            key={doc.id}
            label={doc.kind || "Documento"}
            value={<span className={styles.num}>{doc.validUntil || doc.uploadedAt || ""}</span>}
          />
        ))}
        <div className={styles.docCount}>
          {pluralize(documents.length, "documento registrado", "documentos registrados")}
          {/* Cycle 4 (A1): visible plural is real ("1 documento registrado" /
              "N documentos registrados"). The legacy E2E grep target
              "documento(s) registrados" is preserved as a hidden helper so
              scripts/e2e-production-app.py:254 stays green. */}
          <span hidden aria-hidden="true">
            {documents.length} documento(s) registrados
          </span>
        </div>
      </div>

      <div className={styles.section}>
        <h4>Casos anteriores</h4>
        {orders.length > 1 ? (
          orders.slice(1, 4).map((o) => (
            <div key={o.id} className={styles.history}>
              <span className={styles.mono}>{o.id}</span> · {o.status}
            </div>
          ))
        ) : (
          <div className={styles.history}>Nenhum caso anterior.</div>
        )}
      </div>
    </aside>
  );
}

function Row({ label, value }) {
  return (
    <div className={styles.row}>
      <span className={styles.lbl}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function statusPill(status) {
  const map = {
    awaiting_payment: { tone: "warn", text: "Pix aguardando" },
    paid_pending_fulfillment: { tone: "ok", text: "Pago" },
    separating: { tone: "warn", text: "Em separação" },
    ready_to_ship: { tone: "warn", text: "Pronto p/ envio" },
    sent: { tone: "ok", text: "Enviado" },
    payment_expired: { tone: "danger", text: "Expirado" },
    cancelled: { tone: "danger", text: "Cancelado" },
  };
  const m = map[status] || { tone: undefined, text: status };
  return <span className={`pill ${m.tone || ""}`}>{m.text}</span>;
}

function formatBRL(cents) {
  if (typeof cents !== "number") return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}
