import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { createAssetReader } from "@ro-survivor/asset-gateway";
import { loadLocalContext, repoRoot } from "./local-context.ts";
import { buildUiManifest } from "./ui-manifest-lib.ts";
import { writeJson } from "./verify-sources-lib.ts";

const { lock, whitelist } = loadLocalContext();
const csv = readFileSync(join(repoRoot, "docs/product-plan/handoff/fan-local-asset-whitelist.csv"));
const reader = createAssetReader(lock);
try {
  const { manifest, report } = buildUiManifest(whitelist.rows(), reader, { lockId: lock.lockId, whitelistSha256: createHash("sha256").update(csv).digest("hex").toUpperCase() });
  // Report only: the served UI manifest is produced inside the assets:extract transaction (UI-B1).
  const out = join(repoRoot, "reports/local/ui-manifest.json");
  writeJson(out, manifest);
  writeJson(join(repoRoot, "reports/local/ui-manifest-report.json"), { at: new Date().toISOString(), ...report });
  for (const [cat, c] of Object.entries(report.categories)) console.log(`${cat}: found ${c.found}, missing ${c.missing}, ambiguous ${c.ambiguous}`);
  for (const i of report.issues) console.log(`MISSING ${i.assetId} ${i.container} ${i.canonicalPath}: ${i.issue}`);
  console.log(`${report.issues.length === 0 ? "PASS" : "FAIL"} ui-manifest: ${manifest.entries.length} entries -> ${relative(repoRoot, out)} (git-ignored)`);
  process.exitCode = report.issues.length === 0 ? 0 : 1;
} finally {
  reader.close();
}
