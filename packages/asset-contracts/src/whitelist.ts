import { WHITELIST_COLUMNS, whitelistRowSchema, type WhitelistRow } from "@ro-survivor/content-schema";
import { parseCsvRecords } from "./csv.ts";
import { bytesToHex, decodeCp949, encodeCp949, hexToBytes } from "./cp949.ts";
import { canonicalPathToRequestUri, requestUriToCanonicalPath } from "./uri.ts";

/** Canonical-path key: separators normalised to "\\", ASCII letters lower-cased (RO archive lookups ignore ASCII case). */
export function canonicalKey(path: string): string {
  return path.replaceAll("/", "\\").replace(/[A-Z]/gu, (ch) => ch.toLowerCase());
}

export class AssetWhitelist {
  readonly #rows: ReadonlyMap<string, WhitelistRow>;
  readonly #byPath: ReadonlyMap<string, string>;

  constructor(rows: readonly WhitelistRow[]) {
    const map = new Map<string, WhitelistRow>();
    const byPath = new Map<string, string>();
    for (const row of rows) {
      if (map.has(row.asset_id)) throw new Error(`duplicate asset_id ${row.asset_id}`);
      const key = `${row.source_container}|${canonicalKey(row.canonical_cp949_path)}`;
      if (byPath.has(key)) throw new Error(`duplicate canonical path ${row.canonical_cp949_path}`);
      map.set(row.asset_id, row);
      byPath.set(key, row.asset_id);
    }
    this.#rows = map;
    this.#byPath = byPath;
  }

  /** Asset ID of a canonical archive path (e.g. "data\\texture\\워터\\water100.jpg"), or null. */
  idForCanonicalPath(path: string, container = "data.grf"): string | null {
    return this.#byPath.get(`${container}|${canonicalKey(path)}`) ?? null;
  }

  static fromCsv(text: string): AssetWhitelist {
    const { header, records } = parseCsvRecords(text);
    if (header.join(",") !== WHITELIST_COLUMNS.join(",")) {
      throw new Error(`whitelist header mismatch: ${header.join(",")}`);
    }
    return new AssetWhitelist(records.map((r, i) => {
      const parsed = whitelistRowSchema.safeParse(r);
      if (!parsed.success) throw new Error(`whitelist row ${i + 2}: ${parsed.error.message}`);
      return parsed.data;
    }));
  }

  get size(): number {
    return this.#rows.size;
  }

  has(assetId: string): boolean {
    return this.#rows.has(assetId);
  }

  get(assetId: string): WhitelistRow {
    const row = this.#rows.get(assetId);
    if (!row) throw new UnknownAssetError(assetId);
    return row;
  }

  ids(): string[] {
    return [...this.#rows.keys()];
  }

  rows(): WhitelistRow[] {
    return [...this.#rows.values()];
  }
}

export class UnknownAssetError extends Error {
  readonly assetId: string;

  constructor(assetId: string) {
    super(`asset id is not in the fan-local whitelist: ${assetId}`);
    this.assetId = assetId;
    this.name = "UnknownAssetError";
  }
}

export interface RoundTripIssue {
  assetId: string;
  check: "cp949-hex" | "request-uri";
  detail: string;
}

/** Verify CP949 raw hex <-> canonical path and request URI <-> canonical path for every row. */
export function checkWhitelistRoundTrips(list: AssetWhitelist): RoundTripIssue[] {
  const issues: RoundTripIssue[] = [];
  for (const row of list.rows()) {
    if (row.raw_name_hex !== "") {
      try {
        const decoded = decodeCp949(hexToBytes(row.raw_name_hex));
        const reencoded = bytesToHex(encodeCp949(row.canonical_cp949_path));
        if (decoded !== row.canonical_cp949_path) {
          issues.push({ assetId: row.asset_id, check: "cp949-hex", detail: `hex decodes to ${decoded}` });
        } else if (reencoded !== row.raw_name_hex) {
          issues.push({ assetId: row.asset_id, check: "cp949-hex", detail: `path encodes to ${reencoded}` });
        }
      } catch (err) {
        issues.push({ assetId: row.asset_id, check: "cp949-hex", detail: String(err) });
      }
    }
    try {
      const uri = canonicalPathToRequestUri(row.canonical_cp949_path);
      const back = requestUriToCanonicalPath(row.normalized_request_path);
      if (uri !== row.normalized_request_path || back !== row.canonical_cp949_path) {
        issues.push({ assetId: row.asset_id, check: "request-uri", detail: `expected ${uri}` });
      }
    } catch (err) {
      issues.push({ assetId: row.asset_id, check: "request-uri", detail: String(err) });
    }
  }
  return issues;
}
