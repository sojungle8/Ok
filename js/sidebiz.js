// 兼營業務的事件：每項業務都有自己的麻煩和機會；還有「十項全能」被逼出來的員工心聲
// 效果裡的 sideHot：某項業務接下來幾天客人變多；sideDown：某項業務停擺幾天
(function (root) {
  const Fun = root.BossFun;
  if (!Fun) return;

  const ta = (e) => (e && e.gender === 'f' ? '她' : '他');
  const who = (e) => (e ? e.name : '店員');
  const id = (e) => (e ? e.id : null);
  const mood = (e, d) => (e ? { moodOf: [[e.id, d]] } : {});

  Fun.SIDE_EVENTS = {
    sb_parcel: (s, e) => ({
      id: 'sbe_parcel',
      icon: '📦',
      title: '包裹堆到天花板',
      text: `雙十一剛過，包裹店到店的貨多到堆滿倉庫，${who(e)}找一個包裹要翻十分鐘，後面排了一條人龍。有客人說：「你們怎麼不用電腦查？」`,
      choices: [
        { label: '買一組包裹層架、貼編號', note: '$6,000・之後找得快', effects: { cash: -12000, sideHot: ['sb_parcel', 1.3, 10], ...mood(e, 6) }, result: '層架一裝好，找包裹從十分鐘變成十秒。來領貨的人變多，順便買東西的人也變多了。' },
        { label: '請大家先忍耐這一週', effects: { review: [2, '領個包裹等二十分鐘，店員還找不到'], ...mood(e, -5) }, result: `${who(e)}翻包裹翻到腰痛。` },
        { label: '暫停收件三天', effects: { sideDown: ['sb_parcel', 3] }, result: '門口貼了「本店包裹爆倉，暫停收件」，網友說這張公告很有誠意。' },
      ],
      ignore: { effects: { review: [1, '包裹找不到還叫我明天再來'] }, result: '有人等不到包裹，在評論區留下一顆星。' },
    }),
    sb_atm: (s) => ({
      id: 'sbe_atm',
      icon: '🏧',
      title: 'ATM 前面有人一直講電話',
      text: '一位阿姨一邊講電話一邊操作 ATM：「對，我現在要解除分期付款……你說要按『轉帳』嗎？」電話那頭的聲音聽起來很急。',
      choices: [
        { label: '過去關心：「阿姨，這可能是詐騙」', effects: { followers: 300, review: [5, '店員救了我媽的退休金'], morale: 3 }, result: '阿姨愣住，掛掉電話後一直跟你道謝。警察後來還來店裡頒感謝狀。', tip: '「解除分期付款」「操作 ATM 解除設定」都是常見詐騙話術；超商店員主動關懷、通報 165，每年攔下很多案件。' },
        { label: '不關我的事', effects: { jerk: 1 }, result: '隔天新聞報了一則「婦人 ATM 轉帳被騙 30 萬」，地點看起來很眼熟。' },
      ],
      ignore: { effects: {}, result: '阿姨轉完帳就走了。' },
    }),
    sb_copy: (s, e) => ({
      id: 'sbe_copy',
      icon: '🖨️',
      title: '客人要印 300 頁',
      text: `一位研究生抱著隨身碟衝進來：「我論文明天口試，要印 300 頁、雙面、彩色，還要裝訂，一小時內可以嗎？」${who(e)}看著影印機，表情很複雜。`,
      choices: [
        { label: '接！叫一個人專心印', note: '大單', effects: { cash: 6000, ...mood(e, -6) }, result: `${who(e)}印到影印機冒煙，研究生拿到的時候差點哭出來。` },
        { label: '接，但請他先付錢、自己幫忙裝訂', effects: { cash: 4000, followers: 40 }, result: '研究生一邊裝訂一邊說：「這是我人生最勵志的一小時。」' },
        { label: '婉拒：設備撐不住', effects: {}, result: '他轉身衝去下一家店。' },
      ],
      ignore: { effects: {}, result: '他等不及，自己走了。' },
    }),
    sb_hotdog: (s, e) => ({
      id: 'sbe_hotdog',
      icon: '🌭',
      title: '熱狗機壞掉了',
      text: `熱狗機的滾輪停了，裡面的熱狗一半焦黑、一半還是冷的。${who(e)}：「老闆，維修師傅說零件要等一週。」`,
      choices: [
        { label: '加急換新機', note: '$12,000', effects: { cash: -24000 }, result: '新機器滾得又快又穩，香味飄到馬路上。' },
        { label: '等零件，這週先不賣', effects: { sideDown: ['sb_hotdog', 7] }, result: '「熱狗暫停供應」的牌子掛了一週，常客很失落。' },
        { label: '「用煎的也一樣啦」', quote: '客人吃不出來。', effects: { review: [2, '熱狗一半焦一半冰，這是什麼新口味'], jerk: 1 }, result: '有客人拍照上網：「這根熱狗是陰陽合體。」' },
      ],
      ignore: { effects: { sideDown: ['sb_hotdog', 7] }, result: '熱狗機就這樣停了一週。' },
    }),
    sb_kiosk: (s) => ({
      id: 'sbe_kiosk',
      icon: '🎫',
      title: '天團演唱會今天開賣',
      text: '中午十二點演唱會門票開賣，十一點半店裡的多媒體機前就排了二十個人，每個人手上都拿著三支手機。還有人問你：「老闆，可以幫我顧位子嗎？我去上廁所。」',
      choices: [
        { label: '幫忙維持秩序、拉排隊線', effects: { sideHot: ['sb_kiosk', 2.5, 1], followers: 200, morale: -1 }, result: '有人搶到票在店裡尖叫，大家一起鼓掌。順便買飲料的人多到收銀台大排長龍。' },
        { label: '貼公告：一人限操作 5 分鐘', effects: { review: [4, '老闆有維持秩序，比網路公平'] }, result: '大家輪流操作，雖然還是沒搶到，至少很公平。' },
        { label: '黃牛來包場，給你紅包', note: '$3,000', effects: { cash: 6000, jerk: 3, review: [1, '店家跟黃牛勾結，一般人都買不到'] }, result: '黃牛霸佔機器一整個中午。爆料社團開始傳你的店名。', tip: '依《文化創意產業發展法》，以超過票面金額轉售演唱會門票可處票價 10～50 倍罰鍰。' },
      ],
      ignore: { effects: { sideHot: ['sb_kiosk', 2, 1] }, result: '排隊的人自己吵成一團，最後還是有人順便買了飲料。' },
    }),
    sb_power: (s) => ({
      id: 'sbe_power',
      icon: '🔋',
      title: '行動電源被借走沒還',
      text: '租借系統顯示有 6 顆行動電源超過一週沒歸還，其中一顆的定位在高雄。廠商說要你們店吸收一半損失。',
      choices: [
        { label: '照合約吸收', note: '$1,800', effects: { cash: -3600 }, result: '錢花了，但機器照常運作。' },
        { label: '在粉專發文「尋找流浪行動電源」', effects: { followers: 150, cash: -1800 }, result: '貼文意外爆紅，有網友真的在高雄找到一顆寄回來。' },
      ],
      ignore: { effects: { cash: -3600 }, result: '廠商直接從帳上扣了。' },
    }),
    sb_lotto: (s) => ({
      id: 'sbe_lotto',
      icon: '🎰',
      title: '你們店開出頭獎了！',
      text: '昨晚的彩券頭獎，竟然是在你們店買的！今天一早門口就站滿了來沾喜氣的人，還有電視台的車停在路邊。',
      choices: [
        { label: '掛紅布條「本店開出頭獎」', note: '$2,000', effects: { cash: -4000, sideHot: ['sb_lotto', 3, 14], followers: 400 }, result: '接下來兩週，彩券和順便買的東西都賣翻了，連土地公神桌前都有人來拜。' },
        { label: '低調處理，正常營業', effects: { sideHot: ['sb_lotto', 1.8, 7] }, result: '消息還是傳開了，人潮自己湧進來。' },
      ],
      ignore: { effects: { sideHot: ['sb_lotto', 1.8, 7] }, result: '你還沒反應過來，人潮就來了。' },
    }),
    sb_laundry: (s) => ({
      id: 'sbe_laundry',
      icon: '🧺',
      title: '洗衣機裡洗出一隻襪子以外的東西',
      text: '有客人來抱怨：「我的白襯衫洗完變粉紅色！」打開洗衣機一看，裡面卡著一條上一位客人的紅色內褲。',
      choices: [
        { label: '賠他一件襯衫、貼「洗前請檢查」', note: '$1,200', effects: { cash: -2400, review: [4, '雖然出包，但店家處理得很好'] }, result: '客人收下賠償，還說：「這條內褲的主人應該也很困擾。」' },
        { label: '「機器又不是我們放的內褲」', effects: { review: [1, '洗壞衣服還說不關他的事'] }, result: '客人在社團發文，標題是〈粉紅色的憤怒〉。' },
      ],
      ignore: { effects: { review: [2, '洗衣機有人遺留衣物，店家都不清'] }, result: '客人自己帶著粉紅襯衫走了。' },
    }),
    sb_parcelb: (s, e) => ({
      id: 'sbe_parcelb',
      icon: '📦',
      title: '社區包裹變成大型家具',
      text: `鄰居網購了一張雙人床墊，寄到你們早餐店。床墊立在門口，擋住了一半的煎台。${who(e)}：「老闆，客人說他看不到菜單。」`,
      choices: [
        { label: '打電話請鄰居馬上來搬', effects: { followers: 30 }, result: '鄰居衝下樓搬床墊，順便買了三份蛋餅謝謝大家。' },
        { label: '之後只收「小包裹」', effects: { sideHot: ['sb_parcelb', 0.7, 30] }, result: '門口貼了「本店代收包裹限鞋盒大小」，社區群組一片理解的貼圖。' },
      ],
      ignore: { effects: { review: [3, '早餐店門口有一張床墊，很有居家感'] }, result: '床墊在門口站了一個早上。' },
    }),
    sb_lunchbox: (s, e) => ({
      id: 'sbe_lunchbox',
      icon: '🍱',
      title: '附近工地要訂 40 個便當',
      text: '隔壁工地的工頭來問：「明天中午 40 個便當，十一點半要送到，可以嗎？」一次 40 個，煎台會忙到不行。',
      choices: [
        { label: '接單，早上多請一個人', note: '大單', effects: { cash: 5200, ...mood(e, -4) }, result: '便當準時送到，工頭說以後每週都要訂。' },
        { label: '接 20 個就好', effects: { cash: 2600 }, result: '工頭：「好啦，剩下的我叫他們吃泡麵。」' },
        { label: '婉拒', effects: {}, result: '工頭轉身去了對面。' },
      ],
      ignore: { effects: {}, result: '工頭沒等到回覆，就去別家訂了。' },
    }),
    sb_pourover: (s, e) => ({
      id: 'sbe_pourover',
      icon: '☕',
      title: '咖啡職人上門指教',
      text: `一位戴圓框眼鏡的客人喝了一口手沖：「水溫太高，萃取過度，有焦苦味。」然後開始教${who(e)}怎麼繞圈注水，後面的上班族已經在看手錶。`,
      choices: [
        { label: '虛心請教，請他下次來教學', effects: { followers: 80, ...mood(e, 3) }, result: '他真的每週六來教一小時，咖啡越來越好喝，還在網路上推薦你們。' },
        { label: '客氣地請他讓後面的客人先點', effects: {}, result: '他嘆了口氣：「早餐店的咖啡，果然還是這樣。」' },
      ],
      ignore: { effects: { review: [3, '手沖有努力，但萃取不太穩'] }, result: '他留了一則很長的專業評論。' },
    }),
    sb_kidsbrunch: (s, e) => ({
      id: 'sbe_kids',
      icon: '🧸',
      title: '小朋友在店裡跑來跑去',
      text: '週末親子早午餐客滿，三個小朋友在走道上玩鬼抓人，差點撞到端著熱湯的店員。其他客人開始皺眉。',
      choices: [
        { label: '設一個小小遊戲角落', note: '$5,000', effects: { cash: -10000, sideHot: ['sb_kidsbrunch', 1.5, 30], review: [5, '有遊戲角落，爸媽終於能好好吃一頓'] }, result: '小朋友都乖乖窩在角落畫畫，爸媽在社團大力推薦。' },
        { label: '請家長注意小孩安全', effects: { review: [3, '店家有提醒，但口氣有點兇'] }, result: '家長有點尷尬，把小孩抓回座位。' },
      ],
      ignore: { effects: { review: [2, '一堆小孩在跑，吵到不行'] }, result: '有人吃到一半就結帳走了。' },
    }),
    sb_luwei: (s, e) => ({
      id: 'sbe_luwei',
      icon: '🍢',
      title: '滷汁要不要繼續加',
      text: `${who(e)}問你：「老闆，這鍋滷汁已經滷了三個月了，越來越香，但衛生局說滷汁要定期更換。我們要倒掉重來嗎？」`,
      choices: [
        { label: '照規定換，留一點老滷當底', effects: { cash: -2000 }, result: '新滷汁加一點老滷，香味沒差多少，衛生稽查也放心。' },
        { label: '「百年老滷就是我們的招牌」', effects: { followers: 60, flag: 'oldBrine' }, result: '你在招牌上加了「三個月老滷」，客人覺得很厲害；稽查員下次來會特別看這一鍋。' },
      ],
      ignore: { effects: {}, result: '那鍋滷汁就這樣繼續滷下去。' },
    }),
    sb_bentob: (s) => ({
      id: 'sbe_bentob',
      icon: '🍱',
      title: '辦公室團訂少付錢',
      text: '上週一間公司團訂 30 個便當，說月底結帳。今天打電話去問，行政小姐說：「啊？那個主管離職了耶。」',
      choices: [
        { label: '寄存證信函追討', note: '$500', effects: { cash: 4000 }, result: '對方公司收到信，馬上把錢匯過來，還附上一句「不好意思」。' },
        { label: '算了，以後團訂一律先收訂金', effects: { cash: -1500 }, result: '這次認賠，但之後再也沒有被倒過。' },
      ],
      ignore: { effects: { cash: -3000 }, result: '錢就這樣收不回來了。' },
    }),
    sb_dumpling: (s, e) => ({
      id: 'sbe_dumpling',
      icon: '🥟',
      title: '團購主一次下 500 包',
      text: `團購主傳訊息：「老闆！我這波開團爆單，水餃要 500 包，三天內出貨！」包水餃的人手就那幾個，現場生意也要顧。`,
      choices: [
        { label: '全接，請大家加班（照算加班費）', effects: { cash: 30000, morale: -4, ...mood(e, -6) }, result: '三天三夜包水餃，大家手都抽筋了，但看到入帳都笑了。' },
        { label: '接 200 包，剩下的排下一批', effects: { cash: 12000, followers: 60 }, result: '團購主雖然有點失望，但說「品質比較重要」。' },
        { label: '婉拒，現場優先', effects: {}, result: '團購主轉去找別的店。' },
      ],
      ignore: { effects: {}, result: '團購主等不到回覆就找別人了。' },
    }),
    sb_newyear: (s) => ({
      id: 'sbe_newyear',
      icon: '🧧',
      title: '年菜訂單爆了',
      text: '除夕前一週，年菜訂單多到冷凍庫塞不下。有客人打來說：「我訂的佛跳牆可以改成兩份嗎？我丈母娘也要來。」',
      choices: [
        { label: '租一台冷凍貨櫃', note: '$8,000', effects: { cash: -16000, sideHot: ['sb_newyear', 1.6, 10] }, result: '冷凍貨櫃停在門口，看起來很專業，訂單更多了。' },
        { label: '停止接單', effects: { sideDown: ['sb_newyear', 10] }, result: '粉專公告「年菜已售完」，反而讓明年的預購更搶手。' },
      ],
      ignore: { effects: { review: [2, '年菜退冰了才拿到'] }, result: '有幾份年菜放在常溫太久。' },
    }),
    sb_chicken: (s, e) => ({
      id: 'sbe_chicken',
      icon: '🍗',
      title: `${who(e)}被熱油噴到`,
      text: `炸雞排的時候油鍋突然爆油，${who(e)}的手臂被燙紅了一大片。${ta(e)}咬著牙說：「沒事，我可以繼續。」`,
      choices: [
        { label: '馬上沖水、帶去看醫生，今天提早下班', effects: { cash: -1500, ...mood(e, 10), sendHomeOf: id(e), morale: 2 }, result: `醫生說處理得很即時，不會留疤。${who(e)}隔天就回來了。`, tip: '員工在工作中受傷屬於職業災害，雇主應負擔醫療費用；就醫期間的工資也要依法補償。' },
        { label: '買一副防燙手套和油鍋防濺蓋', note: '$3,000', effects: { cash: -6000, ...mood(e, 4) }, result: '之後炸東西安全多了，大家都說早該買了。' },
        { label: '「炸東西本來就會燙到」', effects: { ...mood(e, -15), jerk: 3 }, result: `${who(e)}默默貼了一塊OK繃，繼續炸。` },
      ],
      ignore: { effects: { ...mood(e, -10) }, result: `${who(e)}自己去藥局買了燙傷藥膏。` },
    }),
    sb_dessert: (s, e) => ({
      id: 'sbe_dessert',
      icon: '🍮',
      title: '網路爆紅的甜點要不要跟',
      text: '網路上最近瘋一種「開心果爆漿巧克力」，每家店都在出。一盒成本很高，但有人說：「沒賣這個，年輕人不會進來。」',
      choices: [
        { label: '跟風推出限量款', note: '$6,000 研發', effects: { cash: -12000, sideHot: ['sb_dessert', 2.2, 14], followers: 250 }, result: '限量款一推出就賣光，兩週後熱潮退了，但新客人留下來不少。' },
        { label: '不跟，做自己的招牌甜點', effects: { followers: 40 }, result: '有客人留言：「終於有一家店沒有在賣那個了。」' },
      ],
      ignore: { effects: {}, result: '熱潮在你猶豫的時候就過了。' },
    }),
    sb_fruit: (s) => ({
      id: 'sbe_fruit',
      icon: '🍉',
      title: '水果價格暴漲',
      text: '颱風過後，芒果和西瓜的批發價漲了一倍。現切水果杯賣原價會虧錢，漲價又怕客人跑掉。',
      choices: [
        { label: '暫時漲 $15，門口貼說明', effects: { review: [4, '有寫原因，可以理解'] }, result: '大部分客人看了說明都能接受。' },
        { label: '原價硬撐，少放一點水果', effects: { review: [2, '水果杯越來越空'], jerk: 1 }, result: '有人拍照比較「颱風前 vs 颱風後」。' },
        { label: '暫停一週', effects: { sideDown: ['sb_fruit', 7] }, result: '等價格回穩再賣。' },
      ],
      ignore: { effects: { cash: -2000 }, result: '照原價賣了一週，虧了一點。' },
    }),
    sb_merch: (s) => ({
      id: 'sbe_merch',
      icon: '🧸',
      title: '周邊被說抄襲',
      text: '有插畫家在網路上說：「這家店的聯名小熊，跟我三年前畫的角色幾乎一模一樣。」留言區開始吵起來。',
      choices: [
        { label: '下架道歉，改找這位插畫家正式合作', note: '$10,000 授權', effects: { cash: -20000, followers: 500, review: [5, '出包後處理得很漂亮，還跟原作者合作'] }, result: '新的聯名款比原本的更紅，插畫家的粉絲也來買。', tip: '使用他人創作的角色圖案，即使只是「很像」也可能侵害著作權；正式授權是最安全的做法。' },
        { label: '「只是剛好像而已」', effects: { followers: -300, review: [1, '抄襲還不認錯'], jerk: 2 }, result: '爆料越傳越廣，周邊只好全部下架。' },
      ],
      ignore: { effects: { followers: -150 }, result: '吵了一週，周邊賣不太動了。' },
    }),
    sb_ear: (s, e) => ({
      id: 'sbe_ear',
      icon: '👂',
      title: '阿伯掏耳朵掏到睡著',
      text: `一位常客阿伯掏耳朵掏到睡著了，還打呼。後面排了兩個人，${who(e)}不知道該不該叫醒他。`,
      choices: [
        { label: '讓他睡十分鐘，請後面的人先剪髮', effects: { review: [5, '阿伯睡得超安穩，店家好有人情味'] }, result: '阿伯醒來說：「好久沒睡這麼好了。」之後每週都來。' },
        { label: '輕輕叫醒他', effects: {}, result: '阿伯醒來有點不好意思：「我太放鬆了。」' },
      ],
      ignore: { effects: { review: [3, '等掏耳朵等很久'] }, result: '阿伯睡了半小時。' },
    }),
    sb_shampoo: (s, e) => ({
      id: 'sbe_shampoo',
      icon: '🧴',
      title: '推銷推到客人生氣',
      text: `${who(e)}為了衝洗髮精業績，每個客人都推銷三次。有一位客人終於受不了：「我就是來剪頭髮，不要再問我了！」`,
      choices: [
        { label: '改成「客人問了再介紹」', effects: { ...mood(e, 2), review: [4, '不會硬推銷，很舒服'] }, result: '洗髮精少賣了一點，但客人的評價變好了。' },
        { label: '「業績就是要衝」', effects: { sideHot: ['sb_shampoo', 1.4, 14], review: [2, '一直被推銷洗髮精，好煩'] }, result: '洗髮精多賣了一些，但評論區開始有人抱怨。' },
      ],
      ignore: { effects: { review: [2, '店員推銷很煩'] }, result: '客人剪完就走了。' },
    }),
    sb_massage: (s, e) => ({
      id: 'sbe_massage',
      icon: '💆',
      title: `${who(e)}按到手腕發炎`,
      text: `${who(e)}最近每天按摩五六個客人，手腕腫起來了：「老闆，我拿剪刀的時候會痛……」`,
      choices: [
        { label: '讓他休息、按摩每天限量', effects: { sideDown: ['sb_massage', 5], ...mood(e, 10) }, result: `${who(e)}去做了復健，回來後說：「以後一天最多三個。」` },
        { label: '買按摩椅分擔', note: '$15,000', effects: { cash: -30000, ...mood(e, 6) }, result: '按摩椅很受歡迎，人工按摩變成「加價升級」。' },
        { label: '「年輕人恢復很快的」', effects: { ...mood(e, -15), jerk: 2 }, result: `${who(e)}貼著痠痛貼布繼續按。` },
      ],
      ignore: { effects: { ...mood(e, -8) }, result: `${who(e)}的手越來越痛。` },
    }),
    sb_donate: (s) => ({
      id: 'sbe_donate',
      icon: '🎗️',
      title: '捐髮的小女生',
      text: '一位國小女生留了三年長髮，今天要剪下來捐給生病的小朋友。媽媽在旁邊拍照，眼眶有點紅。',
      choices: [
        { label: '全店員工一起鼓掌、送她一張感謝卡', effects: { followers: 300, morale: 4, review: [5, '女兒捐髮，整間店幫她鼓掌，好感動'] }, result: '媽媽把影片分享出去，好多人留言說要帶小孩來。' },
        { label: '照平常的流程', effects: { followers: 50 }, result: '女生摸著短髮，笑得很開心。' },
      ],
      ignore: { effects: {}, result: '剪完了。' },
    }),
    sb_pet: (s) => ({
      id: 'sbe_pet',
      icon: '🐶',
      title: '柴犬逃出來了',
      text: '修剪到一半的柴犬掙脫跑到店裡，正在剪頭髮的客人被嚇到，剪刀差點劃到耳朵。柴犬在店裡繞圈，看起來很開心。',
      choices: [
        { label: '寵物區加裝圍欄', note: '$6,000', effects: { cash: -12000, review: [4, '寵物和人分開，很安心'] }, result: '之後再也沒有狗狗逃出來。' },
        { label: '拍成影片上傳', effects: { followers: 600, review: [2, '剪頭髮剪到一半被狗撞'] }, result: '〈柴犬越獄〉影片爆紅，但被嚇到的客人很不爽。' },
        { label: '停止寵物服務', effects: { sideDown: ['sb_pet', 30] }, result: '寵物修剪暫停一個月。' },
      ],
      ignore: { effects: { review: [2, '店裡有狗亂跑'] }, result: '柴犬最後自己累了，躺在門口睡覺。' },
    }),
    sb_gear: (s) => ({
      id: 'sbe_gear',
      icon: '🧥',
      title: '午後雷陣雨，雨衣搶光',
      text: '下午突然下大雨，十分鐘內雨衣全部賣光，還有人在門口問：「垃圾袋可以賣我一個嗎？我套在身上。」',
      choices: [
        { label: '緊急叫貨＋垃圾袋免費送', note: '$2,000', effects: { cash: -4000, sideHot: ['sb_gear', 2, 3], followers: 120, review: [5, '下大雨老闆免費送垃圾袋雨衣，好暖'] }, result: '一群人穿著垃圾袋騎車離開，畫面很壯觀。' },
        { label: '垃圾袋一個賣 $20', effects: { cash: 600, review: [3, '垃圾袋賣 20 元，也算救急'] }, result: '大家都說貴，但還是買了。' },
      ],
      ignore: { effects: {}, result: '大家淋著雨走了。' },
    }),
    sb_inspect: (s, e) => ({
      id: 'sbe_inspect',
      icon: '📋',
      title: '代辦過戶少了一張證件',
      text: `${who(e)}跑到監理站才發現，客人給的委託書沒有蓋章。今天是期限最後一天，逾期要罰款。`,
      choices: [
        { label: '叫車把委託書送回去蓋章再送來', note: '$800', effects: { cash: -1600, review: [5, '代辦很負責，連計程車錢都自己出'] }, result: '最後五分鐘趕上，客人感動到送了一盒鳳梨酥。' },
        { label: '請客人自己去處理罰款', effects: { review: [2, '代辦出錯還要我自己付罰款'] }, result: '客人付了罰款，臉很臭。' },
      ],
      ignore: { effects: { cash: -1200, review: [2, '代辦過戶拖到逾期'] }, result: '逾期了，你只好吸收罰款。' },
    }),
    sb_wash: (s) => ({
      id: 'sbe_wash',
      icon: '🧽',
      title: '洗車水流進隔壁店',
      text: '洗車的泡沫水一路流到隔壁的服飾店門口，老闆娘拿著拖把出來：「你們可不可以注意一點！」',
      choices: [
        { label: '加裝排水溝，送隔壁一盒水果', note: '$5,000', effects: { cash: -10000 }, result: '老闆娘收下水果，還介紹客人來洗車。' },
        { label: '「水往低處流，我也沒辦法」', effects: { review: [2, '洗車店的水流得滿街都是'], jerk: 1 }, result: '隔壁老闆娘在里長群組裡抱怨。' },
      ],
      ignore: { effects: { review: [2, '騎樓都是泡沫水'] }, result: '騎樓濕了一整個下午。' },
    }),
    sb_used: (s, e) => ({
      id: 'sbe_used',
      icon: '🛵',
      title: '收到一台疑似泡水車',
      text: `有人要賣一台幾乎全新的機車，開價很低。${who(e)}偷偷跟你說：「老闆，座墊下面有泥沙，電線也有點鏽。」`,
      choices: [
        { label: '婉拒收購', effects: { ...mood(e, 4) }, result: `賣家罵了幾句就走了。${who(e)}說：「還好我們沒收。」` },
        { label: '壓低價格收下，整理後誠實標示', effects: { cash: 3000 }, result: '你在車上貼了「曾泡水，已整理」，一位學生還是買走了，說價格很划算。' },
        { label: '收下整理，當一般中古車賣', effects: { cash: 9000, jerk: 2, flag: 'floodBike' }, result: '賺了一筆。但你心裡知道，這台車哪天可能會出事。', tip: '販售中古車隱匿泡水、事故等重大瑕疵，買方可主張解除契約或減少價金，情節重大還可能涉及詐欺。' },
      ],
      ignore: { effects: {}, result: '賣家等不到你就走了。' },
    }),
    sb_rent: (s) => ({
      id: 'sbe_rent',
      icon: '🔑',
      title: '租出去的車沒回來',
      text: '一位觀光客租了機車說要騎去墾丁，已經超過還車時間兩天，電話也打不通。GPS 顯示車子停在一間民宿門口。',
      choices: [
        { label: '打給民宿請他們轉告', effects: { cash: 1000 }, result: '觀光客回電一直道歉，多付了兩天租金，還幫你寫了五星好評。' },
        { label: '報警處理', effects: { cash: -500 }, result: '警察找到人，原來他手機掉進海裡了。' },
      ],
      ignore: { effects: { cash: -2000 }, result: '最後車子回來了，但輪胎被刺破。' },
    }),
    sb_swap: (s) => ({
      id: 'sbe_swap',
      icon: '🔋',
      title: '換電站前面停滿機車',
      text: '下班尖峰，換電站前面停了一排電動機車，把你維修位的出入口都擋住了。有客人牽著要修的車進不來。',
      choices: [
        { label: '畫排隊線、立指示牌', note: '$1,500', effects: { cash: -3000, sideHot: ['sb_swap', 1.2, 14] }, result: '大家照著線排隊，維修位也通了。' },
        { label: '跟平台申請把換電站搬到轉角', effects: { sideDown: ['sb_swap', 2] }, result: '換電站搬走兩天後又搬回來，因為轉角太窄。' },
      ],
      ignore: { effects: { review: [3, '修車的入口被換電的人擋住'] }, result: '尖峰時段亂成一團。' },
    }),
  };

  // 十項全能的心聲：業務接太多、員工不會又要做
  Fun.SIDE_OVERLOAD = [
    (s, e, b) => ({
      id: 'sbo_why',
      icon: '😵',
      title: `${e.name}：「我到底是做什麼的？」`,
      text: `${e.name}一邊處理${b.icon}${b.name}，一邊嘆氣：「我當初應徵的是店員，現在要${s.sideNames(3)}……老闆，我們到底是什麼店？」`,
      choices: [
        { label: `花錢送${ta(e)}去學${b.name}`, note: `$${s.trainCost.toLocaleString()}`, effects: { trainOf: [e.id, b.id], moodOf: [[e.id, 6]] }, result: `${e.name}上完課，回來做得又快又順：「早說嘛！」` },
        { label: '幫會做最多事的人加薪 $20', effects: { raiseOf: [e.id, 20], moodOf: [[e.id, 8]] }, result: `${e.name}笑了：「好吧，十項全能的薪水我收下了。」` },
        { label: '「在台灣，每間店都是這樣」', quote: '能者多勞嘛。', effects: { moodOf: [[e.id, -12]], jerk: 2 }, result: `${e.name}沒說話。下班後在 Dcard 發了一篇〈我在一間什麼都要做的店打工〉。`, tip: '要求員工做明顯超出原本約定的工作，卻不調整薪資或訓練，是常見的離職原因；勞動契約的工作內容最好寫清楚。' },
      ],
      ignore: { effects: { moodOf: [[e.id, -8]] }, result: `${e.name}繼續硬著頭皮做。` },
    }),
    (s, e, b) => ({
      id: 'sbo_customer',
      icon: '🤨',
      title: '客人以為你們什麼都會',
      text: `有客人拿著一支螢幕摔破的手機進來：「你們不是什麼都有在做嗎？可以幫我修手機嗎？」${e.name}看向你。`,
      choices: [
        { label: '「我們沒有做這個，但可以介紹你去哪修」', effects: { review: [4, '雖然沒有修手機，但很熱心幫我找店'] }, result: '客人道謝離開，還順便買了一樣東西。' },
        { label: '「好，我們研究看看」', effects: { cash: -2000, review: [1, '手機給他們修，結果整支不能開機'], jerk: 1 }, result: `${e.name}拆開手機之後，就再也裝不回去了。` },
      ],
      ignore: { effects: {}, result: '客人自己走了。' },
    }),
  ];
})(typeof window !== 'undefined' ? window : globalThis);
