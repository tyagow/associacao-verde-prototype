// POST /api/team/cultivation-batches/dry

import { teamWrite } from "../../../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export const POST = teamWrite(
  (system, sessionId, payload) => system.recordDryWeight(sessionId, payload),
  { wrap: (batch) => ({ batch }) },
);
