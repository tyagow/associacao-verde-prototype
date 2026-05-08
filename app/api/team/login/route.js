// POST /api/team/login — team sign-in.

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
    const key = loginAttemptKey(request, "team", payload.email);
    assertLoginAllowed(key);
    let result;
    try {
      result = system.loginTeam(payload);
      clearLoginAttempts(key);
    } catch (error) {
      recordLoginFailure(key);
      throw error;
    }
    return jsonResponse(200, { ok: true }, { "Set-Cookie": sessionCookieHeader(result.sessionId) });
  } catch (error) {
    return errorResponse(error);
  }
}
