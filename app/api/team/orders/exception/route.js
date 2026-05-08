// POST /api/team/orders/exception — record a fulfillment exception.

import { teamWrite } from "../../../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export const POST = teamWrite(
  (system, sessionId, payload) => system.recordOrderException(sessionId, payload),
  { wrap: (order) => ({ order }) },
);
