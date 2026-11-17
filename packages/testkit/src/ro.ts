/**
 * Synthetic RO-format writers for tests. Every byte is generated here from parameters; nothing
 * is copied from an RO client, website or other repository. These are the inverse of the
 * clean-room parsers and are used for round-trip tests and the cloud extraction pipeline.
 */
import { deflateSync } from "node:zlib";

class Writer {
  #parts: number[] = [];
  u8(v: number): this { this.#parts.push(v & 0xff); return this; }
  u16(v: number): this { return this.u8(v).u8(v >> 8); }
  i16(v: number): this { return this.u16(v & 0xffff); }
  u32(v: number): this { return this.u8(v).u8(v >> 8).u8(v >> 16).u8(v >>> 24); }
  i32(v: number): this { return this.u32(v >>> 0); }
  f32(v: number): this {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setFloat32(0, v, true);
    return this.bytes(b);
  }
  ascii(s: string): this { for (const c of s) this.u8(c.charCodeAt(0)); return this; }
  bytes(b: Uint8Array | readonly number[]): this { for (const x of b) this.#parts.push(x & 0xff); return this; }
  fixed(b: Uint8Array, n: number): this {
    if (b.length > n) throw new Error("fixed string too long");
    this.bytes(b);
    for (let i = b.length; i < n; i += 1) this.u8(0);
    return this;
  }
  zeros(n: number): this { for (let i = 0; i < n; i += 1) this.u8(0); return this; }
  done(): Uint8Array { return Uint8Array.from(this.#parts); }
}

const ascii = (s: string): Uint8Array => Uint8Array.from([...s].map((c) => c.charCodeAt(0)));

export interface SyntheticSprFrame { width: number; height: number; indices: Uint8Array }

/** SPR 2.1 with RLE-encoded indexed frames, optional RGBA frames and a palette trailer. */
export function writeSpr(opts: { indexed: SyntheticSprFrame[]; rgba?: { width: number; height: number; rgba: Uint8Array }[]; palette: Uint8Array; version?: "2.0" | "2.1" }): Uint8Array {
  const v21 = (opts.version ?? "2.1") === "2.1";
  const w = new Writer().ascii("SP").u8(v21 ? 1 : 0).u8(2).u16(opts.indexed.length).u16(opts.rgba?.length ?? 0);
  for (const f of opts.indexed) {
    w.u16(f.width).u16(f.height);
    if (!v21) { w.bytes(f.indices); continue; }
    const rle: number[] = [];
    for (let i = 0; i < f.indices.length; ) {
      const c = f.indices[i] as number;
      if (c === 0) {
        let n = 0;
        while (i < f.indices.length && f.indices[i] === 0 && n < 255) { n += 1; i += 1; }
        rle.push(0, n);
      } else { rle.push(c); i += 1; }
    }
    w.u16(rle.length).bytes(rle);
  }
  for (const f of opts.rgba ?? []) {
    w.u16(f.width).u16(f.height);
    for (let y = f.height - 1; y >= 0; y -= 1) {
      for (let x = 0; x < f.width; x += 1) {
        const s = (y * f.width + x) * 4;
        w.u8(f.rgba[s + 3] as number).u8(f.rgba[s + 2] as number).u8(f.rgba[s + 1] as number).u8(f.rgba[s] as number);
      }
    }
  }
  if (opts.palette.length !== 1024) throw new Error("palette must be 1024 bytes");
  return w.bytes(opts.palette).done();
}

/** Deterministic 256-colour palette (index 0 = magenta key, like RO's transparent colour). */
export function syntheticPalette(seed = 1): Uint8Array {
  const p = new Uint8Array(1024);
  for (let i = 0; i < 256; i += 1) {
    p[i * 4] = (i * 37 + seed * 11) & 0xff;
    p[i * 4 + 1] = (i * 91 + seed * 23) & 0xff;
    p[i * 4 + 2] = (i * 53 + seed * 7) & 0xff;
  }
  p[0] = 255; p[1] = 0; p[2] = 255;
  return p;
}

export interface SyntheticActLayer {
  x: number; y: number; sprIndex: number; mirror?: boolean;
  color?: [number, number, number, number]; scaleX?: number; scaleY?: number; rotation?: number; rgba?: boolean;
  width?: number; height?: number;
}
export interface SyntheticActFrame { layers: SyntheticActLayer[]; soundIndex?: number; anchors?: { x: number; y: number }[] }
export interface SyntheticActAction { frames: SyntheticActFrame[]; delay?: number }

export function writeAct(opts: { version: "2.0" | "2.1" | "2.2" | "2.3" | "2.4" | "2.5"; actions: SyntheticActAction[]; sounds?: string[] }): Uint8Array {
  const v = Number(opts.version.split(".")[1]);
  const w = new Writer().ascii("AC").u8(v).u8(2).u16(opts.actions.length).zeros(10);
  for (const a of opts.actions) {
    w.u32(a.frames.length);
    for (const f of a.frames) {
      w.zeros(32).u32(f.layers.length);
      for (const l of f.layers) {
        w.i32(l.x).i32(l.y).i32(l.sprIndex).u32(l.mirror ? 1 : 0);
        const c = l.color ?? [255, 255, 255, 255];
        w.u8(c[0]).u8(c[1]).u8(c[2]).u8(c[3]);
        if (v >= 4) w.f32(l.scaleX ?? 1).f32(l.scaleY ?? 1);
        else w.f32(l.scaleX ?? 1);
        w.i32(l.rotation ?? 0).i32(l.rgba ? 1 : 0);
        if (v >= 5) w.i32(l.width ?? 0).i32(l.height ?? 0);
      }
      w.i32(f.soundIndex ?? -1);
      if (v >= 3) {
        const anchors = f.anchors ?? [];
        w.i32(anchors.length);
        for (const an of anchors) w.zeros(4).i32(an.x).i32(an.y).i32(0);
      }
    }
  }
  if (v >= 1) {
    const sounds = opts.sounds ?? [];
    w.u32(sounds.length);
    for (const s of sounds) w.fixed(ascii(s), 40);
  }
  if (v >= 2) for (const a of opts.actions) w.f32(a.delay ?? 4);
  return w.done();
}

/** GAT 1.2 with flat heights; `types[y*width+x]` cell types. */
export function writeGat(width: number, height: number, types: Uint32Array | number[], heightAt: (x: number, y: number) => number = () => 0): Uint8Array {
  const w = new Writer().ascii("GRAT").u8(1).u8(2).i32(width).i32(height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const h = heightAt(x, y);
      w.f32(h).f32(h).f32(h).f32(h).u32(types[y * width + x] ?? 0);
    }
  }
  return w.done();
}

/** GND 1.7: one surface per cube top, no textures beyond the given names. */
export function writeGnd(
  width: number,
  height: number,
  textures: Uint8Array[],
  heightAt: (x: number, y: number) => number = () => 0,
  opts: { lightmaps?: number; version?: [number, number] } = {},
): Uint8Array {
  const [major, minor] = opts.version ?? [1, 7];
  const lightmaps = Math.max(1, opts.lightmaps ?? 1);
  const w = new Writer().ascii("GRGN").u8(major).u8(minor).i32(width).i32(height).f32(10).i32(textures.length).i32(80);
  for (const t of textures) w.fixed(t, 80);
  // Lightmaps: 8x8 brightness + 8x8 RGB colour each, a deterministic gradient per block.
  w.i32(lightmaps).i32(8).i32(8).i32(1);
  for (let l = 0; l < lightmaps; l += 1) {
    for (let p = 0; p < 64; p += 1) w.u8((128 + l * 7 + p) & 0xff);
    for (let p = 0; p < 64; p += 1) w.u8((l * 13) & 0xff).u8((p * 3) & 0xff).u8((l + p) & 0xff);
  }
  w.i32(width * height);
  for (let i = 0; i < width * height; i += 1) {
    w.f32(0).f32(1).f32(0).f32(1).f32(0).f32(0).f32(1).f32(1).i16(textures.length > 0 ? i % textures.length : -1).u16(i % lightmaps);
    w.u8(255).u8(255).u8(255).u8(255);
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const h = heightAt(x, y);
      w.f32(h).f32(h).f32(h).f32(h).i32(y * width + x).i32(-1).i32(-1);
    }
  }
  return w.done();
}

/** RSW 2.1 with the given model objects, sounds (default one), one light and one effect. */
export function writeRsw(opts: {
  gnd: string;
  gat: string;
  models: { name: string; file: Uint8Array; position?: [number, number, number]; rotation?: [number, number, number]; scale?: [number, number, number] }[];
  sounds?: Uint8Array[];
  waterType?: number;
  waterLevel?: number;
}): Uint8Array {
  const w = new Writer().ascii("GRSW").u8(2).u8(1);
  w.fixed(ascii(""), 40).fixed(ascii(opts.gnd), 40).fixed(ascii(opts.gat), 40).fixed(ascii(""), 40);
  w.f32(opts.waterLevel ?? 0).i32(opts.waterType ?? 0).f32(1).f32(2).f32(50).i32(3);
  w.i32(45).i32(45).f32(1).f32(1).f32(1).f32(0.3).f32(0.3).f32(0.3).f32(0.5);
  w.i32(-500).i32(500).i32(-500).i32(500);
  const sounds = opts.sounds ?? [ascii("ambient.wav")];
  w.i32(opts.models.length + 2 + sounds.length);
  for (const m of opts.models) {
    w.i32(1).fixed(ascii(m.name), 40).i32(0).f32(1).i32(0).fixed(m.file, 80).fixed(ascii(""), 80);
    const [px, py, pz] = m.position ?? [1, 2, 3];
    const [rx, ry, rz] = m.rotation ?? [0, 90, 0];
    const [sx, sy, sz] = m.scale ?? [1, 1, 1];
    w.f32(px).f32(py).f32(pz).f32(rx).f32(ry).f32(rz).f32(sx).f32(sy).f32(sz);
  }
  w.i32(2).fixed(ascii("light01"), 80).f32(0).f32(0).f32(0).f32(1).f32(1).f32(1).f32(10);
  sounds.forEach((snd, i) => w.i32(3).fixed(ascii(`sound${i}`), 80).fixed(snd, 80).f32(i).f32(0).f32(i).f32(1).i32(1).i32(1).f32(10).f32(4));
  w.i32(4).fixed(ascii("effect01"), 80).f32(0).f32(0).f32(0).i32(1).f32(0).f32(0).f32(0).f32(0).f32(0);
  return w.done();
}

/** GRF 0x200 with zlib-compressed entries; names are raw CP949 byte strings. */
export function writeGrf(entries: { rawName: Uint8Array; data: Uint8Array; flags?: number }[]): Uint8Array {
  const blobs: Uint8Array[] = [];
  const table = new Writer();
  let offset = 0;
  for (const e of entries) {
    const packed = deflateSync(e.data);
    const aligned = packed.length;
    table.bytes(e.rawName).u8(0).u32(packed.length).u32(aligned).u32(e.data.length).u8(e.flags ?? 1).u32(offset);
    blobs.push(packed);
    offset += aligned;
  }
  const tableBytes = table.done();
  const tablePacked = deflateSync(tableBytes);
  const seed = 0;
  const out = new Writer().ascii("Master of Magic").u8(0).zeros(14).u32(offset).u32(seed).u32(entries.length + seed + 7).u32(0x200);
  for (const b of blobs) out.bytes(b);
  out.u32(tablePacked.length).u32(tableBytes.length).bytes(tablePacked);
  return out.done();
}

/** 24-bit bottom-up BMP; `pixel(x, y)` returns [r, g, b] (magenta = RO colour key). */
export function writeBmp24(width: number, height: number, pixel: (x: number, y: number) => [number, number, number]): Uint8Array {
  const row = (width * 3 + 3) & ~3;
  const size = 54 + row * height;
  const w = new Writer().ascii("BM").u32(size).u32(0).u32(54).u32(40).i32(width).i32(height).u16(1).u16(24).u32(0).u32(row * height).i32(2835).i32(2835).u32(0).u32(0);
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = pixel(x, y);
      w.u8(b).u8(g).u8(r);
    }
    for (let p = width * 3; p < row; p += 1) w.u8(0);
  }
  return w.done();
}

/** Minimal PCM WAV (mono 8-bit) of synthetic samples. */
export function writeWav(samples: Uint8Array, rate = 11025): Uint8Array {
  return new Writer().ascii("RIFF").u32(36 + samples.length).ascii("WAVE").ascii("fmt ").u32(16).u16(1).u16(1).u32(rate).u32(rate).u16(1).u16(8).ascii("data").u32(samples.length).bytes(samples).done();
}

/** Bytes that only carry a format signature + synthetic payload (for formats parsed in later commits). */
export function writeSignatureBlob(signature: readonly number[], length: number, seed: number): Uint8Array {
  const out = new Uint8Array(Math.max(length, signature.length));
  out.set(signature, 0);
  let x = seed >>> 0 || 1;
  for (let i = signature.length; i < out.length; i += 1) {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    out[i] = x & 0xff;
  }
  return out;
}

/** 8-bit paletted bottom-up BMP; palette entry 0 is magenta (RO colour key). */
export function writeBmp8(width: number, height: number, index: (x: number, y: number) => number, palette: (i: number) => [number, number, number] = (i) => (i === 0 ? [255, 0, 255] : [i, 255 - i, (i * 7) & 255])): Uint8Array {
  const row = (width + 3) & ~3;
  const size = 54 + 1024 + row * height;
  const w = new Writer().ascii("BM").u32(size).u32(0).u32(54 + 1024).u32(40).i32(width).i32(height).u16(1).u16(8).u32(0).u32(row * height).i32(2835).i32(2835).u32(256).u32(0);
  for (let i = 0; i < 256; i += 1) {
    const [r, g, b] = palette(i);
    w.u8(b).u8(g).u8(r).u8(0);
  }
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = 0; x < width; x += 1) w.u8(index(x, y));
    for (let p = width; p < row; p += 1) w.u8(0);
  }
  return w.done();
}

/** JPEG container with SOI, APP0, a baseline SOF0 frame header and EOI; no entropy data (header-only fixture). */
export function writeJpegHeader(width: number, height: number, seed = 1): Uint8Array {
  const w = new Writer().u8(0xff).u8(0xd8);
  w.u8(0xff).u8(0xe0).u8(0).u8(16).ascii("JFIF").u8(0).u8(1).u8(1).u8(0).u8(0).u8(1).u8(0).u8(1).u8(0).u8(0);
  w.u8(0xff).u8(0xfe).u8(0).u8(6).u8(seed & 0xff).u8((seed >> 8) & 0xff).u8(0).u8(0); // comment carries the seed
  w.u8(0xff).u8(0xc0).u8(0).u8(17).u8(8).u8(height >> 8).u8(height & 0xff).u8(width >> 8).u8(width & 0xff).u8(3);
  for (let c = 1; c <= 3; c += 1) w.u8(c).u8(c === 1 ? 0x22 : 0x11).u8(c === 1 ? 0 : 1);
  return w.u8(0xff).u8(0xd9).done();
}

export interface SyntheticRsmNode {
  name: string;
  parent?: string;
  /** Model texture indices. */
  textures: number[];
  vertices: [number, number, number][];
  tvertices: [number, number][];
  faces: { v: [number, number, number]; t: [number, number, number]; texture: number }[];
  position?: [number, number, number];
}

/** GRSM 1.x writer (default 1.4) for parser and extraction tests. */
export function writeRsm(opts: { textures: Uint8Array[]; nodes: SyntheticRsmNode[]; version?: [number, number] | undefined; alpha?: number | undefined }): Uint8Array {
  const [major, minor] = opts.version ?? [1, 4];
  const v = major * 100 + minor;
  const w = new Writer().ascii("GRSM").u8(major).u8(minor).i32(0).i32(1);
  if (v >= 104) w.u8(opts.alpha ?? 255);
  w.zeros(16).i32(opts.textures.length);
  for (const t of opts.textures) w.fixed(t, 40);
  w.fixed(ascii(opts.nodes[0]?.name ?? ""), 40).i32(opts.nodes.length);
  for (const n of opts.nodes) {
    w.fixed(ascii(n.name), 40).fixed(ascii(n.parent ?? ""), 40).i32(n.textures.length);
    for (const t of n.textures) w.i32(t);
    for (const m of [1, 0, 0, 0, 1, 0, 0, 0, 1]) w.f32(m);
    const [px, py, pz] = n.position ?? [0, 0, 0];
    w.f32(0).f32(0).f32(0).f32(px).f32(py).f32(pz).f32(0).f32(0).f32(1).f32(0).f32(1).f32(1).f32(1);
    w.i32(n.vertices.length);
    for (const [x, y, z] of n.vertices) w.f32(x).f32(y).f32(z);
    w.i32(n.tvertices.length);
    for (const [u, tv] of n.tvertices) {
      if (v >= 102) w.u32(0xffffffff);
      w.f32(u).f32(tv);
    }
    w.i32(n.faces.length);
    for (const f of n.faces) {
      w.u16(f.v[0]).u16(f.v[1]).u16(f.v[2]).u16(f.t[0]).u16(f.t[1]).u16(f.t[2]).u16(f.texture).u16(0).i32(0);
      if (v >= 102) w.i32(0);
    }
    if (v >= 105) w.i32(0);
    w.i32(1).i32(0).f32(0).f32(0).f32(0).f32(1);
  }
  if (v < 105) w.i32(0);
  w.i32(1).f32(1).f32(1).f32(1).f32(0).f32(0).f32(0).f32(0).f32(0).f32(0);
  if (v >= 103) w.i32(0);
  return w.done();
}
