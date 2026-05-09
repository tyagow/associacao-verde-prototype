// PATCH /api/patient/profile — patient self-service profile update.
//
// Today only `shippingAddress` is patient-editable. The session must belong
// to a patient and LGPD consent must be on file (enforced inside
// system.updatePatientProfile). The system singleton lives on globalThis,
// so this Route Handler shares one SqliteStateStore with every other consumer.

import { getSystem } from "../../../../src/system-instance.ts";
import {
  readJsonBody,
  readSessionCookie,
  jsonResponse,
  errorResponse,
  ipFromRequest,
  assertRateLimit,
  recordRateLimitHit,
} from "../../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export async function PATCH(request) {
  try {
    const ip = ipFromRequest(request);
    const rateKey = `patient-profile:${ip}`;
    assertRateLimit(rateKey, 30, 10 * 60_000);
    recordRateLimitHit(rateKey);
    const { system } = getSystem();
    const sessionId = readSessionCookie(request.headers.get("cookie"));
    const payload = await readJsonBody(request);
    const patient = system.updatePatientProfile(sessionId, payload);
    return jsonResponse(200, { patient });
  } catch (error) {
    return errorResponse(error);
  }
}
