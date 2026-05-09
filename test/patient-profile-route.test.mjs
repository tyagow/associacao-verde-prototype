import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState, ProductionSystem } from "../src/production-system.ts";

function harness(now = "2026-05-09T12:00:00-03:00") {
  const state = createInitialState(new Date(now));
  const saves = [];
  const system = new ProductionSystem({
    state,
    now: () => new Date(now),
    save: (nextState) => saves.push(structuredClone(nextState)),
  });
  return { state, saves, system };
}

test("updatePatientProfile saves shippingAddress and persists", () => {
  const { system, saves } = harness();
  const { sessionId } = system.loginPatient({
    memberCode: "APO-1027",
    inviteCode: "HELENA2026",
  });

  const before = saves.length;
  const result = system.updatePatientProfile(sessionId, {
    shippingAddress: {
      cep: "01310-100",
      street: "Avenida Paulista",
      number: "1000",
      complement: "Apto 12",
      neighborhood: "Bela Vista",
      city: "Sao Paulo",
      state: "sp",
      notes: "Portao azul",
    },
  });

  assert.equal(result.shippingAddress.cep, "01310-100");
  assert.equal(result.shippingAddress.state, "SP", "UF normalized to upper");
  assert.equal(result.shippingAddress.street, "Avenida Paulista");
  assert.ok(saves.length > before, "save callback fires (persist)");
});

test("updatePatientProfile rejects missing privacy consent", () => {
  const { system, state } = harness();
  state.patients.find((p) => p.id === "pat_helena").privacyConsentAt = "";
  const { sessionId } = system.loginPatient({
    memberCode: "APO-1027",
    inviteCode: "HELENA2026",
  });

  assert.throws(
    () => system.updatePatientProfile(sessionId, { shippingAddress: { cep: "01310-100" } }),
    (err) => err.status === 403,
  );
});

test("updatePatientProfile ignores unknown patch keys", () => {
  const { system } = harness();
  const { sessionId } = system.loginPatient({
    memberCode: "APO-1027",
    inviteCode: "HELENA2026",
  });

  const result = system.updatePatientProfile(sessionId, {
    name: "Hacker McHackface",
    memberCode: "APO-9999",
    eligibility: { active: false },
  });
  assert.equal(result.name, "Helena Rocha", "name not mutable via profile patch");
  assert.equal(result.memberCode, "APO-1027");
});

test("createCheckout auto-saves shippingAddress to patient profile", async () => {
  const { system } = harness();
  const { sessionId } = system.loginPatient({
    memberCode: "APO-1027",
    inviteCode: "HELENA2026",
  });

  await system.createCheckout(sessionId, {
    items: [{ productId: "flor-24k", quantity: 1 }],
    deliveryMethod: "GED Log via Melhor Envio",
    shippingAddress: {
      cep: "20040-020",
      street: "Rua da Carioca",
      number: "50",
      neighborhood: "Centro",
      city: "Rio de Janeiro",
      state: "RJ",
    },
  });

  const patient = system.requirePatient(sessionId);
  assert.ok(patient.shippingAddress, "address persisted on patient");
  assert.equal(patient.shippingAddress.city, "Rio de Janeiro");
});
