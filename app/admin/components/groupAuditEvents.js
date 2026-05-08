/**
 * Pure grouping helper for the admin audit timeline.
 *
 * Buckets audit events into today / yesterday / earlier based on local
 * midnight boundaries (computed from `now` in the runtime's local timezone).
 * Each bucket is sorted descending by event.at.
 *
 * Events without a parseable timestamp land in `earlier`.
 *
 * Extracted to a plain .js module so node:test (run with --import tsx) can
 * import the grouping logic without loading the .jsx component file.
 */

export const GROUP_ORDER = ["today", "yesterday", "earlier"];

export const GROUP_LABEL = {
  today: "Hoje",
  yesterday: "Ontem",
  earlier: "Anteriores",
};

export function groupAuditEvents(events, now) {
  const todayMidnight = startOfLocalDay(new Date(now));
  const yesterdayMidnight = startOfLocalDay(new Date(todayMidnight.getTime() - 1));
  const buckets = { today: [], yesterday: [], earlier: [] };
  for (const event of events || []) {
    const ts = parseTimestamp(event?.at);
    if (ts === null) {
      buckets.earlier.push(event);
      continue;
    }
    if (ts >= todayMidnight.getTime()) {
      buckets.today.push(event);
    } else if (ts >= yesterdayMidnight.getTime()) {
      buckets.yesterday.push(event);
    } else {
      buckets.earlier.push(event);
    }
  }
  for (const key of GROUP_ORDER) {
    buckets[key].sort((a, b) => (parseTimestamp(b?.at) || 0) - (parseTimestamp(a?.at) || 0));
  }
  return buckets;
}

function startOfLocalDay(date) {
  const local = new Date(date.getTime());
  local.setHours(0, 0, 0, 0);
  return local;
}

function parseTimestamp(value) {
  if (!value) return null;
  const ms = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}
