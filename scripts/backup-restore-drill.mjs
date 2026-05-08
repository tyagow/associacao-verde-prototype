import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { SqliteStateStore } from "../src/sqlite-store.ts";

const root = fileURLToPath(new URL("..", import.meta.url));

if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_BACKUP_DRILL !== "true") {
  console.error(
    "Refusing to run backup drill with NODE_ENV=production without ALLOW_PRODUCTION_BACKUP_DRILL=true.",
  );
  process.exit(1);
}

const sourceDb = resolve(process.env.DB_FILE || join(root, "data", "associacao-verde.sqlite"));
const artifactDir = resolve(
  process.env.BACKUP_DRILL_DIR || join(root, "artifacts", "readiness", "backup-drill"),
);
const evidenceFile = resolve(
  process.env.BACKUP_DRILL_EVIDENCE ||
    join(root, "artifacts", "readiness", "backup-restore-drill.json"),
);

if (!existsSync(sourceDb)) {
  console.error(`Source database does not exist: ${sourceDb}`);
  process.exit(1);
}

await mkdir(artifactDir, { recursive: true });
await mkdir(dirname(evidenceFile), { recursive: true });

const checkedAt = new Date().toISOString();
const stamp = checkedAt.replace(/[:.]/g, "-");
const backupFile = join(artifactDir, `backup-${stamp}.sqlite`);

const liveDb = new DatabaseSync(sourceDb, { readOnly: true });
try {
  liveDb.exec(`VACUUM INTO '${backupFile.replaceAll("'", "''")}'`);
} finally {
  liveDb.close();
}

const backupBytes = readFileSync(backupFile);
const restored = new SqliteStateStore({ filePath: backupFile });
let state;
try {
  state = restored.load();
} finally {
  restored.close();
}

const counts = {
  patients: state.patients.length,
  products: state.products.length,
  teamUsers: state.teamUsers.length,
  orders: state.orders.length,
  payments: state.payments.length,
  prescriptionDocuments: state.prescriptionDocuments.length,
  supportTickets: (state.supportTickets || []).length,
  auditEvents: state.auditLog.length,
};
const requiredCounts = ["patients", "products", "teamUsers"];
const ok = backupBytes.length > 0 && requiredCounts.every((key) => counts[key] > 0);
const evidence = {
  ok,
  checkedAt,
  sourceDb,
  backupFile,
  backupFileName: basename(backupFile),
  bytes: backupBytes.length,
  sha256: createHash("sha256").update(backupBytes).digest("hex"),
  counts,
  restore: {
    loaded: true,
    requiredTablesPresent: ok,
  },
};

await writeFile(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });

if (!ok) {
  console.error(JSON.stringify(evidence, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, evidenceFile, backupFile, counts }, null, 2));
