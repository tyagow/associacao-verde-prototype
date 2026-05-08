// @ts-nocheck
// Stage A of server.mjs → Next.js migration: module-level lazy singleton
// for the ProductionSystem + SqliteStateStore. Importable from any Next.js
// Route Handler. Preserves the exact construction sequence from server.mjs
// (lines ~14-127): env reads, store init, payment provider selection,
// system construction, team-user seeding, reservation-expiry timer.
//
// server.mjs continues to import this same instance during the migration
// so there is one in-process system, regardless of which layer (legacy
// server.mjs switch or Next.js Route Handler) handles the request.

import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createAsaasPixProvider, ProductionSystem } from "./production-system.ts";
import { SqliteStateStore } from "./sqlite-store.ts";

function requiredEnv(name, fallback) {
  const value = process.env[name] || fallback;
  if (!value) throw new Error(`${name} obrigatorio para iniciar a aplicacao.`);
  return value;
}

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = join(__dirname, "..");

let cached = null;

function build() {
  const production = process.env.NODE_ENV === "production";
  const dbFile = process.env.DB_FILE || join(repoRoot, "data", "associacao-verde.sqlite");
  const documentStorageDir =
    process.env.DOCUMENT_STORAGE_DIR || join(repoRoot, "data", "private-documents");
  const teamPassword = requiredEnv("TEAM_PASSWORD", production ? undefined : "apoio-equipe-dev");
  const teamEmail = process.env.TEAM_EMAIL || "equipe@apoiar.local";
  const webhookSecret = requiredEnv(
    "PIX_WEBHOOK_SECRET",
    production ? undefined : "dev-webhook-secret",
  );
  const sessionSecret = requiredEnv(
    "SESSION_SECRET",
    production ? undefined : "dev-session-secret-change-me",
  );
  const readinessDir = join(repoRoot, "artifacts", "readiness");

  if (production && process.env.PAYMENT_PROVIDER !== "asaas") {
    throw new Error("PAYMENT_PROVIDER=asaas obrigatorio em producao.");
  }
  const paymentProvider =
    process.env.PAYMENT_PROVIDER === "asaas"
      ? createAsaasPixProvider({
          apiKey: requiredEnv("ASAAS_API_KEY"),
          customerId: requiredEnv("ASAAS_CUSTOMER_ID"),
          baseUrl: process.env.ASAAS_BASE_URL || "https://api-sandbox.asaas.com/v3",
        })
      : undefined;

  const store = new SqliteStateStore({ filePath: dbFile });
  const state = store.load();
  const system = new ProductionSystem({
    state,
    paymentProvider,
    save: (nextState) => store.save(nextState),
    // Phase 7 — support_messages thread (schema v15)
    appendSupportMessage: (message) => store.appendSupportMessage(message),
    listSupportMessages: (ticketId) => store.listSupportMessages(ticketId),
  });
  system.ensureTeamUser({
    email: teamEmail,
    password: teamPassword,
    name: "Equipe Apoiar",
    role: "admin",
  });

  const reservationExpiryTimer = setInterval(() => system.expireReservations(), 60_000);
  reservationExpiryTimer.unref?.();

  return {
    system,
    store,
    paymentProvider,
    documentStorageDir,
    readinessDir,
    webhookSecret,
    sessionSecret,
    teamEmail,
    teamPassword,
    production,
    dbFile,
    reservationExpiryTimer,
  };
}

export function getSystem() {
  if (!cached) cached = build();
  return cached;
}
