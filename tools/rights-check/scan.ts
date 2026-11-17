import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { checkContent, checkPath, DEFAULT_MAX_UNKNOWN_BINARY_BYTES, isBinary, type Finding } from "./rules.ts";

export interface ScanOptions {
  root: string;
  /** Directories (relative to root) that are release output and must be scanned even though ignored. */
  distDirs?: readonly string[];
  maxUnknownBinaryBytes?: number;
  /** Paths (relative, forward slashes) of reviewed binaries allowed above the size threshold. */
  allowLargeBinaries?: readonly string[];
  /**
   * Working-tree directories where RO-derived files may legitimately live (git-ignored local cache).
   * Any RO format / raw audio file elsewhere in the working tree fails, even if git-ignored.
   */
  localAssetDirs?: readonly string[];
}

const ALWAYS_SKIP_DIRS = new Set([".git", "node_modules"]);

export interface ScanResult {
  ok: boolean;
  findings: Finding[];
  counts: { index: number; untracked: number; worktree: number; historyPaths: number; dist: number };
}

function git(root: string, args: string[], input?: string): Buffer {
  return execFileSync("git", ["-C", root, "-c", "core.quotepath=false", ...args], {
    input,
    maxBuffer: 1024 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function splitZ(buf: Buffer): string[] {
  return buf.toString("utf8").split("\0").filter((s) => s.length > 0);
}

/** Reads blob contents for index entries via `git cat-file --batch` (works even if the working file was deleted). */
function readBlobs(root: string, oids: string[]): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  if (oids.length === 0) return out;
  const raw = git(root, ["cat-file", "--batch"], oids.join("\n") + "\n");
  let pos = 0;
  for (const oid of oids) {
    const nl = raw.indexOf(0x0a, pos);
    const header = raw.subarray(pos, nl).toString("utf8");
    const parts = header.split(" ");
    if (parts[1] === "missing") {
      pos = nl + 1;
      continue;
    }
    const size = Number(parts[2]);
    out.set(oid, raw.subarray(nl + 1, nl + 1 + size));
    pos = nl + 1 + size + 1;
  }
  return out;
}

function walk(dir: string, skip: (absDir: string, name: string) => boolean = () => false): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skip(p, entry.name)) out.push(...walk(p, skip));
    } else if (entry.isFile()) out.push(p);
  }
  return out;
}

export function scanRepository(options: ScanOptions): ScanResult {
  const { root } = options;
  const maxBytes = options.maxUnknownBinaryBytes ?? DEFAULT_MAX_UNKNOWN_BINARY_BYTES;
  const allowLarge = new Set(options.allowLargeBinaries ?? []);
  const findings: Finding[] = [];

  const inspectBytes = (where: Finding["where"], path: string, bytes: Uint8Array, size: number): void => {
    const content = checkContent(bytes);
    if (content) findings.push({ where, path, ...content });
    else if (size > maxBytes && isBinary(bytes) && !allowLarge.has(path)) {
      findings.push({ where, path, code: "large-unknown-binary", detail: `${size} bytes binary exceeds ${maxBytes} without review` });
    }
  };

  // 1. Git index (staged content, read from blobs).
  const stage = splitZ(git(root, ["ls-files", "-s", "-z"]));
  const indexEntries = stage.map((line) => {
    const tab = line.indexOf("\t");
    const [, oid] = line.slice(0, tab).split(" ");
    return { oid: oid as string, path: line.slice(tab + 1) };
  });
  const blobs = readBlobs(root, [...new Set(indexEntries.map((e) => e.oid))]);
  for (const e of indexEntries) {
    const p = checkPath(e.path);
    if (p) findings.push({ where: "index", path: e.path, ...p });
    const b = blobs.get(e.oid);
    if (b) inspectBytes("index", e.path, b, b.length);
  }

  // 2. Untracked, not-ignored working-tree files (what `git add -A` would pick up).
  const untracked = splitZ(git(root, ["ls-files", "--others", "--exclude-standard", "-z"]));
  for (const rel of untracked) {
    const p = checkPath(rel);
    if (p) findings.push({ where: "untracked", path: rel, ...p });
    const abs = join(root, rel);
    if (existsSync(abs)) {
      const bytes = readFileSync(abs);
      inspectBytes("untracked", rel, bytes, bytes.length);
    }
  }

  // 2b. Whole working tree, including git-ignored files: RO formats / raw audio may only live
  //     in the local asset cache. (Secrets such as .env.local are allowed on disk when ignored.)
  const localDirs = new Set((options.localAssetDirs ?? [".local-assets"]).map((d) => join(root, d)));
  const distAbs = new Set((options.distDirs ?? []).map((d) => join(root, d)));
  const worktreeFiles = walk(root, (abs, name) => ALWAYS_SKIP_DIRS.has(name) || localDirs.has(abs) || distAbs.has(abs));
  const tracked = new Set([...indexEntries.map((e) => e.path), ...untracked]);
  for (const file of worktreeFiles) {
    const rel = relative(root, file).split(sep).join("/");
    if (tracked.has(rel)) continue;
    const p = checkPath(rel);
    if (p && (p.code === "blocked-extension" || p.code === "blocked-audio")) findings.push({ where: "worktree", path: rel, ...p });
  }

  // 3. Every path ever recorded in Git objects (history), so a deleted GRF still fails.
  let historyPaths: string[] = [];
  const hasCommits = (() => {
    try {
      git(root, ["rev-parse", "--verify", "-q", "HEAD"]);
      return true;
    } catch {
      return false;
    }
  })();
  if (hasCommits) {
    const lines = git(root, ["rev-list", "--objects", "--all"]).toString("utf8").split("\n");
    historyPaths = [...new Set(lines.map((l) => l.slice(41)).filter((p) => p.length > 0))];
    const current = new Set(indexEntries.map((e) => e.path));
    for (const hp of historyPaths) {
      if (current.has(hp)) continue;
      const p = checkPath(hp);
      if (p) findings.push({ where: "history", path: hp, ...p });
    }
  }

  // 4. Release output.
  let distCount = 0;
  for (const d of options.distDirs ?? []) {
    const abs = join(root, d);
    if (!existsSync(abs) || !statSync(abs).isDirectory()) continue;
    for (const file of walk(abs)) {
      distCount += 1;
      const rel = relative(root, file).split(sep).join("/");
      const p = checkPath(rel);
      if (p) findings.push({ where: "dist", path: rel, ...p });
      const bytes = readFileSync(file);
      inspectBytes("dist", rel, bytes, bytes.length);
    }
  }

  return {
    ok: findings.length === 0,
    findings,
    counts: { index: indexEntries.length, untracked: untracked.length, worktree: worktreeFiles.length, historyPaths: historyPaths.length, dist: distCount },
  };
}
