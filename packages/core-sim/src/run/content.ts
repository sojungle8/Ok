/**
 * Runtime content in simulation units: time in ticks (60 Hz), distance in mm, HP and damage in
 * centi-HP (×100), multipliers and chances in per-mille (×1000). Produced by
 * @ro-survivor/content-schema `compileSliceContent()` from the versioned content seed.
 */
export type Geometry =
  | { shape: "sector"; rangeMm: number; halfAngleDeg: number }
  | { shape: "circle"; radiusMm: number }
  | { shape: "capsule"; rangeMm: number; radiusMm: number };

export type SkillTrigger =
  | "automatic-nearest-in-range"
  | "automatic-enemy-count-threshold"
  | "automatic-on-damage-window"
  | "automatic-nearby-elite-priority"
  | "automatic-highest-density-sector"
  | "automatic-elite-priority";

export interface SkillDef {
  id: string;
  kind: "built-in" | "active";
  tags: string[];
  requiresTags: string[];
  trigger: SkillTrigger | "automatic-basic";
  cooldownTicks: number;
  castTicks: number;
  geometry: Geometry | null;
  damage: number;
  hitLimit: number;
  minimumTargets: number;
  stun: { chancePermille: number; ticks: number } | null;
  durationTicks: number;
  /** Buff / debuff effects in per-mille. */
  effects: {
    damageReductionPermille?: number;
    enemyArmorDeltaPermille?: number;
    enemyMovePermille?: number;
    eliteDamagePermille?: number;
  };
  maxRank: number;
  /** Per-rank deltas (rank 1 = base). */
  perRank: {
    damage?: number;
    radiusMm?: number;
    rangeMm?: number;
    cooldownTicks?: number;
    castTicks?: number;
    durationTicks?: number;
    stunChancePermille?: number;
    damageReductionPermille?: number;
    enemyArmorDeltaPermille?: number;
    damageMultiplierPermille?: readonly number[];
    hitLimit?: readonly number[];
    rank3HitLimit?: number;
  };
  movesPlayer: false;
}

export interface PassiveDef {
  id: string;
  requiresTags: string[];
  maxRank: number;
  tags: string[];
  perRank: {
    physicalDamagePermille?: number;
    basicArcDeg?: number;
    attackIntervalPermille?: number;
    maxHpPermille?: number;
    /** centi-HP regenerated per second per rank, as per-mille of max HP ×1000 (per-million). */
    healPerSecondPpm?: number;
  };
  combatHealCapPerSecond?: number;
  movingRecoveryPermille?: number;
  lowHp?: { thresholdPermille: number; damagePermille: number; movePermille: number; incomingPermille: number };
  disablesShieldSkills?: boolean;
}

export interface KeystoneDef {
  id: string;
  effects: {
    shieldWaveCooldownPermille?: number;
    endureDamageReductionDeltaPermille?: number;
    counterOnBlockDamage?: number;
    movePermille?: number;
    twoHandEnabled?: boolean;
    eliteDamagePermille?: number;
    frontArcRangePermille?: number;
    shieldSkillsDisabled?: boolean;
    magnumRadiusPermille?: number;
    magnumCooldownPermille?: number;
    bossDamagePermille?: number;
    /** Extra targets per basic slash (tuning layer). */
    basicHitLimitBonus?: number;
    /** Damage multiplier against every target (tuning layer). */
    allDamagePermille?: number;
  };
}

export type MonsterRole = "normal" | "normal-ranged" | "normal-charger" | "normal-poison" | "elite" | "miniboss" | "mvp";

export interface BossAttackDef {
  id: string;
  kind: "hop-slam" | "summon" | "bounce-ring" | "harden" | "sound-cone" | "sidestep" | "elite-hop" | "poison-ring";
  cooldownTicks: number;
  telegraphTicks: number;
  geometry: Geometry | null;
  damage: number;
  count: number;
  spawnId: string | null;
  projectileSpeedMmPerTick: number;
  safeGapCount: number;
  hpThresholdsPermille: number[];
  durationTicks: number;
  damageReductionPermille: number;
  rearArcPermille: number;
  distanceMm: number;
}

export interface MonsterDef {
  id: string;
  role: MonsterRole;
  assetRef: string;
  hp: number;
  speedMmPerTick: number;
  contactDamage: number;
  xp: number;
  radiusMm: number;
  projectile: { damage: number; speedMmPerTick: number; cooldownTicks: number; rangeMm: number } | null;
  charge: { telegraphTicks: number; speedMmPerTick: number; damage: number; cooldownTicks: number; durationTicks: number } | null;
  pool: { radiusMm: number; damagePerSecond: number; durationTicks: number } | null;
  attacks: BossAttackDef[];
  enrage: { atTick: number; cooldownPermille: number; movePermille: number } | null;
}

export type TimelineEntry =
  | { kind: "wave"; fromTick: number; toTick: number; spawnEveryTicks: number; pool: string[] }
  | { kind: "spawn"; atTick: number; entity: string; reward: "chest" | "keystone" | null; normalWavePermille: number }
  | { kind: "boss-warning"; atTick: number; magnetPermille: number }
  | { kind: "boss-enrage"; atTick: number };

/** Fixed test equipment (Phase 2.7): flat modifiers, no random affixes. */
export interface ItemDef {
  id: string;
  slot: "weapon" | "shield" | "armor" | "garment" | "shoes" | "headgear" | "accessory";
  nameKey: string;
  damagePermille: number;
  maxHp: number;
  armorPermille: number;
  movePermille: number;
  regenPerSecond: number;
  pickupPermille: number;
}

export interface RunContent {
  contentVersion: string;
  player: {
    maxHp: number;
    speedMmPerTick: number;
    armorPermille: number;
    pickupRadiusMm: number;
    radiusMm: number;
    basicSkillId: string;
    activeSlots: number;
    passiveSlots: number;
    keystoneLimit: number;
    guaranteedEarly: { beforeTick: number; oneOf: string[] };
  };
  skills: Record<string, SkillDef>;
  passives: Record<string, PassiveDef>;
  keystones: Record<string, KeystoneDef>;
  monsters: Record<string, MonsterDef>;
  items: Record<string, ItemDef>;
  /** Loadout used by acceptance runs ("standard difficulty with fixed test equipment"). */
  standardLoadout: string[];
  /** Per-build fixed loadouts (the weapon build fights with the two-handed test sword). */
  buildLoadouts: Record<string, string[]>;
  timeline: TimelineEntry[];
  progression: {
    /** xpToNext[level] for level = 1..maxLevel-1. */
    xpToNext: number[];
    maxLevel: number;
    choiceCount: number;
    maxGroundXpObjects: number;
    xpMergeRadiusMm: number;
    pityNewActive: number;
    pityDefense: number;
    keystoneOfferLevels: number[];
    /** Heal on level-up, per-mille of max HP (tuning layer, not in the seed). */
    levelUpHealPermille: number;
    /** Ticks between contact hits from the same enemy, and player hit-grace after any contact hit. */
    contactIntervalTicks: number;
    contactGraceTicks: number;
  };
  bossSpawnTick: number;
  enrageTick: number;
}
