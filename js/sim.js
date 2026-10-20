// 開店模擬核心：店面格子、客人與員工的自主行為、營業時間與班表、財務、事件
// 不碰 DOM，可以在 Node 裡跑
(function (root) {
  const { DECOR_THEMES, SIDE_BIZ, SIDE_CLASH, fillWords, applyNames, FOOD_IND, INDUSTRIES, CATALOG, LOTS, NAMES, TRAITS, LEVELS, DISTRICTS, DISTRICT_INFO, CUSTOMER_TYPES, DIFFICULTY, FLOORS, WALLS, SIGNS, BRANCH_SITES, BRANCH_SIZES, TOURIST_PREF } = root.BossIndustries;
  const { EVENTS, IGNORE, VIOLATIONS } = root.BossData;
  const Looks = root.BossLooks;
  const Fun = root.BossFun || { KARENS: [], TRENDS: [], POST_HOOKS: [], POST_BODIES: [], POST_ENDINGS: [], COMMENTS: {}, HEADLINES: [], STAFF_QUIPS: [], FUNNY_REVIEWS: { good: [], bad: [] } };

  // 週報只保留最近半年（遊戲時間）
  const HISTORY_WEEKS = 26;
  // 評論、事件紀錄只保留最近三個月
  const RECORD_DAYS = 90;
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
      applyNames(ind.id);
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
        helper: !!this.diff.helper, // 🤖 經營小幫手
        auth: { complaint: 'off', karen: 'off', fight: 'off', branch: 'off', misc: 'off', budget: 5000 }, // 📋 授權制度
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
      this.owner = Sim.ownerDefaults(); // 老闆個人的錢（領分紅才會進來）和人生狀態，跟公司分開
      this.rooms = { storage: 0, rest: 0, office: 0, toilet: 0 }; // 後場的房間等級
      this.pets = []; // 店寵
      this.toiletClean = 100;
      this.progress = { chapter: 0, done: [], chapters: [], features: [], route: null, ended: false };
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
      for (let i = 0; i < ind.starterStaff + (this.diff.extraStaff || 0); i++) this.addEmployee(this.makeCandidate(i === 0 ? 'veteran' : null), true);
      this.candidates = this.rollCandidates();
      // 小幫手開著：開店前先把班表和休息區弄好
      if (this.policy.helper) {
        if (this.hours.span > 9 * 60) this.policy.shifts = 2;
        if (!this.restSpots().length) this.autoPlace('breaktable');
      }
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
      return this.policy.closedDay !== this.weekday && this.shutDay !== this.day;
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
      let recent = this.reviews.slice(-100);
      // Lv.21：老客人會幫你說話，最低的 5 則一星不算
      if (this.level >= 21 && recent.length > 40) {
        let drop = 5;
        recent = recent.filter((r) => !(r.stars <= 1 && drop-- > 0));
      }
      const avg = recent.reduce((s, r) => s + r.stars, 0) / recent.length;
      return Math.min(5, avg + (this.level >= 25 ? 0.1 : 0) + (this.level >= 40 ? 0.1 : 0));
    }
    get beauty() {
      return this.objects.reduce((s, o) => s + (o.def.beauty || 0), 0);
    }

    // ───── 🎨 裝潢：美觀分（會隨時間變舊）、主題風格、流行 ─────
    // 每天或家具變動時重算一次
    get decor() {
      const key = `${this.day}|${this.objects.length}|${this.styleVer || 0}|${this.decorTrend ? this.decorTrend.theme : ''}`;
      if (this._decor && this._decorKey === key) return this._decor;
      const counts = {};
      const themeB = {};
      let A = 0;
      let total = 0;
      for (const o of this.objects) {
        const b = o.def.beauty || 0;
        if (!b) continue;
        const age = this.day - (o.bought ?? this.day);
        const fresh = 1 - Math.min(0.35, age / 960);
        const hot = this.decorTrend && o.def.theme === this.decorTrend.theme && this.decorTrend.until >= this.day ? 1.25 : 1;
        const v = b * fresh * hot;
        A += v;
        total += b;
        if (o.def.theme) {
          counts[o.def.theme] = (counts[o.def.theme] || 0) + 1;
          themeB[o.def.theme] = (themeB[o.def.theme] || 0) + v;
        }
      }
      // 主題：同一種風格至少 3 件、而且佔一半以上的美觀分
      const sorted = Object.entries(themeB).sort((a, b) => b[1] - a[1]);
      let theme = null;
      if (sorted.length && counts[sorted[0][0]] >= 3 && sorted[0][1] >= A * 0.5) theme = sorted[0][0];
      // 兩種風格都很多又都不夠突出：看起來很亂
      const mixed = !theme && sorted.filter(([k]) => counts[k] >= 3).length >= 2;
      if (mixed) A *= 0.9;
      const fresh = total ? A / total : 1;
      this._decor = { A, theme, mixed, counts, fresh };
      this._decorKey = key;
      return this._decor;
    }

    get themeInfo() {
      const t = this.decor.theme;
      return t ? DECOR_THEMES[t] : null;
    }

    // 店裡漂亮：客人對價格沒那麼敏感（0～約 40%）
    get priceTolerance() {
      const A = this.decor.A;
      return 0.35 * (1 - Math.exp(-A / 40)) + (this.decor.theme === 'artsy' ? 0.05 : 0);
    }

    // 翻新：把所有裝潢整理一遍，舊了的感覺消失
    get refreshCost() {
      const v = this.objects.filter((o) => o.def.beauty).reduce((t, o) => t + o.def.price, 0);
      return Math.round((v * 0.2) / 1000) * 1000;
    }

    refreshDecor() {
      const cost = this.refreshCost;
      if (!cost || this.cash < cost) return false;
      this.cash -= cost;
      this.ledger.other -= cost;
      for (const o of this.objects) if (o.def.beauty) o.bought = this.day;
      this._decor = null;
      this.notify('🎨 店裡重新翻修過一遍，看起來像新開的一樣！', 'good');
      return true;
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
    get levelTitle() {
      return Fun.levelTitle ? Fun.levelTitle(this.level) : '';
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
        // 一次跳好幾級（章節獎勵）也要把每一級的東西都列出來
        const items = [];
        let title = null;
        for (let lv = before + 1; lv <= after; lv++) {
          items.push(...CATALOG.filter((d) => d.lv === lv && (!d.industries || d.industries.includes(this.ind.id))).map((d) => `${d.icon} ${d.name}`));
          const lot = LOTS.find((l) => l.lv === lv);
          if (lot) items.push(`🏗️ 擴建${lot.name}`);
          if (lv === 5) items.push(this.feature('branch') ? '🏙️ 開分店' : '🏙️ 開分店（完成第二章後）');
          if (Fun.LEVEL_PERKS && Fun.LEVEL_PERKS[lv]) items.push(`✨ ${Fun.LEVEL_PERKS[lv]}`);
          if (Fun.LEVEL_TITLES && Fun.LEVEL_TITLES[lv]) title = Fun.LEVEL_TITLES[lv];
        }
        // 換稱號：店裡辦個小慶功，大家心情好一點
        if (title) {
          for (const e of this.staff) {
            e.mood = clamp(e.mood + 5, 0, 100);
            if (e.state === 'working') this.say(e, ['升級了！🎉', `我們是「${title}」了！`, '老闆請喝飲料嗎？', '感覺被認可了！'][Math.floor(this.rng() * 4)], 60);
          }
          items.unshift(`🏅 新稱號「${title}」・員工心情 +5`);
        } else for (const e of this.staff) if (e.state === 'working' && this.rng() < 0.4) this.say(e, ['升級了！', '讚啦！', '又升一級！'][Math.floor(this.rng() * 3)], 40);
        this.notify(`⭐ 店家升到 Lv.${after}！${items.length ? `解鎖：${items.join('、')}` : ''}`, 'achieve');
        if (this.cb.levelUp) this.cb.levelUp(after, items, title);
        this.sound('level');
      }
    }
    // ───── 章節任務與玩法解鎖 ─────
    // 玩法一章一章開放；allFeatures 給 AI 試玩用（直接全開）
    feature(id) {
      if (this.allFeatures) return true;
      const p = this.progress;
      return !!(p && p.features && p.features.includes(id));
    }

    get chapter() {
      const C = Fun.CHAPTERS || [];
      const p = this.progress;
      if (p.chapter < C.length) return C[p.chapter];
      if (p.route && Fun.ROUTES && Fun.ROUTES[p.route]) return { id: 'route', icon: Fun.ROUTES[p.route].icon, name: `第二幕：${Fun.ROUTES[p.route].name}`, story: Fun.ROUTES[p.route].desc, quests: Fun.ROUTES[p.route].quests, route: true };
      return null;
    }

    // 每天檢查一次任務；整章完成就發獎勵、解鎖玩法
    checkProgress(silent) {
      const C = Fun.CHAPTERS || [];
      const p = this.progress;
      for (let guard = 0; guard < 8; guard++) {
        const ch = this.chapter;
        if (!ch || p.ended) return;
        let changed = false;
        for (const q of ch.quests) {
          if (!p.done.includes(q.id) && q.check(this)) {
            p.done.push(q.id);
            changed = true;
            if (!silent) this.notify(`✅ 任務完成：${q.text}`, 'good');
          }
        }
        if (!ch.quests.every((q) => p.done.includes(q.id))) return;
        // 整章完成
        if (ch.route) {
          p.ended = true;
          const R = Fun.ROUTES[p.route];
          this.achieve(p.route === 'ipo' ? 'ipoEnd' : 'coopEnd');
          if (this.cb.chapter) this.cb.chapter({ ending: R.ending, route: p.route });
          return;
        }
        p.chapter += 1;
        p.chapters.push(ch.id);
        if (ch.reward.cash) {
          this.cash += ch.reward.cash;
          this.ledger.rewards = (this.ledger.rewards || 0) + ch.reward.cash;
        }
        for (const f of ch.unlock) if (!p.features.includes(f)) p.features.push(f);
        if (ch.reward.xp) this.gainXp(ch.reward.xp);
        const next = C[p.chapter] || null;
        if (silent) this.notify(`📜 ${ch.name} 完成，解鎖：${ch.unlock.map((f) => Fun.FEATURES[f].name).join('、')}`, 'achieve');
        else if (this.cb.chapter) this.cb.chapter({ done: ch, next, unlocked: ch.unlock.map((f) => Fun.FEATURES[f]) });
        else this.notify(`📜 ${ch.name} 完成！`, 'achieve');
        if (!changed && !next) return;
      }
    }

    // ───── 📋 授權制度與區經理 ─────
    // 誰可以代你處理：區經理＞在班的店長
    get authAgent() {
      if (this.areaManager) return { name: this.areaManager.name, title: '區經理', lead: this.areaManager.lead };
      const m = this.staff.find((e) => e.rank === 'manager' && (e.state === 'working' || e.state === 'break'));
      return m ? { name: m.name, title: '店長', lead: m.lead } : null;
    }

    authKind(p) {
      const id = String(p.ev.id);
      if (id.startsWith('cmp_')) return 'complaint';
      if (id.startsWith('karen_')) return 'karen';
      if (id === 'rel_fight') return 'fight';
      if (id.startsWith('br_')) return 'branch';
      if (id.startsWith('career_') || p.ev.speaker || p.where === 'door') return null; // 升遷、外人上門的事老闆自己來
      return 'misc';
    }

    authHandle(p) {
      const A = this.policy.auth;
      if (!A || !this.feature('auth') || !p.ev) return false;
      const kind = this.authKind(p);
      const rule = kind && A[kind];
      if (!rule || rule === 'off') return false;
      const agent = this.authAgent;
      if (!agent) return false;
      const budget = A.budget || 0;
      const ok = p.ev.choices
        .map((c, i) => ({ c, i, fx: this.resolveEffects(c) }))
        .filter(({ c, fx }) => !c.minigame && !fx.brawl && !fx.leave && !fx.leave2 && !fx.demoteOf && !fx.promoteOf && !fx.transfer && !(fx.staff < 0) && !(fx.jerk > 0) && -(fx.cash || 0) <= budget);
      if (!ok.length) return false; // 沒有預算內的好選項：還是要通報老闆
      let pick;
      if (kind === 'karen') pick = ok.find(({ c }) => /站在|請他離開/.test(this.w(c.label))) || null;
      else if (kind === 'fight' && rule === 'course') pick = ok.find(({ c }) => /溝通課/.test(c.label)) || ok.find(({ c }) => /調解/.test(c.label));
      else if (kind === 'fight') pick = ok.find(({ c }) => /調解/.test(c.label) && !/沒什麼用/.test(c.label)) || null;
      if (!pick) {
        const score = ({ fx }) => (fx.review ? (fx.review[0] - 3) * 4 : 0) + (fx.morale || 0) * 2 + (fx.moodOf ? fx.moodOf.reduce((t, [, d]) => t + d, 0) / 3 : 0) + (fx.cash || 0) / 4000 - (fx.jerk || 0) * 6;
        pick = [...ok].sort((a, b) => score(b) - score(a))[0];
      }
      if (!pick) return false;
      this.activeEvents.push(p);
      p.by = `📋 ${agent.title}${agent.name}`;
      const r = this.applyChoice(p, pick.c);
      if (!r) return false;
      this.authCount = (this.authCount || 0) + 1;
      this.notify(this.w(`📋 ${agent.title}${agent.name}依授權處理了「${p.ev.title}」：${pick.c.label}`));
      return true;
    }

    // 從分店店長裡挑一位升區經理：他會離開那間分店，負責巡所有分店
    appointArea(i) {
      const b = this.branches[i];
      if (!b || !b.manager || this.areaManager || !this.feature('area')) return false;
      this.areaManager = { ...b.manager, since: this.week };
      b.manager = null;
      this.notify(`🗺️ ${this.areaManager.name} 升為區經理！所有分店的士氣會更穩，總部管理費也會下降。記得幫${b.district}店補一位店長。`, 'achieve');
      return true;
    }

    // ───── 公司與老闆個人的錢 ─────
    // 公司估值：最近 8 週本業的平均淨利 × 52 週 × 本益比，加上店面、分店、中央廚房這些資產，再加現金扣借款
    get valuation() {
      const h = this.history.slice(-8);
      const avg = h.length ? h.reduce((t, x) => t + (x.profit - (x.other || 0) - (x.rewards || 0)), 0) / h.length : 0;
      const pe = this.ipo && this.ipo.listed ? 14 : this.ipo && this.ipo.investors ? 10 : 6;
      const brand = 1 + Math.max(0, this.rating - 4) * 0.25;
      const assets = LOTS.slice(0, this.lotIdx + 1).reduce((t, l) => t + (l.cost || 0), 0) * 0.5 + this.branches.reduce((t, b) => t + (b.paid || 0), 0) * 0.6 + (this.kitchen ? this.kitchen.cost * 0.6 : 0);
      return Math.max(0, Math.round((Math.max(0, avg) * 52 * pe * brand + assets) * (this.level >= 36 ? 1.05 : 1) + this.cash - this.loan));
    }

    // 領分紅：公司的錢變成老闆的錢（扣 20% 稅）；薪水還低於行情就領分紅，員工會看在眼裡
    takeDividend(amount) {
      amount = Math.round(amount);
      if (amount <= 0 || this.cash - amount < 100000) return false;
      this.cash -= amount;
      this.owner.wealth += Math.round(amount * 0.8);
      this.owner.taken += amount;
      this.ledger.dividend = (this.ledger.dividend || 0) + amount;
      const low = this.staff.filter((e) => e.wage < this.marketWage).length;
      if (low) {
        this.jerk = clamp(this.jerk + 3, 0, JERK_LIMIT);
        for (const e of this.staff) e.mood = clamp(e.mood - 4, 0, 100);
        this.notify(`😒 員工看到老闆領了 $${amount.toLocaleString()} 分紅，但還有 ${low} 個人的時薪低於行情……`, 'bad');
      } else this.notify(`💰 領了 $${amount.toLocaleString()} 分紅（扣稅後 $${Math.round(amount * 0.8).toLocaleString()} 進你的口袋）`, 'good');
      return true;
    }

    chooseRoute(id) {
      const p = this.progress;
      if (!this.feature('route') || p.route || !Fun.ROUTES[id]) return false;
      p.route = id;
      this.notify(`🛤️ 你選擇了「${Fun.ROUTES[id].name}」的路。`, 'achieve');
      return true;
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

    siteCost(site, size = 'medium', type = 'standard') {
      const T = (Fun.STORE_TYPES && Fun.STORE_TYPES[type]) || {};
      return Math.round((this.ind.cash * 2.5 * site.cost * BRANCH_SIZES[size].cost * (T.cost || 1) * this.branchCostMult * (this.level >= 14 ? 0.9 : 1)) / 10000) * 10000;
    }

    // 平衡：各產業分店的回本速度差很多，校正到「最好的地點大約 36 週回本」（含裝潢、押金、開辦費）
    get branchCostMult() {
      if (this._bcm) return this._bcm;
      this._bcm = 1;
      let best = Infinity;
      for (const st of BRANCH_SITES) {
        const c = this.siteCost(st, 'medium');
        const e = this.estimateSite(st, 'medium');
        if (e.profit > 0) best = Math.min(best, c / e.profit);
      }
      this._bcm = isFinite(best) ? clamp(36 / best, 1, 3) : 1;
      return this._bcm;
    }

    typeOf(b) {
      return (Fun.STORE_TYPES && Fun.STORE_TYPES[(b && b.type) || 'standard']) || {};
    }

    openBranch(siteId, size = 'medium', type = 'standard') {
      if (!this.feature('storetype') || !(Fun.STORE_TYPES && Fun.STORE_TYPES[type])) type = 'standard';
      const site = BRANCH_SITES.find((x) => x.id === siteId) || BRANCH_SITES.find((x) => !this.branches.some((b) => b.site === x.id));
      if (!site || !BRANCH_SIZES[size] || this.level < 5 || !this.feature('branch') || this.branches.some((b) => b.site === site.id) || (this.franchises || []).some((f) => f.site === site.id)) return null;
      const cost = this.siteCost(site, size, type);
      if (this.cash < cost) return null;
      this.cash -= cost;
      this.ledger.other -= cost;
      const b = { site: site.id, district: site.name, size, type, paid: cost, week: this.week, last: 0, total: 0, revenue: 0, wage: 'market', price: 'normal', staff: this.branchNeedOf(size), morale: 65, rating: 3.8, reno: 0, hist: [] };
      this.branches.push(b);
      this.notify(`🏙️ ${this.shopName}${site.city}${site.name}店開幕了！`, 'achieve');
      this.checkProgress();
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
      return { revenue: ind.baseArrivals * traffic * 0.8 * (ind.basket || 1) * avgPrice * 7 * this.idx.cpi * (ind.branchMult || 1), costShare, ticket: avgPrice * (ind.basket || 1) * this.idx.cpi };
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
      return Math.round((this.branchCost * 0.15 * (this.level >= 28 ? 0.7 : 1)) / 1000) * 1000;
    }

    // 算一間分店一週的帳；est 為 true 時不加隨機（給選址畫面估算用）
    branchWeek(b, est = false) {
      const { revenue: R0, costShare, ticket } = this.branchBase();
      const site = this.siteOf(b);
      const size = BRANCH_SIZES[b.size || 'medium'];
      const need = this.branchNeedOf(b.size || 'medium');
      const wm = { low: 0.92, market: 1, high: 1.12 }[b.wage];
      const pm = { cheap: 0.9, normal: 1, premium: 1.15 }[b.price];
      const load = need / Math.max(1, b.staff + (b.manager ? 1 : 0));
      const traffic = site.traffic * this.siteFit(site) * this.siteSeason(site) * (site.weekdayOnly ? 0.85 : 1);
      // 同一個城市開太多間會互相搶客人：每多一間同城分店，客人少 12%
      const sameCity = this.branches.filter((x) => x !== b && this.siteOf(x).city === site.city).length;
      const cannibal = Math.pow(0.88, sameCity);
      const T = this.typeOf(b);
      const premiumHit = site.rich || T.premium ? 0.94 : 0.82;
      const mf = this.branchMgrFx(b);
      // 季節限定期間，分店也賣
      const seasonal = this.seasonal && this.seasonal.until >= this.day ? 1.06 : 1;
      // 新店期：剛開幕的前 8 週，附近的人還不認識你（從五成慢慢爬到全滿）
      const r0 = this.level >= 20 ? 0.65 : 0.5;
      const ramp = est || b.week == null ? 1 : clamp(r0 + (this.week - b.week) / 16, r0, 1);
      const demand = R0 * (this.level >= 30 ? 1.03 : 1) * ramp * traffic * cannibal * size.draw * (T.draw || 1) * seasonal * clamp((b.rating - 2.4) / 1.4, 0.15, 1.5) * (pm < 1 ? 1.15 : pm > 1 ? premiumHit : 1) * (est ? 1 : 0.9 + this.rng() * 0.2);
      const cap = ((R0 * 1.3 * size.cap * (b.staff + (b.manager ? 1 : 0)) * mf.cap) / need) * (b.broken > 0 ? 0.8 : 1);
      const sold = Math.min(demand, cap);
      const revenue = sold * pm;
      const materials = sold * costShare * this.costMult.materials * (0.85 + 0.15 * this.idx.oil) * mf.mat * (this.kitchen ? (this.level >= 29 ? 0.8 : 0.85) : 1);
      const wages = (b.staff * 38 * this.marketWage * wm + mf.wage) * (1 + (this.policy.insurance ? INS_TOTAL : 0));
      const rent = ((this.ind.rent * site.rent * size.rent) / 4) * (b.rentMult || 1) * (T.rent || 1);
      // 總部管理費：分店兩間以上要有人跑帳、巡店、培訓；有分店店長的分店省一半
      // 總部管理費：分店越多越貴（3% 起、每多一間 +0.6%，最多 9%）；分店店長、區經理、Lv.22 都能省
      const n = this.branches.length;
      const feeRate = n >= 2 ? Math.min(0.09, 0.03 + 0.006 * Math.max(0, n - 2)) * (b.manager ? 0.5 : 1) * (this.areaManager ? 0.7 : 1) * (this.level >= 22 ? 0.8 : 1) * (this.level >= 37 ? 0.9 : 1) : 0;
      const fee = !est ? revenue * feeRate : 0;
      return { revenue, profit: revenue - materials - wages - rent - revenue * 0.01 - fee, load, wm, pm, demand, cap, fee, sold, ticket };
    }

    // 選址畫面用：照預設設定估算每週營收和淨利
    estimateSite(site, size, type = 'standard') {
      const b = { site: site.id, size, type, wage: 'market', price: 'normal', staff: this.branchNeedOf(size), rating: 3.7 };
      const r = this.branchWeek(b, true);
      return { revenue: Math.round(r.revenue), profit: Math.round(r.profit), full: r.demand > r.cap * 1.05 };
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
        const mt = 62 + (this.level >= 31 ? 3 : 0) + (wm - 1) * 160 + b.reno * 4 - Math.max(0, load - 1) * 35 - (this.jerk > 60 ? 8 : 0) - (this.policy.insurance ? 0 : 10);
        const mf = this.branchMgrFx(b);
        const area = this.areaManager ? 3 + (this.areaManager.lead - 50) / 10 : 0; // 區經理巡店
        const T = this.typeOf(b);
        const coop = this.coop && this.coop.shares ? 8 : 0; // 員工持股：大家是在幫自己的店做事
        b.morale = clamp(b.morale + (mt + mf.morale + area + coop + (T.morale || 0) - b.morale) * 0.45, 0, 100);
        // 本店的門面就是品牌形象：裝潢好，分店的評價也沾光
        const rt = 3.5 + mf.rating + (T.rating || 0) + 0.12 * (1 - Math.exp(-this.decor.A / 40)) + (b.morale - 55) / 45 + b.reno * 0.18 + (pm < 1 ? 0.2 : pm > 1 ? -0.25 : 0) + (this.rating - 3.8) * 0.3 - Math.max(0, load - 1.2) * 0.8;
        b.rating = clamp(b.rating + (rt + (this.level >= 25 ? 0.1 : 0) + (this.level >= 40 ? 0.1 : 0) - b.rating) * 0.4, 1, 5);
        const r = this.branchWeek(b);
        const p = Math.round(r.profit);
        b.revenue = Math.round(r.revenue);
        b.busy = r.demand > r.cap * 1.05; // 客人多到做不完
        // 換算成人數：想來多少人、服務了多少人、流失多少人
        b.wantN = Math.round(r.demand / r.ticket);
        b.servedN = Math.round(r.sold / r.ticket);
        b.lostN = Math.max(0, b.wantN - b.servedN);
        b.util = r.cap ? r.sold / r.cap : 0;
        b.fee = Math.round(r.fee);
        if (b.broken > 0) b.broken -= 1;
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
      // 區經理的薪水（月薪制，換成週）
      if (this.areaManager) total -= Math.round(this.areaManager.wage * 48 * (1 + (this.policy.insurance ? INS_TOTAL : 0)));
      if (this.branches.length && this.jerk > 65 && this.rng() < 0.4) {
        this.jerk = clamp(this.jerk + 3, 0, JERK_LIMIT);
        this.notify('📰 分店員工在網路上爆料總店的管理方式……', 'bad');
      }
      // 分店出狀況：士氣、評價先亮警告，撐不住就打電話來；也有房東漲租、設備故障這種意外
      const issues = [];
      this.branches.forEach((b, i) => {
        if (b.morale < 45) issues.push({ i, type: 'morale' });
        else if (b.rating < 3.6) issues.push({ i, type: 'rating' });
        else if (this.week - b.week > 8 && !b.rentRaised && this.rng() < 0.07) issues.push({ i, type: 'rent' });
        else if (!b.broken && this.rng() < 0.03) issues.push({ i, type: 'broken' });
      });
      if (issues.length) this.branchIssue = issues[Math.floor(this.rng() * issues.length)];
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
      const o = { id: uid++, type, def, x, z, rot, cells: this.footprint(def, x, z, rot), bought: this.day };
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

    // 貨量上限：沒有儲藏室大約一天半的量
    stockCap(gid) {
      const par = this.par && this.par[gid];
      if (!par) return 0;
      return Math.round(par * [1.6, 2.5, 3.5, 5][this.roomLv('storage')]);
    }

    stockGroup(gid) {
      return (this.ind.stock || []).find((g) => g.id === gid);
    }

    // 一份食材的進價：跟著物價和油價（運費）漲
    unitCost(g) {
      const ps = this.ind.products.filter((p) => g.products.includes(p.id));
      const w = ps.reduce((s, p) => s + p.weight, 0);
      const avg = ps.reduce((s, p) => s + p.cost * p.weight, 0) / w;
      return avg * this.idx.cpi * this.costMult.materials * (0.85 + 0.15 * this.idx.oil) * this.kitchenMult;
    }

    // ───── 🤝 加盟 ─────
    get franchiseFee() {
      return Math.round((this.ind.cash * 0.35) / 10000) * 10000;
    }
    // 直營店越多，越有能力管加盟店
    get franchiseCap() {
      return 1 + this.branches.length;
    }
    rollFranchiseApps() {
      const who = ['陳先生', '林小姐', '黃老闆', '張太太', '李大哥', '王小姐', '吳先生', '劉媽媽', '蔡老闆', '楊小姐', '許先生', '鄭太太'];
      // 加盟店不開在自己的分店、其他加盟店旁邊，同一批也不重複
      const used = new Set([...(this.franchises || []).map((f) => f.site), ...this.branches.map((b) => b.site)]);
      const sites = [...BRANCH_SITES.filter((x) => !used.has(x.id))].sort(() => this.rng() - 0.5);
      const names = [...who].sort(() => this.rng() - 0.5);
      const notes = [
        [80, '以前在大公司當過店長，說話很有條理'],
        [70, '一直問員工福利要怎麼做才好'],
        [55, '很在意要多久回本'],
        [40, '問了三次「可以不幫工讀生保勞保嗎」'],
        [30, '說「年輕人就是要操」'],
        [85, '帶著自己的員工一起來面談'],
        [60, '準備了一份很厚的展店計畫'],
        [45, '覺得「招牌掛上去客人就會來」'],
      ];
      this.franchiseApps = Array.from({ length: Math.min(3, sites.length) }, (_, k) => {
        const n = notes[Math.floor(this.rng() * notes.length)];
        const site = sites[k];
        return { id: uid++, name: names[k], site: site.id, city: site.city, district: site.name, decency: clamp(n[0] + (this.rng() - 0.5) * 30 + (this.level >= 26 ? 10 : 0), 10, 98), note: n[1] };
      });
      return this.franchiseApps;
    }
    acceptFranchise(id) {
      const a = (this.franchiseApps || []).find((x) => x.id === id);
      this.franchises = this.franchises || [];
      if (!a || !this.feature('franchise') || this.franchises.length >= this.franchiseCap) return false;
      this.franchiseApps = this.franchiseApps.filter((x) => x !== a);
      this.franchises.push({ name: a.name, site: a.site, city: a.city, district: a.district, decency: a.decency, rating: 3.9, week: this.week, last: 0, total: 0 });
      this.cash += this.franchiseFee;
      this.ledger.other += this.franchiseFee;
      this.notify(`🤝 ${a.name}的${a.city}${a.district}加盟店開幕！收到加盟金 ${'$' + this.franchiseFee.toLocaleString()}。`, 'achieve');
      this.checkProgress();
      return true;
    }
    franchiseIssueEvent(i) {
      const f = this.franchises[i];
      const c = Math.round(this.ind.cash * 0.1);
      return {
        id: 'franchise_issue',
        icon: '🤝',
        title: `${f.city}${f.district}加盟店被爆料`,
        text: `網路上有人爆料：「${this.shopName}${f.district}加盟店的老闆不給加班費，還叫工讀生自己吸收收銀短少。」留言區有人說：「原來${this.shopName}是這種公司？」`,
        choices: [
          { label: '派人去輔導，出錢幫他改善制度', note: `$${c.toLocaleString()}`, effects: { cash: -c * 2, franchiseFix: [i, 25] }, result: `${f.name}一開始很不爽，但看到總部真的出錢出人，態度軟化了。` },
          { label: '解約，收回招牌', note: '違約處理費', effects: { cash: -c * 4, franchiseEnd: i, jerk: -1 }, result: `你在粉專上公告：「我們不會讓掛著這塊招牌的店苛待員工。」很多人按讚。` },
          { label: '「那是他自己的店，我管不著」', quote: '加盟主是獨立經營的。', effects: { jerk: 3, review: [1, '加盟店壓榨員工，總部還說管不著'], franchiseFix: [i, -5] }, result: '爆料越傳越廣，大家把帳算在品牌上。', tip: '加盟主雖然是獨立雇主，但消費者和求職者看的是品牌；很多連鎖品牌會在加盟合約裡寫入勞動條件稽核。' },
        ],
        ignore: { effects: { jerk: 2, review: [2, '加盟店的員工好像很可憐'] }, result: '總部沒有回應，爆料文被分享了好幾百次。' },
      };
    }

    // ───── 🔔 上市路線 ─────
    get raiseNeed() {
      return Math.round((this.ind.cash * 40) / 100000) * 100000;
    }
    raiseFunds() {
      if (!this.progress || this.progress.route !== 'ipo' || (this.ipo && this.ipo.investors) || this.valuation < this.raiseNeed) return false;
      const h = this.history.slice(-8);
      const avg = h.length ? h.reduce((t, x) => t + x.profit, 0) / h.length : 0;
      // 投資人不會給你估值的一大塊：大概是一年半的本業獲利，而且之後每週要分走兩成獲利
      const amt = Math.round(Math.min(this.valuation * 0.08, Math.max(0, avg) * 52) / 10000) * 10000;
      this.cash += amt;
      this.ledger.other += amt;
      this.ipo = { investors: true, streak: 0, listed: false, qWeek: this.week, qProfit: 0, target: Math.round(Math.max(this.ind.cash * 0.5, avg * 13 * 0.97)), quarters: 0 };
      this.notify(`🔔 募資完成，進帳 ${'$' + amt.toLocaleString()}！董事會給了第一季的目標：淨利 ${'$' + this.ipo.target.toLocaleString()}。`, 'achieve');
      this.checkProgress();
      return true;
    }
    listCompany() {
      const I = this.ipo;
      if (!I || I.listed || I.streak < 3 || this.jerk >= 20) return false;
      I.listed = true;
      const h = this.history.slice(-8);
      const avg = h.length ? h.reduce((t, x) => t + x.profit - (x.other || 0), 0) / h.length : 0;
      const amt = Math.round(Math.min(this.valuation * 0.1, Math.max(0, avg) * 52) / 10000) * 10000;
      this.cash += amt;
      this.ledger.other += amt;
      this.notify(`🔔 敲鐘掛牌！公開發行進帳 ${'$' + amt.toLocaleString()}。`, 'achieve');
      this.checkProgress();
      return true;
    }
    boardEvent() {
      const cut = Math.round(this.ind.cash * 0.15);
      return {
        id: 'board_push',
        icon: '👔',
        title: '董事會要你砍成本',
        text: `董事會上，投資人代表翻著報表：「人事成本太高了。同業都在用更多工讀生、少排正職，你為什麼不跟進？這季的數字很重要。」`,
        choices: [
          { label: '照辦：正職減少、改用工讀生', effects: { wageMult: -0.04, morale: -6, jerk: 4, cash: cut * 2 }, result: '報表好看了，但休息室裡大家講話變小聲了。' },
          { label: '拿數據說服：留住人反而省招募成本', effects: { ipoTarget: 0.02 }, result: '董事們半信半疑，把這季的目標再調高一點：「那就用業績證明給我們看。」' },
          { label: '「員工不是成本，是我們的店」', effects: { ipoTarget: 0.04, morale: 3 }, result: '會議室安靜了幾秒。有位董事點點頭，但目標還是被調高了。' },
        ],
        ignore: { effects: { ipoTarget: 0.03 }, result: '你沒有回應，董事會自己把目標調高了。' },
      };
    }

    // ───── 🤲 員工持股路線 ─────
    get sharesCost() {
      return Math.max(this.ind.cash, Math.round((this.valuation * 0.05) / 10000) * 10000);
    }
    launchShares() {
      if (!this.progress || this.progress.route !== 'coop' || (this.coop && this.coop.shares) || this.cash < this.sharesCost) return false;
      this.cash -= this.sharesCost;
      this.ledger.other -= this.sharesCost;
      this.coop = { shares: true, heir: null, week: this.week };
      for (const e of this.staff) e.mood = clamp(e.mood + 15, 0, 100);
      for (const b of this.branches) b.morale = clamp(b.morale + 10, 0, 100);
      this.jerk = clamp(this.jerk - 5, 0, JERK_LIMIT);
      this.notify('🤲 員工持股計畫上路！每個人的名片上多了一行「股東」。', 'achieve');
      this.checkProgress();
      return true;
    }
    heirCandidates() {
      const out = this.staff.filter((e) => e.rank === 'manager' && e.lead >= 70).map((e) => ({ name: e.name, lead: e.lead, where: '本店店長' }));
      for (const b of this.branches) if (b.manager && b.manager.lead >= 70) out.push({ name: b.manager.name, lead: b.manager.lead, where: `${b.district}店店長` });
      if (this.areaManager && this.areaManager.lead >= 70) out.push({ name: this.areaManager.name, lead: this.areaManager.lead, where: '區經理' });
      return out;
    }
    setHeir(name) {
      if (!this.coop || !this.coop.shares || this.coop.heir) return false;
      const c = this.heirCandidates().find((x) => x.name === name);
      if (!c) return false;
      this.coop.heir = c.name;
      this.notify(`🏮 你指定 ${c.name}（${c.where}）為接班人。`, 'achieve');
      this.checkProgress();
      return true;
    }

    // 每週：中央廚房、加盟、董事會、員工持股
    groupWeekly() {
      const L = this.ledger;
      let total = 0;
      if (this.kitchen) {
        total -= this.kitchenUpkeep;
        if (this.rng() < (this.kitchen.backup ? 0.04 : 0.06)) this.kitchenIssue = true;
      }
      if (this.feature('franchise')) {
        if (!this.franchiseApps || this.week % 2 === 0) this.rollFranchiseApps();
        const R0 = this.branchBase().revenue;
        (this.franchises || []).forEach((f, i) => {
          const target = 3.2 + f.decency / 55 + (this.rating - 4) * 0.3;
          f.rating = clamp(f.rating + (target - f.rating) * 0.35 + (this.rng() - 0.5) * 0.1, 1, 5);
          // 權利金 4%，扣掉總部督導、教育訓練的成本（大約 1%）
          const roy = Math.round(R0 * (0.04 * clamp((f.rating - 2.5) / 1.5, 0.3, 1.3) - 0.01) * (this.level >= 34 ? 1.1 : 1));
          f.last = roy;
          f.total += roy;
          total += roy;
          if (f.decency < 50 && !this.franchiseIssue && this.rng() < 0.12) this.franchiseIssue = { i };
          if (f.rating < 3.4 && this.rng() < 0.3) this.addReview(2, `${f.district}的加盟店跟本店差好多`, 'quality');
        });
      }
      const I = this.ipo;
      if (I && I.investors && !I.listed) {
        const last = this.history[this.history.length - 1];
        if (last) I.qProfit += last.profit - (last.other || 0) - (last.rewards || 0);
        const wk = this.week - I.qWeek;
        if (wk === 6 && this.rng() < 0.6) this.boardPush = true;
        if (wk >= 13) {
          I.quarters += 1;
          const hit = I.qProfit >= I.target;
          I.streak = hit ? I.streak + 1 : 0;
          this.notify(hit ? `📈 第 ${I.quarters} 季達標！淨利 $${Math.round(I.qProfit).toLocaleString()}（目標 $${I.target.toLocaleString()}），連續 ${I.streak} 季` : `📉 第 ${I.quarters} 季沒達標：淨利 $${Math.round(I.qProfit).toLocaleString()}（目標 $${I.target.toLocaleString()}），連續達標歸零`, hit ? 'achieve' : 'bad');
          // 達標：下一季目標成長 3%；沒達標：董事會稍微下修期待
          I.target = Math.round(I.target * (hit ? 1.03 : 0.98));
          I.qProfit = 0;
          I.qWeek = this.week;
        }
      }
      // 投資人分潤：上市前每週分走兩成獲利，上市後一成二發給股東
      if (I && I.investors) {
        const last = this.history[this.history.length - 1];
        const core = last ? last.profit - (last.other || 0) : 0;
        if (core > 0) {
          const share = Math.round(core * (I.listed ? 0.15 : 0.25));
          total -= share;
          I.paid = (I.paid || 0) + share;
        }
      }
      if (this.coop && this.coop.shares) for (const e of this.staff) e.mood = clamp(e.mood + 1.5, 0, 100);
      L.group = (L.group || 0) + total;
      return total;
    }

    // ───── 🍂 季節限定 ─────
    get seasonIdx() {
      return Math.floor((this.monthOfYear % 12) / 3); // 12～2 冬、3～5 春……
    }
    get seasonalItem() {
      const list = (Fun.SEASONAL && Fun.SEASONAL[this.ind.id]) || ['🌸 春季限定', '☀️ 夏季限定', '🍂 秋季限定', '❄️ 冬季限定'];
      const i = (this.seasonIdx + 3) % 4; // 0 = 春
      return { name: list[i], season: Fun.SEASON_NAMES ? Fun.SEASON_NAMES[i] : '' };
    }
    get seasonalCost() {
      return Math.round((this.ind.cash * 0.12 * (this.level >= 13 ? 0.8 : 1)) / 1000) * 1000;
    }
    launchSeasonal() {
      if (!this.feature('seasonal') || (this.seasonal && this.seasonal.until >= this.day) || this.cash < this.seasonalCost) return false;
      const it = this.seasonalItem;
      // 同一季重複推一樣的，新鮮感就差了
      const again = this.seasonal && this.seasonal.name === it.name && this.day - this.seasonal.until < 60;
      this.cash -= this.seasonalCost;
      this.ledger.other -= this.seasonalCost;
      this.seasonal = { name: it.name, until: this.day + (this.level >= 32 ? 34 : 27), again };
      this.seasonalCount = (this.seasonalCount || 0) + 1;
      this.demandMods.push({ mult: again ? 1.05 : 1.12, days: 28 });
      this.social.followers += again ? 30 : 150;
      this.notify(`🍂 季節限定「${it.name}」上市！接下來四週客人變多${this.branches.length ? '（分店也一起賣）' : ''}${again ? '。不過同一個品項又推一次，客人沒那麼新鮮了' : ''}`, 'achieve');
      this.checkProgress();
      return true;
    }

    // ───── 🏭 中央廚房（非餐飲是物流中心） ─────
    get kitchenName() {
      return this.isFood ? '中央廚房' : '物流中心';
    }
    get kitchenCost() {
      return Math.round((this.ind.cash * 6) / 10000) * 10000;
    }
    get kitchenUpkeep() {
      return Math.round((this.ind.cash * 0.06) / 100) * 100;
    }
    get kitchenMult() {
      return this.kitchen && !(this.kitchen.downUntil >= this.day) ? (this.level >= 29 ? 0.85 : 0.9) : 1;
    }
    // 罰款倍率：難度 × Lv.24（制度上軌道，稽查比較少被抓到小問題）
    get fineMult() {
      return this.diff.fines * (this.level >= 24 ? 0.8 : 1);
    }
    buildKitchen() {
      if (!this.feature('kitchen') || this.kitchen || this.cash < this.kitchenCost) return false;
      this.cash -= this.kitchenCost;
      this.ledger.other -= this.kitchenCost;
      this.kitchen = { cost: this.kitchenCost, week: this.week, backup: false, issues: 0 };
      this.notify(`🏭 ${this.kitchenName}啟用！本店進貨成本 -10%、分店 -15%。但它出包的時候，所有店都會受影響。`, 'achieve');
      this.checkProgress();
      return true;
    }
    get backupCost() {
      return Math.round((this.ind.cash * 0.6) / 10000) * 10000;
    }
    buyBackup() {
      if (!this.kitchen || this.kitchen.backup || this.cash < this.backupCost) return false;
      this.cash -= this.backupCost;
      this.ledger.other -= this.backupCost;
      this.kitchen.backup = true;
      this.notify(`🤝 簽好了備援{w:supplier}：${this.kitchenName}出狀況時，可以馬上切換。`);
      return true;
    }
    kitchenEvent() {
      const K = this.kitchenName;
      const n = this.branches.length + 1;
      const ch = [
        { label: `全面回收，${K}停工三天徹查`, note: '安全第一', effects: { cash: -Math.round(this.ind.cash * 0.08), kitchenDown: 3, morale: 1 }, result: `${n} 間店一起貼出公告：「為了安全，部分品項暫停供應。」有客人留言說：「這樣負責的店，我會再來。」` },
      ];
      if (this.kitchen && this.kitchen.backup) ch.push({ label: '切換備援{w:supplier}，有問題的批次銷毀', effects: { cash: -Math.round(this.ind.cash * 0.03) }, result: '備援{w:supplier}當天就送到了，客人幾乎沒感覺。還好有先簽約。' });
      ch.push({ label: '「應該沒那麼嚴重」，照常出貨', quote: '這批丟掉太可惜了。', effects: { kitchenGamble: true, jerk: 1 }, result: '你決定賭一把。', tip: '依食品安全衛生管理法，業者發現產品有危害衛生安全之虞時，應立即主動停止製造、販賣並辦理回收；隱匿不報罰得更重。' });
      return {
        id: 'kitchen_issue',
        icon: '🏭',
        title: `${K}出狀況了`,
        text: this.isFood ? `${K}的品管回報：昨天出貨的一批{w:supplies}，冷藏溫度紀錄有一段異常。這批已經送到 ${n} 間店。` : `${K}回報：一批{w:supplies}檢驗發現瑕疵，已經送到 ${n} 間店。`,
        choices: ch,
        ignore: { effects: { kitchenGamble: true }, result: '沒有人做決定，那批貨就照常用了。' },
      };
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
        cost += n * this.unitCost(g) * (rush ? (this.level >= 18 ? 1.15 : 1.3) : 1);
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
        // 自動進貨：照昨天的用量多抓一點；昨天賣完代表真正的需求比用量多，再多抓一些
        if (this.policy.autoStock && this.lastUsage[g.id]) {
          const out = this.lastDay && this.lastDay.outWarned && this.lastDay.outWarned[g.id];
          this.par[g.id] = Math.max(5, Math.ceil((Math.max(this.lastUsage[g.id], out ? this.par[g.id] : 0) * (out ? 1.35 : 1.2)) / 5) * 5);
        }
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
      let over = 0;
      for (const [gid, n] of Object.entries(d.items)) {
        this.stock[gid] = (this.stock[gid] || 0) + n;
        // 倉庫放不下的只好退貨（運費和損耗算你的）
        const cap = this.stockCap(gid);
        if (cap && this.stock[gid] > cap) {
          const g = this.stockGroup(gid);
          const extra = this.stock[gid] - cap;
          this.stock[gid] = cap;
          const v = Math.round(extra * this.unitCost(g) * 0.3);
          this.cash -= v;
          this.ledger.waste += v;
          over += extra;
        }
      }
      if (over) this.notify(`📦 貨太多放不下，${over} 份只好退回（損失運費）。${this.roomLv('storage') < 3 ? '蓋或升級後場的儲藏室，可以放更多。' : ''}`, 'bad');
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
      // 餐飲業有養寵物、又沒有隔開：稽查員會扣分
      const petRisk = this.isFood ? this.pets.reduce((t, p) => t + (p.calm ? 0.3 : 1) * ((Fun.PETS[p.kind] || {}).hygiene || 0), 0) * 4 + (this.policy.petFriendly && !this.flags.has('petZone') ? 4 : 0) : 0;
      const cl = this.cleanliness - petRisk;
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
        const fine = Math.round(((cl < 25 ? 60000 : 30000) * this.fineMult) / 1000) * 1000;
        r = { grade: '不合格', fine, text: `${org}稽查不合格，罰鍰 $${fine.toLocaleString()}，還上了地方新聞。` };
        this.cash -= fine;
        this.ledger.fines += fine;
        this.demandMods.push({ mult: 0.88, days: 10 });
        this.addReview(1, '看到新聞說這家衛生不合格，不敢再去了', 'clean');
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
      const mine = (this.rating - 3.6) * 0.5 + (1 - avgRatio) * 1.2 + (this.cleanliness - 70) / 200 + this.decor.A / 120 + (this.loyalty ? 0.06 : 0);
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

    // 這一行的說法：把 {w:serve} 這種記號換成「出餐／剪髮／修車…」
    w(text) {
      return fillWords(text, this.ind.id);
    }

    get isFood() {
      return FOOD_IND.includes(this.ind.id);
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
      return this.w(text).replace(/\{shop\}/g, this.shopName).replace(/\{item\}/g, p.name).replace(/\{price\}/g, this.prices[p.id]).replace(/\{staff\}/g, e ? e.name : '小編');
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
      if (this.roomLv('toilet') >= 3) score *= 1.06; // 網美廁所：客人打卡的照片也幫你宣傳
      if (this.decor.theme === 'insta') score *= 1.12;
      let fire = null;
      if (b.risky && this.rng() < b.risky) fire = b.riskText || '踩到雷了';
      const base = 40 + this.social.followers * 0.25;
      let likes = Math.round(base * Math.pow(Math.max(0.3, score) / 6, 2.2) * (1 + this.rating / 10));
      // 斜槓員工裡有直播主、設計師：貼文比較多人按讚
      likes = Math.round(likes * this.staff.reduce((m, x) => Math.max(m, (this.sideOf(x) || {}).post || 1), 1));
      let tier = score >= 12 ? 'viral' : score >= 8 ? 'good' : score >= 5 ? 'meh' : 'flop';
      if (fire) {
        tier = 'fire';
        likes = Math.round(likes * 0.6);
      }
      const gain = fire ? -Math.round(this.social.followers * 0.05) : Math.round(likes * (tier === 'viral' ? 0.5 : tier === 'good' ? 0.25 : 0.08) * (this.level >= 15 ? 1.15 : 1));
      this.social.followers = Math.max(0, this.social.followers + gain);
      const pool = Fun.COMMENTS[tier] || [];
      const comments = [...pool].sort(() => this.rng() - 0.5).slice(0, 3).map((c) => this.w(c));
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
        this.addReview(1, '看到粉專的貼文，不想支持了', 'image');
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
      // 最近來過的奧客先不要再來，不然梗很快就膩了
      this.recentKarens = this.recentKarens || [];
      const all = Fun.KARENS.filter((x) => !x.ind || x.ind.includes(this.ind.id));
      const fresh = all.filter((x) => !this.recentKarens.includes(x.id));
      const pool = fresh.length ? fresh : all;
      const k = pool[Math.floor(this.rng() * pool.length)];
      if (k) this.recentKarens = [...this.recentKarens, k.id].slice(-5);
      if (!k) return;
      const before = this.customers.length;
      this.spawnCustomer({ karen: k });
      const c = this.customers[before];
      if (!c) return;
      c.karen = k;
      c.patience *= 3;
      // 長相跟名字對得上：「先生」是男生、「小姐」是女生，其他的隨機但前後一致
      const look = Looks.randomLook(this.rng, k.gender || (this.rng() < 0.5 ? 'f' : 'm'));
      if (k.old) Object.assign(look, { old: true, hair: '#c8c8c8' });
      c.look = { ...look, shirt: Looks.VISITORS.karen.shirt, shades: k.id === 'influencer' || k.id === 'manager', extra: null };
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
      c.arguing = this.activeEvents.includes(ev);
    }

    // ───── 店長建議：現在最該處理的幾件事 ─────
    advice() {
      const out = [];
      const d = this.lastDay;
      const working = this.staff.length;
      if (!working) out.push({ icon: '👥', text: '一個員工都沒有，店開不起來！先去錄取應徵者。', tab: 'staff' });
      const cov = working ? this.coverage() : null;
      if (!this.policy.helper && d && (d.angry / Math.max(1, d.visitors) > 0.08 || this.staff.some((e) => e.mood < 35))) out.push({ icon: '🤖', text: '覺得事情太多顧不過來？可以打開上面的「經營小幫手」，人手、薪水、價格這些瑣事交給它。' });
      // 生意好卻在虧錢：通常是價格太低或人太多
      const lw = this.history[this.history.length - 1];
      if (lw && lw.profit - (lw.other || 0) - (lw.rewards || 0) < 0 && this.rating >= 4.3) {
        const extra = cov && cov.days.every((p) => !p || Math.min(...p) > cov.lanes);
        out.push({ icon: '📉', text: `上週本業虧了 ${Math.round(-(lw.profit - (lw.other || 0) - (lw.rewards || 0))).toLocaleString()} 元，但評價有 ${this.rating.toFixed(1)} ★：客人很喜歡你，可以試著漲價 5～10%${extra ? '；另外每一班的人都比服務位多，多出來的人只能拖地' : ''}。`, tab: 'manage' });
      }
      // 只有在還沒開過店、或真的有客人等到生氣時才提醒（不是每個服務位都要有人）
      if (cov && cov.short >= 2 && (!d || d.angry / Math.max(1, d.visitors) > 0.03)) out.push({ icon: '📅', text: `排休之後，一週有 ${cov.short} 天每一班的人比服務位（${cov.lanes} 個）少，尖峰時客人會等很久。多請一兩個人，或在「員工 → 排班與崗位」最下面看每天每班有幾個人。`, tab: 'staff' });
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
      const lockedRecipe = this.ind.products.find((p) => p.rd && !this.recipes.has(p.id) && this.level >= (p.lv || 1) && this.cash > this.rdCost(p) * 3);
      if (lockedRecipe) out.push({ icon: '🧪', text: `可以研發新品「${lockedRecipe.name}」了，{w:menu}變豐富會吸引更多客人。`, tab: 'manage' });
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
        const th = this.themeInfo;
        if (th && th.types[t.id]) w *= th.types[t.id];
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
      // Lv.11 以後，老手比較常來應徵
      const traits = [forceTrait || (this.level >= 11 && this.rng() < 0.25 ? 'veteran' : traitIds[Math.floor(this.rng() * traitIds.length)])];
      if (this.rng() < 0.45) {
        const t2 = traitIds[Math.floor(this.rng() * traitIds.length)];
        if (!traits.includes(t2) && !(traits.includes('rookie') && t2 === 'veteran') && !(traits.includes('veteran') && t2 === 'rookie')) traits.push(t2);
      }
      let skill = 30 + this.rng() * 30 + (this.level >= 35 ? 6 : 0);
      if (traits.includes('rookie')) skill = 8 + this.rng() * 20;
      if (traits.includes('veteran')) skill = 62 + this.rng() * 25;
      const u = Looks.UNIFORM[this.ind.id] || {};
      const look = Looks.randomLook(this.rng, gender, { shirt: (u.shirts || ['#4a6fa5'])[Math.floor(this.rng() * (u.shirts || [1]).length)], hat: u.hat, hatColor: u.hatColor });
      const plus = traits.includes('veteran') ? TRAITS.veteran.wagePlus : 0;
      const wage = Math.max(MIN_WAGE, Math.round((this.marketWage * (0.92 + skill / 500 + plus) * this.diff.wage) / 5) * 5);
      const c = { name, gender, look, traits, skill: Math.round(skill), wage };
      // 🔀 斜槓：解鎖後，大約三分之一的應徵者有副業
      if (this.feature('slash') && Fun.SIDE_JOBS && this.rng() < 0.33) {
        const ids = Object.keys(Fun.SIDE_JOBS);
        c.side = ids[Math.floor(this.rng() * ids.length)];
      }
      // 面試時就決定好領導力、企圖心和風格（看得到的只有印象）
      const tmp = this.ensureCareer({ traits, gender });
      for (const k of ['lead', 'ambition', 'style', 'leadSeen', 'hint']) c[k] = tmp[k];
      // 有面試間：比較看得出這個人會不會帶人；員工休息室做得好，來應徵的人素質比較好
      if (this.roomLv('office') >= 2) c.leadSeen = Math.round(c.lead * 0.75 + c.leadSeen * 0.25);
      if (this.roomLv('rest') >= 3) c.skill = Math.min(95, c.skill + 5);
      c.allergic = this.rng() < 0.08; // 看不到：對貓狗過敏
      return c;
    }

    rollCandidates() {
      this.candidates = [];
      const out = [];
      for (let i = 0; i < (this.level >= 16 ? 4 : 3); i++) {
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
      for (const k of ['lead', 'ambition', 'style', 'leadSeen', 'hint', 'side', 'allergic']) if (c[k] != null) e[k] = c[k];
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
      // 後場的門：老闆可以自己洗廁所、進辦公室休息
      const door = this.hasBackroom && this.backDoorCell();
      if (door && near(door, 1.4)) {
        const acts = [];
        if (this.toiletOk) acts.push(['boss-toilet', `🧽 老闆親自洗廁所（乾淨度 ${Math.round(this.toiletClean)}）`]);
        if (this.roomLv('office')) acts.push(['boss-office', '💼 進辦公室休息一下']);
        if (acts.length) out.push({ kind: 'backdoor', ref: door, d: d(door), label: '後場', actions: acts });
      }
      for (const c of this.customers) {
        // 奧客嗓門大：隔著櫃台或排隊的人也能過去處理
        if (c.state === 'leaving' || !near(c, c.karen ? 2.4 : 1.3)) continue;
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

    // 老闆自己洗廁所：員工看在眼裡
    bossCleanToilet() {
      if (!this.toiletOk) return false;
      const was = this.toiletClean;
      this.toiletClean = 100;
      this.boss.energy = clamp(this.boss.energy - 8, 0, 100);
      if (was < 80 && this.bossToiletDay !== this.day) {
        this.bossToiletDay = this.day;
        for (const e of this.staff) e.mood = clamp(e.mood + 2, 0, 100);
        this.jerk = clamp(this.jerk - 0.5, 0, JERK_LIMIT);
        this.say(this.boss, '廁所乾淨，客人才會再來！', 40);
      }
      return true;
    }

    bossOfficeRest() {
      if (!this.roomLv('office') || this.minute - (this.officeRestAt || -999) < 120) return false;
      this.officeRestAt = this.minute;
      this.boss.energy = clamp(this.boss.energy + (this.roomLv('office') >= 3 ? 35 : 22), 0, 100);
      this.say(this.boss, '關上門，喘口氣……', 40);
      return true;
    }

    bossGreet(c) {
      if (c.greeted) return false;
      c.greeted = true;
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
      b.away = { id: pl.id, until: this.minute + pl.minutes * (this.owner.car ? 0.7 : 1) };
      b.ride = false;
      this.notify(`${pl.icon} 老闆出門去${pl.name}了（約 ${pl.minutes} 分鐘）`);
      return true;
    }

    finishTrip() {
      const b = this.boss;
      if (b.away.kind === 'life') return this.resolveLifeAway();
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
        r.lines.push(cost ? `所有{w:supplies}都補滿了，花了 $${cost.toLocaleString()}（比平常便宜一成五）。` : '倉庫本來就是滿的，你逛了一圈什麼都沒買。');
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
            r.text = `算命阿姨看了你的手相：「${pick(['你今年犯小人，但是員工都是你的貴人', '三天之內，會有一個很奧的客人……但你會贏', '你的財庫在店門口，記得把騎樓掃乾淨', `你上輩子是開${this.ind.name}的，這輩子還是`, '你的員工如果離職，是因為你太常講幹話'])}。」`;
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
              r.text = `一個叫「${c.name}」的大學生說：「老闆你人好好，我可以去你那邊打工嗎？」${c.gender === 'f' ? '她' : '他'}明天會來面試。`;
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
      const names = { market: ['🏮', '夜市'], temple: ['🙏', '廟裡'], club: ['🪩', '夜店'], wholesale: ['📦', this.w('{w:supplier}')], rival: ['🏪', this.rival ? this.rival.name : '隔壁'] };
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
      if (fx.reviews) for (let i = 0; i < fx.reviews; i++) this.addReview(1, ['普普', '不用排', '隔壁比較好', '價格偏高'][i % 4], 'rival');
      if (fx.cost) this.costMult.materials += fx.cost;
      if (fx.followers) this.social.followers += fx.followers;
    }

    // ───── 聯名合作 ─────
    collabReady(pt) {
      if (pt.ind && !pt.ind.includes(this.ind.id)) return '跟你的店不搭';
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
        this.collabs.push({ id: pt.id, name: pt.name, icon: pt.icon, collab: this.w(pt.collab), until: this.day + pt.days, mult: pt.mult, types: pt.types });
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
        `你點了一份他們的招牌，味道……${r.quality > 0.55 ? '老實說還不錯，難怪有人排隊' : '普普，你偷偷鬆了一口氣'}。`,
        r.strength > 0.5 ? '店裡坐滿了人，你看到你的常客也在裡面，對方尷尬地跟你揮手。' : '店裡冷冷清清，店員在滑手機。',
        `他們的價格大概是你的${r.quality > 0.55 ? '一點一倍' : '九成'}。`,
      ];
      this.boss.energy = clamp(this.boss.energy - 3, 0, 100);
      return { name: r.name, strength: r.strength, lines };
    }

    // ───── 員工活動 ─────
    activityCost(a, n) {
      return Math.round((a.cost * (n + 1) * this.idx.cpi * (this.level >= 12 ? 0.8 : 1)) / 10) * 10;
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
          this.addReview(1, '聽說這間店下班還要上心靈成長課', 'image');
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
    sideNames(n) {
      const list = this.ownedSide().map((b) => b.name);
      return list.slice(0, n).join('、') || '什麼都做';
    }

    // 每天早上：兼營業務的麻煩和機會、員工被逼成十項全能的心聲
    planSideBizEvents() {
      if (!Fun.SIDE_EVENTS || !this.roster) return;
      const owned = this.ownedSide();
      if (!owned.length) return;
      const at = () => this.hours.open + 60 + this.rng() * Math.max(60, Math.min(this.hours.span, 600) - 120);
      const working = this.staff.filter((e) => this.roster.has(e.id));
      const pickStaff = () => working[Math.floor(this.rng() * working.length)] || null;
      this.sideEvDay = this.sideEvDay || {};
      const b = owned[Math.floor(this.rng() * owned.length)];
      const mk = Fun.SIDE_EVENTS[b.id];
      if (mk && this.day - (this.sideEvDay[b.id] ?? -99) >= 12 && this.rng() < 0.12 * this.diff.events + 0.04 * owned.length) {
        this.sideEvDay[b.id] = this.day;
        const e = pickStaff();
        this.pendingEvents.push({ ev: mk(this, e), at: at(), where: e ? 'staff' : 'phone', staffPref: e, subject: e || undefined });
        return;
      }
      // 業務比員工會的多太多：有人會來抱怨
      const lost = working.filter((e) => owned.filter((x) => !this.knows(e, x.id)).length >= 2 && !e.rank);
      if (owned.length >= 2 && lost.length && this.day - (this.sideEvDay._over ?? -99) >= 10 && this.rng() < 0.1 + owned.length * 0.03) {
        this.sideEvDay._over = this.day;
        const e = lost[Math.floor(this.rng() * lost.length)];
        const nb = owned.find((x) => !this.knows(e, x.id));
        const f = Fun.SIDE_OVERLOAD[owned.length >= 4 && this.rng() < 0.35 ? 1 : 0];
        this.pendingEvents.push({ ev: f(this, e, nb), at: at(), where: 'staff', staffPref: e, subject: e });
      }
    }

    // 後場的事件：每個房間各自的麻煩
    planRoomEvents() {
      if (!Fun.ROOM_EVENTS || !this.roster || !this.hasBackroom) return;
      const built = Object.keys(Fun.ROOM_EVENTS).filter((id) => this.roomLv(id) > 0);
      if (!built.length) return;
      this.roomEvDay = this.roomEvDay || {};
      const id = built[Math.floor(this.rng() * built.length)];
      const chance = (id === 'toilet' ? 0.07 + (this.toiletClean < 50 ? 0.06 : 0) + (this.policy.toiletOpen ? 0.04 : 0) : 0.04) * this.diff.events;
      if (this.day - (this.roomEvDay[id] ?? -99) < 8 || this.rng() >= chance) return;
      let list = Fun.ROOM_EVENTS[id];
      // 智慧倉儲有監視器：不會再有盤點對不上；辦公室有保險箱：收銀短少比較少見
      if (id === 'storage' && this.roomLv('storage') >= 3) list = list.filter((f) => f !== list[1]);
      if (id === 'office' && this.roomLv('office') >= 3 && this.rng() < 0.6) list = list.slice(0, 1);
      const mk = list[Math.floor(this.rng() * list.length)];
      const working = this.staff.filter((e) => this.roster.has(e.id));
      const e = working[Math.floor(this.rng() * working.length)] || null;
      this.roomEvDay[id] = this.day;
      const at = this.hours.open + 60 + this.rng() * Math.max(60, Math.min(this.hours.span, 600) - 120);
      this.pendingEvents.push({ ev: mk(this, e), at, where: e ? 'staff' : 'phone', staffPref: e, subject: e || undefined });
    }

    // 洗廁所都是同一個人：會來抗議
    toiletDutyEvent(e, n) {
      const others = this.staff.filter((o) => o !== e);
      return {
        id: 'rm_duty',
        icon: '🧽',
        title: `${e.name}：「為什麼每次都是我洗廁所？」`,
        text: `${e.name}拿著馬桶刷站在你面前：「這週廁所我洗了 ${n} 次，其他人一次都沒有。我是來上班的，不是專門來洗廁所的。」`,
        choices: [
          { label: '排輪值表，大家輪流', effects: { moodOf: [[e.id, 8], ...others.map((o) => [o.id, -2])] }, result: '輪值表貼在休息室，大家雖然有點哀怨，但都覺得公平。' },
          { label: '請清潔阿姨每週來兩次', note: '每週 $1,500', effects: { cash: -3000, moodOf: [[e.id, 10]], flag: 'cleaner' }, result: '清潔阿姨來了之後，廁所亮到可以照鏡子。' },
          { label: '老闆以身作則，這週你洗', effects: { moodOf: [[e.id, 6]], morale: 4, jerk: -2 }, result: '大家看到老闆蹲在馬桶旁邊刷，突然覺得洗廁所也沒那麼丟臉。' },
          { label: '「新人本來就要做這些」', effects: { moodOf: [[e.id, -14]], jerk: 2 }, result: `${e.name}沒再說話，那天下班走得特別快。` },
        ],
        ignore: { effects: { moodOf: [[e.id, -8]] }, result: `${e.name}繼續一個人洗廁所。` },
      };
    }

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

    // ───── 🤖 經營小幫手 ─────
    // 幫不熟經營遊戲的人顧好基本盤：人手、薪水、休息區、冷氣、價格、打掃，還有來不及處理的事件
    // 每做一件事都會說出來，讓玩家看得懂為什麼
    autoPlace(type) {
      const def = catalogById[type];
      if (!def || this.cash < def.price + 20000 || !this.unlocked(def)) return null;
      for (let z = 0; z < this.H; z++) {
        for (let x = this.W - 1; x >= 0; x--) {
          for (let rot = 0; rot < 4; rot++) {
            if (this.canPlace(type, x, z, rot)) {
              const o = this.place(type, x, z, rot);
              if (o) return o;
            }
          }
        }
      }
      return null;
    }

    helperSay(text) {
      this.notify(`🤖 小幫手：${text}`, 'helper');
    }

    // 好心的選擇：員工開心、不當慣老闆，其次才看錢
    kindChoice(ev) {
      let best = -1;
      let bs = -Infinity;
      ev.ev.choices.forEach((c, i) => {
        if (c.minigame) return;
        const fx = this.resolveEffects(c);
        if (fx.brawl || fx.leave || fx.demoteOf || fx.promoteOf) return;
        if (fx.cash < 0 && -fx.cash > this.cash * 0.6) return; // 不要為了當好人把店搞倒
        const mood = (fx.morale || 0) * 3 + (fx.moodOf ? fx.moodOf.reduce((t, [, d]) => t + d, 0) / 2 : 0);
        const sc = mood + (fx.cash || 0) / 2000 - (fx.jerk || 0) * 8 - (fx.karenServe ? 1 : 0) + (fx.review ? (fx.review[0] - 3) * 4 : 0);
        if (sc > bs) {
          bs = sc;
          best = i;
        }
      });
      return best;
    }

    // 事件放著不管太久，小幫手就照「好老闆」的方式處理
    helperEvents() {
      for (const ev of [...this.activeEvents]) {
        const waited = this.minute - (ev.spawnedAt ?? this.minute);
        if (waited < 30 && this.minute < ev.deadline - 10) continue;
        const i = this.kindChoice(ev);
        if (i < 0) continue;
        ev.by = '🤖 小幫手';
        const r = this.applyChoice(ev, ev.ev.choices[i]);
        if (r) {
          this.helperSay(this.w(`「${ev.ev.title}」放太久了，幫你選了「${ev.ev.choices[i].label}」`));
          if (this.cb.helped) this.cb.helped(r, ev);
        }
      }
    }

    // 每天打烊後：檢查人手、薪水、心情、設備、價格、清潔
    helperDaily(report) {
      const said = [];
      const say = (t) => said.length < 3 && said.push(t);
      // 一班超過九小時：改成兩班
      if (this.policy.shifts < 2 && this.hours.span > 9 * 60) {
        this.policy.shifts = 2;
        say('每一班太長了，改成早晚兩班（明天生效），員工比較不累、也省加班費');
      }
      // 人手：客人等到生氣、或每班人數不夠
      const cov = this.coverage();
      const angryRate = report.visitors ? report.angry / report.visitors : 0;
      const cap = cov.lanes * this.policy.shifts + 1;
      // 每個服務位都有人了還是有人等到生氣：問題是設備不夠，不是人不夠
      if (angryRate > 0.05 && cov.short === 0 && this.day - (this.helperStationTip || -99) >= 7) {
        this.helperStationTip = this.day;
        say(`昨天有 ${report.angry} 位客人等到生氣，但每個服務位都有人顧了：要多買一台設備，客人才消化得完（請到「🏗️ 建造」）`);
      }
      if (angryRate > 0.05 && cov.short >= 2 && this.staff.length < cap && this.cash > 30000 && this.candidates.length) {
        let bi = 0;
        this.candidates.forEach((c, i) => {
          if (c.skill - c.wage / 8 > this.candidates[bi].skill - this.candidates[bi].wage / 8) bi = i;
        });
        const c = this.candidates[bi];
        if (this.hire(bi)) say(`昨天有 ${report.angry} 位客人等到生氣離開，幫你錄取了${c.name}`);
      }
      // 薪水不能低於行情
      const low = this.staff.filter((e) => e.wage < this.marketWage);
      for (const e of low) this.setWage(e, this.marketWage);
      if (low.length) say(`物價漲了，把 ${low.map((e) => e.name).join('、')} 的時薪調到行情 $${this.marketWage}`);
      // 心情不好的人：稱讚、請喝飲料
      const sad = this.staff.filter((e) => e.mood < 50);
      for (const e of sad) {
        this.praise(e);
        this.treat(e);
      }
      if (sad.length) say(`${sad.map((e) => e.name).join('、')} 心情不太好，幫你稱讚了一下、請了飲料`);
      // 休息區、夏天的冷氣
      if (!this.restSpots().length && this.autoPlace('breaktable')) say('店裡沒有員工休息區，幫你買了一張休息桌');
      if (this.isSummer && !this.cooling && (this.autoPlace('aircon') || this.autoPlace('fan'))) say('夏天到了，幫你買了消暑的設備');
      // 價格跟著物價走
      let moved = 0;
      for (const p of this.ind.products) {
        const sug = Math.round((p.price * this.idx.cpi) / 5) * 5;
        if (this.prices[p.id] < sug * 0.95) {
          this.prices[p.id] = sug;
          moved++;
        }
      }
      if (moved) say(`物價漲了，${moved} 個品項調回建議價`);
      // 每週一次：評價很好卻在虧錢，就小漲 5%（最多到建議價的 1.3 倍）
      const lw = this.history[this.history.length - 1];
      if (this.weekday === 0 && lw && lw.week !== this.helperPriceWeek && lw.profit - (lw.other || 0) - (lw.rewards || 0) < 0 && this.rating >= 4.2) {
        this.helperPriceWeek = lw.week;
        let up = 0;
        for (const p of this.ind.products) {
          const cap = Math.round((p.price * this.idx.cpi * 1.3) / 5) * 5;
          const next = Math.min(cap, Math.round((this.prices[p.id] * 1.05) / 5) * 5 || this.prices[p.id] + 5);
          if (next > this.prices[p.id]) {
            this.prices[p.id] = next;
            up++;
          }
        }
        if (up) say(`上週虧錢，但客人很喜歡你們（${this.rating.toFixed(1)} ★），幫你把 ${up} 個品項小漲了 5%`);
      }
      // 太髒了就請清潔公司
      if (this.grime > 20 && this.cash > this.deepCleanCost + 30000) {
        this.deepClean();
        say('油垢太多了，幫你請清潔公司大掃除');
      }
      // 守法經營：加班費、勞健保、休息
      if (!this.policy.overtimePay || !this.policy.insurance || !this.policy.breaks) {
        Object.assign(this.policy, { overtimePay: true, insurance: true, breaks: true });
        say('把加班費、勞健保、休息時間都打開了（不然慣老闆指數會一直漲）');
      }
      // 現金快沒了：先借一點
      if (this.cash < 20000 && this.loan < 600000) {
        this.borrow(100000);
        say('現金快不夠了，先跟銀行借了 $100,000');
      }
      for (const t of said) this.helperSay(t);
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
        e.hint = list[Math.floor(this.rng() * list.length)].replace(/他/g, e.gender === 'f' ? '她' : '他');
      }
      if (e.gender === 'f' && e.hint) e.hint = e.hint.replace(/他/g, '她');
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
        // 記下升職前的樣子，試用期滿時拿來比較
        const lw = this.history[this.history.length - 1];
        const others = this.staff.filter((o) => o !== e);
        e.trialBase = { morale: others.length ? others.reduce((t, o) => t + o.mood, 0) / others.length : 70, angry: lw && lw.visitors ? lw.angry / lw.visitors : this.lastDay && this.lastDay.visitors ? this.lastDay.angry / this.lastDay.visitors : 0.03 };
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
      this.notify(`${R[rank].icon} ${e.name} 升為${R[rank].name}！${first ? `試用 14 天，三天後就會知道${e.gender === 'f' ? '她' : '他'}是哪一種主管。` : ''}`, 'good');
      return true;
    }

    // 技術職：「資深」不用帶人，時薪 +$15，做事快一點；適合技術好但不想（或不適合）當主管的人
    seniorBlock(e) {
      if (!e || e.senior) return '已經是資深了';
      if (this.day - e.hiredDay < 21) return '到職滿 3 週才能升資深';
      if (e.skill < 60) return '技能 60 以上才能升資深';
      return null;
    }

    promoteSenior(e, force) {
      if (!e || e.senior || (!force && this.seniorBlock(e))) return false;
      e.senior = true;
      e.wage += 15;
      e.mood = clamp(e.mood + (e.ambition >= 60 ? 8 : 12), 0, 100);
      e.askDay = this.day;
      e.asks = 0;
      this.say(e, '我是資深了！', 100);
      this.notify(`⭐ ${e.name} 升為資深（技術職，不用帶人，時薪 +$15）`, 'good');
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
      return Math.round((4000 * this.idx.cpi * (this.level >= 17 ? 0.8 : 1)) / 100) * 100;
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
        const rv = fx.review ? (fx.review[0] - 3) * (m.lead / 25) : 0; // 會帶人的店長比較懂得顧評價
        if (m.style === 'warm' || m.style === 'mentor') return mood * 2 + cash * 0.5 - jerk * 5 + rv;
        if (m.style === 'strict') return cash * 1.5 + mood * 0.3 - (lowLead ? 0 : jerk * 3) + rv;
        if (m.style === 'numbers') return cash * 2 + mood * 0.5 - jerk * 4 + rv;
        return this.rng() - jerk;
      };
      const best = choices.sort((a, b) => score(b) - score(a))[0];
      ev.by = `${(Fun.RANKS[m.rank] || {}).name || ''}${m.name}代理`;
      const r = this.applyChoice(ev, best.c);
      if (!r) return null;
      r.by = m;
      r.choice = best.c;
      if (this.cb.delegated) this.cb.delegated(r, ev, m);
      else this.notify(`👑 ${m.name} 幫你處理了「${ev.ev.title}」：${best.c.label}`);
      return r;
    }

    // 主管相關的事件：要求升遷、被投訴、摸魚、店長被挖角
    // 🔀 斜槓員工：副業的麻煩、兩幕的人生故事（第一幕選什麼，決定第二幕）
    planSideEvents() {
      const J = Fun.SIDE_JOBS;
      if (!J || !this.roster || !this.feature('slash')) return;
      const at = () => this.hours.open + 90 + this.rng() * Math.max(60, Math.min(this.hours.span, 600) - 150);
      const pool = this.staff.filter((e) => e.side && J[e.side] && this.roster.has(e.id));
      if (!pool.length || this.pendingEvents.length >= 5) return;
      const e = pool[Math.floor(this.rng() * pool.length)];
      const job = J[e.side];
      const weeks = (this.day - e.hiredDay) / 7;
      let ev = null;
      if (!e.story && weeks >= 2 && this.rng() < 0.2 * this.diff.events + 0.08) {
        ev = job.story.start(this, e);
        e.storyDay = this.day;
      } else if ((e.story === 'a' || e.story === 'b') && this.day - (e.storyDay || 0) >= 21 && this.rng() < 0.2 * this.diff.events + 0.08) {
        ev = job.story[e.story](this, e);
        e.story = 'done';
      } else if (this.day - (e.sideDay || -99) >= 10 && this.rng() < 0.12 * this.diff.events + 0.03) {
        ev = job.conflict(this, e);
        e.sideDay = this.day;
      }
      if (ev) this.pendingEvents.push({ ev, at: at(), where: 'staff', staffPref: e, subject: e });
    }

    planCareerEvents() {
      const C = Fun.CAREER;
      if (!C || !this.roster || !this.feature('career')) return;
      const at = () => this.hours.open + 90 + this.rng() * Math.max(60, Math.min(this.hours.span, 600) - 150);
      const onRoster = (e) => this.roster.has(e.id);
      // 試用期評估優先
      this.trialQueue = (this.trialQueue || []).filter((id) => this.staff.some((e) => e.id === id && e.rank));
      const tr = this.trialQueue.map((id) => this.staff.find((e) => e.id === id)).find((e) => onRoster(e));
      if (tr && C.trial) {
        this.trialQueue = this.trialQueue.filter((id) => id !== tr.id);
        const others = this.staff.filter((o) => o !== tr);
        const base = tr.trialBase || { morale: 70, angry: 0.03 };
        const st = { moraleBefore: base.morale, angryBefore: base.angry, moraleNow: others.length ? others.reduce((t, o) => t + o.mood, 0) / others.length : 70, angryNow: tr.kpi.visitors ? tr.kpi.angry / tr.kpi.visitors : 0 };
        this.pendingEvents.push({ ev: C.trial(this, tr, st), at: this.hours.open + 30, where: 'staff', staffPref: tr });
        return;
      }
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
        // 試用期滿：下次上班時跳出評估
        if (d === 14 && !(this.trialQueue || []).includes(e.id)) (this.trialQueue = this.trialQueue || []).push(e.id);
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
      // 有辦公室：叫進來當面稱讚，效果更好
      e.mood = clamp(e.mood + (this.roomLv('office') ? 11 : 8), 0, 100);
      this.jerk = clamp(this.jerk - 0.5, 0, JERK_LIMIT);
      this.say(e, ['被老闆稱讚了！', '今天做得很有成就感', '嘿嘿 ✨'][Math.floor(this.rng() * 3)], 90);
      return true;
    }

    scold(e) {
      const k = e.traits.includes('fragile') ? TRAITS.fragile.scold : 1;
      e.mood = clamp(e.mood - 15 * k, 0, 100);
      e.hustle = this.minute + 60;
      this.scoldCount = (this.scoldCount || 0) + 1;
      this.jerk = clamp(this.jerk + 3, 0, JERK_LIMIT);
      // 沒有辦公室：當著大家的面罵，其他人心情也會變差
      if (!this.roomLv('office')) for (const o of this.staff) if (o !== e) o.mood = clamp(o.mood - 2, 0, 100);
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
        // 每人每週輪休兩天（平均錯開，不要好幾個人同一天休）
        return !this.rotateRest(i, this.weekday);
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
    // 輪休：第 i 個人哪兩天休。休假的起始日平均分散在一週裡
    rotateRest(i, wd) {
      const off = Math.round((i * 7) / Math.max(1, this.staff.length));
      return (wd + off) % 7 < 2;
    }

    // 最近到職的一般員工（事件用：新人沒人教、離職代辦）
    newestStaff(maxDays, maxSkill = 101) {
      return this.staff.filter((e) => !e.rank && this.day - e.hiredDay <= maxDays && e.skill < maxSkill).sort((a, b) => b.hiredDay - a.hiredDay)[0] || null;
    }

    // 一週每天每班大概有幾個人（固定班先算，「自動」的平均分到人少的班），跟服務位比
    coverage() {
      if (this.gridDirty || !this.stations) this.rebuildGrid();
      const n = this.policy.shifts;
      // 兼營業務的服務位不算進「需要幾個人」：那是同一批人兼著做，不然會一直請人
      const lanes = this.stations.reduce((t, o) => t + (o.def.side ? 0 : o.lanes.filter((l) => !l.self).length), 0) + Math.min(2, this.ownedSide().filter((b) => !b.self).length * 0.5);
      const days = [];
      for (let i = 0; i < 7; i++) {
        if (this.policy.closedDay === i) {
          days.push(null);
          continue;
        }
        const per = Array(n).fill(0);
        let auto = 0;
        for (const e of this.staff) {
          const p = this.plannedShift(e, i);
          if (p === null) continue;
          if (p === 'auto') auto++;
          else per[p]++;
        }
        for (; auto > 0; auto--) per[per.indexOf(Math.min(...per))]++;
        days.push(per);
      }
      const short = days.filter((d) => d && Math.min(...d) < lanes).length;
      return { lanes, days, short };
    }

    plannedShift(e, wd) {
      if (this.policy.closedDay === wd) return null;
      if (Array.isArray(e.restDays)) {
        if (e.restDays.includes(wd)) return null;
      } else if (this.policy.restDays === 'rotate' && this.staff.length >= 2 && this.rotateRest(this.staff.indexOf(e), wd)) return null;
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
      // 店裡越漂亮，客人越能接受比較高的價格
      const effRatio = 1 + (avgRatio - 1) * (1 - this.priceTolerance);
      const priceF = effRatio <= 1.05 ? Math.pow(effRatio, -0.8) : Math.pow(1.05, -0.8) * Math.pow(effRatio / 1.05, -3);
      // 裝潢：沒有上限但效果遞減；風格鮮明再加一點
      const D = this.decor;
      const beautyF = 1 + 0.3 * (1 - Math.exp(-D.A / 35)) + 0.22 * (1 - Math.exp(-this.draw / 0.25)) + (D.theme ? 0.04 : 0);
      const lotF = 1 + this.lotIdx * 0.35;
      const summer = this.isSummer ? this.ind.summerBoost || 1 : 1;
      const heat = this.isSummer && !this.cooling ? 0.9 : 1;
      const mods = this.demandMods.reduce((m, d) => m * d.mult, 1);
      const cleanF = 0.82 + 0.18 * (this.cleanliness / 100);
      const loyal = this.loyalty ? 1.04 : 1;
      // 菜單越豐富，越多人想進來看看
      const variety = 1 + Math.max(0, this.availableProducts().filter((p) => !p.side).length - this.ind.products.filter((p) => !p.rd && !p.side).length) * 0.035;
      const raw = (this.level >= 30 ? 1.03 : 1) * ratingF * priceF * beautyF * lotF * summer * heat * mods * this.festivalMult() * cleanF * loyal * variety * this.socialBoost * this.petMult * (this.copiedDish ? 1.04 : 1) * this.collabMult * this.rivalPull();
      // 平衡：一間店能吸引的人有上限感：各種加成疊上去，超過的部分效果打三折（不會無限暴衝）
      const soft = 1.5 + this.lotIdx * 0.3;
      return raw <= soft ? raw : soft + (raw - soft) * 0.3;
    }

    availableProducts() {
      if (this.gridDirty) this.rebuildGrid();
      const have = new Set(this.stations.flatMap((s) => s.def.serves));
      const down = this.sideDownUntil || {};
      return this.ind.products.filter((p) => this.menu[p.id] && this.hasRecipe(p) && have.has(p.id) && !(down[p.id] >= this.day));
    }

    // ───── 兼營業務 ─────
    sideProducts() {
      if (this._sideT === this.minute) return this._side;
      this._sideT = this.minute;
      this._side = this.availableProducts().filter((p) => p.side);
      return this._side;
    }

    // 店裡各類客人的比例（照營業時段平均，平日 5 天、假日 2 天）
    // neutral：不看產業和裝潢，只看營業時段（用來當「普通」的基準）
    typeMix(neutral) {
      const out = {};
      for (const t of Object.values(CUSTOMER_TYPES)) out[t.id] = 0;
      const th = neutral ? null : this.themeInfo;
      let n = 0;
      for (const [weekend, days] of [[false, 5], [true, 2]]) {
        for (let m = this.hours.open; m < this.hours.close; m += 60) {
          const h = Math.floor(m / 60) % 24;
          let tot = 0;
          const ws = {};
          for (const t of Object.values(CUSTOMER_TYPES)) {
            let w = t.hours[h] ?? t.base;
            if (weekend) w *= t.weekend;
            if (!neutral) {
              w *= (this.ind.mix && this.ind.mix[t.id]) || 1;
              if (th && th.types[t.id]) w *= th.types[t.id];
              if (this.collabs.some((c) => c.types.includes(t.id))) w *= 1.25;
            }
            ws[t.id] = w;
            tot += w;
          }
          for (const k in ws) out[k] += (ws[k] / tot) * days;
          n += days;
        }
      }
      for (const k in out) out[k] /= n || 1;
      return out;
    }

    // 這項兼營業務適不適合這間店：客群、店面大小、和其他業務會不會打架
    // 回傳 { mult: 客流倍率, stars: 1~5, notes: [原因] }
    sideFit(b) {
      const key = `${this.day}|${this.objects.length}|${this.lotIdx}|${this.decor.theme || ''}|${this.collabs.length}|${this.policy.petFriendly ? 1 : 0}`;
      if (this._fitKey !== key) {
        this._fitKey = key;
        this._fit = {};
        this._mix = this.typeMix();
        this._mix0 = this.typeMix(true);
      }
      if (this._fit[b.id]) return this._fit[b.id];
      const notes = [];
      const aud = b.aud || {};
      const score = (mix) => Object.entries(mix).reduce((t, [k, v]) => t + v * (aud[k] ?? 1), 0);
      const ratio = score(this._mix) / score(this._mix0);
      // 客群差一點點，生意就差很多（比例放大）
      let mult = clamp(Math.pow(ratio, 3), 0.45, 1.5);
      const best = Object.entries(aud).sort((a, b2) => b2[1] - a[1])[0];
      const tn = (k) => (CUSTOMER_TYPES[k] ? CUSTOMER_TYPES[k].name : k);
      if (best && best[1] > 1.2) {
        const share = this._mix[best[0]] / (this._mix0[best[0]] || 1);
        if (ratio >= 1.04) notes.push(`👍 你的店${tn(best[0])}多，很對味`);
        else if (ratio <= 0.96) notes.push(`👎 主要客群是${tn(best[0])}，你的店${share < 1 ? `${tn(best[0])}不多` : '客群不太對'}`);
      }
      // 要坐下來做很久的服務：店面太小會擠、客人坐不住
      if (b.seat) {
        const sp = [0.8, 1, 1.08, 1.12][this.lotIdx] || 1;
        if (sp < 1) notes.push('📏 店面小，坐著做的服務會很擠');
        mult *= sp;
      }
      const owned = new Set(this.ownedSide().map((x) => x.id));
      for (const [a, list] of Object.entries(SIDE_CLASH || {})) {
        const other = a === b.id ? list.find((x) => owned.has(x)) : list.includes(b.id) && owned.has(a) ? a : null;
        if (other) {
          const o = this.ind.products.find((p) => p.id === other);
          notes.push(`⚠️ 和「${o ? o.name : other}」互相干擾`);
          mult *= 0.75;
        }
      }
      if (b.id === 'sb_pet' && this.policy.petFriendly) {
        notes.push('🐾 寵物友善店，毛孩家長會專程來');
        mult *= 1.3;
      }
      const stars = mult >= 1.35 ? 5 : mult >= 1.1 ? 4 : mult >= 0.9 ? 3 : mult >= 0.7 ? 2 : 1;
      if (!notes.length) notes.push(stars >= 3 ? '客群普通，中規中矩' : '這間店不太需要');
      return (this._fit[b.id] = { mult, stars, notes });
    }

    // 這個時段每小時大約幾位客人
    sideRate(p) {
      const b = p.side;
      if (b.months && !b.months.includes(this.monthOfYear)) return 0;
      let r = b.rate * (b.hours && b.hours[this.hour] != null ? b.hours[this.hour] : b.base ?? 0.4);
      const wx = this.weather ? this.weather.id : 'sunny';
      const wet = wx === 'rain' || wx === 'typhoon';
      if (b.rain) r *= wet ? b.rain : 1;
      if (b.summer && this.isSummer) r *= b.summer;
      if (b.winter && [12, 1, 2].includes(this.monthOfYear)) r *= b.winter;
      if (b.weekend && this.weekday >= 5) r *= b.weekend;
      // 店的名聲好，來辦事的人也多一點（但沒有本業那麼敏感）
      r *= Math.sqrt(Math.max(0.3, this.attractiveness()));
      // 適不適合這間店
      r *= this.sideFit(b).mult;
      if (this.sideHot && this.sideHot.id === p.id && this.sideHot.until >= this.day) r *= this.sideHot.mult;
      // 要堆貨的業務：沒有儲藏室就做不大
      if (['sb_parcel', 'sb_parcelb', 'sb_dumpling', 'sb_newyear'].includes(p.id)) r *= [0.6, 1, 1.15, 1.3][this.roomLv('storage')];
      return r;
    }

    // 店裡開了幾項兼營業務
    get sideCount() {
      return this.ownedSide().length;
    }

    // ───── 🧑 人生篇章：老闆自己的人生 ─────
    static ownerDefaults() {
      return { wealth: 0, taken: 0, stress: 20, health: 85, age: 32, partner: null, kids: 0, parents: 'ok', familyBond: 60, house: false, car: false, gym: false, filial: false, emba: false, nanny: false, trips: 0, parentTrips: 0, donated: 0, loan: 0, milestones: [], healthyWeeks: 0 };
    }

    // 老闆個人的錢不夠付：只好動用公司的錢（員工會察覺）
    payPersonal(amount, what) {
      const o = this.owner;
      if (o.wealth >= amount) {
        o.wealth -= amount;
        return true;
      }
      const lack = amount - o.wealth;
      o.wealth = 0;
      this.cash -= lack;
      this.ledger.other -= lack;
      this.jerk = clamp(this.jerk + 0.3, 0, JERK_LIMIT);
      if (this.rng() < 0.3) this.notify(`💸 老闆個人的錢不夠付${what}，從公司帳上挪了 $${Math.round(lack).toLocaleString()}。會計小聲說：「這樣公司和私人的帳會混在一起……」`, 'bad');
      return false;
    }

    // 花老闆自己的錢（只能用個人財富）
    lifeSpend(id) {
      const L = Fun.LIFE_SPEND && Fun.LIFE_SPEND[id];
      const o = this.owner;
      if (!L || !L.ok(this) || o.wealth < L.cost) return false;
      o.wealth -= L.cost;
      if (L.once) o[L.once] = true;
      if (id === 'trip') {
        o.trips += 1;
        this.lifeAway(5, 'trip');
      } else if (id === 'parents') {
        o.parentTrips += 1;
        o.familyBond = clamp(o.familyBond + 15, 0, 100);
        this.lifeAway(5, 'parents');
      } else if (id === 'donate') {
        o.donated += L.cost;
        this.social.followers += 300;
        this.jerk = clamp(this.jerk - 3, 0, JERK_LIMIT);
        this.addReview(5, '老闆有在做公益，支持！');
      } else if (id === 'emba') {
        this.costMult.materials = Math.max(0.6, (this.costMult.materials || 1) - 0.04);
        for (const b of this.branches) if (b.manager) b.manager.lead = Math.min(100, b.manager.lead + 5);
      }
      this.notify(`${L.icon} ${L.name}：${L.desc}`, 'good');
      this.checkLifeMilestones();
      return true;
    }

    // 老闆離開幾天（度假、陪家人、住院）：店交給員工
    lifeAway(days, what) {
      const b = this.boss;
      if (b.away) return false;
      this.bossLeaveLane && this.bossLeaveLane();
      b.away = { kind: 'life', what, until: Infinity, untilDay: this.day + days, days, cash0: this.cash, log0: this.eventSeq || 0 };
      return true;
    }

    resolveLifeAway() {
      const b = this.boss;
      const a = b.away;
      b.away = null;
      const o = this.owner;
      const r = { place: { icon: { trip: '✈️', parents: '👴', hospital: '🏥', rest: '🏔️', family: '👪' }[a.what] || '🧳', name: { trip: '度假回來了', parents: '帶爸媽出國回來了', hospital: '出院了', rest: '休息回來了', family: '陪家人回來了' }[a.what] || '回來了' }, lines: [], chips: [] };
      const evs = (this.eventLog || []).slice(0, Math.max(0, (this.eventSeq || 0) - a.log0));
      const byStaff = evs.filter((x) => x.by && x.by !== '你' && x.by !== '逾時沒處理').length;
      const missed = evs.filter((x) => x.by === '逾時沒處理').length;
      if (a.what === 'trip' || a.what === 'rest') {
        o.stress = a.what === 'trip' ? 0 : Math.max(0, o.stress - 40);
        o.health = clamp(o.health + 10, 0, 100);
        r.chips.push('🧘 壓力歸零', '❤️ 健康 +10');
        const souvenir = this.staff.length * 150;
        if (this.cash > souvenir) {
          this.cash -= souvenir;
          this.ledger.welfare += souvenir;
          for (const e of this.staff) e.mood = clamp(e.mood + 4, 0, 100);
          r.chips.push('🎁 帶伴手禮給大家（心情 +4）');
        }
      } else if (a.what === 'parents') {
        o.stress = Math.max(0, o.stress - 50);
        r.chips.push('🧘 壓力 -50', '👴 家人很開心');
      } else if (a.what === 'hospital') {
        o.health = clamp(o.health + 25, 0, 100);
        o.stress = Math.max(0, o.stress - 20);
        r.chips.push('❤️ 健康 +25');
      }
      r.lines.push(`你不在的 ${a.days} 天：店裡現金 ${this.cash - a.cash0 >= 0 ? '+' : ''}$${Math.round(this.cash - a.cash0).toLocaleString()}。`);
      r.lines.push(byStaff || missed ? `店長和授權制度幫你處理了 ${byStaff} 件事${missed ? `，有 ${missed} 件沒人處理（下次記得設好授權、派店長在班）` : '，一切平安'}。` : '這幾天店裡很平靜。');
      if (this.cb.tripDone) this.cb.tripDone(r);
    }

    // 每天：壓力和健康
    lifeDaily(report) {
      const o = this.owner;
      const t = this.today;
      const noMgr = this.branches.filter((b) => !b.manager).length;
      // 平衡：一間店、天天開、自己處理事件，壓力會慢慢累積（大約兩個月需要休息一次）
      let d = (t.bossEvents || 0) * 0.8 + (t.ignoredEvents || 0) * 1.5 + this.branches.length * 0.5;
      d += this.policy.closedDay === -1 && !this.boss.away ? 3 : -1;
      if (t.visitors) d += (t.angry / t.visitors) * 15;
      if ((t.revenue || 0) < (report.wages || 0)) d += 3;
      d += noMgr * 0.8 + (o.emba ? 0.6 : 0) + (o.kids && !o.familyTime ? 1 : 0);
      const authOn = this.feature('auth') && Object.entries(this.policy.auth || {}).some(([k, v]) => k !== 'budget' && v && v !== 'off');
      d -= 3 + (authOn ? 1 : 0) + (o.gym ? 1 : 0) + (o.car ? 1 : 0) + (o.house ? 2 : 0) + (o.partner === 'married' ? 1 : 0) + (this.areaManager ? 1 : 0);
      if (this.boss.away) d -= 4;
      if (this.level >= 33) d -= 1;
      o.stress = clamp(o.stress + d, 0, 100);
      o.health = clamp(o.health + (o.stress > 80 ? -1.5 : o.stress > 60 ? -0.5 : o.stress < 40 ? 0.4 + (o.gym ? 0.3 : 0) : 0), 0, 100);
      if (o.kids) o.familyBond = clamp(o.familyBond + (o.familyTime ? 0.5 : -0.4), 0, 100);
      if (o.stress >= 70 && !o.stressWarned) {
        o.stressWarned = true;
        this.notify('🌋 老闆的壓力已經很大了：多授權、找店長、排公休，或去度個假（到「成長 → 老闆的人生」）', 'bad');
      } else if (o.stress < 55) o.stressWarned = false;
      // 身體撐不住：直接送醫
      if ((o.health < 25 || o.stress >= 98) && !this.boss.away) {
        o.health = Math.max(o.health, 25);
        this.payPersonal(50000, '醫藥費');
        this.lifeAway(4, 'hospital');
        this.notify('🚑 老闆累倒送醫了，要住院 4 天。店交給大家了……', 'bad');
      }
    }

    // 每週：房貸、油錢、保母、孝親費；人生事件；里程碑
    lifeWeekly() {
      const o = this.owner;
      if (o.house) this.payPersonal(9000, '房貸');
      if (o.car) this.payPersonal(2000, '車子的油錢和保養');
      if (o.nanny) this.payPersonal(8000, '保母費');
      if (o.filial && this.week % 4 === 0) this.payPersonal(10000, '孝親費');
      if (o.partnerRisk && o.partner === 'dating' && this.rng() < 0.15) {
        o.partner = null;
        o.partnerRisk = false;
        o.stress = clamp(o.stress + 20, 0, 100);
        this.notify('💔 另一半說：「我等不到你把店放下的那一天。」你們分手了。', 'bad');
      }
      o.healthyWeeks = o.health >= 80 ? (o.healthyWeeks || 0) + 1 : 0;
      if (this.week % 48 === 0) o.age += 1;
      if (Fun.LIFE_EVENTS && !this.boss.away && this.rng() < 0.32) {
        const ok = Fun.LIFE_EVENTS.filter((x) => x.ok(this));
        if (ok.length) this.lifeEventNext = ok[Math.floor(this.rng() * ok.length)];
      }
      this.checkLifeMilestones();
    }

    checkLifeMilestones() {
      const o = this.owner;
      for (const m of Fun.LIFE_MILESTONES || []) {
        if (!o.milestones.includes(m.id) && m.check(this)) {
          o.milestones.push(m.id);
          o.stress = clamp(o.stress - 5, 0, 100);
          this.notify(`🧑 人生篇章：${m.icon} ${m.name}（${m.desc}）`, 'achieve');
        }
      }
    }

    // ───── 🐾 寵物 ─────
    get shopCat() {
      return (this.pets || []).some((p) => p.kind === 'cat');
    }

    petInfo(p) {
      return Fun.PETS && Fun.PETS[p.kind];
    }

    // 寵物越開心，吸引力越強；寵物友善店也會多一些帶毛孩的客人
    get petMult() {
      let m = 1;
      for (const p of this.pets || []) {
        const P = this.petInfo(p);
        if (P) m *= 1 + P.draw * (0.4 + p.joy / 166);
      }
      if (this.policy.petFriendly) m *= this.policy.petStrict ? 1.03 : 1.06;
      return m;
    }

    petMoodFor(e) {
      let t = 0;
      for (const p of this.pets || []) {
        const P = this.petInfo(p);
        if (!P) continue;
        if (e.allergic && !e.allergyOk && (p.kind === 'cat' || p.kind === 'dog')) t -= 6;
        else t += P.mood;
      }
      return Math.min(6, t);
    }

    adoptPet(kind, name, free) {
      const P = Fun.PETS && Fun.PETS[kind];
      if (!P || this.pets.length >= 3 || (!free && this.cash < P.adopt)) return null;
      if (!free) {
        this.cash -= P.adopt;
        this.ledger.other -= P.adopt;
      }
      const traits = Object.keys(Fun.PET_TRAITS);
      const used = new Set(this.pets.map((p) => p.name));
      const nm = name || P.names.find((n) => !used.has(n)) || P.names[0];
      const p = { id: uid++, kind, name: nm, trait: traits[Math.floor(this.rng() * traits.length)], joy: 75, health: 90, since: this.day };
      this.pets.push(p);
      this.notify(`${P.icon} ${nm} 成為店裡的一份子了！（${Fun.PET_TRAITS[p.trait].name}）`, 'achieve');
      return p;
    }

    // 送養：找一個好人家（不會傷心，但常客會想念）
    rehomePet(id) {
      const p = this.pets.find((x) => x.id === id);
      if (!p) return false;
      this.pets = this.pets.filter((x) => x !== p);
      for (const e of this.staff) e.mood = clamp(e.mood - 4, 0, 100);
      this.notify(`🏡 ${p.name} 被一位常客帶回家照顧了。大家有點捨不得。`);
      return true;
    }

    vetPet(id) {
      const p = this.pets.find((x) => x.id === id);
      const P = p && this.petInfo(p);
      if (!P || this.cash < P.vet || p.vetDay === this.day) return false;
      this.cash -= P.vet;
      this.ledger.other -= P.vet;
      p.health = 100;
      p.vetDay = this.day;
      return true;
    }

    // 摸摸、陪玩：每隻每天一次
    playPet(id) {
      const p = this.pets.find((x) => x.id === id);
      if (!p || p.playDay === this.day) return false;
      p.playDay = this.day;
      p.joy = clamp(p.joy + (p.kind === 'dog' ? 20 : 12), 0, 100);
      this.boss.energy = clamp(this.boss.energy + 4, 0, 100);
      return true;
    }

    // 每天打烊：飼料錢、心情和健康慢慢變化；狗要有人帶去散步
    petDaily(report) {
      for (const p of this.pets || []) {
        const P = this.petInfo(p);
        if (!P) continue;
        const food = Math.round(P.weekly / 7);
        this.cash -= food;
        this.ledger.other -= food;
        p.joy = clamp(p.joy - (p.trait === 'lazy' ? 2 : 4) - (p.calm ? 2 : 0), 0, 100);
        p.health = clamp(p.health - (p.joy < 35 ? 2.5 : 0.8) - (p.trait === 'shy' && this.today.visitors > 250 ? 1.5 : 0), 0, 100);
        if (P.walk) {
          // 有三個人以上在班，就有人帶牠去散步（那個人會累一點）
          const here = this.staff.filter((e) => this.roster && this.roster.has(e.id));
          if (here.length >= 3) {
            const w = here[Math.floor(this.rng() * here.length)];
            w.energy = clamp(w.energy - 8, 0, 100);
            p.joy = clamp(p.joy + 8, 0, 100);
          } else p.joy = clamp(p.joy - 6, 0, 100);
        }
      }
    }

    planPetEvents() {
      if (!this.roster) return;
      const at = () => this.hours.open + 60 + this.rng() * Math.max(60, Math.min(this.hours.span, 600) - 120);
      this.petEvDay = this.petEvDay || -99;
      if (this.pets.length && Fun.PET_EVENTS && this.day - this.petEvDay >= 6 && this.rng() < 0.12 * this.diff.events + 0.03 * this.pets.length) {
        const p = this.pets[Math.floor(this.rng() * this.pets.length)];
        const ok = Fun.PET_EVENTS.filter((x) => x.ok(this, p));
        if (ok.length) {
          this.petEvDay = this.day;
          this.pendingEvents.push({ ev: ok[Math.floor(this.rng() * ok.length)].make(this, p), at: at(), where: 'staff' });
          return;
        }
      }
      if (this.policy.petFriendly && Fun.PET_FRIENDLY_EVENTS && this.day - this.petEvDay >= 6 && this.rng() < (this.policy.petStrict ? 0.05 : 0.1) * this.diff.events) {
        this.petEvDay = this.day;
        const f = Fun.PET_FRIENDLY_EVENTS.filter((x, i) => !(this.policy.petStrict && i < 2));
        this.pendingEvents.push({ ev: f[Math.floor(this.rng() * f.length)](this), at: at(), where: 'staff' });
      }
    }

    // ───── 🚪 後場：儲藏室、休息室、辦公室、廁所 ─────
    roomLv(id) {
      return (this.rooms && this.rooms[id]) || 0;
    }

    roomLevel(id) {
      const lv = this.roomLv(id);
      return lv && Fun.ROOMS ? Fun.ROOMS[id].levels[lv - 1] : null;
    }

    roomCost(id) {
      const R = Fun.ROOMS && Fun.ROOMS[id];
      const L = R && R.levels[this.roomLv(id)];
      return L ? Math.round((L.cost * (this.ind.cash / 320000)) / 1000) * 1000 : null;
    }

    buildRoom(id) {
      const R = Fun.ROOMS && Fun.ROOMS[id];
      const cost = this.roomCost(id);
      if (!R || cost == null || this.level < R.lv || this.cash < cost || !this.backDoorCell()) return false;
      this.cash -= cost;
      this.ledger.other -= cost;
      this.rooms[id] += 1;
      if (id === 'toilet') this.toiletClean = 100;
      this.styleVer = (this.styleVer || 0) + 1;
      this.notify(`🚪 後場的${R.name}${this.rooms[id] > 1 ? '升級成' : '蓋好了：'}「${R.levels[this.rooms[id] - 1].name}」`, 'achieve');
      return true;
    }

    get hasBackroom() {
      return !!this.rooms && Object.values(this.rooms).some((v) => v > 0);
    }

    // 通往後場的門：後牆最右邊一格可以走的地方
    backDoorCell() {
      for (let x = this.W - 1; x >= 0; x--) if (this.passable(x, 0)) return { x, z: 0 };
      return null;
    }

    // 後場的四個房間由左到右：儲藏室、休息室、辦公室、廁所（世界座標）
    roomSlot(id) {
      const i = ['storage', 'rest', 'office', 'toilet'].indexOf(id);
      const w = this.W / 4;
      return { x0: i * w, x1: (i + 1) * w };
    }

    roomOccupants(id) {
      return [...this.staff, ...this.customers].filter((a) => a.inRoom && a.inRoom.id === id);
    }

    enterRoom(a, id, mins) {
      const k = this.roomOccupants(id).length;
      const sl = this.roomSlot(id);
      const wx = Math.min(sl.x1 - 0.45, sl.x0 + 0.45 + (k % 3) * 0.6);
      const wz = -0.85 - (Math.floor(k / 3) % 2) * 0.9;
      a.inRoom = { id, until: this.minute + mins, from: { x: Math.round(a.x), z: Math.round(a.z) } };
      a.path = [];
      a.x = wx - 0.5;
      a.z = wz - 0.5;
      a.moving = false;
    }

    exitRoom(a) {
      const d = this.backDoorCell() || (a.inRoom && a.inRoom.from) || { x: 0, z: 0 };
      a.x = d.x;
      a.z = d.z;
      a.inRoom = null;
    }

    get toiletOk() {
      return this.roomLv('toilet') > 0 && !(this.toiletDownUntil >= this.day) && !!this.backDoorCell();
    }

    // 有人上完廁所：廁所變髒
    useToilet(a) {
      const L = this.roomLevel('toilet');
      if (!L) return;
      this.toiletClean = clamp(this.toiletClean - L.dirt * (a.borrow ? 1.3 : 1), 0, 100);
      this.today.toilet = (this.today.toilet || 0) + 1;
    }

    // 上完廁所：借廁所的人可能順便買東西；內用客人這時候才給評價
    afterToilet(c) {
      if (c.borrow) {
        this.today.borrow = (this.today.borrow || 0) + 1;
        if (this.rng() < 0.3) {
          const core = this.availableProducts().filter((p) => !p.side);
          const q = core[Math.floor(this.rng() * core.length)];
          if (q) {
            const v = Math.round(this.effPrice(q.id) * 0.9);
            const k = Math.round(q.cost * this.idx.cpi);
            this.cash += v - k;
            this.ledger.revenue += v;
            this.ledger.materials += k;
            this.today.revenue += v;
            this.popup(c, `借完順便買${q.icon}`, 'good');
          }
        } else if (this.rng() < 0.15) this.popup(c, '謝啦～', 'muted');
        this.customerLeave(c, 'done');
        return;
      }
      const L = this.roomLevel('toilet');
      if (c.stars != null) {
        c.stars = clamp(c.stars + (L ? L.stars : 0) - (this.toiletClean < 40 ? 0.8 : 0), 1, 5);
        if (this.toiletClean < 40) c.whyLow = 'toilet';
      }
      this.reviewFor(c);
      this.customerLeave(c, 'done');
    }

    // 店裡有開的兼營業務
    ownedSide() {
      if (this.gridDirty || !this.stations) this.rebuildGrid();
      return (SIDE_BIZ[this.ind.id] || []).filter((b) => this.stations.some((o) => o.def.side === b.id));
    }

    knows(e, id) {
      return !!(e.skills && e.skills.includes(id));
    }

    // 教員工一項新業務：花錢上課，馬上學會
    trainSkill(e, id) {
      const b = (SIDE_BIZ[this.ind.id] || []).find((x) => x.id === id);
      const cost = this.skillCost;
      if (!b || this.knows(e, id) || this.cash < cost || e.trainDay === this.day) return false;
      this.cash -= cost;
      this.ledger.welfare = (this.ledger.welfare || 0) + cost;
      e.skills = [...(e.skills || []), id];
      e.trainDay = this.day;
      e.mood = clamp(e.mood + 2, 0, 100);
      this.say(e, `學會${b.name}了！`, 60);
      return true;
    }

    // 兼營業務的上課費（Lv.27 打八折）
    get skillCost() {
      return Math.round((this.marketWage * 16 * (this.level >= 27 ? 0.8 : 1)) / 100) * 100;
    }

    hasRecipe(p) {
      return !p.rd || this.recipes.has(p.id);
    }

    // 菜單上有在賣的品項（用來算價格高低）
    menuProducts() {
      const list = this.ind.products.filter((p) => !p.side && this.menu[p.id] && this.hasRecipe(p));
      return list.length ? list : this.ind.products.filter((p) => !p.rd && !p.side);
    }

    priceRatio() {
      const ps = this.menuProducts();
      return ps.reduce((s, p) => s + this.effPrice(p.id) / (p.price * this.idx.cpi), 0) / ps.length;
    }

    // 研發新品：花錢、要等級
    rdCost(p) {
      return Math.round((p.rd * (this.level >= 13 ? 0.8 : 1)) / 100) * 100;
    }

    research(id) {
      const p = this.ind.products.find((x) => x.id === id);
      const rd = this.rdCost(p);
      if (!p || !p.rd || this.recipes.has(id) || this.level < (p.lv || 1) || this.cash < rd) return false;
      this.cash -= rd;
      this.ledger.other -= rd;
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
      // 兼營業務的客人：指定要辦的事；一般客人只點本業的品項
      const prods = opt.product ? [opt.product] : this.availableProducts().filter((p) => !p.side);
      if (opt.borrow) {
        // 借廁所的人：隨便給一個品項當預設（不會真的點）
        const t = this.pickType();
        const c = { id: uid++, kind: 'customer', borrow: true, type: t ? t.id : 'family', look: this.rng() < 0.3 ? { ...this.typeLook(t), hat: 'cap', hatColor: '#e0478a', shirt: '#e0478a', extra: null } : this.typeLook(t), product: prods[0], qty: 1, x: this.rng() < 0.5 ? -OUT_W : this.W + OUT_W - 1, z: this.H, path: [], state: 'arriving', waited: 0, patience: 8, speed: 1.2, progress: 0 };
        this.customers.push(c);
        this.today.visitors++;
        this.walkTo(c, { x: this.doorX + (this.rng() < 0.5 ? 0 : 1), z: this.H - 1 });
        return;
      }
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
        patience: 16 * (this.ind.patience || 1) * this.diff.patience * (opt.rider ? 1.4 : 1) * (type ? type.patience : 1) * (this.level >= 19 ? 1.1 : 1) * (this.level >= 38 ? 1.05 : 1) * (this.pets.some((p) => p.kind === 'dog' && p.joy > 40) ? 1.1 : 1) * (this.decor.theme === 'cozy' ? 1.05 : 1),
        // 寵物友善：有些客人帶毛孩來
        pet: !opt.rider && !opt.product && this.policy.petFriendly && type && type.id !== 'office' && this.rng() < (this.policy.petStrict ? 0.08 : 0.14) ? (this.rng() < 0.75 ? 'dog' : 'cat') : null,
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
      if (c.borrow) {
        const d = this.backDoorCell();
        if (!this.toiletOk || !d) return this.customerLeave(c, 'done');
        c.state = 'toToilet';
        c.waited = 0;
        this.walkTo(c, d);
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
        this.comboStep(false);
        this.sound('angry');
        // 來辦兼營業務的人等太久：比較少特地留評論
        if (!(c.product && c.product.side) || this.rng() < 0.4) this.addReview(1 + (this.rng() < 0.3 ? 1 : 0), this.pickComment('angry', c), 'wait');
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
        if (this.rng() < 0.25) this.addReview(2, this.isFood ? `想{w:eat}${c.product.name}結果賣完了` : `想來${c.product.name}，結果說材料用完了`, 'soldout');
      }
      if (c.obj) this.refreshQueue(c.obj);
      c.obj = null;
      if (c.pet && reason === 'done' && this.rng() < (this.policy.petStrict ? 0.08 : 0.2)) this.addDirt(c.x, c.z, 1, 'mud');
    }

    finishService(c, e) {
      const p = c.product;
      const unit = this.effPrice(p.id);
      // 食材在點餐時就扣掉了（進貨時已經付過錢）
      c.reserved = null;
      // 外送平台抽成 30%
      const price = Math.round(unit * c.qty * (c.rider ? 0.7 : 1));
      const cost = p.cost * c.qty * this.idx.cpi * this.costMult.materials * (0.85 + 0.15 * this.idx.oil) * this.kitchenMult;
      this.cash += price;
      this.ledger.revenue += price;
      this.today.revenue += price;
      // 不用進貨的品項（兼營業務的成本、抽成）直接扣
      if (!this.ingOf[p.id] && p.cost) {
        const k = Math.round(p.cost * c.qty * this.idx.cpi);
        this.cash -= k;
        this.ledger.materials += k;
      }
      if (p.side) this.sideServed(c, e, p.side);
      // 帶毛孩的客人：常常順便買毛孩的點心
      if (c.pet && this.rng() < 0.4) {
        const v = Math.round(unit * 0.3);
        this.cash += v;
        this.ledger.revenue += v;
        this.today.revenue += v;
        this.popup(c, '🦴毛孩點心', 'good');
      }
      // 服務完留下的髒污：麵渣、頭髮、油漬
      const mess = { barber: p.id === 'wash' ? 0.25 : 0.55, scooter: 0.3, store: 0.08 }[this.ind.id] ?? 0.18;
      if (this.rng() < mess) this.addDirt(c.x, c.z);
      this.today.served++;
      if (e) {
        e.served++;
        // 熟能生巧，但越厲害進步越慢（早餐店一天幾百個客人，不然一週就滿級了）
        e.skill = clamp(e.skill + 0.035 * (1 - e.skill / 105) * (e.traits.includes('rookie') ? TRAITS.rookie.learn : 1) * (e.rank ? 1 : this.teamFx().learn) * ((this.sideOf(e) || {}).learn || 1), 0, 100);
      }
      this.gainXp(((price - cost) / 25) * (this.ind.xpMult || 1));
      this.popup(c, `+$${price}`, 'money');
      this.sound('coin');

      // 滿意度
      let stars = 4.3;
      stars -= (c.waited / c.patience) * 2;
      const Dc = this.decor;
      stars += 0.55 * (1 - Math.exp(-Dc.A / 30)) + (Dc.theme === 'retro' && c.type === 'elderly' ? 0.2 : 0);
      if (e) stars += (e.mood - 55) / 90;
      if (e && e.traits.includes('chatty')) stars += TRAITS.chatty.charm * 3;
      const type = CUSTOMER_TYPES[c.type];
      const sens = type ? type.priceSens : 1;
      const ratio = 1 + (unit / (p.price * this.idx.cpi) - 1) * (1 - this.priceTolerance);
      if (ratio > 1.1) stars -= (ratio - 1.1) * 4 * sens;
      if (ratio < 0.9) stars += 0.2 * sens;
      if (this.isSummer && !this.cooling) stars -= 0.4;
      if (e && e.skill > 70) stars += 0.2;
      // 長輩喜歡愛聊天的店員；店裡髒會被扣分
      if (c.type === 'elderly' && e && e.traits.includes('chatty')) stars += 0.3;
      if (c.type === 'student' && this.sideOf(e) && this.sideOf(e).charm) stars += this.sideOf(e).charm;
      if (c.gifted) stars += 0.6;
      // 對貓狗過敏的客人：店裡有毛孩就扣分（劃了無毛孩區比較好）
      const furry = this.pets.filter((x) => x.kind === 'cat' || x.kind === 'dog').length + (this.policy.petFriendly ? (this.policy.petStrict ? 0.5 : 1.2) : 0);
      if (furry && !c.pet && this.rng() < 0.025 * furry * (this.flags.has('petZone') ? 0.3 : 1)) {
        stars -= 0.8;
        c.whyLow = 'pet';
      }
      if (c.pet) stars += 0.2;
      if (e && e.isBoss) stars += 0.2;
      const clean = this.cleanliness;
      if (clean < 70) stars -= (70 - clean) / 35;
      else if (clean > 90) stars += 0.15;
      // 記下扣最多分的原因，評論會照這個寫，評論面板也會統計
      const minus = { wait: (c.waited / c.patience) * 2, price: ratio > 1.1 ? (ratio - 1.1) * 4 * sens : 0, service: e && e.mood < 55 ? (55 - e.mood) / 90 + 0.2 : 0, hot: this.isSummer && !this.cooling ? 0.4 : 0, clean: clean < 70 ? (70 - clean) / 35 : 0 };
      c.whyLow = Object.keys(minus).reduce((a, k) => (minus[k] > minus[a] ? k : a), 'wait');

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
      this.comboStep(c.stars >= 4);
      if (this.rng() < 0.55) this.addReview(c.stars, this.pickComment(c.stars >= 4 ? 'good' : c.stars >= 3 ? 'ok' : 'bad', c), c.stars >= 4 ? null : c.whyLow);
      this.popup(c, c.stars >= 4.5 ? '😍' : c.stars >= 3.5 ? '🙂' : c.stars >= 2.5 ? '😐' : '😠', c.stars >= 3.5 ? 'good' : 'bad');
    }

    // why：低分的原因（wait 排隊、price 價格、service 服務、hot 太熱、clean 衛生、soldout 缺貨、image 形象、rival 對手、event 事件）
    addReview(stars, text, why) {
      if (stars <= 3 && !why) why = 'event';
      this.reviews.push({ stars, text: this.w(text), day: this.day, why: why || undefined });
      if (stars >= 5) this.gainXp(3);
      // 評論只留最近三個月（遊戲時間），但至少留 60 則讓評價算得穩；最多 200 則
      while (this.reviews.length > 200 || (this.reviews.length > 60 && this.reviews[0].day < this.day - RECORD_DAYS)) this.reviews.shift();
      if (this.reviews.length >= 30 && this.rating >= 4.5) this.achieve('rating');
    }

    pickComment(kind, c) {
      const p = c.product ? c.product.name : '';
      const pools = {
        good: [this.w(`${p}{w:good}，會再來！`), '老闆和員工都很親切', '店裡乾淨又舒服', `${p}CP 值很高`, this.w('{w:serve}超快，上班族救星'), '店員很有耐心'],
        ok: [`${p}還可以`, '中規中矩', '有點小貴', '等有點久，但還行'],
        bad: { wait: ['等太久了', '排隊排到腳痠'], price: ['價格偏高', '這個價錢有點不划算'], service: ['店員看起來很累，態度普通', '店員臉好臭'], hot: ['店裡好熱', '沒有冷氣熱到流汗'], clean: ['桌子黏黏的，地上也髒髒的', '店裡有點髒，衛生堪慮'], toilet: ['廁所好髒，不想再來', '想上廁所結果沒有廁所，只好吃快一點', '廁所要排好久'], pet: ['店裡有貓狗，我過敏一直打噴嚏', '到處都是動物的毛'] }[(c && c.whyLow) || 'wait'] || ['普普通通'],
        angry: ['等了快二十分鐘都沒人理，直接走人', '排隊排到天荒地老', '人手明顯不夠，老闆不請人嗎'],
      };
      let arr = pools[kind];
      if (this.rng() < 0.3 && Fun.FUNNY_REVIEWS[kind === 'good' ? 'good' : kind === 'bad' ? 'bad' : '']) arr = Fun.FUNNY_REVIEWS[kind].filter((t) => this.isFood || !/吃|喝|餐/.test(this.w(t))).map((t) => this.w(t));
      if (kind === 'good' && this.shopCat && this.rng() < 0.15) return '我是來看店貓的，結果順便變成常客';
      return arr[Math.floor(this.rng() * arr.length)];
    }

    // 兼營業務的客人辦完事：順便消費、做公益、員工邊做邊學
    sideServed(c, e, b) {
      this.today.side = (this.today.side || 0) + 1;
      if (b.impulse && this.rng() < b.impulse) {
        const core = this.availableProducts().filter((p) => !p.side);
        const q = core[Math.floor(this.rng() * core.length)];
        if (q) {
          const v = Math.round(this.effPrice(q.id) * 0.9);
          // 順便買的東西是貨架上的：也要算進貨成本
          const k = Math.round(q.cost * this.idx.cpi);
          this.cash += v - k;
          this.ledger.materials += k;
          this.ledger.revenue += v;
          this.today.revenue += v;
          this.today.impulse = (this.today.impulse || 0) + 1;
          this.popup(c, `順便買${q.icon}`, 'good');
        }
      }
      if (b.goodwill) {
        this.social.followers += 6;
        if (this.rng() < 0.5) this.addReview(5, '幫要捐髮的人免費修剪，好暖的店');
      }
      if (e && !this.knows(e, b.id)) {
        // 硬著頭皮做久了也會學會，但過程很挫折
        e.sideXp = e.sideXp || {};
        e.sideXp[b.id] = (e.sideXp[b.id] || 0) + 1;
        e.mood = clamp(e.mood - 0.6, 0, 100);
        if (e.sideXp[b.id] >= 15) {
          e.skills = [...(e.skills || []), b.id];
          this.say(e, `${b.name}……我終於會了`, 60);
          this.notify(`🎓 ${e.name} 自己摸索學會了「${b.name}」`);
        }
      }
    }

    // 🔥 連續好評：連續幾位客人都滿意（4 星以上），到里程碑有小獎勵；有人不滿意就歸零
    comboStep(ok) {
      if (!ok) {
        if (this.combo >= 10) this.notify(`💨 連續好評在 ${this.combo} 位中斷了`);
        this.combo = 0;
        return;
      }
      this.combo = (this.combo || 0) + 1;
      this.bestCombo = Math.max(this.bestCombo || 0, this.combo);
      const M = [10, 25, 50, 100, 200, 500];
      if (M.includes(this.combo)) {
        const xp = this.combo * 3;
        const fans = Math.round(this.combo / 2);
        this.gainXp(xp);
        this.social.followers += fans;
        this.sound('combo');
        this.notify(`🔥 連續 ${this.combo} 位客人都很滿意！經驗 +${xp}、粉絲 +${fans}`, 'achieve');
        if (this.cb.combo) this.cb.combo(this.combo);
      }
    }

    // 💪 幫員工加油：做事快一點、心情好一點（每人每兩小時一次）
    cheer(e) {
      if (!e || (e.state !== 'working' && e.state !== 'break') || (e.cheerAt && this.minute - e.cheerAt < 120)) return false;
      e.cheerAt = this.minute;
      e.hustle = Math.max(e.hustle || 0, this.minute + 45);
      e.mood = clamp(e.mood + 2, 0, 100);
      this.popup(e, '💪✨', 'good');
      this.say(e, ['好！衝了！', '收到～', '老闆也辛苦了！', '我可以的！'][Math.floor(this.rng() * 4)], 30);
      this.sound('cheer');
      return true;
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
      if (this.cb.notify) this.cb.notify(this.w(text), kind);
    }

    achieve(id) {
      if (this.achievements.has(id)) return;
      this.achievements.add(id);
      const a = ACHIEVEMENTS.find((x) => x.id === id);
      if (a) {
        this.cash += a.reward;
        this.ledger.rewards = (this.ledger.rewards || 0) + a.reward;
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
        if (this.policy.delivery && this.ind.delivery && this.rng() < base * 0.22 * (this.flags.has('riderFriendly') ? 1.1 : 1) * this.weatherMult('delivery') * dt) this.spawnCustomer({ rider: true });
        // 開放借廁所：路人進來借，有些人會順便買東西
        if (this.policy.toiletOpen && this.toiletOk && Fun.TOILET_BORROW) {
          const br = (Fun.TOILET_BORROW[this.ind.id] || 0.5) * this.ind.demand[this.hour] * this.weatherMult('walk');
          if (this.rng() < (br / 60) * dt) this.spawnCustomer({ borrow: true });
        }
        // 兼營業務：專門為這件事來的客人（不搶原本的生意）
        for (const p of this.sideProducts()) {
          const r = this.sideRate(p);
          if (r > 0 && this.rng() < (r / 60) * dt) this.spawnCustomer({ product: p });
        }
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
      if (B.away && (B.away.untilDay ? this.day >= B.away.untilDay && this.minute >= this.hours.open : this.minute >= B.away.until)) this.finishTrip();
      if (B.state === 'working' && !B.away) {
        if (B.lane && B.lane.customer && B.lane.customer.state === 'atLane') B.energy = clamp(B.energy - 0.12 * (1 - B.fit * 0.1) * dt, 0, 100);
        else B.energy = clamp(B.energy + 0.04 * dt, 0, 100);
      }

      // 奧客：大概兩天一個
      if (this.isOpen && !this.customers.some((c) => c.karen) && this.rng() < (0.5 * this.diff.events * (this.diff.karen || 1) * dt) / Math.max(240, this.hours.span)) this.spawnKaren();

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
      if (this.policy.helper) this.helperEvents();
      // 任務每小時檢查一次（達成就馬上打勾）
      const hr = Math.floor(this.minute / 60);
      if (hr !== this._questHr) {
        this._questHr = hr;
        if (!this.progressLegacy) this.checkProgress();
      }
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
        if (c.inRoom) {
          if (this.minute >= c.inRoom.until) {
            this.exitRoom(c);
            this.afterToilet(c);
          }
          continue;
        }
        const arrived = this.moveAgent(c, 2.4 * (c.speed || 1), dt);
        switch (c.state) {
          case 'toToilet':
            if (arrived) {
              const L = this.roomLv('toilet');
              if (this.toiletOk && this.roomOccupants('toilet').length < (L >= 3 ? 2 : 1)) {
                this.enterRoom(c, 'toilet', 3 + this.rng() * 3);
                this.useToilet(c);
              } else {
                c.waited += dt;
                if (c.waited > (c.borrow ? 5 : 8)) {
                  // 等不到廁所
                  if (!c.borrow && c.stars != null) {
                    c.stars = clamp(c.stars - 0.5, 1, 5);
                    c.whyLow = 'toilet';
                    this.reviewFor(c);
                  }
                  this.popup(c, '😖', 'bad');
                  this.customerLeave(c, 'done');
                }
              }
            }
            break;
          case 'arriving':
            if (arrived) this.customerArrived(c);
            break;
          case 'queue':
          case 'toLane':
            // 奧客在吵的時候不會自己走掉，要等老闆處理
            if (!c.arguing) c.waited += dt * (c.waitSeat ? 0.6 : 1) * this.teamFx().calm;
            if (c.state === 'toLane' && arrived) {
              c.state = 'atLane';
              this.freeWaitSeat(c);
            }
            if (c.waited > c.patience) this.customerLeave(c, 'angry');
            break;
          case 'atLane': {
            const lane = c.lane;
            // 奧客佔著櫃台大聲嚷嚷，處理完之前這個服務位都卡住
            if (c.arguing) {
              c.progress = Math.min(c.progress, 0.3);
              break;
            }
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
              // 兼營業務：沒學過的人手忙腳亂，慢很多
              const raw = c.obj && c.obj.def.side && !this.knows(e, c.obj.def.side) ? 0.55 : 1;
              c.progress += (dt * this.speedOf(e) * spd * raw) / work;
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
              // 吃完想上廁所：有廁所就去；沒有的話有人會扣分
              if (this.rng() < 0.2) {
                const d = this.toiletOk && this.backDoorCell();
                if (d) {
                  if (c.seatObj) {
                    c.seatObj.seatTaken[c.seatIdx] = null;
                    c.seatObj = null;
                  }
                  c.state = 'toToilet';
                  c.waited = 0;
                  this.walkTo(c, d);
                  break;
                }
                if (c.stars != null) {
                  c.stars = clamp(c.stars - 0.5, 1, 5);
                  c.whyLow = 'toilet';
                }
              }
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

    sideOf(e) {
      return (e && e.side && Fun.SIDE_JOBS && Fun.SIDE_JOBS[e.side]) || null;
    }

    speedOf(e) {
      let s = 0.55 + e.skill / 110;
      if (this.sideOf(e) && this.sideOf(e).speed) s *= this.sideOf(e).speed;
      if (this.decor.theme === 'tech') s *= 1.03;
      if (e.energy < 30) s *= 0.55 + e.energy / 70;
      if (e.hunger < 20) s *= 0.85;
      s *= 0.85 + e.mood / 400;
      if (e.traits.includes('chatty')) s *= TRAITS.chatty.speed;
      if (e.hustle && e.hustle > this.minute) s *= 1.08;
      if (this.isSummer && !this.cooling) s *= 0.92;
      s *= this.teamFx().speed;
      if (e.rank && e.style === 'slacker' && e.revealed) s *= (Fun.STYLES || {}).slacker ? Fun.STYLES.slacker.self : 1;
      if (e.senior) s *= 1.05;
      return s;
    }

    restSpots() {
      return this.objects.filter((o) => o.def.cat === 'staff' && o.def.rest);
    }

    goHome(e) {
      if (e.inRoom) this.exitRoom(e);
      this.dropTask(e);
      e.state = 'leaving';
      this.walkTo(e, { x: this.rng() < 0.5 ? -OUT_W : this.W + OUT_W - 1, z: this.H });
    }

    updateStaff(dt) {
      for (const e of this.staff) {
        // 在後場：時間到了才出來（休息的人在下面照常恢復體力）
        if (e.inRoom && e.inRoom.id === 'toilet' && this.minute >= e.inRoom.until) {
          this.exitRoom(e);
          this.toiletClean = 100;
          e.toiletWeek = (e.toiletWeek || 0) + 1;
          e.mood = clamp(e.mood - 0.8, 0, 100);
          e.task = null;
        }
        if (e.inRoom && e.inRoom.id === 'toilet') continue;
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
        if (night) drain *= e.traits.includes('nightowl') ? TRAITS.nightowl.night : (this.sideOf(e) || {}).night || 1.25;
        drain *= this.diff.drain;
        if (working) {
          e.energy = clamp(e.energy - drain * dt, 0, 100);
          e.hunger = clamp(e.hunger - 0.14 * dt * (e.traits.includes('foodie') ? TRAITS.foodie.hunger : 1), 0, 100);
          e.minutesToday += dt;
        }
        this.updateMood(e, dt);

        if (e.state === 'break') {
          const t = e.task;
          if (t && t.room === 'rest' && arrived && !e.inRoom) this.enterRoom(e, 'rest', 9999);
          if (arrived && t) {
            const R = t.room === 'rest' && this.roomLevel('rest');
            const bonus = R ? R.rest : t.obj ? t.obj.def.restBonus || 1 : 0.5;
            e.energy = clamp(e.energy + 1.6 * bonus * dt, 0, 100);
            e.hunger = clamp(e.hunger + 2.5 * dt, 0, 100);
          }
          if (e.energy > 88 && e.hunger > 75) {
            if (t && t.obj) t.obj.seatTaken[t.seat] = null;
            if (e.inRoom) this.exitRoom(e);
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

        // 廁所髒了：沒在服務客人的人去打掃（同一時間只派一個）
        if (e.task && e.task.type === 'toilet') {
          if (arrived) {
            if (this.toiletOk && this.roomOccupants('toilet').length < (this.roomLv('toilet') >= 3 ? 2 : 1)) this.enterRoom(e, 'toilet', 6);
            else e.task = null;
          }
          continue;
        }
        if (!serving && working && this.toiletOk && this.toiletClean < 55 && !this.staff.some((o) => o.task && o.task.type === 'toilet') && !(e.task && e.task.lane && e.task.lane.customer)) {
          const d = this.backDoorCell();
          this.dropTask(e);
          if (d && this.walkTo(e, d)) {
            e.task = { type: 'toilet' };
            if (this.rng() < 0.3) this.say(e, ['又要洗廁所……', '誰把廁所弄成這樣', '戴好手套，出發'][Math.floor(this.rng() * 3)], 30);
            continue;
          }
        }
        // 找事做：哪個服務位最需要人
        if (!serving) this.assignWork(e, dt);
        this.thinkMaybe(e, dt);
      }
    }

    startBreak(e) {
      this.dropTask(e);
      // 有員工休息室：到後場休息，客人看不到，恢復得比較快
      const door = this.roomLv('rest') && this.backDoorCell();
      if (door && this.walkTo(e, door)) {
        e.task = { type: 'rest', room: 'rest' };
        e.state = 'break';
        this.say(e, ['去休息室喘口氣', '終於可以躺一下', '先去吃個飯'][Math.floor(this.rng() * 3)], 30);
        return;
      }
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
          // 本業優先：兼營業務只在本業不忙的時候做（會的人優先）
          if (o.def.side) score -= this.knows(e, o.def.side) ? 1.2 : 2;
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
          // 真正解開心結的兩個人（上過課、好好談過）：以後不會再越來越差
          d += (this.relFix || {})[this.relKey(a, b)] || 0;
          // 剛調解過的兩個人，這兩週比較會互相忍讓
          if (d < 0 && (this.relCalm || {})[this.relKey(a, b)] >= this.day) d *= 0.3;
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
      target += Math.min(10, this.decor.A / 5) + (this.decor.theme === 'cozy' ? 2 : 0);
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
      target += this.petMoodFor(e);
      if (this.roomLevel('rest')) target += this.roomLevel('rest').mood;
      // 十項全能的代價：店裡的業務比他會的多太多，會覺得被當萬用工具人
      const n = this.sideCount;
      if (n) {
        const known = (e.skills || []).length;
        target -= Math.max(0, n - known - 1) * 2.5;
        // 會的多、薪水卻沒比較多
        if (known >= 3 && e.wage < this.marketWage + known * 8) target -= 4;
      }
      if (e.state === 'working' || e.state === 'break') target += this.teamMoodFor(e);
      if (!this.policy.insurance) target -= 6;
      const regen = (e.traits.includes('cheerful') ? TRAITS.cheerful.moodRegen : 1) * (this.level >= 39 ? 1.35 : this.level >= 23 ? 1.2 : 1);
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
        if (e.offDay === this.day && this.roster.has(e.id)) {
          e.sentHomeDay = this.day;
          this.notify(`🗓️ ${e.name} 今天請假（${(this.sideOf(e) || { name: '私事' }).name}）`);
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
            (!e.target || e.target(this)) &&
            !this.usedEvents.has(e.id)
        );
        if (!eligible.length) {
          this.usedEvents.clear();
          continue;
        }
        const ev = eligible[Math.floor(this.rng() * eligible.length)];
        this.usedEvents.add(ev.id);
        const at = this.policy.open + 30 + this.rng() * Math.max(60, Math.min(this.span, 900) - 90);
        // 有指定對象的事件（新人、能幹的員工）：記下是誰，文字和結果都會用這個人
        const subject = ev.target ? ev.target(this) : null;
        this.pendingEvents.push({ ev, at, where: ev.where || 'staff', subject, staffPref: subject });
      }
      // 年底的年終
      if (this.monthOfYear === 12 && this.week % WEEKS_PER_MONTH === 0 && this.weekday === 5) {
        const ye = EVENTS.find((e) => e.id === 'yearend');
        if (ye) this.pendingEvents.push({ ev: ye, at: this.policy.open + 120, where: 'staff' });
      }
      this.planSocialEvents();
      this.planCareerEvents();
      this.planSideEvents();
      this.planSideBizEvents();
      this.planRoomEvents();
      this.planPetEvents();
      if (this.lifeEventNext) {
        const f = this.lifeEventNext;
        this.lifeEventNext = null;
        this.pendingEvents.push({ ev: f.make(this), at: this.hours.open + 30, where: 'phone' });
      }
      if (this.toiletDuty) {
        const { e, n } = this.toiletDuty;
        this.toiletDuty = null;
        if (this.staff.includes(e)) this.pendingEvents.push({ ev: this.toiletDutyEvent(e, n), at: this.hours.open + 45, where: 'staff', staffPref: e, subject: e });
      }
      // 一般客訴：有時候是店裡真的做錯，有時候是客人誤會
      if (Fun.complaintEvent && this.rng() < 0.22 * this.diff.events) {
        const at = this.hours.open + 60 + this.rng() * Math.max(60, Math.min(this.hours.span, 600) - 120);
        const pend = { ev: null, at, where: 'staff', complaint: this.rng() < 0.55 ? 'legit' : 'misread' };
        this.pendingEvents.push(pend);
      }
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
      if (this.floodBikeIssue) {
        this.floodBikeIssue = false;
        this.pendingEvents.push({
          ev: {
            id: 'sbe_floodback',
            icon: '🛵',
            title: '泡水車的買主回來了',
            text: '上次那台「中古車」的買主牽著車回來，電路系統整個壞掉：「我去別家檢查，師傅說這台是泡水車！你們沒有說！」他手機已經在錄影了。',
            choices: [
              { label: '全額退費、公開道歉', effects: { cash: -9000, followers: 50, review: [3, '賣到泡水車，但老闆有全額退費'] }, result: '買主收下退款，影片最後沒有上傳。' },
              { label: '「出門就不負責」', effects: { review: [1, '這家機車行賣泡水車還不認帳'], jerk: 4, followers: -400 }, result: '影片上了爆料社團，標題是〈機車行賣泡水車〉。', tip: '販售中古車隱匿泡水等重大瑕疵，買方可主張解除契約或減少價金；情節重大還可能涉及詐欺。' },
            ],
            ignore: { effects: { review: [1, '賣泡水車還不處理'], jerk: 3 }, result: '買主在店門口站了一個小時才走。' },
          },
          at: this.hours.open + 90,
          where: 'door',
        });
      }
      if (this.kitchenIssue && this.kitchen) {
        this.kitchenIssue = false;
        this.kitchen.issues += 1;
        this.pendingEvents.push({ ev: this.kitchenEvent(), at: this.hours.open + 40, where: 'phone' });
      }
      if (this.franchiseIssue && this.franchises && this.franchises[this.franchiseIssue.i]) {
        this.pendingEvents.push({ ev: this.franchiseIssueEvent(this.franchiseIssue.i), at: this.hours.open + 70, where: 'phone' });
        this.franchiseIssue = null;
      }
      if (this.boardPush && this.ipo) {
        this.boardPush = false;
        this.pendingEvents.push({ ev: this.boardEvent(), at: this.hours.open + 80, where: 'phone' });
      }
      if (this.branchIssue && this.branches[this.branchIssue.i]) {
        const iss = this.branchIssue;
        this.branchIssue = null;
        this.pendingEvents.push({ ev: branchIssueEvent(this, iss.i, iss.type), at: this.hours.open + 50, where: 'phone' });
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
          this.fightDay = this.fightDay || {};
          const fk = this.relKey(a, b);
          // 人越多配對越多，單一配對吵架的機率要調低，不然大團隊天天在吵
          if (v <= -35 && this.day - (this.fightDay[fk] ?? -99) >= 7 && this.rng() < 0.3 * Math.min(1, 6 / Math.max(6, this.staff.length))) {
            this.fightDay[fk] = this.day;
            this.pendingEvents.push({ ev: fightEvent(a, b, this), at: at(), where: 'staff', staffPref: a });
          }
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
        // 指定對象今天沒來或已經離職：這件事就不發生
        if (p.subject && !working.includes(p.subject)) return;
        p.staff = p.staffPref && working.includes(p.staffPref) ? p.staffPref : working[Math.floor(this.rng() * working.length)];
      }
      if (p.complaint) p.ev = Fun.complaintEvent(this, p.complaint, p.staff);
      p.spawnedAt = this.minute;
      p.id = p.id || uid++;
      // 📋 授權制度：符合規則的事情，交給店長／區經理直接處理
      if (this.authHandle(p)) return;
      p.deadline = this.minute + (p.karen ? 60 : { staff: 150, phone: 50, door: 70 }[p.where]);
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
      const left = [];
      const leave = (who, why) => {
        if (!who || !this.staff.includes(who)) return;
        left.push({ name: who.name, rank: who.rank && Fun.RANKS && Fun.RANKS[who.rank] ? Fun.RANKS[who.rank].name : null, days: this.day - who.hiredDay, why });
        this.removeEmployee(who);
      };
      if (fx.staff < 0) {
        // 誰離開：事件指定的人＞來找你的人＞最資淺的一般員工（不會隨便抽走主管）
        const pool = this.staff.filter((e) => !e.rank).sort((a, b) => b.hiredDay - a.hiredDay);
        const who = (ev.subject && this.staff.includes(ev.subject) && ev.subject) || (ev.staff && this.staff.includes(ev.staff) && ev.staff) || pool[0] || this.staff[this.staff.length - 1];
        if (who) {
          leave(who, '離職');
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
      if (fx.branch && this.branches[fx.branch.i]) {
        const b = this.branches[fx.branch.i];
        const f = fx.branch;
        if (f.morale) b.morale = clamp(b.morale + f.morale, 0, 100);
        if (f.rating) b.rating = clamp(b.rating + f.rating, 1, 5);
        if (f.wage) b.wage = f.wage;
        if (f.price) b.price = f.price;
        if (f.reno) b.reno = Math.min(3, b.reno + f.reno);
        if (f.rentMult) {
          b.rentMult = (b.rentMult || 1) * f.rentMult;
          b.rentRaised = true;
        }
        if (f.broken != null) b.broken = f.broken;
        if (f.staff) b.staff = clamp(b.staff + f.staff, 1, 16);
      }
      // 今天停業（颱風假）：員工回家、店裡的客人請他們改天再來
      if (fx.closeToday) {
        this.shutDay = this.day;
        for (const e of this.staff) if (e.state === 'working' || e.state === 'break') this.sendHome(e);
        for (const c of [...this.customers]) if (!c.supplier && !c.inspector && c.state !== 'leaving') this.customerLeave(c, 'closed');
        this.notify('🌀 店門口貼上「颱風停業一天」，今天不營業，明天照常。');
      }
      const byId = (id) => this.staff.find((x) => x.id === id);
      if (fx.promo) this.startPromo(fx.promo);
      if (fx.rivalHit && this.rival) this.rival.strength = clamp(this.rival.strength - fx.rivalHit, 0, 1);
      if (fx.raiseOf && byId(fx.raiseOf[0])) byId(fx.raiseOf[0]).wage += fx.raiseOf[1];
      if (fx.leave && byId(fx.leave)) {
        const who = byId(fx.leave);
        leave(who, '跳槽');
        this.notify(`🚪 ${who.name} 跳槽到${this.rival ? this.rival.name : '別家店'}了。`, 'bad');
      }
      if (fx.leave2 && byId(fx.leave2)) {
        const who = byId(fx.leave2);
        leave(who, '跟著走了');
        this.notify(`🚪 ${who.name} 也跟著走了。`, 'bad');
      }
      if (fx.promoteOf && byId(fx.promoteOf[0])) {
        const who = byId(fx.promoteOf[0]);
        if (!this.promote(who, fx.promoteOf[1])) {
          who.askDay = this.day;
          this.notify(`🎖️ 組長名額滿了，${who.name}只能先等等。`, 'bad');
        }
      }
      if (fx.demoteOf && byId(fx.demoteOf)) {
        if (fx.trialDemote) byId(fx.demoteOf).rankDay = this.day; // 評估時降回原職：算在試用期內，不傷感情
        this.demote(byId(fx.demoteOf));
      }
      if (fx.extendTrial && byId(fx.extendTrial)) byId(fx.extendTrial).rankDay = this.day - 7;
      if (fx.seniorOf && byId(fx.seniorOf)) this.promoteSenior(byId(fx.seniorOf), true);
      if (fx.askLater && byId(fx.askLater)) {
        const who = byId(fx.askLater);
        who.asks = (who.asks || 0) + 1;
        who.askDay = this.day;
        who.askSnap = { day: this.day, skill: Math.round(who.skill), lead: who.leadSeen };
      }
      if (fx.lead && byId(fx.lead[0])) byId(fx.lead[0]).lead = clamp(byId(fx.lead[0]).lead + fx.lead[1], 0, 100);
      if (fx.talkLeader && byId(fx.talkLeader)) {
        const who = byId(fx.talkLeader);
        if (this.rng() < 0.45) {
          who.style = 'warm';
          choice = { ...choice, result: `${choice.result}${who.name}沉默了一下：「我以為嚴格才是對大家好。」之後${who.gender === 'f' ? '她' : '他'}講話溫和多了（變成🤗暖心型）。` };
        } else {
          who.lead = clamp(who.lead + 5, 0, 100);
          choice = { ...choice, result: `${choice.result}${who.name}說會注意，但個性一時改不了。至少領導力 +5。` };
        }
      }
      if (fx.relFix && byId(fx.relFix[0]) && byId(fx.relFix[1])) (this.relFix = this.relFix || {})[this.relKey(byId(fx.relFix[0]), byId(fx.relFix[1]))] = 0.8;
      // 調一個人去分店：吵架的兩個人從此不同店
      if (fx.transfer && byId(fx.transfer) && this.branches.length) {
        const who = byId(fx.transfer);
        const b = [...this.branches].sort((x, y) => x.staff / this.branchNeedOf(x.size || 'medium') - y.staff / this.branchNeedOf(y.size || 'medium'))[0];
        b.staff = Math.min(16, b.staff + 1);
        this.removeEmployee(who, true);
        this.notify(`🏙️ ${who.name} 調去${this.siteOf(b).city}${b.district}店了。`);
      }
      if (fx.rel) {
        this.addRel(byId(fx.rel[0]), byId(fx.rel[1]), fx.rel[2]);
        if (fx.rel[2] >= 20 && byId(fx.rel[0]) && byId(fx.rel[1])) (this.relCalm = this.relCalm || {})[this.relKey(byId(fx.rel[0]), byId(fx.rel[1]))] = this.day + 14;
      }
      if (fx.moodOf) for (const [id, d] of fx.moodOf) if (byId(id)) byId(id).mood = clamp(byId(id).mood + d, 0, 100);
      if (fx.separate) this.separate.add(fx.separate.join('-'));
      this.activeEvents = this.activeEvents.filter((x) => x !== ev);
      if (ev.karen) ev.karen.arguing = false;
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
      // 人生事件的效果
      const O = this.owner;
      if (fx.lifeWealth) {
        if (fx.lifeWealth < 0) this.payPersonal(-fx.lifeWealth, '這筆開銷');
        else O.wealth += fx.lifeWealth;
      }
      if (fx.lifeStress) O.stress = clamp(O.stress + fx.lifeStress, 0, 100);
      if (fx.lifeHealth) O.health = clamp(O.health + fx.lifeHealth, 0, 100);
      if (fx.lifePartner) {
        O.partner = fx.lifePartner;
        O.partnerDay = this.day;
        O.partnerRisk = false;
      }
      if (fx.lifePartnerRisk) O.partnerRisk = true;
      if (fx.lifeKid) O.kids += 1;
      if (fx.lifeFamilyTime) O.familyTime = true;
      if (fx.lifeNanny) O.nanny = true;
      if (fx.lifeFamily) O.familyBond = clamp(O.familyBond + fx.lifeFamily, 0, 100);
      if (fx.lifeParents) O.parents = fx.lifeParents;
      if (fx.lifeAway) this.lifeAway(fx.lifeAway, fx.lifeAway >= 5 ? 'rest' : 'family');
      if (fx.lifeLoan) O.loan = (O.loan || 0) + fx.lifeLoan;
      if (fx.lifeRepay && O.loan) {
        if (this.rng() < 0.6) {
          O.wealth += Math.round(O.loan * 1.05);
          O.loan = 0;
        }
      }
      if (fx.lifeBuy) {
        if (!this.lifeSpend(fx.lifeBuy)) {
          O.stress = clamp(O.stress + 8, 0, 100);
          this.notify('💸 老闆個人的錢不夠付頭期款，只好先租遠一點的地方。', 'bad');
        }
      }
      if (fx.lifeRestDay && this.policy.closedDay === -1) {
        this.policy.closedDay = 0;
        this.notify('📅 店改成每週一公休。');
      }
      this.checkLifeMilestones && this.checkLifeMilestones();
      const pet = (pid) => this.pets.find((x) => x.id === pid);
      if (fx.petJoy && pet(fx.petJoy[0])) pet(fx.petJoy[0]).joy = clamp(pet(fx.petJoy[0]).joy + fx.petJoy[1], 0, 100);
      if (fx.petHeal && pet(fx.petHeal)) pet(fx.petHeal).health = 100;
      if (fx.petHurt && pet(fx.petHurt[0])) pet(fx.petHurt[0]).health = clamp(pet(fx.petHurt[0]).health - fx.petHurt[1], 0, 100);
      if (fx.petCalm && pet(fx.petCalm)) pet(fx.petCalm).calm = true;
      if (fx.allergyFix && byId(fx.allergyFix)) byId(fx.allergyFix).allergyOk = true;
      if (fx.petPolicyStrict) this.policy.petStrict = true;
      if (fx.petZone) this.flags.add('petZone');
      if (fx.dirt) for (let i = 0; i < fx.dirt; i++) this.addDirt(Math.floor(this.rng() * this.W), Math.floor(this.rng() * this.H), 1, 'mud');
      if (fx.deliveryOff) this.policy.delivery = false;
      if (fx.petFriendlyOn) this.policy.petFriendly = true;
      if (fx.toiletFix) this.toiletDownUntil = 0;
      if (fx.toiletDown) this.toiletDownUntil = this.day + fx.toiletDown - 1;
      if (fx.sideHot) this.sideHot = { id: fx.sideHot[0], mult: fx.sideHot[1], until: this.day + fx.sideHot[2] - 1 };
      if (fx.sideDown) {
        this.sideDownUntil = this.sideDownUntil || {};
        this.sideDownUntil[fx.sideDown[0]] = this.day + fx.sideDown[1] - 1;
      }
      if (fx.trainOf && byId(fx.trainOf[0])) {
        const t = byId(fx.trainOf[0]);
        if (!this.knows(t, fx.trainOf[1])) {
          t.skills = [...(t.skills || []), fx.trainOf[1]];
          this.cash -= this.skillCost;
          this.ledger.welfare = (this.ledger.welfare || 0) + this.skillCost;
        }
      }
      if (fx.franchiseFix && this.franchises && this.franchises[fx.franchiseFix[0]]) this.franchises[fx.franchiseFix[0]].decency = clamp(this.franchises[fx.franchiseFix[0]].decency + fx.franchiseFix[1], 0, 100);
      if (fx.franchiseEnd != null && this.franchises && this.franchises[fx.franchiseEnd]) this.franchises.splice(fx.franchiseEnd, 1);
      if (fx.ipoTarget && this.ipo) this.ipo.target = Math.round(this.ipo.target * (1 + fx.ipoTarget));
      if (fx.kitchenDown && this.kitchen) this.kitchen.downUntil = this.day + fx.kitchenDown;
      if (fx.kitchenGamble) {
        if (this.rng() < 0.45) {
          for (const b of this.branches) b.rating = clamp(b.rating - 0.4, 1, 5);
          for (let i = 0; i < 3; i++) this.addReview(1, this.isFood ? '吃完拉肚子，聽說好幾間分店都有人中' : '買到瑕疵品，客服還說沒問題', 'quality');
          this.jerk = clamp(this.jerk + 3, 0, JERK_LIMIT);
          this.demandMods.push({ mult: 0.85, days: 10 });
          this.notify(`📰 新聞：〈${this.shopName}${this.kitchenName}出包，多家分店客訴〉`, 'bad');
        } else this.notify('😮‍💨 這次運氣好，沒有人出事。');
      }
      // 🔀 斜槓員工的故事與請假
      if (fx.storyOf && byId(fx.storyOf[0])) {
        byId(fx.storyOf[0]).story = fx.storyOf[1];
        byId(fx.storyOf[0]).storyDay = this.day;
      }
      if (fx.skillOf) for (const [id, d] of fx.skillOf) if (byId(id)) byId(id).skill = clamp(byId(id).skill + d, 0, 100);
      if (fx.skillAll) for (const x of this.staff) if (x.skill < fx.skillAll[1]) x.skill = clamp(x.skill + fx.skillAll[0], 0, 100);
      if (fx.ambitionOf && byId(fx.ambitionOf[0])) byId(fx.ambitionOf[0]).ambition = clamp(byId(fx.ambitionOf[0]).ambition + fx.ambitionOf[1], 0, 100);
      if (fx.offDay && byId(fx.offDay)) byId(fx.offDay).offDay = this.day + 1;
      if (fx.sendHomeOf && byId(fx.sendHomeOf) && (byId(fx.sendHomeOf).state === 'working' || byId(fx.sendHomeOf).state === 'break')) this.sendHome(byId(fx.sendHomeOf));
      if (fx.viral) {
        this.demandMods.push({ mult: 1 + fx.viral, days: 4 });
        this.notify('📱 「老闆嗆奧客」的影片被路人上傳，網友狂刷「這老闆可以」！', 'achieve');
        this.achieve('karen');
      }
      if (fx.karenReview) this.addReview(1, fx.karenReview, 'image');
      if (fx.fakeReviews) for (let i = 0; i < fx.fakeReviews; i++) this.addReview(5, '老闆很帥');
      if (fx.review) this.addReview(fx.review[0], fx.review[1]);
      if (fx.grudge && this.rival) this.rival.grudge = Math.max(0, (this.rival.grudge || 0) + fx.grudge);
      if (fx.shopCat) {
        if (!this.pets.some((p) => p.kind === 'cat')) this.adoptPet('cat', '店長', true);
        this.achieve('shopcat');
      }
      const after = { cash: this.cash, morale: Math.round(this.morale), jerk: Math.round(this.jerk), staff: this.staff.length };
      const delta = Object.fromEntries(Object.keys(after).map((k) => [k, Math.round(after[k] - before[k])]));
      this.checkEnding();
      // 事件紀錄：什麼事、誰、選了什麼、誰處理的、結果
      const who = ev.subject || ev.staff || null;
      this.eventSeq = (this.eventSeq || 0) + 1;
      this.eventLog = [{ day: this.day, time: this.clockLabel, icon: ev.ev.icon, title: this.w(ev.ev.title.replace(/\{who\}/g, who ? who.name : '員工')), who: who ? who.name : null, choice: this.w(choice.label || ''), by: ev.by || '你', delta, left }, ...(this.eventLog || []).filter((x) => x.day >= this.day - RECORD_DAYS)].slice(0, 60);
      return { event: ev.ev, choice, delta, left, by: ev.by || '你' };
    }

    resolve(ev, index) {
      this.today.bossEvents = (this.today.bossEvents || 0) + 1;
      return this.applyChoice(ev, ev.ev.choices[index]);
    }

    ignoreEvent(ev) {
      if (this.delegateEvent(ev)) return;
      this.today.ignoredEvents = (this.today.ignoredEvents || 0) + 1;
      ev.by = '逾時沒處理';
      const r = this.applyChoice(ev, ev.ev.ignore || IGNORE[ev.where]);
      if (r && this.cb.ignored) this.cb.ignored(r, ev);
    }

    // ───── 每日、每週、每月 ─────
    emptyLedger() {
      return { revenue: 0, materials: 0, wages: 0, labor: 0, health: 0, pension: 0, rent: 0, utilities: 0, interest: 0, tax: 0, fines: 0, cleaning: 0, welfare: 0, events: 0, branches: 0, group: 0, other: 0, rewards: 0, waste: 0 };
    }

    // 報廢（waste）只是記錄：那些食材進貨時已經付過錢了
    profitOf(L) {
      return L.revenue - L.materials - L.wages - L.labor - L.health - L.pension - L.rent - L.utilities - L.interest - L.tax - L.fines - L.cleaning - (L.welfare || 0) + L.events + L.branches + (L.group || 0) + L.other + (L.rewards || 0);
    }

    emptyDay() {
      return { visitors: 0, served: 0, angry: 0, balked: 0, revenue: 0, delivery: 0, soldOut: 0, lowWarned: {}, outWarned: {} };
    }

    endDay() {
      const report = { day: this.day, ...this.today, wages: 0, ot: 0, insurance: 0, waste: 0 };
      const lastShift = this.hours.shifts - 1;
      this.petDaily(report);
      this.lifeDaily(report);
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
        const lost = Math.floor(this.stock[g.id] * g.spoil * this.wasteMult * (this.roomLevel('storage') ? this.roomLevel('storage').spoil : 1));
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
      if (this.policy.helper && this.staff.length) this.helperDaily(report);
      this.checkProgress(this.progressLegacy);
      this.progressLegacy = false;
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
        // Lv.11 以後的經驗主要靠連鎖賺的錢
        if (L.branches > 0) this.gainXp(L.branches / 60);
      }
      // 裝潢流行：每隔一陣子，某一種風格會紅起來
      if (!this.decorTrend || this.decorTrend.until < this.day) {
        if (this.week >= 4 && this.rng() < 0.35) {
          const keys = Object.keys(DECOR_THEMES);
          const k = keys[Math.floor(this.rng() * keys.length)];
          this.decorTrend = { theme: k, until: this.day + 7 * (6 + Math.floor(this.rng() * 5)) };
          this.notify(`🎨 最近流行「${DECOR_THEMES[k].icon}${DECOR_THEMES[k].name}風」的店，這種裝潢效果 +25%（到第 ${this.decorTrend.until} 天）`, 'event');
        } else this.decorTrend = null;
      }
      // 後場：洗廁所的分配、老鼠、過期品、請了清潔阿姨
      if (this.flags.has('cleaner')) {
        const v = 1500;
        this.cash -= v;
        L.cleaning = (L.cleaning || 0) + v;
        this.toiletClean = 100;
      } else {
        const duty = this.staff.map((e) => [e, e.toiletWeek || 0]).sort((a, b) => b[1] - a[1]);
        const total = duty.reduce((t, [, n]) => t + n, 0);
        if (duty.length >= 2 && duty[0][1] >= 4 && duty[0][1] / Math.max(1, total) > 0.6) this.toiletDuty = { e: duty[0][0], n: duty[0][1] };
      }
      for (const e of this.staff) e.toiletWeek = 0;
      if (this.flags.has('ratRisk') && this.rng() < 0.15) {
        this.flags.delete('ratRisk');
        this.cash -= 10000;
        L.fines += 10000;
        this.addReview(1, '在店裡看到老鼠跑過去！！', 'clean');
        this.notify('🐀 有客人拍到老鼠的影片，衛生局來稽查，罰款 $10,000。', 'bad');
      }
      if (this.flags.has('expiredRisk') && this.rng() < 0.2) {
        this.flags.delete('expiredRisk');
        this.cash -= 30000;
        L.fines += 30000;
        this.jerk = clamp(this.jerk + 3, 0, JERK_LIMIT);
        this.notify('📅 稽查員在倉庫找到過期品，罰款 $30,000。', 'bad');
      }
      // 兼營業務留下的伏筆
      if (this.flags.has('oldBrine') && this.rng() < 0.12) {
        this.flags.delete('oldBrine');
        const fine = 12000;
        this.cash -= fine;
        L.fines += fine;
        this.notify(`🧑‍⚕️ 衛生局抽驗「三個月老滷」，生菌數超標，罰款 $${fine.toLocaleString()}，限期改善。`, 'bad');
      }
      if (this.flags.has('floodBike') && this.rng() < 0.2) {
        this.flags.delete('floodBike');
        this.floodBikeIssue = true;
      }
      this.lifeWeekly();
      const grp = this.groupWeekly();
      this.cash += grp;
      if (grp > 0) this.gainXp(grp / 60);
      // 營業稅
      const tax = this.businessTax(L);
      L.tax += tax;
      this.cash -= tax;

      // 勞動檢查
      let inspection = null;
      if (this.rng() < (0.05 + this.jerk / 250) * this.diff.inspect) {
        const v = [...this.flags].filter((f) => VIOLATIONS[f]);
        const fine = Math.round(v.reduce((s, f) => s + VIOLATIONS[f].fine, 0) * 0.6 * this.fineMult);
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
      // 長期目標
      const br = this.branches;
      if (br.length >= 5 && br.every((b) => b.rating >= 4.5)) this.achieve('chain5');
      if (br.filter((b) => b.manager).length >= 3) this.achieve('mentor3');
      if (profit >= 500000) this.achieve('week500');
      if (br.length >= 3 && this.morale >= 85 && br.every((b) => b.morale >= 75)) this.achieve('allhappy');
      if (this.week - 1 >= 96) this.achieve('year2');
      report.home = profit - (L.branches || 0);
      report.branchDetail = br.map((b) => ({ name: `${this.siteOf(b).city}${b.district}`, last: b.last, fee: b.fee || 0, lostN: b.lostN || 0 }));
      this.history.push(report);
      // 只留最近半年（26 週）的完整週報；整年要用的數字另外記成精簡的一串
      if (this.history.length > HISTORY_WEEKS) this.history.splice(0, this.history.length - HISTORY_WEEKS);
      this.profitLog = [...(this.profitLog || []), Math.round(profit)].slice(-52);
      this.bestWeek = Math.max(this.bestWeek || 0, Math.round(profit));
      this.bestCoreWeek = Math.max(this.bestCoreWeek || 0, Math.round(profit - (L.other || 0)));
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
        this.ledger.rewards = (this.ledger.rewards || 0) + a.reward;
      }
      if (a.medal === '🥇') this.achieve('gold');
      this.yearProfit = 0;
      return award;
    }

    // 一年的總評：評價、慣老闆指數、員工心情、現金、分店、獎項
    victory() {
      const profit = (this.profitLog || this.history.map((h) => h.profit)).slice(-48).reduce((a, p) => a + p, 0);
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
        objects: this.objects.map((o) => [o.type, o.x, o.z, o.rot, o.bought ?? this.day]),
        day: this.day,
        cash: this.cash,
        loan: this.loan,
        jerk: this.jerk,
        reviews: this.reviews.slice(-120),
        staff: this.staff.map((e) => ({ ...strip(e), state: 'off' })),
        prices: this.prices,
        menu: this.menu,
        policy: this.policy,
        idx: this.idx,
        costMult: this.costMult,
        history: this.history.slice(-HISTORY_WEEKS),
        profitLog: this.profitLog || [],
        bestWeek: this.bestWeek || 0,
        bestCoreWeek: this.bestCoreWeek || 0,
        achievements: [...this.achievements],
        cleanWeeks: this.cleanWeeks,
        rel: this.rel,
        relFix: this.relFix || {},
        fightCount: this.fightCount || {},
        separate: [...this.separate],
        xp: this.xp,
        progress: this.progress,
        owner: this.owner,
        areaManager: this.areaManager || null,
        bestCombo: this.bestCombo || 0,
        decorTrend: this.decorTrend || null,
        rooms: this.rooms,
        toiletClean: this.toiletClean,
        toiletDownUntil: this.toiletDownUntil || 0,
        sideDownUntil: this.sideDownUntil || {},
        sideHot: this.sideHot || null,
        kitchen: this.kitchen || null,
        seasonal: this.seasonal || null,
        seasonalCount: this.seasonalCount || 0,
        franchises: this.franchises || [],
        franchiseApps: this.franchiseApps || null,
        ipo: this.ipo || null,
        coop: this.coop || null,
        authCount: this.authCount || 0,
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
        pets: this.pets,
        collabs: this.collabs,
        copiedDish: !!this.copiedDish,
        schemes: this.schemes,
        wonYear: !!this.wonYear,
        ledger: this.ledger,
        eventLog: (this.eventLog || []).slice(0, 40),
        savedAt: Date.now(),
      });
    }

    static load(json, opts) {
      const d = JSON.parse(json);
      const s = new Sim(d.ind, { ...opts, shopName: d.shopName, mode: d.mode });
      s.objects = [];
      s.setLot(d.lotIdx);
      for (const [t, x, z, r, b] of d.objects) {
        const o = s.place(t, x, z, r, true);
        if (o && b != null) o.bought = b;
      }
      if (d.ledger) s.ledger = { ...s.emptyLedger(), ...d.ledger };
      s.eventLog = d.eventLog || [];
      Object.assign(s, { day: d.day, cash: d.cash, loan: d.loan, jerk: d.jerk, reviews: d.reviews, prices: d.prices, menu: d.menu, policy: { ...s.policy, ...d.policy }, idx: d.idx, costMult: d.costMult, history: d.history, cleanWeeks: d.cleanWeeks || 0 });
      // 舊存檔沒有精簡紀錄：從留下來的週報補
      s.profitLog = d.profitLog || (d.history || []).map((h) => Math.round(h.profit));
      s.bestWeek = d.bestWeek ?? Math.max(0, ...(d.history || []).map((h) => Math.round(h.profit)));
      s.bestCoreWeek = d.bestCoreWeek ?? Math.max(0, ...(d.history || []).map((h) => Math.round(h.profit - (h.other || 0))));
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
      for (const p of s.ind.products) if (p.side && !(p.id in s.menu)) s.menu[p.id] = true;
      for (const p of s.ind.products) if (!(p.id in s.prices)) s.prices[p.id] = p.price;
      s.style = { floor: 'default', wall: null, sign: null, ...(d.style || {}) };
      s.ownedFloors = new Set(d.ownedFloors || ['default']);
      if (d.social) s.social = { ...s.social, ...d.social };
      s.pets = d.pets || (d.shopCat ? [{ id: 1, kind: 'cat', name: '店長', trait: 'lazy', joy: 80, health: 90, since: d.day || 1 }] : []);
      s.collabs = d.collabs || [];
      s.copiedDish = !!d.copiedDish;
      s.schemes = d.schemes || 0;
      s.wonYear = !!d.wonYear;
      s.achievements = new Set(d.achievements);
      s.rel = d.rel || {};
      s.relFix = d.relFix || {};
      s.fightCount = d.fightCount || {};
      s.xp = d.xp || 0;
      s.areaManager = d.areaManager || null;
      s.bestCombo = d.bestCombo || 0;
      s.decorTrend = d.decorTrend || null;
      s.rooms = { storage: 0, rest: 0, office: 0, toilet: 0, ...(d.rooms || {}) };
      for (const e of s.staff) e.inRoom = null;
      s.toiletClean = d.toiletClean ?? 100;
      s.toiletDownUntil = d.toiletDownUntil || 0;
      s.sideDownUntil = d.sideDownUntil || {};
      s.sideHot = d.sideHot || null;
      s.kitchen = d.kitchen || null;
      s.seasonal = d.seasonal || null;
      s.seasonalCount = d.seasonalCount || 0;
      s.franchises = d.franchises || [];
      s.franchiseApps = d.franchiseApps || null;
      s.ipo = d.ipo || null;
      s.coop = d.coop || null;
      s.authCount = d.authCount || 0;
      s.owner = { ...Sim.ownerDefaults(), ...(d.owner || {}) };
      if (d.progress) s.progress = { chapter: 0, done: [], chapters: [], features: [], route: null, ended: false, ...d.progress };
      else {
        s.progressLegacy = true; // 舊存檔：第一次檢查時，已經達成的章節直接完成（不跳一堆對話框）
        // 舊版本本來就有主管和分店：已經玩到的東西不能因為更新被收回去
        s.progress.features = ['career'];
        if (s.level >= 5 || s.branches.length) s.progress.features.push('branch', 'slash', 'seasonal');
      }
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
  // 分店打電話來：要你決定怎麼處理
  function branchIssueEvent(sim, i, type) {
    const b = sim.branches[i];
    const site = sim.siteOf(b);
    const name = `${site.city}${b.district}店`;
    const who = b.manager ? `店長${b.manager.name}` : '分店的資深員工';
    const reno = sim.renoCost;
    const base = { icon: '🏙️', where: 'phone', speaker: { look: 'caller', name } };
    if (type === 'morale')
      return { ...base, id: 'br_morale', title: `${name}的員工快撐不住了`, text: `${who}打電話來：「老闆，這裡的人一直加班、薪水又比隔壁低，群組裡已經有人在問離職流程了。」（士氣 ${Math.round(b.morale)}）`, choices: [
        { label: '親自去分店坐鎮一天，聽大家說', effects: { cash: -6000, branch: { i, morale: 18 }, jerk: -1 }, result: `你跟${name}的員工吃了一頓便當，聽了很多以前不知道的事。回來的路上你把要改的東西記滿了一頁。` },
        { label: '分店時薪調到高於行情', effects: { branch: { i, wage: 'high', morale: 10 } }, result: '公告一貼出去，群組裡出現一排「老闆讚」。成本會高一點，但人比較留得住。' },
        { label: '多派一個人過去幫忙', effects: { cash: -3000, branch: { i, staff: 1, morale: 8 } }, result: '多一個人，排班終於排得開了。' },
        { label: '「撐一下，大家都很辛苦」', quote: '年輕人要多吃苦。', effects: { branch: { i, morale: -8 }, jerk: 3 }, result: `電話那頭沉默了很久。隔週${name}有兩個人遞了辭呈。` },
      ], ignore: { effects: { branch: { i, morale: -10, rating: -0.2 } }, result: '沒人回電話，分店的士氣又掉了一截。' } };
    if (type === 'rating')
      return { ...base, id: 'br_rating', title: `${name}的評價一直掉`, text: `${who}傳來截圖：最近的評論幾乎都是「等很久」「態度普通」，評價剩 ${b.rating.toFixed(1)} 顆星。`, choices: [
        ...(b.reno < 3 ? [{ label: `改裝店面（${'$' + reno.toLocaleString()}）`, effects: { cash: -reno * 2, branch: { i, reno: 1, rating: 0.3, morale: 5 } }, result: '店面煥然一新，客人走進來的表情都不一樣了。' }] : []),
        { label: '派本店的老手去支援一週', effects: { cash: -8000, branch: { i, rating: 0.35 } }, result: '老手把流程重新教了一遍，出錯少了很多。' },
        { label: '推一週便宜價，先把客人拉回來', effects: { branch: { i, price: 'cheap', rating: 0.15 } }, result: '人潮回來了，只是毛利薄了一點。（之後記得調回一般價）' },
      ], ignore: { effects: { branch: { i, rating: -0.15 } }, result: '問題沒處理，評價又往下掉了一點。' } };
    if (type === 'rent')
      return { ...base, id: 'br_rent', speaker: { look: 'landlord', name: `${name}的房東` }, title: `${name}的房東要漲房租`, text: '房東打電話來：「隔壁都租更貴了，下個月起房租漲百分之十五，不然我租給別人。」', choices: [
        { label: '接受漲價', effects: { branch: { i, rentMult: 1.15 } }, result: '房東很滿意，還說「你們很好溝通」。' },
        { label: '帶著禮盒去談，簽長約換小漲', effects: { cash: -2000, branch: { i, rentMult: sim.rng() < 0.65 ? 1.05 : 1.12 } }, result: '你帶著店裡的招牌和禮盒去坐了一個下午，房東態度軟化不少。' },
        { label: '「那我搬走好了」', effects: { branch: { i, rentMult: sim.rng() < 0.4 ? 1 : 1.25 } }, result: '房東愣了一下……結果要看他吃不吃這套。' },
      ], ignore: { effects: { branch: { i, rentMult: 1.15 } }, result: '你沒回應，房東直接寄了新合約。' } };
    return { ...base, id: 'br_broken', title: `${name}的設備壞了`, text: `${who}說：「主要的那台設備今天早上壞了，現在只能用備用的，速度慢很多。」`, choices: [
      { label: '馬上叫廠商來修', effects: { cash: -12000, branch: { i, broken: 0 } }, result: '師傅當天就來修好了，只是維修費不便宜。' },
      { label: '先撐著，等兩週後的保固維修', effects: { branch: { i, broken: 2, morale: -4 } }, result: '接下來兩週，分店的容量少了兩成，員工也比較累。' },
    ], ignore: { effects: { branch: { i, broken: 2 } }, result: '沒人處理，分店只好用備用設備撐兩週。' } };
  }

  // 員工吵架：原因、結果都會變；同一對吵第二次以上，私下調解的效果會變差，要用別的方法
  function fightEvent(a, b, sim) {
    const ids = [a.id, b.id];
    const rng = sim ? sim.rng : Math.random;
    const pick = (arr) => arr[Math.floor(rng() * arr.length)];
    const k = sim ? sim.relKey(a, b) : '';
    const nth = sim ? ((sim.fightCount = sim.fightCount || {})[k] = (sim.fightCount[k] || 0) + 1) : 1;
    const why = pick(['誰該去{w:chore}、誰又偷懶', '排班不公平，誰的假日比較多', '一個人做事很快、一個人覺得被催', '冷氣該開幾度', '誰把對方的飲料喝掉了', '對方在群組已讀不回', '交接沒交清楚，被客人罵的是自己']);
    const mgr = sim && sim.staff.find((e) => e.rank === 'manager' && e !== a && e !== b && (e.state === 'working' || e.state === 'break'));
    const talk = nth <= 1
      ? pick(['你泡了兩杯茶讓他們把話說開，最後兩個人都笑了出來。', '你請兩個人去騎樓買雞排，回來的時候已經在討論下次要吃哪一家。', '你讓兩個人各說五分鐘不准插嘴，說完發現其實是同一件事的誤會。'])
      : pick(['又是這兩個人……你調解了，但兩個人的表情都寫著「下次再說」。', '他們這次比較快和好，但你看得出來問題還在，可能要換個方法。']);
    const choices = [
      { label: nth <= 1 ? '把兩個人找來，私下調解' : nth === 2 ? '再私下調解一次' : '再私下調解一次（大概沒什麼用了）', effects: { rel: [...ids, nth <= 1 ? 30 : nth === 2 ? 15 : 5], moodOf: [[a.id, 4], [b.id, 4]], jerk: -1 }, result: talk },
      { label: '把他們排到不同班', note: '之後盡量不排同一班', effects: { rel: [...ids, 5], separate: ids }, result: pick(['眼不見為淨，至少店裡的氣氛恢復正常了。', '兩個人分開之後各自都做得很好，只是交接時還是不太說話。']) },
    ];
    if (nth >= 2) choices.push({ label: '送兩個人去上團隊溝通課', note: '$3,000・真正解開心結', effects: { cash: -6000, rel: [...ids, 45], relFix: ids, moodOf: [[a.id, 2], [b.id, 2]] }, result: '課程要兩人一組完成任務。回來之後他們有了共同的笑話：「講師說我們是最需要溝通的一組。」' });
    if (nth >= 2 && sim && sim.branches.length && sim.feature('branch')) choices.push({ label: `把${b.name}調去分店`, note: '從此不同店', effects: { transfer: b.id, moodOf: [[a.id, 3]] }, result: `${b.name}去了分店，新環境好像讓他輕鬆不少；${a.name}這邊也終於安靜了。` });
    if (mgr) choices.push({ label: `請店長${mgr.name}處理`, effects: { ...(mgr.style === 'warm' || mgr.style === 'mentor' ? { relFix: ids } : {}), rel: [...ids, mgr.style === 'warm' || mgr.style === 'mentor' ? 35 : mgr.style === 'strict' ? 10 : 20], moodOf: mgr.style === 'strict' ? [[a.id, -4], [b.id, -4]] : [[a.id, 3], [b.id, 3]] }, result: mgr.style === 'strict' ? `${mgr.name}把兩個人叫去罵了一頓，問題壓下來了，但大家都有點怕。` : `${mgr.name}找了兩個人分開聊，再一起排了新的分工表，這次應該能撐比較久。` });
    choices.push({
      label: '「吵什麼吵，都給我閉嘴做事！」',
      quote: '上班是來工作的，不是來交朋友的。',
      effects: { rel: [...ids, -15], moodOf: [[a.id, -10], [b.id, -10]], jerk: 5 },
      result: pick(['兩個人都不吭聲了，但下班後各自在群組裡抱怨了一個小時。', '店裡安靜到只剩抽風機的聲音，客人都不敢大聲說話。']),
    });
    return {
      id: 'rel_fight',
      icon: '💢',
      title: `${a.name}跟${b.name}${nth >= 2 ? `又吵架了（第 ${nth} 次）` : '吵架了'}`,
      text: `${a.name}和${b.name}為了${why}吵了起來，整間店的氣氛都很僵，客人也在看。${nth >= 2 ? '這已經不是第一次了。' : ''}`,
      choices,
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
    const ev = karenEventRaw(sim, k, victim);
    // 選項順序打亂，每次都要看清楚再選
    const c = [...ev.choices];
    for (let i = c.length - 1; i > 0; i--) {
      const j = Math.floor(sim.rng() * (i + 1));
      [c[i], c[j]] = [c[j], c[i]];
    }
    return { ...ev, choices: c };
  }

  function karenEventRaw(sim, k, victim) {
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
    // 長期目標：拿到金獎之後還有事做
    { id: 'chain5', name: '五星連鎖', desc: '開 5 間分店，而且每間評價都在 4.5 星以上', reward: 300000, long: true },
    { id: 'mentor3', name: '店長養成所', desc: '同時有 3 間分店由你培養的店長管理', reward: 150000, long: true },
    { id: 'week500', name: '一週淨賺五十萬', desc: '單週淨利超過 $500,000', reward: 100000, long: true },
    { id: 'allhappy', name: '全公司都想待', desc: '本店員工平均心情 85 以上，所有分店士氣也在 75 以上（至少 3 間分店）', reward: 120000, long: true },
    { id: 'year2', name: '老字號', desc: '經營滿兩年（96 週）', reward: 200000, long: true },
    { id: 'ipoEnd', name: '敲鐘', desc: '走完上市路線，而且沒有變成慣老闆', reward: 0, long: true },
    { id: 'coopEnd', name: '百年老店', desc: '走完員工持股路線，指定接班人', reward: 0, long: true },
  ];

  VIOLATIONS.noRestDay = VIOLATIONS.noRestDay || { label: '未依法排休（七休一）', fine: 60000 };
  VIOLATIONS.noBreak = VIOLATIONS.noBreak || { label: '未給予休息時間', fine: 40000 };
  VIOLATIONS.noInsurance = VIOLATIONS.noInsurance || { label: '未依法為員工投保勞健保、提繳勞退', fine: 50000 };

  root.BossSim = { Sim, CATALOG, catalogById, ACHIEVEMENTS, ECON, DAY, OUT_W, STREET, MIN_WAGE, WEEKDAYS, WEATHER, FESTIVALS, INS, INS_TOTAL, TAX_LABEL, CUSTOMER_TYPES, local };
})(typeof window !== 'undefined' ? window : globalThis);
