import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isLicenseClassAllowed,
  isSkillVfxBuildReady,
  looksLikeAbsolutePath,
  skillVfxManifestEntrySchema,
  sourceLockExampleSchema,
} from "../src/index.ts";

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

describe("D-032 project-owned skill VFX provenance", () => {
  const approved = {
    assetId: "vfx.skill.sw.shield_wave.projectile",
    kind: "skill-vfx",
    sourceProfile: "original-fallback",
    sourceArchive: "project",
    sourcePath: "assets/skill-vfx/output/swordsman/shield-wave.png",
    companionPaths: [],
    sourceSha256: "2".repeat(64),
    owner: "Project owner",
    licenseClass: "original-project-owned",
    redistribution: "cleared",
    attribution: "Manual fan-game adaptation for this project",
    reviewedBy: "art-reviewer",
    reviewedAt: "2026-11-18T00:00:00Z",
    skillId: "skill.sw.shield_wave",
    purpose: "projectile",
    fanGameAdaptation: true,
    officialRoAsset: false,
    outputPath: "assets/skill-vfx/output/swordsman/shield-wave.png",
    outputSha256: "2".repeat(64),
    rightsEvidenceRef: "docs/product-plan/skill-vfx/swordsman/shield-wave.md",
    reproductionSteps: ["Open the editable source and export the named PNG without resampling."],
    provenance: {
      originalAuthor: "pixel-artist",
      commissionedBy: "Project owner",
      authoredAt: "2026-11-18T00:00:00Z",
      method: "manual-pixel-art",
      tool: "Aseprite",
      editableSourceRef: "external-art-archive:swordsman/shield-wave-v1",
      editableSourceSha256: "3".repeat(64),
      aiGenerated: false,
      derivedFromClosedSource: false,
    },
    presentation: {
      nativeWidth: 32,
      nativeHeight: 32,
      frameCount: 8,
      paletteColorCount: 24,
      sampling: "nearest-neighbor",
      scalePolicy: "integer-only",
    },
    styleReview: {
      pixelDensity: "approved",
      palette: "approved",
      silhouette: "approved",
      contrast: "approved",
      crowdReadability: "approved",
      nearestNeighbour: "approved",
    },
    reviewStatus: "approved",
  } as const;

  it("accepts a manually authored, reviewed skill-only effect", () => {
    expect(skillVfxManifestEntrySchema.parse(approved)).toEqual(approved);
    expect(isSkillVfxBuildReady(approved)).toBe(true);
  });

  it("rejects AI, closed-source copies, non-skill paths and non-RO presentation", () => {
    for (const patch of [
      { provenance: { ...approved.provenance, aiGenerated: true } },
      { provenance: { ...approved.provenance, derivedFromClosedSource: true } },
      { sourcePath: "assets/actors/swordsman.png" },
      { outputPath: "assets/actors/swordsman.png" },
      { purpose: "actor" },
      { presentation: { ...approved.presentation, sampling: "linear" } },
      { presentation: { ...approved.presentation, paletteColorCount: 256 } },
      { outputPath: "assets/skill-vfx/output/../../actors/swordsman.png" },
      { provenance: { ...approved.provenance, editableSourceRef: "external-art-archive:../other-project/art" } },
    ]) {
      expect(skillVfxManifestEntrySchema.safeParse({ ...approved, ...patch }).success).toBe(false);
    }
  });

  it("keeps drafts out of formal builds and requires complete approval metadata", () => {
    const draft = { ...approved, reviewStatus: "draft", reviewedBy: null, reviewedAt: null };
    expect(skillVfxManifestEntrySchema.safeParse(draft).success).toBe(false);
    expect(isSkillVfxBuildReady(draft)).toBe(false);
    expect(skillVfxManifestEntrySchema.safeParse({ ...approved, reviewedBy: null }).success).toBe(false);
    expect(skillVfxManifestEntrySchema.safeParse({ ...approved, sourceSha256: "0".repeat(64) }).success).toBe(false);
    expect(skillVfxManifestEntrySchema.safeParse({ ...approved, outputSha256: "0".repeat(64) }).success).toBe(false);
    expect(skillVfxManifestEntrySchema.safeParse({ ...approved, provenance: { ...approved.provenance, editableSourceSha256: "0".repeat(64) } }).success).toBe(false);
  });
});
