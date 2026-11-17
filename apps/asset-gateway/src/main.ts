// pnpm gateway — start the local fan-local asset gateway (loopback only by default).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { AssetWhitelist } from "@ro-survivor/asset-contracts";
import { sourceLockLocalSchema } from "@ro-survivor/content-schema";
import { parseGatewayConfig } from "./config.ts";
import { startGateway } from "./server.ts";
import { CONVERTER_VERSION, derivedDirFor } from "./paths.ts";

const root = resolve(import.meta.dirname, "../../..");
const envFile = join(root, ".env.local");
const env: Record<string, string | undefined> = { ...process.env };
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/u)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/u.exec(line);
    if (m && env[m[1] as string] === undefined) env[m[1] as string] = (m[2] as string).replace(/^(['"])(.*)\1$/u, "$2");
  }
}
// Explicit overrides (used by the synthetic demo); default is the verified real lock.
const lockPath = env.RO_GATEWAY_LOCK_FILE ? resolve(root, env.RO_GATEWAY_LOCK_FILE) : join(root, "assets/source-lock.local.json");
if (!existsSync(lockPath)) {
  console.error("gateway: assets/source-lock.local.json missing — run `pnpm assets:verify-sources` first (DEFERRED_LOCAL in the cloud).");
  process.exit(2);
}
const lock = sourceLockLocalSchema.parse(JSON.parse(readFileSync(lockPath, "utf8")));
const whitelist = AssetWhitelist.fromCsv(readFileSync(join(root, "docs/product-plan/handoff/fan-local-asset-whitelist.csv"), "utf8"));
const config = parseGatewayConfig(env);
let buildId = env.BUILD_ID ?? "local";
try {
  buildId = `gateway+${execFileSync("git", ["-C", root, "rev-parse", "--short=12", "HEAD"], { encoding: "utf8" }).trim()}`;
} catch {
  /* keep default */
}
const derived = env.RO_GATEWAY_DERIVED_DIR ? resolve(root, env.RO_GATEWAY_DERIVED_DIR) : derivedDirFor(root, lock.sources["data.grf"].sha256);
const gw = await startGateway({ config, whitelist, lock, buildId, derivedDir: existsSync(derived) ? derived : null });
console.log(`gateway: listening on ${gw.url} (converter v${CONVERTER_VERSION}, derived ${existsSync(derived) ? `${readdirSync(derived).length} files` : "none — run pnpm assets:extract --profile fan-local"})`);
const stop = (): void => {
  void gw.close().then(() => process.exit(0));
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
