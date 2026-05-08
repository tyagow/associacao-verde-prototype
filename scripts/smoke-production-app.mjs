const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:4174";
const teamEmail = process.env.SMOKE_TEAM_EMAIL || process.env.TEAM_EMAIL || "equipe@apoiar.local";
const teamPassword =
  process.env.SMOKE_TEAM_PASSWORD || process.env.TEAM_PASSWORD || "apoio-equipe-dev";
const webhookSecret =
  process.env.SMOKE_PIX_WEBHOOK_SECRET || process.env.PIX_WEBHOOK_SECRET || "dev-webhook-secret";

const unique = Date.now();
const team = createClient();
const patient = createClient();

const results = [];

await step("health", async () => {
  const health = await request("/health");
  assert(health.ok === true, "health must be ok");
});

await step("public app routes do not expose operations", async () => {
  const routeMarkers = new Map([
    ["/", "Apoiar Brasil Operacao Privada"],
    ["/paciente", "Acesso seguro ao tratamento autorizado"],
    ["/equipe", "Acesso da equipe"],
  ]);
  for (const [route, marker] of routeMarkers) {
    const response = await rawRequest(route);
    assert(
      response.status === 200,
      `${route} should return private system route, got ${response.status}`,
    );
    assert(
      String(response.text).includes(marker),
      `${route} should return product route marker: ${marker}`,
    );
  }
  const home = await rawRequest("/");
  assert(!home.text.includes("/admin"), "public home must not link admin route");
  assert(
    !home.text.includes("/equipe/pacientes"),
    "public home must not expose patient-management route",
  );
  for (const route of [
    "/equipe/pacientes",
    "/equipe/estoque",
    "/equipe/pedidos",
    "/equipe/fulfillment",
    "/equipe/suporte",
    "/admin",
  ]) {
    const response = await rawRequest(route, { redirect: "manual" });
    assert(response.status === 308, `${route} should redirect before auth, got ${response.status}`);
    assert(
      response.location === "/equipe",
      `${route} should redirect to team login, got ${response.location}`,
    );
  }
});

await step("unauthorized catalog is blocked", async () => {
  const response = await rawRequest("/api/catalog");
  assert(response.status === 401, `expected 401, got ${response.status}`);
});

await step("blocked patient can request access recovery without catalog", async () => {
  const recovery = await request("/api/patient/access-recovery", {
    method: "POST",
    body: {
      memberCode: "APO-1999",
      inviteCode: "BLOQ2026",
      message: "Preciso revisar meu cadastro antes de acessar o portal.",
    },
  });
  assert(
    recovery.ticket.type === "access_recovery",
    "access recovery should create typed support ticket",
  );
  assert(recovery.ticket.status === "open", "access recovery ticket should start open");
  const blocked = createClient();
  const catalog = await blocked.requestRaw("/api/catalog");
  assert(
    catalog.status === 401,
    `access recovery must not create catalog session, got ${catalog.status}`,
  );
  globalThis.smokeRecoveryTicketId = recovery.ticket.id;
});

await step("login throttling blocks repeated failures", async () => {
  let blocked = null;
  for (let index = 0; index < 5; index += 1) {
    blocked = await rawRequest("/api/team/login", {
      method: "POST",
      body: { email: `blocked-${unique}@apoiar.local`, password: "wrong" },
    });
  }
  assert(
    blocked.status === 401,
    `fifth bad login should still be auth failure, got ${blocked.status}`,
  );
  const locked = await rawRequest("/api/team/login", {
    method: "POST",
    body: { email: `blocked-${unique}@apoiar.local`, password: "wrong" },
  });
  assert(locked.status === 429, `sixth bad login should be throttled, got ${locked.status}`);
});

await step("team login", async () => {
  await team.request("/api/team/login", {
    method: "POST",
    body: { email: teamEmail, password: teamPassword },
  });
});

await step("protected team routes render after login", async () => {
  const routeMarkers = new Map([
    ["/equipe/pacientes", "Acesso, receita e carteirinha"],
    ["/equipe/estoque", "Produtos, estoque e cultivo"],
    ["/equipe/pedidos", "Pedidos e Pix"],
    ["/equipe/fulfillment", "Fulfillment e envio"],
    ["/equipe/suporte", "Suporte ao paciente"],
    ["/admin", "Admin e compliance"],
  ]);
  for (const [route, marker] of routeMarkers) {
    const response = await team.requestRaw(route);
    assert(
      response.status === 200,
      `${route} should render after team login, got ${response.status}`,
    );
    assert(
      response.text.includes(marker),
      `${route} should include marker after team login: ${marker}`,
    );
  }
});

await step("admin readiness reports environment gates", async () => {
  const readiness = await team.request("/api/team/readiness");
  assert(readiness.paymentProvider, "readiness should include payment provider");
  assert(
    readiness.gates.some((gate) => gate.label === "Pix provider"),
    "readiness should include Pix provider gate",
  );
  const backupGate = readiness.gates.find((gate) => gate.label === "Backup/restore");
  assert(backupGate, "readiness should include backup gate");
  assert(
    backupGate.status === "ok",
    `backup gate should be ok after readiness drill, got ${backupGate.status}`,
  );
  assert(
    readiness.backupRestore?.ok === true,
    "readiness should include backup/restore drill evidence",
  );
  assert(
    readiness.backupRestore?.sha256?.length === 64,
    "backup evidence should include backup sha256",
  );
  const webhookGate = readiness.gates.find((gate) => gate.label === "Webhook Pix");
  assert(webhookGate, "readiness should include webhook gate");
  assert(
    webhookGate.status === "ok",
    `webhook gate should be ok after readiness drill, got ${webhookGate.status}`,
  );
  assert(
    readiness.webhookDrill?.ok === true,
    "readiness should include signed webhook drill evidence",
  );
  assert(
    readiness.webhookDrill?.unsignedStatus === 401,
    "webhook drill should prove unsigned webhook is blocked",
  );
  assert(
    readiness.webhookDrill?.signedStatus === 200,
    "webhook drill should prove signed webhook is accepted",
  );
  const deployGate = readiness.gates.find((gate) => gate.label === "Deploy/domain/logs");
  assert(deployGate, "readiness should include deploy/domain/logs gate");
  assert(
    deployGate.status === "ok",
    `deploy gate should be ok after deployment check, got ${deployGate.status}`,
  );
  assert(
    readiness.deploymentCheck?.ok === true,
    "readiness should include deployment check evidence",
  );
  assert(
    readiness.deploymentCheck?.catalogDeniedStatus === 401,
    "deployment check should prove catalog is denied without session",
  );
  const domainTlsGate = readiness.gates.find((gate) => gate.label === "Dominio/TLS");
  assert(domainTlsGate, "readiness should include domain/TLS gate");
  assert(
    domainTlsGate.status === "pending",
    "domain/TLS gate should stay pending until public HTTPS domain evidence is recorded",
  );
  const schemaGate = readiness.gates.find((gate) => gate.label === "Schema DB");
  assert(schemaGate, "readiness should include schema DB gate");
  assert(
    schemaGate.status === "ok",
    `schema gate should be ok after schema check, got ${schemaGate.status}`,
  );
  assert(readiness.schemaCheck?.ok === true, "readiness should include schema check evidence");
  assert(
    readiness.schemaCheck?.missingTables?.length === 0,
    "schema check should prove required tables are present",
  );
  const sessionGate = readiness.gates.find((gate) => gate.label === "Sessao/cookie");
  assert(sessionGate, "readiness should include session cookie gate");
  assert(
    sessionGate.status === "ok",
    `session cookie gate should be ok after session security check, got ${sessionGate.status}`,
  );
  assert(
    readiness.sessionSecurity?.ok === true,
    "readiness should include session security evidence",
  );
  assert(
    readiness.sessionSecurity?.cookie?.httpOnly === true,
    "session security evidence should prove HttpOnly cookie",
  );
  assert(
    readiness.sessionSecurity?.cookie?.sameSite === "Lax",
    "session security evidence should prove SameSite=Lax cookie",
  );
  assert(
    readiness.releaseGate?.ok === false,
    "release gate should block local release while external evidence is pending",
  );
  assert(
    readiness.releaseGate.checks.some(
      (check) => check.name === "Database schema" && check.ok === true,
    ),
    "release gate should include passing database schema check",
  );
  assert(
    readiness.releaseGate.checks.some(
      (check) => check.name === "Session cookie security" && check.ok === false,
    ),
    "release gate should keep session cookie security blocked until production Secure evidence exists",
  );
  assert(
    readiness.releaseGate.checks.some(
      (check) => check.name === "Provider approval" && check.ok === false,
    ),
    "release gate should include provider approval blocker",
  );
  assert(
    readiness.releaseGate.checks.some((check) => check.name === "Domain/TLS" && check.ok === false),
    "release gate should include domain/TLS blocker",
  );
  const providerGate = readiness.gates.find((gate) => gate.label === "Aceite do provider");
  assert(providerGate, "readiness should include provider approval gate");
  assert(
    providerGate.status === "pending",
    "provider gate should stay pending until formal approval evidence is recorded",
  );
  const badProviderApproval = await team.requestRaw("/api/team/readiness/provider-approval", {
    method: "POST",
    body: { provider: "asaas", status: "approved" },
  });
  assert(
    badProviderApproval.status === 400,
    `approved provider evidence without required proof should fail, got ${badProviderApproval.status}`,
  );
  const providerEvidence = await team.request("/api/team/readiness/provider-approval", {
    method: "POST",
    body: {
      provider: "asaas",
      status: "pending",
      accountStatus: "not-approved",
      evidenceRef: "smoke-provider-pending",
      termsRef: "",
      webhookDocsRef: "",
      settlementNotes: "",
    },
  });
  assert(
    providerEvidence.providerApproval.status === "pending",
    "provider evidence endpoint should persist pending status",
  );
  const backupOffsiteGate = readiness.gates.find((gate) => gate.label === "Backup offsite");
  assert(backupOffsiteGate, "readiness should include backup offsite gate");
  assert(
    backupOffsiteGate.status === "pending",
    "offsite backup gate should stay pending until offsite schedule evidence is recorded",
  );
  assert(
    readiness.backupSchedule?.status === "pending",
    "readiness should expose backup schedule evidence status",
  );
  const badBackupConfigured = await team.requestRaw("/api/team/readiness/backup-schedule", {
    method: "POST",
    body: { status: "configured", offsiteTargetRef: "smoke-target" },
  });
  assert(
    badBackupConfigured.status === 400,
    `configured offsite backup without required proof should fail, got ${badBackupConfigured.status}`,
  );
  const backupEvidence = await team.request("/api/team/readiness/backup-schedule", {
    method: "POST",
    body: {
      status: "pending",
      offsiteTargetRef: "smoke-offsite-pending",
      frequency: "",
      retention: "",
      encryptionRef: "",
      lastSuccessfulBackupAt: "",
      lastBackupRef: "",
      operatorRef: "smoke",
    },
  });
  assert(
    backupEvidence.backupSchedule.status === "pending",
    "backup schedule endpoint should persist pending status",
  );
});

await step("admin creates restricted team user", async () => {
  const created = await team.request("/api/team/users", {
    method: "POST",
    body: {
      name: "Smoke Estoque",
      email: `stock-${unique}@apoiar.local`,
      password: `Stock-${unique}`,
      role: "stock",
    },
  });
  assert(created.user.role === "stock", "created team user should keep stock role");
  const restricted = createClient();
  await restricted.request("/api/team/login", {
    method: "POST",
    body: { email: `stock-${unique}@apoiar.local`, password: `Stock-${unique}` },
  });
  const response = await restricted.requestRaw("/api/team/patients", {
    method: "POST",
    body: {
      name: "Paciente Sem Permissao",
      memberCode: `APO-DENY-${unique}`,
      inviteCode: `DENY${unique}`,
      prescriptionExpiresAt: "2027-01-31",
    },
  });
  assert(response.status === 403, `stock role should not create patients, got ${response.status}`);
  const readinessWrite = await restricted.requestRaw("/api/team/readiness/provider-approval", {
    method: "POST",
    body: { provider: "asaas", status: "pending" },
  });
  assert(
    readinessWrite.status === 403,
    `stock role should not write provider readiness evidence, got ${readinessWrite.status}`,
  );
  const deactivated = await team.request("/api/team/users/status", {
    method: "POST",
    body: { userId: created.user.id, status: "inactive" },
  });
  assert(deactivated.user.status === "inactive", "admin should deactivate team user");
  const revokedDashboard = await restricted.requestRaw("/api/team/dashboard");
  assert(
    revokedDashboard.status === 401,
    `deactivated team user session should be revoked, got ${revokedDashboard.status}`,
  );
  const inactiveLogin = await restricted.requestRaw("/api/team/login", {
    method: "POST",
    body: { email: `stock-${unique}@apoiar.local`, password: `Stock-${unique}` },
  });
  assert(
    inactiveLogin.status === 401,
    `inactive team user should not log in, got ${inactiveLogin.status}`,
  );
  const reset = await team.request("/api/team/users/password", {
    method: "POST",
    body: { userId: created.user.id, password: `Reset-${unique}-123` },
  });
  assert(reset.user.status === "active", "password reset should reactivate team user");
  const oldPasswordLogin = await restricted.requestRaw("/api/team/login", {
    method: "POST",
    body: { email: `stock-${unique}@apoiar.local`, password: `Stock-${unique}` },
  });
  assert(
    oldPasswordLogin.status === 401,
    `old team password should stop working, got ${oldPasswordLogin.status}`,
  );
  await restricted.request("/api/team/login", {
    method: "POST",
    body: { email: `stock-${unique}@apoiar.local`, password: `Reset-${unique}-123` },
  });
});

await step("create patient and member card", async () => {
  await team.request("/api/team/patients", {
    method: "POST",
    body: {
      name: "Smoke Paciente",
      memberCode: `APO-SMOKE-${unique}`,
      inviteCode: `SMOKE${unique}`,
      prescriptionExpiresAt: "2027-01-31",
      guardianName: "Responsavel Smoke",
      contactPhone: "(11) 90000-0000",
      city: "Sao Paulo",
      state: "SP",
      carePlan: "Plano smoke com receita conferida.",
    },
  });
  const card = await team.request("/api/team/member-cards", {
    method: "POST",
    body: {
      memberCode: `APO-SMOKE-${unique}`,
      cardNumber: `AV-SMOKE-${unique}`,
      expiresAt: "2027-01-31",
    },
  });
  assert(card.eligibility.allowed === true, "card should allow eligibility");
});

await step("team resets patient invite", async () => {
  const reset = await team.request("/api/team/patient-invite-reset", {
    method: "POST",
    body: {
      memberCode: `APO-SMOKE-${unique}`,
      inviteCode: `RESET${unique}`,
    },
  });
  assert(
    reset.inviteCode === `RESET${unique}`,
    "invite reset should return the new one-time code to the team",
  );
  const oldLogin = await rawRequest("/api/patient/login", {
    method: "POST",
    body: {
      memberCode: `APO-SMOKE-${unique}`,
      inviteCode: `SMOKE${unique}`,
    },
  });
  assert(oldLogin.status === 401, `old invite should stop working, got ${oldLogin.status}`);
});

await step("register prescription document", async () => {
  const fileText = `Receita smoke ${unique}`;
  const rx = await team.request("/api/team/prescription-documents", {
    method: "POST",
    body: {
      memberCode: `APO-SMOKE-${unique}`,
      fileName: "receita-smoke.pdf",
      mimeType: "application/pdf",
      fileContentBase64: Buffer.from(fileText).toString("base64"),
      expiresAt: "2027-01-31",
    },
  });
  assert(rx.document.sha256.length === 64, "prescription document needs sha256");
  const download = await team.requestRaw(
    `/api/team/prescription-documents/${rx.document.id}/download`,
  );
  assert(download.status === 200, `document download should be 200, got ${download.status}`);
  assert(download.text === fileText, "downloaded document content should match uploaded content");
});

await step("create product and cultivation stock lot", async () => {
  const product = await team.request("/api/team/products", {
    method: "POST",
    body: {
      name: `Produto Smoke ${unique}`,
      unit: "g",
      priceReais: 10,
      stock: 5,
      category: "flower",
      lowStockThreshold: 4,
      controlled: "true",
      internalNote: "Smoke produto controlado com lote rastreavel.",
    },
  });
  assert(product.product.category === "flower", "product category should persist");
  assert(product.product.lowStockThreshold === 4, "product low-stock threshold should persist");
  assert(product.product.controlled === true, "controlled product flag should persist");
  assert(
    product.product.internalNote.includes("rastreavel"),
    "product internal note should persist",
  );
  const batch = await team.request("/api/team/cultivation-batches", {
    method: "POST",
    body: {
      strain: `Cultivar Smoke ${unique}`,
      productId: product.product.id,
      plants: 2,
      week: 9,
    },
  });
  await team.request("/api/team/cultivation-batches/harvest", {
    method: "POST",
    body: { batchId: batch.batch.id, harvested: 80 },
  });
  await team.request("/api/team/cultivation-batches/dry", {
    method: "POST",
    body: { batchId: batch.batch.id, dried: 20 },
  });
  const stocked = await team.request("/api/team/cultivation-batches/stock", {
    method: "POST",
    body: { batchId: batch.batch.id, productId: product.product.id },
  });
  assert(stocked.product.stock === 25, "product stock should include dried lot");
  globalThis.smokeProductId = product.product.id;
});

await step("patient login and checkout", async () => {
  await patient.request("/api/patient/login", {
    method: "POST",
    body: {
      memberCode: `APO-SMOKE-${unique}`,
      inviteCode: `RESET${unique}`,
    },
  });
  const consent = await patient.request("/api/patient/consent", {
    method: "POST",
    body: { accepted: true, version: "lgpd-2026-05" },
  });
  assert(
    consent.patient.privacyConsentVersion === "lgpd-2026-05",
    "patient consent should persist version",
  );
  const ticket = await patient.request("/api/support-requests", {
    method: "POST",
    body: {
      subject: `Suporte smoke ${unique}`,
      message: "Paciente pediu acompanhamento sobre Pix e entrega.",
      priority: "high",
    },
  });
  assert(ticket.ticket.status === "open", "support request should start open");
  globalThis.smokeSupportTicketId = ticket.ticket.id;
  const checkout = await patient.request("/api/checkout", {
    method: "POST",
    body: {
      deliveryMethod: "GED Log via Melhor Envio",
      items: [{ productId: globalThis.smokeProductId, quantity: 3 }],
    },
  });
  assert(checkout.order.status === "awaiting_payment", "checkout should await payment");
  globalThis.smokePaymentId = checkout.payment.providerPaymentId;
  globalThis.smokeOrderId = checkout.order.id;
  const cancelledCheckout = await patient.request("/api/checkout", {
    method: "POST",
    body: {
      deliveryMethod: "Retirada combinada",
      items: [{ productId: globalThis.smokeProductId, quantity: 1 }],
    },
  });
  assert(
    cancelledCheckout.order.status === "awaiting_payment",
    "cancel checkout should await payment",
  );
  globalThis.smokeCancelledOrderId = cancelledCheckout.order.id;
});

await step("team cancels unpaid order and releases reservation", async () => {
  const cancelled = await team.request("/api/team/orders/cancel", {
    method: "POST",
    body: {
      orderId: globalThis.smokeCancelledOrderId,
      reason: "Smoke cancelamento antes do Pix.",
    },
  });
  assert(cancelled.order.status === "cancelled", "unpaid cancellation should mark order cancelled");
  assert(
    cancelled.order.exceptions?.[0]?.type === "cancelamento",
    "cancellation should keep exception note",
  );
});

await step("unsigned webhook is blocked", async () => {
  const response = await rawRequest("/api/webhooks/pix", {
    method: "POST",
    body: { paymentId: globalThis.smokePaymentId, eventId: `bad-${unique}`, status: "paid" },
  });
  assert(response.status === 401, `expected unsigned webhook 401, got ${response.status}`);
});

await step("team can reconcile pending provider payment", async () => {
  const reconciled = await team.request("/api/team/payments/reconcile", {
    method: "POST",
    body: { paymentId: globalThis.smokePaymentId },
  });
  assert(
    reconciled.status === "provider_pending",
    `expected provider_pending, got ${reconciled.status}`,
  );
  assert(
    reconciled.payment.lastProviderStatus === "DEV_PENDING",
    "reconciliation should store provider status",
  );
});

await step("signed webhook confirms payment", async () => {
  const paid = await request("/api/webhooks/pix", {
    method: "POST",
    headers: { "x-webhook-secret": webhookSecret },
    body: {
      payment: { id: globalThis.smokePaymentId, status: "RECEIVED" },
      id: `smoke-paid-${unique}`,
    },
  });
  assert(
    paid.order.status === "paid_pending_fulfillment",
    "paid webhook should move order to fulfillment",
  );
});

await step("shipment closes fulfillment", async () => {
  const shipped = await team.request("/api/team/shipments", {
    method: "POST",
    body: {
      orderId: globalThis.smokeOrderId,
      carrier: "GED Log",
      service: "Melhor Envio",
      trackingCode: `BR${unique}`,
      status: "sent",
    },
  });
  assert(shipped.order.status === "sent", "shipment should mark order sent");
});

await step("team records paid fulfillment exception without silent restock", async () => {
  const exception = await team.request("/api/team/orders/exception", {
    method: "POST",
    body: {
      orderId: globalThis.smokeOrderId,
      type: "transportadora",
      note: "Smoke anotacao apos envio para auditoria operacional.",
    },
  });
  assert(
    exception.order.exceptions?.some((item) => item.type === "transportadora"),
    "order should keep fulfillment exception note",
  );
});

await step("dashboard reflects full workflow", async () => {
  const dashboard = await team.request("/api/team/dashboard");
  const patientRecord = dashboard.patients.find(
    (item) => item.memberCode === `APO-SMOKE-${unique}`,
  );
  assert(
    patientRecord?.carePlan === "Plano smoke com receita conferida.",
    "dashboard should expose managed patient profile care plan",
  );
  assert(
    patientRecord?.guardianName === "Responsavel Smoke",
    "dashboard should expose managed patient guardian",
  );
  assert(
    patientRecord?.privacyConsentVersion === "lgpd-2026-05",
    "dashboard should expose patient privacy consent",
  );
  assert(
    dashboard.supportTickets.some(
      (item) => item.id === globalThis.smokeSupportTicketId && item.status === "open",
    ),
    "dashboard should include patient support request",
  );
  assert(
    dashboard.supportTickets.some(
      (item) => item.id === globalThis.smokeRecoveryTicketId && item.type === "access_recovery",
    ),
    "dashboard should include blocked patient access recovery",
  );
  const product = dashboard.products.find((item) => item.id === globalThis.smokeProductId);
  assert(product.stock === 22, `expected stock 22 after checkout, got ${product?.stock}`);
  assert(product.category === "flower", "dashboard should expose product category");
  assert(product.lowStockThreshold === 4, "dashboard should expose product low-stock threshold");
  assert(
    dashboard.orders.some((item) => item.id === globalThis.smokeOrderId && item.status === "sent"),
    "sent order missing",
  );
  assert(
    dashboard.orders.some(
      (item) => item.id === globalThis.smokeCancelledOrderId && item.status === "cancelled",
    ),
    "cancelled order missing",
  );
  assert(
    dashboard.shipments.some((item) => item.orderId === globalThis.smokeOrderId),
    "shipment missing",
  );
});

console.log(JSON.stringify({ ok: true, baseUrl, results }, null, 2));

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
    async requestRaw(path, options = {}) {
      const response = await rawRequest(path, { ...options, cookie });
      if (response.cookie) cookie = response.cookie;
      return response;
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
    location: response.headers.get("location") || "",
    cookie,
    text,
    payload,
  };
}

async function step(name, fn) {
  await fn();
  results.push(name);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
