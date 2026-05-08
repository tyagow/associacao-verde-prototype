import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createInitialState } from "../src/production-system.ts";
import { SqliteStateStore } from "../src/sqlite-store.ts";

const [, , inputFile, dbFile] = process.argv;

if (!inputFile || !dbFile) {
  console.error("Uso: node scripts/import-archive.mjs <archive-export.json> <target.sqlite>");
  process.exit(2);
}

const exported = JSON.parse(readFileSync(inputFile, "utf8"));
const archive = exported.state || exported;
const now = new Date();
const state = createInitialState(now);

state.meta = {
  ...state.meta,
  importedFromArchiveAt: now.toISOString(),
  importSource: inputFile,
};
state.sessions = [];
state.orders = [];
state.payments = [];
state.paymentEvents = [];
state.stockReservations = [];
state.stockMovements = [];
state.auditLog = [];

if (Array.isArray(archive.products)) {
  state.products = archive.products.map((product) => ({
    id: product.id || slug(product.name),
    name: product.name,
    description:
      product.description || "Produto importado do arquivo historico para conferencia da equipe.",
    unit: product.unit || "un",
    priceCents: Math.round(Number(product.price || product.priceReais || 0) * 100),
    stock: Number(product.stock || 0),
    active: product.active !== false,
  }));
  state.stockMovements.push(
    ...state.products.map((product) =>
      movement(
        product.id,
        "in",
        product.stock,
        "Estoque inicial importado do arquivo historico",
        now,
      ),
    ),
  );
}

const importedPatients = new Map();
if (Array.isArray(archive.patients)) {
  state.patients = archive.patients.map((patient, index) => {
    const memberCode = patient.memberCode || `IMPORT-${index + 1}`;
    const next = {
      id: `import_patient_${slug(memberCode)}`,
      name: patient.name,
      memberCode,
      inviteCode: `IMPORT-${randomUUID().slice(0, 8).toUpperCase()}`,
      status: "active",
      associationEligible: true,
      prescriptionExpiresAt: patient.prescription || patient.prescriptionExpiresAt || "2026-12-31",
      cardExpiresAt:
        patient.cardExpiresAt ||
        patient.prescription ||
        patient.prescriptionExpiresAt ||
        "2026-12-31",
      guardianName: patient.guardian || patient.guardianName || "",
    };
    importedPatients.set(next.name, next);
    importedPatients.set(next.memberCode, next);
    return next;
  });
}

if (Array.isArray(archive.orders)) {
  for (const order of archive.orders) {
    let patient = importedPatients.get(order.patient) || importedPatients.get(order.memberCode);
    if (!patient) {
      patient = {
        id: `import_patient_${slug(order.memberCode || order.patient || randomUUID())}`,
        name: order.patient || "Paciente importado",
        memberCode: order.memberCode || `IMPORT-${randomUUID().slice(0, 8).toUpperCase()}`,
        inviteCode: `IMPORT-${randomUUID().slice(0, 8).toUpperCase()}`,
        status: "active",
        associationEligible: true,
        prescriptionExpiresAt: "2026-12-31",
        cardExpiresAt: "2026-12-31",
        guardianName: "",
      };
      state.patients.push(patient);
      importedPatients.set(patient.name, patient);
      importedPatients.set(patient.memberCode, patient);
    }

    const orderItems = (order.items || []).map((item) => {
      const product =
        state.products.find((candidate) => candidate.name === item.name) || state.products[0];
      return {
        productId: product?.id || slug(item.name),
        name: item.name,
        unit: item.unit || product?.unit || "un",
        quantity: Number(item.quantity || 1),
        unitPriceCents: Math.round(Number(item.subtotal || 0) * 100) / Number(item.quantity || 1),
        subtotalCents: Math.round(Number(item.subtotal || 0) * 100),
      };
    });
    const paymentId = `import_payment_${slug(order.id || randomUUID())}`;
    state.orders.push({
      id: order.id || `IMPORT-${randomUUID().slice(0, 8)}`,
      patientId: patient.id,
      patientName: patient.name,
      memberCode: patient.memberCode,
      items: orderItems,
      totalCents: Math.round(Number(order.total || 0) * 100),
      deliveryMethod: order.delivery || order.shipping || "Importado do arquivo historico",
      status: "imported_confirmed",
      reservationId: "",
      paymentId,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    state.payments.push({
      id: paymentId,
      provider: "imported",
      providerPaymentId: paymentId,
      orderId: order.id,
      status: "paid",
      amountCents: Math.round(Number(order.total || 0) * 100),
      expiresAt: now.toISOString(),
      pix: null,
      createdAt: now.toISOString(),
    });
  }
}

if (Array.isArray(archive.batches)) {
  state.cultivationBatches = archive.batches.map((batch) => ({
    id: `import_batch_${slug(batch.id || batch.strain)}`,
    strain: batch.strain,
    productId: state.products.find((product) => product.name.includes(batch.strain))?.id || "",
    week: Number(batch.week || 1),
    plants: Number(batch.plants || 0),
    harvested: Number(batch.harvested || 0),
    dried: Number(batch.dried || 0),
    status: batch.dried ? "dried" : batch.harvested ? "harvested" : "growing",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }));
}

if (Array.isArray(archive.stock)) {
  for (const stock of archive.stock) {
    const productId = slug(stock.strain);
    if (!state.products.some((product) => product.id === productId)) {
      state.products.push({
        id: productId,
        name: stock.strain,
        description: "Estoque importado do arquivo historico operacional.",
        unit: "g",
        priceCents: 0,
        stock: Number(stock.grams || 0),
        active: false,
      });
    }
  }
}

state.auditLog.push({
  id: randomUUID(),
  action: "archive_imported",
  actor: "migration",
  details: {
    patients: state.patients.length,
    products: state.products.length,
    orders: state.orders.length,
    cultivationBatches: state.cultivationBatches.length,
  },
  at: now.toISOString(),
});

const store = new SqliteStateStore({ filePath: dbFile, now: () => now });
store.save(state);
store.close();

console.log(
  JSON.stringify(
    {
      ok: true,
      dbFile,
      patients: state.patients.length,
      products: state.products.length,
      orders: state.orders.length,
      cultivationBatches: state.cultivationBatches.length,
    },
    null,
    2,
  ),
);

function movement(productId, type, quantity, note, date) {
  return {
    id: randomUUID(),
    productId,
    type,
    quantity,
    note,
    date: date.toISOString().slice(0, 10),
  };
}

function slug(value) {
  return String(value || "importado")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
