// @ts-nocheck
// Readiness evidence helpers extracted from server.mjs so Next.js Route
// Handlers under app/api/team/readiness/* can produce the same payload
// shape (and write the same evidence files with mode 0o600) as the
// legacy switch did.
//
// Paths are anchored to repoRoot from getSystem() (the same boot-time
// resolution server.mjs used for __dirname-based artifacts paths).

import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, normalize } from "node:path";
import { evaluateReleaseGate } from "./release-gate.ts";
import { getSystem } from "./system-instance.ts";

function repoRoot() {
  return process.env.AV_REPO_ROOT || process.cwd();
}

function publicDir() {
  return join(repoRoot(), "public");
}

function readinessFile(name) {
  return join(repoRoot(), "artifacts", "readiness", name);
}

const backupDrillEvidenceFile = () => readinessFile("backup-restore-drill.json");
const webhookDrillEvidenceFile = () => readinessFile("webhook-drill.json");
const providerApprovalEvidenceFile = () => readinessFile("provider-approval.json");
const deploymentEvidenceFile = () => readinessFile("deployment-check.json");
const backupScheduleEvidenceFile = () => readinessFile("backup-schedule.json");
const domainTlsEvidenceFile = () => readinessFile("domain-tls.json");
const schemaCheckEvidenceFile = () => readinessFile("schema-check.json");
const sessionSecurityEvidenceFile = () => readinessFile("session-security.json");

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function cleanEvidenceText(value) {
  return String(value || "")
    .trim()
    .slice(0, 500);
}

function normalizeEvidenceStatus(value, allowed, fallback) {
  const normalized = String(value || fallback)
    .trim()
    .toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function formatBrazilDateTime(value) {
  if (!value) return "data nao registrada";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function readinessGate(label, ok, detail) {
  return { label, status: ok ? "ok" : "pending", detail };
}

export function readBackupDrillEvidence() {
  const file = backupDrillEvidenceFile();
  if (!existsSync(file)) return null;
  try {
    const evidence = JSON.parse(readFileSync(file, "utf8"));
    return {
      ok: evidence.ok === true,
      checkedAt: evidence.checkedAt,
      backupFileName: evidence.backupFileName || basename(evidence.backupFile || ""),
      bytes: evidence.bytes,
      sha256: evidence.sha256,
      counts: evidence.counts || {},
      restore: evidence.restore || {},
    };
  } catch {
    return {
      ok: false,
      checkedAt: null,
      backupFileName: "",
      bytes: 0,
      sha256: "",
      counts: {},
      restore: { loaded: false },
    };
  }
}

export function readWebhookDrillEvidence() {
  const file = webhookDrillEvidenceFile();
  if (!existsSync(file)) return null;
  try {
    const evidence = JSON.parse(readFileSync(file, "utf8"));
    return {
      ok: evidence.ok === true,
      checkedAt: evidence.checkedAt,
      baseUrl: evidence.baseUrl,
      paymentId: evidence.paymentId,
      orderId: evidence.orderId,
      unsignedStatus: evidence.unsignedStatus,
      signedStatus: evidence.signedStatus,
      finalOrderStatus: evidence.finalOrderStatus,
      stockAfterPayment: evidence.stockAfterPayment,
      durationMs: evidence.durationMs,
    };
  } catch {
    return {
      ok: false,
      checkedAt: null,
      baseUrl: "",
      paymentId: "",
      orderId: "",
      unsignedStatus: 0,
      signedStatus: 0,
      finalOrderStatus: "",
      stockAfterPayment: null,
      durationMs: 0,
    };
  }
}

export function readProviderApprovalEvidence() {
  const file = providerApprovalEvidenceFile();
  if (!existsSync(file)) return null;
  try {
    const evidence = JSON.parse(readFileSync(file, "utf8"));
    return {
      ok:
        evidence.status === "approved" &&
        Boolean(evidence.provider) &&
        Boolean(evidence.accountStatus) &&
        Boolean(evidence.evidenceRef) &&
        Boolean(evidence.termsRef) &&
        Boolean(evidence.webhookDocsRef) &&
        Boolean(evidence.settlementNotes),
      checkedAt: evidence.checkedAt,
      provider: evidence.provider || "",
      status: evidence.status || "pending",
      accountStatus: evidence.accountStatus || "",
      evidenceRef: evidence.evidenceRef || "",
      termsRef: evidence.termsRef || "",
      webhookDocsRef: evidence.webhookDocsRef || "",
      settlementNotes: evidence.settlementNotes || "",
    };
  } catch {
    return {
      ok: false,
      checkedAt: null,
      provider: "",
      status: "invalid",
      accountStatus: "",
      evidenceRef: "",
      termsRef: "",
      webhookDocsRef: "",
      settlementNotes: "",
    };
  }
}

export async function writeProviderApprovalEvidence(sessionId, input) {
  const { system } = getSystem();
  const actor = system.requireTeam(sessionId, "team:write");
  const evidence = {
    checkedAt: new Date().toISOString(),
    provider: cleanEvidenceText(input.provider),
    status: normalizeEvidenceStatus(input.status, ["pending", "approved", "rejected"], "pending"),
    accountStatus: cleanEvidenceText(input.accountStatus),
    evidenceRef: cleanEvidenceText(input.evidenceRef),
    termsRef: cleanEvidenceText(input.termsRef),
    webhookDocsRef: cleanEvidenceText(input.webhookDocsRef),
    settlementNotes: cleanEvidenceText(input.settlementNotes),
  };
  const requiredForApproval = [
    "provider",
    "accountStatus",
    "evidenceRef",
    "termsRef",
    "webhookDocsRef",
    "settlementNotes",
  ];
  const missing =
    evidence.status === "approved" ? requiredForApproval.filter((key) => !evidence[key]) : [];
  if (missing.length) throw httpError(400, `Aceite do provider precisa de: ${missing.join(", ")}.`);
  const file = providerApprovalEvidenceFile();
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  system.audit("provider_approval_evidence_recorded", actor.id, {
    provider: evidence.provider,
    status: evidence.status,
    accountStatus: evidence.accountStatus,
  });
  system.persist();
  return readProviderApprovalEvidence();
}

export function readDeploymentEvidence() {
  const file = deploymentEvidenceFile();
  if (!existsSync(file)) return null;
  try {
    const evidence = JSON.parse(readFileSync(file, "utf8"));
    const routes = evidence.routes || {};
    return {
      ok: evidence.ok === true,
      checkedAt: evidence.checkedAt,
      baseUrl: evidence.baseUrl || "",
      production: evidence.production === true,
      https: evidence.https === true,
      healthStatus: evidence.healthStatus,
      catalogDeniedStatus: evidence.catalogDeniedStatus,
      protectedRouteStatus: evidence.protectedRouteStatus,
      protectedRouteLocation: evidence.protectedRouteLocation || "",
      securityHeaders: evidence.securityHeaders || {},
      logsEvidence: evidence.logsEvidence === true,
      logsRef: evidence.logsRef || "",
      routes,
    };
  } catch {
    return {
      ok: false,
      checkedAt: null,
      baseUrl: "",
      production: false,
      https: false,
      healthStatus: 0,
      catalogDeniedStatus: 0,
      protectedRouteStatus: 0,
      protectedRouteLocation: "",
      securityHeaders: {},
      logsEvidence: false,
      logsRef: "",
      routes: {},
    };
  }
}

export function readBackupScheduleEvidence() {
  const file = backupScheduleEvidenceFile();
  if (!existsSync(file)) return null;
  try {
    const evidence = JSON.parse(readFileSync(file, "utf8"));
    return {
      ok:
        evidence.status === "configured" &&
        Boolean(evidence.offsiteTargetRef) &&
        Boolean(evidence.frequency) &&
        Boolean(evidence.retention) &&
        Boolean(evidence.encryptionRef) &&
        Boolean(evidence.lastSuccessfulBackupAt) &&
        Boolean(evidence.lastBackupRef) &&
        Boolean(evidence.restoreDrillSha256) &&
        Boolean(evidence.operatorRef),
      checkedAt: evidence.checkedAt,
      status: evidence.status || "pending",
      offsiteTargetRef: evidence.offsiteTargetRef || "",
      frequency: evidence.frequency || "",
      retention: evidence.retention || "",
      encryptionRef: evidence.encryptionRef || "",
      lastSuccessfulBackupAt: evidence.lastSuccessfulBackupAt || "",
      lastBackupRef: evidence.lastBackupRef || "",
      restoreDrillSha256: evidence.restoreDrillSha256 || "",
      operatorRef: evidence.operatorRef || "",
    };
  } catch {
    return {
      ok: false,
      checkedAt: null,
      status: "invalid",
      offsiteTargetRef: "",
      frequency: "",
      retention: "",
      encryptionRef: "",
      lastSuccessfulBackupAt: "",
      lastBackupRef: "",
      restoreDrillSha256: "",
      operatorRef: "",
    };
  }
}

export async function writeBackupScheduleEvidence(sessionId, input) {
  const { system } = getSystem();
  const actor = system.requireTeam(sessionId, "team:write");
  const backupRestore = readBackupDrillEvidence();
  const evidence = {
    checkedAt: new Date().toISOString(),
    status: normalizeEvidenceStatus(input.status, ["pending", "configured", "disabled"], "pending"),
    offsiteTargetRef: cleanEvidenceText(input.offsiteTargetRef),
    frequency: cleanEvidenceText(input.frequency),
    retention: cleanEvidenceText(input.retention),
    encryptionRef: cleanEvidenceText(input.encryptionRef),
    lastSuccessfulBackupAt: cleanEvidenceText(input.lastSuccessfulBackupAt),
    lastBackupRef: cleanEvidenceText(input.lastBackupRef),
    restoreDrillSha256: cleanEvidenceText(input.restoreDrillSha256) || backupRestore?.sha256 || "",
    restoreDrillCheckedAt: backupRestore?.checkedAt || "",
    operatorRef: cleanEvidenceText(input.operatorRef),
  };
  const requiredForConfigured = [
    "offsiteTargetRef",
    "frequency",
    "retention",
    "encryptionRef",
    "lastSuccessfulBackupAt",
    "lastBackupRef",
    "restoreDrillSha256",
    "operatorRef",
  ];
  const missing =
    evidence.status === "configured" ? requiredForConfigured.filter((key) => !evidence[key]) : [];
  if (missing.length)
    throw httpError(400, `Backup offsite configurado precisa de: ${missing.join(", ")}.`);
  const file = backupScheduleEvidenceFile();
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  system.audit("backup_schedule_evidence_recorded", actor.id, {
    status: evidence.status,
    offsiteTargetRef: evidence.offsiteTargetRef,
    frequency: evidence.frequency,
  });
  system.persist();
  return readBackupScheduleEvidence();
}

export function readDomainTlsEvidence() {
  const file = domainTlsEvidenceFile();
  if (!existsSync(file)) return null;
  try {
    const evidence = JSON.parse(readFileSync(file, "utf8"));
    const tls = evidence.tls || {};
    const health = evidence.health || {};
    return {
      ok:
        evidence.ok === true &&
        evidence.https === true &&
        evidence.professionalHost === true &&
        tls.authorized === true &&
        health.status === 200,
      checkedAt: evidence.checkedAt,
      url: evidence.url || "",
      hostname: evidence.hostname || "",
      https: evidence.https === true,
      professionalHost: evidence.professionalHost === true,
      authorized: tls.authorized === true,
      authorizationError: tls.authorizationError || "",
      issuer: tls.issuer || {},
      subject: tls.subject || {},
      validFrom: tls.validFrom || "",
      validTo: tls.validTo || "",
      fingerprint256: tls.fingerprint256 || "",
      healthStatus: health.status || 0,
    };
  } catch {
    return {
      ok: false,
      checkedAt: null,
      url: "",
      hostname: "",
      https: false,
      professionalHost: false,
      authorized: false,
      authorizationError: "invalid evidence",
      issuer: {},
      subject: {},
      validFrom: "",
      validTo: "",
      fingerprint256: "",
      healthStatus: 0,
    };
  }
}

export function readSchemaCheckEvidence() {
  const file = schemaCheckEvidenceFile();
  if (!existsSync(file)) return null;
  try {
    const evidence = JSON.parse(readFileSync(file, "utf8"));
    return {
      ok: evidence.ok === true,
      checkedAt: evidence.checkedAt,
      dbFile: evidence.dbFile || "",
      expectedVersion: evidence.expectedVersion,
      schemaVersion: evidence.schemaVersion,
      tableCount: Array.isArray(evidence.requiredTables) ? evidence.requiredTables.length : 0,
      missingTables: evidence.missingTables || [],
      migrations: evidence.migrations || [],
    };
  } catch {
    return {
      ok: false,
      checkedAt: null,
      dbFile: "",
      expectedVersion: 0,
      schemaVersion: 0,
      tableCount: 0,
      missingTables: [],
      migrations: [],
    };
  }
}

export function readSessionSecurityEvidence() {
  const file = sessionSecurityEvidenceFile();
  if (!existsSync(file)) return null;
  try {
    const evidence = JSON.parse(readFileSync(file, "utf8"));
    const cookie = evidence.cookie || {};
    const secureRequired = evidence.secureRequired === true;
    // In production we use `__Host-av_session`; in dev we use `av_session`.
    // `secureRequired` mirrors `production` for the running environment.
    const expectedCookieName = secureRequired ? "__Host-av_session" : "av_session";
    return {
      ok:
        evidence.ok === true &&
        cookie.name === expectedCookieName &&
        cookie.httpOnly === true &&
        cookie.sameSite === "Lax" &&
        cookie.path === "/" &&
        Number(cookie.maxAge) > 0 &&
        Number(cookie.maxAge) <= 12 * 60 * 60 &&
        cookie.signedValue === true &&
        (!secureRequired || cookie.secure === true),
      checkedAt: evidence.checkedAt,
      baseUrl: evidence.baseUrl || "",
      production: evidence.production === true,
      secureRequired,
      loginStatus: evidence.loginStatus || 0,
      durationMs: evidence.durationMs || 0,
      cookie: {
        name: cookie.name || "",
        path: cookie.path || "",
        maxAge: Number(cookie.maxAge || 0),
        sameSite: cookie.sameSite || "",
        httpOnly: cookie.httpOnly === true,
        secure: cookie.secure === true,
        signedValue: cookie.signedValue === true,
      },
    };
  } catch {
    return {
      ok: false,
      checkedAt: null,
      baseUrl: "",
      production: false,
      secureRequired: false,
      loginStatus: 0,
      durationMs: 0,
      cookie: {
        name: "",
        path: "",
        maxAge: 0,
        sameSite: "",
        httpOnly: false,
        secure: false,
        signedValue: false,
      },
    };
  }
}

export function readinessReport() {
  const {
    system,
    paymentProvider,
    production,
    dbFile,
    documentStorageDir,
    sessionSecret,
    webhookSecret,
    readinessDir,
  } = getSystem();
  // Touch the system so the call site has a concrete reference for symmetry.
  void system;
  const backupRestore = readBackupDrillEvidence();
  const webhookDrill = readWebhookDrillEvidence();
  const providerApproval = readProviderApprovalEvidence();
  const deploymentCheck = readDeploymentEvidence();
  const backupSchedule = readBackupScheduleEvidence();
  const domainTls = readDomainTlsEvidence();
  const schemaCheck = readSchemaCheckEvidence();
  const sessionSecurity = readSessionSecurityEvidence();
  const releaseGate = evaluateReleaseGate(readinessDir);
  return {
    production,
    paymentProvider: paymentProvider?.name || "dev-pix",
    backupRestore,
    webhookDrill,
    providerApproval,
    deploymentCheck,
    backupSchedule,
    domainTls,
    schemaCheck,
    sessionSecurity,
    releaseGate,
    gates: [
      readinessGate(
        "Pix provider",
        paymentProvider?.name === "asaas",
        production
          ? "PAYMENT_PROVIDER=asaas ativo."
          : "Ambiente local usa provider de desenvolvimento.",
      ),
      readinessGate("Banco de dados", Boolean(dbFile), `DB configurado em ${dbFile}`),
      readinessGate(
        "Storage privado",
        !normalize(documentStorageDir).startsWith(normalize(publicDir())),
        "Receitas ficam fora de public/.",
      ),
      readinessGate(
        "Sessao assinada",
        Boolean(sessionSecret),
        production ? "SESSION_SECRET configurado." : "Usando segredo local de desenvolvimento.",
      ),
      readinessGate(
        "Webhook Pix",
        Boolean(webhookSecret) && webhookDrill?.ok === true,
        webhookDrill?.ok
          ? `Assinatura rejeitada sem segredo e confirmada com segredo em ${formatBrazilDateTime(webhookDrill.checkedAt)}.`
          : "Pendente: executar npm run readiness:webhook-drill para provar assinatura e confirmacao Pix.",
      ),
      readinessGate(
        "Aceite do provider",
        providerApproval?.ok === true,
        providerApproval?.ok
          ? `${providerApproval.provider} aprovado em ${formatBrazilDateTime(providerApproval.checkedAt)}; evidencia ${providerApproval.evidenceRef}.`
          : "Pendente: registrar aceite formal do provider com npm run readiness:provider-evidence.",
      ),
      readinessGate(
        "Deploy/domain/logs",
        deploymentCheck?.ok === true &&
          (!production ||
            (deploymentCheck.https === true && deploymentCheck.logsEvidence === true)),
        deploymentCheck?.ok
          ? `Health e rotas protegidas verificados em ${formatBrazilDateTime(deploymentCheck.checkedAt)} para ${deploymentCheck.baseUrl}.`
          : "Pendente: executar npm run readiness:deployment-check contra o ambiente de release.",
      ),
      readinessGate(
        "Dominio/TLS",
        domainTls?.ok === true,
        domainTls?.ok
          ? `TLS valido para ${domainTls.hostname} ate ${formatBrazilDateTime(domainTls.validTo)}.`
          : "Pendente: executar READINESS_DOMAIN_URL=https://dominio npm run readiness:domain-tls para provar dominio profissional e certificado valido.",
      ),
      readinessGate(
        "Schema DB",
        schemaCheck?.ok === true,
        schemaCheck?.ok
          ? `Schema ${schemaCheck.schemaVersion} validado com ${schemaCheck.tableCount} tabelas em ${formatBrazilDateTime(schemaCheck.checkedAt)}.`
          : "Pendente: executar DB_FILE=<sqlite> npm run readiness:schema-check para provar schema e migrations.",
      ),
      readinessGate(
        "Sessao/cookie",
        sessionSecurity?.ok === true,
        sessionSecurity?.ok
          ? `Cookie de sessao assinado, HttpOnly e SameSite validado em ${formatBrazilDateTime(sessionSecurity.checkedAt)}.`
          : "Pendente: executar READINESS_BASE_URL=<url> npm run readiness:session-security para provar cookie de sessao.",
      ),
      readinessGate(
        "Backup/restore",
        backupRestore?.ok === true,
        backupRestore?.ok
          ? `Restore drill validado em ${formatBrazilDateTime(backupRestore.checkedAt)} com ${backupRestore.backupFileName}.`
          : "Pendente: executar npm run readiness:backup-drill e anexar evidencia ao release.",
      ),
      readinessGate(
        "Backup offsite",
        backupSchedule?.ok === true,
        backupSchedule?.ok
          ? `${backupSchedule.frequency} com retencao ${backupSchedule.retention}; ultimo offsite em ${formatBrazilDateTime(backupSchedule.lastSuccessfulBackupAt)}.`
          : "Pendente: executar npm run readiness:backup-schedule com destino offsite, retencao e ultimo backup validado.",
      ),
    ],
  };
}
