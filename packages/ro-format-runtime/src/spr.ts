import { BinaryReader, expectMagic, FormatError } from "./binary.ts";
import { parsePalette, type Palette } from "./pal.ts";

export interface SprIndexedFrame {
  kind: "indexed";
  width: number;
  height: number;
  /** One palette index per pixel, top-to-bottom rows. */
  indices: Uint8Array;
}

export interface SprRgbaFrame {
  kind: "rgba";
  width: number;
  height: number;
  /** RGBA, top-to-bottom rows (converted from the file's bottom-up ABGR). */
  rgba: Uint8Array;
}

export interface Sprite {
  version: string;
  indexed: SprIndexedFrame[];
  rgba: SprRgbaFrame[];
  palette: Palette | null;
}

function decodeRle(r: BinaryReader, expected: number): Uint8Array {
  const size = r.u16();
  const src = r.take(size);
  const out = new Uint8Array(expected);
  let o = 0;
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i] as number;
    if (c === 0) {
      i += 1;
      if (i >= src.length) throw new FormatError("SPR", "truncated RLE run");
      let n = src[i] as number;
      if (n === 0) n = 1;
      if (o + n > expected) throw new FormatError("SPR", "RLE overflows frame");
      o += n; // zeros already present
    } else {
      if (o >= expected) throw new FormatError("SPR", "RLE overflows frame");
      out[o++] = c;
    }
  }
  if (o !== expected) throw new FormatError("SPR", `RLE produced ${o} pixels, expected ${expected}`);
  return out;
}

/** SPR 1.x / 2.0 / 2.1. Palette is the 1024-byte trailer (version ≥ 1.1). */
export function parseSpr(bytes: Uint8Array): Sprite {
  const r = new BinaryReader(bytes, "SPR");
  expectMagic(r, "SP");
  const minor = r.u8();
  const major = r.u8();
  const version = `${major}.${minor}`;
  if (major !== 1 && major !== 2) throw new FormatError("SPR", `unsupported version ${version}`);
  const indexedCount = r.u16();
  const rgbaCount = major >= 2 ? r.u16() : 0;
  const rle = major > 2 || (major === 2 && minor >= 1);

  const indexed: SprIndexedFrame[] = [];
  for (let i = 0; i < indexedCount; i += 1) {
    const width = r.u16();
    const height = r.u16();
    const n = width * height;
    indexed.push({ kind: "indexed", width, height, indices: rle ? decodeRle(r, n) : r.take(n).slice() });
  }
  const rgba: SprRgbaFrame[] = [];
  for (let i = 0; i < rgbaCount; i += 1) {
    const width = r.u16();
    const height = r.u16();
    const src = r.take(width * height * 4);
    const out = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const s = ((height - 1 - y) * width + x) * 4;
        const d = (y * width + x) * 4;
        out[d] = src[s + 3] as number;
        out[d + 1] = src[s + 2] as number;
        out[d + 2] = src[s + 1] as number;
        out[d + 3] = src[s] as number;
      }
    }
    rgba.push({ kind: "rgba", width, height, rgba: out });
  }
  let palette: Palette | null = null;
  const hasPalette = major > 1 || minor >= 1;
  if (hasPalette) {
    if (r.remaining < 1024) throw new FormatError("SPR", `missing 1024-byte palette (have ${r.remaining})`);
    r.offset = bytes.length - 1024;
    palette = parsePalette(r.take(1024), "SPR");
  }
  return { version, indexed, rgba, palette };
}

/** Convert any SPR frame to top-down RGBA using a palette (index 0 = transparent). */
export function frameToRgba(frame: SprIndexedFrame | SprRgbaFrame, palette: Palette | null): Uint8Array {
  if (frame.kind === "rgba") return frame.rgba;
  if (!palette) throw new FormatError("SPR", "indexed frame without palette");
  const out = new Uint8Array(frame.width * frame.height * 4);
  for (let i = 0; i < frame.indices.length; i += 1) {
    const p = (frame.indices[i] as number) * 4;
    out[i * 4] = palette[p] as number;
    out[i * 4 + 1] = palette[p + 1] as number;
    out[i * 4 + 2] = palette[p + 2] as number;
    out[i * 4 + 3] = palette[p + 3] as number;
  }
  return out;
}
