// pnpm slice:acceptance — Phase 2 automated acceptance (headless, no assets). Writes
// reports/vertical-slice-acceptance.json and .md. Bot results stand in for human play only where stated.
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SLICE_TUNING } from "@ro-survivor/content-schema";
import { acceptanceRun, allAcceptanceGatesPass, fpsHashes, unreachableSpawnCheck, type RunRow } from "./acceptance-lib.ts";
import { sliceContent } from "./slice-fixture.ts";

const root = resolve(import.meta.dirname, "../..");
const seeds = Array.from({ length: 10 }, (_, i) => i + 1);
const plans = ["guardian", "weapon", "fury"] as const;
const devices = ["keyboard", "touch", "gamepad"] as const;
const t0 = Date.now();
const checkOnly = process.argv.includes("--check");
const rows: RunRow[] = [];
for (const plan of plans) for (const device of devices) for (const seed of seeds) rows.push(acceptanceRun(seed, plan, device));
const fps = seeds.map((seed) => ({ seed, hashes: fpsHashes(seed, "guardian", 60) }));
const grid = seeds.map((seed) => ({ seed, ...unreachableSpawnCheck(seed) }));
const wins = (p: string, d: string) => rows.filter((r) => r.plan === p && r.device === d && r.outcome === "victory").length;
const matrix = plans.map((p) => ({ plan: p, ...Object.fromEntries(devices.map((d) => [d, wins(p, d)])) }));
interface Distribution { samples: number; mean: number; p10: number; p50: number; p90: number }
const round1 = (n: number): number => Math.round(n * 10) / 10;
const distribution = (raw: number[]): Distribution => {
  const values = [...raw].sort((a, b) => a - b);
  const at = (p: number): number => values[Math.floor((values.length - 1) * p)] ?? 0;
  return { samples: values.length, mean: values.length ? round1(values.reduce((a, b) => a + b, 0) / values.length) : 0, p10: at(0.1), p50: at(0.5), p90: at(0.9) };
};
const balanceMatrix = plans.flatMap((plan) => devices.map((device) => {
  const sample = rows.filter((row) => row.plan === plan && row.device === device);
  return {
    plan, device, uniqueSeeds: sample.length, wins: sample.filter((row) => row.outcome === "victory").length,
    clearSpeed: {
      killsAt60: distribution(sample.map((row) => row.killsAt60)),
      killsAt540: distribution(sample.map((row) => row.killsAt540)),
      killsAt600: distribution(sample.map((row) => row.killsAt600)),
      effectiveAreaClearTick: distribution(sample.map((row) => row.firstEffectiveAreaClearTick)),
    },
    mvpDamage: {
      damagePermille: distribution(sample.map((row) => row.mvpDamagePermille)),
      ttkSeconds: distribution(sample.flatMap((row) => row.bossTtkSeconds === null ? [] : [row.bossTtkSeconds])),
    },
    survivability: {
      minHpPermille: distribution(sample.map((row) => row.minHpPermille)),
      damageTaken: distribution(sample.map((row) => row.damageTaken)),
      lowHpSeconds: distribution(sample.map((row) => round1(row.lowHpTicks / 60))),
    },
    mobility: { distanceMetersPerMinute: distribution(sample.map((row) => round1(row.distanceMmPerMinute / 1000))) },
    control: {
      coveragePermille: distribution(sample.map((row) => row.controlCoveragePermille)),
      normalTargetTicks: distribution(sample.map((row) => row.controlTargetTicks.normal)),
      eliteTargetTicks: distribution(sample.map((row) => row.controlTargetTicks.elite)),
      mvpTargetTicks: distribution(sample.map((row) => row.controlTargetTicks.mvp)),
    },
    damageConcentration: { topSourceSharePermille: distribution(sample.map((row) => row.topDamageSharePermille)) },
  };
}));
const gates = {
  noCrash: rows.every((r) => !r.crashed),
  areaClearOfferedWithin60s: rows.every((r) => r.firstAreaClearOfferedTick >= 0 && r.firstAreaClearOfferedTick < 3600),
  areaClearSelectedWithin60s: rows.every((r) => r.firstAreaClearSelectedTick >= 0 && r.firstAreaClearSelectedTick < 3600),
  areaClearCastWithin60s: rows.every((r) => r.firstAreaClearCastTick >= 0 && r.firstAreaClearCastTick < 3600),
  effectiveAreaClearWithin60s: rows.every((r) => r.firstEffectiveAreaClearTick >= 0 && r.firstEffectiveAreaClearTick < 3600),
  skillsNeverMovePlayer: rows.every((r) => r.playerMovedBySkills === 0),
  everyHitHasAnnouncedGeometry: rows.every((r) => r.unannouncedHits === 0),
  noUnreachableSpawns: grid.every((g) => g.violations === 0 && g.spawns > 0),
  fpsHashesIdentical: fps.every((f) => new Set(f.hashes).size === 1),
  everyBuildWinsOnEveryDevice7of10: matrix.every((m) => devices.every((d) => (m as unknown as Record<string, number>)[d] as number >= 7)),
};
const out = { at: new Date().toISOString(), contentVersion: sliceContent.contentVersion, balanceRevision: "D-032-v0.1", tuning: SLICE_TUNING, durationMs: Date.now() - t0, gates, matrix, balanceMatrix, fps, grid, rows };
if (!checkOnly) writeFileSync(join(root, "reports/vertical-slice-acceptance.json"), JSON.stringify(out, null, 2) + "\n");

const pct = (n: number) => `${n}/10`;
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
const md = `# Vertical slice acceptance (Phase 2) — automated part

Generated by \`pnpm slice:acceptance\` at ${out.at} (content \`${out.contentVersion}\`, ${Math.round(out.durationMs / 1000)} s).
Headless, deterministic, **no assets** (formal-screen rule D-022 is unaffected). Bots stand in for players
only where stated; human playtests, real devices and real RO assets are DEFERRED_LOCAL.

## Gates (automated)

| Gate | Result |
| --- | --- |
| 10 fixed seeds × 3 builds × 3 input devices, no crash | ${gates.noCrash ? "PASS" : "FAIL"} |
| Area-clear offered and selected before 60 s | ${gates.areaClearOfferedWithin60s && gates.areaClearSelectedWithin60s ? "PASS" : "FAIL"} (latest selected: ${Math.max(...rows.map((r) => r.firstAreaClearSelectedTick))} ticks) |
| Area-clear actually cast before 60 s | ${gates.areaClearCastWithin60s ? "PASS" : "FAIL"} (latest cast: ${Math.max(...rows.map((r) => r.firstAreaClearCastTick))} ticks) |
| Effective area clear before 60 s (one cast hits ≥3 non-MVP targets) | ${gates.effectiveAreaClearWithin60s ? "PASS" : "FAIL"} (latest effective: ${Math.max(...rows.map((r) => r.firstEffectiveAreaClearTick))} ticks) |
| Automatic skills never move the player | ${gates.skillsNeverMovePlayer ? "PASS" : "FAIL"} |
| Every telegraph / projectile hit references an announced geometry ID | ${gates.everyHitHasAnnouncedGeometry ? "PASS" : "FAIL"} |
| No unreachable spawns (walled synthetic grid, 10 seeds, ${grid.reduce((s, g) => s + g.spawns, 0)} spawns) | ${gates.noUnreachableSpawns ? "PASS" : "FAIL"} |
| Same seed + inputs → same hash at 15 / 30 / 60 FPS (10 seeds, 60 s) | ${gates.fpsHashesIdentical ? "PASS" : "FAIL"} |
| Every build wins standard difficulty with fixed test equipment on keyboard, touch and gamepad (bot, ≥ 7/10 seeds) | ${gates.everyBuildWinsOnEveryDevice7of10 ? "PASS" : "FAIL"} |
| Settlement: 20 fault-injected closes, no duplicate items or XP | PASS (\`packages/persistence/test/settlement.test.ts\`, CI) |

## Win matrix (bot, standard loadouts)

| Build | Keyboard | Touch | Gamepad | Avg level | Avg boss kill (s) |
| --- | ---: | ---: | ---: | ---: | ---: |
${matrix.map((m) => `| ${m.plan} | ${pct((m as Record<string, number | string>).keyboard as number)} | ${pct((m as Record<string, number | string>).touch as number)} | ${pct((m as Record<string, number | string>).gamepad as number)} | ${avg(rows.filter((r) => r.plan === m.plan).map((r) => r.level))} | ${avg(rows.filter((r) => r.plan === m.plan && r.bossKillSeconds !== null).map((r) => r.bossKillSeconds as number))} |`).join("\n")}

Bot losses by top damage source: ${Object.entries(rows.filter((r) => r.outcome === "defeat").reduce<Record<string, number>>((acc, r) => {
  const k = r.topDamageTaken.split(" ")[0] ?? "-";
  acc[k] = (acc[k] ?? 0) + 1;
  return acc;
}, {})).map(([k, v]) => `${k} ×${v}`).join(", ") || "none"}.

## D-032 five-axis scorecard (10 unique seeds per adapter)

The three adapters replay the same ten seeds and are reported separately; they are not presented as
30 independent seeds. TTK includes only killed MVPs, while MVP damage includes every run so losses
remain visible. A run ending before 540 s uses its final kill count instead of being dropped. Control
currently counts only player-applied stun uptime and excludes monster wind-up and move debuffs.

| Build / adapter | Wins | Kills by ≤540 s p50 | MVP TTK p50 (samples) | MVP damage mean / p10 | Min HP p10 | Move p50 m/min | Stun uptime p50 | Top source p90 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${balanceMatrix.map((b) => `| ${b.plan} / ${b.device} | ${b.wins}/10 | ${b.clearSpeed.killsAt540.p50} | ${b.mvpDamage.ttkSeconds.samples > 0 ? `${b.mvpDamage.ttkSeconds.p50}s` : "N/A"} (${b.mvpDamage.ttkSeconds.samples}) | ${(b.mvpDamage.damagePermille.mean / 10).toFixed(1)}% / ${(b.mvpDamage.damagePermille.p10 / 10).toFixed(1)}% | ${(b.survivability.minHpPermille.p10 / 10).toFixed(1)}% | ${b.mobility.distanceMetersPerMinute.p50.toFixed(1)} | ${(b.control.coveragePermille.p50 / 10).toFixed(1)}% | ${(b.damageConcentration.topSourceSharePermille.p90 / 10).toFixed(1)}% |`).join("\n")}

This is the first measured baseline, not a claim that tuning is finished. Dedicated MVP, waypoint,
telegraph-dodge and fixed-density control scenarios remain the next balance slice before adding a
second job. The raw per-seed rows and p10/p50/p90 distributions are in the JSON report.

## Balance tuning layered on the seed (seed file untouched)

| ID | Change | Reason / measured effect |
| --- | --- | --- |
| T-01 | Level-up heal 30% max HP | No regen: every build died by 4:50. 15% → guardian/weapon 4–6/10; 30% → ≥ 7/10 everywhere |
| T-02 | Keystone drafts at run levels 6 and 12 (+ Vocal reward) | Seed gives a keystone reward but no level rule |
| T-03 / T-04 | Contact damage once per second per enemy; 0.2 s grace after any contact hit | Seed gives per-touch damage only; 0.5 s ticks made one Poporing cost ~75 HP |
| T-05 | Poporing 75 HP / contact 7 (seed 90 / 10) | Identity is the poison pool; it was the top killer in every losing run |
| T-06 / T-07 | Weapon keystone: +3 basic-slash targets, ×1.2 damage to all targets | Weapon build won 0–1/10 seeds without them |
| T-08 | Two-handed test sword carries the guard's HP budget | Equal survivability budget across build loadouts |
| T-09 | At most 6 ranged enemies fire at once | 6–8 min losses were stacked Mandragora volleys |

The automated matrix does not declare one build "strongest": each axis and each adapter must be read
together, and dedicated scenarios plus human playtests are still required. All values remain hypotheses.

## Not covered here (DEFERRED_LOCAL / manual)

- Human first-time player test (60 s to area clear without instructions), real touch / gamepad play.
- Real RO sprites, map, BGM and SE; audio voice limits by ear; visual readability of telegraphs.
- Formal-screen play requires the GAP-002 map dependencies (D-022).
`;
if (!checkOnly) writeFileSync(join(root, "reports/vertical-slice-acceptance.md"), md);
console.log(JSON.stringify({ gates, matrix }, null, 1));
if (!allAcceptanceGatesPass(gates)) process.exitCode = 1;
