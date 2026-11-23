import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpAssetGatewayClient } from "@ro-survivor/asset-contracts";
import { whitelist } from "../src/gateway.ts";
import { loadFormalAssets } from "../src/game/assets.ts";
import { MissingAssetsError } from "../src/game/requirements.ts";

const SRC = "A".repeat(64);
const health = { ok: true, mode: "fan-local", buildId: "t", sourceHashes: { "data.grf": SRC, "rdata.grf": "B".repeat(64), bgm: "C".repeat(64) }, fixture: false };
const sheet = { atlas: { width: 1, height: 1 }, slots: {}, frames: [] };
const layer = (spr: string, palette: string | null) => ({ spr: `${spr}.spr`, act: `${spr}.act`, palette });
/** Extractor v2 player atlas: all four layer sets, original palettes, per-direction draw order. */
const playerSheet = {
  ...sheet,
  layers: [layer("player.swordsman.male.body", "palette.body.swordsman.male"), layer("player.hair01.male", "palette.hair01.male"), layer("player.swordsman.male.sword", null), layer("player.swordsman.male.guard", null)],
  layerOrder: Array.from({ length: 8 }, (_, d) => (d >= 3 && d <= 5 ? [2, 3, 0, 1] : [0, 1, 2, 3])),
};
const strip = (category: string, prefix: string) =>
  whitelist.rows().filter((r) => r.category === category).map((r) => r.canonical_cp949_path.slice(prefix.length));
/** The real prt_fild08 references (names taken from the v2 whitelist rows), plus optional extras. */
function mapMeta(extra: { textures?: string[]; models?: string[] } = {}) {
  return {
    gat: { width: 2, height: 2, types: "0000", cellHeights: [0, 0, 0, 0] },
    spawn: { x: 0, y: 0 },
    dependencies: {
      textures: [...strip("map_ground_texture", "data\\texture\\"), ...(extra.textures ?? [])],
      models: [...strip("map_model", "data\\model\\"), ...(extra.models ?? [])],
      sounds: strip("map_ambient_sound", "data\\wav\\"),
      waterType: 1,
    },
  };
}

/** A formal (non-fixture) gateway double: serves whitelist-sized bytes except for `missingIds`. */
function gatewayDouble(missingIds: string[], meta = mapMeta(), player: object = playerSheet) {
  const fetchImpl = (url: string): Promise<Response> => {
    const path = new URL(url).pathname;
    if (path === "/health") return Promise.resolve(Response.json(health));
    const asset = /^\/v1\/assets\/(.+)$/u.exec(path)?.[1];
    if (asset) {
      const id = decodeURIComponent(asset);
      if (missingIds.includes(id)) return Promise.resolve(new Response(JSON.stringify({ error: "http-404" }), { status: 404 }));
      return Promise.resolve(new Response(new Uint8Array(whitelist.get(id).bytes), { headers: { "content-type": "application/octet-stream", "content-length": String(whitelist.get(id).bytes), "x-ro-source-sha256": SRC } }));
    }
    if (path.endsWith(".png")) return Promise.resolve(new Response(new Uint8Array([1]), { headers: { "content-type": "image/png" } }));
    if (path.endsWith("map.prt_fild08.gat.json")) return Promise.resolve(Response.json(meta));
    if (path.endsWith("player.swordsman.male.body.act.json")) return Promise.resolve(Response.json(player));
    if (path.endsWith("map.prt_fild08.rsw.json")) return Promise.resolve(new Response(JSON.stringify({ error: "http-404" }), { status: 404 }));
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

  it("v3 whitelist resolves the whole closure; the formal run then requires the derived scene contract (no substitute)", async () => {
    const err = await loadFormalAssets(gatewayDouble([]), false).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MissingAssetsError);
    expect((err as MissingAssetsError).missing).toEqual([
      expect.objectContaining({ assetId: "map.prt_fild08.rsw", canonicalPath: "data\\prt_fild08.rsw", reason: expect.stringContaining("derived scene unavailable") as unknown }),
    ]);
  });

  it("a body-only player atlas is never drawn: hair, sword and guard layers are reported", async () => {
    const err = await loadFormalAssets(gatewayDouble([], mapMeta(), sheet), false).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MissingAssetsError);
    expect((err as MissingAssetsError).missing.map((m) => m.assetId)).toEqual([
      "player.swordsman.male.body.spr", "player.hair01.male.spr", "player.swordsman.male.sword.spr", "player.swordsman.male.guard.spr", "player.swordsman.male.body.act",
    ]);
  });

  it.each(["map.prt_fild08.ground_texture.001", "common.shadow.act", "bgm.prt_fild08", "ui.cursor.act", "ui.hud.basic.background", "ui.font.scdream4"])(
    "a single missing source %s is reported alone",
    async (id) => {
      const err = await loadFormalAssets(gatewayDouble([id]), false).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(MissingAssetsError);
      expect((err as MissingAssetsError).missing.map((m) => m.assetId)).toEqual([id]);
    },
  );

  it("a map reference without a whitelist row is reported by canonical path only", async () => {
    const meta = mapMeta({ textures: ["유저인터페이스\\grass.bmp"], models: ["내부소품\\나무01.rsm"] });
    const err = await loadFormalAssets(gatewayDouble([], meta), false).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MissingAssetsError);
    expect((err as MissingAssetsError).missing).toEqual([
      expect.objectContaining({ assetId: null, canonicalPath: "data\\texture\\유저인터페이스\\grass.bmp" }),
      expect.objectContaining({ assetId: null, canonicalPath: "data\\model\\내부소품\\나무01.rsm" }),
    ]);
  });

  it("only the test-fixture mode may tolerate unresolved map dependencies", async () => {
    const meta = mapMeta({ textures: ["유저인터페이스\\grass.bmp"], models: ["내부소품\\나무01.rsm"] });
    const assets = await loadFormalAssets(gatewayDouble([], meta), true);
    expect(assets.tolerated).toHaveLength(2);
    expect(assets.player.source).toBe("fan-local");
    expect(Object.keys(assets.enemies)).toHaveLength(12);
  });
});
