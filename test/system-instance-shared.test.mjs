import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

// Stage 1 — verify getSystem() returns the SAME instance even when imported
// through cache-busting query strings (which Node treats as distinct module
// specifiers, simulating the situation where server.mjs's module graph and
// Next.js's bundled module graph each load src/system-instance.ts).
//
// Without globalThis caching, two import realms would each call build() and
// produce two SqliteStateStore + ProductionSystem instances on the same DB
// file. The test asserts that the cached object is identical across realms.

test("getSystem() shares one instance across distinct module-cache realms", async () => {
  const dir = mkdtempSync(join(tmpdir(), "av-shared-singleton-"));
  const previousEnv = {
    DB_FILE: process.env.DB_FILE,
    DOCUMENT_STORAGE_DIR: process.env.DOCUMENT_STORAGE_DIR,
    TEAM_PASSWORD: process.env.TEAM_PASSWORD,
    PIX_WEBHOOK_SECRET: process.env.PIX_WEBHOOK_SECRET,
    SESSION_SECRET: process.env.SESSION_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    AV_REPO_ROOT: process.env.AV_REPO_ROOT,
  };
  process.env.DB_FILE = join(dir, "shared.sqlite");
  process.env.DOCUMENT_STORAGE_DIR = join(dir, "private-documents");
  process.env.TEAM_PASSWORD = "shared-singleton-test";
  process.env.PIX_WEBHOOK_SECRET = "shared-singleton-test";
  process.env.SESSION_SECRET = "shared-singleton-test";
  process.env.NODE_ENV = "test";
  process.env.AV_REPO_ROOT = process.cwd();
  delete globalThis.__avSystemInstance;

  try {
    const a = await import("../src/system-instance.ts?realm=a");
    const b = await import("../src/system-instance.ts?realm=b");
    assert.notStrictEqual(a, b, "import specifiers should resolve to distinct module records");
    const sysA = a.getSystem();
    const sysB = b.getSystem();
    assert.strictEqual(sysA, sysB, "both module realms must share one cached system");
    assert.strictEqual(sysA.system, sysB.system, "ProductionSystem instance is shared");
    assert.strictEqual(sysA.store, sysB.store, "SqliteStateStore instance is shared");
    assert.strictEqual(globalThis.__avSystemInstance, sysA, "system is cached on globalThis");
  } finally {
    const { reservationExpiryTimer } = globalThis.__avSystemInstance || {};
    if (reservationExpiryTimer) clearInterval(reservationExpiryTimer);
    delete globalThis.__avSystemInstance;
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(dir, { recursive: true, force: true });
  }
});
