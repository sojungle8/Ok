/**
 * UI-B1 — local extraction of the 108 RO UI rows (profile KRO2021_CLASSIC_V0_FAN) inside the
 * transactional fan-local extraction. Writes only under the staging directory of `runExtraction`
 * (.local-assets/…, git-ignored), every output listed in the ready manifest with its source
 * provenance, served only by whitelisted logical ID:
 * - BMP → `<id>.png` (lossless RGBA, magenta key → alpha 0) + `<id>.json` (manifest entry + filter);
 * - cursor SPR/ACT → `ui.cursor.spr.png` atlas + `ui.cursor.spr.json` (frames) + `ui.cursor.act.json`
 *   (actions / frames / layers verbatim + UI-A hotspots);
 * - OTF fonts → no derived file: original bytes are served only by their exact filesystem:System ID.
 * Any UI problem throws SceneExtractionError (asset ID + container + path), so no manifest is published.
 */
import { isUiRow, UI_PROFILE_ID } from "@ro-survivor/asset-contracts";
import type { UiManifestEntry, WhitelistRow } from "@ro-survivor/content-schema";
import type { AssetReader } from "@ro-survivor/asset-gateway";
import { frameToRgba, parseAct, parseBmp, parseSpr, RO_COLOR_KEY_RULE } from "@ro-survivor/ro-format-runtime";
import { DERIVED_MARKER, encodePng } from "../lib/png.ts";
import { CONVERTER_VERSION, writeOutput } from "./extract-lib.ts";
import { SceneExtractionError, type SceneMissing } from "./scene-extract.ts";
import { buildUiManifest } from "./ui-manifest-lib.ts";

type From = { assetId: string; entrySha256: string; rawHex: string };
type Output = { file: string; sha256: string; bytes: number; from: From[] };

export interface UiExtractionSummary {
  profileId: string;
  entries: number;
  bitmaps: number;
  cursorActions: number;
  fonts: number;
}

export function extractUi(rows: readonly WhitelistRow[], reader: AssetReader, outDir: string, meta: { lockId: string; whitelistSha256: string }): { outputs: Output[]; summary: UiExtractionSummary } {
  const ui = rows.filter(isUiRow);
  if (ui.length === 0) return { outputs: [], summary: { profileId: UI_PROFILE_ID, entries: 0, bitmaps: 0, cursorActions: 0, fonts: 0 } };
  const { manifest, report } = buildUiManifest(rows, reader, meta);
  if (report.issues.length > 0) {
    throw new SceneExtractionError(report.issues.map((i): SceneMissing => ({ assetId: i.assetId, container: i.container, canonicalPath: i.canonicalPath, reason: `UI: ${i.issue}` })));
  }
  const byId = new Map(ui.map((r) => [r.asset_id, r]));
  const entries = new Map(manifest.entries.map((e) => [e.logical_asset_id, e]));
  const outputs: Output[] = [];
  const fail = (id: string, reason: string): never => {
    const row = byId.get(id);
    throw new SceneExtractionError([{ assetId: id, container: row?.source_container ?? "data.grf", canonicalPath: row?.canonical_cp949_path ?? "(not in whitelist)", reason: `UI: ${reason}` }]);
  };
  const read = (id: string): { bytes: Uint8Array; from: From } => {
    const row = byId.get(id) ?? fail(id, "not whitelisted");
    try {
      const r = reader.read(row);
      return { bytes: r.bytes, from: { assetId: id, entrySha256: r.entrySha256, rawHex: row.raw_name_hex } };
    } catch (err) {
      return fail(id, `source unreadable: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  const header = (e: UiManifestEntry) => ({ rights: DERIVED_MARKER, converterVersion: CONVERTER_VERSION, profileId: UI_PROFILE_ID, entry: e });
  let bitmaps = 0;
  let fonts = 0;
  let cursorActions = 0;
  const fontFrom: From[] = [];

  for (const e of manifest.entries) {
    if (e.format === "bmp") {
      const src = read(e.logical_asset_id);
      let bmp;
      try {
        bmp = parseBmp(src.bytes);
      } catch (err) {
        return fail(e.logical_asset_id, `malformed: ${err instanceof Error ? err.message : String(err)}`);
      }
      if (bmp.width !== e.native_width || bmp.height !== e.native_height) fail(e.logical_asset_id, `decoded ${bmp.width}x${bmp.height} != manifest ${e.native_width}x${e.native_height}`);
      const png = encodePng(bmp.width, bmp.height, bmp.rgba, DERIVED_MARKER);
      const out = writeOutput(outDir, `${e.logical_asset_id}.png`, png);
      outputs.push({ ...out, from: [src.from] });
      const json = { ...header(e), derived: { file: out.file, sha256: out.sha256, width: bmp.width, height: bmp.height }, filter: "nearest", transparency: { rule: RO_COLOR_KEY_RULE, keyedPixels: bmp.keyedPixels } };
      outputs.push({ ...writeOutput(outDir, `${e.logical_asset_id}.json`, JSON.stringify(json)), from: [src.from] });
      bitmaps += 1;
    } else if (e.format === "otf") {
      fontFrom.push(read(e.logical_asset_id).from); // original bytes only, by logical ID (filesystem:System allowlist)
      fonts += 1;
    }
  }

  // Cursor: SPR atlas (indexed + rgba frames) and ACT data verbatim with the UI-A hotspots.
  const sprEntry = entries.get("ui.cursor.spr");
  const actEntry = entries.get("ui.cursor.act");
  if (sprEntry && actEntry) {
    const sprSrc = read("ui.cursor.spr");
    const actSrc = read("ui.cursor.act");
    let spr;
    let act;
    try {
      spr = parseSpr(sprSrc.bytes);
      act = parseAct(actSrc.bytes);
    } catch (err) {
      return fail("ui.cursor.spr", `malformed: ${err instanceof Error ? err.message : String(err)}`);
    }
    const frames = [...spr.indexed.map((f, i) => ({ f, type: "indexed" as const, index: i })), ...spr.rgba.map((f, i) => ({ f, type: "rgba" as const, index: i }))];
    const width = Math.max(1, frames.reduce((w, x) => w + x.f.width + 1, 0));
    const height = Math.max(1, ...frames.map((x) => x.f.height));
    const atlas = new Uint8Array(width * height * 4);
    const rects: { x: number; y: number; w: number; h: number; type: "indexed" | "rgba"; index: number }[] = [];
    let x = 0;
    for (const { f, type, index } of frames) {
      const rgba = frameToRgba(f, spr.palette);
      for (let y = 0; y < f.height; y += 1) atlas.set(rgba.subarray(y * f.width * 4, (y + 1) * f.width * 4), (y * width + x) * 4);
      rects.push({ x, y: 0, w: f.width, h: f.height, type, index });
      x += f.width + 1;
    }
    const from = [sprSrc.from, actSrc.from];
    const png = writeOutput(outDir, "ui.cursor.spr.png", encodePng(width, height, atlas, DERIVED_MARKER));
    outputs.push({ ...png, from });
    outputs.push({ ...writeOutput(outDir, "ui.cursor.spr.json", JSON.stringify({ ...header(sprEntry), derived: { file: png.file, sha256: png.sha256, width, height }, filter: "nearest", frames: rects })), from });
    const actions = act.actions.map((a) => ({ delay: a.delay, frames: a.frames.map((fr) => ({ layers: fr.layers.map((l) => ({ sprIndex: l.sprIndex, sprType: l.sprType, x: l.x, y: l.y, mirror: l.mirror, color: l.color, scaleX: l.scaleX, scaleY: l.scaleY, rotation: l.rotation })), anchors: fr.anchors, soundIndex: fr.soundIndex })) }));
    outputs.push({ ...writeOutput(outDir, "ui.cursor.act.json", JSON.stringify({ ...header(actEntry), actVersion: act.version, actions, hotspots: actEntry.cursor_hotspot_or_null })), from });
    cursorActions = act.actions.length;
  }

  const full = { rights: DERIVED_MARKER, converterVersion: CONVERTER_VERSION, ...manifest };
  outputs.push({ ...writeOutput(outDir, "ui/ui-manifest.json", JSON.stringify(full, null, 2)), from: [...outputs.flatMap((o) => o.from), ...fontFrom].filter((f, i, a) => a.findIndex((g) => g.assetId === f.assetId) === i).sort((a, b) => (a.assetId < b.assetId ? -1 : 1)) });
  return { outputs, summary: { profileId: UI_PROFILE_ID, entries: manifest.entries.length, bitmaps, cursorActions, fonts } };
}
