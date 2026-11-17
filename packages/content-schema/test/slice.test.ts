import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileSliceContent } from "../src/index.ts";

const seed: unknown = JSON.parse(readFileSync(new URL("../../../docs/product-plan/handoff/vertical-slice-content-seed.json", import.meta.url), "utf8"));

describe("vertical-slice content compile", () => {
  const c = compileSliceContent(seed);

  it("converts units to integers (ticks, mm, centi-HP, per-mille)", () => {
    expect(c.player).toMatchObject({ maxHp: 14000, speedMmPerTick: 80, armorPermille: 80, pickupRadiusMm: 1600, basicSkillId: "skill.sw.basic_slash" });
    expect(c.skills["skill.sw.magnum_break"]).toMatchObject({ cooldownTicks: 300, castTicks: 21, damage: 2800, hitLimit: 20, minimumTargets: 3, geometry: { shape: "circle", radiusMm: 2600 } });
    expect(c.skills["skill.sw.basic_slash"]?.geometry).toEqual({ shape: "sector", rangeMm: 1800, halfAngleDeg: 50 });
    expect(c.skills["skill.sw.basic_slash"]?.perRank.hitLimit).toEqual([3, 3, 4, 4, 5]);
    expect(c.monsters["monster.poring"]).toMatchObject({ hp: 1800, speedMmPerTick: 30, contactDamage: 500, xp: 1 });
    expect(c.monsters["elite.poring"]).toMatchObject({ hp: 21600, contactDamage: 1000, xp: 20 });
    expect(c.monsters["boss.mastering"]?.attacks.map((a) => a.kind)).toEqual(["hop-slam", "summon", "bounce-ring", "harden"]);
    expect(c.passives["skill.sw.auto_berserk"]?.lowHp).toEqual({ thresholdPermille: 300, damagePermille: 1250, movePermille: 1100, incomingPermille: 1100 });
  });

  it("every value is an integer (no floats reach the simulation)", () => {
    const floats: string[] = [];
    JSON.stringify(c, (k, v: unknown) => {
      if (typeof v === "number" && !Number.isInteger(v)) floats.push(`${k}=${v}`);
      return v;
    });
    expect(floats).toEqual([]);
  });

  it("builds the timeline and XP curve", () => {
    expect(c.bossSpawnTick).toBe(36000);
    expect(c.enrageTick).toBe(43200);
    expect(c.timeline[0]).toEqual({ kind: "wave", fromTick: 0, toTick: 3600, spawnEveryTicks: 86, pool: ["monster.poring", "monster.fabre", "monster.lunatic"] });
    expect(c.progression.xpToNext.slice(1, 5)).toEqual([8, 13, 19, 26]);
    expect(c.progression.xpToNext).toHaveLength(30);
  });

  it("rejects seeds with unknown references", () => {
    const bad = JSON.parse(JSON.stringify(seed)) as { stage: { timeline: { pool?: string[] }[] } };
    (bad.stage.timeline[0] as { pool: string[] }).pool = ["monster.nope"];
    expect(() => compileSliceContent(bad)).toThrow(/unknown monster/u);
  });
});
