"use client";

import Brand from "../components/Brand";
import { useCallback, useEffect, useMemo, useState } from "react";

const TEAM_ROUTES = [
  ["/equipe", "Comando"],
  ["/equipe/pacientes", "Pacientes"],
  ["/equipe/estoque", "Estoque"],
  ["/equipe/pedidos", "Pedidos"],
  ["/equipe/fulfillment", "Fulfillment"],
  ["/equipe/suporte", "Suporte"],
  ["/admin", "Admin"],
];

export default function TeamCommand() {
  const [session, setSession] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isTeam = session?.role === "team";

  const loadSession = useCallback(async () => {
    setError("");
    const payload = await api("/api/session");
    setSession(payload.session || null);
    return payload.session || null;
  }, []);

  const loadDashboard = useCallback(async () => {
    const payload = await api("/api/team/dashboard");
    setDashboard(payload);
  }, []);

  useEffect(() => {
    let active = true;
    loadSession()
      .then((nextSession) => {
        if (!active || nextSession?.role !== "team") return null;
        return loadDashboard();
      })
      .catch((nextError) => {
        if (active) setError(nextError.message);
      });
    return () => {
      active = false;
    };
  }, [loadDashboard, loadSession]);

  async function handleLogin(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    const form = new FormData(event.currentTarget);
    try {
      await api("/api/team/login", {
        method: "POST",
        body: {
          email: form.get("email"),
          password: form.get("password"),
        },
      });
      const nextSession = await loadSession();
      if (nextSession?.role === "team") {
        await loadDashboard();
        setMessage("Equipe autenticada. Fila atualizada.");
      }
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handlePasswordChange(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const form = event.currentTarget;
    try {
      await api("/api/team/me/password", {
        method: "POST",
        body: Object.fromEntries(new FormData(form)),
      });
      form.reset();
      setMessage("Senha da equipe atualizada. Outras sessoes deste usuario foram revogadas.");
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api("/api/logout", { method: "POST" });
      setSession(null);
      setDashboard(null);
      setMessage("Sessao da equipe encerrada.");
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusy(false);
    }
  }

  const queues = useMemo(() => buildQueues(dashboard), [dashboard]);

  return (
    <>
      <header className="topbar">
        <Brand />
        <nav aria-label={isTeam ? "Areas da equipe" : "Entrada da equipe"}>
          <a className="ghost" href="/">
            Inicio
          </a>
          <a className="ghost" href="/paciente">
            Paciente
          </a>
          <a className="ghost active" href="/equipe" aria-current="page">
            Equipe
          </a>
          {isTeam ? (
            <>
              <a className="ghost" href="/equipe/pacientes">
                Pacientes
              </a>
              <a className="ghost" href="/equipe/estoque">
                Estoque
              </a>
              <a className="ghost" href="/equipe/pedidos">
                Pedidos
              </a>
              <a className="ghost" href="/equipe/suporte">
                Suporte
              </a>
              <a className="ghost" href="/admin">
                Admin
              </a>
            </>
          ) : null}
        </nav>
      </header>

      <main>
        <div className={`app-layout ${isTeam ? "" : "login-layout"}`.trim()}>
          {isTeam ? (
            <aside className="side-nav" aria-label="Rotas da equipe">
              {TEAM_ROUTES.map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  className={href === "/equipe" ? "active" : undefined}
                  aria-current={href === "/equipe" ? "page" : undefined}
                >
                  {label}
                </a>
              ))}
            </aside>
          ) : null}

          <section className="surface-stack">
            <article className="panel">
              <div className="panel-heading">
                <div>
                  <p className="kicker">Equipe Apoiar</p>
                  <h2>{isTeam ? "Comando da operacao" : "Acesso da equipe"}</h2>
                  <p className="muted">
                    {isTeam
                      ? "Fila diaria, alertas, reservas, pagamentos e itens que precisam de acao."
                      : "Entre com credenciais individuais para abrir a area operacional."}
                  </p>
                </div>
                <span className="status" id="team-status">
                  {isTeam ? "equipe autenticada" : "acesso restrito"}
                </span>
              </div>

              <form
                id="team-login"
                className="inline-form auth-form"
                hidden={isTeam}
                onSubmit={handleLogin}
              >
                <div className="auth-intro">
                  <strong>Acesso restrito da equipe</strong>
                  <span>
                    Use credenciais individuais. Tentativas repetidas sao bloqueadas e auditadas.
                  </span>
                </div>
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

              {message ? <p className="status">{message}</p> : null}
              {error ? <p className="pill danger">{error}</p> : null}

              <div id="team-dashboard" className="stack">
                {!isTeam ? (
                  <p className="muted">
                    Apos a autenticacao, o servidor libera as filas internas de pagamento, estoque,
                    documentos e atendimento.
                  </p>
                ) : !dashboard ? (
                  <p className="muted">Carregando fila da equipe...</p>
                ) : (
                  <>
                    <TeamAccountPanel
                      session={session}
                      busy={busy}
                      onPasswordChange={handlePasswordChange}
                      onLogout={logout}
                    />
                    <TeamDashboard dashboard={dashboard} queues={queues} />
                  </>
                )}
              </div>
            </article>
          </section>
        </div>
      </main>
    </>
  );
}

function TeamAccountPanel({ session, busy, onPasswordChange, onLogout }) {
  const user = session?.user;
  const permissions = user?.permissions || [];
  return (
    <section className="team-account-panel" aria-label="Perfil e sessao da equipe">
      <div className="team-operator-card">
        <span className="kicker">Operador autenticado</span>
        <h3>{user?.name || "Equipe Apoiar"}</h3>
        <p>
          {user?.email || "email nao informado"} · {roleLabel(user?.role)}
        </p>
        <div className="team-account-meta">
          <span>{user?.status === "active" ? "usuario ativo" : "usuario inativo"}</span>
          <span>
            {permissions.includes("*") ? "acesso admin" : `${permissions.length} permissao(oes)`}
          </span>
          <span>Sessao ate {formatDateTime(session?.session?.expiresAt)}</span>
        </div>
      </div>

      <div className="team-permission-card">
        <span className="kicker">Escopo de acesso</span>
        <div className="permission-chip-row">
          {(permissions.includes("*") ? ["todas as areas"] : permissions.map(permissionLabel)).map(
            (permission) => (
              <span className="pill" key={permission}>
                {permission}
              </span>
            ),
          )}
        </div>
      </div>

      <form id="team-password-form" className="team-session-form" onSubmit={onPasswordChange}>
        <div>
          <span className="kicker">Senha individual</span>
          <p>
            Atualize sua senha sem acionar o administrador. Outras sessoes deste usuario sao
            revogadas.
          </p>
        </div>
        <label>
          Senha atual
          <input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            placeholder="Senha atual"
            required
          />
        </label>
        <label>
          Nova senha
          <input
            name="newPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Minimo 10 caracteres"
            minLength={10}
            required
          />
        </label>
        <div className="compact-actions">
          <button className="primary" type="submit" disabled={busy}>
            Atualizar senha
          </button>
          <button className="mini" type="button" disabled={busy} onClick={onLogout}>
            Sair
          </button>
        </div>
      </form>
    </section>
  );
}

function TeamDashboard({ dashboard, queues }) {
  const activeReservations = dashboard.reservations.filter((item) => item.status === "active");
  const rows = priorityRows(queues, activeReservations);
  const riskItems = operationalRiskItems(queues, activeReservations);

  return (
    <>
      <section className="ops-kpi-strip" aria-label="Indicadores da operacao">
        <Metric
          label="Pix pendentes"
          value={queues.pendingPayments.length}
          tone={queues.pendingPayments.length ? "warn" : ""}
        />
        <Metric
          label="Separacao/envio"
          value={queues.paidFulfillment.length}
          tone={queues.paidFulfillment.length ? "good" : ""}
        />
        <Metric
          label="Baixo estoque"
          value={queues.lowStock.length}
          tone={queues.lowStock.length ? "warn" : ""}
        />
        <Metric
          label="Bloqueios"
          value={queues.blockedPatients.length}
          tone={queues.blockedPatients.length ? "danger" : ""}
        />
        <Metric
          label="Validades"
          value={queues.expiringPatients.length}
          tone={queues.expiringPatients.length ? "warn" : ""}
        />
        <Metric label="Reservas" value={activeReservations.length} />
      </section>

      <section className="ops-exception-strip" aria-label="Excecoes operacionais">
        {riskItems.map((item) => (
          <article className={item.tone} key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </section>

      <h3>Fila de acao agora</h3>
      <section className="ops-board" aria-label="Fila de acao agora">
        <div className="ops-board-head">
          <span>Prioridade</span>
          <span>Fila</span>
          <span>Referencia</span>
          <span>SLA / vencimento</span>
          <span>Acao</span>
        </div>
        {rows.map((row) => (
          <article className={`ops-row ${row.tone}`.trim()} key={row.label}>
            <span className="pill">{row.priority}</span>
            <div>
              <strong>{row.label}</strong>
              <p>{row.detail}</p>
            </div>
            <span>{row.reference}</span>
            <span>{row.sla}</span>
            <a className="mini" href={row.href}>
              {row.action}
            </a>
          </article>
        ))}
      </section>

      <h3>Areas operacionais</h3>
      <section className="shortcut-grid">
        {[
          [
            "/equipe/pedidos",
            "Pedidos e Pix",
            `${queues.pendingPayments.length} Pix pendente(s) e ${activeReservations.length} reserva(s) ativa(s).`,
          ],
          [
            "/equipe/fulfillment",
            "Fulfillment",
            `${queues.paidFulfillment.length} pedido(s) em separacao ou envio.`,
          ],
          [
            "/equipe/pacientes",
            "Pacientes e receitas",
            `${queues.blockedPatients.length} bloqueio(s), ${queues.expiringPatients.length} validade(s) proximas.`,
          ],
          [
            "/equipe/estoque",
            "Estoque e cultivo",
            `${queues.lowStock.length} alerta(s) de estoque, ${dashboard.cultivationBatches.length} lote(s) de cultivo.`,
          ],
          [
            "/equipe/suporte",
            "Suporte ao paciente",
            "Contexto de acesso, pedido, pagamento, envio e documentos.",
          ],
          ["/admin", "Admin e compliance", "Readiness, auditoria, papeis e gates de producao."],
        ].map(([href, label, detail]) => (
          <a className="shortcut-card" href={href} key={href}>
            <div>
              <strong>{label}</strong>
              <p>{detail}</p>
            </div>
            <span className="pill">Abrir</span>
          </a>
        ))}
      </section>
    </>
  );
}

function roleLabel(role) {
  return (
    {
      admin: "Administrador",
      operations: "Operacoes",
      stock: "Estoque",
      fulfillment: "Fulfillment",
      support: "Suporte",
    }[role] || "Equipe"
  );
}

function permissionLabel(permission) {
  return (
    {
      "dashboard:view": "painel",
      "patients:write": "pacientes",
      "prescriptions:write": "receitas",
      "products:write": "produtos",
      "stock:write": "estoque",
      "cultivation:write": "cultivo",
      "fulfillment:write": "fulfillment",
      "shipments:write": "envios",
      "support:write": "suporte",
      "payments:simulate": "Pix dev",
      "payments:reconcile": "conciliacao",
      "team:write": "usuarios",
    }[permission] || permission
  );
}

function Metric({ label, value, tone = "" }) {
  return (
    <article className={`ops-kpi ${tone}`.trim()}>
      <span className="kicker">{label}</span>
      <h2>{value}</h2>
    </article>
  );
}

function operationalRiskItems(queues, activeReservations) {
  return [
    {
      label: "Atencao critica",
      value: queues.blockedPatients.length + queues.pendingPayments.length,
      detail:
        queues.blockedPatients.length || queues.pendingPayments.length
          ? "Bloqueios de elegibilidade e Pix pendentes precisam ser tratados antes de liberar atendimento."
          : "Sem bloqueio critico de paciente ou pagamento na leitura atual.",
      tone: queues.blockedPatients.length || queues.pendingPayments.length ? "warn" : "good",
    },
    {
      label: "Dinheiro em aberto",
      value: queues.pendingPayments.length,
      detail: queues.pendingPayments[0]
        ? `Proximo vencimento: ${formatDateTime(queues.pendingPayments[0].expiresAt)}.`
        : "Nenhum Pix aguardando baixa.",
      tone: queues.pendingPayments.length ? "warn" : "good",
    },
    {
      label: "Estoque comprometido",
      value: activeReservations.length,
      detail: activeReservations[0]
        ? `Reserva mais proxima: ${activeReservations[0].orderId}.`
        : "Nenhum estoque reservado por pedido pendente.",
      tone: activeReservations.length ? "warn" : "good",
    },
    {
      label: "Acesso do paciente",
      value: queues.blockedPatients.length + queues.expiringPatients.length,
      detail:
        queues.blockedPatients.length || queues.expiringPatients.length
          ? "Revise bloqueios, receitas e carteirinhas antes de orientar novo pedido."
          : "Acesso sem alerta de bloqueio ou validade proxima.",
      tone: queues.blockedPatients.length
        ? "danger"
        : queues.expiringPatients.length
          ? "warn"
          : "good",
    },
  ];
}

function priorityRows(queues, activeReservations) {
  return [
    {
      priority: queues.pendingPayments.length ? "Alta" : "Ok",
      label: "Pix pendentes",
      detail: queues.pendingPayments[0]
        ? `${queues.pendingPayments.length} pagamento(s) aguardando baixa. Proximo: ${queues.pendingPayments[0].orderId}.`
        : "Nenhum Pix pendente para conciliar agora.",
      reference: queues.pendingPayments[0]?.orderId || "-",
      sla: queues.pendingPayments[0]
        ? formatDateTime(queues.pendingPayments[0].expiresAt)
        : "Sem vencimento aberto",
      href: "/equipe/pedidos",
      action: "Ver Pix",
      tone: queues.pendingPayments.length ? "warn" : "good",
    },
    {
      priority: queues.paidFulfillment.length ? "Alta" : "Ok",
      label: "Separacao e envio",
      detail: queues.paidFulfillment[0]
        ? `${queues.paidFulfillment.length} pedido(s) pago(s) precisam de separacao, envio ou rastreio.`
        : "Nenhum pedido pago aguardando fulfillment.",
      reference: queues.paidFulfillment[0]?.id || "-",
      sla: queues.paidFulfillment[0] ? "Separar hoje" : "Sem fila paga",
      href: "/equipe/fulfillment",
      action: "Ver fila",
      tone: queues.paidFulfillment.length ? "warn" : "good",
    },
    {
      priority: queues.lowStock.length ? "Media" : "Ok",
      label: "Estoque baixo",
      detail: queues.lowStock[0]
        ? `${queues.lowStock[0].name} esta com ${queues.lowStock[0].availableStock} ${queues.lowStock[0].unit} disponivel.`
        : "Sem produto abaixo do limite operacional.",
      reference: queues.lowStock[0]?.name || "-",
      sla: queues.lowStock[0] ? "Repor antes de liberar pedidos" : "Sem alerta",
      href: "/equipe/estoque",
      action: "Ver estoque",
      tone: queues.lowStock.length ? "warn" : "good",
    },
    {
      priority: queues.blockedPatients.length ? "Alta" : "Ok",
      label: "Pacientes bloqueados",
      detail: queues.blockedPatients[0]
        ? `${queues.blockedPatients.length} paciente(s) sem elegibilidade. Primeiro: ${queues.blockedPatients[0].name}.`
        : "Nenhum paciente bloqueado na leitura atual.",
      reference: queues.blockedPatients[0]?.name || "-",
      sla: queues.blockedPatients[0] ? "Resolver antes do catalogo" : "Sem bloqueio",
      href: "/equipe/pacientes",
      action: "Ver pacientes",
      tone: queues.blockedPatients.length ? "danger" : "good",
    },
    {
      priority: queues.expiringPatients.length ? "Media" : "Ok",
      label: "Validades proximas",
      detail: queues.expiringPatients[0]
        ? `${queues.expiringPatients.length} paciente(s) com receita ou carteirinha em ate 30 dias.`
        : "Receitas e carteirinhas sem alerta de 30 dias.",
      reference: queues.expiringPatients[0]?.name || "-",
      sla: queues.expiringPatients[0] ? "Ate 30 dias" : "Sem vencimento proximo",
      href: "/equipe/pacientes",
      action: "Ver validade",
      tone: queues.expiringPatients.length ? "warn" : "good",
    },
    {
      priority: activeReservations.length ? "Media" : "Ok",
      label: "Reservas ativas",
      detail: activeReservations[0]
        ? `${activeReservations.length} reserva(s) segurando estoque. Proxima: ${activeReservations[0].orderId}.`
        : "Nenhuma reserva ativa segurando estoque agora.",
      reference: activeReservations[0]?.orderId || "-",
      sla: activeReservations[0]
        ? formatDateTime(activeReservations[0].expiresAt)
        : "Sem reserva ativa",
      href: "/equipe/pedidos",
      action: "Ver reservas",
      tone: activeReservations.length ? "warn" : "good",
    },
  ];
}

function buildQueues(dashboard) {
  if (!dashboard) {
    return {
      pendingPayments: [],
      paidFulfillment: [],
      blockedPatients: [],
      expiringPatients: [],
      lowStock: [],
    };
  }
  return {
    pendingPayments: dashboard.payments.filter((payment) => payment.status === "pending"),
    paidFulfillment: dashboard.orders.filter((order) =>
      ["paid_pending_fulfillment", "separating", "ready_to_ship"].includes(order.status),
    ),
    blockedPatients: dashboard.patients.filter((patient) => !patient.eligibility.allowed),
    expiringPatients: dashboard.patients.filter(
      (patient) =>
        Math.min(daysUntil(patient.prescriptionExpiresAt), daysUntil(patient.cardExpiresAt)) <= 30,
    ),
    lowStock: dashboard.products.filter(
      (product) => product.availableStock <= (product.lowStockThreshold || 5),
    ),
  };
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
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function daysUntil(value) {
  const date = new Date(`${value}T12:00:00-03:00`);
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}
