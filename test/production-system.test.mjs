import assert from "node:assert/strict";
import test from "node:test";
import {
  createAsaasPixProvider,
  createDevPixProvider,
  createInitialState,
  ProductionSystem,
} from "../src/production-system.ts";

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

test("patient login requires valid invite, active status, association, prescription, and card", () => {
  const { system } = harness();

  assert.throws(
    () => system.loginPatient({ memberCode: "APO-1027", inviteCode: "ERRADO" }),
    /Credenciais de paciente invalidas/,
  );

  assert.throws(
    () => system.loginPatient({ memberCode: "APO-1999", inviteCode: "BLOQ2026" }),
    /Cadastro de paciente inativo/,
  );

  const result = system.loginPatient({ memberCode: "APO-1027", inviteCode: "HELENA2026" });
  assert.equal(result.patient.name, "Helena Rocha");
});

test("expired prescription blocks patient access", () => {
  const { system } = harness("2026-10-01T12:00:00-03:00");

  assert.throws(
    () => system.loginPatient({ memberCode: "APO-1027", inviteCode: "HELENA2026" }),
    /Receita medica vencida/,
  );
});

test("blocked or expired patient can request access recovery without catalog access", () => {
  const { system } = harness("2026-10-01T12:00:00-03:00");
  const team = system.loginTeam({ password: "secret" }, "secret");

  assert.throws(
    () => system.loginPatient({ memberCode: "APO-1027", inviteCode: "HELENA2026" }),
    /Receita medica vencida/,
  );
  const ticket = system.createAccessRecoveryRequest({
    memberCode: "APO-1027",
    inviteCode: "HELENA2026",
    message: "Minha receita foi renovada e preciso liberar o portal.",
  });

  assert.equal(ticket.type, "access_recovery");
  assert.equal(ticket.priority, "high");
  assert.match(ticket.accessReason, /Receita medica vencida/);
  assert.equal(
    system.dashboard(team.sessionId).supportTickets.some((item) => item.id === ticket.id),
    true,
  );
  assert.equal(
    system.state.auditLog.some((event) => event.action === "patient_access_recovery_requested"),
    true,
  );
});

test("access recovery rejects invalid patient credentials", () => {
  const { system } = harness();

  assert.throws(
    () => system.createAccessRecoveryRequest({ memberCode: "APO-1027", inviteCode: "ERRADO" }),
    /Credenciais de paciente invalidas/,
  );
});

test("checkout reserves available stock without decrementing physical stock", async () => {
  const { system, state } = harness();
  const { sessionId } = system.loginPatient({ memberCode: "APO-1027", inviteCode: "HELENA2026" });

  const before = state.products.find((product) => product.id === "flor-24k").stock;
  const result = await system.createCheckout(sessionId, {
    deliveryMethod: "GED Log via Melhor Envio",
    items: [{ productId: "flor-24k", quantity: 3 }],
  });

  const after = state.products.find((product) => product.id === "flor-24k").stock;
  assert.equal(before, 92);
  assert.equal(after, 92);
  assert.equal(result.order.status, "awaiting_payment");
  assert.equal(system.availableStock("flor-24k"), 89);
});

test("team dashboard exposes patient support login and reservation context", async () => {
  const { system } = harness();
  const team = system.loginTeam({ password: "secret" }, "secret");
  const patient = system.loginPatient({ memberCode: "APO-1027", inviteCode: "HELENA2026" });
  const checkout = await system.createCheckout(patient.sessionId, {
    deliveryMethod: "GED Log via Melhor Envio",
    items: [{ productId: "oleo-cbd-10", quantity: 1 }],
  });

  const dashboard = system.dashboard(team.sessionId);
  const patientRow = dashboard.patients.find((item) => item.memberCode === "APO-1027");
  const reservation = dashboard.reservations.find((item) => item.orderId === checkout.order.id);

  assert.equal(patientRow.lastLoginAt, "2026-05-07T15:00:00.000Z");
  assert.equal(patientRow.activeSession.expiresAt, "2026-05-07T23:00:00.000Z");
  assert.equal(reservation.patientId, patientRow.id);
  assert.equal(reservation.status, "active");
});

test("confirmed Pix webhook converts reservation and decrements stock once", async () => {
  const { system, state } = harness();
  const { sessionId } = system.loginPatient({ memberCode: "APO-1027", inviteCode: "HELENA2026" });
  const checkout = await system.createCheckout(sessionId, {
    deliveryMethod: "Retirada combinada",
    items: [{ productId: "oleo-cbd-10", quantity: 2 }],
  });

  const first = system.confirmPixPayment({
    paymentId: checkout.payment.id,
    eventId: "evt-paid-1",
    status: "paid",
  });
  assert.equal(first.order.status, "paid_pending_fulfillment");
  assert.equal(state.products.find((product) => product.id === "oleo-cbd-10").stock, 21);

  const duplicate = system.confirmPixPayment({
    paymentId: checkout.payment.id,
    eventId: "evt-paid-1",
    status: "paid",
  });
  assert.equal(duplicate.duplicate, true);
  assert.equal(state.products.find((product) => product.id === "oleo-cbd-10").stock, 21);
});

test("team reconciliation confirms paid provider status and decrements stock once", async () => {
  const { system, state } = harness();
  system.paymentProvider = {
    ...createDevPixProvider(),
    async getPaymentStatus(providerPaymentId) {
      return { providerPaymentId, status: "RECEIVED", rawStatus: "RECEIVED" };
    },
  };
  const team = system.loginTeam({ password: "secret" }, "secret");
  const patient = system.loginPatient({ memberCode: "APO-1027", inviteCode: "HELENA2026" });
  const checkout = await system.createCheckout(patient.sessionId, {
    items: [{ productId: "oleo-cbd-10", quantity: 2 }],
  });

  const reconciled = await system.reconcilePayment(team.sessionId, {
    paymentId: checkout.payment.id,
  });
  assert.equal(reconciled.status, "paid");
  assert.equal(reconciled.order.status, "paid_pending_fulfillment");
  assert.equal(state.products.find((product) => product.id === "oleo-cbd-10").stock, 21);

  const duplicate = await system.reconcilePayment(team.sessionId, {
    paymentId: checkout.payment.id,
  });
  assert.equal(duplicate.status, "already_paid");
  assert.equal(state.products.find((product) => product.id === "oleo-cbd-10").stock, 21);
  assert.equal(
    state.auditLog.some((event) => event.action === "payment_reconciled"),
    true,
  );
});

test("team reconciliation expires local pending payment when provider is overdue", async () => {
  const { system, state } = harness();
  system.paymentProvider = {
    ...createDevPixProvider(),
    async getPaymentStatus(providerPaymentId) {
      return { providerPaymentId, status: "OVERDUE", rawStatus: "OVERDUE" };
    },
  };
  const team = system.loginTeam({ password: "secret" }, "secret");
  const patient = system.loginPatient({ memberCode: "APO-1027", inviteCode: "HELENA2026" });
  const checkout = await system.createCheckout(patient.sessionId, {
    items: [{ productId: "oleo-full-20", quantity: 3 }],
  });

  assert.equal(system.availableStock("oleo-full-20"), 10);
  const reconciled = await system.reconcilePayment(team.sessionId, {
    paymentId: checkout.payment.id,
  });
  const reservation = state.stockReservations.find(
    (item) => item.id === checkout.order.reservationId,
  );

  assert.equal(reconciled.status, "expired");
  assert.equal(reconciled.order.status, "payment_expired");
  assert.equal(reservation.status, "expired");
  assert.equal(system.availableStock("oleo-full-20"), 13);
  assert.equal(state.products.find((product) => product.id === "oleo-full-20").stock, 13);
});

test("team reconciliation records exception when provider paid after reservation expired", async () => {
  let current = new Date("2026-05-07T12:00:00-03:00");
  const state = createInitialState(current);
  state.meta.reservationMinutes = 1;
  const system = new ProductionSystem({
    state,
    now: () => current,
    paymentProvider: {
      ...createDevPixProvider({ now: () => current }),
      async getPaymentStatus(providerPaymentId) {
        return { providerPaymentId, status: "RECEIVED", rawStatus: "RECEIVED" };
      },
    },
  });
  const team = system.loginTeam({ password: "secret" }, "secret");
  const patient = system.loginPatient({ memberCode: "APO-1027", inviteCode: "HELENA2026" });
  const checkout = await system.createCheckout(patient.sessionId, {
    items: [{ productId: "flor-24k", quantity: 1 }],
  });
  current = new Date("2026-05-07T12:02:00-03:00");
  system.expireReservations();

  const reconciled = await system.reconcilePayment(team.sessionId, {
    paymentId: checkout.payment.id,
  });
  assert.equal(reconciled.status, "exception");
  assert.match(reconciled.error, /Reserva de estoque nao esta ativa|Reserva de estoque expirada/);
  assert.equal(
    state.payments.find((payment) => payment.id === checkout.payment.id).reconciliationStatus,
    "exception",
  );
  assert.equal(state.products.find((product) => product.id === "flor-24k").stock, 92);
  assert.equal(
    state.auditLog.some((event) => event.action === "payment_reconciliation_exception"),
    true,
  );
});

test("second checkout cannot consume active reservation stock", async () => {
  const { system } = harness();
  const helena = system.loginPatient({ memberCode: "APO-1027", inviteCode: "HELENA2026" });
  const joao = system.loginPatient({ memberCode: "APO-1028", inviteCode: "JOAO2026" });

  await system.createCheckout(helena.sessionId, {
    items: [{ productId: "oleo-full-20", quantity: 12 }],
  });

  await assert.rejects(
    () =>
      system.createCheckout(joao.sessionId, {
        items: [{ productId: "oleo-full-20", quantity: 2 }],
      }),
    /Estoque insuficiente/,
  );
});

test("expired reservation releases stock and expires order plus payment", async () => {
  let current = new Date("2026-05-07T12:00:00-03:00");
  const state = createInitialState(current);
  state.meta.reservationMinutes = 1;
  const system = new ProductionSystem({
    state,
    now: () => current,
  });
  const helena = system.loginPatient({ memberCode: "APO-1027", inviteCode: "HELENA2026" });
  const checkout = await system.createCheckout(helena.sessionId, {
    items: [{ productId: "oleo-full-20", quantity: 12 }],
  });

  assert.equal(system.availableStock("oleo-full-20"), 1);
  current = new Date("2026-05-07T12:02:00-03:00");
  system.expireReservations();

  const reservation = state.stockReservations.find(
    (item) => item.id === checkout.order.reservationId,
  );
  const order = state.orders.find((item) => item.id === checkout.order.id);
  const payment = state.payments.find((item) => item.id === checkout.payment.id);
  assert.equal(reservation.status, "expired");
  assert.equal(order.status, "payment_expired");
  assert.equal(payment.status, "expired");
  assert.equal(system.availableStock("oleo-full-20"), 13);
  assert.equal(
    state.auditLog.some((event) => event.action === "reservation_expired"),
    true,
  );
});

test("team stock entry requires team session", () => {
  const { system, state } = harness();
  const patient = system.loginPatient({ memberCode: "APO-1027", inviteCode: "HELENA2026" });

  assert.throws(
    () => system.addStock(patient.sessionId, { productId: "flor-24k", quantity: 10 }),
    /Login da equipe obrigatorio/,
  );

  const team = system.loginTeam({ password: "secret" }, "secret");
  system.addStock(team.sessionId, { productId: "flor-24k", quantity: 10, note: "lote seco" });
  assert.equal(state.products.find((product) => product.id === "flor-24k").stock, 102);
});

test("team users are persisted with hashed passwords and email login", () => {
  const { system, state } = harness();
  const bootstrap = system.ensureTeamUser({
    email: "admin@apoiar.test",
    password: "secret",
    name: "Admin",
  });

  assert.equal(bootstrap.email, "admin@apoiar.test");
  assert.equal(state.teamUsers[0].passwordHash.startsWith("scrypt:"), true);
  assert.equal(state.teamUsers[0].passwordHash.includes("secret"), false);
  assert.throws(
    () => system.loginTeam({ email: "admin@apoiar.test", password: "wrong" }),
    /Credenciais da equipe invalidas/,
  );

  const login = system.loginTeam({ email: "admin@apoiar.test", password: "secret" });
  const session = system.getSession(login.sessionId);
  assert.equal(session.user.email, "admin@apoiar.test");
});

test("team roles enforce operation-specific permissions", () => {
  const { system, state } = harness();
  system.ensureTeamUser({
    email: "admin@apoiar.test",
    password: "secret",
    name: "Admin",
    role: "admin",
  });
  const admin = system.loginTeam({ email: "admin@apoiar.test", password: "secret" });

  system.createTeamUser(admin.sessionId, {
    name: "Estoque",
    email: "stock@apoiar.test",
    password: "stock-secret",
    role: "stock",
  });
  system.createTeamUser(admin.sessionId, {
    name: "Suporte",
    email: "support@apoiar.test",
    password: "support-secret",
    role: "support",
  });

  const stock = system.loginTeam({ email: "stock@apoiar.test", password: "stock-secret" });
  const support = system.loginTeam({ email: "support@apoiar.test", password: "support-secret" });

  assert.equal(system.dashboard(support.sessionId).products.length > 0, true);
  assert.throws(
    () => system.addStock(support.sessionId, { productId: "flor-24k", quantity: 1 }),
    /Permissao da equipe insuficiente/,
  );
  system.addStock(stock.sessionId, { productId: "flor-24k", quantity: 1 });
  assert.equal(state.products.find((product) => product.id === "flor-24k").stock, 93);
  assert.throws(
    () =>
      system.createPatient(stock.sessionId, {
        name: "Paciente Bloqueado Por Papel",
        memberCode: "APO-3001",
        inviteCode: "PAPEL2026",
        prescriptionExpiresAt: "2027-01-31",
      }),
    /Permissao da equipe insuficiente/,
  );
});

test("admin can deactivate team user and revoke active sessions", () => {
  const { system } = harness();
  system.ensureTeamUser({
    email: "admin@apoiar.test",
    password: "secret",
    name: "Admin",
    role: "admin",
  });
  const admin = system.loginTeam({ email: "admin@apoiar.test", password: "secret" });
  const created = system.createTeamUser(admin.sessionId, {
    name: "Operadora",
    email: "ops@apoiar.test",
    password: "ops-secret",
    role: "operations",
  });
  const ops = system.loginTeam({ email: "ops@apoiar.test", password: "ops-secret" });

  const deactivated = system.updateTeamUserStatus(admin.sessionId, {
    userId: created.id,
    status: "inactive",
  });
  assert.equal(deactivated.status, "inactive");
  assert.throws(() => system.dashboard(ops.sessionId), /Login da equipe obrigatorio/);
  assert.throws(
    () => system.loginTeam({ email: "ops@apoiar.test", password: "ops-secret" }),
    /Credenciais da equipe invalidas/,
  );

  const reactivated = system.updateTeamUserStatus(admin.sessionId, {
    userId: created.id,
    status: "active",
  });
  assert.equal(reactivated.status, "active");
  assert.equal(
    system.loginTeam({ email: "ops@apoiar.test", password: "ops-secret" }).sessionId.length > 0,
    true,
  );
  assert.throws(
    () =>
      system.updateTeamUserStatus(admin.sessionId, {
        userId: system.getSession(admin.sessionId).user.id,
        status: "inactive",
      }),
    /proprio usuario/,
  );
});

test("admin can reset team user password and revoke old sessions", () => {
  const { system } = harness();
  system.ensureTeamUser({
    email: "admin@apoiar.test",
    password: "secret",
    name: "Admin",
    role: "admin",
  });
  const admin = system.loginTeam({ email: "admin@apoiar.test", password: "secret" });
  const created = system.createTeamUser(admin.sessionId, {
    name: "Suporte Reset",
    email: "reset@apoiar.test",
    password: "old-secret-123",
    role: "support",
  });
  const oldSession = system.loginTeam({ email: "reset@apoiar.test", password: "old-secret-123" });

  assert.throws(
    () => system.resetTeamUserPassword(admin.sessionId, { userId: created.id, password: "short" }),
    /pelo menos 10/,
  );
  const reset = system.resetTeamUserPassword(admin.sessionId, {
    userId: created.id,
    password: "new-secret-123",
  });
  assert.equal(reset.status, "active");
  assert.throws(() => system.dashboard(oldSession.sessionId), /Login da equipe obrigatorio/);
  assert.throws(
    () => system.loginTeam({ email: "reset@apoiar.test", password: "old-secret-123" }),
    /Credenciais da equipe invalidas/,
  );
  assert.equal(
    system.loginTeam({ email: "reset@apoiar.test", password: "new-secret-123" }).sessionId.length >
      0,
    true,
  );
  assert.throws(
    () =>
      system.resetTeamUserPassword(admin.sessionId, {
        userId: system.getSession(admin.sessionId).user.id,
        password: "new-admin-secret",
      }),
    /propria senha/,
  );
});

test("team user can change own password and revoke other sessions", () => {
  const { system } = harness();
  system.ensureTeamUser({
    email: "admin@apoiar.test",
    password: "secret",
    name: "Admin",
    role: "admin",
  });
  const first = system.loginTeam({ email: "admin@apoiar.test", password: "secret" });
  const second = system.loginTeam({ email: "admin@apoiar.test", password: "secret" });

  assert.throws(
    () =>
      system.changeOwnTeamPassword(first.sessionId, {
        currentPassword: "wrong",
        newPassword: "new-secret-123",
      }),
    /Senha atual/,
  );
  assert.throws(
    () =>
      system.changeOwnTeamPassword(first.sessionId, {
        currentPassword: "secret",
        newPassword: "short",
      }),
    /pelo menos 10/,
  );
  const changed = system.changeOwnTeamPassword(first.sessionId, {
    currentPassword: "secret",
    newPassword: "new-secret-123",
  });
  assert.equal(changed.email, "admin@apoiar.test");
  assert.equal(system.dashboard(first.sessionId).teamUsers.length > 0, true);
  assert.throws(() => system.dashboard(second.sessionId), /Login da equipe obrigatorio/);
  assert.throws(
    () => system.loginTeam({ email: "admin@apoiar.test", password: "secret" }),
    /Credenciais da equipe invalidas/,
  );
  assert.equal(
    system.loginTeam({ email: "admin@apoiar.test", password: "new-secret-123" }).sessionId.length >
      0,
    true,
  );
});

test("team can create patients, products, and update fulfillment only after payment", async () => {
  const { system, state } = harness();
  const team = system.loginTeam({ password: "secret" }, "secret");

  const patient = system.createPatient(team.sessionId, {
    name: "Novo Paciente",
    memberCode: "APO-2001",
    inviteCode: "NOVO2026",
    prescriptionExpiresAt: "2026-12-31",
  });
  assert.equal(patient.memberCode, "APO-2001");

  const product = system.createProduct(team.sessionId, {
    name: "Oleo CBD 5%",
    unit: "frasco",
    priceReais: 120,
    stock: 4,
  });
  assert.equal(product.availableStock, 4);

  const login = system.loginPatient({ memberCode: "APO-2001", inviteCode: "NOVO2026" });
  system.acceptPrivacyConsent(login.sessionId, { accepted: true, version: "lgpd-2026-05" });
  const checkout = await system.createCheckout(login.sessionId, {
    items: [{ productId: product.id, quantity: 1 }],
  });

  assert.throws(
    () =>
      system.updateFulfillmentStatus(team.sessionId, {
        orderId: checkout.order.id,
        status: "separating",
      }),
    /ainda nao esta pago/,
  );

  system.confirmPixPayment({ paymentId: checkout.payment.id, eventId: "evt-new-paid" });
  const fulfilled = system.updateFulfillmentStatus(team.sessionId, {
    orderId: checkout.order.id,
    status: "sent",
  });
  assert.equal(fulfilled.status, "sent");
  assert.equal(state.products.find((item) => item.id === product.id).stock, 3);
});

test("team can update product price, description, and active catalog status", () => {
  const { system } = harness();
  const team = system.loginTeam({ password: "secret" }, "secret");

  const updated = system.updateProduct(team.sessionId, {
    productId: "flor-24k",
    priceReais: 30,
    description: "Produto pausado para conferencia de lote.",
    active: "inactive",
  });

  assert.equal(updated.priceCents, 3000);
  assert.equal(updated.active, false);
  assert.match(updated.description, /conferencia/);
  assert.equal(
    system
      .listCatalog(
        system.loginPatient({ memberCode: "APO-1027", inviteCode: "HELENA2026" }).sessionId,
      )
      .some((item) => item.id === "flor-24k"),
    false,
  );
});

test("team can categorize products, set low-stock threshold, and annotate controlled items", () => {
  const { system } = harness();
  const team = system.loginTeam({ password: "secret" }, "secret");

  const product = system.createProduct(team.sessionId, {
    name: "Goma CBD Sono",
    unit: "cx",
    priceReais: 90,
    stock: 2,
    category: "edible",
    lowStockThreshold: 3,
    controlled: "true",
    internalNote: "Separar somente com responsavel cadastrado.",
  });

  assert.equal(product.category, "edible");
  assert.equal(product.lowStockThreshold, 3);
  assert.equal(product.controlled, true);
  assert.match(product.internalNote, /responsavel/);

  const updated = system.updateProduct(team.sessionId, {
    productId: product.id,
    category: "oil",
    lowStockThreshold: 1,
    controlled: "false",
    internalNote: "Reclassificado pela farmacia.",
  });

  assert.equal(updated.category, "oil");
  assert.equal(updated.lowStockThreshold, 1);
  assert.equal(updated.controlled, false);
  assert.match(updated.internalNote, /Reclassificado/);
});

test("team can cancel unpaid order and release reservation without stock decrement", async () => {
  const { system, state } = harness();
  const team = system.loginTeam({ password: "secret" }, "secret");
  const patient = system.loginPatient({ memberCode: "APO-1027", inviteCode: "HELENA2026" });
  const checkout = await system.createCheckout(patient.sessionId, {
    items: [{ productId: "flor-24k", quantity: 2 }],
  });

  const beforeStock = state.products.find((item) => item.id === "flor-24k").stock;
  const cancelled = system.cancelOrder(team.sessionId, {
    orderId: checkout.order.id,
    reason: "Paciente pediu cancelamento antes do Pix.",
  });
  const reservation = state.stockReservations.find(
    (item) => item.id === checkout.order.reservationId,
  );
  const payment = state.payments.find((item) => item.id === checkout.payment.id);

  assert.equal(cancelled.status, "cancelled");
  assert.equal(reservation.status, "cancelled");
  assert.equal(payment.status, "cancelled");
  assert.equal(state.products.find((item) => item.id === "flor-24k").stock, beforeStock);
  assert.equal(cancelled.exceptions[0].type, "cancelamento");
  assert.equal(
    state.auditLog.some((event) => event.action === "order_cancelled"),
    true,
  );
});

test("team records paid fulfillment exception without automatic restock", async () => {
  const { system, state } = harness();
  const team = system.loginTeam({ password: "secret" }, "secret");
  const patient = system.loginPatient({ memberCode: "APO-1027", inviteCode: "HELENA2026" });
  const checkout = await system.createCheckout(patient.sessionId, {
    items: [{ productId: "flor-24k", quantity: 1 }],
  });
  system.confirmPixPayment({ paymentId: checkout.payment.id, eventId: "exception-paid" });
  const afterPaymentStock = state.products.find((item) => item.id === "flor-24k").stock;

  const exception = system.cancelOrder(team.sessionId, {
    orderId: checkout.order.id,
    reason: "Produto separado com divergencia de lote.",
  });
  const payment = state.payments.find((item) => item.id === checkout.payment.id);

  assert.equal(exception.status, "fulfillment_exception");
  assert.equal(exception.exceptionStatus, "refund_review");
  assert.equal(payment.refundStatus, "pending_review");
  assert.equal(state.products.find((item) => item.id === "flor-24k").stock, afterPaymentStock);
  assert.equal(
    state.auditLog.some((event) => event.action === "order_exception_recorded"),
    true,
  );

  const annotated = system.recordOrderException(team.sessionId, {
    orderId: checkout.order.id,
    type: "transportadora",
    note: "Aguardando retorno da transportadora.",
  });
  assert.equal(annotated.exceptions.length, 2);
  assert.equal(annotated.exceptions[1].type, "transportadora");
});

test("team can update patient prescription, card, and access eligibility", () => {
  const { system } = harness();
  const team = system.loginTeam({ password: "secret" }, "secret");

  const updated = system.updatePatientAccess(team.sessionId, {
    memberCode: "APO-1027",
    status: "inactive",
    prescriptionExpiresAt: "2026-12-31",
    cardExpiresAt: "2026-12-31",
  });
  assert.equal(updated.patient.status, "inactive");
  assert.equal(updated.eligibility.allowed, false);
  assert.match(updated.eligibility.reason, /inativo/);

  system.updatePatientAccess(team.sessionId, {
    memberCode: "APO-1027",
    status: "active",
    prescriptionExpiresAt: "2026-01-01",
    cardExpiresAt: "2026-12-31",
  });
  assert.throws(
    () => system.loginPatient({ memberCode: "APO-1027", inviteCode: "HELENA2026" }),
    /Receita medica vencida/,
  );
});

test("team can maintain patient profile management fields", () => {
  const { system } = harness();
  const team = system.loginTeam({ password: "secret" }, "secret");

  const updated = system.updatePatientAccess(team.sessionId, {
    memberCode: "APO-1027",
    name: "Helena Rocha Souza",
    associationEligible: "false",
    guardianName: "Marina Rocha",
    guardianPhone: "(11) 91111-0000",
    contactPhone: "(11) 92222-0000",
    email: "helena@example.test",
    city: "Campinas",
    state: "SP",
    carePlan: "Oleo CBD 10% com acompanhamento mensal.",
    supportNote: "Paciente prefere contato pelo responsavel.",
  });

  assert.equal(updated.patient.name, "Helena Rocha Souza");
  assert.equal(updated.patient.associationEligible, false);
  assert.equal(updated.patient.guardianName, "Marina Rocha");
  assert.equal(updated.patient.guardianPhone, "(11) 91111-0000");
  assert.equal(updated.patient.contactPhone, "(11) 92222-0000");
  assert.equal(updated.patient.email, "helena@example.test");
  assert.equal(updated.patient.city, "Campinas");
  assert.equal(updated.patient.state, "SP");
  assert.match(updated.patient.carePlan, /Oleo CBD/);
  assert.match(updated.patient.supportNote, /responsavel/);
  assert.equal(updated.eligibility.allowed, false);
  assert.match(updated.eligibility.reason, /nao elegivel/);
});

test("team can reset patient invite without exposing the old code", () => {
  const { system, state } = harness();
  const team = system.loginTeam({ password: "secret" }, "secret");

  const reset = system.resetPatientInvite(team.sessionId, {
    memberCode: "APO-1027",
    inviteCode: "NOVOHELENA2026",
  });

  assert.equal(reset.inviteCode, "NOVOHELENA2026");
  assert.ok(reset.patient.inviteResetAt);
  assert.equal(reset.patient.inviteCode, undefined);
  assert.throws(
    () => system.loginPatient({ memberCode: "APO-1027", inviteCode: "HELENA2026" }),
    /Credenciais de paciente invalidas/,
  );
  assert.equal(
    system.loginPatient({ memberCode: "APO-1027", inviteCode: "NOVOHELENA2026" }).patient
      .memberCode,
    "APO-1027",
  );
  assert.equal(
    state.auditLog.some((event) => event.action === "patient_invite_reset"),
    true,
  );
});

test("patient can open tracked support request and team can resolve it", () => {
  const { system } = harness();
  const patient = system.loginPatient({ memberCode: "APO-1027", inviteCode: "HELENA2026" });
  const team = system.loginTeam({ password: "secret" }, "secret");

  const ticket = system.createSupportRequest(patient.sessionId, {
    subject: "Duvida sobre renovacao",
    message: "Preciso enviar nova receita antes do proximo pedido.",
    priority: "high",
  });
  assert.equal(ticket.status, "open");
  assert.equal(ticket.priority, "high");
  assert.equal(ticket.memberCode, "APO-1027");

  const dashboard = system.dashboard(team.sessionId);
  assert.equal(
    dashboard.supportTickets.some(
      (item) => item.id === ticket.id && item.subject === "Duvida sobre renovacao",
    ),
    true,
  );

  const resolved = system.updateSupportRequest(team.sessionId, {
    ticketId: ticket.id,
    status: "resolved",
    internalNote: "Orientado envio pelo canal oficial.",
  });
  assert.equal(resolved.status, "resolved");
  assert.match(resolved.internalNote, /canal oficial/);
});

test("patient can record privacy consent and team dashboard sees it", () => {
  const { system, state } = harness();
  // Clear seeded consent so this test exercises the accept flow from scratch.
  const helenaSeed = state.patients.find((p) => p.id === "pat_helena");
  helenaSeed.privacyConsentAt = "";
  helenaSeed.privacyConsentVersion = "";
  const patient = system.loginPatient({ memberCode: "APO-1027", inviteCode: "HELENA2026" });
  const team = system.loginTeam({ password: "secret" }, "secret");

  assert.equal(patient.patient.privacyConsentAt, "");
  const accepted = system.acceptPrivacyConsent(patient.sessionId, {
    accepted: true,
    version: "lgpd-2026-05",
  });
  assert.equal(accepted.privacyConsentVersion, "lgpd-2026-05");
  assert.ok(accepted.privacyConsentAt);

  const dashboardPatient = system
    .dashboard(team.sessionId)
    .patients.find((item) => item.memberCode === "APO-1027");
  assert.equal(dashboardPatient.privacyConsentVersion, "lgpd-2026-05");
  assert.ok(dashboardPatient.privacyConsentAt);
  assert.equal(
    system.state.auditLog.some((event) => event.action === "privacy_consent_accepted"),
    true,
  );
});

test("team can issue member card and update eligibility", () => {
  const { system, state } = harness();
  const team = system.loginTeam({ password: "secret" }, "secret");

  system.updatePatientAccess(team.sessionId, {
    memberCode: "APO-1027",
    associationEligible: false,
  });
  assert.throws(
    () => system.loginPatient({ memberCode: "APO-1027", inviteCode: "HELENA2026" }),
    /Associacao do paciente nao elegivel/,
  );

  const result = system.issueMemberCard(team.sessionId, {
    memberCode: "APO-1027",
    cardNumber: "AV-APO-1027-20270131",
    expiresAt: "2027-01-31",
  });

  assert.equal(result.membership.cardNumber, "AV-APO-1027-20270131");
  assert.equal(result.eligibility.allowed, true);
  assert.equal(state.memberships.length, 1);
  assert.equal(
    system.loginPatient({ memberCode: "APO-1027", inviteCode: "HELENA2026" }).patient.cardExpiresAt,
    "2027-01-31",
  );
});

test("team can register prescription documents without storing file contents", () => {
  const { system, state } = harness();
  const team = system.loginTeam({ password: "secret" }, "secret");

  const result = system.registerPrescriptionDocument(team.sessionId, {
    memberCode: "APO-1027",
    fileName: "receita-helena.pdf",
    mimeType: "application/pdf",
    storageKey: "s3://private-prescriptions/pat_helena/receita.pdf",
    expiresAt: "2027-01-31",
  });

  assert.equal(result.patient.prescriptionExpiresAt, "2027-01-31");
  assert.equal(result.document.storageKey, "s3://private-prescriptions/pat_helena/receita.pdf");
  assert.equal(result.document.sha256.length, 64);
  assert.equal(state.prescriptionDocuments.length, 1);
});

test("prescription document download requires prescription permission and audits access", () => {
  const { system, state } = harness();
  system.ensureTeamUser({
    email: "admin@apoiar.test",
    password: "secret",
    name: "Admin",
    role: "admin",
  });
  const admin = system.loginTeam({ email: "admin@apoiar.test", password: "secret" });
  system.createTeamUser(admin.sessionId, {
    name: "Suporte",
    email: "support-docs@apoiar.test",
    password: "support-secret",
    role: "support",
  });
  const support = system.loginTeam({
    email: "support-docs@apoiar.test",
    password: "support-secret",
  });

  const result = system.registerPrescriptionDocument(admin.sessionId, {
    memberCode: "APO-1027",
    fileName: "receita-helena.pdf",
    mimeType: "application/pdf",
    storageKey: "private-documents://receita-helena.pdf",
    privateFilePath: "/private/receita-helena.pdf",
    sha256: "a".repeat(64),
    expiresAt: "2027-01-31",
  });

  assert.throws(
    () => system.getPrescriptionDocumentForDownload(support.sessionId, result.document.id),
    /Permissao da equipe insuficiente/,
  );
  const document = system.getPrescriptionDocumentForDownload(admin.sessionId, result.document.id);
  assert.equal(document.privateFilePath, "/private/receita-helena.pdf");
  assert.equal(
    state.auditLog.some((event) => event.action === "prescription_document_accessed"),
    true,
  );
  assert.equal(
    system.dashboard(admin.sessionId).prescriptionDocuments[0].privateFilePath,
    undefined,
  );
});

test("critical production actions are audit logged and visible on dashboard", async () => {
  const { system, state } = harness();
  system.ensureTeamUser({
    email: "admin@apoiar.test",
    password: "secret",
    name: "Admin",
    role: "admin",
  });
  const admin = system.loginTeam({ email: "admin@apoiar.test", password: "secret" });
  system.createTeamUser(admin.sessionId, {
    name: "Operacoes",
    email: "ops-audit@apoiar.test",
    password: "ops-secret",
    role: "operations",
  });
  system.addStock(admin.sessionId, {
    productId: "flor-24k",
    quantity: 1,
    note: "Auditoria estoque",
  });
  system.updatePatientAccess(admin.sessionId, {
    memberCode: "APO-1027",
    prescriptionExpiresAt: "2027-01-31",
    cardExpiresAt: "2027-01-31",
  });
  const document = system.registerPrescriptionDocument(admin.sessionId, {
    memberCode: "APO-1027",
    fileName: "receita-audit.pdf",
    storageKey: "private-documents://receita-audit.pdf",
    privateFilePath: "/private/receita-audit.pdf",
    sha256: "b".repeat(64),
    expiresAt: "2027-01-31",
  });
  system.getPrescriptionDocumentForDownload(admin.sessionId, document.document.id);
  const patient = system.loginPatient({ memberCode: "APO-1027", inviteCode: "HELENA2026" });
  const checkout = await system.createCheckout(patient.sessionId, {
    items: [{ productId: "flor-24k", quantity: 1 }],
  });
  system.confirmPixPayment({ paymentId: checkout.payment.id, eventId: "audit-paid" });
  system.updateFulfillmentStatus(admin.sessionId, {
    orderId: checkout.order.id,
    status: "separating",
  });
  system.upsertShipment(admin.sessionId, {
    orderId: checkout.order.id,
    carrier: "GED Log",
    status: "sent",
  });

  const actions = new Set(state.auditLog.map((event) => event.action));
  for (const action of [
    "team_user_created",
    "stock_added",
    "patient_access_updated",
    "prescription_document_registered",
    "prescription_document_accessed",
    "checkout_created",
    "payment_confirmed",
    "fulfillment_updated",
    "shipment_upserted",
  ]) {
    assert.equal(actions.has(action), true, `${action} should be audit logged`);
  }
  const dashboard = system.dashboard(admin.sessionId);
  assert.equal(
    dashboard.auditLog.some((event) => event.action === "shipment_upserted"),
    true,
  );
  assert.equal(
    dashboard.auditLog[0].actor.startsWith("team_") ||
      dashboard.auditLog[0].actor.startsWith("pat_"),
    true,
  );
});

test("team can register shipment only after payment", async () => {
  const { system } = harness();
  const team = system.loginTeam({ password: "secret" }, "secret");
  const patient = system.loginPatient({ memberCode: "APO-1027", inviteCode: "HELENA2026" });
  const checkout = await system.createCheckout(patient.sessionId, {
    items: [{ productId: "flor-24k", quantity: 1 }],
  });

  assert.throws(
    () => system.upsertShipment(team.sessionId, { orderId: checkout.order.id, carrier: "GED Log" }),
    /precisa estar pago/,
  );

  system.confirmPixPayment({ paymentId: checkout.payment.id, eventId: "ship-paid" });
  const result = system.upsertShipment(team.sessionId, {
    orderId: checkout.order.id,
    carrier: "GED Log",
    service: "Melhor Envio",
    trackingCode: "BR123",
    status: "sent",
  });

  assert.equal(result.shipment.trackingCode, "BR123");
  assert.equal(result.order.status, "sent");
  assert.equal(result.order.shipment.status, "sent");
});

test("team can run cultivation batch through harvest, drying, and stock lot", () => {
  const { system, state } = harness();
  const team = system.loginTeam({ password: "secret" }, "secret");
  const before = state.products.find((item) => item.id === "flor-24k").stock;

  const batch = system.createCultivationBatch(team.sessionId, {
    strain: "Harlequin",
    productId: "flor-24k",
    plants: 12,
    week: 8,
  });
  const advanced = system.advanceCultivationBatch(team.sessionId, { batchId: batch.id });
  assert.equal(advanced.week, 9);

  system.recordHarvest(team.sessionId, { batchId: batch.id, harvested: 420 });
  system.recordDryWeight(team.sessionId, { batchId: batch.id, dried: 110 });
  const stocked = system.moveBatchToStock(team.sessionId, {
    batchId: batch.id,
    productId: "flor-24k",
  });

  assert.equal(stocked.batch.status, "stocked");
  assert.equal(stocked.lot.quantity, 110);
  assert.equal(state.products.find((item) => item.id === "flor-24k").stock, before + 110);
  assert.equal(state.inventoryLots.length, 1);
});

test("Asaas Pix provider creates charge and webhook can confirm by provider payment id", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (String(url).endsWith("/payments")) {
      return jsonResponse({ id: "pay_asaas_123" });
    }
    if (String(url).endsWith("/payments/pay_asaas_123/pixQrCode")) {
      return jsonResponse({
        payload: "asaas-copia-e-cola",
        encodedImage: "base64",
        expirationDate: "2026-05-08T00:00:00Z",
      });
    }
    if (String(url).endsWith("/payments/pay_asaas_123")) {
      return jsonResponse({
        id: "pay_asaas_123",
        status: "RECEIVED",
        value: 22,
        externalReference: "PED-1",
      });
    }
    return jsonResponse({ message: "not found" }, 404);
  };

  try {
    const { state, system } = harness();
    system.paymentProvider = createAsaasPixProvider({
      apiKey: "asaas-key",
      customerId: "cus_123",
      baseUrl: "https://sandbox.local/v3",
      now: () => new Date("2026-05-07T12:00:00-03:00"),
    });
    const login = system.loginPatient({ memberCode: "APO-1027", inviteCode: "HELENA2026" });
    const checkout = await system.createCheckout(login.sessionId, {
      items: [{ productId: "flor-24k", quantity: 1 }],
    });

    assert.equal(checkout.payment.provider, "asaas");
    assert.equal(checkout.payment.providerPaymentId, "pay_asaas_123");
    assert.equal(checkout.payment.pix.copiaECola, "asaas-copia-e-cola");
    assert.equal(JSON.parse(calls[0].options.body).billingType, "PIX");

    const confirmed = system.confirmPixPayment({
      paymentId: "pay_asaas_123",
      eventId: "asaas-event",
      status: "paid",
    });
    assert.equal(confirmed.order.status, "paid_pending_fulfillment");
    assert.equal(state.products.find((item) => item.id === "flor-24k").stock, 91);
    const providerStatus = await system.paymentProvider.getPaymentStatus("pay_asaas_123");
    assert.equal(providerStatus.status, "paid");
    assert.equal(providerStatus.rawStatus, "RECEIVED");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
  };
}
