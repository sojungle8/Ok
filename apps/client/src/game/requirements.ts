import { FORMAL_MAP_CORE, FORMAL_MONSTERS, FORMAL_PLAYER_LAYERS, FORMAL_PLAYER_PALETTES, type AssetWhitelist } from "@ro-survivor/asset-contracts";

/**
 * Formal-screen rule: only original RO client assets (SPR, ACT, maps, audio) from the user's own
 * client may be shown. Nothing may be drawn, generated or substituted. Missing assets stop the game
 * and are reported by canonical path.
 */
export const FORMAL_SCENE = {
  player: { layers: [...FORMAL_PLAYER_LAYERS], palettes: [...FORMAL_PLAYER_PALETTES] },
  /** Every monster sprite the vertical-slice stage can spawn (normal, elite, Vocal, Mastering). */
  enemies: [...FORMAL_MONSTERS],
  map: [...FORMAL_MAP_CORE],
} as const;

export interface MissingAsset {
  /** Whitelisted asset ID, or null when the asset is not whitelisted yet. */
  assetId: string | null;
  canonicalPath: string;
  container: string;
  reason: string;
}

export class MissingAssetsError extends Error {
  readonly missing: MissingAsset[];
  constructor(missing: MissingAsset[]) {
    super(`${missing.length} required RO asset(s) missing`);
    this.name = "MissingAssetsError";
    this.missing = missing;
  }
}

export function missingWhitelisted(whitelist: AssetWhitelist, assetId: string, reason: string): MissingAsset {
  const row = whitelist.has(assetId) ? whitelist.get(assetId) : null;
  return { assetId, canonicalPath: row?.canonical_cp949_path ?? "(not in whitelist)", container: row?.source_container ?? "data.grf", reason };
}
