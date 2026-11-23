import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createTempGitRepo, syntheticBytes, withMagic, type TempGitRepo } from "@ro-survivor/testkit";
import { scanRepository, type HistoryScope } from "./scan.ts";
import { checkContent, checkPath } from "./rules.ts";

const repos: TempGitRepo[] = [];
function repo(): TempGitRepo {
  const r = createTempGitRepo("rights-check-");
  r.write(".gitignore", ".env.*\n!.env.example\n.local-assets/\ndist/\n");
  r.write("README.md", "# ok\n");
  r.write("src/index.ts", "export const a = 1;\n");
  r.write(".env.example", "RO_ASSET_GATEWAY_PORT=4178\n");
  r.commitAll("init");
  repos.push(r);
  return r;
}
afterEach(() => {
  while (repos.length) repos.pop()?.dispose();
});

const scan = (r: TempGitRepo, history: HistoryScope = { scanFullHistory: true }) =>
  scanRepository({ root: r.root, history, distDirs: ["dist"], maxUnknownBinaryBytes: 64 * 1024 });
const head = (r: TempGitRepo): string => r.git("rev-parse", "HEAD").trim();

describe("rights:check", () => {
  it("PASS: clean repo with ignored local assets and a clean dist", async () => {
    const r = repo();
    r.write(".local-assets/abc/poring.spr", withMagic("SP\x01\x02", 64));
    r.write(".env.local", "RO_ASSET_SOURCE_DATA_GRF=/somewhere/data.grf\n");
    r.write("dist/index.html", "<!doctype html>");
    r.write("assets/placeholders/icon.png", syntheticBytes(3, 2048));
    const res = await scan(r);
    expect(res.findings).toEqual([]);
    expect(res.ok).toBe(true);
  });

  it("FAIL: a staged test.grf fixture is detected (intentional failure)", async () => {
    const r = repo();
    r.write("fixtures/test.grf", withMagic("Master of Magic\0", 128));
    r.git("add", "-A");
    const res = await scan(r);
    expect(res.ok).toBe(false);
    expect(res.findings.map((f) => [f.where, f.path, f.code])).toContainEqual(["index", "fixtures/test.grf", "blocked-extension"]);
    expect(res.findings.map((f) => f.code)).toContain("ro-magic");
  });

  it("FAIL: untracked (not yet staged) RO file is detected; removing it makes the scan pass again", async () => {
    const r = repo();
    const p = r.write("test.grf", withMagic("Master of Magic\0", 32));
    expect((await scan(r)).ok).toBe(false);
    rmSync(p);
    expect((await scan(r)).ok).toBe(true);
  });

  it("FAIL: a git-ignored test.grf in the working tree (outside .local-assets) is still detected", async () => {
    const r = repo();
    r.write(".gitignore", ".env.*\n!.env.example\n.local-assets/\ndist/\n*.grf\n");
    r.commitAll("ignore grf");
    const p = r.write("test.grf", withMagic("Master of Magic\0", 32));
    const res = await scan(r);
    expect(res.findings).toContainEqual(expect.objectContaining({ where: "worktree", path: "test.grf", code: "blocked-extension" }));
    rmSync(p);
    expect((await scan(r)).ok).toBe(true);
  });

  it("FAIL: renamed RO formats and audio are caught by magic bytes", async () => {
    const r = repo();
    r.write("img/fake.png", withMagic("GRGN\x01\x07", 64));
    r.write("img/sprite.bin", withMagic(Uint8Array.from([0x53, 0x50, 0x01, 0x02, 0, 0]), 64));
    r.write("sound/a.dat", withMagic("RIFF\0\0\0\0WAVE", 64));
    r.git("add", "-A");
    const codes = (await scan(r)).findings.map((f) => `${f.path}:${f.code}`);
    expect(codes).toContain("img/fake.png:ro-magic");
    expect(codes).toContain("img/sprite.bin:ro-magic");
    expect(codes).toContain("sound/a.dat:audio-magic");
  });

  it("FAIL: force-added .env.local, 登入資料 and private keys", async () => {
    const r = repo();
    r.write(".env.local", "X=1\n");
    r.write("notes/登入資料.txt", "secret");
    r.write("keys/server.pem", "-----BEGIN-----");
    r.git("add", "-f", ".env.local", "notes/登入資料.txt", "keys/server.pem");
    const codes = (await scan(r)).findings.map((f) => `${f.path}:${f.code}`);
    expect(codes).toContain(".env.local:secret-or-local-config");
    expect(codes).toContain("notes/登入資料.txt:credentials-file");
    expect(codes).toContain("keys/server.pem:secret-or-local-config");
  });

  it("FAIL: unknown large binary unless reviewed", async () => {
    const r = repo();
    r.write("blob.bin", syntheticBytes(9, 200 * 1024));
    r.git("add", "-A");
    expect((await scan(r)).findings.map((f) => f.code)).toContain("large-unknown-binary");
    const reviewed = await scanRepository({ root: r.root, history: { scanFullHistory: true }, maxUnknownBinaryBytes: 64 * 1024, allowLargeBinaries: ["blob.bin"] });
    expect(reviewed.ok).toBe(true);
  });

  it("FAIL: blocked file in dist output even though dist is ignored", async () => {
    const r = repo();
    mkdirSync(join(r.root, "dist/assets"), { recursive: true });
    r.write("dist/assets/monster.spr", withMagic("SP\x01\x02\x00\x00", 16));
    r.write("dist/assets/bgm.mp3", withMagic("ID3\x04", 16));
    const res = await scan(r);
    expect(res.findings.filter((f) => f.where === "dist").map((f) => f.code)).toEqual(
      expect.arrayContaining(["blocked-extension", "ro-magic", "blocked-audio", "audio-magic"]),
    );
  });

  it("FAIL: an RO file deleted from HEAD still exists in Git history", async () => {
    const r = repo();
    r.write("old/prt_fild08.gat", withMagic("GRAT\x01\x02", 16));
    r.commitAll("oops");
    r.git("rm", "-q", "old/prt_fild08.gat");
    r.commitAll("remove");
    const res = await scan(r);
    expect(res.findings).toContainEqual(expect.objectContaining({ where: "history", path: "old/prt_fild08.gat" }));
  });
});

describe("rights:check trusted history baseline", () => {
  it("a. a large PNG committed and removed before the baseline does not block", async () => {
    const r = repo();
    r.write("pixel-rpg/atlas.png", Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from(syntheticBytes(5, 300 * 1024))]));
    r.commitAll("old project art");
    r.git("rm", "-q", "-r", "pixel-rpg");
    r.commitAll("remove old art");
    const baseline = head(r);
    r.write("src/next.ts", "export const b = 2;\n");
    r.commitAll("after baseline");
    expect((await scan(r, { scanFullHistory: true })).findings.map((f) => f.code)).toContain("large-unknown-binary");
    const res = await scan(r, baseline);
    expect(res.findings).toEqual([]);
    expect(res.baseline).toBe(baseline);
  });

  it("b. an RO file renamed to .png and deleted after the baseline is caught by magic bytes", async () => {
    const r = repo();
    const baseline = head(r);
    r.write("img/cover.png", withMagic("GRAT\x01\x02\x00\x00", 128));
    r.write("img/sound.bin", withMagic("RIFF\0\0\0\0WAVE", 64));
    r.commitAll("sneaky");
    r.git("rm", "-q", "img/cover.png", "img/sound.bin");
    r.commitAll("delete");
    const res = await scan(r, baseline);
    expect(res.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ where: "history", path: "img/cover.png", code: "ro-magic" }),
        expect.objectContaining({ where: "history", path: "img/sound.bin", code: "audio-magic" }),
      ]),
    );
  });

  it("b2. a large blob after the baseline is read with a bounded prefix and still flagged", async () => {
    const r = repo();
    const baseline = head(r);
    r.write("data/big.bin", Buffer.concat([Buffer.from("Master of Magic\0"), Buffer.from(syntheticBytes(6, 3 * 1024 * 1024))]));
    r.write("data/unreviewed.bin", syntheticBytes(7, 2 * 1024 * 1024));
    r.commitAll("big");
    r.git("rm", "-q", "-r", "data");
    r.commitAll("drop big");
    const codes = (await scan(r, baseline)).findings.map((f) => `${f.path}:${f.code}`);
    expect(codes).toContain("data/big.bin:ro-magic");
    expect(codes).toContain("data/unreviewed.bin:large-unknown-binary");
  });

  it("c. invalid baselines fail closed: short, missing, non-commit, non-ancestor", async () => {
    const r = repo();
    const base = head(r);
    const tree = r.git("rev-parse", "HEAD^{tree}").trim();
    r.git("checkout", "-q", "-b", "side");
    r.write("side.txt", "x");
    r.commitAll("side");
    const sideCommit = head(r);
    r.git("checkout", "-q", "main");
    r.write("main.txt", "y");
    r.commitAll("main");
    const cases: [string, RegExp][] = [
      [base.slice(0, 7), /full 40-character/u],
      ["0".repeat(40), /does not exist/u],
      [tree, /is a tree, not a commit/u],
      [sideCommit, /not an ancestor/u],
      ["", /full 40-character/u],
    ];
    for (const [value, message] of cases) {
      const res = await scan(r, value);
      expect(res.ok).toBe(false);
      expect(res.findings).toContainEqual(expect.objectContaining({ code: "history-baseline", detail: expect.stringMatching(message) as unknown }));
    }
    expect((await scan(r, base)).ok).toBe(true);
  });

  it("d. a blocked file still in the index is reported once (index), not again from history", async () => {
    const r = repo();
    const baseline = head(r);
    r.write("assets/monster.spr", withMagic("SP\x01\x02\x00\x00", 64));
    r.commitAll("add sprite");
    r.write("README.md", "# changed\n");
    r.commitAll("later");
    const res = await scan(r, baseline);
    expect(res.findings.map((f) => `${f.where}:${f.path}:${f.code}`).sort()).toEqual([
      "index:assets/monster.spr:blocked-extension",
      "index:assets/monster.spr:ro-magic",
    ]);
  });

  it("e. objects from another branch merged after the baseline are scanned", async () => {
    const r = repo();
    r.git("checkout", "-q", "-b", "other");
    r.write("other/model.dat", withMagic("GRSM\x01\x05", 64));
    r.commitAll("other branch adds disguised RSM");
    r.git("rm", "-q", "other/model.dat");
    r.commitAll("other branch deletes it");
    r.git("checkout", "-q", "main");
    r.write("main.txt", "m");
    r.commitAll("main moves on");
    const baseline = head(r);
    expect((await scan(r, baseline)).ok).toBe(true);
    r.git("-c", "user.name=t", "-c", "user.email=t@example.invalid", "merge", "-q", "--no-ff", "--no-edit", "other");
    const res = await scan(r, baseline);
    expect(res.findings).toContainEqual(expect.objectContaining({ where: "history", path: "other/model.dat", code: "ro-magic" }));
  });
});

describe("rights rules", () => {
  it("does not flag ordinary source files", () => {
    for (const p of ["src/password-hash.ts", "apps/client/src/App.tsx", ".env.example", "docs/a.md", "README.md"]) {
      expect(checkPath(p)).toBeNull();
    }
  });
  it("does not flag text or PNG content", () => {
    expect(checkContent(new TextEncoder().encode("SPECIAL text file"))).toBeNull();
    expect(checkContent(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBeNull();
  });
});
