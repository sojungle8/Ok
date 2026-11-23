/**
 * Fan-local derived contract for original RO skill-effect sources.
 *
 * Texture pixels are converted losslessly to PNG for browser decoding. STR is deliberately kept as
 * an opaque, source-only record until the project has a bounded clean-room parser; this contract
 * must never imply that an STR animation has been parsed when it has only been identified.
 */

export interface DerivedSkillEffectSource {
  canonicalPath: string;
  bytes: number;
  sha256: string;
}

interface DerivedSkillEffectBase {
  rights: string;
  converterVersion: number;
  assetId: string;
  source: DerivedSkillEffectSource;
}

export interface DerivedSkillEffectTexture extends DerivedSkillEffectBase {
  kind: "texture";
  format: "bmp" | "tga";
  width: number;
  height: number;
  bitsPerPixel: 8 | 24 | 32;
  alpha: { mode: "ro-color-key"; keyedPixels: number } | { mode: "source-alpha" };
  derived: { file: string; sha256: string; width: number; height: number };
  filter: "nearest";
}

export interface DerivedSkillEffectAnimationSource extends DerivedSkillEffectBase {
  kind: "animation-source";
  format: "str";
  magic: "STRM";
  parsed: false;
  sourceOnly: true;
}

export type DerivedSkillEffect = DerivedSkillEffectTexture | DerivedSkillEffectAnimationSource;

