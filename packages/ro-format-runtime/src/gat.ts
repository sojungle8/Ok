import { BinaryReader, expectMagic, FormatError } from "./binary.ts";

/** GAT cell types (walkability). 0 walkable, 1 blocked, 3 walkable water, 5 cliff/snipeable-blocked. */
export const GAT_WALKABLE = new Set([0, 3]);

export interface Gat {
  version: string;
  width: number;
  height: number;
  /** 4 corner heights per cell (bottom-left, bottom-right, top-left, top-right). */
  heights: Float32Array;
  types: Uint32Array;
}

export function parseGat(bytes: Uint8Array): Gat {
  const r = new BinaryReader(bytes, "GAT");
  expectMagic(r, "GRAT");
  const major = r.u8();
  const minor = r.u8();
  const width = r.i32();
  const height = r.i32();
  if (width <= 0 || height <= 0 || width > 2048 || height > 2048) throw new FormatError("GAT", `bad size ${width}x${height}`);
  const n = width * height;
  if (r.remaining !== n * 20) throw new FormatError("GAT", `expected ${n * 20} cell bytes, got ${r.remaining}`);
  const heights = new Float32Array(n * 4);
  const types = new Uint32Array(n);
  for (let i = 0; i < n; i += 1) {
    for (let k = 0; k < 4; k += 1) heights[i * 4 + k] = r.f32();
    types[i] = r.u32();
  }
  return { version: `${major}.${minor}`, width, height, heights, types };
}

export function isWalkable(gat: Gat, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gat.width || y >= gat.height) return false;
  return GAT_WALKABLE.has(gat.types[y * gat.width + x] as number);
}

/** 4-neighbour flood fill from (x, y); returns a Uint8Array mask of reachable walkable cells. */
export function floodReachable(gat: Gat, x: number, y: number): { mask: Uint8Array; count: number } {
  const mask = new Uint8Array(gat.width * gat.height);
  if (!isWalkable(gat, x, y)) return { mask, count: 0 };
  const queue = new Int32Array(gat.width * gat.height);
  let head = 0;
  let tail = 0;
  queue[tail++] = y * gat.width + x;
  mask[y * gat.width + x] = 1;
  let count = 1;
  while (head < tail) {
    const idx = queue[head++] as number;
    const cx = idx % gat.width;
    const cy = (idx - cx) / gat.width;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!isWalkable(gat, nx, ny)) continue;
      const ni = ny * gat.width + nx;
      if (mask[ni]) continue;
      mask[ni] = 1;
      queue[tail++] = ni;
      count += 1;
    }
  }
  return { mask, count };
}
