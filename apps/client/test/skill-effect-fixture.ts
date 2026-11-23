import type { DerivedSkillEffectTexture } from "@ro-survivor/asset-contracts";
import type { Str, StrKey } from "@ro-survivor/ro-format-runtime/str";
import {
  BASH_EFFECT_CONTRACT,
  BASH_EFFECT_IDS,
  MAGNUM_BREAK_EFFECT_CONTRACT,
  MAGNUM_BREAK_EFFECT_IDS,
  PROVOKE_EFFECT_CONTRACT,
  PROVOKE_EFFECT_IDS,
  type ProvokeEffectId,
} from "../src/game/formal/skillEffects.ts";

/** Test-only TGA contracts shaped like the verified rows; never part of the formal asset path. */
export const TGA_EFFECT_CONTRACT = { ...BASH_EFFECT_CONTRACT, ...MAGNUM_BREAK_EFFECT_CONTRACT };
export type TgaEffectId = keyof typeof TGA_EFFECT_CONTRACT;
export const TGA_EFFECT_IDS: readonly TgaEffectId[] = [...BASH_EFFECT_IDS, ...MAGNUM_BREAK_EFFECT_IDS];

export function tgaEffectMeta(id: TgaEffectId): DerivedSkillEffectTexture {
  const c = TGA_EFFECT_CONTRACT[id];
  return {
    rights: "fan-local-derived", converterVersion: 3, assetId: id,
    source: { canonicalPath: c.canonicalPath, bytes: c.bytes, sha256: "a".repeat(64) },
    kind: "texture", format: "tga", width: c.width, height: c.height, bitsPerPixel: 32,
    alpha: { mode: "source-alpha" },
    derived: { file: `${id}.png`, sha256: "b".repeat(64), width: c.width, height: c.height }, filter: "nearest",
  };
}

export function provokeEffectMeta(id: ProvokeEffectId): DerivedSkillEffectTexture {
  const c = PROVOKE_EFFECT_CONTRACT[id];
  return {
    rights: "fan-local-derived", converterVersion: 3, assetId: id,
    source: { canonicalPath: c.canonicalPath, bytes: c.bytes, sha256: "c".repeat(64) },
    kind: "texture", format: "bmp", width: c.width, height: c.height, bitsPerPixel: c.bitsPerPixel,
    alpha: { mode: "ro-color-key", keyedPixels: 1 },
    derived: { file: `${id}.png`, sha256: "d".repeat(64), width: c.width, height: c.height }, filter: "nearest",
  };
}

/** Every verified Bash / Magnum Break / Provoke source, in layer lane order. */
export const LANE_EFFECT_IDS: readonly string[] = [...TGA_EFFECT_IDS, ...PROVOKE_EFFECT_IDS];
export const tgaEffectEntries = (): [string, DerivedSkillEffectTexture][] => [
  ...TGA_EFFECT_IDS.map((id): [string, DerivedSkillEffectTexture] => [id, tgaEffectMeta(id)]),
  ...PROVOKE_EFFECT_IDS.map((id): [string, DerivedSkillEffectTexture] => [id, provokeEffectMeta(id)]),
];
export const tgaImageEntries = <T>(image: (w: number, h: number, tag: string) => T): [string, T][] => [
  ...TGA_EFFECT_IDS.map((id): [string, T] => [id, image(TGA_EFFECT_CONTRACT[id].width, TGA_EFFECT_CONTRACT[id].height, id)]),
  ...PROVOKE_EFFECT_IDS.map((id): [string, T] => [id, image(PROVOKE_EFFECT_CONTRACT[id].width, PROVOKE_EFFECT_CONTRACT[id].height, id)]),
];

const key = (frame: number, type: 0 | 1, extra: Partial<StrKey> = {}): StrKey => ({
  frame, type, pos: type === 0 ? [320, 320] : [0, 0], uv: type === 0 ? [0, 0, 1, 0, 0, 1, 1, 1] : [0, 0, 0, 0, 0, 0, 0, 0],
  xy: type === 0 ? [-16, 16, -16, 16, -16, -16, 16, 16] : [0, 0, 0, 0, 0, 0, 0, 0], aniFrame: 0, aniType: 0, delay: 0, angle: 0,
  color: type === 0 ? [255, 255, 255, 255] : [0, 0, 0, 0], srcBlend: 5, dstBlend: 2, mtPreset: 0, ...extra,
});
export const PROVOKE_STR_LAYERS = 3;
/** Test-only parsed STR: three layers, one per verified Provoke BMP. Not real RO animation data. */
export function syntheticProvokeStr(): { str: Str; layerTextures: string[][] } {
  const str: Str = {
    version: 0x94, fps: 60, maxKey: 30,
    layers: PROVOKE_EFFECT_IDS.map((_, l) => ({ textures: [`t${l}.bmp`], keys: [key(0, 0), key(0, 1, { color: [0, 0, 0, -2] }), key(29, 0)] })),
  };
  return { str, layerTextures: PROVOKE_EFFECT_IDS.map((id) => [id]) };
}
