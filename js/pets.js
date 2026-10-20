// 寵物：店寵和寵物友善。好處實在、麻煩也實在
// draw：來客加成（乘上寵物的開心程度）；mood：員工心情；calm：排隊客人的耐心；
// weekly：每週飼料和用品；vet：看一次獸醫；hygiene：餐飲業的衛生風險
(function (root) {
  const Fun = root.BossFun;
  if (!Fun) return;

  Fun.PETS = {
    cat: {
      icon: '🐈',
      name: '店貓',
      adopt: 2000,
      weekly: 800,
      vet: 2500,
      draw: 0.04,
      mood: 2,
      hygiene: 1,
      names: ['店長', '橘子', '肉圓', '米糕', '芋圓', '虎斑'],
      desc: '來客 +4%、員工心情 +2；會掉毛、跳上桌子，對貓過敏的客人會給低分',
    },
    dog: {
      icon: '🐕',
      name: '店狗',
      adopt: 3000,
      weekly: 1500,
      vet: 3500,
      draw: 0.03,
      mood: 3,
      calm: 0.1,
      hygiene: 1.2,
      walk: true,
      names: ['旺財', '來福', '黑輪', '饅頭', '柴柴', '阿福'],
      desc: '會在門口迎接客人（排隊耐心 +10%）、員工心情 +3；每天要有人帶去散步，看到外送員會一直叫',
    },
    parrot: {
      icon: '🦜',
      name: '鸚鵡',
      adopt: 8000,
      weekly: 600,
      vet: 3000,
      draw: 0.05,
      mood: 1,
      hygiene: 0.5,
      names: ['阿嘎', '小綠', '歡迎', '發財', '皮皮'],
      desc: '會說「歡迎光臨」（來客 +5%）；但會學店裡的人講話，老闆罵人牠也會學起來',
    },
    turtle: {
      icon: '🐢',
      name: '招財龜',
      adopt: 1500,
      weekly: 200,
      vet: 1500,
      draw: 0.015,
      mood: 1,
      hygiene: 0.2,
      names: ['慢慢', '長壽', '阿龜', '元寶'],
      desc: '幾乎不用照顧，長輩客人很喜歡（來客 +1.5%）；偶爾會跑不見',
    },
  };

  // 寵物的個性：影響事件
  Fun.PET_TRAITS = {
    lazy: { name: '超愛睡', desc: '整天在睡，很少闖禍' },
    naughty: { name: '調皮鬼', desc: '常常闖禍，但影片都很紅' },
    friendly: { name: '親人', desc: '客人很喜歡，常常被拍照' },
    shy: { name: '怕生', desc: '人多的時候會躲起來，壓力大容易生病' },
  };

  const nm = (p) => `${Fun.PETS[p.kind].icon}${p.name}`;

  // 店寵的事件：好的壞的都有；有些跟個性、照顧程度有關
  Fun.PET_EVENTS = [
    // 好事
    {
      ok: (s, p) => p.joy > 60 && p.trait !== 'shy',
      make: (s, p) => ({
        id: 'pet_viral',
        icon: '📸',
        title: `${nm(p)}爆紅了`,
        text: `有客人拍了一段${nm(p)}的影片：${p.kind === 'cat' ? '牠躺在收銀台上，每個客人結帳都要先摸牠一下' : p.kind === 'dog' ? '牠叼著店裡的菜單站在門口，好像在招攬客人' : p.kind === 'parrot' ? '牠用很標準的台語說「多謝光臨」' : '牠背上被小朋友貼了一張「發財」的貼紙'}。影片一天破十萬觀看。`,
        choices: [
          { label: '幫牠開一個專屬帳號', effects: { followers: 900, petJoy: [p.id, 5], demand: { mult: 1.08, months: 2 } }, result: `${p.name}的帳號粉絲比店裡的還多，很多人專程來看牠。` },
          { label: '轉發就好，不要打擾牠', effects: { followers: 400 }, result: '熱度慢慢退了，但多了一些常客。' },
        ],
        ignore: { effects: { followers: 200 }, result: '影片自己紅了一陣子。' },
      }),
    },
    {
      ok: (s, p) => p.joy > 50,
      make: (s, p) => ({
        id: 'pet_bday',
        icon: '🎂',
        title: `${nm(p)}來店裡滿一年`,
        text: `今天是${p.name}來店裡的週年紀念。常客們好像都記得，有人帶了寵物零食，還有小朋友畫了一張卡片。`,
        choices: [
          { label: '辦個小小慶生會，全店九折', note: '一天營收少一點', effects: { cash: -4000, followers: 300, morale: 4, petJoy: [p.id, 15] }, result: '店裡擠滿了來幫牠慶生的人，大家拍照拍到手機沒電。' },
          { label: '幫牠拍張照片就好', effects: { petJoy: [p.id, 5] }, result: '照片貼在收銀台旁邊。' },
        ],
        ignore: { effects: {}, result: '今天就這樣過去了。' },
      }),
    },
    {
      ok: (s, p) => p.kind === 'dog' || p.kind === 'cat',
      make: (s, p) => ({
        id: 'pet_catch',
        icon: '🏆',
        title: `${nm(p)}立大功`,
        text: p.kind === 'cat' ? `${p.name}半夜抓到了一隻老鼠，整齊地擺在店門口，好像在等你稱讚。` : `${p.name}對著一個鬼鬼祟祟的人一直叫，後來才知道那個人是附近的扒手，被警察抓到了。`,
        choices: [
          { label: '加菜獎勵牠', note: '$300', effects: { cash: -600, petJoy: [p.id, 12], morale: 2 }, result: `${p.name}吃得很滿足，員工都說牠是「最佳員工」。` },
          { label: '拍照發文', effects: { followers: 250 }, result: '網友留言：「這隻比保全還可靠。」' },
        ],
        ignore: { effects: {}, result: `${p.name}自己走開了。` },
      }),
    },
    // 壞事
    {
      ok: (s, p) => p.trait === 'naughty' || s.rng() < 0.4,
      make: (s, p) => ({
        id: 'pet_mess',
        icon: '💥',
        title: `${nm(p)}闖禍了`,
        text: p.kind === 'parrot' ? `${p.name}飛到架子上，把一整排的東西撥到地上，還對著客人大叫。` : p.kind === 'turtle' ? `${p.name}不見了，大家找了一個早上，最後在冰箱下面找到牠。` : `${p.name}跳上桌子，打翻了一位客人的${s.isFood ? '湯' : '東西'}，客人的衣服也弄髒了。`,
        choices: [
          { label: '跟客人道歉、賠償', note: '$500', effects: { cash: -1000, review: [4, '寵物闖禍，但店家處理得很好'] }, result: '客人摸摸牠的頭：「算了，牠那麼可愛。」' },
          { label: '買圍欄，營業時間隔開', note: '$3,000', effects: { cash: -6000, petCalm: p.id }, result: `${p.name}有了自己的小天地，比較少闖禍了，但看起來有點無聊。` },
        ],
        ignore: { effects: { review: [2, '店裡的寵物打翻我的東西，店員都沒處理'] }, result: '客人氣呼呼地走了。' },
      }),
    },
    {
      ok: (s, p) => p.health < 55 || (p.trait === 'shy' && s.rng() < 0.5),
      make: (s, p) => ({
        id: 'pet_sick',
        icon: '🤒',
        title: `${nm(p)}生病了`,
        text: `${p.name}今天都不吃東西，縮在角落沒有精神。${p.care < 50 ? '員工說最近好像沒有人固定在顧牠。' : ''}`,
        choices: [
          { label: '馬上帶去看獸醫', note: `$${Fun.PETS[p.kind].vet.toLocaleString()}`, effects: { cash: -Fun.PETS[p.kind].vet * 2, petHeal: p.id, morale: 2 }, result: `獸醫說還好有早點發現。${p.name}過幾天就恢復活力了。` },
          { label: '先觀察幾天', effects: { petHurt: [p.id, 15] }, result: `${p.name}還是懶懶的。` },
        ],
        ignore: { effects: { petHurt: [p.id, 20], jerk: 1 }, result: `${p.name}的狀況越來越差，常客開始問「牠怎麼了」。` },
      }),
    },
    {
      ok: (s, p) => s.isFood && Fun.PETS[p.kind].hygiene >= 1,
      make: (s, p) => ({
        id: 'pet_hair',
        icon: '🧹',
        title: '客人說吃到毛',
        text: `一位客人舉著筷子：「這是什麼？毛嗎？你們店裡有養${Fun.PETS[p.kind].name}吧？」旁邊的客人都轉過來看。`,
        choices: [
          { label: '道歉重做，之後牠不准進廚房和備料區', effects: { review: [3, '吃到毛，但店家馬上重做'], petCalm: p.id }, result: `你在廚房門口裝了一個小門，${p.name}只能在前場活動。`, tip: '依食品良好衛生規範，寵物不得進入食品製備、調理及貯存場所。' },
          { label: '「那是我們的頭髮啦」', effects: { review: [1, '吃到動物的毛還說是頭髮'], jerk: 1 }, result: '客人拍照上傳，標題是〈加毛不加價〉。' },
        ],
        ignore: { effects: { review: [1, '吃到毛沒人處理'] }, result: '客人放下筷子直接走了。' },
      }),
    },
    {
      ok: (s, p) => p.kind === 'dog',
      make: (s, p) => ({
        id: 'pet_bark',
        icon: '🗯️',
        title: `${nm(p)}對外送員狂叫`,
        text: `每次外送員來取餐，${p.name}都衝到門口狂叫。今天有一位外送員嚇到把餐盒摔在地上，還說要給店家負評。`,
        choices: [
          { label: '請訓犬師來上課', note: '$6,000', effects: { cash: -12000, petCalm: p.id }, result: `上了三堂課，${p.name}現在看到外送員會坐下來搖尾巴。` },
          { label: '重做一份餐、送外送員一杯飲料', effects: { cash: -300, review: [4, '狗狗很兇，但店家很有誠意'] }, result: '外送員收下飲料：「好啦，牠應該只是太盡責。」' },
        ],
        ignore: { effects: { review: [2, '店狗超兇，嚇死外送員'] }, result: `${p.name}繼續對每一台機車叫。` },
      }),
    },
    {
      ok: (s, p) => p.kind === 'parrot' && (s.jerk > 25 || s.scoldCount > 3),
      make: (s, p) => ({
        id: 'pet_swear',
        icon: '🦜',
        title: `${nm(p)}學會罵人了`,
        text: `${p.name}突然對著一位客人大叫：「動作快一點啦！笨蛋！」整間店安靜了三秒。那句話……好像是你上週罵員工的原話。`,
        choices: [
          { label: '尷尬道歉，從此店裡不准罵人', effects: { jerk: -2, morale: 3, review: [3, '鸚鵡會罵人，好像學老闆的'] }, result: '員工們偷偷交換眼神：鸚鵡比任何人都誠實。' },
          { label: '拍成影片「我們家鸚鵡很嗆」', effects: { followers: 500, jerk: 2, review: [2, '鸚鵡嗆客人，老闆還覺得好笑'] }, result: '影片很紅，但有人留言：「鸚鵡都會學了，可見老闆平常怎麼對員工。」' },
        ],
        ignore: { effects: { review: [2, '被鸚鵡罵笨蛋'] }, result: `${p.name}又罵了兩個客人。` },
      }),
    },
    {
      ok: (s, p) => (p.kind === 'cat' || p.kind === 'dog') && s.staff.some((e) => e.allergic),
      make: (s, p) => {
        const e = s.staff.find((x) => x.allergic);
        return {
          id: 'pet_allergy',
          icon: '🤧',
          title: `${e.name}對${Fun.PETS[p.kind].name}過敏`,
          text: `${e.name}一直打噴嚏、眼睛紅腫：「老闆，我好像對${p.name}過敏……可是我又很喜歡牠。」`,
          choices: [
            { label: '買空氣清淨機、讓牠少進出櫃台', note: '$5,000', effects: { cash: -10000, moodOf: [[e.id, 8]], allergyFix: e.id }, result: `${e.name}的症狀好多了，還是每天偷偷摸${p.name}。` },
            { label: `幫${e.name}調到離牠遠一點的位置`, effects: { moodOf: [[e.id, 3]] }, result: '暫時解決了，但店就這麼大。' },
            { label: '「忍耐一下就好」', effects: { moodOf: [[e.id, -12]], jerk: 1 }, result: `${e.name}吃了過敏藥，整天昏昏沉沉。` },
          ],
          ignore: { effects: { moodOf: [[e.id, -8]] }, result: `${e.name}的噴嚏打了一整天。` },
        };
      },
    },
  ];

  // 寵物友善政策的事件
  Fun.PET_FRIENDLY_EVENTS = [
    (s) => ({
      id: 'pf_fight',
      icon: '🐕',
      title: '兩隻客人的狗打起來了',
      text: '一隻哈士奇和一隻吉娃娃在店裡對峙，吉娃娃叫得比哈士奇還兇。兩位主人都說是對方的狗先挑釁的。',
      choices: [
        { label: '把兩隻分開，各送一份寵物零食', note: '$200', effects: { cash: -400, review: [4, '狗狗吵架，店員處理超專業'] }, result: '兩隻狗吃著零食，好像忘了剛剛在吵什麼。' },
        { label: '訂規則：寵物要上牽繩、不能下地', effects: { petPolicyStrict: true }, result: '門口貼了「寵物友善守則」，之後安靜多了，但來的毛孩少了一點。' },
      ],
      ignore: { effects: { review: [2, '一堆狗在店裡吵架'] }, result: '兩隻狗吵到其他客人都走了。' },
    }),
    (s) => ({
      id: 'pf_pee',
      icon: '💦',
      title: '有狗狗在店裡尿尿',
      text: '一隻柯基在座位旁邊尿了一攤，主人尷尬地說：「牠平常都不會這樣……」旁邊的客人捏著鼻子換位子。',
      choices: [
        { label: '拿出寵物專用清潔劑，笑著說沒關係', effects: { review: [4, '寵物友善做得很到位'], cash: -200 }, result: '柯基的主人感動到加點了兩份。' },
        { label: '請主人自己清理', effects: { review: [3, '寵物尿尿要主人自己清，合理'] }, result: '主人默默拿衛生紙清理。' },
      ],
      ignore: { effects: { review: [1, '店裡有狗尿味'], dirt: 2 }, result: '味道飄了一個下午。' },
    }),
    (s) => ({
      id: 'pf_allergy',
      icon: '🤧',
      title: '過敏的客人抗議',
      text: '一位客人一進門就一直打噴嚏：「你們店裡怎麼這麼多貓狗？我對毛過敏，連坐的位子都沒有！」',
      choices: [
        { label: '劃分「無毛孩區」', note: '$3,000', effects: { cash: -6000, petZone: true }, result: '店裡多了一塊無毛孩區，過敏的客人也能安心坐。' },
        { label: '「我們是寵物友善店喔」', effects: { review: [2, '寵物友善卻對過敏的人不友善'] }, result: '客人轉身離開，在評論區寫了一大段。' },
      ],
      ignore: { effects: { review: [2, '店裡都是毛，過敏的人不要來'] }, result: '客人戴上口罩走了。' },
    }),
    (s) => ({
      id: 'pf_meetup',
      icon: '🐾',
      title: '柯基同好會想來包場',
      text: '一個柯基社團想在週末來店裡辦聚會，預計會來三十隻柯基和四十個人。社團說會幫忙宣傳。',
      choices: [
        { label: '包場！準備寵物餐', note: '大單', effects: { cash: 16000, followers: 700, dirt: 4 }, result: '三十隻柯基的短腿在店裡跑來跑去，照片洗版了整個社群。打掃到半夜，但很值得。' },
        { label: '開放一半的座位', effects: { cash: 6000, followers: 250 }, result: '一般客人和柯基各佔一半，意外地和諧。' },
        { label: '婉拒', effects: {}, result: '社團轉去別家。' },
      ],
      ignore: { effects: {}, result: '社團等不到回覆。' },
    }),
  ];
})(typeof window !== 'undefined' ? window : globalThis);
