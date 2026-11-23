import type { WalkGrid } from "@ro-survivor/core-sim";
import { CANONICAL_WHITELIST_SHA256, FORMAL_JOB_PLAYERS, formalRequiredIds, jobPlayerIds, formalUiRequiredIds, missingFromWhitelist, resolveMapClosure, UI_PROFILE_ID, type HttpAssetGatewayClient } from "@ro-survivor/asset-contracts";
import { whitelist } from "../gateway.ts";
import { disposeFormalScene, loadFormalScene, type FormalDecoders, type FormalSceneData } from "./formal/load.ts";
import { loadFormalUiAssets, type FormalUiAssets } from "./formal/ui.ts";
import type { GroundData } from "./renderer.ts";
import { FORMAL_SCENE, MissingAssetsError, missingWhitelisted, type MissingAsset } from "./requirements.ts";
import { sheetFromDerived, type SheetData, type SpriteSheet } from "./sprites.ts";

export interface LoadedAssets {
  player: SpriteSheet;
  /** Sprite sheet per monster asset ref (e.g. "monster.1002"). */
  enemies: Record<string, SpriteSheet>;
  /** GAT walk grid / heights (gameplay terrain; not a visual). */
  ground: GroundData;
  grid: WalkGrid;
  start: { x: number; y: number };
  /** Formal scene (original GND / RSM / water / shadow / audio). Null only in test-fixture mode. */
  formal: FormalSceneData | null;
  /** Verified original RO UI registry. Null only in the synthetic test-fixture build. */
  ui: FormalUiAssets | null;
  /** Requirements that test-fixture mode tolerated (never tolerated in the formal game). */
  tolerated: MissingAsset[];
}

interface MapMeta {
  gat: GroundData;
  spawn: { x: number; y: number };
  dependencies: { textures: string[]; models: string[]; sounds: string[]; waterType?: number | null };
}

/**
 * The swordsman atlas must be composed from all four layer sets with the original palettes
 * (body, hair, sword, guard). A body-only sheet is never accepted on the formal screen.
 */
export function checkPlayerLayers(data: SheetData, list = whitelist, job = "job.swordsman"): MissingAsset[] {
  const set = job === "job.swordsman" ? FORMAL_SCENE.player : FORMAL_JOB_PLAYERS[job];
  if (!set) return [{ assetId: null, container: "data.grf", canonicalPath: "(unknown job)", reason: `job ${job} has no formal player layer set` }];
  const [body] = set.layers;
  // Body and hair carry their original palettes; weapon / shield overlays use their own.
  const expected: { spr: string; palette: string | null }[] = set.layers.map((layer, i) => ({ spr: `${layer}.spr`, palette: set.palettes[i] ?? null }));
  const n = expected.length;
  const got = data.layers ?? [];
  const problems: MissingAsset[] = [];
  expected.forEach((e, i) => {
    const l = got[i];
    if (!l || l.spr !== e.spr) problems.push(missingWhitelisted(list, e.spr, `player atlas layer ${i} is ${l?.spr ?? "absent"} (re-run pnpm assets:extract --profile fan-local)`));
    else if (e.palette && l.palette !== e.palette) problems.push(missingWhitelisted(list, e.palette, `player layer ${e.spr} was composed without its original palette`));
  });
  const all = Array.from({ length: n }, (_, i) => i).join();
  if (!data.layerOrder || data.layerOrder.length !== 8 || data.layerOrder.some((o) => [...o].sort().join() !== all)) {
    problems.push(missingWhitelisted(list, `${body ?? "player"}.act`, `player atlas has no per-direction layer order for all ${n} layers`));
  }
  return problems;
}

const browserDecoders: FormalDecoders = {
  async image(bytes, type) {
    return createImageBitmap(new Blob([bytes as Uint8Array<ArrayBuffer>], { type }), { imageOrientation: "none", premultiplyAlpha: "none" });
  },
};

/**
 * Load the arena from the user's RO client via the local gateway, fail-closed:
 * 1. every formal asset ID (scene + core UI) must be whitelisted; 2. every source must exist with the
 * whitelisted size; 3. derived atlases / map data must exist; 4. every GND / RSW reference must
 * resolve; 5. (formal) the derived scene contract loads completely and the player atlas has all four
 * layers. `fixtureMode` (automated tests only) skips the source, closure and formal-scene steps that
 * synthetic fixtures cannot satisfy.
 */
export async function loadFormalAssets(gateway: HttpAssetGatewayClient, fixtureMode: boolean, decoders: FormalDecoders = browserDecoders, job = "job.swordsman"): Promise<LoadedAssets> {
  // Test-fixture builds have no synthetic sprites per job; they reuse the Swordsman fixture sheet.
  const jobIds = job === "job.swordsman" || fixtureMode ? [] : jobPlayerIds(job);
  const required = [...formalRequiredIds(whitelist), ...formalUiRequiredIds(whitelist), ...jobIds];
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
  const playerBody = (job === "job.swordsman" || fixtureMode ? FORMAL_SCENE.player.layers : FORMAL_JOB_PLAYERS[job]?.layers ?? [])[0] as string;
  const playerData = await derived(() => gateway.getJson<SheetData>(`${playerBody}.act`), [`${playerBody}.act`]);
  const player = playerData ? await derived(async () => sheetFromDerived(await gateway.getDerivedImage(`${playerBody}.spr`), playerData), [`${playerBody}.spr`]) : null;
  if (playerData && !fixtureMode) missing.push(...checkPlayerLayers(playerData, whitelist, job));
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
  // Formal scene: original GND / RSM / water / shadow / audio, all or nothing.
  let formal: FormalSceneData | null = null;
  let ui: FormalUiAssets | null = null;
  if (!fixtureMode) {
    formal = await loadFormalScene(gateway, decoders, whitelist);
    try {
      ui = await loadFormalUiAssets(gateway, decoders, whitelist, { profileId: UI_PROFILE_ID, whitelistSha256: CANONICAL_WHITELIST_SHA256 });
    } catch (err) {
      disposeFormalScene(formal);
      throw err;
    }
  }

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
    formal,
    ui,
    tolerated: closureMissing,
  };
}
