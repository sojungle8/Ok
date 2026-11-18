/**
 * Original RO skill-effect extraction. This is a fan-local, fail-closed conversion step: source
 * textures become lossless RGBA PNGs, while STR remains an explicitly unparsed source record.
 */
import { FORMAL_SKILL_EFFECT_IDS, type DerivedSkillEffect, type DerivedSkillEffectTexture } from "@ro-survivor/asset-contracts";
import type { AssetReader } from "@ro-survivor/asset-gateway";
import type { WhitelistRow } from "@ro-survivor/content-schema";
import { parseBmp, parseTga } from "@ro-survivor/ro-format-runtime";
import { DERIVED_MARKER, encodePng } from "../lib/png.ts";
import { CONVERTER_VERSION, writeOutput } from "./extract-lib.ts";
import { SceneExtractionError, type SceneMissing } from "./scene-extract.ts";

type From = { assetId: string; entrySha256: string; rawHex: string };
export type SkillEffectOutput = { file: string; sha256: string; bytes: number; from: From[] };

export interface SkillEffectExtractionSummary {
  sources: number;
  textures: number;
  animations: number;
  pngs: number;
  metadata: number;
}

export interface SkillEffectExtraction {
  outputs: SkillEffectOutput[];
  summary: SkillEffectExtractionSummary;
  effects: DerivedSkillEffect[];
}

const reasonOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

function extension(path: string): string {
  return /\.([a-z0-9]+)$/iu.exec(path)?.[1]?.toLowerCase() ?? "";
}

/** Extract every ID in the fixed formal effect closure; no whitelist category is auto-discovered. */
export function extractSkillEffects(rows: readonly WhitelistRow[], reader: AssetReader, outDir: string): SkillEffectExtraction {
  const byId = new Map(rows.map((row) => [row.asset_id, row]));
  const outputs: SkillEffectOutput[] = [];
  const effects: DerivedSkillEffect[] = [];
  const missing: SceneMissing[] = [];

  for (const assetId of FORMAL_SKILL_EFFECT_IDS) {
    const row = byId.get(assetId);
    if (!row) {
      missing.push({ assetId, container: "data.grf", canonicalPath: "(not in whitelist)", reason: "required official skill-effect source is not whitelisted" });
      continue;
    }
    if (row.source_container !== "data.grf" || row.rdata_override !== "false" || row.required !== "true") {
      missing.push({ assetId, container: row.source_container, canonicalPath: row.canonical_cp949_path, reason: "skill-effect source must be required and pinned to data.grf without an rdata override" });
      continue;
    }

    let read: ReturnType<AssetReader["read"]>;
    try {
      read = reader.read(row);
    } catch (err) {
      missing.push({ assetId, container: row.source_container, canonicalPath: row.canonical_cp949_path, reason: `source unreadable: ${reasonOf(err)}` });
      continue;
    }
    const from: From = { assetId, entrySha256: read.entrySha256, rawHex: row.raw_name_hex };
    const source = { canonicalPath: row.canonical_cp949_path, bytes: read.bytes.length, sha256: read.entrySha256 };
    const ext = extension(row.canonical_cp949_path);

    try {
      if (row.category === "skill_effect_texture" && (ext === "bmp" || ext === "tga")) {
        const image = ext === "bmp" ? parseBmp(read.bytes) : parseTga(read.bytes);
        const alpha: DerivedSkillEffectTexture["alpha"] = ext === "bmp"
          ? { mode: "ro-color-key", keyedPixels: (image as ReturnType<typeof parseBmp>).keyedPixels }
          : { mode: "source-alpha" };
        const png = encodePng(image.width, image.height, image.rgba, DERIVED_MARKER);
        const pngOut = writeOutput(outDir, `${assetId}.png`, png);
        const meta: DerivedSkillEffectTexture = {
          rights: DERIVED_MARKER,
          converterVersion: CONVERTER_VERSION,
          assetId,
          source,
          kind: "texture",
          format: ext,
          width: image.width,
          height: image.height,
          bitsPerPixel: image.bitsPerPixel,
          alpha,
          derived: { file: pngOut.file, sha256: pngOut.sha256, width: image.width, height: image.height },
          filter: "nearest",
        };
        outputs.push({ ...pngOut, from: [from] });
        outputs.push({ ...writeOutput(outDir, `${assetId}.json`, JSON.stringify(meta)), from: [from] });
        effects.push(meta);
      } else if (row.category === "skill_effect_animation" && ext === "str") {
        const magic = String.fromCharCode(...read.bytes.subarray(0, 4));
        if (magic !== "STRM") throw new Error(`STR magic ${JSON.stringify(magic)} is not STRM`);
        const meta: DerivedSkillEffect = {
          rights: DERIVED_MARKER,
          converterVersion: CONVERTER_VERSION,
          assetId,
          source,
          kind: "animation-source",
          format: "str",
          magic: "STRM",
          parsed: false,
          sourceOnly: true,
        };
        outputs.push({ ...writeOutput(outDir, `${assetId}.json`, JSON.stringify(meta)), from: [from] });
        effects.push(meta);
      } else {
        throw new Error(`category ${row.category} and extension .${ext || "(none)"} do not match the fixed skill-effect contract`);
      }
    } catch (err) {
      missing.push({ assetId, container: row.source_container, canonicalPath: row.canonical_cp949_path, reason: `malformed: ${reasonOf(err)}` });
    }
  }

  if (missing.length > 0) throw new SceneExtractionError(missing);
  const textures = effects.filter((effect) => effect.kind === "texture").length;
  const animations = effects.filter((effect) => effect.kind === "animation-source").length;
  return {
    outputs,
    effects,
    summary: { sources: effects.length, textures, animations, pngs: textures, metadata: effects.length },
  };
}

