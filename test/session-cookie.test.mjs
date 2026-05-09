import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

// Targeted coverage for the session-cookie primitives in src/route-helpers.ts.
// These functions are the authentication boundary (HMAC sign/verify) and the
// production-vs-dev cookie name selector — no other test exercises them
// directly. Without these assertions, a regression that accepts tampered
// signatures or returns the wrong cookie name in production would only be
// caught if a lucky integration path happened to construct the bad input.

function envSetup({ requireLiveProvider } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "av-session-cookie-"));
  const previous = {
    DB_FILE: process.env.DB_FILE,
    DOCUMENT_STORAGE_DIR: process.env.DOCUMENT_STORAGE_DIR,
    TEAM_PASSWORD: process.env.TEAM_PASSWORD,
    PIX_WEBHOOK_SECRET: process.env.PIX_WEBHOOK_SECRET,
    SESSION_SECRET: process.env.SESSION_SECRET,
    AV_REQUIRE_LIVE_PROVIDER: process.env.AV_REQUIRE_LIVE_PROVIDER,
    PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER,
    ASAAS_API_KEY: process.env.ASAAS_API_KEY,
    ASAAS_CUSTOMER_ID: process.env.ASAAS_CUSTOMER_ID,
    AV_REPO_ROOT: process.env.AV_REPO_ROOT,
  };
  process.env.DB_FILE = join(dir, "session-cookie.sqlite");
  process.env.DOCUMENT_STORAGE_DIR = join(dir, "private-documents");
  process.env.TEAM_PASSWORD = "session-cookie-test";
  process.env.PIX_WEBHOOK_SECRET = "session-cookie-test";
  process.env.SESSION_SECRET = "session-cookie-test-secret";
  process.env.AV_REPO_ROOT = process.cwd();
  if (requireLiveProvider) {
    process.env.AV_REQUIRE_LIVE_PROVIDER = "true";
    process.env.PAYMENT_PROVIDER = "asaas";
    process.env.ASAAS_API_KEY = "fake-key";
    process.env.ASAAS_CUSTOMER_ID = "fake-customer";
  } else {
    delete process.env.AV_REQUIRE_LIVE_PROVIDER;
  }
  delete globalThis.__avSystemInstance;
  return {
    teardown() {
      const cached = globalThis.__avSystemInstance;
      if (cached?.reservationExpiryTimer) clearInterval(cached.reservationExpiryTimer);
      delete globalThis.__avSystemInstance;
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

test("signSessionCookie + verifySessionCookie roundtrip preserves the value", async () => {
  const env = envSetup();
  try {
    const { signSessionCookie, verifySessionCookie } =
      await import("../src/route-helpers.ts?realm=roundtrip");
    const signed = signSessionCookie("session-id-abc");
    assert.match(signed, /^session-id-abc\.[A-Za-z0-9_-]+$/);
    assert.equal(verifySessionCookie(signed), "session-id-abc");
  } finally {
    env.teardown();
  }
});

test("verifySessionCookie rejects tampered signatures", async () => {
  const env = envSetup();
  try {
    const { signSessionCookie, verifySessionCookie } =
      await import("../src/route-helpers.ts?realm=tampered");
    const signed = signSessionCookie("session-id-abc");
    const [value, sig] = signed.split(".");
    // Flip a character in the signature — must NOT verify.
    const flipped = sig[0] === "A" ? "B" + sig.slice(1) : "A" + sig.slice(1);
    assert.equal(verifySessionCookie(`${value}.${flipped}`), "");
    // Empty / malformed inputs must NOT verify.
    assert.equal(verifySessionCookie(""), "");
    assert.equal(verifySessionCookie("no-dot"), "");
    assert.equal(verifySessionCookie("session-id-abc."), "");
  } finally {
    env.teardown();
  }
});

test("readSessionCookie extracts the dev cookie name when not in production", async () => {
  const env = envSetup({ requireLiveProvider: false });
  try {
    const { signSessionCookie, readSessionCookie, sessionCookieName } =
      await import("../src/route-helpers.ts?realm=dev-name");
    assert.equal(sessionCookieName(), "av_session");
    const signed = signSessionCookie("dev-session-id");
    const header = `_ga=GA1.2.123; av_session=${encodeURIComponent(signed)}; foo=bar`;
    assert.equal(readSessionCookie(header), "dev-session-id");
  } finally {
    env.teardown();
  }
});

test("readSessionCookie extracts the __Host- cookie name in production", async () => {
  const env = envSetup({ requireLiveProvider: true });
  try {
    const { signSessionCookie, readSessionCookie, sessionCookieName } =
      await import("../src/route-helpers.ts?realm=prod-name");
    assert.equal(sessionCookieName(), "__Host-av_session");
    const signed = signSessionCookie("prod-session-id");
    const header = `__Host-av_session=${encodeURIComponent(signed)}`;
    assert.equal(readSessionCookie(header), "prod-session-id");
    // Plain `av_session` cookie is ignored in production (drift signal: if
    // someone set the dev name in a prod browser, it must not authenticate).
    const wrongHeader = `av_session=${encodeURIComponent(signed)}`;
    assert.equal(readSessionCookie(wrongHeader), "");
  } finally {
    env.teardown();
  }
});

test("sessionCookieHeader emits Secure + __Host- prefix only in production", async () => {
  // Dev path: no Secure attribute, plain av_session name.
  const dev = envSetup({ requireLiveProvider: false });
  try {
    const { sessionCookieHeader } = await import("../src/route-helpers.ts?realm=dev-set");
    const header = sessionCookieHeader("sid-1");
    assert.match(header, /^av_session=/);
    assert.match(header, /Path=\//);
    assert.match(header, /HttpOnly/);
    assert.match(header, /SameSite=Lax/);
    assert.doesNotMatch(header, /Secure/);
  } finally {
    dev.teardown();
  }

  // Prod path: Secure required + __Host- prefix.
  const prod = envSetup({ requireLiveProvider: true });
  try {
    const { sessionCookieHeader } = await import("../src/route-helpers.ts?realm=prod-set");
    const header = sessionCookieHeader("sid-1");
    assert.match(header, /^__Host-av_session=/);
    assert.match(header, /Path=\//);
    assert.match(header, /HttpOnly/);
    assert.match(header, /SameSite=Lax/);
    assert.match(header, /Secure/);
  } finally {
    prod.teardown();
  }
});
