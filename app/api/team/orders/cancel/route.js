// POST /api/team/orders/cancel — cancel an unpaid order.

import { teamWrite } from "../../../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export const POST = teamWrite(
  (system, sessionId, payload) => system.cancelOrder(sessionId, payload),
  { wrap: (order) => ({ order }) },
);
