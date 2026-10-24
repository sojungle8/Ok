// 🗺️ 城市地圖（雙北）：街區、道路、河和橋，你的店、可以去的地方、同城的分店都在這張圖上
// 座標用「街區」：x 0～8（西→東）、y 0～6（北→南）；道路在街區之間，路口是 (0～9, 0～7) 的格點
// 開店的地點會改變人潮、房租、客群；出門的路程用實際走的路算時間
(function (root) {
  const W = 9;
  const H = 7;
  // 街區種類：R 住宅、O 辦公、C 商店街、P 公園、S 學校、I 倉庫工廠、W 淡水河、T 廟、M 夜市、H 高鐵站
  const ROWS = [
    'RIWPIRROO',
    'CRWCCMRCO',
    'RRWCRCROO',
    'RIWRPCCCC',
    'RHWTCRRPO',
    'RCWRRRCSR',
    'PRWCRRPRR',
  ];
  const typeAt = (x, y) => (ROWS[y] && ROWS[y][x]) || 'R';
  // 過河的橋：哪幾條東西向的路可以跨過淡水河（路口的 y）
  const RIVER_X = 2;
  const BRIDGES = [2, 5];

  // 地標：出門可以去的地方、同城分店、高鐵站
  const LANDMARKS = {
    market: { x: 5, y: 1, name: '夜市', icon: '🏮' },
    wholesale: { x: 4, y: 0, name: '批發市場', icon: '📦' },
    temple: { x: 3, y: 4, name: '廟', icon: '🙏' },
    club: { x: 7, y: 1, name: '夜店', icon: '🪩' },
    gym: { x: 6, y: 3, name: '健身房', icon: '🏋️' },
    bank: { x: 7, y: 3, name: '銀行', icon: '🏦' },
    detective: { x: 3, y: 6, name: '徵信社', icon: '🕵️' },
    guild: { x: 5, y: 2, name: '商圈聯誼會', icon: '🤝' },
    hsr: { x: 1, y: 4, name: '板橋高鐵站', icon: '🚄' },
    school: { x: 7, y: 5, name: '國小', icon: '🏫' },
    mrt: { x: 5, y: 3, name: '捷運站', icon: 'Ⓜ️' },
    park: { x: 4, y: 3, name: '公園', icon: '🌳' },
    // 同城的分店地點（對應 BRANCH_SITES）
    xinyi: { x: 8, y: 3, name: '信義商圈', icon: '🏙️', site: true },
    ximen: { x: 3, y: 2, name: '西門町', icon: '🎬', site: true },
    banqiao: { x: 1, y: 5, name: '板橋車站', icon: '🚉', site: true },
    xinzhuang: { x: 0, y: 1, name: '新莊老街', icon: '🏮', site: true },
  };

  // ───── 開店地點 ─────
  // traffic：路過的人；rent：房租；mix：客群；hours：哪些時段特別多（或少）人；weekend：週末
  // fit：各產業適不適合（客人會不會因為「剛好路過」就進來）；near：隔壁鄰居（會發生的事）
  const SPOTS = {
    nightmarket: {
      x: 4, y: 1, name: '夜市旁', icon: '🏮',
      desc: '晚上人潮爆滿、週末更誇張；白天冷清，房租貴，垃圾和噪音也多。',
      traffic: 1.15, rent: 1.35, weekend: 1.15,
      hours: { 7: 0.7, 8: 0.7, 9: 0.75, 10: 0.8, 11: 0.85, 17: 1.25, 18: 1.35, 19: 1.4, 20: 1.4, 21: 1.35, 22: 1.25 },
      mix: { student: 1.2, family: 1.2, elderly: 0.8, office: 0.8 },
      fit: { breakfast: 0.88, noodle: 1.1, drinks: 1.15, barber: 0.95, scooter: 0.9, store: 1.1 },
      grime: 1.15,
      near: '夜市攤販',
    },
    school: {
      x: 6, y: 5, name: '學校旁', icon: '🏫',
      desc: '上學前、放學後學生一大群；寒暑假學生少一大半。',
      traffic: 1.05, rent: 1.0, weekend: 0.8,
      hours: { 6: 1.3, 7: 1.5, 8: 1.1, 12: 1.1, 16: 1.4, 17: 1.4 },
      mix: { student: 1.6, office: 0.7, elderly: 0.9, family: 1.05 },
      fit: { breakfast: 1.15, noodle: 0.95, drinks: 1.15, barber: 1.0, scooter: 1.0, store: 1.18 },
      breakMonths: [1, 2, 7, 8],
      near: '國小和補習班',
    },
    alley: {
      x: 4, y: 6, name: '住宅巷弄', icon: '🏘️',
      desc: '路過的人不多，但房租便宜，附近住戶會變熟客；長輩和家庭最多。',
      traffic: 0.85, rent: 0.72, weekend: 1.05,
      hours: {},
      mix: { elderly: 1.35, family: 1.25, student: 0.85, office: 0.7 },
      fit: { breakfast: 1.08, noodle: 1.0, drinks: 1.05, barber: 1.25, scooter: 1.3, store: 1.05 },
      loyal: 1.06,
      near: '社區住戶',
    },
    office: {
      x: 7, y: 2, name: '辦公區', icon: '🏢',
      desc: '平日早上和中午上班族擠爆、出手大方；週末像空城。',
      traffic: 1.1, rent: 1.25, weekend: 0.55,
      hours: { 7: 1.35, 8: 1.4, 11: 1.3, 12: 1.5, 13: 1.25, 18: 1.15 },
      mix: { office: 1.7, student: 0.6, elderly: 0.6, family: 0.8 },
      fit: { breakfast: 1.05, noodle: 1.1, drinks: 1.0, barber: 1.05, scooter: 0.9, store: 1.12 },
      near: '辦公大樓',
    },
    mrt: {
      x: 5, y: 3, name: '捷運站口', icon: 'Ⓜ️',
      desc: '通勤族整天經過，人潮最多，房租也最貴；偶爾會遇到出口施工。',
      traffic: 1.3, rent: 1.5, weekend: 0.95,
      hours: { 7: 1.3, 8: 1.35, 17: 1.3, 18: 1.3 },
      mix: { office: 1.3, student: 1.15, elderly: 0.8, family: 0.95 },
      fit: { breakfast: 1.1, noodle: 1.05, drinks: 1.05, barber: 0.95, scooter: 0.75, store: 1.25 },
      near: '捷運出口',
    },
    temple: {
      x: 4, y: 4, name: '廟口', icon: '🧧',
      desc: '長輩和信徒多，初一十五、廟會的時候人潮大爆發；平常普通，房租不貴。',
      traffic: 0.95, rent: 0.85, weekend: 1.1,
      hours: { 6: 1.2, 7: 1.2, 9: 1.15, 10: 1.15 },
      mix: { elderly: 1.5, family: 1.1, office: 0.7, student: 0.85 },
      fit: { breakfast: 1.12, noodle: 1.0, drinks: 1.0, barber: 1.05, scooter: 1.15, store: 1.05 },
      near: '廟和香舖',
    },
  };
  // 開店畫面的星等：照 AI 試玩一年（一般難度、兩個種子）本店淨利跟「一般街邊」比的結果
  // ★★★★★ 多賺三成五以上、★★★★ 多賺一成五、★★★ 差不多、★★ 少賺一點、★ 少賺一成五以上
  const STARS = {
    breakfast: { nightmarket: 1, school: 5, alley: 3, office: 5, mrt: 5, temple: 2 },
    noodle: { nightmarket: 4, school: 3, alley: 2, office: 4, mrt: 4, temple: 3 },
    drinks: { nightmarket: 5, school: 4, alley: 2, office: 3, mrt: 5, temple: 3 },
    barber: { nightmarket: 2, school: 3, alley: 4, office: 3, mrt: 2, temple: 3 },
    scooter: { nightmarket: 3, school: 2, alley: 3, office: 3, mrt: 1, temple: 3 },
    store: { nightmarket: 2, school: 3, alley: 2, office: 3, mrt: 5, temple: 4 },
  };

  // 舊存檔沒有選地點：當成一般街道，什麼都不加減
  const LEGACY = { x: 4, y: 5, name: '街邊', icon: '🏪', desc: '', traffic: 1, rent: 1, weekend: 1, hours: {}, mix: {}, fit: {}, near: '' };

  const spotOf = (id) => SPOTS[id] || LEGACY;

  // ───── 鄰居帶來的事：每個地點各有各的（好事壞事都有），一週最多一件 ─────
  // p：每天發生的機率；mult／days：之後幾天的人潮；grime：門口變髒
  const NEIGHBOR_EVENTS = {
    nightmarket: [
      { id: 'nm_fest', p: 0.025, text: '🎆 夜市這週末辦美食節，人潮比平常還多', mult: 1.15, days: 3 },
      { id: 'nm_trash', p: 0.02, text: '🗑️ 夜市攤販收攤後把垃圾堆在你門口，早上要先清一輪', grime: 5 },
      { id: 'nm_raid', p: 0.012, text: '🚓 警察取締夜市違規攤販，這幾天夜市人比較少', mult: 0.9, days: 4 },
    ],
    school: [
      { id: 'sc_exam', p: 0.02, text: '📚 隔壁國小段考週，放學的學生和家長特別多', mult: 1.12, days: 5, noBreak: true },
      { id: 'sc_sport', p: 0.012, text: '🏃 學校運動會，家長一大早就來排隊', mult: 1.25, days: 1, noBreak: true },
      { id: 'sc_flu', p: 0.01, text: '🤒 學校流感停課三天，學生少了一大半', mult: 0.85, days: 3, noBreak: true },
    ],
    alley: [
      { id: 'al_chief', p: 0.018, text: '🏘️ 里長在社區 LINE 群組幫你宣傳：「支持在地好店！」', mult: 1.08, days: 10 },
      { id: 'al_noise', p: 0.01, text: '🏘️ 樓上住戶嫌你們太吵，貼了一張紙條在門口', mult: 0.96, days: 5 },
      { id: 'al_aunt', p: 0.015, text: '👵 巷口的阿姨們把你的店當成聚會地點，天天來報到', mult: 1.06, days: 14 },
    ],
    office: [
      { id: 'of_new', p: 0.009, text: '🏢 附近新大樓進駐兩家公司，中午排隊的人變多了', mult: 1.1, days: 30 },
      { id: 'of_move', p: 0.009, text: '🏢 隔壁大樓一家公司搬去內湖，中午人少了一點', mult: 0.9, days: 30 },
      { id: 'of_ot', p: 0.015, text: '💻 附近科技公司趕專案，晚上加班的人都來買宵夜', mult: 1.08, days: 7 },
    ],
    mrt: [
      { id: 'mrt_works', p: 0.012, text: '🚧 捷運出口要施工兩週，圍籬把人行道擋了一半', mult: 0.82, days: 14 },
      { id: 'mrt_concert', p: 0.015, text: '🎤 附近有演唱會，散場的人潮從捷運站湧出來', mult: 1.2, days: 1 },
      { id: 'mrt_delay', p: 0.012, text: '🚇 捷運號誌故障，大家在出口等公車，順便進來買東西', mult: 1.1, days: 1 },
    ],
    temple: [
      { id: 'tp_fair', p: 0.015, text: '🏮 廟會遶境經過門口，鞭炮聲中人潮塞爆整條街', mult: 1.4, days: 1, grime: 4 },
      { id: 'tp_tour', p: 0.012, text: '🚌 進香團的遊覽車停在廟口，一車一車的阿公阿嬤', mult: 1.15, days: 2 },
    ],
  };


  // 這個地點在某個時段的人潮倍率
  function spotMult(id, ind, hour, weekday, month) {
    const sp = spotOf(id);
    let m = sp.traffic * ((sp.fit && sp.fit[ind]) || 1) * (sp.hours[hour] || 1);
    if (weekday >= 5) m *= sp.weekend || 1;
    return m;
  }

  // 這個地點的客群倍率（寒暑假學校旁的學生少很多）
  function spotMix(id, type, month) {
    const sp = spotOf(id);
    let m = (sp.mix && sp.mix[type]) || 1;
    if (type === 'student' && sp.breakMonths && sp.breakMonths.includes(month)) m *= 0.4;
    return m;
  }

  // ───── 道路：路口 (0～W, 0～H) 之間的連線，沿著街區邊緣走；河只能從橋過 ─────
  function neighbors(ix, iy) {
    const out = [];
    const add = (nx, ny) => {
      if (nx < 0 || ny < 0 || nx > W || ny > H) return;
      // 東西向跨河的那一段（ix=2↔3）只有橋可以過
      if (ny === iy && Math.min(ix, nx) === RIVER_X && !BRIDGES.includes(iy)) return;
      out.push([nx, ny]);
    };
    add(ix + 1, iy);
    add(ix - 1, iy);
    add(ix, iy + 1);
    add(ix, iy - 1);
    return out;
  }
  // 街區的四個角（路口）
  const corners = (x, y) => [
    [x, y],
    [x + 1, y],
    [x, y + 1],
    [x + 1, y + 1],
  ];
  // 從一個街區到另一個街區的路（路口列表），用最短路（BFS）
  function route(from, to) {
    const key = (p) => p[0] * 100 + p[1];
    const starts = corners(from.x, from.y);
    const goals = new Set(corners(to.x, to.y).map(key));
    const prev = new Map();
    const q = [];
    for (const s of starts) {
      prev.set(key(s), null);
      q.push(s);
    }
    while (q.length) {
      const p = q.shift();
      if (goals.has(key(p))) {
        const path = [];
        for (let c = p; c; c = prev.get(key(c))) path.unshift(c);
        return path;
      }
      for (const n of neighbors(p[0], p[1])) {
        if (prev.has(key(n))) continue;
        prev.set(key(n), p);
        q.push(n);
      }
    }
    return [starts[0], [to.x, to.y]];
  }
  // 路程：每段路約 2.5 分鐘（騎機車），再加上停車、走進去的 2 分鐘
  const MIN_PER_BLOCK = 2.5;
  function rideMinutes(from, to) {
    if (from.x === to.x && from.y === to.y) return 2;
    return Math.round((route(from, to).length - 1) * MIN_PER_BLOCK + 2);
  }
  const placeAt = (id) => LANDMARKS[id] || null;

  root.BossCity = { STARS, NEIGHBOR_EVENTS, W, H, ROWS, RIVER_X, BRIDGES, typeAt, LANDMARKS, SPOTS, LEGACY, spotOf, spotMult, spotMix, route, rideMinutes, placeAt, MIN_PER_BLOCK };
})(typeof window !== 'undefined' ? window : globalThis);
