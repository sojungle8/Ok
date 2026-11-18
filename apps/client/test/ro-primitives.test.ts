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
import { formalHudAssetIds, isVerifiedRaster, planButton, planGauge, planMinimap, planRaster, planSlot, planThreeSlice, planThreeSliceButton, planWindow, RO_BUTTON_CHROME_IDS, roSkillIconId, RoButton, RoFormalHud, RoGauge, RoRaster, RoSlot, RoThreeSlice, RoThreeSliceButton, type RoFormalHudModel, type VerifiedRaster } from "../src/ui/ro/index.ts";
import { codeRefs, externalRuntimeImports, FORBIDDEN, guardGraph, isRealBrandModule, isRealMintSource, mintUsage, moduleGraph, REAL_MINT, REAL_RASTER, relPosix, scanFormalVisual } from "./visual-guard.ts";

/**
 * SYNTHETIC structural harness. TEST-ONLY ADAPTER: tests mint handles with the loader-internal
 * `mintRasterSet` (production code may import / call it only from game/formal/ui.ts — see the
 * call-site guard over all of src). The browser URL API is stubbed; entries derive from the canonical
 * whitelist rows; PNG bytes are a PNG signature + the asset ID.
 */
/**
 * The mint captures URL.createObjectURL / revokeObjectURL at module initialisation, so the synthetic URL
 * stubs are installed before any import (vi.hoisted) and delegate to per-test behaviour in `urlStub`.
 * Tests that tamper with URL after import replace the global functions — the mint must ignore that.
 */
const urlStub = vi.hoisted(() => {
  const s = { create: (_b: Blob): string => "", revoke: (_u: string): void => undefined };
  URL.createObjectURL = (b: Blob | MediaSource) => s.create(b as Blob);
  URL.revokeObjectURL = (u: string) => {
    s.revoke(u);
  };
  return s;
});
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
  // index writes, not push: some tests patch Array.prototype.push
  urlStub.create = (b) => {
    urlCount += 1;
    if (urlCount === failCreateAt) throw createThrow(urlCount);
    blobs[blobs.length] = b;
    return `blob:synthetic/${urlCount}`;
  };
  urlStub.revoke = (u) => {
    urlLog[urlLog.length] = `revoke ${u}`;
    if (failRevoke(u)) throw new Error(`revoke failed for ${u}`);
  };
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
/** All 16 ECMAScript assignment operators. */
const ASSIGNMENT_OPERATORS = ["=", "+=", "-=", "*=", "/=", "%=", "**=", "<<=", ">>=", ">>>=", "&=", "|=", "^=", "&&=", "||=", "??="] as const;
/** Canonical-module fixture: the real bindings the raster URL helper must trace back to. */
const CANON_HEAD = 'import { isVerifiedRaster, type VerifiedRaster } from "./raster.ts";\nfunction checkRaster(r: unknown, field: string): VerifiedRaster {\n  if (!isVerifiedRaster(r)) throw new Error(field);\n  return r;\n}\n';
const HELPER = 'function verifiedRasterUrl(raster: VerifiedRaster): string {\n  return `url("${checkRaster(raster, "raster").url}")`;\n}\n';
/** A real brand module (ui/ro/raster.ts) and loader stub for temp-tree graph tests. */
const REAL_RASTER_TS = 'import { isMintedRaster } from "../../game/formal/rasterMint.ts";\nexport interface VerifiedRaster {\n  readonly url: string;\n}\nexport function isVerifiedRaster(x: unknown): x is VerifiedRaster {\n  return isMintedRaster(x);\n}\n';
const MINT_STUB_TS = "export function isMintedRaster(x: unknown): boolean {\n  return x === null;\n}\n";

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

  it("R4-1: the handle prototype is frozen — url / disposed / dispose cannot be redefined", async () => {
    const set = await mintRasterSet([itemFor("ui.arrow.left")]);
    const h = set.get("ui.arrow.left");
    const proto = Object.getPrototypeOf(h) as object;
    expect(Object.isFrozen(proto)).toBe(true);
    // the exact attack from the review
    expect(() =>
      Object.defineProperty(proto, "url", {
        configurable: true,
        get: () => "https://evil.invalid/raw.png",
      }),
    ).toThrow(TypeError);
    expect(() => Object.defineProperty(proto, "disposed", { get: () => false })).toThrow(TypeError);
    expect(() => Object.defineProperty(proto, "dispose", { value: () => undefined })).toThrow(TypeError);
    expect(() => {
      (proto as { dispose: unknown }).dispose = () => undefined;
    }).toThrow(TypeError);
    // own properties and the prototype link of the frozen instance cannot be changed either
    expect(() => Object.defineProperty(h, "url", { value: "https://evil.invalid/raw.png" })).toThrow(TypeError);
    expect(() => {
      Object.setPrototypeOf(h, { url: "https://evil.invalid/raw.png" });
    }).toThrow(TypeError);
    expect(isVerifiedRaster(h)).toBe(true);
    expect(h.url).toBe("blob:synthetic/1");
    expect(h.disposed).toBe(false);
    set.dispose();
    expect(urlLog).toEqual(["revoke blob:synthetic/1"]);
    expect(h.disposed).toBe(true);
  });

  it("R4-1b: the brand set uses closures sealed at import — patching WeakSet.prototype later forges nothing", async () => {
    const fake = { assetId: "ui.arrow.left", url: "https://evil.invalid/raw.png", disposed: false };
    const hasDesc = Object.getOwnPropertyDescriptor(WeakSet.prototype, "has") as PropertyDescriptor;
    const addDesc = Object.getOwnPropertyDescriptor(WeakSet.prototype, "add") as PropertyDescriptor;
    const origAdd = addDesc.value as (this: WeakSet<object>, v: object) => WeakSet<object>;
    // has() patched to always answer true: any fake still fails the brand check
    WeakSet.prototype.has = () => true;
    try {
      expect(isVerifiedRaster(fake)).toBe(false);
      expect(isVerifiedRaster({})).toBe(false);
    } finally {
      Object.defineProperty(WeakSet.prototype, "has", hasDesc);
    }
    // add() patched to smuggle the fake into whatever set it is called on, then a real mint
    WeakSet.prototype.add = function (this: WeakSet<object>, v: object) {
      origAdd.call(this, fake);
      return origAdd.call(this, v);
    };
    let set: Awaited<ReturnType<typeof mintRasterSet>>;
    try {
      set = await mintRasterSet([itemFor("ui.arrow.left")]);
    } finally {
      Object.defineProperty(WeakSet.prototype, "add", addDesc);
    }
    const h = set.get("ui.arrow.left");
    expect(isVerifiedRaster(fake)).toBe(false);
    expect(isVerifiedRaster(h)).toBe(true);
    // the class / constructor is frozen and constructing a handle directly yields an unbranded object
    const Ctor = h.constructor as new (...args: unknown[]) => object;
    expect(Object.isFrozen(Ctor)).toBe(true);
    expect(Object.isFrozen(Ctor.prototype)).toBe(true);
    const evil = new Ctor("ui.arrow.left", 11, 11, h.entry, "https://evil.invalid/raw.png");
    expect(isVerifiedRaster(evil)).toBe(false);
    expect(() => {
      (Ctor as unknown as { prototype: unknown }).prototype = {};
    }).toThrow(TypeError);
  });

  it("R4-1c: a patched Map.prototype.values during a mint cannot brand a fake or skip the real handle", async () => {
    const fake = { assetId: "ui.arrow.left", url: "https://evil.invalid/raw.png", disposed: false };
    const desc = Object.getOwnPropertyDescriptor(Map.prototype, "values") as PropertyDescriptor;
    Map.prototype.values = function () {
      return [fake][Symbol.iterator]();
    };
    let set: Awaited<ReturnType<typeof mintRasterSet>>;
    try {
      set = await mintRasterSet([itemFor("ui.arrow.left")]);
    } finally {
      Object.defineProperty(Map.prototype, "values", desc);
    }
    expect(isVerifiedRaster(fake)).toBe(false);
    const h = set.get("ui.arrow.left");
    expect(isVerifiedRaster(h)).toBe(true);
    expect(h.url).toBe("blob:synthetic/1");
    // the same for a patched array iterator (validation / issuance loops are indexed)
    const iterDesc = Object.getOwnPropertyDescriptor(Array.prototype, Symbol.iterator) as PropertyDescriptor;
    const origIter = iterDesc.value as (this: unknown[]) => Iterator<unknown>;
    Array.prototype[Symbol.iterator] = function (this: unknown[]) {
      // only the mint's own frozen snapshot array is swapped (the caller's items still iterate normally)
      const target = Object.isFrozen(this) && this.length === 1 && typeof this[0] === "object" && this[0] !== null && Object.isFrozen(this[0]) && "sha256" in this[0];
      return origIter.call(target ? [fake] : this);
    } as typeof Array.prototype[typeof Symbol.iterator];
    let set2: Awaited<ReturnType<typeof mintRasterSet>>;
    try {
      set2 = await mintRasterSet([itemFor("ui.arrow.right")]);
    } finally {
      Object.defineProperty(Array.prototype, Symbol.iterator, iterDesc);
    }
    expect(isVerifiedRaster(fake)).toBe(false);
    expect(isVerifiedRaster(set2.get("ui.arrow.right"))).toBe(true);
  });

  it("R4-1e: patched Map / Set operations cannot make the registry return, hide or skip handles", async () => {
    const evil = (assetId: string) => ({ assetId, url: "https://evil.invalid/raw.png", disposed: false });
    const patch = <K extends keyof Map<unknown, unknown>>(name: K, impl: (this: Map<unknown, unknown>, ...a: never[]) => unknown) => {
      const d = Object.getOwnPropertyDescriptor(Map.prototype, name) as PropertyDescriptor;
      Object.defineProperty(Map.prototype, name, { ...d, value: impl });
      return () => Object.defineProperty(Map.prototype, name, d);
    };
    // 1. Map.prototype.set swaps the stored value for an unbranded fake during the mint
    const origSet = (Object.getOwnPropertyDescriptor(Map.prototype, "set") as PropertyDescriptor).value as (this: Map<unknown, unknown>, k: unknown, v: unknown) => Map<unknown, unknown>;
    let undo = patch("set", function (this: Map<unknown, unknown>, ...a: never[]) {
      const [k] = a as unknown as [string, unknown];
      return origSet.call(this, k, typeof k === "string" && k.startsWith("ui.") ? evil(k) : (a as unknown as [unknown, unknown])[1]);
    });
    let set: Awaited<ReturnType<typeof mintRasterSet>>;
    try {
      set = await mintRasterSet([itemFor("ui.arrow.left"), itemFor("ui.arrow.right")]);
    } finally {
      undo();
    }
    const h = set.get("ui.arrow.left");
    expect(isVerifiedRaster(h)).toBe(true);
    expect(h.assetId).toBe("ui.arrow.left");
    expect(h.url).toBe("blob:synthetic/1");
    // 2. Map.prototype.get / keys / values patched while the registry is used
    undo = patch("get", () => evil("ui.arrow.left"));
    const undoKeys = patch("keys", () => ["ui.forged"][Symbol.iterator]());
    const undoValues = patch("values", () => [][Symbol.iterator]());
    try {
      const g = set.get("ui.arrow.left");
      expect(isVerifiedRaster(g)).toBe(true);
      expect(g.url).toBe("blob:synthetic/1");
      expect(set.has("ui.arrow.right")).toBe(true);
      expect(set.ids()).toEqual(["ui.arrow.left", "ui.arrow.right"]);
      // dispose still revokes every URL (no Map / array iterator decides which)
      set.dispose();
    } finally {
      undo();
      undoKeys();
      undoValues();
    }
    expect(urlLog).toEqual(["revoke blob:synthetic/1", "revoke blob:synthetic/2"]);
    // 3. Set.prototype.has patched to accept anything: a non-canonical ID is still refused
    const hasDesc = Object.getOwnPropertyDescriptor(Set.prototype, "has") as PropertyDescriptor;
    Object.defineProperty(Set.prototype, "has", { ...hasDesc, value: () => true });
    try {
      await expect(mintRasterSet([{ ...itemFor("ui.arrow.left"), assetId: "ui.forged.icon", entry: { ...entryFor("ui.arrow.left"), logical_asset_id: "ui.forged.icon" } }])).rejects.toThrow(/not in the canonical UI registry/u);
    } finally {
      Object.defineProperty(Set.prototype, "has", hasDesc);
    }
    // 4. rollback revokes every created URL even with a patched array iterator
    const iterDesc = Object.getOwnPropertyDescriptor(Array.prototype, Symbol.iterator) as PropertyDescriptor;
    urlCount = 0;
    urlLog = [];
    failCreateAt = 3;
    const origIter = iterDesc.value as (this: unknown[]) => Iterator<unknown>;
    const empty: unknown[] = [];
    const three = ["ui.arrow.left", "ui.arrow.right", "ui.arrow.up"].map(itemFor); // built before the patch
    // every array now iterates as empty
    Object.defineProperty(Array.prototype, Symbol.iterator, { ...iterDesc, value: () => origIter.call(empty) });
    let err: unknown;
    try {
      err = await mintRasterSet(three).catch((e: unknown) => e);
    } finally {
      Object.defineProperty(Array.prototype, Symbol.iterator, iterDesc);
    }
    expect((err as Error).message).toMatch(/createObjectURL failed at 3/u);
    expect(urlLog).toEqual(["revoke blob:synthetic/1", "revoke blob:synthetic/2"]);
    // 5. a patched Array.prototype.push that drops or injects elements during a mint changes nothing
    const pushDesc = Object.getOwnPropertyDescriptor(Array.prototype, "push") as PropertyDescriptor;
    const origPush = pushDesc.value as (this: unknown[], ...v: unknown[]) => number;
    const one = [itemFor("ui.arrow.left")];
    for (const impl of [function (this: unknown[]) {
      return this.length;
    }, function (this: unknown[]) {
      return origPush.call(this, { ...itemFor("ui.arrow.up"), entry: entryFor("ui.arrow.up") });
    }]) {
      urlCount = 0;
      failCreateAt = 0;
      Object.defineProperty(Array.prototype, "push", { ...pushDesc, value: impl });
      let s: Awaited<ReturnType<typeof mintRasterSet>>;
      try {
        s = await mintRasterSet(one);
      } finally {
        Object.defineProperty(Array.prototype, "push", pushDesc);
      }
      expect(s.ids()).toEqual(["ui.arrow.left"]);
      expect(isVerifiedRaster(s.get("ui.arrow.left"))).toBe(true);
    }
  });

  it("R4-1f: ids() and cleanup errors do not depend on Array.prototype push / sort / iterator", async () => {
    const set = await mintRasterSet(["ui.arrow.right", "ui.arrow.left", "ui.arrow.up"].map(itemFor));
    const pushDesc = Object.getOwnPropertyDescriptor(Array.prototype, "push") as PropertyDescriptor;
    const sortDesc = Object.getOwnPropertyDescriptor(Array.prototype, "sort") as PropertyDescriptor;
    const descs = [["push", pushDesc], ["sort", sortDesc]] as const;
    const iterDesc = Object.getOwnPropertyDescriptor(Array.prototype, Symbol.iterator) as PropertyDescriptor;
    const origIter = iterDesc.value as (this: unknown[]) => Iterator<unknown>;
    const forged: unknown[] = ["ui.forged"];
    const patchAll = () => {
      Object.defineProperty(Array.prototype, "push", { ...pushDesc, value: () => 0 });
      Object.defineProperty(Array.prototype, "sort", { ...sortDesc, value: function (this: unknown[]) {
        return forged;
      } });
      Object.defineProperty(Array.prototype, Symbol.iterator, { ...iterDesc, value: () => origIter.call(forged) });
    };
    const restore = () => {
      // the iterator first: the loop below iterates an array
      Object.defineProperty(Array.prototype, Symbol.iterator, iterDesc);
      for (const [k, d] of descs) Object.defineProperty(Array.prototype, k, d);
    };
    let ids: string[];
    patchAll();
    try {
      ids = set.ids();
    } finally {
      restore();
    }
    expect(ids).toEqual(["ui.arrow.left", "ui.arrow.right", "ui.arrow.up"]);
    // dispose with revoke errors while push is a no-op: no cleanup error is lost
    failRevoke = (u) => u === "blob:synthetic/1" || u === "blob:synthetic/3";
    let disposeErr: unknown;
    patchAll();
    try {
      set.dispose();
    } catch (e) {
      disposeErr = e;
    } finally {
      restore();
    }
    expect(disposeErr).toBeInstanceOf(AggregateError);
    expect((disposeErr as AggregateError).errors.map((e: Error) => e.message)).toEqual(["revoke failed for blob:synthetic/1", "revoke failed for blob:synthetic/3"]);
    expect(urlLog).toEqual(["revoke blob:synthetic/1", "revoke blob:synthetic/2", "revoke blob:synthetic/3"]);
    // rollback with revoke errors while push is a no-op: every cleanup error reaches the caller
    urlCount = 0;
    urlLog = [];
    failCreateAt = 4;
    failRevoke = (u) => u === "blob:synthetic/1" || u === "blob:synthetic/2";
    const four = ["ui.arrow.left", "ui.arrow.right", "ui.arrow.up", "ui.arrow.down"].map(itemFor);
    let mintErr: unknown;
    Object.defineProperty(Array.prototype, "push", { ...pushDesc, value: () => 0 });
    try {
      mintErr = await mintRasterSet(four).catch((e: unknown) => e);
    } finally {
      restore();
    }
    expect((mintErr as Error).message).toMatch(/createObjectURL failed at 4/u);
    expect((mintErr as { cleanupErrors: Error[] }).cleanupErrors.map((e) => e.message)).toEqual(["revoke failed for blob:synthetic/1", "revoke failed for blob:synthetic/2"]);
    expect(urlLog).toEqual(["revoke blob:synthetic/1", "revoke blob:synthetic/2", "revoke blob:synthetic/3"]);
  });

  it("R4-1g: post-import tampering with URL, SubtleCrypto.digest or structuredClone changes nothing", async () => {
    // 1. URL.createObjectURL replaced after import: the captured function is used, not the evil one
    const createDesc = Object.getOwnPropertyDescriptor(URL, "createObjectURL") as PropertyDescriptor;
    const revokeDesc = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL") as PropertyDescriptor;
    URL.createObjectURL = () => "https://evil.invalid/raw.png";
    URL.revokeObjectURL = () => undefined;
    let url: string | undefined;
    let branded: boolean | undefined;
    try {
      const set = await mintRasterSet([itemFor("ui.arrow.left")]);
      const h = set.get("ui.arrow.left");
      url = h.url;
      branded = isVerifiedRaster(h);
      set.dispose();
    } finally {
      Object.defineProperty(URL, "createObjectURL", createDesc);
      Object.defineProperty(URL, "revokeObjectURL", revokeDesc);
    }
    expect(url).toBe("blob:synthetic/1");
    expect(branded).toBe(true);
    // revoke went through the captured function as well
    expect(urlLog).toEqual(["revoke blob:synthetic/1"]);
    // 2. SubtleCrypto.prototype.digest returns an all-zero hash: a forged zero SHA is still rejected
    const digestDesc = Object.getOwnPropertyDescriptor(SubtleCrypto.prototype, "digest") as PropertyDescriptor;
    Object.defineProperty(SubtleCrypto.prototype, "digest", { ...digestDesc, value: () => Promise.resolve(new ArrayBuffer(32)) });
    try {
      await expect(mintRasterSet([{ ...itemFor("ui.arrow.left"), sha256: "0".repeat(64) }])).rejects.toThrow(/PNG SHA-256 .* != declared/u);
      const ok = await mintRasterSet([itemFor("ui.arrow.right")]);
      expect(isVerifiedRaster(ok.get("ui.arrow.right"))).toBe(true);
    } finally {
      Object.defineProperty(SubtleCrypto.prototype, "digest", digestDesc);
    }
    // 3. structuredClone = (x) => x: the handle still holds an independent frozen copy
    const cloneDesc = Object.getOwnPropertyDescriptor(globalThis, "structuredClone") as PropertyDescriptor;
    Object.defineProperty(globalThis, "structuredClone", { ...cloneDesc, value: <T>(x: T): T => x });
    const item = itemFor("ui.button.hover.left");
    let s2: Awaited<ReturnType<typeof mintRasterSet>>;
    try {
      s2 = await mintRasterSet([item]);
    } finally {
      Object.defineProperty(globalThis, "structuredClone", cloneDesc);
    }
    const h = s2.get("ui.button.hover.left");
    expect(h.entry).not.toBe(item.entry);
    expect(Object.isFrozen(item.entry)).toBe(false);
    expect(Object.isFrozen(h.entry)).toBe(true);
  });

  it("R4-1h: a poisoned array iterator cannot swap the Blob bytes or drop AggregateError cleanup errors", async () => {
    const iterDesc = Object.getOwnPropertyDescriptor(Array.prototype, Symbol.iterator) as PropertyDescriptor;
    const origIter = iterDesc.value as (this: unknown[]) => Iterator<unknown>;
    const forged = new TextEncoder().encode("FORGED-BLOB");
    const item = itemFor("ui.arrow.left");
    const expected = Uint8Array.from(item.bytes);
    // Blob parts that are a one-element array of a Uint8Array iterate as "FORGED-BLOB" instead
    Object.defineProperty(Array.prototype, Symbol.iterator, {
      ...iterDesc,
      value: function (this: unknown[]) {
        return origIter.call(this.length === 1 && this[0] instanceof Uint8Array ? [forged] : this);
      },
    });
    let set: Awaited<ReturnType<typeof mintRasterSet>>;
    try {
      set = await mintRasterSet([item]);
    } finally {
      Object.defineProperty(Array.prototype, Symbol.iterator, iterDesc);
    }
    expect(isVerifiedRaster(set.get("ui.arrow.left"))).toBe(true);
    expect(new Uint8Array(await (blobs[0] as Blob).arrayBuffer())).toEqual(expected);
    // an iterator that throws while dispose builds its AggregateError: every cleanup error is kept
    failRevoke = () => true;
    let err: unknown;
    Object.defineProperty(Array.prototype, Symbol.iterator, {
      ...iterDesc,
      value: () => {
        throw new Error("poisoned iterator");
      },
    });
    try {
      set.dispose();
    } catch (e) {
      err = e;
    } finally {
      Object.defineProperty(Array.prototype, Symbol.iterator, iterDesc);
    }
    expect(err).toBeInstanceOf(AggregateError);
    expect((err as AggregateError).errors.map((e: Error) => e.message)).toEqual(["revoke failed for blob:synthetic/1"]);
  });

  it("R4-1i: a poisoned %TypedArray%.prototype.length cannot skip the PNG signature check", async () => {
    const typedArrayProto = Object.getPrototypeOf(Uint8Array.prototype) as object;
    const lengthDesc = Object.getOwnPropertyDescriptor(typedArrayProto, "length") as PropertyDescriptor;
    const notPng = Uint8Array.from([1, 2, 3]);
    const forged = { ...itemFor("ui.arrow.left"), bytes: notPng, sha256: sha(notPng) };
    Object.defineProperty(typedArrayProto, "length", { ...lengthDesc, get: () => 0 });
    let err: unknown;
    try {
      err = await mintRasterSet([forged]).catch((e: unknown) => e);
    } finally {
      Object.defineProperty(typedArrayProto, "length", lengthDesc);
    }
    expect((err as Error).message).toMatch(/bytes are not a PNG/u);
    expect(urlCount).toBe(0); // no URL was created
    expect(blobs).toHaveLength(0);
  });

  it("R4-1j: Uint8Array post-import tampering changes nothing; the genuine-Uint8Array contract holds", async () => {
    // Symbol.hasInstance patched to deny everything: a genuine Uint8Array still mints
    Object.defineProperty(Uint8Array, Symbol.hasInstance, { configurable: true, value: () => false });
    try {
      const set = await mintRasterSet([itemFor("ui.arrow.left")]);
      expect(isVerifiedRaster(set.get("ui.arrow.left"))).toBe(true);
    } finally {
      delete (Uint8Array as unknown as Record<symbol, unknown>)[Symbol.hasInstance];
    }
    // …and patched to accept everything: a spoof is still refused
    const spoofBytes = { length: 8, 0: 0x89, 1: 0x50, 2: 0x4e, 3: 0x47, 4: 0x0d, 5: 0x0a, 6: 0x1a, 7: 0x0a };
    Object.defineProperty(Uint8Array, Symbol.hasInstance, { configurable: true, value: () => true });
    try {
      await expect(mintRasterSet([{ ...itemFor("ui.arrow.left"), bytes: spoofBytes as unknown as Uint8Array }])).rejects.toThrow(/bytes are not a Uint8Array/u);
    } finally {
      delete (Uint8Array as unknown as Record<symbol, unknown>)[Symbol.hasInstance];
    }
    // ordinary accepted case: a Uint8Array whose direct prototype is the captured local Uint8Array.prototype
    const png = pngBytes("ui.arrow.left");
    const exact = await mintRasterSet([{ ...itemFor("ui.arrow.left"), bytes: Uint8Array.from(png) }]);
    expect(isVerifiedRaster(exact.get("ui.arrow.left"))).toBe(true);
    class Sub extends Uint8Array {}
    const sub = new Sub(png.length);
    sub.set(png);
    const reProto = new Int8Array(png.buffer.slice(0));
    Object.setPrototypeOf(reProto, Uint8Array.prototype);
    const { runInNewContext } = await import("node:vm");
    const foreign = runInNewContext(`new Uint8Array([${[...png].join(",")}])`) as Uint8Array;
    // a genuine Uint8Array whose direct prototype is a proxy claiming Uint8Array.prototype: refused, and the
    // proxy's getPrototypeOf trap is never invoked (no prototype-chain walk)
    let trapCalls = 0;
    const protoProxy = new Proxy(Object.create(Uint8Array.prototype) as object, {
      getPrototypeOf: () => {
        trapCalls += 1;
        return Uint8Array.prototype;
      },
    });
    const proxied = Uint8Array.from(png);
    Object.setPrototypeOf(proxied, protoProxy);
    for (const [name, bytes] of [
      ["subclass", sub],
      ["Node Buffer (subclass)", Buffer.from(png)],
      ["proxy", new Proxy(png, {})],
      ["array-like", spoofBytes],
      ["Int8Array", new Int8Array(png.buffer.slice(0))],
      ["Int8Array re-prototyped to Uint8Array", reProto],
      ["DataView", new DataView(png.buffer.slice(0))],
      ["other realm", foreign],
      ["Uint8Array with a proxied direct prototype", proxied],
    ] as const) {
      await expect(mintRasterSet([{ ...itemFor("ui.arrow.left"), bytes: bytes as unknown as Uint8Array }]), name).rejects.toThrow(/bytes are not a Uint8Array/u);
    }
    expect(trapCalls).toBe(0);
    // documented caveat (no observable construction provenance): a genuine Uint8Array from another realm or
    // a subclass, re-prototyped to the captured local prototype, is indistinguishable and accepted; the mint
    // copies its bytes internally, so the issued bytes are still exactly the verified ones
    for (const [name, v] of [["re-prototyped other realm", runInNewContext(`new Uint8Array([${[...png].join(",")}])`) as Uint8Array], ["re-prototyped subclass", sub]] as const) {
      Object.setPrototypeOf(v, Uint8Array.prototype);
      urlCount = 0;
      blobs = [];
      const s = await mintRasterSet([{ ...itemFor("ui.arrow.left"), bytes: v }]);
      expect(isVerifiedRaster(s.get("ui.arrow.left")), name).toBe(true);
      expect(new Uint8Array(await (blobs[0] as Blob).arrayBuffer()), name).toEqual(png);
    }
  });

  it("R4-1d: a patched Object.freeze during a mint still yields frozen, verified, non-redefinable handles", async () => {
    const desc = Object.getOwnPropertyDescriptor(Object, "freeze") as PropertyDescriptor;
    Object.freeze = <T>(v: T): Readonly<T> => v; // identity "freeze"
    let set: Awaited<ReturnType<typeof mintRasterSet>>;
    try {
      set = await mintRasterSet([itemFor("ui.button.hover.left")]);
    } finally {
      Object.defineProperty(Object, "freeze", desc);
    }
    const h = set.get("ui.button.hover.left");
    expect(isVerifiedRaster(h)).toBe(true);
    expect(Object.isFrozen(h)).toBe(true);
    expect(Object.isFrozen(h.entry)).toBe(true);
    expect(Object.isFrozen(h.entry.slice)).toBe(true);
    expect(Object.isFrozen(set)).toBe(true);
    expect(() => Object.defineProperty(h, "url", { value: "https://evil.invalid/raw.png" })).toThrow(TypeError);
    expect(() => {
      (h.entry as { role: string }).role = "icon";
    }).toThrow(TypeError);
    expect(h.url).toBe("blob:synthetic/1");
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

describe("RoWindow", () => {
  const ids = [
    "ui.window.title.left", "ui.window.title.mid", "ui.window.title.right",
    "ui.window.body.left", "ui.window.body.mid", "ui.window.body.right",
    "ui.window.footer.left", "ui.window.footer.mid", "ui.window.footer.right",
  ];
  it("tiles all nine original RO frame parts without stretching source pixels", async () => {
    const { set } = await rasterSet(ids);
    const p = planWindow(set, 360, 240);
    expect(p.pieces.map((x) => x.assetId)).toEqual(ids);
    expect([p.width, p.height, p.titleHeight, p.footerHeight]).toEqual([360, 240, 17, 21]);
    const body = p.pieces.slice(3, 6);
    expect(body.map((x) => [x.assetId, x.x, x.y, x.width, x.height, x.repeatX, x.repeatY, x.tileWidth, x.tileHeight])).toEqual([
      ["ui.window.body.left", 0, 17, 20, 202, false, true, 20, 8],
      ["ui.window.body.mid", 20, 17, 320, 202, true, true, 32, 32],
      ["ui.window.body.right", 340, 17, 20, 202, false, true, 20, 8],
    ]);
    expect(p.pieces.slice(6).every((x) => x.y === 219 && x.repeatY === false)).toBe(true);
    expect(p.interior).toEqual({ x: 20, y: 17, width: 320, height: 202 });
  });
  it("fails closed for missing frame parts and impossible integer dimensions", async () => {
    const { set } = await rasterSet(ids.slice(0, -1));
    expect(missingOf(() => planWindow(set, 360, 240))).toEqual([expect.objectContaining({ assetId: "ui.window.footer.right", canonicalPath: whitelist.get("ui.window.footer.right").canonical_cp949_path })]);
    const full = (await rasterSet(ids)).set;
    expect(missingOf(() => planWindow(full, 360.5, 240))).toEqual([expect.objectContaining({ canonicalPath: "window.size" })]);
    expect(missingOf(() => planWindow(full, 40, 240))).toEqual([expect.objectContaining({ canonicalPath: "width" })]);
    expect(missingOf(() => planWindow(full, 360, 38))).toEqual([expect.objectContaining({ canonicalPath: "window.height" })]);
  });
});

describe("RoThreeSliceButton", () => {
  const allIds = Object.values(RO_BUTTON_CHROME_IDS).flat();
  it("uses the exact original three-piece family for every interaction state", async () => {
    const { set } = await rasterSet(allIds);
    for (const state of ["off", "hover", "down", "disabled"] as const) {
      const p = planThreeSliceButton(set, state, 180);
      expect(p.state).toBe(state);
      expect(p.pieces.map((x) => x.assetId)).toEqual([...RO_BUTTON_CHROME_IDS[state]]);
      expect(p.pieces.map((x) => x.repeatX)).toEqual([false, true, false]);
      expect(p.height).toBe(20);
    }
    const renderedState = (node: ReturnType<typeof RoThreeSliceButton>): unknown => (node.props as unknown as { "data-ro-state"?: unknown })["data-ro-state"];
    expect(renderedState(RoThreeSliceButton({ rasters: set, width: 180, label: "select", selected: true }))).toBe("hover");
    expect(renderedState(RoThreeSliceButton({ rasters: set, width: 180, label: "select", state: "down" }))).toBe("down");
    expect(renderedState(RoThreeSliceButton({ rasters: set, width: 180, label: "select", state: "down", disabled: true }))).toBe("disabled");
  });
  it("validates every declared state before rendering and never substitutes one state for another", async () => {
    const missingDisabledRight = allIds.filter((id) => id !== "ui.button.disabled.right");
    const { set } = await rasterSet(missingDisabledRight);
    expect(missingOf(() => planThreeSliceButton(set, "off", 180))).toEqual([expect.objectContaining({ assetId: "ui.button.disabled.right", canonicalPath: whitelist.get("ui.button.disabled.right").canonical_cp949_path })]);
    const full = (await rasterSet(allIds)).set;
    expect(missingOf(() => planThreeSliceButton(full, "off", 10))).toEqual([expect.objectContaining({ canonicalPath: "width" })]);
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

describe("formal RO HUD composition", () => {
  const model: RoFormalHudModel = {
    playerName: "Swordsman",
    jobName: "劍士",
    level: 7,
    hp: 7500,
    maxHp: 10000,
    xp: 30,
    xpNext: 100,
    timer: "03:20",
    kills: 42,
    keystone: "guardian",
    minimap: { xPermille: 500, yPermille: 500, facingDeg: 90 },
    skills: [
      { id: "skill.sw.basic_slash", rank: 2, hotkey: "F1" },
      { id: "skill.sw.bash", rank: 1, hotkey: "F2", cooldownTicks: 60 },
      { id: "skill.sw.magnum_break", rank: 3, hotkey: "F3" },
      { id: "skill.sw.endure", rank: 1, hotkey: "F4" },
      { id: "skill.sw.provoke", rank: 1, hotkey: "F5" },
      { id: "skill.sw.shield_wave", rank: 1, hotkey: "F6" },
      { id: "skill.sw.fatal_blow", rank: 1 },
      { id: "skill.sw.auto_berserk", rank: 1 },
      { id: "passive.sw.hp_recovery", rank: 2 },
    ],
    boss: { name: "Mastering", hp: 1000, maxHp: 5000 },
    alert: { text: "MVP · Mastering", testId: "boss-intro" },
  };

  it("maps every vertical-slice skill to an approved original RO icon", () => {
    expect(model.skills.map((s) => roSkillIconId(s.id))).toEqual([
      "ui.skill.sm_sword.icon",
      "ui.skill.sm_bash.icon",
      "ui.skill.sm_magnum.icon",
      "ui.skill.sm_endure.icon",
      "ui.skill.sm_provoke.icon",
      "ui.skill.cr_shieldboomerang.icon",
      "ui.skill.sm_fatalblow.icon",
      "ui.skill.sm_autoberserk.icon",
      "ui.skill.sm_recovery.icon",
    ]);
    expect(roSkillIconId("skill.future.unreviewed")).toBeNull();
  });

  it("plans original BasicInfo controls, menu, minimap, gauge, title, shortcut and icons", async () => {
    const ids = formalHudAssetIds(model);
    expect(ids).toEqual(expect.arrayContaining([
      "ui.hud.basic.background",
      "ui.hud.basic.background.mini",
      "ui.hotbar.background",
      "ui.gauge.hp.left",
      "ui.gauge.sp.left",
      "ui.window.title.left",
      "ui.skill.cr_shieldboomerang.icon",
      "ui.control.base.normal",
      "ui.control.minimize.hover",
      "ui.menu.status.normal",
      "ui.menu.chat.active",
      "ui.minimap.map.prt_fild08",
      "ui.minimap.player_arrow",
      "ui.minimap.control.zoom_in.normal",
      "ui.minimap.control.zoom_out.hover",
    ]));
    expect(ids).not.toContain("ui.slot.selection");
    const { set } = await rasterSet(ids);
    expect(RoFormalHud({ rasters: set, model })).toBeTruthy();
  });

  it("crops the native minimap without fractional scaling and clamps the official arrow", async () => {
    const { set } = await rasterSet(["ui.minimap.map.prt_fild08", "ui.minimap.player_arrow"]);
    const map = set.get("ui.minimap.map.prt_fild08");
    const arrow = set.get("ui.minimap.player_arrow");
    expect([map.width, map.height, arrow.width, arrow.height]).toEqual([512, 512, 12, 12]);
    expect(planMinimap(map, arrow, { xPermille: 500, yPermille: 500, facingDeg: 90 })).toEqual({
      mapLeft: -192, mapTop: -192, arrowLeft: 58, arrowTop: 58, facingDeg: 90, viewport: 128,
    });
    expect(planMinimap(map, arrow, { xPermille: -1, yPermille: -1, facingDeg: Number.NaN })).toEqual({
      mapLeft: 0, mapTop: 0, arrowLeft: 0, arrowTop: 0, facingDeg: 0, viewport: 128,
    });
    expect(planMinimap(map, arrow, { xPermille: 1001, yPermille: 1001, facingDeg: 180 })).toEqual({
      mapLeft: -384, mapTop: -384, arrowLeft: 116, arrowTop: 116, facingDeg: 180, viewport: 128,
    });
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
    const P = "ui/ro/primitives.tsx"; // the canonical primitive module
    const helper = `${CANON_HEAD}${HELPER}`;
    const use = (body: string) => `${helper}export function style(r: VerifiedRaster) {\n  return ${body};\n}\n`;
    expect(scanFormalVisual(use('{ position: "absolute", backgroundImage: verifiedRasterUrl(r), backgroundRepeat: "repeat-x", imageRendering: "pixelated", overflow: "hidden" }'), P)).toEqual([]);
    // only that exact helper shape is allowed; the old inline form and helper variations are not
    expect(scanFormalVisual(`${CANON_HEAD}export function style(r: VerifiedRaster) {\n  return { backgroundImage: \`url("\${r.url}")\` };\n}\n`, P)).toContain("literal-raster-source");
    expect(scanFormalVisual(helper.replace('checkRaster(raster, "raster").url', "raster.url"), P)).toContain("literal-raster-source");
    expect(scanFormalVisual(helper.replace("raster: VerifiedRaster): string", "raster: unknown): string"), P)).toContain("literal-raster-source");
    expect(scanFormalVisual(use("{ backgroundImage: String(r) }"), P)).toContain("literal-raster-source");
    expect(scanFormalVisual(`${helper}${HELPER}`, P)).toContain("duplicate-raster-url-helper");
    // R4-2: the exact helper outside the canonical module is not an allowed source
    expect(scanFormalVisual(use("{ backgroundImage: verifiedRasterUrl(r) }"), "other/Thing.tsx")).toEqual(expect.arrayContaining(["literal-raster-source", "raster-helper-binding"]));
  });

  it("R4-2: a same-name helper spoof, shadow, alias or import fails closed (complete guardGraph)", () => {
    const dir = mkdtempSync(join(tmpdir(), "ro-guard4-"));
    try {
      mkdirSync(join(dir, "ui/ro"), { recursive: true });
      // the exact regression from the review, as a non-canonical module in the graph
      writeFileSync(join(dir, "spoof.ts"), `const verifiedRasterUrl = (x: string): string => x;\nexport const s = { backgroundImage: verifiedRasterUrl("/raw.png") };\n`);
      writeFileSync(join(dir, "entry.ts"), `export * from "./spoof.ts";\nexport * from "./ui/ro/primitives.tsx";\n`);
      // the canonical module with a real helper plus a shadowing parameter and an alias
      const helper = 'function verifiedRasterUrl(raster: VerifiedRaster): string {\n  return `url("${checkRaster(raster, "raster").url}")`;\n}\n';
      writeFileSync(join(dir, "ui/ro/primitives.tsx"), `${helper}export function f(verifiedRasterUrl: (x: string) => string) {\n  return { backgroundImage: verifiedRasterUrl("/raw.png") };\n}\nexport const alias = verifiedRasterUrl;\n`);
      const r = Object.fromEntries(guardGraph(join(dir, "entry.ts")).map((x) => [relPosix(dir, x.file), x.violations]));
      expect(r["spoof.ts"]).toEqual(expect.arrayContaining(["raster-helper-binding", "literal-raster-source"]));
      expect(r["ui/ro/primitives.tsx"]).toEqual(expect.arrayContaining(["raster-helper-binding"]));
      // the same spoof alone in a canonical-named module still fails (no exact declaration there)
      writeFileSync(join(dir, "ui/ro/primitives.tsx"), `const verifiedRasterUrl = (x: string): string => x;\nexport const s = { backgroundImage: verifiedRasterUrl("/raw.png") };\n`);
      expect(guardGraph(join(dir, "ui/ro/primitives.tsx"))[0]?.violations).toEqual(expect.arrayContaining(["raster-helper-binding", "literal-raster-source"]));
      // an import of the name is a binding, too
      expect(scanFormalVisual(`import { verifiedRasterUrl } from "./ui/ro/primitives.tsx";\nexport const s = { backgroundImage: verifiedRasterUrl(r) };\n`, "other.tsx")).toEqual(expect.arrayContaining(["raster-helper-binding", "literal-raster-source"]));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("R4-3: a dynamic element tag and a computed source property fail closed (complete guardGraph)", () => {
    const dir = mkdtempSync(join(tmpdir(), "ro-guard5-"));
    try {
      writeFileSync(join(dir, "dyn.ts"), `import { h } from "preact";\nconst tag = "im" + "g";\nconst key = "s" + "rc";\nexport const v = h(tag, { [key]: "/raw.png" });\n`);
      expect(guardGraph(join(dir, "dyn.ts"))[0]?.violations.sort()).toEqual(["opaque-element-tag", "opaque-property-name"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    expect(scanFormalVisual(`import { h as H } from "preact";\nexport const v = H("div", null);\n`, "x.tsx")).toContain("opaque-element-tag");
    expect(scanFormalVisual(`const Tag = "im" + "g";\nexport const v = <Tag />;\n`, "x.tsx")).toContain("opaque-element-tag");
    expect(scanFormalVisual(`const k = "s" + "rc";\nel[k] = "/raw.png";\n`, "x.ts")).toContain("opaque-property-name");
    expect(scanFormalVisual(`const k = "s" + "rc";\nel.setAttribute(k, "/raw.png");\n`, "x.ts")).toContain("opaque-property-name");
    expect(scanFormalVisual(`export const v = <div {...props} />;\n`, "x.tsx")).toContain("opaque-jsx-spread");
    // the static forms are still the only accepted factory uses
    expect(scanFormalVisual(`import { h } from "preact";\nexport const v = h("div", { class: "a" });\nexport const w = h("span", null);\n`, "x.ts")).toEqual([]);
    // static forms used by the real primitives stay accepted
    expect(scanFormalVisual(`function Pieces() { return <div />; }\nexport const v = <Pieces />;\nconst s = { ["--ro-scale" as string]: "1" };\n`, "x.tsx")).toEqual([]);
  });

  it("R4-3b: an aliased / indirect factory with dynamic props fails closed (complete guardGraph)", () => {
    const dir = mkdtempSync(join(tmpdir(), "ro-guard6-"));
    const head = `import { h } from "preact";\nconst tag = "im" + "g";\nconst key = "s" + "rc";\nconst props = Object.fromEntries([[key, "/raw.png"]]);\n`;
    try {
      // the exact cases from both staged reviews, each as a complete graph
      const cases: Record<string, string> = {
        "alias.ts": `${head}const H = h;\nexport const v = H(tag, props);\n`,
        "comma.ts": `${head}export const v = (0, h)(tag, props);\n`,
        "call.ts": `${head}export const v = h.call(null, tag, props);\n`,
        "ns.ts": `import * as P from "preact";\nconst tag = "im" + "g";\nconst key = "s" + "rc";\nconst props = Object.fromEntries([[key, "/raw.png"]]);\nexport const v = P["h"](tag, props);\n`,
      };
      for (const [f, code] of Object.entries(cases)) writeFileSync(join(dir, f), code);
      for (const f of Object.keys(cases)) {
        const v = guardGraph(join(dir, f))[0]?.violations ?? [];
        expect(v, f).toContain("opaque-element-tag");
        // the dynamic props construction is rejected on its own as well
        expect(v, f).toContain("unknown-global-member:Object.fromEntries");
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    // binding provenance, not callee text: every indirect reference to the imported capability fails
    const opaque = (code: string) => scanFormalVisual(`import { h } from "preact";\n${code}\n`, "x.ts");
    for (const code of [
      "export const f = h;",
      "export { h };",
      "use(h);",
      "export function g() {\n  return h;\n}",
      "export const v = h.call(null, tag, null);",
      "export const v = h.apply(null, [tag, null]);",
      "export const b = h.bind(null);",
      "export const v = (h)(tag, null);",
      'export const v = (0, h)("div", null);',
      "export const v = [h][0](tag, null);",
      "export const o = { h };",
      "export const o = { f: h };",
      "export const v = h(tag, null);",
      'export const v = h("img", null);',
      'export const v = h(`div`.toString(), null);',
    ]) expect(opaque(code), code).toContain("opaque-element-tag");
    // a same-named local that is not the import is not a capability, but namespaces / defaults / members are rejected
    for (const code of ['import * as P from "preact";\nexport const v = P.h("div", null);', 'import P from "preact";\nexport const v = P.h("div", null);', 'import { h as H } from "preact";\nexport const v = H("div", null);', 'import { cloneElement } from "preact";\nexport const v = cloneElement(x);', "export const v = document.createElement(tag);", "const ce = obj.createElement;", 'export { h } from "preact";', 'export * from "preact";']) {
      expect(scanFormalVisual(code, "x.ts"), code).toContain("opaque-element-tag");
    }
    for (const code of ["el.innerHTML = html;", 'el.insertAdjacentHTML("beforeend", html);', "export const o = { dangerouslySetInnerHTML: { __html: html } };"]) expect(opaque(code), code).toContain("opaque-element-tag");
    // dynamic props on a direct, literal-intrinsic call
    for (const code of ['export const v = h("div", props);', 'export const v = h("div", { ...props });', 'export const v = h("div", { [k]: 1 });', 'export const v = h("div", Object.fromEntries([[k, v]]));']) {
      expect(opaque(code), code).toContain("opaque-element-props");
    }
  });

  it("R4-2b: helper provenance — the real checkRaster / VerifiedRaster bindings only (multi-file graphs)", () => {
    const dir = mkdtempSync(join(tmpdir(), "ro-guard7-"));
    const tree = (primitives: string, raster = REAL_RASTER_TS) => {
      rmSync(join(dir, "ui"), { recursive: true, force: true });
      mkdirSync(join(dir, "ui/ro"), { recursive: true });
      mkdirSync(join(dir, "game/formal"), { recursive: true });
      writeFileSync(join(dir, "ui/ro/primitives.tsx"), primitives);
      writeFileSync(join(dir, "ui/ro/raster.ts"), raster);
      writeFileSync(join(dir, "ui/ro/fake.ts"), "export const passthrough = (x: unknown) => x;\nexport interface Fake {\n  readonly url: string;\n}\n");
      writeFileSync(join(dir, "game/formal/rasterMint.ts"), MINT_STUB_TS);
      return Object.fromEntries(guardGraph(join(dir, "ui/ro/primitives.tsx")).map((x) => [relPosix(dir, x.file), x.violations]));
    };
    const usage = 'export function style(r: VerifiedRaster) {\n  return { backgroundImage: verifiedRasterUrl(r) };\n}\n';
    try {
      // provenance is anchored to the production files: a look-alike tree with the right shape, a real-looking
      // brand module and a fake loader (isMintedRaster(x) { return x === null; }) is still rejected
      expect(tree(`${CANON_HEAD}${HELPER}${usage}`)).toEqual({ "ui/ro/primitives.tsx": ["raster-brand-provenance"] });
      expect(isRealBrandModule(join(dir, "ui/ro/raster.ts"))).toBe(false);
      // nested ui/ro path spoof with a fake game/formal/rasterMint.ts reached by the same relative path
      mkdirSync(join(dir, "x/ui/ro"), { recursive: true });
      mkdirSync(join(dir, "x/game/formal"), { recursive: true });
      writeFileSync(join(dir, "x/ui/ro/primitives.tsx"), `${CANON_HEAD}${HELPER}${usage}`);
      writeFileSync(join(dir, "x/ui/ro/raster.ts"), REAL_RASTER_TS);
      writeFileSync(join(dir, "x/game/formal/rasterMint.ts"), "const minted = new WeakSet<object>();\nconst mintedHas = WeakSet.prototype.has.bind(minted);\nexport function isMintedRaster(x: unknown): boolean {\n  return typeof x === \"object\" && x !== null && (mintedHas(x) || true);\n}\n");
      expect(guardGraph(join(dir, "x/ui/ro/primitives.tsx")).find((r) => relPosix(dir, r.file) === "x/ui/ro/primitives.tsx")?.violations).toContain("raster-brand-provenance");
      // only the real production modules qualify
      expect(isRealBrandModule(REAL_RASTER)).toBe(true);
      // the exact attack from the review: imported passthrough + fake type
      const attack = 'import { passthrough as checkRaster } from "./fake.ts";\nimport type { Fake as VerifiedRaster } from "./fake.ts";\nexport function verifiedRasterUrl(value: VerifiedRaster) {\n  checkRaster(value);\n  return value.url;\n}\nexport const s = { backgroundImage: verifiedRasterUrl("/raw.png") };\n';
      expect(tree(attack)["ui/ro/primitives.tsx"]).toEqual(expect.arrayContaining(["raster-helper-binding", "literal-raster-source"]));
      const variants: Record<string, string> = {
        "imported checkRaster with the exact helper shape": `import { passthrough as checkRaster } from "./fake.ts";\nimport type { VerifiedRaster } from "./raster.ts";\n${HELPER}${usage}`,
        "local passthrough checkRaster": `import type { VerifiedRaster } from "./raster.ts";\nfunction checkRaster(r: unknown, f: string): VerifiedRaster {\n  return r as VerifiedRaster;\n}\n${HELPER}${usage}`,
        "aliased brand import": `import { isVerifiedRaster as isVerifiedRasterX, type VerifiedRaster } from "./raster.ts";\nconst isVerifiedRaster = (x: unknown): x is VerifiedRaster => true;\nfunction checkRaster(r: unknown, field: string): VerifiedRaster {\n  if (!isVerifiedRaster(r)) throw new Error(field);\n  return r;\n}\n${HELPER}${usage}void isVerifiedRasterX;\n`,
        "fake local VerifiedRaster type": CANON_HEAD.replace("type VerifiedRaster ", "") + "type VerifiedRaster = { readonly url: string };\n" + HELPER + usage,
        "VerifiedRaster from another module": `${CANON_HEAD.replace('"./raster.ts"', '"./fake.ts"')}${HELPER}${usage}`,
        "aliased VerifiedRaster import": `${CANON_HEAD.replace("type VerifiedRaster }", "type VerifiedRaster as VR }").replace("): VerifiedRaster {", "): VR {")}type VerifiedRaster = VR;\n${HELPER}${usage}`,
        "reassigned guard parameter": CANON_HEAD.replace("  return r;", "  r = { url: \"/raw.png\" };\n  return r;") + HELPER + usage,
        // the exact case from the review: an early return of a forged value before the final `return r`
        "early return in the guard": CANON_HEAD.replace("  return r;", '  return { url: "/raw.png" } as VerifiedRaster;\n  return r;') + HELPER + usage,
        "conditional return in the guard": CANON_HEAD.replace("  return r;", '  if (field === "raster") return { url: "/raw.png" } as VerifiedRaster;\n  return r;') + HELPER + usage,
        "nested-block return in the guard": CANON_HEAD.replace("  return r;", '  {\n    return { url: "/raw.png" } as VerifiedRaster;\n  }\n  return r;') + HELPER + usage,
        "nested function in the guard": CANON_HEAD.replace("  return r;", '  const g = (): VerifiedRaster => ({ url: "/raw.png" }) as VerifiedRaster;\n  void g;\n  return r;') + HELPER + usage,
        "destructured reassignment of the guard parameter": CANON_HEAD.replace("  return r;", '  [r] = [{ url: "/raw.png" }];\n  return r;') + HELPER + usage,
        // the exact case from the review: a for-of target rewrites the parameter after the brand check
        "for-of target on the guard parameter": CANON_HEAD.replace("  return r;", '  for (r of [{ url: "/raw.png" }]) void 0;\n  return r;') + HELPER + usage,
        "for-in target on the guard parameter": CANON_HEAD.replace("  return r;", "  for (r in { a: 1 }) void 0;\n  return r;") + HELPER + usage,
        "var redeclaration of the guard parameter": CANON_HEAD.replace("  return r;", '  var r = { url: "/raw.png" };\n  return r;') + HELPER + usage,
        "compound assignment of the guard parameter": CANON_HEAD.replace("  return r;", '  r ??= { url: "/raw.png" };\n  return r;') + HELPER + usage,
      };
      for (const [name, code] of Object.entries(variants)) expect(tree(code)["ui/ro/primitives.tsx"], name).toEqual(expect.arrayContaining(["literal-raster-source"]));
      // the helper is right but the brand module next to it is fake
      expect(tree(`${CANON_HEAD}${HELPER}${usage}`, "export interface VerifiedRaster {\n  readonly url: string;\n}\nexport function isVerifiedRaster(x: unknown): x is VerifiedRaster {\n  return x !== null;\n}\n")["ui/ro/primitives.tsx"]).toContain("raster-brand-provenance");
      // a re-export of the helper name is a binding outside the canonical declaration
      writeFileSync(join(dir, "reexport.ts"), 'export { verifiedRasterUrl } from "./ui/ro/primitives.tsx";\nexport { verifiedRasterUrl as v } from "./ui/ro/primitives.tsx";\n');
      expect(scanFormalVisual(readFileSync(join(dir, "reexport.ts"), "utf8"), join(dir, "reexport.ts"))).toContain("raster-helper-binding");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("R4-5: other dynamic paths fail closed (relative JSX tag, logical / compound assignment, Reflect, dynamic props / style)", () => {
    const dir = mkdtempSync(join(tmpdir(), "ro-guard8-"));
    try {
      // relative import of a "component" that is really the intrinsic "img"
      writeFileSync(join(dir, "tag.ts"), 'export default ("im" + "g") as "img";\n');
      writeFileSync(join(dir, "entry.tsx"), 'import Tag from "./tag.ts";\nexport const v = <Tag />;\n');
      expect(guardGraph(join(dir, "entry.tsx")).find((r) => relPosix(dir, r.file) === "entry.tsx")?.violations).toContain("opaque-element-tag");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    const fn = (body: string) => `export function f(el: HTMLElement, key: string, dyn: object) {\n  ${body}\n}\n`;
    for (const op of ASSIGNMENT_OPERATORS) expect(scanFormalVisual(fn(`el[key] ${op} "/raw.png";`), "x.ts"), op).toContain("opaque-property-name");
    expect(scanFormalVisual(fn('delete el[key];'), "x.ts")).toContain("opaque-property-name");
    expect(scanFormalVisual(fn('el["src"] = "/raw.png";'), "x.ts")).toContain("opaque-property-name");
    expect(scanFormalVisual(fn('Reflect.set(el, "src", "/raw.png");'), "x.ts")).toEqual(expect.arrayContaining(["unknown-global:Reflect", "opaque-property-name"]));
    expect(scanFormalVisual(fn("Object.defineProperty(el, key, { value: 1 });"), "x.ts")).toContain("opaque-property-name");
    expect(scanFormalVisual(fn("return el.constructor;"), "x.ts")).toContain("opaque-property-name");
    for (const g of ["document", "window", "globalThis", "eval"]) expect(scanFormalVisual(fn(`return ${g};`), "x.ts"), g).toContain(`unknown-global:${g}`);
    // Function is allowlisted only as `Function.prototype` (import-time call-binder): any other use fails
    for (const body of ["return Function;", 'return new Function("x");', 'return Function("x");', "return Function.constructor;"]) {
      expect(scanFormalVisual(fn(body), "x.ts").some((v) => v.startsWith("unknown-global-member:Function") || v === "opaque-property-name"), body).toBe(true);
    }
    // dynamic object construction for props / style
    expect(scanFormalVisual(fn("return { ...dyn };"), "x.ts")).toContain("opaque-object-spread");
    expect(scanFormalVisual(fn('return Object.fromEntries([[key, "/raw.png"]]);'), "x.ts")).toContain("unknown-global-member:Object.fromEntries");
    expect(scanFormalVisual(fn("return Object.assign(el.style, dyn);"), "x.ts")).toContain("unknown-global-member:Object.assign");
    expect(scanFormalVisual('export function f(dyn: object) {\n  return <div style={{ ...dyn }} />;\n}\n', "x.tsx")).toContain("opaque-object-spread");
    expect(scanFormalVisual('export function f(key: string) {\n  return <div style={{ [key]: 4 }} />;\n}\n', "x.tsx")).toContain("opaque-property-name");
  });

  it("R4-6: every assignment operator on a source / raster-style property is rejected (property access, not only el[key])", () => {
    const fn = (body: string) => `export function f(el: HTMLElement) {\n  ${body}\n}\n`;
    // the exact cases from the review
    expect(scanFormalVisual(fn('el.src ||= "/raw.png";'), "x.ts")).toContain("literal-raster-source");
    const u = 'const u = ["u", "rl(", "/raw.png", ")"].join("");';
    expect(scanFormalVisual(fn(`${u}\n  el.style.backgroundImage &&= u;`), "x.ts")).toContain("literal-raster-source");
    expect(scanFormalVisual(fn(`${u}\n  el.style.backgroundImage += u;`), "x.ts")).toContain("literal-raster-source");
    // the rest of the operators, both property families, and ++ / --
    expect(ASSIGNMENT_OPERATORS).toHaveLength(16);
    for (const op of ASSIGNMENT_OPERATORS) {
      expect(scanFormalVisual(fn(`el.src ${op} "/raw.png";`), "x.ts"), `src ${op}`).toContain("literal-raster-source");
      expect(scanFormalVisual(fn(`${u}\n  el.style.backgroundImage ${op} u;`), "x.ts"), `backgroundImage ${op}`).toContain("literal-raster-source");
      expect(scanFormalVisual(fn(`el.srcset ${op} "/raw.png 1x";`), "x.ts"), `srcset ${op}`).toContain("literal-raster-source");
      expect(scanFormalVisual(fn(`el.poster ${op} "/raw.png";`), "x.ts"), `poster ${op}`).toContain("literal-raster-source");
      expect(scanFormalVisual(fn(`${u}\n  el.style.listStyleImage ${op} u;`), "x.ts"), `listStyleImage ${op}`).toContain("literal-raster-source");
    }
    expect(scanFormalVisual(fn("(el as unknown as { src: number }).src++;"), "x.ts")).toContain("literal-raster-source");
    // a plain `=` of a harmless literal to a style property is still accepted
    expect(scanFormalVisual(fn('el.style.cursor = "inherit";'), "x.ts")).toEqual([]);
  });

  it("R4-8: setter capabilities fail closed — computed, alias, call / apply / bind, destructuring", () => {
    const fn = (body: string) => `export function f(el: HTMLElement) {\n  ${body}\n}\n`;
    // the exact cases from the review
    expect(scanFormalVisual(fn('el["setAttribute"]("s" + "rc", "/raw.png");'), "x.ts")).toContain("setter-capability");
    expect(scanFormalVisual(fn('const sa = el.setAttribute;\n  sa.call(el, "s" + "rc", "/raw.png");'), "x.ts")).toContain("setter-capability");
    expect(scanFormalVisual(fn('const dp = Object.defineProperty;\n  dp(el, "s" + "rc", { value: "/raw.png" });'), "x.ts")).toEqual(expect.arrayContaining(["setter-capability", "unknown-global-member:Object.defineProperty"]));
    for (const body of [
      'el.setAttribute("title", "x");',
      'el.setAttributeNS(null, "s" + "rc", "/raw.png");',
      'el.style.setProperty("--x", "1");',
      "el.setAttribute.apply(el, args);",
      "const b = el.setAttribute.bind(el);",
      "const { setAttribute } = el;",
      "const { setAttribute: sa } = el;",
      'const k = `setAttribute`;\n  (el as unknown as Record<string, () => void>)[k]();',
      "Object.defineProperties(el, {});",
      "Object.assign(el, {});",
      "Object.setPrototypeOf(el, null);",
      'el.style.cssText = "x";',
    ]) expect(scanFormalVisual(fn(body), "x.ts"), body).toContain("setter-capability");
    // dynamic names still fail even without the capability name
    expect(scanFormalVisual(fn('const k = "set" + "Attribute";\n  (el as unknown as Record<string, () => void>)[k]();'), "x.ts")).toContain("opaque-property-name");
  });

  it("R4-10: the loader brand content check — real positive, forged argument and shadowed WeakSet negatives", () => {
    // the real loader passes (anchored path + content)
    expect(isRealMintSource(REAL_MINT, readFileSync(REAL_MINT, "utf8"))).toBe(true);
    // the real loader source, content-checked under a neutral path; every negative is derived from it
    const ok = readFileSync(REAL_MINT, "utf8");
    const brandLoop = "for (let link = chain; link !== null; link = link.next) mintedAdd(link.handle);";
    expect(ok).toContain(brandLoop);
    expect(isRealMintSource("m.ts", ok)).toBe(true);
    const bad: Record<string, string> = {
      "forged argument": ok.replace("mintedHas(x)", "mintedHas(fake)").replace("const minted", "const fake = {};\nconst minted"),
      "constant argument": ok.replace("mintedHas(x)", "mintedHas({})"),
      "extra argument": ok.replace("mintedHas(x)", "mintedHas(x, x)"),
      "two parameters": ok.replace("isMintedRaster(x: unknown)", "isMintedRaster(x: unknown, y: unknown)").replace("mintedHas(x)", "mintedHas(y as object)"),
      "WeakSet constructed with members": ok.replace("new WeakSet<object>()", "new WeakSet<object>([globalFake])").replace("const minted", "const globalFake = {};\nconst minted"),
      "shadowed WeakSet (top-level class)": `class WeakSet<T extends object> {\n  has(_v: T): boolean {\n    return true;\n  }\n  static prototype: { has: (v: object) => boolean };\n}\n${ok}`,
      "shadowed WeakSet (import)": `import { FakeWeakSet as WeakSet } from "./fake.ts";\n${ok}`,
      "shadowed WeakSet only in the bind": ok.replace("WeakSet.prototype.has.bind(minted)", "FakeSet.prototype.has.bind(minted)").replace("const minted", "const FakeSet = WeakSet;\nconst minted"),
      "has replaced by another method": ok.replace("WeakSet.prototype.has.bind", "WeakSet.prototype.add.bind"),
      "not exported": ok.replace("export function", "function"),
      "duplicate isMintedRaster": `${ok}export function isMintedRaster2() {}\nfunction isMintedRaster() {\n  return true;\n}\n`,
      "let instead of const": ok.replace("const mintedHas", "let mintedHas"),
      // R4 final review: side-effecting or impure prefix conjuncts
      "brand-set add as a prefix conjunct": ok.replace('return typeof x === "object" && x !== null && mintedHas(x);', "return minted.add(x as object) && mintedHas(x);"),
      "assignment as a prefix conjunct": ok.replace('return typeof x === "object" && x !== null && mintedHas(x);', "return (x = fake) && mintedHas(x);").replace("const minted", "const fake = {};\nconst minted"),
      "add hidden in the first conjunct": ok.replace('typeof x === "object"', 'typeof minted.add(x as object) === "object"'),
      "extra call conjunct": ok.replace("x !== null && mintedHas(x)", "x !== null && !!minted.add(x as object) && mintedHas(x)"),
      "update in the predicate": ok.replace("x !== null", "x++ !== null"),
      "comma expression": ok.replace("x !== null", "(minted.add(x as object), x) !== null"),
      "different identifier in typeof": ok.replace('typeof x === "object"', 'typeof minted === "object"'),
      "loose equality": ok.replace("x !== null", "x != null"),
      "only the final call": ok.replace('return typeof x === "object" && x !== null && mintedHas(x);', "return mintedHas(x as object);"),
      // loader-only issuance: the add capability and the set itself
      "exported forge with a direct mintedAdd call": `${ok}export function forge(x: object) {\n  mintedAdd(x);\n}\n`,
      "exported mintedAdd alias": `${ok}export { mintedAdd as forge };\n`,
      "extra minted.add(x) in a private helper": `${ok}function sneak(x: object) {\n  minted.add(x);\n}\nvoid sneak;\n`,
      "local alias of mintedAdd": `${ok}const f = mintedAdd;\nvoid f;\n`,
      "mintedAdd called with another argument": ok.replace("mintedAdd(link.handle)", "mintedAdd(items as object)"),
      "mintedAdd bound from has": ok.replace("WeakSet.prototype.add.bind(minted)", "WeakSet.prototype.has.bind(minted)"),
      "mintedAdd bound onto another set": ok.replace("WeakSet.prototype.add.bind(minted)", "WeakSet.prototype.add.bind(other)").replace("const minted", "const other = new WeakSet<object>();\nconst minted"),
      "no mintedAdd": ok.replace("const mintedAdd: (x: object) => WeakSet<object> = WeakSet.prototype.add.bind(minted);\n", "").replace("mintedAdd(link.handle)", "void link"),
      "extra value export": `${ok}export const forged = 1;\n`,
      "export star": `${ok}export * from "./other.ts";\n`,
      "export default": `${ok}export default mintRasterSet;\n`,
      // the brand is added only on the locked success path
      "(a) caller-item spoof": ok.replace(brandLoop, "const link = { handle: items[0] as object };\n  mintedAdd(link.handle);"),
      "(b) nested helper with a link parameter": ok.replace(brandLoop, "const brand = (link: { handle: object }) => mintedAdd(link.handle);\n  for (let l = chain; l !== null; l = l.next) brand(l);"),
      "(b) nested function declaration": ok.replace(brandLoop, "function brand(link: { handle: object }): void {\n    mintedAdd(link.handle);\n  }\n  for (let l = chain; l !== null; l = l.next) brand(l);"),
      "(c) chain from caller-controlled items": ok.replace("const chain = issued;", "const chain = items as unknown as IssuedLink | null;\n  void issued;"),
      "(c) chain from a ternary": ok.replace("const chain = issued;", "const chain = count > 0 ? issued : (items as unknown as IssuedLink | null);"),
      "(d) extra assignment of issued": ok.replace("const chain = issued;", "issued = { handle: items[0] as unknown as Handle, next: issued };\n  const chain = issued;"),
      "(d) alias of issued": ok.replace("const chain = issued;", "const alias = issued;\n  void alias;\n  const chain = issued;"),
      "(d) link node rewritten through an alias": ok.replace("const chain = issued;", "const chain = issued;\n  if (chain) (chain as { handle: unknown }).handle = items[0];"),
      "issued built from caller items": ok.replace("issued = { handle: new Handle(it.assetId, it.width, it.height, it.entry, url), next: issued };", "issued = { handle: items[i] as unknown as Handle, next: issued };"),
      "Handle built from caller items": ok.replace("new Handle(it.assetId, it.width", "new Handle((items[i] as MintItem).assetId, it.width"),
      "prepared is the caller's items": ok.replace("const prepared: readonly Prepared[] = freeze(list);", "const prepared = items as unknown as readonly Prepared[];\n  void list;"),
      "brand loop with a different condition": ok.replace(brandLoop, "for (let link = chain; link; link = link.next) mintedAdd(link.handle);"),
      "brand loop with extra body": ok.replace(brandLoop, "for (let link = chain; link !== null; link = link.next) {\n    mintedAdd(link.handle);\n    void 0;\n  }"),
      // value exports: all three present
      "missing RasterIssuanceError export": ok.replace("export class RasterIssuanceError", "class RasterIssuanceError"),
      "missing isMintedRaster export": ok.replace("export function isMintedRaster", "function isMintedRaster"),
    };
    for (const [name, src] of Object.entries(bad)) expect(isRealMintSource("m.ts", src), name).toBe(false);
    // the braced form of the brand loop with only that statement is equivalent and accepted
    expect(isRealMintSource("m.ts", ok.replace(brandLoop, "for (let link = chain; link !== null; link = link.next) {\n    mintedAdd(link.handle);\n  }"))).toBe(true);
  });

  it("R4-11: the exact review attacks give raster-brand-provenance on the anchored production path", () => {
    const real = readFileSync(REAL_MINT, "utf8");
    const pure = 'return typeof x === "object" && x !== null && mintedHas(x);';
    expect(real).toContain(pure);
    const attacks = {
      "minted.add(x) && mintedHas(x)": real.replace(pure, "return minted.add(x as object) && mintedHas(x);"),
      "(x = fake) && mintedHas(x)": real.replace(pure, "return (x = fake) && mintedHas(x);").replace("const minted = new WeakSet<object>();", "const fake = {};\nconst minted = new WeakSet<object>();"),
      "export function forge(x) { mintedAdd(x); }": `${real}\nexport function forge(x: object): void {\n  mintedAdd(x);\n}\n`,
      "export { mintedAdd as forge }": `${real}\nexport { mintedAdd as forge };\n`,
      "extra minted.add(x)": `${real}\nfunction sneak(x: object): void {\n  minted.add(x);\n}\nvoid sneak;\n`,
      "caller-item spoof on the brand path": real.replace("for (let link = chain; link !== null; link = link.next) mintedAdd(link.handle);", "const link = { handle: items[0] as object };\n  mintedAdd(link.handle);"),
    };
    expect(isRealMintSource(REAL_MINT, real)).toBe(true);
    for (const [name, src] of Object.entries(attacks)) expect(isRealMintSource(REAL_MINT, src), name).toBe(false);
    // the whole-graph result on the anchored files is still clean for the real loader
    expect(guardGraph(join(srcDir, "ui/ro/index.ts"))).toEqual([]);
  });

  it("R4-12: the issuance URL must come from the module's own createUrl (declaration identity, not text)", () => {
    const real = readFileSync(REAL_MINT, "utf8");
    const urlLine = "const url = createUrl(it.bytes);";
    expect(real).toContain(urlLine);
    const attacks: Record<string, string> = {
      // the exact case from the review: a local shadow inside the issuance loop returns a caller URL
      "local shadow createUrl": real.replace(urlLine, "const createUrl = (_b: Uint8Array<ArrayBuffer>): string =>\n        (items[0] as unknown as { url: string }).url;\n      const url = createUrl(it.bytes);"),
      "module createUrl ignores the verified bytes": real.replace("ownIterable([bytes])", "ownIterable([PNG_SIGNATURE])"),
      "module urlCreate is not URL.createObjectURL": real.replace("const urlCreate: (blob: Blob) => string = URL.createObjectURL;", 'const urlCreate: (blob: Blob) => string = () => "https://evil.invalid/raw.png";'),
      "module BlobCtor is not Blob": real.replace("const BlobCtor = Blob;", "const BlobCtor = class extends Blob {};"),
      "url from another function": real.replace(urlLine, "const url = String(it.bytes);"),
    };
    for (const [name, code] of Object.entries(attacks)) {
      expect(code, name).not.toBe(real);
      expect(isRealMintSource(REAL_MINT, code), name).toBe(false);
      // the formal guard over the real anchored graph, with only the loader source replaced in memory
      const rows = guardGraph(join(srcDir, "ui/ro/index.ts"), new Map([[REAL_MINT, code]]));
      expect(rows.find((r) => relPosix(srcDir, r.file) === "ui/ro/primitives.tsx")?.violations, name).toContain("raster-brand-provenance");
    }
    // the unmodified loader still passes both
    expect(isRealMintSource(REAL_MINT, real)).toBe(true);
    expect(guardGraph(join(srcDir, "ui/ro/index.ts"), new Map([[REAL_MINT, real]]))).toEqual([]);
  });

  // heavy mutation matrix (one full guardGraph per attack): explicit Windows stability budget
  it("R4-13: the Handle class is locked — constructor-return injection, extends, delegation and alternate URLs fail", { timeout: 20_000 }, () => {
    const real = readFileSync(REAL_MINT, "utf8");
    const ctorOpen = "constructor(assetId: string, width: number, height: number, entry: Readonly<UiManifestEntry>, url: string) {";
    const classOpen = "class Handle implements VerifiedRaster {";
    for (const s of [ctorOpen, classOpen, "    this.#url = url;", "    return this.#url;", "    revokeUrl(u);", "freeze(Handle.prototype);"]) expect(real).toContain(s);
    const attacks: Record<string, string> = {
      // the exact case from the review: a local literal fake returned from the constructor
      "local literal fake return": real.replace(ctorOpen, `${ctorOpen}\n    return { assetId, width, height, entry, url: "https://evil.invalid/raw.png", disposed: false, dispose() {} } as unknown as Handle;`),
      // the global conditional variant
      "global conditional return": real.replace(ctorOpen, `${ctorOpen}\n    const g = globalThis as { __evilHandle?: Handle };\n    if (g.__evilHandle) return g.__evilHandle;`),
      "return in a nested block": real.replace(ctorOpen, `${ctorOpen}\n    {\n      if (url === "x") return { url } as unknown as Handle;\n    }`),
      "class Handle extends a base returning arbitrary objects": real.replace(classOpen, 'class EvilBase {\n  constructor() {\n    return { url: "https://evil.invalid/raw.png" };\n  }\n}\nclass Handle extends EvilBase implements VerifiedRaster {').replace(ctorOpen, `${ctorOpen}\n    super();`),
      "class Handle extends Object": real.replace(classOpen, "class Handle extends Object implements VerifiedRaster {").replace(ctorOpen, `${ctorOpen}\n    super();`),
      "delegated #url source": real.replace("    this.#url = url;", "    this.#url = pick(url);").replace(classOpen, "const pick = (u: string): string => u;\n" + classOpen),
      "delegating constructor helper": real.replace("    this.#url = url;", "    init(this, url);").replace(classOpen, "function init(h: object, u: string): void {\n  void h;\n  void u;\n}\n" + classOpen),
      "url getter with an alternate source": real.replace("    return this.#url;", '    return "https://evil.invalid/raw.png";'),
      "parameter property": real.replace(ctorOpen, ctorOpen.replace("constructor(assetId: string", "constructor(public assetId: string")),
      "extra static member": real.replace(classOpen, `${classOpen}\n  static forge = 1;`),
      "field initialiser": real.replace("  #url: string | null;", '  #url: string | null = "https://evil.invalid/raw.png";'),
      "dispose without revoke": real.replace("    revokeUrl(u);", "    void u;"),
      "prototype not frozen": real.replace("freeze(Handle.prototype);", "void Handle.prototype;"),
      "prototype written before freeze": real.replace("freeze(Handle.prototype);", '(Handle.prototype as unknown as { tag: string }).tag = "x";\nfreeze(Handle.prototype);'),
      // the exact case from both auditors: the Handle binding reassigned before issuance
      "Handle binding reassigned": real.replace("freeze(Handle);", "freeze(Handle);\nHandle = ((globalThis as unknown as { __EvilHandle?: typeof Handle }).__EvilHandle ?? Handle);"),
      "Handle binding compound-assigned": real.replace("freeze(Handle);", "freeze(Handle);\n(Handle as unknown) ??= null;"),
      "Handle binding destructured": real.replace("freeze(Handle);", "freeze(Handle);\n[Handle] = [Handle];"),
    };
    for (const [name, code] of Object.entries(attacks)) {
      expect(code, name).not.toBe(real);
      expect(isRealMintSource(REAL_MINT, code), name).toBe(false);
      const rows = guardGraph(join(srcDir, "ui/ro/index.ts"), new Map([[REAL_MINT, code]]));
      expect(rows.find((r) => relPosix(srcDir, r.file) === "ui/ro/primitives.tsx")?.violations, name).toContain("raster-brand-provenance");
    }
    expect(isRealMintSource(REAL_MINT, real)).toBe(true);
    expect(guardGraph(join(srcDir, "ui/ro/index.ts"), new Map([[REAL_MINT, real]]))).toEqual([]);
  });

  /** Both APIs must reject a mutated loader source; the formal guard sees it through an in-memory override. */
  const expectMintRejected = (name: string, code: string, real: string): void => {
    expect(code, name).not.toBe(real);
    expect(isRealMintSource(REAL_MINT, code), name).toBe(false);
    const rows = guardGraph(join(srcDir, "ui/ro/index.ts"), new Map([[REAL_MINT, code]]));
    expect(rows.find((r) => relPosix(srcDir, r.file) === "ui/ro/primitives.tsx")?.violations, name).toContain("raster-brand-provenance");
  };

  it("R4-14: the Handle url getter's throw is exactly the production Error (no write / call / comma)", () => {
    const real = readFileSync(REAL_MINT, "utf8");
    const throwLine = "    if (this.#url === null) throw new Error(`raster ${this.assetId} was disposed`);";
    expect(real).toContain(throwLine);
    const attacks: Record<string, string> = {
      // the exact case from the review: the throw writes the private field first
      "throw writes #url via comma": real.replace(throwLine, '    if (this.#url === null) throw ((this.#url = "https://evil.invalid/raw.png"), new Error(`raster ${this.assetId} was disposed`));'),
      "throw calls a helper": real.replace(throwLine, "    if (this.#url === null) throw makeError(this.assetId);").replace("class Handle implements", "const makeError = (id: string): Error => new Error(id);\nclass Handle implements"),
      "conditional throw value": real.replace(throwLine, '    if (this.#url === null) throw this.assetId ? new Error(`raster ${this.assetId} was disposed`) : new Error("x");'),
      "different message span": real.replace(throwLine, "    if (this.#url === null) throw new Error(`raster ${this.#url} was disposed`);"),
      "extra template span": real.replace(throwLine, "    if (this.#url === null) throw new Error(`raster ${this.assetId}${(this.#url = null)} was disposed`);"),
      "shadowed Error": real.replace(throwLine, "    if (this.#url === null) throw new Error(`raster ${this.assetId} was disposed`);").replace("class Handle implements", "class Error {\n  constructor(_m: string) {}\n}\nclass Handle implements"),
      "throw a non-Error": real.replace(throwLine, '    if (this.#url === null) throw "disposed";'),
    };
    for (const [name, code] of Object.entries(attacks)) expectMintRejected(name, code, real);
    expect(isRealMintSource(REAL_MINT, real)).toBe(true);
  });

  // heavy mutation matrix (one full guardGraph per attack): explicit Windows stability budget
  it("R4-15: createUrl's byte path is exact — plain parameter, locked ownIterable, inert Blob options", { timeout: 20_000 }, () => {
    const real = readFileSync(REAL_MINT, "utf8");
    const createLine = 'const createUrl = (bytes: Uint8Array): string => urlCreate(new BlobCtor(ownIterable([bytes]) as unknown as BlobPart[], { type: "image/png" }));';
    expect(real).toContain(createLine);
    const withCreate = (line: string) => real.replace(createLine, line);
    const attacks: Record<string, string> = {
      // (a) parameter shapes
      "rest parameter": withCreate('const createUrl = (...bytes: Uint8Array[]): string => urlCreate(new BlobCtor(ownIterable([bytes]) as unknown as BlobPart[], { type: "image/png" }));'),
      "default parameter": withCreate('const createUrl = (bytes: Uint8Array = new Uint8Array([1, 2, 3])): string => urlCreate(new BlobCtor(ownIterable([bytes]) as unknown as BlobPart[], { type: "image/png" }));'),
      "destructured parameter": withCreate('const createUrl = ({ buffer: bytes }: Uint8Array): string => urlCreate(new BlobCtor(ownIterable([bytes]) as unknown as BlobPart[], { type: "image/png" }));'),
      "optional parameter": withCreate('const createUrl = (bytes?: Uint8Array): string => urlCreate(new BlobCtor(ownIterable([bytes]) as unknown as BlobPart[], { type: "image/png" }));'),
      // (b) ownIterable yields another module-local array instead of `values`
      "ownIterable value substitution": real.replace("          const value = values[i] as T;", "          const value = FORGED[i] as unknown as T;").replace("function ownIterable<T>", "const FORGED = [new Uint8Array([1, 2, 3])];\nfunction ownIterable<T>"),
      "ownIterable length substitution": real.replace("  const n = values.length;", "  const n = 0;"),
      "ownIterable iterator key substitution": real.replace("const ITERATOR: typeof Symbol.iterator = Symbol.iterator;", "const ITERATOR: typeof Symbol.iterator = Symbol.asyncIterator as unknown as typeof Symbol.iterator;"),
      "ownIterable rebound": real.replace("function ownIterable<T>", "function evilIterable<T>(values: readonly T[]): Iterable<T> {\n  return values;\n}\nfunction ownIterable<T>") + "\n(ownIterable as unknown) = evilIterable;\n",
      // Blob options other than the inert literal
      "Blob options with a getter": withCreate('const createUrl = (bytes: Uint8Array): string => urlCreate(new BlobCtor(ownIterable([bytes]) as unknown as BlobPart[], { get type() { return "image/png"; } }));'),
      "Blob options with a spread": withCreate('const createUrl = (bytes: Uint8Array): string => urlCreate(new BlobCtor(ownIterable([bytes]) as unknown as BlobPart[], { ...{ type: "image/png" } }));'),
      "Blob options with an extra member": withCreate('const createUrl = (bytes: Uint8Array): string => urlCreate(new BlobCtor(ownIterable([bytes]) as unknown as BlobPart[], { type: "image/png", endings: "native" }));'),
      "Blob options from a variable": withCreate('const createUrl = (bytes: Uint8Array): string => urlCreate(new BlobCtor(ownIterable([bytes]) as unknown as BlobPart[], BLOB_OPTS));').replace("const createUrl", 'const BLOB_OPTS = { type: "image/png" };\nconst createUrl'),
      "Blob options with another type": withCreate('const createUrl = (bytes: Uint8Array): string => urlCreate(new BlobCtor(ownIterable([bytes]) as unknown as BlobPart[], { type: "text/html" }));'),
      // async variants that still typecheck through casts but return Promises at runtime
      "async createUrl arrow": withCreate('const createUrl = (async (bytes: Uint8Array): Promise<string> => urlCreate(new BlobCtor(ownIterable([bytes]) as unknown as BlobPart[], { type: "image/png" }))) as unknown as (bytes: Uint8Array) => string;'),
      "async ownIterable iterator factory": real.replace("    [ITERATOR]: () => {", "    [ITERATOR]: async () => {").replace("  } as Iterable<T>;", "  } as unknown as Iterable<T>;"),
      "async ownIterable next": real.replace("        next: () => {", "        next: async () => {").replace("  } as Iterable<T>;", "  } as unknown as Iterable<T>;"),
      // revokeUrl: the exact case from the guard audit (rest parameter → array-to-string conversion), plus kin
      "rest-parameter revokeUrl": real.replace("const revokeUrl = (url: string): void => urlRevoke(url);", "const revokeUrl = (...url: string[]): void => urlRevoke(url as unknown as string);"),
      "default-parameter revokeUrl": real.replace("const revokeUrl = (url: string): void => urlRevoke(url);", 'const revokeUrl = (url: string = "blob:other"): void => urlRevoke(url);'),
      "async revokeUrl": real.replace("const revokeUrl = (url: string): void => urlRevoke(url);", "const revokeUrl = (async (url: string): Promise<void> => urlRevoke(url)) as unknown as (url: string) => void;"),
      "generic createUrl arrow": withCreate('const createUrl = <B extends Uint8Array>(bytes: B): string => urlCreate(new BlobCtor(ownIterable([bytes]) as unknown as BlobPart[], { type: "image/png" }));'),
      "Blob options computed key": withCreate('const createUrl = (bytes: Uint8Array): string => urlCreate(new BlobCtor(ownIterable([bytes]) as unknown as BlobPart[], { ["type"]: "image/png" }));'),
    };
    for (const [name, code] of Object.entries(attacks)) expectMintRejected(name, code, real);
    expect(isRealMintSource(REAL_MINT, real)).toBe(true);
    expect(guardGraph(join(srcDir, "ui/ro/index.ts"), new Map([[REAL_MINT, real]]))).toEqual([]);
  });

  it("R4-9: destructuring / for-in / for-of targets, split setter names and Object aliases fail closed", () => {
    const fn = (body: string) => `export function f(el: HTMLElement, u: string) {\n  ${body}\n}\n`;
    // recursive assignment targets (the exact cases from the review)
    for (const body of ['[el.src] = ["/raw.png"];', '({ x: el.poster } = { x: "/raw.png" });', "[el.style.backgroundImage] = [u];", '[{ a: [el.srcset] }] = [{ a: ["/raw.png"] }];', '({ ...el.style.backgroundImage } = { x: "" } as never);', '[el["src"] = "/raw.png"] = [];', 'for (el.src of ["/raw.png"]) void 0;', 'for (el.style.backgroundImage in { a: 1 }) void 0;']) {
      expect(scanFormalVisual(fn(body), "x.ts"), body).toContain("literal-raster-source");
    }
    // split setter names through element access, alias, call / apply / bind
    for (const body of ['const sa = el["set" + "Attribute"];\n  sa.call(el, "s" + "rc", "/raw.png");', 'el["set" + "Attribute"].apply(el, ["s" + "rc", "/raw.png"]);', 'const b = el[`setAttribute`].bind(el);', 'el["set" + "Attribute" + "NS"](null, "s" + "rc", "/raw.png");']) {
      expect(scanFormalVisual(fn(body), "x.ts"), body).toContain("setter-capability");
    }
    // Object alias + split defineProperty / assign / setPrototypeOf
    for (const body of ['const O = Object;\n  O["define" + "Property"](el, "s" + "rc", { value: "/raw.png" });', 'const O = Object;\n  O["ass" + "ign"](el, {});', 'const O = Object;\n  O["setProto" + "typeOf"](el, null);', "const { defineProperty: dp } = Object;\n  void dp;", "use(Object);"]) {
      const v = scanFormalVisual(fn(body), "x.ts");
      expect(v.some((x) => x === "unknown-global-member:Object" || x === "setter-capability"), body).toBe(true);
    }
    expect(scanFormalVisual(fn('const O = Object;\n  O["define" + "Property"](el, "s" + "rc", { value: "/raw.png" });'), "x.ts")).toEqual(expect.arrayContaining(["unknown-global-member:Object", "setter-capability"]));
    // split cssText destructuring / writes
    for (const body of ['const { ["css" + "Text"]: t } = el.style;\n  void t;', '({ ["css" + "Text"]: u } = el.style);', '[el.style["css" + "Text"]] = ["background:url(x)"];', 'el.style["css" + "Text"] = "x";']) {
      expect(scanFormalVisual(fn(body), "x.ts"), body).toContain("setter-capability");
    }
    // dynamic keys of unknown type fail; numeric and safe literal-union keys pass
    expect(scanFormalVisual(fn('const k = u + "x";\n  return (el as unknown as Record<string, unknown>)[k];'), "x.ts")).toContain("opaque-property-name");
    expect(scanFormalVisual('type K = "a" | "b";\nexport function f(o: Record<K, number>, k: K, xs: number[]) {\n  let s = 0;\n  for (let i = 0; i < 2; i += 1) s += xs[i] as number;\n  return o[k] + s;\n}\n', "x.ts")).toEqual([]);
    expect(scanFormalVisual('type K = "a" | "src";\nexport function f(o: Record<K, string>, k: K) {\n  return o[k];\n}\n', "x.ts")).toContain("opaque-property-name");
  });

  it("R4-7: an accepted component binding that is mutated is no longer accepted", () => {
    // the exact case from the review
    expect(scanFormalVisual('function Tag() {\n  return <div />;\n}\nTag = "img" as unknown as typeof Tag;\nexport const v = <Tag />;\n', "x.tsx")).toEqual(expect.arrayContaining(["binding-mutation", "opaque-element-tag"]));
    const mutations = [...ASSIGNMENT_OPERATORS.map((op) => `Tag ${op} x;`), "Tag++;", "--Tag;", "[Tag] = [x];", "({ Tag } = { Tag: x });", "for (Tag of [x]) void 0;", "for (Tag in { a: 1 }) void 0;"];
    for (const m of mutations) {
      const code = `function Tag() {\n  return <div />;\n}\nconst x = "img" as unknown as typeof Tag;\n${m}\nexport const v = <Tag />;\n`;
      expect(scanFormalVisual(code, "x.tsx"), m).toEqual(expect.arrayContaining(["binding-mutation", "opaque-element-tag"]));
    }
    // the same for the helper's guard and an import binding
    expect(scanFormalVisual(`${CANON_HEAD}${HELPER}checkRaster = ((r: unknown) => r) as typeof checkRaster;\nexport function s(r: VerifiedRaster) {\n  return { backgroundImage: verifiedRasterUrl(r) };\n}\n`, "ui/ro/primitives.tsx")).toEqual(expect.arrayContaining(["binding-mutation"]));
    expect(scanFormalVisual('import { isVerifiedRaster } from "./raster.ts";\n(isVerifiedRaster as unknown) = () => true;\n', "x.ts")).toContain("binding-mutation");
    // an unmutated local component is still accepted
    expect(scanFormalVisual("function Tag() {\n  return <div />;\n}\nexport const v = <Tag />;\n", "x.tsx")).toEqual([]);
  });

  it("R4-4: comment stripping is parser-aware — `//` or `/*` inside strings does not hide code", () => {
    // the exact regression from the review
    expect(scanFormalVisual(`const decoy = "x//y";\nconst style = { borderRadius: 4 };\n`, "x.ts")).toContain("border-radius");
    expect(scanFormalVisual("const decoy = `a/*b`;\nconst style = { borderRadius: 4 };\nconst end = `*/`;\n", "x.ts")).toContain("border-radius");
    expect(scanFormalVisual(`const re = /\\/\\//u;\nconst style = { borderRadius: 4 };\n`, "x.ts")).toContain("border-radius");
    expect(scanFormalVisual(`export const v = <p>see //docs</p>;\nconst style = { borderRadius: 4 };\n`, "x.tsx")).toContain("border-radius");
    expect(scanFormalVisual(`export const v = <p>//docs</p>;\nconst style = { borderRadius: 4 };\n`, "x.tsx")).toContain("border-radius");
    expect(scanFormalVisual(`export const v = <p>/*a</p>;\nconst style = { borderRadius: 4 };\nexport const w = <p>b*/</p>;\n`, "x.tsx")).toContain("border-radius");
    // real comments are still ignored
    expect(scanFormalVisual(`// borderRadius: 4\n/* box-shadow: 0 */\nconst a = 1; // border-radius\nexport const v = <div>{/* borderRadius */}</div>;\n`, "x.tsx")).toEqual([]);
    // CSS: block comments only, quotes respected; \`//\` is not a CSS comment
    expect(scanFormalVisual(`.a { content: "/*"; border-radius: 4px; } /* "*/`, "a.css")).toContain("border-radius");
    expect(scanFormalVisual(`.a { background-image: url(//evil.invalid/x.png); }`, "a.css")).toContain("literal-raster-source");
    expect(scanFormalVisual(`/* border-radius: 4px */ .a { position: absolute; }`, "a.css")).toEqual([]);
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
    expect(files.map((f) => relPosix(src, f))).toEqual(expect.arrayContaining(["ui/ro/hud.tsx", "ui/ro/index.ts", "ui/ro/primitives.tsx", "ui/ro/raster.ts"]));
    for (const f of files) expect(scanFormalVisual(readFileSync(f, "utf8"), f), f).toEqual([]);
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
      // `h` escaping into an array is an indirect factory use (R4-3b)
      expect(c[0]?.violations.sort()).toEqual(["external-import:fabric", "external-import:lucide-preact", "opaque-element-tag"]);
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
        "dirmod/index.tsx": ["literal-raster-source", "opaque-element-tag"],
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the shipped formal screen reaches the guarded original-RO HUD graph", () => {
    const files = moduleGraph(join(src, "main.tsx")).map((f) => relPosix(src, f));
    expect(files).toContain("App.tsx");
    expect(files).toEqual(expect.arrayContaining(["screens/Hud.tsx", "ui/ro/hud.tsx", "ui/ro/index.ts", "ui/ro/primitives.tsx", "ui/ro/raster.ts"]));
    expect(dirname(join(src, "ui/ro/index.ts"))).toBe(join(src, "ui/ro"));
  });
});
