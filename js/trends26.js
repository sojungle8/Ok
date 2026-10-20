// 時事梗（2025～2026 年的台灣）：小編可以蹭的時事、客人的留言、會發生在店裡的事
// 品牌、平台、人物一律虛構或只描述現象
(function (root) {
  const Fun = root.BossFun;
  const Data = root.BossData;
  if (!Fun || !Data) return;
  const FOOD = ['breakfast', 'noodle', 'drinks', 'store'];

  // 小編可以蹭的時事
  Fun.TRENDS.push(
    { id: 'dubaiq', icon: '🍫', name: '杜拜Ｑ餅爆紅', desc: '開心果巧克力包在麻糬裡，排隊三小時，還有人代排轉賣。' },
    { id: 'minwage', icon: '💵', name: '基本工資要破三萬了', desc: '明年基本月薪首次站上三萬、時薪 205 元，老闆們開始算數學。', months: [9, 10, 11, 12, 1] },
    { id: 'onestar', icon: '⭐', name: '一星俠出沒', desc: '有人一小時內對上百家店留一星，被網友封為「一星俠」。' },
    { id: 'cash10k', icon: '💰', name: '普發一萬', desc: '政府發現金，全台都在討論一萬塊要怎麼花。' },
    { id: 'deliverylaw', icon: '🛵', name: '外送新制上路', desc: '外送員每單基本報酬提高，平台說成本會轉嫁，店家很緊張。' },
    { id: 'gdp', icon: '📈', name: '經濟成長 11%', desc: '新聞說經濟成長創近 40 年新高，網友：「成長到哪裡去了？」' }
  );

  Fun.POST_BODIES.push(
    { id: 'dq1', trend: 'dubaiq', ind: FOOD, text: '杜拜Ｑ餅要排三小時，我們的 {item} 只要排三分鐘，而且不用開心果也很開心。', score: 8 },
    { id: 'dq2', trend: 'dubaiq', text: '不跟風、不排隊、不轉賣，本店唯一的爆款是「老闆今天心情很好」。', score: 6 },
    { id: 'mw1', trend: 'minwage', text: '基本工資要調了，我們的員工時薪本來就比規定高，因為他們值得。（老闆邊打字邊按計算機）', score: 8 },
    { id: 'os1', trend: 'onestar', text: '聽說一星俠到處留一星，我們已經準備好了：五星的服務，給一星的你也一樣。', score: 8 },
    { id: 'ck1', trend: 'cash10k', text: '普發一萬怎麼花？拿來買 {item}，可以快樂很多很多次，算一下，很划算對吧。', score: 7 },
    { id: 'dl1', trend: 'deliverylaw', ind: FOOD, text: '外送新制上路了，外送員辛苦了！自己走過來的客人，我們加碼送你一個微笑（和一張集點卡）。', score: 7 },
    { id: 'gd1', trend: 'gdp', text: '經濟成長 11%，本店營收成長 1.1%，差在哪裡？差在一個零。歡迎大家來幫我們補那個零。', score: 8 }
  );

  // 客人的留言（流行語）
  Fun.FUNNY_REVIEWS.good.push('尖峰時段店員從從容容、游刃有餘，好穩', '{w:good}，建議老闆手臂加強，可以做更快', '來都來了，就點個大份的，沒後悔', '普發的一萬花在這裡，值得');
  Fun.FUNNY_REVIEWS.bad.push('說好的去冰微糖，點餐機聽成「去兵危堂」', '等的時候我把基本工資調幅都算完了', '排隊排到我以為在排杜拜Ｑ餅');

  // 會發生在店裡的時事事件（跟其他事件一起抽）
  const T = [
    {
      id: 't_minwage',
      icon: '💵',
      title: '明年基本工資要漲到 205 元',
      text: '新聞說明年基本時薪要調到 205 元、月薪破三萬。員工休息時在討論：「那我們會跟著調嗎？」大家都在偷偷看你。',
      months: [10, 11, 12],
      where: 'staff',
      choices: [
        { label: '全店一起調，而且比法定多一點', note: '薪資 +4%', effects: { wageMult: 0.04, morale: 6, jerk: -2 }, result: '休息室爆出歡呼，有人說要把這個月的薪資單裱框。', tip: '基本工資是最低標準；調整後，原本領基本工資的員工必須跟著調，否則違法。' },
        { label: '只調到法定的數字', effects: { wageMult: 0.015, morale: 1 }, result: '大家點點頭：「合法啦，也是不錯。」' },
        { label: '調薪，同時菜單漲 5%', effects: { wageMult: 0.03, price: 0.05, morale: 3, review: [3, '漲價了，但聽說是幫員工加薪，可以接受'] }, result: '你在門口貼了一張「為了讓員工過得更好，我們調整了價格」。' },
      ],
    },
    {
      id: 't_egg',
      icon: '🥚',
      title: '蛋價創近兩年新高',
      text: '天氣太熱，母雞都不太下蛋了。蛋商說這週每盤要再漲，而且還不一定有貨。客人問：「蛋餅還有蛋嗎？」',
      industries: ['breakfast', 'noodle', 'store'],
      months: [1, 7, 8, 9],
      where: 'phone',
      choices: [
        { label: '「加蛋」多收 $5，門口貼說明', effects: { price: 0.02, review: [4, '蛋漲價有說明，很誠實'] }, result: '大部分客人都能理解，還有人說「辛苦了」。' },
        { label: '自己吸收，價格不動', effects: { cash: -8000, followers: 120 }, result: '這週少賺了一點，但「蛋價漲、這家沒漲」的貼文被分享了。' },
        { label: '推出「無蛋套餐」打折', effects: { demand: { mult: 1.04, months: 2 }, review: [3, '蛋餅沒有蛋，只剩餅的靈魂'] }, result: '有人覺得很有創意，有人覺得在搞笑。' },
      ],
    },
    {
      id: 't_delivery',
      icon: '🛵',
      title: '外送新制上路，平台要調抽成',
      text: '外送平台寄信來：「配合新制，外送員每單基本報酬提高，本平台將調整合作店家的服務費。」信的最後一句是「感謝您的支持」。',
      industries: FOOD,
      cond: () => true,
      where: 'phone',
      choices: [
        { label: '接受新費率，外送菜單小漲', effects: { price: 0.02, review: [3, '外送價變貴了'] }, result: '外送單量少了一點，但每單不至於虧錢。' },
        { label: '主打「自取優惠」把客人拉回店裡', effects: { followers: 200, demand: { mult: 1.03, months: 2 } }, result: '「自己走過來打九五折」的貼文意外受歡迎，騎樓多了好多人。' },
        { label: '退出外送平台', effects: { deliveryOff: true, morale: 2 }, result: '店裡安靜了一點，員工說：「終於不用一直盯著平板了。」' },
      ],
    },
    {
      id: 't_cash10k',
      icon: '💰',
      title: '普發一萬，消費潮來了',
      text: '政府發的一萬塊入帳了，客人點東西特別豪邁：「今天加蛋加起司，政府請客！」商圈都在推「萬元專案」。',
      where: 'phone',
      choices: [
        { label: '推出「一萬元集點卡」活動', note: '$3,000 印卡', effects: { cash: -6000, demand: { mult: 1.12, months: 3 }, followers: 300 }, result: '集點卡發得超快，有客人說要把一萬塊全部集在這裡。' },
        { label: '照常營業就好', effects: { demand: { mult: 1.06, months: 2 } }, result: '人潮自己來了，收銀機響個不停。' },
      ],
    },
    {
      id: 't_typhoonsun',
      icon: '🌤️',
      title: '宣布放颱風假，結果大太陽',
      text: '縣市半夜宣布今天放颱風假，結果早上出大太陽、一點風都沒有。放假的上班族全部跑出來覓食，網友稱這是「整備假」。',
      months: [7, 8, 9, 10],
      where: 'staff',
      choices: [
        { label: '照常營業，出勤的員工發加班津貼', note: '$4,000', effects: { cash: -8000, demand: { mult: 1.25, months: 0.3 }, morale: 3 }, result: '今天的人潮跟過年一樣，大家累但很開心。', tip: '颱風假不是法定假日；雇主不能強迫員工出勤，也不能因員工沒上班而不利對待。' },
        { label: '跟著放假，大家休息', effects: { closeToday: true, morale: 5 }, result: '員工在群組傳了一張在家吹冷氣的照片：「謝謝老闆～」' },
        { label: '「沒颱風放什麼假，全部來上班」', effects: { morale: -8, jerk: 4 }, result: '大家來了，但臉都很臭。', tip: '颱風假不是法定假日；雇主不能強迫員工出勤，也不能因員工沒上班而不利對待。' },
      ],
    },
    {
      id: 't_heat',
      icon: '🥵',
      title: '高溫特報：38 度',
      text: '氣象署發布高溫紅色燈號，店裡就算開冷氣也很熱。站在煎台、爐子、洗車區的員工汗流浹背。',
      months: [6, 7, 8, 9],
      where: 'staff',
      choices: [
        { label: '幫大家準備冰飲、加開電扇、輪流休息', note: '$1,500', effects: { cash: -3000, morale: 6 }, result: '大家輪流喝冰飲，有人說這是今年最感動的福利。', tip: '依職業安全衛生法，雇主應採取措施預防高溫作業引起的熱危害。' },
        { label: '「撐一下，夏天本來就熱」', effects: { morale: -6, jerk: 2 }, result: '下午有員工熱到頭暈，蹲在後門吹風。' },
      ],
    },
    {
      id: 't_onestar',
      icon: '⭐',
      title: '「一星俠」找上你家',
      text: '你的店突然多了一則一星評論，留言只有一句「普」。點進那個帳號一看，他一小時內給了一百多家店一星，大部分都沒去過。',
      where: 'phone',
      choices: [
        { label: '幽默回覆：「謝謝光臨（雖然你沒有來）」', effects: { followers: 500, review: [5, '老闆回一星俠回得太好笑了'] }, result: '你的回覆被截圖瘋傳，好多人專程來留五星「替你平反」。' },
        { label: '向平台檢舉', effects: {}, result: '一週後那則評論被刪掉了。' },
        { label: '在粉專公開嗆他', effects: { followers: -150, jerk: 1, review: [2, '老闆在網路上跟客人吵架'] }, result: '吵了兩天，大家只記得「那家店會嗆人」。' },
      ],
      ignore: { effects: { review: [1, '普'] }, result: '一星就掛在那裡。' },
    },
    {
      id: 't_dubaiq',
      icon: '🍫',
      title: '要不要跟風「杜拜Ｑ餅」？',
      text: '開心果巧克力麻糬紅翻天，隔壁的店都在出「杜拜○○」。員工問：「我們要不要出杜拜口味？」開心果醬一桶好貴。',
      industries: FOOD,
      where: 'staff',
      choices: [
        { label: '推出限量杜拜口味', note: '$10,000 進貨', effects: { cash: -20000, demand: { mult: 1.15, months: 3 }, followers: 400 }, result: '前三週排爆，第四週熱潮突然退了，倉庫剩半桶開心果醬。' },
        { label: '不跟，做自己的招牌', effects: { followers: 60 }, result: '有客人留言：「終於有一家店沒有在賣杜拜。」' },
      ],
    },
    {
      id: 't_qrscam',
      icon: '📲',
      title: '「您的收款碼需要重新認證」',
      text: '店裡的手機收到一則訊息，自稱是支付平台客服：「您的收款 QR Code 異常，請翻拍收款碼並點擊連結重新認證，否則將停止收款。」',
      where: 'phone',
      choices: [
        { label: '打 165 反詐騙專線查證', effects: { followers: 80 }, result: '165 說這是最近很常見的詐騙手法。你把截圖貼在員工群組提醒大家。', tip: '詐騙集團會誘騙店家翻拍收款碼或點連結「認證」；任何要你操作帳戶的訊息，都先打 165 查證。' },
        { label: '照著做，怕不能收款', effects: { cash: -40000, jerk: 0 }, result: '收款帳戶被盜轉了一筆錢。你在 165 的報案單上簽名，手一直在抖。' },
      ],
    },
    {
      id: 't_aibot',
      icon: '🤖',
      title: 'AI 點餐機業務來推銷',
      text: '業務拿著平板說：「AI 點餐機，聽得懂台語、會推薦加點，可以幫你省一個人力！」示範的時候，它把「去冰微糖」聽成「去兵危堂」。',
      where: 'door',
      speaker: { look: 'investor', name: 'AI 點餐機業務' },
      choices: [
        { label: '買一台試試看', note: '$15,000', effects: { cash: -30000, review: [3, '點餐機很聰明，但聽不懂我的口音'], followers: 100 }, result: '點餐機很受學生歡迎；長輩客人還是比較喜歡跟店員說話。' },
        { label: '「我們的店員就是最好的 AI」', effects: { morale: 4 }, result: '員工們聽到了，偷偷笑了一整天。' },
      ],
    },
    {
      id: 't_stockgod',
      icon: '📈',
      title: '工讀生是股神',
      text: '台股又創新高，一位工讀生整天偷看看盤 App，下午突然大喊：「我賺到一個月薪水了！今天我請全店喝飲料！」',
      target: (s) => s.staff.slice().sort((a, b) => a.hiredDay - b.hiredDay).pop(),
      where: 'staff',
      choices: [
        { label: '恭喜他，提醒上班時間別一直看盤', effects: { morale: 5 }, result: '大家喝著他請的飲料，紛紛問他明牌。' },
        { label: '「上班看盤，扣薪水！」', effects: { morale: -5, jerk: 2 }, result: '飲料還沒到，氣氛就冷掉了。' },
      ],
    },
    {
      id: 't_haircut',
      icon: '✂️',
      title: '「百元快剪」都漲價了',
      text: '附近的百元快剪貼出公告：「因薪資與電費上漲，調整為 150 元。」常客問你：「你們會漲嗎？」',
      industries: ['barber'],
      where: 'staff',
      choices: [
        { label: '跟著小漲，貼出原因', effects: { price: 0.05, review: [4, '有說明漲價原因，可以理解'] }, result: '大部分常客都能接受。' },
        { label: '暫時不漲，拉一波客人', effects: { demand: { mult: 1.08, months: 2 }, followers: 100 }, result: '「隔壁漲價、這家沒漲」被傳開，排隊的人變多了。' },
      ],
    },
    {
      id: 't_teashop',
      icon: '🧋',
      title: '對面又開了一家手搖店',
      text: '對面新開了一家「熟成慢焙山嵐青檸手作茶研所」，名字長到招牌放不下，開幕買一送一。這已經是這條街今年第三家了。',
      industries: ['drinks'],
      where: 'staff',
      choices: [
        { label: '推出「名字很短」系列：「茶」「奶」「冰」', effects: { followers: 300, review: [5, '名字最短的飲料店，很好點'] }, result: '網友笑翻，說這是本年度最佳反擊。' },
        { label: '跟著買一送一', note: '一週', effects: { cash: -15000, demand: { mult: 1.1, months: 1 } }, result: '兩家店門口都排了長長的隊伍，誰也沒有贏。' },
        { label: '不理它，三個月後再說', effects: { demand: { mult: 0.95, months: 2 } }, result: '開幕期搶走了一些客人。手搖店三個月定生死，等著看吧。' },
      ],
    },
    {
      id: 't_labor',
      icon: '🧑‍🍳',
      title: '徵人啟事貼了一個月沒人來',
      text: '餐飲業嚴重缺工，徵人啟事貼了一個月只有一個人來面試，而且他問的第一個問題是：「可以只上週六嗎？」',
      where: 'staff',
      choices: [
        { label: '提高時薪、寫清楚福利', note: '薪資 +3%', effects: { wageMult: 0.03, staff: 1 }, result: '新的徵人啟事貼出去第二天，就有人來應徵了。' },
        { label: '找附近退休的長輩來兼職', effects: { staff: 1, review: [5, '店裡的阿姨好親切'] }, result: '新來的阿姨動作不快，但客人都很喜歡跟她聊天。' },
        { label: '大家再撐一下', effects: { morale: -6 }, result: '每個人都多排了一天班。' },
      ],
    },
    {
      id: 't_fakeparcel',
      icon: '📦',
      title: '「簡訊說我包裹地址有問題」',
      text: '一位阿嬤拿著手機來問：「妹妹，簡訊說我的包裹地址錯誤，要點連結付 30 塊重新配送，我要怎麼付？」',
      industries: ['store'],
      where: 'staff',
      choices: [
        { label: '告訴阿嬤這是詐騙，幫她刪掉簡訊', effects: { followers: 150, review: [5, '店員救了我阿嬤，還教她怎麼分辨詐騙'] }, result: '阿嬤一直說謝謝，隔天帶了一袋橘子來。', tip: '冒充物流的詐騙簡訊很常見；正規物流不會用簡訊連結要你付款。' },
        { label: '「阿嬤，這我們不清楚耶」', effects: {}, result: '阿嬤自己按了連結。' },
      ],
    },
    {
      id: 't_birth',
      icon: '🍼',
      title: '兒童餐越來越賣不動',
      text: '新聞說今年出生數又創新低。你發現兒童餐和親子套餐的點單少了好多，倒是帶狗狗來的客人越來越多。',
      industries: ['breakfast', 'noodle', 'drinks'],
      where: 'staff',
      choices: [
        { label: '改成「毛孩友善套餐」，歡迎帶寵物', effects: { petFriendlyOn: true, followers: 250 }, result: '店門口多了一個狗狗水碗，帶毛孩的客人越來越多。' },
        { label: '推「長輩友善套餐」：份量少、軟一點', effects: { demand: { mult: 1.04, months: 3 }, review: [5, '有長輩套餐，帶爸媽來很方便'] }, result: '附近的長輩開始固定來報到。' },
      ],
    },
    {
      id: 't_yearword',
      icon: '🀄',
      title: '選出本店的年度代表字',
      text: '電視在公布今年的年度代表字。員工說：「我們店也來選一個吧！」大家在白板上寫了「蛋」「熱」「漲」「忙」「撐」。',
      months: [12],
      where: 'staff',
      choices: [
        { label: '選「撐」：辛苦大家了，發一份紅包', note: '每人 $500', effects: { cash: -8000, morale: 8 }, result: '大家把「撐」字貼在休息室，下面每個人簽了名。' },
        { label: '選「漲」：小編拿來發文', effects: { followers: 300 }, result: '貼文寫「物價在漲、薪水在漲、我們的愛也在漲」，網友留言「好油喔」，但分享很多。' },
      ],
    },
    {
      id: 't_tariff',
      icon: '🚢',
      title: '常客的心情就是天氣預報',
      text: '常客陳老闆是做螺絲出口的，這陣子在討論關稅。他今天進門的表情很凝重，點了平常的兩倍：「心情不好，吃多一點。」',
      where: 'staff',
      choices: [
        { label: '多陪他聊幾句，送他一份小菜', effects: { cash: -100, review: [5, '心情不好的時候，這家店最溫暖'] }, result: '陳老闆走的時候說：「下次帶公司的人來吃。」' },
        { label: '照常服務', effects: {}, result: '陳老闆吃完就走了。' },
      ],
    },
  ];
  Data.EVENTS.push(...T);
  Fun.TREND_EVENTS = T;
})(typeof window !== 'undefined' ? window : globalThis);
