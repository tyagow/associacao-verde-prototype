// GET /api/catalog — visible products for the current session.

import { getSystem } from "../../../src/system-instance.ts";
import { readSessionCookie, jsonResponse, errorResponse } from "../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export function GET(request) {
  try {
    const { system } = getSystem();
    const sessionId = readSessionCookie(request.headers.get("cookie"));
    return jsonResponse(200, { products: system.listCatalog(sessionId) });
  } catch (error) {
    return errorResponse(error);
  }
}
