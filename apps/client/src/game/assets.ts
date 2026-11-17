import type { WalkGrid } from "@ro-survivor/core-sim";
import type { AssetGateway } from "@ro-survivor/asset-contracts";
import { isHttpGateway } from "../gateway.ts";
import type { GroundData } from "./renderer.ts";
import { placeholderSheet, sheetFromDerived, type SheetData, type SpriteSheet } from "./sprites.ts";

export interface LoadedAssets {
  player: SpriteSheet;
  enemy: SpriteSheet;
  ground: GroundData | null;
  grid: WalkGrid | null;
  start: { x: number; y: number } | undefined;
  notes: string[];
}

interface MapMeta {
  gat: GroundData;
  spawn: { x: number; y: number };
}

/** Real derived assets through the gateway when available; every failure falls back per item with a note. */
export async function loadAssets(gateway: AssetGateway): Promise<LoadedAssets> {
  const notes: string[] = [];
  let player = placeholderSheet("player");
  let enemy = placeholderSheet("monster");
  let ground: GroundData | null = null;
  let grid: WalkGrid | null = null;
  let start: { x: number; y: number } | undefined;
  if (!isHttpGateway(gateway)) return { player, enemy, ground, grid, start, notes: ["placeholder sprites and field"] };
  const sheet = async (spr: string, act: string): Promise<SpriteSheet> => sheetFromDerived(await gateway.getDerivedImage(spr), await gateway.getJson<SheetData>(act));
  try {
    player = await sheet("player.swordsman.male.body.spr", "player.swordsman.male.body.act");
  } catch (err) {
    notes.push(`player sprite fallback: ${String(err)}`);
  }
  try {
    enemy = await sheet("monster.1002.spr", "monster.1002.act");
  } catch (err) {
    notes.push(`poring sprite fallback: ${String(err)}`);
  }
  try {
    const map = await gateway.getJson<MapMeta>("map.prt_fild08.gat");
    ground = map.gat;
    const walkable = new Uint8Array(map.gat.width * map.gat.height);
    for (let i = 0; i < walkable.length; i += 1) {
      const t = map.gat.types.charCodeAt(i) - 48;
      walkable[i] = t === 0 || t === 3 ? 1 : 0;
    }
    grid = { width: map.gat.width, height: map.gat.height, cellMm: 1000, walkable };
    start = { x: map.spawn.x * 1000 + 500, y: map.spawn.y * 1000 + 500 };
  } catch (err) {
    notes.push(`map fallback: ${String(err)}`);
  }
  return { player, enemy, ground, grid, start, notes };
}
