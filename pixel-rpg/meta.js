// 微光大陸：長期玩法——每日／每週任務、簽到、怪物圖鑑、成就、精英怪、試煉之塔（純函式，可測試）
import { MONSTERS, CHAPTERS, expNeed, rng } from './world.js';
import { ITEMS } from './items.js';

// ---- 日期 ----
const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const weekKey = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dayKey(d.getTime()); };
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return Math.abs(h) || 1; };

export function ensureMeta(p) {
  const m = (p.meta && typeof p.meta === 'object') ? p.meta : {};
  m.day ??= ''; m.daily ??= []; m.act ??= 0; m.chests ??= [];
  m.week ??= ''; m.weekly ??= [];
  m.login ??= { last: '', n: 0 };
  m.codex ??= {}; m.ach ??= {}; m.title ??= '';
  m.tower ??= { best: 0 };
  m.st ??= {};
  p.meta = m;
  return m;
}
const unlockedCh = (p) => Math.max(1, Math.min(6, p.ch));
export const fieldMons = (p) => CHAPTERS.slice(0, unlockedCh(p)).flatMap((c) => c.mons);

// ---- 獎勵 ----
// 獎勵格式：{ coins, exp, stones, items: { id: n } }
export const rewardText = (r) => [
  r.coins && `金幣 ${r.coins}`, r.exp && `經驗 ${r.exp}`, r.stones && `魂石 ${r.stones}`,
  ...Object.entries(r.items || {}).filter(([, n]) => n > 0).map(([id, n]) => `${ITEMS[id]?.name || id} ×${n}`),
].filter(Boolean).join('、');
const lvCoins = (p, k) => Math.round(k * (40 + p.lv * 12));
const lvExp = (p, k) => Math.round(k * expNeed(p.lv));

// ---- 每日任務 ----
// ev：kill（擊敗怪物）、elite、boss、skill、ult、tower（通過一層）、refine、fish、coin
const DAILY_POOL = [
  { id: 'kill', ev: 'kill', need: 40, text: (q) => `擊敗 ${q.need} 隻怪物` },
  { id: 'killT', ev: 'kill', need: 15, text: (q) => `擊敗 ${q.need} 隻「${MONSTERS[q.mon].name}」`, mon: true },
  { id: 'elite', ev: 'elite', need: 3, text: (q) => `擊敗 ${q.need} 隻精英怪` },
  { id: 'boss', ev: 'boss', need: 1, text: () => '擊敗任意魔王 1 次（含試煉之塔）' },
  { id: 'skill', ev: 'skill', need: 30, text: (q) => `使用職業技能 ${q.need} 次` },
  { id: 'ult', ev: 'ult', need: 3, text: (q) => `施放魂像大招 ${q.need} 次`, req: (p) => !!p.soul },
  { id: 'tower', ev: 'tower', need: 3, text: (q) => `在試煉之塔通過 ${q.need} 層` },
  { id: 'refine', ev: 'refine', need: 2, text: (q) => `精煉裝備 ${q.need} 次（成功失敗都算）` },
  { id: 'fish', ev: 'fish', need: 3, text: (q) => `在村子東邊的河釣到 ${q.need} 條魚` },
  { id: 'coin', ev: 'coin', need: 0, text: (q) => `撿起 ${q.need} 金幣` },
  { id: 'chest', ev: 'chest', need: 2, text: (q) => `在野外找到並打開 ${q.need} 個寶箱` },
];
export const DAILY_COUNT = 5, DAILY_PTS = 20;
export const CHESTS = [20, 40, 60, 80, 100];
export function chestReward(p, i) {
  return [
    { coins: lvCoins(p, 2) }, { items: { ore: 3, orange: 3 } }, { stones: 60 },
    { items: { ore: 4, elixir: 1 }, coins: lvCoins(p, 2) }, { stones: 120, items: { ore2: p.lv >= 25 ? 2 : 0, ore: p.lv >= 25 ? 0 : 6 } },
  ][i];
}
export function rollDaily(p, day = dayKey()) {
  const r = rng(hash(day + p.name + p.cls));
  const pool = DAILY_POOL.filter((q) => !q.req || q.req(p));
  const picks = [];
  while (picks.length < DAILY_COUNT && pool.length) picks.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  const mons = fieldMons(p);
  return picks.map((d) => {
    const q = { id: d.id, ev: d.ev, need: d.need, prog: 0, claimed: false };
    if (d.mon) q.mon = mons[Math.floor(r() * mons.length)];
    if (d.id === 'coin') q.need = Math.round((200 + p.lv * 40) / 10) * 10;
    q.reward = { coins: lvCoins(p, 1), exp: lvExp(p, 0.25) };
    return q;
  });
}
export const questLabel = (q) => (DAILY_POOL.find((d) => d.id === q.id) || WEEKLY_POOL.find((d) => d.id === q.id))?.text(q) || q.id;

// ---- 每週任務 ----
const WEEKLY_POOL = [
  { id: 'wkill', ev: 'kill', need: 600, text: (q) => `本週擊敗 ${q.need} 隻怪物` },
  { id: 'welite', ev: 'elite', need: 25, text: (q) => `本週擊敗 ${q.need} 隻精英怪` },
  { id: 'wtower', ev: 'tower', need: 15, text: (q) => `本週在試煉之塔通過 ${q.need} 層` },
  { id: 'wboss', ev: 'boss', need: 6, text: (q) => `本週擊敗魔王 ${q.need} 次` },
  { id: 'wdaily', ev: 'dailyAll', need: 5, text: (q) => `本週有 ${q.need} 天完成全部每日任務` },
];
export function rollWeekly(p) {
  return WEEKLY_POOL.map((d) => ({ id: d.id, ev: d.ev, need: d.need, prog: 0, claimed: false, reward: { stones: 150, coins: lvCoins(p, 4), items: { ore: 5, ore2: p.lv >= 25 ? 1 : 0 } } }));
}

// 換日／換週時重抽
export function refresh(p, t = Date.now()) {
  const m = ensureMeta(p), d = dayKey(t), w = weekKey(t);
  let changed = false;
  if (m.day !== d) { m.day = d; m.daily = rollDaily(p, d); m.act = 0; m.chests = []; changed = true; }
  if (m.week !== w) { m.week = w; m.weekly = rollWeekly(p); changed = true; }
  return changed;
}

// ---- 事件追蹤 ----
// 回傳這次剛完成的任務（給畫面提示）
export function track(p, ev, n = 1, info = {}) {
  const m = ensureMeta(p);
  m.st[ev] = (m.st[ev] || 0) + n;
  if (ev === 'kill' && info.type) m.codex[info.type] = (m.codex[info.type] || 0) + n;
  const done = [];
  for (const q of [...m.daily, ...m.weekly]) {
    if (q.ev !== ev || q.prog >= q.need) continue;
    if (q.mon && info.type !== q.mon) continue;
    q.prog = Math.min(q.need, q.prog + n);
    if (q.prog >= q.need) done.push(q);
  }
  return done;
}
export function claimQuest(p, q) {
  const m = ensureMeta(p);
  if (q.claimed || q.prog < q.need) return null;
  q.claimed = true;
  if (m.daily.includes(q)) {
    m.act = Math.min(100, m.act + DAILY_PTS);
    if (m.daily.every((x) => x.claimed) && m.allDay !== m.day) { m.allDay = m.day; track(p, 'dailyAll'); }
  }
  return q.reward;
}
export function claimChest(p, i) {
  const m = ensureMeta(p);
  if (m.chests.includes(i) || m.act < CHESTS[i]) return null;
  m.chests.push(i); return chestReward(p, i);
}
export function claimable(p) {
  const m = ensureMeta(p);
  return [...m.daily, ...m.weekly].some((q) => !q.claimed && q.prog >= q.need) || CHESTS.some((v, i) => m.act >= v && !m.chests.includes(i)) || m.login.last !== m.day || achReady(p).length > 0 || monthClaimable(p);
}

// ---- 簽到（累計天數，不會因為漏簽歸零）----
export const LOGIN_CYCLE = 7;
export function loginReward(p, n) {
  const k = ((n - 1) % LOGIN_CYCLE) + 1, big = n >= LOGIN_CYCLE;
  return [null,
    { coins: lvCoins(p, 2) }, { items: { orange: 5, scroll: 2 } }, { items: { ore: 5 } }, { stones: 100 },
    { items: { elixir: 2, white: 2 } }, { items: { ore2: 2, ore: 3 } }, { stones: big ? 300 : 250, coins: lvCoins(p, 4) },
  ][k];
}
export function claimLogin(p, t = Date.now()) {
  const m = ensureMeta(p), d = dayKey(t);
  if (m.login.last === d) return null;
  m.login.last = d; m.login.n += 1;
  return { n: m.login.n, reward: loginReward(p, m.login.n) };
}

// ---- 怪物圖鑑：打越多隻，永久加成越高 ----
export const CODEX_TIERS = (boss) => (boss ? [1, 5, 20] : [30, 150, 600]);
export const codexStars = (type, kills = 0) => CODEX_TIERS(MONSTERS[type]?.boss).filter((v) => kills >= v).length;
// 每顆星：一般怪 +0.4%，魔王 +1%；奇數順序的怪加攻擊、偶數加生命
export function codexBonus(p) {
  const m = ensureMeta(p), out = { atkPct: 0, hpPct: 0 };
  Object.keys(MONSTERS).forEach((t, i) => {
    const s = codexStars(t, m.codex[t]);
    if (!s) return;
    out[i % 2 ? 'hpPct' : 'atkPct'] += s * (MONSTERS[t].boss ? 1 : 0.4);
  });
  out.atkPct = Math.round(out.atkPct * 10) / 10; out.hpPct = Math.round(out.hpPct * 10) / 10;
  return out;
}

// ---- 成就與稱號 ----
export const ACHIEVEMENTS = [
  { id: 'k100', title: '見習獵人', text: '累計擊敗 100 隻怪物', st: 'kill', need: 100, stones: 50 },
  { id: 'k1000', title: '百戰老兵', text: '累計擊敗 1000 隻怪物', st: 'kill', need: 1000, stones: 150 },
  { id: 'k10000', title: '草原傳說', text: '累計擊敗 10000 隻怪物', st: 'kill', need: 10000, stones: 500 },
  { id: 'e10', title: '精英剋星', text: '擊敗 10 隻精英怪', st: 'elite', need: 10, stones: 80 },
  { id: 'e100', title: '精英獵殺者', text: '擊敗 100 隻精英怪', st: 'elite', need: 100, stones: 300 },
  { id: 'b10', title: '魔王挑戰者', text: '擊敗魔王 10 次', st: 'boss', need: 10, stones: 150 },
  { id: 'b50', title: '弒王者', text: '擊敗魔王 50 次', st: 'boss', need: 50, stones: 400 },
  { id: 't10', title: '攀塔者', text: '試煉之塔到達第 10 層', tower: 10, stones: 120 },
  { id: 't25', title: '塔之征服者', text: '試煉之塔到達第 25 層', tower: 25, stones: 300 },
  { id: 't50', title: '天頂之人', text: '試煉之塔到達第 50 層', tower: 50, stones: 800 },
  { id: 'r20', title: '鐵匠之友', text: '精煉 20 次', st: 'refine', need: 20, stones: 100 },
  { id: 'f30', title: '河畔釣客', text: '釣到 30 條魚', st: 'fish', need: 30, stones: 80 },
  { id: 'd7', title: '勤勉冒險者', text: '完成全部每日任務 7 天', st: 'dailyAll', need: 7, stones: 200 },
  { id: 'l30', title: '老朋友', text: '累計簽到 30 天', login: 30, stones: 300 },
  { id: 'c15', title: '博物學者', text: '圖鑑收集 15 種怪物（★1 以上）', codex: 15, stones: 200 },
  { id: 'cAll', title: '圖鑑大師', text: '全部怪物圖鑑 ★3', codexAll: 3, stones: 1000 },
];
export function achProgress(p, a) {
  const m = ensureMeta(p);
  if (a.st) return [Math.min(a.need, m.st[a.st] || 0), a.need];
  if (a.tower) return [Math.min(a.tower, m.tower.best), a.tower];
  if (a.login) return [Math.min(a.login, m.login.n), a.login];
  const types = Object.keys(MONSTERS);
  if (a.codex) { const n = types.filter((t) => codexStars(t, m.codex[t]) >= 1).length; return [Math.min(a.codex, n), a.codex]; }
  const n = types.filter((t) => codexStars(t, m.codex[t]) >= a.codexAll).length; return [n, types.length];
}
export const achReady = (p) => ACHIEVEMENTS.filter((a) => { const [v, need] = achProgress(p, a); return v >= need && !ensureMeta(p).ach[a.id]; });
export function claimAch(p, id) {
  const a = ACHIEVEMENTS.find((x) => x.id === id), m = ensureMeta(p);
  if (!a || m.ach[id]) return null;
  const [v, need] = achProgress(p, a); if (v < need) return null;
  m.ach[id] = true; if (!m.title) m.title = a.title;
  return { stones: a.stones };
}

// ---- 精英怪 ----
export const ELITE_AFFIX = {
  rage: { name: '狂暴', color: '#ff5a5a', hp: 2.2, atk: 1.8 },
  armor: { name: '鐵壁', color: '#9ad0ff', hp: 4, atk: 1.2 },
  regen: { name: '再生', color: '#7ad35a', hp: 2.6, atk: 1.3 },
  blast: { name: '爆裂', color: '#ffb03b', hp: 2.4, atk: 1.4 },
  giant: { name: '巨大', color: '#c084ff', hp: 3.2, atk: 1.6 },
};
export const ELITE_RATE = 0.07;
export function makeElite(base, rand) {
  const ids = Object.keys(ELITE_AFFIX), id = ids[Math.floor(rand() * ids.length)], a = ELITE_AFFIX[id];
  return { ...base, name: `${a.name}${base.name}`, hp: Math.round(base.hp * a.hp), atk: Math.round(base.atk * a.atk), exp: base.exp * 4, coin: [base.coin[0] * 3, base.coin[1] * 4], elite: id };
}

// ---- 試煉之塔：無限層數，越高越難 ----
// 每層要在時限內清光；每 5 層是魔王層
export const towerLv = (f) => 3 + f * 2;
export const TOWER_TIME = 60;
const scaled = (lv) => ({ hp: Math.round(6 * lv + 0.35 * lv * lv), atk: Math.round(1.5 + 0.9 * lv + 0.012 * lv * lv) });
export function towerFloor(p, f) {
  const chs = unlockedCh(p);
  const c = CHAPTERS[(f - 1) % chs], lv = towerLv(f), s = scaled(lv);
  const boss = f % 5 === 0;
  const mon = (type) => ({ ...MONSTERS[type], lv, hp: Math.round(s.hp * 2.1), atk: Math.round(s.atk * 1.3), exp: Math.round((3 + 1.6 * lv) * 1.5), coin: [lv, lv * 2], zone: [10, 37], boss: false, mech: undefined, trial: true });
  const list = [];
  const n = boss ? 4 : 8 + Math.min(6, Math.floor(f / 4));
  for (let i = 0; i < n; i++) list.push({ type: c.mons[i % 3], d: mon(c.mons[i % 3]) });
  if (boss) list.push({ type: c.boss, d: { ...MONSTERS[c.boss], name: `試煉・${MONSTERS[c.boss].name}`, lv, hp: Math.round(s.hp * 36), atk: Math.round(s.atk * 2.3), exp: lv * 40, coin: [lv * 10, lv * 15], boss: true, mech: undefined, trial: true } });
  return { ch: c.n, lv, boss, list, time: TOWER_TIME + (boss ? 30 : 0) };
}
export function towerReward(p, f) {
  const m = ensureMeta(p), first = f > m.tower.best;
  const r = { coins: Math.round(60 + f * 25), exp: lvExp(p, 0.06 + (f % 5 === 0 ? 0.12 : 0)) };
  if (first) {
    r.stones = 10 + f * 2;
    if (f % 5 === 0) r.items = { ore: 2 + Math.floor(f / 10), ore2: f >= 20 ? 1 + Math.floor(f / 20) : 0, elixir: 1 };
  }
  return { reward: r, first, gear: f % 5 === 0 && first };
}
export function towerClear(p, f) { const m = ensureMeta(p); const r = towerReward(p, f); if (f > m.tower.best) m.tower.best = f; return r; }

// ---- 冒險難度：越難，怪物越強，經驗、金幣、掉寶也越多 ----
export const DIFFS = [
  { name: '普通', color: '#a6ec7a', hp: 1, atk: 1, exp: 1, coin: 1, drop: 1, rare: 0, desc: '標準難度' },
  { name: '困難', color: '#ffb03b', hp: 1.8, atk: 1.5, exp: 1.6, coin: 1.7, drop: 1.5, rare: 0.15, desc: '怪物血量 ×1.8、攻擊 ×1.5；經驗 ×1.6、金幣 ×1.7、掉寶 ×1.5，高稀有度裝備機率提升' },
  { name: '惡夢', color: '#ff5a6e', hp: 3.2, atk: 2.2, exp: 2.4, coin: 2.6, drop: 2.2, rare: 0.35, desc: '怪物血量 ×3.2、攻擊 ×2.2；經驗 ×2.4、金幣 ×2.6、掉寶 ×2.2，常掉高稀有度裝備' },
];
export const diffOf = (p) => DIFFS[Math.max(0, Math.min(DIFFS.length - 1, p.diff | 0))];
export function applyDiff(d, p) {
  const k = diffOf(p);
  if (k.hp === 1) return d;
  return { ...d, hp: Math.round(d.hp * k.hp), atk: Math.round(d.atk * k.atk), exp: Math.round(d.exp * k.exp), coin: [Math.round(d.coin[0] * k.coin), Math.round(d.coin[1] * k.coin)], diff: true };
}

// ---- 野外寶箱：每張野外地圖每天換位置刷 3 個 ----
export const CHESTS_PER_MAP = 3;
export function chestSpots(g, mapId, day, ok) {
  const r = rng(hash(`${day}#${mapId}`)), out = [];
  for (let i = 0; i < 4000 && out.length < CHESTS_PER_MAP; i++) {
    const x = 6 + Math.floor(r() * (g[0].length - 8)), y = 1 + Math.floor(r() * (g.length - 2));
    if (y >= 11 && y <= 15) continue; // 不放在大路上，要稍微找一下
    if (!ok(x, y)) continue;
    if (out.some((c) => Math.abs(c.x - x) + Math.abs(c.y - y) < 9)) continue;
    out.push({ x, y, key: `${mapId}-${out.length}` });
  }
  return out;
}
export function openChest(p, key, rand, day = dayKey()) {
  const m = ensureMeta(p);
  if (m.chestDay !== day) { m.chestDay = day; m.opened = []; }
  if (m.opened.includes(key)) return null;
  m.opened.push(key);
  const k = diffOf(p), big = rand() < 0.12;
  const r = { coins: Math.round(lvCoins(p, big ? 2.5 : 1) * k.coin), items: {} };
  if (rand() < 0.6) r.items[p.lv >= 30 && rand() < 0.4 ? 'ore2' : 'ore'] = big ? 3 : 1;
  if (rand() < 0.35) r.items[p.lv >= 30 ? 'orange' : 'red'] = 2;
  if (big) r.items.elixir = 1;
  return { reward: r, big, gear: big || rand() < 0.25 };
}
export const chestOpened = (p, key, day = dayKey()) => { const m = ensureMeta(p); return m.chestDay === day && (m.opened || []).includes(key); };

// ---- 舒壓：快速掛機（立刻領 2 小時掛機收益）----
export const QUICK_IDLE_MIN = 120, QUICK_FREE = 2, QUICK_EXTRA = 3, QUICK_COST = 50;
export function quickIdleState(p, t = Date.now()) {
  const m = ensureMeta(p), d = dayKey(t);
  if (m.qi?.day !== d) m.qi = { day: d, used: 0 };
  const free = QUICK_FREE + (monthActive(p, t) ? 2 : 0);
  return { used: m.qi.used, free, freeLeft: Math.max(0, free - m.qi.used), paidLeft: Math.max(0, free + QUICK_EXTRA - m.qi.used) };
}
// 回傳 { cost }，失敗回傳 null（次數用完或魂石不夠）
export function useQuickIdle(p, t = Date.now()) {
  const s = quickIdleState(p, t);
  if (s.paidLeft <= 0) return null;
  const cost = s.freeLeft > 0 ? 0 : QUICK_COST;
  if (p.stones < cost) return null;
  p.stones -= cost; p.meta.qi.used++;
  return { cost };
}

// ---- 商城：小額、划算、每一筆都看得到回報 ----
// 示範版：沒有串接真實金流，購買會直接發放。正式上架時換成 App Store／Google Play／網頁金流
export const SHOP = [
  { id: 'daily', name: '每日超值包', price: 30, limit: 'day', give: { stones: 80, items: { ore: 3, elixir: 1, white: 2 } }, tag: '每天限購 1 次・最划算' },
  { id: 'month', name: '月卡', price: 90, month: true, give: { stones: 300 }, tag: '立刻 300 魂石＋30 天每天 100 魂石', perks: ['每天可領 100 魂石（共 3000）', '快速掛機每天多 2 次', '離線收益上限 12 → 24 小時'] },
  { id: 'grow', name: '新手成長禮包', price: 60, limit: 'once', give: { stones: 200, items: { ore: 10, ore2: 2, white: 5, elixir: 2 } }, tag: '限購 1 次' },
  { id: 's60', name: '一小袋魂石', price: 30, give: { stones: 60 }, first: true, tag: '首次購買雙倍' },
  { id: 's330', name: '一盒魂石', price: 150, give: { stones: 330 }, first: true, tag: '首次購買雙倍' },
  { id: 's700', name: '一箱魂石', price: 300, give: { stones: 700 }, first: true, tag: '首次購買雙倍' },
];
export const MONTH_DAYS = 30, MONTH_DAILY = 100;
const DAY = 86400000;
function shopState(p) { p.shop ??= {}; p.shop.bought ??= {}; p.shop.day ??= {}; return p.shop; }
export const monthActive = (p, t = Date.now()) => (p.shop?.monthUntil || 0) > t;
export const monthDaysLeft = (p, t = Date.now()) => Math.max(0, Math.ceil(((p.shop?.monthUntil || 0) - t) / DAY));
export function canBuy(p, sku, t = Date.now()) {
  const s = shopState(p), it = SHOP.find((x) => x.id === sku);
  if (!it) return false;
  if (it.limit === 'once' && s.bought[sku]) return false;
  if (it.limit === 'day' && s.day[sku] === dayKey(t)) return false;
  return true;
}
// 回傳發放的獎勵（首購雙倍已算進去）
export function buySku(p, sku, t = Date.now()) {
  if (!canBuy(p, sku, t)) return null;
  const s = shopState(p), it = SHOP.find((x) => x.id === sku);
  const firstTime = it.first && !s.bought[sku];
  s.bought[sku] = (s.bought[sku] || 0) + 1;
  if (it.limit === 'day') s.day[sku] = dayKey(t);
  if (it.month) { s.monthUntil = Math.max(t, s.monthUntil || 0) + MONTH_DAYS * DAY; s.monthClaim = ''; }
  const r = { ...it.give, items: { ...(it.give.items || {}) } };
  if (firstTime) r.stones = (r.stones || 0) * 2;
  return r;
}
export function claimMonthDaily(p, t = Date.now()) {
  const s = shopState(p), d = dayKey(t);
  if (!monthActive(p, t) || s.monthClaim === d) return null;
  s.monthClaim = d; return { stones: MONTH_DAILY };
}
export const monthClaimable = (p, t = Date.now()) => monthActive(p, t) && shopState(p).monthClaim !== dayKey(t);

// ---- 一鍵全領 ----
export function claimAll(p, t = Date.now()) {
  const m = ensureMeta(p), out = [];
  for (const q of [...m.daily, ...m.weekly]) { const r = claimQuest(p, q); if (r) out.push(r); }
  CHESTS.forEach((_, i) => { const r = claimChest(p, i); if (r) out.push(r); });
  const lg = claimLogin(p, t); if (lg) out.push(lg.reward);
  for (const a of achReady(p)) { const r = claimAch(p, a.id); if (r) out.push(r); }
  const mo = claimMonthDaily(p, t); if (mo) out.push(mo);
  return mergeRewards(out);
}
export function mergeRewards(list) {
  const r = { coins: 0, exp: 0, stones: 0, items: {} };
  for (const x of list) { r.coins += x.coins || 0; r.exp += x.exp || 0; r.stones += x.stones || 0; for (const [k, n] of Object.entries(x.items || {})) r.items[k] = (r.items[k] || 0) + n; }
  return list.length ? r : null;
}
