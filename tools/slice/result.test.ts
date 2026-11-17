import { describe, expect, it } from "vitest";
import { buildRunResult } from "@ro-survivor/core-sim";
import { idempotencyKey, MemoryBackend, recordPending, settle, type RunResult } from "@ro-survivor/persistence";
import { playRun, sliceContent } from "./slice-fixture.ts";

describe("run result -> settlement", () => {
  it("a finished run produces a deterministic result that settles once", async () => {
    const st = playRun(3, "guardian");
    const meta = { profileId: "p1", runId: "run-3", buildId: "test", job: "job.swordsman", stage: "stage.prt_fild08.slice" };
    const r: RunResult = buildRunResult(sliceContent, st, meta);
    expect(r).toEqual(buildRunResult(sliceContent, playRun(3, "guardian"), meta));
    expect(r.outcome).toBe("victory");
    expect(r.rewards.items).toHaveLength(2);
    for (const i of r.rewards.items) expect(Object.keys(sliceContent.items)).toContain(i);
    const b = new MemoryBackend();
    await recordPending(b, r);
    expect((await settle(b, idempotencyKey(r))).applied).toBe(true);
    expect((await settle(b, idempotencyKey(r))).applied).toBe(false);
  }, 30_000);
});
