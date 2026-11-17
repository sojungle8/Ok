import { describe, expect, it } from "vitest";
import { Mixer } from "../src/audio/mixer.ts";
import { DEFAULT_SETTINGS, telegraphColors } from "../src/settings.ts";

describe("audio mixer rules", () => {
  it("independent bus volumes and master gain", () => {
    const m = new Mixer();
    m.setVolume("enemy", 0.3);
    m.master = 0.5;
    expect(m.gain("enemy")).toBeCloseTo(0.15);
    expect(m.gain("boss")).toBe(0.5);
  });

  it("voice limit and per-sound cooldown for repeated hits", () => {
    const m = new Mixer();
    let played = 0;
    for (let i = 0; i < 40; i += 1) if (m.request({ id: `hit-${i % 3}`, bus: "enemy" }, i * 10, 400)) played += 1;
    expect(played).toBeLessThanOrEqual(8);
    expect(m.request({ id: "hit-x", bus: "enemy" }, 0, 10)).toBeNull();
  });

  it("boss warnings are always audible, even on a full bus", () => {
    const m = new Mixer();
    for (let i = 0; i < 10; i += 1) m.request({ id: `boss-sfx-${i}`, bus: "boss" }, i, 5000);
    expect(m.active().filter((v) => v.bus === "boss")).toHaveLength(4);
    for (let i = 0; i < 6; i += 1) expect(m.request({ id: "boss-warning", bus: "boss", critical: true }, 100 + i, 5000)).not.toBeNull();
    expect(m.active().filter((v) => v.critical).length).toBeGreaterThan(0);
  });

  it("colour-blind palette swaps telegraph colours", () => {
    expect(telegraphColors({ ...DEFAULT_SETTINGS, colorBlind: true }).danger).not.toBe(telegraphColors(DEFAULT_SETTINGS).danger);
  });
});
