import { AssetWhitelist, GatewayError, HttpAssetGatewayClient, type AssetGatewayHealth } from "@ro-survivor/asset-contracts";
import whitelistCsv from "../../../docs/product-plan/handoff/fan-local-asset-whitelist.csv?raw";

export const whitelist = AssetWhitelist.fromCsv(whitelistCsv);

/**
 * Test-fixture builds (automated tests only) may talk to a synthetic gateway; formal builds never.
 * Set at compile time from the build mode only (`--mode fixture`), never from environment variables.
 */
export const FIXTURE_BUILD: boolean = typeof __FIXTURE_BUILD__ !== "undefined" && __FIXTURE_BUILD__;

export type GatewayConnection =
  | { ok: true; client: HttpAssetGatewayClient; health: AssetGatewayHealth }
  | { ok: false; reason: string; health: AssetGatewayHealth | null };

/**
 * Connect to the local fan-local gateway (VITE_ASSET_GATEWAY_URL, set by pnpm dev:fan-local).
 * There is no placeholder fallback: without the user's RO client the game does not start.
 */
export async function connectFormalGateway(): Promise<GatewayConnection> {
  const url = (import.meta.env.VITE_ASSET_GATEWAY_URL as string | undefined) ?? "";
  if (url === "") return { ok: false, reason: "未設定 asset gateway（請用 pnpm dev:fan-local 啟動，需本機 RO 客戶端）", health: null };
  try {
    const client = new HttpAssetGatewayClient({ baseUrl: url, whitelist, timeoutMs: 3_000 });
    const health = await client.health();
    if (health.fixture && !FIXTURE_BUILD) {
      return { ok: false, reason: "gateway 提供的是自動測試用 synthetic fixture，正式畫面拒絕使用", health };
    }
    return { ok: true, client, health };
  } catch (err) {
    const why = err instanceof GatewayError ? `${err.code}: ${err.message}` : String(err);
    return { ok: false, reason: `asset gateway 未連線（${why}）。請執行 pnpm dev:fan-local。`, health: null };
  }
}
