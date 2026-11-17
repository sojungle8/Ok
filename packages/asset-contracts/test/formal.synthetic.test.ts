import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AssetWhitelist, dependencyCanonicalPath, formalRequiredIds, missingFromWhitelist, resolveMapClosure, type MapReferences } from "../src/index.ts";

const csv = readFileSync(new URL("../../../docs/product-plan/handoff/fan-local-asset-whitelist.csv", import.meta.url), "utf8");
const list = AssetWhitelist.fromCsv(csv);
const strip = (prefix: string) => (p: string) => p.slice(prefix.length);

/** References exactly as GND / RSW / RSM store them, rebuilt from the whitelist's closure rows. */
function referencesFromWhitelist(): MapReferences {
  const rows = list.rows();
  const by = (c: string) => rows.filter((r) => r.category === c).map((r) => r.canonical_cp949_path);
  return {
    groundTextures: by("map_ground_texture").map(strip("data\\texture\\")),
    models: by("map_model").map(strip("data\\model\\")),
    modelTextures: by("map_model_texture").map(strip("data\\texture\\")),
    sounds: by("map_ambient_sound").map(strip("data\\wav\\")),
    waterType: 1,
  };
}

describe("formal scene contract (canonical v2 whitelist)", () => {
  it("whitelist v2: 174 rows, 173 GRF + 1 BGM, unique paths", () => {
    expect(list.size).toBe(174);
    expect(list.rows().filter((r) => r.raw_name_hex !== "")).toHaveLength(173);
  });

  it("formal required set resolves completely: missing = 0", () => {
    const ids = formalRequiredIds(list);
    expect(missingFromWhitelist(list, ids)).toEqual([]);
    expect(ids).toContain("bgm.prt_fild08");
    expect(ids).toContain("common.shadow.act");
    expect(ids.filter((i) => i.startsWith("map.prt_fild08.ambient_sound"))).toHaveLength(4);
    const closure = resolveMapClosure(list, referencesFromWhitelist());
    expect(closure.missing).toEqual([]);
    expect(closure.ids).toHaveLength(21 + 23 + 44 + 4 + 32);
  });

  it("path lookup ignores ASCII case and separators", () => {
    expect(list.idForCanonicalPath("DATA/TEXTURE/워터/WATER100.JPG")).toBe("map.prt_fild08.water_texture.001");
    expect(list.idForCanonicalPath(dependencyCanonicalPath("model", "프론테라/성_성벽.rsm"))).toBe("map.prt_fild08.model.001");
    expect(list.idForCanonicalPath("data\\texture\\nope.bmp")).toBeNull();
  });

  it("removing any one row reports exactly that asset's canonical path", () => {
    const refs = referencesFromWhitelist();
    for (const victim of list.rows().filter((r) => r.category.startsWith("map_") && r.category !== "map_world" && r.category !== "map_ground" && r.category !== "map_collision")) {
      const reduced = new AssetWhitelist(list.rows().filter((r) => r.asset_id !== victim.asset_id));
      const res = resolveMapClosure(reduced, refs);
      expect(res.missing.map((m) => m.canonicalPath)).toEqual([victim.canonical_cp949_path]);
    }
    const noShadow = new AssetWhitelist(list.rows().filter((r) => r.asset_id !== "common.shadow.spr"));
    expect(missingFromWhitelist(noShadow, formalRequiredIds(list)).map((m) => m.assetId)).toEqual(["common.shadow.spr"]);
  });
});
