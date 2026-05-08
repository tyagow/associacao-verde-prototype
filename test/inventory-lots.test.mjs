import assert from "node:assert/strict";
import test from "node:test";

import { createInitialState, ProductionSystem } from "../src/production-system.ts";

// Phase 6 — inventory ledger exposes lots with validity and origin.
//
// Verifies:
//   - listProductLots requires a team session (RBAC).
//   - Each product row includes reserved totals, status, and a lots array.
//   - Cultivation-derived lots show "Cultivo · <strain>" origin.
//   - Stock-movement-derived lots show humanized origin and a derived
//     12-month default validity when the lot has no explicit expiry.
//   - updateProductMeta only touches the four metadata fields, persists,
//     and emits the team_product_meta_changed audit action.

function buildSystem({ now = "2026-05-08T12:00:00-03:00" } = {}) {
  const state = createInitialState(new Date(now));
  return new ProductionSystem({ state, now: () => new Date(now) });
}

function loginTeam(system) {
  // Ensure a baseline admin team user exists, mirroring server.mjs bootstrap.
  system.ensureTeamUser({
    email: "equipe-test@example.test",
    password: "Sup3rSenh@!",
    name: "Equipe Test",
    role: "admin",
  });
  const { sessionId } = system.loginTeam({
    email: "equipe-test@example.test",
    password: "Sup3rSenh@!",
  });
  return sessionId;
}

test("inventory ledger exposes lots with validity and origin", () => {
  const system = buildSystem();
  const sessionId = loginTeam(system);

  // Seed a cultivation lot derived from the existing batch_24k_1 batch.
  const batch = system.state.cultivationBatches[0];
  batch.harvested = 200;
  batch.dried = 150;
  batch.status = "dried";
  system.moveBatchToStock(sessionId, { batchId: batch.id, productId: "flor-24k" });

  const ledger = system.listProductLots(sessionId);
  assert.ok(Array.isArray(ledger.products), "ledger has products array");
  assert.equal(ledger.products.length, 3, "exposes one row per product");

  const flor = ledger.products.find((p) => p.id === "flor-24k");
  assert.ok(flor, "flor-24k present in ledger");
  assert.equal(typeof flor.reserved, "number");
  assert.ok(flor.lots.length >= 2, "flor has cultivation + initial-stock lot");

  const cultivationLot = flor.lots.find((lot) => /^Cultivo/.test(lot.origin));
  assert.ok(cultivationLot, "cultivation lot recognized by origin prefix");
  assert.equal(cultivationLot.quantity, 150);
  assert.match(cultivationLot.origin, /24k/);
  assert.match(cultivationLot.validity, /^\d{4}-\d{2}-\d{2}$/);

  const initialLot = flor.lots.find((lot) => /Saldo inicial/i.test(lot.origin));
  assert.ok(initialLot, "synthetic lot from initial stock movement present");
  assert.equal(initialLot.quantity, 92);
  assert.match(initialLot.validity, /^\d{4}-\d{2}-\d{2}$/);
});

test("listProductLots refuses non-team sessions", () => {
  const system = buildSystem();
  assert.throws(
    () => system.listProductLots("not-a-team-session"),
    (error) => error.status === 401,
  );
});

test("updateProductMeta only writes the four ledger fields and audits", () => {
  const system = buildSystem();
  const sessionId = loginTeam(system);
  const before = system.productById("oleo-cbd-10");
  const beforePrice = before.priceCents;

  const updated = system.updateProductMeta(sessionId, {
    productId: "oleo-cbd-10",
    lowStockThreshold: 12,
    category: "oil",
    controlled: "true",
    internalNote: "Conferir lote antes do envio.",
  });

  assert.equal(updated.lowStockThreshold, 12);
  assert.equal(updated.controlled, true);
  assert.equal(updated.internalNote, "Conferir lote antes do envio.");
  assert.equal(updated.priceCents, beforePrice, "price unchanged by meta update");

  const auditEntry = system.state.auditLog
    .slice()
    .reverse()
    .find((entry) => entry.action === "team_product_meta_changed");
  assert.ok(auditEntry, "audit captured the meta update");
  assert.equal(auditEntry.details.productId, "oleo-cbd-10");
  assert.equal(auditEntry.details.after.lowStockThreshold, 12);
});
