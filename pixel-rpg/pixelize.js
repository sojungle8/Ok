// 微光大陸：把高畫質素材即時轉成像素圖（縮到地圖像素格線、減色、去半透明、加深色外框）
const cache = new WeakMap();
const OUTLINE = [42, 29, 46];
function bbox(src) {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const x = c.getContext('2d'); x.drawImage(src, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y += 2) for (let xx = 0; xx < c.width; xx += 2) if (d[(y * c.width + xx) * 4 + 3] > 40) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 2, h: y1 - y0 + 2 };
}
function kmeans(px, k) {
  const n = px.length / 3; if (!n) return [];
  const cent = [];
  for (let i = 0; i < k; i++) { const j = Math.floor(((i + 0.5) / k) * n) * 3; cent.push([px[j], px[j + 1], px[j + 2]]); }
  const asg = new Uint8Array(n);
  for (let it = 0; it < 7; it++) {
    const sum = cent.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < n; i++) {
      let best = 0, bd = 1e9;
      for (let c = 0; c < k; c++) { const dr = px[i * 3] - cent[c][0], dg = px[i * 3 + 1] - cent[c][1], db = px[i * 3 + 2] - cent[c][2]; const d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11; if (d < bd) { bd = d; best = c; } }
      asg[i] = best; const s = sum[best]; s[0] += px[i * 3]; s[1] += px[i * 3 + 1]; s[2] += px[i * 3 + 2]; s[3]++;
    }
    sum.forEach((s, c) => { if (s[3]) cent[c] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
  }
  return { cent, asg };
}
// h = 目標高度（地圖像素），colors = 顏色數
export function pixelize(src, h, colors = 14) {
  if (!src || !src.width) return src;
  let per = cache.get(src);
  if (!per) { per = { box: bbox(src) }; cache.set(src, per); }
  const key = h + ':' + colors;
  if (per[key]) return per[key];
  const b = per.box;
  if (!b) return (per[key] = src);
  const w = Math.max(1, Math.round((b.w * h) / b.h));
  // 先縮到 2 倍再縮一次，取樣比較乾淨
  const mid = document.createElement('canvas'); mid.width = w * 2; mid.height = h * 2;
  const mx = mid.getContext('2d'); mx.imageSmoothingEnabled = true; mx.imageSmoothingQuality = 'high';
  mx.drawImage(src, b.x, b.y, b.w, b.h, 0, 0, w * 2, h * 2);
  const out = document.createElement('canvas'); out.width = w + 2; out.height = h + 2;
  const ox = out.getContext('2d'); ox.imageSmoothingEnabled = true; ox.imageSmoothingQuality = 'high';
  ox.drawImage(mid, 1, 1, w, h);
  const img = ox.getImageData(0, 0, w + 2, h + 2), d = img.data;
  const idx = [], px = [];
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] > 110) {
      // 稍微提高對比與飽和度，縮小後才不會灰濛濛
      const r = d[i], g = d[i + 1], bl = d[i + 2], l = (r + g + bl) / 3;
      idx.push(i); px.push(...[r, g, bl].map((v) => Math.max(0, Math.min(255, l + (v - l) * 1.18 + (v - 128) * 0.08))));
    } else d[i + 3] = 0;
  }
  const { cent, asg } = kmeans(px, Math.min(colors, Math.max(1, idx.length)));
  idx.forEach((i, j) => { const c = cent[asg[j]]; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; });
  // 清除孤立雜點：周圍 8 格大多是同一色、自己卻不同色的像素，改成周圍的顏色（做兩輪）
  const Wd = w + 2, Hd = h + 2;
  for (let pass = 0; pass < 2; pass++) {
    const copy = new Uint8ClampedArray(d);
    for (let y = 1; y < Hd - 1; y++) for (let x = 1; x < Wd - 1; x++) {
      const i = (y * Wd + x) * 4; if (copy[i + 3] !== 255) continue;
      const counts = new Map(); let same = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const j = ((y + dy) * Wd + x + dx) * 4; if (copy[j + 3] !== 255) continue;
        const key = (copy[j] << 16) | (copy[j + 1] << 8) | copy[j + 2];
        if (copy[j] === copy[i] && copy[j + 1] === copy[i + 1] && copy[j + 2] === copy[i + 2]) same++;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      if (same > 1) continue;
      let bestK = -1, bestN = 0; for (const [k2, n2] of counts) if (n2 > bestN) { bestN = n2; bestK = k2; }
      if (bestN >= 4) { d[i] = bestK >> 16; d[i + 1] = (bestK >> 8) & 255; d[i + 2] = bestK & 255; }
    }
  }
  const W = w + 2, H = h + 2, solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] === 255;
  const edge = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!solid(x, y) && (solid(x + 1, y) || solid(x - 1, y) || solid(x, y + 1) || solid(x, y - 1))) edge.push((y * W + x) * 4);
  for (const i of edge) { d[i] = OUTLINE[0]; d[i + 1] = OUTLINE[1]; d[i + 2] = OUTLINE[2]; d[i + 3] = 255; }
  ox.putImageData(img, 0, 0);
  return (per[key] = out);
}
