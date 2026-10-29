// AI 玩家：照一般玩家會做的事去經營，試著撐滿一年破關
// 只用遊戲裡玩家按得到的操作（招人、排班、調薪、進貨、打掃、買設備、選事件、發文、開分店……）
// 用法：node tools/playtest.js [難度] [產業] [隨機種子]
for (const f of ['data', 'fun', 'weird', 'trends26', 'activities', 'city', 'citymap', 'plots', 'career', 'progress', 'drama', 'slash', 'sidebiz', 'backroom', 'pets', 'life', 'ev', 'portraits', 'industries', 'sim']) require(`../js/${f}.js`);
const { Sim, CATALOG, catalogById } = globalThis.BossSim;
const Fun = globalThis.BossFun;

const mode = process.argv[2] || 'normal';
const indId = process.argv[3] || 'breakfast';
const seed = Number(process.argv[4]) || 1;
// long：照章節解鎖一路玩到第二幕結局（不直接全開）；第五個參數選路線 ipo / coop
const long = process.argv.includes('long');
const routePick = process.argv.includes('coop') ? 'coop' : 'ipo';

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
    if (fx.promoteOf) score += s.promoteBlock(s.staff.find((e) => e.id === fx.promoteOf[0]) || {}, 'leader') ? -5 : 5;
    if (fx.talkLeader) score += 3;
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
const lanes = () => s.stations.reduce((n, o) => n + (o.def.side ? 0 : o.lanes.filter((l) => !l.self).length), 0) + Math.min(2, s.ownedSide().filter((b) => !b.self).length * 0.5);
let angryStreak = 0;
let lastFix = 0;

// 每天打烊後做的事
const lvDay = {};
const xpTrace = [];
function daily(r) {
  if (!lvDay[s.level]) lvDay[s.level] = s.day;
  if (s.day % 100 === 0) xpTrace.push(`${s.day}:${Math.round(s.xp)}`);
  // BASIC=1：關掉這一版新加的玩法（兼營、後場、寵物），用來比較
  const basic = !!process.env.BASIC;
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

  // 主管：挑看起來會帶人的升組長；試用期發現不會帶人就降回來；表現好的組長升店長
  for (const e of s.staff) if (e.rank && s.inTrial(e) && e.revealed && (e.lead < 35 || e.style === 'slacker')) s.demote(e);
  if (s.staff.length >= 3) {
    const pot = s.staff.filter((e) => !e.rank && e.skill >= 45 && s.day - e.hiredDay >= 7 && !s.promoteBlock(e, 'leader')).sort((a, b) => b.leadSeen - a.leadSeen)[0];
    if (pot && pot.leadSeen >= 50 && s.promote(pot, 'leader')) note(`第 ${s.day} 天：${pot.name}升組長`);
    if (!s.staff.some((e) => e.rank === 'manager')) {
      const m = s.staff.filter((e) => e.rank === 'leader' && e.revealed && !s.inTrial(e) && e.lead >= 55 && e.style !== 'strict').sort((a, b) => b.lead - a.lead)[0];
      if (m && s.promote(m, 'manager')) note(`第 ${s.day} 天：${m.name}升店長（${Fun.STYLES[m.style].name}）`);
    }
  }

  // 清潔
  if (s.grime > 18 && s.cash > s.deepCleanCost + 30000) s.deepClean();

  // 設備與擺設
  if (!s.restSpots().length) tryPlace('breaktable');
  if (s.monthOfYear >= 5 && s.monthOfYear <= 9 && !s.cooling) tryPlace('aircon') || tryPlace('fan');
  if (s.beauty < 6) tryPlace('plant');
  // 一直有人生氣：多一台設備
  const starterStations = s.ind.starter.filter(([t]) => catalogById[t].cat === 'station').length;
  // 只算本業的設備（兼營的不算）；買卡最久的那一種：每台要負擔的「點單量 × 製作時間」最多的
  const mainSt = s.stations.filter((o) => !o.def.side);
  if (angryRate > 0.08 && angryStreak >= 3 && s.staff.length >= base && mainSt.length < starterStations + 3 && s.day - lastFix > 14 && s.cash > 100000) {
    const loadOf = (id) => s.ind.products.filter((p) => p.station === id).reduce((t, p) => t + (p.weight || 1) * (p.time || 1), 0) / (mainSt.filter((o) => o.def.id === id).length + 1);
    const st = CATALOG.filter((d) => d.cat === 'station' && (!d.industries || d.industries.includes(s.ind.id)) && s.unlocked(d) && !d.selfServe && !d.side).sort((a, b) => loadOf(b.id) * (b.speed || 1) - loadOf(a.id) * (a.speed || 1))[0];
    if (st && tryPlace(st.id)) lastFix = s.day;
  }
  if (s.ind.dineIn && s.objects.filter((o) => o.def.cat === 'seat').length < 3) tryPlace('table4');
  if (!s.objects.some((o) => o.def.cat === 'wait') && !s.ind.dineIn) tryPlace('waitbench');
  // 擴店
  const next = [null, 'medium', 'large'][s.lotIdx + 1];
  if (next) {
    const lot = globalThis.BossIndustries.LOTS[s.lotIdx + 1];
    const last4 = s.history.slice(-4);
    const earning = last4.length === 4 && last4.every((h) => h.profit - (h.branches || 0) - (h.other || 0) - (h.rewards || 0) > 15000);
    if (s.level >= (lot.lv || 0) && earning && s.cash > lot.cost + 250000 && s.upgradeLot()) note(`第 ${s.day} 天：擴建成${lot.name}`);
  }
  // 研發新品
  for (const p of s.ind.products) if (p.rd && !s.recipes.has(p.id) && s.level >= (p.lv || 1) && s.cash > p.rd + 150000 && s.research(p.id)) note(`第 ${s.day} 天：研發了${p.name}`);

  // 價格跟著物價；店裡越漂亮，就敢多收一點
  for (const p of s.ind.products) s.prices[p.id] = Math.round((p.price * s.idx.cpi * (1 + s.priceTolerance * 0.5)) / 5) * 5;
  // 裝潢：照產業挑一種風格慢慢湊，CP 值高的先買；舊了就翻新
  const TH = { breakfast: 'retro', noodle: 'retro', drinks: 'insta', barber: 'retro', scooter: 'tech', store: 'cozy' }[s.ind.id];
  if (s.day % 5 === 2 && s.cash > 220000) {
    const pool = CATALOG.filter((d) => d.cat === 'decor' && d.beauty && (!d.industries || d.industries.includes(s.ind.id)) && s.unlocked(d) && s.cash > d.price + 200000);
    const pick = pool.filter((d) => d.theme === TH).sort((a, b) => b.beauty / Math.sqrt(b.price) - a.beauty / Math.sqrt(a.price))[0] || pool.sort((a, b) => b.beauty / Math.sqrt(b.price) - a.beauty / Math.sqrt(a.price))[0];
    if (pick && s.decor.A < 60 + s.level * 3) tryPlace(pick.id);
  }
  if (s.decor.fresh < 0.8 && s.cash > s.refreshCost + 300000) s.refreshDecor();

  // 小編：挑本週時事的內容發文
  if (s.canPost) {
    const t = s.social.trend;
    const body = Fun.POST_BODIES.find((b) => t && b.trend === t.id && !b.risky && (!b.ind || b.ind.includes(s.ind.id))) || Fun.POST_BODIES.find((b) => b.id === 'staff');
    s.post('boss', body.id, 'tag');
  }

  // 對手：發傳單；有錢就談聯名
  if (s.rival && !s.rival.closed && s.rival.strength > 0.5 && s.cash > 50000 && s.day % 5 === 0) s.flyers();
  if (!s.boss.away && s.cash > 250000 && !s.collabs.length && s.day % 10 === 0) {
    const pt = Fun.PARTNERS.find((p) => !s.collabReady(p) && s.cash > p.cost + 200000);
    if (pt) s.startCollab(pt.id);
  }
  // 老闆的人生：公司錢很多就領一點分紅；用自己的錢健身、買房、累了就去度假
  if (s.day % 7 === 6 && s.cash > 1500000 && s.staff.every((e) => e.wage >= s.marketWage)) s.takeDividend(s.cash * 0.1);
  const o = s.owner;
  if (!o.gym && o.wealth > 60000) s.lifeSpend('gym');
  if (o.stress > 60 && o.wealth > 150000) s.lifeSpend('trip');
  if (!o.house && o.wealth > 3500000) s.lifeSpend('house');
  if (o.wealth > 2000000 && o.parentTrips < 1) s.lifeSpend('parents');
  if (!o.filial && o.wealth > 500000) s.lifeSpend('filial');
  // 電動車：有錢買一台；Lv.6 以後公司錢夠就在交流道口開快充站
  if (!o.car && o.wealth > 2500000 && Fun.CARS) s.buyCar('m3');
  if (s.chargeUnlocked && !s.evStations.length && s.cash > 2500000 && s.level >= 6) {
    s.buyLot('interchange');
    s.addCharger('interchange', 'fast');
    s.addCharger('interchange', 'fast');
  }
  // 寵物：生意穩了養一隻；每天陪玩，生病就看醫生
  if (!basic && !s.pets.length && s.level >= 4 && s.cash > 250000) s.adoptPet(s.isFood ? 'turtle' : 'cat');
  for (const p of s.pets) {
    s.playPet(p.id);
    if (p.health < 60) s.vetPet(p.id);
  }
  // 後場：照順序蓋（儲藏室、廁所、休息室、辦公室），錢夠再升級
  for (const id of basic ? [] : ['storage', 'toilet', 'rest', 'office']) {
    const c = s.roomCost(id);
    if (c != null && s.cash > c + 180000 && s.roomLv(id) < (s.level >= 10 ? 3 : s.level >= 6 ? 2 : 1) && s.buildRoom(id)) note(`第 ${s.day} 天：後場${id}升到 ${s.roomLv(id)} 級`);
  }
  if (s.roomLv('toilet') && ['store', 'drinks'].includes(s.ind.id)) s.policy.toiletOpen = true;
  // 兼營業務：等級夠、錢夠就一項一項開（數量跟著等級慢慢增加），並送員工去學
  const SB = globalThis.BossIndustries.SIDE_BIZ[s.ind.id] || [];
  const owned = s.ownedSide();
  if (!basic && owned.length < 1 + Math.floor(s.level / 4) && s.day % 7 === 3) {
    // 聰明的老闆只開適合自己店的（三顆星以上）
    const nb = SB.find((b) => s.level >= b.lv && !owned.includes(b) && s.sideFit(b).stars >= 3 && s.cash > b.stationPrice + 200000);
    if (nb && tryPlace(`${nb.id}_st`)) note(`第 ${s.day} 天：開始兼營${nb.name}`);
  }
  for (const e of s.staff) {
    const b = owned.find((x) => !x.self && !s.knows(e, x.id));
    if (b && s.cash > s.skillCost + 100000) s.trainSkill(e, b.id);
  }
  // 章節解鎖的玩法
  if (s.feature('seasonal') && !(s.seasonal && s.seasonal.until >= s.day) && s.cash > s.seasonalCost + 150000 && s.launchSeasonal()) note(`第 ${s.day} 天：季節限定 ${s.seasonal.name}`);
  if (s.feature('auth') && s.policy.auth.complaint === 'off') Object.assign(s.policy.auth, { complaint: 'fix', karen: 'staff', fight: 'course', branch: 'fix', misc: 'kind' });
  if (s.feature('area') && !s.areaManager) {
    const i = s.branches.findIndex((b) => b.manager && b.manager.lead >= 55);
    if (i >= 0 && s.appointArea(i)) note(`第 ${s.day} 天：任命區經理 ${s.areaManager.name}`);
  }
  // 分店沒店長：派一位會帶人的組長過去（本店至少留 5 個人）
  if (s.feature('branch') && s.staff.length >= 6) {
    const i = s.branches.findIndex((b) => !b.manager);
    const e = s.staff.filter((x) => x.rank !== 'manager' && x.skill >= 45 && x.style !== 'slacker' && !(x.rank && s.inTrial(x))).sort((a, b) => (b.rank ? b.lead : b.leadSeen) - (a.rank ? a.lead : a.leadSeen))[0];
    if (i >= 0 && e && s.assignBranchManager(e, i)) note(`第 ${s.day} 天：${e.name}去當分店店長`);
  }
  if (s.feature('kitchen') && !s.kitchen && s.cash > s.kitchenCost + 300000 && s.buildKitchen()) note(`第 ${s.day} 天：蓋了${s.kitchenName}`);
  if (s.kitchen && !s.kitchen.backup && s.cash > s.backupCost + 400000) s.buyBackup();
  if (s.feature('franchise') && s.franchiseApps && (s.franchises || []).length < s.franchiseCap) {
    const a = s.franchiseApps.find((x) => !/勞保|操|招牌掛上去|回本/.test(x.note));
    if (a && s.acceptFranchise(a.id)) note(`第 ${s.day} 天：${a.city}${a.district}加盟店`);
  }
  if (s.feature('route') && !s.progress.route && s.chooseRoute(routePick)) note(`第 ${s.day} 天：選擇路線 ${routePick}`);
  if (s.progress.route === 'ipo') {
    if (s.raiseFunds()) note(`第 ${s.day} 天：募資完成`);
    if (s.listCompany()) note(`第 ${s.day} 天：掛牌上市`);
  }
  if (s.progress.route === 'coop') {
    if (s.launchShares()) note(`第 ${s.day} 天：員工持股`);
    // 想讓分店士氣都到 80：時薪調高、改裝
    for (const [i, b] of s.branches.entries()) {
      b.wage = 'high';
      if (b.morale < 80 && b.reno < 3 && s.cash > s.renoCost + 500000) s.setBranch(i, 'reno');
    }
    const h = s.coop && s.coop.shares && s.heirCandidates()[0];
    if (h && s.setHeir(h.name)) note(`第 ${s.day} 天：指定接班人 ${h.name}`);
  }
  // 分店
  if (s.level >= 5 && s.branches.length < (long ? 7 : 3) && s.feature('branch')) {
    // 挑估算淨利最高的地點
    const I = globalThis.BossIndustries;
    const cand = I.BRANCH_SITES.filter((st) => !s.branches.some((b) => b.site === st.id) && s.cash > s.siteCost(st) + (long ? 150000 : 300000)).sort((a, c) => s.estimateSite(c, 'medium').profit - s.estimateSite(a, 'medium').profit)[0];
    const b = cand && s.openBranch(cand.id, 'medium');
    if (b) note(`第 ${s.day} 天：在${s.siteOf(b).city}${b.district}開分店`);
  }
  // 現金太少：借錢；有餘裕：還錢
  if (s.cash < 30000 && s.loan < 600000) s.borrow(100000);
  if (s.cash > 400000 && s.loan > 0) s.repay(100000);
}

function play() {
  const rng = mulberry(seed * 7919 + mode.length * 131 + indId.length);
  s = new Sim(indId, { mode, rng, shopName: '測試小店', spot: process.env.SPOT });
  if (!long) s.allFeatures = true; // AI 試玩：玩法全開
  const weekly = [];
  s.cb = {
    event: (ev) => s.resolve(ev, pickChoice(ev)),
    ignored: () => {},
    dayEnd: daily,
    weekEnd: (r) => {
      weekly.push(r);
      if (process.env.LEDGER && (r.week % 4 === 0 || r.week <= 2)) console.log(`  [帳] 第${r.week}週 營收${Math.round(r.revenue)} 材料${Math.round(r.materials)} 薪資${Math.round(r.wages)} 房租${Math.round(r.rent)} 分店${Math.round(r.branches || 0)} 集團${Math.round(r.group || 0)} 事件${Math.round(r.events)} 其他${Math.round(r.other)} 獎勵${Math.round(r.rewards || 0)} 淨${Math.round(r.profit)} | 員工${s.staff.length} 兼營${s.ownedSide().length} 美觀${Math.round(s.decor.A)} 容忍${s.priceTolerance.toFixed(2)} 吸引${s.attractiveness().toFixed(2)} 價格倍率${(s.priceRatio()).toFixed(2)} 來客/日${Math.round(r.visitors / 7 || 0)}`);
      if (r.victory) note(`🎉 第 ${s.week - 1} 週破關：${r.victory.medal} ${r.victory.title}（${r.victory.score} 分）`);
    },
    notify: () => {},
    tripDone: () => {},
    chapter: (c) => note(c.ending ? `第 ${s.day} 天：🏁 結局「${c.ending.title}」` : `第 ${s.day} 天：📜 ${c.done.name} 完成`),
  };
  if (long) while (!s.over && !s.progress.ended && s.day < (Number(process.env.MAXDAY) || 1400)) s.tick(30);
  else while (!s.over && !s.wonYear && s.day < 400) s.tick(30);
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
if (s.evStations && s.evStations.length) console.log(`  ⚡ 充電站：${s.evStations.map((st) => `${st.name} 快${st.fast} 累計 $${Math.round(st.total).toLocaleString()}（開站第 ${st.opened} 天）`).join("、")}・🚗 ${s.carInfo ? s.carInfo.name : "沒車"}`);
console.log(`  現金 $${Math.round(s.cash).toLocaleString()}・借款 $${s.loan.toLocaleString()}・員工 ${s.staff.length} 人・Lv.${s.level}・分店 ${s.branches.length}・成就 ${s.achievements.size}`);
if (s.victoryInfo) console.log(`  評分：${s.victoryInfo.parts.map(([k, p, t]) => `${k} ${p}（${t}）`).join('、')}`);
console.log(`  老闆：壓力 ${Math.round(s.owner.stress)}・健康 ${Math.round(s.owner.health)}・個人財富 $${Math.round(s.owner.wealth).toLocaleString()}・度假 ${s.owner.trips} 次・里程碑 ${s.owner.milestones.join(',')}・${Fun.lifeVerdict(s).title}`);
console.log(`  升級（等級@天）：${Object.entries(lvDay).filter(([l]) => l % 5 === 0 || l == 2 || l == 3).map(([l, d]) => `${l}@${d}`).join(' ')}`);
if (long) console.log(`  經驗值（天:XP）：${xpTrace.join(' ')}`);
console.log(`  大事記：${(long ? log.filter((l) => /📜|🏁|路線|募資|上市|持股|接班|區經理|廚房|物流/.test(l)) : log.slice(0, 14)).join('；')}`);
if (long) console.log(`  已完成任務 ${s.progress.done.join(',')}・季節限定 ${s.seasonalCount || 0}・分店店長 ${s.branches.filter((b) => b.manager).length}・主管 ${s.staff.filter((e) => e.rank).map((e) => e.rank + e.lead).join(',')}`);
if (long) console.log(`  章節 ${s.progress.chapter}・路線 ${s.progress.route || '-'}・結束 ${!!s.progress.ended}・分店 ${s.branches.length}・加盟 ${(s.franchises || []).length}・估值 $${s.valuation.toLocaleString()}・慣老闆 ${Math.round(s.jerk)}・代處理 ${s.authCount || 0} 件${s.ipo ? `・連續達標 ${s.ipo.streak} 季` : ''}`);
