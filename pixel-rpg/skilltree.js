// 長夜燈火：技能樹（純函式）。資料來自 skilldata.js（由 design/skilldb.py 產生）。
import { SKILLS, ROUTES, RES, BUILDS } from './skilldata.js';
export { SKILLS, ROUTES, RES };
export const BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
export const T1_POINTS = 49, T2_POINTS = 69;
export const ACTIVE_KINDS = new Set(['act', 'heal', 'buff', 'pbuff', 'debuff', 'util']);
export const BAR_SIZE = 6;
// 每個職業一開始就會的第一招（不花點數）
export const STARTER = { sword: 'lampSlash', priest: 'candleArrow', archer: 'twinStar', mage: 'emberSeed', monk: 'bellPalm', scout: 'shadowStab' };

// ---- 數值規則（和 design/skilldb.py 的 skillAt() 一樣）----
const COEF = new Set(['c', 'heal', 'healAoe', 'shield', 'exec_']);
export function skillAt(s, field, lv) {
  lv = Math.max(0, Math.min(s.max, lv | 0));
  if (COEF.has(field)) return lv ? Math.round((s[field] || 0) * (0.5 + 0.5 * lv / s.max)) : 0;
  if (field === 'mp') return lv ? Math.round((s.mp || 0) * (0.6 + 0.4 * lv / s.max)) : 0;
  return s[field];
}
const FIXED = new Set(['封印', '定身', 'undying', 'stealth', '免控']);
export const skScaled = (s, v, lv) => v * Math.max(0, Math.min(s.max, lv)) / s.max;
export const effVal = (s, eff, lv) => (FIXED.has(eff[0]) ? eff[1] : skScaled(s, eff[1], lv));

// ---- 存檔欄位 ----
export const routesOf = (cls) => ROUTES[cls] || [];
export const routeName = (cls, id) => routesOf(cls).find((r) => r.id === id)?.name || '';
export function ensureTree(p) {
  if (!p.sk || typeof p.sk !== 'object') p.sk = {};
  for (const [id, lv] of Object.entries(p.sk)) if (!BY_ID[id] || !(lv > 0)) delete p.sk[id];
  const st = STARTER[p.cls]; if (st && !(p.sk[st] > 0)) p.sk[st] = 1;
  if (!Array.isArray(p.bar)) p.bar = [];
  p.bar = p.bar.filter((id) => p.sk[id] > 0 && BY_ID[id] && ACTIVE_KINDS.has(BY_ID[id].kind)).slice(0, BAR_SIZE);
  for (const id of Object.keys(p.sk)) if (p.bar.length < BAR_SIZE && ACTIVE_KINDS.has(BY_ID[id].kind) && !p.bar.includes(id)) p.bar.push(id);
  return p;
}
export const lvOf = (p, id) => p.sk?.[id] | 0;
const isT2 = (s) => !(s.owner in RES);
// 點數：一轉每職業級 1 點（共 49）；二轉每職業級 1 點（共 69）。一轉沒用完不能帶到二轉，二轉的點數可以補一轉。
export function skillPoints(p) {
  const j = p.job || { tier: 1, lv: 1 };
  const t1 = j.tier >= 2 ? T1_POINTS : Math.min(T1_POINTS, (j.lv | 0) - 1);
  const t2 = j.tier >= 2 ? Math.min(T2_POINTS, (j.lv | 0) - 1) : 0;
  let s1 = 0, s2 = 0;
  for (const [id, lv] of Object.entries(p.sk || {})) {
    const s = BY_ID[id]; if (!s) continue;
    const paid = lv - (id === STARTER[p.cls] ? 1 : 0);
    if (isT2(s)) s2 += paid; else s1 += paid;
  }
  const t2Left = t2 - s2 - Math.max(0, s1 - t1);
  const t1Left = t1 + t2 - s1 - s2;
  return { t1, t2, s1, s2, free: Math.max(0, t1Left), free2: Math.max(0, Math.min(t2Left, t1Left)) };
}
export const owns = (p, s) => s.owner === p.cls || (s.owner === p.job?.branch && p.job?.tier >= 2);
export function whyNot(p, id) {
  const s = BY_ID[id]; if (!s) return '沒有這個技能';
  if (!owns(p, s)) return isT2(s) ? '要先轉職成這條路線' : '不是你的職業技能';
  if (lvOf(p, id) >= s.max) return '已經滿級';
  for (const [pid, plv] of s.pre) if (lvOf(p, pid) < plv) return `需要 ${BY_ID[pid].name} Lv${plv}`;
  const pt = skillPoints(p);
  if (isT2(s) ? pt.free2 <= 0 : pt.free <= 0) return '技能點不夠';
  return '';
}
export function learnSkill(p, id) {
  ensureTree(p);
  if (whyNot(p, id)) return false;
  p.sk[id] = lvOf(p, id) + 1;
  if (ACTIVE_KINDS.has(BY_ID[id].kind) && !p.bar.includes(id) && p.bar.length < BAR_SIZE) p.bar.push(id);
  return true;
}
export function resetTree(p) { p.sk = {}; p.bar = []; ensureTree(p); }
// 推薦配點：照該路線的代表配點，前面先點一轉部分
export function recommended(p) {
  const route = p.job?.tier >= 2 ? p.job.branch : routesOf(p.cls)[0]?.id;
  const plan = BUILDS[route] || [];
  return p.job?.tier >= 2 ? plan : plan.filter(([id]) => !isT2(BY_ID[id]));
}
export function autoLearnSkills(p) {
  ensureTree(p);
  const plan = recommended(p); let guard = 400, progress = true;
  while (progress && guard-- > 0) {
    progress = false;
    for (const [id, target] of plan) if (lvOf(p, id) < target && learnSkill(p, id)) { progress = true; break; }
  }
  // 推薦清單點完還有剩：補到一轉還沒滿的技能
  for (const s of SKILLS) while (guard-- > 0 && owns(p, s) && learnSkill(p, s.id));
}
export const barSkills = (p) => (ensureTree(p), p.bar.map((id) => BY_ID[id]));

// ---- 給戰鬥用的數值 ----
export function skillNums(p, id) {
  const s = BY_ID[id], lv = Math.max(1, lvOf(p, id));
  return { s, lv, mult: skillAt(s, 'c', lv) / 100, heal: skillAt(s, 'heal', lv) / 100, healAoe: skillAt(s, 'healAoe', lv) / 100, shield: skillAt(s, 'shield', lv) / 100,
    exec: skillAt(s, 'exec_', lv) / 100, mp: skillAt(s, 'mp', lv), cd: s.cd || 1, ct: s.ct || 0,
    buff: s.buff && [s.buff[0], effVal(s, s.buff, lv), s.buff[2]], pb: s.pb && [s.pb[0], effVal(s, s.pb, lv), s.pb[2]], db: s.db && [s.db[0], effVal(s, s.db, lv), s.db[2]] };
}
// 被動加成合計（給 stats() 用）
export function passives(p) {
  const out = {};
  for (const [id, lv] of Object.entries(p.sk || {})) {
    const s = BY_ID[id]; if (!s || !owns(p, s)) continue;
    for (const [k, v] of Object.entries(s.pas || {})) out[k] = (out[k] || 0) + skScaled(s, v, lv);
    if (s.dot) out.dot = (out.dot || 0) + skScaled(s, s.dot, lv);
    if (s.kind === 'pas' && s.pb) out['pb_' + s.pb[0]] = Math.max(out['pb_' + s.pb[0]] || 0, skScaled(s, s.pb[1], lv));
  }
  return out;
}
export function describeSkill(s, lv) {
  lv = Math.max(1, lv | 0); const L = [];
  const pct = (v) => `${Math.round(v * 100)}%`;
  const c = skillAt(s, 'c', lv); if (c) L.push(`${s.mag ? '魔法' : '物理'} ${c}%${s.t > 1 ? `，最多 ${s.t} 隻` : ''}`);
  if (s.exec_) L.push(`對生命 30% 以下的目標 ${skillAt(s, 'exec_', lv)}%`);
  if (s.elem) L.push(`${s.elem}屬性`);
  if (s.heal) L.push(`治療 ${skillAt(s, 'heal', lv)}%`); if (s.healAoe) L.push(`全隊治療 ${skillAt(s, 'healAoe', lv)}%`); if (s.shield) L.push(`護盾 ${skillAt(s, 'shield', lv)}%`);
  if (s.pierce) L.push(`無視防禦 ${pct(s.pierce)}`); if (s.crit) L.push('必定暴擊');
  if (s.gen || s.genAoe) L.push(`得 1 層資源${s.genAoe ? '（打到 3 隻以上）' : ''}`);
  if (s.use1) L.push(`消耗 1 層多 ${s.use1}%`); if (s.use) L.push(`消耗全部資源，每層 +${s.use}%`); if (s.need) L.push(`需要 ${s.need} 層`);
  if (s.star) L.push('留 1 個星點'); if (s.candle) L.push('留 1 根燭火'); if (s.shadow) L.push(`影狀態 ${s.shadow} 秒`);
  if (s.combo) L.push(`連段第 ${s.combo} 招`); if (s.freeze) L.push(`冰凍 ${s.freeze} 秒`); if (s.stun) L.push(`暈眩 ${s.stun} 秒`);
  const n = skillNums({ sk: { [s.id]: lv }, cls: s.owner, job: { tier: 2, branch: s.owner } }, s.id);
  if (n.buff) L.push(`自身${{ dr: '減傷', dmg: '傷害', crit: '暴擊率', aspd: '攻速', dmgPerStack: '每層攻擊', holy: '聖屬性', undying: '不倒', stealth: '隱形', manaShield: '魔力抵傷' }[n.buff[0]] || n.buff[0]} ${n.buff[1] > 1 ? n.buff[1] : pct(n.buff[1])}，${n.buff[2]} 秒`);
  if (n.pb) L.push(`隊伍${n.pb[0]} ${n.pb[1] > 1 ? n.pb[1] : pct(n.pb[1])}${n.pb[2] >= 999 ? '（常駐）' : `，${n.pb[2]} 秒`}`);
  if (n.db) L.push(`目標${n.db[0]} ${n.db[1] > 1 ? n.db[1] + ' 秒' : pct(n.db[1])}，${n.db[2]} 秒`);
  for (const [k, v] of Object.entries(s.pas || {})) L.push(`被動：${{ dmg: '傷害', hp: '生命', aspd: '攻速', crit: '暴擊率', critd: '暴擊傷害', heal: '治療量', block: '格擋率', boss: '對首領', cast: '詠唱時間 −', dr: '減傷', double: '兩連擊', proc: '追擊', flee: '迴避', hit: '命中', range: '射程', shadowStab: '影刺傷害', debuffDur: '減益持續', drop: '掉寶', chest: '寶箱多開', buffDur: '增益持續', status: '異常抗性', lowDr: '低血量減傷', counter: '反擊', stealGold: '偷金幣', auraRange: '光環範圍' }[k] || k} ${['hit', 'range', 'flee', 'auraRange', 'stealGold', 'counter'].includes(k) ? Math.round(skScaled(s, v, lv) * 10) / 10 : pct(skScaled(s, v, lv))}`);
  if (s.dot) L.push(`持續毒傷 ${pct(skScaled(s, s.dot, lv))}／秒`);
  if (s.desc) L.push(s.desc);
  return L.join('；');
}
