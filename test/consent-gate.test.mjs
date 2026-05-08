import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState, ProductionSystem } from "../src/production-system.ts";

function harness(now = "2026-05-07T12:00:00-03:00") {
  const state = createInitialState(new Date(now));
  // Force the test patient (Helena) to have unset privacy consent so we can
  // exercise the LGPD gate. Other patients in the seed keep their existing
  // values (which the production fixture sets to a real timestamp so the
  // existing checkout tests still pass).
  const helena = state.patients.find((p) => p.id === "pat_helena");
  helena.privacyConsentAt = "";
  helena.privacyConsentVersion = "";

  const saves = [];
  const system = new ProductionSystem({
    state,
    now: () => new Date(now),
    save: (nextState) => saves.push(structuredClone(nextState)),
  });
  return { state, saves, system };
}

test("listCatalog blocks logged-in patient without privacy consent", () => {
  const { system } = harness();
  const { sessionId } = system.loginPatient({
    memberCode: "APO-1027",
    inviteCode: "HELENA2026",
  });

  assert.throws(
    () => system.listCatalog(sessionId),
    (err) => err.status === 403 && /politica de privacidade/i.test(err.message),
  );
});

test("createCheckout blocks logged-in patient without privacy consent", async () => {
  const { system } = harness();
  const { sessionId } = system.loginPatient({
    memberCode: "APO-1027",
    inviteCode: "HELENA2026",
  });

  await assert.rejects(
    () =>
      system.createCheckout(sessionId, {
        deliveryMethod: "GED Log via Melhor Envio",
        items: [{ productId: "flor-24k", quantity: 1 }],
      }),
    (err) => err.status === 403 && /politica de privacidade/i.test(err.message),
  );
});

test("listCatalog returns products after acceptPrivacyConsent", () => {
  const { system } = harness();
  const { sessionId } = system.loginPatient({
    memberCode: "APO-1027",
    inviteCode: "HELENA2026",
  });

  system.acceptPrivacyConsent(sessionId, { accepted: true, version: "v1" });

  const catalog = system.listCatalog(sessionId);
  assert.ok(Array.isArray(catalog));
  assert.ok(catalog.length > 0);
});
