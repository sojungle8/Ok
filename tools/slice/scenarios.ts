// pnpm slice:scenarios — D-032 dedicated five-scenario Swordsman balance report (headless, no assets).
// Writes reports/phase2/d032-five-scenarios.json and .md; `--check` recomputes everything, fails on any
// gate, and fails when the committed report is stale (different deterministic digest).
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  axisValue, MOBILITY_WAYPOINTS_MM, SCENARIO_LEVEL_BUDGET, SCENARIO_PLANS, SCENARIO_TICKS, SCENARIOS, scenarioRun,
  warmupKit, type ScenarioId, type ScenarioRow,
} from "./scenarios-lib.ts";
import { sliceContent } from "./slice-fixture.ts";

const root = resolve(import.meta.dirname, "../..");
const checkOnly = process.argv.includes("--check");
const SEEDS = Array.from({ length: 30 }, (_, i) => 101 + i);

const rows: ScenarioRow[] = [];
const kits = [];
for (const plan of SCENARIO_PLANS) {
  for (const seed of SEEDS) {
    const kit = warmupKit(seed, plan);
    kits.push(kit);
    for (const scenario of SCENARIOS) rows.push(scenarioRun(kit, scenario));
  }
}

interface Dist { samples: number; p10: number; p50: number; p90: number; mean: number }
const dist = (raw: number[]): Dist => {
  const v = [...raw].sort((a, b) => a - b);
  const at = (p: number): number => v[Math.floor((v.length - 1) * p)] ?? 0;
  return { samples: v.length, p10: at(0.1), p50: at(0.5), p90: at(0.9), mean: v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : 0 };
};
const AXIS_LABEL: Record<ScenarioId, string> = {
  clear: "clear speed (kills/min, 60 normals)",
  mvp: "MVP damage (‰ of MVP HP in 60 s)",
  survival: "survivability (min HP ‰ if alive, 50-mob ring)",
  mobility: "mobility (course speed index = 10000 / seconds)",
  control: "control (player-control coverage ‰)",
};
const axes = Object.fromEntries(SCENARIOS.map((scenario) => [scenario, Object.fromEntries(SCENARIO_PLANS.map((plan) => {
  const sample = rows.filter((r) => r.scenario === scenario && r.plan === plan);
  return [plan, {
    value: dist(sample.map(axisValue)),
    survivalRatePermille: Math.round((sample.filter((r) => r.survived).length * 1000) / sample.length),
    crashes: sample.filter((r) => r.crashed).length,
  }];
}))])) as Record<ScenarioId, Record<string, { value: Dist; survivalRatePermille: number; crashes: number }>>;

const p50 = (scenario: ScenarioId, plan: string): number => axes[scenario][plan]?.value.p50 ?? 0;
const best = (scenario: ScenarioId): number => Math.max(...SCENARIO_PLANS.map((plan) => p50(scenario, plan)));
const everyPlan = (test: (plan: string) => boolean): boolean => SCENARIO_PLANS.every(test);
const gates = {
  "no crash in any scenario run": rows.every((r) => r.crashed === null),
  "every build reaches the level budget in warm-up": kits.every((k) => k.reachedBudget),
  "clear: every build p50 >= 120 kills/min and >= 50% of the best build": everyPlan((p) => p50("clear", p) >= 120 && p50("clear", p) * 2 >= best("clear")),
  "mvp: every build p50 >= 300‰ in 60 s and >= 40% of the best build": everyPlan((p) => p50("mvp", p) >= 300 && p50("mvp", p) * 10 >= best("mvp") * 4),
  "survival: every build survives >= 90% of seeds": everyPlan((p) => (axes.survival[p]?.survivalRatePermille ?? 0) >= 900),
  "mobility: every run completes the waypoint course": rows.filter((r) => r.scenario === "mobility").every((r) => r.courseSeconds !== null),
};
/** Recorded, not gated: the current Swordsman kit has almost no player-applied control. */
const findings = [
  ...(everyPlan((p) => p50("control", p) < 50) ? ["control axis: every build p50 coverage < 50‰ (Bash stun is the only player control); tracked under R-18, not gated"] : []),
];
const digest = createHash("sha256").update(JSON.stringify(rows)).digest("hex").toUpperCase();
const report = {
  generator: "tools/slice/scenarios.ts",
  contentVersion: (sliceContent as { contentVersion?: string }).contentVersion ?? "unknown",
  seeds: SEEDS, plans: SCENARIO_PLANS, levelBudget: SCENARIO_LEVEL_BUDGET, scenarioTicks: SCENARIO_TICKS,
  mobilityWaypointsMm: MOBILITY_WAYPOINTS_MM, rowsSha256: digest, gates, findings, axes,
  kits: kits.map((k) => ({ plan: k.plan, seed: k.seed, level: k.level, warmupSeconds: Math.round(k.warmupTicks / 60), active: k.active, keystone: k.keystone })),
};
const jsonPath = join(root, "reports/phase2/d032-five-scenarios.json");
const mdPath = join(root, "reports/phase2/d032-five-scenarios.md");
let stale = false;
if (checkOnly) {
  try {
    stale = (JSON.parse(readFileSync(jsonPath, "utf8")) as { rowsSha256?: string }).rowsSha256 !== digest;
  } catch {
    stale = true;
  }
} else {
  writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n");
  const table = SCENARIOS.map((s) => `| ${AXIS_LABEL[s]} | ${SCENARIO_PLANS.map((p) => {
    const a = axes[s][p];
    return a ? `${a.value.p10} / **${a.value.p50}** / ${a.value.p90}` : "-";
  }).join(" | ")} |`).join("\n");
  const md = `# D-032 five-scenario Swordsman balance (automated)

Generated by \`pnpm slice:scenarios\` (headless, deterministic, **no assets**). Each build is played by the bot on the
real stage until level ${SCENARIO_LEVEL_BUDGET}, then its drafted kit enters five isolated, seeded scenarios with no
natural spawns. ${SEEDS.length} unique seeds (${SEEDS[0]}–${SEEDS.at(-1)}) per build; bot results are a baseline, not human play.

Rows digest: \`${digest}\` (\`pnpm slice:acceptance:check\` recomputes it and fails if this report is stale).

## Axes (p10 / **p50** / p90)

| Axis | ${SCENARIO_PLANS.join(" | ")} |
| --- | ${SCENARIO_PLANS.map(() => "---").join(" | ")} |
${table}

Survival rate (‰): ${SCENARIO_PLANS.map((p) => `${p} ${axes.survival[p]?.survivalRatePermille ?? 0}`).join(", ")}.

## Gates

| Gate | Result |
| --- | --- |
${Object.entries(gates).map(([k, v]) => `| ${k} | ${v ? "PASS" : "FAIL"} |`).join("\n")}

## Findings (recorded, not gated)

${findings.length ? findings.map((f) => `- ${f}`).join("\n") : "- none"}
`;
  writeFileSync(mdPath, md);
}
console.log(JSON.stringify({ gates, findings, rowsSha256: digest, stale }, null, 1));
if (!Object.values(gates).every(Boolean) || stale) process.exitCode = 1;
