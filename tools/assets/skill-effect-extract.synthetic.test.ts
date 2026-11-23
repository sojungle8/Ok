import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AssetWhitelist, CANONICAL_WHITELIST_SHA256, FORMAL_SKILL_EFFECT_IDS, type DerivedSkillEffect } from "@ro-survivor/asset-contracts";
import { createAssetReader, type AssetReader } from "@ro-survivor/asset-gateway";
import { createTempDir } from "@ro-survivor/testkit";
import { decodeOwnPng } from "../lib/png.ts";
import { runExtraction } from "./extract-run.ts";
import { SceneExtractionError } from "./scene-extract.ts";
import { extractSkillEffects } from "./skill-effect-extract.ts";
import { buildSyntheticSources } from "./synthetic-sources.ts";

const root = resolve(import.meta.dirname, "../..");
const canonicalRows = AssetWhitelist.fromCsv(readFileSync(join(root, "docs/product-plan/handoff/fan-local-asset-whitelist.csv"), "utf8")).rows();
const cleanup: (() => void)[] = [];
afterEach(() => {
  while (cleanup.length > 0) cleanup.pop()?.();
});

function setup() {
  const dir = createTempDir("skill-fx-");
  cleanup.push(() => dir.dispose());
  const sources = buildSyntheticSources(join(dir.root, "src"), canonicalRows);
  const reader = createAssetReader(sources.lock);
  cleanup.push(() => reader.close());
  return { ...sources, reader, out: join(dir.root, "derived") };
}

function readerWithBytes(reader: AssetReader, id: string, transform: (bytes: Uint8Array) => Uint8Array): AssetReader {
  return {
    ...reader,
    read(row) {
      const source = reader.read(row);
      return row.asset_id === id ? { ...source, bytes: transform(source.bytes) } : source;
    },
  };
}

describe("fan-local official RO skill-effect extraction", () => {
  it("emits 11 lossless texture PNGs plus 12 source-linked metadata records", () => {
    const { rows, reader, out } = setup();
    const result = extractSkillEffects(rows, reader, out);
    expect(result.summary).toEqual({ sources: 12, textures: 11, animations: 1, pngs: 11, metadata: 12 });
    expect(result.effects.map((effect) => effect.assetId)).toEqual(FORMAL_SKILL_EFFECT_IDS);
    expect(result.outputs).toHaveLength(23);
    expect(result.outputs.every((output) => output.from.length === 1 && FORMAL_SKILL_EFFECT_IDS.includes(output.from[0]?.assetId as typeof FORMAL_SKILL_EFFECT_IDS[number]))).toBe(true);

    for (const effect of result.effects) {
      const meta = JSON.parse(readFileSync(join(out, `${effect.assetId}.json`), "utf8")) as DerivedSkillEffect;
      expect(meta).toEqual(effect);
      expect(meta.source.sha256).toMatch(/^[0-9A-F]{64}$/u);
      if (meta.kind === "texture") {
        const png = decodeOwnPng(readFileSync(join(out, `${effect.assetId}.png`)));
        expect([png.width, png.height, png.rgba.length]).toEqual([meta.width, meta.height, meta.width * meta.height * 4]);
        expect(meta.derived.file).toBe(`${effect.assetId}.png`);
      } else {
        expect(meta).toMatchObject({ format: "str", magic: "STRM", parsed: false, sourceOnly: true });
        expect(() => readFileSync(join(out, `${effect.assetId}.png`))).toThrow();
      }
    }
  });

  it("fails closed when a fixed-closure row is absent and publishes no ready manifest", () => {
    const { rows, reader, out } = setup();
    const absent = "effect.skill.sw.endure";
    const reduced = rows.filter((row) => row.asset_id !== absent);
    expect(() => runExtraction(reduced, reader, out, { identity: { lockId: reader.lockId, whitelistSha256: CANONICAL_WHITELIST_SHA256 } })).toThrow(SceneExtractionError);
    expect(() => readFileSync(join(out, "manifest.json"))).toThrow();
  });

  it("rejects malformed texture bytes and never falls back to another format", () => {
    const { rows, reader, out } = setup();
    const id = "effect.skill.sw.endure";
    const malformed = readerWithBytes(reader, id, (bytes) => {
      const copy = bytes.slice();
      copy[2] = 10; // RLE TGA is deliberately outside the accepted subset.
      return copy;
    });
    const error = (() => {
      try {
        extractSkillEffects(rows, malformed, out);
        return null;
      } catch (caught) {
        return caught;
      }
    })();
    expect(error).toBeInstanceOf(SceneExtractionError);
    expect((error as SceneExtractionError).missing).toEqual([
      expect.objectContaining({ assetId: id, canonicalPath: expect.stringContaining("endure.tga") as unknown, reason: expect.stringContaining("image type 10") as unknown }),
    ]);
  });

  it("identifies STR only by its pinned source and STRM magic; it does not claim to parse it", () => {
    const { rows, reader, out } = setup();
    const id = "effect.skill.sw.provoke.str";
    const malformed = readerWithBytes(reader, id, (bytes) => {
      const copy = bytes.slice();
      copy.set([0x42, 0x41, 0x44, 0x21], 0);
      return copy;
    });
    expect(() => extractSkillEffects(rows, malformed, out)).toThrow(/STR magic "BAD!" is not STRM/u);
  });
});

