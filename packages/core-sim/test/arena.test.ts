import { describe, expect, it } from "vitest";
import { FakeClock } from "@ro-survivor/testkit";
import { arenaHash, createArena, directionOf, FixedStepClock, runArenaReplay, stepArena, toRenderSnapshot, type InputCommand, type WalkGrid } from "../src/index.ts";

function wasdScript(ticks: number): InputCommand[] {
  const out: InputCommand[] = [];
  let seq = 0;
  const pattern: [number, number][] = [[0, 1000], [1000, 1000], [1000, 0], [0, 0], [-1000, -1000], [-1000, 0], [0, -1000], [700, -700]];
  for (let t = 0; t < ticks; t += 5) {
    const [moveX, moveY] = pattern[Math.floor(t / 75) % pattern.length] as [number, number];
    out.push({ tick: t, sequence: seq++, moveX, moveY });
  }
  return out;
}

describe("arena determinism (headless, no renderer)", () => {
  it("player + 50 porings: same seed and commands -> same hash; 1 spawn per second", () => {
    const cmds = wasdScript(3600);
    const a = runArenaReplay({ runSeed: 2026 }, cmds, 3600);
    const b = runArenaReplay({ runSeed: 2026 }, cmds, 3600);
    expect(a.hash).toBe(b.hash);
    expect(a.state.enemies).toHaveLength(50 + 60);
    expect(a.hash).toMatchInlineSnapshot(`"4dbb7aa405a98e3b"`);
    expect(runArenaReplay({ runSeed: 2027 }, cmds, 3600).hash).not.toBe(a.hash);
  });

  it("15, 30 and 60 render FPS give the same 60-second state hash", () => {
    const cmds = wasdScript(3600);
    const byTick = new Map(cmds.map((c) => [c.tick, c]));
    const hashes = [15, 30, 60].map((fps) => {
      const s = createArena({ runSeed: 7 });
      const clock = new FixedStepClock(5);
      for (const frame of FakeClock.frameMicros(fps, 60)) {
        const n = clock.advance(frame);
        for (let i = 0; i < n; i += 1) stepArena(s, byTick.get(s.tick));
      }
      expect(s.tick).toBe(3600);
      return arenaHash(s);
    });
    expect(new Set(hashes).size).toBe(1);
    expect(hashes[0]).toBe(runArenaReplay({ runSeed: 7 }, cmds, 3600).hash);
  });

  it("enemies chase the player and never overlap it", () => {
    const s = createArena({ runSeed: 1 });
    const start = s.enemies.map((e) => Math.hypot(e.x, e.y));
    for (let t = 0; t < 600; t += 1) {
      stepArena(s, undefined);
      for (const e of s.enemies) expect(Math.hypot(e.x - s.player.x, e.y - s.player.y)).toBeGreaterThanOrEqual(s.config.playerRadiusMm + s.config.enemyRadiusMm - 1);
    }
    const end = s.enemies.slice(0, start.length).map((e) => Math.hypot(e.x, e.y));
    expect(end.reduce((a, b) => a + b, 0)).toBeLessThan(start.reduce((a, b) => a + b, 0));
  });

  it("respects the walk grid (player slides along walls, never enters blocked cells)", () => {
    const W = 20;
    const walkable = new Uint8Array(W * W).fill(1);
    for (let y = 0; y < W; y += 1) walkable[y * W + 12] = 0;
    const grid: WalkGrid = { width: W, height: W, cellMm: 1000, walkable };
    const s = createArena({ runSeed: 3, grid, initialEnemies: 5, start: { x: 5500, y: 10_500 } });
    for (let t = 0; t < 300; t += 1) {
      stepArena(s, { tick: t, sequence: t, moveX: 1000, moveY: 300 });
      const cx = Math.floor(s.player.x / 1000);
      expect(cx).not.toBe(12);
      expect(walkable[Math.floor(s.player.y / 1000) * W + cx]).toBe(1);
    }
    expect(Math.floor(s.player.x / 1000)).toBe(11);
    expect(() => createArena({ runSeed: 1, grid, start: { x: 12_500, y: 500 } })).toThrow(/not walkable/u);
  });

  it("render snapshots are copies: mutating them cannot change the simulation", () => {
    const s = createArena({ runSeed: 9 });
    stepArena(s, undefined);
    const before = arenaHash(s);
    const snap = toRenderSnapshot(s);
    snap.enemies[1] = 123456;
    expect(() => {
      (snap.player as { x: number }).x = 1;
    }).toThrow();
    expect(arenaHash(s)).toBe(before);
    expect(snap.enemyCount).toBe(50);
  });

  it("maps movement to 8 RO directions", () => {
    expect([[0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1]].map(([x, y]) => directionOf(x as number, y as number, 0))).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(directionOf(0, 0, 3)).toBe(3);
  });

  it("handles 500 enemies within the tick budget headlessly", () => {
    const s = createArena({ runSeed: 5, initialEnemies: 500, spawnEveryTicks: 1_000_000 });
    const times: number[] = [];
    for (let t = 0; t < 300; t += 1) {
      const t0 = performance.now();
      stepArena(s, { tick: t, sequence: t, moveX: 1000, moveY: 0 });
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    expect(s.enemies).toHaveLength(500);
    expect(times[Math.floor(times.length * 0.95)]).toBeLessThan(16);
  });
});
