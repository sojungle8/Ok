/**
 * Whitelist proposal (local only). Resolves candidate canonical paths against the user's own verified
 * GRF archives, records bytes + SHA-256 of the exact entry, and emits *proposed* whitelist rows for
 * Codex review. It never edits the hash-locked canonical whitelist and never copies asset bytes out of
 * the archive; outputs go to git-ignored reports/local/.
 */
import { createHash } from "node:crypto";
import { bytesToHex, canonicalPathToRequestUri, encodeCp949 } from "@ro-survivor/asset-contracts";
import { WHITELIST_COLUMNS } from "@ro-survivor/content-schema";
import type { GrfArchive, GrfEntry } from "@ro-survivor/ro-format-runtime/grf";

export interface Candidate {
  asset_id: string;
  category: string;
  canonical_cp949_path: string;
  source_id?: string;
  source_key?: string;
  required?: boolean;
  notes: string;
}
export interface CandidateFile {
  job: string;
  description: string;
  candidates: Candidate[];
  /** Case-insensitive regex sources used to discover real names (e.g. skill WAV/effect files). */
  discover?: { label: string; pattern: string }[];
}
export type ArchiveId = "data.grf" | "rdata.grf";
export interface ProposedRow { row: Record<(typeof WHITELIST_COLUMNS)[number], string>; overriddenByRdata: boolean }
export interface MissingCandidate { asset_id: string; canonical_cp949_path: string; reason: string }

const norm = (name: string): string => name.replaceAll("/", "\\").toLowerCase();

function index(grf: GrfArchive): Map<string, GrfEntry> {
  const m = new Map<string, GrfEntry>();
  for (const e of grf.byRawHex.values()) m.set(norm(e.name), e);
  return m;
}

const sha = (b: Uint8Array): string => createHash("sha256").update(b).digest("hex").toUpperCase();

function actInfo(bytes: Uint8Array): { version: string; actions: string } {
  if (bytes.length < 6 || bytes[0] !== 0x41 || bytes[1] !== 0x43) return { version: "", actions: "" };
  const minor = bytes[2] ?? 0;
  const major = bytes[3] ?? 0;
  const actions = (bytes[4] ?? 0) | ((bytes[5] ?? 0) << 8);
  return { version: `${major}.${minor}`, actions: String(actions) };
}

export function validateCandidates(file: CandidateFile, existingIds: ReadonlySet<string>): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const c of file.candidates) {
    if (!/^[a-z0-9_]+(?:\.[a-z0-9_]+)+$/u.test(c.asset_id)) errors.push(`${c.asset_id}: asset_id must be dotted lowercase`);
    if (seen.has(c.asset_id)) errors.push(`${c.asset_id}: duplicate candidate`);
    if (existingIds.has(c.asset_id)) errors.push(`${c.asset_id}: already in the canonical whitelist`);
    if (!/^data\\[^/]+$/iu.test(c.canonical_cp949_path) || c.canonical_cp949_path.includes("..")) errors.push(`${c.asset_id}: canonical path must be a data\\ archive path`);
    if (c.notes.trim() === "") errors.push(`${c.asset_id}: notes required`);
    seen.add(c.asset_id);
  }
  for (const d of file.discover ?? []) {
    try {
      new RegExp(d.pattern, "iu");
    } catch {
      errors.push(`discover ${d.label}: invalid pattern`);
    }
  }
  return errors;
}

/** Resolve candidates in data.grf (rdata.grf same-name entries are flagged, as the client prefers them). */
export function propose(archives: Partial<Record<ArchiveId, GrfArchive>>, file: CandidateFile): { rows: ProposedRow[]; missing: MissingCandidate[]; discovered: Record<string, string[]> } {
  const data = archives["data.grf"];
  if (!data) throw new Error("data.grf is required");
  const dataIdx = index(data);
  const rdataIdx = archives["rdata.grf"] ? index(archives["rdata.grf"]) : new Map<string, GrfEntry>();
  const rows: ProposedRow[] = [];
  const missing: MissingCandidate[] = [];
  for (const c of file.candidates) {
    const entry = dataIdx.get(norm(c.canonical_cp949_path));
    if (!entry) {
      missing.push({ asset_id: c.asset_id, canonical_cp949_path: c.canonical_cp949_path, reason: "not found in data.grf" });
      continue;
    }
    const bytes = data.read(entry);
    const path = entry.name.replaceAll("/", "\\");
    const act = path.toLowerCase().endsWith(".act") ? actInfo(bytes) : { version: "", actions: "" };
    const overridden = rdataIdx.has(norm(path));
    rows.push({
      overriddenByRdata: overridden,
      row: {
        asset_id: c.asset_id,
        category: c.category,
        source_container: "data.grf",
        canonical_cp949_path: path,
        normalized_request_path: canonicalPathToRequestUri(path),
        raw_name_hex: bytesToHex(encodeCp949(path)),
        bytes: String(bytes.length),
        sha256: sha(bytes),
        source_id: c.source_id ?? "",
        source_key: c.source_key ?? "",
        act_version: act.version,
        act_actions: act.actions,
        required: String(c.required ?? true),
        rdata_override: String(overridden),
        notes: `PROPOSED (local discovery, needs Codex review); ${c.notes}`,
      },
    });
  }
  const discovered: Record<string, string[]> = {};
  for (const d of file.discover ?? []) {
    const re = new RegExp(d.pattern, "iu");
    discovered[d.label] = [...dataIdx.values()].map((e) => e.name.replaceAll("/", "\\")).filter((n) => re.test(n)).sort().slice(0, 200);
  }
  return { rows, missing, discovered };
}

const csvCell = (v: string): string => `"${v.replaceAll('"', '""')}"`;
export function rowsToCsv(rows: readonly ProposedRow[]): string {
  return [WHITELIST_COLUMNS.map(csvCell).join(","), ...rows.map((r) => WHITELIST_COLUMNS.map((c) => csvCell(r.row[c])).join(","))].join("\n") + "\n";
}
