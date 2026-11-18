import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createTempGitRepo, type TempGitRepo } from "@ro-survivor/testkit";
import { validateReferencePack } from "./validate-lib.ts";

const repoRoot = resolve(import.meta.dirname, "../..");
const repos: TempGitRepo[] = [];
afterEach(() => {
  while (repos.length) repos.pop()?.dispose();
});

function referenceCopy(): TempGitRepo {
  const repo = createTempGitRepo("reference-pack-");
  repos.push(repo);
  cpSync(join(repoRoot, "docs/product-plan"), join(repo.root, "docs/product-plan"), { recursive: true });
  cpSync(join(repoRoot, ".gitattributes"), join(repo.root, ".gitattributes"));
  repo.git("add", "-A");
  return repo;
}

interface MutableReferenceIndex {
  snapshots: { id: string; path: string; bytes: number; sha256: string }[];
  activeSnapshotId: string;
}

interface MutableReferenceSnapshot {
  variantComparisons: {
    featureId: string;
    officialObservationIds: string[];
    hansObservationIds: string[];
    conflict: boolean;
    resolutionDecisionId: string | null;
  }[];
}

function rewriteActiveSnapshot(repo: TempGitRepo, mutate: (snapshot: MutableReferenceSnapshot) => void): void {
  const indexPath = join(repo.root, "docs/product-plan/handoff/reference-index.json");
  const index = JSON.parse(readFileSync(indexPath, "utf8")) as MutableReferenceIndex;
  const entry = index.snapshots.find((candidate) => candidate.id === index.activeSnapshotId);
  if (!entry) throw new Error("active reference snapshot missing from test fixture");
  const snapshotPath = join(repo.root, ...entry.path.split("/"));
  const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as MutableReferenceSnapshot;
  mutate(snapshot);
  const snapshotBytes = Buffer.from(`${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  writeFileSync(snapshotPath, snapshotBytes);
  entry.bytes = snapshotBytes.length;
  entry.sha256 = createHash("sha256").update(snapshotBytes).digest("hex").toUpperCase();
  writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
  repo.git("add", "-A");
}

describe("offline public reference validation", () => {
  it("accepts the indexed append-only pack without network access", () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => Promise.reject(new Error("network disabled"));
    try {
      const result = validateReferencePack(repoRoot);
      expect(result.errors).toEqual([]);
      expect(result.stats).toEqual({
        snapshots: 2,
        ledgerSegments: 2,
        observations: 33,
        activeSnapshotId: "ro-reference-2026-11-18-taipei",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("fails closed when the index has no active snapshot or a traversal path", () => {
    const repo = referenceCopy();
    const path = join(repo.root, "docs/product-plan/handoff/reference-index.json");
    const index = JSON.parse(readFileSync(path, "utf8")) as { activeSnapshotId: string; snapshots: { status: string; path: string }[] };
    index.snapshots = index.snapshots.map((entry) => ({ ...entry, status: "superseded" }));
    index.snapshots[0]!.path = "../outside.json";
    writeFileSync(path, JSON.stringify(index));
    const errors = validateReferencePack(repo.root).errors.join("\n");
    expect(errors).toMatch(/invalid|active|path/iu);
  });

  it("detects worktree bytes/hash drift independently from the staged blob", () => {
    const repo = referenceCopy();
    const path = join(repo.root, "docs/product-plan/handoff/reference-snapshot-2026-11-18.json");
    writeFileSync(path, Buffer.concat([readFileSync(path), Buffer.from(" ")]));
    const errors = validateReferencePack(repo.root).errors.join("\n");
    expect(errors).toMatch(/worktree SHA-256|bytes/iu);
    expect(errors).not.toMatch(/Git blob SHA-256/iu);
  });

  it("rejects an unstaged reference index that differs from the commit payload", () => {
    const repo = referenceCopy();
    const path = join(repo.root, "docs/product-plan/handoff/reference-index.json");
    writeFileSync(path, Buffer.concat([readFileSync(path), Buffer.from(" ")]));
    expect(validateReferencePack(repo.root).errors.join("\n")).toMatch(/index\.json worktree bytes differ from the staged Git blob/iu);
  });

  it("rejects duplicate JSON object keys even when JSON.parse would overwrite them", () => {
    const repo = referenceCopy();
    const path = join(repo.root, "docs/product-plan/handoff/reference-index.json");
    const text = readFileSync(path, "utf8").replace('"schemaVersion": 1,', '"schemaVersion": 1,\n  "schemaVersion": 1,');
    writeFileSync(path, text);
    repo.git("add", "-A");
    expect(validateReferencePack(repo.root).errors.join("\n")).toMatch(/duplicate JSON keys/iu);
  });

  it("detects a duplicate observation ID across ledger segments", () => {
    const repo = referenceCopy();
    const deltaPath = join(repo.root, "docs/product-plan/handoff/reference-ledger-delta-2026-11-18.csv");
    const text = readFileSync(deltaPath, "utf8").replace("OBS-20261118-OFFICIAL-001", "OBS-20261117-OFFICIAL-001");
    writeFileSync(deltaPath, text);
    expect(validateReferencePack(repo.root).errors.join("\n")).toMatch(/duplicate observation_id/iu);
  });

  it("rejects runtime source that imports the research pack", () => {
    const repo = referenceCopy();
    const dir = join(repo.root, "apps/client/src");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "bad.ts"), "const path = 'reference-snapshot-2026-11-18.json';\n");
    expect(validateReferencePack(repo.root).errors.join("\n")).toMatch(/runtime source may not import/iu);
  });

  it("guards every app/package source root and the baseline ledger name", () => {
    const repo = referenceCopy();
    const dir = join(repo.root, "apps/asset-gateway/src");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "bad.ts"), "const path = 'reference-ledger.csv';\n");
    expect(validateReferencePack(repo.root).errors.join("\n")).toMatch(/apps\/asset-gateway\/src\/bad\.ts/iu);
  });

  it("enforces comparison provenance and requires an accepted conflict resolution", () => {
    const repo = referenceCopy();
    rewriteActiveSnapshot(repo, (snapshot) => {
      snapshot.variantComparisons.push({
        featureId: "feature.reversed-provenance",
        officialObservationIds: ["OBS-20261118-HANS-001"],
        hansObservationIds: ["OBS-20261118-OFFICIAL-001"],
        conflict: false,
        resolutionDecisionId: null,
      }, {
        featureId: "feature.pending-resolution",
        officialObservationIds: ["OBS-20261118-OFFICIAL-001"],
        hansObservationIds: ["OBS-20261118-HANS-001"],
        conflict: true,
        resolutionDecisionId: "candidate.run.pending-choice-bank",
      });
    });
    const errors = validateReferencePack(repo.root).errors.join("\n");
    expect(errors).toMatch(/not from an official source/iu);
    expect(errors).toMatch(/not from a HANS source/iu);
    expect(errors).toMatch(/must reference an accepted fan-local decision/iu);
  });
});
