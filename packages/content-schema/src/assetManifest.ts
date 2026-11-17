import { z } from "zod";

export const LICENSE_CLASSES = [
  "project-code-gpl-3.0",
  "third-party-permissive",
  "local-fan-use",
  "public-use-cleared",
  "original-project-owned",
  "unknown-quarantine",
] as const;
export type LicenseClass = (typeof LICENSE_CLASSES)[number];

export const BUILD_PROFILES = ["fan-local", "fan-public", "original-fallback"] as const;
export type BuildProfile = (typeof BUILD_PROFILES)[number];

export const assetManifestEntrySchema = z.object({
  assetId: z.string().min(1),
  kind: z.string().min(1),
  sourceProfile: z.enum(BUILD_PROFILES),
  sourceArchive: z.string().min(1),
  sourcePath: z.string().min(1),
  companionPaths: z.array(z.string()),
  sourceSha256: z.string(),
  owner: z.string().min(1),
  licenseClass: z.enum(LICENSE_CLASSES),
  redistribution: z.enum(["not-cleared", "cleared"]),
  attribution: z.string(),
  reviewedBy: z.string().nullable(),
  reviewedAt: z.string().nullable(),
});
export type AssetManifestEntry = z.infer<typeof assetManifestEntrySchema>;

const allowedByProfile: Record<BuildProfile, readonly LicenseClass[]> = {
  "fan-local": ["project-code-gpl-3.0", "third-party-permissive", "local-fan-use", "public-use-cleared", "original-project-owned"],
  "fan-public": ["project-code-gpl-3.0", "third-party-permissive", "public-use-cleared", "original-project-owned"],
  "original-fallback": ["project-code-gpl-3.0", "third-party-permissive", "original-project-owned"],
};

/** `unknown-quarantine` never enters any build; `local-fan-use` only enters fan-local. */
export function isLicenseClassAllowed(profile: BuildProfile, licenseClass: LicenseClass): boolean {
  return allowedByProfile[profile].includes(licenseClass);
}
