// 微光大陸：長期養成——職業等級、技能等級、轉職、轉生（RO 風格，原創名稱與數值，純函式可測試）

// ---- 職業等級 ----
export const JOB_CAP = { 1: 50, 2: 70 };
export const jobExpNeed = (jl, tier = 1) => Math.round((20 + jl * jl * 9 + 0.12 * jl ** 3) * (tier >= 2 ? 6 : 1));
export const JOB_EXP_RATE = 0.75; // 打怪得到的職業經驗＝基本經驗 × 0.75
export function ensureJob(p) {
  if (!p.job || typeof p.job !== 'object') p.job = { tier: 1, lv: 1, exp: 0, branch: '' };
  p.job.tier = p.job.tier === 2 ? 2 : 1; p.job.lv = Math.max(1, Math.min(JOB_CAP[p.job.tier], p.job.lv | 0 || 1)); p.job.exp = Math.max(0, +p.job.exp || 0);
  if (!p.skillLv || typeof p.skillLv !== 'object') p.skillLv = {};
  p.reborn = Math.max(0, p.reborn | 0);
  return p;
}
export function gainJobExp(p, amount) {
  ensureJob(p);
  const j = p.job, cap = JOB_CAP[j.tier];
  j.exp += amount; let ups = 0;
  while (j.lv < cap && j.exp >= jobExpNeed(j.lv, j.tier)) { j.exp -= jobExpNeed(j.lv, j.tier); j.lv++; ups++; }
  if (j.lv >= cap) j.exp = 0;
  return ups;
}

// ---- 技能等級 ----
// 技能點：一轉每職業等級 1 點（職業 Lv1 先送 3 點），二轉再加二轉職業等級
export const SKILL_MAX = { 1: 10, 2: 15 };
export const skillPointsTotal = (p) => { ensureJob(p); return p.job.tier === 2 ? 2 + JOB_CAP[1] + p.job.lv : 2 + p.job.lv; };
export const skillPointsSpent = (p) => Object.values(p.skillLv || {}).reduce((s, v) => s + Math.max(0, v - 1), 0);
export const skillPointsFree = (p) => Math.max(0, skillPointsTotal(p) - skillPointsSpent(p));
export const skillLevel = (p, id) => Math.max(1, p.skillLv?.[id] || 1);
export function learnSkill(p, id) {
  ensureJob(p);
  if (skillPointsFree(p) <= 0 || skillLevel(p, id) >= SKILL_MAX[p.job.tier]) return false;
  p.skillLv[id] = skillLevel(p, id) + 1; return true;
}
export function autoLearn(p, ids) {
  ensureJob(p);
  let guard = 500;
  while (skillPointsFree(p) > 0 && guard-- > 0) {
    const id = ids.filter((x) => skillLevel(p, x) < SKILL_MAX[p.job.tier]).sort((a, b) => skillLevel(p, a) - skillLevel(p, b))[0];
    if (!id || !learnSkill(p, id)) break;
  }
}
export function resetSkills(p) { p.skillLv = {}; }
// 每級：傷害 +8%、冷卻 -1.5%
export const skillDmgMult = (lv) => 1 + 0.08 * (lv - 1);
export const skillCdMult = (lv) => 1 - 0.015 * (lv - 1);

// ---- 轉職：每個職業兩條路線 ----
export const JOB2 = {
  sword: [{ id: 'paladin', name: '聖盾騎士', desc: '生命 +15%、受到傷害 -6%', hpPct: 15, dr: 6 }, { id: 'blademaster', name: '劍聖', desc: '攻擊 +12%、暴擊率 +5%', atkPct: 12, crit: 5 }],
  archer: [{ id: 'sniper', name: '神射手', desc: '暴擊傷害 +25%、攻擊 +8%', critDmg: 25, atkPct: 8 }, { id: 'ranger', name: '風行遊俠', desc: '攻擊速度 +12%、技能傷害 +8%', aspd: 12, skill: 8 }],
  mage: [{ id: 'archmage', name: '大魔導師', desc: '技能傷害 +15%、技能冷卻 -5%', skill: 15, cdr: 5 }, { id: 'elementalist', name: '元素領主', desc: '攻擊 +10%、魂力累積 +15%', atkPct: 10, soul: 15 }],
  monk: [{ id: 'asura', name: '修羅', desc: '攻擊 +14%、攻擊速度 +5%', atkPct: 14, aspd: 5 }, { id: 'zen', name: '禪武宗師', desc: '生命 +10%、暴擊率 +6%、受到傷害 -4%', hpPct: 10, crit: 6, dr: 4 }],
  priest: [{ id: 'bishop', name: '大主教', desc: '生命 +12%、技能冷卻 -6%', hpPct: 12, cdr: 6 }, { id: 'inquisitor', name: '審判者', desc: '攻擊 +12%、技能傷害 +8%', atkPct: 12, skill: 8 }],
};
export const ADVANCE_LV = 45, ADVANCE_JOB = 40;
export const canAdvance = (p) => { ensureJob(p); return p.job.tier === 1 && p.lv >= ADVANCE_LV && p.job.lv >= ADVANCE_JOB; };
export function advanceJob(p, branchId) {
  if (!canAdvance(p)) return false;
  const b = (JOB2[p.cls] || []).find((x) => x.id === branchId);
  if (!b) return false;
  p.job = { tier: 2, lv: 1, exp: 0, branch: b.id };
  return true;
}
export const branchOf = (p) => (JOB2[p.cls] || []).find((x) => x.id === p.job?.branch) || null;
export const jobTitle = (p, baseName) => branchOf(p)?.name || baseName;

// ---- 轉生：Lv99 且二轉職業 Lv70 → 回到 1 級，永久變強 ----
export const REBORN_LV = 99;
export const canReborn = (p) => { ensureJob(p); return p.lv >= REBORN_LV && p.job.tier === 2 && p.job.lv >= JOB_CAP[2]; };
export function doReborn(p) {
  if (!canReborn(p)) return false;
  p.reborn = (p.reborn | 0) + 1;
  p.lv = 1; p.exp = 0; p.job = { tier: 1, lv: 1, exp: 0, branch: '' }; p.skillLv = {};
  return true;
}
// 轉生加成：每轉 攻擊、生命 +6%，能力點 +10，經驗 +10%
export const rebornBonus = (p) => ({ atkPct: 6 * (p.reborn | 0), hpPct: 6 * (p.reborn | 0), attrPts: 10 * (p.reborn | 0), exp: 10 * (p.reborn | 0) });

// 轉職路線與轉生的加成，給 stats() 合併
export function jobBonus(p) {
  const b = branchOf(p) || {}, r = rebornBonus(p);
  return { atkPct: (b.atkPct || 0) + r.atkPct, hpPct: (b.hpPct || 0) + r.hpPct, crit: b.crit || 0, critDmg: b.critDmg || 0, aspd: b.aspd || 0, skill: b.skill || 0, cdr: b.cdr || 0, dr: b.dr || 0, soul: b.soul || 0 };
}
