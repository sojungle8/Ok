import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { scanRepository } from "./scan.ts";

interface RightsConfig {
  trustedHistoryBaseline?: unknown;
  distDirs: string[];
  localAssetDirs: string[];
  maxUnknownBinaryBytes: number;
  allowLargeBinaries: string[];
}

const root = resolve(process.argv[2] ?? process.cwd());
const configPath = resolve(root, "rights-check.config.json");
if (!existsSync(configPath)) {
  console.error("rights:check FAIL: rights-check.config.json is missing (trustedHistoryBaseline is required)");
  process.exit(1);
}
const config = JSON.parse(readFileSync(configPath, "utf8")) as RightsConfig;
// Fail closed: a missing or non-string baseline is passed through and rejected by checkBaseline.
const baseline = typeof config.trustedHistoryBaseline === "string" ? config.trustedHistoryBaseline : String(config.trustedHistoryBaseline);

const result = await scanRepository({
  root,
  history: baseline,
  distDirs: config.distDirs,
  localAssetDirs: config.localAssetDirs,
  maxUnknownBinaryBytes: config.maxUnknownBinaryBytes,
  allowLargeBinaries: config.allowLargeBinaries,
});
const c = result.counts;
console.log(
  `rights:check scanned index=${c.index} untracked=${c.untracked} worktree-files=${c.worktree} ` +
    `history=${result.baseline ? `${result.baseline.slice(0, 12)}..HEAD` : "n/a"} history-objects=${c.historyObjects} ` +
    `history-blobs-inspected=${c.historyBlobsInspected} dist-files=${c.dist}`,
);
for (const d of config.distDirs) {
  if (!existsSync(resolve(root, d))) console.log(`rights:check note: dist dir ${d} not present (run build first to scan it)`);
}
if (result.ok) {
  console.log("rights:check PASS: no RO assets, raw audio, secrets or unreviewed large binaries found");
} else {
  for (const f of result.findings) console.error(`rights:check FAIL [${f.where}] ${f.code}: ${f.path} (${f.detail})`);
  console.error(`rights:check FAIL: ${result.findings.length} finding(s)`);
  process.exitCode = 1;
}
