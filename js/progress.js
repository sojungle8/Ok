// 章節任務：新玩法一章一章解鎖，不會一開始就塞給玩家一大堆系統
// 每章有幾個任務（自動檢查），全部完成就拿到獎勵、解鎖下一批玩法
(function (root) {
  const Fun = root.BossFun;
  if (!Fun) return;

  // 每個玩法的名字和一句話說明（解鎖時會跳出來）
  Fun.FEATURES = {
    career: { icon: '👑', name: '主管系統', desc: '可以升組長、店長，每個人都有看不到的領導力和管理風格。到「員工 → 主管」看看。' },
    branch: { icon: '🏙️', name: '開分店', desc: '到「成長」挑地點和店面大小，開第一間分店。' },
    slash: { icon: '🔀', name: '斜槓員工', desc: '應徵者裡開始出現有副業的人：外送員、直播主、研究生……各有特長，也各有麻煩。' },
    seasonal: { icon: '🍂', name: '季節限定', desc: '到「經營」推出四週的季節限定新品，客人會變多。' },
    auth: { icon: '📋', name: '授權制度', desc: '到「員工 → 主管」設定規則：哪些事情店長可以直接處理、可以花多少錢。老闆不用每件事都親自點。' },
    area: { icon: '🗺️', name: '區經理', desc: '從分店店長裡挑一位升區經理，所有分店的士氣更穩、總部管理費更低。' },
    storetype: { icon: '🏬', name: '分店店型', desc: '開分店時可以選店型：車站快取店、社區店、觀光旗艦店，各有不同的客人和打法。' },
    kitchen: { icon: '🏭', name: '中央廚房', desc: '到「成長」蓋中央廚房：所有店的進貨成本下降，但出包時會一起受影響。' },
    franchise: { icon: '🤝', name: '加盟', desc: '開放加盟：不用自己出錢就能展店，收加盟金和權利金，但加盟主怎麼對員工，會算在你的品牌上。' },
    route: { icon: '🛤️', name: '第二幕：選擇路線', desc: '要上市上櫃、讓公司變得更大？還是走員工持股、百年老店的路？到「📜 任務」做選擇。' },
  };

  const lastWeeks = (s, n) => s.history.slice(-n);
  Fun.CHAPTERS = [
    {
      id: 'ch1',
      icon: '🌅',
      name: '第一章：開張大吉',
      story: '鐵捲門拉起來的那一刻，你成了老闆。先把店顧好、讓客人喜歡你。',
      quests: [
        { id: 'week1', text: '撐過第一週', check: (s) => s.week >= 2 },
        { id: 'rating40', text: '評價達到 4.0 星（至少 30 則評論）', check: (s) => s.reviews.length >= 30 && s.rating >= 4, prog: (s) => `現在 ${s.rating.toFixed(1)} 星・${s.reviews.length} 則` },
        { id: 'post1', text: '小編發第一篇貼文', check: (s) => s.social.posts.length >= 1 },
        { id: 'staff5', text: '員工達到 5 人', check: (s) => s.staff.length >= 5, prog: (s) => `現在 ${s.staff.length} 人` },
      ],
      reward: { cash: 30000, xp: 300 },
      unlock: ['career'],
    },
    {
      id: 'ch2',
      icon: '🌱',
      name: '第二章：站穩腳步',
      story: '熟客開始叫得出店員的名字了。是時候培養幫手，也想想下一間店。',
      quests: [
        { id: 'lv5', text: '店家升到 Lv.5', check: (s) => s.level >= 5, prog: (s) => `現在 Lv.${s.level}` },
        { id: 'promote', text: '升一位組長或店長', check: (s) => s.staff.some((e) => e.rank) || s.branches.some((b) => b.manager) },
        { id: 'profit2', text: '連續 2 週淨利為正', check: (s) => lastWeeks(s, 2).length === 2 && lastWeeks(s, 2).every((h) => h.profit > 0) },
        { id: 'quality', text: '衛生稽查拿到「優」，或評價 4.3 星以上', check: (s) => s.hygiene.badge || (s.reviews.length >= 30 && s.rating >= 4.3) },
      ],
      reward: { cash: 80000, xp: 800 },
      unlock: ['branch', 'slash', 'seasonal'],
    },
    {
      id: 'ch3',
      icon: '🏙️',
      name: '第三章：連鎖之路',
      story: '招牌掛到了別的城市。你不可能每間店都顧，得學會把事情交給對的人。',
      quests: [
        { id: 'br2', text: '開第一間分店', check: (s) => s.branches.length >= 1, prog: (s) => `現在 ${s.branches.length} 間` },
        { id: 'brmgr', text: '派一位分店店長', check: (s) => s.branches.some((b) => b.manager) },
        { id: 'season1', text: '推出一次季節限定', check: (s) => (s.seasonalCount || 0) >= 1 },
        { id: 'lv10', text: '店家升到 Lv.10', check: (s) => s.level >= 10, prog: (s) => `現在 Lv.${s.level}` },
      ],
      reward: { cash: 200000, xp: 2000 },
      unlock: ['auth', 'area', 'storetype'],
    },
    {
      id: 'ch4',
      icon: '🏭',
      name: '第四章：規模化',
      story: '店多了，問題也多了。制度要清楚、供應要穩，品牌才撐得住。',
      quests: [
        { id: 'br5', text: '分店達到 3 間', check: (s) => s.branches.length >= 3, prog: (s) => `現在 ${s.branches.length} 間` },
        { id: 'auth1', text: '設定至少一條授權規則', check: (s) => Object.values(s.policy.auth || {}).some((v) => v && v !== 'off') },
        { id: 'area1', text: '任命一位區經理', check: (s) => !!s.areaManager },
        // 門檻跟著產業的規模走（大約是開店資金的六成）
        { id: 'week300', text: '單週淨利超過開店資金的六成', check: (s) => (s.bestCoreWeek || 0) >= s.ind.cash * 0.6, prog: (s) => `目標 $${Math.round(s.ind.cash * 0.6).toLocaleString()}・最高 $${Math.round(s.bestCoreWeek || 0).toLocaleString()}` },
        { id: 'lv15', text: '店家升到 Lv.15', check: (s) => s.level >= 15, prog: (s) => `現在 Lv.${s.level}` },
      ],
      reward: { cash: 500000, xp: 5000 },
      unlock: ['kitchen', 'franchise'],
    },
    {
      id: 'ch5',
      icon: '🌏',
      name: '第五章：品牌',
      story: '你的店已經是一個品牌了。接下來要決定：它要長成什麼樣子？',
      quests: [
        { id: 'lv20', text: '店家升到 Lv.20', check: (s) => s.level >= 20, prog: (s) => `現在 Lv.${s.level}` },
        { id: 'shops8', text: '分店加加盟店達到 6 間', check: (s) => s.branches.length + (s.franchises || []).length >= 6, prog: (s) => `現在 ${s.branches.length + (s.franchises || []).length} 間` },
        { id: 'kitchen1', text: '蓋好中央廚房', check: (s) => !!s.kitchen },
        { id: 'clean12', text: '連續 12 週沒有被罰款（走歪的人：黑歷史 40 以上而且沒被抓過）', check: (s) => (lastWeeks(s, 12).length === 12 && lastWeeks(s, 12).every((h) => !h.fines)) || !!(s.dark && s.dark.heat >= 40 && !s.dark.caught), prog: (s) => `最近 ${(() => { let n = 0; for (const h of [...s.history].reverse()) { if (h.fines) break; n++; } return n; })()} 週` },
      ],
      reward: { cash: 1000000, xp: 10000 },
      unlock: ['route'],
    },
  ];

  // 第二幕：兩條路，各自有任務和結局
  Fun.ROUTES = {
    ipo: {
      icon: '🔔',
      name: '上市上櫃',
      desc: '找投資人、進董事會、每季交出成績單。有投資人的錢可以衝，但要分紅給他們；而且「要不要為了成長犧牲員工」會一直來敲門。',
      quests: [
        { id: 'ipo_round', text: '完成一輪募資（引進投資人）', check: (s) => !!(s.ipo && s.ipo.investors) },
        { id: 'ipo_q3', text: '連續 3 季達成董事會的目標', check: (s) => !!(s.ipo && s.ipo.streak >= 3), prog: (s) => `連續 ${(s.ipo && s.ipo.streak) || 0} 季` },
        { id: 'ipo_jerk', text: '慣老闆指數維持在 20 以下', check: (s) => s.jerk < 20 },
        { id: 'ipo_list', text: '敲鐘掛牌', check: (s) => !!(s.ipo && s.ipo.listed) },
      ],
      ending: { title: '敲鐘了！', medal: '🔔', text: '你站在交易所的鐘前面，身後站著一路走來的員工。公司變大了，但你沒有變成慣老闆。' },
    },
    coop: {
      icon: '🤲',
      name: '員工持股・百年老店',
      desc: '不追求最大，追求最久。把股份分給員工、把手藝傳下去，讓這間店變成大家的店。',
      quests: [
        { id: 'coop_share', text: '推出員工持股計畫', check: (s) => !!(s.coop && s.coop.shares) },
        { id: 'coop_happy', text: '本店和所有分店的士氣都在 80 以上', check: (s) => s.morale >= 80 && s.branches.every((b) => b.morale >= 80), prog: (s) => `本店 ${Math.round(s.morale)}・分店最低 ${s.branches.length ? Math.round(Math.min(...s.branches.map((b) => b.morale))) : '—'}` },
        { id: 'coop_mentor', text: '培養出 5 位店長（含分店店長）', check: (s) => s.staff.filter((e) => e.rank === 'manager').length + s.branches.filter((b) => b.manager).length >= 5 },
        { id: 'coop_heir', text: '指定接班人', check: (s) => !!(s.coop && s.coop.heir) },
      ],
      ending: { title: '百年老店', medal: '🏮', text: '招牌換過三次油漆，店裡的人換了好幾輪，但每個在這裡工作過的人，都說這是他做過最好的工作。' },
    },
    dark: {
      icon: '🕶️',
      name: '黑心財團',
      desc: '最賺錢的方法都寫在法條裡。手段越多賺越快，但黑歷史越高越容易爆雷；被抓三次就東窗事發。',
      // 只有已經走歪過（接受過誘惑、開過邪門手段）的人才看得到這條路
      need: (s) => !!(s.dark && s.dark.unlocked && !s.dark.busted),
      quests: [
        { id: 'dark_3', text: '同時開著 3 種邪門手段', check: (s) => s.darkActive().length >= 3, prog: (s) => `現在 ${s.darkActive().length} 種` },
        { id: 'dark_money', text: '靠邪門手段賺到開店資金的 20 倍', check: (s) => (s.dark.earned || 0) >= s.ind.cash * 20, prog: (s) => `$${Math.round(s.dark.earned || 0).toLocaleString()} / $${(s.ind.cash * 20).toLocaleString()}` },
        { id: 'dark_rival', text: '把對面的店打到收掉', check: (s) => !!(s.rival && s.rival.closed) },
        { id: 'dark_safe', text: '黑歷史 80 以上還沒東窗事發', check: (s) => s.dark.heat >= 80 && !s.dark.busted, prog: (s) => `黑歷史 ${Math.round(s.dark.heat)}` },
      ],
      ending: { title: '黑心帝國', medal: '👑', text: '你成了業界最有錢的老闆。新聞叫你「傳奇」，員工私下叫你「那個人」。每次經過地檢署，你都會不自覺地加快腳步。' },
    },
  };

  // 🕶️ 邪門手段：最賺錢的方法都寫在法條裡（諷刺：現實中每一項都是違法的）
  // heat：每週增加的黑歷史；risk：被抓機率的倍數；tempt：找上門的誘惑
  Fun.DARK = {
    books: { icon: '📒', name: '兩本帳', desc: '營業稅幾乎不用繳，還能虛報進項退稅', law: '稅捐稽徵法', heat: 1, risk: 1, tempt: { who: '會計師事務所的「老江湖」', text: '「老闆，大家都這樣做啦。一本給國稅局看，一本給自己看，稅少繳八成，誰查得到？」', yes: '「那就麻煩你了」' } },
    insure: { icon: '🧾', name: '低報投保薪資', desc: '勞健保、勞退少繳八成', law: '勞工保險條例', heat: 1, risk: 1, tempt: { who: '人資顧問', text: '「投保薪資照基本工資報就好，員工也不會去查。一個月省下來的保費，夠你再開半間店。」', yes: '「照你說的報」' } },
    relabel: { icon: '🛢️', name: '過期品改標籤', desc: '進貨成本省三成', law: '食品安全衛生管理法', heat: 1.5, risk: 1.3, tempt: { who: '供應商業務', text: '「這批剩三天就到期，我半價給你。標籤我們幫你重貼，日期往後推一個月，吃不死人啦。」', yes: '「全部給我」' } },
    reviews: { icon: '⭐', name: '買假好評', desc: '每週灌 8 則五星，評價往上衝', law: '公平交易法', heat: 0.8, risk: 1.2, tempt: { who: '網路行銷公司', text: '「五星好評一則二十塊，保證真人帳號、每則都不一樣。你的對手都在買了，你不買就輸了。」', yes: '「先買一個月」' } },
    squeeze: { icon: '🦈', name: '削價殺對手', desc: '賠錢賣、挖角，對手很快撐不住；客人 +8%', law: '公平交易法', heat: 0.5, risk: 0.8, tempt: { who: '你的大學同學（現在在財團上班）', text: '「打仗就要打到對方站不起來。先賠錢賣三個月，把他的員工高薪挖過來，之後整條街都是你的。」', yes: '「開打」' } },
    mill: { icon: '💰', name: '加盟吸金', desc: '狂開招商說明會收加盟金，收了不管', law: '公平交易法', heat: 1.2, risk: 1, need: (s) => s.feature('franchise'), tempt: { who: '加盟展的策展人', text: '「說明會一場收十個加盟主，加盟金先收，之後他們做得好不好是他們的事。這才叫品牌授權。」', yes: '「每週辦一場」' } },
    politics: { icon: '🍱', name: '政商關係', desc: '逢年過節送禮給議員：勞檢變少、其他手段被抓的機率 -45%', law: '貪污治罪條例', heat: 1, risk: 0.6, tempt: { who: '議員服務處主任', text: '「老闆，議員很欣賞你。逢年過節走動走動，以後衛生局、勞工局要來，我們都會先『關心』一下。」', yes: '「請議員多多指教」' } },
    pump: { icon: '📈', name: '財報美化、炒股', desc: '上市公司限定：作帳拉股價，邊拉邊賣手上的持股', law: '證券交易法', heat: 2, risk: 1.2, need: (s) => !!(s.ipo && s.ipo.listed), tempt: { who: '投顧老師', text: '「財報數字修漂亮一點，我這邊幫你喊盤，股價拉上去你就慢慢倒貨。散戶？他們自己要買的。」', yes: '「就這麼辦」' } },
  };

  // Lv.11～25 的獎勵（裝潢、店面之外的好處）
  // 每一級都有東西拿：前 10 級主要解鎖設備，之後是看得到的經營效果
  Fun.LEVEL_PERKS = {
    11: '應徵者裡出現更多老手',
    12: '員工活動花費打八折',
    13: '研發費用打八折',
    14: '分店開店費打九折',
    15: '小編貼文漲粉 +15%',
    16: '每週多一個應徵者',
    17: '主管培訓課打八折',
    18: '叫急件的加價從三成降到一成五',
    19: '客人的耐心 +10%',
    20: '新分店開幕期縮短（從六成五的客人開始）',
    21: '評價計算時，最低的 5 則一星不算（老客人會幫你說話）',
    22: '總部管理費 -20%',
    23: '員工心情恢復變快',
    24: '稽查罰款 -20%',
    25: '所有店的評價 +0.1',
    26: '來申請加盟的人素質更好',
    27: '兼營業務上課費打八折',
    28: '分店改裝費 -30%',
    29: '中央廚房再省 5% 物料',
    30: '所有店來客 +3%',
    31: '分店士氣 +3',
    32: '季節限定多賣一週',
    33: '老闆每天壓力少一點',
    34: '加盟權利金 +10%',
    35: '應徵者的技能更高',
    36: '公司估值 +5%',
    37: '總部管理費再 -10%',
    38: '客人的耐心再 +5%',
    39: '員工心情恢復再快一點',
    40: '所有店的評價再 +0.1',
  };
  // 店家稱號：每 5 級換一個，招牌旁邊、升級卡片上看得到
  Fun.LEVEL_TITLES = { 1: '路邊小店', 5: '巷口名店', 10: '在地人氣店', 15: '排隊名店', 20: '連鎖品牌', 25: '傳說中的老闆', 30: '國民品牌', 35: '業界傳奇', 40: '台灣之光' };
  Fun.levelTitle = (lv) => {
    let t = Fun.LEVEL_TITLES[1];
    for (const [l, n] of Object.entries(Fun.LEVEL_TITLES)) if (lv >= Number(l)) t = n;
    return t;
  };
})(typeof window !== 'undefined' ? window : globalThis);

// 店型、季節限定（章節解鎖的玩法資料）
(function (root) {
  const Fun = root.BossFun;
  if (!Fun) return;

  // 分店店型：draw 來客、rent 房租、morale 士氣、rating 評價、cost 開店費、premium 高價不掉客
  Fun.STORE_TYPES = {
    standard: { icon: '🏪', name: '標準店', desc: '什麼都剛剛好' },
    station: { icon: '🚉', name: '車站快取店', desc: '人潮多、客人趕時間：來客 +22%，但員工比較累（士氣 -5）', draw: 1.22, morale: -5, cost: 1.1 },
    community: { icon: '🏘️', name: '社區店', desc: '熟客多、房租便宜：房租 -30%、士氣 +5、評價 +0.15，來客 -10%', draw: 0.9, rent: 0.7, morale: 5, rating: 0.15, cost: 0.9 },
    tourist: { icon: '📸', name: '觀光旗艦店', desc: '觀光客不在意價格：來客 +12%、高價位不掉客，但房租 ×1.4、開店費 ×1.3', draw: 1.12, rent: 1.4, premium: true, rating: 0.05, cost: 1.3 },
  };

  // 季節限定：春夏秋冬各一個（依產業）
  Fun.SEASONAL = {
    breakfast: ['🌸 櫻花奶茶', '🥭 芒果厚片', '🎃 南瓜蛋餅', '🫚 薑汁豆漿'],
    noodle: ['🎋 鮮筍湯麵', '🧊 夏日涼麵', '🍄 麻油麵線', '🍲 羊肉爐麵'],
    drinks: ['🍓 草莓鮮奶', '🥭 芒果冰沙', '🌼 桂花烏龍', '🫚 黑糖薑茶'],
    barber: ['🎓 畢業季造型', '🌊 夏日清爽短髮', '🍂 秋季暖色染', '🧧 過年燙髮'],
    scooter: ['🌧️ 梅雨前輪胎健檢', '❄️ 夏季冷卻保養', '🗺️ 環島前大保養', '🔋 寒流電瓶健檢'],
    store: ['🌸 春遊野餐組', '🍧 冰品節', '🥮 中秋烤肉組', '🧧 年貨大街'],
  };
  Fun.SEASON_NAMES = ['春季', '夏季', '秋季', '冬季'];
})(typeof window !== 'undefined' ? window : globalThis);
