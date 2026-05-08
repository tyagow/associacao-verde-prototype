// GET /api/team/readiness — full readiness report.

import { getSystem } from "../../../../src/system-instance.ts";
import { readSessionCookie, jsonResponse, errorResponse } from "../../../../src/route-helpers.ts";
import { readinessReport } from "../../../../src/readiness.ts";

export const dynamic = "force-dynamic";

export function GET(request) {
  try {
    const { system } = getSystem();
    const sessionId = readSessionCookie(request.headers.get("cookie"));
    system.requireTeam(sessionId, "dashboard:view");
    return jsonResponse(200, readinessReport());
  } catch (error) {
    return errorResponse(error);
  }
}
