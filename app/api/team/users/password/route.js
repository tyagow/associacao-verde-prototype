// POST /api/team/users/password — admin resets a team user's password.

import { teamWrite } from "../../../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export const POST = teamWrite(
  (system, sessionId, payload) => system.resetTeamUserPassword(sessionId, payload),
  { wrap: (user) => ({ user }) },
);
