import type { DerivedSkillEffectTexture } from "@ro-survivor/asset-contracts";
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
