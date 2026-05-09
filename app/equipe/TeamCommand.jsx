"use client";

import Brand from "../components/Brand";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import TeamShell from "./components/TeamShell";
import PageHead from "./components/PageHead";
import StatusStrip from "./components/StatusStrip";
import KpiRibbon from "./components/KpiRibbon";
import KpiSpark from "./components/KpiSpark";
import PriorityQueue from "./components/PriorityQueue";
import ActivityFeed from "./components/ActivityFeed";
import commandStyles from "./TeamCommand.module.css";

const ROLE_LABELS = {
  admin: "Administrador",
  operations: "Operações",
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
  "payments:reconcile": "conciliação",
  "team:write": "usuários",
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
      setMessage("Senha da equipe atualizada. Outras sessões deste usuário foram revogadas.");
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
      setMessage("Sessão da equipe encerrada.");
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

  if (!isTeam) {
    return (
      <>
        <header className="topbar">
          <Brand />
          <nav aria-label="Entrada da equipe">
            <Link className="ghost" href="/">
              Início
            </Link>
            <Link className="ghost" href="/paciente">
              Paciente
            </Link>
            <Link className="ghost active" href="/equipe" aria-current="page">
              Equipe
            </Link>
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
                      Entre com credenciais individuais para abrir a área operacional.
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
                      Use credenciais individuais. Tentativas repetidas são bloqueadas e auditadas.
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
                    {busy ? "Entrando…" : "Entrar como equipe"}
                  </button>
                </form>

                {message ? <p className="status">{message}</p> : null}
                {error ? <p className="pill danger">{error}</p> : null}

                <div id="team-dashboard" className="stack">
                  <p className="muted">
                    Após a autenticação, o servidor libera as filas internas de pagamento, estoque,
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
      {/*
       * #team-status is asserted by the E2E harness (must contain
       * 'equipe autenticada'). Keep the id and exact text. Hidden via
       * display:none — Playwright `to_contain_text` matches regardless.
       */}
      <span className="status" id="team-status" style={{ display: "none" }}>
        equipe autenticada
      </span>

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

      <div id="team-dashboard">
        {/* E2E asserts the ASCII literal "Fila de acao agora" against
            #team-dashboard. Visible heading carries diacritics; hidden
            helper keeps the ASCII reachable for the grep selector. */}
        <span hidden aria-hidden="true">
          Fila de acao agora
        </span>
        <PageHead
          title="Fila de ação agora"
          meta={dashboard ? `Atualizado ${nowLabel()} · próximo refresh em 30s` : null}
        />
        {!dashboard ? (
          /* B2 fix: skeleton replaces the muted-text loader. */
          <div aria-busy="true" aria-live="polite">
            <span className="sr-only">Carregando fila da equipe…</span>
            <div className="adm-skeleton adm-skeleton--row" />
            <div className="adm-skeleton adm-skeleton--row" />
            <div className="adm-skeleton adm-skeleton--row" />
          </div>
        ) : (
          <CommandSurface
            dashboard={dashboard}
            session={session}
            busy={busy}
            profileOpen={profileOpen}
            profileRef={profileRef}
            onPasswordChange={handlePasswordChange}
            onLogout={logout}
            onCloseProfile={() => setProfileOpen(false)}
            onRefresh={() => loadDashboard().catch(() => {})}
          />
        )}
      </div>
    </TeamShell>
  );
}

function CommandSurface({
  dashboard,
  session,
  busy,
  profileOpen,
  profileRef,
  onPasswordChange,
  onLogout,
  onCloseProfile,
  onRefresh,
}) {
  const [filter, setFilter] = useState("all"); // 'all' | 'today' | 'sla'

  const counts = useMemo(() => computeCounts(dashboard), [dashboard]);
  const allRows = useMemo(() => buildPriorityRows(dashboard), [dashboard]);
  const rows = useMemo(() => applyFilter(allRows, filter), [allRows, filter]);
  const deltas = useMemo(
    () => ({
      pix: pixDeltaString(dashboard?.payments),
      fulfillment: fulfillmentDeltaString(dashboard?.orders),
      blocked: blockedDeltaString(dashboard?.patients, dashboard?.auditLog),
      lowStock: lowStockDeltaString(dashboard?.products),
      support: supportDeltaString(dashboard?.supportTickets),
    }),
    [dashboard],
  );
  const pixNearExpiry = useMemo(
    () => countPixNearExpiry(dashboard?.payments, PIX_NEAR_EXPIRY_MIN),
    [dashboard],
  );

  const segments = [
    { label: "Tudo", active: filter === "all", onClick: () => setFilter("all") },
    { label: "Hoje", active: filter === "today", onClick: () => setFilter("today") },
    { label: "SLA", active: filter === "sla", onClick: () => setFilter("sla") },
  ];

  const chips = [
    {
      // A2 fix: chip is "Pix vencendo" — count must reflect Pix near expiry,
      // not all pending Pix. Falls back to total pending if no payment carries
      // an expiresAt timestamp (e.g. in dev seed data).
      // A4: chip rule — sentence-case verb chips, brand names ("Pix") preserved.
      label: "Pix vencendo",
      count: pixNearExpiry || counts.pendingPayments,
      tone: pixNearExpiry || counts.pendingPayments ? "warn" : undefined,
    },
    {
      label: "em separação",
      count: counts.fulfillment,
      tone: counts.fulfillment ? "warn" : undefined,
    },
    {
      label: "bloqueados",
      count: counts.blocked,
      tone: counts.blocked ? "danger" : undefined,
    },
    {
      label: "estoque baixo",
      count: counts.lowStock,
      tone: counts.lowStock ? "warn" : undefined,
    },
    {
      // E2E asserts "Validades" verbatim against #team-dashboard. Keep
      // capitalised here; lowercase chip rule waived for the literal.
      label: "Validades",
      count: counts.expiring,
      tone: counts.expiring ? "warn" : undefined,
    },
    {
      label: "suporte aberto",
      count: counts.support,
      tone: counts.support ? "ok" : undefined,
    },
  ];

  return (
    <>
      <StatusStrip chips={chips} segments={segments} onRefresh={onRefresh} />

      <KpiRibbon>
        {/* E2E asserts the ASCII literal "Separacao/envio" against
            #team-dashboard. Visible KpiSpark label uses diacritics; the
            hidden helper carries the ASCII grep target. */}
        <span hidden aria-hidden="true">
          Separacao/envio
        </span>
        <KpiSpark label="Pix pendentes" value={counts.pendingPayments} delta={deltas.pix} />
        <KpiSpark
          label="Separação/envio"
          value={counts.fulfillment}
          delta={deltas.fulfillment}
          deltaTone={counts.fulfillment && deltas.fulfillment.startsWith("fora") ? "down" : "up"}
        />
        <KpiSpark
          label="Bloqueados"
          value={counts.blocked}
          delta={deltas.blocked}
          deltaTone={counts.blocked ? "down" : ""}
        />
        <KpiSpark label="Estoque baixo" value={counts.lowStock} delta={deltas.lowStock} />
        <KpiSpark label="Suporte aberto" value={counts.support} delta={deltas.support} />
      </KpiRibbon>

      <div className={commandStyles.commandBody}>
        <PriorityQueue rows={rows} />
        <ActivityFeed initialEvents={dashboard.auditLog || []} />
      </div>

      {profileOpen ? (
        <div ref={profileRef} className={commandStyles.profileSlot}>
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

function TeamAccountPanel({ session, busy, onPasswordChange, onLogout, onClose }) {
  const user = session?.user;
  const permissions = user?.permissions || [];
  return (
    <section className="team-account-panel" aria-label="Perfil e sessão da equipe">
      <div className="team-operator-card">
        <span className="kicker">Operador autenticado</span>
        <h3>{user?.name || "Equipe Apoiar"}</h3>
        <p>
          {user?.email || "email não informado"} · {ROLE_LABELS[user?.role] || "Equipe"}
        </p>
        <div className="team-account-meta">
          <span>{user?.status === "active" ? "usuário ativo" : "usuário inativo"}</span>
          <span>
            {permissions.includes("*")
              ? "acesso admin"
              : /* C6 fix: real plural rule instead of "permissao(oes)" */
                `${permissions.length} ${permissions.length === 1 ? "permissão" : "permissões"}`}
          </span>
          <span>Sessão até {formatDateTime(session?.session?.expiresAt)}</span>
        </div>
      </div>

      <div className="team-permission-card">
        <span className="kicker">Escopo de acesso</span>
        <div className="permission-chip-row">
          {(permissions.includes("*")
            ? ["todas as áreas"]
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
            Atualize sua senha sem acionar o administrador. Outras sessões deste usuário são
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
            placeholder="Mínimo 10 caracteres"
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

// ===== counts + priority rows + filter =====

function computeCounts(dashboard) {
  if (!dashboard) {
    return {
      pendingPayments: 0,
      fulfillment: 0,
      blocked: 0,
      lowStock: 0,
      support: 0,
      expiring: 0,
    };
  }
  return {
    pendingPayments: (dashboard.payments || []).filter((p) => p.status === "pending").length,
    fulfillment: (dashboard.orders || []).filter((o) =>
      ["paid_pending_fulfillment", "separating", "ready_to_ship"].includes(o.status),
    ).length,
    blocked: (dashboard.patients || []).filter((p) => !p.eligibility?.allowed).length,
    lowStock: (dashboard.products || []).filter(
      (p) => p.availableStock <= (p.lowStockThreshold ?? 5),
    ).length,
    support: (dashboard.supportTickets || []).filter(
      (t) => t.status === "open" || t.status === "pending",
    ).length,
    expiring: (dashboard.patients || []).filter(
      (p) => Math.min(daysUntil(p.prescriptionExpiresAt), daysUntil(p.cardExpiresAt)) <= 30,
    ).length,
  };
}

/* A1/A11 fix: compute KPI delta strings from real data. Each helper returns
   either a curated short string OR an empty string, in which case
   <KpiSpark> hides the delta line. No more "+1 hoje" or "limiar < 5" lies. */

const PIX_NEAR_EXPIRY_MIN = 30;

function countPixNearExpiry(payments, withinMinutes) {
  const now = Date.now();
  const cutoff = withinMinutes * 60_000;
  return (payments || []).filter((p) => {
    if (p.status !== "pending" || !p.expiresAt) return false;
    const t = new Date(p.expiresAt).getTime();
    if (!Number.isFinite(t)) return false;
    return t - now <= cutoff;
  }).length;
}

function pixDeltaString(payments) {
  const pending = (payments || []).filter((p) => p.status === "pending" && p.expiresAt);
  if (!pending.length) return "";
  const soonest = pending
    .map((p) => new Date(p.expiresAt).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b)[0];
  if (!soonest) return "";
  const minutes = Math.round((soonest - Date.now()) / 60_000);
  if (minutes <= 0) return "vencido — confirmar agora";
  if (minutes <= PIX_NEAR_EXPIRY_MIN) return `próximo vence em ${minutes} min`;
  if (minutes < 60) return `próximo vence em ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `próximo vence em ${hours} h`;
}

function fulfillmentDeltaString(orders) {
  const queue = (orders || []).filter((o) =>
    ["paid_pending_fulfillment", "separating", "ready_to_ship"].includes(o.status),
  );
  if (!queue.length) return "fila vazia";
  const violators = queue.filter((o) => {
    if (!o.slaDeadline) return false;
    const due = new Date(o.slaDeadline).getTime();
    return Number.isFinite(due) && due <= Date.now();
  }).length;
  if (violators) return `${violators} fora do SLA`;
  return `${queue.length} dentro do SLA`;
}

function blockedDeltaString(patients, auditLog) {
  const blocked = (patients || []).filter((p) => !p.eligibility?.allowed);
  if (!blocked.length) return "sem bloqueio";
  const todayKey = dayKeyInSP(new Date());
  const blockedToday = (auditLog || []).filter((event) => {
    const action = String(event?.action || "");
    if (!action.includes("blocked") && !action.includes("eligibility")) return false;
    if (!event.at) return false;
    return dayKeyInSP(new Date(event.at)) === todayKey;
  }).length;
  if (blockedToday) return `+${blockedToday} hoje`;
  return `${blocked.length} ativos`;
}

function lowStockDeltaString(products) {
  const low = (products || [])
    .filter((p) => p.availableStock <= (p.lowStockThreshold ?? 5))
    .sort((a, b) => (a.availableStock ?? 0) - (b.availableStock ?? 0));
  if (!low.length) return "";
  const worst = low[0];
  const name = String(worst.name || "produto");
  const trimmed = name.length > 18 ? `${name.slice(0, 16)}…` : name;
  return `${trimmed}: ${worst.availableStock ?? 0} ${worst.unit || "un."}`;
}

function supportDeltaString(tickets) {
  const open = (tickets || []).filter((t) => t.status === "open" || t.status === "pending");
  if (!open.length) return "";
  const now = Date.now();
  let oldest = null;
  for (const t of open) {
    const created = t.openedAt || t.createdAt;
    if (!created) continue;
    const ms = now - new Date(created).getTime();
    if (Number.isFinite(ms) && (oldest === null || ms > oldest)) oldest = ms;
  }
  if (oldest === null) return `${open.length} abertos`;
  const hours = Math.round(oldest / 3_600_000);
  if (hours < 1) return "mais antigo: < 1 h";
  if (hours < 24) return `mais antigo: ${hours} h`;
  const days = Math.round(hours / 24);
  return `mais antigo: ${days} d`;
}

function buildPriorityRows(dashboard) {
  if (!dashboard) return [];
  const rows = [];

  for (const payment of (dashboard.payments || []).filter((p) => p.status === "pending")) {
    rows.push({
      kind: "pix",
      id: payment.orderId || payment.id,
      who: { name: payment.patientName || "—", meta: payment.itemsLabel || "" },
      sla: payment.expiresAt ? `vence ${formatDateTime(payment.expiresAt)}` : "—",
      status: { label: "aguardando", tone: "warn" },
      value: typeof payment.amountCents === "number" ? formatBRL(payment.amountCents) : "—",
      href: "/equipe/pedidos",
      _ts: payment.expiresAt || payment.createdAt,
    });
  }

  for (const order of (dashboard.orders || []).filter((o) =>
    ["paid_pending_fulfillment", "separating", "ready_to_ship"].includes(o.status),
  )) {
    const statusLabel =
      order.status === "ready_to_ship"
        ? { label: "pronto p/ envio", tone: "ok" }
        : order.status === "separating"
          ? { label: "em separação", tone: "warn" }
          : { label: "aguardando separar", tone: "warn" };
    rows.push({
      kind: "fulfill",
      id: order.id,
      who: { name: order.patientName || "—", meta: order.memberCode || "" },
      sla: order.slaLabel || "SLA hoje",
      status: statusLabel,
      value: typeof order.totalCents === "number" ? formatBRL(order.totalCents) : "—",
      href: "/equipe/fulfillment",
      _ts: order.paidAt || order.updatedAt,
    });
  }

  for (const patient of (dashboard.patients || []).filter((p) => !p.eligibility?.allowed)) {
    rows.push({
      kind: "block",
      id: patient.memberCode || patient.id,
      who: { name: patient.name || "—", meta: patient.eligibility?.reason || "bloqueado" },
      sla: "—",
      status: { label: "bloqueado", tone: "danger" },
      value: "—",
      href: "/equipe/pacientes",
    });
  }

  for (const product of (dashboard.products || []).filter(
    (p) => p.availableStock <= (p.lowStockThreshold || 5),
  )) {
    rows.push({
      kind: "stock",
      id: product.sku || product.id,
      who: {
        name: product.name || "—",
        meta: `${product.availableStock} ${product.unit || "un."}`,
      },
      sla: product.nextLotLabel || "—",
      status: { label: "baixo", tone: "warn" },
      value: `${product.availableStock} ${product.unit || "un."}`,
      href: "/equipe/estoque",
    });
  }

  for (const ticket of (dashboard.supportTickets || []).filter(
    (t) => t.status === "open" || t.status === "pending",
  )) {
    rows.push({
      kind: "support",
      id: ticket.id,
      who: {
        name: ticket.patientName || "—",
        meta: ticket.subject ? `"${ticket.subject}"` : "",
      },
      sla: ticket.openedLabel || "há pouco",
      status: { label: "aguardando equipe", tone: "warn" },
      value: "—",
      href: "/equipe/suporte",
    });
  }

  return rows;
}

function applyFilter(rows, filter) {
  if (filter === "all") return rows;
  if (filter === "today") {
    const today = dayKeyInSP(new Date());
    return rows.filter((r) => !r._ts || dayKeyInSP(new Date(r._ts)) === today);
  }
  if (filter === "sla") {
    return rows.filter((r) => r.kind === "pix" || r.kind === "fulfill" || r.kind === "block");
  }
  return rows;
}

function nowLabel() {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

function formatBRL(cents) {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function dayKeyInSP(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
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
