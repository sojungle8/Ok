// 遊戲邏輯（不碰 DOM，方便在 Node 裡做平衡測試）
(function (root) {
  const { INDUSTRIES, POLICIES, VIOLATIONS, EVENTS } = root.BossData;

  const MAX_MONTH = 12;
  const EVENTS_PER_MONTH = 2;
  const JERK_LIMIT = 100;

  // 總體經濟時間線
  const ECONOMY = {
    cpiDrift: 0.004, // 物價每月平均上漲 0.4%（一年約 5%）
    cpiNoise: 0.002,
    wageDrift: 0.004, // 市場薪資每月平均上漲
    oilDrift: 0.006,
    oilNoise: 0.04,
    gasPrice: 30, // 起始 95 無鉛每公升價格，只用來顯示新聞
    powerMonths: [4, 10], // 電價審議後生效的月份
    powerSteps: [0, 0.03, 0.05, 0.08, 0.11],
    summerMonths: [6, 7, 8, 9], // 夏月電價
    summerPower: 1.15,
    elasticity: 0.6, // 售價跟物價差不多時，客人不太敏感
    overpriceAt: 1.05, // 售價高於物價 5% 以上，客人開始大量流失
    overpriceElasticity: 3,
  };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const pct = (v) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
  const round = (v, step = 100) => Math.round(v / step) * step;

  class Game {
    constructor(industryId, rng = Math.random) {
      const ind = INDUSTRIES.find((i) => i.id === industryId);
      if (!ind) throw new Error(`未知產業：${industryId}`);
      this.industry = ind;
      this.rng = rng;
      this.month = 1;
      this.cash = ind.cash;
      this.staff = ind.staff;
      this.morale = 60;
      this.jerk = 10;
      this.policy = { salary: 'market', overtime: 'none', benefits: 'basic' };
      this.wageMult = 1;
      this.costMult = { rent: 1, materials: 1, utilities: 1, fuel: 1 };
      this.idx = { cpi: 1, wage: 1, oil: 1, power: 1 };
      this.price = 1; // 自家售價指數
      this.news = [];
      this.demandMods = [];
      this.flags = new Set();
      this.usedEvents = new Set();
      this.queue = [];
      this.monthEventCash = 0;
      this.history = [];
      this.over = false;
      this.ending = null;
      this.advanceEconomy();
      this.startMonth();
    }

    // ───── 數值計算 ─────
    get wage() {
      return this.industry.wage * POLICIES.salary.options[this.policy.salary].mult * this.wageMult;
    }

    get currentEvent() {
      return this.queue[0] || null;
    }

    seasonMult(month = this.month) {
      return this.industry.season ? this.industry.season[month - 1] : 1;
    }

    demandModMult() {
      return this.demandMods.reduce((m, d) => m * d.mult, 1);
    }

    // 預估本月損益（需求取期望值、不含隨機波動）
    projection() {
      return this.computeMonth(1);
    }

    // 售價相對物價的需求倍率：漲價跟上物價影響不大，漲過頭客人就跑了
    priceDemandMult() {
      const r = this.price / this.idx.cpi;
      if (r <= ECONOMY.overpriceAt) return Math.pow(r, -ECONOMY.elasticity);
      return Math.pow(ECONOMY.overpriceAt, -ECONOMY.elasticity) * Math.pow(r / ECONOMY.overpriceAt, -ECONOMY.overpriceElasticity);
    }

    // 各項固定成本，跟著物價、油價、電價走
    costBreakdown(month = this.month) {
      const c = this.industry.costs;
      const summer = ECONOMY.summerMonths.includes(month) ? ECONOMY.summerPower : 1;
      return {
        rent: c.rent * this.costMult.rent,
        materials: c.materials * this.costMult.materials * this.idx.cpi,
        utilities: c.utilities * this.costMult.utilities * this.idx.power * summer,
        fuel: c.fuel * this.costMult.fuel * this.idx.oil,
      };
    }

    // 實質薪資：你的調薪幅度 ÷ 市場薪資漲幅
    get realWage() {
      return this.wageMult / this.idx.wage;
    }

    computeMonth(demandNoise) {
      const ind = this.industry;
      const ot = POLICIES.overtime.options[this.policy.overtime];
      const ben = POLICIES.benefits.options[this.policy.benefits];
      const moraleFactor = 0.85 + 0.3 * (this.morale / 100);
      // 產能與需求以「起始售價」計的份量，乘上售價才是營收
      const capacityUnits = this.staff * ind.rps * ot.prod * moraleFactor;
      const demandUnits = ind.demand * this.seasonMult() * this.demandModMult() * this.priceDemandMult() * demandNoise;
      const capacity = capacityUnits * this.price;
      const demand = demandUnits * this.price;
      const revenue = Math.min(capacity, demand);
      const wageBill = this.staff * this.wage;
      const otCost = wageBill * ot.otRate;
      const benefitCost = this.staff * ben.cost * ind.scale * this.idx.cpi;
      const costs = this.costBreakdown();
      const fixed = costs.rent + costs.materials + costs.utilities + costs.fuel;
      const profit = revenue - wageBill - otCost - benefitCost - fixed;
      return {
        capacity: round(capacity),
        demand: round(demand),
        revenue: round(revenue),
        wageBill: round(wageBill),
        otCost: round(otCost),
        benefitCost: round(benefitCost),
        costs: Object.fromEntries(Object.entries(costs).map(([k, v]) => [k, round(v)])),
        fixed: round(fixed),
        profit: round(profit),
      };
    }

    // ───── 時間線：每月初更新物價、油價、電價並產生新聞 ─────
    advanceEconomy() {
      const E = ECONOMY;
      const news = [];
      if (this.month === 1) {
        news.push('🗞️ 新的一年開始。物價、油價、電價都可能上漲，記得留意成本。');
      } else {
        this.idx.cpi *= 1 + E.cpiDrift + (this.rng() * 2 - 1) * E.cpiNoise;
        this.idx.wage *= 1 + E.wageDrift;
        const oilBefore = this.idx.oil;
        this.idx.oil = clamp(this.idx.oil * (1 + E.oilDrift + (this.rng() * 2 - 1) * E.oilNoise), 0.7, 1.8);
        const gasDiff = (this.idx.oil - oilBefore) * E.gasPrice;
        if (Math.abs(gasDiff) >= 0.3) {
          news.push(
            `⛽ 國際油價${gasDiff > 0 ? '上漲' : '回落'}，中油本月累計${gasDiff > 0 ? '調漲' : '調降'}汽油每公升 ${Math.abs(gasDiff).toFixed(1)} 元（95 無鉛 ${(this.idx.oil * E.gasPrice).toFixed(1)} 元）。`
          );
        }
      }
      if (E.powerMonths.includes(this.month)) {
        const step = E.powerSteps[Math.floor(this.rng() * E.powerSteps.length)];
        this.idx.power *= 1 + step;
        news.push(step ? `⚡ 電價費率審議會決議：本月起電價平均調漲 ${(step * 100).toFixed(0)}%。` : '⚡ 電價費率審議會決議：本期電價凍漲。');
      }
      if (this.month === E.summerMonths[0]) news.push('☀️ 夏月電價開始，6～9 月電費會比較貴。');
      if (this.month === E.summerMonths[E.summerMonths.length - 1] + 1) news.push('🍂 夏月電價結束，電費回到非夏月費率。');
      if (this.month > 1) {
        news.push(`📈 物價比年初上漲 ${pct(this.idx.cpi - 1)}，市場薪資上漲 ${pct(this.idx.wage - 1)}。`);
        if (this.price < this.idx.cpi - 0.02) news.push('🏷️ 你的售價還停在年初，其實已經比同業便宜了。');
      }
      this.news = news;
    }

    raiseWages() {
      if (this.over || this.raisedThisMonth) return false;
      this.raisedThisMonth = true;
      this.wageMult += 0.03;
      this.morale = clamp(this.morale + 3, 0, 100);
      this.jerk = clamp(this.jerk - 1, 0, JERK_LIMIT);
      return true;
    }

    changePrice(step) {
      if (this.over) return false;
      this.price = clamp(Math.round((this.price + step) * 100) / 100, 0.8, 1.6);
      return true;
    }

    get hireCost() {
      return round(this.wage * 0.3, 1000);
    }

    get severance() {
      return round(this.wage, 1000);
    }

    // ───── 月初：抽事件 ─────
    startMonth() {
      this.monthEventCash = 0;
      this.raisedThisMonth = false;
      const eligible = EVENTS.filter(
        (e) =>
          (!e.industries || e.industries.includes(this.industry.id)) &&
          (!e.months || e.months.includes(this.month)) &&
          (!e.cond || e.cond(this))
      );
      const forced = eligible.filter((e) => e.forced);
      let pool = eligible.filter((e) => !e.forced && !this.usedEvents.has(e.id));
      if (pool.length < EVENTS_PER_MONTH) pool = eligible.filter((e) => !e.forced);

      const picked = [...forced];
      while (picked.length < EVENTS_PER_MONTH && pool.length) {
        const weights = pool.map((e) => (e.industries ? 1.6 : 1));
        const total = weights.reduce((a, b) => a + b, 0);
        let r = this.rng() * total;
        let idx = 0;
        while (r > weights[idx]) r -= weights[idx++];
        picked.push(pool[idx]);
        pool = pool.filter((_, i) => i !== idx);
      }
      picked.forEach((e) => this.usedEvents.add(e.id));
      // 強制事件（年終）放在最後
      this.queue = picked.filter((e) => !e.forced).concat(picked.filter((e) => e.forced));
    }

    // ───── 事件選項 ─────
    resolveEffects(choice) {
      const raw = typeof choice.effects === 'function' ? choice.effects(this) : choice.effects || {};
      const fx = { ...raw };
      if (fx.cash) fx.cash = round(fx.cash * this.industry.scale, 1000);
      return fx;
    }

    choose(index) {
      const ev = this.currentEvent;
      if (!ev || this.over) return null;
      const choice = ev.choices[index];
      const fx = this.resolveEffects(choice);
      const before = this.snapshot();
      this.applyEffects(fx);
      this.monthEventCash += fx.cash || 0;
      this.queue.shift();
      const result = {
        event: ev,
        choice,
        delta: this.diff(before),
      };
      this.checkEnding();
      return result;
    }

    applyEffects(fx) {
      if (fx.cash) this.cash += fx.cash;
      if (fx.morale) this.morale = clamp(this.morale + fx.morale, 0, 100);
      if (fx.jerk) this.jerk = clamp(this.jerk + fx.jerk, 0, JERK_LIMIT);
      if (fx.staff) this.staff = clamp(this.staff + fx.staff, 0, this.industry.maxStaff);
      if (fx.wageMult) this.wageMult += fx.wageMult;
      if (fx.costMult) for (const [k, v] of Object.entries(fx.costMult)) this.costMult[k] += v;
      if (fx.index) for (const [k, v] of Object.entries(fx.index)) this.idx[k] *= 1 + v;
      if (fx.price) this.price = clamp(this.price + fx.price, 0.8, 1.6);
      if (fx.demand) this.demandMods.push({ ...fx.demand });
      if (fx.flag) this.flags.add(fx.flag);
    }

    snapshot() {
      return { cash: this.cash, morale: this.morale, jerk: this.jerk, staff: this.staff };
    }

    diff(before) {
      const now = this.snapshot();
      const d = {};
      for (const k of Object.keys(now)) d[k] = Math.round(now[k] - before[k]);
      return d;
    }

    // ───── 經營方針 / 人事 ─────
    setPolicy(key, value) {
      if (!POLICIES[key] || !POLICIES[key].options[value]) return;
      this.policy[key] = value;
    }

    hire() {
      if (this.over || this.staff >= this.industry.maxStaff) return false;
      this.cash -= this.hireCost;
      this.monthEventCash -= this.hireCost;
      this.staff += 1;
      return true;
    }

    layoff() {
      if (this.over || this.staff <= 1) return false;
      this.cash -= this.severance;
      this.monthEventCash -= this.severance;
      this.staff -= 1;
      this.morale = clamp(this.morale - 4, 0, 100);
      this.jerk = clamp(this.jerk + 1, 0, JERK_LIMIT);
      return true;
    }

    // ───── 月底結算 ─────
    endMonth() {
      if (this.over || this.queue.length) return null;
      const notes = [];
      const noise = 1 + (this.rng() * 2 - 1) * this.industry.volatility;
      const m = this.computeMonth(noise);
      this.cash += m.profit;

      const before = this.snapshot();
      const sal = POLICIES.salary.options[this.policy.salary];
      const ot = POLICIES.overtime.options[this.policy.overtime];
      const ben = POLICIES.benefits.options[this.policy.benefits];

      // 士氣：方針影響 + 慢慢回到 50
      let moraleDelta = sal.morale + ot.morale + ben.morale + (50 - this.morale) * 0.1;
      if (m.demand > m.capacity * 1.15) {
        moraleDelta -= 3;
        notes.push('人手不足，大家都忙不過來，士氣下滑。');
      }

      // 物價一直漲、薪水沒跟上
      let jerkExtra = 0;
      if (this.realWage < 0.94) {
        moraleDelta -= 4;
        jerkExtra = 2;
        notes.push('物價漲了一大截，薪水卻沒動，大家開始算自己其實被減薪多少。');
      } else if (this.realWage < 0.97) {
        moraleDelta -= 2;
        jerkExtra = 1;
        notes.push('薪水漸漸追不上物價，員工開始抱怨。');
      }
      this.morale = clamp(this.morale + moraleDelta, 0, 100);

      // 慣老闆指數：方針影響，什麼都沒做會慢慢被淡忘
      this.jerk = clamp(this.jerk + sal.jerk + ot.jerk + ben.jerk + jerkExtra - 1, 0, JERK_LIMIT);

      // 離職：士氣低於 40 開始有人走
      let quits = 0;
      if (this.morale < 40) {
        const p = (40 - this.morale) / 120;
        for (let i = 0; i < this.staff; i++) if (this.rng() < p) quits++;
        quits = Math.min(quits, this.staff);
        if (quits) {
          this.staff -= quits;
          this.morale = clamp(this.morale - 2 * quits, 0, 100);
          notes.push(`士氣低落，有 ${quits} 位員工離職了。`);
        }
      }

      // 勞動檢查
      let inspection = null;
      if (this.rng() < 0.04 + this.jerk / 200) {
        const violations = [...this.flags];
        if (ot.violation && !violations.includes(ot.violation)) violations.push(ot.violation);
        const fine = round(
          violations.reduce((s, v) => s + VIOLATIONS[v].fine, 0) * this.industry.scale,
          1000
        );
        inspection = { violations: violations.map((v) => VIOLATIONS[v].label), fine };
        if (violations.length) {
          this.cash -= fine;
          this.jerk = clamp(this.jerk + 5, 0, JERK_LIMIT);
          this.flags.clear();
        } else {
          this.jerk = clamp(this.jerk - 3, 0, JERK_LIMIT);
        }
      }

      this.demandMods = this.demandMods
        .map((d) => ({ ...d, months: d.months - 1 }))
        .filter((d) => d.months > 0);

      const report = {
        month: this.month,
        ...m,
        eventCash: this.monthEventCash,
        quits,
        inspection,
        notes,
        delta: this.diff(before),
        cash: this.cash,
      };
      this.history.push(report);

      this.checkEnding(true);
      if (!this.over) {
        if (this.month >= MAX_MONTH) {
          this.finish();
        } else {
          this.month += 1;
          this.advanceEconomy();
          this.startMonth();
        }
      }
      return report;
    }

    // 現金只在月底檢查：月中可以暫時透支
    checkEnding(monthEnd = false) {
      if (this.over) return;
      if (this.jerk >= JERK_LIMIT) this.end('jerk');
      else if (this.staff <= 0) this.end('empty');
      else if (monthEnd && this.cash < 0) this.end('bankrupt');
    }

    end(type) {
      this.over = true;
      this.ending = { type, ...ENDINGS[type](this) };
    }

    finish() {
      this.over = true;
      const start = this.industry.cash;
      let title, desc;
      if (this.jerk <= 15 && this.morale >= 70) {
        title = '佛心老闆';
        desc = '員工在 Dcard 發文推爆你的公司，履歷多到看不完。';
      } else if (this.jerk <= 35) {
        title = '好老闆';
        desc = '不完美，但員工都說「在這裡工作很安心」。';
      } else if (this.jerk <= 60) {
        title = '普通老闆';
        desc = '大家把這裡當成一份工作，不多也不少。';
      } else {
        title = '慣老闆預備軍';
        desc = '公司是撐過來了，但員工私下都叫你「那個人」。';
      }
      let money;
      if (this.cash >= start * 1.5) money = '公司還賺了不少錢，股東很滿意。';
      else if (this.cash >= start * 0.8) money = '財務穩健，明年可以繼續拚。';
      else money = '財務有點吃緊，但公司活下來了。';
      const score = Math.max(
        0,
        Math.round((100 - this.jerk) * 10 + this.morale * 5 + Math.min(this.cash / start, 3) * 300)
      );
      this.ending = { type: 'win', title, desc: `${desc}${money}`, score };
    }
  }

  const ENDINGS = {
    jerk: (g) => ({
      title: '你成了慣老闆',
      desc: `你的公司登上新聞頭條：〈血汗${g.industry.name}老闆語錄曝光！網友：根本慣老闆本人〉。員工集體出走，勞工局也找上門了。`,
      score: 0,
    }),
    bankrupt: (g) => ({
      title: '公司倒閉了',
      desc: '你對員工很好，但帳戶見底了。員工們很難過，有人說：「這是我待過最好的公司。」好老闆也要會算錢。',
      score: 0,
    }),
    empty: () => ({
      title: '全員離職',
      desc: '某天早上，你發現辦公室只剩下你一個人。',
      score: 0,
    }),
  };

  root.BossEngine = { Game, MAX_MONTH, JERK_LIMIT, ECONOMY };
})(typeof window !== 'undefined' ? window : globalThis);
