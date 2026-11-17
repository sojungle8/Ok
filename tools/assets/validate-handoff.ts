import { resolve } from "node:path";
import { validateHandoff } from "./validate-handoff-lib.ts";

const root = resolve(import.meta.dirname, "../..");
const checks = validateHandoff(root);
for (const c of checks) console.log(`${c.status.padEnd(5)} ${c.id}: ${c.detail}`);
const fails = checks.filter((c) => c.status === "FAIL");
const drift = checks.filter((c) => c.status === "DRIFT");
if (drift.length > 0) {
  console.log(`NOTE: ${drift.length} delivered hash(es) differ from VALIDATION.md; content checks above were re-run on the checkout (see RISKS.md R-07).`);
}
if (fails.length > 0) {
  console.error(`assets:validate-handoff FAIL (${fails.length})`);
  process.exitCode = 1;
} else {
  console.log("assets:validate-handoff CLOUD_PASS (content checks)");
}
