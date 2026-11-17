import type { WalkGrid } from "@ro-survivor/core-sim";
import { formalRequiredIds, formalUiRequiredIds, missingFromWhitelist, resolveMapClosure, type HttpAssetGatewayClient } from "@ro-survivor/asset-contracts";
import { whitelist } from "../gateway.ts";
import type { GroundData } from "./renderer.ts";
import { FORMAL_SCENE, FormalRendererPendingError, MissingAssetsError, missingWhitelisted, type MissingAsset } from "./requirements.ts";
import { sheetFromDerived, type SheetData, type SpriteSheet } from "./sprites.ts";

export interface LoadedAssets {
  player: SpriteSheet;
  /** Sprite sheet per monster asset ref (e.g. "monster.1002"). */
  enemies: Record<string, SpriteSheet>;
  ground: GroundData;
  grid: WalkGrid;
  start: { x: number; y: number };
  /** Requirements that test-fixture mode tolerated (never tolerated in the formal game). */
  tolerated: MissingAsset[];
}

interface MapMeta {
  gat: GroundData;
  spawn: { x: number; y: number };
  dependencies: { textures: string[]; models: string[]; sounds: string[]; waterType?: number | null };
}

/**
 * Formal stages the client cannot render yet. Until CLAUDE-PHASE1-ORIGINAL-ASSETS.md Commit C lands, a
 * formal run stops here even with every source present (no engine-drawn ground / ellipse shadow).
 */
export const FORMAL_RENDERER_PENDING: readonly string[] = [
  "GND textured ground + embedded lightmap",
  "RSM 1.4 props (23 models / 570 placements)",
  "water (32 official JPG frames)",
  "four-layer swordsman composition",
  "official shadow.spr/act",
  "BGM 12 + RSW ambient WAV",
];

/**
 * Load the formal arena from the user's RO client via the local gateway, fail-closed:
 * 1. every formal asset ID (scene + core UI) must be whitelisted; 2. every source must exist with the whitelisted size;
 * 3. derived atlases / map data must exist; 4. every GND / RSW reference must resolve to a whitelisted
 * ID (only genuinely unresolvable references are reported). `fixtureMode` (automated tests only)
 * skips the source and closure checks that synthetic fixtures cannot satisfy.
 */
export async function loadFormalAssets(gateway: HttpAssetGatewayClient, fixtureMode: boolean): Promise<LoadedAssets> {
  // Scene closure + core RO UI closure (KRO2021_CLASSIC_V0_FAN): the world canvas is never created
  // unless every one is present; a missing UI bitmap is never replaced by a CSS / Canvas surface.
  const required = [...formalRequiredIds(whitelist), ...formalUiRequiredIds(whitelist)];
  const missing: MissingAsset[] = missingFromWhitelist(whitelist, required).map((m) => ({ ...m }));
  if (missing.length > 0) throw new MissingAssetsError(missing);
  if (!fixtureMode) {
    for (const id of required) {
      try {
        await gateway.checkSource(id);
      } catch (err) {
        missing.push(missingWhitelisted(whitelist, id, `source unavailable: ${err instanceof Error ? err.message : String(err)}`));
      }
    }
    if (missing.length > 0) throw new MissingAssetsError(missing);
  }

  const derived = async <T>(fn: () => Promise<T>, ids: string[]): Promise<T | null> => {
    try {
      return await fn();
    } catch (err) {
      for (const id of ids) missing.push(missingWhitelisted(whitelist, id, `derived output missing (run pnpm assets:extract --profile fan-local): ${err instanceof Error ? err.message : String(err)}`));
      return null;
    }
  };
  const playerBody = FORMAL_SCENE.player.layers[0];
  const player = await derived(async () => sheetFromDerived(await gateway.getDerivedImage(`${playerBody}.spr`), await gateway.getJson<SheetData>(`${playerBody}.act`)), [`${playerBody}.spr`, `${playerBody}.act`]);
  const enemies: Record<string, SpriteSheet> = {};
  for (const ref of FORMAL_SCENE.enemies) {
    const sheet = await derived(async () => sheetFromDerived(await gateway.getDerivedImage(`${ref}.spr`), await gateway.getJson<SheetData>(`${ref}.act`)), [`${ref}.spr`, `${ref}.act`]);
    if (sheet) enemies[ref] = sheet;
  }
  const map = await derived(() => gateway.getJson<MapMeta>("map.prt_fild08.gat"), ["map.prt_fild08.gat"]);

  // Map closure: canonical path -> asset ID; only references without a whitelist row are missing.
  const closure = map
    ? resolveMapClosure(whitelist, { groundTextures: map.dependencies.textures, models: map.dependencies.models, modelTextures: [], sounds: map.dependencies.sounds, waterType: map.dependencies.waterType ?? null })
    : { ids: [], missing: [] };
  const closureMissing: MissingAsset[] = closure.missing.map((m) => ({ ...m }));
  if (!fixtureMode) missing.push(...closureMissing);
  if (missing.length > 0 || !player || Object.keys(enemies).length !== FORMAL_SCENE.enemies.length || !map) throw new MissingAssetsError(missing);
  if (!fixtureMode) throw new FormalRendererPendingError([...FORMAL_RENDERER_PENDING]);

  const walkable = new Uint8Array(map.gat.width * map.gat.height);
  for (let i = 0; i < walkable.length; i += 1) {
    const t = map.gat.types.charCodeAt(i) - 48;
    walkable[i] = t === 0 || t === 3 ? 1 : 0;
  }
  return {
    player,
    enemies,
    ground: map.gat,
    grid: { width: map.gat.width, height: map.gat.height, cellMm: 1000, walkable },
    start: { x: map.spawn.x * 1000 + 500, y: map.spawn.y * 1000 + 500 },
    tolerated: closureMissing,
  };
}
