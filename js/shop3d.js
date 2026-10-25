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
    if (!geoCache.has(k)) geoCache.set(k, Object.assign(new THREE.BoxGeometry(w, h, d), { userData: { shared: true } }));
    return geoCache.get(k);
  };
  const cylGeo = (rt, rb, h, seg = 16) => {
    const k = `c${rt},${rb},${h},${seg}`;
    if (!geoCache.has(k)) geoCache.set(k, Object.assign(new THREE.CylinderGeometry(rt, rb, h, seg), { userData: { shared: true } }));
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

  // ⚡ 電動車的側面輪廓：M 起點、L 直線、Q 曲線（控制點, 終點）；x 是車長方向（+x 車頭），y 是高度
  // body：車身（腰線以下）；glass：整片玻璃的車艙（電斯拉都是玻璃車頂）；w：車寬
  const EV_PROFILES = {
    // Modal 3：低趴的掀背轎跑，短車尾
    m3: { logo: [0.88, 0.4, 0.25], L: 1.95, w: 0.78, rad: 0.15, light: 0.33, wheels: [-0.62, 0.62], nose: [0.97, 0.26], tail: [-0.98, 0.38],
      body: [['M', -0.97, 0.13], ['L', 0.97, 0.13], ['Q', 1.0, 0.2, 0.98, 0.3], ['Q', 0.92, 0.37, 0.75, 0.39], ['L', 0.32, 0.44], ['L', -0.7, 0.46], ['Q', -0.93, 0.46, -0.97, 0.36]],
      glass: [['M', 0.36, 0.4], ['L', 0.36, 0.43], ['Q', 0.08, 0.64, -0.25, 0.635], ['Q', -0.55, 0.62, -0.72, 0.46], ['L', -0.72, 0.4]] },
    // Modal Y：高一點的跑旅，車尾斜背
    my: { logo: [0.9, 0.45, 0.3], L: 2.0, w: 0.82, rad: 0.17, light: 0.36, wheels: [-0.64, 0.64], nose: [1.0, 0.28], tail: [-1.0, 0.44],
      body: [['M', -1.0, 0.13], ['L', 1.0, 0.13], ['Q', 1.03, 0.22, 1.0, 0.34], ['Q', 0.94, 0.42, 0.78, 0.44], ['L', 0.36, 0.5], ['L', -0.72, 0.52], ['Q', -0.97, 0.52, -1.0, 0.4]],
      glass: [['M', 0.38, 0.46], ['L', 0.38, 0.49], ['Q', 0.12, 0.74, -0.25, 0.74], ['Q', -0.6, 0.72, -0.76, 0.52], ['L', -0.76, 0.46]] },
    // Modal S：更長的掀背旗艦，車尾一路斜下來
    ms: { logo: [0.97, 0.395, 0.25], L: 2.15, w: 0.8, rad: 0.16, light: 0.32, wheels: [-0.7, 0.7], nose: [1.07, 0.26], tail: [-1.08, 0.37],
      body: [['M', -1.07, 0.13], ['L', 1.07, 0.13], ['Q', 1.1, 0.2, 1.08, 0.3], ['Q', 1.0, 0.37, 0.82, 0.39], ['L', 0.36, 0.44], ['L', -0.8, 0.45], ['Q', -1.04, 0.45, -1.07, 0.34]],
      glass: [['M', 0.38, 0.4], ['L', 0.38, 0.43], ['Q', 0.1, 0.63, -0.3, 0.625], ['Q', -0.65, 0.6, -0.86, 0.45], ['L', -0.86, 0.41]] },
    // Modal X：照側面照片量出來的輪廓（照片有廣角變形，前後輪對齊真車軸距後再換算）：超大前擋從 31% 一路延伸到頭頂、車頂平直、後擾流
    mx: { L: 2.09, rad: 0.157, wheels: [0.194, 0.78], logo: 0.06, tail: 'split', rim: '#3d4247',
      k: [[0, 0.2, 0.329, null, 0.29], [0.03, 0.13, 0.352, null, 0.36], [0.06, 0.12, 0.37, null, 0.395], [0.092, 0.12, 0.391, null, 0.41], [0.185, 0.12, 0.419, null, 0.413], [0.232, 0.125, 0.44, null, 0.413], [0.275, 0.125, 0.458, null, 0.413], [0.313, 0.125, 0.466, 0.466, 0.413, 0.36], [0.36, 0.125, 0.47, 0.552, 0.413, 0.34], [0.402, 0.125, 0.474, 0.608, 0.413, 0.33], [0.445, 0.125, 0.478, 0.643, 0.413, 0.325], [0.487, 0.125, 0.482, 0.671, 0.413, 0.32], [0.53, 0.125, 0.486, 0.689, 0.413, 0.32], [0.614, 0.125, 0.49, 0.695, 0.413, 0.32], [0.7, 0.125, 0.496, 0.695, 0.413, 0.32], [0.742, 0.125, 0.5, 0.689, 0.412, 0.322], [0.785, 0.125, 0.51, 0.664, 0.41, 0.325], [0.839, 0.125, 0.56, 0.636, 0.405, 0.33], [0.877, 0.13, 0.6, 0.608, 0.4, 0.335], [0.9, 0.13, 0.6, null, 0.395], [0.946, 0.14, 0.58, null, 0.385], [0.968, 0.15, 0.559, null, 0.37], [1, 0.16, 0.531, null, 0.33]] },
    // 賽伯鐵牛：不鏽鋼三角形，車頭低、屋頂尖、後面一條直線斜下去，梯形輪拱
    ct: { logo: [1.05, 0.53, 0.42], L: 2.36, w: 0.86, rad: 0.2, steel: true, color: '#b8bcc0', light: 0.42, wheels: [-0.65, 0.7], nose: [1.18, 0.3], tail: [-1.17, 0.4], gw: 0.9,
      bar: [1.19, 0.43, -1.17, 0.53],
      body: [['M', -1.15, 0.16], ['L', -0.95, 0.16], ['L', -0.85, 0.4], ['L', -0.45, 0.4], ['L', -0.35, 0.16], ['L', 0.4, 0.16], ['L', 0.5, 0.4], ['L', 0.9, 0.4], ['L', 1.0, 0.16], ['L', 1.17, 0.16], ['L', 1.2, 0.44], ['L', 0.25, 0.86], ['L', -1.17, 0.56]],
      glass: [['M', 0.62, 0.6], ['L', 0.25, 0.8], ['L', -0.4, 0.69], ['L', -0.36, 0.58]] },
    // 路霸跑車：超低的雙門跑車，長車頭、座艙在後面
    rd: { logo: [0.85, 0.33, 0.2], L: 1.9, w: 0.8, rad: 0.15, color: '#c0261a', light: 0.25, wheels: [-0.6, 0.62], nose: [0.96, 0.2], tail: [-0.96, 0.3],
      body: [['M', -0.95, 0.12], ['L', 0.95, 0.12], ['Q', 0.99, 0.18, 0.96, 0.25], ['Q', 0.85, 0.32, 0.6, 0.33], ['L', -0.75, 0.36], ['Q', -0.93, 0.36, -0.95, 0.28]],
      glass: [['M', 0.25, 0.31], ['L', 0.25, 0.34], ['Q', 0.0, 0.5, -0.3, 0.49], ['Q', -0.5, 0.46, -0.6, 0.36], ['L', -0.6, 0.31]] },
    // 無人計程艙：香檳金的雙人座水滴形小車，大玻璃罩、沒有方向盤
    cab: { logo: [0.66, 0.39, 0.1], L: 1.5, w: 0.74, rad: 0.14, color: '#cdb67a', light: 0.3, wheels: [-0.5, 0.5], nose: [0.76, 0.24], tail: [-0.76, 0.3],
      bar: [0.74, 0.34, -0.76, 0.36],
      body: [['M', -0.75, 0.13], ['L', 0.75, 0.13], ['Q', 0.8, 0.25, 0.72, 0.36], ['L', -0.6, 0.4], ['Q', -0.76, 0.38, -0.75, 0.28]],
      glass: [['M', 0.6, 0.34], ['L', 0.6, 0.38], ['Q', 0.3, 0.78, -0.1, 0.76], ['Q', -0.5, 0.68, -0.68, 0.4], ['L', -0.68, 0.34]] },
    // 其他牌子：一般的掀背車、休旅車（車窗比較直）
    hatch: { logo: [0.82, 0.415, 0.3], L: 1.85, w: 0.78, rad: 0.15, light: 0.32, wheels: [-0.58, 0.58], nose: [0.93, 0.27], tail: [-0.93, 0.36],
      body: [['M', -0.92, 0.13], ['L', 0.92, 0.13], ['Q', 0.95, 0.22, 0.92, 0.32], ['Q', 0.85, 0.4, 0.6, 0.42], ['L', 0.3, 0.45], ['L', -0.85, 0.47], ['Q', -0.92, 0.47, -0.92, 0.38]],
      glass: [['M', 0.32, 0.42], ['L', 0.32, 0.44], ['Q', 0.15, 0.66, -0.1, 0.67], ['L', -0.8, 0.66], ['Q', -0.88, 0.6, -0.86, 0.47], ['L', -0.86, 0.42]] },
    suv: { logo: [0.9, 0.46, 0.3], L: 2.0, w: 0.84, rad: 0.17, light: 0.37, wheels: [-0.64, 0.64], nose: [1.0, 0.3], tail: [-1.0, 0.44],
      body: [['M', -1.0, 0.13], ['L', 1.0, 0.13], ['Q', 1.03, 0.24, 1.0, 0.36], ['Q', 0.94, 0.44, 0.75, 0.47], ['L', 0.4, 0.52], ['L', -0.92, 0.54], ['Q', -1.0, 0.54, -1.0, 0.44]],
      glass: [['M', 0.42, 0.48], ['L', 0.42, 0.51], ['Q', 0.22, 0.76, -0.05, 0.77], ['L', -0.88, 0.76], ['Q', -0.95, 0.7, -0.94, 0.54], ['L', -0.94, 0.48]] },
  };
  const evGeoCache = new Map();
  function evGeo(key, path, w) {
    if (!evGeoCache.has(key)) {
      const sh = new THREE.Shape();
      for (const p of path) {
        if (p[0] === 'M') sh.moveTo(p[1], p[2]);
        else if (p[0] === 'L') sh.lineTo(p[1], p[2]);
        else sh.quadraticCurveTo(p[1], p[2], p[3], p[4]);
      }
      const geo = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 2, curveSegments: 6 });
      geo.translate(0, 0, -w / 2);
      geo.computeVertexNormals();
      geo.userData.shared = true;
      evGeoCache.set(key, geo);
    }
    return evGeoCache.get(key);
  }
  // ⚡ 圓潤的電動車：沿著車長取一片一片的截面（每片有自己的寬、高、圓角），再連起來
  // 從上面看車頭車尾會收窄、側面有弧度、車艙往上內縮，比較像真的車（賽伯鐵牛本來就是稜角，維持擠出的做法）
  // 關鍵截面：[u（0 車頭 → 1 車尾）, 車底 y0, 腰線 y1, 車頂 y2（null＝這裡沒有車艙）, 車身半寬 hw, 車頂半寬 hr]
  // 尺寸照真車比例：遊戲裡 1 公尺 ≈ 0.413 單位（Modal 3 長 4.72m、寬 1.85m、高 1.44m、軸距 2.875m…）
  // wheels：前後輪中心的位置（u）；rad：輪胎半徑；tail：尾燈樣式（split 左右兩顆包角、bar 一整條）；front：車頭燈條；rim：輪框顏色
  const LOFTS = {
    // Modal 3（改款）：照側面照片量出來的輪廓（車頂最高在車長 60%、擋風玻璃底在 27%、後窗收在 84%、短車尾小鴨尾）
    m3: { L: 1.95, rad: 0.14, wheels: [0.16, 0.825], logo: 0.06, tail: 'split', rim: '#c9ced3',
      k: [[0, 0.09, 0.254, null, 0.25], [0.02, 0.08, 0.3, null, 0.32], [0.05, 0.085, 0.326, null, 0.355], [0.1, 0.09, 0.35, null, 0.372], [0.15, 0.095, 0.368, null, 0.38], [0.2, 0.095, 0.387, null, 0.382], [0.25, 0.095, 0.405, null, 0.382], [0.27, 0.095, 0.41, 0.41, 0.382, 0.33], [0.3, 0.095, 0.415, 0.459, 0.382, 0.315], [0.35, 0.095, 0.418, 0.507, 0.382, 0.3], [0.4, 0.095, 0.421, 0.544, 0.382, 0.29], [0.5, 0.095, 0.425, 0.586, 0.382, 0.285], [0.6, 0.095, 0.43, 0.595, 0.382, 0.285], [0.7, 0.095, 0.436, 0.574, 0.38, 0.287], [0.76, 0.095, 0.44, 0.545, 0.378, 0.292], [0.8, 0.095, 0.462, 0.52, 0.376, 0.3], [0.84, 0.095, 0.485, 0.488, 0.372, 0.31], [0.9, 0.09, 0.458, null, 0.365], [0.95, 0.09, 0.44, null, 0.35], [0.97, 0.095, 0.432, null, 0.335], [1, 0.11, 0.4, null, 0.29]] },
    // Modal Y（新款）：以量好的 Modal 3 輪廓為底，照 Y 的照片加高 18 公分、車頂最高點往後、後窗收得比較高、掀背車尾加小鴨尾；前後一整條燈條
    my: { L: 1.98, rad: 0.148, wheels: [0.175, 0.815], logo: 0.06, tail: 'bar', front: true, rim: '#3d4247',
      k: [[0, 0.1, 0.255, null, 0.27], [0.02, 0.09, 0.3, null, 0.34], [0.05, 0.095, 0.335, null, 0.375], [0.1, 0.1, 0.369, null, 0.39], [0.15, 0.105, 0.389, null, 0.396], [0.2, 0.105, 0.409, null, 0.397], [0.25, 0.105, 0.429, null, 0.397], [0.29, 0.105, 0.438, 0.438, 0.397, 0.345], [0.35, 0.105, 0.442, 0.516, 0.397, 0.33], [0.4, 0.105, 0.445, 0.57, 0.397, 0.32], [0.45, 0.105, 0.449, 0.61, 0.397, 0.31], [0.55, 0.105, 0.453, 0.657, 0.397, 0.305], [0.65, 0.105, 0.46, 0.67, 0.396, 0.305], [0.72, 0.105, 0.466, 0.66, 0.395, 0.308], [0.76, 0.105, 0.47, 0.643, 0.394, 0.312], [0.8, 0.105, 0.49, 0.616, 0.392, 0.318], [0.85, 0.105, 0.52, 0.576, 0.388, 0.325], [0.89, 0.105, 0.536, 0.536, 0.383, 0.33], [0.93, 0.1, 0.516, null, 0.375], [0.97, 0.1, 0.496, null, 0.36], [1, 0.12, 0.456, null, 0.32]] },
    // Modal S：照側面照片量出來的輪廓（車頂最高在 60～65%、超長斜背一路到 92%、後側大片車身色的 C 柱）
    ms: { L: 2.07, rad: 0.147, wheels: [0.205, 0.855], logo: 0.06, tail: 'split', rim: '#5d6267',
      k: [[0, 0.09, 0.25, null, 0.27], [0.02, 0.08, 0.3, null, 0.34], [0.05, 0.085, 0.35, null, 0.37], [0.1, 0.09, 0.38, null, 0.39], [0.15, 0.095, 0.398, null, 0.405], [0.2, 0.095, 0.41, null, 0.41], [0.25, 0.095, 0.418, null, 0.41], [0.295, 0.095, 0.415, 0.415, 0.41, 0.34], [0.35, 0.095, 0.412, 0.476, 0.41, 0.32], [0.4, 0.095, 0.41, 0.519, 0.41, 0.305], [0.5, 0.095, 0.415, 0.576, 0.41, 0.295], [0.6, 0.095, 0.42, 0.591, 0.41, 0.292], [0.7, 0.095, 0.428, 0.582, 0.408, 0.295], [0.78, 0.095, 0.435, 0.55, 0.405, 0.3], [0.84, 0.095, 0.455, 0.5, 0.4, 0.31], [0.88, 0.09, 0.458, 0.458, 0.39, 0.32], [0.93, 0.09, 0.44, null, 0.38], [0.97, 0.095, 0.416, null, 0.36], [1, 0.11, 0.39, null, 0.31]] },
    // Modal X：最大的休旅（5.06m、1.68m 高），前擋風玻璃從很前面一路延伸到頭頂
    mx: { L: 2.09, rad: 0.157, wheels: [0.194, 0.78], logo: 0.06, tail: 'split', rim: '#9aa0a6',
      k: [[0, 0.12, 0.25, null, 0.28], [0.02, 0.09, 0.31, null, 0.36], [0.06, 0.075, 0.35, null, 0.4], [0.15, 0.07, 0.38, null, 0.41], [0.22, 0.07, 0.4, null, 0.413], [0.26, 0.07, 0.41, 0.41, 0.413, 0.36], [0.36, 0.07, 0.44, 0.6, 0.413, 0.33], [0.48, 0.07, 0.46, 0.69, 0.413, 0.32], [0.66, 0.07, 0.47, 0.694, 0.413, 0.32], [0.82, 0.07, 0.48, 0.6, 0.41, 0.33], [0.89, 0.07, 0.48, 0.48, 0.405, 0.34], [0.95, 0.08, 0.465, null, 0.39], [0.99, 0.1, 0.43, null, 0.34], [1, 0.13, 0.39, null, 0.29]] },
    // 路霸跑車：又寬又低的雙門超跑，長車頭、座艙在後半段
    rd: { L: 1.78, rad: 0.145, wheels: [0.2, 0.8], logo: 0.07, color: '#c0261a', tail: 'bar', rim: '#2b2f33',
      k: [[0, 0.09, 0.16, null, 0.28], [0.03, 0.065, 0.21, null, 0.36], [0.1, 0.06, 0.25, null, 0.4], [0.3, 0.06, 0.28, null, 0.41], [0.42, 0.06, 0.3, 0.3, 0.41, 0.31], [0.52, 0.06, 0.31, 0.43, 0.41, 0.28], [0.62, 0.06, 0.32, 0.47, 0.41, 0.27], [0.74, 0.06, 0.33, 0.4, 0.41, 0.29], [0.8, 0.06, 0.33, 0.33, 0.41, 0.31], [0.94, 0.065, 0.31, null, 0.39], [1, 0.1, 0.26, null, 0.32]] },
    // 無人計程艙：香檳金水滴形雙人座，大玻璃罩，前後一整條燈
    cab: { L: 1.5, rad: 0.14, wheels: [0.2, 0.8], logo: 0.06, color: '#cdb67a', tail: 'bar', front: true, rim: '#d9cfae',
      k: [[0, 0.12, 0.2, null, 0.25], [0.04, 0.085, 0.27, null, 0.33], [0.1, 0.075, 0.32, 0.32, 0.36, 0.3], [0.22, 0.075, 0.33, 0.62, 0.37, 0.29], [0.38, 0.075, 0.34, 0.74, 0.37, 0.28], [0.58, 0.075, 0.35, 0.69, 0.37, 0.28], [0.78, 0.075, 0.36, 0.5, 0.36, 0.3], [0.88, 0.075, 0.36, 0.36, 0.35, 0.31], [0.96, 0.085, 0.34, null, 0.32], [1, 0.12, 0.3, null, 0.26]] },
    // 其他牌子：比較直立的掀背車、方一點的休旅
    hatch: { L: 1.85, rad: 0.14, wheels: [0.18, 0.8], logo: 0.07, tail: 'split', rim: '#b9bec4',
      k: [[0, 0.11, 0.26, null, 0.29], [0.03, 0.08, 0.32, null, 0.36], [0.1, 0.07, 0.37, null, 0.385], [0.27, 0.065, 0.41, null, 0.39], [0.32, 0.065, 0.43, 0.43, 0.39, 0.33], [0.45, 0.065, 0.445, 0.63, 0.39, 0.31], [0.6, 0.065, 0.455, 0.66, 0.39, 0.3], [0.86, 0.065, 0.465, 0.645, 0.39, 0.3], [0.94, 0.065, 0.465, 0.5, 0.38, 0.32], [0.96, 0.07, 0.46, null, 0.37], [1, 0.11, 0.42, null, 0.32]] },
    suv: { L: 1.95, rad: 0.155, wheels: [0.18, 0.81], logo: 0.065, tail: 'split', rim: '#b9bec4',
      k: [[0, 0.12, 0.31, null, 0.31], [0.03, 0.09, 0.38, null, 0.39], [0.1, 0.075, 0.44, null, 0.415], [0.25, 0.07, 0.48, null, 0.42], [0.3, 0.07, 0.5, 0.5, 0.42, 0.36], [0.42, 0.07, 0.515, 0.72, 0.42, 0.34], [0.6, 0.07, 0.525, 0.755, 0.42, 0.33], [0.88, 0.07, 0.535, 0.74, 0.42, 0.33], [0.95, 0.075, 0.535, 0.58, 0.41, 0.35], [0.97, 0.08, 0.53, null, 0.4], [1, 0.12, 0.48, null, 0.35]] },
  };
  // 取某個位置的截面：關鍵截面之間用平滑的三次曲線（不會一格一格凸起來）；輪子那邊車底挖出輪拱
  function hermite(k, col, i, t, h) {
    const v = (j) => k[Math.max(0, Math.min(k.length - 1, j))][col];
    const u = (j) => k[Math.max(0, Math.min(k.length - 1, j))][0];
    const m = (j) => (v(j + 1) - v(j - 1)) / ((u(j + 1) - u(j - 1)) || 1);
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * v(i) + (t3 - 2 * t2 + t) * h * m(i) + (-2 * t3 + 3 * t2) * v(i + 1) + (t3 - t2) * h * m(i + 1);
  }
  function loftAt(D, u) {
    const k = D.k;
    let i = 0;
    while (i < k.length - 2 && u > k[i + 1][0]) i++;
    const a = k[i];
    const b = k[i + 1];
    const h = b[0] - a[0] || 1;
    const t = Math.max(0, Math.min(1, (u - a[0]) / h));
    let y0 = hermite(k, 1, i, t, h);
    const y1 = hermite(k, 2, i, t, h);
    const hw = hermite(k, 4, i, t, h);
    // 車艙：兩邊都有才有（擋風玻璃底、後窗底就是車艙長出來、收回去的地方）
    let y2 = null;
    let hr = hw - 0.08;
    if (a[3] != null && b[3] != null) {
      const lin = (x, y) => x + (y - x) * t;
      const inner = i > 0 && k[i - 1][3] != null && i + 2 < k.length && k[i + 2][3] != null;
      y2 = inner ? hermite(k, 3, i, t, h) : lin(a[3], b[3]);
      hr = lin(a[5], b[5]);
    }
    // 輪拱：輪子前後一段車底往上挖成半圓（從側面看就是輪拱）
    for (const uw of D.wheels) {
      const d = Math.abs(u - uw) * D.L;
      const ar = D.rad + 0.028;
      if (d < ar) y0 = Math.max(y0, Math.min(y1 - 0.05, D.rad + Math.sqrt(ar * ar - d * d)));
    }
    return { x: D.L / 2 - u * D.L, y0, y1, y2: y2 == null ? y1 - 0.012 : y2, hw, hr };
  }
  // 截面的半邊（從底部中間繞到頂部中間），再鏡射成一整圈
  function bodyHalf(s) {
    const { y0, y1, hw } = s;
    const h = y1 - y0;
    // 側面上直下收（下緣往內收）、肩線明顯；引擎蓋中間比葉子板稍低（電動車引擎蓋的樣子）
    return [[0, y0], [hw * 0.8, y0], [hw * 0.95, y0 + h * 0.1], [hw * 0.995, y0 + h * 0.3], [hw, y1 - h * 0.2], [hw * 0.975, y1 - h * 0.06], [hw * 0.88, y1 + 0.004], [hw * 0.5, y1 - 0.002], [0, y1 - 0.004]];
  }
  function cabinHalf(s) {
    const { y1, y2, hw, hr } = s;
    const h = Math.max(0.001, y2 - y1);
    // 車窗往上內縮、車頂左右有弧度（中間最高）
    return [[0, y1 - 0.02], [hw - 0.06, y1 - 0.02], [hw - 0.06, y1 + 0.004], [hr, y2 - h * 0.34], [hr * 0.88, y2 - h * 0.12], [hr * 0.58, y2 - h * 0.025], [0, y2]];
  }
  function loftGeo(D, half, segs) {
    const rings = [];
    for (let i = 0; i <= segs; i++) {
      const s = loftAt(D, i / segs);
      const hp = half(s);
      const ring = hp.map(([z, y]) => [s.x, y, z]);
      for (let j = hp.length - 2; j >= 1; j--) ring.push([s.x, hp[j][1], -hp[j][0]]);
      rings.push(ring);
    }
    const n = rings[0].length;
    const pos = [];
    const idx = [];
    for (const r of rings) for (const p of r) pos.push(...p);
    for (let i = 0; i < segs; i++)
      for (let j = 0; j < n; j++) {
        const a = i * n + j;
        const b = i * n + ((j + 1) % n);
        const c = (i + 1) * n + j;
        const d = (i + 1) * n + ((j + 1) % n);
        idx.push(a, b, c, b, d, c);
      }
    // 車頭、車尾封起來
    for (const [ri, flip] of [[0, false], [segs, true]]) {
      const r = rings[ri];
      const cy = r.reduce((t, p) => t + p[1], 0) / n;
      const ci = pos.length / 3;
      pos.push(r[0][0], cy, 0);
      for (let j = 0; j < n; j++) {
        const a = ri * n + j;
        const b = ri * n + ((j + 1) % n);
        if (flip) idx.push(ci, a, b);
        else idx.push(ci, b, a);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    geo.userData.shared = true;
    return geo;
  }
  const loftCache = new Map();
  function loftParts(model, segs = 64) {
    const key = model + segs;
    if (!loftCache.has(key)) {
      const D = LOFTS[model];
      loftCache.set(key, { body: loftGeo(D, bodyHalf, segs), glass: loftGeo(D, cabinHalf, Math.max(12, segs >> 1)) });
    }
    return loftCache.get(key);
  }
  // 城市地圖的小車也用同一個車形（低一點的精細度）
  root.BossEVGeo = { LOFTS, loftAt, loftParts };

  // 標誌貼圖：SVG 畫成貼圖，每個牌子只做一次
  const logoMats = new Map();
  function evLogoMat(id) {
    if (!logoMats.has(id)) {
      const img = new Image();
      const tex = new THREE.Texture(img);
      img.onload = () => {
        tex.needsUpdate = true;
      };
      const F = window.BossFun || {};
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(F.evLogoSvg ? F.evLogoSvg(id) : '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>');
      logoMats.set(id, new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    }
    return logoMats.get(id);
  }
  let _badgeGeo = null;
  const badgeGeo = () => _badgeGeo || ((_badgeGeo = new THREE.PlaneGeometry(0.16, 0.16)), (_badgeGeo.userData.shared = true), _badgeGeo);

  // 器具前面的小名牌：圖示＋名字，用貼圖畫一次就好
  const plateTex = new Map();
  function plate(g, def, y, z) {
    if (!def) return;
    let t = plateTex.get(def.id);
    if (!t) {
      t = canvasTex(256, 72, (c, w, h) => {
        c.fillStyle = 'rgba(255,255,255,.94)';
        c.fillRect(0, 0, w, h);
        c.strokeStyle = 'rgba(0,0,0,.25)';
        c.lineWidth = 4;
        c.strokeRect(2, 2, w - 4, h - 4);
        c.fillStyle = '#2a2420';
        c.font = 'bold 34px sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(`${def.icon}${def.name.length > 6 ? def.name.slice(0, 6) : def.name}`, w / 2, h / 2 + 2);
      });
      plateTex.set(def.id, t);
    }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.17), new THREE.MeshBasicMaterial({ map: t }));
    m.position.set(0, y, z + 0.012);
    g.add(m);
    return m;
  }

  // 中空的櫃子（前面或上面開口），裡面的東西才看得到
  function shell(g, w, h, d, color, z, open = 'front', opts) {
    const t = 0.04;
    B(g, w, h, t, color, 0, 0, z - d / 2 + t / 2, opts); // 背板
    B(g, t, h, d, color, -w / 2 + t / 2, 0, z, opts);
    B(g, t, h, d, color, w / 2 - t / 2, 0, z, opts);
    B(g, w, t, d, color, 0, 0, z, opts); // 底
    if (open === 'front') B(g, w, t, d, color, 0, h - t, z, opts); // 頂
    else B(g, w, h, t, color, 0, 0, z + d / 2 - t / 2, opts); // 上面開口：前面要有面板
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

  const SPOT_NEIGHBORS = {
    nightmarket: [['夜市雞排王', '#d35400'], ['射氣球遊戲', '#8e44ad'], ['阿嬤古早味冰', '#16a085'], ['大腸包小腸', '#c0392b']],
    school: [['小天才補習班', '#2980b9'], ['安親班', '#27ae60'], ['文具大王', '#e67e22'], ['書局', '#8e44ad']],
    alley: [['巷口洗衣店', '#7f8c8d'], ['社區活動中心', '#16a085'], ['柑仔店', '#c0392b'], ['機車行', '#2c3e50']],
    office: [['影印輸出', '#34495e'], ['便利咖啡', '#6f4e37'], ['商務簡餐', '#c0392b'], ['銀行 ATM', '#1f6fb2']],
    mrt: [['捷運出口', '#0070bd'], ['連鎖藥妝', '#00b894'], ['手機殼專賣', '#e84393'], ['公車站', '#2d3436']],
    temple: [['香舖金紙', '#c0392b'], ['算命館', '#8e44ad'], ['素食麵館', '#27ae60'], ['佛具店', '#d4a017']],
  };

  // ───── 設備與家具模型（區域座標：+z 是正面，x 0～w-1 是佔的格子）─────
  // 小工具：球、甜甜圈、文字貼圖面板
  function S(g, r, color, x, y, z, sy = 1, opts) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 9), typeof color === 'string' ? mat(color, opts) : color);
    m.scale.y = sy;
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  }
  function T(g, r, tube, color, x, y, z, ry = 0) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 18), mat(color));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.castShadow = true;
    g.add(m);
    return m;
  }
  const textTex = new Map();
  function sign(g, text, bg, fg, w, h, x, y, z, ry = 0) {
    const key = text + bg + fg;
    let t = textTex.get(key);
    if (!t) {
      t = canvasTex(256, 128, (c, cw, ch) => {
        c.fillStyle = bg;
        c.fillRect(0, 0, cw, ch);
        c.fillStyle = fg;
        c.font = `bold ${text.length > 3 ? 54 : 78}px sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(text, cw / 2, ch / 2 + 4);
      });
      textTex.set(key, t);
    }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t }));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    g.add(m);
    return m;
  }
  // 小櫃台（大部分兼營業務的底座）
  const counter = (g, color, top = '#f6f1ea') => {
    B(g, 0.9, 0.8, 0.7, color, 0, 0, 0);
    B(g, 0.94, 0.04, 0.74, top, 0, 0.8, 0);
  };
  // 可躺的服務椅（掏耳朵、按摩、剪髮捐贈）
  const lounger = (g, color) => {
    B(g, 0.6, 0.4, 0.62, '#3a3a40', 0, 0, 0);
    B(g, 0.66, 0.1, 0.66, color, 0, 0.4, 0, { roughness: 0.5 });
    const back = B(g, 0.66, 0.6, 0.1, color, 0, 0.48, -0.3, { roughness: 0.5 });
    back.rotation.x = -0.35;
    for (const x of [-0.36, 0.36]) B(g, 0.08, 0.06, 0.5, '#2b2b30', x, 0.62, 0);
  };
  const parcels = (g, y0, cols = 3, rows = 3, z = -0.05) => {
    const cs = ['#c99a5b', '#d8b07a', '#b98a4f', '#e2c08d'];
    for (let r = 0; r < rows; r++) for (let i = 0; i < cols; i++) {
      const w = 0.2 + ((i + r) % 2) * 0.06;
      B(g, w, 0.16 + (i % 2) * 0.05, 0.22, cs[(i + r) % cs.length], -0.27 + i * 0.27, y0 + r * 0.32, z);
      B(g, 0.08, 0.05, 0.005, '#ffffff', -0.27 + i * 0.27, y0 + r * 0.32 + 0.06, z + 0.112);
    }
  };

  // ───── 兼營業務的專屬造型：一眼看得出在做什麼 ─────
  const SIDE_MODELS = {
    // 🏪 超商
    sb_parcel(g, def) {
      // 包裹櫃：三層架子堆滿紙箱，每箱都貼了單號
      for (const x of [-0.43, 0.43]) B(g, 0.04, 1.4, 0.4, '#7b828c', x, 0, -0.1);
      for (let r = 0; r < 4; r++) B(g, 0.9, 0.03, 0.4, '#9aa1a9', 0, 0.05 + r * 0.32, -0.1);
      parcels(g, 0.08, 3, 3, -0.1);
      B(g, 0.12, 0.2, 0.06, '#2b2b30', 0.32, 1.28, 0.05);
      plate(g, def, 1.45, 0.1);
    },
    sb_atm(g, def) {
      // ATM：藍色機台、螢幕、按鍵、出鈔口，頂上一塊 ATM 燈箱
      B(g, 0.66, 1.5, 0.55, '#2c6fbb', 0, 0, -0.1, { roughness: 0.4, metalness: 0.2 });
      B(g, 0.5, 0.36, 0.08, '#1d1d1d', 0, 0.95, 0.15).rotation.x = -0.2;
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.26), basic('#7fd3ff'));
      scr.position.set(0, 1.13, 0.2);
      scr.rotation.x = -0.2;
      g.add(scr);
      g.userData.screen = scr;
      B(g, 0.4, 0.04, 0.25, '#c9ced6', 0, 0.78, 0.25, { metalness: 0.6 });
      for (let i = 0; i < 9; i++) B(g, 0.06, 0.02, 0.05, '#f3f3f3', -0.08 + (i % 3) * 0.08, 0.82, 0.18 + Math.floor(i / 3) * 0.06);
      B(g, 0.3, 0.03, 0.02, '#1d1d1d', 0, 0.62, 0.18);
      sign(g, 'ATM', '#ffffff', '#2c6fbb', 0.6, 0.22, 0, 1.62, 0.18);
    },
    sb_copy(g, def) {
      // 影印機：灰色機身、上蓋、出紙匣上有一疊紙
      B(g, 0.8, 0.85, 0.6, '#d8dde3', 0, 0, -0.05);
      B(g, 0.8, 0.06, 0.6, '#9aa1a9', 0, 0.85, -0.05);
      B(g, 0.2, 0.08, 0.14, '#2b2b30', 0.25, 0.91, 0.12);
      B(g, 0.4, 0.04, 0.3, '#f7f7f2', -0.2, 0.55, 0.38);
      for (let i = 0; i < 4; i++) B(g, 0.36, 0.008, 0.26, '#ffffff', -0.2, 0.6 + i * 0.012, 0.38);
      B(g, 0.1, 0.03, 0.04, basic('#5fd3a0'), 0.25, 0.99, 0.16);
      plate(g, def, 0.35, 0.26);
    },
    sb_hotdog(g, def) {
      // 熱狗機：不鏽鋼底座＋一排滾動的熱狗，外面一圈玻璃罩
      counter(g, '#d9482b');
      B(g, 0.8, 0.08, 0.5, '#c9ced6', 0, 0.84, 0, { metalness: 0.7 });
      const dogs = [];
      for (let i = 0; i < 6; i++) {
        const d = C(g, 0.035, 0.035, 0.42, '#b5562a', 0, 0.97, -0.18 + i * 0.07, 10);
        d.rotation.z = Math.PI / 2;
        d.position.set(0, 0.96, -0.18 + i * 0.07);
        dogs.push(d);
      }
      B(g, 0.84, 0.3, 0.54, basic('#dff3ff', { transparent: true, opacity: 0.3 }), 0, 0.92, 0);
      sign(g, '熱狗', '#f2c14e', '#d9482b', 0.5, 0.2, 0, 1.4, -0.2);
      g.userData.steam = [new THREE.Vector3(0, 1.1, 0)];
      plate(g, def, 0.42, 0.36);
    },
    sb_kiosk(g, def) {
      // 多媒體機：直立機台、大螢幕、下面出單口
      B(g, 0.6, 1.55, 0.45, '#8e44ad', 0, 0, -0.12, { roughness: 0.4 });
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.5), basic('#f2e6ff'));
      scr.position.set(0, 1.1, 0.105);
      g.add(scr);
      g.userData.screen = scr;
      B(g, 0.3, 0.04, 0.05, '#1d1d1d', 0, 0.72, 0.11);
      B(g, 0.24, 0.005, 0.12, '#ffffff', 0, 0.68, 0.16);
      sign(g, '繳費售票', '#ffffff', '#8e44ad', 0.56, 0.16, 0, 1.63, 0.105);
    },
    sb_power(g, def) {
      // 行動電源租借站：一排插槽，每格亮綠燈
      B(g, 0.7, 1.2, 0.3, '#2f8f6b', 0, 0.2, -0.25, { roughness: 0.4 });
      B(g, 0.12, 0.2, 0.12, '#2b2b30', 0, 0, -0.25);
      for (let r = 0; r < 4; r++) for (let i = 0; i < 3; i++) {
        B(g, 0.16, 0.18, 0.04, '#1d1d1d', -0.2 + i * 0.2, 0.35 + r * 0.24, -0.08);
        B(g, 0.03, 0.03, 0.01, basic(r === 3 && i === 1 ? '#ff4d4d' : '#5fff8a'), -0.2 + i * 0.2 + 0.05, 0.47 + r * 0.24, -0.055);
      }
      sign(g, '🔋租借', '#ffffff', '#2f8f6b', 0.5, 0.16, 0, 1.5, -0.09);
    },
    sb_lotto(g, def) {
      // 彩券行：紅色櫃台、大大的「彩」字招牌、一疊彩券
      counter(g, '#c0392b', '#fff3c4');
      sign(g, '彩', '#d9302b', '#ffe066', 0.4, 0.4, 0, 1.4, -0.25);
      B(g, 0.03, 0.55, 0.03, '#555', 0, 0.84, -0.27);
      for (let i = 0; i < 5; i++) {
        const t = B(g, 0.12, 0.005, 0.18, ['#f2c14e', '#ffffff', '#e74c3c', '#2ecc71', '#3498db'][i], -0.3 + i * 0.15, 0.84 + i * 0.002, 0.15);
        t.rotation.y = (i - 2) * 0.2;
      }
      C(g, 0.06, 0.06, 0.12, '#2b2b30', 0.3, 0.84, -0.1, 10);
      plate(g, def, 0.42, 0.36);
    },
    sb_laundry(g, def) {
      // 投幣洗衣：上下兩台機器，圓形玻璃門，旁邊投幣孔
      for (const [y, c] of [[0, '#f3f3f3'], [0.8, '#e8edf2']]) {
        B(g, 0.8, 0.78, 0.65, c, 0, y, -0.05);
        const door = new THREE.Mesh(new THREE.CircleGeometry(0.22, 24), basic('#9fc7e6'));
        door.position.set(-0.05, y + 0.38, 0.28);
        g.add(door);
        T(g, 0.22, 0.025, '#9aa1a9', -0.05, y + 0.38, 0.28);
        B(g, 0.08, 0.14, 0.02, '#2b2b30', 0.3, y + 0.5, 0.275);
      }
      plate(g, def, 1.62, 0.28);
    },
    // 🍳 早餐店
    sb_parcelb(g, def) {
      // 代收包裹：小鐵架上幾箱包裹，旁邊夾著簽收單
      for (const x of [-0.43, 0.43]) B(g, 0.04, 1.0, 0.4, '#7b828c', x, 0, -0.1);
      for (let r = 0; r < 3; r++) B(g, 0.9, 0.03, 0.4, '#9aa1a9', 0, 0.05 + r * 0.32, -0.1);
      parcels(g, 0.08, 3, 2, -0.1);
      B(g, 0.2, 0.28, 0.02, '#8a5a3b', 0.32, 0.72, 0.11);
      B(g, 0.16, 0.22, 0.005, '#ffffff', 0.32, 0.74, 0.122);
      plate(g, def, 1.05, 0.1);
    },
    sb_lunchbox(g, def) {
      // 便當：一疊疊的便當盒（看得到飯菜）＋一鍋大電鍋
      counter(g, '#e67e22');
      for (let i = 0; i < 4; i++) {
        const x = -0.3 + (i % 2) * 0.22;
        const y = 0.84 + Math.floor(i / 2) * 0.08;
        B(g, 0.2, 0.07, 0.16, '#2b2b30', x, y, 0.1);
        B(g, 0.08, 0.01, 0.12, '#ffffff', x - 0.04, y + 0.07, 0.1);
        B(g, 0.07, 0.012, 0.12, ['#c97b2c', '#5aa04a'][i % 2], x + 0.05, y + 0.07, 0.1);
      }
      C(g, 0.17, 0.17, 0.3, '#f3f3f3', 0.2, 0.84, -0.12, 18);
      C(g, 0.15, 0.17, 0.06, '#e74c3c', 0.2, 1.14, -0.12, 18);
      g.userData.steam = [new THREE.Vector3(0.2, 1.3, -0.12)];
      plate(g, def, 0.42, 0.36);
    },
    sb_pourover(g, def) {
      // 手沖咖啡：木吧台上兩組濾杯架、細口壺、玻璃分享壺
      counter(g, '#6b4a32', '#d9b48c');
      for (const x of [-0.22, 0.08]) {
        B(g, 0.02, 0.3, 0.02, '#2b2b30', x, 0.84, -0.05);
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.12, 14, 1, true), mat('#ffffff', { side: THREE.DoubleSide }));
        cone.rotation.x = Math.PI;
        cone.position.set(x, 1.12, 0.02);
        g.add(cone);
        C(g, 0.06, 0.07, 0.12, basic('#dff3ff', { transparent: true, opacity: 0.5 }), x, 0.84, 0.02, 14);
        C(g, 0.055, 0.055, 0.05, '#4a2c1a', x, 0.85, 0.02, 12);
      }
      C(g, 0.07, 0.08, 0.16, '#c9ced6', 0.32, 0.84, 0.05, 14, { metalness: 0.8 });
      const spout = C(g, 0.012, 0.012, 0.2, '#c9ced6', 0.24, 0.94, 0.05, 8, { metalness: 0.8 });
      spout.rotation.z = 0.9;
      plate(g, def, 0.42, 0.36);
    },
    sb_kidsbrunch(g, def) {
      // 親子早午餐：粉彩色的小桌、小椅子，桌上有鬆餅，旁邊一顆氣球
      B(g, 0.7, 0.04, 0.6, '#ffd6e7', 0, 0.45, 0);
      for (const [x, z] of [[-0.3, -0.25], [0.3, -0.25], [-0.3, 0.25], [0.3, 0.25]]) B(g, 0.04, 0.45, 0.04, '#f4a3c0', x, 0, z);
      for (const [x, c] of [[-0.42, '#9ad1f5'], [0.42, '#ffe066']]) {
        B(g, 0.18, 0.25, 0.18, c, x, 0, 0.3);
      }
      C(g, 0.1, 0.1, 0.03, '#d9a35a', -0.1, 0.49, 0, 14);
      C(g, 0.1, 0.1, 0.03, '#e8b56b', -0.1, 0.52, 0, 14);
      S(g, 0.04, '#e74c3c', -0.08, 0.57, 0.02);
      C(g, 0.05, 0.04, 0.1, '#ffffff', 0.15, 0.49, 0.05, 10);
      B(g, 0.12, 0.12, 0.12, '#2c6fbb', 0.2, 0, -0.32);
      B(g, 0.1, 0.1, 0.1, '#e74c3c', 0.22, 0.12, -0.32);
      B(g, 0.005, 0.8, 0.005, '#555', 0.38, 0.45, -0.25);
      S(g, 0.12, '#e0478a', 0.38, 1.35, -0.25, 1.2);
      plate(g, def, 0.25, 0.32);
    },
    // 🍜 麵店
    sb_luwei(g, def) {
      // 外帶滷味攤：有輪子的小推車，一格格的竹籃，旁邊一鍋滷汁
      B(g, 0.9, 0.7, 0.6, '#8e5a2b', 0, 0.12, 0);
      for (const x of [-0.35, 0.35]) {
        const w = C(g, 0.12, 0.12, 0.05, '#1d1d1d', x, 0.06, 0.3, 12);
        w.rotation.x = Math.PI / 2;
        w.position.set(x, 0.12, 0.3);
      }
      const cs = ['#7a4a25', '#e8c25a', '#5aa04a', '#c97b2c', '#3a2c25', '#f3e0c4'];
      for (let i = 0; i < 6; i++) {
        const x = -0.3 + (i % 3) * 0.24;
        const z = -0.1 + Math.floor(i / 3) * 0.22;
        C(g, 0.1, 0.08, 0.06, '#c9a36b', x, 0.82, z, 12);
        S(g, 0.05, cs[i], x, 0.9, z, 0.6);
      }
      C(g, 0.12, 0.12, 0.14, '#2b2b30', 0.32, 0.82, 0.12, 14);
      C(g, 0.11, 0.11, 0.01, '#5a3218', 0.32, 0.96, 0.12, 14);
      B(g, 0.9, 0.04, 0.6, '#d9302b', 0, 1.5, 0);
      for (const x of [-0.42, 0.42]) B(g, 0.03, 0.68, 0.03, '#555', x, 0.82, -0.27);
      g.userData.steam = [new THREE.Vector3(0.32, 1.05, 0.12)];
      plate(g, def, 0.35, 0.31);
    },
    sb_bentob(g, def) {
      // 便當外帶：架上一排排綁好橡皮筋的便當，櫃台上一袋袋團訂
      counter(g, '#e67e22');
      for (let r = 0; r < 3; r++) for (let i = 0; i < 3; i++) {
        B(g, 0.22, 0.07, 0.17, '#f7f1e3', -0.27 + i * 0.27, 0.84 + r * 0.08, -0.12);
        B(g, 0.23, 0.01, 0.02, '#e74c3c', -0.27 + i * 0.27, 0.88 + r * 0.08, -0.12);
      }
      for (let i = 0; i < 2; i++) B(g, 0.2, 0.24, 0.12, '#f7f7f2', -0.15 + i * 0.3, 0.84, 0.2);
      plate(g, def, 0.42, 0.36);
    },
    sb_dumpling(g, def) {
      // 冷凍水餃：冷凍櫃上一包包白色的水餃，旁邊立一塊「團購取貨」牌
      shell(g, 0.9, 0.75, 0.65, '#2c6fbb', 0, 'top');
      B(g, 0.84, 0.02, 0.58, basic('#cfe8ff', { transparent: true, opacity: 0.4 }), 0, 0.76, 0);
      for (let i = 0; i < 6; i++) {
        const x = -0.27 + (i % 3) * 0.27;
        const z = -0.12 + Math.floor(i / 3) * 0.25;
        B(g, 0.22, 0.08, 0.18, '#f7f7f2', x, 0.62, z);
        for (let k = 0; k < 2; k++) S(g, 0.04, '#fffaf0', x - 0.04 + k * 0.08, 0.72, z, 0.6);
      }
      B(g, 0.03, 0.55, 0.03, '#555', 0.4, 0.75, -0.3);
      sign(g, '團購取貨', '#ffffff', '#2c6fbb', 0.5, 0.16, 0.3, 1.32, -0.28);
      plate(g, def, 0.25, 0.34);
    },
    sb_newyear(g, def) {
      // 年菜代訂：紅色櫃台上疊著綁金色緞帶的禮盒，上面掛一對春聯
      counter(g, '#c0392b', '#f7e3b0');
      for (let i = 0; i < 3; i++) {
        const y = 0.84 + i * 0.13;
        B(g, 0.42 - i * 0.08, 0.12, 0.32 - i * 0.04, '#d9302b', -0.05, y, 0);
        B(g, 0.43 - i * 0.08, 0.125, 0.04, '#f2c14e', -0.05, y, 0);
      }
      sign(g, '年菜', '#d9302b', '#ffe066', 0.36, 0.3, 0.3, 1.25, -0.25);
      S(g, 0.08, '#d9302b', 0.3, 1.55, -0.2, 1.2);
      plate(g, def, 0.42, 0.36);
    },
    // 🧋 飲料店
    sb_chicken(g, def) {
      // 雞排炸物：油炸鍋、炸籃，保溫燈下面擺著金黃色的大雞排
      counter(g, '#c9ced6', '#9aa1a9');
      B(g, 0.4, 0.12, 0.4, '#2b2b30', -0.2, 0.84, 0);
      B(g, 0.36, 0.02, 0.36, '#d4a017', -0.2, 0.94, 0);
      B(g, 0.2, 0.1, 0.2, '#9aa1a9', -0.2, 0.97, 0, { metalness: 0.7 });
      B(g, 0.03, 0.03, 0.25, '#2b2b30', -0.2, 1.1, 0.12);
      for (let i = 0; i < 2; i++) {
        const cut = B(g, 0.22, 0.03, 0.17, '#d9902a', 0.25, 0.84 + i * 0.035, -0.05 + i * 0.08);
        cut.rotation.y = 0.3 * i;
      }
      B(g, 0.4, 0.04, 0.2, '#555', 0.25, 1.35, 0);
      B(g, 0.36, 0.02, 0.16, basic('#ff9a3c'), 0.25, 1.33, 0);
      B(g, 0.03, 0.5, 0.03, '#555', 0.42, 0.84, -0.08);
      sign(g, '雞排', '#d4a017', '#5a2a0a', 0.4, 0.2, 0, 1.6, -0.2);
      g.userData.steam = [new THREE.Vector3(-0.2, 1.05, 0)];
      plate(g, def, 0.42, 0.36);
    },
    sb_dessert(g, def) {
      // 甜點冰品：玻璃冰櫃裡擺著一碗碗剉冰（上面有紅豆、芒果）
      shell(g, 0.9, 0.75, 0.65, '#f4a3c0', 0, 'top');
      B(g, 0.84, 0.25, 0.58, basic('#dff3ff', { transparent: true, opacity: 0.3 }), 0, 0.75, 0);
      const tops = ['#a0332f', '#f39c12', '#7dbb48', '#e74c3c'];
      for (let i = 0; i < 4; i++) {
        const x = -0.2 + (i % 2) * 0.4;
        const z = -0.12 + Math.floor(i / 2) * 0.25;
        C(g, 0.11, 0.08, 0.06, '#ffffff', x, 0.62, z, 14);
        S(g, 0.1, '#f7fbff', x, 0.72, z, 0.8);
        S(g, 0.05, tops[i], x, 0.8, z, 0.6);
      }
      plate(g, def, 0.25, 0.34);
    },
    sb_fruit(g, def) {
      // 現切水果杯：冷藏台上一排透明杯，看得到西瓜、芒果、芭樂丁
      counter(g, '#2f8f6b');
      const cs = ['#e74c3c', '#f39c12', '#7dbb48', '#f4d03f', '#e0478a', '#f39c12'];
      for (let i = 0; i < 6; i++) {
        const x = -0.3 + (i % 3) * 0.3;
        const z = -0.1 + Math.floor(i / 3) * 0.22;
        C(g, 0.065, 0.055, 0.18, basic('#ffffff', { transparent: true, opacity: 0.45 }), x, 0.84, z, 12);
        for (let k = 0; k < 3; k++) B(g, 0.05, 0.05, 0.05, cs[(i + k) % cs.length], x - 0.02 + (k % 2) * 0.03, 0.86 + k * 0.05, z);
      }
      S(g, 0.16, '#2e8b57', 0.3, 1.2, -0.22, 0.8);
      B(g, 0.32, 0.005, 0.32, '#e74c3c', 0.3, 1.1, -0.22);
      plate(g, def, 0.42, 0.36);
    },
    sb_merch(g, def) {
      // 聯名周邊：展示架上擺著玩偶和鑰匙圈，牆上一張海報
      shell(g, 0.85, 1.5, 0.42, '#8e44ad', -0.12);
      const cs = ['#ffe066', '#f4a3c0', '#9ad1f5', '#7dbb48'];
      for (let r = 0; r < 2; r++) {
        B(g, 0.8, 0.03, 0.38, '#d8cfc2', 0, 0.4 + r * 0.5, -0.1);
        for (let i = 0; i < 3; i++) {
          const x = -0.25 + i * 0.25;
          S(g, 0.08, cs[(i + r) % 4], x, 0.53 + r * 0.5, -0.05);
          S(g, 0.055, cs[(i + r) % 4], x, 0.66 + r * 0.5, -0.05);
          S(g, 0.02, cs[(i + r + 1) % 4], x - 0.04, 0.72 + r * 0.5, -0.05);
          S(g, 0.02, cs[(i + r + 1) % 4], x + 0.04, 0.72 + r * 0.5, -0.05);
        }
      }
      sign(g, '聯名限定', '#ffe066', '#8e44ad', 0.6, 0.18, 0, 1.3, -0.3);
      plate(g, def, 0.2, 0.1);
    },
    // 💈 理髮店
    sb_ear(g, def) {
      // 掏耳朵：躺椅＋一盞立燈＋工具盤（一支支耳挖）
      lounger(g, '#c97b2c');
      B(g, 0.03, 1.3, 0.03, '#2b2b30', -0.4, 0, -0.35);
      const lamp = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.12, 14, 1, true), mat('#f2c14e', { side: THREE.DoubleSide }));
      lamp.position.set(-0.3, 1.3, -0.25);
      lamp.rotation.z = -0.8;
      g.add(lamp);
      S(g, 0.04, basic('#fff3c4'), -0.27, 1.25, -0.23);
      B(g, 0.2, 0.6, 0.2, '#d8d8d8', 0.42, 0, 0.3);
      B(g, 0.22, 0.02, 0.18, '#f3f3f3', 0.42, 0.6, 0.3);
      for (let i = 0; i < 4; i++) B(g, 0.01, 0.01, 0.14, '#c9a36b', 0.36 + i * 0.04, 0.63, 0.3);
      plate(g, def, 0.22, 0.32);
    },
    sb_shampoo(g, def) {
      // 洗髮精、髮蠟：櫃台上一座洗髮精瓶子疊成的金字塔，旁邊一排髮蠟罐
      counter(g, '#5aa9a0');
      const cs = ['#5aa9a0', '#2c6fbb', '#e0478a'];
      let k = 0;
      for (let r = 0; r < 3; r++) for (let i = 0; i < 3 - r; i++) C(g, 0.05, 0.05, 0.2, cs[k++ % 3], -0.25 + i * 0.12 + r * 0.06, 0.84 + r * 0.2, -0.05, 12);
      for (let i = 0; i < 4; i++) C(g, 0.045, 0.045, 0.05, '#2b2b30', 0.15 + (i % 2) * 0.12, 0.84, 0.05 + Math.floor(i / 2) * 0.12, 12);
      sign(g, '專業髮品', '#ffffff', '#2c6fbb', 0.5, 0.16, 0, 1.55, -0.3);
      plate(g, def, 0.42, 0.36);
    },
    sb_massage(g, def) {
      // 肩頸按摩：有洞的按摩床，上面摺一條毛巾，旁邊放精油
      B(g, 0.6, 0.55, 0.85, '#d8d8d8', 0, 0, 0);
      B(g, 0.64, 0.12, 0.88, '#6c5ce7', 0, 0.55, 0, { roughness: 0.6 });
      C(g, 0.08, 0.08, 0.13, '#2b2b30', 0, 0.55, -0.3, 14);
      B(g, 0.4, 0.06, 0.2, '#ffffff', 0, 0.67, 0.25);
      C(g, 0.04, 0.04, 0.12, '#c97b2c', 0.38, 0.55, 0.38, 10);
      plate(g, def, 0.3, 0.44);
    },
    sb_donate(g, def) {
      // 剪髮捐贈：粉紅緞帶椅＋透明箱裡一束束綁好的長髮
      lounger(g, '#e0478a');
      B(g, 0.3, 0.35, 0.25, basic('#ffffff', { transparent: true, opacity: 0.4 }), 0.42, 0.55, 0.3);
      for (let i = 0; i < 3; i++) {
        const h = B(g, 0.04, 0.25, 0.04, ['#3a2c25', '#6b4430', '#1d1d1d'][i], 0.34 + i * 0.08, 0.57, 0.3);
        h.rotation.z = 0.3;
      }
      B(g, 0.2, 0.55, 0.2, '#d8d8d8', 0.42, 0, 0.3);
      S(g, 0.06, '#e0478a', -0.42, 1.0, -0.3);
      plate(g, def, 0.22, 0.32);
    },
    sb_pet(g, def) {
      // 寵物修剪：美容桌、吊臂，桌上站著一隻毛茸茸的小狗
      B(g, 0.8, 0.06, 0.55, '#d4a017', 0, 0.75, 0);
      for (const [x, z] of [[-0.35, -0.22], [0.35, -0.22], [-0.35, 0.22], [0.35, 0.22]]) B(g, 0.04, 0.75, 0.04, '#9aa1a9', x, 0, z, { metalness: 0.6 });
      B(g, 0.03, 0.8, 0.03, '#9aa1a9', -0.38, 0.81, -0.25, { metalness: 0.7 });
      B(g, 0.35, 0.03, 0.03, '#9aa1a9', -0.22, 1.58, -0.25, { metalness: 0.7 });
      S(g, 0.14, '#f3e0c4', 0, 0.97, 0, 0.75);
      S(g, 0.1, '#f3e0c4', 0.17, 1.1, 0);
      S(g, 0.04, '#7a4a25', 0.2, 1.2, -0.06);
      S(g, 0.04, '#7a4a25', 0.2, 1.2, 0.06);
      S(g, 0.025, '#1d1d1d', 0.27, 1.1, 0);
      for (const [x, z] of [[-0.08, -0.07], [0.08, -0.07], [-0.08, 0.07], [0.08, 0.07]]) B(g, 0.04, 0.12, 0.04, '#f3e0c4', x, 0.81, z);
      plate(g, def, 0.45, 0.28);
    },
    // 🛵 機車行
    sb_gear(g, def) {
      // 雨衣安全帽：衣架上掛著彩色雨衣，下面一排安全帽
      for (const x of [-0.4, 0.4]) B(g, 0.04, 1.6, 0.04, '#555b66', x, 0, -0.15);
      B(g, 0.84, 0.04, 0.04, '#555b66', 0, 1.55, -0.15);
      const cs = ['#f2c14e', '#2c6fbb', '#e74c3c', '#2f8f6b'];
      for (let i = 0; i < 4; i++) {
        const c = B(g, 0.17, 0.75, 0.05, cs[i], -0.27 + i * 0.18, 0.78, -0.12);
        c.rotation.x = 0.08;
      }
      B(g, 0.84, 0.04, 0.4, '#7b828c', 0, 0.35, -0.05);
      for (let i = 0; i < 3; i++) {
        const h = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(cs[(i + 1) % 4]));
        h.position.set(-0.27 + i * 0.27, 0.39, -0.02);
        h.castShadow = true;
        g.add(h);
      }
      plate(g, def, 0.15, 0.16);
    },
    sb_inspect(g, def) {
      // 代辦驗車過戶：辦公桌、一疊文件、印章、檔案夾
      B(g, 0.85, 0.04, 0.6, '#8a5a3b', 0, 0.72, 0);
      for (const x of [-0.38, 0.38]) B(g, 0.06, 0.72, 0.55, '#6b4430', x, 0, 0);
      for (let i = 0; i < 5; i++) B(g, 0.22, 0.012, 0.3, i % 2 ? '#ffffff' : '#f7f1e3', -0.2, 0.76 + i * 0.013, 0.05);
      C(g, 0.03, 0.03, 0.08, '#d9302b', 0.05, 0.76, 0.12, 10);
      for (let i = 0; i < 3; i++) B(g, 0.06, 0.24, 0.2, ['#2c6fbb', '#e74c3c', '#f2c14e'][i], 0.2 + i * 0.07, 0.76, -0.18);
      sign(g, '代辦', '#ffffff', '#2c6fbb', 0.36, 0.2, 0, 1.3, -0.3);
      B(g, 0.03, 0.55, 0.03, '#555', 0, 0.76, -0.31);
      plate(g, def, 0.45, 0.31);
    },
    sb_wash(g, def) {
      // 機車美容：紅色高壓清洗機、捲起來的水管、一桶泡沫
      B(g, 0.4, 0.5, 0.35, '#d9482b', -0.15, 0.08, 0);
      for (const z of [-0.15, 0.15]) {
        const w = C(g, 0.08, 0.08, 0.04, '#1d1d1d', -0.15, 0, z, 12);
        w.rotation.x = Math.PI / 2;
        w.position.set(-0.15, 0.08, z * 1.3);
      }
      T(g, 0.12, 0.025, '#2b2b30', -0.15, 0.72, 0.05);
      B(g, 0.04, 0.4, 0.04, '#9aa1a9', 0.15, 0.25, 0.2, { metalness: 0.7 });
      C(g, 0.13, 0.11, 0.25, '#2c6fbb', 0.25, 0, -0.2, 14);
      for (let i = 0; i < 4; i++) S(g, 0.06 + (i % 2) * 0.02, '#ffffff', 0.22 + (i - 1.5) * 0.05, 0.3 + (i % 2) * 0.04, -0.2, 1, { roughness: 0.2 });
      plate(g, def, 0.35, 0.18);
    },
    sb_used(g, def) {
      // 二手車買賣：展示台上一台機車，掛著大大的價格牌
      B(g, 0.9, 0.08, 0.9, '#7b828c', 0, 0, 0);
      B(g, 0.22, 0.25, 0.75, '#d9482b', 0, 0.3, 0);
      B(g, 0.2, 0.1, 0.4, '#2b2b30', 0, 0.55, -0.1);
      B(g, 0.25, 0.4, 0.06, '#d9482b', 0, 0.3, 0.33);
      B(g, 0.4, 0.03, 0.03, '#2b2b30', 0, 0.72, 0.33);
      for (const z of [-0.32, 0.32]) {
        const w = C(g, 0.15, 0.15, 0.06, '#1d1d1d', 0, 0.08, z, 14);
        w.rotation.z = Math.PI / 2;
        w.position.set(0, 0.23, z);
      }
      sign(g, '$38,000', '#f2c14e', '#d9302b', 0.45, 0.2, 0.3, 0.75, 0.35);
      plate(g, def, 0.08, 0.46);
    },
    sb_rent(g, def) {
      // 機車出租：牆上的鑰匙板，一支支鑰匙掛好，旁邊一頂租用安全帽
      B(g, 0.8, 0.9, 0.05, '#8a5a3b', 0, 0.6, -0.3);
      for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) {
        B(g, 0.01, 0.05, 0.03, '#9aa1a9', -0.27 + i * 0.18, 1.32 - r * 0.25, -0.26);
        B(g, 0.06, 0.04, 0.02, ['#e74c3c', '#2c6fbb', '#f2c14e', '#2f8f6b'][(i + r) % 4], -0.27 + i * 0.18, 1.24 - r * 0.25, -0.26);
      }
      B(g, 0.6, 0.6, 0.4, '#f2c14e', 0, 0, 0);
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#2c6fbb'));
      h.position.set(0.15, 0.6, 0);
      g.add(h);
      sign(g, '租車', '#ffffff', '#e2a12a', 0.36, 0.18, 0, 1.62, -0.27);
      plate(g, def, 0.3, 0.21);
    },
    sb_swap(g, def) {
      // 電池交換站：高高的機櫃，四格電池倉亮著綠燈
      B(g, 0.6, 1.7, 0.45, '#2f8f6b', 0, 0, -0.1, { roughness: 0.4 });
      for (let i = 0; i < 4; i++) {
        B(g, 0.22, 0.28, 0.03, '#1d1d1d', -0.13 + (i % 2) * 0.26, 0.3 + Math.floor(i / 2) * 0.36, 0.13);
        B(g, 0.12, 0.03, 0.01, basic(i === 3 ? '#f2c14e' : '#5fff8a'), -0.13 + (i % 2) * 0.26, 0.52 + Math.floor(i / 2) * 0.36, 0.15);
      }
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.24), basic('#bff5d6'));
      scr.position.set(0, 1.25, 0.126);
      g.add(scr);
      g.userData.screen = scr;
      sign(g, '換電', '#ffffff', '#2f8f6b', 0.4, 0.18, 0, 1.55, 0.126);
    },
  };

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
      // 兼營業務有專屬造型就用專屬的
      if (def && SIDE_MODELS[def.side]) return SIDE_MODELS[def.side](g, def);
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

    // ───── 生財器具的專屬造型：一眼看得出是什麼 ─────
    // 每一種都有自己的外型（鍋就是鍋、輪胎機上面有輪胎），前面再貼一塊小名牌
    teppanStove(g, view, def) {
      B(g, 0.9, 0.8, 0.7, '#b8bec6', 0, 0, 0, { metalness: 0.6, roughness: 0.35 });
      B(g, 0.84, 0.05, 0.6, '#1d1d1f', 0, 0.8, -0.02, { metalness: 0.5, roughness: 0.4 });
      // 兩盤滋滋作響的鐵板麵（黑色鐵盤＋黃色麵＋荷包蛋）
      for (const x of [-0.2, 0.2]) {
        C(g, 0.17, 0.17, 0.03, '#2b2b30', x, 0.85, 0, 18, { metalness: 0.6 });
        C(g, 0.13, 0.13, 0.05, '#e8c25a', x, 0.87, 0, 14);
        C(g, 0.05, 0.05, 0.02, '#ffffff', x + 0.05, 0.92, 0.03, 10);
        C(g, 0.025, 0.025, 0.02, '#f2a516', x + 0.05, 0.935, 0.03, 8);
      }
      B(g, 0.05, 0.02, 0.25, '#9aa1a9', 0.38, 0.85, 0.1, { metalness: 0.7 });
      g.userData.steam = [new THREE.Vector3(-0.2, 1.0, 0), new THREE.Vector3(0.2, 1.0, 0)];
      plate(g, def, 0.45, 0.36);
    },
    toaster(g, view, def) {
      B(g, 0.9, 0.78, 0.7, '#e9d8c3', 0, 0, 0);
      // 不鏽鋼烤箱：玻璃門裡面亮著橘光
      B(g, 0.66, 0.42, 0.5, '#c9ced6', 0, 0.78, -0.05, { metalness: 0.7, roughness: 0.3 });
      B(g, 0.46, 0.24, 0.02, basic('#ff9a3c'), -0.06, 0.86, 0.21);
      for (let i = 0; i < 3; i++) C(g, 0.025, 0.025, 0.03, '#2b2b30', 0.24, 0.88 + i * 0.1, 0.21, 8).rotation.x = Math.PI / 2;
      // 上面兩片烤好的吐司
      for (const x of [-0.12, 0.12]) {
        B(g, 0.2, 0.03, 0.2, '#d9a35a', x, 1.2, 0);
        B(g, 0.18, 0.031, 0.18, '#f2d49b', x, 1.2, 0);
      }
      plate(g, def, 0.42, 0.36);
    },
    soyMachine(g, view, def) {
      B(g, 0.9, 0.8, 0.7, '#e9d8c3', 0, 0, 0);
      // 高高的不鏽鋼磨豆機＋一壺白白的豆漿＋一碗黃豆
      C(g, 0.15, 0.17, 0.62, '#c9ced6', -0.18, 0.8, -0.08, 18, { metalness: 0.7, roughness: 0.3 });
      C(g, 0.18, 0.12, 0.12, '#c9ced6', -0.18, 1.42, -0.08, 18, { metalness: 0.7 });
      C(g, 0.11, 0.1, 0.28, basic('#f7f3e8', { transparent: true, opacity: 0.9 }), 0.2, 0.8, 0.08, 16);
      C(g, 0.13, 0.1, 0.07, '#8a5a3b', 0.2, 0.8, -0.2, 14);
      for (let i = 0; i < 5; i++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), mat('#e2c46b'));
        b.position.set(0.15 + (i % 3) * 0.05, 0.88, -0.22 + Math.floor(i / 3) * 0.05);
        g.add(b);
      }
      plate(g, def, 0.45, 0.36);
    },
    pickupWindow(g, view, def) {
      // 外帶窗口：一個有條紋遮雨棚的小窗框，台面上擺著外帶袋
      B(g, 0.9, 0.9, 0.5, '#f3efe8', 0, 0, -0.1);
      for (const x of [-0.42, 0.42]) B(g, 0.06, 1.0, 0.06, '#8a5a3b', x, 0.9, 0.12);
      B(g, 0.9, 0.08, 0.06, '#8a5a3b', 0, 1.9, 0.12);
      const awn = canvasTex(128, 32, (c, w, h) => {
        for (let i = 0; i < 8; i++) {
          c.fillStyle = i % 2 ? '#ffffff' : '#d9482b';
          c.fillRect((i * w) / 8, 0, w / 8, h);
        }
      });
      const a = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.35), new THREE.MeshStandardMaterial({ map: awn, side: THREE.DoubleSide }));
      a.position.set(0, 1.85, 0.3);
      a.rotation.x = -0.9;
      g.add(a);
      for (let i = 0; i < 3; i++) B(g, 0.16, 0.2, 0.1, '#f7f7f2', -0.25 + i * 0.25, 0.9, 0.08);
      C(g, 0.05, 0.04, 0.16, '#c58b54', 0.32, 0.9, -0.15, 10);
      plate(g, def, 0.45, 0.16);
    },
    eggFridge(g, view, def) {
      // 玻璃門冷藏架：看得到一盤一盤的雞蛋
      shell(g, 0.8, 1.7, 0.6, '#e8edf2', -0.05);
      B(g, 0.7, 1.45, 0.02, basic('#dff3ff', { transparent: true, opacity: 0.35 }), 0, 0.15, 0.26);
      for (let r = 0; r < 3; r++) {
        B(g, 0.66, 0.03, 0.45, '#c9a36b', 0, 0.3 + r * 0.45, -0.05);
        for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
          const e = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), mat(r === 1 ? '#f3e0c4' : '#fffaf0'));
          e.scale.y = 1.25;
          e.position.set(-0.22 + i * 0.15, 0.39 + r * 0.45, -0.12 + j * 0.15);
          g.add(e);
        }
      }
      plate(g, def, 1.55, 0.27);
    },
    stockPot(g, view, def) {
      // 爐架上一口超大的高湯鍋，湯是褐色的，還插著一支大湯勺
      B(g, 0.85, 0.42, 0.7, '#3a3a40', 0, 0, 0, { metalness: 0.5 });
      C(g, 0.33, 0.33, 0.06, '#1d1d1f', 0, 0.42, 0, 20);
      C(g, 0.34, 0.32, 0.62, '#c9ced6', 0, 0.48, 0, 24, { metalness: 0.8, roughness: 0.25 });
      C(g, 0.31, 0.31, 0.02, '#7a4a25', 0, 1.06, 0, 24);
      for (const x of [-0.38, 0.38]) B(g, 0.08, 0.05, 0.12, '#9aa1a9', x, 0.95, 0, { metalness: 0.7 });
      const ladle = B(g, 0.04, 0.7, 0.04, '#9aa1a9', 0.12, 0.9, 0.05, { metalness: 0.7 });
      ladle.rotation.z = -0.4;
      g.userData.steam = [new THREE.Vector3(-0.1, 1.2, 0), new THREE.Vector3(0.12, 1.2, 0.05)];
      plate(g, def, 0.2, 0.36);
    },
    luweiCase(g, view, def) {
      // 滷味櫃：玻璃櫃裡一格一格的滷味，上面掛紅色燈籠招牌
      B(g, 0.9, 0.7, 0.7, '#8e5a2b', 0, 0, 0);
      B(g, 0.86, 0.4, 0.6, basic('#fff1c9', { transparent: true, opacity: 0.4 }), 0, 0.7, 0);
      const cs = ['#7a4a25', '#c97b2c', '#3a2c25', '#e8c25a', '#5aa04a', '#a0522d'];
      for (let i = 0; i < 6; i++) {
        const x = -0.28 + (i % 3) * 0.28;
        const z = -0.13 + Math.floor(i / 3) * 0.26;
        B(g, 0.24, 0.04, 0.22, '#f3f3f3', x, 0.72, z);
        for (let k = 0; k < 3; k++) C(g, 0.035, 0.035, 0.14, cs[(i + k) % cs.length], x - 0.06 + k * 0.06, 0.76, z, 8);
      }
      const lan = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), mat('#d9302b', { emissive: '#5a0d08' }));
      lan.scale.y = 1.2;
      lan.position.set(0.35, 1.35, 0.25);
      g.add(lan);
      B(g, 0.02, 0.25, 0.02, '#333', 0.35, 1.47, 0.25);
      plate(g, def, 0.35, 0.36);
    },
    noodleMaker(g, view, def) {
      // 製麵機：兩根滾筒，前面垂著一排麵條
      B(g, 0.85, 0.75, 0.65, '#9aa1a9', 0, 0, 0, { metalness: 0.6, roughness: 0.35 });
      B(g, 0.7, 0.35, 0.45, '#c9ced6', 0, 0.75, -0.05, { metalness: 0.6 });
      for (const y of [0.92, 1.02]) {
        const r = C(g, 0.06, 0.06, 0.6, '#e8edf2', 0, y, 0.2, 14, { metalness: 0.7 });
        r.rotation.z = Math.PI / 2;
        r.position.set(0, y, 0.2);
      }
      for (let i = 0; i < 9; i++) B(g, 0.02, 0.32, 0.02, '#f2d49b', -0.24 + i * 0.06, 0.6, 0.3);
      B(g, 0.55, 0.04, 0.3, '#c9a36b', 0, 0.55, 0.28);
      plate(g, def, 0.3, 0.33);
    },
    coldCase(g, view, def) {
      // 直立玻璃展示櫃：一層一層的小菜盤
      shell(g, 0.85, 1.6, 0.6, '#5aa9a0', -0.05);
      B(g, 0.75, 1.3, 0.02, basic('#dff3ff', { transparent: true, opacity: 0.35 }), 0, 0.2, 0.26);
      const dish = ['#5aa04a', '#f2d49b', '#ffffff', '#c97b2c'];
      for (let r = 0; r < 3; r++) for (let i = 0; i < 3; i++) {
        C(g, 0.09, 0.08, 0.03, '#ffffff', -0.24 + i * 0.24, 0.3 + r * 0.42, 0.05, 14);
        C(g, 0.07, 0.06, 0.04, dish[(r + i) % dish.length], -0.24 + i * 0.24, 0.33 + r * 0.42, 0.05, 12);
      }
      B(g, 0.75, 0.06, 0.02, basic('#ffffff'), 0, 1.48, 0.27);
      plate(g, def, 1.6, 0.27);
    },
    sealer(g, view, def) {
      B(g, 0.9, 0.8, 0.7, '#f3efe8', 0, 0, 0);
      // 封口機：方形機身＋上面一捲封膜＋下面一杯正在封的珍奶
      B(g, 0.42, 0.55, 0.4, '#e8743b', -0.12, 0.8, -0.05);
      const roll = C(g, 0.12, 0.12, 0.3, '#f7f7f2', -0.12, 1.4, -0.05, 16);
      roll.rotation.z = Math.PI / 2;
      roll.position.set(-0.12, 1.47, -0.05);
      B(g, 0.3, 0.04, 0.3, '#2b2b30', -0.12, 1.08, 0.12);
      C(g, 0.08, 0.06, 0.22, basic('#e8c39e', { transparent: true, opacity: 0.85 }), -0.12, 0.85, 0.12, 14);
      for (let i = 0; i < 3; i++) C(g, 0.065, 0.05, 0.2, '#f5f1e8', 0.25, 0.8, -0.15 + i * 0.15, 12);
      plate(g, def, 0.45, 0.36);
    },
    pearlPot(g, view, def) {
      B(g, 0.9, 0.8, 0.7, '#f3efe8', 0, 0, 0);
      // 電磁爐上一鍋黑黑的珍珠，旁邊一桶煮好的
      B(g, 0.4, 0.05, 0.4, '#1d1d1f', -0.15, 0.8, 0);
      C(g, 0.18, 0.17, 0.25, '#c9ced6', -0.15, 0.85, 0, 18, { metalness: 0.8 });
      for (let i = 0; i < 7; i++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), mat('#1a1410'));
        b.position.set(-0.15 + Math.cos(i) * 0.1, 1.1, Math.sin(i) * 0.1);
        g.add(b);
      }
      C(g, 0.13, 0.12, 0.22, basic('#dff3ff', { transparent: true, opacity: 0.5 }), 0.25, 0.8, -0.05, 14);
      C(g, 0.11, 0.11, 0.12, '#2b1d14', 0.25, 0.82, -0.05, 12);
      g.userData.steam = [new THREE.Vector3(-0.15, 1.25, 0)];
      plate(g, def, 0.45, 0.36);
    },
    fruitBar(g, view, def) {
      B(g, 0.9, 0.8, 0.7, '#2f8f6b', 0, 0, 0);
      B(g, 0.94, 0.04, 0.74, '#f6f1ea', 0, 0.8, 0);
      // 三籃水果（檸檬、柳橙、芭樂）＋一台果汁機
      const fr = [['#f4d03f', -0.28], ['#f39c12', 0], ['#7dbb48', 0.28]];
      for (const [c, x] of fr) {
        C(g, 0.12, 0.1, 0.07, '#c9a36b', x, 0.84, 0.15, 12);
        for (let i = 0; i < 3; i++) {
          const f = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), mat(c, { roughness: 0.5 }));
          f.position.set(x - 0.05 + i * 0.05, 0.95 + (i === 1 ? 0.04 : 0), 0.15);
          g.add(f);
        }
      }
      B(g, 0.18, 0.12, 0.18, '#2b2b30', 0, 0.84, -0.2);
      C(g, 0.08, 0.06, 0.24, basic('#ffe08a', { transparent: true, opacity: 0.8 }), 0, 0.96, -0.2, 12);
      plate(g, def, 0.45, 0.36);
    },
    iceMaker(g, view, def) {
      // 製冰機：白色機身，上半部窗口看得到一堆冰塊
      B(g, 0.8, 0.8, 0.65, '#f3f6f8', 0, 0, -0.05, { roughness: 0.4 });
      // 上半部是透明的儲冰槽
      B(g, 0.8, 0.6, 0.03, '#f3f6f8', 0, 0.8, -0.36);
      for (const x of [-0.385, 0.385]) B(g, 0.03, 0.6, 0.65, '#f3f6f8', x, 0.8, -0.05);
      B(g, 0.74, 0.6, 0.02, basic('#bfe6ff', { transparent: true, opacity: 0.35 }), 0, 0.8, 0.27);
      for (let i = 0; i < 18; i++) B(g, 0.1, 0.09, 0.1, '#e6f6ff', -0.27 + (i % 6) * 0.11, 0.8 + Math.floor(i / 6) * 0.1, 0.12 - (i % 2) * 0.15, { roughness: 0.1, metalness: 0.1 });
      B(g, 0.8, 0.12, 0.66, '#9fc7e6', 0, 1.4, -0.05);
      plate(g, def, 0.45, 0.28);
    },
    colorStation(g, view, def) {
      // 燙染區：可躺的椅子＋上面罩著半圓的加熱罩＋一碗染膏
      B(g, 0.62, 0.42, 0.62, '#3a3a40', 0, 0, 0);
      B(g, 0.66, 0.1, 0.66, '#8e44ad', 0, 0.42, 0, { roughness: 0.5 });
      const back = B(g, 0.66, 0.6, 0.1, '#8e44ad', 0, 0.5, -0.3, { roughness: 0.5 });
      back.rotation.x = -0.25;
      B(g, 0.05, 1.3, 0.05, '#9aa1a9', 0, 0.3, -0.42, { metalness: 0.7 });
      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#e8edf2', { side: THREE.DoubleSide }));
      hood.position.set(0, 1.45, -0.28);
      hood.rotation.x = Math.PI;
      g.add(hood);
      C(g, 0.08, 0.06, 0.06, '#2b2b30', 0.4, 0.6, 0.2, 12);
      C(g, 0.065, 0.065, 0.02, '#8e2b6b', 0.4, 0.66, 0.2, 12);
      plate(g, def, 0.25, 0.33);
    },
    hoodDryer(g, view, def) {
      // 烘罩機：有輪子的立架，頂端一顆大大的圓罩
      C(g, 0.28, 0.3, 0.05, '#2b2b30', 0, 0, 0, 16);
      C(g, 0.03, 0.03, 1.2, '#9aa1a9', 0, 0.05, 0, 8, { metalness: 0.7 });
      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), mat('#f4a3c0', { side: THREE.DoubleSide }));
      hood.position.set(0, 1.55, 0.12);
      hood.rotation.x = Math.PI * 0.75;
      g.add(hood);
      B(g, 0.14, 0.1, 0.1, '#e8edf2', 0, 1.2, -0.05);
      plate(g, def, 0.75, 0.05);
    },
    magRack(g, view, def) {
      // 木頭雜誌架：斜斜放著一排彩色雜誌和報紙
      B(g, 0.8, 1.1, 0.25, '#8a5a3b', 0, 0, -0.2);
      const cs = ['#d9482b', '#2c6fbb', '#f2c14e', '#2f8f6b', '#8e44ad', '#f7f7f2'];
      for (let r = 0; r < 3; r++) {
        B(g, 0.78, 0.04, 0.2, '#6b4430', 0, 0.18 + r * 0.32, -0.02);
        for (let i = 0; i < 3; i++) {
          const m = B(g, 0.22, 0.28, 0.02, cs[(r * 3 + i) % cs.length], -0.25 + i * 0.25, 0.22 + r * 0.32, 0.02);
          m.rotation.x = -0.25;
        }
      }
      plate(g, def, 1.15, -0.06);
    },
    hairShelf(g, view, def) {
      // 美髮商品櫃：三層架子，擺滿洗髮精、髮蠟
      shell(g, 0.85, 1.5, 0.42, '#f3efe8', -0.12);
      const cs = ['#5aa9a0', '#2c6fbb', '#e0478a', '#2b2b30', '#f2c14e'];
      for (let r = 0; r < 3; r++) {
        B(g, 0.8, 0.03, 0.38, '#d8cfc2', 0, 0.3 + r * 0.42, -0.08);
        for (let i = 0; i < 5; i++) C(g, 0.05, 0.05, r === 2 ? 0.1 : 0.24, cs[(i + r) % cs.length], -0.3 + i * 0.15, 0.33 + r * 0.42, -0.02, 10);
      }
      plate(g, def, 1.5, 0.06);
    },
    tireBalancer(g, view, def) {
      // 輪胎平衡機：機身側邊掛著一顆輪胎，前面有小螢幕
      B(g, 0.6, 0.95, 0.6, '#2c6fbb', -0.1, 0, -0.05, { roughness: 0.5 });
      B(g, 0.3, 0.2, 0.02, basic('#5fd3a0'), -0.1, 0.7, 0.26);
      const axle = C(g, 0.04, 0.04, 0.3, '#9aa1a9', 0.25, 0.75, 0, 8, { metalness: 0.7 });
      axle.rotation.z = Math.PI / 2;
      axle.position.set(0.3, 0.75, 0);
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.08, 10, 20), mat('#1d1d1d', { roughness: 0.8 }));
      tire.position.set(0.42, 0.75, 0);
      tire.rotation.y = Math.PI / 2;
      tire.castShadow = true;
      g.add(tire);
      const rim = C(g, 0.17, 0.17, 0.06, '#c9ced6', 0.42, 0.75, 0, 14, { metalness: 0.8 });
      rim.rotation.z = Math.PI / 2;
      rim.position.set(0.42, 0.75, 0);
      plate(g, def, 0.4, 0.26);
    },
    diagPC(g, view, def) {
      // 診斷電腦：推車上一台螢幕（上面有波形），一條線拉到地上的接頭
      B(g, 0.6, 0.05, 0.45, '#555b66', 0, 0.15, 0);
      B(g, 0.6, 0.05, 0.45, '#555b66', 0, 0.75, 0);
      for (const [x, z] of [[-0.27, -0.2], [0.27, -0.2], [-0.27, 0.2], [0.27, 0.2]]) {
        B(g, 0.04, 0.75, 0.04, '#9aa1a9', x, 0.05, z, { metalness: 0.6 });
        C(g, 0.04, 0.04, 0.04, '#1d1d1d', x, 0, z, 8);
      }
      B(g, 0.5, 0.36, 0.05, '#1d1d1d', 0, 0.85, -0.08);
      const scr = canvasTex(128, 96, (c, w, h) => {
        c.fillStyle = '#0d2238';
        c.fillRect(0, 0, w, h);
        c.strokeStyle = '#5fd3a0';
        c.lineWidth = 4;
        c.beginPath();
        for (let x = 0; x <= w; x += 8) c.lineTo(x, h / 2 + Math.sin(x / 9) * 20 * Math.sin(x / 40));
        c.stroke();
        c.fillStyle = '#f2c14e';
        c.font = 'bold 18px sans-serif';
        c.fillText('OK', 8, 22);
      });
      const sm = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.3), new THREE.MeshBasicMaterial({ map: scr }));
      sm.position.set(0, 1.03, -0.05);
      g.add(sm);
      B(g, 0.3, 0.02, 0.15, '#2b2b30', 0, 0.8, 0.12);
      const cable = B(g, 0.025, 0.6, 0.025, '#e2a12a', 0.32, 0.2, 0.15);
      cable.rotation.z = 0.5;
      plate(g, def, 0.3, 0.23);
    },
    washBay(g, view, def) {
      // 洗車區：藍色排水地墊、水桶、泡泡、一支噴槍
      B(g, 0.92, 0.04, 0.92, '#2c6fbb', 0, 0, 0, { roughness: 0.3 });
      for (let i = 0; i < 4; i++) B(g, 0.85, 0.01, 0.03, '#1f5a9a', 0, 0.04, -0.3 + i * 0.2);
      C(g, 0.13, 0.11, 0.25, '#f2c14e', -0.28, 0.04, -0.25, 14);
      for (let i = 0; i < 4; i++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.07 + (i % 2) * 0.03, 8, 6), mat('#ffffff', { roughness: 0.2 }));
        b.position.set(-0.28 + (i - 1.5) * 0.06, 0.32 + (i % 2) * 0.05, -0.25);
        g.add(b);
      }
      B(g, 0.06, 1.0, 0.06, '#9aa1a9', 0.35, 0.04, -0.35, { metalness: 0.7 });
      B(g, 0.2, 0.05, 0.05, '#2b2b30', 0.3, 0.95, -0.3);
      B(g, 0.05, 0.12, 0.05, '#d9482b', 0.22, 0.9, -0.28);
      plate(g, def, 0.75, -0.3);
    },
    oilDrum(g, view, def) {
      // 機油桶架：兩桶大油桶，上面一支手動抽油幫浦
      B(g, 0.9, 0.12, 0.6, '#555b66', 0, 0, 0);
      for (const [x, c] of [[-0.22, '#e2a12a'], [0.22, '#2c6fbb']]) {
        C(g, 0.2, 0.2, 0.7, c, x, 0.12, 0, 18, { metalness: 0.4, roughness: 0.4 });
        for (const y of [0.3, 0.6]) C(g, 0.205, 0.205, 0.025, '#2b2b30', x, 0.12 + y, 0, 18);
      }
      B(g, 0.04, 0.35, 0.04, '#9aa1a9', -0.22, 0.82, 0, { metalness: 0.7 });
      B(g, 0.2, 0.04, 0.04, '#9aa1a9', -0.14, 1.12, 0, { metalness: 0.7 });
      plate(g, def, 0.4, 0.31);
    },
    hotCase(g, view, def) {
      // 熱食櫃：黃光玻璃櫃裡擺著便當，旁邊一格關東煮
      B(g, 0.9, 0.75, 0.7, '#d9482b', 0, 0, 0);
      B(g, 0.86, 0.5, 0.62, basic('#ffe7b3', { transparent: true, opacity: 0.45 }), 0, 0.75, 0);
      B(g, 0.8, 0.02, 0.02, basic('#ffd27a'), 0, 1.22, 0.3);
      for (let i = 0; i < 3; i++) {
        B(g, 0.22, 0.06, 0.16, '#2b2b30', -0.28 + i * 0.25, 0.77, -0.12);
        B(g, 0.2, 0.02, 0.14, ['#f2d49b', '#c97b2c', '#5aa04a'][i], -0.28 + i * 0.25, 0.83, -0.12);
      }
      B(g, 0.5, 0.12, 0.25, '#c9ced6', -0.1, 0.77, 0.15, { metalness: 0.6 });
      for (let i = 0; i < 4; i++) C(g, 0.03, 0.03, 0.12, ['#e8c25a', '#ffffff', '#c97b2c', '#7a4a25'][i], -0.25 + i * 0.1, 0.85, 0.15, 8);
      g.userData.steam = [new THREE.Vector3(-0.1, 1.0, 0.15)];
      plate(g, def, 0.35, 0.36);
    },
    coffeeMachine(g, view, def) {
      B(g, 0.9, 0.8, 0.7, '#6b4a32', 0, 0, 0);
      B(g, 0.94, 0.04, 0.74, '#f6f1ea', 0, 0.8, 0);
      // 義式咖啡機：亮面機身、兩個沖煮頭、上面溫杯
      B(g, 0.66, 0.42, 0.42, '#c9ced6', 0, 0.84, -0.12, { metalness: 0.8, roughness: 0.25 });
      for (const x of [-0.16, 0.16]) {
        B(g, 0.12, 0.06, 0.12, '#2b2b30', x, 0.98, 0.1);
        C(g, 0.05, 0.04, 0.08, '#ffffff', x, 0.86, 0.12, 10);
      }
      for (let i = 0; i < 4; i++) C(g, 0.045, 0.04, 0.07, '#f7f7f2', -0.22 + i * 0.15, 1.26, -0.12, 10);
      C(g, 0.03, 0.03, 0.2, '#9aa1a9', 0.3, 0.98, 0.05, 8, { metalness: 0.7 }).rotation.z = 0.5;
      g.userData.steam = [new THREE.Vector3(0.16, 1.0, 0.12)];
      plate(g, def, 0.45, 0.36);
    },
    softServe(g, view, def) {
      // 霜淇淋機：機身＋上面一支超大的霜淇淋招牌
      B(g, 0.7, 1.0, 0.6, '#f4a3c0', 0, 0, -0.05, { roughness: 0.4 });
      B(g, 0.5, 0.25, 0.25, '#e8edf2', 0, 0.75, 0.12, { metalness: 0.5 });
      for (const x of [-0.12, 0.12]) B(g, 0.06, 0.12, 0.06, '#9aa1a9', x, 0.63, 0.22, { metalness: 0.7 });
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.32, 14), mat('#d9a35a'));
      cone.rotation.x = Math.PI;
      cone.position.set(0, 1.18, 0);
      g.add(cone);
      for (let i = 0; i < 3; i++) {
        const sw = new THREE.Mesh(new THREE.SphereGeometry(0.14 - i * 0.035, 14, 10), mat('#fffaf0', { roughness: 0.3 }));
        sw.scale.y = 0.8;
        sw.position.set(0, 1.38 + i * 0.1, 0);
        g.add(sw);
      }
      plate(g, def, 0.35, 0.26);
    },
    freezerCase(g, view, def) {
      // 臥式冷凍櫃：上面是玻璃拉門，看得到彩色的冷凍食品
      shell(g, 0.9, 0.75, 0.65, '#e8edf2', 0, 'top');
      B(g, 0.84, 0.02, 0.58, basic('#cfe8ff', { transparent: true, opacity: 0.45 }), 0, 0.76, 0);
      const cs = ['#2c6fbb', '#e74c3c', '#f2c14e', '#2ecc71', '#ffffff', '#8e44ad'];
      for (let i = 0; i < 6; i++) B(g, 0.22, 0.08, 0.18, cs[i], -0.27 + (i % 3) * 0.27, 0.66, -0.12 + Math.floor(i / 3) * 0.25);
      B(g, 0.9, 0.08, 0.04, '#9fc7e6', 0, 0.55, 0.33);
      plate(g, def, 0.25, 0.34);
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

  // 寵物模型：kind 是 cat／dog／parrot／turtle；pup 是客人帶的小狗；carrier 是貓籠
  // 寵物、客人帶的小狗和貓籠：同樣大小的幾何只建一次（客人一直來來去去，不共用的話顯示記憶體會越吃越多）
  const petGeoCache = new Map();
  function petGeo(type, ...args) {
    const k = type + args.map((v) => (typeof v === 'number' ? v.toFixed(4) : v)).join(',');
    let g = petGeoCache.get(k);
    if (!g) {
      g = new THREE[type](...args);
      g.userData.shared = true;
      petGeoCache.set(k, g);
    }
    return g;
  }

  function petModel(kind, seed = 0) {
    const g = new THREE.Group();
    const add = (geo, color, x, y, z, sx = 1, sy = 1, sz = 1) => {
      const m = new THREE.Mesh(geo, mat(color));
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      m.castShadow = true;
      g.add(m);
      return m;
    };
    const sph = (r) => petGeo('SphereGeometry', r, 12, 10);
    if (kind === 'cat') {
      const fur = ['#e8933a', '#3a3a3a', '#f3efe8', '#9a8572'][seed % 4];
      add(sph(0.2), fur, 0, 0.14, 0, 1, 0.7, 1.4);
      add(sph(0.13), fur, 0, 0.24, 0.26);
      add(petGeo('ConeGeometry', 0.045, 0.09, 6), fur, -0.07, 0.36, 0.26);
      add(petGeo('ConeGeometry', 0.045, 0.09, 6), fur, 0.07, 0.36, 0.26);
      const tail = add(petGeo('CylinderGeometry', 0.03, 0.025, 0.36, 6), fur, 0.12, 0.12, -0.3);
      tail.rotation.set(1.2, 0, 0.5);
    } else if (kind === 'dog' || kind === 'pup') {
      const k = kind === 'pup' ? 0.6 : 1;
      const fur = kind === 'pup' ? ['#f3efe8', '#c9873e', '#3a3a3a', '#e0c08a'][seed % 4] : '#d98a4e';
      add(sph(0.2 * k), fur, 0, 0.3 * k, 0, 1, 0.8, 1.5);
      add(sph(0.15 * k), fur, 0, 0.48 * k, 0.28 * k);
      add(sph(0.06 * k), '#f3efe8', 0, 0.44 * k, 0.4 * k);
      add(petGeo('ConeGeometry', 0.05 * k, 0.1 * k, 6), fur, -0.08 * k, 0.62 * k, 0.26 * k);
      add(petGeo('ConeGeometry', 0.05 * k, 0.1 * k, 6), fur, 0.08 * k, 0.62 * k, 0.26 * k);
      for (const [x, z] of [[-0.09, 0.15], [0.09, 0.15], [-0.09, -0.15], [0.09, -0.15]]) add(petGeo('CylinderGeometry', 0.035 * k, 0.035 * k, 0.2 * k, 6), fur, x * k, 0.1 * k, z * k);
      const tail = add(petGeo('CylinderGeometry', 0.03 * k, 0.02 * k, 0.18 * k, 6), fur, 0, 0.4 * k, -0.3 * k);
      tail.rotation.x = -0.8;
      g.userData.tail = tail;
    } else if (kind === 'parrot') {
      add(petGeo('CylinderGeometry', 0.025, 0.025, 1.3, 6), '#6b4a32', 0, 0.65, 0);
      add(petGeo('CylinderGeometry', 0.15, 0.18, 0.04, 10), '#6b4a32', 0, 0.02, 0);
      const perch = add(petGeo('CylinderGeometry', 0.02, 0.02, 0.4, 6), '#6b4a32', 0, 1.3, 0);
      perch.rotation.z = Math.PI / 2;
      const bird = new THREE.Group();
      const body = new THREE.Mesh(sph(0.09), mat('#2ecc71'));
      body.scale.set(0.9, 1.3, 0.9);
      body.position.y = 0.1;
      const head = new THREE.Mesh(sph(0.07), mat('#27ae60'));
      head.position.set(0, 0.24, 0.02);
      const beak = new THREE.Mesh(petGeo('ConeGeometry', 0.025, 0.06, 6), mat('#f1c40f'));
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 0.23, 0.09);
      const tail = new THREE.Mesh(petGeo('BoxGeometry', 0.05, 0.16, 0.02), mat('#e74c3c'));
      tail.position.set(0, 0.0, -0.06);
      bird.add(body, head, beak, tail);
      bird.position.y = 1.32;
      g.add(bird);
      g.userData.bird = bird;
    } else if (kind === 'turtle') {
      add(sph(0.16), '#5a7d3a', 0, 0.06, 0, 1, 0.55, 1.2);
      add(sph(0.06), '#8fb06a', 0, 0.07, 0.2);
      for (const [x, z] of [[-0.12, 0.1], [0.12, 0.1], [-0.12, -0.1], [0.12, -0.1]]) add(sph(0.04), '#8fb06a', x, 0.03, z);
    } else if (kind === 'carrier') {
      add(petGeo('BoxGeometry', 0.28, 0.22, 0.36), '#c97b2c', 0, 0.35, 0);
      add(petGeo('BoxGeometry', 0.2, 0.12, 0.02), '#2b2b30', 0, 0.36, 0.185);
    }
    return g;
  }

  const umbrellaMats = {};
  function umbrellaModel(color) {
    const g = new THREE.Group();
    // 傘面的幾何和顏色材質共用（下雨天客人很多）
    const canopy = new THREE.Mesh(petGeo('ConeGeometry', 0.42, 0.22, 10, 1, true), umbrellaMats[color] || (umbrellaMats[color] = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.6 })));
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
      // 手機高解析螢幕（DPR ≥ 2）本身就很細，鋸齒看不太出來：關掉反鋸齒省下大量 GPU
      const dpr0 = window.devicePixelRatio || 1;
      const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const r = new THREE.WebGLRenderer({ antialias: !opts.lowEnd && !(touch && dpr0 >= 2), preserveDrawingBuffer: false, powerPreference: touch ? 'default' : 'high-performance' });
      r.setPixelRatio(Math.min(dpr0, 1.5));
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
      const prev = this.quality;
      this.quality = q;
      // CSS 也跟著畫質走（毛玻璃、彩帶這些很吃 GPU 的效果）
      document.documentElement.dataset.quality = q;
      // 柔邊陰影只給高畫質；換陰影種類要讓材質重新編譯
      const type = q === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
      if (this.renderer.shadowMap.type !== type) {
        this.renderer.shadowMap.type = type;
        if (prev) this.world.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true)); });
      }
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
      const z = this.zoom;
      // 下面被面板蓋住一塊（手機的人物卡）：把店往上挪到看得到的地方
      const ch = this.container.clientHeight || 1;
      const my = (minY + maxY) / 2 - ((this.viewShift || 0) / 2 / ch) * (h / z);
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

    // 畫面下方被蓋住幾個像素（0：沒被蓋住）
    setViewShift(px) {
      this.viewShiftT = Math.max(0, px || 0);
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

    // 一鍵看後場：鏡頭轉到店的背面、拉高一點往下看、對準後場中間；再按一次回到原本的視角
    viewBackroom() {
      if (this.camRot === 2 && this.panT && this.panT.z < -1) return this.resetView();
      const s = this.sim;
      const target = (5 * Math.PI) / 4;
      const k = Math.round((this.camAz - target) / (Math.PI * 2));
      this.camAzT = target + k * Math.PI * 2;
      this.pitchT = 1.05;
      // 直式手機畫面比較窄：拉得更近
      const portrait = this.container.clientHeight > this.container.clientWidth;
      this.zoomT = Math.max(portrait ? 1.9 : 1.45, Math.min(portrait ? 2.4 : 2, 10 / Math.max(6, s.W)));
      this.panT = new THREE.Vector3(0, 0, -1.55 - ((s.H + 1.2) / 2 + 0.4));
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
      this.viewShift = ease(this.viewShift || 0, this.viewShiftT || 0, 0.5);
      if (this.panT) {
        const nx = ease(this.pan.x, this.panT.x, 0.002);
        const nz = ease(this.pan.z, this.panT.z, 0.002);
        this.pan.x = nx;
        this.pan.z = nz;
        if (nx === this.panT.x && nz === this.panT.z) this.panT = null;
      }
      if (moved) this.updateCamera();
      this.camMoving = moved;
    }

    // 畫面需不需要高更新率：鏡頭在動、手指在滑，或剛操作完
    get busy() {
      return this.camMoving || performance.now() - (this.lastInput || 0) < 1500;
    }

    // 最高每秒幾幀：高 60、中 60、低（省電）30；120Hz 的手機也不會多畫一倍
    get fpsCap() {
      return this.quality === 'low' ? 30 : 60;
    }

    bindControls() {
      const el = this.dom;
      const touched = () => (this.lastInput = performance.now());
      for (const t of ['pointerdown', 'pointermove', 'wheel']) el.addEventListener(t, touched, { passive: true });
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
      for (const v of (this.petViews || new Map()).values()) targets.push(v.g);
      if (this.evBayOn && this.evCarGroup) targets.push(this.evCarGroup);
      const hits = rc.intersectObjects(targets, true);
      const found = [];
      for (const h of hits) {
        let o = h.object;
        while (o && !o.userData.pick) o = o.parent;
        if (o) found.push(o.userData.pick);
      }
      // 人比家具優先（員工會走動，比較難點到）
      const pri = { staff: 0, customer: 1, pet: 2, evcar: 3, object: 4, evbay: 5 };
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
      // 隔壁是誰：照開店地點（夜市旁就是攤販、學校旁是補習班、廟口是香舖）
      const local = SPOT_NEIGHBORS[this.sim.spot];
      const pick = (i) => (local ? local[i % local.length] : NEIGHBORS[(i + ind.id.length) % NEIGHBORS.length]);
      this.neighborPick = pick(0);
      this.rivalKey = this.rivalState();
      this.buildLeftNeighbor();
      // 右邊：買了「店旁的空地」充電站就變成充電區，不然是隔壁店家
      const evHome = this.evHomeStation();
      this.evBayOn = !!evHome;
      this.evCarGroup = new THREE.Group();
      g.add(this.evCarGroup);
      this._evFilled = false;
      this.evCars = [];
      this.evSlots = [];
      this.evAisle = null;
      if (evHome) {
        this.buildEVBay(this.neighbors.right, evHome);
        // 看不見的點擊範圍：點充電區任何地方都能打開管理面板
        const bw = this.evBayW || OUT_W;
        const hit = new THREE.Mesh(new THREE.BoxGeometry(bw, 1.6, H), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
        hit.position.set(W + bw / 2, 0.8, H / 2);
        hit.userData.pick = { kind: 'evbay' };
        this.evCarGroup.add(hit);
      } else this.buildNeighbor(this.neighbors.right, W, 0, OUT_W, H, pick(3));

      // 路邊停的機車
      const colors = ['#c0392b', '#ecf0f1', '#2c3e50', '#2980b9', '#f1c40f', '#7f8c8d'];
      for (let x = -OUT_W + 0.6, i = 0; x < W + OUT_W - 0.5; x += 0.75, i++) {
        if (x > d0 - 0.6 && x < d0 + 2.6) continue;
        if ((i * 7) % 5 === 0) continue;
        if (this.evBayOn && x > W - 0.3) continue; // 充電區的出入口不停機車
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
      People.mergeGroup(this.clock, [this.clockH, this.clockM], { cast: false });
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
      this.buildAnnex(g);
      // 合併靜態場景：牆、隔壁店家、柱子、路邊的機車
      for (const gr of [...Object.values(this.walls), ...Object.values(this.neighbors), this.frontProps, this.trees, this.annexWalls].filter(Boolean)) People.mergeGroup(gr);
      People.mergeGroup(g, [...Object.values(this.walls), ...Object.values(this.neighbors), this.frontProps, this.trees, this.annexWalls, this.annexSigns, this.annexDoors, this.clock, this.trafficGroup, this.pigeonGroup, this.sign, this.shutter, this.frontSigns, this.glowGroup]);
      if (this.renderer) this.renderer.shadowMap.needsUpdate = true;
      this.updateCamera();
    }

    // ───── 後場：店面後面的四個房間 ─────
    buildAnnex(g) {
      const s = this.sim;
      this.annexWalls = null;
      this.annexSigns = null;
      this.annexDoors = null;
      this.stallDoor = null;
      if (!s.hasBackroom || !root.BossFun.ROOMS) return;
      const W = s.W;
      const D = 2.8;
      const z0 = -0.15;
      const z1 = z0 - D;
      const order = ['storage', 'rest', 'office', 'toilet'];
      const floorCol = { storage: '#9a958c', rest: '#d9c7a7', office: '#b98a5b', toilet: '#dfe8ec' };
      this.annexWalls = new THREE.Group();
      this.annexSigns = new THREE.Group();
      // 員工門：鏡頭從後面看的時候跟著牆一起收起來，才不會擋住後場
      this.annexDoors = new THREE.Group();
      g.add(this.annexWalls, this.annexSigns, this.annexDoors);
      const wallMat = mat('#e9e2d6');
      // 外牆（鏡頭在後面時會降低）
      B(this.annexWalls, W + 0.3, WALL_H, 0.15, wallMat, W / 2, 0, z1 - 0.07);
      B(this.annexWalls, 0.15, WALL_H, D + 0.3, wallMat, -0.07, 0, (z0 + z1) / 2);
      B(this.annexWalls, 0.15, WALL_H, D + 0.3, wallMat, W + 0.07, 0, (z0 + z1) / 2);
      order.forEach((id, i) => {
        const x0 = (i * W) / 4;
        const x1 = ((i + 1) * W) / 4;
        const cx = (x0 + x1) / 2;
        const w = x1 - x0;
        const lv = s.roomLv(id);
        // 地板
        const fl = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.04, D), mat(lv ? floorCol[id] : '#6f6a63', { roughness: 0.9 }));
        fl.rotation.x = -Math.PI / 2;
        fl.position.set(cx, 0.01, (z0 + z1) / 2);
        fl.receiveShadow = true;
        g.add(fl);
        // 隔間牆（矮一點，才看得到裡面）：靠店這一側留一條走道，各房間的門口開在走道上
        const zc = -0.95;
        if (i > 0) B(g, 0.1, 1.3, zc - z1, '#d8cfc2', x0, 0, (zc + z1) / 2);
        // 門口兩側的矮門框，看得出房間從哪裡進出
        B(g, 0.12, 1.3, 0.1, '#cfc4b4', x0 + 0.12, 0, zc - 0.05);
        B(g, 0.12, 1.3, 0.1, '#cfc4b4', x1 - 0.12, 0, zc - 0.05);
        // 房間名牌（貼在外牆內側）
        const R = root.BossFun.ROOMS[id];
        const tex = canvasTex(256, 72, (c, tw, th) => {
          c.fillStyle = lv ? '#ffffff' : '#bdb6ab';
          c.fillRect(0, 0, tw, th);
          c.fillStyle = '#2a2420';
          c.font = 'bold 34px sans-serif';
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText(lv ? `${R.icon}${R.name}` : `${R.icon}（空地）`, tw / 2, th / 2 + 2);
        });
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(1.2, w - 0.2), 0.34), new THREE.MeshBasicMaterial({ map: tex }));
        sign.position.set(cx, 1.9, z1 + 0.02);
        this.annexSigns.add(sign);
        if (lv) this.buildRoomProps(g, id, lv, x0, x1, z0, z1);
      });
      // 門：店裡後牆上一扇門，後場那一側也有
      const d = s.backDoorCell();
      if (d) {
        const doorTex = canvasTex(64, 128, (c, tw, th) => {
          c.fillStyle = '#8a5a3b';
          c.fillRect(0, 0, tw, th);
          c.fillStyle = '#6b4430';
          c.fillRect(6, 6, tw - 12, th / 2 - 10);
          c.fillRect(6, th / 2 + 4, tw - 12, th / 2 - 10);
          c.fillStyle = '#e2a12a';
          c.beginPath();
          c.arc(tw - 14, th / 2, 4, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = '#ffffff';
          c.font = 'bold 13px sans-serif';
          c.textAlign = 'center';
          c.fillText('員工', tw / 2, 22);
        });
        for (const [z, rot] of [[0.005, 0], [-0.165, Math.PI]]) {
          const door = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.9), new THREE.MeshStandardMaterial({ map: doorTex }));
          door.position.set(d.x + 0.5, 0.95, z);
          door.rotation.y = rot;
          this.annexDoors.add(door);
        }
      }
    }

    // 房間裡的家具：等級越高越多
    buildRoomProps(g, id, lv, x0, x1, z0, z1) {
      const cx = (x0 + x1) / 2;
      const zb = z1 + 0.35; // 靠外牆
      if (id === 'storage') {
        for (let i = 0; i < 2; i++) {
          const x = x0 + 0.45 + i * 0.75;
          B(g, 0.6, 1.6, 0.4, '#8a8f99', x, 0, zb, { metalness: 0.4 });
          for (let r = 0; r < 3; r++) B(g, 0.22, 0.25, 0.3, ['#c99a5b', '#d8b07a', '#b98a4f'][(r + i) % 3], x - 0.13 + (r % 2) * 0.25, 0.08 + r * 0.5, zb);
        }
        if (lv >= 2) B(g, 0.7, 1.7, 0.6, '#dfe6ea', x1 - 0.5, 0, zb + 0.1, { metalness: 0.3 });
        if (lv >= 3) {
          B(g, 0.3, 0.25, 0.3, '#2b2b30', cx, 0, z0 - 1.25);
          B(g, 0.32, 0.22, 0.05, basic('#5ef0ff'), cx, 2.0, z1 + 0.05);
        }
      } else if (id === 'rest') {
        B(g, 0.6, 0.7, 0.6, '#b07a4f', x0 + 0.6, 0, (z0 + z1) / 2);
        C(g, 0.15, 0.15, 0.45, '#d9482b', x0 + 0.6, 0, (z0 + z1) / 2 + 0.5, 10);
        if (lv >= 2) {
          B(g, 1.0, 0.4, 0.45, '#5aa9a0', x1 - 0.7, 0, zb);
          B(g, 1.0, 0.45, 0.12, '#4a948c', x1 - 0.7, 0.4, zb - 0.18);
          B(g, 0.45, 0.9, 0.45, '#f3f3f3', x0 + 0.3, 0, zb);
        }
        if (lv >= 3) {
          B(g, 0.5, 0.5, 0.7, '#3a3a40', cx, 0, z0 - 1.2);
          B(g, 0.5, 0.6, 0.15, '#3a3a40', cx, 0.5, z0 - 1.52);
        }
      } else if (id === 'office') {
        B(g, 1.0, 0.75, 0.55, '#6b4a32', cx, 0, zb + 0.3);
        B(g, 0.35, 0.25, 0.04, basic('#9fd3ff'), cx, 0.75, zb + 0.15);
        C(g, 0.2, 0.2, 0.45, '#2b2b30', cx, 0, zb + 0.85, 10);
        if (lv >= 2) for (const dx of [-0.35, 0.35]) C(g, 0.17, 0.17, 0.42, '#c97b2c', cx + dx, 0, z0 - 1.15, 10);
        if (lv >= 3) {
          B(g, 0.45, 0.55, 0.45, '#4a4f57', x1 - 0.35, 0, zb, { metalness: 0.6 });
          C(g, 0.06, 0.06, 0.03, '#d4a017', x1 - 0.35, 0.3, zb + 0.24, 10).rotation.x = Math.PI / 2;
        }
      } else if (id === 'toilet') {
        // 隔間門：有人在用就關上，門上亮「使用中」
        const doorTex = canvasTex(64, 128, (c, tw, th) => {
          c.fillStyle = '#9fb7c4';
          c.fillRect(0, 0, tw, th);
          c.fillStyle = '#d9482b';
          c.fillRect(8, 20, tw - 16, 26);
          c.fillStyle = '#fff';
          c.font = 'bold 15px sans-serif';
          c.textAlign = 'center';
          c.fillText('使用中', tw / 2, 39);
        });
        const sd = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.5), new THREE.MeshStandardMaterial({ map: doorTex, side: THREE.DoubleSide }));
        sd.position.set(cx, 0.75, -1.8);
        sd.userData.keep = true;
        sd.visible = false;
        this.stallDoor = sd;
        this.annexSigns.add(sd);
        if (lv === 1) {
          B(g, 0.45, 0.06, 0.6, '#f3f3f3', cx, 0, zb + 0.4);
        } else {
          C(g, 0.18, 0.15, 0.4, '#ffffff', cx, 0, zb + 0.15, 14);
          B(g, 0.42, 0.42, 0.14, '#ffffff', cx, 0.3, zb - 0.1);
          B(g, 0.45, 0.12, 0.35, '#f3f3f3', x0 + 0.35, 0.75, z0 - 1.3);
        }
        if (lv >= 3) {
          B(g, 0.03, 0.8, 0.6, basic('#cfe8ff'), x0 + 0.08, 1.1, z0 - 1.3);
          const pl = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), mat('#4f9a5a'));
          pl.position.set(x1 - 0.3, 0.5, zb);
          g.add(pl);
          C(g, 0.14, 0.12, 0.35, '#c97b2c', x1 - 0.3, 0, zb, 10);
          B(g, 0.7, 0.18, 0.03, basic('#ff7eb6'), cx, 1.85, z1 + 0.04);
        }
      }
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
      this.neighbors.right.visible = !near.includes('right') || this.evBayOn;
      // 從正面看的時候，招牌和柱子會擋住店裡：變透明、變矮
      const frontNear = near.includes('front');
      // 半透明的招牌疊在人身上反而更亂，正面看的時候直接收起來
      if (this.sign) this.sign.visible = !frontNear;
      if (this.awning) this.awning.visible = !frontNear;
      if (this.frontProps) this.frontProps.scale.y = frontNear ? 0.15 : 1;
      if (this.trees) this.trees.visible = !frontNear;
      if (this.clock) this.clock.visible = !near.includes('back');
      if (this.annexWalls) this.annexWalls.scale.y = near.includes('back') ? 0.12 : 1;
      if (this.annexDoors) this.annexDoors.visible = !near.includes('back');
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
      People.mergeGroup(inner, [u.wave, u.spin, u.pole, u.art, u.robotHead, u.liftScooter, u.screen, ...(u.fish || [])]);
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
    // 腳下的圓形陰影：所有人共用一個 InstancedMesh，一次畫完（原本每人各畫一次）
    syncBlobs() {
      if (!this.blobs) {
        this.blobs = new THREE.InstancedMesh(People.blobGeo, People.blobMat, 160);
        this.blobs.renderOrder = -1;
        this.blobs.frustumCulled = false;
        this.world.add(this.blobs);
      }
      let n = 0;
      const add = (p, root) => {
        if (!p || !p.blob || n >= 160) return;
        p.blob.visible = false;
        for (let o = p.group; o; o = o.parent) if (!o.visible) return;
        root.updateMatrixWorld();
        this.blobs.setMatrixAt(n++, p.blob.matrixWorld);
      };
      for (const v of this.agents.values()) add(v.p, v.root);
      if (this.bossView) add(this.bossView.p, this.bossView.root);
      this.blobs.count = n;
      this.blobs.instanceMatrix.needsUpdate = true;
    }

    syncAgents(dt, now) {
      const s = this.sim;
      const seen = new Set();
      const list = [
        ...s.staff.filter((e) => e.state !== 'off').map((e) => ({ a: e, kind: 'staff' })),
        ...s.customers.map((c) => ({ a: c, kind: 'customer' })),
        ...(this.quality === 'low' ? s.passers.slice(0, 6) : this.quality === 'medium' ? s.passers.slice(0, 12) : s.passers).map((p) => ({ a: p, kind: p.kind })),
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
          // 帶毛孩的客人：腳邊跟著一隻小狗（或提著貓籠）
          if (kind === 'customer' && a.pet) {
            const pm = petModel(a.pet === 'dog' ? 'pup' : 'carrier', a.id);
            pm.position.set(0.32, 0, 0.1);
            p.group.add(pm);
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
      this.syncBlobs();
      for (const [id, v] of this.agents) {
        if (!seen.has(id)) {
          this.world.remove(v.root);
          // 每個人自己的網格（合併出來的身體、光頭的頭、機車…）都釋放；共用的幾何不動
          People.dispose(v.root, v.p);
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
      // 在後場：坐在沙發／椅子上；上廁所的人關上隔間門（看不到人，只看到門上「使用中」）
      const R = a.inRoom;
      const using = R && R.phase === 'use';
      if (using && R.sit) sitting = true;
      const hidden = using && R.act === 'stall' && kind === 'customer';
      if (v.root.visible === hidden) v.root.visible = !hidden;
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
        const mopping = (a.task && a.task.type === 'clean') || (a.task && a.task.type === 'toilet' && using);
        // 從儲藏室搬貨出來：手上抱著一箱
        const crate = (a.task && a.task.type === 'visit' && a.task.carry && R && R.phase === 'out') || a.carryUntil > this.sim.minute;
        People.setCarry(p, mopping ? 'mop' : crate ? 'crate' : null);
        // 後場裡的動作：拿貨架上的東西、打電腦、喝水、按摩椅在震
        if (p.group.position.x) p.group.position.x = 0;
        if (using && !mopping) {
          if (R.act === 'shelf') {
            p.armR.rotation.x = -2.2 + Math.sin(now / 200) * 0.4;
            p.armL.rotation.x = -2.0 + Math.cos(now / 200) * 0.4;
          } else if (R.act === 'desk') {
            p.armR.rotation.x = -1.2 + Math.sin(now / 70) * 0.15;
            p.armL.rotation.x = -1.2 + Math.cos(now / 70) * 0.15;
          } else if (R.act === 'drink' || R.act === 'eat') {
            p.armR.rotation.x = -1.6 + Math.max(0, Math.sin(now / 600)) * -0.8;
          } else if (R.act === 'massage') {
            p.group.position.x = Math.sin(now / 40) * 0.015;
          }
        }
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
      // 顏色重複使用，不要每一幀都 new（手機上會一直觸發垃圾回收）
      const C = (this._skyC = this._skyC || { night: new THREE.Color('#1c2333'), noon: new THREE.Color('#cfdde8'), dusk: new THREE.Color('#e9a06b'), gloom: new THREE.Color('#6f7a86'), sun: new THREE.Color('#ff9d5c'), sky: new THREE.Color() });
      const sky = C.sky.copy(C.night).lerp(C.noon, day);
      if (dusk > 0) sky.lerp(C.dusk, dusk * 0.55);
      const wx = s.weather ? s.weather.id : 'sunny';
      const gloom = wx === 'typhoon' ? 0.7 : wx === 'rain' ? 0.5 : wx === 'cloudy' || wx === 'cold' ? 0.25 : 0;
      if (gloom) sky.lerp(C.gloom, gloom * day);
      this.world.background = sky;
      this.sun.intensity = (0.15 + day * 0.85) * (1 - gloom * 0.6);
      this.sun.color.set('#fff3e0').lerp(C.sun, dusk);
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
      if (this.signMat) {
        // 升級時招牌閃三下
        const f = this.signFlash ? (performance.now() - this.signFlash) / 1000 : 9;
        const flash = f < 1.8 ? Math.max(0, Math.sin(f * Math.PI * 3.3)) * 1.4 : 0;
        if (f >= 1.8) this.signFlash = 0;
        this.signMat.emissiveIntensity = (lit && night > 0.3 ? 0.9 : 0.12) + flash;
      }
    }

    flashSign() {
      this.signFlash = performance.now();
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
      const evKey = this.evHomeKey();
      if (this.sim.W !== this._lastW || (this.sim.styleVer || 0) !== this._styleVer || evKey !== this._evKey) {
        this._lastW = this.sim.W;
        this._styleVer = this.sim.styleVer || 0;
        this._evKey = evKey;
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
      this.updateEVBay(dt);
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
      p.slow = this.fps < this.fpsCap * 0.43 ? p.slow + 1 : 0;
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

    // 店寵：貓在角落睡覺、狗在門口迎客、鸚鵡站在架子上、烏龜在地上慢慢爬
    updateShopCat() {
      const s = this.sim;
      this.petViews = this.petViews || new Map();
      const now = performance.now();
      const seen = new Set();
      const free = () => {
        const out = [];
        for (let z = 0; z < s.H - 1; z++) for (let x = 0; x < s.W; x++) if (s.passable(x, z) && !s.objects.some((o) => o.custSpots && o.custSpots.some((c) => c.x === x && c.z === z))) out.push([x, z]);
        return out;
      };
      (s.pets || []).forEach((p, idx) => {
        seen.add(p.id);
        let v = this.petViews.get(p.id);
        if (!v) {
          const g = petModel(p.kind, p.id);
          g.userData.pick = { kind: 'pet', pet: p };
          const hit = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), hitMat);
          hit.position.y = 0.3;
          g.add(hit);
          this.world.add(g);
          v = { g, slot: -1 };
          this.petViews.set(p.id, v);
        }
        const g = v.g;
        const slot = Math.floor(s.minute / 180) + idx * 5;
        if (p.kind === 'cat') {
          if (v.slot !== slot) {
            v.slot = slot;
            const f = free();
            const pick = f[(slot * 7 + 3) % Math.max(1, f.length)] || [0, 0];
            g.position.set(pick[0] + 0.5, 0.01, pick[1] + 0.5);
            g.rotation.y = (slot % 4) * 1.3;
          }
          g.scale.y = 1 + Math.sin(now / 600) * 0.04;
        } else if (p.kind === 'dog') {
          // 營業中在門口迎客，打烊了趴在角落
          const x = s.isOpen ? s.doorX - 0.4 : 0.6;
          const z = s.isOpen ? s.H - 1.2 : 0.6;
          g.position.set(x + 0.5, 0.01, z + 0.5);
          g.rotation.y = s.isOpen ? Math.PI : 0.6;
          if (g.userData.tail) g.userData.tail.rotation.z = Math.sin(now / (p.joy > 50 ? 90 : 300)) * 0.6;
        } else if (p.kind === 'parrot') {
          g.position.set(0.55 + idx * 0.1, 0, 0.45);
          if (g.userData.bird) g.userData.bird.rotation.y = Math.sin(now / 1500) * 0.8;
        } else if (p.kind === 'turtle') {
          // 每三小時換一個目標，慢慢爬過去
          if (v.slot !== slot) {
            v.slot = slot;
            const f = free();
            v.to = f[(slot * 11 + 5) % Math.max(1, f.length)] || [1, 1];
            v.from = [g.position.x - 0.5, g.position.z - 0.5];
            if (!v.started) {
              v.from = v.to;
              v.started = true;
            }
          }
          const k = Math.min(1, ((s.minute % 180) / 180) * 3);
          const x = v.from[0] + (v.to[0] - v.from[0]) * k;
          const z = v.from[1] + (v.to[1] - v.from[1]) * k;
          if (Math.abs(x + 0.5 - g.position.x) > 0.001) g.rotation.y = Math.atan2(x + 0.5 - g.position.x, z + 0.5 - g.position.z);
          g.position.set(x + 0.5, 0.01, z + 0.5);
        }
      });
      for (const [id, v] of this.petViews) {
        if (!seen.has(id)) {
          this.world.remove(v.g);
          this.petViews.delete(id);
        }
      }
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
      while (this.rivalCrowd.children.length > n) {
        const g = this.rivalCrowd.children[this.rivalCrowd.children.length - 1];
        this.rivalCrowd.remove(g);
        People.dispose(g, g.userData.person);
      }
      while (this.rivalCrowd.children.length < n) {
        const i = this.rivalCrowd.children.length;
        const p = People.make(window.BossLooks.randomLook(Math.random));
        p.group.userData.person = p;
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

    // ───── ⚡ 店旁的充電區 ─────
    evHomeStation() {
      const C = window.BossCity;
      return (this.sim.evStations || []).find((st) => C && C.LOTS[st.lot] && C.LOTS[st.lot].home) || null;
    }
    evHomeKey() {
      const st = this.evHomeStation();
      return st ? `${st.fast},${st.slow}` : '';
    }
    // 充電停車場：每一區中間一條車道（從馬路直直開進去），兩邊是橫向的停車格（車子轉 90 度停進去，車頭朝外）
    // 充電樁在每一格車頭那端的外側；一區放不下全部的樁就往右邊多開一區，買幾支就畫幾支
    evBayLayout(st) {
      const H = this.sim.H;
      const BW = 6.0; // 一區的寬度：充電樁＋停車格 2.25 ＋ 車道 1.5 ＋ 停車格＋充電樁 2.25
      const zs = [];
      for (let z = 0.65; z + 0.45 <= H - 0.2; z += 1.05) zs.push(z);
      const per = zs.length * 2;
      const total = st.fast + st.slow;
      const mods = Math.max(1, Math.min(4, Math.ceil(total / per)));
      return { BW, zs, per, mods };
    }
    buildEVBay(group, st) {
      const s = this.sim;
      const W = s.W;
      const H = s.H;
      const x0 = W;
      const { BW, zs, mods } = this.evBayLayout(st);
      const width = BW * mods;
      this.evBayW = width;
      const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(width, H), mat('#4f5357', { roughness: 0.95 }));
      asphalt.rotation.x = -Math.PI / 2;
      asphalt.position.set(x0 + width / 2, 0.006, H / 2);
      asphalt.receiveShadow = true;
      group.add(asphalt);
      B(group, width, 0.5, 0.15, '#cfc8bd', x0 + width / 2, 0, 0.075); // 後面一道矮牆
      const white = basic('#e9e6df');
      const kinds = [];
      for (let i = 0; i < st.fast; i++) kinds.push('fast');
      for (let i = 0; i < st.slow; i++) kinds.push('slow');
      let k = 0;
      for (let m = 0; m < mods; m++) {
        const ax = x0 + m * BW + BW / 2; // 這一區的車道中線
        for (let z = H - 0.6; z > 0.8; z -= 1.3) B(group, 0.06, 0.012, 0.5, basic('#d8d3c8'), ax, 0, z);
        for (const side of [-1, 1]) {
          for (const z of zs) {
            const kind = kinds[k];
            if (kind) k++;
            const cx = ax + side * 1.75; // 停好的車中心
            // 停車格框線：兩格之間一條橫線
            B(group, 2.0, 0.012, 0.04, white, cx, 0, z - 0.525);
            if (!kind) continue;
            const mark = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.5), basic('#2e8b57', { transparent: true, opacity: 0.5 }));
            mark.rotation.x = -Math.PI / 2;
            mark.position.set(cx + side * 0.15, 0.014, z);
            group.add(mark);
            // 充電樁：車頭那一端（外側）
            const fast = kind === 'fast';
            const px = ax + side * 2.9;
            B(group, 0.22, fast ? 1.0 : 0.7, 0.2, fast ? '#1f8f5f' : '#3b7dd8', px, 0, z + 0.3);
            B(group, 0.02, 0.16, 0.16, basic(fast ? '#bff5d6' : '#cfe3ff'), px - side * 0.12, fast ? 0.7 : 0.45, z + 0.3);
            B(group, 0.24, 0.04, 0.22, '#e9ecef', px, fast ? 1.0 : 0.7, z + 0.3);
            this.evSlots.push({ x: cx, z, side, ax, kind, car: null });
          }
        }
      }
      // 招牌柱：第一區入口旁邊
      B(group, 0.14, 2.2, 0.14, '#2ecc71', x0 + 0.15, 0, H - 0.12);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), new THREE.MeshBasicMaterial({ map: this.evSignTex(), transparent: true }));
      sign.position.set(x0 + 0.6, 2.35, H - 0.04);
      group.add(sign);
    }
    evSignTex() {
      if (this._evSign) return this._evSign;
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 144;
      const x = c.getContext('2d');
      x.fillStyle = '#2ecc71';
      x.fillRect(0, 0, 256, 144);
      x.fillStyle = '#fff';
      x.fillRect(8, 8, 240, 128);
      x.fillStyle = '#1f8f5f';
      x.font = 'bold 64px sans-serif';
      x.textAlign = 'center';
      x.fillText('⚡充電', 128, 88);
      x.font = 'bold 26px sans-serif';
      x.fillText('快充・慢充', 128, 124);
      this._evSign = new THREE.CanvasTexture(c);
      return this._evSign;
    }
    // 一台充電的車：牌子、車款、電池（照規格）、進來的電量、要充到多少
    evMakeCar(kind, brand, slot) {
      const F = window.BossFun || {};
      const g = new THREE.Group();
      this.buildEV(g, brand);
      g.traverse((o) => {
        if (o.isMesh) o.castShadow = false;
      });
      const ev = g.userData.ev;
      const spec = (F.EV_SPECS && (F.EV_SPECS[ev.brand === 'dsl' ? ev.model : ev.brand] || F.EV_SPECS.m3)) || { kwh: 65, dc: 150 };
      const fast = kind === 'fast';
      const soc = fast ? 0.1 + Math.random() * 0.25 : 0.2 + Math.random() * 0.35;
      const target = fast ? (Math.random() < 0.8 ? 0.8 : 0.9) : Math.random() < 0.6 ? 1 : 0.9;
      const car = { g, slot, kind, battery: spec.kwh, dc: spec.dc, soc, soc0: soc, target, kwh: 0, kw: 0, path: [], back: false, state: 'queue', last: this.sim.minute };
      g.userData.pick = { kind: 'evcar', car };
      this.evCarGroup.add(g);
      return car;
    }
    // 車子動作：排隊 → 開進車道 → 斜著停進格子 → 充電（照電池模擬）→ 倒車退出車道 → 開走
    // 車道一次只讓一台車進出，其他車在入口前排隊，不會撞在一起
    updateEVBay(dt) {
      if (!this.evBayOn || !this.evCarGroup) return;
      const s = this.sim;
      const F = window.BossFun || {};
      const ts = this.opts.timeScale ? this.opts.timeScale() : 1;
      const H = s.H;
      const lane = H + 1.7;
      const aisleX = s.W + 3.0; // 第一區的車道（排隊在它左邊）
      // 剛打開：照現在的使用率先停幾台正在充電的車
      if (!this._evFilled) {
        this._evFilled = true;
        const st = this.evHomeStation();
        if (st && s.chargePlan && !st.plan) s.chargePlan(st);
        const hr = Math.floor((((s.minute % 1440) + 1440) % 1440) / 60);
        for (const sl of this.evSlots) {
          if (!sl.kind || !st || !st.plan) continue;
          const dwell = sl.kind === 'fast' ? 28 : 330;
          const share = s.chargeCurve ? s.chargeCurve(sl.kind, st.lot)[hr] * 24 : 1;
          const occ = Math.min(0.85, ((st.plan[sl.kind] || 0) * dwell * share) / (1440 * Math.max(1, st[sl.kind])));
          if (Math.random() >= occ) continue;
          const brands = F.EV_BRANDS || [];
          let r = Math.random();
          const b = brands.find((x) => (r -= x.share) < 0);
          const car = this.evMakeCar(sl.kind, b && b.id, sl);
          car.soc = car.soc0 + Math.random() * (car.target - car.soc0) * 0.9;
          car.kwh = (car.soc - car.soc0) * car.battery;
          car.state = 'park';
          car.g.position.set(sl.x, 0, sl.z);
          car.g.rotation.y = sl.side < 0 ? 0 : Math.PI; // 倒車入庫：車頭朝車道
          sl.car = car;
          this.evCars.push(car);
        }
      }
      // 新來的車：先排進隊伍（有空格才來；沒空格就算這台去別家充了）
      for (const v of s.evVisits || []) {
        if (v.taken || v.at > s.minute) continue;
        v.taken = true;
        const slot = this.evSlots.find((sl) => sl.kind === v.kind && !sl.car);
        if (!slot) continue;
        const car = this.evMakeCar(v.kind, v.brand, slot);
        slot.car = car;
        // 接在隊伍最後面出現，不會跟前面的車疊在一起
        let back = aisleX - 6;
        for (const c of this.evCars) if (c !== car && (c.state === 'queue' || c.state === 'in') && Math.abs(c.g.position.z - lane) < 0.3) back = Math.min(back, c.g.position.x - 2.6);
        car.g.position.set(back, 0, lane);
        car.g.rotation.y = 0;
        this.evCars.push(car);
      }
      const spd = 3.2 * dt * Math.max(0.6, Math.min(3, ts));
      const move = (c) => {
        const tgt = c.path[0];
        if (!tgt) return true;
        const p = c.g.position;
        const dx = tgt[0] - p.x;
        const dz = tgt[1] - p.z;
        const d = Math.hypot(dx, dz);
        const step = spd * (tgt[2] || 1);
        if (d <= step) {
          p.x = tgt[0];
          p.z = tgt[1];
          c.path.shift();
        } else {
          p.x += (dx / d) * step;
          p.z += (dz / d) * step;
        }
        if (d > 0.02) {
          // 車頭朝行進方向（倒車時朝反方向），慢慢轉過去
          const want = Math.atan2(-(c.back ? -dz : dz), c.back ? -dx : dx);
          let diff = want - c.g.rotation.y;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          c.g.rotation.y += diff * Math.min(1, dt * 8);
        }
        return !c.path.length;
      };
      // 入口前排隊的位置
      let queueN = 0;
      this.evCars = this.evCars.filter((c) => {
        if (c.state === 'queue') {
          if (!this.evAisle) {
            // 輪到我：沿馬路開到入口、右轉進車道、開到格子前、斜著停進去
            this.evAisle = c;
            c.state = 'in';
            // 沿馬路開到那一區的入口 → 轉進車道 → 開過頭一點 → 倒車斜著退進格子（充電孔在車尾，跟真的充電站一樣）
            const sl = c.slot;
            c.path = [[sl.ax - 0.6, lane], [sl.ax, lane - 0.8], [sl.ax - sl.side * 0.15, sl.z - 1.0]];
            c.backIn = [[sl.ax + sl.side * 0.7, sl.z - 0.12, 0.45], [sl.x, sl.z, 0.4]];
          } else {
            let qx = aisleX - 2.6 - queueN * 2.5;
            queueN++;
            // 前面還有車在路上（正要轉進去）：跟它保持一個車身的距離
            for (const o of this.evCars) if (o !== c && o.state === 'in' && Math.abs(o.g.position.z - lane) < 0.3 && o.g.position.x > c.g.position.x) qx = Math.min(qx, o.g.position.x - 2.6);
            c.path = [[Math.max(c.g.position.x, qx), lane]];
            move(c);
            return true;
          }
        }
        if (c.state === 'in') {
          if (move(c)) {
            if (c.backIn) {
              // 開過頭了：換倒車檔退進去
              c.path = c.backIn;
              c.backIn = null;
              c.back = true;
              return true;
            }
            c.back = false;
            c.state = 'park';
            c.g.rotation.y = c.slot.side < 0 ? 0 : Math.PI; // 車頭朝車道
            c.last = s.minute;
            if (this.evAisle === c) this.evAisle = null;
          }
          return true;
        }
        if (c.state === 'park') {
          // 充電：照現在電量的充電功率，一分鐘一分鐘加上去
          const dm = Math.max(0, s.minute - c.last);
          c.last = s.minute;
          c.kw = F.evChargeKw ? F.evChargeKw(c.kind, c.soc, c.dc) : 0;
          if (dm > 0 && c.soc < c.target) {
            let left = dm;
            while (left > 0 && c.soc < c.target) {
              const m = Math.min(1, left);
              const kw = F.evChargeKw(c.kind, c.soc, c.dc);
              c.soc = Math.min(c.target, c.soc + (kw * m) / 60 / c.battery);
              c.kwh += (kw * m) / 60;
              left -= m;
            }
          }
          if (c.soc >= c.target - 1e-6) {
            c.kw = 0;
            if (this.evAisle) return true; // 充飽了，等車道空出來再倒車
            this.evAisle = c;
            c.state = 'out';
            c.back = true;
            c.slot.car = null;
            // 車頭本來就朝車道：直接往前開出來、轉向馬路
            const sl = c.slot;
            c.back = false;
            c.path = [[sl.ax + sl.side * 0.35, sl.z + 0.2, 0.45], [sl.ax, Math.min(sl.z + 1.0, lane - 1.2), 0.5], [sl.ax, lane - 0.8], [sl.ax + 0.6, lane]];
            c.exitPath = null;
          }
          return true;
        }
        if (c.state === 'out') {
          if (move(c)) {
            if (c.back && c.exitPath) {
              c.back = false;
              c.path = c.exitPath;
            } else {
              // 開上馬路：車道讓給下一台，往右開走
              if (this.evAisle === c) this.evAisle = null;
              c.state = 'leave';
              c.path = [[s.W * 1.5 + 22, lane]];
            }
          }
          return true;
        }
        if (c.state === 'leave') {
          if (move(c)) {
            this.evCarGroup.remove(c.g);
            return false;
          }
          return true;
        }
        return true;
      });
      if (this.evAisle && !this.evCars.includes(this.evAisle)) this.evAisle = null;
    }

    // ───── 街景：車流、鴿子、時鐘 ─────
    carWheels(g, L, rad) {
      for (const x of [-L / 2 + 0.4, L / 2 - 0.4]) for (const z of [-0.38, 0.38]) {
        const w = C(g, rad, rad, 0.12, '#1d1d1d', x, 0.0, z, 10);
        w.rotation.x = Math.PI / 2;
        w.position.y = rad;
      }
    }

    // ⚡ 路上的電動車：照真車的側面輪廓擠出來（車頭朝 +x），電斯拉各車款一看就認得；車頭貼惡搞標誌，掛綠框電動車車牌
    buildEV(g, want) {
      const F = window.BossFun || {};
      const brands = F.EV_BRANDS || [{ id: 'dsl', color: '#f2f2f2', share: 1 }];
      let r = Math.random();
      const brand = (want && brands.find((b) => b.id === want)) || brands.find((b) => (r -= b.share) < 0) || brands[0];
      let model = Math.random() < 0.5 ? 'hatch' : 'suv';
      if (brand.id === 'dsl') {
        const m = Math.random();
        model = m < 0.34 ? 'm3' : m < 0.68 ? 'my' : m < 0.76 ? 'ms' : m < 0.83 ? 'mx' : m < 0.89 ? 'ct' : m < 0.92 ? 'rd' : 'cab';
      }
      const D = LOFTS[model];
      const P = D ? null : EV_PROFILES[model];
      const dslCol = ['#f2f2f2', '#1d1d1f', '#b3261e', '#2b4c8c', '#8a8d91'][Math.floor(Math.random() * 5)];
      const col = (D || P).color || (brand.id === 'dsl' ? dslCol : brand.color);
      const steel = P && P.steel;
      const paint = steel ? { roughness: 0.25, metalness: 0.8 } : { roughness: 0.3, metalness: 0.35 };
      const glassMat = mat('#1b242c', { roughness: 0.12, metalness: 0.55 });
      const add = (geo, m) => {
        const o = new THREE.Mesh(geo, m);
        o.castShadow = true;
        g.add(o);
        return o;
      };
      const head = basic('#fff3c4');
      const tail = basic('#ff3b2f');
      const wheel = (x, z, rad, rim) => {
        const w = C(g, rad, rad, 0.12, '#1d1d1d', x, 0, z, 16);
        w.rotation.x = Math.PI / 2;
        w.position.y = rad;
        // 輪框：電動車常見的空力輪框（大圓盤＋中間深色）
        const hub = C(g, rad * 0.7, rad * 0.7, 0.02, rim || (steel ? '#2b2b2e' : '#b9bec4'), x, 0, z + Math.sign(z) * 0.062, 16);
        hub.rotation.x = Math.PI / 2;
        hub.position.y = rad;
        const cap = C(g, rad * 0.22, rad * 0.22, 0.022, '#2a2d31', x, 0, z + Math.sign(z) * 0.066, 10);
        cap.rotation.x = Math.PI / 2;
        cap.position.y = rad;
      };
      const badge = (x, y, tilt) => {
        const m = new THREE.Mesh(badgeGeo(), evLogoMat(brand.id));
        m.position.set(x, y + 0.006, 0);
        m.up.set(-1, 0, 0);
        m.lookAt(x + Math.sin(tilt), y + Math.cos(tilt), 0);
        g.add(m);
      };
      let L;
      let plateY = 0.16;
      if (D) {
        // 圓潤車身＋整片玻璃車艙
        const parts = loftParts(model);
        add(parts.body, mat(col, paint));
        add(parts.glass, glassMat);
        L = D.L;
        const f = loftAt(D, 0.035);
        const r = loftAt(D, 0.975);
        const dark = mat('#15181b', { roughness: 0.6 });
        const lens = mat('#2a3138', { roughness: 0.15, metalness: 0.6 });
        const nose = loftAt(D, 0);
        const back = loftAt(D, 1);
        // 頭燈：貼在車頭兩角的引擎蓋上，順著引擎蓋斜度、往後掠的細長燈（深色燈殼＋一條白色日行燈）
        const h1 = loftAt(D, 0.05);
        const h2 = loftAt(D, 0.09);
        const slope = Math.atan2(h2.y1 - h1.y1, h1.x - h2.x);
        for (const z of [-1, 1]) {
          const hz = z * (h1.hw - 0.09);
          const shell = B(g, 0.1, 0.014, 0.085, lens, h1.x, h1.y1 - 0.012, hz);
          shell.rotation.set(z * 0.18, z * 0.32, -slope);
          const drl = B(g, 0.085, 0.016, 0.014, head, h1.x + 0.01, h1.y1 - 0.011, hz + z * 0.03);
          drl.rotation.set(z * 0.18, z * 0.32, -slope);
        }
        // 車頭正面：黑色進氣口（電動車沒有水箱罩）；新款 Modal Y、計程艙多一條燈條
        B(g, 0.014, 0.028, nose.hw * 1.5, dark, nose.x + 0.002, nose.y0 + 0.008, 0);
        if (D.front) B(g, 0.014, 0.012, nose.hw * 2 - 0.05, head, nose.x + 0.002, nose.y1 - 0.03, 0);
        // 尾燈：車尾正面一整條，或左右兩顆從車尾包到側邊
        if (D.tail === 'bar' || brand.id !== 'dsl') {
          if (D.tail === 'bar') B(g, 0.016, 0.024, back.hw * 2 - 0.06, tail, back.x + 0.004, back.y1 - 0.045, 0);
          else for (const z of [-1, 1]) B(g, 0.016, 0.04, 0.12, tail, back.x + 0.004, back.y1 - 0.06, z * (back.hw - 0.075));
        } else
          for (const z of [-1, 1]) {
            B(g, 0.016, 0.038, 0.13, tail, back.x + 0.004, back.y1 - 0.05, z * (back.hw - 0.075));
          }
        // 後照鏡：擋風玻璃底部兩側，車身同色
        const ws = (D.k.find((p) => p[3] != null) || D.k[4])[0];
        const mr = loftAt(D, ws + 0.035);
        for (const z of [-1, 1]) {
          // 鏡殼貼在車門上緣（車身在這個高度最寬），往外凸一點
          B(g, 0.055, 0.035, 0.06, mat(col, paint), mr.x, mr.y1 - 0.045, z * (mr.hw + 0.01));
          B(g, 0.008, 0.026, 0.045, glassMat, mr.x - 0.03, mr.y1 - 0.04, z * (mr.hw + 0.015));
        }
        // 輪子：輪胎藏在輪拱裡，空力輪框
        for (const u of D.wheels) {
          const w = loftAt(D, u);
          for (const z of [-1, 1]) wheel(w.x, z * (w.hw - 0.065), D.rad, D.rim);
        }
        // 惡搞標誌：引擎蓋前緣，順著引擎蓋的斜度
        const l1 = loftAt(D, D.logo);
        const l2 = loftAt(D, D.logo + 0.05);
        badge(l1.x, l1.y1 + 0.014, Math.atan2(l2.y1 - l1.y1, l1.x - l2.x));
        plateY = nose.y0 + 0.04;
      } else {
        // 賽伯鐵牛：不鏽鋼三角形，維持稜角分明的擠出車身
        add(evGeo(model + 'b', P.body, P.w), mat(col, paint));
        if (P.glass) add(evGeo(model + 'g', P.glass, P.gw || P.w - 0.14), glassMat);
        L = P.L;
        B(g, 0.025, 0.03, P.w, head, P.bar[0], P.bar[1], 0);
        B(g, 0.025, 0.03, P.w, tail, P.bar[2], P.bar[3], 0);
        for (const x of P.wheels) for (const z of [-1, 1]) wheel(x, z * (P.w / 2 - 0.02), P.rad);
        badge(P.logo[0], P.logo[1], P.logo[2]);
      }
      // 綠框白底的電動車車牌（前後各一，台灣車牌 32×15 公分）
      for (const sx of [1, -1]) {
        B(g, 0.012, 0.066, 0.14, '#22a35a', sx * (L / 2 + 0.006), plateY, 0);
        B(g, 0.014, 0.05, 0.124, '#ffffff', sx * (L / 2 + 0.009), plateY + 0.008, 0);
      }
      g.userData.ev = { brand: brand.id, model };
      return L;
    }

    makeCar() {
      const s = this.sim;
      const r = Math.random();
      // 電動車越來越多（跟著遊戲裡的普及程度）；各牌子照市占出現，電斯拉最多
      const evP = Math.min(0.6, 0.25 * (s.evShare || 1));
      const type = r < 0.1 ? 'bus' : r < 0.25 ? 'truck' : Math.random() < evP ? 'ev' : 'car';
      const g = new THREE.Group();
      let L;
      if (type === 'ev') L = this.buildEV(g);
      else {
        const colors = ['#d9482b', '#2c6fbb', '#f2f2f2', '#2b2b30', '#f2c14e', '#5aa9a0', '#8e44ad', '#bdc3c7'];
        const col = type === 'bus' ? '#2f8f6b' : type === 'truck' ? '#f2f2f2' : colors[Math.floor(Math.random() * colors.length)];
        L = type === 'bus' ? 4.2 : type === 'truck' ? 2.6 : 1.9;
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
        this.carWheels(g, L, 0.17);
        // 頭燈、尾燈（晚上會亮）
        const head = basic('#fff3c4');
        const tail = basic('#ff3b2f');
        for (const z of [-0.28, 0.28]) {
          B(g, 0.03, 0.08, 0.12, head, L / 2 + 0.01, 0.32, z);
          B(g, 0.03, 0.08, 0.12, tail, -L / 2 - 0.01, 0.32, z);
        }
      }
      // 車燈光暈的形狀大家共用一個（車子開走只是拿掉，不會一直多出新的幾何）
      if (!this.beamGeo) this.beamGeo = new THREE.PlaneGeometry(2.4, 1.1);
      const beam = new THREE.Mesh(this.beamGeo, this.glowMat);
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

    // ───── 🚓 街頭時事的畫面：毒駕追逐、臨檢、騎樓倒地的人和救護車 ─────
    makeVehicle(kind) {
      const g = new THREE.Group();
      const body = kind === 'police' ? '#f4f6f8' : kind === 'ambulance' ? '#ffffff' : '#2b2b30';
      const L = kind === 'ambulance' ? 2.5 : 1.9;
      B(g, L, kind === 'ambulance' ? 0.9 : 0.45, 0.8, body, 0, 0.18, 0, { roughness: 0.4, metalness: 0.2 });
      if (kind !== 'ambulance') {
        B(g, L * 0.55, 0.32, 0.72, body, -0.1, 0.63, 0, { roughness: 0.4 });
        B(g, L * 0.5, 0.26, 0.74, basic('#a9c9de'), -0.1, 0.66, 0);
      } else B(g, 0.6, 0.3, 0.82, basic('#a9c9de'), L / 2 - 0.35, 0.65, 0);
      if (kind === 'police') B(g, L * 0.98, 0.12, 0.82, '#1f3a6b', 0, 0.36, 0);
      if (kind === 'ambulance') B(g, L * 0.98, 0.1, 0.82, '#d23c33', 0, 0.55, 0);
      for (const x of [-L / 2 + 0.4, L / 2 - 0.4]) for (const z of [-0.38, 0.38]) {
        const w = C(g, 0.17, 0.17, 0.12, '#1d1d1d', x, 0, z, 10);
        w.rotation.x = Math.PI / 2;
        w.position.y = 0.17;
      }
      let lights = null;
      if (kind === 'police' || kind === 'ambulance') {
        // 警示燈：紅藍（救護車紅白）輪流閃
        const a = new THREE.MeshBasicMaterial({ color: '#ff2a2a' });
        const b = new THREE.MeshBasicMaterial({ color: kind === 'police' ? '#2a6bff' : '#ffffff' });
        const top = kind === 'ambulance' ? 1.1 : 0.98;
        const m1 = new THREE.Mesh(boxGeo(0.18, 0.1, 0.3), a);
        m1.position.set(kind === 'ambulance' ? L / 2 - 0.4 : -0.1, top, -0.16);
        const m2 = new THREE.Mesh(boxGeo(0.18, 0.1, 0.3), b);
        m2.position.set(kind === 'ambulance' ? L / 2 - 0.4 : -0.1, top, 0.16);
        g.add(m1, m2);
        lights = [a, b];
      }
      g.traverse((o) => {
        if (o.isMesh) o.castShadow = false;
      });
      this.world.add(g);
      return { g, lights, L };
    }

    flashLights(v, now) {
      if (!v || !v.lights) return;
      const on = Math.floor(now / 220) % 2 === 0;
      v.lights[0].color.set(on ? '#ff2a2a' : '#3a0a0a');
      v.lights[1].color.set(!on ? (v.lights[1].userData.white ? '#ffffff' : '#2a6bff') : '#0a1a3a');
    }

    makeOfficer(kind = 'police') {
      const look = { ...window.BossLooks.randomLook(Math.random), shirt: kind === 'police' ? '#1f3a6b' : '#f2f2f2', hat: 'cap', hatColor: kind === 'police' ? '#1f3a6b' : '#d23c33', suit: false, extra: null, apron: null, tie: null };
      const p = People.make(look);
      p.group.traverse((o) => {
        if (o.isMesh) o.castShadow = false;
      });
      this.world.add(p.group);
      return p;
    }

    dropIncident(key) {
      const it = this.inc && this.inc[key];
      if (!it) return;
      for (const v of it.cars || []) {
        this.world.remove(v.g);
        People.dispose(v.g);
      }
      for (const p of it.people || []) {
        this.world.remove(p.group);
        People.dispose(p.group, p);
      }
      for (const m of it.props || []) {
        this.world.remove(m);
        People.dispose(m);
      }
      this.inc[key] = null;
    }

    updateIncidents(dt, now, ts) {
      const s = this.sim;
      const S = s.street;
      this.inc = this.inc || {};
      if (!S) return;
      const H = s.H;
      const run = ts > 0 ? dt : 0;
      // 毒駕追逐：蛇行的車在前、警車在後；有時候在店門口被攔下來
      const ch = this.inc.chase;
      if (S.chase && (!ch || ch.id !== S.chase.id)) {
        this.dropIncident('chase');
        const sus = this.makeVehicle('car');
        const pol = this.makeVehicle('police');
        const x0 = -s.W * 0.5 - 16;
        sus.g.position.set(x0, 0, H + 1.7);
        pol.g.position.set(x0 - 3.2, 0, H + 1.7);
        this.inc.chase = { id: S.chase.id, arrest: S.chase.arrest, cars: [sus, pol], people: [], phase: 'drive', t: 0 };
      }
      const c = this.inc.chase;
      if (c) {
        const [sus, pol] = c.cars;
        c.t += run;
        this.flashLights(pol, now);
        if (c.phase === 'drive') {
          const v = 12 * run;
          sus.g.position.x += v;
          pol.g.position.x += v;
          // 蛇行
          sus.g.position.z = H + 1.7 + Math.sin(c.t * 7) * 0.35;
          sus.g.rotation.y = -Math.cos(c.t * 7) * 0.25;
          const stopX = s.W / 2 + 2.5;
          if (c.arrest && sus.g.position.x >= stopX) {
            c.phase = 'stop';
            sus.g.rotation.y = -0.35;
            sus.g.position.z = H + 1.5;
            pol.g.position.x = stopX - 2.8;
            // 兩位警察下車，把駕駛帶到警車旁邊
            const o1 = this.makeOfficer();
            const o2 = this.makeOfficer();
            const d = People.make({ ...window.BossLooks.randomLook(Math.random), shirt: '#555b66' });
            this.world.add(d.group);
            o1.group.position.set(stopX - 0.6, 0, H + 0.95);
            o2.group.position.set(stopX + 0.6, 0, H + 0.95);
            d.group.position.set(stopX, 0, H + 0.95);
            for (const p of [o1, o2, d]) p.group.scale.setScalar(1.25);
            c.people = [o1, o2, d];
          } else if (sus.g.position.x > s.W * 1.5 + 18) this.dropIncident('chase');
        } else if (c.phase === 'stop') {
          const [o1, o2, d] = c.people;
          // 駕駛被壓著、手舉起來；警察一個在講無線電
          d.armR.rotation.x = -2.8;
          d.armL.rotation.x = -2.8;
          d.group.rotation.y = Math.sin(now / 300) * 0.1;
          o1.armR.rotation.x = -1.4;
          o1.group.rotation.y = Math.PI / 2;
          o2.group.rotation.y = -Math.PI / 2;
          o2.armL.rotation.x = -0.6 + Math.sin(now / 180) * 0.2;
          if (!(S.arrestUntil > s.minute)) {
            for (const p of c.people) this.world.remove(p.group);
            c.people = [];
            c.phase = 'leave';
          }
        } else if (c.phase === 'leave') {
          const v = 7 * run;
          pol.g.position.x += v;
          sus.g.position.x += v * 0.6;
          sus.g.rotation.y *= 0.95;
          if (pol.g.position.x > s.W * 1.5 + 18) this.dropIncident('chase');
        }
      }
      // 臨檢：路口停一台警車、擺三角錐，警察揮指揮棒
      const C2 = S.checkpoint;
      const checking = C2 && s.minute >= C2.from && s.minute <= C2.to;
      if (checking && !this.inc.check) {
        const pol = this.makeVehicle('police');
        const x = s.W - 0.5;
        pol.g.position.set(x, 0, H + 3.05);
        pol.g.rotation.y = Math.PI;
        const props = [];
        for (let i = 0; i < 3; i++) {
          const cone = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.38, 10), mat('#ff7a1a'));
          cone.position.set(x - 2.2 + i * 0.7, 0.19, H + 2.35);
          this.world.add(cone);
          props.push(cone);
        }
        const o = this.makeOfficer();
        o.group.position.set(x - 1.2, 0, H + 2.45);
        o.group.scale.setScalar(1.25);
        o.group.rotation.y = -Math.PI / 2;
        // 指揮棒（發光）
        const stick = new THREE.Mesh(boxGeo(0.05, 0.4, 0.05), new THREE.MeshBasicMaterial({ color: '#ff3b2f' }));
        stick.position.set(0, -0.35, 0.05);
        o.armR.add(stick);
        this.inc.check = { cars: [pol], people: [o], props };
      } else if (!checking && this.inc.check) this.dropIncident('check');
      if (this.inc.check) {
        this.flashLights(this.inc.check.cars[0], now);
        this.inc.check.people[0].armR.rotation.x = -1.6 + Math.sin(now / 250) * 0.6;
      }
      // 騎樓倒地的人：側躺、一直抽動；救護車來了之後被送走
      const col = S.collapse;
      const lying = col && col.lying && col.day === s.day;
      if (lying && !this.inc.collapse) {
        const p = People.make({ ...window.BossLooks.randomLook(Math.random), shirt: '#4a4f57' });
        p.group.scale.setScalar(1.25);
        p.group.rotation.z = Math.PI / 2;
        if (p.blob) p.blob.visible = false;
        p.group.position.set(Math.max(0.6, s.doorX - 1.6), 0.25, H + 0.6);
        this.world.add(p.group);
        const vape = new THREE.Mesh(boxGeo(0.05, 0.03, 0.18), mat('#2b2b30'));
        vape.position.set(Math.max(0.6, s.doorX - 1.6) + 0.5, 0.02, H + 0.9);
        this.world.add(vape);
        this.inc.collapse = { people: [p], props: [vape], cars: [] };
      } else if (!lying && this.inc.collapse) this.dropIncident('collapse');
      if (this.inc.collapse) {
        const p = this.inc.collapse.people[0];
        // 不規則的抽動
        const j = Math.sin(now / 45) * Math.sin(now / 170);
        p.group.rotation.x = j * 0.08;
        p.armR.rotation.x = -0.4 + j * 0.5;
        p.legL.rotation.x = j * 0.4;
        const amb = S.ambulanceUntil > s.minute;
        if (amb && !this.inc.collapse.cars.length) {
          const v = this.makeVehicle('ambulance');
          v.lights[1].userData.white = true;
          v.g.position.set(p.group.position.x + 0.5, 0, H + 1.7);
          this.inc.collapse.cars.push(v);
        }
        if (this.inc.collapse.cars[0]) this.flashLights(this.inc.collapse.cars[0], now);
      }
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
      People.mergeGroup(g, [head, ...wings], { cast: false });
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
      this.updateIncidents(dt, now, ts);
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

      // 後場房間的名牌：用途、幾個人在用、是誰（看後場或拉近的時候、或房間裡有人時顯示）
      if (s.hasBackroom && root.BossFun.ROOMS) {
        const backView = this.camRot === 1 || this.camRot === 2;
        for (const id of ['storage', 'rest', 'office', 'toilet']) {
          const lv = s.roomLv(id);
          if (!lv) continue;
          const occ = s.roomOccupants(id);
          if (!occ.length && !backView) continue;
          const R = root.BossFun.ROOMS[id];
          const cap = s.roomSpots(id).length;
          const names = occ.filter((a) => s.staff.includes(a)).map((a) => a.name);
          const guests = occ.length - names.length;
          const text = `${R.icon}${R.name.replace('員工', '').replace('老闆', '')} ${occ.length}/${cap}${names.length ? `・${names.slice(0, 3).join('、')}` : ''}${guests ? `・客人 ${guests}` : ''}`;
          const el = this.label(`room-${id}`, `room-tag${occ.length ? ' busy' : ''}`);
          if (el.textContent !== text) el.textContent = text;
          const { x0, x1 } = s.roomSlot(id);
          this.place(el, (x0 + x1) / 2, 1.6, -1.9);
        }
        if (this.stallDoor) this.stallDoor.visible = s.roomOccupants('toilet').some((a) => a.inRoom.phase === 'use' && a.inRoom.act === 'stall' && !s.staff.includes(a));
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
        } else if (h.kind === 'pet') {
          // 指著店寵：在牠身上標名字（鸚鵡站在高高的架子上）
          const v = this.petViews && this.petViews.get(h.pet.id);
          el.style.width = '';
          el.style.height = '';
          el.dataset.label = `${(root.BossFun.PETS[h.pet.kind] || {}).icon || '🐾'} ${h.pet.name}`;
          if (v) this.place(el, v.g.position.x, h.pet.kind === 'parrot' ? 1.45 : 0.4, v.g.position.z, '-50%', '-50%');
        } else if (h.staff || h.customer) {
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
