import {
  W, H, T, TOWN_EDGE, FIELD_MIN_X, BOSS_ZONE, HOUSES, NPCS, SIGN, SPAWN, INN_SPOT, buildWorld, walkable,
  MONSTERS, expNeed, maxHp, playerAtk, swordCost, POTION_PRICE, POTION_HEAL, FISH, rollFish, gainExp, newPlayer, loadPlayer,
} from './world.js';
import { PAL, SLIME, CROWN, SLASH, BOBBER, BANG, HEART, makeSprite, rotate, charSet, SLIME_COLORS, drawMap } from './sprites.js';

const KEY = 'glimmer-rpg-v1';
const $ = (id) => document.getElementById(id);
const TS = 16, VW = 10 * TS, VH = 11 * TS, SC = 6;
const cv = $('cv');
const ctx = cv.getContext('2d');
const grid = buildWorld();
const mapC = document.createElement('canvas');
mapC.width = W * TS; mapC.height = H * TS;
drawMap(mapC.getContext('2d'), grid, T, HOUSES);

const heroS = charSet(null);
const npcs = NPCS.map((n, i) => ({ ...n, face: n.id === 'fisher' ? 'right' : 'down', spr: charSet(n.look), seed: i }));
const slimeS = {};
for (const k of Object.keys(SLIME_COLORS)) slimeS[k] = SLIME.map((f) => makeSprite(f, { ...PAL, ...SLIME_COLORS[k] }));
const crownS = makeSprite(CROWN);
const slashBase = makeSprite(SLASH);
const slashS = { right: slashBase, down: rotate(slashBase, 1), left: rotate(slashBase, 2), up: rotate(slashBase, 3) };
const bobberS = makeSprite(BOBBER), bangS = makeSprite(BANG), heartS = makeSprite(HEART);

let P;
try { P = loadPlayer(localStorage.getItem(KEY)); } catch { P = newPlayer(); }
if (!walkable(grid, P.x, P.y)) { P.x = SPAWN.x; P.y = SPAWN.y; }
const me = { x: P.x, y: P.y, px: P.x, py: P.y, fx: P.x, fy: P.y, face: 'down', moving: false, mt: 0, step: 0, atkT: 0, hurtT: 0, cool: 0 };
function save() { P.x = me.x; P.y = me.y; try { localStorage.setItem(KEY, JSON.stringify(P)); } catch { /* 無痕模式不存 */ } }

const R = Math.random;
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
let mons = [], floats = [], parts = [];
let dialog = null, fishing = null, started = false, held = null, anim = 0, regenT = 0, saveT = 0, shake = 0;

// ---------- 怪物 ----------
const inBoss = (x, y) => x >= BOSS_ZONE.x0 && x <= BOSS_ZONE.x1 && y >= BOSS_ZONE.y0 && y <= BOSS_ZONE.y1;
function occupied(x, y, self) {
  if (me.x === x && me.y === y) return true;
  if (npcs.some((n) => n.x === x && n.y === y)) return true;
  return mons.some((m) => m !== self && m.dead <= 0 && m.x === x && m.y === y);
}
function monCanGo(m, x, y) {
  return walkable(grid, x, y) && x >= FIELD_MIN_X && !occupied(x, y, m) && (m.d.boss ? inBoss(x, y) : !inBoss(x, y));
}
function spawnTile(type) {
  for (let i = 0; i < 300; i++) {
    let x, y;
    if (type === 'king') { x = BOSS_ZONE.x0 + 1 + Math.floor(R() * 5); y = BOSS_ZONE.y0 + 1 + Math.floor(R() * 4); }
    else {
      x = FIELD_MIN_X + 1 + Math.floor(R() * (W - FIELD_MIN_X - 2)); y = 1 + Math.floor(R() * (H - 2));
      if ((type === 'slime' && x > 31) || (type === 'berry' && x < 28) || inBoss(x, y)) continue;
    }
    if (walkable(grid, x, y) && !occupied(x, y) && Math.abs(x - me.x) + Math.abs(y - me.y) > 5) return { x, y };
  }
  return null;
}
function placeMon(m) {
  const t = spawnTile(m.type);
  if (!t) { m.dead = 3; return; }
  Object.assign(m, { x: t.x, y: t.y, px: t.x, py: t.y, fx: t.x, fy: t.y, moving: false, hp: m.d.hp, dead: 0, cool: 1, think: R() * 1.5, flash: 0 });
}
const ROSTER = ['slime', 'slime', 'slime', 'slime', 'slime', 'slime', 'berry', 'berry', 'berry', 'king'];
mons = ROSTER.map((type) => { const m = { type, d: MONSTERS[type], anim: R() * 2 }; placeMon(m); return m; });

// ---------- 浮動文字與粒子 ----------
function float(text, tx, ty, color = '#fff8e7', big = false) { floats.push({ text, x: tx * TS + 8, y: ty * TS, color, big, t: 0 }); }
function burst(tx, ty, color, n = 8) {
  for (let i = 0; i < n; i++) parts.push({ x: tx * TS + 8, y: ty * TS + 10, vx: (R() - 0.5) * 70, vy: -R() * 70 - 10, c: color, t: 0 });
}

// ---------- HUD ----------
function hud() {
  const mh = maxHp(P.lv);
  $('lv').textContent = P.lv;
  $('hpBar').style.width = `${(P.hp / mh) * 100}%`;
  $('hpText').textContent = `${P.hp} / ${mh}`;
  $('xpBar').style.width = `${(P.exp / expNeed(P.lv)) * 100}%`;
  $('xpText').textContent = `${P.exp} / ${expNeed(P.lv)}`;
  $('coins').textContent = P.coins;
  $('fishN').textContent = Object.values(P.fish).reduce((a, b) => a + b, 0);
  $('potions').textContent = P.potions;
  $('atk').textContent = playerAtk(P.lv, P.sword);
  $('quest').textContent = questText();
}
function questText() {
  return ['找廣場北邊的村長歐文聊聊', `打倒史萊姆 ${Math.min(P.kills, 5)} / 5，再回報村長`, '打倒東北方空地的史萊姆王',
    '回村子告訴村長好消息', '自由冒險：釣魚、升級、強化武器'][P.quest] || '';
}

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
    const lines = total ? [`我來收購你的魚，一共 ${total} 金幣！`, '還需要什麼嗎？'] : ['歡迎光臨！要買點什麼嗎？'];
    shopMenu(nm, lines);
  } else if (n.id === 'elder') {
    if (P.quest === 0) { P.quest = 1; P.kills = 0; say(nm, ['年輕人，最近草原上的史萊姆變多了。', '過了東邊的橋就是史萊姆草原。', '幫我打倒 5 隻史萊姆，我會好好答謝你。']); }
    else if (P.quest === 1 && P.kills >= 5) { P.quest = 2; P.coins += 30; P.potions += 1; say(nm, ['做得好！這是謝禮：30 金幣和 1 瓶藥水。', '不過……東北方的空地住著史萊姆王。', '等你夠強了，再去挑戰牠吧。']); }
    else if (P.quest === 1) say(nm, [`還差 ${5 - P.kills} 隻史萊姆，加油！`]);
    else if (P.quest === 2) say(nm, ['史萊姆王很強，記得先去鐵匠鋪強化武器。', '打不過就回旅店休息，不要逞強。']);
    else if (P.quest === 3) { P.quest = 4; P.coins += 100; say(nm, ['你真的打倒了史萊姆王！', '你是微光村的英雄。收下這 100 金幣吧！']); }
    else say(nm, ['英雄，謝謝你守護了這個村子。']);
  } else if (n.id === 'inn') {
    P.hp = maxHp(P.lv);
    say(nm, ['歡迎來到微光旅店！', '（你好好休息了一下，HP 全部恢復了）']);
  } else if (n.id === 'smith') {
    smithMenu(nm, [`你的武器現在是 +${P.sword}。`, `強化到 +${P.sword + 1} 要 ${swordCost(P.sword)} 金幣。`]);
  } else if (n.id === 'fisher') {
    say(nm, ['想釣魚嗎？面向河邊按 A 就能拋竿。', '浮標旁邊跳出「！」的時候，馬上再按一次 A！', '釣到的魚可以賣給雜貨店的莉莉。']);
  }
  hud(); save();
}
function shopMenu(nm, lines) {
  say(nm, lines, [[`買藥水（${POTION_PRICE} 金幣）`, () => {
    if (P.coins < POTION_PRICE) shopMenu(nm, ['金幣不夠喔，去釣魚或打怪賺一點吧。']);
    else { P.coins -= POTION_PRICE; P.potions++; shopMenu(nm, [`謝謝惠顧！你現在有 ${P.potions} 瓶藥水。`]); }
  }], ['離開', null]]);
}
function smithMenu(nm, lines) {
  say(nm, lines, [[`強化（${swordCost(P.sword)} 金幣）`, () => {
    const c = swordCost(P.sword);
    if (P.coins < c) smithMenu(nm, [`還差 ${c - P.coins} 金幣。`]);
    else { P.coins -= c; P.sword++; smithMenu(nm, [`叮叮噹噹……完成！武器變成 +${P.sword} 了。`, `下一次強化要 ${swordCost(P.sword)} 金幣。`]); }
  }], ['離開', null]]);
}

// ---------- 戰鬥 ----------
function hitPlayer(m) {
  if (fishing) { fishing = null; float('魚跑了', me.x, me.y - 0.5, '#bdf1ff'); }
  P.hp -= m.d.atk; me.hurtT = 0.5; shake = 0.2;
  float(`-${m.d.atk}`, me.x, me.y, '#ff6b6b');
  if (P.hp <= 0) {
    P.hp = maxHp(P.lv);
    Object.assign(me, { x: INN_SPOT.x, y: INN_SPOT.y, px: INN_SPOT.x, py: INN_SPOT.y, moving: false, face: 'down' });
    say('旅店・瑪莎', ['你昏倒在草原上，被路過的冒險者送回來了。', '好好休息，HP 已經恢復了。']);
  }
  hud();
}
function hitMonster(m) {
  const crit = R() < 0.12;
  const dmg = (playerAtk(P.lv, P.sword) + (R() < 0.5 ? 1 : 0)) * (crit ? 2 : 1);
  m.hp -= dmg; m.flash = 0.15;
  float(crit ? `${dmg}!` : `${dmg}`, m.x, m.y - (m.d.boss ? 0.6 : 0), crit ? '#f6c945' : '#fff8e7', crit);
  burst(m.x, m.y, SLIME_COLORS[m.type].g, crit ? 12 : 6);
  if (crit) shake = 0.15;
  if (m.hp > 0) return;
  m.dead = m.d.boss ? 40 : 6;
  const coins = m.d.coin[0] + Math.floor(R() * (m.d.coin[1] - m.d.coin[0] + 1));
  P.coins += coins;
  if (P.quest === 1 && !m.d.boss) P.kills++;
  if (m.d.boss && P.quest === 2) P.quest = 3;
  float(`+${m.d.exp} EXP`, m.x, m.y - 0.8, '#a6ec7a');
  float(`+${coins} 金幣`, m.x, m.y - 1.5, '#f6c945');
  burst(m.x, m.y, SLIME_COLORS[m.type].l, 16);
  if (gainExp(P, m.d.exp)) { float('LEVEL UP!', me.x, me.y - 1.2, '#f6c945', true); for (let i = 0; i < 6; i++) parts.push({ x: me.x * TS + 8, y: me.y * TS, vx: (R() - 0.5) * 50, vy: -40 - R() * 40, heart: true, t: 0 }); }
  hud(); save();
}

// ---------- 釣魚 ----------
function startFishing(tx, ty) { fishing = { tx, ty, state: 'wait', t: 1.5 + R() * 2.5 }; }
function reelIn() {
  if (fishing.state === 'bite') {
    const f = rollFish(R);
    P.fish[f.id] = (P.fish[f.id] || 0) + 1;
    float(`釣到${f.name}！`, me.x, me.y - 0.8, f.id === 'gold' ? '#f6c945' : '#bdf1ff', f.id === 'gold');
    burst(fishing.tx, fishing.ty, '#bdf1ff', 8);
    hud(); save();
  } else float('太早了…', me.x, me.y - 0.6, '#bdf1ff');
  fishing = null;
}

// ---------- 輸入 ----------
function pressA() {
  if (!started) return;
  if (dialog) { advance(); return; }
  if (fishing) { reelIn(); return; }
  if (me.moving) return;
  const [dx, dy] = DIRS[me.face];
  const tx = me.x + dx, ty = me.y + dy;
  const n = npcs.find((v) => v.x === tx && v.y === ty);
  if (n) { talk(n); return; }
  const m = mons.find((v) => v.dead <= 0 && v.x === tx && v.y === ty);
  if (me.cool > 0) return;
  me.cool = 0.3; me.atkT = 0.18;
  if (m) { hitMonster(m); return; }
  const t = grid[ty]?.[tx];
  if (t === T.SIGN) { me.atkT = 0; say('告示牌', SIGN.text); }
  else if (t === T.WATER) { me.atkT = 0; startFishing(tx, ty); }
  else if (t === T.HOUSE) { me.atkT = 0; const h = HOUSES.find((v) => tx >= v.x && tx <= v.x + 2 && ty >= v.y && ty <= v.y + 2); say(h ? h.name : '房子', ['門口的人就是店主，直接跟他說話吧。']); }
}
function usePotion() {
  if (!started || dialog) return;
  if (P.potions < 1) { float('沒有藥水了', me.x, me.y - 0.6, '#ff8fb1'); return; }
  if (P.hp >= maxHp(P.lv)) { float('HP 已經是滿的', me.x, me.y - 0.6, '#a6ec7a'); return; }
  P.potions--; P.hp = Math.min(maxHp(P.lv), P.hp + POTION_HEAL);
  float(`+${POTION_HEAL}`, me.x, me.y, '#a6ec7a'); burst(me.x, me.y, '#ff8fb1', 8);
  hud(); save();
}

document.querySelectorAll('[data-dir]').forEach((b) => {
  const d = b.dataset.dir;
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture?.(e.pointerId); held = d; b.classList.add('down'); });
  const up = () => { if (held === d) held = null; b.classList.remove('down'); };
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
});
$('aBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); pressA(); });
$('bBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); usePotion(); });
const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };
addEventListener('keydown', (e) => {
  if (KEYS[e.code]) { held = KEYS[e.code]; e.preventDefault(); }
  else if (['Space', 'Enter', 'KeyZ', 'KeyJ'].includes(e.code)) { e.preventDefault(); if (!e.repeat) { if (!started) start(); else pressA(); } }
  else if (['KeyX', 'KeyK'].includes(e.code)) usePotion();
});
addEventListener('keyup', (e) => { if (KEYS[e.code] === held) held = null; });
document.addEventListener('contextmenu', (e) => { if (e.target.closest('.pad')) e.preventDefault(); });

// 字級：回應「字太小」的抱怨
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
  if (me.moving && step(me, 0.16, dt)) me.step ^= 1;
  if (!me.moving && started && held && !dialog && !fishing) {
    const [dx, dy] = DIRS[held];
    me.face = held;
    const nx = me.x + dx, ny = me.y + dy;
    if (walkable(grid, nx, ny) && !occupied(nx, ny)) Object.assign(me, { fx: me.x, fy: me.y, x: nx, y: ny, moving: true, mt: 0 });
  }
  me.atkT = Math.max(0, me.atkT - dt); me.hurtT = Math.max(0, me.hurtT - dt); me.cool = Math.max(0, me.cool - dt); shake = Math.max(0, shake - dt);
  regenT += dt;
  if (regenT > 1.2) { regenT = 0; if (me.x <= TOWN_EDGE && P.hp < maxHp(P.lv)) { P.hp++; hud(); } }
  for (const m of mons) {
    m.anim += dt;
    if (m.dead > 0) { m.dead -= dt; if (m.dead <= 0) placeMon(m); continue; }
    m.flash = Math.max(0, m.flash - dt); m.cool -= dt;
    if (m.moving) { step(m, m.d.boss ? 0.5 : 0.35, dt); continue; }
    if (!started || dialog) continue;
    const dx = me.x - m.x, dy = me.y - m.y, dist = Math.abs(dx) + Math.abs(dy);
    if (dist === 1 && m.cool <= 0) { hitPlayer(m); m.cool = m.d.boss ? 1.3 : 1.6; continue; }
    m.think -= dt;
    if (m.think > 0) continue;
    const chase = dist <= m.d.sight && dist > 1;
    m.think = (chase ? 0.45 : 1 + R() * 1.6) * (m.d.boss ? 1.4 : 1);
    let opts = [];
    if (chase) {
      const a = Math.abs(dx) > Math.abs(dy) ? [[Math.sign(dx), 0], [0, Math.sign(dy)]] : [[0, Math.sign(dy)], [Math.sign(dx), 0]];
      opts = a.filter(([x, y]) => x || y);
    } else if (R() < 0.6) opts = [Object.values(DIRS)[Math.floor(R() * 4)]];
    for (const [ox, oy] of opts) {
      if (monCanGo(m, m.x + ox, m.y + oy)) { if (ox) m.facing = ox; Object.assign(m, { fx: m.x, fy: m.y, x: m.x + ox, y: m.y + oy, moving: true, mt: 0 }); break; }
    }
  }
  if (fishing) {
    fishing.t -= dt;
    if (fishing.state === 'wait' && fishing.t <= 0) { fishing.state = 'bite'; fishing.t = 0.9; }
    else if (fishing.state === 'bite' && fishing.t <= 0) { fishing = null; float('魚跑掉了', me.x, me.y - 0.6, '#bdf1ff'); }
  }
  floats = floats.filter((f) => (f.t += dt) < 1.1);
  parts = parts.filter((p) => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 220 * dt; return p.t < 0.7; });
  saveT += dt;
  if (saveT > 5) { saveT = 0; save(); }
}

// ---------- 繪製 ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function render() {
  ctx.setTransform(SC, 0, 0, SC, 0, 0);
  ctx.imageSmoothingEnabled = false;
  let camX = clamp(Math.round(me.px * TS + 8 - VW / 2), 0, W * TS - VW);
  let camY = clamp(Math.round(me.py * TS + 8 - VH / 2), 0, H * TS - VH);
  if (shake > 0) { camX += Math.round((R() - 0.5) * 3); camY += Math.round((R() - 0.5) * 3); }
  ctx.drawImage(mapC, camX, camY, VW, VH, 0, 0, VW, VH);
  // 水面波光
  ctx.fillStyle = 'rgba(255,255,255,.45)';
  const tx0 = Math.floor(camX / TS), ty0 = Math.floor(camY / TS);
  for (let ty = ty0; ty <= ty0 + 14; ty++) for (let tx = tx0; tx <= tx0 + 16; tx++) {
    if (grid[ty]?.[tx] !== T.WATER && grid[ty]?.[tx] !== T.FOUNTAIN) continue;
    const ph = (anim * 1.3 + tx * 0.37 + ty * 0.61) % 3;
    if (ph < 1) ctx.fillRect(tx * TS - camX + 3 + Math.floor(ph * 8), ty * TS - camY + 4 + ((tx + ty) % 3) * 4, 3, 1);
  }
  const ents = [
    ...npcs.map((n) => ({ y: n.y, f: () => drawChar(n.spr[n.face][0], n.x * TS - camX, n.y * TS - camY - (Math.floor(anim * 1.6 + n.seed) % 2)) })),
    ...mons.filter((m) => m.dead <= 0).map((m) => ({ y: m.py, f: () => drawMon(m, camX, camY) })),
    { y: me.py + 0.01, f: () => drawMe(camX, camY) },
  ].sort((a, b) => a.y - b.y);
  ents.forEach((e) => e.f());
  if (fishing) {
    const bx = fishing.tx * TS - camX + 6, by = fishing.ty * TS - camY + 6 + (fishing.state === 'bite' ? Math.round(Math.sin(anim * 30)) : Math.round(Math.sin(anim * 3)));
    ctx.strokeStyle = 'rgba(255,248,231,.7)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(Math.round(me.px * TS - camX) + 8, Math.round(me.py * TS - camY) + 4); ctx.lineTo(bx + 2, by); ctx.stroke();
    ctx.drawImage(bobberS, bx, by);
    if (fishing.state === 'bite') ctx.drawImage(bangS, Math.round(me.px * TS - camX) + 6, Math.round(me.py * TS - camY) - 11);
  }
  for (const p of parts) {
    if (p.heart) ctx.drawImage(heartS, Math.round(p.x - camX), Math.round(p.y - camY));
    else { ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x - camX), Math.round(p.y - camY), 2, 2); }
  }
  // 文字用高解析度畫，不會糊
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  for (const f of floats) {
    const x = (f.x - camX) * SC, y = (f.y - camY - f.t * 14) * SC;
    ctx.globalAlpha = f.t > 0.8 ? (1.1 - f.t) / 0.3 : 1;
    ctx.font = `${f.big ? 64 : 50}px Silkscreen, Huninn, monospace`;
    ctx.lineWidth = 12; ctx.strokeStyle = '#2a1d2e'; ctx.strokeText(f.text, x, y);
    ctx.fillStyle = f.color; ctx.fillText(f.text, x, y);
  }
  ctx.globalAlpha = 1;
}
function shadow(x, y, w = 10) { ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(x + 8 - w / 2, y + 14, w, 2); ctx.fillRect(x + 9 - w / 2, y + 16, w - 2, 1); }
function drawChar(spr, x, y) { shadow(x, y); ctx.drawImage(spr, Math.round(x), Math.round(y) - 2); }
function drawMe(camX, camY) {
  const x = Math.round(me.px * TS - camX), y = Math.round(me.py * TS - camY);
  const frame = me.moving ? (me.mt > 0.5 ? 1 : 0) ^ me.step : 0;
  if (me.hurtT > 0 && Math.floor(me.hurtT * 20) % 2) { shadow(x, y); }
  else drawChar(heroS[me.face][frame], x, y);
  if (me.atkT > 0) { const [dx, dy] = DIRS[me.face]; ctx.globalAlpha = Math.min(1, me.atkT / 0.1); ctx.drawImage(slashS[me.face], x + dx * 12, y + dy * 12 - 2); ctx.globalAlpha = 1; }
}
function drawMon(m, camX, camY) {
  const x = Math.round(m.px * TS - camX), y = Math.round(m.py * TS - camY);
  const spr = slimeS[m.type][Math.floor(m.anim * 2.4) % 2];
  const big = m.d.boss;
  shadow(x, y, big ? 22 : 12);
  const draw = () => {
    if (big) { ctx.drawImage(spr, x - 8, y - 16, 32, 32); ctx.drawImage(crownS, x, y - 14 + (Math.floor(m.anim * 2.4) % 2) * 2); }
    else ctx.drawImage(spr, x, y);
  };
  draw();
  if (m.flash > 0) { ctx.globalCompositeOperation = 'lighter'; draw(); draw(); ctx.globalCompositeOperation = 'source-over'; }
  if (m.hp < m.d.hp) {
    const w = big ? 24 : 12, bx = x + 8 - w / 2, by = y + (big ? -18 : 2);
    ctx.fillStyle = '#2a1d2e'; ctx.fillRect(bx - 1, by - 1, w + 2, 4);
    ctx.fillStyle = '#d64550'; ctx.fillRect(bx, by, Math.max(1, Math.round((m.hp / m.d.hp) * w)), 2);
  }
}

// ---------- 主迴圈：鎖 30fps、背景時停止，避免發燙耗電 ----------
let last = 0;
function frame(t) {
  requestAnimationFrame(frame);
  if (t - last < 31) return;
  const dt = Math.min(0.1, (t - last) / 1000 || 0);
  last = t;
  if (document.hidden) return;
  update(dt);
  render();
}

function start() {
  if (started) return;
  started = true;
  $('title').hidden = true;
  if (P.quest === 0 && P.lv === 1) say('村長・歐文', ['歡迎來到微光村！', '我是村長歐文，就站在廣場北邊。', '用方向鍵移動，面向我按 A 就能說話。']);
}
$('startBtn').addEventListener('click', start);
$('startBtn').textContent = P.lv > 1 || P.coins > 0 || P.quest > 0 ? `繼續冒險（Lv ${P.lv}）` : '開始冒險';
$('titleArt').replaceChildren(...['down', 'right'].map((d, i) => { const c = document.createElement('canvas'); c.width = 96; c.height = 96; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(i ? slimeS.slime[0] : heroS.down[0], 0, 0, 96, 96); return c; }));
hud();
render();
document.fonts?.ready.then(render);
requestAnimationFrame(frame);
// 自動化測試用（網址加 ?debug 才開）
if (location.search.includes('debug')) globalThis.__game = { P, me, grid, get mons() { return mons; }, get fishing() { return fishing; }, get dialog() { return dialog; } };
