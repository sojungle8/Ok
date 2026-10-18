// 畫面渲染與操作
(function () {
  const { INDUSTRIES, COST_LABELS, POLICIES } = window.BossData;
  const { Game, MAX_MONTH, ECONOMY } = window.BossEngine;
  const { DayScene, MODES, fmtClock } = window.BossWorld;
  const app = document.getElementById('app');

  const ui = {
    phase: 'start', // start | day | night | ending
    game: null,
    scene: null,
    settings: { industry: 'drinks', name: '王老闆', gender: 'm', mode: 'normal' },
    dialog: null, // { type: 'briefing' | 'event' | 'result', ... }
    lastReport: null,
    dayEndReason: null,
    ignoredToday: [],
    muted: false,
  };

  const isTouch = window.matchMedia('(hover: none)').matches;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
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

  function hungerLabel(h) {
    if (h >= 80) return '飽飽的';
    if (h >= 50) return '還可以';
    if (h >= 25) return '肚子在叫';
    return '餓到手軟（精力掉更快）';
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
    const st = ui.settings;
    app.innerHTML = `
      <section class="intro card">
        <p class="lead">你剛成為一間公司的老闆。</p>
        <p>每個月就是一個上班日。從早上 9 點到下午 6 點，你要在辦公室裡跑來跑去：員工頭上冒出 <b class="bang">!</b> 是有事找你，☎️ 電話響了要去接，🚪 門口有人要去應付。拖太久不處理，就算你<strong>無視</strong>。</p>
        <p>你要撐過 <strong>${MAX_MONTH} 個月</strong>，而且：</p>
        <ul class="rules">
          <li>😈 <strong>慣老闆指數</strong>不能到 100，不然你會上新聞</li>
          <li>💰 <strong>現金</strong>月底不能是負的，不然公司會倒閉</li>
          <li>👥 <strong>員工</strong>不能全部跑光</li>
          <li>⚡ 你自己的<strong>精力</strong>歸零會當場昏倒，剩下的事全部沒人處理</li>
        </ul>
        <p class="hint">太佛心會倒閉，太摳會變慣老闆。做選擇時你只看得到要花多少錢，員工心裡怎麼想，選了才知道。</p>
      </section>

      <section class="card setup">
        <div class="setup-row">
          <label class="setup-label" for="boss-name">你的名字</label>
          <input id="boss-name" maxlength="10" value="${esc(st.name)}" />
        </div>
        <div class="setup-row">
          <span class="setup-label">角色</span>
          <div class="segmented small">
            <button data-action="set" data-key="gender" data-value="m" class="${st.gender === 'm' ? 'active' : ''}">🧑‍💼 男老闆</button>
            <button data-action="set" data-key="gender" data-value="f" class="${st.gender === 'f' ? 'active' : ''}">👩‍💼 女老闆</button>
          </div>
        </div>
        <div class="setup-row">
          <span class="setup-label">難度</span>
          <div class="segmented small">
            <button data-action="set" data-key="mode" data-value="normal" class="${st.mode === 'normal' ? 'active' : ''}">普通模式<small>每天約 ${MODES.normal.events} 件事</small></button>
            <button data-action="set" data-key="mode" data-value="hell" class="${st.mode === 'hell' ? 'active' : ''}">🔥 爆肝模式<small>每天約 ${MODES.hell.events} 件事、精力掉得快</small></button>
          </div>
        </div>
      </section>

      <h2 class="section-title">選擇你的產業</h2>
      <div class="industries">
        ${INDUSTRIES.map(
          (ind) => `
          <button class="industry card ${st.industry === ind.id ? 'selected' : ''}" data-action="set" data-key="industry" data-value="${ind.id}">
            <span class="industry-icon">${ind.icon}</span>
            <span class="industry-name">${ind.name}</span>
            <span class="industry-desc">${ind.desc}</span>
            <span class="industry-meta">起始資金 ${money(ind.cash)}・員工 ${ind.staff} 人</span>
          </button>`
        ).join('')}
      </div>
      <div class="start-bar">
        <button class="primary big" data-action="start">開始經營 →</button>
      </div>`;
  }

  // ───── 上班（即時場景）─────
  function bar(id, label, value, cls, hint) {
    return `
      <div class="stat bar-stat">
        <span class="stat-label">${label} <b id="${id}-val">${Math.round(value)}</b></span>
        <div class="bar"><div id="${id}-bar" class="bar-fill ${cls}" style="width:${value}%"></div></div>
        <span class="stat-hint" id="${id}-hint">${hint}</span>
      </div>`;
  }

  function renderDay() {
    const g = ui.game;
    app.innerHTML = `
      <section class="hud card">
        <div class="stat">
          <span class="stat-label">${g.industry.icon} 第 ${g.month} / ${MAX_MONTH} 月</span>
          <span class="stat-value clock" id="hud-clock">09:00</span>
          <span class="stat-hint" id="hud-left">距離下班 9.0 小時</span>
        </div>
        <div class="stat">
          <span class="stat-label">💰 現金</span>
          <span class="stat-value" id="hud-cash">${money(g.cash)}</span>
          <span class="stat-hint">👥 員工 <b id="hud-staff">${g.staff}</b> 人</span>
        </div>
        ${bar('hud-morale', '😊 士氣', g.morale, 'morale', moraleHint(g.morale))}
        ${bar('hud-jerk', '😈 慣老闆', g.jerk, 'jerk', jerkHint(g.jerk))}
        ${bar('hud-energy', '⚡ 精力', 100, 'energy', '精神很好')}
        ${bar('hud-hunger', '🍱 肚子', 80, 'hunger', hungerLabel(80))}
        <div class="hud-buttons">
          <button data-action="pause" id="btn-pause" title="暫停（P）">⏸</button>
          <button data-action="mute" title="電話鈴聲">${ui.muted ? '🔇' : '🔊'}</button>
        </div>
      </section>
      <div class="stage">
        <canvas id="world"></canvas>
        <div class="toasts" id="toasts"></div>
        <div class="hint-bar" id="hint-bar"></div>
        <button class="touch-e" data-action="interact">E</button>
      </div>
      <div class="rotate-hint">📱 把手機橫放，地圖會比較大</div>
      <div class="controls-help">
        <span>移動：WASD／方向鍵（Shift 跑步）或點地圖</span>
        <span>互動：E／空白鍵</span>
        <span>暫停：P</span>
      </div>
      <div id="dialog"></div>`;

    ui.scene = new DayScene(g, {
      canvas: document.getElementById('world'),
      mode: ui.settings.mode,
      gender: ui.settings.gender,
      callbacks: {
        hud: updateHud,
        toast,
        muted: () => ui.muted,
        openEvent: (p) => {
          ui.dialog = { type: 'event', p };
          renderDialog();
        },
        ignored: (result, p, silent) => {
          ui.ignoredToday.push(result);
          updateStats();
          if (!silent) toast(`😤 ${result.event.title}：你沒處理`, 'bad');
        },
        dayEnd: onDayEnd,
      },
    });
    ui.dialog = { type: 'briefing' };
    ui.scene.dialogOpen = true;
    renderDialog();
  }

  function updateHud(s) {
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el && el.textContent !== String(v)) el.textContent = v;
    };
    set('hud-clock', s.clock);
    set('hud-left', s.hoursLeft > 0 ? `距離下班 ${s.hoursLeft.toFixed(1)} 小時` : '下班囉！');
    setBar('hud-energy', s.energy, s.energy < 20 ? '快撐不住了，走路變慢' : s.energy < 50 ? '有點累' : '精神很好');
    setBar('hud-hunger', s.hunger, hungerLabel(s.hunger));
    const hint = document.getElementById('hint-bar');
    if (hint) {
      const text = s.paused ? '⏸ 暫停中（按 P 繼續）' : s.busy ? s.busy : s.hint ? `${isTouch ? '點 E' : '按 E'}：${s.hint}` : s.pending ? `還有 ${s.pending} 件事等你處理` : '';
      if (hint.textContent !== text) hint.textContent = text;
      hint.classList.toggle('show', !!text);
    }
    const pb = document.getElementById('btn-pause');
    if (pb) pb.textContent = s.paused ? '▶️' : '⏸';
  }

  function setBar(id, v, hint) {
    const val = document.getElementById(`${id}-val`);
    const b = document.getElementById(`${id}-bar`);
    const h = document.getElementById(`${id}-hint`);
    if (val) val.textContent = Math.round(v);
    if (b) b.style.width = `${v}%`;
    if (h && hint) h.textContent = hint;
  }

  function updateStats() {
    const g = ui.game;
    const cash = document.getElementById('hud-cash');
    if (cash) {
      cash.textContent = money(g.cash);
      cash.classList.toggle('neg', g.cash < 0);
    }
    const staff = document.getElementById('hud-staff');
    if (staff) staff.textContent = g.staff;
    setBar('hud-morale', g.morale, moraleHint(g.morale));
    setBar('hud-jerk', g.jerk, jerkHint(g.jerk));
  }

  function toast(text, kind = '') {
    const box = document.getElementById('toasts');
    if (!box) return;
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = text;
    box.appendChild(el);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => el.classList.add('fade'), 2600);
    setTimeout(() => el.remove(), 3200);
  }

  // ───── 對話框 ─────
  function renderDialog() {
    const box = document.getElementById('dialog');
    if (!box) return;
    const d = ui.dialog;
    if (!d) {
      box.innerHTML = '';
      return;
    }
    const g = ui.game;
    let inner = '';
    if (d.type === 'briefing') {
      const first = g.month === 1;
      inner = `
        <div class="card dialog briefing">
          <div class="event-kicker">📋 交接單・第 ${g.month} 月・早上 09:00</div>
          <h2>${first ? `${esc(ui.settings.name)}，歡迎上任！` : `早安，${esc(ui.settings.name)}`}</h2>
          ${first ? `<p>會計留了張紙條：「老闆，今天店裡大概會有 ${ui.scene.mode.events} 件事找你。員工頭上有 <b class="bang">!</b> 就是有事，電話響了記得接。不想處理也可以，但大家都會記得。」</p>` : `<p>今天大概會有 ${ui.scene.mode.events} 件事找你。</p>`}
          <ul class="news-list">${g.news.map((n) => `<li>${n}</li>`).join('')}</ul>
          ${
            first
              ? `<div class="tip">🎮 <strong>操作：</strong>WASD／方向鍵移動、Shift 跑步、E 互動、P 暫停；手機可以直接點地圖。
                 累了去 ☕ 咖啡機，餓了去 🍱 冰箱，🛋️ 沙發可以睡午覺（但時間照跑）。</div>`
              : ''
          }
          <button class="primary" data-action="begin-day">開始上班（Enter）</button>
        </div>`;
    } else if (d.type === 'event') {
      const ev = d.p.ev;
      inner = `
        <div class="card dialog event">
          <div class="event-head">
            <span class="event-icon">${ev.icon}</span>
            <div>
              <div class="event-kicker">${ui.scene.actorLabel(d.p)}・${fmtClock(ui.scene.clock)}</div>
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
                    <span class="choice-label"><kbd>${i + 1}</kbd>${c.label}</span>
                    ${quote}
                    <span class="choice-meta">${cost}${note}</span>
                  </button>`;
              })
              .join('')}
          </div>
          <button class="ghost" data-action="later">等一下再說（Esc）</button>
        </div>`;
    } else if (d.type === 'result') {
      const r = d.result;
      inner = `
        <div class="card dialog event result">
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
          <button class="primary" data-action="close-result">${g.over ? '看結局' : '回去工作（Enter）'}</button>
        </div>`;
    }
    box.innerHTML = `<div class="dialog-backdrop">${inner}</div>`;
  }

  function closeDialog() {
    ui.dialog = null;
    renderDialog();
    if (ui.scene) ui.scene.closeDialog();
  }

  function onDayEnd(reason) {
    const g = ui.game;
    ui.dayEndReason = { reason, clock: fmtClock(ui.scene.clock) };
    ui.dialog = null;
    const scene = ui.scene;
    setTimeout(() => {
      scene.destroy();
      if (!g.over) ui.lastReport = g.endMonth();
      ui.phase = g.over ? 'ending' : 'night';
      render();
      window.scrollTo({ top: 0 });
    }, reason === 'over' ? 300 : 900);
    if (reason === 'collapse') toast('😵 你眼前一黑，倒在地上……', 'bad');
    else if (reason === 'done') toast('🔔 下班時間到！');
  }

  // ───── 下班後（月報表、方針）─────
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
    const end = ui.dayEndReason || {};
    const endLine =
      end.reason === 'collapse'
        ? `<div class="alert bad">😵 你在 ${end.clock} 昏倒了，被員工抬到沙發上。剩下的事都沒人處理。</div>`
        : '';
    const ignored = ui.ignoredToday.length
      ? `<div class="ignored"><p class="sub">今天被你無視的事</p><ul>${ui.ignoredToday
          .map((x) => `<li>${x.event.icon} <b>${x.event.title}</b>：${x.choice.result}</li>`)
          .join('')}</ul></div>`
      : '';
    return `
      <article class="card event report">
        <div class="event-head">
          <span class="event-icon">📊</span>
          <div>
            <div class="event-kicker">下班後・月底結算</div>
            <h2>第 ${r.month} 月報表</h2>
          </div>
        </div>
        ${endLine}
        <table class="ledger">
          ${rows
            .map(
              ([k, v, hint]) => `
            <tr><th>${k}${hint ? `<small>${hint}</small>` : ''}</th><td class="${v < 0 ? 'neg' : 'pos'}">${signedMoney(v)}</td></tr>`
            )
            .join('')}
          <tr class="total"><th>營業損益</th><td class="${r.profit < 0 ? 'neg' : 'pos'}">${signedMoney(r.profit)}</td></tr>
          <tr><th>今天事件與人事收支<small>已在當下入帳</small></th><td class="${r.eventCash < 0 ? 'neg' : 'pos'}">${signedMoney(r.eventCash)}</td></tr>
        </table>
        ${r.notes.map((n) => `<div class="alert">${n}</div>`).join('')}
        ${inspection}
        ${ignored}
        <p class="sub">月底變化</p>
        ${deltaChips(r.delta, { showCash: false })}
      </article>`;
  }

  function renderNews(g) {
    return `
      <section class="card news">
        <h3>📰 明天（第 ${g.month} 月）的新聞</h3>
        <ul class="news-list">${g.news.map((n) => `<li>${n}</li>`).join('')}</ul>
        <p class="sub">下一個上班日開始前，可以在右邊調整售價、薪水和經營方針。</p>
        <button class="primary" data-action="next-day">開始第 ${g.month} 月的上班日 →</button>
      </section>`;
  }

  function renderEconomy(g) {
    const summer = ECONOMY.summerMonths.includes(g.month);
    const rel = g.price / g.idx.cpi;
    let priceHint;
    if (rel > ECONOMY.overpriceAt) priceHint = '<span class="warn">比同業貴太多，客人在流失</span>';
    else if (rel < 0.98) priceHint = '比同業便宜，客人多但利潤薄';
    else priceHint = '跟物價差不多，客人可以接受';
    let wageHint;
    if (g.realWage < 0.97) wageHint = '<span class="warn">薪水追不上物價，員工在抱怨</span>';
    else if (g.realWage < 1) wageHint = '稍微落後市場行情';
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
            <button data-action="price" data-step="-0.03" ${g.price <= 0.8 ? 'disabled' : ''}>－ 降價 3%</button>
            <button data-action="price" data-step="0.03" ${g.price >= 1.6 ? 'disabled' : ''}>＋ 漲價 3%</button>
          </div>
          <div class="policy-desc">${priceHint}</div>
        </div>
        <div class="policy">
          <div class="policy-label">你的調薪幅度 <b>${pct(g.wageMult - 1)}</b></div>
          <div class="policy-desc">${wageHint}</div>
        </div>
      </section>`;
  }

  function renderPolicies(g) {
    const p = g.projection();
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
                <button data-action="policy" data-key="${key}" data-value="${val}" class="${g.policy[key] === val ? 'active' : ''}">${opt.label}</button>`
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
            <button data-action="hire" ${g.staff >= g.industry.maxStaff ? 'disabled' : ''}>＋ 招募一人<small>${money(g.hireCost)}</small></button>
            <button data-action="layoff" class="${ui.confirmLayoff ? 'danger' : ''}" ${g.staff <= 1 ? 'disabled' : ''}>${ui.confirmLayoff ? '再按一次確認資遣' : '－ 依法資遣一人'}<small>${ui.confirmLayoff ? `資遣費 ${money(g.severance)}，士氣會下降` : money(g.severance)}</small></button>
          </div>
          <div class="hr-buttons">
            <button data-action="raise" ${g.raisedThisMonth ? 'disabled' : ''}>💵 全員調薪 3%<small>${g.raisedThisMonth ? '這個月已經調過了' : `每月薪資 +${money(g.staff * g.wage * 0.03)}`}</small></button>
          </div>
        </div>
        <h3>下個月預估</h3>
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
        ${g.cash + p.profit < 0 ? '<div class="alert bad">⚠️ 照這樣下去，下個月底現金會變成負的！</div>' : ''}
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

  function renderStatsCard(g) {
    return `
      <section class="stats card">
        <div class="stat">
          <span class="stat-label">${g.industry.icon} ${g.industry.name}</span>
          <span class="stat-value">${esc(ui.settings.name)}</span>
        </div>
        <div class="stat">
          <span class="stat-label">💰 現金</span>
          <span class="stat-value ${g.cash < 0 ? 'neg' : ''}">${money(g.cash)}</span>
        </div>
        <div class="stat">
          <span class="stat-label">👥 員工</span>
          <span class="stat-value">${g.staff} 人</span>
        </div>
        ${bar('st-morale', '😊 士氣', g.morale, 'morale', moraleHint(g.morale))}
        ${bar('st-jerk', '😈 慣老闆指數', g.jerk, 'jerk', jerkHint(g.jerk))}
      </section>`;
  }

  function renderNight() {
    const g = ui.game;
    app.innerHTML = `
      ${renderStatsCard(g)}
      <div class="layout">
        <div class="main-col">
          ${renderReport(g)}
          ${renderNews(g)}
        </div>
        <aside class="side-col">
          ${renderEconomy(g)}
          ${renderPolicies(g)}
          ${renderHistory(g)}
        </aside>
      </div>`;
  }

  // ───── 結局 ─────
  function resultText(g) {
    const e = g.ending;
    return [
      `😇 不當慣老闆模擬器`,
      `${g.industry.icon} ${g.industry.name}・${MODES[ui.settings.mode].label}`,
      `${ui.settings.name}：「${e.title}」`,
      `撐了 ${g.history.length} 個月｜現金 ${money(g.cash)}｜士氣 ${Math.round(g.morale)}｜慣老闆指數 ${Math.round(g.jerk)}`,
      e.type === 'win' ? `分數 ${e.score}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  function renderEnding() {
    const g = ui.game;
    const e = g.ending;
    const win = e.type === 'win';
    app.innerHTML = `
      ${renderStatsCard(g)}
      <div class="overlay">
        <div class="card ending ${win ? 'win' : 'lose'}">
          <div class="ending-icon">${win ? '🏆' : { jerk: '📰', bankrupt: '💸', empty: '🪑' }[e.type]}</div>
          <div class="event-kicker">${esc(ui.settings.name)}的結局</div>
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
            <button class="primary" data-action="restart">再玩一次</button>
            <button data-action="copy">📋 複製結果</button>
            <button data-action="menu">回主選單</button>
          </div>
        </div>
      </div>`;
  }

  function render() {
    document.body.classList.toggle('in-day', ui.phase === 'day');
    if (ui.phase === 'start') renderStart();
    else if (ui.phase === 'day') renderDay();
    else if (ui.phase === 'night') renderNight();
    else renderEnding();
  }

  // ───── 操作 ─────
  function startGame() {
    const nameInput = document.getElementById('boss-name');
    if (nameInput) ui.settings.name = nameInput.value.trim() || '王老闆';
    ui.game = new Game(ui.settings.industry, Math.random, { eventsPerMonth: MODES[ui.settings.mode].events });
    startDay();
  }

  function startDay() {
    ui.ignoredToday = [];
    ui.dayEndReason = null;
    ui.phase = 'day';
    render();
    window.scrollTo({ top: 0 });
  }

  function choose(index) {
    const d = ui.dialog;
    const result = ui.game.resolve(d.p.ev, index);
    if (!result) return;
    ui.scene.removeActive(d.p);
    ui.dialog = { type: 'result', result };
    updateStats();
    renderDialog();
  }

  function closeResult() {
    closeDialog();
    if (ui.game.over) ui.scene.finish('over');
  }

  app.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const g = ui.game;
    const a = btn.dataset.action;
    if (a !== 'layoff') ui.confirmLayoff = false;
    switch (a) {
      case 'set': {
        const nameInput = document.getElementById('boss-name');
        if (nameInput) ui.settings.name = nameInput.value;
        ui.settings[btn.dataset.key] = btn.dataset.value;
        renderStart();
        return;
      }
      case 'start':
        startGame();
        return;
      case 'begin-day':
        closeDialog();
        return;
      case 'choose':
        choose(Number(btn.dataset.index));
        return;
      case 'later':
        closeDialog();
        return;
      case 'close-result':
        closeResult();
        return;
      case 'pause':
        if (ui.scene && !ui.dialog) ui.scene.togglePause();
        return;
      case 'mute':
        ui.muted = !ui.muted;
        btn.textContent = ui.muted ? '🔇' : '🔊';
        return;
      case 'interact':
        if (ui.scene) ui.scene.interact();
        return;
      case 'next-day':
        startDay();
        return;
      case 'restart':
        ui.game = new Game(ui.settings.industry, Math.random, { eventsPerMonth: MODES[ui.settings.mode].events });
        startDay();
        return;
      case 'menu':
        ui.phase = 'start';
        ui.game = null;
        break;
      case 'copy': {
        const text = resultText(g);
        const fallback = () => {
          btn.textContent = '請手動複製下面的文字';
          let box = document.querySelector('.copy-box');
          if (!box) {
            box = document.createElement('textarea');
            box.className = 'copy-box';
            box.id = 'copy-box';
            box.readOnly = true;
            box.rows = 5;
            btn.closest('.ending').appendChild(box);
          }
          box.value = text;
          box.select();
        };
        try {
          navigator.clipboard.writeText(text).then(() => (btn.textContent = '✅ 已複製'), fallback);
        } catch (err) {
          fallback();
        }
        return;
      }
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
        // 按兩次才確認（嵌入的網頁不能跳出 confirm 視窗）
        if (ui.confirmLayoff) g.layoff();
        ui.confirmLayoff = !ui.confirmLayoff;
        render();
        return;
    }
    render();
  });

  // 對話框的快捷鍵
  window.addEventListener('keydown', (e) => {
    if (ui.phase !== 'day' || !ui.dialog) return;
    const d = ui.dialog;
    let handled = true;
    if (d.type === 'briefing' && e.key === 'Enter') closeDialog();
    else if (d.type === 'event' && Number(e.key) >= 1 && Number(e.key) <= d.p.ev.choices.length) choose(Number(e.key) - 1);
    else if (d.type === 'event' && e.key === 'Escape') closeDialog();
    else if (d.type === 'result' && (e.key === 'Enter' || e.key === ' ')) closeResult();
    else handled = false;
    // 同一個按鍵不要再傳給場景（不然 Enter 關掉對話框後會馬上又觸發互動）
    if (handled) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  });

  // 自動化測試用：網址加上 #debug 才會開放
  if (location.hash === '#debug') window.BossDebug = { ui };

  render();
})();
