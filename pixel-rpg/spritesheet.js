// 逐格像素動畫的共用格式（遊戲、暫用圖產生器、交件檢查工具都讀這一份）
// 一張圖 = 5 列（畫好的方向）× N 欄（所有動作的格子接在一起）。東邊三個方向由程式左右鏡像。
// 1 個原生像素 = 0.5 個遊戲像素，畫面上一律整數倍放大，像素不會糊、不會忽胖忽瘦。

export const DIR8 = ['s', 'sw', 'w', 'nw', 'n', 'ne', 'e', 'se'];
export const DRAWN = ['s', 'sw', 'w', 'nw', 'n']; // 只畫這 5 個方向（面向左邊的那一半）
export const MIRROR = { se: 'sw', e: 'w', ne: 'nw' };
export const DIR_NAME = { s: '正面', sw: '左前', w: '左側', nw: '左後', n: '背面' };
// 方向 → 單位向量（遊戲格子座標，y 向下）
export const DIR_VEC = { s: [0, 1], sw: [-1, 1], w: [-1, 0], nw: [-1, -1], n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1] };
export const dirOf = (dx, dy) => {
  if (!dx && !dy) return null;
  const a = Math.atan2(dy, dx), k = Math.round(a / (Math.PI / 4));
  return { 0: 'e', 1: 'se', 2: 's', 3: 'sw', 4: 'w', '-4': 'w', '-3': 'nw', '-2': 'n', '-1': 'ne' }[k];
};

// 各類角色的格子尺寸、腳底位置與動作
// fps：動作的播放速度；walk 不看 fps，改成「走 2 格剛好播完 8 格」，腳步和位移同步，不會滑步
const A = (n, fps, loop = true, hit) => ({ n, fps, loop, hit });
export const KINDS = {
  hero: { cell: [64, 96], foot: 90, height: 80, anims: { idle: A(4, 4), walk: A(8, 0), attack: A(6, 18, false, 3), cast: A(4, 10, false, 2), hurt: A(2, 10, false), down: A(3, 6, false), sit: A(1, 1) } },
  npc: { cell: [64, 96], foot: 90, height: 80, anims: { idle: A(4, 4), walk: A(8, 0) } },
  monS: { cell: [64, 64], foot: 60, height: 40, anims: { idle: A(4, 5), walk: A(6, 0), attack: A(6, 16, false, 3), hurt: A(2, 10, false), die: A(4, 8, false) } },
  monM: { cell: [96, 96], foot: 92, height: 64, anims: { idle: A(4, 5), walk: A(6, 0), attack: A(6, 14, false, 3), hurt: A(2, 10, false), die: A(4, 8, false) } },
  monL: { cell: [128, 128], foot: 124, height: 96, anims: { idle: A(4, 4), walk: A(6, 0), attack: A(6, 12, false, 3), hurt: A(2, 10, false), die: A(4, 8, false) } },
  boss: { cell: [192, 192], foot: 186, height: 150, anims: { idle: A(4, 4), walk: A(6, 0), attack: A(8, 12, false, 5), cast: A(6, 10, false, 3), hurt: A(2, 10, false), die: A(6, 8, false) } },
};
// 每個動作從第幾欄開始
export function layout(kind) {
  const K = KINDS[kind], col = {};
  let c = 0;
  for (const [k, a] of Object.entries(K.anims)) { col[k] = c; c += a.n; }
  return { ...K, col, cols: c, w: c * K.cell[0], h: DRAWN.length * K.cell[1] };
}
export const monKind = (m) => (m.boss ? 'boss' : m.size === '大型' ? 'monL' : m.size === '中型' ? 'monM' : 'monS');
export const sheetPath = (kind, id) => (kind === 'hero' ? `sprite/hero/${id}` : kind === 'npc' ? `sprite/npc/${id}` : `sprite/mon/${id}`);

// ---- 換色（調色盤交換）----
// 一個職業只畫一張「普通」裝備的圖；優良～傳說由程式把衣服、配色那幾個顏色換掉。
// 交件時衣服只能用下面這幾階顏色（每階一個色碼，不要混其他相近色），程式才換得到。
export function ramp(hex) { // 亮部、本色、暗部、最暗
  const n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const f = (k) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))))).map((v) => v.toString(16).padStart(2, '0')).join('');
  return [f(0.35), f(0), f(-0.3), f(-0.55)];
}
export const TIER_OUTFIT = [null, { main: '#a0693a', trim: '#e8d29a' }, { main: '#a9bad6', trim: '#4fb3ff' }, { main: '#7445b0', trim: '#fff1a8' }, { main: '#f4c542', trim: '#d64550' }];
export function paletteOf(cls, outfit, tier) {
  const t = TIER_OUTFIT[tier];
  const from = [...ramp(outfit.main), ...ramp(outfit.trim)];
  if (!t) return null;
  const to = [...ramp(t.main), ...ramp(t.trim)];
  return Object.fromEntries(from.map((c, i) => [c, to[i]]));
}
