/**
 * Gateway network config. Loopback by default; any non-loopback bind requires an explicit
 * LAN profile naming the exact CIDR (docs/product-plan/03 "安全與隱私").
 */
export interface GatewayConfig {
  host: string;
  port: number;
  lanProfile: { cidr: string } | null;
}

const LOOPBACK = new Set(["127.0.0.1", "::1", "localhost"]);

export function isLoopbackHost(host: string): boolean {
  return LOOPBACK.has(host.trim().toLowerCase());
}

export function parseGatewayConfig(env: Record<string, string | undefined>): GatewayConfig {
  const host = (env.RO_ASSET_GATEWAY_HOST ?? "127.0.0.1").trim();
  const portText = (env.RO_ASSET_GATEWAY_PORT ?? "4178").trim();
  if (!/^\d+$/u.test(portText)) throw new Error("RO_ASSET_GATEWAY_PORT must be an integer");
  const port = Number(portText);
  if (port < 1024 || port > 65535) throw new Error("RO_ASSET_GATEWAY_PORT must be in 1024..65535");
  const cidr = env.RO_ASSET_GATEWAY_LAN_CIDR?.trim() ?? "";
  if (!isLoopbackHost(host)) {
    if (host === "0.0.0.0" || host === "::") throw new Error("binding to all interfaces is never allowed");
    if (!/^(10|172\.(1[6-9]|2\d|3[01])|192\.168)\.[\d.]+\/(\d|[12]\d|3[0-2])$/u.test(cidr)) {
      throw new Error("non-loopback host requires RO_ASSET_GATEWAY_LAN_CIDR with an explicit private CIDR");
    }
    return { host, port, lanProfile: { cidr } };
  }
  return { host, port, lanProfile: null };
}
