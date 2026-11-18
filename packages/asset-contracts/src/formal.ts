import type { AssetWhitelist } from "./whitelist.ts";

/**
 * Formal-scene asset contract (CLAUDE-PHASE1-ORIGINAL-ASSETS.md Commit A). The formal screen needs the
 * male swordsman's four layers + palettes, every stage monster, the complete prt_fild08 closure
 * (RSW/GND/GAT, GND textures, RSM models, RSM textures, water JPGs, ambient WAVs), BGM 12 and the
 * official shadow. Anything not resolvable to a whitelisted asset ID is reported by canonical path.
 */
export const FORMAL_PLAYER_LAYERS = ["player.swordsman.male.body", "player.hair01.male", "player.swordsman.male.sword", "player.swordsman.male.guard"] as const;
export const FORMAL_PLAYER_PALETTES = ["palette.body.swordsman.male", "palette.hair01.male"] as const;
export const FORMAL_MONSTERS = ["monster.1002", "monster.1113", "monster.1007", "monster.1063", "monster.1011", "monster.1010", "monster.1052", "monster.1020", "monster.1167", "monster.1031", "monster.1088", "monster.1090"] as const;
export const FORMAL_MAP_CORE = ["map.prt_fild08.rsw", "map.prt_fild08.gnd", "map.prt_fild08.gat"] as const;
/**
 * Fixed formal requirement: the core map files and their canonical location, known even when a
 * whitelist row is missing (so a missing row is still reported with its exact container + path).
 */
export const FORMAL_MAP_CORE_PATHS: Readonly<Record<(typeof FORMAL_MAP_CORE)[number], { container: "data.grf"; canonicalPath: string }>> = {
  "map.prt_fild08.rsw": { container: "data.grf", canonicalPath: "data\\prt_fild08.rsw" },
  "map.prt_fild08.gnd": { container: "data.grf", canonicalPath: "data\\prt_fild08.gnd" },
  "map.prt_fild08.gat": { container: "data.grf", canonicalPath: "data\\prt_fild08.gat" },
};
export const FORMAL_SHADOW = ["common.shadow.spr", "common.shadow.act"] as const;
export const FORMAL_BGM = "bgm.prt_fild08";
/** Official RO WAVs used by the Swordsman vertical slice. Values are whitelist asset IDs. */
export const FORMAL_SKILL_AUDIO = {
  hit: "audio.hit.physical",
  "skill.sw.bash": "audio.skill.sw.bash",
  "skill.sw.magnum_break": "audio.skill.sw.magnum_break",
  "skill.sw.endure": "audio.skill.sw.endure",
  "skill.sw.provoke": "audio.skill.sw.provoke",
  "skill.sw.shield_wave": "audio.skill.sw.shield_wave",
} as const;
export const FORMAL_SKILL_AUDIO_IDS = [...new Set(Object.values(FORMAL_SKILL_AUDIO))];
const CLOSURE_CATEGORIES = new Set(["map_ground_texture", "map_model", "map_model_texture", "map_water_texture", "map_ambient_sound"]);

export interface MissingAssetRef {
  assetId: string | null;
  container: string;
  canonicalPath: string;
  reason: string;
}

/** Every source asset ID the formal scene requires (deterministic order). */
export function formalRequiredIds(list: AssetWhitelist): string[] {
  const closure = list.rows().filter((r) => CLOSURE_CATEGORIES.has(r.category)).map((r) => r.asset_id);
  return [
    ...FORMAL_PLAYER_LAYERS.flatMap((l) => [`${l}.spr`, `${l}.act`]),
    ...FORMAL_PLAYER_PALETTES,
    ...FORMAL_MONSTERS.flatMap((m) => [`${m}.spr`, `${m}.act`]),
    ...FORMAL_MAP_CORE,
    ...closure,
    FORMAL_BGM,
    ...FORMAL_SKILL_AUDIO_IDS,
    ...FORMAL_SHADOW,
  ];
}

/** Ids from the formal set that are not in the whitelist at all (whitelist-level gap). */
export function missingFromWhitelist(list: AssetWhitelist, ids: readonly string[]): MissingAssetRef[] {
  return ids.filter((id) => !list.has(id)).map((id) => ({ assetId: id, container: "data.grf", canonicalPath: "(not in whitelist)", reason: "asset ID missing from the fan-local whitelist" }));
}

export type DependencyKind = "texture" | "model" | "wav";
const BASE: Record<DependencyKind, string> = { texture: "data\\texture\\", model: "data\\model\\", wav: "data\\wav\\" };

/** Canonical archive path of a reference stored in GND (texture), RSW (model / sound) or RSM (texture). */
export function dependencyCanonicalPath(kind: DependencyKind, name: string): string {
  return BASE[kind] + name.replaceAll("/", "\\").replace(/^\\+/u, "");
}

/** RO water textures: data\texture\워터\water{type}{00..31}.jpg (32 animation frames). */
export function waterTexturePaths(waterType: number): string[] {
  return Array.from({ length: 32 }, (_, i) => `data\\texture\\워터\\water${waterType}${String(i).padStart(2, "0")}.jpg`);
}

export interface MapReferences {
  groundTextures: readonly string[];
  models: readonly string[];
  modelTextures: readonly string[];
  sounds: readonly string[];
  waterType: number | null;
}

/** Resolve every map reference to an asset ID; only references with no whitelist row are missing. */
export function resolveMapClosure(list: AssetWhitelist, refs: MapReferences): { ids: string[]; missing: MissingAssetRef[] } {
  const ids: string[] = [];
  const missing: MissingAssetRef[] = [];
  const add = (path: string, what: string): void => {
    const id = list.idForCanonicalPath(path);
    if (id) {
      if (!ids.includes(id)) ids.push(id);
    } else missing.push({ assetId: null, container: "data.grf", canonicalPath: path, reason: `${what} referenced by prt_fild08 is not whitelisted` });
  };
  for (const t of refs.groundTextures) add(dependencyCanonicalPath("texture", t), "GND texture");
  for (const m of refs.models) add(dependencyCanonicalPath("model", m), "RSW model");
  for (const t of refs.modelTextures) add(dependencyCanonicalPath("texture", t), "RSM texture");
  for (const w of refs.sounds) add(dependencyCanonicalPath("wav", w), "RSW ambient sound");
  if (refs.waterType !== null) for (const p of waterTexturePaths(refs.waterType)) add(p, "water texture");
  return { ids, missing };
}
