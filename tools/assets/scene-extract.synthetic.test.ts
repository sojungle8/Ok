import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AssetWhitelist } from "@ro-survivor/asset-contracts";
import { createAssetReader } from "@ro-survivor/asset-gateway";
import type { WhitelistRow } from "@ro-survivor/content-schema";
import { parseBmp } from "@ro-survivor/ro-format-runtime";
import { createTempDir } from "@ro-survivor/testkit";
import { decodeOwnPng } from "../lib/png.ts";
import { HttpAssetGatewayClient } from "@ro-survivor/asset-contracts";
import { startGateway } from "@ro-survivor/asset-gateway";
import { extractCommand, MANIFEST_FILE, MISSING_REPORT, runExtraction, type ExtractManifest } from "./extract-run.ts";
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
  return { rows: mutate ? mutate(src.rows) : src.rows, reader, out: join(d.root, "derived"), lock: src.lock, root: d.root, cleanRows: src.rows };
}
const row = (rows: readonly WhitelistRow[], id: string) => rows.find((r) => r.asset_id === id) as WhitelistRow;
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

  it("transactional re-run: success, then a corrupted dependency in the same outDir leaves no ready manifest and the gateway serves nothing", async () => {
    const { cleanRows, reader, out, lock, root } = setup();
    runExtraction(cleanRows, reader, out);
    expect(existsSync(join(out, MANIFEST_FILE))).toBe(true);
    const gw = await startGateway({ config: { host: "127.0.0.1", port: 0, lanProfile: null }, whitelist: new AssetWhitelist(cleanRows), lock, buildId: "t", derivedDir: out });
    cleanups.push(() => void gw.close());
    const client = new HttpAssetGatewayClient({ baseUrl: gw.url, whitelist: new AssetWhitelist(cleanRows) });
    await expect(client.getJson("map.prt_fild08.rsw")).resolves.toMatchObject({ assetId: "map.prt_fild08.rsw" });

    const broken = cleanRows.map((r) => (r.asset_id === "map.prt_fild08.model.003" ? { ...r, sha256: "0".repeat(64) } : r));
    const err = sceneError(() => runExtraction(broken, reader, out));
    expect(err.missing.map((m) => m.assetId)).toEqual(["map.prt_fild08.model.003"]);
    expect(existsSync(join(out, MANIFEST_FILE))).toBe(false);
    expect(existsSync(join(out, MISSING_REPORT))).toBe(true);
    expect(readdirSync(root).filter((f) => f.includes(".staging-") || f.includes(".old-"))).toEqual([]);
    // Files from the earlier successful run are still on disk, but nothing is served without a ready manifest.
    expect(existsSync(join(out, "map.prt_fild08.rsw.json"))).toBe(true);
    await expect(client.getJson("map.prt_fild08.rsw")).rejects.toMatchObject({ code: "http-404" });

    // A clean re-run publishes again (atomic swap; no staging left behind).
    runExtraction(cleanRows, reader, out);
    await expect(client.getJson("map.prt_fild08.rsw")).resolves.toMatchObject({ assetId: "map.prt_fild08.rsw" });
    expect(readdirSync(root).filter((f) => f.includes(".staging-") || f.includes(".old-"))).toEqual([]);
  });

  it.each([
    ["map.prt_fild08.rsw", "source unreadable", (rows: WhitelistRow[]) => rows.map((r) => (r.asset_id === "map.prt_fild08.rsw" ? { ...r, bytes: r.bytes + 1 } : r))],
    ["map.prt_fild08.gnd", "malformed", (rows: WhitelistRow[]) => {
      const gat = row(rows, "map.prt_fild08.gat"); // GND row pointed at the GAT entry: readable, wrong format
      return rows.map((r) => (r.asset_id === "map.prt_fild08.gnd" ? { ...r, raw_name_hex: gat.raw_name_hex, bytes: gat.bytes, sha256: gat.sha256 } : r));
    }],
    ["map.prt_fild08.gat", "not whitelisted", (rows: WhitelistRow[]) => rows.filter((r) => r.asset_id !== "map.prt_fild08.gat")],
  ] as const)("core map %s failure is structured (%s): exact ID / container / path, exit 1, no ready manifest", (id, reason, mutate) => {
    const { rows, reader, out } = setup((r) => mutate(r));
    const lines: string[] = [];
    const res = extractCommand(rows, reader, out, (l) => lines.push(l));
    expect(res.code).toBe(1);
    const expected = realRows.find((r) => r.asset_id === id) as WhitelistRow;
    const missing = res.code === 1 ? res.missing : [];
    expect(missing).toEqual([expect.objectContaining({ assetId: id, container: "data.grf", canonicalPath: id === "map.prt_fild08.gat" ? "(not in whitelist)" : expected.canonical_cp949_path, reason: expect.stringContaining(reason) as unknown })]);
    expect(lines[0]).toMatch(new RegExp(`^MISSING ${id.replaceAll(".", "\\.")} data\\.grf `, "u"));
    expect(existsSync(join(out, MANIFEST_FILE))).toBe(false);
    expect(existsSync(join(out, MISSING_REPORT))).toBe(true);
  });

  it("composite outputs carry the provenance of every input that decides their content", () => {
    const { rows, reader, out } = setup();
    const m: ExtractManifest = runExtraction(rows, reader, out);
    const fromOf = (file: string) => new Set(m.outputs.find((o) => o.file === file)?.from.map((f) => f.assetId));
    const ids = (pred: (r: WhitelistRow) => boolean) => rows.filter(pred).map((r) => r.asset_id);
    const expected = [
      "map.prt_fild08.rsw", "map.prt_fild08.gnd", "bgm.prt_fild08", "common.shadow.spr", "common.shadow.act",
      ...ids((r) => ["map_model", "map_model_texture", "map_ground_texture", "map_water_texture", "map_ambient_sound"].includes(r.category)),
    ].sort();
    for (const file of ["map.prt_fild08.rsw.json", "reports/prt_fild08-closure.json"]) expect([...fromOf(file)].sort(), file).toEqual(expected);
    for (const file of ["reports/prt_fild08-dependencies.json", "reports/prt_fild08-closure.json"]) {
      const j = JSON.parse(readFileSync(join(out, ...file.split("/")), "utf8")) as { rights: string; converterVersion: number; sources: Record<string, string> };
      expect([j.rights, j.converterVersion, Object.keys(j.sources).length], file).toEqual(["RO-SURVIVOR-DERIVED:local-fan-use", 2, 4]);
    }
    expect([...fromOf("map.prt_fild08.model.001.json")]).toEqual(["map.prt_fild08.model.001"]);
  });
});
