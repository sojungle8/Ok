import { BinaryReader, FormatError } from "./binary.ts";

const HEADER_BYTES = 18;
const FOOTER_BYTES = 26;
const PIXEL_BYTES = 4;
const MAX_PIXELS = 16_777_216;
const FOOTER_SIGNATURE = Uint8Array.from([
  0x54, 0x52, 0x55, 0x45, 0x56, 0x49, 0x53, 0x49, 0x4f,
  0x4e, 0x2d, 0x58, 0x46, 0x49, 0x4c, 0x45, 0x2e, 0x00,
]);

export interface Tga {
  width: number;
  height: number;
  bitsPerPixel: 32;
  /** RGBA pixels in top-to-bottom row order. */
  rgba: Uint8Array;
}

/**
 * Decode the deliberately narrow TGA subset used by the approved RO skill-effect textures.
 *
 * Accepted files are TGA 2.0, uncompressed true-colour (type 2), 32-bit BGRA with 8 alpha bits,
 * a bottom-left origin, no image ID/colour map/extension/developer data and the standard footer.
 * Everything else is rejected instead of being guessed or partially decoded.
 */
export function parseTga(bytes: Uint8Array): Tga {
  const r = new BinaryReader(bytes, "TGA");
  if (bytes.length < HEADER_BYTES + FOOTER_BYTES) {
    throw new FormatError("TGA", `truncated file (need at least ${HEADER_BYTES + FOOTER_BYTES} bytes, have ${bytes.length})`);
  }

  const idLength = r.u8();
  const colorMapType = r.u8();
  const imageType = r.u8();
  const colorMapFirst = r.u16();
  const colorMapLength = r.u16();
  const colorMapDepth = r.u8();
  const xOrigin = r.u16();
  const yOrigin = r.u16();
  const width = r.u16();
  const height = r.u16();
  const bitsPerPixel = r.u8();
  const descriptor = r.u8();

  if (idLength !== 0) throw new FormatError("TGA", `unsupported image ID length ${idLength}`);
  if (colorMapType !== 0) throw new FormatError("TGA", `unsupported color-map type ${colorMapType}`);
  if (colorMapFirst !== 0 || colorMapLength !== 0 || colorMapDepth !== 0) {
    throw new FormatError(
      "TGA",
      `unexpected color-map specification ${colorMapFirst}/${colorMapLength}/${colorMapDepth}`,
    );
  }
  if (imageType !== 2) {
    throw new FormatError("TGA", `unsupported image type ${imageType} (supported: uncompressed true-color type 2)`);
  }
  if (xOrigin !== 0 || yOrigin !== 0) {
    throw new FormatError("TGA", `unsupported image origin coordinates ${xOrigin},${yOrigin}`);
  }
  if (width === 0 || height === 0) throw new FormatError("TGA", `bad size ${width}x${height}`);
  if (bitsPerPixel !== 32) {
    throw new FormatError("TGA", `unsupported ${bitsPerPixel} bits per pixel (supported: 32)`);
  }
  if (descriptor !== 0x08) {
    throw new FormatError(
      "TGA",
      `unsupported image descriptor 0x${descriptor.toString(16).padStart(2, "0")} (expected 0x08: bottom-left, 8 alpha bits)`,
    );
  }

  const pixels = width * height;
  if (!Number.isSafeInteger(pixels) || pixels > MAX_PIXELS) {
    throw new FormatError("TGA", `image is too large (${width}x${height}, maximum ${MAX_PIXELS} pixels)`);
  }
  const pixelBytes = pixels * PIXEL_BYTES;
  const expectedBytes = HEADER_BYTES + pixelBytes + FOOTER_BYTES;
  if (bytes.length !== expectedBytes) {
    const kind = bytes.length < expectedBytes ? "truncated" : "unexpected trailing";
    throw new FormatError("TGA", `${kind} data (expected ${expectedBytes} bytes, have ${bytes.length})`);
  }

  const source = r.take(pixelBytes);
  const extensionOffset = r.u32();
  const developerOffset = r.u32();
  if (extensionOffset !== 0 || developerOffset !== 0) {
    throw new FormatError(
      "TGA",
      `unsupported extension/developer offsets ${extensionOffset}/${developerOffset}`,
    );
  }
  const signature = r.take(FOOTER_SIGNATURE.length);
  if (!signature.every((value, index) => value === FOOTER_SIGNATURE[index])) {
    throw new FormatError("TGA", "bad TGA 2.0 footer signature");
  }
  if (r.remaining !== 0) throw new FormatError("TGA", `unexpected trailing data (${r.remaining} bytes)`);

  const rgba = new Uint8Array(pixelBytes);
  for (let sourceY = 0; sourceY < height; sourceY += 1) {
    const destinationY = height - 1 - sourceY;
    for (let x = 0; x < width; x += 1) {
      const sourceOffset = (sourceY * width + x) * PIXEL_BYTES;
      const destinationOffset = (destinationY * width + x) * PIXEL_BYTES;
      rgba[destinationOffset] = source[sourceOffset + 2] as number;
      rgba[destinationOffset + 1] = source[sourceOffset + 1] as number;
      rgba[destinationOffset + 2] = source[sourceOffset] as number;
      rgba[destinationOffset + 3] = source[sourceOffset + 3] as number;
    }
  }

  return { width, height, bitsPerPixel: 32, rgba };
}
