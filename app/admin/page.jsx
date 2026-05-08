"use client";

import { useEffect, useMemo, useState } from "react";
import Brand from "../components/Brand";
import ReleaseProgress from "./components/ReleaseProgress";
import GateCard from "./components/GateCard";
import GateDetail from "./components/GateDetail";
import adminStyles from "./admin.module.css";

const initialFilters = { adminQuery: "", adminStatus: "all" };

const GATE_TAGS = {
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
  const [dashboard, setDashboard] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [filters, setFilters] = useState(initialFilters);
  const [status, setStatus] = useState("carregando");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [selectedGate, setSelectedGate] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const [dashboardPayload, readinessPayload] = await Promise.all([
        api("/api/team/dashboard"),
        api("/api/team/readiness"),
      ]);
      setDashboard(dashboardPayload);
      setReadiness(readinessPayload);
      setStatus("equipe autenticada");
      setError("");
    } catch (loadError) {
      setStatus("acesso restrito");
      setError(loadError.message);
    }
  }

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
      showToast("Usuario da equipe criado com papel e permissoes.");
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
      showToast("Evidencia do provider registrada para readiness.");
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
      showToast("Evidencia de backup offsite registrada para readiness.");
    } catch (submitError) {
      showToast(submitError.message);
    }
  }

  async function onTeamUserStatus(userId, status) {
    try {
      await api("/api/team/users/status", { method: "POST", body: { userId, status } });
      await load();
      showToast(
        status === "active"
          ? "Usuario da equipe reativado."
          : "Usuario da equipe desativado e sessoes revogadas.",
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
      showToast("Senha temporaria redefinida e sessoes do usuario revogadas.");
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
    setToast(message || "Erro na requisicao.");
    window.clearTimeout(showToast.timeout);
    showToast.timeout = window.setTimeout(() => setToast(""), 3200);
  }

  const audit = useMemo(
    () => filteredAudit(dashboard?.auditLog || [], filters),
    [dashboard, filters],
  );

  return (
    <>
      <header className="topbar">
        <Brand />
        <nav aria-label="Areas do sistema">
          <a className="ghost" href="/paciente">
            Paciente
          </a>
          <a className="ghost" href="/equipe">
            Comando
          </a>
          <a className="ghost" href="/equipe/pacientes">
            Pacientes
          </a>
          <a className="ghost" href="/equipe/estoque">
            Estoque
          </a>
          <a className="ghost" href="/equipe/pedidos">
            Pedidos
          </a>
          <a className="ghost" href="/equipe/fulfillment">
            Fulfillment
          </a>
          <a className="ghost" href="/equipe/suporte">
            Suporte
          </a>
          <a className="ghost active" href="/admin">
            Admin
          </a>
        </nav>
      </header>

      <main>
        <div className="app-layout">
          <aside className="side-nav" aria-label="Rotas da equipe">
            <a href="/equipe">Comando da equipe</a>
            <a href="/equipe/pacientes">Pacientes e receitas</a>
            <a href="/equipe/estoque">Produtos, estoque e cultivo</a>
            <a href="/equipe/pedidos">Pedidos e Pix</a>
            <a href="/equipe/fulfillment">Fulfillment e envio</a>
            <a href="/equipe/suporte">Suporte ao paciente</a>
            <a className="active" href="/admin">
              Admin e compliance
            </a>
          </aside>

          <section className="surface-stack">
            <article className="panel">
              <div className="section-heading">
                <div>
                  <p className="kicker">Admin e compliance</p>
                  <h2>Readiness, permissoes e auditoria</h2>
                  <p className="muted">
                    Controle a liberacao operacional por evidencias reais: Pix, provider, deploy,
                    backups, usuarios e trilha de auditoria.
                  </p>
                </div>
                <span className="status" id="admin-status">
                  {status}
                </span>
              </div>

              <div className="surface-toolbar" aria-label="Filtros de auditoria">
                <label>
                  Buscar auditoria
                  <input
                    data-filter="adminQuery"
                    value={filters.adminQuery}
                    onChange={onFilterChange}
                    placeholder="Acao, ator, paciente, pedido"
                  />
                </label>
                <label>
                  Tipo
                  <select
                    data-filter="adminStatus"
                    value={filters.adminStatus}
                    onChange={onFilterChange}
                  >
                    <option value="all">Todos</option>
                    <option value="team_user">Equipe</option>
                    <option value="payment">Pagamentos</option>
                    <option value="patient">Pacientes</option>
                    <option value="order">Pedidos</option>
                    <option value="support">Suporte</option>
                  </select>
                </label>
              </div>

              {error ? (
                <div id="admin-surface" className="stack">
                  <p className="pill danger">{error}</p>
                </div>
              ) : (
                <div id="admin-surface" className="stack">
                  <section className="route-summary">
                    <Metric label="Usuarios equipe" value={dashboard?.teamUsers?.length || 0} />
                    <Metric label="Eventos auditoria" value={dashboard?.auditLog?.length || 0} />
                    <Metric
                      label="Docs receita"
                      value={dashboard?.prescriptionDocuments?.length || 0}
                    />
                  </section>

                  <ReadinessSection
                    readiness={readiness}
                    selectedGate={selectedGate}
                    onSelectGate={setSelectedGate}
                    onProviderEvidence={onProviderEvidence}
                    onBackupScheduleEvidence={onBackupScheduleEvidence}
                  />

                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <p className="kicker">Usuarios da equipe</p>
                        <h3>Acesso operacional</h3>
                      </div>
                    </div>
                    <form id="team-user-form" className="inline-form" onSubmit={onCreateUser}>
                      <label>
                        Nome
                        <input name="name" placeholder="Nome completo" required />
                      </label>
                      <label>
                        Email
                        <input
                          name="email"
                          type="email"
                          placeholder="pessoa@associacao.org"
                          required
                        />
                      </label>
                      <label>
                        Senha temporaria
                        <input
                          name="password"
                          type="password"
                          placeholder="Senha inicial"
                          required
                        />
                      </label>
                      <label>
                        Papel
                        <select name="role" defaultValue="support">
                          <option value="admin">Admin</option>
                          <option value="operations">Operacoes</option>
                          <option value="support">Suporte</option>
                        </select>
                      </label>
                      <button className="primary" type="submit">
                        Criar usuario
                      </button>
                    </form>
                    <div className="team-users-table">
                      <div className="team-users-head">
                        <span>Nome</span>
                        <span>Email</span>
                        <span>Papel</span>
                        <span>Status</span>
                        <span>Acoes</span>
                      </div>
                      {(dashboard?.teamUsers || []).map((user) => (
                        <article className="team-user-row" key={user.id || user.email}>
                          <strong>{user.name}</strong>
                          <span>{user.email}</span>
                          <span>{user.role}</span>
                          <span
                            className={`pill ${user.status === "active" ? "" : "danger"}`.trim()}
                          >
                            {user.status}
                          </span>
                          <div className="admin-row-actions">
                            {user.status === "active" ? (
                              <button
                                className="mini danger"
                                type="button"
                                onClick={() => onTeamUserStatus(user.id, "inactive")}
                              >
                                Desativar
                              </button>
                            ) : (
                              <button
                                className="mini"
                                type="button"
                                onClick={() => onTeamUserStatus(user.id, "active")}
                              >
                                Reativar
                              </button>
                            )}
                            <details className="row-action-drawer">
                              <summary>Senha</summary>
                              <form
                                className="team-password-reset"
                                onSubmit={(event) => onTeamUserPassword(event, user.id)}
                              >
                                <label>
                                  Nova senha temporaria
                                  <input
                                    name="password"
                                    type="password"
                                    placeholder="Minimo 10 caracteres"
                                    minLength={10}
                                    required
                                  />
                                </label>
                                <button className="mini" type="submit">
                                  Redefinir senha
                                </button>
                              </form>
                            </details>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>

                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <p className="kicker">Auditoria recente</p>
                        <h3>Eventos de seguranca e operacao</h3>
                      </div>
                    </div>
                    <div className="audit-ledger">
                      <div className="audit-ledger-head">
                        <span>Quando</span>
                        <span>Ator</span>
                        <span>Acao</span>
                        <span>Detalhes</span>
                      </div>
                      {audit.length ? (
                        audit.map((event) => (
                          <article
                            className="audit-ledger-row"
                            key={`${event.at}-${event.action}-${event.actor}`}
                          >
                            <time>{formatDateTime(event.at)}</time>
                            <strong>{event.actor}</strong>
                            <span>{event.action}</span>
                            <AuditDetails details={event.details || {}} />
                          </article>
                        ))
                      ) : (
                        <p className="muted">
                          Nenhum evento de auditoria encontrado para o filtro atual.
                        </p>
                      )}
                    </div>
                  </section>
                </div>
              )}
            </article>
          </section>
        </div>
      </main>
      <div className={`toast ${toast ? "show" : ""}`} id="toast" role="status" aria-live="polite">
        {toast}
      </div>
    </>
  );
}

function ReadinessSection({
  readiness,
  selectedGate,
  onSelectGate,
  onProviderEvidence,
  onBackupScheduleEvidence,
}) {
  const gates = readiness?.gates || [];
  const releaseGate = readiness?.releaseGate;
  const passing = gates.filter((gate) => gate.status === "ok").length;
  const total = gates.length;
  const blockers = gates.filter((gate) => gate.status !== "ok").map((gate) => gate.label);
  const releaseChecks = releaseGate?.checks || [];
  const selected = selectedGate ? gates.find((gate) => gate.label === selectedGate) || null : null;
  return (
    <>
      <ReleaseProgress
        passing={passing}
        total={total}
        blockers={blockers}
        checkedAt={releaseGate?.checkedAt ? formatDateTime(releaseGate.checkedAt) : null}
      />

      <section
        className={`admin-evidence-panel ${releaseGate?.ok ? "good" : "warn"}`}
        aria-label="Resumo do release gate"
      >
        <div>
          <span>release gate</span>
          <strong>
            {releaseGate?.ok
              ? "Release liberado por evidencias"
              : "Release bloqueado por evidencias pendentes"}
          </strong>
          <p>
            {releaseGate?.ok
              ? "Todos os gates de producao estao completos."
              : `${blockers.length} bloqueio(s) impedem declarar producao pronta.`}
          </p>
          <p className="muted">Verificado em {formatDateTime(releaseGate?.checkedAt)}.</p>
        </div>
        <dl>
          {releaseChecks.map((check) => (
            <div key={check.name}>
              <dt>{check.name}</dt>
              <dd>{check.ok ? "ok" : "pendente"}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="panel-heading">
        <div>
          <p className="kicker">Readiness do ambiente</p>
          <h3>Gates de producao</h3>
          <p className="muted">
            Clique em um gate para ver evidencias e registrar provas. As escritas continuam indo
            para os mesmos endpoints `/api/team/readiness/*`.
          </p>
        </div>
      </div>

      {gates.length ? (
        <section className={adminStyles.readinessGrid} aria-label="Gates de readiness">
          {gates.map((gate) => {
            const gateDetail = buildDetailForGate(gate, readiness);
            const caption = gateDetail.summary || "";
            return (
              <GateCard
                key={gate.label}
                id={gate.label}
                label={gate.label}
                detail={gate.detail}
                tone={toneFor(gate)}
                pillText={gate.status === "ok" ? "Passa" : "Pendente"}
                tag={GATE_TAGS[gate.label] || ""}
                caption={caption !== gate.detail ? caption : ""}
                selected={selectedGate === gate.label}
                onSelect={(id) => onSelectGate(id === selectedGate ? null : id)}
              />
            );
          })}
        </section>
      ) : (
        <p className="muted">Readiness nao carregado.</p>
      )}

      {selected ? (
        <GateDetailForGate
          gate={selected}
          readiness={readiness}
          onClose={() => onSelectGate(null)}
          onProviderEvidence={onProviderEvidence}
          onBackupScheduleEvidence={onBackupScheduleEvidence}
        />
      ) : null}
    </>
  );
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
        summary: evidence.ok ? "Webhook Pix assinado validado" : "Evidencia Pix invalida",
        meta: [
          { label: "Sem assinatura", value: Number(evidence.unsignedStatus || 0) },
          { label: "Assinado", value: Number(evidence.signedStatus || 0) },
          { label: "Estoque final", value: Number(evidence.stockAfterPayment || 0) },
          { label: "Duracao", value: `${Number(evidence.durationMs || 0)} ms` },
        ],
        evidence: [
          { label: "Pedido", value: evidence.orderId || "nao registrado" },
          { label: "Pagamento", value: evidence.paymentId || "nao registrado" },
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
          summary: "Aceite do provider ainda nao registrado.",
          runHint: "Registre provider, conta, termos, fees e contrato de webhook abaixo.",
          meta: [],
          evidence: [],
        };
      }
      return {
        tag: "provider approval",
        summary: evidence.ok
          ? "Provider aprovado para a associacao"
          : "Aceite do provider pendente",
        meta: [
          { label: "Provider", value: evidence.provider || "nao definido" },
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
          summary: "Deploy, dominio e logs sem prova.",
          runHint: "npm run readiness:deployment-check",
          meta: [],
          evidence: [],
        };
      }
      return {
        tag: "deployment check",
        summary: evidence.ok ? "Runtime de release verificado" : "Evidencia de deploy invalida",
        meta: [
          { label: "Health", value: Number(evidence.healthStatus || 0) },
          { label: "Catalogo negado", value: Number(evidence.catalogDeniedStatus || 0) },
          { label: "Rota protegida", value: Number(evidence.protectedRouteStatus || 0) },
          { label: "HTTPS", value: evidence.https ? "sim" : "nao" },
        ],
        evidence: [
          { label: "URL", value: evidence.baseUrl || "nao registrada" },
          { label: "Logs", value: evidence.logsRef || "nao registrada" },
          { label: "Verificado em", value: formatDateTime(evidence.checkedAt) },
        ],
      };
    }
    case "Dominio/TLS": {
      const evidence = readiness?.domainTls;
      if (!evidence) {
        return {
          tag: "domain tls",
          summary: "Dominio profissional e TLS sem prova.",
          runHint: "READINESS_DOMAIN_URL=https://dominio npm run readiness:domain-tls",
          meta: [],
          evidence: [],
        };
      }
      return {
        tag: "domain tls",
        summary: evidence.ok ? "Dominio e certificado verificados" : "Dominio/TLS pendente",
        meta: [
          { label: "HTTPS", value: evidence.https ? "sim" : "nao" },
          { label: "Host publico", value: evidence.professionalHost ? "sim" : "nao" },
          { label: "TLS autorizado", value: evidence.authorized ? "sim" : "nao" },
          { label: "Health", value: Number(evidence.healthStatus || 0) },
        ],
        evidence: [
          { label: "Hostname", value: evidence.hostname || "nao registrado" },
          { label: "Validade", value: evidence.validTo || "nao registrada" },
          {
            label: "Issuer",
            value: evidence.issuer?.O || evidence.issuer?.CN || "nao registrado",
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
          { label: "DB", value: evidence.dbFile || "nao registrado" },
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
          summary: "Cookie de sessao sem prova.",
          runHint: "READINESS_BASE_URL=<url> npm run readiness:session-security",
          meta: [],
          evidence: [],
        };
      }
      const cookie = evidence.cookie || {};
      return {
        tag: "session cookie",
        summary: evidence.ok ? "Sessao assinada validada" : "Cookie de sessao pendente",
        meta: [
          { label: "HttpOnly", value: cookie.httpOnly ? "sim" : "nao" },
          { label: "SameSite", value: cookie.sameSite || "pendente" },
          { label: "Secure", value: cookie.secure ? "sim" : "nao" },
          { label: "Assinado", value: cookie.signedValue ? "sim" : "nao" },
        ],
        evidence: [
          { label: "URL", value: evidence.baseUrl || "nao registrada" },
          { label: "Login", value: Number(evidence.loginStatus || 0) },
          {
            label: "Secure obrigatorio",
            value: evidence.secureRequired ? "sim" : "nao (HTTP local)",
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
        summary: evidence.ok ? "Backup restaurado e validado" : "Evidencia invalida",
        meta: [
          { label: "Pacientes", value: Number(counts.patients || 0) },
          { label: "Produtos", value: Number(counts.products || 0) },
          { label: "Equipe", value: Number(counts.teamUsers || 0) },
          { label: "Auditoria", value: Number(counts.auditEvents || 0) },
        ],
        evidence: [
          { label: "Arquivo", value: evidence.backupFileName || "nao registrado" },
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
          runHint: "Preencha o formulario abaixo com destino, retencao e ultimo backup.",
          meta: [],
          evidence: [],
        };
      }
      return {
        tag: "backup offsite",
        summary: evidence.ok ? "Backup offsite configurado" : "Backup offsite pendente",
        meta: [
          { label: "Frequencia", value: evidence.frequency || "pendente" },
          { label: "Retencao", value: evidence.retention || "pendente" },
          {
            label: "Criptografia",
            value: evidence.encryptionRef ? "registrada" : "pendente",
          },
          { label: "Status", value: evidence.status || "pending" },
        ],
        evidence: [
          { label: "Destino", value: evidence.offsiteTargetRef || "nao registrado" },
          { label: "Ultimo backup", value: evidence.lastBackupRef || "sem referencia" },
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
          placeholder="Referencia dos termos aceitos"
        />
      </label>
      <label>
        Docs de webhook
        <input
          name="webhookDocsRef"
          defaultValue={evidence?.webhookDocsRef || ""}
          placeholder="Referencia da configuracao webhook"
        />
      </label>
      <label className="wide-field">
        Repasse/fees
        <input
          name="settlementNotes"
          defaultValue={evidence?.settlementNotes || ""}
          placeholder="Resumo de taxas, prazo de repasse e responsavel"
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
        Frequencia
        <input
          name="frequency"
          defaultValue={evidence?.frequency || ""}
          placeholder="Diario 03:00 BRT"
        />
      </label>
      <label>
        Retencao
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
          placeholder="KMS/chave/responsavel"
        />
      </label>
      <label>
        Ultimo sucesso
        <input
          name="lastSuccessfulBackupAt"
          defaultValue={evidence?.lastSuccessfulBackupAt || ""}
          placeholder="2026-05-08T03:00:00-03:00"
        />
      </label>
      <label>
        Ultimo backup
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
          placeholder="Responsavel pela rotina"
        />
      </label>
      <input type="hidden" name="restoreDrillSha256" value={restoreDrillSha256} readOnly />
      <button className="primary" type="submit">
        Registrar backup offsite
      </button>
    </form>
  );
}

function Metric({ label, value }) {
  return (
    <article className="queue-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function AuditDetails({ details }) {
  const entries = Object.entries(details).slice(0, 4);
  if (!entries.length) return <span className="muted">Sem detalhes estruturados</span>;
  return (
    <dl className="audit-detail-list">
      {entries.map(([key, value]) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd>{formatAuditValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatAuditValue(value) {
  if (value === null || value === undefined || value === "") return "nao informado";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
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
  if (!response.ok) throw new Error(payload.error || "Erro na requisicao.");
  return payload;
}

function formatDateTime(value) {
  if (!value) return "data nao registrada";
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
