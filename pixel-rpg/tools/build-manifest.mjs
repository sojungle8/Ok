// 掃描 assets/ 底下的 PNG，產生 assets/manifest.json（遊戲只會嘗試載入清單裡有的檔案）
import { readdirSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../assets/', import.meta.url));
const files = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f.endsWith('.png') && !f.startsWith('_') && !f.endsWith('_preview.png')) files.push(relative(root, p).replace(/\\/g, '/')); } })(root);
files.sort();
// v：每張圖的內容版本碼。同檔名換圖時網址會跟著變，玩家手機不會卡在舊快取
const v = Object.fromEntries(files.map((f) => [f, createHash('md5').update(readFileSync(join(root, f))).digest('hex').slice(0, 8)]));
writeFileSync(join(root, 'manifest.json'), JSON.stringify({ version: 1, files, v }, null, 2));
console.log(`manifest.json：${files.length} 個素材`);
