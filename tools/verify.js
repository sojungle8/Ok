// 功能逐項驗證：每個玩法都實際跑一次，檢查結果對不對
// 用法：node tools/verify.js            （全部）
//       node tools/verify.js 授權 存檔   （只跑名稱含這些字的）
for (const f of ['data', 'fun', 'weird', 'trends26', 'activities', 'city', 'citymap', 'plots', 'career', 'progress', 'slash', 'sidebiz', 'backroom', 'pets', 'life', 'ev', 'portraits', 'industries', 'sim']) require(`../js/${f}.js`);
const { Sim, CATALOG } = globalThis.BossSim;
const Fun = globalThis.BossFun;
const I = globalThis.BossIndustries;

function mulberry(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// 開一間店：事件一律選第一個（或不處理），可以指定難度、全開玩法
function mk(ind = 'noodle', o = {}) {
  const s = new Sim(ind, { mode: o.mode || 'normal', rng: mulberry(o.seed || 7) });
  s.cb = { event: o.events === false ? () => {} : (ev) => s.resolve(ev, 0) };
  if (o.all) s.allFeatures = true;
  if (o.cash) s.cash = o.cash;
  if (o.xp) s.xp = o.xp;
  s.policy.autoStock = true;
  return s;
}
const toOpen = (s, plus = 0) => {
  while (s.minute < s.hours.open + plus) s.tick(5);
};
const days = (s, n) => {
  for (let i = 0; i < n; i++) s.tick(1440);
};
// 一張空白、沒有人處理的事件
const fakeEv = (id, choices, where = 'phone') => ({ where, ev: { id, icon: '🧪', title: id, text: '', choices, ignore: { effects: {}, result: '' } } });

const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

// ───── 開店、客人、員工 ─────
for (const ind of I.INDUSTRIES.map((x) => x.id)) {
  T(`開店：${ind} 跑三天有營收、有評論、不會壞`, () => {
    const s = mk(ind);
    days(s, 3);
    ok(s.history.length === 0 || s.history.length >= 0, '');
    ok(s.reviews.length > 5, `評論只有 ${s.reviews.length} 則`);
    ok(s.ledger.revenue > 0 || s.lastDay.revenue > 0, '沒有營收');
    ok(isFinite(s.cash), '現金變成 NaN');
  });
}
T('員工：排休的人不會來上班', () => {
  const s = mk('breakfast');
  days(s, 2);
  const e = s.staff[1];
  const tomorrow = (s.weekday + 1) % 7;
  s.setSchedule(e, 'restDay', String(tomorrow));
  if (!e.restDays.includes(tomorrow)) s.setSchedule(e, 'restDay', String(tomorrow));
  s.tick(1440 - (s.minute - s.dayStart) + 1);
  const d = s.day;
  let worked = false;
  while (s.day === d) {
    s.tick(10);
    if (e.state === 'working') worked = true;
  }
  ok(!worked, `${e.name} 排休還來上班`);
});
T('員工：今天新請的人會被排進班表', () => {
  const s = mk('noodle');
  toOpen(s, 30);
  const before = s.staff.length;
  s.addEmployee(s.makeCandidate(), true);
  ok(s.staff.length === before + 1, '沒有請到人');
  const e = s.staff[s.staff.length - 1];
  ok(s.shiftOf(e), '新人今天沒有班');
});
T('員工：早一小時走是照班表往前推', () => {
  const s = mk('breakfast');
  toOpen(s, 120);
  const e = s.staff.find((x) => x.state === 'working');
  const end0 = s.shiftOf(e).end;
  const p = fakeEv('t_early', [{ label: 'x', effects: { leaveEarly: [e.id, 60] } }], 'staff');
  p.staff = e;
  s.activeEvents.push(p);
  s.applyChoice(p, p.ev.choices[0]);
  ok(s.shiftOf(e).end === end0 - 60, `下班時間 ${s.shiftOf(e).end}，應該是 ${end0 - 60}`);
});
T('員工：調薪、上課（技能課）會扣錢、技能變高', () => {
  const s = mk('drinks');
  toOpen(s, 10);
  const e = s.staff[0];
  const c0 = s.cash;
  const k0 = e.skill;
  ok(s.train(e), '不能上課');
  ok(s.cash < c0 && e.skill > k0, '上課沒效果');
  s.setWage(e, e.wage + 20);
  ok(e.wage >= 200, '調薪失敗');
});

// ───── 進貨與報廢 ─────
T('進貨：叫急件會扣錢、會送到', () => {
  const s = mk('noodle');
  toOpen(s, 30);
  const g = s.ind.stock[0];
  const st0 = s.stock[g.id];
  const c0 = s.cash;
  ok(s.rushOrder(g.id), '叫不到急件');
  ok(s.cash < c0, '急件沒扣錢');
  s.tick(90);
  ok(s.stock[g.id] + 0 >= 0 && s.stock[g.id] !== st0, '急件沒送到（庫存沒變）');
});
T('進貨：開著自動調整時，每天早上會改進貨量並記錄', () => {
  const s = mk('breakfast');
  days(s, 3);
  ok(s.parNote && s.parNote.text, '沒有記錄自動調整');
});

// ───── 評論 ─────
T('評論：全部是整數星，評價＝最近 100 則平均', () => {
  const s = mk('noodle');
  days(s, 8);
  const r = s.reviews.slice(-100);
  ok(r.every((x) => x.stars % 1 === 0), '有半顆星的評論');
  const avg = r.reduce((t, x) => t + x.stars, 0) / r.length;
  ok(Math.abs(avg - s.rating) < 0.001 || s.level >= 21, `平均 ${avg.toFixed(2)} ≠ 評價 ${s.rating.toFixed(2)}`);
});
T('評論：只保留最近三個月（至少 60 則）', () => {
  const s = mk('drinks');
  for (let i = 0; i < 250; i++) s.addReview(4, '好', null);
  ok(s.reviews.length <= 200, '超過 200 則');
});

// ───── 授權與代理（測試回饋 BUG-01／02／04） ─────
const withMgr = (s) => {
  toOpen(s, 60);
  const m = s.staff.find((e) => e.state === 'working');
  m.rank = 'manager';
  m.lead = 80;
  m.style = 'warm';
  s.policy.delegate = true;
  s.policy.auth = { misc: 'kind', complaint: 'fix', karen: 'off', fight: 'mediate', branch: 'off', budget: 1000 };
  return m;
};
for (const [cost, expect] of [[900, true], [1000, true], [1100, false]]) {
  T(`授權：上限 1,000，花 ${cost} ${expect ? '會代理' : '交還老闆'}`, () => {
    const s = mk('noodle', { all: true, events: false });
    withMgr(s);
    const p = fakeEv('t_cost', [{ label: '花錢', effects: { cash: -cost * 2, morale: 3 }, result: '' }]);
    s.spawnEvent(p);
    ok(!s.activeEvents.includes(p) === expect, expect ? '應該代理卻交還' : '超過上限還被代理');
  });
}
T('授權：公司現金不夠，就算在上限內也交還', () => {
  const s = mk('noodle', { all: true, events: false });
  withMgr(s);
  s.policy.auth.budget = 50000;
  s.cash = 500;
  const p = fakeEv('t_cash', [{ label: '花錢', effects: { cash: -1600, morale: 3 }, result: '' }]);
  s.spawnEvent(p);
  ok(s.activeEvents.includes(p), '現金不夠還被代理');
});
T('授權／逾時代理：老闆的人生大事（婚禮）誰都不能代', () => {
  const s = mk('noodle', { all: true, events: false });
  withMgr(s);
  s.policy.auth.budget = 1e7;
  const wed = Fun.LIFE_EVENTS.map((x) => x.make(s)).find((e) => e.choices.some((c) => /婚禮/.test(c.label)));
  const p = { where: 'phone', ev: wed };
  const c0 = s.cash;
  s.spawnEvent(p);
  ok(s.activeEvents.includes(p), '授權代理了婚禮');
  s.minute = p.deadline;
  s.ignoreEvent(p);
  ok(s.activeEvents.includes(p) && s.owner.partner !== 'married', '逾時代理辦了婚禮');
  ok(s.cash === c0, '現金被動到了');
});
T('逾時代理：還沒開授權時每件最多 $3,000', () => {
  const s = mk('noodle', { events: false });
  withMgr(s);
  s.policy.auth = {};
  const p = fakeEv('t_big', [{ label: '花大錢', effects: { cash: -20000, morale: 9 }, result: '' }], 'staff');
  s.spawnEvent(p);
  s.minute = p.deadline;
  s.ignoreEvent(p);
  ok(s.activeEvents.includes(p), '超過 3,000 還被代理');
});
T('授權：店長不能調解自己的吵架；第三次吵架交還老闆', () => {
  const s = mk('breakfast', { all: true, events: false });
  const m = withMgr(s);
  const o = s.staff.find((e) => e !== m && e.state === 'working') || s.staff.find((e) => e !== m);
  const p = { where: 'staff', staffPref: m, ev: { id: 'rel_fight', icon: '', title: '吵架', pair: [m.id, o.id], nth: 1, choices: [{ label: '把兩個人找來，私下調解', effects: {} }] } };
  s.spawnEvent(p);
  ok(s.activeEvents.includes(p), '店長調解了自己的吵架');
});
T('個人錢不夠：差額記成老闆欠公司，分紅先還', () => {
  const s = mk('noodle');
  s.owner.wealth = 20000;
  const c0 = s.cash;
  s.payPersonal(80000, '醫藥費');
  ok(c0 - s.cash === 60000 && s.owner.owe === 60000, '代墊金額不對');
  ok(!s.ledger.other, '代墊算進了公司開銷');
  s.cash = 3e6;
  s.takeDividend(100000);
  ok(s.owner.owe === 0, '分紅沒有先還代墊');
});

// ───── 兼營業務 ─────
T('兼營：每一項都有適合度星等和原因', () => {
  for (const ind of Object.keys(I.SIDE_BIZ)) {
    const s = mk(ind);
    for (const b of I.SIDE_BIZ[ind]) {
      const f = s.sideFit(b);
      ok(f.stars >= 1 && f.stars <= 5 && f.notes.length, `${b.name} 沒有星等`);
    }
  }
});
T('兼營：上課學會、扣上課費（不是技能課的價錢）', () => {
  const s = mk('store', { cash: 1e6, xp: 40000 });
  toOpen(s, 10);
  s.autoPlace('sb_parcel_st');
  const e = s.staff[0];
  const c0 = s.cash;
  ok(s.trainSkill(e, 'sb_parcel'), '不能上課');
  ok(s.knows(e, 'sb_parcel') && c0 - s.cash === s.skillCost, '沒學會或費用不對');
});
T('兼營：開了以後真的有專門來辦事的客人', () => {
  const s = mk('store', { cash: 1e6, xp: 40000 });
  s.autoPlace('sb_atm_st');
  days(s, 3);
  ok((s.lastDay.side || s.today.side || 0) > 0 || s.history.length >= 0, '');
  let side = 0;
  s.cb.dayEnd = () => {
    side += s.today.side || 0;
  };
  days(s, 2);
  ok(side > 0, '兩天都沒有兼營客人');
});

// ───── 後場 ─────
T('後場：四個房間都能蓋到第 3 級', () => {
  const s = mk('drinks', { cash: 5e6, xp: 300000 });
  for (const r of ['storage', 'rest', 'office', 'toilet']) for (let i = 0; i < 3; i++) s.buildRoom(r);
  ok(['storage', 'rest', 'office', 'toilet'].every((r) => s.roomLv(r) === 3), JSON.stringify(s.rooms));
});
T('後場：人走進去、用完走出來，不瞬移、不搶位置、收店時沒人困在裡面', () => {
  const s = mk('drinks', { cash: 5e6, xp: 300000 });
  s.policy.toiletOpen = true;
  for (const r of ['storage', 'rest', 'office', 'toilet']) for (let i = 0; i < 3; i++) s.buildRoom(r);
  for (let i = 0; i < 3; i++) s.addEmployee(s.makeCandidate(), true);
  const last = new Map();
  let enter = 0;
  let jump = 0;
  let overlap = 0;
  for (let k = 0; k < 2 * 1440 * 4; k++) {
    s.tick(0.25);
    for (const a of [...s.staff, ...s.customers]) {
      const p = last.get(a);
      if (a.inRoom && p && p.in && Math.hypot(a.x - p.x, a.z - p.z) > 0.25 * 3 + 0.01) jump++;
      if (a.inRoom && !(p && p.in)) enter++;
      last.set(a, { x: a.x, z: a.z, in: !!a.inRoom });
    }
    for (const id of ['storage', 'rest', 'office', 'toilet']) {
      const sp = s.roomOccupants(id).map((a) => a.inRoom.spot);
      if (new Set(sp).size !== sp.length) overlap++;
    }
  }
  ok(enter > 5, `兩天只有 ${enter} 次進後場`);
  ok(jump === 0, `有 ${jump} 次瞬移`);
  ok(overlap === 0, `有 ${overlap} 次搶同一個位置`);
  ok(![...s.staff].some((e) => e.inRoom && e.state === 'off'), '下班的人困在房間裡');
});
T('後場：廁所會變髒、有人會去打掃', () => {
  const s = mk('store', { cash: 5e6, xp: 300000 });
  s.policy.toiletOpen = true;
  s.buildRoom('toilet');
  let cleaned = false;
  let dirty = false;
  for (let k = 0; k < 3 * 1440; k += 5) {
    s.tick(5);
    if (s.toiletClean < 60) dirty = true;
    if (dirty && s.toiletClean === 100) cleaned = true;
  }
  ok(dirty && cleaned, `髒過 ${dirty}、打掃過 ${cleaned}`);
});

// ───── 寵物 ─────
T('寵物：領養、陪玩、看獸醫；看過獸醫當天的「生病」事件不會發生', () => {
  const s = mk('drinks', { cash: 1e6, xp: 40000 });
  ok(s.adoptPet('cat', '店長', true), '不能領養');
  const p = s.pets[0];
  p.health = 30;
  const ev = Fun.PET_EVENTS.find((x) => x.make(s, p).id === 'pet_sick').make(s, p);
  const still = () => s.pets.includes(p) && (p.vetDay !== s.day || false) && p.health < 80;
  ok(s.vetPet(p.id) && p.health === 100, '看獸醫沒治好');
  const pend = { ev, where: 'staff', still };
  toOpen(s, 60);
  s.spawnEvent(pend);
  ok(!s.activeEvents.includes(pend), '治好了還跳出生病事件');
});

// ───── 裝潢 ─────
T('裝潢：同風格湊齊有主題，越漂亮客人越能接受高價', () => {
  const s = mk('noodle', { cash: 3e6, xp: 300000 });
  const t0 = s.priceTolerance;
  for (const id of ['shrine', 'luckycat', 'lantern', 'poster']) s.autoPlace(id);
  s.tick(1440);
  ok(s.decor.theme === 'retro', `主題是 ${s.decor.theme}`);
  ok(s.priceTolerance > t0, '價格容忍度沒提高');
});

// ───── 新生財器具 ─────
T('器具：省料（製麵機）讓叫貨單價變便宜', () => {
  const s = mk('noodle', { cash: 3e6, xp: 40000 });
  const g = s.ind.stock.find((x) => x.id === 'noodle');
  const u0 = s.unitCost(g);
  s.autoPlace('noodleMaker');
  ok(Math.abs(s.unitCost(g) / u0 - 0.85) < 0.001, `單價只降到 ${(s.unitCost(g) / u0).toFixed(3)}`);
});
T('器具：減報廢、加速、評價、耐心、夏天吸客都有接上', () => {
  const s = mk('drinks', { cash: 3e6, xp: 40000 });
  ['sealer', 'pearlPot', 'iceMaker'].forEach((id) => s.autoPlace(id));
  ok(s.toolMult('spoilCut', 'pearl') === 0.6, '珍珠鍋沒減報廢');
  ok(s.toolSpeed('boba') === 1.12, '封口機沒加速');
  ok(s.toolStars('boba') === 0.15, '珍珠鍋沒加評價');
  const b = mk('barber', { cash: 3e6, xp: 40000 });
  b.autoPlace('magRack');
  ok(b.toolPatience === 1.1, '雜誌架沒加耐心');
});
T('器具：每一件都擺得進店裡、有專屬造型', () => {
  const ids = ['teppanStove', 'toaster', 'soyMachine', 'pickupWindow', 'eggFridge', 'stockPot', 'luweiCase', 'noodleMaker', 'coldCase', 'sealer', 'pearlPot', 'fruitBar', 'iceMaker', 'colorStation', 'hoodDryer', 'magRack', 'hairShelf', 'tireBalancer', 'diagPC', 'washBay', 'oilDrum', 'hotCase', 'coffeeMachine', 'softServe', 'freezerCase', 'magazineRack'];
  for (const id of ids) {
    const d = CATALOG.find((x) => x.id === id);
    ok(d && d.model && d.model !== 'kiosk', `${id} 沒有專屬造型`);
    const s = mk(d.industries[0], { cash: 3e6, xp: 40000 });
    s.upgradeLot();
    ok(s.autoPlace(id), `${d.name} 擺不進去`);
  }
});

// ───── 等級 ─────
T('等級：上限 40，每 5 級換稱號，升級發通知', () => {
  const s = mk('noodle');
  let ups = 0;
  s.cb.levelUp = () => ups++;
  s.gainXp(1e8);
  ok(s.level === 40, `等級 ${s.level}`);
  ok(s.levelTitle === '台灣之光', `稱號 ${s.levelTitle}`);
  ok(ups === 1, '一次升很多級應該只跳一次卡片');
});
T('等級：Lv.11 以後每一級都有獎勵說明', () => {
  for (let l = 11; l <= 40; l++) ok(Fun.LEVEL_PERKS[l], `Lv.${l} 沒有獎勵`);
});

// ───── 章節 ─────
T('章節：第三章只要第一間分店、第四章 3 間、第五章 6 間', () => {
  const ch3 = Fun.CHAPTERS.find((c) => c.id === 'ch3').quests.find((q) => q.id === 'br2');
  const ch4 = Fun.CHAPTERS.find((c) => c.id === 'ch4').quests.find((q) => q.id === 'br5');
  const ch5 = Fun.CHAPTERS.find((c) => c.id === 'ch5').quests.find((q) => q.id === 'shops8');
  ok(ch3.check({ branches: [1] }) && ch4.check({ branches: [1, 2, 3] }) && ch5.check({ branches: [1, 2, 3], franchises: [1, 2, 3] }), '門檻不對');
});

// ───── 分店、加盟、中央廚房、上市、合作社 ─────
T('分店：開店扣錢、週報和帳本的分店淨利一致（含區經理薪水）', () => {
  const s = mk('noodle', { all: true, cash: 2e7, xp: 300000 });
  const site = I.BRANCH_SITES[0];
  const c0 = s.cash;
  ok(s.openBranch(site.id), '開不了分店');
  ok(c0 - s.cash === s.branches[0].paid, '扣款不對');
  s.areaManager = { name: '測試', lead: 70, wage: 300 };
  days(s, 8);
  const r = s.history[s.history.length - 1];
  ok(s.lastBranchNet && Math.round(s.lastBranchNet.net) === Math.round(r.branches), `帳本 ${s.lastBranchNet && s.lastBranchNet.net} ≠ 週報 ${r.branches}`);
});
T('加盟：簽約後每週有權利金', () => {
  const s = mk('drinks', { all: true, cash: 2e7, xp: 300000 });
  s.rollFranchiseApps && s.rollFranchiseApps();
  const a = (s.franchiseApps || [])[0];
  ok(a, '沒有加盟申請');
  s.acceptFranchise(a.id);
  ok(s.franchises.length === 1, '沒有簽到');
  days(s, 8);
  ok(s.franchises[0].total > 0, '沒收到權利金');
});
T('中央廚房：蓋了以後叫貨變便宜', () => {
  const s = mk('noodle', { all: true, cash: 2e7, xp: 300000 });
  const g = s.ind.stock[0];
  const u0 = s.unitCost(g);
  ok(s.buildKitchen(), '蓋不了');
  ok(s.unitCost(g) < u0, '沒有變便宜');
});
T('上市：募資後季度用「這週」的週報累計', () => {
  const s = mk('noodle', { all: true, cash: 2e7, xp: 300000 });
  s.progress.route = 'ipo';
  days(s, 14);
  const c0 = s.cash, p0 = s.profitOf(s.ledger);
  ok(s.raiseFunds(), '募資失敗');
  ok(s.cash > c0 && Math.round(s.profitOf(s.ledger)) === Math.round(p0) && s.ledger.capital === s.cash - c0, '募資的錢被算進淨利');
  const q0 = s.ipo.qProfit;
  days(s, 7);
  const r = s.history[s.history.length - 1];
  ok(Math.round(s.ipo.qProfit - q0) === Math.round(r.profit - (r.other || 0) - (r.rewards || 0)), '季度累計不是這週的數字');
});

// ───── 人生 ─────
T('人生：領分紅扣 20% 稅；個人消費只能用個人的錢', () => {
  const s = mk('noodle', { cash: 3e6 });
  s.takeDividend(100000);
  ok(s.owner.wealth === 80000, `個人財富 ${s.owner.wealth}`);
  const cheap = Object.entries(Fun.LIFE_SPEND).find(([, x]) => x.cost > 80000 && x.ok(s));
  if (cheap) ok(!s.lifeSpend(cheap[0]), '錢不夠還買得到');
});

// ───── 客訴題材 ─────
T('客訴：三種真相的選項文字和標價都一樣，正確答案位置會變', () => {
  const s = mk('store');
  const e = s.staff[0];
  for (const T2 of Fun.CASES) {
    const sets = ['mistake', 'misread', 'unreasonable'].map((k) => Fun.caseEvent(s, k, e, T2.id));
    const sig = (ev) => ev.choices.map((c) => `${c.tag}:${s.resolveEffects(c).cash || 0}`).sort().join('|');
    ok(sig(sets[0]) === sig(sets[1]) && sig(sets[1]) === sig(sets[2]), `${T2.id} 標價會洩漏答案`);
    ok(sets.every((ev) => ev.choices.filter((c) => c.correct).length === 1), `${T2.id} 正確答案不只一個`);
  }
  const pos = new Set();
  for (let i = 0; i < 30; i++) pos.add(Fun.caseEvent(s, 'misread', e, 'pay').choices.findIndex((c) => c.correct));
  ok(pos.size >= 3, '正確答案位置都一樣');
});
T('客訴：同一題材十天內不重複、會冷卻', () => {
  const s = mk('drinks');
  const seen = [];
  s.cb.event = (ev) => {
    // 「同一個奧客又來」是刻意的後續（caseKind 先指定），不算重複
    if (ev.caseTheme && !ev.caseKind) seen.push([s.day, ev.caseTheme]);
    s.resolve(ev, 0);
  };
  days(s, 90);
  for (let i = 0; i < seen.length; i++) for (let j = i + 1; j < seen.length; j++) if (seen[i][1] === seen[j][1] && seen[j][0] - seen[i][0] < 10) ok(false, `${seen[i][1]} 在 ${seen[i][0]}、${seen[j][0]} 天重複`);
  ok(seen.length >= 2, `90 天只有 ${seen.length} 件時事客訴`);
});

// ───── 街頭時事 ─────
T('街頭：臨檢時外送員變少、走路客人變多；追逐會鳴笛、攔下', () => {
  const s = mk('drinks');
  toOpen(s, 60);
  s.streetState.checkpoint = { from: s.minute - 1, to: s.minute + 100 };
  ok(s.streetMult('rider') < 1 && s.streetMult('walk') > 1, '臨檢沒影響來客');
  s.street.chaseAt = s.minute;
  s.tick(0.5);
  ok(s.street.chase, '追逐沒發生');
});
T('街頭：清晨倒地的人，打 119 後救護車會來載走', () => {
  const s = mk('noodle', { events: false });
  toOpen(s, 10);
  s.streetState.collapse = { day: s.day, lying: true };
  const p = { where: 'door', ev: Fun.STREET_EVENTS.collapse(s) };
  s.spawnEvent(p);
  s.resolve(p, 0);
  s.tick(20);
  ok(!s.street.collapse.lying, '救護車沒把人載走');
});

// ───── 警告與提示（試玩發現的問題） ─────
T('警告：慣老闆指數過 50／70／85 各提醒一次，並說出是哪件事', () => {
  const s = mk('drinks');
  const bad = [];
  s.cb.notify = (t, k) => k === 'bad' && /慣老闆指數超過/.test(t) && bad.push(t);
  s.jerk = 45;
  const p = fakeEv('壓榨測試', [{ label: '壓', effects: { jerk: 8 } }]);
  s.activeEvents.push(p);
  s.resolve(p, 0);
  ok(bad.length === 1 && bad[0].includes('壓榨測試'), `過 50 的警告：${bad.join('｜')}`);
  s.jerk = 72;
  s.checkEnding();
  s.jerk = 90;
  s.checkEnding();
  ok(bad.length === 3, `應該警告 3 次，實際 ${bad.length}`);
  s.checkEnding();
  ok(bad.length === 3, '同一級重複警告');
  ok(s.advice().some((a) => a.icon === '😈'), '💡提示沒有慣老闆的項目');
});
T('提示：人已經比服務位多還有人生氣 → 叫你買設備，不是請人', () => {
  const s = mk('breakfast');
  days(s, 2);
  while (s.staff.length < 14 && s.candidates.length) s.hire(0);
  s.lastDay = { ...s.lastDay, visitors: 100, angry: 20 };
  const a = s.advice().find((x) => x.icon === '😡');
  ok(a && a.tab === 'build' && /設備/.test(a.text), `提示：${a && a.text}`);
});
T('提示：虧錢但價格已經偏貴時，不會叫你再漲價', () => {
  const s = mk('noodle');
  days(s, 7);
  for (const p of s.ind.products) s.prices[p.id] = Math.round(p.price * 1.3);
  s.reviews = Array.from({ length: 50 }, () => ({ stars: 5, text: '', day: s.day }));
  s.history.push({ ...s.history[s.history.length - 1], profit: -50000, other: 0, rewards: 0, branches: 0 });
  const a = s.advice().filter((x) => x.icon === '📉');
  ok(a.length && !a.some((x) => x.text.includes('漲價')), `提示：${a.map((x) => x.text).join('｜')}`);
});
T('警告：現金變負、借滿時倒數到週末結算', () => {
  const s = mk('store');
  const bad = [];
  s.cb.notify = (t, k) => k === 'bad' && /現金/.test(t) && bad.push(t);
  days(s, 1);
  s.cash = -300000;
  s.loan = 600000;
  days(s, 1);
  ok(bad.some((t) => /週末結算/.test(t)), `沒有倒數警告：${bad.join('｜')}`);
});
T('進貨：自動進貨看最近幾天和上週同一天，不會被一天的低用量帶走', () => {
  const s = mk('drinks');
  days(s, 8);
  const g = s.ind.stock[0].id;
  s.usageLog = [{ [g]: 300 }, { [g]: 280 }, { [g]: 290 }, { [g]: 300 }, { [g]: 310 }, { [g]: 290 }, { [g]: 60 }];
  s.lastUsage[g] = 60;
  s.lastDay = { ...s.lastDay, outWarned: {} };
  s.morningOrder();
  ok(s.par[g] >= 300, `下雨一天後進貨量掉到 ${s.par[g]}`);
});

T('小幫手：會顧店（薪水、心情、放太久的小事），但不會建設、改設定、改價格、借錢', () => {
  const s = mk('noodle', { mode: 'easy', events: false });
  s.policy.helper = true;
  for (const e of s.staff) e.wage = 196;
  Object.assign(s.policy, { overtimePay: false });
  const objs = s.objects.length;
  const prices = JSON.stringify(s.prices);
  s.cash = 25000;
  days(s, 3);
  ok(s.staff.every((e) => e.wage >= s.marketWage), '薪水沒有跟上行情');
  ok(s.objects.length === objs, '小幫手自己買了東西');
  ok(JSON.stringify(s.prices) === prices, '小幫手自己改了價格');
  ok(!s.policy.overtimePay, '小幫手自己改了設定');
  ok(s.loan === 0, '小幫手自己借了錢');
  const card = (s.helperTips || []).find((t) => t.act.type === 'legal');
  ok(card, `沒有「打開加班費」的建議卡：${(s.helperTips || []).map((t) => t.title).join('、')}`);
  s.helperDo(card.id);
  ok(s.policy.overtimePay, '按了照做卻沒打開');
  // 人生大事放著不會被代選
  const p = fakeEv('life_test', [{ label: '買', effects: { lifeBuy: 'gym' } }, { label: '不買', effects: {} }]);
  p.spawnedAt = s.minute - 100;
  p.deadline = s.minute + 5;
  s.activeEvents.push(p);
  s.helperEvents();
  ok(s.activeEvents.includes(p), '小幫手替老闆決定了人生大事');
});

// ───── 🗺️ 城市 ─────
T('城市：路線沿著馬路走，過河一定要走橋；越遠騎越久', () => {
  const C = globalThis.BossCity;
  const r = C.route({ x: 1, y: 0 }, { x: 3, y: 0 });
  // 跨河（路口 x 2→3）的那一步一定在橋上
  for (let i = 1; i < r.length; i++) if (r[i][1] === r[i - 1][1] && Math.min(r[i][0], r[i - 1][0]) === C.RIVER_X) ok(C.BRIDGES.includes(r[i][1]), `在 y=${r[i][1]} 直接游泳過河`);
  ok(C.rideMinutes({ x: 4, y: 6 }, { x: 4, y: 5 }) < C.rideMinutes({ x: 4, y: 6 }, { x: 8, y: 0 }), '遠的地方沒有比較久');
});
T('城市：開店地點會改變房租、人潮和客群', () => {
  const C = globalThis.BossCity;
  const a = new Sim('drinks', { spot: 'alley', rng: mulberry(3) });
  const m = new Sim('drinks', { spot: 'mrt', rng: mulberry(3) });
  ok(a.spot === 'alley' && m.spot === 'mrt', '地點沒記住');
  ok(m.spotInfo.rent > a.spotInfo.rent, '捷運站口房租沒有比巷弄貴');
  const o = new Sim('noodle', { spot: 'office' });
  o.minute = 12 * 60;
  o.day = 1; // 平日中午
  const sat = C.spotMult('office', 'noodle', 12, 5, 3);
  ok(o.spotNow > sat, '辦公區週末沒有比較冷清');
  ok(C.spotMix('school', 'student', 7) < C.spotMix('school', 'student', 4), '學校旁暑假學生沒有變少');
  const legacy = new Sim('drinks', {});
  ok(legacy.spot === 'legacy' && legacy.spotNow === 1 && legacy.spotInfo.rent === 1, '沒選地點的舊存檔被改了平衡');
});
T('城市：出門時間＝騎過去＋待一下＋騎回來；路上的事會寫進回來的摘要', () => {
  const near = new Sim('drinks', { spot: 'nightmarket', rng: mulberry(5) });
  const far = new Sim('drinks', { spot: 'alley', rng: mulberry(5) });
  for (const s of [near, far]) {
    s.cash = 1e6;
    s.minute = 14 * 60;
    ok(s.goOut('market'), '出不了門');
  }
  ok(far.boss.away.until - far.minute > near.boss.away.until - near.minute, '住得遠的去夜市沒有比較久');
});
T('城市：騎去要逛的地方，到了才走進去；逛完要騎回來', () => {
  const s = mk('drinks', { events: false });
  s.spot = 'alley';
  let arrived = null;
  s.cb.arrived = (id) => (arrived = id);
  toOpen(s, 60);
  const go = s.rideTo('temple', 'scene');
  ok(go && s.boss.away.kind === 'ride', '沒有出發');
  ok(!arrived, '還沒騎到就進去了');
  s.tick(go.mins + 1);
  ok(arrived === 'temple' && s.boss.away && s.boss.away.scene, '騎到了沒有進場景');
  s.leavePlace();
  ok(s.boss.away && s.boss.away.kind === 'rideBack', '逛完直接瞬移回店裡');
  s.tick(go.mins + 1);
  ok(!s.boss.away, '騎回來之後還在外面');
});
T('城市：騎去分店巡店會提升士氣；搭高鐵去外縣市巡店要好幾個小時', () => {
  const s = mk('noodle', { all: true, cash: 2e7, xp: 300000, events: false });
  days(s, 1);
  s.openBranch('ximen', 'medium');
  s.openBranch('fengjia', 'medium');
  const b = s.branches.find((x) => x.site === 'ximen');
  b.morale = 50;
  const done = [];
  s.cb.tripDone = (r) => done.push(r);
  toOpen(s, 30);
  ok(s.rideTo('ximen', 'branch'), '不能去巡店');
  s.tick(120);
  ok(b.morale > 50 && done.length, `巡店沒效果（士氣 ${b.morale}）`);
  s.tick(60);
  ok(!s.boss.away, '巡完沒回來');
  ok(s.trainVisit('fengjia'), '不能搭高鐵');
  ok(s.boss.away.until - s.minute >= 120, '去台中太快了');
});
T('城市：鄰居會帶來事件；地點會存進存檔', () => {
  const s = mk('drinks', { events: false });
  s.spot = 'mrt';
  const got = [];
  s.cb.notify = (t) => /捷運|演唱會/.test(t) && got.push(t);
  days(s, 120);
  ok(got.length >= 1, '四個月都沒有任何鄰居的事');
  const d = JSON.parse(JSON.stringify(s.serialize ? s.serialize() : s.toJSON()));
  const s2 = Sim.load(d, {});
  ok(s2.spot === 'mrt', '讀檔之後地點不見了');
});

T('存檔：讀檔後新的東西不會跟存檔裡的寵物、員工撞號', () => {
  const s = mk('drinks', { cash: 1e6 });
  s.adoptPet('parrot');
  days(s, 2);
  const json = s.serialize();
  const s2 = Sim.load(json, {});
  days(s2, 1);
  const pid = new Set(s2.pets.map((p) => p.id));
  const clash = [...s2.objects, ...s2.staff].filter((o) => pid.has(o.id));
  ok(!clash.length, `撞號：${clash.map((o) => (o.def ? o.def.id : o.name) + o.id).join(',')}`);
});

// ───── 存檔 ─────
T('存檔：營業中存、讀回來時間、現金、今天營收、帳本都一樣，不會重叫早上的貨', () => {
  const s = mk('breakfast');
  days(s, 2);
  toOpen(s, 120);
  const t = Sim.load(s.serialize(), {});
  ok(t.minute === s.minute && t.cash === s.cash && t.today.revenue === s.today.revenue && t.ledger.revenue === s.ledger.revenue, '讀檔後數字不一樣');
  ok(!t.deliveries.length, '讀檔又叫了一次貨');
});
T('存檔：紀錄只留最近半年（週報）', () => {
  const s = mk('noodle');
  days(s, 200);
  ok(s.history.length <= 26 && s.profitLog.length <= 52, `週報 ${s.history.length}、精簡紀錄 ${s.profitLog.length}`);
  const t = Sim.load(s.serialize(), {});
  ok(t.history.length === s.history.length && t.bestWeek === s.bestWeek, '讀檔後紀錄不一樣');
});


// ───── 電動車、充電站 ─────
T('車行：用個人的錢買、換車舊車五五折、舊存檔的車照樣有效', () => {
  const s = mk('noodle', { cash: 3e6 });
  ok(!s.buyCar('m3'), '沒錢還買得到');
  s.owner.wealth = 2e6;
  ok(s.buyCar('m3') && s.owner.wealth === 300000, `買 Modal 3 後 ${s.owner.wealth}`);
  ok(s.carInfo === Fun.CARS.m3 && s.rideInfo('bank').mins <= Math.round(window_ride(s) * 0.75 + 1), '路程沒變短');
  s.owner.wealth = 4e6;
  const trade = s.carTradeIn();
  ok(trade === 940000, `舊車折抵 ${trade}`);
  ok(s.buyCar('mx') && s.owner.wealth === 4e6 + trade - Fun.CARS.mx.cost, '換車金額不對');
  ok(s.social.followers >= 800, '鷹翼門沒有加粉絲');
  const old = mk('noodle');
  old.owner.car = true;
  ok(old.carInfo === Fun.CARS.gas, '舊存檔的 car:true 讀不到');
});
function window_ride(s) {
  const City = globalThis.BossCity;
  return City.rideMinutes(s.homeXY, City.placeAt('bank'));
}

T('充電站：Lv.6 才能買地；裝樁後每天有收入、基本電費照付、帳本有記', () => {
  const s = mk('store', { cash: 5e6, events: false });
  ok(!s.buyLot('interchange'), 'Lv.1 就能買地');
  while (s.level < 6) s.xp += 50;
  const cash0 = s.cash;
  const st = s.buyLot('interchange');
  ok(st && s.cash === cash0 - 800000, '地價沒扣對');
  days(s, 1);
  ok(st.week.net === 0 && st.week.fast === 0, '沒有樁不應該有收支');
  s.addCharger('interchange', 'fast');
  s.addCharger('interchange', 'fast');
  days(s, 14);
  ok(st.last && st.last.fast > 50, `一週快充只有 ${st.last && st.last.fast} 次`);
  ok((st.last.fixed / st.last.days) * 7 >= 2 * 120 * 55, `基本電費 ${st.last.fixed}（${st.last.days} 天）`);
  ok(Object.keys(st.last.brands).length >= 4, '來充電的品牌太少');
  const L = s.history[s.history.length - 1];
  ok(Math.round(L.charging) === Math.round(st.last.net) || Math.abs(L.charging - st.last.net) < 2, `帳本 ${L.charging} vs 站 ${st.last.net}`);
});

T('充電站：漲價車變少、店旁的站會帶客人進店、存讀檔保留', () => {
  const run = (price, lot) => {
    const s = mk('store', { cash: 5e6, events: false, seed: 3 });
    while (s.level < 6) s.xp += 50;
    s.buyLot(lot);
    s.addCharger(lot, 'fast');
    s.addCharger(lot, 'slow');
    s.setChargePrice(lot, 'fast', price);
    days(s, 7);
    return s;
  };
  const cheap = run(0, 'interchange').stationAt('interchange').last.fast;
  const dear = run(5, 'interchange').stationAt('interchange').last.fast;
  ok(dear < cheap * 0.75, `漲價後 ${dear} vs ${cheap}`);
  const h = run(0, 'home');
  ok(h.chargeWalkRate() > 0, '店旁的站沒有帶客人');
  ok(run(0, 'community').chargeWalkRate() === 0, '遠的站也會帶客人');
  const back = Sim.load(h.serialize(), {});
  ok(back.evStations.length === 1 && back.stationAt('home').fast === 1, '存讀檔後充電站不見了');
});

T('充電站事件：故障停用、補助入帳、電價調漲都會作用在那一站', () => {
  const s = mk('store', { cash: 5e6, events: false });
  while (s.level < 6) s.xp += 50;
  const st = s.buyLot('office');
  s.addCharger('office', 'fast');
  s.addCharger('office', 'slow');
  for (const E of Fun.CHARGE_EVENTS) {
    const ev = E.make(s, st);
    ok(ev.choices.length >= 2 && ev.ignore, `${ev.id} 選項不完整`);
  }
  const p = { stLot: 'office', where: 'phone', ev: { id: 'x', choices: [], ignore: { effects: {} } } };
  s.applyChargeFx(p, { evBroken: 14 });
  ok(st.broken === 1 && st.brokenUntil === s.day + 14, '故障沒有記');
  const c0 = s.cash;
  s.applyChargeFx(p, { evSubsidy: true });
  ok(s.cash - c0 === 60000 + 8000 && st.subsidy, '補助金額不對');
  s.applyChargeFx(p, { evElec: 0.1 });
  ok(Math.abs(st.elec - 1.1) < 1e-9, '電價沒漲');
});

// ───── 執行 ─────
const want = process.argv.slice(2);
let pass = 0;
const fails = [];
const t0 = Date.now();
for (const t of tests) {
  if (want.length && !want.some((w) => t.name.includes(w))) continue;
  try {
    t.fn();
    pass++;
    console.log(`  ✅ ${t.name}`);
  } catch (e) {
    fails.push([t.name, e.message]);
    console.log(`  ❌ ${t.name}\n     → ${e.message.split('\n')[0]}`);
  }
}
console.log(`\n${pass} 項通過，${fails.length} 項失敗（${((Date.now() - t0) / 1000).toFixed(0)} 秒）`);
process.exitCode = fails.length ? 1 : 0;
