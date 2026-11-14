// 微光大陸：背包、道具、怪物卡片、精煉、自動販賣（RO 風格的玩法機制，名稱與內容皆為原創）
import { MONSTERS, RARITY, rarityIdx, sellValue, itemPower, stats } from './world.js';
import { cardDesc, CARD_EFFECT } from './ro.js';

// ---- 道具 ----
// grade：junk 雜物（怪物素材）、common 一般道具、rare 稀有道具、card 卡片
export const GRADES = [
  { id: 'junk', name: '雜物', color: '#b8b0a4' },
  { id: 'common', name: '一般道具', color: '#e8e4f0' },
  { id: 'rare', name: '稀有道具', color: '#4fb3ff' },
  { id: 'card', name: '卡片', color: '#ffb03b' },
];
export const ITEMS = {
  red: { name: '紅色藥水', kind: 'use', grade: 'common', price: 15, heal: 0.25, icon: 'potion', color: '#e8506a', unlock: 1, desc: '回復 25% 生命' },
  orange: { name: '橙色藥水', kind: 'use', grade: 'common', price: 60, heal: 0.5, icon: 'potion', color: '#ff9f40', unlock: 2, desc: '回復 50% 生命' },
  white: { name: '白色藥水', kind: 'use', grade: 'common', price: 200, heal: 1, icon: 'potion', color: '#f3f0ff', unlock: 4, desc: '回復 100% 生命' },
  scroll: { name: '回城卷軸', kind: 'use', grade: 'common', price: 50, effect: 'home', icon: 'scroll', color: '#e8d29a', unlock: 2, desc: '立刻回到微光村' },
  feather: { name: '瞬移羽毛', kind: 'use', grade: 'common', price: 20, effect: 'blink', icon: 'feather', color: '#bfe3ff', unlock: 2, desc: '傳送到這張地圖的隨機位置' },
  elixir: { name: '魂之藥', kind: 'use', grade: 'rare', sellPrice: 120, effect: 'soul', icon: 'potion', color: '#c084ff', desc: '魂力 +50%' },
  ore: { name: '精煉石', kind: 'mat', grade: 'rare', sellPrice: 40, icon: 'ore', color: '#7fd8ff', desc: '精煉 +1～+6 的材料' },
  ore2: { name: '強化原石', kind: 'mat', grade: 'rare', sellPrice: 150, icon: 'ore', color: '#ffb03b', desc: '精煉 +7～+10 的材料' },
};
const MAT_NAMES = {
  slime: '黏液', berry: '莓果凍', ember: '餘燼', king: '王冠碎片', bat: '蝙蝠翅膀', pebble: '碎石', howl: '尖牙', echo: '回音石',
  cog: '齒輪零件', spark: '電光碎片', smelter: '熔渣', clock: '發條', wisp: '幽光粉', armor: '生鏽鐵片', gargoyle: '石像碎片', mirror: '鏡之碎片',
  crab: '蟹殼', lantern: '燈芯', pirate: '破舊頭巾', faceless: '千面面具', cultist: '黑色經文', shade: '影之結晶', eclipse: '蝕月核', valde: '蝕夜之心',
};
const CARD_STATS = ['hpPct', 'atkPct', 'crit', 'aspd', 'skill', 'dr', 'leech', 'soul'];
export const STAT_NAME = { hpPct: '生命', atkPct: '攻擊', crit: '暴擊率', aspd: '攻擊速度', skill: '技能傷害', dr: '減傷', leech: '吸血', soul: '魂力累積' };
const CARD_BASE = { hpPct: [5, 0.2], atkPct: [3, 0.12], crit: [2, 0.06], aspd: [3, 0.08], skill: [5, 0.15], dr: [2, 0.05], leech: [1, 0.03], soul: [6, 0.15] };
Object.keys(MONSTERS).forEach((k, i) => {
  const m = MONSTERS[k];
  ITEMS['mat_' + k] = { name: MAT_NAMES[k] || '素材', kind: 'mat', grade: m.boss ? 'rare' : 'junk', sellPrice: Math.max(1, Math.round(m.lv * (m.boss ? 20 : 1.5))), icon: 'mat', color: m.pal.g, desc: `${m.name}掉落的素材，可以賣錢` };
  const stat = CARD_STATS[i % CARD_STATS.length];
  const [b, per] = CARD_BASE[stat];
  ITEMS['card_' + k] = { name: `${m.name}卡片`, kind: 'card', grade: 'card', sellPrice: 50 + m.lv * 10, icon: 'card', color: m.pal.g, mon: k, stat, val: Math.round((b + per * m.lv) * (m.boss ? 2.5 : 1)), desc: '' };
  ITEMS['card_' + k].desc = `插進裝備卡槽：${CARD_EFFECT[k] ? cardDesc(k) : `${STAT_NAME[stat]} +${ITEMS['card_' + k].val}%`}`;
});
export const itemSell = (id) => ITEMS[id].sellPrice ?? Math.max(1, Math.round((ITEMS[id].price || 2) / 4));

// ---- 背包與設定 ----
export const BAG_SIZE = 60;
export function ensureInv(p) {
  if (!p.bag || typeof p.bag !== 'object') p.bag = {};
  if (!Array.isArray(p.bag.gear)) p.bag.gear = [];
  if (!p.bag.stack || typeof p.bag.stack !== 'object') p.bag.stack = {};
  for (const k of Object.keys(p.bag.stack)) if (!ITEMS[k] || !(p.bag.stack[k] > 0)) delete p.bag.stack[k];
  p.bag.gear = p.bag.gear.filter((it) => it && typeof it === 'object' && typeof it.val === 'number');
  const def = { equip: { common: true, good: false, rare: false, epic: false, legend: false }, item: { junk: false, common: false, rare: false, card: false }, autoEquip: true };
  if (!p.autoSell || typeof p.autoSell !== 'object') p.autoSell = def;
  for (const g of ['equip', 'item']) p.autoSell[g] = { ...def[g], ...(p.autoSell[g] || {}) };
  if (typeof p.autoSell.autoEquip !== 'boolean') p.autoSell.autoEquip = true;
  if (p.potions > 0) { p.bag.stack.red = (p.bag.stack.red || 0) + p.potions; p.potions = 0; }
  let uid = p.bag.uid || 1;
  for (const it of [...p.bag.gear, ...Object.values(p.gear || {})]) if (it) { if (!it.uid) it.uid = uid++; if (!Array.isArray(it.cards)) it.cards = []; if (!Number.isInteger(it.slots)) it.slots = 0; if (!Number.isInteger(it.refine)) it.refine = 0; }
  p.bag.uid = uid;
  return p;
}
export const count = (p, id) => p.bag.stack[id] || 0;
export function addStack(p, id, n = 1) { p.bag.stack[id] = count(p, id) + n; }
export function takeStack(p, id, n = 1) { if (count(p, id) < n) return false; p.bag.stack[id] -= n; if (!p.bag.stack[id]) delete p.bag.stack[id]; return true; }

// 卡槽：普通 20% 有 1 孔、優良 50% 1 孔、稀有 1 孔、史詩 1～2 孔、傳說 2 孔
export function rollSlots(rand, rarity) {
  const r = rarityIdx(rarity);
  return [rand() < 0.2 ? 1 : 0, rand() < 0.5 ? 1 : 0, 1, rand() < 0.5 ? 2 : 1, 2][r];
}
export function gearSell(it) { return Math.round(sellValue(it) * (1 + 0.15 * (it.refine || 0))); }

// 撿到裝備：比身上好就穿（換下的進背包或依設定賣掉）；否則依稀有度自動賣出或放進背包
export function pickupGear(p, it) {
  if (!it.uid) it.uid = p.bag.uid++;
  const cur = p.gear[it.slot];
  if (p.autoSell.autoEquip && (!cur || itemPower(it) > itemPower(cur))) {
    const before = stats(p).cp;
    p.gear[it.slot] = it;
    const res = { action: 'equip', before, after: stats(p).cp };
    if (cur) Object.assign(res, stash(p, cur, 'old'));
    return res;
  }
  return stash(p, it, '');
}
function stash(p, it, tag) {
  const k = tag ? 'old' : 'action';
  if (!it.locked && !it.cards?.length && !it.refine && p.autoSell.equip[it.rarity]) { const c = gearSell(it); p.coins += c; return { [k]: 'sell', coins: c }; }
  if (p.bag.gear.length >= BAG_SIZE) { const c = gearSell(it); p.coins += c; return { [k]: 'full', coins: c }; }
  p.bag.gear.push(it);
  return { [k]: 'bag' };
}
export function pickupItem(p, id, n = 1) {
  const d = ITEMS[id];
  if (p.autoSell.item[d.grade]) { const c = itemSell(id) * n; p.coins += c; return { action: 'sell', coins: c }; }
  addStack(p, id, n);
  return { action: 'bag' };
}

export function equipFromBag(p, uid) {
  const i = p.bag.gear.findIndex((x) => x.uid === uid);
  if (i < 0) return false;
  const it = p.bag.gear.splice(i, 1)[0];
  const cur = p.gear[it.slot];
  p.gear[it.slot] = it;
  if (cur) p.bag.gear.push(cur);
  return true;
}
export function unequip(p, slot) {
  const it = p.gear[slot];
  if (!it || p.bag.gear.length >= BAG_SIZE) return false;
  delete p.gear[slot]; p.bag.gear.push(it); return true;
}
export function sellFromBag(p, uid) {
  const i = p.bag.gear.findIndex((x) => x.uid === uid);
  if (i < 0 || p.bag.gear[i].locked) return 0;
  const c = gearSell(p.bag.gear.splice(i, 1)[0]); p.coins += c; return c;
}
export function sellStack(p, id, n = count(p, id)) {
  n = Math.min(n, count(p, id));
  if (n <= 0) return 0;
  takeStack(p, id, n); const c = itemSell(id) * n; p.coins += c; return c;
}
export function sellAllJunk(p) {
  let c = 0;
  for (const id of Object.keys(p.bag.stack)) if (ITEMS[id].grade === 'junk') c += sellStack(p, id);
  return c;
}
export const findGear = (p, uid) => Object.values(p.gear).find((x) => x && x.uid === uid) || p.bag.gear.find((x) => x.uid === uid);

export function insertCard(p, uid, cardId) {
  const it = findGear(p, uid), c = ITEMS[cardId];
  if (!it || !c || c.kind !== 'card') return { ok: false, reason: '找不到這張卡片或裝備' };
  if (it.cards.length >= it.slots) return { ok: false, reason: '這件裝備沒有空的卡槽' };
  if (!takeStack(p, cardId)) return { ok: false, reason: '背包裡沒有這張卡片' };
  it.cards.push({ id: cardId, stat: c.stat, val: c.val });
  return { ok: true };
}

// ---- 精煉：+1～+4 必成功，之後機率遞減；失敗只消耗材料，不會碎裝、不會掉級 ----
export const REFINE_RATE = [1, 1, 1, 1, 0.8, 0.7, 0.55, 0.45, 0.35, 0.25];
export const refineCost = (it) => ({ coins: Math.round(100 * (it.refine + 1) * (1 + it.lv / 10)), ore: it.refine >= 6 ? 'ore2' : 'ore' });
export function refine(p, uid, rand) {
  const it = findGear(p, uid);
  if (!it) return { ok: false, reason: '找不到這件裝備' };
  if (it.refine >= 10) return { ok: false, reason: '已經精煉到 +10 了' };
  const cost = refineCost(it);
  if (p.coins < cost.coins) return { ok: false, reason: `金幣不足（需要 ${cost.coins}）` };
  if (count(p, cost.ore) < 1) return { ok: false, reason: `缺少${ITEMS[cost.ore].name}` };
  p.coins -= cost.coins; takeStack(p, cost.ore);
  const success = rand() < REFINE_RATE[it.refine];
  if (success) it.refine++;
  return { ok: true, success, level: it.refine };
}

// ---- 掉落 ----
export function rollDrops(rand, type) {
  const m = MONSTERS[type], out = [];
  if (!m) return out;
  if (rand() < (m.boss ? 1 : 0.4)) out.push({ id: 'mat_' + type, n: m.boss ? 3 : 1 });
  if (rand() < (m.boss ? 0.05 : 0.003)) out.push({ id: 'card_' + type, n: 1 });
  if (rand() < (m.boss ? 1 : 0.03)) out.push({ id: m.lv >= 30 && rand() < 0.4 ? 'ore2' : 'ore', n: m.boss ? 2 : 1 });
  if (rand() < 0.04) out.push({ id: m.lv >= 30 ? 'orange' : 'red', n: 1 });
  if (rand() < (m.boss ? 0.5 : 0.004)) out.push({ id: 'elixir', n: 1 });
  return out;
}
export const shopList = (ch) => ['red', 'orange', 'white', 'scroll', 'feather'].filter((id) => ITEMS[id].unlock <= Math.max(1, ch));
export function buy(p, id, n = 1) {
  const cost = ITEMS[id].price * n;
  if (p.coins < cost) return { ok: false, reason: `金幣不足（需要 ${cost}）` };
  p.coins -= cost; addStack(p, id, n); return { ok: true };
}
// 藥水：優先用剛好夠的，避免浪費大瓶
export function pickPotion(p, missingPct) {
  const order = missingPct > 0.75 ? ['white', 'orange', 'red'] : missingPct > 0.4 ? ['orange', 'red', 'white'] : ['red', 'orange', 'white'];
  return order.find((id) => count(p, id) > 0) || null;
}
