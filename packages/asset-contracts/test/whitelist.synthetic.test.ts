import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AssetWhitelist,
  canonicalPathToRequestUri,
  checkWhitelistRoundTrips,
  isPlaceholderBinary,
  parseCsv,
  PlaceholderAssetGateway,
  requestUriToCanonicalPath,
  resolveBuildProfile,
  UnknownAssetError,
} from "../src/index.ts";

const csv = readFileSync(new URL("../../../docs/product-plan/handoff/fan-local-asset-whitelist.csv", import.meta.url), "utf8");

describe("fan-local whitelist (handoff CSV, no GRF needed)", () => {
  const list = AssetWhitelist.fromCsv(csv);

  it("has 300 unique asset ids (canonical v5)", () => {
    expect(list.size).toBe(300);
  });

  it("pins the complete twelve-file official skill-effect source closure", () => {
    const effects = list.rows().filter((row) => row.category.startsWith("skill_effect_"));
    expect(effects).toHaveLength(12);
    expect(effects.every((row) => row.required === "true" && row.source_container === "data.grf" && row.sha256.length === 64)).toBe(true);
    expect(effects.map((row) => row.asset_id)).toContain("effect.skill.sw.magnum_break.explosion");
  });

  it("every CP949 raw hex and request URI round-trips to the canonical path", () => {
    expect(checkWhitelistRoundTrips(list)).toEqual([]);
  });

  it("keeps the documented naming traps (chocho, wilow)", () => {
    expect(list.get("monster.1011.spr").canonical_cp949_path).toBe("data\\sprite\\몬스터\\chocho.spr");
    expect(list.get("monster.1010.act").canonical_cp949_path).toBe("data\\sprite\\몬스터\\wilow.act");
  });

  it("covers ACT 2.4 and 2.5", () => {
    const versions = new Set(list.rows().map((r) => r.act_version).filter((v) => v !== ""));
    expect(versions).toContain("2.4");
    expect(versions).toContain("2.5");
  });
});

describe("request URI normalization", () => {
  it("round-trips and rejects traversal", () => {
    const uri = canonicalPathToRequestUri("data\\sprite\\몬스터\\poring.spr");
    expect(uri).toBe("/data/sprite/%EB%AA%AC%EC%8A%A4%ED%84%B0/poring.spr");
    expect(requestUriToCanonicalPath(uri)).toBe("data\\sprite\\몬스터\\poring.spr");
    expect(() => requestUriToCanonicalPath("/data/../secret")).toThrow();
    expect(() => requestUriToCanonicalPath("/data/%2E%2E/x")).toThrow();
    expect(() => requestUriToCanonicalPath("/data/a%5Cb")).toThrow();
    expect(() => canonicalPathToRequestUri("data\\..\\x")).toThrow();
  });
});

describe("PlaceholderAssetGateway", () => {
  const gw = new PlaceholderAssetGateway({ whitelist: AssetWhitelist.fromCsv(csv), buildId: "test-build" });

  it("works without network and reports placeholder mode", async () => {
    expect(gw.mode()).toBe("placeholder");
    await expect(gw.health()).resolves.toEqual({
      ok: true,
      mode: "placeholder",
      buildId: "test-build",
      sourceHashes: { "data.grf": null, "rdata.grf": null, bgm: null, system: null },
    });
    await expect(gw.getSourceHash("data.grf")).resolves.toBeNull();
  });

  it("serves only whitelisted ids and marks results as not real material", async () => {
    const bin = await gw.getBinary("monster.1002.spr");
    expect(isPlaceholderBinary(bin)).toBe(true);
    await expect(gw.getJson("monster.1002.act")).resolves.toMatchObject({ placeholder: true, realMaterial: false });
    await expect(gw.resolvePath("map.prt_fild08.gat")).resolves.toBe("placeholder://map.prt_fild08.gat");
    await expect(gw.getBinary("monster.9999.spr")).rejects.toBeInstanceOf(UnknownAssetError);
  });

  it("honours AbortSignal", async () => {
    const ac = new AbortController();
    ac.abort(new Error("cancelled"));
    await expect(gw.getBinary("monster.1002.spr", ac.signal)).rejects.toThrow("cancelled");
  });
});

describe("build profile guard", () => {
  it("defaults to fan-local and blocks fan-public without approval", () => {
    expect(resolveBuildProfile({ profile: undefined })).toBe("fan-local");
    expect(resolveBuildProfile({ profile: "original-fallback" })).toBe("original-fallback");
    expect(() => resolveBuildProfile({ profile: "fan-public" })).toThrow(/approval/u);
    expect(() => resolveBuildProfile({ profile: "fan-public", publicApprovalRecord: "approved-by: x" })).toThrow();
    expect(resolveBuildProfile({ profile: "fan-public", publicApprovalRecord: "approved-by: owner\napproved-at: 2027-01-01" })).toBe("fan-public");
    expect(() => resolveBuildProfile({ profile: "nope" })).toThrow(/unknown/u);
  });
});

describe("csv parser", () => {
  it("handles quotes, escaped quotes and CRLF", () => {
    expect(parseCsv('a,"b,c","d""e"\r\n1,2,3\n')).toEqual([["a", "b,c", 'd"e'], ["1", "2", "3"]]);
    expect(() => parseCsv('"open')).toThrow(/unterminated/u);
  });
});
