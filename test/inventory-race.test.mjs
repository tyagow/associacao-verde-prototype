import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState, ProductionSystem } from "../src/production-system.ts";

// Phase 2 — 5-patient race test for the last unit.
//
// Honest note on better-sqlite3 sync semantics:
//   better-sqlite3 (and node:sqlite) are synchronous. Node is single-threaded
//   and JavaScript runs to completion within a turn of the event loop, so the
//   synchronous critical section inside createCheckout (re-read availableStock,
//   push reservation, push order — wrapped in runInventoryTransaction) cannot
//   interleave with another checkout's critical section. createCheckout DOES
//   await the payment provider AFTER reserving, but by then the reservation
//   is already in this.state.stockReservations and contributes to
//   availableStock for any concurrent caller. This test verifies the
//   lock-acquire-order serialization is correct and acts as a regression net
//   if the system ever moves to a real async transaction.

function buildSystem({ now = "2026-05-08T12:00:00-03:00", onHand = 1 } = {}) {
  const state = createInitialState(new Date(now));
  // Reset all products to onHand=0 except the contested one.
  for (const product of state.products) product.stock = 0;
  // Use oleo-cbd-10 as the contested SKU.
  const product = state.products.find((item) => item.id === "oleo-cbd-10");
  product.stock = onHand;
  return new ProductionSystem({
    state,
    now: () => new Date(now),
  });
}

function ensurePatient(system, { id, memberCode, inviteCode, name }) {
  if (!system.state.patients.some((patient) => patient.id === id)) {
    system.state.patients.push({
      id,
      name,
      memberCode,
      inviteCode,
      status: "active",
      associationEligible: true,
      prescriptionExpiresAt: "2026-12-31",
      cardExpiresAt: "2026-12-31",
      privacyConsentAt: "2026-01-01T00:00:00-03:00",
      privacyConsentVersion: "lgpd-2026-01",
    });
  }
  return system.loginPatient({ memberCode, inviteCode });
}

test("five concurrent checkouts for the last unit: exactly one wins", async () => {
  const system = buildSystem({ onHand: 1 });
  const sessions = [];
  for (let index = 0; index < 5; index += 1) {
    const session = ensurePatient(system, {
      id: `pat_race_${index}`,
      memberCode: `APO-RACE-${index}`,
      inviteCode: `RACE2026-${index}`,
      name: `Paciente Race ${index}`,
    });
    sessions.push(session);
  }

  assert.equal(system.availableStock("oleo-cbd-10"), 1);

  const settled = await Promise.allSettled(
    sessions.map((session) =>
      system.createCheckout(session.sessionId, {
        items: [{ productId: "oleo-cbd-10", quantity: 1 }],
      }),
    ),
  );

  const fulfilled = settled.filter((result) => result.status === "fulfilled");
  const rejected = settled.filter((result) => result.status === "rejected");

  assert.equal(fulfilled.length, 1, "exactly one checkout must succeed for the last unit");
  assert.equal(rejected.length, 4, "the other four must be rejected");

  for (const failure of rejected) {
    assert.equal(failure.reason.code, "OUT_OF_STOCK", "rejected checkouts must carry OUT_OF_STOCK");
    assert.equal(failure.reason.status, 409);
    assert.match(failure.reason.message, /Estoque insuficiente/);
  }

  // No oversell: only one active reservation against the single unit.
  assert.equal(system.availableStock("oleo-cbd-10"), 0);
  const activeReservations = system.state.stockReservations.filter(
    (reservation) => reservation.status === "active",
  );
  assert.equal(activeReservations.length, 1);

  // Audit trail: every block produced a patient_concurrent_checkout_blocked.
  const blockedAudits = system.state.auditLog.filter(
    (event) => event.action === "patient_concurrent_checkout_blocked",
  );
  assert.equal(blockedAudits.length, 4);
  for (const audit of blockedAudits) {
    assert.equal(audit.details.productId, "oleo-cbd-10");
    assert.equal(audit.details.requested, 1);
    assert.equal(audit.details.actor, "system");
  }
});

test("after expiring the lone reservation, availableStock returns to onHand", async () => {
  let current = new Date("2026-05-08T12:00:00-03:00");
  const state = createInitialState(current);
  for (const product of state.products) product.stock = 0;
  const product = state.products.find((item) => item.id === "oleo-cbd-10");
  product.stock = 1;
  state.meta.reservationMinutes = 1;
  const system = new ProductionSystem({
    state,
    now: () => current,
  });
  const session = ensurePatient(system, {
    id: "pat_race_solo",
    memberCode: "APO-RACE-SOLO",
    inviteCode: "RACESOLO2026",
    name: "Paciente Race Solo",
  });

  await system.createCheckout(session.sessionId, {
    items: [{ productId: "oleo-cbd-10", quantity: 1 }],
  });

  assert.equal(system.availableStock("oleo-cbd-10"), 0);

  // Advance past the reservation window and run the expiry routine.
  current = new Date("2026-05-08T12:02:00-03:00");
  system.expireReservations();

  assert.equal(system.availableStock("oleo-cbd-10"), 1);
  const reservation = system.state.stockReservations[0];
  assert.equal(reservation.status, "expired");
});

test("paid webhook after reservation expiry leaves stock untouched and writes paid_after_expiry_conflict", async () => {
  let current = new Date("2026-05-08T12:00:00-03:00");
  const state = createInitialState(current);
  for (const product of state.products) product.stock = 0;
  const product = state.products.find((item) => item.id === "oleo-cbd-10");
  product.stock = 1;
  state.meta.reservationMinutes = 1;
  const system = new ProductionSystem({
    state,
    now: () => current,
  });
  const session = ensurePatient(system, {
    id: "pat_race_late",
    memberCode: "APO-RACE-LATE",
    inviteCode: "RACELATE2026",
    name: "Paciente Race Late",
  });
  const checkout = await system.createCheckout(session.sessionId, {
    items: [{ productId: "oleo-cbd-10", quantity: 1 }],
  });

  current = new Date("2026-05-08T12:02:00-03:00");
  system.expireReservations();

  const result = system.confirmPixPayment({
    paymentId: checkout.payment.id,
    eventId: "evt-late-paid",
    status: "paid",
  });

  assert.equal(result.conflict, "paid_after_expiry");
  assert.equal(result.order.status, "fulfillment_exception");
  assert.equal(result.order.exceptionStatus, "paid_after_expiry");
  // Stock NOT decremented — the freed unit may belong to another patient.
  assert.equal(state.products.find((item) => item.id === "oleo-cbd-10").stock, 1);
  // availableStock reflects 1 free unit (no active reservation).
  assert.equal(system.availableStock("oleo-cbd-10"), 1);
  assert.equal(
    state.auditLog.some((event) => event.action === "paid_after_expiry_conflict"),
    true,
  );
});
