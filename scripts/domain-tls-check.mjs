import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { connect } from "node:tls";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const evidenceFile = resolve(
  process.env.DOMAIN_TLS_EVIDENCE || join(root, "artifacts", "readiness", "domain-tls.json"),
);
const target = process.env.READINESS_DOMAIN_URL || "";
const startedAt = Date.now();

try {
  if (!target) throw new Error("READINESS_DOMAIN_URL is required.");
  const parsed = new URL(target);
  const isHttps = parsed.protocol === "https:";
  const isProfessionalHost = isPublicHostname(parsed.hostname);
  if (!isHttps) throw new Error("READINESS_DOMAIN_URL must use https.");
  if (!isProfessionalHost)
    throw new Error("READINESS_DOMAIN_URL must use a public production hostname.");

  const tls = await inspectTls(parsed);
  const health = await fetchHealth(parsed);
  const evidence = {
    ok: tls.authorized === true && health.status === 200 && health.payload?.ok === true,
    checkedAt: new Date().toISOString(),
    url: target,
    hostname: parsed.hostname,
    https: isHttps,
    professionalHost: isProfessionalHost,
    tls,
    health,
    durationMs: Date.now() - startedAt,
  };
  await writeEvidence(evidence);
  if (!evidence.ok) {
    console.error(JSON.stringify(evidence, null, 2));
    process.exit(1);
  }
  console.log(
    JSON.stringify(
      { ok: true, evidenceFile, hostname: parsed.hostname, validTo: tls.validTo },
      null,
      2,
    ),
  );
} catch (error) {
  const evidence = {
    ok: false,
    checkedAt: new Date().toISOString(),
    url: target,
    error: error.message,
    durationMs: Date.now() - startedAt,
  };
  await writeEvidence(evidence);
  console.error(JSON.stringify(evidence, null, 2));
  process.exit(1);
}

async function inspectTls(parsed) {
  return await new Promise((resolveTls, rejectTls) => {
    const socket = connect({
      host: parsed.hostname,
      port: Number(parsed.port || 443),
      servername: parsed.hostname,
      rejectUnauthorized: true,
      timeout: 8000,
    });
    socket.once("secureConnect", () => {
      const cert = socket.getPeerCertificate();
      const result = {
        authorized: socket.authorized,
        authorizationError: socket.authorizationError || "",
        subject: cert.subject || {},
        issuer: cert.issuer || {},
        validFrom: cert.valid_from || "",
        validTo: cert.valid_to || "",
        fingerprint256: cert.fingerprint256 || "",
      };
      socket.end();
      resolveTls(result);
    });
    socket.once("timeout", () => {
      socket.destroy();
      rejectTls(new Error("TLS connection timed out."));
    });
    socket.once("error", rejectTls);
  });
}

async function fetchHealth(parsed) {
  const response = await fetch(new URL("/health", parsed));
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  return { status: response.status, payload };
}

function isPublicHostname(hostname) {
  const normalized = String(hostname || "").toLowerCase();
  if (!normalized || normalized === "localhost") return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(normalized)) return false;
  if (
    normalized.endsWith(".local") ||
    normalized.endsWith(".test") ||
    normalized.endsWith(".localhost")
  )
    return false;
  return normalized.includes(".");
}

async function writeEvidence(evidence) {
  await mkdir(dirname(evidenceFile), { recursive: true });
  await writeFile(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
}
