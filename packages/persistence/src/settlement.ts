import type { Backend } from "./backend.ts";

export interface RunResult {
  schemaVersion: 1;
  profileId: string;
  runId: string;
  contentVersion: string;
  buildId: string;
  job: string;
  stage: string;
  runSeed: number;
  outcome: "victory" | "defeat";
  timeTicks: number;
  level: number;
  kills: number;
  damageDealt: number;
  damageTaken: number;
  levelUps: number;
  bossKillTick: number;
  damageBySource: Record<string, number>;
  damageTakenBySource: Record<string, number>;
  rewards: { baseXp: number; jobXp: number; items: string[]; unlock: string | null };
}

export interface CharacterRecord { job: string; baseXp: number; jobXp: number; runs: number; victories: number; bestTimeTicks: number | null }
export interface InventoryRecord { uid: string; itemId: string; source: string }

export function idempotencyKey(r: Pick<RunResult, "profileId" | "runId" | "contentVersion">): string {
  return `${r.profileId}+${r.runId}+${r.contentVersion}`;
}

/** Step 1, at run end: durably remember the result before any reward is applied (idempotent). */
export async function recordPending(b: Backend, r: RunResult): Promise<void> {
  const key = idempotencyKey(r);
  await b.transaction(async (tx) => {
    if ((await tx.get("runResults", key)) !== undefined) return;
    if ((await tx.get("pendingResults", key)) === undefined) tx.put("pendingResults", key, r);
  });
}

/**
 * Step 2: one transaction appends the run result and applies Base/Job XP, unlock and items. If the
 * key is already settled it only clears the pending record, so retries never duplicate rewards.
 */
export async function settle(b: Backend, key: string): Promise<{ applied: boolean }> {
  return b.transaction(async (tx) => {
    const done = await tx.get<RunResult>("runResults", key);
    const pending = await tx.get<RunResult>("pendingResults", key);
    if (done) {
      if (pending) tx.delete("pendingResults", key);
      return { applied: false };
    }
    if (!pending) return { applied: false };
    tx.put("runResults", key, pending); // append-only: written once per key, never overwritten
    const charKey = `${pending.profileId}:${pending.job}`;
    const ch = (await tx.get<CharacterRecord>("characters", charKey)) ?? { job: pending.job, baseXp: 0, jobXp: 0, runs: 0, victories: 0, bestTimeTicks: null };
    ch.baseXp += pending.rewards.baseXp;
    ch.jobXp += pending.rewards.jobXp;
    ch.runs += 1;
    if (pending.outcome === "victory") {
      ch.victories += 1;
      ch.bestTimeTicks = ch.bestTimeTicks === null ? pending.timeTicks : Math.min(ch.bestTimeTicks, pending.timeTicks);
    }
    tx.put("characters", charKey, ch);
    pending.rewards.items.forEach((itemId, i) => {
      const uid = `${key}#${i}`; // deterministic UID: a retry can only overwrite the same item
      tx.put("inventory", uid, { uid, itemId, source: key } satisfies InventoryRecord);
    });
    if (pending.rewards.unlock) tx.put("stageProgress", `${pending.profileId}:${pending.rewards.unlock}`, { unlocked: true, by: key });
    tx.delete("pendingResults", key);
    return { applied: true };
  });
}

/** Boot-time recovery: settle every pending result (e.g. after the page closed mid-settlement). */
export async function settleAllPending(b: Backend): Promise<number> {
  let applied = 0;
  for (const [key] of await b.getAll("pendingResults")) if ((await settle(b, key)).applied) applied += 1;
  return applied;
}
