// POST /api/team/cultivation-batches/advance

import { teamWrite } from "../../../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export const POST = teamWrite(
  (system, sessionId, payload) => system.advanceCultivationBatch(sessionId, payload),
  { wrap: (batch) => ({ batch }) },
);
