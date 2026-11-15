// 暫用的逐格像素小人：在正式美術（assets/sprite/...）交件前，用程式照 spritesheet.js 的格式逐格畫出來。
// 每一格都是重新擺的姿勢（不是把同一張圖拉伸），腳底固定在腳底線、五官每格同一個位置。
import { layout, DRAWN, ramp } from './spritesheet.js';

const INK = '#2a1d2e', SKIN = ['#ffe3cc', '#f7c9a3', '#e0a47c', '#b97a58'], EYE = '#3b2a4a', WHITE = '#ffffff';

function frameBuf(w, h) {
  const px = new Array(w * h).fill(null);
  const set = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < w && y < h && c) px[y * w + x] = c; };
  const rect = (x, y, rw, rh, c) => { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) set(x + i, y + j, c); };
  const ell = (cx, cy, rx, ry, c, top = -1, bot = 1) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1 && (y + 0.5 - cy) / ry >= top && (y + 0.5 - cy) / ry <= bot) set(x, y, c);
    }
  };
  // 粗線（四肢、武器）：沿線畫小方塊
  const line = (x0, y0, x1, y1, t, c) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0))); for (let k = 0; k <= n; k++) rect(Math.round(x0 + (x1 - x0) * k / n - t / 2), Math.round(y0 + (y1 - y0) * k / n - t / 2), t, t, c); };
  const get = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? null : px[y * w + x]);
  return { px, set, rect, ell, line, get, w, h };
}
function outline(b) {
  const add = [];
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (!b.get(x, y) && (b.get(x - 1, y) || b.get(x + 1, y) || b.get(x, y - 1) || b.get(x, y + 1))) add.push([x, y]);
  for (const [x, y] of add) b.set(x, y, INK);
}
// 四肢：上色時左亮右暗，看起來有體積
function limb(b, x0, y0, x1, y1, t, R) { b.line(x0, y0, x1, y1, t, R[1]); b.line(x0 - t / 2 + 1, y0, x1 - t / 2 + 1, y1, 1, R[0]); b.line(x0 + t / 2 - 1, y0, x1 + t / 2 - 1, y1, 1, R[2]); }

// 一格的姿勢
function pose(anim, i, n, cls) {
  const P = { bob: 0, legA: 0, legB: 0, liftA: 0, liftB: 0, armA: 0, armB: 0, reach: 0, raise: 0, lean: 0, eyes: 'open', low: 0, lie: 0, wpn: 0 };
  if (anim === 'idle') { P.bob = i === 1 || i === 2 ? 1 : 0; P.armA = P.armB = i === 2 ? 0.1 : 0; P.eyes = i === 3 ? 'blink' : 'open'; }
  if (anim === 'walk') {
    const ph = (i / n) * Math.PI * 2, s = Math.sin(ph);
    P.legA = s; P.legB = -s; P.liftA = Math.max(0, Math.cos(ph)) * 2; P.liftB = Math.max(0, -Math.cos(ph)) * 2;
    P.armA = -s * 0.8; P.armB = s * 0.8; P.bob = Math.abs(Math.cos(ph)) > 0.7 ? 0 : 1;
  }
  if (anim === 'attack') {
    const k = [0, 0.4, 1, 1, 0.6, 0.2][i];
    P.reach = k; P.lean = [0, -1, 2, 2, 1, 0][i]; P.legA = [0, -0.3, 0.6, 0.6, 0.4, 0][i]; P.legB = -P.legA * 0.6; P.wpn = [-0.6, -1, 1, 1.1, 0.7, 0.2][i];
    if (cls === 'archer') { P.reach = [0.3, 0.8, 1, 1, 0.9, 0.4][i]; P.lean = 0; P.wpn = 0; }
  }
  if (anim === 'cast') { P.raise = [0.3, 1, 1, 0.4][i]; P.reach = [0, 0.2, 0.8, 0.2][i]; P.eyes = i === 2 ? 'shut' : 'open'; }
  if (anim === 'hurt') { P.lean = -2; P.bob = 1; P.eyes = 'shut'; P.armA = 0.5; P.armB = -0.5; }
  if (anim === 'down') { P.low = [8, 16, 0][i]; P.lie = i === 2 ? 1 : 0; P.eyes = 'shut'; P.lean = i === 1 ? -3 : 0; }
  if (anim === 'sit') { P.low = 10; P.legA = 0.6; P.legB = 0.6; }
  return P;
}

// look：{ cls, hair, outfit:{main,trim}, weapon, cap }  dir：s sw w nw n
function drawChar(b, look, dir, P) {
  const O = ramp(look.outfit.main), T2 = ramp(look.outfit.trim), H = ramp(look.hair), cx = 32, foot = 90;
  const side = { s: 0, sw: 0.55, w: 1, nw: 0.55, n: 0 }[dir], back = dir === 'n' || dir === 'nw';
  const sx = -1; // 面向左
  if (P.lie) { // 躺平：橫著畫
    b.ell(cx, foot - 6, 22, 6, O[1]); b.ell(cx - 22, foot - 9, 10, 9, SKIN[1]); b.ell(cx - 24, foot - 13, 10, 6, H[1], -1, 0.2);
    b.line(cx + 6, foot - 2, cx + 24, foot - 2, 5, O[2]); outline(b); return;
  }
  const y0 = foot - 80 + P.bob + P.low, lean = P.lean * (side ? 1 : 0.4);
  const hipY = y0 + 58, shY = y0 + 38, headY = y0 + 19;
  const PANTS = ramp('#4b3f5c');
  const legLen = Math.max(8, foot - hipY - 1);
  // 腳
  const legs = [[P.legA, P.liftA, -1], [P.legB, P.liftB, 1]];
  for (const [sw, lift, s] of legs) {
    const hx = cx + s * (4 - 2 * side) + lean * 0.3, fx = hx + sx * sw * 7 * Math.max(side, 0.25), fy = foot - lift - (P.low > 8 ? 0 : 0);
    const knee = P.low >= 10 ? [hx + sx * 7, hipY + 6] : [(hx + fx) / 2, (hipY + fy) / 2];
    limb(b, hx, hipY, knee[0], knee[1], 6, PANTS);
    limb(b, knee[0], knee[1], fx, fy - 3, 6, PANTS);
    b.rect(Math.round(fx - 3 + (side ? sx * 1 : 0)), Math.round(fy - 4), 7, 4, '#5e3a20'); b.rect(Math.round(fx - 3), Math.round(fy - 4), 7, 1, '#8a5a34');
  }
  // 遠側手臂（被身體擋住的那隻）
  const arm = (s, swing, isWeapon) => {
    const ax = cx + s * (12 - 6 * side) + lean;
    let hx = ax + sx * swing * 5 * Math.max(side, 0.3), hy = shY + 13;
    if (isWeapon && P.reach) { hx = ax + (side ? sx * 12 * P.reach : 3 * P.reach * s); hy = shY + 14 - 8 * P.reach * (side ? 0.6 : 1); }
    if (isWeapon && P.raise) { hx = ax + (side ? sx * 4 : 2 * s); hy = shY - 8 * P.raise; }
    limb(b, ax, shY + 2, hx, hy, 5, [O[1], O[2], O[3], O[3]]);
    b.rect(Math.round(hx - 2), Math.round(hy - 1), 5, 4, SKIN[1]); b.set(Math.round(hx - 2), Math.round(hy - 1), SKIN[0]);
    return [hx, hy];
  };
  const far = side ? 1 : -1;
  if (side) arm(far, P.armB, false);
  // 身體
  const tw = 18 - 6 * side;
  b.rect(Math.round(cx - tw / 2 + lean), shY, tw, hipY - shY + 2, O[1]);
  b.rect(Math.round(cx - tw / 2 + lean), shY, 2, hipY - shY + 2, O[0]);
  b.rect(Math.round(cx + tw / 2 - 3 + lean), shY, 3, hipY - shY + 2, O[2]);
  b.rect(Math.round(cx - tw / 2 + lean), hipY - 4, tw, 3, T2[1]); // 腰帶
  b.rect(Math.round(cx - tw / 2 - 1 + lean), hipY - 1, tw + 2, 5, O[2]); // 衣擺
  if (!back) { b.rect(Math.round(cx - 2 + lean - side * 4), shY, 4, 6, T2[0]); }
  // 頭
  const hx = cx + lean - side * 2, hy = headY;
  b.rect(Math.round(hx - 3), hy + 10, 6, shY - hy - 8, SKIN[2]);
  b.ell(hx, hy, 14 - 2 * side, 14, SKIN[1]);
  b.ell(hx - 3, hy - 3, 8, 7, SKIN[0], -1, 0.4);
  if (!back) {
    // 五官：眼睛 4×5，瞳孔＋高光＋上眼線
    const eyes = side >= 0.9 ? [hx - 8] : side ? [hx - 10, hx + 1] : [hx - 8, hx + 4];
    for (const ex of eyes) {
      if (P.eyes === 'shut' || P.eyes === 'blink') { b.rect(ex, hy + 3, 4, 1, EYE); continue; }
      b.rect(ex, hy, 4, 5, EYE); b.rect(ex, hy + 3, 4, 2, '#6b4fb0'); b.set(ex + 1, hy + 1, WHITE); b.set(ex + 2, hy + 1, WHITE); b.rect(ex - 1, hy - 1, 6, 1, INK);
    }
    b.rect(hx - (side ? 6 : 1) - (side >= 0.9 ? 2 : 0), hy + 8, 3, 1, '#b05a5a');
    b.set(eyes[0] - 1, hy + 6, '#f2a0a0'); if (eyes[1] !== undefined) b.set(eyes[1] + 4, hy + 6, '#f2a0a0');
  }
  // 頭髮
  if (back) { b.ell(hx, hy - 1, 15 - 2 * side, 14, H[1], -1, 0.75); b.ell(hx - 4, hy - 7, 7, 4, H[0]); for (let k = -3; k <= 3; k++) b.rect(Math.round(hx + k * 4 - 1 + side * 2), hy + 6, 3, 5 + (k % 2 ? 2 : 0), H[k % 2 ? 2 : 1]); if (side) b.ell(hx - 11, hy + 2, 3, 5, SKIN[1]); }
  else {
    b.ell(hx, hy - 4, 15 - 2 * side, 11, H[1], -1, 0.15);
    b.ell(hx - 4, hy - 9, 7, 4, H[0]);
    for (let k = -2; k <= 2; k++) b.rect(Math.round(hx + k * 5 - 2 - side * 2), hy - 4, 4, 3 + ((k + 3) % 2) * 2, H[1]); // 瀏海
    if (side) b.ell(hx + 9, hy + 1, 6, 11, H[2]); else { b.rect(hx - 15, hy - 2, 4, 12, H[2]); b.rect(hx + 11, hy - 2, 4, 12, H[2]); }
  }
  // 頭飾（職業特徵）
  const cap = look.cap;
  if (cap === 'hat') { b.ell(hx, hy - 9, 18, 4, T2[2]); for (let k = 0; k < 14; k++) b.rect(Math.round(hx - 9 + k * 0.6 + side * 3), hy - 11 - k, Math.max(2, 18 - k * 1.3), 1, k % 5 === 0 ? T2[1] : O[1]); }
  if (cap === 'hood') { b.ell(hx + side * 2, hy - 2, 16 - side, 15, O[2], -1, back ? 1 : -0.05); if (!back) b.rect(Math.round(hx - 14), hy - 3, 28 - side * 6, 2, T2[1]); }
  if (cap === 'band') b.rect(Math.round(hx - 14 + side * 3), hy - 7, 28 - side * 6, 3, T2[1]);
  // 近側手臂與武器
  const [wx, wy] = arm(side ? -1 : 1, P.armA, true);
  if (!side) arm(-1, P.armB, false);
  drawWeapon(b, look.weapon, wx, wy, side, P, T2, back);
  outline(b);
}
function drawWeapon(b, w, x, y, side, P, T2, back) {
  const metal = ['#e8eef8', '#b8c4d6', '#7a8499'], wood = ['#c98b55', '#8a5a34', '#5e3a20'];
  const dir = side ? -1 : 1, swing = P.wpn;
  if (w === 'sword') { const a = (side ? Math.PI : 0) + (side ? -1 : 1) * (-1.2 + swing * 1.3); const ex = x + Math.cos(a) * 18, ey = y + Math.sin(a) * 18 - 6; b.line(x, y, ex, ey, 3, metal[1]); b.line(x, y, ex, ey, 1, metal[0]); b.rect(Math.round(x - 3), Math.round(y - 1), 6, 2, T2[1]); }
  if (w === 'dagger') { for (const off of [0, side ? 6 : -10]) { const a = (side ? Math.PI : 0) + (side ? -1 : 1) * (-0.6 + swing); b.line(x + off, y, x + off + Math.cos(a) * 9, y + Math.sin(a) * 9 - 2, 2, metal[1]); } }
  if (w === 'staff') { const top = P.raise ? -26 : -22; b.line(x, y + 10, x + dir * 2, y + top, 3, wood[1]); b.ell(x + dir * 2, y + top - 2, 3, 3, T2[0]); }
  if (w === 'bow') { const bx = x + (side ? -3 : 3); for (let k = -12; k <= 12; k++) b.rect(Math.round(bx + (side ? -1 : 1) * (6 - (k * k) / 26)), Math.round(y + k - 2), 2, 1, wood[1]); b.line(bx, y - 14, bx - (side ? -1 : 1) * 4 * P.reach, y - 2, 1, '#f3f0ff'); b.line(bx - (side ? -1 : 1) * 4 * P.reach, y - 2, bx, y + 10, 1, '#f3f0ff'); }
  if (w === 'fist') b.rect(Math.round(x - 3), Math.round(y - 2), 7, 6, T2[1]);
  if (w === 'mace') { b.line(x, y + 8, x + dir * 2, y - 16, 3, wood[1]); b.ell(x + dir * 2, y - 18, 4, 4, T2[0]); }
}

// 產生整張圖（canvas）：layout 決定格子排列
export function genSheet(kind, look) {
  const L = layout(kind), [cw, ch] = L.cell;
  const c = document.createElement('canvas'); c.width = L.w; c.height = L.h;
  const g = c.getContext('2d');
  DRAWN.forEach((dir, row) => {
    for (const [anim, a] of Object.entries(L.anims)) for (let i = 0; i < a.n; i++) {
      const b = frameBuf(cw, ch);
      drawChar(b, look, dir, pose(anim, i, a.n, look.cls));
      const img = g.createImageData(cw, ch);
      b.px.forEach((col, k) => { if (!col) return; const n = parseInt(col.slice(1), 16); img.data.set([(n >> 16) & 255, (n >> 8) & 255, n & 255, 255], k * 4); });
      g.putImageData(img, (L.col[anim] + i) * cw, row * ch);
    }
  });
  return c;
}
// 依職業資料組出外觀
export const heroLookFor = (cls, C) => ({ cls, hair: C.hair, outfit: { main: C.outfit.main, trim: C.outfit.trim }, weapon: { sword: 'sword', archer: 'bow', mage: 'staff', priest: 'mace', monk: 'fist', scout: 'dagger' }[cls], cap: { mage: 'hat', archer: 'hood', scout: 'hood', priest: 'band', monk: 'band' }[cls] });
export const npcLookFor = (n) => ({ cls: 'npc', hair: n.look?.hair || '#6b3e26', outfit: { main: n.look?.tunic || '#a0693a', trim: n.look?.band || '#e8d29a' }, weapon: null, cap: null });
