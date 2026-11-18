import { z } from "zod";
import {
  SKILL_TRIGGERS,
  type BossAttackDef, type Geometry, type ItemDef, type KeystoneDef, type MonsterDef, type MonsterRole, type PassiveDef,
  type RunContent, type SkillDef, type TimelineEntry,
} from "@ro-survivor/core-sim";

/**
 * Schema for docs/product-plan/handoff/vertical-slice-content-seed.json. `source*` fields are name /
 * asset references only; every runtime number is an original-design hypothesis (seed.status).
 */
const geometrySchema = z.object({
  shape: z.enum(["sector", "circle", "capsule"]),
  rangeMeters: z.number().positive().optional(),
  radiusMeters: z.number().positive().optional(),
  angleDegrees: z.number().positive().max(360).optional(),
});

const skillSchema = z.object({
  id: z.string().regex(/^skill\./u),
  sourceSkill: z.object({
    id: z.number().int().positive().nullable(),
    constant: z.string().min(1),
    maxLevel: z.number().int().positive(),
    quest: z.boolean().optional(),
  }),
  kind: z.enum(["built-in", "active", "passive"]),
  tags: z.array(z.string()),
  requiresTags: z.array(z.string()).optional(),
  trigger: z.enum(SKILL_TRIGGERS).optional(),
  cooldownMs: z.number().nonnegative().optional(),
  castMs: z.number().nonnegative().optional(),
  durationMs: z.number().nonnegative().optional(),
  geometry: geometrySchema.optional(),
  baseDamage: z.number().nonnegative().optional(),
  hitLimit: z.number().int().positive().optional(),
  minimumTargets: z.number().int().positive().optional(),
  status: z.object({ type: z.literal("stun"), chance: z.number().min(0).max(1), durationMs: z.number().positive() }).optional(),
  effects: z.record(z.string(), z.union([z.number(), z.boolean()])).optional(),
  eliteDamageMultiplier: z.number().optional(),
  movesPlayer: z.literal(false).optional(),
  condition: z.object({ hpRatioAtOrBelow: z.number() }).optional(),
  maxRank: z.number().int().positive().optional(),
  rankDelta: z.record(z.string(), z.number()).optional(),
  levelCurve: z.array(z.object({ rank: z.number().int(), damageMultiplier: z.number(), hitLimit: z.number().int() })).optional(),
});

const monsterSchema = z.object({
  runtimeId: z.string(),
  role: z.enum(["normal", "normal-ranged", "normal-charger", "normal-poison", "elite", "miniboss", "mvp"]),
  assetRef: z.string().regex(/^monster\.\d+$/u),
  hp: z.number().positive().optional(),
  move: z.number().positive().optional(),
  contactDamage: z.number().nonnegative().optional(),
  xp: z.number().nonnegative().optional(),
  baseRuntimeId: z.string().optional(),
  multipliers: z.object({ hp: z.number(), damage: z.number(), size: z.number(), move: z.number(), xp: z.number() }).optional(),
  mechanic: z.string().optional(),
  projectile: z.object({ damage: z.number(), speed: z.number(), cooldownMs: z.number() }).optional(),
  charge: z.object({ telegraphMs: z.number(), speed: z.number(), damage: z.number(), cooldownMs: z.number() }).optional(),
  pool: z.object({ radius: z.number(), damagePerSecond: z.number(), durationMs: z.number() }).optional(),
  attacks: z.array(z.record(z.string(), z.unknown())).optional(),
  enrage: z.object({ atTick: z.number().int(), cooldownMultiplier: z.number(), moveMultiplier: z.number() }).optional(),
});

const timelineSchema = z.union([
  z.object({ fromSecond: z.number(), toSecond: z.number(), spawnPerSecond: z.number().positive(), pool: z.array(z.string()).min(1) }),
  z.object({ atSecond: z.number(), event: z.enum(["spawn", "boss-warning", "boss-enrage"]) }).passthrough(),
]);

export const sliceSeedSchema = z.object({
  schemaVersion: z.literal(1),
  contentVersion: z.string(),
  rules: z.object({ simulationHz: z.literal(60), durationTicks: z.number().int(), bossEnrageTick: z.number().int() }).passthrough(),
  job: z.object({
    runtimeId: z.string(),
    baseStats: z.object({ maxHp: z.number(), moveMetersPerSecond: z.number(), armorReduction: z.number(), pickupRadiusMeters: z.number(), baseAttackIntervalMs: z.number() }).passthrough(),
    slotRules: z.object({ activeSlots: z.number().int(), passiveSlots: z.number().int(), keystoneLimit: z.number().int() }).passthrough(),
    startingSkillIds: z.array(z.string()).length(1),
    guaranteedEarlyOffer: z.object({ beforeElapsedSeconds: z.number(), oneOf: z.array(z.string()).min(1) }),
  }).passthrough(),
  skills: z.array(skillSchema),
  passives: z.array(z.object({ id: z.string(), maxRank: z.number().int(), requiresTags: z.array(z.string()).optional(), perRank: z.record(z.string(), z.number()).optional(), effect: z.record(z.string(), z.union([z.number(), z.boolean()])).optional(), tradeoff: z.record(z.string(), z.boolean()).optional(), combatHealCapPerSecond: z.number().optional() }).passthrough()),
  keystones: z.array(z.object({ id: z.string(), effects: z.record(z.string(), z.union([z.number(), z.boolean()])), confirmationRequired: z.literal(true) }).passthrough()),
  monsters: z.array(monsterSchema),
  stage: z.object({ id: z.string(), timeline: z.array(timelineSchema) }).passthrough(),
  progression: z.object({
    xpCurve: z.object({ level2: z.number().int(), growthMultiplier: z.number(), flatPerLevel: z.number().int(), maxRunLevel: z.number().int() }),
    choiceCount: z.number().int(),
    maxGroundXpObjects: z.number().int(),
    xpMergeRadiusMeters: z.number(),
    pity: z.object({ maxLevelsWithoutNewActiveOffer: z.number().int(), maxLevelsWithoutDefenseOffer: z.number().int() }),
  }).passthrough(),
}).passthrough();
export type SliceSeed = z.infer<typeof sliceSeedSchema>;

/**
 * Balance tuning layered on top of the seed (the seed file itself is never edited). Every entry is a
 * hypothesis with a reason; reports/vertical-slice-acceptance.md records the measured effect.
 */
export const SLICE_TUNING = {
  /**
   * T-01: sustain. Without regen the seed's chip damage killed every bot build by 4:50.
   * 15% left guardian/weapon at 4–6/10 wins per input device; 30% gives ≥ 7/10 for every build and device.
   */
  levelUpHealPermille: 300,
  /** T-02: keystone drafts at these run levels (the Vocal reward adds one more offer). */
  keystoneOfferLevels: [6, 12],
  /** T-03: contact damage per enemy at most once per second (seed gives per-touch damage only). */
  contactIntervalTicks: 60,
  /** T-04: 0.2 s grace after any contact hit so a swarm cannot stack every frame. */
  contactGraceTicks: 12,
  /** T-09: readability: at most 6 ranged enemies (nearest first) fire at once; 6–8 min losses were volley stacks. */
  maxRangedShooters: 6,
  /** T-05: Poporing's identity is the poison pool; it was also the top contact-damage killer in every losing run. */
  monsterOverrides: { "monster.poporing": { hp: 75, contactDamage: 7 } } as Record<string, { hp?: number; contactDamage?: number }>,
  /**
   * T-06 / T-07: the weapon keystone (two-handed) cleaves (+3 basic-slash targets) and hits harder
   * (×1.2 on every target; the seed's ×1.25 applies to elites only). Without them the build won 0–1/10 seeds.
   */
  keystoneOverrides: { "keystone.weapon": { basicHitLimitBonus: 3, allDamagePermille: 1200 } } as Record<string, { basicHitLimitBonus?: number; allDamagePermille?: number }>,
} as const;

/**
 * Ten fixed test items (Phase 2.7). Original test data — not RO item stats. `nameKey`s are
 * localisation keys; no item art is involved.
 */
export const TEST_EQUIPMENT: ItemDef[] = [
  { id: "equip.test.sword", slot: "weapon", nameKey: "equip.test.sword", damagePermille: 150, maxHp: 0, armorPermille: 0, movePermille: 0, regenPerSecond: 0, pickupPermille: 0 },
  // T-08: same HP budget as sword + guard; the two-hander trades the guard's armor for damage.
  { id: "equip.test.two_hand", slot: "weapon", nameKey: "equip.test.two_hand", damagePermille: 250, maxHp: 2000, armorPermille: 0, movePermille: 0, regenPerSecond: 0, pickupPermille: 0 },
  { id: "equip.test.guard", slot: "shield", nameKey: "equip.test.guard", damagePermille: 0, maxHp: 2000, armorPermille: 60, movePermille: 0, regenPerSecond: 0, pickupPermille: 0 },
  { id: "equip.test.shirt", slot: "armor", nameKey: "equip.test.shirt", damagePermille: 0, maxHp: 4000, armorPermille: 40, movePermille: 0, regenPerSecond: 0, pickupPermille: 0 },
  { id: "equip.test.hood", slot: "garment", nameKey: "equip.test.hood", damagePermille: 0, maxHp: 1500, armorPermille: 30, movePermille: 0, regenPerSecond: 0, pickupPermille: 0 },
  { id: "equip.test.sandals", slot: "shoes", nameKey: "equip.test.sandals", damagePermille: 0, maxHp: 1000, armorPermille: 0, movePermille: 60, regenPerSecond: 0, pickupPermille: 0 },
  { id: "equip.test.bandana", slot: "headgear", nameKey: "equip.test.bandana", damagePermille: 0, maxHp: 1500, armorPermille: 20, movePermille: 0, regenPerSecond: 0, pickupPermille: 0 },
  { id: "equip.test.clip", slot: "accessory", nameKey: "equip.test.clip", damagePermille: 0, maxHp: 0, armorPermille: 0, movePermille: 0, regenPerSecond: 60, pickupPermille: 0 },
  { id: "equip.test.ring", slot: "accessory", nameKey: "equip.test.ring", damagePermille: 80, maxHp: 0, armorPermille: 0, movePermille: 0, regenPerSecond: 0, pickupPermille: 0 },
  { id: "equip.test.glove", slot: "accessory", nameKey: "equip.test.glove", damagePermille: 0, maxHp: 0, armorPermille: 0, movePermille: 0, regenPerSecond: 0, pickupPermille: 400 },
];
export const STANDARD_TEST_LOADOUT = ["equip.test.sword", "equip.test.guard", "equip.test.shirt", "equip.test.hood", "equip.test.sandals", "equip.test.bandana", "equip.test.clip", "equip.test.ring"];
export const BUILD_TEST_LOADOUTS: Record<string, string[]> = {
  guardian: STANDARD_TEST_LOADOUT,
  fury: STANDARD_TEST_LOADOUT,
  weapon: ["equip.test.two_hand", "equip.test.shirt", "equip.test.hood", "equip.test.sandals", "equip.test.bandana", "equip.test.clip", "equip.test.ring"],
};

const HZ = 60;
const ticks = (ms: number): number => Math.round((ms * HZ) / 1000);
const mm = (m: number): number => Math.round(m * 1000);
const mmPerTick = (mps: number): number => Math.round((mps * 1000) / HZ);
const centi = (hp: number): number => Math.round(hp * 100);
const permille = (x: number): number => Math.round(x * 1000);

function geometry(g: z.infer<typeof geometrySchema> | undefined): Geometry | null {
  if (!g) return null;
  if (g.shape === "circle") return { shape: "circle", radiusMm: mm(g.radiusMeters ?? 1) };
  if (g.shape === "capsule") return { shape: "capsule", rangeMm: mm(g.rangeMeters ?? 1), radiusMm: mm(g.radiusMeters ?? 0.5) };
  return { shape: "sector", rangeMm: mm(g.rangeMeters ?? 1), halfAngleDeg: Math.round((g.angleDegrees ?? 90) / 2) };
}

const num = (r: Record<string, number | boolean> | undefined, k: string): number | undefined => (typeof r?.[k] === "number" ? r[k] : undefined);

/** Compile the validated seed into integer runtime content. Pure and deterministic. */
export function compileSliceContent(raw: unknown): RunContent {
  const seed = sliceSeedSchema.parse(raw);
  const skills: Record<string, SkillDef> = {};
  const passives: Record<string, PassiveDef> = {};
  for (const s of seed.skills) {
    if (s.kind === "passive") {
      const e = s.effects ?? {};
      passives[s.id] = {
        id: s.id, requiresTags: s.requiresTags ?? [], maxRank: s.maxRank ?? 1, tags: s.tags, perRank: {},
        lowHp: { thresholdPermille: permille(s.condition?.hpRatioAtOrBelow ?? 0.3), damagePermille: permille(num(e, "damageMultiplier") ?? 1), movePermille: permille(num(e, "moveMultiplier") ?? 1), incomingPermille: permille(num(e, "incomingDamageMultiplier") ?? 1) },
      };
      continue;
    }
    const rd = s.rankDelta ?? {};
    const effects: SkillDef["effects"] = {};
    const e = s.effects ?? {};
    if (num(e, "damageReduction") !== undefined) effects.damageReductionPermille = permille(num(e, "damageReduction") as number);
    if (num(e, "enemyArmorDelta") !== undefined) effects.enemyArmorDeltaPermille = permille(num(e, "enemyArmorDelta") as number);
    if (num(e, "enemyMoveMultiplier") !== undefined) effects.enemyMovePermille = permille(num(e, "enemyMoveMultiplier") as number);
    if (s.eliteDamageMultiplier !== undefined) effects.eliteDamagePermille = permille(s.eliteDamageMultiplier);
    const perRank: SkillDef["perRank"] = {};
    if (rd.damage !== undefined) perRank.damage = centi(rd.damage);
    if (rd.radiusMeters !== undefined) perRank.radiusMm = mm(rd.radiusMeters);
    if (rd.rangeMeters !== undefined) perRank.rangeMm = mm(rd.rangeMeters);
    if (rd.cooldownMs !== undefined) perRank.cooldownTicks = ticks(rd.cooldownMs);
    if (rd.castMs !== undefined) perRank.castTicks = ticks(rd.castMs);
    if (rd.durationMs !== undefined) perRank.durationTicks = ticks(rd.durationMs);
    if (rd.stunChance !== undefined) perRank.stunChancePermille = permille(rd.stunChance);
    if (rd.damageReduction !== undefined) perRank.damageReductionPermille = permille(rd.damageReduction);
    if (rd.enemyArmorDelta !== undefined) perRank.enemyArmorDeltaPermille = permille(rd.enemyArmorDelta);
    if (rd.rank3HitLimit !== undefined) perRank.rank3HitLimit = rd.rank3HitLimit;
    if (s.levelCurve) {
      perRank.damageMultiplierPermille = s.levelCurve.map((l) => permille(l.damageMultiplier));
      perRank.hitLimit = s.levelCurve.map((l) => l.hitLimit);
    }
    skills[s.id] = {
      id: s.id,
      designOrigin: s.sourceSkill.constant === "ORIGINAL_SURVIVOR_ADAPTATION" ? "original-survivor-adaptation" : "official-name-adapted",
      fanGameAdaptation: true,
      officialSource: s.sourceSkill.id === null ? null : { id: s.sourceSkill.id, constant: s.sourceSkill.constant },
      kind: s.kind === "built-in" ? "built-in" : "active",
      tags: s.tags,
      requiresTags: s.requiresTags ?? [],
      trigger: s.kind === "built-in" ? "automatic-basic" : (s.trigger ?? "automatic-nearest-in-range"),
      cooldownTicks: ticks(s.cooldownMs ?? 1000),
      castTicks: ticks(s.castMs ?? 0),
      geometry: geometry(s.geometry),
      damage: centi(s.baseDamage ?? 0),
      hitLimit: s.hitLimit ?? 1,
      minimumTargets: s.minimumTargets ?? (s.trigger === "automatic-highest-density-sector" ? 3 : 1),
      stun: s.status ? { chancePermille: permille(s.status.chance), ticks: ticks(s.status.durationMs) } : null,
      durationTicks: ticks(s.durationMs ?? num(e, "durationMs") ?? 0),
      effects,
      maxRank: s.levelCurve ? s.levelCurve.length : (rd.maxRank ?? s.maxRank ?? 1),
      perRank,
      movesPlayer: false,
    };
  }
  for (const p of seed.passives) {
    const r = p.perRank ?? {};
    const def: PassiveDef = { id: p.id, requiresTags: p.requiresTags ?? [], maxRank: p.maxRank, tags: [], perRank: {} };
    if (r.physicalDamageMultiplier !== undefined) def.perRank.physicalDamagePermille = permille(r.physicalDamageMultiplier);
    if (r.basicArcDegrees !== undefined) def.perRank.basicArcDeg = r.basicArcDegrees;
    if (r.attackIntervalMultiplier !== undefined) def.perRank.attackIntervalPermille = permille(r.attackIntervalMultiplier);
    if (r.maxHpMultiplier !== undefined) def.perRank.maxHpPermille = permille(r.maxHpMultiplier);
    if (r.healPerSecondMaxHp !== undefined) def.perRank.healPerSecondPpm = Math.round(r.healPerSecondMaxHp * 1_000_000);
    if (p.combatHealCapPerSecond !== undefined) def.combatHealCapPerSecond = centi(p.combatHealCapPerSecond);
    if (typeof p.effect?.healMultiplier === "number") def.movingRecoveryPermille = permille(p.effect.healMultiplier);
    if (p.tradeoff?.shieldSkillsDisabled) def.disablesShieldSkills = true;
    if (def.perRank.maxHpPermille !== undefined || def.perRank.healPerSecondPpm !== undefined || def.movingRecoveryPermille !== undefined) def.tags.push("defense");
    passives[p.id] = def;
  }
  const keystones: Record<string, KeystoneDef> = {};
  for (const k of seed.keystones) {
    const e = k.effects;
    const out: KeystoneDef["effects"] = {};
    if (num(e, "shieldWaveCooldownMultiplier") !== undefined) out.shieldWaveCooldownPermille = permille(num(e, "shieldWaveCooldownMultiplier") as number);
    if (num(e, "endureDamageReductionDelta") !== undefined) out.endureDamageReductionDeltaPermille = permille(num(e, "endureDamageReductionDelta") as number);
    if (num(e, "counterOnBlockDamage") !== undefined) out.counterOnBlockDamage = centi(num(e, "counterOnBlockDamage") as number);
    if (num(e, "moveMultiplier") !== undefined) out.movePermille = permille(num(e, "moveMultiplier") as number);
    if (e.twoHandEnabled === true) out.twoHandEnabled = true;
    if (num(e, "eliteDamageMultiplier") !== undefined) out.eliteDamagePermille = permille(num(e, "eliteDamageMultiplier") as number);
    if (num(e, "frontArcRangeMultiplier") !== undefined) out.frontArcRangePermille = permille(num(e, "frontArcRangeMultiplier") as number);
    if (e.shieldSkillsDisabled === true) out.shieldSkillsDisabled = true;
    if (num(e, "magnumRadiusMultiplier") !== undefined) out.magnumRadiusPermille = permille(num(e, "magnumRadiusMultiplier") as number);
    if (num(e, "magnumCooldownMultiplier") !== undefined) out.magnumCooldownPermille = permille(num(e, "magnumCooldownMultiplier") as number);
    if (num(e, "bossDamageMultiplier") !== undefined) out.bossDamagePermille = permille(num(e, "bossDamageMultiplier") as number);
    const ko = SLICE_TUNING.keystoneOverrides[k.id];
    if (ko?.basicHitLimitBonus) out.basicHitLimitBonus = ko.basicHitLimitBonus;
    if (ko?.allDamagePermille) out.allDamagePermille = ko.allDamagePermille;
    keystones[k.id] = { id: k.id, effects: out };
  }

  const monsters: Record<string, MonsterDef> = {};
  const radiusFor = (role: MonsterRole): number => (role === "mvp" ? 1100 : role === "miniboss" ? 750 : 400);
  const attack = (a: Partial<BossAttackDef> & Pick<BossAttackDef, "id" | "kind">): BossAttackDef => ({
    cooldownTicks: 600, telegraphTicks: 0, geometry: null, damage: 0, count: 0, spawnId: null, projectileSpeedMmPerTick: 0, safeGapCount: 0,
    hpThresholdsPermille: [], durationTicks: 0, damageReductionPermille: 0, rearArcPermille: 1000, distanceMm: 0, ...a,
  });
  const base = new Map(
    seed.monsters.map((m) => {
      const o = SLICE_TUNING.monsterOverrides[m.runtimeId];
      return [m.runtimeId, o ? { ...m, ...o } : m];
    }),
  );
  for (const raw of seed.monsters) {
    const m = base.get(raw.runtimeId) ?? raw;
    const src = m.baseRuntimeId ? base.get(m.baseRuntimeId) : m;
    if (!src) throw new Error(`${m.runtimeId}: unknown base ${m.baseRuntimeId ?? ""}`);
    const mul = m.multipliers ?? { hp: 1, damage: 1, size: 1, move: 1, xp: 1 };
    const contact = (src.contactDamage ?? 0) * mul.damage;
    const attacks: BossAttackDef[] = [];
    for (const raw of m.attacks ?? []) {
      const a = raw as Record<string, number | string | number[] | undefined>;
      const id = String(a.id);
      const cd = ticks(Number(a.cooldownMs ?? 6000));
      const tg = ticks(Number(a.telegraphMs ?? 0));
      if (id === "hop-slam") attacks.push(attack({ id, kind: "hop-slam", cooldownTicks: cd, telegraphTicks: tg, geometry: { shape: "circle", radiusMm: mm(Number(a.radiusMeters)) }, damage: centi(Number(a.damage)) }));
      else if (id === "summon-porings") attacks.push(attack({ id, kind: "summon", cooldownTicks: cd, count: Number(a.count), spawnId: String(a.spawnRuntimeId) }));
      else if (id === "bounce-ring") attacks.push(attack({ id, kind: "bounce-ring", cooldownTicks: cd, telegraphTicks: 45, count: Number(a.projectiles), safeGapCount: Number(a.safeGapCount), projectileSpeedMmPerTick: mmPerTick(Number(a.speed)), damage: centi(Number(a.damage)) }));
      else if (id === "harden") attacks.push(attack({ id, kind: "harden", cooldownTicks: 0, hpThresholdsPermille: (a.hpThresholds as number[]).map(permille), durationTicks: ticks(Number(a.durationMs)), damageReductionPermille: permille(Number(a.damageReduction)), rearArcPermille: permille(Number(a.rearArcDamageMultiplier)) }));
      else if (id === "sound-cone") attacks.push(attack({ id, kind: "sound-cone", cooldownTicks: cd, telegraphTicks: tg, geometry: { shape: "sector", rangeMm: mm(Number(a.rangeMeters)), halfAngleDeg: Math.round(Number(a.angleDegrees) / 2) }, damage: centi(Number(a.damage)) }));
      else if (id === "sidestep") attacks.push(attack({ id, kind: "sidestep", cooldownTicks: cd, distanceMm: mm(Number(a.distanceMeters)) }));
      else throw new Error(`${m.runtimeId}: unknown attack ${id}`);
    }
    // Elite mechanics are single, readable additions (04 §2.3.5); numbers are hypotheses.
    if (m.mechanic === "three telegraphed hops") attacks.push(attack({ id: "elite-hop", kind: "elite-hop", cooldownTicks: 240, telegraphTicks: 54, count: 3, geometry: { shape: "circle", radiusMm: 1500 }, damage: centi(contact) }));
    if (m.mechanic === "one expanding poison ring") attacks.push(attack({ id: "poison-ring", kind: "poison-ring", cooldownTicks: 360, telegraphTicks: 60, geometry: { shape: "circle", radiusMm: 3200 }, damage: centi(12) }));
    monsters[m.runtimeId] = {
      id: m.runtimeId,
      role: m.role,
      assetRef: m.assetRef,
      hp: centi((m.hp ?? src.hp ?? 1) * (m.baseRuntimeId ? mul.hp : 1)),
      speedMmPerTick: mmPerTick((m.move ?? src.move ?? 1) * (m.baseRuntimeId ? mul.move : 1)),
      contactDamage: centi(m.baseRuntimeId ? contact : (m.contactDamage ?? 0)),
      xp: Math.round((m.xp ?? src.xp ?? 0) * (m.baseRuntimeId ? mul.xp : 1)),
      radiusMm: Math.round(radiusFor(m.role) * mul.size),
      projectile: src.projectile ? { damage: centi(src.projectile.damage * mul.damage), speedMmPerTick: mmPerTick(src.projectile.speed), cooldownTicks: ticks(src.projectile.cooldownMs), rangeMm: 7000 } : null,
      charge: src.charge ? { telegraphTicks: ticks(src.charge.telegraphMs), speedMmPerTick: mmPerTick(src.charge.speed), damage: centi(src.charge.damage * mul.damage), cooldownTicks: ticks(src.charge.cooldownMs), durationTicks: 36 } : null,
      pool: src.pool ? { radiusMm: mm(src.pool.radius), damagePerSecond: centi(src.pool.damagePerSecond), durationTicks: ticks(src.pool.durationMs) } : null,
      attacks,
      enrage: m.enrage ? { atTick: m.enrage.atTick, cooldownPermille: permille(m.enrage.cooldownMultiplier), movePermille: permille(m.enrage.moveMultiplier) } : null,
    };
  }

  const timeline: TimelineEntry[] = [];
  let bossSpawnTick = seed.rules.durationTicks;
  for (const t of seed.stage.timeline) {
    if ("spawnPerSecond" in t) {
      const w = t as { fromSecond: number; toSecond: number; spawnPerSecond: number; pool: string[] };
      timeline.push({ kind: "wave", fromTick: w.fromSecond * HZ, toTick: w.toSecond * HZ, spawnEveryTicks: Math.max(1, Math.round(HZ / w.spawnPerSecond)), pool: w.pool });
    } else if (t.event === "spawn") {
      const entity = String((t as Record<string, unknown>).entity);
      const rewardRaw = (t as Record<string, unknown>).reward;
      const reward = typeof rewardRaw === "string" ? rewardRaw : "";
      const mult = (t as Record<string, unknown>).normalWaveMultiplier;
      if (monsters[entity]?.role === "mvp") bossSpawnTick = t.atSecond * HZ;
      timeline.push({ kind: "spawn", atTick: t.atSecond * HZ, entity, reward: reward.includes("chest") ? "chest" : reward.includes("keystone") ? "keystone" : null, normalWavePermille: typeof mult === "number" ? permille(mult) : 1000 });
    } else if (t.event === "boss-warning") {
      const mag = (t as Record<string, unknown>).pickupMagnetMultiplier;
      timeline.push({ kind: "boss-warning", atTick: t.atSecond * HZ, magnetPermille: typeof mag === "number" ? permille(mag) : 1000 });
    } else timeline.push({ kind: "boss-enrage", atTick: t.atSecond * HZ });
  }
  for (const t of timeline) {
    const ids = t.kind === "wave" ? t.pool : t.kind === "spawn" ? [t.entity] : [];
    for (const id of ids) if (!monsters[id]) throw new Error(`timeline references unknown monster ${id}`);
  }

  const c = seed.progression.xpCurve;
  const xpToNext: number[] = [0, c.level2];
  for (let lv = 2; lv < c.maxRunLevel; lv += 1) xpToNext.push(Math.round((xpToNext[lv - 1] as number) * c.growthMultiplier) + c.flatPerLevel);
  const job = seed.job;
  const basic = job.startingSkillIds[0] as string;
  if (!skills[basic]) throw new Error(`starting skill ${basic} missing`);
  for (const id of job.guaranteedEarlyOffer.oneOf) if (!skills[id]) throw new Error(`guaranteed skill ${id} missing`);
  return {
    contentVersion: seed.contentVersion,
    player: {
      maxHp: centi(job.baseStats.maxHp),
      speedMmPerTick: mmPerTick(job.baseStats.moveMetersPerSecond),
      armorPermille: permille(job.baseStats.armorReduction),
      pickupRadiusMm: mm(job.baseStats.pickupRadiusMeters),
      radiusMm: 450,
      basicSkillId: basic,
      activeSlots: job.slotRules.activeSlots,
      passiveSlots: job.slotRules.passiveSlots,
      keystoneLimit: job.slotRules.keystoneLimit,
      guaranteedEarly: { beforeTick: job.guaranteedEarlyOffer.beforeElapsedSeconds * HZ, oneOf: job.guaranteedEarlyOffer.oneOf },
    },
    skills,
    passives,
    keystones,
    monsters,
    items: Object.fromEntries(TEST_EQUIPMENT.map((i) => [i.id, i])),
    standardLoadout: [...STANDARD_TEST_LOADOUT],
    buildLoadouts: Object.fromEntries(Object.entries(BUILD_TEST_LOADOUTS).map(([k, v]) => [k, [...v]])),
    timeline,
    progression: {
      xpToNext,
      maxLevel: c.maxRunLevel,
      choiceCount: seed.progression.choiceCount,
      maxGroundXpObjects: seed.progression.maxGroundXpObjects,
      xpMergeRadiusMm: mm(seed.progression.xpMergeRadiusMeters),
      pityNewActive: seed.progression.pity.maxLevelsWithoutNewActiveOffer,
      pityDefense: seed.progression.pity.maxLevelsWithoutDefenseOffer,
      keystoneOfferLevels: [...SLICE_TUNING.keystoneOfferLevels],
      levelUpHealPermille: SLICE_TUNING.levelUpHealPermille,
      contactIntervalTicks: SLICE_TUNING.contactIntervalTicks,
      contactGraceTicks: SLICE_TUNING.contactGraceTicks,
      maxRangedShooters: SLICE_TUNING.maxRangedShooters,
    },
    bossSpawnTick,
    enrageTick: seed.rules.bossEnrageTick,
  };
}
