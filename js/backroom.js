// 後場：儲藏室、員工休息室、老闆辦公室、廁所
// 每個房間有三級，每一級都會改變實際的經營數字；還有各自的事件
(function (root) {
  const Fun = root.BossFun;
  if (!Fun) return;

  Fun.ROOMS = {
    storage: {
      icon: '🗄️',
      name: '儲藏室',
      lv: 2,
      intro: '沒有儲藏室，貨只能堆在店裡：最多放大約一天半的量，進太多會放不下退貨、隔夜報廢也多。',
      levels: [
        { name: '層架倉庫', cost: 25000, desc: '貨量上限 ×1.6、隔夜報廢 -15%', cap: 2.5, spoil: 0.85 },
        { name: '冷凍冷藏庫', cost: 60000, desc: '貨量上限 ×2.2、報廢 -35%；包裹、團購、年菜這類業務不會爆倉', cap: 3.5, spoil: 0.65 },
        { name: '智慧倉儲', cost: 140000, desc: '貨量上限 ×3、報廢 -50%；有監視器和自動盤點，不會再有東西不見', cap: 5, spoil: 0.5 },
      ],
    },
    rest: {
      icon: '☕',
      name: '員工休息室',
      lv: 3,
      intro: '沒有休息室，員工只能在店裡的休息桌或角落休息，客人看得到，休息效果也普通。',
      levels: [
        { name: '小休息室', cost: 18000, desc: '休息恢復 ×1.3、員工心情 +2', rest: 1.3, mood: 2 },
        { name: '沙發＋小冰箱', cost: 50000, desc: '休息恢復 ×1.6、心情 +3', rest: 1.6, mood: 3 },
        { name: '員工餐廳＋按摩椅', cost: 120000, desc: '休息恢復 ×2、心情 +5；口碑傳出去，來應徵的人素質比較好', rest: 2, mood: 5 },
      ],
    },
    office: {
      icon: '💼',
      name: '老闆辦公室',
      lv: 4,
      intro: '沒有辦公室，罵人、談薪水都在店裡，大家都聽得到。',
      levels: [
        { name: '辦公桌', cost: 30000, desc: '關起門來談：罵人不會影響其他人的心情、稱讚效果更好' },
        { name: '面試間', cost: 80000, desc: '面試時比較看得出應徵者的領導力' },
        { name: '保險箱＋監視器', cost: 180000, desc: '店裡的現金比較不會被偷；老闆在辦公室休息恢復比較快' },
      ],
    },
    toilet: {
      icon: '🚽',
      name: '廁所',
      lv: 2,
      intro: '沒有廁所，內用的客人想上廁所只能去別家，有些人會因此給低分。',
      levels: [
        { name: '蹲式廁所', cost: 35000, desc: '客人可以上廁所；要有人打掃，不然會很臭', dirt: 3, stars: 0 },
        { name: '坐式＋洗手台', cost: 70000, desc: '比較不容易髒、客人比較滿意', dirt: 2, stars: 0.1 },
        { name: '免治馬桶網美廁所', cost: 160000, desc: '客人會拍照打卡（貼文效果更好）；評價加分', dirt: 1.4, stars: 0.25 },
      ],
    },
  };

  // 這些產業開放「借廁所」時，每小時大概有幾個路人來借
  Fun.TOILET_BORROW = { store: 3, drinks: 1.6, breakfast: 0.8, noodle: 1, barber: 0.3, scooter: 1 };

  Fun.ROOM_EVENTS = {
    toilet: [
      (s, e) => ({
        id: 'rm_clog',
        icon: '🪠',
        title: '馬桶塞住了',
        text: `${e ? e.name : '店員'}一臉崩潰地跑出來：「老闆……廁所……水快滿出來了。」外面還有兩個客人在等廁所。`,
        choices: [
          { label: '老闆親自拿通樂和吸把', note: '慣老闆指數 -1', effects: { toiletFix: true, jerk: -1, morale: 4 }, result: '你捲起袖子奮戰十分鐘，終於「咕嚕」一聲通了。員工在門外鼓掌。' },
          { label: '叫水電師傅', note: '$1,500', effects: { cash: -3000, toiletFix: true }, result: '師傅從馬桶裡夾出一隻玩具恐龍：「誰丟的？」' },
          { label: `叫${e ? e.name : '員工'}自己想辦法`, effects: { toiletFix: true, ...(e ? { moodOf: [[e.id, -12]] } : {}), jerk: 1 }, result: `${e ? e.name : '員工'}通了半小時，出來時眼神死。` },
        ],
        ignore: { effects: { toiletDown: 1, review: [2, '廁所壞掉不能用'] }, result: '廁所門上貼了「故障」，今天都不能用。' },
      }),
      (s) => ({
        id: 'rm_smoke',
        icon: '🚬',
        title: '有人在廁所抽菸',
        text: '廁所飄出濃濃的菸味，下一個進去的客人咳著出來：「你們廁所有人抽菸！」',
        choices: [
          { label: '裝煙霧偵測器、貼禁菸標示', note: '$1,200', effects: { cash: -2400 }, result: '之後再也沒有人敢在裡面抽菸。', tip: '依《菸害防制法》，室內公共場所全面禁菸；業者沒有制止也可能被罰。' },
          { label: '敲門請他出來', effects: { review: [3, '有人在廁所抽菸，店家有處理'] }, result: '一個高中生低著頭走出來，連說對不起。' },
        ],
        ignore: { effects: { review: [2, '廁所都是菸味'] }, result: '菸味飄了一整個下午。' },
      }),
      (s) => ({
        id: 'rm_sleep',
        icon: '😴',
        title: '廁所裡有人睡著了',
        text: '廁所門鎖了快四十分鐘，敲門也沒人回應。外面排隊的客人開始擔心：「裡面的人還好嗎？」',
        choices: [
          { label: '拿備用鑰匙開門確認', effects: { followers: 30 }, result: '原來是一位熬夜加班的上班族坐著睡著了，他醒來尷尬到買了三杯咖啡。' },
          { label: '叫救護車以防萬一', note: '$0', effects: { review: [4, '店家很謹慎，雖然只是虛驚一場'] }, result: '救護人員到了，那個人剛好自己開門出來，大家都鬆了一口氣。' },
        ],
        ignore: { effects: { review: [2, '廁所被佔用快一小時'] }, result: '一小時後，那個人伸著懶腰走出來。' },
      }),
      (s) => ({
        id: 'rm_paper',
        icon: '🧻',
        title: '衛生紙一直被偷',
        text: '這週已經補了三次衛生紙，每次補完不到半天就整捲不見。監視器拍到同一個人，每次都包包鼓鼓地走出去。',
        choices: [
          { label: '換成大捲筒、上鎖的衛生紙架', note: '$800', effects: { cash: -1600 }, result: '那個人再來的時候，對著紙架研究了很久，最後放棄了。' },
          { label: '貼一張「衛生紙是給上廁所用的，不是給你帶回家的」', effects: { followers: 120, review: [4, '廁所的標語好好笑'] }, result: '標語被拍照上傳，很多人留言「笑死」。' },
        ],
        ignore: { effects: { cash: -800 }, result: '衛生紙繼續消失。' },
      }),
      (s) => ({
        id: 'rm_pipe',
        icon: '💦',
        title: '廁所水管爆了',
        text: '廁所的水管突然爆裂，水從門縫流出來，一路淹到店裡。客人踩著水一臉驚恐。',
        choices: [
          { label: '關總開關、叫師傅連夜修', note: '$6,000', effects: { cash: -12000, toiletDown: 1 }, result: '師傅修到半夜，隔天就恢復了。' },
          { label: '先用拖把擋著，明天再修', effects: { toiletDown: 3, review: [2, '店裡淹水了還照常營業'] }, result: '大家輪流拖地，拖到手痠。' },
        ],
        ignore: { effects: { toiletDown: 3, cash: -6000 }, result: '水一直流，最後還是得修，而且更貴。' },
      }),
      (s) => ({
        id: 'rm_poem',
        icon: '✍️',
        title: '廁所文學',
        text: '有人在廁所門板上寫了一首詩：「肚子痛的時候，你的店最近；離開的時候，我的心最輕。」底下還有人接龍了好幾句。',
        choices: [
          { label: '拍下來讓小編發文', effects: { followers: 400 }, result: '貼文被瘋傳，有人專程來看那首詩，還在旁邊接了新的一句。' },
          { label: '擦掉，貼上「請勿塗鴉」', effects: {}, result: '門板乾淨了，隔天又多了一句「詩人已死」。' },
        ],
        ignore: { effects: { review: [3, '廁所門板都是塗鴉'] }, result: '接龍越來越長。' },
      }),
      (s) => ({
        id: 'rm_rider',
        icon: '🛵',
        title: '外送員想借廁所',
        text: '一位外送員在門口猶豫：「老闆，不好意思，可以借個廁所嗎？我跑了六小時都沒地方上……」',
        choices: [
          { label: '「直接用，以後也歡迎」', effects: { followers: 80, flag: 'riderFriendly', review: [5, '外送員友善店家，給推'] }, result: '外送員群組傳開了：這家店可以借廁所。之後幫你送餐的人都特別小心。' },
          { label: '「要消費才能借」', effects: {}, result: '他買了一瓶水，默默去用了。' },
          { label: '「不好意思，不外借」', effects: { review: [2, '連外送員借個廁所都不行'] }, result: '他騎車去找下一家。' },
        ],
        ignore: { effects: {}, result: '他等不到回應，憋著騎走了。' },
      }),
    ],
    storage: [
      (s) => ({
        id: 'rm_rat',
        icon: '🐀',
        title: '倉庫有老鼠',
        text: '早上開倉庫，發現好幾包貨被咬破，角落還有黑黑的小顆粒。衛生稽查最近好像會來。',
        choices: [
          { label: '請除蟲公司、封好牆縫', note: '$4,000', effects: { cash: -8000 }, result: '除蟲公司說：「你們後面的巷子是老鼠高速公路。」封好之後再也沒出現過。' },
          { label: '放捕鼠籠、自己處理', effects: { cash: -1000, flag: 'ratRisk' }, result: '抓到兩隻，但總覺得還有。' },
        ],
        ignore: { effects: { flag: 'ratRisk' }, result: '老鼠繼續在倉庫開派對。' },
      }),
      (s, e) => ({
        id: 'rm_count',
        icon: '📋',
        title: '盤點對不上',
        text: `月底盤點，倉庫的貨少了大約 $5,000，而且是固定幾樣東西在少。${e ? `有人說最近看到${e.name}下班時背包特別重。` : ''}`,
        choices: [
          { label: '裝監視器，先不指控任何人', note: '$3,000', effects: { cash: -6000 }, result: '裝了監視器之後，貨再也沒有少過，你決定不追究。' },
          ...(e ? [{ label: `直接找${e.name}問清楚`, effects: { moodOf: [[e.id, -15]], jerk: 1 }, result: `${e.name}很生氣：「你懷疑我？」後來發現是送貨的少送了。你跟${e.name}道了歉。` }] : []),
          { label: '算了，當作耗損', effects: { cash: -5000 }, result: '下個月又少了一樣多。' },
        ],
        ignore: { effects: { cash: -5000 }, result: '貨繼續不見。' },
      }),
      (s) => ({
        id: 'rm_expire',
        icon: '📅',
        title: '倉庫深處挖出過期品',
        text: '整理倉庫時，在最裡面找到一箱過期兩個月的貨。有員工小聲說：「之前好像有拿這箱出去用……」',
        choices: [
          { label: '全部丟掉，改成「先進先出」貼標籤', effects: { cash: -2000 }, result: '從此每一箱都貼上日期，最舊的放最前面。' },
          { label: '「應該還能吃吧？」', effects: { jerk: 2, flag: 'expiredRisk' }, result: '你把那箱放回去。員工交換了一個眼神。', tip: '販售或使用逾期食品違反《食品安全衛生管理法》，最高可罰新台幣 300 萬元。' },
        ],
        ignore: { effects: { flag: 'expiredRisk' }, result: '那箱過期品還在倉庫裡。' },
      }),
    ],
    rest: [
      (s, e) => ({
        id: 'rm_nap',
        icon: '💤',
        title: `${e ? e.name : '員工'}在休息室睡過頭`,
        text: `休息時間結束十五分鐘了，${e ? e.name : '員工'}還在休息室的沙發上睡得很熟。外面開始排隊了。`,
        choices: [
          { label: '輕輕叫醒，順便問他是不是太累', effects: e ? { moodOf: [[e.id, 6]] } : {}, result: `${e ? e.name : '他'}揉著眼睛說：「昨天兼差到半夜……」你幫他調了一下班。` },
          { label: '「休息時間是有限的！」', effects: { ...(e ? { moodOf: [[e.id, -8]] } : {}), jerk: 1 }, result: `${e ? e.name : '他'}跳起來衝回櫃台。` },
        ],
        ignore: { effects: {}, result: '他睡飽了自己出來。' },
      }),
      (s) => ({
        id: 'rm_lunch',
        icon: '🍱',
        title: '休息室的冰箱戰爭',
        text: '有人的便當被吃掉了，冰箱門上貼了一張紙條：「是誰吃了我的雞腿便當？我會記住你。」底下有人回：「它在呼喚我。」',
        choices: [
          { label: '請大家吃一次披薩，順便訂冰箱規則', note: '$1,500', effects: { cash: -3000, morale: 5 }, result: '大家一邊吃披薩一邊笑，冰箱貼上了「名字貼紙」。' },
          { label: '不介入', effects: { morale: -2 }, result: '紙條戰爭持續了一週。' },
        ],
        ignore: { effects: { morale: -2 }, result: '冰箱門上的紙條越來越多。' },
      }),
    ],
    office: [
      (s, e) => ({
        id: 'rm_talk',
        icon: '🚪',
        title: `${e ? e.name : '員工'}敲了辦公室的門`,
        text: `${e ? e.name : '一位員工'}站在辦公室門口：「老闆，可以佔用你五分鐘嗎？我想聊聊我的未來。」`,
        choices: [
          { label: '請他坐下，好好聽他說', effects: { ...(e ? { moodOf: [[e.id, 10]], lead: [e.id, 3] } : {}) }, result: `你們聊了半小時。${e ? e.name : '他'}說，這是第一次有老闆願意聽他講這些。` },
          { label: '「我很忙，有事寫 LINE」', effects: e ? { moodOf: [[e.id, -8]] } : {}, result: '門關上了。' },
        ],
        ignore: { effects: e ? { moodOf: [[e.id, -5]] } : {}, result: '他在門口站了一下就走了。' },
      }),
      (s) => ({
        id: 'rm_theft',
        icon: '🕵️',
        title: '收銀機的錢少了',
        text: '晚上結帳，收銀機少了 $3,000。前後只有三個人碰過收銀機。',
        choices: [
          { label: s.rooms && s.rooms.office >= 3 ? '調監視器畫面' : '裝監視器（$5,000）', effects: s.rooms && s.rooms.office >= 3 ? {} : { cash: -10000 }, result: s.rooms && s.rooms.office >= 3 ? '畫面顯示是找錯錢給客人，客人隔天還拿回來了。' : '監視器裝好了，之後再也沒有少過錢。' },
          { label: '三個人一起扣薪水', effects: { morale: -8, jerk: 4 }, result: '大家很不服氣，有人說要去勞工局問問看。', tip: '雇主不能未經同意直接從薪水扣除短少的款項；責任不明時集體扣薪更容易引起勞資爭議。' },
        ],
        ignore: { effects: { cash: -3000 }, result: '錢就這樣不見了。' },
      }),
    ],
  };
})(typeof window !== 'undefined' ? window : globalThis);
