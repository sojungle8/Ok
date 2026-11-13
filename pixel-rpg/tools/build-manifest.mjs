// 掃描 assets/ 底下的 PNG，產生 assets/manifest.json（遊戲只會嘗試載入清單裡有的檔案）
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
const root = new URL('../assets/', import.meta.url).pathname;
const files = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f.endsWith('.png')) files.push(relative(root, p).replace(/\\/g, '/')); } })(root);
files.sort();
writeFileSync(join(root, 'manifest.json'), JSON.stringify({ version: 1, files }, null, 2));
console.log(`manifest.json：${files.length} 個素材`);
