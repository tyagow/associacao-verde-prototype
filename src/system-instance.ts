// @ts-nocheck
// Shared domain singleton for the Next.js process.
//
// Next.js Route Handlers, pages, and tsx-loaded scripts (e.g. readiness
// probes) can each trigger a different module graph for this file. A
// module-local `cached` would therefore yield multiple ProductionSystem
// + SqliteStateStore instances on the same DB file, racing on writes.
//
// Solution: cache the built system on `globalThis` (the same object
// across every module graph in the same Node process). Every consumer
// sees the same instance — the SqliteStateStore + reservation-expiry
// timer + team-user seeding run exactly once, and every getSystem()
// call returns the same handle.

import { join } from "node:path";
import { createAsaasPixProvider, ProductionSystem } from "./production-system.ts";
import { SqliteStateStore } from "./sqlite-store.ts";

function requiredEnv(name, fallback) {
  const value = process.env[name] || fallback;
  if (!value) throw new Error(`${name} obrigatorio para iniciar a aplicacao.`);
  return value;
}

// Repo root resolution: prefer explicit env (set by deployment), else
// process.cwd() (`next start` and tsx-run scripts both launch from repo root).
// Avoid `new URL(".", import.meta.url)` because Turbopack cannot
// statically analyze it when this module is imported from a Route Handler.
const repoRoot = process.env.AV_REPO_ROOT || process.cwd();

const GLOBAL_KEY = "__avSystemInstance";

function build() {
  // `next start` forces NODE_ENV=production inside its workers regardless
  // of what we pass. We must NOT gate the live-provider requirement on
  // NODE_ENV — it would block every E2E / dev `next start` invocation.
  // Instead an explicit flag (set in real production deploys: docker, k8s,
  // vercel) controls fail-closed mode.
  const production = process.env.AV_REQUIRE_LIVE_PROVIDER === "true";
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
