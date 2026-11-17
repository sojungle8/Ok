import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { classifyUiAsset, declaredUiDimensions, UI_PROFILE_ID } from "@ro-survivor/asset-contracts";
import type { UiManifestEntry } from "@ro-survivor/content-schema";
import { MissingAssetsError } from "../src/game/requirements.ts";
import { whitelist } from "../src/gateway.ts";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { mintRasterSet, RasterIssuanceError, type MintItem } from "../src/game/formal/rasterMint.ts";
import { loadFormalUiAssets } from "../src/game/formal/ui.ts";
import * as roPublic from "../src/ui/ro/index.ts";
import { isVerifiedRaster, planButton, planGauge, planRaster, planSlot, planThreeSlice, RoButton, RoGauge, RoRaster, RoSlot, RoThreeSlice, type VerifiedRaster } from "../src/ui/ro/index.ts";
import { codeRefs, externalRuntimeImports, FORBIDDEN, guardGraph, mintUsage, moduleGraph, relPosix, scanFormalVisual } from "./visual-guard.ts";

/**
 * SYNTHETIC structural harness. TEST-ONLY ADAPTER: tests mint handles with the loader-internal
 * `mintRasterSet` (production code may import / call it only from game/formal/ui.ts — see the
 * call-site guard over all of src). The browser URL API is stubbed; entries derive from the canonical
 * whitelist rows; PNG bytes are a PNG signature + the asset ID.
 */
let urlLog: string[] = [];
let urlCount = 0;
let failCreateAt = 0;
let failRevoke: (u: string) => boolean = () => false;
let createThrow: (n: number) => unknown = (n) => new Error(`createObjectURL failed at ${n}`);
let blobs: Blob[] = [];
beforeEach(() => {
  urlLog = [];
  urlCount = 0;
  failCreateAt = 0;
  failRevoke = () => false;
  createThrow = (n) => new Error(`createObjectURL failed at ${n}`);
  blobs = [];
  vi.spyOn(URL, "createObjectURL").mockImplementation((b: Blob | MediaSource) => {
    urlCount += 1;
    if (urlCount === failCreateAt) throw createThrow(urlCount);
    blobs.push(b as Blob);
    return `blob:synthetic/${urlCount}`;
  });
  vi.spyOn(URL, "revokeObjectURL").mockImplementation((u: string) => {
    urlLog.push(`revoke ${u}`);
    if (failRevoke(u)) throw new Error(`revoke failed for ${u}`);
  });
});
afterEach(() => vi.restoreAllMocks());

function entryFor(id: string): UiManifestEntry {
  const row = whitelist.get(id);
  const c = classifyUiAsset(row);
  const dim = declaredUiDimensions(row.notes) ?? { width: 8, height: 8 };
  return {
    logical_asset_id: id, source_container: row.source_container as "data.grf", canonical_cp949_path: row.canonical_cp949_path, canonical_cp949_raw_hex: row.raw_name_hex,
    source_size: row.bytes, source_sha256: row.sha256, format: "bmp", native_width: dim.width, native_height: dim.height, role: c.role, state: c.state, slice: c.slice,
    nine_slice_insets_or_null: null, cursor_hotspot_or_null: null, transparent_key_or_alpha_mode: "magenta-key", reference_profile_id: UI_PROFILE_ID,
  };
}
const pngBytes = (id: string) => Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Buffer.from(id)]);
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex").toUpperCase();
const itemFor = (id: string): MintItem => {
  const e = entryFor(id);
  const bytes = pngBytes(id);
  return { assetId: id, bytes, sha256: sha(bytes), width: e.native_width ?? 1, height: e.native_height ?? 1, entry: e };
};
async function rasterSet(ids: string[]) {
  return { set: await mintRasterSet(ids.map(itemFor)), log: urlLog };
}
const missingOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (err) {
    if (err instanceof MissingAssetsError) return err.missing;
    throw err;
  }
  throw new Error("expected MissingAssetsError");
};
const srcDir = resolve(import.meta.dirname, "../src");

describe("verified raster handles (synthetic harness)", () => {
  it("unknown ID -> canonical container/path; deterministic, double-dispose-safe revoke", async () => {
    const { set, log } = await rasterSet(["ui.arrow.left", "ui.arrow.right"]);
    const h = set.get("ui.arrow.left");
    expect([h.width, h.height, h.entry.canonical_cp949_path]).toEqual([11, 11, whitelist.get("ui.arrow.left").canonical_cp949_path]);
    expect(isVerifiedRaster(h)).toBe(true);
    expect(missingOf(() => set.get("ui.arrow.up"))).toEqual([expect.objectContaining({ assetId: "ui.arrow.up", container: "data.grf", canonicalPath: whitelist.get("ui.arrow.up").canonical_cp949_path })]);
    expect(missingOf(() => set.get("ui.not.real"))).toEqual([expect.objectContaining({ assetId: "ui.not.real", canonicalPath: "(not in the canonical UI registry)" })]);
    set.dispose();
    set.dispose();
    expect(log).toEqual(["revoke blob:synthetic/1", "revoke blob:synthetic/2"]);
    expect(() => h.url).toThrow(/disposed/u);
    expect(missingOf(() => set.get("ui.arrow.left"))).toEqual([expect.objectContaining({ assetId: "ui.arrow.left", reason: expect.stringContaining("disposed") as unknown })]);
  });

  it("B2-1/R1: no public mint; forged IDs, entries, sizes, bytes and URLs never become verified", async () => {
    expect(Object.keys(roPublic).filter((k) => /mint|issue|RasterSet|UrlFactory|browserRaster/iu.test(k))).toEqual([]);
    const { set } = await rasterSet(["ui.arrow.left"]);
    const h = set.get("ui.arrow.left");
    expect(isVerifiedRaster({ ...h, url: "https://evil.invalid/a.png" })).toBe(false);
    expect(isVerifiedRaster(Object.create(Object.getPrototypeOf(h) as object))).toBe(false);
    await expect(mintRasterSet([{ ...itemFor("ui.arrow.left"), assetId: "ui.forged.icon", entry: { ...entryFor("ui.arrow.left"), logical_asset_id: "ui.forged.icon" } }])).rejects.toThrow(/not in the canonical UI registry/u);
    await expect(mintRasterSet([{ ...itemFor("ui.arrow.left"), entry: entryFor("ui.arrow.right") }])).rejects.toThrow(/entry is for/u);
    await expect(mintRasterSet([{ ...itemFor("ui.arrow.left"), width: 99 }])).rejects.toThrow(/!= native/u);
    await expect(mintRasterSet([{ ...itemFor("ui.arrow.left"), bytes: Uint8Array.from([1, 2, 3]) }])).rejects.toThrow(/not a PNG/u);
    const forged = Uint8Array.from([...pngBytes("ui.arrow.left"), 0xff]);
    await expect(mintRasterSet([{ ...itemFor("ui.arrow.left"), bytes: forged }])).rejects.toThrow(/PNG SHA-256 .* != declared/u);
    // The production loader has no URL-factory parameter: the URL always comes from the verified bytes.
    expect(loadFormalUiAssets.length).toBe(4);
    expect(readFileSync(join(srcDir, "game/formal/ui.ts"), "utf8")).not.toMatch(/rasterUrls|RasterUrlFactory/u);
  });

  it("B2-1/R1: across all of apps/client/src only game/formal/ui.ts imports/calls the mint; a rogue file is caught", () => {
    expect(mintUsage(srcDir)).toEqual({ importers: ["game/formal/ui.ts", "ui/ro/raster.ts"], callers: ["game/formal/ui.ts"], opaque: [], rasterImportsOnlyBrand: true });
    const dir = mkdtempSync(join(tmpdir(), "ro-mint-"));
    try {
      mkdirSync(join(dir, "game/formal"), { recursive: true });
      mkdirSync(join(dir, "ui/ro"), { recursive: true });
      mkdirSync(join(dir, "screens"), { recursive: true });
      writeFileSync(join(dir, "game/formal/rasterMint.ts"), "export async function mintRasterSet() {}\nexport function isMintedRaster() {}\n");
      writeFileSync(join(dir, "game/formal/ui.ts"), `import { mintRasterSet } from "./rasterMint.ts";\nawait mintRasterSet([]);\n`);
      writeFileSync(join(dir, "ui/ro/raster.ts"), `import { isMintedRaster } from "../../game/formal/rasterMint.ts";\n`);
      writeFileSync(join(dir, "screens/Rogue.tsx"), `import { mintRasterSet } from "../game/formal/rasterMint";\nvoid mintRasterSet([]);\n`);
      expect(mintUsage(dir)).toEqual({ importers: ["game/formal/ui.ts", "screens/Rogue.tsx", "ui/ro/raster.ts"], callers: ["game/formal/ui.ts", "screens/Rogue.tsx"], opaque: [], rasterImportsOnlyBrand: true });
      // R3-7: computed / non-literal dynamic import and import.meta.glob are opaque module loads
      writeFileSync(join(dir, "screens/Sneaky.tsx"), `const p = "../game/formal/" + "rasterMint";\nvoid import(p);\n`);
      writeFileSync(join(dir, "screens/Glob.ts"), `export const mods = import.meta.glob("../game/formal/*.ts");\n`);
      writeFileSync(join(dir, "screens/Tpl.ts"), "const n = 'rasterMint';\nvoid import(`../game/formal/${n}.ts`);\n");
      writeFileSync(join(dir, "screens/Alias.ts"), `import * as M from "../game/formal/rasterMint.ts";\nconst k = "mint" + "RasterSet";\nvoid (M as Record<string, unknown>)[k];\n`);
      const u = mintUsage(dir);
      expect(u.opaque).toEqual(["screens/Glob.ts", "screens/Sneaky.tsx", "screens/Tpl.ts"]);
      expect(u.importers).toContain("screens/Alias.ts");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("B2-2: handle metadata is an independent, recursively frozen copy", async () => {
    const item = itemFor("ui.button.hover.left");
    const set = await mintRasterSet([item]);
    const h = set.get("ui.button.hover.left");
    expect(() => {
      (h.entry as { role: string }).role = "icon";
    }).toThrow(TypeError);
    expect(() => {
      (h.entry.slice as { part: string }).part = "mid";
    }).toThrow(TypeError);
    (item.entry as { role: string }).role = "icon";
    (item.entry.slice as { part: string }).part = "mid";
    expect([h.entry.role, h.entry.slice?.part]).toEqual(["button", "left"]);
  });

  it("B2-3: a URL failure at item N revokes items 1..N-1 exactly once and returns nothing", async () => {
    const ids = ["ui.arrow.left", "ui.arrow.right", "ui.arrow.up", "ui.arrow.down"];
    failCreateAt = 3;
    await expect(mintRasterSet(ids.map(itemFor))).rejects.toThrow(/createObjectURL failed at 3/u);
    expect(urlLog).toEqual(["revoke blob:synthetic/1", "revoke blob:synthetic/2"]);
  });

  it("B2-R2: metadata failures (non-cloneable / bad entry) happen before any URL exists", async () => {
    const ids = ["ui.arrow.left", "ui.arrow.right", "ui.arrow.up"];
    const nonCloneable = ids.map(itemFor);
    (nonCloneable[2]?.entry as unknown as { extra: () => void }).extra = () => undefined;
    await expect(mintRasterSet(nonCloneable)).rejects.toThrow(/could not be cloned|DataCloneError/u);
    const cyclic = ids.map(itemFor);
    (cyclic[1]?.entry as unknown as { self: unknown }).self = cyclic[1]?.entry;
    const ok = await mintRasterSet(cyclic); // cyclic data clones and freezes without recursion trouble
    expect(Object.isFrozen((ok.get("ui.arrow.right").entry as unknown as { self: object }).self)).toBe(true);
    ok.dispose();
    urlCount = 0;
    urlLog = [];
    const bad = ids.map(itemFor);
    bad[2] = { ...(bad[2] as MintItem), entry: entryFor("ui.arrow.left") };
    await expect(mintRasterSet(bad)).rejects.toThrow(/entry is for/u);
    expect(urlCount).toBe(0);
    expect(urlLog).toEqual([]);
  });

  it("B2-R2: rollback keeps going past a revoke error and preserves the original error", async () => {
    const ids = ["ui.arrow.left", "ui.arrow.right", "ui.arrow.up", "ui.arrow.down"];
    failCreateAt = 4;
    failRevoke = (u) => u === "blob:synthetic/1";
    const err = await mintRasterSet(ids.map(itemFor)).catch((e: unknown) => e);
    expect((err as Error).message).toMatch(/createObjectURL failed at 4/u);
    expect((err as { cleanupErrors: Error[] }).cleanupErrors.map((e) => e.message)).toEqual(["revoke failed for blob:synthetic/1"]);
    expect(urlLog).toEqual(["revoke blob:synthetic/1", "revoke blob:synthetic/2", "revoke blob:synthetic/3"]);
  });

  it("R2-1: mutating items / bytes / entry while the mint is pending changes nothing that is issued", async () => {
    const item = itemFor("ui.arrow.left");
    const original = Uint8Array.from(item.bytes);
    const evil = pngBytes("ui.arrow.right");
    const pending = mintRasterSet([item]);
    // replace every caller-visible field and mutate the original buffer / entry in place
    item.bytes[8] = 0x00;
    item.bytes = evil;
    item.assetId = "ui.arrow.right";
    item.width = 99;
    item.height = 99;
    item.sha256 = sha(evil);
    (item.entry as { logical_asset_id: string }).logical_asset_id = "ui.arrow.right";
    (item.entry as { role: string }).role = "icon";
    const set = await pending;
    expect(set.ids()).toEqual(["ui.arrow.left"]);
    expect(set.has("ui.arrow.right")).toBe(false);
    const h = set.get("ui.arrow.left");
    expect([h.assetId, h.width, h.height, h.entry.logical_asset_id, h.entry.role]).toEqual(["ui.arrow.left", 11, 11, "ui.arrow.left", entryFor("ui.arrow.left").role]);
    expect(isVerifiedRaster(h)).toBe(true);
    expect(blobs).toHaveLength(1);
    expect(new Uint8Array(await (blobs[0] as Blob).arrayBuffer())).toEqual(original);
  });

  it("R2-1: every field is read once, synchronously; a getter that turns evil later is ignored", async () => {
    const good = itemFor("ui.arrow.left");
    const evil = pngBytes("ui.arrow.right");
    const reads: Record<string, number> = {};
    const tricky = {} as MintItem;
    for (const k of ["assetId", "bytes", "sha256", "width", "height", "entry"] as const) {
      Object.defineProperty(tricky, k, {
        enumerable: true,
        get: () => {
          reads[k] = (reads[k] ?? 0) + 1;
          if (reads[k] > 1) return { assetId: "ui.arrow.right", bytes: evil, sha256: sha(evil), width: 99, height: 99, entry: entryFor("ui.arrow.right") }[k];
          return good[k];
        },
      });
    }
    const set = await mintRasterSet([tricky]);
    expect(reads).toEqual({ assetId: 1, bytes: 1, sha256: 1, width: 1, height: 1, entry: 1 });
    expect(set.ids()).toEqual(["ui.arrow.left"]);
    expect(new Uint8Array(await (blobs[0] as Blob).arrayBuffer())).toEqual(good.bytes);
  });

  it("R2-2: a frozen / non-extensible issuance error survives cleanup errors via a wrapper", async () => {
    const ids = ["ui.arrow.left", "ui.arrow.right", "ui.arrow.up"];
    for (const make of [() => Object.freeze(new Error("original issuance")), () => Object.preventExtensions(new Error("original issuance"))]) {
      const original = make();
      urlCount = 0;
      urlLog = [];
      failCreateAt = 2;
      createThrow = () => original;
      failRevoke = (u) => u === "blob:synthetic/1";
      const err = await mintRasterSet(ids.map(itemFor)).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(RasterIssuanceError);
      expect((err as RasterIssuanceError).cause).toBe(original);
      expect((err as RasterIssuanceError).message).toMatch(/original issuance/u);
      expect((err as RasterIssuanceError).cleanupErrors.map((e) => (e as Error).message)).toEqual(["revoke failed for blob:synthetic/1"]);
      expect(urlLog).toEqual(["revoke blob:synthetic/1"]);
    }
  });

  it("R2-2: a thrown primitive is kept as the cause; without cleanup errors the original is rethrown as-is", async () => {
    const ids = ["ui.arrow.left", "ui.arrow.right", "ui.arrow.up", "ui.arrow.down"];
    failCreateAt = 4;
    createThrow = () => "primitive issuance";
    failRevoke = (u) => u === "blob:synthetic/1" || u === "blob:synthetic/2";
    const err = await mintRasterSet(ids.map(itemFor)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RasterIssuanceError);
    expect((err as RasterIssuanceError).cause).toBe("primitive issuance");
    // the first revoke error does not stop cleanup: all three URLs are revoked, both errors kept
    expect(urlLog).toEqual(["revoke blob:synthetic/1", "revoke blob:synthetic/2", "revoke blob:synthetic/3"]);
    expect((err as RasterIssuanceError).cleanupErrors).toHaveLength(2);
    urlCount = 0;
    urlLog = [];
    failCreateAt = 2;
    failRevoke = () => false;
    const frozen = Object.freeze(new Error("frozen, clean rollback"));
    createThrow = () => frozen;
    expect(await mintRasterSet(ids.map(itemFor)).catch((e: unknown) => e)).toBe(frozen);
    createThrow = () => 42;
    urlCount = 0;
    expect(await mintRasterSet(ids.map(itemFor)).catch((e: unknown) => e)).toBe(42);
  });

  it("B2-3: a disposed handle is rejected by every primitive with its canonical path", async () => {
    const ids = ["ui.window.title.left", "ui.window.title.mid", "ui.window.title.right", "ui.gauge.empty.left", "ui.gauge.empty.mid", "ui.gauge.empty.right", "ui.gauge.hp.left", "ui.gauge.hp.mid", "ui.gauge.hp.right", "ui.slot.selection", "ui.control.close.normal"];
    const { set } = await rasterSet(ids);
    const g = (i: string) => set.get(i);
    const [tl, tm, tr, el, em, er, hl, hm, hr, slot, close] = ids.map<VerifiedRaster>(g);
    set.dispose();
    const path = (id: string) => whitelist.get(id).canonical_cp949_path;
    expect(missingOf(() => planRaster(close as VerifiedRaster))).toEqual([expect.objectContaining({ assetId: "ui.control.close.normal", canonicalPath: path("ui.control.close.normal") })]);
    expect(missingOf(() => planThreeSlice(tl as VerifiedRaster, tm as VerifiedRaster, tr as VerifiedRaster, 100))[0]).toMatchObject({ assetId: "ui.window.title.left", canonicalPath: path("ui.window.title.left") });
    expect(missingOf(() => planGauge([el, em, er] as [VerifiedRaster, VerifiedRaster, VerifiedRaster], [hl, hm, hr] as [VerifiedRaster, VerifiedRaster, VerifiedRaster], 0.5, 100))[0]).toMatchObject({ assetId: "ui.gauge.empty.left" });
    expect(missingOf(() => planSlot(slot as VerifiedRaster, null))[0]).toMatchObject({ assetId: "ui.slot.selection", canonicalPath: path("ui.slot.selection") });
    expect(missingOf(() => planButton(set, { off: "ui.control.close.normal" }, "off"))[0]).toMatchObject({ assetId: "ui.control.close.normal", canonicalPath: path("ui.control.close.normal") });
  });

  it("native size × positive integer scale only", async () => {
    const { set } = await rasterSet(["ui.skill.sm_bash.icon"]);
    const r = set.get("ui.skill.sm_bash.icon");
    expect(planRaster(r, 1)).toMatchObject({ width: 24, height: 24 });
    expect(planRaster(r, 3)).toMatchObject({ width: 72, height: 72 });
    for (const bad of [0, -1, 1.5, Number.NaN]) expect(missingOf(() => planRaster(r, bad))).toEqual([expect.objectContaining({ canonicalPath: "scale" })]);
    expect(missingOf(() => planRaster({ ...r }))).toEqual([expect.objectContaining({ canonicalPath: "raster" })]);
  });
});

describe("RoThreeSlice", () => {
  const ids = ["ui.window.title.left", "ui.window.title.mid", "ui.window.title.right"];
  it("caps keep native size; only the declared middle repeats", async () => {
    const { set } = await rasterSet(ids);
    const [l, m, r] = ids.map((i) => set.get(i)) as [VerifiedRaster, VerifiedRaster, VerifiedRaster];
    const p = planThreeSlice(l, m, r, 100, 1);
    expect(p.pieces.map((x) => [x.assetId, x.x, x.width, x.repeatX, x.tileWidth])).toEqual([
      ["ui.window.title.left", 0, l.width, false, l.width],
      ["ui.window.title.mid", l.width, 100 - l.width - r.width, true, m.width],
      ["ui.window.title.right", 100 - r.width, r.width, false, r.width],
    ]);
    expect(planThreeSlice(l, m, r, 200, 2).pieces[0]?.width).toBe(l.width * 2);
  });
  it("needs three distinct declared parts of one group and room for both caps", async () => {
    const { set } = await rasterSet([...ids, "ui.window.body.mid"]);
    const [l, m, r] = ids.map((i) => set.get(i)) as [VerifiedRaster, VerifiedRaster, VerifiedRaster];
    expect(missingOf(() => planThreeSlice(l, l, r, 100))).toEqual([expect.objectContaining({ canonicalPath: "threeSlice" })]);
    expect(missingOf(() => planThreeSlice(m, l, r, 100))).toEqual([expect.objectContaining({ canonicalPath: "threeSlice" })]);
    expect(missingOf(() => planThreeSlice(l, set.get("ui.window.body.mid"), r, 100))).toEqual([expect.objectContaining({ reason: expect.stringContaining("different groups") as unknown })]);
    expect(missingOf(() => planThreeSlice(l, m, r, 5))).toEqual([expect.objectContaining({ canonicalPath: "width" })]);
  });
});

describe("RoButton", () => {
  const declared = { off: "ui.control.close.normal", hover: "ui.control.close.hover" } as const;
  it("each state selects its exact declared logical ID", async () => {
    const { set } = await rasterSet(Object.values(declared));
    expect(planButton(set, declared, "off").assetId).toBe("ui.control.close.normal");
    expect(planButton(set, declared, "hover").assetId).toBe("ui.control.close.hover");
    expect(planButton((await rasterSet(["ui.menu.status.normal", "ui.menu.status.active"])).set, { off: "ui.menu.status.normal", on: "ui.menu.status.active" }, "on").assetId).toBe("ui.menu.status.active");
  });
  it("a missing declared state fails closed with its ID / container / path; undeclared states never fall back", async () => {
    const { set } = await rasterSet(["ui.control.close.normal"]);
    expect(missingOf(() => planButton(set, declared, "off"))).toEqual([expect.objectContaining({ assetId: "ui.control.close.hover", container: "data.grf", canonicalPath: whitelist.get("ui.control.close.hover").canonical_cp949_path })]);
    const full = (await rasterSet(Object.values(declared))).set;
    expect(missingOf(() => planButton(full, declared, "down"))).toEqual([expect.objectContaining({ canonicalPath: "button.down" })]);
    expect(missingOf(() => planButton(full, { off: "ui.control.close.hover" }, "off"))).toEqual([expect.objectContaining({ canonicalPath: "button.off" })]);
    const chrome = (await rasterSet(["ui.button.normal.mid", "ui.button.hover.mid", "ui.button.pressed.mid"])).set;
    const four = { off: "ui.button.normal.mid", hover: "ui.button.hover.mid", down: "ui.button.pressed.mid", disabled: "ui.button.disabled.mid" } as const;
    expect(missingOf(() => planButton(chrome, four, "off"))).toEqual([expect.objectContaining({ assetId: "ui.button.disabled.mid", canonicalPath: whitelist.get("ui.button.disabled.mid").canonical_cp949_path })]);
  });

  it("B2-5: declared states must be one canonical control (and one slice part)", async () => {
    const { set } = await rasterSet(["ui.control.close.normal", "ui.control.minimize.hover", "ui.menu.status.normal", "ui.menu.skill.active", "ui.button.normal.left", "ui.button.hover.mid", "ui.button.hover.left"]);
    expect(missingOf(() => planButton(set, { off: "ui.control.close.normal", hover: "ui.control.minimize.hover" }, "off"))).toEqual([expect.objectContaining({ canonicalPath: "button.family" })]);
    expect(missingOf(() => planButton(set, { off: "ui.menu.status.normal", on: "ui.menu.skill.active" }, "on"))).toEqual([expect.objectContaining({ canonicalPath: "button.family" })]);
    expect(missingOf(() => planButton(set, { off: "ui.button.normal.left", hover: "ui.button.hover.mid" }, "off"))).toEqual([expect.objectContaining({ canonicalPath: "button.family" })]);
    expect(planButton(set, { off: "ui.button.normal.left", hover: "ui.button.hover.left" }, "hover").assetId).toBe("ui.button.hover.left");
  });
});

describe("RoGauge", () => {
  const empty = ["ui.gauge.empty.left", "ui.gauge.empty.mid", "ui.gauge.empty.right"];
  const hp = ["ui.gauge.hp.left", "ui.gauge.hp.mid", "ui.gauge.hp.right"];
  it.each([[-0.5, 0, 0], [0, 0, 0], [0.37, 0.37, 37], [1, 1, 100], [2, 1, 100], [Number.NaN, 0, 0]])("ratio %s clamps to %s (clip %s px); only official gauge parts are visible", async (ratio, clamped, clip) => {
    const { set } = await rasterSet([...empty, ...hp]);
    const g = planGauge(empty.map((i) => set.get(i)) as [VerifiedRaster, VerifiedRaster, VerifiedRaster], hp.map((i) => set.get(i)) as [VerifiedRaster, VerifiedRaster, VerifiedRaster], ratio, 100);
    expect([g.ratio, g.clipWidth]).toEqual([clamped, clip]);
    expect([...g.back, ...g.fill].map((p) => p.assetId).sort()).toEqual([...empty, ...hp].sort());
  });
  it("a non-gauge part is rejected", async () => {
    const { set } = await rasterSet([...empty, ...hp, "ui.window.title.left"]);
    const fill = [set.get("ui.window.title.left"), set.get("ui.gauge.hp.mid"), set.get("ui.gauge.hp.right")] as [VerifiedRaster, VerifiedRaster, VerifiedRaster];
    expect(missingOf(() => planGauge(empty.map((i) => set.get(i)) as [VerifiedRaster, VerifiedRaster, VerifiedRaster], fill, 0.5, 100))).toEqual([expect.objectContaining({ canonicalPath: "gauge" })]);
  });
});

describe("RoSlot", () => {
  it("verified frame + verified icon; text-only count/hotkey adds no raster", async () => {
    const { set } = await rasterSet(["ui.slot.selection", "ui.skill.sm_bash.icon"]);
    const p = planSlot(set.get("ui.slot.selection"), set.get("ui.skill.sm_bash.icon"));
    expect(p.pieces.map((x) => x.assetId)).toEqual(["ui.slot.selection", "ui.skill.sm_bash.icon"]);
    expect(planSlot(set.get("ui.slot.selection"), null).pieces).toHaveLength(1);
    expect(missingOf(() => planSlot(set.get("ui.skill.sm_bash.icon"), null))).toEqual([expect.objectContaining({ canonicalPath: "slot.frame" })]);
    expect(missingOf(() => planSlot(set.get("ui.slot.selection"), set.get("ui.slot.selection")))).toEqual([expect.objectContaining({ canonicalPath: "slot.icon" })]);
    expect(missingOf(() => RoSlot({ rasters: set, frameId: "ui.slot.selection", iconId: "ui.skill.sm_magnum.icon" }))).toEqual([expect.objectContaining({ assetId: "ui.skill.sm_magnum.icon" })]);
  });
  it("components render only verified pieces (structural, synthetic)", async () => {
    const ids = ["ui.window.title.left", "ui.window.title.mid", "ui.window.title.right", "ui.control.close.normal", "ui.gauge.empty.left", "ui.gauge.empty.mid", "ui.gauge.empty.right", "ui.gauge.sp.left", "ui.gauge.sp.mid", "ui.gauge.sp.right", "ui.slot.selection"];
    const { set } = await rasterSet(ids);
    const g = (i: string) => set.get(i);
    for (const vnode of [
      RoRaster({ raster: g("ui.control.close.normal"), scale: 2 }),
      RoThreeSlice({ left: g("ui.window.title.left"), mid: g("ui.window.title.mid"), right: g("ui.window.title.right"), width: 80 }),
      RoButton({ rasters: set, declared: { off: "ui.control.close.normal" }, state: "off", label: "close" }),
      RoGauge({ empty: [g("ui.gauge.empty.left"), g("ui.gauge.empty.mid"), g("ui.gauge.empty.right")], fill: [g("ui.gauge.sp.left"), g("ui.gauge.sp.mid"), g("ui.gauge.sp.right")], ratio: 0.5, width: 60 }),
      RoSlot({ rasters: set, frameId: "ui.slot.selection", hotkey: "F1", count: 3 }),
    ]) expect(vnode).toBeTruthy();
  });
});

describe("formal visual static guard", () => {
  const bad: Record<string, string> = {
    gradient: `const s = { background: "linear-gradient(#000, #fff)" };`,
    "border-radius": `const s = { borderRadius: "4px" };`,
    "box-shadow": `const s = "box-shadow: 0 0 2px #000";`,
    "css-border-surface": `const s = { border: "1px solid #888" };`,
    "pseudo-element-surface": `.x::before { content: ""; }`,
    "css-colour-fill": `const s = { backgroundColor: "#3a3" };`,
    "css-state-synthesis": `const s = { filter: "brightness(1.2)", opacity: 0.5 };`,
    "inline-svg": `const icon = <svg viewBox="0 0 1 1" />;`,
    emoji: `const close = "❌";`,
    "icon-font": `const s = { fontFamily: "Material Icons" };`,
    "canvas-webgl-texture": `const c = document.createElement("canvas").getContext("2d");`,
    "network-or-gateway": `await fetch("/v1/derived/ui.arrow.left.png");`,
    "placeholder-or-synthetic": `import { writeBmp24 } from "@ro-survivor/testkit";`,
    "literal-raster-source": `const s = { backgroundImage: 'url("/raw.png")' };`,
  };
  it.each(FORBIDDEN.map((f) => f.family))("rejects %s", (family) => {
    expect(scanFormalVisual(bad[family] ?? "")).toContain(family);
  });
  it("accepts verified-raster positioning with nearest sampling", () => {
    const helper = 'function verifiedRasterUrl(raster: VerifiedRaster): string {\n  return `url("${checkRaster(raster, "raster").url}")`;\n}\n';
    expect(scanFormalVisual(`${helper}const s = { position: "absolute", backgroundImage: verifiedRasterUrl(r), backgroundRepeat: "repeat-x", imageRendering: "pixelated", overflow: "hidden" };`)).toEqual([]);
    // only that exact helper shape is allowed; the old inline form and helper variations are not
    expect(scanFormalVisual('const s = { backgroundImage: `url("${r.url}")` };')).toContain("literal-raster-source");
    expect(scanFormalVisual(helper.replace('checkRaster(raster, "raster").url', "raster.url"))).toContain("literal-raster-source");
    expect(scanFormalVisual(helper.replace("raster: VerifiedRaster", "raster: unknown"))).toContain("literal-raster-source");
    expect(scanFormalVisual(`${helper}const s = { backgroundImage: pick(r) };`)).toContain("literal-raster-source");
    expect(scanFormalVisual(`${helper}${helper}`)).toContain("duplicate-raster-url-helper");
  });

  it("B2-R3: AST module refs — minified re-export, template import, inline type-only, CSS @IMPORT, opaque loads", () => {
    // 1. minified runtime re-export
    expect(externalRuntimeImports(`export{Icon}from"lucide-preact";`, "m.ts")).toEqual(["lucide-preact"]);
    // 2. template dynamic import
    expect(externalRuntimeImports("void import(`fabric`);", "m.ts")).toEqual(["fabric"]);
    // 3. inline type-only re-export / import are not runtime; mixed ones are
    expect(externalRuntimeImports(`export { type Foo } from "type-only-pkg";\nimport { type Bar } from "type-only-pkg2";\n`, "m.ts")).toEqual([]);
    expect(externalRuntimeImports(`export { type Foo, Baz } from "mixed-pkg";`, "m.ts")).toEqual(["mixed-pkg"]);
    // 7. computed / non-literal dynamic import and import.meta.glob are opaque
    expect(codeRefs("m.ts", `const p = "fab" + "ric";\nvoid import(p);\n`).opaque).toEqual(["non-literal-dynamic-import"]);
    expect(codeRefs("m.ts", "const n = 'x';\nvoid import(`./${n}.ts`);\n").opaque).toEqual(["non-literal-dynamic-import"]);
    expect(codeRefs("m.ts", `const g = import.meta.glob("./*.ts");\nconst h = import.meta["glob"];\n`).opaque).toEqual(["import-meta-glob", "import-meta-glob"]);
    expect(codeRefs("m.ts", `const e = import.meta.env.MODE;`).opaque).toEqual([]);
    const dir = mkdtempSync(join(tmpdir(), "ro-guard3-"));
    try {
      writeFileSync(join(dir, "entry.tsx"), `import "./s.css";\nexport{Icon}from"lucide-preact";\nexport { type Foo } from "type-only-pkg";\nconst p = "x";\nvoid import(p);\nvoid import(\`fabric\`);\n`);
      // 6. mixed-case CSS @IMPORT (remote and package forms)
      writeFileSync(join(dir, "s.css"), `@IMPORT "https://evil.invalid/a.css";\n@Import url(pkg/theme.css);\n.a { position: absolute; }\n`);
      const r = Object.fromEntries(guardGraph(join(dir, "entry.tsx")).map((x) => [relPosix(dir, x.file), x.violations.sort()]));
      expect(r).toEqual({
        "entry.tsx": ["external-import:fabric", "external-import:lucide-preact", "non-literal-dynamic-import"],
        "s.css": ["non-relative-css-import:https://evil.invalid/a.css", "non-relative-css-import:pkg/theme.css"],
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.each([
    ["4. arbitrary url() interpolation", 'const evil = "/raw.png";\nconst s = { backgroundImage: `url("${evil}")` };'],
    ["4. interpolation split across template parts", 'const s = { backgroundImage: `${a}url(${evil})` };'],
    ["4. raster style property from a variable", "const s = { backgroundImage: evil };"],
    ["4. shorthand raster style property", "const backgroundImage = evil;\nconst s = { backgroundImage };"],
    ["4. raster style assignment", "el.style.backgroundImage = evil;"],
    ["4. setProperty raster style", 'el.style.setProperty("background-image", evil);'],
    ["5. h(\"img\", { src })", 'const v = h("img", { src: "/raw.png" });'],
    ["5. createElement image", 'const v = createElement("img", null);'],
    ["5. src property from a variable", "const props = { src: evil };"],
    ["5. src assignment", "img.src = evil;"],
    ["5. setAttribute src", 'el.setAttribute("src", evil);'],
    ["5. JSX img", "const v = <img alt=\"\" />;"],
    ["5. JSX src attribute", "const v = <video src={evil} />;"],
    ["5. new Image", "const i = new Image();"],
  ])("B2-R3: TS/TSX raster source is rejected — %s", (_name, code) => {
    expect(scanFormalVisual(code, "x.tsx")).toContain("literal-raster-source");
  });

  const src = resolve(import.meta.dirname, "../src");
  it("the whole RO primitive dependency graph passes the guard", () => {
    const files = moduleGraph(join(src, "ui/ro/index.ts"));
    expect(files.map((f) => relPosix(src, f))).toEqual(expect.arrayContaining(["ui/ro/index.ts", "ui/ro/primitives.tsx", "ui/ro/raster.ts"]));
    for (const f of files) expect(scanFormalVisual(readFileSync(f, "utf8")), f).toEqual([]);
    expect(guardGraph(join(src, "ui/ro/index.ts"))).toEqual([]);
  });

  it("B2-4: styles and external runtime imports are part of the guard", () => {
    const dir = mkdtempSync(join(tmpdir(), "ro-guard-"));
    try {
      mkdirSync(join(dir, "nested"));
      writeFileSync(join(dir, "a.tsx"), `import "./a.css";\nexport const A = 1;\n`);
      writeFileSync(join(dir, "a.css"), `@import "./nested/b.css";\n.x { background: linear-gradient(#000,#fff); border: 1px solid #888; }\n.x::after { content: ""; }\n`);
      writeFileSync(join(dir, "nested/b.css"), `.y { box-shadow: 0 0 2px #000; border-radius: 4px; }\n`);
      writeFileSync(join(dir, "c.tsx"), `import { X } from "lucide-preact";\nimport { Canvas } from "fabric";\nimport type { Foo } from "type-only-pkg";\nimport { h } from "preact";\nexport const C = [X, Canvas, h];\n`);
      const a = guardGraph(join(dir, "a.tsx"));
      expect(a.map((r) => [relPosix(dir, r.file), r.violations.sort()])).toEqual([
        ["a.css", ["css-border-surface", "css-colour-fill", "gradient", "pseudo-element-surface"]],
        ["nested/b.css", ["border-radius", "box-shadow"]],
      ]);
      const c = guardGraph(join(dir, "c.tsx"));
      expect(c[0]?.violations).toEqual(["external-import:lucide-preact", "external-import:fabric"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("B2-R3: extensionless / index imports, runtime re-exports, remote CSS imports and literal raster sources are caught", () => {
    const dir = mkdtempSync(join(tmpdir(), "ro-guard2-"));
    try {
      mkdirSync(join(dir, "dirmod"));
      writeFileSync(join(dir, "entry.tsx"), `import "./bad";\nimport "./style";\nexport * from "./dirmod";\nexport { Icon } from "lucide-preact";\nexport * from "fabric";\nexport type { T } from "type-only-pkg";\n`);
      writeFileSync(join(dir, "bad.ts"), `export const s = { borderRadius: "4px" };\n`);
      writeFileSync(join(dir, "style.css"), `@import "./more";\n@import url("https://cdn.invalid/evil.css");\n@import "some-package/theme.css";\n.a { background-image: url("/raw.png"); }\n`);
      writeFileSync(join(dir, "more.css"), `.b { box-shadow: 0 0 1px #000; }\n`);
      writeFileSync(join(dir, "dirmod/index.tsx"), `export const I = () => <img src="/raw.png" />;\n`);
      const r = Object.fromEntries(guardGraph(join(dir, "entry.tsx")).map((x) => [relPosix(dir, x.file), x.violations.sort()]));
      expect(r).toEqual({
        "entry.tsx": ["external-import:fabric", "external-import:lucide-preact"],
        "bad.ts": ["border-radius"],
        "style.css": ["literal-raster-source", "non-relative-css-import:https://cdn.invalid/evil.css", "non-relative-css-import:some-package/theme.css"],
        "more.css": ["box-shadow"],
        "dirmod/index.tsx": ["literal-raster-source"],
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the primitive library is unreachable from the shipped formal screen", () => {
    const files = moduleGraph(join(src, "main.tsx")).map((f) => relPosix(src, f));
    expect(files).toContain("App.tsx");
    expect(files.filter((f) => f.startsWith("ui/ro/") || f === "game/formal/ui.ts")).toEqual([]);
    expect(dirname(join(src, "ui/ro/index.ts"))).toBe(join(src, "ui/ro"));
  });
});
