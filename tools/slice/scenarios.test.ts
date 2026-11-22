import { describe, expect, it } from "vitest";
import { axisValue, SCENARIO_LEVEL_BUDGET, SCENARIO_TICKS, SCENARIOS, scenarioRun, scenarioState, warmupKit } from "./scenarios-lib.ts";

describe("D-032 five-scenario harness", () => {
  const kit = warmupKit(101, "guardian");

  it("warms every build up to the same level budget on the real stage", () => {
    expect(kit.level).toBeGreaterThanOrEqual(SCENARIO_LEVEL_BUDGET);
    expect(kit.reachedBudget).toBe(true);
    expect(kit.active.length).toBeGreaterThan(0);
  });

  it("isolates each scenario: empty timeline, full HP, the drafted kit, seeded placement", () => {
    for (const scenario of SCENARIOS) {
      const { st, cfg } = scenarioState(kit, scenario);
      expect(cfg.content.timeline).toEqual([]);
      expect(st.player.hp).toBe(st.player.maxHp);
      expect(st.player.active.map((s) => [s.id, s.rank, s.readyAt])).toEqual(kit.active.map((s) => [s.id, s.rank, 0]));
      const again = scenarioState(kit, scenario).st;
      expect(again.enemies.map((e) => [e.type, e.x, e.y])).toEqual(st.enemies.map((e) => [e.type, e.x, e.y]));
    }
    expect(scenarioState(kit, "mvp").st.enemies).toHaveLength(1);
    expect(scenarioState(kit, "clear").st.enemies).toHaveLength(60);
  });

  it("is deterministic and bounded by the scenario duration", () => {
    for (const scenario of SCENARIOS) {
      const a = scenarioRun(kit, scenario);
      const b = scenarioRun(kit, scenario);
      expect(a).toEqual(b);
      expect(a.crashed).toBeNull();
      expect(a.ticks).toBeLessThanOrEqual(SCENARIO_TICKS[scenario]);
      expect(axisValue(a)).toBeGreaterThanOrEqual(0);
    }
  });
});
