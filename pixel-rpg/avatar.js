// 微光大陸：紙娃娃角色（24×32）。身體、頭髮、衣服、披風、頭盔、武器分層畫，換裝備外觀就跟著變。
export const AW = 24, AH = 32;
const INK = '#241a2b';
const SKIN = '#f7c9a3', SKIN_D = '#e6a882';

function mix(hex, amt) { // amt > 0 變亮、< 0 變暗
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(amt > 0 ? c + (255 - c) * amt : c * (1 + amt))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => f(c).toString(16).padStart(2, '0')).join('')}`;
}

// 依稀有度決定的外觀色票
const ARMOR = [
  null, // 普通：用職業本色
  { main: '#a0693a', dark: '#5e3a20' },
  { main: '#a9bad6', dark: '#5d6f94' },
  { main: '#7445b0', dark: '#3d2163' },
  { main: '#f4c542', dark: '#a8701c' },
];
const METAL = ['#b98a5a', '#9aa3b5', '#cfe3ff', '#c99bff', '#ffd75e'];
const HELM = ['#c9b79a', '#a0693a', '#a9bad6', '#8a5cd6', '#f4c542'];

export function lookOf(p, CLASSES, rarityIdx) {
  const c = CLASSES[p.cls];
  const g = p.gear || {};
  const ar = g.armor ? rarityIdx(g.armor.rarity) : 0;
  const base = c.outfit;
  const pal = ARMOR[ar];
  const outfit = pal ? { main: pal.main, dark: pal.dark, trim: ar >= 3 ? '#fff1a8' : base.main } : base;
  const wr = g.weapon ? rarityIdx(g.weapon.rarity) : 0;
  const hr = g.helm ? rarityIdx(g.helm.rarity) : -1;
  const legend = Object.values(g).some((it) => it && it.rarity === 'legend');
  return {
    hair: c.hair, outfit, trimClass: c.color,
    cape: ar >= 3 ? (ar === 4 ? '#d64550' : c.color) : null,
    helm: hr >= 0 ? { style: c.helm, color: HELM[hr], tier: hr } : null,
    weapon: { type: c.weapon, color: METAL[wr], tier: wr },
    aura: legend,
  };
}
export const npcLook = (n) => ({ hair: n.look.hair, outfit: { main: n.look.tunic, dark: n.look.tunicD, trim: n.look.band }, trimClass: n.look.band, cape: null, helm: null, weapon: null });

function painter(ctx) {
  const parts = [];
  return {
    r(x, y, w, h, c, round = true) { parts.push([x, y, w, h, c, round]); },
    flush() {
      ctx.fillStyle = INK;
      for (const [x, y, w, h, , rd] of parts) {
        if (rd && w > 2 && h > 2) { ctx.fillRect(x, y - 1, w, h + 2); ctx.fillRect(x - 1, y, w + 2, h); }
        else ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      }
      for (const [x, y, w, h, c, rd] of parts) {
        ctx.fillStyle = c;
        if (rd && w > 2 && h > 2) { ctx.fillRect(x + 1, y, w - 2, h); ctx.fillRect(x, y + 1, w, h - 2); }
        else ctx.fillRect(x, y, w, h);
      }
      parts.length = 0;
    },
  };
}

function drawWeapon(P, px, L, dir, atk) {
  const w = L.weapon;
  if (!w) return;
  const col = w.color, dk = mix(col, -0.45), hi = mix(col, 0.5);
  const side = dir === 'side';
  if (w.type === 'sword') {
    if (side) {
      if (atk) { P.r(13, 19, 11, 2, col, false); P.r(12, 17, 2, 6, dk, false); P.flush(); px(15, 19, 8, 1, hi); }
      else { P.r(12, 25, 2, 7, col, false); P.r(10, 23, 6, 2, dk, false); P.flush(); px(12, 26, 1, 5, hi); }
    } else {
      const y0 = atk ? 2 : 10;
      P.r(20, y0, 2, 13, col, false); P.r(18, y0 + 12, 6, 2, dk, false); P.r(20, y0 + 14, 2, 3, '#6b4024', false); P.flush(); px(20, y0 + 1, 1, 11, hi);
    }
    if (w.tier >= 3) px(side ? 13 : 21, side ? 27 : (atk ? 4 : 12), 1, 2, '#fff');
  } else if (w.type === 'bow') {
    const x = side ? 19 : 20, y = side ? 15 : 11;
    P.r(x, y, 2, 14, col, false); P.r(x + (side ? 2 : -1), y - 1, 2, 3, dk, false); P.r(x + (side ? 2 : -1), y + 12, 2, 3, dk, false); P.flush();
    px(side ? x - 1 : x + 2, y + 1, 1, 12, '#fff8e7');
    if (atk) { P.r(side ? 12 : 18, side ? 21 : 14, side ? 9 : 2, side ? 1 : 8, '#e8d29a', false); P.flush(); }
  } else if (w.type === 'staff') {
    const x = side ? 21 : 20;
    P.r(x, 6, 2, 22, '#8a5a32', false); P.flush();
    P.r(x - 1, 1, 4, 5, col); P.flush();
    px(x, 2, 1, 1, '#fff');
    if (w.tier >= 2 || atk) { px(x - 2, 3, 1, 1, hi); px(x + 3, 2, 1, 1, hi); }
  }
}

function drawHelm(P, px, L, dir) {
  const h = L.helm;
  if (!h) return;
  const c = h.color, dk = mix(c, -0.4), hi = mix(c, 0.45);
  const side = dir === 'side', back = dir === 'up';
  const ox = side ? 1 : 0;
  if (h.style === 'helm') {
    P.r(4 + ox, 0, 16, 9, c); P.flush();
    px(4 + ox, 6, 16, 2, dk); px(6 + ox, 1, 4, 1, hi);
    if (!back && !side) { px(11, 0, 2, 6, dk); }
  } else if (h.style === 'hood') {
    P.r(3 + ox, 0, 18, 9, c); P.r(3 + ox, 6, 3, 10, c); P.r(18 + ox, 6, 3, 10, c);
    if (back) P.r(5, 6, 14, 12, c);
    P.flush(); px(6 + ox, 1, 6, 1, hi);
  } else if (h.style === 'hat') {
    P.r(1 + ox, 6, 22, 3, c, false); P.r(7 + ox, 1, 10, 6, c); P.r(10 + ox, 0, 5, 2, c, false); P.flush();
    px(7 + ox, 5, 10, 1, dk); px(9 + ox, 2, 3, 1, hi);
  } else if (h.style === 'band') {
    px(4 + ox, 6, 16, 2, c); px(4 + ox, 7, 16, 1, dk);
    P.r(side ? 3 : 19, 7, 3, 2, c, false); P.r(side ? 1 : 21, 9, 2, 3, c, false); P.flush();
  }
  if (h.tier >= 3) { // 史詩以上：翅膀裝飾
    P.r(0 + ox, 2, 3, 5, '#fff8e7'); if (!side) P.r(21, 2, 3, 5, '#fff8e7'); P.flush();
  }
  if (h.tier >= 4 && !back) { px(11 + ox, 1, 2, 2, '#ff4d6d'); px(11 + ox, 1, 1, 1, '#ffd1dc'); }
}

const cache = new Map();
export function avatar(L, dir, frame) {
  const key = `${JSON.stringify(L)}|${dir}|${frame}`;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = AW; c.height = AH;
  const ctx = c.getContext('2d');
  const P = painter(ctx);
  const px = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  const o = L.outfit;
  const atk = frame === 2;
  const step = frame === 1;
  const d = dir === 'left' ? 'side' : dir === 'right' ? 'side' : dir;

  if (d === 'side') {
    if (L.cape) { P.r(4, 17, 7, 12, L.cape); P.flush(); }
    if (L.weapon?.type === 'bow' || L.weapon?.type === 'staff') { /* 武器畫在前面 */ }
    // 腿
    if (step) { P.r(8, 25, 3, 6, o.dark); P.r(14, 26, 3, 5, o.dark); } else { P.r(10, 26, 3, 5, o.dark); P.r(13, 26, 3, 5, o.dark); }
    P.flush();
    // 身體
    P.r(8, 17, 9, 10, o.main); P.flush();
    px(8, 24, 9, 1, o.dark); px(15, 18, 1, 6, o.trim);
    // 頭
    P.r(6, 3, 14, 14, SKIN); P.r(5, 1, 15, 8, L.hair); P.r(4, 5, 7, 10, L.hair); P.flush();
    px(13, 8, 3, 2, L.hair); px(18, 8, 1, 2, L.hair); px(7, 2, 4, 1, mix(L.hair, 0.35));
    px(16, 10, 2, 3, '#2b1d2e'); px(16, 10, 1, 1, '#fff'); px(17, 13, 2, 1, '#f59aa0'); px(19, 14, 1, 1, '#b0574f');
    drawHelm(P, px, L, 'side');
    // 前手＋武器
    if (L.weapon?.type === 'fist') {
      P.r(atk ? 15 : 11, 18, atk ? 8 : 3, 4, o.main); P.r(atk ? 21 : 10, atk ? 17 : 23, 5, 5, L.weapon.color); P.flush();
      px(atk ? 22 : 11, atk ? 18 : 24, 2, 1, mix(L.weapon.color, 0.5));
    } else {
      drawWeapon(P, px, L, 'side', atk);
      P.r(atk ? 13 : 11, 18, 3, 6, o.main); P.r(atk ? 13 : 11, 23, 3, 2, SKIN); P.flush();
    }
  } else {
    const back = d === 'up';
    if (L.cape && !back) { P.r(5, 17, 14, 12, L.cape); P.flush(); }
    if (back) drawWeapon(P, px, L, 'down', atk);
    // 腿
    if (step) { P.r(8, 25, 3, 5, o.dark); P.r(13, 26, 3, 5, o.dark); } else { P.r(8, 26, 3, 5, o.dark); P.r(13, 26, 3, 5, o.dark); }
    P.flush();
    px(8, step ? 28 : 29, 3, 2, mix(o.dark, -0.35)); px(13, 29, 3, 2, mix(o.dark, -0.35));
    // 身體＋手
    P.r(7, 17, 10, 10, o.main);
    if (L.weapon?.type === 'fist') { P.r(4, 18, 3, 6, o.main); P.r(17, 18, 3, 6, o.main); P.r(3, 23, 5, 5, L.weapon.color); P.r(16, atk ? 21 : 23, 5, 5, L.weapon.color); }
    else { P.r(4, 18, 3, 7, o.main); P.r(17, 18, 3, 7, o.main); P.r(4, 24, 3, 2, SKIN); P.r(17, 24, 3, 2, SKIN); }
    P.flush();
    px(7, 24, 10, 1, o.dark); px(9, 17, 6, 1, o.trim);
    if (!back) { px(11, 18, 2, 6, o.trim); px(11, 24, 2, 1, '#f6c945'); }
    if (L.cape && back) { P.r(5, 16, 14, 13, L.cape); P.flush(); px(6, 17, 12, 1, mix(L.cape, 0.3)); }
    // 頭
    P.r(5, 3, 14, 14, SKIN);
    P.r(4, 1, 16, 8, L.hair); P.r(4, 6, 3, 8, L.hair); P.r(17, 6, 3, 8, L.hair);
    if (back) P.r(5, 4, 14, 12, L.hair);
    P.flush();
    px(7, 2, 4, 1, mix(L.hair, 0.35));
    if (!back) {
      px(7, 8, 3, 2, L.hair); px(11, 8, 3, 1, L.hair); px(15, 8, 2, 2, L.hair);
      px(8, 10, 2, 3, '#2b1d2e'); px(14, 10, 2, 3, '#2b1d2e'); px(8, 10, 1, 1, '#fff'); px(14, 10, 1, 1, '#fff');
      px(6, 13, 2, 1, '#f59aa0'); px(16, 13, 2, 1, '#f59aa0'); px(11, 14, 2, 1, '#b0574f'); px(5, 15, 14, 1, SKIN_D);
    }
    drawHelm(P, px, L, back ? 'up' : 'down');
    if (!back) drawWeapon(P, px, L, 'down', atk);
  }
  const out = dir === 'left' ? flip(c) : c;
  cache.set(key, out);
  return out;
}
function flip(src) {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const x = c.getContext('2d'); x.translate(src.width, 0); x.scale(-1, 1); x.drawImage(src, 0, 0); return c;
}
