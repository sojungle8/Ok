// 微光大陸：RO 風格數值系統——六大能力值、屬性相剋、種族、體型、卡片效果、輔助狀態（原創名稱與數值，純函式可測試）
// 設計原則：機制照 RO 的架構，但配合「舒壓」：屬性最低 5 折、不會完全打不動；命中下限 85%

// ---- 六大能力值 ----
export const ATTRS = ['str', 'agi', 'vit', 'int', 'dex', 'luk'];
export const ATTR_NAME = { str: '力量', agi: '敏捷', vit: '體質', int: '智力', dex: '靈巧', luk: '幸運' };
export const ATTR_DESC = {
  str: '近戰職業的攻擊力', agi: '攻擊速度、迴避', vit: '最大生命、減傷', int: '法系職業的攻擊力、技能傷害、魂力累積', dex: '命中、弓手的攻擊力', luk: '暴擊率、暴擊傷害、完全迴避',
};
export const ATTR_MAX = 99;
// 每升一級 4 點，起始 10 點自由分配（每項能力起始 1）
export const attrPointsTotal = (lv) => 10 + Math.max(0, lv - 1) * 4;
export const attrSpent = (a) => ATTRS.reduce((s, k) => s + Math.max(0, (a?.[k] || 1) - 1), 0);
export const attrFree = (p) => Math.max(0, attrPointsTotal(p.lv) + 10 * (p.reborn | 0) - attrSpent(p.attrs));
export const newAttrs = () => Object.fromEntries(ATTRS.map((k) => [k, 1]));
// 主要攻擊能力：近戰看力量、弓手看靈巧、法系看智力
export const MAIN_ATTR = { sword: 'str', monk: 'str', archer: 'dex', mage: 'int', priest: 'int' };
// 自動分配比例（舒壓：預設開啟，不用自己研究）
export const AUTO_RATIO = {
  sword: { str: 5, vit: 3, dex: 1, agi: 1 },
  archer: { dex: 5, agi: 3, luk: 1, str: 1 },
  mage: { int: 5, dex: 3, vit: 1, agi: 1 },
  monk: { str: 4, agi: 4, luk: 1, vit: 1 },
  priest: { int: 4, vit: 3, dex: 2, agi: 1 },
};
export function ensureAttrs(p) {
  if (!p.attrs || typeof p.attrs !== 'object') p.attrs = newAttrs();
  for (const k of ATTRS) p.attrs[k] = Math.max(1, Math.min(ATTR_MAX, Math.floor(p.attrs[k] || 1)));
  if (typeof p.autoAttr !== 'boolean') p.autoAttr = true;
  return p;
}
export function addAttr(p, k, n = 1) {
  ensureAttrs(p);
  const add = Math.min(n, attrFree(p), ATTR_MAX - p.attrs[k]);
  if (add <= 0 || !ATTRS.includes(k)) return 0;
  p.attrs[k] += add; return add;
}
export function autoAllocate(p) {
  ensureAttrs(p);
  const ratio = AUTO_RATIO[p.cls] || AUTO_RATIO.sword;
  let free = attrFree(p), guard = 2000;
  while (free > 0 && guard-- > 0) {
    // 挑「目前點數 ÷ 比例」最低、還沒滿的能力
    const k = Object.keys(ratio).filter((x) => p.attrs[x] < ATTR_MAX).sort((a, b) => (p.attrs[a] - 1) / ratio[a] - (p.attrs[b] - 1) / ratio[b])[0];
    if (!k) break;
    p.attrs[k]++; free--;
  }
}
export function resetAttrs(p) { p.attrs = newAttrs(); }

// ---- 輔助狀態（祝福、加速）----
export const BUFFS = {
  bless: { name: '祝福', desc: '力量、智力、靈巧 +10', attrs: { str: 10, int: 10, dex: 10 }, color: '#ffe08a' },
  agi: { name: '加速', desc: '敏捷 +12、攻擊速度 +15%', attrs: { agi: 12 }, aspd: 15, color: '#7fd8ff' },
  guard: { name: '守護', desc: '受到傷害 -15%', dr: 15, color: '#c8d0e0' },
};
export const activeBuffs = (p, t = Date.now()) => Object.keys(BUFFS).filter((k) => (p._buff?.[k] || 0) > t);
export function addBuff(p, k, sec, t = Date.now()) { p._buff ??= {}; p._buff[k] = Math.max(p._buff[k] || 0, t + sec * 1000); }

// 含輔助加成後的能力值
export function effAttrs(p, t = Date.now()) {
  const a = { ...newAttrs(), ...(p.attrs || {}) };
  for (const b of activeBuffs(p, t)) for (const [k, v] of Object.entries(BUFFS[b].attrs || {})) a[k] += v;
  for (const [k, v] of Object.entries(cardMods(p).attrs)) a[k] += v;
  return a;
}

// 能力值帶來的加成（等級 1、每項 1 點時全部為 0，舊數值不變）
export function attrBonus(p, t = Date.now()) {
  const a = effAttrs(p, t), lv = p.lv || 1, d = (k) => Math.max(0, a[k] - 1);
  const main = d(MAIN_ATTR[p.cls] || 'str');
  return {
    attrs: a,
    atkPct: main * 0.4 + Math.floor(main / 10) ** 2 * 0.1 + (MAIN_ATTR[p.cls] === 'dex' ? 0 : d('dex') * 0.1),
    hpPct: d('vit') * 0.8,
    dr: Math.min(15, d('vit') * 0.15),
    aspd: d('agi') * 0.3 + activeBuffs(p, t).reduce((s, b) => s + (BUFFS[b].aspd || 0), 0),
    skill: d('int') * 0.4,
    soul: d('int') * 0.3,
    crit: d('luk') * 0.3,
    critDmg: d('luk') * 0.2,
    perfect: Math.min(10, d('luk') * 0.1),
    hit: lv + a.dex,
    flee: lv + a.agi,
    buffDr: activeBuffs(p, t).reduce((s, b) => s + (BUFFS[b].dr || 0), 0),
  };
}
// 玩家命中怪物：最低 85%，最高 100%
export const hitChance = (hit, monLv) => Math.max(0.85, Math.min(1, 0.95 + (hit - monLv) / 200));
// 玩家閃避怪物攻擊：最高 50%
export const dodgeChance = (flee, monLv, perfect = 0) => Math.max(0, Math.min(0.5, (flee - monLv * 1.5) / 150)) + perfect / 100;
// 怪物防禦：減少受到的傷害（魔王防禦較高）
export const monDef = (lv, boss) => Math.round(lv * (boss ? 1.8 : 1.2));
export const defMod = (def) => 1 - def / (def + 150);

// ---- 屬性 ----
export const ELEMS = ['無', '水', '地', '火', '風', '毒', '聖', '暗', '念', '不死'];
export const ELEM_COLOR = { 無: '#e8e4f0', 水: '#4fb3ff', 地: '#c9a77a', 火: '#ff7a45', 風: '#7ad35a', 毒: '#a66bd6', 聖: '#ffe08a', 暗: '#8a6bb8', 念: '#bdf1ff', 不死: '#9aa3b5' };
// 攻擊屬性 → 防守屬性的倍率（最低 0.5，舒壓：不會完全打不動）
const STRONG = 1.75, WEAK = 0.75, SAME = 0.5;
const CYCLE = { 水: '火', 火: '地', 地: '風', 風: '水' }; // 水剋火、火剋地、地剋風、風剋水
export function elemMod(atk = '無', def = '無') {
  if (atk === def) return ['水', '地', '火', '風', '聖', '暗'].includes(atk) ? SAME : atk === '念' ? STRONG : 1;
  if (CYCLE[atk] === def) return STRONG;
  if (CYCLE[def] === atk) return WEAK;
  if (atk === '聖' && (def === '暗' || def === '不死')) return STRONG;
  if (atk === '暗' && def === '聖') return STRONG;
  if (atk === '火' && def === '不死') return 1.5;
  if (atk === '毒' && def === '不死') return SAME;
  if (atk === '暗' && def === '不死') return SAME;
  if (atk === '無' && def === '念') return SAME;
  if (atk === '念' && def === '不死') return 1.25;
  if (def === '念' && atk !== '聖') return WEAK;
  return 1;
}

// ---- 種族、體型 ----
export const RACES = ['無形', '不死', '動物', '植物', '昆蟲', '魚貝', '惡魔', '人形', '天使', '龍'];
export const BODY_SIZES = ['小型', '中型', '大型'];
// 每種怪物的屬性、種族、體型（原創設定）
export const MON_PROFILE = {
  slime: { elem: '水', race: '無形', size: '小型' },
  berry: { elem: '地', race: '植物', size: '小型' },
  ember: { elem: '火', race: '無形', size: '小型' },
  king: { elem: '水', race: '無形', size: '大型' },
  bat: { elem: '暗', race: '動物', size: '小型' },
  pebble: { elem: '地', race: '無形', size: '中型' },
  howl: { elem: '風', race: '動物', size: '中型' },
  echo: { elem: '風', race: '惡魔', size: '大型' },
  cog: { elem: '無', race: '無形', size: '中型' },
  spark: { elem: '風', race: '無形', size: '小型' },
  smelter: { elem: '火', race: '無形', size: '大型' },
  clock: { elem: '無', race: '惡魔', size: '大型' },
  wisp: { elem: '念', race: '不死', size: '小型' },
  armor: { elem: '不死', race: '不死', size: '中型' },
  gargoyle: { elem: '地', race: '惡魔', size: '中型' },
  mirror: { elem: '念', race: '惡魔', size: '大型' },
  crab: { elem: '水', race: '魚貝', size: '小型' },
  lantern: { elem: '火', race: '不死', size: '小型' },
  pirate: { elem: '水', race: '人形', size: '中型' },
  faceless: { elem: '暗', race: '人形', size: '大型' },
  cultist: { elem: '暗', race: '人形', size: '中型' },
  shade: { elem: '暗', race: '惡魔', size: '中型' },
  eclipse: { elem: '毒', race: '無形', size: '中型' },
  valde: { elem: '暗', race: '惡魔', size: '大型' },
};
export const profileOf = (type) => MON_PROFILE[type] || { elem: '無', race: '無形', size: '中型' };

// ---- 技能與夥伴的攻擊屬性 ----
export const SKILL_ELEM = {
  spin: '風', wave: '風', quake: '地', triple: '無', rain: '無', pierce: '風',
  nova: '水', fireball: '火', chain: '風', barrage: '無', shock: '地', dragon: '火',
  mend: '聖', lance: '聖', sanctum: '聖',
};
export const ALLY_ELEM = { lena: '聖', mia: '聖', nova: '火', carlos: '風', buck: '無' };

// ---- 卡片效果（每種怪物一張，原創設計）----
// attrs：能力值；pct：百分比加成；race／elemDmg／size：對該種族／屬性／體型傷害；resist：受到該屬性傷害減少；enchant：武器附加屬性
export const CARD_EFFECT = {
  slime: { attrs: { vit: 2 }, pct: { hpPct: 5 } },
  berry: { attrs: { luk: 2 }, pct: { crit: 3 } },
  ember: { enchant: '火' },
  king: { attrs: { str: 3 }, pct: { atkPct: 8 } },
  bat: { size: { 小型: 15 } },
  pebble: { resist: { 地: 20 } },
  howl: { race: { 動物: 20 } },
  echo: { elemDmg: { 風: 25 }, pct: { aspd: 5 } },
  cog: { race: { 無形: 20 } },
  spark: { enchant: '風' },
  smelter: { resist: { 火: 25 } },
  clock: { pct: { cdr: 8 }, attrs: { dex: 3 } },
  wisp: { race: { 不死: 20 } },
  armor: { pct: { dr: 5 }, attrs: { vit: 3 } },
  gargoyle: { race: { 惡魔: 20 } },
  mirror: { enchant: '念', attrs: { int: 3 } },
  crab: { resist: { 水: 25 } },
  lantern: { elemDmg: { 暗: 20 } },
  pirate: { race: { 人形: 20 } },
  faceless: { attrs: { luk: 5 }, pct: { crit: 8 } },
  cultist: { attrs: { int: 3 }, pct: { skill: 8 } },
  shade: { enchant: '暗' },
  eclipse: { size: { 大型: 15 } },
  valde: { race: Object.fromEntries(RACES.map((r) => [r, 10])), attrs: { str: 3, int: 3 } },
};
const PCT_NAME = { hpPct: '生命', atkPct: '攻擊', crit: '暴擊率', aspd: '攻擊速度', skill: '技能傷害', dr: '減傷', cdr: '技能冷卻縮短' };
export function cardDesc(mon) {
  const e = CARD_EFFECT[mon]; if (!e) return '';
  const out = [];
  for (const [k, v] of Object.entries(e.attrs || {})) out.push(`${ATTR_NAME[k]} +${v}`);
  for (const [k, v] of Object.entries(e.pct || {})) out.push(`${PCT_NAME[k]} +${v}%`);
  const races = Object.entries(e.race || {});
  if (races.length === RACES.length) out.push(`對所有種族傷害 +${races[0][1]}%`); else for (const [k, v] of races) out.push(`對${k}傷害 +${v}%`);
  for (const [k, v] of Object.entries(e.elemDmg || {})) out.push(`對${k}屬性傷害 +${v}%`);
  for (const [k, v] of Object.entries(e.size || {})) out.push(`對${k}傷害 +${v}%`);
  for (const [k, v] of Object.entries(e.resist || {})) out.push(`受到${k}屬性傷害 -${v}%`);
  if (e.enchant) out.push(`武器附加${e.enchant}屬性`);
  return out.join('、');
}
// 匯總身上所有卡片的效果
export function cardMods(p) {
  const m = { attrs: {}, pct: {}, race: {}, elemDmg: {}, size: {}, resist: {}, enchant: null };
  for (const it of Object.values(p.gear || {})) for (const c of it?.cards || []) {
    const e = CARD_EFFECT[String(c.id || '').replace('card_', '')]; if (!e) continue;
    for (const g of ['attrs', 'pct', 'race', 'elemDmg', 'size', 'resist']) for (const [k, v] of Object.entries(e[g] || {})) m[g][k] = (m[g][k] || 0) + v;
    if (e.enchant && it.slot === 'weapon') m.enchant = e.enchant;
  }
  return m;
}
// 對某隻怪物的總傷害倍率（屬性 × 種族／屬性／體型加成 × 防禦）
export function damageMult(p, mods, atkElem, type, lv, boss) {
  const pr = profileOf(type);
  const em = elemMod(atkElem, pr.elem);
  const bonus = 1 + ((mods.race[pr.race] || 0) + (mods.elemDmg[pr.elem] || 0) + (mods.size[pr.size] || 0)) / 100;
  return { mult: em * bonus * defMod(monDef(lv, boss)), elem: em };
}
