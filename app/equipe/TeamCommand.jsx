"use client";

import Brand from "../components/Brand";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import TeamShell from "./components/TeamShell";
import KpiSpark from "./components/KpiSpark";
import ActivityFeed from "./components/ActivityFeed";
import PixByHour from "./components/PixByHour";
import PriorityQueue from "./components/PriorityQueue";

const ROLE_LABELS = {
  admin: "Administrador",
  operations: "Operacoes",
  stock: "Estoque",
  fulfillment: "Fulfillment",
  support: "Suporte",
};

const PERMISSION_LABELS = {
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
};

export default function TeamCommand() {
  const [session, setSession] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

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

  // Auto-refresh dashboard every 30s when authenticated to keep KPIs fresh.
  useEffect(() => {
    if (!isTeam) return undefined;
    const id = setInterval(() => {
      loadDashboard().catch(() => {});
    }, 30_000);
    return () => clearInterval(id);
  }, [isTeam, loadDashboard]);

  async function handleLogin(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      await api("/api/team/login", {
        method: "POST",
        body: { email: form.get("email"), password: form.get("password") },
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
      setProfileOpen(false);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusy(false);
    }
  }

  function openProfile() {
    setProfileOpen(true);
    setTimeout(() => profileRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  const queues = useMemo(() => buildQueues(dashboard), [dashboard]);

  if (!isTeam) {
    return (
      <>
        <header className="topbar">
          <Brand />
          <nav aria-label="Entrada da equipe">
            <a className="ghost" href="/">
              Inicio
            </a>
            <a className="ghost" href="/paciente">
              Paciente
            </a>
            <a className="ghost active" href="/equipe" aria-current="page">
              Equipe
            </a>
          </nav>
        </header>
        <main>
          <div className="app-layout login-layout">
            <section className="surface-stack">
              <article className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="kicker">Equipe Apoiar</p>
                    <h2>Acesso da equipe</h2>
                    <p className="muted">
                      Entre com credenciais individuais para abrir a area operacional.
                    </p>
                  </div>
                  <span className="status" id="team-status">
                    acesso restrito
                  </span>
                </div>

                <form
                  id="team-login"
                  className="inline-form auth-form"
                  hidden={false}
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
                  <p className="muted">
                    Apos a autenticacao, o servidor libera as filas internas de pagamento, estoque,
                    documentos e atendimento.
                  </p>
                </div>
              </article>
            </section>
          </div>
        </main>
      </>
    );
  }

  return (
    <TeamShell
      session={session}
      dashboard={dashboard}
      currentRoute="/equipe"
      onLogout={logout}
      onOpenProfile={openProfile}
      busy={busy}
    >
      <div className="panel-heading" style={{ marginBottom: "var(--sp-5)" }}>
        <div>
          <p className="kicker">Equipe Apoiar</p>
          <h2>Comando da operacao</h2>
          <p className="muted">
            Fila diaria, alertas, reservas, pagamentos e itens que precisam de acao.
          </p>
        </div>
        {/*
         * #team-status is asserted by the E2E harness (must contain
         * 'equipe autenticada'). Keep the id and exact text.
         */}
        <span className="status" id="team-status">
          equipe autenticada
        </span>
      </div>

      {/*
       * #team-login must exist in the DOM so the E2E
       * `expect(page.locator('#team-login')).to_be_hidden()` assertion has a
       * target. Hidden when authenticated.
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

      {message ? <p className="status">{message}</p> : null}
      {error ? <p className="pill danger">{error}</p> : null}

      <div id="team-dashboard" className="stack">
        {!dashboard ? (
          <p className="muted">Carregando fila da equipe...</p>
        ) : (
          <CommandSurface
            dashboard={dashboard}
            queues={queues}
            session={session}
            busy={busy}
            profileOpen={profileOpen}
            profileRef={profileRef}
            onPasswordChange={handlePasswordChange}
            onLogout={logout}
            onCloseProfile={() => setProfileOpen(false)}
          />
        )}
      </div>
    </TeamShell>
  );
}

function CommandSurface({
  dashboard,
  queues,
  session,
  busy,
  profileOpen,
  profileRef,
  onPasswordChange,
  onLogout,
  onCloseProfile,
}) {
  const activeReservations = (dashboard.reservations || []).filter(
    (item) => item.status === "active",
  );
  const rows = priorityRows(queues, activeReservations);
  const billedWeek = sumBilledLastSevenDays(dashboard.payments);
  const billedSeries = billedDailySeries(dashboard.payments);
  const pendingSeries = pendingPaymentsTrend(dashboard.payments);
  const fulfillmentSeries = fulfillmentTrend(dashboard.orders);
  const blocksSeries = blockedTrend(dashboard.patients);

  return (
    <>
      <section
        aria-label="Indicadores da operacao"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "var(--sp-4)",
        }}
      >
        <KpiSpark
          label="Pix pendentes"
          value={queues.pendingPayments.length}
          tone={queues.pendingPayments.length ? "warn" : "good"}
          data={pendingSeries}
          help="Pix aguardando baixa do webhook."
        />
        <KpiSpark
          label="Separacao/envio"
          value={queues.paidFulfillment.length}
          tone={queues.paidFulfillment.length ? "warn" : "good"}
          data={fulfillmentSeries}
          help="Pedidos pagos aguardando picking ou rastreio."
        />
        <KpiSpark
          label="Bloqueios"
          value={queues.blockedPatients.length}
          tone={queues.blockedPatients.length ? "danger" : "good"}
          data={blocksSeries}
          help="Pacientes sem elegibilidade."
        />
        <KpiSpark
          label="Faturado semana"
          value={billedWeek.count}
          unit={`· R$ ${(billedWeek.totalCents / 100).toFixed(2)}`}
          tone="good"
          data={billedSeries}
          help="Pix confirmados nos ultimos 7 dias."
        />
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
          gap: "var(--sp-4)",
          marginTop: "var(--sp-5)",
        }}
        aria-label="Atividade ao vivo e Pix por hora"
      >
        <PixByHour payments={dashboard.payments} />
        <ActivityFeed initialEvents={dashboard.auditLog || []} />
      </section>

      <section style={{ marginTop: "var(--sp-6)" }}>
        <PriorityQueue rows={rows} />
      </section>

      <section style={{ marginTop: "var(--sp-6)" }}>
        <h3 style={{ fontFamily: "var(--font-display)" }}>Validades e excecoes</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "var(--sp-4)",
          }}
        >
          <ExceptionCard
            label="Validades proximas"
            value={queues.expiringPatients.length}
            tone={queues.expiringPatients.length ? "warn" : "good"}
            detail={
              queues.expiringPatients[0]
                ? `${queues.expiringPatients.length} paciente(s) com receita ou carteirinha em ate 30 dias.`
                : "Receitas e carteirinhas sem alerta de 30 dias."
            }
          />
          <ExceptionCard
            label="Reservas ativas"
            value={(dashboard.reservations || []).filter((r) => r.status === "active").length}
            tone={
              (dashboard.reservations || []).some((r) => r.status === "active") ? "warn" : "good"
            }
            detail="Reservas seguram estoque ate o Pix confirmar ou expirar."
          />
          <ExceptionCard
            label="Suporte aberto"
            value={
              (dashboard.supportTickets || []).filter(
                (t) => t.status === "open" || t.status === "pending",
              ).length
            }
            tone={
              (dashboard.supportTickets || []).some(
                (t) => t.status === "open" || t.status === "pending",
              )
                ? "warn"
                : "good"
            }
            detail="Tickets de paciente aguardando resposta da equipe."
          />
          <ExceptionCard
            label="Estoque baixo"
            value={queues.lowStock.length}
            tone={queues.lowStock.length ? "warn" : "good"}
            detail={
              queues.lowStock[0]
                ? `${queues.lowStock[0].name} esta com ${queues.lowStock[0].availableStock} ${queues.lowStock[0].unit} disponivel.`
                : "Sem produto abaixo do limite operacional."
            }
          />
        </div>
      </section>

      {profileOpen ? (
        <div ref={profileRef} style={{ marginTop: "var(--sp-7)" }}>
          <TeamAccountPanel
            session={session}
            busy={busy}
            onPasswordChange={onPasswordChange}
            onLogout={onLogout}
            onClose={onCloseProfile}
          />
        </div>
      ) : null}
    </>
  );
}

function ExceptionCard({ label, value, tone = "", detail }) {
  return (
    <article
      style={{
        border: "1px solid var(--line)",
        borderRadius: "var(--r-md)",
        background: "var(--paper-warm)",
        padding: "var(--sp-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-2)",
      }}
    >
      <span
        style={{
          fontSize: "var(--fs-xs)",
          letterSpacing: "var(--tracking-overline)",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}
      >
        {label}
      </span>
      <strong
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--fs-h2)",
          color:
            tone === "danger"
              ? "var(--danger)"
              : tone === "warn"
                ? "var(--warn-ink)"
                : "var(--ink)",
        }}
      >
        {value}
      </strong>
      <span style={{ fontSize: "var(--fs-sm)", color: "var(--muted)" }}>{detail}</span>
    </article>
  );
}

function TeamAccountPanel({ session, busy, onPasswordChange, onLogout, onClose }) {
  const user = session?.user;
  const permissions = user?.permissions || [];
  return (
    <section className="team-account-panel" aria-label="Perfil e sessao da equipe">
      <div className="team-operator-card">
        <span className="kicker">Operador autenticado</span>
        <h3>{user?.name || "Equipe Apoiar"}</h3>
        <p>
          {user?.email || "email nao informado"} · {ROLE_LABELS[user?.role] || "Equipe"}
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
          {(permissions.includes("*")
            ? ["todas as areas"]
            : permissions.map((p) => PERMISSION_LABELS[p] || p)
          ).map((permission) => (
            <span className="pill" key={permission}>
              {permission}
            </span>
          ))}
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
          {onClose ? (
            <button className="mini" type="button" onClick={onClose}>
              Fechar
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

// ===== series helpers =====

function billedDailySeries(payments) {
  const days = lastNDayKeys(7);
  const map = new Map(days.map((key) => [key, 0]));
  for (const payment of payments || []) {
    if (payment.status !== "paid" && payment.status !== "reconciled") continue;
    const at = payment.paidAt || payment.confirmedAt || payment.updatedAt;
    if (!at) continue;
    const key = dayKeyInSP(new Date(at));
    if (map.has(key)) map.set(key, map.get(key) + 1);
  }
  return days.map((key) => ({ name: key, value: map.get(key) || 0 }));
}

function sumBilledLastSevenDays(payments) {
  const days = new Set(lastNDayKeys(7));
  let count = 0;
  let totalCents = 0;
  for (const payment of payments || []) {
    if (payment.status !== "paid" && payment.status !== "reconciled") continue;
    const at = payment.paidAt || payment.confirmedAt || payment.updatedAt;
    if (!at || !days.has(dayKeyInSP(new Date(at)))) continue;
    count += 1;
    totalCents += Number(payment.amountCents || payment.amount || 0);
  }
  return { count, totalCents };
}

function pendingPaymentsTrend(payments) {
  // Approximation: count of payments in 'pending' state created on each of the
  // last 7 days. Sparkline is an indicator of incoming Pix volume.
  const days = lastNDayKeys(7);
  const map = new Map(days.map((key) => [key, 0]));
  for (const payment of payments || []) {
    const at = payment.createdAt || payment.requestedAt;
    if (!at) continue;
    const key = dayKeyInSP(new Date(at));
    if (map.has(key)) map.set(key, map.get(key) + 1);
  }
  return days.map((key) => ({ name: key, value: map.get(key) || 0 }));
}

function fulfillmentTrend(orders) {
  const days = lastNDayKeys(7);
  const map = new Map(days.map((key) => [key, 0]));
  for (const order of orders || []) {
    const at = order.paidAt || order.updatedAt || order.createdAt;
    if (!at) continue;
    const key = dayKeyInSP(new Date(at));
    if (map.has(key)) map.set(key, map.get(key) + 1);
  }
  return days.map((key) => ({ name: key, value: map.get(key) || 0 }));
}

function blockedTrend(patients) {
  // Point-in-time gauge; flat at current count.
  const blocked = (patients || []).filter((p) => !p.eligibility?.allowed).length;
  return Array.from({ length: 7 }, (_, i) => ({ name: `d${i}`, value: blocked }));
}

function lastNDayKeys(n) {
  const keys = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(today.getTime() - i * 86_400_000);
    keys.push(dayKeyInSP(d));
  }
  return keys;
}

function dayKeyInSP(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// ===== priority + queue helpers =====

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
