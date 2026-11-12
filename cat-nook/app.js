import {
  MATERIALS, MATERIAL_PRICE, RARITY, CATS, FURNITURE, PITY_LIMIT, DAILY_PET_COOKIES,
  todayStr, newState, loadState, ensureDaily, summon, finishGame, missingFor,
  buyBlueprint, craft, buyMaterial, pet, feed, heartLevel, claimQuest, comfort, getCat, getFurniture,
} from './logic.js';

const KEY = 'meow-nook-v1';
const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

let state;
try { state = loadState(localStorage.getItem(KEY), todayStr()); } catch { state = newState(todayStr()); }
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 無痕模式等情況下不儲存 */ } }

// ---------- 原創貓咪頭像（SVG）----------
function catSVG(c, size = 72) {
  const pat = {
    stripes: `<path d="M42 30 l2 9 M50 28 v10 M58 30 l-2 9" stroke="${c.accent}" stroke-width="4" stroke-linecap="round"/>`,
    patch: `<ellipse cx="66" cy="50" rx="15" ry="13" fill="${c.accent}"/>`,
    spots: `<circle cx="30" cy="68" r="5" fill="${c.accent}"/><circle cx="72" cy="40" r="4" fill="${c.accent}"/><circle cx="68" cy="74" r="3" fill="${c.accent}"/>`,
    none: '',
  }[c.pattern];
  const eye = c.color === '#3b3330' || c.color === '#3a3f8f' ? '#ffe9a8' : '#2b2118';
  const crown = c.rarity === 'legendary' ? '<path d="M38 14 l6 8 6-10 6 10 6-8 -2 12 h-20z" fill="#f2b632"/>' : '';
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">
    <path d="M16 46 L20 12 L44 30 Z M84 46 L80 12 L56 30 Z" fill="${c.color}" stroke="${c.accent}" stroke-width="2"/>
    <path d="M22 36 L24 20 L36 30 Z M78 36 L76 20 L64 30 Z" fill="#ffb3c1"/>
    <ellipse cx="50" cy="58" rx="40" ry="34" fill="${c.color}" stroke="${c.accent}" stroke-width="2"/>
    ${pat}${crown}
    <circle cx="36" cy="56" r="4.5" fill="${eye}"/><circle cx="64" cy="56" r="4.5" fill="${eye}"/>
    <ellipse cx="27" cy="67" rx="6" ry="3.5" fill="#ff9eb5" opacity=".6"/><ellipse cx="73" cy="67" rx="6" ry="3.5" fill="#ff9eb5" opacity=".6"/>
    <path d="M44 65 Q50 71 50 65 Q50 71 56 65" fill="none" stroke="${eye}" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}

// ---------- 共用 ----------
let toastTimer;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
const matText = (obj) => Object.entries(obj).map(([k, n]) => `${MATERIALS[k].emoji}${MATERIALS[k].name}×${n}`).join('、');

function renderHud() {
  $('coins').textContent = state.coins;
  $('cookies').textContent = state.cookies;
  $('mats').innerHTML = Object.entries(MATERIALS).map(([k, m]) => `<span title="${m.name}">${m.emoji}${state.materials[k]}</span>`).join('');
  $('questDot').hidden = !state.daily.quests.some((q) => !q.claimed && q.progress >= q.goal);
}

function renderAll() { renderHud(); renderRoom(); renderCats(); renderShop(); renderQuests(); }
function commit() { save(); renderAll(); }

// ---------- 小窩 ----------
function renderRoom() {
  $('comfort').textContent = comfort(state);
  const floor = $('floor');
  floor.replaceChildren(...state.furniture.map((id) => { const f = getFurniture(id); const s = el('span', null, f.emoji); s.title = f.name; return s; }));
  const room = $('room');
  const owned = Object.keys(state.cats);
  room.querySelectorAll('.cat').forEach((n) => { if (!owned.includes(n.dataset.id)) n.remove(); });
  owned.slice(0, 8).forEach((id) => {
    if (room.querySelector(`.cat[data-id="${id}"]`)) return;
    const n = el('div', 'cat', catSVG(getCat(id), 64));
    n.dataset.id = id;
    n.setAttribute('role', 'button');
    n.setAttribute('aria-label', `摸摸${getCat(id).name}`);
    n.style.left = `${10 + Math.random() * 70}%`;
    n.style.top = `${42 + Math.random() * 38}%`;
    n.addEventListener('click', (e) => onPet(id, e));
    room.appendChild(n);
  });
}

function wander() {
  document.querySelectorAll('#room .cat').forEach((n) => {
    if (Math.random() < 0.5) { n.style.left = `${5 + Math.random() * 75}%`; n.style.top = `${40 + Math.random() * 40}%`; }
  });
}
setInterval(wander, 4000);

function onPet(id, e) {
  const r = pet(state, id);
  if (!r.ok) return;
  const room = $('room');
  const rect = room.getBoundingClientRect();
  const h = el('span', 'heart', r.cookie ? '💗🍪' : '💗');
  h.style.left = `${e.clientX - rect.left - 10}px`;
  h.style.top = `${e.clientY - rect.top - 20}px`;
  room.appendChild(h);
  setTimeout(() => h.remove(), 900);
  if (!r.cookie && state.daily.petCookies === DAILY_PET_COOKIES) toast('今天的摸摸餅乾領完了，明天再來～');
  save(); renderHud(); renderQuests();
}

// ---------- 貓咪 ----------
function renderCats() {
  $('pity').textContent = state.pity;
  $('summon').disabled = false;
  const grid = $('catGrid');
  grid.replaceChildren(...CATS.map((c) => {
    const own = state.cats[c.id];
    const card = el('div', `catcard ${c.rarity}${own ? '' : ' locked'}`);
    if (!own) { card.innerHTML = `<div style="filter:brightness(0) opacity(.25)">${catSVG(c)}</div><b>？？？</b><span class="muted">${RARITY[c.rarity].label}</span>`; return card; }
    const lv = heartLevel(own.affection);
    card.innerHTML = `${catSVG(c)}<b>${c.name}</b><span class="muted">${RARITY[c.rarity].label}</span><div class="hearts">${'♥'.repeat(lv)}${'♡'.repeat(5 - lv)}</div>`;
    const b = el('button', 'btn sm ghost', '餵 🍪');
    b.addEventListener('click', () => {
      const r = feed(state, c.id);
      toast(r.ok ? `${c.name} 吃得好開心！好感度 +5` : r.reason);
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
  $('revealBody').innerHTML = `${catSVG(r.cat, 140)}<h2>${r.cat.name}</h2><p class="muted">${RARITY[r.cat.rarity].label}${r.isNew ? '・新貓咪！' : `・重複了，換成 ${r.bonus} 塊餅乾 🍪`}</p>`;
  $('reveal').showModal();
});
$('revealOk').addEventListener('click', () => $('reveal').close());

// ---------- 工坊 ----------
function renderShop() {
  const ms = $('matShop');
  ms.replaceChildren(...Object.entries(MATERIALS).map(([k, m]) => {
    const b = el('button', 'matbtn', `${m.emoji} 買${m.name}<br><span class="muted">🪙 ${MATERIAL_PRICE}・持有 ${state.materials[k]}</span>`);
    b.addEventListener('click', () => { const r = buyMaterial(state, k); if (!r.ok) toast(r.reason); commit(); });
    return b;
  }));
  const list = $('bpList');
  list.replaceChildren(...FURNITURE.map((f) => {
    const card = el('div', 'card bp');
    const owned = state.blueprints.includes(f.id);
    const miss = missingFor(state, f.id);
    const needs = Object.entries(f.recipe).map(([k, n]) =>
      `<span class="need${miss[k] ? ' lack' : ''}">${MATERIALS[k].emoji}${MATERIALS[k].name} ${state.materials[k]}/${n}</span>`).join('');
    const status = Object.keys(miss).length ? `<span class="muted small">還缺 ${matText(miss)}</span>` : '<span class="ok">✓ 材料足夠</span>';
    const made = state.furniture.filter((x) => x === f.id).length;
    card.innerHTML = `<div class="ico">${f.emoji}</div><div class="info"><b>${f.name}</b> <span class="muted small">舒適度 +${f.comfort}${made ? `・已擁有 ${made}` : ''}</span><br>${needs}<br>${status}</div>`;
    const b = owned ? el('button', 'btn sm', '製作') : el('button', 'btn sm ghost', `藍圖 🪙${f.price}`);
    if (owned && Object.keys(miss).length) b.disabled = true;
    b.addEventListener('click', () => {
      const r = owned ? craft(state, f.id) : buyBlueprint(state, f.id);
      toast(r.ok ? (owned ? `${f.name} 做好了，已放進小窩！` : `買到 ${f.name} 藍圖`) : r.reason);
      commit();
    });
    card.appendChild(b);
    return card;
  }));
}

// ---------- 任務 ----------
function renderQuests() {
  $('questList').replaceChildren(...state.daily.quests.map((q, i) => {
    const card = el('div', 'card');
    const done = q.progress >= q.goal;
    card.innerHTML = `<b>${q.text}</b> <span class="muted small">${q.progress}/${q.goal}</span><div class="bar"><i style="width:${(q.progress / q.goal) * 100}%"></i></div><span class="muted small">獎勵：🪙60 + 隨機材料×2</span> `;
    const b = el('button', 'btn sm', q.claimed ? '已領取' : done ? '領取' : '進行中');
    b.disabled = q.claimed || !done;
    b.addEventListener('click', () => {
      const r = claimQuest(state, i);
      if (r.ok) toast(`獲得 🪙${r.coins}、${matText(r.mats)}`);
      commit();
    });
    card.appendChild(b);
    return card;
  }));
  renderHud();
}

// ---------- 疊疊蛋糕小遊戲 ----------
const cv = $('stack');
const ctx = cv.getContext('2d');
const H = 34, MAX = 10;
const COLORS = ['#ffd6e0', '#fff0b3', '#c9f0d6', '#d6e6ff', '#f5d0ff', '#ffe0c2'];
let game = null;

function drawGame() {
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = '#c99b74';
  ctx.fillRect(40, cv.height - 16, cv.width - 80, 10); // 盤子
  if (!game) {
    ctx.fillStyle = '#8d7b6f'; ctx.font = '18px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('按「開始遊戲」來疊蛋糕吧！', cv.width / 2, cv.height / 2);
    return;
  }
  const blocks = [...game.stack, ...(game.moving ? [game.moving] : [])];
  blocks.forEach((b, i) => {
    const y = cv.height - 16 - (i + 1) * H;
    ctx.fillStyle = COLORS[i % COLORS.length];
    ctx.strokeStyle = '#d9a37e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(b.x, y, b.w, H - 3, 8); ctx.fill(); ctx.stroke();
  });
  ctx.fillStyle = '#3a2d25'; ctx.font = 'bold 20px system-ui'; ctx.textAlign = 'left';
  ctx.fillText(`${game.stack.length - 1} / ${MAX} 層`, 12, 28);
  if (game.perfect > 0) { ctx.fillStyle = '#ff8a5c'; ctx.fillText('完美！', cv.width - 80, 28); }
}

function spawn() {
  const top = game.stack[game.stack.length - 1];
  const fromLeft = game.stack.length % 2 === 0;
  // 從畫面邊緣（可見處）出發，避免一開局還沒看到就點了直接輸
  game.moving = { x: fromLeft ? 0 : cv.width - top.w, w: top.w, dir: fromLeft ? 1 : -1 };
  game.speed = 140 + game.stack.length * 18;
}

function loop(t) {
  if (!game || game.over) return;
  const dt = Math.min(0.05, (t - (game.last || t)) / 1000);
  game.last = t;
  const m = game.moving;
  m.x += m.dir * game.speed * dt;
  if (m.x + m.w > cv.width) { m.x = cv.width - m.w; m.dir = -1; }
  if (m.x < 0) { m.x = 0; m.dir = 1; }
  if (game.perfect > 0) game.perfect -= dt;
  drawGame();
  game.raf = requestAnimationFrame(loop);
}

function startGame() {
  if (game && !game.over) return;
  game = { stack: [{ x: 80, w: 200 }], moving: null, over: false, perfect: 0 };
  $('gameResult').hidden = true;
  $('play').disabled = true;
  spawn();
  game.raf = requestAnimationFrame(loop);
}

function drop() {
  if (!game || game.over || !game.moving) return;
  const m = game.moving;
  const top = game.stack[game.stack.length - 1];
  if (Math.abs(m.x - top.x) < 6) { m.x = top.x; game.perfect = 0.6; } // 對準就吸附，給玩家成就感
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
  box.innerHTML = `<h3>${'⭐'.repeat(r.stars) || '再接再厲！'}</h3><p>疊了 ${layers} 層<br>獲得 🪙${r.coins}<br>${matText(r.mats)}</p>`;
  box.hidden = false;
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  $('play').disabled = false;
  $('play').textContent = '再玩一次';
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
save();
