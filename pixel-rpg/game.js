import {
  W, H, T, TOWN_EDGE, FIELD_MIN_X, BOSS_ZONE, HOUSES, NPCS, SIGN, SPAWN, INN_SPOT, buildWorld, walkable,
  MONSTERS, ROSTER, expNeed, stats, swordCost, POTION_PRICE, POTION_HEAL_PCT, FISH, rollFish, gainExp, newPlayer, loadPlayer,
  rollGear, rarityOf, equipIfBetter, SLOTS, SLOT_NAME, DROP_RATE,
} from './world.js';
import { PAL, SLIME, CROWN, SLASH, BOBBER, BANG, HEART, COIN, ORB, makeSprite, rotate, charSet, SLIME_COLORS, drawMap } from './sprites.js';

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
const bobberS = makeSprite(BOBBER), bangS = makeSprite(BANG), heartS = makeSprite(HEART), coinS = makeSprite(COIN);
const orbS = {};
for (const r of ['common', 'good', 'rare', 'epic', 'legend']) orbS[r] = makeSprite(ORB, { ...PAL, x: rarityOf(r).color });

let P;
try { P = loadPlayer(localStorage.getItem(KEY)); } catch { P = newPlayer(); }
if (!walkable(grid, P.x, P.y)) { P.x = SPAWN.x; P.y = SPAWN.y; }
const me = { x: P.x, y: P.y, px: P.x, py: P.y, fx: P.x, fy: P.y, face: 'down', moving: false, mt: 0, step: 0, atkT: 0, hurtT: 0, cool: 0 };
function save() { P.x = me.x; P.y = me.y; try { localStorage.setItem(KEY, JSON.stringify(P)); } catch { /* 無痕模式不存 */ } }

const R = Math.random;
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const SKILLS = { spin: { name: '旋風斬', cd: 4, t: 0, mult: 2.2 }, meteor: { name: '流星雨', cd: 12, t: 0, mult: 3.6 } };
let mons = [], floats = [], parts = [], drops = [], rings = [], pending = [];
let dialog = null, fishing = null, started = false, held = null, aHeld = false, auto = false, autoHit = false;
let anim = 0, regenT = 0, saveT = 0, shake = 0, freeze = 0, flash = 0, combo = 0, comboT = 0;
const fmt = (n) => n.toLocaleString('en-US');

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
  Object.assign(m, { x: t.x, y: t.y, px: t.x, py: t.y, fx: t.x, fy: t.y, moving: false, hp: m.d.hp, dead: 0, cool: 1, think: R() * 1.5, flash: 0, kx: 0, ky: 0, spawnT: 0.4 });
}
mons = ROSTER.map((type) => { const m = { type, d: MONSTERS[type], anim: R() * 2 }; placeMon(m); return m; });

// ---------- 特效 ----------
function float(text, wx, wy, color = '#fff8e7', size = 1) { floats.push({ text, x: wx, y: wy, color, size, t: 0 }); }
const floatT = (text, tx, ty, color, size) => float(text, tx * TS + 8, ty * TS, color, size);
function burst(wx, wy, color, n = 8, speed = 70) {
  for (let i = 0; i < n; i++) parts.push({ x: wx, y: wy, vx: (R() - 0.5) * speed * 2, vy: -R() * speed - 10, c: color, t: 0 });
}
function ring(wx, wy, max, color, life = 0.35) { rings.push({ x: wx, y: wy, max, color, t: 0, life }); }
function feed(html, color) {
  const box = $('feed');
  const n = document.createElement('div');
  n.className = 'feeditem'; n.style.borderColor = color; n.innerHTML = html;
  box.prepend(n);
  while (box.children.length > 4) box.lastChild.remove();
  setTimeout(() => n.remove(), 3200);
}
function popCp(before, after) {
  const el = $('cpPop');
  el.innerHTML = `戰鬥力 <b>${fmt(after)}</b> <span>▲ ${fmt(after - before)}</span>`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}
function banner(text) { const el = $('banner'); el.textContent = text; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }
function bump(id) { const el = $(id); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }

// ---------- HUD ----------
let lastCp = 0;
function hud() {
  const st = stats(P);
  $('lv').textContent = P.lv;
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
  return ['找廣場北邊的村長歐文聊聊', `打倒史萊姆 ${Math.min(P.kills, 20)} / 20，再回報村長`, `挑戰東北方的史萊姆王（建議戰鬥力 ${fmt(1500)}）`,
    '回村子告訴村長好消息', '自由狩獵：刷裝備、提升戰鬥力'][P.quest] || '';
}
function renderGear() {
  $('gearList').innerHTML = SLOTS.map((s) => {
    const it = P.gear[s];
    if (!it) return `<div class="gslot"><span class="gname muted">${SLOT_NAME[s]}：空</span></div>`;
    const r = rarityOf(it.rarity);
    return `<div class="gslot" style="border-color:${r.color}"><span class="gtag" style="background:${r.color}">${r.name}</span><span class="gname" style="color:${r.color}">${it.name}</span><span class="gval">${it.stat === 'atk' ? '攻擊' : 'HP'} +${fmt(it.val)}</span></div>`;
  }).join('') + `<p class="muted small">武器強化 +${P.sword}（攻擊 +${P.sword * 3}）・比身上好的裝備會自動穿上，較差的自動賣掉。</p>`;
}
$('gearBtn').addEventListener('click', () => { renderGear(); $('gearPanel').hidden = false; });
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
    if (P.quest === 0) { P.quest = 1; P.kills = 0; say(nm, ['年輕人，草原上的史萊姆多到快滿出來了！', '過了東邊的橋就是史萊姆草原。', '幫我清掉 20 隻。打不完就按「自動」讓身體自己動吧！']); }
    else if (P.quest === 1 && P.kills >= 20) { P.quest = 2; P.coins += 200; P.potions += 3; say(nm, ['太厲害了！這是謝禮：200 金幣和 3 瓶藥水。', '東北方的空地住著史萊姆王，牠會掉超稀有的裝備。', `戰鬥力到 ${fmt(1500)} 左右再去挑戰吧。`]); }
    else if (P.quest === 1) say(nm, [`還差 ${20 - P.kills} 隻，加油！`]);
    else if (P.quest === 2) say(nm, ['史萊姆王很硬，記得留著「流星雨」對付牠。', '先刷裝備、到鐵匠鋪強化武器，再去挑戰。']);
    else if (P.quest === 3) { P.quest = 4; P.coins += 500; say(nm, ['你真的打倒了史萊姆王！', '你是微光村的英雄。收下這 500 金幣吧！']); }
    else say(nm, ['英雄，草原上的史萊姆又長回來了，隨時去刷吧！']);
  } else if (n.id === 'inn') {
    P.hp = stats(P).hp;
    say(nm, ['歡迎來到微光旅店！', '（你好好休息了一下，HP 全部恢復了）']);
  } else if (n.id === 'smith') {
    smithMenu(nm, [`你的武器強化是 +${P.sword}。`, `強化到 +${P.sword + 1}（攻擊 +3）要 ${fmt(swordCost(P.sword))} 金幣。`]);
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

// ---------- 戰鬥 ----------
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
function dealDamage(m, mult, fromX, fromY) {
  if (m.dead > 0 || m.hp <= 0) return;
  const crit = R() < 0.15;
  const dmg = Math.max(1, Math.round(stats(P).atk * mult * (0.85 + R() * 0.3) * (crit ? 2 : 1)));
  m.hp -= dmg; m.flash = 0.12;
  const kx = Math.sign(m.x - fromX), ky = Math.sign(m.y - fromY);
  m.kx = kx * 4; m.ky = ky * 4;
  float(crit ? `${fmt(dmg)}!` : fmt(dmg), m.px * TS + 8 + (R() - 0.5) * 10, m.py * TS - 2 - R() * 4, crit ? '#ff9f1c' : '#fff8e7', crit ? 1.5 : 1);
  burst(m.px * TS + 8, m.py * TS + 10, SLIME_COLORS[m.type].g, crit ? 10 : 5);
  combo++; comboT = 2.2; showCombo();
  freeze = Math.max(freeze, crit ? 0.07 : 0.03);
  if (crit) shake = Math.max(shake, 0.1);
  if (m.hp <= 0) killMon(m);
}
function killMon(m) {
  const wx = m.px * TS + 8, wy = m.py * TS + 8;
  m.dead = m.d.boss ? 30 : 2.5;
  burst(wx, wy, SLIME_COLORS[m.type].l, m.d.boss ? 40 : 14, m.d.boss ? 140 : 90);
  ring(wx, wy, m.d.boss ? 40 : 14, SLIME_COLORS[m.type].l);
  // 金幣噴出來
  let coins = m.d.coin[0] + Math.floor(R() * (m.d.coin[1] - m.d.coin[0] + 1));
  const n = Math.min(m.d.boss ? 14 : 5, coins);
  for (let i = 0; i < n; i++) { const v = i === n - 1 ? coins : Math.floor(coins / (n - i)); coins -= v; drops.push(newDrop('coin', wx, wy, v)); }
  // 裝備
  const rolls = m.d.boss ? 3 : R() < DROP_RATE ? 1 : 0;
  for (let i = 0; i < rolls; i++) drops.push(newDrop('item', wx, wy, rollGear(R, m.d.lv + Math.floor(R() * 2), m.d.boss)));
  if (P.quest === 1 && !m.d.boss) P.kills++;
  if (m.d.boss) { if (P.quest === 2) P.quest = 3; shake = 0.4; flash = 0.25; banner('擊敗史萊姆王！'); }
  floatT(`+${m.d.exp} EXP`, m.x, m.y - 0.9, '#a6ec7a', 0.8);
  const before = P.lv;
  if (gainExp(P, m.d.exp)) levelUp(before);
  hud();
}
function levelUp(before) {
  banner(`等級提升！Lv ${before} → Lv ${P.lv}`);
  const wx = me.px * TS + 8, wy = me.py * TS + 8;
  ring(wx, wy, 30, '#f6c945', 0.6); ring(wx, wy, 18, '#fff8e7', 0.45);
  for (let i = 0; i < 10; i++) parts.push({ x: wx, y: wy - 4, vx: (R() - 0.5) * 80, vy: -60 - R() * 60, heart: true, t: 0 });
  flash = Math.max(flash, 0.12);
  popCp(0, stats(P).cp); $('cpPop').querySelector('span').textContent = '升級！';
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
  if (res.equipped) { feed(`<b style="color:${r.color}">【${r.name}】${it.name}</b> 已裝備`, r.color); popCp(res.before, res.after); }
  else feed(`<span style="color:${r.color}">【${r.name}】${it.name}</span> 自動賣出 +${res.sold}`, r.color);
  if (it.rarity === 'epic' || it.rarity === 'legend') { flash = Math.max(flash, 0.1); shake = Math.max(shake, 0.15); }
  hud(); save();
}

function frontTiles() {
  const [dx, dy] = DIRS[me.face];
  const fx = me.x + dx, fy = me.y + dy;
  return dx ? [[fx, fy], [fx, fy - 1], [fx, fy + 1]] : [[fx, fy], [fx - 1, fy], [fx + 1, fy]];
}
function basicAttack() {
  me.cool = 0.22; me.atkT = 0.15;
  const tiles = frontTiles();
  for (const m of mons) if (m.dead <= 0 && tiles.some(([x, y]) => (m.d.boss ? Math.abs(m.x - x) <= 1 && Math.abs(m.y - y) <= 1 : m.x === x && m.y === y))) dealDamage(m, 1, me.x, me.y);
}
function cast(id) {
  if (!started || dialog) return;
  const s = SKILLS[id];
  if (s.t > 0) return;
  s.t = s.cd;
  const wx = me.px * TS + 8, wy = me.py * TS + 8;
  if (id === 'spin') {
    ring(wx, wy, 26, '#fff8e7', 0.3); ring(wx, wy, 20, '#bdf1ff', 0.25);
    shake = Math.max(shake, 0.15);
    for (const m of mons) if (m.dead <= 0 && Math.max(Math.abs(m.x - me.x), Math.abs(m.y - me.y)) <= (m.d.boss ? 2 : 1)) dealDamage(m, s.mult, me.x, me.y);
  } else {
    flash = 0.2; shake = 0.35;
    const targets = mons.filter((m) => m.dead <= 0 && Math.max(Math.abs(m.x - me.x), Math.abs(m.y - me.y)) <= 4);
    targets.forEach((m, i) => {
      const tx = m.px * TS + 8, ty = m.py * TS + 8;
      for (let k = 0; k < 6; k++) parts.push({ x: tx - 30 + k * 2, y: ty - 80 + k * 4, vx: 140, vy: 260, c: k % 2 ? '#ffd166' : '#ff8a3d', t: 0.3 - i * 0.03, big: true });
      pending.push({ t: 0.22 + i * 0.03, fn: () => { ring(tx, ty, 16, '#ffd166'); dealDamage(m, s.mult, me.x, me.y); } });
    });
    if (!targets.length) floatT('附近沒有怪物', me.x, me.y - 0.6, '#bdf1ff', 0.8);
  }
}
function showCombo() {
  const el = $('combo');
  el.innerHTML = `<b>${combo}</b> COMBO`;
  el.hidden = combo < 3;
  el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
}

// ---------- 自動狩獵 ----------
const dirTo = (x, y) => (x > me.x ? 'right' : x < me.x ? 'left' : y > me.y ? 'down' : 'up');
function autoThink() {
  autoHit = false;
  if (!auto || dialog || fishing || me.moving) return;
  const st = stats(P);
  const targets = mons.filter((m) => m.dead <= 0 && (m.d.boss ? P.quest >= 2 && st.cp >= 1200 : m.d.lv <= P.lv + 2));
  const adj = targets.find((m) => Math.abs(m.x - me.x) + Math.abs(m.y - me.y) === 1);
  const near = targets.filter((m) => Math.max(Math.abs(m.x - me.x), Math.abs(m.y - me.y)) <= 1).length;
  if (SKILLS.spin.t <= 0 && near >= 2) cast('spin');
  const view = targets.filter((m) => Math.max(Math.abs(m.x - me.x), Math.abs(m.y - me.y)) <= 4);
  if (SKILLS.meteor.t <= 0 && (view.length >= 3 || view.some((m) => m.d.boss && Math.abs(m.x - me.x) + Math.abs(m.y - me.y) <= 2))) cast('meteor');
  if (adj) { me.face = dirTo(adj.x, adj.y); autoHit = true; return; }
  // BFS 找最近能打到怪的位置
  const goal = new Set();
  for (const m of targets) for (const [dx, dy] of Object.values(DIRS)) goal.add(`${m.x + dx},${m.y + dy}`);
  const start = `${me.x},${me.y}`, prev = { [start]: null }, q = [[me.x, me.y]];
  let found = null;
  while (q.length && !found) {
    const [x, y] = q.shift();
    for (const [dx, dy] of Object.values(DIRS)) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
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
  Object.assign(me, { fx: me.x, fy: me.y, x: nx, y: ny, moving: true, mt: 0 });
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
  if (!monHere && t === T.WATER) { fishing = { tx, ty, state: 'wait', t: 1.2 + R() * 2 }; return; }
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
  floatT(`+${heal}`, me.x, me.y, '#a6ec7a'); burst(me.px * TS + 8, me.py * TS + 8, '#ff8fb1', 8);
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
bindHold($('spinBtn'), () => cast('spin'));
bindHold($('meteorBtn'), () => cast('meteor'));
const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };
addEventListener('keydown', (e) => {
  if (KEYS[e.code]) { held = KEYS[e.code]; e.preventDefault(); return; }
  if (e.repeat) return;
  if (['Space', 'Enter', 'KeyJ'].includes(e.code)) { e.preventDefault(); if (!started) start(); else pressA(); }
  else if (e.code === 'KeyQ') cast('spin');
  else if (e.code === 'KeyE') cast('meteor');
  else if (e.code === 'KeyX') usePotion();
  else if (e.code === 'KeyR') $('autoBtn').click();
});
addEventListener('keyup', (e) => {
  if (KEYS[e.code] === held) held = null;
  if (['Space', 'Enter', 'KeyJ'].includes(e.code)) aHeld = false;
});
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
  if (me.moving && step(me, 0.14, dt)) me.step ^= 1;
  if (held && auto) { auto = false; syncAuto(); }
  if (!me.moving && started && held && !dialog && !fishing) {
    const [dx, dy] = DIRS[held];
    me.face = held;
    const nx = me.x + dx, ny = me.y + dy;
    if (walkable(grid, nx, ny) && !occupied(nx, ny)) Object.assign(me, { fx: me.x, fy: me.y, x: nx, y: ny, moving: true, mt: 0 });
  }
  if (started && !held) autoThink();
  me.atkT = Math.max(0, me.atkT - dt); me.hurtT = Math.max(0, me.hurtT - dt); me.cool = Math.max(0, me.cool - dt);
  if ((aHeld || autoHit) && me.cool <= 0 && !dialog && !fishing && !me.moving && started) basicAttack();
  for (const s of Object.values(SKILLS)) s.t = Math.max(0, s.t - dt);
  shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt);
  comboT -= dt;
  if (comboT <= 0 && combo) { combo = 0; $('combo').hidden = true; }
  regenT += dt;
  if (regenT > 1) { regenT = 0; const max = stats(P).hp; if (P.hp < max) { P.hp = Math.min(max, P.hp + (me.x <= TOWN_EDGE ? Math.ceil(max * 0.08) : 1)); hud(); } }
  pending = pending.filter((p) => { p.t -= dt; if (p.t <= 0) { p.fn(); return false; } return true; });
  for (const m of mons) {
    m.anim += dt;
    if (m.dead > 0) { m.dead -= dt; if (m.dead <= 0) placeMon(m); continue; }
    m.flash = Math.max(0, m.flash - dt); m.cool -= dt; m.spawnT = Math.max(0, m.spawnT - dt);
    m.kx *= 0.8; m.ky *= 0.8;
    if (m.moving) { step(m, m.d.boss ? 0.5 : 0.35, dt); continue; }
    if (!started || dialog) continue;
    const dx = me.x - m.x, dy = me.y - m.y, dist = Math.abs(dx) + Math.abs(dy);
    if (dist === 1 && m.cool <= 0) { hitPlayer(m); m.cool = m.d.boss ? 1.2 : 1.5; continue; }
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
  // 掉落物：先彈跳，再被吸過來
  const px = me.px * TS + 8, py = me.py * TS + 8;
  drops = drops.filter((d) => {
    d.t += dt;
    if (d.t < 0.55) { d.x += d.vx * dt; d.y += d.vy * dt; d.vz -= 320 * dt; d.z = Math.max(0, d.z + d.vz * dt); if (d.z === 0) d.vz = Math.abs(d.vz) * 0.4; return true; }
    const ax = px - d.x, ay = py - d.y, dist = Math.hypot(ax, ay);
    if (dist < 6 || d.t > 3) { collect(d); return false; }
    const sp = 80 + (d.t - 0.55) * 400;
    d.x += (ax / dist) * sp * dt; d.y += (ay / dist) * sp * dt; d.z = Math.max(0, d.z - dt * 30);
    return true;
  });
  floats = floats.filter((f) => (f.t += dt) < 0.9);
  parts = parts.filter((p) => { p.t += dt; if (p.t < 0) return true; p.x += p.vx * dt; p.y += p.vy * dt; if (!p.big) p.vy += 240 * dt; return p.t < (p.big ? 0.35 : 0.6); });
  rings = rings.filter((r) => (r.t += dt) < r.life);
  saveT += dt;
  if (saveT > 5) { saveT = 0; save(); }
  // 頭目血條
  const boss = mons.find((m) => m.d.boss);
  const showBoss = boss && boss.dead <= 0 && Math.abs(boss.x - me.x) + Math.abs(boss.y - me.y) <= 7;
  $('bossBar').hidden = !showBoss;
  if (showBoss) $('bossFill').style.width = `${Math.max(0, boss.hp / boss.d.hp) * 100}%`;
}
function updateSkillUi() {
  for (const [id, s] of Object.entries(SKILLS)) {
    const el = $(`${id}Btn`);
    el.style.setProperty('--p', `${(s.t / s.cd) * 360}deg`);
    el.querySelector('em').textContent = s.t > 0 ? Math.ceil(s.t) : '';
    el.classList.toggle('ready', s.t <= 0);
  }
}

// ---------- 繪製 ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function render() {
  ctx.setTransform(SC, 0, 0, SC, 0, 0);
  ctx.imageSmoothingEnabled = false;
  let camX = clamp(Math.round(me.px * TS + 8 - VW / 2), 0, W * TS - VW);
  let camY = clamp(Math.round(me.py * TS + 8 - VH / 2), 0, H * TS - VH);
  if (shake > 0) { const s = Math.min(4, shake * 14); camX += Math.round((R() - 0.5) * s); camY += Math.round((R() - 0.5) * s); }
  ctx.drawImage(mapC, camX, camY, VW, VH, 0, 0, VW, VH);
  ctx.fillStyle = 'rgba(255,255,255,.45)';
  const tx0 = Math.floor(camX / TS), ty0 = Math.floor(camY / TS);
  for (let ty = ty0; ty <= ty0 + 12; ty++) for (let tx = tx0; tx <= tx0 + 11; tx++) {
    if (grid[ty]?.[tx] !== T.WATER && grid[ty]?.[tx] !== T.FOUNTAIN) continue;
    const ph = (anim * 1.3 + tx * 0.37 + ty * 0.61) % 3;
    if (ph < 1) ctx.fillRect(tx * TS - camX + 3 + Math.floor(ph * 8), ty * TS - camY + 4 + ((tx + ty) % 3) * 4, 3, 1);
  }
  // 掉落物（在角色後面先畫光柱）
  for (const d of drops) {
    const x = Math.round(d.x - camX), y = Math.round(d.y - camY - d.z);
    if (d.kind === 'item') {
      const r = rarityOf(d.val.rarity);
      if (['rare', 'epic', 'legend'].includes(r.id)) { ctx.globalAlpha = 0.35 + Math.sin(anim * 10) * 0.1; ctx.fillStyle = r.color; ctx.fillRect(x - 2, y - 40, 4, 40); ctx.globalAlpha = 1; }
      ctx.drawImage(orbS[r.id], x - 3, y - 4);
    } else ctx.drawImage(coinS, x - 3, y - 3);
  }
  const ents = [
    ...npcs.map((n) => ({ y: n.y, f: () => drawChar(n.spr[n.face][0], n.x * TS - camX, n.y * TS - camY - (Math.floor(anim * 1.6 + n.seed) % 2)) })),
    ...mons.filter((m) => m.dead <= 0).map((m) => ({ y: m.py, f: () => drawMon(m, camX, camY) })),
    { y: me.py + 0.01, f: () => drawMe(camX, camY) },
  ].sort((a, b) => a.y - b.y);
  ents.forEach((e) => e.f());
  for (const r of rings) {
    const k = r.t / r.life;
    ctx.globalAlpha = 1 - k; ctx.strokeStyle = r.color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(Math.round(r.x - camX), Math.round(r.y - camY), 2 + r.max * k, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (fishing) {
    const bx = fishing.tx * TS - camX + 6, by = fishing.ty * TS - camY + 6 + (fishing.state === 'bite' ? Math.round(Math.sin(anim * 30)) : Math.round(Math.sin(anim * 3)));
    ctx.strokeStyle = 'rgba(255,248,231,.7)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(Math.round(me.px * TS - camX) + 8, Math.round(me.py * TS - camY) + 4); ctx.lineTo(bx + 2, by); ctx.stroke();
    ctx.drawImage(bobberS, bx, by);
    if (fishing.state === 'bite') ctx.drawImage(bangS, Math.round(me.px * TS - camX) + 6, Math.round(me.py * TS - camY) - 11);
  }
  for (const p of parts) {
    if (p.t < 0) continue;
    if (p.heart) ctx.drawImage(heartS, Math.round(p.x - camX), Math.round(p.y - camY));
    else { ctx.fillStyle = p.c; const s = p.big ? 3 : 2; ctx.fillRect(Math.round(p.x - camX), Math.round(p.y - camY), s, s); }
  }
  if (flash > 0) { ctx.fillStyle = `rgba(255,248,231,${Math.min(0.6, flash * 3)})`; ctx.fillRect(0, 0, VW, VH); }
  // 文字用高解析度畫
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
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
function shadow(x, y, w = 10) { ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(x + 8 - w / 2, y + 14, w, 2); ctx.fillRect(x + 9 - w / 2, y + 16, w - 2, 1); }
function drawChar(spr, x, y) { shadow(x, y); ctx.drawImage(spr, Math.round(x), Math.round(y) - 2); }
function drawMe(camX, camY) {
  const x = Math.round(me.px * TS - camX), y = Math.round(me.py * TS - camY);
  const frame = me.moving ? (me.mt > 0.5 ? 1 : 0) ^ me.step : 0;
  if (me.hurtT > 0 && Math.floor(me.hurtT * 20) % 2) shadow(x, y);
  else drawChar(heroS[me.face][frame], x, y);
  if (me.atkT > 0) {
    const [dx, dy] = DIRS[me.face];
    ctx.globalAlpha = Math.min(1, me.atkT / 0.08);
    ctx.drawImage(slashS[me.face], x + dx * 13 - (dx ? 0 : 8), y + dy * 13 - 2 - (dy ? 0 : 8), dx ? 16 : 32, dy ? 16 : 32);
    ctx.globalAlpha = 1;
  }
}
function drawMon(m, camX, camY) {
  const x = Math.round(m.px * TS - camX + m.kx), y = Math.round(m.py * TS - camY + m.ky);
  const spr = slimeS[m.type][Math.floor(m.anim * 2.4) % 2];
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
  if (m.hp < m.d.hp && !big) {
    const w = 12, bx = x + 2, by = y + 2;
    ctx.fillStyle = '#2a1d2e'; ctx.fillRect(bx - 1, by - 1, w + 2, 4);
    ctx.fillStyle = '#e8506a'; ctx.fillRect(bx, by, Math.max(1, Math.round((m.hp / m.d.hp) * w)), 2);
  }
}

// ---------- 主迴圈：鎖 30fps、背景時停止，避免發燙耗電 ----------
let last = 0;
function frame(t) {
  requestAnimationFrame(frame);
  if (t - last < 31) return;
  let dt = Math.min(0.1, (t - last) / 1000 || 0);
  last = t;
  if (document.hidden) return;
  if (freeze > 0) { freeze -= dt; dt *= 0.15; } // 打擊停頓：命中瞬間時間變慢
  update(dt);
  updateSkillUi();
  render();
}

function start() {
  if (started) return;
  started = true;
  $('title').hidden = true;
  if (P.quest === 0 && P.lv === 1) say('村長・歐文', ['歡迎來到微光村！我是村長歐文。', '按住紅色「攻擊」鍵可以連續砍，旁邊兩顆是技能。', '懶得操作就按上面的「自動」，角色會自己去打怪！', '先來廣場北邊找我說話吧。']);
}
$('startBtn').addEventListener('click', start);
$('startBtn').textContent = P.lv > 1 || P.coins > 0 || P.quest > 0 ? `繼續冒險（Lv ${P.lv}）` : '開始冒險';
$('titleArt').replaceChildren(...[heroS.down[0], slimeS.slime[0], slimeS.berry[0], slimeS.ember[0]].map((s) => { const c = document.createElement('canvas'); c.width = 96; c.height = 96; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(s, 0, 0, 96, 96); return c; }));
syncAuto();
hud();
render();
document.fonts?.ready.then(render);
requestAnimationFrame(frame);

// 自動化測試用（網址加 ?debug 才開）
if (location.search.includes('debug')) globalThis.__game = { P, me, grid, get mons() { return mons; }, get fishing() { return fishing; }, get dialog() { return dialog; }, get drops() { return drops; } };
