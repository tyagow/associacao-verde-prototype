import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const baseUrl = process.env.READINESS_BASE_URL || "http://127.0.0.1:4174";
const teamEmail =
  process.env.READINESS_TEAM_EMAIL || process.env.TEAM_EMAIL || "equipe@apoiar.local";
const teamPassword =
  process.env.READINESS_TEAM_PASSWORD || process.env.TEAM_PASSWORD || "apoio-equipe-dev";
const evidenceFile = resolve(
  process.env.SESSION_SECURITY_EVIDENCE ||
    join(root, "artifacts", "readiness", "session-security.json"),
);
const startedAt = Date.now();

try {
  const health = await request("/health");
  const login = await rawRequest("/api/team/login", {
    method: "POST",
    body: { email: teamEmail, password: teamPassword },
  });
  const parsed = parseSetCookie(login.setCookie || "");
  const url = new URL(baseUrl);
  const secureRequired = health.payload?.production === true || url.protocol === "https:";
  const evidence = {
    ok:
      login.status === 200 &&
      parsed.name === "av_session" &&
      parsed.httpOnly === true &&
      parsed.sameSite === "Lax" &&
      parsed.path === "/" &&
      Number(parsed.maxAge) > 0 &&
      Number(parsed.maxAge) <= 12 * 60 * 60 &&
      parsed.signedValue === true &&
      (!secureRequired || parsed.secure === true),
    checkedAt: new Date().toISOString(),
    baseUrl,
    production: health.payload?.production === true,
    secureRequired,
    loginStatus: login.status,
    cookie: parsed,
    durationMs: Date.now() - startedAt,
  };
  await writeEvidence(evidence);
  if (!evidence.ok) {
    console.error(JSON.stringify(evidence, null, 2));
    process.exit(1);
  }
  console.log(
    JSON.stringify(
      {
        ok: true,
        evidenceFile,
        production: evidence.production,
        secureRequired,
        secure: parsed.secure,
      },
      null,
      2,
    ),
  );
} catch (error) {
  const evidence = {
    ok: false,
    checkedAt: new Date().toISOString(),
    baseUrl,
    error: error.message,
    durationMs: Date.now() - startedAt,
  };
  await writeEvidence(evidence);
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
  const headers = {};
  if (options.body) headers["content-type"] = "application/json";
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || "GET",
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
    payload,
    setCookie: response.headers.get("set-cookie") || "",
  };
}

function parseSetCookie(header) {
  const [nameValue, ...attributes] = String(header || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  const [name, encodedValue = ""] = String(nameValue || "").split("=");
  const value = decodeURIComponent(encodedValue);
  const parsed = {
    name: name || "",
    path: "",
    maxAge: 0,
    sameSite: "",
    httpOnly: false,
    secure: false,
    signedValue: value.includes("."),
  };
  for (const attribute of attributes) {
    const [key, rawValue = ""] = attribute.split("=");
    const normalized = key.toLowerCase();
    if (normalized === "path") parsed.path = rawValue;
    if (normalized === "max-age") parsed.maxAge = Number(rawValue || 0);
    if (normalized === "samesite") parsed.sameSite = rawValue;
    if (normalized === "httponly") parsed.httpOnly = true;
    if (normalized === "secure") parsed.secure = true;
  }
  return parsed;
}

async function writeEvidence(evidence) {
  await mkdir(dirname(evidenceFile), { recursive: true });
  await writeFile(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
}
