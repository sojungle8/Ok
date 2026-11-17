import type { WalkGrid } from "@ro-survivor/core-sim";
import { HttpAssetGatewayClient } from "@ro-survivor/asset-contracts";
import { whitelist } from "../gateway.ts";
import type { GroundData } from "./renderer.ts";
import { dependencyPath, FORMAL_SCENE, formalSourceIds, MissingAssetsError, missingWhitelisted, type MissingAsset } from "./requirements.ts";
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
  dependencies: { textures: string[]; models: string[]; sounds: string[] };
}

/**
 * Load the formal arena from the user's RO client via the local gateway. Any missing piece throws
 * MissingAssetsError listing canonical paths; nothing is substituted. `fixtureMode` (automated
 * tests only) tolerates map textures/models that synthetic fixtures cannot provide.
 */
export async function loadFormalAssets(gateway: HttpAssetGatewayClient, fixtureMode: boolean): Promise<LoadedAssets> {
  const missing: MissingAsset[] = [];
  // 1. Source entries must exist in the user's GRF (the gateway verifies size/hash against the
  //    whitelist). Synthetic fixtures have other sizes, so test-fixture builds skip this step.
  for (const id of fixtureMode ? [] : formalSourceIds()) {
    if (!whitelist.has(id)) {
      missing.push(missingWhitelisted(whitelist, id, "not in fan-local whitelist"));
      continue;
    }
    try {
      await gateway.getBinary(id);
    } catch (err) {
      missing.push(missingWhitelisted(whitelist, id, `source unavailable: ${err instanceof Error ? err.message : String(err)}`));
    }
  }
  if (missing.length > 0) throw new MissingAssetsError(missing);

  // 2. Derived atlases/metadata produced from those sources by `pnpm assets:extract --profile fan-local`.
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

  // 3. Map visuals: every GND texture and RSW model must be available. They are not whitelisted
  //    yet (GAP-002), so they are reported by canonical path instead of being replaced.
  const mapDeps: MissingAsset[] = map
    ? [
        ...map.dependencies.textures.map((t) => ({ assetId: null, canonicalPath: dependencyPath("texture", t), container: "data.grf", reason: "GND texture not whitelisted (GAP-002)" })),
        ...map.dependencies.models.map((m) => ({ assetId: null, canonicalPath: dependencyPath("model", m), container: "data.grf", reason: "RSW model not whitelisted (GAP-002)" })),
      ]
    : [];
  if (!fixtureMode) missing.push(...mapDeps);
  if (missing.length > 0 || !player || Object.keys(enemies).length !== FORMAL_SCENE.enemies.length || !map) throw new MissingAssetsError(missing);

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
    tolerated: fixtureMode ? mapDeps : [],
  };
}
