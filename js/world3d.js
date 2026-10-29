// 🌆 開放世界（GTA 風）：老闆走出店門，在真實比例的雙北街頭自由行動
// 第三人稱鏡頭跟著老闆：走路、跑步、搶路邊的車、騎別人的機車；撞人、搶車、超速會被通緝，警車會追
// 接外送、載客、跑腿進貨、街頭競速賺錢；走到地標門口就能進去（夜市、銀行、夜店……），走回自己店門口就回店
// 手機也跑得動：整座城市的建築、招牌、路面都合併成幾個網格；路樹、路燈、機車用 InstancedMesh；遠處用霧蓋掉
(function (root) {
  const THREE = root.THREE;
  const City = root.BossCity;
  const People = root.BossPeople;
  if (!THREE || !City) return;

  // ───── 尺寸（公尺） ─────
  const BLOCK = 40; // 街區邊長
  const ROAD = 14; // 馬路寬（雙向四線道）
  const P = BLOCK + ROAD;
  const SW = 3.5; // 人行道寬
  const ARC = 2.6; // 騎樓深度
  const FLOOR = 3.2;
  const GF = 4; // 一樓高度
  const LANE_CAR = 1.75; // 汽車走內線
  const LANE_MOTO = 5.2; // 機車走外線
  const KMH = 3.6;
  const LIMIT = 50; // 速限
  const W = City.W * P;
  const H = City.H * P;
  const bx0 = (i) => i * P + ROAD / 2;
  const blockCenter = (x, y) => [bx0(x) + BLOCK / 2, bx0(y) + BLOCK / 2];
  const RX0 = City.RIVER_X * P + ROAD / 2;
  const RX1 = (City.RIVER_X + 1) * P - ROAD / 2;
  const onBridge = (z) => City.BRIDGES.some((b) => Math.abs(z - b * P) < ROAD / 2);
  const inWater = (x, z) => x > RX0 && x < RX1 && !onBridge(z);
  const MIN = -ROAD / 2;
  const MAXX = W + ROAD / 2;
  const MAXZ = H + ROAD / 2;

  function rand(seed) {
    let a = seed | 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const col = new THREE.Color();

  // ───── 合併網格：每種材質一個桶，整座城市只要幾次 draw call ─────
  class Bucket {
    constructor() {
      this.p = [];
      this.n = [];
      this.c = [];
      this.u = [];
    }
    // 四個角（任意繞向，會自動翻成朝外）
    quad(v, nrm, color, uv) {
      const [a, b, c, d] = v;
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const cx = e1[1] * e2[2] - e1[2] * e2[1];
      const cy = e1[2] * e2[0] - e1[0] * e2[2];
      const cz = e1[0] * e2[1] - e1[1] * e2[0];
      let order = [0, 1, 2, 0, 2, 3];
      if (cx * nrm[0] + cy * nrm[1] + cz * nrm[2] < 0) order = [0, 2, 1, 0, 3, 2];
      col.set(color);
      for (const i of order) {
        this.p.push(...v[i]);
        this.n.push(...nrm);
        this.c.push(col.r, col.g, col.b);
        this.u.push(...(uv ? uv[i] : [0, 0]));
      }
    }
    mesh(mat) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mat);
      m.matrixAutoUpdate = false;
      return m;
    }
  }

  // 方塊：四面牆可以貼窗戶（wall 桶），頂和底放 solid 桶
  // win：窗戶貼圖從 y0 起算（一層樓一格）
  function boxInto(wall, solid, x0, y0, z0, x1, y1, z1, color, opts = {}) {
    const top = opts.topColor || color;
    solid.quad([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0], top);
    if (opts.bottom) solid.quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], color);
    const B = wall || solid;
    const uv = (ua, ub, va, vb) => (wall ? [[ua, va], [ub, va], [ub, vb], [ua, vb]] : null);
    const s = 1 / (FLOOR * 4);
    const v0 = (y0 - (opts.vBase ?? y0)) * s;
    const v1 = (y1 - (opts.vBase ?? y0)) * s;
    const skip = opts.skip || '';
    if (!skip.includes('n')) B.quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], color, uv(0, (x1 - x0) * s, v0, v1));
    if (!skip.includes('s')) B.quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], color, uv(0, (x1 - x0) * s, v0, v1));
    if (!skip.includes('w')) B.quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], color, uv(0, (z1 - z0) * s, v0, v1));
    if (!skip.includes('e')) B.quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], color, uv(0, (z1 - z0) * s, v0, v1));
  }

  // ───── 貼圖 ─────
  function canvas(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    return c;
  }
  function tex(c, repeat) {
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  // 公寓窗戶：4×4 個窗，有冷氣、鐵窗（很台）；夜光貼圖：有些窗戶亮燈
  function windowTex(kind) {
    const r = rand(kind === 'glass' ? 77 : 33);
    const lit = [];
    const base = canvas(256, 256, (c) => {
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++) {
          const x = i * 64;
          const y = j * 64;
          if (kind === 'glass') {
            const g = c.createLinearGradient(x, y, x + 64, y + 64);
            g.addColorStop(0, '#5d7f9c');
            g.addColorStop(1, '#9fb9cf');
            c.fillStyle = g;
            c.fillRect(x + 3, y + 4, 58, 56);
            c.fillStyle = 'rgba(255,255,255,.25)';
            c.fillRect(x + 3, y + 4, 58, 3);
          } else {
            c.fillStyle = 'rgba(0,0,0,.07)';
            c.fillRect(x, y + 60, 64, 4);
            const g = c.createLinearGradient(x, y + 12, x, y + 46);
            g.addColorStop(0, '#53687a');
            g.addColorStop(1, '#8ea3b3');
            c.fillStyle = '#3e4650';
            c.fillRect(x + 12, y + 10, 40, 38);
            c.fillStyle = g;
            c.fillRect(x + 14, y + 12, 36, 34);
            c.fillStyle = 'rgba(255,255,255,.5)';
            c.fillRect(x + 31, y + 12, 2, 34);
            // 鐵窗
            if (r() < 0.45) {
              c.strokeStyle = 'rgba(60,60,60,.8)';
              c.lineWidth = 2;
              for (let k = 0; k < 5; k++) {
                c.beginPath();
                c.moveTo(x + 14 + k * 9, y + 10);
                c.lineTo(x + 14 + k * 9, y + 48);
                c.stroke();
              }
              c.strokeRect(x + 11, y + 9, 42, 40);
            }
            // 冷氣室外機
            if (r() < 0.35) {
              c.fillStyle = '#d9dcdf';
              c.fillRect(x + 40, y + 48, 18, 11);
              c.fillStyle = '#8a9096';
              c.beginPath();
              c.arc(x + 49, y + 53.5, 4, 0, 7);
              c.fill();
            }
          }
          lit.push(r() < (kind === 'glass' ? 0.55 : 0.42));
        }
    });
    const glow = canvas(256, 256, (c) => {
      c.fillStyle = '#000';
      c.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++) {
          if (!lit[i * 4 + j]) continue;
          c.fillStyle = kind === 'glass' ? '#cfe3ff' : r() < 0.3 ? '#bfe0ff' : '#ffd38a';
          if (kind === 'glass') c.fillRect(i * 64 + 3, j * 64 + 4, 58, 56);
          else c.fillRect(i * 64 + 14, j * 64 + 12, 36, 34);
        }
    });
    return [tex(base, true), tex(glow, true)];
  }

  // 招牌：台灣街頭的直式招牌＋騎樓上的橫式招牌（全部虛構店名）
  const SHOPS = ['阿明牛肉麵', '好運彩券', '大眾牙醫', '歡唱KTV', '金鑽當舖', '美美髮廊', '雞排王', '手搖飲', '明亮眼鏡', '仁心藥局', '狀元補習班', '安心診所', '巷口小吃', '大同電器', '開鎖專家', '24H洗衣', '幸福旅館', '腳底按摩', '檳榔', '網咖', '滷肉飯', '豆漿店', '水電行', '房屋仲介', '手機維修', '寵物美容', '鹽酥雞', '珍珠奶茶', '麻辣火鍋', '拉麵', '早餐店', '文具行'];
  const SIGN_BG = ['#c0392b', '#1f6fb2', '#e67e22', '#16a085', '#8e44ad', '#d4a017', '#2c3e50', '#d6418a', '#27ae60', '#b5523b', '#0f7f8c', '#6c5ce7'];
  function signAtlas() {
    return canvas(1024, 1024, (c) => {
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      for (let i = 0; i < 32; i++) {
        const name = SHOPS[i];
        const bg = SIGN_BG[i % SIGN_BG.length];
        // 直式（64×256）
        const x = (i % 16) * 64;
        const y = Math.floor(i / 16) * 256;
        c.fillStyle = bg;
        c.fillRect(x, y, 64, 256);
        c.strokeStyle = '#fff';
        c.lineWidth = 3;
        c.strokeRect(x + 4, y + 4, 56, 248);
        c.fillStyle = '#fff';
        const chars = name.length > 5 ? [...name.replace('KTV', 'Ｋ')].slice(0, 5) : [...name];
        const fs = Math.min(42, 230 / chars.length);
        c.font = `bold ${fs}px "Noto Sans TC", sans-serif`;
        chars.forEach((ch, k) => c.fillText(ch, x + 32, y + 128 + (k - (chars.length - 1) / 2) * fs * 1.05));
        // 橫式（256×64）
        const hx = (i % 4) * 256;
        const hy = 512 + Math.floor(i / 4) * 64;
        c.fillStyle = i % 3 ? '#fdfaf2' : bg;
        c.fillRect(hx, hy, 256, 64);
        c.fillStyle = i % 3 ? bg : '#fff';
        c.fillRect(hx, hy + 54, 256, 10);
        c.font = 'bold 36px "Noto Sans TC", sans-serif';
        c.fillText(name, hx + 128, hy + 29);
      }
    });
  }
  function textSign(text, bg, fg = '#fff', w = 512, h = 128, fontKind) {
    const tpl = fontKind && root.BossSignFont ? root.BossSignFont(fontKind) : null;
    const F = (fs) => (tpl ? tpl.replace('110px', `${fs}px`) : `bold ${fs}px "Noto Sans TC", sans-serif`);
    return tex(
      canvas(w, h, (c) => {
        c.fillStyle = bg;
        c.fillRect(0, 0, w, h);
        c.strokeStyle = 'rgba(255,255,255,.7)';
        c.lineWidth = 6;
        c.strokeRect(6, 6, w - 12, h - 12);
        c.fillStyle = fg;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        let fs = Math.round(h * 0.56);
        c.font = F(fs);
        while (c.measureText(text).width > w - 40 && fs > 12) {
          fs -= 2;
          c.font = F(fs);
        }
        c.fillText(text, w / 2, h / 2 + 2);
      }),
    );
  }

  // ───── 車子的形狀 ─────
  const carGeoCache = new Map();
  function carGeo(model) {
    if (carGeoCache.has(model)) return carGeoCache.get(model);
    const E = root.BossEVGeo;
    const parts = [];
    const paint = (g, c) => {
      const n = g.attributes.position.count;
      const a = new Float32Array(n * 3);
      col.set(c);
      for (let i = 0; i < n; i++) a.set([col.r, col.g, col.b], i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(a, 3));
      return g.index ? g.toNonIndexed() : g;
    };
    let len = 4.6;
    if (model === 'scooter') {
      len = 1.8;
      const add = (w, h, d, x, y, z, c) => parts.push(paint(new THREE.BoxGeometry(w, h, d).translate(x, y, z), c));
      add(0.5, 0.35, 1.3, 0, 0.45, -0.05, '#ffffff'); // 車身
      add(0.46, 0.14, 0.75, 0, 0.7, -0.2, '#2a2a2a'); // 坐墊
      add(0.48, 0.8, 0.18, 0, 0.75, 0.55, '#ffffff'); // 前擋
      add(0.65, 0.08, 0.08, 0, 1.15, 0.5, '#333333'); // 龍頭
      for (const z of [-0.6, 0.65]) parts.push(paint(new THREE.CylinderGeometry(0.26, 0.26, 0.14, 12).rotateZ(Math.PI / 2).translate(0, 0.26, z), '#1d1d1d'));
    } else if (E && E.LOFTS[model]) {
      const D = E.LOFTS[model];
      const k = 4.6 / D.L;
      const lp = E.loftParts(model, 20);
      const fix = (g) => g.clone().rotateY(Math.PI / 2).scale(k, k * 1.12, k);
      parts.push(paint(fix(lp.body), '#ffffff'), paint(fix(lp.glass), '#1c2530'));
      for (const f of D.wheels)
        for (const side of [-1, 1]) {
          const wz = (D.L / 2 - f * D.L) * k;
          parts.push(paint(new THREE.CylinderGeometry(D.rad * k, D.rad * k, 0.3, 12).rotateZ(Math.PI / 2).translate(side * 0.86, D.rad * k, wz), '#1a1a1a'));
        }
      // 車燈
      parts.push(paint(new THREE.BoxGeometry(1.5, 0.12, 0.06).translate(0, 0.78, 2.28), '#fff6d8'));
      parts.push(paint(new THREE.BoxGeometry(1.5, 0.1, 0.06).translate(0, 0.85, -2.3), '#ff3b30'));
    } else {
      const add = (w, h, d, x, y, z, c) => parts.push(paint(new THREE.BoxGeometry(w, h, d).translate(x, y, z), c));
      add(1.8, 0.7, 4.4, 0, 0.6, 0, '#ffffff');
      add(1.6, 0.6, 2.2, 0, 1.2, -0.2, '#1c2530');
      for (const z of [-1.4, 1.4]) for (const x of [-0.85, 0.85]) parts.push(paint(new THREE.CylinderGeometry(0.33, 0.33, 0.28, 12).rotateZ(Math.PI / 2).translate(x, 0.33, z), '#1a1a1a'));
    }
    const merged = mergeGeos(parts);
    const out = { geo: merged, len };
    carGeoCache.set(model, out);
    return out;
  }
  function mergeGeos(list) {
    let n = 0;
    for (const g of list) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3);
    const nor = new Float32Array(n * 3);
    const cl = new Float32Array(n * 3);
    let o = 0;
    for (const g of list) {
      if (!g.attributes.normal) g.computeVertexNormals();
      pos.set(g.attributes.position.array, o * 3);
      nor.set(g.attributes.normal.array, o * 3);
      cl.set(g.attributes.color.array, o * 3);
      o += g.attributes.position.count;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(cl, 3));
    g.computeBoundingSphere();
    return g;
  }

  // ───── 路網：路口格點 (0～W, 0～H) ─────
  const segOK = (i, j, a, b) => {
    if (a < 0 || b < 0 || a > City.W || b > City.H) return false;
    // 東西向跨河只有橋
    if (j === b && Math.min(i, a) === City.RIVER_X && !City.BRIDGES.includes(j)) return false;
    return true;
  };
  function nodePath(ax, az, bx, bz) {
    const nx = City.W + 1;
    const key = (i, j) => j * nx + i;
    const cl = (v, m) => Math.max(0, Math.min(m, Math.round(v / P)));
    const s = [cl(ax, City.W), cl(az, City.H)];
    const t = [cl(bx, City.W), cl(bz, City.H)];
    const prev = new Map([[key(...s), null]]);
    const q = [s];
    while (q.length) {
      const [i, j] = q.shift();
      if (i === t[0] && j === t[1]) break;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di;
        const b = j + dj;
        if (!segOK(i, j, a, b) || prev.has(key(a, b))) continue;
        prev.set(key(a, b), [i, j]);
        q.push([a, b]);
      }
    }
    if (!prev.has(key(...t))) return [];
    const out = [];
    for (let c = t; c; c = prev.get(key(...c))) out.unshift([c[0] * P, c[1] * P]);
    return out;
  }
  // 街區南邊的路邊（任務的上下車點）
  const curbOf = (bx, by) => [blockCenter(bx, by)[0], (by + 1) * P - ROAD / 2 + 2.2];

  // ───── 世界 ─────
  class World3D {
    constructor(view, sim, opts = {}) {
      this.view = view;
      this.sim = sim;
      this.opts = opts;
      this.low = opts.quality === 'low' || opts.quality === 'medium' || ('ontouchstart' in window && Math.min(screen.width, screen.height) < 600);
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(62, 1, 0.3, this.low ? 240 : 330);
      this.scene.fog = new THREE.Fog('#bcd7ea', this.low ? 70 : 110, this.low ? 230 : 320);
      this.hemi = new THREE.HemisphereLight('#ffffff', '#6b6458', 0.8);
      this.sunL = new THREE.DirectionalLight('#fff3e0', 0.8);
      this.sunL.position.set(-60, 120, 40);
      this.scene.add(this.hemi, this.sunL);
      this.solids = Array.from({ length: City.W * City.H }, () => []);
      this.doors = [];
      this.labels = [];
      this.vehicles = [];
      this.peds = [];
      this.pick = [];
      this.camHit = {};
      this.msg = '';
      this.msgT = 0;
      this.wanted = 0;
      this.calm = 0;
      this.police = [];
      this.mission = null;
      this.gps = null;
      this.shake = 0;
      this.t = 0;
      this.build();
      this.makePlayer();
      this.makeTraffic();
      this.makePeds();
      this.spawnPickups();
      this.makeCams();
      this.makeRain();
      this.overlay = document.createElement('div');
      this.overlay.className = 'shop-overlay world-overlay';
      view.container.appendChild(this.overlay);
      this.makeLabels();
      this.makeMinimap();
      this.cam = { yaw: 0, pitch: 0.3, dist: 6, dragT: 0, pos: new THREE.Vector3() };
      this.applyTime(true);
      this.bindInput();
      this.updateCamera(1, true);
    }

    say(t, sec = 2.6) {
      this.msg = t;
      this.msgT = sec;
    }

    // ───── 蓋城市 ─────
    solid(x0, z0, x1, z1, h = 30) {
      const bx = Math.floor((Math.min(x0, x1) + Math.max(x0, x1)) / 2 / P);
      const by = Math.floor((Math.min(z0, z1) + Math.max(z0, z1)) / 2 / P);
      const a = { x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), h };
      const k = Math.max(0, Math.min(City.H - 1, by)) * City.W + Math.max(0, Math.min(City.W - 1, bx));
      this.solids[k].push(a);
    }

    build() {
      const s = this.sim;
      const r = rand(4321);
      const B = { wall: new Bucket(), glass: new Bucket(), solid: new Bucket(), sign: new Bucket(), paint: new Bucket() };
      this.B = B;
      this.trees = [];
      this.lamps = [];
      this.motos = [];
      // 地面：河的兩岸各一片柏油，河面低一點
      const ground = (x0, x1) => B.solid.quad([[x0, 0, -400], [x1, 0, -400], [x1, 0, H + 400], [x0, 0, H + 400]], [0, 1, 0], '#5d5b5a');
      ground(-400, RX0);
      ground(RX1, W + 400);
      const water = new THREE.Mesh(new THREE.PlaneGeometry(RX1 - RX0, H + 800), new THREE.MeshLambertMaterial({ color: '#4f86a8', transparent: true, opacity: 0.92 }));
      water.rotation.x = -Math.PI / 2;
      water.position.set((RX0 + RX1) / 2, -1.6, H / 2);
      this.water = water;
      this.scene.add(water);
      // 河堤、橋
      for (const x of [RX0, RX1]) B.solid.quad([[x, 0, -400], [x, 0, H + 400], [x, -2.5, H + 400], [x, -2.5, -400]], [x === RX0 ? 1 : -1, 0, 0], '#8c8a84');
      B.solid.quad([[RX0, -2.5, -400], [RX1, -2.5, -400], [RX1, -2.5, H + 400], [RX0, -2.5, H + 400]], [0, 1, 0], '#3e5f73');
      for (const b of City.BRIDGES) {
        const z = b * P;
        boxInto(null, B.solid, RX0, -0.6, z - ROAD / 2, RX1, 0, z + ROAD / 2, '#6a6764', { topColor: '#5d5b5a', bottom: true });
        for (const side of [-1, 1]) {
          const zz = z + side * (ROAD / 2 - 0.2);
          boxInto(null, B.solid, RX0, 0, zz - 0.2, RX1, 1.1, zz + 0.2, '#c9c4ba');
          this.solid(RX0, zz - 0.25, RX1, zz + 0.25, 1.1);
        }
        // 橋的路面標線
        B.paint.quad([[RX0, 0.03, z - 0.25], [RX1, 0.03, z - 0.25], [RX1, 0.03, z - 0.1], [RX0, 0.03, z - 0.1]], [0, 1, 0], '#e8c547');
        B.paint.quad([[RX0, 0.03, z + 0.1], [RX1, 0.03, z + 0.1], [RX1, 0.03, z + 0.25], [RX0, 0.03, z + 0.25]], [0, 1, 0], '#e8c547');
      }
      this.paintRoads();
      // 地標放在哪個街區（南邊一排的中間）
      const feat = new Map();
      const addFeat = (x, y, f) => {
        const k = `${x},${y}`;
        if (!feat.has(k)) feat.set(k, []);
        feat.get(k).push(f);
      };
      const h = s.homeXY;
      addFeat(h.x, h.y, { id: 'home' });
      for (const [id, L] of Object.entries(City.LANDMARKS)) addFeat(L.x, L.y, { id, L });
      for (let y = 0; y < City.H; y++)
        for (let x = 0; x < City.W; x++) {
          const t = City.typeAt(x, y);
          if (t === 'W') continue;
          this.fillBlock(x, y, t, r, feat.get(`${x},${y}`) || []);
        }
      // 城市外圍：一圈遠遠的大樓、更遠的山（台北盆地）
      for (let i = -1; i <= City.W; i++)
        for (const y of [-1, City.H]) this.backdrop(i, y, r);
      for (let j = 0; j < City.H; j++) for (const x of [-1, City.W]) this.backdrop(x, j, r);
      const mt = new THREE.MeshLambertMaterial({ color: '#7f9c86', flatShading: true });
      const mg = new THREE.ConeGeometry(1, 1, 7);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + r() * 0.2;
        const m = new THREE.Mesh(mg, mt);
        const R = 420 + r() * 80;
        m.position.set(W / 2 + Math.cos(a) * R, 0, H / 2 + Math.sin(a) * R);
        m.scale.set(120 + r() * 80, 70 + r() * 70, 120 + r() * 80);
        m.position.y = m.scale.y / 2 - 5;
        this.scene.add(m);
      }
      // 101：信義區那邊遠遠看得到（致敬，不是真的）
      const tw = new THREE.Group();
      for (let k = 0; k < 8; k++) {
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(9 - k * 0.2, 7 - k * 0.2, 22, 4), new THREE.MeshLambertMaterial({ color: '#6f9a8f' }));
        seg.position.y = 30 + k * 22;
        seg.rotation.y = Math.PI / 4;
        tw.add(seg);
      }
      const base = new THREE.Mesh(new THREE.BoxGeometry(22, 30, 22), new THREE.MeshLambertMaterial({ color: '#6f9a8f' }));
      base.position.y = 15;
      tw.add(base);
      tw.position.set(W + 150, 0, H * 0.45);
      this.scene.add(tw);

      // 材質
      const [wMap, wGlow] = windowTex('apt');
      const [gMap, gGlow] = windowTex('glass');
      this.wallMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: wMap, emissive: '#ffffff', emissiveMap: wGlow, emissiveIntensity: 0 });
      this.glassMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: gMap, emissive: '#ffffff', emissiveMap: gGlow, emissiveIntensity: 0 });
      this.solidMat = new THREE.MeshLambertMaterial({ vertexColors: true });
      this.signMat = new THREE.MeshBasicMaterial({ vertexColors: true, map: tex(signAtlas()) });
      this.paintMat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      this.scene.add(B.wall.mesh(this.wallMat), B.glass.mesh(this.glassMat), B.solid.mesh(this.solidMat), B.sign.mesh(this.signMat), B.paint.mesh(this.paintMat));
      this.B = null;
      this.makeInstances();
    }

    // 外圍的大樓：只是背景，走不過去
    backdrop(x, y, r) {
      const B = this.B;
      const ox = bx0(x);
      const oz = bx0(y);
      for (let k = 0; k < 2; k++) {
        const w = 16 + r() * 14;
        const d = 16 + r() * 14;
        const hx = ox + 2 + r() * (BLOCK - w - 4);
        const hz = oz + 2 + r() * (BLOCK - d - 4);
        const hh = GF + FLOOR * (4 + Math.floor(r() * 14));
        const glass = r() < 0.4;
        boxInto(glass ? B.glass : B.wall, B.solid, hx, 0, hz, hx + w, hh, hz + d, glass ? pick(r, ['#c7d3dc', '#b9c6cf']) : pick(r, ['#e6dccb', '#d9d2c6', '#cfc9bd', '#e8e1d6']), { vBase: 0 });
      }
      boxInto(null, this.B.solid, ox, 0, oz, ox + BLOCK, 0.15, oz + BLOCK, '#b9b2a6');
      // 城市邊界：牆（看不到，走不出去）
    }

    paintRoads() {
      const B = this.B;
      const Y = 0.02;
      const strip = (x0, z0, x1, z1, c) => B.paint.quad([[x0, Y, z0], [x1, Y, z0], [x1, Y, z1], [x0, Y, z1]], [0, 1, 0], c);
      const e = ROAD / 2;
      for (let j = 0; j <= City.H; j++)
        for (let i = 0; i <= City.W; i++) {
          const x = i * P;
          const z = j * P;
          // 東西向這段
          if (segOK(i, j, i + 1, j)) {
            const a = x + e;
            const b = x + P - e;
            if (!(a > RX0 - 1 && b < RX1 + 1)) {
              strip(a, z - 0.28, b, z - 0.14, '#e8c547');
              strip(a, z + 0.14, b, z + 0.28, '#e8c547');
              for (let u = a + 3; u < b - 4; u += 6) for (const s of [-1, 1]) strip(u, z + s * 3.5 - 0.08, u + 3, z + s * 3.5 + 0.08, '#eeeeea');
              // 機車停等區、停止線
              strip(b - 5.4, z + 0.3, b - 5, z + e - 0.3, '#eeeeea');
              strip(a + 5, z - e + 0.3, a + 5.4, z - 0.3, '#eeeeea');
            }
          }
          if (j < City.H) {
            const a = z + e;
            const b = z + P - e;
            strip(x - 0.28, a, x - 0.14, b, '#e8c547');
            strip(x + 0.14, a, x + 0.28, b, '#e8c547');
            for (let u = a + 3; u < b - 4; u += 6) for (const s of [-1, 1]) strip(x + s * 3.5 - 0.08, u, x + s * 3.5 + 0.08, u + 3, '#eeeeea');
            strip(x - e + 0.3, b - 5.4, x - 0.3, b - 5, '#eeeeea');
            strip(x + 0.3, a + 5, x + e - 0.3, a + 5.4, '#eeeeea');
          }
          // 斑馬線：路口四邊
          if (x > RX0 - 1 && x < RX1 + 1) continue;
          for (const [dx, dz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
            const ni = i + dx;
            const nj = j + dz;
            if (ni < 0 || nj < 0 || ni > City.W || nj > City.H) continue;
            if (!segOK(i, j, ni, nj)) continue;
            for (let k = -e + 0.6; k < e - 0.5; k += 1.3) {
              if (dz) {
                const z0 = z + dz * (e + 0.6);
                strip(x + k, Math.min(z0, z0 + dz * 3.4), x + k + 0.65, Math.max(z0, z0 + dz * 3.4), '#f2f0ea');
              } else {
                const x0 = x + dx * (e + 0.6);
                strip(Math.min(x0, x0 + dx * 3.4), z + k, Math.max(x0, x0 + dx * 3.4), z + k + 0.65, '#f2f0ea');
              }
            }
          }
        }
    }

    fillBlock(bx, by, t, r, feats) {
      const B = this.B;
      const ox = bx0(bx);
      const oz = bx0(by);
      const park = t === 'P';
      // 人行道：整塊抬高 15 公分，邊緣是路緣石
      boxInto(null, B.solid, ox, 0, oz, ox + BLOCK, 0.15, oz + BLOCK, park ? '#7fae6b' : '#bdb5a8', { topColor: park ? '#7fae6b' : '#bdb5a8' });
      if (park) boxInto(null, B.solid, ox + SW, 0.15, oz + SW, ox + BLOCK - SW, 0.17, oz + BLOCK - SW, '#8fbe72');
      else {
        // 人行道地磚的接縫（淡淡的線）
        for (let k = 3; k < BLOCK; k += 3) {
          B.paint.quad([[ox + k, 0.16, oz], [ox + k + 0.06, 0.16, oz], [ox + k + 0.06, 0.16, oz + SW], [ox + k, 0.16, oz + SW]], [0, 1, 0], '#a9a194');
          B.paint.quad([[ox + k, 0.16, oz + BLOCK - SW], [ox + k + 0.06, 0.16, oz + BLOCK - SW], [ox + k + 0.06, 0.16, oz + BLOCK], [ox + k, 0.16, oz + BLOCK]], [0, 1, 0], '#a9a194');
        }
      }
      // 路樹、路燈、路邊的機車
      for (let k = 4; k < BLOCK - 2; k += 9) {
        for (const [x, z, rot] of [[ox + k, oz + 0.9, 0], [ox + k, oz + BLOCK - 0.9, 0], [ox + 0.9, oz + k, 1], [ox + BLOCK - 0.9, oz + k, 1]]) {
          if (r() < (park ? 0.9 : 0.45)) this.trees.push([x, z, 0.8 + r() * 0.5, r()]);
          else if (!park && r() < 0.7) this.motos.push([x + (rot ? 0 : r() * 2), z + (rot ? r() * 2 : 0), rot ? 0 : Math.PI / 2, r()]);
        }
      }
      for (const [x, z] of [[ox + 1, oz + 1], [ox + BLOCK - 1, oz + 1], [ox + 1, oz + BLOCK - 1], [ox + BLOCK - 1, oz + BLOCK - 1], [ox + BLOCK / 2 + 11, oz + 0.6], [ox + BLOCK / 2 - 11, oz + BLOCK - 0.6]]) this.lamps.push([x, z]);

      const south = feats.find((f) => f.id === 'home') || feats[0];
      const north = feats.find((f) => f !== south);
      const x0 = ox + SW;
      const x1 = ox + BLOCK - SW;
      const z0 = oz + SW;
      const z1 = oz + BLOCK - SW;
      const lm = (f, side, a, b, c, d) => this.landmarkBuilding(f, bx, by, side, r, a, b, c, d);

      if (park || t === 'T' || t === 'M' || t === 'H' || t === 'S' || t === 'I') {
        if (park) {
          for (let k = 0; k < 14; k++) this.trees.push([x0 + 2 + r() * (x1 - x0 - 4), z0 + 2 + r() * (z1 - z0 - 4), 1 + r() * 0.6, r()]);
          // 步道
          boxInto(null, B.solid, ox + BLOCK / 2 - 1.2, 0.15, z0, ox + BLOCK / 2 + 1.2, 0.18, z1, '#d8cdb5');
          boxInto(null, B.solid, x0, 0.15, oz + BLOCK / 2 - 1.2, x1, 0.18, oz + BLOCK / 2 + 1.2, '#d8cdb5');
          const pond = new THREE.Mesh(new THREE.CircleGeometry(5, 20), new THREE.MeshLambertMaterial({ color: '#5f9fc2' }));
          pond.rotation.x = -Math.PI / 2;
          pond.position.set(ox + BLOCK * 0.72, 0.2, oz + BLOCK * 0.3);
          this.scene.add(pond);
        } else if (t === 'T') this.temple(ox, oz);
        else if (t === 'M') this.nightMarket(ox, oz, r);
        else if (t === 'H') this.station(ox, oz);
        else if (t === 'S') this.school(ox, oz, r);
        else if (t === 'I') this.warehouse(ox, oz, r);
        for (const f of feats) this.addDoor(f, bx, by, 's', f === south ? ox + BLOCK / 2 : ox + BLOCK / 2 + 8);
        return;
      }
      // 住宅、商店街、辦公區：前後兩排，地標放南排中間
      const office = t === 'O';
      const rows = [
        ['n', z0, z0 + 14],
        ['s', z1 - 14, z1],
      ];
      for (const [side, za, zb] of rows) {
        const f = side === 's' ? south : north;
        let parts = [[x0, x1]];
        if (f) {
          const fw = f.id === 'home' ? 12.8 : 16;
          const cx = ox + BLOCK / 2;
          parts = [[x0, cx - fw / 2], [cx + fw / 2, x1]];
          lm(f, side, cx - fw / 2, cx + fw / 2, za, zb);
        }
        if (office && !f && side === 's' && r() < 0.5) {
          // 辦公大樓前的廣場
          for (let k = 0; k < 4; k++) this.trees.push([x0 + 3 + k * 8, zb - 3, 1, r()]);
          continue;
        }
        for (const [a, b] of parts) {
          let x = a;
          while (b - x > 3) {
            let w = office ? b - x : FLOOR * (2 + Math.floor(r() * 3));
            if (b - x - w < 6.4) w = b - x;
            this.building(x, x + w, za, zb, side, t, r);
            x += w;
          }
        }
      }
    }

    // 一棟樓：一樓是騎樓＋店面，上面是公寓或辦公室；招牌直的橫的都有
    building(xa, xb, za, zb, side, t, r) {
      const B = this.B;
      const office = t === 'O';
      const floors = office ? 8 + Math.floor(r() * 12) : t === 'C' ? 2 + Math.floor(r() * 4) : 3 + Math.floor(r() * 5);
      const top = GF + floors * FLOOR;
      const front = side === 's' ? zb : za;
      const back = side === 's' ? za : zb;
      const dir = side === 's' ? 1 : -1;
      const colr = office ? pick(r, ['#c7d3dc', '#b9c6cf', '#d2d8dc', '#aebfca']) : pick(r, ['#e6dccb', '#d9d2c6', '#efe8dc', '#d6c7b6', '#e2d6d0', '#d3dccb', '#cfd5da', '#f0e6d2']);
      // 上面的樓層
      boxInto(office ? B.glass : B.wall, B.solid, xa + 0.05, GF, Math.min(front, back), xb - 0.05, top, Math.max(front, back), colr, { vBase: GF, topColor: '#9a958d' });
      // 頂樓加蓋、水塔（很台）
      if (!office && r() < 0.6) {
        const w = Math.min(xb - xa - 1, 5);
        boxInto(null, B.solid, xa + 0.5, top, back - dir * 7, xa + 0.5 + w, top + 2.6, back - dir * 1, r() < 0.5 ? '#7d8b96' : '#a8a196');
        boxInto(null, B.solid, xb - 2.5, top, back - dir * 3, xb - 0.8, top + 1.6, back - dir * 1.3, '#d9d6cf');
      }
      // 一樓：往裡縮一個騎樓的深度
      const shopFront = front - dir * ARC;
      const sc = pick(r, ['#3a4048', '#4a3f37', '#2f3a3f']);
      boxInto(null, B.solid, xa + 0.05, 0.15, Math.min(shopFront, back), xb - 0.05, GF, Math.max(shopFront, back), office ? '#5b6670' : colr);
      // 店面玻璃（一點點偏暖的燈）
      const fz = shopFront + dir * 0.02;
      B.solid.quad([[xa + 0.5, 0.2, fz], [xb - 0.5, 0.2, fz], [xb - 0.5, GF - 0.6, fz], [xa + 0.5, GF - 0.6, fz]], [0, 0, dir], sc);
      // 騎樓柱子、天花板
      for (let x = xa + 0.3; x < xb; x += Math.max(3.2, (xb - xa - 0.6) / Math.max(1, Math.round((xb - xa) / 4)))) boxInto(null, B.solid, x, 0.15, front - dir * 0.6 - 0.3, x + 0.6, GF, front - dir * 0.6 + 0.3, colr);
      boxInto(null, B.solid, xb - 0.65, 0.15, front - dir * 0.6 - 0.3, xb - 0.05, GF, front - dir * 0.6 + 0.3, colr);
      B.solid.quad([[xa, GF - 0.01, front], [xb, GF - 0.01, front], [xb, GF - 0.01, shopFront], [xa, GF - 0.01, shopFront]], [0, -1, 0], '#d8d2c6');
      // 碰撞：店面那塊（騎樓可以走）
      this.solid(xa, Math.min(shopFront, back), xb, Math.max(shopFront, back), top);
      for (let x = xa + 0.3; x < xb - 0.5; x += 4) this.solid(x, front - dir * 0.6 - 0.3, x + 0.6, front - dir * 0.6 + 0.3, GF);
      if (office) return;
      // 橫式招牌（騎樓上緣）
      const id = Math.floor(r() * 32);
      const u0 = (id % 4) * 0.25;
      const v0 = 1 - (512 + Math.floor(id / 4) * 64 + 64) / 1024;
      const v1 = 1 - (512 + Math.floor(id / 4) * 64) / 1024;
      const sz = front + dir * 0.08;
      B.sign.quad([[xa + 0.3, GF + 0.15, sz], [xb - 0.3, GF + 0.15, sz], [xb - 0.3, GF + 1.35, sz], [xa + 0.3, GF + 1.35, sz]], [0, 0, dir], '#ffffff', dir > 0 ? [[u0, v0], [u0 + 0.25, v0], [u0 + 0.25, v1], [u0, v1]] : [[u0 + 0.25, v0], [u0, v0], [u0, v1], [u0 + 0.25, v1]]);
      // 直式招牌：垂直牆面伸出來
      if (r() < 0.75) {
        const vid = Math.floor(r() * 32);
        const vu0 = (vid % 16) / 16;
        const vv0 = 1 - ((Math.floor(vid / 16) + 1) * 256) / 1024;
        const vv1 = 1 - (Math.floor(vid / 16) * 256) / 1024;
        const sx = xa + 0.8;
        const y0 = GF + 1.8;
        const y1 = y0 + Math.min(7, floors * FLOOR - 2);
        const zA = front + dir * 0.1;
        const zB = front + dir * 1.5;
        const uA = [[vu0, vv0], [vu0 + 1 / 16, vv0], [vu0 + 1 / 16, vv1], [vu0, vv1]];
        const uB = [[vu0 + 1 / 16, vv0], [vu0, vv0], [vu0, vv1], [vu0 + 1 / 16, vv1]];
        // 兩面都有字（不會左右顛倒）
        const flip = dir < 0;
        B.sign.quad([[sx - 0.03, y0, zA], [sx - 0.03, y0, zB], [sx - 0.03, y1, zB], [sx - 0.03, y1, zA]], [-1, 0, 0], '#ffffff', flip ? uB : uA);
        B.sign.quad([[sx + 0.03, y0, zA], [sx + 0.03, y0, zB], [sx + 0.03, y1, zB], [sx + 0.03, y1, zA]], [1, 0, 0], '#ffffff', flip ? uA : uB);
      }
    }

    // 地標的那棟樓：大招牌＋門口發光的圈
    landmarkBuilding(f, bx, by, side, r, xa, xb, za, zb) {
      const B = this.B;
      const s = this.sim;
      const dir = side === 's' ? 1 : -1;
      const front = side === 's' ? zb : za;
      const back = side === 's' ? za : zb;
      const home = f.id === 'home';
      const L = f.L;
      let colr = '#e8e0d2';
      let floors = 3;
      let label = L ? `${L.icon} ${L.name}` : '';
      let bg = '#2c3e50';
      if (home) {
        bg = (s.style && s.style.sign) || s.ind.signColor || '#e0582b';
        label = `${s.ind.icon || '🏪'} ${s.shopName}`;
        floors = 3;
      } else if (L && L.site) {
        const br = (s.branches || []).find((b) => b.site === f.id);
        if (br) {
          bg = (s.style && s.style.sign) || s.ind.signColor || '#e0582b';
          label = `${s.shopName} ${L.name}店`;
        } else bg = '#5d6d7e';
        floors = 6;
      } else if (f.id === 'bank') {
        colr = '#d9dde0';
        bg = '#1f6fb2';
        floors = 10;
      } else if (f.id === 'club') {
        colr = '#2b2134';
        bg = '#6c3ab6';
        floors = 4;
      } else if (f.id === 'gym') {
        bg = '#d35400';
        floors = 4;
      } else if (f.id === 'guild') {
        bg = '#8a5a2b';
        floors = 5;
      } else if (f.id === 'detective') {
        bg = '#34495e';
        colr = '#c9c2b6';
        floors = 4;
      } else if (f.id === 'wholesale') {
        bg = '#27ae60';
        floors = 1;
      } else if (f.id === 'mrt') {
        bg = '#0070bd';
        floors = 1;
      }
      const top = GF + floors * FLOOR;
      boxInto(floors > 1 ? B.wall : null, B.solid, xa, GF, Math.min(front, back), xb, top, Math.max(front, back), colr, { vBase: GF, topColor: '#9a958d' });
      const shopFront = front - dir * ARC;
      boxInto(null, B.solid, xa, 0.15, Math.min(shopFront, back), xb, GF, Math.max(shopFront, back), colr);
      const fz = shopFront + dir * 0.02;
      B.solid.quad([[xa + 0.6, 0.2, fz], [xb - 0.6, 0.2, fz], [xb - 0.6, GF - 0.5, fz], [xa + 0.6, GF - 0.5, fz]], [0, 0, dir], home ? '#6b5a44' : '#39424a');
      B.solid.quad([[xa, GF - 0.01, front], [xb, GF - 0.01, front], [xb, GF - 0.01, shopFront], [xa, GF - 0.01, shopFront]], [0, -1, 0], '#d8d2c6');
      for (const x of [xa + 0.2, xb - 0.8]) boxInto(null, B.solid, x, 0.15, front - dir * 0.6 - 0.3, x + 0.6, GF, front - dir * 0.6 + 0.3, colr);
      this.solid(xa, Math.min(shopFront, back), xb, Math.max(shopFront, back), top);
      // 雨遮（自己的店用招牌色）
      if (home) {
        const aw = new THREE.Mesh(new THREE.BoxGeometry(xb - xa - 1, 0.15, 1.8), new THREE.MeshLambertMaterial({ color: bg }));
        aw.position.set((xa + xb) / 2, GF - 0.7, shopFront + dir * 0.9);
        aw.rotation.x = dir * 0.25;
        this.scene.add(aw);
      }
      // 大招牌（自己畫的貼圖）
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(xb - xa - 1, 2.2), new THREE.MeshBasicMaterial({ map: textSign(label, bg, '#fff', 512, 128, home ? this.sim.custom && this.sim.custom.font : null) }));
      sign.position.set((xa + xb) / 2, GF + 1.3, front + dir * 0.1);
      if (dir < 0) sign.rotation.y = Math.PI;
      this.scene.add(sign);
      // 對手的店：開在你家隔壁
      if (home && s.rival && !s.rival.closed) {
        const rs = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.6), new THREE.MeshBasicMaterial({ map: textSign(`${s.rival.name}`, '#5a5f6e') }));
        rs.position.set(xb + 5.5, GF + 0.9, front + dir * 0.12);
        if (dir < 0) rs.rotation.y = Math.PI;
        this.scene.add(rs);
        this.addDoor({ id: 'rival' }, bx, by, side, xb + 5.5);
      }
      this.addDoor(f, bx, by, side, (xa + xb) / 2);
    }

    addDoor(f, bx, by, side, x) {
      const oz = bx0(by);
      const z = side === 's' ? oz + BLOCK - SW + 1.2 : oz + SW - 1.2;
      const home = f.id === 'home';
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.35, 28), new THREE.MeshBasicMaterial({ color: home ? '#ffb347' : '#5fd1ff', transparent: true, opacity: 0.85, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.2, z);
      this.scene.add(ring);
      const L = f.L || City.LANDMARKS[f.id];
      const name = home ? this.sim.shopName : f.id === 'rival' ? (this.sim.rival ? this.sim.rival.name : '對手') : L ? L.name : f.id;
      const icon = home ? '🏪' : f.id === 'rival' ? '🥊' : L ? L.icon : '📍';
      this.doors.push({ id: f.id, x, z, ring, name, icon, home });
    }

    temple(ox, oz) {
      const B = this.B;
      const cx = ox + BLOCK / 2;
      boxInto(null, B.solid, ox + 6, 0.15, oz + 6, ox + BLOCK - 6, 0.5, oz + BLOCK - 12, '#c9bfae');
      boxInto(null, B.solid, cx - 10, 0.5, oz + 9, cx + 10, 6, oz + 22, '#b8322a');
      boxInto(null, B.solid, cx - 12, 6, oz + 8, cx + 12, 6.6, oz + 23, '#d9a441');
      boxInto(null, B.solid, cx - 9, 6.6, oz + 10, cx + 9, 8, oz + 21, '#e0b04a');
      boxInto(null, B.solid, cx - 7, 8, oz + 14, cx + 7, 8.5, oz + 17, '#2f8a5a');
      for (const x of [cx - 9.5, cx - 4, cx + 3.4, cx + 8.9]) boxInto(null, B.solid, x, 0.5, oz + 21.6, x + 0.6, 6, oz + 22.2, '#d9483b');
      boxInto(null, B.solid, cx - 1, 0.15, oz + 27, cx + 1, 1.6, oz + 29, '#5a4a3a'); // 香爐
      this.solid(cx - 10, oz + 9, cx + 10, oz + 22, 8);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.6), new THREE.MeshBasicMaterial({ map: textSign('福德宮', '#b8322a', '#ffd76a') }));
      sign.position.set(cx, 4.8, oz + 22.3);
      this.scene.add(sign);
    }

    nightMarket(ox, oz, r) {
      const B = this.B;
      // 一排一排的攤位，中間是走道
      for (let row = 0; row < 3; row++) {
        const z = oz + 7 + row * 11;
        for (let k = 0; k < 7; k++) {
          const x = ox + 4 + k * 4.6;
          const c = pick(r, ['#e74c3c', '#f39c12', '#e67e22', '#c0392b', '#d35400', '#f1c40f']);
          boxInto(null, B.solid, x, 0.15, z, x + 3.6, 1.1, z + 2.4, '#d8d1c4');
          for (const px of [x, x + 3.4]) boxInto(null, B.solid, px, 1.1, z, px + 0.15, 2.6, z + 0.15, '#666');
          boxInto(null, B.solid, x - 0.2, 2.6, z - 0.4, x + 3.8, 2.8, z + 2.8, c);
          // 燈籠、攤位招牌（用招牌貼圖）
          const id = Math.floor(r() * 32);
          const u0 = (id % 4) * 0.25;
          const v0 = 1 - (512 + Math.floor(id / 4) * 64 + 64) / 1024;
          const v1 = v0 + 64 / 1024;
          B.sign.quad([[x, 2.0, z + 2.85], [x + 3.6, 2.0, z + 2.85], [x + 3.6, 2.6, z + 2.85], [x, 2.6, z + 2.85]], [0, 0, 1], '#ffffff', [[u0, v0], [u0 + 0.25, v0], [u0 + 0.25, v1], [u0, v1]]);
          this.solid(x, z, x + 3.6, z + 2.4, 2.8);
        }
      }
      // 入口的牌樓
      const gate = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.2), new THREE.MeshBasicMaterial({ map: textSign('🏮 觀光夜市', '#c0392b', '#ffe08a'), side: THREE.DoubleSide }));
      gate.position.set(ox + BLOCK / 2, 5.2, oz + BLOCK - 1.5);
      this.scene.add(gate);
      for (const x of [ox + BLOCK / 2 - 7.5, ox + BLOCK / 2 + 7]) boxInto(null, B.solid, x, 0.15, oz + BLOCK - 2, x + 0.5, 6.3, oz + BLOCK - 1.5, '#b8322a');
    }

    station(ox, oz) {
      const B = this.B;
      boxInto(B.glass, B.solid, ox + 4, 0.15, oz + 6, ox + BLOCK - 4, 12, oz + BLOCK - 10, '#c9d6de', { vBase: 0, topColor: '#8a98a3' });
      boxInto(null, B.solid, ox + 2, 12, oz + 4, ox + BLOCK - 2, 13, oz + BLOCK - 8, '#e6e9eb');
      this.solid(ox + 4, oz + 6, ox + BLOCK - 4, oz + BLOCK - 10, 13);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 2), new THREE.MeshBasicMaterial({ map: textSign('🚄 板橋站', '#e67e22') }));
      sign.position.set(ox + BLOCK / 2, 9.5, oz + BLOCK - 9.9);
      this.scene.add(sign);
    }

    school(ox, oz, r) {
      const B = this.B;
      boxInto(B.wall, B.solid, ox + 4, 0.15, oz + 4, ox + BLOCK - 4, GF + FLOOR * 2, oz + 13, '#efe0b8', { vBase: 0 });
      this.solid(ox + 4, oz + 4, ox + BLOCK - 4, oz + 13, 11);
      boxInto(null, B.solid, ox + 6, 0.15, oz + 16, ox + BLOCK - 6, 0.2, oz + BLOCK - 6, '#b5523b');
      boxInto(null, B.solid, ox + 9, 0.2, oz + 19, ox + BLOCK - 9, 0.22, oz + BLOCK - 9, '#79a85a');
      // 圍牆
      for (const [a, b, c, d] of [[ox + 3, oz + BLOCK - 4, ox + BLOCK / 2 - 3, oz + BLOCK - 3.6], [ox + BLOCK / 2 + 3, oz + BLOCK - 4, ox + BLOCK - 3, oz + BLOCK - 3.6]]) {
        boxInto(null, B.solid, a, 0.15, b, c, 1.6, d, '#d9cfbf');
        this.solid(a, b, c, d, 1.6);
      }
    }

    warehouse(ox, oz, r) {
      const B = this.B;
      for (const [za, zb] of [[oz + SW + 1, oz + 18], [oz + 22, oz + BLOCK - SW - 1]]) {
        const h = 7 + r() * 4;
        boxInto(null, B.solid, ox + SW + 1, 0.15, za, ox + BLOCK - SW - 1, h, zb, pick(r, ['#9aa3a8', '#b0a999', '#8e9a8c']), { topColor: '#7d8487' });
        for (let x = ox + 8; x < ox + BLOCK - 10; x += 9) B.solid.quad([[x, 0.2, zb + 0.02], [x + 5, 0.2, zb + 0.02], [x + 5, 4.5, zb + 0.02], [x, 4.5, zb + 0.02]], [0, 0, 1], '#5f666b');
        this.solid(ox + SW + 1, za, ox + BLOCK - SW - 1, zb, h);
      }
    }

    // 路樹、路燈、停在路邊的機車：InstancedMesh（各一次 draw call）
    makeInstances() {
      const m4 = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const v = new THREE.Vector3();
      const sc = new THREE.Vector3();
      const yAx = new THREE.Vector3(0, 1, 0);
      const paint = (g, c) => {
        const n = g.attributes.position.count;
        const a = new Float32Array(n * 3);
        col.set(c);
        for (let i = 0; i < n; i++) a.set([col.r, col.g, col.b], i * 3);
        g.setAttribute('color', new THREE.BufferAttribute(a, 3));
        return g.index ? g.toNonIndexed() : g;
      };
      // 樹
      const treeGeo = mergeGeos([paint(new THREE.CylinderGeometry(0.15, 0.22, 2.4, 6).translate(0, 1.2, 0), '#5a4330'), paint(new THREE.IcosahedronGeometry(1.7, 0).translate(0, 3.4, 0), '#ffffff'), paint(new THREE.IcosahedronGeometry(1.2, 0).translate(0.6, 4.4, 0.3), '#ffffff')]);
      const trees = new THREE.InstancedMesh(treeGeo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), this.trees.length);
      this.trees.forEach(([x, z, s, k], i) => {
        m4.compose(v.set(x, 0.15, z), q.setFromAxisAngle(yAx, k * 6), sc.set(s, s, s));
        trees.setMatrixAt(i, m4);
        trees.setColorAt(i, col.set(pick(() => k, ['#6fa35a', '#5d9a4f', '#7cb062', '#4f8a48'])));
      });
      this.scene.add(trees);
      // 路燈：桿子＋燈頭（燈頭晚上會亮）
      const poleGeo = mergeGeos([paint(new THREE.CylinderGeometry(0.08, 0.1, 6, 6).translate(0, 3, 0), '#55595e'), paint(new THREE.BoxGeometry(0.1, 0.1, 1.6).translate(0, 6, 0.75), '#55595e')]);
      const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), this.lamps.length);
      this.lampHeads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.15, 0.6), new THREE.MeshBasicMaterial({ color: '#cfcfcf' }), this.lamps.length);
      this.lamps.forEach(([x, z], i) => {
        // 燈頭朝向馬路
        const bxI = Math.floor(x / P);
        const lx = x - bx0(bxI);
        const bzI = Math.floor(z / P);
        const lz = z - bx0(bzI);
        const ang = lz < 2 ? Math.PI : lz > BLOCK - 2 ? 0 : lx < 2 ? -Math.PI / 2 : Math.PI / 2;
        q.setFromAxisAngle(yAx, ang);
        m4.compose(v.set(x, 0.15, z), q, sc.set(1, 1, 1));
        poles.setMatrixAt(i, m4);
        const hx = x + Math.sin(ang) * 1.5;
        const hz = z + Math.cos(ang) * 1.5;
        m4.compose(v.set(hx, 6.05, hz), q, sc.set(1, 1, 1));
        this.lampHeads.setMatrixAt(i, m4);
      });
      this.scene.add(poles, this.lampHeads);
      // 路邊停的機車（台灣街頭的風景）
      const moto = carGeo('scooter').geo;
      const motos = new THREE.InstancedMesh(moto, new THREE.MeshLambertMaterial({ vertexColors: true }), this.motos.length);
      this.motos.forEach(([x, z, a, k], i) => {
        m4.compose(v.set(x, 0.15, z), q.setFromAxisAngle(yAx, a), sc.set(1, 1, 1));
        motos.setMatrixAt(i, m4);
        motos.setColorAt(i, col.set(pick(() => k, ['#ffffff', '#c0392b', '#2c3e50', '#7f8c8d', '#e8d9b5', '#1f6fb2', '#f1c40f'])));
      });
      this.scene.add(motos);
    }

    // ───── 碰撞 ─────
    // 圓（x, z, 半徑）有沒有撞到房子、河、城市邊界
    blocked(x, z, rad) {
      if (x < MIN + rad || x > MAXX - rad || z < MIN + rad || z > MAXZ - rad) return true;
      if (inWater(x - rad, z) || inWater(x + rad, z) || inWater(x, z - rad) || inWater(x, z + rad)) return true;
      const bx = Math.floor(x / P);
      const by = Math.floor(z / P);
      for (let j = by - 1; j <= by + 1; j++)
        for (let i = bx - 1; i <= bx + 1; i++) {
          if (i < 0 || j < 0 || i >= City.W || j >= City.H) continue;
          for (const a of this.solids[j * City.W + i]) {
            const cx = Math.max(a.x0, Math.min(x, a.x1));
            const cz = Math.max(a.z0, Math.min(z, a.z1));
            if ((cx - x) ** 2 + (cz - z) ** 2 < rad * rad) return true;
          }
        }
      return false;
    }
    // 鏡頭被房子擋住：從角色往鏡頭打一條線，碰到房子就拉近
    rayHit(o, d, maxT) {
      let best = maxT;
      const bx = Math.floor(o.x / P);
      const by = Math.floor(o.z / P);
      for (let j = by - 1; j <= by + 1; j++)
        for (let i = bx - 1; i <= bx + 1; i++) {
          if (i < 0 || j < 0 || i >= City.W || j >= City.H) continue;
          for (const a of this.solids[j * City.W + i]) {
            let t0 = 0;
            let t1 = best;
            let ok = true;
            for (const [oo, dd, lo, hi] of [[o.x, d.x, a.x0, a.x1], [o.y, d.y, 0, a.h], [o.z, d.z, a.z0, a.z1]]) {
              if (Math.abs(dd) < 1e-6) {
                if (oo < lo || oo > hi) ok = false;
                continue;
              }
              let ta = (lo - oo) / dd;
              let tb = (hi - oo) / dd;
              if (ta > tb) [ta, tb] = [tb, ta];
              t0 = Math.max(t0, ta);
              t1 = Math.min(t1, tb);
              if (t0 > t1) ok = false;
            }
            if (ok && t0 < best) best = t0;
          }
        }
      return best;
    }
    groundY(x, z) {
      const lx = ((x - ROAD / 2) % P + P) % P;
      const lz = ((z - ROAD / 2) % P + P) % P;
      if (x > RX0 && x < RX1) return 0;
      return lx < BLOCK && lz < BLOCK && x > 0 && z > 0 && x < W && z < H ? 0.15 : 0;
    }

    // ───── 玩家 ─────
    makePlayer() {
      const s = this.sim;
      const holder = new THREE.Group();
      if (People) {
        const p = People.make(root.BossLooks.bossLook(this.opts.gender || 'm'), { boss: true });
        holder.add(p.group);
        this.rig = p;
        const box = new THREE.Box3().setFromObject(p.group);
        this.pScale = 1.75 / Math.max(0.5, box.max.y - box.min.y);
        holder.scale.setScalar(this.pScale);
      }
      this.scene.add(holder);
      // 頭上的小箭頭：遠遠也找得到自己
      const door = this.doors.find((d) => d.home);
      const sx = door ? door.x : W / 2;
      const sz = door ? door.z + 1.2 : H / 2;
      this.player = { g: holder, x: sx, z: sz, y: 0.15, dir: Math.PI, v: 0, car: null, run: false };
      // 自己的車停在店門口（沒買車就是一台機車）
      const cid = s.owner && (s.owner.car === true ? 'gas' : s.owner.car);
      const model = s.carInfo ? (['m3', 'my', 'ms', 'mx'].includes(cid) ? cid : 'm3') : 'scooter';
      const color = model === 'scooter' ? '#e0582b' : { m3: '#f2f2f2', my: '#2b4c8c', ms: '#b3261e', mx: '#1d1d1f', ct: '#b8bcc0', gas: '#9aa3ab' }[cid] || '#d9482b';
      const by = Math.floor(sz / P);
      const curbZ = (by + 1) * P - ROAD / 2 + 2.4;
      const own = this.addVehicle(model, color, sx + 6, curbZ, -Math.PI / 2, { own: true, name: s.carInfo ? s.carInfo.name : '老闆的機車' });
      own.parked = true;
    }

    addVehicle(model, color, x, z, dir, extra = {}) {
      const { geo, len } = carGeo(model);
      const g = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({ vertexColors: true, color });
      const body = new THREE.Mesh(geo, mat);
      g.add(body);
      const scooter = model === 'scooter';
      const v = { g, body, mat, model, color, scooter, len, x, z, y: 0, dir, v: 0, steer: 0, rad: scooter ? 0.6 : 1.05, maxV: scooter ? 17 : 30, accel: scooter ? 7 : 9, ai: null, stun: 0, ...extra };
      if (extra.taxi) {
        const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.3), new THREE.MeshBasicMaterial({ color: '#ffe066' }));
        sign.position.set(0, 1.55, -0.3);
        g.add(sign);
      }
      if (extra.police) {
        v.barR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), new THREE.MeshBasicMaterial({ color: '#ff2b2b' }));
        v.barB = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), new THREE.MeshBasicMaterial({ color: '#2b6bff' }));
        v.barR.position.set(-0.3, 1.55, -0.3);
        v.barB.position.set(0.3, 1.55, -0.3);
        g.add(v.barR, v.barB);
        v.maxV = 31;
      }
      // 機車上的騎士
      if (scooter && People && !extra.own) {
        const rider = People.make(root.BossLooks.randomLook(Math.random));
        const holder = new THREE.Group();
        holder.add(rider.group);
        holder.scale.setScalar(this.pScale || 1.3);
        holder.position.set(0, 0.35, -0.25);
        rider.legL.rotation.x = rider.legR.rotation.x = -1.3;
        rider.armL.rotation.x = rider.armR.rotation.x = -1.1;
        g.add(holder);
        v.rider = holder;
      }
      g.position.set(x, 0, z);
      g.rotation.y = dir;
      this.scene.add(g);
      this.vehicles.push(v);
      return v;
    }

    removeVehicle(v) {
      this.scene.remove(v.g);
      v.mat.dispose();
      const i = this.vehicles.indexOf(v);
      if (i >= 0) this.vehicles.splice(i, 1);
    }

    // 上車／下車：搶別人的車會被通緝
    nearVehicle() {
      const p = this.player;
      let best = null;
      let bd = 4;
      for (const v of this.vehicles) {
        if (v.police && this.wanted) continue;
        const d = Math.hypot(v.x - p.x, v.z - p.z);
        if (d < bd) {
          bd = d;
          best = v;
        }
      }
      return best;
    }
    toggleVehicle() {
      const p = this.player;
      if (p.car) {
        const v = p.car;
        if (Math.abs(v.v) > 4) return this.say('先停車才能下車');
        // 從駕駛座那邊下車
        const side = v.scooter ? 1.0 : 1.6;
        const rx = -Math.cos(v.dir);
        const rz = Math.sin(v.dir);
        let ox = v.x - rx * side;
        let oz = v.z - rz * side;
        if (this.blocked(ox, oz, 0.35)) {
          ox = v.x + rx * side;
          oz = v.z + rz * side;
        }
        p.x = ox;
        p.z = oz;
        p.car = null;
        v.v = 0;
        v.parked = true;
        p.g.visible = true;
        if (v.scooter && !v.rider) this.seatPlayer(null);
        return true;
      }
      const v = this.nearVehicle();
      if (!v) return false;
      if (v.ai) {
        // 搶車！司機被拉下車
        const lx = v.x;
        const lz = v.z;
        v.ai = null;
        if (v.rider) {
          v.g.remove(v.rider);
          v.rider = null;
        }
        this.ejectDriver(lx, lz);
        if (v.police) this.addWanted(2, '搶警車？！');
        else if (Math.random() < 0.65) this.addWanted(1, '當街搶車，路人報警了');
        else this.say('🚗 搶了一台車（好像沒人看到）');
      } else if (!v.own) this.say(`🚗 開走路邊的${v.taxi ? '計程車' : '車'}`);
      p.car = v;
      v.parked = false;
      v.stolen = !v.own;
      if (v.scooter) this.seatPlayer(v);
      else p.g.visible = false;
      this.cam.dragT = 0;
      return true;
    }
    // 騎機車：老闆坐在機車上
    seatPlayer(v) {
      const p = this.player;
      if (!this.rig) return;
      if (v) {
        p.g.visible = true;
        this.rig.legL.rotation.x = this.rig.legR.rotation.x = -1.3;
        this.rig.armL.rotation.x = this.rig.armR.rotation.x = -1.1;
      } else {
        this.rig.legL.rotation.x = this.rig.legR.rotation.x = 0;
        this.rig.armL.rotation.x = this.rig.armR.rotation.x = 0;
      }
    }

    updatePlayer(dt, now) {
      const p = this.player;
      const inp = this.input || { x: 0, y: 0 };
      if (p.car) return this.drivePlayer(dt, now);
      const mag = Math.min(1, Math.hypot(inp.x, inp.y));
      const run = inp.boost || mag > 0.92;
      if (mag > 0.12) {
        const yaw = this.cam.yaw;
        const fx = -Math.sin(yaw);
        const fz = -Math.cos(yaw);
        const rx = Math.cos(yaw);
        const rz = -Math.sin(yaw);
        const mx = rx * inp.x - fx * inp.y;
        const mz = rz * inp.x - fz * inp.y;
        const want = Math.atan2(mx, mz);
        const diff = Math.atan2(Math.sin(want - p.dir), Math.cos(want - p.dir));
        p.dir += diff * Math.min(1, dt * 12);
        const sp = (run ? 7.5 : 3.6) * mag;
        p.v = sp;
        const nx = p.x + Math.sin(want) * sp * dt;
        const nz = p.z + Math.cos(want) * sp * dt;
        if (!this.blocked(nx, nz, 0.35) && !this.hitsCar(nx, nz, 0.35)) {
          p.x = nx;
          p.z = nz;
        } else if (!this.blocked(nx, p.z, 0.35) && !this.hitsCar(nx, p.z, 0.35)) p.x = nx;
        else if (!this.blocked(p.x, nz, 0.35) && !this.hitsCar(p.x, nz, 0.35)) p.z = nz;
        if (this.rig) People.walk(this.rig, true, dt, run ? 1.6 : 0.9);
      } else {
        p.v = 0;
        if (this.rig) People.walk(this.rig, false, dt, 1);
      }
      p.y += (this.groundY(p.x, p.z) - p.y) * Math.min(1, dt * 12);
      p.g.position.set(p.x, p.y, p.z);
      p.g.rotation.y = p.dir;
    }
    hitsCar(x, z, rad) {
      for (const v of this.vehicles) {
        if (v === this.player.car) continue;
        const fx = Math.sin(v.dir);
        const fz = Math.cos(v.dir);
        const k = v.scooter ? 0.5 : 1.25;
        for (const s of [-k, k]) if (Math.hypot(v.x + fx * s - x, v.z + fz * s - z) < v.rad + rad) return v;
      }
      return null;
    }

    // 開車：搖桿上＝油門、下＝煞車／倒車、左右＝方向盤
    drivePlayer(dt, now) {
      const p = this.player;
      const v = p.car;
      const inp = this.input || { x: 0, y: 0 };
      const thr = -inp.y;
      const maxV = v.maxV * (inp.boost ? 1.12 : 1);
      if (thr > 0.1) v.v += (v.v < 0 ? 22 : v.accel * (1 - Math.max(0, v.v) / maxV)) * thr * dt;
      else if (thr < -0.1) v.v += (v.v > 0.5 ? -20 : -6) * -thr * dt;
      else v.v -= Math.sign(v.v) * Math.min(Math.abs(v.v), dt * 3);
      v.v = Math.max(-8, Math.min(maxV, v.v));
      if (inp.brake) v.v -= Math.sign(v.v) * Math.min(Math.abs(v.v), dt * 26);
      const turn = (v.scooter ? 2.6 : 2.1) / (1 + Math.abs(v.v) / 22);
      const st = -inp.x;
      v.steer += (st - v.steer) * Math.min(1, dt * 8);
      v.dir += v.steer * turn * dt * Math.max(-1, Math.min(1, v.v / 5));
      this.moveVehicle(v, dt, now, true);
      p.x = v.x;
      p.z = v.z;
      if (v.scooter) {
        p.g.position.set(v.x - Math.sin(v.dir) * 0.25, v.y + 0.35, v.z - Math.cos(v.dir) * 0.25);
        p.g.rotation.y = v.dir;
      }
    }

    // 車子移動＋碰撞（玩家、警車、被搶的車共用）
    moveVehicle(v, dt, now, isPlayer) {
      const fx = Math.sin(v.dir);
      const fz = Math.cos(v.dir);
      const step = v.v * dt;
      const k = v.scooter ? 0.5 : 1.25;
      const hit = (x, z) => this.blocked(x + fx * k, z + fz * k, v.rad) || this.blocked(x - fx * k, z - fz * k, v.rad);
      const nx = v.x + fx * step;
      const nz = v.z + fz * step;
      const fast = Math.abs(v.v);
      if (!hit(nx, nz)) {
        v.x = nx;
        v.z = nz;
      } else if (!hit(nx, v.z)) {
        v.x = nx;
        v.v *= 0.96;
      } else if (!hit(v.x, nz)) {
        v.z = nz;
        v.v *= 0.96;
      } else {
        if (isPlayer && fast > 9) this.crash('wall', fast);
        v.v *= -0.25;
      }
      // 撞到別的車
      for (const o of this.vehicles) {
        if (o === v) continue;
        const d = Math.hypot(o.x - v.x, o.z - v.z);
        const min = (o.scooter ? 1.0 : 2.2) + (v.scooter ? 0.6 : 1.4);
        if (d < min && d > 0.01) {
          const ux = (v.x - o.x) / d;
          const uz = (v.z - o.z) / d;
          const push = (min - d) * 0.6;
          v.x += ux * push;
          v.z += uz * push;
          if (this.blocked(v.x, v.z, v.rad * 0.6)) {
            v.x -= ux * push;
            v.z -= uz * push;
          }
          if (isPlayer && fast > 6 && (!v.hitCd || now - v.hitCd > 900)) {
            v.hitCd = now;
            this.crash(o.police ? 'police' : 'car', fast, o);
          }
          if (fast > 2) v.v *= 0.4;
          if (o.ai) o.stun = 2.5;
        }
      }
      // 撞到路人
      if (fast > 4)
        for (const pd of this.peds) {
          if (pd.down > 0) continue;
          if (Math.hypot(pd.x - v.x - fx * k, pd.z - v.z - fz * k) < v.rad + 0.5) {
            this.knock(pd, v);
            if (isPlayer) {
              this.sim.driveFine(15000, '🚑 開車撞到路人，賠醫藥費');
              this.addWanted(1, '撞人了！');
            }
          }
        }
      v.y += (this.groundY(v.x, v.z) - v.y) * Math.min(1, dt * 10);
      v.g.position.set(v.x, v.y, v.z);
      v.g.rotation.y = v.dir;
      // 騎機車轉彎會壓車
      if (v.scooter) v.g.rotation.z = -v.steer * Math.min(1, Math.abs(v.v) / 10) * 0.35;
    }

    crash(what, fast, o) {
      this.shake = 0.35;
      if (what === 'wall') {
        this.say('💥 撞到東西了');
        if (fast > 18) this.sim.driveFine(3000, '撞爛了保險桿，修車錢');
      } else if (what === 'police') {
        this.addWanted(1, '撞警車！');
      } else {
        this.sim.driveFine(fast > 15 ? 8000 : 2500, '撞到別人的車，賠了修車錢');
        if (fast > 12 || Math.random() < 0.3) this.addWanted(1, '肇事逃逸！');
      }
    }

    // ───── 路上的車：照車道開，路口隨機轉彎 ─────
    makeTraffic() {
      const r = rand(99);
      const n = this.low ? 12 : 20;
      const models = ['m3', 'my', 'ms', 'mx', 'box'];
      for (let i = 0; i < n; i++) {
        const scooter = i % 3 === 2;
        const taxi = !scooter && i % 5 === 0;
        const model = scooter ? 'scooter' : pick(r, models);
        const color = scooter ? pick(r, ['#ffffff', '#c0392b', '#2c3e50', '#7f8c8d', '#1f6fb2']) : taxi ? '#f5c518' : pick(r, ['#f2f2f2', '#2b4c8c', '#b3261e', '#1d1d1f', '#8a8f96', '#d8d4cb', '#3c6e47']);
        const v = this.addVehicle(model, color, 0, 0, 0, { taxi });
        this.placeTraffic(v, r);
      }
    }
    placeTraffic(v, r = Math.random, near) {
      // 隨便找一段路
      for (let k = 0; k < 40; k++) {
        const i = Math.floor(r() * (City.W + 1));
        const j = Math.floor(r() * (City.H + 1));
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => segOK(i, j, i + a, j + b));
        if (!dirs.length) continue;
        const [di, dj] = pick(r, dirs);
        if (near) {
          const d = Math.hypot(i * P - near[0], j * P - near[1]);
          if (d < 70 || d > 170) continue;
        }
        v.ai = { a: [i, j], b: [i + di, j + dj], d: [di, dj], s: Math.random() * 20, turn: null };
        v.v = 0;
        v.stun = 0;
        this.trafficPos(v);
        return;
      }
    }
    laneOff(v) {
      return v.scooter ? LANE_MOTO : LANE_CAR;
    }
    // 直線段的起點、終點
    segEnds(v) {
      const { a, b, d } = v.ai;
      const off = this.laneOff(v);
      const rx = -d[1];
      const rz = d[0];
      // 往 +z 開，右手邊是 -x（台灣靠右）：右向量 =（-dz, dx）
      const e = ROAD / 2 + 1;
      return [[a[0] * P + d[0] * e + rx * off, a[1] * P + d[1] * e + rz * off], [b[0] * P - d[0] * e + rx * off, b[1] * P - d[1] * e + rz * off]];
    }
    trafficPos(v) {
      const ai = v.ai;
      if (ai.turn) {
        const { p0, c, p2 } = ai.turn;
        const t = ai.turn.t;
        const u = 1 - t;
        v.x = u * u * p0[0] + 2 * u * t * c[0] + t * t * p2[0];
        v.z = u * u * p0[1] + 2 * u * t * c[1] + t * t * p2[1];
        const tx = 2 * u * (c[0] - p0[0]) + 2 * t * (p2[0] - c[0]);
        const tz = 2 * u * (c[1] - p0[1]) + 2 * t * (p2[1] - c[1]);
        v.dir = Math.atan2(tx, tz);
      } else {
        const [s0, s1] = this.segEnds(v);
        const L = Math.hypot(s1[0] - s0[0], s1[1] - s0[1]);
        const k = Math.min(1, ai.s / L);
        v.x = s0[0] + (s1[0] - s0[0]) * k;
        v.z = s0[1] + (s1[1] - s0[1]) * k;
        v.dir = Math.atan2(ai.d[0], ai.d[1]);
      }
    }
    updateTraffic(dt, now) {
      const p = this.player;
      for (const v of this.vehicles) {
        const ai = v.ai;
        if (!ai || v.police) continue;
        // 離玩家太遠：換到附近的路上（車流一直都在身邊）
        if (Math.hypot(v.x - p.x, v.z - p.z) > 190) {
          this.placeTraffic(v, Math.random, [p.x, p.z]);
          continue;
        }
        if (v.stun > 0) {
          v.stun -= dt;
          v.v = 0;
          continue;
        }
        // 前面有人、有車就減速
        const fx = Math.sin(v.dir);
        const fz = Math.cos(v.dir);
        let block = 99;
        const look = (x, z, r) => {
          const dx = x - v.x;
          const dz = z - v.z;
          const ahead = dx * fx + dz * fz;
          if (ahead < 0 || ahead > 12) return;
          const side = Math.abs(dx * fz - dz * fx);
          if (side < r) block = Math.min(block, ahead);
        };
        look(p.x, p.z, 2);
        for (const o of this.vehicles) if (o !== v) look(o.x, o.z, o.scooter || v.scooter ? 1.3 : 2);
        for (const pd of this.peds) if (pd.g.visible && pd.onRoad) look(pd.x, pd.z, 2);
        const want = (v.scooter ? 12 : 11) * (block < 99 ? Math.max(0, (block - 4) / 8) : 1);
        v.v += Math.sign(want - v.v) * Math.min(Math.abs(want - v.v), dt * (want < v.v ? 14 : 4));
        if (block < 4.5) {
          // 被擋住太久就按喇叭
          ai.wait = (ai.wait || 0) + dt;
          if (ai.wait > 2 && Math.hypot(p.x - v.x, p.z - v.z) < 15 && (!ai.honk || now - ai.honk > 6000)) {
            ai.honk = now;
            this.say(pick(Math.random, ['📢 叭——！', '📢 叭叭！擋路啦！', '📢 「會不會開車啊！」']), 1.4);
          }
        } else ai.wait = 0;
        // 前進
        if (ai.turn) {
          ai.turn.t += (v.v * dt) / ai.turn.len;
          if (ai.turn.t >= 1) {
            ai.turn = null;
            ai.s = 0;
          }
        } else {
          ai.s += v.v * dt;
          const [s0, s1] = this.segEnds(v);
          const L = Math.hypot(s1[0] - s0[0], s1[1] - s0[1]);
          if (ai.s >= L) {
            // 路口：選下一條路（不迴轉）
            const [i, j] = ai.b;
            let opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => !(a === -ai.d[0] && b === -ai.d[1]) && segOK(i, j, i + a, j + b));
            if (!opts.length) opts = [[-ai.d[0], -ai.d[1]]];
            // 直走的機會大一點
            const straight = opts.find(([a, b]) => a === ai.d[0] && b === ai.d[1]);
            const nd = straight && Math.random() < 0.55 ? straight : pick(Math.random, opts);
            const off = this.laneOff(v);
            const e = ROAD / 2 + 1;
            const r1 = [-ai.d[1], ai.d[0]];
            const r2 = [-nd[1], nd[0]];
            const B = [i * P, j * P];
            const p0 = s1;
            const p2 = [B[0] + nd[0] * e + r2[0] * off, B[1] + nd[1] * e + r2[1] * off];
            let c;
            if (nd[0] === ai.d[0] && nd[1] === ai.d[1]) c = [B[0] + r1[0] * off, B[1] + r1[1] * off];
            else if (nd[0] === -ai.d[0] && nd[1] === -ai.d[1]) c = [B[0] + ai.d[0] * e, B[1] + ai.d[1] * e];
            else c = [B[0] + r1[0] * off + r2[0] * off, B[1] + r1[1] * off + r2[1] * off];
            const len = Math.hypot(c[0] - p0[0], c[1] - p0[1]) + Math.hypot(p2[0] - c[0], p2[1] - c[1]);
            ai.turn = { p0, c, p2, t: 0, len: Math.max(1, len) };
            ai.a = [i, j];
            ai.b = [i + nd[0], j + nd[1]];
            ai.d = nd;
          }
        }
        this.trafficPos(v);
        v.y = 0;
        v.g.position.set(v.x, 0, v.z);
        v.g.rotation.y = v.dir;
        if (v.scooter) v.g.rotation.z = 0;
      }
      // 被丟在路邊的車：太遠就收掉，換新的車流
      for (const v of [...this.vehicles]) {
        if (v.ai || v.police || v.own || v === p.car) continue;
        if (Math.hypot(v.x - p.x, v.z - p.z) > 200) {
          this.removeVehicle(v);
          const nv = this.addVehicle(Math.random() < 0.33 ? 'scooter' : pick(Math.random, ['m3', 'my', 'ms', 'box']), pick(Math.random, ['#f2f2f2', '#2b4c8c', '#b3261e', '#1d1d1f', '#8a8f96']), 0, 0, 0);
          this.placeTraffic(nv, Math.random, [p.x, p.z]);
        }
      }
    }

    // ───── 路人：在人行道上繞街區走，偶爾過馬路 ─────
    makePeds() {
      if (!People) return;
      const n = this.low ? 14 : 26;
      for (let i = 0; i < n; i++) {
        const p = People.make(root.BossLooks.randomLook(Math.random));
        const holder = new THREE.Group();
        holder.add(p.group);
        holder.scale.setScalar((this.pScale || 1.3) * (0.92 + Math.random() * 0.12));
        this.scene.add(holder);
        const pd = { g: holder, rig: p, x: 0, z: 0, dir: 0, sp: 1.2 + Math.random() * 0.5, path: null, down: 0, flee: 0 };
        this.placePed(pd, true);
        this.peds.push(pd);
      }
    }
    // 街區人行道上的一圈（離路緣 1.6 公尺）
    pedLoop(bx, by) {
      const ox = bx0(bx);
      const oz = bx0(by);
      const k = 1.7;
      return [[ox + k, oz + k], [ox + BLOCK - k, oz + k], [ox + BLOCK - k, oz + BLOCK - k], [ox + k, oz + BLOCK - k]];
    }
    placePed(pd, first) {
      const p = this.player;
      for (let t = 0; t < 30; t++) {
        const bx = Math.max(0, Math.min(City.W - 1, Math.floor(p.x / P) + Math.floor(Math.random() * 5) - 2));
        const by = Math.max(0, Math.min(City.H - 1, Math.floor(p.z / P) + Math.floor(Math.random() * 5) - 2));
        if (City.typeAt(bx, by) === 'W') continue;
        const loop = this.pedLoop(bx, by);
        const i = Math.floor(Math.random() * 4);
        const a = loop[i];
        const b = loop[(i + 1) % 4];
        const k = Math.random();
        const x = a[0] + (b[0] - a[0]) * k;
        const z = a[1] + (b[1] - a[1]) * k;
        if (!first && Math.hypot(x - p.x, z - p.z) < 45) continue;
        Object.assign(pd, { x, z, bx, by, i: (i + 1) % 4, cw: true, onRoad: false, down: 0, flee: 0, cross: null });
        pd.g.visible = true;
        pd.g.rotation.set(0, 0, 0);
        return;
      }
    }
    updatePeds(dt, now) {
      const p = this.player;
      for (const pd of this.peds) {
        const far = Math.hypot(pd.x - p.x, pd.z - p.z);
        if (far > 110) {
          this.placePed(pd);
          continue;
        }
        // 遠的人藏起來（霧也看不到），手機省很多
        pd.g.visible = far < (this.low ? 60 : 85);
        if (pd.down > 0) {
          pd.down -= dt;
          // 被撞飛：先飛一下再倒地
          if (pd.fly) {
            pd.x += pd.fly[0] * dt;
            pd.z += pd.fly[1] * dt;
            pd.fly[0] *= 0.9;
            pd.fly[1] *= 0.9;
          }
          pd.g.rotation.x = -Math.PI / 2 * Math.min(1, (5 - pd.down) * 3);
          pd.g.position.set(pd.x, 0.3, pd.z);
          if (pd.down <= 0) {
            pd.g.rotation.x = 0;
            pd.flee = 6;
            pd.fly = null;
          }
          continue;
        }
        let tx;
        let tz;
        if (pd.cross) [tx, tz] = pd.cross;
        else [tx, tz] = this.pedLoop(pd.bx, pd.by)[pd.i];
        const dx = tx - pd.x;
        const dz = tz - pd.z;
        const d = Math.hypot(dx, dz);
        const sp = pd.flee > 0 ? 4.5 : pd.sp;
        if (pd.flee > 0) pd.flee -= dt;
        // 玩家開車衝過來：閃開
        if (p.car && Math.abs(p.car.v) > 6 && far < 8) {
          const ax = pd.x - p.x;
          const az = pd.z - p.z;
          const fx = Math.sin(p.car.dir);
          const fz = Math.cos(p.car.dir);
          if (ax * fx + az * fz > 0) {
            const side = ax * fz - az * fx > 0 ? 1 : -1;
            pd.x += fz * side * dt * 3;
            pd.z -= fx * side * dt * 3;
          }
        }
        if (d < 0.3) {
          if (pd.cross) {
            pd.cross = null;
            pd.onRoad = false;
            pd.bx = pd.nbx;
            pd.by = pd.nby;
            pd.i = pd.ni;
          } else {
            // 走到街角：有時候過馬路到隔壁街區
            const corner = pd.i;
            const nb = [[[0, -1], [-1, 0]], [[0, -1], [1, 0]], [[0, 1], [1, 0]], [[0, 1], [-1, 0]]][corner];
            const [ddx, ddy] = pick(Math.random, nb);
            const nbx = pd.bx + ddx;
            const nby = pd.by + ddy;
            if (Math.random() < 0.35 && nbx >= 0 && nby >= 0 && nbx < City.W && nby < City.H && City.typeAt(nbx, nby) !== 'W' && !(ddx && Math.min(pd.bx, nbx) < City.RIVER_X + 1 && Math.max(pd.bx, nbx) >= City.RIVER_X)) {
              // 對面街區對應的角
              const map = { '0,-1': [3, 2, 1, 0], '0,1': [3, 2, 1, 0], '-1,0': [1, 0, 3, 2], '1,0': [1, 0, 3, 2] }[`${ddx},${ddy}`];
              const ni = map[corner];
              pd.cross = this.pedLoop(nbx, nby)[ni];
              pd.nbx = nbx;
              pd.nby = nby;
              pd.ni = (ni + 1) % 4;
              pd.onRoad = true;
            } else pd.i = (pd.i + 1) % 4;
          }
          continue;
        }
        pd.x += (dx / d) * Math.min(d, sp * dt);
        pd.z += (dz / d) * Math.min(d, sp * dt);
        pd.dir = Math.atan2(dx, dz);
        if (far < 60) People.walk(pd.rig, true, dt, sp / 1.4);
        pd.g.position.set(pd.x, this.groundY(pd.x, pd.z), pd.z);
        pd.g.rotation.y = pd.dir;
      }
    }
    knock(pd, v) {
      pd.down = 5;
      pd.fly = [Math.sin(v.dir) * Math.abs(v.v) * 0.6, Math.cos(v.dir) * Math.abs(v.v) * 0.6];
      pd.cross = null;
      pd.onRoad = false;
      this.shake = 0.25;
    }
    ejectDriver(x, z) {
      // 找一個離最遠的路人，變成被拉下車的司機
      let best = null;
      let bd = -1;
      for (const pd of this.peds) {
        const d = Math.hypot(pd.x - this.player.x, pd.z - this.player.z);
        if (d > bd) {
          bd = d;
          best = pd;
        }
      }
      if (!best) return;
      Object.assign(best, { x: x + 1.5, z: z + 1.5, flee: 8, down: 0, cross: null, onRoad: false });
      best.bx = Math.max(0, Math.min(City.W - 1, Math.floor(x / P)));
      best.by = Math.max(0, Math.min(City.H - 1, Math.floor(z / P)));
      if (City.typeAt(best.bx, best.by) === 'W') best.bx += 1;
      best.g.visible = true;
      best.g.rotation.set(0, 0, 0);
    }

    // ───── 通緝、警察 ─────
    addWanted(n, why) {
      this.wanted = Math.min(5, this.wanted + n);
      this.calm = 0;
      this.say(`🚨 ${why}（通緝 ${'★'.repeat(this.wanted)}）`, 3);
      const want = this.wanted >= 3 ? 3 : this.wanted >= 2 ? 2 : 1;
      while (this.police.length < want) this.spawnPolice();
    }
    policeSpot() {
      const p = this.player;
      for (let t = 0; t < 80; t++) {
        const i = Math.floor(Math.random() * (City.W + 1));
        const j = Math.floor(Math.random() * (City.H + 1));
        const d = Math.hypot(i * P - p.x, j * P - p.z);
        if (d > 60 && d < 130) return [i * P, j * P];
      }
      return [Math.round(p.x / P) * P, Math.round(p.z / P) * P];
    }
    spawnPolice() {
      const best = this.policeSpot();
      const v = this.addVehicle('m3', '#f5f5f5', best[0], best[1], 0, { police: true });
      v.chase = { path: [], pathT: 0, stuck: 0, rev: 0 };
      this.police.push(v);
    }
    updatePolice(dt, now) {
      const p = this.player;
      const tgtV = p.car;
      let close = false;
      for (const v of this.police) {
        const flash = Math.floor(now / 160) % 2;
        v.barR.material.color.set(flash ? '#ff2b2b' : '#5a1010');
        v.barB.material.color.set(flash ? '#10205a' : '#2b6bff');
        const c = v.chase;
        c.pathT -= dt;
        const dist = Math.hypot(p.x - v.x, p.z - v.z);
        if (c.pathT <= 0) {
          c.pathT = 0.7;
          c.path = dist < 30 ? [] : nodePath(v.x, v.z, p.x, p.z);
        }
        while (c.path.length && Math.hypot(c.path[0][0] - v.x, c.path[0][1] - v.z) < 6) c.path.shift();
        const tgt = c.path[0] || [p.x, p.z];
        const want = Math.atan2(tgt[0] - v.x, tgt[1] - v.z);
        let diff = Math.atan2(Math.sin(want - v.dir), Math.cos(want - v.dir));
        if (c.rev > 0) {
          c.rev -= dt;
          v.v = -6;
          v.dir -= diff * dt;
        } else {
          v.dir += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
          const top = dist < 12 ? Math.max(3, dist) : v.maxV * (0.78 + this.wanted * 0.05);
          const tv = Math.abs(diff) > 1.2 ? top * 0.4 : top;
          v.v += Math.sign(tv - v.v) * Math.min(Math.abs(tv - v.v), dt * 12);
        }
        const ox = v.x;
        const oz = v.z;
        this.moveVehicle(v, dt, now, false);
        // 卡住了：倒車一下
        if (Math.hypot(v.x - ox, v.z - oz) < Math.abs(v.v) * dt * 0.3 && c.rev <= 0) {
          c.stuck += dt;
          if (c.stuck > 0.8) {
            c.rev = 0.8;
            c.stuck = 0;
          }
        } else c.stuck = 0;
        if (dist < (tgtV ? 6 : 4.5) && Math.abs(tgtV ? tgtV.v : 0) < 3) close = true;
        // 太遠了換到附近的路口
        if (dist > 200) [v.x, v.z] = this.policeSpot();
      }
      if (!this.wanted) return;
      // 被逮：警察貼著你，你又停下來
      this.bust = close ? (this.bust || 0) + dt : Math.max(0, (this.bust || 0) - dt);
      if (this.bust > 1.6) {
        const fine = this.wanted * 8000 + (p.car && p.car.stolen ? 10000 : 0);
        this.sim.driveFine(fine, `🚔 被警察逮到，通緝 ${this.wanted} 星，罰款${p.car && p.car.stolen ? '＋偷車和解金' : ''}`);
        this.say(`🚔 BUSTED！罰 $${fine.toLocaleString()}`, 3.5);
        if (this.mission) this.failMission('被警察攔下來');
        if (p.car && p.car.stolen) {
          // 贓車被扣走，人被請下車
          const car = p.car;
          p.car = null;
          p.x = car.x - Math.cos(car.dir) * 1.8;
          p.z = car.z + Math.sin(car.dir) * 1.8;
          if (this.blocked(p.x, p.z, 0.35)) [p.x, p.z] = [car.x, car.z];
          p.g.visible = true;
          this.seatPlayer(null);
          this.removeVehicle(car);
        }
        this.clearPolice();
        this.bust = 0;
        return;
      }
      // 甩掉：離警察夠遠一段時間
      const nearest = Math.min(...this.police.map((v) => Math.hypot(p.x - v.x, p.z - v.z)), 999);
      if (nearest > 75) this.calm += dt;
      else this.calm = Math.max(0, this.calm - dt * 0.5);
      if (this.calm > 8) {
        this.wanted -= 1;
        this.calm = 0;
        if (this.wanted <= 0) {
          this.say('😎 甩掉警察了');
          this.clearPolice();
        } else this.say(`通緝降到 ${'★'.repeat(this.wanted)}`);
      }
    }
    clearPolice() {
      for (const v of this.police) if (v !== this.player.car) this.removeVehicle(v);
      this.police = [];
      this.wanted = 0;
      this.calm = 0;
    }

    // ───── 測速照相、紅包 ─────
    makeCams() {
      const spots = [[3, 3, 'h'], [6, 1, 'v'], [5, 5, 'h'], [8, 4, 'v'], [1, 2, 'v']];
      this.camSpots = spots.map(([a, b, o]) => {
        const x = o === 'h' ? (a + 0.5) * P : a * P;
        const z = o === 'h' ? b * P : (b + 0.5) * P;
        const g = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 0.2), new THREE.MeshLambertMaterial({ color: '#4a4f57' }));
        pole.position.y = 2;
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.8), new THREE.MeshLambertMaterial({ color: '#d9d9d9' }));
        box.position.y = 4.1;
        g.add(pole, box);
        g.position.set(x + (o === 'v' ? ROAD / 2 + 0.5 : 0), 0, z + (o === 'h' ? ROAD / 2 + 0.5 : 0));
        this.scene.add(g);
        return { x, z, o };
      });
    }
    updateCams(now) {
      const p = this.player;
      if (!p.car) return;
      const kmh = Math.round(Math.abs(p.car.v) * KMH);
      for (const c of this.camSpots) {
        const along = c.o === 'h' ? Math.abs(p.x - c.x) : Math.abs(p.z - c.z);
        const across = c.o === 'h' ? Math.abs(p.z - c.z) : Math.abs(p.x - c.x);
        if (along > 3 || across > ROAD / 2) continue;
        const k = `${c.x},${c.z}`;
        if (kmh > LIMIT && (!this.camHit[k] || now - this.camHit[k] > 8000)) {
          this.camHit[k] = now;
          this.flash = 0.25;
          this.sim.driveFine(kmh > 90 ? 12000 : 3000, `📸 測速照相：時速 ${kmh}（速限 ${LIMIT}）`);
          this.say(`📸 閃！時速 ${kmh}，罰單寄到店裡了`);
        }
      }
    }
    spawnPickups() {
      const g = new THREE.BoxGeometry(0.45, 0.65, 0.08);
      const m = new THREE.MeshBasicMaterial({ color: '#e0302a' });
      for (let i = 0; i < 12; i++) {
        let pt = null;
        for (let k = 0; k < 40 && !pt; k++) {
          const bx = Math.floor(Math.random() * City.W);
          const by = Math.floor(Math.random() * City.H);
          if (City.typeAt(bx, by) === 'W') continue;
          const loop = this.pedLoop(bx, by);
          const a = loop[Math.floor(Math.random() * 4)];
          pt = [a[0] + (Math.random() - 0.5) * 20, a[1]];
          if (this.blocked(pt[0], pt[1], 0.5)) pt = null;
        }
        if (!pt) continue;
        const mesh = new THREE.Mesh(g, m);
        mesh.position.set(pt[0], 1, pt[1]);
        this.scene.add(mesh);
        this.pick.push({ x: pt[0], z: pt[1], m: mesh, t: 0 });
      }
    }
    updatePickups(dt, now) {
      const p = this.player;
      for (const k of this.pick) {
        if (k.t > 0) {
          k.t -= dt;
          if (k.t <= 0) k.m.visible = true;
          continue;
        }
        k.m.rotation.y += dt * 3;
        k.m.position.y = 1 + Math.sin(now / 300 + k.x) * 0.15;
        if (Math.hypot(k.x - p.x, k.z - p.z) < 1.6) {
          k.t = 90;
          k.m.visible = false;
          const amt = 200 + Math.floor(Math.random() * 9) * 100;
          this.sim.driveReward({ wealth: amt, text: `🧧 路邊撿到紅包 $${amt}（應該要送警察局……）` });
          this.say(`🧧 撿到紅包 $${amt}`);
        }
      }
    }

    // ───── 任務 ─────
    homeCurb() {
      const d = this.doors.find((x) => x.home);
      return d ? [d.x, d.z + SW] : [W / 2, H / 2];
    }
    randomCurb(near, minD, maxD) {
      for (let k = 0; k < 80; k++) {
        const bx = Math.floor(Math.random() * City.W);
        const by = Math.floor(Math.random() * City.H);
        if (City.typeAt(bx, by) === 'W') continue;
        const c = curbOf(bx, by);
        const d = Math.hypot(c[0] - near[0], c[1] - near[1]);
        if (d >= minD && d <= maxD) return c;
      }
      return curbOf(5, 3);
    }
    startMission(kind) {
      if (this.mission) return false;
      const p = this.player;
      const here = [p.x, p.z];
      const home = this.homeCurb();
      const dd = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
      let m;
      if (kind === 'delivery') {
        const to = this.randomCurb(home, 100, 260);
        m = { kind, icon: '🛵', name: '外送', stops: [home, to], labels: ['回店取餐', '送到客人家'], time: 25 + (dd(here, home) + dd(home, to)) / 9 };
      } else if (kind === 'taxi') {
        const a = this.randomCurb(here, 30, 110);
        const b = this.randomCurb(a, 120, 320);
        m = { kind, icon: '🚖', name: '載客', stops: [a, b], labels: ['去載客人（要開車）', '送客人到目的地'], time: 25 + (dd(here, a) + dd(a, b)) / 10, dist: dd(a, b), needCar: true };
      } else if (kind === 'errand') {
        const L = City.LANDMARKS.wholesale;
        const w = curbOf(L.x, L.y);
        m = { kind, icon: '📦', name: '跑腿進貨', stops: [w, home], labels: ['開到批發市場', '載回店裡'], time: 30 + (dd(here, w) + dd(w, home)) / 9, needCar: true };
      } else if (kind === 'race') {
        const pts = [];
        let q = here;
        for (let i = 0; i < 4; i++) {
          q = this.randomCurb(q, 70, 150);
          pts.push(q);
        }
        let tot = 0;
        pts.forEach((x, i) => (tot += dd(x, i ? pts[i - 1] : here)));
        m = { kind, icon: '🏁', name: '街頭競速', stops: pts, labels: pts.map((_, i) => `檢查點 ${i + 1}/4`), time: 12 + tot / 17, needCar: true };
        if (Math.random() < 0.5) this.addWanted(1, '飆車被路人檢舉！');
      } else return false;
      m.i = 0;
      m.left = m.time;
      m.total = m.time;
      this.mission = m;
      if (!this.beam) {
        this.beam = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 60, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#f2c14e', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, fog: false }));
        this.scene.add(this.beam);
      }
      this.beam.visible = true;
      this.say(`${m.icon} ${m.name}：${m.labels[0]}`);
      return true;
    }
    updateMission(dt, now) {
      const m = this.mission;
      if (!m) {
        if (this.beam) this.beam.visible = false;
        return;
      }
      const p = this.player;
      m.left -= dt;
      const t = m.stops[m.i];
      this.beam.position.set(t[0], 30, t[1]);
      this.beam.material.opacity = 0.28 + Math.sin(now / 200) * 0.08;
      const v = p.car;
      if (Math.hypot(t[0] - p.x, t[1] - p.z) < 5 && (!v || Math.abs(v.v) < (m.kind === 'race' ? 99 : 8))) {
        if (m.needCar && !v) {
          if (!m.warned) this.say('要開車才行（找台車吧）');
          m.warned = true;
        } else {
          m.i += 1;
          m.warned = false;
          if (m.i >= m.stops.length) return this.finishMission();
          this.say(`${m.icon} ${m.labels[m.i]}`);
        }
      }
      if (m.left <= 0) this.failMission('時間到了');
    }
    finishMission() {
      const m = this.mission;
      const s = this.sim;
      const fast = m.left / m.total;
      const avg = s.ind.products.reduce((t, p) => t + p.price, 0) / s.ind.products.length;
      if (m.kind === 'delivery') {
        const pay = Math.round(avg * 4 + (fast > 0.35 ? avg * 2 : 0));
        s.driveReward({ cash: pay, text: `🛵 老闆親自外送：收到 $${pay}${fast > 0.35 ? '（送得快，客人給了小費）' : ''}`, review: fast > 0.35 ? [5, '老闆親自送來的，還熱的！'] : null });
      } else if (m.kind === 'taxi') {
        const fare = Math.round(85 + m.dist * 2.2 + (fast > 0.35 ? 100 : 0));
        s.driveReward({ wealth: fare, text: `🚖 載客車資 $${fare}${fast > 0.35 ? '（客人說開很穩，多給小費）' : ''}` });
      } else if (m.kind === 'errand') s.driveErrand();
      else if (m.kind === 'race') {
        const prize = Math.round(5000 + fast * 15000);
        s.driveReward({ wealth: prize, text: `🏁 街頭競速贏了 $${prize}（路人都拍下來了）`, fans: 60 });
      }
      this.say(`✅ ${m.name}完成！`, 3);
      this.mission = null;
    }
    failMission(why) {
      if (!this.mission) return;
      this.say(`❌ ${this.mission.name}失敗：${why}`, 3);
      if (this.mission.kind === 'delivery') this.sim.driveReward({ text: '🛵 外送太慢，客人取消訂單了', review: [2, '外送等到天荒地老'] });
      this.mission = null;
    }

    // ───── 導航 ─────
    setGps(id) {
      const d = this.doors.find((x) => x.id === id);
      if (!d) return;
      this.gps = { id, to: [d.x, d.z], name: d.name };
      this.say(`🧭 導航到${d.icon} ${d.name}`);
    }
    updateGps(now) {
      const p = this.player;
      const tgt = this.mission ? this.mission.stops[this.mission.i] : this.gps ? this.gps.to : null;
      if (this.gps && !this.mission && tgt && Math.hypot(tgt[0] - p.x, tgt[1] - p.z) < 5) this.gps = null;
      if (!tgt || (this.gps === null && !this.mission)) {
        if (this.route) this.route.visible = false;
        this.routePts = null;
        return;
      }
      if (now - (this.gpsAt || 0) < 500) return;
      this.gpsAt = now;
      const pts = [[p.x, p.z], ...nodePath(p.x, p.z, tgt[0], tgt[1]), tgt];
      this.routePts = pts;
      // 地上畫一條橘色的路線
      const pos = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i];
        const [bx, bz] = pts[i + 1];
        const L = Math.hypot(bx - ax, bz - az) || 1;
        const nx = (-(bz - az) / L) * 0.6;
        const nz = ((bx - ax) / L) * 0.6;
        const y = 0.25;
        pos.push(ax + nx, y, az + nz, bx + nx, y, bz + nz, bx - nx, y, bz - nz, ax + nx, y, az + nz, bx - nx, y, bz - nz, ax - nx, y, az - nz);
      }
      if (!this.route) {
        this.route = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: '#ff8a2a', transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }));
        this.scene.add(this.route);
      }
      this.route.geometry.dispose();
      this.route.geometry = new THREE.BufferGeometry();
      this.route.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      this.route.visible = true;
    }

    // 走到門口
    updateNear() {
      const p = this.player;
      let near = null;
      for (const d of this.doors) {
        d.ring.material.opacity = 0.55 + Math.sin(this.t * 4) * 0.3;
        if (Math.hypot(d.x - p.x, d.z - p.z) < (p.car ? 6 : 2.6)) near = d.id;
      }
      this.near = near;
    }

    // ───── 天色 ─────
    applyTime(force) {
      const s = this.sim;
      const m = ((s.minute % 1440) + 1440) % 1440;
      const h = m / 60;
      // 白天 1、晚上 0
      const day = h < 5 || h > 19.5 ? 0 : h < 7 ? (h - 5) / 2 : h > 17.5 ? (19.5 - h) / 2 : 1;
      const dusk = h > 16.5 && h < 19.5 ? 1 - Math.abs(h - 18) / 1.5 : h > 5 && h < 7 ? 1 - Math.abs(h - 6) : 0;
      const wet = s.weather && (s.weather.id === 'rain' || s.weather.id === 'typhoon');
      const sky = new THREE.Color('#152038').lerp(new THREE.Color(wet ? '#9aa6b0' : '#a9d3f0'), day).lerp(new THREE.Color('#f1a06b'), dusk * 0.55);
      this.scene.background = sky;
      this.scene.fog.color.copy(sky);
      this.hemi.intensity = 0.42 + day * 0.48;
      this.hemi.color.set(day > 0.3 ? '#ffffff' : '#9fb4ff');
      this.sunL.intensity = 0.08 + day * (wet ? 0.35 : 0.8);
      this.sunL.color.set(dusk > 0.3 ? '#ffb27a' : '#fff3e0');
      const night = 1 - day;
      this.wallMat.emissiveIntensity = night * 0.9;
      this.glassMat.emissiveIntensity = night * 0.8;
      this.lampHeads.material.color.set(night > 0.4 ? '#ffd27a' : '#cfcfcf');
      this.night = night;
      this.wet = wet;
      if (this.rain) this.rain.visible = wet;
    }

    makeRain() {
      const n = this.low ? 500 : 1100;
      const pos = new Float32Array(n * 6);
      for (let i = 0; i < n; i++) {
        const x = (Math.random() - 0.5) * 60;
        const y = Math.random() * 30;
        const z = (Math.random() - 0.5) * 60;
        pos.set([x, y, z, x, y - 0.7, z], i * 6);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#c8d6e5', transparent: true, opacity: 0.5 }));
      this.rain.frustumCulled = false;
      this.rain.visible = false;
      this.scene.add(this.rain);
    }
    updateRain(dt) {
      if (!this.rain.visible) return;
      const a = this.rain.geometry.attributes.position.array;
      const typhoon = this.sim.weather && this.sim.weather.id === 'typhoon';
      const fall = dt * 28;
      const wind = typhoon ? dt * 9 : 0;
      for (let i = 0; i < a.length; i += 6) {
        a[i + 1] -= fall;
        a[i + 4] -= fall;
        a[i] += wind;
        a[i + 3] += wind * 1.3;
        if (a[i + 4] < 0) {
          const x = (Math.random() - 0.5) * 60;
          const z = (Math.random() - 0.5) * 60;
          a.set([x, 30, z, x, 29.3, z], i);
        }
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
      this.rain.position.set(this.player.x, 0, this.player.z);
    }

    // ───── 地標名字、小地圖 ─────
    makeLabels() {
      for (const d of this.doors) {
        const el = document.createElement('div');
        el.className = `wlabel ${d.home ? 'home' : ''}`;
        el.textContent = `${d.icon} ${d.name}`;
        this.overlay.appendChild(el);
        this.labels.push({ el, x: d.x, y: 3.2, z: d.z, d });
      }
      this.markEl = document.createElement('div');
      this.markEl.className = 'wmark';
      this.overlay.appendChild(this.markEl);
    }
    updateLabels() {
      const r = this.view.dom.getBoundingClientRect();
      const v = new THREE.Vector3();
      const p = this.player;
      for (const L of this.labels) {
        const dist = Math.hypot(L.x - p.x, L.z - p.z);
        let show = dist < 90;
        if (show) {
          v.set(L.x, L.y, L.z).project(this.camera);
          show = v.z < 1 && v.x > -1.1 && v.x < 1.1 && v.y > -1.1 && v.y < 1.1;
        }
        L.el.style.display = show ? '' : 'none';
        if (show) {
          L.el.style.transform = `translate(${(((v.x + 1) / 2) * r.width).toFixed(0)}px, ${(((1 - v.y) / 2) * r.height).toFixed(0)}px) translate(-50%, -100%) scale(${Math.max(0.7, Math.min(1.1, 30 / dist)).toFixed(2)})`;
          L.el.classList.toggle('near', this.near === L.d.id);
        }
      }
      // 任務目標的標記（螢幕外就貼在邊邊）
      const m = this.mission;
      const t = m ? m.stops[m.i] : this.gps ? this.gps.to : null;
      if (!t) {
        this.markEl.style.display = 'none';
        return;
      }
      v.set(t[0], 4, t[1]).project(this.camera);
      let x = ((v.x + 1) / 2) * r.width;
      let y = ((1 - v.y) / 2) * r.height;
      if (v.z > 1) {
        x = r.width - x;
        y = r.height - 40;
      }
      x = Math.max(40, Math.min(r.width - 40, x));
      y = Math.max(90, Math.min(r.height - 60, y));
      const dist = Math.round(Math.hypot(t[0] - p.x, t[1] - p.z));
      this.markEl.style.display = '';
      this.markEl.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px) translate(-50%, -100%)`;
      const txt = `${m ? `${m.icon} ${m.labels[m.i]}` : `🧭 ${this.gps.name}`}・${dist}m`;
      if (this.markEl.textContent !== txt) this.markEl.textContent = txt;
    }

    makeMinimap() {
      const S = 0.55; // 每公尺幾個像素
      this.mapS = S;
      const base = canvas(Math.ceil((W + ROAD + 40) * S), Math.ceil((H + ROAD + 40) * S), (c, w, h) => {
        c.fillStyle = '#4a4744';
        c.fillRect(0, 0, w, h);
        const o = (ROAD / 2 + 20) * S;
        c.translate(o, o);
        for (let y = 0; y < City.H; y++)
          for (let x = 0; x < City.W; x++) {
            const t = City.typeAt(x, y);
            c.fillStyle = { W: '#4f86a8', P: '#7fae6b', M: '#d9774a', T: '#b8322a', O: '#9fb3c4', C: '#d8c3a5', I: '#9a9a90', S: '#d9c47a', H: '#e0a050' }[t] || '#cfc6b8';
            c.fillRect(bx0(x) * S, bx0(y) * S, BLOCK * S, BLOCK * S);
          }
        c.fillStyle = '#4f86a8';
        c.fillRect(RX0 * S, -o, (RX1 - RX0) * S, h);
        c.fillStyle = '#4a4744';
        for (const b of City.BRIDGES) c.fillRect(RX0 * S, (b * P - ROAD / 2) * S, (RX1 - RX0) * S, ROAD * S);
      });
      this.mapBase = base;
      this.mapOff = (ROAD / 2 + 20) * S;
      const el = document.createElement('canvas');
      const size = this.low ? 116 : 150;
      el.width = size * 2;
      el.height = size * 2;
      el.className = 'minimap';
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      this.view.container.appendChild(el);
      this.mapEl = el;
      this.mapCtx = el.getContext('2d');
    }
    drawMinimap() {
      const c = this.mapCtx;
      const w = this.mapEl.width;
      const S = this.mapS * 2.2;
      const p = this.player;
      c.save();
      c.clearRect(0, 0, w, w);
      c.beginPath();
      c.arc(w / 2, w / 2, w / 2 - 2, 0, 7);
      c.clip();
      c.fillStyle = '#3a3836';
      c.fillRect(0, 0, w, w);
      c.translate(w / 2, w / 2);
      c.rotate(this.cam.yaw);
      c.scale(S / this.mapS, S / this.mapS);
      c.translate(-(p.x * this.mapS + this.mapOff), -(p.z * this.mapS + this.mapOff));
      c.drawImage(this.mapBase, 0, 0);
      const at = (x, z) => [x * this.mapS + this.mapOff, z * this.mapS + this.mapOff];
      const k = this.mapS / S;
      // 導航路線
      if (this.routePts) {
        c.strokeStyle = '#ff8a2a';
        c.lineWidth = 5 * k;
        c.beginPath();
        this.routePts.forEach(([x, z], i) => (i ? c.lineTo(...at(x, z)) : c.moveTo(...at(x, z))));
        c.stroke();
      }
      const dot = (x, z, color, r) => {
        c.fillStyle = color;
        c.beginPath();
        c.arc(...at(x, z), r * k, 0, 7);
        c.fill();
      };
      c.font = `${22 * k}px sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      for (const d of this.doors) {
        const [x, z] = at(d.x, d.z);
        c.save();
        c.translate(x, z);
        c.rotate(-this.cam.yaw);
        c.fillText(d.icon, 0, 0);
        c.restore();
      }
      for (const v of this.police) dot(v.x, v.z, Math.floor(this.t * 6) % 2 ? '#ff3b30' : '#2b6bff', 9);
      const m = this.mission;
      const t = m ? m.stops[m.i] : this.gps ? this.gps.to : null;
      if (t) dot(t[0], t[1], '#f2c14e', 11);
      for (const k2 of this.pick) if (k2.t <= 0) dot(k2.x, k2.z, '#e0302a', 4);
      c.restore();
      // 玩家：正中間的箭頭
      const dir = p.car ? p.car.dir : p.dir;
      c.save();
      c.translate(w / 2, w / 2);
      c.rotate(this.cam.yaw - dir + Math.PI);
      c.fillStyle = '#fff';
      c.strokeStyle = '#000';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, -14);
      c.lineTo(10, 10);
      c.lineTo(0, 5);
      c.lineTo(-10, 10);
      c.closePath();
      c.fill();
      c.stroke();
      c.restore();
      c.strokeStyle = this.wanted ? (Math.floor(this.t * 4) % 2 ? '#ff3b30' : '#2b6bff') : 'rgba(255,255,255,.9)';
      c.lineWidth = 5;
      c.beginPath();
      c.arc(w / 2, w / 2, w / 2 - 3, 0, 7);
      c.stroke();
    }

    // ───── 鏡頭：拖曳轉視角、兩指／滾輪拉遠近 ─────
    bindInput() {
      const el = this.view.dom;
      const pts = new Map();
      let pinch = 0;
      this._down = (e) => {
        pts.set(e.pointerId, [e.clientX, e.clientY]);
        if (pts.size === 2) {
          const [a, b] = [...pts.values()];
          pinch = Math.hypot(a[0] - b[0], a[1] - b[1]);
        }
      };
      this._move = (e) => {
        if (!pts.has(e.pointerId)) return;
        const last = pts.get(e.pointerId);
        pts.set(e.pointerId, [e.clientX, e.clientY]);
        if (pts.size === 2) {
          const [a, b] = [...pts.values()];
          const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
          if (pinch) this.cam.zoom = Math.max(0.6, Math.min(2.2, (this.cam.zoom || 1) * (pinch / d)));
          pinch = d;
          return;
        }
        this.cam.yaw -= (e.clientX - last[0]) * 0.006;
        this.cam.pitch = Math.max(0.05, Math.min(1.2, this.cam.pitch + (e.clientY - last[1]) * 0.004));
        this.cam.dragT = 1.6;
      };
      this._up = (e) => {
        pts.delete(e.pointerId);
        pinch = 0;
      };
      this._wheel = (e) => {
        e.preventDefault();
        this.cam.zoom = Math.max(0.6, Math.min(2.2, (this.cam.zoom || 1) * (e.deltaY > 0 ? 1.1 : 0.9)));
      };
      el.addEventListener('pointerdown', this._down);
      el.addEventListener('pointermove', this._move);
      el.addEventListener('pointerup', this._up);
      el.addEventListener('pointercancel', this._up);
      el.addEventListener('wheel', this._wheel, { passive: false });
    }

    updateCamera(dt, snap) {
      const c = this.cam;
      const p = this.player;
      const v = p.car;
      c.dragT = Math.max(0, c.dragT - dt);
      const zoom = c.zoom || 1;
      // 開車：鏡頭自己轉到車子後面
      if (v && c.dragT <= 0) {
        const behind = v.dir + Math.PI + (v.v < -1 ? Math.PI : 0);
        const d = Math.atan2(Math.sin(behind - c.yaw), Math.cos(behind - c.yaw));
        c.yaw += d * Math.min(1, dt * (Math.abs(v.v) > 2 ? 3 : 0.8));
        c.pitch += ((v.scooter ? 0.3 : 0.26) - c.pitch) * Math.min(1, dt * 2);
      } else if (!v && c.dragT <= 0 && p.v > 1 && this.input && Math.abs(this.input.x) < 0.5) {
        // 走路往前：鏡頭慢慢跟到背後
        const behind = p.dir + Math.PI;
        const d = Math.atan2(Math.sin(behind - c.yaw), Math.cos(behind - c.yaw));
        c.yaw += d * Math.min(1, dt * 0.8);
      }
      const dist = (v ? (v.scooter ? 6.5 : 8.5) + Math.abs(v.v) * 0.12 : 5.2) * zoom;
      const tx = v ? v.x : p.x;
      const tz = v ? v.z : p.z;
      const ty = (v ? v.y : p.y) + (v ? 1.6 : 1.55);
      const dir = new THREE.Vector3(Math.sin(c.yaw) * Math.cos(c.pitch), Math.sin(c.pitch), Math.cos(c.yaw) * Math.cos(c.pitch));
      const o = new THREE.Vector3(tx, ty, tz);
      const hit = this.rayHit(o, dir, dist);
      const d = Math.max(1.2, hit < dist ? hit - 0.4 : dist);
      const want = o.clone().addScaledVector(dir, d);
      want.y = Math.max(0.6, want.y);
      if (snap) c.pos.copy(want);
      else c.pos.lerp(want, Math.min(1, dt * 10));
      this.camera.position.copy(c.pos);
      if (this.shake > 0) {
        this.shake -= dt;
        this.camera.position.x += (Math.random() - 0.5) * 0.35;
        this.camera.position.y += (Math.random() - 0.5) * 0.35;
      }
      this.camera.lookAt(tx, ty, tz);
      // 開快一點，視野變寬（速度感）
      const fov = 62 + (v ? Math.min(14, Math.abs(v.v) * 0.45) : 0);
      if (Math.abs(this.camera.fov - fov) > 0.2) this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 3);
      this.camera.aspect = this.view.aspect || 1.6;
      this.camera.updateProjectionMatrix();
    }

    // ───── 每一幀 ─────
    // 手機太卡：自動降解析度（離開時還原）
    autoRes(dt) {
      const f = this.fpsMon || (this.fpsMon = { t: 0, n: 0, pr: this.view.renderer.getPixelRatio() });
      f.t += dt;
      f.n += 1;
      if (f.t < 2.5) return;
      const fps = f.n / f.t;
      f.t = 0;
      f.n = 0;
      const r = this.view.renderer;
      const pr = r.getPixelRatio();
      if (fps < 26 && pr > 0.6) {
        r.setPixelRatio(Math.max(0.6, pr * 0.8));
        this.view.resize();
      } else if (fps > 50 && pr < f.pr - 0.01) {
        r.setPixelRatio(Math.min(f.pr, pr * 1.15));
        this.view.resize();
      }
      this.fps = fps;
    }

    update(dt, now) {
      this.autoRes(Math.min(dt, 0.2));
      dt = Math.min(dt, 0.05);
      this.t += dt;
      this.tT = (this.tT || 0) + dt;
      if (this.tT > 2) {
        this.tT = 0;
        this.applyTime();
      }
      this.updatePlayer(dt, now);
      this.updateTraffic(dt, now);
      this.updatePeds(dt, now);
      this.updatePolice(dt, now);
      this.updateCams(now);
      this.updatePickups(dt, now);
      this.updateMission(dt, now);
      this.updateNear();
      this.updateGps(now);
      this.updateRain(dt);
      this.updateCamera(dt);
      if (this.msgT > 0) this.msgT -= dt;
      if (this.flash > 0) this.flash -= dt;
      this.mapT = (this.mapT || 0) + dt;
      if (this.mapT > 0.08) {
        this.mapT = 0;
        this.drawMinimap();
      }
    }

    // 給介面用：現在的狀態
    get state() {
      const p = this.player;
      const v = p.car;
      const nv = v ? null : this.nearVehicle();
      return {
        mode: v ? (v.scooter ? 'scooter' : 'car') : 'foot',
        kmh: v ? Math.round(Math.abs(v.v) * KMH) : Math.round(p.v * KMH),
        limit: LIMIT,
        wanted: this.wanted,
        mission: this.mission,
        msg: this.msgT > 0 ? this.msg : '',
        near: this.near,
        nearName: this.near ? (this.doors.find((d) => d.id === this.near) || {}).name : '',
        carNear: nv ? (nv.own ? (nv.scooter ? '騎上機車' : '上車') : nv.ai ? (nv.police ? '搶警車' : nv.scooter ? '搶機車' : '搶車') : '開走這台車') : '',
        vehicle: v ? (v.own ? v.name : v.police ? '警車' : v.taxi ? '計程車' : v.scooter ? '機車' : '別人的車') : '',
        flash: this.flash > 0,
        night: this.night > 0.5,
      };
    }

    render() {
      this.view.renderer.render(this.scene, this.camera);
      this.updateLabels();
    }

    destroy() {
      const el = this.view.dom;
      el.removeEventListener('pointerdown', this._down);
      el.removeEventListener('pointermove', this._move);
      el.removeEventListener('pointerup', this._up);
      el.removeEventListener('pointercancel', this._up);
      el.removeEventListener('wheel', this._wheel);
      this.overlay.remove();
      this.mapEl.remove();
      if (this.fpsMon && this.view.setQuality) this.view.setQuality(this.view.quality);
      const shared = new Set([...carGeoCache.values()].map((x) => x.geo));
      this.scene.traverse((o) => {
        if (o.geometry && !shared.has(o.geometry) && !(o.geometry.userData && o.geometry.userData.shared)) o.geometry.dispose();
        if (o.material) [].concat(o.material).forEach((m) => {
          if (m.map) m.map.dispose();
          if (m.emissiveMap) m.emissiveMap.dispose();
          m.dispose();
        });
      });
    }
  }

  World3D.geo = { P, ROAD, BLOCK, W, H };
  World3D.nodePath = nodePath;
  root.BossWorld3D = World3D;
})(typeof window !== 'undefined' ? window : globalThis);
