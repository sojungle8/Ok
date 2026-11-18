import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { validateSkillVfxManifest } from "./vfx-manifest-lib.ts";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function png(width: number, height: number): Buffer {
  const out = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(out);
  out.writeUInt32BE(13, 8);
  out.write("IHDR", 12, "ascii");
  out.writeUInt32BE(width, 16);
  out.writeUInt32BE(height, 20);
  return out;
}

function fixture(): { root: string; manifest: Record<string, unknown>; output: string } {
  const root = mkdtempSync(join(tmpdir(), "ro-skill-vfx-"));
  roots.push(root);
  for (const dir of ["assets/skill-vfx/output/sw", "docs/product-plan/skill-vfx/sw"]) mkdirSync(join(root, dir), { recursive: true });
  const output = png(32, 32);
  writeFileSync(join(root, "assets/skill-vfx/output/sw/wave.png"), output);
  writeFileSync(join(root, "docs/product-plan/skill-vfx/sw/wave.md"), "evidence");
  const entry = {
    assetId: "vfx.skill.sw.shield_wave.projectile", kind: "skill-vfx", sourceProfile: "original-fallback", sourceArchive: "project",
    sourcePath: "assets/skill-vfx/output/sw/wave.png", companionPaths: [], sourceSha256: createHash("sha256").update(output).digest("hex"), owner: "Project owner",
    licenseClass: "original-project-owned", redistribution: "cleared", attribution: "Manual fan-game adaptation", reviewedBy: "reviewer", reviewedAt: "2026-11-18T00:00:00Z",
    skillId: "skill.sw.shield_wave", purpose: "projectile", fanGameAdaptation: true, officialRoAsset: false,
    outputPath: "assets/skill-vfx/output/sw/wave.png", outputSha256: createHash("sha256").update(output).digest("hex"), rightsEvidenceRef: "docs/product-plan/skill-vfx/sw/wave.md",
    reproductionSteps: ["Export without resampling"],
    provenance: { originalAuthor: "artist", commissionedBy: "Project owner", authoredAt: "2026-11-18T00:00:00Z", method: "manual-pixel-art", tool: "Aseprite", editableSourceRef: "external-art-archive:sw/wave-v1", editableSourceSha256: "3".repeat(64), aiGenerated: false, derivedFromClosedSource: false },
    presentation: { nativeWidth: 32, nativeHeight: 32, frameCount: 8, paletteColorCount: 24, sampling: "nearest-neighbor", scalePolicy: "integer-only" },
    styleReview: { pixelDensity: "approved", palette: "approved", silhouette: "approved", contrast: "approved", crowdReadability: "approved", nearestNeighbour: "approved" }, reviewStatus: "approved",
  };
  const manifest = { schemaVersion: 1, entries: [entry] };
  writeFileSync(join(root, "assets/skill-vfx/manifest.json"), JSON.stringify(manifest));
  return { root, manifest, output: join(root, "assets/skill-vfx/output/sw/wave.png") };
}

describe("skill VFX production manifest", () => {
  it("accepts exact approved source, output and evidence", () => {
    const f = fixture();
    expect(validateSkillVfxManifest(f.root).errors).toEqual([]);
  });

  it("fails closed on drift and unregistered output", () => {
    const f = fixture();
    writeFileSync(f.output, "changed");
    writeFileSync(join(f.root, "assets/skill-vfx/output/sw/unregistered.png"), "x");
    expect(validateSkillVfxManifest(f.root).errors).toEqual(expect.arrayContaining([
      expect.stringMatching(/output SHA-256 drift/u),
      expect.stringMatching(/unregistered skill VFX output/u),
    ]));
  });

  it("rejects an AI or closed-source provenance claim before reading files", () => {
    const f = fixture();
    const manifest = f.manifest as { entries: { provenance: Record<string, unknown> }[] };
    manifest.entries[0]!.provenance.aiGenerated = true;
    manifest.entries[0]!.provenance.derivedFromClosedSource = true;
    writeFileSync(join(f.root, "assets/skill-vfx/manifest.json"), JSON.stringify(manifest));
    expect(validateSkillVfxManifest(f.root).errors.join("\n")).toMatch(/aiGenerated|derivedFromClosedSource/u);
  });
});
