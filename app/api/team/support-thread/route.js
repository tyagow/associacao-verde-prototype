// GET /api/team/support-thread?ticketId=<id>
//
// Returns the full chronological conversation for a support ticket. Calls
// system.listSupportThread directly via the shared singleton (the
// proxy-via-fetch indirection is no longer needed after Stage 1).

import { getSystem } from "../../../../src/system-instance.ts";
import { readSessionCookie, jsonResponse, errorResponse } from "../../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export function GET(request) {
  try {
    const url = new URL(request.url);
    const ticketId = url.searchParams.get("ticketId") || "";
    if (!ticketId) {
      return jsonResponse(400, { error: "ticketId e obrigatorio." });
    }
    const { system } = getSystem();
    const sessionId = readSessionCookie(request.headers.get("cookie"));
    return jsonResponse(200, system.listSupportThread(sessionId, ticketId));
  } catch (error) {
    return errorResponse(error);
  }
}
