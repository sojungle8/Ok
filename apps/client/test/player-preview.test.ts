import { describe, expect, it } from "vitest";
import { whitelist } from "../src/gateway.ts";
import { FORMAL_PLAYER_PREVIEW_SOURCE_IDS, loadFormalPlayerPreview, planPlayerPreviewFrame, type PlayerPreviewGatewayLike } from "../src/game/formal/playerPreview.tsx";
import { MissingAssetsError } from "../src/game/requirements.ts";
import type { SheetData } from "../src/game/sprites.ts";

const bytes = Uint8Array.from([1, 2, 3, 4, 5]);
const layer = (spr: string, palette: string | null) => ({ spr: `${spr}.spr`, act: `${spr}.act`, palette });

async function sha(value: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", value as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join("").toUpperCase();
}

async function data(): Promise<SheetData> {
  return {
    atlas: { width: 64, height: 100, sha256: await sha(bytes) },
    slots: {
      idle: { directions: [{ frames: [0, 1], delayMs: 100 }] },
      walk: { directions: [] }, attack: { directions: [] }, hit: { directions: [] }, death: { directions: [] }, cast: { directions: [] },
    },
    frames: [
      { x: 0, y: 0, w: 30, h: 90, originX: 15, originY: 80, flipX: false },
      { x: 30, y: 0, w: 32, h: 92, originX: 16, originY: 81, flipX: false },
    ],
    layers: [
      layer("player.swordsman.male.body", "palette.body.swordsman.male"),
      layer("player.hair01.male", "palette.hair01.male"),
      layer("player.swordsman.male.sword", null),
      layer("player.swordsman.male.guard", null),
    ],
    layerOrder: Array.from({ length: 8 }, (_, direction) => direction >= 3 && direction <= 5 ? [2, 3, 0, 1] : [0, 1, 2, 3]),
  };
}

function gateway(sheet: SheetData, fail = ""): PlayerPreviewGatewayLike & { checked: string[] } {
  const checked: string[] = [];
  return {
    checked,
    checkSource(id) {
      checked.push(id);
      return id === fail ? Promise.reject(new Error("missing")) : Promise.resolve();
    },
    getJson: <T,>() => Promise.resolve(sheet as T),
    getDerivedImage: () => Promise.resolve(bytes),
  };
}

const decoder = { image: () => Promise.resolve({ width: 64, height: 100, close() {} }) };

describe("formal four-layer Swordsman pre-run preview", () => {
  it("loads only the ten actor sources, validates the atlas, animates original idle frames and revokes its URL", async () => {
    const g = gateway(await data());
    const revoked: string[] = [];
    const preview = await loadFormalPlayerPreview(g, decoder, whitelist, {
      createObjectURL: () => "blob:verified-swordsman",
      revokeObjectURL: (url) => { revoked.push(url); },
    });
    expect(g.checked.sort()).toEqual([...FORMAL_PLAYER_PREVIEW_SOURCE_IDS].sort());
    expect(planPlayerPreviewFrame(preview, 0)).toMatchObject({ frameIndex: 0, left: 33, top: 15, width: 30, height: 90, backgroundX: 0, backgroundY: 0 });
    expect(planPlayerPreviewFrame(preview, 1)).toMatchObject({ frameIndex: 1, left: 32, top: 14, width: 32, height: 92, backgroundX: -30, backgroundY: 0 });
    preview.dispose();
    preview.dispose();
    expect(revoked).toEqual(["blob:verified-swordsman"]);
    expect(() => planPlayerPreviewFrame(preview, 0)).toThrow(/disposed/u);
  });

  it("reports an unavailable overlay source by its canonical CP949 path", async () => {
    const id = "player.swordsman.male.guard.act";
    const err = await loadFormalPlayerPreview(gateway(await data(), id), decoder, whitelist).catch((reason: unknown) => reason);
    expect(err).toBeInstanceOf(MissingAssetsError);
    expect((err as MissingAssetsError).missing).toEqual([
      expect.objectContaining({ assetId: id, canonicalPath: whitelist.get(id).canonical_cp949_path }),
    ]);
  });

  it("rejects body-only metadata and a drifted derived atlas hash", async () => {
    const bodyOnly = await data();
    bodyOnly.layers = bodyOnly.layers?.slice(0, 1);
    const layerError = await loadFormalPlayerPreview(gateway(bodyOnly), decoder, whitelist).catch((reason: unknown) => reason);
    expect(layerError).toBeInstanceOf(MissingAssetsError);
    expect((layerError as MissingAssetsError).missing.map((item) => item.assetId)).toEqual(expect.arrayContaining([
      "player.hair01.male.spr", "player.swordsman.male.sword.spr", "player.swordsman.male.guard.spr",
    ]));

    const drifted = await data();
    drifted.atlas.sha256 = "0".repeat(64);
    const hashError = await loadFormalPlayerPreview(gateway(drifted), decoder, whitelist).catch((reason: unknown) => reason);
    expect(hashError).toBeInstanceOf(MissingAssetsError);
    expect((hashError as MissingAssetsError).missing).toEqual([
      expect.objectContaining({ assetId: "player.swordsman.male.body.spr", reason: expect.stringContaining("SHA-256") as unknown }),
    ]);
  });

  it("fails closed when an original idle frame would be clipped by the preview viewport", async () => {
    const clipped = await data();
    const first = clipped.frames[0];
    if (first) first.originY = 0;
    const err = await loadFormalPlayerPreview(gateway(clipped), decoder, whitelist).catch((reason: unknown) => reason);
    expect(err).toBeInstanceOf(MissingAssetsError);
    expect((err as MissingAssetsError).missing).toEqual([
      expect.objectContaining({ assetId: "player.swordsman.male.body.act", reason: expect.stringContaining("would be clipped") as unknown }),
    ]);
  });
});
