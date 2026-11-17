import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { sha256Text } from "../lib/hash.ts";

/**
 * Read-only fingerprint of the previous RO trees. Only git metadata, file counts and hashes of
 * `git status` output are recorded; file names (which could reveal 登入資料 or personal paths)
 * and file contents are never stored, except the first line of a LICENSE/COPYING file.
 */
export const OLD_TREE_ENV = {
  amatsu: "RO_OLD_TREE_AMATSU",
  server: "RO_OLD_TREE_SERVER",
  roBrowserLegacy: "RO_OLD_TREE_ROBROWSER_LEGACY",
  remoteClient: "RO_OLD_TREE_REMOTE_CLIENT",
} as const;
export type OldTreeId = keyof typeof OLD_TREE_ENV;

export const EXPECTED_COMMITS: Partial<Record<OldTreeId, string>> = {
  roBrowserLegacy: "5435cf67642eac8281f9a7a94c92f98428db471e",
  remoteClient: "cd51fcab453444ae5d9a1028b677fe0c56a32ca6",
};

export interface TreeSnapshot {
  id: OldTreeId;
  configured: boolean;
  exists: boolean;
  isGitRepo: boolean;
  head: string | null;
  expectedHead: string | null;
  headMatchesExpected: boolean | null;
  branch: string | null;
  status: { staged: number; modified: number; deleted: number; untracked: number; other: number; total: number; porcelainSha256: string } | null;
  topLevel: { entries: number; listingSha256: string } | null;
  license: { file: string; firstLine: string } | null;
  agentsMd: boolean;
}

function git(dir: string, args: string[]): string {
  // --no-optional-locks: `git status` must not refresh/write the index of a read-only tree.
  return execFileSync("git", ["--no-optional-locks", "-C", dir, "-c", "core.quotepath=false", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 512 * 1024 * 1024,
  });
}

export function snapshotTree(id: OldTreeId, dir: string | undefined): TreeSnapshot {
  const expectedHead = EXPECTED_COMMITS[id] ?? null;
  const base: TreeSnapshot = {
    id, configured: Boolean(dir), exists: false, isGitRepo: false, head: null, expectedHead,
    headMatchesExpected: null, branch: null, status: null, topLevel: null, license: null, agentsMd: false,
  };
  if (!dir) return base;
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return base;
  base.exists = true;
  const top = readdirSync(dir, { withFileTypes: true })
    .map((d) => `${d.isDirectory() ? "d" : "f"}:${d.name}:${d.isFile() ? statSync(join(dir, d.name)).size : 0}`)
    .sort();
  base.topLevel = { entries: top.length, listingSha256: sha256Text(top.join("\n")) };
  base.agentsMd = existsSync(join(dir, "AGENTS.md"));
  for (const name of ["LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING", "COPYING.txt"]) {
    const p = join(dir, name);
    if (existsSync(p) && statSync(p).isFile()) {
      const firstLine = readFileSync(p, "utf8").split(/\r?\n/u).find((l) => l.trim() !== "")?.trim() ?? "";
      base.license = { file: name, firstLine };
      break;
    }
  }
  try {
    const inside = git(dir, ["rev-parse", "--is-inside-work-tree"]).trim() === "true";
    const topDir = git(dir, ["rev-parse", "--show-toplevel"]).trim();
    base.isGitRepo = inside && existsSync(topDir);
  } catch {
    base.isGitRepo = false;
  }
  if (!base.isGitRepo) return base;
  try {
    base.head = git(dir, ["rev-parse", "HEAD"]).trim();
  } catch {
    base.head = null;
  }
  base.headMatchesExpected = expectedHead ? base.head === expectedHead : null;
  try {
    base.branch = git(dir, ["rev-parse", "--abbrev-ref", "HEAD"]).trim();
  } catch {
    base.branch = null;
  }
  const porcelain = git(dir, ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignore-submodules=none"]);
  const entries = porcelain.split("\0").filter((s) => s.length >= 3);
  const counts = { staged: 0, modified: 0, deleted: 0, untracked: 0, other: 0 };
  for (const e of entries) {
    const x = e[0];
    const y = e[1];
    if (x === "?" && y === "?") counts.untracked += 1;
    else if (y === "D" || x === "D") counts.deleted += 1;
    else if (y === "M") counts.modified += 1;
    else if (x !== " " && x !== "?") counts.staged += 1;
    else counts.other += 1;
  }
  base.status = { ...counts, total: entries.length, porcelainSha256: sha256Text(porcelain) };
  return base;
}

export function snapshotAll(env: Record<string, string | undefined>): TreeSnapshot[] {
  return (Object.keys(OLD_TREE_ENV) as OldTreeId[]).map((id) => snapshotTree(id, env[OLD_TREE_ENV[id]]));
}

export interface TreeDiff {
  id: OldTreeId;
  unchanged: boolean;
  changes: string[];
}

/** Compare two snapshots; anything different means an old tree was touched. */
export function compareSnapshots(before: TreeSnapshot[], after: TreeSnapshot[]): TreeDiff[] {
  return before.map((b) => {
    const a = after.find((x) => x.id === b.id);
    const changes: string[] = [];
    if (!a) changes.push("missing in after snapshot");
    else {
      if (a.head !== b.head) changes.push(`HEAD ${b.head} -> ${a.head}`);
      if (a.branch !== b.branch) changes.push(`branch ${b.branch} -> ${a.branch}`);
      if (a.status?.porcelainSha256 !== b.status?.porcelainSha256) changes.push("git status --porcelain output changed");
      if (a.topLevel?.listingSha256 !== b.topLevel?.listingSha256) changes.push("top-level listing changed");
      if (a.exists !== b.exists) changes.push("existence changed");
    }
    return { id: b.id, unchanged: changes.length === 0, changes };
  });
}
