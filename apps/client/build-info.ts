import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveBuildProfile } from "@ro-survivor/asset-contracts";

function gitShortSha(cwd: string): string {
  try {
    return execFileSync("git", ["rev-parse", "--short=12", "HEAD"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "nogit";
  }
}

/** Build ID = <version>+<git sha>.<UTC yyyymmdd>; BUILD_ID env overrides (CI). */
export function computeBuildInfo(repoRoot: string, env: Record<string, string | undefined>, now = new Date()) {
  const version = (JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as { version: string }).version;
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const buildId = env.BUILD_ID && env.BUILD_ID !== "" ? env.BUILD_ID : `${version}+${gitShortSha(repoRoot)}.${date}`;
  const approvalPath = join(repoRoot, "docs/release/fan-public-approval.md");
  const profile = resolveBuildProfile({
    profile: env.RO_BUILD_PROFILE,
    publicApprovalRecord: existsSync(approvalPath) ? readFileSync(approvalPath, "utf8") : undefined,
  });
  return { buildId, profile };
}
