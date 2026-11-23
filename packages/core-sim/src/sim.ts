import { Rng, type RngState } from "./prng.ts";
import { hashState } from "./hash.ts";

/** Fixed simulation rate (docs/product-plan/03-TECHNICAL-ARCHITECTURE.md). */
export const SIM_HZ = 60;

/** Input contract. Movement is quantized to integers in [-1000, 1000] so replays are exact. */
export interface InputCommand {
  tick: number;
  sequence: number;
  moveX: number;
  moveY: number;
  pause?: boolean;
}

/** Positions are integer millimetres; the world unit for gameplay specs is metres. */
export interface Vec2i {
  x: number;
  y: number;
}

export interface SimEnemy {
  id: number;
  pos: Vec2i;
}

export interface SimState {
  tick: number;
  runSeed: number;
  paused: boolean;
  player: Vec2i;
  enemies: SimEnemy[];
  nextEnemyId: number;
  spawnRng: RngState;
  lastSequence: number;
}

export const PLAYER_SPEED_MM_PER_TICK = 80;
export const ENEMY_SPEED_MM_PER_TICK = 30;
export const SPAWN_EVERY_TICKS = 30;
export const SPAWN_RING_MM = 12_000;
export const MAX_ENEMIES = 64;

export function createInitialState(runSeed: number): SimState {
  if (!Number.isInteger(runSeed) || runSeed < 0 || runSeed > 0xffffffff) throw new RangeError("runSeed must be a u32");
  return {
    tick: 0,
    runSeed,
    paused: false,
    player: { x: 0, y: 0 },
    enemies: [],
    nextEnemyId: 1,
    spawnRng: Rng.stream(runSeed, "spawn").snapshot(),
    lastSequence: -1,
  };
}

function clampAxis(v: number): number {
  if (!Number.isInteger(v)) throw new TypeError("InputCommand axes must be integers in [-1000, 1000]");
  return Math.max(-1000, Math.min(1000, v));
}

function stepToward(from: number, to: number, maxStep: number): number {
  const d = to - from;
  if (d > maxStep) return from + maxStep;
  if (d < -maxStep) return from - maxStep;
  return to;
}

function cloneState(p: SimState): SimState {
  return {
    ...p,
    player: { ...p.player },
    enemies: p.enemies.map((e) => ({ id: e.id, pos: { ...e.pos } })),
    spawnRng: { ...p.spawnRng },
  };
}

/** Pure fixed-step update; never reads wall-clock time, DOM, renderer or Math.random. */
export function step(prev: SimState, input: InputCommand | undefined): SimState {
  const s = cloneState(prev);
  if (input) {
    if (input.sequence <= s.lastSequence) throw new Error(`non-monotonic input sequence ${input.sequence}`);
    s.lastSequence = input.sequence;
    if (input.pause !== undefined) s.paused = input.pause;
  }
  if (s.paused) return s;

  const mx = input ? clampAxis(input.moveX) : 0;
  const my = input ? clampAxis(input.moveY) : 0;
  s.player.x += Math.trunc((mx * PLAYER_SPEED_MM_PER_TICK) / 1000);
  s.player.y += Math.trunc((my * PLAYER_SPEED_MM_PER_TICK) / 1000);

  for (const e of s.enemies) {
    e.pos.x = stepToward(e.pos.x, s.player.x, ENEMY_SPEED_MM_PER_TICK);
    e.pos.y = stepToward(e.pos.y, s.player.y, ENEMY_SPEED_MM_PER_TICK);
  }

  if (s.tick % SPAWN_EVERY_TICKS === 0 && s.enemies.length < MAX_ENEMIES) {
    const rng = Rng.restore(s.spawnRng);
    const side = rng.nextInt(4);
    const along = rng.range(-SPAWN_RING_MM, SPAWN_RING_MM);
    const pos =
      side === 0 ? { x: s.player.x + along, y: s.player.y - SPAWN_RING_MM }
      : side === 1 ? { x: s.player.x + SPAWN_RING_MM, y: s.player.y + along }
      : side === 2 ? { x: s.player.x + along, y: s.player.y + SPAWN_RING_MM }
      : { x: s.player.x - SPAWN_RING_MM, y: s.player.y + along };
    s.enemies.push({ id: s.nextEnemyId, pos });
    s.nextEnemyId += 1;
    s.spawnRng = rng.snapshot();
  }

  s.tick += 1;
  return s;
}

export function stateHash(s: SimState): string {
  return hashState({
    tick: s.tick,
    runSeed: s.runSeed,
    paused: s.paused,
    player: [s.player.x, s.player.y],
    enemies: s.enemies.map((e) => [e.id, e.pos.x, e.pos.y]),
    nextEnemyId: s.nextEnemyId,
    spawnRng: [s.spawnRng.a, s.spawnRng.b, s.spawnRng.c, s.spawnRng.d],
    lastSequence: s.lastSequence,
  });
}

/** Replay = seed + per-tick input commands. Returns the final state and hash. */
export function runReplay(runSeed: number, commands: readonly InputCommand[], ticks: number): { state: SimState; hash: string } {
  const byTick = new Map<number, InputCommand>();
  for (const c of commands) {
    if (byTick.has(c.tick)) throw new Error(`duplicate command for tick ${c.tick}`);
    byTick.set(c.tick, c);
  }
  let s = createInitialState(runSeed);
  for (let t = 0; t < ticks; t += 1) s = step(s, byTick.get(t));
  return { state: s, hash: stateHash(s) };
}
