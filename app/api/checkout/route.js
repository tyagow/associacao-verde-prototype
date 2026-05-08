// POST /api/checkout — create a Pix checkout from cart items.
//
// system.createCheckout runs the inventory reservation under a
// `BEGIN IMMEDIATE` transaction in SqliteStateStore (Phase 2 race
// coverage). The system singleton lives on globalThis, so this Route
// Handler shares one SqliteStateStore with every other consumer.

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
    const rateKey = `checkout:${ip}`;
    assertRateLimit(rateKey, 30, 10 * 60_000);
    recordRateLimitHit(rateKey);
    const { system } = getSystem();
    const sessionId = readSessionCookie(request.headers.get("cookie"));
    const payload = await readJsonBody(request);
    const checkout = await system.createCheckout(sessionId, payload);
    return jsonResponse(201, checkout);
  } catch (error) {
    return errorResponse(error);
  }
}
