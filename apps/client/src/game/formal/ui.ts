/**
 * UI-B1 — FormalUiAssetLoader: fail-closed registry of the 108 RO UI assets of profile
 * KRO2021_CLASSIC_V0_FAN, loaded only by logical ID from the local gateway. Not wired into the visible
 * UI yet (no HUD in this step). It never synthesises a missing state, slice, cursor frame, texture or font:
 * any missing / drifted / undecodable / contract-violating asset is reported with ID + container + path.
 */
import { classifyUiAsset, isUiRow, UI_PROFILE_ID, uiButtonStates, type AssetWhitelist } from "@ro-survivor/asset-contracts";
import { uiManifestEntrySchema, type UiManifestEntry } from "@ro-survivor/content-schema";
import { MissingAssetsError, missingWhitelisted, type MissingAsset } from "../requirements.ts";
import { FORMAL_CONVERTER_VERSION, type FormalDecoders, type ImageLike } from "./load.ts";

export interface UiGatewayLike {
  getJson<T>(assetId: string): Promise<T>;
  getDerivedImage(assetId: string): Promise<Uint8Array>;
  getBinary(assetId: string): Promise<ArrayBuffer>;
}

interface DerivedUiHeader {
  converterVersion: number;
  profileId: string;
  entry: UiManifestEntry;
}
interface DerivedUiBitmap extends DerivedUiHeader {
  derived: { file: string; sha256: string; width: number; height: number };
  filter: string;
}
export interface DerivedCursorAct extends DerivedUiHeader {
  actVersion: string;
  actions: { delay: number; frames: { layers: { sprIndex: number; sprType: "indexed" | "rgba"; x: number; y: number }[] }[] }[];
  hotspots: { action: number; x: number; y: number }[];
}
export interface DerivedCursorSpr extends DerivedUiBitmap {
  frames: { x: number; y: number; w: number; h: number; type: "indexed" | "rgba"; index: number }[];
}

export interface FormalUiAssets {
  profileId: typeof UI_PROFILE_ID;
  entries: Map<string, UiManifestEntry>;
  /** Decoded derived bitmaps by logical ID (UI BMPs and the cursor atlas). */
  images: Map<string, ImageLike>;
  cursor: { atlas: DerivedCursorSpr; act: DerivedCursorAct };
  /** Original font bytes by logical ID (filesystem:System allowlist). */
  fonts: Map<string, ArrayBuffer>;
}

const reasonOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

export async function loadFormalUiAssets(gateway: UiGatewayLike, decoders: FormalDecoders, whitelist: AssetWhitelist, profileId: string): Promise<FormalUiAssets> {
  if (profileId !== UI_PROFILE_ID) throw new Error(`UI profile ${profileId} is not accepted (only ${UI_PROFILE_ID})`);
  const rows = whitelist.rows().filter(isUiRow);
  const missing: MissingAsset[] = [];
  const fail = (id: string, reason: string): void => {
    missing.push(missingWhitelisted(whitelist, id, reason));
  };
  const entries = new Map<string, UiManifestEntry>();
  const images = new Map<string, ImageLike>();
  const fonts = new Map<string, ArrayBuffer>();
  let cursorSpr: DerivedCursorSpr | null = null;
  let cursorAct: DerivedCursorAct | null = null;

  /** Manifest entry must describe exactly this whitelist row (no drift). */
  const checkEntry = (row: (typeof rows)[number], header: DerivedUiHeader): UiManifestEntry => {
    if (header.converterVersion !== FORMAL_CONVERTER_VERSION) throw new Error(`converter v${header.converterVersion}, client needs v${FORMAL_CONVERTER_VERSION}`);
    if (header.profileId !== UI_PROFILE_ID) throw new Error(`profile ${header.profileId} != ${UI_PROFILE_ID}`);
    const e = uiManifestEntrySchema.parse(header.entry);
    const c = classifyUiAsset(row);
    if (e.logical_asset_id !== row.asset_id) throw new Error(`entry is for ${e.logical_asset_id}`);
    if (e.reference_profile_id !== UI_PROFILE_ID) throw new Error(`entry profile ${e.reference_profile_id}`);
    if (e.source_container !== row.source_container || e.canonical_cp949_path !== row.canonical_cp949_path) throw new Error("source container / canonical path differ from the whitelist");
    if (e.source_size !== row.bytes || e.source_sha256.toUpperCase() !== row.sha256.toUpperCase()) throw new Error("source size / SHA-256 drift from the whitelist");
    if (e.role !== c.role || e.state !== c.state || JSON.stringify(e.slice) !== JSON.stringify(c.slice)) throw new Error("role / state / slice differ from the UI contract");
    return e;
  };

  await Promise.all(rows.map(async (row) => {
    const id = row.asset_id;
    try {
      if (row.source_container === "filesystem:System") {
        const bytes = await gateway.getBinary(id);
        const sig = String.fromCharCode(...new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength)));
        if (sig !== "OTTO") throw new Error(`font signature ${JSON.stringify(sig)} is not OTTO`);
        fonts.set(id, bytes);
        return;
      }
      if (id === "ui.cursor.act") {
        const act = await gateway.getJson<DerivedCursorAct>(id);
        const e = checkEntry(row, act);
        if (act.actions.length !== Number(row.act_actions || act.actions.length)) throw new Error(`ACT actions ${act.actions.length} != whitelist ${row.act_actions}`);
        if (act.hotspots.length !== act.actions.length) throw new Error("cursor hotspot missing for some action");
        cursorAct = act;
        entries.set(id, e);
        return;
      }
      const meta = await gateway.getJson<DerivedUiBitmap>(id);
      const e = checkEntry(row, meta);
      if (meta.filter !== "nearest") throw new Error(`filter ${meta.filter} is not nearest`);
      const img = await decoders.image(await gateway.getDerivedImage(id), "image/png");
      if (e.format === "bmp" && (img.width !== e.native_width || img.height !== e.native_height)) throw new Error(`decoded ${img.width}x${img.height} != native ${e.native_width ?? "?"}x${e.native_height ?? "?"}`);
      if (img.width !== meta.derived.width || img.height !== meta.derived.height) throw new Error("decoded size differs from the derived metadata");
      images.set(id, img);
      entries.set(id, e);
      if (id === "ui.cursor.spr") cursorSpr = meta as DerivedCursorSpr;
    } catch (err) {
      fail(id, `UI asset unavailable or invalid: ${reasonOf(err)}`);
    }
  }));

  // Cursor: every action's first layer must reference an existing atlas frame, hotspot inside it.
  const spr = cursorSpr as DerivedCursorSpr | null;
  const act = cursorAct as DerivedCursorAct | null;
  if (spr && act) {
    act.actions.forEach((a, i) => {
      const layer = a.frames[0]?.layers[0];
      const frame = layer ? spr.frames.find((f) => f.type === layer.sprType && f.index === layer.sprIndex) : undefined;
      const hs = act.hotspots.find((h) => h.action === i);
      if (!layer || !frame) fail("ui.cursor.act", `action ${i}: no first-frame layer with an atlas frame`);
      else if (!hs || hs.x < 0 || hs.y < 0 || hs.x >= frame.w || hs.y >= frame.h) fail("ui.cursor.act", `action ${i}: hotspot outside its ${frame.w}x${frame.h} frame`);
    });
  }
  // Completeness: every declared button state and every slice part must have its own loaded asset.
  for (const [group, states] of uiButtonStates(whitelist)) {
    const ids = rows.filter((r) => {
      const c = classifyUiAsset(r);
      return c.role === "button" && c.state !== null && (c.slice ? `${c.slice.group.split(".").slice(0, -1).join(".")}.*.${c.slice.part}` : r.asset_id.split(".").slice(0, -1).join(".")) === group;
    });
    if (ids.length !== states.length) fail(ids[0]?.asset_id ?? group, `button group ${group}: ${ids.length} rows for ${states.length} states`);
  }
  for (const r of rows) {
    const c = classifyUiAsset(r);
    if (!c.slice) continue;
    for (const part of ["left", "mid", "right"] as const) {
      const pid = `${c.slice.group}.${part}`;
      if (!whitelist.has(pid)) fail(r.asset_id, `three-part slice ${c.slice.group} lacks ${part}`);
    }
  }
  if (missing.length > 0 || !spr || !act) {
    if (!spr && !missing.some((m) => m.assetId === "ui.cursor.spr")) fail("ui.cursor.spr", "cursor atlas not loaded");
    if (!act && !missing.some((m) => m.assetId === "ui.cursor.act")) fail("ui.cursor.act", "cursor ACT not loaded");
    throw new MissingAssetsError([...new Map(missing.map((m) => [`${m.assetId ?? ""}|${m.reason}`, m])).values()].sort((a, b) => ((a.assetId ?? "") < (b.assetId ?? "") ? -1 : 1)));
  }
  return { profileId: UI_PROFILE_ID, entries, images, cursor: { atlas: spr, act }, fonts };
}
