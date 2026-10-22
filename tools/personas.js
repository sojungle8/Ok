// 不同類型的玩家：放置不管、只照遊戲提示做、慣老闆、亂花錢
// 看每種玩法會走到哪裡、多久、失敗前有沒有警告、前幾天訊息量多不多
// 用法：node tools/personas.js <persona> <難度> <產業> [種子]
//   persona：idle（開了店就不管）、hint（只照💡提示做，事件隨便選）、jerk（壓薪、不保勞健保、選最省錢的）、spend（看到就買、能開分店就開）
for (const f of ['data', 'fun', 'weird', 'trends26', 'activities', 'city', 'plots', 'career', 'progress', 'slash', 'sidebiz', 'backroom', 'pets', 'life', 'portraits', 'industries', 'sim']) require(`../js/${f}.js`);
const { Sim, CATALOG, catalogById } = globalThis.BossSim;
const I = globalThis.BossIndustries;

const [persona = 'hint', mode = 'normal', indId = 'drinks', seedArg = '1'] = process.argv.slice(2);
const seed = Number(seedArg) || 1;
function mulberry(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry(seed * 104729 + persona.length * 7);
const s = globalThis.__sim = new Sim(indId, { mode, rng: mulberry(seed * 7919 + mode.length * 131 + indId.length), shopName: '測試小店' });

// 統計
const st = { notes: [], notesByDay: {}, eventsByDay: {}, ignored: 0, events: 0, chapters: [], warnBeforeEnd: [], firstNeg: null, lowCashDay: null, hintsSeen: {}, hintsDone: {}, jerkEv: [], jerkWeek: [] };
const tryPlace = (type) => {
  const def = catalogById[type];
  if (!def || s.cash < def.price + 5000 || !s.unlocked(def)) return null;
  for (let z = 0; z < s.H; z++) for (let x = 0; x < s.W; x++) for (let r = 0; r < 4; r++) if (s.canPlace(type, x, z, r)) return s.place(type, x, z, r);
  return null;
};
const bestCand = () => {
  let bi = -1;
  s.candidates.forEach((c, i) => {
    if (bi < 0 || c.skill - c.wage / 10 > s.candidates[bi].skill - s.candidates[bi].wage / 10) bi = i;
  });
  return bi;
};
const choices = (ev) => ev.ev.choices.map((c, i) => [c, i]).filter(([c]) => !c.minigame);

function pick(ev) {
  const cs = choices(ev);
  if (!cs.length) return 0;
  if (persona === 'jerk') {
    // 只看錢：最省錢（或最賺）的那個，不管慣老闆指數
    let best = cs[0];
    for (const x of cs) if ((s.resolveEffects(x[0]).cash || 0) > (s.resolveEffects(best[0]).cash || 0)) best = x;
    return best[1];
  }
  // 新手和亂花錢的：看哪個順眼就按哪個；被警告過慣老闆指數之後，會避開標著 😈 的選項
  const pool = st.careful ? cs.filter(([c]) => !(s.resolveEffects(c).jerk > 0)) : cs;
  const p = pool.length ? pool : cs;
  return p[Math.floor(rnd() * p.length)][1];
}

// 💡提示 → 新手會做的那個最簡單的動作
function followHints() {
  for (const a of s.advice()) {
    st.hintsSeen[a.icon] = (st.hintsSeen[a.icon] || 0) + 1;
    // 新手不是每天都會點開提示看
    if (rnd() > 0.6) continue;
    let did = false;
    switch (a.icon) {
      case '😡':
        // 提示說卡在設備：買那台；說人不夠：請人
        if (a.tab === 'build') {
          const def = s.busiestStation();
          did = !!(def && tryPlace(def.id));
          break;
        }
      // fallthrough
      case '👥':
      case '📅': {
        const i = bestCand();
        if (i >= 0 && s.cash > 20000 && !(st.noHireUntil > s.day)) did = !!s.hire(i);
        break;
      }
      case '💸': st.noHireUntil = s.day + 14; did = true; break;
      case '🤖': s.policy.helper = true; did = true; break;
      case '📉':
        if (a.text.includes('漲價')) for (const p of s.ind.products) s.prices[p.id] = Math.round(((s.prices[p.id] || p.price) * 1.05) / 5) * 5;
        else if (a.text.includes('價格是不是比建議價')) for (const p of s.ind.products) s.prices[p.id] = Math.round((p.price * s.idx.cpi) / 5) * 5;
        else {
          // 讓店更吸引人：買一件 CP 值最高、買得起的裝飾，再發一篇文
          const deco = CATALOG.filter((x) => x.cat === 'decor' && x.beauty && (!x.industries || x.industries.includes(s.ind.id)) && s.unlocked(x) && s.cash > x.price + 60000).sort((x, y) => y.beauty / y.price - x.beauty / x.price)[0];
          if (deco) tryPlace(deco.id);
          if (s.canPost) s.post('boss', globalThis.BossFun.POST_BODIES[0].id, 'tag');
          if (a.text.includes('少一班') && s.policy.shifts > 1 && rnd() < 0.3) s.policy.shifts = 1;
        }
        did = true;
        break;
      case '📦': s.policy.autoStock = true; did = true; break;
      case '🧽': if (s.cash > s.deepCleanCost + 10000) did = s.deepClean() !== false; break;
      case '😞': for (const e of s.staff.filter((x) => x.mood < 35)) { s.praise(e); s.setWage(e, e.wage + 10); } did = true; break;
      case '⏰': s.policy.shifts = 2; did = true; break;
      case '☕': did = !!tryPlace('breaktable'); break;
      case '❄️': did = !!(tryPlace('aircon') || tryPlace('fan')); break;
      case '💲': for (const p of s.ind.products) s.prices[p.id] = Math.round((p.price * s.idx.cpi) / 5) * 5; did = true; break;
      case '🏦': did = s.borrow(100000) > 0; break;
      case '📱': if (s.canPost) { const t = s.social.trend; const b = globalThis.BossFun.POST_BODIES.find((x) => t && x.trend === t.id && !x.risky) || globalThis.BossFun.POST_BODIES[0]; s.post('boss', b.id, 'tag'); did = true; } break;
      case '🧪': { const p = s.ind.products.find((x) => x.rd && !s.recipes.has(x.id) && s.level >= (x.lv || 1)); if (p) did = !!s.research(p.id); break; }
      case '😈': st.careful = true; for (const e of s.staff) s.praise(e); did = true; break;
      case '🏪': if (s.cash > 20000) { s.flyers(); did = true; } break;
    }
    if (did) st.hintsDone[a.icon] = (st.hintsDone[a.icon] || 0) + 1;
  }
}

function daily(r) {
  const d = s.day;
  st.soldOut = (st.soldOut || 0) + (r.soldOut || 0);
  st.soldOutDays = (st.soldOutDays || 0) + ((r.soldOut || 0) > 3 ? 1 : 0);
  st.waste = (st.waste || 0) + (r.waste || 0);
  st.revenue = (st.revenue || 0) + (r.revenue || 0);
  if (d % 28 === 0) st.jerkWeek.push(`${d}:${Math.round(s.jerk)}`);
  if (s.cash < 0 && st.firstNeg == null) st.firstNeg = d;
  if (s.cash < 60000 && st.lowCashDay == null) st.lowCashDay = d;
  if (persona === 'idle') return;
  if (persona === 'hint') return followHints();
  if (persona === 'jerk') {
    // 壓到最低工資、不保勞健保、不給加班費和休息、全年無休；人不夠就請，不爽就罵
    Object.assign(s.policy, { insurance: false, overtimePay: false, breaks: false, restDays: 'none' });
    for (const e of s.staff) if (e.wage > 196) s.setWage(e, 196);
    const need = Math.max(2, s.stations.reduce((n, o) => n + o.lanes.filter((l) => !l.self).length, 0) * s.policy.shifts);
    if (s.staff.length < need) { const i = bestCand(); if (i >= 0) s.hire(i); }
    for (const e of s.staff) if (e.mood > 60 && rnd() < 0.15) s.scold(e);
    if (s.cash < 30000) s.borrow(100000);
    return;
  }
  if (persona === 'spend') {
    followHints();
    // 看到漂亮的就買、能擴店就擴、能開分店就開，錢不夠就借
    const pool = CATALOG.filter((x) => x.cat === 'decor' && x.beauty && (!x.industries || x.industries.includes(s.ind.id)) && s.unlocked(x) && s.cash > x.price + 10000);
    if (pool.length) tryPlace(pool[Math.floor(rnd() * pool.length)].id);
    if (s.lotIdx < 2 && s.level >= (I.LOTS[s.lotIdx + 1].lv || 0) && s.cash > I.LOTS[s.lotIdx + 1].cost) s.upgradeLot();
    if (s.feature('branch')) {
      const site = I.BRANCH_SITES.find((x) => !s.branches.some((b) => b.site === x.id) && s.cash > s.siteCost(x));
      if (site && s.openBranch(site.id, 'medium')) st.notes.push(`第 ${d} 天：開分店`);
    }
    if (s.cash < 80000) s.borrow(200000);
  }
}

s.cb = {
  event: (ev) => {
    st.events++;
    st.eventsByDay[s.day] = (st.eventsByDay[s.day] || 0) + 1;
    if (persona !== 'idle') {
      const j0 = s.jerk;
      const i = pick(ev);
      s.resolve(ev, i);
      if (s.jerk - j0 > 0.01) st.jerkEv.push([s.day, +(s.jerk - j0).toFixed(1), ev.ev.title, ev.ev.choices[i].label]);
    }
  },
  ignored: () => st.ignored++,
  dayEnd: daily,
  notify: (t, kind) => {
    st.notesByDay[s.day] = (st.notesByDay[s.day] || 0) + 1;
    if (kind === 'bad') st.warnBeforeEnd.push(`第${s.day}天 ${t.slice(0, 40)}`);
  },
  chapter: (c) => st.chapters.push(c.ending ? `第${s.day}天 結局：${c.ending.title}` : `第${s.day}天 ${c.done.name}`),
};
const t0 = Date.now();
while (!s.over && !s.wonYear && s.day < 400) s.tick(30);

const out = s.over ? `❌ ${s.ending.title}（第 ${s.day} 天）` : s.wonYear ? `✅ 破關（第 ${s.day} 天）` : `⏸️ 400 天還沒結束`;
const v = s.victoryResult || s.lastVictory || (s.history.find((h) => h.victory) || {}).victory;
const avg = (o, a, b) => { let n = 0, t = 0; for (let k = a; k <= b; k++) { n++; t += o[k] || 0; } return (t / n).toFixed(1); };
console.log(`${persona}｜${s.ind.name}｜${mode}｜種子${seed}（${((Date.now() - t0) / 1000).toFixed(0)} 秒）`);
console.log(`結果：${out}${v ? `・${v.medal}${v.score} 分` : ''}`);
console.log(`現金 $${Math.round(s.cash).toLocaleString()}・借款 $${s.loan.toLocaleString()}・評價 ${s.rating.toFixed(2)}・慣老闆 ${Math.round(s.jerk)}・員工 ${s.staff.length}・Lv.${s.level}・分店 ${s.branches.length}`);
console.log(`現金第一次 <6 萬：第 ${st.lowCashDay ?? '-'} 天；第一次變負：第 ${st.firstNeg ?? '-'} 天`);
console.log(`事件：共 ${st.events} 件、逾時 ${st.ignored}；每天平均 第1-7天 ${avg(st.eventsByDay, 1, 7)}、第8-28天 ${avg(st.eventsByDay, 8, 28)}、之後 ${avg(st.eventsByDay, 29, Math.max(29, s.day))}`);
console.log(`通知：每天平均 第1天 ${st.notesByDay[1] || 0}、第2-7天 ${avg(st.notesByDay, 2, 7)}、第8-28天 ${avg(st.notesByDay, 8, 28)}`);
console.log(`賣完：${st.soldOut || 0} 人次、${st.soldOutDays || 0} 天超過 3 人；報廢 $${Math.round(st.waste || 0).toLocaleString()}（營收的 ${((st.waste / st.revenue) * 100).toFixed(1)}%）`);
console.log(`提示出現次數 ${JSON.stringify(st.hintsSeen)}；照做 ${JSON.stringify(st.hintsDone)}`);
console.log(`章節：${st.chapters.join('；') || '—'}`);
console.log(`慣老闆指數（每 28 天）：${st.jerkWeek.join(' ')}`);
const evJ = st.jerkEv.reduce((t, x) => t + x[1], 0);
console.log(`事件選項讓慣老闆指數 +${evJ.toFixed(0)}（${st.jerkEv.length} 次）；最大的幾次：${st.jerkEv.sort((a, b) => b[1] - a[1]).slice(0, 5).map((x) => `第${x[0]}天「${x[2]}」選「${x[3]}」+${x[1]}`).join('、')}`);
if (s.over) console.log(`結束前最後幾則壞消息：\n  ${st.warnBeforeEnd.slice(-6).join('\n  ')}`);
if (st.notes.length) console.log(st.notes.slice(0, 8).join('；'));
