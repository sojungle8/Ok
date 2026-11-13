// 微光大陸：道具與裝備圖示（16×16 像素，x = 主色、X = 暗色、w = 亮點、O/o = 木頭握柄）
const pad = (rows) => rows.map((r) => (r + '................').slice(0, 16));
const SHAPES = {
  sword: ['..............kk', '.............kwk', '............kwxk', '...........kwxk.', '..........kwxk..', '.........kwxk...', '........kwxk....', '.......kwxk.....', '..kk..kwxk......', '..kXkkwxk.......', '...kXXxk........', '....kXXk........', '...kOkXXk.......', '..kOk..kXk......', '.kOk....kk......', '..k.............'],
  bow: ['.....kkk........', '....kOOOk.......', '...kOk..kk......', '...kOk...wk.....', '..kOk....w.k....', '..kOk....w..k...', '..kOk....w...k..', '..kxk....w....k.', '..kxk....w....k.', '..kOk....w...k..', '..kOk....w..k...', '..kOk....w.k....', '...kOk...wk.....', '...kOk..kk......', '....kOOOk.......', '.....kkk........'],
  staff: ['.......kkk......', '......kxwxk.....', '.....kxwwxXk....', '.....kxxxXXk....', '......kXXXk.....', '.......kOk......', '.......kOk......', '.......kOk......', '.......kok......', '.......kOk......', '.......kOk......', '.......kOk......', '.......kok......', '.......kOk......', '.......kOk......', '........k.......'],
  fist: ['................', '................', '...kkkkkkkk.....', '..kxxkxxkxxk....', '..kxxkxxkxxkk...', '..kxxxxxxxxkxk..', '..kwxxxxxxxkxk..', '..kxxxxxxxxxxk..', '..kXxxxxxxxxxk..', '..kXXxxxxxxxk...', '...kXXXXXXXk....', '....kOOOOOk.....', '....kOOOOOk.....', '....kkkkkkk.....', '................', '................'],
  helm: ['................', '................', '.....kkkkkk.....', '....kxxwxxxk....', '...kxxwxxxxXk...', '..kxxwxxxxxxXk..', '..kxxxxxxxxxXk..', '..kxxxxxxxxxXk..', '..kXkkkkkkkkXk..', '..kXk......kXk..', '..kXk......kXk..', '..kXk......kXk..', '...kk......kk...', '................', '................', '................'],
  armor: ['................', '...kkk....kkk...', '..kxxxkkkkxxxk..', '..kxxxxwwxxxxk..', '..kxxxxxxxxxxk..', '...kkxxxxxxkk...', '....kxxxxxxk....', '....kxxwxxxk....', '....kxxxxxXk....', '....kXxxxxXk....', '....kXXXXXXk....', '....kkkkkkkk....', '................', '................', '................', '................'],
  gloves: ['................', '................', '....kk.kk.......', '...kxkkxxk......', '...kxkxxxk.kk...', '...kxxxxxxkxxk..', '...kxwxxxxxxxk..', '...kxxxxxxxxk...', '...kxxxxxxxk....', '...kXxxxxxk.....', '...kXXXXXXk.....', '...kOOOOOOk.....', '...kkkkkkkk.....', '................', '................', '................'],
  boots: ['................', '................', '.....kkkkk......', '.....kxxxk......', '.....kxwxk......', '.....kxxxk......', '.....kxxxk......', '.....kxxxk......', '.....kxxxkkk....', '.....kxxxxxxk...', '.....kxxxxxxXk..', '.....kXXXXXXXk..', '.....kOOOOOOOk..', '.....kkkkkkkkk..', '................', '................'],
  ring: ['................', '................', '.......kk.......', '......kwxk......', '.....kxxxXk.....', '......kXXk......', '.....kkkkkk.....', '....kYyyyyYk....', '...kYk....kYk...', '...kyk....kyk...', '...kyk....kyk...', '...kYk....kYk...', '....kYyyyyYk....', '.....kkkkkk.....', '................', '................'],
  potion: ['................', '......kkkk......', '......kOOk......', '......kkkk......', '.......kk.......', '......kwwk......', '.....kwxxxk.....', '....kwxxxxXk....', '....kxxxxxXk....', '....kxwxxxXk....', '....kxxxxxXk....', '....kXxxxXXk....', '.....kXXXXk.....', '......kkkk......', '................', '................'],
  scroll: ['................', '................', '...kkkkkkkkkk...', '..kOxxxxxxxxOk..', '..kOkkkkkkkkOk..', '...kxwxxxxxxk...', '...kxkkkkkxxk...', '...kxxxxxxxxk...', '...kxkkkkxxxk...', '...kxxxxxxxxk...', '...kxkkkkkkxk...', '..kOkkkkkkkkOk..', '..kOxxxxxxxxOk..', '...kkkkkkkkkk...', '................', '................'],
  feather: ['...........kkk..', '..........kwxk..', '.........kwxxk..', '........kwxxk...', '.......kwxxXk...', '......kwxxXk....', '.....kwxxXk.....', '....kwxxXk......', '....kxxXk.......', '...kxxXk........', '...kxXk.........', '..kXkk..........', '..kk............', '.k..............', 'k...............', '................'],
  ore: ['................', '................', '......kkk.......', '.....kwxxk......', '....kwxxxXk.....', '...kwxxxxXXk....', '..kwxxxxxxXXk...', '..kxxwxxxxXXk...', '..kxxxxxxXXXk...', '...kxxxxXXXk....', '....kXXXXXk.....', '.....kkkkk......', '................', '................', '................', '................'],
  mat: ['................', '................', '................', '.......kkk......', '.....kkxxxk.....', '....kxwxxxxk....', '...kxwxxxxxXk...', '...kxxxxxxxXk...', '...kxxxxxxXXk...', '....kXxxxXXk....', '.....kkXXkk.....', '.......kk.......', '................', '................', '................', '................'],
  card: ['..kkkkkkkkkkk...', '..kYyyyyyyyYk...', '..kykkkkkkkyk...', '..kykxxxxxkyk...', '..kykxwxxxkyk...', '..kykxxxxxkyk...', '..kykxxxXxkyk...', '..kykxxxxxkyk...', '..kykkkkkkkyk...', '..kywywywywyk...', '..kyyyyyyyyyk...', '..kywywywyyyk...', '..kYyyyyyyyYk...', '..kkkkkkkkkkk...', '................', '................'],
};
const BASE = { k: '#241a2b', w: '#ffffff', O: '#8a5a32', o: '#6b4024', Y: '#c98b2b', y: '#f6c945' };
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * (1 + amt))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => f(c).toString(16).padStart(2, '0')).join('')}`;
}
const cache = new Map();
export function iconCanvas(shape, color) {
  const key = shape + color;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = 16; c.height = 16;
  const x = c.getContext('2d');
  const pal = { ...BASE, x: color, X: shade(color, -0.35) };
  pad(SHAPES[shape] || SHAPES.mat).forEach((row, y) => [...row].forEach((ch, i) => { if (pal[ch]) { x.fillStyle = pal[ch]; x.fillRect(i, y, 1, 1); } }));
  cache.set(key, c);
  return c;
}
const WEAPON_SHAPE = { sword: 'sword', bow: 'bow', staff: 'staff', fist: 'fist' };
const METAL = ['#b98a5a', '#9aa3b5', '#9fd0ff', '#c99bff', '#ffd75e'];
export function gearIcon(it, weaponType, rarityIdx) {
  const shape = it.slot === 'weapon' ? WEAPON_SHAPE[weaponType] || 'sword' : it.slot;
  return iconCanvas(shape, METAL[rarityIdx(it.rarity)]);
}
