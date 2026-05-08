// GET /api/my-orders — orders for the current patient session.

import { getSystem } from "../../../src/system-instance.ts";
import { readSessionCookie, jsonResponse, errorResponse } from "../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export function GET(request) {
  try {
    const { system } = getSystem();
    const sessionId = readSessionCookie(request.headers.get("cookie"));
    return jsonResponse(200, { orders: system.listMyOrders(sessionId) });
  } catch (error) {
    return errorResponse(error);
  }
}
