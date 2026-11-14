import {
  W, H, T, TOWN_EDGE, FIELD_MIN_X, BOSS_ZONE, HOUSES, NPCS, SIGN, SPAWN, INN_SPOT, buildWorld, walkable,
  MONSTERS, ROSTER, expNeed, stats, swordCost, POTION_PRICE, POTION_HEAL_PCT, FISH, rollFish, gainExp, newPlayer, loadPlayer,
  rollGear, rarityOf, rarityIdx, equipIfBetter, SLOTS, SLOT_NAME, DROP_RATE, CLASSES, CLASS_IDS,
  TALENTS, TALENT_MAX, TALENT_REQ, talentPoints, talentSpent, canLearn, learn, resetTalents,
  SOULS, SOUL_IDS, SUMMON_COST, SUMMON_PITY, summon, offlineReward, affixName, LV_CAP, capFor, CHAPTERS, FIELD, buildField,
} from './world.js';
import { soulSprite, soulBig } from './soul.js';
import { ITEMS, GRADES, STAT_NAME, BAG_SIZE, ensureInv, count, addStack, takeStack, pickupGear, pickupItem, equipFromBag, unequip, sellFromBag, sellStack, sellAllJunk, findGear, insertCard, REFINE_RATE, refineCost, refine, rollDrops, shopList, buy, pickPotion, gearSell, itemSell } from './items.js';
import { iconCanvas, gearIcon } from './icons.js';
import { loadAssets, asset, tinted, loadState } from './assets.js';
import { ensureMeta, refresh, track, claimQuest, claimChest, claimable, claimLogin, loginReward, questLabel, rewardText, CHESTS, codexBonus, codexStars, CODEX_TIERS, ACHIEVEMENTS, achProgress, achReady, claimAch, ELITE_AFFIX, ELITE_RATE, makeElite, towerFloor, towerClear, LOGIN_CYCLE } from './meta.js';
import { pixelize } from './pixelize.js';
// 美術風格：像素風。高畫質的角色、怪物、NPC 在遊戲畫面中即時轉成像素圖；特效、頭像、大招立繪維持高畫質
const PX_CHAR = 36, PX_MON = 26, PX_BOSS = 52;
import { COMPANIONS, COMPANION_IDS, ROLE_NAME, PARTY_MAX, ensureParty, unlocked, hire, toggleActive, allyStats } from './party.js';
const TIER = ['common', 'good', 'rare', 'epic', 'legend'];
const itemIcon = (id) => asset('icon/' + id) || iconCanvas(ITEMS[id].icon, ITEMS[id].color);
const gearIconHD = (it) => asset('icon/' + (it.slot === 'weapon' ? `weapon_${C.weapon}_${it.rarity}` : `${it.slot}_${it.rarity}`)) || gearIcon(it, C.weapon, rarityIdx);
import { PAL, CROWN, BOBBER, BANG, HEART, COIN, ORB, makeSprite, drawMap, monsterSprite } from './sprites.js';
import { avatar, lookOf, npcLook, AW, AH } from './avatar.js';

const KEY = 'glimmer-rpg-v1';
const $ = (id) => document.getElementById(id);
const TS = 16;
let VW = 11 * TS, VH = 20 * TS, S = 6, DPR = 1;
// 全螢幕：短邊固定顯示約 11 格，長邊依螢幕比例延伸
function resize() {
  DPR = Math.min(3, window.devicePixelRatio || 1);
  const w = cv.clientWidth || innerWidth, h = cv.clientHeight || innerHeight;
  cv.width = Math.round(w * DPR); cv.height = Math.round(h * DPR);
  S = (Math.min(w, h) * DPR) / (11 * TS);
  VW = cv.width / S; VH = cv.height / S;
  if (typeof render === 'function' && myLook) render();
}
const cv = $('cv');
const ctx = cv.getContext('2d');
addEventListener('resize', () => resize());
// 地圖：0 = 微光村與史萊姆草原；2～6 = 各章野外
let mapId = 0, grid = buildWorld(), mapC = null, BZ = BOSS_ZONE, FMIN = FIELD_MIN_X;
const townNpcs = NPCS.map((n, i) => ({ ...n, face: n.id === 'fisher' ? 'right' : 'down', L: npcLook(n), seed: i }));
let npcs = townNpcs;
const mapCache = {};
function renderMapCanvas(id) {
  if (mapCache[id]) return mapCache[id];
  const theme = id === 0 ? 'meadow' : CHAPTERS[id - 1].theme;
  const hdTiles = !!asset(`tile/${theme}_ground_1`);
  const RES = hdTiles ? 4 : 1; // 有高畫質地圖素材時，用 4 倍解析度繪製
  const c = document.createElement('canvas'); c.width = W * TS * RES; c.height = H * TS * RES;
  const x = c.getContext('2d'); x.scale(RES, RES);
  drawMap(x, grid, T, id === 0 ? HOUSES : [], 3, theme, asset);
  if (id === 0) drawHouses(x);
  return (mapCache[id] = c);
}
function drawHouses(x) {
  const color = ['red', 'blue', 'green', 'purple'];
  HOUSES.forEach((h, i) => { const im = asset(`prop/house_${color[i]}`); if (im) { x.save(); x.imageSmoothingEnabled = true; x.drawImage(im, h.x * TS - 6, h.y * TS - 14, 60, 62); x.restore(); } });
  const f = asset('prop/fountain'); if (f) { x.save(); x.imageSmoothingEnabled = true; x.drawImage(f, 9 * TS - 4, 11 * TS - 6, 40, 40); x.restore(); }
}
mapC = renderMapCanvas(0);
const crownS = makeSprite(CROWN), bobberS = makeSprite(BOBBER), bangS = makeSprite(BANG), heartS = makeSprite(HEART), coinS = makeSprite(COIN);
const orbS = {};
for (const r of ['common', 'good', 'rare', 'epic', 'legend']) orbS[r] = makeSprite(ORB, { ...PAL, x: rarityOf(r).color });

let hasSave = false, P;
try { const raw = localStorage.getItem(KEY); hasSave = !!raw; P = loadPlayer(raw); } catch { P = newPlayer(); }
ensureInv(P); ensureParty(P);

ensureMeta(P); P.cb = codexBonus(P);
const me = { x: P.x, y: P.y, px: P.x, py: P.y, fx: P.x, fy: P.y, face: 'down', moving: false, mt: 0, dur: 0.14, step: 0, atkT: 0, hurtT: 0, cool: 0, inv: 0, dodgeT: 0 };
function save() { P.x = me.x; P.y = me.y; P.map = mapId; P.seen = Date.now(); hasSave = true; try { localStorage.setItem(KEY, JSON.stringify(P)); } catch { /* 無痕模式不存 */ } }

const R = Math.random;
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
let C = CLASSES[P.cls], skills = [], myLook = null;
let mons = [], floats = [], parts = [], drops = [], fx = [], projs = [], pending = [];
let dialog = null, fishing = null, started = false, held = null, aHeld = false, auto = false, autoHit = false, autoCastT = 0;
let anim = 0, regenT = 0, saveT = 0, shake = 0, freeze = 0, flash = 0, combo = 0, comboT = 0, auraT = 0;
let allies = [], atkOverride = 0, partyT = 0;
let trial = null, metaT = 0;
let soulPower = 0, cutinT = 0, pendingUlt = null, catT = 0, warns = [], tintC = '#fff', tintT = 0;
const soulPos = { x: 0, y: 0 };
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const DROP_LIFT = 1.1; // 掉落物在地上停留、顯示名字的時間
const cx = (o) => o.px * TS + 8, cy = (o) => o.py * TS + 8;

function setupClass() {
  C = CLASSES[P.cls];
  skills = C.skills.map((s) => ({ ...s, t: 0 }));
  skills.forEach((s, i) => {
    const b = $(`sk${i}Btn`);
    b.querySelector('span').textContent = s.name;
    b.style.setProperty('--c', i === 2 ? '#ffb35c' : C.color);
  });
  myLook = lookOf(P, CLASSES, rarityIdx);
  applyUiArt();
}
// 介面美術：有圖就換上，沒有就維持程式畫的按鈕
function applyUiArt() {
  const url = (k) => asset('ui/' + k)?.src;
  skills.forEach((sk, i) => {
    const b = $(`sk${i}Btn`), u = url('skill_' + sk.id);
    b.classList.toggle('hasicon', !!u);
    b.style.backgroundImage = u ? `conic-gradient(#0b0816cc var(--p,0deg),transparent 0),url("${u}")` : '';
  });
  for (const [id, k] of [['aBtn', 'btn_attack'], ['dodgeBtn', 'btn_dodge'], ['bBtn', 'btn_potion']]) {
    const u = url(k), b = $(id); b.classList.toggle('hasicon', !!u); b.style.backgroundImage = u ? (id === 'dodgeBtn' ? `conic-gradient(#0b0816cc var(--p,0deg),transparent 0),url("${u}")` : `url("${u}")`) : '';
  }
  const bg = url('title_bg'), logo = url('logo');
  if (bg) $('title').style.backgroundImage = `linear-gradient(#140f2699,#140f26cc),url("${bg}")`;
  if (logo && !document.querySelector('.logo img')) { const im = new Image(); im.src = logo; im.alt = '微光大陸'; $('title').querySelector('.logo').replaceChildren(im); }
}

// ---------- 怪物 ----------
const inBoss = (x, y) => x >= BZ.x0 && x <= BZ.x1 && y >= BZ.y0 && y <= BZ.y1;
function occupied(x, y, self) {
  if (self !== me && me.x === x && me.y === y) return true;
  if (npcs.some((n) => n.x === x && n.y === y)) return true;
  if (allies.some((a) => a !== self && a.x === x && a.y === y)) return true;
  return mons.some((m) => m !== self && m.dead <= 0 && m.x === x && m.y === y);
}
const monCanGo = (m, x, y) => walkable(grid, x, y) && x >= FMIN && grid[y][x] !== T.PORTAL && !occupied(x, y, m) && (m.d.boss || m.minion ? inBoss(x, y) : !inBoss(x, y));
function spawnTile(m) {
  for (let i = 0; i < 300; i++) {
    let x, y;
    if (m.d.boss) { x = BZ.x0 + 1 + Math.floor(R() * 5); y = BZ.y0 + 1 + Math.floor(R() * 4); }
    else { const [a, b] = m.d.zone; x = a + Math.floor(R() * (b - a + 1)); y = 1 + Math.floor(R() * (H - 2)); if (inBoss(x, y)) continue; }
    if (x >= FMIN && walkable(grid, x, y) && grid[y][x] !== T.PORTAL && !occupied(x, y) && Math.abs(x - me.x) + Math.abs(y - me.y) > 3) return { x, y };
  }
  return null;
}
function placeMon(m) {
  if (m.base && !trial) m.d = !m.base.boss && P && P.lv >= 5 && R() < ELITE_RATE ? makeElite(m.base, R) : m.base;
  const t = spawnTile(m);
  if (!t) { m.dead = 1; return; }
  Object.assign(m, { x: t.x, y: t.y, px: t.x, py: t.y, fx: t.x, fy: t.y, moving: false, hp: m.d.hp, dead: 0, cool: 1, think: R() * 1.5, flash: 0, kx: 0, ky: 0, spawnT: 0.4, frozen: 0, letter: 0, shield: false, phases: [], slamT: 3, spitT: 5, hidden: false, engaged: false, stolen: new Set(), rwT: 10, hist: [], histT: 0 });
}
function spawnRoster(list) { mons = []; for (const type of list) { const m = { type, d: MONSTERS[type], base: MONSTERS[type], anim: R() * 2 }; mons.push(m); placeMon(m); } }
function fieldNpc(id) {
  const c = CHAPTERS[id - 1];
  if (!c.guide) return [];
  return [{ id: 'guide', ch: id, x: FIELD.guide.x, y: FIELD.guide.y, name: c.guide.name, look: c.guide.look, face: 'down', L: npcLook(c.guide), seed: 0 }];
}
function loadMap(id, at) {
  mapId = id; trial = null;
  grid = id === 0 ? buildWorld() : buildField(id);
  mapC = renderMapCanvas(id);
  BZ = id === 0 ? BOSS_ZONE : FIELD.boss; FMIN = id === 0 ? FIELD_MIN_X : 5;
  npcs = id === 0 ? townNpcs : fieldNpc(id);
  drops = []; projs = []; pending = []; fx = []; warns = []; fishing = null;
  const s0 = at && walkable(grid, at.x, at.y) ? at : id === 0 ? SPAWN : FIELD.spawn;
  Object.assign(me, { x: s0.x, y: s0.y, px: s0.x, py: s0.y, fx: s0.x, fy: s0.y, moving: false });
  soulPos.x = cx(me); soulPos.y = cy(me);
  const c = CHAPTERS[Math.max(1, id) - 1];
  if (typeof buildAllies === 'function' && P) { allies = []; buildAllies(); }
  spawnRoster(id === 0 ? ROSTER : [...Array(9).fill(c.mons[0]), ...Array(8).fill(c.mons[1]), ...Array(7).fill(c.mons[2]), c.boss]);
}
const inSafe = () => (mapId === 0 ? me.x <= TOWN_EDGE : me.x < 5);
const alive = () => mons.filter((m) => m.dead <= 0 && !m.hidden);
const tdist = (m, x, y) => Math.hypot(m.px - x, m.py - y);
function nearest(range, from = me) { let best = null, bd = 1e9; for (const m of alive()) { const d = tdist(m, from.px, from.py); if (d <= range + (m.d.boss ? 0.6 : 0) && d < bd) { bd = d; best = m; } } return best; }

const MINION = { name: '小史萊姆王', tpl: 'slime', pal: MONSTERS.king.pal, hp: 160, atk: 8, exp: 10, coin: [2, 4], lv: 8, sight: 7 };
const MIRROR_OBJ = (b) => ({ name: '魔鏡', tpl: 'mirror', pal: {}, hp: Math.round(b.d.hp * 0.035), atk: 0, exp: 40, coin: [20, 40], lv: b.d.lv, sight: 0, still: true });
const DECOY = { name: '路人', tpl: 'decoy', pal: {}, hp: 1, atk: 0, exp: 0, coin: [0, 0], lv: 1, sight: 0, still: true, decoy: true };
let invertT = 0, lastSkill = null, lastUltId = null;
function spawnMinions(boss, n, d = MINION, opts = {}) {
  const spots = [];
  for (let y = BZ.y0; y <= BZ.y1; y++) for (let x = BZ.x0; x <= BZ.x1; x++) if (walkable(grid, x, y) && !occupied(x, y)) spots.push([x, y]);
  spots.sort((a, b) => (opts.spread ? R() - 0.5 : Math.hypot(a[0] - boss.x, a[1] - boss.y) - Math.hypot(b[0] - boss.x, b[1] - boss.y)));
  const made = [];
  for (const [x, y] of spots.slice(0, n)) {
    const m = { type: boss.type, d, minion: true, anim: R() * 2, x, y, px: x, py: y, fx: x, fy: y, moving: false, mt: 0, hp: d.hp, dead: 0, cool: 1.2, think: 0.5, flash: 0, kx: 0, ky: 0, spawnT: 0.3, frozen: 0, letter: 0 };
    mons.push(m); made.push(m);
  }
  return made;
}
function revealFaceless(boss, at) {
  for (const x of mons) if (x.d.decoy) x.dead = 1;
  Object.assign(boss, { x: at.x, y: at.y, px: at.x, py: at.y, fx: at.x, fy: at.y, hidden: false, shield: false, moving: false });
  floatT('找到你了！', at.x, at.y - 1.4, '#ffd166', 1.3); burst(cx(boss), cy(boss), '#fff1a8', 30, 140); shake = 0.3;
}
function bossThink(m, dt) {
  const ratio = m.hp / m.d.hp, mech = m.d.mech;
  const d = tdist(m, me.px, me.py);
  const firstLook = !m.engaged && d <= 7;
  if (firstLook) m.engaged = true;
  if (mech === 'split') for (const th of [0.75, 0.5, 0.25]) if (ratio <= th && !m.phases.includes(th)) {
    m.phases.push(th); spawnMinions(m, 3); m.shield = true;
    banner('史萊姆王分裂了！'); feed('打倒<b>小史萊姆王</b>才能打破護盾', '#ff8a3d'); shake = 0.3;
  }
  if (mech === 'mirror') for (const th of [1, 0.5]) if ((th === 1 ? firstLook : ratio <= th) && !m.phases.includes(th)) {
    m.phases.push(th); spawnMinions(m, 3, MIRROR_OBJ(m), { spread: true }); m.shield = true;
    banner('魔鏡出現了！'); feed('魔鏡還在時：<b>左右操作顛倒</b>、夫人無敵。先打破魔鏡！', '#c084ff');
  }
  if (mech === 'faceless') for (const th of [1, 0.66, 0.33]) if ((th === 1 ? firstLook : ratio <= th) && !m.phases.includes(th)) {
    m.phases.push(th); m.hidden = true; m.shield = true;
    const ds = spawnMinions(m, 5, DECOY, { spread: true });
    const real = ds[Math.floor(R() * ds.length)];
    ds.forEach((x, i) => { const n = NPCS[i % NPCS.length]; x.look = npcLook(n); x.npcId = n.id; x.real = x === real; });
    banner('千面商人消失了！'); feed('五個路人裡只有一個是本尊——<b>他沒有影子</b>', '#f6c945');
  }
  if ((mech === 'split' || mech === 'mirror') && m.shield && !mons.some((x) => x.minion && x.dead <= 0 && !x.d.decoy)) { m.shield = false; floatT('護盾破了！', m.x, m.y - 1.2, '#ffd166', 1.2); burst(cx(m), cy(m), '#bdf1ff', 24, 120); }
  invertT = mech === 'mirror' && mons.some((x) => x.minion && x.dead <= 0) && d <= 9 ? 0.3 : invertT;
  if (mech === 'rewind' && m.engaged && !m.hidden) {
    m.histT += dt;
    if (m.histT >= 0.25) { m.histT = 0; m.hist.push({ hp: m.hp, x: me.x, y: me.y }); if (m.hist.length > 16) m.hist.shift(); }
    m.rwT -= dt;
    if (m.rwT <= 2.5 && !m.warned) { m.warned = true; feed('時鐘匠要<b>倒轉時間</b>了！先停手', '#f6d77a'); }
    if (m.rwT <= 0) {
      m.rwT = 10; m.warned = false;
      const past = m.hist.at(-12) || m.hist[0];
      if (past) {
        if (past.hp > m.hp) { floatT(`+${fmt(past.hp - m.hp)}`, m.x, m.y - 1, '#7fd8ff', 1.2); m.hp = past.hp; }
        if (walkable(grid, past.x, past.y) && !occupied(past.x, past.y)) Object.assign(me, { x: past.x, y: past.y, px: past.x, py: past.y, moving: false });
      }
      addFx('clock', 0.9, { x: cx(m), y: cy(m) }); flash = 0.15; banner('時間倒轉！');
    }
  }
  if (d > 7 || m.hidden) return;
  m.slamT -= dt; m.spitT -= dt;
  if (d <= 4 && m.slamT <= 0) { m.slamT = 6; warns.push({ x: m.px, y: m.py, r: 2.2, t: 0, life: 1.1, dmg: Math.round(m.d.atk * 2.2), kind: 'slam' }); }
  if (m.spitT <= 0) {
    m.spitT = 8.5;
    for (let i = 0; i < 3; i++) warns.push({ x: me.px + (i ? (R() - 0.5) * 3 : 0), y: me.py + (i ? (R() - 0.5) * 3 : 0), r: 1, t: -i * 0.15, life: 1.1, dmg: Math.round(m.d.atk * 1.5), kind: 'spit' });
  }
}
function updateWarns(dt) {
  warns = warns.filter((w) => {
    w.t += dt;
    if (w.t >= w.life && !w.fired) {
      w.fired = true;
      ring(w.x * TS + 8, w.y * TS + 8, w.r * 16 + 6, w.kind === 'slam' ? '#ff5a6e' : '#a6ec7a', 0.35, 4);
      burst(w.x * TS + 8, w.y * TS + 8, w.kind === 'slam' ? '#ff8a9b' : '#a6ec7a', 14, 100);
      if (w.kind === 'slam') shake = Math.max(shake, 0.25);
      if (Math.hypot(me.px - w.x, me.py - w.y) <= w.r + 0.3) hurt(w.dmg, null);
      for (const a of allies) if (Math.hypot(a.px - w.x, a.py - w.y) <= w.r + 0.3) allyHurt(a, w.dmg);
    }
    return w.t < w.life + 0.15;
  });
}

// ---------- 特效工具 ----------
function float(text, wx, wy, color = '#fff8e7', size = 1) { floats.push({ text, x: wx, y: wy, color, size, t: 0 }); }
const floatT = (text, tx, ty, color, size) => float(text, tx * TS + 8, ty * TS, color, size);
function burst(wx, wy, color, n = 8, speed = 70, opts = {}) {
  for (let i = 0; i < n; i++) parts.push({ x: wx, y: wy, vx: (R() - 0.5) * speed * 2, vy: -R() * speed - 10, c: color, t: 0, g: opts.g ?? 240, size: opts.size ?? 2, life: opts.life ?? 0.6 });
}
function addFx(kind, life, data) { fx.push({ kind, life, t: 0, ...data }); }
const ring = (wx, wy, max, color, life = 0.35, w = 3) => addFx('ring', life, { x: wx, y: wy, max, color, w });
function feed(html, color) {
  const box = $('feed');
  const n = document.createElement('div');
  n.className = 'feeditem'; n.style.borderColor = color; n.innerHTML = html;
  box.prepend(n);
  while (box.children.length > 4) box.lastChild.remove();
  setTimeout(() => n.remove(), 3200);
}
function popCp(before, after, label) {
  const el = $('cpPop');
  el.innerHTML = `戰鬥力 <b>${fmt(after)}</b> <span>${label || `▲ ${fmt(after - before)}`}</span>`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}
function banner(text) { const el = $('banner'); el.textContent = text; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }
function bump(id) { const el = $(id); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }

// ---------- HUD ----------
let lastCp = 0;
function hud() {
  const st = stats(P);
  if (started) $('advDot').hidden = !claimable(P);
  myLook = lookOf(P, CLASSES, rarityIdx);
  $('lv').textContent = P.lv;
  $('clsName').textContent = C.name;
  $('clsName').style.color = C.color;
  $('hpBar').style.width = `${Math.max(0, P.hp / st.hp) * 100}%`;
  $('hpText').textContent = `${fmt(Math.max(0, P.hp))} / ${fmt(st.hp)}`;
  $('xpBar').style.width = `${(P.exp / expNeed(P.lv)) * 100}%`;
  $('xpText').textContent = P.lv >= capFor(P) ? 'MAX' : `${Math.floor((P.exp / expNeed(P.lv)) * 100)}%`;
  $('coins').textContent = fmt(P.coins);
  $('cp').textContent = fmt(st.cp);
  if (lastCp && st.cp !== lastCp) bump('cpBox');
  lastCp = st.cp;
  $('potions').textContent = count(P, 'red') + count(P, 'orange') + count(P, 'white');
  $('stoneN') && ($('stoneN').textContent = fmt(P.stones));
  $('talentDot').hidden = talentSpent(P) >= talentPoints(P);
  $('quest').textContent = questText();
}
function questText() {
  if (trial) return `試煉之塔 第 ${trial.f} 層｜剩 ${mons.filter((m) => m.dead <= 0).length} 隻｜${trial.done ? '通過！' : `⏱ ${Math.max(0, Math.ceil(trial.t))} 秒`}`;
  const c = CHAPTERS[P.ch - 1];
  if (!c) return '全章節完成｜自由冒險：收集卡片、精煉、刷傳說裝備';
  const pre = `第 ${c.n} 章｜`;
  if (c.n === 1) return pre + ['找廣場北邊的村長歐文聊聊', `打倒史萊姆 ${Math.min(P.kills, 20)} / 20，再回報村長`, '擊敗東北方的史萊姆王（建議 Lv 7 以上）', '回村子向村長報告'][P.step];
  const gn = c.guide.name.split('・')[1];
  if (P.step === 0) return pre + (mapId === c.n ? `和入口的${gn}說話` : `找村裡的傳送師小葵，前往「${c.name}」`);
  return pre + [`和${gn}說話`, `打倒${c.name}的怪物 ${Math.min(P.kills, c.kills)} / ${c.kills}，再找${gn}`, `擊敗${MONSTERS[c.boss].name}（建議 Lv ${MONSTERS[c.boss].lv - 3} 以上）`, `回報${gn}`][P.step];
}
const trimCache = new WeakMap();
function trimmed(img) {
  if (trimCache.has(img)) return trimCache.get(img);
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  let out = img;
  try {
    const d = x.getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let y = 0; y < h; y += 2) for (let i = 0; i < w; i += 2) if (d[(y * w + i) * 4 + 3] > 30) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 > x0 && y1 > y0) { const t = document.createElement('canvas'); t.width = x1 - x0 + 4; t.height = y1 - y0 + 4; t.getContext('2d').drawImage(img, x0 - 2, y0 - 2, t.width, t.height, 0, 0, t.width, t.height); out = t; }
  } catch { /* 跨來源圖片讀不到像素就用原圖 */ }
  trimCache.set(img, out); return out;
}
function previewCanvas(L, size = 4, dir = 'down') {
  const c = document.createElement('canvas'); c.width = AW * size; c.height = AH * size;
  const x = c.getContext('2d'); const h = heroImg(L, dir); const src = h ? trimmed(h) : avatar(L, dir, 0);
  // 介面特寫（裝備、隊伍、標題）放精緻原圖；大地圖上才用像素小人
  if (h || src.width > AW) { x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; const k = Math.min((AW * size) / src.width, (AH * size) / src.height); x.drawImage(src, (AW * size - src.width * k) / 2, AH * size - src.height * k, src.width * k, src.height * k); c.classList.add('hdprev'); }
  else { x.imageSmoothingEnabled = false; x.drawImage(src, 0, 0, AW * size, AH * size); }
  return c;
}
function statLine() {
  const st = stats(P);
  return `攻擊 ${fmt(st.atk)}・生命 ${fmt(st.hp)}・暴擊 ${Math.round(st.crit * 100)}%・暴傷 ${Math.round(st.critDmg * 100)}%・攻速 ${Math.round(st.aspd * 100)}%・冷卻縮減 ${Math.round(st.cdr * 100)}%`;
}
// ---------- 背包 ----------
let bagTab = 'gear', bagSel = null;
const rarityName = (it) => rarityOf(it.rarity);
function gearTitle(it) { return `${it.refine ? `+${it.refine} ` : ''}${it.name}${it.slots ? `［${it.cards.length}/${it.slots}］` : ''}`; }
function gearLines(it) {
  const r = rarityName(it);
  const aff = (it.affixes || []).map((a) => `<span class="aff">${affixName(a.id)} +${a.val}%</span>`).join('');
  const cards = (it.cards || []).map((c) => `<span class="aff card">${ITEMS[c.id].name}：${STAT_NAME[c.stat]} +${c.val}%</span>`).join('');
  const v = Math.round(it.val * (1 + 0.08 * (it.refine || 0)));
  return `<span class="gtag" style="background:${r.color}">${r.name}</span> <b style="color:${r.color}">${gearTitle(it)}</b> <span class="gval">${SLOT_NAME[it.slot]}・${it.stat === 'atk' ? '攻擊' : 'HP'} +${fmt(v)}</span><div class="affs">${aff}${cards}</div>`;
}
function cell(canvas, label, color, sel, extra = '') {
  const b = document.createElement('button');
  b.type = 'button'; b.className = `bcell${sel ? ' on' : ''}`; b.style.setProperty('--rc', color);
  b.append(canvas.cloneNode ? canvas : canvas);
  const c2 = document.createElement('canvas'); c2.width = 64; c2.height = 64; const x = c2.getContext('2d'); x.imageSmoothingEnabled = canvas instanceof HTMLImageElement; x.drawImage(canvas, 0, 0, 64, 64);
  b.replaceChildren(c2);
  b.insertAdjacentHTML('beforeend', `${label ? `<em>${label}</em>` : ''}${extra}`);
  return b;
}
function renderBag() {
  myLook = lookOf(P, CLASSES, rarityIdx);
  $('gearDoll').replaceChildren(previewCanvas(myLook, 6, 'down'), previewCanvas(myLook, 6, 'right'));
  $('bagCount').textContent = `裝備 ${P.bag.gear.length}/${BAG_SIZE}`;
  $('statLine').textContent = statLine();
  $('eqSlots').replaceChildren(...SLOTS.map((sl) => {
    const it = P.gear[sl];
    if (!it) { const b = document.createElement('div'); b.className = 'bcell empty'; b.textContent = SLOT_NAME[sl]; return b; }
    const b = cell(gearIconHD(it), it.refine ? `+${it.refine}` : '', rarityName(it).color, bagSel === 'e' + it.uid);
    b.addEventListener('click', () => { bagSel = 'e' + it.uid; renderBag(); });
    return b;
  }));
  document.querySelectorAll('.btabs button').forEach((x) => x.classList.toggle('on', x.dataset.tab === bagTab));
  let cells = [];
  if (bagTab === 'gear') cells = [...P.bag.gear].sort((a, b) => rarityIdx(b.rarity) - rarityIdx(a.rarity) || b.val - a.val).map((it) => {
    const b = cell(gearIconHD(it), it.refine ? `+${it.refine}` : '', rarityName(it).color, bagSel === 'g' + it.uid, it.locked ? '<i class="lock">鎖</i>' : '');
    b.addEventListener('click', () => { bagSel = 'g' + it.uid; renderBag(); });
    return b;
  });
  else cells = Object.keys(P.bag.stack).filter((id) => (bagTab === 'card') === (ITEMS[id].kind === 'card')).sort((a, b) => GRADES.findIndex((g) => g.id === ITEMS[b].grade) - GRADES.findIndex((g) => g.id === ITEMS[a].grade)).map((id) => {
    const it = ITEMS[id];
    const b = cell(itemIcon(id), `${count(P, id)}`, GRADES.find((g) => g.id === it.grade).color, bagSel === 'i' + id);
    b.addEventListener('click', () => { bagSel = 'i' + id; renderBag(); });
    return b;
  });
  $('bagGrid').replaceChildren(...cells);
  if (!cells.length) $('bagGrid').innerHTML = `<p class="muted small">${bagTab === 'card' ? '還沒有卡片。每種怪物都有極低機率掉落自己的卡片，魔王的機率比較高。' : '空空的。'}</p>`;
  renderDetail();
}
function act(label, fn, cls = 'startbtn', disabled = false) {
  const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = label; b.disabled = disabled;
  b.addEventListener('click', () => { fn(); hud(); save(); renderBag(); });
  return b;
}
function renderDetail() {
  const box = $('bagDetail');
  box.replaceChildren();
  if (!bagSel) { box.innerHTML = '<p class="muted small">點一下物品查看詳細資料。</p>'; return; }
  const kind = bagSel[0], key = bagSel.slice(1);
  const row = document.createElement('div'); row.className = 'crow wrap';
  if (kind === 'e' || kind === 'g') {
    const it = findGear(P, +key);
    if (!it) { bagSel = null; renderDetail(); return; }
    box.innerHTML = `<div class="dline">${gearLines(it)}</div>`;
    if (kind === 'e') row.append(act('卸下', () => { if (!unequip(P, it.slot)) feed('背包滿了，無法卸下', '#ff8fa0'); bagSel = 'g' + it.uid; }, 'ghostbtn'));
    else {
      row.append(act('裝備', () => { equipFromBag(P, it.uid); bagSel = 'e' + it.uid; }));
      row.append(act(`賣出 +${fmt(gearSell(it))}`, () => { sellFromBag(P, it.uid); bagSel = null; }, 'ghostbtn', !!it.locked));
    }
    row.append(act(it.locked ? '解除上鎖' : '上鎖（不會被賣掉）', () => { it.locked = !it.locked; }, 'ghostbtn'));
    const cards = Object.keys(P.bag.stack).filter((id) => ITEMS[id].kind === 'card');
    if (it.cards.length < it.slots) for (const id of cards) row.append(act(`插入 ${ITEMS[id].name}`, () => { const r = insertCard(P, it.uid, id); feed(r.ok ? `${ITEMS[id].name} 插入成功！` : r.reason, '#ffb03b'); }, 'ghostbtn'));
    else if (!it.slots) box.insertAdjacentHTML('beforeend', '<p class="muted small">這件裝備沒有卡槽。</p>');
  } else {
    const it = ITEMS[key];
    if (!count(P, key)) { bagSel = null; renderDetail(); return; }
    const g = GRADES.find((x) => x.id === it.grade);
    box.innerHTML = `<div class="dline"><span class="gtag" style="background:${g.color}">${g.name}</span> <b>${it.name}</b> ×${count(P, key)}<p class="small">${it.desc}</p></div>`;
    if (it.kind === 'use') row.append(act('使用', () => { $('bagPanel').hidden = it.effect === 'home' || it.effect === 'blink' ? true : $('bagPanel').hidden; useItem(key); }));
    if (it.kind === 'card') {
      for (const sl of SLOTS) { const tg = P.gear[sl]; if (tg && tg.cards.length < tg.slots) row.append(act(`插進 ${tg.name}`, () => { const r = insertCard(P, tg.uid, key); feed(r.ok ? `${it.name} 插入成功！` : r.reason, '#ffb03b'); })); }
    }
    row.append(act(`賣出 1 個 +${itemSell(key)}`, () => sellStack(P, key, 1), 'ghostbtn'));
    if (count(P, key) > 1) row.append(act(`全部賣出 +${fmt(itemSell(key) * count(P, key))}`, () => sellStack(P, key), 'ghostbtn'));
  }
  box.append(row);
}
document.querySelectorAll('.btabs button').forEach((b) => b.addEventListener('click', () => { bagTab = b.dataset.tab; bagSel = null; renderBag(); }));
$('gearBtn').addEventListener('click', () => { if (!started) return; bagSel = null; renderBag(); $('bagPanel').hidden = false; });
$('bagClose').addEventListener('click', () => { $('bagPanel').hidden = true; });
$('sellJunkBtn').addEventListener('click', () => { const c = sellAllJunk(P); feed(c ? `賣掉全部雜物 +${fmt(c)} 金幣` : '沒有雜物可以賣', '#b8b0a4'); hud(); save(); renderBag(); });

// ---------- 自動販賣設定 ----------
function renderSell() {
  const chk = (id, label, on, color) => `<label class="chk"><input type="checkbox" data-k="${id}" ${on ? 'checked' : ''}><span style="color:${color}">${label}</span></label>`;
  $('sellEquip').innerHTML = ['common', 'good', 'rare', 'epic', 'legend'].map((r) => chk('equip.' + r, rarityOf(r).name, P.autoSell.equip[r], rarityOf(r).color)).join('');
  $('sellItem').innerHTML = GRADES.map((g) => chk('item.' + g.id, g.name, P.autoSell.item[g.id], g.color)).join('');
  $('autoEquipChk').checked = P.autoSell.autoEquip;
  document.querySelectorAll('#sellPanel input[data-k]').forEach((el) => el.addEventListener('change', () => { const [g, k] = el.dataset.k.split('.'); P.autoSell[g][k] = el.checked; save(); }));
}
$('autoEquipChk').addEventListener('change', () => { P.autoSell.autoEquip = $('autoEquipChk').checked; save(); });
$('autoSellBtn').addEventListener('click', () => { renderSell(); $('sellPanel').hidden = false; });
$('sellClose').addEventListener('click', () => { $('sellPanel').hidden = true; });

// ---------- 精煉 ----------
let refineSel = null;
function openRefine() { refineSel = P.gear.weapon?.uid || null; renderRefine(); $('refinePanel').hidden = false; }
function renderRefine() {
  const list = [...SLOTS.map((sl) => P.gear[sl]).filter(Boolean), ...P.bag.gear.filter((it) => rarityIdx(it.rarity) >= 2)];
  $('refineList').replaceChildren(...list.map((it) => {
    const b = cell(gearIconHD(it), it.refine ? `+${it.refine}` : '', rarityName(it).color, refineSel === it.uid);
    b.addEventListener('click', () => { refineSel = it.uid; renderRefine(); });
    return b;
  }));
  const it = refineSel && findGear(P, refineSel);
  if (!it) { $('refineInfo').innerHTML = '<p class="muted small">選一件裝備。</p>'; $('refineGo').disabled = true; return; }
  const cost = refineCost(it);
  const rate = it.refine >= 10 ? 0 : REFINE_RATE[it.refine];
  $('refineInfo').innerHTML = `<div class="dline">${gearLines(it)}</div><p class="small">${it.refine >= 10 ? '已經是 +10 了！' : `+${it.refine} → +${it.refine + 1}　成功率 <b>${Math.round(rate * 100)}%</b>　需要 ${fmt(cost.coins)} 金幣＋${ITEMS[cost.ore].name} ×1（有 ${count(P, cost.ore)}）`}</p><p class="muted small">每 +1 讓裝備數值 +8%，武器 +7 以上會發光。</p>`;
  $('refineGo').disabled = it.refine >= 10;
}
$('refineGo').addEventListener('click', () => {
  if (!refineSel) return;
  const before = stats(P).cp;
  const r = refine(P, refineSel, R);
  if (r.ok) questDone(track(P, 'refine'));
  if (!r.ok) feed(r.reason, '#ff8fa0');
  else if (r.success) { banner(`精煉成功！+${r.level}`); flash = 0.12; burst(cx(me), cy(me), '#fff1a8', 24, 110); const after = stats(P).cp; if (after > before) popCp(before, after); }
  else { feed('精煉失敗……材料消失了，裝備沒事', '#ff8fa0'); shake = 0.2; }
  hud(); save(); renderRefine();
});
$('refineClose').addEventListener('click', () => { $('refinePanel').hidden = true; });

// ---------- 天賦 ----------
function renderTalents() {
  const left = talentPoints(P) - talentSpent(P);
  $('talentPts').innerHTML = `可用點數 <b>${left}</b>・每升 1 級得到 1 點・重置免費`;
  $('talentGrid').innerHTML = TALENTS.map((br, bi) => `<div class="tcol"><h4>${br.name}</h4>${br.nodes.map((n, ni) => {
    const v = P.talents[n.id] || 0, ok = canLearn(P, bi, ni);
    const locked = br.nodes.reduce((a, x) => a + (P.talents[x.id] || 0), 0) < TALENT_REQ[ni];
    return `<button class="tnode${v ? ' on' : ''}${locked ? ' locked' : ''}" data-b="${bi}" data-n="${ni}" ${ok ? '' : 'disabled'} type="button"><b>${n.name}</b><span>${n.desc}</span><em>${v}/${TALENT_MAX}</em>${locked ? `<small>此分支先投 ${TALENT_REQ[ni]} 點</small>` : ''}</button>`;
  }).join('')}</div>`).join('') + `<p class="muted small tfull">${statLine()}</p>`;
  $('talentGrid').querySelectorAll('.tnode').forEach((b) => b.addEventListener('click', () => { if (learn(P, +b.dataset.b, +b.dataset.n)) { hud(); save(); renderTalents(); } }));
}
$('talentBtn').addEventListener('click', () => { if (!started) return; renderTalents(); $('talentPanel').hidden = false; });
$('talentClose').addEventListener('click', () => { $('talentPanel').hidden = true; });
$('talentReset').addEventListener('click', () => { resetTalents(P); hud(); save(); renderTalents(); });

// ---------- 魂像 ----------
function renderSouls() {
  $('stoneN').textContent = fmt(P.stones);
  $('pityN').textContent = P.pity || 0;
  $('soulList').replaceChildren(...SOUL_IDS.map((id) => {
    const S = SOULS[id], star = P.souls[id] || 0;
    const card = document.createElement('div');
    card.className = `soulcard${star ? '' : ' locked'}${P.soul === id ? ' on' : ''}`;
    card.style.setProperty('--sc', S.color);
    const art = soulBig(id, 2);
    card.append(art);
    card.insertAdjacentHTML('beforeend', `<div class="sinfo"><b>${star ? S.name : '？？？'}</b> <span class="stype">${S.type}</span> <span class="stars">${'★'.repeat(star)}${'☆'.repeat(5 - star)}</span><p>被動：${S.passive}</p><p>大招：${S.ult}</p>${star ? '' : `<p class="muted">${S.story ? '主線第 1 章取得' : '星痕召喚取得'}</p>`}</div>`);
    if (star) {
      const b = document.createElement('button'); b.type = 'button'; b.className = P.soul === id ? 'ghostbtn' : 'startbtn'; b.textContent = P.soul === id ? '使用中' : '裝上';
      b.disabled = P.soul === id;
      b.addEventListener('click', () => { P.soul = id; soulPower = 0; hud(); save(); renderSouls(); });
      card.append(b);
    }
    return card;
  }));
}
$('soulMenuBtn').addEventListener('click', () => { if (!started) return; $('summonRes').textContent = ''; renderSouls(); $('soulPanel').hidden = false; });
$('soulClose').addEventListener('click', () => { $('soulPanel').hidden = true; });
$('summonBtn').addEventListener('click', () => {
  const r = summon(P, R);
  if (!r.ok) { $('summonRes').textContent = r.reason; return; }
  if (r.kind === 'soul') {
    const S = SOULS[r.id];
    $('summonRes').innerHTML = r.maxed ? `${S.name} 已滿星，轉換成 ${r.coins} 金幣` : r.isNew ? `<b style="color:${S.color2}">獲得新魂像【${S.name}】！</b>` : `${S.name} 升到 ${r.star} 星！大招傷害提升`;
    if (r.isNew) { $('soulPanel').hidden = true; showCutin(r.id, '召喚'); cutinT = 1.4; pendingUlt = null; setTimeout(() => { renderSouls(); $('soulPanel').hidden = false; }, 1500); }
  } else $('summonRes').textContent = `獲得 ${r.coins} 金幣、藥水 ×1`;
  hud(); save(); renderSouls();
});

// ---------- 離線收益 ----------
function checkOffline() {
  if (!P.seen) return;
  const r = offlineReward(P, (Date.now() - P.seen) / 60000, R);
  if (!r) return;
  const h = Math.floor(r.mins / 60), mm = r.mins % 60;
  $('offlineBody').innerHTML = `<p>你離開了 <b>${h ? `${h} 小時 ` : ''}${mm} 分鐘</b>，角色在「${r.zone}」持續狩獵：</p><div class="loot"><span class="chip">擊倒 ${fmt(r.kills)} 隻</span><span class="chip">經驗 +${fmt(r.exp)}</span><span class="chip"><i class="dot gold"></i>${fmt(r.coins)}</span><span class="chip">裝備 ×${r.items.length}</span></div><p class="muted small">離線最多累積 12 小時，效率約為在線的 60%。</p>`;
  $('offlinePanel').hidden = false;
  $('offlineOk').onclick = () => {
    $('offlinePanel').hidden = true;
    const before = P.lv;
    P.coins += r.coins;
    let eq = 0;
    for (const it of r.items) if (pickupGear(P, it).action === 'equip') eq++;
    if (gainExp(P, r.exp)) levelUp(before);
    if (eq) feed(`離線撿到的裝備有 ${eq} 件比較好，已自動換上`, '#7ad35a');
    hud(); save();
  };
}

// ---------- 對話 ----------
function say(name, lines, opts, onClose) { dialog = { name, lines, i: 0, opts, onClose }; showDialog(); }
function portraitKey(name) {
  const n = [...townNpcs, ...CHAPTERS.slice(1).map((c) => ({ id: 'guide' + c.n, name: c.guide.name }))].find((x) => x.name === name);
  return n ? 'portrait/' + n.id : null;
}
function showDialog() {
  const d = dialog;
  $('dialog').hidden = !d;
  if (!d) return;
  $('dlgName').textContent = d.name;
  const pk = portraitKey(d.name), pim = pk && asset(pk);
  $('dlgPortrait').hidden = !pim; if (pim) $('dlgPortrait').src = pim.src;
  $('dlgText').textContent = d.lines[d.i];
  const last = d.i === d.lines.length - 1;
  const box = $('dlgOpts');
  box.replaceChildren();
  $('dlgNext').hidden = last && !!d.opts;
  if (last && d.opts) d.opts.forEach(([label, fn]) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.addEventListener('click', (e) => { e.stopPropagation(); dialog = null; showDialog(); if (fn) fn(); hud(); save(); });
    box.appendChild(b);
  });
}
function advance() {
  if (!dialog) return;
  if (dialog.i < dialog.lines.length - 1) { dialog.i++; showDialog(); return; }
  if (dialog.opts) { $('dlgOpts').querySelector('button')?.click(); return; }
  const done = dialog.onClose;
  dialog = null; showDialog();
  done?.();
}
$('dialog').addEventListener('click', () => { if (!dialog?.opts || dialog.i < dialog.lines.length - 1) advance(); });

function talk(n) {
  n.face = { up: 'down', down: 'up', left: 'right', right: 'left' }[me.face];
  const nm = n.name;
  if (n.id === 'shop') {
    let total = 0;
    for (const f of FISH) { total += (P.fish[f.id] || 0) * f.price; P.fish[f.id] = 0; }
    P.coins += total;
    shopMenu(nm, total ? [`我來收購你的魚，一共 ${total} 金幣！`, '還需要什麼嗎？'] : ['歡迎光臨！要買點什麼嗎？']);
  } else if (n.id === 'elder') {
    const c1 = P.ch === 1;
    if (c1 && P.step === 0) { P.step = 1; P.kills = 0; say(nm, [`${P.name}，你來得正好！草原上的史萊姆多到快滿出來了。`, '過了東邊的橋就是史萊姆草原。', '幫我清掉 20 隻。懶得操作就按「自動」吧！']); }
    else if (c1 && P.step === 1 && P.kills >= 20) {
      say(nm, ['……等等，你身上那道光是怎麼回事？', '那是「星痕」！艾斯特家的血脈，終於又覺醒了！', '別怕，閉上眼睛，聽聽你靈魂的聲音——'], null, awaken);
    }
    else if (c1 && P.step === 1) say(nm, [`還差 ${20 - P.kills} 隻，加油！`]);
    else if (c1 && P.step === 2) say(nm, ['史萊姆王受傷會分裂，分裂時會張開護盾。', '先打倒小史萊姆王，護盾才會破。', '地上出現紅圈就快點「閃避」！']);
    else if (c1 && P.step === 3) {
      P.coins += 500; P.stones += 200;
      say(nm, ['你真的打倒了史萊姆王！收下這 500 金幣和 200 魂石。', '……那隻魂像，我以前見過。', '六十年前，你的曾祖父雷歐也帶著一模一樣的齒輪。', '他最後去了東邊的迴聲峽谷，就再也沒有回來。', '來，握住這塊懷錶，你會看到他的記憶。'], null, memoryCorridor);
    }
    else if (P.ch <= 6) say(nm, [`${P.name}，${CHAPTERS[P.ch - 1].name}那邊就拜託你了。`, '傳送師小葵就在廣場南邊。']);
    else say(nm, ['你結束了三百年的黑夜。整個微光大陸都在說你的故事。']);
  } else if (n.id === 'porter') {
    if (P.ch === 1) say(nm, ['我能把你傳送到大陸各地。', '不過外面很危險，先完成村長的委託再來吧！']);
    else {
      const opts = CHAPTERS.slice(1).filter((c) => c.n <= Math.min(6, P.ch)).map((c) => [`第 ${c.n} 章・${c.name}（Lv ${MONSTERS[c.mons[0]].lv}～）`, () => { loadMap(c.n); feed(`來到了「${c.name}」`, '#c084ff'); hud(); save(); }]);
      say(nm, ['要去哪裡呢？回來時踩上入口的傳送陣就好。'], [...opts, [`試煉之塔（最高第 ${ensureMeta(P).tower.best} 層）`, () => startTower(P.meta.tower.best + 1)], ['留在村子', null]]);
    }
  } else if (n.id === 'guide') {
    const c = CHAPTERS[n.ch - 1], here = P.ch === n.ch;
    if (!here) say(nm, P.ch > n.ch ? ['謝謝你，英雄。這裡的怪物還會再長回來，隨時來練功吧。'] : ['……你還不該來這裡。']);
    else if (P.step === 0) { P.step = 1; P.kills = 0; say(nm, c.intro); }
    else if (P.step === 1 && P.kills >= c.kills) { P.step = 2; say(nm, c.bossHint); }
    else if (P.step === 1) say(nm, [`還差 ${c.kills - P.kills} 隻。`]);
    else if (P.step === 2) say(nm, c.bossHint);
    else say(nm, c.report, null, () => memoryScene(c));
  } else if (n.id === 'inn') {
    P.hp = stats(P).hp;
    say(nm, ['歡迎來到微光旅店！', '（你好好休息了一下，HP 全部恢復了）']);
  } else if (n.id === 'smith') {
    say(nm, ['想讓裝備更強嗎？我這裡可以「精煉」。', '+4 以內保證成功，再往上就看運氣了。失敗只會吃掉材料，不會弄壞你的裝備。'], [['精煉裝備', () => openRefine()], ['離開', null]]);
  } else if (n.id === 'fisher') {
    say(nm, ['想釣魚嗎？面向河邊按攻擊鍵就能拋竿。', '浮標旁邊跳出「！」的時候，馬上再按一次！', '釣到的魚可以賣給雜貨店的莉莉。']);
  }
  hud(); save();
}
function awaken() {
  P.souls.gear = P.souls.gear || 1; P.soul = 'gear'; soulPower = 100; P.stones += 200; P.step = 2;
  showCutin('gear', '覺醒'); cutinT = 1.8; pendingUlt = null;
  setTimeout(() => {
    banner('獲得魂像【鏽紅齒輪】');
    say('村長・歐文', ['……鏽紅齒輪。它能讓時間倒轉。', '魂力集滿時，按右下角發光的「魂像」鍵就能發動大招。', '我另外給你 200 魂石，可以到「魂像」選單試試星痕召喚。', '現在，你有資格挑戰史萊姆王了。']);
    hud(); save();
  }, 1900);
}
function memoryScene(c) {
  $('app').classList.add('memory');
  say('記憶迴廊', c.memory, null, () => {
    $('app').classList.remove('memory');
    P.coins += 500 * c.n; P.stones += 200;
    banner(`第 ${c.n} 章　完`);
    if (c.n === 6) { P.ch = 7; P.step = 0; setTimeout(() => banner('微光大陸　完'), 2000); feed('恭喜通關！等級上限提高到 60，繼續收集卡片與傳說裝備吧', '#f6c945'); }
    else { P.ch = c.n + 1; P.step = 0; feed(`第 ${c.n + 1} 章「${CHAPTERS[c.n].name}」開放了，找傳送師小葵`, '#f6c945'); }
    hud(); save();
  });
}
function memoryCorridor() {
  $('app').classList.add('memory');
  say('記憶迴廊・六十年前', ['（懷錶的指針開始倒轉，四周的顏色褪成了褐色……）', '雷歐：「齒輪，再幫我一次。只要倒轉三秒就夠了！」', '雷歐：「瓦爾德……你偷走的那些魂像，我一定會一個一個拿回來。」', '雷歐：「如果我回不來，就讓下一個艾斯特來結束這一切吧。」', '（指針停住了。你回到了微光村。）'], null, () => {
    $('app').classList.remove('memory');
    P.ch = 2; P.step = 0; banner('第 1 章　完'); feed('第 2 章「迴聲峽谷」開放了！找廣場南邊的傳送師小葵', '#f6c945'); hud(); save();
  });
}
function shopMenu(nm, lines) {
  const opts = shopList(P.ch).map((id) => [`${ITEMS[id].name} ${ITEMS[id].price} 金幣（有 ${count(P, id)}）`, () => {
    const r = buy(P, id, 1);
    shopMenu(nm, [r.ok ? `謝謝惠顧！${ITEMS[id].name}：${ITEMS[id].desc}。` : r.reason]);
  }]);
  const junk = Object.keys(P.bag.stack).filter((id) => ITEMS[id].grade === 'junk').reduce((a, id) => a + itemSell(id) * count(P, id), 0);
  if (junk) opts.push([`賣掉全部雜物（+${fmt(junk)} 金幣）`, () => { const c = sellAllJunk(P); shopMenu(nm, [`收購完成，一共 ${fmt(c)} 金幣！`]); }]);
  say(nm, lines, [...opts, ['離開', null]]);
}
function smithMenu(nm, lines) {
  say(nm, lines, [[`強化（${fmt(swordCost(P.sword))} 金幣）`, () => {
    const c = swordCost(P.sword);
    if (P.coins < c) smithMenu(nm, [`還差 ${fmt(c - P.coins)} 金幣。`]);
    else { const before = stats(P).cp; P.coins -= c; P.sword++; popCp(before, stats(P).cp); smithMenu(nm, [`叮叮噹噹……完成！武器變成 +${P.sword} 了。`, `下一次強化要 ${fmt(swordCost(P.sword))} 金幣。`]); }
  }], ['離開', null]]);
}

// ---------- 傷害與掉落 ----------
function hitPlayer(m) { hurt(m.d.atk, m); }
function hurt(raw, m) {
  if (me.inv > 0) { floatT('閃避！', me.x, me.y - 0.4, '#bdf1ff', 0.9); return; }
  if (fishing) { fishing = null; floatT('魚跑了', me.x, me.y - 0.5, '#bdf1ff'); }
  const dmg = Math.max(1, Math.round(raw * (1 - stats(P).dr)));
  P.hp -= dmg; me.hurtT = 0.4; shake = Math.max(shake, 0.12);
  floatT(`-${dmg}`, me.x, me.y, '#ff5a6e');
  if (P.hp <= 0 && P.soul === 'cat' && P.souls.cat && catT <= 0) {
    catT = 180; P.hp = Math.round(stats(P).hp * 0.5); me.inv = 1.2;
    banner('九命發動！'); burst(cx(me), cy(me), '#ffe066', 24, 120); hud(); return;
  }
  if (P.hp <= 0) {
    P.hp = stats(P).hp; auto = false; syncAuto();
    if (mapId !== 0) loadMap(0, INN_SPOT);
    Object.assign(me, { x: INN_SPOT.x, y: INN_SPOT.y, px: INN_SPOT.x, py: INN_SPOT.y, fx: INN_SPOT.x, fy: INN_SPOT.y, moving: false, face: 'down' });
    for (const al of allies) { al.down = 0; al.hp = al.max; }
    say('旅店・瑪莎', ['你昏倒在草原上，被路過的冒險者送回來了。', '提升戰鬥力再去吧！HP 已經恢復了。']);
  } else if (auto && P.hp < stats(P).hp * 0.35) usePotion(true);
  hud();
}
const ultMult = () => 1 + 0.2 * ((P.souls[P.soul] || 1) - 1);
function stealCheck(m, kind) {
  if (m.d.mech !== 'steal' || kind !== 'ult') return false;
  if (m.stolen.has(lastUltId)) { if (R() < 0.5) float('無效！', cx(m), m.py * TS - 12, '#c084ff', 1); return true; }
  return false;
}
function gainSoul(x) { if (P.soul && cutinT <= 0) soulPower = Math.min(100, soulPower + x * stats(P).soulGain); }
function dealDamage(m, mult, fromX = me.px, fromY = me.py, color, kind = 'skill') {
  if (m.dead > 0 || m.hp <= 0) return;
  if (m.d.decoy) {
    const boss = mons.find((x) => x.d.mech === 'faceless');
    if (m.real && boss) revealFaceless(boss, m);
    else { m.dead = 1; floatT('猜錯了！', m.x, m.y - 1, '#ff5a6e', 1.2); addFx('boom', 0.35, { x: cx(m), y: cy(m) }); hurt(Math.round(stats(P).hp * 0.2), null); }
    return;
  }
  if (m.shield) { if (R() < 0.35) float('護盾', cx(m), m.py * TS - 10, '#bdf1ff', 0.8); burst(cx(m), cy(m), '#bdf1ff', 3); return; }
  if (stealCheck(m, kind)) return;
  const st = stats(P);
  const crit = R() < st.crit;
  const k = kind === 'skill' ? st.skill : kind === 'ult' ? ultMult() : 1;
  const base = kind === 'ally' ? atkOverride : st.atk;
  const dmg = Math.max(1, Math.round(base * mult * k * (0.85 + R() * 0.3) * (crit ? st.critDmg : 1)));
  if (st.leech && P.hp < st.hp && kind !== 'ally') P.hp = Math.min(st.hp, P.hp + Math.max(1, Math.round(dmg * st.leech)));
  if (kind !== 'ult') gainSoul(kind === 'skill' ? 1.2 : kind === 'ally' ? 0.5 : 1.6);
  m.hp -= dmg; m.flash = 0.12;
  const a = Math.atan2(m.py - fromY, m.px - fromX);
  m.kx = Math.cos(a) * 4; m.ky = Math.sin(a) * 4;
  float(crit ? `${fmt(dmg)}!` : fmt(dmg), cx(m) + (R() - 0.5) * 12, m.py * TS - 2 - R() * 6, crit ? '#ff9f1c' : (color || '#fff8e7'), crit ? 1.45 : 1);
  burst(cx(m), cy(m) + 2, m.d.pal.g || '#c8ccdb', crit ? 9 : 4);
  addFx('hit', crit ? 0.28 : 0.18, { x: cx(m) + (R() - 0.5) * 8, y: cy(m) - 2 + (R() - 0.5) * 8, color: crit ? '#ffd166' : (color || '#e6f2ff'), big: crit });
  combo++; comboT = 2.2; showCombo();
  freeze = Math.max(freeze, crit ? 0.06 : 0.025);
  if (crit) shake = Math.max(shake, 0.1);
  if (m.hp <= 0) killMon(m);
}
function hitArea(tx, ty, radius, mult, color, each, kind = 'skill') {
  for (const m of alive()) if (tdist(m, tx, ty) <= radius + (m.d.boss ? 0.8 : 0)) { dealDamage(m, mult, tx, ty, color, kind); each?.(m); }
}
function killMon(m) {
  const wx = cx(m), wy = cy(m);
  m.dead = m.d.boss ? 30 : 2.5;
  gainSoul(5);
  const pc = m.d.pal.l || '#e6f2ff';
  burst(wx, wy, pc, m.d.boss ? 40 : 14, m.d.boss ? 140 : 90);
  addFx('smoke', 0.5, { x: wx, y: wy, big: m.d.boss });
  ring(wx, wy, m.d.boss ? 40 : 14, pc);
  let coins = m.d.coin[0] + Math.floor(R() * (m.d.coin[1] - m.d.coin[0] + 1));
  const n = Math.min(m.d.boss ? 14 : 5, coins);
  for (let i = 0; i < n; i++) { const v = i === n - 1 ? coins : Math.floor(coins / (n - i)); coins -= v; drops.push(newDrop('coin', wx, wy, v)); }
  const rolls = m.d.boss ? 3 : m.minion ? 0 : R() < DROP_RATE ? 1 : 0;
  for (let i = 0; i < rolls; i++) drops.push(newDrop('gear', wx, wy, rollGear(R, m.d.lv + Math.floor(R() * 2), m.d.boss, P.cls)));
  if (!m.d.still && !m.d.decoy) for (const it of rollDrops(R, m.minion ? '' : m.type)) drops.push(newDrop('loot', wx, wy, it));
  const curCh = CHAPTERS[P.ch - 1];
  if (P.step === 1 && curCh && curCh.mons.includes(m.type) && !m.minion) P.kills++;
  if (m.d.boss) {
    shake = 0.4; flash = 0.25; banner(`擊敗${m.d.name}！`); for (const x of mons) if (x.minion) x.dead = 1;
    if (curCh && curCh.boss === m.type && P.step === 2) {
      P.step = 3; P.stones += 300; feed('首次擊敗獎勵：魂石 ×300', '#c084ff');
      if (curCh.soul) { P.souls[curCh.soul] = Math.min(5, (P.souls[curCh.soul] || 0) + 1); setTimeout(() => { showCutin(curCh.soul, '覺醒'); cutinT = 1.6; pendingUlt = null; feed(`獲得魂像【${SOULS[curCh.soul].name}】，到「魂像」選單裝上`, SOULS[curCh.soul].color2); }, 900); }
    }
  }
  if (m.d.elite) {
    for (let i = 0; i < 2; i++) drops.push(newDrop('gear', wx, wy, rollGear(R, m.d.lv + 1, R() < 0.35, P.cls)));
    if (m.d.elite === 'blast') warns.push({ x: m.px, y: m.py, r: 1.8, t: 0, life: 0.8, dmg: Math.round(m.d.atk * 2), kind: 'slam' });
    feed(`擊敗精英怪「${m.d.name}」！`, ELITE_AFFIX[m.d.elite].color);
  }
  if (!m.minion && !m.d.decoy) {
    const st0 = codexStars(m.type, ensureMeta(P).codex[m.type]);
    questDone(track(P, 'kill', 1, { type: m.type }));
    if (m.d.elite) questDone(track(P, 'elite'));
    if (m.d.boss) questDone(track(P, 'boss'));
    const st1 = codexStars(m.type, P.meta.codex[m.type]);
    if (st1 > st0) { P.cb = codexBonus(P); feed(`圖鑑「${MONSTERS[m.type].name}」升到 ★${st1}，永久能力提升！`, '#ffd166'); }
  }
  floatT(`+${m.d.exp} EXP`, m.x, m.y - 0.9, '#a6ec7a', 0.8);
  const before = P.lv;
  if (gainExp(P, m.d.exp)) levelUp(before);
  if (trial) trialCheck();
  hud();
}
function levelUp(before) {
  P.stones += 20 * (P.lv - before);
  if (talentPoints(P) > talentSpent(P)) feed('獲得天賦點，到「天賦」選單分配', '#7ad35a');
  banner(`等級提升！Lv ${before} → Lv ${P.lv}`);
  const wx = cx(me), wy = cy(me);
  ring(wx, wy, 30, '#f6c945', 0.6, 3); ring(wx, wy, 18, '#fff8e7', 0.45);
  addFx('pillar', 0.7, { x: wx, y: wy, color: '#f6c945' });
  for (let i = 0; i < 10; i++) parts.push({ x: wx, y: wy - 4, vx: (R() - 0.5) * 80, vy: -60 - R() * 60, heart: true, t: 0, g: 240, life: 0.8 });
  flash = Math.max(flash, 0.12);
  save();
}
function newDrop(kind, wx, wy, val) {
  const a = R() * Math.PI * 2, sp = 25 + R() * 40;
  return { kind, val, x: wx, y: wy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, z: 0, vz: 60 + R() * 50, t: 0 };
}
function collect(d) {
  if (d.kind === 'coin') { P.coins += d.val; bump('coinBox'); questDone(track(P, 'coin', d.val)); return; }
  if (d.kind === 'loot') {
    const it = ITEMS[d.val.id], g = GRADES.find((x) => x.id === it.grade);
    const res = pickupItem(P, d.val.id, d.val.n);
    if (it.kind === 'card') { banner(`獲得【${it.name}】！`); flash = 0.15; shake = 0.2; addFx('pillar', 0.8, { x: cx(me), y: cy(me), color: '#ffb03b' }); }
    if (it.grade !== 'junk') feed(`<span style="color:${g.color}">${it.name}</span> ×${d.val.n}${res.action === 'sell' ? `　自動賣出 +${res.coins}` : ''}`, g.color);
    hud(); save(); return;
  }
  const it = d.val, r = rarityOf(it.rarity);
  const res = pickupGear(P, it);
  const oldNote = res.old === 'sell' ? `（換下的自動賣出 +${res.coins}）` : res.old === 'bag' ? '（換下的放進背包）' : '';
  if (res.action === 'equip') {
    feed(`<b style="color:${r.color}">【${r.name}】${it.name}</b> 已裝備${oldNote}`, r.color);
    popCp(res.before, res.after);
    addFx('pillar', 0.6, { x: cx(me), y: cy(me), color: r.color });
  } else if (res.action === 'sell') feed(`<span style="color:${r.color}">【${r.name}】${it.name}</span> 自動賣出 +${res.coins}`, r.color);
  else if (res.action === 'full') feed(`背包滿了！<span style="color:${r.color}">${it.name}</span> 已賣出 +${res.coins}`, '#ff8fa0');
  else feed(`<span style="color:${r.color}">【${r.name}】${it.name}</span> 放進背包${it.slots ? `［${it.slots} 孔］` : ''}`, r.color);
  if (it.rarity === 'epic' || it.rarity === 'legend') { flash = Math.max(flash, 0.1); shake = Math.max(shake, 0.15); }
  hud(); save();
}
function showCombo() {
  const el = $('combo');
  el.innerHTML = `<b>${combo}</b> COMBO`;
  el.hidden = combo < 3;
  el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
}

// ---------- 投射物 ----------
function shoot(kind, ang, opt) {
  const sp = opt.speed;
  const org = opt.from || me;
  projs.push({ kind, x: cx(org), y: cy(org) - 4, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, trav: 0, range: opt.range * TS, pierce: opt.pierce ?? 0, mult: opt.mult, r: opt.r ?? 6, hit: new Set(), home: opt.home || null, onEnd: opt.onEnd, color: opt.color, dk: opt.dk || 'skill', by: opt.by || null });
}
const faceAng = () => ({ right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 })[me.face];
const angTo = (m) => Math.atan2(cy(m) - (cy(me) - 4), cx(m) - cx(me));
function faceToward(m) { const dx = m.px - me.px, dy = m.py - me.py; me.face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); }
function updateProjs(dt) {
  projs = projs.filter((p) => {
    if (p.home && p.home.dead <= 0) {
      const a = Math.atan2(cy(p.home) - p.y, cx(p.home) - p.x), sp = Math.hypot(p.vx, p.vy);
      const cur = Math.atan2(p.vy, p.vx);
      let da = a - cur; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      const na = cur + Math.max(-8 * dt, Math.min(8 * dt, da));
      p.vx = Math.cos(na) * sp; p.vy = Math.sin(na) * sp;
    }
    p.x += p.vx * dt; p.y += p.vy * dt; p.trav += Math.hypot(p.vx, p.vy) * dt;
    if (p.kind === 'fire' && R() < 0.8) parts.push({ x: p.x, y: p.y, vx: (R() - 0.5) * 20, vy: -20 - R() * 20, c: R() < 0.5 ? '#ffb347' : '#ff5a36', t: 0, g: 0, size: 2, life: 0.35 });
    if (p.kind === 'bolt' && R() < 0.6) parts.push({ x: p.x, y: p.y, vx: 0, vy: 0, c: '#d4b8ff', t: 0, g: 0, size: 1, life: 0.25 });
    if (p.kind === 'arrow' || p.kind === 'bolt' || p.kind === 'bigarrow') addFx('trail', 0.18, { x0: p.x - p.vx * 0.03, y0: p.y - p.vy * 0.03, x1: p.x, y1: p.y, color: p.kind === 'bolt' ? '#c084ff' : p.kind === 'bigarrow' ? '#ffe08a' : '#e8ffe0' });
    if (p.kind === 'bigarrow') parts.push({ x: p.x, y: p.y, vx: (R() - 0.5) * 15, vy: (R() - 0.5) * 15, c: '#ffe08a', t: 0, g: 0, size: 2, life: 0.3 });
    if (p.kind === 'wave' && R() < 0.7) parts.push({ x: p.x + (R() - 0.5) * 10, y: p.y + (R() - 0.5) * 10, vx: 0, vy: 0, c: '#bdf1ff', t: 0, g: 0, size: 1, life: 0.3 });
    for (const m of alive()) {
      if (p.hit.has(m)) continue;
      if (Math.hypot(cx(m) - p.x, cy(m) - p.y) < p.r + (m.d.boss ? 12 : 6)) {
        p.hit.add(m);
        if (p.kind !== 'fire') { if (p.by) atkOverride = p.by.atk; dealDamage(m, p.mult, (p.x - p.vx * 0.05) / TS - 0.5, (p.y - p.vy * 0.05) / TS - 0.5, p.color, p.dk); }
        if (p.pierce-- <= 0) { p.onEnd?.(p); return false; }
      }
    }
    const tx = Math.floor(p.x / TS), ty = Math.floor(p.y / TS), t = grid[ty]?.[tx];
    const blocked = t === T.HOUSE || t === undefined; // 箭和魔法可以飛越樹和石頭
    if (p.trav > p.range || blocked) { p.onEnd?.(p); return false; }
    return true;
  });
}

// ---------- 普攻 ----------
function frontTiles() {
  const [dx, dy] = DIRS[me.face];
  const fx = me.x + dx, fy = me.y + dy;
  return dx ? [[fx, fy], [fx, fy - 1], [fx, fy + 1]] : [[fx, fy], [fx - 1, fy], [fx + 1, fy]];
}
const onTiles = (m, tiles) => tiles.some(([x, y]) => (m.d.boss ? Math.abs(m.x - x) <= 1 && Math.abs(m.y - y) <= 1 : m.x === x && m.y === y));
function basicAttack(target) {
  const aspd = stats(P).aspd;
  me.cool = C.cool / aspd; me.atkT = me.atkDur = Math.max(0.16, Math.min(0.28, me.cool * 0.8));
  const [dx, dy] = DIRS[me.face];
  if (P.cls === 'sword') {
    addFx('slash', 0.18, { x: cx(me) + dx * 13, y: cy(me) + dy * 13 - 3, ang: faceAng(), color: '#dff6ff', size: 19 });
    for (const m of alive()) if (onTiles(m, frontTiles())) dealDamage(m, 1, me.px, me.py, null, 'basic');
  } else if (P.cls === 'monk') {
    const off = (R() - 0.5) * 8;
    addFx('punch', 0.12, { x: cx(me) + dx * 14 + (dy ? off : 0), y: cy(me) + dy * 14 - 3 + (dx ? off : 0), color: '#ffd8a8' });
    const t = [frontTiles()[0]];
    for (const m of alive()) if (onTiles(m, t)) dealDamage(m, 1, me.px, me.py, null, 'basic');
  } else if (P.cls === 'archer') {
    const m = target || nearest(C.range);
    if (m) faceToward(m);
    shoot('arrow', m ? angTo(m) : faceAng(), { speed: 320, range: C.range + 1, mult: 1, r: 4, color: '#e8ffe0', dk: 'basic' });
  } else if (P.cls === 'mage') {
    const m = target || nearest(C.range);
    if (m) faceToward(m);
    shoot('bolt', m ? angTo(m) : faceAng(), { speed: 200, range: C.range + 1.5, mult: 1, r: 5, home: m, color: '#e3d0ff', dk: 'basic' });
  }
}

// ---------- 技能 ----------
function castIdx(i) {
  if (!started || dialog || fishing) return;
  const s = skills[i];
  if (!s || s.t > 0 || cutinT > 0) return;
  s.t = s.cd * (1 - stats(P).cdr);
  questDone(track(P, 'skill'));
  const echo = alive().find((m) => m.d.mech === 'echo' && tdist(m, me.px, me.py) <= 8);
  if (echo && lastSkill === s.id) {
    floatT('回音反彈！', me.x, me.y - 1.2, '#b48cff', 1.3); ring(cx(echo), cy(echo), 40, '#b48cff', 0.4, 4);
    hurt(Math.round(stats(P).hp * 0.3), null); lastSkill = null; return;
  }
  lastSkill = s.id;
  addFx('circle', 0.55, { x: cx(me), y: cy(me), color: i === 2 ? '#ffb35c' : C.color });
  tintC = i === 2 ? '#ffb35c' : C.color; tintT = 0.12;
  const [dx, dy] = DIRS[me.face];
  const wx = cx(me), wy = cy(me);
  me.atkT = 0.2;
  const tgt = nearest(P.cls === 'archer' ? C.range : 6);
  switch (s.id) {
    case 'spin':
      addFx('spin', 0.32, { x: wx, y: wy - 3, color: '#dff6ff' });
      ring(wx, wy, 26, '#bdf1ff', 0.3, 3);
      shake = Math.max(shake, 0.15);
      hitArea(me.px, me.py, 1.5, 2.2);
      break;
    case 'wave':
      shoot('wave', faceAng(), { speed: 240, range: 6, pierce: 99, mult: 2, r: 10, color: '#bdf1ff' });
      ring(wx + dx * 10, wy + dy * 10, 12, '#bdf1ff', 0.2);
      break;
    case 'quake': {
      const px = me.px + dx * 2, py = me.py + dy * 2;
      addFx('bigsword', 0.3, { x: px * TS + 8, y: py * TS + 8 });
      pending.push({ t: 0.26, fn: () => {
        addFx('crack', 0.9, { x: px * TS + 8, y: py * TS + 8, seed: R() });
        ring(px * TS + 8, py * TS + 8, 52, '#ffd166', 0.5, 6); ring(px * TS + 8, py * TS + 8, 32, '#fff8e7', 0.4, 3); addFx('pillar', 0.5, { x: px * TS + 8, y: py * TS + 8, color: '#ffd166' });
        burst(px * TS + 8, py * TS + 8, '#c9a77a', 24, 120);
        shake = 0.45; flash = 0.15;
        hitArea(px, py, 2.2, 4.5, '#ffe08a');
      } });
      break;
    }
    case 'triple': {
      const base = tgt ? angTo(tgt) : faceAng();
      if (tgt) faceToward(tgt);
      for (const o of [-0.22, 0, 0.22]) shoot('arrow', base + o, { speed: 340, range: C.range + 1, pierce: 1, mult: 1.4, r: 4, color: '#e8ffe0' });
      break;
    }
    case 'rain': {
      const px = tgt ? tgt.px : me.px + dx * 3, py = tgt ? tgt.py : me.py + dy * 3;
      if (tgt) faceToward(tgt);
      addFx('target', 0.8, { x: px * TS + 8, y: py * TS + 8 });
      for (let k = 0; k < 16; k++) {
        const ax = px + (R() - 0.5) * 3, ay = py + (R() - 0.5) * 3, delay = 0.1 + k * 0.045;
        addFx('arrowfall', delay + 0.12, { x: ax * TS + 8, y: ay * TS + 8, delay });
        pending.push({ t: delay + 0.12, fn: () => { burst(ax * TS + 8, ay * TS + 8, '#e8ffe0', 3, 40); hitArea(ax, ay, 0.8, 0.75, '#e8ffe0'); } });
      }
      break;
    }
    case 'pierce': {
      const a = tgt ? angTo(tgt) : faceAng();
      if (tgt) faceToward(tgt);
      shoot('bigarrow', a, { speed: 380, range: 10, pierce: 99, mult: 3.6, r: 8, color: '#ffe08a' });
      ring(wx, wy, 16, '#ffe08a', 0.25, 3); shake = Math.max(shake, 0.12);
      break;
    }
    case 'nova':
      addFx('nova', 0.45, { x: wx, y: wy });
      for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; parts.push({ x: wx, y: wy, vx: Math.cos(a) * 110, vy: Math.sin(a) * 110, c: k % 2 ? '#dff6ff' : '#7fd8ff', t: 0, g: 0, size: 3, life: 0.35 }); }
      shake = Math.max(shake, 0.12);
      hitArea(me.px, me.py, 2.3, 1.8, '#bdf1ff', (m) => { m.frozen = 2.5; });
      break;
    case 'fireball': {
      const a = tgt ? angTo(tgt) : faceAng();
      if (tgt) faceToward(tgt);
      shoot('fire', a, { speed: 210, range: 6, mult: 3, r: 7, home: tgt, color: '#ffb347', onEnd: (p) => {
        const ex = p.x / TS - 0.5, ey = p.y / TS - 0.5;
        ring(p.x, p.y, 38, '#ff8a3d', 0.45, 6); ring(p.x, p.y, 22, '#ffe08a', 0.35, 3); addFx('boom', 0.35, { x: p.x, y: p.y });
        burst(p.x, p.y, '#ff5a36', 18, 110); burst(p.x, p.y, '#ffd166', 12, 80);
        shake = Math.max(shake, 0.22); flash = Math.max(flash, 0.06);
        hitArea(ex, ey, 1.7, 3, '#ffb347');
      } });
      break;
    }
    case 'chain': {
      if (!tgt) { floatT('附近沒有怪物', me.x, me.y - 0.8, '#bdf1ff', 0.8); s.t = 0.5; break; }
      const chain = [tgt]; const used = new Set([tgt]);
      while (chain.length < 6) {
        const last = chain[chain.length - 1];
        let nx = null, nd = 1e9;
        for (const m of alive()) if (!used.has(m)) { const d = tdist(m, last.px, last.py); if (d <= 3.2 && d < nd) { nd = d; nx = m; } }
        if (!nx) break; chain.push(nx); used.add(nx);
      }
      const pts = [[wx, wy - 6], ...chain.map((m) => [cx(m), cy(m)])];
      addFx('lightning', 0.32, { pts });
      flash = Math.max(flash, 0.08); shake = Math.max(shake, 0.15);
      chain.forEach((m, k) => pending.push({ t: 0.03 * k, fn: () => { burst(cx(m), cy(m), '#fff7a8', 6, 60); dealDamage(m, 2.4, me.px, me.py, '#fff7a8'); } }));
      break;
    }
    case 'barrage':
      for (let k = 0; k < 10; k++) pending.push({ t: k * 0.055, fn: () => {
        const off = (R() - 0.5) * 14;
        addFx('punch', 0.12, { x: cx(me) + dx * (13 + R() * 6) + (dy ? off : 0), y: cy(me) + dy * (13 + R() * 6) - 3 + (dx ? off : 0), color: k === 9 ? '#ffd166' : '#ffd8a8', big: k === 9 });
        for (const m of alive()) if (onTiles(m, frontTiles())) dealDamage(m, k === 9 ? 1.8 : 0.6);
        if (k === 9) { ring(cx(me) + dx * 16, cy(me) + dy * 16, 18, '#ffd166', 0.3, 3); shake = Math.max(shake, 0.15); }
      } });
      break;
    case 'shock':
      ring(wx, wy + 4, 48, '#c9a77a', 0.5, 6); ring(wx, wy + 4, 30, '#ffd8a8', 0.4, 3);
      burst(wx, wy + 6, '#c9a77a', 22, 110);
      shake = Math.max(shake, 0.28);
      hitArea(me.px, me.py, 2.2, 2.2, '#ffd8a8', (m) => {
        const kx = Math.sign(m.x - me.x), ky = Math.sign(m.y - me.y);
        if (!m.d.boss && !m.moving && m.dead <= 0 && monCanGo(m, m.x + kx, m.y + ky)) Object.assign(m, { fx: m.x, fy: m.y, x: m.x + kx, y: m.y + ky, moving: true, mt: 0 });
      });
      break;
    case 'dragon': {
      const path = [];
      let x = me.x, y = me.y;
      for (let k = 0; k < 3; k++) { const nx = x + dx, ny = y + dy; if (!walkable(grid, nx, ny) || npcs.some((n) => n.x === nx && n.y === ny)) break; x = nx; y = ny; path.push([x, y]); }
      while (path.length && occupied(path[path.length - 1][0], path[path.length - 1][1])) path.pop();
      const end = path.length ? path[path.length - 1] : [me.x, me.y];
      addFx('dragon', 0.55, { x0: cx(me), y0: cy(me), x1: end[0] * TS + 8, y1: end[1] * TS + 8 });
      Object.assign(me, { fx: me.x, fy: me.y, x: end[0], y: end[1], moving: true, mt: 0, dur: 0.16 });
      shake = Math.max(shake, 0.25);
      const hitSet = new Set();
      for (const [px, py] of [[me.fx, me.fy], ...path]) for (const m of alive()) if (!hitSet.has(m) && tdist(m, px, py) <= 1.3 + (m.d.boss ? 0.8 : 0)) hitSet.add(m);
      hitSet.forEach((m) => pending.push({ t: 0.08, fn: () => dealDamage(m, 3.2, me.fx, me.fy, '#ffe08a') }));
      break;
    }
  }
}

// ---------- 魂像大招 ----------
function showCutin(id, label) {
  const S = SOULS[id];
  const el = $('cutin');
  el.style.setProperty('--sc', S.color); el.style.setProperty('--sc2', S.color2);
  const art = asset('soul_art/' + id);
  $('cutinArt').replaceChildren(art ? Object.assign(art.cloneNode(), { className: 'hdart' }) : soulBig(id, 8));
  $('cutName').innerHTML = `<small>${label || S.type}</small>${S.name}`;
  $('cutSfx').innerHTML = [...S.sfx].map((ch, i) => `<span style="animation-delay:${i * 0.07}s">${ch}</span>`).join('');
  el.hidden = false; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
}
// ---------- 長期玩法：獎勵、試煉之塔、冒險手冊 ----------
function grant(r) {
  if (!r) return;
  if (r.coins) P.coins += r.coins;
  if (r.stones) P.stones += r.stones;
  for (const [id, n] of Object.entries(r.items || {})) if (n > 0) addStack(P, id, n);
  if (r.exp) { const before = P.lv; if (gainExp(P, r.exp)) levelUp(before); }
  feed(`獲得：${rewardText(r)}`, '#ffd166'); bump('coinBox'); hud(); save();
}
function questDone(list) { for (const q of list) feed(`任務完成：${questLabel(q)}（到「冒險」領獎）`, '#f6c945'); if (list.length) hud(); }
function startTower(f) {
  const fl = towerFloor(P, f);
  loadMap(fl.ch);
  trial = { f, t: fl.time, done: false };
  npcs = []; mons = [];
  for (const x of fl.list) { const m = { type: x.type, d: x.d, anim: R() * 2 }; mons.push(m); placeMon(m); }
  P.hp = stats(P).hp;
  banner(`試煉之塔　第 ${f} 層`);
  feed(`${fl.time} 秒內打倒全部 ${fl.list.length} 隻怪物（怪物 Lv ${fl.lv}${fl.boss ? '，魔王層' : ''}）`, '#c084ff');
  $('advPanel').hidden = true; hud();
}
function trialCheck() {
  if (!trial || trial.done || mons.some((m) => m.dead <= 0)) return;
  trial.done = true;
  const f = trial.f, r = towerClear(P, f);
  questDone(track(P, 'tower'));
  banner(`第 ${f} 層　通過！`); flash = 0.2;
  if (r.gear) drops.push(newDrop('gear', cx(me), cy(me), rollGear(R, towerFloor(P, f).lv, true, P.cls)));
  pending.push({ t: 1.4, fn: () => {
    grant(r.reward);
    say('試煉之塔', [`第 ${f} 層通過！${r.first ? '（首次通過，額外獎勵）' : ''}`, `目前最高紀錄：第 ${P.meta.tower.best} 層`], [[`挑戰第 ${f + 1} 層`, () => startTower(f + 1)], ['回到村子', () => { loadMap(0, { x: 11, y: 17 }); hud(); }]]);
  } });
  hud();
}
let advTab = 'daily';
function qRow(text, prog, need, btn) {
  const row = document.createElement('div'); row.className = 'qrow';
  const pct = Math.round((Math.min(prog, need) / need) * 100);
  row.innerHTML = `<div class="qt"><div>${text}</div><div class="qbar"><i style="width:${pct}%"></i><span>${Math.min(prog, need)} / ${need}</span></div></div>`;
  if (btn) row.append(btn);
  return row;
}
function mkBtn(label, on, fn) { const b = document.createElement('button'); b.type = 'button'; b.className = on ? 'qbtn on' : 'qbtn'; b.textContent = label; b.disabled = !on; if (fn) b.addEventListener('click', fn); return b; }
function renderAdv() {
  refresh(P);
  const m = ensureMeta(P), box = $('advBody');
  document.querySelectorAll('#advTabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === advTab));
  const out = [];
  const note = (t) => { const p = document.createElement('p'); p.className = 'small muted'; p.innerHTML = t; out.push(p); };
  if (advTab === 'daily' || advTab === 'weekly') {
    const list = advTab === 'daily' ? m.daily : m.weekly;
    if (advTab === 'daily') {
      note(`每天 0 點更新。完成任務得到活躍度，活躍度滿 20／40／60／80／100 可以開寶箱。目前活躍度 <b>${m.act}</b>`);
      const chests = document.createElement('div'); chests.className = 'chests';
      CHESTS.forEach((v, i) => { const got = m.chests.includes(i), ok = m.act >= v && !got; chests.append(mkBtn(got ? `✓ ${v}` : `寶箱 ${v}`, ok, () => { grant(claimChest(P, i)); renderAdv(); })); });
      out.push(chests);
    } else note('每週一 0 點更新，獎勵比較豐富。');
    for (const q of list) out.push(qRow(`${questLabel(q)}<small class="muted">　${rewardText(q.reward)}</small>`, q.prog, q.need, mkBtn(q.claimed ? '已領' : q.prog >= q.need ? '領取' : '進行中', !q.claimed && q.prog >= q.need, () => { grant(claimQuest(P, q)); renderAdv(); })));
  } else if (advTab === 'login') {
    const today = m.login.last === m.day;
    note(`累計簽到 <b>${m.login.n}</b> 天（漏簽不會歸零，7 天一輪）`);
    const grid = document.createElement('div'); grid.className = 'logins';
    const base = Math.floor((today ? m.login.n - 1 : m.login.n) / LOGIN_CYCLE) * LOGIN_CYCLE;
    for (let i = 1; i <= LOGIN_CYCLE; i++) {
      const n = base + i, got = n <= m.login.n, d = document.createElement('div');
      d.className = 'lday' + (got ? ' got' : '') + (n === m.login.n + 1 && !today ? ' next' : '');
      d.innerHTML = `<b>第 ${i} 天</b><span>${rewardText(loginReward(P, n))}</span>${got ? '<em>✓</em>' : ''}`;
      grid.append(d);
    }
    out.push(grid);
    out.push(mkBtn(today ? '今天已簽到' : '簽到領獎', !today, () => { const r = claimLogin(P); if (r) grant(r.reward); renderAdv(); }));
  } else if (advTab === 'tower') {
    const best = m.tower.best;
    note(`無限層數的挑戰。每層要在時限內打倒全部怪物，每 5 層是魔王層。<br>首次通過有魂石，魔王層首通再送精煉材料和高稀有度裝備。重複挑戰也能拿金幣和經驗。<br>最高紀錄：<b>第 ${best} 層</b>　下一層怪物等級：Lv ${towerFloor(P, best + 1).lv}`);
    if (P.ch < 2) note('<b>打倒第 1 章的史萊姆王後開放。</b>');
    else {
      out.push(mkBtn(`挑戰第 ${best + 1} 層`, true, () => startTower(best + 1)));
      const pick = document.createElement('div'); pick.className = 'chests';
      for (const f of [...new Set([1, Math.max(1, best - 9), Math.max(1, best - 4), best].filter((x) => x >= 1 && x <= best))]) pick.append(mkBtn(`重打第 ${f} 層`, true, () => startTower(f)));
      if (best) out.push(pick);
    }
  } else if (advTab === 'codex') {
    const b = codexBonus(P);
    note(`每種怪物打到一定數量會升星，提供<b>永久</b>加成。目前總加成：攻擊 +${b.atkPct}%、生命 +${b.hpPct}%<br>一般怪 ★ 門檻 ${CODEX_TIERS(false).join('／')} 隻，魔王 ${CODEX_TIERS(true).join('／')} 次`);
    const grid = document.createElement('div'); grid.className = 'codex';
    for (const c of CHAPTERS.slice(0, Math.min(6, P.ch))) for (const t of [...c.mons, c.boss]) {
      const k = m.codex[t] || 0, s = codexStars(t, k), d = document.createElement('div');
      d.className = 'cmon' + (k ? '' : ' unknown');
      const im = asset('monster/' + t);
      d.innerHTML = `${im ? `<img src="${im.src}" alt="">` : ''}<b>${k ? MONSTERS[t].name : '？？？'}</b><span class="stars">${'★'.repeat(s)}${'☆'.repeat(3 - s)}</span><small>${k} 隻</small>`;
      grid.append(d);
    }
    out.push(grid);
  } else if (advTab === 'ach') {
    const owned = ACHIEVEMENTS.filter((a) => m.ach[a.id]);
    note(`完成成就可以領魂石並獲得稱號，稱號會顯示在角色頭上。目前稱號：<b>${m.title || '無'}</b>`);
    if (owned.length) { const t = document.createElement('div'); t.className = 'chests'; t.append(mkBtn('不顯示', !!m.title, () => { m.title = ''; save(); renderAdv(); })); for (const a of owned) t.append(mkBtn(a.title, m.title !== a.title, () => { m.title = a.title; save(); renderAdv(); })); out.push(t); }
    for (const a of ACHIEVEMENTS) { const [v, need] = achProgress(P, a), got = m.ach[a.id]; out.push(qRow(`<b>【${a.title}】</b>${a.text}<small class="muted">　魂石 ${a.stones}</small>`, v, need, mkBtn(got ? '已領' : v >= need ? '領取' : '未達成', !got && v >= need, () => { grant(claimAch(P, a.id)); renderAdv(); }))); }
  }
  box.replaceChildren(...out);
  hud();
}
$('advBtn').addEventListener('click', () => { if (!started) return; renderAdv(); $('advPanel').hidden = false; });
$('advClose').addEventListener('click', () => { $('advPanel').hidden = true; });
document.querySelectorAll('#advTabs button').forEach((b) => b.addEventListener('click', () => { advTab = b.dataset.t; renderAdv(); }));

// 魔王登場特寫：第一次走進魔王區時，放精緻原圖＋名字
let bossSeen = new Set();
function bossIntro() {
  if (cutinT > 0 || dialog || !inBoss(me.x, me.y)) return;
  const b = mons.find((m) => m.d.boss && m.dead <= 0);
  if (!b || bossSeen.has(b.type)) return;
  bossSeen.add(b.type);
  const art = asset('monster/' + b.type);
  if (!art) return;
  const el = $('cutin');
  el.style.setProperty('--sc', '#7a1f2b'); el.style.setProperty('--sc2', '#ff5a5a');
  $('cutinArt').replaceChildren(Object.assign(art.cloneNode(), { className: 'hdart' }));
  $('cutName').innerHTML = `<small>Lv ${b.d.lv}　魔王</small>${b.d.name}`;
  $('cutSfx').innerHTML = [...'登場'].map((ch, i) => `<span style="animation-delay:${i * 0.07}s">${ch}</span>`).join('');
  el.hidden = false; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
  cutinT = 1.6; pendingUlt = null;
}
function castUlt() {
  if (!started || dialog || !P.soul || soulPower < 100 || cutinT > 0) return;
  soulPower = 0; pendingUlt = P.soul; lastUltId = P.soul; questDone(track(P, 'ult'));
  showCutin(P.soul); cutinT = 1.1;
}
function doUlt(id) {
  const wx = cx(me), wy = cy(me);
  addFx('circle', 0.9, { x: wx, y: wy, color: SOULS[id].color2 }); tintC = SOULS[id].color; tintT = 0.25;
  flash = 0.18; shake = 0.35;
  const thief = alive().find((m) => m.d.mech === 'steal' && tdist(m, me.px, me.py) <= 9);
  if (thief && !thief.stolen.has(id)) pending.push({ t: 1.7, fn: () => { if (thief.dead > 0) return; thief.stolen.add(id); banner(`瓦爾德偷走了「${SOULS[id].name}」！`); feed(`之後「${SOULS[id].name}」的大招對瓦爾德無效，換一隻魂像！`, '#c084ff'); } });
  if (id === 'thread') {
    const ts = alive().filter((m) => tdist(m, me.px, me.py) <= 5);
    addFx('pull', 0.8, { x: wx, y: wy, pts: ts.map((m) => [cx(m), cy(m)]), thread: true });
    ts.forEach((m) => dealDamage(m, 3.5, me.px, me.py, '#ffd1dc', 'ult'));
    pending.push({ t: 0.8, fn: () => { ring(wx, wy, 60, '#ff6b8a', 0.4, 4); ts.forEach((m) => dealDamage(m, 2, me.px, me.py, '#ffd1dc', 'ult')); shake = 0.3; } });
  } else if (id === 'bird') {
    for (let k = 0; k < 4; k++) pending.push({ t: k * 0.12, fn: () => ring(wx, wy, 30 + k * 18, k % 2 ? '#ffffff' : '#7fd8ff', 0.5, 3) });
    hitArea(me.px, me.py, 5, 3, '#e0f8ff', (m) => { m.frozen = 3; }, 'ult');
  }
  if (id === 'gear') {
    addFx('clock', 0.9, { x: wx, y: wy });
    hitArea(me.px, me.py, 3.2, 4, '#ffb35c', (m) => {
      m.frozen = 2.5;
      if (m.moving) { m.x = m.fx; m.y = m.fy; }
      m.px = m.x; m.py = m.y; m.moving = false;
    }, 'ult');
  } else if (id === 'post') {
    const ts = alive().filter((m) => Math.abs(m.px - me.px) <= 6 && Math.abs(m.py - me.py) <= 7);
    ts.forEach((m, i) => {
      m.letter = 1.5;
      for (let k = 0; k < 3; k++) parts.push({ x: wx, y: wy - 10, vx: (cx(m) - wx) * 2.4 + (R() - 0.5) * 40, vy: (cy(m) - wy) * 2.4 - 30, c: k ? '#fff8e7' : '#4fa3ff', t: -i * 0.02, g: 0, size: 3, life: 0.4 });
      pending.push({ t: 1.5, fn: () => { if (m.dead > 0) return; m.letter = 0; ring(cx(m), cy(m), 22, '#4fa3ff', 0.35, 4); addFx('boom', 0.3, { x: cx(m), y: cy(m) }); dealDamage(m, 5, me.px, me.py, '#bfe3ff', 'ult'); } });
    });
    pending.push({ t: 1.5, fn: () => { shake = 0.4; flash = 0.12; } });
  } else if (id === 'magnet') {
    const ts = alive().filter((m) => tdist(m, me.px, me.py) <= 4 + (m.d.boss ? 1 : 0));
    addFx('pull', 0.45, { x: wx, y: wy, pts: ts.map((m) => [cx(m), cy(m)]) });
    for (const m of ts) {
      if (m.d.boss) continue;
      for (let k = 0; k < 3; k++) {
        const dx = Math.sign(me.x - m.x), dy = Math.sign(me.y - m.y), nx = m.x + (Math.abs(me.x - m.x) >= Math.abs(me.y - m.y) ? dx : 0), ny = m.y + (Math.abs(me.x - m.x) < Math.abs(me.y - m.y) ? dy : 0);
        if (Math.abs(nx - me.x) + Math.abs(ny - me.y) < 1 || !walkable(grid, nx, ny) || occupied(nx, ny, m)) break;
        m.x = nx; m.y = ny;
      }
      Object.assign(m, { fx: m.px, fy: m.py, moving: true, mt: 0 });
    }
    pending.push({ t: 0.45, fn: () => {
      ring(cx(me), cy(me), 50, '#b48cff', 0.45, 6); ring(cx(me), cy(me), 32, '#ff6b8a', 0.4, 4); shake = 0.4;
      hitArea(me.px, me.py, 2.4, 4.5, '#ffd1dc', (m) => {
        const kx = Math.sign(m.x - me.x), ky = Math.sign(m.y - me.y);
        if (!m.d.boss && m.dead <= 0 && !m.moving && monCanGo(m, m.x + kx, m.y + ky)) Object.assign(m, { fx: m.x, fy: m.y, x: m.x + kx, y: m.y + ky, moving: true, mt: 0 });
      }, 'ult');
    } });
  } else if (id === 'cat') {
    for (let k = 0; k < 9; k++) pending.push({ t: k * 0.07, fn: () => {
      const a = R() * Math.PI * 2;
      addFx('claw', 0.18, { x: cx(me) + Math.cos(a) * 14, y: cy(me) + Math.sin(a) * 12, ang: a + Math.PI / 2 });
      hitArea(me.px, me.py, 1.7, 1, '#ffe066', null, 'ult');
      if (k === 8) { ring(cx(me), cy(me), 36, '#ffe066', 0.4, 5); shake = 0.35; }
    } });
  }
}
function dodge() {
  if (!started || dialog || me.dodgeT > 0 || cutinT > 0) return;
  const dir = held || me.face, [dx, dy] = DIRS[dir];
  if (fishing) fishing = null;
  const path = [];
  let x = me.x, y = me.y;
  for (let k = 0; k < 2; k++) { const nx = x + dx, ny = y + dy; if (!walkable(grid, nx, ny) || npcs.some((n) => n.x === nx && n.y === ny)) break; x = nx; y = ny; path.push([x, y]); }
  while (path.length && occupied(path.at(-1)[0], path.at(-1)[1])) path.pop();
  me.face = dir; me.inv = 0.4; me.dodgeT = 3;
  addFx('ghost', 0.3, { x: me.px, y: me.py, face: dir });
  addFx('smoke', 0.4, { x: cx(me), y: cy(me) + 6 });
  if (path.length) { const [ex, ey] = path.at(-1); Object.assign(me, { fx: me.px, fy: me.py, x: ex, y: ey, moving: true, mt: 0, dur: 0.18 }); }
  burst(cx(me), cy(me) + 6, '#e8d8c0', 6, 50);
}

// ---------- 隊伍 ----------
function buildAllies() {
  const st = stats(P);
  const old = new Map(allies.map((a) => [a.id, a]));
  const slots = [[-1, 1], [1, 1], [0, 2], [-1, -1], [1, -1]];
  allies = P.party.active.map((id, i) => {
    const c = COMPANIONS[id], { max, atk } = allyStats(c, st);
    const prev = old.get(id);
    if (prev) return Object.assign(prev, { max, atk, hp: Math.min(max, prev.hp || max) });
    let x = me.x, y = me.y;
    for (const [ox, oy] of [slots[i], ...slots]) { const nx = me.x + ox, ny = me.y + oy; if (walkable(grid, nx, ny) && !occupied(nx, ny)) { x = nx; y = ny; break; } }
    return { id, c, i, x, y, px: x, py: y, fx: x, fy: y, moving: false, mt: 0, step: 0, face: 'down', max, atk, hp: max, cool: R(), skT: c.skillCd * 0.5, down: 0, atkT: 0, hurtT: 0 };
  });
  renderPartyFrames();
}
function allyHurt(a, raw) {
  if (a.down > 0) return;
  const dmg = Math.max(1, Math.round(raw * (a.c.role === 'tank' ? 0.6 : 1)));
  a.hp -= dmg; a.hurtT = 0.3;
  float(`-${dmg}`, cx(a), a.py * TS, '#ff8fa0', 0.75);
  if (a.hp <= 0) { a.hp = 0; a.down = 20; feed(`${a.c.name} 倒下了！20 秒後自己爬起來，或請牧師治療`, '#ff8fa0'); }
}
function monTarget(m) {
  if (m.tauntT > 0 && m.tauntBy && m.tauntBy.down <= 0) return m.tauntBy;
  let best = me, bd = Math.abs(me.x - m.x) + Math.abs(me.y - m.y);
  for (const a of allies) { if (a.down > 0) continue; const d = Math.abs(a.x - m.x) + Math.abs(a.y - m.y); if (d < bd) { bd = d; best = a; } }
  return best;
}
const okFoe = (m) => m.dead <= 0 && !m.hidden && !m.d.decoy && !m.shield;
function allyStepTo(a, gx, gy) {
  let best = null, bd = Math.hypot(a.x - gx, a.y - gy);
  for (const [dx, dy] of Object.values(DIRS)) { const nx = a.x + dx, ny = a.y + dy; if (!walkable(grid, nx, ny) || occupied(nx, ny, a) || grid[ny][nx] === T.PORTAL) continue; const d = Math.hypot(nx - gx, ny - gy); if (d < bd - 0.01) { bd = d; best = [nx, ny, dx, dy]; } }
  if (!best) return;
  a.face = best[2] > 0 ? 'right' : best[2] < 0 ? 'left' : best[3] > 0 ? 'down' : 'up';
  Object.assign(a, { fx: a.x, fy: a.y, x: best[0], y: best[1], moving: true, mt: 0 });
}
function allyFace(a, m) { const dx = m.px - a.px, dy = m.py - a.py; a.face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); }
function allyAttack(a, m, mult) { atkOverride = a.atk; dealDamage(m, mult, a.px, a.py, a.c.color, 'ally'); }
function updateAllies(dt) {
  partyT -= dt;
  if (partyT <= 0) { partyT = 2; const st = stats(P); for (const a of allies) { const { max, atk } = allyStats(a.c, st); a.hp = Math.round(a.hp * (max / (a.max || max))); a.max = max; a.atk = atk; } }
  const members = [{ me: true, px: me.px, py: me.py, hp: P.hp, max: stats(P).hp }, ...allies.filter((a) => a.down <= 0).map((a) => ({ a, px: a.px, py: a.py, hp: a.hp, max: a.max }))];
  for (const a of allies) {
    a.cool -= dt; a.skT -= dt; a.atkT = Math.max(0, a.atkT - dt); a.hurtT = Math.max(0, a.hurtT - dt);
    if (a.moving) { if (step(a, 0.16, dt)) a.step ^= 1; continue; }
    if (a.down > 0) { a.down -= dt; if (a.down <= 0) { a.hp = Math.round(a.max * 0.5); floatT('復活！', a.x, a.y - 0.8, '#a6ec7a', 0.9); } continue; }
    if (inSafe() && a.hp < a.max) a.hp = Math.min(a.max, a.hp + a.max * 0.08 * dt);
    const far = Math.hypot(a.x - me.x, a.y - me.y);
    if (far > 12) { const [ox, oy] = [[-1, 1], [1, 1], [0, 2]][a.i] || [0, 1]; if (walkable(grid, me.x + ox, me.y + oy) && !occupied(me.x + ox, me.y + oy, a)) Object.assign(a, { x: me.x + ox, y: me.y + oy, px: me.x + ox, py: me.y + oy, fx: me.x + ox, fy: me.y + oy }); continue; }
    if (!started || dialog || cutinT > 0) continue;
    const c = a.c;
    // 治療
    if (c.role === 'heal' && a.skT <= 0) {
      const downed = allies.find((b) => b.down > 0 && Math.hypot(b.px - a.px, b.py - a.py) <= 6);
      const low = members.filter((x) => x.hp / x.max < 0.65).sort((x, y) => x.hp / x.max - y.hp / y.max)[0];
      if (downed) { downed.down = 0; downed.hp = Math.round(downed.max * 0.4); a.skT = 8; addFx('heal', 0.8, { x: cx(downed), y: cy(downed) }); floatT('復活！', downed.x, downed.y - 0.8, '#a6ec7a', 1); allyFace(a, downed); a.atkT = 0.3; continue; }
      if (low) {
        const amt = Math.round(low.max * 0.28);
        if (low.me) { P.hp = Math.min(low.max, P.hp + amt); addFx('heal', 0.7, { x: cx(me), y: cy(me) }); floatT(`+${fmt(amt)}`, me.x, me.y, '#a6ec7a'); hud(); }
        else { low.a.hp = Math.min(low.a.max, low.a.hp + amt); addFx('heal', 0.7, { x: cx(low.a), y: cy(low.a) }); }
        addFx('circle', 0.5, { x: cx(a), y: cy(a), color: '#a6ec7a' }); a.skT = c.skillCd; a.atkT = 0.3; continue;
      }
    }
    // 找目標：主動出擊＝主角附近 6 格；跟隨＝只打靠近隊伍的怪
    const reach = P.party.tactic === 'assist' ? 6 : 2.5;
    let tgt = null, td = 1e9;
    for (const m of mons) { if (!okFoe(m)) continue; const dp = Math.hypot(m.px - me.px, m.py - me.py); if (dp > reach + (m.d.boss ? 1 : 0)) continue; const d = Math.hypot(m.px - a.px, m.py - a.py); if (d < td) { td = d; tgt = m; } }
    if (c.role === 'tank' && a.skT <= 0) {
      const near = mons.filter((m) => okFoe(m) && Math.hypot(m.px - a.px, m.py - a.py) <= 3.2);
      if (near.length) { for (const m of near) { m.tauntT = 5; m.tauntBy = a; } a.skT = c.skillCd; ring(cx(a), cy(a), 42, '#ffd166', 0.5, 4); addFx('circle', 0.6, { x: cx(a), y: cy(a), color: '#ffd166' }); floatT('嘲諷！', a.x, a.y - 0.9, '#ffd166', 0.9); continue; }
    }
    if (tgt) {
      const inRange = c.range > 1 ? td <= c.range : Math.abs(tgt.x - a.x) + Math.abs(tgt.y - a.y) === 1 || (tgt.d.boss && Math.max(Math.abs(tgt.x - a.x), Math.abs(tgt.y - a.y)) <= 1);
      if (inRange) {
        allyFace(a, tgt);
        if (a.skT <= 0 && c.role === 'dps') {
          a.skT = c.skillCd; a.atkT = 0.3; addFx('circle', 0.5, { x: cx(a), y: cy(a), color: c.color });
          if (a.id === 'carlos') { const base = Math.atan2(cy(tgt) - cy(a) + 4, cx(tgt) - cx(a)); for (const o of [-0.3, -0.15, 0, 0.15, 0.3]) shoot('arrow', base + o, { speed: 340, range: 7, pierce: 1, mult: 1.3, r: 4, color: '#e8ffe0', from: a, by: a, dk: 'ally' }); }
          else if (a.id === 'nova') shoot('fire', Math.atan2(cy(tgt) - cy(a) + 4, cx(tgt) - cx(a)), { speed: 200, range: 6, mult: 0, r: 7, home: tgt, color: '#ffb347', from: a, by: a, dk: 'ally', onEnd: (p) => { ring(p.x, p.y, 30, '#ff8a3d', 0.4, 5); addFx('boom', 0.3, { x: p.x, y: p.y }); burst(p.x, p.y, '#ff5a36', 14, 100); for (const m of alive()) if (Math.hypot(cx(m) - p.x, cy(m) - p.y) <= 28) allyAttack(a, m, 3); } });
          else for (let k = 0; k < 6; k++) pending.push({ t: k * 0.06, fn: () => { if (tgt.dead <= 0) { allyAttack(a, tgt, 0.8); addFx('punch', 0.12, { x: cx(tgt) + (R() - 0.5) * 10, y: cy(tgt) + (R() - 0.5) * 10, color: '#ffd8a8', big: k === 5 }); } } });
          continue;
        }
        if (a.cool <= 0) {
          a.cool = c.cool; a.atkT = a.atkDur = 0.22;
          if (c.range > 1) shoot(c.role === 'heal' || a.id === 'nova' ? 'bolt' : 'arrow', Math.atan2(cy(tgt) - cy(a) + 4, cx(tgt) - cx(a)), { speed: c.role === 'heal' || a.id === 'nova' ? 200 : 320, range: c.range + 1, mult: 1, r: 5, home: c.role === 'heal' || a.id === 'nova' ? tgt : null, color: c.color, from: a, by: a, dk: 'ally' });
          else { addFx('slash', 0.16, { x: (cx(a) + cx(tgt)) / 2, y: (cy(a) + cy(tgt)) / 2 - 3, ang: Math.atan2(cy(tgt) - cy(a), cx(tgt) - cx(a)), color: c.color, size: 15 }); allyAttack(a, tgt, 1); }
        }
        continue;
      }
      allyStepTo(a, tgt.x, tgt.y); continue;
    }
    // 跟隨隊形
    const [ox, oy] = [[-1, 1], [1, 1], [0, 2]][a.i] || [0, 1];
    if (Math.hypot(a.x - (me.x + ox), a.y - (me.y + oy)) > 1.2) allyStepTo(a, me.x + ox, me.y + oy);
  }
  for (const m of mons) if (m.tauntT > 0) m.tauntT -= dt;
  renderPartyHp();
}
function renderPartyFrames() {
  $('party').replaceChildren(...allies.map((a) => {
    const d = document.createElement('div'); d.className = 'pmem'; d.dataset.id = a.id;
    d.innerHTML = `<span class="pname" style="color:${a.c.color}">${a.c.name}<small>${ROLE_NAME[a.c.role]}</small></span><div class="pbar"><i></i></div>`;
    return d;
  }));
  $('party').hidden = !allies.length;
}
function renderPartyHp() {
  for (const a of allies) {
    const el = $('party').querySelector(`[data-id="${a.id}"]`);
    if (!el) continue;
    el.querySelector('i').style.width = `${(a.hp / a.max) * 100}%`;
    el.classList.toggle('down', a.down > 0);
    el.querySelector('small').textContent = a.down > 0 ? `倒地 ${Math.ceil(a.down)}` : ROLE_NAME[a.c.role];
  }
}
function renderPartyPanel() {
  $('partyTactic').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.t === P.party.tactic));
  $('partyList').replaceChildren(...COMPANION_IDS.map((id) => {
    const c = COMPANIONS[id], hired = P.party.hired.includes(id), on = P.party.active.includes(id);
    const card = document.createElement('div'); card.className = `pcard${on ? ' on' : ''}`; card.style.setProperty('--c', c.color);
    const art = asset('npc/ally_' + id);
    card.append(art ? Object.assign(art.cloneNode(), { className: 'pimg' }) : previewCanvas(c.look, 2));
    card.insertAdjacentHTML('beforeend', `<div class="pinfo"><b>${c.name}</b> <span class="prole">${c.title}・${ROLE_NAME[c.role]}</span><p>${c.desc}</p><p class="muted">技能：${c.skill}</p></div>`);
    const b = document.createElement('button'); b.type = 'button';
    if (!hired) {
      const ok = unlocked(P, id);
      b.className = 'startbtn'; b.textContent = ok ? `招募 ${c.price} 金幣` : `第 ${c.unlock[0]} 章開放`; b.disabled = !ok;
      b.addEventListener('click', () => { const r = hire(P, id); if (!r.ok) feed(r.reason, '#ff8fa0'); else { feed(`${c.name} 加入了隊伍！`, c.color); banner(`${c.title}${c.name} 加入隊伍`); } buildAllies(); hud(); save(); renderPartyPanel(); });
    } else {
      b.className = on ? 'ghostbtn' : 'startbtn'; b.textContent = on ? '休息' : '出戰';
      b.disabled = !on && P.party.active.length >= PARTY_MAX;
      b.addEventListener('click', () => { toggleActive(P, id); buildAllies(); save(); renderPartyPanel(); });
    }
    card.append(b);
    return card;
  }));
  $('partyCount').textContent = `出戰 ${P.party.active.length}/${PARTY_MAX}`;
}
$('partyBtn').addEventListener('click', () => { if (!started) return; renderPartyPanel(); $('partyPanel').hidden = false; });
$('partyClose').addEventListener('click', () => { $('partyPanel').hidden = true; });
$('partyTactic').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { P.party.tactic = b.dataset.t; save(); renderPartyPanel(); }));

// ---------- 自動狩獵 ----------
const dirTo = (x, y) => (x > me.x ? 'right' : x < me.x ? 'left' : y > me.y ? 'down' : 'up');
let autoTarget = null;
function autoThink(dt) {
  autoHit = false; autoTarget = null;
  if (!auto || dialog || fishing || me.moving) return;
  const st = stats(P);
  const ok = (m) => m.dead <= 0 && !m.shield && !m.hidden && !m.d.decoy && (m.d.trial || (m.d.boss ? P.lv >= m.d.lv - 3 : m.d.lv <= P.lv + 2));
  const targets = mons.filter(ok);
  autoCastT -= dt;
  const near = targets.filter((m) => tdist(m, me.px, me.py) <= (C.range > 1 ? 4.5 : 2.2));
  if (near.length && autoCastT <= 0) {
    const i = [2, 1, 0].find((k) => skills[k].t <= 0 && (k !== 2 || near.length >= 2 || near.some((m) => m.d.boss)));
    if (i !== undefined) { if (C.range === 1) me.face = dirTo(near[0].x, near[0].y); castIdx(i); autoCastT = 0.45; }
  }
  if (C.range > 1) {
    const m = nearest(Math.min(4.5, C.range - 0.5));
    if (m && ok(m)) { autoHit = true; autoTarget = m; return; }
  } else {
    const adj = targets.find((m) => Math.abs(m.x - me.x) + Math.abs(m.y - me.y) === 1 || (m.d.boss && Math.max(Math.abs(m.x - me.x), Math.abs(m.y - me.y)) <= 1));
    if (adj) { me.face = dirTo(adj.x, adj.y); autoHit = true; return; }
  }
  const goal = new Set();
  const reach = C.range > 1 ? 3 : 1;
  for (const m of targets) for (let ox = -reach; ox <= reach; ox++) for (let oy = -reach; oy <= reach; oy++) if (Math.abs(ox) + Math.abs(oy) === (C.range > 1 ? Math.min(3, Math.abs(ox) + Math.abs(oy)) : 1) && (ox || oy)) goal.add(`${m.x + ox},${m.y + oy}`);
  const start = `${me.x},${me.y}`, prev = { [start]: null }, q = [[me.x, me.y]];
  let found = null;
  while (q.length && !found) {
    const [x, y] = q.shift();
    for (const [ddx, ddy] of Object.values(DIRS)) {
      const nx = x + ddx, ny = y + ddy, k = `${nx},${ny}`;
      if (k in prev || !walkable(grid, nx, ny) || (occupied(nx, ny) && !allies.some((al) => al.x === nx && al.y === ny))) continue;
      prev[k] = `${x},${y}`;
      if (goal.has(k)) { found = k; break; }
      q.push([nx, ny]);
    }
  }
  if (!found) return;
  let k = found;
  while (prev[k] !== start) k = prev[k];
  const [nx, ny] = k.split(',').map(Number);
  me.face = dirTo(nx, ny);
  const mate = allies.find((al) => al.x === nx && al.y === ny);
  if (mate) { if (mate.moving) return; Object.assign(mate, { fx: mate.x, fy: mate.y, x: me.x, y: me.y, moving: true, mt: 0 }); }
  Object.assign(me, { fx: me.x, fy: me.y, x: nx, y: ny, moving: true, mt: 0, dur: 0.14 });
}
function syncAuto() { $('autoBtn').classList.toggle('on', auto); $('autoBtn').innerHTML = auto ? '自動 <b>ON</b>' : '自動 <b>OFF</b>'; }
$('autoBtn').addEventListener('click', () => {
  if (!started) return;
  auto = !auto; syncAuto();
  if (auto && dialog) { dialog = null; showDialog(); }
  if (auto && P.ch === 1 && P.step === 0) { P.step = 1; P.kills = 0; feed('接到村長的任務：打倒 20 隻史萊姆', '#f6c945'); hud(); save(); }
});

// ---------- 釣魚 ----------
function reelIn() {
  if (fishing.state === 'bite') {
    const f = rollFish(R);
    P.fish[f.id] = (P.fish[f.id] || 0) + 1; questDone(track(P, 'fish'));
    feed(`釣到 <b>${f.name}</b>（可賣 ${f.price} 金幣）`, '#4fb3ff');
    burst(fishing.tx * TS + 8, fishing.ty * TS + 8, '#bdf1ff', 10);
    save();
  } else floatT('太早了…', me.x, me.y - 0.6, '#bdf1ff', 0.8);
  fishing = null;
}

// ---------- 輸入 ----------
function pressA() {
  if (!started) return;
  if (dialog) { advance(); return; }
  if (fishing) { reelIn(); return; }
  if (me.moving) { aHeld = true; return; }
  const [dx, dy] = DIRS[me.face];
  const tx = me.x + dx, ty = me.y + dy;
  const n = npcs.find((v) => v.x === tx && v.y === ty);
  if (n) { talk(n); return; }
  const t = grid[ty]?.[tx];
  const monHere = mons.some((m) => m.dead <= 0 && m.x === tx && m.y === ty);
  if (!monHere && t === T.SIGN) { say('告示牌', SIGN.text); return; }
  if (!monHere && t === T.WATER && !nearest(C.range > 1 ? C.range : 0)) { fishing = { tx, ty, state: 'wait', t: 1.2 + R() * 2 }; return; }
  if (!monHere && t === T.HOUSE) { const h = HOUSES.find((v) => tx >= v.x && tx <= v.x + 2 && ty >= v.y && ty <= v.y + 2); say(h ? h.name : '房子', ['門口的人就是店主，直接跟他說話吧。']); return; }
  aHeld = true;
}
function usePotion(quiet, which) {
  if (!started || dialog) return;
  const st = stats(P), max = st.hp;
  if (P.hp >= max) { if (!quiet) floatT('HP 已經是滿的', me.x, me.y - 0.6, '#a6ec7a', 0.8); return; }
  const id = which || pickPotion(P, 1 - P.hp / max);
  if (!id || !takeStack(P, id)) { if (!quiet) floatT('沒有藥水了', me.x, me.y - 0.6, '#ff8fb1', 0.8); return; }
  const heal = Math.round(max * ITEMS[id].heal * (st.potion / 0.5));
  P.hp = Math.min(max, P.hp + heal);
  floatT(`+${fmt(heal)}`, me.x, me.y, '#a6ec7a'); burst(cx(me), cy(me), ITEMS[id].color, 8);
  hud(); save();
}
function useItem(id) {
  const d = ITEMS[id];
  if (d.heal) { usePotion(false, id); return; }
  if (!count(P, id)) return;
  if (d.effect === 'home') { if (mapId === 0) { floatT('已經在村子裡了', me.x, me.y - 0.6, '#bdf1ff', 0.8); return; } takeStack(P, id); loadMap(0, { x: 11, y: 17 }); feed('使用回城卷軸，回到微光村', '#e8d29a'); }
  else if (d.effect === 'blink') {
    const spots = [];
    for (let y = 1; y < H - 1; y++) for (let x = FMIN; x < W - 1; x++) if (walkable(grid, x, y) && !occupied(x, y) && !inBoss(x, y) && grid[y][x] !== T.PORTAL) spots.push([x, y]);
    const [x, y] = spots[Math.floor(R() * spots.length)];
    takeStack(P, id); burst(cx(me), cy(me), '#bfe3ff', 14, 80);
    Object.assign(me, { x, y, px: x, py: y, fx: x, fy: y, moving: false }); soulPos.x = cx(me); soulPos.y = cy(me);
    burst(cx(me), cy(me), '#bfe3ff', 14, 80);
  } else if (d.effect === 'soul') { if (!P.soul) return; takeStack(P, id); soulPower = Math.min(100, soulPower + 50); floatT('魂力 +50%', me.x, me.y - 0.6, '#c084ff', 0.9); }
  hud(); save();
}
function bindHold(el, down, up) {
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture?.(e.pointerId); el.classList.add('down'); down(); });
  const end = () => { el.classList.remove('down'); up?.(); };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
}
// 虛擬搖桿：拖曳方向決定移動，放開就停
const stick = $('stick'), knob = $('knob');
let stickId = null;
function stickMove(e) {
  const r = stick.getBoundingClientRect();
  const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const max = r.width * 0.36, d = Math.hypot(dx, dy), k = d > max ? max / d : 1;
  knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  held = d < r.width * 0.12 ? null : Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
}
stick.addEventListener('pointerdown', (e) => { e.preventDefault(); stickId = e.pointerId; stick.setPointerCapture?.(e.pointerId); stick.classList.add('on'); stickMove(e); });
stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) stickMove(e); });
const stickEnd = (e) => { if (e.pointerId !== stickId) return; stickId = null; held = null; knob.style.transform = ''; stick.classList.remove('on'); };
stick.addEventListener('pointerup', stickEnd); stick.addEventListener('pointercancel', stickEnd); stick.addEventListener('lostpointercapture', stickEnd);
bindHold($('aBtn'), pressA, () => { aHeld = false; });
bindHold($('bBtn'), usePotion);
[0, 1, 2].forEach((i) => bindHold($(`sk${i}Btn`), () => castIdx(i)));
bindHold($('dodgeBtn'), dodge);
bindHold($('soulBtn'), castUlt);
const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (KEYS[e.code]) { held = KEYS[e.code]; e.preventDefault(); return; }
  if (e.repeat) return;
  if (['Space', 'Enter', 'KeyJ'].includes(e.code)) { e.preventDefault(); if (started) pressA(); }
  else if (e.code === 'KeyQ') castIdx(0);
  else if (e.code === 'KeyE') castIdx(1);
  else if (e.code === 'KeyF') castIdx(2);
  else if (e.code === 'KeyX') usePotion();
  else if (e.code === 'KeyC' || e.code === 'ShiftLeft') dodge();
  else if (e.code === 'KeyV') castUlt();
  else if (e.code === 'KeyR') $('autoBtn').click();
});
addEventListener('keyup', (e) => {
  if (KEYS[e.code] === held) held = null;
  if (['Space', 'Enter', 'KeyJ'].includes(e.code)) aHeld = false;
});
document.addEventListener('contextmenu', (e) => { if (e.target.closest('.pad')) e.preventDefault(); });

const SIZES = [['中', 17], ['大', 20], ['特大', 24]];
let fsIdx = 1;
try { const raw = localStorage.getItem('glimmer-fs'); if (raw !== null && SIZES[+raw]) fsIdx = +raw; } catch { /* 忽略 */ }
const fsK = () => SIZES[fsIdx][1] / 20;
function applyFs() { document.documentElement.style.setProperty('--fs', `${SIZES[fsIdx][1]}px`); $('fontBtn').textContent = `字 ${SIZES[fsIdx][0]}`; }
$('fontBtn').addEventListener('click', () => { fsIdx = (fsIdx + 1) % SIZES.length; applyFs(); try { localStorage.setItem('glimmer-fs', fsIdx); } catch { /* 忽略 */ } });
applyFs();

// ---------- 更新 ----------
function step(o, dur, dt) {
  o.mt += dt / dur;
  if (o.mt >= 1) { o.moving = false; o.px = o.x; o.py = o.y; return true; }
  o.px = o.fx + (o.x - o.fx) * o.mt; o.py = o.fy + (o.y - o.fy) * o.mt; return false;
}
function update(dt) {
  anim += dt;
  if (started) { metaT -= dt; if (metaT <= 0) { metaT = 30; if (refresh(P)) { feed('新的一天！每日任務已更新，到「冒險」查看', '#f6c945'); hud(); } } }
  if (trial && !trial.done && !dialog) {
    const before = Math.ceil(trial.t); trial.t -= dt;
    if (Math.ceil(trial.t) !== before) $('quest').textContent = questText();
    if (trial.t <= 0) { const f = trial.f; trial.done = true; auto = false; syncAuto(); say('試煉之塔', [`時間到！第 ${f} 層挑戰失敗。`, '提升戰力、換個打法，再來挑戰吧。'], [[`再挑戰第 ${f} 層`, () => startTower(f)], ['回到村子', () => { loadMap(0, { x: 11, y: 17 }); hud(); }]]); }
  }
  if (me.moving && step(me, me.dur, dt)) { me.step ^= 1; me.dur = 0.14; if (grid[me.y]?.[me.x] === T.PORTAL && mapId !== 0) { loadMap(0, { x: 11, y: 17 }); feed('回到微光村', '#c084ff'); save(); return; } }
  if (held && auto) { auto = false; syncAuto(); }
  invertT = Math.max(0, invertT - dt);
  if (!me.moving && started && held && !dialog && !fishing) {
    const dir = invertT > 0 ? ({ left: 'right', right: 'left' }[held] || held) : held;
    const [dx, dy] = DIRS[dir];
    me.face = dir;
    const nx = me.x + dx, ny = me.y + dy;
    const mate = allies.find((a) => a.x === nx && a.y === ny && !a.moving);
    if (mate && walkable(grid, nx, ny)) { Object.assign(mate, { fx: mate.x, fy: mate.y, x: me.x, y: me.y, moving: true, mt: 0 }); Object.assign(me, { fx: me.x, fy: me.y, x: nx, y: ny, moving: true, mt: 0, dur: 0.14 }); }
    else if (walkable(grid, nx, ny) && !occupied(nx, ny)) Object.assign(me, { fx: me.x, fy: me.y, x: nx, y: ny, moving: true, mt: 0, dur: 0.14 });
  }
  if (started && !held) autoThink(dt);
  me.atkT = Math.max(0, me.atkT - dt); me.hurtT = Math.max(0, me.hurtT - dt); me.cool = Math.max(0, me.cool - dt);
  me.inv = Math.max(0, me.inv - dt); me.dodgeT = Math.max(0, me.dodgeT - dt); catT = Math.max(0, catT - dt);
  updateWarns(dt);
  { const fx2 = { up: 10, down: -12, left: 12, right: -12 }[me.face]; const tx = cx(me) + fx2, ty = cy(me) - 14 + Math.sin(anim * 3) * 2; soulPos.x += (tx - soulPos.x) * Math.min(1, dt * 6); soulPos.y += (ty - soulPos.y) * Math.min(1, dt * 6); }
  const ranged = C.range > 1;
  if ((aHeld || autoHit) && me.cool <= 0 && !dialog && !fishing && (ranged || !me.moving) && started) basicAttack(autoTarget);
  for (const s of skills) s.t = Math.max(0, s.t - dt);
  shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt); tintT = Math.max(0, tintT - dt);
  comboT -= dt;
  if (comboT <= 0 && combo) { combo = 0; $('combo').hidden = true; }
  regenT += dt;
  if (regenT > 1) { regenT = 0; const st = stats(P), max = st.hp; if (P.hp < max) { P.hp = Math.min(max, P.hp + (inSafe() ? Math.ceil(max * 0.08) : 1 + Math.round(max * st.regen))); hud(); } }
  pending = pending.filter((p) => { p.t -= dt; if (p.t <= 0) { p.fn(); return false; } return true; });
  updateProjs(dt);
  updateAllies(dt);
  for (const m of mons) {
    m.anim += dt;
    if (m.dead > 0) { if (m.minion || m.d.decoy || m.d.trial) continue; m.dead -= dt; if (m.dead <= 0) placeMon(m); continue; }
    if (m.d.elite === 'regen' && m.hp < m.d.hp) m.hp = Math.min(m.d.hp, m.hp + m.d.hp * 0.025 * dt);
    if (m.letter > 0) m.letter -= dt;
    if (m.d.boss && started && !dialog) bossThink(m, dt);
    m.flash = Math.max(0, m.flash - dt); m.cool -= dt; m.spawnT = Math.max(0, m.spawnT - dt); m.frozen = Math.max(0, m.frozen - dt);
    m.kx *= 0.8; m.ky *= 0.8;
    if (m.moving) { step(m, m.d.boss ? 0.5 : 0.35, dt); continue; }
    if (!started || dialog || m.frozen > 0 || m.d.still || m.hidden) continue;
    const tg = monTarget(m);
    const dx = tg.x - m.x, dy = tg.y - m.y, dist = Math.abs(dx) + Math.abs(dy);
    if (m.d.atk > 0 && (dist === 1 || (m.d.boss && Math.max(Math.abs(dx), Math.abs(dy)) <= 1)) && m.cool <= 0) { if (tg === me) hitPlayer(m); else allyHurt(tg, m.d.atk); m.cool = m.d.boss ? 1.2 : 1.5; continue; }
    m.think -= dt;
    if (m.think > 0) continue;
    const chase = dist <= m.d.sight && dist > 1;
    m.think = (chase ? 0.4 : 1 + R() * 1.6) * (m.d.boss ? 1.4 : 1);
    let opts = [];
    if (chase) {
      const a = Math.abs(dx) > Math.abs(dy) ? [[Math.sign(dx), 0], [0, Math.sign(dy)]] : [[0, Math.sign(dy)], [Math.sign(dx), 0]];
      opts = a.filter(([x, y]) => x || y);
    } else if (R() < 0.6) opts = [Object.values(DIRS)[Math.floor(R() * 4)]];
    for (const [ox, oy] of opts) if (monCanGo(m, m.x + ox, m.y + oy)) { Object.assign(m, { fx: m.x, fy: m.y, x: m.x + ox, y: m.y + oy, moving: true, mt: 0 }); break; }
  }
  if (fishing) {
    fishing.t -= dt;
    if (fishing.state === 'wait' && fishing.t <= 0) { fishing.state = 'bite'; fishing.t = 0.9; }
    else if (fishing.state === 'bite' && fishing.t <= 0) { fishing = null; floatT('魚跑掉了', me.x, me.y - 0.6, '#bdf1ff', 0.8); }
  }
  const px = cx(me), py = cy(me);
  drops = drops.filter((d) => {
    d.t += dt;
    const lift = P.soul === 'magnet' ? 0.5 : DROP_LIFT;
    if (d.t < lift) { d.x += d.vx * dt; d.y += d.vy * dt; d.vz -= 320 * dt; d.z = Math.max(0, d.z + d.vz * dt); if (d.z === 0) d.vz = Math.abs(d.vz) * 0.4; return true; }
    const ax = px - d.x, ay = py - d.y, dist = Math.hypot(ax, ay);
    if (dist < 6 || d.t > 3) { collect(d); return false; }
    const sp = 80 + (d.t - lift) * 400;
    d.x += (ax / dist) * sp * dt; d.y += (ay / dist) * sp * dt; d.z = Math.max(0, d.z - dt * 30);
    return true;
  });
  const wr = P.gear.weapon?.refine || 0;
  if (wr >= 7 && R() < 0.15 + (wr - 7) * 0.1) parts.push({ x: px + (me.face === 'left' ? -8 : 8) + (R() - 0.5) * 6, y: py - 4 + (R() - 0.5) * 10, vx: 0, vy: -15, c: wr >= 10 ? '#ff6b8a' : '#fff1a8', t: 0, g: 0, size: 1, life: 0.5 });
  // 傳說光環
  if (myLook?.aura) { auraT -= dt; if (auraT <= 0) { auraT = 0.08; parts.push({ x: px + (R() - 0.5) * 18, y: py + 6, vx: 0, vy: -25 - R() * 20, c: R() < 0.5 ? '#ffd75e' : '#fff3c4', t: 0, g: 0, size: 1, life: 0.7 }); } }
  mons = mons.filter((m) => !(m.minion && m.dead > 0));
  floats = floats.filter((f) => (f.t += dt) < 0.9);
  parts = parts.filter((p) => { p.t += dt; if (p.t < 0) return true; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g ?? 240) * dt; return p.t < (p.life ?? 0.6); });
  fx = fx.filter((f) => (f.t += dt) < f.life);
  saveT += dt;
  if (saveT > 5 && started) { saveT = 0; save(); }
  const boss = mons.find((m) => m.d.boss);
  const showBoss = boss && boss.dead <= 0 && (boss.hidden || Math.abs(boss.x - me.x) + Math.abs(boss.y - me.y) <= 7) && boss.engaged;
  $('bossBar').hidden = !showBoss;
  if (showBoss) { $('bossFill').style.width = `${Math.max(0, boss.hp / boss.d.hp) * 100}%`; $('bossName').textContent = boss.d.name + (boss.d.mech === 'steal' && boss.stolen.size ? `（已偷走：${[...boss.stolen].map((k) => SOULS[k].name).join('、')}）` : '') + (invertT > 0 ? '　⇄ 左右顛倒中' : ''); }
}
function updateSkillUi() {
  const sb = $('soulBtn');
  sb.hidden = !P.soul;
  if (P.soul) {
    sb.style.setProperty('--fill', `${soulPower}%`); sb.style.setProperty('--sc', SOULS[P.soul].color);
    sb.classList.toggle('ready', soulPower >= 100);
    if (sb.dataset.id !== P.soul) { sb.dataset.id = P.soul; sb.querySelector('i').replaceChildren(soulBig(P.soul, 2)); }
  }
  const db = $('dodgeBtn');
  db.style.setProperty('--p', `${(me.dodgeT / 3) * 360}deg`); db.classList.toggle('ready', me.dodgeT <= 0);
  skills.forEach((s, i) => {
    const el = $(`sk${i}Btn`);
    el.style.setProperty('--p', `${(s.t / s.cd) * 360}deg`);
    el.querySelector('em').textContent = s.t > 0 ? Math.ceil(s.t) : '';
    el.classList.toggle('ready', s.t <= 0);
  });
}

// ---------- 繪製 ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function render() {
  ctx.setTransform(S, 0, 0, S, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0b0816'; ctx.fillRect(0, 0, VW, VH);
  let camX = W * TS <= VW ? Math.round((W * TS - VW) / 2) : clamp(Math.round(cx(me) - VW / 2), 0, W * TS - VW);
  let camY = H * TS <= VH ? Math.round((H * TS - VH) / 2) : clamp(Math.round(cy(me) - 4 - VH / 2), 0, H * TS - VH);
  if (shake > 0) { const s = Math.min(4, shake * 14); camX += Math.round((R() - 0.5) * s); camY += Math.round((R() - 0.5) * s); }
  ctx.imageSmoothingEnabled = mapC.width > W * TS; ctx.drawImage(mapC, -camX, -camY, W * TS, H * TS); ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = 'rgba(255,255,255,.45)';
  const tx0 = Math.floor(camX / TS), ty0 = Math.floor(camY / TS);
  for (let ty = ty0; ty <= ty0 + Math.ceil(VH / TS) + 1; ty++) for (let tx = tx0; tx <= tx0 + Math.ceil(VW / TS) + 1; tx++) {
    if (grid[ty]?.[tx] !== T.WATER && grid[ty]?.[tx] !== T.FOUNTAIN) continue;
    const ph = (anim * 1.3 + tx * 0.37 + ty * 0.61) % 3;
    if (ph < 1) ctx.fillRect(tx * TS - camX + 3 + Math.floor(ph * 8), ty * TS - camY + 4 + ((tx + ty) % 3) * 4, 3, 1);
  }
  ctx.save(); ctx.translate(-camX, -camY);
  for (const f of fx) if (f.kind === 'crack' || f.kind === 'target') drawFx(f);
  for (const w of warns) {
    if (w.t < 0 || w.fired) continue;
    const k = Math.min(1, w.t / w.life), X = w.x * TS + 8, Y = w.y * TS + 10;
    ctx.fillStyle = w.kind === 'slam' ? 'rgba(255,60,80,.22)' : 'rgba(140,220,90,.22)'; ctx.beginPath(); ctx.ellipse(X, Y, w.r * 16, w.r * 11, 0, 0, 7); ctx.fill();
    ctx.fillStyle = w.kind === 'slam' ? 'rgba(255,60,80,.45)' : 'rgba(140,220,90,.45)'; ctx.beginPath(); ctx.ellipse(X, Y, w.r * 16 * k, w.r * 11 * k, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = w.kind === 'slam' ? '#ff5a6e' : '#7ad35a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(X, Y, w.r * 16, w.r * 11, 0, 0, 7); ctx.stroke();
  }
  for (const d of drops) {
    const x = Math.round(d.x), y = Math.round(d.y - d.z);
    if (d.kind === 'gear') {
      const r = rarityOf(d.val.rarity);
      if (['rare', 'epic', 'legend'].includes(r.id)) { ctx.globalAlpha = 0.35 + Math.sin(anim * 10) * 0.1; ctx.fillStyle = r.color; ctx.fillRect(x - 2, y - 40, 4, 40); ctx.globalAlpha = 1; }
      ctx.drawImage(gearIconHD(d.val), x - 6, y - 8, 12, 12);
    } else if (d.kind === 'loot') {
      const it = ITEMS[d.val.id];
      if (it.kind === 'card') { ctx.globalAlpha = 0.4 + Math.sin(anim * 12) * 0.15; ctx.fillStyle = '#ffb03b'; ctx.fillRect(x - 3, y - 48, 6, 48); ctx.globalAlpha = 1; }
      ctx.imageSmoothingEnabled = !!asset('icon/' + d.val.id); ctx.drawImage(itemIcon(d.val.id), x - 5, y - 7, 10, 10); ctx.imageSmoothingEnabled = false;
    } else ctx.drawImage(coinS, x - 3, y - 3);
  }
  const ents = [
    ...npcs.map((n) => ({ y: n.y, f: () => drawNpc(n, n.x * TS, n.y * TS - (Math.floor(anim * 1.6 + n.seed) % 2)) })),
    ...alive().map((m) => ({ y: m.py, f: () => drawMon(m) })),
    { y: me.py + 0.01, f: drawMe },
    ...allies.map((a) => ({ y: a.py + 0.005, f: () => drawAlly(a) })),
    ...(P.soul && started ? [{ y: (soulPos.y + 14 - 8) / TS + 0.02, f: () => { ctx.globalAlpha = 0.9; const sh = asset('soul/' + P.soul); if (sh) { ctx.imageSmoothingEnabled = true; ctx.drawImage(sh, soulPos.x - 14, soulPos.y - 26 + Math.sin(anim * 3), 28, 28); ctx.imageSmoothingEnabled = false; } else ctx.drawImage(soulSprite(P.soul, Math.floor(anim * 2) % 2), Math.round(soulPos.x - 12), Math.round(soulPos.y - 22)); ctx.globalAlpha = 1; } }] : []),
  ].sort((a, b) => a.y - b.y);
  ents.forEach((e) => e.f());
  for (const p of projs) drawProj(p);
  for (const f of fx) if (f.kind !== 'crack' && f.kind !== 'target') drawFx(f);
  if (fishing) {
    const bx = fishing.tx * TS + 6, by = fishing.ty * TS + 6 + (fishing.state === 'bite' ? Math.round(Math.sin(anim * 30)) : Math.round(Math.sin(anim * 3)));
    ctx.strokeStyle = 'rgba(255,248,231,.7)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(Math.round(cx(me)) + 4, Math.round(me.py * TS) - 4); ctx.lineTo(bx + 2, by); ctx.stroke();
    ctx.drawImage(bobberS, bx, by);
    if (fishing.state === 'bite') ctx.drawImage(bangS, Math.round(me.px * TS) + 6, Math.round(me.py * TS) - 26);
  }
  for (const p of parts) {
    if (p.t < 0) continue;
    if (p.heart) ctx.drawImage(heartS, Math.round(p.x), Math.round(p.y));
    else { ctx.globalAlpha = Math.min(1, 1.4 - p.t / (p.life ?? 0.6)); ctx.fillStyle = p.c; const s = p.size ?? 2; ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s); }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  if (flash > 0) { ctx.fillStyle = `rgba(255,248,231,${Math.min(0.6, flash * 3)})`; ctx.fillRect(0, 0, VW, VH); }
  if (tintT > 0) { ctx.globalAlpha = Math.min(0.22, tintT * 1.6); ctx.fillStyle = tintC; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
  // 高解析度文字層：名字、傷害數字
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const label = (text, wx, wy, color, size) => {
    ctx.font = `${size * DPR * fsK()}px Huninn, "PingFang TC", sans-serif`;
    ctx.lineWidth = 3 * DPR; ctx.strokeStyle = '#1b1420'; ctx.strokeText(text, (wx - camX) * S, (wy - camY) * S);
    ctx.fillStyle = color; ctx.fillText(text, (wx - camX) * S, (wy - camY) * S);
  };
  if (started) { label(P.name, cx(me), me.py * TS - 20, C.color, 12); if (P.meta?.title) label(`【${P.meta.title}】`, cx(me), me.py * TS - 29, '#ffd166', 9); }
  for (const m of mons) if (m.d.elite && m.dead <= 0 && !m.hidden) label(`精英・${m.d.name}`, cx(m), m.py * TS - 14, ELITE_AFFIX[m.d.elite].color, 9);
  for (const a of allies) label(a.down > 0 ? `${a.c.name}（倒地）` : a.c.name, cx(a), a.py * TS - 20, a.c.color, 10.5);
  for (const d of drops) {
    if (d.kind === 'coin' || d.t > DROP_LIFT) continue;
    const nm = d.kind === 'gear' ? `${d.val.name}${d.val.slots ? `[${d.val.slots}]` : ''}` : ITEMS[d.val.id].name;
    const col = d.kind === 'gear' ? rarityOf(d.val.rarity).color : GRADES.find((g) => g.id === ITEMS[d.val.id].grade).color;
    label(nm, d.x, d.y - d.z - 12, col, 9);
  }
  for (const m of alive()) {
    if (m.d.mech === 'echo' && lastSkill) label(`回音記得：${skills.find((k) => k.id === lastSkill)?.name || ''}`, cx(m), m.py * TS - 24, '#d4b8ff', 11);
    if (m.d.mech === 'rewind' && m.engaged && m.rwT <= 3) label(`倒轉 ${Math.ceil(m.rwT)}`, cx(m), m.py * TS - 24, '#f6d77a', 14);
    if (m.d.decoy) label('？', cx(m), m.py * TS - 22, '#fff8e7', 12);
  }
  for (const n of npcs) if (Math.abs(n.x - me.px) < VW / TS && Math.abs(n.y - me.py) < VH / TS) label(n.name.split('・')[1], n.x * TS + 8, n.y * TS - 20, '#fff8e7', 11);
  for (const f of floats) {
    const pop = 1 + Math.max(0, 0.12 - f.t) * 5;
    const x = (f.x - camX) * S, y = (f.y - camY - f.t * 18) * S;
    ctx.globalAlpha = f.t > 0.65 ? (0.9 - f.t) / 0.25 : 1;
    ctx.font = `${Math.round(18 * DPR * fsK() * f.size * pop)}px Silkscreen, Huninn, monospace`;
    ctx.lineWidth = 4.5 * DPR; ctx.strokeStyle = '#2a1d2e'; ctx.strokeText(f.text, x, y);
    ctx.fillStyle = f.color; ctx.fillText(f.text, x, y);
  }
  ctx.globalAlpha = 1;
}
function shadow(x, y, w = 12) { ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(x + 8 - w / 2, y + 14, w, 2); ctx.fillRect(x + 9 - w / 2, y + 16, w - 2, 1); }
function drawNpc(n, x, y) {
  const hd = asset('npc/' + (n.id === 'guide' ? 'guide' + n.ch : n.id));
  if (!hd) { drawPerson(avatar(n.L, n.face, 0), x, y); return; }
  shadow(x, y);
  const p = pixelize(hd, PX_CHAR);
  ctx.drawImage(p, Math.round(x) + 8 - Math.round(p.width / 2), Math.round(y) + 17 - p.height);
}
function drawPerson(img, x, y) {
  shadow(x, y);
  if (img.width > AW) { const p = pixelize(img, PX_CHAR); ctx.drawImage(p, Math.round(x) + 8 - Math.round(p.width / 2), Math.round(y) + 17 - p.height); return; }
  ctx.drawImage(img, Math.round(x) - 4, Math.round(y) - 17, AW, AH);
}
const animFrame = (o, dur = 0.18) => o.atkT > 0 ? 'a' + Math.min(3, Math.floor((1 - o.atkT / dur) * 4)) : o.moving ? 'w' + ((o.step * 2 + (o.mt > 0.5 ? 1 : 0)) % 4) : 'i' + (Math.floor(anim * 1.5 + (o.i || 0)) % 2);
// 主角整張立繪：hero/{職業}_{裝備等級}_{front|back|side}，裝備等級取身體防具；可選 _attack 攻擊姿勢
function heroImg(L, dir, attack) {
  if (!L?.cls) return null;
  const view = dir === 'up' ? 'back' : dir === 'left' || dir === 'right' ? 'side' : 'front';
  const tier = TIER[Math.max(0, L.armorTier ?? 0)];
  const base = `hero/${L.cls}_${tier}_${view}`;
  return (attack && asset(base + '_attack')) || asset(base) || asset(`hero/${L.cls}_common_${view}`);
}
function drawIllus(img, o, frameStr) {
  const x = Math.round(o.px * TS), y = Math.round(o.py * TS);
  shadow(x, y);
  const flip = o.face === 'left' ? -1 : 1;
  const walk = o.moving ? Math.abs(Math.sin((o.mt + o.step) * Math.PI)) : 0;
  const atk = o.atkT > 0 ? Math.sin((1 - o.atkT / (o.atkDur || 0.18)) * Math.PI) : 0;
  const [dx, dy] = DIRS[o.face] || [0, 1];
  const p = pixelize(img, PX_CHAR);
  const ox = Math.round(dx * atk * 4), oy = Math.round(dy * atk * 3 - walk * 2) - (!o.moving && !o.atkT && Math.floor(anim * 1.5 + (o.i || 0)) % 2 ? 1 : 0);
  ctx.save();
  ctx.translate(x + 8 + ox, y + 17 + oy);
  if (flip < 0) ctx.scale(-1, 1);
  ctx.imageSmoothingEnabled = false; ctx.drawImage(p, -Math.round(p.width / 2), -p.height);
  ctx.restore();
}
// 原生像素動畫圖：432×144，3 列（front/back/side）× 9 欄（待機、走 1～4、攻 1～4）
const pxFeet = new WeakMap();
function pxHero(L) {
  if (!L?.cls) return null;
  return asset(`px/hero/${L.cls}_${TIER[Math.max(0, L.armorTier ?? 0)]}`) || asset(`px/hero/${L.cls}_common`);
}
function feetOf(img) {
  if (pxFeet.has(img)) return pxFeet.get(img);
  const c = document.createElement('canvas'); c.width = 48; c.height = 48; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 48, 48, 0, 0, 48, 48);
  const d = x.getImageData(0, 0, 48, 48).data; let f = 44;
  for (let y = 47; y >= 0; y--) { let hit = false; for (let i = 0; i < 48; i++) if (d[(y * 48 + i) * 4 + 3] > 0) { hit = true; break; } if (hit) { f = y + 1; break; } }
  pxFeet.set(img, f); return f;
}
function drawPxHero(sheet, o) {
  const x = Math.round(o.px * TS), y = Math.round(o.py * TS);
  shadow(x, y);
  const row = o.face === 'up' ? 1 : o.face === 'left' || o.face === 'right' ? 2 : 0;
  const dur = o.atkDur || 0.18;
  const col = o.atkT > 0 ? 5 + Math.min(3, Math.floor((1 - o.atkT / dur) * 4)) : o.moving ? 1 + ((o.step * 2 + (o.mt > 0.5 ? 1 : 0)) % 4) : 0;
  const lunge = o.atkT > 0 ? Math.sin((1 - o.atkT / dur) * Math.PI) : 0, [dx, dy] = DIRS[o.face] || [0, 1];
  ctx.save();
  ctx.translate(x + 8 + Math.round(dx * lunge * 3), y + 17 + Math.round(dy * lunge * 2));
  if (o.face === 'left') ctx.scale(-1, 1);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheet, col * 48, row * 48, 48, 48, -24, -feetOf(sheet), 48, 48);
  ctx.restore();
}
function drawMe() {
  const x = Math.round(me.px * TS), y = Math.round(me.py * TS);
  const frame = animFrame(me, me.atkDur || 0.18);
  const sheet = pxHero(myLook);
  if (sheet) { if (me.hurtT > 0 && Math.floor(me.hurtT * 20) % 2) { shadow(x, y); return; } if (me.inv > 0) ctx.globalAlpha = 0.6; drawPxHero(sheet, me); ctx.globalAlpha = 1; return; }
  const hero = heroImg(myLook, me.face, me.atkT > 0);
  if (hero && !(me.hurtT > 0 && Math.floor(me.hurtT * 20) % 2)) { if (me.inv > 0) ctx.globalAlpha = 0.6; drawIllus(hero, me); ctx.globalAlpha = 1; return; }
  if (me.hurtT > 0 && Math.floor(me.hurtT * 20) % 2) { shadow(x, y); return; }
  if (me.inv > 0) ctx.globalAlpha = 0.6;
  if (myLook?.aura) { ctx.globalAlpha = 0.25 + Math.sin(anim * 4) * 0.08; ctx.fillStyle = '#ffd75e'; ctx.beginPath(); ctx.ellipse(x + 8, y + 15, 12, 4, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  let lx = 0, ly = 0;
  if (me.atkT > 0) { const [dx, dy] = DIRS[me.face], k = Math.sin((me.atkT / 0.18) * Math.PI), d = C.range > 1 ? -1.2 : 3; lx = Math.round(dx * k * d); ly = Math.round(dy * k * d); }
  drawPerson(avatar(myLook, me.face, frame), x + lx, y + ly);
  ctx.globalAlpha = 1;
}
function drawAlly(a) {
  const x = Math.round(a.px * TS), y = Math.round(a.py * TS);
  if (a.down > 0) { ctx.globalAlpha = 0.45; ctx.save(); ctx.translate(x + 8, y + 12); ctx.rotate(Math.PI / 2); ctx.drawImage(avatar(a.c.look, 'down', 0), -12, -16, AW, AH); ctx.restore(); ctx.globalAlpha = 1; return; }
  if (a.hurtT > 0 && Math.floor(a.hurtT * 20) % 2) { shadow(x, y); return; }
  const frame = animFrame(a, a.atkDur || 0.18);
  const hd = asset('npc/ally_' + a.id);
  if (hd) { drawIllus(hd, a); }
  else if (false) {
    const flip = a.face === 'left' ? -1 : 1;
    const walk = a.moving ? Math.abs(Math.sin((a.mt + a.step) * Math.PI)) : 0;
    const atk = a.atkT > 0 ? Math.sin((1 - a.atkT / (a.atkDur || 0.18)) * Math.PI) : 0;
    const [dx, dy] = DIRS[a.face] || [0, 1];
    ctx.save();
    ctx.translate(x + 8 + dx * atk * 4, y + 16 + dy * atk * 3 - walk * 2.5);
    ctx.rotate((a.moving ? Math.sin((a.mt + a.step) * Math.PI) * 0.06 : 0) + atk * 0.18 * (dx || 1) * flip);
    ctx.scale(flip * (1 + atk * 0.06), 1 + (a.moving ? 0 : Math.sin(anim * 3 + a.i) * 0.015) - atk * 0.04);
    ctx.imageSmoothingEnabled = true; ctx.drawImage(hd, -14, -36, 28, 37); ctx.imageSmoothingEnabled = false;
    ctx.restore();
  }
  else drawPerson(avatar(a.c.look, a.face, frame), x, y);
  ctx.fillStyle = '#1b1420'; ctx.fillRect(x + 1, y + 17, 14, 3); ctx.fillStyle = a.c.role === 'heal' ? '#7ad35a' : '#e8506a'; ctx.fillRect(x + 2, y + 18, Math.max(1, Math.round((a.hp / a.max) * 12)), 1);
}
function drawMon(m) {
  const x = Math.round(m.px * TS + m.kx), y = Math.round(m.py * TS + m.ky);
  if (m.d.decoy) { if (!m.real) shadow(x, y); const im = asset('npc/' + m.npcId); if (im) { const p = pixelize(im, PX_CHAR); ctx.drawImage(p, x + 8 - Math.round(p.width / 2), y + 17 - p.height); } else ctx.drawImage(avatar(m.look, 'down', 0), x - 4, y - 17, AW, AH); return; }
  const hd = asset('monster/' + (m.d.tpl === 'mirror' ? 'mirror_obj' : m.type));
  if (hd) {
    const big = m.d.boss, size = big ? 52 : 26, bob = m.frozen > 0 ? 0 : Math.round(Math.sin(m.anim * 5) * (big ? 1.5 : 1));
    shadow(x, y, big ? 24 : 13);
    const p = pixelize(hd, big ? PX_BOSS : PX_MON);
    if (m.d.elite) { ctx.globalAlpha = 0.35 + Math.sin(anim * 6) * 0.15; ctx.fillStyle = ELITE_AFFIX[m.d.elite].color; ctx.beginPath(); ctx.ellipse(x + 8, y + 15, 13, 5, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    const draw = () => ctx.drawImage(p, x + 8 - Math.round(p.width / 2), y + 17 - p.height + bob);
    draw();
    if (m.flash > 0) { ctx.globalCompositeOperation = 'lighter'; draw(); ctx.globalCompositeOperation = 'source-over'; }
    if (m.frozen > 0) { ctx.fillStyle = 'rgba(150,220,255,.4)'; ctx.fillRect(x + 8 - size / 2, y + 16 - size * 0.85, size, size * 0.8); }
    if (m.shield) { ctx.strokeStyle = 'rgba(189,241,255,.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x + 8, y + 16 - size / 2, size * 0.6, 0, 7); ctx.stroke(); }
    if (m.hp < m.d.hp && !big) { ctx.fillStyle = '#2a1d2e'; ctx.fillRect(x + 1, y + 17, 14, 4); ctx.fillStyle = '#e8506a'; ctx.fillRect(x + 2, y + 18, Math.max(1, Math.round((m.hp / m.d.hp) * 12)), 2); }
    return;
  }
  const spr = monsterSprite(m.d.tpl, m.d.pal)[m.frozen > 0 ? 0 : Math.floor(m.anim * 2.4) % 2];
  const big = m.d.boss;
  shadow(x, y, big ? 22 : 12);
  const sc = m.spawnT > 0 ? 1 - m.spawnT * 2 : 1;
  const draw = () => {
    if (big) { ctx.drawImage(spr, x - 8, y - 16, 32, 32); if (m.type === 'king' || m.type === 'valde') ctx.drawImage(crownS, x, y - 14 + (Math.floor(m.anim * 2.4) % 2) * 2); }
    else if (sc < 1) { const s = Math.max(0.1, sc) * 16; ctx.drawImage(spr, x + 8 - s / 2, y + 16 - s, s, s); }
    else ctx.drawImage(spr, x, y);
  };
  draw();
  if (m.flash > 0) { ctx.globalCompositeOperation = 'lighter'; draw(); draw(); ctx.globalCompositeOperation = 'source-over'; }
  if (m.frozen > 0) {
    const s = big ? 30 : 14, ox = big ? x - 7 : x + 1, oy = big ? y - 12 : y + 3;
    ctx.fillStyle = 'rgba(150,220,255,.45)'; ctx.fillRect(ox, oy, s, s - 2);
    ctx.strokeStyle = '#e6f8ff'; ctx.lineWidth = 1; ctx.strokeRect(ox + 0.5, oy + 0.5, s - 1, s - 3);
    ctx.fillStyle = '#fff'; ctx.fillRect(ox + 2, oy + 2, 2, 1);
  }
  if (m.shield) { ctx.strokeStyle = 'rgba(189,241,255,.9)'; ctx.lineWidth = 1.5; ctx.fillStyle = 'rgba(189,241,255,.18)'; ctx.beginPath(); ctx.arc(x + 8, y + 2, 22 + Math.sin(anim * 6), 0, 7); ctx.fill(); ctx.stroke(); }
  if (m.letter > 0) { const ly = y - (big ? 22 : 8) - Math.sin(anim * 8) * 1.5; ctx.fillStyle = '#241a2b'; ctx.fillRect(x + 3, ly - 1, 11, 9); ctx.fillStyle = '#fff8e7'; ctx.fillRect(x + 4, ly, 9, 7); ctx.fillStyle = '#e0533d'; ctx.fillRect(x + 7, ly + 2, 3, 3); }
  if (m.minion && m.d === MINION) { ctx.drawImage(crownS, x, y - 2, 16, 6); }
  if (m.hp < m.d.hp && !big) {
    const w = 12, bx = x + 2, by = y + 2;
    ctx.fillStyle = '#2a1d2e'; ctx.fillRect(bx - 1, by - 1, w + 2, 4);
    ctx.fillStyle = '#e8506a'; ctx.fillRect(bx, by, Math.max(1, Math.round((m.hp / m.d.hp) * w)), 2);
  }
}
function drawProj(p) {
  const a = Math.atan2(p.vy, p.vx);
  ctx.save(); ctx.translate(Math.round(p.x), Math.round(p.y)); ctx.rotate(a);
  if (p.kind === 'arrow') { ctx.fillStyle = 'rgba(232,255,224,.35)'; ctx.fillRect(-16, -1, 10, 2); ctx.fillStyle = '#8a5a32'; ctx.fillRect(-8, -1, 10, 2); ctx.fillStyle = '#fff8e7'; ctx.fillRect(2, -2, 3, 4); ctx.fillStyle = '#e8d29a'; ctx.fillRect(-9, -2, 3, 4); }
  else if (p.kind === 'bigarrow') { ctx.fillStyle = 'rgba(255,224,138,.35)'; ctx.fillRect(-34, -7, 42, 14); ctx.fillStyle = '#ffe08a'; ctx.fillRect(-28, -2, 32, 4); ctx.fillStyle = '#fff'; ctx.fillRect(4, -5, 6, 10); ctx.fillRect(10, -2, 3, 4); }
  else if (p.kind === 'wave') {
    ctx.strokeStyle = 'rgba(189,241,255,.5)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(-6, 0, 15, -1.2, 1.2); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-6, 0, 15, -1.05, 1.05); ctx.stroke();
  } else if (p.kind === 'bolt') {
    ctx.fillStyle = 'rgba(192,132,255,.45)'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, 7); ctx.fill();
    ctx.fillStyle = '#c084ff'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(-1, -1, 2, 2);
  } else if (p.kind === 'fire' && asset('vfx/fire_burst')) {
    ctx.restore(); ctx.save(); ctx.globalCompositeOperation = 'lighter'; tex('glow_soft', '#ff8a3d', p.x, p.y, 34, 0, 0.9); tex('fire_burst', '#ffb347', p.x, p.y - 2, 24, Math.atan2(p.vy, p.vx) + Math.PI / 2, 1);
  } else if (p.kind === 'fire') {
    ctx.fillStyle = 'rgba(255,90,54,.4)'; ctx.beginPath(); ctx.arc(-3, 0, 12, 0, 7); ctx.fill();
    ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.fill(); ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(2, 0, 4, 0, 7); ctx.fill();
  }
  ctx.restore();
}
function zig(x0, y0, x1, y1, seed) {
  const pts = [[x0, y0]]; const n = 5;
  for (let i = 1; i < n; i++) { const k = i / n; pts.push([x0 + (x1 - x0) * k + (Math.sin(seed * 99 + i * 7) * 6), y0 + (y1 - y0) * k + (Math.cos(seed * 77 + i * 5) * 6)]); }
  pts.push([x1, y1]); return pts;
}
const GLOW = new Set(['ring', 'spin', 'nova', 'lightning', 'pillar', 'boom', 'punch', 'slash', 'clock', 'pull', 'claw', 'hit', 'circle', 'trail']);
function tex(id, color, x, y, size, rot = 0, alpha = 1, sx = 1) {
  const t = tinted('vfx/' + id, color);
  if (!t) return false;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sx, 1); ctx.imageSmoothingEnabled = true;
  ctx.drawImage(t, -size / 2, -size / 2, size, size); ctx.restore(); return true;
}
function drawFx(f) {
  const k = f.t / f.life;
  ctx.globalAlpha = 1;
  if (GLOW.has(f.kind)) ctx.globalCompositeOperation = 'lighter';
  drawFxInner(f, k);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
}
function drawFxInner(f, k) {
  switch (f.kind) {
    case 'hit': {
      const s = (f.big ? 14 : 8) * (0.6 + k * 0.8);
      if (tex('spark_star', f.color, f.x, f.y, s * 3, k, 1 - k)) break;
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = f.color; ctx.lineWidth = f.big ? 2.5 : 1.5;
      ctx.beginPath(); ctx.moveTo(f.x - s, f.y); ctx.lineTo(f.x + s, f.y); ctx.moveTo(f.x, f.y - s); ctx.lineTo(f.x, f.y + s); ctx.stroke();
      ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(f.x - s * 0.6, f.y - s * 0.6); ctx.lineTo(f.x + s * 0.6, f.y + s * 0.6); ctx.moveTo(f.x + s * 0.6, f.y - s * 0.6); ctx.lineTo(f.x - s * 0.6, f.y + s * 0.6); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(f.x, f.y, s * 0.35 * (1 - k), 0, 7); ctx.fill();
      break;
    }
    case 'circle': {
      const r = 14 + 6 * Math.min(1, k * 3), a = anim * 3;
      if (tex('magic_circle', f.color, f.x, f.y + 6, r * 2.6, a, (1 - k) * 0.9)) break;
      ctx.globalAlpha = (1 - k) * 0.85; ctx.strokeStyle = f.color; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(f.x, f.y + 6, r, r * 0.45, 0, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(f.x, f.y + 6, r * 0.7, r * 0.32, 0, 0, 7); ctx.stroke();
      for (let i = 0; i < 8; i++) { const t = a + (i / 8) * Math.PI * 2; ctx.fillStyle = i % 2 ? '#ffffff' : f.color; ctx.fillRect(f.x + Math.cos(t) * r * 0.85 - 1, f.y + 6 + Math.sin(t) * r * 0.38 - 1, 2, 2); }
      ctx.globalAlpha = (1 - k) * 0.25; ctx.fillStyle = f.color; ctx.fillRect(f.x - 3, f.y - 30 * (1 - k), 6, 36 * (1 - k));
      break;
    }
    case 'trail': {
      ctx.globalAlpha = (1 - k) * 0.7; ctx.strokeStyle = f.color; ctx.lineWidth = 2 * (1 - k) + 0.5;
      ctx.beginPath(); ctx.moveTo(f.x0, f.y0); ctx.lineTo(f.x1, f.y1); ctx.stroke();
      break;
    }
    case 'ring': if (tex('ring_wave', f.color, f.x, f.y, (2 + f.max * k) * 2.3, 0, (1 - k) * 0.95)) break; ctx.globalAlpha = 1 - k; ctx.strokeStyle = f.color; ctx.lineWidth = f.w; ctx.beginPath(); ctx.arc(Math.round(f.x), Math.round(f.y), 2 + f.max * k, 0, Math.PI * 2); ctx.stroke(); break;
    case 'slash': {
      if (tex('slash_arc', f.color, f.x, f.y, f.size * 3, f.ang + (k - 0.5) * 0.8, 1 - k)) break;
      const cx0 = f.x - Math.cos(f.ang) * 8, cy0 = f.y - Math.sin(f.ang) * 8;
      for (let e = 3; e >= 1; e--) { ctx.globalAlpha = (1 - k) * 0.18 * e; ctx.strokeStyle = f.color; ctx.lineWidth = 3 + e * 2.5; ctx.beginPath(); ctx.arc(cx0, cy0, f.size - e, f.ang - 1.1 + k * 0.4 - e * 0.12, f.ang + 1.1 + k * 0.4 - e * 0.12); ctx.stroke(); }
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = f.color; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(f.x - Math.cos(f.ang) * 8, f.y - Math.sin(f.ang) * 8, f.size, f.ang - 1.1 + k * 0.4, f.ang + 1.1 + k * 0.4); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(f.x - Math.cos(f.ang) * 8, f.y - Math.sin(f.ang) * 8, f.size - 2, f.ang - 0.8, f.ang + 0.8); ctx.stroke();
      break;
    }
    case 'punch': {
      if (tex('impact_burst', f.color, f.x, f.y, ((f.big ? 13 : 7) + k * 8) * 3, k * 2, 1 - k)) break;
      ctx.globalAlpha = 1 - k; const s = (f.big ? 13 : 7) + k * 8;
      ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(f.x, f.y, s, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(f.x, f.y, s + 4, 0, 7); ctx.stroke();
      break;
    }
    case 'spin': {
      if (tex('wind_swirl', f.color, f.x, f.y, 70, -k * 9, (1 - k * 0.6))) { tex('slash_arc', '#ffffff', f.x, f.y, 60, k * 12, 1 - k); break; }
      ctx.globalAlpha = 1 - k * 0.7;
      ctx.fillStyle = 'rgba(189,241,255,.18)'; ctx.beginPath(); ctx.arc(f.x, f.y, 26, 0, 7); ctx.fill();
      for (let i = 0; i < 3; i++) { const a = k * 9 + (i * Math.PI * 2) / 3; ctx.strokeStyle = i ? '#bdf1ff' : '#fff'; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.arc(f.x, f.y, 24, a, a + 1.6); ctx.stroke(); }
      break;
    }
    case 'bigsword': {
      if (f.t > f.life * 0.8) tex('impact_burst', '#ffd166', f.x, f.y, 80, 0, 1);
      const drop = Math.min(1, k / 0.85), y = f.y - 70 * (1 - drop);
      ctx.fillStyle = 'rgba(255,224,138,.35)'; ctx.fillRect(f.x - 6, y - 40, 12, 44);
      ctx.fillStyle = '#241a2b'; ctx.fillRect(f.x - 4, y - 38, 8, 40); ctx.fillRect(f.x - 10, y - 42, 20, 5);
      ctx.fillStyle = '#e6f2ff'; ctx.fillRect(f.x - 3, y - 37, 6, 37); ctx.fillStyle = '#fff'; ctx.fillRect(f.x - 3, y - 37, 2, 37);
      ctx.fillStyle = '#ffd166'; ctx.fillRect(f.x - 9, y - 41, 18, 3); ctx.fillStyle = '#8a5a32'; ctx.fillRect(f.x - 2, y - 52, 4, 10);
      break;
    }
    case 'crack': {
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#3b2a1f'; ctx.lineWidth = 2;
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + f.seed; const pts = zig(f.x, f.y, f.x + Math.cos(a) * 30, f.y + Math.sin(a) * 18, f.seed + i); ctx.beginPath(); pts.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); }
      break;
    }
    case 'target': {
      ctx.globalAlpha = 0.7 * (1 - k); ctx.strokeStyle = '#e8ffe0'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(f.x, f.y + 4, 26, 14, 0, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.ellipse(f.x, f.y + 4, 14, 7, 0, 0, 7); ctx.stroke();
      break;
    }
    case 'arrowfall': {
      if (f.t < f.delay) break;
      const kk = (f.t - f.delay) / 0.12, y = f.y - 60 * (1 - kk);
      ctx.fillStyle = '#e8d29a'; ctx.fillRect(f.x, y - 12, 2, 12); ctx.fillStyle = '#fff'; ctx.fillRect(f.x - 1, y, 4, 3);
      ctx.fillStyle = 'rgba(232,255,224,.5)'; ctx.fillRect(f.x, y - 30, 2, 18);
      break;
    }
    case 'nova': {
      if (tex('ring_wave', '#7fd8ff', f.x, f.y, (8 + 44 * k) * 2.3, 0, 1 - k)) { for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, r = 8 + 44 * k; tex('ice_shard', '#dff6ff', f.x + Math.cos(a) * r, f.y + Math.sin(a) * r, 16, a + Math.PI / 2, 1 - k); } break; }
      const r = 8 + 44 * k;
      ctx.globalAlpha = 1 - k; ctx.fillStyle = 'rgba(127,216,255,.25)'; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, 7); ctx.fill();
      ctx.strokeStyle = '#dff6ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, 7); ctx.stroke();
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; const sx = f.x + Math.cos(a) * r, sy = f.y + Math.sin(a) * r; ctx.fillStyle = '#ffffff'; ctx.fillRect(sx - 1, sy - 4, 2, 7); ctx.fillRect(sx - 3, sy - 1, 6, 2); }
      break;
    }
    case 'lightning': {
      if (asset('vfx/lightning')) { ctx.globalAlpha = 1 - k; for (let i = 0; i < f.pts.length - 1; i++) { const [x0, y0] = f.pts[i], [x1, y1] = f.pts[i + 1], len = Math.hypot(x1 - x0, y1 - y0); const t = tinted('vfx/lightning', '#fff7a8'); ctx.save(); ctx.translate((x0 + x1) / 2, (y0 + y1) / 2); ctx.rotate(Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2); ctx.imageSmoothingEnabled = true; ctx.drawImage(t, -len * 0.35, -len * 0.6, len * 0.7, len * 1.2); ctx.restore(); } break; }
      ctx.globalAlpha = 1 - k;
      for (let i = 0; i < f.pts.length - 1; i++) {
        const [x0, y0] = f.pts[i], [x1, y1] = f.pts[i + 1];
        const pts = zig(x0, y0, x1, y1, Math.floor(anim * 30) + i);
        ctx.strokeStyle = 'rgba(255,247,168,.55)'; ctx.lineWidth = 7; ctx.beginPath(); pts.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); pts.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      }
      break;
    }
    case 'dragon': {
      ctx.globalAlpha = 1 - k;
      const n = 14;
      for (let i = 0; i < n; i++) {
        const t = i / n, x = f.x0 + (f.x1 - f.x0) * t, y = f.y0 + (f.y1 - f.y0) * t - Math.sin(t * Math.PI) * 10 - k * 20;
        const wob = Math.sin(t * 12 + k * 20) * 5;
        ctx.fillStyle = i % 3 ? '#ffd166' : '#ff8a3d';
        ctx.beginPath(); ctx.arc(x + wob * (f.y1 !== f.y0 ? 1 : 0), y + wob * (f.x1 !== f.x0 ? 1 : 0), 7 - t * 3, 0, 7); ctx.fill();
      }
      ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(f.x1, f.y1 - k * 20 - 4, 6, 0, 7); ctx.fill();
      ctx.fillStyle = '#ff5a36'; ctx.fillRect(f.x1 - 3, f.y1 - k * 20 - 6, 2, 2); ctx.fillRect(f.x1 + 1, f.y1 - k * 20 - 6, 2, 2);
      break;
    }
    case 'boom': {
      if (tex('fire_burst', '#ff8a3d', f.x, f.y - 6, 30 + 40 * k, 0, 1 - k)) { tex('glow_soft', '#ffd166', f.x, f.y, 50, 0, (1 - k) * 0.8); break; }
      ctx.globalAlpha = 1 - k; ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.arc(f.x, f.y, 10 + 22 * k, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(f.x, f.y, 6 + 12 * k, 0, 7); ctx.fill();
      break;
    }
    case 'clock': {
      const r = 10 + 44 * Math.min(1, k * 2);
      ctx.globalAlpha = 1 - k * 0.8; ctx.strokeStyle = '#ffb35c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(224,83,61,.15)'; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, 7); ctx.fill();
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; ctx.fillStyle = '#fff1a8'; ctx.fillRect(f.x + Math.cos(a) * (r - 5) - 1, f.y + Math.sin(a) * (r - 5) - 1, 3, 3); }
      const h = -k * Math.PI * 6;
      ctx.strokeStyle = '#fff8e7'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + Math.cos(h) * r * 0.8, f.y + Math.sin(h) * r * 0.8); ctx.stroke();
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + Math.cos(h * 0.2) * r * 0.5, f.y + Math.sin(h * 0.2) * r * 0.5); ctx.stroke();
      break;
    }
    case 'pull': {
      ctx.globalAlpha = 1 - k;
      for (const [x, y] of f.pts) { ctx.strokeStyle = '#b48cff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(f.x + (x - f.x) * k, f.y + (y - f.y) * k); ctx.stroke(); ctx.strokeStyle = '#ff6b8a'; ctx.lineWidth = 1.5; ctx.stroke(); }
      ctx.strokeStyle = '#ff6b8a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, 60 * (1 - k) + 6, 0, 7); ctx.stroke();
      break;
    }
    case 'claw': {
      if (tex('slash_heavy', '#ffe066', f.x, f.y, 34, f.ang, 1 - k)) break;
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 2.5;
      for (let i = -1; i <= 1; i++) { const ox = Math.cos(f.ang + Math.PI / 2) * i * 5, oy = Math.sin(f.ang + Math.PI / 2) * i * 5; ctx.beginPath(); ctx.moveTo(f.x + ox - Math.cos(f.ang) * 14, f.y + oy - Math.sin(f.ang) * 14); ctx.lineTo(f.x + ox + Math.cos(f.ang) * 14, f.y + oy + Math.sin(f.ang) * 14); ctx.stroke(); }
      break;
    }
    case 'ghost': {
      ctx.globalAlpha = 0.45 * (1 - k); { const sh = pxHero(myLook); if (sh) { drawPxHero(sh, { px: f.x, py: f.y, face: f.face }); break; } const g0 = heroImg(myLook, f.face) || avatar(myLook, f.face, 1); const p = g0.width > AW ? pixelize(g0, PX_CHAR) : g0; ctx.drawImage(p, Math.round(f.x * TS) + 8 - Math.round(p.width / 2), Math.round(f.y * TS) + 17 - p.height); }
      break;
    }
    case 'heal': {
      if (asset('vfx/feather_glow')) { ctx.globalCompositeOperation = 'lighter'; tex('glow_soft', '#7ad35a', f.x, f.y, 40, 0, (1 - k) * 0.8); for (let i = 0; i < 4; i++) tex('feather_glow', '#c8ffb0', f.x + Math.sin(i * 2.1) * 9, f.y - k * 26 - i * 5, 12, i, 1 - k); break; }
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - k; ctx.fillStyle = '#7ad35a';
      for (let i = 0; i < 5; i++) { const ox = Math.sin(i * 2.1) * 9, oy = -k * 26 - i * 4; ctx.fillRect(f.x + ox - 1, f.y + oy - 4, 2, 8); ctx.fillRect(f.x + ox - 4, f.y + oy - 1, 8, 2); }
      ctx.strokeStyle = '#c8ffb0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(f.x, f.y + 6, 10 + k * 8, 4 + k * 3, 0, 0, 7); ctx.stroke();
      break;
    }
    case 'smoke': {
      if (!tex('smoke_puff', '#e8e4f0', f.x, f.y - k * 6, (f.big ? 40 : 22) * (0.6 + k), 0, (1 - k) * 0.7)) { ctx.globalAlpha = (1 - k) * 0.4; ctx.fillStyle = '#e8e4f0'; ctx.beginPath(); ctx.arc(f.x, f.y, 6 + k * 8, 0, 7); ctx.fill(); }
      break;
    }
    case 'pillar': {
      if (tex('light_pillar', f.color, f.x, f.y - 36, 90, 0, (1 - k) * 0.95)) break;
      ctx.globalAlpha = (1 - k) * 0.55; ctx.fillStyle = f.color;
      const w = 18 * (1 - k * 0.5); ctx.fillRect(f.x - w / 2, f.y - 80, w, 84);
      ctx.globalAlpha = (1 - k) * 0.9; ctx.fillStyle = '#fff'; ctx.fillRect(f.x - 2, f.y - 80, 4, 84);
      break;
    }
  }
  ctx.globalAlpha = 1;
}

// ---------- 主迴圈：鎖 30fps、背景時停止，避免發燙耗電 ----------
let last = 0;
function frame(t) {
  requestAnimationFrame(frame);
  if (t - last < 31) return;
  let dt = Math.min(0.1, (t - last) / 1000 || 0);
  last = t;
  if (document.hidden) return;
  if (cutinT > 0) {
    cutinT -= dt; render();
    if (cutinT <= 0) { $('cutin').hidden = true; if (pendingUlt) { doUlt(pendingUlt); pendingUlt = null; } }
    return;
  }
  if (freeze > 0) { freeze -= dt; dt *= 0.15; }
  update(dt);
  if (started) bossIntro();
  updateSkillUi();
  render();
}

// ---------- 標題與選職業 ----------
let pickCls = 'sword';
function start() {
  if (started) return;
  started = true;
  $('title').hidden = true; $('classPanel').hidden = true;
  $('ui').hidden = false;
  refresh(P); setupClass(); hud();
  checkOffline();
  if (P.ch === 1 && P.step === 0 && P.lv === 1) say('村長・歐文', [`歡迎來到微光村，${C.name}${P.name}！`, '按住紅色「攻擊」鍵連續攻擊，旁邊三顆是職業專屬技能。', '懶得操作就按左上的「自動」，角色會自己去打怪！', '先來廣場北邊找我說話吧。']);
}
function buildClassGrid() {
  $('classGrid').replaceChildren(...CLASS_IDS.map((id) => {
    const c = CLASSES[id];
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'classcard'; b.dataset.cls = id; b.style.setProperty('--c', c.color);
    const art = document.createElement('div'); art.className = 'cart';
    const base = lookOf({ cls: id, gear: {} }, CLASSES, rarityIdx);
    const leg = lookOf({ cls: id, gear: { armor: { rarity: 'legend' }, weapon: { rarity: 'legend' }, helm: { rarity: 'legend' } } }, CLASSES, rarityIdx);
    art.append(previewCanvas(base, 2), document.createTextNode('→'), previewCanvas(leg, 2));
    b.append(art);
    b.insertAdjacentHTML('beforeend', `<b>${c.name}</b><span class="role">${c.role}</span><span class="cdesc">${c.desc}</span><span class="cskills">${c.skills.map((s) => s.name).join('・')}</span>`);
    b.addEventListener('click', () => { pickCls = id; document.querySelectorAll('.classcard').forEach((x) => x.classList.toggle('on', x === b)); });
    return b;
  }));
  document.querySelector('.classcard')?.classList.add('on');
}
$('newBtn').addEventListener('click', () => { buildClassGrid(); $('overwriteNote').hidden = !hasSave; $('title').hidden = true; $('classPanel').hidden = false; });
$('classBack').addEventListener('click', () => { $('classPanel').hidden = true; $('title').hidden = false; });
$('classGo').addEventListener('click', () => {
  P = ensureParty(ensureInv(newPlayer(pickCls, $('nameInput').value.trim() || '冒險者')));
  soulPower = 0; loadMap(0);
  Object.assign(me, { x: P.x, y: P.y, px: P.x, py: P.y, fx: P.x, fy: P.y, moving: false, face: 'down' });
  drops = []; projs = []; pending = []; fx = [];
  save(); start();
});
$('startBtn').addEventListener('click', start);
function titleScreen() {
  $('startBtn').hidden = !hasSave;
  if (hasSave) $('startBtn').textContent = `繼續冒險（${CLASSES[P.cls].name} Lv ${P.lv}）`;
  $('newBtn').textContent = hasSave ? '建立新角色' : '建立角色・開始冒險';
  $('newBtn').className = hasSave ? 'ghostbtn' : 'startbtn';
  const looks = CLASS_IDS.map((id, i) => lookOf({ cls: id, gear: i % 2 ? { armor: { rarity: 'epic' }, weapon: { rarity: 'epic' }, helm: { rarity: 'epic' } } : { armor: { rarity: 'rare' }, weapon: { rarity: 'rare' } } }, CLASSES, rarityIdx));
  $('titleArt').replaceChildren(...(loadState.core ? looks.map((L) => previewCanvas(L, 2)) : []));
}
// 素材載入：重要的圖到齊前，標題按鈕先鎖住並顯示進度，避免看到舊的備用角色圖
function refreshArt() {
  for (const k of Object.keys(mapCache)) delete mapCache[k];
  mapC = renderMapCanvas(mapId); applyUiArt(); titleScreen();
  if (!$('classPanel').hidden) { const keep = pickCls; buildClassGrid(); document.querySelectorAll('.classcard').forEach((x) => x.classList.toggle('on', x.dataset.cls === keep)); }
  if (!$('bagPanel').hidden) renderBag();
  if (typeof render === 'function') render();
}
const loadTimer = setInterval(() => {
  const el = $('loadTip'); if (!el) return;
  el.hidden = loadState.core;
  el.textContent = `素材載入中… ${loadState.total ? Math.round((loadState.done / loadState.total) * 100) : 0}%`;
  $('newBtn').disabled = $('startBtn').disabled = !loadState.core;
  if (loadState.core) clearInterval(loadTimer);
}, 200);
loadAssets('assets/', refreshArt).then(refreshArt);
loadMap(P.map && P.map <= Math.min(6, P.ch) ? P.map : 0, { x: P.x, y: P.y });
setupClass();
resize();
titleScreen();
hud();
render();
document.fonts?.ready.then(render);
requestAnimationFrame(frame);

// 自動化測試用（網址加 ?debug 才開）
if (location.search.includes('debug')) globalThis.__game = { showCutin, get allies() { return allies; }, buildAllies, get P() { return P; }, newDrop, get drops() { return drops; }, set dropsAdd(d) { drops.push(d); }, me, get grid() { return grid; }, loadMap, get mapId() { return mapId; }, get mons() { return mons; }, get fishing() { return fishing; }, get dialog() { return dialog; }, get drops() { return drops; }, get skills() { return skills; }, castIdx, startTower, get trial() { return trial; }, renderAdv, hud };
