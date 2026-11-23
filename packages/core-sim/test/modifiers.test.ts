import { describe, expect, it } from "vitest";
import { applyRunModifiers, baseLevelBonus, baseLevelFromXp, baseXpForLevel, DIFFICULTY_PRESETS, MAX_BASE_LEVEL } from "../src/run/modifiers.ts";
import type { RunContent } from "../src/run/content.ts";

const content = {
  contentVersion: "v1",
  player: { maxHp: 10_000 },
  skills: { a: { id: "a", damage: 1000 } },
  monsters: { m: { id: "m", hp: 2000, contactDamage: 500, xp: 4, projectile: { damage: 300 }, charge: null, pool: { damagePerSecond: 100 }, attacks: [{ damage: 800 }] } },
  timeline: [{ kind: "wave", fromTick: 0, toTick: 60, spawnEveryTicks: 50, pool: ["m"] }, { kind: "boss-enrage", atTick: 100 }],
} as unknown as RunContent;

describe("run modifiers as content transforms", () => {
  it("normal difficulty at Base level 0 returns the exact same content object", () => {
    expect(applyRunModifiers(content)).toBe(content);
    expect(applyRunModifiers(content, { difficulty: "normal", baseLevel: 0 })).toBe(content);
  });

  it("hard scales enemy HP, every damage source, XP and wave density without mutating the input", () => {
    const h = applyRunModifiers(content, { difficulty: "hard" });
    const d = DIFFICULTY_PRESETS.hard;
    const m = h.monsters.m as RunContent["monsters"][string];
    expect(m.hp).toBe(Math.round((2000 * d.enemyHpPermille) / 1000));
    expect([m.contactDamage, m.projectile?.damage, m.pool?.damagePerSecond, m.attacks[0]?.damage]).toEqual([500, 300, 100, 800].map((v) => Math.round((v * d.enemyDamagePermille) / 1000)));
    expect(m.xp).toBe(5);
    expect(h.timeline[0]).toMatchObject({ spawnEveryTicks: 45 });
    expect(h.timeline[1]).toEqual(content.timeline[1]);
    expect(h.contentVersion).toBe("v1+hard");
    expect((content.monsters.m as RunContent["monsters"][string]).hp).toBe(2000);
  });

  it("Base level grants capped HP and damage bonuses", () => {
    const b = applyRunModifiers(content, { baseLevel: 10 });
    expect(b.player.maxHp).toBe(13_000);
    expect(b.skills.a?.damage).toBe(1200);
    expect(b.contentVersion).toBe("v1+bl10");
    expect(baseLevelBonus(99)).toEqual(baseLevelBonus(MAX_BASE_LEVEL));
    expect(applyRunModifiers(content, { difficulty: "hard", baseLevel: 3 }).contentVersion).toBe("v1+hard.bl3");
  });

  it("maps accumulated Base XP to a monotonic, capped level", () => {
    expect(baseLevelFromXp(0)).toBe(0);
    expect(baseLevelFromXp(baseXpForLevel(1) - 1)).toBe(0);
    expect(baseLevelFromXp(baseXpForLevel(1))).toBe(1);
    expect(baseLevelFromXp(baseXpForLevel(10))).toBe(10);
    expect(baseLevelFromXp(Number.MAX_SAFE_INTEGER)).toBe(MAX_BASE_LEVEL);
  });
});
