import { AssetWhitelist, connectAssetGateway, HttpAssetGatewayClient, PlaceholderAssetGateway, type AssetGateway } from "@ro-survivor/asset-contracts";
import whitelistCsv from "../../../docs/product-plan/handoff/fan-local-asset-whitelist.csv?raw";

export const whitelist = AssetWhitelist.fromCsv(whitelistCsv);

/**
 * Use the local fan-local gateway when VITE_ASSET_GATEWAY_URL is set (pnpm dev:fan-local);
 * otherwise, or when it is offline, the placeholder gateway with a visible reason.
 */
export async function createStartupGateway(buildId: string): Promise<AssetGateway & { reason?: string }> {
  const url = (import.meta.env.VITE_ASSET_GATEWAY_URL as string | undefined) ?? "";
  if (url === "") {
    return new PlaceholderAssetGateway({ whitelist, buildId, reason: "asset gateway 尚未連線（未設定 VITE_ASSET_GATEWAY_URL；本機請用 pnpm dev:fan-local）" });
  }
  return connectAssetGateway({ baseUrl: url, whitelist, buildId });
}

export function isHttpGateway(g: AssetGateway): g is HttpAssetGatewayClient {
  return g instanceof HttpAssetGatewayClient;
}
