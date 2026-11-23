import { describe, expect, it } from "vitest";
import { FORMAL_JOB_PLAYERS, FORMAL_PLAYER_LAYERS, jobAvailable, jobPlayerIds } from "../src/formal.ts";

describe("per-job formal player sets", () => {
  it("keeps the Swordsman set identical to the required formal layers", () => {
    expect(FORMAL_JOB_PLAYERS["job.swordsman"]?.layers).toBe(FORMAL_PLAYER_LAYERS);
  });

  it("offers Mage only when its whole player set is whitelisted", () => {
    const ids = jobPlayerIds("job.mage");
    expect(ids).toEqual([
      "player.mage.male.body.spr", "player.mage.male.body.act", "player.hair01.male.spr", "player.hair01.male.act",
      "player.mage.male.rod.spr", "player.mage.male.rod.act", "palette.body.mage.male", "palette.hair01.male",
    ]);
    const has = (set: Set<string>) => ({ has: (id: string) => set.has(id) });
    expect(jobAvailable(has(new Set(ids)), "job.mage")).toBe(true);
    expect(jobAvailable(has(new Set(ids.slice(1))), "job.mage")).toBe(false);
    expect(jobAvailable(has(new Set(ids)), "job.unknown")).toBe(false);
    expect(() => jobPlayerIds("job.unknown")).toThrow(/unknown job/u);
  });
});
