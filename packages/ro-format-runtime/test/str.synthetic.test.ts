import { describe, expect, it } from "vitest";
import { writeStr } from "@ro-survivor/testkit";
import { parseStr, STR_KEY_BYTES } from "../src/str.ts";

const sample = () => writeStr({
  fps: 60, maxKey: 30,
  layers: [
    { textures: ["piero.bmp"], keys: [{ frame: 0, type: 0, color: [255, 200, 100, 0] }, { frame: 0, type: 1, pos: [1, -1], color: [0, 0, 0, 8.5] }, { frame: 20, type: 0 }] },
    { textures: ["pika01.bmp", "explosive_1_128.bmp"], keys: [{ frame: 5, type: 0, aniType: 3, delay: 0.5 }] },
  ],
});

describe("STR 0x94 clean-room parser", () => {
  it("round-trips header, layers, texture names and every key field", () => {
    const s = parseStr(sample());
    expect([s.version, s.fps, s.maxKey, s.layers.length]).toEqual([0x94, 60, 30, 2]);
    expect(s.layers[0]?.textures).toEqual(["piero.bmp"]);
    expect(s.layers[1]?.textures).toEqual(["pika01.bmp", "explosive_1_128.bmp"]);
    expect(s.layers[0]?.keys.map((k) => [k.frame, k.type])).toEqual([[0, 0], [0, 1], [20, 0]]);
    expect(s.layers[0]?.keys[1]).toMatchObject({ pos: [1, -1], color: [0, 0, 0, 8.5], srcBlend: 5, dstBlend: 2 });
    expect(s.layers[1]?.keys[0]).toMatchObject({ aniType: 3, delay: 0.5, uv: [0, 0, 1, 0, 0, 1, 1, 1] });
    const bytes = sample();
    expect(bytes.length).toBe(36 + (4 + 128 + 4 + 3 * STR_KEY_BYTES) + (4 + 256 + 4 + STR_KEY_BYTES));
  });

  it.each([
    ["bad magic", (b: Uint8Array) => { b[0] = 0x58; }, /bad magic/u],
    ["other version", (b: Uint8Array) => { b[4] = 0x95; }, /unsupported version/u],
    ["zero fps", (b: Uint8Array) => { b.set([0, 0, 0, 0], 8); }, /fps 0/u],
    ["huge layer count", (b: Uint8Array) => { b.set([0xff, 0, 0, 0], 16); }, /layer count 255/u],
  ])("rejects %s", (_name, mutate, error) => {
    const b = sample();
    mutate(b);
    expect(() => parseStr(b)).toThrow(error);
  });

  it("rejects truncation, trailing bytes, non-finite floats, bad key types and non-ASCII names", () => {
    const b = sample();
    expect(() => parseStr(b.subarray(0, b.length - 1))).toThrow(/unexpected end/u);
    expect(() => parseStr(Uint8Array.from([...b, 0]))).toThrow(/1 trailing bytes/u);
    const nan = sample();
    new DataView(nan.buffer).setFloat32(36 + 4 + 128 + 4 + 8, Number.NaN, true);
    expect(() => parseStr(nan)).toThrow(/pos is not finite/u);
    expect(() => parseStr(writeStr({ maxKey: 1, layers: [{ textures: ["a.bmp"], keys: [{ frame: 0, type: 2 as 0 }] }] }))).toThrow(/type 2/u);
    expect(() => parseStr(writeStr({ maxKey: 1, layers: [{ textures: ["é.bmp"], keys: [] }] }))).toThrow(/printable ASCII/u);
    expect(() => parseStr(writeStr({ maxKey: 1, layers: [{ textures: ["a.bmp"], keys: [{ frame: 0, type: 0, aniType: 9 }] }] }))).toThrow(/aniType 9/u);
    expect(() => parseStr(writeStr({ maxKey: 1, layers: [{ textures: ["a.bmp"], keys: [{ frame: 0, type: 0, srcBlend: 40 }] }] }))).toThrow(/blend 40/u);
  });
});
