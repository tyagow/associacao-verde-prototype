// POST /api/team/users/status — admin enables/disables a team user.

import { teamWrite } from "../../../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export const POST = teamWrite(
  (system, sessionId, payload) => system.updateTeamUserStatus(sessionId, payload),
  { wrap: (user) => ({ user }) },
);
