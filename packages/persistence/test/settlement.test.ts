import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CrashError, IndexedDbBackend, MemoryBackend, recordPending, settle, settleAllPending, idempotencyKey, type Backend, type CrashPoint, type RunResult } from "../src/index.ts";

function result(runId: string, outcome: "victory" | "defeat" = "victory"): RunResult {
  return {
    schemaVersion: 1, profileId: "p1", runId, contentVersion: "slice-0.1.0-seed", buildId: "test", job: "job.swordsman", stage: "stage.prt_fild08.slice", runSeed: 1,
    outcome, timeTicks: 40000, level: 18, kills: 900, damageDealt: 1, damageTaken: 1, levelUps: 17, bossKillTick: 40000, damageBySource: {}, damageTakenBySource: {},
    rewards: { baseXp: 1000, jobXp: 400, items: ["equip.test.sword", "equip.test.clip"], unlock: "stage.prt_fild08.slice.hard" },
  };
}

async function totals(b: Backend) {
  const chars = await b.getAll<{ baseXp: number; jobXp: number; runs: number }>("characters");
  return {
    results: (await b.getAll("runResults")).length,
    pending: (await b.getAll("pendingResults")).length,
    items: (await b.getAll("inventory")).length,
    baseXp: chars.reduce((s, [, c]) => s + c.baseXp, 0),
    runs: chars.reduce((s, [, c]) => s + c.runs, 0),
  };
}

/** Close the page at a crash point, then "reload" and retry until settled. */
async function settleWithFaults(b: MemoryBackend, r: RunResult, crash: CrashPoint, step: "record" | "settle", crashAfterWrites: number): Promise<void> {
  b.crash = step === "record" ? crash : null;
  b.crashAfterWrites = crashAfterWrites;
  try {
    await recordPending(b, r);
    b.crash = crash;
    await settle(b, idempotencyKey(r));
  } catch (err) {
    expect(err).toBeInstanceOf(CrashError);
  }
  // reload: boot recovery + the results screen retrying the same run
  await recordPending(b, r);
  await settleAllPending(b);
  await settle(b, idempotencyKey(r));
}

describe("settlement", () => {
  it("applies a run exactly once and appends one result", async () => {
    const b = new MemoryBackend();
    const r = result("run-1");
    await recordPending(b, r);
    expect(await settle(b, idempotencyKey(r))).toEqual({ applied: true });
    expect(await settle(b, idempotencyKey(r))).toEqual({ applied: false });
    await recordPending(b, r);
    expect(await settleAllPending(b)).toBe(0);
    expect(await totals(b)).toEqual({ results: 1, pending: 0, items: 2, baseXp: 1000, runs: 1 });
  });

  it("20 fault-injected closes (before / during / after the transaction) never lose or duplicate rewards", async () => {
    const b = new MemoryBackend();
    const points: CrashPoint[] = ["before-transaction", "mid-transaction", "after-commit"];
    for (let i = 0; i < 20; i += 1) {
      await settleWithFaults(b, result(`run-${i}`), points[i % 3] as CrashPoint, i % 2 === 0 ? "settle" : "record", 1 + (i % 5));
    }
    expect(await totals(b)).toEqual({ results: 20, pending: 0, items: 40, baseXp: 20_000, runs: 20 });
  });

  it("an aborted transaction leaves no partial writes", async () => {
    const b = new MemoryBackend();
    const r = result("run-x");
    await recordPending(b, r);
    b.crash = "mid-transaction";
    b.crashAfterWrites = 3;
    await expect(settle(b, idempotencyKey(r))).rejects.toBeInstanceOf(CrashError);
    expect(await totals(b)).toEqual({ results: 0, pending: 1, items: 0, baseXp: 0, runs: 0 });
  });
});

describe("IndexedDB backend (fake-indexeddb)", () => {
  it("settles atomically, rolls back on a thrown error, and stays idempotent", async () => {
    const b = await IndexedDbBackend.open(`ro-survivor-test-${Date.now()}`);
    const r = result("idb-1");
    await recordPending(b, r);
    await expect(
      b.transaction(async (tx) => {
        tx.put("inventory", "half-written", { uid: "x" });
        await Promise.resolve();
        throw new Error("page closed mid-transaction");
      }),
    ).rejects.toThrow(/page closed/u);
    expect((await b.getAll("inventory")).length).toBe(0);
    expect((await settle(b, idempotencyKey(r))).applied).toBe(true);
    expect((await settle(b, idempotencyKey(r))).applied).toBe(false);
    expect(await totals(b)).toEqual({ results: 1, pending: 0, items: 2, baseXp: 1000, runs: 1 });
    b.close();
  });
});
