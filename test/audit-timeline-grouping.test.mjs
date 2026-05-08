import { test } from "node:test";
import assert from "node:assert/strict";

import { groupAuditEvents } from "../app/admin/components/groupAuditEvents.js";

// Pin "now" to a fixed local moment: 2026-05-08T10:30:00 local time.
// startOfLocalDay uses the runtime local timezone, so we build "now" in the
// same way to avoid timezone-coupling between expectation and implementation.
function localTimestamp(year, month, day, hours = 0, minutes = 0, seconds = 0) {
  return new Date(year, month - 1, day, hours, minutes, seconds, 0).getTime();
}

const NOW = localTimestamp(2026, 5, 8, 10, 30, 0);

test("groupAuditEvents buckets events into today / yesterday / earlier", () => {
  const events = [
    {
      at: new Date(localTimestamp(2026, 5, 8, 9, 0, 0)).toISOString(),
      action: "today_a",
      actor: "alice",
    },
    {
      at: new Date(localTimestamp(2026, 5, 8, 0, 0, 0)).toISOString(),
      action: "today_midnight",
      actor: "alice",
    },
    {
      at: new Date(localTimestamp(2026, 5, 7, 23, 59, 0)).toISOString(),
      action: "yesterday_late",
      actor: "bob",
    },
    {
      at: new Date(localTimestamp(2026, 5, 7, 0, 0, 0)).toISOString(),
      action: "yesterday_midnight",
      actor: "bob",
    },
    {
      at: new Date(localTimestamp(2026, 5, 6, 23, 59, 0)).toISOString(),
      action: "earlier_a",
      actor: "carol",
    },
    {
      at: new Date(localTimestamp(2026, 4, 1, 10, 0, 0)).toISOString(),
      action: "earlier_b",
      actor: "dave",
    },
  ];

  const groups = groupAuditEvents(events, NOW);

  assert.deepEqual(
    groups.today.map((event) => event.action),
    ["today_a", "today_midnight"],
    "today bucket holds events from local midnight today onward, sorted desc",
  );
  assert.deepEqual(
    groups.yesterday.map((event) => event.action),
    ["yesterday_late", "yesterday_midnight"],
    "yesterday bucket holds events between yesterday-midnight and today-midnight",
  );
  assert.deepEqual(
    groups.earlier.map((event) => event.action),
    ["earlier_a", "earlier_b"],
    "earlier bucket holds anything older than yesterday-midnight, sorted desc",
  );
});

test("groupAuditEvents sorts each bucket descending by timestamp", () => {
  const events = [
    { at: new Date(localTimestamp(2026, 5, 8, 1, 0, 0)).toISOString(), action: "today_old" },
    { at: new Date(localTimestamp(2026, 5, 8, 9, 0, 0)).toISOString(), action: "today_new" },
    { at: new Date(localTimestamp(2026, 5, 8, 5, 0, 0)).toISOString(), action: "today_mid" },
  ];
  const groups = groupAuditEvents(events, NOW);
  assert.deepEqual(
    groups.today.map((event) => event.action),
    ["today_new", "today_mid", "today_old"],
  );
});

test("groupAuditEvents puts events with missing or invalid timestamps in earlier", () => {
  const events = [
    { action: "missing_at", actor: "alice" },
    { at: "not-a-date", action: "garbage_at", actor: "bob" },
    {
      at: new Date(localTimestamp(2026, 5, 8, 9, 0, 0)).toISOString(),
      action: "today",
      actor: "carol",
    },
  ];
  const groups = groupAuditEvents(events, NOW);
  assert.equal(groups.today.length, 1);
  assert.equal(groups.earlier.length, 2);
  const earlierActions = groups.earlier.map((event) => event.action).sort();
  assert.deepEqual(earlierActions, ["garbage_at", "missing_at"]);
});

test("groupAuditEvents handles empty input safely", () => {
  assert.deepEqual(groupAuditEvents([], NOW), { today: [], yesterday: [], earlier: [] });
  assert.deepEqual(groupAuditEvents(undefined, NOW), { today: [], yesterday: [], earlier: [] });
});
