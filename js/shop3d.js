// 店面 3D 場景：台灣街景、店面、設備模型、客人與員工、日夜、鏡頭操作、建造預覽
(function (root) {
  const THREE = root.THREE;
  if (!THREE) return;
  const People = root.BossPeople;
  const { catalogById, OUT_W, STREET } = root.BossSim;

  const WALL_H = 2.4;
  const matCache = new Map();
  const mat = (color, opts = {}) => {
    const key = color + JSON.stringify(opts);
    if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...opts }));
    return matCache.get(key);
  };
  const basic = (color, opts = {}) => {
    const key = 'b' + color + JSON.stringify(opts);
    if (!matCache.has(key)) matCache.set(key, new THREE.MeshBasicMaterial({ color, ...opts }));
    return matCache.get(key);
  };
  const geoCache = new Map();
  const boxGeo = (w, h, d) => {
    const k = `b${w},${h},${d}`;
    if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
    return geoCache.get(k);
  };
  const cylGeo = (rt, rb, h, seg = 16) => {
    const k = `c${rt},${rb},${h},${seg}`;
    if (!geoCache.has(k)) geoCache.set(k, new THREE.CylinderGeometry(rt, rb, h, seg));
    return geoCache.get(k);
  };

  // 在 group 裡放一個方塊（y 是底部高度）
  function B(g, w, h, d, color, x, y, z, opts) {
    const m = new THREE.Mesh(boxGeo(w, h, d), typeof color === 'string' ? mat(color, opts) : color);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  }
  function C(g, rt, rb, h, color, x, y, z, seg, opts) {
    const m = new THREE.Mesh(cylGeo(rt, rb, h, seg), typeof color === 'string' ? mat(color, opts) : color);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  }

  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    return t;
  }

  const NEIGHBORS = [
    ['阿伯水餃', '#c0392b'], ['全家福眼鏡', '#2c6fbb'], ['永和豆漿', '#e67e22'], ['美美服飾', '#d6418a'],
    ['大同電器行', '#1f7a5c'], ['金好運彩券', '#d4a017'], ['仁愛藥局', '#2a9d8f'], ['小林髮廊', '#6c5ce7'],
  ];

  // ───── 設備與家具模型（區域座標：+z 是正面，x 0～w-1 是佔的格子）─────
  const MODELS = {
    griddle(g) {
      B(g, 1.9, 0.82, 0.8, '#c9ced6', 0.5, 0, 0, { metalness: 0.6, roughness: 0.35 });
      B(g, 1.6, 0.04, 0.55, '#1d1d1f', 0.5, 0.82, -0.02, { metalness: 0.4, roughness: 0.5 });
      for (let i = 0; i < 4; i++) C(g, 0.08, 0.08, 0.02, '#f2e3a0', 0.0 + i * 0.32, 0.86, 0, 16);
      B(g, 1.9, 0.5, 0.02, basic('#dff3ff', { transparent: true, opacity: 0.35 }), 0.5, 0.86, 0.38);
      C(g, 0.12, 0.12, 0.18, '#ffffff', 1.3, 0.82, 0.25);
      g.userData.steam = [new THREE.Vector3(0.2, 1.0, 0), new THREE.Vector3(0.8, 1.0, 0)];
    },
    drinkbar(g) {
      B(g, 1.9, 0.86, 0.75, '#e9d8c3', 0.5, 0, 0);
      B(g, 1.95, 0.05, 0.8, '#f6f1ea', 0.5, 0.86, 0);
      C(g, 0.17, 0.17, 0.45, '#b8bec6', 0.0, 0.91, -0.1, 18, { metalness: 0.6, roughness: 0.3 });
      C(g, 0.17, 0.17, 0.45, '#b8bec6', 0.45, 0.91, -0.1, 18, { metalness: 0.6, roughness: 0.3 });
      for (let i = 0; i < 5; i++) C(g, 0.05, 0.04, 0.16, ['#e8c39e', '#f5f1e8', '#c58b54'][i % 3], 0.85 + i * 0.12, 0.91, 0.18);
    },
    noodlepot(g) {
      B(g, 1.9, 0.82, 0.8, '#bfc5cc', 0.5, 0, 0, { metalness: 0.6, roughness: 0.35 });
      C(g, 0.3, 0.28, 0.32, '#9aa1a9', 0.1, 0.82, 0, 24, { metalness: 0.7, roughness: 0.3 });
      C(g, 0.3, 0.28, 0.32, '#9aa1a9', 0.85, 0.82, 0, 24, { metalness: 0.7, roughness: 0.3 });
      C(g, 0.27, 0.27, 0.02, '#c9a36b', 0.1, 1.12, 0, 24);
      C(g, 0.27, 0.27, 0.02, '#7a3d1d', 0.85, 1.12, 0, 24);
      B(g, 0.3, 0.06, 0.3, '#f4f1ec', 1.35, 0.82, 0.15);
      g.userData.steam = [new THREE.Vector3(0.1, 1.2, 0), new THREE.Vector3(0.85, 1.2, 0)];
    },
    sidecase(g) {
      B(g, 1.9, 0.75, 0.75, '#8a5a3b', 0.5, 0, 0);
      B(g, 1.85, 0.5, 0.7, basic('#e8f6ff', { transparent: true, opacity: 0.3 }), 0.5, 0.75, 0);
      const colors = ['#4f9d5a', '#a0522d', '#f2c14e', '#c0392b', '#e8e0d0', '#6b8e23'];
      for (let i = 0; i < 6; i++) C(g, 0.11, 0.09, 0.06, colors[i], -0.25 + (i % 3) * 0.5 + (i > 2 ? 0.25 : 0), 0.76, i > 2 ? 0.15 : -0.15);
    },
    teabar(g) {
      B(g, 1.9, 0.9, 0.75, '#2f8f6b', 0.5, 0, 0);
      B(g, 1.95, 0.05, 0.8, '#f6f1ea', 0.5, 0.9, 0);
      const c = ['#8a5a2b', '#c9a36b', '#3b6b2f', '#d9c27a'];
      for (let i = 0; i < 4; i++) C(g, 0.12, 0.12, 0.4, c[i], -0.2 + i * 0.3, 0.95, -0.2, 16);
      B(g, 0.32, 0.38, 0.32, '#e5e8ec', 1.25, 0.95, -0.05, { metalness: 0.4 });
      for (let i = 0; i < 3; i++) C(g, 0.05, 0.04, 0.17, '#f3e3c3', 0.9 + i * 0.12, 0.95, 0.22);
    },
    barberchair(g) {
      C(g, 0.18, 0.24, 0.32, '#2d2d2d', 0, 0, 0, 16, { metalness: 0.6 });
      B(g, 0.55, 0.14, 0.5, '#b8312f', 0, 0.32, 0);
      B(g, 0.55, 0.6, 0.12, '#b8312f', 0, 0.42, -0.24);
      B(g, 0.08, 0.1, 0.42, '#2d2d2d', -0.3, 0.46, 0);
      B(g, 0.08, 0.1, 0.42, '#2d2d2d', 0.3, 0.46, 0);
      B(g, 0.7, 1.0, 0.04, '#9fc7e0', 0, 0.9, -0.48, { metalness: 0.8, roughness: 0.1 });
      B(g, 0.78, 1.08, 0.03, '#f2f2f2', 0, 0.86, -0.5);
      B(g, 0.6, 0.06, 0.18, '#f2f2f2', 0, 0.8, -0.42);
    },
    washsink(g) {
      B(g, 0.6, 0.7, 0.5, '#f2f2f2', 0, 0, -0.25);
      C(g, 0.22, 0.18, 0.18, '#ffffff', 0, 0.7, -0.3, 20);
      B(g, 0.5, 0.35, 0.7, '#3a3f48', 0, 0, 0.15);
      B(g, 0.5, 0.1, 0.55, '#3a3f48', 0, 0.35, 0.2);
    },
    lift(g) {
      B(g, 1.9, 0.12, 0.95, '#e2a12a', 0.5, 0, 0, { metalness: 0.3 });
      B(g, 1.9, 0.02, 0.1, '#222', 0.5, 0.12, 0.3);
      B(g, 0.5, 0.9, 0.35, '#c0392b', -0.2, 0, -0.35, { metalness: 0.3 });
      for (let i = 0; i < 3; i++) B(g, 0.46, 0.02, 0.3, '#e0e0e0', -0.2, 0.25 + i * 0.28, -0.33);
      // 修理中的機車（有客人時才出現）
      const sc = scooterModel('#2980b9');
      sc.rotation.y = Math.PI / 2;
      sc.position.set(0.5, 0.12, 0.05);
      sc.visible = false;
      g.add(sc);
      g.userData.liftScooter = sc;
    },
    register(g) {
      B(g, 1.9, 0.95, 0.7, '#ffffff', 0.5, 0, 0);
      B(g, 1.95, 0.05, 0.75, '#1f8a4c', 0.5, 0.95, 0);
      B(g, 0.32, 0.22, 0.05, '#222', 0.0, 1.0, -0.05).rotation.x = -0.3;
      B(g, 0.35, 0.45, 0.35, '#3a2c25', 1.2, 1.0, -0.1);
      B(g, 0.6, 0.35, 0.3, '#f2c14e', 0.55, 1.0, 0.15);
      for (let i = 0; i < 4; i++) B(g, 0.1, 0.12, 0.1, ['#e74c3c', '#3498db', '#2ecc71', '#f39c12'][i], 0.35 + i * 0.13, 1.35, 0.15);
    },
    shelf(g) {
      B(g, 1.9, 1.35, 0.55, '#dfe4ea', 0.5, 0, 0);
      const colors = ['#e74c3c', '#f1c40f', '#3498db', '#2ecc71', '#e67e22', '#9b59b6', '#1abc9c', '#ff7aa2'];
      for (let r = 0; r < 4; r++) {
        B(g, 1.9, 0.03, 0.6, '#b8c0c8', 0.5, 0.1 + r * 0.32, 0);
        for (let i = 0; i < 7; i++) B(g, 0.2, 0.22, 0.16, colors[(i + r * 3) % colors.length], -0.35 + i * 0.25, 0.13 + r * 0.32, 0.2);
      }
    },
    fridge(g) {
      B(g, 0.9, 1.9, 0.7, '#e8edf2', 0, 0, 0);
      B(g, 0.8, 1.6, 0.02, basic('#dff3ff', { transparent: true, opacity: 0.45 }), 0, 0.15, 0.36);
      const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#ffffff'];
      for (let r = 0; r < 4; r++) for (let i = 0; i < 4; i++) C(g, 0.05, 0.05, 0.25, colors[(i + r) % colors.length], -0.27 + i * 0.18, 0.2 + r * 0.4, 0.2, 10);
      B(g, 0.8, 0.06, 0.02, basic('#ffffff'), 0, 1.78, 0.36);
    },
    partsrack(g) {
      for (const x of [-0.45, 1.45]) B(g, 0.05, 1.6, 0.05, '#555b66', x, 0, 0);
      for (let r = 0; r < 4; r++) B(g, 1.95, 0.04, 0.5, '#7b828c', 0.5, 0.2 + r * 0.45, 0);
      for (let i = 0; i < 3; i++) {
        const t = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.07, 8, 16), mat('#222'));
        t.position.set(-0.1 + i * 0.45, 0.48, 0);
        t.castShadow = true;
        g.add(t);
      }
      for (let i = 0; i < 6; i++) C(g, 0.06, 0.06, 0.22, ['#e2a12a', '#c0392b', '#2c6fbb'][i % 3], -0.2 + i * 0.28, 1.12, 0, 10);
    },
    table4(g) {
      B(g, 1.6, 0.05, 0.7, '#e9e2d8', 0.5, 0.72, 0);
      for (const [x, z] of [[-0.2, -0.28], [1.2, -0.28], [-0.2, 0.28], [1.2, 0.28]]) B(g, 0.05, 0.72, 0.05, '#9aa1a9', x, 0, z);
      B(g, 0.1, 0.12, 0.1, '#d64541', 0.2, 0.77, 0); // 辣椒罐
      B(g, 0.08, 0.14, 0.08, '#3a2c25', 0.35, 0.77, -0.05);
      for (const x of [0, 1]) stool(g, x, 1);
    },
    counterbar(g) {
      B(g, 1.9, 1.0, 0.4, '#7a5a40', 0.5, 0, -0.15);
      B(g, 1.95, 0.05, 0.5, '#e8d8c0', 0.5, 1.0, -0.12);
      for (const x of [0, 1]) {
        C(g, 0.03, 0.03, 0.7, '#555', x, 0, 0.7, 8);
        C(g, 0.17, 0.17, 0.06, '#c0392b', x, 0.7, 0.7, 16);
      }
    },
    waitbench(g) {
      B(g, 1.8, 0.08, 0.45, '#b07a4f', 0.5, 0.4, 0);
      B(g, 1.8, 0.4, 0.06, '#b07a4f', 0.5, 0.5, -0.2);
      for (const x of [-0.3, 1.3]) B(g, 0.06, 0.4, 0.4, '#5a4030', x, 0, 0);
    },
    waitsofa(g) {
      B(g, 1.85, 0.4, 0.7, '#7d5ba6', 0.5, 0, 0);
      B(g, 1.85, 0.5, 0.18, '#6a4a92', 0.5, 0.35, -0.27);
      for (const x of [-0.42, 1.42]) B(g, 0.15, 0.55, 0.7, '#6a4a92', x, 0, 0);
    },
    breaktable(g) {
      C(g, 0.32, 0.32, 0.04, '#d9cbb5', 0, 0.68, 0, 20);
      C(g, 0.04, 0.04, 0.68, '#777', 0, 0, 0, 8);
      B(g, 0.35, 0.05, 0.35, '#4f7cac', 0, 0.42, 0.42);
      C(g, 0.05, 0.04, 0.1, '#ffffff', 0.1, 0.72, 0.05, 10);
    },
    staffsofa(g) {
      B(g, 1.85, 0.4, 0.7, '#7d8b99', 0.5, 0, 0);
      B(g, 1.85, 0.5, 0.18, '#6c7a88', 0.5, 0.35, -0.27);
      B(g, 0.35, 0.18, 0.2, '#f2d7a7', 0.1, 0.4, -0.05);
    },
    locker(g) {
      B(g, 0.85, 1.8, 0.5, '#8fa1b3', 0, 0, -0.2, { metalness: 0.4 });
      for (const x of [-0.21, 0.21]) B(g, 0.02, 1.6, 0.01, '#5b6b7a', x, 0.1, 0.06);
    },
    plant(g) {
      C(g, 0.2, 0.15, 0.38, '#b5653e', 0, 0, 0);
      const l = new THREE.Mesh(new THREE.IcosahedronGeometry(0.36, 0), mat('#4f9d5a', { flatShading: true }));
      l.position.set(0, 0.72, 0);
      l.castShadow = true;
      g.add(l);
      const l2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 0), mat('#5fb36b', { flatShading: true }));
      l2.position.set(0.12, 1.0, -0.05);
      l2.castShadow = true;
      g.add(l2);
    },
    poster(g) {
      const tex = canvasTex(128, 170, (c, w, h) => {
        c.fillStyle = '#f7e6c4';
        c.fillRect(0, 0, w, h);
        c.fillStyle = '#d9482b';
        c.font = 'bold 34px sans-serif';
        c.textAlign = 'center';
        c.fillText('新品', w / 2, 50);
        c.fillText('上市', w / 2, 90);
        c.fillStyle = '#2b2622';
        c.font = '20px sans-serif';
        c.fillText('歡迎光臨', w / 2, 140);
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.8), new THREE.MeshStandardMaterial({ map: tex }));
      m.position.set(0, 1.4, -0.47);
      g.add(m);
    },
    menuboard(g, view) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7), new THREE.MeshBasicMaterial({ map: view.menuTexture() }));
      m.position.set(0, 1.65, -0.46);
      g.add(m);
      B(g, 1.16, 0.76, 0.03, '#3a2c25', 0, 1.27, -0.49);
    },
    luckycat(g) {
      B(g, 0.3, 0.5, 0.3, '#8a5a3b', 0, 0, 0);
      C(g, 0.13, 0.15, 0.24, '#fbfbfb', 0, 0.5, 0, 14);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 12), mat('#fbfbfb'));
      head.position.set(0, 0.86, 0);
      g.add(head);
      const arm = new THREE.Mesh(boxGeo(0.06, 0.16, 0.06), mat('#fbfbfb'));
      arm.geometry = arm.geometry.clone();
      arm.geometry.translate(0, 0.08, 0);
      arm.position.set(0.12, 0.72, 0.05);
      g.add(arm);
      C(g, 0.04, 0.04, 0.02, '#e2a12a', 0, 0.68, 0.13, 10).rotation.x = Math.PI / 2;
      g.userData.wave = arm;
    },
    shrine(g) {
      B(g, 0.85, 0.9, 0.55, '#a8322b', 0, 0, -0.1);
      B(g, 0.9, 0.05, 0.6, '#d4a017', 0, 0.9, -0.1);
      B(g, 0.5, 0.55, 0.35, '#7a1e18', 0, 0.95, -0.2);
      C(g, 0.06, 0.08, 0.22, '#e2c47a', 0, 0.98, -0.1, 10);
      C(g, 0.07, 0.07, 0.08, '#c9a36b', 0, 0.95, 0.1, 10);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), basic('#ff3b2f'));
      lamp.position.set(-0.3, 1.25, -0.15);
      g.add(lamp);
      const lamp2 = lamp.clone();
      lamp2.position.x = 0.3;
      g.add(lamp2);
    },
    aircon(g) {
      B(g, 0.85, 0.28, 0.22, '#f5f5f5', 0, 1.95, -0.38);
      B(g, 0.7, 0.03, 0.02, '#cfd6dd', 0, 1.98, -0.27);
    },
    fan(g) {
      C(g, 0.15, 0.18, 0.04, '#e0e0e0', 0, 0, 0, 16);
      C(g, 0.025, 0.025, 1.0, '#cfcfcf', 0, 0, 0, 8);
      const head = new THREE.Group();
      head.position.set(0, 1.05, 0.05);
      const cage = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.012, 6, 24), mat('#9fb7cf'));
      head.add(cage);
      const blades = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const b = new THREE.Mesh(boxGeo(0.08, 0.2, 0.01), mat('#7fb2e5'));
        b.position.y = 0.1;
        const p = new THREE.Group();
        p.rotation.z = (i * Math.PI * 2) / 3;
        p.add(b);
        blades.add(p);
      }
      head.add(blades);
      g.add(head);
      g.userData.spin = blades;
    },
    tv(g) {
      B(g, 1.0, 0.6, 0.06, '#151515', 0, 1.5, -0.45);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.52), basic('#4aa3df'));
      s.position.set(0, 1.8, -0.415);
      g.add(s);
      g.userData.screen = s;
    },
    aquarium(g) {
      B(g, 0.85, 0.75, 0.45, '#5a4030', 0, 0, 0);
      B(g, 0.8, 0.55, 0.4, basic('#63b7e6', { transparent: true, opacity: 0.55 }), 0, 0.75, 0);
      const fish = [];
      for (let i = 0; i < 3; i++) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), basic(['#ff8c2b', '#ffd23f', '#ff5a7a'][i]));
        f.scale.set(1.6, 1, 0.6);
        f.position.set(-0.2 + i * 0.2, 0.95 + i * 0.08, 0);
        g.add(f);
        fish.push(f);
      }
      g.userData.fish = fish;
    },
  };

  function stool(g, x, z) {
    C(g, 0.16, 0.19, 0.42, '#d6342b', x, 0, z, 14);
    C(g, 0.17, 0.17, 0.03, '#e8463d', x, 0.42, z, 14);
  }

  function scooterModel(color, box = false) {
    const g = new THREE.Group();
    const body = mat(color, { metalness: 0.3, roughness: 0.4 });
    for (const z of [-0.36, 0.36]) {
      const w = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.05, 8, 16), mat('#1a1a1a'));
      w.rotation.y = Math.PI / 2;
      w.position.set(0, 0.17, z);
      w.castShadow = true;
      g.add(w);
    }
    B(g, 0.26, 0.18, 0.75, body, 0, 0.18, 0.02);
    B(g, 0.24, 0.12, 0.42, mat('#222'), 0, 0.42, -0.12);
    B(g, 0.2, 0.42, 0.12, body, 0, 0.3, 0.38);
    B(g, 0.5, 0.04, 0.05, mat('#333'), 0, 0.72, 0.42);
    // 外送箱
    if (box) B(g, 0.42, 0.38, 0.38, mat('#e0478a'), 0, 0.5, -0.3);
    return g;
  }

  function umbrellaModel(color) {
    const g = new THREE.Group();
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.22, 10, 1, true), new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.6 }));
    canopy.position.y = 1.62;
    canopy.castShadow = true;
    g.add(canopy);
    const pole = new THREE.Mesh(cylGeo(0.012, 0.012, 0.75, 6), mat('#333'));
    pole.position.y = 1.2;
    g.add(pole);
    g.position.set(0.12, 0, 0.05);
    return g;
  }

  class Shop3D {
    constructor(container, sim, opts = {}) {
      this.sim = sim;
      this.container = container;
      this.opts = opts;
      const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      r.shadowMap.enabled = true;
      r.shadowMap.type = THREE.PCFSoftShadowMap;
      r.outputEncoding = THREE.sRGBEncoding;
      this.renderer = r;
      this.dom = r.domElement;
      this.dom.className = 'shop-3d';
      container.appendChild(this.dom);
      this.overlay = document.createElement('div');
      this.overlay.className = 'shop-overlay';
      container.appendChild(this.overlay);

      this.world = new THREE.Scene();
      this.camera = new THREE.OrthographicCamera(-10, 10, 6, -6, 0.1, 300);
      this.camRot = 0; // 0～3，每次轉 90 度
      this.zoom = 1;
      this.pan = new THREE.Vector3();

      this.hemi = new THREE.HemisphereLight('#ffffff', '#8a7d70', 0.7);
      this.sun = new THREE.DirectionalLight('#fff3e0', 0.9);
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(2048, 2048);
      this.sun.shadow.bias = -0.0006;
      this.indoor = new THREE.PointLight('#fff1d6', 0, 18, 1.6);
      this.world.add(this.hemi, this.sun, this.sun.target, this.indoor);

      this.staticGroup = new THREE.Group();
      this.world.add(this.staticGroup);
      this.objMeshes = new Map();
      this.agents = new Map();
      this.labels = new Map();
      this.steam = [];
      this.raycaster = new THREE.Raycaster();
      this.floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      this.ghost = null;
      this.selected = null;
      this.buildStatic();
      this.buildRain();

      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(container);
      this.resize();
      this.bindControls();
      this.lastNow = performance.now();
    }

    destroy() {
      this.ro.disconnect();
      this.unbind();
      this.renderer.dispose();
      this.container.innerHTML = '';
    }

    // ───── 鏡頭 ─────
    resize() {
      const w = this.container.clientWidth || 800;
      const h = this.container.clientHeight || 500;
      this.renderer.setSize(w, h, false);
      this.dom.style.width = `${w}px`;
      this.dom.style.height = `${h}px`;
      this.aspect = w / h;
      this.updateCamera();
    }

    updateCamera() {
      const s = this.sim;
      const cx = s.W / 2;
      const cz = (s.H + 1.2) / 2 + 0.4;
      const az = Math.PI / 4 + (this.camRot * Math.PI) / 2;
      const d = 30;
      const center = new THREE.Vector3(cx, 0, cz).add(this.pan);
      this.camera.position.set(center.x + Math.sin(az) * d, d * 0.82, center.z + Math.cos(az) * d);
      this.camera.lookAt(center);
      this.camera.updateMatrixWorld();
      // 讓整間店加上門口的騎樓剛好塞進畫面
      const inv = this.camera.matrixWorldInverse;
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const x of [-0.5, s.W + 0.5]) {
        for (const z of [-0.3, s.H + 1.6]) {
          for (const y of [0, 1.6]) {
            const v = new THREE.Vector3(x + this.pan.x, y, z + this.pan.z).applyMatrix4(inv);
            minX = Math.min(minX, v.x);
            maxX = Math.max(maxX, v.x);
            minY = Math.min(minY, v.y);
            maxY = Math.max(maxY, v.y);
          }
        }
      }
      let w = (maxX - minX) * 1.05;
      let h = (maxY - minY) * 1.08;
      if (w / h > this.aspect) h = w / this.aspect;
      else w = h * this.aspect;
      const mx = (minX + maxX) / 2;
      const my = (minY + maxY) / 2;
      const z = this.zoom;
      Object.assign(this.camera, { left: mx - w / 2 / z, right: mx + w / 2 / z, top: my + h / 2 / z, bottom: my - h / 2 / z });
      this.camera.updateProjectionMatrix();
      this.sun.shadow.camera.left = -s.W - 4;
      this.sun.shadow.camera.right = s.W + 4;
      this.sun.shadow.camera.top = s.H + 6;
      this.sun.shadow.camera.bottom = -s.H - 6;
      this.sun.shadow.camera.updateProjectionMatrix();
      this.applyCutaway();
    }

    rotate(dir) {
      this.camRot = (this.camRot + dir + 4) % 4;
      this.updateCamera();
    }

    setZoom(z) {
      this.zoom = Math.max(0.7, Math.min(3, z));
      this.updateCamera();
    }

    bindControls() {
      const el = this.dom;
      let drag = null;
      const pts = new Map();
      this._down = (e) => {
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        drag = { x: e.clientX, y: e.clientY, moved: 0, pan: this.pan.clone(), id: e.pointerId };
        if (pts.size === 2) {
          const [a, b] = [...pts.values()];
          drag.pinch = Math.hypot(a.x - b.x, a.y - b.y);
          drag.zoom0 = this.zoom;
        }
        el.setPointerCapture(e.pointerId);
      };
      this._move = (e) => {
        if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (this.opts.onHover && !drag) this.opts.onHover(this.pickTile(e.clientX, e.clientY));
        if (!drag) return;
        if (pts.size === 2 && drag.pinch) {
          const [a, b] = [...pts.values()];
          this.setZoom((drag.zoom0 * Math.hypot(a.x - b.x, a.y - b.y)) / drag.pinch);
          drag.moved = 99;
          return;
        }
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
        if (this.opts.onHover) this.opts.onHover(this.pickTile(e.clientX, e.clientY));
        if (drag.moved > 8 && !this.opts.dragLocked?.()) {
          // 拖曳平移：把螢幕位移換成地面上的位移
          const r = this.dom.getBoundingClientRect();
          const wpp = (this.camera.right - this.camera.left) / r.width;
          const az = Math.PI / 4 + (this.camRot * Math.PI) / 2;
          const right = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az));
          const fwd = new THREE.Vector3(-Math.sin(az), 0, -Math.cos(az));
          this.pan.copy(drag.pan).addScaledVector(right, -dx * wpp).addScaledVector(fwd, (dy * wpp) / 0.6);
          this.pan.x = Math.max(-this.sim.W, Math.min(this.sim.W, this.pan.x));
          this.pan.z = Math.max(-this.sim.H, Math.min(this.sim.H, this.pan.z));
          this.updateCamera();
        }
      };
      this._up = (e) => {
        pts.delete(e.pointerId);
        if (drag && drag.id === e.pointerId && drag.moved <= 8 && this.opts.onClick) this.opts.onClick(this.pick(e.clientX, e.clientY), e);
        if (!pts.size) drag = null;
      };
      this._wheel = (e) => {
        e.preventDefault();
        this.setZoom(this.zoom * (e.deltaY < 0 ? 1.12 : 0.89));
      };
      el.addEventListener('pointerdown', this._down);
      el.addEventListener('pointermove', this._move);
      el.addEventListener('pointerup', this._up);
      el.addEventListener('pointercancel', this._up);
      el.addEventListener('wheel', this._wheel, { passive: false });
    }

    unbind() {
      const el = this.dom;
      el.removeEventListener('pointerdown', this._down);
      el.removeEventListener('pointermove', this._move);
      el.removeEventListener('pointerup', this._up);
      el.removeEventListener('pointercancel', this._up);
      el.removeEventListener('wheel', this._wheel);
    }

    ray(clientX, clientY) {
      const r = this.dom.getBoundingClientRect();
      const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      this.raycaster.setFromCamera(ndc, this.camera);
      return this.raycaster;
    }

    pickTile(clientX, clientY) {
      const p = new THREE.Vector3();
      if (!this.ray(clientX, clientY).ray.intersectPlane(this.floorPlane, p)) return null;
      return { x: Math.floor(p.x), z: Math.floor(p.z) };
    }

    // 點到誰：員工 > 客人 > 物件 > 地板
    pick(clientX, clientY) {
      const rc = this.ray(clientX, clientY);
      const targets = [];
      for (const a of this.agents.values()) if (a.pickable) targets.push(a.p.group);
      for (const m of this.objMeshes.values()) targets.push(m.group);
      const hits = rc.intersectObjects(targets, true);
      for (const h of hits) {
        let o = h.object;
        while (o && !o.userData.pick) o = o.parent;
        if (o) return o.userData.pick;
      }
      const t = this.pickTile(clientX, clientY);
      return t ? { kind: 'tile', ...t } : null;
    }

    // ───── 靜態場景：街道、騎樓、隔壁店家、店面 ─────
    buildStatic() {
      const g = this.staticGroup;
      while (g.children.length) g.remove(g.children[0]);
      const s = this.sim;
      const W = s.W;
      const H = s.H;
      const ind = s.ind;
      this.walls = { back: new THREE.Group(), left: new THREE.Group(), right: new THREE.Group(), front: new THREE.Group() };
      this.neighbors = { left: new THREE.Group(), right: new THREE.Group() };
      Object.values(this.walls).forEach((w) => g.add(w));
      Object.values(this.neighbors).forEach((w) => g.add(w));

      // 地面
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(W + OUT_W * 2 + 30, H + STREET + 30), mat('#7d7468'));
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(W / 2, -0.02, (H + STREET) / 2);
      ground.receiveShadow = true;
      g.add(ground);
      // 騎樓（磁磚）
      const arcade = new THREE.Mesh(
        new THREE.PlaneGeometry(W + OUT_W * 2 + 20, 1),
        new THREE.MeshStandardMaterial({
          map: canvasTex(512, 32, (c, w, h) => {
            for (let i = 0; i < 32; i++) {
              c.fillStyle = i % 2 ? '#c9bfb2' : '#d6ccbf';
              c.fillRect(i * 16, 0, 16, h);
            }
          }),
          roughness: 0.9,
        })
      );
      arcade.rotation.x = -Math.PI / 2;
      arcade.position.set(W / 2, 0.005, H + 0.5);
      arcade.receiveShadow = true;
      g.add(arcade);
      // 馬路
      const road = new THREE.Mesh(new THREE.PlaneGeometry(W + OUT_W * 2 + 30, 2.2), mat('#3e3e44', { roughness: 0.95 }));
      road.rotation.x = -Math.PI / 2;
      road.position.set(W / 2, 0.003, H + 2.2);
      road.receiveShadow = true;
      g.add(road);
      for (let x = -OUT_W - 10; x < W + OUT_W + 10; x += 1.6) {
        const line = new THREE.Mesh(boxGeo(0.8, 0.01, 0.06), basic('#f2f2f2'));
        line.position.set(x, 0.01, H + 2.4);
        g.add(line);
      }
      const redLine = new THREE.Mesh(boxGeo(W + OUT_W * 2 + 30, 0.012, 0.06), basic('#d23c33'));
      redLine.position.set(W / 2, 0.012, H + 1.15);
      g.add(redLine);
      // 騎樓柱子（鏡頭在正面時會降低）
      this.frontProps = new THREE.Group();
      g.add(this.frontProps);
      for (const x of [-OUT_W, 0, W, W + OUT_W]) B(this.frontProps, 0.35, WALL_H + 0.6, 0.35, '#e3d9cb', x, 0, H + 0.95);

      // 店內地板
      const floorTex = canvasTex(W * 32, H * 32, (c) => {
        const cols = { breakfast: ['#f2ead8', '#e6dcc7'], noodle: ['#e9dfd0', '#dccfbd'], drinks: ['#eef3ee', '#e1eae2'], barber: ['#ececec', '#3a3a3a'], scooter: ['#9a9a9a', '#8f8f8f'], store: ['#f4f6f8', '#e8ecef'] }[ind.id] || ['#eee', '#ddd'];
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          c.fillStyle = cols[(x + y) % 2];
          c.fillRect(x * 32, y * 32, 32, 32);
        }
      });
      floorTex.magFilter = THREE.NearestFilter;
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.6 }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(W / 2, 0.01, H / 2);
      floor.receiveShadow = true;
      g.add(floor);

      // 牆
      const wallMat = mat('#f4efe7', { roughness: 0.95 });
      const trim = mat('#9a8572');
      B(this.walls.back, W + 0.3, WALL_H, 0.15, wallMat, W / 2, 0, -0.08);
      B(this.walls.back, W + 0.3, 0.15, 0.17, trim, W / 2, 0, -0.08);
      B(this.walls.left, 0.15, WALL_H, H + 0.3, wallMat, -0.08, 0, H / 2);
      B(this.walls.left, 0.17, 0.15, H + 0.3, trim, -0.08, 0, H / 2);
      B(this.walls.right, 0.15, WALL_H, H + 0.3, wallMat, W + 0.08, 0, H / 2);
      // 前面：門兩邊是玻璃
      const d0 = s.doorX;
      const glass = basic('#cfe8f5', { transparent: true, opacity: 0.25 });
      B(this.walls.front, d0, 0.45, 0.15, trim, d0 / 2, 0, H + 0.02);
      B(this.walls.front, d0, WALL_H - 0.45, 0.06, glass, d0 / 2, 0.45, H + 0.02);
      const rx = d0 + 2;
      B(this.walls.front, W - rx, 0.45, 0.15, trim, rx + (W - rx) / 2, 0, H + 0.02);
      B(this.walls.front, W - rx, WALL_H - 0.45, 0.06, glass, rx + (W - rx) / 2, 0.45, H + 0.02);
      B(this.walls.front, W + 0.3, 0.35, 0.18, trim, W / 2, WALL_H - 0.05, H + 0.02);
      // 招牌
      this.signTex = canvasTex(1024, 192, (c, w, h) => {
        const grad = c.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, ind.signColor);
        grad.addColorStop(1, '#00000033');
        c.fillStyle = ind.signColor;
        c.fillRect(0, 0, w, h);
        c.fillStyle = grad;
        c.fillRect(0, 0, w, h);
        c.strokeStyle = '#ffffff';
        c.lineWidth = 8;
        c.strokeRect(10, 10, w - 20, h - 20);
        c.fillStyle = '#ffffff';
        c.font = 'bold 110px "PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(s.shopName, w / 2, h / 2 + 6);
      });
      this.signMat = new THREE.MeshStandardMaterial({ map: this.signTex, emissive: '#ffffff', emissiveMap: this.signTex, emissiveIntensity: 0.15, transparent: true });
      this.signSide = new THREE.MeshStandardMaterial({ color: ind.signColor, transparent: true });
      const sign = new THREE.Mesh(new THREE.BoxGeometry(Math.min(W, 7), 0.95, 0.12), [this.signSide, this.signSide, this.signSide, this.signSide, this.signMat, this.signSide]);
      sign.position.set(W / 2, WALL_H + 0.6, H + 0.15);
      g.add(sign);
      this.sign = sign;
      // 遮雨棚
      const awn = new THREE.Mesh(new THREE.BoxGeometry(W, 0.05, 0.8), this.signSide);
      this.awning = awn;
      awn.position.set(W / 2, WALL_H - 0.1, H + 0.45);
      awn.rotation.x = 0.18;
      g.add(awn);

      // 隔壁店家
      const pick = (i) => NEIGHBORS[(i + ind.id.length) % NEIGHBORS.length];
      this.buildNeighbor(this.neighbors.left, -OUT_W, 0, OUT_W, H, pick(0));
      this.buildNeighbor(this.neighbors.right, W, 0, OUT_W, H, pick(3));

      // 路邊停的機車
      const colors = ['#c0392b', '#ecf0f1', '#2c3e50', '#2980b9', '#f1c40f', '#7f8c8d'];
      for (let x = -OUT_W + 0.6, i = 0; x < W + OUT_W - 0.5; x += 0.75, i++) {
        if (x > d0 - 0.6 && x < d0 + 2.6) continue;
        if ((i * 7) % 5 === 0) continue;
        const sc = scooterModel(colors[i % colors.length]);
        sc.position.set(x, 0, H + 1.0);
        sc.rotation.y = Math.PI + 0.15;
        sc.scale.setScalar(0.9);
        g.add(sc);
      }
      // 路燈
      this.lamps = [];
      for (const x of [-OUT_W + 0.3, W + OUT_W - 0.3]) {
        C(g, 0.05, 0.06, 3.2, '#4a4a4a', x, 0, H + 1.3, 8);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), basic('#fff6d8'));
        bulb.position.set(x, 3.2, H + 1.3);
        g.add(bulb);
        const light = new THREE.PointLight('#ffd9a0', 0, 7, 1.5);
        light.position.set(x, 3, H + 1.3);
        g.add(light);
        this.lamps.push(light);
      }
      this.updateCamera();
    }

    buildNeighbor(group, x0, z0, w, h, [name, color]) {
      const H = this.sim.H;
      B(group, w, 3.6, h, '#d8cfc3', x0 + w / 2, 0, z0 + h / 2);
      B(group, w - 0.3, 1.8, 0.08, '#9aa1a9', x0 + w / 2, 0, H - 0.02, { metalness: 0.5 });
      for (let i = 0; i < 9; i++) B(group, w - 0.3, 0.02, 0.1, '#7d848c', x0 + w / 2, 0.2 * i, H - 0.01);
      const tex = canvasTex(512, 128, (c, cw, ch) => {
        c.fillStyle = color;
        c.fillRect(0, 0, cw, ch);
        c.fillStyle = '#fff';
        c.font = 'bold 72px "PingFang TC","Noto Sans TC",sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(name, cw / 2, ch / 2 + 4);
      });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.4, 0.6), new THREE.MeshStandardMaterial({ map: tex }));
      sign.position.set(x0 + w / 2, 2.4, H + 0.03);
      group.add(sign);
      for (let i = 0; i < 2; i++) B(group, 0.8, 0.6, 0.05, basic('#a9c9de'), x0 + 0.8 + i * 1.6, 2.9, H + 0.01);
    }

    // 靠近鏡頭的牆降低，才看得到店裡
    applyCutaway() {
      if (!this.walls) return;
      const r = this.camRot;
      // 鏡頭在 +x+z 方向（r=0）時，前牆和右牆靠近鏡頭
      const near = [['front', 'right'], ['right', 'back'], ['back', 'left'], ['left', 'front']][r];
      for (const [k, gr] of Object.entries(this.walls)) {
        const low = near.includes(k);
        gr.scale.y = low ? (k === 'front' ? 0.22 : 0.12) : 1;
      }
      this.neighbors.left.visible = !near.includes('left');
      this.neighbors.right.visible = !near.includes('right');
      // 從正面看的時候，招牌和柱子會擋住店裡：變透明、變矮
      const frontNear = near.includes('front');
      if (this.signMat) {
        this.signMat.opacity = frontNear ? 0.3 : 1;
        this.signSide.opacity = frontNear ? 0.3 : 1;
        this.signMat.depthWrite = !frontNear;
        this.signSide.depthWrite = !frontNear;
      }
      if (this.awning) this.awning.visible = !frontNear;
      if (this.frontProps) this.frontProps.scale.y = frontNear ? 0.15 : 1;
    }

    menuTexture() {
      const s = this.sim;
      if (!this._menuTex) {
        this._menuCanvas = document.createElement('canvas');
        this._menuCanvas.width = 512;
        this._menuCanvas.height = 320;
        this._menuTex = new THREE.CanvasTexture(this._menuCanvas);
        this._menuTex.encoding = THREE.sRGBEncoding;
      }
      const key = JSON.stringify(s.prices) + JSON.stringify(s.menu);
      if (this._menuKey !== key) {
        this._menuKey = key;
        const c = this._menuCanvas.getContext('2d');
        c.fillStyle = '#2b2b2b';
        c.fillRect(0, 0, 512, 320);
        c.fillStyle = '#ffd36b';
        c.font = 'bold 40px "PingFang TC","Noto Sans TC",sans-serif';
        c.fillText('價目表', 24, 52);
        c.font = '30px "PingFang TC","Noto Sans TC",sans-serif';
        s.ind.products.filter((p) => s.menu[p.id]).slice(0, 6).forEach((p, i) => {
          c.fillStyle = '#ffffff';
          c.fillText(p.name, 24 + (i % 2) * 250, 108 + Math.floor(i / 2) * 64);
          c.fillStyle = '#ffd36b';
          c.fillText(`$${s.prices[p.id]}`, 160 + (i % 2) * 250, 108 + Math.floor(i / 2) * 64);
        });
        this._menuTex.needsUpdate = true;
      }
      return this._menuTex;
    }

    // ───── 物件 ─────
    buildObject(o) {
      const g = new THREE.Group();
      const inner = new THREE.Group();
      g.add(inner);
      (MODELS[o.def.model] || MODELS.plant)(inner, this);
      g.userData.pick = { kind: 'object', obj: o };
      Object.assign(g.userData, inner.userData);
      this.placeGroup(g, o);
      return g;
    }

    placeGroup(g, o) {
      const def = o.def;
      if (def.wall) {
        // 掛在後牆或左牆上
        if (o.z === 0) {
          g.position.set(o.x + 0.5, 0, 0.5);
          g.rotation.y = 0;
        } else {
          g.position.set(0.5, 0, o.z + 0.5);
          g.rotation.y = Math.PI / 2;
        }
        return;
      }
      g.position.set(o.x + 0.5, 0, o.z + 0.5);
      g.rotation.y = (o.rot * Math.PI) / 2;
    }

    syncObjects() {
      const seen = new Set();
      for (const o of this.sim.objects) {
        seen.add(o.id);
        let m = this.objMeshes.get(o.id);
        if (!m) {
          m = { group: this.buildObject(o), key: '' };
          this.objMeshes.set(o.id, m);
          this.world.add(m.group);
        }
        const key = `${o.x},${o.z},${o.rot}`;
        if (m.key !== key) {
          m.key = key;
          this.placeGroup(m.group, o);
        }
      }
      for (const [id, m] of this.objMeshes) {
        if (!seen.has(id)) {
          this.world.remove(m.group);
          this.objMeshes.delete(id);
        }
      }
    }

    // ───── 人物 ─────
    syncAgents(dt, now) {
      const s = this.sim;
      const seen = new Set();
      const list = [
        ...s.staff.filter((e) => e.state !== 'off').map((e) => ({ a: e, kind: 'staff' })),
        ...s.customers.map((c) => ({ a: c, kind: 'customer' })),
        ...s.passers.map((p) => ({ a: p, kind: p.kind })),
      ];
      for (const { a, kind } of list) {
        seen.add(a.id);
        let v = this.agents.get(a.id);
        if (!v) {
          const p = People.make(a.look);
          p.group.userData.pick = kind === 'staff' ? { kind: 'staff', staff: a } : kind === 'customer' ? { kind: 'customer', customer: a } : null;
          v = { p, kind, pickable: kind === 'staff' || kind === 'customer' };
          if (kind === 'scooter' || (kind === 'customer' && a.scooter)) {
            const sc = a.rider ? scooterModel('#3a3a3a', true) : scooterModel(['#c0392b', '#ecf0f1', '#2c3e50', '#2980b9', '#f1c40f'][a.id % 5]);
            sc.rotation.y = 0;
            v.scooter = sc;
            v.root = new THREE.Group();
            v.root.add(sc);
            v.root.add(p.group);
            p.group.position.set(0, 0.25, -0.05);
            this.world.add(v.root);
          } else {
            v.root = p.group;
            this.world.add(p.group);
          }
          if (kind === 'passer' || kind === 'customer') {
            v.umbrella = umbrellaModel(['#2c6fbb', '#d9482b', '#2f8f6b', '#f1c40f', '#8e44ad', '#34495e'][a.id % 6]);
            p.group.add(v.umbrella);
          }
          this.agents.set(a.id, v);
        }
        if (v.umbrella) v.umbrella.visible = this.raining && a.z >= this.sim.H - 0.3 && !(v.scooter && v.scooter.visible);
        this.updateAgent(v, a, kind, dt, now);
      }
      for (const [id, v] of this.agents) {
        if (!seen.has(id)) {
          this.world.remove(v.root);
          v.root.traverse((o) => {
            if (o.geometry && !o.geometry.parameters?.cached) o.geometry.dispose?.();
          });
          if (v.p.faceTex) v.p.faceTex.dispose();
          this.agents.delete(id);
        }
      }
    }

    updateAgent(v, a, kind, dt, now) {
      const p = v.p;
      let x = a.x + 0.5;
      let z = a.z + 0.5;
      let y = 0;
      let sitting = false;
      if (kind === 'customer') {
        // 騎機車來的客人：在店外騎車，進店前把車停在門口
        const outside = a.z >= this.sim.H;
        if (v.scooter) {
          v.scooter.visible = outside;
          p.group.position.y = outside ? 0.25 : 0;
        }
        if (a.state === 'eating' || (a.waitSeat && !a.path.length) || (a.lane && a.obj && a.obj.def.seatCust && a.state === 'atLane' && !a.path.length)) sitting = true;
        this.setFaceForCustomer(p, a);
      } else if (kind === 'staff') {
        if (a.state === 'break' && a.task && a.task.obj && !a.path.length) sitting = true;
        const ev = this.sim.activeEvents.find((e) => e.staff === a);
        People.setMood(p, ev ? 'worried' : a.energy < 25 ? 'sad' : a.mood >= 70 ? 'happy' : a.mood >= 40 ? 'neutral' : a.mood >= 22 ? 'worried' : 'sad');
        const serving = a.task && a.task.lane && a.task.lane.customer && a.task.lane.customer.state === 'atLane' && !a.path.length;
        if (ev) {
          p.armR.rotation.x = -2.6 + Math.sin(now / 120) * 0.25;
        } else if (serving) {
          p.armR.rotation.x = -0.9 + Math.sin(now / 90) * 0.35;
          p.armL.rotation.x = -0.9 + Math.cos(now / 90) * 0.35;
        }
        // 面向服務位
        if (serving && a.task.obj) a.dir = Math.atan2(a.task.lane.custSpot.x - a.task.lane.staffSpot.x, a.task.lane.custSpot.z - a.task.lane.staffSpot.z);
      } else if (kind === 'scooter') {
        p.group.position.y = 0.25;
      }
      if (sitting) y = kind === 'customer' && a.state === 'eating' ? 0.0 : 0.05;
      v.root.position.set(x, kind === 'scooter' ? 0 : y, z);
      if (a.dir !== undefined) {
        let diff = a.dir - v.root.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        v.root.rotation.y += diff * Math.min(1, dt * 12);
      }
      const walking = a.moving && !sitting && kind !== 'scooter' && !(kind === 'customer' && v.scooter && v.scooter.visible);
      People.walk(p, walking, dt, kind === 'scooter' ? 0 : 1);
      // 坐下：腳往前
      p.legL.rotation.x = sitting ? -1.4 : p.legL.rotation.x;
      p.legR.rotation.x = sitting ? -1.4 : p.legR.rotation.x;
      if (sitting) p.group.position.y = -0.18;
      else if (!v.scooter || !v.scooter.visible) p.group.position.y = kind === 'scooter' ? 0.25 : walking ? p.group.position.y : 0;
    }

    setFaceForCustomer(p, c) {
      let mood = 'neutral';
      if (c.state === 'leaving') mood = c.stars >= 4 ? 'happy' : c.stars && c.stars < 2.5 ? 'angry' : c.stars ? 'neutral' : 'angry';
      else if ((c.state === 'queue' || c.state === 'atLane' || c.state === 'toLane') && c.waited > c.patience * 0.6) mood = 'angry';
      else if (c.state === 'queue' && c.waited > c.patience * 0.3) mood = 'worried';
      else if (c.state === 'eating') mood = 'happy';
      People.setMood(p, mood);
    }

    // ───── 天氣 ─────
    buildRain() {
      const N = 900;
      const pos = new Float32Array(N * 6);
      this.rainSeeds = [];
      for (let i = 0; i < N; i++) this.rainSeeds.push({ x: Math.random(), y: Math.random(), z: Math.random() });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#cfe3f5', transparent: true, opacity: 0.55 }));
      this.rain.frustumCulled = false;
      this.rain.visible = false;
      this.world.add(this.rain);
    }

    updateRain(dt) {
      const wx = this.sim.weather;
      this.raining = !!wx && (wx.id === 'rain' || wx.id === 'typhoon');
      this.rain.visible = this.raining;
      if (!this.raining) return;
      const s = this.sim;
      const storm = wx.id === 'typhoon';
      const W = s.W + 10;
      const D = s.H + 8;
      const arr = this.rain.geometry.attributes.position.array;
      const speed = storm ? 1.6 : 1.0;
      const slant = storm ? 0.35 : 0.06;
      this.rainSeeds.forEach((r, i) => {
        r.y -= dt * speed;
        if (r.y < 0) {
          r.y += 1;
          r.x = Math.random();
          r.z = Math.random();
        }
        const x = -5 + r.x * W;
        const z = -2 + r.z * D;
        const y = r.y * 7;
        arr.set([x, y, z, x + slant * 0.4, y - 0.35, z], i * 6);
      });
      this.rain.geometry.attributes.position.needsUpdate = true;
    }

    // ───── 日夜 ─────
    updateLight() {
      const s = this.sim;
      const m = ((s.minute % 1440) + 1440) % 1440;
      const h = m / 60;
      // 6 點日出、18 點半日落
      const day = h >= 6 && h <= 18.5 ? Math.sin(((h - 6) / 12.5) * Math.PI) : 0;
      const dusk = h > 16.5 && h < 19.5 ? 1 - Math.abs(h - 18) / 1.5 : h > 5 && h < 7 ? 1 - Math.abs(h - 6) : 0;
      const sky = new THREE.Color('#1c2333').lerp(new THREE.Color('#cfdde8'), day);
      if (dusk > 0) sky.lerp(new THREE.Color('#e9a06b'), dusk * 0.55);
      const wx = s.weather ? s.weather.id : 'sunny';
      const gloom = wx === 'typhoon' ? 0.7 : wx === 'rain' ? 0.5 : wx === 'cloudy' || wx === 'cold' ? 0.25 : 0;
      if (gloom) sky.lerp(new THREE.Color('#6f7a86'), gloom * day);
      this.world.background = sky;
      this.sun.intensity = (0.15 + day * 0.85) * (1 - gloom * 0.6);
      this.sun.color.set('#fff3e0').lerp(new THREE.Color('#ff9d5c'), dusk);
      const az = ((h - 6) / 12.5) * Math.PI;
      this.sun.position.set(s.W / 2 + Math.cos(az) * 14, 6 + day * 14, s.H / 2 - 8);
      this.sun.target.position.set(s.W / 2, 0, s.H / 2);
      this.hemi.intensity = 0.25 + day * 0.5;
      const night = 1 - day;
      const lit = s.isOpen || s.staff.some((e) => e.state === 'working');
      this.indoor.position.set(s.W / 2, 2.4, s.H / 2);
      this.indoor.intensity = lit ? 0.3 + night * 1.3 : night * 0.1;
      this.indoor.distance = Math.max(s.W, s.H) * 1.6;
      for (const l of this.lamps) l.intensity = night > 0.5 ? 1.2 : 0;
      if (this.signMat) this.signMat.emissiveIntensity = lit && night > 0.3 ? 0.9 : 0.12;
    }

    // ───── 建造預覽 ─────
    setGhost(type, rot) {
      if (this.ghost) {
        this.world.remove(this.ghost.group);
        this.ghost = null;
      }
      if (!type) return;
      const def = catalogById[type];
      const g = new THREE.Group();
      const inner = new THREE.Group();
      g.add(inner);
      (MODELS[def.model] || MODELS.plant)(inner, this);
      g.traverse((o) => {
        if (o.isMesh) {
          o.material = o.material.clone();
          o.material.transparent = true;
          o.material.opacity = 0.55;
          o.castShadow = false;
        }
      });
      // 底下的格子框
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(def.w || 1, 1), new THREE.MeshBasicMaterial({ color: '#2ecc71', transparent: true, opacity: 0.35 }));
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(((def.w || 1) - 1) / 2, 0.03, 0);
      g.add(pad);
      this.ghost = { group: g, type, rot, pad, def };
      this.world.add(g);
    }

    updateGhost(tile, rot, ok) {
      if (!this.ghost) return;
      const g = this.ghost.group;
      g.visible = !!tile;
      if (!tile) return;
      this.placeGroup(g, { def: this.ghost.def, x: tile.x, z: tile.z, rot });
      this.ghost.pad.material.color.set(ok ? '#2ecc71' : '#e74c3c');
    }

    // ───── 每一幀 ─────
    render(now) {
      const dt = Math.min(0.05, (now - this.lastNow) / 1000);
      this.lastNow = now;
      if (this.sim.W !== this._lastW) {
        this._lastW = this.sim.W;
        this.buildStatic();
      }
      this.syncObjects();
      this.syncAgents(dt, now);
      this.updateLight();
      this.updateRain(dt);
      this.animateProps(now);
      this.renderer.render(this.world, this.camera);
      this.updateOverlay();
    }

    animateProps(now) {
      const s = this.sim;
      const busyObjs = new Set();
      for (const c of s.customers) if (c.state === 'atLane' && c.obj && c.servedBy) busyObjs.add(c.obj.id);
      for (const [id, m] of this.objMeshes) {
        const u = m.group.userData;
        if (u.wave) u.wave.rotation.x = -0.6 + Math.sin(now / 250) * 0.6;
        if (u.spin) u.spin.rotation.z += 0.3;
        if (u.fish) u.fish.forEach((f, i) => (f.position.x = Math.sin(now / 900 + i * 2) * 0.28));
        if (u.screen) u.screen.material.color.setHSL(((now / 4000) % 1), 0.5, 0.55);
        if (u.liftScooter) {
          const o = m.group.userData.pick.obj;
          u.liftScooter.visible = o.lanes.some((l) => l.customer && l.customer.state === 'atLane');
        }
        if (u.steam && busyObjs.has(id) && Math.random() < 0.15) {
          const p = u.steam[Math.floor(Math.random() * u.steam.length)].clone();
          m.group.localToWorld(p);
          this.spawnSteam(p);
        }
      }
      this.menuTexture();
      for (const st of this.steam) {
        st.life += 0.016;
        st.mesh.position.y += 0.012;
        st.mesh.material.opacity = Math.max(0, 0.45 - st.life * 0.35);
        st.mesh.scale.setScalar(1 + st.life);
      }
      this.steam = this.steam.filter((st) => {
        if (st.life > 1.3) {
          this.world.remove(st.mesh);
          st.mesh.material.dispose();
          return false;
        }
        return true;
      });
    }

    spawnSteam(pos) {
      if (this.steam.length > 40) return;
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, depthWrite: false }));
      m.position.copy(pos);
      this.world.add(m);
      this.steam.push({ mesh: m, life: 0 });
    }

    // ───── HTML 疊加層 ─────
    project(x, y, z) {
      const v = new THREE.Vector3(x, y, z).project(this.camera);
      const r = this.dom.getBoundingClientRect();
      return { x: ((v.x + 1) / 2) * r.width, y: ((1 - v.y) / 2) * r.height, behind: v.z > 1 };
    }

    label(key, cls) {
      let el = this.labels.get(key);
      if (!el) {
        el = document.createElement('div');
        el.className = cls;
        this.overlay.appendChild(el);
        this.labels.set(key, el);
      }
      el.dataset.seen = '1';
      return el;
    }

    place(el, x, y, z, ax = '-50%', ay = '-100%') {
      const p = this.project(x, y, z);
      el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(${ax}, ${ay})`;
    }

    updateOverlay() {
      const s = this.sim;
      for (const el of this.labels.values()) el.dataset.seen = '';
      const zoomShow = this.zoom >= 1.15;

      // 員工：名字、想法泡泡、事件驚嘆號
      for (const e of s.staff) {
        if (e.state === 'off') continue;
        const ev = s.activeEvents.find((x) => x.staff === e);
        if (ev) {
          const el = this.label(`ev-${ev.id}`, 'bubble3d');
          el.style.setProperty('--left', `${Math.max(0, Math.min(1, (ev.deadline - s.minute) / (ev.deadline - ev.spawnedAt))) * 360}deg`);
          if (!el.firstChild) el.innerHTML = '<span>!</span>';
          el.classList.toggle('urgent', ev.deadline - s.minute < (ev.deadline - ev.spawnedAt) * 0.3);
          el.dataset.ev = ev.id;
          this.place(el, e.x + 0.5, 2.15, e.z + 0.5);
        } else if (e.thought && e.thought.until > s.minute) {
          const el = this.label(`th-${e.id}`, 'thought3d');
          if (el.textContent !== e.thought.text) el.textContent = e.thought.text;
          this.place(el, e.x + 0.5, 2.0, e.z + 0.5);
        }
        if (zoomShow || this.selected === e) {
          const n = this.label(`nm-${e.id}`, 'tag-name');
          if (n.textContent !== e.name) n.textContent = e.name;
          this.place(n, e.x + 0.5, 0, e.z + 0.5, '-50%', '20%');
        }
      }
      // 電話與門口的事件
      for (const ev of s.activeEvents) {
        if (ev.where === 'staff') continue;
        const el = this.label(`ev-${ev.id}`, 'bubble3d');
        el.style.setProperty('--left', `${Math.max(0, Math.min(1, (ev.deadline - s.minute) / (ev.deadline - ev.spawnedAt))) * 360}deg`);
        if (!el.firstChild) el.innerHTML = `<span>${ev.where === 'phone' ? '☎' : '🚪'}</span>`;
        el.dataset.ev = ev.id;
        if (ev.where === 'phone') {
          const st = s.stations[0];
          if (st) this.place(el, st.x + 0.5, 1.8, st.z + 0.5);
        } else this.place(el, s.doorX + 1, 2.1, s.H + 0.5);
      }
      // 服務進度
      for (const c of s.customers) {
        if (c.state === 'atLane' && c.servedBy && c.progress > 0) {
          const el = this.label(`pg-${c.id}`, 'progress3d');
          el.style.setProperty('--p', `${Math.min(100, c.progress * 100)}%`);
          if (el.dataset.icon !== c.product.icon) {
            el.dataset.icon = c.product.icon;
            el.innerHTML = `<i>${c.product.icon}${c.qty > 1 ? `×${c.qty}` : ''}</i><b></b>`;
          }
          this.place(el, c.x + 0.5, 1.75, c.z + 0.5);
        }
      }
      // 金額與表情
      s.popups.forEach((p) => {
        const el = this.label(`pp-${p.id}`, `popup3d ${p.kind}`);
        if (el.textContent !== p.text) el.textContent = p.text;
        el.style.opacity = String(Math.max(0, 1 - p.t / 3));
        this.place(el, p.x + 0.5, 1.9 + p.t * 0.35, p.z + 0.5);
      });
      // 選取框
      if (this.selected) {
        const a = this.selected;
        const el = this.label('sel', 'select-ring');
        this.place(el, (a.x ?? 0) + 0.5, 0, (a.z ?? 0) + 0.5, '-50%', '-50%');
      }
      for (const [k, el] of this.labels) {
        if (!el.dataset.seen) {
          el.remove();
          this.labels.delete(k);
        }
      }
    }
  }

  root.BossShop3D = Shop3D;
})(typeof window !== 'undefined' ? window : globalThis);
