// 微光大陸：原創像素美術。所有圖都用字元陣列畫，再轉成 16×16 的小畫布。
export const PAL = {
  k: '#2a1d2e', w: '#fff8e7', s: '#f7c59f', S: '#d9926b', e: '#1b1420',
  h: '#6b3e26', H: '#45261a', r: '#d64550', R: '#9e2a3a', b: '#3f6fd1', B: '#2a4a96',
  g: '#5cc35a', G: '#2f8a4a', l: '#a6ec7a', y: '#f6c945', Y: '#c98b2b', o: '#9a6337', O: '#6b4024',
  m: '#ff8fb1', M: '#d0587e', v: '#9b6be0', V: '#62409e', c: '#bdf1ff', n: '#a3a8bd', N: '#6b6f85', a: '#4aa3df',
};

const pad = (rows) => rows.map((r) => (r + '................').slice(0, 16));
const mirror = (halves) => halves.map((h) => { const x = (h + '........').slice(0, 8); return x + [...x].reverse().join(''); });

// ---- 主角（紅頭巾冒險者）----
const HERO_DOWN_TOP = mirror([
  '........', '.....kkk', '....krrr', '...krrRR', '..khhhhh', '..khhsss', '..khsses', '..kSssss',
  '...kssss', '..kbbbbb', '.ksbbbbb', '.ksBbbbb', '..kYYYYY',
]);
const HERO_UP_TOP = mirror([
  '........', '.....kkk', '....krrr', '...krrRR', '..khhhhh', '..khhhhh', '..khhhhh', '..kHhhhh',
  '...khhhh', '..kbbbbb', '.ksbbbbb', '.ksbbBbb', '..kYYYYY',
]);
const LEGS_A = ['...kBBBkkBBBk...', '...kOOOkkOOk....', '...kkkkk.kkk....'];
const LEGS_B = ['...kBBBkkBBBk...', '....kOOkkOOOk...', '....kkk.kkkkk...'];
const HERO_SIDE_TOP = pad([
  '................', '......kkkkk.....', '.....krrrrrk....', '..kkkrrrRRRRk...', '..kRkhhhhhhhk...',
  '...kkhhhssssk...', '....khhsssesk...', '....khssssssk...', '.....kSsssskk...', '.....kbbbbbk....',
  '....kbbbsbbk....', '....kbBbsbbk....', '....kYYYYYYk....',
]);
const SIDE_A = ['.....kBBkBBk....', '.....kOOkOOk....', '.....kkkkkkk....'];
const SIDE_B = ['....kBBk.kBBk...', '...kOOk...kOOk..', '...kkk.....kkk..'];

export const HERO = {
  down: [[...HERO_DOWN_TOP, ...LEGS_A], [...HERO_DOWN_TOP, ...LEGS_B]],
  up: [[...HERO_UP_TOP, ...LEGS_A], [...HERO_UP_TOP, ...LEGS_B]],
  right: [[...HERO_SIDE_TOP, ...SIDE_A], [...HERO_SIDE_TOP, ...SIDE_B]],
};

// ---- 史萊姆 ----
const SLIME_A = pad([
  '................', '................', '................', '................', '................',
  '......kkkk......', '....kkggggkk....', '...kgglggggGk...', '..kglllgggggGk..', '..kgllggggggGk..',
  '.kggggekggekgGk.', '.kggggeeggeegGk.', '.kgggggmMggggGk.', '.kGggggggggGGGk.', '..kGGGGGGGGGGk..', '...kkkkkkkkkk...',
]);
const SLIME_B = ['................', ...SLIME_A.slice(0, 6), ...SLIME_A.slice(7)];
export const SLIME = [SLIME_A, SLIME_B];

export const CROWN = pad(['....k..k..k.....', '...kyk.kyk.kyk..', '...kyykyyykyyk..', '...kYyyyryyyYk..', '...kkkkkkkkkkk..']);

// ---- 地形物件 ----
export const TREE = pad([
  '.....kkkkkk.....', '...kkGGGGGGkk...', '..kGGgggggGGGk..', '.kGgglgggggGGGk.', '.kGglllggggGGGk.', 'kGggllgggggggGGk',
  'kGgggggggglggGGk', 'kGGgggggglllgGGk', 'kGGGgggggglgGGGk', '.kGGGGgggggGGGk.', '.kkGGGGGGGGGGkk.', '...kkkGGGGkkk...',
  '......kook......', '......kOok......', '.....kOOook.....', '....kkkkkkkk....',
]);
export const ROCK = pad([
  '................', '................', '................', '................', '................', '................',
  '.....kkkkk......', '....knnnnnkk....', '...knnwnnnnNk...', '..knnwnnnnnNNk..', '..knnnnnnnNNNk..', '.knnnnnnnNNNNNk.',
  '.kNnnnnnNNNNNNk.', '..kNNNNNNNNNNk..', '...kkkkkkkkkk...', '................',
]);
export const SIGNPOST = pad([
  '................', '................', '.kkkkkkkkkkkkkk.', '.koooooooooooook', '.koOOOoOOoOOOook', '.kooooooooooooko',
  '.koOOoOOOOoOOook', '.koooooooooooook', '.kkkkkkookkkkkk.', '......kook......', '......kOok......', '......kook......',
  '......kOok......', '.....kOOOOk.....', '.....kkkkkk.....', '................',
]);
export const SLASH = pad([
  '................', '..........ww....', '...........ww...', '............ww..', '............cw..', '.............w..',
  '.............ww.', '.............cw.', '.............cw.', '.............ww.', '.............w..', '............cw..',
  '............ww..', '...........ww...', '..........ww....', '................',
]);
export const BOBBER = pad(['.kk.', 'krrk', 'kwwk', '.kk.']);
export const BANG = pad(['.kkk.', 'kyyyk', 'kyyyk', 'kyyyk', '.kyk.', '.kkk.', 'kyyyk', '.kkk.']);
export const HEART = pad(['.kk.kk.', 'krrkrrk', 'krwrrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...']);

export function makeSprite(rows, pal = PAL, scale = 1) {
  const c = document.createElement('canvas');
  c.width = 16 * scale; c.height = rows.length * scale;
  const x = c.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, i) => {
    if (ch === '.' || !pal[ch]) return;
    x.fillStyle = pal[ch]; x.fillRect(i * scale, y * scale, scale, scale);
  }));
  return c;
}

export function flipX(src) {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const x = c.getContext('2d'); x.translate(src.width, 0); x.scale(-1, 1); x.drawImage(src, 0, 0); return c;
}
export function rotate(src, quarter) {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const x = c.getContext('2d'); x.translate(src.width / 2, src.height / 2); x.rotate((quarter * Math.PI) / 2); x.drawImage(src, -src.width / 2, -src.height / 2); return c;
}

// 角色換色（NPC 共用主角骨架）
export function charSet(look) {
  const pal = { ...PAL };
  if (look) Object.assign(pal, { h: look.hair, H: look.hairD, r: look.band, R: look.bandD, b: look.tunic, B: look.tunicD });
  const set = {};
  for (const dir of ['down', 'up', 'right']) set[dir] = HERO[dir].map((f) => makeSprite(f, pal));
  set.left = set.right.map(flipX);
  return set;
}

export const SLIME_COLORS = {
  slime: { g: '#62c7e8', G: '#2f7fb3', l: '#c4f2ff' },
  berry: { g: '#e8628f', G: '#a3305d', l: '#ffc4d8', m: '#fff1a8', M: '#d9a63b' },
  king: { g: '#7ad35a', G: '#3a8a3a', l: '#d0ff9e' },
};

// ---- 地圖貼圖（直接畫到大地圖畫布上，1 單位 = 1 像素）----
export function drawMap(ctx, g, T, houses, seed = 3) {
  let s = seed; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const px = (x, y, c, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const at = (x, y) => (g[y] && g[y][x] !== undefined ? g[y][x] : T.TREE);
  const isGround = (t) => t === T.PATH || t === T.BRIDGE || t === T.FOUNTAIN || t === T.SIGN;
  const tree = makeSprite(TREE), rock = makeSprite(ROCK), sign = makeSprite(SIGNPOST);
  const grass = (X, Y) => {
    px(X, Y, '#6cc04a', 16, 16);
    for (let i = 0; i < 5; i++) { const a = X + 1 + Math.floor(r() * 13), b = Y + 2 + Math.floor(r() * 13); px(a, b, '#4f9a3a'); px(a + 1, b - 1, '#4f9a3a'); px(a + 2, b, '#4f9a3a'); }
    for (let i = 0; i < 4; i++) px(X + Math.floor(r() * 16), Y + Math.floor(r() * 16), '#8fd66a');
  };
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) {
    const t = g[y][x], X = x * 16, Y = y * 16;
    if (t === T.WATER) {
      px(X, Y, '#3f97d6', 16, 16);
      for (let i = 0; i < 3; i++) px(X + Math.floor(r() * 12), Y + Math.floor(r() * 16), '#5bb2ea', 4, 1);
      if (at(x - 1, y) !== T.WATER && at(x - 1, y) !== T.BRIDGE) { px(X, Y, '#2a6fb0', 2, 16); px(X + 2, Y, '#a8e4f5', 1, 16); }
      if (at(x + 1, y) !== T.WATER && at(x + 1, y) !== T.BRIDGE) { px(X + 14, Y, '#2a6fb0', 2, 16); px(X + 13, Y, '#a8e4f5', 1, 16); }
      continue;
    }
    if (t === T.BRIDGE) {
      px(X, Y, '#b8834e', 16, 16);
      for (let i = 0; i < 16; i += 4) px(X + i, Y, '#8a5a32', 1, 16);
      if (at(x, y - 1) !== T.BRIDGE) { px(X, Y, '#6b4024', 16, 3); px(X, Y + 3, '#2a1d2e', 16, 1); }
      if (at(x, y + 1) !== T.BRIDGE) { px(X, Y + 13, '#6b4024', 16, 3); px(X, Y + 12, '#2a1d2e', 16, 1); }
      continue;
    }
    if (isGround(t) && x >= 5 && x <= 15 && y >= 9 && y <= 18 && t !== T.SIGN) {
      // 廣場石板
      px(X, Y, '#b9a88f', 16, 16);
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
        const sx = X + i * 8 + ((y + j) % 2 ? 4 : 0) % 8, sy = Y + j * 8;
        const tone = ['#d8cab2', '#cfbfa4', '#e2d6c0'][Math.floor(r() * 3)];
        px(sx + 1, sy + 1, tone, 6, 6); px(sx + 1, sy + 1, '#efe6d6', 5, 1);
      }
      continue;
    }
    if (isGround(t)) {
      px(X, Y, '#e6c48f', 16, 16);
      for (let i = 0; i < 4; i++) px(X + Math.floor(r() * 15), Y + Math.floor(r() * 15), '#cfa572', 2, 1);
      for (let i = 0; i < 3; i++) px(X + Math.floor(r() * 16), Y + Math.floor(r() * 16), '#f3dcb2');
      const edge = '#b88a58';
      if (!isGround(at(x, y - 1))) px(X, Y, edge, 16, 1);
      if (!isGround(at(x, y + 1))) px(X, Y + 15, edge, 16, 1);
      if (!isGround(at(x - 1, y))) px(X, Y, edge, 1, 16);
      if (!isGround(at(x + 1, y))) px(X + 15, Y, edge, 1, 16);
      if (t === T.SIGN) ctx.drawImage(sign, X, Y);
      continue;
    }
    grass(X, Y);
    if (t === T.FLOWER) {
      const cols = [['#fff8e7', '#f6c945'], ['#ff8fb1', '#fff8e7'], ['#9bb8ff', '#fff8e7'], ['#f6c945', '#d64550']];
      for (let i = 0; i < 2; i++) {
        const [p, c] = cols[Math.floor(r() * cols.length)];
        const a = X + 2 + Math.floor(r() * 10), b = Y + 3 + Math.floor(r() * 10);
        px(a, b + 2, '#3f8a3a', 1, 2); px(a - 1, b, p); px(a + 1, b, p); px(a, b - 1, p); px(a, b + 1, p); px(a, b, c);
      }
    }
    if (t === T.TREE) ctx.drawImage(tree, X, Y);
    if (t === T.ROCK) ctx.drawImage(rock, X, Y);
  }
  // 噴水池 2×2
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) {
    if (g[y][x] === T.FOUNTAIN && at(x - 1, y) !== T.FOUNTAIN && at(x, y - 1) !== T.FOUNTAIN) {
      const X = x * 16, Y = y * 16;
      ctx.fillStyle = '#2a1d2e'; ctx.beginPath(); ctx.ellipse(X + 16, Y + 18, 15, 12, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#a3a8bd'; ctx.beginPath(); ctx.ellipse(X + 16, Y + 17, 14, 11, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#6b6f85'; ctx.beginPath(); ctx.ellipse(X + 16, Y + 19, 11, 8, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#4aa3df'; ctx.beginPath(); ctx.ellipse(X + 16, Y + 18, 10, 7, 0, 0, 7); ctx.fill();
      px(X + 14, Y + 6, '#2a1d2e', 4, 12); px(X + 15, Y + 6, '#c8ccdb', 2, 12); px(X + 11, Y + 5, '#2a1d2e', 10, 3); px(X + 12, Y + 5, '#c8ccdb', 8, 2);
    }
  }
  // 房子 3×3
  for (const h of houses) {
    const X = h.x * 16, Y = h.y * 16;
    px(X + 2, Y + 44, '#00000033', 46, 4);
    // 牆
    px(X + 3, Y + 22, '#2a1d2e', 42, 26); px(X + 4, Y + 23, '#f3e2c3', 40, 24);
    px(X + 4, Y + 23, '#c9ad85', 40, 2); for (const cx of [4, 23, 42]) px(X + cx, Y + 23, '#9a6337', 2, 24);
    // 窗
    for (const wx of [9, 31]) { px(X + wx, Y + 28, '#2a1d2e', 9, 9); px(X + wx + 1, Y + 29, '#8fd3ff', 7, 7); px(X + wx + 1, Y + 29, '#d6f3ff', 3, 3); px(X + wx + 4, Y + 29, '#2a1d2e', 1, 7); px(X + wx + 1, Y + 32, '#2a1d2e', 7, 1); px(X + wx - 1, Y + 37, '#9a6337', 11, 2); }
    // 門
    px(X + 18, Y + 33, '#2a1d2e', 12, 15); px(X + 19, Y + 34, '#9a6337', 10, 14); px(X + 23, Y + 34, '#6b4024', 1, 14); px(X + 26, Y + 41, '#f6c945', 2, 2);
    // 屋頂
    for (let i = 0; i < 24; i++) {
      const w = 26 + i, xx = X + 24 - w / 2;
      px(Math.round(xx), Y + i, '#2a1d2e', Math.round(w) + 1, 1);
      if (i > 0 && i < 23) px(Math.round(xx) + 1, Y + i, i % 6 < 3 ? h.roof : h.roofD, Math.round(w) - 1, 1);
    }
    px(X - 1, Y + 22, '#2a1d2e', 50, 2);
    for (let i = 3; i < 22; i += 6) for (let j = X + 6 + (i % 12 ? 3 : 0); j < X + 44; j += 7) px(j, Y + i, '#00000022', 1, 3);
    px(X + 34, Y - 2, '#2a1d2e', 7, 12); px(X + 35, Y - 1, '#c8553d', 5, 10);
    // 招牌
    px(X + 15, Y + 18, '#2a1d2e', 18, 7); px(X + 16, Y + 19, '#f6c945', 16, 5);
  }
}
