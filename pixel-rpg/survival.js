// 長夜求生（主玩法）：一局 15 分鐘，怪物從四面八方湧來，自動攻擊、走位求生，升級三選一。
// 這裡只有規則與數值（不碰畫面），給 game.js 呼叫，也給 test/survival.test.mjs 測。
import { CHAPTERS, MONSTERS } from './world.js';
import { SKILLS, ROUTES } from './skilldata.js';
import { ACTIVE_KINDS, STARTER } from './skilltree.js';

export const RUN_LEN = 900;             // 一局 15 分鐘
export const ELITE_AT = [300, 600];     // 第 5、10 分鐘：精英怪
export const BOSS_AT = 780;             // 第 13 分鐘：地區魔王登場，打倒就通關（留 2 分鐘打）
export const RUN_SKILL_MAX = 5, RUN_STAT_MAX = 5, RUN_SKILL_SLOTS = 6, RUN_STAT_SLOTS = 6;

// ---- 怪潮：時間越久，同時在場越多、出得越快、越硬 ----
export function wave(t) {
  const k = Math.min(1, t / RUN_LEN);
  return {
    cap: Math.round(15 + 45 * k),                    // 同時在場上限 15 → 60
    every: Math.max(0.35, 1.5 - 1.15 * k),           // 每隔幾秒出一批
    pack: 2 + Math.floor(k * 4),                      // 一批幾隻 2 → 6
    // 倖存者類：一群一起上，所以單隻比野外弱；開場一兩下就倒，後段才硬（平衡試玩：Lv1 開場 10 秒內就被圍死）
    hpMul: 0.3 + 1.2 * k * k,                         // 血量倍率 0.3 → 1.5
    atkMul: 0.35 + 0.35 * k,                          // 攻擊倍率 0.35 → 0.7（建議等級穿基準裝要撐得住）
  };
}
// 該時間會出現哪些怪（依等級由低到高）：開場 3 種、前段 5 種、中段 9 種、後段全部
export function wavePool(ch, t) {
  const mons = CHAPTERS[ch - 1].mons, k = t / RUN_LEN;
  return mons.slice(0, k < 0.12 ? 3 : k < 0.33 ? 5 : k < 0.66 ? 9 : mons.length);
}

// ---- 局內等級 ----
export const runExpNeed = (lv) => Math.round(4 + lv * 3 + lv * lv * 0.6);
// 後段結晶較值錢（每 5 分鐘多 1 倍），讓升級跟得上怪潮
export const gemValue = (d, t = 0) => Math.round((d.boss ? 60 : d.elite ? 12 : 1 + Math.floor((d.lv || 1) / 40)) * (1 + t / 300));

// ---- 升級卡 ----
// 能力卡（每張最多 5 級）
export const STAT_CARDS = {
  might: { name: '燈芯', desc: '攻擊 +12%', mod: { atkPct: 12 } },
  vigor: { name: '守夜人之心', desc: '生命 +15%、每秒回復 0.3%', mod: { hpPct: 15, regen: 0.003 } },
  haste: { name: '疾風羽', desc: '攻擊速度 +10%', mod: { aspd: 10 } },
  swift: { name: '夜行靴', desc: '移動速度 +8%', mod: { move: 8 } },
  magnet: { name: '引燈石', desc: '撿取範圍 +35%', mod: { pickup: 35 } },
  focus: { name: '靜心燭', desc: '技能冷卻 −7%', mod: { cdr: 7 } },
  keen: { name: '鷹之眼', desc: '暴擊率 +5%', mod: { crit: 5 } },
  arcane: { name: '共鳴石', desc: '技能傷害 +12%', mod: { skill: 12 } },
};
// 合技：技能練滿 5 級＋對應能力卡至少 1 級 → 覺醒（傷害 ×2、冷卻 −30%）
const SHAPE_PAIR = { melee: 'might', spin: 'might', barrage: 'haste', shock: 'might', quake: 'vigor', wave: 'arcane', shot: 'haste', fan: 'haste', bigshot: 'keen', fireball: 'arcane', rain: 'focus', trap: 'focus', ground: 'focus', nova: 'arcane', chain: 'arcane', dash: 'swift', veil: 'swift', screen: 'vigor', taunt: 'vigor', heal: 'vigor', healAoe: 'vigor', shield: 'vigor', leap: 'swift', blink: 'swift' };
export const pairOf = (id) => SHAPE_PAIR[SKILLS.find((s) => s.id === id)?.shape] || 'might';

// 這個角色一局能抽到的技能：職業一轉技能＋已學會的二轉路線技能（只算主動技）
export function skillPool(p) {
  const routes = new Set((ROUTES[p.cls] || []).map((r) => r.id));
  return SKILLS.filter((s) => ACTIVE_KINDS.has(s.kind) && s.shape && (s.owner === p.cls || (routes.has(s.owner) && (p.job?.branch === s.owner) && (p.sk?.[s.id] || 0) > 0))).map((s) => s.id);
}

export function newRun(p, ch, night = false) {
  const start = STARTER[p.cls];
  return { ch, night, t: 0, lv: 1, exp: 0, kills: 0, skills: { [start]: 1 }, stats: {}, awake: {}, pending: 0, eliteDone: [], bossOut: false, cleared: false, over: false, gold: 0, gear: 0, shards: 0 };
}
// 合併所有局內加成（world.stats 會讀 p.runMods）
export function runMods(run) {
  const m = { atkPct: 0, hpPct: 0, regen: 0, aspd: 0, move: 0, pickup: 0, cdr: 0, crit: 0, skill: 0 };
  for (const [id, lv] of Object.entries(run.stats)) for (const [k, v] of Object.entries(STAT_CARDS[id].mod)) m[k] += v * lv;
  return m;
}
// 局內技能的傷害與冷卻倍率
export const runSkillMult = (run, id) => (1 + 0.3 * ((run.skills[id] || 1) - 1)) * (run.awake[id] ? 2 : 1);
export const runCdMult = (run, id) => (1 - 0.06 * ((run.skills[id] || 1) - 1)) * (run.awake[id] ? 0.7 : 1);

// 擲出三張卡：還沒滿的技能／能力、可以覺醒的合技；都滿了就給回血或金幣
export function rollCards(run, p, rand) {
  const opts = [];
  const own = Object.keys(run.skills), ownStats = Object.keys(run.stats);
  for (const id of own) if (run.skills[id] < RUN_SKILL_MAX) opts.push({ kind: 'skill', id, lv: run.skills[id] + 1, w: 3 });
  if (own.length < RUN_SKILL_SLOTS) for (const id of skillPool(p)) if (!run.skills[id]) opts.push({ kind: 'skill', id, lv: 1, w: 2 });
  for (const id of ownStats) if (run.stats[id] < RUN_STAT_MAX) opts.push({ kind: 'stat', id, lv: run.stats[id] + 1, w: 3 });
  if (ownStats.length < RUN_STAT_SLOTS) for (const id of Object.keys(STAT_CARDS)) if (!run.stats[id]) opts.push({ kind: 'stat', id, lv: 1, w: 2 });
  for (const id of own) if (run.skills[id] >= RUN_SKILL_MAX && !run.awake[id] && run.stats[pairOf(id)]) opts.push({ kind: 'awake', id, w: 8 });
  const out = [];
  while (out.length < 3 && opts.length) {
    let r = rand() * opts.reduce((a, o) => a + o.w, 0), i = 0;
    for (; i < opts.length - 1; i++) { r -= opts[i].w; if (r < 0) break; }
    out.push(opts.splice(i, 1)[0]);
  }
  if (!out.length) out.push({ kind: 'heal' }, { kind: 'gold' });
  return out;
}
export function applyCard(run, c) {
  if (c.kind === 'skill') run.skills[c.id] = (run.skills[c.id] || 0) + 1;
  if (c.kind === 'stat') run.stats[c.id] = (run.stats[c.id] || 0) + 1;
  if (c.kind === 'awake') run.awake[c.id] = true;
  if (c.kind === 'gold') run.gold += 50 + run.lv * 10;
  return c;
}
// 撿經驗：回傳升了幾級（每升一級要選一次卡）
export function gainRunExp(run, n) {
  run.exp += n; let up = 0;
  while (run.exp >= runExpNeed(run.lv)) { run.exp -= runExpNeed(run.lv); run.lv++; up++; }
  run.pending += up;
  return up;
}
// 結算：通關給的多，撐越久給越多；角色經驗另外由打怪時照常拿（RO 式養成）
export function runRewards(run, p) {
  const min = Math.floor(run.t / 60), ch = run.ch, base = MONSTERS[CHAPTERS[ch - 1].mons[4]]?.lv || p.lv;
  return {
    coins: Math.round((min * 40 + run.kills * 2) * (1 + base / 30) * (run.cleared ? 2 : 1) * (run.night ? 2 : 1)) + run.gold,
    gear: (run.cleared ? 3 : 0) + Math.floor(min / 5),
    shards: run.cleared ? 8 + Math.floor(Math.random() * 5) : Math.floor(min / 5) * 2,
    lv: base,
  };
}
export const cardText = (c) => {
  if (c.kind === 'skill') { const s = SKILLS.find((x) => x.id === c.id); return { title: s.name, sub: c.lv === 1 ? '新技能' : `技能 Lv ${c.lv}`, desc: c.lv === 1 ? '加進技能欄，冷卻好就自動施放' : `傷害 +30%、冷卻 −6%（Lv ${c.lv}）` }; }
  if (c.kind === 'stat') { const s = STAT_CARDS[c.id]; return { title: s.name, sub: c.lv === 1 ? '新能力' : `Lv ${c.lv}`, desc: s.desc }; }
  if (c.kind === 'awake') { const s = SKILLS.find((x) => x.id === c.id); return { title: `覺醒・${s.name}`, sub: '合技', desc: '傷害 ×2、冷卻 −30%' }; }
  if (c.kind === 'heal') return { title: '燈火的溫暖', sub: '回復', desc: '生命全滿' };
  return { title: '一袋金幣', sub: '金幣', desc: '結算時多拿金幣' };
};
