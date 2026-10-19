// 老闆出門的小場景：夜市、廟、夜店、批發市場、隔壁對手的店
// 跟店面共用同一個 renderer 和鏡頭；老闆在這裡自由走動，走到攤位或人旁邊按 E 互動
(function (root) {
  const THREE = root.THREE;
  if (!THREE) return;
  const People = root.BossPeople;

  const mats = new Map();
  const mat = (c, o = {}) => {
    const k = c + JSON.stringify(o);
    if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, ...o }));
    return mats.get(k);
  };
  function box(g, w, h, d, c, x, y, z, o) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof c === 'string' ? mat(c, o) : c);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  }
  function cyl(g, r, h, c, x, y, z, seg = 16, o) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat(c, o));
    m.position.set(x, y + h / 2, z);
    m.castShadow = true;
    g.add(m);
    return m;
  }
  function signTex(text, bg, fg = '#ffffff', w = 512, h = 128) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const x = c.getContext('2d');
    x.fillStyle = bg;
    x.fillRect(0, 0, w, h);
    x.fillStyle = fg;
    x.font = `bold ${Math.round(h * 0.55)}px "PingFang TC","Noto Sans TC",sans-serif`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(text, w / 2, h / 2 + 4);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }
  function sign(g, text, bg, x, y, z, w = 1.6, h = 0.45, rotY = 0, fg) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: signTex(text, bg, fg), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    g.add(m);
    return m;
  }
  // 攤位：桌子、遮雨棚、招牌
  function stall(g, x, z, name, color, face = 1) {
    box(g, 1.8, 0.9, 0.9, '#d9cbb5', x, 0, z);
    for (const dx of [-0.85, 0.85]) box(g, 0.06, 2.1, 0.06, '#555', x + dx, 0, z - 0.4 * face);
    const roof = box(g, 2.0, 0.08, 1.3, color, x, 2.1, z - 0.1 * face);
    roof.rotation.x = 0.15 * face;
    sign(g, name, color, x, 2.45, z + 0.2 * face, 1.7, 0.42, 0);
    for (let i = 0; i < 4; i++) cyl(g, 0.08, 0.12, ['#f2c14e', '#e67e22', '#c0392b', '#ffffff'][i], x - 0.6 + i * 0.4, 0.9, z, 10);
  }
  // 燈籠串：掛在攤位後面，不要擋到走道上的人
  function lanternRow(g, x0, x1, z, y = 2.8) {
    box(g, x1 - x0 + 0.6, 0.02, 0.02, '#333', (x0 + x1) / 2, y + 0.18, z);
    for (let x = x0; x <= x1; x += 1.2) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: '#ff4d3a' }));
      l.scale.y = 1.25;
      l.position.set(x, y, z);
      g.add(l);
    }
  }

  // ───── 各個場景 ─────
  // 每個場景回傳：邊界、擋路的方塊、互動點、出口、出生點、要不要晚上、人潮
  const SCENES = {
    market(g, sim) {
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 14), mat('#3b3a40'));
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(6, 0, 3);
      ground.receiveShadow = true;
      g.add(ground);
      const stalls = [
        ['chicken', '炸雞排', '#d9482b', 0, 0, 1],
        ['stinky', '臭豆腐', '#6b8e23', 3, 0, 1],
        ['boba', '珍珠奶茶', '#8a5a2b', 6, 0, 1],
        ['fortune', '鐵口直斷', '#6c5ce7', 9, 0, 1],
        ['balloon', '射氣球', '#2c6fbb', 1.5, 6, -1],
        ['ring', '套圈圈', '#e0478a', 4.5, 6, -1],
        ['fan', '', '', 8, 4.2, 0],
      ];
      const hotspots = [];
      const blockers = [];
      for (const [id, name, color, x, z, face] of stalls) {
        if (!face) continue;
        stall(g, x, z, name, color, face);
        blockers.push([x - 1, z - 0.6, x + 1, z + 0.5]);
        hotspots.push({ id, x, z: z + 1.0 * face, label: name, icon: { chicken: '🍗', stinky: '🧆', boba: '🧋', fortune: '🔮', balloon: '🎈', ring: '⭕' }[id] });
      }
      hotspots.push({ id: 'fan', x: 8, z: 3, label: '認出你的熟客', icon: '🙋', npc: { gender: 'f', skin: '#ecc19f', hair: '#4a3428', hairStyle: 'long', shirt: '#5aa9a0' } });
      lanternRow(g, -1, 10, -0.9);
      lanternRow(g, -1, 10, 6.9);
      sign(g, '觀光夜市', '#c0392b', 4.5, 3.6, -0.6, 3, 0.7);
      return { bounds: [-1.5, 0.8, 10.5, 5.4], blockers, hotspots, exit: { x: -1, z: 3 }, spawn: { x: 0, z: 3 }, night: true, crowd: 14, crowdArea: [-0.5, 1.4, 10, 4.6] };
    },
    temple(g) {
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(24, 16), mat('#cfc3b0'));
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(4, 0, 3);
      ground.receiveShadow = true;
      g.add(ground);
      // 廟：紅牆、屋頂、龍柱
      box(g, 8, 2.6, 2.2, '#b8312f', 4, 0, -1.2);
      const roof = box(g, 9.2, 0.35, 3.0, '#e2a12a', 4, 2.6, -1.2);
      roof.rotation.z = 0;
      box(g, 7, 0.5, 2.4, '#c0392b', 4, 2.95, -1.2);
      box(g, 3.4, 0.4, 1.6, '#e2a12a', 4, 3.45, -1.2);
      for (const x of [1.2, 2.6, 5.4, 6.8]) cyl(g, 0.18, 2.6, '#7a1e18', x, 0, 0.0, 12);
      sign(g, '福德宮', '#7a1e18', 4, 2.3, 0.02, 2.2, 0.55, 0, '#f2c14e');
      // 香爐、供桌、籤筒、香油錢箱
      cyl(g, 0.55, 0.9, '#8a6a3e', 4, 0, 2.6, 18, { metalness: 0.6 });
      box(g, 2.2, 0.85, 0.8, '#a8322b', 4, 0, 0.9);
      cyl(g, 0.18, 0.5, '#c9a36b', 1.6, 0.0, 2.4, 12);
      box(g, 0.6, 0.7, 0.5, '#a8322b', 6.6, 0, 2.2);
      sign(g, '香油錢', '#a8322b', 6.6, 1.0, 2.46, 0.6, 0.22, 0, '#f2c14e');
      const hotspots = [
        { id: 'incense', x: 4, z: 3.6, label: '上香', icon: '🙏' },
        { id: 'jiao', x: 3.2, z: 1.8, label: '擲筊', icon: '🌗' },
        { id: 'lots', x: 1.6, z: 3.1, label: '抽籤', icon: '🎋' },
        { id: 'donate', x: 6.6, z: 3.0, label: '添香油錢（$200）', icon: '💰' },
        { id: 'keeper', x: 7.8, z: 1.4, label: '跟廟公聊天', icon: '👴', npc: { gender: 'm', skin: '#c48d66', hair: '#c8c8c8', hairStyle: 'bald', shirt: '#f2e2a8', old: true } },
      ];
      return { bounds: [-1, 0.6, 9, 6], blockers: [[0, -2.5, 8, 0.2], [3.3, 2.0, 4.7, 3.2], [2.9, 0.4, 5.1, 1.35], [6.2, 1.9, 7.0, 2.5]], hotspots, exit: { x: 4, z: 6 }, spawn: { x: 4, z: 5.2 }, night: false, crowd: 5, crowdArea: [0, 3.5, 8, 5.5], elderly: true };
    },
    club(g) {
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 14), mat('#15121c'));
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(4, 0, 3);
      g.add(ground);
      // 會發光的舞池
      const tiles = [];
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 4; j++) {
          const t = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), new THREE.MeshBasicMaterial({ color: '#6c5ce7' }));
          t.rotation.x = -Math.PI / 2;
          t.position.set(2 + i, 0.01, 1.5 + j);
          g.add(t);
          tiles.push(t);
        }
      }
      box(g, 2.4, 1.1, 0.9, '#222', 4, 0, -0.4);
      box(g, 0.7, 1.6, 0.7, '#111', 2.2, 0, -0.5);
      box(g, 0.7, 1.6, 0.7, '#111', 5.8, 0, -0.5);
      sign(g, 'DJ', '#e0478a', 4, 1.6, 0.06, 1.2, 0.4);
      box(g, 0.8, 1.1, 4, '#3a2c25', 8.6, 0, 3.2);
      sign(g, 'BAR', '#2c6fbb', 8.6, 1.8, 3.2, 1.4, 0.4, -Math.PI / 2);
      const hotspots = [
        { id: 'dance', x: 4, z: 3, label: '上舞池跳舞', icon: '🕺' },
        { id: 'bar', x: 7.8, z: 3.2, label: '去吧台點一杯', icon: '🍸' },
        { id: 'dj', x: 4, z: 0.6, label: '跟 DJ 點歌（$200）', icon: '🎧' },
        { id: 'students', x: 0.6, z: 4.4, label: '跟一群大學生聊天', icon: '🎓', npc: { gender: 'm', skin: '#ecc19f', hair: '#2b2420', hairStyle: 'spiky', shirt: '#e74c3c' } },
      ];
      if (g.userData.rival) hotspots.push({ id: 'rivalboss', x: 7.8, z: 5.4, label: '跟隔壁老闆喝一杯', icon: '🍻', npc: { gender: 'm', skin: '#dcaa83', hair: '#2b2420', hairStyle: 'slick', shirt: '#e8e2d8', apron: '#c0392b' } });
      return { bounds: [-0.5, 0.3, 9, 6], blockers: [[2.6, -1, 5.4, 0.15], [8.1, 1.1, 9.2, 5.3]], hotspots, exit: { x: -0.4, z: 5.5 }, spawn: { x: 0.4, z: 5.2 }, night: true, crowd: 12, crowdArea: [1.8, 1.5, 6.2, 4.6], dance: true, tiles };
    },
    wholesale(g, sim) {
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(24, 14), mat('#8f8f8a'));
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(5, 0, 3);
      ground.receiveShadow = true;
      g.add(ground);
      const colors = ['#2f8f6b', '#c0392b', '#e2a12a', '#2c6fbb', '#8e44ad'];
      const hotspots = [];
      const blockers = [];
      (sim.ind.stock || []).forEach((st, i) => {
        const x = i * 3.2;
        stall(g, x, 0, st.name.split('・')[0], colors[i % colors.length], 1);
        for (let k = 0; k < 3; k++) box(g, 0.5, 0.4, 0.4, '#c89b5e', x - 1.2 + k * 0.1, 0, 1.4 + k * 0.05);
        blockers.push([x - 1, -0.6, x + 1, 0.5]);
        hotspots.push({ id: `buy:${st.id}`, x, z: 1.0, label: `補${st.name}（八五折）`, icon: st.icon });
      });
      hotspots.push({ id: 'haggle', x: 6, z: 4.2, label: '跟批發阿伯殺價', icon: '🗣️', npc: { gender: 'm', skin: '#c48d66', hair: '#6e6e6e', hairStyle: 'short', shirt: '#2f6db5', old: true } });
      sign(g, '果菜批發市場', '#2f8f6b', 4, 3.4, -0.8, 3.2, 0.6);
      return { bounds: [-1.5, 0.7, 10, 5.5], blockers, hotspots, exit: { x: -1.4, z: 4.5 }, spawn: { x: -0.6, z: 4.2 }, night: false, crowd: 7, crowdArea: [-1, 2.5, 9, 5] };
    },
    rival(g, sim) {
      const r = sim.rival;
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(12, 10), mat('#efe7da'));
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(3.5, 0, 2.5);
      ground.receiveShadow = true;
      g.add(ground);
      box(g, 8, 2.4, 0.15, '#e8ddcf', 3.5, 0, -0.6);
      box(g, 0.15, 2.4, 6, '#e8ddcf', -0.5, 0, 2.4);
      box(g, 3.2, 0.95, 0.8, r ? r.color : '#888', 3.5, 0, 0.6);
      sign(g, r ? r.name : '隔壁', r ? r.color : '#888', 3.5, 2.0, -0.5, 3.2, 0.6);
      box(g, 1.2, 0.05, 0.6, '#ffffff', 1.0, 0.72, 3.4);
      box(g, 1.2, 0.05, 0.6, '#ffffff', 5.6, 0.72, 3.4);
      for (const [x, z] of [[1.0, 3.4], [5.6, 3.4]]) for (const dx of [-0.5, 0.5]) box(g, 0.05, 0.72, 0.05, '#999', x + dx, 0, z);
      box(g, 0.9, 1.6, 0.6, '#9aa1a9', 6.6, 0, -0.2);
      const hotspots = [
        { id: 'taste', x: 3.5, z: 1.6, label: '點一份試吃', icon: '🍽️' },
        { id: 'peek', x: 6.4, z: 0.7, label: '偷看廚房', icon: '👀' },
        { id: 'talk', x: 2.0, z: 1.6, label: '跟店員聊天（挖角）', icon: '🧲', npc: { gender: 'f', skin: '#ecc19f', hair: '#2b2420', hairStyle: 'bun', shirt: r ? r.color : '#888' } },
        { id: 'flyer', x: 3.5, z: 5.0, label: '在他門口發傳單', icon: '📄' },
      ];
      return { bounds: [0, 1.2, 7, 5.6], blockers: [[1.8, 0.1, 5.2, 1.1], [0.3, 3.0, 1.7, 3.8], [4.9, 3.0, 6.3, 3.8]], hotspots, exit: { x: 3.5, z: 5.6 }, spawn: { x: 3.5, z: 4.6 }, night: false, crowd: Math.round(2 + (r ? r.strength : 0.3) * 8), crowdArea: [0.3, 2.0, 6.7, 4.6], indoor: true };
    },
  };

  class Place3D {
    constructor(view, sim, id, opts = {}) {
      this.view = view;
      this.sim = sim;
      this.id = id;
      this.opts = opts;
      this.scene = new THREE.Scene();
      this.root = new THREE.Group();
      this.root.userData.rival = !!(sim.rival && !sim.rival.closed);
      this.scene.add(this.root);
      const def = SCENES[id](this.root, sim);
      Object.assign(this, def);
      this.done = new Set();
      // 燈光：夜市和夜店是晚上
      this.scene.background = new THREE.Color(this.night ? '#141a2b' : this.indoor ? '#d9cfc0' : '#cfdde8');
      this.scene.add(new THREE.HemisphereLight('#ffffff', '#6b5f55', this.night ? 0.45 : 0.85));
      const sun = new THREE.DirectionalLight(this.night ? '#ffcf9a' : '#fff3e0', this.night ? 0.5 : 0.9);
      sun.position.set(6, 12, 8);
      this.scene.add(sun);
      if (this.night) {
        this.glow = new THREE.PointLight('#ff9a5a', 1.2, 16, 1.4);
        this.glow.position.set(4, 3, 3);
        this.scene.add(this.glow);
      }
      if (this.dance) {
        this.disco = [new THREE.PointLight('#ff4fa3', 1.6, 8), new THREE.PointLight('#4fd2ff', 1.6, 8)];
        this.disco.forEach((l) => this.scene.add(l));
      }
      // 互動對象：有人的就放一個小人
      for (const h of this.hotspots) {
        if (h.npc) {
          const p = People.make({ ...window.BossLooks.randomLook(Math.random), ...h.npc });
          p.group.position.set(h.x, 0, h.z - 0.5);
          this.root.add(p.group);
          h.person = p;
        }
      }
      // 出口
      const exit = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 24), new THREE.MeshBasicMaterial({ color: '#2fbf71', transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
      exit.rotation.x = -Math.PI / 2;
      exit.position.set(this.exit.x, 0.03, this.exit.z);
      this.root.add(exit);
      // 人潮
      this.crowdPeople = [];
      const [ax0, az0, ax1, az1] = this.crowdArea;
      for (let i = 0; i < this.crowd; i++) {
        const look = window.BossLooks.randomLook(Math.random);
        if (this.elderly) Object.assign(look, { old: true, hair: '#c8c8c8' });
        const p = People.make(look);
        const c = { p, x: ax0 + Math.random() * (ax1 - ax0), z: az0 + Math.random() * (az1 - az0), tx: 0, tz: 0, wait: Math.random() * 3 };
        c.tx = c.x;
        c.tz = c.z;
        p.group.position.set(c.x, 0, c.z);
        this.root.add(p.group);
        this.crowdPeople.push(c);
      }
      // 老闆
      this.boss = { x: this.spawn.x, z: this.spawn.z, dir: Math.PI, moving: false, path: null };
      this.bossP = People.make(window.BossLooks.bossLook(opts.gender || 'm'), { boss: true });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.38, 24), new THREE.MeshBasicMaterial({ color: '#f2c14e', depthWrite: false, transparent: true }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.025;
      this.bossP.group.add(ring);
      this.root.add(this.bossP.group);
      // 文字標籤
      this.overlay = document.createElement('div');
      this.overlay.className = 'shop-overlay place-overlay';
      view.container.appendChild(this.overlay);
      this.labels = new Map();
      this.zoom = 1.25;
    }

    // 剛剛做了什麼：畫面上方的小卡片，幾秒後自己消失
    showLog(text, chips = [], fail = false) {
      if (!this.log) {
        this.log = document.createElement('div');
        this.log.className = 'place-log';
        this.view.container.appendChild(this.log);
      }
      const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
      this.log.className = `place-log show ${fail ? 'fail' : ''}`;
      this.log.innerHTML = `<div>${esc(text)}</div>${chips.length ? `<div class="chips">${chips.map((c) => `<span class="chip ${/^[💸📉⚡]/u.test(c) && /-/.test(c) ? 'bad' : 'good'}">${esc(c)}</span>`).join('')}</div>` : ''}`;
      clearTimeout(this.logT);
      this.logT = setTimeout(() => this.log && this.log.classList.remove('show'), 6500);
    }

    destroy() {
      clearTimeout(this.logT);
      if (this.log) this.log.remove();
      this.log = null;
      this.overlay.remove();
      this.scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material && o.material.map) o.material.map.dispose();
      });
    }

    blocked(x, z) {
      const [bx0, bz0, bx1, bz1] = this.bounds;
      if (x < bx0 || x > bx1 || z < bz0 || z > bz1) return true;
      return this.blockers.some(([x0, z0, x1, z1]) => x > x0 - 0.25 && x < x1 + 0.25 && z > z0 - 0.25 && z < z1 + 0.25);
    }

    // 點地板走過去
    tapWalk(clientX, clientY) {
      const r = this.view.dom.getBoundingClientRect();
      const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      const rc = new THREE.Raycaster();
      rc.setFromCamera(ndc, this.view.camera);
      const p = new THREE.Vector3();
      if (rc.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p)) this.boss.path = { x: p.x, z: p.z };
    }

    move(vx, vz, sec) {
      const b = this.boss;
      if (!vx && !vz && b.path) {
        vx = b.path.x - b.x;
        vz = b.path.z - b.z;
        if (Math.hypot(vx, vz) < 0.1) {
          b.path = null;
          vx = vz = 0;
        }
      } else if (vx || vz) b.path = null;
      const len = Math.hypot(vx, vz);
      b.moving = len > 0.05;
      if (!b.moving) return;
      const sp = 3.2 * sec;
      const dx = (vx / Math.max(1, len)) * sp;
      const dz = (vz / Math.max(1, len)) * sp;
      if (!this.blocked(b.x + dx, b.z)) b.x += dx;
      else if (b.path) b.path = null;
      if (!this.blocked(b.x, b.z + dz)) b.z += dz;
      b.dir = Math.atan2(dx, dz);
    }

    // 附近可以互動的東西
    targets() {
      const b = this.boss;
      const out = this.hotspots
        .map((h) => ({ ...h, d: Math.hypot(h.x - b.x, h.z - b.z) }))
        .filter((h) => h.d < 1.3)
        .sort((a, c) => a.d - c.d);
      if (Math.hypot(this.exit.x - b.x, this.exit.z - b.z) < 1) out.unshift({ id: 'exit', label: '回店裡', icon: '🚪', x: this.exit.x, z: this.exit.z, d: 0 });
      return out;
    }

    update(dt, now) {
      const b = this.boss;
      const g = this.bossP.group;
      g.position.set(b.x, 0, b.z);
      let diff = b.dir - g.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      g.rotation.y += diff * Math.min(1, dt * 14);
      People.walk(this.bossP, b.moving, dt, 1.2);
      if (this.dancing && this.dancing > now) {
        this.bossP.group.position.y = Math.abs(Math.sin(now / 150)) * 0.15;
        this.bossP.armL.rotation.x = -2.4 + Math.sin(now / 120) * 0.6;
        this.bossP.armR.rotation.x = -2.4 + Math.cos(now / 120) * 0.6;
      }
      // 人潮：隨便走走；夜店的人在跳舞
      for (const c of this.crowdPeople) {
        if (this.dance) {
          c.p.group.position.y = Math.abs(Math.sin(now / 180 + c.x * 3)) * 0.12;
          c.p.armL.rotation.x = -2 + Math.sin(now / 160 + c.z) * 0.8;
          c.p.armR.rotation.x = -2 + Math.cos(now / 160 + c.x) * 0.8;
          continue;
        }
        c.wait -= dt;
        if (c.wait <= 0) {
          const [ax0, az0, ax1, az1] = this.crowdArea;
          c.tx = ax0 + Math.random() * (ax1 - ax0);
          c.tz = az0 + Math.random() * (az1 - az0);
          c.wait = 3 + Math.random() * 5;
        }
        const dx = c.tx - c.x;
        const dz = c.tz - c.z;
        const d = Math.hypot(dx, dz);
        const moving = d > 0.1;
        if (moving) {
          c.x += (dx / d) * Math.min(d, 0.9 * dt);
          c.z += (dz / d) * Math.min(d, 0.9 * dt);
          c.p.group.rotation.y = Math.atan2(dx, dz);
        }
        c.p.group.position.set(c.x, c.p.group.position.y, c.z);
        People.walk(c.p, moving, dt, 0.8);
      }
      for (const h of this.hotspots) if (h.person) h.person.group.rotation.y = Math.atan2(b.x - h.x, b.z - (h.z - 0.5));
      if (this.disco) {
        this.disco[0].position.set(4 + Math.sin(now / 700) * 2.5, 2.5, 3 + Math.cos(now / 900) * 1.5);
        this.disco[1].position.set(4 + Math.cos(now / 800) * 2.5, 2.5, 3 + Math.sin(now / 600) * 1.5);
        const hue = (now / 2000) % 1;
        this.tiles.forEach((t, i) => t.material.color.setHSL((hue + i * 0.07) % 1, 0.8, 0.45 + 0.15 * Math.sin(now / 200 + i)));
      }
      this.updateCamera();
    }

    updateCamera() {
      const cam = this.view.camera;
      const az = Math.PI / 4 + (this.view.camRot * Math.PI) / 2;
      const d = 30;
      const c = new THREE.Vector3(this.boss.x, 0, this.boss.z);
      cam.position.set(c.x + Math.sin(az) * d, d * 0.82, c.z + Math.cos(az) * d);
      cam.lookAt(c);
      const aspect = this.view.aspect || 1.6;
      const h = 9 / this.zoom;
      const w = h * aspect;
      Object.assign(cam, { left: -w / 2, right: w / 2, top: h / 2, bottom: -h / 2 });
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
    }

    render() {
      this.view.renderer.render(this.scene, this.view.camera);
      this.updateOverlay();
    }

    label(key, cls) {
      let el = this.labels.get(key);
      if (!el) {
        el = document.createElement('div');
        el.className = cls;
        this.overlay.appendChild(el);
        this.labels.set(key, el);
      }
      return el;
    }

    place(el, x, y, z) {
      const v = new THREE.Vector3(x, y, z).project(this.view.camera);
      const r = this.view.dom.getBoundingClientRect();
      el.style.transform = `translate(${(((v.x + 1) / 2) * r.width).toFixed(1)}px, ${(((1 - v.y) / 2) * r.height).toFixed(1)}px) translate(-50%, -100%)`;
    }

    updateOverlay() {
      const t = this.targets()[0];
      for (const h of this.hotspots) {
        const el = this.label(`h-${h.id}`, `place-tag ${this.done.has(h.id) ? 'done' : ''} ${t && t.id === h.id ? 'near' : ''}`);
        el.className = `place-tag ${this.done.has(h.id) ? 'done' : ''} ${t && t.id === h.id ? 'near' : ''}`;
        const text = `${h.icon} ${h.label}${t && t.id === h.id ? (this.opts.touch ? '　👆' : '　[E]') : ''}`;
        if (el.textContent !== text) el.textContent = text;
        this.place(el, h.x, h.person ? 2.3 : 1.6, h.z);
      }
      const ex = this.label('exit', `place-tag exit ${t && t.id === 'exit' ? 'near' : ''}`);
      ex.className = `place-tag exit ${t && t.id === 'exit' ? 'near' : ''}`;
      const et = `🚪 出口・回店裡${t && t.id === 'exit' ? (this.opts.touch ? '　👆' : '　[E]') : ''}`;
      if (ex.textContent !== et) ex.textContent = et;
      this.place(ex, this.exit.x, 0.9, this.exit.z);
      const me = this.label('me', 'boss-tag');
      if (me.textContent !== this.say) me.textContent = this.say || '👑 你';
      this.place(me, this.boss.x, 2.3, this.boss.z);
    }
  }

  root.BossPlace3D = Place3D;
  root.BossPlace3D.SCENES = Object.keys(SCENES);
})(typeof window !== 'undefined' ? window : globalThis);
