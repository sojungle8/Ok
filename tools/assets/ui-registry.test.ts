import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AssetWhitelist, CANONICAL_WHITELIST_SHA256, isUiRow, UI_ENTRY_SET_SHA256, UI_REGISTRY, UI_REGISTRY_COUNT } from "@ro-survivor/asset-contracts";

const root = resolve(import.meta.dirname, "../..");
const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex").toUpperCase();

describe("canonical UI registry (KRO2021_CLASSIC_V0_FAN)", () => {
  it("equals the 108 UI rows of the frozen v3 CSV and the current repo whitelist", () => {
    for (const f of ["fan-local-asset-whitelist-v3-282.csv", "fan-local-asset-whitelist.csv"]) {
      const bytes = readFileSync(join(root, "docs/product-plan/handoff", f));
      expect(sha(bytes), f).toBe(f.includes("v3-282") ? "63EA6798B842AA6DCC65B00E09D3BBD88AA74467BC75594B5A9490F0C5C6A4DB" : CANONICAL_WHITELIST_SHA256);
      const ui = AssetWhitelist.fromCsv(bytes.toString("utf8")).rows().filter(isUiRow).map((r) => [r.asset_id, r.category, r.source_container, r.canonical_cp949_path]);
      expect(ui, f).toEqual(UI_REGISTRY.map((e) => [...e]));
    }
    expect(UI_REGISTRY).toHaveLength(UI_REGISTRY_COUNT);
    expect(new Set(UI_REGISTRY.map((e) => e[0])).size).toBe(108);
    expect(sha(UI_REGISTRY.map((e) => e[0]).sort().join("\n"))).toBe(UI_ENTRY_SET_SHA256);
  });
});
