// POST /api/login — unified sign-in for patient and team users.

import { getSystem } from "../../../src/system-instance.ts";
import {
  readJsonBody,
  jsonResponse,
  errorResponse,
  sessionCookieHeader,
  loginAttemptKey,
  assertLoginAllowed,
  recordLoginFailure,
  clearLoginAttempts,
  ipFromRequest,
  assertRateLimit,
  recordRateLimitHit,
} from "../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const ip = ipFromRequest(request);
    const rateKey = `unified-login:${ip}`;
    assertRateLimit(rateKey, 30, 30 * 60_000);
    recordRateLimitHit(rateKey);

    const { system } = getSystem();
    const payload = await readJsonBody(request);
    const identifier = String(payload.identifier || payload.memberCode || "").trim();
    const password = String(payload.password || "").trim();
    const key = loginAttemptKey(request, "unified", identifier);
    assertLoginAllowed(key);

    const result = tryUnifiedLogin(system, identifier, password);
    if (!result) {
      recordLoginFailure(key);
      const error = new Error("Credenciais invalidas.");
      error.status = 401;
      throw error;
    }

    clearLoginAttempts(key);
    return jsonResponse(
      200,
      { session: result.session, destination: destinationForSession(result.session) },
      { "Set-Cookie": sessionCookieHeader(result.sessionId) },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

function tryUnifiedLogin(system, identifier, password) {
  if (!identifier || !password) return null;
  const attempts = identifier.includes("@")
    ? [tryTeamLogin, tryPatientLogin]
    : [tryPatientLogin, tryTeamLogin];

  for (const attempt of attempts) {
    const result = attempt(system, identifier, password);
    if (result) return result;
  }
  return null;
}

function tryPatientLogin(system, identifier, password) {
  try {
    const result = system.loginPatient({ memberCode: identifier, inviteCode: password });
    return { sessionId: result.sessionId, session: system.getSession(result.sessionId) };
  } catch {
    return null;
  }
}

function tryTeamLogin(system, identifier, password) {
  try {
    const result = system.loginTeam({ email: identifier, password });
    return { sessionId: result.sessionId, session: system.getSession(result.sessionId) };
  } catch {
    return null;
  }
}

function destinationForSession(session) {
  if (session?.role === "patient") return "/paciente";
  if (session?.role === "team" && session.user?.role === "admin") return "/admin";
  if (session?.role === "team") return "/equipe";
  return "/";
}
