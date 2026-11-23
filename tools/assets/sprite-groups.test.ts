import { describe, expect, it } from "vitest";
import type { WhitelistRow } from "@ro-survivor/content-schema";
import { spriteGroups } from "./extract-lib.ts";

const row = (asset_id: string): WhitelistRow => ({ asset_id } as WhitelistRow);
const base = ["player.hair01.male.spr", "player.hair01.male.act", "monster.1002.spr", "monster.1002.act"];
const mage = ["player.mage.male.body.spr", "player.mage.male.body.act", "player.mage.male.rod.spr", "player.mage.male.rod.act"];

describe("extractor sprite groups per job", () => {
  it("emits a three-layer Mage group only when its whole layer set is whitelisted", () => {
    expect(spriteGroups(base.map(row)).map((g) => g.id)).toEqual(["monster.1002"]);
    expect(spriteGroups([...base, ...mage.slice(0, 3)].map(row)).some((g) => g.id.startsWith("player.mage"))).toBe(false);
    const group = spriteGroups([...base, ...mage].map(row)).find((g) => g.id === "player.mage.male");
    expect(group?.layers.map((l) => [l.spr, l.palette ?? null])).toEqual([
      ["player.mage.male.body.spr", "palette.body.mage.male"],
      ["player.hair01.male.spr", "palette.hair01.male"],
      ["player.mage.male.rod.spr", null],
    ]);
  });
});
