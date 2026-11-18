import { describe, expect, it } from "vitest";
import type { RunState } from "@ro-survivor/core-sim";
import { formalHudSkills, formalMinimapModel } from "../src/screens/Hud.tsx";

const player = {
  basicRank: 3,
  active: [
    { id: "skill.sw.bash", rank: 2, readyAt: 80 },
    { id: "skill.sw.magnum_break", rank: 1, readyAt: 160 },
  ],
  passive: [{ id: "passive.sw.hp_recovery", rank: 4 }],
  x: 100_000,
  y: 300_000,
  fx: 1000,
  fy: 0,
} as unknown as RunState["player"];

describe("formal HUD view model", () => {
  it("keeps the shortcut row to the basic attack and active skills", () => {
    expect(formalHudSkills({ runTick: 100, player })).toEqual([
      { id: "skill.sw.basic_slash", rank: 3 },
      { id: "skill.sw.bash", rank: 2, hotkey: "F1", cooldownTicks: 0 },
      { id: "skill.sw.magnum_break", rank: 1, hotkey: "F2", cooldownTicks: 60 },
    ]);
  });

  it("maps world millimetres and facing to the north-up minimap model", () => {
    expect(formalMinimapModel(player, { widthMm: 400_000, heightMm: 400_000 })).toEqual({
      xPermille: 250,
      yPermille: 250,
      facingDeg: 90,
    });
    expect(formalMinimapModel(player, { widthMm: 0, heightMm: 400_000 })).toBeUndefined();
  });
});
