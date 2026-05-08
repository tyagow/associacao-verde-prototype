// POST /api/team/member-cards — issueMemberCard returns its own envelope.

import { teamWrite } from "../../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export const POST = teamWrite(
  (system, sessionId, payload) => system.issueMemberCard(sessionId, payload),
  { status: 201 },
);
