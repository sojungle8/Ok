// 3D 斜角辦公室（three.js）：只負責畫面，遊戲邏輯都在 DayScene
(function (root) {
  const THREE = root.THREE;
  if (!THREE) return;
  const { MAP } = root.BossData;
  const { bossLook, VISITORS } = root.BossLooks;

  const WALL_H = 1.9;
  const DAY_START = 9 * 60;
  const DAY_END = 18 * 60;

  const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...opts });
  const lerpColor = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), Math.max(0, Math.min(1, t)));

  // 各產業的桌面擺設與大桌子樣式
  const THEME = {
    drinks: { floor: ['#f3e3cf', '#ead6bd'], wall: '#f7efe6', accent: '#e8743b', table: '#d9b48c', tableStyle: 'counter', prop: 'drinks' },
    tech: { floor: ['#e3e8ef', '#d8dee8'], wall: '#f2f4f7', accent: '#4a6fa5', table: '#b9c2cf', tableStyle: 'meeting', prop: 'monitor' },
    store: { floor: ['#eef1ee', '#e1e6e2'], wall: '#f4f7f4', accent: '#2f9e64', table: '#e9ecef', tableStyle: 'shelf', prop: 'register' },
    restaurant: { floor: ['#e9d3c1', '#ddc3ad'], wall: '#f6ece2', accent: '#c0392b', table: '#a9744f', tableStyle: 'dining', prop: 'stove' },
    cram: { floor: ['#ece6dc', '#e0d8cb'], wall: '#f5f1ea', accent: '#5b7fb0', table: '#c9a77c', tableStyle: 'classroom', prop: 'books' },
  };

  class Office3D {
    constructor(container, scene) {
      this.scene = scene;
      this.container = container;
      this.theme = THEME[scene.game.industry.id] || THEME.tech;
      this.cols = MAP[0].length;
      this.rows = MAP.length;

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputEncoding = THREE.sRGBEncoding;
      this.renderer = renderer;
      this.dom = renderer.domElement;
      this.dom.className = 'office-3d';
      container.appendChild(this.dom);

      this.overlay = document.createElement('div');
      this.overlay.className = 'office-overlay';
      container.appendChild(this.overlay);

      this.world = new THREE.Scene();
      this.world.background = new THREE.Color('#3b3430');
      this.camera = new THREE.OrthographicCamera(-10, 10, 6, -6, 0.1, 200);
      const cx = this.cols / 2;
      const cz = this.rows / 2;
      this.center = new THREE.Vector3(cx, 0, cz + 0.6);
      this.camera.position.set(cx + 14, 17, cz + 18);
      this.camera.lookAt(this.center);

      this.hemi = new THREE.HemisphereLight('#ffffff', '#9a8b7c', 0.75);
      this.world.add(this.hemi);
      this.sun = new THREE.DirectionalLight('#fff3e0', 0.9);
      this.sun.position.set(cx - 8, 16, cz - 10);
      this.sun.target.position.set(cx, 0, cz);
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(2048, 2048);
      Object.assign(this.sun.shadow.camera, { left: -14, right: 14, top: 12, bottom: -12, near: 1, far: 50 });
      this.sun.shadow.bias = -0.0008;
      this.world.add(this.sun, this.sun.target);

      this.pickables = [];
      this.windows = [];
      this.labels = new Map();
      this.buildRoom();
      this.boss = this.makePerson(bossLook(scene.gender), { boss: true });
      this.world.add(this.boss.group);
      this.visitor = null;
      this.staffMeshes = [];
      this.syncStaff();

      this.raycaster = new THREE.Raycaster();
      this.floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      this.resize = this.resize.bind(this);
      this.ro = new ResizeObserver(this.resize);
      this.ro.observe(container);
      this.resize();
      this.lastNow = performance.now();
    }

    destroy() {
      this.ro.disconnect();
      this.renderer.dispose();
      this.world.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) [].concat(o.material).forEach((m) => (m.map && m.map.dispose(), m.dispose()));
      });
      this.container.innerHTML = '';
    }

    resize() {
      const w = this.container.clientWidth || 800;
      const h = this.container.clientHeight || 480;
      this.renderer.setSize(w, h, false);
      this.dom.style.width = `${w}px`;
      this.dom.style.height = `${h}px`;
      this.fitCamera(w / h);
    }

    // 讓整個辦公室剛好塞進畫面
    fitCamera(aspect) {
      const cam = this.camera;
      cam.updateMatrixWorld();
      const inv = cam.matrixWorldInverse;
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const x of [0, this.cols]) {
        for (const z of [0, this.rows]) {
          // 只有後面兩面牆是高的
          for (const y of x === 0 || z === 0 ? [0, WALL_H] : [0, 0.4]) {
            const v = new THREE.Vector3(x, y, z).applyMatrix4(inv);
            minX = Math.min(minX, v.x);
            maxX = Math.max(maxX, v.x);
            minY = Math.min(minY, v.y);
            maxY = Math.max(maxY, v.y);
          }
        }
      }
      let w = (maxX - minX) * 1.02;
      let h = (maxY - minY) * 1.04;
      if (w / h > aspect) h = w / aspect;
      else w = h * aspect;
      const mx = (minX + maxX) / 2;
      const my = (minY + maxY) / 2;
      Object.assign(cam, { left: mx - w / 2, right: mx + w / 2, top: my + h / 2, bottom: my - h / 2 });
      cam.updateProjectionMatrix();
    }

    // ───── 房間與家具 ─────
    add(mesh, x, y, z, { cast = true, receive = true } = {}) {
      mesh.position.set(x, y, z);
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
      this.world.add(mesh);
      return mesh;
    }

    box(w, h, d, color, x, y, z, opts) {
      return this.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'string' ? mat(color) : color), x, y + h / 2, z, opts);
    }

    cyl(rt, rb, h, color, x, y, z, seg = 16) {
      return this.add(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color)), x, y + h / 2, z);
    }

    tagPick(objs, tile) {
      for (const o of [].concat(objs)) {
        o.userData.tile = tile;
        this.pickables.push(o);
      }
    }

    buildRoom() {
      const th = this.theme;
      // 地板：格子貼圖
      const c = document.createElement('canvas');
      c.width = this.cols * 32;
      c.height = this.rows * 32;
      const g = c.getContext('2d');
      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          g.fillStyle = th.floor[(x + y) % 2];
          g.fillRect(x * 32, y * 32, 32, 32);
        }
      }
      const tex = new THREE.CanvasTexture(c);
      tex.encoding = THREE.sRGBEncoding;
      tex.magFilter = THREE.NearestFilter;
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(this.cols, this.rows), mat('#ffffff', { map: tex, roughness: 0.9 }));
      floor.rotation.x = -Math.PI / 2;
      this.add(floor, this.cols / 2, 0, this.rows / 2, { cast: false });

      const wallMat = mat(th.wall, { roughness: 0.95 });
      const baseMat = mat('#8c7b6b');
      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          const ch = MAP[y][x];
          const cx = x + 0.5;
          const cz = y + 0.5;
          if (ch === '#') {
            const back = y === 0 || x === 0;
            const h = back ? WALL_H : 0.28;
            this.box(1, h, 1, back ? wallMat : baseMat, cx, 0, cz);
            if (back) this.box(1.001, 0.12, 1.001, baseMat, cx, 0, cz);
            // 後牆上開幾扇窗，天色會隨時間變
            if (y === 0 && x % 4 === 2 && x < this.cols - 3) this.addWindow(cx, 0, 'z');
            if (x === 0 && y % 4 === 2) this.addWindow(0, cz, 'x');
            continue;
          }
          if (ch === 'E') {
            this.box(1, 0.02, 1, '#6b4f3a', cx, 0, cz, { cast: false });
            this.box(0.08, 1.4, 0.12, '#7a5a40', x + (MAP[y][x - 1] === 'E' ? 1 : 0), 0, cz);
            const mat2 = this.box(0.9, 0.02, 0.6, th.accent, cx, 0.02, cz - 1, { cast: false });
            this.tagPick(mat2, { x, y });
            continue;
          }
          if (ch === 'D') this.addDesk(x, y);
          else if (ch === 'T') this.addTable(x, y);
          else if (ch === 'B') this.addBossDesk(x, y);
          else if (ch === 'C') this.addCoffee(x, y);
          else if (ch === 'F') this.addFridge(x, y);
          else if (ch === 'S') this.addSofa(x, y);
          else if (ch === 'P') this.addPlant(x, y);
        }
      }
    }

    addWindow(x, z, axis) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.9), new THREE.MeshBasicMaterial({ color: '#bfe3ff' }));
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.64, 1.04, 0.06), mat('#ffffff'));
      if (axis === 'z') {
        pane.position.set(x + 0.5, 1.05, 1.005);
        frame.position.set(x + 0.5, 1.05, 0.98);
      } else {
        pane.rotation.y = Math.PI / 2;
        frame.rotation.y = Math.PI / 2;
        pane.position.set(1.005, 1.05, z);
        frame.position.set(0.98, 1.05, z);
      }
      this.world.add(frame, pane);
      this.windows.push(pane);
    }

    addDesk(x, y) {
      const cx = x + 0.5;
      const cz = y + 0.5 + 0.26;
      const th = this.theme;
      const top = this.box(0.92, 0.06, 0.42, th.table, cx, 0.62, cz);
      this.box(0.86, 0.6, 0.06, mat(th.table, { roughness: 0.9 }), cx, 0.02, cz + 0.18);
      const parts = [top];
      if (th.prop === 'monitor') {
        parts.push(this.box(0.42, 0.28, 0.04, '#24272e', cx, 0.72, cz - 0.08));
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.24), new THREE.MeshBasicMaterial({ color: '#7fb6ff' }));
        scr.position.set(cx, 0.86, cz - 0.105);
        scr.rotation.y = Math.PI;
        this.world.add(scr);
        this.box(0.3, 0.02, 0.1, '#3a3f48', cx, 0.68, cz + 0.08);
      } else if (th.prop === 'drinks') {
        for (let i = 0; i < 3; i++) this.cyl(0.05, 0.04, 0.16, ['#f2d7a7', '#c9874b', '#8fcf9c'][i], cx - 0.25 + i * 0.12, 0.68, cz + 0.02);
        this.cyl(0.07, 0.07, 0.2, '#d0d6dc', cx + 0.28, 0.68, cz - 0.04);
      } else if (th.prop === 'register') {
        this.box(0.32, 0.14, 0.24, '#33363c', cx + 0.12, 0.68, cz);
        this.box(0.2, 0.04, 0.12, '#9be29b', cx + 0.12, 0.82, cz - 0.04);
      } else if (th.prop === 'stove') {
        this.box(0.6, 0.06, 0.34, '#3c3f45', cx, 0.68, cz);
        this.cyl(0.12, 0.1, 0.14, '#b8bec6', cx - 0.12, 0.74, cz);
        this.cyl(0.1, 0.1, 0.06, '#8a5a3a', cx + 0.16, 0.74, cz);
      } else {
        for (let i = 0; i < 3; i++) this.box(0.26, 0.05, 0.18, ['#c75b5b', '#4f7cac', '#d9a441'][i], cx - 0.18, 0.68 + i * 0.05, cz);
        this.box(0.3, 0.02, 0.2, '#ffffff', cx + 0.2, 0.68, cz);
      }
      this.tagPick(parts, { x, y });
    }

    addTable(x, y) {
      const th = this.theme;
      const cx = x + 0.5;
      const cz = y + 0.5;
      let parts;
      switch (th.tableStyle) {
        case 'shelf': {
          parts = [this.box(0.96, 1.1, 0.5, '#d7dce2', cx, 0, cz)];
          const colors = ['#e74c3c', '#f1c40f', '#3498db', '#2ecc71', '#e67e22', '#9b59b6'];
          for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) this.box(0.18, 0.2, 0.14, colors[(x + r * 2 + i) % colors.length], cx - 0.33 + i * 0.22, 0.12 + r * 0.34, cz + 0.2);
          break;
        }
        case 'dining':
          parts = [this.box(0.8, 0.05, 0.8, th.table, cx, 0.56, cz), this.cyl(0.05, 0.05, 0.56, '#5a4030', cx, 0, cz)];
          this.cyl(0.14, 0.14, 0.38, '#7d5a40', cx - 0.42, 0, cz);
          this.cyl(0.04, 0.04, 0.1, '#f2f2f2', cx + 0.1, 0.61, cz - 0.1);
          break;
        case 'counter':
          parts = [this.box(1, 0.86, 0.6, th.table, cx, 0, cz), this.box(1, 0.05, 0.66, '#f3ede6', cx, 0.86, cz)];
          if (x % 2) this.cyl(0.09, 0.09, 0.22, '#e8743b', cx, 0.91, cz);
          break;
        case 'classroom':
          parts = [this.box(0.94, 0.05, 0.5, th.table, cx, 0.6, cz)];
          this.box(0.9, 0.6, 0.04, '#8a6a48', cx, 0, cz + 0.2);
          this.box(0.3, 0.02, 0.22, '#ffffff', cx, 0.65, cz);
          break;
        default:
          parts = [this.box(1, 0.06, 0.8, th.table, cx, 0.6, cz)];
          this.cyl(0.05, 0.07, 0.6, '#555b66', cx, 0, cz);
          this.box(0.24, 0.02, 0.16, '#ffffff', cx - 0.2, 0.66, cz);
      }
      this.tagPick(parts, { x, y });
    }

    addBossDesk(x, y) {
      const cx = x + 0.5;
      const cz = y + 0.5;
      const top = this.box(1.0, 0.07, 0.62, '#6e4b33', cx, 0.68, cz);
      const front = this.box(0.96, 0.68, 0.06, '#5b3d29', cx, 0, cz + 0.28);
      this.phoneBase = this.box(0.2, 0.06, 0.16, '#2b2b2b', cx + 0.25, 0.75, cz);
      this.handset = this.box(0.22, 0.05, 0.06, '#c0392b', cx + 0.25, 0.81, cz - 0.02);
      this.handsetY = this.handset.position.y;
      this.box(0.3, 0.02, 0.22, '#f5f5f5', cx - 0.2, 0.75, cz);
      this.tagPick([top, front, this.phoneBase, this.handset], { x, y });
      // 老闆椅
      this.box(0.4, 0.08, 0.4, '#2c2c34', cx, 0.42, cz - 0.55);
      this.box(0.4, 0.5, 0.08, '#2c2c34', cx, 0.5, cz - 0.75);
    }

    addCoffee(x, y) {
      const cx = x + 0.5;
      const cz = y + 0.5;
      const cab = this.box(0.8, 0.8, 0.6, '#c9b29a', cx, 0, cz);
      const m = this.box(0.42, 0.5, 0.36, '#2d2f33', cx, 0.8, cz);
      const light = this.box(0.06, 0.06, 0.02, new THREE.MeshBasicMaterial({ color: '#ff5a4f' }), cx + 0.12, 1.12, cz + 0.19);
      this.cyl(0.06, 0.05, 0.1, '#ffffff', cx - 0.05, 0.84, cz + 0.12);
      this.tagPick([cab, m, light], { x, y });
    }

    addFridge(x, y) {
      const cx = x + 0.5;
      const cz = y + 0.5;
      const f = this.box(0.72, 1.5, 0.62, '#eef2f5', cx, 0, cz);
      this.box(0.04, 0.4, 0.04, '#9aa3ad', cx - 0.26, 0.9, cz + 0.33);
      this.box(0.7, 0.01, 0.01, '#c4ccd4', cx, 1.0, cz + 0.315);
      this.tagPick(f, { x, y });
    }

    addSofa(x, y) {
      const cx = x + 0.5;
      const cz = y + 0.5;
      const c = '#6f93c4';
      const seat = this.box(1.0, 0.36, 0.7, c, cx, 0, cz);
      const back = this.box(1.0, 0.5, 0.18, mat(c, { roughness: 1 }), cx, 0.3, cz - 0.28);
      this.box(0.14, 0.5, 0.7, c, cx - 0.48, 0, cz);
      this.box(0.14, 0.5, 0.7, c, cx + 0.48, 0, cz);
      this.box(0.3, 0.14, 0.2, '#f2d7a7', cx - 0.2, 0.36, cz - 0.1);
      this.tagPick([seat, back], { x, y });
    }

    addPlant(x, y) {
      const cx = x + 0.5;
      const cz = y + 0.5;
      this.cyl(0.2, 0.15, 0.36, '#b5653e', cx, 0, cz);
      const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 0), mat('#4f9d5a', { flatShading: true }));
      this.add(leaves, cx, 0.68, cz);
      const l2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 0), mat('#5fb36b', { flatShading: true }));
      this.add(l2, cx + 0.1, 0.95, cz - 0.05);
    }

    // ───── 人物 ─────
    makePerson(look, { boss = false } = {}) {
      const group = new THREE.Group();
      const skin = mat(look.skin);
      const shirt = mat(look.shirt);
      const pants = mat(look.suit ? '#232a38' : '#3d4350');
      const hairM = mat(look.hair);

      const legGeo = new THREE.BoxGeometry(0.11, 0.34, 0.12);
      legGeo.translate(0, -0.17, 0);
      const legL = new THREE.Mesh(legGeo, pants);
      const legR = new THREE.Mesh(legGeo, pants);
      legL.position.set(-0.07, 0.36, 0);
      legR.position.set(0.07, 0.36, 0);

      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.2, 4, 12), shirt);
      body.position.y = 0.53;
      body.scale.set(1, 1, 0.78);
      const parts = [legL, legR, body];
      if (look.tie) {
        const tie = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.02), mat(look.tie));
        tie.position.set(0, 0.6, 0.13);
        parts.push(tie);
      }

      const armGeo = new THREE.CapsuleGeometry(0.045, 0.22, 3, 8);
      armGeo.translate(0, -0.13, 0);
      const armL = new THREE.Mesh(armGeo, shirt);
      const armR = new THREE.Mesh(armGeo, shirt);
      armL.position.set(-0.2, 0.68, 0);
      armR.position.set(0.2, 0.68, 0);
      armL.rotation.z = 0.12;
      armR.rotation.z = -0.12;

      const head = new THREE.Group();
      head.position.y = 0.92;
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 16), skin);
      head.add(skull);
      // 頭髮
      if (look.hairStyle !== 'bald') {
        // 頭髮只蓋頭頂和後腦，前面往上掀，臉才露得出來
        const hair = new THREE.Mesh(new THREE.SphereGeometry(0.182, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), hairM);
        hair.rotation.x = -0.55;
        head.add(hair);
      }
      if (look.hairStyle === 'long' || look.hairStyle === 'bob') {
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.34, look.hairStyle === 'long' ? 0.34 : 0.22, 0.12), hairM);
        back.position.set(0, look.hairStyle === 'long' ? -0.1 : -0.03, -0.1);
        head.add(back);
      }
      if (look.hairStyle === 'bun') {
        const bun = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), hairM);
        bun.position.set(0, 0.17, -0.06);
        head.add(bun);
      }
      if (look.hairStyle === 'spiky') {
        for (let i = 0; i < 5; i++) {
          const sp = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 6), hairM);
          sp.position.set(-0.1 + i * 0.05, 0.17, -0.02);
          sp.rotation.z = (i - 2) * 0.25;
          head.add(sp);
        }
      }
      if (look.hat === 'chef') {
        const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.2, 16), mat('#ffffff'));
        hat.position.y = 0.2;
        head.add(hat);
      } else if (look.hat === 'cap') {
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.186, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.4), mat(look.hatColor));
        head.add(cap);
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.12), mat(look.hatColor));
        visor.position.set(0, 0.08, 0.18);
        head.add(visor);
      }
      // 臉（貼圖，表情會換）
      const faceCanvas = document.createElement('canvas');
      faceCanvas.width = faceCanvas.height = 128;
      const faceTex = new THREE.CanvasTexture(faceCanvas);
      faceTex.encoding = THREE.sRGBEncoding;
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28), new THREE.MeshBasicMaterial({ map: faceTex, transparent: true }));
      face.position.set(0, -0.035, 0.176);
      head.add(face);
      if (look.glasses) {
        const gl = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 16), mat('#222222'));
        const gr = gl.clone();
        gl.position.set(-0.055, -0.02, 0.178);
        gr.position.set(0.055, -0.02, 0.178);
        head.add(gl, gr);
      }

      group.add(...parts, armL, armR, head);
      // Q 版比例：頭大一點，遠遠看也認得出表情
      head.scale.setScalar(1.35);
      head.position.y = 0.97;
      group.scale.setScalar(1.25);
      group.traverse((o) => {
        if (o.isMesh && o !== face) o.castShadow = true;
      });
      const person = { group, legL, legR, armL, armR, head, faceCanvas, faceTex, mood: null, boss, phase: Math.random() * 6 };
      this.setMood(person, boss ? 'smug' : 'neutral');
      return person;
    }

    setMood(p, mood) {
      if (p.mood === mood) return;
      p.mood = mood;
      const g = p.faceCanvas.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, 128, 128);
      // 五官放大一點畫，縮小後才看得清楚
      g.translate(64, 64);
      g.scale(1.25, 1.25);
      g.translate(-64, -60);
      g.strokeStyle = g.fillStyle = '#2a211c';
      g.lineWidth = 10;
      g.lineCap = 'round';
      const eyes = (fn) => [44, 84].forEach((x) => fn(x, 58));
      const arc = (x, y, r, a0, a1) => {
        g.beginPath();
        g.arc(x, y, r, a0, a1);
        g.stroke();
      };
      switch (mood) {
        case 'happy':
          eyes((x, y) => arc(x, y + 4, 9, Math.PI * 1.1, Math.PI * 1.9));
          g.fillStyle = '#8a2f2f';
          g.beginPath();
          g.arc(64, 82, 16, 0, Math.PI);
          g.fill();
          g.fillStyle = 'rgba(240,140,140,0.6)';
          [30, 98].forEach((x) => {
            g.beginPath();
            g.ellipse(x, 76, 9, 5, 0, 0, Math.PI * 2);
            g.fill();
          });
          break;
        case 'worried':
          eyes((x, y) => {
            g.beginPath();
            g.arc(x, y, 8, 0, Math.PI * 2);
            g.fill();
          });
          g.beginPath();
          g.moveTo(30, 40);
          g.lineTo(52, 32);
          g.moveTo(76, 32);
          g.lineTo(98, 40);
          g.stroke();
          g.beginPath();
          g.moveTo(48, 92);
          g.quadraticCurveTo(56, 84, 64, 92);
          g.quadraticCurveTo(72, 100, 80, 92);
          g.stroke();
          break;
        case 'sad':
          eyes((x, y) => arc(x, y - 4, 9, Math.PI * 0.15, Math.PI * 0.85));
          g.fillStyle = '#6fb8e6';
          [44, 84].forEach((x) => g.fillRect(x - 3, 62, 6, 22));
          g.strokeStyle = '#2a211c';
          arc(64, 104, 16, Math.PI * 1.15, Math.PI * 1.85);
          break;
        case 'angry':
          g.beginPath();
          g.moveTo(28, 38);
          g.lineTo(54, 50);
          g.moveTo(74, 50);
          g.lineTo(100, 38);
          g.stroke();
          eyes((x, y) => g.fillRect(x - 7, y, 14, 7));
          arc(64, 104, 16, Math.PI * 1.15, Math.PI * 1.85);
          break;
        case 'smug':
          eyes((x, y) => {
            g.beginPath();
            g.moveTo(x - 9, y);
            g.lineTo(x + 9, y);
            g.stroke();
          });
          g.beginPath();
          g.moveTo(46, 84);
          g.quadraticCurveTo(70, 96, 84, 78);
          g.stroke();
          break;
        case 'sleep':
          eyes((x, y) => {
            g.beginPath();
            g.moveTo(x - 9, y);
            g.lineTo(x + 9, y);
            g.stroke();
          });
          g.beginPath();
          g.arc(64, 88, 7, 0, Math.PI * 2);
          g.stroke();
          break;
        default:
          eyes((x, y) => {
            g.beginPath();
            g.ellipse(x, y, 8, 11, 0, 0, Math.PI * 2);
            g.fill();
          });
          g.beginPath();
          g.moveTo(50, 86);
          g.quadraticCurveTo(64, 94, 78, 86);
          g.stroke();
      }
      p.faceTex.needsUpdate = true;
    }

    syncStaff() {
      const list = this.scene.staff;
      if (this.staffMeshes.length === list.length && this.staffMeshes.every((m, i) => m.name === list[i].name)) return;
      for (const m of this.staffMeshes) {
        this.world.remove(m.group);
        this.pickables = this.pickables.filter((o) => !m.picks.includes(o));
      }
      this.staffMeshes = list.map((s) => {
        const p = this.makePerson(s.look);
        p.name = s.name;
        p.group.position.set(s.seat.x + 0.5, 0, s.seat.y + 0.5 - 0.14);
        this.world.add(p.group);
        p.picks = [];
        p.group.traverse((o) => {
          if (o.isMesh) {
            o.userData.tile = s.seat;
            p.picks.push(o);
          }
        });
        this.pickables.push(...p.picks);
        return p;
      });
    }

    // ───── 點擊 → 地圖格 ─────
    pickTile(clientX, clientY) {
      const r = this.dom.getBoundingClientRect();
      const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      this.raycaster.setFromCamera(ndc, this.camera);
      const hit = this.raycaster.intersectObjects(this.pickables, false)[0];
      if (hit && hit.object.userData.tile) return hit.object.userData.tile;
      const p = new THREE.Vector3();
      if (!this.raycaster.ray.intersectPlane(this.floorPlane, p)) return null;
      const x = Math.floor(p.x);
      const y = Math.floor(p.z);
      if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return null;
      return { x, y };
    }

    // ───── 每一幀 ─────
    render(now) {
      const dt = Math.min(0.05, (now - this.lastNow) / 1000);
      this.lastNow = now;
      const sc = this.scene;
      const frozen = sc.paused || sc.dialogOpen || sc.ended;
      this.syncStaff();
      this.updateLight(sc.clock);

      // 老闆
      const b = this.boss;
      b.group.position.set(sc.boss.x, 0, sc.boss.y);
      if (sc.boss.angle !== undefined) {
        const target = sc.boss.angle;
        let diff = target - b.group.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        b.group.rotation.y += diff * Math.min(1, dt * 14);
      }
      const walking = sc.isMoving && !frozen && !sc.busy;
      this.animateWalk(b, walking, dt, sc.keys.has('shift') ? 1.6 : 1);
      const sleeping = sc.busy && sc.busy.label.startsWith('😴');
      if (sleeping) {
        const sofa = sc.stations.find((s) => s.type === 'sofa').tile;
        b.group.position.set(sofa.x + 0.5, 0.3, sofa.y + 0.4);
        b.group.rotation.set(0, 0, 0);
        b.group.rotation.z = Math.PI / 2;
      } else {
        b.group.rotation.z = 0;
      }
      this.setMood(b, sleeping ? 'sleep' : sc.energy < 20 ? 'sad' : sc.energy < 45 ? 'worried' : 'smug');

      // 員工
      const g = sc.game;
      const active = new Map();
      for (const p of sc.active) if (p.where === 'staff') active.set(p.staffIdx, p);
      this.staffMeshes.forEach((m, i) => {
        const s = sc.staff[i];
        if (!s) return;
        const m2 = Math.max(0, Math.min(100, g.morale + s.moodOffset));
        const hasEvent = active.has(i);
        this.setMood(m, hasEvent ? 'worried' : m2 >= 70 ? 'happy' : m2 >= 42 ? 'neutral' : m2 >= 25 ? 'worried' : 'sad');
        m.phase += frozen ? 0 : dt;
        // 有事找老闆就舉手揮一揮，沒事就打字
        if (hasEvent) {
          m.armR.rotation.x = -2.6 + Math.sin(m.phase * 8) * 0.25;
          m.armR.rotation.z = -0.2;
        } else {
          m.armR.rotation.x = -0.5 + Math.sin(m.phase * 10 + i) * 0.12;
          m.armR.rotation.z = -0.12;
        }
        m.armL.rotation.x = -0.5 + Math.sin(m.phase * 10 + i + 1.5) * 0.12;
        m.head.rotation.y = hasEvent ? 0 : Math.sin(m.phase * 0.6 + i) * 0.25;
        m.group.position.y = Math.abs(Math.sin(m.phase * 2 + i)) * 0.01;
      });

      // 門口訪客
      const doorEv = sc.active.find((p) => p.where === 'door');
      if (doorEv && !this.visitor) {
        const look = VISITORS[(doorEv.ev.speaker && doorEv.ev.speaker.look) || 'crowd'] || VISITORS.crowd;
        this.visitor = this.makePerson(look);
        this.setMood(this.visitor, doorEv.ev.id === 'd_karen' ? 'angry' : 'neutral');
        const d = sc.doorTiles[0];
        this.visitor.group.position.set(d.x + 1, 0, d.y - 0.1);
        this.world.add(this.visitor.group);
      } else if (!doorEv && this.visitor) {
        this.world.remove(this.visitor.group);
        this.visitor = null;
      }
      if (this.visitor) this.visitor.armR.rotation.x = -2.4 + Math.sin(now / 160) * 0.3;

      // 電話響：話筒跳動
      const ringing = sc.active.some((p) => p.where === 'phone');
      if (this.handset) {
        this.handset.position.y = this.handsetY + (ringing && !frozen ? Math.abs(Math.sin(now / 45)) * 0.05 : 0);
        this.handset.rotation.z = ringing && !frozen ? Math.sin(now / 30) * 0.2 : 0;
      }

      this.renderer.render(this.world, this.camera);
      this.updateOverlay(now);
    }

    animateWalk(p, walking, dt, speed) {
      if (walking) {
        p.phase += dt * 11 * speed;
        const s = Math.sin(p.phase);
        p.legL.rotation.x = s * 0.7;
        p.legR.rotation.x = -s * 0.7;
        p.armL.rotation.x = -s * 0.6;
        p.armR.rotation.x = s * 0.6;
        p.group.position.y = Math.abs(Math.cos(p.phase)) * 0.04;
      } else {
        const k = Math.min(1, dt * 10);
        for (const part of [p.legL, p.legR, p.armL, p.armR]) part.rotation.x *= 1 - k;
      }
    }

    // 早上偏白、傍晚變橘
    updateLight(clock) {
      const t = (clock - DAY_START) / (DAY_END - DAY_START);
      const late = Math.max(0, (t - 0.6) / 0.4);
      this.sun.color.copy(lerpColor('#fff6e8', '#ffab66', late));
      this.sun.intensity = 0.95 - late * 0.35;
      this.hemi.intensity = 0.75 - late * 0.15;
      const sky = t < 0.6 ? lerpColor('#bfe3ff', '#d6ecff', t / 0.6) : lerpColor('#ffd29a', '#ff8a5b', late);
      for (const w of this.windows) w.material.color.copy(sky);
      const angle = -0.6 + t * 1.6;
      this.sun.position.set(this.cols / 2 + Math.sin(angle) * 12, 15 - late * 6, this.rows / 2 - 10);
    }

    // ───── HTML 疊加層：名字、事件泡泡 ─────
    project(x, y, z) {
      const v = new THREE.Vector3(x, y, z).project(this.camera);
      const r = this.dom.getBoundingClientRect();
      return { x: ((v.x + 1) / 2) * r.width, y: ((1 - v.y) / 2) * r.height };
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

    updateOverlay(now) {
      const sc = this.scene;
      for (const el of this.labels.values()) el.dataset.seen = '';

      sc.staff.forEach((s, i) => {
        const el = this.label(`name-${s.name}`, 'tag-name');
        const p = this.project(s.seat.x + 0.5, 0.02, s.seat.y + 1.02);
        el.textContent = s.name;
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, 0)`;
      });

      for (const ev of sc.active) {
        let wx;
        let wz;
        let icon = '!';
        if (ev.where === 'staff') {
          const s = sc.staff[ev.staffIdx];
          if (!s) continue;
          wx = s.seat.x + 0.5;
          wz = s.seat.y + 0.36;
        } else if (ev.where === 'phone') {
          wx = sc.phoneTile.x + 0.75;
          wz = sc.phoneTile.y + 0.5;
          icon = '☎';
        } else {
          const d = sc.doorTiles[0];
          wx = d.x + 1;
          wz = d.y - 0.1;
          icon = '🚪';
        }
        const el = this.label(`ev-${ev.ev.id}`, 'bubble3d');
        const left = Math.max(0, Math.min(1, (ev.deadline - sc.clock) / (ev.deadline - ev.spawnedAt)));
        const p = this.project(wx, 1.95, wz);
        el.classList.toggle('urgent', left < 0.3);
        el.style.setProperty('--left', `${left * 360}deg`);
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
        if (el.dataset.icon !== icon) {
          el.dataset.icon = icon;
          el.innerHTML = `<span>${icon}</span>`;
        }
      }

      // 老闆頭上的狀態
      const b = sc.boss;
      let status = '';
      if (sc.busy) status = [...sc.busy.label][0] === '😴' ? 'Zzz…' : [...sc.busy.label][0];
      else if (sc.energy < 20) status = '💦';
      const st = this.label('boss-status', 'boss-status');
      st.textContent = status;
      st.hidden = !status;
      const sp = sc.busy && status === 'Zzz…' ? this.project(b.x, 1.2, b.y) : this.project(b.x, 1.9, b.y);
      st.style.transform = `translate(${sp.x}px, ${sp.y}px) translate(-50%, -100%)`;

      // 點擊移動的目的地
      const dest = this.label('dest', 'dest-marker');
      if (sc.path.length) {
        const t = sc.path[sc.path.length - 1];
        const p = this.project(t.x + 0.5, 0, t.y + 0.5);
        dest.hidden = false;
        dest.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
      } else dest.hidden = true;

      for (const [k, el] of this.labels) {
        if (!el.dataset.seen) {
          el.remove();
          this.labels.delete(k);
        }
      }
    }
  }

  root.BossOffice3D = Office3D;
})(typeof window !== 'undefined' ? window : globalThis);
