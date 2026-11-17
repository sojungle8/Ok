import { BinaryReader, FormatError } from "./binary.ts";

/** RO colour key: pure magenta (allowing the ±1 rounding seen in 8-bit palettes) is transparent. */
export const RO_COLOR_KEY_RULE = "r>=254 && g<=1 && b>=254 -> alpha 0";
const isKey = (r: number, g: number, b: number): boolean => r >= 254 && g <= 1 && b >= 254;

export interface Bmp {
  width: number;
  height: number;
  bitsPerPixel: 8 | 24 | 32;
  /** RGBA, top-to-bottom rows; colour-keyed pixels have alpha 0 (RGB kept as stored). */
  rgba: Uint8Array;
  keyedPixels: number;
}

/**
 * Uncompressed Windows BMP (BITMAPINFOHEADER or later), 8-bit paletted, 24-bit or 32-bit.
 * Lossless: every source pixel maps to exactly one RGBA pixel; only the alpha of colour-keyed
 * pixels changes. RLE / bitfield / other depths are rejected explicitly.
 */
export function parseBmp(bytes: Uint8Array): Bmp {
  const r = new BinaryReader(bytes, "BMP");
  if (r.ascii(2) !== "BM") throw new FormatError("BMP", "bad magic, expected BM");
  r.skip(8);
  const dataOffset = r.u32();
  const headerSize = r.u32();
  if (headerSize < 40) throw new FormatError("BMP", `unsupported header size ${headerSize}`);
  const width = r.i32();
  const rawHeight = r.i32();
  const planes = r.u16();
  const bpp = r.u16();
  const compression = r.u32();
  r.skip(12);
  const colorsUsed = r.u32();
  if (planes !== 1) throw new FormatError("BMP", `bad plane count ${planes}`);
  if (bpp !== 8 && bpp !== 24 && bpp !== 32) throw new FormatError("BMP", `unsupported ${bpp} bits per pixel`);
  if (compression !== 0) throw new FormatError("BMP", `unsupported compression ${compression}`);
  const height = Math.abs(rawHeight);
  if (width <= 0 || height <= 0 || width > 8192 || height > 8192) throw new FormatError("BMP", `bad size ${width}x${rawHeight}`);
  let palette: Uint8Array | null = null;
  if (bpp === 8) {
    const n = colorsUsed === 0 ? 256 : colorsUsed;
    if (n > 256) throw new FormatError("BMP", `bad palette size ${n}`);
    r.offset = 14 + headerSize;
    palette = r.take(n * 4);
  }
  const stride = (width * (bpp / 8) + 3) & ~3;
  if (dataOffset + stride * height > bytes.length) {
    throw new FormatError("BMP", `truncated pixel data (need ${dataOffset + stride * height} bytes, have ${bytes.length})`);
  }
  const rgba = new Uint8Array(width * height * 4);
  let keyedPixels = 0;
  for (let row = 0; row < height; row += 1) {
    const y = rawHeight > 0 ? height - 1 - row : row; // bottom-up unless the height is negative
    const base = dataOffset + row * stride;
    for (let x = 0; x < width; x += 1) {
      let red: number;
      let green: number;
      let blue: number;
      if (palette) {
        const idx = bytes[base + x] as number;
        if (idx * 4 + 2 >= palette.length) throw new FormatError("BMP", `palette index ${idx} out of range`);
        blue = palette[idx * 4] as number;
        green = palette[idx * 4 + 1] as number;
        red = palette[idx * 4 + 2] as number;
      } else {
        const p = base + x * (bpp / 8);
        blue = bytes[p] as number;
        green = bytes[p + 1] as number;
        red = bytes[p + 2] as number;
      }
      const o = (y * width + x) * 4;
      rgba[o] = red;
      rgba[o + 1] = green;
      rgba[o + 2] = blue;
      const keyed = isKey(red, green, blue);
      rgba[o + 3] = keyed ? 0 : 255;
      if (keyed) keyedPixels += 1;
    }
  }
  return { width, height, bitsPerPixel: bpp, rgba, keyedPixels };
}
