// POST /api/team/orders/status — fulfillment kanban drag.
//
// Validates the body and forwards to system.updateOrderFulfillmentStatus
// directly (Stage 2 collapsed the singleton, so we no longer need to
// proxy via /api/team/orders/status-apply).

import { getSystem } from "../../../../../src/system-instance.ts";
import {
  readSessionCookie,
  jsonResponse,
  errorResponse,
} from "../../../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = new Set([
  "paid_pending_fulfillment",
  "separating",
  "ready_to_ship",
  "sent",
]);

export async function POST(request) {
  try {
    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse(400, { error: "Corpo da requisicao invalido." });
    }
    const orderId = String(payload?.orderId || "").trim();
    const status = String(payload?.status || "").trim();
    if (!orderId) return jsonResponse(400, { error: "orderId obrigatorio." });
    if (!ALLOWED_STATUSES.has(status)) {
      return jsonResponse(400, { error: "Status de fulfillment invalido." });
    }

    const { system } = getSystem();
    const sessionId = readSessionCookie(request.headers.get("cookie"));
    const order = system.updateOrderFulfillmentStatus(sessionId, { orderId, status });
    return jsonResponse(200, { order });
  } catch (error) {
    return errorResponse(error);
  }
}
