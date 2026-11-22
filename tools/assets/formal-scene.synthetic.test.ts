/**
 * Commit C contract test (synthetic structural fixture — not RO visual evidence): the client's formal
 * scene loader consumes the real extractor output through a real gateway (manifest gate on) and
 * builds ground, prop instances, shadow, water and positional sound inputs from it.
 */
import { readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AssetWhitelist, HttpAssetGatewayClient } from "@ro-survivor/asset-contracts";
import { createAssetReader, startGateway } from "@ro-survivor/asset-gateway";
import { readJpegInfo } from "@ro-survivor/ro-format-runtime";
import { createTempDir } from "@ro-survivor/testkit";
import { disposeFormalScene, loadFormalScene, type FormalDecoders } from "../../apps/client/src/game/formal/load.ts";
import { MissingAssetsError } from "../../apps/client/src/game/requirements.ts";
import { runExtraction } from "./extract-run.ts";
import { CANONICAL_WHITELIST_SHA256 } from "@ro-survivor/asset-contracts";
/** Verified lock of the reader + canonical v3 whitelist hash (synthetic run). */
const identityOf = (r: { lockId: string }) => ({ lockId: r.lockId, whitelistSha256: CANONICAL_WHITELIST_SHA256 });
import { buildSyntheticSources } from "./synthetic-sources.ts";

const repoRoot = resolve(import.meta.dirname, "../..");
const realRows = AssetWhitelist.fromCsv(readFileSync(join(repoRoot, "docs/product-plan/handoff/fan-local-asset-whitelist.csv"), "utf8")).rows();
const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()?.();
});

/** Header-only decoders: dimensions from the PNG IHDR / JPEG SOF, as the browser would report them. */
const decoders: FormalDecoders = {
  image(bytes, type) {
    if (type === "image/png") {
      const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      return Promise.resolve({ width: v.getUint32(16), height: v.getUint32(20) });
    }
    const j = readJpegInfo(bytes);
    return Promise.resolve({ width: j.width, height: j.height });
  },
};

async function setup() {
  const d = createTempDir("formal-scene-");
  cleanups.push(() => d.dispose());
  const src = buildSyntheticSources(join(d.root, "src"), realRows);
  const reader = createAssetReader(src.lock);
  cleanups.push(() => reader.close());
  const out = join(d.root, "derived");
  runExtraction(src.rows, reader, out, { identity: identityOf(reader) });
  const whitelist = new AssetWhitelist(src.rows);
  const gw = await startGateway({ config: { host: "127.0.0.1", port: 0, lanProfile: null }, whitelist, lock: src.lock, buildId: "t", derivedDir: out });
  cleanups.push(() => gw.close());
  return { client: new HttpAssetGatewayClient({ baseUrl: gw.url, whitelist }), whitelist, out };
}

describe("formal scene loader on the real derived contract (synthetic sources)", () => {
  it("builds the scene and loads all 12 official skill-effect metadata records plus 11 textures", async () => {
    const { client, whitelist, out } = await setup();
    const s = await loadFormalScene(client, decoders, whitelist);
    // Ground: one up-surface per GND cube (32×32) with texture UV, colour and lightmap UV per vertex.
    expect(s.ground.quads).toBe(32 * 32);
    const verts = s.ground.groups.reduce((n, g) => n + g.positions.length / 3, 0);
    expect(verts).toBe(32 * 32 * 6);
    for (const g of s.ground.groups) {
      expect(g.uvs.length / 2).toBe(g.positions.length / 3);
      expect(g.lightmapUvs.length / 2).toBe(g.positions.length / 3);
      expect(g.colors.length / 3).toBe(g.positions.length / 3);
      expect(g.assetId).toMatch(/^map\.prt_fild08\.ground_texture\.\d{3}$/u);
      expect(s.images.has(g.assetId)).toBe(true);
    }
    expect(s.images.get("map.prt_fild08.gnd")).toEqual({ width: 32, height: 32 }); // 16 lightmaps -> 4×4 tiles of 8 px
    expect(s.instances).toHaveLength(69);
    expect(new Set(s.instances.map((i) => i.modelAssetId)).size).toBe(23);
    expect(s.baked.size).toBe(23);
    const modelTextures = new Set([...s.baked.values()].flatMap((b) => b.groups.map((g) => g.assetId)));
    expect(modelTextures.size).toBe(44);
    expect(s.shadowParams).toMatchObject({ alpha: 128 / 255, scale: 1 });
    expect(s.water.size).toBe(32);
    // Water geometry = exactly the extractor's selected cells (synthetic count, not the real client's).
    const derivedScene = JSON.parse(readFileSync(join(out, "map.prt_fild08.rsw.json"), "utf8")) as { water: { cells: number } };
    expect(derivedScene.water.cells).toBeGreaterThan(0);
    expect(derivedScene.water.cells).toBeLessThan(32 * 32);
    expect(s.waterCells?.cells).toBe(derivedScene.water.cells);
    expect(s.waterCells?.positions.length).toBe(derivedScene.water.cells * 6 * 3);
    expect(s.audio.size).toBe(11); // BGM + 4 RSW ambience + 6 official hit/skill WAVs
    expect([...s.audio.keys()].filter((id) => id.startsWith("audio.")).sort()).toEqual([
      "audio.hit.physical",
      "audio.skill.sw.bash",
      "audio.skill.sw.endure",
      "audio.skill.sw.magnum_break",
      "audio.skill.sw.provoke",
      "audio.skill.sw.shield_wave",
    ]);
    expect(s.effects.size).toBe(12);
    expect(s.effectImages.size).toBe(11);
    expect(s.effects.get("effect.skill.sw.provoke.str")).toMatchObject({ kind: "animation-source", magic: "STRM", parsed: false, sourceOnly: true });
    expect(s.effects.get("effect.skill.sw.shield_wave.projectile")).toMatchObject({ kind: "texture", format: "bmp", width: 8, height: 8 });
    expect(s.effectImages.get("effect.skill.sw.endure")).toEqual({ width: 4, height: 4 });
    expect(s.sounds.map((x) => x.assetId).sort()).toEqual(["map.prt_fild08.ambient_sound.001", "map.prt_fild08.ambient_sound.002", "map.prt_fild08.ambient_sound.003", "map.prt_fild08.ambient_sound.004"]);
  });

  it("a missing derived model blocks the world with its asset ID and canonical path", async () => {
    const { client, whitelist, out } = await setup();
    rmSync(join(out, "map.prt_fild08.model.003.json"));
    const err = await loadFormalScene(client, decoders, whitelist).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MissingAssetsError);
    expect((err as MissingAssetsError).missing).toEqual([
      expect.objectContaining({ assetId: "map.prt_fild08.model.003", canonicalPath: whitelist.get("map.prt_fild08.model.003").canonical_cp949_path }),
    ]);
  });

  it("a missing official shadow atlas blocks the world; nothing is substituted", async () => {
    const { client, whitelist, out } = await setup();
    rmSync(join(out, "common.shadow.spr.png"));
    const err = await loadFormalScene(client, decoders, whitelist).catch((e: unknown) => e);
    expect((err as MissingAssetsError).missing.map((m) => m.assetId)).toEqual(["common.shadow.spr"]);
  });

  it.each([
    ["effect.skill.sw.shield_wave.projectile.png", "effect.skill.sw.shield_wave.projectile"],
    ["effect.skill.sw.endure.json", "effect.skill.sw.endure"],
    ["effect.skill.sw.endure.png", "effect.skill.sw.endure"],
    ...["alpha_down", "alpha_center", "lens1", "lens2"].flatMap((part) => [
      [`effect.skill.sw.bash.${part}.json`, `effect.skill.sw.bash.${part}`],
      [`effect.skill.sw.bash.${part}.png`, `effect.skill.sw.bash.${part}`],
    ]),
    ...["ring_yellow", "explosion"].flatMap((part) => [
      [`effect.skill.sw.magnum_break.${part}.json`, `effect.skill.sw.magnum_break.${part}`],
      [`effect.skill.sw.magnum_break.${part}.png`, `effect.skill.sw.magnum_break.${part}`],
    ]),
    ...["explosive_1_128", "piero", "pika01"].flatMap((part) => [
      [`effect.skill.sw.provoke.${part}.json`, `effect.skill.sw.provoke.${part}`],
      [`effect.skill.sw.provoke.${part}.png`, `effect.skill.sw.provoke.${part}`],
    ]),
  ])("a missing official effect output %s blocks the world by canonical source path", async (file, id) => {
    const { client, whitelist, out } = await setup();
    rmSync(join(out, file));
    const err = await loadFormalScene(client, decoders, whitelist).catch((caught: unknown) => caught);
    expect(err).toBeInstanceOf(MissingAssetsError);
    expect((err as MissingAssetsError).missing).toEqual([
      expect.objectContaining({ assetId: id, canonicalPath: whitelist.get(id).canonical_cp949_path }),
    ]);
  });

  it("disposal releases and clears every decoded official effect texture", async () => {
    const { client, whitelist } = await setup();
    let closed = 0;
    const tracked: FormalDecoders = {
      async image(bytes, type) {
        const base = await decoders.image(bytes, type);
        return { ...base, close: () => { closed += 1; } };
      },
    };
    const scene = await loadFormalScene(client, tracked, whitelist);
    const expected = new Set([...scene.images.values(), ...scene.water.values(), ...scene.effectImages.values()]).size;
    disposeFormalScene(scene);
    expect(closed).toBe(expected);
    expect(scene.effectImages.size).toBe(0);
    expect(scene.effects.size).toBe(0);
  });
});
