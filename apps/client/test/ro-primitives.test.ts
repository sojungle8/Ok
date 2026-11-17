import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { classifyUiAsset, declaredUiDimensions, UI_PROFILE_ID } from "@ro-survivor/asset-contracts";
import type { UiManifestEntry } from "@ro-survivor/content-schema";
import { MissingAssetsError } from "../src/game/requirements.ts";
import { whitelist } from "../src/gateway.ts";
import { isVerifiedRaster, planButton, planGauge, planRaster, planSlot, planThreeSlice, RoButton, RoGauge, RoRaster, RoSlot, RoThreeSlice, VerifiedRasterSet, type VerifiedRaster } from "../src/ui/ro/index.ts";
import { FORBIDDEN, moduleGraph, scanFormalVisual } from "./visual-guard.ts";

/** SYNTHETIC structural harness: fake object URLs, entries derived from the canonical whitelist rows. */
function fakeUrls() {
  const log: string[] = [];
  let n = 0;
  return { log, urls: { create: () => `blob:synthetic/${(n += 1)}`, revoke: (u: string) => void log.push(`revoke ${u}`) } };
}
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
function rasterSet(ids: string[]) {
  const { log, urls } = fakeUrls();
  const set = new VerifiedRasterSet(urls);
  for (const id of ids) {
    const e = entryFor(id);
    set.issue(id, new Uint8Array([1]), e.native_width ?? 1, e.native_height ?? 1, e);
  }
  return { set, log };
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

describe("verified raster handles (synthetic harness)", () => {
  it("issued only for loader IDs; unknown ID -> canonical container/path; deterministic, double-dispose-safe revoke", () => {
    const { set, log } = rasterSet(["ui.arrow.left", "ui.arrow.right"]);
    const h = set.get("ui.arrow.left");
    expect([h.width, h.height, h.entry.canonical_cp949_path]).toEqual([11, 11, whitelist.get("ui.arrow.left").canonical_cp949_path]);
    expect(isVerifiedRaster(h)).toBe(true);
    expect(isVerifiedRaster({ ...h, url: "https://example.invalid/x.png" })).toBe(false);
    expect(missingOf(() => set.get("ui.arrow.up"))).toEqual([expect.objectContaining({ assetId: "ui.arrow.up", container: "data.grf", canonicalPath: whitelist.get("ui.arrow.up").canonical_cp949_path })]);
    expect(missingOf(() => set.get("ui.not.real"))).toEqual([expect.objectContaining({ assetId: "ui.not.real", canonicalPath: "(not in the canonical UI registry)" })]);
    set.dispose();
    set.dispose();
    expect(log).toEqual(["revoke blob:synthetic/1", "revoke blob:synthetic/2"]);
    expect(() => h.url).toThrow(/disposed/u);
    expect(() => set.get("ui.arrow.left")).toThrow(MissingAssetsError);
    expect(() => set.issue("ui.arrow.up", new Uint8Array(), 11, 11, entryFor("ui.arrow.up"))).toThrow(/disposed/u);
    expect(() => new VerifiedRasterSet(fakeUrls().urls).issue("ui.arrow.up", new Uint8Array(), 1, 1, entryFor("ui.arrow.left"))).toThrow(/entry is for/u);
  });

  it("native size × positive integer scale only", () => {
    const { set } = rasterSet(["ui.skill.sm_bash.icon"]);
    const r = set.get("ui.skill.sm_bash.icon");
    expect(planRaster(r, 1)).toMatchObject({ width: 24, height: 24 });
    expect(planRaster(r, 3)).toMatchObject({ width: 72, height: 72 });
    for (const bad of [0, -1, 1.5, Number.NaN]) expect(missingOf(() => planRaster(r, bad))).toEqual([expect.objectContaining({ canonicalPath: "scale" })]);
    expect(missingOf(() => planRaster({ ...r }))).toEqual([expect.objectContaining({ canonicalPath: "raster" })]);
  });
});

describe("RoThreeSlice", () => {
  const ids = ["ui.window.title.left", "ui.window.title.mid", "ui.window.title.right"];
  it("caps keep native size; only the declared middle repeats", () => {
    const { set } = rasterSet(ids);
    const [l, m, r] = ids.map((i) => set.get(i)) as [VerifiedRaster, VerifiedRaster, VerifiedRaster];
    const p = planThreeSlice(l, m, r, 100, 1);
    expect(p.pieces.map((x) => [x.assetId, x.x, x.width, x.repeatX, x.tileWidth])).toEqual([
      ["ui.window.title.left", 0, l.width, false, l.width],
      ["ui.window.title.mid", l.width, 100 - l.width - r.width, true, m.width],
      ["ui.window.title.right", 100 - r.width, r.width, false, r.width],
    ]);
    expect(planThreeSlice(l, m, r, 200, 2).pieces[0]?.width).toBe(l.width * 2);
  });
  it("needs three distinct declared parts of one group and room for both caps", () => {
    const { set } = rasterSet([...ids, "ui.window.body.mid"]);
    const [l, m, r] = ids.map((i) => set.get(i)) as [VerifiedRaster, VerifiedRaster, VerifiedRaster];
    expect(missingOf(() => planThreeSlice(l, l, r, 100))).toEqual([expect.objectContaining({ canonicalPath: "threeSlice" })]);
    expect(missingOf(() => planThreeSlice(m, l, r, 100))).toEqual([expect.objectContaining({ canonicalPath: "threeSlice" })]);
    expect(missingOf(() => planThreeSlice(l, set.get("ui.window.body.mid"), r, 100))).toEqual([expect.objectContaining({ reason: expect.stringContaining("different groups") as unknown })]);
    expect(missingOf(() => planThreeSlice(l, m, r, 5))).toEqual([expect.objectContaining({ canonicalPath: "width" })]);
  });
});

describe("RoButton", () => {
  const declared = { off: "ui.control.close.normal", hover: "ui.control.close.hover" } as const;
  it("each state selects its exact declared logical ID", () => {
    const { set } = rasterSet(Object.values(declared));
    expect(planButton(set, declared, "off").assetId).toBe("ui.control.close.normal");
    expect(planButton(set, declared, "hover").assetId).toBe("ui.control.close.hover");
    expect(planButton(rasterSet(["ui.menu.status.normal", "ui.menu.status.active"]).set, { off: "ui.menu.status.normal", on: "ui.menu.status.active" }, "on").assetId).toBe("ui.menu.status.active");
  });
  it("a missing declared state fails closed with its ID / container / path; undeclared states never fall back", () => {
    const { set } = rasterSet(["ui.control.close.normal"]);
    expect(missingOf(() => planButton(set, declared, "off"))).toEqual([expect.objectContaining({ assetId: "ui.control.close.hover", container: "data.grf", canonicalPath: whitelist.get("ui.control.close.hover").canonical_cp949_path })]);
    const full = rasterSet(Object.values(declared)).set;
    expect(missingOf(() => planButton(full, declared, "down"))).toEqual([expect.objectContaining({ canonicalPath: "button.down" })]);
    expect(missingOf(() => planButton(full, { off: "ui.control.close.hover" }, "off"))).toEqual([expect.objectContaining({ canonicalPath: "button.off" })]);
    const chrome = rasterSet(["ui.button.normal.mid", "ui.button.hover.mid", "ui.button.pressed.mid"]).set;
    const four = { off: "ui.button.normal.mid", hover: "ui.button.hover.mid", down: "ui.button.pressed.mid", disabled: "ui.button.disabled.mid" } as const;
    expect(missingOf(() => planButton(chrome, four, "off"))).toEqual([expect.objectContaining({ assetId: "ui.button.disabled.mid", canonicalPath: whitelist.get("ui.button.disabled.mid").canonical_cp949_path })]);
  });
});

describe("RoGauge", () => {
  const empty = ["ui.gauge.empty.left", "ui.gauge.empty.mid", "ui.gauge.empty.right"];
  const hp = ["ui.gauge.hp.left", "ui.gauge.hp.mid", "ui.gauge.hp.right"];
  it.each([[-0.5, 0, 0], [0, 0, 0], [0.37, 0.37, 37], [1, 1, 100], [2, 1, 100], [Number.NaN, 0, 0]])("ratio %s clamps to %s (clip %s px); only official gauge parts are visible", (ratio, clamped, clip) => {
    const { set } = rasterSet([...empty, ...hp]);
    const g = planGauge(empty.map((i) => set.get(i)) as [VerifiedRaster, VerifiedRaster, VerifiedRaster], hp.map((i) => set.get(i)) as [VerifiedRaster, VerifiedRaster, VerifiedRaster], ratio, 100);
    expect([g.ratio, g.clipWidth]).toEqual([clamped, clip]);
    expect([...g.back, ...g.fill].map((p) => p.assetId).sort()).toEqual([...empty, ...hp].sort());
  });
  it("a non-gauge part is rejected", () => {
    const { set } = rasterSet([...empty, ...hp, "ui.window.title.left"]);
    const fill = [set.get("ui.window.title.left"), set.get("ui.gauge.hp.mid"), set.get("ui.gauge.hp.right")] as [VerifiedRaster, VerifiedRaster, VerifiedRaster];
    expect(missingOf(() => planGauge(empty.map((i) => set.get(i)) as [VerifiedRaster, VerifiedRaster, VerifiedRaster], fill, 0.5, 100))).toEqual([expect.objectContaining({ canonicalPath: "gauge" })]);
  });
});

describe("RoSlot", () => {
  it("verified frame + verified icon; text-only count/hotkey adds no raster", () => {
    const { set } = rasterSet(["ui.slot.selection", "ui.skill.sm_bash.icon"]);
    const p = planSlot(set.get("ui.slot.selection"), set.get("ui.skill.sm_bash.icon"));
    expect(p.pieces.map((x) => x.assetId)).toEqual(["ui.slot.selection", "ui.skill.sm_bash.icon"]);
    expect(planSlot(set.get("ui.slot.selection"), null).pieces).toHaveLength(1);
    expect(missingOf(() => planSlot(set.get("ui.skill.sm_bash.icon"), null))).toEqual([expect.objectContaining({ canonicalPath: "slot.frame" })]);
    expect(missingOf(() => planSlot(set.get("ui.slot.selection"), set.get("ui.slot.selection")))).toEqual([expect.objectContaining({ canonicalPath: "slot.icon" })]);
    expect(missingOf(() => RoSlot({ rasters: set, frameId: "ui.slot.selection", iconId: "ui.skill.sm_magnum.icon" }))).toEqual([expect.objectContaining({ assetId: "ui.skill.sm_magnum.icon" })]);
  });
  it("components render only verified pieces (structural, synthetic)", () => {
    const ids = ["ui.window.title.left", "ui.window.title.mid", "ui.window.title.right", "ui.control.close.normal", "ui.gauge.empty.left", "ui.gauge.empty.mid", "ui.gauge.empty.right", "ui.gauge.sp.left", "ui.gauge.sp.mid", "ui.gauge.sp.right", "ui.slot.selection"];
    const { set } = rasterSet(ids);
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
  };
  it.each(FORBIDDEN.map((f) => f.family))("rejects %s", (family) => {
    expect(scanFormalVisual(bad[family] ?? "")).toContain(family);
  });
  it("accepts verified-raster positioning with nearest sampling", () => {
    expect(scanFormalVisual(`const s = { position: "absolute", backgroundImage: \`url("\${r.url}")\`, backgroundRepeat: "repeat-x", imageRendering: "pixelated", overflow: "hidden" };`)).toEqual([]);
  });

  const src = resolve(import.meta.dirname, "../src");
  it("the whole RO primitive dependency graph passes the guard", () => {
    const files = moduleGraph(join(src, "ui/ro/index.ts"));
    expect(files.map((f) => f.slice(src.length + 1))).toEqual(expect.arrayContaining(["ui/ro/index.ts", "ui/ro/primitives.tsx", "ui/ro/raster.ts"]));
    for (const f of files) expect(scanFormalVisual(readFileSync(f, "utf8")), f).toEqual([]);
  });

  it("the primitive library is unreachable from the shipped formal screen", () => {
    const files = moduleGraph(join(src, "main.tsx")).map((f) => f.slice(src.length + 1));
    expect(files).toContain("App.tsx");
    expect(files.filter((f) => f.startsWith("ui/ro/") || f === "game/formal/ui.ts")).toEqual([]);
    expect(dirname(join(src, "ui/ro/index.ts"))).toBe(join(src, "ui/ro"));
  });
});
