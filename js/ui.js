// 介面：開始畫面、上方資訊列、底部工具列與抽屜、檢視面板、事件對話、週報、結局
(function () {
  const { Sim, CATALOG, catalogById, ACHIEVEMENTS, MIN_WAGE, WEEKDAYS } = window.BossSim;
  const { INDUSTRIES, CAT_LABELS, LOTS, TRAITS, LEVELS, DISTRICTS } = window.BossIndustries;
  const { portraitSVG, bossLook, VISITORS } = window.BossLooks;
  const app = document.getElementById('app');
  const SAVE_KEY = 'boss-sim-save-v1';
  const isTouch = window.matchMedia('(hover: none)').matches;

  const ui = {
    phase: 'start',
    settings: { industry: 'breakfast', gender: 'm', mode: 'normal', shopName: '' },
    sim: null,
    view: null,
    speed: 1,
    tab: null,
    buildCat: 'station',
    build: null, // { type, rot } 或 { move: obj, rot }
    hover: null,
    inspect: null, // { kind, ref }
    dialog: null,
    paused: false, // 對話框或週報打開時暫停
    raf: 0,
    confirmFire: null,
  };

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const money = (n) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString('zh-TW')}`;
  const signedMoney = (n) => (n > 0 ? `+${money(n)}` : money(n));
  const signed = (n) => (n > 0 ? `+${n}` : `${n}`);
  const stars = (r) => '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));
  const hhmm = (m) => `${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(((m % 60) + 60) % 60).padStart(2, '0')}`;
  const loadSave = () => {
    try {
      return localStorage.getItem(SAVE_KEY);
    } catch (e) {
      return null;
    }
  };

  // ───── 開始畫面 ─────
  function renderStart() {
    document.body.className = '';
    const st = ui.settings;
    const ind = INDUSTRIES.find((i) => i.id === st.industry);
    const save = loadSave();
    let saveInfo = null;
    if (save) {
      try {
        const d = JSON.parse(save);
        const si = INDUSTRIES.find((i) => i.id === d.ind);
        saveInfo = `${si ? si.icon : ''} ${esc(d.shopName)}・第 ${Math.floor((d.day - 1) / 28) + 1} 個月`;
      } catch (e) {
        saveInfo = null;
      }
    }
    const look = (i) => window.BossLooks.randomLook(mulberry(i * 97 + ind.id.length), i % 2 ? 'f' : 'm', { ...(window.BossLooks.UNIFORM[ind.id] || {}), shirt: (window.BossLooks.UNIFORM[ind.id] || { shirts: ['#4a6fa5'] }).shirts[0] });
    app.innerHTML = `
      <section class="start">
        <div class="start-hero">
          <div class="start-cast">
            ${portraitSVG(look(1), 'happy')}
            <div class="start-boss">${portraitSVG(bossLook(st.gender), 'smug')}</div>
            ${portraitSVG(look(2), 'worried')}
          </div>
          <h1>不當慣老闆模擬器</h1>
          <p class="start-tag">開一間台灣街頭的小店：自己擺設、自己排班、自己定價。<br>讓客人吃飽、員工開心，還要記得付房租。</p>
          ${saveInfo ? `<button class="primary" data-action="continue">繼續經營：${saveInfo}</button>` : ''}
        </div>

        <h2 class="section-title">選一個產業</h2>
        <div class="industries">
          ${INDUSTRIES.map(
            (i) => `
            <button class="industry card ${st.industry === i.id ? 'selected' : ''}" data-action="pick-ind" data-id="${i.id}">
              <span class="industry-icon">${i.icon}</span>
              <span class="industry-name">${i.name}</span>
              <span class="industry-desc">${i.desc}</span>
              <span class="industry-meta">營業 ${hhmm(i.open)}～${hhmm(i.close)}・時薪 $${i.hourlyWage}・資金 ${money(i.cash)}</span>
              <span class="industry-items">${i.products.map((p) => `${p.icon}${p.name} $${p.price}`).join('　')}</span>
            </button>`
          ).join('')}
        </div>

        <section class="card setup">
          <div class="setup-row">
            <label class="setup-label" for="shop-name">店名</label>
            <input id="shop-name" maxlength="8" placeholder="${esc(ind.shopName)}" value="${esc(st.shopName)}" />
          </div>
          <div class="setup-row">
            <span class="setup-label">老闆</span>
            <div class="segmented small">
              <button data-action="set" data-key="gender" data-value="m" class="pick-face ${st.gender === 'm' ? 'active' : ''}">${portraitSVG(bossLook('m'), 'smug')}男老闆</button>
              <button data-action="set" data-key="gender" data-value="f" class="pick-face ${st.gender === 'f' ? 'active' : ''}">${portraitSVG(bossLook('f'), 'smug')}女老闆</button>
            </div>
          </div>
          <div class="setup-row">
            <span class="setup-label">難度</span>
            <div class="segmented small">
              <button data-action="set" data-key="mode" data-value="normal" class="${st.mode === 'normal' ? 'active' : ''}">一般<small>客人比較有耐心</small></button>
              <button data-action="set" data-key="mode" data-value="hell" class="${st.mode === 'hell' ? 'active' : ''}">🔥 地獄<small>事件多、客人急、員工容易累</small></button>
            </div>
          </div>
          <button class="primary big" data-action="start">開店！</button>
        </section>
        <p class="start-foot">遊戲裡的法規說明只是簡化的科普，實際狀況請以勞動部公告為準。</p>
      </section>`;
  }

  function mulberry(a) {
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ───── 遊戲畫面 ─────
  function startGame(sim) {
    window.BossAudio.init();
    ui.sim = sim;
    ui.phase = 'game';
    ui.speed = 1;
    ui.tab = null;
    ui.build = null;
    ui.inspect = null;
    ui.dialog = null;
    document.body.className = 'in-game';
    app.innerHTML = `
      <div class="game-root">
        <header class="topbar" id="topbar"></header>
        <div class="viewport">
          <div id="view" class="view"></div>
          <div class="inbox" id="inbox"></div>
          <div class="toasts" id="toasts"></div>
          <div class="build-hint" id="build-hint" hidden></div>
          <aside class="inspector card" id="inspector" hidden></aside>
          <div class="cam-buttons">
            <button data-action="cam-rot" data-dir="-1" title="向左轉（Q）">⟲</button>
            <button data-action="cam-rot" data-dir="1" title="向右轉（E）">⟳</button>
            <button data-action="zoom" data-dir="1" title="放大">＋</button>
            <button data-action="zoom" data-dir="-1" title="縮小">－</button>
          </div>
        </div>
        <section class="drawer card" id="drawer" hidden></section>
        <nav class="toolbar" id="toolbar">
          ${[
            ['build', '🏗️', '建造'],
            ['staff', '👥', '員工'],
            ['manage', '⚙️', '經營'],
            ['ledger', '📊', '帳本'],
            ['reviews', '⭐', '評論'],
            ['goals', '🏙️', '成長'],
          ]
            .map(([id, ic, label]) => `<button data-action="tab" data-tab="${id}"><span>${ic}</span>${label}</button>`)
            .join('')}
        </nav>
        <div id="dialog"></div>
      </div>`;
    sim.cb = {
      sound: (n) => window.BossAudio.play(n),
      notify: (t, k) => toast(t, k),
      event: (ev, text) => {
        toast(text, 'event');
        renderInbox();
      },
      ignored: (r) => {
        toast(`😤 ${r.event.title}：你沒處理`, 'bad');
        renderInbox();
      },
      dayEnd: (r) => toast(`🌙 今天服務 ${r.served} 位客人，營收 ${money(r.revenue)}${r.angry ? `，${r.angry} 位等到生氣離開` : ''}${r.holiday ? '（國定假日薪水加倍）' : ''}`),
      festival: (f) => toast(f.news, 'event'),
      levelUp: () => {
        if (ui.tab === 'build' || ui.tab === 'goals') renderDrawer();
      },
      weekEnd: (r) => {
        save();
        ui.dialog = { type: 'week', report: r };
        renderDialog();
      },
    };
    ui.view = new window.BossShop3D(document.getElementById('view'), sim, {
      onClick: onViewClick,
      onHover: (t) => {
        ui.hover = t;
      },
      dragLocked: () => !!ui.build,
    });
    renderTopbar();
    renderInbox();
    ui.last = performance.now();
    cancelAnimationFrame(ui.raf);
    ui.raf = requestAnimationFrame(loop);
    if (sim.day === 1 && sim.minute < sim.hours.open) {
      ui.dialog = { type: 'welcome' };
      renderDialog();
    }
  }

  function loop(now) {
    const dt = Math.min(0.1, (now - ui.last) / 1000);
    ui.last = now;
    const sim = ui.sim;
    if (!sim) return;
    const blocked = !!ui.dialog;
    if (!blocked && ui.speed > 0 && !sim.over) {
      // 打烊、沒人在店裡時自動快轉
      const empty = !sim.isOpen && !sim.customers.length && !sim.staff.some((e) => e.state !== 'off') && !sim.activeEvents.length;
      const mult = empty ? 90 : ui.speed;
      ui.nightSkip = empty;
      sim.tick(dt * mult);
    }
    if (sim.over && ui.dialog?.type !== 'ending') {
      ui.dialog = { type: 'ending' };
      renderDialog();
    }
    if (sim.weather && sim.weather.id !== ui.lastWeather) {
      ui.lastWeather = sim.weather.id;
      window.BossAudio.setWeather(sim.weather.id);
    }
    // 建造預覽
    if (ui.build && ui.view.ghost) {
      const t = ui.hover;
      const type = ui.build.move ? ui.build.move.type : ui.build.type;
      const ok = t && (ui.build.move ? sim.canPlace(type, t.x, t.z, ui.build.rot, ui.build.move.id) : sim.canPlace(type, t.x, t.z, ui.build.rot));
      ui.view.updateGhost(t, ui.build.rot, ok);
    }
    ui.view.selected = ui.inspect && (ui.inspect.kind === 'staff' || ui.inspect.kind === 'customer') ? ui.inspect.ref : null;
    ui.view.render(now);
    ui.hudT = (ui.hudT || 0) + dt;
    if (ui.hudT > 0.25) {
      ui.hudT = 0;
      renderTopbar();
      if (ui.inspect) renderInspector();
      renderInbox();
    }
    ui.drawerT = (ui.drawerT || 0) + dt;
    if (ui.drawerT > 1 && (ui.tab === 'staff' || ui.tab === 'ledger')) {
      ui.drawerT = 0;
      refreshDrawerLive();
    }
    ui.raf = requestAnimationFrame(loop);
  }

  function renderTopbar() {
    const s = ui.sim;
    const el = document.getElementById('topbar');
    if (!el) return;
    const jerk = Math.round(s.jerk);
    const mor = Math.round(s.morale);
    el.innerHTML = `
      <div class="tb-shop"><span class="tb-icon">${s.ind.icon}</span><div><b>${esc(s.shopName)}</b><small>${s.dateLabel}</small></div></div>
      <div class="tb-weather" title="${s.weather.name}${s.festival ? `・${s.festival.name}` : ''}"><span>${s.weather.icon}</span><small>${s.weather.name}${s.festival ? `<br>${s.festival.icon} ${s.festival.name}` : ''}</small></div>
      <div class="tb-clock ${s.isOpen ? 'open' : 'closed'}"><b>${s.clockLabel}</b><small>${ui.nightSkip ? '⏩ 打烊中，快轉' : s.isOpen ? '營業中' : s.openToday ? '休息中' : '今天公休'}</small></div>
      <div class="tb-speed">
        ${[[0, '⏸'], [1, '▶'], [3, '▶▶'], [8, '▶▶▶']].map(([v, l]) => `<button data-action="speed" data-v="${v}" class="${ui.speed === v ? 'active' : ''}" title="${v ? `${v} 倍速` : '暫停'}（${v === 0 ? '空白鍵' : v === 1 ? '1' : v === 3 ? '2' : '3'}）">${l}</button>`).join('')}
      </div>
      <div class="tb-level" title="店家等級"><small>Lv.${s.level}</small><div class="bar"><div class="bar-fill skill" style="width:${Math.round(s.levelProgress * 100)}%"></div></div></div>
      <div class="tb-stat"><small>現金</small><b class="${s.cash < 0 ? 'neg' : ''}">${money(s.cash)}</b></div>
      <div class="tb-stat"><small>評價（${s.reviews.length}）</small><b class="stars">${s.rating.toFixed(1)} ★</b></div>
      <div class="tb-meter"><small>😊 員工心情 ${mor}</small><div class="bar"><div class="bar-fill morale" style="width:${mor}%"></div></div></div>
      <div class="tb-meter"><small>😈 慣老闆指數 ${jerk}</small><div class="bar"><div class="bar-fill jerk" style="width:${jerk}%"></div></div></div>
      <div class="tb-menu"><button data-action="music" title="背景音樂" class="${window.BossAudio.prefs.music ? '' : 'off'}">🎵</button><button data-action="sfx" title="音效" class="${window.BossAudio.prefs.sfx ? '' : 'off'}">${window.BossAudio.prefs.sfx ? '🔊' : '🔇'}</button><button data-action="save" title="存檔">💾</button><button data-action="quit" title="回主選單">🚪</button></div>`;
  }

  function toast(text, kind = '') {
    const box = document.getElementById('toasts');
    if (!box) return;
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = text;
    box.appendChild(el);
    while (box.children.length > (window.innerWidth < 640 ? 2 : 3)) box.firstChild.remove();
    setTimeout(() => el.classList.add('fade'), 3800);
    setTimeout(() => el.remove(), 4400);
  }

  // 只更新倒數文字，不換掉按鈕（不然很難點到）
  function renderInbox() {
    const s = ui.sim;
    const el = document.getElementById('inbox');
    if (!el) return;
    const ids = new Set();
    for (const ev of s.activeEvents) {
      ids.add(String(ev.id));
      let b = el.querySelector(`[data-id="${ev.id}"]`);
      if (!b) {
        b = document.createElement('button');
        b.className = 'inbox-item';
        b.dataset.action = 'open-event';
        b.dataset.id = ev.id;
        b.innerHTML = `<span>${ev.ev.icon}</span><div><b>${esc(ev.ev.title)}</b><small></small></div>`;
        el.appendChild(b);
      }
      const left = Math.max(0, Math.round(ev.deadline - s.minute));
      const who = ev.where === 'staff' ? (ev.staff ? ev.staff.name : '員工') : ev.where === 'phone' ? '電話' : '門口';
      const text = `${who}・還剩 ${left} 分鐘`;
      const small = b.querySelector('small');
      if (small.textContent !== text) small.textContent = text;
      b.classList.toggle('urgent', left < 20);
    }
    for (const b of [...el.children]) if (!ids.has(b.dataset.id)) b.remove();
  }

  // ───── 點擊 3D 場景 ─────
  function onViewClick(hit) {
    const s = ui.sim;
    if (!hit) return;
    if (ui.build) {
      const t = hit.kind === 'tile' ? hit : ui.hover;
      if (!t) return;
      // 觸控沒有游標：第一下先預覽，再點同一格才放
      if (isTouch && (!ui.touchPreview || ui.touchPreview.x !== t.x || ui.touchPreview.z !== t.z)) {
        ui.touchPreview = { x: t.x, z: t.z };
        ui.hover = ui.touchPreview;
        return;
      }
      ui.touchPreview = null;
      if (ui.build.move) {
        if (s.moveObject(ui.build.move, t.x, t.z, ui.build.rot)) {
          toast('📦 搬好了');
          endBuild();
        } else toast('這裡放不下', 'bad');
        return;
      }
      const def = catalogById[ui.build.type];
      if (s.cash < def.price) return toast('錢不夠', 'bad');
      const o = s.place(ui.build.type, t.x, t.z, ui.build.rot);
      if (o) {
        toast(`✅ 買了${def.name}（${money(def.price)}）`);
        window.BossAudio.play('place');
      }
      else toast('這裡放不下：要放在店裡、不能擋住門口，設備的服務位置也要留空', 'bad');
      if (ui.tab === 'build' && !smallScreen()) renderDrawer();
      return;
    }
    if (hit.kind === 'staff') return inspect('staff', hit.staff);
    if (hit.kind === 'customer') return inspect('customer', hit.customer);
    if (hit.kind === 'object') return inspect('object', hit.obj);
    closeInspector();
  }

  // 小螢幕擺東西時先把抽屜收起來，才看得到地板
  const smallScreen = () => window.innerHeight < 600 || window.innerWidth < 700;

  function startBuild(type) {
    ui.build = { type, rot: 0 };
    ui.touchPreview = null;
    ui.view.setGhost(type, 0);
    closeInspector();
    showBuildHint();
    if (smallScreen()) document.getElementById('drawer').hidden = true;
  }

  function startMove(o) {
    ui.build = { move: o, rot: o.rot };
    ui.view.setGhost(o.type, o.rot);
    closeInspector();
    showBuildHint();
  }

  function endBuild() {
    const wasBuilding = !!ui.build;
    ui.build = null;
    ui.touchPreview = null;
    ui.view.setGhost(null);
    const h = document.getElementById('build-hint');
    if (h) h.hidden = true;
    if (wasBuilding && ui.tab && smallScreen()) renderDrawer();
  }

  function showBuildHint() {
    const h = document.getElementById('build-hint');
    const def = catalogById[ui.build.move ? ui.build.move.type : ui.build.type];
    h.hidden = false;
    h.innerHTML = `<b>${def.icon} ${ui.build.move ? '搬動' : '擺放'}${def.name}</b><span>${isTouch ? '點一下預覽，再點同一格放下' : '點地板放置・R 旋轉・Esc 取消'}</span><button data-action="rot-ghost">↻ 旋轉</button><button data-action="end-build">完成</button>`;
  }

  // ───── 檢視面板 ─────
  function inspect(kind, ref) {
    ui.inspect = { kind, ref };
    ui.confirmFire = null;
    renderInspector();
  }

  function closeInspector() {
    ui.inspect = null;
    const el = document.getElementById('inspector');
    if (el) el.hidden = true;
  }

  function bar(label, v, cls) {
    return `<div class="ibar"><span>${label}</span><div class="bar"><div class="bar-fill ${cls}" style="width:${Math.max(0, Math.min(100, v))}%"></div></div><b>${Math.round(v)}</b></div>`;
  }

  function moodOf(e) {
    if (e.energy < 25) return 'sad';
    if (e.mood >= 70) return 'happy';
    if (e.mood >= 42) return 'neutral';
    if (e.mood >= 25) return 'worried';
    return 'sad';
  }

  function relationsHtml(e) {
    const s = ui.sim;
    const list = s.staff
      .filter((o) => o !== e)
      .map((o) => ({ o, v: Math.round(s.relOf(e, o)) }))
      .filter((x) => Math.abs(x.v) >= 15)
      .sort((a, b) => b.v - a.v);
    if (!list.length) return '';
    return `<div class="rel-list"><small>人際關係</small>${list
      .map(({ o, v }) => `<div class="rel ${v > 0 ? 'pos' : 'neg'}"><span class="rel-face">${portraitSVG(o.look, v > 0 ? 'happy' : 'angry')}</span><b>${esc(o.name)}</b><em>${s.relLabel(v)}</em></div>`)
      .join('')}</div>`;
  }

  function renderInspector() {
    const s = ui.sim;
    const el = document.getElementById('inspector');
    if (!el || !ui.inspect) return;
    const { kind, ref } = ui.inspect;
    let html = '';
    if (kind === 'staff') {
      const e = ref;
      if (!s.staff.includes(e)) return closeInspector();
      const sh = s.shiftOf(e);
      const stateLabel = { off: '下班', arriving: '上班路上', working: e.task && e.task.obj ? `在${e.task.obj.def.name}` : '工作中', break: '休息中', leaving: '下班了' }[e.state];
      html = `
        <div class="insp-head">
          <div class="insp-face">${portraitSVG(e.look, moodOf(e))}</div>
          <div>
            <h3>${esc(e.name)}</h3>
            <div class="chips">${e.traits.map((t) => `<span class="chip" title="${TRAITS[t].desc}">${TRAITS[t].name}</span>`).join('')}</div>
            <small>${stateLabel}・${sh ? `今天 ${hhmm(sh.start)}～${hhmm(sh.end)}` : '今天休假'}</small>
          </div>
          <button class="x" data-action="close-insp" aria-label="關閉">✕</button>
        </div>
        ${e.thought && e.thought.until > s.minute ? `<p class="insp-thought">💭 ${esc(e.thought.text)}</p>` : ''}
        ${bar('心情', e.mood, 'morale')}${bar('精力', e.energy, 'energy')}${bar('飽足', e.hunger, 'hunger')}${bar('技能', e.skill, 'skill')}
        <p class="insp-meta">時薪 <b>${money(e.wage)}</b>（行情 ${money(s.marketWage)}）・今天服務 ${e.served} 人</p>
        ${relationsHtml(e)}
        <div class="insp-actions">
          <button data-action="raise">💵 加薪 $10</button>
          <button data-action="praise" ${e.praiseDay === s.day ? 'disabled' : ''}>👍 稱讚</button>
          <button data-action="scold" class="warn">😠 罵他</button>
          <button data-action="sendhome">🏠 先下班</button>
          <button data-action="fire" class="${ui.confirmFire === e ? 'danger' : ''}">${ui.confirmFire === e ? `確定資遣（${money(s.severanceOf(e))}）` : '📄 資遣'}</button>
        </div>`;
    } else if (kind === 'customer') {
      const c = ref;
      if (!s.customers.includes(c)) return closeInspector();
      const st = { arriving: '走進來', queue: '排隊中', toLane: '走向櫃台', atLane: c.servedBy ? '正在被服務' : '等店員', toSeat: '找位子', eating: '用餐中', leaving: '離開' }[c.state];
      html = `
        <div class="insp-head">
          <div class="insp-face">${portraitSVG(c.look, c.waited > c.patience * 0.6 ? 'angry' : c.state === 'eating' ? 'happy' : 'neutral')}</div>
          <div><h3>客人</h3><small>${st}</small><p>想要：${c.product.icon} ${c.product.name} × ${c.qty}</p></div>
          <button class="x" data-action="close-insp" aria-label="關閉">✕</button>
        </div>
        ${bar('耐心', 100 - (c.waited / c.patience) * 100, 'morale')}`;
    } else if (kind === 'object') {
      const o = ref;
      if (!s.objects.includes(o)) return closeInspector();
      const d = o.def;
      const info = [];
      if (d.serves) info.push(`可以做：${d.serves.map((id) => s.ind.products.find((p) => p.id === id)).filter(Boolean).map((p) => p.name).join('、')}`);
      if (d.lanes || o.lanes.length) info.push(`服務位 ${o.lanes.length} 個・排隊 ${o.queue.length} 人`);
      if (d.beauty) info.push(`美觀 +${d.beauty}`);
      if (d.kw) info.push(`用電 ${d.kw} kW`);
      if (d.rest) info.push('員工可以在這裡休息');
      html = `
        <div class="insp-head">
          <div class="insp-icon">${d.icon}</div>
          <div><h3>${d.name}</h3><small>${CAT_LABELS[d.cat]}・買價 ${money(d.price)}</small></div>
          <button class="x" data-action="close-insp" aria-label="關閉">✕</button>
        </div>
        <p class="insp-meta">${info.join('<br>')}</p>
        <div class="insp-actions">
          ${d.wall ? '' : '<button data-action="move-obj">📦 搬動</button>'}
          ${d.wall ? '' : '<button data-action="rot-obj">↻ 轉向</button>'}
          <button data-action="sell-obj" class="warn">💰 賣掉（${money(d.price * 0.5)}）</button>
        </div>`;
    }
    if (el.dataset.html !== html) {
      el.innerHTML = html;
      el.dataset.html = html;
    }
    el.hidden = false;
  }

  // ───── 底部抽屜 ─────
  function openTab(tab) {
    ui.tab = ui.tab === tab ? null : tab;
    if (ui.tab !== 'build') endBuild();
    renderDrawer();
    document.querySelectorAll('.toolbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === ui.tab));
  }

  function renderDrawer() {
    const el = document.getElementById('drawer');
    if (!el) return;
    if (!ui.tab) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    const fn = { build: drawerBuild, staff: drawerStaff, manage: drawerManage, ledger: drawerLedger, reviews: drawerReviews, goals: drawerGoals }[ui.tab];
    ui.drawerHtml = fn();
    el.innerHTML = `<button class="x drawer-x" data-action="tab" data-tab="${ui.tab}" aria-label="關閉">✕</button>${ui.drawerHtml}`;
  }

  function refreshDrawerLive() {
    // 員工和帳本的數字一直在變：內容有變才重畫，剛點過抽屜就先不動，免得按鈕在手指下被換掉
    const el = document.getElementById('drawer');
    if (!el || el.hidden || performance.now() - (ui.drawerTouched || 0) < 1500) return;
    const fn = { staff: drawerStaff, ledger: drawerLedger }[ui.tab];
    const html = fn();
    if (html === ui.drawerHtml) return;
    const scroll = el.querySelector('.drawer-body')?.scrollTop;
    renderDrawer();
    const body = el.querySelector('.drawer-body');
    if (body && scroll) body.scrollTop = scroll;
  }

  function drawerBuild() {
    const s = ui.sim;
    const cats = Object.keys(CAT_LABELS).filter((c) => CATALOG.some((d) => d.cat === c && (!d.industries || d.industries.includes(s.ind.id))));
    const items = CATALOG.filter((d) => d.cat === ui.buildCat && (!d.industries || d.industries.includes(s.ind.id)));
    const lotNext = LOTS[s.lotIdx + 1];
    return `
      <div class="drawer-tabs">
        ${cats.map((c) => `<button data-action="build-cat" data-cat="${c}" class="${ui.buildCat === c ? 'active' : ''}">${CAT_LABELS[c]}</button>`).join('')}
        <button data-action="build-cat" data-cat="lot" class="${ui.buildCat === 'lot' ? 'active' : ''}">店面</button>
      </div>
      <div class="drawer-body">
        ${
          ui.buildCat === 'lot'
            ? `<div class="lot-card card">
                <p>目前：<b>${s.lot.name}</b>（${s.W} × ${s.H} 格），月租約 ${money(s.ind.rent * s.lot.rentMult)}</p>
                ${
                  lotNext
                    ? `<p>擴建成 <b>${lotNext.name}</b>（${lotNext.w} × ${lotNext.h} 格）：裝修費 ${money(lotNext.cost)}，月租變成約 ${money(s.ind.rent * lotNext.rentMult)}。店面越大，路過的人越容易被吸引進來。</p>
                       ${lotNext.lv && s.level < lotNext.lv ? `<p class="muted">🔒 店家 Lv.${lotNext.lv} 才能擴建</p>` : ''}
                       <button class="primary" data-action="upgrade-lot" ${s.cash < lotNext.cost || (lotNext.lv && s.level < lotNext.lv) ? 'disabled' : ''}>擴建（${money(lotNext.cost)}）</button>`
                    : '<p>已經是最大的店面了。</p>'
                }
              </div>`
            : `<div class="catalog">${items
                .map((d) => {
                  const tags = [];
                  if (d.serves) tags.push(`做 ${d.serves.map((id) => s.ind.products.find((p) => p.id === id)?.name).filter(Boolean).join('、')}`);
                  if (d.staff) tags.push(`${d.staff.length} 個服務位`);
                  if (d.seats) tags.push(`${d.seats.length} 個座位`);
                  if (d.waits) tags.push(`${d.waits.length} 人等候`);
                  if (d.rest) tags.push('員工休息');
                  if (d.beauty) tags.push(`美觀 +${d.beauty}`);
                  if (d.draw) tags.push('吸引路人');
                  if (d.cool) tags.push('夏天必備');
                  if (d.kw) tags.push(`${d.kw} kW`);
                  if (d.staffMood) tags.push('員工心情 +');
                  if (d.speed && d.speed > 1) tags.unshift(`速度 ×${d.speed}`);
                  if (d.selfServe) tags.unshift('不用店員');
                  const locked = !s.unlocked(d);
                  return `<button class="cat-item ${ui.build && ui.build.type === d.id ? 'active' : ''} ${locked ? 'locked' : ''}" data-action="pick-build" data-type="${d.id}" ${s.cash < d.price || locked ? 'disabled' : ''}>
                    <span class="cat-icon">${locked ? '🔒' : d.icon}</span><b>${d.name}</b><span class="cat-price">${locked ? `Lv.${d.lv} 解鎖` : money(d.price)}</span><small>${tags.join('・')}</small>
                  </button>`;
                })
                .join('')}</div>
              <p class="drawer-tip">${isTouch ? '選好之後點地板放置；點已經擺好的東西可以搬動或賣掉。' : '選好之後點地板放置，R 旋轉，Esc 取消；點已經擺好的東西可以搬動或賣掉。'}</p>`
        }
      </div>`;
  }

  function drawerStaff() {
    const s = ui.sim;
    return `
      <div class="drawer-body two-col">
        <div>
          <h3>員工（${s.staff.length} 人）</h3>
          <div class="staff-list">
            ${s.staff
              .map((e) => {
                const sh = s.shiftOf(e);
                return `<button class="staff-row" data-action="insp-staff" data-id="${e.id}">
                  <span class="mini-face">${portraitSVG(e.look, moodOf(e))}</span>
                  <span class="staff-info"><b>${esc(e.name)}</b><small>${e.traits.map((t) => TRAITS[t].name).join('・')}・時薪 ${money(e.wage)}</small><small>${sh ? `${hhmm(sh.start)}～${hhmm(sh.end)}` : '今天休假'}・${{ off: '下班', arriving: '上班中', working: '工作中', break: '休息中', leaving: '下班中' }[e.state]}</small></span>
                  <span class="staff-bars"><i style="--v:${e.mood}%" class="m"></i><i style="--v:${e.energy}%" class="e"></i></span>
                </button>`;
              })
              .join('') || '<p class="muted">一個員工都沒有，店開不起來。快招人！</p>'}
          </div>
        </div>
        <div>
          <h3>應徵者 <small>每週會換一批・刊登徵才 $1,500</small></h3>
          <div class="cand-list">
            ${s.candidates
              .map(
                (c, i) => `<div class="cand card">
                  <span class="mini-face">${portraitSVG(c.look, 'neutral')}</span>
                  <div><b>${esc(c.name)}</b><div class="chips">${c.traits.map((t) => `<span class="chip" title="${TRAITS[t].desc}">${TRAITS[t].name}</span>`).join('')}</div>
                  <small>技能 ${c.skill}・希望時薪 ${money(c.wage)}</small><small class="muted">${c.traits.map((t) => TRAITS[t].desc).join('；')}</small></div>
                  <button class="primary" data-action="hire" data-i="${i}">錄取</button>
                </div>`
              )
              .join('')}
          </div>
          <p class="drawer-tip">一天要排幾班、要不要輪休，在「⚙️ 經營」裡設定。時薪不能低於最低時薪 $${MIN_WAGE}。</p>
        </div>
      </div>`;
  }

  function drawerManage() {
    const s = ui.sim;
    const p = s.policy;
    const times = [];
    for (let m = 0; m <= 1440; m += 30) times.push(m);
    const sel = (key, v, list) => `<select data-action="policy" data-key="${key}">${list.map(([val, label]) => `<option value="${val}" ${String(v) === String(val) ? 'selected' : ''}>${label}</option>`).join('')}</select>`;
    const span = ((p.close > p.open ? p.close - p.open : p.close + 1440 - p.open) / 60).toFixed(1);
    const perShift = (span / p.shifts + (p.shifts ? 0.5 : 0)).toFixed(1);
    return `
      <div class="drawer-body two-col">
        <div>
          <h3>營業與排班 <small>改了明天生效</small></h3>
          <div class="form-grid">
            <label>開門 ${sel('open', p.open, times.slice(0, 48).map((m) => [m, hhmm(m)]))}</label>
            <label>打烊 ${sel('close', p.close, times.slice(1).map((m) => [m, m === 1440 ? '24:00' : hhmm(m)]))}</label>
            <label>一天幾班 ${sel('shifts', p.shifts, [[1, '一班'], [2, '兩班（早晚）'], [3, '三班（含大夜）']])}</label>
            <label>公休日 ${sel('closedDay', p.closedDay, [[-1, '全年無休'], ...WEEKDAYS.map((d, i) => [i, `每週${d}`])])}</label>
          </div>
          <p class="calc">營業 ${span} 小時，每人一班約 <b class="${perShift > 8 ? 'neg' : ''}">${perShift} 小時</b>${perShift > 8 ? '（超過 8 小時要算加班）' : ''}</p>
          <div class="toggles">
            ${toggle('restDays', p.restDays === 'rotate', '員工輪休（每人每週休兩天）', '不排休：大家天天上班（違法，七休一）')}
            ${toggle('overtimePay', p.overtimePay, '加班照算加班費', '加班不給加班費（違法）')}
            ${toggle('breaks', p.breaks, '累了可以休息', '上班時間不准休息（違法）')}
          </div>
          ${
            s.ind.delivery
              ? `<h3>外送平台</h3>${toggle('delivery', p.delivery, '已加入外送平台：外送員會來取餐（平台抽成 30%）', '沒有加入外送平台')}
                 <p class="drawer-tip">下雨天、寒流來的時候外送訂單特別多；但抽成高，而且會跟現場客人搶人手。</p>`
              : ''
          }
          <h3>銀行</h3>
          <p class="calc">借款 ${money(s.loan)}（月息 2%，上限 $600,000）</p>
          <div class="insp-actions"><button data-action="borrow">借 $100,000</button><button data-action="repay" ${s.loan <= 0 ? 'disabled' : ''}>還 $100,000</button></div>
        </div>
        <div>
          <h3>菜單與價格 <small>建議價會跟著物價漲</small></h3>
          <div class="price-list">
            ${s.ind.products
              .map((pr) => {
                const sug = Math.round((pr.price * s.idx.cpi) / 5) * 5;
                const cur = s.prices[pr.id];
                const margin = Math.round((1 - (pr.cost * s.idx.cpi * s.costMult.materials) / cur) * 100);
                const avail = s.availableProducts().some((x) => x.id === pr.id) || !s.menu[pr.id];
                return `<div class="price-row ${s.menu[pr.id] ? '' : 'off'}">
                  <label class="price-name"><input type="checkbox" data-action="menu" data-id="${pr.id}" ${s.menu[pr.id] ? 'checked' : ''} /> ${pr.icon} ${pr.name}</label>
                  <span class="price-ctl"><button data-action="price" data-id="${pr.id}" data-d="-5">－</button><b class="${cur > sug * 1.1 ? 'neg' : cur < sug * 0.9 ? 'pos' : ''}">$${cur}</b><button data-action="price" data-id="${pr.id}" data-d="5">＋</button></span>
                  <small>建議 $${sug}・毛利 ${margin}%${avail ? '' : '・<span class="neg">沒有設備</span>'}</small>
                </div>`;
              })
              .join('')}
          </div>
          <p class="drawer-tip">比建議價貴 10% 以上，客人會明顯變少，評價也會變差。</p>
        </div>
      </div>`;
  }

  function toggle(key, on, onLabel, offLabel) {
    return `<button class="toggle ${on ? 'on' : 'off'}" data-action="toggle" data-key="${key}"><span class="knob"></span><span>${on ? onLabel : `<span class="neg">${offLabel}</span>`}</span></button>`;
  }

  function drawerLedger() {
    const s = ui.sim;
    const L = s.ledger;
    const rows = [
      ['營收', L.revenue],
      ['食材／進貨', -L.materials],
      ['薪資', -L.wages],
      ['房租', -L.rent],
      ['水電', -L.utilities],
      ['利息', -L.interest],
      ['事件', L.events],
      ['分店', L.branches],
      ['設備與其他', L.other],
    ].filter(([, v]) => Math.round(v) !== 0);
    const net = rows.reduce((a, [, v]) => a + v, 0);
    const hist = s.history.slice(-10);
    const maxAbs = Math.max(1, ...hist.map((h) => Math.abs(h.profit)));
    return `
      <div class="drawer-body two-col">
        <div>
          <h3>這週到目前為止 <small>第 ${s.week} 週</small></h3>
          <table class="ledger">${rows.map(([k, v]) => `<tr><th>${k}</th><td class="${v < 0 ? 'neg' : 'pos'}">${signedMoney(v)}</td></tr>`).join('')}
            <tr class="total"><th>合計</th><td class="${net < 0 ? 'neg' : 'pos'}">${signedMoney(net)}</td></tr></table>
          ${s.lastDay ? `<p class="calc">昨天：服務 ${s.lastDay.served} 人・營收 ${money(s.lastDay.revenue)}・生氣離開 ${s.lastDay.angry} 人・太擠沒進來 ${s.lastDay.balked} 人</p>` : ''}
          <p class="calc">今天到目前：來客 ${s.today.visitors}${s.today.delivery ? `（外送 ${s.today.delivery}）` : ''}・服務 ${s.today.served}・營收 ${money(s.today.revenue)}</p>
          <p class="calc">今天天氣：${s.weather.icon} ${s.weather.name}${s.festival ? `・${s.festival.icon} ${s.festival.name}` : ''}</p>
        </div>
        <div>
          <h3>每週淨利</h3>
          ${hist.length ? `<div class="spark">${hist.map((h) => `<div class="spark-col" title="第 ${h.week} 週：${signedMoney(h.profit)}"><i class="${h.profit < 0 ? 'neg' : 'pos'}" style="height:${(Math.abs(h.profit) / maxAbs) * 100}%"></i><small>${h.week}</small></div>`).join('')}</div>` : '<p class="muted">第一週結束後會出現。</p>'}
          <h3>物價</h3>
          <div class="econ-grid">
            <div><span>📈 物價</span><b>+${((s.idx.cpi - 1) * 100).toFixed(1)}%</b></div>
            <div><span>⛽ 油價</span><b>${(30 * s.idx.oil).toFixed(1)} 元/L</b></div>
            <div><span>⚡ 電價</span><b>+${((s.idx.power - 1) * 100).toFixed(1)}%${s.isSummer ? '（夏月）' : ''}</b></div>
            <div><span>👛 行情時薪</span><b>${money(s.marketWage)}</b></div>
          </div>
          <ul class="news-list">${s.news.map((n) => `<li>${n}</li>`).join('')}</ul>
        </div>
      </div>`;
  }

  function drawerReviews() {
    const s = ui.sim;
    const r = s.rating;
    return `
      <div class="drawer-body">
        <div class="rating-big"><b>${r.toFixed(1)}</b><span class="stars">${stars(r)}</span><small>${s.reviews.length} 則評論・評價越高，路過的人越願意進來</small></div>
        <div class="review-list">
          ${s.reviews
            .slice(-30)
            .reverse()
            .map((v) => `<div class="review"><span class="stars">${stars(v.stars)}</span><p>${esc(v.text)}</p><small>第 ${v.day} 天</small></div>`)
            .join('') || '<p class="muted">還沒有人留評論。</p>'}
        </div>
      </div>`;
  }

  function drawerGoals() {
    const s = ui.sim;
    const lv = s.level;
    const next = LEVELS[lv];
    const upcoming = CATALOG.filter((d) => d.lv && d.lv > lv && (!d.industries || d.industries.includes(s.ind.id))).sort((a, b) => a.lv - b.lv).slice(0, 6);
    const canBranch = lv >= 5 && s.branches.length < DISTRICTS.length;
    return `
      <div class="drawer-body two-col">
        <div>
          <h3>店家等級 <small>賺的毛利越多，經驗越高</small></h3>
          <div class="level-card"><b>Lv.${lv}</b><div class="bar"><div class="bar-fill skill" style="width:${Math.round(s.levelProgress * 100)}%"></div></div><small>${next ? `${Math.round(s.xp).toLocaleString()} / ${next.toLocaleString()}` : '已經是最高等級'}</small></div>
          ${upcoming.length ? `<p class="calc">即將解鎖：${upcoming.map((d) => `${d.icon}${d.name}（Lv.${d.lv}）`).join('、')}</p>` : ''}
          <h3>分店 <small>${lv >= 5 ? '分店收入看本店的評價和慣老闆指數' : '店家 Lv.5 才能開分店'}</small></h3>
          <div class="branch-list">
            ${s.branches.map((b, i) => `<div class="branch"><span>🏙️</span><div><b>${esc(s.shopName)}${b.district}店</b><small>上週 ${signedMoney(b.last)}・累計 ${signedMoney(b.total)}</small></div><button data-action="sell-branch" data-i="${i}">頂讓</button></div>`).join('') || '<p class="muted">還沒有分店。</p>'}
          </div>
          ${canBranch ? `<button class="primary" data-action="open-branch" ${s.cash < s.branchCost ? 'disabled' : ''}>在${DISTRICTS[s.branches.length]}開分店（${money(s.branchCost)}）</button>` : ''}
          ${s.awards.length ? `<h3>年度好店評選</h3>${s.awards.map((a) => `<p class="calc">${a.medal} 第 ${a.year} 年：${a.title}（${a.score} 分）</p>`).join('')}` : '<p class="drawer-tip">每年 12 月最後一週結束時，會舉辦年度好店評選。</p>'}
        </div>
        <div>
          <h3>成就</h3>
          <div class="goal-list">
            ${ACHIEVEMENTS.map((a) => `<div class="goal ${s.achievements.has(a.id) ? 'done' : ''}"><span>${s.achievements.has(a.id) ? '🏆' : '🔒'}</span><div><b>${a.name}</b><small>${a.desc}</small></div>${a.reward ? `<em>${money(a.reward)}</em>` : ''}</div>`).join('')}
          </div>
          <p class="drawer-tip">沙盒遊戲沒有時間限制。慣老闆指數到 100，或現金是負的又借不到錢，店就會收起來。</p>
        </div>
      </div>`;
  }

  // ───── 對話框 ─────
  function renderDialog() {
    const box = document.getElementById('dialog');
    if (!box) return;
    const d = ui.dialog;
    const s = ui.sim;
    if (!d) {
      box.innerHTML = '';
      return;
    }
    let inner = '';
    if (d.type === 'welcome') {
      inner = vn(
        bossLook(ui.settings.gender),
        'smug',
        '你',
        `<div class="event-kicker">開店第一天・${s.clockLabel}</div>
         <h2>「${esc(s.shopName)}」準備開張！</h2>
         <p>店裡已經擺好基本設備，也有 ${s.staff.length} 位員工。客人會從騎樓走過，評價好、價格合理、店面漂亮，就比較願意進來。</p>
         <ul class="news-list">
           <li>🏗️ <b>建造</b>：買設備、座位、裝潢、員工休息區，自由擺放</li>
           <li>👥 <b>員工</b>：點員工看他的心情和想法；人手不夠就招人</li>
           <li>⚙️ <b>經營</b>：營業時間、排班、加班費、定價</li>
           <li>⏩ 右上角可以暫停或快轉；打烊後會自動快轉到隔天</li>
         </ul>
         <div class="tip">${isTouch ? '拖曳畫面可以移動視角，兩指縮放；' : '拖曳畫面可以移動視角，滾輪縮放，Q／E 旋轉；'}員工頭上出現 <b class="bang">!</b> 是有事找你，左上角也會列出來。</div>
         <button class="primary" data-action="close-dialog">開門營業</button>`
      );
    } else if (d.type === 'event') {
      const ev = d.ev;
      const sp = speakerOf(ev);
      inner = vn(
        sp.look,
        sp.mood,
        sp.name,
        `<div class="event-kicker">${ev.where === 'staff' ? '👤 員工' : ev.where === 'phone' ? '☎️ 電話' : '🚪 門口'}・${s.clockLabel}・還剩 ${Math.max(0, Math.round(ev.deadline - s.minute))} 分鐘</div>
         <h2>${ev.ev.icon} ${ev.ev.title}</h2>
         <p class="event-text">${ev.ev.text}</p>
         <div class="choices">
           ${ev.ev.choices
             .map((c, i) => {
               let meta;
               if (c.minigame) meta = '<span class="cost game">🎮 老闆親自下場（小遊戲）</span>';
               else {
                 const fx = s.resolveEffects(c);
                 meta = fx.cash ? `<span class="cost ${fx.cash > 0 ? 'good' : 'bad'}">${signedMoney(fx.cash)}</span>` : '';
               }
               return `<button class="choice ${c.minigame ? 'is-game' : ''}" data-action="choose" data-i="${i}">
                 <span class="choice-label"><kbd>${i + 1}</kbd>${c.label}</span>
                 ${c.quote ? `<span class="quote">「${c.quote}」</span>` : ''}
                 <span class="choice-meta">${meta}${c.note ? `<span class="cost note">${c.note}</span>` : ''}</span>
               </button>`;
             })
             .join('')}
         </div>
         <button class="ghost" data-action="close-dialog">等一下再說（Esc）</button>`
      );
    } else if (d.type === 'result') {
      const r = d.result;
      const re = reactionOf(d);
      inner = vn(
        re.look,
        re.mood,
        re.name,
        `<div class="event-kicker">${d.game === true ? '🎮 小遊戲成功！' : d.game === false ? '🎮 小遊戲失敗' : '你的決定'}</div>
         <h2>${r.choice.label}</h2>
         <p class="event-text">${r.choice.result}</p>
         ${deltaChips(r.delta)}
         ${r.choice.tip ? `<div class="tip">📘 <strong>勞動法小知識：</strong>${r.choice.tip}</div>` : ''}
         <button class="primary" data-action="close-dialog">回去顧店（Enter）</button>`
      );
    } else if (d.type === 'week') {
      inner = weekReport(d.report);
    } else if (d.type === 'ending') {
      const e = s.ending;
      inner = `<div class="card ending lose">
        <div class="ending-face">${portraitSVG(bossLook(ui.settings.gender), e.type === 'jerk' ? 'shocked' : 'sad')}<span>${e.type === 'jerk' ? '📰' : '💸'}</span></div>
        <h2>${e.title}</h2><p>${e.desc}</p>
        <div class="ending-stats">
          <div><span>撐了</span><b>${s.day - 1} 天</b></div>
          <div><span>評價</span><b>${s.rating.toFixed(1)} ★</b></div>
          <div><span>員工</span><b>${s.staff.length} 人</b></div>
          <div><span>成就</span><b>${s.achievements.size} 個</b></div>
        </div>
        <div class="ending-actions"><button class="primary" data-action="quit">回主選單</button></div>
      </div>`;
    }
    box.innerHTML = d.type === 'minigame' ? '' : `<div class="dialog-backdrop ${d.type === 'week' || d.type === 'ending' ? 'center' : ''}">${inner}</div>`;
    ui.dialogShownAt = performance.now();
  }

  function weekReport(r) {
    const s = ui.sim;
    const rows = [
      ['營收', r.revenue],
      ['食材／進貨', -r.materials],
      ['薪資', -r.wages],
      ['房租', -r.rent],
      ['水電', -r.utilities],
      ['利息', -r.interest],
      ['事件', r.events],
      ['分店', r.branches || 0],
      ['設備與其他', r.other],
    ].filter(([, v]) => Math.round(v) !== 0);
    const aw = r.award;
    return `<div class="card week">
      ${aw ? `<div class="award"><span>${aw.medal}</span><div><small>第 ${aw.year} 年・年度好店評選（${aw.score} 分）</small><b>${aw.title}</b><p>${aw.desc}${aw.reward ? ` 獎金 ${money(aw.reward)}！` : ''}</p></div></div>` : ''}
      <div class="event-kicker">📊 週報・第 ${r.week} 週</div>
      <h2>${r.profit >= 0 ? '這週有賺錢！' : '這週虧錢了'} <span class="${r.profit < 0 ? 'neg' : 'pos'}">${signedMoney(r.profit)}</span></h2>
      <table class="ledger">${rows.map(([k, v]) => `<tr><th>${k}</th><td class="${v < 0 ? 'neg' : 'pos'}">${signedMoney(v)}</td></tr>`).join('')}</table>
      <div class="week-stats">
        <div><span>評價</span><b>${r.rating.toFixed(1)} ★</b></div>
        <div><span>員工心情</span><b>${Math.round(r.morale)}</b></div>
        <div><span>慣老闆指數</span><b>${Math.round(r.jerk)}</b></div>
        <div><span>現金</span><b class="${s.cash < 0 ? 'neg' : ''}">${money(s.cash)}</b></div>
      </div>
      ${r.inspection ? (r.inspection.violations.length ? `<div class="alert bad">🔍 <b>勞動檢查！</b>查到：${r.inspection.violations.join('、')}，罰鍰 ${money(r.inspection.fine)}。</div>` : '<div class="alert good">🔍 勞動檢查：沒有發現違規。</div>') : ''}
      ${s.cash < 0 ? `<div class="alert bad">⚠️ 現金是負的！下週結算前要轉正，不然只能跟銀行借錢（目前借了 ${money(s.loan)}，上限 $600,000）。</div>` : ''}
      ${r.news.length ? `<ul class="news-list">${r.news.map((n) => `<li>${n}</li>`).join('')}</ul>` : ''}
      <button class="primary" data-action="close-dialog">繼續經營</button>
    </div>`;
  }

  function vn(look, mood, name, body) {
    return `<div class="vn"><div class="vn-portrait mood-${mood}">${portraitSVG(look, mood)}<span class="vn-name">${esc(name)}</span></div><div class="vn-box card">${body}</div></div>`;
  }

  function speakerOf(ev) {
    if (ev.where === 'staff') {
      const e = ev.staff || ui.sim.staff[0];
      if (e) return { look: e.look, name: e.name, mood: ev.ev.id === 'resign' || ev.ev.id === 'raise' ? 'neutral' : 'worried' };
    }
    const key = (ev.ev.speaker && ev.ev.speaker.look) || (ev.where === 'phone' ? 'caller' : 'crowd');
    const look = VISITORS[key] || VISITORS.caller;
    return { look, name: (ev.ev.speaker && ev.ev.speaker.name) || look.name, mood: ev.ev.id === 'd_karen' ? 'angry' : key === 'investor' ? 'smug' : 'neutral' };
  }

  function reactionOf(d) {
    const delta = d.result.delta;
    const s = ui.sim;
    const e = (d.ev.staff && s.staff.includes(d.ev.staff) && d.ev.staff) || s.staff[0];
    if (!e) return { look: bossLook(ui.settings.gender), name: '你', mood: 'smug' };
    let mood = 'neutral';
    if (delta.jerk >= 10) mood = d.result.event.id.length % 2 ? 'sad' : 'angry';
    else if (delta.jerk >= 4 || delta.morale <= -4) mood = 'worried';
    else if (delta.morale >= 3 || delta.jerk <= -2 || d.game === true) mood = 'happy';
    if (d.game === false && mood === 'neutral') mood = 'shocked';
    return { look: e.look, name: d.ev.where === 'staff' ? e.name : `${e.name}（員工）`, mood };
  }

  function deltaChips(d) {
    const c = [];
    if (d.cash) c.push(`<span class="chip ${d.cash > 0 ? 'good' : 'bad'}">💰 ${signedMoney(d.cash)}</span>`);
    if (d.morale) c.push(`<span class="chip ${d.morale > 0 ? 'good' : 'bad'}">😊 員工心情 ${signed(d.morale)}</span>`);
    if (d.jerk) c.push(`<span class="chip ${d.jerk < 0 ? 'good' : 'bad'}">😈 慣老闆 ${signed(d.jerk)}</span>`);
    if (d.staff) c.push(`<span class="chip ${d.staff > 0 ? 'good' : 'bad'}">👥 員工 ${signed(d.staff)}</span>`);
    return `<div class="chips">${c.join('') || '<span class="chip">沒什麼變化</span>'}</div>`;
  }

  function openEvent(id) {
    const ev = ui.sim.activeEvents.find((e) => String(e.id) === String(id));
    if (!ev) return;
    ui.dialog = { type: 'event', ev };
    renderDialog();
  }

  function choose(i) {
    const s = ui.sim;
    const ev = ui.dialog.ev;
    const c = ev.ev.choices[i];
    if (!c) return;
    if (c.minigame) {
      ui.dialog = { type: 'minigame', ev };
      renderDialog();
      window.BossMinigames.run(document.getElementById('dialog'), { ...c.minigame, kicker: '老闆親自下場' }, s.ind.id).then((ok) => {
        const outcome = ok ? { label: c.label, effects: c.effects, result: c.result, tip: c.tip } : { label: c.label, effects: c.fail.effects, result: c.fail.result, tip: c.tip };
        const result = s.applyChoice(ev, outcome);
        ui.dialog = result ? { type: 'result', result, ev, game: ok } : null;
        renderDialog();
      });
      return;
    }
    const result = s.resolve(ev, i);
    ui.dialog = result ? { type: 'result', result, ev } : null;
    renderDialog();
    renderInbox();
  }

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, ui.sim.serialize());
      return true;
    } catch (e) {
      return false;
    }
  }

  function quit() {
    cancelAnimationFrame(ui.raf);
    if (ui.view) ui.view.destroy();
    ui.view = null;
    ui.sim = null;
    ui.phase = 'start';
    renderStart();
  }

  // ───── 事件處理 ─────
  app.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const a = btn.dataset.action;
    const s = ui.sim;
    if (['choose', 'close-dialog'].includes(a) && performance.now() - (ui.dialogShownAt || 0) < 350) return;
    switch (a) {
      case 'pick-ind':
        keepName();
        ui.settings.industry = btn.dataset.id;
        renderStart();
        break;
      case 'set':
        keepName();
        ui.settings[btn.dataset.key] = btn.dataset.value;
        renderStart();
        break;
      case 'start': {
        keepName();
        const ind = INDUSTRIES.find((i) => i.id === ui.settings.industry);
        startGame(new Sim(ind.id, { shopName: ui.settings.shopName.trim() || ind.shopName, mode: ui.settings.mode }));
        break;
      }
      case 'continue': {
        try {
          startGame(Sim.load(loadSave(), {}));
        } catch (err) {
          toast('存檔讀取失敗', 'bad');
        }
        break;
      }
      case 'music':
        window.BossAudio.init();
        window.BossAudio.toggle('music');
        renderTopbar();
        break;
      case 'sfx':
        window.BossAudio.init();
        window.BossAudio.toggle('sfx');
        ui.lastWeather = null;
        renderTopbar();
        break;
      case 'speed':
        ui.speed = Number(btn.dataset.v);
        renderTopbar();
        break;
      case 'save': {
        const ok = save();
        toast(ok ? '💾 已存檔（存在這個瀏覽器裡）' : '這個瀏覽器不能存檔', ok ? '' : 'bad');
        break;
      }
      case 'quit':
        save();
        quit();
        break;
      case 'tab':
        openTab(btn.dataset.tab);
        break;
      case 'build-cat':
        ui.buildCat = btn.dataset.cat;
        renderDrawer();
        break;
      case 'pick-build':
        startBuild(btn.dataset.type);
        if (!smallScreen()) renderDrawer();
        break;
      case 'end-build':
        endBuild();
        renderDrawer();
        break;
      case 'rot-ghost':
        rotateGhost();
        break;
      case 'upgrade-lot':
        if (s.upgradeLot()) {
          ui.view.buildStatic();
          renderDrawer();
        }
        break;
      case 'cam-rot':
        ui.view.rotate(Number(btn.dataset.dir));
        break;
      case 'zoom':
        ui.view.setZoom(ui.view.zoom * (btn.dataset.dir === '1' ? 1.2 : 0.83));
        break;
      case 'close-insp':
        closeInspector();
        break;
      case 'insp-staff':
        inspect('staff', s.staff.find((x) => String(x.id) === btn.dataset.id));
        break;
      case 'raise':
        s.raise(ui.inspect.ref);
        renderInspector();
        break;
      case 'praise':
        s.praise(ui.inspect.ref);
        renderInspector();
        break;
      case 'scold':
        s.scold(ui.inspect.ref);
        renderInspector();
        break;
      case 'sendhome':
        s.sendHome(ui.inspect.ref);
        toast(`🏠 ${ui.inspect.ref.name} 今天先下班了`);
        break;
      case 'fire':
        if (ui.confirmFire === ui.inspect.ref) {
          s.fire(ui.inspect.ref);
          closeInspector();
        } else {
          ui.confirmFire = ui.inspect.ref;
          renderInspector();
        }
        break;
      case 'move-obj':
        startMove(ui.inspect.ref);
        break;
      case 'rot-obj': {
        const o = ui.inspect.ref;
        if (!s.moveObject(o, o.x, o.z, (o.rot + 1) % 4)) toast('轉不過去，旁邊被擋住了', 'bad');
        break;
      }
      case 'sell-obj': {
        const r = s.sell(ui.inspect.ref);
        if (r === false) toast('有客人正在用，等一下再賣', 'bad');
        else {
          toast(`💰 賣掉了，拿回 ${money(r)}`);
          closeInspector();
        }
        break;
      }
      case 'hire': {
        const e2 = s.hire(Number(btn.dataset.i));
        if (e2) renderDrawer();
        break;
      }
      case 'toggle': {
        const k = btn.dataset.key;
        if (k === 'restDays') s.policy.restDays = s.policy.restDays === 'rotate' ? 'none' : 'rotate';
        else s.policy[k] = !s.policy[k];
        renderDrawer();
        break;
      }
      case 'price': {
        const id = btn.dataset.id;
        s.prices[id] = Math.max(5, s.prices[id] + Number(btn.dataset.d));
        renderDrawer();
        break;
      }
      case 'open-branch':
        s.openBranch();
        renderDrawer();
        break;
      case 'sell-branch':
        s.sellBranch(Number(btn.dataset.i));
        renderDrawer();
        break;
      case 'borrow':
        s.borrow(100000);
        renderDrawer();
        break;
      case 'repay':
        s.repay(100000);
        renderDrawer();
        break;
      case 'open-event':
        openEvent(btn.dataset.id);
        break;
      case 'choose':
        choose(Number(btn.dataset.i));
        break;
      case 'close-dialog':
        ui.dialog = null;
        renderDialog();
        break;
    }
  });

  app.addEventListener('change', (e) => {
    const t = e.target;
    const s = ui.sim;
    if (!s) return;
    if (t.dataset.action === 'policy') {
      const v = Number(t.value);
      s.policy[t.dataset.key] = v;
      if (t.dataset.key === 'close' && s.policy.close === s.policy.open) s.policy.close = (s.policy.open + 60) % 1440;
      renderDrawer();
    } else if (t.dataset.action === 'menu') {
      s.menu[t.dataset.id] = t.checked;
      renderDrawer();
    }
  });

  app.addEventListener('pointerdown', (e) => {
    if (e.target.closest('#drawer')) ui.drawerTouched = performance.now();
  });

  // 點 3D 場景上的事件泡泡
  app.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.bubble3d');
    if (b && b.dataset.ev) {
      e.stopPropagation();
      openEvent(b.dataset.ev);
    }
  }, true);

  function keepName() {
    const n = document.getElementById('shop-name');
    if (n) ui.settings.shopName = n.value;
  }

  function rotateGhost() {
    if (!ui.build) return;
    ui.build.rot = (ui.build.rot + 1) % 4;
    ui.view.updateGhost(ui.hover, ui.build.rot, false);
  }

  window.addEventListener('keydown', (e) => {
    if (ui.phase !== 'game') return;
    if (e.target.matches('input, select, textarea')) return;
    const d = ui.dialog;
    if (d) {
      if (d.type === 'event') {
        const n = Number(e.key);
        if (n >= 1 && n <= d.ev.ev.choices.length) choose(n - 1);
        else if (e.key === 'Escape') {
          ui.dialog = null;
          renderDialog();
        }
      } else if (d.type !== 'minigame' && d.type !== 'ending' && (e.key === 'Enter' || e.key === 'Escape')) {
        ui.dialog = null;
        renderDialog();
      }
      return;
    }
    const k = e.key.toLowerCase();
    if (k === ' ') {
      e.preventDefault();
      if (ui.speed > 0) {
        ui.prevSpeed = ui.speed;
        ui.speed = 0;
      } else ui.speed = ui.prevSpeed || 1;
      renderTopbar();
    } else if (k === '1' || k === '2' || k === '3') {
      ui.speed = { 1: 1, 2: 3, 3: 8 }[k];
      ui.prevSpeed = ui.speed;
      renderTopbar();
    } else if (k === 'r') rotateGhost();
    else if (k === 'q') ui.view.rotate(-1);
    else if (k === 'e') ui.view.rotate(1);
    else if (k === 'b') openTab('build');
    else if (k === 'escape') {
      if (ui.build) {
        endBuild();
        renderDrawer();
      } else if (ui.inspect) closeInspector();
      else if (ui.tab) openTab(ui.tab);
    }
  });

  // 自動化測試用：網址加上 #debug 才會開放
  if (location.hash === '#debug') window.BossDebug = { ui };

  renderStart();
})();
