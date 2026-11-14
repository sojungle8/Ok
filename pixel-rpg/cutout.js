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
  const side = view === 'side', back = view === 'back', attack = frame === 2, step = frame === 1;
  const bob = step ? -2 : 0;
  const cape = L.cape ? `gear/cape/${L.armorTier === 4 ? 'red' : 'purple'}_${view}` : null;
  const neck = [96, 130 + bob];
  // Scale the complete head assembly together so hair and helmets keep their fit.
  // Sink its neck into the collar instead of stacking two exposed neck segments.
  const headJoint = [96, 139 + bob];
  const drawHead = (id) => draw(id, ...headJoint, 0, .88);
  const torsoWidth = side ? 1.16 : 1.10;
  const limb = (sign, front, heldOnly = false) => {
    // Attach inside the tapered shoulder silhouette, not at the torso's widest hem.
    const shoulderX = side ? (front ? 101 : 86) : 96 + sign * 25;
    const sleeveOffset = side ? -7 : 0;
    const angle = attack && front ? -1.05 : step ? sign * .17 : sign * -.08;
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
      const weaponAngle = L.weapon.type === 'fist' ? -Math.PI / 2 : attack ? 0 : -Math.PI / 2;
      draw(`gear/weapon/${L.weapon.type}_${tiers[L.weapon.tier]}`, 0, 52 + sleeveOffset, weaponAngle);
    }
    x.restore();
  };
  if (cape && !back) draw(cape, ...neck);
  // Long hair sits behind the shoulders and chest. Only its crown/fringe
  // is painted over the face; rear views retain the full hair silhouette.
  if (!back) drawHead(hair);
  limb(-1, false);
  for (const sign of [-1, 1]) {
    x.save(); x.translate(96 + sign * (side ? 9 : 16), 187 + bob); x.rotate(step ? sign * .16 : 0);
    draw(body('leg'), 0, 0);
    if (L.bootsTier >= 0) draw(`gear/boots/${tiers[L.bootsTier]}`, 0, 34);
    x.restore();
  }
  if (!side) limb(1, true);
  draw(body('torso'), ...neck, 0, torsoWidth, 1);
  if (L.armorTier >= 0) draw(`gear/armor/${tiers[L.armorTier]}_${view}`, ...neck, 0, torsoWidth, 1);
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
