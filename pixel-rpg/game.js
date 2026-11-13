import {
  W, H, T, TOWN_EDGE, FIELD_MIN_X, BOSS_ZONE, HOUSES, NPCS, SIGN, SPAWN, INN_SPOT, buildWorld, walkable,
  MONSTERS, ROSTER, expNeed, stats, swordCost, POTION_PRICE, POTION_HEAL_PCT, FISH, rollFish, gainExp, newPlayer, loadPlayer,
  rollGear, rarityOf, rarityIdx, equipIfBetter, SLOTS, SLOT_NAME, DROP_RATE, CLASSES, CLASS_IDS,
} from './world.js';
import { PAL, SLIME, CROWN, BOBBER, BANG, HEART, COIN, ORB, makeSprite, SLIME_COLORS, drawMap } from './sprites.js';
import { avatar, lookOf, npcLook, AW, AH } from './avatar.js';

const KEY = 'glimmer-rpg-v1';
const $ = (id) => document.getElementById(id);
const TS = 16, VW = 10 * TS, VH = 11 * TS, SC = 6;
const cv = $('cv');
const ctx = cv.getContext('2d');
const grid = buildWorld();
const mapC = document.createElement('canvas');
mapC.width = W * TS; mapC.height = H * TS;
drawMap(mapC.getContext('2d'), grid, T, HOUSES);

const npcs = NPCS.map((n, i) => ({ ...n, face: n.id === 'fisher' ? 'right' : 'down', L: npcLook(n), seed: i }));
const slimeS = {};
for (const k of Object.keys(SLIME_COLORS)) slimeS[k] = SLIME.map((f) => makeSprite(f, { ...PAL, ...SLIME_COLORS[k] }));
const crownS = makeSprite(CROWN), bobberS = makeSprite(BOBBER), bangS = makeSprite(BANG), heartS = makeSprite(HEART), coinS = makeSprite(COIN);
const orbS = {};
for (const r of ['common', 'good', 'rare', 'epic', 'legend']) orbS[r] = makeSprite(ORB, { ...PAL, x: rarityOf(r).color });

let hasSave = false, P;
try { const raw = localStorage.getItem(KEY); hasSave = !!raw; P = loadPlayer(raw); } catch { P = newPlayer(); }
if (!walkable(grid, P.x, P.y)) { P.x = SPAWN.x; P.y = SPAWN.y; }
const me = { x: P.x, y: P.y, px: P.x, py: P.y, fx: P.x, fy: P.y, face: 'down', moving: false, mt: 0, dur: 0.14, step: 0, atkT: 0, hurtT: 0, cool: 0 };
function save() { P.x = me.x; P.y = me.y; hasSave = true; try { localStorage.setItem(KEY, JSON.stringify(P)); } catch { /* 無痕模式不存 */ } }

const R = Math.random;
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
let C = CLASSES[P.cls], skills = [], myLook = null;
let mons = [], floats = [], parts = [], drops = [], fx = [], projs = [], pending = [];
let dialog = null, fishing = null, started = false, held = null, aHeld = false, auto = false, autoHit = false, autoCastT = 0;
let anim = 0, regenT = 0, saveT = 0, shake = 0, freeze = 0, flash = 0, combo = 0, comboT = 0, auraT = 0;
const fmt = (n) => Math.round(n).toLocaleString('en-US');
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
}

// ---------- 怪物 ----------
const inBoss = (x, y) => x >= BOSS_ZONE.x0 && x <= BOSS_ZONE.x1 && y >= BOSS_ZONE.y0 && y <= BOSS_ZONE.y1;
function occupied(x, y, self) {
  if (me.x === x && me.y === y) return true;
  if (npcs.some((n) => n.x === x && n.y === y)) return true;
  return mons.some((m) => m !== self && m.dead <= 0 && m.x === x && m.y === y);
}
const monCanGo = (m, x, y) => walkable(grid, x, y) && x >= FIELD_MIN_X && !occupied(x, y, m) && (m.d.boss ? inBoss(x, y) : !inBoss(x, y));
function spawnTile(m) {
  for (let i = 0; i < 300; i++) {
    let x, y;
    if (m.d.boss) { x = BOSS_ZONE.x0 + 1 + Math.floor(R() * 5); y = BOSS_ZONE.y0 + 1 + Math.floor(R() * 4); }
    else { const [a, b] = m.d.zone; x = a + Math.floor(R() * (b - a + 1)); y = 1 + Math.floor(R() * (H - 2)); if (inBoss(x, y)) continue; }
    if (x >= FIELD_MIN_X && walkable(grid, x, y) && !occupied(x, y) && Math.abs(x - me.x) + Math.abs(y - me.y) > 3) return { x, y };
  }
  return null;
}
function placeMon(m) {
  const t = spawnTile(m);
  if (!t) { m.dead = 1; return; }
  Object.assign(m, { x: t.x, y: t.y, px: t.x, py: t.y, fx: t.x, fy: t.y, moving: false, hp: m.d.hp, dead: 0, cool: 1, think: R() * 1.5, flash: 0, kx: 0, ky: 0, spawnT: 0.4, frozen: 0 });
}
mons = ROSTER.map((type) => { const m = { type, d: MONSTERS[type], anim: R() * 2 }; placeMon(m); return m; });
const alive = () => mons.filter((m) => m.dead <= 0);
const tdist = (m, x, y) => Math.hypot(m.px - x, m.py - y);
function nearest(range, from = me) { let best = null, bd = 1e9; for (const m of alive()) { const d = tdist(m, from.px, from.py); if (d <= range + (m.d.boss ? 0.6 : 0) && d < bd) { bd = d; best = m; } } return best; }

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
  myLook = lookOf(P, CLASSES, rarityIdx);
  $('lv').textContent = P.lv;
  $('clsName').textContent = C.name;
  $('clsName').style.color = C.color;
  $('hpBar').style.width = `${Math.max(0, P.hp / st.hp) * 100}%`;
  $('hpText').textContent = `${fmt(Math.max(0, P.hp))} / ${fmt(st.hp)}`;
  $('xpBar').style.width = `${(P.exp / expNeed(P.lv)) * 100}%`;
  $('xpText').textContent = `${Math.floor((P.exp / expNeed(P.lv)) * 100)}%`;
  $('coins').textContent = fmt(P.coins);
  $('cp').textContent = fmt(st.cp);
  if (lastCp && st.cp !== lastCp) bump('cpBox');
  lastCp = st.cp;
  $('potions').textContent = P.potions;
  $('quest').textContent = questText();
}
function questText() {
  return ['找廣場北邊的村長歐文聊聊', `打倒史萊姆 ${Math.min(P.kills, 20)} / 20，再回報村長`, `挑戰東北方的史萊姆王（建議戰鬥力 ${fmt(1800)}）`,
    '回村子告訴村長好消息', '自由狩獵：刷傳說裝備、換上最帥的外觀'][P.quest] || '';
}
function previewCanvas(L, size = 4, dir = 'down') {
  const c = document.createElement('canvas'); c.width = AW * size; c.height = AH * size;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(avatar(L, dir, 0), 0, 0, AW * size, AH * size); return c;
}
function renderGear() {
  $('gearDoll').replaceChildren(previewCanvas(myLook, 4, 'down'), previewCanvas(myLook, 4, 'right'));
  $('gearList').innerHTML = SLOTS.map((s) => {
    const it = P.gear[s];
    if (!it) return `<div class="gslot"><span class="gname muted">${SLOT_NAME[s]}：未裝備</span></div>`;
    const r = rarityOf(it.rarity);
    return `<div class="gslot" style="border-color:${r.color}"><span class="gtag" style="background:${r.color}">${r.name}</span><span class="gname" style="color:${r.color}">${it.name}</span><span class="gval">${it.stat === 'atk' ? '攻擊' : 'HP'} +${fmt(it.val)}</span></div>`;
  }).join('') + `<p class="muted small">裝備稀有度越高，角色外觀越華麗：史詩有披風與翅膀，傳說會發出金色光芒。</p>`;
}
$('gearBtn').addEventListener('click', () => { if (!started) return; renderGear(); $('gearPanel').hidden = false; });
$('gearClose').addEventListener('click', () => { $('gearPanel').hidden = true; });

// ---------- 對話 ----------
function say(name, lines, opts) { dialog = { name, lines, i: 0, opts }; showDialog(); }
function showDialog() {
  const d = dialog;
  $('dialog').hidden = !d;
  if (!d) return;
  $('dlgName').textContent = d.name;
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
  dialog = null; showDialog();
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
    if (P.quest === 0) { P.quest = 1; P.kills = 0; say(nm, [`${P.name}，你來得正好！草原上的史萊姆多到快滿出來了。`, '過了東邊的橋就是史萊姆草原。', '幫我清掉 20 隻。懶得操作就按「自動」吧！']); }
    else if (P.quest === 1 && P.kills >= 20) { P.quest = 2; P.coins += 200; P.potions += 3; say(nm, ['太厲害了！這是謝禮：200 金幣和 3 瓶藥水。', '東北方的空地住著史萊姆王，牠必掉稀有以上的裝備。', `戰鬥力到 ${fmt(1800)} 左右再去挑戰吧。`]); }
    else if (P.quest === 1) say(nm, [`還差 ${20 - P.kills} 隻，加油！`]);
    else if (P.quest === 2) say(nm, ['史萊姆王很硬，把大招留著對付牠。', '先刷裝備、到鐵匠鋪強化武器，再去挑戰。']);
    else if (P.quest === 3) { P.quest = 4; P.coins += 500; say(nm, ['你真的打倒了史萊姆王！', `${P.name}，你是微光村的英雄。收下這 500 金幣吧！`]); }
    else say(nm, ['英雄，草原上的史萊姆又長回來了，隨時去刷吧！']);
  } else if (n.id === 'inn') {
    P.hp = stats(P).hp;
    say(nm, ['歡迎來到微光旅店！', '（你好好休息了一下，HP 全部恢復了）']);
  } else if (n.id === 'smith') {
    smithMenu(nm, [`你的武器強化是 +${P.sword}。`, `強化到 +${P.sword + 1} 要 ${fmt(swordCost(P.sword))} 金幣。`]);
  } else if (n.id === 'fisher') {
    say(nm, ['想釣魚嗎？面向河邊按攻擊鍵就能拋竿。', '浮標旁邊跳出「！」的時候，馬上再按一次！', '釣到的魚可以賣給雜貨店的莉莉。']);
  }
  hud(); save();
}
function shopMenu(nm, lines) {
  say(nm, lines, [[`買藥水（${POTION_PRICE} 金幣）`, () => {
    if (P.coins < POTION_PRICE) shopMenu(nm, ['金幣不夠喔，去打怪賺一點吧。']);
    else { P.coins -= POTION_PRICE; P.potions++; shopMenu(nm, [`謝謝惠顧！你現在有 ${P.potions} 瓶藥水。`]); }
  }], ['離開', null]]);
}
function smithMenu(nm, lines) {
  say(nm, lines, [[`強化（${fmt(swordCost(P.sword))} 金幣）`, () => {
    const c = swordCost(P.sword);
    if (P.coins < c) smithMenu(nm, [`還差 ${fmt(c - P.coins)} 金幣。`]);
    else { const before = stats(P).cp; P.coins -= c; P.sword++; popCp(before, stats(P).cp); smithMenu(nm, [`叮叮噹噹……完成！武器變成 +${P.sword} 了。`, `下一次強化要 ${fmt(swordCost(P.sword))} 金幣。`]); }
  }], ['離開', null]]);
}

// ---------- 傷害與掉落 ----------
function hitPlayer(m) {
  if (fishing) { fishing = null; floatT('魚跑了', me.x, me.y - 0.5, '#bdf1ff'); }
  P.hp -= m.d.atk; me.hurtT = 0.4; shake = Math.max(shake, 0.12);
  floatT(`-${m.d.atk}`, me.x, me.y, '#ff5a6e');
  if (P.hp <= 0) {
    P.hp = stats(P).hp; auto = false; syncAuto();
    Object.assign(me, { x: INN_SPOT.x, y: INN_SPOT.y, px: INN_SPOT.x, py: INN_SPOT.y, moving: false, face: 'down' });
    say('旅店・瑪莎', ['你昏倒在草原上，被路過的冒險者送回來了。', '提升戰鬥力再去吧！HP 已經恢復了。']);
  } else if (auto && P.hp < stats(P).hp * 0.35 && P.potions > 0) usePotion();
  hud();
}
function dealDamage(m, mult, fromX = me.px, fromY = me.py, color) {
  if (m.dead > 0 || m.hp <= 0) return;
  const crit = R() < 0.15;
  const dmg = Math.max(1, Math.round(stats(P).atk * mult * (0.85 + R() * 0.3) * (crit ? 2 : 1)));
  m.hp -= dmg; m.flash = 0.12;
  const a = Math.atan2(m.py - fromY, m.px - fromX);
  m.kx = Math.cos(a) * 4; m.ky = Math.sin(a) * 4;
  float(crit ? `${fmt(dmg)}!` : fmt(dmg), cx(m) + (R() - 0.5) * 12, m.py * TS - 2 - R() * 6, crit ? '#ff9f1c' : (color || '#fff8e7'), crit ? 1.45 : 1);
  burst(cx(m), cy(m) + 2, SLIME_COLORS[m.type].g, crit ? 9 : 4);
  combo++; comboT = 2.2; showCombo();
  freeze = Math.max(freeze, crit ? 0.06 : 0.025);
  if (crit) shake = Math.max(shake, 0.1);
  if (m.hp <= 0) killMon(m);
}
function hitArea(tx, ty, radius, mult, color, each) {
  for (const m of alive()) if (tdist(m, tx, ty) <= radius + (m.d.boss ? 0.8 : 0)) { dealDamage(m, mult, tx, ty, color); each?.(m); }
}
function killMon(m) {
  const wx = cx(m), wy = cy(m);
  m.dead = m.d.boss ? 30 : 2.5;
  burst(wx, wy, SLIME_COLORS[m.type].l, m.d.boss ? 40 : 14, m.d.boss ? 140 : 90);
  ring(wx, wy, m.d.boss ? 40 : 14, SLIME_COLORS[m.type].l);
  let coins = m.d.coin[0] + Math.floor(R() * (m.d.coin[1] - m.d.coin[0] + 1));
  const n = Math.min(m.d.boss ? 14 : 5, coins);
  for (let i = 0; i < n; i++) { const v = i === n - 1 ? coins : Math.floor(coins / (n - i)); coins -= v; drops.push(newDrop('coin', wx, wy, v)); }
  const rolls = m.d.boss ? 3 : R() < DROP_RATE ? 1 : 0;
  for (let i = 0; i < rolls; i++) drops.push(newDrop('item', wx, wy, rollGear(R, m.d.lv + Math.floor(R() * 2), m.d.boss, P.cls)));
  if (P.quest === 1 && !m.d.boss) P.kills++;
  if (m.d.boss) { if (P.quest === 2) P.quest = 3; shake = 0.4; flash = 0.25; banner('擊敗史萊姆王！'); }
  floatT(`+${m.d.exp} EXP`, m.x, m.y - 0.9, '#a6ec7a', 0.8);
  const before = P.lv;
  if (gainExp(P, m.d.exp)) levelUp(before);
  hud();
}
function levelUp(before) {
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
  if (d.kind === 'coin') { P.coins += d.val; bump('coinBox'); return; }
  const it = d.val, r = rarityOf(it.rarity);
  const res = equipIfBetter(P, it);
  if (res.equipped) {
    feed(`<b style="color:${r.color}">【${r.name}】${it.name}</b> 已裝備，外觀改變！`, r.color);
    popCp(res.before, res.after);
    addFx('pillar', 0.6, { x: cx(me), y: cy(me), color: r.color });
  } else feed(`<span style="color:${r.color}">【${r.name}】${it.name}</span> 自動賣出 +${res.sold}`, r.color);
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
  projs.push({ kind, x: cx(me), y: cy(me) - 4, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, trav: 0, range: opt.range * TS, pierce: opt.pierce ?? 0, mult: opt.mult, r: opt.r ?? 6, hit: new Set(), home: opt.home || null, onEnd: opt.onEnd, color: opt.color });
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
    if (p.kind === 'bigarrow') parts.push({ x: p.x, y: p.y, vx: (R() - 0.5) * 15, vy: (R() - 0.5) * 15, c: '#ffe08a', t: 0, g: 0, size: 2, life: 0.3 });
    if (p.kind === 'wave' && R() < 0.7) parts.push({ x: p.x + (R() - 0.5) * 10, y: p.y + (R() - 0.5) * 10, vx: 0, vy: 0, c: '#bdf1ff', t: 0, g: 0, size: 1, life: 0.3 });
    for (const m of alive()) {
      if (p.hit.has(m)) continue;
      if (Math.hypot(cx(m) - p.x, cy(m) - p.y) < p.r + (m.d.boss ? 12 : 6)) {
        p.hit.add(m);
        if (p.kind !== 'fire') dealDamage(m, p.mult, (p.x - p.vx * 0.05) / TS - 0.5, (p.y - p.vy * 0.05) / TS - 0.5, p.color);
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
  me.cool = C.cool; me.atkT = Math.min(0.18, C.cool * 0.8);
  const [dx, dy] = DIRS[me.face];
  if (P.cls === 'sword') {
    addFx('slash', 0.18, { x: cx(me) + dx * 13, y: cy(me) + dy * 13 - 3, ang: faceAng(), color: '#dff6ff', size: 19 });
    for (const m of alive()) if (onTiles(m, frontTiles())) dealDamage(m, 1);
  } else if (P.cls === 'monk') {
    const off = (R() - 0.5) * 8;
    addFx('punch', 0.12, { x: cx(me) + dx * 14 + (dy ? off : 0), y: cy(me) + dy * 14 - 3 + (dx ? off : 0), color: '#ffd8a8' });
    const t = [frontTiles()[0]];
    for (const m of alive()) if (onTiles(m, t)) dealDamage(m, 1);
  } else if (P.cls === 'archer') {
    const m = target || nearest(C.range);
    if (m) faceToward(m);
    shoot('arrow', m ? angTo(m) : faceAng(), { speed: 320, range: C.range + 1, mult: 1, r: 4, color: '#e8ffe0' });
  } else if (P.cls === 'mage') {
    const m = target || nearest(C.range);
    if (m) faceToward(m);
    shoot('bolt', m ? angTo(m) : faceAng(), { speed: 200, range: C.range + 1.5, mult: 1, r: 5, home: m, color: '#e3d0ff' });
  }
}

// ---------- 技能 ----------
function castIdx(i) {
  if (!started || dialog || fishing) return;
  const s = skills[i];
  if (!s || s.t > 0) return;
  s.t = s.cd;
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

// ---------- 自動狩獵 ----------
const dirTo = (x, y) => (x > me.x ? 'right' : x < me.x ? 'left' : y > me.y ? 'down' : 'up');
let autoTarget = null;
function autoThink(dt) {
  autoHit = false; autoTarget = null;
  if (!auto || dialog || fishing || me.moving) return;
  const st = stats(P);
  const ok = (m) => m.dead <= 0 && (m.d.boss ? P.quest >= 2 && st.cp >= 1500 : m.d.lv <= P.lv + 2);
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
      if (k in prev || !walkable(grid, nx, ny) || occupied(nx, ny)) continue;
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
  Object.assign(me, { fx: me.x, fy: me.y, x: nx, y: ny, moving: true, mt: 0, dur: 0.14 });
}
function syncAuto() { $('autoBtn').classList.toggle('on', auto); $('autoBtn').innerHTML = auto ? '自動 <b>ON</b>' : '自動 <b>OFF</b>'; }
$('autoBtn').addEventListener('click', () => {
  if (!started) return;
  auto = !auto; syncAuto();
  if (auto && dialog) { dialog = null; showDialog(); }
  if (auto && P.quest === 0) { P.quest = 1; P.kills = 0; feed('接到村長的任務：打倒 20 隻史萊姆', '#f6c945'); hud(); save(); }
});

// ---------- 釣魚 ----------
function reelIn() {
  if (fishing.state === 'bite') {
    const f = rollFish(R);
    P.fish[f.id] = (P.fish[f.id] || 0) + 1;
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
function usePotion() {
  if (!started || dialog) return;
  const max = stats(P).hp;
  if (P.potions < 1) { floatT('沒有藥水了', me.x, me.y - 0.6, '#ff8fb1', 0.8); return; }
  if (P.hp >= max) { floatT('HP 已經是滿的', me.x, me.y - 0.6, '#a6ec7a', 0.8); return; }
  const heal = Math.round(max * POTION_HEAL_PCT);
  P.potions--; P.hp = Math.min(max, P.hp + heal);
  floatT(`+${heal}`, me.x, me.y, '#a6ec7a'); burst(cx(me), cy(me), '#ff8fb1', 8);
  hud(); save();
}
function bindHold(el, down, up) {
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture?.(e.pointerId); el.classList.add('down'); down(); });
  const end = () => { el.classList.remove('down'); up?.(); };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
}
document.querySelectorAll('[data-dir]').forEach((b) => bindHold(b, () => { held = b.dataset.dir; }, () => { if (held === b.dataset.dir) held = null; }));
bindHold($('aBtn'), pressA, () => { aHeld = false; });
bindHold($('bBtn'), usePotion);
[0, 1, 2].forEach((i) => bindHold($(`sk${i}Btn`), () => castIdx(i)));
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
function applyFs() { document.documentElement.style.setProperty('--fs', `${SIZES[fsIdx][1]}px`); $('fontBtn').textContent = `字級：${SIZES[fsIdx][0]}`; }
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
  if (me.moving && step(me, me.dur, dt)) { me.step ^= 1; me.dur = 0.14; }
  if (held && auto) { auto = false; syncAuto(); }
  if (!me.moving && started && held && !dialog && !fishing) {
    const [dx, dy] = DIRS[held];
    me.face = held;
    const nx = me.x + dx, ny = me.y + dy;
    if (walkable(grid, nx, ny) && !occupied(nx, ny)) Object.assign(me, { fx: me.x, fy: me.y, x: nx, y: ny, moving: true, mt: 0, dur: 0.14 });
  }
  if (started && !held) autoThink(dt);
  me.atkT = Math.max(0, me.atkT - dt); me.hurtT = Math.max(0, me.hurtT - dt); me.cool = Math.max(0, me.cool - dt);
  const ranged = C.range > 1;
  if ((aHeld || autoHit) && me.cool <= 0 && !dialog && !fishing && (ranged || !me.moving) && started) basicAttack(autoTarget);
  for (const s of skills) s.t = Math.max(0, s.t - dt);
  shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt);
  comboT -= dt;
  if (comboT <= 0 && combo) { combo = 0; $('combo').hidden = true; }
  regenT += dt;
  if (regenT > 1) { regenT = 0; const max = stats(P).hp; if (P.hp < max) { P.hp = Math.min(max, P.hp + (me.x <= TOWN_EDGE ? Math.ceil(max * 0.08) : 1)); hud(); } }
  pending = pending.filter((p) => { p.t -= dt; if (p.t <= 0) { p.fn(); return false; } return true; });
  updateProjs(dt);
  for (const m of mons) {
    m.anim += dt;
    if (m.dead > 0) { m.dead -= dt; if (m.dead <= 0) placeMon(m); continue; }
    m.flash = Math.max(0, m.flash - dt); m.cool -= dt; m.spawnT = Math.max(0, m.spawnT - dt); m.frozen = Math.max(0, m.frozen - dt);
    m.kx *= 0.8; m.ky *= 0.8;
    if (m.moving) { step(m, m.d.boss ? 0.5 : 0.35, dt); continue; }
    if (!started || dialog || m.frozen > 0) continue;
    const dx = me.x - m.x, dy = me.y - m.y, dist = Math.abs(dx) + Math.abs(dy);
    if ((dist === 1 || (m.d.boss && Math.max(Math.abs(dx), Math.abs(dy)) <= 1)) && m.cool <= 0) { hitPlayer(m); m.cool = m.d.boss ? 1.2 : 1.5; continue; }
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
    if (d.t < 0.55) { d.x += d.vx * dt; d.y += d.vy * dt; d.vz -= 320 * dt; d.z = Math.max(0, d.z + d.vz * dt); if (d.z === 0) d.vz = Math.abs(d.vz) * 0.4; return true; }
    const ax = px - d.x, ay = py - d.y, dist = Math.hypot(ax, ay);
    if (dist < 6 || d.t > 3) { collect(d); return false; }
    const sp = 80 + (d.t - 0.55) * 400;
    d.x += (ax / dist) * sp * dt; d.y += (ay / dist) * sp * dt; d.z = Math.max(0, d.z - dt * 30);
    return true;
  });
  // 傳說光環
  if (myLook?.aura) { auraT -= dt; if (auraT <= 0) { auraT = 0.08; parts.push({ x: px + (R() - 0.5) * 18, y: py + 6, vx: 0, vy: -25 - R() * 20, c: R() < 0.5 ? '#ffd75e' : '#fff3c4', t: 0, g: 0, size: 1, life: 0.7 }); } }
  floats = floats.filter((f) => (f.t += dt) < 0.9);
  parts = parts.filter((p) => { p.t += dt; if (p.t < 0) return true; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g ?? 240) * dt; return p.t < (p.life ?? 0.6); });
  fx = fx.filter((f) => (f.t += dt) < f.life);
  saveT += dt;
  if (saveT > 5) { saveT = 0; save(); }
  const boss = mons.find((m) => m.d.boss);
  const showBoss = boss && boss.dead <= 0 && Math.abs(boss.x - me.x) + Math.abs(boss.y - me.y) <= 7;
  $('bossBar').hidden = !showBoss;
  if (showBoss) $('bossFill').style.width = `${Math.max(0, boss.hp / boss.d.hp) * 100}%`;
}
function updateSkillUi() {
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
  ctx.setTransform(SC, 0, 0, SC, 0, 0);
  ctx.imageSmoothingEnabled = false;
  let camX = clamp(Math.round(cx(me) - VW / 2), 0, W * TS - VW);
  let camY = clamp(Math.round(cy(me) - 4 - VH / 2), 0, H * TS - VH);
  if (shake > 0) { const s = Math.min(4, shake * 14); camX += Math.round((R() - 0.5) * s); camY += Math.round((R() - 0.5) * s); }
  ctx.drawImage(mapC, camX, camY, VW, VH, 0, 0, VW, VH);
  ctx.fillStyle = 'rgba(255,255,255,.45)';
  const tx0 = Math.floor(camX / TS), ty0 = Math.floor(camY / TS);
  for (let ty = ty0; ty <= ty0 + 12; ty++) for (let tx = tx0; tx <= tx0 + 11; tx++) {
    if (grid[ty]?.[tx] !== T.WATER && grid[ty]?.[tx] !== T.FOUNTAIN) continue;
    const ph = (anim * 1.3 + tx * 0.37 + ty * 0.61) % 3;
    if (ph < 1) ctx.fillRect(tx * TS - camX + 3 + Math.floor(ph * 8), ty * TS - camY + 4 + ((tx + ty) % 3) * 4, 3, 1);
  }
  ctx.save(); ctx.translate(-camX, -camY);
  for (const f of fx) if (f.kind === 'crack' || f.kind === 'target') drawFx(f);
  for (const d of drops) {
    const x = Math.round(d.x), y = Math.round(d.y - d.z);
    if (d.kind === 'item') {
      const r = rarityOf(d.val.rarity);
      if (['rare', 'epic', 'legend'].includes(r.id)) { ctx.globalAlpha = 0.35 + Math.sin(anim * 10) * 0.1; ctx.fillStyle = r.color; ctx.fillRect(x - 2, y - 40, 4, 40); ctx.globalAlpha = 1; }
      ctx.drawImage(orbS[r.id], x - 3, y - 4);
    } else ctx.drawImage(coinS, x - 3, y - 3);
  }
  const ents = [
    ...npcs.map((n) => ({ y: n.y, f: () => drawPerson(avatar(n.L, n.face, 0), n.x * TS, n.y * TS - (Math.floor(anim * 1.6 + n.seed) % 2)) })),
    ...alive().map((m) => ({ y: m.py, f: () => drawMon(m) })),
    { y: me.py + 0.01, f: drawMe },
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
  // 高解析度文字層：名字、傷害數字
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const label = (text, wx, wy, color, size) => {
    ctx.font = `${size}px Huninn, "PingFang TC", sans-serif`;
    ctx.lineWidth = 8; ctx.strokeStyle = '#1b1420'; ctx.strokeText(text, (wx - camX) * SC, (wy - camY) * SC);
    ctx.fillStyle = color; ctx.fillText(text, (wx - camX) * SC, (wy - camY) * SC);
  };
  if (started) label(P.name, cx(me), me.py * TS - 20, C.color, 30);
  for (const n of npcs) if (Math.abs(n.x - me.px) < 7 && Math.abs(n.y - me.py) < 7) label(n.name.split('・')[1], n.x * TS + 8, n.y * TS - 20, '#fff8e7', 26);
  for (const f of floats) {
    const pop = 1 + Math.max(0, 0.12 - f.t) * 5;
    const x = (f.x - camX) * SC, y = (f.y - camY - f.t * 18) * SC;
    ctx.globalAlpha = f.t > 0.65 ? (0.9 - f.t) / 0.25 : 1;
    ctx.font = `${Math.round(48 * f.size * pop)}px Silkscreen, Huninn, monospace`;
    ctx.lineWidth = 12; ctx.strokeStyle = '#2a1d2e'; ctx.strokeText(f.text, x, y);
    ctx.fillStyle = f.color; ctx.fillText(f.text, x, y);
  }
  ctx.globalAlpha = 1;
}
function shadow(x, y, w = 12) { ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(x + 8 - w / 2, y + 14, w, 2); ctx.fillRect(x + 9 - w / 2, y + 16, w - 2, 1); }
function drawPerson(img, x, y) { shadow(x, y); ctx.drawImage(img, Math.round(x) - 4, Math.round(y) - 17); }
function drawMe() {
  const x = Math.round(me.px * TS), y = Math.round(me.py * TS);
  const frame = me.atkT > 0 ? 2 : me.moving ? ((me.mt > 0.5 ? 1 : 0) ^ me.step) : 0;
  if (me.hurtT > 0 && Math.floor(me.hurtT * 20) % 2) { shadow(x, y); return; }
  if (myLook?.aura) { ctx.globalAlpha = 0.25 + Math.sin(anim * 4) * 0.08; ctx.fillStyle = '#ffd75e'; ctx.beginPath(); ctx.ellipse(x + 8, y + 15, 12, 4, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  drawPerson(avatar(myLook, me.face, frame), x, y);
}
function drawMon(m) {
  const x = Math.round(m.px * TS + m.kx), y = Math.round(m.py * TS + m.ky);
  const spr = slimeS[m.type][m.frozen > 0 ? 0 : Math.floor(m.anim * 2.4) % 2];
  const big = m.d.boss;
  shadow(x, y, big ? 22 : 12);
  const sc = m.spawnT > 0 ? 1 - m.spawnT * 2 : 1;
  const draw = () => {
    if (big) { ctx.drawImage(spr, x - 8, y - 16, 32, 32); ctx.drawImage(crownS, x, y - 14 + (Math.floor(m.anim * 2.4) % 2) * 2); }
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
function drawFx(f) {
  const k = f.t / f.life;
  ctx.globalAlpha = 1;
  switch (f.kind) {
    case 'ring': ctx.globalAlpha = 1 - k; ctx.strokeStyle = f.color; ctx.lineWidth = f.w; ctx.beginPath(); ctx.arc(Math.round(f.x), Math.round(f.y), 2 + f.max * k, 0, Math.PI * 2); ctx.stroke(); break;
    case 'slash': {
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = f.color; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(f.x - Math.cos(f.ang) * 8, f.y - Math.sin(f.ang) * 8, f.size, f.ang - 1.1 + k * 0.4, f.ang + 1.1 + k * 0.4); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(f.x - Math.cos(f.ang) * 8, f.y - Math.sin(f.ang) * 8, f.size - 2, f.ang - 0.8, f.ang + 0.8); ctx.stroke();
      break;
    }
    case 'punch': {
      ctx.globalAlpha = 1 - k; const s = (f.big ? 13 : 7) + k * 8;
      ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(f.x, f.y, s, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(f.x, f.y, s + 4, 0, 7); ctx.stroke();
      break;
    }
    case 'spin': {
      ctx.globalAlpha = 1 - k * 0.7;
      ctx.fillStyle = 'rgba(189,241,255,.18)'; ctx.beginPath(); ctx.arc(f.x, f.y, 26, 0, 7); ctx.fill();
      for (let i = 0; i < 3; i++) { const a = k * 9 + (i * Math.PI * 2) / 3; ctx.strokeStyle = i ? '#bdf1ff' : '#fff'; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.arc(f.x, f.y, 24, a, a + 1.6); ctx.stroke(); }
      break;
    }
    case 'bigsword': {
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
      const r = 8 + 44 * k;
      ctx.globalAlpha = 1 - k; ctx.fillStyle = 'rgba(127,216,255,.25)'; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, 7); ctx.fill();
      ctx.strokeStyle = '#dff6ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, 7); ctx.stroke();
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; const sx = f.x + Math.cos(a) * r, sy = f.y + Math.sin(a) * r; ctx.fillStyle = '#ffffff'; ctx.fillRect(sx - 1, sy - 4, 2, 7); ctx.fillRect(sx - 3, sy - 1, 6, 2); }
      break;
    }
    case 'lightning': {
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
      ctx.globalAlpha = 1 - k; ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.arc(f.x, f.y, 10 + 22 * k, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(f.x, f.y, 6 + 12 * k, 0, 7); ctx.fill();
      break;
    }
    case 'pillar': {
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
  if (freeze > 0) { freeze -= dt; dt *= 0.15; }
  update(dt);
  updateSkillUi();
  render();
}

// ---------- 標題與選職業 ----------
let pickCls = 'sword';
function start() {
  if (started) return;
  started = true;
  $('title').hidden = true; $('classPanel').hidden = true;
  setupClass(); hud();
  if (P.quest === 0 && P.lv === 1) say('村長・歐文', [`歡迎來到微光村，${C.name}${P.name}！`, '按住紅色「攻擊」鍵連續攻擊，旁邊三顆是職業專屬技能。', '懶得操作就按左上的「自動」，角色會自己去打怪！', '先來廣場北邊找我說話吧。']);
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
  P = newPlayer(pickCls, $('nameInput').value.trim() || '冒險者');
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
  $('titleArt').replaceChildren(...looks.map((L) => previewCanvas(L, 2)));
}
setupClass();
titleScreen();
hud();
render();
document.fonts?.ready.then(render);
requestAnimationFrame(frame);

// 自動化測試用（網址加 ?debug 才開）
if (location.search.includes('debug')) globalThis.__game = { get P() { return P; }, me, grid, get mons() { return mons; }, get fishing() { return fishing; }, get dialog() { return dialog; }, get drops() { return drops; }, get skills() { return skills; }, castIdx };
