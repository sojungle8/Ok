import { DIR16, TRIG_SCALE } from "../trig.ts";

/** 24 directions: DIR16 is too coarse to find a two-projectile gap reliably; interpolate pairs. */
const DIR24: readonly (readonly [number, number])[] = Array.from({ length: 24 }, (_, k) => {
  const a = DIR16[Math.floor((k * 16) / 24)] as readonly [number, number];
  const b = DIR16[(Math.floor((k * 16) / 24) + 1) % 16] as readonly [number, number];
  const f = (k * 16) % 24;
  const x = Math.trunc((a[0] * (24 - f) + b[0] * f) / 24);
  const y = Math.trunc((a[1] * (24 - f) + b[1] * f) / 24);
  const n = Math.sqrt(x * x + y * y) || 1;
  return [Math.trunc((x * TRIG_SCALE) / n), Math.trunc((y * TRIG_SCALE) / n)] as const;
});
import type { RunContent } from "./content.ts";
import type { DraftOption } from "./draft.ts";
import { hits } from "./geometry.ts";
import type { RunInput, RunState } from "./run.ts";

/**
 * Deterministic headless test player (acceptance bots, balance runs). It only produces a movement
 * intent and draft choices — the same InputCommand stream a human adapter would send.
 */
export type BuildPlan = "guardian" | "weapon" | "fury";

const PLAN: Record<BuildPlan, { keystone: string; actives: string[]; passives: string[] }> = {
  guardian: { keystone: "keystone.guardian", actives: ["skill.sw.shield_wave", "skill.sw.magnum_break", "skill.sw.endure", "skill.sw.bash", "skill.sw.provoke"], passives: ["passive.sw.hp_recovery", "passive.sw.sword_mastery", "passive.sw.moving_recovery", "skill.sw.auto_berserk"] },
  weapon: { keystone: "keystone.weapon", actives: ["skill.sw.magnum_break", "skill.sw.endure", "skill.sw.fatal_blow", "skill.sw.bash", "skill.sw.provoke"], passives: ["passive.sw.hp_recovery", "passive.sw.twohand_mastery", "passive.sw.moving_recovery", "passive.sw.sword_mastery"] },
  fury: { keystone: "keystone.fury", actives: ["skill.sw.magnum_break", "skill.sw.endure", "skill.sw.provoke", "skill.sw.bash", "skill.sw.fatal_blow"], passives: ["passive.sw.sword_mastery", "passive.sw.hp_recovery", "skill.sw.auto_berserk", "passive.sw.moving_recovery"] },
};

export function chooseDraft(plan: BuildPlan, options: readonly DraftOption[]): number {
  const p = PLAN[plan];
  const score = (o: DraftOption): number => {
    if (o.kind === "keystone") return o.id === p.keystone ? 1000 : 0;
    const ai = p.actives.indexOf(o.id);
    const pi = p.passives.indexOf(o.id);
    if (o.kind === "new-active") return ai >= 0 ? 500 - ai * 20 : 150;
    if (o.kind === "rank-active") return ai >= 0 ? 320 - ai * 15 : 100;
    if (o.kind === "new-passive") return pi >= 0 ? 400 - pi * 25 : 90;
    if (o.kind === "rank-passive") return pi >= 0 ? 260 - pi * 15 : 80;
    if (o.kind === "rank-basic") return 240;
    return 10;
  };
  let best = 0;
  options.forEach((o, i) => {
    if (score(o) > score(options[best] as DraftOption)) best = i;
  });
  return best;
}

/** Desired movement as a unit-ish vector in [-1000, 1000] (before any input adapter quantisation). */
export function botIntent(c: RunContent, st: RunState): { x: number; y: number } {
  const p = st.player;
  let vx = 0;
  let vy = 0;
  const pr = c.player.radiusMm;
  // 1. Leave any active damaging telegraph we stand in (strongest priority).
  for (const t of st.telegraphs) {
    if (t.damage === 0 || t.resolved) continue;
    if (!hits(t.placed, p.x, p.y, pr + 400)) continue;
    let ax = p.x - t.placed.ox;
    let ay = p.y - t.placed.oy;
    if (t.placed.shape.shape !== "circle") {
      // perpendicular escape from a cone / dash line
      const side = ax * -t.placed.dy + ay * t.placed.dx >= 0 ? 1 : -1;
      ax = -t.placed.dy * side;
      ay = t.placed.dx * side;
    }
    const d = Math.sqrt(ax * ax + ay * ay) || 1;
    vx += Math.trunc((ax * 4000) / d);
    vy += Math.trunc((ay * 4000) / d);
  }
  // 2. Projectiles: predict closest approach; sidestep only shots that will connect soon.
  for (const pj of st.projectiles) {
    const v2 = pj.vx * pj.vx + pj.vy * pj.vy;
    if (v2 === 0) continue;
    const rx = p.x - pj.x;
    const ry = p.y - pj.y;
    const wait = Math.max(0, pj.activeAt - st.runTick);
    const tClosest = (rx * pj.vx + ry * pj.vy) / v2 - wait;
    if (tClosest < -5 || tClosest > 50) continue;
    const t = Math.max(0, tClosest + wait);
    const cx = pj.x + pj.vx * t - p.x;
    const cy = pj.y + pj.vy * t - p.y;
    const miss = Math.sqrt(cx * cx + cy * cy);
    const danger = pj.radius + pr + 450;
    if (miss > danger) continue;
    const n = Math.sqrt(v2);
    let side = rx * -pj.vy + ry * pj.vx >= 0 ? 1 : -1;
    if (miss < 1) side = (pj.id & 1) === 0 ? 1 : -1;
    const w = Math.trunc(((danger - miss) * 3000) / danger) + 1500;
    vx += Math.trunc((-pj.vy * side * w) / n);
    vy += Math.trunc((pj.vx * side * w) / n);
  }
  // 2b. Boss bounce ring: move into the guaranteed safe gap during the warning.
  for (const t of st.telegraphs) {
    if (!t.attackId.startsWith("bounce-ring") || st.runTick >= t.hitTick) continue;
    const dirs = st.projectiles.filter((pj) => pj.ownerId === t.ownerId && pj.activeAt === t.hitTick).map((pj) => [pj.vx, pj.vy] as const);
    if (dirs.length === 0) continue;
    let gx = 0;
    let gy = 0;
    let best = -Infinity;
    for (let k = 0; k < 24; k += 1) {
      const ang = DIR24[k] as readonly [number, number];
      let minDot = Infinity;
      for (const [dx, dy] of dirs) {
        const n = Math.sqrt(dx * dx + dy * dy) || 1;
        minDot = Math.min(minDot, -((ang[0] * dx + ang[1] * dy) / n));
      }
      if (minDot > best) {
        best = minDot;
        gx = ang[0];
        gy = ang[1];
      }
    }
    const want = Math.max(3500, Math.sqrt((p.x - t.placed.ox) ** 2 + (p.y - t.placed.oy) ** 2));
    const tx = t.placed.ox + Math.trunc((gx * want) / TRIG_SCALE) - p.x;
    const ty = t.placed.oy + Math.trunc((gy * want) / TRIG_SCALE) - p.y;
    const td = Math.sqrt(tx * tx + ty * ty) || 1;
    vx += Math.trunc((tx * 5000) / td);
    vy += Math.trunc((ty * 5000) / td);
  }
  // 3. Pools.
  for (const pool of st.pools) {
    const dx = p.x - pool.x;
    const dy = p.y - pool.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    if (d < pool.radius + pr + 900) {
      vx += Math.trunc((dx * 2500) / d);
      vy += Math.trunc((dy * 2500) / d);
    }
  }
  // 4. Let the swarm reach sword range but never surround us: repel inside ~1.2 m, approach the
  //    nearest enemy when only a few are close, and boss engagement below.
  const boss = st.enemies.find((e) => e.id === st.bossId);
  let crowd = 0;
  let nearest: { dx: number; dy: number; d: number } | null = null;
  for (const e of st.enemies) {
    if (e.id === st.bossId) continue;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const keep = pr + e.radius + 650;
    if (d < 3000) crowd += 1;
    if (d < keep) {
      const w = Math.trunc(((keep - d) * 3000) / keep) + 300;
      vx += Math.trunc((dx * w) / d);
      vy += Math.trunc((dy * w) / d);
    }
    if (!nearest || d < nearest.d) nearest = { dx, dy, d };
  }
  if (!boss && nearest && crowd <= 3 && nearest.d > 2400 && nearest.d < 9000) {
    vx -= Math.trunc((nearest.dx * 800) / nearest.d);
    vy -= Math.trunc((nearest.dy * 800) / nearest.d);
  }
  // Hunt ranged attackers (they hold distance and would otherwise shoot forever).
  if (!boss && crowd <= 4) {
    let ranged: { dx: number; dy: number; d: number } | null = null;
    for (const e of st.enemies) {
      if (!c.monsters[e.type]?.projectile) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (d < 10_000 && (!ranged || d < ranged.d)) ranged = { dx, dy, d };
    }
    if (ranged && ranged.d > 1800) {
      vx += Math.trunc((ranged.dx * 1100) / ranged.d);
      vy += Math.trunc((ranged.dy * 1100) / ranged.d);
    }
  }
  if (crowd > 8 && nearest) {
    // overwhelmed: retreat from the local centroid
    vx += Math.trunc((nearest.dx * 1200) / nearest.d);
    vy += Math.trunc((nearest.dy * 1200) / nearest.d);
  }
  if (boss) {
    const dx = boss.x - p.x;
    const dy = boss.y - p.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const want = boss.radius + pr + 900;
    const hardened = st.runTick < boss.hardenUntil;
    if (hardened) {
      // circle toward the boss's rear arc (opposite its facing) for the safe melee window
      const rx = boss.x - Math.trunc((boss.fx * want) / TRIG_SCALE) - p.x;
      const ry = boss.y - Math.trunc((boss.fy * want) / TRIG_SCALE) - p.y;
      const rd = Math.sqrt(rx * rx + ry * ry) || 1;
      vx += Math.trunc((rx * 1600) / rd);
      vy += Math.trunc((ry * 1600) / rd);
    } else if (d > want + 600) {
      vx += Math.trunc((dx * 1200) / d);
      vy += Math.trunc((dy * 1200) / d);
    } else if (d < want - 300) {
      vx -= Math.trunc((dx * 1500) / d);
      vy -= Math.trunc((dy * 1500) / d);
    } else {
      vx += Math.trunc((-dy * 900) / d); // orbit
      vy += Math.trunc((dx * 900) / d);
    }
  }
  // 5. Collect nearby XP when not crowded; otherwise drift in a slow circle.
  if (crowd < 6) {
    let best: { x: number; y: number; d: number } | null = null;
    for (const o of st.orbs) {
      const d = Math.sqrt((o.x - p.x) ** 2 + (o.y - p.y) ** 2);
      if (d < 9000 && (!best || d < best.d)) best = { x: o.x, y: o.y, d };
    }
    if (best && best.d > 0) {
      vx += Math.trunc(((best.x - p.x) * 700) / best.d);
      vy += Math.trunc(((best.y - p.y) * 700) / best.d);
    }
  }
  if (vx === 0 && vy === 0) {
    const phase = Math.floor(st.runTick / 240) % 4;
    vx = [400, 0, -400, 0][phase] as number;
    vy = [0, 400, 0, -400][phase] as number;
  }
  const len = Math.sqrt(vx * vx + vy * vy);
  if (len < 120) return { x: 0, y: 0 };
  return { x: Math.trunc((vx * 1000) / len), y: Math.trunc((vy * 1000) / len) };
}

/** Full bot command for one step (draft handling + movement), before adapter quantisation. */
export function botCommand(c: RunContent, st: RunState, plan: BuildPlan, sequence: number, adapt: (x: number, y: number) => { moveX: number; moveY: number }): RunInput {
  const base = { tick: st.tick, sequence };
  if (st.phase === "draft" && st.draft) return { ...base, moveX: 0, moveY: 0, draftIndex: chooseDraft(plan, st.draft.options) };
  if (st.phase === "keystone-confirm") return { ...base, moveX: 0, moveY: 0, confirm: true };
  const intent = botIntent(c, st);
  return { ...base, ...adapt(intent.x, intent.y) };
}
