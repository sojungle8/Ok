import { BUILD_PROFILES, type BuildProfile } from "@ro-survivor/content-schema";

export interface ProfileGuardInput {
  profile: string | undefined;
  /** Contents of an explicit deployment-approval record, if one exists. */
  publicApprovalRecord?: string | undefined;
}

/**
 * fan-local is the default. fan-public must fail without an explicit approval record
 * (docs/product-plan/00-START-HERE.md "三個建置軌道").
 */
export function resolveBuildProfile(input: ProfileGuardInput): BuildProfile {
  const profile = input.profile === undefined || input.profile === "" ? "fan-local" : input.profile;
  if (!(BUILD_PROFILES as readonly string[]).includes(profile)) {
    throw new Error(`unknown build profile: ${profile}`);
  }
  if (profile === "fan-public") {
    const record = input.publicApprovalRecord?.trim() ?? "";
    if (!/^approved-by:\s*\S+/mu.test(record) || !/^approved-at:\s*\S+/mu.test(record)) {
      throw new Error("fan-public build requires an explicit deployment approval record (approved-by / approved-at)");
    }
  }
  return profile as BuildProfile;
}
