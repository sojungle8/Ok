import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export interface TempGitRepo {
  root: string;
  write(relPath: string, content: string | Uint8Array): string;
  git(...args: string[]): string;
  commitAll(message: string): void;
  dispose(): void;
}

/** Throwaway git repo in the OS temp dir; used by rights:check and old-tree tests. */
export function createTempGitRepo(prefix = "ro-survivor-test-"): TempGitRepo {
  const root = mkdtempSync(join(tmpdir(), prefix));
  const git = (...args: string[]): string =>
    execFileSync("git", ["-C", root, "-c", "core.autocrlf=false", "-c", "user.name=test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  git("init", "-q", "-b", "main");
  return {
    root,
    git,
    write(relPath, content) {
      const abs = join(root, relPath);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, content);
      return abs;
    },
    commitAll(message) {
      git("add", "-A");
      git("commit", "-q", "--allow-empty", "-m", message);
    },
    dispose() {
      // Retries cover Windows EPERM/EBUSY while git child processes release their handles.
      rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    },
  };
}

export function createTempDir(prefix = "ro-survivor-tmp-"): { root: string; dispose(): void } {
  const root = mkdtempSync(join(tmpdir(), prefix));
  return { root, dispose: () => rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }) };
}
