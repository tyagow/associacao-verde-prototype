"use client";

import { Command } from "cmdk";
import { useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";

import styles from "./CommandPalette.module.css";

/**
 * Phase 8 — Command palette ⌘K.
 *
 * Mounted by TeamShell on every /equipe/* route. Pulls live patients +
 * orders out of the dashboard payload (the same payload TeamShell already
 * fetches), exposes hard-coded navigation jumps + contextual actions,
 * and keeps recents/starred in localStorage so common targets surface
 * first across page reloads.
 *
 * No server changes. Selecting an item resolves to a deep-link href
 * (navigation / "open audit for X") via window.location, which keeps
 * routing simple and avoids coupling to any specific App Router import.
 */

const STORAGE_RECENTS = "tx.cmdk.recents.v1";
const STORAGE_STARRED = "tx.cmdk.starred.v1";
const RECENT_LIMIT = 8;

const NAV_ITEMS = [
  { id: "nav:command", label: "Comando da operacao", href: "/equipe", hint: "/equipe" },
  { id: "nav:patients", label: "Pacientes", href: "/equipe/pacientes", hint: "/equipe/pacientes" },
  { id: "nav:stock", label: "Estoque", href: "/equipe/estoque", hint: "/equipe/estoque" },
  { id: "nav:orders", label: "Pedidos e Pix", href: "/equipe/pedidos", hint: "/equipe/pedidos" },
  {
    id: "nav:fulfillment",
    label: "Fulfillment",
    href: "/equipe/fulfillment",
    hint: "/equipe/fulfillment",
  },
  { id: "nav:support", label: "Suporte", href: "/equipe/suporte", hint: "/equipe/suporte" },
  { id: "nav:admin", label: "Admin / Readiness", href: "/admin", hint: "/admin" },
  { id: "nav:audit", label: "Auditoria", href: "/admin#auditoria", hint: "/admin#auditoria" },
];

export default function CommandPalette({ open, onOpenChange, dashboard }) {
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState([]);
  const [starred, setStarred] = useState([]);
  const reduceMotion = useReducedMotion();

  // Hydrate recents + starred from localStorage on first mount (client-only).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const r = JSON.parse(window.localStorage.getItem(STORAGE_RECENTS) || "[]");
      const s = JSON.parse(window.localStorage.getItem(STORAGE_STARRED) || "[]");
      if (Array.isArray(r)) setRecents(r);
      if (Array.isArray(s)) setStarred(s);
    } catch {
      // Corrupt storage: ignore and start fresh.
    }
  }, []);

  // Reset query each time the palette opens so users don't see stale text.
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const persistRecents = useCallback((next) => {
    setRecents(next);
    try {
      window.localStorage.setItem(STORAGE_RECENTS, JSON.stringify(next));
    } catch {
      // localStorage may be disabled (private mode); recents stays in memory.
    }
  }, []);

  const persistStarred = useCallback((next) => {
    setStarred(next);
    try {
      window.localStorage.setItem(STORAGE_STARRED, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const close = useCallback(() => {
    onOpenChange?.(false);
  }, [onOpenChange]);

  const runItem = useCallback(
    (item) => {
      // Record into recents (dedup, cap at RECENT_LIMIT).
      const compact = {
        id: item.id,
        label: item.label,
        hint: item.hint || "",
        href: item.href,
        kind: item.kind || "nav",
      };
      const next = [compact, ...recents.filter((r) => r.id !== compact.id)].slice(0, RECENT_LIMIT);
      persistRecents(next);
      close();
      if (item.href && typeof window !== "undefined") {
        window.location.href = item.href;
      }
    },
    [recents, persistRecents, close],
  );

  const toggleStar = useCallback(
    (item, event) => {
      event?.stopPropagation();
      const exists = starred.some((s) => s.id === item.id);
      const next = exists
        ? starred.filter((s) => s.id !== item.id)
        : [
            { id: item.id, label: item.label, hint: item.hint || "", href: item.href, kind: item.kind || "nav" },
            ...starred,
          ];
      persistStarred(next);
    },
    [starred, persistStarred],
  );

  const items = useMemo(() => buildItems(dashboard), [dashboard]);
  const starredIds = useMemo(() => new Set(starred.map((s) => s.id)), [starred]);
  const trimmedQuery = query.trim();

  if (!open) return null;

  return (
    <div
      className={styles.txOverlay}
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      data-reduce-motion={reduceMotion ? "true" : "false"}
    >
      <Command
        label="Paleta de comandos da equipe"
        className={styles.txDialog}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            close();
          }
        }}
        // Loop selection so arrow keys feel natural in a small palette.
        loop
      >
        <div className={styles.txHeader}>
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder="Buscar pacientes, pedidos, acoes ou areas..."
            className={styles.txInput}
            autoFocus
          />
          <span className={styles.txKbdHint} aria-hidden="true">
            <kbd>esc</kbd>
            fechar
          </span>
        </div>

        <Command.List className={styles.txList}>
          <Command.Empty className={styles.txEmpty}>
            Nada encontrado para &ldquo;{trimmedQuery}&rdquo;.
          </Command.Empty>

          {!trimmedQuery && starred.length > 0 ? (
            <Command.Group heading="Favoritos" className={styles.txGroup}>
              {starred.map((item) => (
                <PaletteItem
                  key={`star-${item.id}`}
                  item={item}
                  starred
                  onSelect={runItem}
                  onToggleStar={toggleStar}
                />
              ))}
            </Command.Group>
          ) : null}

          {!trimmedQuery && recents.length > 0 ? (
            <Command.Group heading="Recentes" className={styles.txGroup}>
              {recents.map((item) => (
                <PaletteItem
                  key={`recent-${item.id}`}
                  item={item}
                  starred={starredIds.has(item.id)}
                  onSelect={runItem}
                  onToggleStar={toggleStar}
                />
              ))}
            </Command.Group>
          ) : null}

          <Command.Group heading="Areas" className={styles.txGroup}>
            {items.navigation.map((item) => (
              <PaletteItem
                key={item.id}
                item={item}
                starred={starredIds.has(item.id)}
                onSelect={runItem}
                onToggleStar={toggleStar}
              />
            ))}
          </Command.Group>

          {items.actions.length > 0 ? (
            <Command.Group heading="Acoes" className={styles.txGroup}>
              {items.actions.map((item) => (
                <PaletteItem
                  key={item.id}
                  item={item}
                  starred={starredIds.has(item.id)}
                  onSelect={runItem}
                  onToggleStar={toggleStar}
                  asideLabel={item.aside}
                />
              ))}
            </Command.Group>
          ) : null}

          {items.patients.length > 0 ? (
            <Command.Group heading="Pacientes" className={styles.txGroup}>
              {items.patients.map((item) => (
                <PaletteItem
                  key={item.id}
                  item={item}
                  starred={starredIds.has(item.id)}
                  onSelect={runItem}
                  onToggleStar={toggleStar}
                  asideLabel={item.aside}
                />
              ))}
            </Command.Group>
          ) : null}

          {items.orders.length > 0 ? (
            <Command.Group heading="Pedidos" className={styles.txGroup}>
              {items.orders.map((item) => (
                <PaletteItem
                  key={item.id}
                  item={item}
                  starred={starredIds.has(item.id)}
                  onSelect={runItem}
                  onToggleStar={toggleStar}
                  asideLabel={item.aside}
                />
              ))}
            </Command.Group>
          ) : null}
        </Command.List>

        <div className={styles.txFooter} aria-hidden="true">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            navegar
          </span>
          <span>
            <kbd>↵</kbd>
            abrir
          </span>
          <span>
            <kbd>esc</kbd>
            fechar
          </span>
        </div>
      </Command>
    </div>
  );
}

function PaletteItem({ item, starred, onSelect, onToggleStar, asideLabel }) {
  // cmdk indexes items by their text content + the optional `value` prop.
  // We pack id+label+hint into the value so the fuzzy matcher can find a
  // patient by member code or an order by id.
  const value = `${item.id} ${item.label} ${item.hint || ""}`;
  return (
    <Command.Item
      value={value}
      className={styles.txItem}
      onSelect={() => onSelect(item)}
    >
      <span className={styles.txItemBody}>
        <span className={styles.txItemLabel}>{item.label}</span>
        {item.hint ? <span className={styles.txItemHint}>{item.hint}</span> : null}
      </span>
      <span className={styles.txItemAside}>
        {asideLabel ? <span>{asideLabel}</span> : null}
        <button
          type="button"
          className={styles.txStar}
          data-on={starred ? "true" : "false"}
          aria-label={starred ? "Remover favorito" : "Marcar como favorito"}
          aria-pressed={starred ? "true" : "false"}
          onClick={(event) => onToggleStar(item, event)}
          // cmdk would otherwise treat any pointer down inside the row as
          // selection — we want star clicks to act independently.
          onPointerDown={(event) => event.stopPropagation()}
        >
          {starred ? "★" : "☆"}
        </button>
      </span>
    </Command.Item>
  );
}

// ---------- builder ----------

function buildItems(dashboard) {
  const patients = (dashboard?.patients || []).slice(0, 30).map((patient) => ({
    id: `patient:${patient.id}`,
    label: patient.name || patient.memberCode || patient.id,
    hint: [patient.memberCode, patient.eligibility?.allowed ? "elegivel" : "bloqueado"]
      .filter(Boolean)
      .join(" · "),
    href: `/equipe/pacientes#${encodeURIComponent(patient.memberCode || patient.id)}`,
    kind: "patient",
    aside: patient.eligibility?.allowed ? "" : "bloqueado",
  }));

  const orders = (dashboard?.orders || []).slice(0, 30).map((order) => ({
    id: `order:${order.id}`,
    label: `Pedido ${order.id}`,
    hint: [order.patientName, order.status, order.paymentStatus].filter(Boolean).join(" · "),
    href: `/equipe/pedidos#${encodeURIComponent(order.id)}`,
    kind: "order",
    aside: order.status || "",
  }));

  const actions = [];

  // Reconcile Pix actions for any pending payment we surfaced.
  const pendingPayments = (dashboard?.payments || []).filter((p) => p.status === "pending");
  for (const payment of pendingPayments.slice(0, 10)) {
    actions.push({
      id: `action:reconcile:${payment.id}`,
      label: `Conciliar Pix ${payment.id}`,
      hint: payment.orderId ? `pedido ${payment.orderId}` : "Pix pendente",
      href: `/equipe/pedidos#${encodeURIComponent(payment.orderId || payment.id)}`,
      kind: "action",
      aside: "conciliar",
    });
  }

  // "Print labels for ready orders" — single action when there is at least one
  // ready_to_ship order.
  const readyOrders = (dashboard?.orders || []).filter((o) => o.status === "ready_to_ship");
  if (readyOrders.length > 0) {
    actions.push({
      id: "action:print-ready-labels",
      label: `Imprimir etiquetas (${readyOrders.length} pronto)`,
      hint: "Pedidos com status pronto para envio",
      href: "/equipe/fulfillment#ready",
      kind: "action",
      aside: "fulfillment",
    });
  }

  // "Reset invite for X" for blocked patients.
  for (const patient of (dashboard?.patients || []).filter((p) => !p.eligibility?.allowed).slice(0, 8)) {
    actions.push({
      id: `action:reset-invite:${patient.id}`,
      label: `Resetar convite de ${patient.name || patient.memberCode}`,
      hint: patient.memberCode || patient.id,
      href: `/equipe/pacientes#${encodeURIComponent(patient.memberCode || patient.id)}`,
      kind: "action",
      aside: "convite",
    });
  }

  // "Open audit for X" jumps to /admin#auditoria with the patient code as a
  // hash so the admin audit timeline (Phase 10) can use it as a filter once it
  // ships. Today the hash is harmless.
  for (const patient of (dashboard?.patients || []).slice(0, 6)) {
    actions.push({
      id: `action:audit:${patient.id}`,
      label: `Abrir auditoria de ${patient.name || patient.memberCode}`,
      hint: patient.memberCode || patient.id,
      href: `/admin#auditoria-${encodeURIComponent(patient.memberCode || patient.id)}`,
      kind: "action",
      aside: "auditoria",
    });
  }

  return {
    navigation: NAV_ITEMS,
    actions,
    patients,
    orders,
  };
}
