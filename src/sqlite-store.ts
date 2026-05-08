// @ts-nocheck
// TODO(phase-6 + phase-7): incrementally type — Phase 6 owns inventory/lots schema; Phase 7 adds support_messages table (schema v15). Removing this requires both phases done.
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createInitialState } from "./production-system.ts";

// Migration ledger (append-only). Each entry is recorded in schema_migrations
// the first time the store opens a fresh database. Existing databases are
// reconciled by `addColumnIfMissing` and idempotent CREATE TABLE IF NOT EXISTS
// statements in `migrate()`.
//
// Phase 7 (Support workbench) adds v15: support_messages table -- append-only
// thread of patient + team replies on a support ticket. Prior phases between
// v1 and v14 are reserved/inferred from the working tree (the original
// migrate() block was authored in a single shot at v1; v15 is the first
// explicit append). Never edit prior migration entries; only append.
export const SCHEMA_MIGRATIONS = [
  { version: 1, name: "initial_json_state_schema" },
  { version: 15, name: "support_messages_thread" },
];
export const SQLITE_SCHEMA_VERSION = SCHEMA_MIGRATIONS[SCHEMA_MIGRATIONS.length - 1].version;

export class SqliteStateStore {
  constructor({ filePath, now = () => new Date() }) {
    mkdirSync(dirname(filePath), { recursive: true });
    this.db = new DatabaseSync(filePath);
    this.now = now;
    this.migrate();
    this.seedIfEmpty();
  }

  load() {
    return {
      meta: this.rowJson("app_meta", "id", "main") || createInitialState(this.now()).meta,
      patients: this.allJson("patients"),
      memberships: this.allJson("memberships"),
      teamUsers: this.allJson("team_users"),
      products: this.allJson("products"),
      cultivationBatches: this.allJson("cultivation_batches"),
      inventoryLots: this.allJson("inventory_lots"),
      sessions: this.allJson("sessions"),
      stockReservations: this.allJson("stock_reservations"),
      stockMovements: this.allJson("stock_movements"),
      orders: this.allJson("orders"),
      payments: this.allJson("payments"),
      paymentEvents: this.allJson("payment_events"),
      prescriptionDocuments: this.allJson("prescription_documents"),
      supportTickets: this.allJson("support_tickets"),
      shipments: this.allJson("shipments"),
      auditLog: this.allJson("audit_log"),
    };
  }

  save(state) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.replaceJson("app_meta", "main", state.meta);
      this.replaceTable("patients", state.patients);
      this.replaceTable("memberships", state.memberships || []);
      this.replaceTable("team_users", state.teamUsers || []);
      this.replaceTable("products", state.products);
      this.replaceTable("cultivation_batches", state.cultivationBatches || []);
      this.replaceTable("inventory_lots", state.inventoryLots || []);
      this.replaceTable("sessions", state.sessions);
      this.replaceTable("stock_reservations", state.stockReservations);
      this.replaceTable("stock_movements", state.stockMovements);
      this.replaceTable("orders", state.orders);
      this.replaceTable("payments", state.payments);
      this.replaceTable("payment_events", state.paymentEvents, "eventId");
      this.replaceTable("prescription_documents", state.prescriptionDocuments || []);
      this.replaceTable("support_tickets", state.supportTickets || []);
      this.replaceTable("shipments", state.shipments || []);
      this.replaceTable("audit_log", state.auditLog);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  close() {
    this.db.close();
  }

  migrate() {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      PRAGMA user_version = ${SQLITE_SCHEMA_VERSION};

      CREATE TABLE IF NOT EXISTS app_meta (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS patients (
        id TEXT PRIMARY KEY,
        member_code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        prescription_expires_at TEXT NOT NULL,
        card_expires_at TEXT NOT NULL,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        unit TEXT NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        price_cents INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS team_users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        status TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS memberships (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        member_code TEXT NOT NULL,
        card_number TEXT NOT NULL,
        status TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cultivation_batches (
        id TEXT PRIMARY KEY,
        strain TEXT NOT NULL,
        product_id TEXT,
        week INTEGER NOT NULL,
        status TEXT NOT NULL,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS inventory_lots (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        status TEXT NOT NULL,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS stock_reservations (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        status TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS stock_movements (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        status TEXT NOT NULL,
        payment_id TEXT NOT NULL,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        provider_payment_id TEXT,
        status TEXT NOT NULL,
        order_id TEXT NOT NULL,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS payment_events (
        id TEXT PRIMARY KEY,
        payment_id TEXT NOT NULL,
        status TEXT NOT NULL,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS prescription_documents (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        member_code TEXT NOT NULL,
        storage_key TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        status TEXT NOT NULL,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS support_tickets (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        member_code TEXT NOT NULL,
        status TEXT NOT NULL,
        priority TEXT NOT NULL,
        created_at TEXT NOT NULL,
        data TEXT NOT NULL
      );

      -- Phase 7 (schema v15): support_messages -- append-only thread of
      -- replies (patient + team) on a single support ticket. Indexed by
      -- ticket id + created_at for fast thread fetches. Replies never
      -- mutate (audit-friendly).
      CREATE TABLE IF NOT EXISTS support_messages (
        id TEXT PRIMARY KEY,
        ticket_id TEXT NOT NULL,
        author_type TEXT NOT NULL,
        author_id TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_support_messages_ticket
        ON support_messages (ticket_id, created_at);

      CREATE TABLE IF NOT EXISTS shipments (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        carrier TEXT NOT NULL,
        tracking_code TEXT,
        status TEXT NOT NULL,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        actor TEXT NOT NULL,
        at TEXT NOT NULL,
        data TEXT NOT NULL
      );
    `);
    this.addColumnIfMissing("products", "stock", "INTEGER NOT NULL DEFAULT 0");
    this.addColumnIfMissing("products", "price_cents", "INTEGER NOT NULL DEFAULT 0");
    for (const migration of SCHEMA_MIGRATIONS) {
      this.recordMigration(migration.version, migration.name);
    }
  }

  seedIfEmpty() {
    const count = this.db.prepare("SELECT COUNT(*) AS count FROM app_meta").get().count;
    if (count === 0) this.save(createInitialState(this.now()));
  }

  rowJson(table, key, id) {
    const row = this.db.prepare(`SELECT data FROM ${table} WHERE ${key} = ?`).get(id);
    return row ? JSON.parse(row.data) : null;
  }

  allJson(table) {
    return this.db
      .prepare(`SELECT data FROM ${table}`)
      .all()
      .map((row) => JSON.parse(row.data));
  }

  replaceTable(table, rows, key = "id") {
    this.db.prepare(`DELETE FROM ${table}`).run();
    for (const row of rows) this.insertJson(table, row[key], row);
  }

  replaceJson(table, id, value) {
    this.db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    this.insertJson(table, id, value);
  }

  insertJson(table, id, value) {
    const json = JSON.stringify(value);
    const insert = {
      app_meta: () =>
        this.db.prepare("INSERT INTO app_meta (id, data) VALUES (?, ?)").run(id, json),
      patients: () =>
        this.db
          .prepare(
            "INSERT INTO patients (id, member_code, name, status, prescription_expires_at, card_expires_at, data) VALUES (?, ?, ?, ?, ?, ?, ?)",
          )
          .run(
            value.id,
            value.memberCode,
            value.name,
            value.status,
            value.prescriptionExpiresAt,
            value.cardExpiresAt,
            json,
          ),
      products: () =>
        this.db
          .prepare(
            "INSERT INTO products (id, name, unit, stock, price_cents, active, data) VALUES (?, ?, ?, ?, ?, ?, ?)",
          )
          .run(
            value.id,
            value.name,
            value.unit,
            value.stock,
            value.priceCents,
            value.active ? 1 : 0,
            json,
          ),
      team_users: () =>
        this.db
          .prepare(
            "INSERT INTO team_users (id, email, name, role, status, password_hash, data) VALUES (?, ?, ?, ?, ?, ?, ?)",
          )
          .run(
            value.id,
            value.email,
            value.name,
            value.role,
            value.status,
            value.passwordHash,
            json,
          ),
      memberships: () =>
        this.db
          .prepare(
            "INSERT INTO memberships (id, patient_id, member_code, card_number, status, expires_at, data) VALUES (?, ?, ?, ?, ?, ?, ?)",
          )
          .run(
            value.id,
            value.patientId,
            value.memberCode,
            value.cardNumber,
            value.status,
            value.expiresAt,
            json,
          ),
      cultivation_batches: () =>
        this.db
          .prepare(
            "INSERT INTO cultivation_batches (id, strain, product_id, week, status, data) VALUES (?, ?, ?, ?, ?, ?)",
          )
          .run(value.id, value.strain, value.productId || "", value.week, value.status, json),
      inventory_lots: () =>
        this.db
          .prepare(
            "INSERT INTO inventory_lots (id, batch_id, product_id, quantity, status, data) VALUES (?, ?, ?, ?, ?, ?)",
          )
          .run(value.id, value.batchId, value.productId, value.quantity, value.status, json),
      sessions: () =>
        this.db
          .prepare("INSERT INTO sessions (id, role, expires_at, data) VALUES (?, ?, ?, ?)")
          .run(value.id, value.role, value.expiresAt, json),
      stock_reservations: () =>
        this.db
          .prepare(
            "INSERT INTO stock_reservations (id, order_id, patient_id, status, expires_at, data) VALUES (?, ?, ?, ?, ?, ?)",
          )
          .run(value.id, value.orderId, value.patientId, value.status, value.expiresAt, json),
      stock_movements: () =>
        this.db
          .prepare(
            "INSERT INTO stock_movements (id, product_id, type, quantity, data) VALUES (?, ?, ?, ?, ?)",
          )
          .run(value.id, value.productId, value.type, value.quantity, json),
      orders: () =>
        this.db
          .prepare(
            "INSERT INTO orders (id, patient_id, status, payment_id, data) VALUES (?, ?, ?, ?, ?)",
          )
          .run(value.id, value.patientId, value.status, value.paymentId, json),
      payments: () =>
        this.db
          .prepare(
            "INSERT INTO payments (id, provider, provider_payment_id, status, order_id, data) VALUES (?, ?, ?, ?, ?, ?)",
          )
          .run(
            value.id,
            value.provider,
            value.providerPaymentId || value.id,
            value.status,
            value.orderId,
            json,
          ),
      payment_events: () =>
        this.db
          .prepare("INSERT INTO payment_events (id, payment_id, status, data) VALUES (?, ?, ?, ?)")
          .run(id, value.paymentId, value.status, json),
      support_messages: () =>
        this.db
          .prepare(
            "INSERT INTO support_messages (id, ticket_id, author_type, author_id, body, created_at) VALUES (?, ?, ?, ?, ?, ?)",
          )
          .run(
            value.id,
            value.ticketId,
            value.authorType,
            value.authorId,
            value.body,
            value.createdAt,
          ),
      prescription_documents: () =>
        this.db
          .prepare(
            "INSERT INTO prescription_documents (id, patient_id, member_code, storage_key, sha256, expires_at, status, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .run(
            value.id,
            value.patientId,
            value.memberCode,
            value.storageKey,
            value.sha256,
            value.expiresAt,
            value.status,
            json,
          ),
      support_tickets: () =>
        this.db
          .prepare(
            "INSERT INTO support_tickets (id, patient_id, member_code, status, priority, created_at, data) VALUES (?, ?, ?, ?, ?, ?, ?)",
          )
          .run(
            value.id,
            value.patientId,
            value.memberCode,
            value.status,
            value.priority,
            value.createdAt,
            json,
          ),
      shipments: () =>
        this.db
          .prepare(
            "INSERT INTO shipments (id, order_id, carrier, tracking_code, status, data) VALUES (?, ?, ?, ?, ?, ?)",
          )
          .run(value.id, value.orderId, value.carrier, value.trackingCode, value.status, json),
      audit_log: () =>
        this.db
          .prepare("INSERT INTO audit_log (id, action, actor, at, data) VALUES (?, ?, ?, ?, ?)")
          .run(value.id, value.action, value.actor, value.at, json),
    }[table];
    insert();
  }

  addColumnIfMissing(table, column, definition) {
    const exists = this.db
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .some((row) => row.name === column);
    if (!exists) this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }

  recordMigration(version, name) {
    this.db
      .prepare(
        "INSERT OR IGNORE INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
      )
      .run(version, name, this.now().toISOString());
  }

  // Phase 7 (schema v15) -- support_messages thread queries. The thread is
  // stored row-per-message (append-only) so replies never mutate prior rows
  // and history is audit-friendly. ProductionSystem owns the public API
  // (createSupportReply / listSupportThread); these helpers carry the SQL.
  appendSupportMessage(message) {
    const row = {
      id: message.id,
      ticketId: message.ticketId,
      authorType: message.authorType,
      authorId: message.authorId,
      body: message.body,
      createdAt: message.createdAt,
    };
    this.insertJson("support_messages", row.id, row);
    return row;
  }

  listSupportMessages(ticketId) {
    return this.db
      .prepare(
        "SELECT id, ticket_id AS ticketId, author_type AS authorType, author_id AS authorId, body, created_at AS createdAt FROM support_messages WHERE ticket_id = ? ORDER BY created_at ASC, id ASC",
      )
      .all(ticketId);
  }

  schemaVersion() {
    return this.db.prepare("PRAGMA user_version").get().user_version;
  }

  migrations() {
    return this.db
      .prepare(
        "SELECT version, name, applied_at AS appliedAt FROM schema_migrations ORDER BY version",
      )
      .all();
  }
}
