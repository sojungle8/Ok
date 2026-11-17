import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { sourceLockExampleSchema, type SourceLockExample, type SourceLockLocal } from "@ro-survivor/content-schema";
import { sha256File, sha256Text } from "../lib/hash.ts";

export type CheckStatus = "PASS" | "FAIL" | "WARN";

export interface SourceCheck {
  sourceId: "data.grf" | "rdata.grf" | "bgm" | `bgm:${string}`;
  check: string;
  status: CheckStatus;
  expected: string;
  actual: string;
}

export interface VerifyResult {
  ok: boolean;
  checks: SourceCheck[];
  lock: SourceLockLocal | null;
  missingEnv: string[];
}

export function readLockExample(root: string): SourceLockExample {
  return sourceLockExampleSchema.parse(JSON.parse(readFileSync(join(root, "assets/source-lock.example.json"), "utf8")));
}

/**
 * Verify the user's local RO sources against the committed lock. Never updates the lock
 * on mismatch; the local lock (with absolute paths) is only produced when every hard check passes.
 */
export async function verifySources(options: {
  lock: SourceLockExample;
  env: Record<string, string | undefined>;
  now?: () => Date;
  tool?: string;
}): Promise<VerifyResult> {
  const { lock, env } = options;
  const checks: SourceCheck[] = [];
  const missingEnv: string[] = [];
  const dataPath = env[lock.sources["data.grf"].envVar];
  const rdataPath = env[lock.sources["rdata.grf"].envVar];
  const bgmDir = env[lock.sources.bgm.envVar];
  for (const [name, value] of [
    [lock.sources["data.grf"].envVar, dataPath],
    [lock.sources["rdata.grf"].envVar, rdataPath],
    [lock.sources.bgm.envVar, bgmDir],
  ] as const) {
    if (value === undefined || value === "") missingEnv.push(name);
  }
  if (missingEnv.length > 0) return { ok: false, checks, lock: null, missingEnv };

  const grfResults: Record<"data.grf" | "rdata.grf", { path: string; bytes: number; sha256: string }> = {
    "data.grf": { path: dataPath as string, bytes: 0, sha256: "" },
    "rdata.grf": { path: rdataPath as string, bytes: 0, sha256: "" },
  };
  for (const id of ["data.grf", "rdata.grf"] as const) {
    const p = grfResults[id].path;
    const expected = lock.sources[id];
    if (!existsSync(p) || !statSync(p).isFile()) {
      checks.push({ sourceId: id, check: "exists", status: "FAIL", expected: "regular file", actual: "missing" });
      continue;
    }
    const size = statSync(p).size;
    checks.push({ sourceId: id, check: "bytes", status: size === expected.bytes ? "PASS" : "FAIL", expected: String(expected.bytes), actual: String(size) });
    const { sha256, bytes } = await sha256File(p);
    grfResults[id] = { path: p, bytes, sha256 };
    checks.push({ sourceId: id, check: "sha256", status: sha256 === expected.sha256 ? "PASS" : "FAIL", expected: expected.sha256, actual: sha256 });
  }

  const bgmFiles: { name: string; bytes: number; sha256: string }[] = [];
  const bgmPath = bgmDir as string;
  if (!existsSync(bgmPath) || !statSync(bgmPath).isDirectory()) {
    checks.push({ sourceId: "bgm", check: "exists", status: "FAIL", expected: "directory", actual: "missing" });
  } else {
    const names = readdirSync(bgmPath, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.toLowerCase().endsWith(".mp3"))
      .map((d) => d.name)
      .sort();
    for (const name of names) {
      const r = await sha256File(join(bgmPath, name));
      bgmFiles.push({ name, ...r });
    }
    const expectedCount = lock.sources.bgm.expectedFileCount;
    checks.push({
      sourceId: "bgm",
      check: "mp3 count",
      status: names.length === expectedCount ? "PASS" : "WARN",
      expected: String(expectedCount),
      actual: String(names.length),
    });
    for (const [pinnedName, pinned] of Object.entries(lock.sources.bgm.pinnedFiles)) {
      const found = bgmFiles.find((f) => f.name.toLowerCase() === pinnedName.toLowerCase());
      checks.push({
        sourceId: `bgm:${pinnedName}`,
        check: "sha256+bytes",
        status: found && found.sha256 === pinned.sha256 && found.bytes === pinned.bytes ? "PASS" : "FAIL",
        expected: `${pinned.bytes}/${pinned.sha256}`,
        actual: found ? `${found.bytes}/${found.sha256}` : "missing",
      });
    }
  }

  const ok = checks.every((c) => c.status !== "FAIL");
  const manifestSha256 = sha256Text(bgmFiles.map((f) => `${f.name}\t${f.bytes}\t${f.sha256}`).join("\n"));
  const lockOut: SourceLockLocal | null = ok
    ? {
        schemaVersion: 1,
        lockId: lock.lockId,
        scannedAt: (options.now ?? (() => new Date()))().toISOString(),
        pathEncoding: "cp949",
        tool: options.tool ?? "assets:verify-sources",
        sources: {
          "data.grf": grfResults["data.grf"],
          "rdata.grf": grfResults["rdata.grf"],
          bgm: { path: bgmPath, fileCount: bgmFiles.length, manifestSha256, files: bgmFiles },
        },
      }
    : null;
  return { ok, checks, lock: lockOut, missingEnv };
}

export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}
