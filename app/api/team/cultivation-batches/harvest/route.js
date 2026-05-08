// POST /api/team/cultivation-batches/harvest

import { teamWrite } from "../../../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export const POST = teamWrite(
  (system, sessionId, payload) => system.recordHarvest(sessionId, payload),
  { wrap: (batch) => ({ batch }) },
);
