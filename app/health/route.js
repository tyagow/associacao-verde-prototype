// Stage C of server.mjs → Next.js migration: /health.
//
// Public liveness probe. Mirrors the response shape from the legacy
// server.mjs switch:
//   { ok: true, database: <dbFile>, paymentProvider: <name>, production }
//
// Reads process.env directly (no system instantiation) because:
//
//  (a) /health must never throw during startup. Calling getSystem() from
//      this Route Handler runs build() in Next's bundled module graph —
//      a SECOND ProductionSystem + SqliteStateStore instance, distinct
//      from the one server.mjs constructed at process boot. Both would
//      open the same SQLite file, racing on writes. Rule 3 from the
//      migration plan forbids this.
//
//  (b) /health is pure config readout — it doesn't need system state.
//
// Path: this lives at app/health/route.js (NOT app/api/health) because
// the public URL is /health, matching every existing
// scripts/*-check.mjs caller.

import { join } from "node:path";

export const dynamic = "force-dynamic";

export function GET() {
  const repoRoot = process.env.AV_REPO_ROOT || process.cwd();
  const dbFile = process.env.DB_FILE || join(repoRoot, "data", "associacao-verde.sqlite");
  const provider = process.env.PAYMENT_PROVIDER === "asaas" ? "asaas" : "dev-pix";
  const production = process.env.NODE_ENV === "production";
  return Response.json(
    {
      ok: true,
      database: dbFile,
      paymentProvider: provider,
      production,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
