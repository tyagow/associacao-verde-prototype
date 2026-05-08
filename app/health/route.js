// /health — public liveness probe.
//
// Reads from the shared singleton (getSystem) so the `production`,
// `database`, and `paymentProvider` fields reflect the SAME boot-time
// configuration that server.mjs sees. Stage 1 of the migration cached
// the system on globalThis so this Route Handler does not construct a
// second SqliteStateStore — both module graphs share one instance.
//
// Path lives at app/health/route.js (NOT app/api/health) so the public
// URL stays /health, matching every existing scripts/*-check.mjs caller.

import { getSystem } from "../../src/system-instance.ts";

export const dynamic = "force-dynamic";

export function GET() {
  const { dbFile, paymentProvider, production } = getSystem();
  return Response.json(
    {
      ok: true,
      database: dbFile,
      paymentProvider: paymentProvider?.name || "dev-pix",
      production,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
