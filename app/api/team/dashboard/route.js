// GET /api/team/dashboard — full dashboard payload for team operators.

import { teamRead } from "../../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export const GET = teamRead((system, sessionId) => system.dashboard(sessionId));
