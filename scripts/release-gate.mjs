import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateReleaseGate } from "../src/release-gate.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const report = evaluateReleaseGate(join(root, "artifacts", "readiness"));

if (!report.ok) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(report, null, 2));
