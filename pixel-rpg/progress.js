// 長夜燈火：職業等級與轉職（純函式）。技能樹在 skilltree.js。
import { ROUTES, passives, ensureTree, resetTree } from './skilltree.js';
export const JOB_CAP = { 1: 50, 2: 70 };
export const jobExpNeed = (jl, tier = 1) => Math.round((20 + jl * jl * 9 + 0.12 * jl ** 3) * (tier >= 2 ? 6 : 1));
export const JOB_EXP_RATE = 0.75;
// 舊存檔的二轉路線 id → 新路線 id
const OLD_BRANCH = { paladin: 'guard', blademaster: 'heavy', bishop: 'healer', inquisitor: 'exorcist', sniper: 'hawk', ranger: 'trapper', archmage: 'destroyer', elementalist: 'enchanter', asura: 'brawler', zen: 'qigong' };
export function ensureJob(p) {
  if (!p.job || typeof p.job !== 'object') p.job = { tier: 1, lv: 1, exp: 0, branch: '' };
  p.job.tier = p.job.tier === 2 ? 2 : 1;
  p.job.lv = Math.max(1, Math.min(JOB_CAP[p.job.tier], p.job.lv | 0 || 1)); p.job.exp = Math.max(0, +p.job.exp || 0);
  if (OLD_BRANCH[p.job.branch]) p.job.branch = OLD_BRANCH[p.job.branch];
  if (p.job.tier === 2 && !(ROUTES[p.cls] || []).some((r) => r.id === p.job.branch)) p.job = { tier: 1, lv: JOB_CAP[1], exp: 0, branch: '' };
  // 舊版的技能等級（skillLv）換成新技能樹：免費重置一次
  if (p.skillLv) { delete p.skillLv; resetTree(p); }
  delete p.reborn;
  ensureTree(p);
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
export const ADVANCE_LV = 45, ADVANCE_JOB = 40;
export const JOB2 = ROUTES;
export const canAdvance = (p) => { ensureJob(p); return p.job.tier === 1 && p.lv >= ADVANCE_LV && p.job.lv >= ADVANCE_JOB; };
export function advanceJob(p, routeId) {
  if (!canAdvance(p) || !(ROUTES[p.cls] || []).some((r) => r.id === routeId)) return false;
  p.job = { tier: 2, lv: 1, exp: 0, branch: routeId };
  return true;
}
export const branchOf = (p) => (ROUTES[p.cls] || []).find((r) => r.id === p.job?.branch) || null;
export const jobTitle = (p, baseName) => branchOf(p)?.name || baseName;
// 技能被動 → stats() 用的加成（百分比數字）
export function jobBonus(p) {
  const s = passives(p), pc = (k) => Math.round((s[k] || 0) * 1000) / 10;
  return { atkPct: pc('dmg'), hpPct: pc('hp'), crit: pc('crit'), critDmg: pc('critd'), aspd: pc('aspd') + pc('pb_攻速'), skill: 0, cdr: pc('cast') / 2,
    dr: pc('dr') + pc('block') / 2 + pc('pb_防禦') / 4, soul: 0, heal: pc('heal'), boss: pc('boss'), double: pc('double'), proc: pc('proc'), dot: pc('dot'),
    flee: Math.round(s.flee || 0), hit: Math.round(s.hit || 0), range: Math.round(s.range || 0), drop: pc('drop'), shadowStab: s.shadowStab || 0, debuffDur: s.debuffDur || 0 };
}
