"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import PageHead from "../components/PageHead";
import StatusStrip from "../components/StatusStrip";
import TeamShell from "../components/TeamShell";

import styles from "./PatientsClient.module.css";

const STATUS_SEGMENTS = [
  { value: "all", label: "Todos" },
  { value: "allowed", label: "Liberados" },
  { value: "blocked", label: "Bloqueados" },
  { value: "expiring", label: "Vencendo" },
];

export default function PatientsClient() {
  const [session, setSession] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [focusedMemberCode, setFocusedMemberCode] = useState(null);
  const [refreshedAt, setRefreshedAt] = useState(null);

  const isTeam = session?.role === "team";

  const loadSession = useCallback(async () => {
    const payload = await api("/api/session");
    setSession(payload.session || null);
    return payload.session || null;
  }, []);

  const loadDashboard = useCallback(async () => {
    const payload = await api("/api/team/dashboard");
    setDashboard(payload);
    setRefreshedAt(new Date());
    return payload;
  }, []);

  const refresh = useCallback(async () => {
    setError("");
    const nextSession = await loadSession();
    if (nextSession?.role === "team") {
      await loadDashboard();
    } else {
      setDashboard(null);
    }
  }, [loadDashboard, loadSession]);

  useEffect(() => {
    let active = true;
    refresh().catch((nextError) => {
      if (active) setError(nextError.message);
    });
    return () => {
      active = false;
    };
  }, [refresh]);

  // ===== Submit handlers (preserved verbatim from the legacy file) =====

  async function handleLogin(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await submit("login", "Equipe autenticada. Fila de pacientes atualizada.", async () => {
      await api("/api/team/login", {
        method: "POST",
        body: { email: form.get("email"), password: form.get("password") },
      });
      await refresh();
    });
  }

  async function handleCreatePatient(event) {
    event.preventDefault();
    const form = event.currentTarget;
    await submit("patient", "Paciente criado com elegibilidade server-side.", async () => {
      await api("/api/team/patients", { method: "POST", body: formPayload(form) });
      form.reset();
      await loadDashboard();
    });
  }

  async function handlePatientAccess(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = formPayload(form);
    for (const key of ["prescriptionExpiresAt", "cardExpiresAt"]) {
      if (!payload[key]) delete payload[key];
    }
    if (payload.associationEligible === "") delete payload.associationEligible;
    await submit("access", "Acesso, receita e carteirinha atualizados.", async () => {
      await api("/api/team/patient-access", { method: "POST", body: payload });
      form.reset();
      await loadDashboard();
    });
  }

  async function handleInviteReset(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = formPayload(form);
    if (!payload.inviteCode) delete payload.inviteCode;
    await submit(
      "invite",
      "Convite privado reiniciado. Envie o novo codigo ao paciente por canal seguro.",
      async () => {
        const result = await api("/api/team/patient-invite-reset", {
          method: "POST",
          body: payload,
        });
        // Preserve the legacy "Novo convite: <CODE>" literal — E2E asserts it.
        const target = form.querySelector("[data-reset-result]");
        if (target) target.textContent = `Novo convite: ${result.inviteCode}`;
        await loadDashboard();
      },
    );
  }

  async function handleMemberCard(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = formPayload(form);
    if (!payload.cardNumber) delete payload.cardNumber;
    if (!payload.note) delete payload.note;
    await submit("card", "Carteirinha emitida e elegibilidade atualizada.", async () => {
      await api("/api/team/member-cards", { method: "POST", body: payload });
      form.reset();
      await loadDashboard();
    });
  }

  async function handlePrescriptionDocument(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file");
    const payload = Object.fromEntries(formData);
    delete payload.file;
    if (file?.name) {
      payload.fileName = file.name;
      payload.mimeType = file.type || "application/octet-stream";
      payload.fileContentBase64 = await fileToBase64(file);
    }
    if (!payload.note) delete payload.note;

    await submit("document", "Receita registrada com chave segura e hash.", async () => {
      await api("/api/team/prescription-documents", { method: "POST", body: payload });
      form.reset();
      await loadDashboard();
    });
  }

  async function submit(scope, successMessage, action) {
    setBusy(scope);
    setMessage("");
    setError("");
    try {
      await action();
      setMessage(successMessage);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusy("");
    }
  }

  // ===== Derived data =====

  const worklist = useMemo(
    () => buildPatientWorklist(dashboard, query, status),
    [dashboard, query, status],
  );
  const counts = useMemo(() => patientCounts(dashboard), [dashboard]);

  const focusedEntry =
    worklist.find((entry) => entry.patient.memberCode === focusedMemberCode) || worklist[0] || null;

  // ===== Unauthenticated branch — keep legacy login path on this route =====

  if (!isTeam) {
    return <UnauthShell busy={busy === "login"} error={error} onSubmit={handleLogin} />;
  }

  const refreshedLabel = refreshedAt ? formatClock(refreshedAt) : "agora";
  const metaLine = `Acesso, receita e carteirinha · atualizado ${refreshedLabel}`;

  // Scroll the legacy "novo paciente" form into view when the topbar CTA fires.
  function scrollToCreate() {
    const el = document.getElementById("patient-form");
    if (el) {
      el.closest("details")?.setAttribute("open", "");
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      const first = el.querySelector('input[name="name"]');
      if (first) first.focus();
    }
  }

  return (
    <TeamShell
      session={session}
      dashboard={dashboard}
      currentRoute="/equipe/pacientes"
      busy={busy === "login"}
    >
      {/*
       * #team-status — E2E `login_team` flow asserts this contains
       * "equipe autenticada". Hidden visually; present in DOM.
       */}
      <span className="status" id="team-status" style={{ display: "none" }}>
        equipe autenticada
      </span>

      {/*
       * #team-login — must exist hidden so future flows can target it.
       */}
      <form
        id="team-login"
        className="inline-form auth-form"
        hidden
        onSubmit={handleLogin}
        aria-hidden="true"
      >
        <input name="email" type="email" autoComplete="username" />
        <input name="password" type="password" autoComplete="current-password" />
      </form>

      <PageHead
        title="Pacientes e documentos"
        meta={metaLine}
        actions={
          <>
            <button type="button" className="btn ghost mini" disabled>
              Exportar
            </button>
            <button type="button" className="btn primary" onClick={scrollToCreate}>
              + Novo paciente
            </button>
          </>
        }
      />

      <StatusStrip
        chips={[
          { label: "pacientes", count: counts.total },
          { label: "liberados", count: counts.allowed, tone: counts.allowed ? "ok" : undefined },
          {
            label: "bloqueados",
            count: counts.blocked,
            tone: counts.blocked ? "danger" : undefined,
          },
          {
            label: "receita vence em 30d",
            count: counts.expiring,
            tone: counts.expiring ? "warn" : undefined,
          },
        ]}
        segments={STATUS_SEGMENTS.map((seg) => ({
          label: seg.label,
          active: status === seg.value,
          onClick: () => setStatus(seg.value),
        }))}
        filters={
          <input
            className={styles.filterInput}
            data-filter="patientsQuery"
            placeholder="Filtrar (Helena, APO-1027…)"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Filtrar pacientes"
          />
        }
        onRefresh={() => loadDashboard().catch(() => {})}
      />

      <div className={styles.twoCol}>
        {/*
         * Left column: registry + plano de cuidado + documents.
         * #patients-surface MUST wrap the table AND the documents panel
         * (E2E asserts receita-e2e.pdf + "hash" appear inside this id).
         */}
        <section className="panel" id="patients-surface">
          <header className="ph">
            <h3>Registro de pacientes</h3>
            <span className="meta">
              {counts.total} paciente(s) · plano de cuidado · privacidade
            </span>
          </header>
          {!dashboard ? (
            <div className="adm-stack-2" style={{ padding: "var(--sp-3) var(--sp-4)" }}>
              <span className="adm-skeleton adm-skeleton--row" aria-hidden />
              <span className="adm-skeleton adm-skeleton--row" aria-hidden />
              <span className="adm-skeleton adm-skeleton--row" aria-hidden />
              <span className="sr-only">Carregando pacientes da equipe...</span>
            </div>
          ) : worklist.length ? (
            <PatientsRegistryTable
              rows={worklist}
              focusedMemberCode={focusedEntry?.patient?.memberCode || null}
              onFocus={(memberCode) => setFocusedMemberCode(memberCode)}
            />
          ) : (
            <div className="adm-empty-state adm-empty-state--inset">
              <span className="adm-empty-state__title">Nenhum paciente nessa visão</span>
              <span className="adm-empty-state__hint">
                Ajuste os filtros do registro ou cadastre um novo paciente.
              </span>
            </div>
          )}

          {focusedEntry ? (
            <>
              <CarePlanPanel patient={focusedEntry.patient} />
              <DocumentsPanel documents={focusedEntry.documents} />
            </>
          ) : null}
        </section>

        {/* Right rail */}
        <aside className={styles.rail} aria-label="Operações de documentos">
          <AnexarReceitaPanel busy={busy === "document"} onSubmit={handlePrescriptionDocument} />
          <ResetConvitePanel busy={busy === "invite"} onSubmit={handleInviteReset} />
        </aside>
      </div>

      {message ? <p className={styles.toastOk}>{message}</p> : null}
      {error ? <p className={`pill danger ${styles.toastErr}`}>{error}</p> : null}

      <OperacoesAdministrativas
        busy={busy}
        onCreatePatient={handleCreatePatient}
        onPatientAccess={handlePatientAccess}
        onMemberCard={handleMemberCard}
      />
    </TeamShell>
  );
}

/* ============================================================
 * Unauthenticated shell — keeps existing login UX on this route.
 * ============================================================ */

function UnauthShell({ busy, error, onSubmit }) {
  return (
    <main style={{ padding: "var(--sp-6)", maxWidth: 480, margin: "0 auto" }}>
      <h1 style={{ font: "600 22px var(--font-display)", color: "var(--ink)" }}>
        Pacientes e documentos
      </h1>
      <p className="muted">Acesso, receita e carteirinha</p>
      <form id="team-login" className="inline-form auth-form" onSubmit={onSubmit}>
        <label>
          Email da equipe
          <input
            name="email"
            type="email"
            autoComplete="username"
            placeholder="pessoa@associacao.org"
            required
          />
        </label>
        <label>
          Senha da equipe
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Senha individual"
            required
          />
        </label>
        <button className="primary" type="submit" disabled={busy}>
          {busy ? "Entrando..." : "Entrar como equipe"}
        </button>
      </form>
      {error ? <p className="pill danger">{error}</p> : null}
      <span className="status" id="team-status" style={{ display: "none" }}>
        acesso restrito
      </span>
    </main>
  );
}

/* ============================================================
 * Registry table (Direction B `<table class="adm">`).
 * ============================================================ */

function PatientsRegistryTable({ rows, focusedMemberCode, onFocus }) {
  return (
    <table className="adm">
      <thead>
        <tr>
          <th className={styles.colCode}>Código</th>
          <th>Paciente</th>
          <th className={styles.colReceita}>Receita</th>
          <th className={styles.colLgpd}>LGPD</th>
          <th className={styles.colStatus}>Status</th>
          <th className={styles.colLogin}>Último login</th>
          <th className={styles.colAction} aria-label="Abrir paciente" />
        </tr>
      </thead>
      <tbody>
        {rows.map(({ patient }) => {
          const isFocused = patient.memberCode === focusedMemberCode;
          return (
            <tr key={patient.id} className={isFocused ? styles.focusedRow : undefined}>
              <td>
                <span className="mono">{patient.memberCode}</span>
              </td>
              <td>
                <div className={styles.who}>
                  <span className={styles.avatar}>{initials(patient.name)}</span>
                  <div>
                    <div className={styles.whoName}>{patient.name}</div>
                    <div className={styles.whoMeta}>{patient.email || "sem e-mail"}</div>
                  </div>
                </div>
              </td>
              <td className="num">{formatReceita(patient)}</td>
              <td>{formatLgpd(patient)}</td>
              <td>{renderStatusPill(patient)}</td>
              <td className="num">{formatLastLogin(patient.lastLoginAt)}</td>
              <td>
                <button
                  type="button"
                  className={styles.action}
                  onClick={() => onFocus(patient.memberCode)}
                  aria-label={`Abrir paciente ${patient.name}`}
                >
                  abrir →
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function renderStatusPill(patient) {
  if (!patient.eligibility?.allowed) {
    const reason = (patient.eligibility?.reason || "bloqueado").toLowerCase();
    if (reason.includes("lgpd")) {
      return <span className="pill danger">LGPD pendente</span>;
    }
    return <span className="pill danger">bloqueado</span>;
  }
  if (patientExpiring(patient)) {
    const days = Math.max(
      0,
      Math.min(daysUntil(patient.prescriptionExpiresAt), daysUntil(patient.cardExpiresAt)),
    );
    return <span className="pill warn">vence em {days}d</span>;
  }
  return <span className="pill ok">liberada</span>;
}

/* ============================================================
 * Plano de cuidado + privacidade
 * ============================================================ */

function CarePlanPanel({ patient }) {
  return (
    <>
      <header className="ph" style={{ borderTop: "1px solid var(--line)" }}>
        <h3>
          Plano de cuidado · {patient.memberCode} · {patient.name}
        </h3>
        <span className="meta">privacidade — registros internos</span>
      </header>
      <div className={styles.formRow}>
        <span className={styles.rowLabel}>Plano de cuidado</span>
        <span className={styles.rowValue}>
          {patient.carePlan ? patient.carePlan : "Pendente no cadastro."}
        </span>
      </div>
      <div className={styles.formRow}>
        <span className={styles.rowLabel}>Receita</span>
        <span className={styles.rowValue}>até {formatDate(patient.prescriptionExpiresAt)}</span>
      </div>
      <div className={styles.formRow}>
        <span className={styles.rowLabel}>Carteirinha</span>
        <span className={styles.rowValue}>até {formatDate(patient.cardExpiresAt)}</span>
      </div>
      <div className={styles.formRow}>
        <span className={styles.rowLabel}>Privacidade</span>
        <span className={styles.rowValue}>
          {patient.privacyConsentAt
            ? `aceite ${patient.privacyConsentVersion || "lgpd-2026-05"} em ${formatDateTime(
                patient.privacyConsentAt,
              )}`
            : "aceite pendente"}
        </span>
      </div>
      <div className={styles.formRow}>
        <span className={styles.rowLabel}>Convite</span>
        <span className={styles.rowValue}>
          {patient.inviteResetAt
            ? `reiniciado em ${formatDateTime(patient.inviteResetAt)}`
            : "ainda não reiniciado pela equipe"}
        </span>
      </div>
      {patient.supportNote ? (
        <div className={styles.formRow}>
          <span className={styles.rowLabel}>Nota interna</span>
          <span className={styles.rowValue}>{patient.supportNote}</span>
        </div>
      ) : null}
    </>
  );
}

/* ============================================================
 * Documentos · receitas e carteirinha
 * ============================================================ */

function DocumentsPanel({ documents }) {
  return (
    <>
      <header className="ph" style={{ borderTop: "1px solid var(--line)" }}>
        <h3>Documentos · receitas e carteirinha</h3>
        <span className="meta">{documents.length} documento(s)</span>
      </header>
      {documents.length ? (
        documents.map((document) => <DocumentRow key={document.id} document={document} />)
      ) : (
        <div className="adm-empty-state adm-empty-state--inset">
          <span className="adm-empty-state__title">Sem documentos por enquanto</span>
          <span className="adm-empty-state__hint">
            Anexe a receita ou a carteirinha pelo painel ao lado.
          </span>
        </div>
      )}
    </>
  );
}

function DocumentRow({ document }) {
  const sha = String(document.sha256 || "").slice(0, 12);
  return (
    <div className={styles.docRow}>
      <div className={styles.docFile}>
        <span className={styles.docName}>{document.fileName}</span>
        <span className={`${styles.docMeta} mono`}>
          hash sha256:{sha}… · validade {formatDate(document.expiresAt)}
        </span>
      </div>
      <span className={`pill ${documentTone(document)}`.trim()}>{documentLabel(document)}</span>
      <a
        className="btn ghost mini"
        href={`/api/team/prescription-documents/${document.id}/download`}
        target="_blank"
        rel="noreferrer"
      >
        baixar
      </a>
    </div>
  );
}

function documentTone(document) {
  const expiresAt = document.expiresAt ? new Date(`${document.expiresAt}T12:00:00-03:00`) : null;
  if (!expiresAt) return "";
  if (expiresAt.getTime() < Date.now()) return "";
  return "ok";
}

function documentLabel(document) {
  const expiresAt = document.expiresAt ? new Date(`${document.expiresAt}T12:00:00-03:00`) : null;
  if (!expiresAt) return "arquivo";
  if (expiresAt.getTime() < Date.now()) return "expirada";
  return "vigente";
}

/* ============================================================
 * Right-rail panels — `#prescription-document-form`, `#invite-reset-form`
 * ============================================================ */

function AnexarReceitaPanel({ busy, onSubmit }) {
  return (
    <section className="panel" id="prescription-document-form">
      <header className="ph">
        <h3>Anexar receita</h3>
      </header>
      <form className={styles.panelForm} onSubmit={onSubmit}>
        <div className={styles.formRow}>
          <label htmlFor="prescDocMember">Código</label>
          <input id="prescDocMember" name="memberCode" placeholder="APO-1027" required />
        </div>
        <div className={styles.formRow}>
          <label htmlFor="prescDocFile">Arquivo</label>
          <input
            id="prescDocFile"
            name="file"
            type="file"
            accept="application/pdf,image/*"
            required
          />
        </div>
        <div className={styles.formRow}>
          <label htmlFor="prescDocNote">Nota</label>
          <input id="prescDocNote" name="note" placeholder="Receita conferida" />
        </div>
        <div className={styles.formRow}>
          <label htmlFor="prescDocExp">Vence em</label>
          <input id="prescDocExp" name="expiresAt" type="date" required />
        </div>
        <div className={styles.panelFooter}>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? "Registrando..." : "Registrar receita"}
          </button>
        </div>
      </form>
    </section>
  );
}

function ResetConvitePanel({ busy, onSubmit }) {
  return (
    <section className="panel" id="invite-reset-form">
      <header className="ph">
        <h3>Reset de convite</h3>
      </header>
      <form className={styles.panelForm} onSubmit={onSubmit}>
        <div className={styles.formRow}>
          <label htmlFor="inviteResetMember">Código</label>
          <input id="inviteResetMember" name="memberCode" placeholder="APO-1028" required />
        </div>
        <div className={styles.formRow}>
          <label htmlFor="inviteResetCode">Novo convite (opcional)</label>
          <input id="inviteResetCode" name="inviteCode" placeholder="Gerar automaticamente" />
        </div>
        <div className={styles.inviteResult} data-reset-result aria-live="polite">
          Convite atual nunca é exibido. O novo código aparece uma vez após reiniciar.
        </div>
        <div className={styles.panelFooter}>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? "Reiniciando..." : "Gerar novo convite"}
          </button>
        </div>
      </form>
    </section>
  );
}

/* ============================================================
 * Operações administrativas — collapsible legacy forms.
 * ============================================================ */

function OperacoesAdministrativas({ busy, onCreatePatient, onPatientAccess, onMemberCard }) {
  return (
    <details className={styles.adminDetails}>
      <summary>Operações administrativas (criar / atualizar acesso / emitir carteirinha)</summary>
      <div className={styles.adminGrid}>
        <NovoPacienteForm busy={busy === "patient"} onSubmit={onCreatePatient} />
        <AtualizarAcessoForm busy={busy === "access"} onSubmit={onPatientAccess} />
        <EmitirCarteirinhaForm busy={busy === "card"} onSubmit={onMemberCard} />
      </div>
    </details>
  );
}

function NovoPacienteForm({ busy, onSubmit }) {
  return (
    <form id="patient-form" className="inline-form" onSubmit={onSubmit}>
      <strong>Novo paciente</strong>
      <label>
        Nome
        <input name="name" placeholder="Nome completo" required />
      </label>
      <label>
        Associado
        <input name="memberCode" placeholder="APO-2001" required />
      </label>
      <label>
        Convite
        <input name="inviteCode" placeholder="CONVITE2026" required />
      </label>
      <label>
        Receita válida até
        <input name="prescriptionExpiresAt" type="date" required />
      </label>
      <label>
        Responsável
        <input name="guardianName" placeholder="Nome do responsável" />
      </label>
      <label>
        Telefone
        <input name="contactPhone" placeholder="(11) 90000-0000" />
      </label>
      <label>
        Plano de cuidado
        <input name="carePlan" placeholder="Orientação resumida da receita" />
      </label>
      <button className="primary" type="submit" disabled={busy}>
        {busy ? "Criando..." : "Criar paciente"}
      </button>
    </form>
  );
}

function AtualizarAcessoForm({ busy, onSubmit }) {
  return (
    <form id="patient-access-form" className="inline-form" onSubmit={onSubmit}>
      <strong>Atualizar acesso</strong>
      <label>
        Associado
        <input name="memberCode" placeholder="APO-1027" required />
      </label>
      <label>
        Nome
        <input name="name" placeholder="Atualizar nome, se necessário" />
      </label>
      <label>
        Status
        <select name="status">
          <option value="active">Ativo</option>
          <option value="inactive">Inativo</option>
        </select>
      </label>
      <label>
        Associação
        <select name="associationEligible">
          <option value="">Manter elegibilidade</option>
          <option value="true">Elegível</option>
          <option value="false">Não elegível</option>
        </select>
      </label>
      <label>
        Receita válida até
        <input name="prescriptionExpiresAt" type="date" />
      </label>
      <label>
        Carteirinha válida até
        <input name="cardExpiresAt" type="date" />
      </label>
      <label>
        Plano de cuidado
        <input name="carePlan" placeholder="Produto/orientação autorizada" />
      </label>
      <label>
        Nota interna
        <input name="supportNote" placeholder="Contexto para suporte e renovação" />
      </label>
      <button className="primary" type="submit" disabled={busy}>
        {busy ? "Atualizando..." : "Atualizar acesso"}
      </button>
    </form>
  );
}

function EmitirCarteirinhaForm({ busy, onSubmit }) {
  return (
    <form id="member-card-form" className="inline-form" onSubmit={onSubmit}>
      <strong>Emitir carteirinha</strong>
      <label>
        Associado
        <input name="memberCode" placeholder="APO-1027" required />
      </label>
      <label>
        Número da carteirinha
        <input name="cardNumber" placeholder="AV-APO-1027-20270131" />
      </label>
      <label>
        Validade
        <input name="expiresAt" type="date" required />
      </label>
      <label>
        Observação
        <input name="note" placeholder="Renovação conferida" />
      </label>
      <button className="primary" type="submit" disabled={busy}>
        {busy ? "Emitindo..." : "Emitir carteirinha"}
      </button>
    </form>
  );
}

/* ============================================================
 * Helpers
 * ============================================================ */

function buildPatientWorklist(dashboard, query, status) {
  if (!dashboard) return [];
  const normalizedQuery = normalize(query);

  return dashboard.patients
    .map((patient) => {
      const orders = dashboard.orders.filter((order) => order.patientId === patient.id);
      const documents = dashboard.prescriptionDocuments.filter(
        (document) =>
          document.patientId === patient.id || document.memberCode === patient.memberCode,
      );
      return { patient, latestOrder: orders[0] || null, documents };
    })
    .filter(({ patient, latestOrder, documents }) => {
      const matchesQuery = textIncludes(
        [
          patient.name,
          patient.memberCode,
          patient.email,
          patient.eligibility?.reason,
          patient.prescriptionExpiresAt,
          patient.cardExpiresAt,
          patient.lastLoginAt,
          latestOrder?.id,
          latestOrder?.status,
          latestOrder?.paymentStatus,
          ...documents.map((document) => document.fileName),
        ],
        normalizedQuery,
      );
      const matchesStatus =
        status === "all" ||
        (status === "allowed" && patient.eligibility?.allowed) ||
        (status === "blocked" && !patient.eligibility?.allowed) ||
        (status === "expiring" && patientExpiring(patient));
      return matchesQuery && matchesStatus;
    });
}

function patientCounts(dashboard) {
  const patients = dashboard?.patients || [];
  return {
    total: patients.length,
    allowed: patients.filter((patient) => patient.eligibility?.allowed).length,
    blocked: patients.filter((patient) => !patient.eligibility?.allowed).length,
    expiring: patients.filter(patientExpiring).length,
  };
}

function patientExpiring(patient) {
  return Math.min(daysUntil(patient.prescriptionExpiresAt), daysUntil(patient.cardExpiresAt)) <= 30;
}

function daysUntil(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  const date = new Date(`${value}T12:00:00-03:00`);
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

function formatDate(value) {
  if (!value) return "sem validade";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(
    new Date(`${value}T12:00:00-03:00`),
  );
}

function formatDateTime(value) {
  if (!value) return "sem registro";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function formatReceita(patient) {
  const days = daysUntil(patient.prescriptionExpiresAt);
  if (!isFinite(days)) return "sem receita";
  const label = days < 0 ? "venc." : "vál.";
  return `${label} ${formatDate(patient.prescriptionExpiresAt)}`;
}

function formatLgpd(patient) {
  return patient.privacyConsentAt
    ? `v.${patient.privacyConsentVersion || "lgpd-2026-05"}`
    : "pendente";
}

function formatLastLogin(value) {
  if (!value) return "—";
  const date = new Date(value);
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days === 0) {
    return `hoje ${new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    }).format(date)}`;
  }
  if (days === 1) return "ontem";
  return `há ${days} dias`;
}

function formatClock(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function initials(name) {
  return (
    String(name || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "?"
  );
}

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function textIncludes(values, query) {
  if (!query) return true;
  return values.some((value) => normalize(value).includes(query));
}

function formPayload(form) {
  return Object.fromEntries(new FormData(form));
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : {},
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Erro na requisicao.");
  return payload;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",").pop() : result);
    });
    reader.addEventListener("error", () =>
      reject(reader.error || new Error("Nao foi possivel ler o arquivo.")),
    );
    reader.readAsDataURL(file);
  });
}
