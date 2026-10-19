// 升遷與主管：管理風格、同事評價、主管相關的事件
// 每個員工都有看不到的「領導力」和「企圖心」，升上去之後才會知道他是哪一種主管
(function (root) {
  const Fun = root.BossFun;
  if (!Fun) return;

  // 管理風格：效果會乘上領導力（0.4 + 領導力/100），店長再乘 1.5
  // speed：同班的人做事速度；mood：同班的人心情；calm：排隊客人的耐心；learn：同班的人學得多快
  // waste：食材報廢；fragile：玻璃心的人額外的心情；self：他自己的速度
  Fun.STYLES = {
    warm: { name: '暖心型', icon: '🤗', desc: '同班的人心情比較好，排隊的客人也比較有耐心', mood: 4, calm: 0.12 },
    strict: { name: '鐵血型', icon: '🪖', desc: '同班的人做事變快，但心情被壓著；玻璃心的人更受不了', speed: 0.07, mood: -3, fragile: -6 },
    mentor: { name: '教練型', icon: '🎓', desc: '同班的人技能長得特別快', learn: 1.8, mood: 1 },
    numbers: { name: '精算型', icon: '🧮', desc: '盯著庫存和報廢，食材比較不浪費', waste: 0.6, speed: 0.02 },
    slacker: { name: '摸魚型', icon: '🐟', desc: '升官之後自己反而變慢，常常不見人影', self: 0.8, mood: 1 },
  };

  // 同事私下怎麼說他（大概七成準）
  Fun.STYLE_HINTS = {
    warm: ['大家心情不好都會找他聊', '他會記得每個人的生日', '新人第一天都是他帶的，很有耐心'],
    strict: ['他做事很要求，看不慣別人慢吞吞', '他說話很直，有人被他念哭過', '他的工作檯永遠最整齊'],
    mentor: ['他很會教，新人問他都不會不耐煩', '他自己整理了一本工作筆記', '大家遇到不會的都先問他'],
    numbers: ['他每天都會順手點一下庫存', '他算錢比收銀機還快', '他會提醒大家哪些東西快過期了'],
    slacker: ['他很會找地方躲起來滑手機', '他說「主管就是要動口不動手」', '他每次都說「等一下我來」'],
  };

  const ta = (e) => (e && e.gender === 'f' ? '她' : '他');

  Fun.AMBITION_LABEL = (a) => (a >= 65 ? '🔥 很想往上爬' : a >= 35 ? '🙂 給機會就做' : '😌 只想安靜做事');

  // 主管相關的事件
  Fun.CAREER = {
    // 員工主動要求升遷
    ask(sim, e) {
      const again = (e.asks || 0) >= 1;
      return {
        id: 'career_ask',
        icon: '🙋',
        title: `${e.name}想升組長`,
        text: again
          ? `${e.name}又來找你了：「老闆，上次你說再觀察看看……我覺得我已經準備好了。如果這次還是不行，我可能要想想自己的未來。」`
          : `${e.name}下班前把你拉到一旁：「老闆，我在這裡做了 ${Math.max(1, Math.floor((sim.day - e.hiredDay) / 7))} 週，大部分的事我都會了。我想試試看當組長，帶新人。」`,
        choices: [
          { label: '好，從明天開始你就是組長', note: `時薪 +$${Fun.RANKS.leader.wage}`, effects: { promoteOf: [e.id, 'leader'] }, result: `${e.name}眼睛一亮：「我不會讓你失望的！」同事們拍手起鬨。` },
          { label: '再給我兩週觀察看看', effects: { askLater: e.id, moodOf: [[e.id, -4]] }, result: `${e.name}點點頭：「好，我會表現給你看。」但看得出來有點失落。` },
          again
            ? { label: '「你還不夠格，不要再問了」', quote: '組長不是你想當就能當的。', effects: { leave: e.id, jerk: 2 }, result: `${e.name}隔天遞了辭呈：「對面說可以讓我當組長。」`, tip: '員工主動爭取升遷是好事；就算現在不適合，說清楚還差哪些能力、給一個時間點，比直接打槍更能留住人。' }
            : { label: '「你還不夠格」', quote: '先把手上的事做好再說。', effects: { moodOf: [[e.id, -14]], askLater: e.id }, result: `${e.name}低著頭說了聲「好」，整個下午都沒講話。` },
        ],
        ignore: { effects: { moodOf: [[e.id, -8]], askLater: e.id }, result: `你一直沒回應，${e.name}覺得自己被當空氣。` },
      };
    },
    // 鐵血主管被投訴
    complaint(sim, boss, who) {
      const R = Fun.RANKS[boss.rank] || { name: '主管' };
      return {
        id: 'career_complaint',
        icon: '😣',
        title: `有人投訴${R.name}${boss.name}`,
        text: `${who.name}紅著眼眶來找你：「${boss.name}今天又當著客人的面念我，說我『動作慢得跟烏龜一樣』。我知道我不夠快，可是……」`,
        choices: [
          { label: `找${boss.name}私下談談帶人的方式`, effects: { talkLeader: boss.id, moodOf: [[who.id, 6]] }, result: `你約${boss.name}喝咖啡，聊了很久。` },
          { label: `把${boss.name}降職`, effects: { demoteOf: boss.id, moodOf: [[who.id, 8]] }, result: `${boss.name}被降回一般員工，臉色很難看。${who.name}鬆了一口氣。` },
          { label: `「${ta(boss)}也是為了店好，你忍一下」`, quote: '嚴格一點才會進步。', effects: { moodOf: [[who.id, -12]], morale: -2, jerk: 2 }, result: `${who.name}默默回去工作。員工群組裡有人傳了一張「慣老闆養出慣主管」的梗圖。`, tip: '主管在公開場合羞辱員工可能構成職場霸凌；雇主依職業安全衛生法有預防職場不法侵害的責任。' },
        ],
        ignore: { effects: { moodOf: [[who.id, -8]], morale: -1 }, result: `${who.name}等不到你的回應，下班時哭著走了。` },
      };
    },
    // 摸魚主管被抓包
    slack(sim, boss) {
      const R = Fun.RANKS[boss.rank] || { name: '主管' };
      const where = ['躲在倉庫滑手機', '坐在休息區看直播', '說要去「巡店」，其實在對面便利商店吹冷氣', '在員工群組發「大家辛苦了」，人卻在後面打電動'];
      return {
        id: 'career_slack',
        icon: '🐟',
        title: `${R.name}${boss.name}又在摸魚`,
        text: `外面排了一排客人，你發現${boss.name}${where[Math.floor(sim.rng() * where.length)]}。其他員工看你的眼神好像在說：「你看到了吧？」`,
        choices: [
          { label: `叫${ta(boss)}出來，私下提醒一下`, effects: { moodOf: [[boss.id, -4]], lead: [boss.id, 4] }, result: `${boss.name}尷尬地收起手機：「我、我剛好在想排班的事。」之後好像比較常出現了。` },
          { label: '降職，讓認真的人上', effects: { demoteOf: boss.id, morale: 3 }, result: `你把${boss.name}降回一般員工。其他人表面上沒說什麼，但做事好像比較有勁了。` },
          { label: '算了，主管偶爾休息一下', effects: { morale: -3 }, result: '大家看在眼裡：原來當主管就可以這樣。' },
        ],
        ignore: { effects: { morale: -2 }, result: `${boss.name}摸了一整個下午，大家都看到了。` },
      };
    },
    // 店長被對手挖角，還要帶走一個人
    poachManager(sim, boss, friend) {
      const name = sim.rival ? sim.rival.name : '別家店';
      return {
        id: 'career_poach',
        icon: '🧲',
        title: `${name}想挖走店長${boss.name}`,
        text: `${name}開了更高的薪水要${boss.name}過去當店長${friend ? `，而且跟${boss.gender === 'f' ? '她' : '他'}感情最好的${friend.name}也說要一起走` : ''}。${boss.name}跑來跟你說：「老闆，我其實不太想走……」`,
        choices: [
          { label: `幫${boss.name}加薪 $40 留下來`, effects: { raiseOf: [boss.id, 40], moodOf: [[boss.id, 12]] }, result: `${boss.name}握著你的手：「我會把這間店顧好的。」` },
          { label: `問${ta(boss)}到底哪裡不開心，一起想辦法`, effects: { moodOf: [[boss.id, 8], ...(friend ? [[friend.id, 5]] : [])], morale: 2 }, result: `你們聊到很晚。${boss.name}說最近排班太滿、壓力很大，你答應會多請一個人幫忙。` },
          { label: `祝福${ta(boss)}，好聚好散`, effects: { leave: boss.id, ...(friend ? { leave2: friend.id } : {}), jerk: -1 }, result: `${boss.name}${friend ? `和${friend.name}` : ''}最後一天上班，大家一起吃了一頓飯。店裡突然安靜了很多。` },
        ],
        ignore: { effects: { leave: boss.id, ...(friend ? { leave2: friend.id } : {}) }, result: `你沒回應，${boss.name}${friend ? `帶著${friend.name}` : ''}去了${name}。` },
      };
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
