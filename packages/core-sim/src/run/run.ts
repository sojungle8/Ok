import { Rng, type RngState } from "../prng.ts";
import { hashState, type HashValue } from "../hash.ts";
import { DIR12, DIR16, TRIG_SCALE } from "../trig.ts";
import type { InputCommand } from "../sim.ts";
import type { BossAttackDef, Geometry, MonsterDef, RunContent, SkillDef } from "./content.ts";
import { DEFENSE_IDS, generateDraft, isAreaClear, type BuildView, type DraftOption } from "./draft.ts";
import { hits, unitToward, type Placed } from "./geometry.ts";

/**
 * Single-player run simulation (Phase 2 vertical slice). Deterministic: integer state, seeded
 * RNG streams (spawn, draft, combat), fixed 60 Hz steps, no wall clock / DOM / renderer.
 * Automatic skills never move the player.
 */
export type RunPhase = "running" | "draft" | "keystone-confirm" | "boss-intro" | "victory" | "defeat";

export interface RunGrid {
  width: number;
  height: number;
  cellMm: number;
  /** 1 = walkable AND reachable from the start cell (precomputed flood fill). */
  reachable: Uint8Array;
}

export interface RunConfig {
  content: RunContent;
  runSeed: number;
  /** Equipped fixed test items (validated: known ids, one per slot except up to 2 accessories). */
  loadout?: string[];
  grid?: RunGrid | null;
  start?: { x: number; y: number };
}

export interface Enemy {
  id: number;
  type: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  stunUntil: number;
  /** Player-applied control only; monster wind-up also uses stunUntil. */
  playerControlUntil: number;
  contactReadyAt: number;
  armorDebuff: number;
  moveDebuff: number;
  debuffUntil: number;
  fx: number;
  fy: number;
  /** Next tick each attack (by index) may start. */
  attackReadyAt: number[];
  /** Charger dash state. */
  dashUntil: number;
  dashDx: number;
  dashDy: number;
  hardenUntil: number;
  hardenUsed: number;
  projectileReadyAt: number;
  hopsLeft: number;
}

export interface Telegraph {
  id: number;
  /** Shared geometry ID: the renderer draws and the simulation hits with this exact object. */
  geomId: string;
  ownerId: number;
  attackId: string;
  placed: Placed;
  startTick: number;
  hitTick: number;
  /** Hit test runs every tick in [hitTick, endTick] until it connects once. */
  endTick: number;
  damage: number;
  resolved: boolean;
}

export interface Projectile { id: number; ownerId: number; source: string; geomId: string; x: number; y: number; vx: number; vy: number; radius: number; damage: number; activeAt: number; until: number }
export interface Pool { id: number; source: string; x: number; y: number; radius: number; damagePerSecond: number; until: number; nextTick: number }
export interface Orb { id: number; x: number; y: number; value: number }

export interface SlotState { id: string; rank: number; readyAt: number }

export interface SkillFiredEvent {
  type: "skill";
  tick: number;
  source: string;
  geomId: string;
  origin: { xMm: number; yMm: number };
  direction: { x: number; y: number };
  geometry: Geometry | null;
  rank: number;
  vfxCue: string;
  designOrigin: SkillDef["designOrigin"];
}

export interface OtherRunEvent {
  type: "hit" | "player-hit" | "telegraph" | "projectile" | "kill" | "level-up" | "spawn" | "boss-spawn" | "enrage" | "boss-warning";
  tick: number;
  source?: string;
  geomId?: string;
  /** Actor that caused this event when the target itself is not an entity (for example player-hit). */
  actorId?: number;
  targetId?: number;
  amount?: number;
}
export type RunEvent = SkillFiredEvent | OtherRunEvent;

export type BalanceRole = "normal" | "elite" | "mvp";

export interface RunStats {
  kills: number;
  damageBySource: Record<string, number>;
  /** Effective damage, capped at each target's remaining HP, for balance telemetry. */
  effectiveDamageBySource: Record<string, number>;
  damageTakenBySource: Record<string, number>;
  /** Effective damage taken, capped at the player's remaining HP, for balance telemetry. */
  effectiveDamageTakenBySource: Record<string, number>;
  levelUps: number;
  bossSpawnTick: number;
  bossKillTick: number;
  bossType: string | null;
  bossMaxHp: number;
  spawnsSkipped: number;
  maxEnemies: number;
  /** Deprecated compatibility alias: the first area-clear selection tick. */
  firstAreaClearTick: number;
  firstAreaClearOfferedTick: number;
  firstAreaClearSelectedTick: number;
  firstAreaClearCastTick: number;
  firstEffectiveAreaClearTick: number;
  damageToMvp: number;
  mvpDamageBySource: Record<string, number>;
  distanceTravelledMm: number;
  minHpPermille: number;
  lowHpTicks: number;
  playerControlApplications: Record<BalanceRole, number>;
  playerControlTargetTicks: Record<BalanceRole, number>;
  enemyTargetTicks: Record<BalanceRole, number>;
  draftsOffered: number;
  telegraphHits: { geomId: string; attackId: string }[];
}

export interface RunState {
  tick: number;
  runTick: number;
  phase: RunPhase;
  phaseUntil: number;
  seed: number;
  rngSpawn: RngState;
  rngDraft: RngState;
  rngCombat: RngState;
  lastSequence: number;
  player: {
    x: number; y: number; hp: number; maxHp: number; fx: number; fy: number; moving: boolean;
    loadout: string[];
    level: number; xp: number; basicRank: number; basicReadyAt: number; basicHitAt: number; basicDx: number; basicDy: number;
    active: SlotState[]; passive: SlotState[]; keystone: string | null; tags: string[];
    castSlot: number; castEndAt: number; castDx: number; castDy: number;
    endureUntil: number; endureReduction: number; lastDamagedTick: number; healCarry: number; contactGraceUntil: number;
  };
  enemies: Enemy[];
  telegraphs: Telegraph[];
  projectiles: Projectile[];
  pools: Pool[];
  orbs: Orb[];
  nextId: number;
  firedEvents: boolean[];
  waveLastSpawn: number[];
  normalWavePermille: number;
  magnetPermille: number;
  bossId: number;
  enraged: boolean;
  draft: { options: DraftOption[]; source: "level" | "chest" | "keystone" } | null;
  pendingDrafts: ("level" | "chest" | "keystone")[];
  pendingKeystone: string | null;
  levelsSinceNewActive: number;
  levelsSinceDefense: number;
  stats: RunStats;
  events: RunEvent[];
}

const BASIC_WINDUP = 8;
const BOSS_INTRO_TICKS = 120;
const SPAWN_MIN_MM = 13_000;
const SPAWN_MAX_MM = 16_000;
export const RUN_MAX_ENEMIES = 420;
const ORB_PULL_MM = 260;
const emptyRoleCounts = (): Record<BalanceRole, number> => ({ normal: 0, elite: 0, mvp: 0 });
export const RUN_CHECKPOINT_SCHEMA_VERSION = 1;

function walkable(grid: RunGrid | null | undefined, x: number, y: number): boolean {
  if (!grid) return true;
  const cx = Math.floor(x / grid.cellMm);
  const cy = Math.floor(y / grid.cellMm);
  if (cx < 0 || cy < 0 || cx >= grid.width || cy >= grid.height) return false;
  return grid.reachable[cy * grid.width + cx] === 1;
}

const permille = (v: number, p: number): number => Math.trunc((v * p) / 1000);

export function createRun(cfg: RunConfig): RunState {
  const c = cfg.content;
  if (!Number.isInteger(cfg.runSeed) || cfg.runSeed < 0 || cfg.runSeed > 0xffffffff) throw new RangeError("runSeed must be a u32");
  const start = cfg.start ?? { x: 0, y: 0 };
  if (!walkable(cfg.grid, start.x, start.y)) throw new Error("run start is not walkable/reachable");
  const loadout = [...(cfg.loadout ?? [])].sort();
  const slots = new Map<string, number>();
  for (const id of loadout) {
    const item = c.items[id];
    if (!item) throw new Error(`unknown item ${id}`);
    slots.set(item.slot, (slots.get(item.slot) ?? 0) + 1);
    if ((slots.get(item.slot) ?? 0) > (item.slot === "accessory" ? 2 : 1)) throw new Error(`too many ${item.slot} items`);
  }
  const maxHp = c.player.maxHp + loadout.reduce((s, id) => s + (c.items[id]?.maxHp ?? 0), 0);
  // A two-handed test weapon replaces the shield (seed: two-hand mastery requires "two-handed-sword").
  const tags = loadout.includes("equip.test.two_hand") ? ["two-handed-sword"] : ["shield-equipped"];
  if (loadout.includes("equip.test.two_hand") && loadout.includes("equip.test.guard")) throw new Error("a two-handed weapon cannot be combined with a shield");
  return {
    tick: 0,
    runTick: 0,
    phase: "running",
    phaseUntil: 0,
    seed: cfg.runSeed,
    rngSpawn: Rng.stream(cfg.runSeed, "spawn").snapshot(),
    rngDraft: Rng.stream(cfg.runSeed, "draft").snapshot(),
    rngCombat: Rng.stream(cfg.runSeed, "combat").snapshot(),
    lastSequence: -1,
    player: {
      x: start.x, y: start.y, hp: maxHp, maxHp, fx: 0, fy: -TRIG_SCALE, moving: false, loadout,
      level: 1, xp: 0, basicRank: 1, basicReadyAt: 0, basicHitAt: -1, basicDx: 0, basicDy: -TRIG_SCALE,
      active: [], passive: [], keystone: null, tags,
      castSlot: -1, castEndAt: 0, castDx: 0, castDy: -TRIG_SCALE,
      endureUntil: 0, endureReduction: 0, lastDamagedTick: -1000, healCarry: 0, contactGraceUntil: 0,
    },
    enemies: [],
    telegraphs: [],
    projectiles: [],
    pools: [],
    orbs: [],
    nextId: 1,
    firedEvents: c.timeline.map(() => false),
    waveLastSpawn: c.timeline.map(() => -1),
    normalWavePermille: 1000,
    magnetPermille: 1000,
    bossId: 0,
    enraged: false,
    draft: null,
    pendingDrafts: [],
    pendingKeystone: null,
    levelsSinceNewActive: 0,
    levelsSinceDefense: 0,
    stats: {
      kills: 0, damageBySource: {}, effectiveDamageBySource: {}, damageTakenBySource: {}, effectiveDamageTakenBySource: {},
      levelUps: 0, bossSpawnTick: -1, bossKillTick: -1, bossType: null, bossMaxHp: 0, spawnsSkipped: 0, maxEnemies: 0,
      firstAreaClearTick: -1, draftsOffered: 0, telegraphHits: [],
      firstAreaClearOfferedTick: -1, firstAreaClearSelectedTick: -1, firstAreaClearCastTick: -1, firstEffectiveAreaClearTick: -1,
      damageToMvp: 0, mvpDamageBySource: {}, distanceTravelledMm: 0, minHpPermille: 1000, lowHpTicks: 0,
      playerControlApplications: emptyRoleCounts(), playerControlTargetTicks: emptyRoleCounts(), enemyTargetTicks: emptyRoleCounts(),
    },
    events: [],
  };
}

// ---------------------------------------------------------------- skill values per rank
export function skillValue(c: RunContent, s: SkillDef, rank: number, keystone: string | null) {
  const r = rank - 1;
  const k = keystone ? c.keystones[keystone]?.effects : undefined;
  let damage = s.damage + (s.perRank.damage ?? 0) * r;
  if (s.perRank.damageMultiplierPermille) damage = permille(s.damage, s.perRank.damageMultiplierPermille[r] ?? 1000);
  let hitLimit = s.perRank.hitLimit ? (s.perRank.hitLimit[r] ?? s.hitLimit) : s.hitLimit;
  if (s.perRank.rank3HitLimit && rank >= 3) hitLimit = s.perRank.rank3HitLimit;
  let cooldown = s.cooldownTicks + (s.perRank.cooldownTicks ?? 0) * r;
  const cast = Math.max(0, s.castTicks + (s.perRank.castTicks ?? 0) * r);
  const duration = s.durationTicks + (s.perRank.durationTicks ?? 0) * r;
  let geometry: Geometry | null = s.geometry;
  if (geometry?.shape === "circle") {
    let radius = geometry.radiusMm + (s.perRank.radiusMm ?? 0) * r;
    if (s.id === "skill.sw.magnum_break" && k?.magnumRadiusPermille) radius = permille(radius, k.magnumRadiusPermille);
    geometry = { shape: "circle", radiusMm: radius };
  } else if (geometry?.shape === "sector") {
    let range = geometry.rangeMm + (s.perRank.rangeMm ?? 0) * r;
    if (s.kind === "built-in" && k?.frontArcRangePermille) range = permille(range, k.frontArcRangePermille);
    geometry = { ...geometry, rangeMm: range };
  }
  if (s.id === "skill.sw.magnum_break" && k?.magnumCooldownPermille) cooldown = permille(cooldown, k.magnumCooldownPermille);
  if (s.id === "skill.sw.shield_wave" && k?.shieldWaveCooldownPermille) cooldown = permille(cooldown, k.shieldWaveCooldownPermille);
  const stunChance = s.stun ? Math.min(1000, s.stun.chancePermille + (s.perRank.stunChancePermille ?? 0) * r) : 0;
  const reduction = (s.effects.damageReductionPermille ?? 0) + (s.perRank.damageReductionPermille ?? 0) * r + (s.id === "skill.sw.endure" ? (k?.endureDamageReductionDeltaPermille ?? 0) : 0);
  const armorDelta = (s.effects.enemyArmorDeltaPermille ?? 0) + (s.perRank.enemyArmorDeltaPermille ?? 0) * r;
  return { damage, hitLimit, cooldown: Math.max(6, cooldown), cast, duration, geometry, stunChance, reduction, armorDelta };
}

function passiveRank(st: RunState, id: string): number {
  return st.player.passive.find((p) => p.id === id)?.rank ?? 0;
}

function itemSum(c: RunContent, st: RunState, k: "damagePermille" | "maxHp" | "armorPermille" | "movePermille" | "regenPerSecond" | "pickupPermille"): number {
  return st.player.loadout.reduce((s, id) => s + (c.items[id]?.[k] ?? 0), 0);
}

function playerDamageMultiplier(c: RunContent, st: RunState, target: Enemy | null): number {
  let m = 1000 + itemSum(c, st, "damagePermille");
  for (const p of st.player.passive) {
    const d = c.passives[p.id];
    if (d?.perRank.physicalDamagePermille) m += d.perRank.physicalDamagePermille * p.rank;
    if (d?.lowHp && st.player.hp * 1000 <= st.player.maxHp * d.lowHp.thresholdPermille) m = permille(m, d.lowHp.damagePermille);
  }
  const k = st.player.keystone ? c.keystones[st.player.keystone]?.effects : undefined;
  if (k?.allDamagePermille) m = permille(m, k.allDamagePermille);
  if (target) {
    const role = c.monsters[target.type]?.role;
    if (k?.eliteDamagePermille && (role === "elite" || role === "miniboss")) m = permille(m, k.eliteDamagePermille);
    if (k?.bossDamagePermille && role === "mvp") m = permille(m, k.bossDamagePermille);
  }
  return m;
}

function maxHpFor(c: RunContent, st: RunState): number {
  let m = 1000;
  for (const p of st.player.passive) m += (c.passives[p.id]?.perRank.maxHpPermille ?? 0) * p.rank;
  return permille(c.player.maxHp + itemSum(c, st, "maxHp"), m);
}

function playerSpeed(c: RunContent, st: RunState): number {
  let s = permille(c.player.speedMmPerTick, 1000 + itemSum(c, st, "movePermille"));
  const k = st.player.keystone ? c.keystones[st.player.keystone]?.effects : undefined;
  if (k?.movePermille) s = permille(s, k.movePermille);
  for (const p of st.player.passive) {
    const d = c.passives[p.id];
    if (d?.lowHp && st.player.hp * 1000 <= st.player.maxHp * d.lowHp.thresholdPermille) s = permille(s, d.lowHp.movePermille);
  }
  return s;
}

// ---------------------------------------------------------------- damage
function damageEnemy(c: RunContent, st: RunState, e: Enemy, raw: number, source: string, attackerX: number, attackerY: number, withMultiplier = true): void {
  if (e.hp <= 0) return;
  let dmg = withMultiplier ? permille(raw, playerDamageMultiplier(c, st, e)) : raw;
  if (st.runTick < e.debuffUntil) dmg = permille(dmg, 1000 - e.armorDebuff);
  if (st.runTick < e.hardenUntil) {
    const harden = c.monsters[e.type]?.attacks.find((a) => a.kind === "harden");
    if (harden) {
      // Rear arc (> 120° from the boss facing) is the safe melee window and takes bonus damage.
      const [ux, uy] = unitToward(e.x, e.y, attackerX, attackerY);
      const rear = ux * e.fx + uy * e.fy < -5000 * TRIG_SCALE; // cos(120°) = -0.5 at 10^8 scale
      dmg = rear ? permille(dmg, harden.rearArcPermille) : permille(dmg, 1000 - harden.damageReductionPermille);
    }
  }
  dmg = Math.max(1, dmg);
  const effective = Math.min(e.hp, dmg);
  e.hp -= dmg;
  st.stats.damageBySource[source] = (st.stats.damageBySource[source] ?? 0) + dmg;
  st.stats.effectiveDamageBySource[source] = (st.stats.effectiveDamageBySource[source] ?? 0) + effective;
  if (c.monsters[e.type]?.role === "mvp") {
    st.stats.damageToMvp += effective;
    st.stats.mvpDamageBySource[source] = (st.stats.mvpDamageBySource[source] ?? 0) + effective;
  }
  st.events.push({ type: "hit", tick: st.runTick, source, targetId: e.id, amount: dmg });
}

function damagePlayer(c: RunContent, st: RunState, raw: number, source: string, geomId?: string, attacker?: Enemy): void {
  const p = st.player;
  if (p.hp <= 0) return;
  let reduction = c.player.armorPermille + itemSum(c, st, "armorPermille");
  if (st.runTick < p.endureUntil) reduction += p.endureReduction;
  let dmg = permille(raw, Math.max(100, 1000 - reduction));
  for (const ps of p.passive) {
    const d = c.passives[ps.id];
    if (d?.lowHp && p.hp * 1000 <= p.maxHp * d.lowHp.thresholdPermille) dmg = permille(dmg, d.lowHp.incomingPermille);
  }
  dmg = Math.max(1, dmg);
  const effective = Math.min(p.hp, dmg);
  p.hp = Math.max(0, p.hp - dmg);
  st.stats.minHpPermille = Math.min(st.stats.minHpPermille, Math.trunc((p.hp * 1000) / Math.max(1, p.maxHp)));
  p.lastDamagedTick = st.runTick;
  st.stats.damageTakenBySource[source] = (st.stats.damageTakenBySource[source] ?? 0) + dmg;
  st.stats.effectiveDamageTakenBySource[source] = (st.stats.effectiveDamageTakenBySource[source] ?? 0) + effective;
  st.events.push({ type: "player-hit", tick: st.runTick, source, amount: dmg, ...(geomId ? { geomId } : {}), ...(attacker ? { actorId: attacker.id } : {}) });
  const k = p.keystone ? c.keystones[p.keystone]?.effects : undefined;
  if (attacker && st.runTick < p.endureUntil && k?.counterOnBlockDamage) damageEnemy(c, st, attacker, k.counterOnBlockDamage, "keystone.guardian.counter", p.x, p.y);
}

// ---------------------------------------------------------------- spawning
function spawnEnemy(c: RunContent, st: RunState, grid: RunGrid | null | undefined, type: string, rng: Rng, near?: { x: number; y: number; radius: number }): Enemy | null {
  const def = c.monsters[type];
  if (!def) throw new Error(`unknown monster ${type}`);
  if (st.enemies.length >= RUN_MAX_ENEMIES && def.role !== "mvp") {
    st.stats.spawnsSkipped += 1;
    return null;
  }
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const [ux, uy] = DIR16[rng.nextInt(16)] as [number, number];
    const dist = near ? rng.range(near.radius / 2, near.radius) : rng.range(SPAWN_MIN_MM, SPAWN_MAX_MM);
    const ox = near ? near.x : st.player.x;
    const oy = near ? near.y : st.player.y;
    const x = ox + Math.trunc((ux * dist) / TRIG_SCALE);
    const y = oy + Math.trunc((uy * dist) / TRIG_SCALE);
    if (!walkable(grid, x, y)) continue;
    const e: Enemy = {
      id: st.nextId++, type, x, y, hp: def.hp, maxHp: def.hp, radius: def.radiusMm, stunUntil: 0, playerControlUntil: 0, contactReadyAt: 0,
      armorDebuff: 0, moveDebuff: 1000, debuffUntil: 0, fx: 0, fy: -TRIG_SCALE,
      attackReadyAt: def.attacks.map((a) => st.runTick + Math.max(60, Math.trunc(a.cooldownTicks / 2))),
      dashUntil: 0, dashDx: 0, dashDy: 0, hardenUntil: 0, hardenUsed: 0,
      projectileReadyAt: st.runTick + (def.projectile?.cooldownTicks ?? 0), hopsLeft: 0,
    };
    st.enemies.push(e);
    st.events.push({ type: def.role === "mvp" ? "boss-spawn" : "spawn", tick: st.runTick, source: type, targetId: e.id });
    st.stats.maxEnemies = Math.max(st.stats.maxEnemies, st.enemies.length);
    return e;
  }
  st.stats.spawnsSkipped += 1;
  return null;
}

function runTimeline(c: RunContent, st: RunState, grid: RunGrid | null | undefined): void {
  const rng = Rng.restore(st.rngSpawn);
  c.timeline.forEach((t, i) => {
    if (t.kind === "wave") {
      if (st.runTick < t.fromTick || st.runTick >= t.toTick) return;
      if ((st.runTick - t.fromTick) % t.spawnEveryTicks !== 0) return;
      if (st.normalWavePermille < 1000 && rng.nextInt(1000) >= st.normalWavePermille) return;
      spawnEnemy(c, st, grid, t.pool[rng.nextInt(t.pool.length)] as string, rng);
      return;
    }
    if (st.firedEvents[i] || st.runTick < t.atTick) return;
    st.firedEvents[i] = true;
    if (t.kind === "spawn") {
      const e = spawnEnemy(c, st, grid, t.entity, rng);
      if (c.monsters[t.entity]?.role === "mvp" && e) {
        st.bossId = e.id;
        st.normalWavePermille = t.normalWavePermille;
        st.stats.bossSpawnTick = st.runTick;
        st.stats.bossType = e.type;
        st.stats.bossMaxHp = e.maxHp;
        st.phase = "boss-intro";
        st.phaseUntil = st.tick + BOSS_INTRO_TICKS;
      }
    } else if (t.kind === "boss-warning") {
      st.magnetPermille = t.magnetPermille;
      st.events.push({ type: "boss-warning", tick: st.runTick });
    } else {
      st.enraged = true;
      st.events.push({ type: "enrage", tick: st.runTick });
    }
  });
  // Waves keep running after the last timeline window so the boss fight keeps pressure.
  const last = c.timeline.filter((t) => t.kind === "wave").at(-1);
  if (last && last.kind === "wave" && st.bossId !== 0 && st.runTick >= last.toTick && (st.runTick - last.toTick) % (last.spawnEveryTicks * 2) === 0) {
    if (rng.nextInt(1000) < st.normalWavePermille) spawnEnemy(c, st, grid, last.pool[rng.nextInt(last.pool.length)] as string, rng);
  }
  st.rngSpawn = rng.snapshot();
}

// ---------------------------------------------------------------- enemies
function addTelegraph(st: RunState, owner: Enemy, attack: BossAttackDef | { id: string; kind: string }, g: Geometry, ox: number, oy: number, dx: number, dy: number, delay: number, damage: number, activeTicks = 6): void {
  const id = st.nextId++;
  const geomId = `${owner.type}:${attack.id}:${id}`;
  st.telegraphs.push({ id, geomId, ownerId: owner.id, attackId: attack.id, placed: { shape: g, ox, oy, dx, dy }, startTick: st.runTick, hitTick: st.runTick + delay, endTick: st.runTick + delay + activeTicks, damage, resolved: false });
  st.events.push({ type: "telegraph", tick: st.runTick, source: attack.id, geomId });
}

function enemyAttacks(c: RunContent, st: RunState, e: Enemy, def: MonsterDef, grid: RunGrid | null | undefined): void {
  const p = st.player;
  const rng = Rng.restore(st.rngCombat);
  const cdMul = st.enraged && def.enrage ? def.enrage.cooldownPermille : 1000;
  def.attacks.forEach((a, i) => {
    if (a.kind === "harden") {
      const used = e.hardenUsed;
      const th = a.hpThresholdsPermille[used];
      if (th !== undefined && e.hp * 1000 <= e.maxHp * th) {
        e.hardenUsed += 1;
        e.hardenUntil = st.runTick + a.durationTicks;
      }
      return;
    }
    if (st.runTick < (e.attackReadyAt[i] ?? 0)) return;
    const dist = Math.sqrt((p.x - e.x) ** 2 + (p.y - e.y) ** 2);
    const [dx, dy] = unitToward(e.x, e.y, p.x, p.y);
    let started = true;
    if ((a.kind === "hop-slam" || a.kind === "elite-hop") && a.geometry && dist < 9000) {
      addTelegraph(st, e, a, a.geometry, p.x, p.y, dx, dy, a.telegraphTicks, a.damage);
      if (a.kind === "elite-hop") e.hopsLeft = a.count - 1;
    } else if (a.kind === "poison-ring" && a.geometry && dist < 7000) {
      addTelegraph(st, e, a, a.geometry, e.x, e.y, dx, dy, a.telegraphTicks, a.damage);
    } else if (a.kind === "sound-cone" && a.geometry && dist < 7000) {
      addTelegraph(st, e, a, a.geometry, e.x, e.y, dx, dy, a.telegraphTicks, a.damage);
    } else if (a.kind === "summon" && a.spawnId) {
      for (let k = 0; k < a.count; k += 1) spawnEnemy(c, st, grid, a.spawnId, rng, { x: e.x, y: e.y, radius: 3000 });
    } else if (a.kind === "bounce-ring") {
      // 12 radial projectiles with `safeGapCount` adjacent directions left open; they launch after
      // the warning and carry the warning telegraph's geometry ID.
      const gapStart = rng.nextInt(a.count);
      const reach = a.projectileSpeedMmPerTick * 300;
      addTelegraph(st, e, a, { shape: "circle", radiusMm: reach }, e.x, e.y, 0, 0, a.telegraphTicks, 0);
      const warn = st.telegraphs[st.telegraphs.length - 1] as Telegraph;
      for (let k = 0; k < a.count; k += 1) {
        const slot = (k - gapStart + a.count) % a.count;
        if (slot < a.safeGapCount) continue;
        const [ux, uy] = DIR12[k % 12] as [number, number];
        st.projectiles.push({ id: st.nextId++, ownerId: e.id, source: `${e.type}:${a.id}`, geomId: warn.geomId, x: e.x, y: e.y, vx: Math.trunc((ux * a.projectileSpeedMmPerTick) / TRIG_SCALE), vy: Math.trunc((uy * a.projectileSpeedMmPerTick) / TRIG_SCALE), radius: 300, damage: a.damage, activeAt: st.runTick + a.telegraphTicks, until: st.runTick + a.telegraphTicks + 300 });
      }
    } else if (a.kind === "sidestep") {
      const [sx, sy] = [-dy, dx];
      const nx = e.x + Math.trunc((sx * a.distanceMm) / TRIG_SCALE);
      const ny = e.y + Math.trunc((sy * a.distanceMm) / TRIG_SCALE);
      if (walkable(grid, nx, ny)) {
        e.x = nx;
        e.y = ny;
      }
    } else started = false;
    if (started) e.attackReadyAt[i] = st.runTick + permille(a.cooldownTicks, cdMul);
  });
  st.rngCombat = rng.snapshot();
}

function moveEnemy(grid: RunGrid | null | undefined, e: Enemy, dx: number, dy: number): void {
  if (walkable(grid, e.x + dx, e.y + dy)) {
    e.x += dx;
    e.y += dy;
  } else if (walkable(grid, e.x + dx, e.y)) e.x += dx;
  else if (walkable(grid, e.x, e.y + dy)) e.y += dy;
}

function updateEnemies(c: RunContent, st: RunState, grid: RunGrid | null | undefined): void {
  const p = st.player;
  // Ranged volley cap: only the nearest N ranged enemies may fire this tick.
  const shooters = new Set(
    st.enemies
      .filter((e) => c.monsters[e.type]?.projectile)
      .map((e) => ({ id: e.id, d: (e.x - p.x) ** 2 + (e.y - p.y) ** 2 }))
      .sort((a, b) => a.d - b.d || a.id - b.id)
      .slice(0, c.progression.maxRangedShooters)
      .map((x) => x.id),
  );
  for (const e of st.enemies) {
    const def = c.monsters[e.type] as MonsterDef;
    if (st.runTick < e.stunUntil) continue;
    const [ux, uy] = unitToward(e.x, e.y, p.x, p.y, [e.fx, e.fy]);
    e.fx = ux;
    e.fy = uy;
    let speed = def.speedMmPerTick;
    if (st.runTick < e.debuffUntil) speed = permille(speed, e.moveDebuff);
    if (st.enraged && def.enrage) speed = permille(speed, def.enrage.movePermille);
    const dist = Math.sqrt((p.x - e.x) ** 2 + (p.y - e.y) ** 2);
    // Charger: telegraphed straight dash along the shared capsule geometry.
    if (def.charge) {
      if (st.runTick < e.dashUntil) {
        moveEnemy(grid, e, Math.trunc((e.dashDx * def.charge.speedMmPerTick) / TRIG_SCALE), Math.trunc((e.dashDy * def.charge.speedMmPerTick) / TRIG_SCALE));
        continue;
      }
      if (dist < 6000 && st.runTick >= e.projectileReadyAt) {
        const len = def.charge.speedMmPerTick * def.charge.durationTicks;
        addTelegraph(st, e, { id: "charge", kind: "charge" }, { shape: "capsule", rangeMm: len, radiusMm: e.radius }, e.x, e.y, ux, uy, def.charge.telegraphTicks, def.charge.damage, def.charge.durationTicks);
        e.stunUntil = st.runTick + def.charge.telegraphTicks; // wind-up: stands still while telegraphing
        e.dashUntil = st.runTick + def.charge.telegraphTicks + def.charge.durationTicks;
        e.dashDx = ux;
        e.dashDy = uy;
        e.projectileReadyAt = st.runTick + def.charge.cooldownTicks;
        continue;
      }
    }
    if (def.projectile) {
      if (dist < def.projectile.rangeMm && st.runTick >= e.projectileReadyAt && shooters.has(e.id)) {
        const geomId = `${e.type}:projectile:${st.nextId}`;
        st.projectiles.push({ id: st.nextId++, ownerId: e.id, source: e.type, geomId, x: e.x, y: e.y, vx: Math.trunc((ux * def.projectile.speedMmPerTick) / TRIG_SCALE), vy: Math.trunc((uy * def.projectile.speedMmPerTick) / TRIG_SCALE), radius: 250, damage: def.projectile.damage, activeAt: st.runTick, until: st.runTick + 180 });
        st.events.push({ type: "projectile", tick: st.runTick, source: e.type, geomId });
        e.projectileReadyAt = st.runTick + def.projectile.cooldownTicks;
      }
      if (dist < 5000) continue; // ranged units keep their distance
    }
    if (dist > c.player.radiusMm + e.radius) moveEnemy(grid, e, Math.trunc((ux * speed) / TRIG_SCALE), Math.trunc((uy * speed) / TRIG_SCALE));
    if (def.attacks.length) enemyAttacks(c, st, e, def, grid);
  }
}

// ---------------------------------------------------------------- player skills
interface Target { e: Enemy; d2: number }

function enemiesWithin(st: RunState, x: number, y: number, r: number): Target[] {
  const out: Target[] = [];
  for (const e of st.enemies) {
    if (e.hp <= 0) continue;
    const d2 = (e.x - x) ** 2 + (e.y - y) ** 2;
    const rr = r + e.radius;
    if (d2 <= rr * rr) out.push({ e, d2 });
  }
  out.sort((a, b) => a.d2 - b.d2 || a.e.id - b.e.id);
  return out;
}

const isElite = (c: RunContent, e: Enemy): boolean => {
  const role = c.monsters[e.type]?.role;
  return role === "elite" || role === "miniboss" || role === "mvp";
};

function balanceRole(c: RunContent, e: Enemy): BalanceRole {
  const role = c.monsters[e.type]?.role;
  return role === "mvp" ? "mvp" : role === "elite" || role === "miniboss" ? "elite" : "normal";
}

function shieldBlocked(c: RunContent, st: RunState, s: SkillDef): boolean {
  if (!s.tags.includes("shield")) return false;
  if (st.player.keystone && c.keystones[st.player.keystone]?.effects.shieldSkillsDisabled) return true;
  return st.player.passive.some((p) => c.passives[p.id]?.disablesShieldSkills);
}

/** Decide whether a skill should fire now and in which direction (never moves the player). */
function acquire(c: RunContent, st: RunState, s: SkillDef, v: ReturnType<typeof skillValue>): { dx: number; dy: number } | null {
  const p = st.player;
  const reach = v.geometry ? (v.geometry.shape === "circle" ? v.geometry.radiusMm : v.geometry.rangeMm) : 0;
  const near = enemiesWithin(st, p.x, p.y, reach);
  const toward = (e: Enemy): { dx: number; dy: number } => {
    const [dx, dy] = unitToward(p.x, p.y, e.x, e.y, [p.fx, p.fy]);
    return { dx, dy };
  };
  switch (s.trigger) {
    case "automatic-nearest-in-range":
      return near[0] ? toward(near[0].e) : null;
    case "automatic-enemy-count-threshold":
      return near.length >= s.minimumTargets ? { dx: p.fx, dy: p.fy } : null;
    case "automatic-on-damage-window":
      return st.runTick - p.lastDamagedTick <= 30 || enemiesWithin(st, p.x, p.y, 2000).length >= 3 ? { dx: p.fx, dy: p.fy } : null;
    case "automatic-nearby-elite-priority": {
      const elite = near.find((t) => isElite(c, t.e));
      return elite || near.length >= 5 ? { dx: p.fx, dy: p.fy } : null;
    }
    case "automatic-highest-density-sector": {
      if (!v.geometry || near.length < s.minimumTargets) return null;
      let best = 0;
      let dir: [number, number] = [p.fx, p.fy];
      for (const d of DIR16) {
        const placed: Placed = { shape: v.geometry, ox: p.x, oy: p.y, dx: d[0], dy: d[1] };
        const n = near.filter((t) => hits(placed, t.e.x, t.e.y, t.e.radius)).length;
        if (n > best) {
          best = n;
          dir = [d[0], d[1]];
        }
      }
      return best >= s.minimumTargets ? { dx: dir[0], dy: dir[1] } : null;
    }
    case "automatic-elite-priority": {
      const elite = near.find((t) => isElite(c, t.e));
      return elite ? toward(elite.e) : near.length >= 3 && near[0] ? toward(near[0].e) : null;
    }
    default:
      return null;
  }
}

function resolveSkill(c: RunContent, st: RunState, s: SkillDef, rank: number, dx: number, dy: number): void {
  const p = st.player;
  const v = skillValue(c, s, rank, p.keystone);
  const rng = Rng.restore(st.rngCombat);
  const geomId = `player:${s.id}:${st.nextId++}`;
  st.events.push({
    type: "skill", tick: st.runTick, source: s.id, geomId, origin: { xMm: p.x, yMm: p.y }, direction: { x: dx, y: dy },
    geometry: v.geometry, rank, vfxCue: s.id, designOrigin: s.designOrigin,
  });
  if (isAreaClear(c, s.id) && st.stats.firstAreaClearCastTick < 0) st.stats.firstAreaClearCastTick = st.runTick;
  if (s.id === "skill.sw.endure") {
    p.endureUntil = st.runTick + v.duration;
    p.endureReduction = v.reduction;
  } else if (v.geometry) {
    const placed: Placed = { shape: v.geometry, ox: p.x, oy: p.y, dx, dy };
    const targets = enemiesWithin(st, p.x, p.y, v.geometry.shape === "circle" ? v.geometry.radiusMm : v.geometry.rangeMm).filter((t) => hits(placed, t.e.x, t.e.y, t.e.radius));
    const limit = v.damage > 0 ? v.hitLimit : targets.length;
    const hitTargets = targets.slice(0, limit);
    if (isAreaClear(c, s.id) && st.stats.firstEffectiveAreaClearTick < 0 && hitTargets.filter((t) => c.monsters[t.e.type]?.role !== "mvp").length >= 3) {
      st.stats.firstEffectiveAreaClearTick = st.runTick;
    }
    for (const t of hitTargets) {
      if (v.damage > 0) {
        let dmg = v.damage;
        if (s.effects.eliteDamagePermille && isElite(c, t.e)) dmg = permille(dmg, s.effects.eliteDamagePermille);
        damageEnemy(c, st, t.e, dmg, s.id, p.x, p.y);
      }
      if (s.stun && rng.nextInt(1000) < v.stunChance) {
        const until = st.runTick + s.stun.ticks;
        t.e.stunUntil = Math.max(t.e.stunUntil, until);
        t.e.playerControlUntil = Math.max(t.e.playerControlUntil, until);
        st.stats.playerControlApplications[balanceRole(c, t.e)] += 1;
      }
      if (v.armorDelta !== 0) {
        t.e.armorDebuff = v.armorDelta;
        t.e.moveDebuff = s.effects.enemyMovePermille ?? 1000;
        t.e.debuffUntil = st.runTick + Math.max(v.duration, 60);
      }
    }
  }
  st.rngCombat = rng.snapshot();
}

function updatePlayerSkills(c: RunContent, st: RunState): void {
  const p = st.player;
  const basic = c.skills[c.player.basicSkillId] as SkillDef;
  // Basic attack: acquire -> windup -> hit frame (shared sector geometry).
  if (p.basicHitAt === st.runTick) {
    const v = skillValue(c, basic, p.basicRank, p.keystone);
    if (v.geometry?.shape === "sector") {
      const arc = p.passive.reduce((sum, ps) => sum + (c.passives[ps.id]?.perRank.basicArcDeg ?? 0) * ps.rank, 0);
      const g: Geometry = { ...v.geometry, halfAngleDeg: Math.min(180, v.geometry.halfAngleDeg + Math.trunc(arc / 2)) };
      const placed: Placed = { shape: g, ox: p.x, oy: p.y, dx: p.basicDx, dy: p.basicDy };
      st.events.push({
        type: "skill", tick: st.runTick, source: basic.id, geomId: `player:${basic.id}:${st.nextId++}`,
        origin: { xMm: p.x, yMm: p.y }, direction: { x: p.basicDx, y: p.basicDy }, geometry: g,
        rank: p.basicRank, vfxCue: basic.id, designOrigin: basic.designOrigin,
      });
      const targets = enemiesWithin(st, p.x, p.y, g.rangeMm).filter((t) => hits(placed, t.e.x, t.e.y, t.e.radius));
      const bonus = p.keystone ? (c.keystones[p.keystone]?.effects.basicHitLimitBonus ?? 0) : 0;
      for (const t of targets.slice(0, v.hitLimit + bonus)) damageEnemy(c, st, t.e, v.damage, basic.id, p.x, p.y);
    }
    p.basicHitAt = -1;
  } else if (p.basicHitAt < 0 && st.runTick >= p.basicReadyAt) {
    const v = skillValue(c, basic, p.basicRank, p.keystone);
    const target = enemiesWithin(st, p.x, p.y, v.geometry && v.geometry.shape !== "circle" ? v.geometry.rangeMm : 1800)[0];
    if (target) {
      const [dx, dy] = unitToward(p.x, p.y, target.e.x, target.e.y, [p.fx, p.fy]);
      p.basicDx = dx;
      p.basicDy = dy;
      p.basicHitAt = st.runTick + BASIC_WINDUP;
      const interval = p.passive.reduce((m, ps) => m + (c.passives[ps.id]?.perRank.attackIntervalPermille ?? 0) * ps.rank, 1000);
      p.basicReadyAt = st.runTick + Math.max(BASIC_WINDUP + 4, permille(v.cooldown, interval));
    }
  }
  // Active skills: one cast at a time; casting never moves or roots the player.
  if (p.castSlot >= 0) {
    if (st.runTick >= p.castEndAt) {
      const slot = p.active[p.castSlot];
      const s = slot ? c.skills[slot.id] : undefined;
      if (slot && s) resolveSkill(c, st, s, slot.rank, p.castDx, p.castDy);
      p.castSlot = -1;
    }
    return;
  }
  for (let i = 0; i < p.active.length; i += 1) {
    const slot = p.active[i] as SlotState;
    const s = c.skills[slot.id];
    if (!s || st.runTick < slot.readyAt || shieldBlocked(c, st, s)) continue;
    const v = skillValue(c, s, slot.rank, p.keystone);
    const aim = acquire(c, st, s, v);
    if (!aim) continue;
    slot.readyAt = st.runTick + v.cooldown + v.cast;
    if (v.cast === 0) resolveSkill(c, st, s, slot.rank, aim.dx, aim.dy);
    else {
      p.castSlot = i;
      p.castEndAt = st.runTick + v.cast;
      p.castDx = aim.dx;
      p.castDy = aim.dy;
    }
    break;
  }
}

// ---------------------------------------------------------------- hazards
function updateHazards(c: RunContent, st: RunState, grid: RunGrid | null | undefined): void {
  const p = st.player;
  const pr = c.player.radiusMm;
  for (const t of st.telegraphs) {
    if (t.resolved || st.runTick < t.hitTick || t.damage === 0) continue;
    if (hits(t.placed, p.x, p.y, pr)) {
      t.resolved = true;
      st.stats.telegraphHits.push({ geomId: t.geomId, attackId: t.attackId });
      damagePlayer(c, st, t.damage, `${t.geomId.split(":")[0] ?? ""}:${t.attackId}`, t.geomId, st.enemies.find((e) => e.id === t.ownerId));
    }
  }
  // Elite hops: each resolved hop lands the elite and telegraphs the next one.
  for (const t of st.telegraphs) {
    if (t.attackId !== "elite-hop" || st.runTick !== t.hitTick) continue;
    const owner = st.enemies.find((e) => e.id === t.ownerId);
    if (!owner) continue;
    if (walkable(grid, t.placed.ox, t.placed.oy)) {
      owner.x = t.placed.ox;
      owner.y = t.placed.oy;
    }
    if (owner.hopsLeft > 0) {
      owner.hopsLeft -= 1;
      const atk = c.monsters[owner.type]?.attacks.find((a) => a.kind === "elite-hop");
      if (atk?.geometry) addTelegraph(st, owner, atk, atk.geometry, p.x, p.y, 0, 0, atk.telegraphTicks, atk.damage);
    }
  }
  st.telegraphs = st.telegraphs.filter((t) => st.runTick <= t.endTick);
  for (const pj of st.projectiles) {
    if (st.runTick < pj.activeAt) continue;
    pj.x += pj.vx;
    pj.y += pj.vy;
    const rr = pj.radius + pr;
    if ((pj.x - p.x) ** 2 + (pj.y - p.y) ** 2 <= rr * rr) {
      pj.until = -1;
      st.stats.telegraphHits.push({ geomId: pj.geomId, attackId: pj.source });
      damagePlayer(c, st, pj.damage, pj.source, pj.geomId);
    }
  }
  st.projectiles = st.projectiles.filter((pj) => st.runTick < pj.until);
  for (const pool of st.pools) {
    if (st.runTick < pool.nextTick) continue;
    pool.nextTick = st.runTick + 30;
    const rr = pool.radius + pr;
    if ((pool.x - p.x) ** 2 + (pool.y - p.y) ** 2 <= rr * rr) damagePlayer(c, st, Math.trunc(pool.damagePerSecond / 2), pool.source);
  }
  st.pools = st.pools.filter((pool) => st.runTick < pool.until);
  for (const e of st.enemies) {
    if (st.runTick < p.contactGraceUntil) break;
    if (e.hp <= 0 || st.runTick < e.contactReadyAt || st.runTick < e.stunUntil) continue;
    const rr = e.radius + pr + 50;
    if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 > rr * rr) continue;
    e.contactReadyAt = st.runTick + c.progression.contactIntervalTicks;
    p.contactGraceUntil = st.runTick + c.progression.contactGraceTicks;
    damagePlayer(c, st, c.monsters[e.type]?.contactDamage ?? 0, e.type, undefined, e);
  }
}

// ---------------------------------------------------------------- kills, xp, regen
function rewardFor(c: RunContent, type: string): "chest" | "keystone" | null {
  for (const t of c.timeline) if (t.kind === "spawn" && t.entity === type) return t.reward;
  return null;
}

function addOrb(c: RunContent, st: RunState, x: number, y: number, value: number): void {
  const r = c.progression.xpMergeRadiusMm;
  let best: Orb | undefined;
  let bestD = Infinity;
  for (const o of st.orbs) {
    const d = (o.x - x) ** 2 + (o.y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  if (best && (bestD <= r * r || st.orbs.length >= c.progression.maxGroundXpObjects)) best.value += value;
  else st.orbs.push({ id: st.nextId++, x, y, value });
}

function processDeaths(c: RunContent, st: RunState): void {
  const alive: Enemy[] = [];
  for (const e of st.enemies) {
    if (e.hp > 0) {
      alive.push(e);
      continue;
    }
    const def = c.monsters[e.type] as MonsterDef;
    st.stats.kills += 1;
    st.events.push({ type: "kill", tick: st.runTick, source: e.type, targetId: e.id });
    if (def.xp > 0) addOrb(c, st, e.x, e.y, def.xp);
    if (def.pool) st.pools.push({ id: st.nextId++, source: `${e.type}:pool`, x: e.x, y: e.y, radius: def.pool.radiusMm, damagePerSecond: def.pool.damagePerSecond, until: st.runTick + def.pool.durationTicks, nextTick: st.runTick + 30 });
    const reward = rewardFor(c, e.type);
    if (reward) st.pendingDrafts.push(reward);
    if (e.id === st.bossId) {
      st.stats.bossKillTick = st.runTick;
      st.phase = "victory";
    }
  }
  st.enemies = alive;
  st.telegraphs = st.telegraphs.filter((t) => t.resolved || alive.some((e) => e.id === t.ownerId) || t.attackId === "bounce-ring");
}

function collectOrbs(c: RunContent, st: RunState): void {
  const p = st.player;
  const pull = permille(permille(c.player.pickupRadiusMm, 1000 + itemSum(c, st, "pickupPermille")), st.magnetPermille);
  const grab = c.player.radiusMm + 250;
  const kept: Orb[] = [];
  for (const o of st.orbs) {
    const d = Math.sqrt((o.x - p.x) ** 2 + (o.y - p.y) ** 2);
    if (d <= grab) {
      p.xp += o.value;
      continue;
    }
    if (d <= pull) {
      const step = Math.min(ORB_PULL_MM, d);
      o.x += Math.trunc(((p.x - o.x) * step) / d);
      o.y += Math.trunc(((p.y - o.y) * step) / d);
    }
    kept.push(o);
  }
  st.orbs = kept;
  const prog = c.progression;
  while (p.level < prog.maxLevel && p.xp >= (prog.xpToNext[p.level] ?? Infinity)) {
    p.xp -= prog.xpToNext[p.level] as number;
    p.level += 1;
    st.stats.levelUps += 1;
    st.pendingDrafts.push("level");
    p.hp = Math.min(p.maxHp, p.hp + permille(p.maxHp, prog.levelUpHealPermille));
    st.events.push({ type: "level-up", tick: st.runTick, amount: p.level });
  }
}

function regen(c: RunContent, st: RunState): void {
  const p = st.player;
  if (st.runTick % 60 !== 0 || p.hp <= 0) return;
  p.hp = Math.min(p.maxHp, p.hp + itemSum(c, st, "regenPerSecond"));
  const rank = passiveRank(st, "passive.sw.hp_recovery");
  if (rank === 0) return;
  const def = c.passives["passive.sw.hp_recovery"];
  let heal = Math.trunc((p.maxHp * (def?.perRank.healPerSecondPpm ?? 0) * rank) / 1_000_000);
  heal = Math.min(heal, def?.combatHealCapPerSecond ?? heal);
  if (p.moving) {
    const mr = c.passives["passive.sw.moving_recovery"];
    heal = passiveRank(st, "passive.sw.moving_recovery") > 0 ? permille(heal, mr?.movingRecoveryPermille ?? 0) : 0;
  }
  p.hp = Math.min(p.maxHp, p.hp + heal);
}

function separate(c: RunContent, st: RunState, grid: RunGrid | null | undefined): void {
  const cell = 1600;
  const buckets = new Map<number, number[]>();
  const key = (cx: number, cy: number): number => (cx + 32768) * 65536 + (cy + 32768);
  st.enemies.forEach((e, i) => {
    const k = key(Math.floor(e.x / cell), Math.floor(e.y / cell));
    const b = buckets.get(k);
    if (b) b.push(i);
    else buckets.set(k, [i]);
  });
  for (let i = 0; i < st.enemies.length; i += 1) {
    const a = st.enemies[i] as Enemy;
    const cx = Math.floor(a.x / cell);
    const cy = Math.floor(a.y / cell);
    for (let ox = -1; ox <= 1; ox += 1) {
      for (let oy = -1; oy <= 1; oy += 1) {
        for (const j of buckets.get(key(cx + ox, cy + oy)) ?? []) {
          if (j <= i) continue;
          const b = st.enemies[j] as Enemy;
          const minD = Math.min(a.radius + b.radius, 2400);
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let d2 = dx * dx + dy * dy;
          if (d2 >= minD * minD) continue;
          if (d2 === 0) {
            dx = a.id < b.id ? 1 : -1;
            dy = 0;
            d2 = 1;
          }
          const d = Math.sqrt(d2);
          const push = Math.trunc((minD - d) / 4) + 1;
          const px = Math.trunc((dx * push) / d);
          const py = Math.trunc((dy * push) / d);
          const aBoss = c.monsters[a.type]?.role === "mvp";
          const bBoss = c.monsters[b.type]?.role === "mvp";
          if (!aBoss) moveEnemy(grid, a, -px, -py);
          if (!bBoss) moveEnemy(grid, b, px, py);
        }
      }
    }
  }
}

// ---------------------------------------------------------------- drafts
export function buildView(st: RunState): BuildView {
  const p = st.player;
  return {
    level: p.level, basicRank: p.basicRank, active: p.active.map((a) => ({ id: a.id, rank: a.rank })), passive: p.passive.map((a) => ({ id: a.id, rank: a.rank })),
    keystone: p.keystone, tags: [...p.tags], runTick: st.runTick, levelsSinceNewActive: st.levelsSinceNewActive, levelsSinceDefense: st.levelsSinceDefense,
  };
}

function openDraft(c: RunContent, st: RunState): void {
  const source = st.pendingDrafts.shift();
  if (!source) return;
  const rng = Rng.restore(st.rngDraft);
  const options = generateDraft(c, buildView(st), rng, source);
  if (st.stats.firstAreaClearOfferedTick < 0 && options.some((option) => isAreaClear(c, option.id))) st.stats.firstAreaClearOfferedTick = st.runTick;
  st.rngDraft = rng.snapshot();
  st.draft = { options, source };
  st.phase = "draft";
  st.stats.draftsOffered += 1;
}

function applyOption(c: RunContent, st: RunState, o: DraftOption): void {
  const p = st.player;
  const source = st.draft?.source ?? "level";
  if (o.kind === "new-active") {
    p.active.push({ id: o.id, rank: 1, readyAt: st.runTick });
    const s = c.skills[o.id];
    if (s && isAreaClear(c, s.id)) {
      if (st.stats.firstAreaClearTick < 0) st.stats.firstAreaClearTick = st.runTick;
      if (st.stats.firstAreaClearSelectedTick < 0) st.stats.firstAreaClearSelectedTick = st.runTick;
    }
  } else if (o.kind === "rank-active") {
    const a = p.active.find((x) => x.id === o.id);
    if (a) a.rank += 1;
  } else if (o.kind === "new-passive") {
    p.passive.push({ id: o.id, rank: 1, readyAt: 0 });
  } else if (o.kind === "rank-passive") {
    const a = p.passive.find((x) => x.id === o.id);
    if (a) a.rank += 1;
  } else if (o.kind === "rank-basic") {
    p.basicRank += 1;
  } else if (o.kind === "keystone") {
    p.keystone = o.id;
    if (c.keystones[o.id]?.effects.twoHandEnabled) p.tags = [...p.tags.filter((t) => t !== "shield-equipped"), "two-handed-sword"];
  } else {
    p.hp = Math.min(p.maxHp, p.hp + Math.trunc(p.maxHp * 3 / 10));
  }
  const newMax = maxHpFor(c, st);
  if (newMax !== p.maxHp) {
    p.hp += newMax - p.maxHp;
    p.maxHp = newMax;
  }
  if (source === "level") {
    st.levelsSinceNewActive = o.kind === "new-active" ? 0 : st.levelsSinceNewActive + 1;
    st.levelsSinceDefense = DEFENSE_IDS.has(o.id) ? 0 : st.levelsSinceDefense + 1;
  }
  st.draft = null;
  st.pendingKeystone = null;
  st.phase = "running";
}

// ---------------------------------------------------------------- step
export interface RunInput extends InputCommand {
  draftIndex?: number;
  confirm?: boolean;
  cancel?: boolean;
}

/** One fixed 60 Hz step, in place. `runTick` (gameplay time) only advances while running. */
export function stepRun(st: RunState, cfg: RunConfig, input: RunInput | undefined): void {
  const c = cfg.content;
  st.events = [];
  if (input) {
    if (input.sequence <= st.lastSequence) throw new Error(`non-monotonic input sequence ${input.sequence}`);
    if (!Number.isInteger(input.moveX) || !Number.isInteger(input.moveY)) throw new TypeError("InputCommand axes must be integers");
    st.lastSequence = input.sequence;
  }
  st.tick += 1;
  if (st.phase === "victory" || st.phase === "defeat") return;
  if (input?.pause) return; // explicit pause: nothing advances
  if (st.phase === "boss-intro") {
    if (st.tick >= st.phaseUntil) st.phase = "running";
    return;
  }
  if (st.phase === "draft" && st.draft) {
    const idx = input?.draftIndex;
    if (idx !== undefined && Number.isInteger(idx) && idx >= 0 && idx < st.draft.options.length) {
      const o = st.draft.options[idx] as DraftOption;
      if (o.kind === "keystone") {
        st.pendingKeystone = o.id;
        st.phase = "keystone-confirm";
      } else applyOption(c, st, o);
    }
    if ((st.phase as RunPhase) === "running" && st.pendingDrafts.length > 0) openDraft(c, st);
    return;
  }
  if (st.phase === "keystone-confirm") {
    if (input?.confirm && st.pendingKeystone) applyOption(c, st, { kind: "keystone", id: st.pendingKeystone });
    else if (input?.cancel) {
      st.pendingKeystone = null;
      st.phase = "draft";
    }
    if ((st.phase as RunPhase) === "running" && st.pendingDrafts.length > 0) openDraft(c, st);
    return;
  }

  // running
  const p = st.player;
  const beforeX = p.x;
  const beforeY = p.y;
  const mx = input ? Math.max(-1000, Math.min(1000, input.moveX)) : 0;
  const my = input ? Math.max(-1000, Math.min(1000, input.moveY)) : 0;
  const len = Math.sqrt(mx * mx + my * my);
  if (len > 0) {
    const speed = playerSpeed(c, st);
    const mag = Math.min(1000, len);
    const dx = Math.trunc((mx * speed * mag) / (len * 1000));
    const dy = Math.trunc((my * speed * mag) / (len * 1000));
    if (walkable(cfg.grid, p.x + dx, p.y + dy)) {
      p.x += dx;
      p.y += dy;
    } else if (walkable(cfg.grid, p.x + dx, p.y)) p.x += dx;
    else if (walkable(cfg.grid, p.x, p.y + dy)) p.y += dy;
    p.fx = Math.trunc((mx * TRIG_SCALE) / len);
    p.fy = Math.trunc((my * TRIG_SCALE) / len);
    p.moving = true;
  } else p.moving = false;
  st.stats.distanceTravelledMm += Math.round(Math.hypot(p.x - beforeX, p.y - beforeY));

  runTimeline(c, st, cfg.grid);
  updateEnemies(c, st, cfg.grid);
  separate(c, st, cfg.grid);
  updatePlayerSkills(c, st);
  updateHazards(c, st, cfg.grid);
  processDeaths(c, st);
  collectOrbs(c, st);
  regen(c, st);
  if (p.hp * 1000 <= p.maxHp * 300) st.stats.lowHpTicks += 1;
  for (const enemy of st.enemies) {
    if (enemy.hp <= 0) continue;
    const role = balanceRole(c, enemy);
    st.stats.enemyTargetTicks[role] += 1;
    if (st.runTick < enemy.playerControlUntil) st.stats.playerControlTargetTicks[role] += 1;
  }
  st.runTick += 1;
  if (p.hp <= 0) {
    st.phase = "defeat";
    return;
  }
  if (st.phase === "running" && st.pendingDrafts.length > 0) openDraft(c, st);
}

/** Canonical state hash (events excluded; they are per-step output for renderer/audio). */
function withoutEvents(st: RunState): Omit<RunState, "events"> {
  const copy: Partial<RunState> = { ...st };
  delete copy.events;
  return copy as Omit<RunState, "events">;
}

export function runHash(st: RunState): string {
  return hashState(withoutEvents(st) as unknown as HashValue);
}

/** Checkpoints are only taken while running, so a restore never lands in a half-open draft. */
export function checkpoint(st: RunState): string | null {
  if (st.phase !== "running") return null;
  return JSON.stringify({ schemaVersion: RUN_CHECKPOINT_SCHEMA_VERSION, state: withoutEvents(st) });
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function integerRecord(value: unknown): boolean {
  return record(value) && Object.values(value).every(nonNegativeInteger);
}

function roleIntegerRecord(value: unknown): boolean {
  return record(value)
    && Object.keys(value).length === 3
    && nonNegativeInteger(value.normal)
    && nonNegativeInteger(value.elite)
    && nonNegativeInteger(value.mvp);
}

function assertCurrentCheckpointState(value: unknown): asserts value is Omit<RunState, "events"> {
  if (!record(value)) throw new Error("checkpoint state is malformed");
  if (value.phase !== "running") throw new Error("checkpoint is not in the running phase");
  if (!Array.isArray(value.enemies)) throw new Error("checkpoint enemies are malformed");
  for (const enemy of value.enemies) {
    if (!record(enemy) || !nonNegativeInteger(enemy.playerControlUntil)) throw new Error("checkpoint enemy control state is malformed");
  }
  if (!record(value.stats)) throw new Error("checkpoint stats are malformed");
  const stats = value.stats;
  const counters = [
    "firstAreaClearOfferedTick", "firstAreaClearSelectedTick", "firstAreaClearCastTick", "firstEffectiveAreaClearTick",
    "damageToMvp", "distanceTravelledMm", "minHpPermille", "lowHpTicks", "bossMaxHp",
  ];
  for (const key of counters) {
    const n = stats[key];
    const permitsSentinel = key.startsWith("firstAreaClear");
    if (!Number.isSafeInteger(n) || (permitsSentinel ? (n as number) < -1 : (n as number) < 0)) throw new Error(`checkpoint stat ${key} is malformed`);
  }
  for (const key of ["effectiveDamageBySource", "effectiveDamageTakenBySource", "mvpDamageBySource"]) {
    if (!integerRecord(stats[key])) throw new Error(`checkpoint stat ${key} is malformed`);
  }
  for (const key of ["playerControlApplications", "playerControlTargetTicks", "enemyTargetTicks"]) {
    if (!roleIntegerRecord(stats[key])) throw new Error(`checkpoint stat ${key} is malformed`);
  }
  if (stats.bossType !== null && typeof stats.bossType !== "string") throw new Error("checkpoint boss type is malformed");
}

export function restore(json: string): RunState {
  const envelope = JSON.parse(json) as unknown;
  if (!record(envelope) || envelope.schemaVersion !== RUN_CHECKPOINT_SCHEMA_VERSION) {
    throw new Error(`unsupported run checkpoint schema version; expected ${RUN_CHECKPOINT_SCHEMA_VERSION}`);
  }
  assertCurrentCheckpointState(envelope.state);
  return { ...envelope.state, events: [] };
}
