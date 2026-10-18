// 角色外觀與立繪：同一套外觀同時給 3D 小人和對話立繪使用
(function (root) {
  const SKINS = ['#f6d3b8', '#ecc19f', '#dcaa83', '#c48d66', '#94603f'];
  const HAIRS = ['#2b2420', '#4a3428', '#6e4b2f', '#1f1f2e', '#9a5230', '#3b2a4a'];
  const STYLES_M = ['short', 'spiky', 'side', 'short'];
  const STYLES_F = ['long', 'bob', 'bun', 'long'];

  // 員工的名字與性別（性別只用來挑髮型）
  const STAFF = [
    ['小美', 'f'], ['阿宏', 'm'], ['佳穎', 'f'], ['志明', 'm'], ['春嬌', 'f'], ['阿翔', 'm'], ['怡君', 'f'],
    ['家豪', 'm'], ['雅婷', 'f'], ['俊傑', 'm'], ['淑芬', 'f'], ['Kevin', 'm'], ['詩涵', 'f'], ['建宏', 'm'],
  ];

  // 各產業的制服
  const UNIFORM = {
    drinks: { shirts: ['#e8743b', '#e8743b', '#f0a03c'], hat: 'cap', hatColor: '#c4552a' },
    tech: { shirts: ['#4a6fa5', '#5b8c6e', '#7a5c99', '#3d4f63', '#b5654a'], glassesRate: 0.4 },
    store: { shirts: ['#2f9e64', '#2f9e64', '#3aa8c7'], hat: 'cap', hatColor: '#23794c' },
    restaurant: { shirts: ['#f4f1ec', '#f4f1ec', '#2f2f35'], hat: 'chef' },
    cram: { shirts: ['#c75b5b', '#4f7cac', '#d9a441', '#6b8f71', '#8a6bb0'], glassesRate: 0.5 },
    breakfast: { shirts: ['#f2c14e', '#f2c14e', '#ffffff'], hat: 'cap', hatColor: '#d9482b' },
    noodle: { shirts: ['#f4f1ec', '#2f2f35', '#f4f1ec'], hat: 'chef' },
    barber: { shirts: ['#2f2f35', '#3b6fb6', '#2f2f35'] },
    scooter: { shirts: ['#2f4f7f', '#2f4f7f', '#5b6b7a'], hat: 'cap', hatColor: '#e2a12a' },
  };

  function staffLook(i, industryId) {
    const [name, gender] = STAFF[i % STAFF.length];
    const u = UNIFORM[industryId] || UNIFORM.tech;
    const styles = gender === 'f' ? STYLES_F : STYLES_M;
    return {
      name,
      gender,
      skin: SKINS[(i * 3 + 1) % SKINS.length],
      hair: HAIRS[(i * 5 + 2) % HAIRS.length],
      hairStyle: styles[(i * 7) % styles.length],
      shirt: u.shirts[i % u.shirts.length],
      hat: u.hat || null,
      hatColor: u.hatColor,
      glasses: u.glassesRate ? ((i * 37) % 100) / 100 < u.glassesRate : i % 6 === 4,
    };
  }

  function bossLook(gender) {
    return {
      name: '老闆',
      gender,
      skin: SKINS[1],
      hair: '#231c18',
      hairStyle: gender === 'f' ? 'bob' : 'side',
      shirt: '#2e3a52',
      suit: true,
      tie: '#c0392b',
    };
  }

  // 電話另一頭和門口的訪客
  const VISITORS = {
    caller: { name: '電話另一頭', gender: 'm', skin: SKINS[2], hair: '#3a3a3a', hairStyle: 'short', shirt: '#6c7a89', phone: true },
    landlord: { name: '房東', gender: 'm', skin: SKINS[2], hair: '#9a9a9a', hairStyle: 'bald', shirt: '#7d9cbf', glasses: true },
    investor: { name: '投資人', gender: 'm', skin: SKINS[0], hair: '#1d1d1d', hairStyle: 'slick', shirt: '#22252b', suit: true, tie: '#3b5bdb', shades: true, phone: true },
    karen: { name: '奧客', gender: 'f', skin: SKINS[0], hair: '#c9a46a', hairStyle: 'bob', shirt: '#d65a8a' },
    hq: { name: '總部窗口', gender: 'f', skin: SKINS[1], hair: '#2b2420', hairStyle: 'bun', shirt: '#3d6e9e', suit: true, phone: true },
    supplier: { name: '供應商', gender: 'm', skin: SKINS[3], hair: '#2b2420', hairStyle: 'spiky', shirt: '#b08a4f', phone: true },
    crowd: { name: '排隊的客人', gender: 'f', skin: SKINS[1], hair: '#4a3428', hairStyle: 'long', shirt: '#5aa9a0' },
    auntie: { name: '阿姨', gender: 'f', skin: SKINS[2], hair: '#5a3d2b', hairStyle: 'bun', shirt: '#b5517a', phone: true },
    shareholder: { name: '股東', gender: 'm', skin: SKINS[1], hair: '#7a7a7a', hairStyle: 'side', shirt: '#34495e', suit: true, tie: '#8e44ad', phone: true },
  };

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt)));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }

  // ───── SVG 立繪 ─────
  // mood: neutral | happy | worried | angry | sad | shocked | smug
  function portraitSVG(look, mood = 'neutral') {
    const L = look;
    const skinD = shade(L.skin, -28);
    const hairD = shade(L.hair, -20);
    const parts = [];

    // 後面的長髮
    if (L.hairStyle === 'long') parts.push(`<path d="M44 92 Q40 190 62 214 L138 214 Q160 190 156 92 Z" fill="${hairD}"/>`);
    if (L.hairStyle === 'bob') parts.push(`<path d="M46 96 Q42 160 58 172 L142 172 Q158 160 154 96 Z" fill="${hairD}"/>`);

    // 身體
    parts.push(`<path d="M14 240 Q22 178 100 166 Q178 178 186 240 Z" fill="${L.shirt}"/>`);
    if (L.suit) {
      parts.push(`<path d="M78 170 L100 214 L122 170 Q112 166 100 166 Q88 166 78 170 Z" fill="#f5f5f5"/>`);
      if (L.tie) parts.push(`<path d="M96 176 L104 176 L108 212 L100 222 L92 212 Z" fill="${L.tie}"/>`);
      parts.push(`<path d="M78 170 L96 226 L70 240 L40 240 Q50 186 78 170 Z M122 170 L104 226 L130 240 L160 240 Q150 186 122 170 Z" fill="${shade(L.shirt, -14)}"/>`);
    } else {
      parts.push(`<path d="M80 168 Q100 190 120 168" fill="none" stroke="${shade(L.shirt, -40)}" stroke-width="4"/>`);
    }
    // 脖子、耳朵、臉
    parts.push(`<rect x="86" y="138" width="28" height="34" rx="10" fill="${skinD}"/>`);
    parts.push(`<circle cx="49" cy="108" r="10" fill="${skinD}"/><circle cx="151" cy="108" r="10" fill="${skinD}"/>`);
    parts.push(`<ellipse cx="100" cy="102" rx="51" ry="58" fill="${L.skin}"/>`);

    // 臉部表情
    parts.push(face(mood));

    // 前面的頭髮
    parts.push(hairFront(L, hairD));
    if (L.glasses) parts.push(`<g fill="none" stroke="#2b2b2b" stroke-width="3"><circle cx="79" cy="110" r="14"/><circle cx="121" cy="110" r="14"/><path d="M93 110 L107 110"/></g>`);
    if (L.shades) parts.push(`<g fill="#151515"><rect x="62" y="100" width="32" height="18" rx="7"/><rect x="106" y="100" width="32" height="18" rx="7"/><rect x="92" y="104" width="16" height="4"/></g>`);
    if (L.hat === 'chef') parts.push(`<path d="M58 66 Q48 30 76 32 Q86 10 108 20 Q130 10 138 34 Q160 34 142 66 Z" fill="#ffffff" stroke="#ddd" stroke-width="2"/><rect x="58" y="58" width="84" height="14" rx="4" fill="#f0f0f0" stroke="#ddd" stroke-width="2"/>`);
    if (L.hat === 'cap') parts.push(`<path d="M50 70 Q54 34 100 32 Q146 34 150 70 Z" fill="${L.hatColor}"/><path d="M100 64 Q150 62 170 74 Q140 80 100 72 Z" fill="${shade(L.hatColor, -25)}"/>`);
    if (L.phone) parts.push(`<g transform="translate(150 118) rotate(18)"><rect x="-10" y="-30" width="22" height="46" rx="5" fill="#2d2d2d"/><rect x="-7" y="-25" width="16" height="34" rx="2" fill="#7fb2e5"/></g><ellipse cx="160" cy="150" rx="14" ry="11" fill="${L.skin}"/>`);

    return `<svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${parts.join('')}</svg>`;
  }

  function face(mood) {
    const ink = '#2a211c';
    const p = [];
    const brow = (lx, ly, rx, ry) =>
      p.push(`<path d="M68 ${ly} L90 ${lx}" stroke="${ink}" stroke-width="4" stroke-linecap="round"/><path d="M110 ${rx} L132 ${ry}" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>`);
    const dotEyes = (ry = 7) => p.push(`<ellipse cx="79" cy="110" rx="5.5" ry="${ry}" fill="${ink}"/><ellipse cx="121" cy="110" rx="5.5" ry="${ry}" fill="${ink}"/>`);
    switch (mood) {
      case 'happy':
        brow(88, 90, 88, 90);
        p.push(`<path d="M70 112 Q79 102 88 112 M112 112 Q121 102 130 112" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>`);
        p.push(`<path d="M80 132 Q100 154 120 132 Z" fill="#8a2f2f"/><path d="M86 136 Q100 146 114 136" fill="#f3a3a3"/>`);
        p.push(`<ellipse cx="66" cy="126" rx="9" ry="5" fill="#f2a0a0" opacity="0.6"/><ellipse cx="134" cy="126" rx="9" ry="5" fill="#f2a0a0" opacity="0.6"/>`);
        break;
      case 'worried':
        brow(90, 96, 90, 96);
        p.push(`<path d="M68 96 L90 88 M110 88 L132 96" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>`);
        dotEyes(6);
        p.push(`<path d="M86 140 Q93 134 100 140 Q107 146 114 140" fill="none" stroke="${ink}" stroke-width="3.5" stroke-linecap="round"/>`);
        p.push(`<path d="M146 76 Q154 90 146 94 Q138 90 146 76 Z" fill="#8fd0f0"/>`);
        break;
      case 'angry':
        p.push(`<path d="M66 90 L90 100 M110 100 L134 90" stroke="${ink}" stroke-width="5" stroke-linecap="round"/>`);
        dotEyes(4.5);
        p.push(`<path d="M84 144 Q100 132 116 144" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>`);
        p.push(`<path d="M132 60 l8 -8 m-4 12 l10 -2 m-14 -2 l2 -10" stroke="#d9473f" stroke-width="3" stroke-linecap="round"/>`);
        break;
      case 'sad':
        p.push(`<path d="M68 96 L90 90 M110 90 L132 96" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>`);
        p.push(`<path d="M70 108 Q79 116 88 108 M112 108 Q121 116 130 108" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>`);
        p.push(`<path d="M76 116 Q70 132 76 138 Q82 132 76 116 Z M124 116 Q118 132 124 138 Q130 132 124 116 Z" fill="#7cc3ec"/>`);
        p.push(`<path d="M84 146 Q100 132 116 146 Z" fill="#8a2f2f"/>`);
        break;
      case 'shocked':
        p.push(`<path d="M68 86 L90 82 M110 82 L132 86" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>`);
        p.push(`<circle cx="79" cy="110" r="11" fill="#fff" stroke="${ink}" stroke-width="2.5"/><circle cx="121" cy="110" r="11" fill="#fff" stroke="${ink}" stroke-width="2.5"/><circle cx="79" cy="110" r="3.5" fill="${ink}"/><circle cx="121" cy="110" r="3.5" fill="${ink}"/>`);
        p.push(`<ellipse cx="100" cy="142" rx="9" ry="12" fill="#8a2f2f"/>`);
        p.push(`<path d="M150 80 Q158 94 150 98 Q142 94 150 80 Z" fill="#8fd0f0"/>`);
        break;
      case 'smug':
        brow(92, 90, 86, 92);
        p.push(`<path d="M70 110 Q79 106 88 110 M112 110 Q121 106 130 110" fill="none" stroke="${ink}" stroke-width="4.5" stroke-linecap="round"/>`);
        p.push(`<path d="M86 136 Q106 146 118 132" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>`);
        break;
      default:
        brow(90, 92, 90, 92);
        dotEyes();
        p.push(`<path d="M88 138 Q100 144 112 138" fill="none" stroke="${ink}" stroke-width="3.5" stroke-linecap="round"/>`);
    }
    // 鼻子
    p.push(`<path d="M98 116 Q94 126 101 127" fill="none" stroke="rgba(0,0,0,0.25)" stroke-width="3" stroke-linecap="round"/>`);
    return p.join('');
  }

  function hairFront(L, hairD) {
    const c = L.hair;
    switch (L.hairStyle) {
      case 'spiky':
        return `<path d="M48 96 L52 60 L64 70 L70 40 L84 60 L94 30 L106 56 L120 32 L128 60 L142 44 L144 72 L154 64 L152 98 Q140 70 100 66 Q60 70 48 96 Z" fill="${c}"/>`;
      case 'side':
        return `<path d="M48 100 Q44 44 100 40 Q158 42 154 96 Q150 70 128 64 Q96 78 62 70 Q52 80 48 100 Z" fill="${c}"/><path d="M62 70 Q96 78 128 64 Q110 56 84 58 Z" fill="${hairD}" opacity="0.5"/>`;
      case 'long':
        return `<path d="M48 110 Q40 40 100 40 Q160 40 152 110 Q148 76 126 66 Q100 84 74 66 Q52 78 48 110 Z" fill="${c}"/>`;
      case 'bob':
        return `<path d="M46 116 Q38 40 100 40 Q162 40 154 116 Q150 78 136 70 Q104 80 70 70 Q50 82 46 116 Z" fill="${c}"/>`;
      case 'bun':
        return `<circle cx="100" cy="36" r="20" fill="${c}"/><path d="M48 100 Q44 46 100 44 Q156 46 152 100 Q146 72 124 66 Q100 76 76 66 Q54 72 48 100 Z" fill="${c}"/>`;
      case 'slick':
        return `<path d="M48 96 Q46 42 100 40 Q156 40 152 92 Q150 64 100 60 Q62 62 48 96 Z" fill="${c}"/><path d="M60 62 Q100 50 140 60" fill="none" stroke="#555" stroke-width="2" opacity="0.6"/>`;
      case 'bald':
        return `<path d="M48 112 Q46 90 56 80 L60 108 Z M152 112 Q154 90 144 80 L140 108 Z" fill="${c}"/>`;
      default:
        return `<path d="M48 98 Q44 42 100 40 Q156 42 152 98 Q146 68 100 64 Q56 68 48 98 Z" fill="${c}"/>`;
    }
  }

  const CLOTHES = ['#d94f4f', '#3f7fbf', '#e0a43a', '#5a9e6f', '#8a63b8', '#2f3a4a', '#e57aa1', '#4fb3b0', '#c2703d', '#7a8a99', '#f2f2f2', '#355c7d'];

  // 隨機外觀：客人、應徵者
  function randomLook(rng = Math.random, gender = rng() < 0.5 ? 'f' : 'm', opts = {}) {
    const pick = (arr) => arr[Math.floor(rng() * arr.length)];
    const old = rng() < 0.18;
    return {
      gender,
      skin: pick(SKINS),
      hair: old ? pick(['#9a9a9a', '#c8c8c8', '#6e6e6e']) : pick(HAIRS),
      hairStyle: gender === 'f' ? pick(STYLES_F) : old && rng() < 0.4 ? 'bald' : pick([...STYLES_M, 'slick']),
      shirt: opts.shirt || pick(CLOTHES),
      glasses: rng() < 0.22,
      hat: opts.hat || null,
      hatColor: opts.hatColor,
      old,
    };
  }

  root.BossLooks = { staffLook, bossLook, randomLook, VISITORS, STAFF, UNIFORM, portraitSVG, shade };
})(typeof window !== 'undefined' ? window : globalThis);
