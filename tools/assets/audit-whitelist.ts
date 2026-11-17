import { join } from "node:path";
import { createAssetReader } from "@ro-survivor/asset-gateway";
import { writeJson } from "./verify-sources-lib.ts";
import { auditWhitelist } from "./audit-whitelist-lib.ts";
import { loadLocalContext, repoRoot } from "./local-context.ts";

const { lock, whitelist } = loadLocalContext();
const reader = createAssetReader(lock);
try {
  const rows = auditWhitelist(whitelist.rows(), reader);
  for (const r of rows) console.log(`${r.status} ${r.assetId}: ${r.checks.join("; ")}`);
  const pass = rows.filter((r) => r.status === "PASS").length;
  writeJson(join(repoRoot, "reports/local/audit-whitelist.json"), { at: new Date().toISOString(), sources: reader.sourceHashes, pass, fail: rows.length - pass, rows });
  console.log(`assets:audit-whitelist ${pass}/${rows.length} PASS — reports/local/audit-whitelist.json (no paths)`);
  if (pass !== rows.length) process.exitCode = 1;
} finally {
  reader.close();
}
