// 畫面渲染與操作
(function () {
  const { INDUSTRIES, COST_LABELS, POLICIES } = window.BossData;
  const { Game, MAX_MONTH, ECONOMY } = window.BossEngine;
  const app = document.getElementById('app');

  const ui = {
    game: null,
    phase: 'start', // start | event | result | ready | report
    lastResult: null,
    lastReport: null,
  };

  const money = (n) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString('zh-TW')}`;
  const signed = (n) => (n > 0 ? `+${n}` : `${n}`);
  const signedMoney = (n) => (n > 0 ? `+${money(n)}` : money(n));
  const pct = (v) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;

  const costLabel = (g, key) => (g.industry.costLabels && g.industry.costLabels[key]) || COST_LABELS[key];
  const costRows = (g, costs) => Object.keys(COST_LABELS).map((k) => [costLabel(g, k), -costs[k]]);

  function jerkHint(j) {
    if (j < 30) return '員工覺得你人還不錯';
    if (j < 60) return '茶水間開始有人講你閒話';
    if (j < 80) return 'Dcard 上出現了你公司的名字';
    return '記者已經在打聽你了……';
  }

  function moraleHint(m) {
    if (m >= 75) return '大家做得很開心';
    if (m >= 50) return '還算穩定';
    if (m >= 40) return '有人在偷看 104';
    return '士氣低落，隨時有人會離職';
  }

  function deltaChips(d, { showCash = true } = {}) {
    const chips = [];
    if (showCash && d.cash) chips.push(`<span class="chip ${d.cash > 0 ? 'good' : 'bad'}">💰 ${signedMoney(d.cash)}</span>`);
    if (d.morale) chips.push(`<span class="chip ${d.morale > 0 ? 'good' : 'bad'}">😊 士氣 ${signed(d.morale)}</span>`);
    if (d.jerk) chips.push(`<span class="chip ${d.jerk < 0 ? 'good' : 'bad'}">😈 慣老闆 ${signed(d.jerk)}</span>`);
    if (d.staff) chips.push(`<span class="chip ${d.staff > 0 ? 'good' : 'bad'}">👥 員工 ${signed(d.staff)}</span>`);
    return chips.length ? `<div class="chips">${chips.join('')}</div>` : '<div class="chips"><span class="chip">沒什麼變化</span></div>';
  }

  // ───── 開始畫面 ─────
  function renderStart() {
    app.innerHTML = `
      <section class="intro card">
        <p class="lead">你剛成為一間公司的老闆。</p>
        <p>每個月都會遇到各種狀況：颱風假、員工要求加薪、客戶要你明天上線……</p>
        <p>你的目標是撐過 <strong>${MAX_MONTH} 個月</strong>，而且：</p>
        <ul class="rules">
          <li>😈 <strong>慣老闆指數</strong>不能到 100，不然你會上新聞</li>
          <li>💰 <strong>現金</strong>月底不能是負的，不然公司會倒閉</li>
          <li>👥 <strong>員工</strong>不能全部跑光</li>
        </ul>
        <p class="hint">太佛心會倒閉，太摳會變慣老闆。做選擇時你只看得到要花多少錢，員工心裡怎麼想，選了才知道。</p>
      </section>
      <h2 class="section-title">選擇你的產業</h2>
      <div class="industries">
        ${INDUSTRIES.map(
          (ind) => `
          <button class="industry card" data-action="start" data-id="${ind.id}">
            <span class="industry-icon">${ind.icon}</span>
            <span class="industry-name">${ind.name}</span>
            <span class="industry-desc">${ind.desc}</span>
            <span class="industry-meta">起始資金 ${money(ind.cash)}・員工 ${ind.staff} 人</span>
          </button>`
        ).join('')}
      </div>`;
  }

  // ───── 遊戲畫面 ─────
  function renderStats(g) {
    return `
      <section class="stats card">
        <div class="stat">
          <span class="stat-label">${g.industry.icon} ${g.industry.name}</span>
          <span class="stat-value">第 ${g.month} / ${MAX_MONTH} 月</span>
        </div>
        <div class="stat">
          <span class="stat-label">💰 現金</span>
          <span class="stat-value ${g.cash < 0 ? 'neg' : ''}">${money(g.cash)}</span>
        </div>
        <div class="stat">
          <span class="stat-label">👥 員工</span>
          <span class="stat-value">${g.staff} 人</span>
        </div>
        <div class="stat bar-stat">
          <span class="stat-label">😊 士氣 <b>${Math.round(g.morale)}</b></span>
          <div class="bar"><div class="bar-fill morale" style="width:${g.morale}%"></div></div>
          <span class="stat-hint">${moraleHint(g.morale)}</span>
        </div>
        <div class="stat bar-stat">
          <span class="stat-label">😈 慣老闆指數 <b>${Math.round(g.jerk)}</b></span>
          <div class="bar"><div class="bar-fill jerk" style="width:${g.jerk}%"></div></div>
          <span class="stat-hint">${jerkHint(g.jerk)}</span>
        </div>
      </section>`;
  }

  function renderEvent(g) {
    const ev = g.currentEvent;
    return `
      <article class="card event">
        <div class="event-head">
          <span class="event-icon">${ev.icon}</span>
          <div>
            <div class="event-kicker">第 ${g.month} 月・事件 ${remainingLabel(g)}</div>
            <h2>${ev.title}</h2>
          </div>
        </div>
        <p class="event-text">${ev.text}</p>
        <div class="choices">
          ${ev.choices
            .map((c, i) => {
              const fx = g.resolveEffects(c);
              const cost = fx.cash ? `<span class="cost ${fx.cash > 0 ? 'good' : 'bad'}">${signedMoney(fx.cash)}</span>` : '';
              const note = c.note ? `<span class="cost note">${c.note}</span>` : '';
              const quote = c.quote ? `<span class="quote">「${c.quote}」</span>` : '';
              return `
                <button class="choice" data-action="choose" data-index="${i}">
                  <span class="choice-label">${c.label}</span>
                  ${quote}
                  <span class="choice-meta">${cost}${note}</span>
                </button>`;
            })
            .join('')}
        </div>
      </article>`;
  }

  function remainingLabel(g) {
    const done = ui.eventsThisMonth - g.queue.length + 1;
    return `${done} / ${ui.eventsThisMonth}`;
  }

  function renderResult(g) {
    const r = ui.lastResult;
    return `
      <article class="card event result">
        <div class="event-head">
          <span class="event-icon">${r.event.icon}</span>
          <div>
            <div class="event-kicker">你的決定</div>
            <h2>${r.choice.label}</h2>
          </div>
        </div>
        <p class="event-text">${r.choice.result}</p>
        ${deltaChips(r.delta)}
        ${r.choice.tip ? `<div class="tip">📘 <strong>勞動法小知識：</strong>${r.choice.tip}</div>` : ''}
        <button class="primary" data-action="continue">${g.over ? '看結局' : '繼續'}</button>
      </article>`;
  }

  function renderReady(g) {
    const p = g.projection();
    return `
      <article class="card event">
        <div class="event-head">
          <span class="event-icon">🗓️</span>
          <div>
            <div class="event-kicker">第 ${g.month} 月</div>
            <h2>這個月的事情都處理完了</h2>
          </div>
        </div>
        <p class="event-text">結算前，可以在旁邊調整經營方針、招人或資遣。月底現金是負的，公司就會倒閉。</p>
        <p class="event-text">預估本月營業損益：<strong class="${p.profit < 0 ? 'neg' : 'pos'}">${signedMoney(p.profit)}</strong>
        ${g.cash + p.profit < 0 ? '<br><span class="warn">⚠️ 照這樣下去，月底現金會變成負的！</span>' : ''}</p>
        <button class="primary" data-action="end-month">結算本月 →</button>
      </article>`;
  }

  function renderReport(g) {
    const r = ui.lastReport;
    const rows = [
      ['營收', r.revenue, r.demand > r.capacity ? `市場需求 ${money(r.demand)}，產能只做得到 ${money(r.capacity)}` : `產能 ${money(r.capacity)}，市場只要 ${money(r.demand)}`],
      ['薪資', -r.wageBill],
      ['加班費', -r.otCost],
      ['員工福利', -r.benefitCost],
      ...costRows(g, r.costs),
    ].filter(([, v]) => v !== 0);
    let inspection = '';
    if (r.inspection) {
      inspection = r.inspection.violations.length
        ? `<div class="alert bad">🔍 <strong>勞動檢查！</strong>查到 ${r.inspection.violations.join('、')}，罰鍰 ${money(r.inspection.fine)}。</div>`
        : `<div class="alert good">🔍 <strong>勞動檢查</strong>：沒有發現違規，慣老闆指數 -3。</div>`;
    }
    return `
      <article class="card event report">
        <div class="event-head">
          <span class="event-icon">📊</span>
          <div>
            <div class="event-kicker">月底結算</div>
            <h2>第 ${r.month} 月報表</h2>
          </div>
        </div>
        <table class="ledger">
          ${rows
            .map(
              ([k, v, hint]) => `
            <tr><th>${k}${hint ? `<small>${hint}</small>` : ''}</th><td class="${v < 0 ? 'neg' : 'pos'}">${signedMoney(v)}</td></tr>`
            )
            .join('')}
          <tr class="total"><th>營業損益</th><td class="${r.profit < 0 ? 'neg' : 'pos'}">${signedMoney(r.profit)}</td></tr>
          <tr><th>本月事件與人事收支<small>已在當下入帳</small></th><td class="${r.eventCash < 0 ? 'neg' : 'pos'}">${signedMoney(r.eventCash)}</td></tr>
        </table>
        ${r.notes.map((n) => `<div class="alert">${n}</div>`).join('')}
        ${inspection}
        <p class="sub">月底變化</p>
        ${deltaChips(r.delta, { showCash: false })}
        <button class="primary" data-action="next-month">${g.over ? '看結局' : `進入第 ${g.month} 月 →`}</button>
      </article>`;
  }

  function renderEconomy(g) {
    const locked = g.over;
    const summer = ECONOMY.summerMonths.includes(g.month);
    const rel = g.price / g.idx.cpi;
    let priceHint;
    if (rel > ECONOMY.overpriceAt) priceHint = '<span class="warn">比同業貴太多，客人在流失</span>';
    else if (rel < 0.98) priceHint = '比同業便宜，客人多但利潤薄';
    else priceHint = '跟物價差不多，客人可以接受';
    const wageGap = g.realWage;
    let wageHint;
    if (wageGap < 0.97) wageHint = '<span class="warn">薪水追不上物價，員工在抱怨</span>';
    else if (wageGap < 1) wageHint = '稍微落後市場行情';
    else wageHint = '跟上或超過市場行情';
    return `
      <section class="card economy">
        <h3>物價與售價 <small>和年初相比</small></h3>
        <div class="econ-grid">
          <div><span>📈 物價</span><b>${pct(g.idx.cpi - 1)}</b></div>
          <div><span>⛽ 油價（每公升）</span><b>${(g.idx.oil * ECONOMY.gasPrice).toFixed(1)} 元</b></div>
          <div><span>⚡ 電價${summer ? '（夏月）' : ''}</span><b>${pct(g.idx.power * (summer ? ECONOMY.summerPower : 1) - 1)}</b></div>
          <div><span>👛 市場薪資</span><b>${pct(g.idx.wage - 1)}</b></div>
        </div>
        <div class="policy">
          <div class="policy-label">你的售價 <b>${pct(g.price - 1)}</b></div>
          <div class="hr-buttons">
            <button data-action="price" data-step="-0.03" ${locked || g.price <= 0.8 ? 'disabled' : ''}>－ 降價 3%</button>
            <button data-action="price" data-step="0.03" ${locked || g.price >= 1.6 ? 'disabled' : ''}>＋ 漲價 3%</button>
          </div>
          <div class="policy-desc">${priceHint}</div>
        </div>
        <div class="policy">
          <div class="policy-label">你的調薪幅度 <b>${pct(g.wageMult - 1)}</b></div>
          <div class="policy-desc">${wageHint}</div>
        </div>
      </section>`;
  }

  function renderNews(g) {
    if (!g.news.length) return '';
    return `
      <section class="card news">
        <h3>📰 第 ${g.month} 月新聞</h3>
        <ul>${g.news.map((n) => `<li>${n}</li>`).join('')}</ul>
      </section>`;
  }

  function renderPolicies(g) {
    const p = g.projection();
    const locked = g.over;
    return `
      <section class="card policies">
        <h3>經營方針 <small>每月結算時套用</small></h3>
        ${Object.entries(POLICIES)
          .map(
            ([key, def]) => `
          <div class="policy">
            <div class="policy-label">${def.label}</div>
            <div class="segmented">
              ${Object.entries(def.options)
                .map(
                  ([val, opt]) => `
                <button data-action="policy" data-key="${key}" data-value="${val}" class="${g.policy[key] === val ? 'active' : ''}" ${locked ? 'disabled' : ''}>${opt.label}</button>`
                )
                .join('')}
            </div>
            <div class="policy-desc">${def.options[g.policy[key]].desc}</div>
          </div>`
          )
          .join('')}
        <div class="policy">
          <div class="policy-label">人事</div>
          <div class="hr-buttons">
            <button data-action="hire" ${locked || g.staff >= g.industry.maxStaff ? 'disabled' : ''}>＋ 招募一人<small>${money(g.hireCost)}</small></button>
            <button data-action="layoff" ${locked || g.staff <= 1 ? 'disabled' : ''}>－ 依法資遣一人<small>${money(g.severance)}</small></button>
          </div>
          <div class="hr-buttons">
            <button data-action="raise" ${locked || g.raisedThisMonth ? 'disabled' : ''}>💵 全員調薪 3%<small>${g.raisedThisMonth ? '這個月已經調過了' : `每月薪資 +${money(g.staff * g.wage * 0.03)}`}</small></button>
          </div>
        </div>
        <h3>本月預估</h3>
        <table class="ledger compact">
          <tr><th>營收<small>${p.demand > p.capacity ? '人手不夠，做不完' : '產能足夠'}</small></th><td class="pos">${money(p.revenue)}</td></tr>
          <tr><th>薪資（每人 ${money(g.wage)}）</th><td class="neg">-${money(p.wageBill)}</td></tr>
          ${p.otCost ? `<tr><th>加班費</th><td class="neg">-${money(p.otCost)}</td></tr>` : ''}
          ${p.benefitCost ? `<tr><th>員工福利</th><td class="neg">-${money(p.benefitCost)}</td></tr>` : ''}
          ${costRows(g, p.costs)
            .map(([k, v]) => `<tr><th>${k}</th><td class="neg">${money(v)}</td></tr>`)
            .join('')}
          <tr class="total"><th>營業損益</th><td class="${p.profit < 0 ? 'neg' : 'pos'}">${signedMoney(p.profit)}</td></tr>
        </table>
      </section>`;
  }

  function renderHistory(g) {
    if (!g.history.length) return '';
    return `
      <section class="card history">
        <h3>經營紀錄</h3>
        <ol>
          ${g.history
            .slice()
            .reverse()
            .map(
              (r) => `
            <li><b>第 ${r.month} 月</b>　營業 <span class="${r.profit < 0 ? 'neg' : 'pos'}">${signedMoney(r.profit)}</span>・事件 <span class="${r.eventCash < 0 ? 'neg' : 'pos'}">${signedMoney(r.eventCash)}</span>${r.quits ? `・離職 ${r.quits} 人` : ''}${r.inspection ? '・🔍勞檢' : ''}</li>`
            )
            .join('')}
        </ol>
      </section>`;
  }

  function renderEnding(g) {
    const e = g.ending;
    const win = e.type === 'win';
    return `
      <div class="overlay">
        <div class="card ending ${win ? 'win' : 'lose'}">
          <div class="ending-icon">${win ? '🏆' : { jerk: '📰', bankrupt: '💸', empty: '🪑' }[e.type]}</div>
          <h2>${e.title}</h2>
          <p>${e.desc}</p>
          <div class="ending-stats">
            <div><span>撐了</span><b>${g.history.length} 個月</b></div>
            <div><span>現金</span><b>${money(g.cash)}</b></div>
            <div><span>士氣</span><b>${Math.round(g.morale)}</b></div>
            <div><span>慣老闆指數</span><b>${Math.round(g.jerk)}</b></div>
          </div>
          ${win ? `<p class="score">分數 <b>${e.score}</b></p>` : ''}
          <div class="ending-actions">
            <button class="primary" data-action="start" data-id="${g.industry.id}">再玩一次</button>
            <button data-action="menu">換個產業</button>
          </div>
        </div>
      </div>`;
  }

  function renderGame() {
    const g = ui.game;
    let main;
    if (ui.phase === 'result') main = renderResult(g);
    else if (ui.phase === 'report') main = renderReport(g);
    else if (g.currentEvent) main = renderEvent(g);
    else main = renderReady(g);

    app.innerHTML = `
      ${renderStats(g)}
      <div class="layout">
        <div class="main-col">
          ${ui.phase === 'event' ? renderNews(g) : ''}
          ${main}
        </div>
        <aside class="side-col">
          ${renderEconomy(g)}
          ${renderPolicies(g)}
          ${renderHistory(g)}
        </aside>
      </div>
      ${g.over && ui.phase === 'ending' ? renderEnding(g) : ''}`;
  }

  function render() {
    if (ui.phase === 'start') renderStart();
    else renderGame();
  }

  // ───── 操作 ─────
  function startGame(id) {
    ui.game = new Game(id);
    ui.eventsThisMonth = ui.game.queue.length;
    ui.phase = 'event';
    render();
    window.scrollTo({ top: 0 });
  }

  app.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const g = ui.game;
    switch (btn.dataset.action) {
      case 'start':
        startGame(btn.dataset.id);
        return;
      case 'menu':
        ui.phase = 'start';
        ui.game = null;
        break;
      case 'choose':
        ui.lastResult = g.choose(Number(btn.dataset.index));
        ui.phase = 'result';
        break;
      case 'continue':
        ui.phase = g.over ? 'ending' : 'event';
        break;
      case 'end-month':
        ui.lastReport = g.endMonth();
        ui.phase = 'report';
        break;
      case 'next-month':
        ui.eventsThisMonth = g.queue.length;
        ui.phase = g.over ? 'ending' : 'event';
        break;
      case 'policy':
        g.setPolicy(btn.dataset.key, btn.dataset.value);
        break;
      case 'hire':
        g.hire();
        break;
      case 'raise':
        g.raiseWages();
        break;
      case 'price':
        g.changePrice(Number(btn.dataset.step));
        break;
      case 'layoff':
        if (!confirm(`確定要資遣一位員工嗎？需支付資遣費 ${money(g.severance)}，其他人的士氣也會下降。`)) return;
        g.layoff();
        break;
    }
    render();
  });

  render();
})();
