/**
 * Build the RO UI asset manifest (CLAUDE-PHASE1-RO-UI.md §3.2) from the verified local sources.
 * Only whitelisted UI rows are read (by asset ID / raw hex through the gateway reader). The output
 * holds metadata only — dimensions, hotspots, hashes — never pixels.
 */
import { classifyUiAsset, declaredUiDimensions, isUiRow, UI_PROFILE_ID } from "@ro-survivor/asset-contracts";
import { isFilesystemContainer, uiManifestEntrySchema, type UiManifest, type UiManifestEntry, type WhitelistRow } from "@ro-survivor/content-schema";
import type { AssetReader } from "@ro-survivor/asset-gateway";
import { parseAct, parseSpr } from "@ro-survivor/ro-format-runtime";

export interface UiManifestReport {
  profileId: string;
  categories: Record<string, { found: number; missing: number; ambiguous: number }>;
  issues: { assetId: string; container: string; canonicalPath: string; issue: string }[];
}

function bmpHeader(bytes: Uint8Array): { width: number; height: number; bpp: number } {
  if (bytes[0] !== 0x42 || bytes[1] !== 0x4d) throw new Error("BMP signature missing");
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: v.getInt32(18, true), height: Math.abs(v.getInt32(22, true)), bpp: v.getUint16(28, true) };
}

export function buildUiManifest(rows: readonly WhitelistRow[], reader: AssetReader, meta: { lockId: string; whitelistSha256: string }): { manifest: UiManifest; report: UiManifestReport } {
  const report: UiManifestReport = { profileId: UI_PROFILE_ID, categories: {}, issues: [] };
  const entries: UiManifestEntry[] = [];
  const sprDims = new Map<string, { width: number; height: number }[]>();
  const ui = rows.filter(isUiRow);
  // SPR before ACT so cursor hotspots can be bounded by the sprite frames.
  const ordered = [...ui].sort((a, b) => Number(a.canonical_cp949_path.toLowerCase().endsWith(".act")) - Number(b.canonical_cp949_path.toLowerCase().endsWith(".act")));
  for (const row of ordered) {
    const cat = (report.categories[row.category] ??= { found: 0, missing: 0, ambiguous: 0 });
    const issue = (msg: string): void => {
      report.issues.push({ assetId: row.asset_id, container: row.source_container, canonicalPath: row.canonical_cp949_path, issue: msg });
    };
    let read;
    try {
      read = reader.read(row);
    } catch (err) {
      cat.missing += 1;
      issue(err instanceof Error ? err.message : String(err));
      continue;
    }
    if (!isFilesystemContainer(row.source_container) && row.rdata_override === "false" && reader.hasRdataOverride(row)) {
      cat.ambiguous += 1;
      issue("rdata.grf holds an undeclared same-name entry (version ambiguity)");
      continue;
    }
    const ext = row.canonical_cp949_path.split(".").pop()?.toLowerCase() ?? "";
    const c = classifyUiAsset(row);
    const base = {
      logical_asset_id: row.asset_id,
      source_container: row.source_container as UiManifestEntry["source_container"],
      canonical_cp949_path: row.canonical_cp949_path,
      canonical_cp949_raw_hex: row.raw_name_hex,
      source_size: read.bytes.length,
      source_sha256: read.entrySha256,
      role: c.role,
      state: c.state,
      slice: c.slice,
      nine_slice_insets_or_null: null,
      reference_profile_id: UI_PROFILE_ID,
    };
    let entry: UiManifestEntry;
    try {
      if (ext === "bmp") {
        const h = bmpHeader(read.bytes);
        const declared = declaredUiDimensions(row.notes);
        if (declared && (declared.width !== h.width || declared.height !== h.height)) throw new Error(`native ${h.width}x${h.height} != declared ${declared.width}x${declared.height}`);
        entry = { ...base, format: "bmp", native_width: h.width, native_height: h.height, cursor_hotspot_or_null: null, transparent_key_or_alpha_mode: "magenta-key" };
      } else if (ext === "spr") {
        const s = parseSpr(read.bytes);
        sprDims.set(row.asset_id.replace(/\.spr$/u, ""), s.indexed.map((f) => ({ width: f.width, height: f.height })));
        const f0 = s.indexed[0];
        entry = { ...base, format: "spr", native_width: f0?.width ?? null, native_height: f0?.height ?? null, cursor_hotspot_or_null: null, transparent_key_or_alpha_mode: "spr-palette-index0" };
      } else if (ext === "act") {
        const a = parseAct(read.bytes);
        if (row.act_version !== "" && a.version !== row.act_version) throw new Error(`ACT ${a.version} != whitelist ${row.act_version}`);
        if (row.act_actions !== "" && a.actions.length !== Number(row.act_actions)) throw new Error(`ACT actions ${a.actions.length} != whitelist ${row.act_actions}`);
        const frames = sprDims.get(row.asset_id.replace(/\.act$/u, "")) ?? [];
        const hotspots = a.actions.map((act, i) => {
          const layer = act.frames[0]?.layers[0];
          const f = layer ? frames[layer.sprIndex] : undefined;
          if (!layer || !f) throw new Error(`action ${i}: no first-frame layer with a sprite`);
          // ACT layer offset is the sprite centre relative to the pointer; the hotspot is its inverse.
          const x = Math.floor(f.width / 2) - layer.x;
          const y = Math.floor(f.height / 2) - layer.y;
          if (x < 0 || y < 0 || x >= f.width || y >= f.height) throw new Error(`action ${i}: hotspot (${x},${y}) outside ${f.width}x${f.height}`);
          return { action: i, x, y };
        });
        entry = { ...base, format: "act", native_width: null, native_height: null, cursor_hotspot_or_null: c.role === "cursor" ? hotspots : null, transparent_key_or_alpha_mode: "not-applicable" };
      } else if (ext === "otf") {
        if (String.fromCharCode(...read.bytes.subarray(0, 4)) !== "OTTO") throw new Error("OpenType CFF signature OTTO missing");
        entry = { ...base, format: "otf", native_width: null, native_height: null, cursor_hotspot_or_null: null, transparent_key_or_alpha_mode: "not-applicable" };
      } else {
        throw new Error(`unsupported UI format .${ext}`);
      }
      uiManifestEntrySchema.parse(entry);
    } catch (err) {
      cat.missing += 1;
      issue(err instanceof Error ? err.message : String(err));
      continue;
    }
    cat.found += 1;
    entries.push(entry);
  }
  entries.sort((a, b) => (a.logical_asset_id < b.logical_asset_id ? -1 : 1));
  return { manifest: { schemaVersion: 1, profileId: UI_PROFILE_ID, lockId: meta.lockId, whitelistSha256: meta.whitelistSha256, entries }, report };
}
