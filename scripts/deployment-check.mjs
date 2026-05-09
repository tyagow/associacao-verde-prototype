import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const baseUrl = process.env.READINESS_BASE_URL || "http://127.0.0.1:4174";
const evidenceFile = resolve(
  process.env.DEPLOYMENT_CHECK_EVIDENCE ||
    join(root, "artifacts", "readiness", "deployment-check.json"),
);
const logsRef = process.env.LOG_EVIDENCE_REF || "";
const startedAt = Date.now();

try {
  const health = await request("/health");
  const catalogDenied = await rawRequest("/api/catalog");
  const protectedRoute = await rawRequest("/admin", { redirect: "manual" });
  const home = await rawRequest("/");

  const securityHeaders = {
    xContentTypeOptions: home.headers["x-content-type-options"] || "",
    referrerPolicy: home.headers["referrer-policy"] || "",
    cacheControl: protectedRoute.headers["cache-control"] || "",
  };
  const parsed = new URL(baseUrl);
  const evidence = {
    ok:
      health.status === 200 &&
      health.payload?.ok === true &&
      catalogDenied.status === 401 &&
      [302, 307, 308].includes(protectedRoute.status) &&
      protectedRoute.headers.location === "/" &&
      Boolean(securityHeaders.xContentTypeOptions),
    checkedAt: new Date().toISOString(),
    baseUrl,
    production: health.payload?.production === true,
    https: parsed.protocol === "https:",
    healthStatus: health.status,
    paymentProvider: health.payload?.paymentProvider || "",
    catalogDeniedStatus: catalogDenied.status,
    protectedRouteStatus: protectedRoute.status,
    protectedRouteLocation: protectedRoute.headers.location || "",
    securityHeaders,
    logsEvidence: Boolean(logsRef),
    logsRef,
    durationMs: Date.now() - startedAt,
    routes: {
      home: home.status,
      adminProtected: protectedRoute.status,
      catalogWithoutSession: catalogDenied.status,
    },
  };

  await mkdir(dirname(evidenceFile), { recursive: true });
  await writeFile(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  if (!evidence.ok) {
    console.error(JSON.stringify(evidence, null, 2));
    process.exit(1);
  }
  console.log(
    JSON.stringify({ ok: true, evidenceFile, baseUrl, production: evidence.production }, null, 2),
  );
} catch (error) {
  const evidence = {
    ok: false,
    checkedAt: new Date().toISOString(),
    baseUrl,
    error: error.message,
    durationMs: Date.now() - startedAt,
  };
  await mkdir(dirname(evidenceFile), { recursive: true });
  await writeFile(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  console.error(JSON.stringify(evidence, null, 2));
  process.exit(1);
}

async function request(path, options = {}) {
  const response = await rawRequest(path, options);
  if (!response.ok)
    throw new Error(`${path} returned ${response.status}: ${JSON.stringify(response.payload)}`);
  return response;
}

async function rawRequest(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body) headers["content-type"] = "application/json";
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || "GET",
    redirect: options.redirect || "follow",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  return {
    ok: response.ok,
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    text,
    payload,
  };
}
