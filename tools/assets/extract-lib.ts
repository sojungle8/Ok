import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { WhitelistRow } from "@ro-survivor/content-schema";
import {
  actionIndex, composeFrame, floodReachable, isWalkable, mapDependencies, MONSTER_ACTIONS, parseAct, parseGat, parseGnd, parseRsw, parseSpr, PLAYER_ACTIONS,
  type Act, type ComposedFrame, type Sprite,
} from "@ro-survivor/ro-format-runtime";
import { DERIVED_MARKER, encodePng } from "../lib/png.ts";

import { CONVERTER_VERSION } from "@ro-survivor/asset-gateway";
export { CONVERTER_VERSION };
const sha = (b: Uint8Array): string => createHash("sha256").update(b).digest("hex").toUpperCase();

/** Gameplay animation slots; each maps to an ACT action group, or falls back explicitly. */
export const ANIMATION_SLOTS = ["idle", "walk", "attack", "hit", "death", "cast"] as const;
export type AnimationSlot = (typeof ANIMATION_SLOTS)[number];

const SLOT_SOURCE: Record<"player" | "monster", Record<AnimationSlot, string[]>> = {
  player: { idle: ["idle"], walk: ["walk"], attack: ["attack1", "attack2", "attack3"], hit: ["hit"], death: ["death"], cast: ["cast", "ready"] },
  monster: { idle: ["idle"], walk: ["walk"], attack: ["attack"], hit: ["hit"], death: ["death"], cast: ["cast", "attack", "idle"] },
};

export interface AtlasFrameRef {
  /** Atlas rectangle. */
  x: number;
  y: number;
  w: number;
  h: number;
  originX: number;
  originY: number;
  /** Draw mirrored (UV flip) — the pixels are stored once. */
  flipX: boolean;
}

export interface SpriteMetadata {
  rights: string;
  assetId: string;
  converterVersion: number;
  kind: "player" | "monster";
  actVersion: string;
  actionCount: number;
  atlas: { width: number; height: number; sha256: string };
  slots: Record<AnimationSlot, { sourceAction: string; fallback: boolean; directions: { frames: number[]; delayMs: number }[] }>;
  frames: AtlasFrameRef[];
  sounds: { slot: AnimationSlot; direction: number; frame: number; sound: string }[];
  stats: { composedFrames: number; uniqueImages: number; mirrorDeduped: number; exactDeduped: number; rotatedLayers: number };
}

function mirrorRgba(f: ComposedFrame): Uint8Array {
  const out = new Uint8Array(f.rgba.length);
  for (let y = 0; y < f.height; y += 1) {
    for (let x = 0; x < f.width; x += 1) {
      out.set(f.rgba.subarray((y * f.width + x) * 4, (y * f.width + x) * 4 + 4), (y * f.width + (f.width - 1 - x)) * 4);
    }
  }
  return out;
}

/** Shelf packer; deterministic for a given input order. */
function pack(sizes: { w: number; h: number }[], maxWidth = 2048): { positions: { x: number; y: number }[]; width: number; height: number } {
  const positions: { x: number; y: number }[] = [];
  let x = 0;
  let y = 0;
  let shelf = 0;
  let width = 0;
  for (const s of sizes) {
    if (x + s.w + 1 > maxWidth) {
      x = 0;
      y += shelf + 1;
      shelf = 0;
    }
    positions.push({ x, y });
    x += s.w + 1;
    shelf = Math.max(shelf, s.h);
    width = Math.max(width, x);
  }
  return { positions, width: Math.max(1, width), height: Math.max(1, y + shelf) };
}

export interface LayerSet {
  sprite: Sprite;
  act: Act;
}

/**
 * Build atlas + metadata for one actor. `layers[0]` drives the clock (body); other layer sets
 * (hair, weapon, shield) use the same action/frame index. Missing overlay frames are an error
 * naming the asset, never a silent misalignment.
 */
export function buildSpriteAtlas(assetId: string, kind: "player" | "monster", layers: LayerSet[], layerIds: string[]): { metadata: SpriteMetadata; png: Buffer; composed: Map<string, ComposedFrame> } {
  const base = layers[0];
  if (!base) throw new Error(`${assetId}: no layers`);
  const groups = (kind === "player" ? PLAYER_ACTIONS : MONSTER_ACTIONS) as readonly string[];
  const groupCount = Math.floor(base.act.actions.length / 8);
  const images: { rgba: Uint8Array; w: number; h: number; originX: number; originY: number }[] = [];
  const byHash = new Map<string, number>();
  const frames: AtlasFrameRef[] = [];
  const frameIndex = new Map<string, number>();
  const stats = { composedFrames: 0, uniqueImages: 0, mirrorDeduped: 0, exactDeduped: 0, rotatedLayers: 0 };
  const composed = new Map<string, ComposedFrame>();
  const sounds: SpriteMetadata["sounds"] = [];
  const slots = {} as SpriteMetadata["slots"];

  for (const slot of ANIMATION_SLOTS) {
    const candidates = SLOT_SOURCE[kind][slot];
    const found = candidates.find((c) => groups.indexOf(c) >= 0 && groups.indexOf(c) < groupCount);
    if (!found) throw new Error(`${assetId}: no action group for slot ${slot}`);
    const group = groups.indexOf(found);
    const directions: { frames: number[]; delayMs: number }[] = [];
    for (let dir = 0; dir < 8; dir += 1) {
      const ai = actionIndex(group, dir);
      const action = base.act.actions[ai];
      if (!action) throw new Error(`${assetId}: missing action ${ai}`);
      const refs: number[] = [];
      action.frames.forEach((_, fi) => {
        const sources = layers.map((l, li) => {
          const a = l.act.actions[ai];
          const frame = a?.frames[fi] ?? a?.frames[a.frames.length - 1];
          if (!frame) throw new Error(`${layerIds[li] ?? assetId}: overlay has no frame for action ${ai} frame ${fi}`);
          return { sprite: l.sprite, frame };
        });
        const c = composeFrame(sources);
        stats.composedFrames += 1;
        stats.rotatedLayers += c.rotatedLayers;
        composed.set(`${slot}:${dir}:${fi}`, c);
        const key = `${c.width}x${c.height}:${c.originX},${c.originY}:${sha(c.rgba)}`;
        const mirrorKey = `${c.width}x${c.height}:${c.width - c.originX},${c.originY}:${sha(mirrorRgba(c))}`;
        let image = byHash.get(key);
        let flipX = false;
        if (image !== undefined) stats.exactDeduped += 1;
        else if ((image = byHash.get(mirrorKey)) !== undefined) {
          flipX = true;
          stats.mirrorDeduped += 1;
        } else {
          images.push({ rgba: c.rgba, w: c.width, h: c.height, originX: c.originX, originY: c.originY });
          image = images.length - 1;
          byHash.set(key, image);
        }
        const refKey = `${image}:${flipX ? 1 : 0}`;
        let ref = frameIndex.get(refKey);
        if (ref === undefined) {
          frames.push({ x: 0, y: 0, w: c.width, h: c.height, originX: c.originX, originY: c.originY, flipX, image } as AtlasFrameRef & { image: number });
          ref = frames.length - 1;
          frameIndex.set(refKey, ref);
        }
        refs.push(ref);
        const sIdx = base.act.actions[ai]?.frames[fi]?.soundIndex ?? -1;
        if (sIdx >= 0) sounds.push({ slot, direction: dir, frame: fi, sound: base.act.sounds[sIdx] ?? `#${sIdx}` });
      });
      directions.push({ frames: refs, delayMs: Math.round(action.delay * 25) });
    }
    slots[slot] = { sourceAction: found, fallback: found !== candidates[0], directions };
  }

  stats.uniqueImages = images.length;
  const layout = pack(images.map((i) => ({ w: i.w, h: i.h })));
  const atlas = new Uint8Array(layout.width * layout.height * 4);
  images.forEach((img, i) => {
    const pos = layout.positions[i] as { x: number; y: number };
    for (let y = 0; y < img.h; y += 1) atlas.set(img.rgba.subarray(y * img.w * 4, (y + 1) * img.w * 4), ((pos.y + y) * layout.width + pos.x) * 4);
  });
  for (const f of frames) {
    const ext = f as AtlasFrameRef & { image?: number };
    const pos = layout.positions[ext.image as number] as { x: number; y: number };
    f.x = pos.x;
    f.y = pos.y;
    delete ext.image;
  }
  const png = encodePng(layout.width, layout.height, atlas, DERIVED_MARKER);
  return {
    metadata: {
      rights: DERIVED_MARKER, assetId, converterVersion: CONVERTER_VERSION, kind, actVersion: base.act.version, actionCount: base.act.actions.length,
      atlas: { width: layout.width, height: layout.height, sha256: sha(png) }, slots, frames, sounds, stats,
    },
    png,
    composed,
  };
}

/**
 * Contact sheet: one row per (slot, direction), frames left to right. Each cell shows the frame,
 * a red pivot cross at the foot origin and a grey ground-shadow ellipse for manual review.
 */
export function buildContactSheet(meta: SpriteMetadata, composed: Map<string, ComposedFrame>): Buffer {
  const cells: ComposedFrame[] = [...composed.values()];
  const cw = Math.max(16, ...cells.map((c) => Math.max(c.originX, c.width - c.originX) * 2)) + 8;
  const ch = Math.max(16, ...cells.map((c) => c.height)) + 16;
  const cols = Math.max(...ANIMATION_SLOTS.flatMap((s) => meta.slots[s].directions.map((d) => d.frames.length)));
  const rows = ANIMATION_SLOTS.length * 8;
  const W = cols * cw;
  const H = rows * ch;
  const out = new Uint8Array(W * H * 4);
  const put = (x: number, y: number, r: number, g: number, b: number, a = 255): void => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    const fa = a / 255;
    out[i] = Math.round(r * fa + (out[i] as number) * (1 - fa));
    out[i + 1] = Math.round(g * fa + (out[i + 1] as number) * (1 - fa));
    out[i + 2] = Math.round(b * fa + (out[i + 2] as number) * (1 - fa));
    out[i + 3] = 255;
  };
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) put(x, y, ((Math.floor(x / 8) + Math.floor(y / 8)) % 2) ? 205 : 230, 205, 215);
  ANIMATION_SLOTS.forEach((slot, si) => {
    for (let dir = 0; dir < 8; dir += 1) {
      const n = meta.slots[slot].directions[dir]?.frames.length ?? 0;
      for (let fi = 0; fi < n; fi += 1) {
        const c = composed.get(`${slot}:${dir}:${fi}`);
        if (!c) continue;
        const ox = fi * cw + Math.floor(cw / 2);
        const oy = (si * 8 + dir) * ch + ch - 6;
        for (let dy = -3; dy <= 3; dy += 1) for (let dx = -10; dx <= 10; dx += 1) if ((dx * dx) / 100 + (dy * dy) / 9 <= 1) put(ox + dx, oy + dy, 60, 60, 60, 110);
        for (let y = 0; y < c.height; y += 1) {
          for (let x = 0; x < c.width; x += 1) {
            const s = (y * c.width + x) * 4;
            const a = c.rgba[s + 3] as number;
            if (a > 0) put(ox - c.originX + x, oy - c.originY + y, c.rgba[s] as number, c.rgba[s + 1] as number, c.rgba[s + 2] as number, a);
          }
        }
        for (let k = -3; k <= 3; k += 1) {
          put(ox + k, oy, 230, 30, 30);
          put(ox, oy + k, 230, 30, 30);
        }
      }
    }
  });
  return encodePng(W, H, out, DERIVED_MARKER);
}

export interface MapExtraction {
  metadata: {
    rights: string;
    assetId: string;
    converterVersion: number;
    rswVersion: string;
    gndVersion: string;
    gatVersion: string;
    gat: { width: number; height: number; types: string; cellHeights: number[] };
    gnd: { width: number; height: number; zoom: number; cubeHeights: number[] };
    spawn: { x: number; y: number };
    flood: { walkable: number; reachableFromSpawn: number; ratio: number };
    dependencies: ReturnType<typeof mapDependencies>;
  };
  walkPng: Buffer;
}

/** Map spike data: GAT walk grid + GND heights + dependency closure (RSM/textures are reported, not loaded). */
export function extractMap(assetId: string, rswBytes: Uint8Array, gndBytes: Uint8Array, gatBytes: Uint8Array): MapExtraction {
  const rsw = parseRsw(rswBytes);
  const gnd = parseGnd(gndBytes);
  const gat = parseGat(gatBytes);
  let walkable = 0;
  const types: string[] = [];
  const cellHeights: number[] = [];
  for (let i = 0; i < gat.width * gat.height; i += 1) {
    const t = gat.types[i] as number;
    types.push(t > 9 ? "9" : String(t));
    if (t === 0 || t === 3) walkable += 1;
    cellHeights.push(Math.round((((gat.heights[i * 4] as number) + (gat.heights[i * 4 + 1] as number) + (gat.heights[i * 4 + 2] as number) + (gat.heights[i * 4 + 3] as number)) / 4) * 100) / 100);
  }
  // Spawn: walkable cell closest to the centre.
  let spawn = { x: Math.floor(gat.width / 2), y: Math.floor(gat.height / 2) };
  let best = Infinity;
  for (let y = 0; y < gat.height; y += 1) {
    for (let x = 0; x < gat.width; x += 1) {
      if (!isWalkable(gat, x, y)) continue;
      const d = (x - gat.width / 2) ** 2 + (y - gat.height / 2) ** 2;
      if (d < best) {
        best = d;
        spawn = { x, y };
      }
    }
  }
  const flood = floodReachable(gat, spawn.x, spawn.y);
  const img = new Uint8Array(gat.width * gat.height * 4);
  for (let y = 0; y < gat.height; y += 1) {
    for (let x = 0; x < gat.width; x += 1) {
      const src = y * gat.width + x;
      const dst = ((gat.height - 1 - y) * gat.width + x) * 4; // north up
      const t = gat.types[src] as number;
      const reach = flood.mask[src] === 1;
      const [r, g, b] = reach ? [70, 170, 80] : t === 0 || t === 3 ? [200, 170, 60] : [60, 60, 70];
      img[dst] = r;
      img[dst + 1] = g;
      img[dst + 2] = b;
      img[dst + 3] = 255;
    }
  }
  return {
    metadata: {
      rights: DERIVED_MARKER, assetId, converterVersion: CONVERTER_VERSION, rswVersion: rsw.version, gndVersion: gnd.version, gatVersion: gat.version,
      gat: { width: gat.width, height: gat.height, types: types.join(""), cellHeights },
      gnd: { width: gnd.width, height: gnd.height, zoom: gnd.zoom, cubeHeights: gnd.cubes.map((c) => Math.round(((c.heights[0] + c.heights[1] + c.heights[2] + c.heights[3]) / 4) * 100) / 100) },
      spawn,
      flood: { walkable, reachableFromSpawn: flood.count, ratio: walkable === 0 ? 0 : Math.round((flood.count / walkable) * 10000) / 10000 },
      dependencies: mapDependencies(rsw, gnd.textures),
    },
    walkPng: encodePng(gat.width, gat.height, img, DERIVED_MARKER),
  };
}

/** Sprite groups of the whitelist: actor id -> layer asset ids (body first). */
export function spriteGroups(rows: readonly WhitelistRow[]): { id: string; kind: "player" | "monster"; layers: { spr: string; act: string; palette?: string }[] }[] {
  const ids = new Set(rows.map((r) => r.asset_id));
  const out: ReturnType<typeof spriteGroups> = [];
  for (const sex of ["male", "female"] as const) {
    const body = `player.swordsman.${sex}.body`;
    if (!ids.has(`${body}.spr`)) continue;
    out.push({
      id: `player.swordsman.${sex}`,
      kind: "player",
      layers: [
        { spr: `${body}.spr`, act: `${body}.act`, palette: `palette.body.swordsman.${sex}` },
        { spr: `player.hair01.${sex}.spr`, act: `player.hair01.${sex}.act`, palette: `palette.hair01.${sex}` },
        { spr: `player.swordsman.${sex}.sword.spr`, act: `player.swordsman.${sex}.sword.act` },
        { spr: `player.swordsman.${sex}.guard.spr`, act: `player.swordsman.${sex}.guard.act` },
      ].filter((l) => ids.has(l.spr) && ids.has(l.act)),
    });
  }
  for (const r of rows) {
    const m = /^(monster\.\d+)\.spr$/u.exec(r.asset_id);
    if (m && ids.has(`${m[1] as string}.act`)) out.push({ id: m[1] as string, kind: "monster", layers: [{ spr: r.asset_id, act: `${m[1] as string}.act` }] });
  }
  return out;
}

export function writeOutput(dir: string, name: string, bytes: Uint8Array | string): { file: string; sha256: string; bytes: number } {
  mkdirSync(dir, { recursive: true });
  const data = typeof bytes === "string" ? Buffer.from(bytes) : bytes;
  writeFileSync(join(dir, name), data);
  return { file: name, sha256: sha(data), bytes: data.length };
}

export function sha256Upper(b: Uint8Array): string {
  return sha(b);
}

export function parseSpriteWithPalette(sprBytes: Uint8Array, palette: Uint8Array | null): Sprite {
  const s = parseSpr(sprBytes);
  if (palette) {
    const p = new Uint8Array(1024);
    for (let i = 0; i < 256; i += 1) {
      p[i * 4] = palette[i * 4] as number;
      p[i * 4 + 1] = palette[i * 4 + 1] as number;
      p[i * 4 + 2] = palette[i * 4 + 2] as number;
      p[i * 4 + 3] = i === 0 ? 0 : 255;
    }
    s.palette = p;
  }
  return s;
}

export { parseAct };
