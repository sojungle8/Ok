import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { skillVfxManifestSchema, type SkillVfxManifest } from "@ro-survivor/content-schema";

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex").toUpperCase();

function contained(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) && !isAbsolute(rel);
}

function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 24 || !signature.every((b, i) => bytes[i] === b)) return null;
  if (String.fromCharCode(...bytes.subarray(12, 16)) !== "IHDR") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function filesBelow(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (statSync(path).isDirectory()) out.push(...filesBelow(path));
    else out.push(path);
  }
  return out;
}

export interface SkillVfxValidation {
  manifest: SkillVfxManifest | null;
  errors: string[];
}

/** Fail-closed validation of the committed production registry and all files it names. */
export function validateSkillVfxManifest(repoRoot: string): SkillVfxValidation {
  const manifestPath = join(repoRoot, "assets/skill-vfx/manifest.json");
  if (!existsSync(manifestPath)) return { manifest: null, errors: ["missing assets/skill-vfx/manifest.json"] };
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (err) {
    return { manifest: null, errors: [`manifest is not valid JSON: ${String(err)}`] };
  }
  const parsed = skillVfxManifestSchema.safeParse(json);
  if (!parsed.success) return { manifest: null, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  const errors: string[] = [];
  const expectedOutputs = new Set(parsed.data.entries.map((e) => e.outputPath.replaceAll("\\", "/")));
  for (const entry of parsed.data.entries) {
    const path = resolve(repoRoot, entry.outputPath);
    const evidencePath = resolve(repoRoot, entry.rightsEvidenceRef);
    if (!contained(repoRoot, path)) errors.push(`${entry.assetId}: output escapes repository ${entry.outputPath}`);
    else if (!existsSync(path) || !statSync(path).isFile()) errors.push(`${entry.assetId}: missing output ${entry.outputPath}`);
    else {
      const bytes = readFileSync(path);
      if (sha256(bytes) !== entry.outputSha256.toUpperCase()) errors.push(`${entry.assetId}: output SHA-256 drift ${entry.outputPath}`);
      const size = pngSize(bytes);
      if (!size) errors.push(`${entry.assetId}: output is not a PNG with IHDR ${entry.outputPath}`);
      else if (size.width !== entry.presentation.nativeWidth || size.height !== entry.presentation.nativeHeight) {
        errors.push(`${entry.assetId}: PNG ${size.width}x${size.height} != declared ${entry.presentation.nativeWidth}x${entry.presentation.nativeHeight}`);
      }
    }
    if (!contained(repoRoot, evidencePath) || !existsSync(evidencePath)) errors.push(`${entry.assetId}: missing rights evidence ${entry.rightsEvidenceRef}`);
  }
  for (const path of filesBelow(join(repoRoot, "assets/skill-vfx/output"))) {
    const rel = relative(repoRoot, path).replaceAll("\\", "/");
    if (!expectedOutputs.has(rel)) errors.push(`unregistered skill VFX output ${rel}`);
  }
  return { manifest: parsed.data, errors };
}
