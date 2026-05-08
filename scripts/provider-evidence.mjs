import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const evidenceFile = resolve(
  process.env.PROVIDER_APPROVAL_EVIDENCE ||
    join(root, "artifacts", "readiness", "provider-approval.json"),
);

const evidence = {
  checkedAt: new Date().toISOString(),
  provider: process.env.PROVIDER_NAME || "",
  status: process.env.PROVIDER_APPROVAL_STATUS || "pending",
  accountStatus: process.env.PROVIDER_ACCOUNT_STATUS || "",
  evidenceRef: process.env.PROVIDER_EVIDENCE_REF || "",
  termsRef: process.env.PROVIDER_TERMS_REF || "",
  webhookDocsRef: process.env.PROVIDER_WEBHOOK_DOCS_REF || "",
  settlementNotes: process.env.PROVIDER_SETTLEMENT_NOTES || "",
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
if (missing.length) {
  console.error(`Provider approval cannot be marked approved without: ${missing.join(", ")}`);
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
      provider: evidence.provider || null,
    },
    null,
    2,
  ),
);
