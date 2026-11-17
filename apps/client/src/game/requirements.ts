import type { AssetWhitelist } from "@ro-survivor/asset-contracts";

/**
 * Formal-screen rule: only original RO client assets (SPR, ACT, maps, audio) from the user's own
 * client may be shown. Nothing may be drawn, generated or substituted. Missing assets stop the game
 * and are reported by canonical path.
 */
export const FORMAL_SCENE = {
  player: { layers: ["player.swordsman.male.body", "player.hair01.male", "player.swordsman.male.sword", "player.swordsman.male.guard"], palettes: ["palette.body.swordsman.male", "palette.hair01.male"] },
  /** Every monster sprite the vertical-slice stage can spawn (normal, elite, Vocal, Mastering). */
  enemies: ["monster.1002", "monster.1113", "monster.1007", "monster.1063", "monster.1011", "monster.1010", "monster.1052", "monster.1020", "monster.1167", "monster.1031", "monster.1088", "monster.1090"],
  map: ["map.prt_fild08.rsw", "map.prt_fild08.gnd", "map.prt_fild08.gat"],
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

/** Canonical archive path of a map dependency referenced by GND (textures) or RSW (models). */
export function dependencyPath(kind: "texture" | "model", name: string): string {
  return `data\\${kind}\\${name}`;
}

/** All whitelisted source IDs the formal arena needs (SPR/ACT pairs, palettes, map files). */
export function formalSourceIds(): string[] {
  return [
    ...FORMAL_SCENE.player.layers.flatMap((l) => [`${l}.spr`, `${l}.act`]),
    ...FORMAL_SCENE.player.palettes,
    ...FORMAL_SCENE.enemies.flatMap((m) => [`${m}.spr`, `${m}.act`]),
    ...FORMAL_SCENE.map,
  ];
}
