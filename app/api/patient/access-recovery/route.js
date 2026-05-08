// POST /api/patient/access-recovery — patient requests an access ticket.

import { getSystem } from "../../../../src/system-instance.ts";
import {
  readJsonBody,
  jsonResponse,
  errorResponse,
  ipFromRequest,
  assertRateLimit,
  recordRateLimitHit,
} from "../../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const ip = ipFromRequest(request);
    const rateKey = `access-recovery:${ip}`;
    assertRateLimit(rateKey, 5, 30 * 60_000);
    recordRateLimitHit(rateKey);
    const { system } = getSystem();
    const payload = await readJsonBody(request);
    return jsonResponse(201, { ticket: system.createAccessRecoveryRequest(payload) });
  } catch (error) {
    return errorResponse(error);
  }
}
