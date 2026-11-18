import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { compileSliceContent } from "@ro-survivor/content-schema";
import { createRun } from "@ro-survivor/core-sim";
import { describe, expect, it } from "vitest";
import { describeOption, draftDisplayName } from "../src/game/describe.ts";

describe("player-facing draft labels", () => {
  it("uses Traditional Chinese RO/survivor names instead of internal IDs", () => {
    expect(draftDisplayName("skill.sw.magnum_break")).toBe("怒爆");
    expect(draftDisplayName("skill.sw.provoke")).toBe("挑釁");
    expect(draftDisplayName("skill.sw.bash")).toBe("狂擊");
    expect(draftDisplayName("passive.sw.sword_mastery")).toBe("單手劍使用熟練度");
    expect(draftDisplayName("keystone.guardian")).toBe("守護流派");
  });

  it("keeps an unknown future ID explicit instead of inventing a translation", () => {
    expect(draftDisplayName("skill.future.unknown")).toBe("skill.future.unknown");
  });

  it("localizes real keystone effect keys without leaking implementation names", () => {
    const seedPath = resolve(import.meta.dirname, "../../../docs/product-plan/handoff/vertical-slice-content-seed.json");
    const content = compileSliceContent(JSON.parse(readFileSync(seedPath, "utf8")));
    const state = createRun({ content, runSeed: 17, loadout: content.standardLoadout });
    const guardian = describeOption(content, state, { kind: "keystone", id: "keystone.guardian" });
    expect(guardian.title).toBe("守護流派");
    expect(guardian.lines.join("\n")).toContain("盾擊波冷卻");
    expect(guardian.lines.join("\n")).toContain("霸體額外減傷");
    expect(guardian.lines.join("\n")).toContain("霸體額外減傷：+12%");
    expect(guardian.lines.join("\n")).toContain("格擋反擊傷害");
    expect(guardian.lines.join("\n")).not.toMatch(/shieldWave|endureDamage|counterOnBlock/);
  });
});
