// POST /api/team/fulfillment — legacy fulfillment status update.

import { teamWrite } from "../../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export const POST = teamWrite(
  (system, sessionId, payload) => system.updateFulfillmentStatus(sessionId, payload),
  { wrap: (order) => ({ order }) },
);
