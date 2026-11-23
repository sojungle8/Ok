import { describe, expect, it } from "vitest";
import { createRun, isDefenseOption, isAreaClear, MAGE_PLANS, stepRun } from "@ro-survivor/core-sim";
import { jobConfig, mageContent, playJobRun, sliceContent } from "./slice-fixture.ts";

describe("Mage job pack on the shared skill pipeline", () => {
  it("compiles against the signed seed with its own kit and the same stage", () => {
    expect(mageContent.player.basicSkillId).toBe("skill.mg.basic_bolt");
    expect(Object.keys(mageContent.skills).every((id) => id.startsWith("skill.mg."))).toBe(true);
    expect(mageContent.timeline).toEqual(sliceContent.timeline);
    expect(mageContent.monsters).toEqual(sliceContent.monsters);
    expect(mageContent.contentVersion).toMatch(/\+mage\./u);
    for (const plan of MAGE_PLANS) expect(mageContent.buildLoadouts[plan]).toContain("equip.test.rod");
  });

  it("derives defense and area-clear options from content, not from Swordsman ids", () => {
    expect(isDefenseOption(mageContent, "skill.mg.safety_wall")).toBe(true);
    expect(isDefenseOption(mageContent, "passive.mg.srecovery")).toBe(true);
    expect(isDefenseOption(mageContent, "skill.mg.fire_bolt")).toBe(false);
    expect(isDefenseOption(sliceContent, "skill.sw.endure")).toBe(true);
    expect(isAreaClear(mageContent, "skill.mg.napalm_beat")).toBe(true);
    expect(isAreaClear(mageContent, "skill.mg.thunderstorm")).toBe(true);
    expect(mageContent.player.guaranteedEarly.oneOf).toEqual(["skill.mg.napalm_beat", "skill.mg.thunderstorm"]);
  });

  it("Safety Wall uses the content-defined self buff and the regen passive heals", () => {
    const st = createRun(jobConfig(mageContent, 7, "storm"));
    st.player.active = [{ id: "skill.mg.safety_wall", rank: 1, readyAt: 0 }];
    st.player.passive = [{ id: "passive.mg.srecovery", rank: 5, readyAt: 0 }];
    st.player.lastDamagedTick = st.runTick;
    st.player.hp = Math.trunc(st.player.maxHp / 2);
    const cfg = jobConfig(mageContent, 7, "storm");
    for (let i = 0; i < 120; i += 1) stepRun(st, cfg, { tick: st.tick, sequence: i, moveX: 0, moveY: 0 });
    expect(st.player.endureUntil).toBeGreaterThan(0);
    expect(st.player.hp).toBeGreaterThan(Math.trunc(st.player.maxHp / 2));
  });

  it("a full bot run is deterministic", () => {
    const a = playJobRun(mageContent, 3, "elementalist", undefined, undefined, 60 * 90);
    const b = playJobRun(mageContent, 3, "elementalist", undefined, undefined, 60 * 90);
    expect(a.stats).toEqual(b.stats);
    expect(a.stats.firstEffectiveAreaClearTick).toBeGreaterThanOrEqual(0);
  });
});
