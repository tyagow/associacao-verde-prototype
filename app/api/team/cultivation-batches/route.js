// POST /api/team/cultivation-batches — create a cultivation batch.

import { teamWrite } from "../../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export const POST = teamWrite(
  (system, sessionId, payload) => system.createCultivationBatch(sessionId, payload),
  { status: 201, wrap: (batch) => ({ batch }) },
);
