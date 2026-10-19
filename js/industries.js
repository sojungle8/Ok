// 產業、品項、設備與家具目錄
// 價格以新台幣計，參考台灣常見行情；時間單位是遊戲分鐘
(function (root) {
  // 一天中每個小時的來客倍率（0～23 點）
  const curve = (pairs) => {
    const out = new Array(24).fill(0.05);
    for (const [h, v] of pairs) out[h] = v;
    return out;
  };

  const INDUSTRIES = [
    {
      id: 'breakfast',
      name: '早餐店',
      icon: '🍳',
      desc: '天還沒亮就要開煎台，七點到八點半是戰場。',
      categories: ['restaurant', 'food'],
      shopName: '美而美早餐',
      signColor: '#d9482b',
      xpMult: 1.3, // 經驗值補正（營業時數不同）
      cash: 320000,
      rent: 34000,
      open: 330, // 05:30
      close: 780, // 13:00
      hourlyWage: 200,
      baseArrivals: 54,
      basket: 1.8, // 平均每位客人點幾份
      delivery: true,
      dineIn: true,
      demand: curve([[5, 0.35], [6, 0.8], [7, 1], [8, 0.9], [9, 0.55], [10, 0.35], [11, 0.4], [12, 0.45], [13, 0.2]]),
      products: [
        { id: 'danbing', name: '蛋餅', icon: '🌯', price: 40, cost: 12, time: 3, station: 'griddle', weight: 3 },
        { id: 'burger', name: '火腿蛋堡', icon: '🍔', price: 50, cost: 16, time: 4, station: 'griddle', weight: 3 },
        { id: 'radish', name: '蘿蔔糕', icon: '🟫', price: 40, cost: 10, time: 3, station: 'griddle', weight: 2 },
        { id: 'teppan', name: '鐵板麵', icon: '🍝', price: 65, cost: 18, time: 5, station: 'griddle', weight: 2 },
        { id: 'milktea', name: '大冰奶', icon: '🥤', price: 35, cost: 8, time: 1.5, station: 'drinkbar', weight: 3 },
        { id: 'soymilk', name: '豆漿', icon: '🥛', price: 25, cost: 5, time: 1, station: 'drinkbar', weight: 2 },
        { id: 'cheese', name: '起司蛋餅', icon: '🧀', price: 50, cost: 15, time: 3, station: 'griddle', weight: 2, rd: 8000, lv: 1 },
        { id: 'club', name: '總匯三明治', icon: '🥪', price: 70, cost: 24, time: 4, station: 'griddle', weight: 2, rd: 18000, lv: 3 },
      ],
      starter: [
        ['griddle', 1, 1, 0],
        ['drinkbar', 4, 1, 0],
        ['table4', 1, 3, 0],
        ['table4', 5, 3, 0],
        ['shrine', 7, 0, 0],
        ['menuboard', 3, 0, 0],
      ],
      // 食材：每份品項用掉一份對應的食材；spoil 是每天隔夜報廢的比例
      stock: [
        { id: 'egg', name: '蛋・餅皮・吐司', icon: '🥚', spoil: 0.12, products: ['danbing', 'burger', 'radish', 'teppan', 'cheese', 'club'] },
        { id: 'milk', name: '紅茶・豆漿・鮮奶', icon: '🥛', spoil: 0.35, products: ['milktea', 'soymilk'] },
      ],
      rival: { name: '晨光早點', color: '#e67e22' },
      mix: { student: 1.3, office: 1.3, elderly: 1, family: 0.8 },
      starterStaff: 3,
    },
    {
      id: 'noodle',
      name: '麵店',
      icon: '🍜',
      desc: '一碗乾麵配燙青菜，中午和晚餐時段座無虛席。',
      categories: ['restaurant', 'food'],
      shopName: '老張麵館',
      signColor: '#b8342a',
      xpMult: 1, // 經驗值補正（營業時數不同）
      cash: 360000,
      rent: 45000,
      open: 660, // 11:00
      close: 1230, // 20:30
      hourlyWage: 205,
      baseArrivals: 43,
      basket: 1.4, // 平均每位客人點幾份
      delivery: true,
      dineIn: true,
      demand: curve([[11, 0.55], [12, 1], [13, 0.7], [14, 0.25], [15, 0.15], [16, 0.2], [17, 0.6], [18, 0.95], [19, 0.75], [20, 0.35]]),
      products: [
        { id: 'drynoodle', name: '乾麵', icon: '🍜', price: 45, cost: 14, time: 3, station: 'noodlepot', weight: 4 },
        { id: 'beefnoodle', name: '牛肉麵', icon: '🥩', price: 160, cost: 62, time: 4, station: 'noodlepot', weight: 2 },
        { id: 'wonton', name: '餛飩湯', icon: '🥟', price: 50, cost: 16, time: 3, station: 'noodlepot', weight: 2 },
        { id: 'greens', name: '燙青菜', icon: '🥬', price: 40, cost: 12, time: 2, station: 'sidecase', weight: 2 },
        { id: 'luwei', name: '滷味拼盤', icon: '🍢', price: 70, cost: 25, time: 2, station: 'sidecase', weight: 2 },
        { id: 'sesame', name: '麻醬麵', icon: '🥢', price: 55, cost: 16, time: 3, station: 'noodlepot', weight: 2, rd: 10000, lv: 1 },
        { id: 'tofu', name: '皮蛋豆腐', icon: '🥚', price: 45, cost: 14, time: 1.5, station: 'sidecase', weight: 2, rd: 12000, lv: 2 },
      ],
      starter: [
        ['noodlepot', 1, 1, 0],
        ['sidecase', 4, 1, 0],
        ['table4', 1, 3, 0],
        ['table4', 5, 3, 0],
        ['shrine', 7, 0, 0],
        ['menuboard', 3, 0, 0],
      ],
      stock: [
        { id: 'noodle', name: '麵條・餛飩・高湯', icon: '🍜', spoil: 0.2, products: ['drynoodle', 'wonton', 'sesame'] },
        { id: 'beef', name: '牛腱肉', icon: '🥩', spoil: 0.1, products: ['beefnoodle'] },
        { id: 'side', name: '青菜・滷味', icon: '🥬', spoil: 0.4, products: ['greens', 'luwei', 'tofu'] },
      ],
      rival: { name: '大碗公麵食館', color: '#8e44ad' },
      mix: { student: 0.9, office: 1.4, elderly: 1, family: 1.1 },
      starterStaff: 3,
    },
    {
      id: 'drinks',
      name: '手搖飲店',
      icon: '🧋',
      desc: '下午三點和晚上八點最多人，夏天排隊排到騎樓外。',
      categories: ['drinks', 'food'],
      shopName: '茶湯會館',
      signColor: '#2f8f6b',
      xpMult: 1, // 經驗值補正（營業時數不同）
      cash: 300000,
      rent: 40000,
      open: 600, // 10:00
      close: 1320, // 22:00
      hourlyWage: 196,
      baseArrivals: 37,
      basket: 1.6, // 平均每位客人點幾份
      delivery: true,
      dineIn: false,
      summerBoost: 1.35,
      demand: curve([[10, 0.25], [11, 0.4], [12, 0.6], [13, 0.65], [14, 0.85], [15, 1], [16, 0.9], [17, 0.65], [18, 0.6], [19, 0.8], [20, 0.85], [21, 0.5]]),
      products: [
        { id: 'boba', name: '珍珠奶茶', icon: '🧋', price: 55, cost: 15, time: 2, station: 'teabar', weight: 4 },
        { id: 'oolong', name: '四季春', icon: '🍵', price: 35, cost: 7, time: 1.5, station: 'teabar', weight: 3 },
        { id: 'freshmilk', name: '鮮奶茶', icon: '🥛', price: 65, cost: 20, time: 2, station: 'teabar', weight: 2 },
        { id: 'lemon', name: '冬瓜檸檬', icon: '🍋', price: 45, cost: 11, time: 2, station: 'teabar', weight: 2 },
        { id: 'yakult', name: '多多綠', icon: '🍈', price: 50, cost: 12, time: 2, station: 'teabar', weight: 2, rd: 9000, lv: 1 },
        { id: 'taro', name: '芋頭鮮奶', icon: '🟣', price: 75, cost: 24, time: 2.5, station: 'teabar', weight: 2, rd: 20000, lv: 3 },
      ],
      starter: [
        ['teabar', 2, 1, 0],
        ['teabar', 5, 1, 0],
        ['waitbench', 1, 4, 0],
        ['menuboard', 4, 0, 0],
        ['plant', 7, 5, 0],
      ],
      stock: [
        { id: 'tea', name: '茶葉・糖漿・檸檬', icon: '🍃', spoil: 0.05, products: ['oolong', 'lemon', 'yakult'] },
        { id: 'pearl', name: '珍珠・鮮奶', icon: '⚫', spoil: 0.6, products: ['boba', 'freshmilk', 'taro'] },
      ],
      rival: { name: '甜心茶舖', color: '#e0478a' },
      mix: { student: 1.6, office: 1.1, elderly: 0.4, family: 1 },
      starterStaff: 4,
    },
    {
      id: 'barber',
      name: '家庭理髮廳',
      icon: '💈',
      desc: '剪一顆頭兩百五，熟客會邊剪邊聊整個下午。',
      categories: ['service'],
      shopName: '阿芬家庭理髮',
      signColor: '#3b6fb6',
      branchMult: 0.55, // 分店營收修正（服務時間長，實際接得到的客人比較少）
      xpMult: 0.8, // 經驗值補正（營業時數不同）
      cash: 280000,
      rent: 30000,
      open: 570, // 09:30
      close: 1140, // 19:00
      hourlyWage: 210,
      baseArrivals: 10,
      basket: 1, // 平均每位客人點幾份
      dineIn: false,
      patience: 3,
      demand: curve([[9, 0.35], [10, 0.6], [11, 0.7], [12, 0.45], [13, 0.6], [14, 0.85], [15, 1], [16, 0.95], [17, 0.85], [18, 0.6], [19, 0.3]]),
      products: [
        { id: 'cut', name: '剪髮', icon: '✂️', price: 250, cost: 15, time: 22, station: 'barberchair', weight: 6 },
        { id: 'wash', name: '洗髮', icon: '🧴', price: 200, cost: 20, time: 15, station: 'washsink', weight: 3 },
        { id: 'dye', name: '染髮', icon: '🎨', price: 1200, cost: 280, time: 70, station: 'barberchair', weight: 1 },
        { id: 'shave', name: '修容刮鬍', icon: '🪒', price: 200, cost: 10, time: 12, station: 'barberchair', weight: 2, rd: 8000, lv: 1 },
        { id: 'perm', name: '燙髮', icon: '🌀', price: 1500, cost: 320, time: 85, station: 'barberchair', weight: 1, rd: 25000, lv: 3 },
      ],
      starter: [
        ['barberchair', 1, 1, 0],
        ['barberchair', 3, 1, 0],
        ['washsink', 5, 1, 0],
        ['waitsofa', 1, 4, 0],
        ['plant', 7, 5, 0],
        ['poster', 6, 0, 0],
      ],
      stock: [
        { id: 'shampoo', name: '洗髮精・毛巾耗材', icon: '🧴', spoil: 0, products: ['cut', 'wash', 'shave'] },
        { id: 'dye', name: '染劑', icon: '🎨', spoil: 0, products: ['dye', 'perm'] },
      ],
      rival: { name: '極速快剪', color: '#2c6fbb' },
      mix: { student: 0.8, office: 1, elderly: 1.7, family: 1 },
      starterStaff: 3,
    },
    {
      id: 'scooter',
      name: '機車行',
      icon: '🛵',
      desc: '換機油、補胎、保養，上下班時間機車排成一排。',
      categories: ['service'],
      shopName: '順發機車行',
      signColor: '#e2a12a',
      branchMult: 0.8, // 分店營收修正（服務時間長，實際接得到的客人比較少）
      xpMult: 1.1, // 經驗值補正（營業時數不同）
      cash: 420000,
      rent: 42000,
      open: 540, // 09:00
      close: 1200, // 20:00
      hourlyWage: 215,
      baseArrivals: 7,
      basket: 1, // 平均每位客人點幾份
      dineIn: false,
      patience: 3,
      arriveByScooter: true,
      demand: curve([[9, 0.8], [10, 0.7], [11, 0.55], [12, 0.45], [13, 0.5], [14, 0.55], [15, 0.6], [16, 0.75], [17, 1], [18, 0.95], [19, 0.55]]),
      products: [
        { id: 'oil', name: '換機油', icon: '🛢️', price: 380, cost: 160, time: 12, station: 'lift', weight: 5 },
        { id: 'tire', name: '補胎', icon: '🛞', price: 150, cost: 20, time: 18, station: 'lift', weight: 3 },
        { id: 'service', name: '定期保養', icon: '🔧', price: 1200, cost: 450, time: 50, station: 'lift', weight: 2 },
        { id: 'battery', name: '換電瓶', icon: '🔋', price: 1800, cost: 1100, time: 15, station: 'lift', weight: 1 },
        { id: 'brake', name: '換煞車皮', icon: '🛑', price: 450, cost: 180, time: 14, station: 'lift', weight: 2, rd: 10000, lv: 1 },
        { id: 'detail', name: '機車美容', icon: '✨', price: 350, cost: 40, time: 30, station: 'lift', weight: 1, rd: 15000, lv: 2 },
      ],
      starter: [
        ['lift', 1, 2, 0],
        ['lift', 4, 2, 0],
        ['partsrack', 1, 0, 0],
        ['partsrack', 3, 0, 0],
        ['waitbench', 6, 4, 0],
        ['shrine', 7, 0, 0],
      ],
      stock: [
        { id: 'oil', name: '機油・保養耗材', icon: '🛢️', spoil: 0, products: ['oil', 'service', 'brake', 'detail'] },
        { id: 'tire', name: '內胎・補胎片', icon: '🛞', spoil: 0, products: ['tire'] },
        { id: 'battery', name: '電瓶', icon: '🔋', spoil: 0, products: ['battery'] },
      ],
      rival: { name: '飛輪車業', color: '#16a085' },
      mix: { student: 0.7, office: 1.6, elderly: 0.9, family: 1 },
      starterStaff: 3,
    },
    {
      id: 'store',
      name: '便利商店',
      icon: '🏪',
      desc: '可以開 24 小時，但大夜班要有人顧。',
      categories: ['store'],
      shopName: '好鄰居便利店',
      signColor: '#1f8a4c',
      xpMult: 0.7, // 經驗值補正（營業時數不同）
      cash: 380000,
      rent: 55000,
      open: 420, // 07:00
      close: 1380, // 23:00
      hourlyWage: 196,
      baseArrivals: 35,
      basket: 1.5, // 平均每位客人點幾份
      dineIn: false,
      browse: true,
      demand: curve([[0, 0.15], [1, 0.1], [2, 0.08], [3, 0.06], [4, 0.06], [5, 0.15], [6, 0.4], [7, 0.85], [8, 0.9], [9, 0.55], [10, 0.5], [11, 0.75], [12, 1], [13, 0.7], [14, 0.5], [15, 0.55], [16, 0.6], [17, 0.8], [18, 0.9], [19, 0.75], [20, 0.6], [21, 0.5], [22, 0.4], [23, 0.25]]),
      products: [
        { id: 'checkout', name: '飲料零食結帳', icon: '🧃', price: 85, cost: 60, time: 1, station: 'register', weight: 6 },
        { id: 'bento', name: '便當微波', icon: '🍱', price: 89, cost: 62, time: 2, station: 'register', weight: 3 },
        { id: 'coffee', name: '現煮咖啡', icon: '☕', price: 45, cost: 12, time: 1.5, station: 'register', weight: 2 },
        { id: 'parcel', name: '繳費取貨', icon: '📦', price: 15, cost: 0, time: 1.5, station: 'register', weight: 2 },
        { id: 'oden', name: '關東煮', icon: '🍢', price: 60, cost: 30, time: 1.5, station: 'register', weight: 2, rd: 12000, lv: 1 },
        { id: 'icecream', name: '霜淇淋', icon: '🍦', price: 39, cost: 12, time: 1, station: 'register', weight: 2, rd: 20000, lv: 3 },
      ],
      starter: [
        ['register', 2, 1, 0],
        ['shelf', 1, 4, 0],
        ['shelf', 3, 4, 0],
        ['shelf', 5, 4, 0],
        ['fridge', 7, 1, 3],
        ['fridge', 7, 2, 3],
      ],
      stock: [
        { id: 'goods', name: '飲料・零食・便當', icon: '📦', spoil: 0.08, products: ['checkout', 'bento', 'oden', 'icecream'] },
        { id: 'bean', name: '咖啡豆・鮮奶', icon: '☕', spoil: 0.05, products: ['coffee'] },
      ],
      rival: { name: '全日便利', color: '#c0392b' },
      mix: { student: 1.3, office: 1.3, elderly: 0.9, family: 1 },
      starterStaff: 4,
    },
  ];

  // 家具與設備目錄
  // w: 寬（往右的格數）  staff/cust: 店員／客人站的位置（以面向為前方的相對座標）
  const CATALOG = [
    // 設備（只有特定產業能買）
    { id: 'griddle', name: '煎台', icon: '🍳', cat: 'station', price: 58000, w: 2, kw: 4, serves: ['danbing', 'burger', 'radish', 'teppan', 'cheese', 'club'], staff: [[0, -1], [1, -1]], cust: [[0, 1], [1, 1]], industries: ['breakfast'], model: 'griddle' },
    { id: 'drinkbar', name: '飲料台', icon: '🥤', cat: 'station', price: 32000, w: 2, kw: 2, serves: ['milktea', 'soymilk'], staff: [[0, -1]], cust: [[0, 1]], industries: ['breakfast'], model: 'drinkbar' },
    { id: 'noodlepot', name: '煮麵台', icon: '🍜', cat: 'station', price: 65000, w: 2, kw: 5, serves: ['drynoodle', 'beefnoodle', 'wonton', 'sesame'], staff: [[0, -1], [1, -1]], cust: [[0, 1], [1, 1]], industries: ['noodle'], model: 'noodlepot' },
    { id: 'sidecase', name: '小菜櫃', icon: '🥬', cat: 'station', price: 28000, w: 2, kw: 1.5, serves: ['greens', 'luwei', 'tofu'], staff: [[0, -1]], cust: [[0, 1]], industries: ['noodle'], model: 'sidecase' },
    { id: 'teabar', name: '調飲台', icon: '🧋', cat: 'station', price: 45000, w: 2, kw: 3, serves: ['boba', 'oolong', 'freshmilk', 'lemon', 'yakult', 'taro'], staff: [[0, -1], [1, -1]], cust: [[0, 1], [1, 1]], industries: ['drinks'], model: 'teabar' },
    { id: 'barberchair', name: '理髮椅', icon: '💺', cat: 'station', price: 38000, w: 1, kw: 0.8, serves: ['cut', 'dye', 'shave', 'perm'], staff: [[0, 1]], cust: [[0, 0]], seatCust: true, industries: ['barber'], model: 'barberchair' },
    { id: 'washsink', name: '洗頭槽', icon: '🚿', cat: 'station', price: 30000, w: 1, kw: 1.5, serves: ['wash'], staff: [[0, 1]], cust: [[0, 0]], seatCust: true, industries: ['barber'], model: 'washsink' },
    { id: 'lift', name: '維修位', icon: '🛵', cat: 'station', price: 85000, w: 2, kw: 2.5, serves: ['oil', 'tire', 'service', 'battery', 'brake', 'detail'], staff: [[0, -1]], cust: [[1, 1]], industries: ['scooter'], model: 'lift' },
    { id: 'register', name: '收銀台', icon: '🧾', cat: 'station', price: 52000, w: 2, kw: 1.5, serves: ['checkout', 'bento', 'coffee', 'parcel', 'oden', 'icecream'], staff: [[0, -1]], cust: [[0, 1]], industries: ['store'], model: 'register' },

    // 高級設備（等級解鎖）：速度比較快
    { id: 'griddlePro', name: '雙層大煎台', icon: '🔥', cat: 'station', price: 128000, w: 2, kw: 5, speed: 1.35, beauty: 1, serves: ['danbing', 'burger', 'radish', 'teppan', 'cheese', 'club'], staff: [[0, -1], [1, -1]], cust: [[0, 1], [1, 1]], industries: ['breakfast'], model: 'griddle', pro: true, lv: 3 },
    { id: 'noodlePro', name: '自動煮麵機', icon: '♨️', cat: 'station', price: 145000, w: 2, kw: 6, speed: 1.4, serves: ['drynoodle', 'beefnoodle', 'wonton', 'sesame'], staff: [[0, -1], [1, -1]], cust: [[0, 1], [1, 1]], industries: ['noodle'], model: 'noodlepot', pro: true, lv: 3 },
    { id: 'teaPro', name: '自動茶飲機', icon: '🤖', cat: 'station', price: 118000, w: 2, kw: 4, speed: 1.45, serves: ['boba', 'oolong', 'freshmilk', 'lemon', 'yakult', 'taro'], staff: [[0, -1], [1, -1]], cust: [[0, 1], [1, 1]], industries: ['drinks'], model: 'teabar', pro: true, lv: 3 },
    { id: 'chairPro', name: '電動理髮椅', icon: '💺', cat: 'station', price: 78000, w: 1, kw: 1, speed: 1.25, beauty: 2, serves: ['cut', 'dye', 'shave', 'perm'], staff: [[0, 1]], cust: [[0, 0]], seatCust: true, industries: ['barber'], model: 'barberchair', pro: true, lv: 3 },
    { id: 'liftPro', name: '油壓升降台', icon: '🛠️', cat: 'station', price: 160000, w: 2, kw: 3.5, speed: 1.4, serves: ['oil', 'tire', 'service', 'battery', 'brake', 'detail'], staff: [[0, -1]], cust: [[1, 1]], industries: ['scooter'], model: 'lift', pro: true, lv: 3 },
    { id: 'selfCheckout', name: '自助結帳機', icon: '🖥️', cat: 'station', price: 98000, w: 1, kw: 0.8, speed: 0.75, selfServe: true, serves: ['checkout', 'parcel'], staff: [], cust: [[0, 1]], industries: ['store'], model: 'selfcheckout', lv: 4 },

    // 座位與等候
    { id: 'table4', name: '小吃桌＋紅色塑膠椅', icon: '🪑', cat: 'seat', price: 3200, w: 2, seats: [[0, 1], [1, 1]], beauty: 0, industries: ['breakfast', 'noodle'], model: 'table4' },
    { id: 'counterbar', name: '吧台座位', icon: '🍽️', cat: 'seat', price: 6000, w: 2, seats: [[0, 1], [1, 1]], beauty: 1, industries: ['breakfast', 'noodle', 'drinks'], model: 'counterbar', lv: 2 },
    { id: 'waitbench', name: '等候長椅', icon: '🪑', cat: 'wait', price: 4500, w: 2, waits: [[0, 0], [1, 0]], beauty: 0, model: 'waitbench' },
    { id: 'waitsofa', name: '等候沙發', icon: '🛋️', cat: 'wait', price: 12000, w: 2, waits: [[0, 0], [1, 0]], beauty: 2, model: 'waitsofa', lv: 2 },

    // 商品陳列
    { id: 'shelf', name: '商品貨架', icon: '🗄️', cat: 'shop', price: 15000, w: 2, beauty: 1, draw: 0.12, industries: ['store'], model: 'shelf' },
    { id: 'fridge', name: '冷藏櫃', icon: '🧊', cat: 'shop', price: 42000, w: 1, kw: 3, beauty: 1, draw: 0.1, industries: ['store'], model: 'fridge' },
    { id: 'partsrack', name: '零件架', icon: '🔩', cat: 'shop', price: 9000, w: 2, beauty: 0, draw: 0.05, industries: ['scooter'], model: 'partsrack' },

    // 員工區
    { id: 'breaktable', name: '員工休息桌', icon: '☕', cat: 'staff', price: 6500, w: 1, rest: [[0, 0]], model: 'breaktable' },
    { id: 'staffsofa', name: '員工休息沙發', icon: '🛋️', cat: 'staff', price: 15000, w: 2, rest: [[0, 0], [1, 0]], restBonus: 1.5, model: 'staffsofa', lv: 2 },
    { id: 'cleancart', name: '清潔推車', icon: '🧹', cat: 'staff', price: 4800, w: 1, cleanBoost: 1.6, model: 'cleancart' },
    { id: 'locker', name: '員工置物櫃', icon: '🗃️', cat: 'staff', price: 8000, w: 1, staffMood: 2, model: 'locker', lv: 2 },

    // 裝潢（提升環境分：客人比較願意進來，員工心情也比較好）
    { id: 'plant', name: '盆栽', icon: '🪴', cat: 'decor', price: 1800, w: 1, beauty: 2, model: 'plant' },
    { id: 'poster', name: '海報', icon: '🖼️', cat: 'decor', price: 900, w: 1, beauty: 1, wall: true, model: 'poster' },
    { id: 'menuboard', name: '菜單看板', icon: '📋', cat: 'decor', price: 2500, w: 1, beauty: 2, draw: 0.06, wall: true, model: 'menuboard' },
    { id: 'luckycat', name: '招財貓', icon: '🐱', cat: 'decor', price: 1200, w: 1, beauty: 2, draw: 0.04, model: 'luckycat' },
    { id: 'shrine', name: '土地公神桌', icon: '🙏', cat: 'decor', price: 8800, w: 1, beauty: 3, draw: 0.03, model: 'shrine' },
    { id: 'aircon', name: '冷氣', icon: '❄️', cat: 'decor', price: 28000, w: 1, kw: 2.2, cool: true, wall: true, model: 'aircon' },
    { id: 'fan', name: '電風扇', icon: '🌀', cat: 'decor', price: 1500, w: 1, kw: 0.1, coolHalf: true, model: 'fan' },
    { id: 'tv', name: '電視', icon: '📺', cat: 'decor', price: 12000, w: 1, beauty: 3, kw: 0.2, wall: true, model: 'tv', lv: 3 },
    { id: 'claw', name: '夾娃娃機', icon: '🧸', cat: 'decor', price: 25000, w: 1, beauty: 1, draw: 0.08, kw: 0.3, model: 'claw', lv: 5 },
    { id: 'neon', name: '霓虹燈招牌', icon: '💡', cat: 'decor', price: 32000, w: 1, beauty: 3, draw: 0.1, kw: 0.2, wall: true, model: 'neon', lv: 7 },
    { id: 'fame', name: '名人簽名牆', icon: '✍️', cat: 'decor', price: 45000, w: 1, beauty: 6, draw: 0.08, wall: true, model: 'fame', lv: 8 },
    { id: 'aquarium', name: '魚缸', icon: '🐠', cat: 'decor', price: 9000, w: 1, beauty: 4, kw: 0.1, model: 'aquarium', lv: 4 },
  ];

  const CAT_LABELS = {
    station: '設備',
    seat: '座位',
    wait: '等候區',
    shop: '陳列',
    staff: '員工區',
    decor: '裝潢',
  };

  // 店面大小
  const LOTS = [
    { id: 'small', name: '小店面', w: 8, h: 6, rentMult: 1, cost: 0 },
    { id: 'medium', name: '中店面', w: 11, h: 7, rentMult: 1.7, cost: 180000, lv: 3 },
    { id: 'large', name: '大店面', w: 14, h: 8, rentMult: 2.6, cost: 380000, lv: 6 },
  ];

  // 員工候選人
  const NAMES = [
    ['小美', 'f'], ['阿宏', 'm'], ['佳穎', 'f'], ['志明', 'm'], ['春嬌', 'f'], ['阿翔', 'm'], ['怡君', 'f'], ['家豪', 'm'],
    ['雅婷', 'f'], ['俊傑', 'm'], ['淑芬', 'f'], ['建宏', 'm'], ['詩涵', 'f'], ['冠宇', 'm'], ['欣怡', 'f'], ['宗翰', 'm'],
    ['美玲', 'f'], ['承恩', 'm'], ['宜蓁', 'f'], ['柏翰', 'm'], ['秀英', 'f'], ['阿財', 'm'], ['玉珍', 'f'], ['文雄', 'm'],
    ['筱涵', 'f'], ['育誠', 'm'], ['麗華', 'f'], ['國華', 'm'], ['子晴', 'f'], ['阿國', 'm'],
  ];

  const TRAITS = {
    hardworking: { name: '勤勞', desc: '精力掉得比較慢', energy: 0.8 },
    chatty: { name: '愛聊天', desc: '客人比較滿意，但做事慢一點', speed: 0.9, charm: 0.1 },
    rookie: { name: '新手', desc: '技能低，但學得快', learn: 1.8 },
    veteran: { name: '老手', desc: '技能高，薪水要求也高', wagePlus: 0.15 },
    fragile: { name: '玻璃心', desc: '被罵心情掉很多', scold: 2 },
    foodie: { name: '吃貨', desc: '肚子餓得比較快', hunger: 1.4 },
    nightowl: { name: '夜貓子', desc: '晚班不容易累', night: 0.6 },
    cheerful: { name: '開朗', desc: '心情恢復得比較快', moodRegen: 1.6 },
  };

  // 店家等級：累積毛利換算的經驗值
  // 早餐店的節奏大約是：第 1 天 Lv.2、第 3 天 Lv.3、第 2 週 Lv.5、三個月左右 Lv.10
  const LEVELS = [0, 250, 900, 2000, 3800, 6500, 10000, 15000, 22000, 31000];

  // 客人類型：不同時段來的人不一樣，對價格和等待的容忍度也不同
  // hours：特定時段的出現倍率（沒寫的時段用 base）；priceSens：對價格的敏感度
  const CUSTOMER_TYPES = {
    student: { id: 'student', name: '學生', icon: '🎒', patience: 0.85, priceSens: 1.8, speed: 1.1, basket: 0.8, base: 0.35, weekend: 0.7, hours: { 6: 1.4, 7: 1.8, 8: 0.6, 12: 1, 16: 1.4, 17: 1.6, 18: 1, 21: 0.7, 22: 0.5 } },
    office: { id: 'office', name: '上班族', icon: '💼', patience: 0.7, priceSens: 0.6, speed: 1.2, basket: 1.15, base: 0.35, weekend: 0.25, hours: { 7: 1.6, 8: 1.8, 9: 0.9, 12: 1.9, 13: 1.1, 18: 1.5, 19: 1.2 } },
    elderly: { id: 'elderly', name: '長輩', icon: '🧓', patience: 1.5, priceSens: 1.35, speed: 0.65, basket: 1, base: 0.45, weekend: 1, hours: { 5: 1.6, 6: 1.8, 7: 1.2, 9: 1.4, 10: 1.4, 14: 1.1, 15: 1.1, 20: 0.3, 21: 0.2 } },
    family: { id: 'family', name: '一般客人', icon: '🙂', patience: 1, priceSens: 1, speed: 1, basket: 1.2, base: 0.8, weekend: 1.7, hours: {} },
  };

  // 難度：patience 客人耐心、events 事件多寡、cash 開店資金、rival 對手搶客、inspect 稽查頻率、fines 罰款、drain 員工累的速度
  const DIFFICULTY = {
    easy: { name: '輕鬆', desc: '資金多、客人有耐心、事件少，適合先熟悉', patience: 1.6, events: 0.5, cash: 1.6, rival: 0.55, inspect: 0.5, fines: 0.5, drain: 0.8, wage: 0.95 },
    normal: { name: '一般', desc: '有挑戰，但做對事情就能穩穩經營', patience: 1.25, events: 0.85, cash: 1.2, rival: 0.85, inspect: 1, fines: 1, drain: 0.92, wage: 1 },
    hell: { name: '地獄', desc: '事件多、客人急、員工容易累', patience: 0.75, events: 1.6, cash: 1, rival: 1.2, inspect: 1.4, fines: 1.2, drain: 1.2, wage: 1.05 },
  };

  // 分店地點：人潮、房租、開店費、客群組成、淡旺季
  // mix：學生、上班族、長輩、家庭、觀光客的比例；rich：客人比較不在意價格；season：旺季與淡季的月份
  const BRANCH_SITES = [
    { id: 'xinyi', city: '台北', name: '信義商圈', icon: '🏙️', desc: '百貨和辦公大樓林立，人潮多到走路要排隊，房租也貴到老闆會哭。', traffic: 1.65, rent: 2.3, cost: 2.0, rich: true, mix: { student: 0.15, office: 0.45, elderly: 0.05, family: 0.15, tourist: 0.2 } },
    { id: 'ximen', city: '台北', name: '西門町', icon: '🎬', desc: '年輕人和觀光客的大本營，假日人擠人，平日晚上也很熱鬧。', traffic: 1.5, rent: 1.9, cost: 1.7, mix: { student: 0.4, office: 0.1, elderly: 0.05, family: 0.1, tourist: 0.35 } },
    { id: 'banqiao', city: '新北', name: '板橋車站', icon: '🚉', desc: '捷運、高鐵、台鐵三鐵共構，通勤族從早到晚都有。', traffic: 1.3, rent: 1.35, cost: 1.3, mix: { student: 0.2, office: 0.45, elderly: 0.1, family: 0.2, tourist: 0.05 } },
    { id: 'xinzhuang', city: '新北', name: '新莊老街', icon: '🏘️', desc: '住宅區和老街，街坊鄰居多，長輩和家庭是主力。', traffic: 0.95, rent: 0.9, cost: 0.85, mix: { student: 0.15, office: 0.15, elderly: 0.35, family: 0.35, tourist: 0 } },
    { id: 'fengjia', city: '台中', name: '逢甲夜市', icon: '🏮', desc: '全台最大的夜市之一，大學生和觀光客的天堂，晚上人潮爆炸。', traffic: 1.4, rent: 1.25, cost: 1.2, mix: { student: 0.5, office: 0.05, elderly: 0.05, family: 0.1, tourist: 0.3 } },
    { id: 'beitun', city: '台中', name: '北屯', icon: '🌳', desc: '新興住宅區，年輕家庭多，房租還算親切。', traffic: 0.95, rent: 0.8, cost: 0.8, mix: { student: 0.15, office: 0.2, elderly: 0.15, family: 0.5, tourist: 0 } },
    { id: 'tainan', city: '台南', name: '東區大學路', icon: '🎓', desc: '大學生和老台南人交會的地方，大家對吃很挑剔。', traffic: 0.95, rent: 0.7, cost: 0.75, mix: { student: 0.45, office: 0.1, elderly: 0.25, family: 0.15, tourist: 0.05 } },
    { id: 'zuoying', city: '高雄', name: '左營高鐵站', icon: '🚄', desc: '南部的交通樞紐，旅客和通勤族都多。', traffic: 1.15, rent: 1.0, cost: 1.0, mix: { student: 0.1, office: 0.35, elderly: 0.1, family: 0.2, tourist: 0.25 } },
    { id: 'hsinchu', city: '新竹', name: '科學園區', icon: '💻', desc: '工程師的聚集地，平日中午大爆滿，週末變空城；薪水高，不太在意價格。', traffic: 1.2, rent: 1.3, cost: 1.3, rich: true, weekdayOnly: true, mix: { student: 0.05, office: 0.75, elderly: 0, family: 0.15, tourist: 0.05 } },
    { id: 'zhongli', city: '桃園', name: '中壢車站', icon: '🛤️', desc: '學生、移工、通勤族混在一起，熱鬧又多元。', traffic: 1.05, rent: 0.85, cost: 0.85, mix: { student: 0.35, office: 0.25, elderly: 0.1, family: 0.25, tourist: 0.05 } },
    { id: 'hualien', city: '花蓮', name: '東大門夜市', icon: '🌊', desc: '觀光客的必訪景點，暑假和連假爆滿，冬天就冷冷清清。', traffic: 1.1, rent: 0.75, cost: 0.8, season: { high: [7, 8, 2], low: [11, 12, 1] }, mix: { student: 0.1, office: 0.05, elderly: 0.1, family: 0.2, tourist: 0.55 } },
    { id: 'luodong', city: '宜蘭', name: '羅東夜市', icon: '🍃', desc: '在地人的生活圈，週末有台北人開車來玩。', traffic: 0.85, rent: 0.65, cost: 0.7, mix: { student: 0.15, office: 0.1, elderly: 0.3, family: 0.3, tourist: 0.15 } },
  ];
  // 分店店面大小：cap 能容納的客人、draw 吸引力、rent 房租、cost 開店費、staff 需要的人手
  const BRANCH_SIZES = {
    small: { name: '小店面', cap: 0.75, draw: 0.85, rent: 0.7, cost: 0.75, staff: 0.75 },
    medium: { name: '中店面', cap: 1, draw: 1, rent: 1, cost: 1, staff: 1 },
    large: { name: '大店面', cap: 1.4, draw: 1.2, rent: 1.55, cost: 1.45, staff: 1.4 },
  };
  // 各產業喜不喜歡觀光客
  const TOURIST_PREF = { breakfast: 0.8, noodle: 1.2, drinks: 1.5, barber: 0.25, scooter: 0.35, store: 1.3 };

  // 店面裝潢樣式：地板、牆面、招牌
  const FLOORS = {
    default: { name: '原本的地磚', price: 0 },
    wood: { name: '木地板', price: 12000, colors: ['#c89b6d', '#b8875a'] },
    terrazzo: { name: '磨石子', price: 9000, colors: ['#e8e2d6', '#ddd5c6'], speckle: true },
    checker: { name: '黑白格', price: 10000, colors: ['#f3f3f3', '#2f2f35'] },
    mint: { name: '復古馬賽克', price: 8000, colors: ['#bfe3d6', '#a9d4c6'], small: true },
    concrete: { name: '工業風水泥', price: 7000, colors: ['#a7a7a2', '#9d9d98'] },
  };
  const WALLS = ['#e8ddcf', '#f6f1ea', '#d9e6ef', '#f3dfd0', '#dbe8d4', '#3a3f48', '#f2e2a8', '#e7cfe0'];
  const SIGNS = ['#d9482b', '#b8342a', '#2f8f6b', '#2c6fbb', '#e2a12a', '#6c5ce7', '#2f2f35', '#e0478a'];

  // 可以開分店的地方
  const DISTRICTS = ['板橋', '新莊', '台中北屯', '台南東區', '高雄左營', '新竹東區', '桃園中壢'];
  // 各地的生意好壞（人潮）和房租
  const DISTRICT_INFO = {
    板橋: { traffic: 1.1, rent: 1.15 },
    新莊: { traffic: 1, rent: 1 },
    台中北屯: { traffic: 0.95, rent: 0.85 },
    台南東區: { traffic: 0.9, rent: 0.7 },
    高雄左營: { traffic: 1, rent: 0.8 },
    新竹東區: { traffic: 1.05, rent: 1.05 },
    桃園中壢: { traffic: 0.95, rent: 0.85 },
  };

  root.BossIndustries = { INDUSTRIES, CATALOG, CAT_LABELS, LOTS, NAMES, TRAITS, LEVELS, DISTRICTS, DISTRICT_INFO, CUSTOMER_TYPES, DIFFICULTY, FLOORS, WALLS, SIGNS, BRANCH_SITES, BRANCH_SIZES, TOURIST_PREF };
})(typeof window !== 'undefined' ? window : globalThis);
