// D-032 dedicated five-scenario balance harness (clear / MVP / survival / mobility / control).
// Every build is first played by the bot on the real stage until the same level budget, then its
// drafted kit is placed into fixed, seeded, isolated scenarios (empty timeline: no natural spawns).
// Results are deterministic per (seed, plan) and contain no RO asset.
import {
  botCommand, createRun, Rng, stepRun, TRIG_SCALE, type BuildPlan, type Enemy, type RunConfig, type RunContent,
  type RunState,
} from "@ro-survivor/core-sim";
import { jobConfig, sliceContent } from "./slice-fixture.ts";

export const SCENARIOS = ["clear", "mvp", "survival", "mobility", "control"] as const;
export type ScenarioId = (typeof SCENARIOS)[number];
export const SCENARIO_PLANS: readonly BuildPlan[] = ["guardian", "weapon", "fury"];
/** Equal level budget for every build before entering a scenario. */
export const SCENARIO_LEVEL_BUDGET = 10;
/** Warm-up cap: a build that cannot reach the budget by then enters with what it has. */
export const SCENARIO_WARMUP_MAX_TICKS = 6 * 60 * 60;
export const SCENARIO_TICKS: Readonly<Record<ScenarioId, number>> = {
  clear: 20 * 60, mvp: 60 * 60, survival: 30 * 60, mobility: 45 * 60, control: 20 * 60,
};
export const MOBILITY_WAYPOINTS_MM: readonly (readonly [number, number])[] = [[12_000, 0], [12_000, 12_000], [0, 12_000], [0, 0]];
const WAYPOINT_REACH_MM = 1_000;

export interface Kit {
  /** Compiled job content the kit was drafted with. */
  content: RunContent;
  plan: BuildPlan;
  seed: number;
  level: number;
  warmupTicks: number;
  reachedBudget: boolean;
  active: { id: string; rank: number }[];
  passive: { id: string; rank: number }[];
  keystone: string | null;
}

export interface ScenarioRow {
  scenario: ScenarioId;
  plan: BuildPlan;
  seed: number;
  level: number;
  crashed: string | null;
  survived: boolean;
  ticks: number;
  kills: number;
  effectiveDamage: number;
  mvpDamagePermille: number;
  mvpKillSeconds: number | null;
  minHpPermille: number;
  damageTakenPerSecond: number;
  waypointsReached: number;
  courseSeconds: number | null;
  controlCoveragePermille: number;
}

const rolesOf = (c: RunContent, test: (role: string) => boolean): string[] =>
  Object.entries(c.monsters).filter(([, m]) => test(m.role)).map(([id]) => id).sort();

/** Play the real stage with the bot until the level budget; return the drafted kit. */
export function warmupKit(seed: number, plan: BuildPlan, base: RunContent = sliceContent): Kit {
  const cfg = jobConfig(base, seed, plan);
  const st = createRun(cfg);
  let seq = 0;
  while (st.phase !== "victory" && st.phase !== "defeat" && st.runTick < SCENARIO_WARMUP_MAX_TICKS) {
    if (st.player.level >= SCENARIO_LEVEL_BUDGET && st.phase === "running") break;
    stepRun(st, cfg, botCommand(base, st, plan, seq++, (x, y) => ({ moveX: x, moveY: y })));
  }
  return {
    content: base, plan, seed, level: st.player.level, warmupTicks: st.runTick, reachedBudget: st.player.level >= SCENARIO_LEVEL_BUDGET,
    active: st.player.active.map((s) => ({ id: s.id, rank: s.rank })),
    passive: st.player.passive.map((s) => ({ id: s.id, rank: s.rank })),
    keystone: st.player.keystone,
  };
}

function makeEnemy(c: RunContent, st: RunState, type: string, x: number, y: number): Enemy {
  const def = c.monsters[type];
  if (!def) throw new Error(`unknown monster ${type}`);
  return {
    id: st.nextId++, type, x, y, hp: def.hp, maxHp: def.hp, radius: def.radiusMm, stunUntil: 0, playerControlUntil: 0,
    contactReadyAt: 0, armorDebuff: 0, moveDebuff: 1000, debuffUntil: 0, fx: 0, fy: -TRIG_SCALE,
    attackReadyAt: def.attacks.map((a) => st.runTick + Math.max(60, Math.trunc(a.cooldownTicks / 2))),
    dashUntil: 0, dashDx: 0, dashDy: 0, hardenUntil: 0, hardenUsed: 0,
    projectileReadyAt: st.runTick + (def.projectile?.cooldownTicks ?? 0), hopsLeft: 0,
  };
}

/** Seeded ring placement in integer millimetres (no Math.random). */
function ring(c: RunContent, st: RunState, rng: Rng, pool: readonly string[], count: number, minMm: number, maxMm: number): void {
  for (let i = 0; i < count; i += 1) {
    const angle = (rng.nextInt(3600) / 3600) * Math.PI * 2;
    const dist = rng.range(minMm, maxMm);
    const type = pool[rng.nextInt(pool.length)] as string;
    st.enemies.push(makeEnemy(c, st, type, st.player.x + Math.round(Math.cos(angle) * dist), st.player.y + Math.round(Math.sin(angle) * dist)));
  }
  st.stats.maxEnemies = Math.max(st.stats.maxEnemies, st.enemies.length);
}

export function scenarioContent(base: RunContent = sliceContent): RunContent {
  return { ...base, timeline: [] };
}

/** Isolated scenario state: fresh run, empty timeline, the warm-up kit at full HP. */
export function scenarioState(kit: Kit, scenario: ScenarioId): { st: RunState; cfg: RunConfig } {
  const content = scenarioContent(kit.content);
  const cfg: RunConfig = { ...jobConfig(kit.content, kit.seed, kit.plan), content, runSeed: kit.seed * 1000 + SCENARIOS.indexOf(scenario) };
  const st = createRun(cfg);
  st.enemies.splice(0);
  st.player.level = kit.level;
  st.player.active = kit.active.map((s) => ({ ...s, readyAt: 0 }));
  st.player.passive = kit.passive.map((s) => ({ ...s, readyAt: 0 }));
  st.player.keystone = kit.keystone;
  st.player.hp = st.player.maxHp;
  const rng = Rng.stream(kit.seed, `scenario:${scenario}`);
  const normals = rolesOf(content, (r) => r.startsWith("normal"));
  const elites = rolesOf(content, (r) => r === "elite");
  const mvp = rolesOf(content, (r) => r === "mvp");
  switch (scenario) {
    case "clear": ring(content, st, rng, normals, 60, 3_000, 10_000); break;
    case "mvp": ring(content, st, rng, mvp, 1, 5_000, 5_001); break;
    case "survival": ring(content, st, rng, normals, 48, 2_000, 6_000); ring(content, st, rng, elites, 2, 3_000, 6_000); break;
    case "mobility": ring(content, st, rng, normals, 25, 6_000, 12_000); break;
    case "control": ring(content, st, rng, normals, 40, 4_000, 8_000); break;
  }
  return { st, cfg };
}

/** Run one scenario for its fixed duration. Never throws. */
export function scenarioRun(kit: Kit, scenario: ScenarioId): ScenarioRow {
  const row: ScenarioRow = {
    scenario, plan: kit.plan, seed: kit.seed, level: kit.level, crashed: null, survived: false, ticks: 0, kills: 0,
    effectiveDamage: 0, mvpDamagePermille: 0, mvpKillSeconds: null, minHpPermille: 0, damageTakenPerSecond: 0,
    waypointsReached: 0, courseSeconds: null, controlCoveragePermille: 0,
  };
  try {
    const { st, cfg } = scenarioState(kit, scenario);
    const mvpHp = scenario === "mvp" ? st.enemies.reduce((sum, e) => sum + e.maxHp, 0) : 0;
    let waypoint = 0;
    let seq = 0;
    while (st.runTick < SCENARIO_TICKS[scenario] && st.phase !== "defeat") {
      let adapt = (x: number, y: number) => ({ moveX: x, moveY: y });
      if (scenario === "mobility" && waypoint < MOBILITY_WAYPOINTS_MM.length) {
        const [wx, wy] = MOBILITY_WAYPOINTS_MM[waypoint] as readonly [number, number];
        const dx = wx - st.player.x;
        const dy = wy - st.player.y;
        const len = Math.hypot(dx, dy);
        if (len <= WAYPOINT_REACH_MM) {
          waypoint += 1;
          if (waypoint === MOBILITY_WAYPOINTS_MM.length) row.courseSeconds = Math.round(st.runTick / 6) / 10;
        } else adapt = () => ({ moveX: Math.trunc((dx * 1000) / len), moveY: Math.trunc((dy * 1000) / len) });
      }
      stepRun(st, cfg, botCommand(cfg.content, st, kit.plan, seq++, adapt));
      if (scenario === "mvp" && row.mvpKillSeconds === null && !st.enemies.some((e) => e.hp > 0 && cfg.content.monsters[e.type]?.role === "mvp")) {
        row.mvpKillSeconds = Math.round(st.runTick / 6) / 10;
      }
      if (scenario === "clear" && st.enemies.every((e) => e.hp <= 0)) break;
    }
    const taken = Object.values(st.stats.effectiveDamageTakenBySource).reduce((a, b) => a + b, 0);
    const controlled = st.stats.playerControlTargetTicks.normal + st.stats.playerControlTargetTicks.elite + st.stats.playerControlTargetTicks.mvp;
    const targeted = st.stats.enemyTargetTicks.normal + st.stats.enemyTargetTicks.elite + st.stats.enemyTargetTicks.mvp;
    Object.assign(row, {
      survived: st.phase !== "defeat",
      ticks: st.runTick,
      kills: st.stats.kills,
      effectiveDamage: Object.values(st.stats.effectiveDamageBySource).reduce((a, b) => a + b, 0),
      mvpDamagePermille: mvpHp > 0 ? Math.min(1000, Math.round((st.stats.damageToMvp * 1000) / mvpHp)) : 0,
      minHpPermille: st.stats.minHpPermille,
      damageTakenPerSecond: st.runTick > 0 ? Math.round((taken * 60) / st.runTick) : 0,
      waypointsReached: waypoint,
      controlCoveragePermille: targeted > 0 ? Math.round((controlled * 1000) / targeted) : 0,
    });
  } catch (err) {
    row.crashed = err instanceof Error ? err.message : String(err);
  }
  return row;
}

/** The scalar each axis is judged on (higher is better, except damage taken). */
export function axisValue(row: ScenarioRow): number {
  switch (row.scenario) {
    case "clear": return row.ticks > 0 ? Math.round((row.kills * 3600) / row.ticks) : 0; // kills per minute
    case "mvp": return row.mvpDamagePermille;
    case "survival": return row.survived ? row.minHpPermille : 0;
    case "mobility": return row.courseSeconds === null ? 0 : Math.round(10_000 / row.courseSeconds); // course speed index
    case "control": return row.controlCoveragePermille;
  }
}
