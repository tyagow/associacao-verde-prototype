// GET /api/session — return the current session descriptor.
//
// Reads from the shared singleton (globalThis-cached) so the session map
// is consistent across every Route Handler module graph.

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
