import { AssetWhitelist, PlaceholderAssetGateway, type AssetGateway } from "@ro-survivor/asset-contracts";
import whitelistCsv from "../../../docs/product-plan/handoff/fan-local-asset-whitelist.csv?raw";

/**
 * Phase 0: there is no network gateway client yet, so the app always starts on the
 * placeholder gateway and reports that the fan-local asset gateway is not connected.
 */
export function createStartupGateway(buildId: string): PlaceholderAssetGateway & AssetGateway {
  return new PlaceholderAssetGateway({
    whitelist: AssetWhitelist.fromCsv(whitelistCsv),
    buildId,
    reason: "asset gateway 尚未連線（Phase 0 未實作本機 gateway；使用 placeholder）",
  });
}
