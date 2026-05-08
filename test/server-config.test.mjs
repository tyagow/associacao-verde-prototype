import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

// After server.mjs deletion, the fail-closed validations live inside
// src/system-instance.ts::build() and run on first getSystem() call.
// We spawn an isolated tsx subprocess that imports the singleton with
// the unsafe env, and assert build() throws the expected guard.
//
// This preserves the security invariant tested before (boot must reject
// production env without required secrets / without PAYMENT_PROVIDER=asaas)
// in the post-migration architecture.

function probeWithEnv(env) {
  return spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "-e",
      "import('./src/system-instance.ts').then((m) => { m.getSystem(); console.log('OK'); }).catch((e) => { console.error(e.message); process.exit(1); });",
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env, ...env, AV_GLOBAL_SINGLETON_RESET: "1" },
      encoding: "utf8",
    },
  );
}

test("production system fails closed without required secrets", () => {
  const result = probeWithEnv({
    AV_REQUIRE_LIVE_PROVIDER: "true",
    TEAM_PASSWORD: "",
    PIX_WEBHOOK_SECRET: "",
    SESSION_SECRET: "",
    PAYMENT_PROVIDER: "asaas",
    ASAAS_API_KEY: "k",
    ASAAS_CUSTOMER_ID: "c",
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stderr}\n${result.stdout}`, /TEAM_PASSWORD obrigatorio/);
});

test("production system fails closed unless live Pix provider is selected", () => {
  const result = probeWithEnv({
    AV_REQUIRE_LIVE_PROVIDER: "true",
    TEAM_PASSWORD: "strong-password",
    TEAM_EMAIL: "admin@apoiar.test",
    PIX_WEBHOOK_SECRET: "webhook-secret",
    SESSION_SECRET: "session-secret",
    PAYMENT_PROVIDER: "",
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stderr}\n${result.stdout}`, /PAYMENT_PROVIDER=asaas obrigatorio/);
});
