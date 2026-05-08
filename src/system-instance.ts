// @ts-nocheck
// Stage 1 of TRUE single-process Next.js migration: shared singleton.
//
// server.mjs (run via `node --import tsx`) and Next.js Route Handlers
// (bundled through Turbopack) load this file in DIFFERENT module graphs.
// Module-local `cached` would therefore yield TWO ProductionSystem +
// SqliteStateStore instances on the same DB file, racing on writes.
//
// Solution: we cache the built system on `globalThis` (the same object
// across every module graph in the same Node process). Both server.mjs
// and Route Handlers see the same instance — the SqliteStateStore +
// reservation-expiry timer + team-user seeding run exactly once, and
// every getSystem() call returns the same handle.
//
// This is the architectural foundation that lets Route Handlers do real
// state-touching work without proxying back to server.mjs over fetch.

import { join } from "node:path";
import { createAsaasPixProvider, ProductionSystem } from "./production-system.ts";
import { SqliteStateStore } from "./sqlite-store.ts";

function requiredEnv(name, fallback) {
  const value = process.env[name] || fallback;
  if (!value) throw new Error(`${name} obrigatorio para iniciar a aplicacao.`);
  return value;
}

// Repo root resolution: prefer explicit env (set by deployment), else
// process.cwd() (server.mjs and `next start` both run from repo root).
// Avoid `new URL(".", import.meta.url)` because Turbopack cannot
// statically analyze it when this module is imported from a Route Handler.
const repoRoot = process.env.AV_REPO_ROOT || process.cwd();

const GLOBAL_KEY = "__avSystemInstance";

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
  const g = globalThis;
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = build();
  return g[GLOBAL_KEY];
}
