"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import OrderCard from "./OrderCard.jsx";
import styles from "./KanbanColumn.module.css";

/**
 * Phase 5 — single kanban column. Droppable target keyed by status, with
 * a SortableContext wrapper so dnd-kit knows the in-column order. The
 * column header surfaces the human label + count badge; the body lists
 * OrderCard children. Empty columns show a neutral placeholder so the
 * drop zone stays obviously droppable.
 */
export default function KanbanColumn({ status, label, orders, onPrintLabel }) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: { kind: "column", status },
  });

  return (
    <section
      ref={setNodeRef}
      className={`${styles.txColumn} ${isOver ? styles.txColumnOver : ""}`.trim()}
      data-column={status}
      aria-label={label}
    >
      <header className={styles.txColumnHeader}>
        <h3>{label}</h3>
        <span className={styles.txColumnCount} aria-label={`${orders.length} pedido(s)`}>
          {orders.length}
        </span>
      </header>
      <SortableContext items={orders.map((o) => o.id)} strategy={verticalListSortingStrategy}>
        <div className={styles.txColumnBody}>
          {orders.length ? (
            orders.map((order) => (
              <OrderCard key={order.id} order={order} onPrintLabel={onPrintLabel} />
            ))
          ) : (
            <p className={styles.txColumnEmpty}>Nenhum pedido nesta etapa.</p>
          )}
        </div>
      </SortableContext>
    </section>
  );
}
