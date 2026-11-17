import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpAssetGatewayClient } from "@ro-survivor/asset-contracts";
import { whitelist } from "../src/gateway.ts";
import { loadFormalAssets } from "../src/game/assets.ts";
import { MissingAssetsError } from "../src/game/requirements.ts";

const SRC = "A".repeat(64);
const health = { ok: true, mode: "fan-local", buildId: "t", sourceHashes: { "data.grf": SRC, "rdata.grf": "B".repeat(64), bgm: "C".repeat(64) }, fixture: false };
const sheet = { atlas: { width: 1, height: 1 }, slots: {}, frames: [] };
const mapMeta = {
  gat: { width: 2, height: 2, types: "0000", cellHeights: [0, 0, 0, 0] },
  spawn: { x: 0, y: 0 },
  dependencies: { textures: ["유저인터페이스\\grass.bmp"], models: ["내부소품\\나무01.rsm"], sounds: [] },
};

/** A formal (non-fixture) gateway double: serves whitelist-sized bytes except for `missingIds`. */
function gatewayDouble(missingIds: string[]) {
  const fetchImpl = (url: string): Promise<Response> => {
    const path = new URL(url).pathname;
    if (path === "/health") return Promise.resolve(Response.json(health));
    const asset = /^\/v1\/assets\/(.+)$/u.exec(path)?.[1];
    if (asset) {
      const id = decodeURIComponent(asset);
      if (missingIds.includes(id)) return Promise.resolve(new Response(JSON.stringify({ error: "http-404" }), { status: 404 }));
      return Promise.resolve(new Response(new Uint8Array(whitelist.get(id).bytes), { headers: { "content-type": "application/octet-stream", "x-ro-source-sha256": SRC } }));
    }
    if (path.endsWith(".png")) return Promise.resolve(new Response(new Uint8Array([1]), { headers: { "content-type": "image/png" } }));
    if (path.endsWith("map.prt_fild08.gat.json")) return Promise.resolve(Response.json(mapMeta));
    return Promise.resolve(Response.json(sheet));
  };
  return new HttpAssetGatewayClient({ baseUrl: "http://127.0.0.1:4178", whitelist, fetch: fetchImpl });
}

beforeEach(() => {
  vi.stubGlobal("createImageBitmap", () => Promise.resolve({ width: 1, height: 1, close() {} }));
});
afterEach(() => vi.unstubAllGlobals());

describe("formal screen: only original RO assets, missing ones stop the game", () => {
  it("reports a missing source entry by canonical CP949 path and stops before loading anything else", async () => {
    const err = await loadFormalAssets(gatewayDouble(["monster.1002.spr"]), false).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MissingAssetsError);
    expect((err as MissingAssetsError).missing).toEqual([
      expect.objectContaining({ assetId: "monster.1002.spr", canonicalPath: "data\\sprite\\몬스터\\poring.spr", container: "data.grf" }),
    ]);
  });

  it("reports unwhitelisted map textures and models instead of substituting them", async () => {
    const err = await loadFormalAssets(gatewayDouble([]), false).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MissingAssetsError);
    expect((err as MissingAssetsError).missing.map((m) => m.canonicalPath)).toEqual([
      "data\\texture\\유저인터페이스\\grass.bmp",
      "data\\model\\내부소품\\나무01.rsm",
    ]);
  });

  it("only the test-fixture mode may tolerate the missing map dependencies", async () => {
    const assets = await loadFormalAssets(gatewayDouble([]), true);
    expect(assets.tolerated).toHaveLength(2);
    expect(assets.player.source).toBe("fan-local");
  });
});
