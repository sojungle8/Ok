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

// ---- 數值 ----
export const MONSTERS = {
  slime: { name: '露珠史萊姆', hp: 4, atk: 1, exp: 3, coin: [1, 3], sight: 3 },
  berry: { name: '莓果史萊姆', hp: 9, atk: 2, exp: 8, coin: [3, 6], sight: 4 },
  king: { name: '史萊姆王', hp: 45, atk: 4, exp: 60, coin: [30, 50], sight: 5, boss: true },
};
export const expNeed = (lv) => 8 + lv * lv * 4;
export const maxHp = (lv) => 10 + lv * 4;
export const playerAtk = (lv, sword) => 1 + Math.floor(lv / 2) + sword;
export const swordCost = (sword) => 30 + sword * 40 + sword * sword * 20;
export const POTION_PRICE = 15, POTION_HEAL = 12;
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

// 經驗值結算：可能連升多級
export function gainExp(p, amount) {
  p.exp += amount;
  let ups = 0;
  while (p.exp >= expNeed(p.lv)) { p.exp -= expNeed(p.lv); p.lv++; ups++; }
  if (ups) p.hp = maxHp(p.lv);
  return ups;
}

export function newPlayer() {
  return { v: 1, lv: 1, exp: 0, hp: maxHp(1), coins: 0, potions: 1, sword: 0, fish: {}, kills: 0, quest: 0, x: SPAWN.x, y: SPAWN.y };
}

export function loadPlayer(raw) {
  try {
    const p = JSON.parse(raw);
    if (!p || p.v !== 1 || !Number.isInteger(p.lv) || p.lv < 1) throw 0;
    const d = newPlayer();
    for (const k of Object.keys(d)) if (typeof p[k] !== typeof d[k]) p[k] = d[k];
    p.hp = Math.min(Math.max(1, p.hp), maxHp(p.lv));
    return p;
  } catch { return newPlayer(); }
}
