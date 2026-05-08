import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:net";

const port = await freePort();
const baseUrl = `http://127.0.0.1:${port}`;
const tempDir = await mkdtemp(join(tmpdir(), "associacao-verde-verify-"));
const dbFile = join(tempDir, "verify.sqlite");
const documentStorageDir = join(tempDir, "private-documents");
const env = {
  ...process.env,
  PORT: String(port),
  DB_FILE: dbFile,
  DOCUMENT_STORAGE_DIR: documentStorageDir,
  TEAM_EMAIL: process.env.TEAM_EMAIL || "equipe@apoiar.local",
  TEAM_PASSWORD: process.env.TEAM_PASSWORD || "apoio-equipe-dev",
  PIX_WEBHOOK_SECRET: process.env.PIX_WEBHOOK_SECRET || "dev-webhook-secret",
  SESSION_SECRET: process.env.SESSION_SECRET || "dev-session-secret-change-me",
  NEXT_DEV: "false",
};

let serverOutput = "";
let server = startServer();

try {
  await waitForHealth(baseUrl, server);
  await run("npm", ["run", "readiness:backup-drill"], { ...env, DB_FILE: dbFile });
  await run("npm", ["run", "readiness:webhook-drill"], { ...env, READINESS_BASE_URL: baseUrl });
  await run("npm", ["run", "readiness:provider-evidence"], {
    ...env,
    PROVIDER_NAME: process.env.PROVIDER_NAME || "asaas",
    PROVIDER_APPROVAL_STATUS: process.env.PROVIDER_APPROVAL_STATUS || "pending",
    PROVIDER_ACCOUNT_STATUS: process.env.PROVIDER_ACCOUNT_STATUS || "not-approved",
  });
  await run("npm", ["run", "readiness:deployment-check"], {
    ...env,
    READINESS_BASE_URL: baseUrl,
    LOG_EVIDENCE_REF: process.env.LOG_EVIDENCE_REF || "isolated-verification-process-output",
  });
  await run("npm", ["run", "readiness:backup-schedule"], {
    ...env,
    BACKUP_SCHEDULE_STATUS: process.env.BACKUP_SCHEDULE_STATUS || "pending",
  });
  await run("npm", ["run", "readiness:schema-check"], { ...env, DB_FILE: dbFile });
  await run("npm", ["run", "readiness:session-security"], { ...env, READINESS_BASE_URL: baseUrl });

  await restartWithCleanSeed();
  await run("npm", ["run", "e2e"], { ...env, E2E_BASE_URL: baseUrl });
  await run("npm", ["run", "smoke"], { ...env, SMOKE_BASE_URL: baseUrl });
  console.log(JSON.stringify({ ok: true, baseUrl, dbFile, documentStorageDir }, null, 2));
} catch (error) {
  console.error(
    JSON.stringify(
      { ok: false, baseUrl, dbFile, documentStorageDir, error: error.message },
      null,
      2,
    ),
  );
  if (serverOutput.trim()) console.error(serverOutput);
  throw error;
} finally {
  server.kill("SIGTERM");
  await waitForExit(server);
  if (process.env.KEEP_ISOLATED_VERIFY_DATA !== "true") {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function run(command, args, nextEnv) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: new URL("..", import.meta.url),
      env: nextEnv,
      stdio: "inherit",
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
    child.on("error", reject);
  });
}

function startServer() {
  const processHandle = spawn("npx", ["next", "start", "-p", String(port)], {
    cwd: new URL("..", import.meta.url),
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  processHandle.stdout.on("data", (chunk) => {
    serverOutput += chunk;
  });
  processHandle.stderr.on("data", (chunk) => {
    serverOutput += chunk;
  });
  return processHandle;
}

async function restartWithCleanSeed() {
  server.kill("SIGTERM");
  await waitForExit(server);
  await rm(dbFile, { force: true });
  await rm(`${dbFile}-shm`, { force: true });
  await rm(`${dbFile}-wal`, { force: true });
  await rm(documentStorageDir, { recursive: true, force: true });
  serverOutput = "";
  server = startServer();
  await waitForHealth(baseUrl, server);
}

async function waitForHealth(url, processHandle) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) {
      throw new Error(`server exited before health check:\n${serverOutput}`);
    }
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) return;
    } catch {
      await sleep(200);
    }
  }
  throw new Error(`server did not become healthy at ${url}\n${serverOutput}`);
}

async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
    server.on("error", reject);
  });
}

async function waitForExit(processHandle) {
  if (processHandle.exitCode !== null) return;
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      processHandle.kill("SIGKILL");
      resolve();
    }, 5000);
    processHandle.on("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
