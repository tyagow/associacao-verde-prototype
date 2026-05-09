"use client";

import { useMemo, useState } from "react";
import styles from "./HistoryList.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatDateOnly(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function formatMonthYear(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

const STATUS_LABEL = {
  awaiting_payment: "Pix pendente",
  paid_pending_fulfillment: "Pago",
  separating: "Em separacao",
  ready_to_ship: "Pronto para envio",
  sent: "Enviado",
  payment_expired: "Pix expirado",
};

function statusTone(status) {
  switch (status) {
    case "awaiting_payment":
    case "separating":
    case "ready_to_ship":
      return "warn";
    case "paid_pending_fulfillment":
    case "sent":
      return "ok";
    case "payment_expired":
      return "danger";
    default:
      return "muted";
  }
}

const FILTER_DEFS = [
  { key: "all", label: "Todos" },
  { key: "active", label: "Ativos" },
  { key: "done", label: "Concluidos" },
  { key: "expired", label: "Expirados" },
];

function filterBucket(status) {
  if (
    status === "awaiting_payment" ||
    status === "paid_pending_fulfillment" ||
    status === "separating" ||
    status === "ready_to_ship"
  )
    return "active";
  if (status === "sent") return "done";
  if (status === "payment_expired") return "expired";
  return "other";
}

/**
 * History tab list. Wraps #patient-orders. Compact rows, click-to-expand,
 * with a segmented filter chip group up top and a clean grid layout that
 * places the expanded body on its own row.
 */
export default function HistoryList({ orders, onViewOrder, onOpenSupport, onReorder }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const counts = useMemo(() => {
    const tally = { all: orders.length, active: 0, done: 0, expired: 0 };
    for (const order of orders) {
      const bucket = filterBucket(order.status);
      if (bucket === "active") tally.active += 1;
      else if (bucket === "done") tally.done += 1;
      else if (bucket === "expired") tally.expired += 1;
    }
    return tally;
  }, [orders]);

  const totalCents = useMemo(
    () => orders.reduce((sum, order) => sum + (order.totalCents || 0), 0),
    [orders],
  );

  const oldestCreatedAt = useMemo(() => {
    if (!orders.length) return null;
    return orders.reduce((oldest, order) => {
      if (!order.createdAt) return oldest;
      if (!oldest) return order.createdAt;
      return order.createdAt < oldest ? order.createdAt : oldest;
    }, null);
  }, [orders]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    let pool = orders;
    if (filter !== "all") {
      pool = pool.filter((order) => filterBucket(order.status) === filter);
    }
    if (needle) {
      pool = pool.filter((order) => {
        if (
          String(order.id || "")
            .toLowerCase()
            .includes(needle)
        )
          return true;
        return (order.items || []).some((item) =>
          String(item.name || "")
            .toLowerCase()
            .includes(needle),
        );
      });
    }
    return pool;
  }, [orders, filter, search]);

  return (
    <section id="patient-orders" className={styles.history}>
      <header className={styles.pagehead}>
        <div className={styles.pageheadText}>
          <h1>Historico de pedidos</h1>
          <p className={styles.lead}>
            {orders.length} {orders.length === 1 ? "pedido" : "pedidos"} · totalizado{" "}
            <span className={styles.tabular}>{money.format(totalCents / 100)}</span>
            {oldestCreatedAt ? ` desde ${formatMonthYear(oldestCreatedAt)}` : ""}
          </p>
        </div>
        {orders.length ? (
          <div className={styles.filters} role="group" aria-label="Filtrar por status">
            <div className={styles.seg}>
              {FILTER_DEFS.map((def) => (
                <button
                  key={def.key}
                  type="button"
                  className={`${styles.segBtn} ${filter === def.key ? styles.segBtnOn : ""}`}
                  aria-pressed={filter === def.key}
                  onClick={() => setFilter(def.key)}
                >
                  {def.label} · <span className={styles.tabular}>{counts[def.key] ?? 0}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </header>

      {orders.length ? (
        <div className={styles.searchRow}>
          <input
            type="search"
            data-history-search
            className={styles.search}
            placeholder="Buscar pedido por ID ou produto..."
            aria-label="Buscar no historico de pedidos"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      ) : null}

      {orders.length ? (
        visible.length ? (
          <ul className={styles.list}>
            {visible.map((order) => (
              <HistoryRow
                key={order.id}
                order={order}
                onViewOrder={onViewOrder}
                onOpenSupport={onOpenSupport}
                onReorder={onReorder}
              />
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>Nenhum pedido neste filtro.</p>
        )
      ) : (
        <p className={styles.empty}>Nenhum pedido criado nesta conta.</p>
      )}
    </section>
  );
}

function HistoryRow({ order, onViewOrder, onOpenSupport, onReorder }) {
  const [open, setOpen] = useState(false);
  const tone = statusTone(order.status);
  const itemCount = order.items?.length || 0;
  const headline =
    itemCount > 0
      ? `${itemCount} ${itemCount === 1 ? "produto" : "produtos"} · ${order.items
          .map((item) => item.name)
          .filter(Boolean)
          .slice(0, 2)
          .join(", ")}${itemCount > 2 ? "…" : ""}`
      : "Pedido";
  const isPaid =
    order.paymentStatus === "paid" ||
    order.paymentStatus === "confirmed" ||
    order.status === "paid_pending_fulfillment" ||
    order.status === "separating" ||
    order.status === "ready_to_ship" ||
    order.status === "sent";

  return (
    <li className={`${styles.row} ${open ? styles.rowOpen : ""}`}>
      <button
        type="button"
        className={styles.summary}
        aria-expanded={open}
        aria-controls={`history-body-${order.id}`}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={styles.id}>{order.id}</span>
        <span className={styles.name}>
          <span className={styles.nameLine}>{headline}</span>
          <span className={styles.meta}>
            {formatDateOnly(order.createdAt)}
            {order.deliveryMethod ? ` · ${order.deliveryMethod}` : ""}
          </span>
        </span>
        <span className={`pill ${tone}`}>{STATUS_LABEL[order.status] || "Em revisao"}</span>
        <span className={styles.total}>{money.format((order.totalCents || 0) / 100)}</span>
        <span className={styles.chev} aria-hidden="true">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open ? (
        <div id={`history-body-${order.id}`} className={styles.body}>
          {order.items?.length ? (
            <ul className={styles.items}>
              {order.items.map((item, index) => (
                <li key={`${item.productId || item.name}-${index}`}>
                  <span>
                    {item.quantity} {item.unit || "un"} · {item.name}
                  </span>
                  <span className={styles.tabular}>
                    {money.format((item.subtotalCents || 0) / 100)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className={styles.metaRow}>
            <span>
              Pago: <b>{isPaid ? formatDateTime(order.updatedAt || order.createdAt) : "—"}</b>
            </span>
            <span>
              Entrega: <b>{order.deliveryMethod || "a combinar"}</b>
            </span>
            <span>
              Rastreio:{" "}
              <b>
                {order.shipment?.trackingCode
                  ? `${order.shipment.carrier || ""} ${order.shipment.trackingCode}`.trim()
                  : "aguardando"}
              </b>
            </span>
          </div>
          <div className={styles.actions}>
            {onReorder && order.items?.length ? (
              <button
                type="button"
                className={styles.actionPrimary}
                data-action="reorder"
                onClick={() => onReorder(order.items)}
              >
                Repetir pedido
              </button>
            ) : null}
            {onViewOrder ? (
              <button
                type="button"
                className={onReorder ? styles.actionGhost : styles.actionPrimary}
                onClick={() => onViewOrder(order.id)}
              >
                Ver pedido
              </button>
            ) : null}
            {onOpenSupport ? (
              <button
                type="button"
                className={styles.actionGhost}
                onClick={() => onOpenSupport(order.id)}
              >
                Falar com suporte
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}
