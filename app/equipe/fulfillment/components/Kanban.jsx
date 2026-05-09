"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragOverlay,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import KanbanColumn from "./KanbanColumn.jsx";
import OrderCard from "./OrderCard.jsx";
import styles from "./Kanban.module.css";

const COLUMNS = [
  { status: "paid_pending_fulfillment", label: "Aguardando separar", tone: "warn" },
  { status: "separating", label: "Em separação", tone: "warn" },
  { status: "ready_to_ship", label: "Pronto p/ envio", tone: "ok" },
  { status: "sent", label: "Enviados hoje", tone: "muted" },
];

const COLUMN_STATUSES = new Set(COLUMNS.map((c) => c.status));

/**
 * Phase 5 — fulfillment kanban controller. Owns the dnd-kit context,
 * column layout, optimistic state, and the POST /api/team/orders/status
 * call on drop. Filters/queries run inside the page wrapper; this
 * component is presentational over a normalized order list.
 *
 * Optimistic flow: on drop we set the local override (orderId -> status)
 * and fire-and-await the network call. On 2xx we commit by mapping the
 * server response back into the column. On error we revert the override
 * and surface the message via onMessage.
 */
export default function Kanban({
  orders,
  onPersistMove,
  onPrintLabel,
  query,
  statusFilter,
  slaFilter = "all",
}) {
  const [overrides, setOverrides] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState(COLUMNS[0].status);

  // Phase 12 — mobile single-column-with-tabs mode. Below 720px we render
  // only the active column; cross-column moves happen by switching tabs
  // first then dragging within that column. matchMedia keeps state in sync
  // with viewport changes (rotate, resize).
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia("(max-width: 720px)");
    const apply = () => setIsMobile(mql.matches);
    apply();
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", apply);
      return () => mql.removeEventListener("change", apply);
    }
    // Older Safari fallback
    mql.addListener(apply);
    return () => mql.removeListener(apply);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const visibleOrders = useMemo(() => {
    const normalized = orders
      .filter((o) => COLUMN_STATUSES.has(overrides[o.id] || o.status))
      .map((o) =>
        overrides[o.id] && overrides[o.id] !== o.status ? { ...o, status: overrides[o.id] } : o,
      );
    const q = normalize(query);
    return normalized
      .filter((order) => statusFilter === "all" || order.status === statusFilter)
      .filter(
        (order) =>
          !q ||
          normalize(
            [
              order.id,
              order.patientName,
              order.shipment?.carrier,
              order.shipment?.trackingCode,
              ...order.items.map((item) => item.name),
            ].join(" "),
          ).includes(q),
      )
      .filter((order) => {
        if (slaFilter === "all") return true;
        const today = new Date().toISOString().slice(0, 10);
        if (slaFilter === "today") {
          if (!order.paidAt) return false;
          return new Date(order.paidAt).toISOString().slice(0, 10) === today;
        }
        if (slaFilter === "late") {
          return order.status === "paid_pending_fulfillment" && minutesSince(order.paidAt) > 240;
        }
        return true;
      });
  }, [orders, overrides, query, statusFilter, slaFilter]);

  const byColumn = useMemo(() => {
    const buckets = Object.fromEntries(COLUMNS.map((c) => [c.status, []]));
    for (const order of visibleOrders) {
      if (buckets[order.status]) buckets[order.status].push(order);
    }
    return buckets;
  }, [visibleOrders]);

  const activeOrder = useMemo(
    () => (activeId ? visibleOrders.find((o) => o.id === activeId) : null),
    [activeId, visibleOrders],
  );

  // On mobile, default the active tab to the column with the most cards
  // (typically "paid_pending_fulfillment"). Recalculates only when the
  // mobile breakpoint flips, not on every drop, to avoid yanking the user
  // away from the column they're working in.
  useEffect(() => {
    if (!isMobile) return;
    const fullest = COLUMNS.reduce(
      (best, col) =>
        (byColumn[col.status]?.length || 0) > (byColumn[best.status]?.length || 0) ? col : best,
      COLUMNS[0],
    );
    setActiveTab((current) =>
      COLUMN_STATUSES.has(current) && (byColumn[current]?.length || 0) > 0
        ? current
        : fullest.status,
    );
    // intentionally omit byColumn from deps: only re-pick on isMobile flip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  function findStatus(id) {
    if (COLUMN_STATUSES.has(id)) return id;
    const order = visibleOrders.find((o) => o.id === id);
    return order?.status || null;
  }

  async function handleDragEnd(event) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const sourceStatus = findStatus(active.id);
    const targetStatus = findStatus(over.id);
    if (!sourceStatus || !targetStatus) return;
    if (sourceStatus === targetStatus) return;

    // Optimistic apply.
    setOverrides((current) => ({ ...current, [active.id]: targetStatus }));
    try {
      await onPersistMove?.({ orderId: active.id, status: targetStatus });
    } catch (error) {
      // Revert.
      setOverrides((current) => {
        const next = { ...current };
        delete next[active.id];
        return next;
      });
      throw error;
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(event) => setActiveId(event.active.id)}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={handleDragEnd}
    >
      {isMobile ? (
        <nav className={styles.txTabs} role="tablist" aria-label="Etapa de fulfillment">
          {COLUMNS.map((column, idx) => {
            const count = byColumn[column.status]?.length || 0;
            const isActive = activeTab === column.status;
            // Cycle 4 (A4): roving tabindex + arrow-key navigation so the
            // mobile tab strip follows the WAI-ARIA tablist pattern.
            return (
              <button
                key={column.status}
                type="button"
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                data-kanban-tab={column.status}
                className={`${styles.txTab} ${isActive ? styles.txTabActive : ""}`.trim()}
                onClick={() => setActiveTab(column.status)}
                onKeyDown={(event) => {
                  const last = COLUMNS.length - 1;
                  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                    event.preventDefault();
                    const nextIdx = idx === last ? 0 : idx + 1;
                    setActiveTab(COLUMNS[nextIdx].status);
                  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                    event.preventDefault();
                    const nextIdx = idx === 0 ? last : idx - 1;
                    setActiveTab(COLUMNS[nextIdx].status);
                  } else if (event.key === "Home") {
                    event.preventDefault();
                    setActiveTab(COLUMNS[0].status);
                  } else if (event.key === "End") {
                    event.preventDefault();
                    setActiveTab(COLUMNS[last].status);
                  }
                }}
              >
                <span>{column.label}</span>
                <span className={styles.txTabCount}>{count}</span>
              </button>
            );
          })}
        </nav>
      ) : null}
      <div className={styles.txKanban} data-fulfillment-kanban>
        {COLUMNS.map((column) => {
          if (isMobile && activeTab !== column.status) return null;
          return (
            <KanbanColumn
              key={column.status}
              status={column.status}
              label={column.label}
              tone={column.tone}
              orders={byColumn[column.status]}
              onPrintLabel={onPrintLabel}
            />
          );
        })}
      </div>
      <DragOverlay>
        {activeOrder ? <OrderCard order={activeOrder} onPrintLabel={onPrintLabel} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function minutesSince(value) {
  if (!value) return Infinity;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return Infinity;
  return (Date.now() - t) / 60000;
}
