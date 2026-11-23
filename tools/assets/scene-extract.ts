/**
 * Commit B — local extraction of the prt_fild08 scene closure into a derived contract
 * (CLAUDE-PHASE1-ORIGINAL-ASSETS.md §3). Reads whitelisted entries only (by logical ID through the
 * verified reader), writes only under the derived directory (.local-assets/<data.grf>/v<converter>/),
 * and fails closed: if any dependency is unresolved, unreadable or malformed, nothing is marked ready
 * and each problem is reported by logical asset ID + container + canonical CP949 path.
 */
import { AssetWhitelist, dependencyCanonicalPath, FORMAL_SKILL_AUDIO_IDS, resolveMapClosure, waterTexturePaths } from "@ro-survivor/asset-contracts";
import type { WhitelistRow } from "@ro-survivor/content-schema";
import type { AssetReader } from "@ro-survivor/asset-gateway";
import {
  frameToRgba, parseAct, parseBmp, parseGnd, parseRsm, parseRsw, parseSpr, readJpegInfo, readWavInfo, RO_COLOR_KEY_RULE, type Gnd, type Rsm, type Rsw,
} from "@ro-survivor/ro-format-runtime";
import { DERIVED_MARKER, encodePng } from "../lib/png.ts";
import { CONVERTER_VERSION, writeOutput } from "./extract-lib.ts";

export const SCENE_MAP = "map.prt_fild08";
export const SCENE_BGM = "bgm.prt_fild08";
export const SCENE_SHADOW = "common.shadow";

export interface SceneMissing {
  assetId: string | null;
  container: string;
  canonicalPath: string;
  reason: string;
}

export class SceneExtractionError extends Error {
  readonly missing: SceneMissing[];
  constructor(missing: SceneMissing[]) {
    super(`scene extraction stopped: ${missing.length} dependency problem(s): ${missing.map((m) => `${m.assetId ?? "(not whitelisted)"} ${m.canonicalPath} — ${m.reason}`).join("; ")}`);
    this.name = "SceneExtractionError";
    this.missing = missing;
  }
}

export interface DerivedTexture {
  assetId: string;
  canonicalPath: string;
  sourceSha256: string;
  format: "bmp" | "jpg";
  width: number;
  height: number;
  bitsPerPixel: number | null;
  /** BMP -> lossless RGBA PNG (`<id>.png`); JPG frames stay the original bytes (served by ID). */
  derived: { file: string; sha256: string } | { file: null; servedAs: "source" };
  transparency: { rule: string; keyedPixels: number } | null;
  filter: "nearest";
}

export interface SceneSummary {
  rswVersion: string;
  gndVersion: string;
  groundTextures: number;
  lightmaps: number;
  surfaces: number;
  uniqueModels: number;
  placements: number;
  modelTextures: number;
  waterType: number | null;
  waterFrames: number;
  waterCells: number;
  ambientSounds: number;
  shadowLayerAlpha: number[];
}

type Output = { file: string; sha256: string; bytes: number; from: { assetId: string; entrySha256: string; rawHex: string }[] };

/** Cells whose lowest corner lies below the water surface (RO heights grow downwards). */
export function countWaterCells(gnd: Gnd, level: number): number {
  return gnd.cubes.filter((c) => Math.max(...c.heights) > level).length;
}

/** Lightmap atlas: 8x8 tiles, RGB = lightmap colour, A = lightmap brightness. */
export function lightmapAtlas(gnd: Gnd): { width: number; height: number; cols: number; rgba: Uint8Array } {
  const [tw, th] = gnd.lightmap.perCell;
  const n = Math.max(1, gnd.lightmap.count);
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const width = cols * tw;
  const height = rows * th;
  const rgba = new Uint8Array(width * height * 4);
  const block = tw * th * 4;
  for (let i = 0; i < gnd.lightmap.count; i += 1) {
    const base = i * block;
    const ox = (i % cols) * tw;
    const oy = Math.floor(i / cols) * th;
    for (let p = 0; p < tw * th; p += 1) {
      const o = ((oy + Math.floor(p / tw)) * width + ox + (p % tw)) * 4;
      rgba[o] = gnd.lightmap.data[base + tw * th + p * 3] as number;
      rgba[o + 1] = gnd.lightmap.data[base + tw * th + p * 3 + 1] as number;
      rgba[o + 2] = gnd.lightmap.data[base + tw * th + p * 3 + 2] as number;
      rgba[o + 3] = gnd.lightmap.data[base + p] as number;
    }
  }
  return { width, height, cols, rgba };
}

export function extractScene(rows: readonly WhitelistRow[], reader: AssetReader, outDir: string): { outputs: Output[]; summary: SceneSummary; closureIds: string[]; inputs: Output["from"] } {
  const list = new AssetWhitelist(rows);
  const missing: SceneMissing[] = [];
  const outputs: Output[] = [];
  /** Every verified input read in this step, by asset ID (provenance of composite outputs). */
  const inputs = new Map<string, Output["from"][number]>();
  const miss = (assetId: string | null, canonicalPath: string, reason: string, container = "data.grf"): void => {
    missing.push({ assetId, container, canonicalPath, reason });
  };
  const read = (id: string): { bytes: Uint8Array; from: Output["from"][number] } | null => {
    if (!list.has(id)) {
      miss(id, "(not in whitelist)", "required scene asset is not whitelisted");
      return null;
    }
    const row = list.get(id);
    try {
      const r = reader.read(row);
      const from = { assetId: id, entrySha256: r.entrySha256, rawHex: row.raw_name_hex };
      inputs.set(id, from);
      return { bytes: r.bytes, from };
    } catch (err) {
      miss(id, row.canonical_cp949_path, `source unreadable: ${err instanceof Error ? err.message : String(err)}`, row.source_container);
      return null;
    }
  };
  const parse = <T>(id: string, fn: () => T): T | null => {
    try {
      return fn();
    } catch (err) {
      const row = list.has(id) ? list.get(id) : null;
      miss(id, row?.canonical_cp949_path ?? "(not in whitelist)", `malformed: ${err instanceof Error ? err.message : String(err)}`, row?.source_container ?? "data.grf");
      return null;
    }
  };

  // Core map files.
  const rswSrc = read(`${SCENE_MAP}.rsw`);
  const gndSrc = read(`${SCENE_MAP}.gnd`);
  const rsw: Rsw | null = rswSrc ? parse(`${SCENE_MAP}.rsw`, () => parseRsw(rswSrc.bytes)) : null;
  const gnd: Gnd | null = gndSrc ? parse(`${SCENE_MAP}.gnd`, () => parseGnd(gndSrc.bytes)) : null;
  if (!rsw || !gnd || !rswSrc || !gndSrc) throw new SceneExtractionError(missing);

  // Models (RSW placements -> unique RSM files) and their texture references.
  const modelFiles = [...new Set(rsw.models.map((m) => m.file))].sort();
  const models = new Map<string, { id: string; rsm: Rsm; from: Output["from"][number] }>();
  for (const file of modelFiles) {
    const path = dependencyCanonicalPath("model", file);
    const id = list.idForCanonicalPath(path);
    if (!id) continue; // reported by the closure below with its canonical path
    const src = read(id);
    const rsm = src ? parse(id, () => parseRsm(src.bytes)) : null;
    if (src && rsm) models.set(file, { id, rsm, from: src.from });
  }
  const modelTextures = [...new Set([...models.values()].flatMap((m) => m.rsm.textures))].sort();
  const closure = resolveMapClosure(list, {
    groundTextures: gnd.textures,
    models: modelFiles,
    modelTextures,
    sounds: rsw.soundFiles,
    waterType: rsw.waterType,
  });
  for (const m of closure.missing) missing.push({ ...m });

  // Textures: ground + model BMPs -> lossless PNG; water JPG frames -> referenced by ID.
  const textures: DerivedTexture[] = [];
  const textureId = (kind: "texture", name: string): string | null => list.idForCanonicalPath(dependencyCanonicalPath(kind, name));
  const bmpIds = [...new Set([...gnd.textures, ...modelTextures].map((n) => textureId("texture", n)).filter((x): x is string => x !== null))].sort();
  for (const id of bmpIds) {
    const src = read(id);
    const bmp = src ? parse(id, () => parseBmp(src.bytes)) : null;
    if (!src || !bmp) continue;
    const png = encodePng(bmp.width, bmp.height, bmp.rgba, DERIVED_MARKER);
    const out = writeOutput(outDir, `${id}.png`, png);
    outputs.push({ ...out, from: [src.from] });
    textures.push({
      assetId: id, canonicalPath: list.get(id).canonical_cp949_path, sourceSha256: src.from.entrySha256, format: "bmp", width: bmp.width, height: bmp.height,
      bitsPerPixel: bmp.bitsPerPixel, derived: { file: out.file, sha256: out.sha256 }, transparency: { rule: RO_COLOR_KEY_RULE, keyedPixels: bmp.keyedPixels }, filter: "nearest",
    });
  }
  const waterIds = rsw.waterType === null ? [] : waterTexturePaths(rsw.waterType).map((p) => list.idForCanonicalPath(p)).filter((x): x is string => x !== null);
  for (const id of waterIds) {
    const src = read(id);
    const info = src ? parse(id, () => readJpegInfo(src.bytes)) : null;
    if (!src || !info) continue;
    textures.push({
      assetId: id, canonicalPath: list.get(id).canonical_cp949_path, sourceSha256: src.from.entrySha256, format: "jpg", width: info.width, height: info.height,
      bitsPerPixel: null, derived: { file: null, servedAs: "source" }, transparency: null, filter: "nearest",
    });
  }

  // Official shadow sprite: atlas + ACT with its colour (alpha) preserved.
  let shadowAlpha: number[] = [];
  const shadowSpr = read(`${SCENE_SHADOW}.spr`);
  const shadowAct = read(`${SCENE_SHADOW}.act`);
  const spr = shadowSpr ? parse(`${SCENE_SHADOW}.spr`, () => parseSpr(shadowSpr.bytes)) : null;
  const act = shadowAct ? parse(`${SCENE_SHADOW}.act`, () => parseAct(shadowAct.bytes)) : null;
  let shadowOutputs: { png: Uint8Array; json: string } | null = null;
  if (spr && act && shadowSpr && shadowAct) {
    const frames = [...spr.indexed, ...spr.rgba];
    const width = Math.max(1, frames.reduce((w, f) => w + f.width + 1, 0));
    const height = Math.max(1, ...frames.map((f) => f.height));
    const atlas = new Uint8Array(width * height * 4);
    const rects: { x: number; y: number; w: number; h: number; type: "indexed" | "rgba"; index: number }[] = [];
    let x = 0;
    spr.indexed.forEach((f, i) => {
      const rgba = frameToRgba(f, spr.palette);
      for (let y = 0; y < f.height; y += 1) atlas.set(rgba.subarray(y * f.width * 4, (y + 1) * f.width * 4), (y * width + x) * 4);
      rects.push({ x, y: 0, w: f.width, h: f.height, type: "indexed", index: i });
      x += f.width + 1;
    });
    spr.rgba.forEach((f, i) => {
      for (let y = 0; y < f.height; y += 1) atlas.set(f.rgba.subarray(y * f.width * 4, (y + 1) * f.width * 4), (y * width + x) * 4);
      rects.push({ x, y: 0, w: f.width, h: f.height, type: "rgba", index: i });
      x += f.width + 1;
    });
    shadowAlpha = [...new Set(act.actions.flatMap((a) => a.frames.flatMap((fr) => fr.layers.map((l) => l.color[3]))))].sort((a, b) => a - b);
    const meta = {
      rights: DERIVED_MARKER, assetId: SCENE_SHADOW, converterVersion: CONVERTER_VERSION, sprVersion: spr.version, actVersion: act.version,
      atlas: { width, height, file: `${SCENE_SHADOW}.spr.png` }, frames: rects,
      // ACT layer colours are kept verbatim (the official shadow carries alpha 128).
      actions: act.actions.map((a) => ({ delay: a.delay, frames: a.frames.map((fr) => ({ layers: fr.layers.map((l) => ({ sprIndex: l.sprIndex, sprType: l.sprType, x: l.x, y: l.y, mirror: l.mirror, color: l.color, scaleX: l.scaleX, scaleY: l.scaleY, rotation: l.rotation })) })) })),
      layerAlpha: shadowAlpha,
    };
    shadowOutputs = { png: encodePng(width, height, atlas, DERIVED_MARKER), json: JSON.stringify(meta) };
  }

  // Audio stays as original bytes; extraction validates BGM, ambient and required skill WAV metadata.
  const audioIds = [SCENE_BGM, ...rsw.soundFiles.map((f) => list.idForCanonicalPath(dependencyCanonicalPath("wav", f))).filter((x): x is string => x !== null), ...FORMAL_SKILL_AUDIO_IDS];
  const audio: { assetId: string; format: "mp3" | "wav"; bytes: number; sha256: string; wav: ReturnType<typeof readWavInfo> | null }[] = [];
  for (const id of [...new Set(audioIds)]) {
    const src = read(id);
    if (!src) continue;
    if (id === SCENE_BGM) {
      const ok = (src.bytes[0] === 0x49 && src.bytes[1] === 0x44 && src.bytes[2] === 0x33) || (src.bytes[0] === 0xff && ((src.bytes[1] ?? 0) & 0xe0) === 0xe0);
      if (!ok) miss(id, list.get(id).canonical_cp949_path, "malformed: MP3 header not recognised", list.get(id).source_container);
      else audio.push({ assetId: id, format: "mp3", bytes: src.bytes.length, sha256: src.from.entrySha256, wav: null });
    } else {
      const info = parse(id, () => readWavInfo(src.bytes));
      if (info) audio.push({ assetId: id, format: "wav", bytes: src.bytes.length, sha256: src.from.entrySha256, wav: info });
    }
  }

  if (missing.length > 0) throw new SceneExtractionError(missing);

  // Ground: GND 1.7 texture table, tile UVs, surface colours, cube heights / tile links, lightmap atlas.
  const lm = lightmapAtlas(gnd);
  const lmPng = encodePng(lm.width, lm.height, lm.rgba, DERIVED_MARKER);
  const groundFrom = [gndSrc.from];
  const gndJson = {
    rights: DERIVED_MARKER, assetId: `${SCENE_MAP}.gnd`, converterVersion: CONVERTER_VERSION, version: gnd.version, width: gnd.width, height: gnd.height, zoom: gnd.zoom,
    textures: gnd.textures.map((name) => ({ name, assetId: textureId("texture", name) })),
    lightmap: { count: gnd.lightmap.count, perCell: gnd.lightmap.perCell, atlas: { file: `${SCENE_MAP}.gnd.png`, width: lm.width, height: lm.height, cols: lm.cols, layout: "rgb=colour a=brightness" } },
    surfaces: {
      u: gnd.surfaces.flatMap((s) => s.u), v: gnd.surfaces.flatMap((s) => s.v),
      texture: gnd.surfaces.map((s) => s.textureId), lightmap: gnd.surfaces.map((s) => s.lightmapId), color: gnd.surfaces.flatMap((s) => s.color),
    },
    cubes: { heights: gnd.cubes.flatMap((c) => c.heights), up: gnd.cubes.map((c) => c.tileUp), front: gnd.cubes.map((c) => c.tileFront), right: gnd.cubes.map((c) => c.tileRight) },
  };
  outputs.push({ ...writeOutput(outDir, `${SCENE_MAP}.gnd.json`, JSON.stringify(gndJson)), from: groundFrom });
  outputs.push({ ...writeOutput(outDir, `${SCENE_MAP}.gnd.png`, lmPng), from: groundFrom });

  // Models: one JSON per unique RSM with texture IDs resolved.
  for (const { id, rsm, from } of [...models.values()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const json = {
      rights: DERIVED_MARKER, assetId: id, converterVersion: CONVERTER_VERSION, version: rsm.version, animLength: rsm.animLength, shadeType: rsm.shadeType, alpha: rsm.alpha,
      textures: rsm.textures.map((name) => ({ name, assetId: textureId("texture", name) })), mainNode: rsm.mainNode, nodes: rsm.nodes, posKeyframes: rsm.posKeyframes,
      volumeBoxes: rsm.volumeBoxes,
    };
    outputs.push({ ...writeOutput(outDir, `${id}.json`, JSON.stringify(json)), from: [from] });
  }
  if (shadowOutputs && shadowSpr && shadowAct) {
    outputs.push({ ...writeOutput(outDir, `${SCENE_SHADOW}.spr.png`, shadowOutputs.png), from: [shadowSpr.from, shadowAct.from] });
    outputs.push({ ...writeOutput(outDir, `${SCENE_SHADOW}.act.json`, shadowOutputs.json), from: [shadowSpr.from, shadowAct.from] });
  }

  // Scene: RSW placements, water, sounds, texture table — keyed to the verified sources.
  const level = rsw.water?.level ?? 0;
  const waterCells = rsw.waterType === null ? 0 : countWaterCells(gnd, level);
  const scene = {
    rights: DERIVED_MARKER, assetId: `${SCENE_MAP}.rsw`, converterVersion: CONVERTER_VERSION, sources: reader.sourceHashes, rswVersion: rsw.version,
    ground: `${SCENE_MAP}.gnd`,
    water: rsw.water === null ? null : { ...rsw.water, frames: waterIds, cells: waterCells, cellRule: "max(corner heights) > level" },
    models: rsw.models.map((m) => ({ name: m.name, file: m.file, modelAssetId: models.get(m.file)?.id ?? null, node: m.node, position: m.position, rotation: m.rotation, scale: m.scale })),
    sounds: rsw.sounds.map((s) => ({ ...s, assetId: list.idForCanonicalPath(dependencyCanonicalPath("wav", s.file)) })),
    bgm: SCENE_BGM,
    shadow: SCENE_SHADOW,
    textures,
    audio,
  };
  // The scene JSON is decided by every input of this step: core map, RSMs, textures, water, shadow, audio.
  const sceneFrom = [...inputs.values()].sort((a, b) => (a.assetId < b.assetId ? -1 : 1));
  outputs.push({ ...writeOutput(outDir, `${SCENE_MAP}.rsw.json`, JSON.stringify(scene)), from: sceneFrom });
  const summary: SceneSummary = {
    rswVersion: rsw.version, gndVersion: gnd.version, groundTextures: new Set(gnd.textures).size, lightmaps: gnd.lightmap.count, surfaces: gnd.surfaces.length,
    uniqueModels: models.size, placements: rsw.models.length, modelTextures: modelTextures.length, waterType: rsw.waterType, waterFrames: waterIds.length, waterCells,
    ambientSounds: new Set(rsw.soundFiles).size, shadowLayerAlpha: shadowAlpha,
  };
  return { outputs, summary, closureIds: closure.ids, inputs: sceneFrom };
}
