import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ProductionSystem } from "../src/production-system.ts";
import { SQLITE_SCHEMA_VERSION, SqliteStateStore } from "../src/sqlite-store.ts";

test("SQLite store persists production entities across process-style reloads", async () => {
  const dir = mkdtempSync(join(tmpdir(), "av-sqlite-"));
  const dbFile = join(dir, "production.sqlite");

  try {
    const store = new SqliteStateStore({
      filePath: dbFile,
      now: () => new Date("2026-05-07T12:00:00-03:00"),
    });
    const system = new ProductionSystem({
      state: store.load(),
      now: () => new Date("2026-05-07T12:00:00-03:00"),
      save: (state) => store.save(state),
    });
    system.ensureTeamUser({ email: "admin@apoiar.test", password: "secret", name: "Admin" });
    const team = system.loginTeam({ email: "admin@apoiar.test", password: "secret" });
    const patient = system.createPatient(team.sessionId, {
      name: "Persistente Silva",
      memberCode: "APO-3001",
      inviteCode: "PERSISTE2026",
      prescriptionExpiresAt: "2026-12-31",
    });
    const product = system.createProduct(team.sessionId, {
      name: "Produto Persistente",
      unit: "un",
      priceReais: 50,
      stock: 7,
    });
    const patientLogin = system.loginPatient({
      memberCode: patient.memberCode,
      inviteCode: "PERSISTE2026",
    });
    const ticket = system.createSupportRequest(patientLogin.sessionId, {
      subject: "Persistir atendimento",
      message: "Verificar se solicitacao sobrevive ao reload.",
      priority: "normal",
    });
    system.acceptPrivacyConsent(patientLogin.sessionId, {
      accepted: true,
      version: "lgpd-2026-05",
    });
    const checkout = await system.createCheckout(patientLogin.sessionId, {
      items: [{ productId: product.id, quantity: 2 }],
    });
    system.confirmPixPayment({
      paymentId: checkout.payment.providerPaymentId,
      eventId: "persist-paid",
      status: "paid",
    });
    system.registerPrescriptionDocument(team.sessionId, {
      memberCode: "APO-3001",
      fileName: "receita.pdf",
      storageKey: "s3://private/persistente/receita.pdf",
      expiresAt: "2027-01-01",
    });
    system.issueMemberCard(team.sessionId, {
      memberCode: "APO-3001",
      cardNumber: "AV-APO-3001-20270101",
      expiresAt: "2027-01-01",
    });
    system.upsertShipment(team.sessionId, {
      orderId: checkout.order.id,
      carrier: "GED Log",
      trackingCode: "BR999",
      status: "sent",
    });
    const batch = system.createCultivationBatch(team.sessionId, {
      strain: "Persist Kush",
      productId: product.id,
      plants: 3,
      week: 9,
    });
    system.recordHarvest(team.sessionId, { batchId: batch.id, harvested: 90 });
    system.recordDryWeight(team.sessionId, { batchId: batch.id, dried: 30 });
    system.moveBatchToStock(team.sessionId, { batchId: batch.id, productId: product.id });
    store.close();

    const reloadedStore = new SqliteStateStore({ filePath: dbFile });
    const reloaded = reloadedStore.load();
    assert.equal(reloadedStore.schemaVersion(), SQLITE_SCHEMA_VERSION);
    assert.deepEqual(
      reloadedStore.migrations().map((row) => ({ ...row })),
      [
        {
          version: 1,
          name: "initial_json_state_schema",
          appliedAt: "2026-05-07T15:00:00.000Z",
        },
        {
          version: SQLITE_SCHEMA_VERSION,
          name: "support_messages_thread",
          appliedAt: "2026-05-07T15:00:00.000Z",
        },
      ],
    );
    assert.equal(
      reloaded.patients.some((item) => item.memberCode === "APO-3001"),
      true,
    );
    assert.equal(reloaded.teamUsers[0].email, "admin@apoiar.test");
    assert.equal(reloaded.teamUsers[0].passwordHash.startsWith("scrypt:"), true);
    assert.equal(reloaded.products.find((item) => item.id === product.id).stock, 35);
    assert.equal(reloaded.orders.find((item) => item.id === checkout.order.id).status, "sent");
    assert.equal(reloaded.payments.find((item) => item.id === checkout.payment.id).status, "paid");
    assert.equal(
      reloaded.supportTickets.find((item) => item.id === ticket.id).subject,
      "Persistir atendimento",
    );
    assert.equal(reloaded.prescriptionDocuments.length, 1);
    assert.equal(
      reloaded.memberships.find((item) => item.memberCode === "APO-3001").cardNumber,
      "AV-APO-3001-20270101",
    );
    assert.equal(
      reloaded.shipments.find((item) => item.orderId === checkout.order.id).trackingCode,
      "BR999",
    );
    assert.equal(
      reloaded.cultivationBatches.find((item) => item.id === batch.id).status,
      "stocked",
    );
    assert.equal(reloaded.inventoryLots.find((item) => item.batchId === batch.id).quantity, 30);
    reloadedStore.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
