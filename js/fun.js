// 笑料與時事：奧客擂台、小編蹭時事、網友留言、新聞標題、員工碎念
// 品牌一律用「某某大廠」這種寫法，不指名真實的公司或人物
(function (root) {
  // ───── 奧客擂台：每個奧客三回合，選一句回嘴 ─────
  // great：又好笑又有分寸（觀眾爆笑）；ok：安全牌；over：太超過（觀眾倒抽一口氣）
  const KARENS = [
    {
      id: 'councilor',
      name: '「我朋友是議員」先生',
      icon: '🕴️',
      rounds: [
        { line: '你知道我朋友是誰嗎？議員！', great: '太好了，那請議員幫我們爭取一下基本工資調漲，謝謝。', ok: '好的，那議員朋友要一起點嗎？', over: '議員也救不了你的品味。' },
        { line: '我要給你們一星！', great: '沒問題，順便幫我們打卡，演算法很需要你。', ok: '一星也是星，謝謝您的支持。', over: '你的評論大家早就封鎖了啦。' },
        { line: '我吃了這麼多年，從來沒遇過這種服務！', great: '那您今天很幸運，解鎖了新成就。', ok: '我們會再改進，謝謝指教。', over: '那你以後可以不要再來了。' },
      ],
    },
    {
      id: 'influencer',
      name: '五十萬粉絲網紅',
      icon: '🤳',
      rounds: [
        { line: '我有五十萬粉絲，這餐請我，我幫你們宣傳。', great: '我們有五十萬的電費帳單，可以請你的粉絲幫忙付嗎？', ok: '謝謝，但我們不接業配喔。', over: '五十萬殭屍粉也算粉嗎？' },
        { line: '燈光太暗了，你們可以幫我把冷氣跟燈都打開嗎？', great: '可以，電費我們開發票給您，抬頭寫網紅工作室？', ok: '我幫您換到窗邊的位置。', over: '你的臉已經很亮了，濾鏡開太多。' },
        { line: '不請我我就發文說你們很難吃。', great: '好呀，記得標註我們，最近剛好缺曝光。', ok: '我們尊重每一位客人的評價。', over: '你發啊，看誰的粉絲比較多。' },
      ],
    },
    {
      id: 'regular',
      name: '「我常來耶」阿伯',
      icon: '👴',
      rounds: [
        { line: '我常來耶，這個加料不用錢吧？', great: '您常來我們很感動，感動到想送您一張集點卡——要付錢的那種。', ok: '常客我們給您加大，加料還是要算喔。', over: '常來不代表常付錢啊。' },
        { line: '以前老闆都會送我一杯！', great: '以前的老闆退休了，現在的老闆還在還裝潢貸款。', ok: '下次集滿點數就送您一杯。', over: '那你去找以前的老闆啊。' },
        { line: '我在這附近住三十年了！', great: '阿伯，物價也漲三十年了，我們一起努力。', ok: '謝謝您三十年的照顧！', over: '住三十年也沒有比較便宜喔。' },
      ],
    },
    {
      id: 'manager',
      name: '「叫你們老闆出來」小姐',
      icon: '💅',
      rounds: [
        { line: '叫你們老闆出來！', great: '我就是老闆，請問要客訴還是要應徵？', ok: '我是負責人，請問有什麼需要幫忙的？', over: '老闆今天不想上班，跟你一樣不想講道理。' },
        { line: '你們員工態度很差！', great: '他已經被您罵了十分鐘還在微笑，這是全台灣最好的態度了。', ok: '我了解，我們來看看可以怎麼處理。', over: '他態度差是被你逼的。' },
        { line: '我要打 1999 檢舉你們！', great: '好的，順便幫我們反映一下這條路的路燈壞了。', ok: '您可以反映，我們也會配合說明。', over: '1999 也聽不懂你在講什麼。' },
      ],
    },
    {
      id: 'custom',
      name: '客製化地獄',
      icon: '🧊',
      rounds: [
        { line: '我要半糖少冰去冰、不要太甜但要有味道，杯子要可愛的。', great: '好的，一杯量子態飲料，同時有冰又沒有冰。', ok: '幫您做微糖去冰，杯子我挑最可愛的。', over: '你要不要自己進來做？' },
        { line: '你剛剛是不是翻白眼？', great: '沒有，我在努力回想「少冰去冰」的物理定義。', ok: '不好意思，我只是在看點單。', over: '有，而且翻了兩次。' },
        { line: '這杯味道跟我想的不一樣！', great: '那請問您想的那一杯，現在方便描述一下嗎？我們研發部很缺靈感。', ok: '我幫您重做一杯。', over: '你想的東西我們做不出來啦。' },
      ],
    },
    {
      id: 'ai',
      name: '「AI 說的」工程師',
      icon: '🤖',
      rounds: [
        { line: '我問過 AI，它說你們這個應該要更便宜。', great: '那請 AI 幫您煮，我們幫它開發票。', ok: '我們的價格都有照成本計算喔。', over: 'AI 還說你應該少說兩句。' },
        { line: '你們怎麼還沒用 AI 點餐？太落伍了。', great: '有啊，我們的 AI 叫做「阿姨」，記得每個常客的口味。', ok: '我們還是喜歡跟客人面對面。', over: '用了 AI 就不用聽你講話了。' },
        { line: '我覺得你們可以被 AI 取代。', great: '可以啊，等 AI 學會拖地、修冰箱、被罵還微笑，我們就退休。', ok: '我們會持續學習新東西的。', over: '你的工作應該先被取代。' },
      ],
    },
    {
      id: 'photo',
      name: '只拍照不點餐團',
      icon: '📸',
      rounds: [
        { line: '我們只是拍照，不點東西喔，座位借一下。', great: '沒問題，拍照一張低消一杯，網美價打八折。', ok: '尖峰時間座位要留給用餐的客人喔。', over: '這裡不是攝影棚，出去拍。' },
        { line: '可以幫我們拍嗎？要拍出腿長一百八。', great: '可以，但腿長一百八要加價，那是進階修圖方案。', ok: '好啊，我幫你們拍幾張。', over: '腿長一百八要先投胎。' },
        { line: '你們店的光線不太 IG 耶。', great: '我們的燈是用來看清楚帳單的，不是看清楚毛孔的。', ok: '窗邊的光線比較好喔。', over: '你的臉不太 IG 耶。' },
      ],
    },
    {
      id: 'cash',
      name: '「找零錢」大叔',
      icon: '🪙',
      rounds: [
        { line: '我要用一千塊付三十五塊，零錢給我新鈔。', great: '好的，我們順便幫您換成紅包袋，提前祝您新年快樂。', ok: '我找給您，新鈔可能沒有那麼多喔。', over: '要新鈔去銀行啦。' },
        { line: '可以用比特幣付嗎？', great: '可以，但要等區塊確認，您的蛋餅可能會先涼掉。', ok: '我們有收電子支付喔。', over: '用比特幣買蛋餅，你很會理財喔。' },
        { line: '發票幫我打統編，我念給你聽喔……', great: '好的，請慢慢念，後面排隊的十個人都在幫您加油。', ok: '好的，您也可以存手機條碼比較快。', over: '你念完店都要打烊了。' },
      ],
    },
  ];

  // ───── 時事：每週都有新話題，越早蹭越紅 ─────
  // months：只在這些月份出現；ind：只適合某些產業；risky：蹭了容易被罵
  const TRENDS = [
    { id: 'evcar', icon: '🏎️', name: '電動跑車發表會', desc: '某電動車大廠發表新跑車，零百加速兩秒多，網路吵翻天。' },
    { id: 'furniture', icon: '🪑', name: '家具大廠小編蹭時事爆紅', desc: '某家具大廠的小編拿電動跑車開玩笑，貼文分享破十萬，各品牌搶著跟風。' },
    { id: 'heat', icon: '🥵', name: '熱到破紀錄', desc: '氣象署說今天是有紀錄以來最熱的一天，網友：「我在融化」。', months: [6, 7, 8, 9] },
    { id: 'typhoon', icon: '🌀', name: '颱風假之亂', desc: '縣市長半夜才宣布放不放颱風假，網友在留言區集氣。', months: [7, 8, 9, 10] },
    { id: 'egg', icon: '🥚', name: '雞蛋又漲價', desc: '蛋價再創新高，網友：「以後蛋餅要改叫餅。」', ind: ['breakfast', 'noodle', 'store'] },
    { id: 'concert', icon: '🎤', name: '演唱會搶票大戰', desc: '天團開唱，五十萬人搶一萬張票，黃牛票炒到十倍。' },
    { id: 'matcha', icon: '🍵', name: '抹茶熱潮', desc: '抹茶口味突然爆紅，連鹹酥雞都出了抹茶粉。' },
    { id: 'aiboss', icon: '🤖', name: 'AI 取代人類？', desc: '某科技大廠說 AI 三年內會取代一半工作，網友：「先取代我老闆」。' },
    { id: 'gold', icon: '🥇', name: '國手奪金', desc: '台灣選手在國際賽事奪金，全台一起熬夜看轉播。' },
    { id: 'payfreeze', icon: '💸', name: '薪水凍漲', desc: '調查說今年有三成公司不調薪，網友：「物價在漲，只有薪水在冬眠」。' },
    { id: 'bonus', icon: '🧧', name: '年終獎金比較大會', desc: '某晶片大廠年終領幾十個月，其他人默默打開求職網站。', months: [1, 2, 12] },
    { id: 'game', icon: '🎮', name: '抓寶遊戲新版本', desc: '手機抓寶遊戲大改版，公園又擠滿了低頭族。' },
    { id: 'mbti', icon: '🔤', name: 'MBTI 戀愛配對', desc: '交友軟體開始用 MBTI 配對，I 人和 E 人吵成一團。' },
    { id: 'quietquit', icon: '🛋️', name: '躺平與安靜離職', desc: '年輕人流行「安靜離職」：準時下班、不回訊息，老闆們崩潰。' },
    { id: 'drinkhike', icon: '🧋', name: '手搖飲集體漲價', desc: '一杯珍奶破八十，網友：「我寧可喝白開水……好啦還是要喝」。', ind: ['drinks', 'breakfast', 'store'] },
    { id: 'moon', icon: '🥮', name: '中秋烤肉', desc: '中秋節到了，全台灣的騎樓都在烤肉。', months: [9] },
    { id: 'xmas', icon: '🎄', name: '交換禮物地獄', desc: '公司尾牙交換禮物，有人抽到一包衛生紙。', months: [12] },
    { id: 'quake', icon: '🫨', name: '半夜地震', desc: '凌晨一個大地震，大家在社群上互報平安。', risky: true },
    { id: 'election', icon: '🗳️', name: '選舉吵翻天', desc: '選戰白熱化，每個人的動態都在吵架。', risky: true },
  ];

  // ───── 小編貼文素材：開頭 + 內容 + 結尾 ─────
  // {shop} 店名、{item} 招牌品項、{price} 價格、{staff} 員工名字
  const POST_HOOKS = [
    { id: 'breaking', text: '【號外號外】', score: 2 },
    { id: 'confess', text: '小編今天要自首，', score: 3 },
    { id: 'boss', text: '老闆說不能發這篇，但我還是發了。', score: 4 },
    { id: 'poll', text: '問大家一個問題：', score: 2 },
    { id: 'cry', text: '今天的小編很厭世。', score: 3 },
    { id: 'plain', text: '各位好，', score: 1 },
  ];

  // 通用內容；trend 指定的才算有蹭到時事
  const POST_BODIES = [
    { id: 'menu', text: '{item} 今天也是 ${price}，沒漲價，因為老闆忘記了。', score: 3 },
    { id: 'staff', text: '{staff} 今天被誇可愛，現在整個人在飄，出餐速度變兩倍。', score: 4 },
    { id: 'karen', text: '感謝今天那位要「半糖少冰去冰」的客人，我們研發出了量子飲料。', score: 4 },
    { id: 'promo', text: '來店說「小編好帥」打九折（小編其實是阿姨）。', score: 4 },
    { id: 'honest', text: '我們不是最好吃的，但我們是這條街上最努力的。', score: 2 },
    { id: 'hardsell', text: '快來買！快來買！快來買！好吃！便宜！大碗！', score: 0 },
    { id: 'stolen', text: '（隨便抓一張網路上很紅的梗圖貼上去）', score: 3, risky: 0.5, riskText: '被抓到盜用圖片，原作者留言要求下架' },
    // 蹭時事
    { id: 'evcar1', trend: 'evcar', text: '電動跑車零百加速兩秒，我們的 {item} 零到出餐也只要兩分鐘，而且不用排隊等交車。', score: 7 },
    { id: 'evcar2', trend: 'evcar', text: '我們的外送機車也是電動的，最高速度看外送員心情。', score: 6 },
    { id: 'furn1', trend: 'furniture', text: '大家都在蹭跑車，那我們蹭蹭那個蹭跑車的家具店：我們的塑膠椅也可以自己組裝，零件只有一個。', score: 8 },
    { id: 'furn2', trend: 'furniture', text: '小編也想學別人蹭時事，但老闆說預算只夠蹭一張發票。', score: 6 },
    { id: 'heat1', trend: 'heat', text: '外面 38 度，店裡冷氣 26 度，{item} 冰到你懷疑人生。', score: 7 },
    { id: 'heat2', trend: 'heat', text: '站在機器前的 {staff} 表示：外面熱？我每天都在這個溫度上班。', score: 6 },
    { id: 'ty1', trend: 'typhoon', text: '颱風假放不放還不知道，但我們確定有開，{item} 陪你一起等宣布。', score: 7 },
    { id: 'ty2', trend: 'typhoon', text: '颱風天不用來沒關係，我們不會出門，你也不要出門，外送員也要平安。', score: 6 },
    { id: 'egg1', trend: 'egg', text: '蛋價又漲了，但我們的 {item} 份量沒有縮水，請放心，老闆沒有在減肥。', score: 7 },
    { id: 'egg2', trend: 'egg', text: '今日特價：空氣{item}，只要 $0（騙你的啦）。', score: 6 },
    { id: 'con1', trend: 'concert', text: '演唱會搶不到票沒關係，來店裡排隊也能體驗大排長龍的感覺。', score: 7 },
    { id: 'con2', trend: 'concert', text: '{staff} 搶票搶到手機當機，今天臉很臭，請大家多點餐安慰她。', score: 6 },
    { id: 'mat1', trend: 'matcha', text: '大家都在出抹茶口味，我們決定不跟風——因為抹茶粉太貴了。', score: 7 },
    { id: 'mat2', trend: 'matcha', text: '抹茶 {item}？小編問過老闆了，老闆說：「你被開除了」。', score: 6 },
    { id: 'ai1', trend: 'aiboss', text: 'AI 可以取代很多工作，但取代不了 {staff} 看到熟客就知道你要什麼的那個眼神。', score: 7 },
    { id: 'ai2', trend: 'aiboss', text: '我們問 AI 怎麼讓生意變好，它說「降價、加薪、多休假」，老闆把 AI 關掉了。', score: 8 },
    { id: 'gold1', trend: 'gold', text: '恭喜國手奪金！今天穿運動服來店，{item} 加大不加價！', score: 7 },
    { id: 'pay1', trend: 'payfreeze', text: '大家薪水凍漲，我們價格也凍漲，凍到老闆都在發抖。', score: 7 },
    { id: 'pay2', trend: 'payfreeze', text: '別的公司凍漲，我們今年有幫員工調薪喔（老闆叫我寫的，但這是真的）。', score: 6 },
    { id: 'bonus1', trend: 'bonus', text: '別人年終幾十個月，我們年終幾十顆茶葉蛋，但每一顆都是老闆親手滷的。', score: 7 },
    { id: 'game1', trend: 'game', text: '店門口出現稀有寶可……喔不對，是稀有的準時下班員工。', score: 7 },
    { id: 'mbti1', trend: 'mbti', text: 'I 人請外帶、E 人請內用，{staff} 是 E 人，會陪你聊到你吃完。', score: 7 },
    { id: 'quiet1', trend: 'quietquit', text: '我們店不用安靜離職，因為我們準時下班是寫在班表上的。', score: 7 },
    { id: 'drink1', trend: 'drinkhike', text: '飲料都在漲，我們的 {item} 還是 ${price}，老闆說他要撐到最後一顆珍珠。', score: 7 },
    { id: 'moon1', trend: 'moon', text: '中秋烤肉缺飲料？缺小菜？缺一個會烤肉的朋友？前兩個我們有。', score: 7 },
    { id: 'xmas1', trend: 'xmas', text: '交換禮物不知道送什麼？送 {item} 兌換券，至少不會是衛生紙。', score: 7 },
    { id: 'quake1', trend: 'quake', text: '地震好可怕，但 {item} 打八折更可怕！快來搶！', score: 5, risky: 0.6, riskText: '網友覺得拿災難做行銷很不妥' },
    { id: 'elect1', trend: 'election', text: '不管你支持誰，大家都需要吃飯；投給 {item} 一票吧！', score: 5, risky: 0.35, riskText: '留言區兩派人馬吵了起來，店被貼標籤' },
  ];

  const POST_ENDINGS = [
    { id: 'tag', text: '#小編加薪 #老闆不要看', score: 3 },
    { id: 'share', text: '分享這篇抽一位送 {item}！', score: 3, cost: 800 },
    { id: 'emoji', text: '🥹🥹🥹', score: 2 },
    { id: 'call', text: '今天來店報暗號「我是脆友」送小菜。', score: 3, cost: 500 },
    { id: 'serious', text: '感謝大家長期以來的支持與愛護。', score: 1 },
    { id: 'beg', text: '拜託按讚，小編績效靠你了。', score: 2 },
  ];

  // 網友留言：依貼文表現挑
  const COMMENTS = {
    viral: ['笑死，小編到底幾歲', '這個小編要加薪', '已分享，我朋友都在問這間在哪', '這間我去過！老闆人超好', '品牌界的清流', '小編是不是在報復老闆', '蹭得太自然了吧', '我是被演算法推來的，但我留下來了'],
    good: ['好想吃', '明天去', '小編好可愛', '這句我笑了', '標記一個要請客的朋友', '去過，真的好吃'],
    meh: ['喔', '已讀', '所以有優惠嗎', '這是業配嗎？', '小編今天是不是沒睡飽', '路過'],
    flop: ['……', '這篇是 AI 寫的嗎', '小編你還好嗎', '老闆你確定要讓他發文嗎', '好冷'],
    fire: ['這種時候拿這個開玩笑？', '已檢舉', '取關了', '品牌形象呢？', '小編可以下去了', '截圖了，等著上新聞'],
  };

  // 網路新聞標題（每週會出現幾則）
  const HEADLINES = [
    '〈熱議〉網友發起「準時下班挑戰」，老闆們集體崩潰',
    '〈獨家〉AI 店長上線三天被客人罵到當機，工程師：它需要放假',
    '〈奇聞〉男子用一千元付三十五元早餐，要求找新鈔，店員淡定拿出紅包袋',
    '〈調查〉七成上班族「靠手搖飲續命」，營養師：那不是水',
    '〈爆紅〉某店小編自曝「老闆不准發這篇」，按讚數破萬，老闆：我真的沒說',
    '〈生活〉物價上漲，網友曬「三十年前的蛋餅收據」，一份只要 15 元',
    '〈職場〉員工問「加班費呢」，老闆回「我們是一家人」，網友：那我要分遺產',
    '〈趨勢〉年輕人求職第一個問題：「有沒有週休二日？」第二個：「是真的嗎？」',
    '〈熱門〉「奧客語錄」大賞出爐，第一名：「我朋友是議員」',
    '〈科技〉某科技大廠推出 AI 點餐機，阿嬤：我講台語它聽不懂',
    '〈時事〉家具大廠蹭電動跑車爆紅，行銷教授：蹭時事要快、要好笑、還要不踩雷',
    '〈天氣〉今天熱到騎樓的狗都在排隊吹冷氣',
  ];

  // 員工的厭世碎念（加到想法泡泡裡）
  const STAFF_QUIPS = ['下班要去追劇', '今天的我是社畜', '好想躺平', '我要辭職去當 YouTuber（明天再說）', '客人說要「少冰去冰」是什麼意思', '我的 MBTI 是 I，今天講了三百句話', '薪水入帳的那一刻是我最快樂的時候', '剛剛那個客人好像我前任', '老闆今天心情好像不錯，可以趁機要求加薪嗎', '這週末一定要去看演唱會'];

  // 搞笑評論
  const FUNNY_REVIEWS = {
    good: ['老闆很帥，但這不是重點，重點是很好吃', '店員笑起來像我前任，但我還是給五星', '吃完心情變好，連老闆的冷笑話都覺得好笑', '本來只是來躲雨，結果吃了三份'],
    bad: ['等太久，我在排隊時讀完了一本小說', '店員看起來比我還累，我都不好意思催', '價格比我的薪水漲得還快'],
  };

  // 時事搞笑事件（跟一般事件放在一起抽）
  const FUN_EVENTS = [
    {
      id: 'f_threads',
      icon: '📱',
      title: '員工的貼文爆紅了',
      text: '員工在社群上發文：「我們老闆今天又請大家喝飲料，還說加班一定給加班費。」按讚破萬，留言都在問有沒有缺人。',
      where: 'staff',
      choices: [
        { label: '在留言區回：「有缺人，歡迎來應徵」', effects: { morale: 4, jerk: -2, followers: 600 }, result: '店的帳號跟著漲粉，應徵信件塞爆信箱。' },
        { label: '請他把貼文刪掉，怕被說炒作', effects: { morale: -3, jerk: 1 }, result: '員工默默刪文，留言區有人說：「是不是被逼的？」' },
      ],
    },
    {
      id: 'f_aisales',
      icon: '🤖',
      title: 'AI 點餐機推銷員上門',
      text: '推銷員說：「這台 AI 點餐機可以取代三個員工，還不會請假、不會要求加薪！」旁邊的員工臉都綠了。',
      where: 'door',
      speaker: { look: 'investor', name: 'AI 推銷員' },
      choices: [
        { label: '問它：「那它會幫我算加班費嗎？」', effects: { morale: 3 }, result: '推銷員愣了三秒：「……這個要另外加購模組。」員工們笑翻了。' },
        {
          label: '買！以後就不用那麼多人了',
          quote: '機器不會抱怨，多好。',
          effects: { cash: -30000, morale: -8, jerk: 5 },
          result: 'AI 點餐機上線第一天就把「去冰」聽成「去死」，客人嚇跑一半。',
        },
        { label: '婉拒，我們的店靠人情味', effects: { morale: 2, jerk: -1 }, result: '員工們偷偷鬆了一口氣。' },
      ],
    },
    {
      id: 'f_concert',
      icon: '🎤',
      title: '員工要請假搶演唱會門票',
      text: '「老闆！明天中午十二點天團開賣，我可以請一小時假嗎？我已經準備好三支手機和兩台電腦了！」',
      where: 'staff',
      choices: [
        { label: '准假，還幫他一起搶', effects: { morale: 5, jerk: -1 }, result: '你們搶到了！他說要送你一張簽名海報（他自己畫的）。' },
        { label: '准假，但要扣一小時薪水', effects: { morale: 0 }, result: '他點點頭，這很合理。結果還是沒搶到。' },
        { label: '「上班時間搶什麼票！」', quote: '你是來上班還是來追星的？', effects: { morale: -5, jerk: 3 }, result: '他上班時一直偷看手機，眼眶有點紅。', tip: '員工可以依法請事假（不給薪），雇主不能因為請假就給予不利處分。' },
      ],
    },
    {
      id: 'f_mbti',
      icon: '🔤',
      title: '員工想照 MBTI 排班',
      text: '「老闆，我是 I 人，可以讓我顧後台不要接客人嗎？E 人去櫃檯比較好啦！」其他員工開始互相測 MBTI。',
      where: 'staff',
      choices: [
        { label: '好啊，大家各自挑喜歡的位置', effects: { morale: 4 }, result: '店裡突然變得很和諧，E 人在櫃檯跟客人聊得超開心。' },
        { label: '「我是 ESTJ，聽我的」', effects: { morale: -1 }, result: '大家翻了個白眼，但還是乖乖上工。' },
      ],
    },
    {
      id: 'f_fivestar',
      icon: '⭐',
      title: '有人推銷「洗五星評論」套餐',
      text: '電話那頭說：「老闆，三千塊幫你洗一百則五星評論，保證真人帳號，還會寫『老闆很帥』！」',
      where: 'phone',
      speaker: { look: 'caller', name: '行銷公司' },
      choices: [
        { label: '婉拒，靠實力', effects: { jerk: -1 }, result: '你掛掉電話，繼續專心顧店。' },
        {
          label: '買一百則五星',
          quote: '大家都在洗，不洗就輸了。',
          effects: { cash: -3000, fakeReviews: 20, jerk: 3 },
          result: '評價突然變好看了。但有網友發現一百則評論都寫「老闆很帥」，而且你根本沒露過臉。',
          tip: '購買虛假評論可能違反公平交易法的不實廣告規定，被抓到也會重傷商譽。',
        },
      ],
    },
    {
      id: 'f_tiktok',
      icon: '🎬',
      title: '客人在店裡拍短影音挑戰',
      text: '一群學生在店門口跳最新的舞蹈挑戰，擋住了排隊的客人，但影片好像有點紅。',
      where: 'door',
      speaker: { look: 'crowd', name: '跳舞的學生' },
      choices: [
        { label: '加入他們一起跳！', minigame: { type: 'mash', title: '老闆跳舞挑戰', energy: 5, minutes: 10, need: 25, lines: ['跟上節奏！'] }, effects: { followers: 1200, morale: 4 }, result: '老闆跳舞的影片爆紅，留言區：「這個老闆好可愛」。', fail: { effects: { followers: 300, morale: 2 }, result: '你同手同腳，影片還是有點紅——因為大家在笑。' } },
        { label: '請他們移到旁邊拍', effects: {}, result: '學生們很有禮貌地移開了，還幫你標註了店家。' },
        { label: '叫他們離開', effects: { followers: -100 }, result: '影片最後出現你揮手趕人的畫面，被做成迷因。' },
      ],
    },
    {
      id: 'f_trendboss',
      icon: '🧑‍💼',
      title: '老闆被同業嘲笑「不會蹭時事」',
      text: '同業公會的群組裡，別家老闆在炫耀小編蹭時事爆紅：「你們家連粉專都沒在經營喔？」',
      where: 'phone',
      speaker: { look: 'shareholder', name: '同業老闆' },
      choices: [
        { label: '回：「我們家小編很強，等著看」', effects: { flag: 'trendDare' }, result: '說出口了，現在只能到「📱 小編」分頁發一篇好文了。' },
        { label: '已讀不回', effects: {}, result: '群組安靜了三秒，然後大家繼續傳長輩圖。' },
      ],
    },
  ];

  root.BossFun = { KARENS, TRENDS, POST_HOOKS, POST_BODIES, POST_ENDINGS, COMMENTS, HEADLINES, STAFF_QUIPS, FUNNY_REVIEWS, FUN_EVENTS };
  // 時事事件加進一般事件池
  if (root.BossData) root.BossData.EVENTS.push(...FUN_EVENTS);
})(typeof window !== 'undefined' ? window : globalThis);
