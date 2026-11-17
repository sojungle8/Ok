import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isLicenseClassAllowed, looksLikeAbsolutePath, sourceLockExampleSchema } from "../src/index.ts";

describe("source lock example", () => {
  const raw = readFileSync(new URL("../../../assets/source-lock.example.json", import.meta.url), "utf8");

  it("matches the schema and the canonical hashes in 02-ASSET-AND-RIGHTS-PLAN", () => {
    const lock = sourceLockExampleSchema.parse(JSON.parse(raw));
    expect(lock.sources["data.grf"].sha256).toBe("FA3B7BBDBD650C3468ECA5E978A44E7A848D533F2735E6F5AF2B668E1D1DC3B6");
    expect(lock.sources["rdata.grf"].sha256).toBe("FA6367B8ABC5D1297DE742A127CFF4E1DA626AB3D6B1B0A81BA563CB3CB5124E");
  });

  it("contains no absolute paths", () => {
    const strings: string[] = [];
    JSON.parse(raw, (_k, v: unknown) => {
      if (typeof v === "string") strings.push(v);
      return v;
    });
    expect(strings.filter(looksLikeAbsolutePath)).toEqual([]);
    expect(raw).not.toMatch(/C:\\\\|Users|Downloads/u);
  });
});

describe("absolute path detector", () => {
  it("detects windows, unc and posix", () => {
    expect(looksLikeAbsolutePath("C:\\Users\\x")).toBe(true);
    expect(looksLikeAbsolutePath("\\\\server\\share")).toBe(true);
    expect(looksLikeAbsolutePath("/home/x")).toBe(true);
    expect(looksLikeAbsolutePath("data\\sprite\\x.spr")).toBe(false);
  });
});

describe("license classes", () => {
  it("never allows unknown-quarantine and keeps local-fan-use out of public builds", () => {
    for (const p of ["fan-local", "fan-public", "original-fallback"] as const) {
      expect(isLicenseClassAllowed(p, "unknown-quarantine")).toBe(false);
    }
    expect(isLicenseClassAllowed("fan-local", "local-fan-use")).toBe(true);
    expect(isLicenseClassAllowed("fan-public", "local-fan-use")).toBe(false);
    expect(isLicenseClassAllowed("original-fallback", "public-use-cleared")).toBe(false);
  });
});
