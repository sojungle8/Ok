// 🚘 電動車：老闆可以買的車（虛構品牌「電斯拉」全車系＋國產代步車），以及充電站業務
// 品牌、車名、標誌都是惡搞的諧音，車價照台灣實際行情的價差（Modal 3 約 170 萬、Modal Y 約 190 萬、S／X 三四百萬、皮卡要自己進口）
// 電價、充電費率、契約容量基本電費也參考台灣行情
(function (root) {
  const Fun = root.BossFun;
  if (!Fun) return;

  // 老闆的車：用老闆個人的錢買；一次只開一台，換車時舊車打五五折賣掉
  // ride：出門路程倍率；stress：每天壓力減少；weekly：每週油錢／電費＋保險保養
  // ev：電動車（自己有充電站的話，充電幾乎不用錢）；fans：買的時候粉絲增加（老闆開好車會被拍）
  Fun.CARS = {
    gas: { icon: '🚗', brand: '國產', name: '汽油代步車', cost: 650000, ride: 0.75, stress: 1, weekly: 2000, desc: '最實在的選擇：出門快、好停車；油錢比較貴' },
    m3: { icon: '🚙', brand: '電斯拉', name: 'Modal 3', cost: 1700000, ride: 0.75, stress: 1.5, weekly: 900, ev: true, desc: '入門電動轎車：充電比加油便宜很多，輔助駕駛讓通勤比較不累' },
    my: { icon: '🚙', brand: '電斯拉', name: 'Modal Y', cost: 1900000, ride: 0.75, stress: 1.5, weekly: 1000, ev: true, haul: 0.03, family: true, desc: '電動休旅車：後車廂超大，去批發市場進貨多打 3% 折、不會扛到腰痛；有小孩的話親子感情慢慢變好' },
    ms: { icon: '🏎️', brand: '電斯拉', name: 'Modal S', cost: 3690000, ride: 0.7, stress: 2, weekly: 1600, ev: true, fans: 300, show: true, desc: '旗艦轎車：又快又安靜；開出去會被拍，不過員工薪水太低的話他們會很有意見' },
    mx: { icon: '🚐', brand: '電斯拉', name: 'Modal X', cost: 4190000, ride: 0.7, stress: 2, weekly: 1800, ev: true, fans: 800, show: true, family: true, desc: '鷹翼門休旅：門一打開大家都在拍，粉絲大增；有小孩的話親子感情慢慢變好；員工薪水太低的話他們會很有意見' },
    ct: { icon: '🛻', brand: '電斯拉', name: '賽伯鐵牛', cost: 6000000, ride: 0.85, stress: 1, weekly: 2600, ev: true, fans: 1500, haul: 0.05, show: true, desc: '不鏽鋼電動皮卡：台灣沒有正式賣，要自己進口驗車；車太大巷子難鑽、出門慢一點，但載貨超強（進貨多打 5% 折），粉絲暴增' },
    rd: { icon: '🏁', brand: '電斯拉', name: '路霸跑車', cost: 7500000, ride: 0.6, stress: 3, weekly: 3000, ev: true, fans: 1200, show: true, ticket: 0.15, desc: '電動超跑：出門最快、開起來最紓壓；但很容易超速被開罰單' },
    cab: { icon: '🚖', brand: '電斯拉', name: '無人計程艙', cost: 1000000, ride: 0.85, stress: 1, weekly: 700, ev: true, robotaxi: true, desc: '沒有方向盤的雙人座：你不用的時候它會自己去載客賺錢（每週約 $4,000～8,000，平台抽兩成）；偶爾在路口卡住被拍上網' },
  };
  // 公司用的車：電動聯結車（有 2 間以上分店才用得到）
  Fun.SEMI = { icon: '🚛', brand: '電斯拉', name: '電動聯結車', cost: 8000000, weekly: 6000, materials: 0.05, desc: '公司自己的物流車（一台約 800 萬）：各店進貨成本 -5%；每週電費、司機、保養 $6,000（公司付）' };


  // 惡搞的品牌標誌（SVG，40×40）：車頭、車行、充電站的品牌列表都用這個
  const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="64" height="64">${body}</svg>`;
  const txt = (t, size, fill, y = 25, extra = '') => `<text x="20" y="${y}" font-size="${size}" font-family="Arial, sans-serif" font-weight="bold" fill="${fill}" text-anchor="middle" ${extra}>${t}</text>`;
  Fun.EV_LOGOS = {
    // 電斯拉：上面一道弧，底下的直槓是一道閃電（不是 T！）
    dsl: svg('<circle cx="20" cy="20" r="19" fill="#fff"/><path d="M5 11 Q20 3 35 11 L33 14 Q20 8 7 14 Z" fill="#d6202e"/><path d="M23 14 L14 25 L19.5 25 L16 36 L27 21.5 L21.5 21.5 L25 14 Z" fill="#d6202e"/>'),
    // 必亞迪：橢圓裡寫 BYE
    byd: svg('<ellipse cx="20" cy="20" rx="18.5" ry="11" fill="#fff" stroke="#c8102e" stroke-width="2.5"/>' + txt('BYE', 11, '#c8102e', 24)),
    // 玉龍：玉綠色圓、一個「玉」
    n7: svg('<circle cx="20" cy="20" r="18" fill="#2f8f7b"/>' + txt('玉', 20, '#fff', 27)),
    // 現帶：斜斜的 X（不是 H）
    ioniq: svg('<ellipse cx="20" cy="20" rx="18.5" ry="12" fill="#fff" stroke="#002c5f" stroke-width="2.5"/>' + txt('X', 17, '#002c5f', 26, 'font-style="italic" transform="skewX(-15) translate(5 0)"')),
    // 豈亞：手寫風的 KIO
    kia: svg('<rect x="1" y="9" width="38" height="22" rx="4" fill="#05141f"/>' + txt('KIO', 13, '#fff', 25, 'font-style="italic" letter-spacing="-1"')),
    // BNW：藍白四格圓標，字是 BNW
    bnw: svg('<circle cx="20" cy="20" r="19" fill="#111"/><circle cx="20" cy="20" r="11" fill="#fff"/><path d="M20 9 A11 11 0 0 1 31 20 L20 20 Z M20 31 A11 11 0 0 1 9 20 L20 20 Z" fill="#1c69d4"/>' + txt('BNW', 6.5, '#fff', 7.5)),
    // 冰士：三叉星換成雪花
    eq: svg('<circle cx="20" cy="20" r="18" fill="none" stroke="#9aa3ab" stroke-width="2.5"/><g stroke="#9aa3ab" stroke-width="2.5" stroke-linecap="round"><path d="M20 5 V35 M7 12.5 L33 27.5 M7 27.5 L33 12.5"/><path d="M16 8 L20 11 L24 8 M16 32 L20 29 L24 32"/></g>'),
    // 福思：圓裡疊 F 和 S
    vw: svg('<circle cx="20" cy="20" r="18.5" fill="#001e50"/><circle cx="20" cy="20" r="15.5" fill="none" stroke="#fff" stroke-width="2"/>' + txt('F', 12, '#fff', 19) + txt('S', 12, '#fff', 31)),
    // 沃弗：圓圈加一個往右上的閃電箭頭
    vol: svg('<circle cx="18" cy="22" r="13" fill="none" stroke="#1b365d" stroke-width="3.5"/><path d="M27 13 L35 5 M29 5 H35 V11" stroke="#1b365d" stroke-width="3.5" fill="none"/><rect x="4" y="18.5" width="28" height="7" fill="#1b365d"/>' + txt('WOLF', 6, '#fff', 24.3)),
    // 明爵：八角形寫 MJ
    mg: svg('<path d="M13 3 H27 L37 13 V27 L27 37 H13 L3 27 V13 Z" fill="#a6192e" stroke="#c9b37e" stroke-width="2"/>' + txt('MJ', 14, '#fff', 25)),
    // 保時傑：盾牌裡一個「傑」
    tay: svg('<path d="M6 4 H34 V20 Q34 32 20 37 Q6 32 6 20 Z" fill="#d5001c" stroke="#c9a64b" stroke-width="2.5"/><rect x="11" y="10" width="18" height="17" fill="#f2c94c"/>' + txt('傑', 14, '#111', 24)),
  };
  Fun.evLogoSvg = (id) => Fun.EV_LOGOS[id] || Fun.EV_LOGOS.dsl;

  // 電池容量（度）和最大直流快充功率（kW）：照各車款公開規格的大概數字
  // 車款：電斯拉各款；其他牌子用牌子的代表車
  Fun.EV_SPECS = {
    m3: { kwh: 60, dc: 170 }, my: { kwh: 75, dc: 250 }, ms: { kwh: 100, dc: 250 }, mx: { kwh: 100, dc: 250 }, ct: { kwh: 123, dc: 325 }, rd: { kwh: 200, dc: 250 }, cab: { kwh: 50, dc: 150 },
    byd: { kwh: 60, dc: 110 }, n7: { kwh: 78, dc: 150 }, ioniq: { kwh: 77, dc: 240 }, kia: { kwh: 77, dc: 240 }, bnw: { kwh: 84, dc: 205 }, eq: { kwh: 90, dc: 170 }, vw: { kwh: 77, dc: 135 }, vol: { kwh: 69, dc: 153 }, mg: { kwh: 64, dc: 140 }, tay: { kwh: 93, dc: 270 },
  };
  // 充電功率：快充在電量 50% 以前全速，50～80% 慢慢降，80% 以後只剩涓流（電池保護）；慢充交流 7kW 幾乎固定，最後 5% 變慢
  Fun.evChargeKw = (kind, soc, carDc) => {
    if (kind === 'slow') return soc < 0.95 ? 7 : 3.5;
    const p = Math.min(120, carDc || 120);
    const f = soc < 0.5 ? 1 : soc < 0.8 ? 1 - ((soc - 0.5) / 0.3) * 0.6 : Math.max(0.08, 0.4 - ((soc - 0.8) / 0.2) * 0.32);
    return p * f;
  };
  // 從現在的電量充到目標要幾分鐘（每分鐘算一次）
  Fun.evChargeMinutes = (kind, soc, target, battery, carDc) => {
    let m = 0;
    while (soc < target && m < 900) {
      soc += Fun.evChargeKw(kind, soc, carDc) / 60 / battery;
      m++;
    }
    return m;
  };

  // 來充電的電動車：各品牌（虛構諧音）和大概的比例
  Fun.EV_BRANDS = [
    { id: 'dsl', name: '電斯拉', icon: '🚙', share: 0.38, color: '#e8e8ea' },
    { id: 'byd', name: '必亞迪', icon: '🚘', share: 0.12, color: '#3b6fb6' },
    { id: 'n7', name: '玉龍 n7', icon: '🚙', share: 0.1, color: '#5aa9a0' },
    { id: 'ioniq', name: '現帶 Ionic', icon: '🚗', share: 0.09, color: '#9aa7ad' },
    { id: 'kia', name: '豈亞 EV6', icon: '🚗', share: 0.07, color: '#c0392b' },
    { id: 'bnw', name: 'BNW i4', icon: '🚘', share: 0.06, color: '#2c3e50' },
    { id: 'eq', name: '冰士 EQ', icon: '🚘', share: 0.05, color: '#bdc3c7' },
    { id: 'vw', name: '福思 ID.4', icon: '🚙', share: 0.05, color: '#e67e22' },
    { id: 'vol', name: '沃弗 EX30', icon: '🚙', share: 0.04, color: '#f1c40f' },
    { id: 'mg', name: '明爵 MG4', icon: '🚗', share: 0.02, color: '#8e44ad' },
    { id: 'tay', name: '保時傑 太刊', icon: '🏎️', share: 0.02, color: '#16a085' },
  ];

  // 充電站的數字（參考台灣行情）
  // 快充 DC 120kW：一次約充 30 度、一台一天最多約 20 台次；慢充 AC 7kW：一次約 18 度、一台一天最多約 4 台次
  // 契約容量基本電費：每 kW 每月約 $236 → 每週約 $55；快充站最大的固定成本就是這個
  Fun.CHARGE = {
    // 一次平均充的度數照下面的電池模擬：快充約 20%→80%（約 40 度、20～30 分鐘）、慢充約 35%→95%（約 35 度、5～6 小時）
    fast: { name: '⚡ 快充樁（120kW）', cost: 300000, kwh: 40, cap: 20, kw: 120, price: 11, elec: 4.2, upkeep: 800, max: 4, base: 19 },
    slow: { name: '🔌 慢充樁（7kW）', cost: 45000, kwh: 35, cap: 3, kw: 7, price: 8, elec: 2.2, upkeep: 100, park: 100, max: 8, base: 8 },
    basePerKw: 55,
    resale: 0.9, // 土地賣掉拿回九成；充電樁拆掉只剩三成
    gearResale: 0.3,
    // 充電站的設定：一次性的設備（once）或可以隨時開關的經營方式
    options: {
      lock: { icon: '🔒', name: '地鎖＋紅線', cost: 30000, once: true, desc: '汽油車停不進來（不會再有占位事件），充電格周轉 +5%' },
      cam: { icon: '📹', name: '監視器警報', cost: 10000, once: true, desc: '充電線不會再被偷；每週電費 $300' },
      idle: { icon: '⏱️', name: '超時佔位費', desc: '充飽不開走就收錢：快充周轉 +15%，但有些車主嫌麻煩（來車 -3%）' },
      nav: { icon: '🗺️', name: '上架電斯拉導航', desc: '每週 $3,000：車上導航會推薦你的站，來車 +15%' },
      combo: { icon: '🧾', name: '店內消費折充電費', home: true, desc: '在店裡消費，充電打九五折：走進店裡的車主多一半，充電收入少 5%' },
    },
  };

  // 充電站事件（每週大約四分之一的機率發生一件）；金額以月為單位寫，實際會砍半
  Fun.CHARGE_EVENTS = [
    {
      ok: (s, st) => st.fast + st.slow >= 1 && !st.flags.includes('lock'),
      make: (s, st) => ({
        id: 'ev_ice',
        icon: '⛽',
        title: '汽油車停在充電格不走',
        text: `${st.name}的充電格被一台汽油車停了一整個下午，好幾台電動車開進來又開走，有車主在群組裡抱怨。`,
        choices: [
          { label: '裝地鎖、劃紅線、貼告示（$30,000）', effects: { cash: -60000, evFlag: 'lock', evRep: 0.05 }, result: '地鎖一裝，汽油車就停不進去了。之後充電格都能好好用。', tip: '《電動車充電專用停車位及其充電設施設置管理辦法》規定非電動車不能占用充電車位，各地方政府可以開罰。' },
          { label: '打電話請警察來開單', effects: { evRep: 0.02 }, result: '警察來開了單，車主跑出來一直道歉。不過下週又有別台。' },
          { label: '算了，反正空著也是空著', effects: { evRep: -0.06 }, result: '充電地圖上多了幾則「常被汽油車占位」的評論。' },
        ],
        ignore: { effects: { evRep: -0.04 }, result: '那台車停到晚上才開走。' },
      }),
    },
    {
      ok: (s, st) => st.fast >= 1,
      make: (s, st) => ({
        id: 'ev_broken',
        icon: '🔧',
        title: '快充樁故障，螢幕一直顯示錯誤',
        text: `${st.name}有一支快充樁突然不能用了，車主打客服電話打到你這裡來。原廠說保固內可以免費修，但要排兩週。`,
        choices: [
          { label: '付錢叫廠商今天來修（$40,000）', effects: { cash: -80000, evFix: true }, result: '技師下午就到了，換了一片控制板，傍晚恢復充電。' },
          { label: '等保固免費修（停用 14 天）', effects: { evBroken: 14 }, result: '你貼了一張「維修中」的紙。那兩週快充少了一支。' },
        ],
        ignore: { effects: { evBroken: 14, evRep: -0.03 }, result: '沒人處理，車主在充電地圖上標了「故障」。' },
      }),
    },
    {
      ok: (s, st) => st.fast + st.slow >= 1 && !st.flags.includes('cam'),
      make: (s, st) => ({
        id: 'ev_cable',
        icon: '🪚',
        title: '充電線半夜被剪走了',
        text: `早上車主打來說${st.name}的充電線不見了，監視器拍到兩個人半夜拿著油壓剪。最近新聞也常報充電線被偷去賣銅。`,
        choices: [
          { label: '換新線，再加裝監視器警報（$50,000）', effects: { cash: -100000, evFlag: 'cam', evFix: true }, result: '新的線裝好了，監視器一有人靠近就會叫。之後沒再被偷。', tip: '充電線裡有大量銅，竊賊剪走賣廢五金。加裝監視器、照明和警報，或選用線材比較難剪斷的機型，都可以降低被偷的機率。' },
          { label: '只換新線（$20,000）', effects: { cash: -40000, evFix: true }, result: '線換好了。只是那兩個人知道這裡沒有警報……' },
        ],
        ignore: { effects: { evBroken: 7, evRep: -0.04 }, result: '充電樁停用了一週。' },
      }),
    },
    {
      ok: () => true,
      make: (s, st) => ({
        id: 'ev_rate',
        icon: '📈',
        title: '電價調漲，充電成本變高了',
        text: '台電公布新的電價方案，商業用電每度漲了大約一成。其他充電業者有的跟著漲價，有的先吸收。',
        choices: [
          { label: '跟著漲：快充每度 +$1、慢充 +$0.5', effects: { evElec: 0.1, evPrice: 1 }, result: '你調了價。有些車主改去別家，但每一度電還是有賺。' },
          { label: '先吸收，價格不動', effects: { evElec: 0.1, evRep: 0.04 }, result: '車主們很開心：「這家沒漲價！」不過每一度電賺得比較少了。' },
        ],
        ignore: { effects: { evElec: 0.1 }, result: '你的成本默默變高了。' },
      }),
    },
    {
      ok: (s, st) => !st.subsidy,
      make: (s, st) => ({
        id: 'ev_subsidy',
        icon: '🏛️',
        title: '政府補助充電樁，可以申請',
        text: '經濟部公告新一期的充電設施補助：既有的充電站可以申請，不過文件很多，要跑好幾趟。',
        choices: [
          { label: '老闆自己跑文件申請', effects: { evSubsidy: true, lifeStress: 4 }, result: `跑了三趟、補了兩次文件，補助終於下來了：每支快充 $60,000、慢充 $8,000。`, tip: '政府為了推動電動車，近年陸續有公有停車場、民間場站設置充電樁的補助計畫，條件和金額每期不同，要注意公告。' },
          { label: '太麻煩了，不申請', effects: {}, result: '你把公告收進抽屜。' },
        ],
        ignore: { effects: {}, result: '申請期限過了。' },
      }),
    },
    {
      ok: (s, st) => !st.flags.includes('nav'),
      make: (s, st) => ({
        id: 'ev_nav',
        icon: '🗺️',
        title: '「電斯拉」想把你的站放進車上導航',
        text: '電斯拉的業務打電話來：只要每月付一筆上架費，你的站就會出現在全台電斯拉車主的導航裡，還會顯示「目前有空位」。',
        choices: [
          { label: '上架（每週 $3,000）', effects: { evFlag: 'nav' }, result: '上架第二天，就開始有沒看過的車主照著導航開進來。' },
          { label: '不用了', effects: {}, result: '業務說：「隔壁區的站已經上架囉。」' },
        ],
        ignore: { effects: {}, result: '業務沒有再打來。' },
      }),
    },
    {
      ok: (s, st) => st.fast >= 1,
      make: (s, st) => ({
        id: 'ev_queue',
        icon: '😤',
        title: '兩個車主為了排隊吵起來',
        text: `${st.name}的快充排隊排到馬路上，一台玉龍 n7 說他先到，電斯拉車主說他有先在 App 上預約，兩個人在充電格前面吵起來了。`,
        choices: [
          { label: '訂規則：充到 80% 就要讓位，超時收佔位費', effects: { evFlag: 'idle', evRep: 0.04 }, result: '規則貼出來以後排隊快多了。偶爾有人被收佔位費不太高興，但大部分車主都說早該這樣。', tip: '很多充電業者會在充電完成後收「超時佔用費」，讓車位可以給下一台車。' },
          { label: '過去勸架，送兩杯飲料', effects: { cash: -400, evRep: 0.01 }, result: '兩人喝完飲料氣消了，還交換了 LINE。' },
          { label: '不管，讓他們自己吵', effects: { evRep: -0.05 }, result: '兩個人吵到有人報警。影片被上傳到社團。' },
        ],
        ignore: { effects: { evRep: -0.04 }, result: '吵了半小時才結束。' },
      }),
    },
  ];
})(typeof window !== 'undefined' ? window : globalThis);
