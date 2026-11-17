import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createTempGitRepo, type TempGitRepo } from "@ro-survivor/testkit";
import { exitCodeFor, validateHandoff } from "./validate-handoff-lib.ts";

const repoRoot = resolve(import.meta.dirname, "../..");
const repos: TempGitRepo[] = [];
afterEach(() => {
  while (repos.length) repos.pop()?.dispose();
});

/** Copy the plan into a throwaway git repo (with the same .gitattributes) and stage it. */
function planCopy(): TempGitRepo {
  const r = createTempGitRepo("handoff-");
  repos.push(r);
  cpSync(join(repoRoot, "docs/product-plan"), join(r.root, "docs/product-plan"), { recursive: true });
  cpSync(join(repoRoot, ".gitattributes"), join(r.root, ".gitattributes"));
  r.git("add", "-A");
  return r;
}

describe("handoff package re-validation", () => {
  it("every check on this checkout is PASS (worktree and Git blob hashes included)", () => {
    const checks = validateHandoff(repoRoot);
    expect(checks.filter((c) => c.status !== "PASS")).toEqual([]);
    expect(checks.filter((c) => c.id.startsWith("delivered-hash:blob:"))).toHaveLength(4);
    expect(checks.filter((c) => c.id.startsWith("delivered-hash:worktree:"))).toHaveLength(4);
    expect(exitCodeFor(checks)).toBe(0);
  });

  it("fails closed on DRIFT when a locked file gains a trailing CRLF", () => {
    const r = planCopy();
    const p = join(r.root, "docs/product-plan/reference-ledger.csv");
    writeFileSync(p, Buffer.concat([readFileSync(p), Buffer.from("\r\n")]));
    const checks = validateHandoff(r.root);
    expect(checks).toContainEqual(expect.objectContaining({ id: "delivered-hash:worktree:../reference-ledger.csv", status: "DRIFT" }));
    expect(exitCodeFor(checks)).toBe(1);
  });

  it("checks the staged Git blob, not only the working tree", () => {
    const r = planCopy();
    const rel = "docs/product-plan/handoff/vertical-slice-content-seed.json";
    const p = join(r.root, rel);
    const good = readFileSync(p);
    writeFileSync(p, Buffer.concat([good, Buffer.from(" ")]));
    r.git("add", rel);
    writeFileSync(p, good);
    const checks = validateHandoff(r.root);
    expect(checks).toContainEqual(expect.objectContaining({ id: "delivered-hash:worktree:vertical-slice-content-seed.json", status: "PASS" }));
    expect(checks).toContainEqual(expect.objectContaining({ id: "delivered-hash:blob:vertical-slice-content-seed.json", status: "DRIFT" }));
    expect(exitCodeFor(checks)).toBe(1);
  });

  it("treats FAIL and an empty result as non-zero", () => {
    expect(exitCodeFor([{ id: "x", status: "FAIL", detail: "" }])).toBe(1);
    expect(exitCodeFor([])).toBe(1);
  });
});
