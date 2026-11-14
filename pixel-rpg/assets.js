// 微光大陸：外部美術素材載入器。assets/manifest.json 列出的圖才會載入；沒有的就用程式繪製的版本。
const imgs = new Map();
let ready = Promise.resolve();
// 先載入畫面立即需要的圖（角色、介面、地圖），大張的大招立繪、頭像、舊零件放到後面
const LATE = ['soul_art/', 'portrait/', 'char/', 'gear/', 'icon/', 'vfx/'];
export const loadState = { done: 0, total: 0, core: false };
export function loadAssets(base = 'assets/', onCore) {
  let ver = {};
  const one = (f) => new Promise((res) => {
    const im = new Image();
    im.onload = () => { imgs.set(f.replace(/\.png$/, ''), im); loadState.done++; res(); };
    im.onerror = () => { loadState.done++; res(); };
    im.src = base + f + (ver[f] ? `?v=${ver[f]}` : '');
  });
  ready = fetch(base + 'manifest.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : { files: [] }))
    .then(async (m) => {
      ver = m.v || {};
      const files = (m.files || []).filter((f) => !/(^|\/)_|_preview\.png$/.test(f));
      const late = files.filter((f) => LATE.some((p) => f.startsWith(p)) || f.endsWith('_attack.png'));
      const core = files.filter((f) => !late.includes(f));
      loadState.total = files.length;
      await Promise.all(core.map(one));
      loadState.core = true; onCore?.();
      await Promise.all(late.map(one));
    })
    .catch(() => {})
    .finally(() => { if (!loadState.core) { loadState.core = true; onCore?.(); } });
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
