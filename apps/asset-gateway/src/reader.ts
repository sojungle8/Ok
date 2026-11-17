import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import type { SourceLockLocal, WhitelistRow } from "@ro-survivor/content-schema";
import { openGrf, type GrfArchive, type GrfEntry } from "@ro-survivor/ro-format-runtime/grf";

export class AssetReadError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AssetReadError";
    this.status = status;
  }
}

export interface AssetRead {
  bytes: Uint8Array;
  /** Hash of the container the bytes came from (GRF SHA-256 or BGM manifest SHA-256). */
  sourceSha256: string;
  entrySha256: string;
  container: "data.grf" | "rdata.grf" | "bgm";
  entry: GrfEntry | null;
}

const sha = (b: Uint8Array): string => createHash("sha256").update(b).digest("hex").toUpperCase();

/**
 * Read-only access to whitelisted assets from the verified lock. Lookups use raw CP949 hex only;
 * the archive table is never enumerated for callers. Size (and SHA-256 when listed) must match.
 */
export function createAssetReader(lock: SourceLockLocal, options: { maxAssetBytes?: number } = {}) {
  const maxBytes = options.maxAssetBytes ?? 64 * 1024 * 1024;
  for (const id of ["data.grf", "rdata.grf"] as const) {
    const s = lock.sources[id];
    if (!existsSync(s.path) || statSync(s.path).size !== s.bytes) {
      throw new Error(`${id} at the locked path is missing or its size changed; re-run pnpm assets:verify-sources`);
    }
  }
  const archives: Partial<Record<"data.grf" | "rdata.grf", GrfArchive>> = {};
  const archive = (id: "data.grf" | "rdata.grf"): GrfArchive => (archives[id] ??= openGrf(lock.sources[id].path));
  const sourceHashes = { "data.grf": lock.sources["data.grf"].sha256, "rdata.grf": lock.sources["rdata.grf"].sha256, bgm: lock.sources.bgm.manifestSha256 };

  return {
    sourceHashes,
    /** Whether rdata.grf holds an entry with the same raw name (an override the whitelist must declare). */
    hasRdataOverride(row: WhitelistRow): boolean {
      return row.raw_name_hex !== "" && archive("rdata.grf").byRawHex.has(row.raw_name_hex);
    },
    read(row: WhitelistRow): AssetRead {
      if (row.source_container === "filesystem:BGM") {
        const name = basename(row.canonical_cp949_path.replaceAll("\\", "/"));
        const file = lock.sources.bgm.files.find((f) => f.name.toLowerCase() === name.toLowerCase());
        if (!file) throw new AssetReadError(404, `BGM ${name} is not in the verified manifest`);
        const bytes = readFileSync(join(lock.sources.bgm.path, file.name));
        const entrySha256 = sha(bytes);
        if (entrySha256 !== file.sha256) throw new AssetReadError(409, `BGM ${name} changed since assets:verify-sources`);
        if (bytes.length !== row.bytes) throw new AssetReadError(409, `${row.asset_id} is ${bytes.length} bytes, whitelist says ${row.bytes}`);
        if (row.sha256 !== "" && entrySha256 !== row.sha256.toUpperCase()) throw new AssetReadError(409, `${row.asset_id} SHA-256 differs from the whitelist`);
        return { bytes, sourceSha256: sourceHashes.bgm, entrySha256, container: "bgm", entry: null };
      }
      const id = row.rdata_override === "true" ? "rdata.grf" : "data.grf";
      const entry = archive(id).byRawHex.get(row.raw_name_hex);
      if (!entry) throw new AssetReadError(404, `${row.asset_id} not found in ${id} by raw hex`);
      if (entry.realSize !== row.bytes) throw new AssetReadError(409, `${row.asset_id} is ${entry.realSize} bytes in ${id}, whitelist says ${row.bytes}`);
      if (entry.realSize > maxBytes) throw new AssetReadError(413, `${row.asset_id} exceeds ${maxBytes} bytes`);
      const bytes = archive(id).read(entry);
      const entrySha256 = sha(bytes);
      if (row.sha256 !== "" && entrySha256 !== row.sha256.toUpperCase()) throw new AssetReadError(409, `${row.asset_id} SHA-256 differs from the whitelist`);
      return { bytes, sourceSha256: sourceHashes[id], entrySha256, container: id, entry };
    },
    close(): void {
      for (const a of Object.values(archives)) a.close();
    },
  };
}
export type AssetReader = ReturnType<typeof createAssetReader>;
