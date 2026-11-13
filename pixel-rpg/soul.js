// 微光大陸：魂像（守護靈）造型。每隻都有獨特剪影，跟著主人漂浮。
const INK = '#1a1222';
const cache = new Map();
function paint(w, h, fn) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  const parts = [];
  const P = {
    r(px, py, pw, ph, col, round = true) { parts.push([px, py, pw, ph, col, round]); },
    flush() {
      x.fillStyle = INK;
      for (const [a, b, cw, ch, , rd] of parts) { if (rd && cw > 2 && ch > 2) { x.fillRect(a, b - 1, cw, ch + 2); x.fillRect(a - 1, b, cw + 2, ch); } else x.fillRect(a - 1, b - 1, cw + 2, ch + 2); }
      for (const [a, b, cw, ch, col, rd] of parts) { x.fillStyle = col; if (rd && cw > 2 && ch > 2) { x.fillRect(a + 1, b, cw - 2, ch); x.fillRect(a, b + 1, cw, ch - 2); } else x.fillRect(a, b, cw, ch); }
      parts.length = 0;
    },
  };
  const px = (a, b, cw, ch, col) => { x.fillStyle = col; x.fillRect(a, b, cw, ch); };
  fn(P, px);
  return c;
}

// 每隻魂像 24×30，frame 0/1 是漂浮的兩個姿勢
const DRAW = {
  gear: (P, px, f) => { // 齒輪頭的紅色機械人
    const d = f;
    for (const [a, b] of [[10, 0], [3, 7], [17, 7], [10, 14], [5, 2], [15, 2], [5, 12], [15, 12]]) P.r(a, b + d, 4, 3, '#a8321f', false);
    P.r(4, 2 + d, 16, 13, '#e0533d'); P.flush();
    P.r(8, 5 + d, 8, 7, '#ffb35c'); P.flush();
    px(10, 7 + d, 4, 3, '#1a1222'); px(11, 8 + d, 2, 1, '#ffe08a');
    P.r(7, 16 + d, 10, 9, '#c4432f'); P.r(3, 17 + d, 3, 7, '#e0533d'); P.r(18, 17 + d, 3, 7, '#e0533d'); P.flush();
    px(9, 18 + d, 6, 1, '#ffb35c'); px(11, 20 + d, 2, 4, '#ffb35c');
    P.r(9, 25 + d, 6, 4, '#8a2a1c'); P.flush();
  },
  post: (P, px, f) => { // 戴郵差帽、背後很多手的藍色人形
    const d = f;
    for (let i = 0; i < 3; i++) { P.r(1 + i, 12 + i * 4 + d - f * i, 4, 3, '#7fc4ff'); P.r(19 - i, 12 + i * 4 + d + f * i - f, 4, 3, '#7fc4ff'); }
    P.flush();
    P.r(6, 4 + d, 12, 11, '#bfe3ff'); P.flush();
    P.r(4, 1 + d, 16, 5, '#2f6fd1', false); P.r(6, 0 + d, 12, 3, '#2f6fd1'); P.flush();
    px(10, 1 + d, 4, 2, '#fff1a8');
    px(8, 9 + d, 2, 2, '#1a1222'); px(14, 9 + d, 2, 2, '#1a1222'); px(11, 12 + d, 2, 1, '#2f6fd1');
    P.r(7, 16 + d, 10, 10, '#4fa3ff'); P.flush();
    P.r(4, 18 + d, 7, 5, '#fff8e7', false); P.flush(); px(5, 19 + d, 5, 1, '#e0533d');
    P.r(9, 26 + d, 6, 3, '#2f6fd1'); P.flush();
  },
  magnet: (P, px, f) => { // 一紫一粉的磁鐵雙子
    const d = f, e = 1 - f;
    P.r(1, 6 + d, 9, 12, '#b48cff'); P.r(14, 6 + e, 9, 12, '#ff6b8a'); P.flush();
    P.r(1, 18 + d, 3, 6, '#e8e4f0', false); P.r(7, 18 + d, 3, 6, '#e8e4f0', false);
    P.r(14, 18 + e, 3, 6, '#e8e4f0', false); P.r(20, 18 + e, 3, 6, '#e8e4f0', false); P.flush();
    px(3, 10 + d, 2, 2, '#1a1222'); px(6, 10 + d, 2, 2, '#1a1222'); px(16, 10 + e, 2, 2, '#1a1222'); px(19, 10 + e, 2, 2, '#1a1222');
    px(4, 14 + d, 3, 1, '#fff'); px(17, 14 + e, 3, 1, '#fff');
    px(4, 2 + d, 2, 3, '#b48cff'); px(18, 2 + e, 2, 3, '#ff6b8a');
    px(10, 12, 4, 1, '#fff1a8'); px(11, 10, 2, 5, '#fff1a8');
  },
  cat: (P, px, f) => { // 黑貓人形，金色眼睛與長尾巴
    const d = f;
    P.r(18, 14 + d, 3, 12 - f, '#3b3350'); P.r(19, 11 + d + f, 4, 4, '#3b3350'); P.flush();
    P.r(5, 1 + d, 4, 5, '#3b3350', false); P.r(15, 1 + d, 4, 5, '#3b3350', false);
    P.r(4, 4 + d, 16, 12, '#3b3350'); P.flush();
    px(6, 2 + d, 2, 3, '#ff8fb1'); px(16, 2 + d, 2, 3, '#ff8fb1');
    px(7, 8 + d, 3, 3, '#ffe066'); px(14, 8 + d, 3, 3, '#ffe066'); px(8, 8 + d, 1, 3, '#1a1222'); px(15, 8 + d, 1, 3, '#1a1222');
    px(11, 12 + d, 2, 1, '#ff8fb1'); px(2, 11 + d, 4, 1, '#c9c0e6'); px(18, 11 + d, 4, 1, '#c9c0e6');
    P.r(7, 16 + d, 10, 9, '#2a2338'); P.r(4, 17 + d, 3, 6, '#3b3350'); P.r(17, 17 + d, 3, 6, '#3b3350'); P.flush();
    px(9, 17 + d, 6, 2, '#d64550'); px(11, 19 + d, 2, 2, '#ffe066');
    P.r(8, 25 + d, 3, 4, '#3b3350'); P.r(13, 25 + d, 3, 4, '#3b3350'); P.flush();
  },
};
export const SW = 24, SH = 30;
export function soulSprite(id, frame = 0) {
  const key = `${id}|${frame}`;
  if (!cache.has(key)) cache.set(key, paint(SW, SH, (P, px) => (DRAW[id] || DRAW.gear)(P, px, frame)));
  return cache.get(key);
}
export function soulBig(id, scale = 8) {
  const src = soulSprite(id, 0);
  const c = document.createElement('canvas'); c.width = SW * scale; c.height = SH * scale;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(src, 0, 0, c.width, c.height); return c;
}
