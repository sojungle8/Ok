// pnpm assets:propose -- tools/assets/candidates/<job>.json
// Local only: resolves candidate RO paths in the user's verified GRF archives and writes proposed
// whitelist rows (bytes + SHA-256) for Codex review to git-ignored reports/local/propose/.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { openGrf } from "@ro-survivor/ro-format-runtime/grf";
import { loadLocalContext, repoRoot } from "./local-context.ts";
import { propose, rowsToCsv, validateCandidates, type CandidateFile } from "./propose-lib.ts";

const arg = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!arg) {
  console.error("usage: pnpm assets:propose -- tools/assets/candidates/<job>.json");
  process.exit(2);
}
const file = JSON.parse(readFileSync(resolve(repoRoot, arg), "utf8")) as CandidateFile;
const { lock, whitelist } = loadLocalContext();
const errors = validateCandidates(file, new Set(whitelist.rows().map((r) => r.asset_id)));
if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
const data = openGrf(lock.sources["data.grf"].path);
const rdata = openGrf(lock.sources["rdata.grf"].path);
try {
  const result = propose({ "data.grf": data, "rdata.grf": rdata }, file);
  const out = join(repoRoot, "reports/local/propose");
  mkdirSync(out, { recursive: true });
  const stem = basename(arg).replace(/\.json$/u, "");
  writeFileSync(join(out, `${stem}-proposed-rows.csv`), rowsToCsv(result.rows));
  writeFileSync(join(out, `${stem}-report.json`), JSON.stringify({ job: file.job, found: result.rows.length, missing: result.missing, rdataOverrides: result.rows.filter((r) => r.overriddenByRdata).map((r) => r.row.asset_id), discovered: result.discovered }, null, 2) + "\n");
  console.log(`assets:propose ${file.job}: ${result.rows.length} found, ${result.missing.length} missing; discovery ${Object.entries(result.discovered).map(([k, v]) => `${k}=${v.length}`).join(" ")}`);
  console.log(`wrote reports/local/propose/${stem}-proposed-rows.csv and ${stem}-report.json (git-ignored; attach the report, never the assets)`);
} finally {
  data.close();
  rdata.close();
}
