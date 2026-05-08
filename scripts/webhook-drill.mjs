import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

if (
  process.env.NODE_ENV === "production" &&
  process.env.ALLOW_PRODUCTION_WEBHOOK_DRILL !== "true"
) {
  console.error(
    "Refusing to run webhook drill with NODE_ENV=production without ALLOW_PRODUCTION_WEBHOOK_DRILL=true.",
  );
  process.exit(1);
}

const baseUrl = process.env.READINESS_BASE_URL || "http://127.0.0.1:4174";
const teamEmail =
  process.env.READINESS_TEAM_EMAIL || process.env.TEAM_EMAIL || "equipe@apoiar.local";
const teamPassword =
  process.env.READINESS_TEAM_PASSWORD || process.env.TEAM_PASSWORD || "apoio-equipe-dev";
const webhookSecret =
  process.env.READINESS_PIX_WEBHOOK_SECRET ||
  process.env.PIX_WEBHOOK_SECRET ||
  "dev-webhook-secret";
const evidenceFile = resolve(
  process.env.WEBHOOK_DRILL_EVIDENCE || join(root, "artifacts", "readiness", "webhook-drill.json"),
);
const unique = Date.now();
const startedAt = Date.now();
const team = createClient();
const patient = createClient();

try {
  await request("/health");
  await team.request("/api/team/login", {
    method: "POST",
    body: { email: teamEmail, password: teamPassword },
  });

  await team.request("/api/team/patients", {
    method: "POST",
    body: {
      name: "Drill Webhook Pix",
      memberCode: `APO-WEBHOOK-${unique}`,
      inviteCode: `WEBHOOK${unique}`,
      prescriptionExpiresAt: "2027-01-31",
      guardianName: "Operacao Apoiar",
      carePlan: "Paciente tecnico usado para prova de webhook Pix assinado.",
    },
  });
  await team.request("/api/team/member-cards", {
    method: "POST",
    body: {
      memberCode: `APO-WEBHOOK-${unique}`,
      cardNumber: `AV-WEBHOOK-${unique}`,
      expiresAt: "2027-01-31",
    },
  });
  const product = await team.request("/api/team/products", {
    method: "POST",
    body: {
      name: `Produto Webhook Drill ${unique}`,
      unit: "g",
      priceReais: 15,
      stock: 6,
    },
  });

  await patient.request("/api/patient/login", {
    method: "POST",
    body: {
      memberCode: `APO-WEBHOOK-${unique}`,
      inviteCode: `WEBHOOK${unique}`,
    },
  });
  await patient.request("/api/patient/consent", {
    method: "POST",
    body: { accepted: true, version: "lgpd-2026-05" },
  });
  const checkout = await patient.request("/api/checkout", {
    method: "POST",
    body: {
      deliveryMethod: "GED Log via Melhor Envio",
      items: [{ productId: product.product.id, quantity: 2 }],
    },
  });

  const unsigned = await rawRequest("/api/webhooks/pix", {
    method: "POST",
    body: {
      paymentId: checkout.payment.providerPaymentId,
      eventId: `unsigned-${unique}`,
      status: "paid",
    },
  });
  assert(unsigned.status === 401, `unsigned webhook should be 401, got ${unsigned.status}`);

  const signed = await request("/api/webhooks/pix", {
    method: "POST",
    headers: { "x-webhook-secret": webhookSecret },
    body: {
      payment: { id: checkout.payment.providerPaymentId, status: "RECEIVED" },
      id: `webhook-drill-${unique}`,
    },
  });
  assert(
    signed.order.status === "paid_pending_fulfillment",
    `signed webhook should mark fulfillment, got ${signed.order.status}`,
  );

  const dashboard = await team.request("/api/team/dashboard");
  const finalProduct = dashboard.products.find((item) => item.id === product.product.id);
  assert(
    finalProduct?.stock === 4,
    `stock should decrement to 4 after paid webhook, got ${finalProduct?.stock}`,
  );

  const evidence = {
    ok: true,
    checkedAt: new Date().toISOString(),
    baseUrl,
    orderId: checkout.order.id,
    paymentId: checkout.payment.providerPaymentId,
    productId: product.product.id,
    unsignedStatus: unsigned.status,
    signedStatus: 200,
    finalOrderStatus: signed.order.status,
    stockAfterPayment: finalProduct.stock,
    durationMs: Date.now() - startedAt,
  };

  await mkdir(dirname(evidenceFile), { recursive: true });
  await writeFile(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  console.log(
    JSON.stringify(
      { ok: true, evidenceFile, orderId: evidence.orderId, paymentId: evidence.paymentId },
      null,
      2,
    ),
  );
} catch (error) {
  const evidence = {
    ok: false,
    checkedAt: new Date().toISOString(),
    baseUrl,
    error: error.message,
    durationMs: Date.now() - startedAt,
  };
  await mkdir(dirname(evidenceFile), { recursive: true });
  await writeFile(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  console.error(JSON.stringify(evidence, null, 2));
  process.exit(1);
}

function createClient() {
  let cookie = "";
  return {
    async request(path, options = {}) {
      const response = await rawRequest(path, { ...options, cookie });
      if (response.cookie) cookie = response.cookie;
      if (!response.ok)
        throw new Error(`${path} returned ${response.status}: ${JSON.stringify(response.payload)}`);
      return response.payload;
    },
  };
}

async function request(path, options = {}) {
  const response = await rawRequest(path, options);
  if (!response.ok)
    throw new Error(`${path} returned ${response.status}: ${JSON.stringify(response.payload)}`);
  return response.payload;
}

async function rawRequest(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body) headers["content-type"] = "application/json";
  if (options.cookie) headers.cookie = options.cookie;
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || "GET",
    redirect: options.redirect || "follow",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const cookie = response.headers.get("set-cookie")?.split(";")[0] || "";
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  return {
    ok: response.ok,
    status: response.status,
    cookie,
    text,
    payload,
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
