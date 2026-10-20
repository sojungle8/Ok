// 斜槓員工：有副業的人。各有特長，也各有麻煩；每個人還有一段兩幕的人生故事，你的選擇會留下後果
// perk：speed 做事速度、learn 學習、night 晚班疲勞、post 貼文讚數、charm 學生客人的評價
(function (root) {
  const Fun = root.BossFun;
  if (!Fun) return;

  const ta = (e) => (e && e.gender === 'f' ? '她' : '他');

  Fun.SIDE_JOBS = {
    delivery: {
      icon: '🛵',
      name: '外送員',
      perk: '手腳快、很會抓動線（做事速度 +6%）',
      speed: 1.06,
      conflict: (s, e) => ({
        id: 'side_delivery',
        icon: '🛵',
        title: `${e.name}想早點下班去跑單`,
        text: `${e.name}看了一下手機：「老闆，今天下雨，外送單價加成很高……我可以早一個小時走嗎？」`,
        choices: [
          { label: '好，路上小心', effects: { sendHomeOf: e.id, moodOf: [[e.id, 8]] }, result: `${e.name}穿上雨衣衝出去：「謝謝老闆！」` },
          { label: '今天人手不夠，下次吧', effects: { moodOf: [[e.id, -6]] }, result: `${e.name}嘆了口氣，把手機收起來。` },
          { label: '「上班時間不要想別的工作」', quote: '你到底是做哪邊的？', effects: { moodOf: [[e.id, -12]], jerk: 1 }, result: `${e.name}沒說話。後來同事說，${ta(e)}在找別的店。` },
        ],
        ignore: { effects: { moodOf: [[e.id, -4]] }, result: `${e.name}等不到你的回答，只好做到下班。` },
      }),
      story: {
        start: (s, e) => ({
          id: 'story_delivery1',
          icon: '🛵',
          title: `外送平台在搶${e.name}`,
          text: `${e.name}跟你坦白：「最近外送平台在衝單，跑一天比在這裡做一天還多。我其實比較喜歡店裡的人……但房租真的很重。」`,
          choices: [
            { label: '幫你加薪 $15，留下來', note: '時薪 +$15', effects: { raiseOf: [e.id, 15], moodOf: [[e.id, 10]], storyOf: [e.id, 'a'] }, result: `${e.name}愣了一下，然後笑了：「那我把外送的時間再縮少一點。」` },
            { label: '班排少一點，讓你兩邊兼顧', effects: { moodOf: [[e.id, 6]], storyOf: [e.id, 'b'] }, result: `${e.name}鬆了一口氣：「謝謝你體諒。」` },
          ],
          ignore: { effects: { moodOf: [[e.id, -6]], storyOf: [e.id, 'b'] }, result: `你沒回應，${e.name}只好繼續兩邊跑。` },
        }),
        a: (s, e) => ({
          id: 'story_delivery2a',
          icon: '🌟',
          title: `${e.name}把外送辭了`,
          text: `${e.name}說：「我想清楚了，比起一直趕單，我比較想在這裡學東西。可以讓我多學一點嗎？」`,
          choices: [
            { label: '好，從明天開始教你更難的', effects: { skillOf: [[e.id, 10]], ambitionOf: [e.id, 20], moodOf: [[e.id, 8]] }, result: `${e.name}拿出筆記本，抄得比誰都認真。（技能 +10，比較想往上爬了）` },
            { label: '先把現在的做好就好', effects: { moodOf: [[e.id, 2]] }, result: `${e.name}點點頭。` },
          ],
          ignore: { effects: {}, result: `${e.name}自己默默多看多學。` },
        }),
        b: (s, e) => ({
          id: 'story_delivery2b',
          icon: '🚑',
          title: `${e.name}跑外送時出車禍`,
          text: `${e.name}傳訊息來：「老闆抱歉……昨天跑單被車擦撞，手腕扭到，這週可能沒辦法上班。」外送平台說${ta(e)}是「承攬」，不算職災。`,
          choices: [
            { label: '包個慰問金，安心休養', note: '$3,000', effects: { cash: -6000, moodOf: [[e.id, 15]], morale: 2, offDay: e.id }, result: `${e.name}傳了一個哭臉：「我一定會回去的。」同事們也覺得這間店有溫度。`, tip: '外送員多為承攬關係，沒有勞保職災給付；這也是很多人寧可要一份有勞健保的正職的原因。' },
            { label: '「好好休息，班我來喬」', effects: { moodOf: [[e.id, 8]], offDay: e.id }, result: `${e.name}回了一個「謝謝」。` },
            { label: '「你自己要兼差的，班表不能空」', quote: '找不到人代班就不用回來了。', effects: { leave: e.id, jerk: 3 }, result: `${e.name}沒再回來。群組裡沒人敢說話。` },
          ],
          ignore: { effects: { moodOf: [[e.id, -10]], offDay: e.id }, result: `${e.name}一直沒等到你的回覆。` },
        }),
      },
    },
    streamer: {
      icon: '📱',
      name: '直播主',
      perk: '很懂社群（小編貼文的讚 +25%）',
      post: 1.25,
      conflict: (s, e) => ({
        id: 'side_streamer',
        icon: '📱',
        title: `${e.name}上班時偷開直播`,
        text: `有客人小聲跟你說：「欸，那個店員是不是在直播？我剛剛好像被拍進去了。」你一看，${e.name}的手機正架在角落。`,
        choices: [
          { label: '私下提醒：要拍可以，不能拍到客人', effects: { moodOf: [[e.id, -3]] }, result: `${e.name}吐吐舌頭：「我會用貼紙遮起來啦。」` },
          { label: '上班時間禁止直播', effects: { moodOf: [[e.id, -8]] }, result: `${e.name}默默把手機收起來。` },
          { label: '沒關係，幫店裡打廣告', effects: { followers: 300, review: [2, '我在店裡吃東西被拍上直播，完全沒問過我'] }, result: '粉絲多了一些，但那位客人留了一則負評。', tip: '在營業場所拍攝、公開他人可辨識的影像，可能涉及個人資料保護與肖像權。' },
        ],
        ignore: { effects: { review: [2, '店員上班一直在直播，還拍到我'] }, result: `${e.name}播了一整個下午。` },
      }),
      story: {
        start: (s, e) => ({
          id: 'story_streamer1',
          icon: '📱',
          title: `${e.name}想幫店裡開直播`,
          text: `${e.name}拿手機給你看：「我的頻道有一萬多人追蹤，要不要每週在店裡開一次直播？我幫你介紹店裡，你給我一點分潤就好。」`,
          choices: [
            { label: '好啊，一起合作', note: '$2,000 分潤', effects: { cash: -4000, followers: 500, moodOf: [[e.id, 10]], storyOf: [e.id, 'a'] }, result: `第一場直播就有上百人在線上，${e.name}開心得跟什麼一樣。` },
            { label: '婉拒：店裡想單純一點', effects: { moodOf: [[e.id, -5]], storyOf: [e.id, 'b'] }, result: `${e.name}有點可惜：「好吧，那我自己播就好。」` },
          ],
          ignore: { effects: { storyOf: [e.id, 'b'] }, result: `${e.name}等不到答案，就沒再提了。` },
        }),
        a: (s, e) => ({
          id: 'story_streamer2a',
          icon: '🔥',
          title: `${e.name}的直播爆紅了`,
          text: `${e.name}在直播上分享「我們老闆都準時發薪、還會問我們累不累」，這段被剪成短影音，一天破十萬觀看。現在有人說要來店裡朝聖。`,
          choices: [
            { label: '辦一場粉絲見面會', note: '$5,000', effects: { cash: -10000, followers: 1500, demand: { mult: 1.12, months: 2 }, moodOf: [[e.id, 12]] }, result: '當天排隊排到街角，大家都在跟店員合照。' },
            { label: '低調就好，照常營業', effects: { followers: 600 }, result: '人潮來了又走，但粉絲多了一些。' },
          ],
          ignore: { effects: { followers: 400 }, result: '熱度慢慢退了。' },
        }),
        b: (s, e) => ({
          id: 'story_streamer2b',
          icon: '🎙️',
          title: `${e.name}在直播上聊到你`,
          text: s.morale >= 60 ? `有粉絲在${e.name}的直播問：「你打工的店怎麼樣？」${e.name}說：「老闆人不錯，就是有點古板啦哈哈。」` : `有粉絲在${e.name}的直播問：「你打工的店怎麼樣？」${e.name}嘆了口氣：「……不想講，下一題。」聊天室開始猜是哪一間店。`,
          choices: [
            { label: '找機會跟他聊聊工作的感受', effects: { moodOf: [[e.id, 8]], followers: s.morale >= 60 ? 200 : 0 }, result: `${e.name}有點驚訝你有在看，聊完之後好像比較放得開了。` },
            { label: '當作沒看到', effects: s.morale >= 60 ? { followers: 100 } : { followers: -200, jerk: 1 }, result: s.morale >= 60 ? '有幾個粉絲順路來店裡看看。' : '有人在留言區猜到了是你的店。' },
          ],
          ignore: { effects: {}, result: '你沒有特別做什麼。' },
        }),
      },
    },
    student: {
      icon: '🎓',
      name: '研究生',
      perk: '學東西很快（技能成長 +40%）',
      learn: 1.4,
      conflict: (s, e) => ({
        id: 'side_student',
        icon: '📝',
        title: `${e.name}明天要考試`,
        text: `${e.name}一臉憔悴：「老闆，明天期中考，我昨天熬夜到三點……可以明天請假一天嗎？」`,
        choices: [
          { label: '准假，考試加油', effects: { offDay: e.id, moodOf: [[e.id, 8]] }, result: `${e.name}鬆了一口氣：「考完請大家喝飲料！」` },
          { label: '今天先早點下班回去念書', effects: { sendHomeOf: e.id, moodOf: [[e.id, 5]] }, result: `${e.name}收拾東西：「謝謝老闆！」` },
          { label: '「班已經排好了，自己想辦法」', effects: { moodOf: [[e.id, -12]] }, result: `${e.name}上班時一直在偷看筆記。` },
        ],
        ignore: { effects: { moodOf: [[e.id, -5]] }, result: `${e.name}只好硬撐著上班。` },
      }),
      story: {
        start: (s, e) => ({
          id: 'story_student1',
          icon: '📊',
          title: `${e.name}的論文想訪問客人`,
          text: `${e.name}在念消費行為：「老闆，我的論文要做問卷，可以在店裡請客人填嗎？我順便幫你分析一下客人的資料。」`,
          choices: [
            { label: '好，順便幫店裡做分析', effects: { moodOf: [[e.id, 8]], storyOf: [e.id, 'a'] }, result: `${e.name}設計了一份很短的問卷，填完送一張小貼紙。` },
            { label: '不要打擾客人', effects: { moodOf: [[e.id, -4]], storyOf: [e.id, 'b'] }, result: `${e.name}點點頭：「那我再找別的地方。」` },
          ],
          ignore: { effects: { storyOf: [e.id, 'b'] }, result: `${e.name}自己去找了別的地方做問卷。` },
        }),
        a: (s, e) => ({
          id: 'story_student2a',
          icon: '💡',
          title: `${e.name}的分析報告出來了`,
          text: `${e.name}交給你一份報告：「我發現客人最在意的是等待時間，還有我們有幾樣東西幾乎沒人點，一直在浪費{w:supplies}。」`,
          choices: [
            { label: '照報告調整進貨', effects: { costMult: { materials: -0.04 }, moodOf: [[e.id, 10]] }, result: `{w:supplies}成本降了一點。${e.name}說這段寫進論文裡，教授很滿意。` },
            { label: '謝謝，我參考看看', effects: { moodOf: [[e.id, 3]] }, result: `${e.name}有點可惜，但還是很開心有人看。` },
          ],
          ignore: { effects: {}, result: '報告被壓在收銀機下面。' },
        }),
        b: (s, e) => ({
          id: 'story_student2b',
          icon: '🎓',
          title: `${e.name}要畢業了`,
          text: `${e.name}拿著畢業照來找你：「我口試過了！有公司找我去當正職……但其實我也有想過，留在這裡往上爬。」`,
          choices: [
            { label: '提一個正職的位子給你', note: '時薪 +$30', effects: { raiseOf: [e.id, 30], ambitionOf: [e.id, 25], moodOf: [[e.id, 12]] }, result: `${e.name}考慮了一個晚上，決定留下來：「我想看看這間店能長多大。」` },
            { label: '恭喜你，好好去闖', effects: { leave: e.id, morale: 2, jerk: -1 }, result: `大家幫${e.name}辦了一個小小的歡送會。` },
          ],
          ignore: { effects: { leave: e.id }, result: `${e.name}最後還是去了那間公司。` },
        }),
      },
    },
    drummer: {
      icon: '🥁',
      name: '樂團鼓手',
      perk: '夜貓子體質（晚班比較不累）',
      night: 0.7,
      conflict: (s, e) => ({
        id: 'side_drummer',
        icon: '🎸',
        title: `${e.name}明天有演出`,
        text: `${e.name}：「老闆，我們樂團明天在 Live House 有一場，下午要彩排……可以跟人換班嗎？」`,
        choices: [
          { label: '去吧，演出順利', effects: { offDay: e.id, moodOf: [[e.id, 8]] }, result: `${e.name}比了一個搖滾手勢。` },
          { label: '「不能每次都這樣」', effects: { moodOf: [[e.id, -10]] }, result: `${e.name}沒去彩排，演出時一直出錯。` },
        ],
        ignore: { effects: { moodOf: [[e.id, -5]] }, result: `${e.name}自己找同事換了班。` },
      }),
      story: {
        start: (s, e) => ({
          id: 'story_drummer1',
          icon: '🎟️',
          title: `${e.name}的樂團要辦售票演出`,
          text: `${e.name}有點不好意思：「我們第一次辦售票演出，可以在店門口貼海報嗎？如果大家能來捧場就更好了……」`,
          choices: [
            { label: '貼！店休那天大家一起去', note: '$3,000 門票', effects: { cash: -6000, morale: 4, moodOf: [[e.id, 15]], storyOf: [e.id, 'a'] }, result: `演出那天，台下有一排穿著店裡制服的人在大喊${e.name}的名字。` },
            { label: '海報貼門口就好', effects: { moodOf: [[e.id, 5]], storyOf: [e.id, 'a'] }, result: '海報貼在門口，有幾個客人拿手機拍了下來。' },
            { label: '店門口不適合貼這個', effects: { moodOf: [[e.id, -8]], storyOf: [e.id, 'b'] }, result: `${e.name}默默把海報收回去。` },
          ],
          ignore: { effects: { storyOf: [e.id, 'b'] }, result: `${e.name}最後沒再問。` },
        }),
        a: (s, e) => ({
          id: 'story_drummer2a',
          icon: '🎶',
          title: `${e.name}的樂團小紅了`,
          text: `${e.name}的樂團上了音樂節，訪問時說「我在一間很棒的店打工」。開始有樂迷來店裡找${ta(e)}簽名。`,
          choices: [
            { label: '在店裡辦一場不插電小演出', note: '$4,000', effects: { cash: -8000, followers: 900, demand: { mult: 1.08, months: 2 }, moodOf: [[e.id, 12]] }, result: '那晚店裡擠滿了人，大家跟著打拍子。' },
            { label: '恭喜，記得簽名不要影響工作', effects: { followers: 300 }, result: `${e.name}笑著說：「知道啦。」` },
          ],
          ignore: { effects: { followers: 200 }, result: '樂迷們偶爾來店裡看看。' },
        }),
        b: (s, e) => ({
          id: 'story_drummer2b',
          icon: '🚐',
          title: `${e.name}的樂團要巡迴`,
          text: `${e.name}：「我們樂團接到兩週的巡迴……這可能是我們唯一的機會。可以留職停薪嗎？」`,
          choices: [
            { label: '去吧，位子幫你留著', effects: { offDay: e.id, moodOf: [[e.id, 15]], morale: 2 }, result: `${e.name}抱了你一下：「我回來一定加倍努力！」` },
            { label: '「那你乾脆辭職好了」', effects: { leave: e.id, jerk: 1 }, result: `${e.name}收拾了置物櫃，跟大家揮手道別。` },
          ],
          ignore: { effects: { leave: e.id }, result: `${e.name}留了一張紙條，就去巡迴了。` },
        }),
      },
    },
    tutor: {
      icon: '📚',
      name: '補教助教',
      perk: '很會跟學生聊天（學生客人的評價比較好）',
      charm: 0.3,
      conflict: (s, e) => ({
        id: 'side_tutor',
        icon: '📚',
        title: `補習班臨時叫${e.name}去代課`,
        text: `${e.name}接到電話：「老闆，補習班老師生病，叫我晚上去代課……我可以提早兩小時走嗎？」`,
        choices: [
          { label: '去吧，學生要緊', effects: { sendHomeOf: e.id, moodOf: [[e.id, 6]] }, result: `${e.name}背起包包：「明天我早點來！」` },
          { label: '「你要選一邊」', effects: { moodOf: [[e.id, -10]] }, result: `${e.name}打電話跟補習班說不行，掛掉後臉很臭。` },
        ],
        ignore: { effects: { moodOf: [[e.id, -4]] }, result: `${e.name}只好推掉代課。` },
      }),
      story: {
        start: (s, e) => ({
          id: 'story_tutor1',
          icon: '🧑‍🏫',
          title: `補習班想挖${e.name}當正職`,
          text: `${e.name}：「補習班說要升我當正式老師……但我其實也很喜歡這裡。老闆，你覺得呢？」`,
          choices: [
            { label: '請你來當新人的訓練講師', note: '時薪 +$20', effects: { raiseOf: [e.id, 20], lead: [e.id, 10], moodOf: [[e.id, 10]], storyOf: [e.id, 'a'] }, result: `${e.name}眼睛一亮：「教人我最會了！」` },
            { label: '支持你去追夢', effects: { leave: e.id, morale: 1, jerk: -1 }, result: `${e.name}最後一天上班，留了一本手寫的工作筆記給新人。` },
            { label: '「做這行比補習班有前途」', effects: { moodOf: [[e.id, -3]], storyOf: [e.id, 'b'] }, result: `${e.name}笑了笑，沒說什麼。` },
          ],
          ignore: { effects: { storyOf: [e.id, 'b'] }, result: `${e.name}決定再想一想。` },
        }),
        a: (s, e) => ({
          id: 'story_tutor2a',
          icon: '📖',
          title: `${e.name}的新人訓練`,
          text: `${e.name}整理出一套新人訓練：「每個新人跟我上三堂課，第一週就能上手。」`,
          choices: [
            { label: '全店新人都去上', note: '$2,000 教材', effects: { cash: -4000, skillAll: [5, 50], moodOf: [[e.id, 8]] }, result: '技能 50 以下的同事都上了課（技能 +5）。' },
            { label: '有需要的再去', effects: { moodOf: [[e.id, 3]] }, result: `${e.name}說：「好，那我隨時都可以。」` },
          ],
          ignore: { effects: {}, result: '訓練教材放在員工休息區。' },
        }),
        b: (s, e) => ({
          id: 'story_tutor2b',
          icon: '🚪',
          title: `${e.name}還是想去教書`,
          text: `${e.name}：「老闆，我想了很久……我還是比較想當老師。下個月我就要去補習班了。」`,
          choices: [
            { label: '祝福你，隨時歡迎回來', effects: { leave: e.id, morale: 2 }, result: `${e.name}說：「以後學生問我打工去哪，我都推這裡。」` },
            { label: '加薪 $40 留你', effects: { raiseOf: [e.id, 40], moodOf: [[e.id, 4]] }, result: `${e.name}留下來了，但偶爾還是會看著補習班的招牌發呆。` },
          ],
          ignore: { effects: { leave: e.id }, result: `${e.name}默默地離職了。` },
        }),
      },
    },
    designer: {
      icon: '🎨',
      name: '接案設計師',
      perk: '美感很好（貼文的讚 +15%、做事細心）',
      post: 1.15,
      conflict: (s, e) => ({
        id: 'side_designer',
        icon: '⏰',
        title: `${e.name}今天截稿`,
        text: `${e.name}上班一直在恍神，還打翻了東西：「對不起……今天晚上要交稿，昨天整晚沒睡。」`,
        choices: [
          { label: '今天先回去，把稿子交了', effects: { sendHomeOf: e.id, moodOf: [[e.id, 8]] }, result: `${e.name}深深鞠了一個躬。` },
          { label: '去休息室睡 30 分鐘', effects: { moodOf: [[e.id, 5]] }, result: `${e.name}睡醒後精神好多了。` },
          { label: '「上班就要專心」', effects: { moodOf: [[e.id, -10]] }, result: `${e.name}撐著做完，回家後稿子也沒交好。` },
        ],
        ignore: { effects: { moodOf: [[e.id, -4]] }, result: `${e.name}恍神了一整天。` },
      }),
      story: {
        start: (s, e) => ({
          id: 'story_designer1',
          icon: '🖌️',
          title: `${e.name}想幫店裡重新設計`,
          text: `${e.name}拿出平板：「老闆，我畫了新的招牌和{w:menu}，你看看？算你友情價就好，也可以放進我的作品集。」`,
          choices: [
            { label: '好！照行情付你', note: '$8,000', effects: { cash: -16000, demand: { mult: 1.06, months: 8 }, moodOf: [[e.id, 15]], storyOf: [e.id, 'a'] }, result: '新招牌掛上去之後，好幾個路人停下來拍照。' },
            { label: '「員工幫忙是應該的吧？」', quote: '你本來就在這裡上班啊。', effects: { demand: { mult: 1.06, months: 8 }, moodOf: [[e.id, -14]], jerk: 2, storyOf: [e.id, 'b'] }, result: `新招牌很好看，但${e.name}再也沒提過設計的事。`, tip: '員工在職務以外提供的專業服務，例如設計、攝影，應該另外付費；要求員工無償接案，是常見的職場剝削。' },
            { label: '目前不需要', effects: { moodOf: [[e.id, -3]], storyOf: [e.id, 'done'] }, result: `${e.name}把平板收起來：「好喔。」` },
          ],
          ignore: { effects: { storyOf: [e.id, 'done'] }, result: '設計稿一直存在平板裡。' },
        }),
        a: (s, e) => ({
          id: 'story_designer2a',
          icon: '🏆',
          title: `${e.name}的設計得獎了`,
          text: `${e.name}幫店裡做的設計得了設計獎，得獎感言說：「謝謝老闆願意相信一個打工仔。」媒體想來店裡採訪。`,
          choices: [
            { label: '接受採訪，讓他當主角', effects: { followers: 1200, moodOf: [[e.id, 12]], morale: 3 }, result: `報導標題是「打工仔設計師與願意付錢的老闆」。` },
            { label: '老闆自己上鏡頭', effects: { followers: 600, moodOf: [[e.id, -6]] }, result: `報導裡${e.name}只出現了一句話。` },
          ],
          ignore: { effects: { followers: 300 }, result: '媒體自己來拍了幾張照片。' },
        }),
        b: (s, e) => ({
          id: 'story_designer2b',
          icon: '😶',
          title: `${e.name}幫對手做了設計`,
          text: `你發現${s.rival ? s.rival.name : '附近一間新店'}的新招牌，跟${e.name}的風格一模一樣。一問之下，對方「有照行情付錢」。`,
          choices: [
            { label: '「我上次應該付你錢的，抱歉」', effects: { moodOf: [[e.id, 12]], jerk: -1 }, result: `${e.name}有點意外：「……謝謝你這樣說。」` },
            { label: '「你怎麼可以幫對手！」', effects: { leave: e.id, jerk: 1 }, result: `${e.name}：「他們有付錢，你沒有。」說完就辭職了。` },
          ],
          ignore: { effects: {}, result: `你沒說什麼，${e.name}也沒說什麼。` },
        }),
      },
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
