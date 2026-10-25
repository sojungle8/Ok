// 人生篇章：老闆自己的人生。公司的錢和老闆的錢分開，分紅領出來要花在哪裡、有沒有時間陪家人、身體撐不撐得住
// 壓力：處理太多事、全年無休、虧錢會累積；度假、運動、家庭會讓它降下來；壓力太大會生病
(function (root) {
  const Fun = root.BossFun;
  if (!Fun) return;

  const money = (n) => `$${Math.round(n).toLocaleString()}`;

  // 老闆個人可以花錢的地方：每一項都會改變遊戲裡的數字
  Fun.LIFE_SPEND = {
    gym: { icon: '🏋️', name: '健身房年費', cost: 30000, once: 'gym', desc: '每天壓力 -1、健康慢慢變好；老闆下場體力比較好', ok: (s) => !s.owner.gym },
    house: { icon: '🏠', name: '買房子（頭期款）', cost: 2600000, once: 'house', desc: '每天壓力 -2、可以成家；之後每週房貸 $9,000（從老闆的錢扣，不夠就要動用公司的錢）', ok: (s) => !s.owner.house },
    trip: { icon: '✈️', name: '出國度假一週', cost: 90000, desc: '老闆離開 5 天：壓力歸零、健康 +10；店交給員工（授權制度、店長很重要）', ok: (s) => !s.boss.away },
    parents: { icon: '👴', name: '帶爸媽出國', cost: 160000, desc: '老闆離開 5 天、壓力 -50；爸媽很開心（之後家裡的事比較順）', ok: (s) => !s.boss.away && s.owner.parents !== 'gone' },
    filial: { icon: '🧧', name: '每月孝親費', cost: 10000, once: 'filial', monthly: true, desc: '每月 $10,000；爸媽生病的時候你比較不會內疚（壓力增加少一半）', ok: (s) => !s.owner.filial },
    donate: { icon: '🎗️', name: '捐款給在地社福團體', cost: 100000, desc: '粉絲 +300、慣老闆指數 -3、評價小加分；可以重複捐', ok: () => true },
    emba: { icon: '🎓', name: '去念 EMBA', cost: 500000, once: 'emba', desc: '進貨成本 -4%（認識很多老闆）、分店店長的領導力 +5；每週有兩天晚上要上課', ok: (s) => !s.owner.emba && s.level >= 8 },
  };

  // 人生事件：每週有機會發生一件，條件看老闆現在的人生狀態
  Fun.LIFE_EVENTS = [
    {
      ok: (s) => !s.owner.partner && s.owner.age <= 45,
      make: (s) => ({
        id: 'life_blind',
        icon: '💐',
        title: '媽媽幫你安排了相親',
        text: `媽媽打電話來：「你都 ${s.owner.age} 歲了，整天顧店，鄰居的女兒（兒子）也是自己開店的，週末見個面吧！」那天剛好是店裡最忙的時候。`,
        choices: [
          { label: '去！店交給員工一天', effects: { lifePartner: 'dating', lifeStress: -8 }, result: '對方是開花店的，你們聊開店的辛酸聊到忘記時間。之後常常約出來。' },
          { label: '「媽，我真的很忙」', effects: { lifeStress: 4 }, result: '媽媽嘆了一口氣：「錢賺那麼多要給誰花？」' },
        ],
        ignore: { effects: { lifeStress: 3 }, result: '媽媽又打了三通電話。' },
      }),
    },
    {
      ok: (s) => s.owner.partner === 'dating' && s.day - (s.owner.partnerDay || 0) >= 42,
      make: (s) => ({
        id: 'life_wedding',
        icon: '💍',
        title: '要不要結婚？',
        text: '你們交往一段時間了，對方問你：「我們是不是該定下來了？可是你每天都在店裡，我常常覺得自己在跟一間店交往。」',
        choices: [
          { label: '求婚！辦一場溫馨的婚禮', note: '老闆的錢 $300,000', effects: { lifeWealth: -300000, lifePartner: 'married', lifeStress: -15, morale: 5 }, result: '婚禮那天全店員工都來了，店長還上台致詞。大家都說老闆難得笑這麼開心。' },
          { label: '公證就好，錢留著顧店', effects: { lifePartner: 'married', lifeStress: -8 }, result: '你們去戶政事務所登記，晚上在店裡吃了一頓。簡單，但很幸福。' },
          { label: '「等店再穩一點吧」', effects: { lifeStress: 6, lifePartnerRisk: true }, result: '對方沒說話。那天晚上的氣氛很安靜。' },
        ],
        ignore: { effects: { lifeStress: 5, lifePartnerRisk: true }, result: '你一直沒給答案。' },
      }),
    },
    {
      ok: (s) => s.owner.partner === 'married' && s.owner.kids < 2 && s.day - (s.owner.partnerDay || 0) >= 56 && s.owner.house,
      make: (s) => ({
        id: 'life_baby',
        icon: '👶',
        title: '你要當爸媽了！',
        text: '另一半拿著驗孕棒，手在發抖：「我們……要有寶寶了。」你腦中閃過的第一個念頭是：店怎麼辦？第二個念頭是：太好了。',
        choices: [
          { label: '請陪產假、之後每天準時回家吃晚餐', effects: { lifeKid: true, lifeStress: -10, lifeFamilyTime: true }, result: '寶寶出生那天，員工們在店裡貼了「恭喜老闆」的海報。從此你每天六點就離開店裡。' },
          { label: '請保母，店照顧好最重要', note: '每週 $8,000', effects: { lifeKid: true, lifeNanny: true }, result: '寶寶很健康。只是你回家的時候，他常常已經睡了。' },
        ],
        ignore: { effects: { lifeKid: true, lifeNanny: true }, result: '日子還是一樣忙。' },
      }),
    },
    {
      ok: (s) => s.owner.kids > 0,
      make: (s) => ({
        id: 'life_kidshow',
        icon: '🎭',
        title: '孩子的學校表演',
        text: '孩子興奮地說：「我週五要演一棵樹！你會來看嗎？」週五下午剛好是進貨和衛生稽查的日子。',
        choices: [
          { label: '一定去，店交給店長', effects: { lifeStress: -10, lifeFamily: 10 }, result: '你坐在第一排，那棵樹演得非常認真。孩子下台後衝過來抱你。' },
          { label: '「爸爸（媽媽）要工作，下次」', effects: { lifeStress: 6, lifeFamily: -15 }, result: '晚上回家，孩子已經睡了，桌上有一張畫：一棵樹，旁邊有一個空位子。' },
        ],
        ignore: { effects: { lifeFamily: -10 }, result: '你忘記了。' },
      }),
    },
    {
      ok: (s) => s.owner.parents === 'ok' && s.week >= 8,
      make: (s) => ({
        id: 'life_parentsick',
        icon: '🏥',
        title: '爸爸住院了',
        text: '媽媽在電話裡哭：「你爸早上在市場昏倒，現在在急診。醫生說要開刀，可能要住院兩週。」',
        choices: [
          { label: '馬上趕去，請三天假陪在醫院', note: '老闆的錢 $80,000 醫藥費', effects: { lifeWealth: -80000, lifeAway: 3, lifeStress: s.owner.filial ? 5 : 10, lifeParents: 'recovering' }, result: '手術很順利。爸爸醒來第一句話是：「店裡的生意還好嗎？」' },
          { label: '請看護，店裡實在走不開', note: '老闆的錢 $120,000', effects: { lifeWealth: -120000, lifeStress: s.owner.filial ? 10 : 20, lifeParents: 'recovering', lifeFamily: -10 }, result: '看護很專業。但每次打電話，媽媽都說爸爸一直在問你什麼時候來。' },
        ],
        ignore: { effects: { lifeStress: 25, lifeFamily: -20, lifeParents: 'recovering' }, result: '你在店裡一整天心神不寧。' },
      }),
    },
    {
      ok: (s) => s.week >= 6,
      make: (s) => ({
        id: 'life_reunion',
        icon: '🍻',
        title: '高中同學會',
        text: `同學會上，當年的班長在科技業當主管、配了公司股票；有人說：「聽說你開了一間${s.ind.name}？${s.branches.length ? '還開了分店？好厲害！' : '很辛苦吧？'}」${s.owner.wealth < 500000 ? '大家開始聊買房、換車，你默默喝了一口啤酒。' : ''}`,
        choices: [
          { label: '大方分享創業的甘苦', effects: { lifeStress: -6, followers: 60 }, result: '好幾個同學說要來店裡捧場，還有人問你們缺不缺人。' },
          { label: '請全桌喝酒，撐場面', note: '老闆的錢 $20,000', effects: { lifeWealth: -20000, lifeStress: -2 }, result: '大家都說你很海派。回家的路上看著錢包，心有點痛。' },
          { label: '找藉口提早離開', effects: { lifeStress: 4 }, result: '你回到店裡，鐵捲門已經拉下來了。' },
        ],
        ignore: { effects: {}, result: '你沒去。' },
      }),
    },
    {
      ok: (s) => s.owner.wealth > 200000,
      make: (s) => ({
        id: 'life_loan',
        icon: '🤝',
        title: '老朋友來借錢',
        text: '十幾年的老朋友約你喝咖啡，開口就說：「我投資失利，可以先借我二十萬嗎？三個月一定還。」',
        choices: [
          { label: '借他', note: '老闆的錢 $200,000', effects: { lifeWealth: -200000, lifeLoan: 200000 }, result: '朋友握著你的手一直說謝謝。' },
          { label: '借五萬，說這是能力範圍', note: '老闆的錢 $50,000', effects: { lifeWealth: -50000, lifeLoan: 50000 }, result: '朋友有點失望，但還是收下了。' },
          { label: '婉拒', effects: { lifeStress: 3 }, result: '朋友說沒關係，但之後就很少聯絡了。' },
        ],
        ignore: { effects: {}, result: '你已讀不回。' },
      }),
    },
    {
      ok: (s) => s.owner.wealth > 300000,
      make: (s) => ({
        id: 'life_scam',
        icon: '📈',
        title: '「穩賺不賠」的投資群組',
        text: '你被拉進一個 LINE 群組，「老師」每天分享飆股，群組裡每個人都在曬獲利截圖。老師說：「現在加碼一百萬，三個月翻倍。」',
        choices: [
          { label: '退出群組、檢舉', effects: { lifeStress: -2 }, result: '一週後新聞報導這個群組是詐騙集團，有人被騙了上千萬。', tip: '「保證獲利」「老師帶單」「投資群組」是常見的投資詐騙手法；遇到可以撥打 165 反詐騙專線查證。' },
          { label: '先投十萬試試看', note: '老闆的錢 $100,000', effects: { lifeWealth: -100000, lifeStress: 12 }, result: '帳面上一週就賺了 30%。你想提領的時候，「老師」說要先繳保證金。後來群組就消失了。' },
        ],
        ignore: { effects: {}, result: '群組訊息累積到 999+。' },
      }),
    },
    {
      ok: (s) => s.owner.health < 60,
      make: (s) => ({
        id: 'life_checkup',
        icon: '🩺',
        title: '健康檢查一堆紅字',
        text: `健檢報告出來了：血壓偏高、肝指數異常、睡眠不足。醫生推推眼鏡：「你是開${s.ind.name}的吧？我看過很多老闆，都是店越開越大、身體越來越差。」`,
        choices: [
          { label: '答應醫生：每週休一天、開始運動', effects: { lifeHealth: 15, lifeStress: -10, lifeRestDay: true }, result: '你在店門口貼上「每週公休一天」。一開始很不習慣，後來發現天也沒塌下來。' },
          { label: '「等忙完這陣子再說」', effects: { lifeHealth: -5, lifeStress: 4 }, result: '醫生搖搖頭，開了一包藥給你。' },
        ],
        ignore: { effects: { lifeHealth: -5 }, result: '報告被塞在抽屜裡。' },
      }),
    },
    {
      ok: (s) => !s.owner.house && s.week >= 10,
      make: (s) => ({
        id: 'life_landlord',
        icon: '🏚️',
        title: '房東要收回你住的地方',
        text: '你租了好幾年的套房，房東突然說要賣掉，給你兩個月搬家。附近的房租又漲了一成五。',
        choices: [
          { label: '咬牙在附近買房', note: `老闆的錢 ${money(Fun.LIFE_SPEND.house.cost)}`, effects: { lifeBuy: 'house' }, result: '你簽下了人生第一份房貸合約，手有點抖。' },
          { label: '找一間比較遠、比較便宜的', effects: { lifeStress: 8 }, result: '通勤多了半小時，每天回到家都快十二點了。' },
          { label: '乾脆睡在店裡的辦公室', effects: { lifeStress: 15, lifeHealth: -8 }, result: s.roomLv && s.roomLv('office') ? '辦公室的沙發成了你的床。員工早上來開門，常常看到你在刷牙。' : '你在店裡的角落鋪了一張行軍床。員工早上來開門，常常看到你在刷牙。' },
        ],
        ignore: { effects: { lifeStress: 10 }, result: '搬家的事一直拖著。' },
      }),
    },
    {
      ok: (s) => s.owner.loan > 0 && s.rng() < 0.5,
      make: (s) => ({
        id: 'life_repay',
        icon: '💌',
        title: '朋友還錢了',
        text: s.rng() < 0.6 ? `之前借錢的朋友傳來訊息：「錢匯給你了，還多包了一點利息。謝謝你在我最難的時候幫我。」` : '之前借錢的朋友傳訊息：「抱歉，最近真的沒辦法……可以再等等嗎？」',
        choices: [
          { label: '好的', effects: { lifeRepay: true }, result: '你看著手機，想起當年一起熬夜的日子。' },
        ],
        ignore: { effects: { lifeRepay: true }, result: '你看了訊息。' },
      }),
    },
    {
      ok: (s) => s.owner.stress >= 70,
      make: (s) => ({
        id: 'life_snap',
        icon: '🌋',
        title: '你快撐不住了',
        text: '早上起床，你盯著天花板，完全不想去店裡。手機裡有 47 則未讀訊息，有員工請假、有廠商催款、有客人在罵。你發現自己已經三個月沒有好好睡一覺。',
        choices: [
          { label: '請一週假，把店交給大家', effects: { lifeAway: 5, lifeStress: -60, lifeHealth: 8 }, result: '你關掉手機，去山上住了幾天。回來的時候，店還在，大家都還在。' },
          { label: '找心理師聊聊', note: '老闆的錢 $12,000', effects: { lifeWealth: -12000, lifeStress: -30 }, result: '心理師說：「你不是店，店也不是你。」你想了很久。' },
          { label: '「老闆沒有資格累」', effects: { lifeStress: 10, lifeHealth: -10, jerk: 2 }, result: '那天你對員工發了脾氣。下班後一個人坐在店裡，很久很久。' },
        ],
        ignore: { effects: { lifeStress: 8, lifeHealth: -8 }, result: '你還是去開了店，但整天都很煩躁。' },
      }),
    },
  ];

  // 人生里程碑（人生篇章的任務）
  Fun.LIFE_MILESTONES = [
    { id: 'firstpot', icon: '💰', name: '第一桶金', desc: '老闆個人財富達到 $1,000,000', check: (s) => s.owner.wealth >= 1000000 },
    { id: 'family', icon: '💍', name: '成家', desc: '結婚', check: (s) => s.owner.partner === 'married' },
    { id: 'home', icon: '🏠', name: '有自己的家', desc: '買了房子', check: (s) => !!s.owner.house },
    { id: 'parents', icon: '👴', name: '帶爸媽出國', desc: '帶爸媽出國玩一次', check: (s) => (s.owner.parentTrips || 0) >= 1 },
    { id: 'rested', icon: '🌴', name: '不被店綁架', desc: '出國度假 3 次', check: (s) => (s.owner.trips || 0) >= 3 },
    { id: 'healthy', icon: '💪', name: '健康的老闆', desc: '健康維持在 80 以上，連續 8 週', check: (s) => (s.owner.healthyWeeks || 0) >= 8 },
    { id: 'giver', icon: '🎗️', name: '回饋社會', desc: '累計捐款 $500,000', check: (s) => (s.owner.donated || 0) >= 500000 },
    { id: 'parent', icon: '👶', name: '當爸媽了', desc: '有了孩子', check: (s) => s.owner.kids > 0 },
  ];

  // 人生評語：結局時，除了店經營得怎樣，也看老闆自己過得怎樣
  Fun.lifeVerdict = (s) => {
    const o = s.owner;
    let score = 0;
    const notes = [];
    if (o.partner === 'married') (score += 2), notes.push('有人陪你走這段路');
    if (o.kids) score += 1;
    // 有另一半或孩子，才看你陪家人的時間
    if (o.partner || o.kids) {
      if ((o.familyBond ?? 60) >= 60) (score += 1), notes.push('家人覺得你有在');
      else if ((o.familyBond ?? 60) < 35) (score -= 2), notes.push('家人很少見到你');
    }
    if (o.health >= 70) score += 2;
    else if (o.health < 45) (score -= 2), notes.push('身體被店拖垮了');
    if (o.stress <= 45) score += 1;
    else if (o.stress >= 75) (score -= 1), notes.push('每天都很焦慮');
    if (o.house) score += 1;
    if ((o.trips || 0) >= 2) (score += 1), notes.push('有好好休息');
    if ((o.donated || 0) > 0) score += 1;
    const title = score >= 7 ? '🌈 事業和人生都有顧到' : score >= 4 ? '🙂 日子過得還不錯' : score >= 1 ? '😮‍💨 店撐起來了，人生還在追趕' : '🥀 店很成功，但你好像把自己弄丟了';
    return { score, title, notes };
  };
})(typeof window !== 'undefined' ? window : globalThis);
