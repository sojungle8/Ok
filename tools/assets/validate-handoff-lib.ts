import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AssetWhitelist, checkWhitelistRoundTrips, parseCsvRecords } from "@ro-survivor/asset-contracts";
import { sha256Text } from "../lib/hash.ts";

export interface HandoffCheck {
  id: string;
  status: "PASS" | "FAIL" | "DRIFT";
  detail: string;
}

const PLAN = "docs/product-plan";

function read(root: string, rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

/** Re-run the equivalent of docs/product-plan/handoff/VALIDATION.md entirely offline. */
export function validateHandoff(root: string): HandoffCheck[] {
  const checks: HandoffCheck[] = [];
  const push = (id: string, ok: boolean, detail: string): void => {
    checks.push({ id, status: ok ? "PASS" : "FAIL", detail });
  };

  // JSON parse
  const jsonFiles = ["handoff/reference-snapshot-2026-11-17.json", "handoff/vertical-slice-content-seed.json"];
  const parsed: Record<string, unknown> = {};
  for (const f of jsonFiles) {
    try {
      parsed[f] = JSON.parse(read(root, `${PLAN}/${f}`));
      push(`json:${f}`, true, "parses");
    } catch (err) {
      push(`json:${f}`, false, String(err));
    }
  }

  // Whitelist
  let whitelist: AssetWhitelist | null = null;
  try {
    whitelist = AssetWhitelist.fromCsv(read(root, `${PLAN}/handoff/fan-local-asset-whitelist.csv`));
    push("whitelist:rows", whitelist.size === 288, `${whitelist.size} unique asset_id rows (expected 288, canonical v4 = v3 282 + 6 official WAVs)`);
    const issues = checkWhitelistRoundTrips(whitelist);
    const grfRows = whitelist.rows().filter((r) => r.raw_name_hex !== "").length;
    push("whitelist:cp949-hex-roundtrip", grfRows === 285 && !issues.some((i) => i.check === "cp949-hex"), `${grfRows} GRF rows (expected 285 + 1 filesystem BGM + 2 filesystem System fonts); issues=${JSON.stringify(issues.filter((i) => i.check === "cp949-hex"))}`);
    push("whitelist:uri-roundtrip", !issues.some((i) => i.check === "request-uri"), `${whitelist.size} rows; issues=${JSON.stringify(issues.filter((i) => i.check === "request-uri"))}`);
    const core = whitelist.rows().filter((r) => r.category === "map_world" || r.category === "map_ground" || r.category === "map_collision");
    push("whitelist:map-hashes", core.length === 3 && core.every((m) => m.sha256.length === 64), `${core.length} core map rows carry SHA-256`);
    const closure = whitelist.rows().filter((r) => r.category.startsWith("map_") && !core.includes(r));
    push("whitelist:closure-hashes", closure.length === 124 && closure.every((m) => m.sha256.length === 64), `${closure.length} map closure rows (21 GND + 23 RSM + 44 RSM textures + 32 water + 4 WAV) carry SHA-256`);
    const ui = whitelist.rows().filter((r) => r.category.startsWith("ui_"));
    const uiOk = ui.length === 108 && ui.every((r) => r.required === "true" && r.sha256.length === 64 && r.notes.startsWith("profile=KRO2021_CLASSIC_V0_FAN;"));
    const fsSystem = whitelist.rows().filter((r) => r.source_container === "filesystem:System").map((r) => r.asset_id);
    push("whitelist:ui-closure", uiOk && fsSystem.join(",") === "ui.font.scdream4,ui.font.scdream6", `${ui.length} RO UI rows (profile KRO2021_CLASSIC_V0_FAN, required, SHA-256); filesystem:System=${fsSystem.join(",")}`);
  } catch (err) {
    push("whitelist:parse", false, String(err));
  }

  // Content seed counts and references
  const seed = parsed["handoff/vertical-slice-content-seed.json"] as
    | {
        skills: unknown[];
        passives: unknown[];
        keystones: unknown[];
        monsters: { runtimeId: string; role: string; assetRef: string }[];
        stage: { timeline: { pool?: string[]; entity?: string }[]; sourceMap: { assetRefs: string[] }; bgm: { assetRef: string } };
      }
    | undefined;
  if (seed) {
    const roles = (r: string): number => seed.monsters.filter((m) => m.role === r || m.role.startsWith(`${r}-`)).length;
    const ok =
      seed.skills.length === 8 && seed.passives.length === 4 && seed.keystones.length === 3 &&
      roles("normal") === 10 && roles("elite") === 2 && roles("miniboss") === 1 && roles("mvp") === 1;
    push("seed:counts", ok, `skills=${seed.skills.length} passives=${seed.passives.length} keystones=${seed.keystones.length} normal=${roles("normal")} elite=${roles("elite")} miniboss=${roles("miniboss")} mvp=${roles("mvp")}`);
    const ids = new Set(seed.monsters.map((m) => m.runtimeId));
    const refs = seed.stage.timeline.flatMap((t) => [...(t.pool ?? []), ...(t.entity ? [t.entity] : [])]);
    const missing = refs.filter((r) => !ids.has(r));
    push("seed:timeline-refs", missing.length === 0, `${refs.length} references; missing=${JSON.stringify(missing)}`);
    if (whitelist) {
      const wl = whitelist;
      const assetRefs = [...seed.monsters.map((m) => m.assetRef), ...seed.stage.sourceMap.assetRefs, seed.stage.bgm.assetRef];
      const unresolved = assetRefs.filter((r) => !wl.has(r) && !(wl.has(`${r}.spr`) && wl.has(`${r}.act`)));
      push("seed:asset-refs-in-whitelist", unresolved.length === 0, `${assetRefs.length} refs; unresolved=${JSON.stringify(unresolved)}`);
    }
  }

  // Reference ledger + public client fingerprints
  const ledger = parseCsvRecords(read(root, `${PLAN}/reference-ledger.csv`)).records;
  const ledgerIds = new Set(ledger.map((r) => r.observation_id));
  push("ledger:rows", ledger.length === 20 && ledgerIds.size === 20, `${ledger.length} rows, ${ledgerIds.size} unique ids`);
  const pub = parseCsvRecords(read(root, `${PLAN}/handoff/public-client-artifacts.csv`)).records;
  push(
    "public-client:fingerprints",
    pub.length === 8 && pub.every((r) => /^[0-9A-F]{64}$/u.test(r.sha256 ?? "") && r.retained_in_project === "false"),
    `${pub.length} rows; all uppercase SHA-256 and retained_in_project=false`,
  );

  // Markdown fences
  const mdFiles = [
    "00-START-HERE.md", "01-RESEARCH-AND-GAME-DESIGN.md", "02-ASSET-AND-RIGHTS-PLAN.md", "03-TECHNICAL-ARCHITECTURE.md",
    "04-CONSTRUCTION-PLAN.md", "05-QA-AND-RELEASE.md", "06-CLAUDE-COMMANDS.md", "07-REFERENCE-LEDGER.md",
    "08-PUBLIC-CODE-OBSERVATIONS.md", "09-GITHUB-CLOUD-WORKFLOW.md", "SOURCES.md",
    "handoff/README.md", "handoff/ASSET-AUDIT.md", "handoff/VALIDATION.md",
  ];
  const unbalanced = mdFiles.filter((f) => (read(root, `${PLAN}/${f}`).match(/^```/gmu)?.length ?? 0) % 2 !== 0);
  push("markdown:fences", unbalanced.length === 0, `${mdFiles.length} files; unbalanced=${JSON.stringify(unbalanced)}`);

  // Delivered hashes from VALIDATION.md vs the working-tree bytes AND the Git blob bytes
  // (index), so line-ending conversion can never hide a mismatch.
  const validation = read(root, `${PLAN}/handoff/VALIDATION.md`);
  const rows = [...validation.matchAll(/^\| `([^`]+)` \| `([0-9A-F]{64})` \|$/gmu)];
  push("delivered-hash:table", rows.length === 4, `${rows.length} hash rows found in VALIDATION.md (expected 4)`);
  for (const m of rows) {
    const name = m[1] as string;
    const expected = m[2] as string;
    const rel = name.startsWith("../") ? `${PLAN}/${name.slice(3)}` : `${PLAN}/handoff/${name}`;
    const worktree = sha256Text(readFileSync(join(root, rel)));
    checks.push({
      id: `delivered-hash:worktree:${name}`,
      status: worktree === expected ? "PASS" : "DRIFT",
      detail: `VALIDATION.md=${expected} worktree=${worktree}`,
    });
    let blob: string;
    try {
      blob = sha256Text(execFileSync("git", ["-C", root, "cat-file", "blob", `:${rel}`], { stdio: ["ignore", "pipe", "pipe"] }));
    } catch (err) {
      checks.push({ id: `delivered-hash:blob:${name}`, status: "FAIL", detail: `cannot read Git index blob: ${String(err).split("\n")[0] ?? ""}` });
      continue;
    }
    checks.push({
      id: `delivered-hash:blob:${name}`,
      status: blob === expected ? "PASS" : "DRIFT",
      detail: `VALIDATION.md=${expected} git-blob=${blob}`,
    });
  }
  return checks;
}

/** Fail closed: anything other than PASS (FAIL or DRIFT) makes the command exit 1. */
export function exitCodeFor(checks: readonly HandoffCheck[]): 0 | 1 {
  return checks.length > 0 && checks.every((c) => c.status === "PASS") ? 0 : 1;
}
