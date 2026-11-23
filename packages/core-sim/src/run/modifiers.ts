import type { RunContent } from "./content.ts";

/**
 * Run modifiers as pure content transforms (applied before createRun). The simulation state shape is
 * unchanged, so normal-difficulty runs keep their exact hashes and reports.
 */
export const DIFFICULTIES = ["normal", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export interface DifficultyPreset {
  enemyHpPermille: number;
  enemyDamagePermille: number;
  /** Wave spawn interval scale (< 1000 = denser). */
  spawnIntervalPermille: number;
  xpPermille: number;
}

export const DIFFICULTY_PRESETS: Readonly<Record<Difficulty, DifficultyPreset>> = {
  normal: { enemyHpPermille: 1000, enemyDamagePermille: 1000, spawnIntervalPermille: 1000, xpPermille: 1000 },
  hard: { enemyHpPermille: 1300, enemyDamagePermille: 1150, spawnIntervalPermille: 900, xpPermille: 1250 },
};

/** Account (Base) level from accumulated settled base XP: level n needs 400·n·(n+1)/2 XP, capped at 20. */
export const MAX_BASE_LEVEL = 20;
export function baseLevelFromXp(baseXp: number): number {
  let level = 0;
  while (level < MAX_BASE_LEVEL && baseXp >= (400 * (level + 1) * (level + 2)) / 2) level += 1;
  return level;
}
export function baseXpForLevel(level: number): number {
  return (400 * level * (level + 1)) / 2;
}
/** Permanent bonus per Base level: +3% max HP and +2% skill damage (capped by MAX_BASE_LEVEL). */
export function baseLevelBonus(level: number): { maxHpPermille: number; damagePermille: number } {
  const l = Math.max(0, Math.min(MAX_BASE_LEVEL, Math.trunc(level)));
  return { maxHpPermille: 1000 + 30 * l, damagePermille: 1000 + 20 * l };
}

const scale = (v: number, permille: number): number => Math.round((v * permille) / 1000);

export function applyRunModifiers(content: RunContent, opts: { difficulty?: Difficulty; baseLevel?: number } = {}): RunContent {
  const difficulty = opts.difficulty ?? "normal";
  const level = Math.max(0, Math.min(MAX_BASE_LEVEL, Math.trunc(opts.baseLevel ?? 0)));
  if (difficulty === "normal" && level === 0) return content;
  const d = DIFFICULTY_PRESETS[difficulty];
  const bonus = baseLevelBonus(level);
  const monsters = Object.fromEntries(Object.entries(content.monsters).map(([id, m]) => [id, {
    ...m,
    hp: scale(m.hp, d.enemyHpPermille),
    contactDamage: scale(m.contactDamage, d.enemyDamagePermille),
    xp: scale(m.xp, d.xpPermille),
    projectile: m.projectile ? { ...m.projectile, damage: scale(m.projectile.damage, d.enemyDamagePermille) } : null,
    charge: m.charge ? { ...m.charge, damage: scale(m.charge.damage, d.enemyDamagePermille) } : null,
    pool: m.pool ? { ...m.pool, damagePerSecond: scale(m.pool.damagePerSecond, d.enemyDamagePermille) } : null,
    attacks: m.attacks.map((a) => ({ ...a, damage: scale(a.damage, d.enemyDamagePermille) })),
  }]));
  const timeline = content.timeline.map((t) => (t.kind === "wave" ? { ...t, spawnEveryTicks: Math.max(1, scale(t.spawnEveryTicks, d.spawnIntervalPermille)) } : t));
  const skills = Object.fromEntries(Object.entries(content.skills).map(([id, s]) => [id, { ...s, damage: scale(s.damage, bonus.damagePermille) }]));
  const tags = [difficulty === "hard" ? "hard" : null, level > 0 ? `bl${level}` : null].filter(Boolean).join(".");
  return {
    ...content,
    contentVersion: `${content.contentVersion}+${tags}`,
    player: { ...content.player, maxHp: scale(content.player.maxHp, bonus.maxHpPermille) },
    skills,
    monsters,
    timeline,
  };
}
