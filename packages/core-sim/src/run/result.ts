import { Rng } from "../prng.ts";
import type { RunContent } from "./content.ts";
import type { RunState } from "./run.ts";

/** Plain run summary + rewards (structurally the persistence RunResult). Pure and deterministic. */
export function buildRunResult(c: RunContent, st: RunState, meta: { profileId: string; runId: string; buildId: string; job: string; stage: string }) {
  if (st.phase !== "victory" && st.phase !== "defeat") throw new Error("run has not ended");
  const victory = st.phase === "victory";
  const sum = (r: Record<string, number>): number => Object.values(r).reduce((a, b) => a + b, 0);
  const baseXp = st.stats.kills + st.player.level * 10 + (victory ? 500 : 0);
  const items: string[] = [];
  if (victory) {
    const loot = Rng.stream(st.seed, "loot");
    const pool = Object.keys(c.items).sort();
    for (let i = 0; i < 2; i += 1) items.push(pool[loot.nextInt(pool.length)] as string);
  }
  return {
    schemaVersion: 1 as const,
    profileId: meta.profileId,
    runId: meta.runId,
    contentVersion: c.contentVersion,
    buildId: meta.buildId,
    job: meta.job,
    stage: meta.stage,
    runSeed: st.seed,
    outcome: victory ? ("victory" as const) : ("defeat" as const),
    timeTicks: st.runTick,
    level: st.player.level,
    kills: st.stats.kills,
    damageDealt: sum(st.stats.damageBySource),
    damageTaken: sum(st.stats.damageTakenBySource),
    levelUps: st.stats.levelUps,
    bossKillTick: st.stats.bossKillTick,
    damageBySource: { ...st.stats.damageBySource },
    damageTakenBySource: { ...st.stats.damageTakenBySource },
    rewards: { baseXp, jobXp: Math.trunc((baseXp * 4) / 10), items, unlock: victory ? "stage.prt_fild08.slice.hard" : null },
  };
}
