// 喵喵小窩：全部美術（SVG 字串），統一「貼紙風」：暖棕描邊 + 柔和色塊 + 高光
export const INK = '#4a3428';
let uid = 0;
const DARK = new Set(['#3b3330', '#3a3f8f', '#8a5a3c']);
const st = (w = 3, ink = INK) => `stroke="${ink}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

export function catSVG(c, size = 80, cls = '') {
  const id = `k${++uid}`;
  const dark = DARK.has(c.color);
  const ink = dark ? '#1f1512' : INK;
  const eye = dark ? '#fff1b8' : '#2b1d16';
  const belly = dark ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.62)';
  const a = c.accent;
  const head = {
    stripes: `<path d="M50 18 q3 9 0 15 q-3-7 0-15zM60 16 q3.5 10 0 18 q-3.5-8 0-18zM70 18 q3 9 0 15 q-3-7 0-15z" fill="${a}"/><path d="M20 44 q8 3 13 0M19 53 q7 2 11 0M100 44 q-8 3 -13 0M101 53 q-7 2 -11 0" fill="none" stroke="${a}" stroke-width="3.5" stroke-linecap="round"/>`,
    patch: `<ellipse cx="82" cy="32" rx="24" ry="20" fill="${a}"/>`,
    spots: `<circle cx="30" cy="34" r="6" fill="${a}"/><circle cx="88" cy="28" r="8" fill="${a}"/><circle cx="92" cy="60" r="4" fill="${a}"/>`,
    none: '',
  }[c.pattern];
  const body = {
    stripes: `<path d="M34 80 q6 4 10 0M32 92 q6 4 10 0M86 80 q-6 4 -10 0M88 92 q-6 4 -10 0" fill="none" stroke="${a}" stroke-width="3.5" stroke-linecap="round"/>`,
    patch: `<ellipse cx="36" cy="96" rx="14" ry="12" fill="${a}"/>`,
    spots: `<circle cx="38" cy="84" r="5" fill="${a}"/><circle cx="84" cy="96" r="6" fill="${a}"/>`,
    none: '',
  }[c.pattern];
  const acc = {
    rare: `<g transform="translate(30 22) rotate(-20)"><circle r="7" fill="#ffd66b" ${st(2, ink)}/><circle cx="0" cy="-10" r="5" fill="#ff8fb8" ${st(2, ink)}/><circle cx="10" cy="-2" r="5" fill="#ff8fb8" ${st(2, ink)}/><circle cx="6" cy="9" r="5" fill="#ff8fb8" ${st(2, ink)}/><circle cx="-6" cy="9" r="5" fill="#ff8fb8" ${st(2, ink)}/><circle cx="-10" cy="-2" r="5" fill="#ff8fb8" ${st(2, ink)}/><circle r="4" fill="#ffd66b"/></g>`,
    epic: `<g transform="translate(86 20) rotate(15)"><path d="M0 0 L-16 -9 L-16 9 Z M0 0 L16 -9 L16 9 Z" fill="#7aa7ff" ${st(2.5, ink)}/><circle r="4.5" fill="#a9c6ff" ${st(2.5, ink)}/></g>`,
    legendary: `<path d="M44 20 L46 2 L54 12 L60 0 L66 12 L74 2 L76 20 Z" fill="#ffd66b" ${st(2.5, ink)}/><circle cx="60" cy="13" r="2.5" fill="#ff7b54"/>`,
  }[c.rarity] || '';
  return `<svg class="catsvg ${cls}" viewBox="0 0 120 120" width="${size}" height="${size}" aria-hidden="true">
  <defs><clipPath id="${id}h"><ellipse cx="60" cy="50" rx="40" ry="32"/></clipPath><clipPath id="${id}b"><ellipse cx="60" cy="90" rx="29" ry="23"/></clipPath>
  <radialGradient id="${id}g" cx=".32" cy=".25" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
  <ellipse cx="60" cy="114" rx="32" ry="5" fill="#000" opacity=".13"/>
  <g class="tail"><path d="M80 104 C106 104 114 80 100 66" fill="none" stroke="${ink}" stroke-width="13" stroke-linecap="round"/><path d="M80 104 C106 104 114 80 100 66" fill="none" stroke="${c.color}" stroke-width="7" stroke-linecap="round"/></g>
  <ellipse cx="60" cy="90" rx="29" ry="23" fill="${c.color}"/>
  <g clip-path="url(#${id}b)">${body}<ellipse cx="60" cy="97" rx="15" ry="14" fill="${belly}"/></g>
  <ellipse cx="60" cy="90" rx="29" ry="23" fill="none" ${st(3, ink)}/>
  <ellipse cx="48" cy="110" rx="8.5" ry="5.5" fill="${c.color}" ${st(3, ink)}/><ellipse cx="72" cy="110" rx="8.5" ry="5.5" fill="${c.color}" ${st(3, ink)}/>
  <path d="M25 40 L23 7 L52 24 Z M95 40 L97 7 L68 24 Z" fill="${c.color}" ${st(3, ink)}/>
  <path d="M30 31 L29 16 L43 25 Z M90 31 L91 16 L77 25 Z" fill="#ffb3c1"/>
  <ellipse cx="60" cy="50" rx="40" ry="32" fill="${c.color}"/>
  <g clip-path="url(#${id}h)">${head}<ellipse cx="60" cy="50" rx="40" ry="32" fill="url(#${id}g)"/></g>
  <ellipse cx="60" cy="50" rx="40" ry="32" fill="none" ${st(3, ink)}/>
  <g class="eyes"><ellipse cx="44" cy="52" rx="5.2" ry="6.6" fill="${eye}"/><ellipse cx="76" cy="52" rx="5.2" ry="6.6" fill="${eye}"/>
  <circle cx="46" cy="49.5" r="2.1" fill="#fff"/><circle cx="78" cy="49.5" r="2.1" fill="#fff"/></g>
  <ellipse cx="33" cy="62" rx="7" ry="4" fill="#ff8fa8" opacity=".55"/><ellipse cx="87" cy="62" rx="7" ry="4" fill="#ff8fa8" opacity=".55"/>
  <path d="M57 58 h6 l-3 3.2 z" fill="#ff8fa8" ${st(1.5, ink)}/>
  <path d="M53 63.5 q3.5 4 7 0 q3.5 4 7 0" fill="none" ${st(2, ink)}/>
  <path d="M22 57 l-12 -2.5 M22 62 l-12 2 M98 57 l12 -2.5 M98 62 l12 2" ${st(1.6, ink)} opacity=".45"/>
  ${acc}
</svg>`;
}

const shadow = (rx = 38, cy = 93) => `<ellipse cx="50" cy="${cy}" rx="${rx}" ry="5.5" fill="#000" opacity=".14"/>`;
const FURN = {
  cushion: `${shadow(40)}<ellipse cx="50" cy="76" rx="42" ry="16" fill="#ff9a5c" ${st()}/><ellipse cx="50" cy="70" rx="32" ry="9" fill="#ffbb8c"/><circle cx="50" cy="71" r="3.5" fill="${INK}"/><path d="M14 72 l-6 -4 M86 72 l6 -4" ${st()}/>`,
  yarnball: `${shadow(28)}<circle cx="50" cy="62" r="30" fill="#ff8fb8" ${st()}/><path d="M25 50 q25 12 50 -6 M22 64 q28 12 56 -4 M30 80 q20 6 40 -4 M44 33 q-14 20 -6 56" fill="none" stroke="#d9557f" stroke-width="3" stroke-linecap="round"/><path d="M78 76 q14 8 8 16" fill="none" stroke="#ff8fb8" stroke-width="4" stroke-linecap="round"/><circle cx="40" cy="48" r="5" fill="#fff" opacity=".45"/>`,
  box: `${shadow(40)}<path d="M16 42 L84 42 L84 90 L16 90 Z" fill="#d9a066" ${st()}/><path d="M16 42 L6 26 L46 26 L50 42 Z M84 42 L94 26 L54 26 L50 42 Z" fill="#e8b67c" ${st()}/><ellipse cx="50" cy="66" rx="15" ry="11" fill="#5a3a22" ${st()}/><path d="M35 58 l4 -10 6 8 M65 58 l-4 -10 -6 8" fill="#5a3a22" ${st(2)}/><rect x="62" y="74" width="16" height="10" rx="2" fill="#fff6e8" ${st(2)}/>`,
  plant: `${shadow(26)}<path d="M50 60 C40 40 26 38 18 20 C38 22 50 34 50 60Z" fill="#6fbf73" ${st()}/><path d="M50 60 C60 40 74 38 82 20 C62 22 50 34 50 60Z" fill="#6fbf73" ${st()}/><path d="M50 60 C45 40 45 22 50 6 C55 22 55 40 50 60Z" fill="#8fd694" ${st()}/><path d="M32 66 h36 l-5 26 h-26 z" fill="#e07a5f" ${st()}/><rect x="27" y="58" width="46" height="10" rx="4" fill="#f29a80" ${st()}/>`,
  bed: `${shadow(44)}<ellipse cx="50" cy="72" rx="44" ry="20" fill="#c98a4b" ${st()}/><path d="M10 68 q40 16 80 0" fill="none" stroke="#a86c33" stroke-width="3"/><ellipse cx="50" cy="64" rx="36" ry="12" fill="#a9d8ff" ${st()}/><path d="M28 62 a8 8 0 0 1 14 -4 a10 10 0 0 1 18 0 a8 8 0 0 1 12 6" fill="#fff" ${st(2.5)}/>`,
  lamp: `<circle cx="50" cy="34" r="30" fill="#ffe9a8" opacity=".55"/>${shadow(20)}<path d="M50 52 L50 90" ${st(4)}/><ellipse cx="50" cy="91" rx="17" ry="5" fill="#8d6e63" ${st()}/><path d="M60 12 A22 22 0 1 0 64 54 A17 17 0 1 1 60 12Z" fill="#ffd66b" ${st()}/><circle cx="44" cy="28" r="2" fill="#e8b84a"/><circle cx="40" cy="40" r="3" fill="#e8b84a"/>`,
  tower: `${shadow(42)}<rect x="27" y="28" width="10" height="62" fill="#f1dfc0" ${st()}/><rect x="64" y="50" width="10" height="40" fill="#f1dfc0" ${st()}/><path d="M29 40 h6 M29 52 h6 M29 64 h6 M29 76 h6 M66 62 h6 M66 74 h6" stroke="#c9a77a" stroke-width="2"/><rect x="10" y="20" width="44" height="11" rx="5.5" fill="#8fb3e8" ${st()}/><rect x="48" y="42" width="42" height="11" rx="5.5" fill="#8fb3e8" ${st()}/><rect x="8" y="86" width="84" height="9" rx="4.5" fill="#8fb3e8" ${st()}/><path d="M84 53 v16" ${st(2)}/><circle cx="84" cy="73" r="5" fill="#ff7b54" ${st(2)}/>`,
  tank: `${shadow(36)}<rect x="20" y="78" width="60" height="14" rx="3" fill="#8d6e63" ${st()}/><rect x="14" y="24" width="72" height="56" rx="7" fill="#9ad8f0" ${st()}/><path d="M17 36 q8 -4 16 0 t16 0 t16 0 t16 0" fill="none" stroke="#fff" stroke-width="2.5" opacity=".8"/><path d="M40 58 q10 -10 20 0 q-10 10 -20 0z M60 58 l8 -6 v12z" fill="#ff9a5c" ${st(2)}/><circle cx="46" cy="57" r="1.6" fill="${INK}"/><path d="M24 78 q-2 -14 4 -22 M30 78 q2 -10 -2 -16" fill="none" stroke="#5fbf98" stroke-width="3.5" stroke-linecap="round"/><circle cx="70" cy="44" r="3" fill="none" stroke="#fff" stroke-width="2"/><circle cx="74" cy="34" r="2" fill="none" stroke="#fff" stroke-width="2"/>`,
  sofa: `${shadow(44)}<ellipse cx="50" cy="68" rx="45" ry="24" fill="#f0b77e" ${st()}/><path d="M8 64 q4 -18 42 -20 q38 2 42 20 q-4 8 -12 6 q-6 8 -14 2 q-8 8 -16 1 q-8 7 -16 -1 q-8 6 -14 -2 q-8 2 -12 -6z" fill="#ff8fb8" ${st(2.5)}/><ellipse cx="50" cy="58" rx="14" ry="6" fill="#f0b77e" ${st()}/><g stroke-width="3" stroke-linecap="round"><path d="M22 54 l4 -3" stroke="#ffd66b"/><path d="M34 47 l5 1" stroke="#5fbf98"/><path d="M70 48 l4 3" stroke="#7aa7ff"/><path d="M78 58 l5 -1" stroke="#fff"/><path d="M60 46 l3 -3" stroke="#ff7b54"/><path d="M28 64 l4 2" stroke="#7aa7ff"/></g>`,
};
export function furnitureSVG(id, size = 60) {
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">${FURN[id] || ''}</svg>`;
}

// 家具在房間的固定擺放點（x：中心 %、y：底部 %、w：寬 px）
export const SLOTS = {
  tower: { x: 13, y: 78, w: 120 }, tank: { x: 74, y: 66, w: 100 }, plant: { x: 93, y: 70, w: 64 },
  lamp: { x: 34, y: 66, w: 70 }, cushion: { x: 56, y: 72, w: 74 }, bed: { x: 50, y: 92, w: 116 },
  box: { x: 20, y: 97, w: 84 }, sofa: { x: 80, y: 97, w: 116 }, yarnball: { x: 35, y: 99, w: 46 },
};

export const ROOM_BG = `<svg class="roombg" viewBox="0 0 400 380" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
<defs><pattern id="wp" width="28" height="28" patternUnits="userSpaceOnUse"><rect width="28" height="28" fill="#ffe4d4"/><circle cx="7" cy="7" r="2.6" fill="#ffd0b8"/><circle cx="21" cy="21" r="2.6" fill="#ffd0b8"/></pattern>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a8dcff"/><stop offset="1" stop-color="#e6f6ff"/></linearGradient>
<linearGradient id="fl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2ae7d"/><stop offset="1" stop-color="#eebf90"/></linearGradient></defs>
<rect width="400" height="250" fill="url(#wp)"/>
<rect x="44" y="36" width="120" height="100" rx="10" fill="url(#sky)" ${st(3)}/>
<path d="M66 90 a12 12 0 0 1 20 -8 a14 14 0 0 1 26 2 a10 10 0 0 1 8 14 h-56 a8 8 0 0 1 2 -8z" fill="#fff" opacity=".95"/>
<circle cx="140" cy="60" r="11" fill="#ffd66b"/>
<path d="M104 36 v100 M44 86 h120" stroke="#fffaf6" stroke-width="7"/><rect x="44" y="36" width="120" height="100" rx="10" fill="none" ${st(3)}/>
<path d="M34 28 q20 60 4 118 l-10 0 v-118z M174 28 q-20 60 -4 118 l10 0 v-118z" fill="#ff9e9e" ${st(2.5)}/><rect x="26" y="22" width="156" height="9" rx="4.5" fill="#c98a4b" ${st(2.5)}/>
<rect x="232" y="56" width="74" height="58" rx="5" fill="#fff9f0" stroke="#c98a4b" stroke-width="7"/><rect x="232" y="56" width="74" height="58" rx="5" fill="none" ${st(2)}/>
<path d="M252 86 q12 -12 24 0 q-12 12 -24 0z M276 86 l9 -7 v14z" fill="#7aa7ff" ${st(2)}/>
<rect x="320" y="132" width="64" height="8" rx="3" fill="#c98a4b" ${st(2.5)}/><circle cx="338" cy="122" r="9" fill="#ff8fb8" ${st(2)}/><rect x="356" y="112" width="14" height="20" rx="3" fill="#5fbf98" ${st(2)}/>
<rect y="242" width="400" height="12" fill="#f2c4a8"/><path d="M0 242 h400" ${st(2.5)}/>
<rect y="254" width="400" height="126" fill="url(#fl)"/><path d="M0 254 h400" ${st(2.5)}/>
<g stroke="#d49c6a" stroke-width="2"><path d="M0 280 h400 M0 310 h400 M0 344 h400"/><path d="M90 254 v26 M260 254 v26 M30 280 v30 M180 280 v30 M340 280 v30 M120 310 v34 M300 310 v34 M60 344 v36 M230 344 v36"/></g>
<ellipse cx="200" cy="326" rx="140" ry="36" fill="#a9d8c3" ${st(2.5)}/><ellipse cx="200" cy="326" rx="118" ry="26" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="8 7"/>
</svg>`;

// 介面小圖示
const ico = (body, vb = 24) => `<svg class="ico" viewBox="0 0 ${vb} ${vb}" aria-hidden="true">${body}</svg>`;
const s2 = st(1.8);
export const ICON = {
  coin: ico(`<circle cx="12" cy="12" r="9" fill="#ffd66b" ${s2}/><circle cx="12" cy="12" r="5.5" fill="none" stroke="#e8a92c" stroke-width="1.8"/><path d="M10.5 9.5 h3 M12 9.5 v5" stroke="#c98a1c" stroke-width="1.8" stroke-linecap="round"/>`),
  cookie: ico(`<circle cx="12" cy="12" r="9" fill="#e8b06a" ${s2}/><circle cx="9" cy="9" r="1.4" fill="${INK}"/><circle cx="14.5" cy="10" r="1.2" fill="${INK}"/><circle cx="10.5" cy="14.5" r="1.3" fill="${INK}"/><circle cx="15" cy="15" r="1.1" fill="${INK}"/>`),
  wood: ico(`<rect x="3" y="8" width="16" height="9" rx="4.5" fill="#c98a4b" ${s2}/><ellipse cx="18" cy="12.5" rx="3.5" ry="4.5" fill="#f1d3a6" ${s2}/><ellipse cx="18" cy="12.5" rx="1.4" ry="2" fill="none" stroke="#c98a4b" stroke-width="1.2"/>`),
  cloth: ico(`<path d="M4 7 h13 l3 3 v8 h-16 z" fill="#ff9eb5" ${s2}/><path d="M4 11 h16 M4 14.5 h16" stroke="#fff" stroke-width="1.4"/>`),
  yarn: ico(`<circle cx="12" cy="12" r="8" fill="#7aa7ff" ${s2}/><path d="M6 9 q6 3 12 -1 M5.5 13 q7 3 13 -1 M9 18 q4 1 7 -1" fill="none" stroke="#4d7ad9" stroke-width="1.4"/>`),
  glass: ico(`<path d="M12 3 l7 6 -7 12 -7 -12z" fill="#9be3e6" ${s2}/><path d="M5 9 h14 M12 3 l-3 6 3 12 3 -12z" fill="none" stroke="#fff" stroke-width="1.2" opacity=".85"/>`),
  home: ico(`<path d="M4 11 L12 4 L20 11 V20 H4 Z" fill="currentColor" opacity=".18"/><path d="M4 11 L12 4 L20 11 V20 H4 Z M10 20 v-5 h4 v5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>`),
  paw: ico(`<ellipse cx="12" cy="15.5" rx="5" ry="4.2" fill="currentColor"/><circle cx="6" cy="10" r="2.2" fill="currentColor"/><circle cx="9.5" cy="6.5" r="2.2" fill="currentColor"/><circle cx="14.5" cy="6.5" r="2.2" fill="currentColor"/><circle cx="18" cy="10" r="2.2" fill="currentColor"/>`),
  cake: ico(`<path d="M4 12 h16 v8 H4z" fill="currentColor" opacity=".18"/><path d="M4 12 h16 v8 H4z M4 15 q2 2 4 0 t4 0 t4 0 t4 0 M12 12 V8" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 3 q2 2.5 0 4 q-2 -1.5 0 -4z" fill="currentColor"/>`),
  hammer: ico(`<path d="M5 8 l5 -4 4 4 -5 4z" fill="currentColor" opacity=".25"/><path d="M5 8 l5 -4 4 4 -5 4z M11.5 10 l8 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`),
  list: ico(`<rect x="5" y="3" width="14" height="18" rx="2.5" fill="currentColor" opacity=".18"/><rect x="5" y="3" width="14" height="18" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 9 h6 M9 13 h6 M9 17 h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`),
};
