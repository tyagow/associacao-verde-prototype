"use client";

import { useCallback, useEffect, useState } from "react";

import Brand from "../../components/Brand";
import CommandPalette from "./CommandPalette";
import { pluralize } from "./pluralize.js";
import styles from "./TeamShell.module.css";

const ROLE_LABELS = {
  admin: "Administrador",
  operations: "Operações",
  stock: "Estoque",
  fulfillment: "Fulfillment",
  support: "Suporte",
};

/**
 * Phase 0 — Team app shell (Direction B chassis).
 *
 * Sidebar (Operação / Compliance navheads) collects the 8 internal routes
 * (Comando, Pacientes, Estoque, Pedidos, Fulfillment, Suporte, Admin,
 * Auditoria) with badge counts driven by the /api/team/dashboard payload.
 * Topbar carries breadcrumb + global search (⌘K) + role chip. Footer band
 * is folded into the sidebar bottom and exposes Perfil / Sair.
 *
 * E2E selectors preserved verbatim:
 *   - data-cmdk-trigger on the global search button
 *   - all 8 sidebar hrefs (see navGroups below)
 *   - ⌘K / Ctrl+K keydown binding
 *   - <CommandPalette> mount
 *   - #team-status is owned by app/equipe/TeamCommand.jsx (rendered as
 *     children into <main className={styles.main}>) — DO NOT add it here.
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
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Global ⌘K / Ctrl+K binding. Registered while the shell is mounted, which
  // is every /equipe/* route (Phase 3 onwards). Stops the browser's default
  // (Safari/Chrome use ⌘K for the address bar) and toggles the palette.
  const handleKeyDown = useCallback((event) => {
    if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
      const key = (event.key || "").toLowerCase();
      if (key === "k") {
        event.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const navGroups = [
    {
      head: "Operação",
      items: [
        { href: "/equipe", label: "Comando", key: "command" },
        { href: "/equipe/pacientes", label: "Pacientes", key: "patients" },
        { href: "/equipe/estoque", label: "Estoque", key: "stock" },
        { href: "/equipe/cultivo", label: "Cultivo", key: "cultivation" },
        { href: "/equipe/pedidos", label: "Pedidos", key: "orders" },
        { href: "/equipe/fulfillment", label: "Fulfillment", key: "fulfillment" },
        { href: "/equipe/suporte", label: "Suporte", key: "support" },
      ],
    },
    {
      head: "Compliance",
      items: [
        { href: "/admin", label: "Admin", key: "admin" },
        { href: "/admin#auditoria", label: "Auditoria", key: "audit" },
      ],
    },
  ];

  const user = session?.user;
  const role = ROLE_LABELS[user?.role] || "Equipe";
  const breadcrumbLabel = currentBreadcrumb(currentRoute, navGroups);
  const platformKey = platformMeta();

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar} aria-label="Navegação da equipe">
        <Brand />

        {navGroups.map((group) => (
          <nav key={group.head} className={styles.navGroup} aria-label={group.head}>
            <span className={styles.navhead}>{group.head}</span>
            {group.items.map((item) => {
              const badge = counts[item.key];
              const isActive = isCurrent(currentRoute, item.href);
              const linkClass = [styles.navLink, isActive ? "active" : null]
                .filter(Boolean)
                .join(" ");
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={linkClass}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span>{item.label}</span>
                  {badge && badge.value > 0 ? (
                    <span
                      className={[styles.badge, badge.tone ? badge.tone : null]
                        .filter(Boolean)
                        .join(" ")}
                      aria-label={pluralize(badge.value, "pendente", "pendentes")}
                    >
                      {badge.value}
                    </span>
                  ) : null}
                </a>
              );
            })}
          </nav>
        ))}

        <div className={styles.footerBand}>
          <span>{user?.email ?? ""}</span>
          <span className="actions">
            {onOpenProfile ? (
              <button type="button" disabled={busy} onClick={onOpenProfile}>
                Perfil
              </button>
            ) : null}
            {onLogout ? (
              <button type="button" disabled={busy} onClick={onLogout}>
                Sair
              </button>
            ) : null}
          </span>
        </div>
      </aside>

      <header className={styles.topbar} aria-label="Topbar da operação">
        <div className={styles.breadcrumb}>
          <span>Equipe</span>
          <span className={styles.sep} aria-hidden>
            /
          </span>
          <strong>{breadcrumbLabel}</strong>
        </div>

        <button
          type="button"
          className={styles.globalSearch}
          data-cmdk-trigger
          aria-label="Abrir paleta de comandos"
          onClick={() => setPaletteOpen(true)}
        >
          <span aria-hidden className={styles.searchIcon}>
            ⌕
          </span>
          <span className={styles.searchInput}>Buscar paciente, pedido, lote, suporte…</span>
          <span className={styles.kbd}>{platformKey}K</span>
        </button>

        <span className={styles.roleChip}>
          <strong>{user?.name || "Equipe Apoiar"}</strong>
          <span aria-hidden>·</span>
          <span>{role}</span>
        </span>
      </header>

      <main className={styles.main}>{children}</main>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} dashboard={dashboard} />
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
    (p) => p.availableStock <= (p.lowStockThreshold ?? 5),
  ).length;
  const cultivation = (dashboard.cultivationBatches || []).filter(
    (b) => b.status !== "stocked",
  ).length;
  const support = (dashboard.supportTickets || []).filter(
    (t) => t.status === "open" || t.status === "pending",
  ).length;
  return {
    command: { value: pendingPayments + blocked, tone: pendingPayments + blocked ? "warn" : "" },
    patients: { value: blocked, tone: blocked ? "danger" : "" },
    stock: { value: lowStock, tone: lowStock ? "warn" : "" },
    /* C7 fix: cultivation badge stays neutral while batches are merely
       active. "ok" was misleading because an in-progress grow isn't a
       success state — it's just work in flight. */
    cultivation: { value: cultivation, tone: "" },
    orders: { value: pendingPayments, tone: pendingPayments ? "warn" : "" },
    fulfillment: { value: fulfillment, tone: fulfillment ? "warn" : "" },
    support: { value: support, tone: support ? "warn" : "" },
    admin: { value: 0, tone: "" },
    audit: { value: 0, tone: "" },
  };
}

function currentBreadcrumb(currentRoute, navGroups) {
  if (!currentRoute) return "Comando";
  for (const group of navGroups) {
    for (const item of group.items) {
      if (isCurrent(currentRoute, item.href)) return item.label;
    }
  }
  return "Comando";
}
