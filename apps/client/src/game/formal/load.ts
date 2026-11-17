/**
 * Formal scene loading: every derived file and source asset of the scene contract is fetched by
 * logical ID from the local gateway and checked; any failure (missing, unreadable, invalid) blocks the
 * world with asset ID + canonical path. Nothing is substituted.
 */
import type { AssetWhitelist } from "@ro-survivor/asset-contracts";
import { MissingAssetsError, missingWhitelisted, type MissingAsset } from "../requirements.ts";
import {
  bakeModel, buildGroundBuffers, buildModelInstances, buildWaterBuffers, sceneRequiredIds, shadowParams, soundPlacements,
  type BakedModel, type DerivedGnd, type DerivedModel, type DerivedScene, type DerivedShadow, type GroundBuffers, type ModelInstance, type WaterBuffers,
} from "./contract.ts";

export const FORMAL_SCENE_ID = "map.prt_fild08.rsw";
export const FORMAL_CONVERTER_VERSION = 2;

export interface ImageLike {
  width: number;
  height: number;
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
  /** Original audio bytes by asset ID (BGM 12 + ambient WAVs). */
  audio: Map<string, ArrayBuffer>;
}

const reasonOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

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
    ...req.source.map(async (id) => {
      try {
        const bytes = await gateway.getBinary(id);
        if (scene.water?.frames.includes(id)) water.set(id, await decoders.image(new Uint8Array(bytes), "image/jpeg"));
        else audio.set(id, bytes);
      } catch (err) {
        fail(id, `original asset unavailable: ${reasonOf(err)}`);
      }
    }),
  ]);
  if (missing.length > 0) throw new MissingAssetsError(missing.sort((a, b) => ((a.assetId ?? "") < (b.assetId ?? "") ? -1 : 1)));

  // Contract checks: every texture / model / sound the geometry references must be present.
  for (const t of gnd.textures) if (!t.assetId || !images.has(t.assetId)) missing.push({ assetId: t.assetId, container: "data.grf", canonicalPath: `data\\texture\\${t.name}`, reason: "GND texture not loaded" });
  for (const m of models.values()) for (const t of m.textures) if (!t.assetId || !images.has(t.assetId)) missing.push({ assetId: t.assetId, container: "data.grf", canonicalPath: `data\\texture\\${t.name}`, reason: `texture of ${m.assetId} not loaded` });
  if (scene.water && scene.water.frames.length !== 32) fail(FORMAL_SCENE_ID, `water type ${scene.water.type ?? "?"} has ${scene.water.frames.length} frames, expected 32`);
  if (missing.length > 0) throw new MissingAssetsError(missing);
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
  if (missing.length > 0 || !sh || !sp) throw new MissingAssetsError(missing);
  return { scene, gnd, ground, models, baked, instances, shadow: sh, shadowParams: sp, sounds, images, water, waterCells, audio };
}
