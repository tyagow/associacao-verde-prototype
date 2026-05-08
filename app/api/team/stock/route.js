// POST /api/team/stock — record a manual stock addition.

import { teamWrite } from "../../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export const POST = teamWrite((system, sessionId, payload) => system.addStock(sessionId, payload), {
  wrap: (product) => ({ product }),
});
