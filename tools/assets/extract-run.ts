import { join } from "node:path";
import { AssetWhitelist, resolveMapClosure } from "@ro-survivor/asset-contracts";
import type { WhitelistRow } from "@ro-survivor/content-schema";
import type { AssetReader } from "@ro-survivor/asset-gateway";
import { DERIVED_MARKER } from "../lib/png.ts";
import { buildContactSheet, buildSpriteAtlas, CONVERTER_VERSION, extractMap, parseAct, parseSpriteWithPalette, spriteGroups, writeOutput } from "./extract-lib.ts";

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
    closure: { resolvedIds: number; missing: { assetId: string | null; container: string; canonicalPath: string; reason: string }[] };
  } | null;
}

/**
 * Extract only whitelisted assets into `outDir` (.local-assets/<source-hash>/v<converter>/):
 * per-actor atlas PNG + metadata JSON (named after whitelisted IDs so the gateway can serve them),
 * contact sheets, map walk grid + dependency report, and a manifest with output hashes.
 */
export function runExtraction(rows: readonly WhitelistRow[], reader: AssetReader, outDir: string): ExtractManifest {
  const byId = new Map(rows.map((r) => [r.asset_id, r]));
  const manifest: ExtractManifest = { rights: DERIVED_MARKER, converterVersion: CONVERTER_VERSION, profile: "fan-local", sources: reader.sourceHashes, outputs: [], sprites: [], map: null };
  const read = (id: string) => {
    const row = byId.get(id);
    if (!row) throw new Error(`${id} is not whitelisted`);
    const r = reader.read(row);
    return { ...r, from: { assetId: id, entrySha256: r.entrySha256, rawHex: row.raw_name_hex } };
  };

  for (const group of spriteGroups(rows)) {
    const from: ExtractManifest["outputs"][number]["from"] = [];
    const layers = group.layers.map((l) => {
      const spr = read(l.spr);
      const act = read(l.act);
      const pal = l.palette && byId.has(l.palette) ? read(l.palette) : null;
      from.push(spr.from, act.from, ...(pal ? [pal.from] : []));
      return { sprite: parseSpriteWithPalette(spr.bytes, pal?.bytes ?? null), act: parseAct(act.bytes) };
    });
    const { metadata, png, composed } = buildSpriteAtlas(group.id, group.kind, layers, group.layers.map((l) => l.spr));
    const atlasName = `${group.layers[0]?.spr as string}.png`;
    const metaName = `${group.layers[0]?.act as string}.json`;
    manifest.outputs.push({ ...writeOutput(outDir, atlasName, png), from });
    manifest.outputs.push({ ...writeOutput(outDir, metaName, JSON.stringify(metadata)), from });
    manifest.outputs.push({ ...writeOutput(join(outDir, "contact-sheets"), `${group.id}.png`, buildContactSheet(metadata, composed)), from });
    manifest.sprites.push({
      id: group.id, composedFrames: metadata.stats.composedFrames, uniqueImages: metadata.stats.uniqueImages, mirrorDeduped: metadata.stats.mirrorDeduped,
      fallbacks: Object.entries(metadata.slots).filter(([, s]) => s.fallback).map(([k, s]) => `${k}<-${s.sourceAction}`),
    });
  }

  const mapIds = ["map.prt_fild08.rsw", "map.prt_fild08.gnd", "map.prt_fild08.gat"];
  if (mapIds.every((id) => byId.has(id))) {
    const [rsw, gnd, gat] = mapIds.map(read) as [ReturnType<typeof read>, ReturnType<typeof read>, ReturnType<typeof read>];
    const m = extractMap("map.prt_fild08", rsw.bytes, gnd.bytes, gat.bytes);
    const from = [rsw.from, gnd.from, gat.from];
    manifest.outputs.push({ ...writeOutput(outDir, "map.prt_fild08.gat.json", JSON.stringify(m.metadata)), from });
    manifest.outputs.push({ ...writeOutput(outDir, "map.prt_fild08.gat.png", m.walkPng), from });
    manifest.outputs.push({ ...writeOutput(join(outDir, "reports"), "prt_fild08-dependencies.json", JSON.stringify(m.metadata.dependencies, null, 2)), from });
    // RSM texture references are resolved once the GRSM parser lands (Commit B).
    const closure = resolveMapClosure(new AssetWhitelist(rows), {
      groundTextures: m.metadata.dependencies.textures,
      models: m.metadata.dependencies.models,
      modelTextures: [],
      sounds: m.metadata.dependencies.sounds,
      waterType: m.metadata.dependencies.waterType,
    });
    manifest.outputs.push({ ...writeOutput(join(outDir, "reports"), "prt_fild08-closure.json", JSON.stringify(closure, null, 2)), from });
    manifest.map = {
      flood: m.metadata.flood,
      dependencies: { textures: m.metadata.dependencies.textures.length, models: m.metadata.dependencies.models.length, sounds: m.metadata.dependencies.sounds.length, waterType: m.metadata.dependencies.waterType },
      closure: { resolvedIds: closure.ids.length, missing: closure.missing },
    };
  }
  writeOutput(outDir, "manifest.json", JSON.stringify(manifest, null, 2));
  return manifest;
}
