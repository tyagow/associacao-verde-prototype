// GET /api/session — return the current session descriptor.
//
// Reads from the shared singleton (Stage 1 globalThis cache) so the
// session map matches server.mjs's view exactly.

import { getSystem } from "../../../src/system-instance.ts";
import { readSessionCookie, jsonResponse, errorResponse } from "../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export function GET(request) {
  try {
    const { system } = getSystem();
    system.expireReservations();
    const sessionId = readSessionCookie(request.headers.get("cookie"));
    return jsonResponse(200, { session: system.getSession(sessionId) });
  } catch (error) {
    return errorResponse(error);
  }
}
