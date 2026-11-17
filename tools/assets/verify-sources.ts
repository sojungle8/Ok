import { join, resolve } from "node:path";
import { loadLocalEnv } from "../lib/env.ts";
import { readLockExample, verifySources, writeJson } from "./verify-sources-lib.ts";

const root = resolve(import.meta.dirname, "../..");
const lock = readLockExample(root);
const env = loadLocalEnv(root);

console.log(`assets:verify-sources lock=${lock.lockId} (reading sources read-only; this can take a few minutes for 3 GB)`);
const result = await verifySources({ lock, env });

if (result.missingEnv.length > 0) {
  console.error(`assets:verify-sources DEFERRED_LOCAL: set ${result.missingEnv.join(", ")} in .env.local (see .env.example)`);
  process.exit(2);
}
for (const c of result.checks) {
  console.log(`${c.status.padEnd(4)} ${c.sourceId} ${c.check}: expected=${c.expected} actual=${c.actual}`);
}
const reportPath = join(root, "reports/local/verify-sources.json");
writeJson(reportPath, { ok: result.ok, checks: result.checks, at: new Date().toISOString() });
if (!result.ok || !result.lock) {
  console.error("assets:verify-sources FAIL: source fingerprint mismatch. The lock was NOT updated; stop and report the diff above.");
  process.exit(1);
}
writeJson(join(root, "assets/source-lock.local.json"), result.lock);
console.log("assets:verify-sources LOCAL_PASS: wrote assets/source-lock.local.json (git-ignored) and reports/local/verify-sources.json");
