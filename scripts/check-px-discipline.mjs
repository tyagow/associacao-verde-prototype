#!/usr/bin/env node
/**
 * Cycle 5 (M4) — px discipline guardrail.
 *
 * Counts hardcoded `padding: NNpx NNpx` in app/equipe + app/admin and
 * fails when the count exceeds THRESHOLD. Cycle-2 dropped this number
 * from 84 to 4 by promoting tokens; this guardrail prevents regression.
 *
 * Headroom is intentional — small one-off paddings (focus rings, icon
 * insets) are acceptable. Sustained drift past the threshold is a smell
 * that the design system needs another token.
 */
import { execSync } from "node:child_process";

const out = execSync(
  String.raw`grep -rEn "padding: [0-9]+px [0-9]+px" app/equipe app/admin || true`,
  { encoding: "utf8" },
).trim();
const lines = out ? out.split("\n") : [];
const THRESHOLD = 10;
if (lines.length > THRESHOLD) {
  console.error(`px-discipline: ${lines.length} hardcoded paddings (threshold ${THRESHOLD})`);
  console.error(lines.join("\n"));
  process.exit(1);
}
console.log(`px-discipline OK (${lines.length} hardcoded paddings; threshold ${THRESHOLD})`);
