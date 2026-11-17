/**
 * UI-B1 — FormalUiAssetLoader: fail-closed registry of the 108 RO UI assets of profile
 * KRO2021_CLASSIC_V0_FAN, loaded only by logical ID from the local gateway. Not wired into the visible
 * UI yet (no HUD in this step). It never synthesises a missing state, slice, cursor frame, texture or font:
 * any contract, identity, registry, drift, decode or validation failure is reported with ID + container + path.
 */
import {
  CANONICAL_WHITELIST_SHA256, classifyUiAsset, isUiRow, UI_ENTRY_SET_SHA256, UI_PROFILE_ID, UI_REGISTRY, UI_REGISTRY_COUNT,
  type AssetGatewayHealth, type AssetWhitelist,
} from "@ro-survivor/asset-contracts";
import {
  derivedCursorActSchema, derivedCursorSprSchema, derivedUiBitmapSchema,
  type DerivedCursorAct, type DerivedCursorSpr, type DerivedUiBitmap, type UiManifestEntry, type WhitelistRow,
} from "@ro-survivor/content-schema";
import { MissingAssetsError, missingWhitelisted, type MissingAsset } from "../requirements.ts";
import type { RasterRegistry } from "../../ui/ro/raster.ts";
import { mintRasterSet } from "./rasterMint.ts";
import { FORMAL_CONVERTER_VERSION, type FormalDecoders, type ImageLike } from "./load.ts";

export interface UiGatewayLike {
  health(): Promise<AssetGatewayHealth>;
  getJson<T>(assetId: string): Promise<T>;
  getDerivedImage(assetId: string): Promise<Uint8Array>;
  getBinary(assetId: string): Promise<ArrayBuffer>;
}

export interface UiExpectedIdentity {
  profileId: string;
  /** SHA-256 of the canonical whitelist CSV bytes the client was built with. */
  whitelistSha256: string;
}

export interface FormalUiAssets {
  profileId: typeof UI_PROFILE_ID;
  lockId: string;
  entries: Map<string, UiManifestEntry>;
  /** Decoded derived bitmaps by logical ID (UI BMPs and the cursor atlas). */
  images: Map<string, ImageLike>;
  cursor: { atlas: DerivedCursorSpr; act: DerivedCursorAct };
  /** Original font bytes by logical ID (filesystem:System allowlist). */
  fonts: Map<string, ArrayBuffer>;
  /** UI-B2: lifecycle-owned handles for every verified PNG (issued only after all checks passed). */
  rasters: RasterRegistry;
}

const reasonOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));
const contractError = (field: string, reason: string): MissingAssetsError =>
  new MissingAssetsError([{ assetId: null, container: "contract", canonicalPath: field, reason }]);

async function sha256Upper(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export async function loadFormalUiAssets(
  gateway: UiGatewayLike,
  decoders: FormalDecoders,
  whitelist: AssetWhitelist,
  expected: UiExpectedIdentity,
): Promise<FormalUiAssets> {
  // 1. Contract identity, before any UI asset is requested.
  if (expected.profileId !== UI_PROFILE_ID) throw contractError("profileId", `UI profile ${expected.profileId} is not accepted (only ${UI_PROFILE_ID})`);
  if (expected.whitelistSha256.toUpperCase() !== CANONICAL_WHITELIST_SHA256) throw contractError("whitelistSha256", `client whitelist ${expected.whitelistSha256} is not the canonical v3 ${CANONICAL_WHITELIST_SHA256}`);
  const health = await gateway.health();
  const id = health.derived;
  if (!id) throw contractError("derived", "gateway has no ready derived manifest");
  if (id.converterVersion !== FORMAL_CONVERTER_VERSION) throw contractError("derived.converterVersion", `v${id.converterVersion}, client needs v${FORMAL_CONVERTER_VERSION}`);
  if (!health.lockId || id.lockId !== health.lockId) throw contractError("derived.lockId", `manifest lock ${id.lockId} is not the gateway's verified lock ${health.lockId ?? "(none)"}`);
  if (id.whitelistSha256.toUpperCase() !== CANONICAL_WHITELIST_SHA256) throw contractError("derived.whitelistSha256", `manifest whitelist ${id.whitelistSha256} is not canonical`);
  if (id.uiProfileId !== UI_PROFILE_ID) throw contractError("derived.uiProfileId", `manifest profile ${id.uiProfileId}`);
  if (id.uiEntrySetSha256 !== UI_ENTRY_SET_SHA256) throw contractError("derived.uiEntrySetSha256", "manifest UI entry set differs from the canonical 108-row registry");

  const missing: MissingAsset[] = [];
  const failRow = (assetId: string, reason: string): void => {
    missing.push(missingWhitelisted(whitelist, assetId, reason));
  };
  // 2. Canonical registry vs whitelist: missing, extra, duplicate or drifted rows all block.
  const registry = new Map(UI_REGISTRY.map(([assetId, category, container, path]) => [assetId, { category, container, path }]));
  if (registry.size !== UI_REGISTRY_COUNT) throw contractError("registry", `canonical registry has ${registry.size} unique IDs, expected ${UI_REGISTRY_COUNT}`);
  const rows = new Map<string, WhitelistRow>();
  for (const [assetId, reg] of registry) {
    if (!whitelist.has(assetId)) {
      missing.push({ assetId, container: reg.container, canonicalPath: reg.path, reason: "canonical UI row is missing from the whitelist" });
      continue;
    }
    const row = whitelist.get(assetId);
    if (row.category !== reg.category || row.source_container !== reg.container || row.canonical_cp949_path !== reg.path) {
      missing.push({ assetId, container: reg.container, canonicalPath: reg.path, reason: "whitelist row drifts from the canonical registry (category / container / path)" });
      continue;
    }
    rows.set(assetId, row);
  }
  for (const r of whitelist.rows().filter(isUiRow)) if (!registry.has(r.asset_id)) failRow(r.asset_id, "UI row is not in the canonical KRO2021_CLASSIC_V0_FAN registry");

  const entries = new Map<string, UiManifestEntry>();
  const images = new Map<string, ImageLike>();
  const fonts = new Map<string, ArrayBuffer>();
  let spr: DerivedCursorSpr | null = null;
  let act: DerivedCursorAct | null = null;
  let atlasImage: ImageLike | null = null;
  /** Verified PNG bytes, held until every check has passed; only then are handles issued. */
  const pngBytes = new Map<string, Uint8Array>();
  const derivedSha = new Map<string, string>();

  const checkHeader = (row: WhitelistRow, h: { converterVersion: number; profileId: string; lockId: string; whitelistSha256: string; entrySetSha256: string; entry: UiManifestEntry }): UiManifestEntry => {
    if (h.converterVersion !== id.converterVersion) throw new Error(`converterVersion ${h.converterVersion} != manifest ${id.converterVersion}`);
    if (h.profileId !== UI_PROFILE_ID) throw new Error(`profileId ${h.profileId}`);
    if (h.lockId !== id.lockId) throw new Error(`lockId ${h.lockId} != manifest ${id.lockId}`);
    if (h.whitelistSha256.toUpperCase() !== CANONICAL_WHITELIST_SHA256) throw new Error("whitelistSha256 is not canonical");
    if (h.entrySetSha256 !== UI_ENTRY_SET_SHA256) throw new Error("entrySetSha256 differs from the canonical registry");
    const e = h.entry;
    const c = classifyUiAsset(row);
    if (e.logical_asset_id !== row.asset_id) throw new Error(`entry is for ${e.logical_asset_id}`);
    if (e.reference_profile_id !== UI_PROFILE_ID) throw new Error(`entry profile ${e.reference_profile_id}`);
    if (e.source_container !== row.source_container || e.canonical_cp949_path !== row.canonical_cp949_path) throw new Error("source container / canonical path differ from the whitelist");
    if (e.source_size !== row.bytes || e.source_sha256.toUpperCase() !== row.sha256.toUpperCase()) throw new Error("source size / SHA-256 drift from the whitelist");
    if (e.role !== c.role || e.state !== c.state || JSON.stringify(e.slice) !== JSON.stringify(c.slice)) throw new Error("role / state / slice differ from the UI contract");
    return e;
  };
  /** Derived PNG: bytes must hash to the JSON's declared SHA-256, decode to the declared size. */
  const loadPng = async (assetId: string, meta: DerivedUiBitmap): Promise<ImageLike> => {
    const bytes = await gateway.getDerivedImage(assetId);
    pngBytes.set(assetId, bytes);
    derivedSha.set(assetId, meta.derived.sha256);
    const got = await sha256Upper(bytes);
    if (got !== meta.derived.sha256.toUpperCase()) throw new Error(`derived PNG SHA-256 ${got} != declared ${meta.derived.sha256}`);
    const img = await decoders.image(bytes, "image/png");
    if (img.width !== meta.derived.width || img.height !== meta.derived.height) throw new Error(`decoded ${img.width}x${img.height} != derived ${meta.derived.width}x${meta.derived.height}`);
    return img;
  };

  // 3. Load every canonical UI asset by logical ID only.
  await Promise.all([...rows.values()].map(async (row) => {
    const assetId = row.asset_id;
    try {
      if (row.source_container === "filesystem:System") {
        const bytes = await gateway.getBinary(assetId);
        const sig = String.fromCharCode(...new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength)));
        if (sig !== "OTTO") throw new Error(`font signature ${JSON.stringify(sig)} is not OTTO`);
        fonts.set(assetId, bytes);
        return;
      }
      if (assetId === "ui.cursor.act") {
        const a = derivedCursorActSchema.parse(await gateway.getJson<unknown>(assetId));
        entries.set(assetId, checkHeader(row, a));
        if (row.act_actions !== "" && a.actions.length !== Number(row.act_actions)) throw new Error(`ACT actions ${a.actions.length} != whitelist ${row.act_actions}`);
        act = a;
        return;
      }
      if (assetId === "ui.cursor.spr") {
        const s = derivedCursorSprSchema.parse(await gateway.getJson<unknown>(assetId));
        entries.set(assetId, checkHeader(row, s));
        atlasImage = await loadPng(assetId, s);
        images.set(assetId, atlasImage);
        spr = s;
        return;
      }
      const meta = derivedUiBitmapSchema.parse(await gateway.getJson<unknown>(assetId));
      const e = checkHeader(row, meta);
      const img = await loadPng(assetId, meta);
      if (img.width !== e.native_width || img.height !== e.native_height) throw new Error(`decoded ${img.width}x${img.height} != native ${e.native_width ?? "?"}x${e.native_height ?? "?"}`);
      images.set(assetId, img);
      entries.set(assetId, e);
    } catch (err) {
      entries.delete(assetId);
      failRow(assetId, `UI asset unavailable or invalid: ${reasonOf(err)}`);
    }
  }));

  // 4. Cursor: atlas rects inside the atlas and unique; every non-empty layer of every frame of every
  //    action references an atlas frame; hotspots exactly one per action 0..n-1, inside that action's frame.
  const s = spr as DerivedCursorSpr | null;
  const a = act as DerivedCursorAct | null;
  const atlas = atlasImage as ImageLike | null;
  if (s && a && atlas) {
    const seen = new Set<string>();
    for (const f of s.frames) {
      const key = `${f.type}:${f.index}`;
      if (seen.has(key)) failRow("ui.cursor.spr", `duplicate atlas frame ${key}`);
      seen.add(key);
      if (f.x + f.w > s.derived.width || f.y + f.h > s.derived.height || f.x + f.w > atlas.width || f.y + f.h > atlas.height) failRow("ui.cursor.spr", `atlas frame ${key} rect outside the ${s.derived.width}x${s.derived.height} atlas`);
    }
    const frameOf = (type: string, index: number) => s.frames.find((f) => f.type === type && f.index === index);
    a.actions.forEach((action, ai) => {
      if (action.frames.length === 0) failRow("ui.cursor.act", `action ${ai} has no frames`);
      action.frames.forEach((fr, fi) => fr.layers.forEach((l, li) => {
        if (l.sprIndex >= 0 && !frameOf(l.sprType, l.sprIndex)) failRow("ui.cursor.act", `action ${ai} frame ${fi} layer ${li}: ${l.sprType} ${l.sprIndex} not in the atlas`);
      }));
    });
    const actionsWithHotspot = a.hotspots.map((h) => h.action);
    const expectedActions = a.actions.map((_, i) => i);
    if (new Set(actionsWithHotspot).size !== actionsWithHotspot.length || [...actionsWithHotspot].sort((x, y) => x - y).join() !== expectedActions.join()) {
      failRow("ui.cursor.act", `hotspot actions [${actionsWithHotspot.join(",")}] are not exactly 0..${a.actions.length - 1}`);
    }
    for (const h of a.hotspots) {
      const l = a.actions[h.action]?.frames[0]?.layers[0];
      const f = l ? frameOf(l.sprType, l.sprIndex) : undefined;
      if (!f || h.x < 0 || h.y < 0 || h.x >= f.w || h.y >= f.h) failRow("ui.cursor.act", `action ${h.action}: hotspot (${h.x},${h.y}) outside its frame`);
    }
  } else {
    if (!s && !missing.some((m) => m.assetId === "ui.cursor.spr")) failRow("ui.cursor.spr", "cursor atlas not loaded");
    if (!a && !missing.some((m) => m.assetId === "ui.cursor.act")) failRow("ui.cursor.act", "cursor ACT not loaded");
  }

  // 5. Completeness against the canonical registry: every button state and every slice part is its own
  //    loaded asset (fonts are tracked separately); nothing is derived from a neighbour.
  for (const [assetId, reg] of registry) {
    const c = classifyUiAsset({ asset_id: assetId, category: reg.category });
    const loaded = reg.container === "filesystem:System" ? fonts.has(assetId) : entries.has(assetId);
    if (!loaded && !missing.some((m) => m.assetId === assetId)) {
      missing.push({ assetId, container: reg.container, canonicalPath: reg.path, reason: c.state ? `button state ${c.state} not loaded` : c.slice ? `slice ${c.slice.group}.${c.slice.part} not loaded` : "not loaded" });
    }
  }
  if (missing.length > 0 || !s || !a) {
    throw new MissingAssetsError([...new Map(missing.map((m) => [`${m.assetId ?? ""}|${m.reason}`, m])).values()].sort((x, y) => ((x.assetId ?? "") < (y.assetId ?? "") ? -1 : 1)));
  }
  // Mint every handle in one transaction (all or nothing), only after every check above has passed.
  const items = [...images].map(([assetId, img]) => {
    const bytes = pngBytes.get(assetId);
    const entry = entries.get(assetId);
    if (!bytes || !entry) throw new MissingAssetsError([missingWhitelisted(whitelist, assetId, "verified bytes / entry missing at handle issue")]);
    const sha256 = derivedSha.get(assetId);
    if (!sha256) throw new MissingAssetsError([missingWhitelisted(whitelist, assetId, "declared PNG SHA-256 missing at handle issue")]);
    return { assetId, bytes, sha256, width: img.width, height: img.height, entry };
  });
  const rasters = await mintRasterSet(items);
  return { profileId: UI_PROFILE_ID, lockId: id.lockId, entries, images, cursor: { atlas: s, act: a }, fonts, rasters };
}
