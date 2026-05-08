import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const evidenceFile = resolve(
  process.env.BACKUP_SCHEDULE_EVIDENCE ||
    join(root, "artifacts", "readiness", "backup-schedule.json"),
);
const restoreEvidenceFile = resolve(
  process.env.BACKUP_DRILL_EVIDENCE ||
    join(root, "artifacts", "readiness", "backup-restore-drill.json"),
);

const restoreEvidence = readRestoreEvidence();
const evidence = {
  checkedAt: new Date().toISOString(),
  status: process.env.BACKUP_SCHEDULE_STATUS || "pending",
  offsiteTargetRef: process.env.BACKUP_OFFSITE_TARGET_REF || "",
  frequency: process.env.BACKUP_FREQUENCY || "",
  retention: process.env.BACKUP_RETENTION || "",
  encryptionRef: process.env.BACKUP_ENCRYPTION_REF || "",
  lastSuccessfulBackupAt: process.env.BACKUP_LAST_SUCCESSFUL_AT || "",
  lastBackupRef: process.env.BACKUP_LAST_REF || "",
  restoreDrillSha256: restoreEvidence?.sha256 || "",
  restoreDrillCheckedAt: restoreEvidence?.checkedAt || "",
  operatorRef: process.env.BACKUP_OPERATOR_REF || "",
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
if (missing.length) {
  console.error(`Backup schedule cannot be marked configured without: ${missing.join(", ")}`);
  process.exit(1);
}

await mkdir(dirname(evidenceFile), { recursive: true });
await writeFile(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });

console.log(
  JSON.stringify(
    {
      ok: missing.length === 0,
      evidenceFile,
      status: evidence.status,
      restoreDrillSha256: evidence.restoreDrillSha256 || null,
    },
    null,
    2,
  ),
);

function readRestoreEvidence() {
  if (!existsSync(restoreEvidenceFile)) return null;
  try {
    const evidence = JSON.parse(readFileSync(restoreEvidenceFile, "utf8"));
    return evidence?.ok === true ? evidence : null;
  } catch {
    return null;
  }
}
