import { FormatError } from "./binary.ts";

export interface JpegInfo {
  width: number;
  height: number;
  components: number;
  progressive: boolean;
}

/**
 * Read a JPEG's frame header without decoding pixels: the official water frames are served as the
 * original bytes (no re-encode), so only their dimensions are needed for the derived contract.
 */
export function readJpegInfo(bytes: Uint8Array): JpegInfo {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new FormatError("JPEG", "missing SOI marker");
  let o = 2;
  while (o + 4 <= bytes.length) {
    if (bytes[o] !== 0xff) throw new FormatError("JPEG", `expected marker at offset ${o}`);
    const marker = bytes[o + 1] as number;
    if (marker === 0xff) {
      o += 1;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break; // EOI / start of scan before any SOF
    const len = ((bytes[o + 2] as number) << 8) | (bytes[o + 3] as number);
    if (len < 2 || o + 2 + len > bytes.length) throw new FormatError("JPEG", `truncated segment 0x${marker.toString(16)} at offset ${o}`);
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      if (len < 8) throw new FormatError("JPEG", "short SOF segment");
      const height = ((bytes[o + 5] as number) << 8) | (bytes[o + 6] as number);
      const width = ((bytes[o + 7] as number) << 8) | (bytes[o + 8] as number);
      const components = bytes[o + 9] as number;
      if (width === 0 || height === 0) throw new FormatError("JPEG", "zero frame size");
      return { width, height, components, progressive: marker === 0xc2 };
    }
    o += 2 + len;
  }
  throw new FormatError("JPEG", "no SOF frame header found");
}
