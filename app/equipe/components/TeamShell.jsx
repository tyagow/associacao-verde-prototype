"use client";

import Brand from "../../components/Brand";
import styles from "./TeamShell.module.css";

const ROLE_LABELS = {
  admin: "Administrador",
  operations: "Operacoes",
  stock: "Estoque",
  fulfillment: "Fulfillment",
  support: "Suporte",
};

/**
 * Phase 3 — Team app shell. Sidebar (Comando, Pacientes, Estoque, Pedidos,
 * Fulfillment, Suporte, Admin, Auditoria) with badge counts driven by the
 * /api/team/dashboard payload. Brand seal + role label + Cmd-K hint in
 * topbar; logout + password rotation in the footer.
 *
 * Mounted today only by /equipe (TeamCommand). Future phases (4-9) will
 * migrate sibling routes to invoke this shell as well; the passthrough
 * layout at app/equipe/layout.jsx is the integration seam.
 */
export default function TeamShell({
  session,
  dashboard,
  currentRoute,
  onLogout,
  onOpenProfile,
  busy = false,
  children,
}) {
  const counts = computeBadgeCounts(dashboard);
  const items = [
    { href: "/equipe", label: "Comando", key: "command" },
    { href: "/equipe/pacientes", label: "Pacientes", key: "patients" },
    { href: "/equipe/estoque", label: "Estoque", key: "stock" },
    { href: "/equipe/pedidos", label: "Pedidos", key: "orders" },
    { href: "/equipe/fulfillment", label: "Fulfillment", key: "fulfillment" },
    { href: "/equipe/suporte", label: "Suporte", key: "support" },
    { href: "/admin", label: "Admin", key: "admin" },
    { href: "/admin#auditoria", label: "Auditoria", key: "audit" },
  ];

  const user = session?.user;
  const role = ROLE_LABELS[user?.role] || "Equipe";

  return (
    <div className={styles.txShell}>
      <header className={styles.txTopbar} aria-label="Topbar da operacao">
        <div className={styles.txTopbarLeft}>
          <Brand />
          <span className={styles.txRoleChip}>
            <strong>{user?.name || "Equipe Apoiar"}</strong>
            <span aria-hidden>·</span>
            <span>{role}</span>
          </span>
        </div>
        <div className={styles.txTopbarRight}>
          <span className={styles.txKbdHint} aria-label="Atalho da paleta de comandos">
            <kbd>{platformMeta()}</kbd>
            <kbd>K</kbd>
            <span>paleta</span>
          </span>
        </div>
      </header>

      <nav className={styles.txSidebar} aria-label="Areas da equipe">
        {items.map((item) => {
          const badge = counts[item.key];
          const isActive = isCurrent(currentRoute, item.href);
          return (
            <a
              key={item.href}
              href={item.href}
              className={isActive ? "active" : undefined}
              aria-current={isActive ? "page" : undefined}
            >
              <span>{item.label}</span>
              {badge && badge.value > 0 ? (
                <span
                  className={`${styles.txBadge}${badge.tone ? " " + badge.tone : ""}`}
                  aria-label={`${badge.value} pendente(s)`}
                >
                  {badge.value}
                </span>
              ) : null}
            </a>
          );
        })}
      </nav>

      <main className={styles.txMain}>{children}</main>

      <footer className={styles.txFooter} aria-label="Rodape da equipe">
        <div className={styles.txFooterMeta}>
          <span>
            {user?.email || "email nao informado"} · {role}
          </span>
          <span>Apoiar Brasil — operacao privada</span>
        </div>
        <div className={styles.txFooterActions}>
          {onOpenProfile ? (
            <button type="button" className="mini" disabled={busy} onClick={onOpenProfile}>
              Perfil e senha
            </button>
          ) : null}
          {onLogout ? (
            <button type="button" className="mini" disabled={busy} onClick={onLogout}>
              Sair
            </button>
          ) : null}
        </div>
      </footer>
    </div>
  );
}

function isCurrent(currentRoute, href) {
  if (!currentRoute) return false;
  if (href === "/equipe") return currentRoute === "/equipe";
  if (href.startsWith("/admin#")) return currentRoute.startsWith("/admin");
  return currentRoute === href || currentRoute.startsWith(href + "/");
}

function platformMeta() {
  if (typeof navigator === "undefined") return "Ctrl";
  return /mac/i.test(navigator.platform) ? "⌘" : "Ctrl";
}

function computeBadgeCounts(dashboard) {
  if (!dashboard) return {};
  const pendingPayments = (dashboard.payments || []).filter((p) => p.status === "pending").length;
  const fulfillment = (dashboard.orders || []).filter((order) =>
    ["paid_pending_fulfillment", "separating", "ready_to_ship"].includes(order.status),
  ).length;
  const blocked = (dashboard.patients || []).filter((p) => !p.eligibility?.allowed).length;
  const lowStock = (dashboard.products || []).filter(
    (p) => p.availableStock <= (p.lowStockThreshold || 5),
  ).length;
  const support = (dashboard.supportTickets || []).filter(
    (t) => t.status === "open" || t.status === "pending",
  ).length;
  return {
    command: { value: pendingPayments + blocked, tone: pendingPayments + blocked ? "warn" : "" },
    patients: { value: blocked, tone: blocked ? "danger" : "" },
    stock: { value: lowStock, tone: lowStock ? "warn" : "" },
    orders: { value: pendingPayments, tone: pendingPayments ? "warn" : "" },
    fulfillment: { value: fulfillment, tone: fulfillment ? "warn" : "" },
    support: { value: support, tone: support ? "warn" : "" },
    admin: { value: 0, tone: "" },
    audit: { value: 0, tone: "" },
  };
}
