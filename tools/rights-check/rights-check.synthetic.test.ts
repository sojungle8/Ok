import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createTempGitRepo, syntheticBytes, withMagic, type TempGitRepo } from "@ro-survivor/testkit";
import { scanRepository } from "./scan.ts";
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

const scan = (r: TempGitRepo) => scanRepository({ root: r.root, distDirs: ["dist"], maxUnknownBinaryBytes: 64 * 1024 });

describe("rights:check", () => {
  it("PASS: clean repo with ignored local assets and a clean dist", () => {
    const r = repo();
    r.write(".local-assets/abc/poring.spr", withMagic("SP\x01\x02", 64));
    r.write(".env.local", "RO_ASSET_SOURCE_DATA_GRF=/somewhere/data.grf\n");
    r.write("dist/index.html", "<!doctype html>");
    r.write("assets/placeholders/icon.png", syntheticBytes(3, 2048));
    const res = scan(r);
    expect(res.findings).toEqual([]);
    expect(res.ok).toBe(true);
  });

  it("FAIL: a staged test.grf fixture is detected (intentional failure)", () => {
    const r = repo();
    r.write("fixtures/test.grf", withMagic("Master of Magic\0", 128));
    r.git("add", "-A");
    const res = scan(r);
    expect(res.ok).toBe(false);
    expect(res.findings.map((f) => [f.where, f.path, f.code])).toContainEqual(["index", "fixtures/test.grf", "blocked-extension"]);
    expect(res.findings.map((f) => f.code)).toContain("ro-magic");
  });

  it("FAIL: untracked (not yet staged) RO file is detected; removing it makes the scan pass again", () => {
    const r = repo();
    const p = r.write("test.grf", withMagic("Master of Magic\0", 32));
    expect(scan(r).ok).toBe(false);
    rmSync(p);
    expect(scan(r).ok).toBe(true);
  });

  it("FAIL: a git-ignored test.grf in the working tree (outside .local-assets) is still detected", () => {
    const r = repo();
    r.write(".gitignore", ".env.*\n!.env.example\n.local-assets/\ndist/\n*.grf\n");
    r.commitAll("ignore grf");
    const p = r.write("test.grf", withMagic("Master of Magic\0", 32));
    const res = scan(r);
    expect(res.findings).toContainEqual(expect.objectContaining({ where: "worktree", path: "test.grf", code: "blocked-extension" }));
    rmSync(p);
    expect(scan(r).ok).toBe(true);
  });

  it("FAIL: renamed RO formats and audio are caught by magic bytes", () => {
    const r = repo();
    r.write("img/fake.png", withMagic("GRGN\x01\x07", 64));
    r.write("img/sprite.bin", withMagic(Uint8Array.from([0x53, 0x50, 0x01, 0x02, 0, 0]), 64));
    r.write("sound/a.dat", withMagic("RIFF\0\0\0\0WAVE", 64));
    r.git("add", "-A");
    const codes = scan(r).findings.map((f) => `${f.path}:${f.code}`);
    expect(codes).toContain("img/fake.png:ro-magic");
    expect(codes).toContain("img/sprite.bin:ro-magic");
    expect(codes).toContain("sound/a.dat:audio-magic");
  });

  it("FAIL: force-added .env.local, 登入資料 and private keys", () => {
    const r = repo();
    r.write(".env.local", "X=1\n");
    r.write("notes/登入資料.txt", "secret");
    r.write("keys/server.pem", "-----BEGIN-----");
    r.git("add", "-f", ".env.local", "notes/登入資料.txt", "keys/server.pem");
    const codes = scan(r).findings.map((f) => `${f.path}:${f.code}`);
    expect(codes).toContain(".env.local:secret-or-local-config");
    expect(codes).toContain("notes/登入資料.txt:credentials-file");
    expect(codes).toContain("keys/server.pem:secret-or-local-config");
  });

  it("FAIL: unknown large binary unless reviewed", () => {
    const r = repo();
    r.write("blob.bin", syntheticBytes(9, 200 * 1024));
    r.git("add", "-A");
    expect(scan(r).findings.map((f) => f.code)).toContain("large-unknown-binary");
    const reviewed = scanRepository({ root: r.root, maxUnknownBinaryBytes: 64 * 1024, allowLargeBinaries: ["blob.bin"] });
    expect(reviewed.ok).toBe(true);
  });

  it("FAIL: blocked file in dist output even though dist is ignored", () => {
    const r = repo();
    mkdirSync(join(r.root, "dist/assets"), { recursive: true });
    r.write("dist/assets/monster.spr", withMagic("SP\x01\x02\x00\x00", 16));
    r.write("dist/assets/bgm.mp3", withMagic("ID3\x04", 16));
    const res = scan(r);
    expect(res.findings.filter((f) => f.where === "dist").map((f) => f.code)).toEqual(
      expect.arrayContaining(["blocked-extension", "ro-magic", "blocked-audio", "audio-magic"]),
    );
  });

  it("FAIL: an RO file deleted from HEAD still exists in Git history", () => {
    const r = repo();
    r.write("old/prt_fild08.gat", withMagic("GRAT\x01\x02", 16));
    r.commitAll("oops");
    r.git("rm", "-q", "old/prt_fild08.gat");
    r.commitAll("remove");
    const res = scan(r);
    expect(res.findings).toContainEqual(expect.objectContaining({ where: "history", path: "old/prt_fild08.gat" }));
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
