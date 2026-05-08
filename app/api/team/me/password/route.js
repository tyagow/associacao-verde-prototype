// POST /api/team/me/password — team member changes own password.

import { getSystem } from "../../../../../src/system-instance.ts";
import {
  readJsonBody,
  readSessionCookie,
  jsonResponse,
  errorResponse,
} from "../../../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { system } = getSystem();
    const sessionId = readSessionCookie(request.headers.get("cookie"));
    const payload = await readJsonBody(request);
    return jsonResponse(200, { user: system.changeOwnTeamPassword(sessionId, payload) });
  } catch (error) {
    return errorResponse(error);
  }
}
