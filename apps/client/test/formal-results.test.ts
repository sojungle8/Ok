import { describe, expect, it } from "vitest";
import type { CharacterRecord, RunResult } from "@ro-survivor/persistence";
import { buildResultsModel, formatRunTime, type ResultsData } from "../src/screens/Results.tsx";
import { formalResultsAssetIds, RO_BUTTON_CHROME_IDS, RO_WINDOW_CHROME_IDS } from "../src/ui/ro/index.ts";

function result(overrides: Partial<RunResult> = {}): RunResult {
  return {
    schemaVersion: 1,
    profileId: "local-profile",
    runId: "run-1",
    contentVersion: "test",
    buildId: "test",
    job: "job.swordsman",
    stage: "stage.prt_fild08.slice",
    runSeed: 7,
    outcome: "victory",
    timeTicks: 36_125,
    level: 12,
    kills: 345,
    damageDealt: 123_456,
    damageTaken: 7_890,
    levelUps: 11,
    bossKillTick: 35_700,
    damageBySource: {},
    damageTakenBySource: {},
    rewards: { baseXp: 1000, jobXp: 400, items: ["equip.unknown.future"], unlock: null },
    ...overrides,
  };
}

function data(run: RunResult, character: CharacterRecord | null = null): ResultsData {
  return { result: run, applied: true, character };
}

describe("formal RO survivor results", () => {
  it("declares exactly the verified item-window and four-state button chrome", () => {
    const ids = formalResultsAssetIds();
    expect(ids).toEqual(expect.arrayContaining([
      ...RO_WINDOW_CHROME_IDS.title,
      ...RO_WINDOW_CHROME_IDS.body,
      ...RO_WINDOW_CHROME_IDS.footer,
      ...RO_BUTTON_CHROME_IDS.off,
      ...RO_BUTTON_CHROME_IDS.hover,
      ...RO_BUTTON_CHROME_IDS.down,
      ...RO_BUTTON_CHROME_IDS.disabled,
    ]));
    expect(ids).toHaveLength(21);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.some((id) => id.startsWith("ui.chat."))).toBe(false);
    expect(ids.some((id) => id.startsWith("ui.skill."))).toBe(false);
  });

  it("formats a victory, unknown item ID and new record as honest text", () => {
    const run = result();
    const model = buildResultsModel(data(run, { job: run.job, baseXp: 1000, jobXp: 400, runs: 1, victories: 1, bestTimeTicks: run.timeTicks }), true, true);
    expect(model.title).toBe("戰鬥勝利");
    expect(model.continueDisabled).toBe(false);
    expect(model.continueLabel).toContain("Enter / A");
    expect(model.rows.find((row) => row.key === "time")?.value).toBe("10:02");
    expect(model.rows.find((row) => row.key === "rewards")?.value).toContain("equip.unknown.future");
    expect(model.rows.find((row) => row.key === "character")?.value).toContain("新紀錄！");
  });

  it("keeps continue disabled until settlement and handles defeat without items or storage", () => {
    const model = buildResultsModel(data(result({ outcome: "defeat", bossKillTick: -1, rewards: { baseXp: 20, jobXp: 8, items: [], unlock: null } })), false, false);
    expect(model.title).toBe("戰鬥失敗");
    expect(model.continueDisabled).toBe(true);
    expect(model.continueLabel).toBe("結算中…");
    expect(model.rows.find((row) => row.key === "boss")?.value).toBe("—");
    expect(model.rows.find((row) => row.key === "rewards")?.value).toContain("無道具");
    expect(model.rows.find((row) => row.key === "settled")?.value).toBe("結算中…");
    expect(buildResultsModel(data(result()), false, true).rows.find((row) => row.key === "settled")?.value).toBe("無法開啟本機存檔");
  });

  it("clamps negative time and uses 60 simulation ticks per second", () => {
    expect(formatRunTime(-5)).toBe("0:00");
    expect(formatRunTime(3_661)).toBe("1:01");
  });
});
