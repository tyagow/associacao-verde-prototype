// POST /api/support-requests — patient opens a support ticket.

import { getSystem } from "../../../src/system-instance.ts";
import {
  readJsonBody,
  readSessionCookie,
  jsonResponse,
  errorResponse,
  ipFromRequest,
  assertRateLimit,
  recordRateLimitHit,
} from "../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const ip = ipFromRequest(request);
    const rateKey = `support:${ip}`;
    assertRateLimit(rateKey, 10, 10 * 60_000);
    recordRateLimitHit(rateKey);
    const { system } = getSystem();
    const sessionId = readSessionCookie(request.headers.get("cookie"));
    const payload = await readJsonBody(request);
    return jsonResponse(201, { ticket: system.createSupportRequest(sessionId, payload) });
  } catch (error) {
    return errorResponse(error);
  }
}
