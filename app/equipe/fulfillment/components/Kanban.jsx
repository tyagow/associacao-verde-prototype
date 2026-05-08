"use client";

import { useMemo, useState } from "react";
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
  { status: "paid_pending_fulfillment", label: "Pago aguardando" },
  { status: "separating", label: "Em separacao" },
  { status: "ready_to_ship", label: "Pronto despachar" },
  { status: "sent", label: "Enviado" },
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
export default function Kanban({ orders, onPersistMove, onPrintLabel, query, statusFilter }) {
  const [overrides, setOverrides] = useState({});
  const [activeId, setActiveId] = useState(null);

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
      );
  }, [orders, overrides, query, statusFilter]);

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
      <div className={styles.txKanban} data-fulfillment-kanban>
        {COLUMNS.map((column) => (
          <KanbanColumn
            key={column.status}
            status={column.status}
            label={column.label}
            orders={byColumn[column.status]}
            onPrintLabel={onPrintLabel}
          />
        ))}
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
