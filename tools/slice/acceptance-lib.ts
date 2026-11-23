import { FakeClock } from "@ro-survivor/testkit";
import { createRun, FixedStepClock, botCommand, isAreaClear, runHash, stepRun, type BalanceRole, type BuildPlan, type RunState } from "@ro-survivor/core-sim";
import { intentThroughDevice, type DeviceKind } from "@ro-survivor/input";
import { playJobRun, sliceConfig, sliceContent } from "./slice-fixture.ts";
import type { RunContent } from "@ro-survivor/core-sim";

export interface RunRow {
  plan: BuildPlan;
  device: DeviceKind;
  seed: number;
  outcome: string;
  crashed: string | null;
  timeSeconds: number;
  level: number;
  kills: number;
  firstAreaClearTick: number;
  firstAreaClearOfferedTick: number;
  firstAreaClearSelectedTick: number;
  firstAreaClearCastTick: number;
  firstEffectiveAreaClearTick: number;
  firstDraftTick: number;
  firstDraftHasAreaClear: boolean;
  killsAt60: number;
  killsAt180: number;
  killsAt540: number;
  killsAt600: number;
  bossKillSeconds: number | null;
  bossTtkSeconds: number | null;
  mvpDamagePermille: number;
  damageTaken: number;
  minHpPermille: number;
  lowHpTicks: number;
  distanceMmPerMinute: number;
  controlApplications: Record<BalanceRole, number>;
  controlTargetTicks: Record<BalanceRole, number>;
  enemyTargetTicks: Record<BalanceRole, number>;
  controlCoveragePermille: number;
  topDamageSource: string;
  topDamageSharePermille: number;
  maxEnemies: number;
  spawnsSkipped: number;
  unannouncedHits: number;
  playerMovedBySkills: number;
  keystone: string | null;
  topDamageTaken: string;
  /** Whole-map living simulation population. This is not an on-screen claim. */
  liveEnemyDensity: Record<DensityWindowId, DensityWindowStats>;
  /** Living simulation enemies within NEAR_PLAYER_RADIUS_MM of the player. */
  nearPlayerEnemyDensity: Record<DensityWindowId, DensityWindowStats>;
}

export const DENSITY_WINDOWS = {
  early0to60: { fromTick: 0, toTick: 60 * 60 },
  early60to120: { fromTick: 60 * 60, toTick: 120 * 60 },
  climax300to420: { fromTick: 300 * 60, toTick: 420 * 60 },
} as const;
export type DensityWindowId = keyof typeof DENSITY_WINDOWS;
export interface DensityWindowStats {
  samples: number;
  mean: number;
  p10: number;
  p50: number;
  p90: number;
  max: number;
}

/**
 * Fail-closed population-density contract for the real simulation (not renderer clones or decorative
 * sprites). The floor applies to every build / input / fixed-seed run, so a strong build cannot hide
 * a sparse schedule behind another build's backlog.
 */
export const LIVE_ENEMY_DENSITY_FLOORS: Readonly<Record<DensityWindowId, { mean: number; p50: number }>> = {
  early0to60: { mean: 6, p50: 6 },
  early60to120: { mean: 12, p50: 11 },
  climax300to420: { mean: 28, p50: 24 },
};

/**
 * Near-field proxy matching the run renderer's 11 m orthographic half-height. Aspect ratio, camera
 * tilt and terrain mean this is deliberately not described as an exact viewport/on-screen count.
 */
export const NEAR_PLAYER_RADIUS_MM = 11_000;
export const NEAR_PLAYER_DENSITY_FLOORS: Readonly<Record<DensityWindowId, { mean: number; p50: number }>> = {
  early0to60: { mean: 5, p50: 5 },
  early60to120: { mean: 7, p50: 7 },
  climax300to420: { mean: 17, p50: 15 },
};

const round1 = (n: number): number => Math.round(n * 10) / 10;

export function summarizeLiveEnemyDensity(raw: readonly number[]): DensityWindowStats {
  const values = [...raw].sort((a, b) => a - b);
  const at = (p: number): number => values[Math.floor((values.length - 1) * p)] ?? 0;
  return {
    samples: values.length,
    mean: values.length ? round1(values.reduce((sum, value) => sum + value, 0) / values.length) : 0,
    p10: at(0.1),
    p50: at(0.5),
    p90: at(0.9),
    max: values.at(-1) ?? 0,
  };
}

export function allAcceptanceGatesPass(gates: Readonly<Record<string, boolean>>): boolean {
  return Object.values(gates).every(Boolean);
}

/** Play one run through a device adapter and collect acceptance facts. Never throws. */
export function acceptanceRun(seed: number, plan: BuildPlan, device: DeviceKind, content: RunContent = sliceContent): RunRow {
  const announced = new Set<string>();
  let firstDraftTick = -1;
  let firstDraftHasAreaClear = false;
  let movedBySkills = 0;
  let last: { x: number; y: number; moved: boolean } | null = null;
  const killsAt: Record<60 | 180 | 540 | 600, number> = { 60: -1, 180: -1, 540: -1, 600: -1 };
  const densitySamples: Record<DensityWindowId, number[]> = {
    early0to60: [],
    early60to120: [],
    climax300to420: [],
  };
  const nearPlayerDensitySamples: Record<DensityWindowId, number[]> = {
    early0to60: [],
    early60to120: [],
    climax300to420: [],
  };
  let lastDensityTick = -1;
  let st: RunState | null = null;
  let crashed: string | null = null;
  try {
    st = playJobRun(content, seed, plan, (x, y) => intentThroughDevice(device, x, y), (s, input) => {
      for (const e of s.events) if ((e.type === "telegraph" || e.type === "projectile") && e.geomId) announced.add(e.geomId);
      if (s.phase === "draft" && firstDraftTick < 0 && s.draft) {
        firstDraftTick = s.runTick;
        firstDraftHasAreaClear = s.draft.options.some((o) => isAreaClear(content, o.id));
      }
      for (const second of [60, 180, 540, 600] as const) if (killsAt[second] < 0 && s.runTick >= second * 60) killsAt[second] = s.stats.kills;
      // Draft/boss pauses can repeat a runTick; sample each simulation tick once and count only
      // living simulation entities. This cannot be satisfied with renderer-only decoration.
      if (s.runTick !== lastDensityTick) {
        lastDensityTick = s.runTick;
        let living = 0;
        let nearPlayer = 0;
        const radius2 = NEAR_PLAYER_RADIUS_MM * NEAR_PLAYER_RADIUS_MM;
        for (const enemy of s.enemies) {
          if (enemy.hp <= 0) continue;
          living += 1;
          const dx = enemy.x - s.player.x;
          const dy = enemy.y - s.player.y;
          if (dx * dx + dy * dy <= radius2) nearPlayer += 1;
        }
        for (const [id, window] of Object.entries(DENSITY_WINDOWS) as [DensityWindowId, (typeof DENSITY_WINDOWS)[DensityWindowId]][]) {
          if (s.runTick >= window.fromTick && s.runTick < window.toTick) {
            densitySamples[id].push(living);
            nearPlayerDensitySamples[id].push(nearPlayer);
          }
        }
      }
      // With zero movement input the player position must not change (skills never move the player).
      if (last && input.moveX === 0 && input.moveY === 0 && (s.player.x !== last.x || s.player.y !== last.y)) movedBySkills += 1;
      last = { x: s.player.x, y: s.player.y, moved: false };
    });
  } catch (err) {
    crashed = err instanceof Error ? err.message : String(err);
  }
  const s = st;
  const taken = s ? Object.entries(s.stats.effectiveDamageTakenBySource).sort((a, b) => b[1] - a[1])[0] : undefined;
  const zeroRoles = (): Record<BalanceRole, number> => ({ normal: 0, elite: 0, mvp: 0 });
  const roleSum = (x: Record<BalanceRole, number>): number => x.normal + x.elite + x.mvp;
  const damage = s ? Object.entries(s.stats.effectiveDamageBySource).sort((a, b) => b[1] - a[1]) : [];
  const totalDamage = damage.reduce((sum, [, value]) => sum + value, 0);
  if (s) for (const second of [60, 180, 540, 600] as const) if (killsAt[second] < 0) killsAt[second] = s.stats.kills;
  return {
    plan, device, seed,
    outcome: s?.phase ?? "crash",
    crashed,
    timeSeconds: s ? Math.round(s.runTick / 60) : 0,
    level: s?.player.level ?? 0,
    kills: s?.stats.kills ?? 0,
    firstAreaClearTick: s?.stats.firstAreaClearTick ?? -1,
    firstAreaClearOfferedTick: s?.stats.firstAreaClearOfferedTick ?? -1,
    firstAreaClearSelectedTick: s?.stats.firstAreaClearSelectedTick ?? -1,
    firstAreaClearCastTick: s?.stats.firstAreaClearCastTick ?? -1,
    firstEffectiveAreaClearTick: s?.stats.firstEffectiveAreaClearTick ?? -1,
    firstDraftTick,
    firstDraftHasAreaClear,
    killsAt60: killsAt[60] < 0 ? 0 : killsAt[60],
    killsAt180: killsAt[180] < 0 ? 0 : killsAt[180],
    killsAt540: killsAt[540] < 0 ? 0 : killsAt[540],
    killsAt600: killsAt[600] < 0 ? 0 : killsAt[600],
    bossKillSeconds: s && s.stats.bossKillTick >= 0 ? Math.round(s.stats.bossKillTick / 60) : null,
    bossTtkSeconds: s && s.stats.bossKillTick >= 0 && s.stats.bossSpawnTick >= 0 ? Math.round((s.stats.bossKillTick - s.stats.bossSpawnTick) / 60) : null,
    mvpDamagePermille: s && s.stats.bossMaxHp > 0 ? Math.min(1000, Math.round((s.stats.damageToMvp * 1000) / s.stats.bossMaxHp)) : 0,
    damageTaken: s ? Object.values(s.stats.effectiveDamageTakenBySource).reduce((sum, value) => sum + value, 0) : 0,
    minHpPermille: s?.stats.minHpPermille ?? 0,
    lowHpTicks: s?.stats.lowHpTicks ?? 0,
    distanceMmPerMinute: s && s.runTick > 0 ? Math.round((s.stats.distanceTravelledMm * 3600) / s.runTick) : 0,
    controlApplications: s ? { ...s.stats.playerControlApplications } : zeroRoles(),
    controlTargetTicks: s ? { ...s.stats.playerControlTargetTicks } : zeroRoles(),
    enemyTargetTicks: s ? { ...s.stats.enemyTargetTicks } : zeroRoles(),
    controlCoveragePermille: s && roleSum(s.stats.enemyTargetTicks) > 0 ? Math.round((roleSum(s.stats.playerControlTargetTicks) * 1000) / roleSum(s.stats.enemyTargetTicks)) : 0,
    topDamageSource: damage[0]?.[0] ?? "-",
    topDamageSharePermille: totalDamage > 0 ? Math.round(((damage[0]?.[1] ?? 0) * 1000) / totalDamage) : 0,
    maxEnemies: s?.stats.maxEnemies ?? 0,
    spawnsSkipped: s?.stats.spawnsSkipped ?? 0,
    unannouncedHits: s ? s.stats.telegraphHits.filter((h) => !announced.has(h.geomId)).length : 0,
    playerMovedBySkills: movedBySkills,
    keystone: s?.player.keystone ?? null,
    topDamageTaken: taken ? `${taken[0]} ${Math.round(taken[1] / 100)}` : "-",
    liveEnemyDensity: Object.fromEntries(Object.entries(densitySamples).map(([id, values]) => [id, summarizeLiveEnemyDensity(values)])) as Record<DensityWindowId, DensityWindowStats>,
    nearPlayerEnemyDensity: Object.fromEntries(Object.entries(nearPlayerDensitySamples).map(([id, values]) => [id, summarizeLiveEnemyDensity(values)])) as Record<DensityWindowId, DensityWindowStats>,
  };
}

/** Same seed + bot at 15/30/60 render FPS for `seconds`: returns the three hashes. */
export function fpsHashes(seed: number, plan: BuildPlan, seconds: number): string[] {
  return [15, 30, 60].map((fps) => {
    const cfg = sliceConfig(seed, plan);
    const st = createRun(cfg);
    const clock = new FixedStepClock(5);
    let seq = 0;
    for (const frame of FakeClock.frameMicros(fps, seconds)) {
      for (let n = clock.advance(frame); n > 0; n -= 1) stepRun(st, cfg, botCommand(sliceContent, st, plan, seq++, (x, y) => ({ moveX: x, moveY: y })));
    }
    return runHash(st);
  });
}

/**
 * Walled synthetic grid (outer wall, an inner wall line and an enclosed unreachable pocket) to prove
 * spawns only land on cells reachable from the start. Returns the number of spawns checked and violations.
 */
export function unreachableSpawnCheck(seed: number): { spawns: number; violations: number; outcome: string } {
  const W = 120;
  const walk = new Uint8Array(W * W).fill(1);
  for (let i = 0; i < W; i += 1) {
    walk[i] = 0;
    walk[(W - 1) * W + i] = 0;
    walk[i * W] = 0;
    walk[i * W + W - 1] = 0;
  }
  for (let x = 20; x < 100; x += 1) walk[30 * W + x] = 0;
  // enclosed pocket: walkable inside, walled ring -> not reachable
  for (let y = 85; y < 105; y += 1) for (let x = 85; x < 105; x += 1) walk[y * W + x] = y === 85 || y === 104 || x === 85 || x === 104 ? 0 : 1;
  // reachable mask by flood fill from the start cell (60, 60)
  const reach = new Uint8Array(W * W);
  const q = [60 * W + 60];
  reach[60 * W + 60] = 1;
  while (q.length) {
    const i = q.pop() as number;
    for (const j of [i - 1, i + 1, i - W, i + W]) if (j >= 0 && j < W * W && walk[j] === 1 && reach[j] === 0) {
      reach[j] = 1;
      q.push(j);
    }
  }
  const grid = { width: W, height: W, cellMm: 1000, reachable: reach };
  const cfg = sliceConfig(seed, "fury", { grid, start: { x: 60_500, y: 60_500 } });
  const st = createRun(cfg);
  let spawns = 0;
  let violations = 0;
  let seq = 0;
  while (st.phase !== "victory" && st.phase !== "defeat" && st.tick < 60 * 60 * 14) {
    stepRun(st, cfg, botCommand(sliceContent, st, "fury", seq++, (x, y) => ({ moveX: x, moveY: y })));
    for (const e of st.events) {
      if (e.type !== "spawn" && e.type !== "boss-spawn") continue;
      const en = st.enemies.find((x) => x.id === e.targetId);
      if (!en) continue;
      spawns += 1;
      const cx = Math.floor(en.x / 1000);
      const cy = Math.floor(en.y / 1000);
      if (reach[cy * W + cx] !== 1) violations += 1;
    }
  }
  return { spawns, violations, outcome: st.phase };
}
