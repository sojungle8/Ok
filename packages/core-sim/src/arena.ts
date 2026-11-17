import { Rng, type RngState } from "./prng.ts";
import { hashState } from "./hash.ts";
import type { InputCommand } from "./sim.ts";

/**
 * Phase 1 test arena: one player, a fixed-seed enemy population and circle collision.
 * All positions are integer millimetres; only +, -, *, /, Math.trunc and Math.sqrt (IEEE exact)
 * are used, so every engine produces the same state hash. Mutates in place for performance;
 * renderers only ever see `RenderSnapshot` copies.
 */
export interface WalkGrid {
  width: number;
  height: number;
  cellMm: number;
  /** 1 = walkable, row-major, y=0 is the south edge. */
  walkable: Uint8Array;
}

export interface ArenaConfig {
  runSeed: number;
  initialEnemies: number;
  spawnEveryTicks: number;
  maxEnemies: number;
  playerRadiusMm: number;
  enemyRadiusMm: number;
  playerSpeedMmPerTick: number;
  enemySpeedMmPerTick: number;
  spawnRingMm: number;
  grid: WalkGrid | null;
}

export const DEFAULT_ARENA: Omit<ArenaConfig, "runSeed"> = {
  initialEnemies: 50,
  spawnEveryTicks: 60,
  maxEnemies: 600,
  playerRadiusMm: 450,
  enemyRadiusMm: 400,
  playerSpeedMmPerTick: 80,
  enemySpeedMmPerTick: 30,
  spawnRingMm: 9_000,
  grid: null,
};

export interface ArenaActor {
  id: number;
  x: number;
  y: number;
  dir: number;
  moving: boolean;
}

export interface ArenaState {
  tick: number;
  config: ArenaConfig;
  player: ArenaActor;
  enemies: ArenaActor[];
  nextId: number;
  spawnRng: RngState;
  lastSequence: number;
  paused: boolean;
}

/** Read-only view for renderers / UI. Copying it never affects the simulation. */
export interface RenderSnapshot {
  readonly tick: number;
  readonly player: Readonly<ArenaActor>;
  /** Packed [id, x, y, dir, moving] per enemy. */
  readonly enemies: Int32Array;
  readonly enemyCount: number;
}

/** RO direction index from a movement vector: 0 S, 1 SW, 2 W, 3 NW, 4 N, 5 NE, 6 E, 7 SE (+y = north). */
export function directionOf(dx: number, dy: number, fallback: number): number {
  if (dx === 0 && dy === 0) return fallback;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  // tan(22.5°) ≈ 0.41421: integer comparison 1000*small < 414*large.
  if (ay * 1000 <= ax * 414) return dx > 0 ? 6 : 2;
  if (ax * 1000 <= ay * 414) return dy > 0 ? 4 : 0;
  if (dx > 0) return dy > 0 ? 5 : 7;
  return dy > 0 ? 3 : 1;
}

function walkableAt(grid: WalkGrid | null, x: number, y: number): boolean {
  if (!grid) return true;
  const cx = Math.floor(x / grid.cellMm);
  const cy = Math.floor(y / grid.cellMm);
  if (cx < 0 || cy < 0 || cx >= grid.width || cy >= grid.height) return false;
  return grid.walkable[cy * grid.width + cx] === 1;
}

function spawnPoint(s: ArenaState, rng: Rng): { x: number; y: number } | null {
  const ring = s.config.spawnRingMm;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const side = rng.nextInt(4);
    const along = rng.range(-ring, ring);
    const p = s.player;
    const pos =
      side === 0 ? { x: p.x + along, y: p.y - ring }
      : side === 1 ? { x: p.x + ring, y: p.y + along }
      : side === 2 ? { x: p.x + along, y: p.y + ring }
      : { x: p.x - ring, y: p.y + along };
    if (walkableAt(s.config.grid, pos.x, pos.y)) return pos;
  }
  return null;
}

function spawn(s: ArenaState, rng: Rng): void {
  if (s.enemies.length >= s.config.maxEnemies) return;
  const pos = spawnPoint(s, rng);
  if (!pos) return;
  s.enemies.push({ id: s.nextId, x: pos.x, y: pos.y, dir: 0, moving: false });
  s.nextId += 1;
}

export function createArena(config: Partial<ArenaConfig> & { runSeed: number; start?: { x: number; y: number } }): ArenaState {
  const full: ArenaConfig = { ...DEFAULT_ARENA, ...config };
  if (!Number.isInteger(full.runSeed) || full.runSeed < 0 || full.runSeed > 0xffffffff) throw new RangeError("runSeed must be a u32");
  const start = config.start ?? { x: 0, y: 0 };
  if (!walkableAt(full.grid, start.x, start.y)) throw new Error("arena start position is not walkable");
  const s: ArenaState = {
    tick: 0,
    config: full,
    player: { id: 0, x: start.x, y: start.y, dir: 0, moving: false },
    enemies: [],
    nextId: 1,
    spawnRng: Rng.stream(full.runSeed, "arena-spawn").snapshot(),
    lastSequence: -1,
    paused: false,
  };
  const rng = Rng.restore(s.spawnRng);
  for (let i = 0; i < full.initialEnemies; i += 1) spawn(s, rng);
  s.spawnRng = rng.snapshot();
  return s;
}

function tryMove(grid: WalkGrid | null, a: ArenaActor, dx: number, dy: number): void {
  if (walkableAt(grid, a.x + dx, a.y + dy)) {
    a.x += dx;
    a.y += dy;
  } else if (dx !== 0 && walkableAt(grid, a.x + dx, a.y)) a.x += dx;
  else if (dy !== 0 && walkableAt(grid, a.x, a.y + dy)) a.y += dy;
}

/** One fixed 60 Hz step, in place. */
export function stepArena(s: ArenaState, input: InputCommand | undefined): void {
  if (input) {
    if (input.sequence <= s.lastSequence) throw new Error(`non-monotonic input sequence ${input.sequence}`);
    if (!Number.isInteger(input.moveX) || !Number.isInteger(input.moveY)) throw new TypeError("InputCommand axes must be integers in [-1000, 1000]");
    s.lastSequence = input.sequence;
    if (input.pause !== undefined) s.paused = input.pause;
  }
  if (s.paused) return;
  const c = s.config;

  // Player movement (diagonals normalised; Math.sqrt is correctly rounded in IEEE 754).
  const mx = input ? Math.max(-1000, Math.min(1000, input.moveX)) : 0;
  const my = input ? Math.max(-1000, Math.min(1000, input.moveY)) : 0;
  const len = Math.sqrt(mx * mx + my * my);
  const p = s.player;
  if (len > 0) {
    const mag = Math.min(1000, len);
    const dx = Math.trunc((mx * c.playerSpeedMmPerTick * mag) / (len * 1000));
    const dy = Math.trunc((my * c.playerSpeedMmPerTick * mag) / (len * 1000));
    tryMove(c.grid, p, dx, dy);
    p.dir = directionOf(mx, my, p.dir);
    p.moving = true;
  } else p.moving = false;

  // Enemies chase the player.
  for (const e of s.enemies) {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d <= c.playerRadiusMm + c.enemyRadiusMm) {
      e.moving = false;
      continue;
    }
    const sx = Math.trunc((dx * c.enemySpeedMmPerTick) / d);
    const sy = Math.trunc((dy * c.enemySpeedMmPerTick) / d);
    tryMove(c.grid, e, sx, sy);
    e.dir = directionOf(sx, sy, e.dir);
    e.moving = sx !== 0 || sy !== 0;
  }

  // Soft enemy-enemy separation through a spatial hash (no all-pairs loop).
  const cell = (c.enemyRadiusMm * 2) | 0;
  const buckets = new Map<number, number[]>();
  const key = (cx: number, cy: number): number => (cx + 32768) * 65536 + (cy + 32768);
  s.enemies.forEach((e, i) => {
    const k = key(Math.floor(e.x / cell), Math.floor(e.y / cell));
    const b = buckets.get(k);
    if (b) b.push(i);
    else buckets.set(k, [i]);
  });
  const minD = c.enemyRadiusMm * 2;
  for (let i = 0; i < s.enemies.length; i += 1) {
    const a = s.enemies[i] as ArenaActor;
    const cx = Math.floor(a.x / cell);
    const cy = Math.floor(a.y / cell);
    for (let ox = -1; ox <= 1; ox += 1) {
      for (let oy = -1; oy <= 1; oy += 1) {
        for (const j of buckets.get(key(cx + ox, cy + oy)) ?? []) {
          if (j <= i) continue;
          const b = s.enemies[j] as ArenaActor;
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let d2 = dx * dx + dy * dy;
          if (d2 >= minD * minD) continue;
          if (d2 === 0) {
            dx = a.id < b.id ? 1 : -1;
            dy = 0;
            d2 = 1;
          }
          const d = Math.sqrt(d2);
          const push = Math.trunc((minD - d) / 4) + 1;
          const px = Math.trunc((dx * push) / d);
          const py = Math.trunc((dy * push) / d);
          tryMove(c.grid, a, -px, -py);
          tryMove(c.grid, b, px, py);
        }
      }
    }
  }

  // Hard player-enemy constraint: enemies never overlap the player.
  const minPE = c.playerRadiusMm + c.enemyRadiusMm;
  for (const e of s.enemies) {
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 >= minPE * minPE) continue;
    const d = Math.sqrt(d2);
    if (d === 0) {
      e.x = p.x + minPE;
      continue;
    }
    const nx = p.x + Math.trunc((dx * minPE) / d) + Math.sign(dx);
    const ny = p.y + Math.trunc((dy * minPE) / d) + Math.sign(dy);
    if (walkableAt(c.grid, nx, ny)) {
      e.x = nx;
      e.y = ny;
    }
  }

  s.tick += 1;
  if (s.tick % c.spawnEveryTicks === 0) {
    const rng = Rng.restore(s.spawnRng);
    spawn(s, rng);
    s.spawnRng = rng.snapshot();
  }
}

export function arenaHash(s: ArenaState): string {
  return hashState({
    tick: s.tick,
    seed: s.config.runSeed,
    paused: s.paused,
    player: [s.player.x, s.player.y, s.player.dir, s.player.moving],
    enemies: s.enemies.map((e) => [e.id, e.x, e.y, e.dir, e.moving]),
    nextId: s.nextId,
    rng: [s.spawnRng.a, s.spawnRng.b, s.spawnRng.c, s.spawnRng.d],
    lastSequence: s.lastSequence,
  });
}

export function toRenderSnapshot(s: ArenaState): RenderSnapshot {
  const enemies = new Int32Array(s.enemies.length * 5);
  s.enemies.forEach((e, i) => {
    enemies[i * 5] = e.id;
    enemies[i * 5 + 1] = e.x;
    enemies[i * 5 + 2] = e.y;
    enemies[i * 5 + 3] = e.dir;
    enemies[i * 5 + 4] = e.moving ? 1 : 0;
  });
  return Object.freeze({ tick: s.tick, player: Object.freeze({ ...s.player }), enemies, enemyCount: s.enemies.length });
}

/** Run an arena replay headlessly (no renderer). */
export function runArenaReplay(config: Parameters<typeof createArena>[0], commands: readonly InputCommand[], ticks: number): { state: ArenaState; hash: string } {
  const byTick = new Map(commands.map((c) => [c.tick, c]));
  const s = createArena(config);
  for (let t = 0; t < ticks; t += 1) stepArena(s, byTick.get(t));
  return { state: s, hash: arenaHash(s) };
}
