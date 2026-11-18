/**
 * Formal scene loading: every derived file and source asset of the scene contract is fetched by
 * logical ID from the local gateway and checked; any failure (missing, unreadable, invalid) blocks the
 * world with asset ID + canonical path. Nothing is substituted.
 */
import {
  FORMAL_SKILL_AUDIO_IDS, FORMAL_SKILL_EFFECT_IDS,
  type AssetWhitelist, type DerivedSkillEffect,
} from "@ro-survivor/asset-contracts";
import { MissingAssetsError, missingWhitelisted, type MissingAsset } from "../requirements.ts";
import {
  bakeModel, buildGroundBuffers, buildModelInstances, buildWaterBuffers, sceneRequiredIds, shadowParams, soundPlacements,
  type BakedModel, type DerivedGnd, type DerivedModel, type DerivedScene, type DerivedShadow, type GroundBuffers, type ModelInstance, type WaterBuffers,
} from "./contract.ts";

export const FORMAL_SCENE_ID = "map.prt_fild08.rsw";
export const FORMAL_CONVERTER_VERSION = 3;

export interface ImageLike {
  width: number;
  height: number;
  /** Browser ImageBitmap cleanup; absent from structural test doubles. */
  close?(): void;
}

export interface FormalGatewayLike {
  getJson<T>(assetId: string): Promise<T>;
  getDerivedImage(assetId: string): Promise<Uint8Array>;
  getBinary(assetId: string): Promise<ArrayBuffer>;
}

export interface FormalDecoders {
  image(bytes: Uint8Array, type: "image/png" | "image/jpeg"): Promise<ImageLike>;
}

export interface FormalSceneData {
  scene: DerivedScene;
  gnd: DerivedGnd;
  ground: GroundBuffers;
  models: Map<string, DerivedModel>;
  baked: Map<string, BakedModel>;
  instances: ModelInstance[];
  shadow: DerivedShadow;
  shadowParams: ReturnType<typeof shadowParams>;
  sounds: ReturnType<typeof soundPlacements>;
  /** Decoded images by asset ID: ground/model textures, `<gnd>` (lightmap atlas), `<shadow>.spr`. */
  images: Map<string, ImageLike>;
  /** Official water frames by asset ID (original JPG bytes, decoded). */
  water: Map<string, ImageLike>;
  /** Water surface over the selected GND cells only (null when the RSW has no water). */
  waterCells: WaterBuffers | null;
  /** Original audio bytes by asset ID (BGM 12 + ambient and skill WAVs). */
  audio: Map<string, ArrayBuffer>;
  /** Verified metadata for all 12 original RO effect sources (STR remains explicitly unparsed). */
  effects: Map<string, DerivedSkillEffect>;
  /** Decoded lossless PNGs for the 11 BMP/TGA effect textures. */
  effectImages: Map<string, ImageLike>;
}

/** Release browser-owned decoded image resources. Safe to call more than once. */
export function disposeFormalScene(data: FormalSceneData | null): void {
  if (!data) return;
  const seen = new Set<ImageLike>();
  for (const image of [...data.images.values(), ...data.water.values(), ...data.effectImages.values()]) {
    if (seen.has(image)) continue;
    seen.add(image);
    image.close?.();
  }
  data.images.clear();
  data.water.clear();
  data.audio.clear();
  data.effects.clear();
  data.effectImages.clear();
}

const reasonOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

async function sha256Upper(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function checkedEffectMetadata(assetId: string, value: unknown, whitelist: AssetWhitelist): DerivedSkillEffect {
  if (typeof value !== "object" || value === null) throw new Error("metadata is not an object");
  const meta = value as DerivedSkillEffect;
  const row = whitelist.get(assetId);
  if (meta.assetId !== assetId) throw new Error(`metadata is for ${String(meta.assetId)}`);
  if (meta.converterVersion !== FORMAL_CONVERTER_VERSION) throw new Error(`converter v${String(meta.converterVersion)}, client needs v${FORMAL_CONVERTER_VERSION}`);
  if (typeof meta.rights !== "string" || meta.rights.length === 0) throw new Error("rights marker missing");
  if (!meta.source || meta.source.canonicalPath !== row.canonical_cp949_path) throw new Error("source canonical path differs from the whitelist");
  if (meta.source.bytes !== row.bytes || meta.source.sha256.toUpperCase() !== row.sha256.toUpperCase()) throw new Error("source size / SHA-256 differ from the whitelist");
  const ext = /\.([a-z0-9]+)$/iu.exec(row.canonical_cp949_path)?.[1]?.toLowerCase() ?? "";
  if (row.category === "skill_effect_texture") {
    if (meta.kind !== "texture") throw new Error(`expected texture metadata, got ${String(meta.kind)}`);
    if ((ext !== "bmp" && ext !== "tga") || meta.format !== ext) throw new Error(`texture format ${meta.format} differs from .${ext}`);
    if (!Number.isInteger(meta.width) || !Number.isInteger(meta.height) || meta.width <= 0 || meta.height <= 0) throw new Error(`bad texture size ${meta.width}x${meta.height}`);
    if (meta.derived.file !== `${assetId}.png` || meta.derived.width !== meta.width || meta.derived.height !== meta.height || !/^[0-9A-F]{64}$/iu.test(meta.derived.sha256)) throw new Error("derived PNG declaration is invalid");
    if (meta.filter !== "nearest") throw new Error(`unsupported filter ${String(meta.filter)}`);
    if (ext === "tga" && (meta.bitsPerPixel !== 32 || meta.alpha.mode !== "source-alpha")) throw new Error("TGA metadata does not preserve 32-bit source alpha");
    if (ext === "bmp" && ((meta.bitsPerPixel !== 8 && meta.bitsPerPixel !== 24) || meta.alpha.mode !== "ro-color-key")) throw new Error("BMP metadata does not use the verified RO colour key");
    return meta;
  }
  if (row.category === "skill_effect_animation") {
    if (ext !== "str" || meta.kind !== "animation-source" || meta.format !== "str" || meta.magic !== "STRM" || meta.parsed !== false || meta.sourceOnly !== true) {
      throw new Error("STR metadata must remain an unparsed STRM source-only record");
    }
    if ("derived" in meta) throw new Error("unparsed STR metadata must not declare a derived animation");
    return meta;
  }
  throw new Error(`whitelist category ${row.category} is not a skill-effect category`);
}

export async function loadFormalScene(gateway: FormalGatewayLike, decoders: FormalDecoders, whitelist: AssetWhitelist): Promise<FormalSceneData> {
  const missing: MissingAsset[] = [];
  const fail = (id: string, reason: string): void => {
    missing.push(missingWhitelisted(whitelist, id, reason));
  };
  let scene: DerivedScene;
  let gnd: DerivedGnd;
  try {
    scene = await gateway.getJson<DerivedScene>(FORMAL_SCENE_ID);
    if (scene.converterVersion !== FORMAL_CONVERTER_VERSION) throw new Error(`derived converter v${scene.converterVersion}, client needs v${FORMAL_CONVERTER_VERSION}`);
  } catch (err) {
    fail(FORMAL_SCENE_ID, `derived scene unavailable (run pnpm assets:extract --profile fan-local): ${reasonOf(err)}`);
    throw new MissingAssetsError(missing);
  }
  try {
    gnd = await gateway.getJson<DerivedGnd>(scene.ground);
  } catch (err) {
    fail(scene.ground, `derived ground unavailable: ${reasonOf(err)}`);
    throw new MissingAssetsError(missing);
  }

  const req = sceneRequiredIds(scene);
  const models = new Map<string, DerivedModel>();
  let shadow: DerivedShadow | null = null;
  const images = new Map<string, ImageLike>();
  const water = new Map<string, ImageLike>();
  const audio = new Map<string, ArrayBuffer>();
  const effects = new Map<string, DerivedSkillEffect>();
  const effectImages = new Map<string, ImageLike>();
  const closeLoadedImages = (): void => {
    const seen = new Set<ImageLike>();
    for (const image of [...images.values(), ...water.values(), ...effectImages.values()]) {
      if (seen.has(image)) continue;
      seen.add(image);
      image.close?.();
    }
  };
  await Promise.all([
    ...req.derivedJson.filter((id) => id !== scene.ground).map(async (id) => {
      try {
        const j = await gateway.getJson<unknown>(id);
        if (id === `${scene.shadow}.act`) shadow = j as DerivedShadow;
        else models.set(id, j as DerivedModel);
      } catch (err) {
        fail(id, `derived JSON unavailable: ${reasonOf(err)}`);
      }
    }),
    ...req.derivedPng.map(async (id) => {
      try {
        images.set(id, await decoders.image(await gateway.getDerivedImage(id), "image/png"));
      } catch (err) {
        fail(id, `derived image unavailable: ${reasonOf(err)}`);
      }
    }),
    ...[...req.source, ...FORMAL_SKILL_AUDIO_IDS].map(async (id) => {
      try {
        const bytes = await gateway.getBinary(id);
        if (scene.water?.frames.includes(id)) water.set(id, await decoders.image(new Uint8Array(bytes), "image/jpeg"));
        else audio.set(id, bytes);
      } catch (err) {
        fail(id, `original asset unavailable: ${reasonOf(err)}`);
      }
    }),
    ...FORMAL_SKILL_EFFECT_IDS.map(async (id) => {
      try {
        const meta = checkedEffectMetadata(id, await gateway.getJson<unknown>(id), whitelist);
        effects.set(id, meta);
        if (meta.kind === "texture") {
          const bytes = await gateway.getDerivedImage(id);
          const hash = await sha256Upper(bytes);
          if (hash !== meta.derived.sha256.toUpperCase()) throw new Error(`derived PNG SHA-256 ${hash} != declared ${meta.derived.sha256}`);
          const image = await decoders.image(bytes, "image/png");
          if (image.width !== meta.width || image.height !== meta.height) {
            image.close?.();
            throw new Error(`decoded ${image.width}x${image.height} != declared ${meta.width}x${meta.height}`);
          }
          effectImages.set(id, image);
        }
      } catch (err) {
        effects.delete(id);
        fail(id, `official skill effect unavailable or invalid: ${reasonOf(err)}`);
      }
    }),
  ]);
  if (missing.length > 0) {
    closeLoadedImages();
    throw new MissingAssetsError(missing.sort((a, b) => ((a.assetId ?? "") < (b.assetId ?? "") ? -1 : 1)));
  }

  // Contract checks: every texture / model / sound the geometry references must be present.
  for (const t of gnd.textures) if (!t.assetId || !images.has(t.assetId)) missing.push({ assetId: t.assetId, container: "data.grf", canonicalPath: `data\\texture\\${t.name}`, reason: "GND texture not loaded" });
  for (const m of models.values()) for (const t of m.textures) if (!t.assetId || !images.has(t.assetId)) missing.push({ assetId: t.assetId, container: "data.grf", canonicalPath: `data\\texture\\${t.name}`, reason: `texture of ${m.assetId} not loaded` });
  if (scene.water && scene.water.frames.length !== 32) fail(FORMAL_SCENE_ID, `water type ${scene.water.type ?? "?"} has ${scene.water.frames.length} frames, expected 32`);
  if (missing.length > 0) {
    closeLoadedImages();
    throw new MissingAssetsError(missing);
  }
  const derived = (id: string, fn: () => void): void => {
    try {
      fn();
    } catch (err) {
      fail(id, `invalid derived contract: ${reasonOf(err)}`);
    }
  };
  let ground: GroundBuffers = { groups: [], quads: 0 };
  let instances: ModelInstance[] = [];
  let sp: ReturnType<typeof shadowParams> | null = null;
  let sounds: ReturnType<typeof soundPlacements> = [];
  const baked = new Map<string, BakedModel>();
  derived(scene.ground, () => (ground = buildGroundBuffers(gnd)));
  derived(FORMAL_SCENE_ID, () => (instances = buildModelInstances(scene, gnd, models)));
  derived(FORMAL_SCENE_ID, () => (sounds = soundPlacements(scene, gnd)));
  for (const [id, m] of models) derived(id, () => baked.set(id, bakeModel(m)));
  let waterCells: WaterBuffers | null = null;
  const w = scene.water;
  if (w) {
    derived(FORMAL_SCENE_ID, () => {
      const b = buildWaterBuffers(gnd, w.level);
      // Fail closed: the renderer's cell selection must equal the extractor's count.
      if (b.cells !== w.cells) throw new Error(`water: ${b.cells} GND cells selected, derived scene says ${w.cells}`);
      waterCells = b;
    });
  }
  const sh = shadow as DerivedShadow | null;
  if (!sh) fail(`${scene.shadow}.act`, "official shadow ACT not loaded");
  else derived(`${scene.shadow}.act`, () => (sp = shadowParams(sh)));
  if (missing.length > 0 || !sh || !sp) {
    closeLoadedImages();
    throw new MissingAssetsError(missing);
  }
  return { scene, gnd, ground, models, baked, instances, shadow: sh, shadowParams: sp, sounds, images, water, waterCells, audio, effects, effectImages };
}
