// /health — public liveness probe.
//
// Reads from the shared singleton (getSystem) so the `production`,
// `database`, and `paymentProvider` fields reflect the process-wide
// boot-time configuration. The system is cached on globalThis so this
// Route Handler does not construct a second SqliteStateStore — every
// module graph shares one instance.
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
