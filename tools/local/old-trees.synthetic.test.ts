import { statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createTempGitRepo, type TempGitRepo } from "@ro-survivor/testkit";
import { compareSnapshots, snapshotAll, snapshotTree } from "./old-trees-lib.ts";

const repos: TempGitRepo[] = [];
afterEach(() => {
  while (repos.length) repos.pop()?.dispose();
});

describe("local:old-trees (synthetic repos)", () => {
  it("records commit, license and status counts without file names, and does not write the index", () => {
    const r = createTempGitRepo("old-tree-");
    repos.push(r);
    r.write("LICENSE", "GNU GENERAL PUBLIC LICENSE\nVersion 3\n");
    r.write("a.txt", "a");
    r.commitAll("init");
    r.write("a.txt", "changed");
    r.write("登入資料.txt", "must never be read");
    const indexBefore = statSync(join(r.root, ".git/index")).mtimeMs;
    const snap = snapshotTree("remoteClient", r.root);
    expect(statSync(join(r.root, ".git/index")).mtimeMs).toBe(indexBefore);
    expect(snap.isGitRepo).toBe(true);
    expect(snap.head).toMatch(/^[0-9a-f]{40}$/u);
    expect(snap.headMatchesExpected).toBe(false);
    expect(snap.license?.firstLine).toBe("GNU GENERAL PUBLIC LICENSE");
    expect(snap.status).toMatchObject({ modified: 1, untracked: 1, total: 2 });
    expect(JSON.stringify(snap)).not.toContain("登入資料");
    expect(JSON.stringify(snap)).not.toContain("must never be read");
  });

  it("detects a change between before/after snapshots", () => {
    const r = createTempGitRepo("old-tree-");
    repos.push(r);
    r.write("a.txt", "a");
    r.commitAll("init");
    const env = { RO_OLD_TREE_SERVER: r.root };
    const before = snapshotAll(env);
    expect(compareSnapshots(before, snapshotAll(env)).every((d) => d.unchanged)).toBe(true);
    r.write("new.txt", "x");
    const diff = compareSnapshots(before, snapshotAll(env)).find((d) => d.id === "server");
    expect(diff?.unchanged).toBe(false);
  });

  it("marks unconfigured trees instead of guessing paths", () => {
    const snaps = snapshotAll({});
    expect(snaps.every((s) => !s.configured && !s.exists)).toBe(true);
  });
});
