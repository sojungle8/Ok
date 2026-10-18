// 遊戲資料：產業設定與事件。
// 事件中的 cash 以「手搖飲店規模」為單位撰寫，結算時會乘上產業的 scale。
// effects 可以是物件，也可以是 (game) => 物件（例如依員工人數計算）。
(function (root) {
  const INDUSTRIES = [
    {
      id: 'drinks',
      name: '手搖飲店',
      icon: '🧋',
      desc: '利潤薄、工讀生多，夏天排隊排到馬路上。',
      scale: 1,
      cash: 450000,
      staff: 6,
      maxStaff: 12,
      wage: 30000,
      rps: 62000, // 每位員工每月可創造的營收（產能）
      demand: 420000, // 市場每月需求上限
      fixed: 165000, // 房租、原物料、水電等固定成本
      volatility: 0.08,
      season: [0.85, 0.9, 0.95, 1, 1.1, 1.2, 1.25, 1.2, 1.05, 0.95, 0.9, 0.85],
    },
    {
      id: 'tech',
      name: '科技新創',
      icon: '💻',
      desc: '薪水高、燒錢快，投資人永遠覺得你不夠拚。',
      scale: 2,
      cash: 900000,
      staff: 6,
      maxStaff: 12,
      wage: 60000,
      rps: 124000,
      demand: 840000,
      fixed: 330000,
      volatility: 0.15,
      season: null,
    },
    {
      id: 'store',
      name: '便利商店（加盟）',
      icon: '🏪',
      desc: '24 小時全年無休，大夜班永遠缺人。',
      scale: 1.1,
      cash: 450000,
      staff: 8,
      maxStaff: 14,
      wage: 29500,
      rps: 46000,
      demand: 400000,
      fixed: 108000,
      volatility: 0.05,
      season: [1.1, 1.1, 1, 1, 1, 1.05, 1.1, 1.1, 1, 1, 1, 1.05],
    },
    {
      id: 'restaurant',
      name: '餐廳',
      icon: '🍜',
      desc: '廚房 50 度、連假最忙，人手永遠不夠。',
      scale: 1.3,
      cash: 600000,
      staff: 8,
      maxStaff: 14,
      wage: 34000,
      rps: 60000,
      demand: 520000,
      fixed: 178000,
      volatility: 0.1,
      season: [1.15, 1.2, 0.95, 1, 1, 0.95, 1, 1, 0.95, 1, 1, 1.15],
    },
    {
      id: 'cram',
      name: '補習班',
      icon: '📚',
      desc: '寒暑假是旺季，家長的 LINE 半夜也會響。',
      scale: 1.2,
      cash: 550000,
      staff: 5,
      maxStaff: 10,
      wage: 40000,
      rps: 85000,
      demand: 460000,
      fixed: 194000,
      volatility: 0.07,
      season: [1.2, 1.25, 0.95, 0.95, 1, 1.05, 1.25, 1.25, 0.9, 0.9, 0.95, 1],
    },
  ];

  // 經營方針：每月結算時套用
  const POLICIES = {
    salary: {
      label: '薪資水準',
      options: {
        low: { label: '低於行情', mult: 0.85, morale: -4, jerk: 5, desc: '「錢不是最重要的，學到東西才重要」' },
        market: { label: '市場行情', mult: 1, morale: 0, jerk: 0, desc: '跟同業差不多' },
        high: { label: '優於行情', mult: 1.15, morale: 3, jerk: -2, desc: '員工比較願意留下來' },
      },
    },
    overtime: {
      label: '加班政策',
      options: {
        none: { label: '準時下班', prod: 1, otRate: 0, morale: 1, jerk: -1, desc: '產能普通，但大家有生活' },
        paid: { label: '加班給加班費', prod: 1.2, otRate: 0.15, morale: -2, jerk: 0, desc: '產能 +20%，薪資成本 +15%' },
        unpaid: { label: '無償加班', prod: 1.2, otRate: 0, morale: -6, jerk: 8, violation: 'unpaidOT', desc: '「年輕人不要太計較」（違法）' },
      },
    },
    benefits: {
      label: '員工福利',
      options: {
        none: { label: '沒有', cost: 0, morale: -2, jerk: 2, desc: '「有工作就要感恩了」' },
        basic: { label: '基本', cost: 1500, morale: 0, jerk: 0, desc: '三節禮金、生日假' },
        rich: { label: '豐富', cost: 5000, morale: 3, jerk: -2, desc: '下午茶、健康檢查、團保' },
      },
    },
  };

  // 勞檢時會被罰的違規項目（罰鍰以手搖飲規模計，會乘上 scale）
  const VIOLATIONS = {
    unpaidOT: { label: '加班未給加班費', fine: 60000 },
    typhoonAbsence: { label: '颱風天強迫出勤、視為曠職', fine: 40000 },
    pregnancy: { label: '因懷孕不利對待員工', fine: 300000 },
    underreport: { label: '勞健保高薪低報', fine: 80000 },
    injuryCover: { label: '隱匿職業災害', fine: 150000 },
    withheldWage: { label: '扣留離職員工工資', fine: 60000 },
    deductWage: { label: '違法從薪水扣款', fine: 50000 },
    holidayNoPay: { label: '國定假日出勤未加倍發給工資', fine: 50000 },
    fakeResponsibility: { label: '違法適用責任制', fine: 80000 },
    unpaidCleaning: { label: '打烊清潔時間未計工時', fine: 40000 },
    fakeContractor: { label: '以承攬規避勞健保', fine: 80000 },
  };

  const EVENTS = [
    // ───────── 各行各業通用 ─────────
    {
      id: 'typhoon',
      icon: '🌀',
      title: '颱風來襲，政府宣布停班',
      text: '氣象局發布陸上颱風警報，你所在的縣市宣布停止上班。店裡的群組一片安靜，大家都在等你開口。',
      months: [6, 7, 8, 9, 10],
      choices: [
        { label: '依規定放假，薪水照發', effects: { cash: -12000, morale: 5, jerk: -2 }, result: '員工在家追劇吃泡麵，群組裡出現一排「老闆讚」貼圖。' },
        { label: '照常營業，自願來的給加班費', effects: { cash: 5000, morale: -1, jerk: 1 }, result: '有兩個人冒雨來上班，沒有人被逼，大家也沒話說。' },
        {
          label: '照常上班，沒來的算曠職',
          quote: '颱風天外送訂單最多，生意更好啊！',
          effects: { cash: 20000, morale: -10, jerk: 14, flag: 'typhoonAbsence' },
          result: '員工穿著雨衣頂著強風上班，有人在 Threads 上發了照片。',
          tip: '依勞動部「天然災害發生事業單位勞工出勤管理及工資給付要點」，雇主不得強迫勞工在停班時出勤，也不得視為曠工、扣全勤獎金或強迫補班。',
        },
      ],
    },
    {
      id: 'maternity',
      icon: '🤰',
      title: '員工懷孕了',
      text: '一位表現很好的員工開心地告訴你她懷孕了，預產期在半年後，到時需要請產假。',
      choices: [
        {
          label: '恭喜！依法給產假，提早安排代理人',
          effects: { cash: -40000, morale: 5, jerk: -4 },
          result: '大家幫她辦了一個小小的慶祝會，團隊感情更好了。',
          tip: '產假 8 週，受僱滿 6 個月以上工資照給。《性別平等工作法》禁止雇主因員工懷孕而解僱或給予不利對待。',
        },
        {
          label: '暗示她「要不要考慮在家專心安胎」',
          quote: '我是為妳好，孕婦不要太累。',
          effects: { cash: 10000, staff: -1, morale: -8, jerk: 22, flag: 'pregnancy' },
          result: '她紅著眼眶遞了辭呈。其他同事看在眼裡，什麼都沒說。',
          tip: '這是典型的懷孕歧視，違反《性別平等工作法》，可處新臺幣 30 萬元以上、150 萬元以下罰鍰。',
        },
      ],
    },
    {
      id: 'sick',
      icon: '🤒',
      title: '員工發燒請病假',
      text: '早上七點，一位員工傳訊息說燒到 39 度，今天沒辦法上班。',
      choices: [
        { label: '准假，叫他好好休息', effects: { cash: -3000, morale: 2, jerk: -1 }, result: '他回了一個感動的貼圖，隔兩天就生龍活虎地回來了。' },
        {
          label: '「在家應該還能打字吧？開個會就好」',
          quote: '我以前發燒 40 度還是照樣上班。',
          effects: { cash: 3000, morale: -4, jerk: 6 },
          result: '他頂著高燒開了兩小時視訊會議，病拖了一個禮拜才好。',
          tip: '依《勞工請假規則》，普通傷病假一年內未超過 30 日的部分，工資折半發給。病假期間要求工作，應視為出勤。',
        },
      ],
    },
    {
      id: 'raise',
      icon: '💸',
      title: '資深員工要求加薪',
      text: '做了三年的資深員工敲門進來：「老闆，我已經三年沒調薪了，物價一直漲……」',
      choices: [
        { label: '全員調薪 4%', note: '之後每月薪資成本 +4%', effects: { wageMult: 0.04, morale: 6, jerk: -3 }, result: '辦公室的氣氛明顯變好了，有人說「終於等到了」。' },
        { label: '只幫他一個人加薪', effects: { cash: -24000, morale: 1 }, result: '他很滿意，不過其他人好像也開始在算自己的年資了。' },
        {
          label: '「明年公司上市，股票分你」',
          quote: '格局要放大，不要只看眼前這點薪水。',
          effects: { morale: -3, jerk: 8 },
          result: '他半信半疑地走出去。茶水間開始流傳「上市」這個梗。',
        },
        {
          label: '「外面一堆人排隊想進來」',
          quote: '你不做，有的是人做。',
          effects: { staff: -1, morale: -8, jerk: 12 },
          result: '兩週後，他真的去了外面那間公司。',
        },
      ],
    },
    {
      id: 'insurance',
      icon: '🧾',
      title: '會計的「省錢妙招」',
      text: '會計小聲說：「老闆，勞健保可以用比較低的薪資投保，一年能省下一筆，大家都這樣做。」',
      choices: [
        { label: '照實際薪資投保', effects: { morale: 1, jerk: -2 }, result: '會計嘀咕了幾句，但還是照做了。' },
        {
          label: '低報，能省則省',
          quote: '大家都這樣做啊。',
          effects: { cash: 36000, jerk: 10, flag: 'underreport' },
          result: '帳面上好看了一點。員工暫時還沒發現。',
          tip: '勞保高薪低報會被處以罰鍰，而且員工將來的老年、傷病、失業給付都會跟著變少。',
        },
      ],
    },
    {
      id: 'line',
      icon: '📱',
      title: '下班後的 LINE 群組',
      text: '你發現自己常在晚上十點丟工作到群組。有員工私下抱怨：「下班了還要一直看手機。」',
      choices: [
        {
          label: '規定下班不交辦，緊急狀況算加班',
          effects: { cash: -10000, morale: 6, jerk: -4 },
          result: '群組晚上安靜多了，隔天早上大家反而比較有效率。',
          tip: '依勞動部的指導原則，下班後用通訊軟體交辦工作屬於工作時間，應給付工資或加班費。',
        },
        {
          label: '「看到再回就好，又沒有逼你」',
          quote: '只是回個訊息，又不會花多少時間。',
          effects: { cash: 12000, morale: -5, jerk: 8 },
          result: '大家睡前都還在回訊息。已讀不回的人隔天會被你點名。',
        },
      ],
    },
    {
      id: 'leave',
      icon: '✈️',
      title: '員工想在旺季請特休出國',
      text: '有員工早就買好機票，想請特休出國五天，偏偏剛好遇到這個月最忙的時候。',
      choices: [
        { label: '准假，其他人調班補上', effects: { cash: -10000, morale: 5, jerk: -2 }, result: '他帶了伴手禮回來，大家都很開心。' },
        { label: '跟他商量改期，多補一天假', effects: { cash: -4000, morale: 1 }, result: '他有點失望，但覺得你很有誠意。' },
        {
          label: '「旺季請假，有沒有團隊精神？」',
          quote: '大家都在拚，就你要出去玩？',
          effects: { morale: -6, jerk: 9 },
          result: '他退了機票，從此再也沒在旺季提過請假。',
          tip: '依勞基法第 38 條，特休日期原則上由勞工排定。雇主如有急迫需求可以協商調整，但不能拒絕或剝奪；沒休完的特休應折算工資。',
        },
      ],
    },
    {
      id: 'recession',
      icon: '📉',
      title: '景氣變差，生意明顯下滑',
      text: '最近客人少了一大截，看起來會持續好幾個月。股東問你打算怎麼辦。',
      choices: [
        { label: '撐下去，不減薪也不裁員', effects: { demand: { mult: 0.85, months: 3 }, morale: 4, jerk: -3 }, result: '員工知道你在硬撐，做事更賣力了。' },
        {
          label: '依法資遣一人，給足資遣費',
          effects: { staff: -1, cash: -40000, morale: -4, jerk: 1, demand: { mult: 0.85, months: 3 } },
          result: '雖然難過，但大家都知道你有照規矩來。',
          tip: '依《勞工退休金條例》，新制資遣費為每滿 1 年發給 1/2 個月平均工資，最高 6 個月。',
        },
        {
          label: '「共體時艱」全員減薪 15%',
          quote: '公司是一個大家庭，有難同當。',
          effects: { cash: 60000, morale: -10, jerk: 12, demand: { mult: 0.85, months: 3 } },
          result: '你的「大家庭」裡，有人開始更新 104 履歷了。',
          tip: '雇主單方面減薪是違法的，必須取得勞工同意；實施減班休息（無薪假）也必須協商並向主管機關通報。',
        },
      ],
    },
    {
      id: 'newbie',
      icon: '🐣',
      title: '新人說沒有人教',
      text: '上週剛來的新人私下跟你說：「我不知道該做什麼，問人大家都很忙……」',
      choices: [
        { label: '安排資深同事帶，給帶人津貼', effects: { cash: -8000, morale: 3 }, result: '新人很快就上手了，帶人的同事也覺得被看見。' },
        {
          label: '「我們都是做中學，自己看文件」',
          quote: '我當年也是自己摸索出來的。',
          effects: { staff: -1, morale: -3, jerk: 4 },
          result: '新人在第二週沒有再出現。',
        },
      ],
    },
    {
      id: 'injury',
      icon: '🩹',
      title: '員工在工作時受傷',
      text: '一位員工搬貨時閃到腰，醫生說要休息兩週，還要做復健。',
      choices: [
        {
          label: '依法負擔醫療費、給公傷假',
          effects: { cash: -50000, morale: 6, jerk: -4 },
          result: '他回來後跟大家說：「這間公司真的會照顧人。」',
          tip: '依勞基法第 59 條，勞工發生職業災害時，雇主應補償醫療費用，醫療期間不能工作者，應按原領工資補償。',
        },
        {
          label: '「你就說是在家裡跌倒的」',
          quote: '醫藥費我出一點，報職災很麻煩。',
          effects: { cash: -10000, morale: -10, jerk: 20, flag: 'injuryCover' },
          result: '他沒說什麼，但大家都知道是怎麼回事。',
        },
      ],
    },
    {
      id: 'viral',
      icon: '🔥',
      title: '突然在網路上爆紅！',
      text: '有網紅推薦了你們，客人和訂單一口氣暴增，這週大家可能忙不過來。',
      choices: [
        { label: '加請臨時人手', effects: { cash: 50000, morale: 2 }, result: '順利接住這波人潮，大家累但開心。' },
        {
          label: '全員加班，加班費照付',
          effects: { cash: 45000, morale: -2 },
          result: '大家撐過了這一週，薪水單上的加班費讓人安慰不少。',
          tip: '依勞基法第 24 條，延長工時在 2 小時以內的部分，加給 1/3 以上；再延長 2 小時以內的部分，加給 2/3 以上。',
        },
        {
          label: '「難得的機會，大家衝一波」不給加班費',
          quote: '機會是留給準備好的人。',
          effects: { cash: 90000, morale: -8, jerk: 10, flag: 'unpaidOT' },
          result: '賺了一大筆。員工每天都加班到半夜，一毛加班費也沒有。',
        },
      ],
    },
    {
      id: 'dcard',
      icon: '🗣️',
      title: '公司在 Dcard 被爆料了',
      text: '有人在 Dcard 工作版發文〈#爆料 這間公司的老闆……〉，留言已經破百。',
      cond: (g) => g.jerk >= 25,
      choices: [
        { label: '開員工座談，認真改善', effects: { cash: -15000, morale: 5, jerk: -10 }, result: '你公開回應並做出改變。原 PO 更新了文章：「老闆有在改，給個機會。」' },
        {
          label: '在公司裡找出是誰發的文',
          quote: '吃裡扒外的人不配待在這裡。',
          effects: { morale: -12, jerk: 12 },
          result: '你沒有抓到人，倒是讓所有人都覺得自己被懷疑。',
        },
        { label: '請公關公司洗評價', effects: { cash: -40000, jerk: 3 }, result: '文章被一堆「其實還好吧」的留言淹沒了。問題沒解決，只是被蓋過去。' },
      ],
    },
    {
      id: 'minwage',
      icon: '📈',
      title: '最低工資調漲',
      text: '政府公告明年最低工資調漲。基層員工的薪水勢必要跟著調，資深員工也在看你怎麼做。',
      months: [1, 2, 3, 9, 10],
      choices: [
        {
          label: '全員一起調薪 3%',
          note: '之後每月薪資成本 +3%',
          effects: { wageMult: 0.03, morale: 4, jerk: -2 },
          result: '資深員工覺得自己的年資有被尊重。',
          tip: '台灣自 2025 年起依《最低工資法》，每年由最低工資審議會審議最低工資。',
        },
        {
          label: '只調到剛好合法，老員工不動',
          note: '之後每月薪資成本 +1%',
          quote: '法律規定的我都有做到啊。',
          effects: { wageMult: 0.01, morale: -4, jerk: 4 },
          result: '做了五年的員工發現，自己的薪水跟新人只差兩百塊。',
        },
      ],
    },
    {
      id: 'resign',
      icon: '🚪',
      title: '員工提離職',
      text: '一位能幹的員工拿到了更好的 offer，下個月要離職。',
      choices: [
        { label: '誠心祝福，好好交接', effects: { staff: -1, morale: 2, jerk: -2 }, result: '他離開前把交接文件寫得清清楚楚，還說以後有機會再合作。' },
        { label: '提高待遇慰留', effects: { cash: -30000, morale: 1 }, result: '他決定留下來，不過你知道這不是長久之計。' },
        {
          label: '「你這樣很不負責任」扣住最後一個月薪水',
          quote: '要走可以，最後一個月的薪水就當作違約金。',
          effects: { staff: -1, cash: 30000, morale: -10, jerk: 18, flag: 'withheldWage' },
          result: '他直接去勞工局申訴了。',
          tip: '依勞基法第 22 條，工資應全額直接給付勞工；第 26 條也規定雇主不得預扣工資作為違約金或賠償費用。',
        },
      ],
    },
    {
      id: 'trip',
      icon: '🏝️',
      title: '要不要辦員工旅遊？',
      text: '有人提議今年辦員工旅遊。',
      choices: [
        { label: '平日舉辦，公司全額負擔', effects: (g) => ({ cash: -6000 * g.staff, morale: 8, jerk: -3 }), result: '大家在海邊玩得很開心，回來後合作更有默契。' },
        {
          label: '週末辦，強制參加，自費一半',
          quote: '公司是一個大家庭，家庭旅遊當然要全員到齊！',
          effects: (g) => ({ cash: -2000 * g.staff, morale: -6, jerk: 8 }),
          result: '大家犧牲週末、自己出錢，還要陪老闆唱 KTV 到半夜。',
        },
        { label: '今年先不辦', effects: { morale: -1 }, result: '有點可惜，不過沒有人真的很在意。' },
      ],
    },
    {
      id: 'rent',
      icon: '🏠',
      title: '房東要漲房租',
      text: '房東通知下個月起房租調漲。',
      choices: [
        { label: '接受漲價', note: '之後每月固定成本 +10%', effects: { fixedMult: 0.1 }, result: '房東很滿意，你的固定開銷又多了一筆。' },
        { label: '搬到便宜一點的地方', effects: { cash: -80000, morale: -3, demand: { mult: 0.95, months: 2 } }, result: '搬家很累，老客人也要時間適應新地點。' },
      ],
    },
    {
      id: 'nepotism',
      icon: '👨‍👩‍👦',
      title: '親戚的小孩想來上班',
      text: '阿姨打電話來：「我兒子剛退伍，在你那邊安插一個位子嘛。」',
      choices: [
        { label: '婉拒，請他走正常應徵流程', effects: { morale: 1 }, result: '阿姨在家族群組裡酸了你兩句。' },
        { label: '錄用，但跟大家用同一個標準', effects: (g) => ({ staff: g.staff < g.industry.maxStaff ? 1 : 0 }), result: '他從基層做起，意外地還滿認真的。' },
        {
          label: '錄用，直接當主管',
          quote: '自己人比較放心。',
          effects: (g) => ({ staff: g.staff < g.industry.maxStaff ? 1 : 0, morale: -10, jerk: 6 }),
          result: '做了三年的組長，現在要向一個什麼都不會的新人報告。',
        },
      ],
    },
    {
      id: 'yearend',
      icon: '🧧',
      title: '年終獎金與尾牙',
      text: '一年就要結束了，大家都在偷偷討論今年的年終。',
      months: [12],
      forced: true,
      choices: [
        { label: '年終 1.5 個月，尾牙加碼抽獎', effects: (g) => ({ cash: -48000 * g.staff, morale: 10, jerk: -8 }), result: '尾牙上有人抽到 iPhone，全場尖叫。' },
        { label: '年終 1 個月，簡單吃一頓', effects: (g) => ({ cash: -30000 * g.staff, morale: 4, jerk: -3 }), result: '中規中矩，大家都覺得還可以。' },
        {
          label: '「今年景氣不好」沒有年終',
          quote: '頭獎是老闆的親筆簽名照！',
          effects: { morale: -10, jerk: 12 },
          result: '尾牙上的掌聲稀稀落落。',
          tip: '年終獎金不是法定義務，但如果勞動契約或工作規則有約定，就一定要發。',
        },
      ],
    },

    // ───────── 手搖飲店 ─────────
    {
      id: 'd_summer',
      icon: '☀️',
      title: '夏天排隊人潮爆滿',
      text: '氣溫 36 度，店門口排了二十幾個人，外送單也一直跳。',
      industries: ['drinks'],
      months: [5, 6, 7, 8],
      choices: [
        { label: '加排工讀生的班', effects: { cash: 40000, morale: 1 }, result: '人手充足，出杯速度很穩。' },
        { label: '原班人馬撐，給加班費', effects: { cash: 35000, morale: -3 }, result: '大家累得手都在抖，但加班費有到位。' },
        {
          label: '「大家年輕，衝一波！」',
          quote: '搖飲料又不累，就是手動一動而已。',
          effects: { cash: 70000, morale: -9, jerk: 10, flag: 'unpaidOT' },
          result: '打烊時大家已經累到說不出話。',
        },
      ],
    },
    {
      id: 'd_cleanup',
      icon: '🧽',
      title: '打烊後的清潔時間要算工時嗎？',
      text: '打烊後還要洗器具、拖地、對帳，通常要多留四十分鐘。',
      industries: ['drinks'],
      choices: [
        { label: '算工時，照付', effects: { cash: -12000, morale: 4, jerk: -3 }, result: '工讀生們驚訝地發現，原來這也算錢。' },
        {
          label: '「打掃本來就是工作的一部分」不算',
          quote: '打卡下班之後再掃一下就好。',
          effects: { cash: 12000, morale: -5, jerk: 8, flag: 'unpaidCleaning' },
          result: '大家先打卡再回來打掃，天天如此。',
          tip: '開店前準備、打烊後清潔都屬於工作時間，應計入工時並給付工資。',
        },
      ],
    },
    {
      id: 'd_karen',
      icon: '😡',
      title: '奧客把店員罵哭了',
      text: '客人堅持自己點的是「微糖」不是「半糖」，對著工讀生大吼了五分鐘。',
      industries: ['drinks', 'restaurant', 'store'],
      choices: [
        { label: '站在員工這邊，請客人離開', effects: { cash: -3000, morale: 7, jerk: -3 }, result: '工讀生擦乾眼淚，全店都覺得老闆很有肩膀。' },
        {
          label: '「顧客永遠是對的，你去道歉」',
          quote: '客人是衣食父母。',
          effects: { morale: -7, jerk: 7 },
          result: '工讀生道了歉，客人還是給了一星負評。',
        },
      ],
    },
    {
      id: 'd_uniform',
      icon: '👕',
      title: '換新制服',
      text: '品牌更新了形象，需要幫所有人換新制服。',
      industries: ['drinks', 'restaurant'],
      choices: [
        { label: '公司買單', effects: (g) => ({ cash: -1200 * g.staff, morale: 2 }), result: '新制服很好看，大家拍照上傳 IG。' },
        {
          label: '從員工薪水扣',
          quote: '制服你自己穿的，當然自己出。',
          effects: { morale: -4, jerk: 6, flag: 'deductWage' },
          result: '薪水單上多了一行「制服費」。',
          tip: '未經勞工同意就從薪水扣款，違反勞基法第 22 條的工資全額給付原則。',
        },
      ],
    },
    {
      id: 'd_material',
      icon: '🫘',
      title: '原物料大漲',
      text: '茶葉、珍珠、鮮奶的進貨價全部漲了一成。',
      industries: ['drinks'],
      choices: [
        { label: '每杯漲價 5 元', effects: { demand: { mult: 0.92, months: 3 } }, result: '少了一些價格敏感的客人。' },
        { label: '自己吸收成本', effects: { cash: -50000 }, result: '客人沒感覺，你的帳戶有感覺。' },
      ],
    },

    // ───────── 科技新創 ─────────
    {
      id: 't_demo',
      icon: '🚀',
      title: '投資人下週要看 Demo',
      text: '投資人臨時把會議提前，產品還有一堆 bug 沒修。',
      industries: ['tech'],
      choices: [
        { label: '跟投資人談延後一週', effects: { cash: -30000, morale: 3 }, result: '投資人有點不高興，但延後一週的 Demo 很穩。' },
        { label: '週末加班，加班費照付', effects: { cash: -25000, morale: -3 }, result: '週末大家一起叫了 pizza，Demo 順利過關。' },
        {
          label: '「新創就是要拚，大家 all in！」',
          quote: '我們要改變世界，不是來上班的。',
          effects: { morale: -10, jerk: 12, flag: 'unpaidOT' },
          result: 'Demo 過了，但有工程師在 commit message 裡寫「救命」。',
        },
      ],
    },
    {
      id: 't_responsibility',
      icon: '⏱️',
      title: '「工程師都是責任制吧？」',
      text: 'HR 問你：工程師的加班要不要照算？',
      industries: ['tech'],
      choices: [
        { label: '照實計算工時與加班費', effects: { cash: -20000, morale: 4, jerk: -3 }, result: '工程師們終於敢在晚上七點準時下班了。' },
        {
          label: '說是責任制，加班不另計',
          quote: '軟體業大家都是責任制啊。',
          effects: { cash: 25000, morale: -6, jerk: 10, flag: 'fakeResponsibility' },
          result: '大家的工時悄悄變成一天 12 小時。',
          tip: '勞基法第 84-1 條的「責任制」只適用於經勞動部核定公告的特定工作者，還要書面約定並報當地主管機關核備。一般工程師不能直接套用。',
        },
      ],
    },
    {
      id: 't_burnout',
      icon: '🫠',
      title: '王牌工程師過勞',
      text: '團隊裡最強的工程師連續三個月沒休假，最近開會常常恍神。',
      industries: ['tech'],
      choices: [
        { label: '讓他休假一週，重新分配工作', effects: { cash: -20000, morale: 5, jerk: -3 }, result: '他回來後精神好多了，順手重構了一個大模組。' },
        {
          label: '「這是你成長的機會」再給他一個專案',
          quote: '能者多勞嘛。',
          effects: { staff: -1, cash: 20000, morale: -6, jerk: 10 },
          result: '一週後他遞出辭呈，帶走了一半的系統知識。',
        },
      ],
    },
    {
      id: 't_options',
      icon: '📜',
      title: '用股票選擇權代替加薪？',
      text: '現金吃緊，有人建議用「股票選擇權」代替今年的調薪。',
      industries: ['tech'],
      choices: [
        { label: '正常調薪', note: '之後每月薪資成本 +3%', effects: { wageMult: 0.03, morale: 4 }, result: '大家很踏實。' },
        { label: '給有書面合約、條件清楚的選擇權', effects: { cash: -10000, morale: 3 }, result: '律師費不便宜，但員工覺得自己真的是股東了。' },
        {
          label: '口頭承諾「上市後大家都財富自由」',
          quote: '相信我，這是一張未來的門票。',
          effects: { morale: -2, jerk: 7 },
          result: '有人問合約什麼時候簽，你說「再說」。',
        },
      ],
    },
    {
      id: 't_takehome',
      icon: '🧑‍💻',
      title: '面試作業',
      text: '在招新工程師。PM 提議給面試者一份「實作作業」。',
      industries: ['tech'],
      choices: [
        { label: '兩小時的小作業，或付費試作', effects: { cash: -5000, jerk: -1 }, result: '面試者覺得被尊重，口碑不錯。' },
        {
          label: '要求免費做三天的完整功能',
          quote: '這是在測試你的熱忱。',
          effects: { cash: 5000, jerk: 5 },
          result: '你發現作業內容剛好就是下個 sprint 的需求……PTT 上有人發現了。',
        },
      ],
    },
    {
      id: 't_client',
      icon: '📞',
      title: '客戶要求明天上線',
      text: '大客戶突然要求功能明天就要上線，不然要扣款。',
      industries: ['tech'],
      choices: [
        { label: '跟客戶溝通風險，爭取延後', effects: { cash: -40000, morale: 3 }, result: '被扣了一點錢，但沒有人需要通宵。' },
        { label: '通宵趕工，隔天補休加加班費', effects: { cash: -15000, morale: -3 }, result: '上線成功，大家隔天睡到中午。' },
        {
          label: '「通宵一下而已，大家都是這樣過來的」',
          quote: '我以前創業三天沒睡。',
          effects: { morale: -9, jerk: 10, flag: 'unpaidOT' },
          result: '上線了，同時也上了好幾個新 bug。',
        },
      ],
    },

    // ───────── 便利商店 ─────────
    {
      id: 's_night',
      icon: '🌙',
      title: '大夜班找不到人',
      text: '大夜班的工讀生離職了，徵人啟事貼了兩週都沒人來。',
      industries: ['store'],
      choices: [
        { label: '提高大夜津貼來徵人', effects: { cash: -25000, morale: 3 }, result: '終於有人來應徵了，還是個很可靠的大叔。' },
        { label: '你自己下去顧大夜', effects: { cash: -5000, morale: 4, jerk: -2 }, result: '你熬了兩週大夜，終於知道員工有多辛苦。' },
        {
          label: '叫正職輪大夜，不另外加給',
          quote: '正職本來就要配合排班。',
          effects: { cash: 10000, morale: -8, jerk: 9 },
          result: '正職們開始輪流黑眼圈。',
        },
      ],
    },
    {
      id: 's_shortage',
      icon: '🪙',
      title: '收到偽鈔、盤點短少',
      text: '交班盤點少了 3,000 元，收銀機裡還有一張偽鈔。',
      industries: ['store'],
      choices: [
        { label: '公司吸收，加裝驗鈔機', effects: { cash: -8000, morale: 3 }, result: '員工鬆了一口氣。' },
        {
          label: '從當班員工薪水扣',
          quote: '誰當班誰負責。',
          effects: { cash: 3000, morale: -7, jerk: 10, flag: 'deductWage' },
          result: '當班的工讀生這個月等於白做了一天。',
          tip: '依勞基法第 26 條，雇主不得預扣勞工工資作為違約金或賠償費用。',
        },
      ],
    },
    {
      id: 's_quota',
      icon: '🍱',
      title: '總部要求衝年菜業績',
      text: '總部下達年菜預購目標，每家店都要達標。',
      industries: ['store'],
      months: [11, 12, 1],
      choices: [
        { label: '盡力推，沒達標就算了', effects: { cash: -20000, morale: 2 }, result: '被總部唸了一下，但店裡氣氛很好。' },
        {
          label: '「每人認購五份，從薪水扣」',
          quote: '自己的店自己挺！',
          effects: { cash: 25000, morale: -9, jerk: 12, flag: 'deductWage' },
          result: '今年員工家裡都有吃不完的年菜。',
          tip: '強迫員工認購業績，常被認為是變相減薪；直接從薪水扣款更違反工資全額給付原則。',
        },
      ],
    },
    {
      id: 's_robbery',
      icon: '🚨',
      title: '深夜搶案',
      text: '凌晨三點有人持刀搶劫，值班員工沒有受傷，但嚇壞了。',
      industries: ['store'],
      choices: [
        { label: '給有薪假、安排心理諮商、加強保全', effects: { cash: -30000, morale: 6, jerk: -3 }, result: '員工慢慢恢復，也覺得公司有在保護他們。' },
        {
          label: '「沒受傷就好，今晚繼續上班」',
          quote: '又沒怎樣，不要想太多。',
          effects: { morale: -8, jerk: 9 },
          result: '他上班時一直盯著門口，下週就沒再出現了。',
        },
      ],
    },
    {
      id: 's_holiday',
      icon: '🧨',
      title: '過年期間的排班',
      text: '春節連假到了，便利商店照常營業。',
      industries: ['store'],
      months: [1, 2],
      choices: [
        {
          label: '國定假日出勤，工資加倍',
          effects: { cash: -20000, morale: 4 },
          result: '大家過年上班也心甘情願。',
          tip: '依勞基法第 39 條，國定假日出勤，工資應加倍發給。',
        },
        {
          label: '「便利商店本來就全年無休」照平日算',
          quote: '要過年回家就不要來做這行。',
          effects: { cash: 15000, morale: -6, jerk: 10, flag: 'holidayNoPay' },
          result: '大家除夕夜在店裡吃微波年菜。',
        },
      ],
    },

    // ───────── 餐廳 ─────────
    {
      id: 'r_aircon',
      icon: '🥵',
      title: '廚房冷氣壞了',
      text: '夏天的廚房溫度飆到 50 度，有廚師差點中暑。',
      industries: ['restaurant'],
      months: [5, 6, 7, 8, 9],
      choices: [
        { label: '立刻找人來修', effects: { cash: -40000, morale: 5 }, result: '廚房恢復正常，出菜速度也回來了。' },
        {
          label: '「廚房本來就熱，忍一下」',
          quote: '我以前當學徒的時候哪有冷氣。',
          effects: { morale: -8, jerk: 7 },
          result: '有位廚師在出餐尖峰時昏倒了。',
        },
      ],
    },
    {
      id: 'r_holiday',
      icon: '🎏',
      title: '連假要不要營業？',
      text: '國定假日連假到了，訂位電話響個不停。',
      industries: ['restaurant'],
      choices: [
        {
          label: '營業，工資加倍',
          effects: { cash: 30000, morale: 1 },
          result: '大家忙翻了，但薪水單很好看。',
          tip: '依勞基法第 39 條，國定假日出勤，工資應加倍發給。',
        },
        {
          label: '營業，照平日工資',
          quote: '餐飲業本來就是別人放假我們上班。',
          effects: { cash: 60000, morale: -6, jerk: 10, flag: 'holidayNoPay' },
          result: '賺了一筆，但員工的臉比菜還臭。',
        },
        { label: '公休，讓大家放假', effects: { cash: -10000, morale: 5 }, result: '大家難得跟家人吃了頓飯。' },
      ],
    },
    {
      id: 'r_tips',
      icon: '💰',
      title: '一成服務費要分給員工嗎？',
      text: '店裡有收一成服務費，外場員工問這筆錢有沒有他們的份。',
      industries: ['restaurant'],
      choices: [
        { label: '服務費的一部分分給員工', effects: { cash: -20000, morale: 7, jerk: -3 }, result: '外場的笑容明顯變多了。' },
        { label: '全部歸公司', quote: '服務費是公司的營收。', effects: { morale: -3, jerk: 3 }, result: '合法，但大家心裡有點不是滋味。' },
      ],
    },
    {
      id: 'r_chef',
      icon: '👨‍🍳',
      title: '二廚被挖角',
      text: '對面新開的餐廳開了更高的薪水挖你的二廚。',
      industries: ['restaurant'],
      choices: [
        { label: '加薪留人', effects: { cash: -36000, morale: 2 }, result: '他留下來了，還多研發了兩道新菜。' },
        { label: '祝福他，從內部升人', effects: { staff: -1, morale: 3 }, result: '三廚終於等到機會，做得有聲有色。' },
        {
          label: '到處說他壞話，讓他混不下去',
          quote: '敢走就別想在這行混。',
          effects: { staff: -1, morale: -6, jerk: 9 },
          result: '業界圈子很小，大家都知道是你在亂講。',
        },
      ],
    },
    {
      id: 'r_meal',
      icon: '🍚',
      title: '員工餐怎麼辦？',
      text: '員工們一天站 10 小時，休息時間只能匆匆吃幾口。',
      industries: ['restaurant'],
      choices: [
        { label: '好好準備員工餐', effects: (g) => ({ cash: -1500 * g.staff, morale: 4 }), result: '吃飽才有力氣做事。' },
        {
          label: '吃前一天賣剩的',
          quote: '又沒壞，浪費食物不好。',
          effects: { morale: -5, jerk: 6 },
          result: '員工開始自己帶便當。',
        },
      ],
    },

    // ───────── 補習班 ─────────
    {
      id: 'c_flyer',
      icon: '📄',
      title: '招生季要發傳單',
      text: '招生季到了，主任提議讓老師下課後去校門口發傳單。',
      industries: ['cram'],
      months: [1, 2, 6, 7, 8],
      choices: [
        { label: '另外請工讀生發', effects: { cash: -12000 }, result: '老師可以專心備課。' },
        { label: '老師去發，算加班費', effects: { cash: -8000, morale: -2 }, result: '老師們不太情願，但加班費有到位。' },
        {
          label: '「招生大家都有責任」無償發',
          quote: '班上沒學生，你們也沒課上啊。',
          effects: { morale: -6, jerk: 8, flag: 'unpaidOT' },
          result: '老師們在校門口被學生認出來，有點尷尬。',
        },
      ],
    },
    {
      id: 'c_parent',
      icon: '🌃',
      title: '家長半夜 LINE 老師',
      text: '有家長晚上十一點傳了一大串訊息給老師，問孩子的作業和成績。',
      industries: ['cram'],
      choices: [
        { label: '統一由櫃台處理，老師下班不用回', effects: { cash: -10000, morale: 6, jerk: -3 }, result: '老師們終於能好好睡覺了。' },
        {
          label: '「家長是衣食父母，要秒回」',
          quote: '服務業就是要隨時待命。',
          effects: { morale: -6, jerk: 8 },
          result: '老師們的手機二十四小時都不敢關靜音。',
        },
      ],
    },
    {
      id: 'c_noncompete',
      icon: '✍️',
      title: '競業禁止條款',
      text: '律師建議要求老師簽約：離職後兩年內，不得在方圓三公里內教書。',
      industries: ['cram'],
      choices: [
        { label: '不簽，或依法給予合理補償', effects: { cash: -10000, morale: 3, jerk: -2 }, result: '老師們覺得被尊重，也更願意長期待下來。' },
        {
          label: '簽，不給任何補償',
          quote: '我栽培你，你不能一走了之。',
          effects: { morale: -4, jerk: 8 },
          result: '老師們簽了，但開始私下打聽其他補習班。',
          tip: '依勞基法第 9-1 條，競業禁止約定必須有合理補償，期間最長不得超過 2 年，否則無效。',
        },
      ],
    },
    {
      id: 'c_contractor',
      icon: '📋',
      title: '老師要用「承攬」計鐘點嗎？',
      text: '會計建議老師都改簽「承攬契約」按鐘點計費，這樣就不用保勞健保。',
      industries: ['cram'],
      choices: [
        { label: '正式聘僱，依法加保', effects: { cash: -30000, morale: 6, jerk: -4 }, result: '老師們有了保障，流動率明顯下降。' },
        {
          label: '改成承攬，不保勞健保',
          quote: '這樣你們拿到的現金比較多啊。',
          effects: { cash: 10000, morale: -3, jerk: 8, flag: 'fakeContractor' },
          result: '老師們發現自己沒有勞保，也沒有勞退。',
          tip: '判斷是不是僱傭關係看的是實際的從屬性，例如要不要打卡、是否受指揮監督，不是看合約名稱。實質僱傭卻假承攬，仍須負擔雇主責任。',
        },
      ],
    },
    {
      id: 'c_exam',
      icon: '📝',
      title: '考前衝刺加課',
      text: '大考前一個月，家長紛紛要求加開衝刺班。',
      industries: ['cram'],
      months: [3, 4, 5, 11, 12],
      choices: [
        { label: '加課，給老師鐘點費', effects: { cash: 20000 }, result: '學生和老師都很拚，成果不錯。' },
        {
          label: '「為了孩子」加課不給鐘點',
          quote: '教育是良心事業。',
          effects: { cash: 45000, morale: -7, jerk: 9, flag: 'unpaidOT' },
          result: '老師們上到聲音都啞了。',
        },
      ],
    },
  ];

  root.BossData = { INDUSTRIES, POLICIES, VIOLATIONS, EVENTS };
})(typeof window !== 'undefined' ? window : globalThis);
