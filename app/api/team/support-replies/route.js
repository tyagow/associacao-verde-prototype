// POST /api/team/support-replies — team posts a reply on a support ticket.
//
// Validates body shape and calls system.createSupportReply directly via
// the shared singleton (the proxy-via-fetch dance is no longer needed
// after Stage 1 collapsed the system on globalThis).

import { getSystem } from "../../../../src/system-instance.ts";
import { readSessionCookie, jsonResponse, errorResponse } from "../../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse(400, { error: "Corpo da requisicao invalido." });
    }
    const ticketId = String(payload?.ticketId || "").trim();
    const body = String(payload?.body || "").trim();
    if (!ticketId || !body) {
      return jsonResponse(400, { error: "Atendimento e mensagem sao obrigatorios." });
    }
    const { system } = getSystem();
    const sessionId = readSessionCookie(request.headers.get("cookie"));
    const message = system.createSupportReply(sessionId, { ticketId, body });
    return jsonResponse(201, { message });
  } catch (error) {
    return errorResponse(error);
  }
}
