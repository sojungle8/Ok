// 開店模擬核心：店面格子、客人與員工的自主行為、營業時間與班表、財務、事件
// 不碰 DOM，可以在 Node 裡跑
(function (root) {
  const { INDUSTRIES, CATALOG, LOTS, NAMES, TRAITS } = root.BossIndustries;
  const { EVENTS, IGNORE, VIOLATIONS } = root.BossData;
  const Looks = root.BossLooks;

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
      this.mode = opts.mode || 'normal';

      this.lotIdx = 0;
      this.setLot(0);
      this.objects = [];
      this.day = 1;
      this.minute = ind.open - 60;
      this.cash = ind.cash;
      this.loan = 0;
      this.jerk = 10;
      this.flags = new Set();
      this.reviews = [];
      this.staff = [];
      this.customers = [];
      this.passers = [];
      this.popups = [];
      this.prices = Object.fromEntries(ind.products.map((p) => [p.id, p.price]));
      this.menu = Object.fromEntries(ind.products.map((p) => [p.id, true]));
      this.policy = {
        open: ind.open,
        close: ind.close,
        shifts: ind.close - ind.open > 600 ? 2 : 1,
        restDays: 'rotate',
        overtimePay: true,
        breaks: true,
        closedDay: -1, // -1：全年無休，0～6：週一～週日公休
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
      this.over = false;
      this.ending = null;
      this.cleanWeeks = 0;

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
    get dateLabel() {
      return `第 ${this.month} 個月・第 ${((this.week - 1) % WEEKS_PER_MONTH) + 1} 週・週${WEEKDAYS[this.weekday]}`;
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
      if (!next || this.cash < next.cost) return false;
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
      o.lanes = o.staffSpots.map((s, i) => ({ staffSpot: s, custSpot: o.custSpots[Math.min(i, o.custSpots.length - 1)], staff: null, customer: null }));
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
      const wage = Math.max(MIN_WAGE, Math.round((this.marketWage * (0.92 + skill / 500 + plus)) / 5) * 5);
      return { name, gender, look, traits, skill: Math.round(skill), wage };
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
      };
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

    removeEmployee(e) {
      if (e.task && e.task.lane) e.task.lane.staff = null;
      if (e.task && e.task.type === 'rest' && e.task.obj) e.task.obj.seatTaken[e.task.seat] = null;
      this.staff = this.staff.filter((x) => x !== e);
      for (const ev of this.activeEvents) if (ev.staff === e) ev.staff = this.staff[0] || null;
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

    sendHome(e) {
      e.sentHomeDay = this.day;
      if (e.state === 'working' || e.state === 'break') this.goHome(e);
      e.mood = clamp(e.mood + 3, 0, 100);
    }

    // 每天排班：輪休的人休假，其餘的人平均分到各班
    makeRoster() {
      const working = this.staff.filter((e, i) => {
        e.slot = i;
        if (!this.openToday) return false;
        if (this.policy.restDays !== 'rotate' || this.staff.length < 2) return true;
        // 每人每週輪休兩天（錯開）
        return (this.weekday + i * 3) % 7 >= 2;
      });
      this.roster = new Map(working.map((e, k) => [e.id, k % this.hours.shifts]));
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
      const avgRatio = this.ind.products.reduce((s, p) => s + this.prices[p.id] / (p.price * this.idx.cpi), 0) / this.ind.products.length;
      const priceF = avgRatio <= 1.05 ? Math.pow(avgRatio, -0.8) : Math.pow(1.05, -0.8) * Math.pow(avgRatio / 1.05, -3);
      const beautyF = 1 + Math.min(0.25, this.beauty / 60) + this.draw;
      const lotF = 1 + this.lotIdx * 0.35;
      const summer = this.isSummer ? this.ind.summerBoost || 1 : 1;
      const heat = this.isSummer && !this.cooling ? 0.9 : 1;
      const mods = this.demandMods.reduce((m, d) => m * d.mult, 1);
      return ratingF * priceF * beautyF * lotF * summer * heat * mods;
    }

    availableProducts() {
      if (this.gridDirty) this.rebuildGrid();
      const have = new Set(this.stations.flatMap((s) => s.def.serves));
      return this.ind.products.filter((p) => this.menu[p.id] && have.has(p.id));
    }

    spawnCustomer() {
      const prods = this.availableProducts();
      if (!prods.length) return;
      const total = prods.reduce((s, p) => s + p.weight, 0);
      let r = this.rng() * total;
      let product = prods[0];
      for (const p of prods) {
        r -= p.weight;
        if (r <= 0) {
          product = p;
          break;
        }
      }
      const fromLeft = this.rng() < 0.5;
      const c = {
        id: uid++,
        kind: 'customer',
        look: Looks.randomLook(this.rng),
        product,
        qty: Math.max(1, Math.round(1 + (this.rng() + this.rng()) * ((this.ind.basket || 1) - 1))),
        x: fromLeft ? -OUT_W : this.W + OUT_W - 1,
        z: this.H + (this.ind.arriveByScooter ? 1 : 0),
        path: [],
        state: 'arriving',
        waited: 0,
        patience: 16 * (this.ind.patience || 1) * (this.mode === 'hell' ? 0.75 : 1),
        progress: 0,
        scooter: !!this.ind.arriveByScooter,
      };
      this.customers.push(c);
      this.today.visitors++;
      this.walkTo(c, { x: this.doorX + (this.rng() < 0.5 ? 0 : 1), z: this.H - 1 });
    }

    spawnPasser() {
      const fromLeft = this.rng() < 0.5;
      const lane = this.rng() < 0.75 ? 0 : 2;
      const p = {
        id: uid++,
        kind: lane === 2 ? 'scooter' : 'passer',
        look: Looks.randomLook(this.rng),
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
      const list = this.stations.filter((s) => s.type === product.station);
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
      if (!this.isOpen) {
        this.customerLeave(c, 'closed');
        return;
      }
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
      this.refreshQueue(o);
    }

    refreshQueue(o) {
      // 有空的服務位：排第一的人過去
      const anyStaff = o.lanes.some((l) => l.staff);
      for (const lane of o.lanes) {
        if (!lane.staff && (anyStaff || lane !== o.lanes[0])) continue;
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
        this.addReview(1 + (this.rng() < 0.3 ? 1 : 0), this.pickComment('angry', c));
        this.popup(c, '😡', 'bad');
      } else if (reason === 'tooLong') {
        this.today.balked++;
        this.popup(c, '😩', 'bad');
      } else if (reason === 'closed') {
        this.popup(c, '休息中', 'muted');
      } else if (reason === 'noStation') {
        this.popup(c, '❓', 'muted');
      }
      if (c.obj) this.refreshQueue(c.obj);
      c.obj = null;
    }

    finishService(c, e) {
      const p = c.product;
      const unit = this.prices[p.id];
      const price = unit * c.qty;
      const cost = p.cost * c.qty * this.idx.cpi * this.costMult.materials * (0.85 + 0.15 * this.idx.oil);
      this.cash += price - cost;
      this.ledger.revenue += price;
      this.ledger.materials += cost;
      this.today.revenue += price;
      this.today.served++;
      e.served++;
      e.skill = clamp(e.skill + 0.08 * (e.traits.includes('rookie') ? TRAITS.rookie.learn : 1), 0, 100);
      this.popup(c, `+$${price}`, 'money');

      // 滿意度
      let stars = 4.3;
      stars -= (c.waited / c.patience) * 2;
      stars += Math.min(0.5, this.beauty / 25);
      stars += (e.mood - 55) / 90;
      if (e.traits.includes('chatty')) stars += TRAITS.chatty.charm * 3;
      const ratio = unit / (p.price * this.idx.cpi);
      if (ratio > 1.1) stars -= (ratio - 1.1) * 4;
      if (ratio < 0.9) stars += 0.2;
      if (this.isSummer && !this.cooling) stars -= 0.4;
      if (e.skill > 70) stars += 0.2;

      const o = c.obj;
      if (c.lane) c.lane.customer = null;
      c.lane = null;
      c.obj = null;
      if (o) o.queue = o.queue.filter((x) => x !== c);

      // 內用：找位子坐
      let seated = false;
      if (this.ind.dineIn && this.rng() < 0.65) {
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
      if (this.reviews.length > 200) this.reviews.shift();
      if (this.reviews.length >= 30 && this.rating >= 4.5) this.achieve('rating');
    }

    pickComment(kind, c) {
      const p = c.product ? c.product.name : '';
      const pools = {
        good: [`${p}好好吃，會再來！`, '老闆和員工都很親切', '店裡乾淨又舒服', `${p}CP 值很高`, '出餐超快，上班族救星', '店員很有耐心'],
        ok: [`${p}還可以`, '中規中矩', '有點小貴', '等有點久，但還行'],
        bad: ['等太久了', '店員看起來很累，態度普通', '價格偏高', '店裡好熱'],
        angry: ['等了快二十分鐘都沒人理，直接走人', '排隊排到天荒地老', '人手明顯不夠，老闆不請人嗎'],
      };
      const arr = pools[kind];
      return arr[Math.floor(this.rng() * arr.length)];
    }

    popup(a, text, kind) {
      this.popups.push({ id: uid++, x: a.x, z: a.z, text, kind, t: 0 });
    }

    say(e, text, mins = 60) {
      e.thought = { text, until: this.minute + mins };
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
      this.minute += dt;
      if (this.gridDirty) this.rebuildGrid();

      // 換日
      if (this.minute >= this.dayEndMinute()) {
        this.endDay();
        return;
      }

      // 來客
      if (this.isOpen) {
        const rate = (this.ind.baseArrivals * this.ind.demand[this.hour] * this.attractiveness()) / 60;
        if (this.rng() < rate * dt) this.spawnCustomer();
      }
      const daylight = this.hour >= 6 && this.hour < 22 ? 1 : 0.25;
      if (this.rng() < (0.55 * daylight) * dt) this.spawnPasser();

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
        const arrived = this.moveAgent(c, 2.4, dt);
        switch (c.state) {
          case 'arriving':
            if (arrived) this.customerArrived(c);
            break;
          case 'queue':
          case 'toLane':
            c.waited += dt * (c.waitSeat ? 0.6 : 1);
            if (c.state === 'toLane' && arrived) {
              c.state = 'atLane';
              this.freeWaitSeat(c);
            }
            if (c.waited > c.patience) this.customerLeave(c, 'angry');
            break;
          case 'atLane': {
            const lane = c.lane;
            const e = lane && lane.staff && lane.staff.state === 'working' && lane.staff.task && lane.staff.task.lane === lane && !lane.staff.path.length ? lane.staff : null;
            if (e) {
              c.progress += (dt * this.speedOf(e)) / (c.product.time * (1 + (c.qty - 1) * 0.6));
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
              this.reviewFor(c);
              this.customerLeave(c, 'done');
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
      return s;
    }

    restSpots() {
      return this.objects.filter((o) => o.def.cat === 'staff' && o.def.rest);
    }

    goHome(e) {
      if (e.task && e.task.lane && e.task.lane.staff === e) e.task.lane.staff = null;
      if (e.task && e.task.type === 'rest' && e.task.obj) e.task.obj.seatTaken[e.task.seat] = null;
      e.task = null;
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
        if (this.mode === 'hell') drain *= 1.2;
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
      if (e.task && e.task.lane && e.task.lane.staff === e) e.task.lane.staff = null;
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

    assignWork(e) {
      const cur = e.task && e.task.lane;
      const need = (o) => o.queue.length + o.lanes.filter((l) => l.customer).length - o.lanes.filter((l) => l.staff).length;
      let best = null;
      let bestScore = 0.5;
      for (const o of this.stations) {
        for (const lane of o.lanes) {
          if (lane.staff && lane.staff !== e) continue;
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
      // 沒人要服務：留在原位，或去一個沒人顧的服務位待命
      if (!best && !cur) {
        for (const o of this.stations) {
          const lane = o.lanes.find((l) => !l.staff);
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

    updateMood(e, dt) {
      let target = 62;
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
      if (!pool.length) pool.push('今天也要加油', '……', '晚餐要吃什麼呢');
      this.say(e, pool[Math.floor(this.rng() * pool.length)], 35);
    }

    // ───── 事件 ─────
    planDay() {
      this.today = this.emptyDay();
      this.pendingEvents = [];
      this.makeRoster();
      if (!this.openToday) return;
      // 平均一天不到一件事
      const count = Math.floor((this.mode === 'hell' ? 0.6 : 0.25) + this.rng() * 1.1);
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
      this.pendingEvents.sort((a, b) => a.at - b.at);
    }

    spawnEvent(p) {
      const working = this.staff.filter((e) => e.state === 'working' || e.state === 'break');
      if (p.where === 'staff') {
        if (!working.length) return;
        p.staff = working[Math.floor(this.rng() * working.length)];
      }
      p.spawnedAt = this.minute;
      p.deadline = this.minute + { staff: 150, phone: 50, door: 70 }[p.where];
      p.id = uid++;
      this.activeEvents.push(p);
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
      this.activeEvents = this.activeEvents.filter((x) => x !== ev);
      const after = { cash: this.cash, morale: Math.round(this.morale), jerk: Math.round(this.jerk), staff: this.staff.length };
      const delta = Object.fromEntries(Object.keys(after).map((k) => [k, Math.round(after[k] - before[k])]));
      this.checkEnding();
      return { event: ev.ev, choice, delta };
    }

    resolve(ev, index) {
      return this.applyChoice(ev, ev.ev.choices[index]);
    }

    ignoreEvent(ev) {
      const r = this.applyChoice(ev, ev.ev.ignore || IGNORE[ev.where]);
      if (r && this.cb.ignored) this.cb.ignored(r, ev);
    }

    // ───── 每日、每週、每月 ─────
    emptyLedger() {
      return { revenue: 0, materials: 0, wages: 0, rent: 0, utilities: 0, interest: 0, events: 0, other: 0 };
    }

    emptyDay() {
      return { visitors: 0, served: 0, angry: 0, balked: 0, revenue: 0 };
    }

    endDay() {
      const report = { day: this.day, ...this.today, wages: 0, ot: 0 };
      // 薪水：上班時數 × 時薪，超過八小時算加班
      let unpaidOT = 0;
      for (const e of this.staff) {
        const hours = e.minutesToday / 60;
        if (hours <= 0) continue;
        const normal = Math.min(8, hours);
        const ot = Math.max(0, hours - 8);
        let pay = normal * e.wage;
        if (ot > 0) {
          if (this.policy.overtimePay) pay += Math.min(2, ot) * e.wage * 1.34 + Math.max(0, ot - 2) * e.wage * 1.67;
          else unpaidOT += ot;
          report.ot += ot;
        }
        pay = Math.round(pay);
        report.wages += pay;
        e.minutesToday = 0;
        // 心情太差連續好幾天就會離職
        e.lowMoodDays = e.mood < 22 ? e.lowMoodDays + 1 : 0;
      }
      this.cash -= report.wages;
      this.ledger.wages += report.wages;

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
      const profit = L.revenue - L.materials - L.wages - L.rent - L.utilities - L.interest + L.events + L.other;
      const report = { week: this.week - 1 || 1, ...L, profit, rating: this.rating, morale: this.morale, jerk: this.jerk, inspection: null, news: [] };

      // 勞動檢查
      if (this.rng() < 0.05 + this.jerk / 250) {
        const v = [...this.flags].filter((f) => VIOLATIONS[f]);
        const fine = Math.round(v.reduce((s, f) => s + VIOLATIONS[f].fine, 0) * 0.6);
        report.inspection = { violations: v.map((f) => VIOLATIONS[f].label), fine };
        if (v.length) {
          this.cash -= fine;
          this.jerk = clamp(this.jerk + 5, 0, JERK_LIMIT);
        } else this.jerk = clamp(this.jerk - 3, 0, JERK_LIMIT);
      }
      this.flags.clear();
      this.cleanWeeks = this.jerk < 15 ? this.cleanWeeks + 1 : 0;
      if (this.cleanWeeks >= 4) this.achieve('saint');
      if (L.revenue >= 200000) this.achieve('revenue');

      // 每四週是一個月：物價、油價、電價
      if ((this.week - 1) % WEEKS_PER_MONTH === 0) report.news = this.advanceEconomy();
      this.history.push(report);
      this.ledger = this.emptyLedger();
      this.candidates = this.rollCandidates();
      this.lastWeek = report;
      this.checkEnding(true);
      if (this.cb.weekEnd) this.cb.weekEnd(report);
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
      });
    }

    static load(json, opts) {
      const d = JSON.parse(json);
      const s = new Sim(d.ind, { ...opts, shopName: d.shopName, mode: d.mode });
      s.objects = [];
      s.setLot(d.lotIdx);
      for (const [t, x, z, r] of d.objects) s.place(t, x, z, r, true);
      Object.assign(s, { day: d.day, cash: d.cash, loan: d.loan, jerk: d.jerk, reviews: d.reviews, prices: d.prices, menu: d.menu, policy: d.policy, idx: d.idx, costMult: d.costMult, history: d.history, cleanWeeks: d.cleanWeeks || 0 });
      s.achievements = new Set(d.achievements);
      s.staff = d.staff.map((e) => ({ ...e, task: null, path: [], state: 'off', x: -OUT_W, z: s.H }));
      s.minute = s.dayStart;
      s.customers = [];
      s.candidates = s.rollCandidates();
      s.planDay();
      return s;
    }
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
  ];

  VIOLATIONS.noRestDay = VIOLATIONS.noRestDay || { label: '未依法排休（七休一）', fine: 60000 };
  VIOLATIONS.noBreak = VIOLATIONS.noBreak || { label: '未給予休息時間', fine: 40000 };

  root.BossSim = { Sim, CATALOG, catalogById, ACHIEVEMENTS, ECON, DAY, OUT_W, STREET, MIN_WAGE, WEEKDAYS, local };
})(typeof window !== 'undefined' ? window : globalThis);
