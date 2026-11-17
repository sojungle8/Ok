import type { SourceId } from "@ro-survivor/content-schema";

export type AssetSourceMode = "placeholder" | "fan-local";

export interface AssetGatewayHealth {
  ok: boolean;
  mode: AssetSourceMode;
  buildId: string;
  sourceHashes: Record<string, string | null>;
  /** True when the gateway serves synthetic test fixtures; the formal client must refuse it. */
  fixture?: boolean;
  /** `lockId` of the verified source lock the gateway serves. */
  lockId?: string;
  /** Identity of the ready derived manifest, or null when none is valid. */
  derived?: { converterVersion: number; lockId: string; whitelistSha256: string; uiProfileId: string; uiEntrySetSha256: string } | null;
}

/** Contract from docs/product-plan/09-GITHUB-CLOUD-WORKFLOW.md. */
export interface AssetGateway {
  mode(): AssetSourceMode;
  getBinary(assetId: string, signal?: AbortSignal): Promise<ArrayBuffer>;
  getJson<T>(assetId: string, signal?: AbortSignal): Promise<T>;
  resolvePath(assetId: string): Promise<string>;
  getSourceHash(sourceId: SourceId): Promise<string | null>;
  health(): Promise<AssetGatewayHealth>;
}
