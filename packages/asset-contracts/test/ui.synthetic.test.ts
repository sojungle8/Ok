import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { uiReferenceMetricsSchema, uiReferenceProfileSchema, UI_PROFILE_COMPONENTS, type WhitelistRow } from "@ro-survivor/content-schema";
import { AssetWhitelist, checkUiProfileCompatibility, classifyUiAsset, declaredUiDimensions, formalUiRequiredIds, isUiRow, uiButtonStates, UI_PROFILE_ID } from "../src/index.ts";

const read = (rel: string) => readFileSync(new URL(`../../../${rel}`, import.meta.url), "utf8");
const list = AssetWhitelist.fromCsv(read("docs/product-plan/handoff/fan-local-asset-whitelist.csv"));
const uiRows = list.rows().filter(isUiRow);
const profile = uiReferenceProfileSchema.parse(JSON.parse(read("docs/product-plan/ui/KRO2021_CLASSIC_V0_FAN.profile.json")));
const metrics = uiReferenceMetricsSchema.parse(JSON.parse(read("docs/product-plan/ui/ui-reference-metrics.json")));

describe("RO UI contract (KRO2021_CLASSIC_V0_FAN)", () => {
  it("108 UI rows, all required; every bitmap declares its native size", () => {
    expect(uiRows).toHaveLength(108);
    expect(formalUiRequiredIds(list)).toHaveLength(108);
    const bmps = uiRows.filter((r) => r.canonical_cp949_path.toLowerCase().endsWith(".bmp"));
    expect(bmps).toHaveLength(104);
    expect(bmps.filter((r) => declaredUiDimensions(r.notes) === null).map((r) => r.asset_id)).toEqual([]);
  });

  it("profile compatibility: one profile, no foreign generation, no logical collision", () => {
    expect(checkUiProfileCompatibility(list.rows())).toEqual([]);
  });

  it("mixing a V5 menu_icon or minimap V2 control, or another profile tag, is rejected", () => {
    const base = uiRows[0] as WhitelistRow;
    const v5 = { ...base, asset_id: "ui.menu.v5.status", canonical_cp949_path: "data\\texture\\유저인터페이스\\menu_icon\\status.bmp" };
    const v2 = { ...base, asset_id: "ui.minimap.v2.zoom", canonical_cp949_path: "data\\texture\\유저인터페이스\\map\\i_zoomin.bmp", category: "ui_minimap" };
    const other = { ...base, asset_id: "ui.cursor.other", notes: "profile=KRO2019_RENEWAL; cursor" };
    const issues = checkUiProfileCompatibility([...list.rows(), v5, v2, other]);
    expect(issues.map((i) => i.assetId).sort()).toEqual(["ui.cursor.other", "ui.menu.v5.status", "ui.minimap.v2.zoom"]);
  });

  it("classifies roles, button states and three-part slices", () => {
    const c = (id: string) => classifyUiAsset(list.get(id));
    expect(c("ui.cursor.act")).toMatchObject({ role: "cursor", state: null });
    expect(c("ui.gauge.hp.mid")).toMatchObject({ role: "gauge", slice: { group: "ui.gauge.hp", part: "mid" } });
    expect(c("ui.button.pressed.left")).toMatchObject({ role: "button", state: "down", slice: { group: "ui.button.pressed", part: "left" } });
    expect(c("ui.menu.skill.active")).toMatchObject({ role: "button", state: "on" });
    expect(c("ui.control.close.hover")).toMatchObject({ role: "button", state: "hover" });
    expect(c("ui.skill.cr_shieldboomerang.icon")).toMatchObject({ role: "icon" });
    expect(c("ui.font.scdream6")).toMatchObject({ role: "font" });
  });

  it("every declared button state has its own source row (no CSS-derived states)", () => {
    const states = uiButtonStates(list);
    expect(states.get("ui.button.*.left")?.sort()).toEqual(["disabled", "down", "hover", "off"]);
    expect(states.get("ui.menu.status")?.sort()).toEqual(["off", "on"]);
    expect(states.get("ui.minimap.control.zoom_in")?.sort()).toEqual(["hover", "off"]);
    for (const [group, s] of states) expect(new Set(s).size, group).toBe(s.length);
  });

  it("reference profile is DISCOVERED (not LOCKED) and maps every UI row to a component", () => {
    expect(profile.profile_id).toBe(UI_PROFILE_ID);
    expect(profile.status).toBe("DISCOVERED");
    expect(Object.keys(profile.component_version_map).sort()).toEqual([...UI_PROFILE_COMPONENTS].sort());
    const mapped = new Set(Object.values(profile.component_version_map).flatMap((c) => c.assetIds));
    for (const id of mapped) expect(list.has(id), id).toBe(true);
    expect(uiRows.filter((r) => !mapped.has(r.asset_id)).map((r) => r.asset_id)).toEqual([]);
    expect(profile.capture_date).toBeNull();
  });

  it("reference metrics stay DEFERRED_LOCAL with null values; research hints are not targets", () => {
    expect(metrics.measurement).toBe("DEFERRED_LOCAL");
    expect(metrics.desktop1024x768.basicInfoExpanded.w).toBeNull();
    expect(metrics.researchHints.every((h) => h.status === "HINT_NOT_TARGET")).toBe(true);
    expect(uiReferenceMetricsSchema.safeParse({ ...metrics, measurement: "MEASURED" }).success).toBe(false);
  });
});
