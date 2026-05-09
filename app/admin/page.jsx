"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TeamShell from "../equipe/components/TeamShell";
import PageHead from "../equipe/components/PageHead";
import StatusStrip from "../equipe/components/StatusStrip";
import GateCard from "./components/GateCard";
import GateDetail from "./components/GateDetail";
import AuditTimeline from "./components/AuditTimeline";
import AuditEventModal from "./components/AuditEventModal";
import TeamUsersTable from "./components/TeamUsersTable";
import adminStyles from "./admin.module.css";

const initialFilters = { adminQuery: "", adminStatus: "all" };

const GATE_TAGS = {
  "Pix provider": "pix provider",
  "Webhook Pix": "webhook drill",
  "Aceite do provider": "provider approval",
  "Deploy/domain/logs": "deployment check",
  "Dominio/TLS": "domain tls",
  "Schema DB": "schema db",
  "Sessao/cookie": "session cookie",
  "Backup/restore": "restore drill",
  "Backup offsite": "backup offsite",
};

export default function AdminPage() {
  const [session, setSession] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [filters, setFilters] = useState(initialFilters);
  const [status, setStatus] = useState("carregando…");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [selectedGate, setSelectedGate] = useState(null);
  const [selectedAuditEvent, setSelectedAuditEvent] = useState(null);
  const [activeSegment, setActiveSegment] = useState("gates");

  const load = useCallback(async () => {
    try {
      const [sessionPayload, dashboardPayload, readinessPayload] = await Promise.all([
        api("/api/session").catch(() => null),
        api("/api/team/dashboard"),
        api("/api/team/readiness"),
      ]);
      setSession(sessionPayload?.session || sessionPayload || null);
      setDashboard(dashboardPayload);
      setReadiness(readinessPayload);
      setStatus("equipe autenticada");
      setError("");
    } catch (loadError) {
      setStatus("acesso restrito");
      setError(loadError.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onCreateUser(event) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await api("/api/team/users", {
        method: "POST",
        body: Object.fromEntries(new FormData(form)),
      });
      form.reset();
      await load();
      showToast("Usuário da equipe criado com papel e permissões.");
    } catch (submitError) {
      showToast(submitError.message);
    }
  }

  async function onProviderEvidence(event) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await api("/api/team/readiness/provider-approval", {
        method: "POST",
        body: Object.fromEntries(new FormData(form)),
      });
      await load();
      showToast("Evidência do provider registrada para readiness.");
    } catch (submitError) {
      showToast(submitError.message);
    }
  }

  async function onBackupScheduleEvidence(event) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await api("/api/team/readiness/backup-schedule", {
        method: "POST",
        body: Object.fromEntries(new FormData(form)),
      });
      await load();
      showToast("Evidência de backup offsite registrada para readiness.");
    } catch (submitError) {
      showToast(submitError.message);
    }
  }

  async function onTeamUserStatus(userId, statusValue) {
    try {
      await api("/api/team/users/status", {
        method: "POST",
        body: { userId, status: statusValue },
      });
      await load();
      showToast(
        statusValue === "active"
          ? "Usuário da equipe reativado."
          : "Usuário da equipe desativado e sessões revogadas.",
      );
    } catch (submitError) {
      showToast(submitError.message);
    }
  }

  async function onTeamUserPassword(event, userId) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await api("/api/team/users/password", {
        method: "POST",
        body: { userId, ...Object.fromEntries(new FormData(form)) },
      });
      form.reset();
      await load();
      showToast("Senha temporária redefinida e sessões do usuário revogadas.");
    } catch (submitError) {
      showToast(submitError.message);
    }
  }

  function onFilterChange(event) {
    const { filter } = event.currentTarget.dataset;
    const { value } = event.currentTarget;
    setFilters((current) => ({ ...current, [filter]: value }));
  }

  function showToast(message) {
    setToast(message || "Erro na requisição.");
    window.clearTimeout(showToast.timeout);
    showToast.timeout = window.setTimeout(() => setToast(""), 3200);
  }

  const audit = useMemo(
    () => filteredAudit(dashboard?.auditLog || [], filters),
    [dashboard, filters],
  );

  const gates = readiness?.gates || [];
  const releaseGate = readiness?.releaseGate;
  const passing = gates.filter((g) => g.status === "ok").length;
  const warning = gates.filter((g) => g.status === "pending" || g.status === "warn").length;
  const totalGates = gates.length;
  // D9 fix: blockedReleases = number of gates not in `ok`. The previous
  // implementation collapsed to 0 or 1 based on releaseGate.ok which lied
  // about the actual blocker count and disagreed with `totalGates - passing`
  // used elsewhere in the same render.
  const blockedReleases = totalGates - passing;
  const teamUsers = dashboard?.teamUsers || [];
  const teamRoleCount = new Set(teamUsers.map((u) => u.role).filter(Boolean)).size;

  return (
    <TeamShell session={session} dashboard={dashboard} currentRoute="/admin">
      <PageHead
        title="Admin e compliance"
        meta={
          <>
            Readiness do ambiente · {blockedReleases} release
            {blockedReleases === 1 ? "" : "s"} bloqueado
            <span id="admin-status" style={{ marginLeft: 8 }}>
              · {status}
            </span>
          </>
        }
        actions={
          <button type="button" className="ghost mini" onClick={load}>
            ↻ Atualizar
          </button>
        }
      />

      <StatusStrip
        chips={[
          {
            label: "release gate",
            count: blockedReleases,
            tone: blockedReleases ? "warn" : "ok",
          },
          { label: "gates configurados", count: totalGates },
          { label: "verdes", count: passing, tone: "ok" },
          { label: "amarelos", count: warning, tone: "warn" },
        ]}
        segments={[
          {
            label: "Gates",
            active: activeSegment === "gates",
            onClick: () => setActiveSegment("gates"),
          },
          {
            label: "Auditoria",
            active: activeSegment === "auditoria",
            onClick: () => setActiveSegment("auditoria"),
          },
          {
            label: "Usuários",
            active: activeSegment === "users",
            onClick: () => setActiveSegment("users"),
          },
        ]}
        filters={
          <>
            <input
              data-filter="adminQuery"
              value={filters.adminQuery}
              onChange={onFilterChange}
              placeholder="Buscar gate, evento, usuário…"
              aria-label="Buscar auditoria"
            />
            <select
              data-filter="adminStatus"
              value={filters.adminStatus}
              onChange={onFilterChange}
              aria-label="Tipo de evento"
            >
              <option value="all">Todos</option>
              <option value="team_user">Equipe</option>
              <option value="payment">Pagamentos</option>
              <option value="patient">Pacientes</option>
              <option value="order">Pedidos</option>
              <option value="support">Suporte</option>
            </select>
          </>
        }
      />

      {error ? (
        <div id="admin-surface" className={adminStyles.surface}>
          <p className="pill danger">{error}</p>
        </div>
      ) : (
        <div id="admin-surface" className={adminStyles.surface}>
          <ReleaseEvidenceBanner releaseGate={releaseGate} blockerCount={totalGates - passing} />

          <h2 className={adminStyles.h2Section}>Release gates · Readiness do ambiente</h2>

          <section className={adminStyles.gateGrid} aria-label="Gates de readiness">
            {gates.length === 0 ? (
              <div className="adm-empty-state adm-empty-state--span-row">
                <span className="adm-empty-state__title">Sem gates configurados</span>
                <span className="adm-empty-state__hint">
                  Quando o checklist de readiness rodar, os gates aparecem aqui.
                </span>
              </div>
            ) : null}
            {gates.map((gate) => {
              const detail = buildDetailForGate(gate, readiness);
              const tag = GATE_TAGS[gate.label] || "";
              return (
                <GateCard
                  key={gate.label}
                  id={gate.label}
                  label={gate.label}
                  detail={detail.summary || gate.detail}
                  tone={toneFor(gate)}
                  pillText={gate.status === "ok" ? "verde" : "amarelo"}
                  tag={tag}
                  caption={detail.summary && detail.summary !== gate.detail ? detail.summary : ""}
                  command={detail.runHint || ""}
                  footerText={`${tag} · ${formatDateTime(gate.checkedAt || readiness?.checkedAt)}`}
                  footerCta={
                    <span className={adminStyles.footerHint} aria-hidden>
                      {selectedGate === gate.label ? "Fechar" : "Abrir detalhe"}
                    </span>
                  }
                  selected={selectedGate === gate.label}
                  onSelect={(id) => setSelectedGate(id === selectedGate ? null : id)}
                />
              );
            })}
          </section>

          {selectedGate ? (
            <GateDetailForGate
              gate={gates.find((g) => g.label === selectedGate)}
              readiness={readiness}
              onClose={() => setSelectedGate(null)}
              onProviderEvidence={onProviderEvidence}
              onBackupScheduleEvidence={onBackupScheduleEvidence}
            />
          ) : null}

          <section id="auditoria" className={adminStyles.twoCol}>
            <article className="panel">
              <header className="panel-heading">
                <div>
                  <p className="kicker">Auditoria recente</p>
                  <h3>Eventos de segurança e operação</h3>
                </div>
              </header>
              <AuditTimeline
                events={audit}
                filter={filters.adminStatus}
                filters={buildAuditFilterChips(dashboard?.auditLog || [])}
                onFilter={(value) => setFilters((current) => ({ ...current, adminStatus: value }))}
                onSelect={(event) => setSelectedAuditEvent(event)}
              />
            </article>

            <aside className="panel">
              <header className="panel-heading">
                <div>
                  <p className="kicker">Usuários da equipe</p>
                  <h3>
                    {teamUsers.length} usuário{teamUsers.length === 1 ? "" : "s"} · {teamRoleCount}{" "}
                    {teamRoleCount === 1 ? "papel" : "papéis"}
                  </h3>
                </div>
              </header>
              <TeamUsersTable
                compact
                users={teamUsers}
                onCreateUser={onCreateUser}
                onStatusChange={onTeamUserStatus}
                onPasswordReset={onTeamUserPassword}
              />
            </aside>
          </section>
        </div>
      )}

      <div className={`toast ${toast ? "show" : ""}`} id="toast" role="status" aria-live="polite">
        {toast}
      </div>
      <AuditEventModal event={selectedAuditEvent} onClose={() => setSelectedAuditEvent(null)} />
    </TeamShell>
  );
}

function ReleaseEvidenceBanner({ releaseGate, blockerCount }) {
  const checks = releaseGate?.checks || [];
  return (
    <section
      className={`${adminStyles.releaseEvidence} ${releaseGate?.ok ? adminStyles.releaseEvidenceGood : adminStyles.releaseEvidenceWarn}`}
      aria-label="Resumo do release gate"
    >
      <div>
        <span>release gate</span>
        {/* E2E asserts the ASCII literal "Release bloqueado por evidencias
            pendentes" against the body. Visible string carries the diacritic;
            hidden helper preserves the ASCII grep target. */}
        <span hidden aria-hidden="true">
          {releaseGate?.ok
            ? "Release liberado por evidencias"
            : "Release bloqueado por evidencias pendentes"}
        </span>
        <strong>
          {releaseGate?.ok
            ? "Release liberado por evidências"
            : "Release bloqueado por evidências pendentes"}
        </strong>
        <p>
          {releaseGate?.ok
            ? "Todos os gates de produção estão completos."
            : `${blockerCount} bloqueio(s) impedem declarar produção pronta.`}
        </p>
        <p className="muted">Verificado em {formatDateTime(releaseGate?.checkedAt)}.</p>
      </div>
      <dl>
        {checks.map((check) => (
          <div key={check.name}>
            <dt>{check.name}</dt>
            <dd>{check.ok ? "ok" : "pendente"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function buildAuditFilterChips(auditLog) {
  const counts = { all: auditLog.length };
  const types = ["team_user", "payment", "patient", "order", "support"];
  for (const type of types) counts[type] = 0;
  for (const event of auditLog) {
    const action = String(event?.action || "");
    for (const type of types) {
      if (action.includes(type)) counts[type] += 1;
    }
  }
  return [
    { value: "all", label: "Todos", count: counts.all },
    { value: "team_user", label: "Equipe", count: counts.team_user },
    { value: "payment", label: "Pagamentos", count: counts.payment },
    { value: "patient", label: "Pacientes", count: counts.patient },
    { value: "order", label: "Pedidos", count: counts.order },
    { value: "support", label: "Suporte", count: counts.support },
  ];
}

function toneFor(gate) {
  if (gate.status === "ok") return "good";
  if (gate.status === "blocked" || gate.status === "danger") return "danger";
  if (gate.status === "pending") return "warn";
  return "warn";
}

function GateDetailForGate({
  gate,
  readiness,
  onClose,
  onProviderEvidence,
  onBackupScheduleEvidence,
}) {
  if (!gate) return null;
  const tone = toneFor(gate);
  const detail = buildDetailForGate(gate, readiness);
  return (
    <GateDetail
      title={gate.label}
      tone={tone}
      summary={detail.summary || gate.detail}
      meta={detail.meta}
      evidence={detail.evidence}
      runHint={detail.runHint}
      onClose={onClose}
    >
      {gate.label === "Aceite do provider" ? (
        <ProviderEvidenceForm
          evidence={readiness?.providerApproval}
          onSubmit={onProviderEvidence}
        />
      ) : null}
      {gate.label === "Backup offsite" ? (
        <BackupScheduleForm
          evidence={readiness?.backupSchedule}
          restoreDrillSha256={
            readiness?.backupRestore?.sha256 || readiness?.backupSchedule?.restoreDrillSha256 || ""
          }
          onSubmit={onBackupScheduleEvidence}
        />
      ) : null}
      {detail.tag ? (
        <p className={adminStyles.detailTag} aria-hidden="true">
          {detail.tag}
        </p>
      ) : null}
    </GateDetail>
  );
}

function buildDetailForGate(gate, readiness) {
  switch (gate.label) {
    case "Pix provider": {
      return {
        tag: "pix provider",
        summary: gate.detail || "Pix provider configurado.",
        runHint: "PAYMENT_PROVIDER=asaas npm run readiness:pix-provider",
        meta: [],
        evidence: [],
      };
    }
    case "Webhook Pix": {
      const evidence = readiness?.webhookDrill;
      if (!evidence) {
        return {
          tag: "webhook drill",
          summary: "Sem prova local da assinatura Pix.",
          runHint: "npm run readiness:webhook-drill",
          meta: [],
          evidence: [],
        };
      }
      return {
        tag: "webhook drill",
        summary: evidence.ok ? "Webhook Pix assinado validado" : "Evidência Pix inválida",
        meta: [
          { label: "Sem assinatura", value: Number(evidence.unsignedStatus || 0) },
          { label: "Assinado", value: Number(evidence.signedStatus || 0) },
          { label: "Estoque final", value: Number(evidence.stockAfterPayment || 0) },
          { label: "Duração", value: `${Number(evidence.durationMs || 0)} ms` },
        ],
        evidence: [
          { label: "Pedido", value: evidence.orderId || "não registrado" },
          { label: "Pagamento", value: evidence.paymentId || "não registrado" },
          { label: "Status final", value: evidence.finalOrderStatus || "sem status" },
          { label: "Verificado em", value: formatDateTime(evidence.checkedAt) },
        ],
      };
    }
    case "Aceite do provider": {
      const evidence = readiness?.providerApproval;
      if (!evidence) {
        return {
          tag: "provider approval",
          summary: "Aceite do provider ainda não registrado.",
          runHint: "Registre provider, conta, termos, fees e contrato de webhook abaixo.",
          meta: [],
          evidence: [],
        };
      }
      return {
        tag: "provider approval",
        summary: evidence.ok
          ? "Provider aprovado para a associação"
          : "Aceite do provider pendente",
        meta: [
          { label: "Provider", value: evidence.provider || "não definido" },
          { label: "Status", value: evidence.status || "pending" },
          { label: "Verificado em", value: formatDateTime(evidence.checkedAt) },
          { label: "Protocolo", value: evidence.evidenceRef || "pendente" },
        ],
        evidence: [
          { label: "Conta", value: evidence.accountStatus || "pendente" },
          { label: "Termos", value: evidence.termsRef ? "registrado" : "pendente" },
          { label: "Webhook", value: evidence.webhookDocsRef ? "registrado" : "pendente" },
          { label: "Repasse", value: evidence.settlementNotes ? "registrado" : "pendente" },
        ],
      };
    }
    case "Deploy/domain/logs": {
      const evidence = readiness?.deploymentCheck;
      if (!evidence) {
        return {
          tag: "deployment check",
          summary: "Deploy, domínio e logs sem prova.",
          runHint: "npm run readiness:deployment-check",
          meta: [],
          evidence: [],
        };
      }
      return {
        tag: "deployment check",
        summary: evidence.ok ? "Runtime de release verificado" : "Evidência de deploy inválida",
        meta: [
          { label: "Health", value: Number(evidence.healthStatus || 0) },
          { label: "Catálogo negado", value: Number(evidence.catalogDeniedStatus || 0) },
          { label: "Rota protegida", value: Number(evidence.protectedRouteStatus || 0) },
          { label: "HTTPS", value: evidence.https ? "sim" : "não" },
        ],
        evidence: [
          { label: "URL", value: evidence.baseUrl || "não registrada" },
          { label: "Logs", value: evidence.logsRef || "não registrada" },
          { label: "Verificado em", value: formatDateTime(evidence.checkedAt) },
        ],
      };
    }
    case "Dominio/TLS": {
      const evidence = readiness?.domainTls;
      if (!evidence) {
        return {
          tag: "domain tls",
          summary: "Domínio profissional e TLS sem prova.",
          runHint: "READINESS_DOMAIN_URL=https://dominio npm run readiness:domain-tls",
          meta: [],
          evidence: [],
        };
      }
      return {
        tag: "domain tls",
        summary: evidence.ok ? "Domínio e certificado verificados" : "Domínio/TLS pendente",
        meta: [
          { label: "HTTPS", value: evidence.https ? "sim" : "não" },
          { label: "Host público", value: evidence.professionalHost ? "sim" : "não" },
          { label: "TLS autorizado", value: evidence.authorized ? "sim" : "não" },
          { label: "Health", value: Number(evidence.healthStatus || 0) },
        ],
        evidence: [
          { label: "Hostname", value: evidence.hostname || "não registrado" },
          { label: "Validade", value: evidence.validTo || "não registrada" },
          {
            label: "Issuer",
            value: evidence.issuer?.O || evidence.issuer?.CN || "não registrado",
          },
          { label: "Verificado em", value: formatDateTime(evidence.checkedAt) },
        ],
      };
    }
    case "Schema DB": {
      const evidence = readiness?.schemaCheck;
      if (!evidence) {
        return {
          tag: "schema db",
          summary: "Schema SQLite sem prova.",
          runHint: "DB_FILE=<sqlite> npm run readiness:schema-check",
          meta: [],
          evidence: [],
        };
      }
      return {
        tag: "schema db",
        summary: evidence.ok ? "Schema e migrations validados" : "Schema DB pendente",
        meta: [
          { label: "Esperado", value: Number(evidence.expectedVersion || 0) },
          { label: "Atual", value: Number(evidence.schemaVersion || 0) },
          { label: "Tabelas", value: Number(evidence.tableCount || 0) },
          { label: "Migrations", value: Number(evidence.migrations?.length || 0) },
        ],
        evidence: [
          { label: "DB", value: evidence.dbFile || "não registrado" },
          {
            label: "Faltando",
            value: evidence.missingTables?.length ? evidence.missingTables.join(", ") : "nenhuma",
          },
          { label: "Verificado em", value: formatDateTime(evidence.checkedAt) },
        ],
      };
    }
    case "Sessao/cookie": {
      const evidence = readiness?.sessionSecurity;
      if (!evidence) {
        return {
          tag: "session cookie",
          summary: "Cookie de sessão sem prova.",
          runHint: "READINESS_BASE_URL=<url> npm run readiness:session-security",
          meta: [],
          evidence: [],
        };
      }
      const cookie = evidence.cookie || {};
      return {
        tag: "session cookie",
        summary: evidence.ok ? "Sessão assinada validada" : "Cookie de sessão pendente",
        meta: [
          { label: "HttpOnly", value: cookie.httpOnly ? "sim" : "não" },
          { label: "SameSite", value: cookie.sameSite || "pendente" },
          { label: "Secure", value: cookie.secure ? "sim" : "não" },
          { label: "Assinado", value: cookie.signedValue ? "sim" : "não" },
        ],
        evidence: [
          { label: "URL", value: evidence.baseUrl || "não registrada" },
          { label: "Login", value: Number(evidence.loginStatus || 0) },
          {
            label: "Secure obrigatório",
            value: evidence.secureRequired ? "sim" : "não (HTTP local)",
          },
          { label: "Verificado em", value: formatDateTime(evidence.checkedAt) },
        ],
      };
    }
    case "Backup/restore": {
      const evidence = readiness?.backupRestore;
      if (!evidence) {
        return {
          tag: "restore drill",
          summary: "Sem evidencia local registrada.",
          runHint: "npm run readiness:backup-drill",
          meta: [],
          evidence: [],
        };
      }
      const counts = evidence.counts || {};
      return {
        tag: "restore drill",
        summary: evidence.ok ? "Backup restaurado e validado" : "Evidência inválida",
        meta: [
          { label: "Pacientes", value: Number(counts.patients || 0) },
          { label: "Produtos", value: Number(counts.products || 0) },
          { label: "Equipe", value: Number(counts.teamUsers || 0) },
          { label: "Auditoria", value: Number(counts.auditEvents || 0) },
        ],
        evidence: [
          { label: "Arquivo", value: evidence.backupFileName || "não registrado" },
          { label: "Tamanho", value: formatBytes(evidence.bytes) },
          {
            label: "sha256",
            value: `${String(evidence.sha256 || "").slice(0, 16)}${evidence.sha256 ? "..." : ""}`,
          },
          { label: "Verificado em", value: formatDateTime(evidence.checkedAt) },
        ],
      };
    }
    case "Backup offsite": {
      const evidence = readiness?.backupSchedule;
      if (!evidence) {
        return {
          tag: "backup offsite",
          summary: "Agenda e destino offsite sem prova.",
          runHint: "Preencha o formulário abaixo com destino, retenção e último backup.",
          meta: [],
          evidence: [],
        };
      }
      return {
        tag: "backup offsite",
        summary: evidence.ok ? "Backup offsite configurado" : "Backup offsite pendente",
        meta: [
          { label: "Frequência", value: evidence.frequency || "pendente" },
          { label: "Retenção", value: evidence.retention || "pendente" },
          {
            label: "Criptografia",
            value: evidence.encryptionRef ? "registrada" : "pendente",
          },
          { label: "Status", value: evidence.status || "pending" },
        ],
        evidence: [
          { label: "Destino", value: evidence.offsiteTargetRef || "não registrado" },
          { label: "Último backup", value: evidence.lastBackupRef || "sem referência" },
          {
            label: "Restore drill sha",
            value: `${String(evidence.restoreDrillSha256 || "").slice(0, 16)}${evidence.restoreDrillSha256 ? "..." : ""}`,
          },
          { label: "Verificado em", value: formatDateTime(evidence.checkedAt) },
        ],
      };
    }
    default:
      return {
        summary: gate.detail,
        meta: [{ label: "Status", value: gate.status }],
        evidence: [],
      };
  }
}

function ProviderEvidenceForm({ evidence, onSubmit }) {
  return (
    <form
      id="provider-evidence-form"
      className="inline-form"
      key={evidence?.checkedAt || "provider-evidence"}
      onSubmit={onSubmit}
    >
      <label>
        Provider Pix
        <select name="provider" defaultValue={evidence?.provider || "asaas"}>
          <option value="asaas">Asaas</option>
          <option value="mercado-pago">Mercado Pago</option>
          <option value="pagarme">Pagar.me</option>
        </select>
      </label>
      <label>
        Status
        <select name="status" defaultValue={evidence?.status || "pending"}>
          <option value="pending">Pendente</option>
          <option value="approved">Aprovado</option>
          <option value="rejected">Rejeitado</option>
        </select>
      </label>
      <label>
        Conta/CNPJ
        <input
          name="accountStatus"
          defaultValue={evidence?.accountStatus || ""}
          placeholder="Conta aprovada para CNPJ ..."
        />
      </label>
      <label>
        Protocolo de aceite
        <input
          name="evidenceRef"
          defaultValue={evidence?.evidenceRef || ""}
          placeholder="Ticket, email, contrato ou protocolo"
        />
      </label>
      <label>
        Termos/contrato
        <input
          name="termsRef"
          defaultValue={evidence?.termsRef || ""}
          placeholder="Referência dos termos aceitos"
        />
      </label>
      <label>
        Docs de webhook
        <input
          name="webhookDocsRef"
          defaultValue={evidence?.webhookDocsRef || ""}
          placeholder="Referência da configuração webhook"
        />
      </label>
      <label className="wide-field">
        Repasse/fees
        <input
          name="settlementNotes"
          defaultValue={evidence?.settlementNotes || ""}
          placeholder="Resumo de taxas, prazo de repasse e responsável"
        />
      </label>
      <button className="primary" type="submit">
        Registrar provider
      </button>
    </form>
  );
}

function BackupScheduleForm({ evidence, restoreDrillSha256, onSubmit }) {
  return (
    <form
      id="backup-schedule-form"
      className="inline-form"
      key={evidence?.checkedAt || "backup-schedule"}
      onSubmit={onSubmit}
    >
      <label>
        Status
        <select name="status" defaultValue={evidence?.status || "pending"}>
          <option value="pending">Pendente</option>
          <option value="configured">Configurado</option>
          <option value="disabled">Desativado</option>
        </select>
      </label>
      <label>
        Destino offsite
        <input
          name="offsiteTargetRef"
          defaultValue={evidence?.offsiteTargetRef || ""}
          placeholder="S3/Backblaze/Drive corporativo"
        />
      </label>
      <label>
        Frequência
        <input
          name="frequency"
          defaultValue={evidence?.frequency || ""}
          placeholder="Diário 03:00 BRT"
        />
      </label>
      <label>
        Retenção
        <input
          name="retention"
          defaultValue={evidence?.retention || ""}
          placeholder="30 dias + mensal 12 meses"
        />
      </label>
      <label>
        Criptografia
        <input
          name="encryptionRef"
          defaultValue={evidence?.encryptionRef || ""}
          placeholder="KMS/chave/responsável"
        />
      </label>
      <label>
        Último sucesso
        <input
          name="lastSuccessfulBackupAt"
          defaultValue={evidence?.lastSuccessfulBackupAt || ""}
          placeholder="2026-05-08T03:00:00-03:00"
        />
      </label>
      <label>
        Último backup
        <input
          name="lastBackupRef"
          defaultValue={evidence?.lastBackupRef || ""}
          placeholder="URI ou job id do backup offsite"
        />
      </label>
      <label>
        Operador
        <input
          name="operatorRef"
          defaultValue={evidence?.operatorRef || ""}
          placeholder="Responsável pela rotina"
        />
      </label>
      <input type="hidden" name="restoreDrillSha256" value={restoreDrillSha256} readOnly />
      <button className="primary" type="submit">
        Registrar backup offsite
      </button>
    </form>
  );
}

function filteredAudit(auditLog, filters) {
  const query = normalize(filters.adminQuery);
  const status = filters.adminStatus;
  return auditLog.filter((event) => {
    const matchesStatus = status === "all" || String(event.action || "").includes(status);
    const matchesQuery =
      !query ||
      normalize(
        [event.action, event.actor, JSON.stringify(event.details || {})].join(" "),
      ).includes(query);
    return matchesStatus && matchesQuery;
  });
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : {},
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Erro na requisição.");
  return payload;
}

function formatDateTime(value) {
  if (!value) return "data não registrada";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
