import { join } from "node:path";

/**
 * Bump when the extraction output format changes; outputs live in a new directory.
 * v2: scene contract (GND 1.7 + lightmaps, GRSM models, RSW placements, water, shadow, audio).
 * v3: original RO skill-effect texture PNGs and explicit opaque STR source metadata.
 */
export const CONVERTER_VERSION = 3;

/** `.local-assets/<first 16 hex of data.grf SHA-256>/<converter-version>/` (git-ignored). */
export function derivedDirFor(repoRoot: string, dataGrfSha256: string, converterVersion = CONVERTER_VERSION): string {
  return join(repoRoot, ".local-assets", dataGrfSha256.slice(0, 16).toLowerCase(), `v${converterVersion}`);
}
