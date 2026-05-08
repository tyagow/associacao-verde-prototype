"use client";

import { useEffect, useMemo, useState } from "react";
import Brand from "../components/Brand";

const initialFilters = { adminQuery: "", adminStatus: "all" };

export default function AdminPage() {
  const [dashboard, setDashboard] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [filters, setFilters] = useState(initialFilters);
  const [status, setStatus] = useState("carregando");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

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

                  <div className="panel-heading">
                    <div>
                      <p className="kicker">Readiness do ambiente</p>
                      <h3>Gates de producao</h3>
                    </div>
                  </div>
                  <section className="readiness-grid">
                    {readiness?.gates?.length ? (
                      readiness.gates.map((gate) => <ReadinessCard key={gate.label} gate={gate} />)
                    ) : (
                      <p className="muted">Readiness nao carregado.</p>
                    )}
                  </section>

                  <ReleaseGatePanel releaseGate={readiness?.releaseGate} />
                  <WebhookEvidencePanel evidence={readiness?.webhookDrill} />
                  <ProviderEvidencePanel evidence={readiness?.providerApproval} />
                  <DeploymentEvidencePanel evidence={readiness?.deploymentCheck} />
                  <DomainTlsEvidencePanel evidence={readiness?.domainTls} />
                  <SchemaEvidencePanel evidence={readiness?.schemaCheck} />
                  <SessionSecurityEvidencePanel evidence={readiness?.sessionSecurity} />
                  <BackupEvidencePanel evidence={readiness?.backupRestore} />
                  <BackupSchedulePanel evidence={readiness?.backupSchedule} />

                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <p className="kicker">Evidencias de liberacao</p>
                        <h3>Registrar provider e backup offsite</h3>
                        <p className="muted">
                          Estes registros nao aprovam producao sozinhos. Os gates so ficam ok quando
                          todos os campos obrigatorios de prova externa estiverem presentes.
                        </p>
                      </div>
                    </div>
                    <form
                      id="provider-evidence-form"
                      className="inline-form"
                      key={readiness?.providerApproval?.checkedAt || "provider-evidence"}
                      onSubmit={onProviderEvidence}
                    >
                      <label>
                        Provider Pix
                        <select
                          name="provider"
                          defaultValue={readiness?.providerApproval?.provider || "asaas"}
                        >
                          <option value="asaas">Asaas</option>
                          <option value="mercado-pago">Mercado Pago</option>
                          <option value="pagarme">Pagar.me</option>
                        </select>
                      </label>
                      <label>
                        Status
                        <select
                          name="status"
                          defaultValue={readiness?.providerApproval?.status || "pending"}
                        >
                          <option value="pending">Pendente</option>
                          <option value="approved">Aprovado</option>
                          <option value="rejected">Rejeitado</option>
                        </select>
                      </label>
                      <label>
                        Conta/CNPJ
                        <input
                          name="accountStatus"
                          defaultValue={readiness?.providerApproval?.accountStatus || ""}
                          placeholder="Conta aprovada para CNPJ ..."
                        />
                      </label>
                      <label>
                        Protocolo de aceite
                        <input
                          name="evidenceRef"
                          defaultValue={readiness?.providerApproval?.evidenceRef || ""}
                          placeholder="Ticket, email, contrato ou protocolo"
                        />
                      </label>
                      <label>
                        Termos/contrato
                        <input
                          name="termsRef"
                          defaultValue={readiness?.providerApproval?.termsRef || ""}
                          placeholder="Referencia dos termos aceitos"
                        />
                      </label>
                      <label>
                        Docs de webhook
                        <input
                          name="webhookDocsRef"
                          defaultValue={readiness?.providerApproval?.webhookDocsRef || ""}
                          placeholder="Referencia da configuracao webhook"
                        />
                      </label>
                      <label className="wide-field">
                        Repasse/fees
                        <input
                          name="settlementNotes"
                          defaultValue={readiness?.providerApproval?.settlementNotes || ""}
                          placeholder="Resumo de taxas, prazo de repasse e responsavel"
                        />
                      </label>
                      <button className="primary" type="submit">
                        Registrar provider
                      </button>
                    </form>

                    <form
                      id="backup-schedule-form"
                      className="inline-form"
                      key={readiness?.backupSchedule?.checkedAt || "backup-schedule"}
                      onSubmit={onBackupScheduleEvidence}
                    >
                      <label>
                        Status
                        <select
                          name="status"
                          defaultValue={readiness?.backupSchedule?.status || "pending"}
                        >
                          <option value="pending">Pendente</option>
                          <option value="configured">Configurado</option>
                          <option value="disabled">Desativado</option>
                        </select>
                      </label>
                      <label>
                        Destino offsite
                        <input
                          name="offsiteTargetRef"
                          defaultValue={readiness?.backupSchedule?.offsiteTargetRef || ""}
                          placeholder="S3/Backblaze/Drive corporativo"
                        />
                      </label>
                      <label>
                        Frequencia
                        <input
                          name="frequency"
                          defaultValue={readiness?.backupSchedule?.frequency || ""}
                          placeholder="Diario 03:00 BRT"
                        />
                      </label>
                      <label>
                        Retencao
                        <input
                          name="retention"
                          defaultValue={readiness?.backupSchedule?.retention || ""}
                          placeholder="30 dias + mensal 12 meses"
                        />
                      </label>
                      <label>
                        Criptografia
                        <input
                          name="encryptionRef"
                          defaultValue={readiness?.backupSchedule?.encryptionRef || ""}
                          placeholder="KMS/chave/responsavel"
                        />
                      </label>
                      <label>
                        Ultimo sucesso
                        <input
                          name="lastSuccessfulBackupAt"
                          defaultValue={readiness?.backupSchedule?.lastSuccessfulBackupAt || ""}
                          placeholder="2026-05-08T03:00:00-03:00"
                        />
                      </label>
                      <label>
                        Ultimo backup
                        <input
                          name="lastBackupRef"
                          defaultValue={readiness?.backupSchedule?.lastBackupRef || ""}
                          placeholder="URI ou job id do backup offsite"
                        />
                      </label>
                      <label>
                        Operador
                        <input
                          name="operatorRef"
                          defaultValue={readiness?.backupSchedule?.operatorRef || ""}
                          placeholder="Responsavel pela rotina"
                        />
                      </label>
                      <input
                        type="hidden"
                        name="restoreDrillSha256"
                        value={
                          readiness?.backupRestore?.sha256 ||
                          readiness?.backupSchedule?.restoreDrillSha256 ||
                          ""
                        }
                        readOnly
                      />
                      <button className="primary" type="submit">
                        Registrar backup offsite
                      </button>
                    </form>
                  </section>

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

function ReadinessCard({ gate }) {
  const tone = gate.status === "ok" ? "good" : "warn";
  return (
    <article className={`readiness-card ${tone}`}>
      <span>{gate.status}</span>
      <strong>{gate.label}</strong>
      <p>{gate.detail}</p>
    </article>
  );
}

function ReleaseGatePanel({ releaseGate }) {
  if (!releaseGate) {
    return (
      <section className="admin-evidence-panel warn">
        <div>
          <span>release gate</span>
          <strong>Release gate sem evidencia carregada</strong>
          <p>Execute os drills de readiness antes de avaliar a liberacao de producao.</p>
        </div>
      </section>
    );
  }
  const blockers = releaseGate.checks?.filter((check) => !check.ok) || [];
  return (
    <section className={`admin-evidence-panel ${releaseGate.ok ? "good" : "warn"}`}>
      <div>
        <span>release gate</span>
        <strong>
          {releaseGate.ok
            ? "Release liberado por evidencias"
            : "Release bloqueado por evidencias pendentes"}
        </strong>
        <p>
          {releaseGate.ok
            ? "Todos os gates de producao estao completos."
            : `${blockers.length} bloqueio(s) impedem declarar producao pronta.`}
        </p>
        <p className="muted">Verificado em {formatDateTime(releaseGate.checkedAt)}.</p>
      </div>
      <dl>
        {(releaseGate.checks || []).map((check) => (
          <div key={check.name}>
            <dt>{check.name}</dt>
            <dd>{check.ok ? "ok" : "pendente"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function BackupEvidencePanel({ evidence }) {
  if (!evidence) {
    return (
      <section className="admin-evidence-panel warn">
        <div>
          <span>restore drill</span>
          <strong>Sem evidencia local registrada</strong>
          <p>Execute npm run readiness:backup-drill antes de liberar producao.</p>
        </div>
      </section>
    );
  }
  const counts = evidence.counts || {};
  return (
    <section className={`admin-evidence-panel ${evidence.ok ? "good" : "warn"}`}>
      <div>
        <span>restore drill</span>
        <strong>{evidence.ok ? "Backup restaurado e validado" : "Evidencia invalida"}</strong>
        <p>
          {evidence.backupFileName || "arquivo nao registrado"} ·{" "}
          {formatDateTime(evidence.checkedAt)} · {formatBytes(evidence.bytes)}
        </p>
        <p className="muted">sha256 {String(evidence.sha256 || "").slice(0, 16)}...</p>
      </div>
      <dl>
        <EvidenceMetric label="Pacientes" value={counts.patients} />
        <EvidenceMetric label="Produtos" value={counts.products} />
        <EvidenceMetric label="Equipe" value={counts.teamUsers} />
        <EvidenceMetric label="Auditoria" value={counts.auditEvents} />
      </dl>
    </section>
  );
}

function WebhookEvidencePanel({ evidence }) {
  if (!evidence) {
    return (
      <section className="admin-evidence-panel warn">
        <div>
          <span>webhook drill</span>
          <strong>Sem prova local da assinatura Pix</strong>
          <p>
            Execute npm run readiness:webhook-drill para validar rejeicao sem segredo e confirmacao
            assinada.
          </p>
        </div>
      </section>
    );
  }
  return (
    <section className={`admin-evidence-panel ${evidence.ok ? "good" : "warn"}`}>
      <div>
        <span>webhook drill</span>
        <strong>{evidence.ok ? "Webhook Pix assinado validado" : "Evidencia Pix invalida"}</strong>
        <p>
          {evidence.orderId || "pedido nao registrado"} · {formatDateTime(evidence.checkedAt)} ·{" "}
          {Number(evidence.durationMs || 0)} ms
        </p>
        <p className="muted">
          Pagamento {evidence.paymentId || "nao registrado"} terminou como{" "}
          {evidence.finalOrderStatus || "sem status"}.
        </p>
      </div>
      <dl>
        <EvidenceMetric label="Sem assinatura" value={evidence.unsignedStatus} />
        <EvidenceMetric label="Assinado" value={evidence.signedStatus} />
        <EvidenceMetric label="Estoque final" value={evidence.stockAfterPayment} />
        <EvidenceMetric label="Ok" value={evidence.ok ? 1 : 0} />
      </dl>
    </section>
  );
}

function ProviderEvidencePanel({ evidence }) {
  if (!evidence) {
    return (
      <section className="admin-evidence-panel warn">
        <div>
          <span>provider approval</span>
          <strong>Aceite formal ainda nao registrado</strong>
          <p>
            Registre provider, status da conta, termos, fees/repasse e contrato de webhook antes da
            liberacao.
          </p>
        </div>
      </section>
    );
  }
  return (
    <section className={`admin-evidence-panel ${evidence.ok ? "good" : "warn"}`}>
      <div>
        <span>provider approval</span>
        <strong>
          {evidence.ok ? "Provider aprovado para a associacao" : "Aceite do provider pendente"}
        </strong>
        <p>
          {evidence.provider || "provider nao definido"} · {evidence.status || "pending"} ·{" "}
          {formatDateTime(evidence.checkedAt)}
        </p>
        <p className="muted">{evidence.evidenceRef || "Sem referencia formal registrada."}</p>
      </div>
      <dl>
        <EvidenceTextMetric label="Conta" value={evidence.accountStatus || "pendente"} />
        <EvidenceTextMetric label="Termos" value={evidence.termsRef ? "registrado" : "pendente"} />
        <EvidenceTextMetric
          label="Webhook"
          value={evidence.webhookDocsRef ? "registrado" : "pendente"}
        />
        <EvidenceTextMetric
          label="Repasse"
          value={evidence.settlementNotes ? "registrado" : "pendente"}
        />
      </dl>
    </section>
  );
}

function DeploymentEvidencePanel({ evidence }) {
  if (!evidence) {
    return (
      <section className="admin-evidence-panel warn">
        <div>
          <span>deployment check</span>
          <strong>Deploy, dominio e logs sem prova</strong>
          <p>
            Execute npm run readiness:deployment-check contra a URL de release e anexe referencia de
            logs.
          </p>
        </div>
      </section>
    );
  }
  return (
    <section className={`admin-evidence-panel ${evidence.ok ? "good" : "warn"}`}>
      <div>
        <span>deployment check</span>
        <strong>
          {evidence.ok ? "Runtime de release verificado" : "Evidencia de deploy invalida"}
        </strong>
        <p>
          {evidence.baseUrl || "URL nao registrada"} · {formatDateTime(evidence.checkedAt)}
        </p>
        <p className="muted">Logs: {evidence.logsRef || "referencia nao registrada"}</p>
      </div>
      <dl>
        <EvidenceMetric label="Health" value={evidence.healthStatus} />
        <EvidenceMetric label="Catalogo negado" value={evidence.catalogDeniedStatus} />
        <EvidenceMetric label="Rota protegida" value={evidence.protectedRouteStatus} />
        <EvidenceTextMetric label="HTTPS" value={evidence.https ? "sim" : "nao"} />
      </dl>
    </section>
  );
}

function DomainTlsEvidencePanel({ evidence }) {
  if (!evidence) {
    return (
      <section className="admin-evidence-panel warn">
        <div>
          <span>domain tls</span>
          <strong>Dominio profissional e TLS sem prova</strong>
          <p>
            Execute READINESS_DOMAIN_URL=https://dominio npm run readiness:domain-tls contra a URL
            publica de producao.
          </p>
        </div>
      </section>
    );
  }
  return (
    <section className={`admin-evidence-panel ${evidence.ok ? "good" : "warn"}`}>
      <div>
        <span>domain tls</span>
        <strong>
          {evidence.ok ? "Dominio e certificado verificados" : "Dominio/TLS pendente"}
        </strong>
        <p>
          {evidence.hostname || "dominio nao registrado"} · {formatDateTime(evidence.checkedAt)}
        </p>
        <p className="muted">
          Certificado ate {evidence.validTo || "data nao registrada"} · issuer{" "}
          {evidence.issuer?.O || evidence.issuer?.CN || "nao registrado"}
        </p>
      </div>
      <dl>
        <EvidenceTextMetric label="HTTPS" value={evidence.https ? "sim" : "nao"} />
        <EvidenceTextMetric
          label="Host publico"
          value={evidence.professionalHost ? "sim" : "nao"}
        />
        <EvidenceTextMetric label="TLS autorizado" value={evidence.authorized ? "sim" : "nao"} />
        <EvidenceMetric label="Health" value={evidence.healthStatus} />
      </dl>
    </section>
  );
}

function SchemaEvidencePanel({ evidence }) {
  if (!evidence) {
    return (
      <section className="admin-evidence-panel warn">
        <div>
          <span>schema db</span>
          <strong>Schema SQLite sem prova</strong>
          <p>
            Execute DB_FILE=&lt;sqlite&gt; npm run readiness:schema-check antes de liberar producao.
          </p>
        </div>
      </section>
    );
  }
  return (
    <section className={`admin-evidence-panel ${evidence.ok ? "good" : "warn"}`}>
      <div>
        <span>schema db</span>
        <strong>{evidence.ok ? "Schema e migrations validados" : "Schema DB pendente"}</strong>
        <p>
          {evidence.dbFile || "banco nao registrado"} · {formatDateTime(evidence.checkedAt)}
        </p>
        <p className="muted">
          {evidence.missingTables?.length
            ? `Faltando: ${evidence.missingTables.join(", ")}`
            : "Tabela de migrations e tabelas obrigatorias presentes."}
        </p>
      </div>
      <dl>
        <EvidenceMetric label="Esperado" value={evidence.expectedVersion} />
        <EvidenceMetric label="Atual" value={evidence.schemaVersion} />
        <EvidenceMetric label="Tabelas" value={evidence.tableCount} />
        <EvidenceMetric label="Migrations" value={evidence.migrations?.length || 0} />
      </dl>
    </section>
  );
}

function SessionSecurityEvidencePanel({ evidence }) {
  if (!evidence) {
    return (
      <section className="admin-evidence-panel warn">
        <div>
          <span>session cookie</span>
          <strong>Cookie de sessao sem prova</strong>
          <p>
            Execute READINESS_BASE_URL=&lt;url&gt; npm run readiness:session-security para validar
            login e atributos do cookie.
          </p>
        </div>
      </section>
    );
  }
  const cookie = evidence.cookie || {};
  return (
    <section className={`admin-evidence-panel ${evidence.ok ? "good" : "warn"}`}>
      <div>
        <span>session cookie</span>
        <strong>{evidence.ok ? "Sessao assinada validada" : "Cookie de sessao pendente"}</strong>
        <p>
          {evidence.baseUrl || "URL nao registrada"} · {formatDateTime(evidence.checkedAt)} · login{" "}
          {evidence.loginStatus || 0}
        </p>
        <p className="muted">
          {evidence.secureRequired
            ? "Secure obrigatorio neste ambiente."
            : "Secure sera obrigatorio em HTTPS/producao."}
        </p>
      </div>
      <dl>
        <EvidenceTextMetric label="HttpOnly" value={cookie.httpOnly ? "sim" : "nao"} />
        <EvidenceTextMetric label="SameSite" value={cookie.sameSite || "pendente"} />
        <EvidenceTextMetric label="Secure" value={cookie.secure ? "sim" : "nao"} />
        <EvidenceTextMetric label="Assinado" value={cookie.signedValue ? "sim" : "nao"} />
      </dl>
    </section>
  );
}

function BackupSchedulePanel({ evidence }) {
  if (!evidence) {
    return (
      <section className="admin-evidence-panel warn">
        <div>
          <span>backup offsite</span>
          <strong>Agenda e destino offsite sem prova</strong>
          <p>
            Registre destino, frequencia, retencao e ultimo backup offsite vinculado ao restore
            drill.
          </p>
        </div>
      </section>
    );
  }
  return (
    <section className={`admin-evidence-panel ${evidence.ok ? "good" : "warn"}`}>
      <div>
        <span>backup offsite</span>
        <strong>{evidence.ok ? "Backup offsite configurado" : "Backup offsite pendente"}</strong>
        <p>
          {evidence.offsiteTargetRef || "destino nao registrado"} ·{" "}
          {formatDateTime(evidence.checkedAt)}
        </p>
        <p className="muted">
          Ultimo backup: {evidence.lastBackupRef || "sem referencia"} · restore{" "}
          {String(evidence.restoreDrillSha256 || "").slice(0, 16)}
          {evidence.restoreDrillSha256 ? "..." : ""}
        </p>
      </div>
      <dl>
        <EvidenceTextMetric label="Frequencia" value={evidence.frequency || "pendente"} />
        <EvidenceTextMetric label="Retencao" value={evidence.retention || "pendente"} />
        <EvidenceTextMetric
          label="Criptografia"
          value={evidence.encryptionRef ? "registrada" : "pendente"}
        />
        <EvidenceTextMetric label="Status" value={evidence.status || "pending"} />
      </dl>
    </section>
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

function EvidenceMetric({ label, value }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{Number(value || 0)}</dd>
    </div>
  );
}

function EvidenceTextMetric({ label, value }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || "-"}</dd>
    </div>
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
