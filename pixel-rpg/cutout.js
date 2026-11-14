import { asset, assetCount } from './assets.js';

const tiers = ['common', 'good', 'rare', 'epic', 'legend'];
const cache = new Map();
let revision = -1;

// Every part is a 256px texture whose joint is exactly (128,128).
// The rig uses a 192×256 logical canvas; callers retain the old 24×32 footprint.
export function cutoutAvatar(L, dir, frame) {
  if (!L.cls) return null;
  const view = dir === 'up' ? 'back' : ['left', 'right', 'side'].includes(dir) ? 'side' : 'front';
  const body = (part) => `char/body/${part}_${view}`;
  const hair = `char/${L.cls}/hair_${view}`;
  if (![body('head'), body('torso'), body('hand'), body('leg'), hair].every(asset)) return null;
  if (revision !== assetCount()) { cache.clear(); revision = assetCount(); }
  const key = JSON.stringify([L, dir, frame]);
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = 192; c.height = 256;
  const x = c.getContext('2d');
  if (dir === 'left') { x.translate(c.width, 0); x.scale(-1, 1); }
  const draw = (id, px, py, rotation = 0, scaleX = 1, scaleY = scaleX) => {
    const im = asset(id); if (!im) return;
    x.save(); x.translate(px, py); x.rotate(rotation); x.scale(scaleX, scaleY); x.drawImage(im, -128, -128, 256, 256); x.restore();
  };
  const side = view === 'side', back = view === 'back';
  // 動畫格：數字（舊版 0 站 / 1 走 / 2 攻擊）或字串 i0-1 待機、w0-3 走路、a0-3 攻擊（蓄力→揮出→收招→回位）
  const fr = typeof frame === 'string' ? frame : frame === 2 ? 'a1' : frame === 1 ? 'w1' : 'i0';
  const kind = fr[0], ph = +fr.slice(1) || 0;
  const attack = kind === 'a', walk = kind === 'w';
  const wsw = walk ? Math.sin((ph / 4) * Math.PI * 2) : 0;           // 走路擺動 -1～1
  // 劍：高舉蓄力 → 往前劈 → 往下收招 → 回位；法杖：舉起 → 往前突刺；拳：拉回 → 出拳；弓：舉弓拉滿
  const ATK = { sword: [-2.8, -1.6, -0.6, -0.2], staff: [-2.4, -1.8, -1.5, -0.6], fist: [0.3, -1.55, -1.55, -0.5], bow: [-1.3, -1.45, -1.45, -1.2] };
  const atkArm = attack ? (ATK[L.weapon?.type] || ATK.sword)[ph] : 0;
  const lean = attack ? [-3, 6, 7, 2][ph] : 0;                        // 身體前傾（像素）
  const bob = walk ? -Math.abs(wsw) * 3 : kind === 'i' && ph ? -1 : attack && ph === 1 ? 2 : 0;
  const breathe = kind === 'i' && ph ? 1.015 : 1;
  const cape = L.cape ? `gear/cape/${L.armorTier === 4 ? 'red' : 'purple'}_${view}` : null;
  const neck = [96 + (side ? lean : 0), 130 + bob];
  // Scale the complete head assembly together so hair and helmets keep their fit.
  // Sink its neck into the collar instead of stacking two exposed neck segments.
  const headJoint = [96 + (side ? lean : 0), 139 + bob + (side ? 0 : lean * 0.3)];
  const drawHead = (id) => draw(id, ...headJoint, 0, .88);
  const torsoWidth = side ? 1.16 : 1.10;
  const limb = (sign, front, heldOnly = false) => {
    // Attach inside the tapered shoulder silhouette, not at the torso's widest hem.
    const shoulderX = (side ? (front ? 101 : 86) : 96 + sign * 25) + (side ? lean : 0);
    const sleeveOffset = side ? -7 : 0;
    const swing = walk ? -wsw * 0.45 * (front ? 1 : -1) * (side ? 1 : sign) : 0;
    const angle = attack && front ? (side ? atkArm : atkArm * 0.8) : attack ? 0.35 : swing + sign * -.08;
    x.save(); x.translate(shoulderX, 145 + bob); x.rotate(angle);
    if (!heldOnly) {
      if (asset(body('arm'))) draw(body('arm'), 0, sleeveOffset);
      else {
        // Keep the procedural sleeve while the optional arm texture is unavailable.
        x.fillStyle = '#2a1d2e'; x.fillRect(-12, 0, 24, 46);
        x.fillStyle = L.outfit.main; x.fillRect(-9, 2, 18, 42);
      }
      draw(body('hand'), 0, 43 + sleeveOffset);
      if (L.glovesTier >= 0) draw(`gear/gloves/${tiers[L.glovesTier]}`, 0, 43 + sleeveOffset);
    }
    if (heldOnly && front && L.weapon) {
      // 平時武器向外斜握，不擋住臉；攻擊時跟著手臂揮出
      const t = L.weapon.type;
      const rest = t === 'bow' ? -Math.PI / 2 + 0.1 : side ? -Math.PI / 2 + 0.25 : -Math.PI / 2 + 0.55;
      const weaponAngle = t === 'fist' ? -Math.PI / 2 : attack ? (t === 'bow' ? -0.1 : 0.15) : rest - angle;
      draw(`gear/weapon/${t}_${tiers[L.weapon.tier]}`, 0, 52 + sleeveOffset, weaponAngle, t === 'fist' ? 1 : 0.86);
    }
    x.restore();
  };
  if (cape && !back) draw(cape, ...neck);
  // Long hair sits behind the shoulders and chest. Only its crown/fringe
  // is painted over the face; rear views retain the full hair silhouette.
  if (!back) drawHead(hair);
  limb(-1, false);
  for (const sign of [-1, 1]) {
    const legSwing = walk ? (side ? wsw * 0.4 * sign : wsw * 0.12 * sign) : attack && side ? [0, 0.25, 0.3, 0.1][ph] * sign : 0;
    x.save(); x.translate(96 + sign * (side ? 9 : 16), 187 + bob); x.rotate(legSwing); if (walk && !side) x.translate(0, -Math.max(0, wsw * sign) * 4);
    draw(body('leg'), 0, 0);
    if (L.bootsTier >= 0) draw(`gear/boots/${tiers[L.bootsTier]}`, 0, 34);
    x.restore();
  }
  if (!side) limb(1, true);
  draw(body('torso'), ...neck, side ? lean * 0.004 : 0, torsoWidth, breathe);
  if (L.armorTier >= 0) draw(`gear/armor/${tiers[L.armorTier]}_${view}`, ...neck, side ? lean * 0.004 : 0, torsoWidth, breathe);
  if (side) limb(1, true);
  if (cape && back) draw(cape, ...neck);
  drawHead(body('head'));
  if (back) drawHead(hair);
  else {
    x.save(); x.beginPath(); x.rect(0, 0, c.width, headJoint[1] - 8); x.clip();
    drawHead(hair); x.restore();
  }
  if (L.helm) drawHead(`gear/helm/${L.helm.style}_${tiers[L.helm.tier]}_${view}`);
  limb(1, true, true);
  cache.set(key, c);
  return c;
}
