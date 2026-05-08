// @ts-nocheck
// Shared helpers for Next.js Route Handlers + server.mjs:
//   - readSessionCookie: parse `Cookie:` header, find `av_session=`, verify HMAC
//   - signSessionCookie: produce HMAC-signed cookie value
//   - sessionCookieHeader: build a Set-Cookie line for av_session
//   - jsonResponse: build a same-shape JSON response with no-store cache
//   - errorResponse: convert thrown { status, message } / Error into JSON
//
// These mirror server.mjs's helpers byte-for-byte so a Route Handler that
// uses them is indistinguishable on the wire from a legacy switch handler.

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

// Login-throttling — mirrors server.mjs's in-memory loginAttempts map. Cached
// on globalThis so server.mjs and Route Handlers share one map (otherwise
// brute-force lockout could be bypassed by alternating between the two
// surfaces during the migration).
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
