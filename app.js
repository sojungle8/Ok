import { QUESTIONS, RESULTS, score, encodeResult, decodeResult } from './logic.js';

const $ = (id) => document.getElementById(id);
let answers = [];
let current = null;
let locked = false; // 防止連點跨題

function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  window.scrollTo(0, 0);
}

function renderQuestion() {
  const i = answers.length;
  const q = QUESTIONS[i];
  $('bar').style.width = `${(i / QUESTIONS.length) * 100}%`;
  $('count').textContent = `${i + 1} / ${QUESTIONS.length}`;
  $('question').textContent = q.q;
  const box = $('options');
  box.replaceChildren();
  q.a.forEach(([label], idx) => {
    const b = document.createElement('button');
    b.className = 'opt';
    b.textContent = label;
    b.addEventListener('click', () => pick(idx), { once: true });
    box.appendChild(b);
  });
}

function pick(idx) {
  if (locked || answers.length >= QUESTIONS.length) return;
  locked = true;
  setTimeout(() => { locked = false; }, 350);
  answers.push(idx);
  if (answers.length < QUESTIONS.length) renderQuestion();
  else finish();
}

function finish() {
  current = score(answers);
  history.replaceState(null, '', `#${encodeResult(current.key)}`);
  drawCard(current.key, current.sub);
  show('result');
}

function wrap(ctx, text, x, y, maxW, lh) {
  let line = '';
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxW) { ctx.fillText(line, x, y); line = ch; y += lh; }
    else line += ch;
  }
  ctx.fillText(line, x, y);
}

function drawCard(key, sub) {
  const r = RESULTS[key];
  const m = RESULTS[r.match];
  const c = $('card');
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, c.height);
  g.addColorStop(0, '#ffb199'); g.addColorStop(1, '#ff7a59');
  ctx.fillStyle = g; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  const font = '"PingFang TC","Noto Sans TC",system-ui,sans-serif';
  ctx.font = `bold 48px ${font}`; ctx.fillText('我的靈魂動物是', 540, 150);
  ctx.font = `260px ${font}`; ctx.fillText(r.emoji, 540, 470);
  ctx.font = `bold 96px ${font}`; ctx.fillText(r.name, 540, 640);
  ctx.font = `40px ${font}`; ctx.fillText(`#${sub}`, 540, 710);
  ctx.font = `42px ${font}`; wrap(ctx, r.desc, 540, 820, 880, 62);
  ctx.font = `bold 44px ${font}`; ctx.fillText(`最速配：${m.emoji} ${m.name}`, 540, 1110);
  ctx.font = `34px ${font}`; ctx.globalAlpha = 0.85;
  ctx.fillText('你是什麼動物？來測測 👉', 540, 1260);
  ctx.globalAlpha = 1;
}

function toast(msg) { $('toast').textContent = msg; setTimeout(() => { $('toast').textContent = ''; }, 2500); }

function shareUrl() { return `${location.origin}${location.pathname}#${encodeResult(current.key)}`; }

async function share() {
  const r = RESULTS[current.key];
  const text = `我是「${r.emoji} ${r.name}」！你是什麼動物？`;
  const url = shareUrl();
  try {
    if (navigator.share) {
      const blob = await new Promise((res) => $('card').toBlob(res, 'image/png'));
      const file = blob && new File([blob], 'soul-animal.png', { type: 'image/png' });
      const data = file && navigator.canShare?.({ files: [file] }) ? { text, url, files: [file] } : { text, url };
      await navigator.share(data);
      return;
    }
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast('連結已複製，快貼給朋友！');
  } catch (e) {
    if (e?.name !== 'AbortError') toast('分享失敗，請改用下載結果圖');
  }
}

function save() {
  const a = document.createElement('a');
  a.href = $('card').toDataURL('image/png');
  a.download = `靈魂動物-${RESULTS[current.key].name}.png`;
  a.click();
}

function start() { answers = []; locked = false; renderQuestion(); show('quiz'); }

// 從朋友分享的連結進來：顯示朋友結果，引導自己測（病毒迴圈）
const friendKey = decodeResult(location.hash);
if (friendKey) {
  const f = RESULTS[friendKey];
  const el = $('friend');
  el.textContent = `你的朋友是「${f.emoji} ${f.name}」，你們合得來嗎？`;
  el.hidden = false;
  $('start').textContent = '測測我的，看速不速配';
}

$('start').addEventListener('click', start);
$('again').addEventListener('click', () => { history.replaceState(null, '', location.pathname); start(); });
$('share').addEventListener('click', share);
$('save').addEventListener('click', save);
