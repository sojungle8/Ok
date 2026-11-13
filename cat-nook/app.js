import {
  MATERIALS, MATERIAL_PRICE, RARITY, CATS, FURNITURE, DAILY_PET_COOKIES, QUEST_REWARD,
  todayStr, newState, loadState, ensureDaily, summon, finishGame, missingFor,
  buyBlueprint, craft, buyMaterial, pet, feed, heartLevel, claimQuest, comfort, getCat, getFurniture,
} from './logic.js';
import { INK, catSVG, furnitureSVG, SLOTS, ROOM_BG, ICON } from './art.js';

const KEY = 'meow-nook-v1';
const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const RCOLOR = { common: 'var(--common)', rare: 'var(--rare)', epic: 'var(--epic)', legendary: 'var(--legendary)' };

let state;
try { state = loadState(localStorage.getItem(KEY), todayStr()); } catch { state = newState(todayStr()); }
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 無痕模式等情況下不儲存 */ } }

document.querySelectorAll('i[data-icon]').forEach((n) => { n.innerHTML = ICON[n.dataset.icon]; });
$('roomBg').innerHTML = ROOM_BG;
$('summonArt').innerHTML = catSVG({ ...CATS[13], rarity: 'legendary' }, 92);

let toastTimer;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
const matText = (obj) => Object.entries(obj).map(([k, n]) => `${MATERIALS[k].name}×${n}`).join('、');
const chips = (obj) => Object.entries(obj).map(([k, n]) => `<span class="chip">${ICON[k]}${MATERIALS[k].name} ×${n}</span>`).join('');

function renderHud() {
  $('coins').textContent = state.coins;
  $('cookies').textContent = state.cookies;
  $('mats').innerHTML = Object.keys(MATERIALS).map((k) => `<span title="${MATERIALS[k].name}">${ICON[k]}${state.materials[k]}</span>`).join('');
  $('questDot').hidden = !state.daily.quests.some((q) => !q.claimed && q.progress >= q.goal);
}
function renderAll() { renderHud(); renderRoom(); renderCats(); renderShop(); renderQuests(); renderBaker(); }
function commit() { save(); renderAll(); }

// ---------- 小窩 ----------
function placeCat(n, first) {
  const x = 8 + Math.random() * 84;
  const y = 74 + Math.random() * 24;
  const old = parseFloat(n.style.left);
  if (!first) n.classList.toggle('left', x < old);
  n.style.left = `${x}%`;
  n.style.top = `${y}%`;
  n.style.zIndex = Math.round(y * 10 + 5);
}

function renderRoom() {
  $('comfort').textContent = comfort(state);
  const room = $('room');
  room.querySelectorAll('.furn,.sign').forEach((n) => n.remove());
  const owned = [...new Set(state.furniture)];
  owned.forEach((id) => {
    const s = SLOTS[id];
    const n = el('div', 'furn', furnitureSVG(id));
    Object.assign(n.style, { left: `${s.x}%`, top: `${s.y}%`, width: `${(s.w / 400) * 100}%`, zIndex: Math.round(s.y * 10) });
    n.title = getFurniture(id).name;
    room.appendChild(n);
  });
  if (!owned.length) room.appendChild(el('div', 'sign', '空蕩蕩的…去工坊做家具吧！'));
  const cats = Object.keys(state.cats).slice(0, 8);
  room.querySelectorAll('.cat').forEach((n) => { if (!cats.includes(n.dataset.id)) n.remove(); });
  cats.forEach((id, i) => {
    if (room.querySelector(`.cat[data-id="${id}"]`)) return;
    const c = getCat(id);
    const n = el('div', 'cat', `<div class="flip">${catSVG(c, 76)}</div>`);
    n.dataset.id = id;
    n.style.width = '19%';
    n.querySelector('svg').style.cssText = `width:100%;height:auto;animation-delay:-${i * 0.7}s`;
    n.setAttribute('role', 'button');
    n.setAttribute('tabindex', '0');
    n.setAttribute('aria-label', `摸摸${c.name}`);
    placeCat(n, true);
    n.addEventListener('click', (e) => onPet(id, n, e));
    n.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPet(id, n, null); } });
    room.appendChild(n);
  });
}

setInterval(() => {
  document.querySelectorAll('#room .cat').forEach((n) => { if (Math.random() < 0.45) placeCat(n, false); });
}, 4000);

function onPet(id, n, e) {
  const r = pet(state, id);
  if (!r.ok) return;
  const room = $('room');
  const rect = room.getBoundingClientRect();
  const cr = n.getBoundingClientRect();
  const px = e ? e.clientX : cr.left + cr.width / 2;
  const py = e ? e.clientY : cr.top;
  const h = el('span', 'heart', r.cookie ? '💗🍪' : '💗');
  h.style.left = `${px - rect.left - 14}px`;
  h.style.top = `${py - rect.top - 28}px`;
  room.appendChild(h);
  setTimeout(() => h.remove(), 900);
  n.classList.remove('petted'); void n.offsetWidth; n.classList.add('petted');
  if (!r.cookie && state.daily.petCookies === DAILY_PET_COOKIES) toast('今天的摸摸餅乾領完了，明天再來');
  save(); renderHud(); renderQuests();
}

// ---------- 貓咪 ----------
function renderCats() {
  $('pity').textContent = state.pity;
  $('catGrid').replaceChildren(...CATS.map((c) => {
    const own = state.cats[c.id];
    const card = el('div', `catcard ${c.rarity}${own ? '' : ' locked'}`);
    if (!own) { card.innerHTML = `${catSVG(c, 76)}<b>？？？</b><span class="rar">${RARITY[c.rarity].label}</span>`; return card; }
    const lv = heartLevel(own.affection);
    card.innerHTML = `${catSVG(c, 76)}<b>${c.name}</b><span class="rar">${RARITY[c.rarity].label}</span><div class="hearts" aria-label="好感 ${lv}/5">${'♥'.repeat(lv)}${'♡'.repeat(5 - lv)}</div>`;
    const b = el('button', 'btn sm ghost', `餵 ${ICON.cookie}`);
    b.addEventListener('click', () => {
      const r = feed(state, c.id);
      toast(r.ok ? `${c.name}吃得好開心！好感 +5` : r.reason);
      commit();
    });
    card.appendChild(b);
    return card;
  }));
}

$('summon').addEventListener('click', () => {
  const r = summon(state);
  if (!r.ok) { toast(r.reason); return; }
  commit();
  $('revealBody').innerHTML = `${catSVG(r.cat, 150)}<h2>${r.cat.name}</h2><span class="tag" style="background:${RCOLOR[r.cat.rarity]}">${RARITY[r.cat.rarity].label}</span><p class="muted">${r.isNew ? '新貓咪加入小窩了！' : `已經有了，換成 ${r.bonus} 塊餅乾`}</p>`;
  $('reveal').showModal();
});
$('revealOk').addEventListener('click', () => $('reveal').close());

// ---------- 工坊 ----------
function renderShop() {
  $('matShop').replaceChildren(...Object.entries(MATERIALS).map(([k, m]) => {
    const b = el('button', 'matbtn', `${ICON[k]}<span>買${m.name}<small>${MATERIAL_PRICE} 金幣・持有 ${state.materials[k]}</small></span>`);
    b.addEventListener('click', () => { const r = buyMaterial(state, k); if (!r.ok) toast(r.reason); else toast(`買了 1 個${m.name}`); commit(); });
    return b;
  }));
  $('bpList').replaceChildren(...FURNITURE.map((f) => {
    const card = el('div', 'bp');
    const owned = state.blueprints.includes(f.id);
    const miss = missingFor(state, f.id);
    const lacking = Object.keys(miss).length > 0;
    const needs = Object.entries(f.recipe).map(([k, n]) =>
      `<span class="need${miss[k] ? ' lack' : ''}">${ICON[k]}${state.materials[k]}/${n}</span>`).join('');
    const made = state.furniture.filter((x) => x === f.id).length;
    const status = lacking ? `<span class="small muted">還缺 ${matText(miss)}</span>` : '<span class="ok">材料足夠</span>';
    card.innerHTML = `<div class="art">${furnitureSVG(f.id, 60)}</div><div><b>${f.name}</b> <span class="small muted">舒適 +${f.comfort}${made ? `・已有 ${made}` : ''}</span><br>${needs}<br>${status}</div>`;
    const b = owned ? el('button', 'btn sm mint', '製作') : el('button', 'btn sm ghost', `${ICON.coin}${f.price}`);
    b.setAttribute('aria-label', owned ? `製作${f.name}` : `用 ${f.price} 金幣買${f.name}藍圖`);
    if (owned && lacking) b.disabled = true;
    b.addEventListener('click', () => {
      const r = owned ? craft(state, f.id) : buyBlueprint(state, f.id);
      toast(r.ok ? (owned ? `${f.name}做好了，已放進小窩！` : `買到${f.name}藍圖`) : r.reason);
      commit();
    });
    card.appendChild(b);
    return card;
  }));
}

// ---------- 任務 ----------
function renderQuests() {
  $('questList').replaceChildren(...state.daily.quests.map((q, i) => {
    const done = q.progress >= q.goal;
    const card = el('div', `quest${done ? ' done' : ''}`);
    card.innerHTML = `<div><b style="font-weight:400;font-size:17px">${q.text}</b><div class="small muted">獎勵 ${ICON.coin}${QUEST_REWARD.coins}・隨機材料 ×${QUEST_REWARD.mats}</div></div>`;
    const b = el('button', `btn sm${done && !q.claimed ? ' mint' : ''}`, q.claimed ? '已領取' : done ? '領取' : `${q.progress}/${q.goal}`);
    b.disabled = q.claimed || !done;
    b.addEventListener('click', () => {
      const r = claimQuest(state, i);
      if (r.ok) toast(`獲得 ${r.coins} 金幣、${matText(r.mats)}`);
      commit();
    });
    card.appendChild(b);
    card.appendChild(el('div', 'bar', `<i style="width:${(q.progress / q.goal) * 100}%"></i>`));
    return card;
  }));
  renderHud();
}

// ---------- 疊疊蛋糕 ----------
const cv = $('stack');
const ctx = cv.getContext('2d');
ctx.scale(2, 2);
const W = 360, HH = 460, LH = 32, MAX = 10, BASE = HH - 46;
const LAYERS = [
  { sponge: '#ffc2d1', frost: '#fffaf5', shade: '#eaa0b4' },
  { sponge: '#c8e6a0', frost: '#fff4dc', shade: '#a2c97b' },
  { sponge: '#b07a56', frost: '#ffd6e0', shade: '#8c5a3c' },
  { sponge: '#ffe7a3', frost: '#ff9eb5', shade: '#ebc96f' },
  { sponge: '#d8c4f0', frost: '#fffaf5', shade: '#b69dd8' },
  { sponge: '#ffcf7a', frost: '#ffffff', shade: '#e8a94a' },
];
const SPR = ['#ff7b54', '#5fbf98', '#ffd66b', '#7aa7ff', '#ff8fb8'];
const seeded = (s) => () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
let game = null;

function drawBg() {
  ctx.fillStyle = '#fdeee4'; ctx.fillRect(0, 0, W, HH);
  ctx.strokeStyle = '#f5dccb'; ctx.lineWidth = 2;
  for (let x = 0; x <= W; x += 36) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HH - 36); ctx.stroke(); }
  for (let y = 0; y <= HH - 36; y += 36) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.fillStyle = '#d9a066'; ctx.fillRect(0, HH - 36, W, 36);
  ctx.fillStyle = '#e8b67c'; ctx.fillRect(0, HH - 36, W, 7);
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(0, HH - 36); ctx.lineTo(W, HH - 36); ctx.stroke();
  // 蛋糕台
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(W / 2 - 12, BASE + 6, 24, HH - 36 - BASE - 6, 3); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(W / 2, BASE + 4, 128, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}

function drawLayer(x, y, w, i) {
  const p = LAYERS[i % LAYERS.length];
  const r = seeded(i * 97 + 13);
  const h = LH;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 7); ctx.clip();
  ctx.fillStyle = p.sponge; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = p.shade; ctx.fillRect(x, y + h - 7, w, 7);
  ctx.fillStyle = p.frost;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + 9);
  let cx = x + w;
  while (cx > x + 0.5) { const seg = Math.min(15, cx - x); const d = 5 + r() * 12; ctx.quadraticCurveTo(cx - seg / 2, y + 9 + d, cx - seg, y + 9); cx -= seg; }
  ctx.closePath(); ctx.fill();
  const n = Math.max(1, Math.floor(w / 20));
  for (let k = 0; k < n; k++) {
    ctx.save(); ctx.translate(x + 5 + r() * (w - 10), y + 3 + r() * 5); ctx.rotate(r() * Math.PI);
    ctx.fillStyle = SPR[k % SPR.length]; ctx.fillRect(-3.5, -1.2, 7, 2.6); ctx.restore();
  }
  ctx.restore();
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 7); ctx.stroke();
}

function drawCherry(x, y) {
  ctx.strokeStyle = '#5a8a3a'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.quadraticCurveTo(x + 4, y - 24, x + 12, y - 26); ctx.stroke();
  ctx.fillStyle = '#ff4f5e'; ctx.strokeStyle = INK;
  ctx.beginPath(); ctx.arc(x, y - 8, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffffaa'; ctx.beginPath(); ctx.arc(x - 3, y - 11, 2.5, 0, Math.PI * 2); ctx.fill();
}

function badge(text, x, y, color) {
  ctx.font = '18px Huninn, "PingFang TC", sans-serif';
  const w = ctx.measureText(text).width + 24;
  ctx.fillStyle = color; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(x, y, w, 32, 16); ctx.fill(); ctx.stroke();
  ctx.fillStyle = color === '#fffaf6' ? INK : '#fff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillText(text, x + 12, y + 17);
}

function drawGame() {
  drawBg();
  if (!game) {
    drawLayer(W / 2 - 100, BASE - LH, 200, 0);
    badge('按下方按鈕開始', W / 2 - 80, 150, '#fffaf6');
    return;
  }
  game.stack.forEach((b, i) => drawLayer(b.x, BASE - (i + 1) * LH, b.w, i));
  if (game.moving) drawLayer(game.moving.x, BASE - (game.stack.length + 1) * LH, game.moving.w, game.stack.length);
  const top = game.stack[game.stack.length - 1];
  if (game.over && game.stack.length - 1 >= MAX) drawCherry(top.x + top.w / 2, BASE - game.stack.length * LH);
  badge(`${game.stack.length - 1} / ${MAX} 層`, 12, 12, '#fffaf6');
  if (game.perfect > 0) badge('完美！', W - 92, 12, '#ff7b54');
}

function spawn() {
  const top = game.stack[game.stack.length - 1];
  const fromLeft = game.stack.length % 2 === 0;
  // 從畫面邊緣（可見處）出發，避免一開局還沒看到就點了直接輸
  game.moving = { x: fromLeft ? 0 : W - top.w, w: top.w, dir: fromLeft ? 1 : -1 };
  game.speed = 140 + game.stack.length * 18;
}

function loop(t) {
  if (!game || game.over) return;
  const dt = Math.min(0.05, (t - (game.last || t)) / 1000);
  game.last = t;
  const m = game.moving;
  m.x += m.dir * game.speed * dt;
  if (m.x + m.w > W) { m.x = W - m.w; m.dir = -1; }
  if (m.x < 0) { m.x = 0; m.dir = 1; }
  if (game.perfect > 0) game.perfect -= dt;
  drawGame();
  game.raf = requestAnimationFrame(loop);
}

function startGame() {
  if (game && !game.over) return;
  game = { stack: [{ x: W / 2 - 100, w: 200 }], moving: null, over: false, perfect: 0 };
  $('gameResult').hidden = true;
  $('play').disabled = true;
  $('play').textContent = '點蛋糕畫面放下這一層';
  spawn();
  game.raf = requestAnimationFrame(loop);
}

function drop() {
  if (!game || game.over || !game.moving) return;
  const m = game.moving;
  const top = game.stack[game.stack.length - 1];
  if (Math.abs(m.x - top.x) < 6) { // 對準就吸附，給玩家成就感
    m.x = top.x; game.perfect = 0.7;
    const bk = $('baker'); bk.classList.remove('cheer'); void bk.offsetWidth; bk.classList.add('cheer');
  }
  const left = Math.max(m.x, top.x);
  const right = Math.min(m.x + m.w, top.x + top.w);
  if (right - left <= 0) return endGame();
  game.stack.push({ x: left, w: right - left });
  if (game.stack.length - 1 >= MAX) return endGame();
  spawn();
}

function endGame() {
  game.over = true;
  game.moving = null;
  cancelAnimationFrame(game.raf);
  drawGame();
  const layers = game.stack.length - 1;
  const r = finishGame(state, layers);
  commit();
  const box = $('gameResult');
  const stars = [0, 1, 2].map((i) => `<span class="${i < r.stars ? '' : 'off'}">★</span>`).join('');
  box.innerHTML = `<div class="stars" aria-label="${r.stars} 顆星">${stars}</div><div>疊了 ${layers} 層${r.stars ? '' : '，再接再厲！'}</div><div class="loot"><span class="chip">${ICON.coin}${r.coins}</span>${chips(r.mats)}</div>`;
  box.hidden = false;
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  $('play').disabled = false;
  $('play').textContent = '再玩一次';
}

function renderBaker() {
  const first = Object.keys(state.cats)[0];
  const html = catSVG(getCat(first), 78);
  if ($('baker').dataset.id !== first) { $('baker').innerHTML = html; $('baker').dataset.id = first; }
}

$('play').addEventListener('click', startGame);
cv.addEventListener('pointerdown', (e) => { e.preventDefault(); drop(); });
document.addEventListener('keydown', (e) => { if (e.code === 'Space' && $('tab-game').classList.contains('active')) { e.preventDefault(); drop(); } });

// ---------- 分頁與每日重置 ----------
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b));
  document.querySelectorAll('.tab').forEach((s) => s.classList.toggle('active', s.id === `tab-${b.dataset.tab}`));
}));

function checkDay() { if (ensureDaily(state, todayStr())) { toast('新的一天，每日任務更新了！'); commit(); } }
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDay(); });
setInterval(checkDay, 60000);

renderAll();
drawGame();
document.fonts?.ready.then(() => { if (!game) drawGame(); });
save();
