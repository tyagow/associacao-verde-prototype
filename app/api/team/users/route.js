// POST /api/team/users — admin creates a team user.

import { teamWrite } from "../../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export const POST = teamWrite(
  (system, sessionId, payload) => system.createTeamUser(sessionId, payload),
  { status: 201, wrap: (user) => ({ user }) },
);
