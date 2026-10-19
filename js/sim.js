// 開店模擬核心：店面格子、客人與員工的自主行為、營業時間與班表、財務、事件
// 不碰 DOM，可以在 Node 裡跑
(function (root) {
  const { INDUSTRIES, CATALOG, LOTS, NAMES, TRAITS, LEVELS, DISTRICTS, DISTRICT_INFO, CUSTOMER_TYPES, DIFFICULTY, FLOORS, WALLS, SIGNS, BRANCH_SITES, BRANCH_SIZES, TOURIST_PREF } = root.BossIndustries;
  const { EVENTS, IGNORE, VIOLATIONS } = root.BossData;
  const Looks = root.BossLooks;
  const Fun = root.BossFun || { KARENS: [], TRENDS: [], POST_HOOKS: [], POST_BODIES: [], POST_ENDINGS: [], COMMENTS: {}, HEADLINES: [], STAFF_QUIPS: [], FUNNY_REVIEWS: { good: [], bad: [] } };

  const DAY = 1440;
  const DAYS_PER_WEEK = 7;
  const WEEKS_PER_MONTH = 4;
  const OUT_W = 4; // 店面左右兩側的騎樓寬度
  const STREET = 3; // 店門外：騎樓、路邊、馬路
  const MIN_WAGE = 196;
  const JERK_LIMIT = 100;
  const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

  const ECON = {
    cpiDrift: 0.004,
    cpiNoise: 0.002,
    wageDrift: 0.004,
    oilDrift: 0.006,
    oilNoise: 0.04,
    gasPrice: 30,
    powerMonths: [4, 10],
    powerSteps: [0, 0.03, 0.05, 0.08, 0.11],
    summerMonths: [6, 7, 8, 9],
    kwhPrice: 4.6,
  };

  // 雇主負擔的勞健保與勞退（以薪資估算的簡化費率）
  // 勞保 11.5% ＋ 就保 1% ＋ 職災約 0.2%，雇主負擔七成；健保 5.17% 雇主負擔六成、平均眷口 0.56；勞退雇主提繳 6%
  const INS = { labor: 0.089, health: 0.048, pension: 0.06 };
  const INS_TOTAL = INS.labor + INS.health + INS.pension;

  const TAX_LABEL = {
    exempt: '月營業額沒有達到起徵點，免徵營業稅',
    small: '小規模營業人：由國稅局查定，營業稅 1%',
    vat: '月營業額超過 20 萬，要開統一發票，營業稅 5%（銷項稅額減進項稅額）',
  };

  const SUPPLIER_LOOK = { gender: 'm', skin: '#c48d66', hair: '#2b2420', hairStyle: 'short', shirt: '#2f6db5', hat: 'cap', hatColor: '#1f4f8f' };
  const INSPECTOR_LOOK = { gender: 'f', skin: '#ecc19f', hair: '#2b2420', hairStyle: 'bun', shirt: '#f4f4f4', glasses: true, extra: 'clipboard' };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const catalogById = Object.fromEntries(CATALOG.map((c) => [c.id, c]));

  // 面向（rot）0：正面朝向街道（+z）
  const FRONT = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  const RIGHT = [[1, 0], [0, -1], [-1, 0], [0, 1]];
  function local(obj, lx, lz) {
    const f = FRONT[obj.rot];
    const r = RIGHT[obj.rot];
    return { x: obj.x + lx * r[0] + lz * f[0], z: obj.z + lx * r[1] + lz * f[1] };
  }

  let uid = 1;

  class Sim {
    constructor(industryId, opts = {}) {
      const ind = INDUSTRIES.find((i) => i.id === industryId);
      if (!ind) throw new Error(`未知產業：${industryId}`);
      this.ind = ind;
      this.rng = opts.rng || Math.random;
      this.cb = opts.callbacks || {};
      this.shopName = opts.shopName || ind.shopName;
      this.mode = DIFFICULTY[opts.mode] ? opts.mode : 'normal';
      this.diff = DIFFICULTY[this.mode];

      this.lotIdx = 0;
      this.setLot(0);
      this.objects = [];
      this.day = 1;
      this.minute = ind.open - 60;
      this.cash = Math.round((ind.cash * this.diff.cash) / 1000) * 1000;
      this.loan = 0;
      this.jerk = 10;
      this.flags = new Set();
      this.reviews = [];
      this.staff = [];
      this.customers = [];
      this.passers = [];
      this.popups = [];
      this.prices = Object.fromEntries(ind.products.map((p) => [p.id, p.price]));
      this.menu = Object.fromEntries(ind.products.map((p) => [p.id, !p.rd]));
      this.recipes = new Set(); // 研發好的新品
      this.style = { floor: 'default', wall: null, sign: null };
      this.ownedFloors = new Set(['default']);
      this.policy = {
        open: ind.open,
        close: ind.close,
        shifts: ind.close - ind.open > 600 ? 2 : 1,
        restDays: 'rotate',
        overtimePay: true,
        breaks: true,
        delivery: false,
        closedDay: -1, // -1：全年無休，0～6：週一～週日公休
        insurance: true, // 幫員工保勞健保、提繳勞退
        closingClean: true, // 打烊後大家花半小時打掃
        cleaner: false, // 外包清潔阿姨
        delegate: true, // 老闆來不及處理的事件，讓在班上的店長代為處理
        autoStock: this.mode !== 'hell', // 依昨天的用量自動調整進貨量
      };
      this.idx = { cpi: 1, wage: 1, oil: 1, power: 1 };
      this.costMult = { materials: 1, rent: 1, utilities: 1 };
      this.priceMult = 1;
      this.demandMods = [];
      this.news = ['🗞️ 新店開張！物價、油價、電價會隨時間上漲，記得留意成本。'];
      this.ledger = this.emptyLedger();
      this.today = this.emptyDay();
      this.lockHours();
      this.history = [];
      this.activeEvents = [];
      this.pendingEvents = [];
      this.usedEvents = new Set();
      this.achievements = new Set();
      this.xp = 0;
      this.branches = [];
      this.awards = [];
      this.yearProfit = 0;
      this.rel = {}; // 員工之間的好感度：-100～100
      this.separate = new Set(); // 被排開班的兩個人
      this.romanced = new Set();
      this.over = false;
      this.ending = null;
      this.cleanWeeks = 0;
      this.dirt = []; // 地上的髒污：客人吃完、下雨的泥巴、頭髮、油漬
      this.grime = 0; // 慢慢累積的油垢：只有大掃除清得掉
      this.hygiene = { at: null, warned: false, last: null };
      this.rival = null;
      this.promo = null;
      this.loyalty = false;
      this.taxStatus = null;
      this.social = { followers: 80, posts: [], trend: null, trendDay: 0, lastPost: 0, viral: 0 };
      this.karenAt = null;
      this.collabs = []; // 進行中的聯名
      this.schemes = 0;
      // 老闆本人：可以自己操控在店裡和街上走動
      this.boss = { id: 'boss', isBoss: true, x: 0, z: 0, dir: Math.PI, moving: false, energy: 100, fit: 0, hunger: 80, mood: 70, skill: 60, traits: [], state: 'off', task: null, path: [], ride: false, away: null, served: 0, mopUntil: 0 };
      this.initStock();
      this.rollTrend();

      for (const [type, x, z, rot] of ind.starter) this.place(type, x, z, rot, true);
      for (let i = 0; i < ind.starterStaff; i++) this.addEmployee(this.makeCandidate(i === 0 ? 'veteran' : null), true);
      this.candidates = this.rollCandidates();
      this.planDay();
    }

    // ───── 時間 ─────
    get week() {
      return Math.floor((this.day - 1) / DAYS_PER_WEEK) + 1;
    }
    get month() {
      return Math.floor((this.week - 1) / WEEKS_PER_MONTH) + 1;
    }
    get monthOfYear() {
      return ((this.month - 1) % 12) + 1;
    }
    get weekday() {
      return (this.day - 1) % DAYS_PER_WEEK;
    }
    get hour() {
      return Math.floor(this.minute / 60) % 24;
    }
    get weekOfMonth() {
      return ((this.week - 1) % WEEKS_PER_MONTH) + 1;
    }
    get dateLabel() {
      return `${this.monthOfYear} 月・第 ${this.weekOfMonth} 週・週${WEEKDAYS[this.weekday]}`;
    }

    // ───── 天氣與節慶 ─────
    rollWeather() {
      const m = this.monthOfYear;
      const r = this.rng();
      const typhoon = [7, 8, 9, 10].includes(m) ? 0.06 : 0;
      const rain = m >= 5 && m <= 9 ? 0.26 : m <= 3 || m >= 11 ? 0.2 : 0.18;
      const cloudy = m <= 3 || m >= 11 ? 0.3 : 0.18;
      let id = 'sunny';
      if (r < typhoon) id = 'typhoon';
      else if (r < typhoon + rain) id = 'rain';
      else if (r < typhoon + rain + cloudy) id = 'cloudy';
      if (id === 'sunny' && this.isSummer) id = 'hot';
      if (id === 'cloudy' && (m === 1 || m === 2 || m === 12) && this.rng() < 0.4) id = 'cold';
      this.weather = WEATHER[id];
    }

    get festival() {
      const m = this.monthOfYear;
      const w = this.weekOfMonth;
      return FESTIVALS.find((f) => f.month === m && f.week === w && (!f.days || f.days.includes(this.weekday))) || null;
    }

    weatherMult(kind = 'walk') {
      const wx = this.weather || WEATHER.sunny;
      let k = kind === 'delivery' ? wx.delivery : wx.walk;
      if (kind === 'walk' && this.ind.id === 'drinks' && wx.id === 'hot') k *= 1.2;
      if (kind === 'walk' && this.ind.id === 'noodle' && wx.id === 'cold') k *= 1.2;
      return k;
    }

    festivalMult() {
      const f = this.festival;
      if (!f) return 1;
      return f.mult[this.ind.id] || f.mult.all || 1;
    }
    get clockLabel() {
      const m = ((Math.floor(this.minute) % DAY) + DAY) % DAY;
      return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    }
    get isSummer() {
      return ECON.summerMonths.includes(this.monthOfYear);
    }
    // 營業時間在每天開始時鎖定，中途修改隔天才生效
    lockHours() {
      const { open, close, shifts } = this.policy;
      const span = close > open ? close - open : close + DAY - open;
      this.hours = { open, close: open + span, span, shifts };
    }
    get openToday() {
      return this.policy.closedDay !== this.weekday;
    }
    get span() {
      return this.hours.span;
    }
    get isOpen() {
      return this.openToday && this.minute >= this.hours.open && this.minute < this.hours.close;
    }

    // 給舊事件資料用的相容介面
    get eventCtx() {
      const self = this;
      return {
        get staff() {
          return self.staff.length;
        },
        industry: { id: this.ind.id, maxStaff: 30 },
        get jerk() {
          return self.jerk;
        },
        get month() {
          return self.monthOfYear;
        },
        get realWage() {
          return self.realWage;
        },
        get idx() {
          return self.idx;
        },
      };
    }

    get marketWage() {
      return Math.round(this.ind.hourlyWage * this.idx.wage);
    }
    get realWage() {
      if (!this.staff.length) return 1;
      return this.staff.reduce((s, e) => s + e.wage, 0) / this.staff.length / this.marketWage;
    }
    get morale() {
      if (!this.staff.length) return 50;
      return this.staff.reduce((s, e) => s + e.mood, 0) / this.staff.length;
    }
    get rating() {
      if (!this.reviews.length) return 3.5;
      const recent = this.reviews.slice(-40);
      return recent.reduce((s, r) => s + r.stars, 0) / recent.length;
    }
    get beauty() {
      return this.objects.reduce((s, o) => s + (o.def.beauty || 0), 0);
    }
    get draw() {
      return this.objects.reduce((s, o) => s + (o.def.draw || 0), 0);
    }
    get cooling() {
      if (this.objects.some((o) => o.def.cool)) return 1;
      if (this.objects.some((o) => o.def.coolHalf)) return 0.5;
      return 0;
    }
    get lot() {
      return LOTS[this.lotIdx];
    }

    // ───── 等級與展店 ─────
    get level() {
      let lv = 1;
      for (let i = 0; i < LEVELS.length; i++) if (this.xp >= LEVELS[i]) lv = i + 1;
      return lv;
    }
    get levelProgress() {
      const lv = this.level;
      const a = LEVELS[lv - 1];
      const b = LEVELS[lv];
      return b ? (this.xp - a) / (b - a) : 1;
    }
    unlocked(def) {
      return !def.lv || def.lv <= this.level;
    }
    gainXp(n) {
      const before = this.level;
      this.xp += n;
      const after = this.level;
      if (after > before) {
        const items = CATALOG.filter((d) => d.lv === after && (!d.industries || d.industries.includes(this.ind.id))).map((d) => d.name);
        const lot = LOTS.find((l) => l.lv === after);
        if (lot) items.push(`擴建${lot.name}`);
        if (after === 5) items.push('開分店');
        this.notify(`⭐ 店家升到 Lv.${after}！${items.length ? `解鎖：${items.join('、')}` : ''}`, 'achieve');
        if (this.cb.levelUp) this.cb.levelUp(after, items);
        this.sound('level');
      }
    }
    // ───── 分店：自己挑地點和店面大小 ─────
    // 舊存檔只有地區名稱：用以前的人潮和房租資料湊一個地點
    siteOf(b) {
      const found = BRANCH_SITES.find((x) => x.id === b.site);
      if (found) return found;
      const info = DISTRICT_INFO[b.district] || { traffic: 1, rent: 1 };
      return { id: 'legacy', city: '', name: b.district, icon: '🏙️', desc: '', traffic: info.traffic, rent: info.rent, cost: 1, mix: { student: 0.25, office: 0.25, elderly: 0.2, family: 0.3, tourist: 0 } };
    }

    // 這個地點的客群跟你的產業合不合
    siteFit(site) {
      const pref = (t) => (t === 'tourist' ? TOURIST_PREF[this.ind.id] || 1 : (this.ind.mix && this.ind.mix[t]) || 1);
      const keys = Object.keys(site.mix);
      const tot = keys.reduce((a, k) => a + site.mix[k], 0) || 1;
      const avgPref = keys.reduce((a, k) => a + pref(k), 0) / keys.length;
      const w = keys.reduce((a, k) => a + site.mix[k] * pref(k), 0) / tot;
      return clamp(w / avgPref, 0.6, 1.5);
    }

    siteSeason(site) {
      const m = this.monthOfYear;
      if (!site.season) return 1;
      if (site.season.high.includes(m)) return 1.35;
      if (site.season.low.includes(m)) return 0.75;
      return 1;
    }

    get branchCost() {
      return Math.round((this.ind.cash * 2.5) / 10000) * 10000;
    }

    siteCost(site, size = 'medium') {
      return Math.round((this.ind.cash * 2.5 * site.cost * BRANCH_SIZES[size].cost) / 10000) * 10000;
    }

    openBranch(siteId, size = 'medium') {
      const site = BRANCH_SITES.find((x) => x.id === siteId) || BRANCH_SITES.find((x) => !this.branches.some((b) => b.site === x.id));
      if (!site || !BRANCH_SIZES[size] || this.level < 5 || this.branches.some((b) => b.site === site.id)) return null;
      const cost = this.siteCost(site, size);
      if (this.cash < cost) return null;
      this.cash -= cost;
      this.ledger.other -= cost;
      const b = { site: site.id, district: site.name, size, paid: cost, week: this.week, last: 0, total: 0, revenue: 0, wage: 'market', price: 'normal', staff: this.branchNeedOf(size), morale: 65, rating: 3.8, reno: 0, hist: [] };
      this.branches.push(b);
      this.notify(`🏙️ ${this.shopName}${site.city}${site.name}店開幕了！`, 'achieve');
      if (this.branches.length >= 3) this.achieve('chain');
      return b;
    }

    // 分店擴建：小 → 中 → 大
    expandCost(b) {
      const next = b.size === 'small' ? 'medium' : b.size === 'medium' ? 'large' : null;
      if (!next) return null;
      const site = this.siteOf(b);
      return { next, cost: Math.round(((this.siteCost(site, next) - this.siteCost(site, b.size)) * 0.9) / 1000) * 1000 };
    }

    expandBranch(i) {
      const b = this.branches[i];
      const ex = b && this.expandCost(b);
      if (!ex || this.cash < ex.cost) return false;
      this.cash -= ex.cost;
      this.ledger.other -= ex.cost;
      b.paid = (b.paid || this.branchCost) + ex.cost;
      b.size = ex.next;
      this.notify(`🏗️ ${b.district}店擴建成${BRANCH_SIZES[ex.next].name}了！記得多請一點人。`, 'good');
      return true;
    }

    sellBranch(i) {
      const b = this.branches[i];
      if (!b) return 0;
      const refund = Math.round((b.paid || this.branchCost) * (0.5 + b.reno * 0.05));
      this.branches.splice(i, 1);
      this.cash += refund;
      this.ledger.other += refund;
      this.notify(`🏙️ 把${b.district}店頂讓出去了，拿回 $${refund.toLocaleString()}。`);
      return refund;
    }

    get branchNeed() {
      return this.ind.starterStaff + 1;
    }

    branchNeedOf(size = 'medium') {
      return Math.max(2, Math.round(this.branchNeed * BRANCH_SIZES[size].staff));
    }

    // 分店的基本盤：一週的來客營收（照本店的產業特性估算）
    branchBase() {
      const ind = this.ind;
      let traffic = 0;
      for (let m = ind.open; m < ind.close; m += 60) traffic += ind.demand[Math.floor(m / 60) % 24];
      const total = ind.products.reduce((s, p) => s + p.weight, 0);
      const avgPrice = ind.products.reduce((s, p) => s + p.price * p.weight, 0) / total;
      const costShare = ind.products.reduce((s, p) => s + p.cost * p.weight, 0) / total / avgPrice;
      return { revenue: ind.baseArrivals * traffic * 0.8 * (ind.basket || 1) * avgPrice * 7 * this.idx.cpi * (ind.branchMult || 1), costShare };
    }

    setBranch(i, key, value) {
      const b = this.branches[i];
      if (!b) return false;
      if (key === 'staff') {
        const n = clamp(b.staff + value, 1, 16);
        if (n > b.staff) {
          this.cash -= 1500;
          this.ledger.other -= 1500;
        }
        b.staff = n;
      } else if (key === 'reno') {
        const cost = this.renoCost;
        if (b.reno >= 3 || this.cash < cost) return false;
        this.cash -= cost;
        this.ledger.other -= cost;
        b.reno += 1;
        b.morale = clamp(b.morale + 5, 0, 100);
        this.notify(`🔨 ${b.district}店改裝完成，店面更漂亮了。`, 'good');
      } else b[key] = value;
      return true;
    }

    get renoCost() {
      return Math.round((this.branchCost * 0.15) / 1000) * 1000;
    }

    // 算一間分店一週的帳；est 為 true 時不加隨機（給選址畫面估算用）
    branchWeek(b, est = false) {
      const { revenue: R0, costShare } = this.branchBase();
      const site = this.siteOf(b);
      const size = BRANCH_SIZES[b.size || 'medium'];
      const need = this.branchNeedOf(b.size || 'medium');
      const wm = { low: 0.92, market: 1, high: 1.12 }[b.wage];
      const pm = { cheap: 0.9, normal: 1, premium: 1.15 }[b.price];
      const load = need / Math.max(1, b.staff + (b.manager ? 1 : 0));
      const traffic = site.traffic * this.siteFit(site) * this.siteSeason(site) * (site.weekdayOnly ? 0.85 : 1);
      const premiumHit = site.rich ? 0.94 : 0.82;
      const mf = this.branchMgrFx(b);
      const demand = R0 * traffic * size.draw * clamp((b.rating - 2.4) / 1.4, 0.15, 1.5) * (pm < 1 ? 1.15 : pm > 1 ? premiumHit : 1) * (est ? 1 : 0.9 + this.rng() * 0.2);
      const cap = (R0 * 1.3 * size.cap * (b.staff + (b.manager ? 1 : 0)) * mf.cap) / need;
      const sold = Math.min(demand, cap);
      const revenue = sold * pm;
      const materials = sold * costShare * this.costMult.materials * (0.85 + 0.15 * this.idx.oil) * mf.mat;
      const wages = (b.staff * 38 * this.marketWage * wm + mf.wage) * (1 + (this.policy.insurance ? INS_TOTAL : 0));
      const rent = (this.ind.rent * site.rent * size.rent) / 4;
      return { revenue, profit: revenue - materials - wages - rent - revenue * 0.01, load, wm, pm, demand, cap };
    }

    // 選址畫面用：照預設設定估算每週營收和淨利
    estimateSite(site, size) {
      const b = { site: site.id, size, wage: 'market', price: 'normal', staff: this.branchNeedOf(size), rating: 3.7 };
      const r = this.branchWeek(b, true);
      return { revenue: Math.round(r.revenue), profit: Math.round(r.profit) };
    }

    // 每週結算分店：員工士氣 → 評價 → 來客；人手不夠會累垮，薪水太低會被爆料
    branchWeekly() {
      let total = 0;
      for (const b of this.branches) {
        const size = b.size || 'medium';
        const need = this.branchNeedOf(size);
        const wm = { low: 0.92, market: 1, high: 1.12 }[b.wage];
        const pm = { cheap: 0.9, normal: 1, premium: 1.15 }[b.price];
        const load = need / Math.max(1, b.staff + (b.manager ? 1 : 0));
        const mt = 62 + (wm - 1) * 160 + b.reno * 4 - Math.max(0, load - 1) * 35 - (this.jerk > 60 ? 8 : 0) - (this.policy.insurance ? 0 : 10);
        const mf = this.branchMgrFx(b);
        b.morale = clamp(b.morale + (mt + mf.morale - b.morale) * 0.45, 0, 100);
        const rt = 3.5 + mf.rating + (b.morale - 55) / 45 + b.reno * 0.18 + (pm < 1 ? 0.2 : pm > 1 ? -0.25 : 0) + (this.rating - 3.8) * 0.3 - Math.max(0, load - 1.2) * 0.8;
        b.rating = clamp(b.rating + (rt - b.rating) * 0.4, 1, 5);
        const r = this.branchWeek(b);
        const p = Math.round(r.profit);
        b.revenue = Math.round(r.revenue);
        b.busy = r.demand > r.cap * 1.05; // 客人多到做不完
        b.last = p;
        b.total += p;
        b.hist = [...(b.hist || []), p].slice(-12);
        total += p;
        if (b.wage === 'low') this.jerk = clamp(this.jerk + 0.5, 0, JERK_LIMIT);
        if (b.morale < 25 && this.rng() < 0.35) {
          this.jerk = clamp(this.jerk + 2, 0, JERK_LIMIT);
          this.notify(`📰 ${b.district}店的員工在 Dcard 發文抱怨：「人手不夠、薪水又低」`, 'bad');
        }
      }
      if (this.branches.length && this.jerk > 65 && this.rng() < 0.4) {
        this.jerk = clamp(this.jerk + 3, 0, JERK_LIMIT);
        this.notify('📰 分店員工在網路上爆料總店的管理方式……', 'bad');
      }
      return total;
    }

    // ───── 店面格子 ─────
    setLot(i) {
      const lot = LOTS[i];
      this.lotIdx = i;
      this.W = lot.w;
      this.H = lot.h;
      this.doorX = Math.floor(lot.w / 2) - 1;
      this.GX = this.W + OUT_W * 2;
      this.GZ = this.H + STREET;
      this.gridDirty = true;
    }

    upgradeLot() {
      const next = LOTS[this.lotIdx + 1];
      if (!next || this.cash < next.cost || (next.lv && this.level < next.lv)) return false;
      this.cash -= next.cost;
      this.ledger.other -= next.cost;
      const oldDoor = this.doorX;
      this.setLot(this.lotIdx + 1);
      // 門的位置變了，擋到新門口的東西往後挪不動就算了，玩家可以自己搬
      this.gridDirty = true;
      this.notify(`🏗️ 店面擴建成${next.name}！可以擺更多東西了。`, 'good');
      this.achieve(this.lotIdx === 1 ? 'medium' : 'large');
      return oldDoor !== this.doorX;
    }

    inside(x, z) {
      return x >= 0 && x < this.W && z >= 0 && z < this.H;
    }
    valid(x, z) {
      if (this.inside(x, z)) return true;
      return z >= this.H && z < this.H + STREET && x >= -OUT_W && x < this.W + OUT_W;
    }
    gi(x, z) {
      return (z * this.GX) + (x + OUT_W);
    }

    footprint(def, x, z, rot) {
      const o = { x, z, rot };
      const cells = [];
      for (let i = 0; i < (def.w || 1); i++) cells.push(local(o, i, 0));
      return cells;
    }

    rebuildGrid() {
      this.blocked = new Uint8Array(this.GX * this.GZ);
      for (const o of this.objects) {
        if (o.def.wall) continue;
        for (const c of o.cells) if (this.valid(c.x, c.z)) this.blocked[this.gi(c.x, c.z)] = 1;
      }
      this.gridDirty = false;
      // 物件變動時，重新計算服務位置
      this.stations = this.objects.filter((o) => o.def.cat === 'station');
    }

    passable(x, z) {
      if (!this.valid(x, z)) return false;
      if (this.gridDirty) this.rebuildGrid();
      return !this.blocked[this.gi(x, z)];
    }

    // 穿過前牆只能走門
    canStep(x, z, nx, nz) {
      const a = this.inside(x, z);
      const b = this.inside(nx, nz);
      if (a === b) return true;
      return x === nx && (x === this.doorX || x === this.doorX + 1) && Math.min(z, nz) === this.H - 1;
    }

    findPath(from, to) {
      if (this.gridDirty) this.rebuildGrid();
      const sx = Math.round(from.x);
      const sz = Math.round(from.z);
      if (!this.valid(sx, sz) || !this.valid(to.x, to.z)) return null;
      if (sx === to.x && sz === to.z) return [];
      const N = this.GX * this.GZ;
      const prev = new Int32Array(N).fill(-1);
      const start = this.gi(sx, sz);
      const goal = this.gi(to.x, to.z);
      prev[start] = start;
      const q = [start];
      let head = 0;
      while (head < q.length) {
        const cur = q[head++];
        if (cur === goal) break;
        const cx = (cur % this.GX) - OUT_W;
        const cz = Math.floor(cur / this.GX);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx;
          const nz = cz + dz;
          if (!this.valid(nx, nz)) continue;
          const ni = this.gi(nx, nz);
          if (prev[ni] !== -1) continue;
          if (ni !== goal && this.blocked[ni]) continue;
          if (!this.canStep(cx, cz, nx, nz)) continue;
          prev[ni] = cur;
          q.push(ni);
        }
      }
      if (prev[goal] === -1) return null;
      const path = [];
      for (let c = goal; c !== start; c = prev[c]) path.unshift({ x: (c % this.GX) - OUT_W, z: Math.floor(c / this.GX) });
      return path;
    }

    // ───── 擺放物件 ─────
    canPlace(type, x, z, rot, ignoreId) {
      const def = catalogById[type];
      if (!def) return false;
      const cells = this.footprint(def, x, z, rot);
      for (const c of cells) {
        if (!this.inside(c.x, c.z)) return false;
        if (def.wall && !(c.z === 0 || c.x === 0)) return false;
      }
      // 門口那兩格要留著
      if (!def.wall && cells.some((c) => c.z === this.H - 1 && (c.x === this.doorX || c.x === this.doorX + 1))) return false;
      for (const o of this.objects) {
        if (o.id === ignoreId || !!o.def.wall !== !!def.wall) continue;
        if (o.cells.some((a) => cells.some((b) => a.x === b.x && a.z === b.z))) return false;
      }
      if (!def.wall) {
        // 店員和客人要站的位置不能在牆外
        const probe = { x, z, rot };
        for (const [lx, lz] of [...(def.staff || []), ...(def.cust || []), ...(def.seats || [])]) {
          const p = local(probe, lx, lz);
          if (!this.inside(p.x, p.z)) return false;
          if (p.z === this.H - 1 && (p.x === this.doorX || p.x === this.doorX + 1)) return false;
        }
      }
      return true;
    }

    place(type, x, z, rot = 0, free = false) {
      const def = catalogById[type];
      if (!this.canPlace(type, x, z, rot)) return null;
      if (!free && !this.unlocked(def)) return null;
      if (!free) {
        if (this.cash < def.price) return null;
        this.cash -= def.price;
        this.ledger.other -= def.price;
      }
      const o = { id: uid++, type, def, x, z, rot, cells: this.footprint(def, x, z, rot) };
      this.initObject(o);
      this.objects.push(o);
      this.gridDirty = true;
      return o;
    }

    initObject(o) {
      const d = o.def;
      o.staffSpots = (d.staff || []).map(([lx, lz]) => local(o, lx, lz));
      o.custSpots = (d.cust || []).map(([lx, lz]) => local(o, lx, lz));
      o.seatSpots = (d.seats || d.waits || d.rest || []).map(([lx, lz]) => local(o, lx, lz));
      o.lanes = d.selfServe
        ? o.custSpots.map((c) => ({ staffSpot: null, custSpot: c, staff: null, customer: null, self: true }))
        : o.staffSpots.map((s, i) => ({ staffSpot: s, custSpot: o.custSpots[Math.min(i, o.custSpots.length - 1)], staff: null, customer: null }));
      o.queue = [];
      o.seatTaken = o.seatSpots.map(() => null);
    }

    moveObject(o, x, z, rot) {
      if (!this.canPlace(o.type, x, z, rot, o.id)) return false;
      if (o.lanes.some((l) => l.customer) || o.seatTaken.some(Boolean)) return false;
      this.releaseObject(o);
      Object.assign(o, { x, z, rot, cells: this.footprint(o.def, x, z, rot) });
      this.initObject(o);
      this.gridDirty = true;
      return true;
    }

    sell(o) {
      if (o.lanes.some((l) => l.customer)) return false;
      this.releaseObject(o);
      this.objects = this.objects.filter((x) => x !== o);
      const refund = Math.round(o.def.price * 0.5);
      this.cash += refund;
      this.ledger.other += refund;
      this.gridDirty = true;
      return refund;
    }

    releaseObject(o) {
      for (const c of [...o.queue]) this.customerLeave(c, 'noStation');
      for (const l of o.lanes) if (l.staff) l.staff.task = null;
      for (const e of this.staff) if (e.task && e.task.obj === o) e.task = null;
      for (const c of this.customers) if (c.seatObj === o) c.seatObj = null;
    }

    objectAt(x, z) {
      return this.objects.find((o) => !o.def.wall && o.cells.some((c) => c.x === x && c.z === z)) || this.objects.find((o) => o.cells.some((c) => c.x === x && c.z === z)) || null;
    }

    // ───── 食材庫存 ─────
    initStock() {
      this.ingOf = {};
      for (const g of this.ind.stock || []) for (const id of g.products) this.ingOf[id] = g;
      this.stock = {};
      this.par = {};
      this.usage = {};
      this.lastUsage = {};
      this.deliveries = [];
      const est = this.estimateUsage();
      for (const g of this.ind.stock || []) {
        this.par[g.id] = est[g.id];
        this.stock[g.id] = est[g.id];
      }
    }

    // 預估每天的食材用量：平均來客 × 每人點幾份 × 這種食材的品項占比
    estimateUsage() {
      const ind = this.ind;
      let traffic = 0;
      for (let m = ind.open; m < ind.close; m += 60) traffic += ind.demand[Math.floor(m / 60) % 24];
      const daily = ind.baseArrivals * traffic * (ind.basket || 1);
      const total = ind.products.reduce((s, p) => s + p.weight, 0);
      const out = {};
      for (const g of ind.stock || []) {
        const share = ind.products.filter((p) => g.products.includes(p.id)).reduce((s, p) => s + p.weight, 0) / total;
        out[g.id] = Math.max(5, Math.ceil((daily * share * (1.25 - g.spoil * 0.4)) / 5) * 5);
      }
      return out;
    }

    stockGroup(gid) {
      return (this.ind.stock || []).find((g) => g.id === gid);
    }

    // 一份食材的進價：跟著物價和油價（運費）漲
    unitCost(g) {
      const ps = this.ind.products.filter((p) => g.products.includes(p.id));
      const w = ps.reduce((s, p) => s + p.weight, 0);
      const avg = ps.reduce((s, p) => s + p.cost * p.weight, 0) / w;
      return avg * this.idx.cpi * this.costMult.materials * (0.85 + 0.15 * this.idx.oil);
    }

    incoming(gid) {
      return this.deliveries.reduce((s, d) => s + (d.items[gid] || 0), 0);
    }

    // 叫貨：先付錢，送貨員到店裡才入庫；急件比較貴
    orderStock(items, { rush = false, at } = {}) {
      let cost = 0;
      const list = {};
      for (const [gid, n] of Object.entries(items)) {
        const g = this.stockGroup(gid);
        if (!g || n <= 0) continue;
        list[gid] = Math.round(n);
        cost += n * this.unitCost(g) * (rush ? 1.3 : 1);
      }
      if (!Object.keys(list).length) return null;
      cost = Math.round(cost + (rush ? 300 : 0));
      if (rush && this.cash < cost) return null;
      this.cash -= cost;
      this.ledger.materials += cost;
      const d = { id: uid++, items: list, cost, rush, at: at ?? this.minute + (rush ? 40 : 0), sent: false };
      this.deliveries.push(d);
      return d;
    }

    rushSize(gid) {
      return Math.max(5, Math.ceil((this.par[gid] * 0.35) / 5) * 5);
    }

    rushOrder(gid) {
      const g = this.stockGroup(gid);
      const n = this.rushSize(gid);
      const d = this.orderStock({ [gid]: n }, { rush: true });
      if (d) this.notify(`🛵 叫了急件：${g.name} ${n} 份，大約 40 分鐘送到（$${d.cost.toLocaleString()}）`);
      return d;
    }

    // 每天早上的例行進貨：補到設定的進貨量
    morningOrder() {
      const items = {};
      for (const g of this.ind.stock || []) {
        if (this.policy.autoStock && this.lastUsage[g.id]) this.par[g.id] = Math.max(5, Math.ceil((this.lastUsage[g.id] * 1.15) / 5) * 5);
        const need = this.par[g.id] - this.stock[g.id] - this.incoming(g.id);
        if (need > 0) items[g.id] = need;
      }
      this.orderStock(items, { at: this.dayStart + 15 });
    }

    // 送貨員：騎車到門口，把貨搬進來
    spawnSupplier(d) {
      const fromLeft = this.rng() < 0.5;
      const c = { id: uid++, kind: 'customer', supplier: true, delivery: d, look: { ...SUPPLIER_LOOK }, x: fromLeft ? -OUT_W : this.W + OUT_W - 1, z: this.H + 1, path: [], state: 'arriving', waited: 0, patience: 999, progress: 0, scooter: true, qty: 1 };
      this.customers.push(c);
      if (!this.walkTo(c, { x: this.doorX, z: this.H - 1 })) this.receiveDelivery(c);
    }

    receiveDelivery(c) {
      const d = c.delivery;
      for (const [gid, n] of Object.entries(d.items)) this.stock[gid] = (this.stock[gid] || 0) + n;
      this.deliveries = this.deliveries.filter((x) => x !== d);
      this.popup(c, d.rush ? '📦 急件到了' : '📦 進貨', 'good');
      this.customerLeave(c, 'done');
    }

    hasStock(p, n = 1) {
      const g = this.ingOf[p.id];
      return !g || this.stock[g.id] >= n;
    }

    stockLeft(p) {
      const g = this.ingOf[p.id];
      return g ? this.stock[g.id] : Infinity;
    }

    reserveStock(c) {
      const g = this.ingOf[c.product.id];
      if (!g) return;
      this.stock[g.id] -= c.qty;
      this.usage[g.id] = (this.usage[g.id] || 0) + c.qty;
      c.reserved = { gid: g.id, qty: c.qty };
      if (this.stock[g.id] <= 0) this.stockOutNotice(g);
      else if (this.stock[g.id] < this.par[g.id] * 0.15 && !this.today.lowWarned[g.id]) {
        this.today.lowWarned[g.id] = true;
        this.notify(`${g.icon} ${g.name}快用完了（剩 ${this.stock[g.id]} 份），可以到「📦 庫存」叫急件`, 'bad');
        if (this.cb.stockLow) this.cb.stockLow(g);
      }
    }

    releaseStock(c) {
      if (!c.reserved) return;
      this.stock[c.reserved.gid] += c.reserved.qty;
      this.usage[c.reserved.gid] -= c.reserved.qty;
      c.reserved = null;
    }

    stockOutNotice(g) {
      if (this.today.outWarned[g.id]) return;
      this.today.outWarned[g.id] = true;
      this.notify(`${g.icon} ${g.name}賣完了！相關品項只能暫停供應，可以到「📦 庫存」叫急件。`, 'bad');
      this.sound('bad');
      if (this.cb.stockLow) this.cb.stockLow(g);
    }

    // ───── 清潔與衛生 ─────
    get cleanliness() {
      const d = this.dirt.reduce((s, x) => s + Math.min(3, x.amt), 0);
      return clamp(100 - this.grime - d * 2.6, 0, 100);
    }

    get inspectorOrg() {
      return this.ind.id === 'scooter' ? '環保局' : '衛生局';
    }

    addDirt(x, z, amt = 1, kind) {
      x = Math.round(x);
      z = Math.round(z);
      if (!this.inside(x, z)) return;
      const d = this.dirt.find((k) => k.x === x && k.z === z);
      if (d) d.amt = Math.min(4, d.amt + amt);
      else if (this.dirt.length < 36) this.dirt.push({ id: uid++, x, z, amt, kind: kind || { barber: 'hair', scooter: 'oil', drinks: 'spill' }[this.ind.id] || 'food', by: null });
    }

    cleanerLimit() {
      const working = this.staff.filter((e) => e.state === 'working').length;
      return this.cleanRushUntil > this.minute ? working : Math.max(1, Math.floor(working / 2));
    }

    // 沒客人的時候，員工會自己拿拖把打掃
    tryClean(e) {
      if (!this.dirt.length) return false;
      const cleaning = this.staff.filter((s) => s.task && s.task.type === 'clean').length;
      if (cleaning >= this.cleanerLimit()) return false;
      const free = this.dirt.filter((d) => !d.by);
      const dist = (d) => Math.abs(d.x - e.x) + Math.abs(d.z - e.z);
      free.sort((a, b) => dist(a) - dist(b));
      for (const d of free.slice(0, 3)) {
        if (this.walkTo(e, d)) {
          const cur = e.task && e.task.lane;
          if (cur && cur.staff === e) cur.staff = null;
          d.by = e.id;
          e.task = { type: 'clean', spot: d };
          return true;
        }
      }
      return false;
    }

    doClean(e, dt) {
      const d = e.task.spot;
      if (!this.dirt.includes(d)) {
        e.task = null;
        return;
      }
      if (e.path.length) return;
      const boost = this.objects.some((o) => o.def.cleanBoost) ? 1.6 : 1;
      d.amt -= dt * 0.45 * boost * (0.7 + e.skill / 200);
      if (d.amt <= 0) {
        this.dirt = this.dirt.filter((x) => x !== d);
        e.task = null;
        if (this.rng() < 0.15) this.say(e, ['擦乾淨了 ✨', '地板亮晶晶', '桌子擦好了'][Math.floor(this.rng() * 3)], 30);
      }
    }

    dropTask(e) {
      if (!e.task) return;
      if (e.task.lane && e.task.lane.staff === e) e.task.lane.staff = null;
      if (e.task.type === 'rest' && e.task.obj) e.task.obj.seatTaken[e.task.seat] = null;
      if (e.task.type === 'clean' && e.task.spot) e.task.spot.by = null;
      e.task = null;
    }

    // 老闆喊一聲：有空的人都先去打掃
    rushClean() {
      this.cleanRushUntil = this.minute + 40;
      for (const e of this.staff) if (e.state === 'working' && !(e.task && e.task.lane && e.task.lane.customer)) this.tryClean(e);
    }

    get deepCleanCost() {
      return Math.round((2500 + this.W * this.H * 60) / 100) * 100;
    }

    // 請清潔公司來大掃除：油垢歸零
    deepClean() {
      const cost = this.deepCleanCost;
      if (this.cash < cost) return false;
      this.cash -= cost;
      this.ledger.cleaning += cost;
      this.grime = 0;
      for (const e of this.staff) if (e.task && e.task.type === 'clean') e.task = null;
      this.dirt = [];
      this.notify(`🧽 清潔公司來大掃除，店裡煥然一新！（$${cost.toLocaleString()}）`, 'good');
      return true;
    }

    // 衛生稽查員：在店裡繞一圈再打分數
    spawnInspector() {
      const fromLeft = this.rng() < 0.5;
      const c = { id: uid++, kind: 'customer', inspector: true, look: { ...INSPECTOR_LOOK }, x: fromLeft ? -OUT_W : this.W + OUT_W - 1, z: this.H, path: [], state: 'arriving', waited: 0, patience: 999, progress: 0, qty: 1 };
      this.customers.push(c);
      this.walkTo(c, { x: this.doorX + 1, z: this.H - 1 });
      this.notify(`🕵️ ${this.inspectorOrg}的稽查員往店裡走過來了！`, 'event');
      this.sound('alert');
    }

    finishInspection(c) {
      const cl = this.cleanliness;
      const org = this.inspectorOrg;
      let r;
      if (cl >= 80) {
        r = { grade: '優', fine: 0, text: `${org}稽查結果「優良」，門口貼上了衛生優良標章！` };
        this.demandMods.push({ mult: 1.05, days: 14 });
        this.hygiene.warned = false;
        this.hygiene.badge = this.day + 28;
        this.achieve('hygiene');
      } else if (cl >= 60) {
        r = { grade: '良', fine: 0, text: `${org}稽查通過，稽查員提醒有些角落要再加強。` };
        this.hygiene.warned = false;
      } else if (cl >= 40 && !this.hygiene.warned) {
        r = { grade: '限期改善', fine: 0, text: `${org}開了限期改善通知，一週內會再來複查，沒改善就要罰錢。` };
        this.hygiene.warned = true;
      } else {
        const fine = Math.round(((cl < 25 ? 60000 : 30000) * this.diff.fines) / 1000) * 1000;
        r = { grade: '不合格', fine, text: `${org}稽查不合格，罰鍰 $${fine.toLocaleString()}，還上了地方新聞。` };
        this.cash -= fine;
        this.ledger.fines += fine;
        this.demandMods.push({ mult: 0.88, days: 10 });
        this.addReview(1, '看到新聞說這家衛生不合格，不敢再去了');
        this.hygiene.warned = true;
      }
      r.day = this.day;
      r.clean = Math.round(cl);
      this.hygiene.last = r;
      this.notify(`🕵️ ${r.text}`, r.fine || r.grade === '限期改善' ? 'bad' : 'good');
      if (this.cb.hygiene) this.cb.hygiene(r);
      this.customerLeave(c, 'done');
    }

    // ───── 競爭對手 ─────
    get promoOn() {
      return !!this.promo && this.day <= this.promo.until;
    }

    effPrice(id) {
      return Math.round(this.prices[id] * (this.promoOn ? 1 - this.promo.off : 1));
    }

    startPromo(days = 7) {
      this.promo = { until: this.day + days - 1, off: 0.1 };
      this.demandMods.push({ mult: 1.05, days });
      this.notify(`🎉 全品項九折優惠，一連 ${days} 天！`, 'good');
    }

    flyers() {
      if (this.cash < 3000) return false;
      this.cash -= 3000;
      this.ledger.other -= 3000;
      this.demandMods.push({ mult: 1.1, days: 5 });
      if (this.rival && !this.rival.closed) this.rival.strength = clamp(this.rival.strength - 0.04, 0, 1);
      this.notify('📄 員工在路口發了一整天傳單，這幾天客人會多一點。', 'good');
      return true;
    }

    buyLoyalty() {
      if (this.loyalty || this.cash < 8000) return false;
      this.cash -= 8000;
      this.ledger.other -= 8000;
      this.loyalty = true;
      this.notify('💳 印了集點卡：集滿十點送一份，熟客會更常來。', 'good');
      return true;
    }

    // 對面的店搶走多少客人
    rivalPull() {
      const r = this.rival;
      if (!r || r.closed) return 1;
      if (r.truceUntil && r.truceUntil >= this.day) return 0.97;
      const opening = this.day - r.opened < 10 ? 0.12 : 0;
      return 1 - (0.22 * r.strength + opening) * this.diff.rival;
    }

    maybeRival() {
      const r = this.rival;
      if (r && !r.closed) return;
      const first = !r && this.week >= 3 && (this.rng() < 0.45 || this.week >= 5);
      const again = r && r.closed && this.week - r.closedWeek >= 10 && this.rng() < 0.2;
      if (!first && !again) return;
      const base = this.ind.rival;
      const n = r ? r.n + 1 : 1;
      this.rival = { name: n > 1 ? `新${base.name}` : base.name, color: base.color, n, opened: this.day, strength: 0.6, low: 0, closed: false, quality: 0.45 + this.rng() * 0.2 };
      this.rivalNews = true;
      this.notify(`🏪 對面在裝潢，聽說要開一間「${this.rival.name}」……`, 'event');
    }

    rivalWeekly() {
      const r = this.rival;
      if (!r || r.closed) return;
      const avgRatio = this.priceRatio();
      const mine = (this.rating - 3.6) * 0.5 + (1 - avgRatio) * 1.2 + (this.cleanliness - 70) / 200 + this.beauty / 120 + (this.loyalty ? 0.06 : 0);
      const target = clamp(r.quality - mine, 0.05, 1);
      r.strength = clamp(r.strength + (target - r.strength) * 0.35 + (this.rng() - 0.5) * 0.06, 0, 1);
      r.low = r.strength < 0.18 ? r.low + 1 : 0;
      if (r.low >= 2 && this.day - r.opened > 21) {
        r.closed = true;
        r.closedWeek = this.week;
        this.notify(`🏳️ 對面的「${r.name}」撐不下去，貼出了頂讓的紅紙。`, 'achieve');
        this.achieve('rival');
        return;
      }
      // 記仇：越恨你越容易報復
      if ((r.grudge || 0) > 0 && !(r.truceUntil >= this.day) && this.rng() < Math.min(0.8, 0.15 * r.grudge)) this.rivalRevenge = true;
      // 對面開更高的時薪挖角
      if (this.rng() < 0.35 * r.strength) {
        const cand = this.staff.filter((e) => e.wage < this.marketWage * 1.03 || e.mood < 50);
        if (cand.length) this.rivalPoach = cand[Math.floor(this.rng() * cand.length)].id;
      }
    }

    // ───── 小編與社群 ─────
    rollTrend() {
      const m = this.monthOfYear;
      const pool = Fun.TRENDS.filter((t) => (!t.months || t.months.includes(m)) && (!t.ind || t.ind.includes(this.ind.id)) && (!this.social.trend || t.id !== this.social.trend.id));
      if (!pool.length) return;
      this.social.trend = pool[Math.floor(this.rng() * pool.length)];
      this.social.trendDay = this.day;
    }

    // 時事熱度：剛出來最熱，一週後就退燒
    get trendHeat() {
      const age = this.day - this.social.trendDay;
      return clamp(1.6 - age * 0.22, 0.2, 1.6);
    }

    get canPost() {
      return this.social.lastPost !== this.day;
    }

    fillPost(text) {
      const ps = this.availableProducts();
      const p = ps.find((x) => x.weight >= 3) || ps[0] || this.ind.products[0];
      const e = this.staff[Math.floor(this.rng() * Math.max(1, this.staff.length))];
      return text.replace(/\{shop\}/g, this.shopName).replace(/\{item\}/g, p.name).replace(/\{price\}/g, this.prices[p.id]).replace(/\{staff\}/g, e ? e.name : '小編');
    }

    // 發文：開頭＋內容＋結尾，蹭對時事、越早蹭越紅；踩雷會炎上
    post(hookId, bodyId, endId) {
      if (!this.canPost) return null;
      const h = Fun.POST_HOOKS.find((x) => x.id === hookId);
      const b = Fun.POST_BODIES.find((x) => x.id === bodyId);
      const en = Fun.POST_ENDINGS.find((x) => x.id === endId);
      if (!h || !b || !en) return null;
      if (en.cost) {
        this.cash -= en.cost;
        this.ledger.other -= en.cost;
      }
      const trend = this.social.trend;
      const onTrend = b.trend && trend && b.trend === trend.id;
      const offTrend = b.trend && !onTrend;
      // 太常發同一種，大家會膩
      const repeat = this.social.posts.slice(0, 3).filter((x) => x.body === bodyId).length;
      let score = h.score + b.score + en.score;
      if (onTrend) score *= this.trendHeat;
      if (offTrend) score *= 0.4; // 蹭過期的時事
      score *= 1 - repeat * 0.3;
      score *= 0.75 + this.rng() * 0.5;
      if (this.flags.has('trendDare')) score *= 1.1;
      let fire = null;
      if (b.risky && this.rng() < b.risky) fire = b.riskText || '踩到雷了';
      const base = 40 + this.social.followers * 0.25;
      let likes = Math.round(base * Math.pow(Math.max(0.3, score) / 6, 2.2) * (1 + this.rating / 10));
      let tier = score >= 12 ? 'viral' : score >= 8 ? 'good' : score >= 5 ? 'meh' : 'flop';
      if (fire) {
        tier = 'fire';
        likes = Math.round(likes * 0.6);
      }
      const gain = fire ? -Math.round(this.social.followers * 0.05) : Math.round(likes * (tier === 'viral' ? 0.5 : tier === 'good' ? 0.25 : 0.08));
      this.social.followers = Math.max(0, this.social.followers + gain);
      const pool = Fun.COMMENTS[tier] || [];
      const comments = [...pool].sort(() => this.rng() - 0.5).slice(0, 3);
      const text = this.fillPost(`${h.text}${b.text}\n${en.text}`);
      const post = { day: this.day, hook: hookId, body: bodyId, end: endId, text, likes, shares: Math.round(likes * (tier === 'viral' ? 0.3 : 0.05)), gain, tier, comments, fire, trend: onTrend ? trend.name : null };
      this.social.posts.unshift(post);
      this.social.posts = this.social.posts.slice(0, 12);
      this.social.lastPost = this.day;
      if (tier === 'viral') {
        this.demandMods.push({ mult: 1.18, days: 4 });
        this.social.viral++;
        this.gainXp(150);
        this.notify(`📱 貼文爆紅！${likes.toLocaleString()} 個讚，粉絲 +${gain.toLocaleString()}，這幾天客人會變多`, 'achieve');
        this.achieve('viral');
        if (this.flags.has('trendDare')) {
          this.flags.delete('trendDare');
          this.notify('😎 同業群組安靜了。', 'good');
        }
      } else if (tier === 'good') {
        this.demandMods.push({ mult: 1.07, days: 3 });
        this.notify(`📱 貼文反應不錯：${likes.toLocaleString()} 個讚`, 'good');
      } else if (fire) {
        this.demandMods.push({ mult: 0.9, days: 4 });
        this.jerk = clamp(this.jerk + 1, 0, JERK_LIMIT);
        this.addReview(1, '看到粉專的貼文，不想支持了');
        this.notify(`🔥 炎上了：${fire}`, 'bad');
        this.sound('bad');
      } else this.notify(`📱 貼文發出去了：${likes} 個讚`);
      this.sound(tier === 'viral' ? 'level' : 'click');
      return post;
    }

    // 粉絲越多，越多人知道這間店
    get socialBoost() {
      return 1 + clamp(Math.log10(Math.max(1, this.social.followers) / 80) * 0.06, 0, 0.22);
    }

    // ───── 奧客 ─────
    spawnKaren() {
      const k = Fun.KARENS[Math.floor(this.rng() * Fun.KARENS.length)];
      if (!k) return;
      const before = this.customers.length;
      this.spawnCustomer({ karen: k });
      const c = this.customers[before];
      if (!c) return;
      c.karen = k;
      c.patience *= 3;
      c.look = { ...Looks.VISITORS.karen, ...c.look, shades: k.id === 'influencer' || k.id === 'manager', extra: null };
    }

    karenScene(c) {
      if (c.karenDone || !c.karen) return;
      c.karenDone = true;
      const working = this.staff.filter((e) => e.state === 'working');
      const victim = (c.lane && c.lane.staff) || working[Math.floor(this.rng() * working.length)] || null;
      this.say(c, c.karen.rounds[0].line, 60);
      if (victim) this.say(victim, '……（深呼吸）', 60);
      const ev = { ev: karenEvent(this, c.karen, victim), at: this.minute, where: 'staff', staffPref: victim, karen: c };
      this.spawnEvent(ev);
    }

    // ───── 店長建議：現在最該處理的幾件事 ─────
    advice() {
      const out = [];
      const d = this.lastDay;
      const working = this.staff.length;
      if (!working) out.push({ icon: '👥', text: '一個員工都沒有，店開不起來！先去錄取應徵者。', tab: 'staff' });
      if (d && d.visitors > 10 && d.angry / d.visitors > 0.08) out.push({ icon: '😡', text: `昨天有 ${d.angry} 位客人等到生氣離開：人手不夠，或設備的服務位不夠。多請一個人，或在尖峰那一班多排人。`, tab: 'staff' });
      if (d && d.soldOut > 3) out.push({ icon: '📦', text: `昨天有 ${d.soldOut} 位客人遇到賣完：把進貨量調高，或打開自動進貨。`, tab: 'stock' });
      if (this.cleanliness < 65) out.push({ icon: '🧽', text: `店裡有點髒（${Math.round(this.cleanliness)} 分），客人會變少，也可能被稽查。叫大家先打掃或請清潔公司大掃除。`, tab: 'stock' });
      const tired = this.staff.filter((e) => e.mood < 35);
      if (tired.length) out.push({ icon: '😞', text: `${tired.map((e) => e.name).join('、')} 心情很差，再這樣下去會離職：加薪、稱讚、讓他休假，或檢查是不是排太長的班。`, tab: 'staff' });
      const span = this.hours.span / this.hours.shifts;
      if (span > 8.5 * 60) out.push({ icon: '⏰', text: `每一班超過 8 小時（約 ${(span / 60).toFixed(1)} 小時）：改成兩班，員工比較不累，也省加班費。`, tab: 'manage' });
      if (!this.restSpots().length) out.push({ icon: '☕', text: '沒有員工休息區：買一張員工休息桌，員工心情和精力都會好很多。', tab: 'build' });
      if (this.isSummer && !this.cooling) out.push({ icon: '❄️', text: '夏天沒有冷氣，客人和員工都受不了：買冷氣或電風扇。', tab: 'build' });
      if (this.priceRatio() > 1.12) out.push({ icon: '💲', text: '價格比行情貴不少，學生和長輩會不想進來。', tab: 'manage' });
      if (this.priceRatio() < 0.88) out.push({ icon: '💲', text: '價格比行情便宜很多，賣越多可能虧越多，可以調回建議價。', tab: 'manage' });
      if (this.cash < 60000) out.push({ icon: '🏦', text: '現金快不夠了：可以先跟銀行借錢，或減少不必要的支出。', tab: 'manage' });
      if (this.canPost && this.social.trend && this.trendHeat > 1.1) out.push({ icon: '📱', text: `最近大家都在聊「${this.social.trend.name}」，趁熱發一篇蹭時事的貼文吧！`, tab: 'social' });
      const lockedRecipe = this.ind.products.find((p) => p.rd && !this.recipes.has(p.id) && this.level >= (p.lv || 1) && this.cash > p.rd * 3);
      if (lockedRecipe) out.push({ icon: '🧪', text: `可以研發新品「${lockedRecipe.name}」了，菜單變豐富會吸引更多客人。`, tab: 'manage' });
      if (this.rival && !this.rival.closed && this.rival.strength > 0.6) out.push({ icon: '🏪', text: `隔壁的「${this.rival.name}」很強：衝評價、保持乾淨、發傳單或辦優惠。`, tab: 'goals' });
      return out;
    }

    // ───── 客人類型 ─────
    pickType() {
      const h = this.hour;
      const weekend = this.weekday >= 5;
      const summerBreak = [7, 8].includes(this.monthOfYear);
      const list = [];
      let total = 0;
      for (const t of Object.values(CUSTOMER_TYPES)) {
        let w = t.hours[h] ?? t.base;
        if (weekend) w *= t.weekend;
        if (t.id === 'student' && summerBreak && h < 11) w *= 0.4;
        if (t.id === 'student' && this.festival && this.festival.id === 'school') w *= 1.5;
        w *= (this.ind.mix && this.ind.mix[t.id]) || 1;
        if (this.collabs.some((c) => c.types.includes(t.id))) w *= 1.25;
        list.push([t, w]);
        total += w;
      }
      let r = this.rng() * total;
      for (const [t, w] of list) {
        r -= w;
        if (r <= 0) return t;
      }
      return list[0][0];
    }

    // 對價格敏感的客人，看到價目表太貴就不進來了
    typeAccepts(t) {
      if (t.priceSens <= 1) return true;
      const avgRatio = this.priceRatio();
      if (avgRatio <= 1.05) return true;
      return this.rng() > Math.min(0.85, (avgRatio - 1.05) * (t.priceSens - 1) * 4);
    }

    typeLook(t) {
      const pick = (arr) => arr[Math.floor(this.rng() * arr.length)];
      const L = Looks.randomLook(this.rng);
      if (!t) return L;
      if (t.id === 'student') return { ...L, old: false, hair: L.old ? '#2b2420' : L.hair, hairStyle: L.hairStyle === 'bald' ? 'short' : L.hairStyle, shirt: pick(['#f4f4f4', '#f4f4f4', '#dfe8f5', '#2f4f7f']), extra: 'backpack', extraColor: pick(['#2c6fbb', '#d9482b', '#2f8f6b', '#333333', '#e0478a']) };
      if (t.id === 'office') return { ...L, old: false, hair: L.old ? '#2b2420' : L.hair, hairStyle: L.hairStyle === 'bald' ? 'side' : L.hairStyle, shirt: pick(['#f0f0f0', '#dfe8f5', '#2e3a52', '#4a5568']), suit: this.rng() < 0.4, tie: L.gender === 'm' ? pick(['#c0392b', '#2c6fbb', '#6c5ce7', '#2f8f6b']) : null, extra: 'briefcase', extraColor: '#3a2c25' };
      if (t.id === 'elderly') return { ...L, old: true, hair: pick(['#9a9a9a', '#c8c8c8', '#e0e0e0']), hairStyle: L.gender === 'f' ? pick(['bun', 'bob']) : pick(['bald', 'short', 'side']), shirt: pick(['#8a6d5b', '#6b7f8f', '#9b5d7a', '#5f7f5f', '#b07a4f']), extra: this.rng() < 0.45 ? 'cane' : null };
      return L;
    }

    // ───── 員工 ─────
    makeCandidate(forceTrait) {
      const used = new Set([...this.staff.map((e) => e.name), ...(this.candidates || []).map((c) => c.name)]);
      const pool = NAMES.filter(([n]) => !used.has(n));
      const [name, gender] = pool[Math.floor(this.rng() * pool.length)] || ['阿明', 'm'];
      const traitIds = Object.keys(TRAITS);
      const traits = [forceTrait || traitIds[Math.floor(this.rng() * traitIds.length)]];
      if (this.rng() < 0.45) {
        const t2 = traitIds[Math.floor(this.rng() * traitIds.length)];
        if (!traits.includes(t2) && !(traits.includes('rookie') && t2 === 'veteran') && !(traits.includes('veteran') && t2 === 'rookie')) traits.push(t2);
      }
      let skill = 30 + this.rng() * 30;
      if (traits.includes('rookie')) skill = 8 + this.rng() * 20;
      if (traits.includes('veteran')) skill = 62 + this.rng() * 25;
      const u = Looks.UNIFORM[this.ind.id] || {};
      const look = Looks.randomLook(this.rng, gender, { shirt: (u.shirts || ['#4a6fa5'])[Math.floor(this.rng() * (u.shirts || [1]).length)], hat: u.hat, hatColor: u.hatColor });
      const plus = traits.includes('veteran') ? TRAITS.veteran.wagePlus : 0;
      const wage = Math.max(MIN_WAGE, Math.round((this.marketWage * (0.92 + skill / 500 + plus) * this.diff.wage) / 5) * 5);
      const c = { name, gender, look, traits, skill: Math.round(skill), wage };
      // 面試時就決定好領導力、企圖心和風格（看得到的只有印象）
      const tmp = this.ensureCareer({ traits });
      for (const k of ['lead', 'ambition', 'style', 'leadSeen', 'hint']) c[k] = tmp[k];
      return c;
    }

    rollCandidates() {
      this.candidates = [];
      const out = [];
      for (let i = 0; i < 3; i++) {
        const c = this.makeCandidate();
        out.push(c);
        this.candidates = out;
      }
      return out;
    }

    addEmployee(c, silent) {
      const e = {
        id: uid++,
        name: c.name,
        gender: c.gender,
        look: { ...c.look, name: c.name },
        traits: c.traits,
        skill: c.skill,
        wage: c.wage,
        energy: 100,
        hunger: 90,
        mood: 72,
        state: 'off',
        x: -OUT_W,
        z: this.H + 1,
        path: [],
        task: null,
        thought: null,
        thoughtCd: 20 + this.rng() * 40,
        minutesToday: 0,
        lowMoodDays: 0,
        hiredDay: this.day,
        praiseDay: 0,
        sentHomeDay: 0,
        slot: this.staff.length,
        served: 0,
        shiftPref: 'auto', // 'auto' 或固定第幾班
        restDays: null, // null：照輪休規則；陣列：每週固定休哪幾天（0 = 週一）
        post: null, // 固定崗位：設備的 id
      };
      for (const k of ['lead', 'ambition', 'style', 'leadSeen', 'hint']) if (c[k] != null) e[k] = c[k];
      this.ensureCareer(e);
      this.staff.push(e);
      if (!silent) this.notify(`👋 ${e.name} 加入了團隊！`, 'good');
      return e;
    }

    hire(i) {
      const c = this.candidates[i];
      if (!c) return null;
      const fee = 1500;
      this.cash -= fee;
      this.ledger.other -= fee;
      const e = this.addEmployee(c);
      this.candidates.splice(i, 1);
      this.candidates.push(this.makeCandidate());
      return e;
    }

    severanceOf(e) {
      const weeks = Math.max(1, (this.day - e.hiredDay) / 7);
      return Math.round(e.wage * 8 * Math.min(30, 5 + weeks * 1.5));
    }

    fire(e) {
      const pay = this.severanceOf(e);
      this.cash -= pay;
      this.ledger.wages -= pay;
      this.removeEmployee(e);
      this.jerk = clamp(this.jerk + 1, 0, JERK_LIMIT);
      for (const o of this.staff) o.mood = clamp(o.mood - 4, 0, 100);
      this.notify(`📄 你依法資遣了 ${e.name}，付了資遣費 $${pay.toLocaleString()}。`);
    }

    removeEmployee(e, transfer) {
      this.dropTask(e);
      this._fxAt = null;
      // 店長走了，大家會有點慌
      if (e.rank === 'manager' && !transfer) {
        for (const o of this.staff) if (o !== e) o.mood = clamp(o.mood - 5, 0, 100);
        this.notify(`😟 店長${e.name}走了，大家有點不知所措。`, 'bad');
      }
      // 好朋友走了，留下來的人會難過，太難過也可能跟著走
      if (!transfer) for (const o of this.friendsOf(e)) {
        o.mood = clamp(o.mood - 12, 0, 100);
        this.say(o, `${e.name}走了，好捨不得……`, 120);
        if (o.mood < 30) o.lowMoodDays += 1;
      }
      for (const k of Object.keys(this.rel)) if (k.split('-').includes(String(e.id))) delete this.rel[k];
      this.staff = this.staff.filter((x) => x !== e);
      for (const ev of this.activeEvents) if (ev.staff === e) ev.staff = this.staff[0] || null;
    }

    // ───── 老闆本人 ─────
    bossEnter() {
      const b = this.boss;
      b.state = 'working';
      b.x = this.doorX;
      b.z = this.H - 1;
      b.path = [];
      b.ride = false;
    }

    bossExit() {
      this.bossLeaveLane();
      this.boss.state = 'off';
      this.boss.ride = false;
    }

    // 老闆可以站的格子：騎機車時只能在店外
    bossCanStand(x, z) {
      const cx = Math.round(x);
      const cz = Math.round(z);
      if (!this.valid(cx, cz)) return false;
      if (this.boss.ride && cz < this.H) return false;
      return this.passable(cx, cz) || this.objects.some((o) => o.lanes.some((l) => l.staffSpot && l.staffSpot.x === cx && l.staffSpot.z === cz));
    }

    // 用鍵盤／搖桿移動（實際秒數）
    moveBoss(vx, vz, sec) {
      const b = this.boss;
      if (b.state !== 'working' || b.away) return;
      const len = Math.hypot(vx, vz);
      b.moving = len > 0.05;
      if (!b.moving) return;
      const tired = b.energy < 20 ? 0.7 : 1;
      const sp = (b.ride ? 6.5 : 3) * tired * sec;
      const dx = (vx / Math.max(1, len)) * sp;
      const dz = (vz / Math.max(1, len)) * sp;
      const tryMove = (nx, nz) => {
        const fx = Math.round(b.x);
        const fz = Math.round(b.z);
        const tx = Math.round(nx);
        const tz = Math.round(nz);
        if ((fx !== tx || fz !== tz) && (!this.bossCanStand(nx, nz) || !this.canStep(fx, fz, tx, tz))) return false;
        if (!this.valid(tx, tz)) return false;
        b.x = nx;
        b.z = nz;
        return true;
      };
      tryMove(b.x + dx, b.z);
      tryMove(b.x, b.z + dz);
      b.dir = Math.atan2(dx, dz);
      if (b.lane && Math.hypot(b.x - b.lane.staffSpot.x, b.z - b.lane.staffSpot.z) > 0.7) this.bossLeaveLane();
      // 走近員工，員工會打招呼
      for (const e of this.staff) {
        if ((e.state === 'working' || e.state === 'break') && Math.hypot(e.x - b.x, e.z - b.z) < 1.2 && (e.helloAt || 0) < this.minute - 90) {
          e.helloAt = this.minute;
          if (this.rng() < 0.6) this.say(e, Fun.BOSS_HELLO[Math.floor(this.rng() * Fun.BOSS_HELLO.length)], 25);
        }
      }
    }

    // 走到街的盡頭：可以出門
    get bossAtEdge() {
      const b = this.boss;
      return b.state === 'working' && !b.away && b.z >= this.H && (b.x <= -OUT_W + 0.4 || b.x >= this.W + OUT_W - 1.4);
    }

    // 老闆身邊可以互動的東西（最近的排前面）
    bossTargets() {
      const b = this.boss;
      if (b.state !== 'working' || b.away) return [];
      const out = [];
      const near = (a, r) => Math.hypot(a.x - b.x, a.z - b.z) <= r;
      const d = (a) => Math.hypot(a.x - b.x, a.z - b.z);
      if (b.lane) out.push({ kind: 'leaveLane', d: -1, label: '離開櫃台', actions: [['boss-leave-lane', '🚶 離開櫃台']] });
      for (const c of this.customers) {
        if (c.state === 'leaving' || !near(c, 1.3)) continue;
        if (c.karen) out.push({ kind: 'karen', ref: c, d: d(c) - 0.5, label: `處理奧客：${c.karen.name}`, actions: [['boss-karen', '🎤 出面處理']] });
        else if (!c.supplier && !c.inspector) out.push({ kind: 'customer', ref: c, d: d(c), label: '跟客人互動', actions: [['boss-greet', '😊 打招呼'], ['boss-gift', '🎁 招待一份小菜（$30）']] });
      }
      for (const e of this.staff) {
        if ((e.state === 'working' || e.state === 'break') && near(e, 1.4)) out.push({ kind: 'staff', ref: e, d: d(e), label: `跟${e.name}互動`, actions: [['chat', '💬 聊天'], ['praise', '👍 稱讚'], ['treat', '🧋 請飲料'], ['rest-now', '☕ 叫他休息'], ['scold', '😠 罵人']] });
      }
      if (!b.ride) {
        for (const dd of this.dirt) if (near(dd, 0.9)) out.push({ kind: 'dirt', ref: dd, d: d(dd) + 0.2, label: '拖地', actions: [['boss-mop', '🧹 拖地']] });
        if (!b.lane) {
          for (const o of this.stations) for (const l of o.lanes) if (!l.self && !l.staff && near(l.staffSpot, 0.9)) out.push({ kind: 'lane', ref: l, obj: o, d: d(l.staffSpot), label: `親自顧${o.def.name}`, actions: [['boss-lane', `🧑‍🍳 親自顧${o.def.name}`]] });
        }
      }
      if (b.z >= this.H - 0.2) {
        for (const p of this.passers) if (p.kind === 'passer' && !p.flyered && near(p, 1.6)) out.push({ kind: 'passer', ref: p, d: d(p), label: '發傳單', actions: [['boss-flyer', '📄 發傳單']] });
        if (b.z >= this.H + 0.5) out.push({ kind: 'scooter', d: 2, label: b.ride ? '下車' : '騎機車', actions: [[b.ride ? 'boss-unride' : 'boss-ride', b.ride ? '🛑 下車' : '🛵 騎上機車']] });
        if (this.rival && !this.rival.closed && b.x < -0.3) out.push({ kind: 'rival', d: 1.5, label: `去隔壁「${this.rival.name}」看看`, actions: [['boss-rival', '🕵️ 進去探班']] });
      }
      if (this.bossAtEdge) out.push({ kind: 'city', d: -0.5, label: '出門', actions: [['boss-city', '🗺️ 打開地圖']] });
      return out.sort((a, c) => a.d - c.d);
    }

    bossTakeLane(lane) {
      const b = this.boss;
      if (lane.staff) return false;
      b.x = lane.staffSpot.x;
      b.z = lane.staffSpot.z;
      lane.staff = b;
      b.lane = lane;
      b.task = { type: 'serve', lane, obj: this.stations.find((o) => o.lanes.includes(lane)) };
      this.refreshQueue(b.task.obj);
      return true;
    }

    bossLeaveLane() {
      const b = this.boss;
      if (b.lane && b.lane.staff === b) b.lane.staff = null;
      const o = b.task && b.task.obj;
      b.lane = null;
      b.task = null;
      if (o) this.refreshQueue(o);
    }

    bossMop(spot) {
      const b = this.boss;
      for (const d of [...this.dirt]) if (Math.hypot(d.x - b.x, d.z - b.z) <= 1.1 && !d.by) this.dirt = this.dirt.filter((x) => x !== d);
      b.mopUntil = this.minute + 3;
      b.energy = clamp(b.energy - 1, 0, 100);
      this.popup(b, '✨', 'good');
      // 員工看到老闆自己拖地
      for (const e of this.staff) if (e.state === 'working' && Math.hypot(e.x - b.x, e.z - b.z) < 3 && this.rng() < 0.4) this.say(e, '老闆自己在拖地耶……', 30);
    }

    bossFlyer(p) {
      p.flyered = true;
      const yes = this.rng() < 0.3 + (this.rating - 3) * 0.1 + (this.promoOn ? 0.15 : 0);
      const say = yes ? Fun.FLYER_YES : Fun.FLYER_NO;
      this.popups.push({ id: uid++, x: p.x, z: p.z, text: say[Math.floor(this.rng() * say.length)], kind: yes ? 'good' : 'muted', t: -1 });
      if (yes && this.isOpen) {
        const before = this.customers.length;
        this.spawnCustomer();
        const c = this.customers[before];
        if (c) {
          c.x = Math.round(p.x);
          c.z = this.H;
          c.look = p.look;
          this.walkTo(c, { x: this.doorX, z: this.H - 1 });
        }
        p.gone = true;
      }
      return yes;
    }

    bossGreet(c) {
      c.patience += 4;
      c.waited = Math.max(0, c.waited - 2);
      this.popup(c, '😊', 'good');
      this.say(this.boss, ['歡迎光臨！', '今天吃什麼？', '慢慢來不急喔'][Math.floor(this.rng() * 3)], 15);
    }

    bossGift(c) {
      if (this.cash < 30 || c.gifted) return false;
      c.gifted = true;
      this.cash -= 30;
      this.ledger.other -= 30;
      c.patience += 8;
      this.popup(c, '🎁😍', 'good');
      return true;
    }

    // 出門：老闆離開一段時間，回來時結算
    goOut(placeId) {
      const pl = (Fun.PLACES || []).find((p) => p.id === placeId);
      const b = this.boss;
      if (!pl || b.away || this.cash < pl.cost) return false;
      this.bossLeaveLane();
      this.cash -= pl.cost;
      this.ledger.other -= pl.cost;
      b.away = { id: pl.id, until: this.minute + pl.minutes };
      b.ride = false;
      this.notify(`${pl.icon} 老闆出門去${pl.name}了（約 ${pl.minutes} 分鐘）`);
      return true;
    }

    finishTrip() {
      const b = this.boss;
      if (b.away.kind === 'scheme') return this.resolveScheme();
      if (b.away.kind === 'collab') return this.resolveCollab();
      const pl = (Fun.PLACES || []).find((p) => p.id === b.away.id);
      b.away = null;
      const pick = (arr) => arr[Math.floor(this.rng() * arr.length)];
      const r = { place: pl, lines: [], chips: [] };
      if (pl.lines.length) r.lines.push(pick(pl.lines));
      if (pl.id === 'market') {
        b.energy = clamp(b.energy + 30, 0, 100);
        const n = this.staff.filter((e) => e.state === 'working' || e.state === 'break').length;
        const snack = n * 80;
        if (n && this.cash >= snack) {
          this.cash -= snack;
          this.ledger.welfare += snack;
          for (const e of this.staff) if (e.state === 'working' || e.state === 'break') e.mood = clamp(e.mood + 6, 0, 100);
          r.lines.push(`你幫在班上的 ${n} 個人帶了鹽酥雞和珍奶（${'$' + snack}），大家歡呼！`);
          r.chips.push('😊 員工心情 +6');
        }
        r.chips.push('⚡ 老闆體力 +30');
      } else if (pl.id === 'wholesale') {
        let cost = 0;
        for (const g of this.ind.stock || []) {
          const need = Math.max(0, this.par[g.id] - this.stock[g.id]);
          if (!need) continue;
          cost += need * this.unitCost(g) * 0.85;
          this.stock[g.id] += need;
        }
        cost = Math.round(cost);
        this.cash -= cost;
        this.ledger.materials += cost;
        b.energy = clamp(b.energy - 15, 0, 100);
        r.lines.push(cost ? `所有食材都補滿了，花了 $${cost.toLocaleString()}（比平常便宜一成五）。` : '倉庫本來就是滿的，你逛了一圈什麼都沒買。');
        r.chips.push('📦 庫存補滿');
      } else if (pl.id === 'temple') {
        const throws = [0, 1, 2].map(() => {
          const x = this.rng();
          return x < 0.5 ? 'holy' : x < 0.75 ? 'laugh' : 'no';
        });
        r.jiaobei = throws;
        const holy = throws.filter((t) => t === 'holy').length;
        if (holy >= 3) {
          this.demandMods.push({ mult: 1.15, days: 5 });
          r.lines.push('連續三個聖筊！廟公都跑過來看，說你「這陣子生意會很好」。');
          r.chips.push('🍀 這幾天客人 +15%');
        } else if (holy >= 1) {
          this.demandMods.push({ mult: 1.05, days: 3 });
          r.lines.push(`擲了 ${holy} 個聖筊，神明說「還可以，繼續努力」。`);
          r.chips.push('🍀 這幾天客人 +5%');
        } else {
          r.lines.push('一個聖筊都沒有……旁邊的阿嬤拍拍你的肩膀說：「下次問清楚一點」。');
        }
        if (throws.includes('laugh')) r.lines.push('其中有一次是笑筊，廟公說神明覺得你問的問題很好笑。');
      } else if (pl.id === 'club') {
        b.energy = clamp(b.energy - 40, 0, 100);
        b.mood = clamp(b.mood + 20, 0, 100);
        const f = 300 + Math.round(this.rng() * 900);
        this.social.followers += f;
        r.chips.push(`📱 粉絲 +${f}`, '⚡ 老闆體力 -40');
        if (this.rng() < 0.3) {
          r.lines.push('隔天早上你睡過頭，員工打了十通電話。');
          b.energy = Math.min(b.energy, 20);
        }
      } else if (pl.id === 'gym') {
        b.fit = Math.min(5, b.fit + 1);
        b.energy = clamp(b.energy - 10, 0, 100);
        r.chips.push(`💪 老闆體能 ${b.fit}/5（顧店比較不容易累）`);
      } else if (pl.id === 'bank') {
        r.lines.push(`目前借款 $${this.loan.toLocaleString()}，月息 2%，上限 $600,000。`);
      }
      this.sound('level');
      if (this.cb.tripDone) this.cb.tripDone(r);
      return r;
    }

    // ───── 走進去的小場景（夜市、廟、夜店、批發市場、隔壁對手）─────
    // 老闆在場景裡時店照常營業；boss.away.scene 為 true，不會自動回來
    enterPlace(id) {
      const b = this.boss;
      if (b.away) return false;
      if (id === 'rival' && (!this.rival || this.rival.closed)) return false;
      const fee = id === 'club' ? 500 : 0;
      if (this.cash < fee) return false;
      this.bossLeaveLane();
      if (fee) {
        this.cash -= fee;
        this.ledger.other -= fee;
      }
      b.away = { id, scene: true, until: Infinity, did: {}, holy: 0, throws: 0, lines: [], chips: [], spent: fee };
      b.ride = false;
      return true;
    }

    placeAction(id) {
      const b = this.boss;
      const A = b.away;
      if (!A || !A.scene) return null;
      const pick = (arr) => arr[Math.floor(this.rng() * arr.length)];
      const r = { text: '', chips: [] };
      const pay = (n) => {
        if (this.cash < n) return false;
        this.cash -= n;
        this.ledger.other -= n;
        A.spent += n;
        return true;
      };
      const once = (k) => {
        if (A.did[k]) return false;
        A.did[k] = true;
        return true;
      };
      const energy = (n, show = true) => {
        b.energy = clamp(b.energy + n, 0, 100);
        if (show) r.chips.push(`⚡ 體力 ${n > 0 ? '+' : ''}${n}`);
      };
      const fans = (n) => {
        this.social.followers += n;
        r.chips.push(`📱 粉絲 +${n}`);
      };
      const broke = () => ({ text: '錢包空空的……先回店裡賺一點吧。', chips: [], fail: true });
      const done = (t) => ({ text: t, chips: [], fail: true });
      const working = () => this.staff.filter((e) => e.state === 'working' || e.state === 'break');
      if (id.startsWith('buy:')) {
        const g = (this.ind.stock || []).find((x) => x.id === id.slice(4));
        if (!g) return null;
        const need = Math.max(0, this.par[g.id] - this.stock[g.id]);
        if (!need) return done(`${g.name}倉庫還是滿的，阿伯說：「買那麼多要放哪？」`);
        const cost = Math.round(need * this.unitCost(g) * (A.did.haggle === 'ok' ? 0.8 : 0.85));
        if (this.cash < cost) return broke();
        this.cash -= cost;
        this.ledger.materials += cost;
        A.spent += cost;
        this.stock[g.id] += need;
        energy(-4, false);
        r.text = `${g.icon} ${g.name}補了 ${need} 份，花 $${cost.toLocaleString()}（${A.did.haggle === 'ok' ? '八折' : '八五折'}）。你扛著箱子，腰發出了奇怪的聲音。`;
        r.chips.push(`📦 ${g.name}補滿`);
        A.did[id] = true;
      } else
        switch (id) {
          // 夜市
          case 'chicken':
            if (!pay(80)) return broke();
            r.text = pick(['雞排比你的臉還大，老闆問要不要切、要不要辣，你說「都要」。', '排了十五分鐘，前面的人一次買了二十片。', '咬下去的瞬間，你懂了為什麼大家願意排隊。']);
            energy(12);
            break;
          case 'stinky':
            if (!pay(70)) return broke();
            r.text = pick(['你點了大辣，辣到在路邊跳了三分鐘。', '泡菜多到要滿出來，老闆說「少年仔多吃一點」。', '臭味一路跟著你，路人自動讓出一條路。']);
            energy(10);
            break;
          case 'boba': {
            const n = working().length;
            const cost = Math.max(1, n) * 60;
            if (!once('boba')) return done('你手上已經提了一大袋飲料，再買就拿不動了。');
            if (!pay(cost)) {
              A.did.boba = false;
              return broke();
            }
            for (const e of working()) e.mood = clamp(e.mood + 6, 0, 100);
            this.ledger.other += cost;
            this.ledger.welfare += cost;
            r.text = n ? `你幫在班上的 ${n} 個人各買了一杯珍奶（$${cost}），LINE 群組瞬間被貼圖洗版。` : '店裡沒人在班，你自己喝了一杯全糖去冰。';
            if (n) r.chips.push('😊 在班員工心情 +6');
            break;
          }
          case 'fortune':
            if (!once('fortune')) return done('算命阿姨揮揮手：「天機不可洩漏兩次。」');
            if (!pay(200)) {
              A.did.fortune = false;
              return broke();
            }
            r.text = `算命阿姨看了你的手相：「${pick(['你今年犯小人，但是員工都是你的貴人', '三天之內，會有一個很奧的客人……但你會贏', '你的財庫在店門口，記得把騎樓掃乾淨', '你上輩子是開早餐店的，這輩子還是', '你的員工如果離職，是因為你太常講幹話'])}。」`;
            this.demandMods.push({ mult: 1.03, days: 3 });
            r.chips.push('🔮 這幾天客人 +3%');
            break;
          case 'balloon':
            if (!pay(100)) return broke();
            if (this.rng() < 0.5) {
              r.text = '連中十發！老闆娘大喊「夜市神槍手」，旁邊的人開始拍你。';
              fans(100);
            } else r.text = pick(['十發只中兩發，老闆娘安慰你：「氣球今天比較皮。」', '你打中了老闆娘的招牌，大家一起裝沒事。']);
            break;
          case 'ring':
            if (!pay(100)) return broke();
            if (this.rng() < 0.3) {
              r.text = '套中了一隻巨大的熊！你抱著牠走完整條夜市。';
              b.mood = clamp(b.mood + 10, 0, 100);
              r.chips.push('😄 老闆心情 +10');
            } else r.text = pick(['套到一個鑰匙圈。花了一百塊。', '圈圈彈了三下，掉在獎品旁邊。老闆說「差一點！」（每次都差一點）']);
            break;
          case 'fan':
            if (!once('fan')) return done('熟客已經去排雞排了。');
            r.text = pick(['「你是那間店的老闆嗎？我每天都去欸！」她拉著你自拍，還打卡了。', '「老闆！上次那個工讀生超可愛，記得幫他加薪喔！」她拍了一張合照上傳。']);
            fans(80);
            break;
          // 廟
          case 'incense':
            if (!once('incense')) return done('香已經插好了，神明說「收到」。');
            b.mood = clamp(b.mood + 5, 0, 100);
            r.text = '你拿著香跟神明報告：店名、地址、最近營收、還有一個很難搞的員工……說了快五分鐘。';
            r.chips.push('😌 老闆心情 +5');
            break;
          case 'jiao': {
            if (A.throws >= 3) return done('今天已經擲三次了，廟公說：「神明也要休息。」');
            A.throws++;
            const x = this.rng();
            const t = x < 0.5 ? 'holy' : x < 0.75 ? 'laugh' : 'no';
            if (t === 'holy') A.holy++;
            (A.jiaos = A.jiaos || []).push(t);
            r.jiao = t;
            r.text = { holy: '🌗 聖筊！一正一反，神明說「可以」。', laugh: '🌕 笑筊……兩個都朝上，神明在笑你。', no: '🌑 陰筊，兩個都朝下，神明說「不行喔」。' }[t] + `（第 ${A.throws}/3 次，聖筊 ${A.holy} 個）`;
            if (A.throws === 3) r.text += A.holy >= 3 ? ' 連續三個聖筊！廟公跑過來看：「這陣子生意會很好喔！」' : '';
            break;
          }
          case 'lots':
            if (!once('lots')) return done('一天抽一支就好，抽到不喜歡的不能重抽。');
            r.text = `你抽到第 ${1 + Math.floor(this.rng() * 60)} 籤：「${pick(['上上籤・財源廣進，但要對員工好一點', '中籤・客人如流水，來來去去，莫強求', '下下籤・注意排班，有人想離職', '上籤・貴人在隔壁，不要跟他吵架', '中上籤・宜發文，忌回酸民'])}」`;
            break;
          case 'donate':
            if (!once('donate')) return done('香油錢箱已經被你餵飽了。');
            if (!pay(200)) {
              A.did.donate = false;
              return broke();
            }
            this.demandMods.push({ mult: 1.03, days: 3 });
            r.text = '你投了 $200 香油錢，旁邊的阿嬤點頭說：「少年仔有誠意。」';
            r.chips.push('🍀 這幾天客人 +3%');
            break;
          case 'keeper':
            r.text = `廟公：「${pick(['做生意喔，第一要有良心，第二要有人手，第三要有冷氣。', '你們那條街以前是田啦，我小時候在那邊抓青蛙。', '你知道為什麼土地公生意這麼好嗎？因為祂從來不罵員工。', '擲筊要問清楚一點，不要問「會不會賺錢」，要問「下個月」。', '你隔壁那家老闆也常來，他都求你倒店。'])}」`;
            break;
          // 夜店
          case 'dance':
            if (b.energy < 15) return done('你已經跳不動了，腳在發抖。');
            energy(-15);
            r.dance = true;
            r.text = pick(['你跳了一段二十年前的舞步，全場愣了三秒，然後開始尖叫。', '你在舞池中間轉圈圈，被當成來表演的。', 'DJ 播了一首洗腦神曲，你和一群陌生人一起跳了整首。']);
            fans(200 + Math.round(this.rng() * 400));
            break;
          case 'bar':
            if (!pay(300)) return broke();
            b.mood = clamp(b.mood + 10, 0, 100);
            energy(-5, false);
            r.text = pick(['酒保問你喝什麼，你說「有沒有無糖綠」。他給了你一杯特調。', '你跟隔壁的上班族聊了半小時，他說他老闆比你還慣。', '你點了一杯叫「慣老闆」的調酒，喝起來很苦。']);
            r.chips.push('😄 老闆心情 +10');
            break;
          case 'dj':
            if (!once('dj')) return done('DJ 對你比讚：「你的歌已經排進去了！」');
            if (!pay(200)) {
              A.did.dj = false;
              return broke();
            }
            r.text = `你點了店裡的主題曲，DJ 還幫你喊：「這首歌送給${this.shopName}！」`;
            fans(100);
            break;
          case 'students':
            if (!once('students')) return done('大學生們已經去續攤了。');
            {
              const c = this.makeCandidate('cheerful');
              if (!c.traits.includes('rookie')) c.traits.push('rookie');
              c.skill = Math.min(c.skill, 25);
              this.candidates.unshift(c);
              r.text = `一個叫「${c.name}」的大學生說：「老闆你人好好，我可以去你那邊打工嗎？」他明天會來面試。`;
              r.chips.push(`🎓 應徵名單 +1（${c.name}）`);
            }
            break;
          case 'rivalboss':
            if (!this.rival || this.rival.closed) return done('隔壁老闆已經回家了。');
            if (!once('rivalboss')) return done('他已經醉倒在吧台上了。');
            if (!pay(300)) {
              A.did.rivalboss = false;
              return broke();
            }
            this.rival.grudge = Math.max(0, (this.rival.grudge || 0) - 1);
            r.text = `你請「${this.rival.name}」的老闆喝了一杯。他嘆氣說：「其實我們這行都很辛苦。」你們乾了。`;
            r.chips.push('🕊️ 對手記仇 -1');
            break;
          // 批發市場
          case 'haggle':
            if (A.did.haggle) return done(A.did.haggle === 'ok' ? '阿伯：「已經算你八折了啦，再殺我要回家吃自己了。」' : '阿伯轉過身去，假裝在算帳。');
            A.did.haggle = this.rng() < 0.6 ? 'ok' : 'no';
            r.text = A.did.haggle === 'ok' ? '阿伯：「少年仔，你殺價殺得比我還狠……好啦，今天全部算你八折！」' : '阿伯：「這已經是最低價了，我孫子的奶粉錢都在裡面了。」';
            if (A.did.haggle === 'ok') r.chips.push('💰 今天進貨打八折');
            break;
          // 隔壁對手
          case 'taste': {
            if (!once('taste')) return done('你已經吃飽了，再點會被認出來。');
            const v = this.visitRival();
            if (!v) return done('隔壁已經收起來了。');
            pay(Math.min(this.cash, 100));
            r.text = v.lines.join(' ');
            break;
          }
          case 'peek':
          case 'talk':
          case 'flyer': {
            const sc = (Fun.SCHEMES || []).find((x) => x.id === { peek: 'spy', talk: 'poach', flyer: 'flyers_door' }[id]);
            if (!sc) return null;
            if (!once(id)) return done('今天已經做過了，再來會被認出來。');
            if (!pay(sc.cost)) {
              A.did[id] = false;
              return broke();
            }
            const out = this.runScheme(sc);
            r.text = out.lines.join(' ');
            r.chips.push(...out.chips);
            r.outcome = out.outcome;
            break;
          }
          default:
            return null;
        }
      A.lines.push(r.text);
      A.chips.push(...r.chips);
      return r;
    }

    // 走出口回店裡：結算擲筊的結果，回傳這趟的總結
    leavePlace() {
      const b = this.boss;
      const A = b.away;
      if (!A || !A.scene) return null;
      b.away = null;
      const names = { market: ['🏮', '夜市'], temple: ['🙏', '廟裡'], club: ['🪩', '夜店'], wholesale: ['📦', '批發市場'], rival: ['🏪', this.rival ? this.rival.name : '隔壁'] };
      const [icon, name] = names[A.id] || ['🚶', '外面'];
      const r = { place: { icon, name }, lines: [], chips: [] };
      if (A.id === 'temple' && A.throws) {
        if (A.holy >= 3) {
          this.demandMods.push({ mult: 1.15, days: 5 });
          r.chips.push('🍀 三個聖筊：這幾天客人 +15%');
        } else if (A.holy >= 1) {
          this.demandMods.push({ mult: 1.05, days: 3 });
          r.chips.push(`🍀 ${A.holy} 個聖筊：這幾天客人 +5%`);
        }
      }
      if (A.jiaos) r.jiaobei = A.jiaos;
      const n = A.lines.length;
      if (!n) r.lines.push('你逛了一圈，什麼都沒做就回來了。');
      else r.lines.push(...A.lines.slice(-4));
      const merged = {};
      for (const c of A.chips) {
        const m = c.match(/^(.+?) ([+-])(\d+)$/);
        if (m) merged[m[1]] = (merged[m[1]] || 0) + Number(m[2] + m[3]);
        else if (!r.chips.includes(c)) r.chips.push(c);
      }
      for (const [k, v] of Object.entries(merged)) r.chips.push(`${k} ${v >= 0 ? '+' : ''}${v}`);
      if (A.spent) r.chips.push(`💸 這趟花了 $${A.spent.toLocaleString()}`);
      if (b.state === 'working') {
        b.x = this.doorX;
        b.z = this.H - 1;
        b.path = [];
      }
      this.sound('level');
      return r;
    }

    // ───── 陰謀計畫 ─────
    schemeOdds(sc) {
      const g = (this.rival && this.rival.grudge) || 0;
      return { p: clamp(sc.p + this.level * 0.01 + this.boss.fit * 0.01, 0.05, 0.95), risk: clamp(sc.risk * (1 + g * 0.08), 0, 0.9) };
    }

    startScheme(id) {
      const sc = (Fun.SCHEMES || []).find((x) => x.id === id);
      const b = this.boss;
      if (!sc || !this.rival || this.rival.closed || b.away || this.cash < sc.cost) return false;
      this.bossLeaveLane();
      this.cash -= sc.cost;
      this.ledger.other -= sc.cost;
      b.away = { kind: 'scheme', id, until: this.minute + sc.minutes };
      b.ride = false;
      this.notify(`${sc.icon} 老闆出門去執行計畫：${sc.name}（約 ${sc.minutes} 分鐘）`);
      return true;
    }

    applyPlotFx(fx, r) {
      if (!fx) return;
      if (fx.followers) {
        this.social.followers += fx.followers;
        r.chips.push(`📱 粉絲 +${fx.followers}`);
      }
      if (fx.review) this.addReview(fx.review[0], fx.review[1]);
      if (fx.grudge && this.rival) this.rival.grudge = (this.rival.grudge || 0) + fx.grudge;
      if (fx.cash) {
        this.cash += fx.cash;
        this.ledger.fines -= fx.cash;
        r.chips.push(`💸 ${fx.cash < 0 ? '-' : '+'}$${Math.abs(fx.cash).toLocaleString()}`);
      }
      if (fx.demand) {
        this.demandMods.push({ mult: fx.demand, days: 10 });
        r.chips.push(`📉 這幾天客人 ${Math.round((fx.demand - 1) * 100)}%`);
      }
      if (fx.hireVeteran) {
        const e = this.addEmployee(this.makeCandidate('veteran'));
        r.chips.push(`👋 ${e.name}（老手）加入了`);
      }
      if (fx.copyDish) {
        this.copiedDish = true;
        r.chips.push('🍳 招牌變好吃了（客人 +4%）');
      }
      if (fx.rivalBoost && this.rival) this.rival.strength = clamp(this.rival.strength + fx.rivalBoost, 0, 1);
      if (fx.inspectSoon && this.isOpen) this.hygiene.at = this.minute + 120;
    }

    resolveScheme() {
      const b = this.boss;
      const sc = Fun.SCHEMES.find((x) => x.id === b.away.id);
      b.away = null;
      const r = this.runScheme(sc);
      if (this.cb.tripDone) this.cb.tripDone(r);
      return r;
    }

    // 計畫的結果（出門執行或在對手店裡當場做都用這個）
    runScheme(sc) {
      const r = { place: { icon: sc.icon, name: sc.name }, lines: [], chips: [], legal: sc.legal, tip: sc.tip };
      const rival = this.rival;
      if (!rival || rival.closed) {
        r.lines.push('你到了才發現隔壁已經收起來了，白跑一趟。');
        return r;
      }
      const { p, risk } = this.schemeOdds(sc);
      const ok = this.rng() < p;
      const caught = this.rng() < risk;
      this.schemes++;
      if (ok) {
        const before = rival.strength;
        rival.strength = clamp(rival.strength - sc.hit, 0, 1);
        r.lines.push(sc.win.text);
        this.applyPlotFx(sc.win.fx, r);
        r.chips.push(`🏪 對手搶走的客人 ${Math.round(before * 22)}% → ${Math.round(rival.strength * 22)}%`);
        r.outcome = 'win';
      } else {
        r.lines.push(sc.lose.text);
        this.applyPlotFx(sc.lose.fx, r);
        r.outcome = 'lose';
      }
      if (caught) {
        r.lines.push(`……但是被抓包了：${sc.caught.text}`);
        this.applyPlotFx(sc.caught.fx, r);
        r.outcome = ok ? 'win-caught' : 'caught';
      }
      if (sc.legal === 'illegal') rival.grudge = (rival.grudge || 0) + 1;
      if (this.schemes >= 3) this.achieve('schemer');
      this.sound(caught ? 'bad' : ok ? 'level' : 'click');
      return r;
    }

    // 被記仇的對手會報復
    revengeEvent(item) {
      const rv = this.rival;
      return {
        id: 'rival_revenge',
        icon: '😤',
        title: `隔壁的「${rv.name}」報復了`,
        text: item.text,
        where: 'phone',
        speaker: { look: 'rivalboss', name: `${rv.name}老闆` },
        choices: [
          { label: '算了，做好自己的', effects: { grudge: -1 }, result: '你深呼吸，決定不跟他一般見識。員工說你很有風度。' },
          { label: '帶一盒伴手禮過去談和', effects: { cash: -2000, grudge: -3 }, result: '對面老闆收下伴手禮，嘆了口氣：「其實大家都不容易。」' },
          { label: '「好，你給我記住」', quote: '這筆帳我記下了。', effects: { grudge: 1 }, result: '你們在騎樓互瞪了三分鐘。這條街的戰爭還沒結束。（可以到城市地圖的「🕵️ 徵信社」安排下一步）' },
        ],
        ignore: { effects: {}, result: '你沒有理他。' },
      };
    }

    applyRevenge(item) {
      const fx = item.fx;
      if (fx.demand) this.demandMods.push({ mult: fx.demand, days: 5 });
      if (fx.reviews) for (let i = 0; i < fx.reviews; i++) this.addReview(1, ['普普', '不用排', '隔壁比較好', '價格偏高'][i % 4]);
      if (fx.cost) this.costMult.materials += fx.cost;
      if (fx.followers) this.social.followers += fx.followers;
    }

    // ───── 聯名合作 ─────
    collabReady(pt) {
      if (pt.need && pt.need.level && this.level < pt.need.level) return `店家 Lv.${pt.need.level} 才能合作`;
      if (pt.rival) {
        if (!this.rival || this.rival.closed) return '隔壁沒有對手';
        if ((this.rival.grudge || 0) >= 5) return '對方還在記仇，先去談和吧';
      }
      if (this.collabs.some((c) => c.id === pt.id)) return '正在合作中';
      return null;
    }

    startCollab(id) {
      const pt = (Fun.PARTNERS || []).find((x) => x.id === id);
      const b = this.boss;
      if (!pt || b.away || this.cash < pt.cost || this.collabReady(pt)) return false;
      this.bossLeaveLane();
      this.cash -= pt.cost;
      this.ledger.other -= pt.cost;
      b.away = { kind: 'collab', id, until: this.minute + pt.minutes };
      b.ride = false;
      this.notify(`🤝 老闆出門去找${pt.name}談合作（約 ${pt.minutes} 分鐘）`);
      return true;
    }

    resolveCollab() {
      const b = this.boss;
      const pt = Fun.PARTNERS.find((x) => x.id === b.away.id);
      b.away = null;
      const r = { place: { icon: pt.icon, name: `${this.shopName} × ${pt.name}` }, lines: [], chips: [] };
      const chance = pt.rival ? clamp(0.65 - ((this.rival && this.rival.grudge) || 0) * 0.1 + (this.rating - 3.5) * 0.1, 0.1, 0.9) : clamp(0.8 + (this.rating - 3.5) * 0.1, 0.4, 0.97);
      if (this.rng() < chance) {
        const pick = [...pt.lines].sort(() => this.rng() - 0.5).slice(0, 2);
        r.lines.push(`談成了！「${pt.collab}」上線，為期 ${pt.days} 天。`, ...pick);
        this.collabs.push({ id: pt.id, name: pt.name, icon: pt.icon, collab: pt.collab, until: this.day + pt.days, mult: pt.mult, types: pt.types });
        this.social.followers += pt.followers;
        r.chips.push(`📈 客人 +${Math.round((pt.mult - 1) * 100)}%（${pt.days} 天）`, `📱 粉絲 +${pt.followers}`);
        if (pt.rival && this.rival) {
          this.rival.truceUntil = this.day + pt.days;
          this.rival.grudge = 0;
          r.chips.push('🕊️ 休戰期間對手不搶客人');
        }
        if (this.collabs.length >= 1) this.achieve('collab');
        r.outcome = 'win';
        this.sound('level');
      } else {
        const refund = Math.round(pt.cost * 0.5);
        this.cash += refund;
        this.ledger.other += refund;
        r.lines.push(
          pt.rival
            ? '對面老闆聽完你的提議，冷冷地說：「你先把上次的帳算清楚再說。」'
            : ['對方老闆說要回去考慮，結果已讀不回。', '談到一半才發現對方把你的店名寫錯了，合作延期。', '對方覺得你們的風格不太搭，客氣地拒絕了。'][Math.floor(this.rng() * 3)],
          `退回一半的費用 $${refund.toLocaleString()}。`
        );
        r.outcome = 'lose';
      }
      if (this.cb.tripDone) this.cb.tripDone(r);
      return r;
    }

    get collabMult() {
      return this.collabs.reduce((m, c) => m * c.mult, 1);
    }

    // 去隔壁對手店探班
    visitRival() {
      const r = this.rival;
      if (!r || r.closed) return null;
      const lines = [
        `你點了一杯他們的招牌，味道……${r.quality > 0.55 ? '老實說還不錯，難怪有人排隊' : '普普，你偷偷鬆了一口氣'}。`,
        r.strength > 0.5 ? '店裡坐滿了人，你看到你的常客也在裡面，對方尷尬地跟你揮手。' : '店裡冷冷清清，店員在滑手機。',
        `他們的價格大概是你的 ${r.quality > 0.55 ? '一點一倍' : '九成'}。`,
      ];
      this.boss.energy = clamp(this.boss.energy - 3, 0, 100);
      return { name: r.name, strength: r.strength, lines };
    }

    // ───── 員工活動 ─────
    activityCost(a, n) {
      return Math.round((a.cost * (n + 1) * this.idx.cpi) / 10) * 10;
    }

    activityAvailable(a) {
      return !a.months || a.months.includes(this.monthOfYear);
    }

    // 舉辦活動：參加的人心情、交情、精力都會變；還會發生一些插曲
    holdActivity(id, ids) {
      const a = (Fun.ACTIVITIES || []).find((x) => x.id === id);
      if (!a || !this.activityAvailable(a) || this.lastActivity === this.day) return null;
      const people = this.staff.filter((e) => ids.includes(e.id));
      if (!people.length) return null;
      const cost = this.activityCost(a, people.length);
      if (this.cash < cost) return null;
      this.cash -= cost;
      this.ledger.welfare += cost;
      this.lastActivity = this.day;
      const changes = [];
      for (const e of people) {
        const like = e.traits.some((t) => a.likes.includes(t)) ? 1.5 : e.traits.some((t) => a.dislikes.includes(t)) ? 0.35 : 1;
        let d = a.forced ? a.mood : a.mood * like * (0.8 + this.rng() * 0.4);
        if (!a.forced && e.energy < 25 && a.energy < 0) d *= 0.6; // 太累的人玩不起來
        const before = e.mood;
        e.mood = clamp(e.mood + d, 0, 100);
        e.energy = clamp(e.energy + a.energy, 0, 100);
        if (a.hangover && this.rng() < a.hangover * (e.traits.includes('nightowl') ? 0.5 : 1)) e.hangoverDay = this.day + 1;
        changes.push({ id: e.id, name: e.name, d: Math.round(e.mood - before), like: like > 1 ? 'like' : like < 1 ? 'dislike' : '' });
        if (like > 1 && !a.forced) this.say(e, ['好好玩！', '老闆萬歲！', '下次還要！'][Math.floor(this.rng() * 3)], 60);
        if (like < 1 && !a.forced) this.say(e, '……其實我比較想回家睡覺', 60);
        if (a.forced) this.say(e, '下班時間耶……', 60);
      }
      // 一起玩過的人交情變好（本來處不來的人改善最多）
      for (let i = 0; i < people.length; i++) {
        for (let j = i + 1; j < people.length; j++) {
          const cur = this.relOf(people[i], people[j]);
          this.addRel(people[i], people[j], a.rel * (0.6 + this.rng() * 0.8) * (cur < -20 && a.rel > 0 ? 1.5 : 1));
        }
      }
      if (a.forced) {
        this.jerk = clamp(this.jerk + a.jerk, 0, JERK_LIMIT);
        this.flags.add('unpaidOT');
      } else this.jerk = clamp(this.jerk - 0.5, 0, JERK_LIMIT);
      // 插曲
      const pick = (arr) => arr[Math.floor(this.rng() * arr.length)];
      const pool = [...a.lines].sort(() => this.rng() - 0.5).slice(0, Math.min(3, a.lines.length));
      const lines = [];
      for (const ln of pool) {
        const pa = pick(people);
        const others = people.filter((x) => x !== pa);
        const pb = others.length ? pick(others) : pa;
        if (ln.text.includes('{b}') && pa === pb) continue;
        lines.push(ln.text.replace(/\{a\}/g, pa.name).replace(/\{b\}/g, pb.name));
        if (ln.fx === 'rel') this.addRel(pa, pb, 15);
        if (ln.fx === 'mood') pa.mood = clamp(pa.mood + 5, 0, 100);
        if (ln.fx === 'hangover') pa.hangoverDay = this.day + 1;
        if (ln.fx === 'sick') {
          pa.hangoverDay = this.day + 1;
          pa.sickDay = this.day + 1;
        }
        if (ln.fx === 'followers') this.social.followers += 150 + Math.round(this.rng() * 300);
        if (ln.fx === 'leak') {
          this.jerk = clamp(this.jerk + 3, 0, JERK_LIMIT);
          this.addReview(1, '聽說這間店下班還要上心靈成長課');
        }
      }
      this.sound(a.forced ? 'bad' : 'level');
      return { activity: a, cost, lines, changes };
    }

    // ───── 跟員工的個人互動 ─────
    chat(e) {
      if (e.chatDay === this.day) return null;
      e.chatDay = this.day;
      const C = Fun.CHAT || { random: ['……'] };
      const pick = (arr) => arr[Math.floor(this.rng() * arr.length)];
      const friend = this.staff.find((o) => o !== e && this.relOf(e, o) >= 40);
      const rival = this.staff.find((o) => o !== e && this.relOf(e, o) <= -30);
      const pool = [];
      if (e.energy < 40) pool.push(...C.tired);
      if (e.wage < this.marketWage) pool.push(...C.poor);
      if (this.restCount(e) < 2) pool.push(...C.norest);
      if (rival) pool.push(...C.rival.map((t) => t.replace('{r}', rival.name)));
      if (friend) pool.push(...C.friend.map((t) => t.replace('{f}', friend.name)));
      if (e.mood > 70) pool.push(...C.happy);
      if (!pool.length || this.rng() < 0.4) pool.push(...C.random);
      const text = pick(pool);
      e.mood = clamp(e.mood + 4, 0, 100);
      this.say(e, text, 90);
      return text;
    }

    treat(e) {
      if (e.treatDay === this.day || this.cash < 65) return false;
      e.treatDay = this.day;
      this.cash -= 65;
      this.ledger.welfare += 65;
      e.mood = clamp(e.mood + 5, 0, 100);
      e.hunger = clamp(e.hunger + 25, 0, 100);
      e.energy = clamp(e.energy + 5, 0, 100);
      this.say(e, ['謝謝老闆的飲料！', '半糖少冰，老闆記得我的口味！', '續命成功'][Math.floor(this.rng() * 3)], 60);
      return true;
    }

    // 送去上課：每週一次，技能大幅提升
    get trainCost() {
      return 3000;
    }

    train(e) {
      if (e.trainWeek === this.week || this.cash < this.trainCost || e.skill >= 100) return false;
      e.trainWeek = this.week;
      this.cash -= this.trainCost;
      this.ledger.welfare += this.trainCost;
      e.skill = clamp(e.skill + 10 * (e.traits.includes('rookie') ? 1.5 : 1), 0, 100);
      e.energy = clamp(e.energy - 15, 0, 100);
      e.mood = clamp(e.mood + 3, 0, 100);
      this.say(e, '上完課覺得自己變強了！', 90);
      return true;
    }

    // ───── 升遷與主管 ─────
    // 領導力、企圖心、管理風格：一開始就決定好，但風格要升上去才知道
    ensureCareer(e) {
      if (e.lead == null) {
        let lead = 20 + this.rng() * 60;
        if (e.traits.includes('veteran')) lead += 10;
        if (e.traits.includes('chatty')) lead += 8;
        if (e.traits.includes('fragile')) lead -= 12;
        if (e.traits.includes('rookie')) lead -= 6;
        e.lead = Math.round(clamp(lead, 5, 95));
      }
      if (e.ambition == null) {
        let a = this.rng() * 100;
        if (e.traits.includes('hardworking')) a += 12;
        if (e.traits.includes('nightowl')) a -= 5;
        e.ambition = Math.round(clamp(a, 0, 100));
      }
      if (!e.style) {
        const w = { warm: 1, strict: 1, mentor: 0.8, numbers: 0.8, slacker: 0.5 };
        if (e.traits.includes('cheerful')) w.warm += 1.5;
        if (e.traits.includes('chatty')) (w.warm += 0.8), (w.mentor += 0.6);
        if (e.traits.includes('hardworking')) (w.strict += 1.2), (w.numbers += 0.6);
        if (e.traits.includes('veteran')) (w.mentor += 1), (w.strict += 0.5);
        if (e.traits.includes('fragile')) w.strict *= 0.4;
        if (e.ambition < 30) w.slacker += 1;
        if (e.lead > 65) w.slacker *= 0.4;
        let r = this.rng() * Object.values(w).reduce((s, x) => s + x, 0);
        e.style = Object.keys(w).find((k) => (r -= w[k]) < 0) || 'warm';
      }
      // 看起來的領導力（面試、同事印象），跟真正的會差一點
      if (e.leadSeen == null) e.leadSeen = Math.round(clamp(e.lead + (this.rng() - 0.5) * 36, 5, 95));
      if (!e.hint) {
        const keys = Object.keys(Fun.STYLE_HINTS || { warm: 1 });
        const k = this.rng() < 0.7 ? e.style : keys[Math.floor(this.rng() * keys.length)];
        const list = (Fun.STYLE_HINTS || {})[k] || [''];
        e.hint = list[Math.floor(this.rng() * list.length)];
      }
      if (e.rank && e.revealed == null) e.revealed = true;
      if (!e.kpi) e.kpi = { days: 0, served: 0, angry: 0, visitors: 0 };
      return e;
    }

    // 玩家看得到的領導力：升上去三天後才知道真正的數字
    leadKnown(e) {
      return e.revealed ? e.lead : null;
    }

    leaderCap() {
      return Math.max(1, Math.floor(this.staff.length / 3));
    }

    promoteBlock(e, rank) {
      const R = Fun.RANKS || {};
      if (!R[rank] || e.rank === rank) return '已經是了';
      if (rank === 'leader' && e.rank !== 'manager' && this.staff.filter((o) => o.rank === 'leader').length >= this.leaderCap()) return `組長最多 ${this.leaderCap()} 位（每 3 個員工 1 位）`;
      return null;
    }

    // 升職：組長、店長
    promote(e, rank) {
      const R = Fun.RANKS || {};
      if (!e || this.promoteBlock(e, rank)) return false;
      this.ensureCareer(e);
      if (rank === 'manager') for (const o of this.staff) if (o !== e && o.rank === 'manager') o.rank = 'leader';
      const old = e.rank && R[e.rank] ? R[e.rank].wage : 0;
      const first = !e.rank;
      e.rank = rank;
      e.wage += R[rank].wage - old;
      this._fxAt = null;
      e.mood = clamp(e.mood + (e.ambition >= 60 ? 16 : e.ambition < 30 ? 2 : 10), 0, 100);
      if (first) {
        e.rankDay = this.day;
        e.kpi = { days: 0, served: 0, angry: 0, visitors: 0 };
      }
      this.say(e, e.ambition < 30 ? '我……其實沒有很想當主管……' : `我升${R[rank].name}了！`, 120);
      // 年資、技能比他高卻沒被升的人會不爽；空降的更明顯
      const tenure = this.day - e.hiredDay;
      for (const o of this.staff) {
        if (o === e || o.rank) continue;
        const senior = this.day - o.hiredDay > tenure + 7;
        if (o.skill > e.skill + 5 || senior) {
          o.mood = clamp(o.mood - (o.ambition >= 60 ? 9 : 5) - (tenure < 7 ? 4 : 0), 0, 100);
          this.say(o, senior ? `我比${e.name}早來欸……` : `為什麼是${e.name}……`, 90);
        }
      }
      this.notify(`${R[rank].icon} ${e.name} 升為${R[rank].name}！${first ? '試用 14 天，三天後就會知道他是哪一種主管。' : ''}`, 'good');
      return true;
    }

    // 降職：試用期內比較不傷感情
    demote(e) {
      const R = Fun.RANKS || {};
      if (!e || !e.rank) return false;
      const trial = this.inTrial(e);
      e.wage = Math.max(MIN_WAGE, e.wage - (R[e.rank] ? R[e.rank].wage : 0));
      e.rank = null;
      e.mood = clamp(e.mood - (trial ? 6 : 15), 0, 100);
      this._fxAt = null;
      if (!trial) this.jerk = clamp(this.jerk + 1, 0, JERK_LIMIT);
      if (e.ambition >= 60 && !trial) e.lowMoodDays += 1;
      this.say(e, trial ? '好吧，我可能還沒準備好' : '……我做錯什麼了嗎', 120);
      return true;
    }

    inTrial(e) {
      return !!(e.rank && e.rankDay != null && this.day - e.rankDay < 14);
    }

    get leadTrainCost() {
      return Math.round((4000 * this.idx.cpi) / 100) * 100;
    }

    // 主管培訓課：領導力 +8
    leadTrain(e) {
      const cost = this.leadTrainCost;
      if (!e || e.leadTrainWeek === this.week || this.cash < cost || e.lead >= 100) return false;
      this.ensureCareer(e);
      this.cash -= cost;
      this.ledger.welfare += cost;
      e.leadTrainWeek = this.week;
      e.lead = Math.min(100, e.lead + 8);
      e.leadSeen = Math.min(100, e.leadSeen + 8);
      e.energy = clamp(e.energy - 10, 0, 100);
      this.say(e, '主管課教我們要「先處理心情，再處理事情」', 100);
      return true;
    }

    // 在班上的主管加起來的效果（每個 tick 算一次）
    teamFx() {
      if (this._fxAt === this.minute && this._fxDay === this.day) return this._fx;
      const ST = Fun.STYLES || {};
      const fx = { speed: 1, calm: 1, learn: 1, fragile: 0, mood: new Map(), list: [] };
      for (const o of this.staff) {
        if (!o.rank || (o.state !== 'working' && o.state !== 'break')) continue;
        const st = ST[o.style] || {};
        const k = (0.4 + (o.lead ?? 50) / 100) * (o.rank === 'manager' ? 1.5 : 1);
        if (o.rank === 'manager') fx.speed *= 1.04;
        fx.speed *= 1 + (st.speed || 0) * k;
        fx.calm *= 1 - (st.calm || 0) * k;
        fx.learn *= 1 + ((st.learn || 1) - 1) * k;
        fx.fragile += (st.fragile || 0) * k;
        // 基本加成：店長 +3、組長 +2；風格再加減；領導力太低的人帶起來大家都很累
        let m = (o.rank === 'manager' ? 3 : 2) + (st.mood || 0) * k;
        if ((o.lead ?? 50) < 35) m -= 2.5;
        fx.mood.set(o, m);
        fx.list.push(o);
      }
      fx.calm = Math.max(0.7, fx.calm);
      this._fx = fx;
      this._fxAt = this.minute;
      this._fxDay = this.day;
      return fx;
    }

    teamMoodFor(e) {
      const fx = this.teamFx();
      let t = 0;
      for (const [o, m] of fx.mood) {
        if (o === e) continue;
        // 店長的加成給所有人，組長的加成只給一般員工
        if (o.rank === 'leader' && e.rank) continue;
        t += m;
      }
      if (fx.fragile && e.traits.includes('fragile') && !fx.mood.has(e)) t += fx.fragile;
      // 沒什麼企圖心的人被升上去，壓力很大
      if (e.rank && (e.ambition ?? 50) < 30) t -= 4;
      return t;
    }

    // 精算型主管：食材報廢變少（不用在班上，他會先交代好）
    get wasteMult() {
      let m = 1;
      const st = (Fun.STYLES || {}).numbers;
      if (!st) return 1;
      for (const o of this.staff) if (o.rank && o.style === 'numbers') m *= 1 - (1 - st.waste) * (0.4 + (o.lead ?? 50) / 100) * (o.rank === 'manager' ? 1.2 : 0.8);
      return Math.max(0.35, m);
    }

    // 店長代理：老闆來不及處理的事件，在班上的店長（或很會帶人的組長）會照自己的風格處理
    delegateEvent(ev) {
      if (!this.policy.delegate || ev.karen || String(ev.ev.id).startsWith('career_') || this.minute < this.hours.open) return null;
      const on = this.staff.filter((o) => o.rank && (o.state === 'working' || o.state === 'break') && o !== ev.staff);
      const m = on.find((o) => o.rank === 'manager') || on.filter((o) => o.lead >= 60).sort((a, b) => b.lead - a.lead)[0];
      if (!m) return null;
      if (m.style === 'slacker' && this.rng() < 0.5) {
        this.notify(`🐟 ${m.name} 說「等一下我來處理」，結果就忘了……`, 'bad');
        return null;
      }
      const choices = ev.ev.choices.map((c, i) => ({ c, i, fx: this.resolveEffects(c) })).filter(({ c, fx }) => !c.minigame && !fx.brawl && !fx.leave && !fx.demoteOf && !fx.promoteOf);
      if (!choices.length) return null;
      const lowLead = this.rng() < (1 - m.lead / 100) * 0.5;
      const score = ({ fx }) => {
        const cash = (fx.cash || 0) / 1000;
        const mood = (fx.morale || 0) * 2 + (fx.moodOf ? fx.moodOf.reduce((s, [, d]) => s + d, 0) / 3 : 0);
        const jerk = fx.jerk || 0;
        if (m.style === 'warm' || m.style === 'mentor') return mood * 2 + cash * 0.5 - jerk * 5;
        if (m.style === 'strict') return cash * 1.5 + mood * 0.3 - (lowLead ? 0 : jerk * 3);
        if (m.style === 'numbers') return cash * 2 + mood * 0.5 - jerk * 4;
        return this.rng() - jerk;
      };
      const best = choices.sort((a, b) => score(b) - score(a))[0];
      const r = this.applyChoice(ev, best.c);
      if (!r) return null;
      r.by = m;
      r.choice = best.c;
      if (this.cb.delegated) this.cb.delegated(r, ev, m);
      else this.notify(`👑 ${m.name} 幫你處理了「${ev.ev.title}」：${best.c.label}`);
      return r;
    }

    // 主管相關的事件：要求升遷、被投訴、摸魚、店長被挖角
    planCareerEvents() {
      const C = Fun.CAREER;
      if (!C || !this.roster) return;
      const at = () => this.hours.open + 90 + this.rng() * Math.max(60, Math.min(this.hours.span, 600) - 150);
      const onRoster = (e) => this.roster.has(e.id);
      const ask = this.staff.find((e) => !e.rank && onRoster(e) && e.ambition >= 60 && this.day - e.hiredDay >= 14 && e.skill >= 50 && this.day - (e.askDay || -99) >= 14);
      if (ask && this.rng() < 0.18 * this.diff.events) {
        ask.askDay = this.day;
        this.pendingEvents.push({ ev: C.ask(this, ask), at: at(), where: 'staff', staffPref: ask });
        return;
      }
      const strict = this.staff.find((e) => e.rank && e.revealed && e.style === 'strict' && e.lead < 60 && onRoster(e));
      const victim = strict && this.staff.find((o) => o !== strict && !o.rank && onRoster(o) && this.roster.get(o.id) === this.roster.get(strict.id) && (o.traits.includes('fragile') || o.skill < 45));
      if (victim && this.rng() < 0.12 * this.diff.events) {
        this.pendingEvents.push({ ev: C.complaint(this, strict, victim), at: at(), where: 'staff', staffPref: victim });
        return;
      }
      const slack = this.staff.find((e) => e.rank && e.revealed && e.style === 'slacker' && onRoster(e));
      if (slack && this.rng() < 0.1 * this.diff.events) {
        this.pendingEvents.push({ ev: C.slack(this, slack), at: at(), where: 'staff' });
        return;
      }
      const mgr = this.staff.find((e) => e.rank === 'manager' && onRoster(e) && e.mood < 58);
      if (mgr && this.rival && !this.rival.closed && this.rng() < 0.06 * this.diff.rival) {
        const friend = this.friendsOf(mgr, 50).filter((o) => o.rank !== 'manager')[0] || null;
        this.pendingEvents.push({ ev: C.poachManager(this, mgr, friend), at: at(), where: 'staff', staffPref: mgr });
      }
    }

    // 每天打烊：主管帶班的成績、試用期結束、真面目揭曉
    careerDayEnd(worked) {
      const ST = Fun.STYLES || {};
      for (const e of this.staff) {
        if (!e.rank) continue;
        if (worked.has(e)) {
          e.kpi.days += 1;
          e.kpi.served += this.today.served;
          e.kpi.angry += this.today.angry;
          e.kpi.visitors += this.today.visitors;
        }
        const d = e.rankDay == null ? 99 : this.day - e.rankDay;
        if (!e.revealed && d >= 3) {
          e.revealed = true;
          const st = ST[e.style] || { name: '', icon: '' };
          const good = e.lead >= 60;
          const bad = e.lead < 35;
          this.notify(`🔍 ${e.name} 當主管三天了：原來是「${st.icon} ${st.name}」，領導力 ${e.lead}${good ? '，很會帶人！' : bad ? '……其實不太會帶人（試用期內降職不傷感情）' : '。'}`, good ? 'good' : bad ? 'bad' : '');
        }
        if (d === 14) this.notify(`✅ ${e.name} 通過主管試用期。`, 'good');
      }
    }

    // ───── 分店店長 ─────
    // 派一位員工去分店當店長：他會離開本店，分店的士氣、評價、成本會照他的風格變化
    assignBranchManager(e, i) {
      const b = this.branches[i];
      if (!e || !b || b.manager || !this.staff.includes(e)) return false;
      this.ensureCareer(e);
      const R = Fun.RANKS || {};
      const wage = e.wage + (e.rank === 'manager' ? 0 : (R.manager ? R.manager.wage : 50) - (e.rank && R[e.rank] ? R[e.rank].wage : 0));
      this.removeEmployee(e, true);
      b.manager = { name: e.name, gender: e.gender, look: e.look, traits: e.traits, skill: e.skill, lead: e.lead, ambition: e.ambition, style: e.style, hint: e.hint, leadSeen: e.leadSeen, wage, hiredDay: e.hiredDay, since: this.week, mood: Math.min(100, e.mood + 10) };
      this.notify(`🏙️ ${e.name} 去${b.district}店當店長了！（時薪 $${wage}）`, 'good');
      return true;
    }

    recallBranchManager(i) {
      const b = this.branches[i];
      const m = b && b.manager;
      if (!m) return false;
      const e = this.addEmployee({ name: m.name, gender: m.gender, look: m.look, traits: m.traits, skill: m.skill, wage: m.wage }, true);
      Object.assign(e, { lead: m.lead, ambition: m.ambition, style: m.style, hint: m.hint, leadSeen: m.leadSeen, hiredDay: m.hiredDay, rank: 'leader', rankDay: this.day - 99, revealed: true });
      e.wage = Math.max(MIN_WAGE, m.wage - ((Fun.RANKS.manager || {}).wage || 50) + ((Fun.RANKS.leader || {}).wage || 25));
      this.ensureCareer(e);
      if (this.staff.filter((o) => o.rank === 'leader').length > this.leaderCap()) e.rank = null;
      b.manager = null;
      this.notify(`🏪 ${e.name} 從${b.district}店調回本店了。`);
      return true;
    }

    // 分店店長的效果：士氣、評價、容量、食材
    branchMgrFx(b) {
      const m = b.manager;
      if (!m) return { morale: 0, rating: 0, cap: 1, mat: 1, wage: 0 };
      const k = 0.4 + m.lead / 100;
      const fx = { morale: (m.lead - 45) / 5, rating: 0, cap: 1, mat: 1, wage: m.wage * 45 };
      if (m.style === 'warm') fx.morale += 5 * k;
      if (m.style === 'strict') (fx.cap = 1 + 0.07 * k), (fx.morale -= 5);
      if (m.style === 'mentor') (fx.rating += 0.12 * k), (fx.morale += 2);
      if (m.style === 'numbers') fx.mat = 1 - 0.08 * k;
      if (m.style === 'slacker') (fx.rating -= 0.15), (fx.morale += 2);
      return fx;
    }

    // 有店長或組長在班上
    leaderOnDuty(rank) {
      return this.staff.some((o) => o.rank === rank && (o.state === 'working' || o.state === 'break'));
    }

    // 物理超度：結果看運氣
    brawl() {
      const list = Fun.BRAWL || [];
      if (!list.length) return '你捲起袖子，對方看了你一眼就走了。';
      let r = this.rng();
      let out = list[list.length - 1];
      for (const b of list) {
        r -= b.p;
        if (r <= 0) {
          out = b;
          break;
        }
      }
      const fx = out.fx;
      if (fx.cash) {
        this.cash += fx.cash;
        this.ledger.fines -= fx.cash;
      }
      if (fx.followers) this.social.followers += fx.followers;
      if (fx.morale) for (const e of this.staff) e.mood = clamp(e.mood + fx.morale, 0, 100);
      if (fx.demand) this.demandMods.push({ mult: fx.demand, days: 10 });
      if (fx.review) this.addReview(fx.review[0], fx.review[1]);
      this.sound(fx.followers ? 'level' : 'bad');
      return out.text;
    }

    raise(e, amount = 10) {
      e.wage += amount;
      e.mood = clamp(e.mood + 6, 0, 100);
      this.say(e, '謝謝老闆！', 90);
    }

    praise(e) {
      if (e.praiseDay === this.day) return false;
      e.praiseDay = this.day;
      e.mood = clamp(e.mood + 8, 0, 100);
      this.jerk = clamp(this.jerk - 0.5, 0, JERK_LIMIT);
      this.say(e, ['被老闆稱讚了！', '今天做得很有成就感', '嘿嘿 ✨'][Math.floor(this.rng() * 3)], 90);
      return true;
    }

    scold(e) {
      const k = e.traits.includes('fragile') ? TRAITS.fragile.scold : 1;
      e.mood = clamp(e.mood - 15 * k, 0, 100);
      e.hustle = this.minute + 60;
      this.jerk = clamp(this.jerk + 3, 0, JERK_LIMIT);
      for (const o of this.staff) if (o !== e) o.mood = clamp(o.mood - 2, 0, 100);
      this.say(e, k > 1 ? '……（快哭了）' : '……是，我會注意。', 120);
    }

    // 叫他先去休息一下（服務中的客人做完才去）
    restNow(e) {
      if (e.state !== 'working') return false;
      if (e.task && e.task.lane && e.task.lane.customer && e.task.lane.customer.state === 'atLane') return false;
      this.startBreak(e);
      e.mood = clamp(e.mood + 2, 0, 100);
      return true;
    }

    sendHome(e) {
      e.sentHomeDay = this.day;
      if (e.state === 'working' || e.state === 'break') this.goHome(e);
      e.mood = clamp(e.mood + 3, 0, 100);
    }

    // 每天排班：有指定休假日的照指定，其他人照輪休規則；有指定班別的照指定，其餘平均分到各班
    makeRoster() {
      const working = this.staff.filter((e, i) => {
        e.slot = i;
        if (!this.openToday) return false;
        if (Array.isArray(e.restDays)) return !e.restDays.includes(this.weekday);
        if (this.policy.restDays !== 'rotate' || this.staff.length < 2) return true;
        // 每人每週輪休兩天（錯開）
        return (this.weekday + i * 3) % 7 >= 2;
      });
      const n = this.hours.shifts;
      this.roster = new Map();
      const counts = new Array(n).fill(0);
      for (const e of working) {
        if (e.shiftPref !== 'auto' && e.shiftPref < n) {
          this.roster.set(e.id, e.shiftPref);
          counts[e.shiftPref]++;
        }
      }
      for (const e of working) {
        if (this.roster.has(e.id)) continue;
        const k = counts.indexOf(Math.min(...counts));
        this.roster.set(e.id, k);
        counts[k]++;
      }
      // 被排開的兩個人不要同一班
      if (n > 1) {
        for (const pair of this.separate) {
          const [a, b] = pair.split('-').map(Number);
          if (this.roster.has(a) && this.roster.has(b) && this.roster.get(a) === this.roster.get(b)) this.roster.set(b, (this.roster.get(b) + 1) % n);
        }
      }
    }

    // 這週某一天某人上哪一班（給排班表看）：null 是休假
    plannedShift(e, wd) {
      if (this.policy.closedDay === wd) return null;
      if (Array.isArray(e.restDays)) {
        if (e.restDays.includes(wd)) return null;
      } else if (this.policy.restDays === 'rotate' && this.staff.length >= 2 && (wd + this.staff.indexOf(e) * 3) % 7 < 2) return null;
      return e.shiftPref !== 'auto' && e.shiftPref < this.policy.shifts ? e.shiftPref : 'auto';
    }

    // 員工自己的設定：班別、休假日、固定崗位
    setSchedule(e, key, value) {
      if (key === 'shiftPref') e.shiftPref = value === 'auto' ? 'auto' : Number(value);
      else if (key === 'restDay') {
        // 切換某一天休不休：第一次點的時候，先從目前的輪休規則複製一份
        if (!Array.isArray(e.restDays)) e.restDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => this.plannedShift(e, d) === null && this.policy.closedDay !== d);
        const d = Number(value);
        e.restDays = e.restDays.includes(d) ? e.restDays.filter((x) => x !== d) : [...e.restDays, d].sort();
      } else if (key === 'restAuto') e.restDays = null;
      else if (key === 'post') {
        e.post = value === '' || value === null ? null : Number(value);
        if (e.task && e.task.lane) this.dropTask(e);
      }
      // 今天的班表馬上重排（已經在上班的人不受影響）
      if (key !== 'post') {
        const keep = new Map(this.roster || []);
        this.makeRoster();
        for (const o of this.staff) if (o !== e && o.state !== 'off' && keep.has(o.id)) this.roster.set(o.id, keep.get(o.id));
      }
    }

    // 每週休幾天（七休一檢查）
    restCount(e) {
      let n = 0;
      for (let d = 0; d < 7; d++) if (this.plannedShift(e, d) === null) n++;
      return n;
    }

    setWage(e, wage) {
      const w = Math.max(MIN_WAGE, Math.round(wage / 5) * 5);
      const d = w - e.wage;
      if (!d) return;
      e.wage = w;
      if (d > 0) {
        e.mood = clamp(e.mood + Math.min(12, d * 0.6), 0, 100);
        this.say(e, '謝謝老闆！', 90);
      } else {
        e.mood = clamp(e.mood + Math.max(-20, d * 0.8), 0, 100);
        this.jerk = clamp(this.jerk + 1, 0, JERK_LIMIT);
        this.say(e, '……薪水被減了。', 120);
      }
    }

    // 員工今天上不上班、上哪一班
    shiftOf(e) {
      if (!this.openToday || e.sentHomeDay === this.day) return null;
      if (!this.roster || !this.roster.has(e.id)) {
        // 今天新來的人：排進人最少的那一班
        if (!this.roster) return null;
        const counts = new Array(this.hours.shifts).fill(0);
        for (const v of this.roster.values()) counts[v]++;
        this.roster.set(e.id, counts.indexOf(Math.min(...counts)));
      }
      const n = this.hours.shifts;
      const idx = this.roster.get(e.id);
      const len = this.hours.span / n;
      const start = this.hours.open + idx * len - (idx === 0 ? 30 : 0);
      const end = this.hours.open + (idx + 1) * len;
      return { idx, start, end, length: end - start };
    }

    onDuty(e, min = this.minute) {
      const s = this.shiftOf(e);
      return !!s && min >= s.start && min < s.end;
    }

    // ───── 客人 ─────
    attractiveness() {
      const rating = this.reviews.length >= 5 ? this.rating : 3.8;
      const ratingF = clamp(0.55 + 0.15 * (rating - 2), 0.4, 1.1);
      const avgRatio = this.priceRatio();
      const priceF = avgRatio <= 1.05 ? Math.pow(avgRatio, -0.8) : Math.pow(1.05, -0.8) * Math.pow(avgRatio / 1.05, -3);
      const beautyF = 1 + Math.min(0.25, this.beauty / 60) + this.draw;
      const lotF = 1 + this.lotIdx * 0.35;
      const summer = this.isSummer ? this.ind.summerBoost || 1 : 1;
      const heat = this.isSummer && !this.cooling ? 0.9 : 1;
      const mods = this.demandMods.reduce((m, d) => m * d.mult, 1);
      const cleanF = 0.82 + 0.18 * (this.cleanliness / 100);
      const loyal = this.loyalty ? 1.04 : 1;
      // 菜單越豐富，越多人想進來看看
      const variety = 1 + Math.max(0, this.availableProducts().length - this.ind.products.filter((p) => !p.rd).length) * 0.035;
      return ratingF * priceF * beautyF * lotF * summer * heat * mods * this.festivalMult() * cleanF * loyal * variety * this.socialBoost * (this.shopCat ? 1.04 : 1) * (this.copiedDish ? 1.04 : 1) * this.collabMult * this.rivalPull();
    }

    availableProducts() {
      if (this.gridDirty) this.rebuildGrid();
      const have = new Set(this.stations.flatMap((s) => s.def.serves));
      return this.ind.products.filter((p) => this.menu[p.id] && this.hasRecipe(p) && have.has(p.id));
    }

    hasRecipe(p) {
      return !p.rd || this.recipes.has(p.id);
    }

    // 菜單上有在賣的品項（用來算價格高低）
    menuProducts() {
      const list = this.ind.products.filter((p) => this.menu[p.id] && this.hasRecipe(p));
      return list.length ? list : this.ind.products.filter((p) => !p.rd);
    }

    priceRatio() {
      const ps = this.menuProducts();
      return ps.reduce((s, p) => s + this.effPrice(p.id) / (p.price * this.idx.cpi), 0) / ps.length;
    }

    // 研發新品：花錢、要等級
    research(id) {
      const p = this.ind.products.find((x) => x.id === id);
      if (!p || !p.rd || this.recipes.has(id) || this.level < (p.lv || 1) || this.cash < p.rd) return false;
      this.cash -= p.rd;
      this.ledger.other -= p.rd;
      this.recipes.add(id);
      this.menu[id] = true;
      this.notify(`🧪 新品「${p.name}」研發成功，已經上架！`, 'achieve');
      this.gainXp(120);
      return true;
    }

    // ───── 裝潢樣式 ─────
    setStyle(kind, value) {
      if (kind === 'floor') {
        const f = FLOORS[value];
        if (!f) return false;
        if (!this.ownedFloors.has(value)) {
          if (this.cash < f.price) return false;
          this.cash -= f.price;
          this.ledger.other -= f.price;
          this.ownedFloors.add(value);
        }
        this.style.floor = value;
      } else if (kind === 'wall' || kind === 'sign') {
        const cost = kind === 'wall' ? 3000 : 5000;
        if (this.style[kind] === value) return true;
        if (this.cash < cost) return false;
        this.cash -= cost;
        this.ledger.other -= cost;
        this.style[kind] = value;
      } else return false;
      this.styleVer = (this.styleVer || 0) + 1;
      return true;
    }

    spawnCustomer(opt = {}) {
      const prods = this.availableProducts();
      if (!prods.length) return;
      const type = opt.rider ? null : this.pickType();
      if (type && !this.typeAccepts(type)) return;
      // 學生偏好便宜的品項，上班族不太在意價格
      const sens = type ? type.priceSens : 1;
      const avgP = prods.reduce((s, p) => s + this.effPrice(p.id), 0) / prods.length;
      const ws = prods.map((p) => p.weight * Math.pow(avgP / Math.max(1, this.effPrice(p.id)), (sens - 1) * 0.8));
      let r = this.rng() * ws.reduce((a, b) => a + b, 0);
      let product = prods[0];
      for (let i = 0; i < prods.length; i++) {
        r -= ws[i];
        if (r <= 0) {
          product = prods[i];
          break;
        }
      }
      const fromLeft = this.rng() < 0.5;
      const qty = Math.max(1, Math.round((1 + (this.rng() + this.rng()) * ((this.ind.basket || 1) - 1)) * (type ? type.basket : 1))) + (opt.rider ? 1 : 0);
      const c = {
        id: uid++,
        kind: 'customer',
        type: type ? type.id : 'rider',
        look: this.typeLook(type),
        product,
        qty,
        rider: !!opt.rider,
        x: fromLeft ? -OUT_W : this.W + OUT_W - 1,
        z: this.H + (this.ind.arriveByScooter ? 1 : 0),
        path: [],
        state: 'arriving',
        waited: 0,
        patience: 16 * (this.ind.patience || 1) * this.diff.patience * (opt.rider ? 1.4 : 1) * (type ? type.patience : 1),
        speed: type ? type.speed : 1.1,
        progress: 0,
        scooter: !!this.ind.arriveByScooter || !!opt.rider,
      };
      if (opt.rider) c.look = { ...c.look, hat: 'cap', hatColor: '#e0478a', shirt: '#e0478a', extra: null };
      this.customers.push(c);
      this.today.visitors++;
      if (opt.rider) this.today.delivery++;
      this.walkTo(c, { x: this.doorX + (this.rng() < 0.5 ? 0 : 1), z: this.H - 1 });
    }

    spawnPasser() {
      const fromLeft = this.rng() < 0.5;
      const lane = this.rng() < 0.75 ? 0 : 2;
      const p = {
        id: uid++,
        kind: lane === 2 ? 'scooter' : 'passer',
        look: lane === 2 ? Looks.randomLook(this.rng) : this.typeLook(this.pickType()),
        x: fromLeft ? -OUT_W : this.W + OUT_W - 1,
        z: this.H + lane,
        tx: fromLeft ? this.W + OUT_W - 1 : -OUT_W,
        speed: lane === 2 ? 7 + this.rng() * 3 : 1.6 + this.rng() * 0.8,
      };
      this.passers.push(p);
    }

    walkTo(a, cell) {
      const path = this.findPath(a, cell);
      if (!path) return false;
      a.path = path;
      a.dest = cell;
      return true;
    }

    stationFor(product) {
      if (this.gridDirty) this.rebuildGrid();
      const list = this.stations.filter((s) => s.def.serves.includes(product.id));
      if (!list.length) return null;
      // 選排隊最少的
      return list.reduce((a, b) => (a.queue.length + a.lanes.filter((l) => l.customer).length <= b.queue.length + b.lanes.filter((l) => l.customer).length ? a : b));
    }

    // 排隊的位置：離服務點最近、沒人站的空格
    queueCell(o, k) {
      const start = o.custSpots[0];
      const taken = new Set();
      for (const s of this.stations) for (const sp of s.custSpots) taken.add(`${sp.x},${sp.z}`);
      for (const c of this.customers) if (c.qcell && c.qobj !== o) taken.add(`${c.qcell.x},${c.qcell.z}`);
      for (let d = this.doorX; d <= this.doorX + 1; d++) taken.add(`${d},${this.H - 1}`);
      const seen = new Set([`${start.x},${start.z}`]);
      const q = [start];
      const order = [];
      while (q.length && order.length <= k + 1) {
        const cur = q.shift();
        for (const [dx, dz] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
          const n = { x: cur.x + dx, z: cur.z + dz };
          const key = `${n.x},${n.z}`;
          if (seen.has(key) || !this.inside(n.x, n.z) || !this.passable(n.x, n.z)) continue;
          seen.add(key);
          q.push(n);
          if (!taken.has(key)) order.push(n);
        }
      }
      return order[k] || order[order.length - 1] || start;
    }

    customerArrived(c) {
      if (c.supplier) return this.receiveDelivery(c);
      if (c.inspector) {
        c.state = 'inspecting';
        c.inspectT = 0;
        return;
      }
      if (!this.isOpen) {
        this.customerLeave(c, 'closed');
        return;
      }
      // 下雨天：鞋底的泥巴
      if (this.weather && (this.weather.id === 'rain' || this.weather.id === 'typhoon') && this.rng() < 0.3) this.addDirt(this.doorX + (this.rng() < 0.5 ? 0 : 1), this.H - 1, 1, 'mud');
      // 賣完了：有些人會改點別的，有些人直接走
      if (!this.hasStock(c.product, 1)) {
        const alt = this.availableProducts().filter((p) => p !== c.product && this.hasStock(p, 1));
        if (alt.length && this.rng() < 0.6) c.product = alt[Math.floor(this.rng() * alt.length)];
        else {
          this.customerLeave(c, 'soldOut');
          return;
        }
      }
      c.qty = Math.max(1, Math.min(c.qty, this.stockLeft(c.product)));
      const o = this.stationFor(c.product);
      if (!o) {
        this.customerLeave(c, 'noStation');
        return;
      }
      if (o.queue.length >= 8) {
        this.customerLeave(c, 'tooLong');
        return;
      }
      o.queue.push(c);
      c.obj = o;
      c.state = 'queue';
      this.reserveStock(c);
      if (c.karen) this.karenScene(c);
      if (!c.rider) this.sound('door');
      this.refreshQueue(o);
    }

    refreshQueue(o) {
      // 有空的服務位：排第一的人過去
      const anyStaff = o.lanes.some((l) => l.staff);
      for (const lane of o.lanes) {
        if (!lane.self && !lane.staff && (anyStaff || lane !== o.lanes[0])) continue;
        if (!lane.customer && o.queue.length) {
          const c = o.queue.shift();
          lane.customer = c;
          c.lane = lane;
          c.state = 'toLane';
          c.qcell = null;
          this.walkTo(c, lane.custSpot);
        }
      }
      // 其他人排在附近
      const waits = this.objects.filter((w) => w.def.cat === 'wait');
      o.queue.forEach((c, k) => {
        // 有等候椅就坐著等
        if (!c.waitSeat) {
          for (const w of waits) {
            const i = w.seatTaken.findIndex((t) => !t);
            if (i >= 0) {
              w.seatTaken[i] = c;
              c.waitSeat = { obj: w, i };
              break;
            }
          }
        }
        const cell = c.waitSeat ? c.waitSeat.obj.seatSpots[c.waitSeat.i] : this.queueCell(o, k);
        if (!c.qcell || c.qcell.x !== cell.x || c.qcell.z !== cell.z) {
          c.qcell = cell;
          c.qobj = o;
          this.walkTo(c, cell);
        }
      });
    }

    freeWaitSeat(c) {
      if (c.waitSeat) {
        c.waitSeat.obj.seatTaken[c.waitSeat.i] = null;
        c.waitSeat = null;
      }
    }

    customerLeave(c, reason) {
      this.freeWaitSeat(c);
      this.releaseStock(c);
      if (c.obj) {
        c.obj.queue = c.obj.queue.filter((x) => x !== c);
        if (c.lane && c.lane.customer === c) c.lane.customer = null;
      }
      if (c.seatObj) {
        c.seatObj.seatTaken[c.seatIdx] = null;
        c.seatObj = null;
      }
      const wasWaiting = c.state === 'queue' || c.state === 'toLane' || c.state === 'atLane';
      c.state = 'leaving';
      c.lane = null;
      c.qcell = null;
      const exitX = this.rng() < 0.5 ? -OUT_W : this.W + OUT_W - 1;
      if (!this.walkTo(c, { x: exitX, z: this.H + (c.scooter ? 1 : 0) })) c.state = 'gone';
      if (reason === 'angry' && wasWaiting) {
        this.today.angry++;
        this.sound('angry');
        this.addReview(1 + (this.rng() < 0.3 ? 1 : 0), this.pickComment('angry', c));
        this.popup(c, '😡', 'bad');
      } else if (reason === 'tooLong') {
        this.today.balked++;
        this.popup(c, '😩', 'bad');
      } else if (reason === 'closed') {
        this.popup(c, '休息中', 'muted');
      } else if (reason === 'noStation') {
        this.popup(c, '❓', 'muted');
      } else if (reason === 'soldOut') {
        this.today.soldOut++;
        this.popup(c, '賣完了😢', 'bad');
        if (this.rng() < 0.25) this.addReview(2, `想吃${c.product.name}結果賣完了`);
      }
      if (c.obj) this.refreshQueue(c.obj);
      c.obj = null;
    }

    finishService(c, e) {
      const p = c.product;
      const unit = this.effPrice(p.id);
      // 食材在點餐時就扣掉了（進貨時已經付過錢）
      c.reserved = null;
      // 外送平台抽成 30%
      const price = Math.round(unit * c.qty * (c.rider ? 0.7 : 1));
      const cost = p.cost * c.qty * this.idx.cpi * this.costMult.materials * (0.85 + 0.15 * this.idx.oil);
      this.cash += price;
      this.ledger.revenue += price;
      this.today.revenue += price;
      // 服務完留下的髒污：麵渣、頭髮、油漬
      const mess = { barber: p.id === 'wash' ? 0.25 : 0.55, scooter: 0.3, store: 0.08 }[this.ind.id] ?? 0.18;
      if (this.rng() < mess) this.addDirt(c.x, c.z);
      this.today.served++;
      if (e) {
        e.served++;
        e.skill = clamp(e.skill + 0.08 * (e.traits.includes('rookie') ? TRAITS.rookie.learn : 1) * (e.rank ? 1 : this.teamFx().learn), 0, 100);
      }
      this.gainXp(((price - cost) / 25) * (this.ind.xpMult || 1));
      this.popup(c, `+$${price}`, 'money');
      this.sound('coin');

      // 滿意度
      let stars = 4.3;
      stars -= (c.waited / c.patience) * 2;
      stars += Math.min(0.5, this.beauty / 25);
      if (e) stars += (e.mood - 55) / 90;
      if (e && e.traits.includes('chatty')) stars += TRAITS.chatty.charm * 3;
      const type = CUSTOMER_TYPES[c.type];
      const sens = type ? type.priceSens : 1;
      const ratio = unit / (p.price * this.idx.cpi);
      if (ratio > 1.1) stars -= (ratio - 1.1) * 4 * sens;
      if (ratio < 0.9) stars += 0.2 * sens;
      if (this.isSummer && !this.cooling) stars -= 0.4;
      if (e && e.skill > 70) stars += 0.2;
      // 長輩喜歡愛聊天的店員；店裡髒會被扣分
      if (c.type === 'elderly' && e && e.traits.includes('chatty')) stars += 0.3;
      if (c.gifted) stars += 0.6;
      if (e && e.isBoss) stars += 0.2;
      const clean = this.cleanliness;
      if (clean < 70) stars -= (70 - clean) / 35;
      else if (clean > 90) stars += 0.15;

      const o = c.obj;
      if (c.lane) c.lane.customer = null;
      c.lane = null;
      c.obj = null;
      if (o) o.queue = o.queue.filter((x) => x !== c);

      // 內用：找位子坐（外送員拿了就走）
      let seated = false;
      if (this.ind.dineIn && !c.rider && this.rng() < 0.65) {
        const seats = this.objects.filter((s) => s.def.cat === 'seat');
        for (const s of seats) {
          const i = s.seatTaken.findIndex((t) => !t);
          if (i >= 0 && this.walkTo(c, s.seatSpots[i])) {
            s.seatTaken[i] = c;
            c.seatObj = s;
            c.seatIdx = i;
            c.state = 'toSeat';
            c.eatFor = 10 + this.rng() * 12;
            seated = true;
            stars += 0.15;
            break;
          }
        }
        if (!seated) stars -= 0.3;
      }
      c.stars = clamp(Math.round(stars * 2) / 2, 1, 5);
      if (!seated) {
        this.reviewFor(c);
        this.customerLeave(c, 'done');
      }
      if (o) this.refreshQueue(o);
    }

    reviewFor(c) {
      if (this.rng() < 0.55) this.addReview(c.stars, this.pickComment(c.stars >= 4 ? 'good' : c.stars >= 3 ? 'ok' : 'bad', c));
      this.popup(c, c.stars >= 4.5 ? '😍' : c.stars >= 3.5 ? '🙂' : c.stars >= 2.5 ? '😐' : '😠', c.stars >= 3.5 ? 'good' : 'bad');
    }

    addReview(stars, text) {
      this.reviews.push({ stars, text, day: this.day });
      if (stars >= 5) this.gainXp(3);
      if (this.reviews.length > 200) this.reviews.shift();
      if (this.reviews.length >= 30 && this.rating >= 4.5) this.achieve('rating');
    }

    pickComment(kind, c) {
      const p = c.product ? c.product.name : '';
      const pools = {
        good: [`${p}好好吃，會再來！`, '老闆和員工都很親切', '店裡乾淨又舒服', `${p}CP 值很高`, '出餐超快，上班族救星', '店員很有耐心'],
        ok: [`${p}還可以`, '中規中矩', '有點小貴', '等有點久，但還行'],
        bad: this.cleanliness < 55 ? ['桌子黏黏的，地上也髒髒的', '店裡有點髒，衛生堪慮', '等太久了'] : ['等太久了', '店員看起來很累，態度普通', '價格偏高', '店裡好熱'],
        angry: ['等了快二十分鐘都沒人理，直接走人', '排隊排到天荒地老', '人手明顯不夠，老闆不請人嗎'],
      };
      let arr = pools[kind];
      if (this.rng() < 0.3 && Fun.FUNNY_REVIEWS[kind === 'good' ? 'good' : kind === 'bad' ? 'bad' : '']) arr = Fun.FUNNY_REVIEWS[kind];
      return arr[Math.floor(this.rng() * arr.length)];
    }

    popup(a, text, kind) {
      this.popups.push({ id: uid++, x: a.x, z: a.z, text, kind, t: 0 });
    }

    say(e, text, mins = 60) {
      e.thought = { text, until: this.minute + mins };
    }

    sound(name) {
      if (this.cb.sound) this.cb.sound(name);
    }

    notify(text, kind = '') {
      if (this.cb.notify) this.cb.notify(text, kind);
    }

    achieve(id) {
      if (this.achievements.has(id)) return;
      this.achievements.add(id);
      const a = ACHIEVEMENTS.find((x) => x.id === id);
      if (a) {
        this.cash += a.reward;
        this.ledger.other += a.reward;
        this.gainXp(300);
        this.notify(`🏆 成就達成：${a.name}（獎勵 $${a.reward.toLocaleString()}）`, 'achieve');
      }
    }

    // ───── 每一幀 ─────
    tick(dtMin) {
      if (this.over) return;
      // 切成小步，避免高倍速時穿牆或跳過事件
      while (dtMin > 0) {
        const step = Math.min(dtMin, 0.5);
        this.step(step);
        dtMin -= step;
        if (this.over) return;
      }
    }

    step(dt) {
      const prevHour = Math.floor(this.minute / 60);
      this.minute += dt;
      if (Math.floor(this.minute / 60) !== prevHour) this.socialTick();
      if (this.gridDirty) this.rebuildGrid();

      // 換日
      if (this.minute >= this.dayEndMinute()) {
        this.endDay();
        return;
      }

      // 來客
      if (this.isOpen) {
        const base = (this.ind.baseArrivals * this.ind.demand[this.hour] * this.attractiveness()) / 60;
        if (this.rng() < base * this.weatherMult('walk') * dt) this.spawnCustomer();
        // 外送平台的訂單：外送員騎車來取餐
        if (this.policy.delivery && this.ind.delivery && this.rng() < base * 0.22 * this.weatherMult('delivery') * dt) this.spawnCustomer({ rider: true });
      }
      // 路上的奇景
      if (Fun.STREET_GAGS && this.passers.length && this.rng() < 0.012 * dt) {
        const p = this.passers.find((x) => x.kind === 'passer' && x.x > 0 && x.x < this.W);
        if (p) this.popups.push({ id: uid++, x: p.x, z: p.z, text: Fun.STREET_GAGS[Math.floor(this.rng() * Fun.STREET_GAGS.length)], kind: 'muted', t: -2 });
      }
      // 晚上八點，垃圾車〈給愛麗絲〉
      const tod = ((this.minute % DAY) + DAY) % DAY;
      if (tod >= 1200 && tod - dt < 1200 && this.weekday !== 2 && this.weekday !== 6) {
        this.sound('garbage');
        this.notify('🚛🎵 〈給愛麗絲〉從巷口傳來，垃圾車來了！', '');
        for (const e of this.staff) if (e.state === 'working' && this.rng() < 0.5) this.say(e, ['垃圾車來了！', '誰去倒垃圾？', '快快快！'][Math.floor(this.rng() * 3)], 20);
      }
      const daylight = this.hour >= 6 && this.hour < 22 ? 1 : 0.25;
      if (this.rng() < 0.55 * daylight * (this.weather ? this.weather.walk : 1) * dt) this.spawnPasser();

      // 老闆：出門回來、顧店會累
      const B = this.boss;
      if (B.away && this.minute >= B.away.until) this.finishTrip();
      if (B.state === 'working' && !B.away) {
        if (B.lane && B.lane.customer && B.lane.customer.state === 'atLane') B.energy = clamp(B.energy - 0.12 * (1 - B.fit * 0.1) * dt, 0, 100);
        else B.energy = clamp(B.energy + 0.04 * dt, 0, 100);
      }

      // 奧客：一天大概一個
      if (this.isOpen && !this.customers.some((c) => c.karen) && this.rng() < (0.9 * this.diff.events * dt) / Math.max(240, this.hours.span)) this.spawnKaren();

      // 送貨、稽查、外包清潔
      for (const d of this.deliveries) {
        if (!d.sent && this.minute >= d.at) {
          d.sent = true;
          this.spawnSupplier(d);
        }
      }
      if (this.hygiene.at && this.minute >= this.hygiene.at) {
        this.hygiene.at = null;
        this.spawnInspector();
      }
      if (this.policy.cleaner && this.isOpen && this.dirt.length) {
        this.cleanerT = (this.cleanerT || 0) + dt;
        if (this.cleanerT > 25) {
          this.cleanerT = 0;
          const d = this.dirt.find((x) => !x.by);
          if (d) this.dirt = this.dirt.filter((x) => x !== d);
        }
      }

      // 事件
      while (this.pendingEvents.length && this.pendingEvents[0].at <= this.minute) this.spawnEvent(this.pendingEvents.shift());
      for (const ev of [...this.activeEvents]) if (this.minute >= ev.deadline) this.ignoreEvent(ev);

      this.updateStaff(dt);
      this.updateCustomers(dt);
      this.updatePassers(dt);
      for (const p of this.popups) p.t += dt;
      this.popups = this.popups.filter((p) => p.t < 3);
    }

    // 一天的結束：最後一班下班後，或隔天第一班前
    dayEndMinute() {
      return this.dayStart + DAY;
    }

    get dayStart() {
      return this.hours.open - 60;
    }

    moveAgent(a, speed, dt) {
      let dist = speed * dt;
      while (dist > 0 && a.path.length) {
        const n = a.path[0];
        const dx = n.x - a.x;
        const dz = n.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d <= dist) {
          a.x = n.x;
          a.z = n.z;
          a.path.shift();
          dist -= d;
        } else {
          a.x += (dx / d) * dist;
          a.z += (dz / d) * dist;
          a.dir = Math.atan2(dx, dz);
          dist = 0;
        }
        if (d > 0) a.dir = Math.atan2(dx, dz);
      }
      a.moving = a.path.length > 0;
      return !a.path.length;
    }

    updateCustomers(dt) {
      for (const c of this.customers) {
        const arrived = this.moveAgent(c, 2.4 * (c.speed || 1), dt);
        switch (c.state) {
          case 'arriving':
            if (arrived) this.customerArrived(c);
            break;
          case 'queue':
          case 'toLane':
            c.waited += dt * (c.waitSeat ? 0.6 : 1) * this.teamFx().calm;
            if (c.state === 'toLane' && arrived) {
              c.state = 'atLane';
              this.freeWaitSeat(c);
            }
            if (c.waited > c.patience) this.customerLeave(c, 'angry');
            break;
          case 'atLane': {
            const lane = c.lane;
            const spd = (c.obj && c.obj.def.speed) || 1;
            const work = c.product.time * (1 + (c.qty - 1) * 0.6);
            if (lane && lane.self) {
              // 自助結帳：不用店員
              c.progress += (dt * spd) / work;
              if (c.progress >= 1) this.finishService(c, null);
              break;
            }
            const e = lane && lane.staff && lane.staff.state === 'working' && lane.staff.task && lane.staff.task.lane === lane && !lane.staff.path.length ? lane.staff : null;
            if (e) {
              c.progress += (dt * this.speedOf(e) * spd) / work;
              c.servedBy = e;
              if (c.progress >= 1) this.finishService(c, e);
            } else {
              c.waited += dt;
              if (c.waited > c.patience * 1.2) this.customerLeave(c, 'angry');
            }
            break;
          }
          case 'toSeat':
            if (arrived) c.state = 'eating';
            break;
          case 'eating':
            c.eatFor -= dt;
            if (c.eatFor <= 0) {
              if (this.rng() < 0.5) this.addDirt(c.x, c.z);
              this.reviewFor(c);
              this.customerLeave(c, 'done');
            }
            break;
          case 'inspecting':
            c.inspectT += dt;
            if (c.inspectT >= 24) this.finishInspection(c);
            else if (arrived) {
              // 到處看看：挑店裡一個空格走過去
              for (let k = 0; k < 6; k++) {
                const x = Math.floor(this.rng() * this.W);
                const z = Math.floor(this.rng() * this.H);
                if (this.passable(x, z) && this.walkTo(c, { x, z })) break;
              }
            }
            break;
          case 'leaving':
            if (arrived) c.state = 'gone';
            break;
        }
      }
      this.customers = this.customers.filter((c) => c.state !== 'gone');
    }

    updatePassers(dt) {
      for (const p of this.passers) {
        const dir = Math.sign(p.tx - p.x);
        p.x += dir * p.speed * dt;
        p.dir = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        p.moving = true;
        if ((dir > 0 && p.x >= p.tx) || (dir < 0 && p.x <= p.tx)) p.gone = true;
      }
      this.passers = this.passers.filter((p) => !p.gone);
    }

    speedOf(e) {
      let s = 0.55 + e.skill / 110;
      if (e.energy < 30) s *= 0.55 + e.energy / 70;
      if (e.hunger < 20) s *= 0.85;
      s *= 0.85 + e.mood / 400;
      if (e.traits.includes('chatty')) s *= TRAITS.chatty.speed;
      if (e.hustle && e.hustle > this.minute) s *= 1.08;
      if (this.isSummer && !this.cooling) s *= 0.92;
      s *= this.teamFx().speed;
      if (e.rank && e.style === 'slacker' && e.revealed) s *= (Fun.STYLES || {}).slacker ? Fun.STYLES.slacker.self : 1;
      return s;
    }

    restSpots() {
      return this.objects.filter((o) => o.def.cat === 'staff' && o.def.rest);
    }

    goHome(e) {
      this.dropTask(e);
      e.state = 'leaving';
      this.walkTo(e, { x: this.rng() < 0.5 ? -OUT_W : this.W + OUT_W - 1, z: this.H });
    }

    updateStaff(dt) {
      for (const e of this.staff) {
        const duty = this.onDuty(e);
        const arrived = this.moveAgent(e, 2.8, dt);

        if (e.state === 'off') {
          if (duty) {
            e.state = 'arriving';
            e.x = this.rng() < 0.5 ? -OUT_W : this.W + OUT_W - 1;
            e.z = this.H;
            this.walkTo(e, { x: this.doorX, z: this.H - 1 });
          }
          continue;
        }
        if (e.state === 'leaving') {
          if (arrived) e.state = 'off';
          continue;
        }
        if (!duty) {
          // 打烊後把排隊的客人服務完才走（最多加 30 分鐘）
          const o = e.task && e.task.obj;
          const pending = o && o.lanes && (o.queue.length || o.lanes.some((l) => l.customer));
          const lastCall = this.minute < this.hours.close + 30 && this.minute >= this.hours.close - 1;
          if (!(pending && (lastCall || (e.task.lane && e.task.lane.customer && e.task.lane.customer.state === 'atLane')))) {
            this.goHome(e);
            continue;
          }
        }
        if (e.state === 'arriving' && arrived) e.state = 'working';
        if (e.state === 'arriving') continue;

        // 身體狀況
        const working = e.state === 'working';
        const serving = working && e.task && e.task.lane && e.task.lane.customer && e.task.lane.customer.state === 'atLane';
        const night = this.hour >= 22 || this.hour < 6;
        let drain = 0.17 * (serving ? 1 : 0.45);
        if (e.traits.includes('hardworking')) drain *= TRAITS.hardworking.energy;
        if (night) drain *= e.traits.includes('nightowl') ? TRAITS.nightowl.night : 1.25;
        drain *= this.diff.drain;
        if (working) {
          e.energy = clamp(e.energy - drain * dt, 0, 100);
          e.hunger = clamp(e.hunger - 0.14 * dt * (e.traits.includes('foodie') ? TRAITS.foodie.hunger : 1), 0, 100);
          e.minutesToday += dt;
        }
        this.updateMood(e, dt);

        if (e.state === 'break') {
          const t = e.task;
          if (arrived && t) {
            const bonus = t.obj ? t.obj.def.restBonus || 1 : 0.5;
            e.energy = clamp(e.energy + 1.6 * bonus * dt, 0, 100);
            e.hunger = clamp(e.hunger + 2.5 * dt, 0, 100);
          }
          if (e.energy > 88 && e.hunger > 75) {
            if (t && t.obj) t.obj.seatTaken[t.seat] = null;
            e.task = null;
            e.state = 'working';
            this.say(e, '休息完，回去工作！', 30);
          }
          continue;
        }

        // 要不要休息
        const tired = e.energy < 28 || e.hunger < 22;
        if (tired && this.policy.breaks && !serving) {
          const onBreak = this.staff.filter((s) => s.state === 'break').length;
          if (onBreak < Math.max(1, Math.ceil(this.staff.filter((s) => s.state === 'working').length / 3))) {
            this.startBreak(e);
            continue;
          }
        }
        if (tired && !this.policy.breaks && this.rng() < 0.01 * dt) this.say(e, ['老闆說不准休息……', '腳好痠', '一口飯都還沒吃'][Math.floor(this.rng() * 3)], 40);

        // 找事做：哪個服務位最需要人
        if (!serving) this.assignWork(e, dt);
        this.thinkMaybe(e, dt);
      }
    }

    startBreak(e) {
      this.dropTask(e);
      const spots = this.restSpots();
      for (const o of spots) {
        const i = o.seatTaken.findIndex((t) => !t);
        if (i >= 0 && this.walkTo(e, o.seatSpots[i])) {
          o.seatTaken[i] = e;
          e.task = { type: 'rest', obj: o, seat: i };
          e.state = 'break';
          this.say(e, ['終於可以坐一下', '先吃個飯', '喝口水喘口氣'][Math.floor(this.rng() * 3)], 30);
          return;
        }
      }
      // 沒有休息區：只能站在角落
      e.task = { type: 'rest', obj: null };
      e.state = 'break';
      this.walkTo(e, { x: this.W - 1, z: 0 }) || this.walkTo(e, { x: 0, z: 0 });
      this.say(e, '連坐下來休息的地方都沒有……', 60);
      e.mood = clamp(e.mood - 3, 0, 100);
    }

    assignWork(e, dt) {
      const cleaning = e.task && e.task.type === 'clean';
      const cur = e.task && e.task.lane;
      const need = (o) => o.queue.length + o.lanes.filter((l) => l.customer).length - o.lanes.filter((l) => l.staff).length;
      let best = null;
      let bestScore = 0.5;
      const post = e.post && this.stations.some((o) => o.id === e.post) ? e.post : null;
      for (const o of this.stations) {
        if (post && o.id !== post) continue;
        for (const lane of o.lanes) {
          if (lane.self || (lane.staff && lane.staff !== e)) continue;
          let score = need(o) + (lane.customer ? 2 : 0);
          if (lane === cur) score += 0.8;
          const d = Math.abs(lane.staffSpot.x - e.x) + Math.abs(lane.staffSpot.z - e.z);
          score -= d * 0.03;
          if (score > bestScore) {
            bestScore = score;
            best = lane;
          }
        }
      }
      // 打掃中：有客人等才放下拖把
      if (cleaning) {
        if (best && bestScore > (this.cleanRushUntil > this.minute ? 3 : 1.5)) this.dropTask(e);
        else {
          this.doClean(e, dt);
          return;
        }
      }
      // 沒客人：有空就去打掃
      if (!best && this.tryClean(e)) return;
      // 沒人要服務：留在原位，或去一個沒人顧的服務位待命
      if (!best && !cur) {
        for (const o of this.stations) {
          if (post && o.id !== post) continue;
          const lane = o.lanes.find((l) => !l.staff && !l.self);
          if (lane) {
            best = lane;
            break;
          }
        }
      }
      if (best && best !== cur) {
        if (cur && cur.staff === e) cur.staff = null;
        best.staff = e;
        const obj = this.stations.find((o) => o.lanes.includes(best));
        e.task = { type: 'serve', lane: best, obj };
        this.walkTo(e, best.staffSpot);
        this.refreshQueue(obj);
      }
    }

    // ───── 人際關係 ─────
    relKey(a, b) {
      return a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`;
    }
    relOf(a, b) {
      return this.rel[this.relKey(a, b)] || 0;
    }
    addRel(a, b, d) {
      if (!a || !b || a === b) return;
      const k = this.relKey(a, b);
      const before = this.rel[k] || 0;
      const after = clamp(before + d, -100, 100);
      this.rel[k] = after;
      if (before < 40 && after >= 40) {
        this.notify(`🤝 ${a.name}和${b.name}變成好朋友了`, 'good');
        this.say(a, `跟${b.name}很聊得來`, 60);
      }
      if (before > -30 && after <= -30) {
        this.notify(`💢 ${a.name}和${b.name}好像處不來`, 'bad');
        this.say(a, `${b.name}真的很難相處……`, 60);
      }
    }
    relLabel(v) {
      if (v >= 70) return '超好的朋友';
      if (v >= 40) return '好朋友';
      if (v >= 15) return '還不錯';
      if (v <= -60) return '死對頭';
      if (v <= -30) return '處不來';
      if (v <= -15) return '有點摩擦';
      return '普通同事';
    }
    friendsOf(e, min = 40) {
      return this.staff.filter((o) => o !== e && this.relOf(e, o) >= min);
    }

    // 每個小時：一起上班的人好感度慢慢變化
    socialTick() {
      const here = this.staff.filter((e) => e.state === 'working' || e.state === 'break');
      for (let i = 0; i < here.length; i++) {
        for (let j = i + 1; j < here.length; j++) {
          const a = here[i];
          const b = here[j];
          const cur = this.relOf(a, b);
          // 每一對人有固定的合拍程度：有些人天生就是處不來
          const h = ((a.id * 73856093) ^ (b.id * 19349663)) >>> 0;
          const fit = ((h % 1000) / 1000 - 0.5) * 1.4;
          let d = 0.22 + fit + (this.rng() - 0.5) * 1.2;
          if (a.traits.includes('chatty') && b.traits.includes('chatty')) d += 0.6;
          if (a.traits.includes('cheerful') || b.traits.includes('cheerful')) d += 0.3;
          if ((a.traits.includes('fragile') && b.traits.includes('veteran')) || (b.traits.includes('fragile') && a.traits.includes('veteran'))) d -= 0.7;
          if (a.mood < 35 || b.mood < 35) d -= 0.8;
          if (a.energy < 25 && b.energy < 25) d -= 0.4;
          if (cur < -20) d -= 0.3;
          if (cur > 20) d += 0.2;
          this.addRel(a, b, d);
        }
      }
    }

    updateMood(e, dt) {
      let target = 62;
      if (e.state === 'working' || e.state === 'break') {
        let f = 0;
        let r = 0;
        for (const o of this.staff) {
          if (o === e || (o.state !== 'working' && o.state !== 'break')) continue;
          const v = this.relOf(e, o);
          if (v >= 40) f++;
          else if (v <= -30) r++;
        }
        target += Math.min(8, f * 4) - Math.min(10, r * 5);
      }
      target += (e.wage / this.marketWage - 1) * 60;
      target += Math.min(10, this.beauty / 4);
      if (this.objects.some((o) => o.def.staffMood)) target += 3;
      if (!this.restSpots().length) target -= 6;
      if (!this.policy.breaks) target -= 10;
      if (this.policy.restDays === 'none') target -= 10;
      const s = this.shiftOf(e);
      if (s && s.length > 480) target -= ((s.length - 480) / 60) * (this.policy.overtimePay ? 2 : 6);
      if (e.energy < 30) target -= 10;
      if (e.hunger < 20) target -= 8;
      if (this.isSummer && !this.cooling) target -= 6;
      if (this.jerk > 60) target -= 5;
      if (this.cleanliness < 55) target -= (55 - this.cleanliness) / 6;
      if (this.shopCat) target += 2;
      if (e.state === 'working' || e.state === 'break') target += this.teamMoodFor(e);
      if (!this.policy.insurance) target -= 6;
      const regen = e.traits.includes('cheerful') ? TRAITS.cheerful.moodRegen : 1;
      e.mood = clamp(e.mood + (target - e.mood) * 0.004 * regen * dt, 0, 100);
    }

    thinkMaybe(e, dt) {
      e.thoughtCd -= dt;
      if (e.thoughtCd > 0) return;
      e.thoughtCd = 50 + this.rng() * 70;
      const pool = [];
      const s = this.shiftOf(e);
      if (e.energy < 35) pool.push('好累……', '想下班了', '腰好痠');
      if (e.hunger < 30) pool.push('肚子好餓', '午餐還沒吃……');
      if (s && s.length > 480 && !this.policy.overtimePay) pool.push('加班費到底有沒有……', '每天都做超過八小時');
      if (this.policy.restDays === 'none') pool.push('已經好久沒放假了');
      if (e.wage < this.marketWage * 0.95) pool.push('隔壁店薪水比較高耶', '物價漲那麼多，薪水都沒漲');
      if (this.isSummer && !this.cooling) pool.push('好熱……沒有冷氣嗎', '汗流浹背');
      if (this.customers.filter((c) => c.state === 'queue').length > 6) pool.push('客人好多！', '做不完了啦');
      if (e.mood > 75) pool.push('今天心情不錯', '老闆人很好', '這裡的同事都好好');
      if (this.beauty > 12) pool.push('店裡越來越漂亮了');
      if (this.cleanliness < 55) pool.push('地上好髒，等等來拖一下', '油垢好重……該大掃除了');
      if (!this.policy.insurance) pool.push('老闆好像沒幫我保勞健保……', '受傷了怎麼辦');
      if (this.rival && !this.rival.closed && this.rival.strength > 0.5) pool.push(`對面${this.rival.name}好多人排隊`, '對面在發傳單耶');
      if (Object.values(this.today.outWarned).some(Boolean)) pool.push('東西賣完了，客人一直問', '明天要多叫一點貨');
      const here = this.staff.filter((o) => o !== e && (o.state === 'working' || o.state === 'break'));
      const friend = here.find((o) => this.relOf(e, o) >= 40);
      const rival = here.find((o) => this.relOf(e, o) <= -30);
      if (friend) pool.push(`跟${friend.name}一起上班好開心`, `等一下跟${friend.name}去吃宵夜`);
      if (rival) pool.push(`${rival.name}今天又在擺臭臉`, `為什麼又跟${rival.name}同一班……`);
      if (this.rng() < 0.35 && Fun.STAFF_QUIPS.length) pool.push(Fun.STAFF_QUIPS[Math.floor(this.rng() * Fun.STAFF_QUIPS.length)]);
      if (!pool.length) pool.push('今天也要加油', '……', '晚餐要吃什麼呢');
      this.say(e, pool[Math.floor(this.rng() * pool.length)], 35);
    }

    // ───── 事件 ─────
    planDay() {
      this.today = this.emptyDay();
      this.pendingEvents = [];
      this.rollWeather();
      this.makeRoster();
      // 前一晚狂歡的後遺症
      for (const e of this.staff) {
        if (e.hangoverDay === this.day) {
          e.energy = Math.min(e.energy, 55);
          e.mood = clamp(e.mood - 3, 0, 100);
        }
        if (e.sickDay === this.day && this.roster.has(e.id)) {
          e.sentHomeDay = this.day;
          this.notify(`🤢 ${e.name} 宿醉，今天請病假`, 'bad');
        }
      }
      const f = this.festival;
      if (f && this.cb.festival) this.cb.festival(f);
      this.hygiene.at = null;
      for (const c of this.collabs.filter((x) => x.until < this.day)) this.notify(`🤝 跟${c.name}的聯名「${c.collab}」結束了`);
      this.collabs = this.collabs.filter((x) => x.until >= this.day);
      if (!this.openToday) return;
      this.morningOrder();
      // 衛生稽查：平常很少來，開了限期改善就一定會回來複查
      if (this.rng() < (this.hygiene.warned ? 0.35 : 0.035 * this.diff.inspect)) this.hygiene.at = this.hours.open + 60 + this.rng() * Math.max(60, this.hours.span - 150);
      if (this.weather.id === 'typhoon') {
        const ty = EVENTS.find((e) => e.id === 'typhoon');
        if (ty) this.pendingEvents.push({ ev: ty, at: this.hours.open + 20, where: 'staff' });
      }
      // 平均一天不到一件事
      const count = Math.floor((0.25 + this.rng() * 1.1) * this.diff.events + (this.mode === 'hell' ? 0.35 : 0));
      const cats = this.ind.categories;
      for (let i = 0; i < count; i++) {
        const eligible = EVENTS.filter(
          (e) =>
            !e.forced &&
            (!e.industries || e.industries.some((x) => cats.includes(x) || x === this.ind.id)) &&
            (!e.months || e.months.includes(this.monthOfYear)) &&
            (!e.cond || e.cond(this.eventCtx)) &&
            !this.usedEvents.has(e.id)
        );
        if (!eligible.length) {
          this.usedEvents.clear();
          continue;
        }
        const ev = eligible[Math.floor(this.rng() * eligible.length)];
        this.usedEvents.add(ev.id);
        const at = this.policy.open + 30 + this.rng() * Math.max(60, Math.min(this.span, 900) - 90);
        this.pendingEvents.push({ ev, at, where: ev.where || 'staff' });
      }
      // 年底的年終
      if (this.monthOfYear === 12 && this.week % WEEKS_PER_MONTH === 0 && this.weekday === 5) {
        const ye = EVENTS.find((e) => e.id === 'yearend');
        if (ye) this.pendingEvents.push({ ev: ye, at: this.policy.open + 120, where: 'staff' });
      }
      this.planSocialEvents();
      this.planCareerEvents();
      if (this.rivalNews && this.rival) {
        this.rivalNews = false;
        this.pendingEvents.push({ ev: rivalEvent(this), at: this.hours.open + 40, where: 'door' });
      }
      if (this.rivalRevenge && this.rival && !this.rival.closed && Fun.REVENGE) {
        this.rivalRevenge = false;
        const item = Fun.REVENGE[Math.floor(this.rng() * Fun.REVENGE.length)];
        this.applyRevenge(item);
        this.pendingEvents.push({ ev: this.revengeEvent(item), at: this.hours.open + 60, where: 'phone' });
      }
      if (this.rivalPoach) {
        const e = this.staff.find((x) => x.id === this.rivalPoach);
        this.rivalPoach = null;
        if (e && this.roster.has(e.id)) this.pendingEvents.push({ ev: poachEvent(this, e), at: this.hours.open + 90 + this.rng() * 120, where: 'staff', staffPref: e });
      }
      this.pendingEvents.sort((a, b) => a.at - b.at);
    }

    planSocialEvents() {
      const at = () => this.hours.open + 60 + this.rng() * Math.max(60, Math.min(this.hours.span, 600) - 120);
      for (let i = 0; i < this.staff.length; i++) {
        for (let j = i + 1; j < this.staff.length; j++) {
          const a = this.staff[i];
          const b = this.staff[j];
          const v = this.relOf(a, b);
          const both = this.roster && this.roster.has(a.id) && this.roster.has(b.id) && this.roster.get(a.id) === this.roster.get(b.id);
          if (!both) continue;
          if (v <= -35 && this.rng() < 0.3) this.pendingEvents.push({ ev: fightEvent(a, b), at: at(), where: 'staff', staffPref: a });
          const k = this.relKey(a, b);
          if (v >= 85 && a.gender !== b.gender && !this.romanced.has(k) && this.rng() < 0.2) {
            this.romanced.add(k);
            this.pendingEvents.push({ ev: loveEvent(a, b), at: at(), where: 'staff', staffPref: a });
          }
        }
      }
    }

    spawnEvent(p) {
      const working = this.staff.filter((e) => e.state === 'working' || e.state === 'break');
      if (p.where === 'staff') {
        if (!working.length) return;
        p.staff = p.staffPref && working.includes(p.staffPref) ? p.staffPref : working[Math.floor(this.rng() * working.length)];
      }
      p.spawnedAt = this.minute;
      p.deadline = this.minute + { staff: 150, phone: 50, door: 70 }[p.where];
      p.id = uid++;
      this.activeEvents.push(p);
      this.sound('alert');
      const who = { staff: `${p.staff ? p.staff.name : '員工'}好像有事找你`, phone: '☎️ 電話響了！', door: '🚪 門口有人找你' }[p.where];
      if (this.cb.event) this.cb.event(p, `${p.ev.icon} ${who}`);
    }

    resolveEffects(choice) {
      const raw = typeof choice.effects === 'function' ? choice.effects(this.eventCtx) : choice.effects || {};
      const fx = { ...raw };
      // 事件金額原本是以月為單位寫的，換算成這裡的週帳
      if (fx.cash) fx.cash = Math.round((fx.cash * 0.5) / 100) * 100;
      return fx;
    }

    applyChoice(ev, choice) {
      if (!this.activeEvents.includes(ev)) return null;
      const fx = this.resolveEffects(choice);
      const before = { cash: this.cash, morale: Math.round(this.morale), jerk: Math.round(this.jerk), staff: this.staff.length };
      if (fx.brawl) choice = { ...choice, result: this.brawl(), tip: choice.tip || Fun.BRAWL_TIP };
      if (fx.cash) {
        this.cash += fx.cash;
        this.ledger.events += fx.cash;
      }
      if (fx.morale) for (const e of this.staff) e.mood = clamp(e.mood + fx.morale * (e === ev.staff ? 1.5 : 1), 0, 100);
      if (fx.jerk) this.jerk = clamp(this.jerk + fx.jerk, 0, JERK_LIMIT);
      if (fx.staff > 0) this.addEmployee(this.makeCandidate());
      if (fx.staff < 0) {
        const who = ev.staff && this.staff.includes(ev.staff) ? ev.staff : this.staff[Math.floor(this.rng() * this.staff.length)];
        if (who) {
          this.removeEmployee(who);
          this.notify(`🚪 ${who.name} 離開了公司。`, 'bad');
        }
      }
      if (fx.wageMult) for (const e of this.staff) e.wage = Math.round(e.wage * (1 + fx.wageMult));
      if (fx.costMult) {
        for (const [k, v] of Object.entries(fx.costMult)) {
          const key = k === 'fuel' ? 'materials' : k;
          this.costMult[key] = (this.costMult[key] || 1) + (k === 'fuel' ? v * 0.2 : v);
        }
      }
      if (fx.index) for (const [k, v] of Object.entries(fx.index)) this.idx[k] *= 1 + v;
      if (fx.price) {
        for (const id of Object.keys(this.prices)) this.prices[id] = Math.round(this.prices[id] * (1 + fx.price));
      }
      if (fx.demand) this.demandMods.push({ mult: fx.demand.mult, days: fx.demand.months * 7 });
      if (fx.flag) this.flags.add(fx.flag);
      const byId = (id) => this.staff.find((x) => x.id === id);
      if (fx.promo) this.startPromo(fx.promo);
      if (fx.rivalHit && this.rival) this.rival.strength = clamp(this.rival.strength - fx.rivalHit, 0, 1);
      if (fx.raiseOf && byId(fx.raiseOf[0])) byId(fx.raiseOf[0]).wage += fx.raiseOf[1];
      if (fx.leave && byId(fx.leave)) {
        const who = byId(fx.leave);
        this.removeEmployee(who);
        this.notify(`🚪 ${who.name} 跳槽到${this.rival ? this.rival.name : '別家店'}了。`, 'bad');
      }
      if (fx.leave2 && byId(fx.leave2)) {
        const who = byId(fx.leave2);
        this.removeEmployee(who);
        this.notify(`🚪 ${who.name} 也跟著走了。`, 'bad');
      }
      if (fx.promoteOf && byId(fx.promoteOf[0])) {
        const who = byId(fx.promoteOf[0]);
        if (!this.promote(who, fx.promoteOf[1])) {
          who.askDay = this.day;
          this.notify(`🎖️ 組長名額滿了，${who.name}只能先等等。`, 'bad');
        }
      }
      if (fx.demoteOf && byId(fx.demoteOf)) this.demote(byId(fx.demoteOf));
      if (fx.askLater && byId(fx.askLater)) {
        const who = byId(fx.askLater);
        who.asks = (who.asks || 0) + 1;
        who.askDay = this.day;
      }
      if (fx.lead && byId(fx.lead[0])) byId(fx.lead[0]).lead = clamp(byId(fx.lead[0]).lead + fx.lead[1], 0, 100);
      if (fx.talkLeader && byId(fx.talkLeader)) {
        const who = byId(fx.talkLeader);
        if (this.rng() < 0.45) {
          who.style = 'warm';
          choice = { ...choice, result: `${choice.result}${who.name}沉默了一下：「我以為嚴格才是對大家好。」之後他講話溫和多了（變成🤗暖心型）。` };
        } else {
          who.lead = clamp(who.lead + 5, 0, 100);
          choice = { ...choice, result: `${choice.result}${who.name}說會注意，但個性一時改不了。至少領導力 +5。` };
        }
      }
      if (fx.rel) this.addRel(byId(fx.rel[0]), byId(fx.rel[1]), fx.rel[2]);
      if (fx.moodOf) for (const [id, d] of fx.moodOf) if (byId(id)) byId(id).mood = clamp(byId(id).mood + d, 0, 100);
      if (fx.separate) this.separate.add(fx.separate.join('-'));
      this.activeEvents = this.activeEvents.filter((x) => x !== ev);
      if (ev.karen && this.customers.includes(ev.karen)) {
        const c = ev.karen;
        if (fx.karenServe) {
          c.karen = null;
        } else {
          this.popup(c, fx.karenWin ? '😳💨' : '😤', fx.karenWin ? 'good' : 'bad');
          c.karen = null;
          this.customerLeave(c, 'done');
        }
      }
      if (fx.followers) this.social.followers = Math.max(0, this.social.followers + fx.followers);
      if (fx.viral) {
        this.demandMods.push({ mult: 1 + fx.viral, days: 4 });
        this.notify('📱 「老闆嗆奧客」的影片被路人上傳，網友狂刷「這老闆可以」！', 'achieve');
        this.achieve('karen');
      }
      if (fx.karenReview) this.addReview(1, fx.karenReview);
      if (fx.fakeReviews) for (let i = 0; i < fx.fakeReviews; i++) this.addReview(5, '老闆很帥');
      if (fx.review) this.addReview(fx.review[0], fx.review[1]);
      if (fx.grudge && this.rival) this.rival.grudge = Math.max(0, (this.rival.grudge || 0) + fx.grudge);
      if (fx.shopCat) {
        this.shopCat = true;
        this.achieve('shopcat');
      }
      const after = { cash: this.cash, morale: Math.round(this.morale), jerk: Math.round(this.jerk), staff: this.staff.length };
      const delta = Object.fromEntries(Object.keys(after).map((k) => [k, Math.round(after[k] - before[k])]));
      this.checkEnding();
      return { event: ev.ev, choice, delta };
    }

    resolve(ev, index) {
      return this.applyChoice(ev, ev.ev.choices[index]);
    }

    ignoreEvent(ev) {
      if (this.delegateEvent(ev)) return;
      const r = this.applyChoice(ev, ev.ev.ignore || IGNORE[ev.where]);
      if (r && this.cb.ignored) this.cb.ignored(r, ev);
    }

    // ───── 每日、每週、每月 ─────
    emptyLedger() {
      return { revenue: 0, materials: 0, wages: 0, labor: 0, health: 0, pension: 0, rent: 0, utilities: 0, interest: 0, tax: 0, fines: 0, cleaning: 0, welfare: 0, events: 0, branches: 0, other: 0, waste: 0 };
    }

    // 報廢（waste）只是記錄：那些食材進貨時已經付過錢了
    profitOf(L) {
      return L.revenue - L.materials - L.wages - L.labor - L.health - L.pension - L.rent - L.utilities - L.interest - L.tax - L.fines - L.cleaning - (L.welfare || 0) + L.events + L.branches + L.other;
    }

    emptyDay() {
      return { visitors: 0, served: 0, angry: 0, balked: 0, revenue: 0, delivery: 0, soldOut: 0, lowWarned: {}, outWarned: {} };
    }

    endDay() {
      const report = { day: this.day, ...this.today, wages: 0, ot: 0, insurance: 0, waste: 0 };
      const lastShift = this.hours.shifts - 1;
      // 薪水：上班時數 × 時薪，超過八小時算加班
      let unpaidOT = 0;
      const worked = new Set(this.staff.filter((e) => e.minutesToday > 0));
      for (const e of this.staff) {
        const hours = e.minutesToday / 60;
        if (hours <= 0) continue;
        const normal = Math.min(8, hours);
        const ot = Math.max(0, hours - 8);
        let pay = normal * e.wage;
        // 國定假日出勤，工資加倍
        if (this.festival && this.festival.holiday) pay *= 2;
        if (ot > 0) {
          if (this.policy.overtimePay) pay += Math.min(2, ot) * e.wage * 1.34 + Math.max(0, ot - 2) * e.wage * 1.67;
          else unpaidOT += ot;
          report.ot += ot;
        }
        // 打烊後最後一班留下來打掃半小時（照算薪水）
        if (this.policy.closingClean && this.roster && this.roster.get(e.id) === lastShift) pay += 0.5 * e.wage;
        pay = Math.round(pay);
        report.wages += pay;
        e.minutesToday = 0;
        // 心情太差連續好幾天就會離職
        e.lowMoodDays = e.mood < 22 ? e.lowMoodDays + 1 : 0;
      }
      this.cash -= report.wages;
      this.ledger.wages += report.wages;
      // 勞健保、勞退（雇主負擔）
      if (report.wages > 0) {
        if (this.policy.insurance) {
          const labor = Math.round(report.wages * INS.labor);
          const health = Math.round(report.wages * INS.health);
          const pension = Math.round(report.wages * INS.pension);
          this.ledger.labor += labor;
          this.ledger.health += health;
          this.ledger.pension += pension;
          report.insurance = labor + health + pension;
          this.cash -= report.insurance;
        } else {
          this.flags.add('noInsurance');
          this.jerk += 0.5;
        }
      }
      // 食材：隔夜報廢一部分，記下今天的用量
      for (const g of this.ind.stock || []) {
        const lost = Math.floor(this.stock[g.id] * g.spoil * this.wasteMult);
        if (lost > 0) {
          this.stock[g.id] -= lost;
          const v = Math.round(lost * this.unitCost(g));
          report.waste += v;
          this.ledger.waste += v;
        }
        this.lastUsage[g.id] = this.usage[g.id] || 0;
        this.usage[g.id] = 0;
      }
      // 清潔：油垢慢慢累積；打烊打掃會把地上的髒污清掉
      if (this.openToday) this.grime += 0.5 + report.served / 500;
      if (this.policy.closingClean) {
        this.grime -= 0.5;
        for (const e of this.staff) if (e.task && e.task.type === 'clean') e.task = null;
        this.dirt = [];
      }
      if (this.policy.cleaner) {
        this.grime -= 0.8;
        this.cash -= 900;
        this.ledger.cleaning += 900;
      }
      this.grime = clamp(this.grime, 0, 45);
      report.clean = Math.round(this.cleanliness);
      report.holiday = !!(this.festival && this.festival.holiday && report.wages > 0);

      // 房租、水電
      const rent = Math.round((this.ind.rent * this.lot.rentMult * this.costMult.rent) / 30);
      const kw = this.objects.reduce((s, o) => s + (o.def.kw || 0), 0);
      const coolKw = this.isSummer ? 0 : this.objects.filter((o) => o.def.cool).length * 2.2;
      const hours = this.openToday ? this.hours.span / 60 : 0;
      const util = Math.round((120 + (kw - coolKw) * hours * 0.6 * ECON.kwhPrice * this.idx.power * (this.isSummer ? 1.2 : 1)) * this.costMult.utilities);
      this.cash -= rent + util;
      this.ledger.rent += rent;
      this.ledger.utilities += util;
      if (this.loan > 0) {
        const interest = Math.round((this.loan * 0.02) / 30);
        this.cash -= interest;
        this.ledger.interest += interest;
      }

      // 慣老闆指數
      if (unpaidOT > 0) {
        this.jerk += unpaidOT * 0.6;
        this.flags.add('unpaidOT');
      }
      if (this.policy.restDays === 'none' && this.staff.length) {
        this.jerk += 0.8;
        this.flags.add('noRestDay');
      }
      // 自己排的休假：一週一天都沒休就是違法
      if (this.staff.some((e) => Array.isArray(e.restDays) && this.restCount(e) < 1)) {
        this.jerk += 0.6;
        this.flags.add('noRestDay');
      }
      if (!this.policy.breaks && this.staff.length) {
        this.jerk += 0.8;
        this.flags.add('noBreak');
      }
      if (!this.restSpots().length && this.staff.length) this.jerk += 0.3;
      if (this.realWage < 0.95) this.jerk += 0.4;
      this.jerk = clamp(this.jerk - 0.6, 0, JERK_LIMIT);

      // 離職
      for (const e of [...this.staff]) {
        if (e.lowMoodDays >= 3) {
          this.removeEmployee(e);
          this.jerk = clamp(this.jerk + 2, 0, JERK_LIMIT);
          this.notify(`😞 ${e.name} 遞了辭呈：「這裡真的待不下去了。」`, 'bad');
        }
      }

      this.careerDayEnd(worked);
      if (report.served >= 150) this.achieve('busy');
      if (this.day === 1) this.achieve('open');
      if (this.staff.length >= 3 && this.staff.every((e) => e.mood > 70)) this.achieve('happy');

      this.demandMods.forEach((d) => (d.days -= 1));
      this.demandMods = this.demandMods.filter((d) => d.days > 0);
      this.lastDay = report;
      if (this.cb.dayEnd) this.cb.dayEnd(report);

      const weekEnd = this.day % DAYS_PER_WEEK === 0;
      this.day += 1;
      this.lockHours();
      this.minute = this.dayStart;
      for (const ev of [...this.activeEvents]) this.ignoreEvent(ev);
      if (weekEnd) this.endWeek();
      if (this.over) return;
      this.planDay();
    }

    endWeek() {
      const L = this.ledger;
      if (this.branches.length) {
        L.branches = this.branchWeekly();
        this.cash += L.branches;
      }
      // 營業稅
      const tax = this.businessTax(L);
      L.tax += tax;
      this.cash -= tax;

      // 勞動檢查
      let inspection = null;
      if (this.rng() < (0.05 + this.jerk / 250) * this.diff.inspect) {
        const v = [...this.flags].filter((f) => VIOLATIONS[f]);
        const fine = Math.round(v.reduce((s, f) => s + VIOLATIONS[f].fine, 0) * 0.6 * this.diff.fines);
        inspection = { violations: v.map((f) => VIOLATIONS[f].label), fine };
        if (v.length) {
          this.cash -= fine;
          L.fines += fine;
          this.jerk = clamp(this.jerk + 5, 0, JERK_LIMIT);
        } else this.jerk = clamp(this.jerk - 3, 0, JERK_LIMIT);
      }
      const profit = this.profitOf(L);
      const h = this.hygiene.last;
      const report = { week: this.week - 1 || 1, ...L, profit, rating: this.rating, morale: this.morale, jerk: this.jerk, inspection, news: [], taxStatus: this.taxStatus, clean: Math.round(this.cleanliness), hygiene: h && this.day - h.day <= 7 ? h : null };
      this.flags.clear();
      this.cleanWeeks = this.jerk < 15 ? this.cleanWeeks + 1 : 0;
      if (this.cleanWeeks >= 4) this.achieve('saint');
      if (L.revenue >= 200000) this.achieve('revenue');

      // 新的一週，新的時事
      this.rollTrend();
      if (Fun.HEADLINES.length) {
        const hl = [...Fun.HEADLINES].sort(() => this.rng() - 0.5).slice(0, 2);
        report.headlines = hl;
        this.headlines = hl;
      }
      report.followers = this.social.followers;

      // 對面的店
      this.rivalWeekly();
      this.maybeRival();
      if (this.rival) report.rival = { name: this.rival.name, strength: this.rival.strength, closed: this.rival.closed };

      // 年度好店評選：每年 12 月最後一週結束時
      this.yearProfit += profit;
      const endedWeek = this.week - 1;
      const endedMonthOfYear = ((Math.ceil(endedWeek / WEEKS_PER_MONTH) - 1) % 12) + 1;
      if (endedMonthOfYear === 12 && endedWeek % WEEKS_PER_MONTH === 0) report.award = this.yearAward();

      // 每四週是一個月：物價、油價、電價
      if ((this.week - 1) % WEEKS_PER_MONTH === 0) report.news = this.advanceEconomy();
      this.history.push(report);
      this.ledger = this.emptyLedger();
      this.candidates = this.rollCandidates();
      this.lastWeek = report;
      this.checkEnding(true);
      // 通關：撐滿一年（48 週）
      if (!this.over && !this.wonYear && this.week - 1 >= 48) {
        this.wonYear = true;
        report.victory = this.victory();
        this.achieve('year');
      }
      if (this.cb.weekEnd) this.cb.weekEnd(report);
    }

    // 營業稅：小規模營業人 1%，營業額大了就要開發票，稅率 5%（銷項減進項）
    businessTax(L) {
      const recent = [...this.history.slice(-3).map((h) => h.revenue), L.revenue];
      const monthly = (recent.reduce((a, b) => a + b, 0) / recent.length) * 4;
      const threshold = ['barber', 'scooter'].includes(this.ind.id) ? 50000 : 100000;
      const status = monthly < threshold ? 'exempt' : monthly < 200000 ? 'small' : 'vat';
      if (status !== this.taxStatus) {
        if (this.taxStatus) this.notify(`🧾 國稅局通知：${TAX_LABEL[status]}`, status === 'vat' ? 'event' : '');
        this.taxStatus = status;
      }
      if (status === 'exempt') return 0;
      if (status === 'small') return Math.round(L.revenue * 0.01);
      return Math.max(0, Math.round(((L.revenue - L.materials - L.utilities) * 5) / 105));
    }

    advanceEconomy() {
      const news = [];
      const rng = this.rng;
      this.idx.cpi *= 1 + ECON.cpiDrift + (rng() * 2 - 1) * ECON.cpiNoise;
      this.idx.wage *= 1 + ECON.wageDrift;
      const oilBefore = this.idx.oil;
      this.idx.oil = clamp(this.idx.oil * (1 + ECON.oilDrift + (rng() * 2 - 1) * ECON.oilNoise), 0.7, 1.8);
      const gas = (this.idx.oil - oilBefore) * ECON.gasPrice;
      if (Math.abs(gas) >= 0.3) news.push(`⛽ 國際油價${gas > 0 ? '上漲' : '回落'}，中油這個月累計${gas > 0 ? '調漲' : '調降'}汽油每公升 ${Math.abs(gas).toFixed(1)} 元。`);
      const m = this.monthOfYear;
      if (ECON.powerMonths.includes(m)) {
        const st = ECON.powerSteps[Math.floor(rng() * ECON.powerSteps.length)];
        this.idx.power *= 1 + st;
        news.push(st ? `⚡ 電價審議會決議：電價平均調漲 ${(st * 100).toFixed(0)}%。` : '⚡ 電價審議會決議：本期電價凍漲。');
      }
      if (m === ECON.summerMonths[0]) news.push('☀️ 夏天到了，夏月電價開始；沒有冷氣，客人和員工都會受不了。');
      if (m === 10) news.push('🍂 夏月電價結束。');
      news.push(`📈 物價比開店時上漲 ${((this.idx.cpi - 1) * 100).toFixed(1)}%，市場時薪約 $${this.marketWage}。`);
      this.news = news;
      return news;
    }

    yearAward() {
      const year = this.awards.length + 1;
      const score = Math.round(this.rating * 12 + (100 - this.jerk) * 0.25 + this.morale * 0.15 + clamp(this.yearProfit / 60000, -10, 15));
      let a;
      if (this.jerk >= 60) a = { title: '網友票選年度慣老闆', medal: '💩', reward: 0, desc: '你的店被網友票選為「年度慣老闆」，截圖在 Threads 上被轉了三千次。' };
      else if (score >= 85) a = { title: '年度好店金獎', medal: '🥇', reward: 200000, desc: '評審說：「這是一間客人和員工都捨不得離開的店。」' };
      else if (score >= 75) a = { title: '年度好店銀獎', medal: '🥈', reward: 100000, desc: '評審特別提到你們的服務和員工的笑容。' };
      else if (score >= 65) a = { title: '年度好店銅獎', medal: '🥉', reward: 50000, desc: '穩穩經營了一年，得到在地人的肯定。' };
      else a = { title: '年度好店入圍', medal: '🎗️', reward: 0, desc: '這次沒有得獎，明年再加油。' };
      const award = { year, score, ...a };
      this.awards.push(award);
      if (a.reward) {
        this.cash += a.reward;
        this.ledger.other += a.reward;
      }
      if (a.medal === '🥇') this.achieve('gold');
      this.yearProfit = 0;
      return award;
    }

    // 一年的總評：評價、慣老闆指數、員工心情、現金、分店、獎項
    victory() {
      const hist = this.history.slice(-48);
      const profit = hist.reduce((a, h) => a + h.profit, 0);
      const parts = [
        ['評價', Math.round(clamp((this.rating - 3) * 25, 0, 50)), `${this.rating.toFixed(1)} ★`],
        ['不當慣老闆', Math.round(clamp((60 - this.jerk) / 2, 0, 30)), `慣老闆指數 ${Math.round(this.jerk)}`],
        ['員工心情', Math.round(clamp((this.morale - 40) / 2, 0, 25)), `平均 ${Math.round(this.morale)}`],
        ['一年淨利', Math.round(clamp(profit / 40000, -10, 30)), `$${Math.round(profit).toLocaleString()}`],
        ['分店', Math.min(15, this.branches.length * 5), `${this.branches.length} 間`],
        ['獎項', this.awards.some((a) => a.medal === '🥇') ? 15 : this.awards.some((a) => a.reward) ? 8 : 0, this.awards.map((a) => a.medal).join(' ') || '—'],
      ];
      const score = parts.reduce((a, p) => a + p[1], 0);
      const grade = score >= 120 ? { medal: '🥇', title: '傳說中的佛心老闆' } : score >= 85 ? { medal: '🥈', title: '員工捨不得走的好老闆' } : score >= 50 ? { medal: '🥉', title: '撐過一年的努力老闆' } : { medal: '🎗️', title: '勉強撐過一年' };
      const v = { score, parts, profit, ...grade, mode: this.mode, ind: this.ind.name, day: this.day };
      this.victoryInfo = v;
      return v;
    }

    borrow(amount) {
      const max = 600000;
      const can = Math.min(amount, max - this.loan);
      if (can <= 0) return 0;
      this.loan += can;
      this.cash += can;
      this.notify(`🏦 向銀行借了 $${can.toLocaleString()}（月息 2%）。`);
      return can;
    }

    repay(amount) {
      const pay = Math.min(amount, this.loan, Math.max(0, this.cash));
      this.loan -= pay;
      this.cash -= pay;
      return pay;
    }

    checkEnding(weekEnd = false) {
      if (this.over) return;
      if (this.jerk >= JERK_LIMIT) {
        this.over = true;
        this.ending = {
          type: 'jerk',
          title: '你成了慣老闆',
          desc: `〈${this.shopName}老闆語錄曝光！網友：根本慣老闆本人〉你的店上了新聞，員工集體出走，勞工局也找上門了。`,
        };
      } else if (weekEnd && this.cash < 0 && this.loan >= 600000) {
        this.over = true;
        this.ending = { type: 'bankrupt', title: '店收起來了', desc: '銀行不肯再借錢，帳戶也見底了。鐵門拉下的那天，常客在門口貼了一張紙條：「謝謝你們。」' };
      }
    }

    // ───── 存檔 ─────
    serialize() {
      const strip = (e) => ({ ...e, task: null, path: [], x: e.x, z: e.z });
      return JSON.stringify({
        v: 1,
        ind: this.ind.id,
        shopName: this.shopName,
        mode: this.mode,
        lotIdx: this.lotIdx,
        objects: this.objects.map((o) => [o.type, o.x, o.z, o.rot]),
        day: this.day,
        cash: this.cash,
        loan: this.loan,
        jerk: this.jerk,
        reviews: this.reviews.slice(-60),
        staff: this.staff.map((e) => ({ ...strip(e), state: 'off' })),
        prices: this.prices,
        menu: this.menu,
        policy: this.policy,
        idx: this.idx,
        costMult: this.costMult,
        history: this.history.slice(-20),
        achievements: [...this.achievements],
        cleanWeeks: this.cleanWeeks,
        rel: this.rel,
        separate: [...this.separate],
        xp: this.xp,
        branches: this.branches,
        awards: this.awards,
        yearProfit: this.yearProfit,
        stock: this.stock,
        par: this.par,
        lastUsage: this.lastUsage,
        incoming: Object.fromEntries((this.ind.stock || []).map((g) => [g.id, this.incoming(g.id)])),
        grime: this.grime,
        dirt: this.dirt.map((d) => ({ ...d, by: null })),
        hygiene: { warned: this.hygiene.warned, last: this.hygiene.last, badge: this.hygiene.badge },
        rival: this.rival,
        promo: this.promo,
        loyalty: this.loyalty,
        taxStatus: this.taxStatus,
        recipes: [...this.recipes],
        style: this.style,
        ownedFloors: [...this.ownedFloors],
        social: this.social,
        shopCat: !!this.shopCat,
        collabs: this.collabs,
        copiedDish: !!this.copiedDish,
        schemes: this.schemes,
        wonYear: !!this.wonYear,
      });
    }

    static load(json, opts) {
      const d = JSON.parse(json);
      const s = new Sim(d.ind, { ...opts, shopName: d.shopName, mode: d.mode });
      s.objects = [];
      s.setLot(d.lotIdx);
      for (const [t, x, z, r] of d.objects) s.place(t, x, z, r, true);
      Object.assign(s, { day: d.day, cash: d.cash, loan: d.loan, jerk: d.jerk, reviews: d.reviews, prices: d.prices, menu: d.menu, policy: { ...s.policy, ...d.policy }, idx: d.idx, costMult: d.costMult, history: d.history, cleanWeeks: d.cleanWeeks || 0 });
      if (d.stock) {
        for (const g of s.ind.stock) {
          s.stock[g.id] = (d.stock[g.id] ?? s.stock[g.id]) + ((d.incoming && d.incoming[g.id]) || 0);
          s.par[g.id] = d.par[g.id] ?? s.par[g.id];
        }
        s.lastUsage = d.lastUsage || {};
      }
      s.grime = d.grime || 0;
      s.dirt = d.dirt || [];
      s.hygiene = { at: null, warned: false, last: null, ...(d.hygiene || {}) };
      s.rival = d.rival || null;
      s.promo = d.promo || null;
      s.loyalty = !!d.loyalty;
      s.taxStatus = d.taxStatus || null;
      s.recipes = new Set(d.recipes || []);
      for (const p of s.ind.products) if (p.rd && !(p.id in d.menu)) s.menu[p.id] = s.recipes.has(p.id);
      for (const p of s.ind.products) if (!(p.id in s.prices)) s.prices[p.id] = p.price;
      s.style = { floor: 'default', wall: null, sign: null, ...(d.style || {}) };
      s.ownedFloors = new Set(d.ownedFloors || ['default']);
      if (d.social) s.social = { ...s.social, ...d.social };
      s.shopCat = !!d.shopCat;
      s.collabs = d.collabs || [];
      s.copiedDish = !!d.copiedDish;
      s.schemes = d.schemes || 0;
      s.wonYear = !!d.wonYear;
      s.achievements = new Set(d.achievements);
      s.rel = d.rel || {};
      s.xp = d.xp || 0;
      s.branches = (d.branches || []).map((b) => ({ revenue: 0, wage: 'market', price: 'normal', staff: s.branchNeed, morale: 65, rating: 3.8, reno: 0, hist: [], size: 'medium', ...b }));
      s.awards = d.awards || [];
      s.yearProfit = d.yearProfit || 0;
      s.separate = new Set(d.separate || []);
      s.staff = d.staff.map((e) => ({ shiftPref: 'auto', restDays: null, post: null, ...e, task: null, path: [], state: 'off', x: -OUT_W, z: s.H }));
      for (const e of s.staff) s.ensureCareer(e);
      s.minute = s.dayStart;
      s.customers = [];
      s.candidates = s.rollCandidates();
      s.deliveries = [];
      s.planDay();
      return s;
    }
  }

  const WEATHER = {
    sunny: { id: 'sunny', name: '晴天', icon: '☀️', walk: 1, delivery: 1 },
    hot: { id: 'hot', name: '炎熱', icon: '🥵', walk: 0.95, delivery: 1.2 },
    cloudy: { id: 'cloudy', name: '陰天', icon: '☁️', walk: 0.95, delivery: 1.05 },
    cold: { id: 'cold', name: '寒流', icon: '🥶', walk: 0.85, delivery: 1.4 },
    rain: { id: 'rain', name: '下雨', icon: '🌧️', walk: 0.72, delivery: 1.8 },
    typhoon: { id: 'typhoon', name: '颱風', icon: '🌀', walk: 0.3, delivery: 0.6 },
  };

  // 節慶：月份、第幾週、週幾（0 = 週一）
  const FESTIVALS = [
    { id: 'precny', name: '過年前', icon: '🏮', month: 1, week: 4, mult: { barber: 1.8, scooter: 1.4, store: 1.15 }, news: '🏮 過年前大家都要剪頭髮、保養機車準備返鄉。' },
    { id: 'cny', name: '春節連假', icon: '🧧', month: 2, week: 1, days: [0, 1, 2, 3, 4], holiday: true, mult: { breakfast: 0.6, noodle: 0.7, drinks: 0.8, barber: 0.4, scooter: 0.5, store: 1.35 }, news: '🧧 春節連假！國定假日出勤工資要加倍；很多人回老家，街上比較冷清。' },
    { id: 'mother', name: '母親節', icon: '💐', month: 5, week: 2, days: [5, 6], mult: { barber: 1.5, noodle: 1.25, breakfast: 1.1, all: 1.1 }, news: '💐 母親節週末，帶媽媽出門的人變多了。' },
    { id: 'dragon', name: '端午節', icon: '🐉', month: 6, week: 2, days: [4], holiday: true, mult: { all: 1.1, store: 1.2 }, news: '🐉 端午節國定假日，出勤工資加倍。' },
    { id: 'ghost', name: '中元普渡', icon: '🏮', month: 8, week: 3, mult: { store: 1.25, all: 1 }, news: '🏮 中元普渡，家家戶戶都在買供品。' },
    { id: 'school', name: '開學季', icon: '🎒', month: 9, week: 1, mult: { breakfast: 1.25, drinks: 1.15, store: 1.1, barber: 1.2 }, news: '🎒 開學了，早上學生多了不少。' },
    { id: 'moon', name: '中秋烤肉', icon: '🥮', month: 9, week: 3, days: [4, 5, 6], holiday: true, mult: { store: 1.4, drinks: 1.15, all: 0.95 }, news: '🥮 中秋節，大家都在烤肉；國定假日出勤工資加倍。' },
    { id: 'nye', name: '跨年', icon: '🎆', month: 12, week: 4, days: [6], mult: { drinks: 1.25, store: 1.35, all: 1.05 }, news: '🎆 跨年夜，街上整晚都是人。' },
  ];

  // 人際關係事件
  function fightEvent(a, b) {
    const ids = [a.id, b.id];
    return {
      id: 'rel_fight',
      icon: '💢',
      title: `${a.name}跟${b.name}吵架了`,
      text: `${a.name}和${b.name}為了誰該去洗碗、誰又偷懶吵了起來，整間店的氣氛都很僵，客人也在看。`,
      choices: [
        { label: '把兩個人找來，私下調解', effects: { rel: [...ids, 30], moodOf: [[a.id, 4], [b.id, 4]], jerk: -1 }, result: '你泡了兩杯茶讓他們把話說開，最後兩個人都笑了出來。' },
        { label: '把他們排到不同班', note: '之後盡量不排同一班', effects: { rel: [...ids, 5], separate: ids }, result: '眼不見為淨，至少店裡的氣氛恢復正常了。' },
        {
          label: '「吵什麼吵，都給我閉嘴做事！」',
          quote: '上班是來工作的，不是來交朋友的。',
          effects: { rel: [...ids, -15], moodOf: [[a.id, -10], [b.id, -10]], jerk: 5 },
          result: '兩個人都不吭聲了，但下班後各自在群組裡抱怨了一個小時。',
        },
      ],
      ignore: { effects: { rel: [...ids, -10], moodOf: [[a.id, -5], [b.id, -5]] }, result: '你假裝沒看到，兩個人冷戰了一整天。' },
    };
  }

  function loveEvent(a, b) {
    return {
      id: 'rel_love',
      icon: '💕',
      title: `${a.name}和${b.name}好像在交往`,
      text: `大家發現${a.name}和${b.name}下班都一起走，休息時間也坐在一起。店裡開始傳八卦了。`,
      choices: [
        { label: '祝福他們，私事不干涉', effects: { moodOf: [[a.id, 8], [b.id, 8]], morale: 1, jerk: -1 }, result: '兩個人有點害羞地道謝，上班的心情好到都在哼歌。' },
        { label: '提醒上班時間要專心', effects: { moodOf: [[a.id, -1], [b.id, -1]] }, result: '他們點點頭，上班時更專心了。' },
        {
          label: '「禁止辦公室戀愛，不然一個人走」',
          quote: '店裡不是讓你們談戀愛的地方。',
          effects: { moodOf: [[a.id, -18], [b.id, -18]], jerk: 8 },
          result: '兩個人臉色都變了。隔天，他們開始一起在網路上找新工作。',
          tip: '員工交往不是勞基法允許的解僱事由；以此逼迫離職或給予不利對待，可能構成違法解僱。',
        },
      ],
    };
  }

  // 奧客上門：老闆可以親自下場嘴砲對決
  function karenEvent(sim, k, victim) {
    const v = victim ? victim.name : '店員';
    return {
      id: 'karen_' + k.id,
      icon: k.icon,
      title: `奧客上門：${k.name}`,
      text: `「${k.rounds[0].line}」${k.name}在櫃檯前大聲嚷嚷，${v}的笑容快撐不住了，排隊的客人都拿出手機在錄。`,
      speaker: { look: 'karen', name: k.name },
      choices: [
        {
          label: '🎤 老闆出面，嗆回去',
          note: '嘴砲對決：三回合',
          minigame: { type: 'roast', karen: k.id, title: `奧客擂台：${k.name}` },
          effects: victim ? { karenWin: true, morale: 6, jerk: -2, viral: 0.15, followers: 800, moodOf: [[victim.id, 10]] } : { karenWin: true, morale: 6, jerk: -2, viral: 0.15, followers: 800 },
          result: `全店爆笑，${k.name}臉一陣青一陣白，丟下一句「我會再來的」就走了。${v}偷偷跟你比讚。`,
          fail: { effects: { morale: 2, karenReview: '老闆態度超差，還嗆客人' }, result: `你一時語塞，${k.name}得意地走了，還留了一星。但員工很感謝你有站出來。` },
        },
        { label: '👊 物理超度', quote: '今天不是你走，就是我請你走。', note: '結果看運氣', effects: { brawl: true, karenWin: true }, result: '' },
        { label: '送一份小菜，息事寧人', effects: victim ? { cash: -500, karenServe: true, moodOf: [[victim.id, -3]] } : { cash: -500, karenServe: true }, result: `${k.name}心滿意足地坐下，${v}小聲說：「又被吃夠夠了。」` },
        { label: '站在員工這邊，請他離開', effects: victim ? { morale: 4, jerk: -1, karenReview: '店員態度差，還被趕出來', moodOf: [[victim.id, 8]] } : { morale: 4, jerk: -1 }, result: `你冷靜地請${k.name}離開，${v}鬆了一口氣。` },
        {
          label: '「客人永遠是對的，你去道歉」',
          quote: '客人是衣食父母，忍一下會死喔？',
          effects: victim ? { jerk: 5, karenServe: true, moodOf: [[victim.id, -15]] } : { jerk: 5, karenServe: true },
          result: `${v}低頭道歉，${k.name}還是不滿意。下班後${v}在員工群組傳了一個「累」的貼圖。`,
          tip: '雇主有義務防範員工在工作中遭受顧客的不法侵害，職業安全衛生法也要求預防職場暴力。',
        },
      ],
      ignore: { effects: victim ? { karenReview: '店員很慢，奧客都沒人處理', moodOf: [[victim.id, -8]] } : {}, result: `${k.name}罵完自己走了，留下滿臉通紅的${v}。` },
    };
  }

  // 隔壁開了競爭對手
  function rivalEvent(sim) {
    const r = sim.rival;
    return {
      id: 'rival_open',
      icon: '🏪',
      title: `對面開了一間「${r.name}」`,
      text: `對面的「${r.name}」今天開幕，門口排著花籃，喇叭放著「開幕優惠，買一送一」。你的常客也忍不住過去看了一眼。`,
      speaker: { look: 'rivalboss', name: `${r.name}老闆` },
      choices: [
        { label: '專心把品質做好，不跟著削價', effects: {}, result: '你跟大家說：「做好我們自己的就好。」員工點點頭，繼續忙。', tip: '價格戰很傷：評價、乾淨程度、合理的價格，都會影響對手搶走多少客人。' },
        { label: '辦一週九折優惠，跟他拚了', note: '全品項 9 折 7 天', effects: { promo: 7 }, result: '你在門口貼上「全品項九折」，路過的人多看了兩眼。' },
        { label: '過去打個招呼，送一份自家的招牌', effects: { morale: 1, jerk: -1 }, result: '對面老闆有點意外，笑著說以後大家互相照顧。' },
        {
          label: '上網匿名留一星負評',
          quote: '……反正沒人知道是我。',
          effects: { rivalHit: 0.15, jerk: 6 },
          result: '對面的評價掉了一點。但你半夜睡不著，總覺得哪天會被肉搜出來。',
          tip: '用不實內容攻擊同業，可能違反公平交易法（妨害他事業營業信譽），也可能觸犯刑法的誹謗罪。',
        },
      ],
      ignore: { effects: {}, result: '你忙到沒空理對面開幕。' },
    };
  }

  // 對面開更高時薪挖角
  function poachEvent(sim, e) {
    const r = sim.rival;
    const name = r ? r.name : '別家店';
    return {
      id: 'rival_poach',
      icon: '🧲',
      title: `${e.name}被${name}挖角`,
      text: `${name}開出比你高 $25 的時薪，${e.name}有點心動，跑來問你怎麼辦。`,
      choices: [
        { label: '幫他加薪 $25，留下來', effects: { raiseOf: [e.id, 25], moodOf: [[e.id, 8]] }, result: `${e.name}鬆了一口氣：「謝謝老闆，我會繼續努力的！」` },
        { label: '尊重他的決定，祝他順利', effects: { leave: e.id, jerk: -1 }, result: `${e.name}有點感動，說有空會回來看大家。` },
        {
          label: '「你敢走我就告你違反競業條款！」',
          quote: '當初你可是簽了約的。',
          effects: { leave: e.id, jerk: 6 },
          result: `${e.name}臉色一沉，隔天就沒來上班了，還把對話截圖傳到員工群組。`,
          tip: '依勞基法第 9-1 條，競業禁止要有書面約定、合理補償、限制期間不超過兩年等要件；一般基層員工通常不適用，也不能拿來威脅員工不准離職。',
        },
      ],
      ignore: { effects: { leave: e.id }, result: `你沒回應，${e.name}默默遞了辭呈。` },
    };
  }

  const ACHIEVEMENTS = [
    { id: 'open', name: '開張大吉', desc: '撐過第一天', reward: 5000 },
    { id: 'busy', name: '人氣名店', desc: '單日服務 150 位客人', reward: 30000 },
    { id: 'rating', name: '口碑店家', desc: '評價 4.5 星以上（至少 30 則）', reward: 40000 },
    { id: 'happy', name: '大家都喜歡這裡', desc: '3 人以上而且全員心情超過 70', reward: 20000 },
    { id: 'saint', name: '佛心老闆', desc: '連續 4 週慣老闆指數低於 15', reward: 50000 },
    { id: 'revenue', name: '週營收破 20 萬', desc: '單週營收超過 $200,000', reward: 50000 },
    { id: 'medium', name: '擴店！', desc: '升級成中店面', reward: 20000 },
    { id: 'large', name: '在地名店', desc: '升級成大店面', reward: 60000 },
    { id: 'chain', name: '連鎖品牌', desc: '開了 3 間分店', reward: 100000 },
    { id: 'gold', name: '年度好店金獎', desc: '在年度評選拿到金獎', reward: 0 },
    { id: 'hygiene', name: '衛生優良', desc: '衛生稽查拿到「優」', reward: 20000 },
    { id: 'viral', name: '小編爆紅', desc: '發了一篇爆紅的貼文', reward: 15000 },
    { id: 'year', name: '破關：撐過一年', desc: '經營滿 48 週沒有被收店', reward: 100000 },
    { id: 'schemer', name: '這條街的陰謀家', desc: '執行 3 次陰謀計畫', reward: 0 },
    { id: 'collab', name: '聯名達人', desc: '談成一次聯名合作', reward: 10000 },
    { id: 'shopcat', name: '店長是貓', desc: '收養一隻店貓', reward: 5000 },
    { id: 'karen', name: '奧客剋星', desc: '在奧客擂台嗆贏奧客，影片爆紅', reward: 15000 },
    { id: 'rival', name: '隔壁收攤了', desc: '撐過競爭，讓隔壁的對手收起來', reward: 40000 },
  ];

  VIOLATIONS.noRestDay = VIOLATIONS.noRestDay || { label: '未依法排休（七休一）', fine: 60000 };
  VIOLATIONS.noBreak = VIOLATIONS.noBreak || { label: '未給予休息時間', fine: 40000 };
  VIOLATIONS.noInsurance = VIOLATIONS.noInsurance || { label: '未依法為員工投保勞健保、提繳勞退', fine: 50000 };

  root.BossSim = { Sim, CATALOG, catalogById, ACHIEVEMENTS, ECON, DAY, OUT_W, STREET, MIN_WAGE, WEEKDAYS, WEATHER, FESTIVALS, INS, INS_TOTAL, TAX_LABEL, CUSTOMER_TYPES, local };
})(typeof window !== 'undefined' ? window : globalThis);
