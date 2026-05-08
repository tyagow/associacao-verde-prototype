// @ts-nocheck
// TODO(phase-0a-ts): incrementally type — escape hatch during strict:false migration
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RESERVATION_MINUTES = 30;
const ROLE_PERMISSIONS = {
  admin: ["*"],
  operations: [
    "dashboard:view",
    "patients:write",
    "prescriptions:write",
    "products:write",
    "stock:write",
    "cultivation:write",
    "fulfillment:write",
    "shipments:write",
    "support:write",
    "payments:simulate",
    "payments:reconcile",
  ],
  stock: ["dashboard:view", "products:write", "stock:write", "cultivation:write"],
  fulfillment: ["dashboard:view", "fulfillment:write", "shipments:write"],
  support: ["dashboard:view", "support:write"],
};

export function createInitialState(now = new Date()) {
  const today = isoDate(now);
  return {
    meta: {
      version: 1,
      createdAt: now.toISOString(),
      reservationMinutes: DEFAULT_RESERVATION_MINUTES,
    },
    patients: [
      {
        id: "pat_helena",
        name: "Helena Rocha",
        memberCode: "APO-1027",
        inviteCode: "HELENA2026",
        status: "active",
        associationEligible: true,
        prescriptionExpiresAt: "2026-09-18",
        cardExpiresAt: "2026-09-18",
        guardianName: "",
        guardianPhone: "",
        contactPhone: "(11) 90000-1027",
        email: "helena.rocha@example.test",
        city: "Sao Paulo",
        state: "SP",
        carePlan: "Oleo CBD 10% conforme receita vigente.",
        supportNote: "Confirmar documento renovado antes de setembro.",
        privacyConsentAt: "",
        privacyConsentVersion: "",
      },
      {
        id: "pat_joao",
        name: "Joao Lima",
        memberCode: "APO-1028",
        inviteCode: "JOAO2026",
        status: "active",
        associationEligible: true,
        prescriptionExpiresAt: "2026-05-29",
        cardExpiresAt: "2026-05-29",
        guardianName: "Marina Lima",
        guardianPhone: "(21) 90000-1028",
        contactPhone: "(21) 98888-1028",
        email: "joao.lima@example.test",
        city: "Rio de Janeiro",
        state: "RJ",
        carePlan: "Acompanhamento familiar com responsavel cadastrado.",
        supportNote: "Validade proxima; acionar responsavel.",
        privacyConsentAt: "",
        privacyConsentVersion: "",
      },
      {
        id: "pat_bloqueado",
        name: "Paciente Bloqueado",
        memberCode: "APO-1999",
        inviteCode: "BLOQ2026",
        status: "inactive",
        associationEligible: true,
        prescriptionExpiresAt: "2026-12-01",
        cardExpiresAt: "2026-12-01",
        guardianName: "",
        guardianPhone: "",
        contactPhone: "",
        email: "",
        city: "",
        state: "",
        carePlan: "",
        supportNote: "Cadastro inativo aguardando revisao do atendimento.",
        privacyConsentAt: "",
        privacyConsentVersion: "",
      },
    ],
    products: [
      {
        id: "oleo-cbd-10",
        name: "Oleo CBD 10%",
        description: "Frasco separado pela equipe para pacientes com receita ativa.",
        unit: "frasco",
        priceCents: 18000,
        stock: 23,
        category: "oil",
        lowStockThreshold: 5,
        controlled: true,
        internalNote: "Receita vigente obrigatoria antes da entrega.",
        active: true,
      },
      {
        id: "oleo-full-20",
        name: "Oleo Full Spectrum 20%",
        description: "Opcao recorrente com conferencia de receita antes da entrega.",
        unit: "frasco",
        priceCents: 24000,
        stock: 13,
        category: "oil",
        lowStockThreshold: 5,
        controlled: true,
        internalNote: "Conferir posologia registrada no cadastro.",
        active: true,
      },
      {
        id: "flor-24k",
        name: "Flor 24k",
        description: "Produto em gramas, controlado por lote e disponibilidade.",
        unit: "g",
        priceCents: 2200,
        stock: 92,
        category: "flower",
        lowStockThreshold: 10,
        controlled: true,
        internalNote: "Rastrear por lote e disponibilidade antes de liberar pedido.",
        active: true,
      },
    ],
    memberships: [],
    teamUsers: [],
    cultivationBatches: [
      {
        id: "batch_24k_1",
        strain: "24k",
        productId: "flor-24k",
        week: 6,
        plants: 18,
        harvested: 0,
        dried: 0,
        status: "growing",
        createdAt: today,
      },
    ],
    inventoryLots: [],
    sessions: [],
    stockReservations: [],
    stockMovements: [
      movement("oleo-cbd-10", "in", 23, "Saldo inicial para operacao privada", today),
      movement("oleo-full-20", "in", 13, "Saldo inicial para operacao privada", today),
      movement("flor-24k", "in", 92, "Saldo inicial para operacao privada", today),
    ],
    orders: [],
    payments: [],
    paymentEvents: [],
    prescriptionDocuments: [],
    supportTickets: [],
    shipments: [],
    auditLog: [],
  };
}

export class ProductionSystem {
  constructor({
    state,
    now = () => new Date(),
    save = () => {},
    paymentProvider = createDevPixProvider({ now }),
  }) {
    this.state = state;
    this.now = now;
    this.save = save;
    this.paymentProvider = paymentProvider;
    this.expireReservations();
  }

  loginPatient({ memberCode, inviteCode }) {
    const patient = this.patientByCredentials({ memberCode, inviteCode });

    if (!patient) throw problem(401, "Credenciais de paciente invalidas.");
    const eligibility = this.patientEligibility(patient);
    if (!eligibility.allowed) throw problem(403, eligibility.reason);

    const loginAt = this.now().toISOString();
    const session = {
      id: randomUUID(),
      role: "patient",
      patientId: patient.id,
      createdAt: loginAt,
      expiresAt: new Date(this.now().getTime() + 8 * 60 * 60 * 1000).toISOString(),
    };
    patient.lastLoginAt = loginAt;
    patient.lastSessionExpiresAt = session.expiresAt;
    this.state.sessions.push(session);
    this.audit("patient_login", patient.id, { memberCode: patient.memberCode });
    this.persist();
    return { sessionId: session.id, patient: this.publicPatient(patient) };
  }

  loginTeam({ email, password }, expectedPassword) {
    const teamUsers = this.state.teamUsers || [];
    const user = teamUsers.find(
      (item) => item.email === normalizeEmail(email) && item.status === "active",
    );
    if (teamUsers.length) {
      if (!user || !verifyPassword(password, user.passwordHash))
        throw problem(401, "Credenciais da equipe invalidas.");
    } else if (!expectedPassword || password !== expectedPassword) {
      throw problem(401, "Senha da equipe invalida.");
    }
    const session = {
      id: randomUUID(),
      role: "team",
      teamUserId: user?.id || "legacy-team",
      createdAt: this.now().toISOString(),
      expiresAt: new Date(this.now().getTime() + 12 * 60 * 60 * 1000).toISOString(),
    };
    this.state.sessions.push(session);
    this.audit("team_login", user?.id || "team", { email: user?.email || "legacy" });
    this.persist();
    return { sessionId: session.id };
  }

  ensureTeamUser({ email, password, name = "Administrador", role = "admin" }) {
    this.state.teamUsers ||= [];
    const normalizedEmail = normalizeEmail(email);
    let user = this.state.teamUsers.find((item) => item.email === normalizedEmail);
    if (!user) {
      user = {
        id: `team_${randomUUID()}`,
        email: normalizedEmail,
        name,
        role: normalizeTeamRole(role),
        status: "active",
        passwordHash: hashPassword(password),
        createdAt: this.now().toISOString(),
        updatedAt: this.now().toISOString(),
      };
      this.state.teamUsers.push(user);
      this.audit("team_user_bootstrapped", user.id, { email: normalizedEmail, role });
      this.persist();
    }
    return publicTeamUser(user);
  }

  createTeamUser(sessionId, user) {
    const actor = this.requireTeam(sessionId, "team:write");
    this.state.teamUsers ||= [];
    const email = normalizeEmail(user.email);
    if (!email || !user.password || !user.name)
      throw problem(400, "Usuario da equipe precisa de nome, email e senha.");
    if (this.state.teamUsers.some((item) => item.email === email))
      throw problem(409, "Email da equipe ja existe.");
    const nextUser = {
      id: `team_${randomUUID()}`,
      email,
      name: String(user.name).trim(),
      role: normalizeTeamRole(user.role || "support"),
      status: "active",
      passwordHash: hashPassword(user.password),
      createdAt: this.now().toISOString(),
      updatedAt: this.now().toISOString(),
    };
    this.state.teamUsers.push(nextUser);
    this.audit("team_user_created", actor.id, {
      teamUserId: nextUser.id,
      email,
      role: nextUser.role,
    });
    this.persist();
    return publicTeamUser(nextUser);
  }

  updateTeamUserStatus(sessionId, update) {
    const actor = this.requireTeam(sessionId, "team:write");
    const target = this.state.teamUsers?.find((item) => item.id === update.userId);
    if (!target) throw problem(404, "Usuario da equipe nao encontrado.");
    if (target.id === actor.id)
      throw problem(400, "Nao desative o proprio usuario administrativo.");
    const status = normalizeTeamUserStatus(update.status);
    target.status = status;
    target.updatedAt = this.now().toISOString();
    if (status !== "active") {
      this.state.sessions = this.state.sessions.filter(
        (session) => session.teamUserId !== target.id,
      );
    }
    this.audit("team_user_status_updated", actor.id, {
      teamUserId: target.id,
      email: target.email,
      status,
    });
    this.persist();
    return publicTeamUser(target);
  }

  resetTeamUserPassword(sessionId, reset) {
    const actor = this.requireTeam(sessionId, "team:write");
    const target = this.state.teamUsers?.find((item) => item.id === reset.userId);
    if (!target) throw problem(404, "Usuario da equipe nao encontrado.");
    if (target.id === actor.id)
      throw problem(400, "Use um fluxo separado para alterar a propria senha administrativa.");
    const password = String(reset.password || "");
    if (password.length < 10)
      throw problem(400, "Senha temporaria precisa ter pelo menos 10 caracteres.");
    target.passwordHash = hashPassword(password);
    target.status = "active";
    target.updatedAt = this.now().toISOString();
    this.state.sessions = this.state.sessions.filter((session) => session.teamUserId !== target.id);
    this.audit("team_user_password_reset", actor.id, {
      teamUserId: target.id,
      email: target.email,
    });
    this.persist();
    return publicTeamUser(target);
  }

  changeOwnTeamPassword(sessionId, change) {
    const actor = this.requireTeam(sessionId, "dashboard:view");
    const target = this.state.teamUsers?.find((item) => item.id === actor.id);
    if (!target) throw problem(400, "Usuario da equipe nao encontrado para troca de senha.");
    if (!verifyPassword(change.currentPassword, target.passwordHash))
      throw problem(401, "Senha atual da equipe invalida.");
    const nextPassword = String(change.newPassword || "");
    if (nextPassword.length < 10)
      throw problem(400, "Nova senha precisa ter pelo menos 10 caracteres.");
    target.passwordHash = hashPassword(nextPassword);
    target.updatedAt = this.now().toISOString();
    this.state.sessions = this.state.sessions.filter(
      (session) => session.teamUserId !== target.id || session.id === sessionId,
    );
    this.audit("team_user_password_changed", actor.id, {
      teamUserId: target.id,
      email: target.email,
    });
    this.persist();
    return publicTeamUser(target);
  }

  logout(sessionId) {
    this.state.sessions = this.state.sessions.filter((session) => session.id !== sessionId);
    this.persist();
  }

  getSession(sessionId) {
    if (!sessionId) return null;
    const session = this.state.sessions.find((item) => item.id === sessionId);
    if (!session) return null;
    if (new Date(session.expiresAt) <= this.now()) {
      this.state.sessions = this.state.sessions.filter((item) => item.id !== sessionId);
      this.persist();
      return null;
    }
    if (session.role === "patient") {
      const patient = this.state.patients.find((item) => item.id === session.patientId);
      return {
        role: "patient",
        patient: this.publicPatient(patient),
        session: publicSession(session),
      };
    }
    const teamUser = this.state.teamUsers?.find((item) => item.id === session.teamUserId);
    return {
      role: "team",
      user: teamUser ? publicTeamUser(teamUser) : null,
      session: publicSession(session),
    };
  }

  requirePatient(sessionId) {
    const session = this.getSession(sessionId);
    if (session?.role !== "patient") throw problem(401, "Login de paciente obrigatorio.");
    const patient = this.state.patients.find((item) => item.id === session.patient.id);
    const eligibility = this.patientEligibility(patient);
    if (!eligibility.allowed) throw problem(403, eligibility.reason);
    return patient;
  }

  requireTeam(sessionId, permission = "dashboard:view") {
    const session = this.state.sessions.find((item) => item.id === sessionId);
    if (!session || session.role !== "team") throw problem(401, "Login da equipe obrigatorio.");
    if (new Date(session.expiresAt) <= this.now()) {
      this.state.sessions = this.state.sessions.filter((item) => item.id !== sessionId);
      this.persist();
      throw problem(401, "Login da equipe expirado.");
    }
    const user = this.state.teamUsers?.find((item) => item.id === session.teamUserId);
    const teamUser = user || {
      id: session.teamUserId || "legacy-team",
      email: "legacy",
      name: "Equipe",
      role: "admin",
      status: "active",
    };
    if (teamUser.status !== "active") throw problem(403, "Usuario da equipe inativo.");
    if (!hasPermission(teamUser.role, permission)) {
      throw problem(403, `Permissao da equipe insuficiente para ${permission}.`);
    }
    return teamUser;
  }

  listCatalog(sessionId) {
    this.requirePatient(sessionId);
    return this.state.products
      .filter((product) => product.active)
      .map((product) => this.publicProduct(product));
  }

  async createCheckout(sessionId, { items, deliveryMethod }) {
    const patient = this.requirePatient(sessionId);
    const checkedItems = this.checkItems(items);
    const expiresAt = new Date(
      this.now().getTime() + this.state.meta.reservationMinutes * 60 * 1000,
    ).toISOString();
    const orderId = `PED-${Date.now()}`;
    const reservationId = randomUUID();
    const paymentId = randomUUID();

    for (const item of checkedItems) {
      const available = this.availableStock(item.product.id);
      if (item.quantity > available) {
        throw problem(
          409,
          `Estoque insuficiente para ${item.product.name}. Disponivel: ${available} ${item.product.unit}.`,
        );
      }
    }

    const orderItems = checkedItems.map((item) => ({
      productId: item.product.id,
      name: item.product.name,
      unit: item.product.unit,
      quantity: item.quantity,
      unitPriceCents: item.product.priceCents,
      subtotalCents: item.quantity * item.product.priceCents,
    }));
    const totalCents = orderItems.reduce((sum, item) => sum + item.subtotalCents, 0);

    this.state.stockReservations.push({
      id: reservationId,
      orderId,
      patientId: patient.id,
      items: orderItems.map(({ productId, quantity }) => ({ productId, quantity })),
      status: "active",
      createdAt: this.now().toISOString(),
      expiresAt,
    });

    this.state.orders.push({
      id: orderId,
      patientId: patient.id,
      patientName: patient.name,
      memberCode: patient.memberCode,
      items: orderItems,
      totalCents,
      deliveryMethod: deliveryMethod || "Retirada combinada",
      status: "awaiting_payment",
      reservationId,
      paymentId,
      createdAt: this.now().toISOString(),
      updatedAt: this.now().toISOString(),
    });

    const payment = await this.paymentProvider.createPayment({
      paymentId,
      orderId,
      patient,
      totalCents,
      expiresAt,
    });
    this.state.payments.push(payment);
    this.audit("checkout_created", patient.id, { orderId, reservationId, paymentId });
    this.persist();
    return { order: this.publicOrder(this.orderById(orderId)), payment };
  }

  confirmPixPayment({ paymentId, eventId = randomUUID(), status = "paid" }) {
    if (status !== "paid") throw problem(400, "Este webhook so confirma pagamentos Pix aprovados.");
    if (this.state.paymentEvents.some((event) => event.eventId === eventId)) {
      const payment = this.findPayment(paymentId);
      return { duplicate: true, payment };
    }

    const payment = this.findPayment(paymentId);
    if (!payment) throw problem(404, "Pagamento nao encontrado.");
    if (payment.status === "paid") {
      this.state.paymentEvents.push({
        eventId,
        paymentId,
        status,
        receivedAt: this.now().toISOString(),
        duplicateOfPaid: true,
      });
      this.persist();
      return { duplicate: true, payment };
    }

    const order = this.orderById(payment.orderId);
    const reservation = this.state.stockReservations.find(
      (item) => item.id === order.reservationId,
    );
    if (!reservation || reservation.status !== "active")
      throw problem(409, "Reserva de estoque nao esta ativa.");
    if (new Date(reservation.expiresAt) <= this.now())
      throw problem(409, "Reserva de estoque expirada.");

    for (const item of reservation.items) {
      const product = this.productById(item.productId);
      if (item.quantity > product.stock)
        throw problem(409, `Estoque fisico insuficiente para ${product.name}.`);
    }

    for (const item of reservation.items) {
      const product = this.productById(item.productId);
      product.stock -= item.quantity;
      this.state.stockMovements.push(
        movement(
          product.id,
          "out",
          item.quantity,
          `Baixa definitiva pelo pagamento ${order.id}`,
          isoDate(this.now()),
        ),
      );
    }

    reservation.status = "converted";
    reservation.convertedAt = this.now().toISOString();
    payment.status = "paid";
    payment.paidAt = this.now().toISOString();
    order.status = "paid_pending_fulfillment";
    order.updatedAt = this.now().toISOString();
    this.state.paymentEvents.push({
      eventId,
      paymentId,
      status,
      receivedAt: this.now().toISOString(),
    });
    this.audit("payment_confirmed", order.patientId, { orderId: order.id, paymentId });
    this.persist();
    return { duplicate: false, payment, order: this.publicOrder(order) };
  }

  async reconcilePayment(sessionId, { paymentId }) {
    const actor = this.requireTeam(sessionId, "payments:reconcile");
    const payment = this.findPayment(paymentId);
    if (!payment) throw problem(404, "Pagamento nao encontrado.");
    if (!this.paymentProvider?.getPaymentStatus)
      throw problem(501, "Provider de pagamento nao suporta conciliacao.");

    const providerStatus = await this.paymentProvider.getPaymentStatus(
      payment.providerPaymentId || payment.id,
    );
    const normalizedStatus = normalizeProviderPaymentStatus(providerStatus.status);
    payment.lastProviderStatus = providerStatus.rawStatus || providerStatus.status || "UNKNOWN";
    payment.lastReconciledAt = this.now().toISOString();

    if (normalizedStatus === "pending") {
      payment.reconciliationStatus = "provider_pending";
      this.audit("payment_reconciled", actor.id, {
        paymentId: payment.id,
        orderId: payment.orderId,
        providerStatus: payment.lastProviderStatus,
        result: "provider_pending",
      });
      this.persist();
      return { status: "provider_pending", payment };
    }

    if (normalizedStatus === "paid") {
      try {
        const confirmed = this.confirmPixPayment({
          paymentId: payment.providerPaymentId || payment.id,
          eventId: `reconcile:${payment.provider}:${payment.providerPaymentId || payment.id}:paid`,
          status: "paid",
        });
        payment.reconciliationStatus = confirmed.duplicate ? "already_paid" : "paid";
        payment.lastProviderStatus = providerStatus.rawStatus || providerStatus.status || "PAID";
        payment.lastReconciledAt = this.now().toISOString();
        this.audit("payment_reconciled", actor.id, {
          paymentId: payment.id,
          orderId: payment.orderId,
          providerStatus: payment.lastProviderStatus,
          result: payment.reconciliationStatus,
        });
        this.persist();
        return { status: payment.reconciliationStatus, payment, order: confirmed.order };
      } catch (error) {
        payment.reconciliationStatus = "exception";
        payment.reconciliationError = error.message;
        this.audit("payment_reconciliation_exception", actor.id, {
          paymentId: payment.id,
          orderId: payment.orderId,
          providerStatus: payment.lastProviderStatus,
          error: error.message,
        });
        this.persist();
        return { status: "exception", payment, error: error.message };
      }
    }

    if (["expired", "cancelled", "failed", "refunded"].includes(normalizedStatus)) {
      const order = this.orderById(payment.orderId);
      const reservation = this.state.stockReservations.find(
        (item) => item.id === order.reservationId,
      );
      if (payment.status === "pending") {
        payment.status = normalizedStatus;
        payment.expiredAt = this.now().toISOString();
      }
      if (order.status === "awaiting_payment") {
        order.status = "payment_expired";
        order.updatedAt = this.now().toISOString();
      }
      if (reservation?.status === "active") {
        reservation.status = "expired";
        reservation.expiredAt = this.now().toISOString();
      }
      payment.reconciliationStatus = normalizedStatus;
      this.audit("payment_reconciled", actor.id, {
        paymentId: payment.id,
        orderId: payment.orderId,
        providerStatus: payment.lastProviderStatus,
        result: normalizedStatus,
      });
      this.persist();
      return { status: normalizedStatus, payment, order: this.publicOrder(order) };
    }

    payment.reconciliationStatus = "unknown_provider_status";
    this.audit("payment_reconciliation_exception", actor.id, {
      paymentId: payment.id,
      orderId: payment.orderId,
      providerStatus: payment.lastProviderStatus,
      error: "Status do provider nao mapeado.",
    });
    this.persist();
    return { status: "unknown_provider_status", payment };
  }

  listMyOrders(sessionId) {
    const patient = this.requirePatient(sessionId);
    return this.state.orders
      .filter((order) => order.patientId === patient.id)
      .map((order) => this.publicOrder(order))
      .reverse();
  }

  createSupportRequest(sessionId, request) {
    const patient = this.requirePatient(sessionId);
    const subject = String(request.subject || "").trim();
    const message = String(request.message || "").trim();
    if (!subject || !message) throw problem(400, "Atendimento precisa de assunto e mensagem.");
    const ticket = {
      id: `sup_${randomUUID()}`,
      patientId: patient.id,
      memberCode: patient.memberCode,
      patientName: patient.name,
      subject,
      message,
      priority: ["urgent", "high", "normal"].includes(request.priority)
        ? request.priority
        : "normal",
      status: "open",
      createdAt: this.now().toISOString(),
      updatedAt: this.now().toISOString(),
      relatedOrderId: request.relatedOrderId || "",
    };
    this.state.supportTickets ||= [];
    this.state.supportTickets.push(ticket);
    this.audit("support_request_created", patient.id, {
      ticketId: ticket.id,
      memberCode: patient.memberCode,
      priority: ticket.priority,
    });
    this.persist();
    return this.publicSupportTicket(ticket);
  }

  createAccessRecoveryRequest(request) {
    const patient = this.patientByCredentials(request);
    if (!patient) throw problem(401, "Credenciais de paciente invalidas.");
    const eligibility = this.patientEligibility(patient);
    const message =
      String(request.message || "").trim() ||
      `Paciente solicitou revisao de acesso: ${eligibility.reason}`;
    const ticket = {
      id: `sup_${randomUUID()}`,
      patientId: patient.id,
      memberCode: patient.memberCode,
      patientName: patient.name,
      subject: "Revisao de acesso do paciente",
      message,
      priority: "high",
      status: "open",
      type: "access_recovery",
      createdAt: this.now().toISOString(),
      updatedAt: this.now().toISOString(),
      relatedOrderId: "",
      accessReason: eligibility.reason,
    };
    this.state.supportTickets ||= [];
    this.state.supportTickets.push(ticket);
    this.audit("patient_access_recovery_requested", patient.id, {
      ticketId: ticket.id,
      memberCode: patient.memberCode,
      reason: eligibility.reason,
    });
    this.persist();
    return this.publicSupportTicket(ticket);
  }

  updateSupportRequest(sessionId, update) {
    const actor = this.requireTeam(sessionId, "support:write");
    const ticket = (this.state.supportTickets || []).find((item) => item.id === update.ticketId);
    if (!ticket) throw problem(404, "Atendimento nao encontrado.");
    if (update.status)
      ticket.status = ["open", "in_progress", "resolved"].includes(update.status)
        ? update.status
        : ticket.status;
    if (update.priority)
      ticket.priority = ["urgent", "high", "normal"].includes(update.priority)
        ? update.priority
        : ticket.priority;
    if (update.internalNote !== undefined)
      ticket.internalNote = String(update.internalNote || "").trim();
    ticket.updatedAt = this.now().toISOString();
    this.audit("support_request_updated", actor.id, {
      ticketId: ticket.id,
      status: ticket.status,
      priority: ticket.priority,
    });
    this.persist();
    return this.publicSupportTicket(ticket);
  }

  dashboard(sessionId) {
    this.requireTeam(sessionId, "dashboard:view");
    return {
      patients: this.state.patients.map((patient) => ({
        ...this.publicPatient(patient),
        eligibility: this.patientEligibility(patient),
        activeSession: this.activePatientSession(patient.id),
      })),
      memberships: (this.state.memberships || []).slice().reverse(),
      teamUsers: (this.state.teamUsers || []).map(publicTeamUser),
      products: this.state.products.map((product) => this.publicProduct(product)),
      cultivationBatches: this.state.cultivationBatches.slice().reverse(),
      inventoryLots: this.state.inventoryLots.slice().reverse(),
      reservations: this.state.stockReservations.slice().reverse(),
      orders: this.state.orders.map((order) => this.publicOrder(order)).reverse(),
      payments: this.state.payments.slice().reverse(),
      prescriptionDocuments: this.state.prescriptionDocuments
        .slice()
        .reverse()
        .map(publicPrescriptionDocument),
      supportTickets: (this.state.supportTickets || [])
        .slice()
        .reverse()
        .map((ticket) => this.publicSupportTicket(ticket)),
      shipments: this.state.shipments.slice().reverse(),
      stockMovements: this.state.stockMovements.slice().reverse(),
      auditLog: this.state.auditLog.slice().reverse().slice(0, 50),
    };
  }

  addStock(sessionId, { productId, quantity, note }) {
    const actor = this.requireTeam(sessionId, "stock:write");
    const product = this.productById(productId);
    const amount = Number(quantity);
    if (!Number.isInteger(amount) || amount <= 0)
      throw problem(400, "Quantidade de estoque invalida.");
    product.stock += amount;
    this.state.stockMovements.push(
      movement(
        product.id,
        "in",
        amount,
        note || "Entrada registrada pela equipe",
        isoDate(this.now()),
      ),
    );
    this.audit("stock_added", actor.id, { productId, quantity: amount });
    this.persist();
    return this.publicProduct(product);
  }

  createCultivationBatch(sessionId, batch) {
    const actor = this.requireTeam(sessionId, "cultivation:write");
    const plants = Number(batch.plants);
    const week = Number(batch.week || 1);
    if (
      !batch.strain ||
      !Number.isInteger(plants) ||
      plants <= 0 ||
      !Number.isInteger(week) ||
      week < 1
    ) {
      throw problem(400, "Lote precisa de cultivar, plantas e semana validos.");
    }
    if (batch.productId) this.productById(batch.productId);
    const nextBatch = {
      id: `batch_${randomUUID()}`,
      strain: String(batch.strain).trim(),
      productId: batch.productId || "",
      week,
      plants,
      harvested: 0,
      dried: 0,
      status: "growing",
      createdAt: this.now().toISOString(),
      updatedAt: this.now().toISOString(),
    };
    this.state.cultivationBatches.push(nextBatch);
    this.audit("cultivation_batch_created", actor.id, {
      batchId: nextBatch.id,
      strain: nextBatch.strain,
    });
    this.persist();
    return nextBatch;
  }

  advanceCultivationBatch(sessionId, { batchId }) {
    const actor = this.requireTeam(sessionId, "cultivation:write");
    const batch = this.batchById(batchId);
    if (batch.status === "stocked") throw problem(409, "Lote ja saiu para estoque.");
    batch.week += 1;
    batch.updatedAt = this.now().toISOString();
    this.audit("cultivation_batch_advanced", actor.id, { batchId, week: batch.week });
    this.persist();
    return batch;
  }

  recordHarvest(sessionId, { batchId, harvested }) {
    const actor = this.requireTeam(sessionId, "cultivation:write");
    const batch = this.batchById(batchId);
    const amount = Number(harvested);
    if (!Number.isInteger(amount) || amount <= 0) throw problem(400, "Peso colhido invalido.");
    batch.harvested = amount;
    batch.status = "harvested";
    batch.updatedAt = this.now().toISOString();
    this.audit("cultivation_harvest_recorded", actor.id, { batchId, harvested: amount });
    this.persist();
    return batch;
  }

  recordDryWeight(sessionId, { batchId, dried }) {
    const actor = this.requireTeam(sessionId, "cultivation:write");
    const batch = this.batchById(batchId);
    const amount = Number(dried);
    if (!batch.harvested) throw problem(409, "Registre a colheita antes do peso seco.");
    if (!Number.isInteger(amount) || amount <= 0 || amount > batch.harvested)
      throw problem(400, "Peso seco invalido.");
    batch.dried = amount;
    batch.status = "dried";
    batch.updatedAt = this.now().toISOString();
    this.audit("cultivation_dry_weight_recorded", actor.id, { batchId, dried: amount });
    this.persist();
    return batch;
  }

  moveBatchToStock(sessionId, { batchId, productId }) {
    const actor = this.requireTeam(sessionId, "cultivation:write");
    const batch = this.batchById(batchId);
    if (!batch.dried) throw problem(409, "Lote precisa de peso seco antes da saida para estoque.");
    if (batch.status === "stocked") throw problem(409, "Lote ja foi movido para estoque.");
    const product = this.productById(productId || batch.productId);
    product.stock += batch.dried;
    batch.productId = product.id;
    batch.status = "stocked";
    batch.updatedAt = this.now().toISOString();
    const lot = {
      id: `lot_${randomUUID()}`,
      batchId: batch.id,
      productId: product.id,
      strain: batch.strain,
      quantity: batch.dried,
      unit: product.unit,
      status: "available",
      createdAt: this.now().toISOString(),
    };
    this.state.inventoryLots.push(lot);
    this.state.stockMovements.push(
      movement(
        product.id,
        "in",
        batch.dried,
        `Saida do lote ${batch.strain} para estoque`,
        isoDate(this.now()),
      ),
    );
    this.audit("cultivation_batch_stocked", actor.id, {
      batchId,
      lotId: lot.id,
      productId: product.id,
      quantity: batch.dried,
    });
    this.persist();
    return { batch, lot, product: this.publicProduct(product) };
  }

  createPatient(sessionId, patient) {
    const actor = this.requireTeam(sessionId, "patients:write");
    const memberCode = String(patient.memberCode || "")
      .trim()
      .toUpperCase();
    const inviteCode = String(patient.inviteCode || "")
      .trim()
      .toUpperCase();
    if (!patient.name || !memberCode || !inviteCode)
      throw problem(400, "Paciente precisa de nome, codigo de associado e convite.");
    if (this.state.patients.some((item) => normalize(item.memberCode) === normalize(memberCode))) {
      throw problem(409, "Codigo de associado ja existe.");
    }
    const nextPatient = {
      id: `pat_${randomUUID()}`,
      name: String(patient.name).trim(),
      memberCode,
      inviteCode,
      status: patient.status === "inactive" ? "inactive" : "active",
      associationEligible: patient.associationEligible !== false,
      prescriptionExpiresAt: patient.prescriptionExpiresAt,
      cardExpiresAt: patient.cardExpiresAt || patient.prescriptionExpiresAt,
      guardianName: patient.guardianName || "",
      guardianPhone: patient.guardianPhone || "",
      contactPhone: patient.contactPhone || "",
      email: patient.email || "",
      city: patient.city || "",
      state: patient.state || "",
      carePlan: patient.carePlan || "",
      supportNote: patient.supportNote || "",
      privacyConsentAt: patient.privacyConsentAt || "",
      privacyConsentVersion: patient.privacyConsentVersion || "",
    };
    if (!nextPatient.prescriptionExpiresAt) throw problem(400, "Validade da receita obrigatoria.");
    this.state.patients.push(nextPatient);
    this.audit("patient_created", actor.id, { patientId: nextPatient.id, memberCode });
    this.persist();
    return this.publicPatient(nextPatient);
  }

  updatePatientAccess(sessionId, update) {
    const actor = this.requireTeam(sessionId, "patients:write");
    const patient = this.state.patients.find(
      (item) =>
        item.id === update.patientId || normalize(item.memberCode) === normalize(update.memberCode),
    );
    if (!patient) throw problem(404, "Paciente nao encontrado.");
    if (update.name !== undefined && String(update.name).trim())
      patient.name = String(update.name).trim();
    if (update.inviteCode !== undefined && String(update.inviteCode).trim())
      patient.inviteCode = String(update.inviteCode).trim().toUpperCase();
    if (update.status) patient.status = update.status === "inactive" ? "inactive" : "active";
    if (typeof update.associationEligible === "boolean")
      patient.associationEligible = update.associationEligible;
    if (update.associationEligible === "true") patient.associationEligible = true;
    if (update.associationEligible === "false") patient.associationEligible = false;
    if (update.prescriptionExpiresAt) patient.prescriptionExpiresAt = update.prescriptionExpiresAt;
    if (update.cardExpiresAt) patient.cardExpiresAt = update.cardExpiresAt;
    for (const field of [
      "guardianName",
      "guardianPhone",
      "contactPhone",
      "email",
      "city",
      "state",
      "carePlan",
      "supportNote",
    ]) {
      if (update[field] !== undefined) patient[field] = String(update[field] || "").trim();
    }
    this.audit("patient_access_updated", actor.id, {
      patientId: patient.id,
      memberCode: patient.memberCode,
      fields: Object.keys(update).filter((key) => key !== "patientId" && key !== "memberCode"),
      eligibility: this.patientEligibility(patient),
    });
    this.persist();
    return { patient: this.publicPatient(patient), eligibility: this.patientEligibility(patient) };
  }

  resetPatientInvite(sessionId, reset) {
    const actor = this.requireTeam(sessionId, "patients:write");
    const patient = this.state.patients.find(
      (item) =>
        item.id === reset.patientId || normalize(item.memberCode) === normalize(reset.memberCode),
    );
    if (!patient) throw problem(404, "Paciente nao encontrado.");
    const inviteCode = String(
      reset.inviteCode || generatedInviteCode(patient.memberCode, this.now()),
    )
      .trim()
      .toUpperCase();
    if (inviteCode.length < 6) throw problem(400, "Convite precisa ter pelo menos 6 caracteres.");
    patient.inviteCode = inviteCode;
    patient.inviteResetAt = this.now().toISOString();
    patient.inviteResetBy = actor.id;
    this.audit("patient_invite_reset", actor.id, {
      patientId: patient.id,
      memberCode: patient.memberCode,
    });
    this.persist();
    return {
      patient: this.publicPatient(patient),
      inviteCode,
    };
  }

  acceptPrivacyConsent(sessionId, consent) {
    const patient = this.requirePatient(sessionId);
    if (consent.accepted !== true) throw problem(400, "Aceite de privacidade obrigatorio.");
    const version = String(consent.version || "lgpd-2026-05").trim();
    patient.privacyConsentAt = this.now().toISOString();
    patient.privacyConsentVersion = version;
    this.audit("privacy_consent_accepted", patient.id, { memberCode: patient.memberCode, version });
    this.persist();
    return this.publicPatient(patient);
  }

  issueMemberCard(sessionId, card) {
    const actor = this.requireTeam(sessionId, "patients:write");
    this.state.memberships ||= [];
    const patient = this.state.patients.find(
      (item) =>
        item.id === card.patientId || normalize(item.memberCode) === normalize(card.memberCode),
    );
    if (!patient) throw problem(404, "Paciente nao encontrado.");
    if (!card.expiresAt) throw problem(400, "Validade da carteirinha obrigatoria.");
    const membership = {
      id: `member_${randomUUID()}`,
      patientId: patient.id,
      memberCode: patient.memberCode,
      cardNumber:
        card.cardNumber || `AV-${patient.memberCode}-${card.expiresAt.replaceAll("-", "")}`,
      status: card.status === "suspended" ? "suspended" : "active",
      issuedAt: this.now().toISOString(),
      expiresAt: card.expiresAt,
      note: card.note || "",
    };
    this.state.memberships.push(membership);
    patient.associationEligible = membership.status === "active";
    patient.cardExpiresAt = membership.expiresAt;
    if (card.prescriptionExpiresAt) patient.prescriptionExpiresAt = card.prescriptionExpiresAt;
    this.audit("member_card_issued", actor.id, {
      patientId: patient.id,
      membershipId: membership.id,
      cardNumber: membership.cardNumber,
      expiresAt: membership.expiresAt,
    });
    this.persist();
    return {
      membership,
      patient: this.publicPatient(patient),
      eligibility: this.patientEligibility(patient),
    };
  }

  registerPrescriptionDocument(sessionId, document) {
    const actor = this.requireTeam(sessionId, "prescriptions:write");
    const patient = this.state.patients.find(
      (item) =>
        item.id === document.patientId ||
        normalize(item.memberCode) === normalize(document.memberCode),
    );
    if (!patient) throw problem(404, "Paciente nao encontrado.");
    if (!document.storageKey || !document.fileName || !document.expiresAt) {
      throw problem(400, "Documento precisa de storageKey, nome do arquivo e validade.");
    }
    const nextDocument = {
      id: `rx_${randomUUID()}`,
      patientId: patient.id,
      memberCode: patient.memberCode,
      fileName: String(document.fileName).trim(),
      mimeType: document.mimeType || "application/octet-stream",
      storageKey: String(document.storageKey).trim(),
      privateFilePath: document.privateFilePath || "",
      sha256: document.sha256 || sha256(document.storageKey),
      expiresAt: document.expiresAt,
      status: document.status === "rejected" ? "rejected" : "active",
      createdAt: this.now().toISOString(),
    };
    this.state.prescriptionDocuments.push(nextDocument);
    patient.prescriptionExpiresAt = nextDocument.expiresAt;
    patient.cardExpiresAt = document.cardExpiresAt || nextDocument.expiresAt;
    this.audit("prescription_document_registered", actor.id, {
      patientId: patient.id,
      documentId: nextDocument.id,
      storageKey: nextDocument.storageKey,
      sha256: nextDocument.sha256,
    });
    this.persist();
    return {
      document: nextDocument,
      patient: this.publicPatient(patient),
      eligibility: this.patientEligibility(patient),
    };
  }

  getPrescriptionDocumentForDownload(sessionId, documentId) {
    const actor = this.requireTeam(sessionId, "prescriptions:write");
    const document = this.state.prescriptionDocuments.find((item) => item.id === documentId);
    if (!document) throw problem(404, "Documento de receita nao encontrado.");
    if (document.status !== "active") throw problem(403, "Documento de receita nao esta ativo.");
    this.audit("prescription_document_accessed", actor.id, {
      documentId: document.id,
      patientId: document.patientId,
      sha256: document.sha256,
    });
    this.persist();
    return document;
  }

  createProduct(sessionId, product) {
    const actor = this.requireTeam(sessionId, "products:write");
    const stock = Number(product.stock || 0);
    const priceCents = Math.round(Number(product.priceReais || 0) * 100);
    if (
      !product.name ||
      !product.unit ||
      !Number.isInteger(stock) ||
      stock < 0 ||
      !Number.isInteger(priceCents) ||
      priceCents <= 0
    ) {
      throw problem(400, "Produto precisa de nome, unidade, preco e estoque inicial validos.");
    }
    const nextProduct = {
      id: slug(product.name),
      name: String(product.name).trim(),
      description:
        product.description || "Produto liberado conforme receita valida e conferencia da equipe.",
      unit: String(product.unit).trim(),
      priceCents,
      stock,
      category: normalizeProductCategory(product.category),
      lowStockThreshold: normalizeLowStockThreshold(product.lowStockThreshold, 5),
      controlled:
        product.controlled === true ||
        product.controlled === "true" ||
        product.controlled === "controlled",
      internalNote: String(product.internalNote || "").trim(),
      active: true,
    };
    if (this.state.products.some((item) => item.id === nextProduct.id))
      throw problem(409, "Produto ja existe.");
    this.state.products.push(nextProduct);
    if (stock > 0)
      this.state.stockMovements.push(
        movement(nextProduct.id, "in", stock, "Estoque inicial do produto", isoDate(this.now())),
      );
    this.audit("product_created", actor.id, { productId: nextProduct.id });
    this.persist();
    return this.publicProduct(nextProduct);
  }

  updateProduct(sessionId, update) {
    const actor = this.requireTeam(sessionId, "products:write");
    const product = this.productById(update.productId);
    if (update.name) product.name = String(update.name).trim();
    if (update.description !== undefined) product.description = String(update.description).trim();
    if (update.unit) product.unit = String(update.unit).trim();
    if (update.category !== undefined) product.category = normalizeProductCategory(update.category);
    if (update.lowStockThreshold !== undefined && update.lowStockThreshold !== "") {
      product.lowStockThreshold = normalizeLowStockThreshold(
        update.lowStockThreshold,
        product.lowStockThreshold || 5,
      );
    }
    if (update.controlled !== undefined)
      product.controlled =
        update.controlled === true ||
        update.controlled === "true" ||
        update.controlled === "controlled";
    if (update.internalNote !== undefined)
      product.internalNote = String(update.internalNote || "").trim();
    if (update.priceReais !== undefined && update.priceReais !== "") {
      const priceCents = Math.round(Number(update.priceReais) * 100);
      if (!Number.isInteger(priceCents) || priceCents <= 0)
        throw problem(400, "Preco do produto invalido.");
      product.priceCents = priceCents;
    }
    if (update.active !== undefined)
      product.active =
        update.active === true || update.active === "true" || update.active === "active";
    this.audit("product_updated", actor.id, {
      productId: product.id,
      active: product.active,
      priceCents: product.priceCents,
      category: product.category,
    });
    this.persist();
    return this.publicProduct(product);
  }

  updateFulfillmentStatus(sessionId, { orderId, status }) {
    const actor = this.requireTeam(sessionId, "fulfillment:write");
    const allowed = ["paid_pending_fulfillment", "separating", "ready_to_ship", "sent"];
    if (!allowed.includes(status)) throw problem(400, "Status de fulfillment invalido.");
    const order = this.orderById(orderId);
    if (order.status === "awaiting_payment" || order.status === "payment_expired") {
      throw problem(409, "Pedido ainda nao esta pago para fulfillment.");
    }
    order.status = status;
    order.updatedAt = this.now().toISOString();
    this.audit("fulfillment_updated", actor.id, { orderId, status });
    this.persist();
    return this.publicOrder(order);
  }

  cancelOrder(sessionId, cancellation) {
    const actor = this.requireTeam(sessionId, "fulfillment:write");
    const order = this.orderById(cancellation.orderId);
    const reason = String(cancellation.reason || "").trim();
    if (!reason) throw problem(400, "Cancelamento precisa de motivo operacional.");
    if (order.status === "sent")
      throw problem(409, "Pedido enviado exige excecao operacional, nao cancelamento simples.");
    if (["cancelled", "payment_expired"].includes(order.status)) return this.publicOrder(order);

    const payment = this.findPayment(order.paymentId);
    const reservation = this.state.stockReservations.find(
      (item) => item.id === order.reservationId,
    );
    order.exceptions ||= [];
    const exception = orderException("cancelamento", reason, actor.id, this.now());

    if (order.status === "awaiting_payment") {
      order.status = "cancelled";
      order.cancelledAt = this.now().toISOString();
      order.updatedAt = order.cancelledAt;
      order.exceptions.push(exception);
      if (reservation?.status === "active") {
        reservation.status = "cancelled";
        reservation.cancelledAt = order.cancelledAt;
      }
      if (payment?.status === "pending") {
        payment.status = "cancelled";
        payment.cancelledAt = order.cancelledAt;
      }
      this.audit("order_cancelled", actor.id, {
        orderId: order.id,
        reason,
        releasedReservation: reservation?.status === "cancelled",
      });
      this.persist();
      return this.publicOrder(order);
    }

    order.status = "fulfillment_exception";
    order.exceptionStatus = "refund_review";
    order.updatedAt = this.now().toISOString();
    order.exceptions.push(exception);
    if (payment?.status === "paid") {
      payment.refundStatus = "pending_review";
      payment.refundReason = reason;
      payment.updatedAt = order.updatedAt;
    }
    this.audit("order_exception_recorded", actor.id, {
      orderId: order.id,
      type: "cancelamento",
      reason,
      refundStatus: payment?.refundStatus || "",
    });
    this.persist();
    return this.publicOrder(order);
  }

  recordOrderException(sessionId, exceptionInput) {
    const actor = this.requireTeam(sessionId, "fulfillment:write");
    const order = this.orderById(exceptionInput.orderId);
    const type = normalizeOrderExceptionType(exceptionInput.type);
    const note = String(exceptionInput.note || "").trim();
    if (!note) throw problem(400, "Excecao precisa de anotacao operacional.");
    order.exceptions ||= [];
    order.exceptions.push(orderException(type, note, actor.id, this.now()));
    if (
      order.status !== "sent" &&
      order.status !== "cancelled" &&
      order.status !== "payment_expired"
    ) {
      order.status = "fulfillment_exception";
      order.exceptionStatus = type;
    }
    order.updatedAt = this.now().toISOString();
    this.audit("order_exception_recorded", actor.id, { orderId: order.id, type, note });
    this.persist();
    return this.publicOrder(order);
  }

  upsertShipment(sessionId, shipment) {
    const actor = this.requireTeam(sessionId, "shipments:write");
    const order = this.orderById(shipment.orderId);
    if (order.status === "awaiting_payment" || order.status === "payment_expired") {
      throw problem(409, "Pedido precisa estar pago antes de criar envio.");
    }
    const nextShipment = {
      id: shipment.id || `ship_${randomUUID()}`,
      orderId: order.id,
      carrier: shipment.carrier || "Manual",
      service: shipment.service || order.deliveryMethod || "Retirada combinada",
      trackingCode: shipment.trackingCode || "",
      labelUrl: shipment.labelUrl || "",
      status: shipment.status || "created",
      updatedAt: this.now().toISOString(),
      createdAt: shipment.createdAt || this.now().toISOString(),
    };
    this.state.shipments = this.state.shipments.filter(
      (item) => item.id !== nextShipment.id && item.orderId !== order.id,
    );
    this.state.shipments.push(nextShipment);
    if (nextShipment.status === "sent") {
      order.status = "sent";
      order.updatedAt = this.now().toISOString();
    } else if (order.status === "paid_pending_fulfillment") {
      order.status = "ready_to_ship";
      order.updatedAt = this.now().toISOString();
    }
    this.audit("shipment_upserted", actor.id, {
      orderId: order.id,
      shipmentId: nextShipment.id,
      status: nextShipment.status,
    });
    this.persist();
    return { shipment: nextShipment, order: this.publicOrder(order) };
  }

  expireReservations() {
    const now = this.now();
    let changed = false;
    for (const reservation of this.state.stockReservations) {
      if (reservation.status === "active" && new Date(reservation.expiresAt) <= now) {
        reservation.status = "expired";
        reservation.expiredAt = now.toISOString();
        const order = this.state.orders.find((item) => item.id === reservation.orderId);
        if (order && order.status === "awaiting_payment") {
          order.status = "payment_expired";
          order.updatedAt = now.toISOString();
        }
        const payment = order
          ? this.state.payments.find((item) => item.id === order.paymentId)
          : null;
        if (payment && payment.status === "pending") {
          payment.status = "expired";
          payment.expiredAt = now.toISOString();
        }
        this.audit("reservation_expired", reservation.patientId, {
          reservationId: reservation.id,
          orderId: reservation.orderId,
          paymentId: payment?.id || "",
        });
        changed = true;
      }
    }
    if (changed) this.persist();
  }

  patientEligibility(patient) {
    if (!patient) return { allowed: false, reason: "Paciente nao encontrado." };
    if (patient.status !== "active")
      return { allowed: false, reason: "Cadastro de paciente inativo." };
    if (!patient.associationEligible)
      return { allowed: false, reason: "Associacao do paciente nao elegivel." };
    if (dateExpired(patient.prescriptionExpiresAt, this.now()))
      return { allowed: false, reason: "Receita medica vencida." };
    if (dateExpired(patient.cardExpiresAt, this.now()))
      return { allowed: false, reason: "Carteirinha da associacao vencida." };
    return { allowed: true, reason: "Paciente ativo com receita e carteirinha validas." };
  }

  checkItems(items) {
    if (!Array.isArray(items) || !items.length)
      throw problem(400, "Pedido precisa ter ao menos um item.");
    return items.map((item) => {
      const product = this.productById(item.productId);
      if (!product.active) throw problem(400, `Produto indisponivel: ${product.name}.`);
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0)
        throw problem(400, "Quantidade invalida no pedido.");
      return { product, quantity };
    });
  }

  availableStock(productId) {
    const product = this.productById(productId);
    const reserved = this.state.stockReservations
      .filter(
        (reservation) =>
          reservation.status === "active" && new Date(reservation.expiresAt) > this.now(),
      )
      .flatMap((reservation) => reservation.items)
      .filter((item) => item.productId === productId)
      .reduce((sum, item) => sum + item.quantity, 0);
    return product.stock - reserved;
  }

  productById(productId) {
    const product = this.state.products.find((item) => item.id === productId);
    if (!product) throw problem(404, "Produto nao encontrado.");
    return product;
  }

  orderById(orderId) {
    const order = this.state.orders.find((item) => item.id === orderId);
    if (!order) throw problem(404, "Pedido nao encontrado.");
    return order;
  }

  batchById(batchId) {
    const batch = this.state.cultivationBatches.find((item) => item.id === batchId);
    if (!batch) throw problem(404, "Lote de cultivo nao encontrado.");
    return batch;
  }

  publicPatient(patient) {
    return {
      id: patient.id,
      name: patient.name,
      memberCode: patient.memberCode,
      status: patient.status,
      associationEligible: patient.associationEligible !== false,
      prescriptionExpiresAt: patient.prescriptionExpiresAt,
      cardExpiresAt: patient.cardExpiresAt,
      guardianName: patient.guardianName,
      guardianPhone: patient.guardianPhone || "",
      contactPhone: patient.contactPhone || "",
      email: patient.email || "",
      city: patient.city || "",
      state: patient.state || "",
      carePlan: patient.carePlan || "",
      supportNote: patient.supportNote || "",
      privacyConsentAt: patient.privacyConsentAt || "",
      privacyConsentVersion: patient.privacyConsentVersion || "",
      inviteResetAt: patient.inviteResetAt || "",
      lastLoginAt: patient.lastLoginAt || null,
      lastSessionExpiresAt: patient.lastSessionExpiresAt || null,
      eligibility: this.patientEligibility(patient),
    };
  }

  patientByCredentials({ memberCode, inviteCode }) {
    return this.state.patients.find(
      (item) =>
        normalize(item.memberCode) === normalize(memberCode) &&
        normalize(item.inviteCode) === normalize(inviteCode),
    );
  }

  publicSupportTicket(ticket) {
    return {
      id: ticket.id,
      patientId: ticket.patientId,
      memberCode: ticket.memberCode,
      patientName: ticket.patientName,
      subject: ticket.subject,
      message: ticket.message,
      priority: ticket.priority,
      status: ticket.status,
      type: ticket.type || "support",
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      relatedOrderId: ticket.relatedOrderId || "",
      internalNote: ticket.internalNote || "",
      accessReason: ticket.accessReason || "",
    };
  }

  activePatientSession(patientId) {
    const sessions = this.state.sessions
      .filter(
        (session) =>
          session.role === "patient" &&
          session.patientId === patientId &&
          new Date(session.expiresAt) > this.now(),
      )
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const session = sessions[0];
    return session ? { createdAt: session.createdAt, expiresAt: session.expiresAt } : null;
  }

  publicProduct(product) {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      unit: product.unit,
      priceCents: product.priceCents,
      stock: product.stock,
      availableStock: this.availableStock(product.id),
      category: product.category || normalizeProductCategory(product.name),
      lowStockThreshold: product.lowStockThreshold || 5,
      controlled: product.controlled === true,
      internalNote: product.internalNote || "",
      active: product.active,
    };
  }

  publicOrder(order) {
    const payment = this.state.payments.find((item) => item.id === order.paymentId);
    const shipment = this.state.shipments.find((item) => item.orderId === order.id) || null;
    return {
      ...order,
      paymentStatus: payment?.status || "missing",
      paymentExpiresAt: payment?.expiresAt || null,
      paymentProvider: payment?.provider || null,
      pix: payment?.pix || null,
      shipment,
    };
  }

  findPayment(paymentId) {
    return this.state.payments.find(
      (item) => item.id === paymentId || item.providerPaymentId === paymentId,
    );
  }

  audit(action, actor, details) {
    this.state.auditLog.push({
      id: randomUUID(),
      action,
      actor,
      details,
      at: this.now().toISOString(),
    });
  }

  persist() {
    this.save(this.state);
  }
}

function movement(productId, type, quantity, note, date) {
  return { id: randomUUID(), productId, type, quantity, note, date };
}

export function createDevPixProvider({ now = () => new Date() } = {}) {
  return {
    name: "dev-pix",
    async createPayment({ paymentId, orderId, patient, totalCents, expiresAt }) {
      const copiaECola = `PIX-DEV|associacao-verde|${orderId}|${totalCents}|${paymentId}`;
      return {
        id: paymentId,
        provider: "dev-pix",
        providerPaymentId: paymentId,
        orderId,
        status: "pending",
        amountCents: totalCents,
        expiresAt,
        pix: {
          qrCodeText: copiaECola,
          copiaECola,
          payerName: patient.name,
          note: "Ambiente local. Trocar provider dev-pix por Asaas, Mercado Pago ou Pagar.me apos aceite da conta.",
        },
        createdAt: now().toISOString(),
      };
    },
    async getPaymentStatus(providerPaymentId) {
      return {
        providerPaymentId,
        status: "pending",
        rawStatus: "DEV_PENDING",
        checkedAt: now().toISOString(),
      };
    },
  };
}

export function createAsaasPixProvider({
  apiKey,
  customerId,
  baseUrl = "https://api-sandbox.asaas.com/v3",
  now = () => new Date(),
}) {
  if (!apiKey) throw new Error("ASAAS_API_KEY obrigatorio para provider Asaas.");
  return {
    name: "asaas",
    async createPayment({ paymentId, orderId, patient, totalCents, expiresAt }) {
      const asaasCustomerId = patient.asaasCustomerId || customerId;
      if (!asaasCustomerId)
        throw problem(
          500,
          "ASAAS_CUSTOMER_ID ou patient.asaasCustomerId obrigatorio para criar Pix Asaas.",
        );
      const charge = await asaasFetch({
        apiKey,
        baseUrl,
        path: "/payments",
        method: "POST",
        body: {
          customer: asaasCustomerId,
          billingType: "PIX",
          value: totalCents / 100,
          dueDate: expiresAt.slice(0, 10),
          description: `Pedido ${orderId} - Apoiar`,
          externalReference: orderId,
        },
      });
      const qr = await asaasFetch({
        apiKey,
        baseUrl,
        path: `/payments/${charge.id}/pixQrCode`,
        method: "GET",
      });
      return {
        id: paymentId,
        provider: "asaas",
        providerPaymentId: charge.id,
        orderId,
        status: "pending",
        amountCents: totalCents,
        expiresAt: qr.expirationDate || expiresAt,
        pix: {
          qrCodeText: qr.payload,
          copiaECola: qr.payload,
          encodedImage: qr.encodedImage,
          payerName: patient.name,
          note: "Pix Asaas gerado por cobranca PIX; confirmar baixa somente via webhook assinado.",
        },
        createdAt: now().toISOString(),
      };
    },
    async getPaymentStatus(providerPaymentId) {
      const payment = await asaasFetch({
        apiKey,
        baseUrl,
        path: `/payments/${providerPaymentId}`,
        method: "GET",
      });
      return {
        providerPaymentId: payment.id || providerPaymentId,
        status: normalizeProviderPaymentStatus(payment.status),
        rawStatus: payment.status || "UNKNOWN",
        value: payment.value,
        externalReference: payment.externalReference,
        checkedAt: now().toISOString(),
      };
    },
  };
}

async function asaasFetch({ apiKey, baseUrl, path, method, body }) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw problem(
      response.status,
      payload.errors?.[0]?.description || payload.message || "Erro na API Asaas.",
    );
  return payload;
}

function normalize(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, "");
}

function slug(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeProviderPaymentStatus(status) {
  const normalized = String(status || "")
    .trim()
    .toUpperCase();
  if (["PAID", "RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(normalized)) return "paid";
  if (["PENDING", "AWAITING_RISK_ANALYSIS", "DEV_PENDING"].includes(normalized)) return "pending";
  if (["OVERDUE", "EXPIRED"].includes(normalized)) return "expired";
  if (["CANCELED", "CANCELLED", "DELETED"].includes(normalized)) return "cancelled";
  if (
    [
      "FAILED",
      "CHARGEBACK_REQUESTED",
      "CHARGEBACK_DISPUTE",
      "AWAITING_CHARGEBACK_REVERSAL",
    ].includes(normalized)
  )
    return "failed";
  if (["REFUNDED", "REFUND_REQUESTED", "REFUND_IN_PROGRESS"].includes(normalized))
    return "refunded";
  return "unknown";
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(password), salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, encoded) {
  const [algorithm, salt, expectedHash] = String(encoded || "").split(":");
  if (algorithm !== "scrypt" || !salt || !expectedHash) return false;
  const actual = Buffer.from(scryptSync(String(password), salt, 64).toString("hex"));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function publicTeamUser(user) {
  const permissions = ROLE_PERMISSIONS[normalizeTeamRole(user.role)] || ROLE_PERMISSIONS.support;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    permissions,
  };
}

function publicSession(session) {
  return {
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
  };
}

function publicPrescriptionDocument(document) {
  return {
    id: document.id,
    patientId: document.patientId,
    memberCode: document.memberCode,
    fileName: document.fileName,
    mimeType: document.mimeType,
    sha256: document.sha256,
    expiresAt: document.expiresAt,
    status: document.status,
    createdAt: document.createdAt,
  };
}

function normalizeTeamRole(role) {
  const normalized = String(role || "support")
    .trim()
    .toLowerCase();
  return ROLE_PERMISSIONS[normalized] ? normalized : "support";
}

function normalizeTeamUserStatus(status) {
  const normalized = String(status || "inactive")
    .trim()
    .toLowerCase();
  return normalized === "active" ? "active" : "inactive";
}

function normalizeOrderExceptionType(type) {
  const normalized = String(type || "operacional")
    .trim()
    .toLowerCase();
  return [
    "cancelamento",
    "reembolso",
    "endereco",
    "documento",
    "estoque",
    "transportadora",
    "operacional",
  ].includes(normalized)
    ? normalized
    : "operacional";
}

function normalizeProductCategory(category) {
  const normalized = normalize(category).toLowerCase();
  if (["oil", "oleo", "oleos", "tintura"].includes(normalized)) return "oil";
  if (["flower", "flor", "flores"].includes(normalized)) return "flower";
  if (["edible", "edibles", "goma", "gomas", "capsula", "capsulas", "oral"].includes(normalized))
    return "edible";
  return "other";
}

function normalizeLowStockThreshold(value, fallback) {
  const threshold = Number(value);
  if (!Number.isInteger(threshold) || threshold < 0) return fallback;
  return threshold;
}

function orderException(type, note, actorId, now) {
  return {
    id: `ord_exc_${randomUUID()}`,
    type,
    note,
    actorId,
    createdAt: now.toISOString(),
  };
}

function hasPermission(role, permission) {
  const permissions = ROLE_PERMISSIONS[normalizeTeamRole(role)] || ROLE_PERMISSIONS.support;
  return permissions.includes("*") || permissions.includes(permission);
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function dateExpired(value, now) {
  return new Date(`${value}T23:59:59-03:00`) < now;
}

function generatedInviteCode(memberCode, now) {
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `${String(memberCode || "APO")
    .replace(/[^A-Z0-9]/gi, "")
    .slice(-4)}${isoDate(now()).replaceAll("-", "").slice(2)}${suffix}`;
}

function problem(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export { DAY_MS };
