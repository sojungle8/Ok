// 微光大陸：地圖生成與數值公式（純函式，可測試）
export const W = 40, H = 28;
export const T = { GRASS: 0, FLOWER: 1, PATH: 2, WATER: 3, TREE: 4, BRIDGE: 5, HOUSE: 6, FOUNTAIN: 7, SIGN: 8, ROCK: 9, PORTAL: 10 };
export const SOLID = new Set([T.WATER, T.TREE, T.HOUSE, T.FOUNTAIN, T.SIGN, T.ROCK]);
export const TOWN_EDGE = 18;           // x <= 18 是安全的村莊
export const FIELD_MIN_X = 21;         // 怪物只在河的東邊活動
export const BOSS_ZONE = { x0: 31, y0: 2, x1: 37, y1: 7 };

export function rng(seed) {
  let s = seed % 2147483647; if (s <= 0) s += 2147483646;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

export const HOUSES = [
  { x: 3, y: 3, roof: '#d0485a', roofD: '#8f2c3f', name: '雜貨店' },
  { x: 12, y: 3, roof: '#3f74d1', roofD: '#284c95', name: '村長家' },
  { x: 3, y: 20, roof: '#4f9a52', roofD: '#2f6b3a', name: '旅店' },
  { x: 12, y: 20, roof: '#8a5cc7', roofD: '#5b3a8f', name: '鐵匠鋪' },
];

export const NPCS = [
  { id: 'shop', x: 4, y: 7, name: '雜貨店・莉莉', look: { hair: '#e8a33d', hairD: '#b06f22', band: '#ff8fb1', bandD: '#d0587e', tunic: '#f3e2c3', tunicD: '#c9ad85' } },
  { id: 'elder', x: 13, y: 7, name: '村長・歐文', look: { hair: '#e8e4f0', hairD: '#b5b0c4', band: '#6b4fa0', bandD: '#46327a', tunic: '#8a5cc7', tunicD: '#5b3a8f' } },
  { id: 'inn', x: 4, y: 19, name: '旅店・瑪莎', look: { hair: '#c8553d', hairD: '#8f3626', band: '#f3e2c3', bandD: '#c9ad85', tunic: '#4f9a52', tunicD: '#2f6b3a' } },
  { id: 'smith', x: 13, y: 19, name: '鐵匠・葛倫', look: { hair: '#3b2a24', hairD: '#1f1512', band: '#6b6f85', bandD: '#454a5e', tunic: '#9a6337', tunicD: '#6b4024' } },
  { id: 'porter', x: 11, y: 16, name: '傳送師・小葵', look: { hair: '#7fd8ff', hairD: '#4aa3df', band: '#c084ff', bandD: '#8a5cc7', tunic: '#fff1c4', tunicD: '#c9ad85' } },
  { id: 'fisher', x: 18, y: 8, name: '釣客・阿杰', look: { hair: '#6b3e26', hairD: '#45261a', band: '#f6c945', bandD: '#c98b2b', tunic: '#4aa3df', tunicD: '#2d78b3' } },
];
export const SIGN = { x: 17, y: 12, text: ['→ 東邊：史萊姆草原', '小心！東北方的空地住著史萊姆王。'] };
export const SPAWN = { x: 9, y: 16 };
export const INN_SPOT = { x: 4, y: 18 };

export function buildWorld(seed = 11) {
  const g = Array.from({ length: H }, () => Array(W).fill(T.GRASS));
  const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const rect = (x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inb(x, y)) g[y][x] = t; };
  // 道路與廣場
  rect(2, 13, 37, 14, T.PATH);
  rect(5, 9, 15, 18, T.PATH);
  for (const h of HOUSES) rect(h.x + 1, h.y + 3, h.x + 1, 8, T.PATH);
  rect(4, 7, 4, 8, T.PATH); rect(13, 7, 13, 8, T.PATH);
  rect(16, 8, 18, 8, T.PATH); rect(16, 8, 16, 12, T.PATH);
  // 散布：村莊只有花，草原有樹石
  const r = rng(seed);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (g[y][x] !== T.GRASS) continue;
    const p = r();
    if (x <= TOWN_EDGE) { if (p < 0.14) g[y][x] = T.FLOWER; continue; }
    if (x >= FIELD_MIN_X) {
      if (Math.abs(y - 13.5) < 2.5) { if (p < 0.12) g[y][x] = T.FLOWER; continue; }
      if (p < 0.1) g[y][x] = T.TREE; else if (p < 0.13) g[y][x] = T.ROCK; else if (p < 0.22) g[y][x] = T.FLOWER;
    }
  }
  // 村莊外圍的樹籬
  for (let y = 1; y < H - 1; y++) if (y < 12 || y > 15) g[y][1] = T.TREE;
  // 河、橋
  rect(19, 0, 20, H - 1, T.WATER);
  rect(19, 13, 20, 14, T.BRIDGE);
  // 頭目空地
  rect(BOSS_ZONE.x0, BOSS_ZONE.y0, BOSS_ZONE.x1, BOSS_ZONE.y1, T.GRASS);
  rect(34, 8, 34, 12, T.PATH);
  // 外框
  for (let x = 0; x < W; x++) { if (x < 19 || x > 20) { g[0][x] = T.TREE; g[H - 1][x] = T.TREE; } }
  for (let y = 0; y < H; y++) { g[y][0] = T.TREE; g[y][W - 1] = T.TREE; }
  // 建築、噴水池、告示牌
  for (const h of HOUSES) rect(h.x, h.y, h.x + 2, h.y + 2, T.HOUSE);
  rect(9, 11, 10, 12, T.FOUNTAIN);
  g[SIGN.y][SIGN.x] = T.SIGN;
  return g;
}

export const walkable = (g, x, y) => x >= 0 && y >= 0 && x < W && y < H && !SOLID.has(g[y][x]);

export function reachable(g, from) {
  const seen = new Set([`${from.x},${from.y}`]);
  const q = [from];
  while (q.length) {
    const { x, y } = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (!seen.has(k) && walkable(g, nx, ny)) { seen.add(k); q.push({ x: nx, y: ny }); }
    }
  }
  return seen;
}

// ---- 數值（快節奏：幾刀一隻、幾十秒升一級）----
// 怪物：tpl = 造型模板，pal = 配色。第 2 章以後的數值用公式依等級產生。
const PAL = {
  dew: { g: '#62c7e8', G: '#2f7fb3', l: '#c4f2ff' }, berry: { g: '#e8628f', G: '#a3305d', l: '#ffc4d8', m: '#fff1a8', M: '#d9a63b' },
  ember: { g: '#ff8a3d', G: '#b34a1f', l: '#ffd29e', m: '#fff1a8', M: '#e8502e' }, king: { g: '#7ad35a', G: '#3a8a3a', l: '#d0ff9e' },
};
const mk = (name, tpl, pal, lv, zone, extra = {}) => ({
  name, tpl, pal, lv, zone, sight: 4,
  hp: Math.round(6 * lv + 0.35 * lv * lv), atk: Math.round(1.5 + 0.9 * lv + 0.012 * lv * lv),
  exp: Math.round(3 + 1.6 * lv + 0.05 * lv * lv), coin: [lv, lv * 2], ...extra,
});
const boss = (name, tpl, pal, lv, hp, atk, mech) => ({ name, tpl, pal, lv, hp, atk, mech, boss: true, sight: 6, exp: lv * 70, coin: [lv * 20, lv * 30] });
const ZA = [5, 16], ZB = [15, 27], ZC = [26, 37];
export const MONSTERS = {
  slime: { name: '露珠史萊姆', tpl: 'slime', pal: PAL.dew, hp: 8, atk: 2, exp: 4, coin: [2, 5], lv: 1, sight: 3, zone: [21, 28] },
  berry: { name: '莓果史萊姆', tpl: 'slime', pal: PAL.berry, hp: 24, atk: 5, exp: 12, coin: [5, 10], lv: 4, sight: 4, zone: [27, 33] },
  ember: { name: '餘燼史萊姆', tpl: 'slime', pal: PAL.ember, hp: 55, atk: 9, exp: 28, coin: [10, 18], lv: 7, sight: 4, zone: [32, 38] },
  king: { name: '史萊姆王', tpl: 'slime', pal: PAL.king, hp: 6000, atk: 18, exp: 600, coin: [150, 250], lv: 9, sight: 5, boss: true, mech: 'split' },
  bat: mk('回音蝙蝠', 'bat', { g: '#9b6be0', G: '#5b3a8f', l: '#d4b8ff', m: '#ffd1dc' }, 12, ZA),
  pebble: mk('碎石怪', 'golem', { g: '#c9a77a', G: '#8a6a44', l: '#efd8b0', m: '#ffe066' }, 15, ZB),
  howl: mk('嚎叫蝙蝠', 'bat', { g: '#e0533d', G: '#8f2c1f', l: '#ffb39c', m: '#fff1a8' }, 18, ZC),
  echo: boss('回音師', 'bat', { g: '#4b3a8f', G: '#2a1d5c', l: '#b48cff', m: '#7fd8ff' }, 22, 15000, 30, 'echo'),
  cog: mk('齒輪兵', 'golem', { g: '#9aa3b5', G: '#5d6475', l: '#d6dce8', m: '#ff6b6b' }, 22, ZA),
  spark: mk('電光精', 'ghost', { g: '#ffe066', G: '#c9a227', l: '#fff8c4', m: '#4aa3df' }, 25, ZB),
  smelter: mk('熔爐巨像', 'golem', { g: '#e8822f', G: '#9c4a1c', l: '#ffc48a', m: '#fff1a8' }, 28, ZC),
  clock: boss('時鐘匠', 'golem', { g: '#b08a3a', G: '#6b5020', l: '#f6d77a', m: '#7fd8ff' }, 32, 30000, 48, 'rewind'),
  wisp: mk('湖畔幽光', 'ghost', { g: '#7fd8ff', G: '#3b8fc4', l: '#e0f8ff', m: '#1b1420' }, 32, ZA),
  armor: mk('空洞鎧甲', 'golem', { g: '#c8d0e0', G: '#7a8399', l: '#ffffff', m: '#7fd8ff' }, 35, ZB),
  gargoyle: mk('石像鬼', 'bat', { g: '#8a8f9e', G: '#4f5361', l: '#c4c8d4', m: '#ff6b6b' }, 38, ZC),
  mirror: boss('鏡之夫人', 'ghost', { g: '#e8e4f0', G: '#9a8fc4', l: '#ffffff', m: '#c084ff' }, 42, 55000, 68, 'mirror'),
  crab: mk('紅鉗蟹', 'crab', { g: '#e0533d', G: '#8f2c1f', l: '#ffb39c', m: '#ff8a3d' }, 42, ZA),
  lantern: mk('燈籠鬼', 'ghost', { g: '#ff9f40', G: '#c45a1c', l: '#ffe0a8', m: '#d64550' }, 45, ZB),
  pirate: mk('霧港海盜', 'imp', { g: '#3fb3a8', G: '#1f6b64', l: '#a8ece4', m: '#d64550' }, 48, ZC),
  faceless: boss('千面商人', 'imp', { g: '#c9a227', G: '#6b5020', l: '#fff1a8', m: '#d64550' }, 52, 85000, 90, 'faceless'),
  cultist: mk('蝕夜信徒', 'imp', { g: '#6b4fb0', G: '#3a2a6b', l: '#c4b0f0', m: '#ff4d6d' }, 52, ZA),
  shade: mk('暗影', 'ghost', { g: '#3b3350', G: '#1f1a2e', l: '#6b5f8a', m: '#ff4d6d' }, 55, ZB),
  eclipse: mk('蝕月史萊姆', 'slime', { g: '#5b3a8f', G: '#2a1d5c', l: '#b48cff', m: '#ffe066', M: '#c9a227' }, 58, ZC),
  valde: boss('蝕夜教主・瓦爾德', 'imp', { g: '#2a1d3a', G: '#120c1c', l: '#6b4fb0', m: '#ff4d6d' }, 60, 140000, 115, 'steal'),
};
export const ROSTER = [...Array(10).fill('slime'), ...Array(8).fill('berry'), ...Array(6).fill('ember'), 'king'];

// ---- 章節 ----
export const CHAPTERS = [
  { n: 1, name: '史萊姆草原', theme: 'meadow', cap: 15, boss: 'king', kills: 20, mons: ['slime', 'berry', 'ember'] },
  { n: 2, name: '迴聲峽谷', theme: 'canyon', cap: 25, boss: 'echo', kills: 30, mons: ['bat', 'pebble', 'howl'], soul: 'post',
    guide: { name: '峽谷嚮導・露娜', look: { hair: '#f6c945', hairD: '#c98b2b', band: '#e0533d', bandD: '#8f2c1f', tunic: '#a0693a', tunicD: '#5e3a20' } },
    intro: ['你就是艾斯特家的人？峽谷裡的蝙蝠最近吵得要命。', '六十年前也有個帶齒輪的人來過，他說要去找「回音師」。', '先幫我清掉 30 隻怪物，我再告訴你回音師在哪。'],
    bossHint: ['回音師在峽谷東北角。', '牠會記住你的上一招，你連續用同一招，就會被原封不動打回來。', '記得每一招輪流用！'],
    report: ['回音師倒下的地方，留著這個……一枚生鏽的懷錶。'],
    memory: ['（懷錶的指針倒轉，畫面褪成褐色……）', '雷歐：「回音師，你只是被瓦爾德控制了。」', '雷歐：「千手郵差，把這封信送到工坊城，給我妻子艾莉絲。」', '（信件化成無數隻手，飛向遠方。）'] },
  { n: 3, name: '鏽齒工坊城', theme: 'factory', cap: 35, boss: 'clock', kills: 35, mons: ['cog', 'spark', 'smelter'], soul: 'thread',
    guide: { name: '工坊領班・鐵叔', look: { hair: '#3b2a24', hairD: '#1f1512', band: '#f6c945', bandD: '#c98b2b', tunic: '#5d6475', tunicD: '#3a3f4d' } },
    intro: ['工坊城的機器全部失控了，連時鐘塔都在倒著走。', '時鐘塔頂住著時鐘匠，他每隔幾秒就把時間倒轉回去。', '先幫我處理 35 隻暴走的機器。'],
    bossHint: ['時鐘匠每 10 秒會倒轉 3 秒，那 3 秒內你打的傷害會被抹掉，你的位置也會被拉回去。', '看到時鐘倒數，就停手等它轉完，再把大招一口氣丟出去！'],
    report: ['時鐘塔停下來了……你的曾祖母艾莉絲以前也在這裡工作過。'],
    memory: ['（工坊的齒輪聲慢慢停下，畫面褪成褐色……）', '艾莉絲：「白線裁縫，把城裡斷掉的線都縫起來。」', '艾莉絲：「雷歐沒有回來……但我們的孩子會繼續走下去。」'] },
  { n: 4, name: '鏡湖古堡', theme: 'castle', cap: 45, boss: 'mirror', kills: 40, mons: ['wisp', 'armor', 'gargoyle'], soul: 'bird',
    guide: { name: '古堡管家・賽巴', look: { hair: '#e8e4f0', hairD: '#b5b0c4', band: '#1b1420', bandD: '#000000', tunic: '#2a2338', tunicD: '#140f1c' } },
    intro: ['歡迎來到鏡湖古堡。主人……已經被鏡子吞掉了。', '堡裡到處是她召喚的幽魂，請先清掉 40 隻。'],
    bossHint: ['鏡之夫人會召喚三面魔鏡。', '魔鏡還在的時候，你的左右操作會顛倒，她也不會受傷。', '先打破所有魔鏡！'],
    report: ['夫人恢復成原本的樣子了……她留下一句話：「瓦爾德在霧港有眼線。」'],
    memory: ['（湖面泛起漣漪，畫面褪成褐色……）', '祖父卡爾：「玻璃夜鶯，唱吧，把鏡子裡的人都叫醒。」', '卡爾：「瓦爾德偷走的魂像，一共有一百隻。」'] },
  { n: 5, name: '霧港夜市', theme: 'harbor', cap: 55, boss: 'faceless', kills: 45, mons: ['crab', 'lantern', 'pirate'],
    guide: { name: '夜市老闆娘・阿月', look: { hair: '#d64550', hairD: '#8f2c3f', band: '#f6c945', bandD: '#c98b2b', tunic: '#3fb3a8', tunicD: '#1f6b64' } },
    intro: ['霧港夜市一到晚上就怪事不斷，海盜和燈籠鬼到處亂跑。', '聽說有個「千面商人」混在攤販裡，替瓦爾德收集情報。', '先清掉 45 隻，我幫你打聽他在哪。'],
    bossHint: ['千面商人會變成好幾個一模一樣的路人。', '真正的他「沒有影子」，仔細看腳下！', '打錯人會被反炸，小心。'],
    report: ['商人招了：瓦爾德就在東邊的蝕夜神殿，他在等最後一個艾斯特。'],
    memory: ['（燈籠一盞盞熄滅，畫面褪成褐色……）', '父親：「孩子，如果你看到這段記憶，代表我也失敗了。」', '父親：「瓦爾德會偷走你用過的魂像能力。不要依賴同一隻魂像。」'] },
  { n: 6, name: '蝕夜神殿', theme: 'temple', cap: 60, boss: 'valde', kills: 50, mons: ['cultist', 'shade', 'eclipse'],
    guide: { name: '神殿守衛・凱', look: { hair: '#c8d0e0', hairD: '#7a8399', band: '#6b4fb0', bandD: '#3a2a6b', tunic: '#8a8f9e', tunicD: '#4f5361' } },
    intro: ['我曾經是瓦爾德的守衛，現在只想看他倒下。', '神殿裡的信徒會拼命阻止你，先清掉 50 隻。'],
    bossHint: ['瓦爾德會偷走你用過的魂像大招，被偷走的大招對他無效。', '帶著不同的魂像輪流上，讓他偷不完！'],
    report: ['三百年的黑夜，結束了。'],
    memory: ['（星痕的光芒從神殿四面八方湧出……）', '雷歐、艾莉絲、卡爾和父親的身影一一浮現。', '雷歐：「做得好，最後的艾斯特。」', '被偷走的一百隻魂像化成流星，回到了大陸各地。', '— 微光大陸　完 —'] },
];
export const capFor = (p) => (p.ch > 6 ? 60 : CHAPTERS[Math.max(1, p.ch) - 1].cap);

// ---- 各章野外地圖 ----
export const FIELD = { portal: { x: 2, y: 13 }, guide: { x: 4, y: 11 }, spawn: { x: 3, y: 13 }, boss: { x0: 30, y0: 2, x1: 37, y1: 7 } };
export function buildField(ch, seed = 7) {
  const theme = CHAPTERS[ch - 1].theme;
  const g = Array.from({ length: H }, () => Array(W).fill(T.GRASS));
  const rect = (x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < W && y < H) g[y][x] = t; };
  const r = rng(seed * 31 + ch);
  if (theme === 'castle') { for (let y = 16; y <= 24; y++) for (let x = 12; x <= 28; x++) if (((x - 20) / 8.5) ** 2 + ((y - 20) / 4.5) ** 2 < 1) g[y][x] = T.WATER; }
  if (theme === 'harbor') rect(0, 22, W - 1, H - 1, T.WATER);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (g[y][x] !== T.GRASS) continue;
    const p = r();
    if (p < 0.08) g[y][x] = T.TREE; else if (p < 0.11) g[y][x] = T.ROCK; else if (p < 0.18) g[y][x] = T.FLOWER;
  }
  rect(1, 12, 36, 14, T.PATH);
  rect(33, 8, 34, 14, T.PATH);
  rect(1, 9, 6, 17, T.PATH);
  if (theme === 'castle') rect(19, 15, 21, 25, T.BRIDGE);
  rect(FIELD.boss.x0, FIELD.boss.y0, FIELD.boss.x1, FIELD.boss.y1, T.GRASS);
  for (let x = 0; x < W; x++) { if (g[0][x] !== T.WATER) g[0][x] = T.TREE; if (g[H - 1][x] !== T.WATER) g[H - 1][x] = T.TREE; }
  for (let y = 0; y < H; y++) { g[y][0] = T.TREE; g[y][W - 1] = T.TREE; }
  g[FIELD.portal.y][FIELD.portal.x] = T.PORTAL;
  return g;
}
export const expNeed = (lv) => Math.round(10 + lv * lv * 6 + 0.15 * lv * lv * lv);
export const baseHp = (lv) => 20 + lv * 8;
export const baseAtk = (lv) => 3 + lv * 2;
export const swordCost = (sword) => 30 + sword * 40 + sword * sword * 20;
export const POTION_PRICE = 15, POTION_HEAL_PCT = 0.5;

// ---- 職業 ----
export const CLASSES = {
  sword: {
    name: '劍士', color: '#ff5a6e', role: '近戰・坦克', desc: '揮劍橫掃前方三格，血量最厚，適合正面硬打。',
    hpMul: 1.35, atkMul: 1, cool: 0.24, range: 1, weapon: 'sword', helm: 'helm', hair: '#6b3e26',
    outfit: { main: '#c8404f', dark: '#7a2533', trim: '#f6c945' },
    skills: [{ id: 'spin', name: '旋風斬', cd: 4 }, { id: 'wave', name: '破空劍氣', cd: 6 }, { id: 'quake', name: '天崩斬', cd: 14 }],
    names: { weapon: ['木劍', '鐵劍', '騎士長劍', '龍牙劍', '星辰聖劍'], helm: ['布帽', '皮盔', '鐵盔', '翼盔', '王者之冠'] },
  },
  archer: {
    name: '弓手', color: '#6fd36a', role: '遠程・輸出', desc: '7 格外放箭，攻速快，可以邊退邊打。',
    hpMul: 0.95, atkMul: 1, cool: 0.28, range: 7, weapon: 'bow', helm: 'hood', hair: '#e8a33d',
    outfit: { main: '#4f9a52', dark: '#2f6b3a', trim: '#e8d29a' },
    skills: [{ id: 'triple', name: '三連射', cd: 3 }, { id: 'rain', name: '箭雨', cd: 8 }, { id: 'pierce', name: '穿雲箭', cd: 11 }],
    names: { weapon: ['短弓', '獵弓', '精靈長弓', '風神弓', '星辰之弓'], helm: ['布兜帽', '皮兜帽', '遊俠兜帽', '風之兜帽', '星辰兜帽'] },
  },
  mage: {
    name: '法師', color: '#b48cff', role: '範圍・爆發', desc: '自動追蹤的魔法彈，冰、火、雷三系大範圍魔法。',
    hpMul: 0.85, atkMul: 1.6, cool: 0.42, range: 5, weapon: 'staff', helm: 'hat', hair: '#d8e4ff',
    outfit: { main: '#6b4fb0', dark: '#3f2c7a', trim: '#7fd8ff' },
    skills: [{ id: 'nova', name: '冰霜新星', cd: 6 }, { id: 'fireball', name: '火球術', cd: 4 }, { id: 'chain', name: '雷霆鎖鏈', cd: 9 }],
    names: { weapon: ['木杖', '學徒法杖', '秘銀法杖', '龍晶法杖', '星辰權杖'], helm: ['尖帽', '學徒帽', '秘法帽', '星象帽', '賢者之冠'] },
  },
  monk: {
    name: '拳師', color: '#ffa94d', role: '近戰・連打', desc: '攻速是劍士的兩倍，貼身之後就停不下來。',
    hpMul: 1.15, atkMul: 0.62, cool: 0.13, range: 1, weapon: 'fist', helm: 'band', hair: '#2b2230',
    outfit: { main: '#f08a3c', dark: '#9c4f1c', trim: '#fff1c4' },
    skills: [{ id: 'barrage', name: '百裂拳', cd: 5 }, { id: 'shock', name: '震地波', cd: 7 }, { id: 'dragon', name: '昇龍擊', cd: 11 }],
    names: { weapon: ['布手套', '皮拳套', '鐵拳套', '龍爪拳套', '星辰拳套'], helm: ['頭帶', '皮頭帶', '鐵頭帶', '龍紋頭帶', '星辰頭帶'] },
  },
};
export const CLASS_IDS = Object.keys(CLASSES);

// ---- 天賦樹：三條分支，每格最多 3 點；第 2、3 格要先在該分支投 2、4 點 ----
export const TALENTS = [
  { id: 'atk', name: '攻擊', nodes: [
    { id: 'might', name: '力量', desc: '攻擊力 +5%' },
    { id: 'precision', name: '精準', desc: '暴擊率 +3%' },
    { id: 'ferocity', name: '兇猛', desc: '暴擊傷害 +15%' }] },
  { id: 'guard', name: '生存', nodes: [
    { id: 'vigor', name: '體魄', desc: '生命 +6%' },
    { id: 'recover', name: '恢復', desc: '藥水回復 +10%，每秒回血 +0.3%' },
    { id: 'iron', name: '鐵壁', desc: '受到傷害 -5%' }] },
  { id: 'arts', name: '技藝', nodes: [
    { id: 'haste', name: '迅捷', desc: '攻擊速度 +5%' },
    { id: 'focus', name: '專注', desc: '技能冷卻 -5%' },
    { id: 'resonance', name: '共鳴', desc: '魂力累積 +15%' }] },
];
export const TALENT_MAX = 3, TALENT_REQ = [0, 2, 4];
export const talentPoints = (p) => Math.max(0, p.lv - 1);
export const talentSpent = (p) => Object.values(p.talents || {}).reduce((a, b) => a + b, 0);
export function canLearn(p, branchIdx, nodeIdx) {
  const br = TALENTS[branchIdx], node = br?.nodes[nodeIdx];
  if (!node) return false;
  const cur = p.talents[node.id] || 0;
  const inBranch = br.nodes.reduce((a, n) => a + (p.talents[n.id] || 0), 0);
  return cur < TALENT_MAX && talentSpent(p) < talentPoints(p) && inBranch >= TALENT_REQ[nodeIdx];
}
export function learn(p, branchIdx, nodeIdx) {
  if (!canLearn(p, branchIdx, nodeIdx)) return false;
  const id = TALENTS[branchIdx].nodes[nodeIdx].id;
  p.talents[id] = (p.talents[id] || 0) + 1;
  return true;
}
export function resetTalents(p) { p.talents = {}; }

// ---- 魂像 ----
export const SOULS = {
  gear: { name: '鏽紅齒輪', type: '規則型', color: '#e0533d', color2: '#ffb35c', passive: '技能冷卻 -12%', ult: '時間倒轉：3 格內的敵人被拉回原位並凍結 2.5 秒，受到 4 倍傷害', sfx: '喀嚓喀嚓', story: true },
  post: { name: '千手郵差', type: '遠隔型', color: '#4fa3ff', color2: '#fff1a8', passive: '暴擊率 +8%', ult: '郵件轟炸：畫面內所有敵人被貼上信件，1.5 秒後同時爆炸，5 倍傷害', sfx: '咻咻咻' },
  magnet: { name: '磁極兄弟', type: '力量型', color: '#b48cff', color2: '#ff6b8a', passive: '攻擊 +8%，撿東西範圍變大', ult: '先把 4 格內的敵人吸到身邊，再一口氣彈飛，4.5 倍傷害', sfx: '嗡嗡嗡' },
  thread: { name: '白線裁縫', type: '規則型', color: '#e8e4f0', color2: '#ff6b8a', passive: '生命 +10%', ult: '縫合：把 5 格內的敵人縫在一起，先造成 3.5 倍傷害，0.8 秒後再共享 2 倍傷害', sfx: '咻啪咻啪', story: true },
  bird: { name: '玻璃夜鶯', type: '遠隔型', color: '#7fd8ff', color2: '#ffffff', passive: '魂力累積 +20%', ult: '玻璃之歌：5 格內敵人暈眩 3 秒，並受到 3 倍傷害', sfx: '鈴鈴鈴', story: true },
  cat: { name: '午夜黑貓', type: '力量型', color: '#3b3350', color2: '#ffe066', passive: '受到致命傷時復活一次（冷卻 3 分鐘）', ult: '九命爪擊：在身邊連斬 9 次，每次 1 倍傷害', sfx: '喵喵喵' },
};
export const SOUL_IDS = Object.keys(SOULS);
export const SUMMON_COST = 100, SUMMON_SOUL_RATE = 0.25, SUMMON_PITY = 8, SOUL_MAX_STAR = 5;
// 召喚：25% 抽到魂像（三隻平均），第 8 抽保底；重複的魂像升星
export function summon(p, rand) {
  if (p.stones < SUMMON_COST) return { ok: false, reason: `魂石不足（需要 ${SUMMON_COST}）` };
  p.stones -= SUMMON_COST;
  p.pity = (p.pity || 0) + 1;
  const pool = SOUL_IDS.filter((id) => !SOULS[id].story);
  if (p.pity >= SUMMON_PITY || rand() < SUMMON_SOUL_RATE) {
    p.pity = 0;
    const id = pool[Math.floor(rand() * pool.length)];
    const had = p.souls[id] || 0;
    if (had >= SOUL_MAX_STAR) { p.coins += 500; return { ok: true, kind: 'soul', id, star: had, maxed: true, coins: 500 }; }
    p.souls[id] = had + 1;
    return { ok: true, kind: 'soul', id, star: had + 1, isNew: !had };
  }
  const coins = 150 + Math.floor(rand() * 250);
  p.coins += coins; p.potions += 1;
  return { ok: true, kind: 'loot', coins };
}

export function stats(p) {
  const c = CLASSES[p.cls] || CLASSES.sword;
  const t = p.talents || {};
  const tv = (id) => t[id] || 0;
  const aff = { crit: 0, aspd: 0, skill: 0, leech: 0, hpPct: 0, soul: 0 };
  let atk = (baseAtk(p.lv) + p.sword * 3) * c.atkMul, hp = baseHp(p.lv) * c.hpMul;
  for (const it of Object.values(p.gear || {})) {
    if (!it) continue;
    if (it.stat === 'atk') atk += it.val * c.atkMul; else hp += it.val;
    for (const a of it.affixes || []) if (a.id in aff) aff[a.id] += a.val;
  }
  const soul = p.soul && p.souls?.[p.soul] ? p.soul : null;
  atk *= 1 + 0.05 * tv('might') + (soul === 'magnet' ? 0.08 : 0);
  hp *= 1 + 0.06 * tv('vigor') + aff.hpPct / 100 + (soul === 'thread' ? 0.1 : 0) + (p.cardBonus?.hpPct || 0) / 100;
  const crit = Math.min(0.75, 0.1 + 0.03 * tv('precision') + aff.crit / 100 + (soul === 'post' ? 0.08 : 0));
  const critDmg = 2 + 0.15 * tv('ferocity');
  const aspd = 1 + 0.05 * tv('haste') + aff.aspd / 100;
  const cdr = Math.min(0.5, 0.05 * tv('focus') + (soul === 'gear' ? 0.12 : 0));
  atk = Math.round(atk); hp = Math.round(hp);
  const dps = (atk * aspd / c.cool) * (1 + crit * (critDmg - 1));
  return {
    atk, hp, crit, critDmg, aspd, cdr,
    skill: 1 + aff.skill / 100, leech: aff.leech / 100, soulGain: 1 + 0.15 * tv('resonance') + aff.soul / 100 + (soul === 'bird' ? 0.2 : 0),
    dr: 0.05 * tv('iron'), regen: 0.003 * tv('recover'), potion: 0.5 + 0.1 * tv('recover'),
    cp: Math.round(dps * 3 + hp * 3 + p.lv * 20 + (soul ? 150 * (p.souls[soul] || 1) : 0)),
  };
}

export const RARITY = [
  { id: 'common', name: '普通', color: '#e8e4f0', w: 58, mult: 1 },
  { id: 'good', name: '優良', color: '#7ad35a', w: 26, mult: 1.4 },
  { id: 'rare', name: '稀有', color: '#4fb3ff', w: 11, mult: 2 },
  { id: 'epic', name: '史詩', color: '#c084ff', w: 4, mult: 2.9 },
  { id: 'legend', name: '傳說', color: '#ffb03b', w: 1, mult: 4.2 },
];
export const rarityIdx = (id) => Math.max(0, RARITY.findIndex((r) => r.id === id));
const GEAR = {
  weapon: { stat: 'atk', v: 2 },
  helm: { stat: 'hp', v: 5 },
  armor: { stat: 'hp', v: 8, names: ['布衣', '皮甲', '鎖子甲', '騎士鎧', '星辰戰鎧'] },
  gloves: { stat: 'atk', v: 1.2, names: ['布護腕', '皮護腕', '鐵護腕', '龍鱗護腕', '星辰護腕'] },
  boots: { stat: 'hp', v: 4, names: ['布鞋', '皮靴', '鐵靴', '疾風靴', '星辰戰靴'] },
  ring: { stat: 'atk', v: 1, names: ['銅戒', '銀戒', '紅玉戒', '龍眼戒', '星辰之戒'] },
};
export const SLOTS = ['weapon', 'helm', 'armor', 'gloves', 'boots', 'ring'];
export const SLOT_NAME = { weapon: '武器', helm: '頭部', armor: '身體', gloves: '手部', boots: '腳部', ring: '飾品' };
export const DROP_RATE = 0.22;
export const AFFIXES = [
  { id: 'crit', name: '暴擊率', lo: 3, hi: 8 },
  { id: 'aspd', name: '攻擊速度', lo: 4, hi: 10 },
  { id: 'skill', name: '技能傷害', lo: 6, hi: 15 },
  { id: 'leech', name: '吸血', lo: 1, hi: 3 },
  { id: 'hpPct', name: '生命', lo: 4, hi: 10 },
  { id: 'soul', name: '魂力累積', lo: 8, hi: 20 },
];
export const affixName = (id) => AFFIXES.find((a) => a.id === id)?.name || id;

export function rollGear(rand, mlv, boss = false, cls = 'sword') {
  const slot = SLOTS[Math.floor(rand() * SLOTS.length)];
  const pool = boss ? RARITY.slice(2) : RARITY;
  let t = rand() * pool.reduce((a, r) => a + r.w, 0);
  let rar = pool[0];
  for (const r of pool) { t -= r.w; if (t < 0) { rar = r; break; } }
  const g = GEAR[slot];
  const names = g.names || (CLASSES[cls] || CLASSES.sword).names[slot];
  const tier = rarityIdx(rar.id);
  // 稀有 1 條、史詩 2 條、傳說 3 條隨機詞綴，不重複
  const left = [...AFFIXES], affixes = [];
  for (let i = 0; i < Math.max(0, tier - 1); i++) {
    const a = left.splice(Math.floor(rand() * left.length), 1)[0];
    affixes.push({ id: a.id, val: a.lo + Math.floor(rand() * (a.hi - a.lo + 1)) });
  }
  return { slot, rarity: rar.id, name: names[tier], stat: g.stat, val: Math.max(1, Math.round(g.v * (1 + mlv * 0.7) * rar.mult)), lv: mlv, affixes };
}
export const itemPower = (it) => it.val * (1 + 0.12 * (it.affixes?.length || 0));
export const rarityOf = (id) => RARITY.find((r) => r.id === id) || RARITY[0];
export const sellValue = (it) => Math.max(1, Math.round(it.val * 1.5));

export function equipIfBetter(p, it) {
  const cur = p.gear[it.slot];
  if (!cur || itemPower(it) > itemPower(cur)) {
    const before = stats(p).cp;
    p.gear[it.slot] = it;
    return { equipped: true, before, after: stats(p).cp };
  }
  const sold = sellValue(it);
  p.coins += sold;
  return { equipped: false, sold };
}

export const FISH = [
  { id: 'carp', name: '小鯽魚', weight: 60, price: 3 },
  { id: 'trout', name: '彩虹鱒', weight: 30, price: 8 },
  { id: 'gold', name: '黃金鯉', weight: 10, price: 25 },
];
export function rollFish(rand) {
  let t = rand() * FISH.reduce((a, f) => a + f.weight, 0);
  for (const f of FISH) { t -= f.weight; if (t < 0) return f; }
  return FISH[0];
}

export const LV_CAP = 60;
export function gainExp(p, amount) {
  p.exp += amount;
  let ups = 0;
  const cap = capFor(p);
  while (p.lv < cap && p.exp >= expNeed(p.lv)) { p.exp -= expNeed(p.lv); p.lv++; ups++; }
  if (p.lv >= cap) p.exp = 0;
  if (ups) p.hp = stats(p).hp;
  return ups;
}

// ---- 離線掛機：最多 12 小時，效率約為在線的 60% ----
export const OFFLINE_MAX_MIN = 720;
export function offlineReward(p, minutes, rand) {
  const mins = Math.min(OFFLINE_MAX_MIN, Math.floor(minutes));
  if (mins < 1) return null;
  const open = CHAPTERS.filter((c) => c.n <= Math.min(6, p.ch || 1)).flatMap((c) => c.mons);
  const zone = open.map((k) => MONSTERS[k]).filter((m) => m.lv <= p.lv).sort((a, b) => b.lv - a.lv)[0] || MONSTERS.slime;
  const kills = Math.floor(mins * 4);
  const exp = kills * zone.exp;
  const coins = Math.round(kills * (zone.coin[0] + zone.coin[1]) / 2);
  const items = [];
  for (let i = 0; i < Math.min(8, Math.floor(kills * 0.01)); i++) items.push(rollGear(rand, zone.lv, false, p.cls));
  return { mins, kills, exp, coins, items, zone: zone.name };
}

export function newPlayer(cls = 'sword', name = '冒險者') {
  const p = { v: 4, cls: CLASSES[cls] ? cls : 'sword', name: String(name).slice(0, 8) || '冒險者', lv: 1, exp: 0, hp: 0, coins: 0, potions: 3, sword: 0, gear: {}, fish: {}, kills: 0, quest: 0, ch: 1, step: 0, talents: {}, souls: {}, soul: '', stones: 0, pity: 0, seen: 0, x: SPAWN.x, y: SPAWN.y };
  p.hp = stats(p).hp;
  return p;
}

const validItem = (it) => it && SLOTS.includes(it.slot) && typeof it.val === 'number' && (it.stat === 'atk' || it.stat === 'hp') && typeof it.name === 'string';

export function loadPlayer(raw) {
  try {
    const p = JSON.parse(raw);
    if (!p || ![1, 2, 3, 4].includes(p.v) || !Number.isInteger(p.lv) || p.lv < 1) throw 0;
    const d = newPlayer(p.cls, p.name);
    for (const k of Object.keys(d)) if (typeof p[k] !== typeof d[k] || p[k] === null) p[k] = d[k];
    if (p.v < 4 || !raw.includes('"ch"')) { p.ch = p.quest >= 4 ? 2 : 1; p.step = p.quest >= 4 ? 0 : Math.min(3, p.quest); }
    p.ch = Math.max(1, Math.min(7, p.ch)); p.step = Math.max(0, Math.min(3, p.step));
    p.v = 4;
    for (const it of Object.values(p.gear)) if (it && typeof it === 'object' && !Array.isArray(it.affixes)) it.affixes = [];
    for (const k of Object.keys(p.souls)) if (!SOULS[k]) delete p.souls[k];
    if (p.soul && !p.souls[p.soul]) p.soul = '';
    if ((p.ch > 1 || p.step >= 2) && !p.souls.gear) { p.souls.gear = 1; if (!p.soul) p.soul = 'gear'; } // 已過覺醒劇情就補發魂像
    if (!CLASSES[p.cls]) p.cls = 'sword';
    for (const k of Object.keys(p.gear)) if (!SLOTS.includes(k) || !validItem(p.gear[k])) delete p.gear[k];
    p.hp = Math.min(Math.max(1, p.hp), stats(p).hp);
    return p;
  } catch { return newPlayer(); }
}
