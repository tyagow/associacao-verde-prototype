#!/usr/bin/env node
// Dev helper: clear privacyConsentAt for a patient so the consent gate
// (state 2 / b-consent.html) is reachable for visual verification.
//
// Patients are stored as JSON blobs in the `patients.data` column. We mutate
// only the JSON; nothing else.
//
// Usage:
//   node scripts/reset-consent.mjs [memberCode]
//   DB_FILE=/tmp/associacao-verde-dev.sqlite node scripts/reset-consent.mjs TIAGO
//
// The dev server uses /tmp/associacao-verde-dev.sqlite by default; override
// with DB_FILE if you point the server elsewhere.

import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";

const memberCode = (process.argv[2] || process.env.DEV_PATIENT_CODE || "TIAGO").toUpperCase();
const dbFile = process.env.DB_FILE || "/tmp/associacao-verde-dev.sqlite";

if (!existsSync(dbFile)) {
  console.error(`reset-consent: DB file not found at ${dbFile}`);
  console.error("Set DB_FILE to the running server's sqlite path.");
  process.exit(1);
}

const db = new DatabaseSync(dbFile);

const row = db
  .prepare("SELECT id, member_code, data FROM patients WHERE upper(member_code) = ?")
  .get(memberCode);

if (!row) {
  console.error(`reset-consent: no patient with member_code=${memberCode}`);
  process.exit(2);
}

const data = JSON.parse(row.data);
const before = data.privacyConsentAt || "(empty)";
data.privacyConsentAt = "";
const updated = db
  .prepare("UPDATE patients SET data = ? WHERE id = ?")
  .run(JSON.stringify(data), row.id);

console.log(
  `reset-consent: patient ${row.member_code} privacyConsentAt: ${before} -> "" (rows=${updated.changes})`,
);
console.log("Note: the running server caches state in memory. Restart it");
console.log("(scripts/dev-watchdog.sh restart) for the change to take effect.");
