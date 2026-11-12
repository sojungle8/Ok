// 喵喵小窩：純遊戲邏輯（無 DOM），所有隨機都由外部傳入 rand() 以便測試。

export const MATERIALS = {
  wood: { name: '木材', emoji: '🪵', weight: 30 },
  cloth: { name: '布料', emoji: '🧵', weight: 30 },
  yarn: { name: '毛線', emoji: '🧶', weight: 25 },
  glass: { name: '玻璃', emoji: '🔮', weight: 15 },
};
export const MATERIAL_PRICE = 25;

export const RARITY = {
  common: { label: '普通', weight: 60 },
  rare: { label: '稀有', weight: 28 },
  epic: { label: '史詩', weight: 10 },
  legendary: { label: '傳說', weight: 2 },
};
export const SUMMON_COST = 100;
export const PITY_LIMIT = 10; // 連續 10 抽沒出史詩以上，第 10 抽保底

// 原創貓咪角色
export const CATS = [
  { id: 'mochi', name: '麻糬', rarity: 'common', color: '#fff4e6', accent: '#f2c48d', pattern: 'patch' },
  { id: 'tofu', name: '豆腐', rarity: 'common', color: '#ffffff', accent: '#d9d9d9', pattern: 'none' },
  { id: 'mango', name: '芒果', rarity: 'common', color: '#ffc46b', accent: '#e8913a', pattern: 'stripes' },
  { id: 'sesame', name: '芝麻', rarity: 'common', color: '#3b3330', accent: '#5c524d', pattern: 'none' },
  { id: 'latte', name: '拿鐵', rarity: 'common', color: '#d9b38c', accent: '#a87a52', pattern: 'patch' },
  { id: 'boba', name: '珍奶', rarity: 'common', color: '#c8a27a', accent: '#4a3426', pattern: 'spots' },
  { id: 'peach', name: '蜜桃', rarity: 'rare', color: '#ffd1dc', accent: '#ff9eb5', pattern: 'patch' },
  { id: 'matcha', name: '抹茶', rarity: 'rare', color: '#cfe8b8', accent: '#8fbf6a', pattern: 'stripes' },
  { id: 'taro', name: '芋頭', rarity: 'rare', color: '#d9c6f0', accent: '#a98bd6', pattern: 'spots' },
  { id: 'cocoa', name: '可可', rarity: 'rare', color: '#8a5a3c', accent: '#5e3a24', pattern: 'stripes' },
  { id: 'soda', name: '汽水', rarity: 'epic', color: '#bfe9ff', accent: '#5bbbe8', pattern: 'spots' },
  { id: 'pudding', name: '布丁', rarity: 'epic', color: '#ffe680', accent: '#c98a3a', pattern: 'patch' },
  { id: 'sakura', name: '櫻花', rarity: 'epic', color: '#ffe3ec', accent: '#ff7fa8', pattern: 'spots' },
  { id: 'galaxy', name: '星河', rarity: 'legendary', color: '#3a3f8f', accent: '#ffd76a', pattern: 'spots' },
  { id: 'aurora', name: '極光', rarity: 'legendary', color: '#b8f2e6', accent: '#9b7bff', pattern: 'stripes' },
];

export const FURNITURE = [
  { id: 'cushion', name: '軟軟坐墊', emoji: '🟠', price: 40, recipe: { cloth: 2 }, comfort: 2 },
  { id: 'yarnball', name: '大毛線球', emoji: '🧶', price: 40, recipe: { yarn: 2 }, comfort: 2 },
  { id: 'box', name: '紙箱城堡', emoji: '📦', price: 50, recipe: { wood: 2, cloth: 1 }, comfort: 3 },
  { id: 'plant', name: '貓草盆栽', emoji: '🪴', price: 60, recipe: { wood: 1, glass: 1 }, comfort: 3 },
  { id: 'bed', name: '雲朵貓窩', emoji: '🛏️', price: 90, recipe: { cloth: 3, yarn: 2 }, comfort: 5 },
  { id: 'lamp', name: '月亮檯燈', emoji: '🌙', price: 90, recipe: { glass: 2, wood: 1 }, comfort: 4 },
  { id: 'tower', name: '貓跳台', emoji: '🗼', price: 150, recipe: { wood: 4, yarn: 2 }, comfort: 7 },
  { id: 'tank', name: '魚缸電視', emoji: '🐠', price: 150, recipe: { glass: 3, wood: 2 }, comfort: 7 },
  { id: 'sofa', name: '甜甜圈沙發', emoji: '🍩', price: 200, recipe: { cloth: 4, yarn: 3, wood: 1 }, comfort: 9 },
];

// 每日任務池：每一項都能從零完成（不依賴已擁有的東西）
export const QUEST_POOL = [
  { type: 'play', goal: 2, text: '玩 2 次小遊戲' },
  { type: 'play', goal: 3, text: '玩 3 次小遊戲' },
  { type: 'stars', goal: 3, text: '小遊戲累積 3 顆星' },
  { type: 'pet', goal: 5, text: '摸摸貓咪 5 次' },
  { type: 'feed', goal: 1, text: '餵貓咪吃 1 塊餅乾' },
  { type: 'feed', goal: 2, text: '餵貓咪吃 2 塊餅乾' },
];
export const QUEST_REWARD = { coins: 60, mats: 2 };
export const DAILY_PET_COOKIES = 8; // 每天前 8 次摸摸各給 1 塊餅乾

export function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function newState(today, rand = Math.random) {
  const s = {
    v: 1,
    coins: 300,
    cookies: 3,
    materials: Object.fromEntries(Object.keys(MATERIALS).map((k) => [k, 0])),
    cats: { mochi: { affection: 0 } }, // 送一隻起始貓，進遊戲就能互動
    blueprints: [],
    furniture: [],
    pity: 0,
    daily: null,
  };
  ensureDaily(s, today, rand);
  return s;
}

// 驗證並修補讀檔資料，壞檔就重開
export function loadState(raw, today, rand = Math.random) {
  try {
    const s = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!s || s.v !== 1 || typeof s.coins !== 'number') throw new Error('bad');
    for (const k of Object.keys(MATERIALS)) if (typeof s.materials?.[k] !== 'number') s.materials[k] = 0;
    s.cats = s.cats && typeof s.cats === 'object' ? s.cats : {};
    for (const id of Object.keys(s.cats)) if (!CATS.some((c) => c.id === id)) delete s.cats[id];
    if (!Object.keys(s.cats).length) s.cats.mochi = { affection: 0 };
    s.blueprints = Array.isArray(s.blueprints) ? s.blueprints.filter((id) => getFurniture(id)) : [];
    s.furniture = Array.isArray(s.furniture) ? s.furniture.filter((id) => getFurniture(id)) : [];
    s.pity = Number.isInteger(s.pity) ? s.pity : 0;
    s.cookies = Number.isInteger(s.cookies) ? s.cookies : 0;
    ensureDaily(s, today, rand);
    return s;
  } catch {
    return newState(today, rand);
  }
}

export function ensureDaily(s, today, rand = Math.random) {
  if (s.daily && s.daily.date === today) return false;
  const pool = [...QUEST_POOL];
  const types = new Set();
  const quests = [];
  while (quests.length < 3 && pool.length) {
    const q = pool.splice(Math.floor(rand() * pool.length), 1)[0];
    if (types.has(q.type)) continue; // 同類任務不重複
    types.add(q.type);
    quests.push({ ...q, progress: 0, claimed: false });
  }
  s.daily = { date: today, quests, petCookies: 0 };
  return true;
}

export function addProgress(s, type, n = 1) {
  for (const q of s.daily.quests) if (q.type === type) q.progress = Math.min(q.goal, q.progress + n);
}

function weightedPick(entries, rand) {
  const total = entries.reduce((t, [, w]) => t + w, 0);
  let r = rand() * total;
  for (const [k, w] of entries) { r -= w; if (r < 0) return k; }
  return entries[entries.length - 1][0];
}

export function randomMaterials(count, rand) {
  const got = {};
  const entries = Object.entries(MATERIALS).map(([k, m]) => [k, m.weight]);
  for (let i = 0; i < count; i++) {
    const k = weightedPick(entries, rand);
    got[k] = (got[k] || 0) + 1;
  }
  return got;
}

function addMaterials(s, got) {
  for (const [k, n] of Object.entries(got)) s.materials[k] += n;
}

export const getCat = (id) => CATS.find((c) => c.id === id);
export const getFurniture = (id) => FURNITURE.find((f) => f.id === id);

export function summon(s, rand = Math.random) {
  if (s.coins < SUMMON_COST) return { ok: false, reason: `金幣不足（需要 ${SUMMON_COST}）` };
  s.coins -= SUMMON_COST;
  s.pity += 1;
  let entries = Object.entries(RARITY).map(([k, r]) => [k, r.weight]);
  if (s.pity >= PITY_LIMIT) entries = entries.filter(([k]) => k === 'epic' || k === 'legendary');
  const rarity = weightedPick(entries, rand);
  if (rarity === 'epic' || rarity === 'legendary') s.pity = 0;
  const pool = CATS.filter((c) => c.rarity === rarity);
  const cat = pool[Math.floor(rand() * pool.length)];
  const isNew = !s.cats[cat.id];
  let bonus = 0;
  if (isNew) s.cats[cat.id] = { affection: 0 };
  else { bonus = 3; s.cookies += bonus; } // 重複的貓轉成餅乾，不浪費
  return { ok: true, cat, isNew, bonus };
}

// 小遊戲結算：星數越多，金幣與「隨機」材料越多；0 星也有安慰獎
export function starsFor(layers) {
  return layers >= 10 ? 3 : layers >= 6 ? 2 : layers >= 3 ? 1 : 0;
}

export function finishGame(s, layers, rand = Math.random) {
  const stars = starsFor(layers);
  const coins = 15 + stars * 20 + layers * 2;
  const mats = randomMaterials(1 + stars * 2, rand);
  s.coins += coins;
  addMaterials(s, mats);
  addProgress(s, 'play', 1);
  if (stars) addProgress(s, 'stars', stars);
  return { stars, coins, mats };
}

export function missingFor(s, id) {
  const f = getFurniture(id);
  const miss = {};
  for (const [k, n] of Object.entries(f.recipe)) if (s.materials[k] < n) miss[k] = n - s.materials[k];
  return miss;
}

export function buyBlueprint(s, id) {
  const f = getFurniture(id);
  if (!f) return { ok: false, reason: '找不到這個藍圖' };
  if (s.blueprints.includes(id)) return { ok: false, reason: '已經有這張藍圖了' };
  if (s.coins < f.price) return { ok: false, reason: `金幣不足（需要 ${f.price}）` };
  s.coins -= f.price;
  s.blueprints.push(id);
  return { ok: true };
}

export function craft(s, id) {
  const f = getFurniture(id);
  if (!f || !s.blueprints.includes(id)) return { ok: false, reason: '需要先買藍圖' };
  const miss = missingFor(s, id);
  if (Object.keys(miss).length) return { ok: false, reason: '材料不足', miss };
  for (const [k, n] of Object.entries(f.recipe)) s.materials[k] -= n;
  s.furniture.push(id);
  return { ok: true };
}

export function buyMaterial(s, k) {
  if (!MATERIALS[k]) return { ok: false, reason: '沒有這種材料' };
  if (s.coins < MATERIAL_PRICE) return { ok: false, reason: `金幣不足（需要 ${MATERIAL_PRICE}）` };
  s.coins -= MATERIAL_PRICE;
  s.materials[k] += 1;
  return { ok: true };
}

export function pet(s, id) {
  if (!s.cats[id]) return { ok: false };
  s.cats[id].affection += 1;
  addProgress(s, 'pet', 1);
  let cookie = 0;
  if (s.daily.petCookies < DAILY_PET_COOKIES) { s.daily.petCookies += 1; s.cookies += 1; cookie = 1; }
  return { ok: true, cookie };
}

export function feed(s, id) {
  if (!s.cats[id]) return { ok: false, reason: '沒有這隻貓' };
  if (s.cookies < 1) return { ok: false, reason: '沒有餅乾了，摸摸貓咪可以拿到餅乾喔' };
  s.cookies -= 1;
  s.cats[id].affection += 5;
  addProgress(s, 'feed', 1);
  return { ok: true };
}

export function heartLevel(aff) {
  return Math.min(5, Math.floor(aff / 10));
}

export function claimQuest(s, idx, rand = Math.random) {
  const q = s.daily.quests[idx];
  if (!q || q.claimed || q.progress < q.goal) return { ok: false };
  q.claimed = true;
  s.coins += QUEST_REWARD.coins;
  const mats = randomMaterials(QUEST_REWARD.mats, rand);
  addMaterials(s, mats);
  return { ok: true, coins: QUEST_REWARD.coins, mats };
}

export function comfort(s) {
  return s.furniture.reduce((t, id) => t + getFurniture(id).comfort, 0);
}
