import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

function envSetup() {
  const dir = mkdtempSync(join(tmpdir(), "av-unified-login-"));
  const previous = {
    DB_FILE: process.env.DB_FILE,
    DOCUMENT_STORAGE_DIR: process.env.DOCUMENT_STORAGE_DIR,
    TEAM_EMAIL: process.env.TEAM_EMAIL,
    TEAM_PASSWORD: process.env.TEAM_PASSWORD,
    PIX_WEBHOOK_SECRET: process.env.PIX_WEBHOOK_SECRET,
    SESSION_SECRET: process.env.SESSION_SECRET,
    AV_REQUIRE_LIVE_PROVIDER: process.env.AV_REQUIRE_LIVE_PROVIDER,
    AV_REPO_ROOT: process.env.AV_REPO_ROOT,
  };
  process.env.DB_FILE = join(dir, "unified-login.sqlite");
  process.env.DOCUMENT_STORAGE_DIR = join(dir, "private-documents");
  process.env.TEAM_EMAIL = "admin@apoiar.test";
  process.env.TEAM_PASSWORD = "admin-secret-123";
  process.env.PIX_WEBHOOK_SECRET = "unified-login-test";
  process.env.SESSION_SECRET = "unified-login-test-secret";
  process.env.AV_REPO_ROOT = process.cwd();
  delete process.env.AV_REQUIRE_LIVE_PROVIDER;
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

function request(body) {
  return new Request("http://localhost:3000/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify(body),
  });
}

test("unified login sends patient credentials to the patient portal", async () => {
  const env = envSetup();
  try {
    const { POST } = await import("../app/api/login/route.js?case=patient");
    const response = await POST(request({ identifier: "APO-1027", password: "HELENA2026" }));
    assert.equal(response.status, 200);
    assert.match(response.headers.get("set-cookie") || "", /av_session=/);
    const body = await response.json();
    assert.equal(body.session.role, "patient");
    assert.equal(body.destination, "/paciente");
  } finally {
    env.teardown();
  }
});

test("unified login sends admin team credentials to admin", async () => {
  const env = envSetup();
  try {
    const { POST } = await import("../app/api/login/route.js?case=admin");
    const response = await POST(
      request({ identifier: "admin@apoiar.test", password: "admin-secret-123" }),
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.session.role, "team");
    assert.equal(body.session.user.role, "admin");
    assert.equal(body.destination, "/admin");
  } finally {
    env.teardown();
  }
});

test("unified login rejects invalid credentials without exposing account type", async () => {
  const env = envSetup();
  try {
    const { POST } = await import("../app/api/login/route.js?case=invalid");
    const response = await POST(request({ identifier: "APO-1027", password: "wrong" }));
    assert.equal(response.status, 401);
    const body = await response.json();
    assert.equal(body.error, "Credenciais invalidas.");
  } finally {
    env.teardown();
  }
});
