import { resolve } from "node:path";
import { exitCodeFor, validateHandoff } from "./validate-handoff-lib.ts";

const root = resolve(import.meta.dirname, "../..");
const checks = validateHandoff(root);
for (const c of checks) console.log(`${c.status.padEnd(5)} ${c.id}: ${c.detail}`);
const bad = checks.filter((c) => c.status !== "PASS");
if (exitCodeFor(checks) !== 0) {
  console.error(`assets:validate-handoff FAIL: ${bad.length} non-PASS result(s) (FAIL or DRIFT). Do not re-issue hashes to match changed bytes.`);
  process.exitCode = 1;
} else {
  console.log(`assets:validate-handoff PASS: ${checks.length} checks, including worktree and Git blob hashes`);
}
