// 微光大陸：地圖生成與數值公式（純函式，可測試）
export const W = 40, H = 28;
export const T = { GRASS: 0, FLOWER: 1, PATH: 2, WATER: 3, TREE: 4, BRIDGE: 5, HOUSE: 6, FOUNTAIN: 7, SIGN: 8, ROCK: 9 };
export const SOLID = new Set([T.WATER, T.TREE, T.HOUSE, T.FOUNTAIN, T.SIGN, T.ROCK]);
export const TOWN_EDGE = 18;           // x <= 18 是安全的村莊
export const FIELD_MIN_X = 21;         // 怪物只在河的東邊活動
export const BOSS_ZONE = { x0: 31, y0: 2, x1: 37, y1: 7 };

export function rng(seed) {
  let s = seed % 2147483647; if (s <= 0) s += 2147483646;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

export const HOUSES = [
  { x: 3, y: 3, roof: '#d0485a', roofD: '#8f2c3f', name: '雜貨店' },
  { x: 12, y: 3, roof: '#3f74d1', roofD: '#284c95', name: '村長家' },
  { x: 3, y: 20, roof: '#4f9a52', roofD: '#2f6b3a', name: '旅店' },
  { x: 12, y: 20, roof: '#8a5cc7', roofD: '#5b3a8f', name: '鐵匠鋪' },
];

export const NPCS = [
  { id: 'shop', x: 4, y: 7, name: '雜貨店・莉莉', look: { hair: '#e8a33d', hairD: '#b06f22', band: '#ff8fb1', bandD: '#d0587e', tunic: '#f3e2c3', tunicD: '#c9ad85' } },
  { id: 'elder', x: 13, y: 7, name: '村長・歐文', look: { hair: '#e8e4f0', hairD: '#b5b0c4', band: '#6b4fa0', bandD: '#46327a', tunic: '#8a5cc7', tunicD: '#5b3a8f' } },
  { id: 'inn', x: 4, y: 19, name: '旅店・瑪莎', look: { hair: '#c8553d', hairD: '#8f3626', band: '#f3e2c3', bandD: '#c9ad85', tunic: '#4f9a52', tunicD: '#2f6b3a' } },
  { id: 'smith', x: 13, y: 19, name: '鐵匠・葛倫', look: { hair: '#3b2a24', hairD: '#1f1512', band: '#6b6f85', bandD: '#454a5e', tunic: '#9a6337', tunicD: '#6b4024' } },
  { id: 'fisher', x: 18, y: 8, name: '釣客・阿杰', look: { hair: '#6b3e26', hairD: '#45261a', band: '#f6c945', bandD: '#c98b2b', tunic: '#4aa3df', tunicD: '#2d78b3' } },
];
export const SIGN = { x: 17, y: 12, text: ['→ 東邊：史萊姆草原', '小心！東北方的空地住著史萊姆王。'] };
export const SPAWN = { x: 9, y: 16 };
export const INN_SPOT = { x: 4, y: 18 };

export function buildWorld(seed = 11) {
  const g = Array.from({ length: H }, () => Array(W).fill(T.GRASS));
  const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const rect = (x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inb(x, y)) g[y][x] = t; };
  // 道路與廣場
  rect(2, 13, 37, 14, T.PATH);
  rect(5, 9, 15, 18, T.PATH);
  for (const h of HOUSES) rect(h.x + 1, h.y + 3, h.x + 1, 8, T.PATH);
  rect(4, 7, 4, 8, T.PATH); rect(13, 7, 13, 8, T.PATH);
  rect(16, 8, 18, 8, T.PATH); rect(16, 8, 16, 12, T.PATH);
  // 散布：村莊只有花，草原有樹石
  const r = rng(seed);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (g[y][x] !== T.GRASS) continue;
    const p = r();
    if (x <= TOWN_EDGE) { if (p < 0.14) g[y][x] = T.FLOWER; continue; }
    if (x >= FIELD_MIN_X) {
      if (Math.abs(y - 13.5) < 2.5) { if (p < 0.12) g[y][x] = T.FLOWER; continue; }
      if (p < 0.1) g[y][x] = T.TREE; else if (p < 0.13) g[y][x] = T.ROCK; else if (p < 0.22) g[y][x] = T.FLOWER;
    }
  }
  // 村莊外圍的樹籬
  for (let y = 1; y < H - 1; y++) if (y < 12 || y > 15) g[y][1] = T.TREE;
  // 河、橋
  rect(19, 0, 20, H - 1, T.WATER);
  rect(19, 13, 20, 14, T.BRIDGE);
  // 頭目空地
  rect(BOSS_ZONE.x0, BOSS_ZONE.y0, BOSS_ZONE.x1, BOSS_ZONE.y1, T.GRASS);
  rect(34, 8, 34, 12, T.PATH);
  // 外框
  for (let x = 0; x < W; x++) { if (x < 19 || x > 20) { g[0][x] = T.TREE; g[H - 1][x] = T.TREE; } }
  for (let y = 0; y < H; y++) { g[y][0] = T.TREE; g[y][W - 1] = T.TREE; }
  // 建築、噴水池、告示牌
  for (const h of HOUSES) rect(h.x, h.y, h.x + 2, h.y + 2, T.HOUSE);
  rect(9, 11, 10, 12, T.FOUNTAIN);
  g[SIGN.y][SIGN.x] = T.SIGN;
  return g;
}

export const walkable = (g, x, y) => x >= 0 && y >= 0 && x < W && y < H && !SOLID.has(g[y][x]);

export function reachable(g, from) {
  const seen = new Set([`${from.x},${from.y}`]);
  const q = [from];
  while (q.length) {
    const { x, y } = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (!seen.has(k) && walkable(g, nx, ny)) { seen.add(k); q.push({ x: nx, y: ny }); }
    }
  }
  return seen;
}

// ---- 數值（快節奏：幾刀一隻、幾十秒升一級）----
export const MONSTERS = {
  slime: { name: '露珠史萊姆', hp: 8, atk: 2, exp: 4, coin: [2, 5], lv: 1, sight: 3, zone: [21, 28] },
  berry: { name: '莓果史萊姆', hp: 24, atk: 5, exp: 12, coin: [5, 10], lv: 4, sight: 4, zone: [27, 33] },
  ember: { name: '餘燼史萊姆', hp: 55, atk: 9, exp: 28, coin: [10, 18], lv: 7, sight: 4, zone: [32, 38] },
  king: { name: '史萊姆王', hp: 420, atk: 13, exp: 320, coin: [150, 250], lv: 9, sight: 5, boss: true },
};
export const ROSTER = [...Array(10).fill('slime'), ...Array(8).fill('berry'), ...Array(6).fill('ember'), 'king'];
export const expNeed = (lv) => 10 + lv * lv * 6;
export const baseHp = (lv) => 20 + lv * 8;
export const baseAtk = (lv) => 3 + lv * 2;
export const swordCost = (sword) => 30 + sword * 40 + sword * sword * 20;
export const POTION_PRICE = 15, POTION_HEAL_PCT = 0.5;

// ---- 職業 ----
export const CLASSES = {
  sword: {
    name: '劍士', color: '#ff5a6e', role: '近戰・坦克', desc: '揮劍橫掃前方三格，血量最厚，適合正面硬打。',
    hpMul: 1.35, atkMul: 1, cool: 0.24, range: 1, weapon: 'sword', helm: 'helm', hair: '#6b3e26',
    outfit: { main: '#c8404f', dark: '#7a2533', trim: '#f6c945' },
    skills: [{ id: 'spin', name: '旋風斬', cd: 4 }, { id: 'wave', name: '破空劍氣', cd: 6 }, { id: 'quake', name: '天崩斬', cd: 14 }],
    names: { weapon: ['木劍', '鐵劍', '騎士長劍', '龍牙劍', '星辰聖劍'], helm: ['布帽', '皮盔', '鐵盔', '翼盔', '王者之冠'] },
  },
  archer: {
    name: '弓手', color: '#6fd36a', role: '遠程・輸出', desc: '7 格外放箭，攻速快，可以邊退邊打。',
    hpMul: 0.95, atkMul: 1, cool: 0.28, range: 7, weapon: 'bow', helm: 'hood', hair: '#e8a33d',
    outfit: { main: '#4f9a52', dark: '#2f6b3a', trim: '#e8d29a' },
    skills: [{ id: 'triple', name: '三連射', cd: 3 }, { id: 'rain', name: '箭雨', cd: 8 }, { id: 'pierce', name: '穿雲箭', cd: 11 }],
    names: { weapon: ['短弓', '獵弓', '精靈長弓', '風神弓', '星辰之弓'], helm: ['布兜帽', '皮兜帽', '遊俠兜帽', '風之兜帽', '星辰兜帽'] },
  },
  mage: {
    name: '法師', color: '#b48cff', role: '範圍・爆發', desc: '自動追蹤的魔法彈，冰、火、雷三系大範圍魔法。',
    hpMul: 0.85, atkMul: 1.6, cool: 0.42, range: 5, weapon: 'staff', helm: 'hat', hair: '#d8e4ff',
    outfit: { main: '#6b4fb0', dark: '#3f2c7a', trim: '#7fd8ff' },
    skills: [{ id: 'nova', name: '冰霜新星', cd: 6 }, { id: 'fireball', name: '火球術', cd: 4 }, { id: 'chain', name: '雷霆鎖鏈', cd: 9 }],
    names: { weapon: ['木杖', '學徒法杖', '秘銀法杖', '龍晶法杖', '星辰權杖'], helm: ['尖帽', '學徒帽', '秘法帽', '星象帽', '賢者之冠'] },
  },
  monk: {
    name: '拳師', color: '#ffa94d', role: '近戰・連打', desc: '攻速是劍士的兩倍，貼身之後就停不下來。',
    hpMul: 1.15, atkMul: 0.62, cool: 0.13, range: 1, weapon: 'fist', helm: 'band', hair: '#2b2230',
    outfit: { main: '#f08a3c', dark: '#9c4f1c', trim: '#fff1c4' },
    skills: [{ id: 'barrage', name: '百裂拳', cd: 5 }, { id: 'shock', name: '震地波', cd: 7 }, { id: 'dragon', name: '昇龍擊', cd: 11 }],
    names: { weapon: ['布手套', '皮拳套', '鐵拳套', '龍爪拳套', '星辰拳套'], helm: ['頭帶', '皮頭帶', '鐵頭帶', '龍紋頭帶', '星辰頭帶'] },
  },
};
export const CLASS_IDS = Object.keys(CLASSES);

export function stats(p) {
  const c = CLASSES[p.cls] || CLASSES.sword;
  let atk = (baseAtk(p.lv) + p.sword * 3) * c.atkMul, hp = baseHp(p.lv) * c.hpMul;
  for (const it of Object.values(p.gear || {})) { if (!it) continue; if (it.stat === 'atk') atk += it.val * c.atkMul; else hp += it.val; }
  atk = Math.round(atk); hp = Math.round(hp);
  // 戰鬥力用「每秒傷害」估算，讓不同攻速的職業可以比較
  return { atk, hp, cp: Math.round((atk / c.cool) * 3 + hp * 3 + p.lv * 20) };
}

export const RARITY = [
  { id: 'common', name: '普通', color: '#e8e4f0', w: 58, mult: 1 },
  { id: 'good', name: '優良', color: '#7ad35a', w: 26, mult: 1.4 },
  { id: 'rare', name: '稀有', color: '#4fb3ff', w: 11, mult: 2 },
  { id: 'epic', name: '史詩', color: '#c084ff', w: 4, mult: 2.9 },
  { id: 'legend', name: '傳說', color: '#ffb03b', w: 1, mult: 4.2 },
];
export const rarityIdx = (id) => Math.max(0, RARITY.findIndex((r) => r.id === id));
const GEAR = {
  weapon: { stat: 'atk', v: 2 },
  armor: { stat: 'hp', v: 8, names: ['布衣', '皮甲', '鎖子甲', '騎士鎧', '星辰戰鎧'] },
  helm: { stat: 'hp', v: 5 },
  ring: { stat: 'atk', v: 1, names: ['銅戒', '銀戒', '紅玉戒', '龍眼戒', '星辰之戒'] },
};
export const SLOTS = ['weapon', 'helm', 'armor', 'ring'];
export const SLOT_NAME = { weapon: '武器', helm: '頭部', armor: '防具', ring: '戒指' };
export const DROP_RATE = 0.22;

export function rollGear(rand, mlv, boss = false, cls = 'sword') {
  const slot = SLOTS[Math.floor(rand() * SLOTS.length)];
  const pool = boss ? RARITY.slice(2) : RARITY;
  let t = rand() * pool.reduce((a, r) => a + r.w, 0);
  let rar = pool[0];
  for (const r of pool) { t -= r.w; if (t < 0) { rar = r; break; } }
  const g = GEAR[slot];
  const names = g.names || (CLASSES[cls] || CLASSES.sword).names[slot];
  // 外觀跟稀有度走：稀有度越高，名字和外觀越華麗
  const tier = rarityIdx(rar.id);
  return { slot, rarity: rar.id, name: names[tier], stat: g.stat, val: Math.max(1, Math.round(g.v * (1 + mlv * 0.7) * rar.mult)), lv: mlv };
}
export const rarityOf = (id) => RARITY.find((r) => r.id === id) || RARITY[0];
export const sellValue = (it) => Math.max(1, Math.round(it.val * 1.5));

export function equipIfBetter(p, it) {
  const cur = p.gear[it.slot];
  if (!cur || it.val > cur.val) {
    const before = stats(p).cp;
    p.gear[it.slot] = it;
    return { equipped: true, before, after: stats(p).cp };
  }
  const sold = sellValue(it);
  p.coins += sold;
  return { equipped: false, sold };
}

export const FISH = [
  { id: 'carp', name: '小鯽魚', weight: 60, price: 3 },
  { id: 'trout', name: '彩虹鱒', weight: 30, price: 8 },
  { id: 'gold', name: '黃金鯉', weight: 10, price: 25 },
];
export function rollFish(rand) {
  let t = rand() * FISH.reduce((a, f) => a + f.weight, 0);
  for (const f of FISH) { t -= f.weight; if (t < 0) return f; }
  return FISH[0];
}

export function gainExp(p, amount) {
  p.exp += amount;
  let ups = 0;
  while (p.exp >= expNeed(p.lv)) { p.exp -= expNeed(p.lv); p.lv++; ups++; }
  if (ups) p.hp = stats(p).hp;
  return ups;
}

export function newPlayer(cls = 'sword', name = '冒險者') {
  const p = { v: 3, cls: CLASSES[cls] ? cls : 'sword', name: String(name).slice(0, 8) || '冒險者', lv: 1, exp: 0, hp: 0, coins: 0, potions: 3, sword: 0, gear: {}, fish: {}, kills: 0, quest: 0, x: SPAWN.x, y: SPAWN.y };
  p.hp = stats(p).hp;
  return p;
}

const validItem = (it) => it && SLOTS.includes(it.slot) && typeof it.val === 'number' && (it.stat === 'atk' || it.stat === 'hp') && typeof it.name === 'string';

export function loadPlayer(raw) {
  try {
    const p = JSON.parse(raw);
    if (!p || ![1, 2, 3].includes(p.v) || !Number.isInteger(p.lv) || p.lv < 1) throw 0;
    const d = newPlayer(p.cls, p.name);
    for (const k of Object.keys(d)) if (typeof p[k] !== typeof d[k] || p[k] === null) p[k] = d[k];
    p.v = 3;
    if (!CLASSES[p.cls]) p.cls = 'sword';
    for (const k of Object.keys(p.gear)) if (!SLOTS.includes(k) || !validItem(p.gear[k])) delete p.gear[k];
    p.hp = Math.min(Math.max(1, p.hp), stats(p).hp);
    return p;
  } catch { return newPlayer(); }
}
