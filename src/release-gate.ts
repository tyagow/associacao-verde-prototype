import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const RELEASE_GATE_CHECKS = [
  {
    name: "Provider approval",
    file: "provider-approval.json",
    validate: (evidence) =>
      evidence.status === "approved" &&
      Boolean(evidence.provider) &&
      Boolean(evidence.accountStatus) &&
      Boolean(evidence.evidenceRef) &&
      Boolean(evidence.termsRef) &&
      Boolean(evidence.webhookDocsRef) &&
      Boolean(evidence.settlementNotes),
    detail:
      "Requires approved provider status plus provider, account, approval, terms, webhook docs, and settlement evidence.",
  },
  {
    name: "Deployment/log evidence",
    file: "deployment-check.json",
    validate: (evidence) =>
      evidence.ok === true &&
      evidence.production === true &&
      evidence.https === true &&
      evidence.logsEvidence === true &&
      evidence.healthStatus === 200 &&
      evidence.catalogDeniedStatus === 401 &&
      [302, 307, 308].includes(Number(evidence.protectedRouteStatus)),
    detail:
      "Requires production HTTPS release URL, health, protected admin redirect, catalog denial, security headers, and log reference.",
  },
  {
    name: "Domain/TLS",
    file: "domain-tls.json",
    validate: (evidence) =>
      evidence.ok === true &&
      evidence.https === true &&
      evidence.professionalHost === true &&
      evidence.tls?.authorized === true &&
      evidence.health?.status === 200,
    detail: "Requires public HTTPS hostname, trusted certificate, and healthy /health response.",
  },
  {
    name: "Signed Pix webhook drill",
    file: "webhook-drill.json",
    validate: (evidence) =>
      evidence.ok === true &&
      evidence.unsignedStatus === 401 &&
      evidence.signedStatus === 200 &&
      evidence.finalOrderStatus === "paid_pending_fulfillment",
    detail: "Requires unsigned webhook rejection and signed paid webhook confirmation.",
  },
  {
    name: "Database schema",
    file: "schema-check.json",
    validate: (evidence) =>
      evidence.ok === true &&
      evidence.schemaVersion === evidence.expectedVersion &&
      Array.isArray(evidence.missingTables) &&
      evidence.missingTables.length === 0,
    detail:
      "Requires expected SQLite schema version, migration ledger, and all required production tables.",
  },
  {
    name: "Session cookie security",
    file: "session-security.json",
    validate: (evidence) =>
      evidence.ok === true &&
      evidence.production === true &&
      evidence.secureRequired === true &&
      evidence.cookie?.httpOnly === true &&
      evidence.cookie?.secure === true &&
      evidence.cookie?.sameSite === "Lax" &&
      evidence.cookie?.path === "/" &&
      evidence.cookie?.signedValue === true,
    detail: "Requires signed HttpOnly SameSite session cookie with Secure flag in production.",
  },
  {
    name: "Backup restore drill",
    file: "backup-restore-drill.json",
    validate: (evidence) =>
      evidence.ok === true &&
      evidence.restore?.loaded === true &&
      String(evidence.sha256 || "").length === 64,
    detail: "Requires a restorable SQLite backup with checksum evidence.",
  },
  {
    name: "Offsite backup schedule",
    file: "backup-schedule.json",
    validate: (evidence) =>
      evidence.status === "configured" &&
      Boolean(evidence.offsiteTargetRef) &&
      Boolean(evidence.frequency) &&
      Boolean(evidence.retention) &&
      Boolean(evidence.encryptionRef) &&
      Boolean(evidence.lastSuccessfulBackupAt) &&
      Boolean(evidence.lastBackupRef) &&
      Boolean(evidence.operatorRef) &&
      String(evidence.restoreDrillSha256 || "").length === 64,
    detail:
      "Requires configured offsite target, frequency, retention, encryption, last backup, operator, and linked restore checksum.",
  },
];

export function evaluateReleaseGate(readinessDir, now = new Date()) {
  const checks = RELEASE_GATE_CHECKS.map((check) => evaluateCheck(readinessDir, check));
  return {
    ok: checks.every((check) => check.ok),
    checkedAt: now.toISOString(),
    checks,
  };
}

function evaluateCheck(readinessDir, check) {
  const path = join(readinessDir, check.file);
  if (!existsSync(path))
    return {
      name: check.name,
      ok: false,
      file: check.file,
      detail: check.detail,
      error: "missing evidence file",
    };
  try {
    const evidence = JSON.parse(readFileSync(path, "utf8"));
    return {
      name: check.name,
      ok: check.validate(evidence),
      file: check.file,
      checkedAt: evidence.checkedAt || "",
      detail: check.detail,
    };
  } catch (error) {
    return {
      name: check.name,
      ok: false,
      file: check.file,
      detail: check.detail,
      error: error.message,
    };
  }
}
