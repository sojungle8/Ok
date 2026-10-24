// 🗺️ 3D 城市（雙北）：從店裡拉遠就看到整座城市；點地標，老闆騎機車沿著馬路過去
// 跟店面共用同一個 renderer 和鏡頭；建築、車子都用 InstancedMesh（整座城市只要幾次 draw call，手機也跑得動）
(function (root) {
  const THREE = root.THREE;
  if (!THREE) return;
  const City = root.BossCity;
  const People = root.BossPeople;

  const BLOCK = 4; // 街區邊長
  const ROAD = 1.3; // 馬路寬
  const P = BLOCK + ROAD; // 一格的距離
  // 街區 → 世界座標（街區左上角）；路口 → 世界座標
  const bx0 = (x) => x * P + ROAD / 2;
  const nodeXZ = (ix, iy) => [ix * P, iy * P];
  const blockCenter = (x, y) => [bx0(x) + BLOCK / 2, bx0(y) + BLOCK / 2];

  // 一點點固定的亂數（同一座城市每次看都一樣）
  function rand(seed) {
    let a = seed | 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const HOUSE = ['#efe3cf', '#e2d4c0', '#d9c7b0', '#f2ead9', '#cfd6d9', '#e8d2c4', '#d8dccb'];
  const SHOP = ['#f4c26b', '#e57a5a', '#6fb3d2', '#8cc084', '#f0a3b5', '#c9a0dc', '#f2d16b'];
  const TOWER = ['#9fb6c8', '#b6c4cf', '#8aa1b4', '#c2ccd4'];
  const ROOF = ['#4a7fb5', '#5f9e6e', '#b5523b', '#4a7fb5', '#7a8f99'];

  class City3D {
    constructor(view, sim, opts = {}) {
      this.view = view;
      this.sim = sim;
      this.opts = opts;
      this.scene = new THREE.Scene();
      this.root = new THREE.Group();
      this.scene.add(this.root);
      this.boxes = [];
      this.trees = [];
      this.build();
      // 燈光：照現在的時間（白天、傍晚、晚上）
      this.hemi = new THREE.HemisphereLight('#ffffff', '#5f5850', 0.9);
      this.sun = new THREE.DirectionalLight('#fff3e0', 0.85);
      this.sun.position.set(20, 40, 25);
      this.scene.add(this.hemi, this.sun);
      this.applyTime();
      // 老闆的機車
      this.bike = this.makeBike();
      this.root.add(this.bike);
      this.placeBike(...this.homeXZ());
      // 路上的車
      this.makeCars();
      // 地標標籤（HTML，好點、字清楚）
      this.overlay = document.createElement('div');
      this.overlay.className = 'shop-overlay city-overlay';
      view.container.appendChild(this.overlay);
      this.labels = [];
      this.makeLabels();
      // 鏡頭：從店門口拉遠到整座城市
      const [hx, hz] = this.homeXZ();
      this.cam = { x: hx, z: hz, zoom: 3.2, az: Math.PI / 4, pitch: 0.95 };
      this.camT = { x: (City.W * P) / 2, z: (City.H * P) / 2, zoom: 1 };
      this.bindInput();
    }

    homeXZ() {
      const h = this.sim.homeXY;
      return blockCenter(h.x, h.y);
    }

    // ───── 蓋城市 ─────
    box(x, y, z, w, h, d, color, rot = 0) {
      this.boxes.push({ x, y, z, w, h, d, color, rot });
    }

    build() {
      const s = this.sim;
      const W = City.W * P;
      const H = City.H * P;
      // 地面（馬路的顏色），旁邊一圈草地
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(W + 30, H + 30), new THREE.MeshLambertMaterial({ color: '#6f6a64' }));
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(W / 2, -0.02, H / 2);
      this.root.add(ground);
      const grass = new THREE.Mesh(new THREE.PlaneGeometry(W + 30, H + 30), new THREE.MeshLambertMaterial({ color: '#9cbf86' }));
      grass.rotation.x = -Math.PI / 2;
      grass.position.set(W / 2, -0.04, H / 2);
      grass.scale.set(1.6, 1.6, 1);
      this.root.add(grass);
      // 淡水河：一整條；兩座橋
      const rx = City.RIVER_X * P;
      const river = new THREE.Mesh(new THREE.PlaneGeometry(P, H + 30), new THREE.MeshLambertMaterial({ color: '#7fb5dc' }));
      river.rotation.x = -Math.PI / 2;
      river.position.set(rx + P / 2, 0.01, H / 2);
      this.root.add(river);
      for (const by of City.BRIDGES) this.box(rx + P / 2, 0.02, by * P, P + 0.4, 0.12, ROAD, '#8d8780');
      // 每個街區
      const r = rand(1234);
      for (let y = 0; y < City.H; y++)
        for (let x = 0; x < City.W; x++) {
          const t = City.typeAt(x, y);
          if (t === 'W') continue;
          const ox = bx0(x);
          const oz = bx0(y);
          // 人行道（街區底座）
          this.box(ox + BLOCK / 2, 0, oz + BLOCK / 2, BLOCK, 0.12, BLOCK, t === 'P' ? '#a7cf8e' : '#cbc3b8');
          this.fillBlock(t, ox, oz, r, x, y);
        }
      // 斑馬線：每個路口畫兩條白線
      for (let iy = 0; iy <= City.H; iy++)
        for (let ix = 0; ix <= City.W; ix++) {
          if (ix === City.RIVER_X || ix === City.RIVER_X + 1) continue;
          const [nx, nz] = nodeXZ(ix, iy);
          for (let k = -2; k <= 2; k++) this.box(nx + k * 0.22, 0.005, nz + ROAD / 2 + 0.25, 0.12, 0.01, 0.45, '#e9e6df');
        }
      // 你的店、分店、對手：特別標出來
      const [hx, hz] = this.homeXZ();
      this.box(hx, 0.12, hz + 0.9, 1.6, 1.4, 1.2, s.style && s.style.sign ? s.style.sign : s.ind.signColor || '#e0582b');
      this.box(hx, 1.52, hz + 0.9, 1.75, 0.18, 1.35, '#ffffff');
      if (s.rival && !s.rival.closed) this.box(hx + 1.4, 0.12, hz - 0.8, 1.2, 1.2, 1.1, '#5a5f6e');
      for (const b of s.branches || []) {
        const L = City.LANDMARKS[b.site];
        if (!L) continue;
        const [cx, cz] = blockCenter(L.x, L.y);
        this.box(cx - 1, 0.12, cz + 1.1, 1.4, 1.3, 1.1, s.ind.signColor || '#e0582b');
      }
      this.commit();
    }

    // 街區裡面：照種類蓋房子
    fillBlock(t, ox, oz, r, bx, by) {
      const B = BLOCK;
      const pick = (arr) => arr[Math.floor(r() * arr.length)];
      if (t === 'R' || t === 'C') {
        // 透天厝、公寓沿著四邊排；商店街一樓有彩色招牌
        for (let i = 0; i < 4; i++) {
          for (const side of [0, 1]) {
            const w = B / 4 - 0.12;
            const h = t === 'C' ? 1.6 + r() * 1.6 : 1.3 + r() * 2.2;
            const x = ox + 0.06 + w / 2 + i * (B / 4);
            const z = side ? oz + B - 0.75 : oz + 0.75;
            this.box(x, 0.12, z, w, h, 1.3, pick(HOUSE));
            if (t === 'C') this.box(x, 0.5, side ? z + 0.68 : z - 0.68, w * 0.9, 0.35, 0.06, pick(SHOP));
            // 頂樓：台灣特色的鐵皮加蓋（藍、綠、紅）和水塔
            if (r() < 0.55) this.box(x, 0.12 + h, z, w * 0.85, 0.4, 0.9, pick(ROOF));
            else if (r() < 0.5) this.box(x, 0.12 + h, z, w * 0.35, 0.45, 0.35, '#d0d4d6');
          }
        }
        if (r() < 0.6) this.trees.push([ox + B / 2, oz + B / 2, 0.9]);
      } else if (t === 'O') {
        const n = r() < 0.5 ? 1 : 2;
        for (let i = 0; i < n; i++) {
          const w = n === 1 ? 2.6 : 1.6;
          const h = 5 + r() * 6;
          this.box(ox + (n === 1 ? B / 2 : 1 + i * 2), 0.12, oz + B / 2, w, h, w, pick(TOWER));
          this.box(ox + (n === 1 ? B / 2 : 1 + i * 2), 0.12 + h, oz + B / 2, w * 0.6, 0.4, w * 0.6, '#6d7f8d');
        }
      } else if (t === 'P') {
        for (let i = 0; i < 6; i++) this.trees.push([ox + 0.5 + r() * (B - 1), oz + 0.5 + r() * (B - 1), 0.8 + r() * 0.5]);
        this.box(ox + B / 2, 0.12, oz + B / 2, 1.2, 0.05, 2.6, '#d9cfb8'); // 步道
      } else if (t === 'S') {
        this.box(ox + B / 2, 0.12, oz + 0.8, B - 0.4, 1.8, 1.2, '#f1e3b4');
        this.box(ox + 0.6, 0.12, oz + 2.2, 0.9, 1.8, 2.2, '#f1e3b4');
        this.box(ox + 2.5, 0.13, oz + 2.8, 2.4, 0.02, 1.6, '#d9775a'); // 跑道
        this.box(ox + 2.5, 0.14, oz + 2.8, 1.8, 0.02, 1.0, '#8fbf6c');
      } else if (t === 'I') {
        for (let i = 0; i < 2; i++) {
          this.box(ox + 1 + i * 2, 0.12, oz + B / 2, 1.7, 1.4, 3, '#c9c2b8');
          for (let k = 0; k < 3; k++) this.box(ox + 1 + i * 2, 1.52, oz + 0.9 + k * 1.1, 1.7, 0.3, 0.5, '#9ba3a8');
        }
      } else if (t === 'T') {
        // 廟：紅柱、橘色屋頂疊兩層、廟埕
        this.box(ox + B / 2, 0.12, oz + B / 2 + 0.6, 3.2, 0.03, 1.6, '#d9c9b0');
        this.box(ox + B / 2, 0.12, oz + 1.4, 2.8, 1.3, 1.8, '#c0392b');
        this.box(ox + B / 2, 1.42, oz + 1.4, 3.3, 0.3, 2.3, '#e67e22');
        this.box(ox + B / 2, 1.72, oz + 1.4, 2.4, 0.35, 1.6, '#f39c12');
        this.box(ox + B / 2 - 1.3, 2.07, oz + 1.4, 0.3, 0.3, 0.3, '#2ecc71');
        this.box(ox + B / 2 + 1.3, 2.07, oz + 1.4, 0.3, 0.3, 0.3, '#2ecc71');
      } else if (t === 'M') {
        // 夜市：一排一排紅黃色的攤位棚子
        for (let i = 0; i < 3; i++)
          for (let k = 0; k < 4; k++) this.box(ox + 0.6 + k * 0.95, 0.12, oz + 0.8 + i * 1.25, 0.8, 0.9, 0.8, ['#e74c3c', '#f1c40f', '#e67e22'][(i + k) % 3]);
      } else if (t === 'H') {
        // 高鐵站：長長的白色車站
        this.box(ox + B / 2, 0.12, oz + B / 2, B - 0.4, 1.1, 2.6, '#f3f3f3');
        this.box(ox + B / 2, 1.22, oz + B / 2, B - 0.2, 0.3, 2.9, '#e0582b');
      }
      // 地標上面加一個醒目的小高塔，遠遠就看得到
      for (const L of Object.values(City.LANDMARKS)) if (L.x === bx && L.y === by && !L.site && t !== 'T' && t !== 'M' && t !== 'H' && t !== 'S') this.box(ox + B / 2, 0.12, oz + B / 2, 1.2, 2.6, 1.2, '#f2c14e');
    }

    // 把收集好的方塊、樹變成 InstancedMesh（一次畫完）
    commit() {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      geo.translate(0, 0.5, 0);
      const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial(), this.boxes.length);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const c = new THREE.Color();
      this.boxes.forEach((b, i) => {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.rot);
        m.compose(new THREE.Vector3(b.x, b.y, b.z), q, new THREE.Vector3(b.w, b.h, b.d));
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, c.set(b.color));
      });
      this.root.add(mesh);
      this.cityMesh = mesh;
      if (this.trees.length) {
        const cone = new THREE.ConeGeometry(0.5, 1.2, 7);
        cone.translate(0, 1.0, 0);
        const tm = new THREE.InstancedMesh(cone, new THREE.MeshLambertMaterial({ color: '#4f8f4a' }), this.trees.length);
        this.trees.forEach(([x, z, s], i) => {
          m.compose(new THREE.Vector3(x, 0.1, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
          tm.setMatrixAt(i, m);
        });
        this.root.add(tm);
      }
    }

    applyTime() {
      const h = this.sim.hour;
      const night = h >= 19 || h < 6;
      const dusk = h >= 17 && h < 19;
      this.scene.background = new THREE.Color(night ? '#1d2438' : dusk ? '#f0b98d' : '#cfe1ee');
      this.hemi.intensity = night ? 0.45 : dusk ? 0.75 : 0.95;
      this.sun.intensity = night ? 0.25 : dusk ? 0.6 : 0.85;
      this.sun.color.set(dusk ? '#ffc58a' : night ? '#9fb2ff' : '#fff3e0');
      this.night = night;
    }

    // ───── 老闆的機車 ─────
    makeBike() {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.8), new THREE.MeshLambertMaterial({ color: '#e0582b' }));
      body.position.y = 0.3;
      g.add(body);
      if (People) {
        const p = People.make(root.BossLooks.bossLook(this.opts.gender || 'm'), { boss: true });
        p.group.scale.setScalar(0.85);
        p.group.position.set(0, 0.15, -0.05);
        g.add(p.group);
        this.rider = p;
      }
      // 頭上的箭頭：遠遠也找得到老闆
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.6, 4), new THREE.MeshBasicMaterial({ color: '#f2c14e' }));
      arrow.rotation.x = Math.PI;
      arrow.position.y = 2.6;
      g.add(arrow);
      this.arrow = arrow;
      g.scale.setScalar(1.3);
      return g;
    }

    placeBike(x, z, dir) {
      this.bike.position.set(x, 0.12, z);
      if (dir != null) this.bike.rotation.y = dir;
    }

    // 路線（路口）→ 世界座標的點，頭尾接到街區中心
    routePoints(from, to) {
      const pts = City.route(from, to).map(([ix, iy]) => nodeXZ(ix, iy));
      return [blockCenter(from.x, from.y), ...pts, blockCenter(to.x, to.y)];
    }

    // 照遊戲時間決定老闆騎到哪裡了（快轉時也會跟著快）
    updateBike(dt, now) {
      const b = this.sim.boss;
      const A = b.away;
      const home = this.sim.homeXY;
      let pts = null;
      let f = 0;
      if (A && A.kind === 'ride') {
        const to = City.placeAt(A.to);
        if (to) {
          pts = this.routePoints(home, to);
          f = 1 - (A.until - this.sim.minute) / Math.max(1, A.ride);
        }
      } else if (A && A.kind === 'rideBack' && A.from) {
        pts = this.routePoints(A.from, home);
        f = 1 - (A.until - this.sim.minute) / Math.max(1, A.ride || 1);
      } else if (A && A.id && City.placeAt(A.id) && A.ride) {
        // 一般出門：去程、在那裡、回程
        const total = A.until - (A.start ?? A.until);
        const el = this.sim.minute - (A.start ?? this.sim.minute);
        const to = City.placeAt(A.id);
        if (el < A.ride) {
          pts = this.routePoints(home, to);
          f = el / A.ride;
        } else if (total - el < A.ride) {
          pts = this.routePoints(to, home);
          f = 1 - (total - el) / A.ride;
        } else {
          const [x, z] = blockCenter(to.x, to.y);
          this.placeBike(x, z);
        }
      } else if (A && A.kind === 'train') {
        // 搭高鐵去外縣市：機車停在高鐵站
        const L = City.LANDMARKS.hsr;
        this.placeBike(...blockCenter(L.x, L.y));
      } else if (!A) this.placeBike(...this.homeXZ());
      if (pts) {
        f = Math.max(0, Math.min(1, f));
        // 沿著折線走到 f 的位置
        let len = 0;
        const seg = [];
        for (let i = 1; i < pts.length; i++) {
          const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
          seg.push(d);
          len += d;
        }
        let want = f * len;
        let i = 0;
        while (i < seg.length - 1 && want > seg[i]) want -= seg[i++];
        const [ax, az] = pts[i];
        const [cx, cz] = pts[i + 1];
        const k = seg[i] ? want / seg[i] : 0;
        // 機車靠右騎
        const dir = Math.atan2(cx - ax, cz - az);
        const off = 0.3;
        this.placeBike(ax + (cx - ax) * k + Math.cos(dir) * off, az + (cz - az) * k - Math.sin(dir) * off, dir);
        if (this.rider) People.walk(this.rider, false, dt, 1);
        this.showRoute(pts);
        // 鏡頭跟著機車（玩家自己拖過畫面就不跟）
        if (!this.userMoved) Object.assign(this.camT, { x: this.bike.position.x, z: this.bike.position.z, zoom: Math.max(this.camT.zoom, 1.5) });
      }
      if (!pts) this.showRoute(null);
      this.arrow.position.y = 2.6 + Math.sin(now / 250) * 0.2;
      this.arrow.rotation.y += dt * 2;
    }

    showRoute(pts) {
      const key = pts ? pts.map((p) => p.join(',')).join(';') : '';
      if (key === this.routeKey) return;
      this.routeKey = key;
      if (this.routeGroup) {
        this.root.remove(this.routeGroup);
        this.routeGroup.children.forEach((m) => m.geometry.dispose());
      }
      this.routeGroup = null;
      if (!pts) return;
      const g = new THREE.Group();
      const mat = this.routeMat || (this.routeMat = new THREE.MeshBasicMaterial({ color: '#ff7a3d', transparent: true, opacity: 0.85 }));
      for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1];
        const [bx, bz] = pts[i];
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 0.01) continue;
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.03, len + 0.35), mat);
        m.position.set((ax + bx) / 2, 0.06, (az + bz) / 2);
        m.rotation.y = Math.atan2(bx - ax, bz - az);
        g.add(m);
      }
      this.root.add(g);
      this.routeGroup = g;
    }

    // ───── 路上的車 ─────
    makeCars() {
      const n = 14;
      const geo = new THREE.BoxGeometry(0.5, 0.35, 0.9);
      geo.translate(0, 0.3, 0);
      this.cars = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial(), n);
      this.carData = [];
      const r = rand(99);
      const c = new THREE.Color();
      for (let i = 0; i < n; i++) {
        const horiz = r() < 0.5;
        const lane = horiz ? Math.floor(r() * (City.H + 1)) : Math.floor(r() * (City.W + 1));
        if (!horiz && (lane === City.RIVER_X + 1)) continue;
        this.carData.push({ horiz, lane, t: r() * (horiz ? City.W : City.H) * P, v: (1.5 + r() * 1.5) * (r() < 0.5 ? 1 : -1) });
        this.cars.setColorAt(this.carData.length - 1, c.set(['#f5f5f5', '#e74c3c', '#3d6fb6', '#f1c40f', '#2c3e50', '#16a085'][i % 6]));
      }
      this.cars.count = this.carData.length;
      this.root.add(this.cars);
    }

    updateCars(dt) {
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const one = new THREE.Vector3(1, 1, 1);
      const spd = this.sim.speedHint || 1;
      this.carData.forEach((c, i) => {
        const span = (c.horiz ? City.W : City.H) * P;
        c.t = (c.t + c.v * dt * spd + span) % span;
        const side = c.v > 0 ? 0.3 : -0.3;
        let x;
        let z;
        // 東西向的車：只在有橋的路上才過得了河
        if (c.horiz) {
          if (!City.BRIDGES.includes(c.lane) && c.t > City.RIVER_X * P - 0.5 && c.t < (City.RIVER_X + 1) * P + 0.5) c.t = c.v > 0 ? (City.RIVER_X + 1) * P + 0.6 : City.RIVER_X * P - 0.6;
          x = c.t;
          z = c.lane * P + side;
          q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), c.v > 0 ? Math.PI / 2 : -Math.PI / 2);
        } else {
          x = c.lane * P - side;
          z = c.t;
          q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), c.v > 0 ? 0 : Math.PI);
        }
        m.compose(new THREE.Vector3(x, 0, z), q, one);
        this.cars.setMatrixAt(i, m);
      });
      this.cars.instanceMatrix.needsUpdate = true;
    }

    // ───── 標籤：地標、你的店、分店（點了選目的地） ─────
    makeLabels() {
      const s = this.sim;
      const add = (id, x, z, text, cls) => {
        const el = document.createElement('button');
        el.className = `city-tag ${cls || ''}`;
        el.dataset.action = 'city-pick';
        el.dataset.id = id;
        el.textContent = text;
        this.overlay.appendChild(el);
        this.labels.push({ el, x, z, y: 3 });
      };
      const [hx, hz] = this.homeXZ();
      add('home', hx, hz, `🏪 ${s.shopName}`, 'home');
      const mine = new Set((s.branches || []).map((b) => b.site));
      for (const [id, L] of Object.entries(City.LANDMARKS)) {
        if (['school', 'mrt', 'park'].includes(id)) continue;
        if (L.site && !mine.has(id)) continue;
        const [x, z] = blockCenter(L.x, L.y);
        add(id, x, z, `${L.icon} ${L.site ? `${L.name}分店` : L.name}`, L.site ? 'branch' : id === 'hsr' ? 'hsr' : '');
      }
      if (s.rival && !s.rival.closed) add('rival', hx + 1.4, hz - 0.8, `🏪 ${s.rival.name}`, 'rival');
    }

    updateOverlay() {
      const r = this.view.dom.getBoundingClientRect();
      const v = new THREE.Vector3();
      for (const L of this.labels) {
        v.set(L.x, L.y, L.z).project(this.view.camera);
        const on = v.x > -1.1 && v.x < 1.1 && v.y > -1.1 && v.y < 1.1;
        L.el.style.display = on ? '' : 'none';
        if (on) L.el.style.transform = `translate(${(((v.x + 1) / 2) * r.width).toFixed(1)}px, ${(((1 - v.y) / 2) * r.height).toFixed(1)}px) translate(-50%, -100%)`;
        L.el.classList.toggle('picked', this.picked === L.el.dataset.id);
      }
    }

    // ───── 鏡頭：拖曳平移、滾輪／兩指縮放 ─────
    bindInput() {
      const el = this.view.dom;
      const pts = new Map();
      let last = null;
      let pinch = 0;
      this._down = (e) => {
        pts.set(e.pointerId, [e.clientX, e.clientY]);
        last = [e.clientX, e.clientY];
        if (pts.size === 2) {
          const [a, b] = [...pts.values()];
          pinch = Math.hypot(a[0] - b[0], a[1] - b[1]);
        }
      };
      this._move = (e) => {
        if (!pts.has(e.pointerId)) return;
        pts.set(e.pointerId, [e.clientX, e.clientY]);
        if (pts.size === 2) {
          const [a, b] = [...pts.values()];
          const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
          if (pinch) this.camT.zoom = Math.max(0.7, Math.min(4, this.camT.zoom * (d / pinch)));
          pinch = d;
          return;
        }
        if (!last) return;
        const dx = e.clientX - last[0];
        const dy = e.clientY - last[1];
        last = [e.clientX, e.clientY];
        const wpp = this.viewH / this.cam.zoom / el.clientHeight;
        const az = this.cam.az;
        // 螢幕左右 → 世界的右方向；上下 → 往前
        const rx = Math.cos(az);
        const rz = -Math.sin(az);
        const fx = -Math.sin(az);
        const fz = -Math.cos(az);
        if (Math.abs(dx) + Math.abs(dy) > 2) this.userMoved = true;
        this.camT.x = this.cam.x -= (dx * rx - (dy * fx) / this.cam.pitch) * wpp;
        this.camT.z = this.cam.z -= (dx * rz - (dy * fz) / this.cam.pitch) * wpp;
        this.clamp();
      };
      this._up = (e) => {
        pts.delete(e.pointerId);
        if (!pts.size) last = null;
        pinch = 0;
      };
      this._wheel = (e) => {
        e.preventDefault();
        this.camT.zoom = Math.max(0.7, Math.min(4, this.camT.zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
      };
      el.addEventListener('pointerdown', this._down);
      el.addEventListener('pointermove', this._move);
      el.addEventListener('pointerup', this._up);
      el.addEventListener('pointercancel', this._up);
      el.addEventListener('wheel', this._wheel, { passive: false });
    }

    clamp() {
      const c = this.camT;
      c.x = Math.max(-2, Math.min(City.W * P + 2, c.x));
      c.z = Math.max(-2, Math.min(City.H * P + 2, c.z));
      this.cam.x = Math.max(-2, Math.min(City.W * P + 2, this.cam.x));
      this.cam.z = Math.max(-2, Math.min(City.H * P + 2, this.cam.z));
    }

    focus(id) {
      const L = id === 'home' ? { ...this.sim.homeXY } : City.LANDMARKS[id];
      if (!L) return;
      const [x, z] = blockCenter(L.x, L.y);
      Object.assign(this.camT, { x, z, zoom: Math.max(this.camT.zoom, 1.6) });
    }

    updateCamera(dt) {
      const k = Math.min(1, dt * 3);
      const c = this.cam;
      c.x += (this.camT.x - c.x) * k;
      c.z += (this.camT.z - c.z) * k;
      c.zoom += (this.camT.zoom - c.zoom) * k;
      const cam = this.view.camera;
      const d = 60;
      cam.position.set(c.x + Math.sin(c.az) * d, d * c.pitch, c.z + Math.cos(c.az) * d);
      cam.lookAt(c.x, 0, c.z);
      const aspect = this.view.aspect || 1.6;
      // 直式手機畫面窄：看的範圍要大一點才看得到整座城市
      this.viewH = aspect < 1 ? 64 : 40;
      const h = this.viewH / c.zoom;
      const w = h * aspect;
      Object.assign(cam, { left: -w / 2, right: w / 2, top: h / 2, bottom: -h / 2, near: 0.1, far: 400 });
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
    }

    update(dt, now) {
      this.tT = (this.tT || 0) + dt;
      if (this.tT > 2) {
        this.tT = 0;
        this.applyTime();
      }
      this.updateCars(dt);
      this.updateBike(dt, now);
      this.updateCamera(dt);
    }

    render() {
      this.view.renderer.render(this.scene, this.view.camera);
      this.updateOverlay();
    }

    destroy() {
      const el = this.view.dom;
      el.removeEventListener('pointerdown', this._down);
      el.removeEventListener('pointermove', this._move);
      el.removeEventListener('pointerup', this._up);
      el.removeEventListener('pointercancel', this._up);
      el.removeEventListener('wheel', this._wheel);
      this.overlay.remove();
      this.scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
    }
  }

  root.BossCity3D = City3D;
})(typeof window !== 'undefined' ? window : globalThis);
