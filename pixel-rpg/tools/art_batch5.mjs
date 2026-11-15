// 第五批：逐格像素動畫（8 方向）。node tools/art_batch5.mjs → art/batch5/README.md、request.json
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { layout, DRAWN, DIR_NAME, KINDS, monKind, sheetPath, ramp, TIER_OUTFIT } from '../spritesheet.js';
import { CLASSES, NPCS, CHAPTERS } from '../world.js';
import { BESTIARY } from '../bestiary.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'art', 'batch5');
mkdirSync(OUT, { recursive: true });
const have = (p) => existsSync(join(ROOT, 'assets', p + '.png'));

const ACT = {
  idle: '待機（呼吸：身體上下 1 像素、頭髮與衣擺輕微晃）', walk: '走路（8 格＝兩步：著地→下沉→交錯→抬起，左右腳各一次；手臂和腳反向擺；頭上下 1 像素；頭髮、披風晚 1 格跟上）',
  attack: '攻擊（預備→蓄力→出手〔第 hit 格是命中瞬間〕→收招→回位）', cast: '施法（舉起武器→光聚集的姿勢→放出→回位；光效不要畫）',
  hurt: '受傷（往後縮、閉眼）', down: '倒地（跪下→倒下→躺平）', sit: '坐下休息', die: '死亡（倒下、縮小、散開，最後一格可以接近透明的剪影）',
};
const HERO_ATK = { sword: '單手劍橫斬', archer: '拉弓→放箭（箭不要畫）', mage: '法杖前指', priest: '法杖舉高、輕點前方', monk: '右直拳（第 3 格拳頭最遠）', scout: '雙短刀交叉連刺' };

const req = [];
const sheet = (group, kind, id, name, look, extra = '') => {
  const L = layout(kind), path = sheetPath(kind, id);
  if (have(path)) return;
  const anims = Object.entries(L.anims).map(([k, a]) => `${k} ${a.n} 格（第 ${L.col[k] + 1}～${L.col[k] + a.n} 欄${a.hit ? `，命中＝第 ${a.hit} 格` : ''}）`).join('、');
  req.push({ group, kind, id, name, path: path + '.png', size: `${L.w}×${L.h}`, cell: `${L.cell[0]}×${L.cell[1]}`, foot: L.foot, height: L.height, anims, look, extra });
};

for (const [id, c] of Object.entries(CLASSES)) {
  const pal = [...ramp(c.outfit.main), ...ramp(c.outfit.trim)];
  sheet('A 冒險者', 'hero', id, c.name, `${c.desc} 武器：${c.names.weapon[0]}。攻擊：${HERO_ATK[id]}。`, `衣服主色只能用 ${pal.slice(0, 4).join(' ')}（亮→暗），配色只能用 ${pal.slice(4).join(' ')}；程式會換成優良～傳說的顏色。髮色 ${c.hair}。`);
}
const npcs = [...NPCS, ...CHAPTERS.filter((c) => c.guide).map((c) => ({ id: 'guide' + c.n, name: c.guide.name, look: c.guide.look }))];
for (const n of npcs) sheet('B NPC', 'npc', n.id, n.name, `髮色 ${n.look?.hair || ''}、衣服 ${n.look?.tunic || ''}、配色 ${n.look?.band || ''}`);
for (const b of Object.values(BESTIARY)) {
  if (b.night) continue;
  const id = b.id === 'valde_f' ? 'valde' : b.id;
  sheet(b.arch === 'boss' ? 'D 魔王' : 'C 怪物', monKind({ boss: b.arch === 'boss', size: b.size }), id, b.name, `${b.region}・${b.race}・${b.elem}屬性・${b.size}。特性：${b.trait}`, have(`monster/${id}`) ? `造型照已交付的 monster/${id}.png` : '');
}

const kinds = Object.entries(KINDS).map(([k]) => { const L = layout(k); return `| ${k} | ${L.cell[0]}×${L.cell[1]} | ${L.foot} | ${L.height} | ${Object.entries(L.anims).map(([a, v]) => `${a} ${v.n}`).join('、')} | ${L.w}×${L.h} |`; });
const groups = [...new Set(req.map((r) => r.group))];
const md = [
  '# 第五批：類 RO 逐格像素動畫（8 方向）', '',
  '> `node tools/art_batch5.mjs` 產生；已交付的圖自動跳過。格子位置與尺寸以 `spritesheet.js` 為準。', '',
  '## 畫風', '',
  '- **定案（2026-11-15）**：地圖上的角色一律用逐格像素動畫，做法和 RO 一樣（每個動作一格一格手繪、8 方向、腳步跟位移同步）；**造型、比例細節、配色、服裝全部是本作原創**，不能畫成 RO 的角色或職業。',
  '- **畫風標準（2026-11-15 確認）**：`assets/sprite/hero/sword.png`（戰士）已通過，其他職業、NPC、怪物、魔王都照這張的頭身比例、五官畫法、外框、明暗階數、動作幅度來畫。',
  '- 精緻立繪（`hero/`、`npc/`、`monster/`、`portrait/`）保留給對話頭像、背包裝備預覽、魔王登場與大招特寫；地圖上不再用立繪。既有立繪可以當造型參考，像素版要看得出是同一個角色。',
  '- **本作原創**的 Q 版像素角色：約 2.5～3 頭身，頭大、眼睛清楚。參考的是「逐格手繪像素動畫」這種做法，不要模仿任何其他遊戲的角色、職業外觀或配色。',
  '- 真正的像素畫：不反鋸齒、不半透明、不模糊、不從大圖縮小，以原生尺寸交付。外框 1 像素 #2a1d2e，亮部可用淺一點的外框。光源左上，每種材質 3～4 階明暗。一張圖 48 色以內。',
  '- **五官**：冒險者與 NPC 的眼睛至少 4×5 像素，有瞳孔、高光點、上眼線；嘴巴、眉毛看得出表情。每一格五官位置一致，不要忽大忽小。',
  '- **動作要順**：每一格都是重畫的姿勢，不是把同一張圖旋轉、拉伸、位移。身體體積每格一致；腳底永遠踩在「腳底線」上（走路著地那幾格要剛好貼線）；水平置中在格子中線。',
  '- 不要畫刀光、箭、法術光、影子（遊戲另外加）。', '',
  '## 方向與排列', '',
  `- 每張圖 ${DRAWN.length} 列，由上到下：${DRAWN.map((d) => `${DIR_NAME[d]}（${d}）`).join('、')}。右前、右側、右後由程式左右鏡像，不用畫。`,
  '- 每列由左到右是所有動作的格子接在一起，順序與格數見下表。斜向（左前、左後）是 45 度視角，不是正側面。', '',
  '| 類別 | 格子 | 腳底線（從上數第幾像素） | 角色高度 | 動作與格數 | 整張尺寸 |', '|---|---|---|---|---|---|', ...kinds, '',
  '怪物依圖鑑體型：小型 monS、中型 monM、大型 monL；魔王 boss。',
  '', '## 動作說明', '', ...Object.entries(ACT).map(([k, v]) => `- **${k}**：${v}`), '',
  '## 冒險者換色規則', '',
  `每個職業只畫一張「普通」裝備的圖。衣服主色與配色只能用規定的 4 階色碼（每階就是那一個色碼），程式會換成：${TIER_OUTFIT.slice(1).map((t, i) => `${['優良', '稀有', '史詩', '傳說'][i]} ${t.main}／${t.trim}`).join('、')}。皮膚、頭髮、武器不換。`, '',
  '## 交件檢查', '', '`python3 tools/check_sheet.py <檔案們>`：檢查尺寸、透明背景、腳底線、置中、顏色數、換色色碼。直到「✓ 全部通過」。', '',
  '## 優先順序', '', '1. A 冒險者 6 張（先交「戰士」一張確認畫風，再做其他）', '2. B NPC', '3. D 魔王 6 張', '4. C 怪物（依章節順序）', '',
  `共 ${req.length} 張：${groups.map((g) => `${g} ${req.filter((r) => r.group === g).length}`).join('、')}`, '',
];
for (const g of groups) {
  md.push(`## ${g}`, '', '| 檔案 | 整張 | 格子 | 名稱 | 外型 | 備註 |', '|---|---|---|---|---|---|');
  for (const r of req.filter((x) => x.group === g)) md.push(`| \`${r.path}\` | ${r.size} | ${r.cell} | ${r.name} | ${r.look.replace(/\|/g, '／')} | ${r.extra.replace(/\|/g, '／')} |`);
  md.push('');
}
writeFileSync(join(OUT, 'README.md'), md.join('\n'));
writeFileSync(join(OUT, 'request.json'), JSON.stringify({ count: req.length, kinds: Object.fromEntries(Object.keys(KINDS).map((k) => [k, layout(k)])), assets: req }, null, 1));
console.log('art/batch5:', req.length, Object.fromEntries(groups.map((g) => [g, req.filter((r) => r.group === g).length])));
