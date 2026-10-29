// 📺 店裡的連續劇：每齣三集，隔幾天上演一集，每一集結尾都有「下集預告」
// 你在前幾集的選擇會改變結局（打臉、逆襲、反轉）
(function (root) {
  const Fun = (root.BossFun = root.BossFun || {});

  // 每一集：lines 是開場的對白（一句一句跳出來），choices 的 set 會記在這齣戲的狀態裡
  // teaser：下集預告；next：幾天後演下一集；climax：大結局（會放彩帶、震一下）
  Fun.DRAMAS = [
    {
      id: 'uncle',
      title: '神秘的拖鞋阿伯',
      poster: '🩴',
      cond: (s) => s.day >= 8,
      eps: [
        (s) => ({
          lines: [
            ['旁白', '一個穿著藍白拖、汗衫破了洞的阿伯，連續一週都點店裡最便宜的東西，一坐就是一下午。'],
            ['員工', '老闆……他又來了，佔位子不點東西，客人都沒地方坐。'],
            ['阿伯', '少年仔，我坐一下就走，腳不好。'],
          ],
          ev: {
            icon: '🩴',
            title: '要不要請阿伯離開？',
            choices: [
              { label: '讓他坐，再送他一杯熱茶', effects: { cash: -50 }, set: { kind: true }, result: '阿伯愣了一下，說：「現在這種店不多了。」' },
              { label: '客氣地請他把位子讓給客人', effects: {}, set: { kind: false }, result: '阿伯沒說什麼，拄著拐杖慢慢走了。' },
              { label: '「我們這裡不是公園」', effects: { jerk: 2 }, set: { kind: false, rude: true }, result: '阿伯看了你一眼，那眼神不像一般的老人。' },
            ],
          },
          teaser: '下集預告：一台黑頭車停在店門口，司機下車問：「請問，董事長在這裡嗎？」',
          next: 3,
        }),
        (s, st) => ({
          lines: [
            ['旁白', '一台黑頭車停在門口，穿西裝的司機走進來東張西望。'],
            ['司機', '不好意思，請問有沒有看到一位穿拖鞋的老先生？'],
            ['員工', '（小聲）老闆……該不會是那個阿伯吧？'],
          ],
          ev: {
            icon: '🚘',
            title: '司機在找人',
            choices: [
              { label: '「他常來，我們幫你留意」', effects: {}, set: { told: true }, result: '司機遞了一張名片，上面印著一間你在電視上看過的集團。' },
              { label: '「沒看到」（不想惹麻煩）', effects: {}, set: { told: false }, result: '司機皺著眉頭離開了。你心裡有點不安。' },
            ],
          },
          teaser: st.kind ? '下集預告：阿伯回來了，這次身邊跟著三個西裝筆挺的人……' : '下集預告：對面那間空店面，突然開始裝潢了。',
          next: 3,
        }),
        (s, st) =>
          st.kind
            ? {
                lines: [
                  ['旁白', '阿伯回來了，這次換上了訂做西裝，身邊跟著三個特助。'],
                  ['阿伯', '我退休前開了四十年的連鎖店。現在的年輕老闆，眼裡只有翻桌率。'],
                  ['阿伯', '只有你，在我什麼都不是的時候，給了我一杯熱茶。'],
                  ['阿伯', '我想投資你。條件只有一個：把員工顧好。'],
                ],
                ev: {
                  icon: '🎩',
                  title: '退休董事長要投資你',
                  climax: true,
                  choices: [
                    { label: '「謝謝董事長，我會的」', effects: { cash: Math.round(s.ind.cash * 2), morale: 8, followers: 600, review: [5, '聽說連退休的董事長都投資這間，難怪這麼用心'] }, result: '新聞標題：〈拖鞋阿伯竟是退休董事長〉。整條街都在傳你的故事。' },
                    { label: '婉拒投資，請他常來喝茶就好', effects: { morale: 12, jerk: -5, followers: 900, review: [5, '老闆拒絕投資只請阿伯喝茶，這才叫人情味'] }, result: '阿伯哈哈大笑：「好！這間店我罩了。」他到處跟老朋友推薦你的店。' },
                  ],
                },
              }
            : {
                lines: [
                  ['旁白', '對面的店面裝潢好了，招牌掀開的那一刻，你愣住了。'],
                  ['阿伯', '（穿著訂做西裝，站在對面門口）少年仔，記得我嗎？'],
                  ['阿伯', st.rude ? '「我們這裡不是公園」，這句話我記了很久。' : '那天你請我讓位子，我就在想，這條街需要一間不一樣的店。'],
                  ['旁白', '他是退休的連鎖集團董事長。對面，是他重新出山開的店。'],
                ],
                ev: {
                  icon: '🏬',
                  title: '阿伯在對面開店了',
                  climax: true,
                  choices: [
                    { label: '親自過去道歉', effects: { jerk: -3, demand: { mult: 0.92, months: 1 }, rivalHit: -0.2 }, result: '阿伯接受了道歉，但生意就是生意。對面的店還是搶走了一些客人。' },
                    { label: '「放馬過來」', effects: { demand: { mult: 0.85, months: 1 }, rivalHit: -0.4 }, result: '一場商戰開始了。對面的店開幕優惠，你的客人少了一成五。' },
                  ],
                },
              },
      ],
    },
    {
      id: 'heir',
      title: '打工仔是富二代',
      poster: '💎',
      cond: (s) => s.day >= 12 && s.staff.length >= 2,
      eps: [
        (s) => {
          const e = s.dramaStaff();
          return {
            lines: [
              ['旁白', `${e.name}做事很認真，但每天下班都有一台跑車在巷口等。`],
              ['同事', `欸，${e.name}的手錶好像是真的勞力士……`],
              [e.name, '老闆，我可以多排一點班嗎？我想學怎麼開店。'],
            ],
            ev: {
              icon: '💎',
              title: `${e.name}想多學一點`,
              choices: [
                { label: '好，我親自帶你', effects: { moodOf: [[e.id, 15]] }, set: { mentor: true }, result: `${e.name}眼睛亮了起來，拿出筆記本開始抄。` },
                { label: '排班照規矩，大家都一樣', effects: {}, set: { mentor: false }, result: `${e.name}點點頭：「我懂，公平最重要。」` },
                { label: '「有跑車還來打工？是來體驗人生喔？」', effects: { moodOf: [[e.id, -20]], jerk: 2 }, set: { mentor: false, mock: true }, result: `${e.name}低下頭，沒說話。` },
              ],
            },
            teaser: '下集預告：一位貴婦衝進店裡大喊：「我兒子為什麼在這種地方端盤子！」',
            next: 3,
            who: e.id,
          };
        },
        (s, st) => ({
          lines: [
            ['旁白', '一位戴著墨鏡的貴婦衝進店裡。'],
            ['貴婦', '我兒子放著家裡的公司不管，跑來這種地方端盤子？老闆，你給我說清楚！'],
          ],
          ev: {
            icon: '👜',
            title: '富二代的媽媽來了',
            choices: [
              { label: '「他是我店裡最認真的人，你該以他為榮」', effects: {}, set: { defend: true }, result: '貴婦愣住了。站在後面的他，眼眶紅了。' },
              { label: '「那我請他回家好了」', effects: {}, set: { defend: false }, result: '貴婦滿意地點頭。他收拾東西時，一句話都沒說。' },
            ],
          },
          teaser: st.mentor ? '下集預告：三個月後，一份來自集團的合約放在你桌上……' : '下集預告：他留下一封信，信封上寫著「給老闆」。',
          next: 4,
        }),
        (s, st) =>
          st.mentor || st.defend
            ? {
                lines: [
                  ['旁白', '三個月後，他回家接了班。某天，一份合約放在你桌上。'],
                  ['富二代', '老闆，我們集團旗下所有辦公室的下午茶、員工餐，想交給你。'],
                  ['富二代', '你教我的，不是怎麼開店，是怎麼當一個人家想跟著的老闆。'],
                ],
                ev: {
                  icon: '📜',
                  title: '集團大單',
                  climax: true,
                  choices: [{ label: '握手：「合作愉快」', effects: { cash: Math.round(s.ind.cash * 1.5), demand: { mult: 1.15, months: 2 }, morale: 6, followers: 500 }, result: '整間店都在歡呼。接下來兩個月，訂單接到手軟。' }],
                },
              }
            : {
                lines: [
                  ['旁白', '他留下一封信。'],
                  ['信', st.mock ? '「老闆，謝謝你讓我知道，外面的人是怎麼看我們這種人的。」' : '「老闆，謝謝這段時間。我回家了，但我會記得這裡。」'],
                  ['旁白', '後來你聽說，他的集團跟對面那間店簽了長期合約。'],
                ],
                ev: {
                  icon: '✉️',
                  title: '他走了',
                  climax: true,
                  choices: [{ label: '把信收進抽屜', effects: { rivalHit: -0.25, morale: -3 }, result: '有些機會，錯過就不會再來了。' }],
                },
              },
      ],
    },
    {
      id: 'influencer',
      title: '網紅的陷阱',
      poster: '🤳',
      cond: (s) => s.day >= 6,
      eps: [
        (s) => ({
          lines: [
            ['網紅', '老闆～我有八十萬粉絲喔。今天這桌我請朋友，你免費招待，我幫你發一篇。'],
            ['網紅', '不然……我也可以發一篇「真實心得」啦。'],
          ],
          ev: {
            icon: '🤳',
            title: '網紅要白吃',
            choices: [
              { label: '「照價收費，歡迎真實評價」', effects: {}, set: { stand: true }, result: '網紅冷笑一聲：「你會後悔的。」' },
              { label: '算了，免費招待', effects: { cash: -2500 }, set: { stand: false }, result: '網紅吃完，連謝謝都沒說就走了。' },
            ],
          },
          teaser: '下集預告：一篇〈黑店老闆當眾羞辱客人〉的貼文，衝上了熱門……',
          next: 2,
        }),
        (s, st) => ({
          lines: [
            ['旁白', st.stand ? '一篇抹黑你的影片衝上熱門，留言區一面倒。' : '他還是發文了：「普普通通，服務很差」。原來他要的不是免費，是流量。'],
            ['員工', '老闆，監視器……那天的畫面都還在。'],
          ],
          ev: {
            icon: '📹',
            title: '要不要公開監視器畫面？',
            choices: [
              { label: '公開完整影片，不加任何評論', effects: {}, set: { video: true }, result: '你按下了上傳。' },
              { label: '私訊道歉，請他下架', effects: { cash: -5000 }, set: { video: false }, result: '他回了一句：「轉帳五萬就下架。」' },
            ],
          },
          teaser: st.stand ? '下集預告：影片的觀看數，在一個小時內破了一百萬……' : '下集預告：另一間店的老闆打電話來：「你也被他勒索過嗎？」',
          next: 2,
        }),
        (s, st) =>
          st.video || !st.stand
            ? {
                lines: [
                  ['旁白', '影片在一個小時內破了一百萬觀看。'],
                  ['網友', '「原來是他自己要白吃」「這種網紅可以退休了」「明天就去這家店」'],
                  ['旁白', '網紅的帳號被灌爆，他發了一篇道歉文。你的店，排隊排到街角。'],
                ],
                ev: {
                  icon: '🔥',
                  title: '大逆轉',
                  climax: true,
                  choices: [{ label: '「謝謝大家，歡迎來吃」', effects: { followers: 2500, demand: { mult: 1.25, months: 1 }, review: [5, '看了影片特地來的，老闆好有骨氣'] }, result: '這是你開店以來最忙的一個月。' }],
                },
              }
            : {
                lines: [
                  ['旁白', '你付了錢，影片下架了。但網路是有記憶的。'],
                  ['網友', '「聽說老闆付錢了事？那就是心虛吧」'],
                ],
                ev: {
                  icon: '💸',
                  title: '花錢沒消災',
                  climax: true,
                  choices: [{ label: '吞下去', effects: { cash: -50000, demand: { mult: 0.9, months: 1 }, review: [2, '聽說這家付錢讓網紅下架負評'] }, result: '有些仗，躲是躲不掉的。' }],
                },
              },
      ],
    },
    {
      id: 'takeover',
      title: '三天之內，收購你',
      poster: '🦈',
      cond: (s) => s.day >= 30 && s.level >= 6,
      eps: [
        (s) => ({
          lines: [
            ['旁白', '一位穿著高級西裝的男人，把一張支票推到你面前。'],
            ['總裁', `${s.shopName}，我出 ${'$' + Math.round(s.ind.cash * 8).toLocaleString()}，連招牌一起買下來。`],
            ['總裁', '給你三天考慮。不賣的話……這條街以後會很難做生意。'],
          ],
          ev: {
            icon: '🦈',
            title: '財團要收購你',
            choices: [
              { label: '「不賣」', effects: {}, set: { refuse: true }, result: '總裁笑了：「年輕人，有骨氣。我們走著瞧。」' },
              { label: '「讓我想想」', effects: {}, set: { refuse: false }, result: '總裁把名片留在桌上：「三天。」' },
            ],
          },
          teaser: '下集預告：房東打電話來：「下個月起，房租要漲三成。」',
          next: 3,
        }),
        (s, st) => ({
          lines: [
            ['房東', '老闆，不好意思……有人出更高的價錢要租你的店面。下個月起，房租要漲三成。'],
            ['員工', '老闆，這一定是那個財團搞的鬼！'],
          ],
          ev: {
            icon: '🏠',
            title: '房東漲租',
            choices: [
              { label: '找老客人、員工一起想辦法', effects: { morale: 5 }, set: { fight: true }, result: '員工們開了一整晚的會。熟客說：「需要幫忙就說。」' },
              { label: '打給總裁：「我們談談」', effects: {}, set: { fight: false }, result: '總裁接起電話，好像一直在等你。' },
            ],
          },
          teaser: '下集預告：記者會上，你說出了一句改變一切的話……',
          next: 3,
        }),
        (s, st) =>
          st.fight
            ? {
                lines: [
                  ['旁白', '熟客們自發在網路上發起「守護巷口小店」，房東被輿論逼著撤回漲租。'],
                  ['旁白', '更狠的是：有人爆料財團用相同手法逼走了十幾間老店。'],
                  ['總裁', '……（在記者會上鞠躬道歉）'],
                ],
                ev: {
                  icon: '📣',
                  title: '小蝦米對抗大鯨魚',
                  climax: true,
                  choices: [{ label: '「謝謝每一位守護這間店的人」', effects: { morale: 10, followers: 3000, demand: { mult: 1.2, months: 2 }, review: [5, '巷口小店打贏財團！支持！'] }, result: '這一戰，讓你的店變成了一個象徵。' }],
                },
              }
            : {
                lines: [
                  ['總裁', '想通了？我加碼，再多兩成。'],
                  ['旁白', '支票上的數字，比你這輩子見過的都大。'],
                ],
                ev: {
                  icon: '✍️',
                  title: '簽，還是不簽？',
                  climax: true,
                  choices: [
                    { label: '不簽。咬牙吞下漲租', effects: { costMult: { rent: 0.3 }, morale: 4 }, result: '房租漲了，但店還是你的。' },
                    { label: '簽約：把一半股份賣給他', effects: { cash: Math.round(s.ind.cash * 5), jerk: 5, morale: -10 }, result: '錢入帳了。員工看你的眼神，有點不一樣了。' },
                  ],
                },
              },
      ],
    },
    {
      id: 'ex',
      title: '前員工的復仇',
      poster: '🔥',
      cond: (s) => s.day >= 20 && (s.leftCount || 0) >= 1,
      eps: [
        (s) => ({
          lines: [
            ['旁白', '以前在你店裡做過的人，在兩條街外開了一間一模一樣的店。'],
            ['員工', '老闆，他連菜單都抄我們的，價格還便宜十塊！'],
          ],
          ev: {
            icon: '🔥',
            title: '前員工開店對打',
            choices: [
              { label: '去他店裡，祝他開幕順利', effects: {}, set: { grace: true }, result: '他有點不知所措：「老闆……謝謝。」' },
              { label: '跟著降價，看誰撐得久', effects: { price: -0.08 }, set: { grace: false }, result: '價格戰開打了。' },
            ],
          },
          teaser: '下集預告：你的兩個員工，下班後偷偷走進了他的店……',
          next: 3,
        }),
        (s, st) => ({
          lines: [
            ['旁白', '你的兩個員工，下班後偷偷走進了他的店。'],
            ['員工', '老闆……他開的時薪比你多二十塊。'],
          ],
          ev: {
            icon: '🕵️',
            title: '挖角',
            choices: [
              { label: '全員時薪 +$20，留住大家', effects: { wageMult: 0.08, morale: 8 }, set: { keep: true }, result: '大家鬆了一口氣：「老闆，我們不走。」' },
              { label: '「要走就走，不留」', effects: { morale: -8 }, set: { keep: false }, result: '店裡的氣氛冷到結冰。' },
            ],
          },
          teaser: '下集預告：凌晨兩點，你接到他打來的電話……',
          next: 4,
        }),
        (s, st) =>
          st.grace || st.keep
            ? {
                lines: [
                  ['旁白', '凌晨兩點，電話響了。'],
                  ['前員工', '老闆……我撐不下去了。店要收了，但我不想讓跟著我的人失業。'],
                  ['前員工', '你願不願意……把他們收回去？我自己也想回來。'],
                ],
                ev: {
                  icon: '🤝',
                  title: '浪子回頭',
                  climax: true,
                  choices: [
                    { label: '「回來吧，位子一直都在」', effects: { staff: 1, morale: 10, rivalHit: 0.3, review: [5, '聽說老闆收留了對手的員工，好有格局'] }, result: '他回來的第一天，比誰都早到。' },
                    { label: '只收員工，不收他', effects: { staff: 1, rivalHit: 0.3 }, result: '他點點頭：「我懂。」' },
                  ],
                },
              }
            : {
                lines: [
                  ['旁白', '他的店越開越好，還上了美食節目。'],
                  ['前員工', '（接受採訪）我在前老闆那裡學到最重要的一件事：千萬不要變成他那樣的老闆。'],
                ],
                ev: {
                  icon: '📺',
                  title: '被當成反面教材',
                  climax: true,
                  choices: [{ label: '關掉電視', effects: { demand: { mult: 0.9, months: 1 }, jerk: 3, review: [2, '看了節目，原來這家老闆以前是這樣'] }, result: '那一集，你看了三遍。' }],
                },
              },
      ],
    },
  ];
})(typeof window !== 'undefined' ? window : globalThis);
