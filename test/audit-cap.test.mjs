import { test } from "node:test";
import assert from "node:assert/strict";

import { createInitialState, ProductionSystem } from "../src/production-system.ts";

function harness(now = "2026-05-08T12:00:00-03:00") {
  const state = createInitialState(new Date(now));
  const system = new ProductionSystem({
    state,
    now: () => new Date(now),
    save: () => {},
  });
  return { state, system };
}

test("audit log trims at AUDIT_LOG_MAX (20_000)", async () => {
  const { system } = harness();

  for (let i = 0; i < 20_010; i += 1) {
    system.audit("test_event", "system", { i });
  }

  assert.equal(system.state.auditLog.length, 20_000);

  // First remaining entry should have i >= 10 (oldest 10 evicted)
  const first = system.state.auditLog[0];
  const data = typeof first.details === "string" ? JSON.parse(first.details) : first.details;
  assert.ok(data.i >= 10, `Expected first remaining entry i >= 10, got ${data.i}`);
});
