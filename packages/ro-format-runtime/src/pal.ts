import { FormatError } from "./binary.ts";

/** 256-entry palette as RGBA (alpha forced: index 0 transparent, others opaque). */
export type Palette = Uint8Array;

/** `.pal` files and the SPR trailer: 256 × (R, G, B, reserved) = 1024 bytes. */
export function parsePalette(bytes: Uint8Array, format = "PAL"): Palette {
  if (bytes.length !== 1024) throw new FormatError(format, `palette must be 1024 bytes, got ${bytes.length}`);
  const out = new Uint8Array(1024);
  for (let i = 0; i < 256; i += 1) {
    out[i * 4] = bytes[i * 4] as number;
    out[i * 4 + 1] = bytes[i * 4 + 1] as number;
    out[i * 4 + 2] = bytes[i * 4 + 2] as number;
    out[i * 4 + 3] = i === 0 ? 0 : 255;
  }
  return out;
}
