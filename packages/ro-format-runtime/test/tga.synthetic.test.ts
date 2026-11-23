import { describe, expect, it } from "vitest";
import { FormatError, parseTga } from "../src/index.ts";

const FOOTER = Uint8Array.from([
  0, 0, 0, 0,
  0, 0, 0, 0,
  0x54, 0x52, 0x55, 0x45, 0x56, 0x49, 0x53, 0x49, 0x4f,
  0x4e, 0x2d, 0x58, 0x46, 0x49, 0x4c, 0x45, 0x2e, 0,
]);

function writeTga(
  width = 2,
  height = 2,
  pixels = Uint8Array.from([
    // Source rows are bottom-to-top and pixels are BGRA.
    30, 20, 10, 40, 70, 60, 50, 80,
    110, 100, 90, 120, 150, 140, 130, 160,
  ]),
): Uint8Array {
  const bytes = new Uint8Array(18 + pixels.length + FOOTER.length);
  const view = new DataView(bytes.buffer);
  bytes[2] = 2;
  view.setUint16(12, width, true);
  view.setUint16(14, height, true);
  bytes[16] = 32;
  bytes[17] = 8;
  bytes.set(pixels, 18);
  bytes.set(FOOTER, 18 + pixels.length);
  return bytes;
}

function patch(bytes: Uint8Array, offset: number, replacement: readonly number[]): Uint8Array {
  const copy = bytes.slice();
  copy.set(replacement, offset);
  return copy;
}

describe("TGA 2.0 skill-effect subset", () => {
  it("decodes bottom-left BGRA pixels into top-to-bottom RGBA", () => {
    const image = parseTga(writeTga());
    expect(image).toMatchObject({ width: 2, height: 2, bitsPerPixel: 32 });
    expect([...image.rgba]).toEqual([
      90, 100, 110, 120, 130, 140, 150, 160,
      10, 20, 30, 40, 50, 60, 70, 80,
    ]);
  });

  it("rejects truncation and unexpected trailing bytes", () => {
    const valid = writeTga();
    expect(() => parseTga(valid.subarray(0, valid.length - 1))).toThrow(/truncated/u);
    expect(() => parseTga(Uint8Array.from([...valid, 0]))).toThrow(/unexpected trailing/u);
    expect(() => parseTga(new Uint8Array(43))).toThrow(FormatError);
  });

  it("rejects image IDs, colour maps and non-type-2 images", () => {
    const valid = writeTga();
    expect(() => parseTga(patch(valid, 0, [1]))).toThrow(/image ID length 1/u);
    expect(() => parseTga(patch(valid, 1, [1]))).toThrow(/color-map type 1/u);
    expect(() => parseTga(patch(valid, 3, [1, 0]))).toThrow(/color-map specification/u);
    expect(() => parseTga(patch(valid, 2, [10]))).toThrow(/image type 10/u);
  });

  it("rejects non-zero coordinates, zero dimensions and oversized images before allocation", () => {
    const valid = writeTga();
    expect(() => parseTga(patch(valid, 8, [1, 0]))).toThrow(/origin coordinates 1,0/u);
    expect(() => parseTga(patch(valid, 10, [1, 0]))).toThrow(/origin coordinates 0,1/u);
    expect(() => parseTga(patch(valid, 12, [0, 0]))).toThrow(/bad size 0x2/u);
    expect(() => parseTga(patch(valid, 14, [0, 0]))).toThrow(/bad size 2x0/u);
    expect(() => parseTga(patch(valid, 12, [0xff, 0xff, 0xff, 0xff]))).toThrow(/too large/u);
  });

  it("rejects unsupported pixel depth and every non-bottom-left descriptor variant", () => {
    const valid = writeTga();
    expect(() => parseTga(patch(valid, 16, [24]))).toThrow(/unsupported 24 bits/u);
    expect(() => parseTga(patch(valid, 17, [0]))).toThrow(/descriptor 0x00/u);
    expect(() => parseTga(patch(valid, 17, [0x18]))).toThrow(/descriptor 0x18/u);
    expect(() => parseTga(patch(valid, 17, [0x28]))).toThrow(/descriptor 0x28/u);
    expect(() => parseTga(patch(valid, 17, [0x48]))).toThrow(/descriptor 0x48/u);
  });

  it("requires a footer with no extension or developer area", () => {
    const valid = writeTga();
    const footerOffset = valid.length - FOOTER.length;
    expect(() => parseTga(patch(valid, footerOffset, [1, 0, 0, 0]))).toThrow(/extension\/developer offsets 1\/0/u);
    expect(() => parseTga(patch(valid, footerOffset + 4, [1, 0, 0, 0]))).toThrow(/extension\/developer offsets 0\/1/u);
    expect(() => parseTga(patch(valid, footerOffset + 8, [0]))).toThrow(/footer signature/u);
  });
});
