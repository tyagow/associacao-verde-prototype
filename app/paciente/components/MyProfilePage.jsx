"use client";

import { useState } from "react";
import AddressFieldset from "./AddressFieldset";
import styles from "./MyProfilePage.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
});

const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

const monthYearFmt = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

function formatDate(value) {
  if (!value) return "sem data";
  try {
    return dateFmt.format(new Date(`${value}T12:00:00-03:00`));
  } catch {
    return "sem data";
  }
}

function formatDateTime(value) {
  if (!value) return "";
  try {
    return dateTimeFmt.format(new Date(value));
  } catch {
    return "";
  }
}

function formatMonthYear(value) {
  if (!value) return "—";
  try {
    return monthYearFmt.format(new Date(value)).replace(".", "");
  } catch {
    return "—";
  }
}

function relativeTime(iso) {
  if (!iso) return "";
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "";
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `há ${hr}h`;
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      timeZone: "America/Sao_Paulo",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

function maskEmail(email) {
  if (!email || typeof email !== "string" || !email.includes("@")) return email || "—";
  const [local, domain] = email.split("@");
  if (local.length <= 2) return `${local[0] || ""}•••@${domain}`;
  return `${local.slice(0, 2)}•••${local.slice(-1)}@${domain}`;
}

function maskPhone(phone) {
  if (!phone) return "—";
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length < 4) return phone;
  const tail = digits.slice(-4);
  const ddd = digits.length >= 10 ? digits.slice(0, 2) : "";
  return ddd ? `(${ddd}) ••••-${tail}` : `••••-${tail}`;
}

function monogram(name) {
  if (!name) return "AV";
  const trimmed = String(name).trim();
  if (!trimmed) return "AV";
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.[0] || "";
  const second = parts[1]?.[0] || trimmed[1] || "";
  return (first + second).toUpperCase().slice(0, 2);
}

function buildActivity(patient, orders) {
  const events = [];

  // Latest order events from real backend data
  for (const order of (orders || []).slice(0, 5)) {
    if (order.shipment?.shippedAt) {
      events.push({
        kind: "shipped",
        when: order.shipment.shippedAt,
        label: "Pedido enviado",
        meta: order.id,
      });
    }
    if (order.paidAt || order.confirmedAt) {
      events.push({
        kind: "paid",
        when: order.paidAt || order.confirmedAt,
        label: "Pagamento confirmado",
        meta: `${order.id} · ${money.format((order.totalCents || 0) / 100)}`,
      });
    }
    if (order.createdAt) {
      events.push({
        kind: "pix",
        when: order.createdAt,
        label: "Pix gerado",
        meta: `${order.id} · ${money.format((order.totalCents || 0) / 100)}`,
      });
    }
  }

  if (patient?.lastLoginAt) {
    events.push({
      kind: "login",
      when: patient.lastLoginAt,
      label: "Login realizado",
      meta: "Acesso registrado",
    });
  }

  if (patient?.privacyConsentAt) {
    events.push({
      kind: "lgpd",
      when: patient.privacyConsentAt,
      label: "LGPD aceita",
      meta: `Versão ${patient.privacyConsentVersion || "lgpd-2026-05"}`,
    });
  }

  if (patient?.prescriptionUpdatedAt) {
    events.push({
      kind: "prescription",
      when: patient.prescriptionUpdatedAt,
      label: "Receita atualizada",
      meta: `Validade até ${formatDate(patient.prescriptionExpiresAt)}`,
    });
  }

  events.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
  return events.slice(0, 6);
}

function ordersStats(orders) {
  const list = orders || [];
  const total = list.reduce((sum, o) => sum + (o.totalCents || 0), 0);
  const since = list.length
    ? list.reduce((min, o) => {
        const t = o.createdAt ? new Date(o.createdAt).getTime() : Infinity;
        return t < min ? t : min;
      }, Infinity)
    : null;
  return {
    count: list.length,
    totalCents: total,
    sinceLabel: since && since !== Infinity ? formatMonthYear(new Date(since).toISOString()) : "—",
  };
}

/**
 * Phase 8 — Meu perfil tab body.
 *
 * Reads from the same `patient` shape used elsewhere; falls back to existing
 * fields for activity (no backend endpoint for recentActivity yet).
 *
 * LGPD action buttons are wired as no-op-with-toast for now (no backend
 * endpoint exists).
 */
export default function MyProfilePage({
  patient,
  orders = [],
  onLgpdAction,
  onViewHistory,
  onProfileSaved,
  onContactEditRequest,
}) {
  const [editingAddress, setEditingAddress] = useState(false);
  const [draftAddress, setDraftAddress] = useState(null);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressError, setAddressError] = useState("");

  if (!patient) return null;
  const stats = ordersStats(orders);
  const activity = buildActivity(patient, orders);
  const handleLgpd = (kind) => {
    if (typeof onLgpdAction === "function") onLgpdAction(kind);
  };

  const REQUIRED_ADDRESS_FIELDS = [
    { key: "cep", label: "CEP" },
    { key: "street", label: "logradouro" },
    { key: "number", label: "numero" },
    { key: "neighborhood", label: "bairro" },
    { key: "city", label: "cidade" },
    { key: "state", label: "UF" },
  ];

  function openAddressEditor() {
    setDraftAddress({
      cep: "",
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
      notes: "",
      ...(patient.shippingAddress || {}),
    });
    setAddressError("");
    setEditingAddress(true);
  }

  function cancelAddressEditor() {
    setEditingAddress(false);
    setDraftAddress(null);
    setAddressError("");
    setSavingAddress(false);
  }

  async function saveAddress() {
    if (!draftAddress) return;
    const missing = REQUIRED_ADDRESS_FIELDS.find(
      (field) => !String(draftAddress[field.key] || "").trim(),
    );
    if (missing) {
      setAddressError(`Preencha ${missing.label} antes de salvar.`);
      return;
    }
    setSavingAddress(true);
    setAddressError("");
    try {
      const response = await fetch("/api/patient/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ shippingAddress: draftAddress }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || `Erro ${response.status}`);
      }
      if (typeof onProfileSaved === "function") {
        await onProfileSaved({ kind: "address", message: "Endereco atualizado." });
      }
      setEditingAddress(false);
      setDraftAddress(null);
    } catch (error) {
      setAddressError(
        error?.message
          ? `Nao foi possivel salvar: ${error.message}`
          : "Nao foi possivel salvar agora. Tente novamente em instantes.",
      );
    } finally {
      setSavingAddress(false);
    }
  }

  function requestContactEdit(kind) {
    // Email + WhatsApp are association-managed (PII change requires Suporte
    // verification). Route the patient to the Suporte tab with a pre-filled
    // subject so they don't bounce out of the portal. PatientPortal supplies
    // the callback that flips the tab + setSupportPrefill.
    if (typeof onContactEditRequest === "function") {
      onContactEditRequest(kind);
    } else {
      handleLgpd(kind === "email" ? "edit-email" : "edit-phone");
    }
  }
  return (
    <article className={styles.page} data-patient-perfil="true">
      <header className={styles.pagehead}>
        <div className={styles.avatar} aria-hidden="true">
          {monogram(patient.name)}
        </div>
        <div>
          <h1>{patient.name}</h1>
          <div className={styles.meta}>
            <code>{patient.memberCode}</code>
            <span className={styles.pillOk}>Liberada</span>
            {patient.inviteCode ? (
              <span>
                Convite <b>{patient.inviteCode}</b>
              </span>
            ) : null}
            {patient.createdAt ? (
              <>
                <span>·</span>
                <span>
                  Membro desde <b>{formatMonthYear(patient.createdAt)}</b>
                </span>
              </>
            ) : null}
          </div>
        </div>
        <div />
      </header>

      <div className={styles.body}>
        <div className={styles.col}>
          <section className={styles.card}>
            <h2 className={styles.cardHead}>Elegibilidade</h2>
            <div className={styles.row}>
              <div>
                <label>Receita médica</label>
                <b>
                  Válida até {formatDate(patient.prescriptionExpiresAt)}
                  {patient.prescribingDoctor ? ` · ${patient.prescribingDoctor}` : ""}
                  {patient.prescribingDoctorCrm ? ` · CRM ${patient.prescribingDoctorCrm}` : ""}
                </b>
              </div>
              <span className={styles.pillOk}>Vigente</span>
            </div>
            <div className={styles.row}>
              <div>
                <label>Carteirinha</label>
                <b>Válida até {formatDate(patient.cardExpiresAt)}</b>
              </div>
              <span className={styles.pillOk}>Vigente</span>
            </div>
            <div className={styles.row}>
              <div>
                <label>LGPD</label>
                <b>
                  {patient.privacyConsentAt
                    ? `Versão ${patient.privacyConsentVersion || "lgpd-2026-05"} · aceita ${formatDateTime(patient.privacyConsentAt)}`
                    : "Aceite pendente"}
                </b>
              </div>
              <span className={patient.privacyConsentAt ? styles.pillOk : styles.pillWarn}>
                {patient.privacyConsentAt ? "Aceita" : "Pendente"}
              </span>
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardHead}>
              <span>Plano de cuidado</span>
              <span className={styles.cardHeadRight}>
                <a href="#receita" onClick={(e) => e.preventDefault()}>
                  Ver receita ↗
                </a>
              </span>
            </h2>
            <div className={styles.row}>
              <div>
                <label>Médico responsável</label>
                <b>{patient.prescribingDoctor || "Aguardando informação"}</b>
              </div>
            </div>
            <div className={styles.row}>
              <div>
                <label>Diagnóstico</label>
                <b>Confidencial · CID em receita</b>
              </div>
            </div>
            <div className={styles.row}>
              <div>
                <label>Próxima reavaliação</label>
                <b>{formatDate(patient.prescriptionExpiresAt)}</b>
              </div>
              <span className={styles.pillWarn}>Lembrete em 30 dias</span>
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardHead}>Contato e entrega</h2>
            <div className={styles.row}>
              <div>
                <label>E-mail</label>
                <b>{maskEmail(patient.email)}</b>
              </div>
              <button
                type="button"
                className={styles.editBtn}
                onClick={() => requestContactEdit("email")}
                aria-label="Solicitar troca de e-mail via Suporte"
              >
                editar
              </button>
            </div>
            <div className={styles.row}>
              <div>
                <label>WhatsApp</label>
                <b>{maskPhone(patient.contactPhone)}</b>
              </div>
              <button
                type="button"
                className={styles.editBtn}
                onClick={() => requestContactEdit("phone")}
                aria-label="Solicitar troca de WhatsApp via Suporte"
              >
                editar
              </button>
            </div>
            <div className={styles.row}>
              <div>
                <label>Endereço de entrega</label>
                <b>
                  {(() => {
                    const sa = patient.shippingAddress || {};
                    const line = [
                      sa.street && sa.number ? `${sa.street}, ${sa.number}` : sa.street,
                      sa.neighborhood,
                      sa.city,
                      sa.state,
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      line ||
                      [patient.address, patient.city, patient.state].filter(Boolean).join(" · ") ||
                      "Cadastro pendente"
                    );
                  })()}
                </b>
              </div>
              <button
                type="button"
                className={styles.editBtn}
                aria-expanded={editingAddress}
                aria-controls="profile-address-editor"
                onClick={() => (editingAddress ? cancelAddressEditor() : openAddressEditor())}
              >
                {editingAddress ? "fechar" : "editar"}
              </button>
            </div>
            {editingAddress ? (
              <div
                id="profile-address-editor"
                className={styles.addressEditor}
                role="region"
                aria-label="Editar endereco de entrega"
              >
                <AddressFieldset
                  value={draftAddress || {}}
                  onChange={setDraftAddress}
                  busy={savingAddress}
                  idPrefix="profile"
                  autoFocusFirstEmpty
                />
                {addressError ? (
                  <div className={styles.addressError} role="alert" aria-live="assertive">
                    {addressError}
                  </div>
                ) : (
                  <div className={styles.addressHint} aria-live="polite">
                    Atualize seu endereco — o proximo pedido sera enviado para este local.
                  </div>
                )}
                <div className={styles.addressActions}>
                  <button
                    type="button"
                    className={styles.addressCancel}
                    onClick={cancelAddressEditor}
                    disabled={savingAddress}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className={styles.addressSave}
                    onClick={saveAddress}
                    disabled={savingAddress}
                  >
                    {savingAddress ? "Salvando..." : "Salvar endereco"}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>

        <aside className={styles.side}>
          <div className={styles.statCard}>
            <label>Pedidos no total</label>
            <div className={styles.statVal}>{stats.count} pedidos</div>
            <div className={styles.statSub}>
              {money.format(stats.totalCents / 100)} · desde {stats.sinceLabel}
              {typeof onViewHistory === "function" ? (
                <>
                  {" · "}
                  <a
                    href="#historico"
                    onClick={(e) => {
                      e.preventDefault();
                      onViewHistory();
                    }}
                  >
                    ver histórico ↗
                  </a>
                </>
              ) : null}
            </div>
          </div>

          <section className={styles.card}>
            <h2 className={styles.cardHead}>Atividade recente</h2>
            <div className={styles.timeline}>
              {activity.length === 0 ? (
                <div className={styles.ev}>
                  <div className={`${styles.dot} ${styles.dotMuted}`} aria-hidden="true" />
                  <div className={styles.evLbl}>
                    Sem atividade recente
                    <span className={styles.evMeta}>Crie seu primeiro pedido para começar</span>
                  </div>
                  <div className={styles.evWhen}>—</div>
                </div>
              ) : (
                activity.map((ev, idx) => (
                  <div key={`${ev.kind}-${ev.when}-${idx}`} className={styles.ev}>
                    <div
                      className={`${styles.dot} ${idx > 1 ? styles.dotMuted : ""}`}
                      aria-hidden="true"
                    />
                    <div className={styles.evLbl}>
                      {ev.label}
                      <span className={styles.evMeta}>{ev.meta}</span>
                    </div>
                    <div className={styles.evWhen}>{relativeTime(ev.when)}</div>
                  </div>
                ))
              )}
            </div>
          </section>

          <div className={styles.lgpd}>
            <b>Seus direitos LGPD</b>
            Apenas a equipe da associação acessa este cadastro. Cada acesso fica registrado na
            trilha de auditoria. Você pode pedir cópia ou exclusão a qualquer momento.
            <div className={styles.lgpdRow}>
              <button type="button" onClick={() => handleLgpd("download")}>
                Baixar meus dados
              </button>
              <button
                type="button"
                className={styles.lgpdDanger}
                onClick={() => handleLgpd("delete")}
              >
                Solicitar exclusão
              </button>
            </div>
          </div>
        </aside>
      </div>
    </article>
  );
}
