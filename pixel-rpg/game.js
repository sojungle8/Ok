import {
  W, H, T, TOWN_EDGE, FIELD_MIN_X, BOSS_ZONE, HOUSES, NPCS, SIGN, SPAWN, INN_SPOT, buildWorld, walkable, GATE_Y, FOUNTAIN_AT, reachable,
  MONSTERS, expNeed, stats, swordCost, POTION_PRICE, POTION_HEAL_PCT, FISH, rollFish, gainExp, newPlayer, loadPlayer,
  rollGear, rarityOf, rarityIdx, equipIfBetter, gearScore, itemPower, SLOTS, SLOT_NAME, DROP_RATE, CLASSES, CLASS_IDS,
  TALENTS, TALENT_MAX, TALENT_REQ, talentPoints, talentSpent, canLearn, learn, resetTalents,
  NIGHT, NIGHT_OPEN, NIGHT_LV, canNight, NAME_SHARD_RATE, NAME_BOX_RATE, NAME_SHARD_NEED, NAME_BOX_LV, openNameBox, nameBand,
  behOf,
  SOULS, SOUL_IDS, SUMMON_COST, SUMMON_PITY, shardNeed, addShards, exchangeSoul, SOUL_OF_CH, SOUL_SOURCE, SOUL_RARITY, offlineReward, affixName, LV_CAP, capFor, CHAPTERS, FIELD, buildField,
} from './world.js';
import { soulSprite, soulBig } from './soul.js';
import { ITEMS, GRADES, STAT_NAME, BAG_SIZE, bagSize, ensureInv, count, addStack, takeStack, pickupGear, pickupItem, equipFromBag, unequip, sellFromBag, sellStack, sellAllJunk, findGear, insertCard, REFINE_RATE, refineCost, refine, rollDrops, shopList, buy, pickPotion, gearSell, itemSell } from './items.js';
import { iconCanvas, gearIcon } from './icons.js';
import { loadAssets, asset, tinted, loadState } from './assets.js';
import { ensureMeta, refresh, track, claimQuest, claimChest, claimable, claimLogin, loginReward, questLabel, rewardText, CHESTS, codexBonus, codexStars, CODEX_TIERS, ACHIEVEMENTS, achProgress, achReady, claimAch, ELITE_AFFIX, ELITE_RATE, makeElite, DIFFS, diffOf, applyDiff, chestSpots, openChest, chestOpened, dayKey, quickIdleState, useQuickIdle, QUICK_IDLE_MIN, QUICK_COST, SHOP, buySku, canBuy, monthActive, monthDaysLeft, claimMonthDaily, monthClaimable, claimAll, MONTH_DAILY, BAG_PLUS_STEP, bagPlusNext, buyBagPlus, towerFloor, towerClear, LOGIN_CYCLE } from './meta.js';
import { pixelize } from './pixelize.js';
import { DIR8, DIR_VEC, dirOf, layout, DRAWN, MIRROR, sheetPath, paletteOf, monKind } from './spritesheet.js';
import { genSheet, heroLookFor, npcLookFor } from './pxgen.js';
import { STAGES, stageById, stageLock, maxDiff, diffMods, gateOf, ensureExped, clearStage, stageReward, gearChance, GEAR_CAP, DIFF_MAX, RUN_LEN, ELITE_AT, BOSS_AT, ITEM_SLOTS, CHEST_EVERY, wave, wavePool, newRun, gainRunExp, runExpNeed, gemValue, rollCards, applyCard, cardText, runSkillMult, runCdMult, runMods, skillSlots, RUN_ITEMS, rollItems, chestCost, BLESS } from './expedition.js';
import { ensureJob, gainJobExp, jobExpNeed, JOB_CAP, JOB_EXP_RATE, JOB2, ADVANCE_LV, ADVANCE_JOB, canAdvance, advanceJob, branchOf, jobTitle } from './progress.js';
import { BY_ID, RES, BAR_SIZE, ensureTree, skillPoints, learnSkill, autoLearnSkills, resetTree, whyNot, lvOf, skillNums, barSkills, describeSkill, routesOf, SKILLS } from './skilltree.js';
import { guardExp, effRatio, levelGapMult, newbieMult } from './balance.js';
import { ATTRS, ATTR_NAME, ATTR_DESC, ATTR_MAX, attrFree, attrPointsTotal, addAttr, autoAllocate, resetAttrs, ensureAttrs, addBuff, activeBuffs, BUFFS, hitChance, dodgeChance, damageMult, profileOf, ELEM_COLOR, SKILL_ELEM, ALLY_ELEM, monDef, defMod, MAIN_ATTR } from './ro.js';
import { audioOpt, saveAudioOpt, initAudio, sfx, playSong, audioLevel, currentSong } from './audio.js';
// 美術風格：像素風。高畫質的角色、怪物、NPC 在遊戲畫面中即時轉成像素圖；特效、頭像、大招立繪維持高畫質
const PX_CHAR = 36, PX_MON = 26, PX_BOSS = 52;
import { COMPANIONS, COMPANION_IDS, ROLE_NAME, PARTY_MAX, ensureParty, unlocked, hire, toggleActive, allyStats } from './party.js';
const TIER = ['common', 'good', 'rare', 'epic', 'legend'];
const cardIcons = {};
function cardIcon(id) {
  if (cardIcons[id]) return cardIcons[id];
  const fr = asset('icon/card_frame'), mon = asset('monster/' + ITEMS[id].mon);
  if (!fr || !mon) return null;
  const c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d');
  x.imageSmoothingQuality = 'high'; x.drawImage(fr, 0, 0, 96, 96); x.drawImage(mon, 18, 16, 60, 60);
  return (cardIcons[id] = c);
}
const itemIcon = (id) => asset('icon/' + id) || (ITEMS[id].kind === 'card' && cardIcon(id)) || iconCanvas(ITEMS[id].icon, ITEMS[id].color);
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
  const raw = (Math.min(w, h) * DPR) / (11 * TS);
  // 整數倍（4 倍以上取偶數）：每個像素一樣寬，高精像素圖（2 倍密度）也不會變形
  S = raw >= 4 ? Math.floor(raw / 2) * 2 : Math.max(1, Math.floor(raw));
  VW = cv.width / S; VH = cv.height / S;
  if (typeof render === 'function' && myLook) render();
}
const cv = $('cv');
const ctx = cv.getContext('2d');
addEventListener('resize', () => resize());
// 地圖：0 = 守燈村與守燈草原；2～6 = 各章野外
let deathN = 0, nightMode = false, mapId = 0, grid = buildWorld(), mapC = null, BZ = BOSS_ZONE, FMIN = FIELD_MIN_X;
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
  HOUSES.forEach((h) => { const im = asset(`prop/house_${h.color}`); if (im) { x.save(); x.imageSmoothingEnabled = true; x.drawImage(im, h.x * TS - 6, h.y * TS - 14, 60, 62); x.restore(); } });
  const f = asset('prop/fountain'); if (f) { x.save(); x.imageSmoothingEnabled = true; x.drawImage(f, FOUNTAIN_AT.x * TS - 4, FOUNTAIN_AT.y * TS - 6, 40, 40); x.restore(); }
}
mapC = renderMapCanvas(0);
const crownS = makeSprite(CROWN), bobberS = makeSprite(BOBBER), bangS = makeSprite(BANG), heartS = makeSprite(HEART), coinS = makeSprite(COIN);
const orbS = {};
for (const r of ['common', 'good', 'rare', 'epic', 'legend']) orbS[r] = makeSprite(ORB, { ...PAL, x: rarityOf(r).color });

let hasSave = false, P;
try { const raw = localStorage.getItem(KEY); hasSave = !!raw; P = loadPlayer(raw); } catch { P = newPlayer(); }
ensureInv(P); ensureParty(P);

ensureMeta(P); P.cb = codexBonus(P); ensureAttrs(P); ensureJob(P); if (P.autoAttr) autoAllocate(P);
const me = { x: P.x, y: P.y, px: P.x, py: P.y, fx: P.x, fy: P.y, face: 'down', moving: false, mt: 0, dur: 0.14, step: 0, atkT: 0, hurtT: 0, cool: 0, inv: 0, dodgeT: 0 };
function save() { P.x = me.x; P.y = me.y; P.map = mapId; P.seen = Date.now(); hasSave = true; try { localStorage.setItem(KEY, JSON.stringify(P, (k, v) => (k === 'runMods' ? undefined : v))); } catch { /* 無痕模式不存 */ } }

const R = Math.random;
const SK = BY_ID, skPoints = skillPoints, learnSk = learnSkill, autoLearnSk = autoLearnSkills, skDesc = describeSkill, ALL_SKILLS = SKILLS;
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
let C = CLASSES[P.cls], skills = [], myLook = null;
let mons = [], floats = [], parts = [], drops = [], fx = [], projs = [], pending = [];
let held8 = null, timeK = 1;
let run = null, cardOpen = false; // 遠征（主玩法）：進行中的一局
let dialog = null, fishing = null, started = false, held = null, aHeld = false, auto = false, autoHit = false, autoCastT = 0;
let anim = 0, regenT = 0, saveT = 0, shake = 0, freeze = 0, flash = 0, combo = 0, comboT = 0, auraT = 0;
let allies = [], atkOverride = 0, partyT = 0;
let trial = null, metaT = 0;
let skillElem = '無', skillElemT = 0, hitElem = null, allyElem = '無', curSkill = null;
// 專屬機制：誓約／燭火／星點／共鳴／鐘聲（層數），斥候的影是狀態
const res = { n: 0, max: 0, name: '' };
let shadowT = 0, comboNext = 1, lastElem = null, castMods = null;
// 人物畫風：hd＝精緻 Q 版立繪（預設）、px＝原生像素動畫
const charStyle = 'hd';
// 角色畫風：pixel＝類 RO 逐格像素動畫（預設）、hd＝精緻立繪＋程式動作
let artStyle = (() => { try { return localStorage.getItem('glimmer-art') || 'pixel'; } catch { return 'pixel'; } })();
let soulPower = 0, cutinT = 0, pendingUlt = null, catT = 0, warns = [], tintC = '#fff', tintT = 0;
const soulPos = { x: 0, y: 0 };
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const DROP_LIFT = 1.1; // 掉落物在地上停留、顯示名字的時間
const cx = (o) => o.px * TS + 8, cy = (o) => o.py * TS + 8;

function setupClass() {
  C = CLASSES[P.cls];
  ensureJob(P); ensureTree(P);
  const old = Object.fromEntries(skills.map((x) => [x.id, x.t]));
  skills = barSkills(P).map((sk) => ({ id: sk.id, name: sk.name, cd: sk.cd || 1, t: old[sk.id] || 0 }));
  for (let i = 0; i < BAR_SIZE; i++) {
    const b = $(`sk${i}Btn`), sk = skills[i];
    b.hidden = !sk;
    if (!sk) continue;
    b.querySelector('span').textContent = sk.name;
    b.style.setProperty('--c', SK[sk.id].kind === 'act' ? (SK[sk.id].need ? '#ffb35c' : C.color) : SK[sk.id].kind === 'heal' ? '#7ad35a' : '#7fd8ff');
  }
  res.max = RES[P.cls]?.max || 0; res.name = RES[P.cls]?.name || ''; res.n = Math.min(res.n, res.max);
  myLook = lookOf(P, CLASSES, rarityIdx);
  applyUiArt();
}
// 舊技能圖示暫時沿用到新技能（新圖示做好前）
const OLD_ICON = { lampSlash: 'spin', ringSlash: 'spin', lightBlade: 'wave', vowRelease: 'quake', twinStar: 'triple', scatterStar: 'triple', starfall: 'rain', meteorPierce: 'pierce', emberSeed: 'fireball', frostBreath: 'nova', thunderThread: 'chain', lightCandle: 'mend', candleArrow: 'lance', candleArray: 'sanctum', bellPalm: 'barrage', bellFists: 'barrage', bellQuake: 'shock', dawnStrike: 'dragon' };
// 介面美術：有圖就換上，沒有就維持程式畫的按鈕
function applyUiArt() {
  const url = (k) => asset('ui/' + k)?.src;
  skills.forEach((sk, i) => {
    const b = $(`sk${i}Btn`), u = url('skill_' + sk.id) || url('skill_' + (OLD_ICON[sk.id] || ''));
    b.classList.toggle('hasicon', !!u);
    b.style.backgroundImage = u ? `conic-gradient(#0b0816cc var(--p,0deg),transparent 0),url("${u}")` : '';
  });
  for (const [id, k] of [['aBtn', 'btn_attack'], ['dodgeBtn', 'btn_dodge'], ['bBtn', 'btn_potion']]) {
    const u = url(k), b = $(id); b.classList.toggle('hasicon', !!u); b.style.backgroundImage = u ? (id === 'dodgeBtn' ? `conic-gradient(#0b0816cc var(--p,0deg),transparent 0),url("${u}")` : `url("${u}")`) : '';
  }
  const bg = url('title_bg'), logo = url('logo');
  if (bg) $('title').style.backgroundImage = `linear-gradient(#140f2699,#140f26cc),url("${bg}")`;
  if (logo && !document.querySelector('.logo img')) { const im = new Image(); im.src = logo; im.alt = '長夜燈火'; $('title').querySelector('.logo').replaceChildren(im); }
}

// ---------- 怪物 ----------
const inBoss = (x, y) => x >= BZ.x0 && x <= BZ.x1 && y >= BZ.y0 && y <= BZ.y1;
// 8 方向：斜走時兩側都要走得通（不能切牆角）
const FACE4 = { s: 'down', n: 'up', w: 'left', e: 'right', sw: 'left', nw: 'left', se: 'right', ne: 'right' };
const D8 = { down: 's', up: 'n', left: 'w', right: 'e' };
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const diagOk = (x, y, dx, dy) => !(dx && dy) || (walkable(grid, x + dx, y) && walkable(grid, x, y + dy));
function face8(o, dx, dy) { const d = dirOf(dx, dy); if (d) { o.dir8 = d; if (o === me) me.face = Math.abs(dy) > Math.abs(dx) ? (dy > 0 ? 'down' : 'up') : FACE4[d]; } }
function occupied(x, y, self) {
  if (self !== me && me.x === x && me.y === y) return true;
  if (npcs.some((n) => n.x === x && n.y === y)) return true;
  if (allies.some((a) => a !== self && a.x === x && a.y === y)) return true;
  return mons.some((m) => m !== self && m.dead <= 0 && m.x === x && m.y === y);
}
const monCanGo = (m, x, y) => (Math.abs(x - m.x) > 1 || Math.abs(y - m.y) > 1 || diagOk(m.x, m.y, Math.sign(x - m.x), Math.sign(y - m.y))) && walkable(grid, x, y) && x >= (run ? 1 : FMIN) && grid[y][x] !== T.PORTAL && !occupied(x, y, m) && (run || (m.d.boss || m.minion ? inBoss(x, y) : !inBoss(x, y)));
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
  if (m.base && !trial) m.d = applyDiff(!m.base.boss && P && P.lv >= 5 && R() < ELITE_RATE ? makeElite(m.base, R) : m.base, P || {});
  const t = spawnTile(m);
  if (!t) { m.dead = 1; return; }
  Object.assign(m, { angryT: 0, retreatT: 0, hasteT: 0, pauseT: 0, fuse: 0, revived: 0, lurk: !!TR[m.type]?.lurk, home: { x: t.x, y: t.y }, chargeT: 3 + R() * 3, x: t.x, y: t.y, px: t.x, py: t.y, fx: t.x, fy: t.y, moving: false, hp: m.d.hp, dead: 0, cool: 1, think: R() * 1.5, flash: 0, kx: 0, ky: 0, spawnT: 0.4, frozen: 0, letter: 0, shield: false, phases: [], slamT: 3, spitT: 5, hidden: false, engaged: false, stolen: new Set(), rwT: 10, hist: [], histT: 0 });
  m.hidden = m.lurk;
}
function spawnRoster(list) { mons = []; for (const type of list) { const D = nightMode && NIGHT[type] ? NIGHT[type] : MONSTERS[type]; const m = { type, d: D, base: D, night: !!D.night, anim: R() * 2 }; mons.push(m); placeMon(m); } }
function fieldNpc(id) {
  const c = CHAPTERS[id - 1];
  if (!c.guide) return [];
  return [{ id: 'guide', ch: id, x: FIELD.guide.x, y: FIELD.guide.y, name: c.guide.name, look: c.guide.look, face: 'down', L: npcLook(c.guide), seed: 0 }];
}
function loadMap(id, at, night = false) {
  mapId = id; trial = null; nightMode = !!night && id > 0;
  grid = id === 0 ? buildWorld() : buildField(id);
  mapC = renderMapCanvas(id);
  BZ = FIELD.boss; FMIN = FIELD_MIN_X;
  npcs = id === 0 ? townNpcs : fieldNpc(id);
  drops = []; projs = []; eshots = []; zones = []; for (const k of Object.keys(pst)) pst[k] = 0; pending = []; fx = []; warns = []; fishing = null;
  const s0 = at && walkable(grid, at.x, at.y) ? at : id === 0 ? SPAWN : FIELD.spawn;
  Object.assign(me, { x: s0.x, y: s0.y, px: s0.x, py: s0.y, fx: s0.x, fy: s0.y, moving: false });
  soulPos.x = cx(me); soulPos.y = cy(me);
  const c = CHAPTERS[Math.max(1, id) - 1];
  if (typeof buildAllies === 'function' && P) { allies = []; buildAllies(); }
  spawnRoster(id === 0 ? [] : [...c.mons, ...c.mons, c.boss]);
  placeChests(); placeLamps();
}
// ---- 野外寶箱 ----
let chests = [];
function placeChests() {
  chests = [];
  if (mapId === 0 || !P) return;
  const reach = reachable(grid, FIELD.spawn);
  chests = chestSpots(grid, mapId, dayKey(), (x, y) => grid[y][x] !== T.PORTAL && walkable(grid, x, y) && reach.has(`${x},${y}`) && !(x >= BZ.x0 - 2 && x <= BZ.x1 + 2 && y >= BZ.y0 - 2 && y <= BZ.y1 + 2));
}
function drawChest(c) {
  const open = chestOpened(P, c.key), X = c.x * TS, Y = c.y * TS;
  if (!open) { ctx.globalAlpha = 0.35 + Math.sin(anim * 4 + c.x) * 0.2; ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.ellipse(X + 8, Y + 13, 9, 3.5, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(X + 2, Y + 13, 12, 2);
  ctx.fillStyle = '#2a1d2e'; ctx.fillRect(X + 1, Y + 5, 14, 9);
  ctx.fillStyle = open ? '#6b4024' : '#a0603a'; ctx.fillRect(X + 2, Y + 8, 12, 5);
  ctx.fillStyle = open ? '#4a2a18' : '#c97a45'; ctx.fillRect(X + 2, open ? Y + 3 : Y + 6, 12, open ? 3 : 2);
  ctx.fillStyle = '#ffd166'; ctx.fillRect(X + 2, Y + 8, 12, 1); ctx.fillRect(X + 7, Y + 7, 2, 4);
  if (!open && Math.sin(anim * 3 + c.y) > 0.7) { ctx.fillStyle = '#fff'; ctx.fillRect(X + 12, Y + 3, 1, 3); ctx.fillRect(X + 11, Y + 4, 3, 1); }
}
function checkChest() {
  const c = chests.find((k) => k.x === me.x && k.y === me.y);
  if (!c || chestOpened(P, c.key)) return;
  const r = openChest(P, c.key, R);
  if (!r) return;
  sfx('reward'); burst(cx(me), cy(me) - 4, '#ffd166', 22, 120); addFx('pillar', 0.7, { x: cx(me), y: cy(me), color: '#ffd166' });
  banner(r.big ? '發現華麗寶箱！' : '打開了寶箱！');
  if (r.gear) drops.push(newDrop('gear', cx(me), cy(me), rollGear(R, Math.max(P.lv, MONSTERS[CHAPTERS[mapId - 1].mons[1]].lv), r.big || R() < diffOf(P).rare, P.cls)));
  grant(r.reward); questDone(track(P, 'chest'));
}
// ---- 地圖相連：走到左右邊緣就換到相鄰地圖 ----
let gateMsgT = 0;
function checkGate() {
  if (run || trial || !GATE_Y.includes(me.y)) return;
  let to = null, at = null;
  if (me.x <= 0 && mapId > 0) { to = mapId - 1; at = { x: W - 2, y: me.y }; }
  else if (me.x >= W - 1 && mapId < 6) { to = mapId + 1; at = { x: 1, y: me.y }; }
  if (to === null) return;
  if (to > 0 && to > Math.min(6, P.ch)) {
    const back = me.x <= 0 ? 1 : W - 2;
    Object.assign(me, { x: back, px: back, fx: back, moving: false });
    if (gateMsgT <= 0) { gateMsgT = 3; const c = CHAPTERS[to - 1]; say('路標', [`前方是第 ${c.n} 章「${c.name}」。`, '那裡的怪物太強了，先完成目前的章節再過去吧。']); }
    return;
  }
  if (nightMode && to > NIGHT_OPEN) { const back = W - 2; Object.assign(me, { x: back, px: back, fx: back, moving: false }); if (gateMsgT <= 0) { gateMsgT = 3; say('路標', ['再往前的深夜還沒有人走過。', '（深夜地區目前開放到第 4 區）']); } return; }
  loadMap(to, at, nightMode && to > 0);
  const name = to === 0 ? '守燈村' : (nightMode ? '深夜・' : '') + CHAPTERS[to - 1].name;
  banner(name); feed(`來到了「${name}」`, '#c084ff'); hud(); save();
}
const inSafe = () => mapId === 0 || me.x < 5;
const alive = () => mons.filter((m) => m.dead <= 0 && !m.hidden);
const tdist = (m, x, y) => Math.hypot(m.px - x, m.py - y);
function nearest(range, from = me) { let best = null, bd = 1e9; for (const m of alive()) { const d = tdist(m, from.px, from.py); if (d <= range + (m.d.boss ? 0.6 : 0) && d < bd) { bd = d; best = m; } } return best; }

const MINION = { name: '小露滴王', tpl: 'slime', pal: MONSTERS.king.pal, hp: 160, atk: 8, exp: 10, coin: [2, 4], lv: 8, sight: 7 };
const MIRROR_OBJ = (b) => ({ name: '魔鏡', tpl: 'mirror', pal: {}, hp: Math.round(b.d.hp * 0.035), atk: 0, exp: 40, coin: [20, 40], lv: b.d.lv, sight: 0, still: true });
const DECOY = { name: '路人', tpl: 'decoy', pal: {}, hp: 1, atk: 0, exp: 0, coin: [0, 0], lv: 1, sight: 0, still: true, decoy: true };
let invertT = 0, lastSkill = null, lastUltId = null;
function spawnMinions(boss, n, d = MINION, opts = {}) {
  const spots = [];
  // 長夜求生沒有魔王區：召喚物出現在魔王身邊
  const [x0, x1, y0, y1] = run ? [Math.max(1, boss.x - 3), Math.min(W - 2, boss.x + 3), Math.max(1, boss.y - 3), Math.min(H - 2, boss.y + 3)] : [BZ.x0, BZ.x1, BZ.y0, BZ.y1];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (walkable(grid, x, y) && !occupied(x, y)) spots.push([x, y]);
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
    m.castAt = anim; banner('露滴王分裂了！'); feed('打倒<b>小露滴王</b>才能打破護盾', '#ff8a3d'); shake = 0.3;
  }
  if (mech === 'mirror') for (const th of [1, 0.5]) if ((th === 1 ? firstLook : ratio <= th) && !m.phases.includes(th)) {
    m.phases.push(th); spawnMinions(m, 3, MIRROR_OBJ(m), { spread: true }); m.shield = true;
    m.castAt = anim; banner('魔鏡出現了！'); feed('魔鏡還在時：<b>左右操作顛倒</b>、夫人無敵。先打破魔鏡！', '#c084ff');
  }
  if (mech === 'faceless') for (const th of [1, 0.66, 0.33]) if ((th === 1 ? firstLook : ratio <= th) && !m.phases.includes(th)) {
    m.phases.push(th); m.hidden = true; m.shield = true;
    const ds = spawnMinions(m, 5, DECOY, { spread: true });
    const real = ds[Math.floor(R() * ds.length)];
    ds.forEach((x, i) => { const n = NPCS[i % NPCS.length]; x.look = npcLook(n); x.npcId = n.id; x.real = x === real; });
    m.castAt = anim; banner('千面商人消失了！'); feed('五個路人裡只有一個是本尊——<b>他沒有影子</b>', '#f6c945');
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
      addFx('clock', 0.9, { x: cx(m), y: cy(m) }); flash = 0.15; banner('時間倒轉！'); m.castAt = anim;
    }
  }
  if (d > 7 || m.hidden) return;
  m.slamT -= dt; m.spitT -= dt;
  if (d <= 4 && m.slamT <= 0) { m.slamT = 6; m.castAt = anim; warns.push({ x: m.px, y: m.py, r: 2.2, t: 0, life: 1.1, dmg: Math.round(m.d.atk * 2.2), kind: 'slam' }); }
  if (m.spitT <= 0) {
    m.spitT = 8.5; m.castAt = anim;
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
  if (started) { $('talentDot').hidden = !(talentPoints(P) > talentSpent(P) || (!P.autoAttr && attrFree(P) > 0)); $('advDot').hidden = !claimable(P); $('shopDot').hidden = !(monthClaimable(P) || canBuy(P, 'daily')); }
  myLook = lookOf(P, CLASSES, rarityIdx);
  $('lv').textContent = P.lv;
  ensureJob(P); $('clsName').textContent = jobTitle(P, C.name);
  if (P.mp === undefined || P.mp > st.mpMax) P.mp = st.mpMax;
  $('mpBar').style.width = `${Math.max(0, P.mp / st.mpMax) * 100}%`; $('mpText').textContent = `${fmt(P.mp)} / ${fmt(st.mpMax)}`;
  const rb = $('resBar'); rb.hidden = !res.max; if (res.max) rb.innerHTML = `<span>${P.cls === 'scout' ? (shadowT > 0 ? '影中' : '光下') : res.name}</span>${P.cls === 'scout' ? '' : Array.from({ length: res.max }, (_, i) => `<i class="${i < res.n ? 'on' : ''}"></i>`).join('')}`;
  const ef = effRatio(P); $('effBar').hidden = ef < 1.5; $('effBar').textContent = ef >= 2 ? `本小時效率 ${ef.toFixed(1)} 倍・之後經驗遞減` : `本小時效率 ${ef.toFixed(1)} 倍`;
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
  $('talentDot').hidden = talentSpent(P) >= talentPoints(P) && (P.autoAttr || attrFree(P) <= 0);
  $('quest').textContent = questText();
}
function questText() {
  const dpre = P.diff ? `【${diffOf(P).name}】` : '';
  return dpre + questText0();
}
function questText0() {
  if (run) return `遠征・${run.st.name}・難度 ${run.diff}`;
  if (trial) return `試煉之塔 第 ${trial.f} 層｜剩 ${mons.filter((m) => m.dead <= 0).length} 隻｜${trial.done ? '通過！' : `⏱ ${Math.max(0, Math.ceil(trial.t))} 秒`}`;
  const c = CHAPTERS[P.ch - 1];
  if (!c) return '全章節完成｜自由冒險：收集卡片、精煉、刷傳說裝備';
  const pre = `第 ${c.n} 章｜`;
  if (c.n === 1) return pre + ['找廣場北邊的村長歐文聊聊', `打倒露滴團 ${Math.min(P.kills, 20)} / 20，再回報村長`, '到守燈草原的東北角擊敗露滴王（建議 Lv 7 以上）', '回村子向村長報告'][P.step];
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
    if (x1 > x0 && y1 > y0) { const t = document.createElement('canvas'); t.width = x1 - x0 + 4; t.height = y1 - y0 + 4; t.getContext('2d').drawImage(img, x0 - 2, y0 - 2, t.width, t.height, 0, 0, t.width, t.height); t.bx0 = x0 - 2; t.by0 = y0 - 2; out = t; }
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
  $('bagCount').textContent = `裝備 ${P.bag.gear.length}/${bagSize(P)}`;
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
  else if (r.success) { sfx('refineOk'); banner(`精煉成功！+${r.level}`); flash = 0.12; burst(cx(me), cy(me), '#fff1a8', 24, 110); const after = stats(P).cp; if (after > before) popCp(before, after); }
  else { sfx('refineFail'); feed('精煉失敗……材料消失了，裝備沒事', '#ff8fa0'); shake = 0.2; }
  hud(); save(); renderRefine();
});
$('refineClose').addEventListener('click', () => { $('refinePanel').hidden = true; });

// ---------- 天賦 ----------
function renderAttrs() {
  ensureAttrs(P); if (P.autoAttr && attrFree(P)) autoAllocate(P);
  const st = stats(P), free = attrFree(P), a = P.attrs, ea = st.attrs, main = MAIN_ATTR[P.cls];
  const rows = ATTRS.map((k) => `<div class="arow${k === main ? ' main' : ''}"><b>${ATTR_NAME[k]}</b><span class="av">${a[k]}${ea[k] > a[k] ? `<em>+${ea[k] - a[k]}</em>` : ''}</span><small>${ATTR_DESC[k]}</small><button type="button" data-k="${k}" ${free && a[k] < ATTR_MAX && !P.autoAttr ? '' : 'disabled'}>＋</button></div>`).join('');
  const m = st.mods, list = (o, suf = '') => Object.entries(o).map(([k, v]) => `${k}${suf} +${v}%`).join('、');
  const cardLines = [
    st.weaponElem !== '無' && `武器屬性：<b style="color:${ELEM_COLOR[st.weaponElem]}">${st.weaponElem}</b>`,
    Object.keys(m.race).length && `對種族：${list(m.race)}`, Object.keys(m.elemDmg).length && `對屬性：${list(m.elemDmg)}`,
    Object.keys(m.size).length && `對體型：${list(m.size)}`, Object.keys(m.resist).length && `抗性：${Object.entries(m.resist).map(([k, v]) => `${k} -${v}%`).join('、')}`,
  ].filter(Boolean);
  const buffs = activeBuffs(P).map((b) => `<span class="chip" style="color:${BUFFS[b].color}">${BUFFS[b].name}</span>`).join('');
  $('attrBox').innerHTML = `<div class="ahead"><span>能力點 <b>${free}</b> / ${attrPointsTotal(P.lv)}（每升 1 級 +4）</span><label><input type="checkbox" id="autoAttrChk" ${P.autoAttr ? 'checked' : ''}> 自動分配</label></div>
    <div class="agrid">${rows}</div>
    <div class="aderived"><span>攻擊 <b>${fmt(st.atk)}</b></span><span>生命 <b>${fmt(st.hp)}</b></span><span>命中 <b>${st.hit}</b></span><span>迴避 <b>${st.flee}</b></span><span>暴擊 <b>${Math.round(st.crit * 100)}%</b></span><span>攻速 <b>${Math.round(st.aspd * 100)}%</b></span><span>減傷 <b>${Math.round(st.dr * 100)}%</b></span><span>技能 <b>${Math.round(st.skill * 100)}%</b></span></div>
    ${cardLines.length ? `<p class="small">${cardLines.join('<br>')}</p>` : '<p class="small muted">裝備插上卡片，可以獲得種族、屬性、體型加成</p>'}
    ${buffs ? `<p class="small">輔助效果：${buffs}</p>` : ''}
    <div class="crow"><button id="attrReset" class="ghostbtn" type="button">重新分配（免費）</button></div>`;
  $('attrBox').querySelectorAll('button[data-k]').forEach((b) => b.addEventListener('click', () => { if (addAttr(P, b.dataset.k)) { hud(); save(); renderTalents(); } }));
  $('autoAttrChk').addEventListener('change', (e) => { P.autoAttr = e.target.checked; if (P.autoAttr) autoAllocate(P); hud(); save(); renderTalents(); });
  $('attrReset').addEventListener('click', () => { resetAttrs(P); if (P.autoAttr) autoAllocate(P); hud(); save(); renderTalents(); });
}
function renderJob() {
  ensureJob(P); ensureTree(P);
  if (P.autoAttr) { autoLearnSk(P); setupClass(); }
  const j = P.job, cap = JOB_CAP[j.tier], need = jobExpNeed(j.lv, j.tier), pt = skPoints(P), br = branchOf(P);
  const pct = j.lv >= cap ? 100 : Math.round((j.exp / need) * 100);
  const row = (sk) => {
    const lv = lvOf(P, sk.id), why = whyNot(P, sk.id), onBar = P.bar.includes(sk.id), active = sk.kind !== 'pas';
    return `<div class="skrow ${lv ? '' : 'off'}"><b>${sk.name}</b><span>Lv ${lv}/${sk.max}</span><small>${skDesc(sk, lv || 1)}${sk.pre.length ? `<br><em>前置：${sk.pre.map(([id, l]) => `${SK[id].name} ${l}`).join('、')}</em>` : ''}</small>
      ${active && lv ? `<button type="button" class="barbtn ${onBar ? 'on' : ''}" data-bar="${sk.id}" title="放到技能列">${onBar ? '★' : '☆'}</button>` : '<span></span>'}
      <button type="button" data-s="${sk.id}" ${why || P.autoAttr ? 'disabled' : ''} title="${why}">＋</button></div>`;
  };
  const mine = (owner) => ALL_SKILLS.filter((x) => x.owner === owner);
  let adv = '';
  if (j.tier === 1) adv = canAdvance(P) ? `<div class="advbox"><b>可以轉職了！</b>選一條路線（之後不能更改）：${routesOf(P.cls).map((b) => `<button type="button" class="startbtn" data-b="${b.id}">${b.name}<small>${mine(b.id).slice(0, 4).map((x) => x.name).join('・')}…</small></button>`).join('')}</div>` : `<p class="small muted">轉職條件：Lv ${ADVANCE_LV}、職業 Lv ${ADVANCE_JOB}。二轉後多 69 個技能點與 10 招路線技能。</p>`;
  $('jobBox').innerHTML = `<div class="ahead"><span><b>${jobTitle(P, C.name)}</b>　職業 Lv <b>${j.lv}</b> / ${cap}</span><span>技能點 <b>${pt.free}</b>${j.tier >= 2 ? `（二轉 ${pt.free2}）` : ''}</span></div>
    <div class="qbar"><i style="width:${pct}%"></i><span>${j.lv >= cap ? '職業等級已滿' : `${fmt(j.exp)} / ${fmt(need)}`}</span></div>
    <p class="small muted">${P.autoAttr ? '自動配點中（照推薦流派）。關掉上面的「自動」就能自己點。' : '技能點有限，不能全部點滿；選擇就是你的流派。☆ 可以把技能放到技能列（最多 6 招）。'}</p>
    <h5 class="tsub">一轉・${C.name}</h5><div class="sklist">${mine(P.cls).map(row).join('')}</div>
    ${br ? `<h5 class="tsub">二轉・${br.name}</h5><div class="sklist">${mine(br.id).map(row).join('')}</div>` : ''}${adv}
    <div class="crow"><button id="skReset" class="ghostbtn" type="button">重置技能</button><button id="skAuto" class="ghostbtn" type="button">推薦配點</button></div>`;
  const redo = () => { setupClass(); hud(); save(); renderTalents(); };
  $('jobBox').querySelectorAll('button[data-s]').forEach((b) => b.addEventListener('click', () => { if (learnSk(P, b.dataset.s)) redo(); }));
  $('jobBox').querySelectorAll('button[data-bar]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.bar, i = P.bar.indexOf(id);
    if (i >= 0) P.bar.splice(i, 1); else if (P.bar.length < BAR_SIZE) P.bar.push(id); else feed('技能列已滿（6 招），先取下一招', '#ff8fa0');
    redo();
  }));
  $('skReset').addEventListener('click', () => { resetTree(P); redo(); });
  $('skAuto').addEventListener('click', () => { autoLearnSk(P); redo(); });
  $('jobBox').querySelectorAll('button[data-b]').forEach((b) => b.addEventListener('click', () => {
    const name = routesOf(P.cls).find((x) => x.id === b.dataset.b)?.name;
    $('talentPanel').hidden = true;
    say('轉職', [`確定轉職成「${name}」？轉職後不能更改路線。`], [['轉職！', () => { if (advanceJob(P, b.dataset.b)) { banner(`轉職成功：${name}`); flash = 0.3; burst(cx(me), cy(me), '#ffd166', 50, 180); addFx('pillar', 1, { x: cx(me), y: cy(me), color: '#ffd166' }); sfx('levelup'); if (P.autoAttr) autoLearnSk(P); setupClass(); hud(); save(); } }], ['再想想', null]]);
  }));
}
function renderTalents() {
  renderAttrs(); renderJob();
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
  P.shards ??= {};
  $('soulList').replaceChildren(...SOUL_IDS.map((id) => {
    const S = SOULS[id], star = P.souls[id] || 0, need = shardNeed(P, id), have = P.shards[id] || 0;
    const card = document.createElement('div');
    card.className = `soulcard${star ? '' : ' locked'}${P.soul === id ? ' on' : ''}`;
    card.style.setProperty('--sc', S.color);
    card.append(soulIcon(id, 'sart'));
    card.insertAdjacentHTML('beforeend', `<div class="sinfo"><b>${S.name}</b> <span class="stype">${S.type}・${{ common: '普通', rare: '稀有', legend: '傳說' }[SOUL_RARITY[id]]}</span> <span class="stars">${'★'.repeat(star)}${'☆'.repeat(5 - star)}</span><p>被動：${S.passive}</p><p>大招：${S.ult}</p><p class="muted">碎片 ${have}${need ? ` / ${need}` : '（已滿星）'}・來源：${SOUL_SOURCE[id]}</p></div>`);
    const row = document.createElement('div'); row.className = 'crow';
    if (need !== null) {
      const x = document.createElement('button'); x.type = 'button'; x.className = 'startbtn'; x.textContent = star ? '升星' : '兌換'; x.disabled = have < need;
      x.addEventListener('click', () => {
        const r = exchangeSoul(P, id); if (!r.ok) { $('summonRes').textContent = r.reason; return; }
        if (r.isNew) { $('soulPanel').hidden = true; showCutin(id, '契約'); cutinT = 1.4; pendingUlt = null; setTimeout(() => { renderSouls(); $('soulPanel').hidden = false; }, 1500); }
        else $('summonRes').textContent = `${S.name} 升到 ${r.star} 星！`;
        hud(); save(); renderSouls();
      });
      row.append(x);
    }
    if (star) {
      const b = document.createElement('button'); b.type = 'button'; b.className = P.soul === id ? 'ghostbtn' : 'startbtn'; b.textContent = P.soul === id ? '使用中' : '裝上';
      b.disabled = P.soul === id;
      b.addEventListener('click', () => { P.soul = id; soulPower = 0; hud(); save(); renderSouls(); });
      row.append(b);
    }
    card.append(row);
    return card;
  }));
}
$('soulMenuBtn').addEventListener('click', () => { if (!started) return; $('summonRes').textContent = ''; renderSouls(); $('soulPanel').hidden = false; });
$('soulClose').addEventListener('click', () => { $('soulPanel').hidden = true; });

// ---------- 離線收益 ----------
function checkOffline() {
  if (!P.seen) return;
  const cap = monthActive(P) ? 1440 : 720;
  const r = offlineReward(P, (Date.now() - P.seen) / 60000, R, cap);
  if (!r) return;
  const h = Math.floor(r.mins / 60), mm = r.mins % 60;
  showIdle(r, '離線收益', `你離開了 <b>${h ? `${h} 小時 ` : ''}${mm} 分鐘</b>，角色在「${r.zone}」持續狩獵：`, `離線最多累積 ${cap / 60} 小時${monthActive(P) ? '（月卡加成）' : '，月卡可延長到 24 小時'}。`);
}
function quickIdle() {
  const u = useQuickIdle(P);
  if (!u) { const q = quickIdleState(P); feed(q.paidLeft <= 0 ? '今天的快速掛機用完了，明天再來' : `魂石不夠（需要 ${QUICK_COST}）`, '#ff8fa0'); return; }
  const r = offlineReward(P, QUICK_IDLE_MIN, R, QUICK_IDLE_MIN);
  sfx('reward'); $('advPanel').hidden = true;
  showIdle(r, '快速掛機', `夥伴們幫你在「${r.zone}」打了 <b>2 小時</b>：`, u.cost ? `花費魂石 ${u.cost}` : `今天還有 ${quickIdleState(P).freeLeft} 次免費`);
  save();
}
function showIdle(r, title, head, foot) {
  $('offlinePanel').querySelector('h3').textContent = title;
  $('offlineBody').innerHTML = `<p>${head}</p><div class="loot"><span class="chip">擊倒 ${fmt(r.kills)} 隻</span><span class="chip">經驗 +${fmt(r.exp)}</span><span class="chip"><i class="dot gold"></i>${fmt(r.coins)}</span><span class="chip">裝備 ×${r.items.length}</span></div><p class="muted small">${foot}</p>`;
  $('offlinePanel').hidden = false;
  $('offlineOk').onclick = () => {
    $('offlinePanel').hidden = true;
    const before = P.lv;
    P.coins += r.coins;
    let eq = 0;
    for (const it of r.items) if (pickupGear(P, it).action === 'equip') eq++;
    if (gainExp(P, r.exp)) levelUp(before);
    jobExp(r.exp * JOB_EXP_RATE);
    if (eq) feed(`離線撿到的裝備有 ${eq} 件比較好，已自動換上`, '#7ad35a');
    hud(); save();
  };
}

// ---------- 對話 ----------
function say(name, lines, opts, onClose) { dialog = { name, lines, i: 0, opts, onClose }; showDialog(); }
function portraitKey(name) {
  const n = [...townNpcs, ...CHAPTERS.slice(1).map((c) => ({ id: 'guide' + c.n, name: c.guide.name }))].find((x) => x.name === name);
  if (n) return 'portrait/' + n.id;
  const a = COMPANION_IDS.find((id) => COMPANIONS[id].name === name);
  return a ? 'portrait/ally_' + a : null;
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
    if (c1 && P.step === 0) { P.step = 1; P.kills = 0; say(nm, [`${P.name}，你來得正好！草原上的露滴團多到快滿出來了。`, '從村子東門出去就是守燈草原。', '幫我清掉 20 隻。懶得操作就按「自動」吧！']); }
    else if (c1 && P.step === 1 && P.kills >= 20) {
      say(nm, ['……等等，你身上那道光是怎麼回事？', '那是「星痕」！艾斯特家的血脈，終於又覺醒了！', '別怕，閉上眼睛，聽聽你靈魂的聲音——'], null, awaken);
    }
    else if (c1 && P.step === 1) say(nm, [`還差 ${20 - P.kills} 隻，加油！`]);
    else if (c1 && P.step === 2) say(nm, ['露滴王受傷會分裂，分裂時會張開護盾。', '先打倒小露滴王，護盾才會破。', '地上出現紅圈就快點「閃避」！']);
    else if (c1 && P.step === 3) {
      P.coins += 500; P.stones += 200;
      say(nm, ['你真的打倒了露滴王！收下這 500 金幣和 200 魂石。', '……那隻魂像，我以前見過。', '六十年前，你的曾祖父雷歐也帶著一模一樣的齒輪。', '他最後去了東邊的迴聲峽谷，就再也沒有回來。', '來，握住這塊懷錶，你會看到他的記憶。'], null, memoryCorridor);
    }
    else say(nm, [P.ch <= 6 ? `${P.name}，${CHAPTERS[P.ch - 1].name}那邊就拜託你了。` : '你結束了三百年的黑夜。整個長夜燈火都在說你的故事。', '想挑戰更強的怪物、拿更好的寶物，可以調整冒險難度。', `目前難度：${diffOf(P).name}`],
      [...DIFFS.map((d, i) => [`${i === (P.diff | 0) ? '✓ ' : ''}${d.name}：${d.desc}`, () => (P.lv >= (d.minLv || 0) ? setDiff(i) : feed(`${d.name}需要 Lv${d.minLv}`, '#ff8fa0'))]).filter((_, i) => P.lv >= (DIFFS[i].minLv || 0) - 10), ['離開', null]]);
  } else if (n.id === 'porter') {
    {
      const opts = CHAPTERS.filter((c) => c.n <= Math.min(6, P.ch)).map((c) => [`第 ${c.n} 章・${c.name}（Lv ${MONSTERS[c.mons[0]].lv}～）`, () => { loadMap(c.n); feed(`來到了「${c.name}」`, '#c084ff'); hud(); save(); }]);
      const nopts = canNight(P) ? CHAPTERS.slice(0, NIGHT_OPEN).map((c) => [`深夜・${c.name}（Lv ${NIGHT[c.mons[0]].lv}～）`, () => { loadMap(c.n, null, true); banner(`深夜・${c.name}`); feed('長夜吞掉的名字，在這裡的怪物身上', '#9a7cff'); hud(); save(); }]) : [];
      const runOpts = [['★ 遠征：選關卡出發', openExped]];
      say(nm, [canNight(P) ? '你也想去看看夜晚的另一面嗎？深夜的怪物身上，偶爾會掉出被吞掉的名字。' : '要去哪裡呢？也可以從東門一路走過去。回來時踩上傳送陣，或往西走回來都行。'], [...runOpts, ...opts.map(([t, f]) => [`自由練功：${t}`, f]), ...nopts, ...(P.ch >= 2 ? [[`試煉之塔（最高第 ${ensureMeta(P).tower.best} 層）`, () => startTower(P.meta.tower.best + 1)]] : []), ['留在村子', null]]);
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
    say(nm, ['歡迎來到守燈旅店！', '（你好好休息了一下，HP 全部恢復了）']);
  } else if (n.id === 'smith') {
    say(nm, ['想讓裝備更強嗎？我這裡可以「精煉」。', '+4 以內保證成功，再往上就看運氣了。失敗只會吃掉材料，不會弄壞你的裝備。'], [['精煉裝備', () => openRefine()], ['離開', null]]);
  } else if (n.id === 'fisher') {
    say(nm, ['想釣魚嗎？面向河邊按攻擊鍵就能拋竿。', '浮標旁邊跳出「！」的時候，馬上再按一次！', '釣到的魚可以賣給雜貨店的莉莉。']);
  }
  hud(); save();
}
function setDiff(i) {
  P.diff = i; const d = DIFFS[i];
  for (const m of mons) if (m.base && m.dead <= 0 && !m.d.trial) { const r = m.hp / m.d.hp; m.d = applyDiff(m.d.elite ? makeElite(m.base, R) : m.base, P); m.hp = Math.round(m.d.hp * r); }
  banner(`冒險難度：${d.name}`); feed(d.desc, d.color); hud(); save();
}
function awaken() {
  P.souls.gear = P.souls.gear || 1; P.soul = 'gear'; soulPower = 100; P.stones += 200; P.step = 2;
  showCutin('gear', '覺醒'); cutinT = 1.8; pendingUlt = null;
  setTimeout(() => {
    banner('獲得魂像【鏽紅齒輪】');
    say('村長・歐文', ['……鏽紅齒輪。它能讓時間倒轉。', '魂力集滿時，按右下角發光的「魂像」鍵就能發動大招。', '其他魂像不能抽，要打倒各地的魔王與精英怪收集碎片，到「魂像」選單兌換。', '現在，你有資格挑戰露滴王了。']);
    hud(); save();
  }, 1900);
}
function memoryScene(c) {
  $('app').classList.add('memory');
  say('記憶迴廊', c.memory, null, () => {
    $('app').classList.remove('memory');
    P.coins += 500 * c.n; P.stones += 200;
    banner(`第 ${c.n} 章　完`);
    if (c.n === 6) { P.ch = 7; P.step = 0; setTimeout(() => banner('長夜燈火　完'), 2000); feed('恭喜通關！等級上限提高到 60，繼續收集卡片與傳說裝備吧', '#f6c945'); }
    else { P.ch = c.n + 1; P.step = 0; feed(`第 ${c.n + 1} 章「${CHAPTERS[c.n].name}」開放了，找傳送師小葵`, '#f6c945'); }
    hud(); save();
  });
}
function memoryCorridor() {
  $('app').classList.add('memory');
  say('記憶迴廊・六十年前', ['（懷錶的指針開始倒轉，四周的顏色褪成了褐色……）', '雷歐：「齒輪，再幫我一次。只要倒轉三秒就夠了！」', '雷歐：「瓦爾德……你偷走的那些魂像，我一定會一個一個拿回來。」', '雷歐：「如果我回不來，就讓下一個艾斯特來結束這一切吧。」', '（指針停住了。你回到了守燈村。）'], null, () => {
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
function hitPlayer(m, k = 1) {
  const B = m.d.beh || {};
  const T0 = TR[m.type];
  const before = P.hp;
  hurt(m.d.atk * k * (T0?.hitK?.(m) ?? 1) * (1 - debOn(m, '攻擊降低')) * (B.rage && m.hp < m.d.hp * 0.3 ? 1.3 : 1), m);
  if (P.hp >= before) return;
  if (B.burn || B.poison) playerDot(m, B.burn ? '#ff9f40' : '#a66bd6');
  T0?.hit?.(m);
}

// ================= 遠征（主玩法）=================
// 選地圖 → 一局 15 分鐘：局內從 Lv1 開始，撿經驗寶石升級三選一（新技能／強化／加護），花金幣開寶箱拿本局道具；
// 第 5、10 分鐘小王，第 13 分鐘地區魔王，打倒就通關。普攻與技能自動施放，玩家只管走位。
let expSel = '1', expDiff = 1;
function startRun(id, diff = 1) {
  const st = stageById(id); if (!st) return;
  if (dialog) { dialog = null; showDialog(); }
  $('expPanel').hidden = true;
  loadMap(st.ch, { x: Math.floor(W / 2), y: Math.floor(H / 2) });
  run = newRun(P, st, diff); cardOpen = false;
  mons = []; npcs = []; chests = [];
  P.runMods = runMods(run); setupRunSkills();
  const sst = stats(P); P.hp = sst.hp; P.mp = sst.mpMax;
  auto = false; syncAuto();
  ensureExped(P).runs++;
  banner(`${st.name}　難度 ${diff}`);
  feed('開場 30 秒怪比較少，先撿寶石升級拿技能。第 13 分鐘地區魔王登場，打倒就通關！', '#ffd166');
  $('advPanel').hidden = true; hud(); updateRunHud();
}
function setupRunSkills() {
  const ids = Object.keys(run.skills), old = Object.fromEntries(skills.map((x) => [x.id, x.t]));
  skills = ids.map((id) => ({ id, name: SK[id].name, cd: SK[id].cd || 1, t: old[id] || 0 }));
  for (let i = 0; i < BAR_SIZE; i++) {
    const b = $(`sk${i}Btn`), sk = skills[i]; b.hidden = !sk; if (!sk) continue;
    b.querySelector('span').textContent = `${sk.name}${run.bless[sk.id] ? '★' : ''} ${run.skills[sk.id]}`;
  }
  applyUiArt();
}
function runSpawnOne(type, extra = {}) {
  const base = MONSTERS[type], wv = wave(run.t), md = run.mods;
  const d = { ...base, hp: Math.round(base.hp * wv.hpMul * md.hp * (extra.hpK || 1)), atk: Math.round(base.atk * wv.atkMul * md.atk), exp: Math.round(base.exp * md.exp), sight: 30, trial: true, runMon: true, ...extra.d };
  for (let k = 0; k < 30; k++) {
    const a = R() * Math.PI * 2, r = 8 + R() * 3, x = Math.round(me.x + Math.cos(a) * r), y = Math.round(me.y + Math.sin(a) * r * 0.8);
    if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1 || !walkable(grid, x, y) || occupied(x, y) || grid[y][x] === T.PORTAL) continue;
    const m = { type, d, base: null, anim: R() * 2 };
    Object.assign(m, { x, y, px: x, py: y, fx: x, fy: y, moving: false, hp: d.hp, dead: 0, cool: 1, think: R(), flash: 0, kx: 0, ky: 0, spawnT: 0.4, frozen: 0, letter: 0, shield: false, phases: [], slamT: 4, spitT: 6, hidden: false, engaged: true, stolen: new Set(), rwT: 10, hist: [], histT: 0, angryT: 999, retreatT: 0, hasteT: 0, pauseT: 0, fuse: 0, revived: 0, lurk: false, home: { x, y }, chargeT: 3 + R() * 3 });
    mons.push(m); return m;
  }
  return null;
}
let runSpawnT = 0;
function updateRun(dt) {
  if (run?.over && run.leave) { run.leaveT -= dt; if (run.leaveT <= 0) { const f = run.leave; run.leave = null; f(); } return; }
  if (!run || run.over || cardOpen) return;
  run.t += dt;
  const wv = wave(run.t), st = run.st, alive0 = mons.filter((m) => m.dead <= 0).length;
  runSpawnT -= dt;
  if (runSpawnT <= 0 && run.t < BOSS_AT + 60) {
    runSpawnT = wv.every;
    const pool = wavePool(st, run.t);
    for (let i = 0; i < wv.pack && alive0 + i < wv.cap * run.mods.count; i++) runSpawnOne(pool[Math.floor(R() * pool.length)]);
  }
  for (const at of ELITE_AT) if (run.t >= at && !run.eliteDone.includes(at)) {
    run.eliteDone.push(at);
    const pool = wavePool(st, run.t), id = pool[pool.length - 1];
    const m = runSpawnOne(id, { hpK: 10, d: { elite: 'giant', name: `小王・${MONSTERS[id].name}`, exp: MONSTERS[id].exp * 15 } });
    if (m) banner(`小王「${m.d.name}」出現了！`);
  }
  if (run.t >= BOSS_AT && !run.bossOut) {
    run.bossOut = true;
    const base = MONSTERS[st.mvp], m = runSpawnOne(st.mvp, { d: { hp: Math.round(base.hp * 0.25 * run.mods.hp), boss: true, sight: 30 } });
    if (m) { run.bossRef = m; banner(`${m.d.name}　登場！`); shake = 0.5; sfx('boss'); }
  }
  // 局內寶箱
  run.chestT -= dt;
  if (run.chestT <= 0 && !run.chest) { run.chestT = CHEST_EVERY; spawnRunChest(); }
  if (run.chest) { run.chest.life -= dt; if (run.chest.life <= 0) run.chest = null; else if (Math.max(Math.abs(run.chest.x - me.x), Math.abs(run.chest.y - me.y)) <= 1) openRunChest(); }
  if (mons.length > 140) mons = mons.filter((m) => m.dead <= 0 || (m.deadAt != null && anim - m.deadAt < 1));
  // 自動普攻＋自動施放（局內不耗魔力）；連燈加護多放一次
  if (!dialog && pst.sleep <= 0) {
    const tgt = nearest(Math.max(1.6, C.range + 0.5));
    if (tgt && me.cool <= 0) { faceToward(tgt); face8(me, Math.sign(tgt.x - me.x), Math.sign(tgt.y - me.y)); basicAttack(tgt); }
    if (alive().some((m) => tdist(m, me.px, me.py) <= 5)) skills.forEach((x, i) => {
      if (x.t > 0 || cutinT > 0) return;
      P.mp = stats(P).mpMax; castIdx(i);
      if (run.bless[x.id] === 'twin') pending.push({ t: 0.25, fn: () => { if (!run || run.over) return; const keep = x.t; x.t = 0; P.mp = stats(P).mpMax; castIdx(i); x.t = keep; } });
    });
  }
  if (run.bossDown && (run.bossDownT -= dt) <= 0) endRun(true);
  if (run.t >= RUN_LEN && !run.over) endRun(false, true);
  if (run.t % 1 < dt) updateRunHud();
}
function spawnRunChest() {
  for (let k = 0; k < 30; k++) {
    const a = R() * Math.PI * 2, r = 4 + R() * 3, x = Math.round(me.x + Math.cos(a) * r), y = Math.round(me.y + Math.sin(a) * r * 0.8);
    if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1 || !walkable(grid, x, y) || occupied(x, y)) continue;
    run.chest = { x, y, life: 45, cost: chestCost(run.st, run.chests) };
    feed(`附近出現寶箱！走過去花 ${fmt(run.chest.cost)} 金幣打開`, '#ffd166'); return;
  }
}
function openRunChest() {
  const c = run.chest; if (!c || cardOpen) return;
  if (run.items.length >= ITEM_SLOTS) { run.chest = null; P.coins += c.cost; floatT('道具欄滿了，換成金幣', me.x, me.y - 0.8, '#ffd166', 1); return; }
  if (P.coins < c.cost) { if (!c.warned) { c.warned = 1; floatT(`金幣不夠（要 ${fmt(c.cost)}）`, me.x, me.y - 0.8, '#ff8fa0', 1); } return; }
  P.coins -= c.cost; run.chest = null; run.chests++;
  const ids = rollItems(run, R); if (!ids.length) return;
  showPick('打開寶箱！選一件本局道具', ids.map((id) => ({ kind: 'item', id })));
}
// 三選一畫面（升級卡、寶箱道具共用）
function showPick(title, cs) {
  cardOpen = true; sfx('levelup');
  $('runCardsTitle').textContent = title;
  $('runCardList').replaceChildren(...cs.map((c) => {
    const t = c.kind === 'item' ? { title: RUN_ITEMS[c.id].name, sub: '本局道具', desc: RUN_ITEMS[c.id].desc } : cardText(c);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'runcard rc-' + c.kind;
    const icon = (c.kind === 'skill' || c.kind === 'bless') && asset('ui/skill_' + c.id);
    b.innerHTML = `${icon ? `<img src="${icon.src}" alt="">` : '<i></i>'}<span><small>${t.sub}</small><b>${t.title}</b><em>${t.desc}</em></span>`;
    b.addEventListener('click', () => {
      if (c.kind === 'item') run.items.push(c.id); else { applyCard(run, c); run.pending--; if (c.kind === 'heal') P.hp = stats(P).hp; }
      P.runMods = runMods(run); setupRunSkills(); hud();
      cardOpen = false; $('runCards').hidden = true; updateRunHud();
      if (run.pending > 0) setTimeout(openCards, 120);
    });
    return b;
  }));
  $('runCards').hidden = false;
}
function openCards() {
  if (!run || cardOpen || run.pending <= 0 || run.over) return;
  P.hp = Math.min(stats(P).hp, P.hp + stats(P).hp * 0.2); // 升級回 20% 血
  showPick(`升到 Lv ${run.lv - run.pending + 1}！選一張`, rollCards(run, P, R));
}
function runKill(m) {
  if (!run || !m.d.runMon || run.over) return;
  run.kills++;
  { const g = newDrop('gem', cx(m), cy(m), gemValue(m.d, run.t)); g.vx *= 0.15; g.vy *= 0.15; g.vz *= 0.5; drops.push(g); }
  if (!m.d.boss && !m.d.elite && run.gear < GEAR_CAP && R() < gearChance(run.diff)) {
    const it = rollGear(R, Math.max(1, m.d.lv), false, P.cls, run.mods.luck);
    if (!P.autoSell.equip[it.rarity]) { drops.push(newDrop('gear', cx(m), cy(m), it)); run.gear++; } else P.coins += gearSell(it);
  }
  if (m.d.elite) for (let i = 0; i < 2; i++) drops.push(newDrop('gear', cx(m), cy(m), rollGear(R, m.d.lv, R() < 0.5, P.cls, run.mods.luck)));
  if (m === run.bossRef) { run.bossDown = true; run.bossDownT = 1.2; for (let i = 0; i < 4; i++) drops.push(newDrop('gear', cx(m), cy(m), rollGear(R, m.d.lv, true, P.cls, run.mods.luck))); }
}
function collectGem(v) { if (!run) return; if (gainRunExp(run, v)) { P.runMods = runMods(run); openCards(); } updateRunHud(); }
function updateRunHud() {
  const el = $('runHud'); el.hidden = !run;
  const q = document.querySelector('.quest'); if (q) q.hidden = !!run;
  if (!run) return;
  const left = Math.max(0, RUN_LEN - run.t), mm = Math.floor(left / 60), ss = String(Math.floor(left % 60)).padStart(2, '0');
  $('runTime').textContent = `${mm}:${ss}`;
  $('runLv').textContent = `局內 Lv ${run.lv}`;
  $('runKills').textContent = `擊殺 ${run.kills}・裝備 ${run.gear}・道具 ${run.items.length}/${ITEM_SLOTS}`;
  $('runExp').style.width = `${Math.min(100, (run.exp / runExpNeed(run.lv)) * 100)}%`;
}
function endRun(cleared, timeUp = false) {
  if (!run || run.over) return;
  run.over = true; run.cleared = cleared; cardOpen = false; $('runCards').hidden = true;
  const st = run.st, d = run.diff, first = cleared ? clearStage(P, st, d) : false, r = stageReward(P, run);
  P.coins += r.coins;
  for (let i = 0; i < r.gear; i++) pickupGear(P, rollGear(R, st.lvHi, true, P.cls, run.mods.luck));
  const sid = SOUL_OF_CH[Math.min(6, st.ch)]; if (r.shards && sid) addShards(P, sid, r.shards);
  if (cleared && st.ch === Math.min(6, P.ch - 1) && P.step === 2) P.step = 3;
  const min = Math.floor(run.t / 60), sec = Math.floor(run.t % 60);
  const lines = [cleared ? `通關！打倒了${MONSTERS[st.mvp].name}（${st.name}・難度 ${d}）${first ? '・首次通關' : ''}` : timeUp ? '時間到，長夜吞沒了這片土地……' : '倒下了……燈火把你送回了守燈村。撿到的裝備都還在。',
    `存活 ${min} 分 ${sec} 秒・局內 Lv ${run.lv}・擊殺 ${run.kills}・撿到裝備 ${run.gear} 件`,
    `結算：金幣 ${fmt(r.coins)}${r.gear ? `、獎勵裝備 ${r.gear} 件` : ''}${r.shards && sid ? `、${SOULS[sid].name}碎片 ×${r.shards}` : ''}`,
    ...(cleared && d < DIFF_MAX && maxDiff(P, st) > d ? [`這張地圖的刷關難度 ${d + 1} 開放了。`] : [])];
  const again = st.id;
  run.leaveT = 1; run.leave = () => { leaveRun(); say('遠征', lines, [['再打一次', () => startRun(again, d)], ...(cleared && maxDiff(P, st) > d ? [[`挑戰難度 ${d + 1}`, () => startRun(again, d + 1)]] : []), ['選別的地圖', openExped], ['回守燈村', null]]); };
  questDone(track(P, 'tower')); save();
}
function leaveRun() { run = null; delete P.runMods; cardOpen = false; $('runCards').hidden = true; setupClass(); loadMap(0, SPAWN); P.hp = stats(P).hp; updateRunHud(); hud(); save(); }
function drawRunChest() {
  const c = run?.chest; if (!c) return;
  const X = c.x * TS, Y = c.y * TS;
  ctx.globalAlpha = 0.4 + Math.sin(anim * 5) * 0.2; ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.ellipse(X + 8, Y + 13, 10, 4, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  ctx.fillStyle = '#2a1d2e'; ctx.fillRect(X + 1, Y + 4, 14, 10); ctx.fillStyle = '#8a5cff'; ctx.fillRect(X + 2, Y + 7, 12, 6); ctx.fillStyle = '#c9a7ff'; ctx.fillRect(X + 2, Y + 5, 12, 2); ctx.fillStyle = '#ffd166'; ctx.fillRect(X + 7, Y + 6, 2, 4);
}
// 一鍵穿裝：每個部位換上最強的
function equipBest() {
  let n = 0;
  for (const slot of SLOTS) {
    const best = P.bag.gear.filter((it) => it.slot === slot).sort((a, b) => itemPower(b) - itemPower(a))[0];
    if (best && (!P.gear[slot] || itemPower(best) > itemPower(P.gear[slot]))) { equipFromBag(P, best.uid); n++; }
  }
  return n;
}
// ---- 遠征面板 ----
function openExped() {
  if (dialog) { dialog = null; showDialog(); }
  const st0 = stageById(expSel); if (st0 && stageLock(P, st0)) expSel = [...STAGES].reverse().find((s) => !stageLock(P, s))?.id || '1';
  renderExped(); $('expPanel').hidden = false;
}
function renderExped() {
  const e = ensureExped(P), gs = gearScore(P);
  $('expGs').textContent = `裝備分數 ${fmt(gs)}`;
  $('expList').replaceChildren(...STAGES.map((st) => {
    const lock = stageLock(P, st), b = document.createElement('button'); b.type = 'button';
    b.className = `expstage${st.id === expSel ? ' on' : ''}${lock ? ' locked' : ''}${e.cleared[st.id] ? ' done' : ''}`;
    b.innerHTML = `<b>${st.name}</b><span>Lv ${st.lvLo}～${st.lvHi}・魔王 ${MONSTERS[st.mvp].name}</span><em>${lock || (e.cleared[st.id] ? `已通關・最高難度 ${e.cleared[st.id]}` : '可挑戰')}</em>`;
    b.addEventListener('click', () => { expSel = st.id; renderExped(); });
    return b;
  }));
  const st = stageById(expSel), lock = stageLock(P, st), md = maxDiff(P, st);
  expDiff = Math.max(1, Math.min(expDiff, md));
  const m = diffMods(expDiff);
  $('expDiff').max = md; $('expDiff').value = expDiff;
  $('expInfo').innerHTML = `<b>${st.name}</b>　刷關難度 <b>${expDiff}</b> / ${md}<br>怪物血量 ×${m.hp.toFixed(1)}・傷害 ×${m.atk.toFixed(2)}・數量 ×${m.count.toFixed(2)}・裝備掉落 ×${m.drop.toFixed(2)}・稀有以上 ×${m.luck.toFixed(1)}<br>技能欄 ${skillSlots(P)} 格・裝備門檻 ${gateOf(st)}・會撿：${['common', 'good', 'rare', 'epic', 'legend'].filter((r) => !P.autoSell.equip[r]).map((r) => rarityOf(r).name).join('、') || '全部不撿'}`;
  $('expGo').disabled = !!lock; $('expGo').textContent = lock || '出發！';
}

// ---------- 深夜：燈火 ----------
// 深夜地圖一片黑，只有自己身邊和點亮的路燈看得見。站在路燈旁 2 秒就能點亮；燈光裡攻擊 +20%。
// 深夜魔王會「吞光」把附近的燈吹熄；你不在燈光裡時，魔王只受一半傷害。
let lamps = [];
const LAMP_R = 4, SELF_R = 2.4, LIGHT_BONUS = 0.2;
function placeLamps() {
  lamps = [];
  if (!nightMode) return;
  const reach = reachable(grid, FIELD.spawn), seg = (W - 2 - FMIN) / 6;
  for (let i = 0; i < 6; i++) {
    const cand = [];
    for (let y = 2; y < H - 2; y++) for (let x = Math.floor(FMIN + seg * i); x < Math.floor(FMIN + seg * (i + 1)); x++) if (walkable(grid, x, y) && reach.has(`${x},${y}`) && grid[y][x] !== T.PORTAL && !inBoss(x, y)) cand.push([x, y]);
    if (cand.length) { const [x, y] = cand[Math.floor(R() * cand.length)]; lamps.push({ x, y, lit: i === 0, prog: 0 }); }
  }
}
const inLight = () => lamps.some((l) => l.lit && Math.hypot(l.x - me.px, l.y - me.py) <= LAMP_R);
function updateLamps(dt) {
  if (!nightMode) return;
  for (const l of lamps) {
    if (l.lit) continue;
    if (Math.abs(l.x - me.x) + Math.abs(l.y - me.y) <= 1 && !me.moving) {
      l.prog += dt;
      if (l.prog >= 2) { l.lit = true; l.prog = 0; sfx('reward'); burst(l.x * TS + 8, l.y * TS + 2, '#ffd166', 18, 90); addFx('pillar', 0.6, { x: l.x * TS + 8, y: l.y * TS + 8, color: '#ffd166' }); floatT('點亮了路燈', me.x, me.y - 0.8, '#ffd166', 0.9); }
    } else l.prog = Math.max(0, l.prog - dt);
  }
  // 深夜魔王：吞光
  const b = mons.find((m) => m.d.boss && m.night && m.dead <= 0 && m.engaged);
  if (!b) return;
  b.eatT = (b.eatT ?? 12) - dt;
  if (b.eatT <= 0) {
    b.eatT = 15; b.castAt = anim;
    let n = 0;
    for (const l of lamps) if (l.lit && Math.hypot(l.x - b.px, l.y - b.py) <= 8) { l.lit = false; n++; burst(l.x * TS + 8, l.y * TS + 2, '#3b3350', 14, 70); }
    banner(n ? `${b.d.name}吞掉了 ${n} 盞燈！` : `${b.d.name}想吞光，但附近沒有燈`); tintC = '#120c1c'; tintT = 0.5;
  }
}
function drawLamps() {
  for (const l of lamps) {
    const X = l.x * TS, Y = l.y * TS;
    ctx.fillStyle = '#2a1d2e'; ctx.fillRect(X + 7, Y - 6, 2, 20); ctx.fillRect(X + 4, Y + 13, 8, 2);
    ctx.fillStyle = l.lit ? '#ffd166' : '#4b3a6b'; ctx.fillRect(X + 5, Y - 10, 6, 5);
    ctx.fillStyle = '#2a1d2e'; ctx.fillRect(X + 4, Y - 11, 8, 1); ctx.fillRect(X + 4, Y - 5, 8, 1);
    if (l.lit && R() < 0.15) parts.push({ x: X + 8, y: Y - 8, vx: (R() - 0.5) * 6, vy: -12, c: '#fff1a8', t: 0, g: 0, size: 1, life: 0.6 });
    if (!l.lit && l.prog > 0) { ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X + 8, Y - 8, 7, -Math.PI / 2, -Math.PI / 2 + (l.prog / 2) * Math.PI * 2); ctx.stroke(); }
  }
}
let darkC = null;
function drawNightDark(camX, camY) {
  if (!darkC || darkC.width !== Math.ceil(VW) || darkC.height !== Math.ceil(VH)) { darkC = document.createElement('canvas'); darkC.width = Math.ceil(VW); darkC.height = Math.ceil(VH); }
  const d = darkC.getContext('2d');
  d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, darkC.width, darkC.height);
  d.fillStyle = 'rgba(10,6,30,.82)'; d.fillRect(0, 0, darkC.width, darkC.height);
  d.globalCompositeOperation = 'destination-out';
  const hole = (wx, wy, r) => { const x = wx - camX, y = wy - camY, g = d.createRadialGradient(x, y, r * 0.35, x, y, r); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = g; d.beginPath(); d.arc(x, y, r, 0, 7); d.fill(); };
  hole(cx(me), cy(me), SELF_R * TS * (pst.blind > 0 ? 0.6 : 1));
  for (const l of lamps) if (l.lit) hole(l.x * TS + 8, l.y * TS, LAMP_R * TS + Math.sin(anim * 3 + l.x) * 2);
  for (const p of projs) hole(p.x, p.y, 10);
  ctx.drawImage(darkC, 0, 0);
  if (lamps.length) { ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#ffd166'; ctx.fillText(`路燈 ${lamps.filter((l) => l.lit).length}/${lamps.length}${inLight() ? '・燈光中 攻擊+20%' : ''}`, 4, VH - 4); }
}

// ---------- 怪物專屬特性（照圖鑑「特性」欄）與玩家異常狀態 ----------
const pst = { slow: 0, root: 0, sleep: 0, deep: 0, silence: 0, hitDown: 0, aspdDown: 0, blind: 0, weak: 0 };
const PST_NAME = { slow: '減速', root: '定身', sleep: '睡著了', silence: '沉默', hitDown: '命中降低', aspdDown: '攻速降低', blind: '視野變小', weak: '詛咒' };
function addPst(k, t, quiet) {
  if (me.inv > 0) return;
  if (!quiet && pst[k] <= 0) floatT(PST_NAME[k], me.x, me.y - 0.8, '#d0a8ff', 0.9);
  pst[k] = Math.max(pst[k], t);
}
const stuck = () => pst.root > 0 || pst.sleep > 0;
function playerDot(m, color, ticks = 3) {
  if (me.inv > 0) return;
  for (let i = 1; i <= ticks; i++) pending.push({ t: i, fn: () => { if (P.hp > 1) { const d = Math.max(1, Math.round(m.d.atk * 0.12)); P.hp = Math.max(1, P.hp - d); floatT(`-${d}`, me.x, me.y, color, 0.7); hud(); } } });
}
let zones = [];
const mdist = (m) => Math.abs(m.x - me.x) + Math.abs(m.y - me.y);
const front = (m, c) => (c.fromX < m.px) === !!m.faceL;
function spawnClone(m, frac) {
  const x = m.x, y = m.y, d = { ...m.d, hp: Math.max(1, Math.round(m.d.hp * frac)), exp: 0, coin: [0, 0] };
  const o = { type: m.type, d, night: m.night, minion: true, anim: R() * 2, x, y, px: x, py: y, fx: x, fy: y, moving: false, mt: 0, hp: d.hp, dead: 0, cool: 1, think: 0.3, flash: 0, kx: 0, ky: 0, spawnT: 0.3, frozen: 0, letter: 0, angryT: 10, chargeT: 5, phases: [], hist: [] };
  mons.push(o); burst(cx(m), cy(m), m.d.pal.l || '#fff', 8, 60);
  return o;
}
function stripBuff() {
  const ks = Object.keys(P.tb || {}).filter((k) => P.tb[k].until > Date.now());
  if (!ks.length) return;
  delete P.tb[ks[Math.floor(R() * ks.length)]]; floatT('增益被解除', me.x, me.y - 0.8, '#ff8fa0', 0.9);
}
const WHISPER = ['……我以前是誰的守護？', '……燈還亮著嗎？', '……我還記得他的手很溫暖。'];
const NAMES = ['……我叫露西。', '……我是磨坊的湯姆。', '……原來我叫阿禾。', '……我想起來了，我叫米拉。'];
const TR = {
  dandelion: { death: (m) => mdist(m) <= 2 && addPst('slow', 1) },
  mouse: { tick: (m) => { if (R() > 0.05) return; const i = drops.findIndex((d) => d.kind === 'loot' && Math.hypot(d.x - cx(m), d.y - cy(m)) < 28); if (i >= 0) { (m.loot ??= []).push(drops[i]); drops.splice(i, 1); float('偷走了！', cx(m), m.py * TS - 10, '#ffd166', 0.8); } },
    death: (m) => { for (const d of m.loot || []) drops.push(newDrop('loot', cx(m), cy(m), d.val)); m.loot = []; } },
  beetle: { dmg: (m, c) => (front(m, c) ? 0.7 : 1) },
  mushroom: { hurt: (m) => mdist(m) <= 2 && R() < 0.15 && addPst('sleep', 1) },
  foxfire: { tick: (m, d) => { if (m.angryT > 0 && d >= 3 && R() < 0.02) { const k = Math.min(2, d - 1), sx = Math.sign(me.x - m.x), sy = Math.sign(me.y - m.y); const nx = m.x + (Math.abs(me.x - m.x) >= Math.abs(me.y - m.y) ? sx * k : 0), ny = m.y + (Math.abs(me.x - m.x) < Math.abs(me.y - m.y) ? sy * k : 0); if (monCanGo(m, nx, ny)) { burst(cx(m), cy(m), '#ff9f40', 8, 60); Object.assign(m, { x: nx, y: ny, px: nx, py: ny, fx: nx, fy: ny }); } } } },
  lizard: { lurk: 3 }, croc: { lurk: 2 }, mask: { lurk: 2 },
  dust: { hit: () => addPst('hitDown', 3) }, soot: { hit: () => addPst('hitDown', 3) },
  octopus: { hit: () => { addPst('hitDown', 3); addPst('blind', 3, true); } },
  hawk: { hit: (m) => { m.retreatT = 1.2; } },
  letter: { hurt: (m) => mdist(m) <= 3 && R() < 0.2 && addPst('silence', 1) },
  echoling: { hurt: (m, c) => { if (c.kind === 'skill' && c.elem !== '無' && m.copied !== c.elem) { m.copied = c.elem; float(`複製了${c.elem}屬性`, cx(m), m.py * TS - 12, ELEM_COLOR[c.elem], 0.8); } }, dmg: (m, c) => (c.elem === m.copied ? 0.5 : 1) },
  bandit: { hit: (m) => { const n = Math.min(P.coins, m.d.lv * 5); if (n > 0) { P.coins -= n; m.coins = (m.coins || 0) + n; floatT(`金幣 -${n}`, me.x, me.y - 0.8, '#ffd166', 0.9); hud(); } },
    death: (m) => { if (m.coins) { drops.push(newDrop('coin', cx(m), cy(m), m.coins)); m.coins = 0; } } },
  oilslime: { death: (m) => zones.push({ x: m.px, y: m.py, r: 0.9, t: 5, kind: 'oil' }) },
  rat: { hit: stripBuff }, gull: { hit: stripBuff },
  screw: { hit: () => R() < 0.25 && addPst('root', 0.5) },
  cog: { hurt: (m, c) => { if (c.elem === '風') m.hasteT = 5; } },
  sparkbug: { tick: (m, d) => { if (m.angryT > 0 && d <= 1 && !m.fuse) { m.fuse = 1; warns.push({ x: m.px, y: m.py, r: 1.3, t: 0, life: 0.8, dmg: Math.round(m.d.atk * 2.2), kind: 'slam' }); pending.push({ t: 0.8, fn: () => { if (m.dead <= 0) { burst(cx(m), cy(m), '#ffb347', 16, 120); m.dead = m.minion ? 1 : 2.5; m.fuse = 0; } } }); } } },
  clockbird: { tick: (m, d, dt) => { m.wind = (m.wind || 0) + dt; if (m.wind > 6) { m.pauseT = 2; m.wind = 0; float('停住了！', cx(m), m.py * TS - 10, '#ffd166', 0.8); } }, dmg: (m) => (m.pauseT > 0 ? 1.5 : 1) },
  doll: { hitK: (m) => ((m.atkN = (m.atkN || 0) + 1) % 3 === 0 ? 2 : 1) },
  rustknight: { dmg: (m, c) => { if (front(m, c) && R() < 0.3) { float('格擋', cx(m), m.py * TS - 10, '#bdf1ff', 0.8); return 0.3; } return 1; } },
  smelter: { tick: (m, d, dt) => { if (d > 1 || me.inv > 0) return; m.auraT = (m.auraT || 0) + dt; if (m.auraT >= 1) { m.auraT = 0; hurt(m.d.atk * 0.1, null); } } },
  wisp: { tick: (m, d, dt) => { if (d <= 2 && P.mp > 0) P.mp = Math.max(0, P.mp - stats(P).mpMax * 0.03 * dt); } },
  lily: { tick: (m, d) => d <= 2 && addPst('aspdDown', 0.5, true) },
  butterfly: { hurt: (m) => { if (!m.minion && !m.split && m.hp > 0 && R() < 0.15) { m.split = 1; spawnClone(m, 0.3); float('鏡像！', cx(m), m.py * TS - 12, '#c8ecff', 0.8); } } },
  bat2: { hit: (m) => { m.hp = Math.min(m.d.hp, m.hp + Math.round(m.d.atk * 0.3)); } },
  rose: { hurt: (m, c) => c.kind === 'basic' && C.range <= 1 && playerDot(m, '#a66bd6', 2) },
  snake: { hit: () => R() < 0.2 && addPst('root', 1) },
  reflect: { dmg: (m, c) => { if (c.magic && c.kind === 'skill' && R() < 0.3) { float('反射', cx(m), m.py * TS - 10, '#c8ecff', 0.9); hurt(m.d.atk * 1.2, null); return 0; } return 1; } },
  dancer: { dmg: (m) => { if (R() < 0.25) { float('Miss', cx(m), m.py * TS - 6, '#bdb6d0', 0.9); return 0; } return 1; } },
  armor: { dmg: (m, c) => (c.magic ? 1 : 0.75) }, obsidian: { dmg: (m, c) => (c.magic ? 0.7 : 1) },
  gargoyle: { tick: (m) => { if (nightMode) m.angryT = Math.max(m.angryT, 1); } },
  deer: { hit: () => R() < 0.15 && addPst('root', 1) },
  crab: { dmg: (m, c) => (Math.abs(c.fromY - m.py) > Math.abs(c.fromX - m.px) ? 1.3 : 1) },
  mist: { tick: (m, d) => d <= 3 && addPst('blind', 0.5, true) },
  cat: { hurt: (m) => { for (const o of mons) if (o !== m && o.type === 'cat' && o.dead <= 0 && Math.abs(o.x - m.x) + Math.abs(o.y - m.y) <= 6) o.angryT = 10; } },
  lantern: { hitK: (m) => (m.hp < m.d.hp * 0.5 ? 1.5 : 1) },
  dice: { hitK: () => 0.5 + R() * 1.5 },
  barrel: { hurt: (m, c) => { if (c.elem === '火' && m.hp > 0) { warns.push({ x: m.px, y: m.py, r: 1.6, t: 0.5, life: 0.6, dmg: Math.round(m.d.atk * 2.5), kind: 'slam' }); m.hp = 0; killMon(m); } } },
  coral: { tick: (m, d, dt) => { m.healT = (m.healT || 0) + dt; if (m.healT < 2) return; m.healT = 0; for (const o of mons) if (o.dead <= 0 && o.hp < o.d.hp && profileOf(o.type).race === '魚貝' && Math.abs(o.x - m.x) + Math.abs(o.y - m.y) <= 3) o.hp = Math.min(o.d.hp, o.hp + Math.round(o.d.hp * 0.03)); } },
  drowned: { hit: () => addPst('slow', 2) },
  shark: { tick: (m) => { if (P.hp < stats(P).hp * 0.5) m.hasteT = 0.5; } },
  relic: { tick: (m, d, dt) => { if (d <= 2 && R() < dt * 0.25) float(WHISPER[Math.floor(R() * WHISPER.length)], cx(m), m.py * TS - 14, '#c8c4e8', 0.8); } },
  eclipse: { death: (m) => { if (!m.minion) { spawnClone(m, 0.25); spawnClone(m, 0.25); } } },
  priest2: { tick: (m, d, dt) => { m.healT = (m.healT || 0) + dt; if (m.healT < 4) return; m.healT = 0; for (const o of mons) if (o !== m && o.dead <= 0 && o.hp < o.d.hp && Math.abs(o.x - m.x) + Math.abs(o.y - m.y) <= 3) { o.hp = Math.min(o.d.hp, o.hp + Math.round(o.d.hp * 0.08)); float('+', cx(o), o.py * TS - 4, '#a6ec7a', 0.7); } }, hit: () => addPst('weak', 4) },
  shade: { dmg: (m) => { if (mdist(m) > 3) { if (R() < 0.3) float('看不見', cx(m), m.py * TS - 8, '#8f7ab8', 0.8); return 0; } return 1; } },
  nightmare: { hit: () => { if (R() < 0.2) { addPst('sleep', 2); pst.deep = 2; } } },
  nameless: { death: (m) => R() < 0.2 && float(NAMES[Math.floor(R() * NAMES.length)], cx(m), m.py * TS - 14, '#fff1c4', 1) },
  angel: { hitK: () => (stats(P).weaponElem === '暗' ? 2 : 1) },
  guard: { tick: (m) => { if (m.home && Math.abs(m.x - m.home.x) + Math.abs(m.y - m.home.y) > 6 && !m.moving) { Object.assign(m, { x: m.home.x, y: m.home.y, px: m.home.x, py: m.home.y, fx: m.home.x, fy: m.home.y, hp: m.d.hp, angryT: 0 }); float('回到祭壇', cx(m), m.py * TS - 10, '#fff1c4', 0.8); } } },
  gryphon: { dmg: (m, c) => { if (c.kind === 'basic' && C.range <= 1 && R() < 0.3) { float('Miss', cx(m), m.py * TS - 6, '#bdb6d0', 0.9); return 0; } return 1; } },
  ashdrake: { hit: (m) => playerDot(m, '#ff9f40') },
  bonedrake: { death: (m) => { if (m.revived || m.minion) return; pending.push({ t: 0, fn: () => { m.dead = 6; } }); pending.push({ t: 5, fn: () => { if (m.dead > 0 && !m.revived) { m.revived = 1; m.dead = 0; m.hp = Math.round(m.d.hp * 0.5); m.spawnT = 0.4; burst(cx(m), cy(m), '#7affc4', 20, 100); banner(`${m.d.name}站起來了！`); } } }); } },
};
// 修道信徒：附近有信徒時同伴受到的傷害 −20%
const cultistNear = (m) => m.type !== 'cultist' && mons.some((o) => o.type === 'cultist' && o.dead <= 0 && Math.abs(o.x - m.x) + Math.abs(o.y - m.y) <= 3);
function traitDmg(m, c) {
  let k = TR[m.type]?.dmg?.(m, c) ?? 1;
  if (k && cultistNear(m)) k *= 0.8;
  if (k && pst.weak > 0) k *= 0.8;
  if (k && nightMode) { const lit = inLight(); if (lit) k *= 1 + LIGHT_BONUS; else if (m.d.boss && m.night) { k *= 0.5; if (R() < 0.15) float('黑暗護身', cx(m), m.py * TS - 14, '#8f7ab8', 0.8); } }
  return k;
}
function traitTick(m, dt) {
  const t = TR[m.type]; if (!t) return false;
  if (m.pauseT > 0) { m.pauseT -= dt; return true; }
  if (m.retreatT > 0) m.retreatT -= dt;
  if (m.hasteT > 0) m.hasteT -= dt;
  const d = mdist(m);
  if (m.lurk) { if (d <= t.lurk) { m.lurk = false; m.hidden = false; m.angryT = 10; burst(cx(m), cy(m), '#e8d29a', 14, 90); float('！', cx(m), m.py * TS - 12, '#ffd166', 1); } else return true; }
  t.tick?.(m, d, dt);
  return false;
}
function updatePst(dt) {
  for (const k of Object.keys(pst)) pst[k] = Math.max(0, pst[k] - dt);
  zones = zones.filter((z) => { z.t -= dt; if (Math.hypot(me.px - z.x, me.py - z.y) <= z.r) addPst('slow', 0.3, true); return z.t > 0; });
}
function drawZones() {
  for (const z of zones) { ctx.globalAlpha = Math.min(0.6, z.t / 2); ctx.fillStyle = '#1b1420'; ctx.beginPath(); ctx.ellipse(z.x * TS + 8, z.y * TS + 12, z.r * 16, z.r * 8, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
}
function drawPst() {
  if (pst.blind > 0) { const g = ctx.createRadialGradient(cx(me), cy(me), 30, cx(me), cy(me), 130); g.addColorStop(0, 'rgba(20,16,30,0)'); g.addColorStop(1, 'rgba(20,16,30,.85)'); ctx.fillStyle = g; ctx.fillRect(cx(me) - 600, cy(me) - 600, 1200, 1200); }
  const on = Object.keys(PST_NAME).filter((k) => pst[k] > 0 && k !== 'blind');
  if (!on.length) return;
  ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#1b1420'; ctx.fillStyle = '#d0a8ff';
  const tx = on.map((k) => PST_NAME[k]).join('・') + (pst.sleep > 0 ? ' z' : ''), y = me.py * TS - 24;
  ctx.strokeText(tx, cx(me), y); ctx.fillText(tx, cx(me), y);
}
// 怪物的遠程攻擊（遠程怪吐、射；法術怪施法）
let eshots = [];
function monShoot(m, tg) {
  const B = m.d.beh, x = cx(m), y = cy(m) - 4, tx = cx(tg), ty = cy(tg) - 4, d = Math.hypot(tx - x, ty - y) || 1, sp = B.caster ? 70 : 95;
  eshots.push({ x, y, vx: (tx - x) / d * sp, vy: (ty - y) / d * sp, t: 0, m, k: B.caster ? 1.3 : 1, c: ELEM_COLOR[profileOf(m.night ? m.type + '_n' : m.type).elem] || '#ffd166', big: B.caster });
  m.swingAt = anim; m.faceL = tg.px < m.px;
}
function updateEshots(dt) {
  eshots = eshots.filter((e) => {
    e.t += dt; e.x += e.vx * dt; e.y += e.vy * dt;
    if (R() < 0.5) parts.push({ x: e.x, y: e.y, vx: 0, vy: 0, c: e.c, t: 0, g: 0, size: 1, life: 0.25 });
    if (Math.hypot(e.x - cx(me), e.y - (cy(me) - 4)) < 7) { if (e.m.dead <= 0) hitPlayer(e.m, e.k); burst(e.x, e.y, e.c, 6, 60); return false; }
    const tx = Math.floor(e.x / TS), ty = Math.floor(e.y / TS);
    if (e.t > 0.15 && !walkable(grid, tx, ty) && grid[ty]?.[tx] !== T.WATER) return false;
    return e.t < 2.2;
  });
}
function drawEshots() {
  for (const e of eshots) { ctx.fillStyle = '#2a1d2e'; ctx.beginPath(); ctx.arc(e.x, e.y, e.big ? 4 : 3, 0, 7); ctx.fill(); ctx.fillStyle = e.c; ctx.beginPath(); ctx.arc(e.x, e.y, e.big ? 3 : 2, 0, 7); ctx.fill(); }
}
// 被打：被動怪生氣、群聚怪叫同伴、濺水幫同伴回血
function monProvoked(m) {
  const B = m.d.beh || {};
  m.angryT = 10;
  for (const o of mons) {
    if (o === m || o.dead > 0 || o.d.boss) continue;
    const d = Math.abs(o.x - m.x) + Math.abs(o.y - m.y);
    if (B.link && o.type === m.type && d <= 5) o.angryT = 10;
    if (B.splashHeal && d <= 2 && o.hp < o.d.hp) { o.hp = Math.min(o.d.hp, o.hp + Math.round(o.d.hp * 0.04)); if (R() < 0.3) float('+', cx(o), o.py * TS - 4, '#7fd8ff', 0.7); }
  }
}
function hurt(raw, m) {
  if (pst.sleep > 0 && me.inv <= 0) { if (pst.deep > 0) raw *= 2; pst.sleep = 0; pst.deep = 0; }
  if (me.inv > 0) { floatT('閃避！', me.x, me.y - 0.4, '#bdf1ff', 0.9); return; }
  if (m) {
    const st0 = stats(P);
    if (R() < dodgeChance(st0.flee, m.d.lv, st0.perfect)) { floatT('Miss', me.x, me.y - 0.4, '#bdf1ff', 0.9); return; }
    raw *= 1 - Math.min(60, st0.mods.resist[profileOf(m.type).elem] || 0) / 100;
  }
  if (fishing) { fishing = null; floatT('魚跑了', me.x, me.y - 0.5, '#bdf1ff'); }
  const dmg = Math.max(1, Math.round(raw * (1 - stats(P).dr)));
  P.hp -= dmg; me.hurtT = 0.4; shake = Math.max(shake, 0.12);
  floatT(`-${dmg}`, me.x, me.y, '#ff5a6e'); sfx('hurt');
  if (P.hp <= 0 && P.soul === 'cat' && P.souls.cat && catT <= 0) {
    catT = 180; P.hp = Math.round(stats(P).hp * 0.5); me.inv = 1.2;
    banner('九命發動！'); burst(cx(me), cy(me), '#ffe066', 24, 120); hud(); return;
  }
  if (P.hp <= 0 && run && !run.over) { P.hp = 1; me.inv = 9; endRun(false); return; }
  if (P.hp <= 0) {
    deathN++;
    P.hp = stats(P).hp;
    for (const al of allies) { al.down = 0; al.hp = al.max; }
    if (mapId !== 0 && !trial) {
      // 舒壓：不送回村子、不扣東西，直接在入口滿血復活，自動模式繼續
      Object.assign(me, { x: FIELD.spawn.x, y: FIELD.spawn.y, px: FIELD.spawn.x, py: FIELD.spawn.y, fx: FIELD.spawn.x, fy: FIELD.spawn.y, moving: false, face: 'right', inv: 2 });
      warns = []; banner('滿血復活！'); feed('倒下了也沒關係，夥伴把你扶起來了。打不過可以先去練等或換低一點的難度', '#a6ec7a');
      addFx('heal', 0.8, { x: cx(me), y: cy(me) }); sfx('potion'); hud(); return;
    }
    auto = false; syncAuto();
    if (mapId !== 0) loadMap(0, INN_SPOT);
    Object.assign(me, { x: INN_SPOT.x, y: INN_SPOT.y, px: INN_SPOT.x, py: INN_SPOT.y, fx: INN_SPOT.x, fy: INN_SPOT.y, moving: false, face: 'down' });
    say('旅店・瑪莎', ['試煉沒過也沒關係，休息一下就好。', 'HP 已經恢復了，準備好再去挑戰吧！']);
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
const DEF_COMP = 1.1;
function dealDamage(m, mult, fromX = me.px, fromY = me.py, color, kind = 'skill') {
  if (kind === 'basic' && P.cls === 'scout' && shadowT > 0) { mult *= 1.5; }
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
  const elem = hitElem || (kind === 'basic' ? st.weaponElem : kind === 'ally' ? allyElem : kind === 'skill' && skillElemT > 0 ? skillElem : kind === 'skill' ? skillElem : '無');
  hitElem = null;
  if (kind !== 'ult' && kind !== 'ally' && R() > hitChance(st.hit, m.d.lv)) { float('Miss', cx(m), m.py * TS - 6, '#bdb6d0', 0.9); return; }
  const magic = kind === 'skill' ? !!SK[curSkill]?.mag : kind === 'basic' && (P.cls === 'mage' || P.cls === 'priest');
  if ((kind === 'basic' || kind === 'skill') && pst.hitDown > 0 && R() < 0.2) { float('Miss', cx(m), m.py * TS - 6, '#bdb6d0', 0.9); return; }
  const tctx = { kind, magic, elem, fromX, fromY };
  { const tk = traitDmg(m, tctx); if (!tk) return; mult *= tk; }
  const dm = damageMult(P, st.mods, elem, m.night ? m.type + '_n' : m.type, m.d.lv, m.d.boss, magic);
  const cm = kind === 'skill' ? castMods : null;
  if (cm?.pierce) { const d0 = monDef(m.d.lv, m.d.boss); dm.mult *= defMod(d0 * (1 - cm.pierce)) / defMod(d0); }
  const frozenCrit = m.frozen > 0 && debOn(m, '冰封暴擊') && !SK[curSkill]?.mag;
  const crit = cm?.crit || frozenCrit || R() < st.crit;
  if (cm?.exec && m.hp / m.d.hp < 0.3) mult += cm.exec;
  const debuffs = (1 + debOn(m, '受傷提高')) * (1 + debOn(m, '防禦降低'));
  const k = (kind === 'skill' ? st.skill : kind === 'ult' ? ultMult() : 1) * dm.mult * DEF_COMP * debuffs * (m.d.boss ? 1 + (st.boss || 0) : 1);
  const base = kind === 'ally' ? atkOverride : st.atk;
  const dmg = Math.max(1, Math.round(base * mult * k * (0.85 + R() * 0.3) * (crit ? st.critDmg : 1)));
  if (st.leech && P.hp < st.hp && kind !== 'ally') P.hp = Math.min(st.hp, P.hp + Math.max(1, Math.round(dmg * st.leech)));
  if (kind !== 'ult') gainSoul(kind === 'skill' ? 1.2 : kind === 'ally' ? 0.5 : 1.6);
  m.hp -= dmg; m.flash = 0.12; m.hurtAt = anim; if (!m.d.boss) { monProvoked(m); TR[m.type]?.hurt?.(m, tctx); }
  if (m.d.beh?.reflect && kind === 'basic' && C.range <= 1 && m.hp > 0) hurt(Math.max(1, dmg * m.d.beh.reflect), null);
  if (cm) { if (cm.freeze) m.frozen = Math.max(m.frozen, m.d.boss ? cm.freeze / 3 : cm.freeze); if (cm.stun) m.frozen = Math.max(m.frozen, m.d.boss ? cm.stun / 3 : cm.stun); if (cm.db) applyDebuff(m, cm.db); if (cm.healFrac) P.hp = Math.min(st.hp, P.hp + Math.round(dmg * cm.healFrac)); }
  if (kind === 'basic' && st.dot > 0) m.pois = { v: st.atk * st.dot, t: 5 };
  if (kind === 'basic' && st.double > 0 && !m.dbl && R() < st.double) { m.dbl = true; pending.push({ t: 0.08, fn: () => { dealDamage(m, 1, fromX, fromY, color, 'basic'); m.dbl = false; } }); }
  if (kind !== 'ally') sfx(crit ? 'crit' : 'hit');
  const a = Math.atan2(m.py - fromY, m.px - fromX);
  m.kx = Math.cos(a) * 4; m.ky = Math.sin(a) * 4;
  float(crit ? `${fmt(dmg)}!` : fmt(dmg), cx(m) + (R() - 0.5) * 12, m.py * TS - 2 - R() * 6, crit ? '#ff9f1c' : dm.elem > 1 ? '#ffd166' : dm.elem < 1 ? '#9a94ab' : (color || '#fff8e7'), crit ? 1.45 : dm.elem > 1 ? 1.2 : 1);
  if (dm.elem > 1 && R() < 0.35) float('剋！', cx(m) + 10, m.py * TS - 14, ELEM_COLOR[elem] || '#ffd166', 0.8);
  else if (dm.elem < 1 && R() < 0.25) float('抵抗', cx(m) + 10, m.py * TS - 14, '#9a94ab', 0.7);
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
  m.deadAt = anim; runKill(m);
  TR[m.type]?.death?.(m);
  sfx(m.d.boss ? 'boom' : 'kill');
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
  const dk = diffOf(P), rolls = m.d.boss ? 3 : m.minion ? 0 : R() < DROP_RATE * (m.d.trial ? 1 : dk.drop) ? 1 : 0;
  for (let i = 0; i < rolls; i++) drops.push(newDrop('gear', wx, wy, rollGear(R, m.d.lv + Math.floor(R() * 2), m.d.boss || (!m.d.trial && R() < dk.rare), P.cls)));
  if (!m.d.still && !m.d.decoy) for (const it of rollDrops(R, m.minion ? '' : m.type)) drops.push(newDrop('loot', wx, wy, it));
  if (m.night && !m.minion) {
    if (R() < NAME_SHARD_RATE) { drops.push(newDrop('loot', wx, wy, { id: 'nameShard', n: 1 })); feed('有什麼東西從怪物身上剝落了……名字碎片', '#c9a7ff'); }
    if (R() < NAME_BOX_RATE) { drops.push(newDrop('loot', wx, wy, { id: 'nameBox', n: 1 })); banner('掉落了【封名匣】！'); flash = 0.3; shake = 0.3; addFx('pillar', 1.2, { x: wx, y: wy, color: '#8a5cff' }); }
  }
  { const sid = SOUL_OF_CH[Math.min(6, Math.max(1, mapId))]; const n = m.d.boss ? 3 + Math.floor(R() * 3) : m.d.elite && R() < 0.2 ? 1 : 0; if (sid && n && !m.minion) { addShards(P, sid, n); feed(`獲得 ${SOULS[sid].name}的碎片 ×${n}`, SOULS[sid].color); } }
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
  const ex = guardExp(P, Math.round(m.d.exp * levelGapMult(P.lv, m.d.lv) * newbieMult(P.lv)));
  if (ex > 0) floatT(`+${fmt(ex)} EXP`, m.x, m.y - 0.9, '#a6ec7a', 0.8); else if (R() < 0.2) floatT('本小時效率已滿', m.x, m.y - 0.9, '#bdb6d0', 0.8);
  const before = P.lv;
  if (gainExp(P, ex)) levelUp(before);
  jobExp(ex * JOB_EXP_RATE);
  if (trial) trialCheck();
  hud();
}
function jobExp(n) {
  const ups = gainJobExp(P, Math.round(n));
  if (!ups) return;
  sfx('levelup'); floatT(`職業 Lv ${P.job.lv}`, me.x, me.y - 1.4, '#7fd8ff', 1.1);
  if (P.autoAttr) { autoLearnSk(P); setupClass(); } else feed(`職業等級提升！獲得技能點，到「能力」選單的技能樹配點（剩 ${skPoints(P).free} 點）`, '#7fd8ff');
  if (canAdvance(P)) feed(`可以轉職了！到「能力」選單選擇二轉路線`, '#ffd166');
  hud();
}
function levelUp(before) {
  ensureAttrs(P); if (P.autoAttr) autoAllocate(P); else if (attrFree(P)) feed(`獲得能力點，到「能力」選單分配（剩 ${attrFree(P)} 點）`, '#7fd8ff');
  sfx('levelup');
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
  if (d.kind === 'gem') { sfx('coin'); collectGem(d.val); return; }
  if (d.kind === 'coin') { sfx('coin'); P.coins += d.val; bump('coinBox'); questDone(track(P, 'coin', d.val)); return; }
  sfx('pickup');
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
  projs.push({ elem: opt.elem || (opt.dk === 'basic' ? stats(P).weaponElem : opt.dk === 'ally' ? allyElem : skillElemT > 0 ? skillElem : '無'), kind, x: cx(org), y: cy(org) - 4, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, trav: 0, range: opt.range * TS, pierce: opt.pierce ?? 0, mult: opt.mult, r: opt.r ?? 6, hit: new Set(), home: opt.home || null, onEnd: opt.onEnd, color: opt.color, dk: opt.dk || 'skill', by: opt.by || null, mods: opt.mods || null });
}
const faceAng = () => ({ right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 })[me.face];
const angTo = (m) => Math.atan2(cy(m) - (cy(me) - 4), cx(m) - cx(me));
function faceToward(m) { const dx = m.px - me.px, dy = m.py - me.py; me.face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); const d = dirOf(Math.round(dx * 2) / 2, Math.round(dy * 2) / 2); if (d) me.dir8 = d; }
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
        if (p.kind !== 'fire' && p.mult) { if (p.by) atkOverride = p.by.atk; hitElem = p.elem; const keep = castMods; castMods = p.mods; dealDamage(m, p.mult, (p.x - p.vx * 0.05) / TS - 0.5, (p.y - p.vy * 0.05) / TS - 0.5, p.color, p.dk); castMods = keep; }
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
  const v = DIR_VEC[me.dir8 || D8[me.face]];
  if (v && v[0] && v[1]) { const [dx, dy] = v; return [[me.x + dx, me.y + dy], [me.x + dx, me.y], [me.x, me.y + dy]]; }
  const [dx, dy] = DIRS[me.face];
  const fx = me.x + dx, fy = me.y + dy;
  return dx ? [[fx, fy], [fx, fy - 1], [fx, fy + 1]] : [[fx, fy], [fx - 1, fy], [fx + 1, fy]];
}
const onTiles = (m, tiles) => tiles.some(([x, y]) => (m.d.boss ? Math.abs(m.x - x) <= 1 && Math.abs(m.y - y) <= 1 : m.x === x && m.y === y));
function basicAttack(target) {
  const aspd = stats(P).aspd;
  sfx({ sword: 'swing', archer: 'arrow', mage: 'bolt', monk: 'swing', priest: 'bolt', scout: 'swing' }[P.cls] || 'swing');
  me.castT = 0; me.cool = C.cool / aspd * (pst.aspdDown > 0 ? 1.15 : 1); me.atkT = me.atkDur = Math.max(0.16, Math.min(0.28, me.cool * 0.8));
  // 命中時點：等攻擊動作揮到第 3 格中間（共 6 格）才出傷害與刀光，畫面和數字對得上
  const hitAt = me.atkDur * (2.5 / 6), face0 = me.face, dir0 = me.dir8;
  pending.push({ t: hitAt, fn: () => { if (!started) return; const f1 = me.face, d1 = me.dir8; me.face = face0; me.dir8 = dir0; basicHit(target); me.face = f1; me.dir8 = d1; } });
}
function basicHit(target) {
  const [dx, dy] = DIRS[me.face];
  if (P.cls === 'sword') {
    addFx('slash', 0.18, { x: cx(me) + dx * 13, y: cy(me) + dy * 13 - 3, ang: faceAng(), color: '#dff6ff', size: 19 });
    for (const m of alive()) if (onTiles(m, frontTiles())) dealDamage(m, 1, me.px, me.py, null, 'basic');
  } else if (P.cls === 'scout') {
    // 短刀：快速雙刺；在影裡時刀光變紫
    const c = shadowT > 0 ? '#c9a7ff' : '#e8e4f0';
    addFx('slash', 0.12, { x: cx(me) + dx * 12, y: cy(me) + dy * 12 - 3, ang: faceAng() + 0.5, color: c, size: 13 });
    pending.push({ t: 0.06, fn: () => addFx('slash', 0.12, { x: cx(me) + dx * 12, y: cy(me) + dy * 12 - 3, ang: faceAng() - 0.5, color: c, size: 13 }) });
    const t = [frontTiles()[0]];
    for (const m of alive()) if (onTiles(m, t)) dealDamage(m, 1, me.px, me.py, null, 'basic');
  } else if (P.cls === 'monk') {
    const off = (R() - 0.5) * 8;
    addFx('punch', 0.12, { x: cx(me) + dx * 14 + (dy ? off : 0), y: cy(me) + dy * 14 - 3 + (dx ? off : 0), color: '#ffd8a8' });
    const t = [frontTiles()[0]];
    for (const m of alive()) if (onTiles(m, t)) dealDamage(m, 1, me.px, me.py, null, 'basic');
  } else if (P.cls === 'archer') {
    const m = target || nearest(C.range);
    if (m) faceToward(m);
    shoot('arrow', m ? angTo(m) : faceAng(), { speed: 320, range: C.range + 1, mult: 1, r: 4, color: '#e8ffe0', dk: 'basic' });
  } else if (P.cls === 'mage' || P.cls === 'priest') {
    const m = target || nearest(C.range);
    if (m) faceToward(m);
    shoot('bolt', m ? angTo(m) : faceAng(), { speed: 200, range: C.range + 1.5, mult: 1, r: 5, home: m, color: P.cls === 'priest' ? C.color : '#e3d0ff', dk: 'basic' });
  }
}

// ---------- 技能 ----------
// 技能資料在 skilldata.js（由 design/skilldb.py 產生）；這裡依 shape 決定畫面與打到誰
function addTB(kind, v, dur) { P.tb ??= {}; P.tb[kind] = { v, until: Date.now() + dur * 1000 }; }
const tbOn = (k) => P.tb?.[k] && P.tb[k].until > Date.now();
function gainRes(n = 1) {
  if (!res.max) return;
  const before = res.n; res.n = Math.max(0, Math.min(res.max, res.n + n));
  if (P.cls === 'monk' && before < 3 && res.n >= 3) { addTB('攻速', 0.10, 5); floatT('三響！全隊攻速 +10%', me.x, me.y - 1.3, '#ffd166', 1); ring(cx(me), cy(me), 40, '#ffd166', 0.5, 4); }
}
function applyDebuff(m, db) {
  if (!db || !m || m.dead > 0) return;
  const [k, v, dur] = db;
  if (k === '封印' || k === '定身') { m.frozen = Math.max(m.frozen, m.d.boss ? dur / 2 : dur); return; }
  m.deb ??= {}; m.deb[k] = { v, until: anim + dur * (1 + (stats(P).debuffDur || 0)) };
}
const debOn = (m, k) => (m.deb?.[k] && m.deb[k].until > anim ? m.deb[k].v : 0);
function castIdx(i) {
  if (!started || dialog || fishing) return;
  const s = skills[i];
  if (!s || s.t > 0 || cutinT > 0) return;
  if (pst.silence > 0 || pst.sleep > 0) { floatT(pst.sleep > 0 ? '睡著了' : '沉默中', me.x, me.y - 0.9, '#d0a8ff', 0.8); return; }
  const n = skillNums(P, s.id), sk = n.s, st = stats(P);
  if (sk.need && res.n < sk.need) { floatT(`需要 ${sk.need} 層${res.name}`, me.x, me.y - 0.9, '#bdb6d0', 0.8); s.t = 0.4; return; }
  const cost = Math.round(n.mp * st.mpCost);
  if ((P.mp ?? st.mpMax) < cost) { floatT('魔力不夠', me.x, me.y - 0.9, '#7fb4ff', 0.8); s.t = 0.4; return; }
  P.mp = (P.mp ?? st.mpMax) - cost;
  s.t = n.cd * (1 - st.cdr) * (run ? runCdMult(run, s.id) : 1); curSkill = s.id;
  questDone(track(P, 'skill'));
  skillElem = sk.elem || (sk.shape === 'shot' && P.cls === 'priest' ? '聖' : '無'); skillElemT = 1.2;
  sfx({ sword: 'slash', archer: 'arrow', mage: 'magic', monk: 'punch', scout: 'slash', priest: sk.kind === 'heal' ? 'potion' : 'magic' }[P.cls] || 'slash');
  const echo = alive().find((m) => m.d.mech === 'echo' && tdist(m, me.px, me.py) <= 8);
  if (echo && lastSkill === s.id && sk.c) {
    floatT('回音反彈！', me.x, me.y - 1.2, '#b48cff', 1.3); ring(cx(echo), cy(echo), 40, '#b48cff', 0.4, 4);
    hurt(Math.round(stats(P).hp * 0.3), null); lastSkill = null; return;
  }
  lastSkill = s.id;
  // 專屬機制：先算消耗與加成
  let mult = n.mult * (run ? runSkillMult(run, s.id) : 1);
  if (sk.use1 && res.n >= 1) { mult *= 1 + sk.use1 / 100; res.n--; }
  if (sk.need && sk.use !== undefined) { mult *= 1 + (sk.use / 100) * res.n; if (sk.buff?.[0] === 'dmgPerStack') addTB('dmgPerStack', n.buff[1] * res.n, n.buff[2]); res.n = 0; }
  if (sk.useCandle) mult *= 1 + (sk.useCandle / 100) * res.n;
  if (sk.shadowX && shadowT > 0) mult *= sk.shadowX * (1 + (st.shadowStab || 0));
  if (sk.combo) { if (sk.combo === comboNext) { gainRes(1); comboNext = (comboNext % 3) + 1; } else comboNext = sk.combo === 1 ? 2 : 1; }
  else if (sk.gen) gainRes(sk.gen);
  if (sk.star || sk.candle) gainRes(1);
  if (sk.elem && P.cls === 'mage' && sk.c) { gainRes(sk.elem !== lastElem ? 1 : -1); lastElem = sk.elem; }
  if (sk.shadow) { shadowT = Math.max(shadowT, sk.shadow); res.n = 1; }
  castMods = { pierce: sk.pierce || 0, crit: !!sk.crit || (sk.shadowX && shadowT > 0 && P.cls === 'scout' && sk.id === 'hide'), freeze: sk.freeze || 0, stun: sk.stun || 0, exec: n.exec, db: sk.kind === 'act' ? n.db : null, healFrac: sk.healFrac || 0, hits: 0 };
  addFx('circle', 0.55, { x: cx(me), y: cy(me), color: sk.need ? '#ffb35c' : C.color });
  tintC = sk.need ? '#ffb35c' : C.color; tintT = 0.12;
  me.atkT = me.atkDur = 0.3; me.castT = sk.mag || sk.heal || sk.kind === 'heal' || P.cls === 'mage' || P.cls === 'priest' ? 0.3 : 0;
  // 增益、減益、治療
  if (n.buff && sk.buff[0] !== 'dmgPerStack') { addTB(n.buff[0], n.buff[1], n.buff[2]); banner(sk.name); }
  if (n.pb) { addTB(n.pb[0], n.pb[1], n.pb[2]); for (const a of allies) if (a.down <= 0) addFx('heal', 0.5, { x: cx(a), y: cy(a) }); banner(sk.name); }
  if (sk.kind === 'debuff') { const t = nearest(6); if (t) { applyDebuff(t, n.db); ring(cx(t), cy(t), 22, '#c084ff', 0.4, 3); floatT(sk.name, t.x, t.y - 1, '#c084ff', 0.9); } }
  if (sk.kind === 'heal' || sk.healAoe) {
    const amt = (x) => Math.round(st.atk * x * st.heal);
    if (n.heal) { P.hp = Math.min(st.hp, P.hp + amt(n.heal)); addFx('heal', 0.7, { x: cx(me), y: cy(me) }); }
    if (n.healAoe) {
      const k = n.healAoe * (1 + (sk.perCandle || 0) * res.n);
      P.hp = Math.min(st.hp, P.hp + amt(k)); addFx('heal', 0.7, { x: cx(me), y: cy(me) });
      for (const a of allies) if (a.down <= 0 && Math.hypot(a.px - me.px, a.py - me.py) <= 5) { a.hp = Math.min(a.max, a.hp + amt(k)); addFx('heal', 0.7, { x: cx(a), y: cy(a) }); }
    }
    if (n.shield) { addTB('dr', 0.25, 6); ring(cx(me), cy(me), 22, '#ffe3af', 0.5, 3); }
    hud();
  }
  if (sk.kind === 'util' && sk.desc) floatT(sk.name, me.x, me.y - 1, '#7fd8ff', 0.9);
  if (sk.shape === 'taunt') { for (const m of alive()) if (tdist(m, me.px, me.py) <= 3) { m.engaged = true; } if (sk.genPer2) gainRes(Math.floor(alive().filter((m) => tdist(m, me.px, me.py) <= 3).length / 2)); applyDebuff(nearest(3), n.db); ring(cx(me), cy(me), 48, '#ffd166', 0.5, 4); }
  if (!mult && !n.exec) { castMods = null; hud(); return; }
  shapeHit(sk, mult, n);
}
// 依施放方式打到怪物；mult 是每個目標的總倍率
function shapeHit(sk, mult, n) {
  const [dx, dy] = DIRS[me.face];
  const wx = cx(me), wy = cy(me);
  const maxT = sk.t || 1, mods = castMods;
  const tgt = nearest(P.cls === 'archer' ? C.range + (stats(P).range || 0) : 6);
  const color = ELEM_COLOR[sk.elem] || (P.cls === 'priest' ? C.color : '#dff6ff');
  const area = (x, y, r, k, each) => { let c = 0; for (const m of alive()) if (c < maxT && tdist(m, x, y) <= r + (m.d.boss ? 0.8 : 0)) { c++; dmgWith(m, k, x, y, color, mods); each?.(m); } if (c >= 3 && sk.genAoe) gainRes(sk.genAoe); return c; };
  switch (sk.shape) {
    case 'melee': {
      const big = mult >= 5;
      addFx(P.cls === 'monk' ? 'punch' : 'slash', 0.2, { x: wx + dx * 13, y: wy + dy * 13 - 3, ang: faceAng(), color: '#ffe08a', size: big ? 26 : 21, big });
      let hit = 0; for (const m of alive()) if (hit < Math.max(1, maxT) && onTiles(m, frontTiles())) { hit++; dmgWith(m, mult, me.px, me.py, color, mods); }
      if (!hit && tgt && tdist(tgt, me.px, me.py) <= 1.6) dmgWith(tgt, mult, me.px, me.py, color, mods);
      if (big) shake = Math.max(shake, 0.18);
      break;
    }
    case 'spin':
      addFx('spin', 0.32, { x: wx, y: wy - 3, color }); ring(wx, wy, 26, color, 0.3, 3); shake = Math.max(shake, 0.15);
      area(me.px, me.py, 1.6, mult); break;
    case 'barrage': {
      const k = 6;
      for (let h = 0; h < k; h++) pending.push({ t: h * 0.06, fn: () => {
        const off = (R() - 0.5) * 14;
        addFx('punch', 0.12, { x: wx + dx * (13 + R() * 6) + (dy ? off : 0), y: wy + dy * (13 + R() * 6) - 3 + (dx ? off : 0), color: h === k - 1 ? '#ffd166' : '#ffd8a8', big: h === k - 1 });
        const m = alive().find((x) => onTiles(x, frontTiles())) || (tgt && tdist(tgt, me.px, me.py) <= 1.6 ? tgt : null);
        if (m) dmgWith(m, mult / k, me.px, me.py, color, mods);
      } });
      break;
    }
    case 'shock':
      ring(wx, wy + 4, 48, color, 0.5, 6); burst(wx, wy + 6, '#c9a77a', 22, 110); shake = Math.max(shake, 0.25);
      area(me.px, me.py, 2.2, mult); break;
    case 'quake': {
      const px = me.px + dx * 2, py = me.py + dy * 2;
      addFx('bigsword', 0.3, { x: px * TS + 8, y: py * TS + 8 });
      pending.push({ t: 0.26, fn: () => {
        addFx('crack', 0.9, { x: px * TS + 8, y: py * TS + 8, seed: R() }); ring(px * TS + 8, py * TS + 8, 52, '#ffd166', 0.5, 6);
        addFx('pillar', 0.5, { x: px * TS + 8, y: py * TS + 8, color: '#ffd166' }); shake = 0.45; flash = 0.15;
        area(px, py, 2.3, mult);
      } });
      break;
    }
    case 'wave':
      shoot('wave', faceAng(), { speed: 240, range: 6, pierce: Math.max(1, maxT), mult, r: 10, color, mods });
      break;
    case 'shot': {
      const hits = sk.hits || 1, a = tgt ? angTo(tgt) : faceAng();
      if (tgt) faceToward(tgt);
      for (let h = 0; h < hits; h++) pending.push({ t: h * 0.08, fn: () => shoot(P.cls === 'archer' ? 'arrow' : sk.elem === '火' ? 'fire' : 'bolt', a, { speed: 300, range: (C.range || 5) + 2, mult: mult / hits, r: 5, home: tgt, color, mods }) });
      break;
    }
    case 'fan': {
      const a = tgt ? angTo(tgt) : faceAng(); if (tgt) faceToward(tgt);
      for (const o of [-0.22, 0, 0.22]) shoot('arrow', a + o, { speed: 340, range: C.range + 1, pierce: 1, mult, r: 4, color, mods });
      break;
    }
    case 'bigshot': {
      const a = tgt ? angTo(tgt) : faceAng(); if (tgt) faceToward(tgt);
      shoot('bigarrow', a, { speed: 380, range: 10, pierce: Math.max(1, maxT), mult, r: 8, color: '#ffe08a', mods });
      ring(wx, wy, 16, '#ffe08a', 0.25, 3); shake = Math.max(shake, 0.12);
      break;
    }
    case 'fireball': {
      const a = tgt ? angTo(tgt) : faceAng(); if (tgt) faceToward(tgt);
      shoot('fire', a, { speed: 210, range: 6, mult: 0, r: 7, home: tgt, color: '#ffb347', onEnd: (p) => {
        ring(p.x, p.y, 38, '#ff8a3d', 0.45, 6); addFx('boom', 0.35, { x: p.x, y: p.y }); burst(p.x, p.y, '#ff5a36', 18, 110); shake = Math.max(shake, 0.2);
        area(p.x / TS - 0.5, p.y / TS - 0.5, 1.7, mult);
      } });
      break;
    }
    case 'rain': case 'trap': case 'ground': {
      const px = tgt ? tgt.px : me.px + dx * 3, py = tgt ? tgt.py : me.py + dy * 3;
      if (tgt) faceToward(tgt);
      addFx('target', 0.8, { x: px * TS + 8, y: py * TS + 8 });
      const waves = sk.shape === 'rain' ? 6 : 1;
      for (let k = 0; k < waves; k++) pending.push({ t: 0.15 + k * 0.12, fn: () => {
        if (sk.shape === 'rain') for (let a = 0; a < 3; a++) addFx('arrowfall', 0.15, { x: (px + (R() - 0.5) * 3) * TS + 8, y: (py + (R() - 0.5) * 3) * TS + 8, delay: 0 });
        else { ring(px * TS + 8, py * TS + 8, 44, color, 0.5, 6); addFx('pillar', 0.5, { x: px * TS + 8, y: py * TS + 8, color }); shake = Math.max(shake, 0.2); }
        area(px, py, 2, mult / waves);
      } });
      break;
    }
    case 'nova':
      addFx('nova', 0.45, { x: wx, y: wy });
      for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; parts.push({ x: wx, y: wy, vx: Math.cos(a) * 110, vy: Math.sin(a) * 110, c: k % 2 ? '#dff6ff' : color, t: 0, g: 0, size: 3, life: 0.35 }); }
      shake = Math.max(shake, 0.12); area(me.px, me.py, 2.3, mult); break;
    case 'chain': {
      if (!tgt) { floatT('附近沒有怪物', me.x, me.y - 0.8, '#bdf1ff', 0.8); break; }
      const chain = [tgt], used = new Set([tgt]);
      while (chain.length < maxT) {
        const last = chain[chain.length - 1]; let nx = null, nd = 1e9;
        for (const m of alive()) if (!used.has(m)) { const d = tdist(m, last.px, last.py); if (d <= 3.2 && d < nd) { nd = d; nx = m; } }
        if (!nx) break; chain.push(nx); used.add(nx);
      }
      addFx('lightning', 0.32, { pts: [[wx, wy - 6], ...chain.map((m) => [cx(m), cy(m)])] }); flash = Math.max(flash, 0.08);
      chain.forEach((m, k) => pending.push({ t: 0.03 * k, fn: () => dmgWith(m, mult, me.px, me.py, '#fff7a8', mods) }));
      break;
    }
    case 'dash': {
      const path = []; let x = me.x, y = me.y;
      for (let k = 0; k < 3; k++) { const nx = x + dx, ny = y + dy; if (!walkable(grid, nx, ny) || npcs.some((q) => q.x === nx && q.y === ny)) break; x = nx; y = ny; path.push([x, y]); }
      while (path.length && occupied(path[path.length - 1][0], path[path.length - 1][1])) path.pop();
      const end = path.length ? path[path.length - 1] : [me.x, me.y];
      addFx('dragon', 0.55, { x0: wx, y0: wy, x1: end[0] * TS + 8, y1: end[1] * TS + 8 });
      Object.assign(me, { fx: me.x, fy: me.y, x: end[0], y: end[1], moving: true, mt: 0, dur: 0.16 }); shake = Math.max(shake, 0.25);
      const hitSet = new Set();
      for (const [qx, qy] of [[me.fx, me.fy], ...path]) for (const m of alive()) if (hitSet.size < maxT && !hitSet.has(m) && tdist(m, qx, qy) <= 1.3 + (m.d.boss ? 0.8 : 0)) hitSet.add(m);
      hitSet.forEach((m) => pending.push({ t: 0.08, fn: () => dmgWith(m, mult, me.fx, me.fy, '#ffe08a', mods) }));
      break;
    }
    case 'veil':
      addFx('nova', 0.5, { x: wx, y: wy }); ring(wx, wy, 44, '#3b3350', 0.6, 8);
      area(me.px, me.py, 2.2, mult, (m) => { if (sk.confuse) m.frozen = Math.max(m.frozen, sk.confuse); });
      break;
    case 'screen':
      flash = 0.4; shake = 0.5; for (const m of alive()) if (tdist(m, me.px, me.py) <= 9) dmgWith(m, mult, me.px, me.py, '#fff8e7', mods);
      break;
    default:
      if (tgt) dmgWith(tgt, mult, me.px, me.py, color, mods);
  }
  castMods = null;
  hud();
}
function dmgWith(m, mult, x, y, color, mods) { const keep = castMods; castMods = mods; dealDamage(m, mult, x, y, color, 'skill'); castMods = keep; }

// ---------- 魂像大招 ----------
function soulIcon(id, cls) {
  const art = asset('soul_art/' + id);
  return art ? Object.assign(art.cloneNode(), { className: cls }) : soulBig(id, 2);
}
function showCutin(id, label) {
  sfx('cutin');
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
  sfx('reward');
  if (r.coins) P.coins += r.coins;
  if (r.stones) P.stones += r.stones;
  if (r.title) { const m = ensureMeta(P); if (!m.titles.includes(r.title)) m.titles.push(r.title); m.title = r.title; }
  for (const [id, n] of Object.entries(r.items || {})) if (n > 0) addStack(P, id, n);
  if (r.exp) { const before = P.lv; if (gainExp(P, r.exp)) levelUp(before); }
  feed(`獲得：${rewardText(r)}`, '#ffd166'); bump('coinBox'); hud(); save();
}
function questDone(list) {
  if (list.length) sfx('quest'); for (const q of list) feed(`任務完成：${questLabel(q)}（到「冒險」領獎）`, '#f6c945'); if (list.length) hud(); }
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
  banner(`第 ${f} 層　通過！`); flash = 0.2; sfx('clear');
  if (r.gear) drops.push(newDrop('gear', cx(me), cy(me), rollGear(R, towerFloor(P, f).lv, true, P.cls)));
  pending.push({ t: 1.4, fn: () => {
    grant(r.reward);
    say('試煉之塔', [`第 ${f} 層通過！${r.first ? '（首次通過，額外獎勵）' : ''}`, `目前最高紀錄：第 ${P.meta.tower.best} 層`], [[`挑戰第 ${f + 1} 層`, () => startTower(f + 1)], ['回到村子', () => { loadMap(0, SPAWN); hud(); }]]);
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
function renderAdvTop() {
  const q = quickIdleState(P);
  $('quickIdleBtn').textContent = q.freeLeft ? `⚡ 快速掛機（免費 ${q.freeLeft} 次）` : q.paidLeft ? `⚡ 快速掛機（${QUICK_COST} 魂石）` : '⚡ 今天已用完';
  $('quickIdleBtn').disabled = !q.paidLeft;
  $('claimAllBtn').disabled = !claimable(P);
}
function renderAdv() {
  refresh(P); renderAdvTop();
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
    if (P.ch < 2) note('<b>打倒第 1 章的露滴王後開放。</b>');
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
      const pf = profileOf(t), md = MONSTERS[t];
      d.innerHTML = `${im ? `<img src="${im.src}" alt="">` : ''}<b>${k ? md.name : '？？？'}</b>${k ? `<span class="mprof"><i style="color:${ELEM_COLOR[pf.elem]}">${pf.elem}</i>・${pf.race}・${pf.size}</span><span class="mstat">Lv${md.lv} 血${fmt(md.hp)} 攻${md.atk} 防${monDef(md.lv, md.boss)}</span>` : ''}<span class="stars">${'★'.repeat(s)}${'☆'.repeat(3 - s)}</span><small>${k} 隻</small>`;
      grid.append(d);
    }
    out.push(grid);
  } else if (advTab === 'ach') {
    const owned = ACHIEVEMENTS.filter((a) => m.ach[a.id]);
    note(`完成成就可以領魂石並獲得稱號，稱號會顯示在角色頭上。目前稱號：<b>${m.title || '無'}</b>`);
    if (owned.length || m.titles?.length) { const t = document.createElement('div'); t.className = 'chests'; t.append(mkBtn('不顯示', !!m.title, () => { m.title = ''; save(); renderAdv(); })); for (const tt of [...(m.titles || []), ...owned.map((a) => a.title)]) t.append(mkBtn(tt, m.title !== tt, () => { m.title = tt; save(); renderAdv(); })); out.push(t); }
    for (const a of ACHIEVEMENTS) { const [v, need] = achProgress(P, a), got = m.ach[a.id]; out.push(qRow(`<b>【${a.title}】</b>${a.text}<small class="muted">　魂石 ${a.stones}</small>`, v, need, mkBtn(got ? '已領' : v >= need ? '領取' : '未達成', !got && v >= need, () => { grant(claimAch(P, a.id)); renderAdv(); }))); }
  }
  box.replaceChildren(...out);
  hud();
}
$('advBtn').addEventListener('click', () => { if (!started) return; renderAdv(); $('advPanel').hidden = false; });
$('advClose').addEventListener('click', () => { $('advPanel').hidden = true; });
$('claimAllBtn').addEventListener('click', () => { const r = claimAll(P); if (r) { grant(r); burst(cx(me), cy(me), '#ffd166', 30, 140); banner('全部領取！'); } renderAdv(); });
$('quickIdleBtn').addEventListener('click', quickIdle);
// ---------- 商城（示範版：不會真的扣款）----------
function renderShop() {
  const out = [];
  const mo = document.createElement('div'); mo.className = 'monthbar';
  mo.innerHTML = monthActive(P) ? `月卡生效中，剩 <b>${monthDaysLeft(P)}</b> 天` : '還沒有月卡';
  if (monthActive(P)) mo.append(mkBtn(monthClaimable(P) ? `領今天的 ${MONTH_DAILY} 魂石` : '今天已領', monthClaimable(P), () => { grant(claimMonthDaily(P)); renderShop(); }));
  out.push(mo);
  for (const it of SHOP) {
    const card = document.createElement('div'); card.className = 'shopcard hot';
    const first = it.first && !P.shop?.bought?.[it.id];
    const gives = rewardText({ ...it.give, stones: (it.give.stones || 0) * (first ? 2 : 1) });
    card.innerHTML = `<div class="sc-l"><b>${it.name}</b><span class="sc-tag">${first ? '首購雙倍！' : it.tag}</span><span class="sc-give">${gives}</span>${it.perks ? `<ul>${it.perks.map((x) => `<li>${x}</li>`).join('')}</ul>` : ''}</div>`;
    const ok = canBuy(P, it.id);
    card.append(mkBtn(ok ? `NT$${it.price}` : it.limit === 'day' ? '明天再來' : '已購買', ok, () => {
      $('shopPanel').hidden = true;
      say('商城', [`購買「${it.name}」NT$${it.price}？`, '（這是示範版，按「購買」會直接發放，不會真的扣款）'], [['購買', () => { const r = buySku(P, it.id); if (r) { grant(r); banner(`獲得：${it.name}`); burst(cx(me), cy(me), '#ffd166', 40, 160); } renderShop(); $('shopPanel').hidden = false; }], ['再想想', () => { $('shopPanel').hidden = false; }]]);
    }));
    out.push(card);
  }
  const st = document.createElement('div'); st.className = 'shopcard';
  const nx = bagPlusNext(P);
  st.innerHTML = `<div class="sc-l"><b>魂石兌換・背包擴充</b><span class="sc-tag">裝備欄 ${bagSize(P)} 格${nx ? `，再 +${BAG_PLUS_STEP} 格` : '（已滿）'}</span><span class="sc-give">你有 ${fmt(P.stones)} 魂石。魂石靠每日任務、成就、圖鑑就拿得到，只用在方便，不會讓角色變強</span></div>`;
  st.append(mkBtn(nx ? `${nx} 魂石` : '已滿', !!nx && P.stones >= nx, () => { const r = buyBagPlus(P); if (r) { feed(`背包擴充到 ${bagSize(P)} 格`, '#7fd8ff'); hud(); save(); } renderShop(); }));
  out.push(st);
  $('shopList').replaceChildren(...out);
}
$('shopBtn').addEventListener('click', () => { if (!started) return; renderShop(); $('shopPanel').hidden = false; });
$('shopClose').addEventListener('click', () => { $('shopPanel').hidden = true; });
document.querySelectorAll('#advTabs button').forEach((b) => b.addEventListener('click', () => { advTab = b.dataset.t; renderAdv(); }));

// 魔王登場特寫：第一次走進魔王區時，放精緻原圖＋名字
let bossSeen = new Set();
function bossIntro() {
  if (cutinT > 0 || dialog || !inBoss(me.x, me.y)) return;
  const b = mons.find((m) => m.d.boss && m.dead <= 0);
  if (!b || bossSeen.has(b.type)) return;
  bossSeen.add(b.type); sfx('boss');
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
  sfx('ult');
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
  sfx('dodge');
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
  allies = []; return; // 設計定案：沒有 AI 傭兵，夥伴們改成各地的劇情 NPC；組隊留給真人玩家

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
function allyAttack(a, m, mult) { atkOverride = a.atk; allyElem = ALLY_ELEM[a.id] || '無'; hitElem = allyElem; dealDamage(m, mult, a.px, a.py, a.c.color, 'ally'); }
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
        addFx('circle', 0.5, { x: cx(a), y: cy(a), color: '#a6ec7a' }); a.skT = c.skillCd; a.atkT = 0.3;
        if (!activeBuffs(P).includes('bless')) { addBuff(P, 'bless', 45); floatT('祝福', me.x, me.y - 1, BUFFS.bless.color, 0.9); }
        continue;
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
  // 設計定案：沒有 AI 傭兵。這些人是各章的劇情夥伴；組隊之後開放給真人玩家
  $('partyTactic').hidden = true;
  $('partyList').replaceChildren(...COMPANION_IDS.map((id) => {
    const c = COMPANIONS[id], met = unlocked(P, id);
    const card = document.createElement('div'); card.className = `pcard${met ? '' : ' locked'}`; card.style.setProperty('--c', c.color);
    const art = asset('npc/ally_' + id);
    card.append(art ? Object.assign(art.cloneNode(), { className: 'pimg' }) : previewCanvas(c.look, 2));
    card.insertAdjacentHTML('beforeend', met ? `<div class="pinfo"><b>${c.name}</b> <span class="prole">${c.title}</span><p>${c.desc}</p></div>` : `<div class="pinfo"><b>？？？</b><p class="muted">第 ${c.unlock[0]} 章會遇到</p></div>`);
    return card;
  }));
  $('partyCount').textContent = '組隊會在多人版開放，和真人玩家一起冒險';
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
  // 有經驗的怪（不低於自己 10 級）優先；太弱的只在擋路時順手打
  const worth = targets.filter((m) => m.d.boss || m.d.trial || m.d.lv >= P.lv - 10), seek = worth.length ? worth : targets;
  autoCastT -= dt;
  const near = targets.filter((m) => tdist(m, me.px, me.py) <= (C.range > 1 ? 4.5 : 2.2));
  if (near.length && autoCastT <= 0) {
    const st = stats(P), boss = near.some((m) => m.d.boss);
    let bi, bv = 0;
    skills.forEach((x, k) => {
      if (x.t > 0) return;
      const n = skillNums(P, x.id), sk = n.s;
      if ((P.mp ?? 0) < n.mp * st.mpCost || (sk.need && res.n < sk.need)) return;
      let v = n.mult * Math.min(sk.t || 1, near.length) * (sk.use ? 1 + (sk.use / 100) * res.n : 1) / Math.max(0.5, sk.ct || 0.5);
      if (n.buff && !tbOn(n.buff[0])) v = boss || near.length >= 2 ? 50 : 0;
      if (n.pb && !tbOn(n.pb[0])) v = 40;
      if (sk.kind === 'debuff') v = boss || near.length >= 3 ? 30 : 0;
      if (sk.kind === 'heal') v = P.hp < st.hp * 0.6 ? 99 : 0;
      if (sk.kind === 'util' || sk.shape === 'taunt') v = sk.gen ? 1 : 0;
      if (sk.need && sk.use === 0) v = boss || near.length >= 3 ? 80 : 0;
      if (v > bv) { bv = v; bi = k; }
    });
    if (bi !== undefined) { if (C.range === 1) me.face = dirTo(near[0].x, near[0].y); castIdx(bi); autoCastT = 0.45; }
  }
  if (C.range > 1) {
    const rr = Math.min(4.5, C.range - 0.5), w = seek.filter((x) => tdist(x, me.px, me.py) <= rr).sort((a, b) => tdist(a, me.px, me.py) - tdist(b, me.px, me.py))[0];
    const m = w || nearest(rr);
    if (m && ok(m) && (w || !worth.length || tdist(m, me.px, me.py) <= 2)) { autoHit = true; autoTarget = m; return; }
  } else {
    const adj = targets.find((m) => cheb(m, me) === 1);
    if (adj) { face8(me, adj.x - me.x, adj.y - me.y); autoHit = true; return; }
  }
  const goal = new Set();
  if (!targets.length && mapId === 0) for (const y of GATE_Y) goal.add(`${W - 1},${y}`);
  const reach = C.range > 1 ? 3 : 1;
  if (run) for (const d of drops) if (d.kind === 'gem') goal.add(`${Math.floor(d.x / TS)},${Math.floor(d.y / TS)}`); // 局內：自動模式也會去撿結晶
  if (run?.chest && P.coins >= run.chest.cost && run.items.length < ITEM_SLOTS) goal.add(`${run.chest.x},${run.chest.y}`); // 金幣夠就去開寶箱
  for (const m of seek) for (let ox = -reach; ox <= reach; ox++) for (let oy = -reach; oy <= reach; oy++) if (Math.abs(ox) + Math.abs(oy) === (C.range > 1 ? Math.min(3, Math.abs(ox) + Math.abs(oy)) : 1) && (ox || oy)) goal.add(`${m.x + ox},${m.y + oy}`);
  const start = `${me.x},${me.y}`, prev = { [start]: null }, q = [[me.x, me.y]];
  let found = null;
  while (q.length && !found) {
    const [x, y] = q.shift();
    for (const d of DIR8) {
      const [ddx, ddy] = DIR_VEC[d], nx = x + ddx, ny = y + ddy, k = `${nx},${ny}`;
      if (k in prev || !walkable(grid, nx, ny) || !diagOk(x, y, ddx, ddy) || (occupied(nx, ny) && !allies.some((al) => al.x === nx && al.y === ny))) continue;
      prev[k] = `${x},${y}`;
      if (goal.has(k)) { found = k; break; }
      q.push([nx, ny]);
    }
  }
  if (!found) return;
  let k = found;
  while (prev[k] !== start) k = prev[k];
  const [nx, ny] = k.split(',').map(Number);
  face8(me, nx - me.x, ny - me.y);
  const mate = allies.find((al) => al.x === nx && al.y === ny);
  if (mate) { if (mate.moving) return; Object.assign(mate, { fx: mate.x, fy: mate.y, x: me.x, y: me.y, moving: true, mt: 0 }); }
  if (stuck()) return;
  Object.assign(me, { fx: me.x, fy: me.y, x: nx, y: ny, moving: true, mt: 0, dur: nx !== me.x && ny !== me.y ? 0.2 : 0.14 });
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
    sfx('splash'); P.fish[f.id] = (P.fish[f.id] || 0) + 1; questDone(track(P, 'fish'));
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
  const heal = Math.round(max * ITEMS[id].heal * (st.potion / 0.5)); sfx('potion');
  P.hp = Math.min(max, P.hp + heal);
  floatT(`+${fmt(heal)}`, me.x, me.y, '#a6ec7a'); burst(cx(me), cy(me), ITEMS[id].color, 8);
  hud(); save();
}
function useItem(id) {
  const d = ITEMS[id];
  if (d.heal) { usePotion(false, id); return; }
  if (!count(P, id)) return;
  if (d.effect === 'home') { if (mapId === 0) { floatT('已經在村子裡了', me.x, me.y - 0.6, '#bdf1ff', 0.8); return; } takeStack(P, id); loadMap(0, SPAWN); feed('使用回城卷軸，回到守燈村', '#e8d29a'); }
  else if (d.effect === 'blink') {
    const spots = [];
    for (let y = 1; y < H - 1; y++) for (let x = FMIN; x < W - 1; x++) if (walkable(grid, x, y) && !occupied(x, y) && !inBoss(x, y) && grid[y][x] !== T.PORTAL) spots.push([x, y]);
    const [x, y] = spots[Math.floor(R() * spots.length)];
    takeStack(P, id); burst(cx(me), cy(me), '#bfe3ff', 14, 80);
    Object.assign(me, { x, y, px: x, py: y, fx: x, fy: y, moving: false }); soulPos.x = cx(me); soulPos.y = cy(me);
    burst(cx(me), cy(me), '#bfe3ff', 14, 80);
  } else if (d.effect === 'combine') {
    if (count(P, id) < NAME_SHARD_NEED) { feed(`名字碎片 ${count(P, id)} / ${NAME_SHARD_NEED}，集滿才能拼成封名匣`, '#c9a7ff'); return; }
    takeStack(P, id, NAME_SHARD_NEED); addStack(P, 'nameBox', 1); banner('拼成了一個【封名匣】'); sfx('reward');
  } else if (d.effect === 'namebox') {
    if (P.lv < NAME_BOX_LV) { feed(`封名匣要 Lv${NAME_BOX_LV} 才打得開`, '#ff8fa0'); return; }
    const picks = openNameBox(P, R);
    $('bagPanel').hidden = true;
    say('封名匣', [`匣子裡浮出三個名字（Lv${nameBand(P.lv)} 級）。只能帶走一個，其他兩個會回到長夜裡。`],
      [...picks.map((g) => [`${SLOT_NAME[g.slot]}・${g.name}：${g.affixes.map((a) => `${affixName(a.id)}+${a.val}%（T${a.tier}）`).join('、')}`, () => {
        if (!takeStack(P, id)) return;
        pickupGear(P, g); banner(`帶走了【${g.name}】`); addFx('pillar', 1, { x: cx(me), y: cy(me), color: '#8a5cff' }); sfx('reward'); hud(); save();
      }]), ['先不打開', null]]);
    return;
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
  held8 = held ? dirOf(dx, dy) : null;
}
stick.addEventListener('pointerdown', (e) => { e.preventDefault(); stickId = e.pointerId; stick.setPointerCapture?.(e.pointerId); stick.classList.add('on'); stickMove(e); });
stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) stickMove(e); });
const stickEnd = (e) => { if (e.pointerId !== stickId) return; stickId = null; held = null; held8 = null; knob.style.transform = ''; stick.classList.remove('on'); };
stick.addEventListener('pointerup', stickEnd); stick.addEventListener('pointercancel', stickEnd); stick.addEventListener('lostpointercapture', stickEnd);
bindHold($('aBtn'), pressA, () => { aHeld = false; });
bindHold($('bBtn'), usePotion);
[0, 1, 2, 3, 4, 5].forEach((i) => bindHold($(`sk${i}Btn`), () => castIdx(i)));
bindHold($('dodgeBtn'), dodge);
bindHold($('soulBtn'), castUlt);
const keyDirs = new Set();
const keyDir8 = () => { let x = 0, y = 0; for (const k of keyDirs) { const [a, b] = DIRS[k]; x += a; y += b; } return dirOf(x, y); };
const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (KEYS[e.code]) { keyDirs.add(KEYS[e.code]); held = KEYS[e.code]; held8 = keyDir8(); e.preventDefault(); return; }
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
  if (KEYS[e.code]) { keyDirs.delete(KEYS[e.code]); held8 = keyDir8(); held = held8 ? (keyDirs.has(held) ? held : [...keyDirs][0]) : null; }
  if (['Space', 'Enter', 'KeyJ'].includes(e.code)) aHeld = false;
});
document.addEventListener('contextmenu', (e) => { if (e.target.closest('.pad')) e.preventDefault(); });

const SIZES = [['中', 17], ['大', 20], ['特大', 24]];
let fsIdx = 1;
try { const raw = localStorage.getItem('glimmer-fs'); if (raw !== null && SIZES[+raw]) fsIdx = +raw; } catch { /* 忽略 */ }
const fsK = () => SIZES[fsIdx][1] / 20;
function applyFs() { document.documentElement.style.setProperty('--fs', `${SIZES[fsIdx][1]}px`); $('fontBtn').textContent = `字 ${SIZES[fsIdx][0]}`; }
const applyArt = () => { $('styleBtn').textContent = artStyle === 'hd' ? '畫風 立繪' : '畫風 像素'; };
applyArt();
$('styleBtn').addEventListener('click', () => { artStyle = artStyle === 'hd' ? 'pixel' : 'hd'; applyArt(); try { localStorage.setItem('glimmer-art', artStyle); } catch { /* 忽略 */ } });
$('fontBtn').addEventListener('click', () => { fsIdx = (fsIdx + 1) % SIZES.length; applyFs(); try { localStorage.setItem('glimmer-fs', fsIdx); } catch { /* 忽略 */ } });
applyFs();

// ---------- 更新 ----------
function step(o, dur, dt) {
  o.mt += dt / dur;
  if (o.mt >= 1) { o.moving = false; o.px = o.x; o.py = o.y; return true; }
  o.px = o.fx + (o.x - o.fx) * o.mt; o.py = o.fy + (o.y - o.fy) * o.mt; return false;
}
function pickSong() {
  if (!started) return 'town';
  if (trial) return trial.f % 5 === 0 ? 'boss' : 'tower';
  const boss = mons.find((m) => m.d.boss && m.dead <= 0 && m.engaged && Math.abs(m.x - me.x) + Math.abs(m.y - me.y) <= 9);
  if (boss) return nightMode ? 'nightBoss' : 'boss';
  if (mapId === 0) return 'town';
  if (nightMode) return 'night';
  return 'field' + mapId;
}
function dust(wx, wy) {
  if (mapId === 0 && grid[me.y]?.[me.x] === T.WATER) return;
  for (let i = 0; i < 3; i++) parts.push({ x: wx + (R() - 0.5) * 8, y: wy, vx: (R() - 0.5) * 18, vy: -8 - R() * 10, c: R() < 0.5 ? '#e8dcc0' : '#cbb994', t: 0, g: 20, size: 1, life: 0.35 });
}
function update(dt) {
  if (cardOpen) return; // 選卡、選寶箱道具時世界暫停
  updateRun(dt);
  anim += dt; gateMsgT -= dt; skillElemT -= dt;
  playSong(pickSong());
  if (started) { metaT -= dt; if (metaT <= 0) { metaT = 30; if (refresh(P)) { feed('新的一天！每日任務已更新，到「冒險」查看', '#f6c945'); hud(); } } }
  if (trial && !trial.done && !dialog) {
    const before = Math.ceil(trial.t); trial.t -= dt;
    if (Math.ceil(trial.t) !== before) $('quest').textContent = questText();
    if (trial.t <= 0) { const f = trial.f; trial.done = true; auto = false; syncAuto(); say('試煉之塔', [`時間到！第 ${f} 層挑戰失敗。`, '提升戰力、換個打法，再來挑戰吧。'], [[`再挑戰第 ${f} 層`, () => startTower(f)], ['回到村子', () => { loadMap(0, SPAWN); hud(); }]]); }
  }
  if (me.moving && step(me, me.dur * (pst.slow > 0 ? 1.6 : 1) / (1 + (P.runMods?.move || 0) / 100), dt)) { me.step ^= 1; me.walkD = (me.walkD || 0) + Math.hypot(me.x - me.fx, me.y - me.fy); me.dur = 0.14; dust(cx(me), me.py * TS + 16); checkGate(); checkChest(); if (grid[me.y]?.[me.x] === T.PORTAL && mapId !== 0) { loadMap(0, SPAWN); feed('回到守燈村', '#c084ff'); save(); return; } }
  if (held && auto) { auto = false; syncAuto(); }
  invertT = Math.max(0, invertT - dt);
  if (!me.moving && started && held && !dialog && !fishing && !stuck()) {
    let d8 = held8 || D8[held];
    if (invertT > 0) d8 = { w: 'e', e: 'w', sw: 'se', se: 'sw', nw: 'ne', ne: 'nw' }[d8] || d8;
    let [dx, dy] = DIR_VEC[d8];
    face8(me, dx, dy);
    // 斜向被擋住時，改走比較接近的那個直向
    if (dx && dy && (!diagOk(me.x, me.y, dx, dy) || !walkable(grid, me.x + dx, me.y + dy) || occupied(me.x + dx, me.y + dy))) { const [ax, ay] = DIRS[FACE4[d8] === me.face ? me.face : held]; dx = ax; dy = ay; }
    const nx = me.x + dx, ny = me.y + dy, dur = dx && dy ? 0.2 : 0.14;
    const mate = allies.find((a) => a.x === nx && a.y === ny && !a.moving);
    if (mate && walkable(grid, nx, ny)) { Object.assign(mate, { fx: mate.x, fy: mate.y, x: me.x, y: me.y, moving: true, mt: 0 }); Object.assign(me, { fx: me.x, fy: me.y, x: nx, y: ny, moving: true, mt: 0, dur }); }
    else if (walkable(grid, nx, ny) && !occupied(nx, ny)) Object.assign(me, { fx: me.x, fy: me.y, x: nx, y: ny, moving: true, mt: 0, dur });
  }
  if (started && !held) autoThink(dt);
  me.atkT = Math.max(0, me.atkT - dt); me.castT = Math.max(0, (me.castT || 0) - dt); me.hurtT = Math.max(0, me.hurtT - dt); me.cool = Math.max(0, me.cool - dt);
  me.inv = Math.max(0, me.inv - dt); me.dodgeT = Math.max(0, me.dodgeT - dt); catT = Math.max(0, catT - dt);
  updateWarns(dt); updateEshots(dt); updatePst(dt); updateLamps(dt);
  { const fx2 = { up: 10, down: -12, left: 12, right: -12 }[me.face]; const tx = cx(me) + fx2, ty = cy(me) - 14 + Math.sin(anim * 3) * 2; soulPos.x += (tx - soulPos.x) * Math.min(1, dt * 6); soulPos.y += (ty - soulPos.y) * Math.min(1, dt * 6); }
  const ranged = C.range > 1;
  if ((aHeld || autoHit) && me.cool <= 0 && !dialog && !fishing && pst.sleep <= 0 && (ranged || !me.moving) && started) basicAttack(autoTarget);
  for (const s of skills) s.t = Math.max(0, s.t - dt);
  { const st = stats(P); P.mp = Math.min(st.mpMax, (P.mp ?? st.mpMax) + st.mpRegen * dt); }
  if (shadowT > 0) { shadowT -= dt; if (shadowT <= 0 && P.cls === 'scout') res.n = 0; }
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
    if (m.pois?.t > 0 && m.dead <= 0) { m.pois.t -= dt; m.poisAcc = (m.poisAcc || 0) + m.pois.v * dt; if (m.poisAcc >= 1) { const d = Math.floor(m.poisAcc); m.poisAcc -= d; m.hp -= d; if (R() < dt * 2) float(fmt(d), cx(m), m.py * TS - 4, '#a66bd6', 0.8); if (m.hp <= 0) killMon(m); } }
    m.flash = Math.max(0, m.flash - dt); m.cool -= dt; m.spawnT = Math.max(0, m.spawnT - dt); m.frozen = Math.max(0, m.frozen - dt);
    m.kx *= 0.8; m.ky *= 0.8;
    const B = m.d.beh || {};
    if (m.angryT > 0) m.angryT -= dt;
    m.chargeT = (m.chargeT || 0) - dt;
    if (m.moving) { step(m, (m.d.boss ? 0.5 : m.dash ? 0.12 : B.fast || m.hasteT > 0 ? 0.24 : B.slow ? 0.5 : 0.35) * (m.x !== m.fx && m.y !== m.fy && !m.dash ? 1.4 : 1), dt) && ((m.walkD = (m.walkD || 0) + Math.hypot(m.x - m.fx, m.y - m.fy)), true) && (m.dash = m.dash > 1 ? m.dash - 1 : 0); continue; }
    if (started && !dialog && !m.d.boss && traitTick(m, dt)) continue;
    if (!started || dialog || m.frozen > 0 || m.d.still || m.hidden) continue;
    const tg = monTarget(m);
    const dx = tg.x - m.x, dy = tg.y - m.y, dist = Math.abs(dx) + Math.abs(dy);
    const angry = m.d.boss || m.d.elite || m.d.trial || B.aggro || m.angryT > 0 || !m.d.beh;
    const fleeing = (B.flee && m.hp < m.d.hp * 0.3) || m.retreatT > 0;
    if (!m.d.boss && angry && !fleeing && m.d.atk > 0 && tg === me) {
      if ((B.ranged || B.caster) && dist >= 2 && dist <= (B.caster ? 4 : 5) && m.cool <= 0) { monShoot(m, tg); m.cool = B.caster ? 2.6 : 2; continue; }
      if (B.charge && !B.root && m.chargeT <= 0 && dist >= 2 && dist <= 4 && (dx === 0 || dy === 0)) {
        m.chargeT = 7; m.cool = 1.2;
        warns.push({ x: tg.px, y: tg.py, r: 1.1, t: 0, life: 0.9, dmg: Math.round(m.d.atk * 1.8), kind: 'slam' });
        const sx = Math.sign(dx), sy = Math.sign(dy);
        pending.push({ t: 0.7, fn: () => { if (m.dead > 0) return; let n = 0; while (n < dist - 1 && monCanGo(m, m.x + sx * (n + 1), m.y + sy * (n + 1))) n++; if (n) Object.assign(m, { fx: m.x, fy: m.y, x: m.x + sx * n, y: m.y + sy * n, moving: true, mt: 0, dash: 1 }); burst(cx(m), cy(m), '#e8d29a', 10, 80); } });
        continue;
      }
    }
    if (angry && !fleeing && m.d.atk > 0 && Math.max(Math.abs(dx), Math.abs(dy)) === 1 && m.cool <= 0) { if (tg === me) hitPlayer(m); else allyHurt(tg, m.d.atk); m.cool = m.d.boss ? 1.2 : 1.5; m.swingAt = anim; m.faceL = tg.px < m.px; face8(m, dx, dy); continue; }
    m.think -= dt;
    if (m.think > 0) continue;
    if (B.root) continue;
    const keepAway = (B.ranged || B.caster) && dist <= 1 && angry;
    if (fleeing || keepAway) {
      m.think = 0.5;
      const a = [[-Math.sign(dx), 0], [0, -Math.sign(dy)], [-Math.sign(dx) || 1, 0], [0, -Math.sign(dy) || 1]].filter(([x, y]) => x || y);
      for (const [ox, oy] of a) if (monCanGo(m, m.x + ox, m.y + oy)) { Object.assign(m, { fx: m.x, fy: m.y, x: m.x + ox, y: m.y + oy, moving: true, mt: 0 }); break; }
      continue;
    }
    const chase = angry && dist <= (m.angryT > 0 ? Math.max(8, m.d.sight) : m.d.sight) && dist > ((B.ranged || B.caster) ? 3 : 1);
    m.think = (chase ? 0.4 : 1 + R() * 1.6) * (m.d.boss ? 1.4 : 1);
    let opts = [];
    if (chase) {
      const a = Math.abs(dx) > Math.abs(dy) ? [[Math.sign(dx), 0], [0, Math.sign(dy)]] : [[0, Math.sign(dy)], [Math.sign(dx), 0]];
      if (dx && dy && Math.max(Math.abs(dx), Math.abs(dy)) > 1) a.unshift([Math.sign(dx), Math.sign(dy)]);
      opts = a.filter(([x, y]) => x || y);
    } else if (R() < 0.6) opts = [Object.values(DIRS)[Math.floor(R() * 4)]];
    for (const [ox, oy] of opts) if (monCanGo(m, m.x + ox, m.y + oy)) { Object.assign(m, { fx: m.x, fy: m.y, x: m.x + ox, y: m.y + oy, moving: true, mt: 0 }); face8(m, ox, oy); break; }
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
    if (d.kind === 'gem' && !d.pull) { if (dist > 56 * (1 + (P.runMods?.pickup || 0) / 100)) return true; d.pull = true; d.t = lift; }
    if (dist < 6 || (d.t > 3 && d.kind !== 'gem')) { collect(d); return false; }
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
  if (showBoss) { $('bossFill').style.width = `${Math.max(0, boss.hp / boss.d.hp) * 100}%`; $('bossName').textContent = `${boss.d.name}【${profileOf(boss.type).elem}・${profileOf(boss.type).race}】` + (boss.d.mech === 'steal' && boss.stolen.size ? `（已偷走：${[...boss.stolen].map((k) => SOULS[k].name).join('、')}）` : '') + (invertT > 0 ? '　⇄ 左右顛倒中' : ''); }
}
function updateSkillUi() {
  const sb = $('soulBtn');
  sb.hidden = !P.soul;
  if (P.soul) {
    sb.style.setProperty('--fill', `${soulPower}%`); sb.style.setProperty('--sc', SOULS[P.soul].color);
    sb.classList.toggle('ready', soulPower >= 100);
    if (sb.dataset.id !== P.soul) { sb.dataset.id = P.soul; sb.querySelector('i').replaceChildren(soulIcon(P.soul, 'sbart')); }
  }
  const db = $('dodgeBtn');
  db.style.setProperty('--p', `${(me.dodgeT / 3) * 360}deg`); db.classList.toggle('ready', me.dodgeT <= 0);
  skills.forEach((s, i) => {
    const el = $(`sk${i}Btn`);
    el.classList.toggle('nomp', (P.mp ?? 0) < skillNums(P, s.id).mp * stats(P).mpCost);
    el.style.setProperty('--p', `${(s.t / (s.cd * (1 - stats(P).cdr) || 1)) * 360}deg`);
    el.querySelector('em').textContent = s.t > 0 ? Math.ceil(s.t) : '';
    el.classList.toggle('ready', s.t <= 0);
  });
}

// ---------- 繪製 ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lastCam = { x: 0, y: 0 };
function render() {
  ctx.setTransform(S, 0, 0, S, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0b0816'; ctx.fillRect(0, 0, VW, VH);
  let camX = W * TS <= VW ? Math.round((W * TS - VW) / 2) : clamp(Math.round(cx(me) - VW / 2), 0, W * TS - VW);
  let camY = H * TS <= VH ? Math.round((H * TS - VH) / 2) : clamp(Math.round(cy(me) - 4 - VH / 2), 0, H * TS - VH);
  lastCam.x = camX; lastCam.y = camY;
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
  drawZones(); drawLamps(); drawRunChest();
  for (const w of warns) {
    if (w.t < 0 || w.fired) continue;
    const k = Math.min(1, w.t / w.life), X = w.x * TS + 8, Y = w.y * TS + 10;
    ctx.fillStyle = w.kind === 'slam' ? 'rgba(255,60,80,.22)' : 'rgba(140,220,90,.22)'; ctx.beginPath(); ctx.ellipse(X, Y, w.r * 16, w.r * 11, 0, 0, 7); ctx.fill();
    ctx.fillStyle = w.kind === 'slam' ? 'rgba(255,60,80,.45)' : 'rgba(140,220,90,.45)'; ctx.beginPath(); ctx.ellipse(X, Y, w.r * 16 * k, w.r * 11 * k, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = w.kind === 'slam' ? '#ff5a6e' : '#7ad35a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(X, Y, w.r * 16, w.r * 11, 0, 0, 7); ctx.stroke();
  }
  for (const c of chests) drawChest(c);
  for (const d of drops) {
    const x = Math.round(d.x), y = Math.round(d.y - d.z);
    if (d.kind === 'gem') { const big = d.val >= 10, c = d.val >= 50 ? '#ffd166' : big ? '#c084ff' : '#7fd8ff', r = big ? 4 : 3; ctx.fillStyle = '#2a1d2e'; ctx.beginPath(); ctx.moveTo(x, y - r - 1); ctx.lineTo(x + r + 1, y); ctx.lineTo(x, y + r + 1); ctx.lineTo(x - r - 1, y); ctx.fill(); ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y - r + 1, 1, 1); continue; }
    if (d.kind === 'gear') {
      const r = rarityOf(d.val.rarity);
      if (['rare', 'epic', 'legend'].includes(r.id)) { ctx.globalAlpha = 0.35 + Math.sin(anim * 10) * 0.1; ctx.fillStyle = r.color; ctx.fillRect(x - 2, y - 40, 4, 40); ctx.globalAlpha = 1; }
      ctx.drawImage(gearIconHD(d.val), x - 6, y - 8, 12, 12);
    } else if (d.kind === 'loot') {
      const it = ITEMS[d.val.id];
      if (it.kind === 'card') { ctx.globalAlpha = 0.4 + Math.sin(anim * 12) * 0.15; ctx.fillStyle = '#ffb03b'; ctx.fillRect(x - 3, y - 48, 6, 48); ctx.globalAlpha = 1; }
      ctx.imageSmoothingEnabled = true; ctx.drawImage(itemIcon(d.val.id), x - 5, y - 7, 10, 10); ctx.imageSmoothingEnabled = false;
    } else {
      const sq = Math.abs(Math.cos(anim * 6 + d.x)) * 0.7 + 0.3;
      ctx.fillStyle = '#b8781c'; ctx.beginPath(); ctx.ellipse(x, y + 0.5, 3.4 * sq, 3.4, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.ellipse(x, y, 3 * sq, 3, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff6d0'; ctx.beginPath(); ctx.ellipse(x - sq, y - 1, 1 * sq, 1, 0, 0, 7); ctx.fill();
    }
  }
  const ents = [
    ...npcs.map((n) => ({ y: n.y, f: () => drawNpc(n, n.x * TS, n.y * TS - (Math.floor(anim * 1.6 + n.seed) % 2)) })),
    ...alive().map((m) => ({ y: m.py, f: () => drawMon(m) })),
    ...mons.filter((m) => m.dead > 0 && m.deadAt != null && anim - m.deadAt < MON_T.die && !m.hidden && monSheet(m)).map((m) => ({ y: m.py, f: () => drawMon(m) })),
    { y: me.py + 0.01, f: drawMe },
    ...allies.map((a) => ({ y: a.py + 0.005, f: () => drawAlly(a) })),
    ...(P.soul && started ? [{ y: (soulPos.y + 14 - 8) / TS + 0.02, f: () => { ctx.globalAlpha = 0.9; const sh = asset('soul_art/' + P.soul); if (sh) { ctx.imageSmoothingEnabled = true; ctx.drawImage(sh, soulPos.x - 14, soulPos.y - 26 + Math.sin(anim * 3), 28, 28); ctx.imageSmoothingEnabled = false; } else ctx.drawImage(soulSprite(P.soul, Math.floor(anim * 2) % 2), Math.round(soulPos.x - 12), Math.round(soulPos.y - 22)); ctx.globalAlpha = 1; } }] : []),
  ].sort((a, b) => a.y - b.y);
  ents.forEach((e) => e.f());
  for (const p of projs) drawProj(p);
  drawEshots(); drawPst();
  for (const f of fx) if (f.kind !== 'crack' && f.kind !== 'target') drawFx(f);
  if (fishing) {
    const bx = fishing.tx * TS + 6, by = fishing.ty * TS + 6 + (fishing.state === 'bite' ? Math.round(Math.sin(anim * 30)) : Math.round(Math.sin(anim * 3)));
    ctx.strokeStyle = 'rgba(255,248,231,.7)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(Math.round(cx(me)) + 4, Math.round(me.py * TS) - 4); ctx.lineTo(bx + 2, by); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx + 2, by + 2, 2.4, 0, 7); ctx.fill();
    ctx.fillStyle = '#e8506a'; ctx.beginPath(); ctx.arc(bx + 2, by + 2, 2.4, Math.PI, 0); ctx.fill();
    if (fishing.state === 'bite') { const ex = me.px * TS + 9, ey = me.py * TS - 22; ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(ex, ey, 5, 0, 7); ctx.fill(); ctx.fillStyle = '#2a1d2e'; ctx.fillRect(ex - 0.8, ey - 3.2, 1.6, 4); ctx.fillRect(ex - 0.8, ey + 1.6, 1.6, 1.4); }
  }
  for (const p of parts) {
    if (p.t < 0) continue;
    if (p.heart) { ctx.fillStyle = '#ff6b8a'; ctx.beginPath(); ctx.arc(p.x + 1.5, p.y + 1.5, 1.6, 0, 7); ctx.arc(p.x + 4.5, p.y + 1.5, 1.6, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(p.x, p.y + 2); ctx.lineTo(p.x + 3, p.y + 5.5); ctx.lineTo(p.x + 6, p.y + 2); ctx.fill(); }
    else { ctx.globalAlpha = Math.min(1, 1.4 - p.t / (p.life ?? 0.6)); ctx.fillStyle = p.c; const s = p.size ?? 2; ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s); }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  if (flash > 0) { ctx.fillStyle = `rgba(255,248,231,${Math.min(0.6, flash * 3)})`; ctx.fillRect(0, 0, VW, VH); }
  if (nightMode) drawNightDark(camX, camY);
  if (tintT > 0) { ctx.globalAlpha = Math.min(0.22, tintT * 1.6); ctx.fillStyle = tintC; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
  // 高解析度文字層：名字、傷害數字
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const label = (text, wx, wy, color, size) => {
    ctx.font = `${size * DPR * fsK()}px Huninn, "PingFang TC", sans-serif`;
    ctx.lineWidth = 3 * DPR; ctx.strokeStyle = '#1b1420'; ctx.strokeText(text, (wx - camX) * S, (wy - camY) * S);
    ctx.fillStyle = color; ctx.fillText(text, (wx - camX) * S, (wy - camY) * S);
  };
  if (started) { const ly = 27; label(P.name, cx(me), me.py * TS - ly, C.color, 12); if (P.meta?.title) label(`【${P.meta.title}】`, cx(me), me.py * TS - ly - 9, '#ffd166', 9); }
  for (const m of mons) if (m.d.elite && m.dead <= 0 && !m.hidden) label(`精英・${m.d.name}`, cx(m), m.py * TS - 14, ELITE_AFFIX[m.d.elite].color, 9);
  for (const a of allies) label(a.down > 0 ? `${a.c.name}（倒地）` : a.c.name, cx(a), a.py * TS - 20, a.c.color, 10.5);
  for (const d of drops) {
    if (d.kind === 'coin' || d.t > DROP_LIFT) continue;
    if (d.kind === 'gem') continue;
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
  const nid = n.id === 'guide' ? 'guide' + n.ch : n.id, pxn = asset('px/npc/' + nid);
  if (artStyle !== 'hd') { const look = n.look || (n.id === 'guide' ? CHAPTERS[n.ch - 1]?.guide?.look : null) || NPCS.find((k) => k.id === n.id)?.look; const L = layout('npc'); n.seed ??= R() * 3; drawSheet({ px: x / TS, py: y / TS, seed: n.seed }, npcSheet(nid, look), 'npc', 'idle', Math.floor((anim + n.seed) * L.anims.idle.fps) % L.anims.idle.n, D8[n.face] || 's'); return; }
  const hd = asset('npc/' + nid);
  if (hd && charStyle === 'hd') { drawHD(hd, { px: x / TS, py: y / TS, face: n.face, i: n.seed || 0 }, 40, n.face === 'left'); return; }
  if (pxn) { drawPxHero(pxn, { px: x / TS, py: y / TS, face: n.face }, true); return; }
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
  const cs = img.width / 9;
  const c = document.createElement('canvas'); c.width = cs; c.height = cs; const x = c.getContext('2d'); x.drawImage(img, 0, 0, cs, cs, 0, 0, cs, cs);
  const d = x.getImageData(0, 0, cs, cs).data; let f = cs * 0.92;
  for (let y = cs - 1; y >= 0; y--) { let hit = false; for (let i = 0; i < cs; i++) if (d[(y * cs + i) * 4 + 3] > 0) { hit = true; break; } if (hit) { f = y + 1; break; } }
  pxFeet.set(img, f); return f;
}
// 原生像素動畫圖：9 欄（待機、走 1～4、攻 1～4）× 3 列（front/back/side）；格子 48＝標準、96＝高精（畫面上一樣大，細節加倍）
function drawPxHero(sheet, o, still) {
  const x = Math.round(o.px * TS), y = Math.round(o.py * TS);
  shadow(x, y);
  const cs = sheet.width / 9, k = 48 / cs;
  const row = o.face === 'up' ? 1 : o.face === 'left' || o.face === 'right' ? 2 : 0;
  const dur = o.atkDur || 0.18;
  const col = still ? 0 : o.atkT > 0 ? 5 + Math.min(3, Math.floor((1 - o.atkT / dur) * 4)) : o.moving ? 1 + ((o.step * 2 + (o.mt > 0.5 ? 1 : 0)) % 4) : 0;
  const lunge = o.atkT > 0 ? Math.sin((1 - o.atkT / dur) * Math.PI) : 0, [dx, dy] = DIRS[o.face] || [0, 1];
  ctx.save();
  ctx.translate(x + 8 + Math.round(dx * lunge * 3), y + 17 + Math.round(dy * lunge * 2));
  if (o.face === 'left') ctx.scale(-1, 1);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheet, col * cs, row * cs, cs, cs, -24, -feetOf(sheet) * k, 48, 48);
  ctx.restore();
}
// 精緻 Q 版立繪：依螢幕解析度預先縮好（高品質），畫面上用程式做呼吸、走路擺動、攻擊前傾
const hdCache = new WeakMap();
function hdScaled(img, h) {
  const t = trimmed(img), key = Math.round(h * S);
  let m = hdCache.get(t); if (!m) hdCache.set(t, (m = new Map()));
  if (m.has(key)) return m.get(key);
  let src = t, sw = t.width, sh = t.height;
  const dh = Math.max(8, key), dw = Math.max(4, Math.round((dh * t.width) / t.height));
  while (sh / 2 > dh) { const c = document.createElement('canvas'); c.width = Math.round(sw / 2); c.height = Math.round(sh / 2); const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, c.width, c.height); src = c; sw = c.width; sh = c.height; }
  const c = document.createElement('canvas'); c.width = dw; c.height = dh; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, dw, dh);
  m.set(key, c); return c;
}
const MON_H = { slime: 22, bat: 24, ghost: 26, crab: 22, golem: 30, imp: 30 };
// ref：站姿圖。攻擊姿勢圖和站姿畫在同一張畫布、同一比例，所以用站姿的大小與腳底位置對齊
function drawHD(img, o, h, flip, extra, ref) {
  const r = trimmed(ref || img), t = trimmed(img), k = h / r.height;
  const fx = (r.bx0 || 0) + r.width / 2, fy = (r.by0 || 0) + r.height;
  const dw = t.width * k, dh = t.height * k, ox = ((t.bx0 || 0) - fx) * k, oy = ((t.by0 || 0) - fy) * k;
  const c = hdScaled(img, dh), w = r.width * k;
  const x = o.px * TS + 8 + (o.kx || 0), y = o.py * TS + 17 + (o.ky || 0);
  // 走路週期：每走兩格是一個完整週期（左腳、右腳各一步）
  const walk = o.moving ? Math.sin(((o.mt || 0) + (o.step || 0)) * Math.PI) : 0;
  const dur = o.atkDur || 0.18, ak = o.atkT > 0 ? 1 - o.atkT / dur : -1, atk = ak >= 0 ? Math.sin(ak * Math.PI) : 0;
  const pose = ref && ref !== img, lean = pose ? 0.4 : 1;
  const still = !o.moving && !atk, breathe = still ? Math.sin(anim * 2.4 + (o.i || 0) * 1.7) : 0;
  const [dx, dy] = DIRS[o.face] || [0, 1];
  const legs = o.moving && !pose && !atk && !extra?.noLegs; // 沒有走路姿勢圖時，用程式擺動下半身
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(x, y - 1, Math.max(5, w * (0.36 - Math.abs(walk) * 0.06)), 2.6, 0, 0, 7); ctx.fill();
  ctx.save();
  ctx.translate(x + dx * atk * 5, y + dy * atk * 3 - Math.abs(walk) * 2.2 + (extra?.bob || 0));
  if (flip) ctx.scale(-1, 1);
  ctx.rotate((o.moving && dx ? 0.07 : 0) + walk * (dx ? 0.03 : 0.05) + atk * lean * (dx ? 0.2 : 0.08));
  ctx.scale(1 + breathe * 0.012 + atk * lean * 0.05, 1 - breathe * 0.014 - atk * lean * 0.03 + (o.moving ? Math.abs(walk) * 0.025 : 0));
  ctx.imageSmoothingEnabled = true;
  const paint = () => {
    if (!legs) { ctx.drawImage(c, ox, oy, dw, dh); return; }
    const hip = oy + dh * 0.6, bottom = oy + dh + 2, L = ox - 30, R = dw + 60;
    // 上半身
    ctx.save(); ctx.beginPath(); ctx.rect(L, oy - 30, R, hip - oy + 30.6); ctx.clip(); ctx.drawImage(c, ox, oy, dw, dh); ctx.restore();
    if (dx) {
      // 側面：下半身以腰為軸前後擺，做出跨步
      ctx.save(); ctx.beginPath(); ctx.rect(L, hip, R, bottom - hip); ctx.clip();
      ctx.translate(0, hip); ctx.transform(1, 0, walk * 0.42, 1, 0, 0); ctx.translate(0, -hip);
      ctx.drawImage(c, ox, oy, dw, dh); ctx.restore();
    } else {
      // 正面／背面：左右腳輪流抬起
      for (const sgn of [-1, 1]) {
        const lift = Math.max(0, walk * sgn) * 2.4;
        ctx.save(); ctx.beginPath(); ctx.rect(sgn < 0 ? L : 0, hip, sgn < 0 ? -L : R, bottom - hip); ctx.clip();
        ctx.translate(sgn * lift * 0.3, -lift); ctx.drawImage(c, ox, oy, dw, dh); ctx.restore();
      }
    }
  };
  paint();
  if (extra?.flash) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6; paint(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
  ctx.restore(); ctx.imageSmoothingEnabled = false;
  return { w, h };
}
// 攻擊姿勢：有 {key}_attack 圖就在攻擊瞬間換上
const atkPose = (key, o) => (o.atkT > 0 && asset(key + '_attack')) || null;
// 走路姿勢圖：{key}_walk.png 左右並排兩格（左＝跨左腳、右＝跨右腳），四拍循環：左腳 → 站姿 → 右腳 → 站姿
const halfCache = new WeakMap();
function halfOf(img, i) {
  let m = halfCache.get(img); if (!m) halfCache.set(img, (m = []));
  if (m[i]) return m[i];
  const w = Math.floor((img.naturalWidth || img.width) / 2), h = img.naturalHeight || img.height;
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, i * w, 0, w, h, 0, 0, w, h);
  return (m[i] = c);
}
// twoBeat：隊友的站姿是四分之三角度、走路格是正側面，走路時只在兩格之間交替，不插入站姿，避免臉來回轉
function walkPose(key, o, twoBeat) {
  if (!o.moving || o.atkT > 0) return null;
  let q = Math.floor((((o.step || 0) + (o.mt || 0)) % 2) * 2);
  if (twoBeat) q = q < 2 ? 0 : 2;
  if (q === 1 || q === 3) return null;
  const strip = asset(key + '_walk');
  return strip ? halfOf(strip, q === 0 ? 0 : 1) : asset(key + (q === 0 ? '_walk1' : '_walk2'));
}
const heroKey = (L, dir) => { const view = dir === 'up' ? 'back' : dir === 'left' || dir === 'right' ? 'side' : 'front'; const k = `hero/${L.cls}_${TIER[Math.max(0, L.armorTier ?? 0)]}_${view}`; return asset(k) ? k : `hero/${L.cls}_common_${view}`; };

// ---------- 逐格像素動畫（類 RO）：正式美術 assets/sprite/... 優先，沒有就用 pxgen 暫用圖 ----------
const sheetCache = new Map();
function recolor(src, pal) {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const g = c.getContext('2d'); g.drawImage(src, 0, 0);
  if (!pal) return c;
  const map = new Map(Object.entries(pal).map(([a, b]) => [parseInt(a.slice(1), 16), parseInt(b.slice(1), 16)]));
  const d = g.getImageData(0, 0, c.width, c.height), a = d.data;
  for (let i = 0; i < a.length; i += 4) { if (!a[i + 3]) continue; const to = map.get((a[i] << 16) | (a[i + 1] << 8) | a[i + 2]); if (to !== undefined) { a[i] = to >> 16; a[i + 1] = (to >> 8) & 255; a[i + 2] = to & 255; } }
  g.putImageData(d, 0, 0); return c;
}
// 外觀：男角 sprite/hero/{cls}.png、女角 {cls}_female.png；舊存檔沒有這個欄位就是男角
const heroSheetId = (cls, body) => (body === 'female' ? cls + '_female' : cls);
function heroSheet(cls, tier, body = 'male') {
  const art = asset(sheetPath('hero', heroSheetId(cls, body))), key = `hero/${heroSheetId(cls, body)}/${tier}/${art ? 1 : 0}`; // 正式圖載入後換掉暫用圖
  if (!sheetCache.has(key)) {
    const C0 = CLASSES[cls];
    sheetCache.set(key, recolor(art || genSheet('hero', heroLookFor(cls, C0)), paletteOf(cls, C0.outfit, tier)));
  }
  return sheetCache.get(key);
}
function npcSheet(id, look) {
  const art = asset(sheetPath('npc', id)), key = `npc/${id}/${art ? 1 : 0}`;
  if (!sheetCache.has(key)) { sheetCache.set(key, art || genSheet('npc', npcLookFor({ look }))); }
  return sheetCache.get(key);
}
function monSheet(m) {
  if (m.d.decoy || m.d.tpl === 'mirror') return null; // 魔鏡、千面商人的假路人另外畫
  const art = asset(sheetPath('mon', m.type)); if (!art) return null;
  const isBossSheet = !!MONSTERS[m.type]?.boss; // 圖的格子大小由這張圖本身決定（小露滴王也用魔王的圖）
  return { img: art, kind: isBossSheet ? 'boss' : monKind({ boss: false, size: profileOf(m.type).size }), scale: isBossSheet && !m.d.boss ? 0.4 : 1 };
}
// 畫一格：腳底對齊格子底、1 原生像素 = 0.5 遊戲像素（螢幕上永遠是整數倍）
function drawSheet(o, img, kind, anim, i, dir8, scale = 1) {
  const L = layout(kind), a = L.anims[anim] ? anim : 'idle', [cw, ch] = L.cell;
  const src = MIRROR[dir8] || dir8 || 's', row = Math.max(0, DRAWN.indexOf(src));
  const fi = Math.max(0, Math.min(L.anims[a].n - 1, i | 0));
  const fx = Math.round((o.px * TS + 8 + (o.kx || 0)) * 2) / 2, fy = Math.round((o.py * TS + 16 + (o.ky || 0)) * 2) / 2;
  shadow(Math.round(o.px * TS), Math.round(o.py * TS), kind === 'boss' && scale === 1 ? 26 : 12);
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.translate(fx, fy - L.foot / 2);
  if (scale !== 1) { ctx.translate(0, L.foot / 2); ctx.scale(scale, scale); ctx.translate(0, -L.foot / 2); }
  if (MIRROR[dir8]) ctx.scale(-1, 1);
  ctx.drawImage(img, (L.col[a] + fi) * cw, row * ch, cw, ch, -cw / 4, 0, cw / 2, ch / 2);
  ctx.restore();
}
// 動作狀態：走路的格數跟著實際走的距離（走 2 格剛好 8 格），腳步不會滑
function charAnim(o, L, extra = {}) {
  if (extra.sit && L.anims.sit) return ['sit', 0];
  if (o.atkT > 0 && L.anims.attack) { const k = 1 - o.atkT / (o.atkDur || 0.2); return [o.castT > 0 && L.anims.cast ? 'cast' : 'attack', Math.floor(k * L.anims[o.castT > 0 && L.anims.cast ? 'cast' : 'attack'].n)]; }
  if (o.hurtT > 0 && L.anims.hurt) return ['hurt', o.hurtT > 0.2 ? 0 : 1];
  if (o.moving) { const d = (o.walkD || 0) + (o.mt || 0) * Math.hypot(o.x - o.fx, o.y - o.fy); return ['walk', Math.floor(d * 4) % L.anims.walk.n]; }
  return ['idle', Math.floor((anim + (o.seed || 0)) * L.anims.idle.fps) % L.anims.idle.n];
}
function drawHeroSprite() {
  if (artStyle === 'hd') return false;
  const tier = Math.max(0, myLook?.armorTier ?? 0), img = heroSheet(P.cls, tier, P.body), L = layout('hero');
  const [a, i] = charAnim(me, L, { sit: pst.sleep > 0 });
  if (myLook?.aura) { ctx.globalAlpha = 0.25 + Math.sin(anim * 4) * 0.08; ctx.fillStyle = '#ffd75e'; ctx.beginPath(); ctx.ellipse(me.px * TS + 8, me.py * TS + 15, 12, 4, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  if (me.inv > 0) ctx.globalAlpha = 0.6;
  drawSheet(me, img, 'hero', a, i, me.dir8 || D8[me.face]);
  ctx.globalAlpha = 1;
  return true;
}
function drawMe() {
  if (drawHeroSprite()) return;
  const x = Math.round(me.px * TS), y = Math.round(me.py * TS);
  const frame = animFrame(me, me.atkDur || 0.18);
  if (charStyle === 'hd') { const im = heroImg(myLook, me.face), ai = me.atkT > 0 ? heroImg(myLook, me.face, true) : null, pose = (ai && ai !== im ? ai : null) || (im && walkPose(heroKey(myLook, me.face), me)); if (im) { if (me.hurtT > 0 && Math.floor(me.hurtT * 20) % 2) { shadow(x, y); return; } if (me.inv > 0) ctx.globalAlpha = 0.6; drawHD(pose || im, me, 40, me.face === 'left', null, pose ? im : null); ctx.globalAlpha = 1; return; } }
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
  if (a.down > 0) { const im = asset('npc/ally_' + a.id); ctx.globalAlpha = 0.5; ctx.save(); ctx.translate(x + 8, y + 14); ctx.rotate(Math.PI / 2); if (im) { const t = trimmed(im), h = 34, w = (h * t.width) / t.height; ctx.imageSmoothingEnabled = true; ctx.drawImage(hdScaled(im, h), -h, -w / 2, h, w); ctx.imageSmoothingEnabled = false; } else ctx.drawImage(avatar(a.c.look, 'down', 0), -12, -16, AW, AH); ctx.restore(); ctx.globalAlpha = 1; return; }
  if (a.hurtT > 0 && Math.floor(a.hurtT * 20) % 2) { shadow(x, y); return; }
  const frame = animFrame(a, a.atkDur || 0.18);
  const hd = asset('npc/ally_' + a.id), pxa = asset('px/ally/' + a.id);
  if (hd && charStyle === 'hd') { const ap = atkPose('npc/ally_' + a.id, a) || walkPose('npc/ally_' + a.id, a, true); drawHD(ap || hd, a, 40, a.face === 'left', null, ap ? hd : null); }
  else if (pxa) drawPxHero(pxa, a);
  else if (hd) { drawIllus(hd, a); }
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
// 怪物逐格動畫：死亡 > 施法（魔王）> 攻擊 > 受傷 > 走路 > 待機
const MON_T = { die: 0.5, cast: 0.6, attack: 0.4, hurt: 0.25 };
function monAnim(m, L) {
  const since = (t) => (t == null ? Infinity : anim - t), fr = (name, t) => Math.min(L.anims[name].n - 1, Math.floor((t / MON_T[name]) * L.anims[name].n));
  if (m.dead > 0) return ['die', fr('die', since(m.deadAt))];
  if (L.anims.cast && since(m.castAt) < MON_T.cast) return ['cast', fr('cast', since(m.castAt))];
  if (since(m.swingAt) < MON_T.attack) return ['attack', fr('attack', since(m.swingAt))];
  if (since(m.hurtAt) < MON_T.hurt) return ['hurt', fr('hurt', since(m.hurtAt))];
  if (m.moving) { const d = (m.walkD || 0) + (m.mt || 0) * Math.hypot(m.x - m.fx, m.y - m.fy); return ['walk', Math.floor(d * L.anims.walk.n / 2) % L.anims.walk.n]; }
  return ['idle', Math.floor(m.anim * L.anims.idle.fps) % L.anims.idle.n];
}
// 逐格像素怪物＋精英光圈、受擊閃光、冰凍、護盾、血條
function drawMonSprite(m, ms) {
  const L = layout(ms.kind), [a, i] = monAnim(m, L), dir = m.dir8 || (m.faceL ? 'w' : 's');
  const sc = ms.scale * (m.d.elite === 'giant' ? 1.3 : 1) * (m.spawnT > 0 ? Math.max(0.2, 1 - m.spawnT * 2) : 1), hh = (L.height / 2) * sc;
  const x = Math.round(m.px * TS + m.kx), y = Math.round(m.py * TS + m.ky), big = m.d.boss;
  if (m.d.elite && m.dead <= 0) { ctx.globalAlpha = 0.35 + Math.sin(anim * 6) * 0.15; ctx.fillStyle = ELITE_AFFIX[m.d.elite].color; ctx.beginPath(); ctx.ellipse(x + 8, y + 15, Math.max(9, hh * 0.45), 5, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  drawSheet(m, ms.img, ms.kind, a, i, dir, sc);
  if (m.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6; drawSheet(m, ms.img, ms.kind, a, i, dir, sc); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
  if (m.frozen > 0) { ctx.fillStyle = 'rgba(150,220,255,.35)'; ctx.fillRect(x + 8 - hh * 0.4, y + 16 - hh, hh * 0.8, hh); }
  if (m.shield) { ctx.strokeStyle = 'rgba(189,241,255,.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x + 8, y + 16 - hh / 2, hh * 0.6, 0, 7); ctx.stroke(); }
  if (m.dead <= 0 && m.hp < m.d.hp && !big) { ctx.fillStyle = '#2a1d2e'; ctx.fillRect(x + 1, y + 18, 14, 4); ctx.fillStyle = '#e8506a'; ctx.fillRect(x + 2, y + 19, Math.max(1, Math.round(12 * Math.max(0, m.hp) / m.d.hp)), 2); }
}
function drawMon(m) {
  { const ms = !m.lurk && monSheet(m); if (ms) { drawMonSprite(m, ms); return; } }
  if (m.lurk) { const X = Math.round(m.px * TS), Y = Math.round(m.py * TS); ctx.fillStyle = 'rgba(42,29,46,.45)'; ctx.beginPath(); ctx.ellipse(X + 8, Y + 13, 6, 2.5, 0, 0, 7); ctx.fill(); if (Math.sin(anim * 2 + m.x) > 0.8) { ctx.fillStyle = '#ffd166'; ctx.fillRect(X + 6, Y + 9, 1, 1); ctx.fillRect(X + 9, Y + 9, 1, 1); } return; }
  const x = Math.round(m.px * TS + m.kx), y = Math.round(m.py * TS + m.ky);
  if (m.d.decoy) { const hdn = asset('npc/' + m.npcId); if (hdn && charStyle === 'hd') { drawHD(hdn, { px: m.px, py: m.py, kx: m.kx, ky: m.ky, face: 'down', i: 3 }, 40, false); return; } if (!m.real) shadow(x, y); const pxn = asset('px/npc/' + m.npcId); if (pxn) { drawPxHero(pxn, { px: m.px + m.kx / TS, py: m.py + m.ky / TS, face: 'down' }, true); return; } const im = asset('npc/' + m.npcId); if (im) { const p = pixelize(im, PX_CHAR); ctx.drawImage(p, x + 8 - Math.round(p.width / 2), y + 17 - p.height); } else ctx.drawImage(avatar(m.look, 'down', 0), x - 4, y - 17, AW, AH); return; }
  const hdm = charStyle === 'hd' && asset('monster/' + (m.d.tpl === 'mirror' ? 'mirror_obj' : m.type));
  if (hdm) {
    const big = m.d.boss, frozen = m.frozen > 0;
    const hh = (big ? 58 : MON_H[m.d.tpl] || 26) * (m.d.elite === 'giant' ? 1.3 : 1) * (m.spawnT > 0 ? Math.max(0.2, 1 - m.spawnT * 2) : 1);
    if (m.d.elite) { ctx.globalAlpha = 0.35 + Math.sin(anim * 6) * 0.15; ctx.fillStyle = ELITE_AFFIX[m.d.elite].color; ctx.beginPath(); ctx.ellipse(x + 8, y + 15, hh * 0.55, 5, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    const swing = m.swingAt != null && anim - m.swingAt < 0.3, faceL = m.faceL ?? me.px < m.px;
    const o = { px: m.px, py: m.py, kx: m.kx, ky: m.ky, face: faceL ? 'left' : 'right', atkT: swing ? 0.3 - (anim - m.swingAt) : 0, atkDur: 0.3, i: m.anim };
    const mp = m.d.tpl !== 'mirror' && atkPose('monster/' + m.type, o);
    const { w } = drawHD(mp || hdm, o, hh, faceL, { bob: frozen ? 0 : Math.sin(m.anim * 5) * (big ? 1.2 : 0.8), flash: m.flash > 0 }, mp ? hdm : null);
    if (frozen) { ctx.fillStyle = 'rgba(150,220,255,.4)'; ctx.fillRect(x + 8 - w / 2, y + 17 - hh, w, hh); }
    if (m.shield) { ctx.strokeStyle = 'rgba(189,241,255,.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x + 8, y + 17 - hh / 2, hh * 0.65, 0, 7); ctx.stroke(); }
    if (m.hp < m.d.hp && !big) { ctx.fillStyle = '#2a1d2e'; ctx.fillRect(x + 1, y + 18, 14, 4); ctx.fillStyle = '#e8506a'; ctx.fillRect(x + 2, y + 19, Math.max(1, Math.round((m.hp / m.d.hp) * 12)), 2); }
    return;
  }
  const pxm = m.d.tpl !== 'mirror' && asset('px/monster/' + m.type);
  if (pxm) {
    const big = m.d.boss, cs = pxm.height, dw = big ? 64 : 32, frozen = m.frozen > 0;
    shadow(x, y, big ? 24 : 13);
    if (m.d.elite) { ctx.globalAlpha = 0.35 + Math.sin(anim * 6) * 0.15; ctx.fillStyle = ELITE_AFFIX[m.d.elite].color; ctx.beginPath(); ctx.ellipse(x + 8, y + 15, 13, 5, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    const col = !frozen && m.swingAt != null && anim - m.swingAt < 0.3 ? 2 + (anim - m.swingAt > 0.15 ? 1 : 0) : frozen ? 0 : Math.floor(m.anim * 2.4) % 2;
    const draw = () => { ctx.save(); ctx.translate(x + 8, y + 17); if (m.faceL) ctx.scale(-1, 1); ctx.drawImage(pxm, col * cs, 0, cs, cs, -dw / 2, -dw, dw, dw); ctx.restore(); };
    draw();
    if (m.flash > 0) { ctx.globalCompositeOperation = 'lighter'; draw(); ctx.globalCompositeOperation = 'source-over'; }
    if (frozen) { ctx.fillStyle = 'rgba(150,220,255,.4)'; ctx.fillRect(x + 8 - dw / 2, y + 16 - dw * 0.85, dw, dw * 0.8); }
    if (m.shield) { ctx.strokeStyle = 'rgba(189,241,255,.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x + 8, y + 16 - dw / 2, dw * 0.6, 0, 7); ctx.stroke(); }
    if (m.hp < m.d.hp && !big) { ctx.fillStyle = '#2a1d2e'; ctx.fillRect(x + 1, y + 17, 14, 4); ctx.fillStyle = '#e8506a'; ctx.fillRect(x + 2, y + 18, Math.max(1, Math.round((m.hp / m.d.hp) * 12)), 2); }
    return;
  }
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
      ctx.globalAlpha = 0.45 * (1 - k); { const hi = heroImg(myLook, f.face); if (hi) { drawHD(hi, { px: f.x, py: f.y, face: f.face }, 40, f.face === 'left'); break; } const g0 = heroImg(myLook, f.face) || avatar(myLook, f.face, 1); const p = g0.width > AW ? pixelize(g0, PX_CHAR) : g0; ctx.drawImage(p, Math.round(f.x * TS) + 8 - Math.round(p.width / 2), Math.round(f.y * TS) + 17 - p.height); }
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
  for (let k = 0; k < timeK; k++) update(dt); // timeK：只有除錯模式的平衡試玩會調快
  if (started) bossIntro();
  updateSkillUi();
  render();
}

// ---------- 標題與選職業 ----------
let pickCls = 'sword', pickBody = 'male', previewT = null;
// 選職業畫面的像素預覽：取動畫表裡某一格
function spriteFrame(cls, tier, body, anim = 'idle', i = 0, z = 1) {
  const L = layout('hero'), [cw, ch] = L.cell, img = heroSheet(cls, tier, body);
  const c = document.createElement('canvas'); c.width = cw * z; c.height = (ch - 6) * z; c.className = 'pxprev';
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, (L.col[anim] + i) * cw, 0, cw, ch - 6, 0, 0, cw * z, (ch - 6) * z);
  return c;
}
function start() {
  if (started) return;
  started = true;
  $('title').hidden = true; $('classPanel').hidden = true;
  $('ui').hidden = false;
  refresh(P); setupClass(); hud();
  checkOffline();
  if (P.ch === 1 && P.step === 0 && P.lv === 1) say('村長・歐文', [`歡迎來到守燈村，${C.name}${P.name}！`, '按住紅色「攻擊」鍵連續攻擊，旁邊三顆是職業專屬技能。', '懶得操作就按左上的「自動」，角色會自己去打怪！', '先來廣場北邊找我說話吧。']);
}
function buildClassGrid() {
  const px = artStyle !== 'hd';
  $('classGrid').replaceChildren(...CLASS_IDS.map((id) => {
    const c = CLASSES[id];
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'classcard'; b.dataset.cls = id; b.style.setProperty('--c', c.color);
    const art = document.createElement('div'); art.className = 'cart';
    if (px) art.append(spriteFrame(id, 0, pickBody), document.createTextNode('→'), spriteFrame(id, 4, pickBody));
    else {
      const base = lookOf({ cls: id, gear: {} }, CLASSES, rarityIdx);
      const leg = lookOf({ cls: id, gear: { armor: { rarity: 'legend' }, weapon: { rarity: 'legend' }, helm: { rarity: 'legend' } } }, CLASSES, rarityIdx);
      art.append(previewCanvas(base, 2), document.createTextNode('→'), previewCanvas(leg, 2));
    }
    b.append(art);
    b.insertAdjacentHTML('beforeend', `<b>${c.name}</b><span class="role">${c.role}</span><span class="cdesc">${c.desc}</span><span class="cskills">${c.skills.map((s) => s.name).join('・')}</span>`);
    b.addEventListener('click', () => { pickCls = id; document.querySelectorAll('.classcard').forEach((x) => x.classList.toggle('on', x === b)); });
    return b;
  }));
  document.querySelectorAll('.classcard').forEach((x) => x.classList.toggle('on', x.dataset.cls === pickCls));
  document.querySelectorAll('#bodyPick button').forEach((x) => x.classList.toggle('on', x.dataset.body === pickBody));
  // 選中的職業播走路動畫，看得出動作
  clearInterval(previewT);
  if (px) { let f = 0; previewT = setInterval(() => { if ($('classPanel').hidden) return clearInterval(previewT); const card = document.querySelector('.classcard.on .cart canvas'); if (!card) return; f = (f + 1) % 8; const g = card.getContext('2d'), fr = spriteFrame(pickCls, 0, pickBody, 'walk', f); g.clearRect(0, 0, card.width, card.height); g.drawImage(fr, 0, 0); }, 110); }
}
document.querySelectorAll('#bodyPick button').forEach((b) => b.addEventListener('click', () => { pickBody = b.dataset.body; buildClassGrid(); }));
$('newBtn').addEventListener('click', () => { buildClassGrid(); $('overwriteNote').hidden = !hasSave; $('title').hidden = true; $('classPanel').hidden = false; });
$('classBack').addEventListener('click', () => { $('classPanel').hidden = true; $('title').hidden = false; });
$('classGo').addEventListener('click', () => {
  P = ensureParty(ensureInv(newPlayer(pickCls, $('nameInput').value.trim() || '冒險者', pickBody))); autoAllocate(P);
  soulPower = 0; loadMap(0);
  Object.assign(me, { x: P.x, y: P.y, px: P.x, py: P.y, fx: P.x, fy: P.y, moving: false, face: 'down' });
  drops = []; projs = []; pending = []; fx = [];
  save(); start();
});
$('startBtn').addEventListener('click', start);
const wakeAudio = () => { initAudio(); playSong(pickSong()); };
addEventListener('pointerdown', wakeAudio, { capture: true }); addEventListener('keydown', wakeAudio, { capture: true });
document.addEventListener('click', (e) => { if (e.target.closest('button') && !e.target.closest('.acts')) sfx('ui'); }, true);
const SOUND_MODES = [['開', 0.55, 0.8], ['只有音效', 0, 0.8], ['靜音', 0, 0]];
function syncSoundBtn() { const i = SOUND_MODES.findIndex(([, b, f]) => (audioOpt.bgm > 0) === (b > 0) && (audioOpt.sfx > 0) === (f > 0)); $('soundBtn').textContent = `♪ ${SOUND_MODES[Math.max(0, i)][0]}`; return Math.max(0, i); }
$('soundBtn').addEventListener('click', () => { const [, b, f] = SOUND_MODES[(syncSoundBtn() + 1) % SOUND_MODES.length]; audioOpt.bgm = b; audioOpt.sfx = f; saveAudioOpt(); syncSoundBtn(); });
syncSoundBtn();

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
if (location.search.includes('debug')) globalThis.__game = { showCutin, get allies() { return allies; }, buildAllies, get P() { return P; }, newDrop, get drops() { return drops; }, set dropsAdd(d) { drops.push(d); }, me, get grid() { return grid; }, loadMap, get mapId() { return mapId; }, get mons() { return mons; }, get fishing() { return fishing; }, get dialog() { return dialog; }, get drops() { return drops; }, get skills() { return skills; }, castIdx, startTower, get trial() { return trial; }, renderAdv, hud, audioLevel, currentSong, sfx, get chests() { return chests; }, say, renderPartyPanel, renderShop, useItem, addStack, get eshots() { return eshots; }, get warns() { return warns; }, pst, TR, killMon, hitPlayer, dealDamage, set mons(v) { mons = v; }, startRun, get run() { return run; }, endRun, openExped, equipBest, STAGES, openCards, get cardOpen() { return cardOpen; }, get pendingN() { return pending.length; }, set timeK(v) { timeK = Math.max(1, Math.min(12, v | 0)); }, get cutinT() { return cutinT; }, monAnim, layout, monSheet, heroSheet, setArt(v) { artStyle = v; applyArt(); }, asset, get anim() { return anim; }, toCss: (wx, wy) => [(wx - lastCam.x) * S / DPR, (wy - lastCam.y) * S / DPR], MONSTERS, ITEMS, CHAPTERS, newDropLoot: (id, x, y) => drops.push(newDrop('loot', x, y, { id, n: 1 })), renderBag: () => { if (typeof renderBag === 'function') renderBag(); }, skillsList: () => skills.map((k) => k.id), get lamps() { return lamps; }, inLight, get deathN() { return deathN; }, rollGear, SLOTS, R, stats: () => stats(P) };
