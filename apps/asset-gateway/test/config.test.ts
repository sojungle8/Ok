import { describe, expect, it } from "vitest";
import { parseGatewayConfig } from "../src/index.ts";

describe("gateway config", () => {
  it("defaults to loopback 127.0.0.1:4178", () => {
    expect(parseGatewayConfig({})).toEqual({ host: "127.0.0.1", port: 4178, lanProfile: null });
  });
  it("refuses non-loopback without an explicit private LAN CIDR", () => {
    expect(() => parseGatewayConfig({ RO_ASSET_GATEWAY_HOST: "192.168.1.5" })).toThrow(/LAN_CIDR/u);
    expect(() => parseGatewayConfig({ RO_ASSET_GATEWAY_HOST: "0.0.0.0", RO_ASSET_GATEWAY_LAN_CIDR: "192.168.1.0/24" })).toThrow(/all interfaces/u);
    expect(() => parseGatewayConfig({ RO_ASSET_GATEWAY_HOST: "203.0.113.4", RO_ASSET_GATEWAY_LAN_CIDR: "203.0.113.0/24" })).toThrow();
    expect(parseGatewayConfig({ RO_ASSET_GATEWAY_HOST: "192.168.1.5", RO_ASSET_GATEWAY_LAN_CIDR: "192.168.1.0/24" }).lanProfile).toEqual({ cidr: "192.168.1.0/24" });
  });
  it("validates the port", () => {
    expect(() => parseGatewayConfig({ RO_ASSET_GATEWAY_PORT: "80" })).toThrow();
    expect(() => parseGatewayConfig({ RO_ASSET_GATEWAY_PORT: "abc" })).toThrow();
  });
});
