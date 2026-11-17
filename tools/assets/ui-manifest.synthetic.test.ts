import { readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AssetWhitelist } from "@ro-survivor/asset-contracts";
import { createAssetReader } from "@ro-survivor/asset-gateway";
import { uiManifestSchema } from "@ro-survivor/content-schema";
import { createTempDir } from "@ro-survivor/testkit";
import { buildSyntheticSources } from "./synthetic-sources.ts";
import { buildUiManifest } from "./ui-manifest-lib.ts";

const repoRoot = resolve(import.meta.dirname, "../..");
const realRows = AssetWhitelist.fromCsv(readFileSync(join(repoRoot, "docs/product-plan/handoff/fan-local-asset-whitelist.csv"), "utf8")).rows();
const cleanups: (() => void)[] = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

function setup() {
  const d = createTempDir("ui-manifest-");
  cleanups.push(() => d.dispose());
  const src = buildSyntheticSources(join(d.root, "src"), realRows);
  const reader = createAssetReader(src.lock);
  cleanups.push(() => reader.close());
  return { ...src, reader, root: d.root };
}
const meta = { lockId: "synthetic", whitelistSha256: "A".repeat(64) };

describe("assets:ui-manifest (synthetic structural fixture)", () => {
  it("108 UI entries, schema-valid, native sizes equal the declared sizes, cursor hotspots in bounds", () => {
    const { rows, reader } = setup();
    const { manifest, report } = buildUiManifest(rows, reader, meta);
    expect(report.issues).toEqual([]);
    expect(uiManifestSchema.parse(manifest).entries).toHaveLength(108);
    const e = (id: string) => manifest.entries.find((x) => x.logical_asset_id === id);
    expect(e("ui.hud.basic.background")).toMatchObject({ format: "bmp", native_width: 280, native_height: 120, transparent_key_or_alpha_mode: "magenta-key" });
    expect(e("ui.cursor.act")?.cursor_hotspot_or_null).toHaveLength(14);
    expect(e("ui.cursor.act")?.cursor_hotspot_or_null?.[0]).toEqual({ action: 0, x: 2, y: 3 });
    expect(e("ui.font.scdream4")).toMatchObject({ format: "otf", source_container: "filesystem:System" });
    expect(Object.values(report.categories).reduce((a, c) => a + c.found, 0)).toBe(108);
  });

  it("a native size that differs from the declared size is reported with its canonical path", () => {
    const { rows, reader } = setup();
    const tampered = rows.map((r) => (r.asset_id === "ui.arrow.left" ? { ...r, notes: r.notes.replace("11x11", "12x11") } : r));
    const { manifest, report } = buildUiManifest(tampered, reader, meta);
    expect(manifest.entries).toHaveLength(107);
    expect(report.issues).toEqual([expect.objectContaining({ assetId: "ui.arrow.left", canonicalPath: "data\\texture\\유저인터페이스\\basic_interface\\arw_left.bmp", issue: expect.stringContaining("12x11") as unknown })]);
  });

  it("a missing System font is reported as missing, never substituted by an OS font", () => {
    const { rows, lock, root } = setup();
    rmSync(join(root, "src", "System", "Font", "SCDream6.otf"));
    const reader = createAssetReader(lock);
    cleanups.push(() => reader.close());
    const { report } = buildUiManifest(rows, reader, meta);
    expect(report.issues.map((i) => [i.assetId, i.container, i.canonicalPath])).toEqual([["ui.font.scdream6", "filesystem:System", "System\\Font\\SCDream6.otf"]]);
    expect(report.categories.ui_font).toEqual({ found: 1, missing: 1, ambiguous: 0 });
  });
});
