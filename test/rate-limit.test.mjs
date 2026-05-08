import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertRateLimit,
  recordRateLimitHit,
  ipFromRequest,
} from "../src/route-helpers.ts";

function resetBucket() {
  globalThis.__avRateLimits = new Map();
}

test("assertRateLimit: under threshold passes", () => {
  resetBucket();
  for (let i = 0; i < 5; i += 1) {
    recordRateLimitHit("checkout:1.2.3.4");
    assertRateLimit("checkout:1.2.3.4", 10, 60_000);
  }
});

test("assertRateLimit: over threshold throws 429", () => {
  resetBucket();
  for (let i = 0; i < 10; i += 1) recordRateLimitHit("checkout:1.2.3.4");
  assert.throws(
    () => assertRateLimit("checkout:1.2.3.4", 10, 60_000),
    (err) => err.status === 429,
  );
});

test("assertRateLimit: window expiry resets", () => {
  resetBucket();
  for (let i = 0; i < 10; i += 1) recordRateLimitHit("checkout:1.2.3.4");
  const map = globalThis.__avRateLimits;
  const entry = map.get("checkout:1.2.3.4");
  entry.firstAt = Date.now() - 70_000;
  recordRateLimitHit("checkout:1.2.3.4");
  assertRateLimit("checkout:1.2.3.4", 10, 60_000);
});

test("ipFromRequest: takes first x-forwarded-for hop", () => {
  const req = {
    headers: { get: (name) => (name === "x-forwarded-for" ? "1.2.3.4, 5.6.7.8" : null) },
  };
  assert.equal(ipFromRequest(req), "1.2.3.4");
});

test("ipFromRequest: falls back to 'local' when no XFF", () => {
  const req = { headers: { get: () => null } };
  assert.equal(ipFromRequest(req), "local");
});
