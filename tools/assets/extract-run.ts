import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { WhitelistRow } from "@ro-survivor/content-schema";
import type { AssetReader } from "@ro-survivor/asset-gateway";
import { parseGat, parseGnd, parseRsw } from "@ro-survivor/ro-format-runtime";
import { DERIVED_MARKER } from "../lib/png.ts";
import { extractScene, SceneExtractionError, type SceneMissing, type SceneSummary } from "./scene-extract.ts";
import { buildContactSheet, buildSpriteAtlas, CONVERTER_VERSION, extractMap, parseAct, parseSpriteWithPalette, spriteGroups, writeOutput } from "./extract-lib.ts";

export const MANIFEST_FILE = "manifest.json";
export const MISSING_REPORT = "reports/prt_fild08-scene-missing.json";

export interface ExtractManifest {
  rights: string;
  converterVersion: number;
  profile: "fan-local";
  sources: Record<string, string>;
  outputs: { file: string; sha256: string; bytes: number; from: { assetId: string; entrySha256: string; rawHex: string }[] }[];
  sprites: { id: string; composedFrames: number; uniqueImages: number; mirrorDeduped: number; fallbacks: string[] }[];
  map: {
    flood: { walkable: number; reachableFromSpawn: number; ratio: number };
    dependencies: { textures: number; models: number; sounds: number; waterType: number | null };
    closure: { resolvedIds: number; missing: SceneMissing[] };
    scene: SceneSummary;
  } | null;
}

type From = ExtractManifest["outputs"][number]["from"][number];
const CORE_MAP = ["map.prt_fild08.rsw", "map.prt_fild08.gnd", "map.prt_fild08.gat"] as const;
const dedupe = (list: From[]): From[] => [...new Map(list.map((f) => [f.assetId, f])).values()].sort((a, b) => (a.assetId < b.assetId ? -1 : 1));

/**
 * Extract only whitelisted assets into `outDir` (.local-assets/<source-hash>/v<converter>/), as one
 * transaction:
 * 1. any existing `manifest.json` in `outDir` is removed first (a re-run never leaves an old ready state);
 * 2. every output is written to a unique sibling staging directory on the same filesystem;
 * 3. only when all reads, parses and writes succeed is `manifest.json` written and the staging
 *    directory swapped into place by rename;
 * 4. on any failure the staging directory is deleted, `outDir` keeps no manifest, and dependency
 *    problems are written to `outDir/reports/prt_fild08-scene-missing.json` and thrown as
 *    SceneExtractionError (asset ID + container + canonical CP949 path).
 */
export function runExtraction(rows: readonly WhitelistRow[], reader: AssetReader, outDir: string): ExtractManifest {
  rmSync(join(outDir, MANIFEST_FILE), { force: true });
  const staging = join(dirname(outDir), `${basename(outDir)}.staging-${process.pid}-${randomUUID().slice(0, 8)}`);
  mkdirSync(staging, { recursive: true });
  try {
    const manifest = extractInto(rows, reader, staging);
    writeOutput(staging, MANIFEST_FILE, JSON.stringify(manifest, null, 2));
    const old = existsSync(outDir) ? `${outDir}.old-${randomUUID().slice(0, 8)}` : null;
    if (old) renameSync(outDir, old);
    renameSync(staging, outDir);
    if (old) rmSync(old, { recursive: true, force: true });
    return manifest;
  } catch (err) {
    rmSync(staging, { recursive: true, force: true });
    if (err instanceof SceneExtractionError) {
      writeOutput(outDir, MISSING_REPORT, JSON.stringify({ rights: DERIVED_MARKER, converterVersion: CONVERTER_VERSION, sources: reader.sourceHashes, missing: err.missing }, null, 2));
    }
    throw err;
  }
}

/** CLI body of `pnpm assets:extract`: 0 on success, 1 with MISSING lines on a dependency problem. */
export function extractCommand(rows: readonly WhitelistRow[], reader: AssetReader, outDir: string, log: (line: string) => void): { code: 0; manifest: ExtractManifest } | { code: 1; missing: SceneMissing[] } {
  try {
    return { code: 0, manifest: runExtraction(rows, reader, outDir) };
  } catch (err) {
    if (!(err instanceof SceneExtractionError)) throw err;
    for (const m of err.missing) log(`MISSING ${m.assetId ?? "(not whitelisted)"} ${m.container} ${m.canonicalPath}: ${m.reason}`);
    log(`assets:extract FAIL: ${err.missing.length} dependency problem(s); no ready manifest (report: ${MISSING_REPORT}).`);
    return { code: 1, missing: err.missing };
  }
}

function extractInto(rows: readonly WhitelistRow[], reader: AssetReader, outDir: string): ExtractManifest {
  const byId = new Map(rows.map((r) => [r.asset_id, r]));
  const manifest: ExtractManifest = { rights: DERIVED_MARKER, converterVersion: CONVERTER_VERSION, profile: "fan-local", sources: reader.sourceHashes, outputs: [], sprites: [], map: null };
  const problem = (id: string, reason: string): SceneMissing => {
    const row = byId.get(id);
    return { assetId: id, container: row?.source_container ?? "data.grf", canonicalPath: row?.canonical_cp949_path ?? "(not in whitelist)", reason };
  };
  const read = (id: string) => {
    if (!byId.has(id)) throw new SceneExtractionError([problem(id, "required asset is not whitelisted")]);
    const row = byId.get(id) as WhitelistRow;
    try {
      const r = reader.read(row);
      return { ...r, from: { assetId: id, entrySha256: r.entrySha256, rawHex: row.raw_name_hex } };
    } catch (err) {
      throw new SceneExtractionError([problem(id, `source unreadable: ${err instanceof Error ? err.message : String(err)}`)]);
    }
  };
  const parseAs = <T>(id: string, fn: () => T): T => {
    try {
      return fn();
    } catch (err) {
      if (err instanceof SceneExtractionError) throw err;
      throw new SceneExtractionError([problem(id, `malformed: ${err instanceof Error ? err.message : String(err)}`)]);
    }
  };

  for (const group of spriteGroups(rows)) {
    const from: From[] = [];
    const layers = group.layers.map((l) => {
      const spr = read(l.spr);
      const act = read(l.act);
      const pal = l.palette && byId.has(l.palette) ? read(l.palette) : null;
      from.push(spr.from, act.from, ...(pal ? [pal.from] : []));
      return { sprite: parseAs(l.spr, () => parseSpriteWithPalette(spr.bytes, pal?.bytes ?? null)), act: parseAs(l.act, () => parseAct(act.bytes)) };
    });
    const first = group.layers[0];
    const { metadata, png, composed } = parseAs(first?.act ?? group.id, () => buildSpriteAtlas(group.id, group.kind, layers, group.layers.map((l) => l.spr)));
    manifest.outputs.push({ ...writeOutput(outDir, `${first?.spr as string}.png`, png), from });
    manifest.outputs.push({ ...writeOutput(outDir, `${first?.act as string}.json`, JSON.stringify(metadata)), from });
    manifest.outputs.push({ ...writeOutput(outDir, `contact-sheets/${group.id}.png`, buildContactSheet(metadata, composed)), from });
    manifest.sprites.push({
      id: group.id, composedFrames: metadata.stats.composedFrames, uniqueImages: metadata.stats.uniqueImages, mirrorDeduped: metadata.stats.mirrorDeduped,
      fallbacks: Object.entries(metadata.slots).filter(([, s]) => s.fallback).map(([k, s]) => `${k}<-${s.sourceAction}`),
    });
  }

  // Core map files: every read / parse problem becomes a structured, path-bearing failure.
  const problems: SceneMissing[] = [];
  const core = CORE_MAP.map((id) => {
    try {
      const src = read(id);
      const parse = id.endsWith(".rsw") ? parseRsw : id.endsWith(".gnd") ? parseGnd : parseGat;
      parseAs(id, () => parse(src.bytes));
      return src;
    } catch (err) {
      if (!(err instanceof SceneExtractionError)) throw err;
      problems.push(...err.missing);
      return null;
    }
  });
  if (problems.length > 0) throw new SceneExtractionError(problems);
  const [rsw, gnd, gat] = core as [ReturnType<typeof read>, ReturnType<typeof read>, ReturnType<typeof read>];
  const m = parseAs(CORE_MAP[0], () => extractMap("map.prt_fild08", rsw.bytes, gnd.bytes, gat.bytes));
  manifest.outputs.push({ ...writeOutput(outDir, "map.prt_fild08.gat.json", JSON.stringify(m.metadata)), from: [rsw.from, gnd.from, gat.from] });
  manifest.outputs.push({ ...writeOutput(outDir, "map.prt_fild08.gat.png", m.walkPng), from: [gat.from] });
  const meta = { rights: DERIVED_MARKER, converterVersion: CONVERTER_VERSION, sources: reader.sourceHashes };
  manifest.outputs.push({ ...writeOutput(outDir, "reports/prt_fild08-dependencies.json", JSON.stringify({ ...meta, ...m.metadata.dependencies }, null, 2)), from: [gnd.from, rsw.from] });
  // Scene closure (GND 1.7 + lightmaps, GRSM models, placements, water, shadow, audio).
  const scene = extractScene(rows, reader, outDir);
  manifest.outputs.push(...scene.outputs);
  manifest.outputs.push({ ...writeOutput(outDir, "reports/prt_fild08-closure.json", JSON.stringify({ ...meta, ids: scene.closureIds, missing: [] }, null, 2)), from: dedupe(scene.inputs) });
  manifest.map = {
    flood: m.metadata.flood,
    dependencies: { textures: m.metadata.dependencies.textures.length, models: m.metadata.dependencies.models.length, sounds: m.metadata.dependencies.sounds.length, waterType: m.metadata.dependencies.waterType },
    closure: { resolvedIds: scene.closureIds.length, missing: [] },
    scene: scene.summary,
  };
  return manifest;
}
