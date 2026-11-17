import { cpSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AssetWhitelist } from "@ro-survivor/asset-contracts";
import { createAssetReader } from "@ro-survivor/asset-gateway";
import { createTempDir, createTempGitRepo, type TempGitRepo } from "@ro-survivor/testkit";
import { decodeOwnPng } from "../lib/png.ts";
import { scanRepository } from "../rights-check/scan.ts";
import { auditWhitelist } from "./audit-whitelist-lib.ts";
import { runExtraction } from "./extract-run.ts";
import { layerDrawOrder, type SpriteMetadata } from "./extract-lib.ts";
import { buildSyntheticSources } from "./synthetic-sources.ts";

const repoRoot = resolve(import.meta.dirname, "../..");
const realRows = AssetWhitelist.fromCsv(readFileSync(join(repoRoot, "docs/product-plan/handoff/fan-local-asset-whitelist.csv"), "utf8")).rows();
const cleanups: (() => void)[] = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

function setup() {
  const d = createTempDir("extract-");
  cleanups.push(() => d.dispose());
  const src = buildSyntheticSources(join(d.root, "src"), realRows);
  const reader = createAssetReader(src.lock);
  cleanups.push(() => reader.close());
  return { ...src, reader, out: join(d.root, "out") };
}

describe("assets:audit-whitelist (synthetic sources)", () => {
  it("all 282 whitelisted IDs (canonical v3) resolve by raw hex or the System allowlist and parse", () => {
    const { rows, reader } = setup();
    const audit = auditWhitelist(rows, reader);
    expect(audit).toHaveLength(282);
    expect(audit.filter((r) => r.status !== "PASS")).toEqual([]);
  });

  it("fails rows whose bytes, SHA-256 or ACT action count disagree", () => {
    const { rows, reader } = setup();
    const tampered = rows.map((r) =>
      r.asset_id === "monster.1002.spr" ? { ...r, bytes: r.bytes + 1 }
      : r.asset_id === "map.prt_fild08.gat" ? { ...r, sha256: "0".repeat(64) }
      : r.asset_id === "monster.1090.act" ? { ...r, act_actions: "41" }
      : r,
    );
    const failed = auditWhitelist(tampered, reader).filter((r) => r.status === "FAIL").map((r) => r.assetId).sort();
    expect(failed).toEqual(["map.prt_fild08.gat", "monster.1002.spr", "monster.1090.act"]);
  });
});

describe("assets:extract (synthetic sources)", () => {
  it("writes atlases, metadata, contact sheets, map data and a hashed manifest", () => {
    const { rows, reader, out } = setup();
    const m = runExtraction(rows, reader, out);
    expect(m.sprites.map((s) => s.id).sort()).toEqual([
      "monster.1002", "monster.1007", "monster.1010", "monster.1011", "monster.1020", "monster.1031", "monster.1052", "monster.1063",
      "monster.1088", "monster.1090", "monster.1113", "monster.1167", "player.swordsman.female", "player.swordsman.male",
    ]);
    for (const o of m.outputs) {
      const file = existsSync(join(out, o.file)) ? join(out, o.file) : existsSync(join(out, "contact-sheets", o.file)) ? join(out, "contact-sheets", o.file) : join(out, "reports", o.file);
      expect(createHash("sha256").update(readFileSync(file)).digest("hex").toUpperCase()).toBe(o.sha256);
      expect(o.from.length).toBeGreaterThan(0);
    }
    const meta = JSON.parse(readFileSync(join(out, "monster.1002.act.json"), "utf8")) as SpriteMetadata;
    expect(meta.slots.cast.fallback).toBe(true);
    expect(meta.slots.cast.sourceAction).toBe("attack");
    expect(meta.stats.mirrorDeduped).toBeGreaterThan(0);
    expect(meta.frames.some((f) => f.flipX)).toBe(true);
    const sheet = decodeOwnPng(readFileSync(join(out, "contact-sheets", "player.swordsman.male.png")));
    expect(sheet.height).toBeGreaterThan(6 * 8 * 30);
    const player = JSON.parse(readFileSync(join(out, "player.swordsman.male.body.act.json"), "utf8")) as SpriteMetadata;
    expect(player.slots.cast).toMatchObject({ sourceAction: "cast", fallback: false });
    expect(player.sounds.length).toBeGreaterThan(0);
    // Commit C: four layer sets with their original palettes, weapon/shield behind the body when facing away.
    expect(player.layers.map((l) => [l.spr, l.palette])).toEqual([
      ["player.swordsman.male.body.spr", "palette.body.swordsman.male"], ["player.hair01.male.spr", "palette.hair01.male"],
      ["player.swordsman.male.sword.spr", null], ["player.swordsman.male.guard.spr", null],
    ]);
    expect(player.layerOrder[0]).toEqual([0, 1, 2, 3]);
    expect(player.layerOrder[4]).toEqual([2, 3, 0, 1]);
    expect(layerDrawOrder("monster", 1, 4)).toEqual([0]);
    // Mirrored directions add no pixels: every flipX frame shares its rectangle with an unflipped one.
    const unflipped = new Set(player.frames.filter((f) => !f.flipX).map((f) => `${f.x},${f.y}`));
    expect(player.frames.filter((f) => f.flipX).every((f) => unflipped.has(`${f.x},${f.y}`))).toBe(true);
    expect(m.map?.flood.reachableFromSpawn).toBeLessThan(m.map?.flood.walkable ?? 0);
    const deps = JSON.parse(readFileSync(join(out, "reports", "prt_fild08-dependencies.json"), "utf8")) as { models: string[]; textures: string[]; sounds: string[]; waterType: number };
    expect([deps.models.length, deps.textures.length, deps.sounds.length, deps.waterType]).toEqual([23, 21, 4, 1]);
    // GND textures, RSW models, RSW sounds and the 32 water frames all resolve to whitelisted IDs.
    // Commit B: the closure now includes the 44 RSM texture references parsed from the GRSM models.
    expect(m.map?.closure).toEqual({ resolvedIds: 21 + 23 + 44 + 4 + 32, missing: [] });
  });

  it("is deterministic: two runs produce identical output hashes", () => {
    const a = setup();
    const b = setup();
    const hashes = (m: ReturnType<typeof runExtraction>) => m.outputs.map((o) => `${o.file}:${o.sha256}`);
    expect(hashes(runExtraction(b.rows, b.reader, b.out))).toEqual(hashes(runExtraction(a.rows, a.reader, a.out)));
  });
});

describe("rights:check vs derived outputs", () => {
  const repos: TempGitRepo[] = [];
  afterEach(() => {
    while (repos.length) repos.pop()?.dispose();
  });

  it("allows derived files under .local-assets/ but fails anywhere else (marker), even renamed", async () => {
    const { rows, reader, out } = setup();
    runExtraction(rows, reader, out);
    const r = createTempGitRepo("derived-");
    repos.push(r);
    r.write(".gitignore", ".local-assets/\n");
    r.write("README.md", "x\n");
    r.commitAll("init");
    cpSync(out, join(r.root, ".local-assets/abc/v1"), { recursive: true });
    expect((await scanRepository({ root: r.root, history: { scanFullHistory: true } })).ok).toBe(true);
    cpSync(join(out, "monster.1002.spr.png"), join(r.root, "public/sprites.png"));
    cpSync(join(out, "monster.1002.act.json"), join(r.root, "public/data.json"));
    const res = await scanRepository({ root: r.root, history: { scanFullHistory: true } });
    expect(res.findings.filter((f) => f.code === "derived-marker").map((f) => f.path).sort()).toEqual(["public/data.json", "public/sprites.png"]);
    expect(readdirSync(join(r.root, ".local-assets/abc/v1")).length).toBeGreaterThan(10);
  });
});
