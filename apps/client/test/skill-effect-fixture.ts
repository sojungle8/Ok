import type { DerivedSkillEffectTexture } from "@ro-survivor/asset-contracts";
import {
  BASH_EFFECT_CONTRACT,
  BASH_EFFECT_IDS,
  MAGNUM_BREAK_EFFECT_CONTRACT,
  MAGNUM_BREAK_EFFECT_IDS,
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

export const tgaEffectEntries = (): [string, DerivedSkillEffectTexture][] => TGA_EFFECT_IDS.map((id) => [id, tgaEffectMeta(id)]);
export const tgaImageEntries = <T>(image: (w: number, h: number, tag: string) => T): [string, T][] =>
  TGA_EFFECT_IDS.map((id) => [id, image(TGA_EFFECT_CONTRACT[id].width, TGA_EFFECT_CONTRACT[id].height, id)]);
