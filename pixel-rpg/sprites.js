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

export const COIN = pad(['.kkkk.', 'kyyyYk', 'kywyYk', 'kyyyYk', '.kkkk.']);
export const ORB = pad(['..kkk..', '.kxxxk.', 'kxwxxxk', 'kxxxxxk', 'kxxxxxk', '.kxxxk.', '..kkk..']);


// ---- 怪物模板（g 主色、G 暗色、l 亮色、m 點綴色）----
const BAT_TOP = ['........', '........', '........', '.k......'];
const BAT_A = mirror([...BAT_TOP, '.kk...kk', '.kGk.kgg', 'kgGgkkgg', 'kggGkggl', 'kgggkgeg', '.kggkggg', '..kkkggm', '....kggg', '.....kkk', '........', '........', '........']);
const BAT_B = mirror(['........', '........', '........', '........', '......kk', '.....kgg', '....kkgg', '.kkkkggl', 'kGggkgeg', 'kgGgkggg', '.kgGkggm', '..kkkggg', '.....kkk', '........', '........', '........']);
const GOLEM_A = mirror(['........', '........', '........', '...kkkkk', '..kGgggg', '..kGglgg', '..kGgmgg', '..kGgggg', 'kkkGGggg', 'kGgkGggg', 'kGgkGGgg', 'kkkkGGgg', '...kGGkk', '...kGGk.', '...kkkk.', '........']);
const GOLEM_B = ['................', ...GOLEM_A.slice(0, 15)];
const GHOST_A = mirror(['........', '........', '.....kkk', '....kggg', '...kglgg', '...kgggg', '..kggegg', '..kggegg', '..kggggm', '..kggggg', '.kgggggg', '.kgGgggg', '.kGGgGgg', '..kGkGkG', '...k..k.', '........']);
const GHOST_B = mirror(['........', '.....kkk', '....kggg', '...kglgg', '...kgggg', '..kggegg', '..kggegg', '..kggggm', '..kggggg', '.kgggggg', '.kgGgggg', '.kGGgGgg', '..kkGkkG', '....k..k', '........', '........']);
const CRAB_A = mirror(['........', '........', '........', '........', '.kk.....', 'kmmk....', 'kmmk..ek', '.kmk.kkk', '..kkkggg', '..kggggl', '.kgggggg', 'kGgggggg', 'kGGggggg', '.kGGGGGG', '..k.k.kk', '........']);
const CRAB_B = mirror(['........', '........', '........', 'kk......', 'mmk.....', 'mmk...ek', 'kmk..kkk', '.kkkkggg', '..kggggl', '.kgggggg', 'kGgggggg', 'kGGggggg', '.kGGGGGG', '.k.k.k.k', '........', '........']);
const IMP_A = mirror(['........', '..k.....', '..kk....', '..kGkkkk', '...kgggg', '...kglgg', '..kggegg', '...kgggm', '....kkkk', '...kGGGG', '..kGGGGG', '..kGGGGm', '..kGGGGG', '...kGGkk', '...kkk..', '........']);
const IMP_B = ['................', ...IMP_A.slice(0, 15)];
const MIRROR_A = mirror(['...kkkkk', '..kYyyyy', '.kYkkkkk', '.kYkcccc', '.kYkcwcc', '.kYkccwc', '.kYkcccc', '.kYkcccc', '.kYkcccc', '.kYkcccw', '.kYkcccc', '.kYkkkkk', '..kYyyyy', '...kkkkk', '....kYYY', '...kkkkk']);
export const MONSTER_TPL = { slime: SLIME, bat: [BAT_A, BAT_B], golem: [GOLEM_A, GOLEM_B], ghost: [GHOST_A, GHOST_B], crab: [CRAB_A, CRAB_B], imp: [IMP_A, IMP_B], mirror: [MIRROR_A, MIRROR_A] };
const monCache = new Map();
export function monsterSprite(tpl, pal) {
  const key = tpl + JSON.stringify(pal);
  if (!monCache.has(key)) monCache.set(key, (MONSTER_TPL[tpl] || SLIME).map((f) => makeSprite(f, { ...PAL, e: '#1b1420', ...pal })));
  return monCache.get(key);
}

// ---- 各章地形 ----
const SPIRE = pad(['................', '......kkkk......', '.....kGggGk.....', '.....kgllgk.....', '....kGglggk.....', '....kgggggGk....', '....kGggggGk....', '...kGgglgggGk...', '...kggggggggk...', '...kGgggggGGk...', '..kGgggglgggGk..', '..kgggggggggGk..', '..kGGgggggGGGk..', '.kGGGGGGGGGGGGk.', '..kkkkkkkkkkkk..', '................']);
const CRATE = pad(['................', '................', '..kkkkkkkkkkkk..', '..kGgggggggggk..', '..kgkGgggggkgk..', '..kggkGgggkggk..', '..kgggkGgkgggk..', '..kggggkkggggk..', '..kggggkkggggk..', '..kgggkgGkgggk..', '..kggkgggGkggk..', '..kgkgggggGkgk..', '..kGggggggggGk..', '..kkkkkkkkkkkk..', '................', '................']);
const PILLAR = pad(['................', '....kkkkkkkk....', '....kllllllk....', '....kkkkkkkk....', '.....kglgGk.....', '.....kglgGk.....', '.....kglgGk.....', '.....kglgGk.....', '.....kglgGk.....', '.....kglgGk.....', '.....kglgGk.....', '.....kglgGk.....', '....kkkkkkkk....', '...kGggggggGk...', '...kkkkkkkkkk...', '................']);
const PILLAR_DARK = pad(['.......kk.......', '......kmmk......', '....kkkmmkkk....', '....kllllllk....', '....kkkkkkkk....', '.....kglgGk.....', '.....kglgGk.....', '.....kglgGk.....', '.....kglgGk.....', '.....kglgGk.....', '.....kglgGk.....', '.....kglgGk.....', '....kkkkkkkk....', '...kGggggggGk...', '...kkkkkkkkkk...', '................']);
const BARREL = pad(['................', '................', '................', '.....kkkkkk.....', '....kGgggggk....', '...kGgmmmmggk...', '...kGgggggggk...', '...kGgglgggGk...', '...kGgmmmmmgk...', '...kGggggggGk...', '...kGgglgggGk...', '...kGgmmmmggk...', '....kGggggGk....', '.....kkkkkk.....', '................', '................']);
export const THEMES = {
  meadow: { g: '#6cc04a', gd: '#4f9a3a', gl: '#8fd66a', path: '#e6c48f', pathD: '#cfa572', pathL: '#f3dcb2', edge: '#b88a58', water: '#3f97d6', obst: [TREE, {}], rock: [ROCK, {}], style: 'grass' },
  canyon: { g: '#d9a066', gd: '#b9804a', gl: '#efc28a', path: '#c48a52', pathD: '#a8703f', pathL: '#dba06a', edge: '#8a5a32', water: '#3f97d6', obst: [SPIRE, { g: '#c9733a', G: '#8a4a24', l: '#f0a868' }], rock: [ROCK, { n: '#b98a5a', N: '#7a5636', w: '#e8c49a' }], style: 'sand' },
  factory: { g: '#7d8494', gd: '#5f6575', gl: '#9aa1b0', path: '#5a5f6c', pathD: '#474b56', pathL: '#6d7280', edge: '#3a3e48', water: '#3f97d6', obst: [CRATE, { g: '#b07a45', G: '#7a5030' }], rock: [BARREL, { g: '#7a8399', G: '#4f5361', l: '#c4c8d4', m: '#e0533d' }], style: 'plate' },
  castle: { g: '#5f8f62', gd: '#477a4a', gl: '#7fae7f', path: '#a3a8bd', pathD: '#8a8fa3', pathL: '#c8ccdb', edge: '#6b6f85', water: '#2f5f9f', obst: [PILLAR, { g: '#c8ccdb', G: '#8a8fa3', l: '#eef0f6' }], rock: [ROCK, {}], style: 'grass' },
  harbor: { g: '#a87a52', gd: '#8a5f3a', gl: '#c4966a', path: '#8f9aa8', pathD: '#6f7a88', pathL: '#b0bac6', edge: '#4f5866', water: '#245a8a', obst: [BARREL, { g: '#9a6337', G: '#6b4024', l: '#c4966a', m: '#3a3e48' }], rock: [CRATE, { g: '#8a5f3a', G: '#5e3a20' }], style: 'plank' },
  temple: { g: '#3d3352', gd: '#2a2338', gl: '#55486f', path: '#5a4f70', pathD: '#463d59', pathL: '#6d6185', edge: '#1f1a2e', water: '#3f97d6', obst: [PILLAR_DARK, { g: '#6b5f8a', G: '#3d3352', l: '#9a8fc4', m: '#ff4d6d' }], rock: [ROCK, { n: '#55486f', N: '#2a2338', w: '#8a7fb0' }], style: 'stone' },
};

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
  ember: { g: '#ff8a3d', G: '#b34a1f', l: '#ffd29e', m: '#fff1a8', M: '#e8502e' },
  king: { g: '#7ad35a', G: '#3a8a3a', l: '#d0ff9e' },
};

// ---- 地圖貼圖（直接畫到大地圖畫布上，1 單位 = 1 像素）----
export function drawMap(ctx, g, T, houses, seed = 3, themeId = 'meadow') {
  const TH = THEMES[themeId] || THEMES.meadow;
  let s = seed; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const px = (x, y, c, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const at = (x, y) => (g[y] && g[y][x] !== undefined ? g[y][x] : T.TREE);
  const isGround = (t) => t === T.PATH || t === T.BRIDGE || t === T.FOUNTAIN || t === T.SIGN || t === T.PORTAL;
  const tree = makeSprite(TH.obst[0], { ...PAL, ...TH.obst[1] }), rock = makeSprite(TH.rock[0], { ...PAL, ...TH.rock[1] }), sign = makeSprite(SIGNPOST);
  const grass = (X, Y) => {
    px(X, Y, TH.g, 16, 16);
    if (TH.style === 'grass') {
      for (let i = 0; i < 5; i++) { const a = X + 1 + Math.floor(r() * 13), b = Y + 2 + Math.floor(r() * 13); px(a, b, TH.gd); px(a + 1, b - 1, TH.gd); px(a + 2, b, TH.gd); }
    } else if (TH.style === 'plate') {
      px(X, Y, TH.gd, 16, 1); px(X, Y, TH.gd, 1, 16); px(X + 2, Y + 2, TH.gl); px(X + 13, Y + 2, TH.gl); px(X + 2, Y + 13, TH.gl); px(X + 13, Y + 13, TH.gl);
    } else if (TH.style === 'plank') {
      for (let k = 0; k < 16; k += 4) px(X, Y + k, TH.gd, 16, 1);
      px(X + ((Y / 4) % 16), Y, TH.gd, 1, 16);
    } else if (TH.style === 'stone') {
      px(X, Y, TH.gd, 16, 1); px(X, Y + 8, TH.gd, 16, 1); px(X + (Y % 32 ? 4 : 11), Y, TH.gd, 1, 8); px(X + (Y % 32 ? 11 : 4), Y + 8, TH.gd, 1, 8);
    } else for (let i = 0; i < 6; i++) px(X + Math.floor(r() * 15), Y + Math.floor(r() * 15), TH.gd, 2, 1);
    for (let i = 0; i < 4; i++) px(X + Math.floor(r() * 16), Y + Math.floor(r() * 16), TH.gl);
  };
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) {
    const t = g[y][x], X = x * 16, Y = y * 16;
    if (t === T.WATER) {
      px(X, Y, TH.water, 16, 16);
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
    if (themeId === 'meadow' && isGround(t) && x >= 5 && x <= 15 && y >= 9 && y <= 18 && t !== T.SIGN) {
      // 廣場石板
      px(X, Y, '#b9a88f', 16, 16);
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
        const sx = X + i * 8 + ((y + j) % 2 ? 4 : 0) % 8, sy = Y + j * 8;
        const tone = ['#d8cab2', '#cfbfa4', '#e2d6c0'][Math.floor(r() * 3)];
        px(sx + 1, sy + 1, tone, 6, 6); px(sx + 1, sy + 1, '#efe6d6', 5, 1);
      }
      continue;
    }
    if (isGround(t) || t === T.PORTAL) {
      px(X, Y, TH.path, 16, 16);
      for (let i = 0; i < 4; i++) px(X + Math.floor(r() * 15), Y + Math.floor(r() * 15), TH.pathD, 2, 1);
      for (let i = 0; i < 3; i++) px(X + Math.floor(r() * 16), Y + Math.floor(r() * 16), TH.pathL);
      const edge = TH.edge;
      if (t === T.PORTAL) {
        ctx.fillStyle = '#3a2a6b'; ctx.beginPath(); ctx.ellipse(X + 8, Y + 9, 8, 5, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = '#c084ff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(X + 8, Y + 9, 7, 4, 0, 0, 7); ctx.stroke();
        ctx.strokeStyle = '#7fd8ff'; ctx.beginPath(); ctx.ellipse(X + 8, Y + 9, 4, 2, 0, 0, 7); ctx.stroke();
        continue;
      }
      if (!isGround(at(x, y - 1))) px(X, Y, edge, 16, 1);
      if (!isGround(at(x, y + 1))) px(X, Y + 15, edge, 16, 1);
      if (!isGround(at(x - 1, y))) px(X, Y, edge, 1, 16);
      if (!isGround(at(x + 1, y))) px(X + 15, Y, edge, 1, 16);
      if (t === T.SIGN) ctx.drawImage(sign, X, Y);
      continue;
    }
    grass(X, Y);
    if (t === T.FLOWER && TH.style !== 'grass') { for (let i = 0; i < 3; i++) { const a = X + 2 + Math.floor(r() * 11), b = Y + 3 + Math.floor(r() * 10); px(a, b, TH.gd, 3, 2); px(a, b, TH.gl, 1, 1); } }
    else if (t === T.FLOWER) {
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
