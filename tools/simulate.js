// 平衡測試：用幾種固定策略跑很多局，看勝率與結局分布。
// 用法：node tools/simulate.js [每種策略局數] [每月事件數]
require('../js/data.js');
require('../js/engine.js');
const { INDUSTRIES } = globalThis.BossData;
const { Game } = globalThis.BossEngine;

const N = Number(process.argv[2]) || 2000;
const EVENTS = Number(process.argv[3]) || 3; // 每月事件數：普通 3、爆肝 5

function pick(game, scoreFn) {
  const ev = game.currentEvent;
  let best = 0;
  let bestScore = -Infinity;
  ev.choices.forEach((c, i) => {
    if (c.minigame) return; // 小遊戲要玩家親自操作，自動測試跳過
    const fx = game.resolveEffects(c);
    const s = scoreFn(fx, game);
    if (s > bestScore) {
      bestScore = s;
      best = i;
    }
  });
  return best;
}

const money = (fx, g) => (fx.cash || 0) / g.industry.scale / 10000;

const STRATEGIES = {
  // 永遠選最佛心的選項、最好的待遇
  saint: {
    policy: { salary: 'high', overtime: 'none', benefits: 'rich' },
    choose: (g) => pick(g, (fx) => -(fx.jerk || 0) * 100 + (fx.morale || 0)),
  },
  // 永遠選最省錢的
  greedy: {
    policy: { salary: 'low', overtime: 'unpaid', benefits: 'none' },
    choose: (g) => pick(g, (fx, g) => money(fx, g) + (fx.staff || 0) * 3),
  },
  // 市場行情 + 佛心選項
  fair: {
    policy: { salary: 'market', overtime: 'none', benefits: 'basic' },
    choose: (g) => pick(g, (fx) => -(fx.jerk || 0) * 100 + (fx.morale || 0)),
  },
  // 看情況：錢夠就當好人，錢少就省；慣老闆指數高時收斂
  smart: {
    policy: { salary: 'market', overtime: 'none', benefits: 'basic' },
    choose: (g) =>
      pick(g, (fx, g) => {
        const tight = g.cash < g.industry.cash * 0.5;
        const jerkWeight = g.jerk > 50 ? 3 : tight ? 0.4 : 1.2;
        return money(fx, g) * (tight ? 2 : 1) - (fx.jerk || 0) * jerkWeight + (fx.morale || 0) * 0.3 + (fx.staff || 0) * 2;
      }),
    adjust: (g) => {
      g.setPolicy('overtime', g.cash < g.industry.cash * 0.3 ? 'paid' : 'none');
      // 售價跟著物價走，薪水落後市場就調薪
      while (g.price < g.idx.cpi - 0.015) g.changePrice(0.03);
      if (g.realWage < 0.98) g.raiseWages();
    },
  },
  random: {
    policy: null,
    choose: (g) => {
      const opts = g.currentEvent.choices.map((c, i) => i).filter((i) => !g.currentEvent.choices[i].minigame);
      return opts[Math.floor(Math.random() * opts.length)];
    },
    adjust: (g) => {
      for (const k of ['salary', 'overtime', 'benefits']) {
        const opts = Object.keys(globalThis.BossData.POLICIES[k].options);
        g.setPolicy(k, opts[Math.floor(Math.random() * opts.length)]);
      }
    },
  },
};

function play(industryId, strat) {
  const g = new Game(industryId, Math.random, { eventsPerMonth: EVENTS });
  if (strat.policy) Object.entries(strat.policy).forEach(([k, v]) => g.setPolicy(k, v));
  while (!g.over) {
    if (strat.adjust) strat.adjust(g);
    while (g.currentEvent && !g.over) g.choose(strat.choose(g));
    if (!g.over) g.endMonth();
  }
  return g;
}

for (const ind of INDUSTRIES) {
  console.log(`\n${ind.icon} ${ind.name}`);
  for (const [name, strat] of Object.entries(STRATEGIES)) {
    const tally = {};
    let jerkSum = 0;
    let cashSum = 0;
    let monthSum = 0;
    for (let i = 0; i < N; i++) {
      const g = play(ind.id, strat);
      const key = g.ending.type === 'win' ? g.ending.title : g.ending.type;
      tally[key] = (tally[key] || 0) + 1;
      jerkSum += g.jerk;
      cashSum += g.cash;
      monthSum += g.month;
    }
    const dist = Object.entries(tally)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${((v / N) * 100).toFixed(0)}%`)
      .join('、');
    console.log(
      `  ${name.padEnd(7)} 平均撐到第 ${(monthSum / N).toFixed(1)} 月 | 慣老闆 ${(jerkSum / N).toFixed(0)} | 現金 ${Math.round(cashSum / N / 1000)}k | ${dist}`
    );
  }
}
