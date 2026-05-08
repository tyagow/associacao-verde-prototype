// @ts-nocheck
// Shared helpers for Next.js Route Handlers:
//   - readSessionCookie: parse `Cookie:` header, find `av_session=`, verify HMAC
//   - signSessionCookie: produce HMAC-signed cookie value
//   - sessionCookieHeader: build a Set-Cookie line for av_session
//   - jsonResponse: build a same-shape JSON response with no-store cache
//   - errorResponse: convert thrown { status, message } / Error into JSON

import { createHmac, timingSafeEqual } from "node:crypto";
import { getSystem } from "./system-instance.ts";

function getSessionSecret() {
  return getSystem().sessionSecret;
}

export function isProduction() {
  return getSystem().production === true;
}

export function signSessionCookie(value) {
  const signature = createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
  return `${value}.${signature}`;
}

export function verifySessionCookie(signed) {
  const [value, signature] = String(signed || "").split(".");
  if (!value || !signature) return "";
  const expected = createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return "";
  return timingSafeEqual(actualBuffer, expectedBuffer) ? value : "";
}

export function readSessionCookie(cookieHeader) {
  const header = String(cookieHeader || "");
  const match = header
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("av_session="));
  if (!match) return "";
  return verifySessionCookie(decodeURIComponent(match.slice("av_session=".length)));
}

export function sessionCookieHeader(sessionId, { maxAge = 12 * 60 * 60 } = {}) {
  const value = sessionId ? signSessionCookie(sessionId) : "";
  const secure = isProduction() ? "; Secure" : "";
  return `av_session=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearSessionCookieHeader() {
  const secure = isProduction() ? "; Secure" : "";
  return `av_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export function jsonResponse(status, payload, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

export function errorResponse(error) {
  const status = Number(error?.status) || 500;
  const message = error?.message || "Erro interno.";
  return jsonResponse(status, { error: message });
}

export async function readJsonBody(request) {
  const text = await request.text();
  if (!text) return {};
  if (text.length > 7_000_000) {
    const err = new Error("Corpo da requisicao excede o limite.");
    err.status = 413;
    throw err;
  }
  try {
    return JSON.parse(text);
  } catch {
    const err = new Error("Corpo da requisicao invalido.");
    err.status = 400;
    throw err;
  }
}

// Login-throttling — in-memory loginAttempts map cached on globalThis so
// every Route Handler module graph shares the same lockout state.
const LOGIN_KEY = "__avLoginAttempts";
function attempts() {
  const g = globalThis;
  if (!g[LOGIN_KEY]) g[LOGIN_KEY] = new Map();
  return g[LOGIN_KEY];
}

export function loginAttemptKey(request, scope, identifier) {
  const xff = request.headers.get?.("x-forwarded-for") || request.headers["x-forwarded-for"] || "";
  const ip = String(xff).split(",")[0].trim() || "local";
  return `${scope}:${ip}:${String(identifier || "")
    .trim()
    .toLowerCase()}`;
}

export function assertLoginAllowed(key) {
  const map = attempts();
  const attempt = map.get(key);
  if (!attempt) return;
  if (attempt.lockedUntil && attempt.lockedUntil > Date.now()) {
    const err = new Error("Muitas tentativas de login. Aguarde antes de tentar novamente.");
    err.status = 429;
    throw err;
  }
  if (attempt.lockedUntil && attempt.lockedUntil <= Date.now()) map.delete(key);
}

export function recordLoginFailure(key) {
  const map = attempts();
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const lockMs = 15 * 60 * 1000;
  const current = map.get(key);
  const attempt =
    current && current.firstAt + windowMs > now
      ? current
      : { count: 0, firstAt: now, lockedUntil: 0 };
  attempt.count += 1;
  if (attempt.count >= 5) attempt.lockedUntil = now + lockMs;
  map.set(key, attempt);
}

export function clearLoginAttempts(key) {
  attempts().delete(key);
}

// Generic per-IP rate-limit, separate from login-throttle.
// Used by checkout, support-requests, access-recovery, webhook, patient-login.
const RATE_KEY = "__avRateLimits";
function rateBucket() {
  const g = globalThis;
  if (!g[RATE_KEY]) g[RATE_KEY] = new Map();
  return g[RATE_KEY];
}

export function ipFromRequest(request) {
  const xff =
    request.headers?.get?.("x-forwarded-for") || request.headers?.["x-forwarded-for"] || "";
  return String(xff).split(",")[0].trim() || "local";
}

export function recordRateLimitHit(key) {
  const map = rateBucket();
  const now = Date.now();
  const current = map.get(key);
  if (!current) {
    map.set(key, { count: 1, firstAt: now });
    return;
  }
  current.count += 1;
  map.set(key, current);
}

export function assertRateLimit(key, max, windowMs) {
  const map = rateBucket();
  const now = Date.now();
  const current = map.get(key);
  if (!current) return;
  if (current.firstAt + windowMs <= now) {
    map.delete(key);
    return;
  }
  if (current.count >= max) {
    const err = new Error("Muitas requisicoes. Aguarde antes de tentar novamente.");
    err.status = 429;
    throw err;
  }
}

// Common shape: read session cookie + JSON body, call system.METHOD,
// return jsonResponse(status, wrap(result)). Use in Route Handlers
// that follow the legacy switch's "team write" pattern.
export function teamWrite(systemMethod, { status = 200, wrap = (r) => r } = {}) {
  return async function POST(request) {
    try {
      const { system } = getSystem();
      const sessionId = readSessionCookie(request.headers.get("cookie"));
      const payload = await readJsonBody(request);
      return jsonResponse(status, wrap(systemMethod(system, sessionId, payload)));
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export function teamRead(systemMethod, { wrap = (r) => r } = {}) {
  return async function GET(request) {
    try {
      const { system } = getSystem();
      const sessionId = readSessionCookie(request.headers.get("cookie"));
      return jsonResponse(200, wrap(systemMethod(system, sessionId, request)));
    } catch (error) {
      return errorResponse(error);
    }
  };
}
