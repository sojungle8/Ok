import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { scanRepository } from "./scan.ts";

interface RightsConfig {
  distDirs: string[];
  localAssetDirs: string[];
  maxUnknownBinaryBytes: number;
  allowLargeBinaries: string[];
}

const root = resolve(process.argv[2] ?? process.cwd());
const configPath = resolve(root, "rights-check.config.json");
const config: RightsConfig = existsSync(configPath)
  ? (JSON.parse(readFileSync(configPath, "utf8")) as RightsConfig)
  : { distDirs: [], localAssetDirs: [".local-assets"], maxUnknownBinaryBytes: 512 * 1024, allowLargeBinaries: [] };

const result = scanRepository({ root, ...config });
const c = result.counts;
console.log(`rights:check scanned index=${c.index} untracked=${c.untracked} worktree-files=${c.worktree} history-paths=${c.historyPaths} dist-files=${c.dist}`);
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
