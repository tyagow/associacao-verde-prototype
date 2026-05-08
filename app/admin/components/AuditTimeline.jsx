"use client";

import styles from "./AuditTimeline.module.css";
import { groupAuditEvents, GROUP_ORDER, GROUP_LABEL } from "./groupAuditEvents.js";

export { groupAuditEvents } from "./groupAuditEvents.js";

/**
 * Grouped audit timeline. Replaces the stacked card list with three buckets:
 *   - today    (events with timestamp >= local midnight today)
 *   - yesterday (events between local midnight today and local midnight yesterday)
 *   - earlier  (everything older)
 *
 * Each group is sorted descending by timestamp.
 *
 * Props:
 *   events    audit events ({at, action, actor, details})
 *   filter    current filter chip ("all" or an action substring)
 *   onFilter  (filter) => void
 *   onSelect  (event) => void  -> opens payload modal
 *   filters   list of {value, label, count?} chips to render
 */
export default function AuditTimeline({
  events = [],
  filter = "all",
  onFilter,
  onSelect,
  filters = [],
}) {
  const groups = groupAuditEvents(events, Date.now());
  const total = events.length;

  return (
    <div className={styles.timeline}>
      {filters.length ? (
        <div className={styles.chips} role="tablist" aria-label="Filtrar auditoria por tipo">
          {filters.map((chip) => (
            <button
              key={chip.value}
              type="button"
              className={`${styles.chip} ${filter === chip.value ? styles.chipActive : ""}`.trim()}
              onClick={() => onFilter && onFilter(chip.value)}
              aria-pressed={filter === chip.value ? "true" : "false"}
              data-chip={chip.value}
            >
              <span>{chip.label}</span>
              {typeof chip.count === "number" ? (
                <span className={styles.chipCount}>{chip.count}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {total === 0 ? (
        <p className={styles.empty}>Nenhum evento de auditoria encontrado para o filtro atual.</p>
      ) : null}

      {GROUP_ORDER.map((groupKey) => {
        const list = groups[groupKey];
        if (!list || !list.length) return null;
        return (
          <section
            key={groupKey}
            className={styles.group}
            aria-label={GROUP_LABEL[groupKey]}
            data-group={groupKey}
          >
            <header className={styles.groupHeader}>
              <h4>{GROUP_LABEL[groupKey]}</h4>
              <span className={styles.groupCount}>{list.length}</span>
            </header>
            <ol className={styles.events}>
              {list.map((event) => (
                <li key={`${event.at}-${event.action}-${event.actor}`} className={styles.event}>
                  <button
                    type="button"
                    className={styles.eventButton}
                    onClick={() => onSelect && onSelect(event)}
                  >
                    <time className={styles.time}>{formatTime(event.at)}</time>
                    <div className={styles.eventBody}>
                      <p className={styles.action}>{event.action}</p>
                      <p className={styles.actor}>{event.actor}</p>
                      <p className={styles.preview}>{previewDetails(event.details)}</p>
                    </div>
                    <span className={styles.openHint} aria-hidden="true">
                      Detalhes
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

function formatTime(value) {
  if (!value) return "--:--";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    }).format(new Date(value));
  } catch (error) {
    return "--:--";
  }
}

function previewDetails(details) {
  if (!details || typeof details !== "object") return "Sem detalhes estruturados";
  const entries = Object.entries(details);
  if (!entries.length) return "Sem detalhes estruturados";
  return entries
    .slice(0, 2)
    .map(([key, value]) => `${key}: ${formatPreviewValue(value)}`)
    .join(" · ");
}

function formatPreviewValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") {
    try {
      const json = JSON.stringify(value);
      return json.length > 60 ? `${json.slice(0, 57)}...` : json;
    } catch (error) {
      return "[obj]";
    }
  }
  const str = String(value);
  return str.length > 60 ? `${str.slice(0, 57)}...` : str;
}
