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
      shopName: '美而肥早餐',
      nameIdeas: ['美而肥早餐', '早安不想上班', '蛋餅不內卷', '起床困難早餐店', '躺平吐司', '晨型人早午餐'],
      // 平衡：早餐店只做半天，本店一週賺得不多；分店營收照比例下修，開店費會跟著（36 週回本）一起降，才存得到錢開分店
      branchMult: 0.75,
      signColor: '#d9482b',
      xpMult: 1.3, // 經驗值補正（營業時數不同）
      cash: 320000,
      rent: 34000,
      open: 330, // 05:30
      close: 780, // 13:00
      hourlyWage: 200,
      baseArrivals: 54,
      basket: 2, // 平均每位客人點幾份（平衡：早餐常常是一份餐加一杯飲料；只做半天，客單要夠才撐得住）
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
      nameIdeas: ['老張麵館', '麵對現實', '一麵之詞', '加麵不加價', '麵試失敗', '社畜拉麵'],
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
      demand: curve([[1, 0.1], [0, 0.18], [23, 0.3], [22, 0.4], [21, 0.45], [11, 0.55], [12, 1], [13, 0.7], [14, 0.25], [15, 0.15], [16, 0.2], [17, 0.6], [18, 0.95], [19, 0.75], [20, 0.35]]),
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
      shopName: '茶湯會不會',
      nameIdeas: ['茶湯會不會', '五十步茶', '半糖人生', '去冰不去愛', '茶顏觀色', '珍奶不減肥'],
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
      demand: curve([[23, 0.15], [22, 0.3], [10, 0.25], [11, 0.4], [12, 0.6], [13, 0.65], [14, 0.85], [15, 1], [16, 0.9], [17, 0.65], [18, 0.6], [19, 0.8], [20, 0.85], [21, 0.5]]),
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
      nameIdeas: ['阿芬家庭理髮', '剪不斷理還亂', '髮財了', '頭頭是道', '不禿髮廊', '剪單生活'],
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
      patience: 3.6, // 剪一顆頭 20 幾分鐘，理髮店的客人本來就預期要等
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
      shopName: '順風催油門機車行',
      nameIdeas: ['順風催油門機車行', '輪到你機車行', '不熄火車業', '油價又漲機車行', '待轉區車業', '紅燈右轉車行'],
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
      shopName: '好像鄰居便利店',
      nameIdeas: ['好像鄰居便利店', '全家人都在便利店', '七上八下超商', '萊爾不富', '集點到天亮', '加班也開超商'],
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
      demand: curve([[0, 0.32], [1, 0.25], [2, 0.18], [3, 0.14], [4, 0.14], [5, 0.25], [6, 0.5], [7, 0.85], [8, 0.9], [9, 0.55], [10, 0.5], [11, 0.75], [12, 1], [13, 0.7], [14, 0.5], [15, 0.55], [16, 0.6], [17, 0.8], [18, 0.9], [19, 0.75], [20, 0.6], [21, 0.5], [22, 0.4], [23, 0.4]]),
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

    // ───── 更多生財器具：每一樣都有實際作用 ─────
    // speed 做得快、serves 專做哪幾樣；costCut 進貨單價（某類材料）、spoilCut 隔夜報廢、speedFor 讓某些品項做更快、starsFor 某些品項評價更好、patience 客人更有耐心、drawSummer 夏天多吸引人
    // 早餐店
    { id: 'teppanStove', name: '鐵板麵專用爐', icon: '🍝', cat: 'station', price: 36000, w: 1, kw: 3, speed: 1.6, serves: ['teppan'], staff: [[0, -1]], cust: [[0, 1]], industries: ['breakfast'], model: 'teppanStove', lv: 2, desc: '鐵板麵專用，做得快很多' },
    { id: 'toaster', name: '吐司烤箱', icon: '🍞', cat: 'station', price: 28000, w: 1, kw: 2.5, speed: 1.5, serves: ['burger', 'club'], staff: [[0, -1]], cust: [[0, 1]], industries: ['breakfast'], model: 'toaster', lv: 2, desc: '漢堡、三明治分出去做，煎台不會塞車' },
    { id: 'soyMachine', name: '現磨豆漿機', icon: '🫘', cat: 'station', price: 46000, w: 1, kw: 2, speed: 1.25, serves: ['soymilk', 'milktea'], costCut: { milk: 0.85 }, starsFor: { items: ['soymilk'], v: 0.15 }, staff: [[0, -1]], cust: [[0, 1]], industries: ['breakfast'], model: 'soyMachine', lv: 4, desc: '自己磨豆漿：飲料原料便宜 15%，豆漿評價更好' },
    { id: 'pickupWindow', name: '外帶取餐窗口', icon: '🪟', cat: 'station', price: 52000, w: 1, kw: 1, speed: 1.2, draw: 0.05, serves: ['danbing', 'radish', 'milktea', 'soymilk'], staff: [[0, -1]], cust: [[0, 1]], industries: ['breakfast'], model: 'pickupWindow', lv: 5, desc: '趕上班的人拿了就走，路過的人也比較會停下來' },
    { id: 'eggFridge', name: '雞蛋冷藏架', icon: '🥚', cat: 'tool', price: 15000, w: 1, kw: 0.8, spoilCut: { egg: 0.6 }, industries: ['breakfast'], model: 'eggFridge', desc: '蛋、餅皮、吐司隔夜報廢少四成' },
    // 麵店
    { id: 'stockPot', name: '熬湯大鍋', icon: '🍲', cat: 'station', price: 72000, w: 1, kw: 4, speed: 1.25, serves: ['beefnoodle', 'wonton'], costCut: { beef: 0.88 }, starsFor: { items: ['beefnoodle'], v: 0.2 }, staff: [[0, -1]], cust: [[0, 1]], industries: ['noodle'], model: 'stockPot', lv: 2, desc: '一早熬好大鍋湯：牛肉便宜 12%，牛肉麵評價更好' },
    { id: 'luweiCase', name: '滷味櫃', icon: '🍢', cat: 'station', price: 34000, w: 1, kw: 1.5, speed: 1.5, draw: 0.04, serves: ['luwei', 'tofu', 'greens'], staff: [[0, -1]], cust: [[0, 1]], industries: ['noodle'], model: 'luweiCase', lv: 2, desc: '小菜一夾就好，擺在門口也吸引人' },
    { id: 'noodleMaker', name: '製麵機', icon: '🌀', cat: 'tool', price: 58000, w: 1, kw: 2, costCut: { noodle: 0.85 }, industries: ['noodle'], model: 'noodleMaker', lv: 3, desc: '自己做麵條：麵類材料便宜 15%' },
    { id: 'coldCase', name: '冷藏展示櫃', icon: '🧊', cat: 'tool', price: 30000, w: 1, kw: 2, beauty: 1, draw: 0.03, spoilCut: { side: 0.5 }, industries: ['noodle'], model: 'coldCase', lv: 2, desc: '小菜隔夜報廢少一半，客人看得到也比較想點' },
    // 飲料店
    { id: 'sealer', name: '自動封口機', icon: '🥤', cat: 'tool', price: 26000, w: 1, kw: 1, speedFor: { items: ['boba', 'oolong', 'freshmilk', 'lemon', 'yakult', 'taro'], mult: 1.12 }, industries: ['drinks'], model: 'sealer', lv: 2, desc: '每一杯都快一點（+12%）' },
    { id: 'pearlPot', name: '珍珠專用鍋', icon: '⚫', cat: 'tool', price: 32000, w: 1, kw: 3, spoilCut: { pearl: 0.6 }, starsFor: { items: ['boba', 'freshmilk', 'taro'], v: 0.15 }, industries: ['drinks'], model: 'pearlPot', lv: 2, desc: '珍珠分批現煮：報廢少四成，珍奶評價更好' },
    { id: 'fruitBar', name: '鮮果吧', icon: '🍋', cat: 'station', price: 40000, w: 1, kw: 1.5, speed: 1.5, serves: ['lemon', 'yakult'], starsFor: { items: ['lemon', 'yakult'], v: 0.1 }, staff: [[0, -1]], cust: [[0, 1]], industries: ['drinks'], model: 'fruitBar', lv: 3, desc: '果茶分出去做，看得到新鮮水果' },
    { id: 'iceMaker', name: '製冰機', icon: '🧊', cat: 'tool', price: 48000, w: 1, kw: 3.5, drawSummer: 0.12, industries: ['drinks'], model: 'iceMaker', lv: 3, desc: '夏天冰塊不缺：夏天多吸引一成多的客人' },
    // 理髮店
    { id: 'colorStation', name: '燙染區', icon: '🎨', cat: 'station', price: 68000, w: 1, kw: 1.5, speed: 1.3, serves: ['dye', 'perm'], staff: [[0, 1]], cust: [[0, 0]], seatCust: true, industries: ['barber'], model: 'colorStation', lv: 3, desc: '燙染另外一區，剪髮椅不會被佔好幾個小時' },
    { id: 'hoodDryer', name: '烘罩機', icon: '💨', cat: 'tool', price: 36000, w: 1, kw: 2, speedFor: { items: ['dye', 'perm'], mult: 1.2 }, industries: ['barber'], model: 'hoodDryer', lv: 3, desc: '燙染快兩成' },
    { id: 'magRack', name: '雜誌報紙架', icon: '📰', cat: 'tool', price: 6000, w: 1, beauty: 1, patience: 1.1, industries: ['barber', 'scooter'], model: 'magRack', desc: '等的時候有東西看：客人耐心 +10%' },
    { id: 'hairShelf', name: '美髮商品櫃', icon: '🧴', cat: 'shop', price: 22000, w: 1, beauty: 1, draw: 0.06, industries: ['barber'], model: 'hairShelf', desc: '擺在門口的洗髮精、髮蠟，路過的人會進來看' },
    // 機車行
    { id: 'tireBalancer', name: '輪胎平衡機', icon: '🛞', cat: 'station', price: 42000, w: 1, kw: 2, speed: 1.6, serves: ['tire'], staff: [[0, -1]], cust: [[0, 1]], industries: ['scooter'], model: 'tireBalancer', lv: 2, desc: '補胎、換胎專用，維修位不會被佔住' },
    { id: 'diagPC', name: '行車診斷電腦', icon: '💻', cat: 'tool', price: 58000, w: 1, kw: 0.8, speedFor: { items: ['service', 'battery', 'brake'], mult: 1.2 }, starsFor: { items: ['service'], v: 0.15 }, industries: ['scooter'], model: 'diagPC', lv: 3, desc: '一接上就知道哪裡壞：保養、電瓶、煞車快兩成，比較少誤判' },
    { id: 'washBay', name: '洗車區', icon: '🧽', cat: 'station', price: 52000, w: 1, kw: 2, speed: 1.4, serves: ['detail'], staff: [[0, -1]], cust: [[0, 1]], industries: ['scooter'], model: 'washBay', lv: 3, desc: '機車美容另外一區' },
    { id: 'oilDrum', name: '機油桶架', icon: '🛢️', cat: 'tool', price: 22000, w: 1, costCut: { oil: 0.88 }, industries: ['scooter'], model: 'oilDrum', lv: 2, desc: '整桶進機油：機油類材料便宜 12%' },
    // 超商
    { id: 'hotCase', name: '熱食櫃', icon: '🍱', cat: 'station', price: 46000, w: 1, kw: 3, speed: 1.4, draw: 0.04, serves: ['bento', 'oden'], staff: [[0, -1]], cust: [[0, 1]], industries: ['store'], model: 'hotCase', lv: 2, desc: '便當、關東煮另外一個櫃台，結帳不塞車' },
    { id: 'coffeeMachine', name: '義式咖啡機', icon: '☕', cat: 'station', price: 60000, w: 1, kw: 2.5, speed: 1.5, serves: ['coffee'], starsFor: { items: ['coffee'], v: 0.15 }, staff: [[0, -1]], cust: [[0, 1]], industries: ['store'], model: 'coffeeMachine', lv: 3, desc: '咖啡快又好喝' },
    { id: 'softServe', name: '霜淇淋機', icon: '🍦', cat: 'station', price: 36000, w: 1, kw: 2, speed: 1.6, serves: ['icecream'], staff: [[0, -1]], cust: [[0, 1]], industries: ['store'], model: 'softServe', lv: 3, desc: '霜淇淋專用（要先研發霜淇淋）' },
    { id: 'freezerCase', name: '冷凍櫃', icon: '❄️', cat: 'shop', price: 38000, w: 1, kw: 3, beauty: 1, draw: 0.08, spoilCut: { goods: 0.8 }, industries: ['store'], model: 'freezerCase', desc: '冷凍食品吸引人，商品報廢少兩成' },
    { id: 'magazineRack', name: '雜誌書報架', icon: '📰', cat: 'shop', price: 9000, w: 1, beauty: 1, draw: 0.05, industries: ['store'], model: 'magRack', desc: '翻雜誌的人順便買東西' },

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
    { id: 'menuboard', name: '菜單看板', names: { barber: '價目表看板', scooter: '維修價目表', store: '特價看板' }, icon: '📋', cat: 'decor', price: 2500, w: 1, beauty: 2, draw: 0.06, wall: true, model: 'menuboard' },
    { id: 'luckycat', name: '招財貓', icon: '🐱', cat: 'decor', price: 1200, w: 1, beauty: 2, draw: 0.04, model: 'luckycat' },
    { id: 'shrine', name: '土地公神桌', icon: '🙏', cat: 'decor', price: 8800, w: 1, beauty: 3, draw: 0.03, model: 'shrine' },
    { id: 'aircon', name: '冷氣', icon: '❄️', cat: 'decor', price: 28000, w: 1, kw: 2.2, cool: true, wall: true, model: 'aircon' },
    { id: 'fan', name: '電風扇', icon: '🌀', cat: 'decor', price: 1500, w: 1, kw: 0.1, coolHalf: true, model: 'fan' },
    { id: 'tv', name: '電視', icon: '📺', cat: 'decor', price: 12000, w: 1, beauty: 3, kw: 0.2, wall: true, model: 'tv', lv: 3 },
    { id: 'claw', name: '夾娃娃機', icon: '🧸', cat: 'decor', price: 25000, w: 1, beauty: 1, draw: 0.08, kw: 0.3, model: 'claw', lv: 5 },
    { id: 'neon', name: '霓虹燈招牌', icon: '💡', cat: 'decor', price: 32000, w: 1, beauty: 3, draw: 0.1, kw: 0.2, wall: true, model: 'neon', lv: 7 },
    { id: 'fame', name: '名人簽名牆', icon: '✍️', cat: 'decor', price: 45000, w: 1, beauty: 6, draw: 0.08, wall: true, model: 'fame', lv: 8 },
    { id: 'aquarium', name: '魚缸', icon: '🐠', cat: 'decor', price: 9000, w: 1, beauty: 4, kw: 0.1, model: 'aquarium', lv: 4 },
    // 各行各業自己的裝潢
    { id: 'lantern', name: '紅燈籠', icon: '🏮', cat: 'decor', price: 2200, w: 1, beauty: 2, draw: 0.04, wall: true, industries: ['breakfast', 'noodle'], model: 'lantern' },
    { id: 'photowall', name: '打卡牆', icon: '📸', cat: 'decor', price: 16000, w: 1, beauty: 3, draw: 0.1, wall: true, industries: ['drinks'], model: 'photowall', lv: 3 },
    { id: 'barberpole', name: '旋轉燈柱', icon: '💈', cat: 'decor', price: 6800, w: 1, beauty: 3, draw: 0.08, kw: 0.1, industries: ['barber'], model: 'barberpole' },
    { id: 'magazine', name: '雜誌架', icon: '📰', cat: 'decor', price: 2400, w: 1, beauty: 2, draw: 0.03, industries: ['barber', 'scooter'], model: 'magazine' },
    { id: 'tirewall', name: '輪胎牆', icon: '🛞', cat: 'decor', price: 5200, w: 1, beauty: 3, draw: 0.05, wall: true, industries: ['scooter'], model: 'tirewall' },
    { id: 'helmetrack', name: '安全帽架', icon: '⛑️', cat: 'decor', price: 3800, w: 1, beauty: 2, draw: 0.04, industries: ['scooter'], model: 'helmetrack' },
    // 高等級裝潢
    { id: 'mural', name: '牆面彩繪', icon: '🎨', cat: 'decor', price: 38000, w: 1, beauty: 5, draw: 0.06, wall: true, model: 'mural', lv: 11 },
    { id: 'ledsign', name: 'LED 跑馬燈', icon: '📟', cat: 'decor', price: 52000, w: 1, beauty: 3, draw: 0.12, kw: 0.3, wall: true, model: 'ledsign', lv: 12 },
    { id: 'chandelier', name: '設計師吊燈', icon: '🪔', cat: 'decor', price: 68000, w: 1, beauty: 6, kw: 0.2, model: 'chandelier', lv: 14 },
    { id: 'greenwall', name: '植生牆', icon: '🌿', cat: 'decor', price: 85000, w: 1, beauty: 7, staffMood: true, wall: true, model: 'greenwall', lv: 16 },
    { id: 'artpiece', name: '藝術裝置', icon: '🗿', cat: 'decor', price: 120000, w: 1, beauty: 8, draw: 0.08, model: 'artpiece', lv: 18 },
    { id: 'robot', name: '招待機器人', icon: '🤖', cat: 'decor', price: 180000, w: 1, beauty: 4, draw: 0.15, kw: 0.4, model: 'robot', lv: 20 },
    { id: 'statue', name: '創辦人銅像', icon: '🗽', cat: 'decor', price: 300000, w: 1, beauty: 10, draw: 0.1, model: 'statue', lv: 24 },
    { id: 'umbrella', name: '愛心傘架', icon: '☂️', cat: 'decor', price: 1600, w: 1, beauty: 2, draw: 0.04, industries: ['store'], model: 'umbrella' },
  ];

  // 各行各業的說法：同一句話換成這一行的用語（文字裡寫 {w:serve} 這樣的記號）
  const FOOD_WORDS = { serve: '出餐', product: '餐點', eat: '吃', done: '吃完', good: '好好吃', best: '好吃', need: '吃飯', order: '點餐', gift: '小菜', chore: '洗碗', supplies: '食材', supplier: '果菜批發市場', secret: '醬料比例和擺盤方式', hard: '好吃！便宜！大份！', set: '套餐', taste: '吃', menu: '菜單' };
  const WORDS = {
    breakfast: { ...FOOD_WORDS, need: '吃早餐' },
    noodle: { ...FOOD_WORDS, hard: '好吃！便宜！大碗！' },
    drinks: { ...FOOD_WORDS, serve: '出杯', product: '飲料', eat: '喝', done: '喝完', good: '好好喝', best: '好喝', need: '喝飲料', order: '點飲料', gift: '加料', chore: '洗杯子', supplies: '原料', supplier: '茶葉原料批發', secret: '茶湯配方和封膜手法', hard: '好喝！便宜！大杯！', set: '聯名飲料', taste: '喝', menu: '菜單' },
    barber: { serve: '剪髮', product: '服務', eat: '剪', done: '剪完', good: '剪得好好看', best: '會剪', need: '剪頭髮', order: '剪頭髮', gift: '免費洗頭', chore: '掃頭髮', supplies: '耗材', supplier: '美髮材料行', secret: '剪髮手法和價目表', hard: '快！準！不囉嗦！', set: '剪髮套組', taste: '剪', menu: '服務項目' },
    scooter: { serve: '修車', product: '服務', eat: '修', done: '修好', good: '修得很仔細', best: '會修', need: '騎車', order: '等修車', gift: '免費打氣', chore: '搬輪胎', supplies: '零件', supplier: '機車零件批發', secret: '報價單和保養流程', hard: '快！穩！不亂報價！', set: '保養套餐', taste: '保養', menu: '服務項目' },
    store: { serve: '結帳', product: '商品', eat: '買', done: '結完帳', good: '東西好齊', best: '方便', need: '買東西', order: '結帳', gift: '一包零食', chore: '補貨', supplies: '貨', supplier: '物流倉庫', secret: '陳列方式和促銷檔期', hard: '近！快！什麼都有！', set: '組合包', taste: '買', menu: '商品' },
  };
  const FOOD_IND = ['breakfast', 'noodle', 'drinks', 'store'];
  const word = (indId, key) => (WORDS[indId] || WORDS.breakfast)[key] ?? key;
  const fillWords = (text, indId) => (typeof text === 'string' ? text.replace(/\{w:(\w+)\}/g, (_, k) => word(indId, k)) : text);
  // 遊戲開始時把共用設備的名字換成這一行的叫法（例如理髮店的「菜單看板」叫「價目表看板」）
  const applyNames = (indId) => {
    for (const d of CATALOG) {
      if (!d.names) continue;
      if (!d.baseName) d.baseName = d.name;
      d.name = d.names[indId] || d.baseName;
    }
  };

  const CAT_LABELS = {
    station: '生財設備',
    seat: '座位',
    wait: '等候區',
    shop: '陳列',
    staff: '員工區',
    tool: '生財工具',
    decor: '裝潢',
  };

  // 店面大小
  const LOTS = [
    { id: 'small', name: '小店面', w: 8, h: 6, rentMult: 1, cost: 0 },
    { id: 'medium', name: '中店面', w: 11, h: 7, rentMult: 1.7, cost: 180000, lv: 3 },
    { id: 'large', name: '大店面', w: 14, h: 8, rentMult: 2.6, cost: 380000, lv: 6 },
    { id: 'flagship', name: '旗艦店面', w: 17, h: 9, rentMult: 3.8, cost: 900000, lv: 15 },
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
  // Lv.11 以後主要靠分店和加盟賺的錢升級
  // Lv.26～40 給第二幕（約第 1～3 年）：主要靠分店、加盟、集團的毛利升級，強的路線大約第 1000 天到 Lv.40
  const LEVELS = [0, 250, 900, 2000, 3800, 6500, 10000, 15000, 22000, 31000, 40000, 52000, 66000, 82000, 100000, 122000, 148000, 178000, 212000, 250000, 295000, 345000, 400000, 460000, 530000, 650000, 780000, 920000, 1080000, 1260000, 1460000, 1680000, 1920000, 2180000, 2460000, 2800000, 3180000, 3600000, 4050000, 4550000];

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
    rookie: { name: '新手', desc: '🤖 小幫手幫你顧店，多兩個員工，客人超有耐心', patience: 2.1, events: 0.35, cash: 2, rival: 0.35, inspect: 0.3, fines: 0.3, drain: 0.7, wage: 0.95, helper: true, extraStaff: 2, karen: 0.5 },
    easy: { name: '輕鬆', desc: '資金多、客人有耐心、事件少；🤖 小幫手預設打開（幫你顧店，建設和設定你決定）', patience: 1.6, events: 0.5, cash: 1.6, rival: 0.55, inspect: 0.5, fines: 0.5, drain: 0.8, wage: 0.95, helper: true, extraStaff: 1 },
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

  // ───── 裝潢風格：同一種風格湊齊會有加成，會吸引特定的客人 ─────
  const DECOR_THEMES = {
    retro: { icon: '🏮', name: '台味復古', desc: '長輩和觀光客很愛，評價小加分', types: { elderly: 1.25, family: 1.05 }, items: ['shrine', 'luckycat', 'lantern', 'poster', 'barberpole', 'tirewall', 'statue'] },
    artsy: { icon: '🌿', name: '文青', desc: '上班族和學生覺得有質感，比較能接受高一點的價格', types: { office: 1.15, student: 1.1 }, items: ['plant', 'mural', 'greenwall', 'artpiece', 'chandelier', 'magazine'] },
    insta: { icon: '📸', name: '網美', desc: '學生最愛，小編貼文效果更好', types: { student: 1.25 }, items: ['photowall', 'neon', 'claw', 'fame'] },
    tech: { icon: '🤖', name: '科技', desc: '上班族覺得很新潮，員工做事也順一點', types: { office: 1.2 }, items: ['tv', 'robot', 'ledsign'] },
    cozy: { icon: '🛋️', name: '溫馨', desc: '家庭客喜歡，員工心情好、客人比較有耐心', types: { family: 1.2 }, items: ['aquarium', 'umbrella', 'menuboard', 'helmetrack'] },
  };
  // 高級裝潢的美觀度調高：佔一樣的格子，效果要對得起價錢
  const BEAUTY_FIX = { neon: 5, fame: 9, aquarium: 5, mural: 9, ledsign: 6, chandelier: 12, greenwall: 14, artpiece: 16, robot: 8, statue: 20 };
  for (const d of CATALOG) {
    if (BEAUTY_FIX[d.id]) d.beauty = BEAUTY_FIX[d.id];
    for (const [k, t] of Object.entries(DECOR_THEMES)) if (t.items.includes(d.id)) d.theme = k;
  }

  // ───── 兼營業務：在台灣，每一行最後都會被逼成十項全能 ─────
  // 每項業務要買一台小設備；會帶來「額外」的客人（不搶原本的生意），有些還會讓客人順便買東西
  // rate：尖峰時每小時大約幾位客人；hours：各時段倍率（沒寫的時段用 base）；impulse：順便消費的機率
  // self：自助設備（不用店員）；seat：客人要坐下（像理髮椅）；rain／summer／winter／weekend：天氣季節加成
  const SIDE_BIZ = {
    store: [
      { id: 'sb_parcel', name: '包裹店到店', icon: '📦', desc: '下班後一堆人來領網購包裹，順便買飲料', price: 20, cost: 0, time: 1.6, rate: 5, base: 0.4, hours: { 12: 0.8, 18: 1, 19: 1, 20: 1, 21: 0.9 }, impulse: 0.45, lv: 2, stationPrice: 26000, kiosk: { color: '#c97b2c', prop: 'boxes' } },
      { id: 'sb_atm', name: 'ATM', icon: '🏧', desc: '自助設備，不用店員；領完錢的人常常順手買東西', price: 5, cost: 0, time: 0.8, rate: 5, base: 0.5, hours: { 0: 0.3, 1: 0.2, 7: 0.8, 12: 1, 18: 1, 19: 0.9 }, impulse: 0.35, self: true, lv: 2, stationPrice: 45000, kiosk: { color: '#2c6fbb', prop: 'screen' } },
      { id: 'sb_copy', name: '影印傳真', icon: '🖨️', desc: '學生、報稅季、補件的人，常常要店員幫忙', price: 30, cost: 8, time: 3, rate: 1.6, base: 0.4, hours: { 9: 1, 10: 1, 14: 0.9, 15: 0.9, 16: 0.8 }, impulse: 0.2, lv: 3, stationPrice: 38000, kiosk: { color: '#7f8c8d', prop: 'machine' } },
      { id: 'sb_hotdog', name: '熱狗大亨小傳', icon: '🌭', desc: '轉個不停的熱狗機，中午和半夜特別多人', price: 45, cost: 16, time: 1.2, rate: 3, base: 0.4, hours: { 12: 1, 13: 0.7, 22: 0.8, 23: 0.9, 0: 0.7 }, lv: 3, stationPrice: 32000, kiosk: { color: '#d9482b', prop: 'grill' } },
      { id: 'sb_kiosk', name: '多媒體機（售票繳費）', icon: '🎫', desc: '自助設備；演唱會開賣那天會大排長龍', price: 10, cost: 0, time: 1.5, rate: 2.5, base: 0.5, hours: { 11: 1, 12: 1, 19: 0.8 }, impulse: 0.3, self: true, lv: 4, stationPrice: 52000, kiosk: { color: '#8e44ad', prop: 'screen' } },
      { id: 'sb_power', name: '行動電源租借', icon: '🔋', desc: '自助設備；手機沒電的人會衝進來', price: 30, cost: 4, time: 0.6, rate: 1.2, base: 0.6, hours: { 17: 1, 18: 1, 21: 1 }, impulse: 0.25, self: true, lv: 4, stationPrice: 22000, kiosk: { color: '#2f8f6b', prop: 'screen' } },
      { id: 'sb_lotto', name: '彩券', icon: '🎰', desc: '抽成不多，但頭獎開出來會變觀光景點', price: 50, cost: 46, time: 1, rate: 2.5, base: 0.5, hours: { 17: 1, 18: 1, 19: 1, 20: 0.9 }, impulse: 0.3, lv: 5, stationPrice: 18000, kiosk: { color: '#f2c14e', prop: 'tickets' } },
      { id: 'sb_laundry', name: '投幣洗衣', icon: '🧺', desc: '自助設備；下雨天、梅雨季爆滿', price: 60, cost: 14, time: 2, rate: 1.4, base: 0.5, hours: { 20: 1, 21: 1, 22: 0.9 }, rain: 2.2, self: true, lv: 6, stationPrice: 68000, kiosk: { color: '#5aa9a0', prop: 'washer' } },
    ],
    breakfast: [
      { id: 'sb_parcelb', name: '代收社區包裹', icon: '📦', desc: '鄰居白天不在家，包裹都寄你這裡；來拿的人會順便買早餐', price: 10, cost: 0, time: 1, rate: 1.5, base: 0.5, hours: { 7: 1, 8: 1, 12: 0.8 }, impulse: 0.5, lv: 2, stationPrice: 6000, kiosk: { color: '#c97b2c', prop: 'boxes' } },
      { id: 'sb_lunchbox', name: '中午加賣便當', icon: '🍱', desc: '早餐收攤前再賺一波；營業到中午以後才有用', price: 95, cost: 48, time: 2.5, rate: 6, base: 0, hours: { 11: 0.8, 12: 1, 13: 0.6 }, lv: 3, stationPrice: 42000, kiosk: { color: '#e67e22', prop: 'grill' } },
      { id: 'sb_pourover', name: '精品手沖咖啡', icon: '☕', desc: '吸引文青和上班族，但手沖很花時間', price: 90, cost: 20, time: 4, rate: 2.2, base: 0.3, hours: { 7: 1, 8: 1, 9: 0.8, 10: 0.7 }, lv: 4, stationPrice: 36000, kiosk: { color: '#6b4a32', prop: 'coffee' } },
      { id: 'sb_kidsbrunch', name: '親子早午餐', icon: '🧸', desc: '週末的大客單，小朋友會在店裡跑來跑去', price: 220, cost: 85, time: 6, rate: 1, base: 0.2, hours: { 8: 0.8, 9: 1, 10: 1, 11: 0.8 }, weekend: 3, lv: 6, stationPrice: 30000, kiosk: { color: '#e0478a', prop: 'toys' } },
    ],
    noodle: [
      { id: 'sb_luwei', name: '外帶滷味攤', icon: '🍢', desc: '晚上下班的人最愛，自己夾自己選', price: 130, cost: 55, time: 3, rate: 3.5, base: 0.3, hours: { 17: 0.9, 18: 1, 19: 1, 20: 0.8 }, lv: 3, stationPrice: 34000, kiosk: { color: '#8e5a2b', prop: 'pot' } },
      { id: 'sb_bentob', name: '便當外帶', icon: '🍱', desc: '附近辦公室的團訂，中午一次來一大批', price: 100, cost: 52, time: 2, rate: 4.5, base: 0.2, hours: { 11: 0.9, 12: 1, 13: 0.5 }, lv: 3, stationPrice: 30000, kiosk: { color: '#e67e22', prop: 'grill' } },
      { id: 'sb_dumpling', name: '網路團購冷凍水餃', icon: '🥟', desc: '團購主幫你賣，客人來取貨；做太多會壓到現場人手', price: 260, cost: 125, time: 1.5, rate: 1.2, base: 0.5, hours: { 17: 1, 18: 1, 19: 1 }, impulse: 0.3, lv: 5, stationPrice: 40000, kiosk: { color: '#2c6fbb', prop: 'freezer' } },
      { id: 'sb_newyear', name: '年菜代訂', icon: '🧧', desc: '只有過年前（1、2 月）有人訂，一單很大', price: 1880, cost: 1050, time: 8, rate: 0.5, base: 0.6, months: [1, 2], lv: 8, stationPrice: 25000, kiosk: { color: '#c0392b', prop: 'boxes' } },
    ],
    drinks: [
      { id: 'sb_chicken', name: '雞排炸物', icon: '🍗', desc: '珍奶配雞排，晚上生意翻倍；油煙和燙傷要小心', price: 85, cost: 34, time: 4, rate: 4, base: 0.2, hours: { 16: 0.8, 17: 1, 18: 1, 19: 1, 20: 0.9, 21: 0.8 }, lv: 3, stationPrice: 48000, kiosk: { color: '#d4a017', prop: 'fryer' } },
      { id: 'sb_dessert', name: '甜點冰品', icon: '🍮', desc: '下午茶時段的好幫手，夏天更好賣', price: 75, cost: 24, time: 2, rate: 2.4, base: 0.4, hours: { 14: 1, 15: 1, 16: 0.9 }, summer: 1.6, lv: 4, stationPrice: 36000, kiosk: { color: '#f4a3c0', prop: 'freezer' } },
      { id: 'sb_fruit', name: '現切水果杯', icon: '🍉', desc: '夏天的祕密武器，但水果放太久會壞', price: 65, cost: 26, time: 2.5, rate: 2.5, base: 0.4, hours: { 13: 1, 14: 1, 15: 1, 16: 0.8 }, summer: 2, winter: 0.4, lv: 5, stationPrice: 28000, kiosk: { color: '#2f8f6b', prop: 'fruit' } },
      { id: 'sb_merch', name: '聯名周邊小物', icon: '🧸', desc: '粉絲會專程來買，貼文效果更好', price: 380, cost: 160, time: 1, rate: 0.8, base: 0.5, hours: { 15: 1, 19: 1, 20: 1 }, weekend: 2, lv: 7, stationPrice: 42000, kiosk: { color: '#8e44ad', prop: 'toys' } },
    ],
    barber: [
      { id: 'sb_ear', name: '掏耳朵', icon: '👂', desc: '長輩的最愛，聊天聊到捨不得走', price: 200, cost: 5, time: 14, rate: 1, base: 0.6, hours: { 9: 1, 10: 1, 14: 0.9 }, seat: true, lv: 2, stationPrice: 16000, kiosk: { color: '#c97b2c', prop: 'chair' } },
      { id: 'sb_shampoo', name: '洗髮精、髮蠟販售', icon: '🧴', desc: '剪完順便推銷，推太用力客人會覺得煩', price: 380, cost: 200, time: 1, rate: 1, base: 0.6, hours: { 11: 1, 16: 1, 17: 1 }, lv: 3, stationPrice: 12000, kiosk: { color: '#5aa9a0', prop: 'bottles' } },
      { id: 'sb_massage', name: '肩頸按摩', icon: '💆', desc: '上班族下班來放鬆，客單高、但很耗員工體力', price: 450, cost: 10, time: 25, rate: 0.9, base: 0.3, hours: { 17: 1, 18: 1, 19: 0.9 }, seat: true, lv: 4, stationPrice: 32000, kiosk: { color: '#6c5ce7', prop: 'chair' } },
      { id: 'sb_donate', name: '剪髮捐贈', icon: '🎗️', desc: '幫要捐髮的客人免費修剪；不賺錢，但口碑和粉絲會變好', price: 0, cost: 0, time: 18, rate: 0.3, base: 0.6, hours: { 10: 1, 14: 1 }, goodwill: true, seat: true, lv: 5, stationPrice: 8000, kiosk: { color: '#e0478a', prop: 'chair' } },
      { id: 'sb_pet', name: '寵物修剪', icon: '🐶', desc: '狗狗在店裡吠，其他客人有人愛、有人怕', price: 650, cost: 60, time: 40, rate: 0.5, base: 0.5, hours: { 10: 1, 11: 1, 15: 1 }, weekend: 2, seat: true, lv: 7, stationPrice: 45000, kiosk: { color: '#d4a017', prop: 'chair' } },
    ],
    scooter: [
      { id: 'sb_gear', name: '雨衣安全帽', icon: '🧥', desc: '下雨天臨時衝進來買雨衣的人超多', price: 450, cost: 260, time: 1, rate: 1, base: 0.6, hours: { 7: 1, 8: 1, 17: 1, 18: 1 }, rain: 4, lv: 2, stationPrice: 15000, kiosk: { color: '#2c6fbb', prop: 'helmets' } },
      { id: 'sb_inspect', name: '代辦驗車過戶', icon: '📋', desc: '幫客人跑監理站的流程，很花時間但很賺', price: 600, cost: 220, time: 10, rate: 0.6, base: 0.6, hours: { 9: 1, 10: 1, 14: 1, 15: 1 }, lv: 3, stationPrice: 10000, kiosk: { color: '#7f8c8d', prop: 'desk' } },
      { id: 'sb_wash', name: '機車美容洗車', icon: '🧽', desc: '晴天週末生意好，地板會變很濕', price: 150, cost: 20, time: 12, rate: 1.2, base: 0.4, hours: { 10: 1, 11: 1, 15: 1, 16: 1 }, weekend: 1.8, rain: 0.2, lv: 3, stationPrice: 26000, kiosk: { color: '#5aa9a0', prop: 'washer' } },
      { id: 'sb_used', name: '二手車買賣', icon: '🛵', desc: '一台賺好幾千，但要小心泡水車和贓車', price: 3800, cost: 2600, time: 25, rate: 0.35, base: 0.6, hours: { 11: 1, 15: 1, 16: 1 }, weekend: 1.6, lv: 4, stationPrice: 60000, kiosk: { color: '#d9482b', prop: 'scooter' } },
      { id: 'sb_rent', name: '機車出租', icon: '🔑', desc: '觀光客和學生租車；車子回來的狀況不一定', price: 500, cost: 90, time: 5, rate: 0.8, base: 0.5, hours: { 9: 1, 10: 1 }, weekend: 2.2, lv: 5, stationPrice: 55000, kiosk: { color: '#f2c14e', prop: 'keys' } },
      { id: 'sb_swap', name: '電池交換站', icon: '🔋', desc: '自助設備；電動機車騎士來換電池，順便問保養', price: 40, cost: 26, time: 1, rate: 3, base: 0.5, hours: { 7: 1, 8: 1, 18: 1, 19: 1 }, impulse: 0.12, self: true, lv: 6, stationPrice: 90000, kiosk: { color: '#2f8f6b', prop: 'screen' } },
    ],
  };
  // 適合誰：每項業務的主要客群（1 = 普通，越高越靠這群人）
  // 同一項業務放在不同的店，客群對不對、店面夠不夠大、會不會互相干擾，生意差很多
  const SIDE_AUD = {
    sb_parcel: { office: 1.4, student: 1.3, elderly: 0.6 },
    sb_atm: {},
    sb_copy: { student: 1.6, office: 1.1, elderly: 0.7 },
    sb_hotdog: { student: 1.4, office: 1.2, elderly: 0.6 },
    sb_kiosk: { student: 1.7, office: 1, elderly: 0.4 },
    sb_power: { student: 1.5, office: 1.3, elderly: 0.3 },
    sb_lotto: { elderly: 1.7, family: 1.1, student: 0.4 },
    sb_laundry: { student: 1.5, family: 1.1, office: 0.8 },
    sb_parcelb: { office: 1.3, family: 1.1, student: 0.7 },
    sb_lunchbox: { office: 1.7, student: 1, elderly: 0.7 },
    sb_pourover: { office: 1.7, student: 1, elderly: 0.4 },
    sb_kidsbrunch: { family: 1.8, elderly: 0.8, office: 0.5, student: 0.4 },
    sb_luwei: { office: 1.3, student: 1.3, elderly: 0.7 },
    sb_bentob: { office: 1.8, student: 0.9, elderly: 0.6 },
    sb_dumpling: { family: 1.5, elderly: 1.1, student: 0.6 },
    sb_newyear: { family: 1.4, elderly: 1.5, student: 0.2, office: 0.8 },
    sb_chicken: { student: 1.6, office: 1, elderly: 0.5 },
    sb_dessert: { student: 1.3, family: 1.3, elderly: 0.7 },
    sb_fruit: { office: 1.3, family: 1.2, elderly: 0.9 },
    sb_merch: { student: 2, family: 0.8, elderly: 0.2 },
    sb_ear: { elderly: 2, family: 0.9, student: 0.3 },
    sb_shampoo: { office: 1.4, student: 1.2, elderly: 0.6 },
    sb_massage: { office: 2, elderly: 1, student: 0.3 },
    sb_donate: { student: 1.4, family: 1.2, elderly: 0.5 },
    sb_pet: { family: 1.6, office: 0.9, elderly: 0.8, student: 0.7 },
    sb_gear: {},
    sb_inspect: { elderly: 1.5, office: 1.2, student: 0.5 },
    sb_wash: { student: 1.2, family: 1.3, elderly: 0.8 },
    sb_used: { student: 1.6, family: 1.1, elderly: 0.6 },
    sb_rent: { student: 1.7, family: 1, elderly: 0.4 },
    sb_swap: { office: 1.5, student: 1.2, elderly: 0.4 },
  };
  // 互相干擾：狗在吠，掏耳朵、按摩的客人放鬆不了；油煙會讓甜點和手搖的客人皺眉
  const SIDE_CLASH = { sb_pet: ['sb_ear', 'sb_massage'], sb_chicken: ['sb_dessert', 'sb_fruit'], sb_wash: ['sb_inspect'] };
  for (const list of Object.values(SIDE_BIZ)) for (const b of list) b.aud = SIDE_AUD[b.id] || {};

  // 平衡：照「設備費大約 6 週回本（已經扣掉員工時間）」反推每項業務的客流量
  // 每項業務的個性（尖峰時段、順便消費、要不要店員、事件）不變，只校正客人有多少
  const PAYBACK_WEEKS = 6;
  for (const ind of INDUSTRIES) {
    const core = ind.products.filter((p) => !p.rd);
    const cw = core.reduce((t, p) => t + p.weight, 0);
    const coreMargin = core.reduce((t, p) => t + (p.price - p.cost) * p.weight, 0) / cw;
    for (const b of SIDE_BIZ[ind.id] || []) {
      let hrs = 0;
      for (let m = ind.open; m < ind.close; m += 60) {
        const h = Math.floor(m / 60) % 24;
        hrs += b.hours && b.hours[h] != null ? b.hours[h] : b.base ?? 0.4;
      }
      const wk = 7 * (b.weekend ? (5 + 2 * b.weekend) / 7 : 1) * (b.months ? b.months.length / 12 : 1);
      const perCust = b.price - b.cost + (b.impulse || 0) * coreMargin * 0.9;
      const labor = b.self ? 0 : (b.time / 60) * ind.hourlyWage * 1.3;
      const net = perCust - labor;
      const want = b.stationPrice / PAYBACK_WEEKS;
      b.rate0 = b.rate;
      // 不賺錢的（像剪髮捐贈）保留原本的客流：它的回報是口碑和粉絲
      // 客流上限：低毛利的業務（像 ATM）不會為了回本塞爆店面，回本慢一點也沒關係
      if (net > 0 && hrs > 0) b.rate = Math.max(0.15, Math.min(b.self ? 5 : 4, want / (wk * hrs * net)));
    }
  }
  for (const ind of INDUSTRIES) {
    for (const b of SIDE_BIZ[ind.id] || []) {
      // weight 0：一般客人不會點，只有專門為這項業務來的客人
      ind.products.push({ id: b.id, name: b.name, icon: b.icon, price: b.price, cost: b.cost, time: b.time, station: `${b.id}_st`, weight: 0, side: b });
      CATALOG.push({
        id: `${b.id}_st`,
        name: b.name,
        icon: b.icon,
        cat: 'station',
        side: b.id,
        price: b.stationPrice,
        w: 1,
        kw: 0.6,
        serves: [b.id],
        staff: b.self ? [] : b.seat ? [[0, 1]] : [[0, -1]],
        cust: b.seat ? [[0, 0]] : [[0, 1]],
        seatCust: !!b.seat,
        selfServe: !!b.self,
        industries: [ind.id],
        model: 'kiosk',
        kiosk: b.kiosk,
        lv: b.lv,
      });
    }
  }

  root.BossIndustries = { DECOR_THEMES, SIDE_BIZ, SIDE_CLASH, WORDS, FOOD_IND, word, fillWords, applyNames, INDUSTRIES, CATALOG, CAT_LABELS, LOTS, NAMES, TRAITS, LEVELS, DISTRICTS, DISTRICT_INFO, CUSTOMER_TYPES, DIFFICULTY, FLOORS, WALLS, SIGNS, BRANCH_SITES, BRANCH_SIZES, TOURIST_PREF };
})(typeof window !== 'undefined' ? window : globalThis);
