import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { CONVERTER_VERSION } from "./paths.ts";

export class DerivedUnavailableError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "DerivedUnavailableError";
    this.status = status;
  }
}

export interface DerivedIdentity {
  converterVersion: number;
  lockId: string;
  whitelistSha256: string;
  uiProfileId: string;
  uiEntrySetSha256: string;
}

interface ManifestShape {
  converterVersion: number;
  profile: string;
  identity?: { lockId: string; whitelistSha256: string; uiProfileId: string; uiEntrySetSha256: string };
  sources: Record<string, string>;
  outputs: { file: string; sha256: string; bytes: number }[];
}

const sha = (b: Uint8Array): string => createHash("sha256").update(b).digest("hex").toUpperCase();

/**
 * Derived files are served only through a valid `manifest.json`: the manifest must exist, carry the
 * current converter version and exactly the source hashes of the verified lock, and list the
 * requested file; the bytes on disk must match the listed size and SHA-256. Leftover or unlisted
 * files are never served, so a failed or stale extraction cannot leak through.
 */
export function createDerivedStore(dir: string, sourceHashes: Record<string, string>, lockId: string) {
  const root = resolve(dir);
  let cache: { mtimeMs: number; size: number; files: Map<string, { sha256: string; bytes: number }>; identity: DerivedIdentity } | null = null;
  const load = (): NonNullable<typeof cache> => {
    const path = join(root, "manifest.json");
    if (!existsSync(path)) throw new DerivedUnavailableError(404, "no ready derived manifest; run pnpm assets:extract --profile fan-local");
    const st = statSync(path);
    if (cache && cache.mtimeMs === st.mtimeMs && cache.size === st.size) return cache;
    let m: ManifestShape;
    try {
      m = JSON.parse(readFileSync(path, "utf8")) as ManifestShape;
    } catch {
      throw new DerivedUnavailableError(409, "derived manifest is not valid JSON");
    }
    if (m.converterVersion !== CONVERTER_VERSION) throw new DerivedUnavailableError(409, `derived manifest converter v${m.converterVersion} != gateway v${CONVERTER_VERSION}`);
    if (m.profile !== "fan-local") throw new DerivedUnavailableError(409, "derived manifest profile is not fan-local");
    const want = Object.entries(sourceHashes).sort();
    const got = Object.entries(m.sources ?? {}).sort();
    if (JSON.stringify(want) !== JSON.stringify(got)) throw new DerivedUnavailableError(409, "derived manifest source hashes differ from the verified lock");
    if (!Array.isArray(m.outputs)) throw new DerivedUnavailableError(409, "derived manifest has no outputs");
    const id = m.identity;
    if (!id || typeof id.lockId !== "string" || typeof id.whitelistSha256 !== "string") throw new DerivedUnavailableError(409, "derived manifest has no extraction identity");
    if (id.lockId !== lockId) throw new DerivedUnavailableError(409, `derived manifest lockId ${JSON.stringify(id.lockId)} is not the verified lock ${JSON.stringify(lockId)}`);
    const files = new Map(m.outputs.map((o) => [o.file, { sha256: o.sha256, bytes: o.bytes }]));
    cache = { mtimeMs: st.mtimeMs, size: st.size, files, identity: { converterVersion: m.converterVersion, ...id } };
    return cache;
  };
  const index = (): Map<string, { sha256: string; bytes: number }> => load().files;
  return {
    /** Identity of the ready manifest (converter, verified lock, canonical whitelist, UI profile / entry set), or null. */
    identity(): DerivedIdentity | null {
      try {
        return load().identity;
      } catch {
        return null;
      }
    },
    /** Bytes of `name` (a root-level derived file) after manifest, size and SHA-256 checks. */
    read(name: string): Uint8Array {
      const entry = index().get(name);
      if (!entry) throw new DerivedUnavailableError(404, `derived ${name} is not listed in the ready manifest`);
      const file = resolve(root, name);
      if (!file.startsWith(root + sep) || !existsSync(file)) throw new DerivedUnavailableError(404, `derived ${name} not found`);
      const bytes = readFileSync(file);
      if (bytes.length !== entry.bytes || sha(bytes) !== entry.sha256) throw new DerivedUnavailableError(409, `derived ${name} differs from the manifest`);
      return bytes;
    },
  };
}
