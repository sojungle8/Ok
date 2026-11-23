import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { AssetWhitelist } from "@ro-survivor/asset-contracts";
import { sourceLockLocalSchema, type SourceLockLocal } from "@ro-survivor/content-schema";

export const repoRoot = resolve(import.meta.dirname, "../..");

export function loadLocalContext(): { lock: SourceLockLocal; whitelist: AssetWhitelist } {
  const lockPath = join(repoRoot, "assets/source-lock.local.json");
  if (!existsSync(lockPath)) {
    console.error("DEFERRED_LOCAL: assets/source-lock.local.json missing — run `pnpm assets:verify-sources` on the machine that holds the RO client.");
    process.exit(2);
  }
  return {
    lock: sourceLockLocalSchema.parse(JSON.parse(readFileSync(lockPath, "utf8"))),
    whitelist: AssetWhitelist.fromCsv(readFileSync(join(repoRoot, "docs/product-plan/handoff/fan-local-asset-whitelist.csv"), "utf8")),
  };
}
