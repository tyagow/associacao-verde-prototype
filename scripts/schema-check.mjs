import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SQLITE_SCHEMA_VERSION, SqliteStateStore } from "../src/sqlite-store.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const dbFile = resolve(process.env.DB_FILE || join(root, "data", "associacao-verde.sqlite"));
const evidenceFile = resolve(
  process.env.SCHEMA_CHECK_EVIDENCE || join(root, "artifacts", "readiness", "schema-check.json"),
);
const requiredTables = [
  "app_meta",
  "schema_migrations",
  "patients",
  "memberships",
  "team_users",
  "products",
  "cultivation_batches",
  "inventory_lots",
  "sessions",
  "stock_reservations",
  "stock_movements",
  "orders",
  "payments",
  "payment_events",
  "prescription_documents",
  "support_tickets",
  "support_messages",
  "shipments",
  "audit_log",
];

let store = null;
try {
  store = new SqliteStateStore({ filePath: dbFile });
  const tables = store.db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
    .map((row) => row.name)
    .sort();
  const missingTables = requiredTables.filter((table) => !tables.includes(table));
  const migrations = store.migrations().map((row) => ({ ...row }));
  const schemaVersion = store.schemaVersion();
  const evidence = {
    ok:
      schemaVersion === SQLITE_SCHEMA_VERSION &&
      missingTables.length === 0 &&
      migrations.some((migration) => migration.version === SQLITE_SCHEMA_VERSION),
    checkedAt: new Date().toISOString(),
    dbFile,
    expectedVersion: SQLITE_SCHEMA_VERSION,
    schemaVersion,
    requiredTables,
    missingTables,
    migrations,
  };
  await writeEvidence(evidence);
  if (!evidence.ok) {
    console.error(JSON.stringify(evidence, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, evidenceFile, dbFile, schemaVersion }, null, 2));
} catch (error) {
  const evidence = {
    ok: false,
    checkedAt: new Date().toISOString(),
    dbFile,
    expectedVersion: SQLITE_SCHEMA_VERSION,
    error: error.message,
  };
  await writeEvidence(evidence);
  console.error(JSON.stringify(evidence, null, 2));
  process.exit(1);
} finally {
  store?.close();
}

async function writeEvidence(evidence) {
  await mkdir(dirname(evidenceFile), { recursive: true });
  await writeFile(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
}
