import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { parseCsvRecords } from "@ro-survivor/asset-contracts";
import {
  legacyPublicReferenceSnapshotEnvelopeSchema,
  publicReferenceSnapshotSchema,
  referenceIndexSchema,
  referenceLedgerRecordSchema,
  type PublicReferenceSnapshot,
  type ReferenceIndex,
} from "@ro-survivor/content-schema";

const INDEX_PATH = "docs/product-plan/handoff/reference-index.json";
const LEGACY_SNAPSHOT = {
  path: "docs/product-plan/handoff/reference-snapshot-2026-11-17.json",
  bytes: 8281,
  sha256: "65B8764394D20FEEDE5406BA6108D237155D238E1FA0C4387B30F5E2E80D4096",
};
const LEGACY_LEDGER = {
  path: "docs/product-plan/reference-ledger.csv",
  bytes: 7624,
  sha256: "B22FD4AD7F2605AF3F72E82B660323748AA9E031C4C7BF57ACF5FA43BBFC8077",
  rows: 20,
};
export const REFERENCE_LEDGER_HEADER = [
  "observation_id", "observed_at", "source_type", "source_url", "source_version", "region_language", "claim",
  "evidence_method", "confidence", "copyright_class", "design_action", "our_decision", "test_id", "review_status",
] as const;
const MAX_REFERENCE_BYTES = 1024 * 1024;
const MAX_LEDGER_ROWS = 10_000;
const RUNTIME_REFERENCE_SIGNAL = /reference-(?:index|snapshot|ledger(?:-delta)?)|tools[\\/]reference/iu;
const RUNTIME_REFERENCE_CONTRACT = "packages/content-schema/src/publicReference.ts";

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex").toUpperCase();

function isContained(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`));
}

function safeFilePath(repoRoot: string, repoRelative: string, errors: string[]): string | null {
  if (repoRelative === "" || repoRelative.includes("\\") || repoRelative.includes("\0") || isAbsolute(repoRelative) || /^[A-Za-z]:/u.test(repoRelative)) {
    errors.push(`unsafe indexed path ${JSON.stringify(repoRelative)}`);
    return null;
  }
  const segments = repoRelative.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    errors.push(`unsafe indexed path segments ${repoRelative}`);
    return null;
  }
  const path = resolve(repoRoot, repoRelative);
  if (!isContained(resolve(repoRoot), path)) {
    errors.push(`indexed path escapes repository ${repoRelative}`);
    return null;
  }
  if (!existsSync(path)) {
    errors.push(`missing indexed file ${repoRelative}`);
    return null;
  }
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    errors.push(`indexed path is not a regular non-symlink file ${repoRelative}`);
    return null;
  }
  const realRoot = realpathSync(repoRoot);
  const real = realpathSync(path);
  if (!isContained(realRoot, real)) {
    errors.push(`indexed real path escapes repository ${repoRelative}`);
    return null;
  }
  return path;
}

function duplicateJsonKeys(text: string): string[] {
  let offset = 0;
  const duplicates: string[] = [];
  const skipWhitespace = (): void => {
    while (offset < text.length && /\s/u.test(text[offset] ?? "")) offset += 1;
  };
  const parseString = (): string => {
    const start = offset;
    offset += 1;
    while (offset < text.length) {
      const char = text[offset];
      offset += 1;
      if (char === "\\") offset += 1;
      else if (char === "\"") break;
    }
    return JSON.parse(text.slice(start, offset)) as string;
  };
  const parseValue = (path: string[]): void => {
    skipWhitespace();
    if (text[offset] === "{") {
      offset += 1;
      skipWhitespace();
      const keys = new Set<string>();
      if (text[offset] === "}") {
        offset += 1;
        return;
      }
      while (offset < text.length) {
        skipWhitespace();
        const key = parseString();
        if (keys.has(key)) duplicates.push([...path, key].join("."));
        keys.add(key);
        skipWhitespace();
        offset += 1;
        parseValue([...path, key]);
        skipWhitespace();
        const separator = text[offset];
        offset += 1;
        if (separator === "}") return;
      }
      return;
    }
    if (text[offset] === "[") {
      offset += 1;
      skipWhitespace();
      if (text[offset] === "]") {
        offset += 1;
        return;
      }
      let item = 0;
      while (offset < text.length) {
        parseValue([...path, String(item)]);
        item += 1;
        skipWhitespace();
        const separator = text[offset];
        offset += 1;
        if (separator === "]") return;
      }
      return;
    }
    if (text[offset] === "\"") {
      parseString();
      return;
    }
    while (offset < text.length && !/[\s,\]}]/u.test(text[offset] ?? "")) offset += 1;
  };
  parseValue([]);
  return duplicates;
}

function parseJson(bytes: Buffer, label: string, errors: string[]): unknown {
  if (bytes.length > MAX_REFERENCE_BYTES) {
    errors.push(`${label} exceeds ${MAX_REFERENCE_BYTES} bytes`);
    return null;
  }
  if (bytes.includes(0)) {
    errors.push(`${label} contains NUL bytes`);
    return null;
  }
  try {
    const text = bytes.toString("utf8");
    const value = JSON.parse(text) as unknown;
    const duplicates = duplicateJsonKeys(text);
    if (duplicates.length > 0) {
      errors.push(`${label} contains duplicate JSON keys: ${duplicates.join(", ")}`);
      return null;
    }
    return value;
  } catch (err) {
    errors.push(`${label} is not valid JSON: ${String(err)}`);
    return null;
  }
}

function hasForbiddenControlCharacter(text: string): boolean {
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) return true;
  }
  return false;
}

interface IndexedBytes {
  bytes: Buffer;
  path: string;
}

function readAndVerifyIndexed(
  repoRoot: string,
  entry: { path: string; bytes: number; sha256: string },
  errors: string[],
): IndexedBytes | null {
  const path = safeFilePath(repoRoot, entry.path, errors);
  if (!path) return null;
  const bytes = readFileSync(path);
  if (bytes.length !== entry.bytes) errors.push(`${entry.path} bytes ${bytes.length} != index ${entry.bytes}`);
  const worktreeHash = sha256(bytes);
  if (worktreeHash !== entry.sha256) errors.push(`${entry.path} worktree SHA-256 ${worktreeHash} != index ${entry.sha256}`);
  try {
    const blob = execFileSync("git", ["-C", repoRoot, "cat-file", "blob", `:${entry.path}`], { stdio: ["ignore", "pipe", "pipe"] });
    const blobHash = sha256(blob);
    if (blob.length !== entry.bytes) errors.push(`${entry.path} Git blob bytes ${blob.length} != index ${entry.bytes}`);
    if (blobHash !== entry.sha256) errors.push(`${entry.path} Git blob SHA-256 ${blobHash} != index ${entry.sha256}`);
  } catch (err) {
    errors.push(`${entry.path} cannot read staged Git blob: ${String(err).split("\n")[0] ?? ""}`);
  }
  return { bytes, path };
}

function validateLedgerUrl(value: string, sourceType: string, legacy: boolean): boolean {
  if (legacy && value.startsWith("local://design-decision/")) return sourceType === "playtest";
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "" || url.port !== "" || url.search !== "" || url.hash !== "") return false;
  if (legacy) return true;
  if (/(?:^|\/)build(?:\/|$)|\.(?:mjs|cjs|js|map)$/iu.test(url.pathname)) return false;
  if (sourceType === "official") return url.hostname === "ro-survivors.com" || url.hostname === "www.ro-survivors.com";
  if (sourceType === "hans") return url.hostname === "ro.hans-webgametw.com";
  return true;
}

function allSourceFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) out.push(...allSourceFiles(path));
    else if (entry.isFile() && /\.(?:ts|tsx|js|mjs)$/u.test(entry.name)) out.push(path);
  }
  return out;
}

function runtimeSourceRoots(repoRoot: string): string[] {
  const roots = [join(repoRoot, "tools/slice")];
  for (const parent of ["apps", "packages"]) {
    const parentPath = join(repoRoot, parent);
    if (!existsSync(parentPath)) continue;
    for (const entry of readdirSync(parentPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const src = join(parentPath, entry.name, "src");
      if (existsSync(src)) roots.push(src);
    }
  }
  return roots;
}

export interface ReferenceValidationStats {
  snapshots: number;
  ledgerSegments: number;
  observations: number;
  activeSnapshotId: string | null;
}

export interface ReferenceValidation {
  index: ReferenceIndex | null;
  activeSnapshot: PublicReferenceSnapshot | null;
  errors: string[];
  stats: ReferenceValidationStats;
}

/** Fully offline, fail-closed validation of the append-only public reference pack. */
export function validateReferencePack(repoRoot: string): ReferenceValidation {
  const errors: string[] = [];
  const stats: ReferenceValidationStats = { snapshots: 0, ledgerSegments: 0, observations: 0, activeSnapshotId: null };
  const indexPath = safeFilePath(repoRoot, INDEX_PATH, errors);
  if (!indexPath) return { index: null, activeSnapshot: null, errors, stats };
  const indexBytes = readFileSync(indexPath);
  try {
    const stagedIndex = execFileSync("git", ["-C", repoRoot, "cat-file", "blob", `:${INDEX_PATH}`], { stdio: ["ignore", "pipe", "pipe"] });
    if (!indexBytes.equals(stagedIndex)) errors.push(`${INDEX_PATH} worktree bytes differ from the staged Git blob`);
  } catch (err) {
    errors.push(`${INDEX_PATH} cannot read staged Git blob: ${String(err).split("\n")[0] ?? ""}`);
  }
  const indexJson = parseJson(indexBytes, INDEX_PATH, errors);
  if (indexJson === null) return { index: null, activeSnapshot: null, errors, stats };
  const parsedIndex = referenceIndexSchema.safeParse(indexJson);
  if (!parsedIndex.success) {
    errors.push(...parsedIndex.error.issues.map((issue) => `${INDEX_PATH}:${issue.path.join(".")}: ${issue.message}`));
    return { index: null, activeSnapshot: null, errors, stats };
  }
  const index = parsedIndex.data;
  stats.snapshots = index.snapshots.length;
  stats.ledgerSegments = index.ledgerSegments.length;
  stats.activeSnapshotId = index.activeSnapshotId;

  const caseFoldedPaths = new Set<string>();
  for (const path of [...index.snapshots.map((entry) => entry.path), ...index.ledgerSegments.map((entry) => entry.path), index.integrationPlan.path]) {
    const folded = path.toLowerCase();
    if (caseFoldedPaths.has(folded)) errors.push(`case-insensitive duplicate indexed path ${path}`);
    caseFoldedPaths.add(folded);
  }

  const integrationPlan = readAndVerifyIndexed(repoRoot, index.integrationPlan, errors);
  if (integrationPlan && integrationPlan.bytes.includes(0)) errors.push(`${index.integrationPlan.path} contains NUL bytes`);

  const snapshots = new Map<string, { observedAt: string; supersedes: string | null; active: PublicReferenceSnapshot | null }>();
  for (const entry of index.snapshots) {
    const file = readAndVerifyIndexed(repoRoot, entry, errors);
    if (!file) continue;
    const json = parseJson(file.bytes, entry.path, errors);
    if (json === null || typeof json !== "object" || !("schemaVersion" in json)) {
      if (json !== null) errors.push(`${entry.path} lacks schemaVersion`);
      continue;
    }
    const schemaVersion = (json as { schemaVersion?: unknown }).schemaVersion;
    if (schemaVersion === 1) {
      const legacy = legacyPublicReferenceSnapshotEnvelopeSchema.safeParse(json);
      if (!legacy.success) {
        errors.push(...legacy.error.issues.map((issue) => `${entry.path}:${issue.path.join(".")}: ${issue.message}`));
        continue;
      }
      if (entry.path !== LEGACY_SNAPSHOT.path || entry.bytes !== LEGACY_SNAPSHOT.bytes || entry.sha256 !== LEGACY_SNAPSHOT.sha256) {
        errors.push("the immutable 2026-11-17 snapshot is not pinned to its canonical path, bytes and SHA-256");
      }
      if (legacy.data.snapshotId !== entry.id || legacy.data.observedAt !== entry.observedAt) errors.push(`${entry.path} envelope does not match index entry`);
      snapshots.set(entry.id, { observedAt: legacy.data.observedAt, supersedes: null, active: null });
    } else if (schemaVersion === 2) {
      const current = publicReferenceSnapshotSchema.safeParse(json);
      if (!current.success) {
        errors.push(...current.error.issues.map((issue) => `${entry.path}:${issue.path.join(".")}: ${issue.message}`));
        continue;
      }
      if (current.data.snapshotId !== entry.id || current.data.observedAt !== entry.observedAt) errors.push(`${entry.path} envelope does not match index entry`);
      snapshots.set(entry.id, { observedAt: current.data.observedAt, supersedes: current.data.supersedesSnapshotId, active: current.data });
    } else errors.push(`${entry.path} has unsupported schemaVersion ${String(schemaVersion)}`);
  }

  for (const [id, snapshot] of snapshots) {
    if (snapshot.supersedes === null) continue;
    const prior = snapshots.get(snapshot.supersedes);
    if (!prior) errors.push(`${id} supersedes unknown snapshot ${snapshot.supersedes}`);
    else if (Date.parse(prior.observedAt) >= Date.parse(snapshot.observedAt)) errors.push(`${id} does not supersede an older snapshot`);
    const seen = new Set([id]);
    let cursor: string | null = snapshot.supersedes;
    while (cursor !== null) {
      if (seen.has(cursor)) {
        errors.push(`snapshot supersedes cycle at ${cursor}`);
        break;
      }
      seen.add(cursor);
      cursor = snapshots.get(cursor)?.supersedes ?? null;
    }
  }
  const activeSnapshot = snapshots.get(index.activeSnapshotId)?.active ?? null;
  if (!activeSnapshot) errors.push(`active snapshot ${index.activeSnapshotId} is not a valid schemaVersion 2 snapshot`);

  const observationIds = new Set<string>();
  const observationIdsFolded = new Set<string>();
  const observationSourceTypes = new Map<string, string>();
  for (const segment of index.ledgerSegments) {
    const file = readAndVerifyIndexed(repoRoot, segment, errors);
    if (!file) continue;
    const legacy = segment.path === LEGACY_LEDGER.path;
    if (legacy && (segment.bytes !== LEGACY_LEDGER.bytes || segment.sha256 !== LEGACY_LEDGER.sha256 || segment.rowCount !== LEGACY_LEDGER.rows)) {
      errors.push("the immutable 2026-11-17 ledger is not pinned to its canonical path, bytes, rows and SHA-256");
    }
    if (file.bytes.length > MAX_REFERENCE_BYTES) {
      errors.push(`${segment.path} exceeds ${MAX_REFERENCE_BYTES} bytes`);
      continue;
    }
    if (file.bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) errors.push(`${segment.path} must not contain a UTF-8 BOM`);
    const text = file.bytes.toString("utf8");
    if (hasForbiddenControlCharacter(text)) errors.push(`${segment.path} contains forbidden control characters`);
    let parsed: ReturnType<typeof parseCsvRecords>;
    try {
      parsed = parseCsvRecords(text);
    } catch (err) {
      errors.push(`${segment.path} invalid CSV: ${String(err)}`);
      continue;
    }
    if (parsed.header.length !== REFERENCE_LEDGER_HEADER.length || parsed.header.some((field, i) => field !== REFERENCE_LEDGER_HEADER[i])) {
      errors.push(`${segment.path} header does not exactly match the reference ledger contract`);
    }
    if (parsed.records.length !== segment.rowCount) errors.push(`${segment.path} rows ${parsed.records.length} != index ${segment.rowCount}`);
    if (parsed.records.length > MAX_LEDGER_ROWS) errors.push(`${segment.path} exceeds ${MAX_LEDGER_ROWS} rows`);
    for (const [rowIndex, record] of parsed.records.entries()) {
      const parsedRecord = referenceLedgerRecordSchema.safeParse(record);
      if (!parsedRecord.success) {
        errors.push(...parsedRecord.error.issues.map((issue) => `${segment.path}:row${rowIndex + 2}:${issue.path.join(".")}: ${issue.message}`));
        continue;
      }
      const row = parsedRecord.data;
      if (!validateLedgerUrl(row.source_url, row.source_type, legacy)) errors.push(`${segment.path}:row${rowIndex + 2}: unsafe source_url ${row.source_url}`);
      if (!legacy && Object.values(row).some((value) => /^[=+@-]/u.test(value))) errors.push(`${segment.path}:row${rowIndex + 2}: spreadsheet-formula-like field`);
      const folded = row.observation_id.toLowerCase();
      if (observationIdsFolded.has(folded)) errors.push(`duplicate observation_id across ledger segments ${row.observation_id}`);
      observationIds.add(row.observation_id);
      observationIdsFolded.add(folded);
      observationSourceTypes.set(row.observation_id, row.source_type);
    }
  }
  stats.observations = observationIds.size;

  if (activeSnapshot) {
    const decisions = new Map(activeSnapshot.proposedDesignCandidates.map((decision) => [decision.candidateId, decision]));
    for (const announcement of activeSnapshot.announcements) {
      for (const id of announcement.supersedesObservationIds) if (!observationIds.has(id)) errors.push(`${announcement.announcementId} supersedes unknown observation ${id}`);
    }
    for (const decision of activeSnapshot.proposedDesignCandidates) {
      for (const id of decision.observationIds) if (!observationIds.has(id)) errors.push(`${decision.candidateId} cites unknown observation ${id}`);
      if (decision.contentOverlayRef) {
        const overlayPath = safeFilePath(repoRoot, decision.contentOverlayRef, errors);
        if (overlayPath) {
          try {
            execFileSync("git", ["-C", repoRoot, "cat-file", "-e", `:${decision.contentOverlayRef}`], { stdio: "ignore" });
          } catch {
            errors.push(`${decision.candidateId} overlay is not present in the staged Git index: ${decision.contentOverlayRef}`);
          }
        }
      }
    }
    for (const comparison of activeSnapshot.variantComparisons) {
      for (const id of comparison.officialObservationIds) {
        if (!observationIds.has(id)) errors.push(`${comparison.featureId} cites unknown observation ${id}`);
        else if (observationSourceTypes.get(id) !== "official") errors.push(`${comparison.featureId} official observation ${id} is not from an official source`);
      }
      for (const id of comparison.hansObservationIds) {
        if (!observationIds.has(id)) errors.push(`${comparison.featureId} cites unknown observation ${id}`);
        else if (observationSourceTypes.get(id) !== "hans") errors.push(`${comparison.featureId} HANS observation ${id} is not from a HANS source`);
      }
      if (comparison.resolutionDecisionId !== null) {
        const resolution = decisions.get(comparison.resolutionDecisionId);
        if (!resolution || resolution.status !== "accepted") {
          errors.push(`${comparison.featureId} conflict resolution must reference an accepted fan-local decision`);
        }
      }
    }
  }

  const handoff = join(repoRoot, "docs/product-plan/handoff");
  const indexedSnapshots = new Set(index.snapshots.map((entry) => entry.path));
  const indexedDeltas = new Set(index.ledgerSegments.filter((entry) => entry.path.includes("/handoff/")).map((entry) => entry.path));
  for (const name of readdirSync(handoff)) {
    const rel = `docs/product-plan/handoff/${name}`;
    if (/^reference-snapshot-.*\.json$/u.test(name) && !indexedSnapshots.has(rel)) errors.push(`unindexed reference snapshot ${rel}`);
    if (/^reference-ledger-delta-.*\.csv$/u.test(name) && !indexedDeltas.has(rel)) errors.push(`unindexed reference ledger delta ${rel}`);
  }

  for (const root of runtimeSourceRoots(repoRoot)) {
    for (const file of allSourceFiles(root)) {
      const repoRelative = relative(repoRoot, file).replaceAll("\\", "/");
      if (repoRelative === RUNTIME_REFERENCE_CONTRACT) continue;
      if (RUNTIME_REFERENCE_SIGNAL.test(readFileSync(file, "utf8"))) errors.push(`runtime source may not import public reference pack: ${repoRelative}`);
    }
  }

  return { index, activeSnapshot, errors, stats };
}
