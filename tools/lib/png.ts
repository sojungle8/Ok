import { deflateSync, inflateSync } from "node:zlib";

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = (CRC_TABLE[(c ^ b) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** Marker stamped into every fan-local derived output; rights:check fails on it outside .local-assets/. */
// Built from parts so this source file does not itself contain the marker.
export const DERIVED_MARKER = ["RO-SURVIVOR-DERIVED", "local-fan-use"].join(":");

/** Deterministic RGBA8 PNG (filter 0, zlib level 9). `marker` adds a tEXt chunk right after IHDR. */
export function encodePng(width: number, height: number, rgba: Uint8Array, marker?: string): Buffer {
  if (rgba.length !== width * height * 4) throw new Error("encodePng: size mismatch");
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), ...(marker ? [chunk("tEXt", Buffer.from(`Comment\0${marker}`, "latin1"))] : []), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", new Uint8Array())]);
}

/** Decoder for PNGs written by encodePng (filter 0 only); used by tests. */
export function decodeOwnPng(png: Uint8Array): { width: number; height: number; rgba: Uint8Array } {
  const b = Buffer.from(png);
  let p = 8;
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p);
    const type = b.toString("latin1", p + 4, p + 8);
    const data = b.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    } else if (type === "IDAT") idat.push(data);
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    if (raw[y * (width * 4 + 1)] !== 0) throw new Error("decodeOwnPng: only filter 0 supported");
    rgba.set(raw.subarray(y * (width * 4 + 1) + 1, (y + 1) * (width * 4 + 1)), y * width * 4);
  }
  return { width, height, rgba };
}
