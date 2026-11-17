import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createTempDir, syntheticBytes } from "@ro-survivor/testkit";
import type { SourceLockExample } from "@ro-survivor/content-schema";
import { verifySources } from "./verify-sources-lib.ts";

const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex").toUpperCase();
const dirs: { dispose(): void }[] = [];
afterEach(() => {
  while (dirs.length) dirs.pop()?.dispose();
});

/** Synthetic stand-ins: random bytes named like the real sources; never RO material. */
function fixture() {
  const d = createTempDir("verify-sources-");
  dirs.push(d);
  const data = syntheticBytes(1, 4096);
  const rdata = syntheticBytes(2, 1024);
  const bgm12 = syntheticBytes(3, 512);
  writeFileSync(join(d.root, "data.grf"), data);
  writeFileSync(join(d.root, "rdata.grf"), rdata);
  mkdirSync(join(d.root, "BGM"));
  writeFileSync(join(d.root, "BGM/12.mp3"), bgm12);
  writeFileSync(join(d.root, "BGM/01.mp3"), syntheticBytes(4, 256));
  const lock: SourceLockExample = {
    schemaVersion: 1,
    lockId: "synthetic",
    pathEncoding: "cp949",
    sources: {
      "data.grf": { envVar: "RO_ASSET_SOURCE_DATA_GRF", bytes: data.length, sha256: sha(data) },
      "rdata.grf": { envVar: "RO_ASSET_SOURCE_RDATA_GRF", bytes: rdata.length, sha256: sha(rdata) },
      bgm: { envVar: "RO_ASSET_BGM_DIR", expectedFileCount: 2, pinnedFiles: { "12.mp3": { bytes: bgm12.length, sha256: sha(bgm12) } } },
    },
  };
  const env = {
    RO_ASSET_SOURCE_DATA_GRF: join(d.root, "data.grf"),
    RO_ASSET_SOURCE_RDATA_GRF: join(d.root, "rdata.grf"),
    RO_ASSET_BGM_DIR: join(d.root, "BGM"),
  };
  return { lock, env };
}

describe("assets:verify-sources (synthetic sources)", () => {
  it("passes and produces a local lock when hashes match", async () => {
    const { lock, env } = fixture();
    const res = await verifySources({ lock, env, now: () => new Date("2026-11-17T00:00:00Z") });
    expect(res.ok).toBe(true);
    expect(res.lock?.sources.bgm.fileCount).toBe(2);
    expect(res.lock?.sources["data.grf"].sha256).toBe(lock.sources["data.grf"].sha256);
    expect(res.checks.every((c) => c.status === "PASS")).toBe(true);
  });

  it("stops without producing a lock when a GRF hash differs", async () => {
    const { lock, env } = fixture();
    lock.sources["data.grf"].sha256 = "0".repeat(64);
    const res = await verifySources({ lock, env });
    expect(res.ok).toBe(false);
    expect(res.lock).toBeNull();
    expect(res.checks).toContainEqual(expect.objectContaining({ sourceId: "data.grf", check: "sha256", status: "FAIL" }));
  });

  it("fails when the pinned BGM file differs and warns on count drift", async () => {
    const { lock, env } = fixture();
    lock.sources.bgm.expectedFileCount = 185;
    lock.sources.bgm.pinnedFiles["12.mp3"] = { bytes: 1, sha256: "A".repeat(64) };
    const res = await verifySources({ lock, env });
    expect(res.ok).toBe(false);
    expect(res.checks).toContainEqual(expect.objectContaining({ check: "mp3 count", status: "WARN" }));
  });

  it("reports missing env vars as DEFERRED (no paths guessed)", async () => {
    const { lock } = fixture();
    const res = await verifySources({ lock, env: {} });
    expect(res.ok).toBe(false);
    expect(res.missingEnv).toEqual(["RO_ASSET_SOURCE_DATA_GRF", "RO_ASSET_SOURCE_RDATA_GRF", "RO_ASSET_BGM_DIR"]);
  });
});
