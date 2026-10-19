// AI 玩家：照一般玩家會做的事去經營，試著撐滿一年破關
// 只用遊戲裡玩家按得到的操作（招人、排班、調薪、進貨、打掃、買設備、選事件、發文、開分店……）
// 用法：node tools/playtest.js [難度] [產業] [隨機種子]
for (const f of ['data', 'fun', 'weird', 'activities', 'city', 'plots', 'portraits', 'industries', 'sim']) require(`../js/${f}.js`);
const { Sim, CATALOG, catalogById } = globalThis.BossSim;
const Fun = globalThis.BossFun;

const mode = process.argv[2] || 'normal';
const indId = process.argv[3] || 'breakfast';
const seed = Number(process.argv[4]) || 1;

// 固定種子的亂數，結果可以重現
function mulberry(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const log = [];
const note = (t) => log.push(t);
let s;

// 事件：不走慣老闆路線，選慣老闆指數不會上升、又最划算的選項（不玩小遊戲）
function pickChoice(ev) {
  let best = -1;
  let bestScore = -Infinity;
  ev.ev.choices.forEach((c, i) => {
    if (c.minigame) return;
    const fx = s.resolveEffects(c);
    if (fx.brawl || fx.leave) return;
    let score = (fx.cash || 0) / 1000 + (fx.morale || 0) * 2 - (fx.jerk || 0) * 4 + (fx.followers || 0) / 300 + (fx.rivalHit ? 3 : 0);
    if (fx.jerk > 0) score -= 20;
    if (fx.raiseOf) score += 4;
    if (fx.karenServe) score -= 2;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best < 0 ? ev.ev.choices.findIndex((c) => !c.minigame) : best;
}

// 找一個放得下的位置
function tryPlace(type) {
  const def = catalogById[type];
  if (!def || s.cash < def.price + 20000 || !s.unlocked(def)) return null;
  for (let z = 0; z < s.H; z++) {
    for (let x = 0; x < s.W; x++) {
      for (let rot = 0; rot < 4; rot++) {
        if (s.canPlace(type, x, z, rot)) {
          const o = s.place(type, x, z, rot);
          if (o) {
            note(`第 ${s.day} 天：買了${def.name}`);
            return o;
          }
        }
      }
    }
  }
  return null;
}

const has = (type) => s.objects.some((o) => o.type === type);
const lanes = () => s.stations.reduce((n, o) => n + o.lanes.filter((l) => !l.self).length, 0);
let angryStreak = 0;
let lastFix = 0;

// 每天打烊後做的事
function daily(r) {
  // 政策：守法經營
  Object.assign(s.policy, { insurance: true, overtimePay: true, breaks: true, restDays: 'rotate', closingClean: true, autoStock: true });
  const span = (s.policy.close - s.policy.open + 1440) % 1440 || 1440;
  if (span > 9 * 60 && s.policy.shifts < 2) s.policy.shifts = 2;

  // 人手：服務位 × 班數，再多一個人輪休；最近在虧錢就不再多請
  const angryRate = r.visitors ? r.angry / r.visitors : 0;
  angryStreak = angryRate > 0.06 ? angryStreak + 1 : 0;
  const base = lanes() * s.policy.shifts;
  const need = Math.max(2, base + Math.ceil(base / 4));
  const recent = s.history.slice(-2);
  const losing = recent.length === 2 && recent.every((h) => h.profit - (h.branches || 0) < -5000) && s.branches.length === 0;
  if ((s.staff.length < need || (angryStreak >= 2 && s.staff.length < need + 1)) && !losing && s.cash > 40000 && s.candidates.length) {
    let bi = 0;
    s.candidates.forEach((c, i) => {
      if (c.skill - c.wage / 10 > s.candidates[bi].skill - s.candidates[bi].wage / 10) bi = i;
    });
    s.hire(bi);
    angryStreak = 0;
  }
  // 薪水至少照行情
  for (const e of s.staff) if (e.wage < s.marketWage) s.setWage(e, s.marketWage);
  // 心情差的人：稱讚、請飲料、聊天
  for (const e of s.staff) {
    if (e.mood < 60) s.praise(e);
    if (e.mood < 50) s.treat(e);
    if (e.mood < 55) s.chat(e);
  }
  // 每兩週辦一次活動（挑大家喜歡、花費不大的）
  if (s.day % 14 === 0 && s.cash > 150000) {
    const ids = s.staff.map((e) => e.id);
    const a = s.morale < 55 ? 'hotpot' : 'stirfry';
    if (s.holdActivity(a, ids)) note(`第 ${s.day} 天：辦了${Fun.ACTIVITIES.find((x) => x.id === a).name}`);
  }

  // 清潔
  if (s.grime > 18 && s.cash > s.deepCleanCost + 30000) s.deepClean();

  // 設備與擺設
  if (!s.restSpots().length) tryPlace('breaktable');
  if (s.monthOfYear >= 5 && s.monthOfYear <= 9 && !s.cooling) tryPlace('aircon') || tryPlace('fan');
  if (s.beauty < 6) tryPlace('plant');
  // 一直有人生氣：多一台設備
  const starterStations = s.ind.starter.filter(([t]) => catalogById[t].cat === 'station').length;
  if (angryRate > 0.08 && s.staff.length >= base && s.stations.length < starterStations + 2 && s.day - lastFix > 14 && s.cash > 200000) {
    const st = CATALOG.filter((d) => d.cat === 'station' && (!d.industries || d.industries.includes(s.ind.id)) && s.unlocked(d) && !d.selfServe).sort((a, b) => (b.speed || 1) - (a.speed || 1))[0];
    if (st && tryPlace(st.id)) lastFix = s.day;
  }
  if (s.ind.dineIn && s.objects.filter((o) => o.def.cat === 'seat').length < 3) tryPlace('table4');
  if (!s.objects.some((o) => o.def.cat === 'wait') && !s.ind.dineIn) tryPlace('waitbench');
  // 擴店
  const next = [null, 'medium', 'large'][s.lotIdx + 1];
  if (next) {
    const lot = globalThis.BossIndustries.LOTS[s.lotIdx + 1];
    const last4 = s.history.slice(-4);
    const earning = last4.length === 4 && last4.every((h) => h.profit - (h.branches || 0) - (h.other || 0) > 15000);
    if (s.level >= (lot.lv || 0) && earning && s.cash > lot.cost + 250000 && s.upgradeLot()) note(`第 ${s.day} 天：擴建成${lot.name}`);
  }
  // 研發新品
  for (const p of s.ind.products) if (p.rd && !s.recipes.has(p.id) && s.level >= (p.lv || 1) && s.cash > p.rd + 150000 && s.research(p.id)) note(`第 ${s.day} 天：研發了${p.name}`);

  // 價格跟著物價
  for (const p of s.ind.products) s.prices[p.id] = Math.round((p.price * s.idx.cpi) / 5) * 5;

  // 小編：挑本週時事的內容發文
  if (s.canPost) {
    const t = s.social.trend;
    const body = Fun.POST_BODIES.find((b) => t && b.trend === t.id && !b.risky) || Fun.POST_BODIES.find((b) => b.id === 'staff');
    s.post('boss', body.id, 'tag');
  }

  // 對手：發傳單；有錢就談聯名
  if (s.rival && !s.rival.closed && s.rival.strength > 0.5 && s.cash > 50000 && s.day % 5 === 0) s.flyers();
  if (!s.boss.away && s.cash > 250000 && !s.collabs.length && s.day % 10 === 0) {
    const pt = Fun.PARTNERS.find((p) => !s.collabReady(p) && s.cash > p.cost + 200000);
    if (pt) s.startCollab(pt.id);
  }
  // 分店
  if (s.level >= 5 && s.branches.length < 3) {
    // 挑估算淨利最高的地點
    const I = globalThis.BossIndustries;
    const cand = I.BRANCH_SITES.filter((st) => !s.branches.some((b) => b.site === st.id) && s.cash > s.siteCost(st) + 300000).sort((a, c) => s.estimateSite(c, 'medium').profit - s.estimateSite(a, 'medium').profit)[0];
    const b = cand && s.openBranch(cand.id, 'medium');
    if (b) note(`第 ${s.day} 天：在${s.siteOf(b).city}${b.district}開分店`);
  }
  // 現金太少：借錢；有餘裕：還錢
  if (s.cash < 30000 && s.loan < 600000) s.borrow(100000);
  if (s.cash > 400000 && s.loan > 0) s.repay(100000);
}

function play() {
  const rng = mulberry(seed * 7919 + mode.length * 131 + indId.length);
  s = new Sim(indId, { mode, rng, shopName: '測試小店' });
  const weekly = [];
  s.cb = {
    event: (ev) => s.resolve(ev, pickChoice(ev)),
    ignored: () => {},
    dayEnd: daily,
    weekEnd: (r) => {
      weekly.push(r);
      if (r.victory) note(`🎉 第 ${s.week - 1} 週破關：${r.victory.medal} ${r.victory.title}（${r.victory.score} 分）`);
    },
    notify: () => {},
    tripDone: () => {},
  };
  while (!s.over && !s.wonYear && s.day < 400) s.tick(30);
  return weekly;
}

const t0 = Date.now();
const weekly = play();
const ind = s.ind;
const D = globalThis.BossIndustries.DIFFICULTY[mode];
console.log(`\n${ind.icon} ${ind.name}・${D.name}模式（種子 ${seed}，${((Date.now() - t0) / 1000).toFixed(1)} 秒）`);
const q = (n) => weekly[Math.min(weekly.length - 1, n)];
for (const w of [0, 3, 7, 11, 15, 23, 31, 39, 47]) {
  const r = q(w);
  if (!r) continue;
  console.log(`  第${String(r.week).padStart(2)}週 淨利${String(Math.round(r.profit)).padStart(8)} ★${r.rating.toFixed(2)} 慣老闆${String(Math.round(r.jerk)).padStart(3)} 心情${String(Math.round(r.morale)).padStart(3)} 清潔${String(r.clean).padStart(3)}${r.rival ? ` 對手${r.rival.closed ? '收攤' : r.rival.strength.toFixed(2)}` : ''}`);
}
console.log(`  結果：${s.over ? `❌ ${s.ending.title}（第 ${s.day} 天）` : s.wonYear ? `✅ 破關 ${s.victoryInfo.medal} ${s.victoryInfo.title}（${s.victoryInfo.score} 分）` : '⏳ 還沒結束'}`);
console.log(`  現金 $${Math.round(s.cash).toLocaleString()}・借款 $${s.loan.toLocaleString()}・員工 ${s.staff.length} 人・Lv.${s.level}・分店 ${s.branches.length}・成就 ${s.achievements.size}`);
if (s.victoryInfo) console.log(`  評分：${s.victoryInfo.parts.map(([k, p, t]) => `${k} ${p}（${t}）`).join('、')}`);
console.log(`  大事記：${log.slice(0, 14).join('；')}`);
