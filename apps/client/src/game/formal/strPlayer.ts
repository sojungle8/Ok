import type { Str, StrKey, StrLayer } from "@ro-survivor/ro-format-runtime/str";

/**
 * Clean-room STR playback sampling (pure). Interpretation, written for this project:
 * - the key index advances at the file's fps; the animation ends at `maxKey`;
 * - a layer shows its latest base key (type 0) at or before the key index;
 * - a delta key (type 1) that immediately follows that base with the same frame adds
 *   `delta × (keyIndex − base.frame)` to position, corners, UV, angle and colour;
 * - aniType selects the texture: 0 fixed, 1 += delta.aniFrame, 2 clamp(+delay), 3 wrap(+delay), 4 wrap(−delay);
 * - a layer is hidden after its last key frame.
 * Real-client visual parity is verified only on the user's machine (DEFERRED_LOCAL).
 */
export interface StrLayerSample {
  visible: boolean;
  textureIndex: number;
  /** Screen-space STR position (pixels, origin 320/320 = effect centre). */
  pos: [number, number];
  /** Four corner offsets: xy[0..3] = x, xy[4..7] = y (pixels). */
  xy: number[];
  uv: number[];
  angleDeg: number;
  /** 0..1 RGBA. */
  color: [number, number, number, number];
  srcBlend: number;
  dstBlend: number;
}

const HIDDEN: StrLayerSample = { visible: false, textureIndex: 0, pos: [320, 320], xy: [0, 0, 0, 0, 0, 0, 0, 0], uv: [0, 0, 1, 0, 0, 1, 1, 1], angleDeg: 0, color: [0, 0, 0, 0], srcBlend: 5, dstBlend: 2 };
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const wrap = (v: number, n: number): number => ((Math.floor(v) % n) + n) % n;

export function strDurationMs(str: Str): number {
  return (str.maxKey * 1000) / str.fps;
}

export function strKeyIndex(str: Str, elapsedMs: number): number {
  return Math.floor((Math.max(0, elapsedMs) * str.fps) / 1000);
}

export function sampleStrLayer(layer: StrLayer, keyIndex: number): StrLayerSample {
  if (layer.textures.length === 0 || layer.keys.length === 0) return HIDDEN;
  let baseAt = -1;
  let lastFrame = 0;
  layer.keys.forEach((k, i) => {
    lastFrame = Math.max(lastFrame, k.frame);
    if (k.type === 0 && k.frame <= keyIndex) baseAt = i;
  });
  if (baseAt < 0 || keyIndex > lastFrame) return HIDDEN;
  const base = layer.keys[baseAt] as StrKey;
  const next = layer.keys[baseAt + 1];
  const delta = next && next.type === 1 && next.frame === base.frame ? next : null;
  const d = delta ? keyIndex - base.frame : 0;
  const add = (a: readonly number[], b: readonly number[] | undefined): number[] => a.map((v, i) => v + (b ? (b[i] ?? 0) * d : 0));
  const n = layer.textures.length;
  let frame = base.aniFrame;
  if (delta) {
    if (base.aniType === 1) frame = base.aniFrame + delta.aniFrame * d;
    else if (base.aniType === 2) frame = Math.min(base.aniFrame + delta.delay * d, n - 1);
    else if (base.aniType === 3) frame = wrap(base.aniFrame + delta.delay * d, n);
    else if (base.aniType === 4) frame = wrap(base.aniFrame - delta.delay * d, n);
  }
  const color = add(base.color, delta?.color).map((v) => clamp(v, 0, 255) / 255) as [number, number, number, number];
  return {
    visible: color[3] > 0,
    textureIndex: clamp(Math.floor(frame), 0, n - 1),
    pos: add(base.pos, delta?.pos) as [number, number],
    xy: add(base.xy, delta?.xy),
    uv: add(base.uv, delta?.uv),
    angleDeg: base.angle + (delta ? delta.angle * d : 0),
    color,
    srcBlend: base.srcBlend,
    dstBlend: base.dstBlend,
  };
}
