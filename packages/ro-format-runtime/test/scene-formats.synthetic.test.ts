import { describe, expect, it } from "vitest";
import { writeBmp24, writeBmp8, writeGnd, writeJpegHeader, writeRsm, writeRsw, writeWav, syntheticBytes } from "@ro-survivor/testkit";
import { FormatError, parseBmp, parseGnd, parseRsm, parseRsw, readJpegInfo, readWavInfo } from "../src/index.ts";

const ascii = (s: string) => Uint8Array.from([...s].map((c) => c.charCodeAt(0)));
const truncate = (b: Uint8Array, n: number) => b.subarray(0, b.length - n);
const patch = (b: Uint8Array, at: number, values: number[]) => {
  const c = b.slice();
  c.set(values, at);
  return c;
};

describe("BMP (synthetic)", () => {
  it("8-bit paletted: lossless RGBA, magenta key -> alpha 0, bottom-up rows flipped", () => {
    const bmp = writeBmp8(5, 3, (x, y) => (x === 0 && y === 0 ? 0 : 10 + y), (i) => (i === 0 ? [255, 0, 255] : [i, i * 2, i * 3]));
    const b = parseBmp(bmp);
    expect([b.width, b.height, b.bitsPerPixel, b.keyedPixels]).toEqual([5, 3, 8, 1]);
    expect([...b.rgba.subarray(0, 4)]).toEqual([255, 0, 255, 0]); // (0,0) keyed, RGB kept
    expect([...b.rgba.subarray(4, 8)]).toEqual([10, 20, 30, 255]); // (1,0) palette 10
    expect([...b.rgba.subarray((2 * 5 + 1) * 4, (2 * 5 + 1) * 4 + 4)]).toEqual([12, 24, 36, 255]); // (1,2)
  });

  it("24-bit with row padding; negative height means top-down", () => {
    const b = parseBmp(writeBmp24(3, 2, (x, y) => [x * 10, y * 20, 7]));
    expect([...b.rgba.subarray(((1 * 3) + 2) * 4, ((1 * 3) + 2) * 4 + 4)]).toEqual([20, 20, 7, 255]);
    const td = patch(writeBmp24(3, 2, (x, y) => [x, y, 0]), 22, [0xfe, 0xff, 0xff, 0xff]); // height = -2
    expect(parseBmp(td).height).toBe(2);
  });

  it("rejects bad magic, truncation, unsupported depth and compression", () => {
    const ok = writeBmp24(4, 4, () => [1, 2, 3]);
    expect(() => parseBmp(patch(ok, 0, [0x42, 0x41]))).toThrow(/bad magic/u);
    expect(() => parseBmp(truncate(ok, 5))).toThrow(/truncated pixel data/u);
    expect(() => parseBmp(patch(ok, 28, [16, 0]))).toThrow(/unsupported 16 bits/u);
    // 32-bit is rejected until a verified BGRA/BGRX alpha policy exists (no silently dropped 4th byte).
    expect(() => parseBmp(patch(ok, 28, [32, 0]))).toThrow(/unsupported 32 bits per pixel \(supported: 8, 24\)/u);
    expect(() => parseBmp(patch(ok, 30, [1, 0, 0, 0]))).toThrow(/unsupported compression 1/u);
    expect(() => parseBmp(ok.subarray(0, 20))).toThrow(FormatError);
  });
});

describe("JPEG header (synthetic)", () => {
  it("reads SOF0 dimensions without decoding", () => {
    expect(readJpegInfo(writeJpegHeader(128, 64))).toEqual({ width: 128, height: 64, components: 3, progressive: false });
  });
  it("rejects missing SOI, truncated segments and files without a frame header", () => {
    const j = writeJpegHeader(32, 32);
    expect(() => readJpegInfo(patch(j, 0, [0, 0]))).toThrow(/SOI/u);
    expect(() => readJpegInfo(j.subarray(0, 30))).toThrow(/truncated segment|no SOF/u);
    expect(() => readJpegInfo(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]))).toThrow(/no SOF/u);
  });
});

const model = (version?: [number, number]) =>
  writeRsm({
    version,
    alpha: 200,
    textures: [ascii("tex\\a.bmp"), ascii("tex\\b.bmp")],
    nodes: [
      { name: "root", textures: [0, 1], vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], tvertices: [[0, 0], [1, 0], [0, 1]], faces: [{ v: [0, 1, 2], t: [0, 1, 2], texture: 1 }] },
      { name: "leaf", parent: "root", textures: [1], vertices: [[0, 0, 0], [1, 1, 1], [2, 0, 0]], tvertices: [[0, 0], [1, 1], [1, 0]], faces: [{ v: [0, 1, 2], t: [0, 1, 2], texture: 0 }], position: [1, 2, 3] },
    ],
  });

describe("GRSM (synthetic)", () => {
  it("parses 1.4: textures, node tree, mesh, transforms, alpha, volume boxes", () => {
    const m = parseRsm(model());
    expect(m.version).toBe("1.4");
    expect(m.alpha).toBe(200);
    expect(m.textures).toEqual(["tex\\a.bmp", "tex\\b.bmp"]);
    expect(m.mainNode).toBe("root");
    expect(m.nodes.map((n) => [n.name, n.parent, n.textures, n.faces.length])).toEqual([["root", "", [0, 1], 1], ["leaf", "root", [1], 1]]);
    expect(m.nodes[1]?.position).toEqual([1, 2, 3]);
    expect(m.nodes[0]?.faces[0]).toEqual({ vertices: [0, 1, 2], tvertices: [0, 1, 2], texture: 1, twoSide: false, smoothGroup: 0 });
    expect(m.nodes[0]?.rotKeyframes).toHaveLength(1);
    expect(m.volumeBoxes).toHaveLength(1);
  });

  it("parses 1.1 (no colour / smooth group) and 1.5 (per-node position keys)", () => {
    expect(parseRsm(model([1, 1])).nodes[0]?.tvertices[0]?.color).toBe(0xffffffff);
    expect(parseRsm(model([1, 5])).version).toBe("1.5");
  });

  it("rejects bad magic, truncation, unsupported versions and out-of-range indices", () => {
    const ok = model();
    expect(() => parseRsm(patch(ok, 0, [0x58]))).toThrow(/bad magic/u);
    expect(() => parseRsm(ok.subarray(0, 200))).toThrow(/unexpected end/u);
    expect(() => parseRsm(patch(ok, 4, [2, 2]))).toThrow(/unsupported version 2.2/u);
    const badTex = writeRsm({ textures: [ascii("a.bmp")], nodes: [{ name: "n", textures: [3], vertices: [], tvertices: [], faces: [] }] });
    expect(() => parseRsm(badTex)).toThrow(/texture index 3 outside 1/u);
    const badVert = writeRsm({ textures: [ascii("a.bmp")], nodes: [{ name: "n", textures: [0], vertices: [[0, 0, 0]], tvertices: [[0, 0]], faces: [{ v: [0, 0, 5], t: [0, 0, 0], texture: 0 }] }] });
    expect(() => parseRsm(badVert)).toThrow(/vertex index outside 1/u);
    const orphan = writeRsm({ textures: [], nodes: [{ name: "a", textures: [], vertices: [], tvertices: [], faces: [] }, { name: "b", parent: "ghost", textures: [], vertices: [], tvertices: [], faces: [] }] });
    expect(() => parseRsm(orphan)).toThrow(/unknown parent "ghost"/u);
  });
});

/**
 * Golden legacy GRSM bytes assembled field by field here, independently of the testkit writer:
 * one node (rotation keys only), then model-level position keys (frame + x/y/z + data, 20 bytes
 * each) and volume boxes after all nodes.
 */
function goldenRsm(minor: number, extra: number[] = []): Uint8Array {
  const out: number[] = [];
  const dv = new DataView(new ArrayBuffer(4));
  const i32 = (v: number) => { dv.setInt32(0, v, true); out.push(...new Uint8Array(dv.buffer)); };
  const u32 = (v: number) => { dv.setUint32(0, v, true); out.push(...new Uint8Array(dv.buffer)); };
  const f32 = (v: number) => { dv.setFloat32(0, v, true); out.push(...new Uint8Array(dv.buffer)); };
  const u16 = (v: number) => out.push(v & 0xff, (v >> 8) & 0xff);
  const str = (t: string, n: number) => { const b = [...t].map((c) => c.charCodeAt(0)); out.push(...b, ...new Array<number>(n - b.length).fill(0)); };
  out.push(0x47, 0x52, 0x53, 0x4d, 1, minor);
  i32(12); i32(2); out.push(77); out.push(...new Array<number>(16).fill(0)); // animLen, shadeType, alpha, reserved
  i32(1); str("g\\leaf.bmp", 40);
  str("main", 40); i32(1);
  str("main", 40); str("", 40); i32(1); i32(0);
  for (const m of [1, 0, 0, 0, 1, 0, 0, 0, 1]) f32(m);
  for (const x of [0.5, 0, 0, 10, -5, 20, 0.25, 0, 1, 0, 2, 2, 2]) f32(x); // offset, position, rotAngle, rotAxis, scale
  i32(3); for (const x of [0, 0, 0, 1, 0, 0, 0, 1, 0]) f32(x);
  i32(3); for (const [u, v] of [[0, 0], [1, 0], [0, 1]]) { u32(0xff336699); f32(u as number); f32(v as number); }
  i32(1); u16(0); u16(1); u16(2); u16(0); u16(1); u16(2); u16(0); u16(0); i32(1); i32(3);
  i32(1); i32(5); f32(0); f32(0.5); f32(0); f32(0.75); // one rotation key
  i32(2); // model-level position keys
  i32(7); f32(1.5); f32(-2.25); f32(3); f32(42.5);
  i32(9); f32(-1); f32(0); f32(8); f32(-0.125);
  i32(1); for (const x of [4, 5, 6, 1, 2, 3, 0, 90, 0]) f32(x); i32(1); // one volume box + flag
  out.push(...extra);
  return Uint8Array.from(out);
}

describe("GRSM legacy golden fixture (independent bytes)", () => {
  it("1.4: node without position keys; model-level keys keep the data field; volume box after", () => {
    const m = parseRsm(goldenRsm(4));
    expect([m.version, m.animLength, m.shadeType, m.alpha]).toEqual(["1.4", 12, 2, 77]);
    expect(m.nodes[0]).toMatchObject({ name: "main", position: [10, -5, 20], scale: [2, 2, 2], rotKeyframes: [{ frame: 5, quaternion: [0, 0.5, 0, 0.75] }] });
    expect(m.nodes[0]).not.toHaveProperty("posKeyframes");
    expect(m.nodes[0]?.tvertices[0]).toEqual({ color: 0xff336699, u: 0, v: 0 });
    expect(m.nodes[0]?.faces[0]).toEqual({ vertices: [0, 1, 2], tvertices: [0, 1, 2], texture: 0, twoSide: true, smoothGroup: 3 });
    expect(m.posKeyframes).toEqual([{ frame: 7, position: [1.5, -2.25, 3], data: 42.5 }, { frame: 9, position: [-1, 0, 8], data: -0.125 }]);
    expect(m.volumeBoxes).toEqual([{ size: [4, 5, 6], position: [1, 2, 3], rotation: [0, 90, 0], flag: 1 }]);
  });

  it("1.5 regression: same legacy layout (no per-node position keys)", () => {
    const m = parseRsm(goldenRsm(5));
    expect(m.version).toBe("1.5");
    expect(m.posKeyframes.map((k) => k.data)).toEqual([42.5, -0.125]);
    expect(m.volumeBoxes).toHaveLength(1);
  });

  it("bytes after the volume boxes are a FormatError, not a warning", () => {
    expect(() => parseRsm(goldenRsm(4, [0, 0, 0, 0]))).toThrow(/4 trailing bytes after the volume boxes/u);
  });
});

describe("GND 1.7 lightmaps and RSW water / sounds (synthetic)", () => {
  it("keeps every embedded lightmap block and validates surface / cube links", () => {
    const g = parseGnd(writeGnd(4, 4, [ascii("t.bmp")], () => 0, { lightmaps: 5 }));
    expect(g.lightmap.count).toBe(5);
    expect(g.lightmap.data.length).toBe(5 * 256);
    expect(g.surfaces.map((s) => s.lightmapId).slice(0, 6)).toEqual([0, 1, 2, 3, 4, 0]);
    expect(() => parseGnd(writeGnd(4, 4, [ascii("t.bmp")], () => 0, { version: [1, 4] }))).toThrow(/unsupported version 1.4/u);
    expect(() => parseGnd(truncate(writeGnd(4, 4, [ascii("t.bmp")]), 3))).toThrow(FormatError);
  });

  it("reads water parameters, placements and full sound records", () => {
    const r = parseRsw(writeRsw({ gnd: "g.gnd", gat: "g.gat", waterType: 1, waterLevel: 2.5, models: [{ name: "m", file: ascii("x.rsm"), position: [5, 6, 7], scale: [2, 2, 2] }], sounds: [ascii("bird.wav")] }));
    expect(r.water).toEqual({ level: 2.5, type: 1, waveHeight: 1, waveSpeed: 2, wavePitch: 50, animSpeed: 3 });
    expect(r.models[0]).toMatchObject({ file: "x.rsm", position: [5, 6, 7], scale: [2, 2, 2] });
    expect(r.sounds[0]).toEqual({ name: "sound0", file: "bird.wav", position: [0, 0, 0], volume: 1, width: 1, height: 1, range: 10, cycle: 4 });
  });
});

describe("WAV header (synthetic)", () => {
  it("reads fmt + data and rejects truncated / dataless files", () => {
    const w = writeWav(syntheticBytes(1, 11025));
    expect(readWavInfo(w)).toEqual({ audioFormat: 1, channels: 1, sampleRate: 11025, bitsPerSample: 8, dataBytes: 11025, durationMs: 1000 });
    expect(() => readWavInfo(truncate(w, 100))).toThrow(/truncated/u);
    expect(() => readWavInfo(w.subarray(0, 36))).toThrow(/no data chunk/u);
    expect(() => readWavInfo(patch(w, 8, [0x41]))).toThrow(/WAVE/u);
  });
});
