// POST /api/team/cultivation-batches/stock — moveBatchToStock returns its
// own envelope so we don't wrap it.

import { teamWrite } from "../../../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export const POST = teamWrite((system, sessionId, payload) =>
  system.moveBatchToStock(sessionId, payload),
);
