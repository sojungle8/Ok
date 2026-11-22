import { BinaryReader, FormatError } from "./binary.ts";

/**
 * Clean-room reader for the RO STR effect animation, restricted to the one container version used by
 * the pinned Provoke source (0x94). Layout (little endian):
 *   "STRM", u32 version, u32 fps, u32 maxKey, u32 layerCount, 16 reserved bytes,
 *   per layer: i32 textureCount, textureCount × 128-byte NUL-terminated names, i32 keyCount,
 *   per key (124 bytes): i32 frame, u32 type (0 = base, 1 = delta), f32 pos[2], f32 uv[8], f32 xy[8],
 *   f32 aniFrame, u32 aniType, f32 delay, f32 angle, f32 color[4], u32 srcBlend, u32 dstBlend, u32 mtPreset.
 * Anything else (other versions, oversize counts, non-finite floats, non-ASCII names, trailing bytes)
 * is rejected instead of guessed.
 */
export const STR_VERSION = 0x94;
export const STR_KEY_BYTES = 124;
const STR_NAME_BYTES = 128;
const MAX_LAYERS = 64;
const MAX_TEXTURES = 64;
const MAX_KEYS = 4096;
const MAX_FPS = 240;
const MAX_FRAMES = 100_000;

export interface StrKey {
  frame: number;
  type: 0 | 1;
  pos: [number, number];
  uv: number[];
  xy: number[];
  aniFrame: number;
  aniType: number;
  delay: number;
  angle: number;
  color: [number, number, number, number];
  srcBlend: number;
  dstBlend: number;
  mtPreset: number;
}

export interface StrLayer {
  textures: string[];
  keys: StrKey[];
}

export interface Str {
  version: typeof STR_VERSION;
  fps: number;
  maxKey: number;
  layers: StrLayer[];
}

function finite(r: BinaryReader, what: string): number {
  const v = r.f32();
  if (!Number.isFinite(v)) throw new FormatError("STR", `${what} is not finite at offset ${r.offset - 4}`);
  return v;
}

function count(r: BinaryReader, what: string, max: number): number {
  const v = r.i32();
  if (v < 0 || v > max) throw new FormatError("STR", `${what} ${v} outside 0..${max}`);
  return v;
}

export function parseStr(bytes: Uint8Array): Str {
  const r = new BinaryReader(bytes, "STR");
  const magic = r.ascii(4);
  if (magic !== "STRM") throw new FormatError("STR", `bad magic ${JSON.stringify(magic)}, expected "STRM"`);
  const version = r.u32();
  if (version !== STR_VERSION) throw new FormatError("STR", `unsupported version 0x${version.toString(16)} (only 0x94)`);
  const fps = r.u32();
  if (fps < 1 || fps > MAX_FPS) throw new FormatError("STR", `fps ${fps} outside 1..${MAX_FPS}`);
  const maxKey = r.u32();
  if (maxKey > MAX_FRAMES) throw new FormatError("STR", `maxKey ${maxKey} > ${MAX_FRAMES}`);
  const layerCount = r.u32();
  if (layerCount > MAX_LAYERS) throw new FormatError("STR", `layer count ${layerCount} > ${MAX_LAYERS}`);
  r.skip(16);
  const layers: StrLayer[] = [];
  for (let l = 0; l < layerCount; l += 1) {
    const textureCount = count(r, `layer ${l} texture count`, MAX_TEXTURES);
    const textures: string[] = [];
    for (let t = 0; t < textureCount; t += 1) {
      const raw = r.cstringBytes(STR_NAME_BYTES);
      if (raw.length === 0 || raw.some((b) => b < 0x20 || b > 0x7e)) throw new FormatError("STR", `layer ${l} texture ${t} name is empty or not printable ASCII`);
      textures.push(String.fromCharCode(...raw));
    }
    const keyCount = count(r, `layer ${l} key count`, MAX_KEYS);
    const keys: StrKey[] = [];
    for (let k = 0; k < keyCount; k += 1) {
      const frame = r.i32();
      if (frame < 0 || frame > MAX_FRAMES) throw new FormatError("STR", `layer ${l} key ${k} frame ${frame} out of range`);
      const type = r.u32();
      if (type !== 0 && type !== 1) throw new FormatError("STR", `layer ${l} key ${k} type ${type} is not 0/1`);
      const pos: [number, number] = [finite(r, "pos"), finite(r, "pos")];
      const uv = Array.from({ length: 8 }, () => finite(r, "uv"));
      const xy = Array.from({ length: 8 }, () => finite(r, "xy"));
      const aniFrame = finite(r, "aniFrame");
      const aniType = r.u32();
      if (aniType > 4) throw new FormatError("STR", `layer ${l} key ${k} aniType ${aniType} > 4`);
      const delay = finite(r, "delay");
      const angle = finite(r, "angle");
      const color: [number, number, number, number] = [finite(r, "color"), finite(r, "color"), finite(r, "color"), finite(r, "color")];
      const srcBlend = r.u32();
      const dstBlend = r.u32();
      const mtPreset = r.u32();
      if (srcBlend > 15 || dstBlend > 15) throw new FormatError("STR", `layer ${l} key ${k} blend ${srcBlend}/${dstBlend} outside the D3D range`);
      keys.push({ frame, type, pos, uv, xy, aniFrame, aniType, delay, angle, color, srcBlend, dstBlend, mtPreset });
    }
    layers.push({ textures, keys });
  }
  if (r.remaining !== 0) throw new FormatError("STR", `${r.remaining} trailing bytes`);
  return { version: STR_VERSION, fps, maxKey, layers };
}
