// 產生第四批美術需求：node tools/art_batch4.mjs
// 從圖鑑（bestiary.js）與技能表（skilldata.js）自動列出還缺的圖，輸出 art/batch4/README.md 與 request.json
import { readdirSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BESTIARY } from '../bestiary.js';
import { SKILLS, ROUTES, CLASS_NAME } from '../skilldata.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'art', 'batch4');
const have = (p) => existsSync(join(ROOT, 'assets', p));
mkdirSync(OUT, { recursive: true });

const STYLE = 'High-quality 2D game asset for a mobile fantasy RPG, chibi anime style, clean cel shading with soft gradient highlights, crisp dark-brown outline (#2a1d2e), vibrant but harmonious palette, light from top-left, transparent background, centered, no text, no watermark, original design.';
const WORLD = '世界觀：長夜燈火。三百年的長夜吞掉了人和地方的名字，守燈人用燈火守住名字。怪物多半是「失去名字的東西」：有點哀傷、有點可愛，不血腥。';
const ELEM_LOOK = { 無: '原色、樸素', 水: '水藍、透明水光', 地: '土黃褐色、岩石紋理', 火: '橘紅、火星與熱氣', 風: '淡綠、飄動的線條與羽毛', 毒: '紫綠、滴落的毒液', 聖: '白金、柔和光暈', 暗: '深紫黑、紅色眼光', 念: '淡藍紫、半透明、浮動符文', 不死: '灰白骨色、青綠幽光' };
const SIZE_LOOK = { 小型: '小巧圓潤，約佔畫布 55%', 中型: '中等體型，約佔畫布 70%', 大型: '高大厚重，約佔畫布 85%，有壓迫感' };
const ARCH_LOOK = { swarm: '一群裡的一隻，造型簡單好認', normal: '標準怪物', tank: '外殼厚重、防禦感', agile: '輕盈、動作感強', caster: '帶法器或符文，會施法', ranged: '會從遠處攻擊（吐、射、丟）', big: '體型巨大的強敵', boss: '魔王' };
const REGION_THEME = { 守燈草原: 'meadow', 迴聲峽谷: 'canyon', 鏽齒工坊城: 'factory', 鏡湖古堡: 'castle', 霧港夜市: 'harbor', 蝕夜神殿: 'temple' };

const req = [];
const add = (group, path, size, hint, prompt) => req.push({ group, path, size, hint, prompt: `${STYLE}\n${prompt}` });

// ---- A. 怪物（沒有圖的一般怪）----
const mons = Object.values(BESTIARY).filter((b) => !b.night && b.arch !== 'boss');
for (const b of mons) {
  if (have(`monster/${b.id}.png`)) continue;
  const hint = `${b.name}（${b.region}・Lv${b.lv}・${b.race}・${b.elem}屬性・${b.size}・${b.archName}）特性：${b.trait}`;
  const prompt = `Monster for region "${REGION_THEME[b.region]}". Name: ${b.name}. Race: ${b.race}. Element look: ${ELEM_LOOK[b.elem]}. Size: ${SIZE_LOOK[b.size]}. Role: ${ARCH_LOOK[b.arch]}. Trait: ${b.trait}. Facing the camera, full body, single creature, cute-but-slightly-sad "lost its name" feeling, not gory.`;
  add('A 怪物', `monster/${b.id}.png`, '256×256', hint, prompt);
  add('A 怪物', `monster/${b.id}_attack.png`, '256×256', `${b.name} 攻擊姿勢（同一隻、同畫布、腳底同高）`, `${prompt}\nAttack pose: same creature, same canvas and scale, lunging forward at the peak of its attack. No effects or speed lines.`);
  add('E 素材圖示', `icon/mat_${b.id}.png`, '128×128', `${b.matA}（${b.name}的素材）`, `Inventory icon: "${b.matA}", a material dropped by ${b.name}. Object only, no creature.`);
}

// ---- B. 斥候（第六職業）----
const SCOUT = '斥候：夜行者。在長夜裡替守燈人探路、躲在影子裡出手。雙持短刀、深色連帽短斗篷、輕皮甲、腰間掛小毒瓶與燈芯，影子會比本人長。俐落、安靜，不要像其他遊戲的刺客或忍者。';
const TIERS = { common: '布與舊皮革，素色', good: '補強的皮甲、銅扣', rare: '藍灰夜色斗篷、銀刃', epic: '紫黑斗篷、刀刃有淡紫影光', legend: '星夜斗篷內襯星點、刀刃拖著影子的光' };
for (const [t, look] of Object.entries(TIERS)) for (const dir of ['front', 'side', 'back']) {
  const base = `hero/scout_${t}_${dir}`;
  if (have(base + '.png')) continue;
  const p = `Player character, ${SCOUT} Gear tier: ${look}. View: ${dir === 'side' ? 'side view facing right' : dir}. Full body, same proportions as other hero sheets (hero/sword_${t}_${dir}.png).`;
  add('B 斥候', `${base}.png`, '512×512', `斥候 ${t}（${look}）${dir}`, p);
  add('B 斥候', `${base}_attack.png`, '512×512', `斥候 ${t} ${dir} 攻擊`, `${p}\nAttack pose: dual daggers at full extension, low stance.`);
  add('B 斥候', `${base}_walk.png`, '1024×512', `斥候 ${t} ${dir} 走路兩格`, `${p}\nWalk cycle: two frames side by side (left half = left foot forward, right half = right foot forward).`);
}
if (!have('portrait/hero_scout.png')) add('B 斥候', 'portrait/hero_scout.png', '512×512', '斥候半身像（選職業畫面、對話）', `Bust portrait. ${SCOUT}`);

// ---- C. 技能圖示（171 個）----
const OWNER = Object.fromEntries([...Object.entries(CLASS_NAME), ...Object.values(ROUTES).flat().map((r) => [r.id, r.name])]);
const SHAPE = { melee: '單體近戰斬擊', spin: '繞身旋轉', barrage: '連續拳擊', shock: '前方震波', quake: '震地', wave: '向前飛出的光刃', shot: '單發射擊', fan: '扇形多發', bigshot: '蓄力重箭', fireball: '火球爆炸', rain: '從天而降', trap: '地上陷阱', ground: '地面法陣', nova: '以自己為中心爆開', chain: '連鎖跳躍', dash: '突進', veil: '隱身影子', screen: '屏障', taunt: '挑釁', heal: '治療', healAoe: '範圍治療', shield: '護盾', leap: '跳躍落地', blink: '瞬移' };
const KIND = { pas: '被動（不會發光的徽章感）', act: '主動攻擊', buff: '增益', debuff: '減益', heal: '治療' };
for (const s of SKILLS) {
  if (have(`ui/skill_${s.id}.png`)) continue;
  const look = [KIND[s.kind] || s.kind, SHAPE[s.shape], s.elem && `${s.elem}屬性（${ELEM_LOOK[s.elem]}）`].filter(Boolean).join('、');
  add('C 技能圖示', `ui/skill_${s.id}.png`, '128×128', `${s.name}（${OWNER[s.owner] || s.owner}）${look}`, `Skill icon for "${s.name}", class ${OWNER[s.owner] || s.owner}. Concept: ${look}. Square icon, bold readable symbol, rounded frame, no text.`);
}

// ---- D. 新系統道具 ----
const ITEM_ICONS = [
  ['icon/nameShard', '名字碎片：發著淡紫光、像碎掉的名牌或羊皮紙片，上面有看不清的字跡（不要真的寫字）'],
  ['icon/nameBox', '封名匣：深紫色小木匣，有銀色封條與燈芯形鎖，縫隙透出光'],
  ...['gear', 'post', 'magnet', 'thread', 'bird', 'cat'].map((id) => [`icon/shard_${id}`, `魂像碎片（${id}）：對應魂像顏色的發光碎片，形狀帶一點魂像特徵`]),
];
for (const [p, hint] of ITEM_ICONS) if (!have(p + '.png')) add('D 新道具', `${p}.png`, '128×128', hint, `Inventory icon: ${hint}. Object only.`);

// ---- 輸出 ----
writeFileSync(join(OUT, 'request.json'), JSON.stringify({ world: WORLD, style: STYLE, count: req.length, assets: req }, null, 1));
const groups = [...new Set(req.map((r) => r.group))];
const md = [
  '# 第四批美術需求（長夜燈火改版）', '',
  '> 這份由 `node tools/art_batch4.mjs` 自動產生，已有的圖會自動跳過。完整提示詞在 `request.json`。', '',
  WORLD, '',
  '## 交件規則', '',
  '- 尺寸、透明背景、外框顏色照 `assets/ASSET_SPEC.md`。',
  '- 怪物：面向鏡頭；攻擊圖和站姿同畫布、同比例、腳底同高。交件前跑 `python3 tools/check_attack.py <檔案們>`。',
  '- 怪物不要畫成血腥或恐怖；「失去名字」的感覺用空白名牌、褪色、破洞、半透明來表現。',
  '- 深夜版不用另外畫，遊戲會用同一張圖加夜色。',
  '- 所有名字、造型都是本作原創，不要參考或模仿其他遊戲的角色、職業外觀。', '',
  '## 優先順序', '',
  '1. A 怪物（同一區的怪現在只有 6 種造型，最影響觀感）',
  '2. B 斥候（有圖才能開放這個職業）',
  '3. C 技能圖示',
  '4. D 新道具、E 素材圖示', '',
  `共 ${req.length} 張：${groups.map((g) => `${g} ${req.filter((r) => r.group === g).length}`).join('、')}`, '',
];
for (const g of groups) {
  md.push(`## ${g}`, '', '| 檔案 | 尺寸 | 內容 |', '|---|---|---|');
  for (const r of req.filter((x) => x.group === g)) md.push(`| \`${r.path}\` | ${r.size} | ${r.hint.replace(/\|/g, '／')} |`);
  md.push('');
}
writeFileSync(join(OUT, 'README.md'), md.join('\n'));
console.log(`art/batch4: ${req.length} assets`, Object.fromEntries(groups.map((g) => [g, req.filter((r) => r.group === g).length])));
