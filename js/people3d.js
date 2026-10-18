// Q 版 3D 小人：員工、客人、路人共用
(function (root) {
  const THREE = root.THREE;
  if (!THREE) return;
  const cache = new Map();
  const mat = (color, opts = {}) => {
    const key = color + JSON.stringify(opts);
    if (!cache.has(key)) cache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...opts }));
    return cache.get(key);
  };

  // ───── 合併網格：把很多個單色零件合成一個網格（顏色寫在頂點上），大幅減少繪圖次數 ─────
  const vcMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.05 });
  const tmpColor = new THREE.Color();

  function mergeMeshes(meshes, root) {
    const pos = [];
    const nor = [];
    const col = [];
    root.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    for (const m of meshes) {
      const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone());
      m.updateWorldMatrix(true, false);
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      if (!g.attributes.normal) g.computeVertexNormals();
      tmpColor.copy(m.material.color);
      const p = g.attributes.position.array;
      const n = g.attributes.normal.array;
      for (let i = 0; i < p.length; i += 3) {
        pos.push(p[i], p[i + 1], p[i + 2]);
        nor.push(n[i], n[i + 1], n[i + 2]);
        col.push(tmpColor.r, tmpColor.g, tmpColor.b);
      }
      g.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    out.computeBoundingSphere();
    return out;
  }

  // 可以合併的：不透明、沒有貼圖、標準材質、沒有被標記要單獨動的
  function mergeable(m) {
    const mt = m.material;
    return m.isMesh && !Array.isArray(mt) && mt.isMeshStandardMaterial && !mt.map && !mt.transparent && !mt.vertexColors && !m.userData.keep;
  }

  // 把 group 底下可以合併的零件合成一個網格；skip 裡的物件（含子孫）保留原樣
  function mergeGroup(group, skip = [], { cast = true } = {}) {
    const skipSet = new Set();
    for (const o of skip) if (o) o.traverse((x) => skipSet.add(x));
    const list = [];
    group.traverse((o) => {
      if (o !== group && !skipSet.has(o) && mergeable(o)) list.push(o);
    });
    if (list.length < 2) return null;
    const geo = mergeMeshes(list, group);
    for (const m of list) m.parent.remove(m);
    const merged = new THREE.Mesh(geo, vcMat);
    merged.castShadow = cast;
    merged.receiveShadow = true;
    group.add(merged);
    return merged;
  }

  const People = {
    mergeGroup,
    vcMat,
    make(look, { boss = false } = {}) {
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
      // 鞋子
      const shoeGeo = new THREE.BoxGeometry(0.13, 0.07, 0.19);
      const shoeMat = mat(look.old ? '#5a4030' : look.suit ? '#1a1a1a' : ['#2b2b2b', '#f2f2f2', '#3d5a80', '#8a5a3b'][Math.floor((look.skin.charCodeAt(2) + look.hair.charCodeAt(3)) % 4)]);
      for (const leg of [legL, legR]) {
        const shoe = new THREE.Mesh(shoeGeo, shoeMat);
        shoe.position.set(0, -0.32, 0.03);
        leg.add(shoe);
      }

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
      // 手
      const handGeo = new THREE.SphereGeometry(0.05, 10, 8);
      for (const arm of [armL, armR]) {
        const hand = new THREE.Mesh(handGeo, skin);
        hand.position.y = -0.28;
        arm.add(hand);
      }
      // 手上拿的東西（預設藏起來）
      const carry = new THREE.Group();
      carry.position.set(0, -0.32, 0.05);
      carry.visible = false;
      armR.add(carry);

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
      // 合併零件：每個人只剩頭、身體、四肢、臉幾個網格
      mergeGroup(head, [face]);
      for (const limb of [legL, legR]) mergeLimb(limb);
      for (const limb of [armL, armR]) mergeLimb(limb, [carry]);
      const torso = parts.filter((m) => m !== legL && m !== legR);
      if (torso.length > 1) {
        const holder = new THREE.Group();
        group.add(holder);
        const geo = mergeMeshes(torso, group);
        torso.forEach((m) => group.remove(m));
        holder.add(new THREE.Mesh(geo, vcMat));
      }
      // Q 版比例：頭大一點，遠遠看也認得出表情
      head.scale.setScalar(1.35);
      head.position.y = 0.97;
      group.scale.setScalar(1.25);
      // 人物不投射即時陰影，改用腳下的圓形陰影（比較省效能，也比較好分辨位置）
      const blob = new THREE.Mesh(blobGeo, blobMat);
      blob.rotation.x = -Math.PI / 2;
      blob.position.y = 0.012;
      blob.renderOrder = -1;
      group.add(blob);
      const person = { group, legL, legR, armL, armR, head, faceCanvas, faceTex, mood: null, boss, phase: Math.random() * 6, carry };
      People.setMood(person, boss ? 'smug' : 'neutral');
      return person;
    },

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
    },

    // 手上拿的東西：飲料、提袋、紙杯
    setCarry(p, kind) {
      if (p.carryKind === kind) return;
      p.carryKind = kind;
      const c = p.carry;
      while (c.children.length) c.remove(c.children[0]);
      c.visible = !!kind;
      if (kind === 'cup') {
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.16, 10), mat('#f3e3c3'));
        cup.position.y = -0.04;
        const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.02, 10), mat('#ffffff'));
        lid.position.y = 0.05;
        const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 6), mat('#e0478a'));
        straw.position.y = 0.1;
        c.add(cup, lid, straw);
      } else if (kind === 'bag') {
        const bag = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.08), mat('#f7f7f2'));
        bag.position.y = -0.1;
        c.add(bag);
      } else if (kind === 'box') {
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.14), mat('#f2e0b8'));
        box.position.y = -0.04;
        c.add(box);
      }
    },

    walk(p, walking, dt, speed) {
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

  };

  function mergeLimb(limb, skip = []) {
    // 四肢會擺動：把手腳本身和鞋子、手掌合在四肢自己的座標系裡
    const skipSet = new Set();
    for (const o of skip) if (o) o.traverse((x) => skipSet.add(x));
    const list = [];
    limb.traverse((o) => {
      if (!skipSet.has(o) && mergeable(o)) list.push(o);
    });
    if (list.length < 2) return;
    const geo = mergeMeshes(list, limb);
    for (const m of list) if (m !== limb) m.parent.remove(m);
    limb.geometry = geo;
    limb.material = vcMat;
  }

  const blobGeo = new THREE.CircleGeometry(0.26, 16);
  const blobMat = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.22, depthWrite: false });

  root.BossPeople = People;
})(typeof window !== 'undefined' ? window : globalThis);
