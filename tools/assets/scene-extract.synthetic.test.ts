import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AssetWhitelist } from "@ro-survivor/asset-contracts";
import { createAssetReader } from "@ro-survivor/asset-gateway";
import type { WhitelistRow } from "@ro-survivor/content-schema";
import { parseBmp } from "@ro-survivor/ro-format-runtime";
import { createTempDir } from "@ro-survivor/testkit";
import { decodeOwnPng } from "../lib/png.ts";
import { runExtraction } from "./extract-run.ts";
import { extractScene, SceneExtractionError } from "./scene-extract.ts";
import { buildSyntheticSources } from "./synthetic-sources.ts";

const repoRoot = resolve(import.meta.dirname, "../..");
const realRows = AssetWhitelist.fromCsv(readFileSync(join(repoRoot, "docs/product-plan/handoff/fan-local-asset-whitelist.csv"), "utf8")).rows();
const cleanups: (() => void)[] = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

function setup(mutate?: (rows: WhitelistRow[]) => WhitelistRow[]) {
  const d = createTempDir("scene-");
  cleanups.push(() => d.dispose());
  const src = buildSyntheticSources(join(d.root, "src"), realRows);
  const reader = createAssetReader(src.lock);
  cleanups.push(() => reader.close());
  return { rows: mutate ? mutate(src.rows) : src.rows, reader, out: join(d.root, "derived") };
}
const sceneError = (fn: () => unknown): SceneExtractionError => {
  try {
    fn();
  } catch (err) {
    if (err instanceof SceneExtractionError) return err;
    throw err;
  }
  throw new Error("expected SceneExtractionError");
};

describe("Commit B scene extraction (synthetic structural fixture — not RO evidence)", () => {
  it("extracts the full closure: GND 1.7 + lightmaps, 23 GRSM models, placements, 44+21 textures, 32 water frames, shadow, audio", () => {
    const { rows, reader, out } = setup();
    const { summary } = extractScene(rows, reader, out);
    expect(summary).toEqual({
      rswVersion: "2.1", gndVersion: "1.7", groundTextures: 21, lightmaps: 16, surfaces: 32 * 32, uniqueModels: 23, placements: 69, modelTextures: 44,
      waterType: 1, waterFrames: 32, waterCells: summary.waterCells, ambientSounds: 4, shadowLayerAlpha: [128],
    });
    expect(summary.waterCells).toBeGreaterThan(0);
    expect(summary.waterCells).toBeLessThan(32 * 32);
    const scene = JSON.parse(readFileSync(join(out, "map.prt_fild08.rsw.json"), "utf8")) as {
      sources: Record<string, string>; converterVersion: number; models: { modelAssetId: string | null }[]; water: { frames: string[]; type: number };
      sounds: { assetId: string | null }[]; textures: { format: string; filter: string; derived: { file: string | null } }[]; audio: { assetId: string; format: string }[];
    };
    expect(scene.converterVersion).toBe(2);
    expect(Object.keys(scene.sources).sort()).toEqual(["bgm", "data.grf", "rdata.grf", "system"]);
    expect(scene.models.every((m) => m.modelAssetId?.startsWith("map.prt_fild08.model."))).toBe(true);
    expect(scene.water.frames).toHaveLength(32);
    expect(scene.sounds.every((s) => s.assetId?.startsWith("map.prt_fild08.ambient_sound."))).toBe(true);
    expect(scene.textures.filter((t) => t.format === "bmp")).toHaveLength(65);
    expect(scene.textures.filter((t) => t.format === "jpg" && t.derived.file === null)).toHaveLength(32); // original bytes, no re-encode
    expect(scene.textures.every((t) => t.filter === "nearest")).toBe(true);
    expect(scene.audio.map((a) => a.format).sort()).toEqual(["mp3", "wav", "wav", "wav", "wav"]);
    const shadow = JSON.parse(readFileSync(join(out, "common.shadow.act.json"), "utf8")) as { actions: { frames: { layers: { color: number[] }[] }[] }[] };
    expect(shadow.actions[0]?.frames[0]?.layers[0]?.color[3]).toBe(128);
    const gnd = JSON.parse(readFileSync(join(out, "map.prt_fild08.gnd.json"), "utf8")) as { lightmap: { count: number; atlas: { file: string } }; surfaces: { u: number[] }; cubes: { heights: number[] } };
    expect(gnd.lightmap.count).toBe(16);
    expect(gnd.surfaces.u).toHaveLength(32 * 32 * 4);
    expect(gnd.cubes.heights).toHaveLength(32 * 32 * 4);
    expect(existsSync(join(out, gnd.lightmap.atlas.file))).toBe(true);
    expect(readdirSync(out).filter((f) => /^map\.prt_fild08\.model\.\d+\.json$/u.test(f))).toHaveLength(23);
  });

  it("BMP -> PNG is lossless (same size, same RGB) and keeps the colour key as alpha 0", () => {
    const { rows, reader, out } = setup();
    extractScene(rows, reader, out);
    for (const id of ["map.prt_fild08.ground_texture.001", "map.prt_fild08.ground_texture.002", "map.prt_fild08.model_texture.001"]) {
      const src = parseBmp(reader.read(rows.find((r) => r.asset_id === id) as WhitelistRow).bytes);
      const png = decodeOwnPng(readFileSync(join(out, `${id}.png`)));
      expect([png.width, png.height]).toEqual([src.width, src.height]);
      expect(Buffer.from(png.rgba).equals(Buffer.from(src.rgba))).toBe(true);
    }
  });

  it("is deterministic and keyed to the converter version", () => {
    const a = setup();
    const b = setup();
    const hashes = (x: ReturnType<typeof setup>) => extractScene(x.rows, x.reader, x.out).outputs.map((o) => `${o.file}:${o.sha256}`);
    expect(hashes(a)).toEqual(hashes(b));
  });

  it("an RSM texture without a whitelist row fails closed with its canonical path", () => {
    const { rows, reader, out } = setup((r) => r.filter((x) => x.asset_id !== "map.prt_fild08.model_texture.007"));
    const target = realRows.find((r) => r.asset_id === "map.prt_fild08.model_texture.007") as WhitelistRow;
    const err = sceneError(() => extractScene(rows, reader, out));
    expect(err.missing).toEqual([expect.objectContaining({ assetId: null, container: "data.grf", canonicalPath: target.canonical_cp949_path })]);
    expect(existsSync(join(out, "map.prt_fild08.rsw.json"))).toBe(false);
    expect(existsSync(join(out, "reports", "prt_fild08-scene-missing.json"))).toBe(true);
  });

  it("an unreadable or malformed dependency is reported by logical ID + path; runExtraction writes no manifest", () => {
    const { rows, reader, out } = setup((r) => r.map((x) =>
      x.asset_id === "map.prt_fild08.ambient_sound.002" ? { ...x, bytes: x.bytes + 1 } : x));
    const wav = rows.find((r) => r.asset_id === "map.prt_fild08.ambient_sound.002") as WhitelistRow;
    const err = sceneError(() => runExtraction(rows, reader, out));
    expect(err.missing).toEqual([expect.objectContaining({ assetId: "map.prt_fild08.ambient_sound.002", canonicalPath: wav.canonical_cp949_path, reason: expect.stringContaining("source unreadable") as unknown })]);
    expect(existsSync(join(out, "manifest.json"))).toBe(false);
  });

  it("a missing official shadow or water frame is never substituted", () => {
    const { rows, reader, out } = setup((r) => r.filter((x) => x.asset_id !== "common.shadow.act" && x.asset_id !== "map.prt_fild08.water_texture.032"));
    const err = sceneError(() => extractScene(rows, reader, out));
    expect(err.missing.map((m) => [m.assetId, m.canonicalPath])).toEqual([
      [null, "data\\texture\\워터\\water131.jpg"],
      ["common.shadow.act", "(not in whitelist)"],
    ]);
  });
});
