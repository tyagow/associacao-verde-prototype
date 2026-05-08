import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("production server fails closed without required secrets", () => {
  const result = spawnSync(process.execPath, ["server.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "production",
      TEAM_PASSWORD: "",
      PIX_WEBHOOK_SECRET: "",
      SESSION_SECRET: "",
    },
    encoding: "utf8",
  });

  assert.notEqual(result.status, 0);
  assert.match(`${result.stderr}\n${result.stdout}`, /TEAM_PASSWORD obrigatorio/);
});

test("production server fails closed unless live Pix provider is selected", () => {
  const result = spawnSync(process.execPath, ["server.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "production",
      TEAM_PASSWORD: "strong-password",
      TEAM_EMAIL: "admin@apoiar.test",
      PIX_WEBHOOK_SECRET: "webhook-secret",
      SESSION_SECRET: "session-secret",
      PAYMENT_PROVIDER: "",
    },
    encoding: "utf8",
  });

  assert.notEqual(result.status, 0);
  assert.match(`${result.stderr}\n${result.stdout}`, /PAYMENT_PROVIDER=asaas obrigatorio/);
});
