// Phase 5 — kanban-driven fulfillment transition tests.
//
// Covers `ProductionSystem.updateOrderFulfillmentStatus` (the new method
// behind POST /api/team/orders/status):
//   - RBAC: requires team session with `fulfillment:write`
//   - Status validation: rejects unknown statuses
//   - Lifecycle guard: rejects unpaid/cancelled orders
//   - Audit envelope: emits `team_order_status_changed` with from/to
//     status and `surface: "kanban"`.

import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState, ProductionSystem } from "../src/production-system.ts";

function harness(now = "2026-05-07T12:00:00-03:00") {
  const state = createInitialState(new Date(now));
  const saves = [];
  const system = new ProductionSystem({
    state,
    now: () => new Date(now),
    save: (nextState) => saves.push(structuredClone(nextState)),
  });
  return { state, saves, system };
}

async function paidOrderFor(system, suffix = "kbn") {
  const team = system.loginTeam({ password: "secret" }, "secret");
  const product = system.createProduct(team.sessionId, {
    name: `Oleo Kanban ${suffix}`,
    unit: "frasco",
    priceReais: 200,
    stock: 5,
  });
  const patient = system.createPatient(team.sessionId, {
    name: `Paciente ${suffix}`,
    memberCode: `APO-30${suffix.charCodeAt(0)}`,
    inviteCode: `KANBAN${suffix.toUpperCase()}26`,
    prescriptionExpiresAt: "2027-01-31",
  });
  const login = system.loginPatient({
    memberCode: patient.memberCode,
    inviteCode: `KANBAN${suffix.toUpperCase()}26`,
  });
  system.acceptPrivacyConsent(login.sessionId, { accepted: true, version: "lgpd-2026-05" });
  const checkout = await system.createCheckout(login.sessionId, {
    items: [{ productId: product.id, quantity: 1 }],
  });
  system.confirmPixPayment({ paymentId: checkout.payment.id, eventId: "evt-kanban" });
  return { team, order: checkout.order };
}

test("updateOrderFulfillmentStatus moves a paid order across columns and emits audit", async () => {
  const { system, state } = harness();
  const { team, order } = await paidOrderFor(system, "a");

  const moved = system.updateOrderFulfillmentStatus(team.sessionId, {
    orderId: order.id,
    status: "separating",
  });
  assert.equal(moved.status, "separating");

  const event = state.auditLog.find((entry) => entry.action === "team_order_status_changed");
  assert.ok(event, "audit event missing");
  assert.equal(event.details.orderId, order.id);
  assert.equal(event.details.fromStatus, "paid_pending_fulfillment");
  assert.equal(event.details.toStatus, "separating");
  assert.equal(event.details.surface, "kanban");
});

test("updateOrderFulfillmentStatus rejects invalid statuses", async () => {
  const { system } = harness();
  const { team, order } = await paidOrderFor(system, "b");

  assert.throws(
    () =>
      system.updateOrderFulfillmentStatus(team.sessionId, {
        orderId: order.id,
        status: "not_a_real_status",
      }),
    /Status de fulfillment invalido/,
  );
});

test("updateOrderFulfillmentStatus refuses unpaid orders", async () => {
  const { system } = harness();
  const team = system.loginTeam({ password: "secret" }, "secret");
  const product = system.createProduct(team.sessionId, {
    name: "Oleo Pendente Kanban",
    unit: "frasco",
    priceReais: 100,
    stock: 3,
  });
  const patient = system.createPatient(team.sessionId, {
    name: "Pendente Kanban",
    memberCode: "APO-3050",
    inviteCode: "PEND2026",
    prescriptionExpiresAt: "2027-01-31",
  });
  const login = system.loginPatient({
    memberCode: patient.memberCode,
    inviteCode: "PEND2026",
  });
  system.acceptPrivacyConsent(login.sessionId, { accepted: true, version: "lgpd-2026-05" });
  const checkout = await system.createCheckout(login.sessionId, {
    items: [{ productId: product.id, quantity: 1 }],
  });

  assert.throws(
    () =>
      system.updateOrderFulfillmentStatus(team.sessionId, {
        orderId: checkout.order.id,
        status: "separating",
      }),
    /ainda nao esta pago/,
  );
});

test("updateOrderFulfillmentStatus requires fulfillment:write permission", async () => {
  const { system } = harness();
  assert.throws(
    () =>
      system.updateOrderFulfillmentStatus("not-a-session", {
        orderId: "anything",
        status: "separating",
      }),
    /Login da equipe/i,
  );
});

test("updateOrderFulfillmentStatus is idempotent for same-column drops", async () => {
  const { system, state } = harness();
  const { team, order } = await paidOrderFor(system, "c");
  const before = state.auditLog.filter(
    (entry) => entry.action === "team_order_status_changed",
  ).length;
  const same = system.updateOrderFulfillmentStatus(team.sessionId, {
    orderId: order.id,
    status: "paid_pending_fulfillment",
  });
  assert.equal(same.status, "paid_pending_fulfillment");
  const after = state.auditLog.filter(
    (entry) => entry.action === "team_order_status_changed",
  ).length;
  assert.equal(after, before, "no audit emitted for a same-column drop");
});
