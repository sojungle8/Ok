import { describe, expect, it } from "vitest";
import type { DraftOption } from "@ro-survivor/core-sim";
import { draftIconId } from "../src/screens/Draft.tsx";
import { formalDraftAssetIds, RO_BUTTON_CHROME_IDS, type RoDraftModel } from "../src/ui/ro/index.ts";

describe("formal RO survivor draft", () => {
  it("maps only semantically related original RO icons and leaves unknown future choices blank", () => {
    const cases: [DraftOption, string | null][] = [
      [{ kind: "rank-basic", id: "skill.sw.basic_slash" }, "ui.skill.sm_sword.icon"],
      [{ kind: "new-active", id: "skill.sw.magnum_break" }, "ui.skill.sm_magnum.icon"],
      [{ kind: "new-passive", id: "passive.sw.hp_recovery" }, "ui.skill.sm_recovery.icon"],
      [{ kind: "heal", id: "heal" }, "ui.skill.sm_recovery.icon"],
      [{ kind: "keystone", id: "keystone.guardian" }, "ui.skill.sm_endure.icon"],
      [{ kind: "keystone", id: "keystone.weapon" }, "ui.skill.sm_twohand.icon"],
      [{ kind: "keystone", id: "keystone.fury" }, "ui.skill.sm_autoberserk.icon"],
      [{ kind: "keystone", id: "keystone.future" }, null],
    ];
    for (const [option, icon] of cases) expect(draftIconId(option)).toBe(icon);
  });

  it("declares every exact raster dependency and does not use the Korean-labelled chat background", () => {
    const model: RoDraftModel = {
      title: "升級",
      focused: 0,
      choices: [
        { key: "a", title: "A", kind: "新技能", lines: ["a"], iconId: "ui.skill.sm_sword.icon" },
        { key: "b", title: "B", kind: "回復", lines: ["b"], iconId: "ui.skill.sm_recovery.icon" },
      ],
    };
    const ids = formalDraftAssetIds(model);
    const buttonIds = [
      ...RO_BUTTON_CHROME_IDS.off,
      ...RO_BUTTON_CHROME_IDS.hover,
      ...RO_BUTTON_CHROME_IDS.down,
      ...RO_BUTTON_CHROME_IDS.disabled,
    ];
    expect(ids).toEqual(expect.arrayContaining([
      "ui.window.title.left", "ui.window.title.mid", "ui.window.title.right",
      "ui.chat.window.left", "ui.chat.window.mid", "ui.chat.window.right",
      "ui.slot.selection", "ui.skill.sm_sword.icon", "ui.skill.sm_recovery.icon",
      ...buttonIds,
    ]));
    expect(ids).not.toContain("ui.chat.window.background");
    expect(ids).not.toContain("ui.window.body.mid");
    expect(new Set(ids).size).toBe(ids.length);
  });
});
