import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadLocalEnv } from "../lib/env.ts";
import { writeJson } from "../assets/verify-sources-lib.ts";
import { compareSnapshots, OLD_TREE_ENV, snapshotAll, type TreeSnapshot } from "./old-trees-lib.ts";

const root = resolve(import.meta.dirname, "../..");
const [command, a = "before", b = "after"] = process.argv.slice(2);
const dir = join(root, "reports/local");
const usage = "usage: pnpm local:old-trees snapshot <label> | compare <labelA> <labelB>";

if (command === "snapshot") {
  const env = loadLocalEnv(root);
  const snaps = snapshotAll(env);
  const missing = Object.values(OLD_TREE_ENV).filter((k) => !env[k]);
  writeJson(join(dir, `old-trees-${a}.json`), { label: a, at: new Date().toISOString(), trees: snaps });
  for (const s of snaps) {
    const st = s.status ? `status total=${s.status.total} (M${s.status.modified} ?${s.status.untracked} D${s.status.deleted} S${s.status.staged})` : "status n/a";
    const head = s.head ? `${s.head.slice(0, 12)}${s.headMatchesExpected === false ? " (DIFFERS from plan)" : ""}` : "no git";
    console.log(`${s.id}: exists=${s.exists} git=${s.isGitRepo} head=${head} ${st} license=${s.license?.firstLine ?? "none"} AGENTS.md=${s.agentsMd}`);
  }
  if (missing.length > 0) console.log(`DEFERRED_LOCAL: not configured: ${missing.join(", ")} (set in .env.local)`);
  console.log(`wrote reports/local/old-trees-${a}.json (git-ignored; contains no file names)`);
} else if (command === "compare") {
  const load = (label: string): TreeSnapshot[] => {
    const p = join(dir, `old-trees-${label}.json`);
    if (!existsSync(p)) throw new Error(`missing ${p}; run snapshot ${label} first`);
    return (JSON.parse(readFileSync(p, "utf8")) as { trees: TreeSnapshot[] }).trees;
  };
  const diffs = compareSnapshots(load(a), load(b));
  for (const d of diffs) console.log(`${d.unchanged ? "UNCHANGED" : "CHANGED  "} ${d.id}${d.changes.length ? `: ${d.changes.join("; ")}` : ""}`);
  if (diffs.some((d) => !d.unchanged)) process.exitCode = 1;
} else {
  console.error(usage);
  process.exitCode = 2;
}
