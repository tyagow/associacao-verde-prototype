// POST /api/patient/login — patient sign-in.
//
//   1. Throttle login attempts by (ip, memberCode).
//   2. Call system.loginPatient — returns { sessionId, patient } on success.
//   3. On success: clear the throttle bucket and emit signed av_session cookie.
//   4. On failure: record the failure (5 strikes → 15 min lockout).

import { getSystem } from "../../../../src/system-instance.ts";
import {
  readJsonBody,
  jsonResponse,
  errorResponse,
  sessionCookieHeader,
  loginAttemptKey,
  assertLoginAllowed,
  recordLoginFailure,
  clearLoginAttempts,
} from "../../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { system } = getSystem();
    const payload = await readJsonBody(request);
    const key = loginAttemptKey(request, "patient", payload.memberCode);
    assertLoginAllowed(key);
    let result;
    try {
      result = system.loginPatient(payload);
      clearLoginAttempts(key);
    } catch (error) {
      recordLoginFailure(key);
      throw error;
    }
    return jsonResponse(
      200,
      { patient: result.patient },
      { "Set-Cookie": sessionCookieHeader(result.sessionId) },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
