import type { DerivedSkillEffectTexture } from "@ro-survivor/asset-contracts";
import { BASH_EFFECT_CONTRACT, BASH_EFFECT_IDS, type BashEffectId } from "../src/game/formal/skillEffects.ts";

/** Test-only metadata shaped like the verified Bash rows; never part of the formal asset path. */
export function bashEffectMeta(id: BashEffectId): DerivedSkillEffectTexture {
  const c = BASH_EFFECT_CONTRACT[id];
  return {
    rights: "fan-local-derived", converterVersion: 3, assetId: id,
    source: { canonicalPath: c.canonicalPath, bytes: c.bytes, sha256: "a".repeat(64) },
    kind: "texture", format: "tga", width: c.width, height: c.height, bitsPerPixel: 32,
    alpha: { mode: "source-alpha" },
    derived: { file: `${id}.png`, sha256: "b".repeat(64), width: c.width, height: c.height }, filter: "nearest",
  };
}

export const bashEffectEntries = (): [string, DerivedSkillEffectTexture][] => BASH_EFFECT_IDS.map((id) => [id, bashEffectMeta(id)]);
export const bashImageEntries = <T>(image: (w: number, h: number, tag: string) => T): [string, T][] =>
  BASH_EFFECT_IDS.map((id) => [id, image(BASH_EFFECT_CONTRACT[id].width, BASH_EFFECT_CONTRACT[id].height, id)]);
