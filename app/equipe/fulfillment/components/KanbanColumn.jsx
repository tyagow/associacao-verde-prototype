"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import OrderCard from "./OrderCard.jsx";
import styles from "./KanbanColumn.module.css";

/**
 * Phase 5 (revamp) — single kanban column, b-fulfillment.html visual.
 * Paper-warm body, paper header bar with status dot + ink count pill.
 * dnd-kit useDroppable / SortableContext wiring unchanged.
 */
export default function KanbanColumn({ status, label, tone = "muted", orders, onPrintLabel }) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: { kind: "column", status },
  });

  const toneClass = styles[`tone_${tone}`] || "";

  return (
    <section
      ref={setNodeRef}
      className={`${styles.kcol} ${isOver ? styles.kcolOver : ""}`.trim()}
      data-column={status}
      aria-label={label}
    >
      <header className={styles.kcolHeader}>
        <h3 className={styles.kcolTitle}>
          <span className={`${styles.dot} ${toneClass}`} aria-hidden />
          {label}
        </h3>
        <span className={`${styles.pillN} ${toneClass}`} aria-label={`${orders.length} pedido(s)`}>
          {orders.length}
        </span>
      </header>
      <SortableContext items={orders.map((o) => o.id)} strategy={verticalListSortingStrategy}>
        <div className={styles.klist}>
          {orders.length ? (
            orders.map((order) => (
              <OrderCard key={order.id} order={order} onPrintLabel={onPrintLabel} />
            ))
          ) : (
            <div className={styles.kcolEmpty}>
              <div className="adm-empty-state adm-empty-state--inset adm-empty-state--sm">
                <span className="adm-empty-state__hint">Nenhum pedido nesta etapa.</span>
              </div>
            </div>
          )}
        </div>
      </SortableContext>
    </section>
  );
}
