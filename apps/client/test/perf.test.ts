import { describe, expect, it } from "vitest";
import { FrameTimes, PERF_WINDOW, perfEnabled } from "../src/game/perf.ts";

describe("opt-in performance HUD data", () => {
  it("is off unless ?perf=1", () => {
    expect(perfEnabled("")).toBe(false);
    expect(perfEnabled("?perf=0&dev=1")).toBe(false);
    expect(perfEnabled("?perf=1")).toBe(true);
  });

  it("summarises a bounded window of frame intervals and ignores long gaps", () => {
    const f = new FrameTimes();
    expect(f.summary()).toEqual({ frames: 0, fpsP50: 0, fpsP05: 0, frameMsP95: 0 });
    let t = 0;
    f.tick(t);
    for (let i = 0; i < 100; i += 1) f.tick((t += 16.6));
    for (let i = 0; i < 10; i += 1) f.tick((t += 50));
    f.tick((t += 5000));
    const s = f.summary();
    expect(s.frames).toBe(110);
    expect(s.fpsP50).toBeCloseTo(60.2, 0);
    expect(s.frameMsP95).toBe(50);
    expect(s.fpsP05).toBe(20);
    for (let i = 0; i < PERF_WINDOW * 2; i += 1) f.tick((t += 16.6));
    expect(f.summary().frames).toBe(PERF_WINDOW);
  });
});
