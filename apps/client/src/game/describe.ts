import { skillValue, type DraftOption, type RunContent, type RunState } from "@ro-survivor/core-sim";

const DRAFT_NAME: Readonly<Record<string, string>> = {
  "skill.sw.basic_slash": "普通斬擊",
  "skill.sw.bash": "狂擊",
  "skill.sw.magnum_break": "怒爆",
  "skill.sw.endure": "霸體",
  "skill.sw.provoke": "挑釁",
  "skill.sw.shield_wave": "盾擊波",
  "skill.sw.fatal_blow": "致命一擊",
  "skill.sw.auto_berserk": "狂暴狀態",
  "passive.sw.sword_mastery": "單手劍使用熟練度",
  "passive.sw.twohand_mastery": "雙手劍使用熟練度",
  "passive.sw.hp_recovery": "HP 回復力向上",
  "passive.sw.moving_recovery": "移動時 HP 回復",
  "keystone.guardian": "守護流派",
  "keystone.weapon": "武器大師流派",
  "keystone.fury": "狂怒流派",
};

const EFFECT_LABEL: Readonly<Record<string, string>> = {
  shieldWaveCooldownPermille: "盾擊波冷卻",
  endureDamageReductionDeltaPermille: "霸體額外減傷",
  counterOnBlockDamage: "格擋反擊傷害",
  movePermille: "移動速度",
  twoHandEnabled: "啟用雙手劍",
  eliteDamagePermille: "對菁英傷害",
  frontArcRangePermille: "前方攻擊範圍",
  shieldSkillsDisabled: "停用盾牌技能",
  magnumRadiusPermille: "怒爆半徑",
  magnumCooldownPermille: "怒爆冷卻",
  bossDamagePermille: "對首領傷害",
  basicHitLimitBonus: "普攻額外目標",
  allDamagePermille: "所有傷害",
};

const CENTI_EFFECT_KEYS = new Set(["counterOnBlockDamage"]);
const PERCENT_DELTA_EFFECT_KEYS = new Set(["endureDamageReductionDeltaPermille"]);
const INTEGER_BONUS_EFFECT_KEYS = new Set(["basicHitLimitBonus"]);

/** Player-facing Traditional Chinese label; unknown future IDs remain explicit rather than guessed. */
export function draftDisplayName(id: string): string {
  return DRAFT_NAME[id] ?? id;
}

function effectDisplayValue(key: string, value: unknown): string {
  if (typeof value === "boolean") return value ? "是" : "否";
  if (typeof value !== "number") return String(value);
  if (PERCENT_DELTA_EFFECT_KEYS.has(key)) return `${value >= 0 ? "+" : ""}${(value / 10).toFixed(0)}%`;
  if (key.endsWith("Permille")) return `×${(value / 1000).toFixed(2)}`;
  if (CENTI_EFFECT_KEYS.has(key)) return (value / 100).toFixed(0);
  if (INTEGER_BONUS_EFFECT_KEYS.has(key)) return `${value >= 0 ? "+" : ""}${value}`;
  return String(value);
}

/** Tooltip lines computed from the same content data the simulation uses (old → new values). */
export function describeOption(c: RunContent, st: RunState, o: DraftOption): { title: string; lines: string[] } {
  const p = st.player;
  const fmtS = (ticks: number): string => `${(ticks / 60).toFixed(2)}s`;
  const fmtHp = (centi: number): string => `${(centi / 100).toFixed(0)}`;
  if (o.kind === "keystone") {
    const e = c.keystones[o.id]?.effects ?? {};
    return { title: draftDisplayName(o.id), lines: Object.entries(e).map(([k, v]) => `${EFFECT_LABEL[k] ?? k}：${effectDisplayValue(k, v)}`).concat(["需再次確認，且只能選一個流派"]) };
  }
  if (o.kind === "heal") return { title: "回復", lines: ["回復 30% 最大 HP"] };
  if (o.kind === "new-passive" || o.kind === "rank-passive") {
    const d = c.passives[o.id];
    const rank = p.passive.find((x) => x.id === o.id)?.rank ?? 0;
    const lines: string[] = [`等級 ${rank} → ${rank + 1}`];
    if (d?.perRank.physicalDamagePermille) lines.push(`物理傷害 +${(d.perRank.physicalDamagePermille * rank) / 10}% → +${(d.perRank.physicalDamagePermille * (rank + 1)) / 10}%`);
    if (d?.perRank.maxHpPermille) lines.push(`最大 HP +${(d.perRank.maxHpPermille * rank) / 10}% → +${(d.perRank.maxHpPermille * (rank + 1)) / 10}%`);
    if (d?.perRank.attackIntervalPermille) lines.push(`普攻間隔 ${(d.perRank.attackIntervalPermille * rank) / 10}% → ${(d.perRank.attackIntervalPermille * (rank + 1)) / 10}%`);
    if (d?.lowHp) lines.push(`HP ≤ ${d.lowHp.thresholdPermille / 10}% 時傷害 ×${d.lowHp.damagePermille / 1000}`);
    if (d?.movingRecoveryPermille) lines.push(`移動中回復 ×${d.movingRecoveryPermille / 1000}`);
    return { title: draftDisplayName(o.id), lines };
  }
  const s = c.skills[o.id];
  if (!s) return { title: o.id, lines: [] };
  const rank = o.kind === "rank-basic" ? p.basicRank : (p.active.find((a) => a.id === o.id)?.rank ?? 0);
  const next = skillValue(c, s, Math.max(1, rank + 1), p.keystone);
  const cur = rank > 0 ? skillValue(c, s, rank, p.keystone) : null;
  const pair = (label: string, a: string | null, b: string): string => (a === null || a === b ? `${label} ${b}` : `${label} ${a} → ${b}`);
  const lines = [`等級 ${rank} → ${rank + 1}`, pair("傷害", cur ? fmtHp(cur.damage) : null, fmtHp(next.damage)), pair("冷卻", cur ? fmtS(cur.cooldown) : null, fmtS(next.cooldown))];
  if (next.geometry?.shape === "circle") lines.push(pair("半徑", cur?.geometry?.shape === "circle" ? `${cur.geometry.radiusMm / 1000}m` : null, `${next.geometry.radiusMm / 1000}m`));
  else if (next.geometry) lines.push(pair("距離", cur?.geometry && cur.geometry.shape !== "circle" ? `${cur.geometry.rangeMm / 1000}m` : null, `${next.geometry.rangeMm / 1000}m`));
  if (next.hitLimit > 1) lines.push(pair("目標數", cur ? String(cur.hitLimit) : null, String(next.hitLimit)));
  lines.push("自動施放，不會移動角色");
  lines.push(s.designOrigin === "original-survivor-adaptation" ? "本作原創同人倖存者技能" : "RO 名稱／圖示；效果為本作同人倖存者改編");
  return { title: draftDisplayName(s.id), lines };
}
