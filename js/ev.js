// 🚘 電動車：老闆可以買的車（虛構品牌「電斯拉」全車系＋國產代步車），以及充電站業務
// 品牌、車名都是虛構的諧音，數字參考台灣實際行情（車價、電價、充電費率、契約容量基本電費）
(function (root) {
  const Fun = root.BossFun;
  if (!Fun) return;

  // 老闆的車：用老闆個人的錢買；一次只開一台，換車時舊車打五五折賣掉
  // ride：出門路程倍率；stress：每天壓力減少；weekly：每週油錢／電費＋保險保養
  // ev：電動車（自己有充電站的話，充電幾乎不用錢）；fans：買的時候粉絲增加（老闆開好車會被拍）
  Fun.CARS = {
    gas: { icon: '🚗', brand: '國產', name: '汽油代步車', cost: 650000, ride: 0.75, stress: 1, weekly: 2000, desc: '最實在的選擇：出門快、好停車；油錢比較貴' },
    m3: { icon: '🚙', brand: '電斯拉', name: 'Modal 3', cost: 1600000, ride: 0.75, stress: 1.5, weekly: 900, ev: true, desc: '入門電動轎車：充電比加油便宜很多，輔助駕駛讓通勤比較不累' },
    my: { icon: '🚙', brand: '電斯拉', name: 'Modal Y', cost: 1850000, ride: 0.75, stress: 1.5, weekly: 1000, ev: true, haul: 0.03, family: true, desc: '電動休旅車：後車廂超大，去批發市場進貨多打 3% 折、不會扛到腰痛；有小孩的話親子感情慢慢變好' },
    ms: { icon: '🏎️', brand: '電斯拉', name: 'Modal S', cost: 3600000, ride: 0.7, stress: 2, weekly: 1600, ev: true, fans: 300, show: true, desc: '旗艦轎車：又快又安靜；開出去會被拍，不過員工薪水太低的話他們會很有意見' },
    mx: { icon: '🚐', brand: '電斯拉', name: 'Modal X', cost: 4100000, ride: 0.7, stress: 2, weekly: 1800, ev: true, fans: 800, show: true, family: true, desc: '鷹翼門休旅：門一打開大家都在拍，粉絲大增；有小孩的話親子感情慢慢變好；員工薪水太低的話他們會很有意見' },
    ct: { icon: '🛻', brand: '電斯拉', name: '賽伯鐵牛', cost: 5200000, ride: 0.85, stress: 1, weekly: 2600, ev: true, fans: 1500, haul: 0.05, show: true, desc: '不鏽鋼電動皮卡：台灣沒有正式賣，要自己進口驗車；車太大巷子難鑽、出門慢一點，但載貨超強（進貨多打 5% 折），粉絲暴增' },
    rd: { icon: '🏁', brand: '電斯拉', name: '路霸跑車', cost: 7000000, ride: 0.6, stress: 3, weekly: 3000, ev: true, fans: 1200, show: true, ticket: 0.15, desc: '電動超跑：出門最快、開起來最紓壓；但很容易超速被開罰單' },
    cab: { icon: '🚖', brand: '電斯拉', name: '無人計程艙', cost: 1200000, ride: 0.85, stress: 1, weekly: 700, ev: true, robotaxi: true, desc: '沒有方向盤的雙人座：你不用的時候它會自己去載客賺錢（每週約 $4,000～8,000，平台抽兩成）；偶爾在路口卡住被拍上網' },
  };
  // 公司用的車：電動聯結車（有 2 間以上分店才用得到）
  Fun.SEMI = { icon: '🚛', brand: '電斯拉', name: '電動聯結車', cost: 2400000, weekly: 4000, materials: 0.03, desc: '公司自己的物流車：各店進貨成本 -3%；每週電費、司機、保養 $4,000（公司付）' };

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
    fast: { name: '⚡ 快充樁（120kW）', cost: 300000, kwh: 30, cap: 20, kw: 120, price: 11, elec: 4.2, upkeep: 800, max: 4 },
    slow: { name: '🔌 慢充樁（7kW）', cost: 45000, kwh: 18, cap: 4, kw: 7, price: 8, elec: 2.2, upkeep: 100, park: 60, max: 8 },
    basePerKw: 55,
    resale: 0.9, // 土地賣掉拿回九成；充電樁拆掉只剩三成
    gearResale: 0.3,
  };

  // 充電站事件（每週大約四分之一的機率發生一件）；金額以月為單位寫，實際會砍半
  Fun.CHARGE_EVENTS = [
    {
      ok: (s, st) => st.fast + st.slow >= 1,
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
      ok: (s, st) => st.fast + st.slow >= 1,
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
