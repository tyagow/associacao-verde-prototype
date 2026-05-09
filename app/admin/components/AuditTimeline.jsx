"use client";

import styles from "./AuditTimeline.module.css";
import { groupAuditEvents, GROUP_ORDER, GROUP_LABEL } from "./groupAuditEvents.js";

export { groupAuditEvents } from "./groupAuditEvents.js";

/**
 * Grouped audit timeline. Three buckets (today / yesterday / earlier) with
 * tone-coded dots. Each row uses the .tev recipe (time · dot · body).
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
                <li
                  key={`${event.at}-${event.action}-${event.actor}`}
                  className={styles.tev}
                  data-tone={toneForEvent(event)}
                >
                  <button
                    type="button"
                    className={styles.tevButton}
                    onClick={() => onSelect && onSelect(event)}
                  >
                    <time className={styles.time}>{formatTime(event.at)}</time>
                    <span className={styles.dot} aria-hidden />
                    <div className={styles.body}>
                      <div className={styles.what}>{event.action}</div>
                      <div className={styles.meta}>
                        <span>{event.actor}</span>
                        {previewDetails(event.details) ? (
                          <span> · {previewDetails(event.details)}</span>
                        ) : null}
                      </div>
                    </div>
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

function toneForEvent(event) {
  const action = String(event?.action || "").toLowerCase();
  if (action.includes("failed") || action.includes("blocked") || action.includes("security_alert"))
    return "danger";
  if (action.includes("support") || action.includes("team_user") || action.includes("pending"))
    return "warn";
  return "ok";
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
  if (!details || typeof details !== "object") return "";
  const entries = Object.entries(details);
  if (!entries.length) return "";
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
