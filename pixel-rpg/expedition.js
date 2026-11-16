// 遠征（主玩法）：選地圖 → 一局 15 分鐘 → 局內從 Lv1 開始、撿經驗寶石、升級三選一 → 第 13 分鐘地區魔王 → 結算。
// 局外養成（素質、技能樹、裝備精煉、卡片、魂像）帶進每一局；局內等級、技能、寶箱道具打完就歸零。
// 只有規則與數值（不碰畫面），給 game.js 呼叫，也給 test/expedition.test.mjs 測。
import { CHAPTERS, MONSTERS, SLOTS, stdItemVal, gearScore } from './world.js';
import { SKILLS, ROUTES } from './skilldata.js';
import { ACTIVE_KINDS, STARTER } from './skilltree.js';

export const RUN_LEN = 900, ELITE_AT = [300, 600], BOSS_AT = 780; // 15 分鐘；第 5、10 分鐘小王；第 13 分鐘地區魔王
export const DIFF_MAX = 20, GEAR_CAP = 100;
export const SKILL_MAX = 5, ITEM_SLOTS = 5, CHEST_EVERY = 75;

// ---- 地圖：一章一張，依序解鎖 ----
export const STAGES = CHAPTERS.map((c) => {
  const lvs = c.mons.map((id) => MONSTERS[id].lv);
  return { id: String(c.n), ch: c.n, name: c.name, mons: c.mons, lvLo: Math.min(...lvs), lvHi: Math.max(...lvs), mvp: c.boss };
});
export const stageById = (id) => STAGES.find((s) => s.id === String(id));
export const stdGearScore = (lv) => SLOTS.reduce((a, s) => a + stdItemVal(s, lv, 'good'), 0);
export const gateOf = (st) => (st.ch === 1 ? 0 : Math.round(stdGearScore(st.lvLo) * 0.55));
export function ensureExped(p) { p.exped ??= {}; p.exped.cleared ??= {}; p.exped.runs ??= 0; return p.exped; }
export function stageLock(p, st) {
  const e = ensureExped(p), prev = STAGES[STAGES.indexOf(st) - 1];
  if (prev && !e.cleared[prev.id]) return `先打倒「${prev.name}」的魔王`;
  const gs = gearScore(p), gate = gateOf(st);
  return gs < gate ? `裝備分數 ${gs} / ${gate}` : null;
}
export const maxDiff = (p, st) => Math.min(DIFF_MAX, (ensureExped(p).cleared[st.id] || 0) + 1);
export function diffMods(d) {
  const k = Math.max(1, Math.min(DIFF_MAX, d | 0)) - 1;
  return { hp: 1 + 0.3 * k, atk: 1 + 0.12 * k, count: 1 + 0.03 * k, drop: 1 + 0.25 * k, luck: 1 + 0.35 * k, exp: 1 + 0.1 * k, coin: 1 + 0.25 * k };
}

// ---- 怪潮（隨時間）：同時在場越來越多、越硬；開場約 30 秒緩和 ----
export function wave(t) {
  const k = Math.min(1, t / RUN_LEN);
  return {
    cap: Math.round((t < 30 ? 8 : 15) + 45 * k),
    every: Math.max(0.35, (t < 30 ? 2.2 : 1.5) - 1.15 * k),
    pack: 2 + Math.floor(k * 4),
    hpMul: 0.3 + 1.2 * k * k,  // 一群一起上，單隻比野外弱：0.3 → 1.5
    atkMul: 0.35 + 0.35 * k,   // 0.35 → 0.7
  };
}
export function wavePool(st, t) {
  const k = t / RUN_LEN;
  return st.mons.slice(0, k < 0.12 ? 3 : k < 0.33 ? 5 : k < 0.66 ? 9 : st.mons.length);
}

// ---- 局內等級：撿經驗寶石升級；每級自動 +3% 攻擊、+3% 生命、回 20% 血 ----
export const runExpNeed = (lv) => Math.round(4 + lv * 3 + lv * lv * 0.6);
export const gemValue = (d, t = 0) => Math.round((d.boss ? 60 : d.elite ? 12 : 1 + Math.floor((d.lv || 1) / 40)) * (1 + t / 300));
export function gainRunExp(run, n) {
  run.exp += n; let up = 0;
  while (run.exp >= runExpNeed(run.lv)) { run.exp -= runExpNeed(run.lv); run.lv++; up++; }
  run.pending += up;
  return up;
}

// ---- 升級三選一：新技能／強化技能／加護（改變技能運作，本局限定）----
export const skillSlots = (p) => ((p.job?.tier || 1) >= 2 ? 5 : 4);
export function skillPool(p) {
  const routes = new Set((ROUTES[p.cls] || []).map((r) => r.id));
  return SKILLS.filter((s) => ACTIVE_KINDS.has(s.kind) && s.shape && (s.owner === p.cls || (routes.has(s.owner) && p.job?.branch === s.owner && (p.sk?.[s.id] || 0) > 0))).map((s) => s.id);
}
export const BLESS = {
  blaze: { name: '熾燈', desc: '傷害 ×1.8' },
  swift: { name: '疾燈', desc: '冷卻 −40%' },
  twin: { name: '連燈', desc: '每次施放多放一次' },
  wide: { name: '廣燈', desc: '範圍類傷害 ×1.4、單體類穿透並 ×1.2' },
};
export function newRun(p, st, diff) {
  return { st, diff, mods: diffMods(diff), t: 0, lv: 1, exp: 0, pending: 0, kills: 0, gear: 0, skills: { [STARTER[p.cls]]: 1 }, bless: {}, items: [], eliteDone: [], bossOut: false, chestT: CHEST_EVERY * 0.6, chests: 0, over: false, cleared: false };
}
export function rollCards(run, p, rand) {
  const opts = [], own = Object.keys(run.skills);
  for (const id of own) if (run.skills[id] < SKILL_MAX) opts.push({ kind: 'skill', id, lv: run.skills[id] + 1, w: 3 });
  if (own.length < skillSlots(p)) for (const id of skillPool(p)) if (!run.skills[id]) opts.push({ kind: 'skill', id, lv: 1, w: 3 });
  for (const id of own) if (run.skills[id] >= 3 && !run.bless[id]) for (const b of Object.keys(BLESS)) opts.push({ kind: 'bless', id, b, w: 0.6 });
  const out = [], seen = new Set();
  while (out.length < 3 && opts.length) {
    let r = rand() * opts.reduce((a, o) => a + o.w, 0), i = 0;
    for (; i < opts.length - 1; i++) { r -= opts[i].w; if (r < 0) break; }
    const c = opts.splice(i, 1)[0], key = c.kind + c.id;
    if (c.kind === 'bless' && seen.has(key)) continue; // 同一個技能的加護一次只給一張
    seen.add(key); out.push(c);
  }
  if (!out.length) out.push({ kind: 'heal' }, { kind: 'gold' });
  return out;
}
export function applyCard(run, c) {
  if (c.kind === 'skill') run.skills[c.id] = (run.skills[c.id] || 0) + 1;
  if (c.kind === 'bless') run.bless[c.id] = c.b;
  if (c.kind === 'gold') run.bonusGold = (run.bonusGold || 0) + 30 * run.lv;
  return c;
}
export const runSkillMult = (run, id) => (1 + 0.3 * ((run.skills[id] || 1) - 1)) * ({ blaze: 1.8, wide: 1.3 }[run.bless[id]] || 1);
export const runCdMult = (run, id) => (1 - 0.06 * ((run.skills[id] || 1) - 1)) * (run.bless[id] === 'swift' ? 0.6 : 1);

// ---- 局內寶箱：花金幣開，從三件「本局道具」挑一件（最多 5 格）----
export const RUN_ITEMS = {
  might: { name: '力量祝福', desc: '攻擊 +18%', mod: { atkPct: 18 } },
  vigor: { name: '生命藥劑', desc: '生命 +25%、每秒回 0.4%', mod: { hpPct: 25, regen: 0.004 } },
  keen: { name: '暴擊靈藥', desc: '暴擊率 +10%', mod: { crit: 10 } },
  frenzy: { name: '狂熱靈藥', desc: '攻擊速度 +18%', mod: { aspd: 18 } },
  calm: { name: '靜心料理', desc: '技能冷卻 −12%', mod: { cdr: 12 } },
  stride: { name: '疾行料理', desc: '移動速度 +15%', mod: { move: 15 } },
  arcane: { name: '共鳴石', desc: '技能傷害 +20%', mod: { skill: 20 } },
  magnet: { name: '引燈石', desc: '撿取範圍 +60%', mod: { pickup: 60 } },
};
export const chestCost = (st, n) => Math.round((20 + st.lvLo * 6) * (1 + 0.5 * n));
export function rollItems(run, rand) {
  const left = Object.keys(RUN_ITEMS).filter((id) => !run.items.includes(id)), out = [];
  while (out.length < 3 && left.length) out.push(left.splice(Math.floor(rand() * left.length), 1)[0]);
  return out;
}
// 局內加成合計（world.stats 讀 p.runMods）：等級加成＋寶箱道具
export function runMods(run) {
  const m = { atkPct: 3 * (run.lv - 1), hpPct: 3 * (run.lv - 1), regen: 0, aspd: 0, move: 0, pickup: 0, cdr: 0, crit: 0, skill: 0 };
  for (const id of run.items) for (const [k, v] of Object.entries(RUN_ITEMS[id].mod)) m[k] += v;
  return m;
}

// ---- 掉裝與結算 ----
export const gearChance = (d) => Math.min(0.5, 0.05 * diffMods(d).drop);
export function stageReward(p, run) {
  const m = run.mods, min = Math.floor(run.t / 60);
  return {
    coins: Math.round((run.st.lvHi * 8 * min + run.kills * 2) * m.coin * (run.cleared ? 1.5 : 1)) + (run.bonusGold || 0),
    shards: run.cleared ? 4 + Math.floor(run.diff / 4) : Math.floor(min / 5),
    gear: run.cleared ? 3 + Math.floor(run.diff / 5) : 0,
  };
}
export function clearStage(p, st, d) {
  const e = ensureExped(p), first = !e.cleared[st.id];
  e.cleared[st.id] = Math.max(e.cleared[st.id] || 0, d);
  p.ch = Math.max(p.ch || 1, Math.min(7, st.ch + 1));
  return first;
}
export function cardText(c) {
  const sk = c.id && SKILLS.find((s) => s.id === c.id);
  if (c.kind === 'skill') return { title: sk.name, sub: c.lv === 1 ? '新技能' : `技能 Lv ${c.lv}`, desc: c.lv === 1 ? '放進技能欄，冷卻好就自動施放' : '傷害 +30%、冷卻 −6%' };
  if (c.kind === 'bless') return { title: `${BLESS[c.b].name}・${sk.name}`, sub: '加護（本局限定）', desc: BLESS[c.b].desc };
  if (c.kind === 'heal') return { title: '燈火的溫暖', sub: '回復', desc: '生命全滿' };
  return { title: '一袋金幣', sub: '金幣', desc: '結算時多拿金幣' };
}
