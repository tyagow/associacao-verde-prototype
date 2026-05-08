// POST /api/checkout — create a Pix checkout from cart items.
//
// system.createCheckout runs the inventory reservation under a
// `BEGIN IMMEDIATE` transaction in SqliteStateStore (Phase 2 race
// coverage). Because Stage 1 collapsed the singleton on globalThis,
// this Route Handler reaches the SAME store instance server.mjs uses;
// no second SqliteStateStore is constructed.

import { getSystem } from "../../../src/system-instance.ts";
import {
  readJsonBody,
  readSessionCookie,
  jsonResponse,
  errorResponse,
} from "../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { system } = getSystem();
    const sessionId = readSessionCookie(request.headers.get("cookie"));
    const payload = await readJsonBody(request);
    const checkout = await system.createCheckout(sessionId, payload);
    return jsonResponse(201, checkout);
  } catch (error) {
    return errorResponse(error);
  }
}
