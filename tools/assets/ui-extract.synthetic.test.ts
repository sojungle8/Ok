/**
 * UI-B1 (synthetic structural fixture — never RO visual evidence): the 108 UI rows go through the
 * transactional extraction, the manifest-gated gateway and the client FormalUiAssetLoader.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AssetWhitelist, HttpAssetGatewayClient, isUiRow } from "@ro-survivor/asset-contracts";
import type { WhitelistRow } from "@ro-survivor/content-schema";
import { createAssetReader, startGateway } from "@ro-survivor/asset-gateway";
import { parseAct, parseBmp, readJpegInfo } from "@ro-survivor/ro-format-runtime";
import { createTempDir } from "@ro-survivor/testkit";
import type { FormalDecoders } from "../../apps/client/src/game/formal/load.ts";
import { loadFormalUiAssets } from "../../apps/client/src/game/formal/ui.ts";
import { MissingAssetsError } from "../../apps/client/src/game/requirements.ts";
import { decodeOwnPng } from "../lib/png.ts";
import { MANIFEST_FILE, runExtraction, type ExtractManifest } from "./extract-run.ts";
import { SceneExtractionError } from "./scene-extract.ts";
import { CANONICAL_WHITELIST_SHA256 } from "@ro-survivor/asset-contracts";
/** Verified lock of the reader + canonical v3 whitelist hash (synthetic run). */
const identityOf = (r: { lockId: string }) => ({ lockId: r.lockId, whitelistSha256: CANONICAL_WHITELIST_SHA256 });
import { buildSyntheticSources } from "./synthetic-sources.ts";

const repoRoot = resolve(import.meta.dirname, "../..");
const realRows = AssetWhitelist.fromCsv(readFileSync(join(repoRoot, "docs/product-plan/handoff/fan-local-asset-whitelist.csv"), "utf8")).rows();
const PROFILE = "KRO2021_CLASSIC_V0_FAN";
const EXPECTED = { profileId: PROFILE, whitelistSha256: CANONICAL_WHITELIST_SHA256 };
/** Rewrite one derived file and re-sign its ready-manifest entry, so only the inner cross-link is wrong. */
function rewriteDerived(out: string, file: string, mutate: (j: Record<string, unknown>) => void): void {
  const j = JSON.parse(readFileSync(join(out, file), "utf8")) as Record<string, unknown>;
  mutate(j);
  const text = JSON.stringify(j);
  writeFileSync(join(out, file), text);
  const mPath = join(out, MANIFEST_FILE);
  const m = JSON.parse(readFileSync(mPath, "utf8")) as { outputs: { file: string; sha256: string; bytes: number }[] };
  const o = m.outputs.find((x) => x.file === file) as { sha256: string; bytes: number };
  o.sha256 = createHash("sha256").update(text).digest("hex").toUpperCase();
  o.bytes = Buffer.byteLength(text);
  writeFileSync(mPath, JSON.stringify(m, null, 2));
}
function rewriteManifest(out: string, mutate: (m: Record<string, unknown>) => void): void {
  const mPath = join(out, MANIFEST_FILE);
  const m = JSON.parse(readFileSync(mPath, "utf8")) as Record<string, unknown>;
  mutate(m);
  writeFileSync(mPath, JSON.stringify(m, null, 2));
}
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
    const m: ExtractManifest = runExtraction(rows, reader, out, { identity: identityOf(reader) });
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
    const ui = await loadFormalUiAssets(client, decoders, whitelist, EXPECTED);
    expect(ui.entries.size).toBe(106);
    expect(ui.images.size).toBe(105);
    expect([...ui.fonts.keys()].sort()).toEqual(["ui.font.scdream4", "ui.font.scdream6"]);
    expect(ui.cursor.act.hotspots).toHaveLength(14);
    await expect(loadFormalUiAssets(client, decoders, whitelist, { ...EXPECTED, profileId: "KRO2019_RENEWAL" })).rejects.toMatchObject({ missing: [expect.objectContaining({ canonicalPath: "profileId" })] });
  });

  it("BMP -> PNG is lossless and the magenta key becomes alpha 0", () => {
    const { rows, reader, out } = sources();
    runExtraction(rows, reader, out, { identity: identityOf(reader) });
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
    runExtraction(rows, reader, out, { identity: identityOf(reader) });
    const spr = JSON.parse(readFileSync(join(out, "ui.cursor.spr.json"), "utf8")) as { frames: { w: number; h: number; index: number }[] };
    const act = JSON.parse(readFileSync(join(out, "ui.cursor.act.json"), "utf8")) as { actVersion: string; actions: { frames: { layers: { sprIndex: number; x: number; y: number }[] }[] }[]; hotspots: { action: number; x: number; y: number }[] };
    expect(spr.frames).toHaveLength(14);
    expect(act.actVersion).toBe("2.5");
    expect(act.actions).toHaveLength(14);
    expect(act.hotspots[0]).toEqual({ action: 0, x: 2, y: 3 });
    // Verbatim: the derived ACT equals the parsed source ACT field by field (layers incl. width / height, anchors, sounds).
    const parsed = parseAct(reader.read(row(rows, "ui.cursor.act")).bytes);
    const derived = JSON.parse(readFileSync(join(out, "ui.cursor.act.json"), "utf8")) as { actions: unknown; sounds: unknown };
    expect(derived.actions).toEqual(parsed.actions);
    expect(derived.sounds).toEqual(parsed.sounds);
    act.actions.forEach((a, i) => {
      const l = a.frames[0]?.layers[0];
      const f = spr.frames[l?.sprIndex ?? -1];
      const h = act.hotspots[i];
      expect(f && h && h.x >= 0 && h.y >= 0 && h.x < f.w && h.y < f.h, `action ${i}`).toBe(true);
    });
  });

  it("gateway: fonts only by exact logical ID; derived UI only when manifest-listed; arbitrary paths rejected", async () => {
    const { rows, reader, out, lock } = sources();
    runExtraction(rows, reader, out, { identity: identityOf(reader) });
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

  it.each([
    ["a plain button state", "ui.menu.status.active"],
    ["a slice part", "ui.button.hover.mid"],
    ["a non-button, non-slice row", "ui.hud.basic.background"],
  ])("registry closure: %s removed from the whitelist (%s) is reported with its canonical container / path", async (_label, removed) => {
    const { rows, reader, out, lock } = sources();
    runExtraction(rows, reader, out, { identity: identityOf(reader) });
    const { client, whitelist } = await gateway(rows.filter((r) => r.asset_id !== removed), lock, out);
    const err = await loadFormalUiAssets(client, decoders, whitelist, EXPECTED).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MissingAssetsError);
    expect((err as MissingAssetsError).missing).toEqual([
      expect.objectContaining({ assetId: removed, container: "data.grf", canonicalPath: row(rows, removed).canonical_cp949_path, reason: expect.stringContaining("missing from the whitelist") as unknown }),
    ]);
  });

  it("registry closure: an extra unknown UI row is rejected", async () => {
    const { rows, reader, out, lock } = sources();
    runExtraction(rows, reader, out, { identity: identityOf(reader) });
    const extra = { ...row(rows, "ui.arrow.left"), asset_id: "ui.arrow.extra", canonical_cp949_path: "data\\texture\\유저인터페이스\\basic_interface\\arw_extra.bmp" };
    const { client, whitelist } = await gateway([...rows, extra], lock, out);
    const err = await loadFormalUiAssets(client, decoders, whitelist, EXPECTED).catch((e: unknown) => e);
    expect((err as MissingAssetsError).missing).toEqual([expect.objectContaining({ assetId: "ui.arrow.extra", reason: expect.stringContaining("not in the canonical") as unknown })]);
  });

  it("identity: wrong lock ID or wrong canonical CSV hash stops extraction with the contract field and no ready manifest", () => {
    const { rows, reader, out } = sources();
    runExtraction(rows, reader, out, { identity: identityOf(reader) });
    const wrongLock = sceneError(() => runExtraction(rows, reader, out, { identity: { lockId: "other-lock", whitelistSha256: CANONICAL_WHITELIST_SHA256 } }));
    expect(wrongLock.missing).toEqual([expect.objectContaining({ assetId: null, container: "contract", canonicalPath: "identity.lockId" })]);
    expect(existsSync(join(out, MANIFEST_FILE))).toBe(false);
    const wrongCsv = sceneError(() => runExtraction(rows, reader, out, { identity: { lockId: reader.lockId, whitelistSha256: "0".repeat(64) } }));
    expect(wrongCsv.missing).toEqual([expect.objectContaining({ canonicalPath: "identity.whitelistSha256" })]);
    expect(existsSync(join(out, MANIFEST_FILE))).toBe(false);
    const m = runExtraction(rows, reader, out, { identity: identityOf(reader) });
    expect(m.identity).toMatchObject({ lockId: reader.lockId, whitelistSha256: CANONICAL_WHITELIST_SHA256, uiProfileId: PROFILE });
  });

  it("identity: the loader checks the client whitelist hash, the manifest entry set and every per-asset header before trusting assets", async () => {
    const { rows, reader, out, lock } = sources();
    runExtraction(rows, reader, out, { identity: identityOf(reader) });
    const { client, whitelist } = await gateway(rows, lock, out);
    await expect(loadFormalUiAssets(client, decoders, whitelist, { ...EXPECTED, whitelistSha256: "0".repeat(64) })).rejects.toMatchObject({ missing: [expect.objectContaining({ canonicalPath: "whitelistSha256" })] });
    rewriteDerived(out, "ui.arrow.left.json", (j) => {
      j.lockId = "other-lock";
    });
    const header = await loadFormalUiAssets(client, decoders, whitelist, EXPECTED).catch((e: unknown) => e);
    expect((header as MissingAssetsError).missing).toEqual([expect.objectContaining({ assetId: "ui.arrow.left", reason: expect.stringContaining("lockId other-lock") as unknown })]);
    rewriteManifest(out, (m) => {
      (m.identity as { uiEntrySetSha256: string }).uiEntrySetSha256 = "F".repeat(64);
    });
    await expect(loadFormalUiAssets(client, decoders, whitelist, EXPECTED)).rejects.toMatchObject({ missing: [expect.objectContaining({ canonicalPath: "derived.uiEntrySetSha256" })] });
  });

  it("PNG cross-link: JSON and PNG each hash-valid in the manifest, but the JSON's declared PNG SHA-256 is wrong", async () => {
    const { rows, reader, out, lock } = sources();
    runExtraction(rows, reader, out, { identity: identityOf(reader) });
    rewriteDerived(out, "ui.chat.mode.on.json", (j) => {
      (j.derived as { sha256: string }).sha256 = "A".repeat(64);
    });
    const { client, whitelist } = await gateway(rows, lock, out);
    const err = await loadFormalUiAssets(client, decoders, whitelist, EXPECTED).catch((e: unknown) => e);
    expect((err as MissingAssetsError).missing).toEqual([
      expect.objectContaining({ assetId: "ui.chat.mode.on", canonicalPath: row(rows, "ui.chat.mode.on").canonical_cp949_path, reason: expect.stringContaining("derived PNG SHA-256") as unknown }),
    ]);
  });

  it.each([
    ["a later frame / layer referencing a missing atlas frame", "ui.cursor.act.json", (j: Record<string, unknown>) => {
      const a = j.actions as { frames: { layers: { sprIndex: number }[] }[] }[];
      const first = a[3]?.frames[0] as { layers: { sprIndex: number }[] };
      a[3]?.frames.push({ ...first, layers: [{ ...(first.layers[0] as object), sprIndex: 99 }] }); // schema-valid, wrong reference
    }, "action 3 frame 1 layer 0"],
    ["an atlas rect outside the atlas", "ui.cursor.spr.json", (j: Record<string, unknown>) => {
      (j.frames as { x: number }[])[2] = { ...(j.frames as object[])[2], x: 10_000 };
    }, "rect outside"],
    ["a duplicate hotspot action", "ui.cursor.act.json", (j: Record<string, unknown>) => {
      (j.hotspots as { action: number }[])[1] = { ...(j.hotspots as object[])[1], action: 0 };
    }, "not exactly 0..13"],
    ["a missing hotspot", "ui.cursor.act.json", (j: Record<string, unknown>) => {
      (j.hotspots as unknown[]).pop();
    }, "not exactly 0..13"],
    ["a wrong-action hotspot", "ui.cursor.act.json", (j: Record<string, unknown>) => {
      (j.hotspots as { action: number }[])[13] = { ...(j.hotspots as object[])[13], action: 20 };
    }, "not exactly 0..13"],
  ] as const)("cursor validation rejects %s", async (_label, file, mutate, reason) => {
    const { rows, reader, out, lock } = sources();
    runExtraction(rows, reader, out, { identity: identityOf(reader) });
    rewriteDerived(out, file, mutate);
    const { client, whitelist } = await gateway(rows, lock, out);
    const err = await loadFormalUiAssets(client, decoders, whitelist, EXPECTED).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MissingAssetsError);
    expect((err as MissingAssetsError).missing.some((m) => (m.assetId === "ui.cursor.act" || m.assetId === "ui.cursor.spr") && m.reason.includes(reason))).toBe(true);
  });

  it.each([
    ["missing source", "ui.arrow.up", "source unreadable", (r: WhitelistRow) => ({ ...r, bytes: r.bytes + 1 })],
    ["hash drift", "ui.hud.basic.background", "SHA-256", (r: WhitelistRow) => ({ ...r, sha256: "0".repeat(64) })],
  ] as const)("%s (%s) fails closed with exact ID / path and no ready manifest, also after a good run", (_label, id, reason, mutate) => {
    const { rows, reader, out } = sources();
    runExtraction(rows, reader, out, { identity: identityOf(reader) });
    expect(existsSync(join(out, MANIFEST_FILE))).toBe(true);
    const bad = rows.map((r) => (r.asset_id === id ? mutate(r) : r));
    const err = sceneError(() => runExtraction(bad, reader, out, { identity: identityOf(reader) }));
    expect(err.missing).toEqual([expect.objectContaining({ assetId: id, container: "data.grf", canonicalPath: row(rows, id).canonical_cp949_path, reason: expect.stringContaining(reason) as unknown })]);
    expect(existsSync(join(out, MANIFEST_FILE))).toBe(false);
  });

  it("a malformed UI bitmap (readable, wrong format) fails closed: partial UI extraction publishes nothing", () => {
    const { rows, reader, out } = sources();
    const act = row(rows, "ui.cursor.act");
    const bad = rows.map((r) => (r.asset_id === "ui.slot.selection" ? { ...r, raw_name_hex: act.raw_name_hex, bytes: act.bytes, sha256: act.sha256 } : r));
    const err = sceneError(() => runExtraction(bad, reader, out, { identity: identityOf(reader) }));
    expect(err.missing.map((m) => [m.assetId, m.canonicalPath])).toEqual([["ui.slot.selection", row(rows, "ui.slot.selection").canonical_cp949_path]]);
    expect(err.missing[0]?.reason).toMatch(/^UI: /u);
    expect(existsSync(join(out, MANIFEST_FILE))).toBe(false);
  });

  it("loader: a missing or drifted derived UI file is reported by exact ID and canonical path", async () => {
    const { rows, reader, out, lock } = sources();
    runExtraction(rows, reader, out, { identity: identityOf(reader) });
    rmSync(join(out, "ui.minimap.player_arrow.png"));
    const { client, whitelist } = await gateway(rows, lock, out);
    const err = await loadFormalUiAssets(client, decoders, whitelist, EXPECTED).catch((e: unknown) => e);
    expect((err as MissingAssetsError).missing).toEqual([
      expect.objectContaining({ assetId: "ui.minimap.player_arrow", canonicalPath: row(rows, "ui.minimap.player_arrow").canonical_cp949_path }),
    ]);
  });
});
