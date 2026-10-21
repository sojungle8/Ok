// 奇葩事件大全：現實生活和網路上會遇到的各種怪事
// 都是虛構情節，品牌一律用「某某平台」「某某大廠」稱呼
(function (root) {
  const Fun = root.BossFun;
  const Data = root.BossData;
  if (!Fun || !Data) return;

  // ───── 更多奧客（奧客擂台的對手） ─────
  Fun.KARENS.push(
    {
      id: 'refund',
      name: '「吃完才說難吃」先生',
      icon: '🍽️',
      rounds: [
        { line: '這個很難吃，我要退錢。', great: '好的，請問您是吃到第幾口發現的？我們想知道難吃是從哪裡開始的。', ok: '不好意思，請問是哪裡不合口味？', over: '盤子都舔乾淨了還說難吃？' },
        { line: '我真的全部吃完才確定它很難吃！', great: '您真是盡責的美食評論家，我們幫您申請「最有耐心客人獎」。', ok: '我們會把意見轉給廚房。', over: '那你的味覺應該先去看醫生。' },
        { line: '不退錢我就打給消保官！', great: '可以，順便問問消保官，吃完的東西要怎麼退貨給您。', ok: '您可以申訴，我們也會說明。', over: '消保官聽到也會笑出來。' },
      ],
    },
    {
      id: 'pet',
      name: '「毛小孩也是家人」小姐',
      icon: '🐩',
      rounds: [
        { line: '我家寶貝也要一個位子，牠是家人！', great: '當然，請問家人要內用還是外帶？兒童椅可能需要調低一點。', ok: '寵物可以待在推車裡陪您喔。', over: '那家人要不要也付錢？' },
        { line: '可以幫牠做一份無調味的嗎？', great: '可以，但我們的廚師說要先看牠的過敏報告。', ok: '我們可以給一碗清水。', over: '我們這裡不是寵物餐廳。' },
        { line: '牠剛剛尿在你們地上，但牠不是故意的。', great: '沒關係，我們的拖把也不是故意的，馬上就來。', ok: '我來處理就好，請小心不要踩到。', over: '那你也不是故意不帶尿布的嗎？' },
      ],
    },
    {
      id: 'live',
      name: '開直播的大哥',
      icon: '📹',
      rounds: [
        { line: '鐵粉們！來，老闆跟大家打個招呼！刷十個火箭老闆就唱歌！', great: '各位好，刷一百個火箭我就幫大家加薪——喔不對，那是我的員工。', ok: '大家好，歡迎來店裡吃喔！', over: '你的觀眾只有三個人。' },
        { line: '老闆，觀眾說你們太貴了！', great: '請觀眾把地址傳給我，我們親自送一碗過去，運費兩千。', ok: '我們的價格都照成本算的喔。', over: '你的觀眾連手機費都繳不起吧。' },
        { line: '不送我一份，我就跟大家說你們很小氣！', great: '好喔，那我也跟大家說你直播三小時，點了一杯白開水。', ok: '我們不接受這種交換喔。', over: '你說啊，誰在乎。' },
      ],
    },
    {
      id: 'mystery',
      name: '自稱「美食神秘客」',
      icon: '🕶️',
      rounds: [
        { line: '我是美食評鑑的神秘客，這餐應該免費吧？', great: '神秘客都不會自己說自己是神秘客耶，您是不是走錯劇本了？', ok: '不好意思，我們的餐點都是要付費的。', over: '神秘客？我看是神經客。' },
        { line: '你們不給我面子，評鑑就給零星！', great: '沒關係，我們先記下來：零星，比一星還省油。', ok: '我們還是會用心準備您的餐點。', over: '你那個評鑑網站是你自己架的吧。' },
        { line: '我在業界很有名的！', great: '那請您在我們的牆上簽個名，我們放在「名人簽名牆」旁邊的「付錢的名人」區。', ok: '謝謝您來用餐。', over: '我在 Google 搜不到你耶。' },
      ],
    },
    {
      id: 'note',
      name: '外送備註狂',
      icon: '📝',
      rounds: [
        { line: '（備註）餐點請用愛心形狀擺好，拍照給我確認再出餐。', great: '已擺好，附上照片，順便附上一張「店員拍照費」的發票。', ok: '我們會盡量擺好看一點。', over: '你要不要自己來擺？' },
        { line: '（備註）外送員請唱一首生日快樂歌給我聽。', great: '外送員說可以，但要先確認您的生日跟身分證一樣。', ok: '我們會幫您轉達，但外送員不一定方便。', over: '外送員是來送餐的，不是來賣唱的。' },
        { line: '（備註）如果晚到一分鐘就給一星。', great: '收到，我們已經請外送員繫好安全帶，打開時光機模式。', ok: '我們會盡快出餐。', over: '那你自己來拿就不會晚了。' },
      ],
    },
    {
      id: 'fengshui',
      name: '路過的風水大師',
      icon: '🔮',
      rounds: [
        { line: '老闆，你這店門口煞氣很重，我這尊貔貅只要八萬。', great: '我們的煞氣主要來自房租，請問貔貅能吃掉房東嗎？', ok: '謝謝，我們目前沒有這個預算。', over: '你的貔貅只吃客人的錢吧。' },
        { line: '你看你這個招牌的顏色，難怪生意會不好！', great: '我們生意不好的時候是因為下雨，招牌應該可以排除嫌疑。', ok: '謝謝建議，我們會考慮看看。', over: '你的穿著顏色比較需要改運。' },
        { line: '不聽我的，三個月內必有血光之災！', great: '我們每天都在切菜，血光之災大概是 OK 繃的事。', ok: '謝謝關心，我們會注意安全。', over: '我看三分鐘內是你被請出去。' },
      ],
    }
  );

  // ───── 更多時事 ─────
  Fun.TRENDS.push(
    { id: 'freeship', icon: '🛵', name: '外送平台免運日', desc: '某外送平台搞全面免運，網友：「今天不煮飯了」，外送員騎到冒煙。' },
    { id: 'lottery', icon: '🧾', name: '發票對中千萬', desc: '有人在早餐店拿到的發票中了千萬特別獎，全台開始搶著去那間買。' },
    { id: 'shopcat', icon: '🐈', name: '店貓爆紅', desc: '某間雜貨店的店貓每天坐在收銀台上，網友：「我是來看貓的，順便買東西」。' },
    { id: 'blackout', icon: '🔌', name: '大停電', desc: '一個變電所跳電，好幾個縣市停電，網友：「冰箱裡的冰淇淋在哭」。' },
    { id: 'roach', icon: '🪳', name: '會飛的蟑螂季', desc: '天氣變熱，會飛的蟑螂又出現了，網友：「牠朝我的臉飛過來的那一刻，我看見了人生跑馬燈」。', months: [4, 5, 6, 7, 8, 9] },
    { id: 'quitagent', icon: '📨', name: '離職代辦', desc: '有公司專門幫人辭職，員工不用自己開口，老闆收到一封很有禮貌的信。' },
    { id: 'garbage', icon: '🚛', name: '垃圾車音樂', desc: '網友票選「最能讓台灣人瞬間衝出門的音樂」，第一名：垃圾車。' },
    { id: 'mapclosed', icon: '🗺️', name: '地圖被改成「已歇業」', desc: '好幾間店被惡作劇在地圖上標成「永久停業」，老闆們忙著申訴。' },
    { id: 'pua', icon: '🧠', name: '職場 PUA', desc: '「你出去外面也不會比這裡好」被網友票選為最經典 PUA 語錄。' },
    { id: 'parentjob', icon: '👩‍👦', name: '家長陪面試', desc: '人資分享：面試時家長全程陪同，還幫孩子問年假有幾天。' }
  );
  Fun.POST_BODIES.push(
    { id: 'ship1b', trend: 'freeship', ind: ['barber'], text: '外送免運日，可惜頭髮不能外送，只能麻煩你自己走過來。', score: 7 },
    { id: 'ship1s', trend: 'freeship', ind: ['scooter'], text: '外送員們辛苦了！車子有問題隨時騎進來，外送員優先修。', score: 8 },
    { id: 'ship1', ind: ['breakfast', 'noodle', 'drinks', 'store'], trend: 'freeship', text: '外送免運日，我們不免運，但我們的 {item} 免排隊——自己走過來的那種。', score: 7 },
    { id: 'lot1', trend: 'lottery', text: '別人家的發票中千萬，我們家的發票會中「明天再來{w:eat}一次」的機率是 100%。', score: 7 },
    { id: 'lot2', trend: 'lottery', text: '本店發票也有機會中千萬，詳情請洽財政部，小編只負責開發票。', score: 6 },
    { id: 'cat1', trend: 'shopcat', text: '我們沒有店貓，但我們有 {staff}，一樣會在你{w:order}時盯著你看。', score: 8 },
    { id: 'out1b', trend: 'blackout', ind: ['barber'], text: '停電的時候我們還在，剪刀不用電（推剪也充飽了），窗邊的光線剛剛好。', score: 7 },
    { id: 'out1s', trend: 'blackout', ind: ['scooter'], text: '停電的時候我們還在，扳手不用電，補胎照補（請自備手電筒）。', score: 7 },
    { id: 'out1d', trend: 'blackout', ind: ['drinks'], text: '停電了，封口機罷工，今天的飲料全部改成真正的「手搖」——店員用手搖。', score: 7 },
    { id: 'out1st', trend: 'blackout', ind: ['store'], text: '停電的時候我們還在，冰櫃撐得住，泡麵和蠟燭都有貨（燈光美氣氛佳）。', score: 7 },
    { id: 'out1', ind: ['breakfast', 'noodle'], trend: 'blackout', text: '停電的時候我們還在，煤氣爐不用電，{item} 照樣出餐（燈光美氣氛佳）。', score: 7 },
    { id: 'roach1', trend: 'roach', text: '天氣熱了，會飛的不只有蟑螂，還有我們的{w:serve}速度。（本店每月專業除蟲，請放心）', score: 7 },
    { id: 'quit1', trend: 'quitagent', text: '最近流行離職代辦，但我們店的員工都還在，老闆說是因為加班費有算（小編證實）。', score: 7 },
    { id: 'garb1', trend: 'garbage', text: '每天晚上八點垃圾車音樂響起，我們的 {staff} 會衝出去倒垃圾，順便回來幫你結帳。', score: 7 },
    { id: 'map1', trend: 'mapclosed', text: '如果地圖顯示我們「已歇業」，那是騙你的，我們還活著，{item} 也還活著。', score: 7 },
    { id: 'pua1', trend: 'pua', text: '我們不會跟員工說「出去外面也不會比較好」，因為外面的 {item} 真的沒有比較好。', score: 8 },
    { id: 'par1', trend: 'parentjob', text: '應徵我們店可以帶家長來，但家長要幫忙{w:chore}（開玩笑的，歡迎一起來坐坐）。', score: 7 }
  );

  // 更多網路新聞標題
  Fun.HEADLINES.push(
    '〈奇聞〉男子帶臉盆到麵店要求「自備容器折扣」，老闆：盛滿要算三碗',
    '〈網路〉一星負評理由：「老闆沒有對我笑」，網友：老闆也要先看到你付錢',
    '〈社會〉假冒消防局推銷滅火器，一支要價一萬二，消防局：我們不賣東西',
    '〈生活〉垃圾車音樂一響，整條街的人同時衝出門，外國遊客以為是演習',
    '〈職場〉員工請離職代辦公司辭職，老闆收到信才知道對方叫什麼名字',
    '〈奇聞〉外送備註「請幫我餵樓下的貓」，外送員真的餵了，網友：比我男友體貼',
    '〈網路〉某店被惡作劇改成「永久停業」，老闆在門口拉布條：「我們還活著」',
    '〈奇聞〉面試者帶媽媽應徵，媽媽問：「加班有沒有便當？」',
    '〈生活〉會飛的蟑螂出沒，網友：「牠飛過來的時候，我理解了什麼叫做人生走馬燈」',
    '〈社會〉自稱神秘客要求免費用餐，業者：神秘客不會自己說',
    '〈科技〉AI 生成的五星評論氾濫：「這家餐廳的服務如同春天的微風」',
    '〈地方〉宮廟遶境經過，店家準備的結緣飲料十分鐘被拿光',
    '〈奇聞〉客人用一整袋一元硬幣付款，店員數到懷疑人生'
  );

  Fun.STAFF_QUIPS.push(
    '剛剛那個客人用一元硬幣付了八十塊',
    '垃圾車快來了沒',
    '我媽剛剛打來問我有沒有乖',
    '如果蟑螂飛過來我就辭職',
    '今天有客人的備註是「請溫柔一點」',
    '店門口那隻貓又來了',
    '我昨天夢到我在這裡加班',
    '有人在門口直播，我入鏡了嗎',
    '剛剛有人問我們有沒有賣「普通的」',
    '我今天被叫了三次「妹妹」，我是男生'
  );
  Fun.FUNNY_REVIEWS.good.push('店員記得我的習慣，我差點哭出來', '比我前任還溫暖', '老闆的冷笑話很冷，但冷氣更冷，讚');

  // 只有吃東西的店才會遇到的奧客（理髮店、機車行不會有人「吃完才說難吃」）
  const FOOD = ['breakfast', 'noodle', 'drinks', 'store'];
  const KAREN_IND = { custom: ['drinks'], refund: FOOD, mystery: FOOD, note: FOOD, influencer: FOOD, pet: FOOD };
  for (const k of Fun.KARENS) if (KAREN_IND[k.id]) k.ind = KAREN_IND[k.id];
  // 名字裡有「先生」「小姐」「阿伯」的，長相也要對得上
  const KAREN_LOOK = { councilor: 'm', regular: 'm-old', manager: 'f', cash: 'm', refund: 'm', pet: 'f', live: 'm', fengshui: 'm-old', ai: 'm' };
  for (const k of Fun.KARENS) if (KAREN_LOOK[k.id]) [k.gender, k.old] = [KAREN_LOOK[k.id][0], KAREN_LOOK[k.id].endsWith('old')];
  Fun.FUNNY_REVIEWS.bad.push('老闆沒有對我笑，一星', '停車不方便（我把車停在店門口被拖吊）', '今天下雨，一星', '店員太有禮貌，讓我很不自在');
  Fun.COMMENTS.viral.push('這小編是天才吧', '老闆快幫小編加薪', '我笑到隔壁同事以為我在哭');
  Fun.COMMENTS.flop.push('小編是不是被盜帳號', '這篇好像我阿公會發的');

  // 路上的奇景：偶爾出現在路人頭上
  Fun.STREET_GAGS = [
    '（一位阿伯牽著鸚鵡散步）',
    '（有人穿著恐龍裝走過去）',
    '（一台改裝機車排氣管超大聲）',
    '（宣傳車：「新鮮的芒果～一斤五十～」）',
    '（一隻狗自己在過馬路，還等紅燈）',
    '（有人邊走邊用擴音講電話：「我在捷運上啦！」）',
    '（阿嬤推著菜籃車健步如飛）',
    '（一群國中生在追一隻鴿子）',
    '（有人在騎樓練習跳舞挑戰）',
    '（一位大叔對著空氣打太極拳）',
    '（外送員同時拿著五袋餐點）',
    '（有人推著嬰兒車，裡面坐的是貓）',
    '（廟口的鞭炮聲從遠方傳來）',
    '（一台車停下來問路，問完又倒車回去）',
    '（有人穿著拖鞋跑步，速度很快）',
  ];

  // ───── 奇葩事件 ─────
  const W = [
    // 店裡現場
    {
      id: 'w_basin',
      icon: '🪣',
      title: '客人帶臉盆來「自備容器」',
      text: '客人拿出一個洗臉盆：「你們不是有自備容器折五元嗎？幫我裝滿。」後面排隊的人都在偷笑。',
      industries: ['noodle', 'breakfast', 'drinks'],
      where: 'door',
      speaker: { look: 'auntie', name: '帶臉盆的客人' },
      choices: [
        { label: '「裝滿要算三份喔，折五元」', effects: { cash: 600, followers: 200 }, result: '客人想了想，真的點了三份。有人把這段拍下來，留言：「老闆好會做生意」。' },
        { label: '照一份的量裝，再折五元', effects: { morale: 1 }, result: '臉盆裡的一份看起來超可憐，客人自己也笑了。' },
        { label: '「這是臉盆欸，衛生考量不行」', effects: {}, result: '客人碎念了一下，還是換成店裡的碗。' },
      ],
    },
    {
      id: 'w_coins',
      icon: '🪙',
      title: '一整袋一元硬幣付款',
      text: '客人拿出一個塑膠袋，裡面全是一元硬幣：「八十塊，你數一下。」店員的眼神開始放空。',
      where: 'staff',
      choices: [
        { label: '收下，讓店員慢慢數', effects: { morale: -1 }, result: '店員數了十分鐘，數到第三次才確定少了兩塊。' },
        { label: '老闆親自下場數', minigame: { type: 'mash', title: '狂數一元硬幣', energy: 3, minutes: 5, need: 30, lines: ['一、二、三……'] }, effects: { morale: 3 }, result: '你數硬幣的速度快到像點鈔機，員工拍手叫好。', fail: { effects: { morale: 1 }, result: '你數到一半忘記數到哪，只好重來。客人在旁邊滑手機。' } },
        { label: '「硬幣超過五十枚可以拒收」', effects: {}, result: '客人愣了一下，改用手機付款。（法律上確實可以拒收過量硬幣，但口氣要好一點）', tip: '依中央銀行法規定，硬幣一次支付超過一百枚時，可以不予收受。' },
      ],
    },
    {
      id: 'w_drunk',
      icon: '🍺',
      title: '喝醉的大叔要跟店員比腕力',
      text: '一位喝醉的大叔晃進店裡：「少年仔，跟我比腕力，你贏了我就天天來光顧！」',
      where: 'staff',
      choices: [
        { label: '老闆接受挑戰', minigame: { type: 'mash', title: '腕力對決', energy: 8, minutes: 5, need: 35, lines: ['用力！'] }, effects: { cash: 1400, morale: 4, followers: 150 }, result: '你贏了！大叔遵守約定，隔天真的又來光顧，還說「下次再來」。', fail: { effects: { morale: 2 }, result: '大叔贏了，他得意地走了，什麼都沒點。員工笑到不行。' } },
        { label: '請他先喝杯溫開水，叫車送他回家', effects: { jerk: -1, morale: 1 }, result: '大叔握著你的手說你是好人，然後在計程車上睡著了。' },
        { label: '請他離開，保護員工', effects: { morale: 2 }, result: '大叔嘟囔著走了，店員鬆了一口氣。' },
      ],
    },
    {
      id: 'w_roach',
      icon: '🪳',
      title: '會飛的蟑螂從客人頭上飛過',
      text: '一隻會飛的蟑螂從門口飛進來，在客人頭上盤旋一圈。整間店的尖叫聲大到外面的路人都停下來看。',
      months: [4, 5, 6, 7, 8, 9, 10],
      where: 'staff',
      choices: [
        { label: '老闆親自出手', minigame: { type: 'needle', title: '一擊必殺', energy: 5, minutes: 5, rounds: 3, need: 2, lines: ['牠在左邊！', '牠飛起來了！', '牠衝過來了！'] }, effects: { morale: 4, followers: 100 }, result: '你一拖鞋解決了牠，全店爆出掌聲，有客人說要幫你申請市民英雄。', fail: { effects: { morale: -1, review: [2, '有蟑螂在飛，老闆追了五分鐘'] }, result: '牠飛進廚房就不見了。今天大家都很緊張。' } },
        { label: '請專業除蟲公司來消毒', effects: { cash: -6000, morale: 1 }, result: '除蟲公司說：「天氣熱就是這樣，你們算很乾淨了。」' },
        { label: '假裝沒看到', effects: { review: [1, '吃飯時有蟑螂從頭上飛過，店員假裝沒看到'] }, result: '有客人拍下來上傳了。' },
      ],
    },
    {
      id: 'w_cat',
      icon: '🐈',
      title: '一隻流浪貓跑進來睡在椅子上',
      text: '一隻橘貓大搖大擺走進店裡，跳上椅子就睡。客人們紛紛拿出手機拍照，完全沒有要趕牠的意思。',
      where: 'staff',
      choices: [
        { label: '收養牠，當店貓', effects: { cash: -4000, shopCat: true, morale: 5, followers: 500 }, result: '牠有名字了，叫「店長」。從今天起，很多客人說是來看店長的。', tip: '店裡有動物要注意餐飲衛生：不能進入廚房和備料區，也要定期打預防針。' },
        { label: '餵牠一點東西，讓牠自己決定', effects: { morale: 2 }, result: '牠吃飽後伸了個懶腰，從此每天下午三點準時來報到。' },
        { label: '請員工把牠抱出去', effects: { morale: -1 }, result: '員工依依不捨地把貓抱到騎樓，貓回頭看了你一眼。' },
      ],
    },
    {
      id: 'w_proposal',
      industries: ['food'],
      icon: '💍',
      title: '有人想在店裡求婚',
      text: '一位緊張的年輕人跑來說：「老闆，等一下我女朋友來，可以幫我把戒指藏在餐點裡嗎？還有，可以放我們的歌嗎？」',
      where: 'door',
      speaker: { look: 'crowd', name: '緊張的年輕人' },
      choices: [
        { label: '全力配合！員工一起幫忙', effects: { morale: 5, followers: 800, viral: 0.08 }, result: '她答應了！全店客人一起鼓掌，影片上傳後被分享了好幾千次。' },
        { label: '幫忙放歌就好，戒指不要藏在食物裡（太危險）', effects: { morale: 2, followers: 200 }, result: '他單膝下跪時，你剛好放出副歌，時機完美。' },
        { label: '「我們很忙耶」', effects: { morale: -1 }, result: '他們改去隔壁求婚了。隔壁的粉專當天漲了一千個粉絲。' },
      ],
    },
    {
      id: 'w_busker',
      icon: '🎸',
      title: '街頭藝人在店門口唱歌',
      text: '一位街頭藝人在你家門口開唱。他唱得……很有自己的風格。客人一邊等一邊皺眉，但也有人投錢。',
      where: 'door',
      speaker: { look: 'crowd', name: '街頭藝人' },
      choices: [
        { label: '請他喝飲料，拜託他移到路口', effects: { cash: -200 }, result: '他很開心地移到路口，還說下次要寫一首歌送你。' },
        { label: '讓他唱，還請他幫店裡寫一首主題曲', effects: { cash: -2000, followers: 300, morale: 2 }, result: '主題曲叫〈排隊排到天荒地老〉，旋律很洗腦，客人都在哼。' },
        { label: '報警說他擾民', effects: { morale: -1 }, result: '警察來了，看了一眼說他有街頭藝人證照。你們尷尬地對看。' },
      ],
    },
    {
      id: 'w_mango',
      industries: ['food', 'store'],
      icon: '🥭',
      title: '鄰居送來三十顆芒果',
      text: '隔壁阿姨扛來一整箱芒果：「我家的樹結太多了，吃不完，給你們！」芒果香到整間店都是。',
      months: [5, 6, 7, 8],
      where: 'door',
      speaker: { look: 'auntie', name: '隔壁阿姨' },
      choices: [
        { label: '分給員工帶回家', effects: { morale: 4 }, result: '員工們很開心，有人說今天是最幸福的上班日。' },
        { label: '做成限定芒果特餐', effects: { cash: 4000, followers: 200 }, result: '限定特餐一個下午就賣完了，阿姨來的時候你送她一份，她笑得合不攏嘴。' },
        { label: '回送她一份店裡的招牌', effects: { jerk: -1 }, result: '從此兩家的交情變得很好，阿姨還幫你介紹客人。' },
      ],
    },
    {
      id: 'w_blackout',
      icon: '🔌',
      title: '突然停電了',
      text: '啪一聲，整條街都停電了。冰箱不冷、收銀機不能開、冷氣也停了，客人在黑暗中看著你。',
      where: 'staff',
      choices: [
        { label: '點蠟燭，現金交易，繼續營業', effects: { morale: 2, followers: 200 }, result: '燭光營業意外地很有氣氛，有客人說像在約會。' },
        { label: '先暫停營業，保護店裡的東西', effects: { cash: -3000 }, result: '你把該收的都收好，一個小時後電來了，東西都沒事。' },
        { label: '叫員工繼續做，冷氣沒了也要撐', quote: '以前沒有冷氣也是這樣做啊。', effects: { morale: -5, jerk: 3 }, result: '員工滿身大汗地工作，有人差點中暑。', tip: '高溫作業環境下，雇主應提供適當的休息與防護，避免熱危害。' },
      ],
    },
    {
      id: 'w_temple',
      icon: '🏮',
      title: '宮廟遶境經過店門口',
      text: '鑼鼓喧天，遶境隊伍要經過店門口了！鞭炮、神轎、陣頭，整條街都塞住了。',
      where: 'door',
      speaker: { look: 'crowd', name: '廟方人員' },
      choices: [
        { label: '準備飲料和小點心結緣', effects: { cash: -3000, followers: 300, morale: 2 }, result: '結緣的東西十分鐘就被拿光，廟方送了你一面平安旗。' },
        { label: '暫停營業，大家出去看熱鬧', effects: { cash: -2000, morale: 5 }, result: '員工們拍了好多照片，說這是最有台灣味的一天。' },
        { label: '照常營業，關上門', effects: { review: [3, '遶境經過時店家關門，好冷漠'] }, result: '鞭炮聲中，你的店顯得特別安靜。' },
      ],
    },
    // 騙子與推銷
    {
      id: 'w_taxscam',
      icon: '☎️',
      title: '「國稅局」打電話來',
      text: '電話那頭：「這裡是國稅局，你的店有欠稅，請立刻到便利商店買點數卡繳交保證金，不然明天查封。」',
      where: 'phone',
      speaker: { look: 'caller', name: '自稱國稅局' },
      choices: [
        { label: '「好喔，我現在打 165 確認一下」', effects: { morale: 2 }, result: '對方立刻掛斷。員工們在旁邊笑翻。' },
        { label: '陪他聊天浪費他的時間', effects: { morale: 3, followers: 100 }, result: '你假裝聽不懂，讓他解釋了二十分鐘點數卡怎麼買。最後他崩潰掛電話。' },
        { label: '照他說的去買點數卡', quote: '國稅局耶，不能得罪。', effects: { cash: -20000 }, result: '你買完才覺得哪裡怪怪的。打 165 一問，果然是詐騙。', tip: '政府機關不會要求用點數卡、遊戲卡或 ATM 轉帳繳費；接到可疑電話，請撥 165 反詐騙專線查證。' },
      ],
    },
    {
      id: 'w_extinguisher',
      icon: '🧯',
      title: '「消防局」來推銷滅火器',
      text: '一個穿著像制服的人說：「我們是消防單位，你的滅火器不合格，要換新的，一支一萬二。」',
      where: 'door',
      speaker: { look: 'supplier', name: '穿制服的推銷員' },
      choices: [
        { label: '👊 物理超度', quote: '你給我出去！', note: '結果看運氣', effects: { brawl: true }, result: '' },
        { label: '「請出示證件，我打電話給消防局確認」', effects: { morale: 2 }, result: '對方說他忘了帶證件，然後很快就消失在巷口。' },
        { label: '買一支', quote: '安全第一嘛。', effects: { cash: -12000 }, result: '後來你在網路上看到，一樣的滅火器只要八百塊。', tip: '消防機關不會挨家挨戶推銷滅火器或消防設備；有疑問可以打 119 或當地消防局查證。' },
        { label: '請他離開，順便提醒隔壁店家', effects: { jerk: -1, followers: 50 }, result: '隔壁老闆說他上個月才被騙。你們在群組裡提醒大家。' },
      ],
    },
    {
      id: 'w_fakepay',
      icon: '📱',
      title: '客人說他已經用手機付款了',
      text: '客人拿出手機：「我付了啊，你看截圖。」但你的帳戶沒有收到錢，仔細一看，截圖是別家店的。',
      where: 'staff',
      choices: [
        { label: '👊 物理超度', quote: '你給我出去！', note: '結果看運氣', effects: { brawl: true }, result: '' },
        { label: '「截圖上的店名不是我們耶」', effects: { cash: 300 }, result: '客人臉一紅，說是「不小心」，然後補付了錢。' },
        { label: '報警處理', effects: { morale: 1 }, result: '警察來了之後，客人說他要再找找看，然後付了錢。' },
        { label: '算了，不跟他計較', effects: { cash: -300, morale: -1 }, result: '他很滿意地走了。員工嘆氣：「這招他應該用了很多次」。' },
      ],
    },
    {
      id: 'w_seo',
      icon: '🔍',
      title: '「讓你上搜尋第一名」的推銷電話',
      text: '電話那頭：「老闆，我們可以讓你的店在搜尋排第一名！一次付清只要四千九，保證三個月見效！」',
      where: 'phone',
      speaker: { look: 'caller', name: '網路行銷公司' },
      choices: [
        { label: '婉拒，自己經營粉專', effects: {}, result: '你掛掉電話，打開「📱 小編」分頁。' },
        { label: '簽約', note: '$4,900', effects: { cash: -9800, followers: 50 }, result: '三個月後，你的店在搜尋排第一名——搜尋「你的店名」的時候。' },
      ],
    },
    {
      id: 'w_fengshui',
      icon: '🔮',
      title: '風水大師說你的店煞氣很重',
      text: '一位穿著唐裝的大師站在門口不走：「老闆，你這店門對著路沖，煞氣很重，我這尊開光貔貅只要四萬。」',
      where: 'door',
      speaker: { look: 'investor', name: '風水大師' },
      choices: [
        { label: '🎤 跟大師過招', minigame: { type: 'roast', karen: 'fengshui', title: '奧客擂台：風水大師' }, effects: { morale: 4, followers: 300 }, result: '大師被你堵得說不出話，收起貔貅走了。員工說：「老闆你的嘴才是最強的風水」。', fail: { effects: {}, result: '大師說了一句「你會後悔的」才走，但其實什麼事都沒發生。' } },
        { label: '👊 物理超度', quote: '你給我出去！', note: '結果看運氣', effects: { brawl: true }, result: '' },
        { label: '花四萬買貔貅', quote: '寧可信其有。', note: '$40,000', effects: { cash: -80000, morale: -1 }, result: '貔貅放在櫃台上，客人都以為是招財貓的親戚。生意沒有變好。' },
        { label: '請他離開', effects: {}, result: '大師搖搖頭走了，臨走前還說了一句「血光之災」。' },
      ],
    },
    {
      id: 'w_columbarium',
      icon: '🏛️',
      title: '有人來推銷靈骨塔投資',
      text: '「老闆，現在最穩的投資就是靈骨塔，買兩個位子放兩年，轉手賺三倍！」對方拿出一本很亮的型錄。',
      where: 'door',
      speaker: { look: 'shareholder', name: '投資顧問' },
      choices: [
        { label: '「我的投資都放在店裡了」', effects: {}, result: '對方說「那你考慮看看」，留下一疊型錄。你拿來墊桌腳。' },
        { label: '投資兩個位子', effects: { cash: -60000 }, result: '兩年後，你發現根本沒有人要買。', tip: '「靈骨塔轉售獲利」是常見的詐騙手法，常以高價回收為誘餌，再要求加購或繳費。' },
      ],
    },
    // 網路上的事
    {
      id: 'w_mapclosed',
      icon: '🗺️',
      title: '地圖上你的店被標成「永久停業」',
      text: '常客打電話來：「老闆你們倒了喔？地圖上寫永久停業耶！」不知道是誰惡作劇改的，今天來客明顯變少了。',
      where: 'phone',
      speaker: { look: 'caller', name: '常客' },
      choices: [
        { label: '馬上申訴，再拍一張「我們還活著」的照片發文', effects: { followers: 400, morale: 2 }, result: '貼文標題「我們還活著」被瘋狂轉發，反而多了好多新客人。' },
        { label: '在門口掛布條「本店沒有倒」', effects: { cash: -1500, followers: 200 }, result: '路人經過都會拍照，布條成為新的打卡點。' },
        { label: '不管它，常客自然會來', effects: { demand: { mult: 0.9, months: 1 } }, result: '一個禮拜後才被改回來，這段時間少了不少新客人。' },
      ],
    },
    {
      id: 'w_wrongshop',
      icon: '📢',
      title: '爆料社團說你家有蟑螂（其實是別間）',
      text: '爆料社團有人貼了一張蟑螂照片，標題寫你的店名。但照片裡的地板顏色根本不是你家的。留言已經吵了三百則。',
      where: 'phone',
      speaker: { look: 'caller', name: '員工的朋友' },
      choices: [
        { label: '冷靜回覆，附上自家地板照片對比', effects: { followers: 300, jerk: -1 }, result: '網友比對後一面倒：「真的不是這間」，原 PO 道歉刪文，你的回覆被稱讚很有風度。' },
        { label: '請律師寄存證信函', effects: { cash: -8000 }, result: '原 PO 刪文了，但網友說你很兇。' },
        { label: '在留言區跟網友吵架', effects: { followers: -200, review: [1, '老闆在網路上跟人吵架'] }, result: '吵了一整晚，越描越黑。' },
      ],
    },
    {
      id: 'w_aireviews',
      icon: '🤖',
      title: '一堆很像 AI 寫的評論',
      text: '店的評論突然多了十則五星：「這家店的服務如同春天的微風，{w:product}宛如交響樂般和諧。」你根本沒買評論。',
      where: 'phone',
      speaker: { look: 'caller', name: '員工' },
      choices: [
        { label: '回覆：「謝謝春天的微風，但我們只是一間小店」', effects: { followers: 300, morale: 2 }, result: '你的回覆被截圖瘋傳，大家都說「這老闆好好笑」。' },
        { label: '檢舉這些評論', effects: { jerk: -1 }, result: '評論被刪了，你覺得心安理得。' },
      ],
    },
    {
      id: 'w_fakepage',
      icon: '🎣',
      title: '有人用你的店名開假粉專抽獎',
      text: '網友傳訊息問：「你們抽獎要我填信用卡卡號才能領獎是真的嗎？」原來有人用你的店名和照片開了假粉專。',
      where: 'phone',
      speaker: { look: 'caller', name: '熱心網友' },
      choices: [
        { label: '發文澄清，並向平台檢舉', effects: { followers: 200, jerk: -1 }, result: '假粉專被下架了，網友說：「還好有提醒」。' },
        { label: '報警並提醒大家撥 165', effects: { followers: 100, morale: 1 }, result: '警察說這種案子很多，謝謝你主動通報。', tip: '店家發現被冒名，可以向平台檢舉、報警，並提醒消費者不要提供信用卡和個資。' },
        { label: '不理它', effects: { review: [1, '你們的抽獎是詐騙！'] }, result: '好幾個人被騙了，還跑來你的評論區罵你。' },
      ],
    },
    {
      id: 'w_meme',
      icon: '🖼️',
      title: '你的表情被做成迷因圖',
      text: '有客人拍到你在櫃台發呆的表情，配上「當員工說他要請假」，在網路上瘋傳。',
      where: 'staff',
      choices: [
        { label: '自己拿來當粉專頭貼', effects: { followers: 1000, morale: 3 }, result: '網友：「老闆好有梗！」粉專一天漲了一千個粉絲。' },
        { label: '請原 PO 刪掉', effects: { followers: -100 }, result: '刪掉了，但截圖已經到處都是。' },
      ],
    },
    {
      id: 'w_challenge',
      icon: '🎯',
      title: '網友發起「去考倒店員」挑戰',
      text: '有人在 Threads 發起挑戰：「去這間店點最複雜的客製化，看店員會不會崩潰」。今天已經來了五組人。',
      where: 'staff',
      choices: [
        { label: '推出「挑戰者{w:set}」，做到的話拍照上牆', effects: { cash: 3000, followers: 600, morale: 1 }, result: '挑戰變成了店的特色，大家都想上牆。' },
        { label: '貼公告：「客製化最多三項，謝謝體諒」', effects: { morale: 3 }, result: '員工們鬆了一口氣，網友也說很合理。' },
        { label: '叫員工全部照做，不准抱怨', quote: '客人要什麼就給什麼。', effects: { morale: -6, jerk: 3 }, result: '員工做到手抽筋，下班時說他再也不想看到「少冰去冰」這四個字。' },
      ],
    },
    {
      id: 'w_influencer_bad',
      icon: '🎬',
      title: '網紅說「普普」，影片五十萬觀看',
      text: '一個網紅發影片評你的店：「普普啦，沒有到要排隊」。影片五十萬觀看，留言區開始有人說「這間真的很普」。',
      where: 'phone',
      speaker: { look: 'caller', name: '員工' },
      choices: [
        { label: '發文：「謝謝指教，普普的我們會繼續努力變成不普」', effects: { followers: 500 }, result: '網友說「這回覆好可愛」，反而有人說要來試試看。' },
        { label: '私訊網友要求刪影片', effects: { followers: -300, review: [2, '聽說老闆要網紅刪影片'] }, result: '網紅把私訊截圖發了限動。' },
        { label: '不回應，專心把{w:product}做好', effects: { demand: { mult: 0.95, months: 1 } }, result: '過了兩個禮拜，大家就忘了。' },
      ],
    },
    {
      id: 'w_lottery',
      icon: '🧾',
      title: '客人用你的發票中了一千萬',
      text: '一位常客衝進店裡大喊：「老闆！我用你們家的發票中了一千萬！」記者都來了。',
      where: 'door',
      speaker: { look: 'auntie', name: '中獎的常客' },
      choices: [
        { label: '恭喜她，掛上「千萬發票誕生地」的紅布條', effects: { followers: 1500, viral: 0.12 }, result: '接下來一週，整條街都在排隊買你們家的發票——順便買東西。' },
        { label: '問她可不可以分一點', effects: { morale: 2 }, result: '她笑著請全店喝飲料，說這是幸運的分享。' },
      ],
    },
    {
      id: 'w_onestar',
      icon: '⭐',
      title: '收到一則神奇的一星評論',
      text: '新的一星評論：「老闆沒有對我笑。而且今天下雨。」',
      where: 'phone',
      speaker: { look: 'caller', name: '員工' },
      choices: [
        { label: '回覆：「下雨的部分我們會跟老天爺反映」', effects: { followers: 300 }, result: '網友笑翻，這則回覆的讚數比原評論多一百倍。' },
        { label: '拍一張老闆微笑的照片回覆', effects: { followers: 200, morale: 2 }, result: '你的笑容有點僵硬，但網友說很可愛。' },
        { label: '不理它', effects: {}, result: '這則評論從此成為員工之間的梗：「老闆，笑一個」。' },
      ],
    },
    // 員工的奇葩事
    {
      id: 'w_mom_interview',
      icon: '👩‍👦',
      title: '應徵者帶媽媽來面試',
      text: '一位應徵者來面試，旁邊坐著他媽媽。媽媽先開口：「請問加班有沒有便當？我兒子不吃香菜。」',
      where: 'door',
      speaker: { look: 'auntie', name: '應徵者的媽媽' },
      choices: [
        { label: '認真回答媽媽的問題，也問兒子自己的想法', effects: { staff: 1, morale: 1 }, result: '兒子後來自己說話了，表現不錯。他上班後很認真，媽媽每週都來買東西。' },
        { label: '「我想跟應徵者本人聊」', effects: {}, result: '媽媽有點不高興，但兒子偷偷跟你比了個讚。' },
        { label: '直接說不錄取', effects: { review: [2, '面試態度很差'] }, result: '媽媽在網路上留了一則評論。' },
      ],
    },
    {
      id: 'w_quitagent',
      icon: '📨',
      title: '收到離職代辦公司寄來的信',
      text: '一封很正式的信：「您好，我們受{who}委託，代為辦理離職事宜。」你看了三遍才想起來，{who}是前幾天才來的新人。',
      // 只會發生在剛到職、還沒升職的人身上
      target: (s) => s.newestStaff(10),
      where: 'phone',
      speaker: { look: 'hq', name: '離職代辦公司' },
      choices: [
        { label: '好好結算薪水，並回信祝他順利', effects: { staff: -1, jerk: -1 }, result: '代辦公司回信：「感謝您的配合，您是我們遇過最好溝通的老闆」。' },
        { label: '「叫他自己來跟我說！」', effects: { staff: -1, jerk: 2 }, result: '代辦公司回信：「依法離職不需要當面告知」。你氣到吃不下飯。', tip: '勞工離職依法預告即可，不需要親自到場；雇主仍須結清工資，不能扣留。' },
      ],
    },
    {
      id: 'w_excuse',
      icon: '🛸',
      title: '員工的遲到理由',
      text: '員工遲到了四十分鐘，氣喘吁吁地說：「老闆，我的機車被一隻雞擋住了，牠不讓我過。」',
      where: 'staff',
      choices: [
        { label: '「那隻雞還好嗎？」', effects: { morale: 3 }, result: '員工愣了一下，然後笑出來。從此「那隻雞」成為店裡的傳說。' },
        { label: '提醒他下次早點出門', effects: {}, result: '他點點頭，隔天提早十分鐘到了。' },
        { label: '扣他一天薪水', quote: '遲到就是遲到。', effects: { morale: -5, jerk: 4, flag: 'deductWage' }, result: '遲到四十分鐘扣一天薪水，員工群組炸鍋了。', tip: '遲到扣薪應依實際遲到時間比例計算，扣全天薪水可能違反工資全額給付原則。' },
      ],
    },
    {
      id: 'w_mom_call',
      icon: '📞',
      title: '員工的媽媽打電話來關心',
      text: '電話響了：「老闆你好，我是小X的媽媽，他在你們那邊有沒有乖？有沒有吃飽？他說最近很累耶。」',
      where: 'phone',
      speaker: { look: 'auntie', name: '員工的媽媽' },
      choices: [
        { label: '「他很乖，我們會讓他好好休息」', effects: { morale: 2 }, result: '媽媽很放心。後來你發現員工確實排太多班了，幫他調整了一下。' },
        { label: '「我們是工作的地方，不是安親班」', effects: { morale: -2 }, result: '媽媽愣了一下，說了一聲「歹勢」就掛了。員工整天都很尷尬。' },
      ],
    },
    {
      id: 'w_audition',
      icon: '🌟',
      title: '員工要去參加選秀節目',
      text: '員工興奮地說：「老闆！我進了歌唱選秀節目的複賽！可以請一週假嗎？」',
      where: 'staff',
      choices: [
        { label: '准假，還幫他在店裡辦應援', effects: { morale: 6, followers: 400 }, result: '他晉級了！節目上他說：「謝謝我們老闆讓我請假」，店名被全國觀眾看到。' },
        { label: '准假，但要他找人代班', effects: { morale: 2 }, result: '他找好代班就去比賽了，雖然被淘汰，但說這是很棒的經驗。' },
        { label: '「選秀能當飯吃嗎？」', quote: '別做白日夢了。', effects: { morale: -6, jerk: 3 }, result: '他沒去比賽。後來在臉書上看到，他的對手拿了冠軍。' },
      ],
    },
    {
      id: 'w_pua',
      icon: '🧠',
      title: '員工問：「老闆，你是不是在 PUA 我？」',
      text: '你跟新來的員工說「年輕人要多吃苦」，他認真地看著你：「老闆，這是 PUA 嗎？我在網路上看到這句是經典語錄。」',
      where: 'staff',
      choices: [
        { label: '「你說得對，我收回。有問題隨時跟我說」', effects: { morale: 4, jerk: -2 }, result: '員工很意外，說他第一次遇到會道歉的老闆。' },
        { label: '「你出去外面也不會比這裡好」', quote: '別人家更慘。', effects: { morale: -6, jerk: 5 }, result: '員工默默打開了求職網站。這句話還被他發到 Threads，下面三千則留言都在罵你。' },
      ],
    },
    {
      id: 'w_birthday',
      icon: '🎂',
      title: '今天是員工的生日',
      text: '你無意間在打卡紀錄上看到，今天是一位員工的生日。他自己好像沒有跟任何人說。',
      where: 'staff',
      choices: [
        { label: '偷偷買蛋糕，打烊後給他驚喜', effects: { cash: -800, morale: 6, jerk: -1 }, result: '他看到蛋糕時愣住了，然後眼眶紅紅的說：「這是我第一次在工作的地方過生日」。' },
        { label: '讓他提早一小時下班', effects: { morale: 3 }, result: '他開心地說謝謝，跑去跟朋友吃飯了。' },
        { label: '當作不知道', effects: {}, result: '一天就這樣過去了。' },
      ],
    },
    // 街坊鄰居
    {
      id: 'w_neighbor',
      icon: '🏠',
      title: '鄰居阿姨每天來借東西',
      text: '隔壁阿姨又來了：「借一下廁所」、「借一下插座」、「你們 Wi-Fi 密碼多少？」今天她還問可不可以把她的冰箱放你們店裡。',
      where: 'door',
      speaker: { look: 'auntie', name: '隔壁阿姨' },
      choices: [
        { label: '笑笑地借她廁所，冰箱就婉拒', effects: { morale: 1 }, result: '阿姨說你人很好，然後介紹她整個社區大樓的人來{w:eat}。' },
        { label: '把 Wi-Fi 密碼改成「請先消費」', effects: { followers: 300 }, result: '阿姨看到密碼笑了，真的消費了一次。這張照片還在網路上被分享。' },
        { label: '「阿姨，我們是做生意的」', effects: { review: [2, '老闆很冷漠，連廁所都不借'] }, result: '阿姨不太高興，在社區群組說了你幾句。' },
      ],
    },
    {
      id: 'w_scooter_block',
      icon: '🛵',
      title: '有人把機車停在店門口擋住入口',
      text: '一台機車停在騎樓正中間，剛好擋住店門口。車主不知道去哪了，客人要側身才進得來。',
      where: 'staff',
      choices: [
        { label: '在車上貼一張可愛的紙條：「這裡是入口喔 ❤️」', effects: { followers: 100 }, result: '車主回來看到紙條，不好意思地移走了，還買了一杯飲料。' },
        { label: '打電話請警察拖吊', effects: {}, result: '拖吊車來的時候，車主剛好衝回來，當場跟拖吊大哥求情。' },
        { label: '叫員工把車抬走', quote: '擋路就該移。', effects: { morale: -2 }, result: '員工抬到腰痛，車主回來還說他的車被刮傷了。' },
      ],
    },
    {
      id: 'w_campaign',
      icon: '🗳️',
      title: '候選人帶著宣傳隊來掃街',
      text: '候選人帶著一群人進店裡握手、發面紙，還問你可不可以在門口掛他的旗幟。客人被擠到角落。',
      where: 'door',
      speaker: { look: 'shareholder', name: '候選人' },
      choices: [
        { label: '「歡迎光臨，但我們不掛任何人的旗子」', effects: {}, result: '候選人笑著光顧了一下，還拍照打卡。雙方都很有禮貌。' },
        { label: '掛他的旗幟', effects: { review: [2, '店門口掛政治旗幟，不太舒服'] }, result: '支持他的人來買東西，不支持的人默默走掉了。' },
        { label: '請他們不要影響客人', effects: { morale: 1 }, result: '候選人的助理連忙道歉，帶著隊伍離開了。' },
      ],
    },
    {
      id: 'w_typhoon_late',
      icon: '🌀',
      title: '颱風假半夜才宣布',
      text: '凌晨兩點，縣市長終於宣布明天放颱風假。可是你的早班員工已經設好鬧鐘，還在群組問：「老闆，明天要上班嗎？」',
      months: [7, 8, 9, 10],
      where: 'staff',
      choices: [
        { label: '「放假！大家注意安全」', effects: { morale: 5, cash: -4000, jerk: -1 }, result: '群組裡一排「謝謝老闆」的貼圖。' },
        { label: '「願意來的算加倍薪水，不來也沒關係」', effects: { morale: 2, cash: -2000 }, result: '有兩個人自願來，其他人在家休息。', tip: '颱風天停止上班並非法定假日，但雇主不得強迫出勤，也不能因此扣全勤或處罰。' },
        { label: '「店照開，都要來」', quote: '颱風又不是我放的。', effects: { morale: -7, jerk: 5 }, result: '員工冒著風雨騎車來上班，有一個人在路上差點被招牌砸到。' },
      ],
    },
    {
      id: 'w_garbage',
      icon: '🚛',
      title: '垃圾車來了，可是大家都在忙',
      text: '〈給愛麗絲〉的旋律從巷口傳來，垃圾車來了！可是店裡正忙，今天的垃圾還有三大袋。',
      where: 'staff',
      choices: [
        { label: '老闆親自衝出去追垃圾車', minigame: { type: 'mash', title: '追垃圾車', energy: 6, minutes: 3, need: 32, lines: ['快追！'] }, effects: { morale: 3 }, result: '你提著三袋垃圾狂奔，在最後一秒丟上車。清潔隊員對你比了個讚。', fail: { effects: { morale: 1 }, result: '垃圾車揚長而去，你提著垃圾站在路口，背景音樂還在響。' } },
        { label: '請一位員工去倒，你幫他顧櫃台', effects: { morale: 1 }, result: '員工回來說：「老闆你剛剛結帳好慢喔」，大家都笑了。' },
        { label: '請民營清運公司每天來收', effects: { cash: -3000, morale: 2 }, result: '從此再也不用追垃圾車了，但大家有點懷念那個旋律。' },
      ],
    },
  ];

  Data.EVENTS.push(...W);
  Fun.WEIRD_EVENTS = W;
})(typeof window !== 'undefined' ? window : globalThis);

// 一般客訴：不是每個抱怨的客人都是奧客
// legit：真的是店裡做錯（道歉補償最好；硬挺員工反而被罵）；misread：客人誤會了（好好說明最好）
(function (root) {
  const Fun = root.BossFun;
  if (!Fun) return;
  const G = (id) => (['breakfast', 'noodle'].includes(id) ? 'food' : id);
  Fun.COMPLAINTS = {
    legit: {
      food: ['湯裡撈到一根頭髮', '說好不要辣，結果做成大辣', '點了三樣只來兩樣，等了二十分鐘才發現漏單'],
      drinks: ['點微糖，喝起來根本是全糖', '珍珠沒煮透，咬起來硬硬的', '杯子封膜沒封好，在包包裡漏了一半'],
      barber: ['瀏海剪得比說好的短兩公分', '染出來的顏色跟色卡差很多', '洗頭的時候水太燙，頭皮都紅了'],
      scooter: ['剛換的煞車皮兩天就開始吱吱叫', '修完回家路上又熄火了', '說好一小時，結果等了三個小時沒人通知'],
      store: ['店員找錢少找了一百塊', '架上的便當已經過期了', '集點貼紙明明有活動，店員說沒有'],
    },
    misread: {
      food: [['等這麼久是怎樣', '他點的是要現做二十分鐘的'], ['我沒有點這個', '這是同桌朋友點的'], ['份量怎麼變少了', '他以前點的是大份']],
      drinks: [['你們的杯子會漏水', '是吸管插歪了'], ['珍珠怎麼這麼少', '他點的其實是椰果'], ['價格是不是亂漲', '他今天點的是大杯']],
      barber: [['洗頭水怎麼這麼冰', '熱水器剛好在重開，等一下就熱了'], ['怎麼要等這麼久', '他沒有預約，前面還有兩位'], ['剪太短了吧', '照片是他自己指定的']],
      scooter: [['換個機油也要這麼貴，是在坑人嗎', '他的車三萬公里沒保養，濾網都塞住了'], ['我的車被你們刮傷了', '監視器顯示是他自己騎進來時擦到的'], ['輪胎怎麼換這麼貴', '他指定要名牌胎']],
      store: [['你們找錯錢了', '他再算一次發現是自己記錯'], ['優惠怎麼沒有折', '活動昨天就結束了'], ['這個商品過期了', '他看成製造日期了']],
    },
  };
  // 選項順序打亂：不能每次都按第一個
  const shuffle = (sim, ev) => {
    const c = [...ev.choices];
    for (let i = c.length - 1; i > 0; i--) {
      const j = Math.floor(sim.rng() * (i + 1));
      [c[i], c[j]] = [c[j], c[i]];
    }
    return { ...ev, choices: c };
  };
  Fun.complaintEvent = (sim, kind, victim) => shuffle(sim, buildComplaint(sim, kind, victim));
  const buildComplaint = (sim, kind, victim) => {
    const pick = (arr) => arr[Math.floor(sim.rng() * arr.length)];
    const what = pick(Fun.COMPLAINTS[kind][G(sim.ind.id)] || Fun.COMPLAINTS[kind].food);
    const v = victim ? victim.name : '店員';
    const vid = victim ? victim.id : null;
    const mo = (d) => (vid ? { moodOf: [[vid, d]] } : {});
    if (kind === 'legit') {
      return {
        id: 'cmp_legit',
        icon: '🙇',
        title: '客人來客訴',
        text: `一位客人回來找你：「${what}。」他不是來鬧的，語氣還算客氣，但很明顯不太開心。${v}在旁邊臉色發白。`,
        choices: [
          { label: '馬上道歉、處理好，再送一份{w:gift}', effects: { cash: -800, review: [5, '有出錯，但店家處理得超好，會再來'], ...mo(2) }, result: `你先跟客人道歉，馬上處理，還多送了一點心意。客人離開前說：「謝謝，你們很有誠意。」${v}鬆了一口氣，說下次會更小心。`, tip: '客人反映的問題確實是店家疏失時，先道歉、立刻補救，通常比爭論誰對誰錯更能留住客人。' },
          { label: '道歉並退費', effects: { cash: -400, review: [3, '有退費，但感覺不太用心'] }, result: '客人收下退費，點點頭走了。沒有生氣，但大概也不會特別推薦。' },
          { label: `站在${v}這邊：「我們不可能出錯」`, effects: { review: [1, '明明是店家的錯還不承認，態度很差'], ...mo(3), jerk: 0 }, result: `客人愣了一下，拍下照片走了，晚上評論區多了一則一星。${v}很感謝你挺他，但大家心裡都知道這次確實是店裡的問題。`, tip: '保護員工很重要，但對真正的疏失，挺員工的方式是「一起扛、一起改進」，而不是否認問題。' },
          { label: `當著客人的面罵${v}`, effects: { cash: -400, review: [2, '老闆當場罵員工，看了很不舒服'], jerk: 3, ...mo(-12) }, result: `${v}低著頭一直道歉。客人反而覺得尷尬，退費後匆匆離開。` },
        ],
        ignore: { effects: { review: [1, '客訴了半天都沒人理'] }, result: '沒人處理，客人等到不耐煩，留下一星評論走了。' },
      };
    }
    return {
      id: 'cmp_misread',
      icon: '🤔',
      title: '客人說你們弄錯了',
      text: `一位客人有點激動：「${what[0]}！」${v}查了一下，小聲跟你說：「老闆，其實是……${what[1]}。」`,
      choices: [
        { label: '耐心說明，順便送一點小東西', effects: { cash: -150, review: [5, '原來是我誤會了，老闆人超好，還送我小東西'], ...mo(2) }, result: '你拿出單據慢慢解釋，客人看了一下，不好意思地笑了：「歹勢歹勢，是我搞錯了。」走之前還買了一點東西。', tip: '客人誤會時，拿出證據、語氣放軟，保住客人的面子，通常能把抱怨變成好感。' },
        { label: '不想吵，直接照他說的退費', effects: { cash: -400, ...mo(-6) }, result: `客人拿了錢就走了。${v}有點委屈：「明明不是我們的錯……」` },
        { label: '「你自己搞錯了啦！」', effects: { review: [2, '就算是我記錯，老闆口氣也太兇了吧'], jerk: 1 }, result: '你說的沒錯，但客人覺得很丟臉，留了一則酸酸的評論。' },
        { label: `叫${v}先道歉了事`, effects: { ...mo(-10), jerk: 2 }, result: `${v}照做了，但下班前一句話都沒說。明明是對的，卻要道歉。` },
      ],
      ignore: { effects: { review: [2, '反映問題沒人理，算了'] }, result: '客人等不到人處理，碎念著走了。' },
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);

// 🧾 時事客訴（虛構情境）：同一個題材有三種真相——店裡真的出錯、客人誤會、無理要求
// 線索寫在敘述裡（訂單明細、截圖日期、收款紀錄），選項文字三種真相都一樣、順序打亂：要看線索判斷，不能永遠按同一個
(function (root) {
  const Fun = root.BossFun;
  if (!Fun) return;
  const pick = (sim, arr) => arr[Math.floor(sim.rng() * arr.length)];
  // 每個題材：clue 是三種真相各自的敘述（{v} 員工、{p} 品項），evidence 是「查紀錄」看到什麼
  Fun.CASES = [
    {
      id: 'video',
      icon: '📹',
      title: '客人邊拍短影音邊抱怨',
      cond: (s) => true,
      clue: {
        mistake: '一位客人舉著手機直播：「大家看，{p}送來的時候已經灑了一半，店員還說沒事！」你看了一下櫃台，{v}剛剛確實手忙腳亂，桌上還有一灘沒擦。',
        misread: '一位客人舉著手機：「大家看，這家店態度超差，問一句就被白眼！」{v}小聲說：「我剛剛是在看出餐單，不是翻白眼……監視器可以看。」',
        unreasonable: '一位自稱「美食網紅」的客人架好手機：「我有十萬粉絲，今天這餐招待我，我就幫你們拍一支；不招待的話……我就照實拍喔。」{v}在旁邊不知道怎麼辦。',
      },
      evidence: { mistake: '監視器畫面：{v}端的時候真的晃了一下', misread: '監視器畫面：{v}低頭在看出餐單', unreasonable: '這位客人上週在別家店也是同一套說詞' },
    },
    {
      id: 'delivery',
      icon: '🛵',
      title: '外送少了一樣',
      cond: (s) => s.policy.delivery && s.ind.delivery,
      clue: {
        mistake: '外送平台轉來一則客訴：「點兩份{p}只送來一份！」你翻出這張單，訂單明細確實是兩份，但出餐單上只打勾了一份。',
        misread: '外送平台轉來一則客訴：「點兩份{p}只送來一份！」你翻出這張單，訂單明細只有一份；客人另一份是在同一時間、另一張單點的，還沒送到。',
        unreasonable: '外送平台轉來一則客訴：「飲料灑了，我要整單退費、再全部重送一次，外送員也要賠我精神損失。」附的照片是一杯完好的{p}。',
      },
      evidence: { mistake: '出餐單：第二份沒有打勾', misread: '訂單明細：這張單只有一份', unreasonable: '照片裡的{p}完好無缺' },
    },
    {
      id: 'coupon',
      icon: '🎟️',
      title: '客人拿優惠截圖要折扣',
      cond: (s) => true,
      clue: {
        mistake: '客人拿出手機：「粉專寫這週買一送一，你們店員說沒有？」你點開粉專，活動真的還掛著，小編忘了跟{v}說。',
        misread: '客人拿出手機：「粉專寫買一送一，你們店員說沒有？」你放大截圖，右上角的日期是去年這個時候。',
        unreasonable: '客人拿出三張不同的優惠截圖：「我要三個一起用，還要再打九折，不然我就給一星。」其中一張圖的字體明顯跟你們粉專不一樣。',
      },
      evidence: { mistake: '粉專：活動真的還在', misread: '截圖日期：去年', unreasonable: '其中一張截圖的字體不是你們的' },
    },
    {
      id: 'aisummary',
      icon: '🤖',
      title: '「AI 說你們有賣這個」',
      cond: (s) => true,
      clue: {
        mistake: '客人指著手機：「AI 摘要說你們今天營業到晚上十點，我專程來的，結果你們要收了？」你一查，地圖上的營業時間是你半年前沒改到的舊資料。',
        misread: '客人指著手機：「AI 說你們的招牌是松露{p}，怎麼菜單上沒有？」你看了一下，那段 AI 摘要把隔壁商圈另一家店的評論混進來了。',
        unreasonable: '客人指著手機：「AI 說你們今天全品項五折，我要用五折結帳。」畫面上的對話是他自己問 AI「如果這家店五折會怎樣」。',
      },
      evidence: { mistake: '地圖上的營業時間：半年沒更新', misread: 'AI 摘要引用的是別家店', unreasonable: '那段對話是客人自己假設的' },
    },
    {
      id: 'pay',
      icon: '📱',
      title: '行動支付扣了兩次？',
      cond: (s) => true,
      clue: {
        mistake: '客人氣沖沖地回來：「你們刷了我兩次！」你打開收款後台，同一分鐘真的有兩筆一樣的金額，{v}當時以為第一筆沒成功又按了一次。',
        misread: '客人氣沖沖地回來：「你們刷了我兩次！」你打開收款後台，只有一筆成功；他手機上的另一筆是銀行的「授權中」，幾天後會自動消失。',
        unreasonable: '客人堅持：「我付過了，你們自己系統的問題。」你打開收款後台，沒有這筆；他給你看的截圖上寫著「交易失敗」，但他不肯再付。',
      },
      evidence: { mistake: '收款後台：同一分鐘兩筆', misread: '收款後台：只有一筆成功', unreasonable: '客人的截圖寫著「交易失敗」' },
    },
  ];

  // 同一個做法在三種真相下，按鈕上看到的花費都一樣（不能從價錢猜答案）；結果才知道的額外花費放在 extraCash
  // 三種真相各自的後果。tag：apology 道歉補償、explain 查紀錄說明、firm 挺員工客氣拒絕、refund 直接退費息事寧人、blame 當眾罵員工
  const OUT = {
    mistake: {
      apology: (v) => ({ effects: { cash: -800, review: [5, '有出錯，但店家馬上道歉補救，會再來'], mood: 2, later: ['praise', 2] }, result: `你先道歉、馬上補救，還多送了一點心意。客人收起手機：「這樣處理我可以接受。」${v}也說下次會更小心。`, correct: true, tip: '客人反映的問題確實是店家疏失時，先道歉、立刻補救，通常比爭論誰對誰錯更能留住客人。' }),
      explain: (v, ev) => ({ effects: { cash: -200, extraCash: -300, review: [4, '查完發現是店家的錯，有好好道歉'] }, result: `你查了一下——${ev}。你老實承認是店裡的問題，補上了。客人雖然等了一下，但覺得你們很實在。` }),
      firm: (v) => ({ effects: { review: [1, '明明是店家的錯還硬拗'], mood: 3, later: ['viral', 3] }, result: `你堅持店裡沒錯，客人冷笑著離開。${v}很感謝你挺他，但大家心裡都知道這次確實是店裡出包。`, tip: '保護員工很重要，但對真正的疏失，挺員工的方式是「一起扛、一起改進」，而不是否認問題。' }),
      refund: () => ({ effects: { cash: -400, review: [3, '有退費，但沒有一句道歉'] }, result: '客人拿了退費就走了，沒有生氣，但大概也不會再來。' }),
    },
    misread: {
      apology: (v) => ({ effects: { cash: -800, review: [4, '店家很客氣'], mood: -5 }, result: `你直接道歉補償，客人滿意地走了。${v}有點委屈：「明明不是我們弄錯的……」` }),
      explain: (v, ev) => ({ effects: { cash: -200, review: [5, '原來是我誤會了，老闆超有耐心'], mood: 3, later: ['praise', 2] }, result: `你拿出紀錄慢慢說明——${ev}。客人看完不好意思地笑了：「歹勢歹勢，是我搞錯。」走之前還多買了一點。`, correct: true, tip: '客人誤會時，拿出證據、語氣放軟，保住客人的面子，通常能把抱怨變成好感。' }),
      firm: (v) => ({ effects: { review: [2, '就算是我搞錯，口氣也太硬了'], mood: 3 }, result: `你直接說店裡沒錯。你說的是事實，但客人覺得很丟臉，留了一則酸酸的評論。${v}倒是鬆了一口氣。` }),
      refund: (v) => ({ effects: { cash: -400, mood: -6 }, result: `你不想吵，直接退費。${v}小聲說：「明明不是我們的錯……」` }),
    },
    unreasonable: {
      apology: (v) => ({ effects: { cash: -800, mood: -8, later: ['repeat', 5] }, result: `你道歉又補償，客人心滿意足地走了。${v}看著你，什麼都沒說。聽說這招他在很多店都用過。` }),
      explain: (v, ev) => ({ effects: { cash: -200, review: [3, '店家一直跟我講道理'], mood: 2 }, result: `你拿出紀錄說明——${ev}。客人不太服氣，但也拿不出話反駁，碎念著走了。` }),
      firm: (v) => ({ effects: { review: [2, '店家不肯通融'], mood: 7, morale: 1, jerk: -1 }, result: `你客氣但堅定地說：「這個我們沒辦法。」${v}在旁邊站得直直的。旁邊的熟客小聲說：「老闆做得好。」`, correct: true, tip: '面對無理要求，客氣但堅定地拒絕、保護第一線員工，比一味讓步更能守住店的規矩和士氣。' }),
      refund: (v) => ({ effects: { cash: -400, mood: -8, later: ['repeat', 6] }, result: `你為了息事寧人直接退費。客人笑著走了，${v}嘆了一口氣。` }),
    },
  };

  Fun.caseEvent = (sim, kind, victim, themeId) => {
    const T = Fun.CASES.find((x) => x.id === themeId) || Fun.CASES[0];
    const v = victim ? victim.name : '店員';
    const vid = victim ? victim.id : null;
    const core = sim.ind.products.filter((p) => !p.side && !p.rd);
    const prod = (pick(sim, core) || { name: '餐點' }).name;
    const fill = (t) => t.replace(/\{v\}/g, v).replace(/\{p\}/g, prod);
    const ev = fill(T.evidence[kind]);
    const O = OUT[kind];
    const mk = (tag, label, quote) => {
      const o = O[tag](v, ev);
      const fx = { ...o.effects };
      if (fx.mood && vid) fx.moodOf = [[vid, fx.mood]];
      delete fx.mood;
      if (fx.later) fx.caseLater = [...fx.later, T.id];
      delete fx.later;
      return { label, quote, effects: fx, result: o.result, tip: o.tip, tag, correct: !!o.correct };
    };
    const choices = [
      mk('apology', '先道歉，補償一份{w:gift}'),
      mk('explain', '拿出紀錄跟客人一起對'),
      mk('firm', `站在${v}這邊，客氣但堅定地說明`),
      mk('refund', '不想吵，直接退費'),
      { label: `當著客人的面罵${v}`, effects: { cash: -400, review: [2, '老闆當場罵員工，看了很不舒服'], jerk: 3, ...(vid ? { moodOf: [[vid, -12]] } : {}) }, result: `${v}低著頭一直道歉。客人反而覺得尷尬，匆匆離開。`, tag: 'blame' },
    ];
    for (let i = choices.length - 1; i > 0; i--) {
      const j = Math.floor(sim.rng() * (i + 1));
      [choices[i], choices[j]] = [choices[j], choices[i]];
    }
    return {
      id: `cmp_${T.id}`,
      icon: T.icon,
      title: T.title,
      text: fill(T.clue[kind]),
      choices,
      caseKind: kind,
      caseTheme: T.id,
      ignore: { effects: { review: [kind === 'unreasonable' ? 2 : 1, '反映問題半天沒人理'] }, result: '沒人出面處理，客人留下一則評論走了。' },
    };
  };

  // 延遲後果：影片被轉傳、同一個奧客又來、客人回頭發好評
  Fun.caseFollow = {
    viral: (sim, theme) => {
      sim.demandMods.push({ mult: 0.94, days: 4 });
      sim.addReview(1, '看到影片才知道這家店出包還不認', 'image');
      sim.notify(`📉 前幾天「${(Fun.CASES.find((x) => x.id === theme) || {}).title || '客訴'}」的事被轉傳了，留言一面倒，這幾天來客少了一點。`, 'bad');
    },
    praise: (sim) => {
      sim.social.followers += 60;
      sim.addReview(5, pick(sim, ['上次有點小狀況，但店家處理得很好，今天又來了', '老闆很講理，推', '有問題好好溝通，這家店值得支持']));
      sim.notify('💬 之前客訴的那位客人又來了，還留了一則好評。', 'good');
    },
    repeat: (sim, theme) => {
      sim.caseRepeat = theme;
      sim.notify('😒 聽說上次那位客人在社團分享「怎麼跟這家店拗到東西」……', 'bad');
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
