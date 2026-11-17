import { join } from "node:path";

/** Bump when the extraction output format changes; outputs live in a new directory. */
export const CONVERTER_VERSION = 1;

/** `.local-assets/<first 16 hex of data.grf SHA-256>/<converter-version>/` (git-ignored). */
export function derivedDirFor(repoRoot: string, dataGrfSha256: string, converterVersion = CONVERTER_VERSION): string {
  return join(repoRoot, ".local-assets", dataGrfSha256.slice(0, 16).toLowerCase(), `v${converterVersion}`);
}
