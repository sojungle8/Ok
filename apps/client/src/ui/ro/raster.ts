/**
 * UI-B2 — public, read-only side of verified raster handles. Handles are minted only by the UI loader
 * (`game/formal/rasterMint.ts`, loader-only); this module exposes the handle / registry interfaces and
 * the brand check, never an issuer or a constructible set.
 */
import { UI_REGISTRY } from "@ro-survivor/asset-contracts";
import type { UiManifestEntry } from "@ro-survivor/content-schema";
import { MissingAssetsError } from "../../game/requirements.ts";
import { isMintedRaster } from "../../game/formal/rasterMint.ts";

export const RO_PRIMITIVES_MODULE_MARKER = "RO-SURVIVOR-DETACHED-RO-PRIMITIVES";

export interface VerifiedRaster {
  readonly assetId: string;
  readonly width: number;
  readonly height: number;
  /** Exact, recursively frozen copy of the UI-A manifest entry. */
  readonly entry: Readonly<UiManifestEntry>;
  /** Object URL owned by this handle; throws once disposed. */
  readonly url: string;
  readonly disposed: boolean;
}

/** Read-only lifecycle-owned set of verified rasters (minted by the loader). */
export interface RasterRegistry {
  get(assetId: string): VerifiedRaster;
  has(assetId: string): boolean;
  ids(): string[];
  readonly disposed: boolean;
  dispose(): void;
}

/** True only for live-or-disposed handles minted by the UI loader (not look-alike objects). */
export function isVerifiedRaster(x: unknown): x is VerifiedRaster {
  return isMintedRaster(x);
}

/** Missing / unknown / disposed logical ID → blocking error with the canonical registry container and path. */
export function missingRaster(assetId: string, reason: string): MissingAssetsError {
  const reg = UI_REGISTRY.find((e) => e[0] === assetId);
  return new MissingAssetsError([{ assetId, container: reg?.[2] ?? "unknown", canonicalPath: reg?.[3] ?? "(not in the canonical UI registry)", reason }]);
}
