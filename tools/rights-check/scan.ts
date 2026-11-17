import { execFileSync, spawn } from "node:child_process";
import { existsSync, openSync, readSync, closeSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { checkContent, checkPath, DEFAULT_MAX_UNKNOWN_BINARY_BYTES, isBinary, type Finding } from "./rules.ts";

/** Bytes read from any file or blob for magic / binary detection; large files are never fully loaded. */
export const CONTENT_PREFIX_BYTES = 64 * 1024;
/** Blobs up to this size are read through one `cat-file --batch`; larger ones are streamed and cut off. */
const SMALL_BLOB_BYTES = 1024 * 1024;
const BATCH_BUDGET_BYTES = 32 * 1024 * 1024;

/**
 * History scope:
 * - a full 40-hex commit SHA: scan objects reachable from HEAD but not from that trusted baseline
 *   (`git rev-list --objects <baseline>..HEAD`). Commits merged in later (from any branch) are in scope.
 * - `{ scanFullHistory: true }`: scan everything reachable from HEAD (fresh repositories / tests).
 */
export type HistoryScope = string | { scanFullHistory: true };

export interface ScanOptions {
  root: string;
  history: HistoryScope;
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
  baseline: string | null;
  counts: { index: number; untracked: number; worktree: number; historyObjects: number; historyBlobsInspected: number; dist: number };
}

function git(root: string, args: string[], input?: string): Buffer {
  return execFileSync("git", ["-C", root, "-c", "core.quotepath=false", ...args], {
    input,
    maxBuffer: 1024 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function gitOk(root: string, args: string[]): boolean {
  try {
    git(root, args);
    return true;
  } catch {
    return false;
  }
}

function splitZ(buf: Buffer): string[] {
  return buf.toString("utf8").split("\0").filter((s) => s.length > 0);
}

interface BlobInfo {
  type: string;
  size: number;
}

function batchCheck(root: string, oids: readonly string[]): Map<string, BlobInfo> {
  const out = new Map<string, BlobInfo>();
  if (oids.length === 0) return out;
  const lines = git(root, ["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"], oids.join("\n") + "\n")
    .toString("utf8")
    .split("\n");
  for (const line of lines) {
    const [oid, type, size] = line.split(" ");
    if (oid && type && type !== "missing" && size !== undefined) out.set(oid, { type, size: Number(size) });
  }
  return out;
}

/**
 * Read up to `limit` leading bytes of a blob by streaming `git cat-file blob` and stopping early.
 * The child is never signalled (Windows can raise EPERM when killing an exiting process): we stop
 * reading and destroy our end of the pipe, so git exits on its own; late errors are ignored.
 */
function readBlobPrefix(root: string, oid: string, limit: number): Promise<Buffer> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("git", ["-C", root, "cat-file", "blob", oid], { stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
    const chunks: Buffer[] = [];
    let total = 0;
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      child.stdout.removeAllListeners("data");
      child.stdout.destroy();
      resolvePromise(Buffer.concat(chunks).subarray(0, limit));
    };
    child.stdout.on("data", (chunk: Buffer) => {
      if (done) return;
      chunks.push(chunk);
      total += chunk.length;
      if (total >= limit) finish();
    });
    child.stdout.on("end", finish);
    child.stdout.on("error", () => {
      if (!done) finish();
    });
    child.on("error", (err) => {
      if (!done) {
        done = true;
        reject(err);
      }
    });
  });
}

/** Leading bytes (≤ CONTENT_PREFIX_BYTES) of each blob; small blobs batched, large blobs streamed. */
async function readBlobHeads(root: string, oids: readonly string[], info: Map<string, BlobInfo>): Promise<Map<string, Buffer>> {
  const out = new Map<string, Buffer>();
  const small = oids.filter((o) => (info.get(o)?.size ?? Infinity) <= SMALL_BLOB_BYTES);
  const large = oids.filter((o) => (info.get(o)?.size ?? 0) > SMALL_BLOB_BYTES);
  let group: string[] = [];
  let budget = 0;
  const flush = (): void => {
    if (group.length === 0) return;
    const raw = git(root, ["cat-file", "--batch"], group.join("\n") + "\n");
    let pos = 0;
    for (const oid of group) {
      const nl = raw.indexOf(0x0a, pos);
      const parts = raw.subarray(pos, nl).toString("utf8").split(" ");
      if (parts[1] === "missing") {
        pos = nl + 1;
        continue;
      }
      const size = Number(parts[2]);
      out.set(oid, Buffer.from(raw.subarray(nl + 1, nl + 1 + Math.min(size, CONTENT_PREFIX_BYTES))));
      pos = nl + 1 + size + 1;
    }
    group = [];
    budget = 0;
  };
  for (const oid of small) {
    const size = info.get(oid)?.size ?? 0;
    if (budget + size > BATCH_BUDGET_BYTES) flush();
    group.push(oid);
    budget += size;
  }
  flush();
  for (const oid of large) out.set(oid, await readBlobPrefix(root, oid, CONTENT_PREFIX_BYTES));
  return out;
}

function readFilePrefix(path: string): { head: Buffer; size: number } {
  const size = statSync(path).size;
  const fd = openSync(path, "r");
  try {
    const head = Buffer.alloc(Math.min(size, CONTENT_PREFIX_BYTES));
    readSync(fd, head, 0, head.length, 0);
    return { head, size };
  } finally {
    closeSync(fd);
  }
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

/** Validate the trusted baseline: full SHA, existing commit object, ancestor of HEAD. Returns an error or null. */
export function checkBaseline(root: string, baseline: string): string | null {
  if (!/^[0-9a-f]{40}$/u.test(baseline)) return `trustedHistoryBaseline must be a full 40-character lowercase SHA, got ${JSON.stringify(baseline)}`;
  let type: string;
  try {
    type = git(root, ["cat-file", "-t", baseline]).toString("utf8").trim();
  } catch {
    return `trustedHistoryBaseline ${baseline} does not exist in this repository (fetch full history)`;
  }
  if (type !== "commit") return `trustedHistoryBaseline ${baseline} is a ${type}, not a commit`;
  if (!gitOk(root, ["rev-parse", "--verify", "-q", "HEAD"])) return "HEAD does not exist";
  if (!gitOk(root, ["merge-base", "--is-ancestor", baseline, "HEAD"])) return `trustedHistoryBaseline ${baseline} is not an ancestor of HEAD`;
  return null;
}

export async function scanRepository(options: ScanOptions): Promise<ScanResult> {
  const { root } = options;
  const maxBytes = options.maxUnknownBinaryBytes ?? DEFAULT_MAX_UNKNOWN_BINARY_BYTES;
  const allowLarge = new Set(options.allowLargeBinaries ?? []);
  const findings: Finding[] = [];

  const inspectBytes = (where: Finding["where"], path: string, head: Uint8Array, size: number): void => {
    const content = checkContent(head);
    if (content) findings.push({ where, path, ...content });
    else if (size > maxBytes && isBinary(head) && !allowLarge.has(path)) {
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
  const indexOids = [...new Set(indexEntries.map((e) => e.oid))];
  const indexInfo = batchCheck(root, indexOids);
  const indexHeads = await readBlobHeads(root, indexOids, indexInfo);
  for (const e of indexEntries) {
    const p = checkPath(e.path);
    if (p) findings.push({ where: "index", path: e.path, ...p });
    const head = indexHeads.get(e.oid);
    if (head) inspectBytes("index", e.path, head, indexInfo.get(e.oid)?.size ?? head.length);
  }

  // 2. Untracked, not-ignored working-tree files (what `git add -A` would pick up).
  const untracked = splitZ(git(root, ["ls-files", "--others", "--exclude-standard", "-z"]));
  for (const rel of untracked) {
    const p = checkPath(rel);
    if (p) findings.push({ where: "untracked", path: rel, ...p });
    const abs = join(root, rel);
    if (existsSync(abs)) {
      const { head, size } = readFilePrefix(abs);
      inspectBytes("untracked", rel, head, size);
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

  // 3. History: paths AND blob bytes of objects introduced after the trusted baseline.
  let baseline: string | null = null;
  let historyObjects = 0;
  let historyBlobsInspected = 0;
  const hasHead = gitOk(root, ["rev-parse", "--verify", "-q", "HEAD"]);
  let range: string | null = null;
  if (typeof options.history === "string") {
    const err = checkBaseline(root, options.history);
    if (err) findings.push({ where: "history", path: "(baseline)", code: "history-baseline", detail: err });
    else {
      baseline = options.history;
      range = `${baseline}..HEAD`;
    }
  } else if (hasHead) {
    range = "HEAD";
  }
  if (range) {
    const lines = git(root, ["rev-list", "--objects", range]).toString("utf8").split("\n").filter((l) => l.length > 0);
    const entries = lines.map((l) => ({ oid: l.slice(0, 40), path: l.length > 41 ? l.slice(41) : "" }));
    historyObjects = entries.length;
    const currentPaths = new Set(indexEntries.map((e) => e.path));
    const currentOids = new Set(indexOids);
    const reportedPaths = new Set<string>();
    for (const e of entries) {
      if (e.path === "" || currentPaths.has(e.path) || reportedPaths.has(e.path)) continue;
      const p = checkPath(e.path);
      if (p) {
        reportedPaths.add(e.path);
        findings.push({ where: "history", path: e.path, ...p });
      }
    }
    // Content: each blob OID once, skipping blobs already inspected via the current index.
    const firstPathByOid = new Map<string, string>();
    for (const e of entries) if (e.path !== "" && !currentOids.has(e.oid) && !firstPathByOid.has(e.oid)) firstPathByOid.set(e.oid, e.path);
    const info = batchCheck(root, [...firstPathByOid.keys()]);
    const blobOids = [...firstPathByOid.keys()].filter((o) => info.get(o)?.type === "blob");
    const heads = await readBlobHeads(root, blobOids, info);
    for (const oid of blobOids) {
      const head = heads.get(oid);
      if (!head) continue;
      historyBlobsInspected += 1;
      inspectBytes("history", firstPathByOid.get(oid) as string, head, info.get(oid)?.size ?? head.length);
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
      const { head, size } = readFilePrefix(file);
      inspectBytes("dist", rel, head, size);
    }
  }

  return {
    ok: findings.length === 0,
    findings,
    baseline,
    counts: { index: indexEntries.length, untracked: untracked.length, worktree: worktreeFiles.length, historyObjects, historyBlobsInspected, dist: distCount },
  };
}
