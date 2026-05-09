/* Shared mapping from raw audit action enum -> human-readable label + tone.
   Used by both the live ActivityFeed (/equipe) and the AuditTimeline
   compliance surface (/admin). Keep both consumers in sync — adding a new
   audit action means adding it here once. */

export const ACTION_COPY = {
  team_login: { label: "Login da equipe", tone: "" },
  patient_login: { label: "Login do paciente", tone: "" },
  team_user_bootstrapped: { label: "Usuario da equipe criado (bootstrap)", tone: "" },
  team_user_created: { label: "Usuario da equipe criado", tone: "" },
  team_user_status_updated: { label: "Status de usuario atualizado", tone: "" },
  team_user_password_reset: { label: "Senha redefinida pelo admin", tone: "warn" },
  team_user_password_changed: { label: "Senha individual atualizada", tone: "" },
  patient_concurrent_checkout_blocked: {
    label: "Checkout concorrente bloqueado",
    tone: "warn",
  },
  paid_after_expiry_conflict: { label: "Pix pago apos expiracao", tone: "danger" },
  checkout_created: { label: "Checkout criado", tone: "" },
  payment_confirmed: { label: "Pix confirmado", tone: "" },
  payment_reconciled: { label: "Pix conciliado", tone: "" },
  payment_reconciliation_exception: { label: "Excecao de conciliacao Pix", tone: "warn" },
  support_request_created: { label: "Suporte aberto", tone: "warn" },
  support_request_updated: { label: "Suporte atualizado", tone: "" },
  patient_access_recovery_requested: {
    label: "Recuperacao de acesso solicitada",
    tone: "warn",
  },
  patient_access_updated: { label: "Acesso do paciente atualizado", tone: "" },
  patient_invite_reset: { label: "Convite do paciente reemitido", tone: "" },
  patient_created: { label: "Paciente criado", tone: "" },
  stock_added: { label: "Estoque registrado", tone: "" },
  cultivation_batch_created: { label: "Lote de cultivo criado", tone: "" },
  cultivation_batch_advanced: { label: "Lote avancou semana", tone: "" },
  cultivation_harvest_recorded: { label: "Colheita registrada", tone: "" },
  cultivation_dry_weight_recorded: { label: "Secagem registrada", tone: "" },
  cultivation_batch_stocked: { label: "Lote estocado", tone: "" },
  member_card_issued: { label: "Carteirinha emitida", tone: "" },
  privacy_consent_accepted: { label: "Consentimento aceito", tone: "" },
  provider_approval_evidence_recorded: {
    label: "Aceite do provider registrado",
    tone: "",
  },
  backup_schedule_evidence_recorded: { label: "Backup offsite registrado", tone: "" },
};

export function describeAction(action) {
  return ACTION_COPY[action] || { label: action || "evento", tone: "" };
}

/* Curated per-action preview line for the AuditTimeline meta row.
   Picks 2-4 human-relevant fields from event.details and labels them
   instead of dumping JSON.stringify slices. */
export function previewDetailsForAction(action, details) {
  if (!details || typeof details !== "object") return "";
  const d = details;
  const parts = [];

  function push(label, value) {
    if (value === undefined || value === null || value === "") return;
    parts.push(`${label} ${value}`);
  }

  // Common identifiers (in priority order).
  if (d.orderId) push("pedido", String(d.orderId));
  if (d.paymentId) push("pagamento", String(d.paymentId));
  if (d.memberCode) push("carteirinha", String(d.memberCode));
  if (d.patientId) push("paciente", String(d.patientId));
  if (d.batchId) push("lote", String(d.batchId));
  if (d.productId) push("produto", String(d.productId));
  if (d.ticketId) push("suporte", String(d.ticketId));

  // Network / actor metadata.
  if (typeof d.ip === "string") push("ip", d.ip);
  else if (d.ip && typeof d.ip === "object") {
    const v4 = d.ip.v4 || d.ip.address;
    if (v4) push("ip", String(v4));
  }
  if (d.via) push("via", String(d.via));
  if (d.userAgent && typeof d.userAgent === "string") {
    push("ua", d.userAgent.length > 24 ? `${d.userAgent.slice(0, 24)}…` : d.userAgent);
  }

  // Status / reason.
  if (d.status) push("status", String(d.status));
  if (d.reason) push("motivo", String(d.reason));

  return parts.slice(0, 4).join(" · ");
}
