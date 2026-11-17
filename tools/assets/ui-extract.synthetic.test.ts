/**
 * UI-B1 (synthetic structural fixture — never RO visual evidence): the 108 UI rows go through the
 * transactional extraction, the manifest-gated gateway and the client FormalUiAssetLoader.
 */
import { existsSync, readFileSync, rmSync } from "node:fs";
import { request } from "node:http";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AssetWhitelist, HttpAssetGatewayClient, isUiRow } from "@ro-survivor/asset-contracts";
import type { WhitelistRow } from "@ro-survivor/content-schema";
import { createAssetReader, startGateway } from "@ro-survivor/asset-gateway";
import { parseBmp, readJpegInfo } from "@ro-survivor/ro-format-runtime";
import { createTempDir } from "@ro-survivor/testkit";
import type { FormalDecoders } from "../../apps/client/src/game/formal/load.ts";
import { loadFormalUiAssets } from "../../apps/client/src/game/formal/ui.ts";
import { MissingAssetsError } from "../../apps/client/src/game/requirements.ts";
import { decodeOwnPng } from "../lib/png.ts";
import { MANIFEST_FILE, runExtraction, type ExtractManifest } from "./extract-run.ts";
import { SceneExtractionError } from "./scene-extract.ts";
import { buildSyntheticSources } from "./synthetic-sources.ts";

const repoRoot = resolve(import.meta.dirname, "../..");
const realRows = AssetWhitelist.fromCsv(readFileSync(join(repoRoot, "docs/product-plan/handoff/fan-local-asset-whitelist.csv"), "utf8")).rows();
const PROFILE = "KRO2021_CLASSIC_V0_FAN";
const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()?.();
});
const decoders: FormalDecoders = {
  image(bytes, type) {
    if (type === "image/png") {
      const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      return Promise.resolve({ width: v.getUint32(16), height: v.getUint32(20) });
    }
    const j = readJpegInfo(bytes);
    return Promise.resolve({ width: j.width, height: j.height });
  },
};

function sources() {
  const d = createTempDir("ui-b1-");
  cleanups.push(() => d.dispose());
  const src = buildSyntheticSources(join(d.root, "src"), realRows);
  const reader = createAssetReader(src.lock);
  cleanups.push(() => reader.close());
  return { ...src, reader, out: join(d.root, "derived") };
}
async function gateway(rows: WhitelistRow[], lock: ReturnType<typeof sources>["lock"], out: string) {
  const whitelist = new AssetWhitelist(rows);
  const gw = await startGateway({ config: { host: "127.0.0.1", port: 0, lanProfile: null }, whitelist, lock, buildId: "t", derivedDir: out });
  cleanups.push(() => gw.close());
  return { gw, whitelist, client: new HttpAssetGatewayClient({ baseUrl: gw.url, whitelist }) };
}
const status = (url: string) => new Promise<number>((ok, bad) => {
  const r = request(url, (res) => {
    res.resume();
    ok(res.statusCode ?? 0);
  });
  r.on("error", bad);
  r.end();
});
const sceneError = (fn: () => unknown): SceneExtractionError => {
  try {
    fn();
  } catch (err) {
    if (err instanceof SceneExtractionError) return err;
    throw err;
  }
  throw new Error("expected SceneExtractionError");
};
const row = (rows: readonly WhitelistRow[], id: string) => rows.find((r) => r.asset_id === id) as WhitelistRow;

describe("UI-B1 extraction + FormalUiAssetLoader (synthetic)", () => {
  it("all 108 UI rows: 104 bitmaps + cursor atlas/ACT derived and manifest-listed with provenance; fonts stay source-only; loader resolves all 108", async () => {
    const { rows, reader, out, lock } = sources();
    const m: ExtractManifest = runExtraction(rows, reader, out);
    expect(m.ui).toEqual({ profileId: PROFILE, entries: 108, bitmaps: 104, cursorActions: 14, fonts: 2 });
    const files = new Map(m.outputs.map((o) => [o.file, o]));
    for (const r of rows.filter(isUiRow)) {
      if (r.source_container === "filesystem:System") {
        expect([...files.keys()].some((f) => f.startsWith(r.asset_id))).toBe(false); // no derived font file
        continue;
      }
      const json = files.get(`${r.asset_id}.json`);
      expect(json?.from.map((f) => f.assetId), r.asset_id).toContain(r.asset_id);
      if (r.asset_id !== "ui.cursor.act") expect(files.get(`${r.asset_id}.png`)?.from[0]?.assetId, r.asset_id).toBe(r.asset_id);
    }
    expect(files.get("ui/ui-manifest.json")?.from.map((f) => f.assetId).sort()).toEqual(rows.filter(isUiRow).map((r) => r.asset_id).sort());
    const { client, whitelist } = await gateway(rows, lock, out);
    const ui = await loadFormalUiAssets(client, decoders, whitelist, PROFILE);
    expect(ui.entries.size).toBe(106);
    expect(ui.images.size).toBe(105);
    expect([...ui.fonts.keys()].sort()).toEqual(["ui.font.scdream4", "ui.font.scdream6"]);
    expect(ui.cursor.act.hotspots).toHaveLength(14);
    await expect(loadFormalUiAssets(client, decoders, whitelist, "KRO2019_RENEWAL")).rejects.toThrow(/only KRO2021_CLASSIC_V0_FAN/u);
  });

  it("BMP -> PNG is lossless and the magenta key becomes alpha 0", () => {
    const { rows, reader, out } = sources();
    runExtraction(rows, reader, out);
    for (const id of ["ui.arrow.left", "ui.hud.basic.background", "ui.skill.cr_shieldboomerang.icon"]) {
      const src = parseBmp(reader.read(row(rows, id)).bytes);
      const png = decodeOwnPng(readFileSync(join(out, `${id}.png`)));
      expect([png.width, png.height]).toEqual([src.width, src.height]);
      expect(Buffer.from(png.rgba).equals(Buffer.from(src.rgba))).toBe(true);
      expect([...png.rgba.subarray(0, 4)]).toEqual([255, 0, 255, 0]); // synthetic key pixel at (0,0)
      const meta = JSON.parse(readFileSync(join(out, `${id}.json`), "utf8")) as { filter: string; transparency: { keyedPixels: number }; entry: { native_width: number } };
      expect(meta.filter).toBe("nearest");
      expect(meta.transparency.keyedPixels).toBeGreaterThan(0);
      expect(meta.entry.native_width).toBe(src.width);
    }
  });

  it("cursor: atlas frames, ACT actions/layers verbatim and UI-A hotspots inside their frames", () => {
    const { rows, reader, out } = sources();
    runExtraction(rows, reader, out);
    const spr = JSON.parse(readFileSync(join(out, "ui.cursor.spr.json"), "utf8")) as { frames: { w: number; h: number; index: number }[] };
    const act = JSON.parse(readFileSync(join(out, "ui.cursor.act.json"), "utf8")) as { actVersion: string; actions: { frames: { layers: { sprIndex: number; x: number; y: number }[] }[] }[]; hotspots: { action: number; x: number; y: number }[] };
    expect(spr.frames).toHaveLength(14);
    expect(act.actVersion).toBe("2.5");
    expect(act.actions).toHaveLength(14);
    expect(act.hotspots[0]).toEqual({ action: 0, x: 2, y: 3 });
    act.actions.forEach((a, i) => {
      const l = a.frames[0]?.layers[0];
      const f = spr.frames[l?.sprIndex ?? -1];
      const h = act.hotspots[i];
      expect(f && h && h.x >= 0 && h.y >= 0 && h.x < f.w && h.y < f.h, `action ${i}`).toBe(true);
    });
  });

  it("gateway: fonts only by exact logical ID; derived UI only when manifest-listed; arbitrary paths rejected", async () => {
    const { rows, reader, out, lock } = sources();
    runExtraction(rows, reader, out);
    const { gw, client } = await gateway(rows, lock, out);
    const font = new Uint8Array(await client.getBinary("ui.font.scdream4"));
    expect(String.fromCharCode(...font.subarray(0, 4))).toBe("OTTO");
    expect(await status(`${gw.url}/v1/derived/ui.font.scdream4.json`)).toBe(404);
    expect(await status(`${gw.url}/System/Font/SCDream4.otf`)).toBe(404);
    expect(await status(`${gw.url}/v1/assets/${encodeURIComponent("System\\Font\\SCDream4.otf")}`)).toBe(404);
    expect(await status(`${gw.url}/v1/derived/ui%2Fui-manifest.json`)).toBe(404);
    expect(await status(`${gw.url}/v1/derived/..%2Fmanifest.json`)).toBe(404);
    expect(await status(`${gw.url}/v1/derived/ui.arrow.left.png`)).toBe(200);
  });

  it("button states and three-part slices are never synthesised: a missing hover-mid row is reported", async () => {
    const { rows, reader, out, lock } = sources();
    runExtraction(rows, reader, out);
    const without = rows.filter((r) => r.asset_id !== "ui.button.hover.mid");
    const { client, whitelist } = await gateway(without, lock, out);
    const err = await loadFormalUiAssets(client, decoders, whitelist, PROFILE).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MissingAssetsError);
    const ids = (err as MissingAssetsError).missing.map((m) => m.assetId);
    expect(ids).toEqual(expect.arrayContaining(["ui.button.hover.left", "ui.button.hover.right"]));
    expect((err as MissingAssetsError).missing.some((m) => m.reason.includes("lacks mid"))).toBe(true);
  });

  it.each([
    ["missing source", "ui.arrow.up", "source unreadable", (r: WhitelistRow) => ({ ...r, bytes: r.bytes + 1 })],
    ["hash drift", "ui.hud.basic.background", "SHA-256", (r: WhitelistRow) => ({ ...r, sha256: "0".repeat(64) })],
  ] as const)("%s (%s) fails closed with exact ID / path and no ready manifest, also after a good run", (_label, id, reason, mutate) => {
    const { rows, reader, out } = sources();
    runExtraction(rows, reader, out);
    expect(existsSync(join(out, MANIFEST_FILE))).toBe(true);
    const bad = rows.map((r) => (r.asset_id === id ? mutate(r) : r));
    const err = sceneError(() => runExtraction(bad, reader, out));
    expect(err.missing).toEqual([expect.objectContaining({ assetId: id, container: "data.grf", canonicalPath: row(rows, id).canonical_cp949_path, reason: expect.stringContaining(reason) as unknown })]);
    expect(existsSync(join(out, MANIFEST_FILE))).toBe(false);
  });

  it("a malformed UI bitmap (readable, wrong format) fails closed: partial UI extraction publishes nothing", () => {
    const { rows, reader, out } = sources();
    const act = row(rows, "ui.cursor.act");
    const bad = rows.map((r) => (r.asset_id === "ui.slot.selection" ? { ...r, raw_name_hex: act.raw_name_hex, bytes: act.bytes, sha256: act.sha256 } : r));
    const err = sceneError(() => runExtraction(bad, reader, out));
    expect(err.missing.map((m) => [m.assetId, m.canonicalPath])).toEqual([["ui.slot.selection", row(rows, "ui.slot.selection").canonical_cp949_path]]);
    expect(err.missing[0]?.reason).toMatch(/^UI: /u);
    expect(existsSync(join(out, MANIFEST_FILE))).toBe(false);
  });

  it("loader: a missing or drifted derived UI file is reported by exact ID and canonical path", async () => {
    const { rows, reader, out, lock } = sources();
    runExtraction(rows, reader, out);
    rmSync(join(out, "ui.minimap.player_arrow.png"));
    const { client, whitelist } = await gateway(rows, lock, out);
    const err = await loadFormalUiAssets(client, decoders, whitelist, PROFILE).catch((e: unknown) => e);
    expect((err as MissingAssetsError).missing).toEqual([
      expect.objectContaining({ assetId: "ui.minimap.player_arrow", canonicalPath: row(rows, "ui.minimap.player_arrow").canonical_cp949_path }),
    ]);
  });
});
