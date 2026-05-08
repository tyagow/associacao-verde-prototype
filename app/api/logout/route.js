// POST /api/logout — drop the current session and clear the cookie.

import { getSystem } from "../../../src/system-instance.ts";
import {
  readSessionCookie,
  clearSessionCookieHeader,
  jsonResponse,
  errorResponse,
} from "../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export function POST(request) {
  try {
    const { system } = getSystem();
    const sessionId = readSessionCookie(request.headers.get("cookie"));
    system.logout(sessionId);
    return jsonResponse(200, { ok: true }, { "Set-Cookie": clearSessionCookieHeader() });
  } catch (error) {
    return errorResponse(error);
  }
}
