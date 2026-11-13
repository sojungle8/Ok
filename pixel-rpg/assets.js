// 微光大陸：外部美術素材載入器。assets/manifest.json 列出的圖才會載入；沒有的就用程式繪製的版本。
const imgs = new Map();
let ready = Promise.resolve();
export function loadAssets(base = 'assets/') {
  ready = fetch(base + 'manifest.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : { files: [] }))
    .then((m) => Promise.all((m.files || []).map((f) => new Promise((res) => {
      const im = new Image();
      im.onload = () => { imgs.set(f.replace(/\.png$/, ''), im); res(); };
      im.onerror = () => res();
      im.src = base + f;
    }))))
    .catch(() => {});
  return ready;
}
export const asset = (key) => imgs.get(key) || null;
export const assetCount = () => imgs.size;

// 白色特效貼圖上色（快取）
const tintCache = new Map();
export function tinted(key, color) {
  const im = asset(key);
  if (!im) return null;
  const k = key + color;
  if (tintCache.has(k)) return tintCache.get(k);
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const x = c.getContext('2d');
  x.drawImage(im, 0, 0);
  x.globalCompositeOperation = 'multiply'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'destination-in'; x.drawImage(im, 0, 0);
  tintCache.set(k, c);
  return c;
}
