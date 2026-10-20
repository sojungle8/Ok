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
    ['阿伯水餃', '#c0392b'], ['全都福眼鏡', '#2c6fbb'], ['永和不加糖豆漿', '#e67e22'], ['美美服飾', '#d6418a'],
    ['大通電器行', '#1f7a5c'], ['金好運彩券', '#d4a017'], ['仁愛藥局', '#2a9d8f'], ['剪不斷髮廊', '#6c5ce7'],
  ];

  // ───── 設備與家具模型（區域座標：+z 是正面，x 0～w-1 是佔的格子）─────
  const MODELS = {
    griddle(g) {
      B(g, 1.9, 0.82, 0.8, '#c9ced6', 0.5, 0, 0, { metalness: 0.6, roughness: 0.35 });
      B(g, 1.6, 0.04, 0.55, '#1d1d1f', 0.5, 0.82, -0.02, { metalness: 0.4, roughness: 0.5 });
      for (let i = 0; i < 4; i++) C(g, 0.08, 0.08, 0.02, '#f2e3a0', 0.0 + i * 0.32, 0.86, 0, 16);
      B(g, 1.9, 0.5, 0.02, basic('#dff3ff', { transparent: true, opacity: 0.35 }), 0.5, 0.86, 0.38);
      C(g, 0.12, 0.12, 0.18, '#ffffff', 1.3, 0.82, 0.25);
      // 醬料罐、鍋鏟、出餐盤
      C(g, 0.035, 0.035, 0.16, '#c0392b', 1.32, 0.82, -0.25, 8);
      C(g, 0.035, 0.035, 0.16, '#3a2c25', 1.4, 0.82, -0.25, 8);
      B(g, 0.05, 0.02, 0.22, '#9aa1a9', 0.25, 0.87, 0.15, { metalness: 0.7 });
      B(g, 0.3, 0.02, 0.3, '#ffffff', -0.3, 0.82, 0.28);
      for (let i = 0; i < 3; i++) B(g, 0.08, 0.005, 0.1, '#fff9d6', 0.6 + i * 0.12, 1.3, 0.38);
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
      // 疊起來的碗、湯杓、麵條
      for (let i = 0; i < 4; i++) C(g, 0.1, 0.07, 0.05, '#f4f1ec', 1.35, 0.88 + i * 0.05, -0.2, 14);
      B(g, 0.02, 0.4, 0.02, '#9aa1a9', 0.35, 1.0, -0.05, { metalness: 0.7 }).rotation.z = 0.5;
      B(g, 0.25, 0.08, 0.2, '#f2dfa0', 1.35, 0.88, 0.15);
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
      // 封口機、雪克杯、果糖機
      B(g, 0.2, 0.3, 0.22, '#d64541', 0.55, 0.95, 0.05);
      C(g, 0.045, 0.04, 0.2, '#c9ced6', 0.2, 0.95, 0.2, 10, { metalness: 0.7 });
      B(g, 0.14, 0.26, 0.14, '#f6f1ea', -0.3, 0.95, 0.15);
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
    // ───── 各行各業自己的裝潢 ─────
    lantern(g) {
      for (const x of [-0.22, 0.22]) {
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), mat('#d9302b', { emissive: '#5a0d08' }));
        l.scale.y = 1.25;
        l.position.set(x, 1.75, -0.32);
        g.add(l);
        C(g, 0.1, 0.1, 0.05, '#e2a12a', x, 1.92, -0.32, 10);
        C(g, 0.1, 0.1, 0.05, '#e2a12a', x, 1.5, -0.32, 10);
        B(g, 0.015, 0.25, 0.015, '#d4a017', x, 1.25, -0.32);
      }
      B(g, 0.7, 0.03, 0.03, '#3a2c25', 0, 2.05, -0.4);
    },
    photowall(g) {
      const tex = canvasTex(256, 200, (c, w, h) => {
        const gr = c.createLinearGradient(0, 0, w, h);
        gr.addColorStop(0, '#f7c6d9');
        gr.addColorStop(1, '#c9e4f7');
        c.fillStyle = gr;
        c.fillRect(0, 0, w, h);
        c.fillStyle = '#ffffff';
        for (let i = 0; i < 18; i++) c.fillRect((i * 53) % w, (i * 37) % h, 6, 6);
        c.fillStyle = '#d9482b';
        c.font = 'bold 40px sans-serif';
        c.textAlign = 'center';
        c.fillText('打卡送', w / 2, 90);
        c.fillText('小料 ♡', w / 2, 140);
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.72), new THREE.MeshStandardMaterial({ map: tex }));
      m.position.set(0, 1.45, -0.46);
      g.add(m);
      B(g, 0.96, 0.78, 0.03, '#ffffff', 0, 1.06, -0.49);
    },
    barberpole(g) {
      B(g, 0.22, 0.08, 0.22, '#c0c0c0', 0, 0, 0);
      C(g, 0.03, 0.03, 0.55, '#c0c0c0', 0, 0.08, 0, 8);
      const tex = canvasTex(64, 128, (c, w, h) => {
        c.fillStyle = '#ffffff';
        c.fillRect(0, 0, w, h);
        c.lineWidth = 14;
        for (let i = -4; i < 8; i++) {
          c.strokeStyle = i % 2 ? '#d9302b' : '#2c6fbb';
          c.beginPath();
          c.moveTo(0, i * 24);
          c.lineTo(w, i * 24 + 40);
          c.stroke();
        }
      });
      tex.wrapS = THREE.RepeatWrapping;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.6, 16), new THREE.MeshStandardMaterial({ map: tex, emissive: '#222', roughness: 0.3 }));
      pole.position.set(0, 0.95, 0);
      g.add(pole);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), mat('#c0c0c0', { metalness: 0.6 }));
      cap.position.set(0, 1.28, 0);
      g.add(cap);
      g.userData.pole = pole;
    },
    magazine(g) {
      B(g, 0.6, 0.9, 0.3, '#8a5a3b', 0, 0, -0.1);
      const colors = ['#d9482b', '#2c6fbb', '#f2c14e', '#5aa9a0', '#e0478a', '#6c5ce7'];
      for (let r = 0; r < 3; r++) {
        for (let i = 0; i < 2; i++) {
          const m = B(g, 0.22, 0.26, 0.02, colors[(r * 2 + i) % colors.length], -0.13 + i * 0.26, 0.1 + r * 0.28, 0.06);
          m.rotation.x = -0.25;
        }
      }
    },
    tirewall(g) {
      B(g, 0.9, 1.3, 0.04, '#5b5f66', 0, 0.75, -0.47);
      for (const [x, y] of [[-0.22, 1.05], [0.22, 1.05], [0, 1.6]]) {
        const t = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.07, 10, 20), mat('#1d1d1d', { roughness: 0.95 }));
        t.position.set(x, y, -0.38);
        g.add(t);
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 14), mat('#c0c0c0', { metalness: 0.6 }));
        rim.rotation.x = Math.PI / 2;
        rim.position.set(x, y, -0.38);
        g.add(rim);
      }
    },
    helmetrack(g) {
      B(g, 0.06, 1.5, 0.06, '#555', 0, 0, 0);
      B(g, 0.4, 0.05, 0.4, '#555', 0, 0, 0);
      const colors = ['#d9482b', '#f2c14e', '#2c6fbb', '#ffffff'];
      colors.forEach((col, i) => {
        const h = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), mat(col, { roughness: 0.35 }));
        const a = (i * Math.PI) / 2;
        h.position.set(Math.cos(a) * 0.18, 0.55 + (i % 2) * 0.45, Math.sin(a) * 0.18);
        g.add(h);
        B(g, 0.16, 0.02, 0.02, '#555', Math.cos(a) * 0.09, 0.5 + (i % 2) * 0.45, Math.sin(a) * 0.09).rotation.y = -a;
      });
    },
    umbrella(g) {
      C(g, 0.18, 0.16, 0.55, '#2c6fbb', 0, 0, 0, 14);
      const colors = ['#d9482b', '#f2c14e', '#5aa9a0'];
      colors.forEach((col, i) => {
        const u = C(g, 0.035, 0.035, 0.75, col, -0.07 + i * 0.07, 0.2, 0.0, 8);
        u.rotation.z = (i - 1) * 0.12;
        C(g, 0.012, 0.012, 0.12, '#3a2c25', -0.07 + i * 0.07, 0.95, 0, 6);
      });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.14), new THREE.MeshBasicMaterial({ map: canvasTex(128, 52, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#2c6fbb'; c.font = 'bold 30px sans-serif'; c.textAlign = 'center'; c.fillText('愛心傘', w / 2, 37); }) }));
      sign.position.set(0, 0.35, 0.19);
      g.add(sign);
    },
    // ───── 兼營業務的小設備：同一個櫃台造型，上面放不同的道具、掛自己的招牌 ─────
    kiosk(g, view, def) {
      const k = (def && def.kiosk) || { color: '#7f8c8d', prop: 'boxes' };
      const self = def && def.selfServe;
      const seat = def && def.seatCust;
      const col = k.color;
      if (seat) {
        // 坐著服務的（掏耳朵、按摩、寵物）：一張躺椅＋旁邊的小推車
        B(g, 0.62, 0.42, 0.62, '#3a3a40', 0, 0, 0);
        B(g, 0.66, 0.1, 0.66, col, 0, 0.42, 0, { roughness: 0.5 });
        const back = B(g, 0.66, 0.6, 0.1, col, 0, 0.5, -0.3, { roughness: 0.5 });
        back.rotation.x = -0.25;
        B(g, 0.18, 0.5, 0.18, '#d8d8d8', 0.42, 0, 0.25);
      } else if (self) {
        // 自助機台：直立的機器＋螢幕
        B(g, 0.62, 1.45, 0.5, col, 0, 0, -0.12, { roughness: 0.45, metalness: 0.15 });
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.32), basic('#bfe6ff'));
        scr.position.set(0, 1.08, 0.135);
        scr.rotation.x = -0.15;
        g.add(scr);
        g.userData.screen = scr;
        B(g, 0.3, 0.04, 0.1, '#1d1d1d', 0, 0.75, 0.15);
      } else {
        // 一般小櫃台
        B(g, 0.9, 0.85, 0.6, col, 0, 0, -0.05, { roughness: 0.55 });
        B(g, 0.96, 0.05, 0.66, '#f3efe8', 0, 0.85, -0.05);
      }
      const top = seat ? 0.95 : self ? 1.45 : 0.9;
      const p = k.prop;
      const box = (w, h, d, c, x, y, z) => B(g, w, h, d, c, x, y, z);
      if (!self && !seat) {
        if (p === 'boxes') {
          box(0.28, 0.2, 0.22, '#c99a5b', -0.22, top, -0.05);
          box(0.22, 0.16, 0.18, '#d8b07a', 0.12, top, 0.02);
          box(0.18, 0.14, 0.16, '#b98a4f', -0.18, top + 0.2, -0.05);
        } else if (p === 'grill' || p === 'pot' || p === 'fryer') {
          box(0.7, 0.12, 0.45, '#9aa1a9', 0, top, -0.05);
          for (let i = 0; i < 4; i++) C(g, 0.035, 0.035, 0.5, p === 'grill' ? '#c0392b' : '#d4a017', -0.25 + i * 0.17, top + 0.14, -0.05, 8).rotation.x = Math.PI / 2;
          g.userData.steam = [new THREE.Vector3(0, top + 0.3, 0)];
        } else if (p === 'machine') {
          box(0.6, 0.35, 0.45, '#ececec', 0, top, -0.08);
          box(0.4, 0.04, 0.25, '#ffffff', 0, top + 0.35, -0.05);
        } else if (p === 'coffee') {
          C(g, 0.09, 0.07, 0.22, '#e8e2d8', -0.15, top, 0, 12);
          C(g, 0.05, 0.05, 0.3, '#3a2c25', 0.15, top, -0.1, 10);
          C(g, 0.08, 0.08, 0.04, '#6b4a32', 0.15, top + 0.3, -0.1, 12);
        } else if (p === 'freezer') {
          box(0.8, 0.12, 0.5, basic('#cfe8ff', { transparent: true, opacity: 0.6 }), 0, top, -0.05);
        } else if (p === 'fruit' || p === 'toys' || p === 'bottles' || p === 'helmets' || p === 'tickets') {
          const cs = { fruit: ['#e74c3c', '#f1c40f', '#2ecc71'], toys: ['#f4a3c0', '#ffe066', '#9ad1f5'], bottles: ['#5aa9a0', '#f3efe8', '#2c6fbb'], helmets: ['#d9482b', '#f2c14e', '#2c6fbb'], tickets: ['#f2c14e', '#e74c3c', '#ffffff'] }[p];
          cs.forEach((c, i) => {
            const m = new THREE.Mesh(p === 'helmets' || p === 'fruit' ? new THREE.SphereGeometry(0.1, 10, 8) : boxGeo(0.12, 0.2, 0.08), mat(c, { roughness: 0.5 }));
            m.position.set(-0.25 + i * 0.25, top + 0.1, -0.05);
            m.castShadow = true;
            g.add(m);
          });
        } else if (p === 'desk' || p === 'keys') {
          box(0.32, 0.02, 0.24, '#ffffff', -0.15, top, 0);
          box(0.28, 0.2, 0.02, '#2b2b30', 0.2, top, -0.15);
        } else if (p === 'washer') {
          box(0.5, 0.5, 0.4, '#f3f3f3', 0, top, -0.08);
          const door = new THREE.Mesh(new THREE.CircleGeometry(0.13, 18), basic('#9fc7e6'));
          door.position.set(0, top + 0.25, 0.125);
          g.add(door);
        } else if (p === 'scooter') {
          box(0.18, 0.2, 0.55, '#d9482b', 0, top, -0.05);
          C(g, 0.1, 0.1, 0.06, '#1d1d1d', 0, top, 0.25, 10).rotation.z = Math.PI / 2;
        }
      } else if (self && p === 'washer') {
        const door = new THREE.Mesh(new THREE.CircleGeometry(0.16, 20), basic('#9fc7e6'));
        door.position.set(0, 0.55, 0.135);
        g.add(door);
      }
      // 招牌：圖示＋名稱
      if (def) {
        const tex = canvasTex(256, 96, (c, w, h) => {
          c.fillStyle = col;
          c.fillRect(0, 0, w, h);
          c.fillStyle = 'rgba(255,255,255,.92)';
          c.fillRect(6, 6, w - 12, h - 12);
          c.fillStyle = '#2a2420';
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.font = 'bold 40px sans-serif';
          const name = def.name.length > 5 ? def.name.slice(0, 5) : def.name;
          c.fillText(`${def.icon}${name}`, w / 2, h / 2 + 2);
        });
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.27), new THREE.MeshBasicMaterial({ map: tex }));
        sign.position.set(0, (self ? 1.62 : seat ? 1.3 : 1.55), self ? 0.14 : -0.3);
        g.add(sign);
        if (!self) B(g, 0.03, (seat ? 1.3 : 1.55) - top, 0.03, '#555', 0, top, -0.32);
      }
    },

    // ───── 高等級裝潢（Lv.11 以後） ─────
    mural(g, view) {
      const sign = view && view.sim ? view.sim.ind.signColor : '#d9482b';
      const tex = canvasTex(320, 240, (c, w, h) => {
        const gr = c.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, '#ffd59e');
        gr.addColorStop(0.55, '#ff9f8a');
        gr.addColorStop(1, '#6c8cd5');
        c.fillStyle = gr;
        c.fillRect(0, 0, w, h);
        // 遠山、街屋剪影、太陽
        c.fillStyle = 'rgba(255,255,255,.85)';
        c.beginPath();
        c.arc(w * 0.72, h * 0.32, 34, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#5b6fb0';
        c.beginPath();
        c.moveTo(0, h * 0.7);
        for (let x = 0; x <= w; x += 20) c.lineTo(x, h * 0.62 - Math.sin(x / 37) * 18);
        c.lineTo(w, h);
        c.lineTo(0, h);
        c.fill();
        const cols = ['#f2c14e', sign, '#5aa9a0', '#e0478a', '#ffffff'];
        for (let i = 0; i < 9; i++) {
          const bw = 30 + ((i * 17) % 18);
          const bh = 50 + ((i * 29) % 50);
          c.fillStyle = cols[i % cols.length];
          c.fillRect(i * 36, h - bh, bw, bh);
          c.fillStyle = 'rgba(40,30,30,.35)';
          for (let y = h - bh + 10; y < h - 12; y += 16) c.fillRect(i * 36 + 6, y, bw - 12, 6);
        }
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 1.2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
      m.position.set(0, 1.5, -0.47);
      g.add(m);
    },
    ledsign(g) {
      const tex = canvasTex(512, 64, (c, w, h) => {
        c.fillStyle = '#0b0b10';
        c.fillRect(0, 0, w, h);
        c.fillStyle = '#ff4d3a';
        c.font = 'bold 40px sans-serif';
        c.textBaseline = 'middle';
        c.fillText('★ 歡迎光臨 ★ 本店員工都有勞健保 ★ 今日推薦 ★', 8, h / 2 + 2);
        // LED 點陣感
        c.fillStyle = 'rgba(0,0,0,.45)';
        for (let x = 0; x < w; x += 4) c.fillRect(x, 0, 1, h);
        for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1);
      });
      tex.wrapS = THREE.RepeatWrapping;
      tex.repeat.x = 0.45;
      B(g, 0.98, 0.26, 0.08, '#2b2b30', 0, 1.9, -0.44);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.2), new THREE.MeshBasicMaterial({ map: tex }));
      m.position.set(0, 2.03, -0.395);
      g.add(m);
      g.userData.led = tex;
    },
    chandelier(g) {
      C(g, 0.012, 0.012, 0.6, '#3a3a3a', 0, 1.82, 0, 6);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.025, 8, 28), mat('#d4a017', { metalness: 0.85, roughness: 0.25 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 1.85, 0);
      g.add(ring);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), basic('#fff3c4'));
        bulb.position.set(Math.cos(a) * 0.32, 1.78, Math.sin(a) * 0.32);
        g.add(bulb);
        C(g, 0.006, 0.006, 0.08, '#d4a017', Math.cos(a) * 0.32, 1.8, Math.sin(a) * 0.32, 4);
      }
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), mat('#f7e7b4', { emissive: '#8a6d1c', metalness: 0.4, roughness: 0.3 }));
      core.position.set(0, 1.72, 0);
      g.add(core);
      // 光暈：用半透明的球代替真的燈（不會讓所有材質重新編譯）
      const halo = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffe3a0', transparent: true, opacity: 0.12, depthWrite: false }));
      halo.position.set(0, 1.76, 0);
      g.add(halo);
    },
    greenwall(g) {
      B(g, 0.98, 1.6, 0.06, '#4a3a2c', 0, 0.55, -0.46);
      const greens = ['#2f7d4a', '#3f9a58', '#5cb56a', '#277048', '#79c46b'];
      for (let i = 0; i < 46; i++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.07 + ((i * 7) % 5) * 0.012, 8, 6), mat(greens[i % greens.length], { roughness: 0.85 }));
        leaf.scale.z = 0.55;
        leaf.position.set(-0.42 + ((i * 37) % 85) / 100, 0.65 + ((i * 53) % 140) / 100, -0.41 + ((i * 13) % 5) / 100);
        g.add(leaf);
      }
      for (const [x, y, col] of [[-0.25, 1.4, '#f4a3c0'], [0.2, 0.95, '#ffe066'], [0.3, 1.75, '#ffffff'], [-0.1, 0.8, '#f4a3c0']]) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat(col));
        f.position.set(x, y, -0.36);
        g.add(f);
      }
    },
    artpiece(g) {
      B(g, 0.5, 0.55, 0.5, '#f3efe8', 0, 0, 0);
      const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.17, 0.05, 80, 10, 2, 3), mat('#e05a47', { metalness: 0.5, roughness: 0.25 }));
      knot.position.set(0, 0.95, 0);
      g.add(knot);
      g.userData.art = knot;
    },
    robot(g) {
      C(g, 0.2, 0.24, 0.12, '#e9edf2', 0, 0, 0, 20);
      const body = C(g, 0.17, 0.2, 0.6, '#f7f9fb', 0, 0.12, 0, 20, { roughness: 0.3 });
      body.scale.z = 0.85;
      const head = new THREE.Group();
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 14), mat('#f7f9fb', { roughness: 0.3 }));
      head.add(skull);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.13), new THREE.MeshBasicMaterial({ map: canvasTex(128, 76, (c, w, h) => { c.fillStyle = '#16213a'; c.fillRect(0, 0, w, h); c.fillStyle = '#5ef0ff'; c.beginPath(); c.arc(38, 34, 10, 0, Math.PI * 2); c.arc(90, 34, 10, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#5ef0ff'; c.lineWidth = 5; c.beginPath(); c.arc(64, 46, 16, 0.2, Math.PI - 0.2); c.stroke(); }) }));
      face.position.set(0, 0.01, 0.165);
      head.add(face);
      head.position.set(0, 0.95, 0);
      g.add(head);
      const tray = C(g, 0.16, 0.16, 0.02, '#c9d2dc', 0, 0.55, 0.16, 18);
      tray.scale.z = 0.6;
      g.userData.robotHead = head;
    },
    statue(g, view) {
      const bronze = mat('#8c6a3f', { metalness: 0.75, roughness: 0.35 });
      B(g, 0.56, 0.5, 0.56, '#bdb6ab', 0, 0, 0);
      B(g, 0.62, 0.06, 0.62, '#a8a092', 0, 0.5, 0);
      const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.16), new THREE.MeshStandardMaterial({ map: canvasTex(200, 80, (c, w, h) => { c.fillStyle = '#c9a24a'; c.fillRect(0, 0, w, h); c.fillStyle = '#3a2a10'; c.font = 'bold 30px sans-serif'; c.textAlign = 'center'; c.fillText('創辦人', w / 2, 36); c.font = '18px sans-serif'; c.fillText('不當慣老闆', w / 2, 64); }), metalness: 0.5, roughness: 0.4 }));
      plaque.position.set(0, 0.26, 0.285);
      g.add(plaque);
      C(g, 0.15, 0.17, 0.5, bronze, 0, 0.56, 0, 14);
      const chest = C(g, 0.14, 0.15, 0.32, bronze, 0, 1.0, 0, 14);
      chest.scale.z = 0.8;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), bronze);
      head.position.set(0, 1.45, 0);
      g.add(head);
      // 舉手揮手
      const arm = C(g, 0.035, 0.035, 0.36, bronze, 0.17, 1.15, 0, 8);
      arm.rotation.z = -0.5;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), bronze);
      hand.position.set(0.27, 1.5, 0);
      g.add(hand);
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
    claw(g) {
      B(g, 0.8, 0.9, 0.8, '#e0478a', 0, 0, 0);
      B(g, 0.76, 0.85, 0.76, basic('#ffe6f2', { transparent: true, opacity: 0.35 }), 0, 0.9, 0);
      B(g, 0.82, 0.12, 0.82, '#e0478a', 0, 1.75, 0);
      for (let i = 0; i < 5; i++) {
        const t = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), mat(['#f2c14e', '#7fb2e5', '#a0e0a0', '#f5a3c7', '#d9a36b'][i]));
        t.position.set(-0.2 + (i % 3) * 0.2, 1.0 + Math.floor(i / 3) * 0.12, -0.1 + (i % 2) * 0.2);
        g.add(t);
      }
      B(g, 0.04, 0.3, 0.04, '#c0c0c0', 0, 1.42, 0);
    },
    neon(g) {
      const tex = canvasTex(256, 128, (c, w, h) => {
        c.fillStyle = '#1a1020';
        c.fillRect(0, 0, w, h);
        c.strokeStyle = '#ff4fa3';
        c.lineWidth = 6;
        c.strokeRect(8, 8, w - 16, h - 16);
        c.fillStyle = '#7ff3ff';
        c.font = 'bold 54px "PingFang TC","Noto Sans TC",sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText('好吃！', w / 2, h / 2 + 4);
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshBasicMaterial({ map: tex }));
      m.position.set(0, 1.85, -0.46);
      g.add(m);
    },
    fame(g) {
      B(g, 0.95, 0.9, 0.04, '#f6f1ea', 0, 1.25, -0.47);
      for (let i = 0; i < 6; i++) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.26), basic(['#f2c14e', '#7fb2e5', '#e8a0b0', '#a0d8a0', '#d9b48c', '#c9b8e8'][i]));
        p.position.set(-0.3 + (i % 3) * 0.3, 1.55 - Math.floor(i / 3) * 0.34, -0.44);
        p.rotation.z = (i % 2 ? 1 : -1) * 0.06;
        g.add(p);
      }
    },
    cleancart(g) {
      B(g, 0.5, 0.08, 0.4, '#f2c14e', 0, 0.08, 0);
      for (const [x, z] of [[-0.2, -0.15], [0.2, -0.15], [-0.2, 0.15], [0.2, 0.15]]) C(g, 0.04, 0.04, 0.06, '#333', x, 0, z, 8);
      C(g, 0.15, 0.13, 0.3, '#3b7dd8', -0.08, 0.16, 0, 14);
      B(g, 0.03, 0.9, 0.03, '#9aa1a9', 0.2, 0.16, -0.15);
      B(g, 0.03, 0.9, 0.03, '#c9a36b', 0.08, 0.16, -0.17);
      B(g, 0.22, 0.06, 0.1, '#5aa9e6', 0.08, 0.16, -0.12);
      C(g, 0.05, 0.05, 0.2, '#2fbf71', 0.18, 0.16, 0.1, 10);
    },
    selfcheckout(g) {
      B(g, 0.6, 0.85, 0.5, '#e8edf2', 0, 0, -0.1);
      B(g, 0.45, 0.32, 0.05, '#1a1a1a', 0, 1.0, -0.1).rotation.x = -0.25;
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.26), basic('#5fd3a0'));
      s.position.set(0, 1.17, -0.06);
      s.rotation.x = -0.25;
      g.add(s);
      B(g, 0.3, 0.05, 0.25, '#2f9e64', 0, 0.85, 0.1);
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

  const footMat = new THREE.MeshBasicMaterial({ color: '#3a2a1e', transparent: true, opacity: 0.16, depthWrite: false });
  const footLine = new THREE.LineBasicMaterial({ color: '#3a2a1e', transparent: true, opacity: 0.45 });

  function stool(g, x, z) {
    C(g, 0.16, 0.19, 0.42, '#d6342b', x, 0, z, 14);
    C(g, 0.17, 0.17, 0.03, '#e8463d', x, 0.42, z, 14);
  }

  function scooterModel(color, box = false, boxColor = '#e0478a') {
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
    if (box) B(g, 0.42, 0.38, 0.38, mat(boxColor), 0, 0.5, -0.3);
    People.mergeGroup(g);
    return g;
  }

  // 地上的髒污
  const dirtGeo = new THREE.CircleGeometry(0.5, 10);
  const DIRT_COLORS = { food: '#6b4a22', spill: '#9a6a2a', mud: '#4a3a2a', hair: '#1f1a17', oil: '#101010' };
  const dirtMats = {};
  const dirtMat = (kind) => (dirtMats[kind] ||= new THREE.MeshBasicMaterial({ color: DIRT_COLORS[kind] || '#8a6a3e', transparent: true, opacity: kind === 'oil' ? 0.7 : 0.6, depthWrite: false }));

  const hitGeoBig = new THREE.CylinderGeometry(0.42, 0.42, 1.6, 8);
  const hitGeo = new THREE.CylinderGeometry(0.3, 0.3, 1.5, 8);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });

  const staffRingGeo = new THREE.RingGeometry(0.24, 0.31, 24);
  const staffRingMat = new THREE.MeshBasicMaterial({ color: '#2fbf71', transparent: true, opacity: 0.85, depthWrite: false });

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
      const r = new THREE.WebGLRenderer({ antialias: !opts.lowEnd, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      r.shadowMap.enabled = true;
      // 陰影不用每一幀重畫：家具變動或太陽移動時才更新
      r.shadowMap.autoUpdate = false;
      r.shadowMap.needsUpdate = true;
      r.shadowMap.type = THREE.PCFSoftShadowMap;
      r.outputEncoding = THREE.sRGBEncoding;
      this.renderer = r;
      this.dom = r.domElement;
      this.dom.className = 'shop-3d';
      container.appendChild(this.dom);
      // 時段調色：清晨偏粉、黃昏偏橘、晚上偏藍，四周微微暗角
      this.grade = document.createElement('div');
      this.grade.className = 'shop-grade';
      container.appendChild(this.grade);
      this.overlay = document.createElement('div');
      this.overlay.className = 'shop-overlay';
      container.appendChild(this.overlay);

      this.world = new THREE.Scene();
      this.camera = new THREE.OrthographicCamera(-10, 10, 6, -6, 0.1, 300);
      // 自由鏡頭：水平角度（任意）、俯仰（高度比例）、縮放；按鈕和快捷鍵會平滑轉過去
      this.camAz = Math.PI / 4;
      this.camAzT = this.camAz;
      this.pitch = 0.82;
      this.pitchT = this.pitch;
      this.zoom = 1;
      this.zoomT = 1;
      this.panT = null;
      this.pan = new THREE.Vector3();

      this.hemi = new THREE.HemisphereLight('#ffffff', '#8a7d70', 0.7);
      this.sun = new THREE.DirectionalLight('#fff3e0', 0.9);
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(1536, 1536);
      this.sun.shadow.bias = -0.0006;
      this.indoor = new THREE.PointLight('#ffd9a8', 0, 18, 1.6);
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
      this.dirtMeshes = new Map();
      this.shutterK = this.sim.isOpen ? 0 : 1;
      this.perf = { t: 0, frames: 0, slow: 0 };
      this.fps = 60;
      this.buildStatic();
      this.buildRain();
      this.setQuality(opts.quality || 'high');

      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(container);
      this.resize();
      this.bindControls();
      this.lastNow = performance.now();
    }

    // 畫質：high 全開；medium 降解析度、陰影變小；low 關陰影、雨變少、沒有蒸氣
    setQuality(q) {
      this.quality = q;
      const dpr = window.devicePixelRatio || 1;
      this.renderer.setPixelRatio({ high: Math.min(dpr, 1.5), medium: Math.min(dpr, 1), low: Math.min(dpr, 0.75) }[q]);
      this.sun.castShadow = q !== 'low';
      const size = q === 'high' ? 1536 : 1024;
      if (this.sun.shadow.mapSize.x !== size) {
        this.sun.shadow.mapSize.set(size, size);
        if (this.sun.shadow.map) {
          this.sun.shadow.map.dispose();
          this.sun.shadow.map = null;
        }
      }
      if (this.rain) this.rain.geometry.setDrawRange(0, (q === 'low' ? 300 : q === 'medium' ? 600 : 900) * 2);
      this.renderer.shadowMap.needsUpdate = true;
      this.resize();
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

    // 最接近的 90 度方向（0～3）：決定哪兩面牆要降低
    get camRot() {
      const q = Math.round((this.camAz - Math.PI / 4) / (Math.PI / 2));
      return ((q % 4) + 4) % 4;
    }

    updateCamera() {
      const s = this.sim;
      const cx = s.W / 2;
      const cz = (s.H + 1.2) / 2 + 0.4;
      const az = this.camAz;
      const d = 30;
      const center = new THREE.Vector3(cx, 0, cz).add(this.pan);
      this.camera.position.set(center.x + Math.sin(az) * d, d * this.pitch, center.z + Math.cos(az) * d);
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

    // 按鈕、Q／E：每次轉 45 度（平滑轉過去）
    rotate(dir) {
      this.camAzT = Math.round((this.camAzT - Math.PI / 4) / (Math.PI / 4)) * (Math.PI / 4) + Math.PI / 4 + (dir * Math.PI) / 4;
    }

    setZoom(z, smooth) {
      const v = Math.max(0.7, Math.min(3.2, z));
      this.zoomT = v;
      if (!smooth) {
        this.zoom = v;
        this.updateCamera();
      }
    }

    setPitch(p) {
      this.pitchT = this.pitch = Math.max(0.42, Math.min(1.7, p));
      this.updateCamera();
    }

    resetView() {
      this.camAzT = Math.round((this.camAz - Math.PI / 4) / (Math.PI * 2)) * Math.PI * 2 + Math.PI / 4;
      this.pitchT = 0.82;
      this.zoomT = 1;
      this.panT = new THREE.Vector3();
    }

    // 雙擊地板：拉近到那個位置；再雙擊一次拉回來
    focusAt(x, z) {
      if (this.zoomT >= 1.6) return this.resetView();
      const s = this.sim;
      this.panT = new THREE.Vector3(x - s.W / 2, 0, z - ((s.H + 1.2) / 2 + 0.4));
      this.zoomT = 2.1;
    }

    clampPan(p) {
      const s = this.sim;
      p.x = Math.max(-s.W - 4, Math.min(s.W + 4, p.x));
      p.z = Math.max(-s.H, Math.min(s.H + 3, p.z));
      return p;
    }

    // 每一幀：鏡頭平滑地靠近目標角度、高度、縮放和位置
    easeCamera(dt) {
      const k = Math.min(1, dt * 9);
      let moved = false;
      const ease = (cur, tgt, eps) => {
        if (Math.abs(tgt - cur) <= eps) return tgt;
        moved = true;
        return cur + (tgt - cur) * k;
      };
      this.camAz = ease(this.camAz, this.camAzT, 0.0005);
      this.pitch = ease(this.pitch, this.pitchT, 0.0005);
      this.zoom = ease(this.zoom, this.zoomT, 0.001);
      if (this.panT) {
        const nx = ease(this.pan.x, this.panT.x, 0.002);
        const nz = ease(this.pan.z, this.panT.z, 0.002);
        this.pan.x = nx;
        this.pan.z = nz;
        if (nx === this.panT.x && nz === this.panT.z) this.panT = null;
      }
      if (moved) this.updateCamera();
    }

    bindControls() {
      const el = this.dom;
      let drag = null;
      const pts = new Map();
      this._down = (e) => {
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        // 右鍵、或按著 Shift／Alt 拖曳：旋轉和調整俯仰
        const orbit = e.pointerType === 'mouse' && (e.button === 2 || e.shiftKey || e.altKey);
        drag = { x: e.clientX, y: e.clientY, moved: 0, pan: this.pan.clone(), id: e.pointerId, orbit, az0: this.camAz, p0: this.pitch };
        this.panT = null;
        if (pts.size === 2) {
          const [a, b] = [...pts.values()];
          drag.pinch = Math.hypot(a.x - b.x, a.y - b.y);
          drag.zoom0 = this.zoom;
          drag.ang0 = Math.atan2(b.y - a.y, b.x - a.x);
          drag.midY0 = (a.y + b.y) / 2;
        }
        el.setPointerCapture(e.pointerId);
      };
      this._ctx = (e) => e.preventDefault();
      el.addEventListener('contextmenu', this._ctx);
      this._move = (e) => {
        if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (this.opts.onHover && !drag) this.opts.onHover(this.pickTile(e.clientX, e.clientY));
        if (!drag) {
          // 滑鼠指到可以點的東西時顯示框框（節流，免得太吃效能）
          const now = performance.now();
          if (e.pointerType === 'mouse' && now - (this._hoverT || 0) > 80) {
            this._hoverT = now;
            const h = this.opts.dragLocked?.() ? null : this.pick(e.clientX, e.clientY);
            this.hoverPick = h && h.kind !== 'tile' ? h : null;
            this.dom.style.cursor = this.hoverPick ? 'pointer' : 'default';
          }
          return;
        }
        if (pts.size === 2 && drag.pinch) {
          // 兩指：捏合縮放、轉動旋轉、一起上下滑調整俯仰
          const [a, b] = [...pts.values()];
          const z = (drag.zoom0 * Math.hypot(a.x - b.x, a.y - b.y)) / drag.pinch;
          this.zoom = this.zoomT = Math.max(0.7, Math.min(3.2, z));
          let da = Math.atan2(b.y - a.y, b.x - a.x) - drag.ang0;
          if (da > Math.PI) da -= Math.PI * 2;
          if (da < -Math.PI) da += Math.PI * 2;
          this.camAz = this.camAzT = drag.az0 - da;
          const dyMid = (a.y + b.y) / 2 - drag.midY0;
          this.pitch = this.pitchT = Math.max(0.42, Math.min(1.7, drag.p0 + dyMid * 0.004));
          drag.moved = 99;
          this.updateCamera();
          return;
        }
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
        if (this.opts.onHover) this.opts.onHover(this.pickTile(e.clientX, e.clientY));
        if (drag.orbit && drag.moved > 3) {
          this.camAz = this.camAzT = drag.az0 - dx * 0.008;
          this.pitch = this.pitchT = Math.max(0.42, Math.min(1.7, drag.p0 + dy * 0.004));
          this.updateCamera();
          return;
        }
        if (drag.moved > 8 && !this.opts.dragLocked?.()) {
          // 拖曳平移：把螢幕位移換成地面上的位移
          const r = this.dom.getBoundingClientRect();
          const wpp = (this.camera.right - this.camera.left) / r.width;
          const az = this.camAz;
          const right = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az));
          const fwd = new THREE.Vector3(-Math.sin(az), 0, -Math.cos(az));
          this.pan.copy(drag.pan).addScaledVector(right, -dx * wpp).addScaledVector(fwd, (dy * wpp) / Math.max(0.4, Math.min(1, this.pitch * 0.75)));
          this.clampPan(this.pan);
          this.updateCamera();
        }
      };
      this._up = (e) => {
        pts.delete(e.pointerId);
        if (drag && drag.id === e.pointerId && drag.moved <= 8 && !drag.orbit && !this.opts.dragLocked?.()) {
          // 雙擊（雙點）地板：拉近；再雙擊拉回
          const now = performance.now();
          const last = this._lastTap;
          this._lastTap = { t: now, x: e.clientX, y: e.clientY };
          if (last && now - last.t < 320 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 24) {
            const hit = this.pick(e.clientX, e.clientY);
            if (hit && hit.kind === 'tile') {
              const p = new THREE.Vector3();
              if (this.ray(e.clientX, e.clientY).ray.intersectPlane(this.floorPlane, p)) this.focusAt(p.x, p.z);
              this._lastTap = null;
              if (!pts.size) drag = null;
              return;
            }
          }
        }
        if (drag && drag.id === e.pointerId && drag.moved <= 8 && !drag.orbit && this.opts.onClick) {
          // 建造模式：直接用手指下面的地板格，不要被前面的家具擋到
          if (this.opts.dragLocked?.()) {
            const t = this.pickTile(e.clientX, e.clientY);
            this.opts.onClick(t ? { kind: 'tile', ...t } : null, e);
          } else this.opts.onClick(this.pick(e.clientX, e.clientY), e);
        }
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
      this._leave = () => (this.hoverPick = null);
      el.addEventListener('pointerleave', this._leave);
    }

    unbind() {
      const el = this.dom;
      el.removeEventListener('pointerdown', this._down);
      el.removeEventListener('pointermove', this._move);
      el.removeEventListener('pointerup', this._up);
      el.removeEventListener('pointercancel', this._up);
      el.removeEventListener('wheel', this._wheel);
      el.removeEventListener('contextmenu', this._ctx);
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
      const found = [];
      for (const h of hits) {
        let o = h.object;
        while (o && !o.userData.pick) o = o.parent;
        if (o) found.push(o.userData.pick);
      }
      // 人比家具優先（員工會走動，比較難點到）
      const pri = { staff: 0, customer: 1, object: 2 };
      found.sort((a, b) => pri[a.kind] - pri[b.kind]);
      if (found.length) return found[0];
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
      // 對面人行道、行道樹、斑馬線、公車站牌：讓街景不要空空的
      const far = new THREE.Mesh(
        new THREE.PlaneGeometry(W + OUT_W * 2 + 30, 1.4),
        new THREE.MeshStandardMaterial({
          map: canvasTex(512, 32, (c, w, h) => {
            for (let i = 0; i < 32; i++) {
              c.fillStyle = i % 3 ? '#b9b1a6' : '#a9a197';
              c.fillRect(i * 16, 0, 16, h);
            }
            c.fillStyle = 'rgba(0,0,0,.12)';
            c.fillRect(0, 0, w, 3);
          }),
          roughness: 0.95,
        })
      );
      far.rotation.x = -Math.PI / 2;
      far.position.set(W / 2, 0.006, H + 4.0);
      far.receiveShadow = true;
      g.add(far);
      B(g, W + OUT_W * 2 + 30, 0.08, 0.12, '#9a9289', W / 2, 0, H + 3.3);
      const leaf = ['#4f9a5a', '#5aa865', '#438a50'];
      // 行道樹放自己的群組：鏡頭轉到街上那一側時藏起來，才不會擋住店
      this.trees = new THREE.Group();
      g.add(this.trees);
      let k = 0;
      for (let x = -OUT_W - 6; x < W + OUT_W + 8; x += 3.6) {
        k++;
        B(this.trees, 0.6, 0.06, 0.6, '#6b5a48', x, 0, H + 4.0);
        C(this.trees, 0.06, 0.08, 1.4, '#7a5a3c', x, 0, H + 4.0, 7);
        const top = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 0), mat(leaf[k % 3], { roughness: 0.9, flatShading: true }));
        top.position.set(x, 1.75, H + 4.0);
        top.scale.y = 0.85;
        top.castShadow = true;
        this.trees.add(top);
        const top2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), mat(leaf[(k + 1) % 3], { roughness: 0.9, flatShading: true }));
        top2.position.set(x + 0.25, 2.2, H + 3.9);
        top2.castShadow = true;
        this.trees.add(top2);
      }
      for (let i = 0; i < 6; i++) {
        const zebra = new THREE.Mesh(boxGeo(0.7, 0.01, 0.28), basic('#ededed'));
        zebra.position.set(W + OUT_W + 1.4, 0.011, H + 1.45 + i * 0.36);
        g.add(zebra);
      }
      C(g, 0.035, 0.035, 2.1, '#6a6f75', -OUT_W - 2.2, 0, H + 3.6, 6);
      B(g, 0.5, 0.36, 0.04, '#1f6fb2', -OUT_W - 2.2, 1.7, H + 3.6);
      const redLine = new THREE.Mesh(boxGeo(W + OUT_W * 2 + 30, 0.012, 0.06), basic('#d23c33'));
      redLine.position.set(W / 2, 0.012, H + 1.15);
      g.add(redLine);
      // 騎樓柱子（鏡頭在正面時會降低）
      this.frontProps = new THREE.Group();
      g.add(this.frontProps);
      for (const x of [-OUT_W, 0, W, W + OUT_W]) B(this.frontProps, 0.35, WALL_H + 0.6, 0.35, '#e3d9cb', x, 0, H + 0.95);

      // 店內地板
      const fstyle = root.BossIndustries.FLOORS[s.style.floor] || {};
      const floorTex = canvasTex(W * 32, H * 32, (c) => {
        const cols = fstyle.colors || { breakfast: ['#f2ead8', '#e6dcc7'], noodle: ['#e9dfd0', '#dccfbd'], drinks: ['#eef3ee', '#e1eae2'], barber: ['#ececec', '#3a3a3a'], scooter: ['#9a9a9a', '#8f8f8f'], store: ['#f4f6f8', '#e8ecef'] }[ind.id] || ['#eee', '#ddd'];
        const n = fstyle.small ? 2 : 1;
        for (let y = 0; y < H * n; y++) for (let x = 0; x < W * n; x++) {
          c.fillStyle = cols[s.style.floor === 'wood' ? y % 2 : (x + y) % 2];
          c.fillRect((x * 32) / n, (y * 32) / n, 32 / n, 32 / n);
        }
        if (s.style.floor === 'wood') {
          c.strokeStyle = 'rgba(80,50,20,0.25)';
          for (let y = 0; y < H * 2; y++) for (let x = -1; x < W; x++) c.strokeRect(x * 32 + (y % 2) * 16, y * 16, 32, 16);
        }
        if (fstyle.speckle) {
          for (let i = 0; i < W * H * 14; i++) {
            c.fillStyle = ['#b9ad98', '#8f8676', '#d9b48c', '#9fb7a0'][i % 4];
            c.fillRect(Math.random() * W * 32, Math.random() * H * 32, 2, 2);
          }
        }
        // 格線：看得出每一格的邊界
        c.strokeStyle = 'rgba(60,40,20,0.16)';
        c.lineWidth = 1;
        for (let x = 0; x <= W; x++) {
          c.beginPath();
          c.moveTo(x * 32 + 0.5, 0);
          c.lineTo(x * 32 + 0.5, H * 32);
          c.stroke();
        }
        for (let y = 0; y <= H; y++) {
          c.beginPath();
          c.moveTo(0, y * 32 + 0.5);
          c.lineTo(W * 32, y * 32 + 0.5);
          c.stroke();
        }
      });
      floorTex.magFilter = THREE.NearestFilter;
      this.floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.6 });
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, H), this.floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(W / 2, 0.01, H / 2);
      floor.receiveShadow = true;
      g.add(floor);

      // 牆
      const wallMat = mat(s.style.wall || '#e8ddcf', { roughness: 0.95 });
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
      const signColor = s.style.sign || ind.signColor;
      this.signTex = canvasTex(1024, 192, (c, w, h) => {
        const grad = c.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, signColor);
        grad.addColorStop(1, '#00000033');
        c.fillStyle = signColor;
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
      this.signSide = new THREE.MeshStandardMaterial({ color: signColor, transparent: true });
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
      this.buildShutter(g);
      this.buildFrontSigns(g);

      // 隔壁店家
      const pick = (i) => NEIGHBORS[(i + ind.id.length) % NEIGHBORS.length];
      this.neighborPick = pick(0);
      this.rivalKey = this.rivalState();
      this.buildLeftNeighbor();
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
      // 夜晚的光：路燈底下、店門口地上的暖色光暈（加法混色的平面，比真的燈便宜很多）
      if (!this.glowTex) {
        this.glowTex = canvasTex(128, 128, (c, w, h) => {
          const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
          gr.addColorStop(0, 'rgba(255,214,150,1)');
          gr.addColorStop(0.45, 'rgba(255,190,110,.4)');
          gr.addColorStop(1, 'rgba(255,180,100,0)');
          c.fillStyle = gr;
          c.fillRect(0, 0, w, h);
        });
        this.glowMat = new THREE.MeshBasicMaterial({ map: this.glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, toneMapped: false });
        this.spillMat = this.glowMat.clone();
      }
      this.glowGroup = new THREE.Group();
      for (const x of [-OUT_W + 0.3, W + OUT_W - 0.3]) {
        const pool = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), this.glowMat);
        pool.rotation.x = -Math.PI / 2;
        pool.position.set(x, 0.03, H + 1.3);
        this.glowGroup.add(pool);
      }
      // 店裡的光從門口灑到騎樓
      const spill = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.3, 3.4), this.spillMat);
      spill.rotation.x = -Math.PI / 2;
      spill.position.set(W / 2 - 0.5, 0.025, H + 0.9);
      this.glowGroup.add(spill);
      g.add(this.glowGroup);
      // 牆上的時鐘：指著遊戲裡的時間
      this.clock = new THREE.Group();
      const face = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 24), mat('#fffaf0'));
      face.rotation.x = Math.PI / 2;
      this.clock.add(face);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 8, 24), mat('#3a2c25'));
      this.clock.add(rim);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const tick = new THREE.Mesh(boxGeo(0.015, i % 3 ? 0.03 : 0.05, 0.01), basic('#3a2c25'));
        tick.position.set(Math.sin(a) * 0.16, Math.cos(a) * 0.16, 0.025);
        tick.rotation.z = -a;
        this.clock.add(tick);
      }
      const hand = (len, w, col) => {
        const m = new THREE.Mesh(boxGeo(w, len, 0.01), basic(col));
        m.geometry = m.geometry.clone();
        m.geometry.translate(0, len / 2, 0);
        m.position.z = 0.03;
        this.clock.add(m);
        return m;
      };
      this.clockH = hand(0.1, 0.022, '#2a2420');
      this.clockM = hand(0.15, 0.014, '#2a2420');
      this.clock.position.set(0.7, 2.08, 0.03);
      g.add(this.clock);
      // 馬路上的車流、騎樓的鴿子（純裝飾，不影響經營）
      this.trafficGroup = new THREE.Group();
      g.add(this.trafficGroup);
      this.cars = [];
      this.trafficT = 1;
      this.pigeonGroup = new THREE.Group();
      g.add(this.pigeonGroup);
      this.pigeons = [];
      for (let i = 0; i < 5; i++) this.pigeons.push(this.makePigeon());
      // 合併靜態場景：牆、隔壁店家、柱子、路邊的機車
      for (const gr of [...Object.values(this.walls), ...Object.values(this.neighbors), this.frontProps, this.trees]) People.mergeGroup(gr);
      People.mergeGroup(g, [...Object.values(this.walls), ...Object.values(this.neighbors), this.frontProps, this.trees, this.clock, this.trafficGroup, this.pigeonGroup, this.sign, this.shutter, this.frontSigns, this.glowGroup]);
      if (this.renderer) this.renderer.shadowMap.needsUpdate = true;
      this.updateCamera();
    }

    // 鐵捲門：打烊、大家都走了才拉下來
    buildShutter(g) {
      const s = this.sim;
      const top = WALL_H - 0.3;
      const tex = canvasTex(64, 256, (c, w, h) => {
        for (let y = 0; y < h; y += 8) {
          const grad = c.createLinearGradient(0, y, 0, y + 8);
          grad.addColorStop(0, '#c9ced4');
          grad.addColorStop(0.6, '#a9b0b8');
          grad.addColorStop(1, '#7d858e');
          c.fillStyle = grad;
          c.fillRect(0, y, w, 8);
        }
      });
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(s.W / 2, 1);
      const geo = new THREE.BoxGeometry(s.W + 0.1, 1, 0.05);
      geo.translate(0, -0.5, 0);
      const panel = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, metalness: 0.4, roughness: 0.5 }));
      panel.position.set(s.W / 2, top, s.H + 0.12);
      panel.scale.y = top * this.shutterK + 0.001;
      panel.castShadow = true;
      const hood = new THREE.Mesh(boxGeo(s.W + 0.2, 0.22, 0.25), mat('#8b939c', { metalness: 0.5 }));
      hood.position.set(s.W / 2, top + 0.11, s.H + 0.14);
      hood.userData.keep = true;
      this.shutter = new THREE.Group();
      this.shutter.add(panel, hood);
      this.shutterPanel = panel;
      this.shutterTop = top;
      g.add(this.shutter);
    }

    // 門口的貼紙：衛生優良標章、促銷布條
    buildFrontSigns(g) {
      const s = this.sim;
      this.frontSigns = new THREE.Group();
      const badgeTex = canvasTex(128, 128, (c, w, h) => {
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.arc(64, 64, 60, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = '#1f8a4c';
        c.lineWidth = 8;
        c.stroke();
        c.fillStyle = '#1f8a4c';
        c.font = 'bold 30px "PingFang TC","Noto Sans TC",sans-serif';
        c.textAlign = 'center';
        c.fillText('衛生', 64, 54);
        c.fillText('優良', 64, 90);
      });
      this.badge = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshBasicMaterial({ map: badgeTex, transparent: true }));
      this.badge.position.set(Math.max(0.4, s.doorX - 0.5), 1.5, s.H + 0.07);
      this.badge.visible = false;
      const bannerTex = canvasTex(512, 96, (c, w, h) => {
        c.fillStyle = '#d9482b';
        c.fillRect(0, 0, w, h);
        c.fillStyle = '#fff36b';
        c.font = 'bold 60px "PingFang TC","Noto Sans TC",sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText('全品項九折', w / 2, h / 2 + 3);
      });
      this.banner = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.45), new THREE.MeshBasicMaterial({ map: bannerTex, side: THREE.DoubleSide }));
      this.banner.position.set(s.W / 2, WALL_H - 0.55, s.H + 0.82);
      this.banner.visible = false;
      this.frontSigns.add(this.badge, this.banner);
      g.add(this.frontSigns);
    }

    rivalState() {
      const r = this.sim.rival;
      if (!r) return 'none';
      const opening = !r.closed && this.sim.day - r.opened < 10;
      return `${r.name}|${r.closed}|${opening}`;
    }

    // 左邊隔壁：平常是一般店家；開了競爭對手就換成對手的店
    buildLeftNeighbor() {
      const grp = this.neighbors.left;
      while (grp.children.length) grp.remove(grp.children[0]);
      const s = this.sim;
      const r = s.rival;
      if (r && !r.closed) this.buildRivalShop(grp, -OUT_W, OUT_W, s.H, r, s.day - r.opened < 10);
      else if (r && r.closed) this.buildNeighbor(grp, -OUT_W, 0, OUT_W, s.H, [`${r.name}　頂讓`, '#8a8a8a'], true);
      else this.buildNeighbor(grp, -OUT_W, 0, OUT_W, s.H, this.neighborPick);
    }

    buildRivalShop(group, x0, w, H, r, opening) {
      B(group, w, 3.6, H, '#efe7da', x0 + w / 2, 0, H / 2);
      // 亮著燈的玻璃店面
      B(group, w - 0.3, 2.0, 0.06, basic('#fff1c9', { transparent: true, opacity: 0.85 }), x0 + w / 2, 0, H - 0.02);
      B(group, w - 0.2, 0.18, 0.12, r.color, x0 + w / 2, 2.0, H - 0.01);
      const tex = canvasTex(512, 128, (c, cw, ch) => {
        c.fillStyle = r.color;
        c.fillRect(0, 0, cw, ch);
        c.strokeStyle = '#fff';
        c.lineWidth = 6;
        c.strokeRect(8, 8, cw - 16, ch - 16);
        c.fillStyle = '#fff';
        c.font = 'bold 64px "PingFang TC","Noto Sans TC",sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(r.name, cw / 2, ch / 2 + 4);
      });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.3, 0.7), new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.4 }));
      sign.position.set(x0 + w / 2, 2.55, H + 0.03);
      group.add(sign);
      if (opening) {
        // 開幕花籃和布條
        for (const dx of [0.4, w - 0.4]) {
          C(group, 0.04, 0.04, 1.0, '#7a5a40', x0 + dx, 0, H + 0.35, 6);
          const flowers = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), mat('#e84a7a', { flatShading: true }));
          flowers.position.set(x0 + dx, 1.15, H + 0.35);
          group.add(flowers);
        }
        const btex = canvasTex(512, 96, (c, cw, ch) => {
          c.fillStyle = '#ffde59';
          c.fillRect(0, 0, cw, ch);
          c.fillStyle = '#c0392b';
          c.font = 'bold 54px "PingFang TC","Noto Sans TC",sans-serif';
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText('開幕優惠 買一送一', cw / 2, ch / 2 + 3);
        });
        const banner = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.4, 0.32), new THREE.MeshBasicMaterial({ map: btex }));
        banner.position.set(x0 + w / 2, 3.1, H + 0.04);
        group.add(banner);
      }
    }

    buildNeighbor(group, x0, z0, w, h, [name, color], forLease = false) {
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
      if (forLease) {
        // 鐵捲門上貼的紅紙
        const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.8), basic('#d23c33'));
        paper.position.set(x0 + w / 2, 0.9, H + 0.05);
        group.add(paper);
      }
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
      // 半透明的招牌疊在人身上反而更亂，正面看的時候直接收起來
      if (this.sign) this.sign.visible = !frontNear;
      if (this.awning) this.awning.visible = !frontNear;
      if (this.frontProps) this.frontProps.scale.y = frontNear ? 0.15 : 1;
      if (this.trees) this.trees.visible = !frontNear;
      if (this.clock) this.clock.visible = !near.includes('back');
      this.applyShutterCut(frontNear);
      if (this.frontSigns) this.frontSigns.visible = !frontNear;
      this.frontNear = frontNear;
    }

    // 正面朝鏡頭時：營業中把鐵捲門壓低免得擋住店裡；打烊拉下來時照實顯示（建造模式除外）
    applyShutterCut(frontNear = this.frontNear) {
      if (!this.shutter) return;
      const low = frontNear && (this.shutterK < 0.99 || this.peek);
      this.shutter.scale.y = low ? 0.22 : 1;
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
      (MODELS[o.def.model] || MODELS.plant)(inner, this, o.def);
      if (!o.def.wall) {
        // 佔地框：深色底板加外框，看得出這件東西佔哪幾格
        const w = o.def.w || 1;
        const plate = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.06, 0.94), footMat);
        plate.rotation.x = -Math.PI / 2;
        plate.position.set((w - 1) / 2, 0.015, 0);
        plate.renderOrder = -1;
        g.add(plate);
        const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(w - 0.06, 0.94)), footLine);
        edge.rotation.x = -Math.PI / 2;
        edge.position.set((w - 1) / 2, 0.018, 0);
        g.add(edge);
      }
      if (o.def.pro) {
        // 高級設備：金色飾條
        const trim = new THREE.Mesh(boxGeo((o.def.w || 1) - 0.05, 0.05, 0.05), mat('#d4a017', { metalness: 0.8, roughness: 0.25 }));
        trim.position.set(((o.def.w || 1) - 1) / 2, 0.45, 0.42);
        inner.add(trim);
      }
      g.userData.pick = { kind: 'object', obj: o };
      Object.assign(g.userData, inner.userData);
      const u = inner.userData;
      People.mergeGroup(inner, [u.wave, u.spin, u.pole, u.art, u.robotHead, u.liftScooter, ...(u.fish || [])]);
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
          this.renderer.shadowMap.needsUpdate = true;
        }
        const key = `${o.x},${o.z},${o.rot}`;
        if (m.key !== key) {
          m.key = key;
          this.placeGroup(m.group, o);
          this.renderer.shadowMap.needsUpdate = true;
        }
      }
      for (const [id, m] of this.objMeshes) {
        if (!seen.has(id)) {
          this.world.remove(m.group);
          this.objMeshes.delete(id);
          this.renderer.shadowMap.needsUpdate = true;
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
        ...(this.quality === 'low' ? s.passers.slice(0, 6) : s.passers).map((p) => ({ a: p, kind: p.kind })),
      ];
      for (const { a, kind } of list) {
        seen.add(a.id);
        let v = this.agents.get(a.id);
        if (!v) {
          const p = People.make(a.look);
          p.group.userData.pick = kind === 'staff' ? { kind: 'staff', staff: a } : kind === 'customer' ? { kind: 'customer', customer: a } : null;
          v = { p, kind, pickable: kind === 'staff' || kind === 'customer' };
          if (v.pickable) {
            // 看不見、大一點的點擊範圍，走動中的人也點得到
            const hit = new THREE.Mesh(kind === 'staff' ? hitGeoBig : hitGeo, hitMat);
            hit.position.y = 0.75;
            p.group.add(hit);
          }
          if (kind === 'scooter' || (kind === 'customer' && a.scooter)) {
            const sc = a.supplier ? scooterModel('#ecf0f1', true, '#2f6db5') : a.rider ? scooterModel('#3a3a3a', true) : scooterModel(['#c0392b', '#ecf0f1', '#2c3e50', '#2980b9', '#f1c40f'][a.id % 5]);
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
            // 合併出來的網格是每個人獨有的，要釋放；共用的幾何不能動
            if (o.geometry && o.material === People.vcMat) o.geometry.dispose();
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
        // 買完帶走的東西；送貨員搬著紙箱進來
        const carry = { drinks: 'cup', breakfast: 'bag', noodle: 'box', store: 'bag' }[this.sim.ind.id];
        if (a.supplier) People.setCarry(p, a.state === 'arriving' && !outside ? 'crate' : null);
        else People.setCarry(p, a.state === 'leaving' && a.stars && carry ? (a.rider ? null : carry) : null);
        this.setFaceForCustomer(p, a);
      } else if (kind === 'staff') {
        if (a.state === 'break' && a.task && a.task.obj && !a.path.length) sitting = true;
        const ev = this.sim.activeEvents.find((e) => e.staff === a);
        People.setMood(p, ev ? 'worried' : a.energy < 25 ? 'sad' : a.mood >= 70 ? 'happy' : a.mood >= 40 ? 'neutral' : a.mood >= 22 ? 'worried' : 'sad');
        const serving = a.task && a.task.lane && a.task.lane.customer && a.task.lane.customer.state === 'atLane' && !a.path.length;
        const mopping = a.task && a.task.type === 'clean';
        People.setCarry(p, mopping ? 'mop' : null);
        if (mopping && !a.path.length) {
          p.armR.rotation.x = -0.5 + Math.sin(now / 160) * 0.35;
          p.armL.rotation.x = -0.5 + Math.sin(now / 160) * 0.35;
        } else if (ev) {
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
      // 站著不動的人稍微錯開，不會完全疊在一起
      if (!a.moving && kind === 'customer' && !sitting) {
        x += (((a.id * 37) % 7) - 3) * 0.035;
        z += (((a.id * 53) % 7) - 3) * 0.035;
      }
      if (kind === 'staff' && !v.ring) {
        // 員工腳下的綠色圓圈，一眼分得出誰是員工
        v.ring = new THREE.Mesh(staffRingGeo, staffRingMat);
        v.ring.rotation.x = -Math.PI / 2;
        v.ring.position.y = 0.02;
        p.group.add(v.ring);
      }
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
      this.nightK = night;
      if (this.glowMat) {
        this.glowMat.opacity = night > 0.4 ? Math.min(0.7, (night - 0.4) * 1.6) : 0;
        this.spillMat.opacity = lit ? Math.min(0.55, night * 0.65) : 0;
      }
      if (this.grade) {
        const tint = night > 0.5 ? `rgba(40,60,120,${(0.07 * (night - 0.5) * 2).toFixed(2)})` : dusk > 0 ? `rgba(255,140,60,${(0.12 * dusk).toFixed(2)})` : 'rgba(0,0,0,0)';
        const vig = (0.1 + night * 0.22).toFixed(2);
        const key = tint + vig;
        if (key !== this.gradeKey) {
          this.gradeKey = key;
          this.grade.style.background = `radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(10,10,25,${vig}) 100%), linear-gradient(${tint}, ${tint})`;
        }
      }
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
      (MODELS[def.model] || MODELS.plant)(inner, this, def);
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
      if (this.sim.W !== this._lastW || (this.sim.styleVer || 0) !== this._styleVer) {
        this._lastW = this.sim.W;
        this._styleVer = this.sim.styleVer || 0;
        this.buildStatic();
      }
      this.easeCamera(dt);
      this.syncObjects();
      this.syncAgents(dt, now);
      this.syncDirt();
      this.updateBoss(dt, now);
      this.updateStorefront(dt);
      this.updateLight();
      this._shadowT = (this._shadowT || 0) + dt;
      if (this._shadowT > 2) {
        // 太陽慢慢移動，每兩秒更新一次陰影就夠了
        this._shadowT = 0;
        this.renderer.shadowMap.needsUpdate = true;
      }
      this.updateRain(dt);
      this.updateStreetLife(dt, now);
      this.updateRipples(dt);
      this.animateProps(now);
      this.renderer.render(this.world, this.camera);
      this.updateOverlay();
      this.trackPerf(now);
    }

    // 老闆本人：自己操控的角色，鏡頭跟著走
    updateBoss(dt, now) {
      const s = this.sim;
      const b = s.boss;
      const show = b.state === 'working' && !b.away;
      if (!this.bossView) {
        const p = People.make(window.BossLooks.bossLook(this.opts.bossGender ? this.opts.bossGender() : 'm'), { boss: true });
        const root = new THREE.Group();
        root.add(p.group);
        const sc = scooterModel('#d9482b');
        sc.visible = false;
        root.add(sc);
        // 腳下的金色圓圈：一眼找到自己
        const ring = new THREE.Mesh(staffRingGeo, new THREE.MeshBasicMaterial({ color: '#f2c14e', transparent: true, opacity: 0.95, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.025;
        ring.scale.setScalar(1.25);
        root.add(ring);
        this.world.add(root);
        this.bossView = { p, root, sc };
      }
      const v = this.bossView;
      v.root.visible = show;
      if (!show) return;
      v.root.position.set(b.x + 0.5, 0, b.z + 0.5);
      let diff = b.dir - v.root.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      v.root.rotation.y += diff * Math.min(1, dt * 14);
      v.sc.visible = b.ride;
      v.p.group.position.y = b.ride ? 0.25 : 0;
      People.walk(v.p, b.moving && !b.ride, dt, 1.2);
      const serving = b.lane && b.lane.customer && b.lane.customer.state === 'atLane';
      const mopping = b.mopUntil > s.minute;
      People.setCarry(v.p, mopping ? 'mop' : null);
      if (serving || mopping) {
        v.p.armR.rotation.x = -0.9 + Math.sin(now / 90) * 0.35;
        v.p.armL.rotation.x = -0.9 + Math.cos(now / 90) * 0.35;
        if (serving) v.root.rotation.y = Math.atan2(b.lane.custSpot.x - b.lane.staffSpot.x, b.lane.custSpot.z - b.lane.staffSpot.z);
      }
      People.setMood(v.p, b.energy < 25 ? 'sad' : serving ? 'happy' : 'smug');
      // 鏡頭跟著老闆（平滑移動）
      if (this.opts.follow && this.opts.follow()) {
        const cz = (s.H + 1.2) / 2 + 0.4;
        const tx = b.x + 0.5 - s.W / 2;
        const tz = b.z + 0.5 - cz;
        const k = Math.min(1, dt * 4);
        const nx = this.pan.x + (tx - this.pan.x) * k;
        const nz = this.pan.z + (tz - this.pan.z) * k;
        if (Math.abs(nx - this.pan.x) > 0.001 || Math.abs(nz - this.pan.z) > 0.001) {
          this.pan.x = nx;
          this.pan.z = nz;
          this.updateCamera();
        }
      }
    }

    // 量每秒幾幀：太慢就自動降畫質
    trackPerf(now) {
      const p = this.perf;
      if (!p.start) p.start = now;
      p.frames++;
      if (now - p.start < 2000) return;
      this.fps = (p.frames * 1000) / (now - p.start);
      p.start = now;
      p.frames = 0;
      if (document.hidden || !this.opts.autoQuality || !this.opts.autoQuality()) return;
      p.slow = this.fps < 26 ? p.slow + 1 : 0;
      if (p.slow >= 2 && this.quality !== 'low') {
        p.slow = 0;
        const next = this.quality === 'high' ? 'medium' : 'low';
        this.setQuality(next);
        if (this.opts.onQuality) this.opts.onQuality(next);
      }
    }

    // 地上的髒污：一塊一塊的污漬，越髒越大
    syncDirt() {
      const s = this.sim;
      const seen = new Set();
      for (const d of s.dirt) {
        seen.add(d.id);
        let m = this.dirtMeshes.get(d.id);
        if (!m) {
          m = new THREE.Mesh(dirtGeo, dirtMat(d.kind));
          m.rotation.x = -Math.PI / 2;
          const j = (d.id * 2654435761) >>> 0;
          m.position.set(d.x + 0.5 + ((j % 100) / 100 - 0.5) * 0.4, 0.02, d.z + 0.5 + (((j >> 8) % 100) / 100 - 0.5) * 0.4);
          m.scale.set(1, 0.7 + ((j >> 16) % 50) / 100, 1);
          m.renderOrder = -1;
          this.world.add(m);
          this.dirtMeshes.set(d.id, m);
        }
        const k = 0.3 + Math.min(4, Math.max(0.3, d.amt)) * 0.12;
        m.scale.x = k;
        m.scale.y = k * 0.8;
      }
      for (const [id, m] of this.dirtMeshes) {
        if (!seen.has(id)) {
          this.world.remove(m);
          this.dirtMeshes.delete(id);
        }
      }
      // 油垢：地板慢慢變黃變暗
      if (this.floorMat) {
        const g = Math.min(1, s.grime / 45);
        this.floorMat.color.setRGB(1 - g * 0.22, 1 - g * 0.27, 1 - g * 0.38);
      }
    }

    // 店門口：鐵捲門、標章、布條、隔壁的對手
    updateStorefront(dt) {
      const s = this.sim;
      const allOut = s.staff.every((e) => e.state === 'off' || (e.state === 'leaving' && e.z >= s.H));
      const target = !s.isOpen && allOut && !s.customers.some((c) => s.inside(Math.round(c.x), Math.round(c.z))) ? 1 : 0;
      if (target !== this.shutterTarget) {
        if (this.shutterTarget !== undefined && root.BossAudio) root.BossAudio.play('shutter');
        this.shutterTarget = target;
      }
      const step = dt * 0.6;
      this.shutterK = target > this.shutterK ? Math.min(target, this.shutterK + step) : Math.max(target, this.shutterK - step);
      if (this.shutterPanel) this.shutterPanel.scale.y = this.shutterTop * this.shutterK + 0.001;
      this.peek = !!(this.opts.peek && this.opts.peek());
      this.applyShutterCut();
      if (this.badge) this.badge.visible = !!(s.hygiene.badge && s.hygiene.badge > s.day);
      if (this.banner) this.banner.visible = s.promoOn;
      const key = this.rivalState();
      if (key !== this.rivalKey) {
        this.rivalKey = key;
        this.buildLeftNeighbor();
        People.mergeGroup(this.neighbors.left);
        this.renderer.shadowMap.needsUpdate = true;
      }
      this.updateRivalCrowd();
      this.updateShopCat();
    }

    // 店貓：收養之後會在店裡找個角落睡覺，偶爾換位置
    updateShopCat() {
      const s = this.sim;
      if (!s.shopCat) {
        if (this.cat) this.cat.visible = false;
        return;
      }
      if (!this.cat) {
        const g = new THREE.Group();
        const fur = mat('#e8933a');
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), fur);
        body.scale.set(1, 0.7, 1.4);
        body.position.y = 0.14;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), fur);
        head.position.set(0, 0.24, 0.26);
        const earGeo = new THREE.ConeGeometry(0.045, 0.09, 6);
        const e1 = new THREE.Mesh(earGeo, fur);
        e1.position.set(-0.07, 0.36, 0.26);
        const e2 = e1.clone();
        e2.position.x = 0.07;
        const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.36, 6), mat('#d17a2a'));
        tail.position.set(0.12, 0.12, -0.3);
        tail.rotation.set(1.2, 0, 0.5);
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.06), mat('#c96b1f'));
        stripe.position.set(0, 0.27, 0.02);
        g.add(body, head, e1, e2, tail, stripe);
        g.traverse((o) => (o.castShadow = true));
        People.mergeGroup(g);
        this.cat = g;
        this.world.add(g);
        this.catSpot = null;
      }
      this.cat.visible = true;
      // 每隔一段遊戲時間換個地方睡
      const slot = Math.floor(s.minute / 180);
      if (this.catSlot !== slot || !this.catSpot) {
        this.catSlot = slot;
        const free = [];
        for (let z = 0; z < s.H - 1; z++) for (let x = 0; x < s.W; x++) if (s.passable(x, z) && !s.objects.some((o) => o.custSpots && o.custSpots.some((c) => c.x === x && c.z === z))) free.push([x, z]);
        const pick = free[(slot * 7 + 3) % Math.max(1, free.length)] || [0, 0];
        this.catSpot = pick;
        this.cat.position.set(pick[0] + 0.5, 0.01, pick[1] + 0.5);
        this.cat.rotation.y = (slot % 4) * 1.3;
      }
      this.cat.scale.y = 1 + Math.sin(performance.now() / 600) * 0.04; // 睡覺的呼吸
    }

    // 對手門口排隊的人：對手越強，排越多
    updateRivalCrowd() {
      const s = this.sim;
      const r = s.rival;
      const n = r && !r.closed && s.hour >= 7 && s.hour < 21 ? Math.round(r.strength * 5 + (s.day - r.opened < 10 ? 2 : 0)) : 0;
      if (!this.rivalCrowd) {
        this.rivalCrowd = new THREE.Group();
        this.world.add(this.rivalCrowd);
      }
      if (this.rivalCrowd.children.length === n) return;
      while (this.rivalCrowd.children.length > n) this.rivalCrowd.remove(this.rivalCrowd.children[this.rivalCrowd.children.length - 1]);
      while (this.rivalCrowd.children.length < n) {
        const i = this.rivalCrowd.children.length;
        const p = People.make(window.BossLooks.randomLook(Math.random));
        p.group.position.set(-OUT_W + 0.6 + (i % 4) * 0.8, 0, s.H + 0.45 + Math.floor(i / 4) * 0.5);
        p.group.rotation.y = Math.PI;
        this.rivalCrowd.add(p.group);
      }
      this.rivalCrowd.visible = this.neighbors.left.visible;
    }

    // 點地板的漣漪
    ripple(x, z) {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.26, 28), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.04, z);
      this.world.add(m);
      (this.ripples = this.ripples || []).push({ m, t: 0 });
    }

    updateRipples(dt) {
      if (!this.ripples || !this.ripples.length) return;
      for (const r of this.ripples) {
        r.t += dt;
        const k = r.t / 0.55;
        r.m.scale.setScalar(1 + k * 3);
        r.m.material.opacity = Math.max(0, 0.9 * (1 - k));
      }
      this.ripples = this.ripples.filter((r) => {
        if (r.t < 0.55) return true;
        this.world.remove(r.m);
        r.m.geometry.dispose();
        r.m.material.dispose();
        return false;
      });
    }

    // ───── 街景：車流、鴿子、時鐘 ─────
    makeCar() {
      const s = this.sim;
      const r = Math.random();
      const type = r < 0.12 ? 'bus' : r < 0.3 ? 'truck' : 'car';
      const g = new THREE.Group();
      const colors = ['#d9482b', '#2c6fbb', '#f2f2f2', '#2b2b30', '#f2c14e', '#5aa9a0', '#8e44ad', '#bdc3c7'];
      const col = type === 'bus' ? '#2f8f6b' : type === 'truck' ? '#f2f2f2' : colors[Math.floor(Math.random() * colors.length)];
      const L = type === 'bus' ? 4.2 : type === 'truck' ? 2.6 : 1.9;
      const Hh = type === 'bus' ? 1.25 : type === 'truck' ? 0.95 : 0.45;
      B(g, L, Hh, 0.8, col, 0, 0.18, 0, { roughness: 0.4, metalness: 0.2 });
      if (type === 'car') {
        B(g, L * 0.55, 0.32, 0.72, col, -0.1, 0.63, 0, { roughness: 0.4, metalness: 0.2 });
        B(g, L * 0.5, 0.26, 0.74, basic('#a9c9de'), -0.1, 0.66, 0);
      } else if (type === 'bus') {
        B(g, L * 0.92, 0.32, 0.82, basic('#a9c9de'), 0, 0.85, 0);
        B(g, L * 0.98, 0.06, 0.84, '#f2f2f2', 0, 1.43, 0);
      } else {
        B(g, 0.7, 0.55, 0.78, '#2c6fbb', L / 2 - 0.35, 0.18, 0);
        B(g, 0.5, 0.25, 0.8, basic('#a9c9de'), L / 2 - 0.3, 0.45, 0);
      }
      for (const x of [-L / 2 + 0.4, L / 2 - 0.4]) for (const z of [-0.38, 0.38]) {
        const w = C(g, 0.17, 0.17, 0.12, '#1d1d1d', x, 0.0, z, 10);
        w.rotation.x = Math.PI / 2;
        w.position.y = 0.17;
      }
      // 頭燈、尾燈（晚上會亮）
      const head = basic('#fff3c4');
      const tail = basic('#ff3b2f');
      for (const z of [-0.28, 0.28]) {
        B(g, 0.03, 0.08, 0.12, head, L / 2 + 0.01, 0.32, z);
        B(g, 0.03, 0.08, 0.12, tail, -L / 2 - 0.01, 0.32, z);
      }
      const beam = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.1), this.glowMat);
      beam.rotation.x = -Math.PI / 2;
      beam.position.set(L / 2 + 1.2, 0.02, 0);
      g.add(beam);
      const dir = Math.random() < 0.5 ? 1 : -1;
      g.rotation.y = dir > 0 ? 0 : Math.PI;
      const H = s.H;
      const z = dir > 0 ? H + 1.7 : H + 2.85;
      const x = dir > 0 ? -s.W * 0.5 - 18 : s.W * 1.5 + 18;
      g.position.set(x, 0, z);
      g.traverse((o) => {
        if (o.isMesh) o.castShadow = false;
      });
      this.trafficGroup.add(g);
      return { g, dir, speed: (type === 'bus' ? 3 : 4) + Math.random() * 2.5, L };
    }

    makePigeon() {
      const s = this.sim;
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), mat('#8a8f9a', { roughness: 0.9 }));
      body.scale.set(1.4, 1, 1);
      body.position.y = 0.1;
      g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat('#6f7a8a'));
      head.position.set(0.12, 0.17, 0);
      g.add(head);
      const neck = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), mat('#5a8f7a', { metalness: 0.3, roughness: 0.4 }));
      neck.position.set(0.09, 0.13, 0);
      g.add(neck);
      const beak = new THREE.Mesh(boxGeo(0.04, 0.015, 0.015), mat('#e2a12a'));
      beak.position.set(0.17, 0.17, 0);
      g.add(beak);
      const wings = [];
      for (const z of [-0.07, 0.07]) {
        const w = new THREE.Mesh(boxGeo(0.14, 0.015, 0.1), mat('#7a808c'));
        w.geometry = w.geometry.clone();
        w.geometry.translate(0, 0, z > 0 ? 0.05 : -0.05);
        w.position.set(-0.02, 0.13, z * 0.6);
        g.add(w);
        wings.push(w);
      }
      g.traverse((o) => {
        if (o.isMesh) o.castShadow = false;
      });
      const p = { g, wings, head, fly: 0, vx: 0, vy: 0, vz: 0, peck: Math.random() * 6, rest: 0 };
      this.landPigeon(p);
      this.pigeonGroup.add(g);
      return p;
    }

    landPigeon(p) {
      const s = this.sim;
      // 騎樓兩側、對街人行道
      const spots = [
        () => [-OUT_W + Math.random() * (OUT_W - 0.5), s.H + 0.35 + Math.random() * 0.5],
        () => [s.W + 0.5 + Math.random() * (OUT_W - 0.8), s.H + 0.35 + Math.random() * 0.5],
        () => [-OUT_W + Math.random() * (s.W + OUT_W * 2), s.H + 3.55 + Math.random() * 0.8],
      ];
      const [x, z] = spots[Math.floor(Math.random() * spots.length)]();
      p.g.position.set(x, 0, z);
      p.g.rotation.y = Math.random() * Math.PI * 2;
      p.g.visible = true;
      p.fly = 0;
      p.wings.forEach((w) => (w.rotation.x = 0));
    }

    scarePigeon(p, fromX, fromZ) {
      if (p.fly || p.rest) return;
      const dx = p.g.position.x - fromX;
      const dz = p.g.position.z - fromZ;
      const d = Math.hypot(dx, dz) || 1;
      p.fly = 1;
      p.vx = (dx / d) * 2.2 + (Math.random() - 0.5);
      p.vz = (dz / d) * 1.2;
      p.vy = 2.4 + Math.random();
      p.g.rotation.y = Math.atan2(-p.vz, p.vx);
    }

    // 點地板：附近的鴿子嚇飛
    scareAt(x, z, r = 1.2) {
      let n = 0;
      for (const p of this.pigeons || []) {
        if (!p.fly && Math.hypot(p.g.position.x - x, p.g.position.z - z) < r) {
          this.scarePigeon(p, x, z);
          n++;
        }
      }
      return n;
    }

    updateStreetLife(dt, now) {
      const s = this.sim;
      const ts = this.opts.timeScale ? this.opts.timeScale() : 1;
      const k = dt * ts;
      // 時鐘
      if (this.clock) {
        const m = ((s.minute % 1440) + 1440) % 1440;
        this.clockM.rotation.z = -((m % 60) / 60) * Math.PI * 2;
        this.clockH.rotation.z = -(((m / 60) % 12) / 12) * Math.PI * 2;
        this._clockT = (this._clockT || 0) - dt;
        if (this._clockT <= 0) {
          // 找一格後牆沒有掛東西的位置
          this._clockT = 2;
          const used = new Set(s.objects.filter((o) => o.def.wall && o.z === 0).flatMap((o) => Array.from({ length: o.def.w || 1 }, (_, i) => o.x + i)));
          let x = 0;
          while (used.has(x) && x < s.W - 1) x++;
          this.clock.position.x = x + 0.5;
        }
      }
      if (!this.trafficGroup) return;
      // 車流：早晚尖峰比較多，深夜很少
      const h = Math.floor((((s.minute % 1440) + 1440) % 1440) / 60);
      const rush = (h >= 7 && h <= 9) || (h >= 17 && h <= 19) ? 1.8 : h >= 23 || h < 6 ? 0.25 : 1;
      const cap = this.quality === 'low' ? 2 : this.quality === 'medium' ? 4 : 6;
      this.trafficT -= k * rush;
      if (this.trafficT <= 0 && this.cars.length < cap) {
        this.cars.push(this.makeCar());
        this.trafficT = 1.2 + Math.random() * 3.5;
      }
      const night = this.nightK || 0;
      if (this.glowMat) this.trafficGroup.visible = true;
      for (const c of this.cars) c.g.position.x += c.dir * c.speed * k;
      const lim = s.W * 1.5 + 22;
      this.cars = this.cars.filter((c) => {
        const out = c.dir > 0 ? c.g.position.x > lim : c.g.position.x < -s.W * 0.5 - 22;
        if (out) this.trafficGroup.remove(c.g);
        return !out;
      });
      // 鴿子：有人走近就飛走，過一陣子再飛回來
      const walkers = [...s.customers, ...s.passers];
      if (s.boss && s.boss.state === 'working' && !s.boss.away) walkers.push(s.boss);
      for (const p of this.pigeons) {
        if (p.rest > 0) {
          p.rest -= k;
          if (p.rest <= 0) this.landPigeon(p);
          continue;
        }
        if (p.fly) {
          p.fly += k;
          p.g.position.x += p.vx * k;
          p.g.position.z += p.vz * k;
          p.g.position.y += p.vy * k;
          p.vy += 0.6 * k;
          const flap = Math.sin(now / 45) * 0.9;
          p.wings[0].rotation.x = flap;
          p.wings[1].rotation.x = -flap;
          if (p.fly > 3) {
            p.g.visible = false;
            p.rest = 6 + Math.random() * 14;
            p.fly = 0;
            p.g.position.y = 0;
          }
          continue;
        }
        // 啄地板、走兩步
        p.peck -= k;
        const pecking = p.peck < 0.25;
        p.head.position.y = pecking ? 0.1 : 0.17;
        if (p.peck <= 0) {
          p.peck = 1 + Math.random() * 3;
          p.g.rotation.y += (Math.random() - 0.5) * 1.5;
        } else if (!pecking && Math.random() < 0.02) {
          p.g.position.x += Math.cos(p.g.rotation.y) * 0.05;
          p.g.position.z -= Math.sin(p.g.rotation.y) * 0.05;
        }
        for (const w of walkers) {
          if (Math.abs(w.x + 0.5 - p.g.position.x) < 0.9 && Math.abs(w.z + 0.5 - p.g.position.z) < 0.9) {
            this.scarePigeon(p, w.x + 0.5, w.z + 0.5);
            break;
          }
        }
        for (const c of this.cars) {
          if (Math.abs(c.g.position.x - p.g.position.x) < c.L && Math.abs(c.g.position.z - p.g.position.z) < 0.8) this.scarePigeon(p, c.g.position.x, c.g.position.z);
        }
      }
    }

    animateProps(now) {
      const s = this.sim;
      const busyObjs = new Set();
      for (const c of s.customers) if (c.state === 'atLane' && c.obj && c.servedBy) busyObjs.add(c.obj.id);
      for (const [id, m] of this.objMeshes) {
        const u = m.group.userData;
        if (u.wave) u.wave.rotation.x = -0.6 + Math.sin(now / 250) * 0.6;
        if (u.spin) u.spin.rotation.z += 0.3;
        if (u.pole) u.pole.rotation.y = now / 400;
        if (u.led) u.led.offset.x = (now / 9000) % 1;
        if (u.art) u.art.rotation.y = now / 1600;
        if (u.robotHead) u.robotHead.rotation.y = Math.sin(now / 1300) * 0.6;
        if (u.fish) u.fish.forEach((f, i) => (f.position.x = Math.sin(now / 900 + i * 2) * 0.28));
        if (u.screen) u.screen.material.color.setHSL(((now / 4000) % 1), 0.5, 0.55);
        if (u.liftScooter) {
          const o = m.group.userData.pick.obj;
          u.liftScooter.visible = o.lanes.some((l) => l.customer && l.customer.state === 'atLane');
        }
        if (u.steam && this.quality !== 'low' && busyObjs.has(id) && Math.random() < 0.15) {
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
          this.steamPool.push(st.mesh);
          return false;
        }
        return true;
      });
    }

    spawnSteam(pos) {
      if (this.steam.length > 30) return;
      this.steamPool = this.steamPool || [];
      this.steamGeo = this.steamGeo || new THREE.SphereGeometry(0.07, 8, 6);
      const m = this.steamPool.pop() || new THREE.Mesh(this.steamGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, depthWrite: false }));
      m.position.copy(pos);
      m.scale.setScalar(1);
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
      // 會互相擋到的泡泡先收集起來，最後統一排開
      const items = [];
      const add = (el, x, y, z, w, h, pri) => {
        const p = this.project(x, y, z);
        items.push({ el, x: p.x, y: p.y, w, h, pri });
      };

      // 員工：事件驚嘆號、想法泡泡（最多 4 個，最新的優先）
      const thinkers = s.staff
        .filter((e) => e.state !== 'off' && e.thought && e.thought.until > s.minute && !s.activeEvents.some((x) => x.staff === e))
        .sort((a, b) => (b === this.selected) - (a === this.selected) || b.thought.until - a.thought.until)
        .slice(0, 4);
      for (const e of s.staff) {
        if (e.state === 'off') continue;
        const ev = s.activeEvents.find((x) => x.staff === e);
        if (ev) {
          const el = this.label(`ev-${ev.id}`, 'bubble3d');
          el.style.setProperty('--left', `${Math.max(0, Math.min(1, (ev.deadline - s.minute) / (ev.deadline - ev.spawnedAt))) * 360}deg`);
          if (!el.firstChild) el.innerHTML = '<span>!</span>';
          el.classList.toggle('urgent', ev.deadline - s.minute < (ev.deadline - ev.spawnedAt) * 0.3);
          el.dataset.ev = ev.id;
          add(el, e.x + 0.5, 2.15, e.z + 0.5, 40, 40, 3);
        } else if (thinkers.includes(e)) {
          const el = this.label(`th-${e.id}`, 'thought3d');
          if (el.textContent !== e.thought.text) el.textContent = e.thought.text;
          add(el, e.x + 0.5, 2.0, e.z + 0.5, Math.min(160, e.thought.text.length * 12 + 18), 22, 1);
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
          if (st) add(el, st.x + 0.5, 1.8, st.z + 0.5, 40, 40, 3);
        } else add(el, s.doorX + 1, 2.1, s.H + 0.5, 40, 40, 3);
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
          add(el, c.x + 0.5, 1.75, c.z + 0.5, 42, 28, 2);
        }
      }
      // 老闆：頭上的「你」、說的話、附近可以互動的東西
      const B = s.boss;
      if (B.state === 'working' && !B.away) {
        const tag = this.label('boss-tag', 'boss-tag');
        const tt = B.thought && B.thought.until > s.minute ? `👑 ${B.thought.text}` : '👑 你';
        if (tag.textContent !== tt) tag.textContent = tt;
        add(tag, B.x + 0.5, 2.25, B.z + 0.5, Math.min(180, tt.length * 12 + 16), 22, 4);
        const tg = this.opts.bossPrompt && this.opts.bossPrompt();
        if (tg) {
          const el = this.label('boss-prompt', 'boss-prompt');
          const text = `${tg.key} ${tg.label}`;
          if (el.textContent !== text) el.textContent = text;
          const at = tg.ref && tg.ref.x !== undefined ? tg.ref : tg.ref && tg.ref.staffSpot ? tg.ref.staffSpot : B;
          add(el, at.x + 0.5, at === B ? 2.7 : 1.9, at.z + 0.5, Math.min(220, text.length * 12 + 20), 24, 5);
        }
      }
      // 奧客在大聲嚷嚷
      for (const c of s.customers) {
        if (!c.karen || c.state === 'leaving') continue;
        const el = this.label(`kr-${c.id}`, 'karen3d');
        const text = c.thought && c.thought.until > s.minute ? `😤 ${c.thought.text}` : `😤 ${c.karen.name}`;
        if (el.textContent !== text) el.textContent = text;
        add(el, c.x + 0.5, 2.0, c.z + 0.5, Math.min(200, text.length * 12 + 18), 24, 2);
      }
      // 金額與表情（最多 10 個）
      s.popups.slice(-10).forEach((p) => {
        const el = this.label(`pp-${p.id}`, `popup3d ${p.kind}`);
        if (el.textContent !== p.text) el.textContent = p.text;
        el.style.opacity = String(Math.max(0, 1 - p.t / 3));
        add(el, p.x + 0.5, 1.9 + Math.max(0, p.t) * 0.35, p.z + 0.5, p.text.length * 9 + 8, 20, 0);
      });

      // 排開重疊的泡泡：重要的先放，後面的往上推
      items.sort((a, b) => b.pri - a.pri || b.y - a.y);
      const placed = [];
      for (const it of items) {
        let top = it.y - it.h;
        const left = it.x - it.w / 2;
        for (let tries = 0; tries < 8; tries++) {
          const hit = placed.find((q) => left < q.left + q.w && left + it.w > q.left && top < q.top + q.h && top + it.h > q.top);
          if (!hit) break;
          top = hit.top - it.h - 2;
        }
        placed.push({ left, top, w: it.w, h: it.h });
        const t = `translate(${(left + it.w / 2).toFixed(1)}px, ${(top + it.h).toFixed(1)}px) translate(-50%, -100%)`;
        if (it.el.style.transform !== t) it.el.style.transform = t;
      }

      // 選取框與滑鼠指著的東西
      if (this.selected) {
        const a = this.selected;
        const el = this.label('sel', 'select-ring');
        this.place(el, (a.x ?? 0) + 0.5, 0, (a.z ?? 0) + 0.5, '-50%', '-50%');
      }
      const hp = this.hoverPick;
      if (hp && !(this.selected && (hp.staff === this.selected || hp.customer === this.selected))) {
        const h = hp;
        const el = this.label('hover', `hover-box ${h.kind}`);
        if (h.kind === 'object') {
          const o = h.obj;
          const xs = o.cells.map((c) => c.x);
          const zs = o.cells.map((c) => c.z);
          const a = this.project(Math.min(...xs), 0, Math.min(...zs));
          const b = this.project(Math.max(...xs) + 1, 0, Math.max(...zs) + 1);
          const c2 = this.project(Math.min(...xs), 0, Math.max(...zs) + 1);
          const d = this.project(Math.max(...xs) + 1, 0, Math.min(...zs));
          const minX = Math.min(a.x, b.x, c2.x, d.x);
          const maxX = Math.max(a.x, b.x, c2.x, d.x);
          const minY = Math.min(a.y, b.y, c2.y, d.y);
          const maxY = Math.max(a.y, b.y, c2.y, d.y);
          el.style.width = `${maxX - minX}px`;
          el.style.height = `${(maxY - minY) * 2.2}px`;
          el.style.transform = `translate(${minX}px, ${maxY - (maxY - minY) * 2.2}px)`;
          el.dataset.label = o.def.name;
        } else {
          const a = h.staff || h.customer;
          el.style.width = '';
          el.style.height = '';
          const c = h.customer;
          const t = c && root.BossSim.CUSTOMER_TYPES[c.type];
          el.dataset.label = h.staff ? h.staff.name : c.supplier ? '送貨員' : c.inspector ? '稽查員' : t ? `${t.icon} ${t.name}` : '外送員';
          this.place(el, a.x + 0.5, 1.15, a.z + 0.5, '-50%', '-50%');
        }
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
