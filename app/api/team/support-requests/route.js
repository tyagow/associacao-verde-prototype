// POST /api/team/support-requests — team updates a support ticket.

import { teamWrite } from "../../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export const POST = teamWrite(
  (system, sessionId, payload) => system.updateSupportRequest(sessionId, payload),
  { wrap: (ticket) => ({ ticket }) },
);
