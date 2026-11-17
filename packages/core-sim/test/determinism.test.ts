import { describe, expect, it } from "vitest";
import { createInitialState, FixedStepClock, Rng, runReplay, SIM_HZ, step, stateHash, type InputCommand } from "../src/index.ts";
import { distinctReplayHashes, FakeClock } from "@ro-survivor/testkit";

/** Scripted input: deterministic pattern of quantized stick directions. */
function scriptedCommands(ticks: number, salt = 0): InputCommand[] {
  const out: InputCommand[] = [];
  let seq = 0;
  for (let t = 0; t < ticks; t += 7) {
    const phase = Math.floor((t + salt) / 90) % 4;
    const dirs: [number, number][] = [[1000, 0], [0, 1000], [-707, -707], [0, 0]];
    const [moveX, moveY] = dirs[phase] as [number, number];
    out.push({ tick: t, sequence: seq++, moveX, moveY });
  }
  return out;
}

describe("core-sim determinism", () => {
  it("same seed + same commands -> same final state hash", () => {
    const cmds = scriptedCommands(3600);
    const hashes = distinctReplayHashes(() => runReplay(12345, cmds, 3600).hash, 5);
    expect(hashes).toHaveLength(1);
  });

  it("matches the pinned golden hash (cross-platform drift guard)", () => {
    const { hash, state } = runReplay(12345, scriptedCommands(3600), 3600);
    expect(state.tick).toBe(3600);
    expect(state.enemies.length).toBeGreaterThan(0);
    expect(hash).toMatchInlineSnapshot(`"991c54eee7df3deb"`);
  });

  it("different seed or different commands -> different hash", () => {
    const base = runReplay(12345, scriptedCommands(600), 600).hash;
    expect(runReplay(54321, scriptedCommands(600), 600).hash).not.toBe(base);
    expect(runReplay(12345, scriptedCommands(600, 45), 600).hash).not.toBe(base);
  });

  it("produces identical results at 15, 30 and 60 render FPS for 60 seconds", () => {
    const cmds = scriptedCommands(SIM_HZ * 60);
    const byTick = new Map(cmds.map((c) => [c.tick, c]));
    const results = [15, 30, 60].map((fps) => {
      const clock = new FixedStepClock(5);
      let s = createInitialState(777);
      for (const frame of FakeClock.frameMicros(fps, 60)) {
        const n = clock.advance(frame);
        for (let i = 0; i < n; i += 1) s = step(s, byTick.get(s.tick));
      }
      return { fps, tick: s.tick, hash: stateHash(s), dropped: clock.droppedTicks };
    });
    for (const r of results) {
      expect(r.tick).toBe(3600);
      expect(r.dropped).toBe(0);
    }
    expect(new Set(results.map((r) => r.hash)).size).toBe(1);
    expect(results[0]?.hash).toBe(runReplay(777, cmds, 3600).hash);
  });

  it("caps catch-up at 5 ticks per frame instead of spiralling", () => {
    const clock = new FixedStepClock(5);
    expect(clock.advance(1_000_000)).toBe(5);
    expect(clock.droppedTicks).toBe(55);
  });

  it("rejects non-monotonic input sequences and float axes", () => {
    const s = step(createInitialState(1), { tick: 0, sequence: 3, moveX: 0, moveY: 0 });
    expect(() => step(s, { tick: 1, sequence: 3, moveX: 0, moveY: 0 })).toThrow(/sequence/u);
    expect(() => step(s, { tick: 1, sequence: 4, moveX: 0.5, moveY: 0 })).toThrow(/integers/u);
  });

  it("pause is an explicit state, not a zero delta", () => {
    let s = createInitialState(9);
    s = step(s, { tick: 0, sequence: 0, moveX: 1000, moveY: 0, pause: true });
    const before = stateHash(s);
    s = step(s, undefined);
    expect(s.tick).toBe(0);
    expect(stateHash(s)).toBe(before);
  });
});

describe("Rng", () => {
  it("is reproducible and has independent named streams", () => {
    const a = Rng.fromSeed(42);
    const b = Rng.fromSeed(42);
    const seqA = Array.from({ length: 8 }, () => a.nextU32());
    expect(Array.from({ length: 8 }, () => b.nextU32())).toEqual(seqA);
    expect(seqA.slice(0, 3)).toMatchInlineSnapshot(`
      [
        1028872839,
        2516511472,
        400437680,
      ]
    `);
    const spawn = Rng.stream(42, "spawn").nextU32();
    const loot = Rng.stream(42, "loot").nextU32();
    expect(spawn).not.toBe(loot);
  });

  it("snapshot/restore continues the exact sequence", () => {
    const r = Rng.fromSeed(7);
    r.nextU32();
    const snap = r.snapshot();
    const next = r.nextU32();
    expect(Rng.restore(snap).nextU32()).toBe(next);
  });

  it("nextInt stays in range", () => {
    const r = Rng.fromSeed(1);
    for (let i = 0; i < 10_000; i += 1) {
      const v = r.nextInt(7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
    }
  });
});
