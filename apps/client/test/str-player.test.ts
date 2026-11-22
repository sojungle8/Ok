import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AssetWhitelist } from "@ro-survivor/asset-contracts";
import type { StrKey, StrLayer } from "@ro-survivor/ro-format-runtime/str";
import { writeStr } from "@ro-survivor/testkit";
import { loadStrAnimation } from "../src/game/formal/load.ts";
import { sampleStrLayer, strDurationMs, strKeyIndex } from "../src/game/formal/strPlayer.ts";

const key = (frame: number, type: 0 | 1, extra: Partial<StrKey> = {}): StrKey => ({
  frame, type, pos: [0, 0], uv: [0, 0, 0, 0, 0, 0, 0, 0], xy: [0, 0, 0, 0, 0, 0, 0, 0], aniFrame: 0, aniType: 0, delay: 0, angle: 0,
  color: [0, 0, 0, 0], srcBlend: 5, dstBlend: 2, mtPreset: 0, ...extra,
});
const base = (frame: number, extra: Partial<StrKey> = {}): StrKey => key(frame, 0, { pos: [320, 320], uv: [0, 0, 1, 0, 0, 1, 1, 1], xy: [-8, 8, -8, 8, -8, -8, 8, 8], color: [255, 255, 255, 255], ...extra });

describe("STR playback sampling", () => {
  it("advances at the file fps and ends at maxKey", () => {
    const str = { version: 0x94 as const, fps: 30, maxKey: 15, layers: [] };
    expect(strDurationMs(str)).toBe(500);
    expect(strKeyIndex(str, 0)).toBe(0);
    expect(strKeyIndex(str, 99)).toBe(2);
  });

  it("hides a layer before its first base key and after its last key frame", () => {
    const layer: StrLayer = { textures: ["a.bmp"], keys: [base(5), base(10)] };
    expect(sampleStrLayer(layer, 4).visible).toBe(false);
    expect(sampleStrLayer(layer, 5).visible).toBe(true);
    expect(sampleStrLayer(layer, 10).visible).toBe(true);
    expect(sampleStrLayer(layer, 11).visible).toBe(false);
    expect(sampleStrLayer({ textures: [], keys: [base(0)] }, 0).visible).toBe(false);
  });

  it("applies a same-frame delta key linearly to position, corners, angle and colour", () => {
    const layer: StrLayer = { textures: ["a.bmp"], keys: [base(0, { color: [255, 255, 255, 100] }), key(0, 1, { pos: [2, -1], xy: [1, 1, 1, 1, 0, 0, 0, 0], angle: 3, color: [0, 0, 0, 10] }), base(20)] };
    const s = sampleStrLayer(layer, 5);
    expect(s.pos).toEqual([330, 315]);
    expect(s.xy.slice(0, 4)).toEqual([-3, 13, -3, 13]);
    expect(s.angleDeg).toBe(15);
    expect(s.color[3]).toBeCloseTo(150 / 255);
    expect(sampleStrLayer(layer, 20).pos).toEqual([320, 320]);
  });

  it("clamps colour and hides a fully transparent layer", () => {
    const layer: StrLayer = { textures: ["a.bmp"], keys: [base(0, { color: [255, 255, 255, 20] }), key(0, 1, { color: [10, 0, 0, -10] }), base(30)] };
    expect(sampleStrLayer(layer, 1).color[0]).toBe(1);
    expect(sampleStrLayer(layer, 3).visible).toBe(false);
  });

  it.each([
    [0, 1, 0],
    [1, 2, 1],
    [2, 9, 2],
    [3, 4, 0],
    [4, 4, 0],
  ])("aniType %i selects texture index from the delta (key %i → %i)", (aniType, at, expected) => {
    const layer: StrLayer = { textures: ["a.bmp", "b.bmp", "c.bmp"], keys: [base(0, { aniType, aniFrame: 0 }), key(0, 1, { aniFrame: 0.5, delay: 0.75 }), base(30)] };
    expect(sampleStrLayer(layer, at).textureIndex).toBe(expected);
  });
});

const root = resolve(import.meta.dirname, "../../..");
const realWhitelist = AssetWhitelist.fromCsv(readFileSync(resolve(root, "docs/product-plan/handoff/fan-local-asset-whitelist.csv"), "utf8"));
const STR_ID = "effect.skill.sw.provoke.str";
/** The real whitelist, with only the STR row's size/hash swapped for the synthetic bytes under test. */
function whitelistFor(bytes: Uint8Array): AssetWhitelist {
  const sha = createHash("sha256").update(bytes).digest("hex").toUpperCase();
  return new Proxy(realWhitelist, {
    get(target, prop) {
      if (prop === "get") return (id: string) => (id === STR_ID ? { ...target.get(id), bytes: bytes.length, sha256: sha } : target.get(id));
      const v = Reflect.get(target, prop, target) as unknown;
      return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(target) : v;
    },
  });
}

describe("client-side STR verification and texture resolution", () => {
  const good = writeStr({ maxKey: 10, layers: [{ textures: ["piero.bmp", "PIKA01.BMP"], keys: [{ frame: 0, type: 0 }] }, { textures: ["explosive_1_128.bmp"], keys: [] }] });

  it("parses verified bytes and resolves every layer texture to a required effect texture ID", async () => {
    const anim = await loadStrAnimation(STR_ID, good, whitelistFor(good));
    expect(anim.str.layers).toHaveLength(2);
    expect(anim.layerTextures).toEqual([["effect.skill.sw.provoke.piero", "effect.skill.sw.provoke.pika01"], ["effect.skill.sw.provoke.explosive_1_128"]]);
  });

  it("fails closed on size or SHA-256 drift against the whitelist", async () => {
    await expect(loadStrAnimation(STR_ID, good, realWhitelist)).rejects.toThrow(/bytes != whitelist|SHA-256/u);
    const other = Uint8Array.from(good);
    other[good.length - 1] = (other[good.length - 1] ?? 0) ^ 1;
    await expect(loadStrAnimation(STR_ID, other, whitelistFor(good))).rejects.toThrow(/STR SHA-256/u);
  });

  it("fails closed on a malformed STR or a texture outside the verified effect set", async () => {
    const malformed = Uint8Array.from(good);
    malformed[4] = 0x95;
    await expect(loadStrAnimation(STR_ID, malformed, whitelistFor(malformed))).rejects.toThrow(/unsupported version/u);
    const foreign = writeStr({ maxKey: 1, layers: [{ textures: ["not_whitelisted.bmp"], keys: [] }] });
    await expect(loadStrAnimation(STR_ID, foreign, whitelistFor(foreign))).rejects.toThrow(/not_whitelisted\.bmp is not a whitelisted required effect texture/u);
    const audio = writeStr({ maxKey: 1, layers: [{ textures: ["../../wav/effect/ef_bash.wav"], keys: [] }] });
    await expect(loadStrAnimation(STR_ID, audio, whitelistFor(audio))).rejects.toThrow(/is not a whitelisted required effect texture/u);
  });
});
