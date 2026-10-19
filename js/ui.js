// 介面：開始畫面、上方資訊列、底部工具列與抽屜、檢視面板、事件對話、週報、結局
(function () {
  const { Sim, CATALOG, catalogById, ACHIEVEMENTS, MIN_WAGE, WEEKDAYS, INS, TAX_LABEL, CUSTOMER_TYPES } = window.BossSim;
  const { INDUSTRIES, CAT_LABELS, LOTS, TRAITS, LEVELS, DISTRICTS, DISTRICT_INFO, DIFFICULTY, FLOORS, WALLS, SIGNS } = window.BossIndustries;
  const Fun = window.BossFun;
  const { portraitSVG, bossLook, VISITORS } = window.BossLooks;
  const app = document.getElementById('app');
  const LEGACY_KEY = 'boss-sim-save-v1';
  const SLOTS = [1, 2, 3];
  const slotKey = (n) => `boss-sim-slot-${n}`;
  const TUT_KEY = 'boss-sim-tutorial-done';
  const QUALITY_KEY = 'boss-sim-quality';
  const isTouch = window.matchMedia('(hover: none)').matches;
  const store = {
    get(k) {
      try {
        return localStorage.getItem(k);
      } catch (e) {
        return null;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, v);
        return true;
      } catch (e) {
        return false;
      }
    },
    del(k) {
      try {
        localStorage.removeItem(k);
      } catch (e) {
        /* 不能刪就算了 */
      }
    },
  };
  // 舊版只有一格存檔：搬到第 1 格
  if (store.get(LEGACY_KEY) && !store.get(slotKey(1))) {
    store.set(slotKey(1), store.get(LEGACY_KEY));
    store.del(LEGACY_KEY);
  }

  const ui = {
    phase: 'start',
    settings: { industry: 'breakfast', gender: 'm', mode: 'normal', shopName: '' },
    sim: null,
    view: null,
    speed: 2,
    tab: null,
    buildCat: 'station',
    build: null, // { type, rot } 或 { move: obj, rot }
    hover: null,
    inspect: null, // { kind, ref }
    dialog: null,
    paused: false, // 對話框或週報打開時暫停
    raf: 0,
    confirmFire: null,
    slot: null, // 目前遊戲存在第幾格
    tut: null, // 新手教學：{ step }
    tutFlags: {},
    quality: store.get(QUALITY_KEY) || 'auto',
    autoPause: store.get('boss-sim-autopause') !== '0',
    staffTab: 'overview',
    bossMode: false,
    keys: new Set(),
    joy: null,
    post: { hook: 'confess', body: null, end: 'tag' },
  };
  ui.settings.tutorial = !store.get(TUT_KEY);

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const money = (n) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString('zh-TW')}`;
  const signedMoney = (n) => (n > 0 ? `+${money(n)}` : money(n));
  const signed = (n) => (n > 0 ? `+${n}` : `${n}`);
  const stars = (r) => '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));
  // 只更新有變動的節點：按鈕不會在手指下被換掉，捲動位置也不會跳回最上面
  function morph(target, html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    syncChildren(target, tpl.content);
  }
  function syncChildren(a, b) {
    const an = [...a.childNodes];
    const bn = [...b.childNodes];
    for (let i = 0; i < bn.length; i++) {
      const x = an[i];
      const y = bn[i];
      if (!x) {
        a.appendChild(y.cloneNode(true));
        continue;
      }
      if (x.nodeType !== y.nodeType || x.nodeName !== y.nodeName) {
        a.replaceChild(y.cloneNode(true), x);
        continue;
      }
      if (x.nodeType !== 1) {
        if (x.nodeValue !== y.nodeValue) x.nodeValue = y.nodeValue;
        continue;
      }
      for (const at of [...x.attributes]) if (!y.hasAttribute(at.name)) x.removeAttribute(at.name);
      for (const at of [...y.attributes]) if (x.getAttribute(at.name) !== at.value) x.setAttribute(at.name, at.value);
      if (x.nodeName === 'INPUT') {
        x.checked = y.hasAttribute('checked');
        if (x.type !== 'file' && x !== document.activeElement && x.value !== y.getAttribute('value') && y.hasAttribute('value')) x.value = y.getAttribute('value');
        continue;
      }
      if (x.nodeName === 'SELECT') {
        if (x === document.activeElement) continue;
        syncChildren(x, y);
        const sel = y.querySelector('option[selected]');
        if (sel && x.value !== sel.value) x.value = sel.value;
        continue;
      }
      syncChildren(x, y);
    }
    for (let i = an.length - 1; i >= bn.length; i--) a.removeChild(an[i]);
  }
  const hhmm = (m) => `${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(((m % 60) + 60) % 60).padStart(2, '0')}`;
  const loadSlot = (n) => store.get(slotKey(n));
  function slotInfo(n) {
    const raw = loadSlot(n);
    if (!raw) return null;
    try {
      const d = JSON.parse(raw);
      const si = INDUSTRIES.find((i) => i.id === d.ind);
      return { icon: si ? si.icon : '🏪', ind: si ? si.name : '', shop: d.shopName, day: d.day, cash: d.cash, month: Math.floor((d.day - 1) / 28) + 1, branches: (d.branches || []).length };
    } catch (e) {
      return null;
    }
  }
  const firstEmptySlot = () => SLOTS.find((n) => !loadSlot(n)) || 1;

  // 匯出：下載成 JSON 檔
  function exportSave(json, name) {
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${name}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  }

  function importSave(file, slot) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = JSON.parse(reader.result);
        if (!d.ind || !INDUSTRIES.some((i) => i.id === d.ind) || !Array.isArray(d.objects)) throw new Error('bad');
        store.set(slotKey(slot), reader.result);
        ui.settings.slot = slot;
        renderStart();
        flash(`📥 匯入成功，存在第 ${slot} 格`);
      } catch (e) {
        flash('這個檔案不是遊戲存檔', true);
      }
    };
    reader.readAsText(file);
  }

  // 開始畫面用的提示（遊戲裡用 toast）
  function flash(text, bad) {
    const el = document.createElement('div');
    el.className = `flash ${bad ? 'bad' : ''}`;
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  // ───── 開始畫面 ─────
  function renderStart() {
    document.body.className = '';
    const st = ui.settings;
    const ind = INDUSTRIES.find((i) => i.id === st.industry);
    if (!st.slot) st.slot = firstEmptySlot();
    const infos = Object.fromEntries(SLOTS.map((n) => [n, slotInfo(n)]));
    const anySave = SLOTS.some((n) => infos[n]);
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
        </div>

        ${
          anySave
            ? `<h2 class="section-title">存檔</h2>
        <div class="slot-list">
          ${SLOTS.map((n) => {
            const i = infos[n];
            return i
              ? `<div class="slot card"><span class="slot-no">${n}</span><div class="slot-info"><b>${i.icon} ${esc(i.shop)}</b><small>${i.ind}・第 ${i.month} 個月（第 ${i.day} 天）・現金 ${money(i.cash)}${i.branches ? `・分店 ${i.branches} 間` : ''}</small></div>
                  <div class="slot-actions"><button class="primary" data-action="continue" data-slot="${n}">繼續</button><button data-action="export-slot" data-slot="${n}" title="匯出成檔案">📤</button><button data-action="delete-slot" data-slot="${n}" class="${ui.confirmDelete === n ? 'danger' : ''}" title="刪除">${ui.confirmDelete === n ? '確定刪除' : '🗑️'}</button></div></div>`
              : `<div class="slot card empty"><span class="slot-no">${n}</span><div class="slot-info"><b>空的存檔</b><small>開新店會存在這裡</small></div></div>`;
          }).join('')}
        </div>`
            : ''
        }
        <div class="slot-import"><label class="file-btn">📥 匯入存檔檔案<input type="file" accept=".json,application/json" data-action="import-file" hidden /></label></div>

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
              ${Object.entries(DIFFICULTY).map(([id, d]) => `<button data-action="set" data-key="mode" data-value="${id}" class="${st.mode === id ? 'active' : ''}">${id === 'hell' ? '🔥 ' : id === 'easy' ? '🌱 ' : ''}${d.name}<small>${d.desc}</small></button>`).join('')}
            </div>
          </div>
          <div class="setup-row">
            <span class="setup-label">存檔</span>
            <div class="segmented small">
              ${SLOTS.map((n) => `<button data-action="set" data-key="slot" data-value="${n}" class="${Number(st.slot) === n ? 'active' : ''}">第 ${n} 格<small>${infos[n] ? '⚠️ 會覆蓋' : '空的'}</small></button>`).join('')}
            </div>
          </div>
          <label class="setup-row tut-check"><input type="checkbox" data-action="tut-toggle" ${st.tutorial ? 'checked' : ''} /> 新手教學（一步一步帶你擺設、定價、進貨、招人）</label>
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
  function startGame(sim, slot) {
    window.BossAudio.init();
    ui.sim = sim;
    ui.slot = slot || ui.settings.slot || firstEmptySlot();
    ui.phase = 'game';
    ui.speed = 2;
    ui.tut = null;
    ui.tutFlags = {};
    ui.bossMode = false;
    ui.keys.clear();
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
          <div class="tut-card card" id="tut" hidden></div>
          <button class="boss-toggle" id="boss-toggle" data-action="boss-mode" title="自己操控老闆（B 鍵以外的快捷鍵：G）">🕹️ 老闆下場</button>
          <div class="boss-hud card" id="boss-hud" hidden></div>
          <div class="joy" id="joy" hidden><div class="joy-knob"></div></div>
          <button class="boss-act" id="boss-act" data-action="boss-act" hidden></button>
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
            ['stock', '📦', '庫存'],
            ['manage', '⚙️', '經營'],
            ['ledger', '📊', '帳本'],
            ['social', '📱', '小編'],
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
      tripDone: (r) => {
        ui.dialog = { type: 'trip', result: r };
        renderDialog();
      },
      hygiene: () => {
        if (ui.tab === 'stock') renderDrawer();
      },
      levelUp: (lv, items) => {
        if (ui.tab === 'build' || ui.tab === 'goals') renderDrawer();
        const vp = document.querySelector('.viewport');
        if (!vp) return;
        const b = document.createElement('div');
        b.className = 'level-banner';
        b.innerHTML = `<b>⭐ Lv.${lv}</b><div>店家升級了！<small>${items.length ? `解鎖：${esc(items.join('、'))}` : '繼續加油'}</small></div>`;
        vp.appendChild(b);
        setTimeout(() => b.remove(), 4200);
      },
      weekEnd: (r) => {
        save();
        ui.dialog = r.victory ? { type: 'victory', report: r } : { type: 'week', report: r };
        renderDialog();
      },
    };
    ui.view = new window.BossShop3D(document.getElementById('view'), sim, {
      onClick: onViewClick,
      onHover: (t) => {
        ui.hover = t;
      },
      dragLocked: () => !!ui.build,
      peek: () => ui.tab === 'build' || !!ui.build,
      follow: () => ui.bossMode && !ui.build,
      bossGender: () => ui.settings.gender,
      bossPrompt: () => {
        if (!ui.bossMode || !ui.bossTarget) return null;
        return { key: isTouch ? '👆' : '[E]', label: ui.bossTarget.label, ref: ui.bossTarget.ref };
      },
      quality: effectiveQuality(),
      autoQuality: () => ui.quality === 'auto',
      onQuality: (q) => toast(`🖥️ 畫面有點卡，自動把畫質調成「${{ medium: '中', low: '低' }[q]}」`),
    });
    renderTopbar();
    renderInbox();
    ui.last = performance.now();
    cancelAnimationFrame(ui.raf);
    ui.raf = requestAnimationFrame(loop);
    if (sim.day === 1 && sim.minute < sim.hours.open) {
      ui.dialog = { type: 'welcome' };
      if (ui.settings.tutorial) {
        ui.speed = 0;
        ui.tutPending = true;
      }
      renderDialog();
    }
  }

  // 手機和小螢幕預設用中畫質
  function effectiveQuality() {
    if (ui.quality !== 'auto') return ui.quality;
    return isTouch || window.innerWidth < 700 ? 'medium' : 'high';
  }

  // ───── 新手教學 ─────
  const TUT = [
    { title: '歡迎來到你的店', text: () => (isTouch ? '拖曳畫面移動視角，兩指縮放，右下角可以旋轉。' : '拖曳畫面移動視角、滾輪縮放、Q／E 旋轉。') + '時間先暫停，我們一步一步來。', next: true },
    { title: '看看庫存', short: '點下方的「📦 庫存」',  text: () => '點下方的「📦 庫存」。每天早上會自動進貨到你設定的量；賣完了客人會失望離開，叫太多又會過期報廢。', target: '[data-tab="stock"]', done: () => ui.tab === 'stock' },
    { title: '調整進貨量', short: '按＋或－改一種食材的進貨量',  text: () => '按「＋」或「－」改一種食材的每天進貨量。也可以打開「依昨天用量自動調整」。', target: '[data-action="par"]', done: () => ui.tutFlags.par || ui.sim.policy.autoStock },
    { title: '定價', short: '在「菜單與價格」按＋或－改一個價格',  text: () => '打開「⚙️ 經營」，在「菜單與價格」按＋／－改一個品項的價格。太貴學生和長輩會不想來，太便宜又賺不到錢。', target: '[data-tab="manage"], [data-action="price"]', done: () => ui.tutFlags.price },
    { title: '擺設', short: '建造 → 選一樣東西 → 點地板放下',  text: () => '打開「🏗️ 建造」，買一盆盆栽（或任何東西），點地板放下去。店面漂亮，路人比較願意進來。', target: '[data-tab="build"]', done: () => ui.sim.objects.length > ui.tutObjs },
    { title: '招人', short: '員工 →「🙋 應徵者」→ 錄取', text: () => '打開「👥 員工」，切到「🙋 應徵者」分頁錄取一位。人手不夠，客人會等到生氣離開。旁邊的「👥 總覽」一眼就能看到所有人的心情和體力。', target: '[data-tab="staff"], [data-v="hire"], [data-action="hire"]', done: () => ui.sim.staff.length > ui.tutStaff },
    { title: '開門營業', short: '關掉面板，按右上角的 ▶', text: () => '先把下面的面板關起來（打開面板時時間會暫停），再按右上角的 ▶ 讓時間開始走。客人會走進來點餐，員工沒事做的時候會拿拖把打掃。', target: '[data-action="speed"][data-v="2"]', done: () => ui.speed > 0 && ui.sim.today.served > 0 },
    { title: '看看員工', short: '點一位腳下有綠圈的員工',  text: () => '點一位員工（腳下有綠色圓圈的人），看他的心情、精力和想法。', done: () => ui.inspect && ui.inspect.kind === 'staff' },
    { title: '教學完成！', text: () => '最後提醒：要給加班費、要排休、勞健保要保。店裡太髒會被衛生局開罰，附近也可能開競爭對手。慣老闆指數到 100，店就會收起來。祝生意興隆！', next: true },
  ];

  function startTutorial() {
    ui.tut = { step: 0 };
    ui.tutObjs = ui.sim.objects.length;
    ui.tutStaff = ui.sim.staff.length;
    renderTutorial();
  }

  function endTutorial() {
    ui.tut = null;
    store.set(TUT_KEY, '1');
    ui.settings.tutorial = false;
    document.querySelectorAll('.tut-glow').forEach((n) => n.classList.remove('tut-glow'));
    const el = document.getElementById('tut');
    if (el) el.hidden = true;
  }

  function renderTutorial() {
    const el = document.getElementById('tut');
    if (!el) return;
    if (!ui.tut) {
      el.hidden = true;
      return;
    }
    const st = TUT[ui.tut.step];
    if (st.done && st.done()) {
      ui.tut.step++;
      window.BossAudio.play('click');
      return renderTutorial();
    }
    const html = `<div class="tut-head"><small>新手教學 ${ui.tut.step + 1}／${TUT.length}</small><button class="link" data-action="tut-skip">跳過教學</button></div>
      <b>${st.title}</b><span class="tut-short">${st.short || ''}</span><p>${st.text()}</p>
      <div class="tut-dots">${TUT.map((_, i) => `<i class="${i < ui.tut.step ? 'done' : i === ui.tut.step ? 'cur' : ''}"></i>`).join('')}</div>
      ${st.next ? `<button class="primary" data-action="tut-next">${ui.tut.step === TUT.length - 1 ? '開始經營' : '下一步'}</button>` : ''}`;
    if (el.dataset.html !== html) {
      el.innerHTML = html;
      el.dataset.html = html;
    }
    el.hidden = false;
    // 抽屜打開時，教學卡移到抽屜上面
    const drawer = document.getElementById('drawer');
    const vp = el.parentElement.getBoundingClientRect();
    const open = drawer && !drawer.hidden;
    el.style.bottom = open ? `${Math.max(10, vp.bottom - drawer.getBoundingClientRect().top + 10)}px` : '';
    el.classList.toggle('compact', !!(open && smallScreen() && st.short));
    document.querySelectorAll('.tut-glow').forEach((n) => n.classList.remove('tut-glow'));
    if (st.target) document.querySelectorAll(st.target).forEach((n) => n.classList.add('tut-glow'));
  }

  function loop(now) {
    const dt = Math.min(0.1, (now - ui.last) / 1000);
    ui.last = now;
    const sim = ui.sim;
    if (!sim) return;
    // 打開員工、庫存、經營這些面板時自動暫停（可以在選單關掉）
    ui.panelPause = ui.autoPause && ['staff', 'stock', 'manage', 'social', 'goals', 'ledger'].includes(ui.tab);
    const blocked = !!ui.dialog || ui.panelPause;
    if (!blocked && ui.speed > 0 && !sim.over) {
      // 打烊、沒人在店裡時自動快轉
      const empty = !sim.isOpen && !sim.customers.length && !sim.staff.some((e) => e.state !== 'off') && !sim.activeEvents.length;
      const mult = empty ? 150 : ui.speed;
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
    if (ui.bossMode) updateBossControl(dt);
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
      if (ui.tut) renderTutorial();
      updateMusic();
    }
    ui.drawerT = (ui.drawerT || 0) + dt;
    if (ui.drawerT > 0.5 && ['staff', 'ledger', 'stock', 'social'].includes(ui.tab)) {
      ui.drawerT = 0;
      refreshDrawerLive();
    }
    ui.raf = requestAnimationFrame(loop);
  }

  // ───── 老闆下場：自己操控角色 ─────
  function setBossMode(on) {
    const s = ui.sim;
    ui.bossMode = on;
    if (on) {
      s.bossEnter();
      ui.view.setZoom(Math.max(ui.view.zoom, 1.7));
      if (ui.tab) openTab(ui.tab);
      toast(isTouch ? '🕹️ 用左下角的搖桿走路，或點地板走過去；靠近東西按右下角的按鈕互動' : '🕹️ WASD／方向鍵走路，也可以點地板走過去；靠近東西按 E 互動，走到街尾可以出門');
    } else {
      s.bossExit();
      ui.view.pan.set(0, 0, 0);
      ui.view.setZoom(1);
    }
    document.getElementById('boss-toggle').classList.toggle('on', on);
    document.getElementById('boss-toggle').textContent = on ? '🏪 回到經營' : '🕹️ 老闆下場';
    document.getElementById('joy').hidden = !(on && isTouch);
    renderBossHud();
  }

  function updateBossControl(dt) {
    const s = ui.sim;
    const b = s.boss;
    let ix = 0;
    let iy = 0;
    const k = ui.keys;
    if (k.has('a') || k.has('arrowleft')) ix -= 1;
    if (k.has('d') || k.has('arrowright')) ix += 1;
    if (k.has('w') || k.has('arrowup')) iy -= 1;
    if (k.has('s') || k.has('arrowdown')) iy += 1;
    if (ui.joy) {
      ix += ui.joy.x;
      iy += ui.joy.y;
    }
    let vx = 0;
    let vz = 0;
    if (ix || iy) {
      b.path = [];
      // 螢幕的上下左右換成地面方向（跟著鏡頭旋轉）
      const az = Math.PI / 4 + (ui.view.camRot * Math.PI) / 2;
      const right = [Math.cos(az), -Math.sin(az)];
      const fwd = [-Math.sin(az), -Math.cos(az)];
      vx = right[0] * ix - fwd[0] * iy;
      vz = right[1] * ix - fwd[1] * iy;
    } else if (b.path && b.path.length) {
      // 點地板：沿著路線走過去
      const n = b.path[0];
      const dx = n.x - b.x;
      const dz = n.z - b.z;
      if (Math.hypot(dx, dz) < 0.12) {
        b.x = n.x;
        b.z = n.z;
        b.path.shift();
      } else {
        vx = dx;
        vz = dz;
      }
    }
    s.moveBoss(vx, vz, dt);
    ui.bossT = (ui.bossT || 0) + dt;
    if (ui.bossT > 0.15) {
      ui.bossT = 0;
      const ts = s.bossTargets();
      ui.bossTarget = ts[0] || null;
      const btn = document.getElementById('boss-act');
      if (btn) {
        btn.hidden = !ui.bossTarget;
        const t = ui.bossTarget ? `${ui.bossTarget.actions.length > 1 ? '…' : ''}${ui.bossTarget.label}` : '';
        if (btn.textContent !== t) btn.textContent = t;
      }
      renderBossHud();
    }
  }

  function renderBossHud() {
    const el = document.getElementById('boss-hud');
    if (!el) return;
    const s = ui.sim;
    const b = s.boss;
    el.hidden = !ui.bossMode;
    if (!ui.bossMode) return;
    const st = b.away ? `${(window.BossFun.PLACES.find((p) => p.id === b.away.id) || {}).icon || ''} 出門中・還要 ${Math.max(0, Math.round(b.away.until - s.minute))} 分鐘` : b.lane ? '🧑‍🍳 親自顧櫃台中' : b.ride ? '🛵 騎機車中' : '🚶 巡店中';
    const html = `<b>👑 老闆</b><small>${st}</small><div class="ibar"><span>體力</span><div class="bar"><div class="bar-fill energy" style="width:${Math.round(b.energy)}%"></div></div><b>${Math.round(b.energy)}</b></div><button data-action="boss-city" ${b.away ? 'disabled' : ''}>🗺️ 出門</button>`;
    if (el.dataset.html !== html) {
      morph(el, html);
      el.dataset.html = html;
    }
  }

  // 按 E 或右下角按鈕：一個動作直接做，多個動作就跳出選單
  function bossInteract() {
    const ts = ui.sim.bossTargets().slice(0, 4);
    if (!ts.length) return toast('附近沒有可以互動的東西');
    if (ts.length === 1 && ts[0].actions.length === 1) return bossAction(ts[0], ts[0].actions[0][0]);
    ui.dialog = { type: 'boss-menu', targets: ts };
    renderDialog();
  }

  // 用總覽同一套按鈕處理員工的動作
  function clickAction(action, data) {
    const b = document.createElement('button');
    b.dataset.action = action;
    for (const [k, v] of Object.entries(data)) b.dataset[k] = v;
    b.hidden = true;
    app.appendChild(b);
    b.click();
    b.remove();
  }

  function bossAction(t, act) {
    const s = ui.sim;
    if (['chat', 'praise', 'treat', 'rest-now', 'scold'].includes(act)) return clickAction(act, { id: String(t.ref.id) });
    switch (act) {
      case 'boss-greet':
        s.bossGreet(t.ref);
        break;
      case 'boss-gift':
        if (!s.bossGift(t.ref)) toast('已經招待過了，或錢不夠', 'bad');
        break;
      case 'boss-mop':
        s.bossMop(t.ref);
        window.BossAudio.play('click');
        break;
      case 'boss-lane':
        if (s.bossTakeLane(t.ref)) toast(`🧑‍🍳 你站上了${t.obj.def.name}，客人過來就會幫他服務（離開就走開）`);
        break;
      case 'boss-leave-lane':
        s.bossLeaveLane();
        break;
      case 'boss-flyer':
        s.bossFlyer(t.ref);
        break;
      case 'boss-ride':
        s.boss.ride = true;
        toast('🛵 騎上機車了！只能在店外騎，靠近店門口按「下車」');
        break;
      case 'boss-unride':
        s.boss.ride = false;
        s.boss.z = Math.max(s.H, Math.round(s.boss.z));
        break;
      case 'boss-karen': {
        const c = t.ref;
        let ev = s.activeEvents.find((e) => e.karen === c);
        if (!ev) {
          s.karenScene(c);
          ev = s.activeEvents.find((e) => e.karen === c);
        }
        if (ev) {
          ui.dialog = { type: 'event', ev };
          renderDialog();
        }
        break;
      }
      case 'boss-rival': {
        const r = s.visitRival();
        if (r) {
          ui.dialog = { type: 'rival-visit', result: r };
          renderDialog();
        }
        break;
      }
      case 'boss-city':
        ui.dialog = { type: 'city' };
        renderDialog();
        break;
    }
  }

  // 背景音樂跟著店裡的狀況換曲
  function updateMusic() {
    const s = ui.sim;
    const q = s.customers.filter((c) => c.state === 'queue').length;
    ui.rush = ui.rush ? q > 2 : q >= 6;
    const wet = s.weather && (s.weather.id === 'rain' || s.weather.id === 'typhoon');
    const mood = !s.isOpen ? 'closed' : ui.rush ? 'rush' : wet ? 'rain' : s.hour < 11 ? 'morning' : s.hour < 17 ? 'afternoon' : 'night';
    window.BossAudio.setMood(mood);
  }

  // 速度：遊戲每秒經過幾分鐘
  const SPEEDS = [
    [0, '⏸', '暫停（空白鍵）'],
    [2, '▶', '正常（1）'],
    [5, '▶▶', '快（2）'],
    [12, '▶▶▶', '超快（3）'],
  ];

  // 上方資訊列：骨架只建一次，之後只改有變動的文字，不整塊重畫
  function renderTopbar() {
    const s = ui.sim;
    const el = document.getElementById('topbar');
    if (!el) return;
    if (!el.dataset.built) {
      el.dataset.built = '1';
      el.innerHTML = `
        <div class="tb-shop"><span class="tb-icon">${s.ind.icon}</span><div><b>${esc(s.shopName)}</b><small data-f="date"></small></div></div>
        <div class="tb-weather"><span data-f="wicon"></span><small data-f="wtext"></small><small class="tb-clean" data-f="clean" title="店裡的乾淨程度"></small></div>
        <div class="tb-clock" data-f="clockbox"><b data-f="clock"></b><small data-f="status"></small></div>
        <div class="tb-speed">${SPEEDS.map(([v, l, t]) => `<button data-action="speed" data-v="${v}" title="${t}">${l}</button>`).join('')}</div>
        <div class="tb-level" title="店家等級"><small data-f="lv"></small><div class="bar"><div class="bar-fill skill" data-f="lvbar"></div></div></div>
        <div class="tb-stat"><small>現金</small><b data-f="cash"></b></div>
        <div class="tb-stat"><small data-f="rcount"></small><b class="stars" data-f="rating"></b></div>
        <div class="tb-meter"><small data-f="mortext"></small><div class="bar"><div class="bar-fill morale" data-f="morbar"></div></div></div>
        <div class="tb-meter"><small data-f="jerktext"></small><div class="bar"><div class="bar-fill jerk" data-f="jerkbar"></div></div></div>
        <div class="tb-menu"><button data-action="advice" class="tb-advice" title="店長建議：現在最該處理的事">💡<i data-f="advn"></i></button><button data-action="music" title="背景音樂">🎵</button><button data-action="sfx" title="音效">🔊</button><button data-action="sys-menu" title="選單：存檔、匯出、畫質">☰</button><button data-action="quit" title="存檔並回主選單">🚪</button></div>`;
    }
    const f = (k) => el.querySelector(`[data-f="${k}"]`);
    const txt = (k, v) => {
      const n = f(k);
      if (n && n.textContent !== v) n.textContent = v;
    };
    const width = (k, v) => {
      const n = f(k);
      const w = `${Math.max(0, Math.min(100, v))}%`;
      if (n && n.style.width !== w) n.style.width = w;
    };
    const jerk = Math.round(s.jerk);
    const mor = Math.round(s.morale);
    txt('date', s.dateLabel);
    txt('wicon', s.weather.icon);
    txt('wtext', `${s.weather.name}${s.festival ? `・${s.festival.icon}${s.festival.name}` : ''}`);
    txt('clock', s.clockLabel);
    ui.adviceT = (ui.adviceT || 0) + 1;
    if (ui.adviceT % 8 === 1) ui.adviceList = s.advice();
    txt('advn', ui.adviceList && ui.adviceList.length ? String(ui.adviceList.length) : '');
    const cl = Math.round(s.cleanliness);
    txt('clean', `🧽 ${cl}`);
    f('clean').classList.toggle('neg', cl < 60);
    txt('status', ui.panelPause ? '⏸ 看面板中，暫停' : ui.nightSkip ? '⏩ 打烊中，快轉' : s.isOpen ? '營業中' : s.openToday ? '休息中' : '今天公休');
    f('clockbox').classList.toggle('open', s.isOpen);
    txt('lv', `Lv.${s.level}`);
    width('lvbar', s.levelProgress * 100);
    txt('cash', money(s.cash));
    f('cash').classList.toggle('neg', s.cash < 0);
    txt('rcount', `評價（${s.reviews.length}）`);
    txt('rating', `${s.rating.toFixed(1)} ★`);
    txt('mortext', `😊 員工心情 ${mor}`);
    width('morbar', mor);
    txt('jerktext', `😈 慣老闆指數 ${jerk}`);
    width('jerkbar', jerk);
    el.querySelectorAll('[data-action="speed"]').forEach((b) => b.classList.toggle('active', Number(b.dataset.v) === ui.speed));
    const mu = el.querySelector('[data-action="music"]');
    mu.classList.toggle('off', !window.BossAudio.prefs.music);
    const sf = el.querySelector('[data-action="sfx"]');
    sf.classList.toggle('off', !window.BossAudio.prefs.sfx);
    txt2(sf, window.BossAudio.prefs.sfx ? '🔊' : '🔇');
  }

  function txt2(n, v) {
    if (n.textContent !== v) n.textContent = v;
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
    // 需要馬上處理的事：稽查員來了、東西快賣完
    const acts = [];
    if (s.customers.some((c) => c.inspector && c.state !== 'leaving')) acts.push({ id: 'act-clean', icon: '🕵️', title: `${s.inspectorOrg}稽查中`, sub: s.cleanRushUntil > s.minute ? '大家正在打掃……' : '點這裡叫大家先打掃', action: 'rush-clean' });
    if (s.isOpen) {
      for (const g of s.ind.stock) {
        if (s.stock[g.id] < s.par[g.id] * 0.15 && !s.deliveries.some((d) => d.rush && d.items[g.id])) acts.push({ id: `act-st-${g.id}`, icon: g.icon, title: `${g.name}${s.stock[g.id] <= 0 ? '賣完了' : '快沒了'}`, sub: `點這裡叫急件 +${s.rushSize(g.id)}`, action: 'rush', gid: g.id });
      }
    }
    for (const a of acts) {
      ids.add(a.id);
      let b = el.querySelector(`[data-id="${a.id}"]`);
      if (!b) {
        b = document.createElement('button');
        b.className = 'inbox-item act';
        b.dataset.id = a.id;
        b.dataset.action = a.action;
        if (a.gid) b.dataset.gid = a.gid;
        b.innerHTML = `<span>${a.icon}</span><div><b></b><small></small></div>`;
        el.appendChild(b);
      }
      if (b.querySelector('b').textContent !== a.title) b.querySelector('b').textContent = a.title;
      if (b.querySelector('small').textContent !== a.sub) b.querySelector('small').textContent = a.sub;
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
    if (ui.bossMode && hit.kind === 'tile' && !s.boss.away) {
      const path = s.findPath(s.boss, { x: hit.x, z: hit.z });
      if (path) s.boss.path = path;
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
    if (el) {
      el.hidden = true;
      el.dataset.key = '';
      el.dataset.html = '';
    }
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
      const stateLabel = { off: '下班', arriving: '上班路上', working: e.task && e.task.type === 'clean' ? '🧹 打掃中' : e.task && e.task.obj ? `在${e.task.obj.def.name}` : '工作中', break: '休息中', leaving: '下班了' }[e.state];
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
      const st = { arriving: '走進來', queue: '排隊中', toLane: '走向櫃台', atLane: c.servedBy ? '正在被服務' : '等店員', toSeat: '找位子', eating: '用餐中', leaving: '離開', inspecting: '到處檢查中' }[c.state];
      if (c.supplier || c.inspector) {
        html = `
        <div class="insp-head">
          <div class="insp-face">${portraitSVG(c.look, 'neutral')}</div>
          <div><h3>${c.supplier ? '📦 送貨員' : `🕵️ ${s.inspectorOrg}稽查員`}</h3><small>${c.supplier ? (c.state === 'arriving' ? '送貨中' : '送完了') : st}</small>
          <p>${c.supplier ? Object.entries(c.delivery.items).map(([gid, n]) => `${s.stockGroup(gid).icon}${s.stockGroup(gid).name} ${n} 份`).join('、') : `正在看店裡乾不乾淨（目前 ${Math.round(s.cleanliness)} 分）`}</p></div>
          <button class="x" data-action="close-insp" aria-label="關閉">✕</button>
        </div>
        ${c.inspector ? `<div class="insp-actions"><button data-action="rush-clean">🧹 叫大家先打掃</button></div>` : ''}`;
      } else {
        const t = CUSTOMER_TYPES[c.type];
        const note = { student: '預算有限，對價格很敏感', office: '趕時間，沒什麼耐心，但不太在意價格', elderly: '很有耐心，喜歡跟店員聊天，但覺得貴就不來', family: '一般客人' }[c.type] || '外送平台的外送員，拿了就走';
        html = `
        <div class="insp-head">
          <div class="insp-face">${portraitSVG(c.look, c.waited > c.patience * 0.6 ? 'angry' : c.state === 'eating' ? 'happy' : 'neutral')}</div>
          <div><h3>${t ? `${t.icon} ${t.name}` : '🛵 外送員'}</h3><small>${st}・${note}</small><p>想要：${c.product.icon} ${c.product.name} × ${c.qty}</p></div>
          <button class="x" data-action="close-insp" aria-label="關閉">✕</button>
        </div>
        ${bar('耐心', 100 - (c.waited / c.patience) * 100, 'morale')}`;
      }
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
      if (d.cleanBoost) info.push('員工打掃變快');
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
      const key = `${kind}-${ref.id}`;
      if (el.dataset.key !== key) el.innerHTML = html;
      else morph(el, html);
      el.dataset.key = key;
      el.dataset.html = html;
    }
    el.hidden = false;
    fitInspector();
  }

  // 檢視面板不要蓋到底部的抽屜
  function fitInspector() {
    const insp = document.getElementById('inspector');
    const drawer = document.getElementById('drawer');
    if (!insp || insp.hidden) return;
    const vp = insp.parentElement.getBoundingClientRect();
    if (drawer && !drawer.hidden) {
      const d = drawer.getBoundingClientRect();
      insp.style.maxHeight = `${Math.max(140, d.top - vp.top - 20)}px`;
      insp.style.bottom = 'auto';
      insp.style.top = '10px';
    } else insp.style.maxHeight = '';
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
      el.dataset.key = '';
      fitInspector();
      return;
    }
    el.hidden = false;
    const fn = { build: drawerBuild, staff: drawerStaff, stock: drawerStock, manage: drawerManage, ledger: drawerLedger, reviews: drawerReviews, goals: drawerGoals, social: drawerSocial }[ui.tab];
    ui.drawerHtml = fn();
    const html = `<button class="x drawer-x" data-action="tab" data-tab="${ui.tab}" aria-label="關閉">✕</button>${ui.drawerHtml}`;
    const key = `${ui.tab}-${ui.tab === 'build' ? ui.buildCat : ui.tab === 'staff' ? ui.staffTab : ''}`;
    el.classList.toggle('tall', ui.tab === 'staff' || ui.tab === 'social');
    if (el.dataset.key === key) morph(el, html);
    else {
      el.innerHTML = html;
      el.dataset.key = key;
    }
    fitInspector();
  }

  function refreshDrawerLive() {
    // 數字一直在變：只更新有變的地方（按鈕和捲動位置都不動）；手指剛按下去的那一下先不動
    const el = document.getElementById('drawer');
    if (!el || el.hidden || performance.now() - (ui.drawerTouched || 0) < 400) return;
    const fn = { staff: drawerStaff, ledger: drawerLedger, stock: drawerStock, social: drawerSocial, goals: drawerGoals }[ui.tab];
    if (!fn) return;
    const html = fn();
    if (html === ui.drawerHtml) return;
    renderDrawer();
  }

  function drawerBuild() {
    const s = ui.sim;
    const cats = Object.keys(CAT_LABELS).filter((c) => CATALOG.some((d) => d.cat === c && (!d.industries || d.industries.includes(s.ind.id))));
    const items = CATALOG.filter((d) => d.cat === ui.buildCat && (!d.industries || d.industries.includes(s.ind.id)));
    const lotNext = LOTS[s.lotIdx + 1];
    return `
      <div class="drawer-tabs">
        ${cats.map((c) => `<button data-action="build-cat" data-cat="${c}" class="${ui.buildCat === c ? 'active' : ''}">${CAT_LABELS[c]}</button>`).join('')}
        <button data-action="build-cat" data-cat="lot" class="${ui.buildCat === 'lot' ? 'active' : ''}">店面與裝潢</button>
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
              </div>
              <h3>裝潢樣式 <small>地板買過一次就能隨時換回來</small></h3>
              <div class="style-row"><span>地板</span>${Object.entries(FLOORS)
                .map(([id, f]) => `<button class="style-chip ${s.style.floor === id ? 'active' : ''}" data-action="style" data-kind="floor" data-value="${id}" ${!s.ownedFloors.has(id) && s.cash < f.price ? 'disabled' : ''}><i style="background:${f.colors ? `linear-gradient(135deg, ${f.colors[0]} 50%, ${f.colors[1]} 50%)` : 'var(--bg)'}"></i>${f.name}<small>${s.ownedFloors.has(id) ? '已擁有' : money(f.price)}</small></button>`)
                .join('')}</div>
              <div class="style-row"><span>牆面 <small>$3,000</small></span>${WALLS.map((c) => `<button class="swatch ${(s.style.wall || WALLS[0]) === c ? 'active' : ''}" style="background:${c}" data-action="style" data-kind="wall" data-value="${c}" aria-label="牆面顏色"></button>`).join('')}</div>
              <div class="style-row"><span>招牌 <small>$5,000</small></span>${SIGNS.map((c) => `<button class="swatch ${(s.style.sign || s.ind.signColor) === c ? 'active' : ''}" style="background:${c}" data-action="style" data-kind="sign" data-value="${c}" aria-label="招牌顏色"></button>`).join('')}</div>`
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

  const STATE_LABEL = { off: '下班', arriving: '上班路上', working: '工作中', break: '☕ 休息中', leaving: '下班中' };
  function nowDoing(e) {
    if (e.state !== 'working') return STATE_LABEL[e.state];
    if (e.task && e.task.type === 'clean') return '🧹 打掃中';
    if (e.task && e.task.lane && e.task.lane.customer && e.task.lane.customer.state === 'atLane') return `🔥 ${e.task.obj ? e.task.obj.def.name : ''}服務中`;
    if (e.task && e.task.obj) return `在${e.task.obj.def.name}待命`;
    return '工作中';
  }

  // 員工：總覽（一眼看完所有人的狀態）、排班表、應徵者
  function drawerStaff() {
    const s = ui.sim;
    const tab = ui.staffTab || 'overview';
    const tabs = [['overview', `👥 總覽（${s.staff.length}）`], ['activity', '🎉 活動'], ['schedule', '📅 排班與崗位'], ['hire', `🙋 應徵者（${s.candidates.length}）`]];
    const head = `<div class="drawer-tabs">${tabs.map(([id, l]) => `<button data-action="staff-tab" data-v="${id}" class="${tab === id ? 'active' : ''}">${l}</button>`).join('')}</div>`;
    if (tab === 'schedule') return head + staffSchedule();
    if (tab === 'activity') return head + staffActivity();
    if (tab === 'hire') return head + staffHire();
    const here = s.staff.filter((e) => e.state === 'working' || e.state === 'break');
    const risk = s.staff.filter((e) => e.mood < 30 || e.lowMoodDays > 0);
    const tired = s.staff.filter((e) => e.state !== 'off' && e.energy < 30);
    const cell = (v, cls) => `<span class="st-bar ${v < 30 && cls !== 's' ? 'low' : ''}"><i class="${cls}" style="width:${Math.max(0, Math.min(100, v))}%"></i><b>${Math.round(v)}</b></span>`;
    return `${head}
      <div class="drawer-body">
        <div class="staff-sum">
          <span>🟢 在店裡 <b>${here.length}</b> 人</span>
          <span>😊 平均心情 <b>${Math.round(s.morale)}</b></span>
          <span>💵 行情時薪 <b>${money(s.marketWage)}</b></span>
          ${risk.length ? `<span class="neg">⚠️ 快撐不住：${risk.map((e) => esc(e.name)).join('、')}</span>` : ''}
          ${tired.length ? `<span class="warn">😮‍💨 很累：${tired.map((e) => esc(e.name)).join('、')}</span>` : ''}
        </div>
        <div class="staff-table">
          <div class="st-row st-head"><span>員工</span><span>現在</span><span>心情</span><span>精力</span><span>飽足</span><span>技能</span><span>時薪</span><span>動作</span></div>
          ${s.staff
            .map((e) => {
              const sh = s.shiftOf(e);
              const sel = ui.inspect && ui.inspect.ref === e;
              return `<div class="st-row ${sel ? 'sel' : ''} ${e.mood < 30 ? 'risk' : ''}">
                <button class="st-who" data-action="insp-staff" data-id="${e.id}"><span class="mini-face">${portraitSVG(e.look, moodOf(e))}</span><span><b>${e.rank && Fun.RANKS[e.rank] ? `${Fun.RANKS[e.rank].icon} ` : ''}${esc(e.name)}${e.rank && Fun.RANKS[e.rank] ? `<em class="rank">${Fun.RANKS[e.rank].name}</em>` : ''}</b><small>${e.traits.map((t) => TRAITS[t].name).join('・')}${e.hangoverDay === s.day ? '・🤢宿醉' : ''}</small><small>${sh ? `${hhmm(sh.start)}～${hhmm(sh.end)}` : '今天休假'}</small></span></button>
                <span class="st-now"><b>${nowDoing(e)}</b><small>${e.thought && e.thought.until > s.minute ? `💭 ${esc(e.thought.text)}` : `今天服務 ${e.served} 人`}</small></span>
                ${cell(e.mood, 'm')}${cell(e.energy, 'e')}${cell(e.hunger, 'h')}${cell(e.skill, 's')}
                <span class="st-wage"><button data-action="wage" data-id="${e.id}" data-d="-5" aria-label="減薪">－</button><b class="${e.wage < s.marketWage ? 'neg' : e.wage > s.marketWage * 1.05 ? 'pos' : ''}">${money(e.wage)}</b><button data-action="wage" data-id="${e.id}" data-d="5" aria-label="加薪">＋</button></span>
                <span class="st-act">
                  <button data-action="raise" data-id="${e.id}" title="加薪 $10（心情變好）">💵<small>加薪</small></button>
                  <button data-action="praise" data-id="${e.id}" ${e.praiseDay === s.day ? 'disabled' : ''} title="稱讚（一天一次）">👍<small>稱讚</small></button>
                  <button data-action="scold" data-id="${e.id}" class="warn" title="罵他（心情大跌、慣老闆指數上升）">😠<small>罵人</small></button>
                  <button data-action="rest-now" data-id="${e.id}" ${e.state !== 'working' ? 'disabled' : ''} title="叫他先去休息">☕<small>休息</small></button>
                  <button data-action="sendhome" data-id="${e.id}" ${e.state === 'off' || e.sentHomeDay === s.day ? 'disabled' : ''} title="今天先下班">🏠<small>下班</small></button>
                  <button data-action="fire" data-id="${e.id}" class="${ui.confirmFire === e ? 'danger' : ''}" title="依法資遣">${ui.confirmFire === e ? `確定？${money(s.severanceOf(e))}` : '📄<small>資遣</small>'}</button>
                  <button data-action="staff-open" data-id="${e.id}" class="${ui.staffOpen === e.id ? 'active' : ''}" title="排班、崗位、人際關係">⚙️<small>${ui.staffOpen === e.id ? '收起' : '設定'}</small></button>
                </span>
                ${ui.staffOpen === e.id ? staffDetail(e) : ''}
              </div>`;
            })
            .join('') || '<p class="muted">一個員工都沒有，店開不起來。到「應徵者」分頁招人！</p>'}
        </div>
        <p class="drawer-tip">點名字可以看詳細資料和人際關係；時薪＋／－一次 $5，減薪會讓員工不開心。</p>
      </div>`;
  }

  // 總覽裡展開的設定：班別、休假日、固定崗位、人際關係
  function staffDetail(e) {
    const s = ui.sim;
    const n = s.policy.shifts;
    const shiftNames = n === 1 ? ['全天'] : n === 2 ? ['早班', '晚班'] : ['早班', '晚班', '大夜'];
    const stations = s.objects.filter((o) => o.def.cat === 'station' && !o.def.selfServe);
    const rest = s.restCount(e);
    const weeks = Math.max(0, Math.floor((s.day - e.hiredDay) / 7));
    return `<div class="st-detail">
      <div class="st-detail-row">
        <label>班別 <select data-action="sched" data-id="${e.id}" data-key="shiftPref"><option value="auto" ${e.shiftPref === 'auto' ? 'selected' : ''}>自動</option>${shiftNames.map((nm, i) => `<option value="${i}" ${e.shiftPref === i ? 'selected' : ''}>${nm}</option>`).join('')}</select></label>
        <label>固定崗位 <select data-action="sched" data-id="${e.id}" data-key="post"><option value="" ${!e.post ? 'selected' : ''}>不限</option>${stations.map((o) => `<option value="${o.id}" ${e.post === o.id ? 'selected' : ''}>${o.def.icon} ${o.def.name}</option>`).join('')}</select></label>
        <span class="st-wage-set">時薪 <button data-action="wage" data-id="${e.id}" data-d="-10">－10</button><b>${money(e.wage)}</b><button data-action="wage" data-id="${e.id}" data-d="10">＋10</button><button data-action="wage-market" data-id="${e.id}" ${e.wage >= s.marketWage ? 'disabled' : ''}>調到行情 ${money(s.marketWage)}</button></span>
      </div>
      <div class="st-detail-row">
        <span>休假</span>
        ${WEEKDAYS.map((d, i) => {
          const p = s.plannedShift(e, i);
          const closed = s.policy.closedDay === i;
          return `<button class="sc-day ${p === null ? 'off' : 'on'}" data-action="rest-day" data-id="${e.id}" data-d="${i}" ${closed ? 'disabled' : ''}>${d}${closed ? '公休' : p === null ? '休' : ''}</button>`;
        }).join('')}
        <span class="${rest < 1 ? 'neg' : ''}">每週休 ${rest} 天${rest < 1 ? '（違法）' : ''}</span>
        ${Array.isArray(e.restDays) ? `<button class="link" data-action="rest-auto" data-id="${e.id}">改回輪休</button>` : ''}
      </div>
      <div class="st-detail-row">
        <span>互動</span>
        <button class="act-btn" data-action="chat" data-id="${e.id}" ${e.chatDay === s.day ? 'disabled' : ''}>💬 聊天談心</button>
        <button class="act-btn" data-action="treat" data-id="${e.id}" ${e.treatDay === s.day ? 'disabled' : ''}>🧋 請喝飲料 $65</button>
        <button class="act-btn" data-action="train" data-id="${e.id}" ${e.trainWeek === s.week || s.cash < s.trainCost || e.skill >= 100 ? 'disabled' : ''}>🎓 送去上課 $3,000<small>${e.trainWeek === s.week ? '這週上過了' : '技能 +10'}</small></button>
        ${e.rank !== 'leader' ? `<button class="act-btn" data-action="promote" data-id="${e.id}" data-rank="leader">🎖️ 升組長 +$${Fun.RANKS.leader.wage}</button>` : ''}
        ${e.rank !== 'manager' ? `<button class="act-btn" data-action="promote" data-id="${e.id}" data-rank="manager">👑 升店長 +$${Fun.RANKS.manager.wage}</button>` : ''}
        ${e.rank ? `<button class="act-btn warn" data-action="demote" data-id="${e.id}">⬇️ 降職</button>` : ''}
      </div>
      <div class="st-detail-row muted">
        <span>${e.traits.map((t) => `${TRAITS[t].name}：${TRAITS[t].desc}`).join('；')}</span>
        <span>到職 ${weeks} 週・資遣費約 ${money(s.severanceOf(e))}</span>
      </div>
      ${relationsHtml(e)}
    </div>`;
  }

  // 員工活動：挑活動、挑誰參加
  function staffActivity() {
    const s = ui.sim;
    if (!ui.actPick) ui.actPick = new Set(s.staff.map((e) => e.id));
    for (const id of [...ui.actPick]) if (!s.staff.some((e) => e.id === id)) ui.actPick.delete(id);
    const pick = s.staff.filter((e) => ui.actPick.has(e.id));
    const done = s.lastActivity === s.day;
    const traitName = (ids) => ids.map((t) => TRAITS[t].name).join('、');
    return `<div class="drawer-body">
      <div class="act-people"><small>誰要參加（點頭像切換）</small>
        ${s.staff.map((e) => `<button class="act-who ${ui.actPick.has(e.id) ? 'on' : ''}" data-action="act-who" data-id="${e.id}"><span class="mini-face">${portraitSVG(e.look, moodOf(e))}</span>${esc(e.name)}</button>`).join('')}
        <button class="link" data-action="act-all">${pick.length === s.staff.length ? '全部取消' : '全選'}</button>
      </div>
      ${done ? '<p class="calc">今天已經辦過活動了，明天再來吧。</p>' : ''}
      <div class="act-list">
        ${(Fun.ACTIVITIES || [])
          .filter((a) => s.activityAvailable(a))
          .map((a) => {
            const cost = s.activityCost(a, pick.length);
            const likers = pick.filter((e) => e.traits.some((t) => a.likes.includes(t))).map((e) => e.name);
            const haters = pick.filter((e) => e.traits.some((t) => a.dislikes.includes(t))).map((e) => e.name);
            return `<div class="act-card ${a.forced ? 'forced' : ''}">
              <div class="act-head"><span class="act-icon">${a.icon}</span><div><b>${a.name}</b><small>${a.desc}</small></div></div>
              <div class="act-meta">
                <span>${a.forced ? '😈 心情大跌・慣老闆指數上升' : `😊 心情 +${a.mood}・🤝 交情 +${a.rel}`}${a.energy > 0 ? `・⚡ 精力 +${a.energy}` : a.energy < 0 ? `・⚡ 精力 ${a.energy}` : ''}${a.hangover ? `・🤢 可能宿醉` : ''}</span>
                ${a.likes.length ? `<span>喜歡：${traitName(a.likes)}${likers.length ? `（${likers.map(esc).join('、')} 會超開心）` : ''}</span>` : ''}
                ${a.dislikes.length ? `<span class="neg">不太喜歡：${traitName(a.dislikes)}${haters.length ? `（${haters.map(esc).join('、')}）` : ''}</span>` : ''}
              </div>
              <button class="${a.forced ? 'warn' : 'primary'}" data-action="activity" data-id="${a.id}" ${done || !pick.length || s.cash < cost ? 'disabled' : ''}>舉辦（${money(cost)}）</button>
            </div>`;
          })
          .join('')}
      </div>
      <p class="drawer-tip">一起玩過的人交情會變好，本來處不來的人也有機會和好；一天只能辦一次。活動費用記在帳本的「員工福利」。</p>
    </div>`;
  }

  function staffSchedule() {
    const s = ui.sim;
    const n = s.policy.shifts;
    const shiftNames = n === 1 ? ['全天'] : n === 2 ? ['早班', '晚班'] : ['早班', '晚班', '大夜'];
    const stations = s.objects.filter((o) => o.def.cat === 'station' && !o.def.selfServe);
    const count = {};
    return `<div class="drawer-body">
      <div class="sched-table">
        <div class="sc-row sc-head"><span>員工</span><span>班別</span>${WEEKDAYS.map((d, i) => `<span class="${s.policy.closedDay === i ? 'muted' : ''}">${d}</span>`).join('')}<span>每週休</span><span>固定崗位</span></div>
        ${s.staff
          .map((e) => {
            const rest = s.restCount(e);
            return `<div class="sc-row">
              <span class="sc-who"><span class="mini-face">${portraitSVG(e.look, moodOf(e))}</span><b>${esc(e.name)}</b></span>
              <select data-action="sched" data-id="${e.id}" data-key="shiftPref">
                <option value="auto" ${e.shiftPref === 'auto' ? 'selected' : ''}>自動</option>
                ${shiftNames.map((nm, i) => `<option value="${i}" ${e.shiftPref === i ? 'selected' : ''}>${nm}</option>`).join('')}
              </select>
              ${WEEKDAYS.map((d, i) => {
                const p = s.plannedShift(e, i);
                const closed = s.policy.closedDay === i;
                return `<button class="sc-day ${p === null ? 'off' : 'on'}" data-action="rest-day" data-id="${e.id}" data-d="${i}" ${closed ? 'disabled' : ''} title="點一下切換上班／休假">${closed ? '公休' : p === null ? '休' : p === 'auto' ? '班' : shiftNames[p] ? shiftNames[p][0] : '班'}</button>`;
              }).join('')}
              <span class="${rest < 1 ? 'neg' : rest < 2 ? 'warn' : ''}">${rest} 天${rest < 1 ? '⚠️' : ''}${Array.isArray(e.restDays) ? `<button class="link" data-action="rest-auto" data-id="${e.id}">改回輪休</button>` : ''}</span>
              <select data-action="sched" data-id="${e.id}" data-key="post">
                <option value="" ${!e.post ? 'selected' : ''}>不限（哪裡忙去哪）</option>
                ${stations
                  .map((o) => {
                    count[o.def.id] = (count[o.def.id] || 0) + 1;
                    return `<option value="${o.id}" ${e.post === o.id ? 'selected' : ''}>${o.def.icon} ${o.def.name}${stations.filter((x) => x.def.id === o.def.id).length > 1 ? ` #${count[o.def.id]}` : ''}</option>`;
                  })
                  .join('')}
              </select>
            </div>`;
          })
          .join('')}
      </div>
      <p class="drawer-tip">點星期幾可以切換上班／休假（改了今天馬上生效）。勞基法規定每 7 天至少要有 1 天例假、1 天休息日，每週休不到 1 天就違法；休 2 天最好。<br>班別和一天幾班在「⚙️ 經營」設定；固定崗位的員工只會在那台設備工作。</p>
    </div>`;
  }

  function staffHire() {
    const s = ui.sim;
    return `<div class="drawer-body">
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
      <p class="drawer-tip">應徵者每週換一批・刊登徵才 $1,500・時薪不能低於最低時薪 $${MIN_WAGE}。</p>
    </div>`;
  }

  // 小編：看時事、拼一篇貼文、看網友留言
  function drawerSocial() {
    const s = ui.sim;
    const t = s.social.trend;
    const P = ui.post;
    const bodies = Fun.POST_BODIES.filter((b) => !b.trend || b.trend === (t && t.id));
    if (!P.body || !bodies.some((b) => b.id === P.body)) P.body = (bodies.find((b) => b.trend) || bodies[0]).id;
    const h = Fun.POST_HOOKS.find((x) => x.id === P.hook);
    const b = Fun.POST_BODIES.find((x) => x.id === P.body);
    const en = Fun.POST_ENDINGS.find((x) => x.id === P.end);
    const preview = s.fillPost(`${h.text}${b.text}\n${en.text}`);
    const heat = s.trendHeat;
    const chips = (list, key) => list.map((x) => `<button class="post-chip ${P[key] === x.id ? 'active' : ''} ${x.trend ? 'trend' : ''} ${x.risky ? 'risky' : ''}" data-action="post-part" data-key="${key}" data-value="${x.id}">${x.trend ? '🔥 ' : ''}${esc(s.fillPost(x.text)).slice(0, 40)}${s.fillPost(x.text).length > 40 ? '…' : ''}${x.cost ? `<small>（$${x.cost}）</small>` : ''}</button>`).join('');
    return `
      <div class="drawer-body two-col">
        <div>
          <div class="trend-card">
            <small>本週時事</small>
            <b>${t ? `${t.icon} ${t.name}` : '—'}</b>
            <p>${t ? t.desc : ''}</p>
            <div class="ibar"><span>熱度</span><div class="bar"><div class="bar-fill jerk" style="width:${Math.min(100, (heat / 1.6) * 100)}%"></div></div><b class="heat-label">${heat >= 1.2 ? '正熱' : heat >= 0.7 ? '還行' : '退燒'}</b></div>
            ${t && t.risky ? '<p class="neg">⚠️ 這是敏感話題，蹭不好會被罵。</p>' : ''}
          </div>
          <h3>寫一篇貼文 <small>${s.canPost ? '一天可以發一篇' : '今天已經發過了，明天再來'}</small></h3>
          <div class="post-step"><small>① 開頭</small><div class="post-chips">${chips(Fun.POST_HOOKS, 'hook')}</div></div>
          <div class="post-step"><small>② 內容（🔥 是蹭時事）</small><div class="post-chips">${chips(bodies, 'body')}</div></div>
          <div class="post-step"><small>③ 結尾</small><div class="post-chips">${chips(Fun.POST_ENDINGS, 'end')}</div></div>
          <button class="primary post-inline" data-action="post" ${s.canPost ? '' : 'disabled'}>📤 發文（預覽在下面）</button>
        </div>
        <div>
          <div class="post-card">
            <div class="post-head"><span class="post-avatar" style="background:${s.style.sign || s.ind.signColor}">${s.ind.icon}</span><div><b>${esc(s.shopName)}</b><small>粉絲 ${s.social.followers.toLocaleString()}・剛剛</small></div></div>
            <p class="post-text">${esc(preview).replace(/\n/g, '<br>')}</p>
            <button class="primary" data-action="post" ${s.canPost ? '' : 'disabled'}>📤 發文</button>
          </div>
          <h3>之前的貼文</h3>
          <div class="post-list">
            ${s.social.posts
              .map(
                (p) => `<div class="post-old ${p.tier}">
                  <small>第 ${p.day} 天${p.trend ? `・蹭「${esc(p.trend)}」` : ''}・${{ viral: '🚀 爆紅', good: '👍 不錯', meh: '😐 普通', flop: '🧊 好冷', fire: '🔥 炎上' }[p.tier]}</small>
                  <p>${esc(p.text).replace(/\n/g, '<br>')}</p>
                  <small>❤️ ${p.likes.toLocaleString()}・🔁 ${p.shares.toLocaleString()}・粉絲 ${p.gain >= 0 ? '+' : ''}${p.gain.toLocaleString()}</small>
                  ${p.fire ? `<p class="neg">🔥 ${esc(p.fire)}</p>` : ''}
                  <div class="post-comments">${p.comments.map((c) => `<span>💬 ${esc(c)}</span>`).join('')}</div>
                </div>`
              )
              .join('') || '<p class="muted">還沒發過文。小訣竅：蹭剛出來的時事最紅，同一種內容一直發大家會膩。</p>'}
          </div>
        </div>
      </div>`;
  }

  function drawerStock() {
    const s = ui.sim;
    const cl = Math.round(s.cleanliness);
    const h = s.hygiene.last;
    return `
      <div class="drawer-body two-col">
        <div>
          <h3>食材庫存 <small>每天開門前送貨；急件約 40 分鐘到，貴三成</small></h3>
          <div class="stock-list">
            ${s.ind.stock
              .map((g) => {
                const left = Math.max(0, s.stock[g.id]);
                const par = s.par[g.id];
                const inc = s.incoming(g.id);
                const pct = Math.min(100, (left / Math.max(1, par)) * 100);
                const step = Math.max(5, Math.round((par * 0.1) / 5) * 5);
                const rushCost = Math.round(s.rushSize(g.id) * s.unitCost(g) * 1.3 + 300);
                const names = g.products.map((id) => s.ind.products.find((p) => p.id === id)).filter(Boolean).map((p) => p.icon + p.name).join(' ');
                return `<div class="stock-row ${left <= 0 ? 'out' : pct < 15 ? 'low' : ''}">
                  <span class="stock-icon">${g.icon}</span>
                  <div class="stock-info">
                    <b>${g.name}</b><small class="muted">${names}</small>
                    <div class="bar"><div class="bar-fill ${pct < 15 ? 'jerk' : pct < 40 ? 'energy' : 'morale'}" style="width:${pct}%"></div></div>
                    <small>剩 <b>${left}</b> 份${inc ? `・送貨中 ${inc}` : ''}・昨天用掉 ${s.lastUsage[g.id] ?? '—'}・每份 ${money(s.unitCost(g))}・${g.spoil ? `隔夜報廢 ${Math.round(g.spoil * 100)}%` : '不會過期'}</small>
                  </div>
                  <div class="stock-ctl">
                    <small>每天進貨到</small>
                    <span class="price-ctl"><button data-action="par" data-id="${g.id}" data-d="${-step}">－</button><b>${par}</b><button data-action="par" data-id="${g.id}" data-d="${step}">＋</button></span>
                    <button data-action="rush" data-id="${g.id}" ${s.cash < rushCost ? 'disabled' : ''}>🛵 急件 +${s.rushSize(g.id)}<small>${money(rushCost)}</small></button>
                  </div>
                </div>`;
              })
              .join('')}
          </div>
          ${toggle('autoStock', s.policy.autoStock, '依昨天的用量自動調整進貨量（多抓 15%）', '自己決定每天進多少貨', true)}
          ${s.lastDay && s.lastDay.waste ? `<p class="calc">昨晚報廢了 ${money(s.lastDay.waste)} 的食材。</p>` : ''}
          ${s.lastDay && s.lastDay.soldOut ? `<p class="calc neg">昨天有 ${s.lastDay.soldOut} 位客人因為賣完了離開。</p>` : ''}
        </div>
        <div>
          <h3>清潔與衛生 <small>店裡越乾淨，客人越願意進來</small></h3>
          <div class="clean-card">
            <div class="clean-big ${cl < 60 ? 'neg' : cl >= 80 ? 'pos' : ''}"><b>${cl}</b><small>乾淨程度</small></div>
            <div class="clean-detail">
              <div class="ibar"><span>髒污</span><div class="bar"><div class="bar-fill jerk" style="width:${Math.min(100, s.dirt.length * 4)}%"></div></div><b>${s.dirt.length}</b></div>
              <div class="ibar"><span>油垢</span><div class="bar"><div class="bar-fill hunger" style="width:${Math.min(100, (s.grime / 45) * 100)}%"></div></div><b>${Math.round(s.grime)}</b></div>
              <small class="muted">員工沒客人時會自己拖地、擦桌子；油垢只有大掃除清得掉。</small>
            </div>
          </div>
          <div class="insp-actions">
            <button data-action="rush-clean">🧹 叫大家先打掃</button>
            <button data-action="deep-clean" ${s.cash < s.deepCleanCost ? 'disabled' : ''}>🧽 請清潔公司大掃除（${money(s.deepCleanCost)}）</button>
          </div>
          <div class="toggles">
            ${toggle('closingClean', s.policy.closingClean, '打烊後最後一班留下來打掃半小時（照算薪水）', '打烊就走，地上的髒污留到明天', true)}
            ${toggle('cleaner', s.policy.cleaner, '請外包清潔阿姨（每天 $900）', '沒有請清潔人員', true)}
          </div>
          <p class="calc">${h ? `上次${s.inspectorOrg}稽查（第 ${h.day} 天）：<b class="${h.fine || h.grade === '限期改善' ? 'neg' : 'pos'}">${h.grade}</b>（${h.clean} 分）${h.fine ? `，罰 ${money(h.fine)}` : ''}` : `${s.inspectorOrg}會不定期來稽查：80 分以上「優」，60 分以下會被要求限期改善，複查還是不及格就要罰錢。`}</p>
          ${s.hygiene.warned ? '<div class="alert bad">⚠️ 收到限期改善通知，稽查員這幾天會回來複查！</div>' : ''}
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
          <h3>勞健保與稅</h3>
          ${toggle('insurance', s.policy.insurance, `幫員工保勞健保、提繳勞退（雇主負擔約薪資的 ${Math.round((INS.labor + INS.health + INS.pension) * 100)}%）`, '不幫員工保勞健保（違法）')}
          <p class="calc">勞保＋就保約 ${(INS.labor * 100).toFixed(1)}%・健保約 ${(INS.health * 100).toFixed(1)}%・勞退 ${(INS.pension * 100).toFixed(0)}%<br>營業稅：${s.taxStatus ? TAX_LABEL[s.taxStatus] : '第一週結算時由國稅局核定'}</p>
          <h3>銀行</h3>
          <p class="calc">借款 ${money(s.loan)}（月息 2%，上限 $600,000）</p>
          <div class="insp-actions"><button data-action="borrow">借 $100,000</button><button data-action="repay" ${s.loan <= 0 ? 'disabled' : ''}>還 $100,000</button></div>
        </div>
        <div>
          <h3>菜單與價格 <small>建議價會跟著物價漲</small></h3>
          <div class="price-list">
            ${s.ind.products
              .map((pr) => {
                if (pr.rd && !s.recipes.has(pr.id)) {
                  const can = s.level >= (pr.lv || 1);
                  return `<div class="price-row locked"><span class="price-name">🧪 ${pr.icon} ${pr.name}</span><button data-action="research" data-id="${pr.id}" ${!can || s.cash < pr.rd ? 'disabled' : ''}>${can ? `研發 ${money(pr.rd)}` : `Lv.${pr.lv} 才能研發`}</button><small>新品・建議價 $${Math.round((pr.price * s.idx.cpi) / 5) * 5}・菜單越豐富，客人越多</small></div>`;
                }
                const sug = Math.round((pr.price * s.idx.cpi) / 5) * 5;
                const cur = s.prices[pr.id];
                const margin = Math.round((1 - (pr.cost * s.idx.cpi * s.costMult.materials) / cur) * 100);
                const g = s.ingOf[pr.id];
                const avail = s.availableProducts().some((x) => x.id === pr.id) || !s.menu[pr.id];
                return `<div class="price-row ${s.menu[pr.id] ? '' : 'off'}">
                  <label class="price-name"><input type="checkbox" data-action="menu" data-id="${pr.id}" ${s.menu[pr.id] ? 'checked' : ''} /> ${pr.icon} ${pr.name}</label>
                  <span class="price-ctl"><button data-action="price" data-id="${pr.id}" data-d="-5">－</button><b class="${cur > sug * 1.1 ? 'neg' : cur < sug * 0.9 ? 'pos' : ''}">$${cur}</b><button data-action="price" data-id="${pr.id}" data-d="5">＋</button></span>
                  <small>建議 $${sug}・毛利 ${margin}%${avail ? '' : '・<span class="neg">沒有設備</span>'}${g && s.stock[g.id] <= 0 ? '・<span class="neg">賣完了</span>' : ''}</small>
                </div>`;
              })
              .join('')}
          </div>
          <p class="drawer-tip">比建議價貴 10% 以上，客人會明顯變少，評價也會變差；學生和長輩對價格特別敏感，上班族比較不在意。${s.promoOn ? `<br>🎉 九折優惠到第 ${s.promo.until} 天。` : ''}</p>
        </div>
      </div>`;
  }

  // neutral：關掉不是違法或壞事，不用標紅色
  function toggle(key, on, onLabel, offLabel, neutral = false) {
    return `<button class="toggle ${on ? 'on' : 'off'} ${neutral ? 'neutral' : ''}" data-action="toggle" data-key="${key}"><span class="knob"></span><span>${on ? onLabel : neutral ? offLabel : `<span class="neg">${offLabel}</span>`}</span></button>`;
  }

  function ledgerRows(L) {
    return [
      ['營收', L.revenue],
      ['食材進貨', -L.materials],
      ['薪資', -L.wages],
      ['勞保＋健保（雇主負擔）', -((L.labor || 0) + (L.health || 0))],
      ['勞退提繳 6%', -(L.pension || 0)],
      ['房租', -L.rent],
      ['水電', -L.utilities],
      ['清潔', -(L.cleaning || 0)],
      ['員工福利（活動、飲料、上課）', -(L.welfare || 0)],
      ['營業稅', -(L.tax || 0)],
      ['罰鍰', -(L.fines || 0)],
      ['利息', -L.interest],
      ['事件', L.events],
      ['分店', L.branches || 0],
      ['設備與其他', L.other],
    ].filter(([, v]) => Math.round(v) !== 0);
  }

  function drawerLedger() {
    const s = ui.sim;
    const L = s.ledger;
    const rows = ledgerRows(L);
    const net = rows.reduce((a, [, v]) => a + v, 0);
    const hist = s.history.slice(-10);
    const maxAbs = Math.max(1, ...hist.map((h) => Math.abs(h.profit)));
    return `
      <div class="drawer-body two-col">
        <div>
          <h3>這週到目前為止 <small>第 ${s.week} 週</small></h3>
          <table class="ledger">${rows.map(([k, v]) => `<tr><th>${k}</th><td class="${v < 0 ? 'neg' : 'pos'}">${signedMoney(v)}</td></tr>`).join('')}
            <tr class="total"><th>合計</th><td class="${net < 0 ? 'neg' : 'pos'}">${signedMoney(net)}</td></tr></table>
          ${L.waste ? `<p class="calc">食材進貨裡有 ${money(L.waste)} 是過期報廢掉的。</p>` : ''}
          <p class="calc">🧾 ${s.taxStatus ? TAX_LABEL[s.taxStatus] : '營業稅在週末結算'}；營業稅每週結算一次。</p>
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
          <ul class="news-list">${s.news.map((n) => `<li>${n}</li>`).join('')}${(s.headlines || []).map((h) => `<li>${esc(h)}</li>`).join('')}</ul>
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
          <h3>附近的競爭 <small>評價、價格、乾淨程度決定客人選誰</small></h3>
          ${rivalCard()}
          <h3>分店 <small>${lv >= 5 ? '每間分店可以調時薪、定價、人手和改裝' : '店家 Lv.5 才能開分店'}</small></h3>
          <div class="branch-list">
            ${s.branches.map((b, i) => branchCard(b, i)).join('') || '<p class="muted">還沒有分店。</p>'}
          </div>
          ${canBranch ? `<button class="primary" data-action="open-branch" ${s.cash < s.branchCost ? 'disabled' : ''}>在${DISTRICTS.find((d) => !s.branches.some((b) => b.district === d))}開分店（${money(s.branchCost)}）</button>` : ''}
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

  function rivalCard() {
    const s = ui.sim;
    const r = s.rival;
    const status = !r
      ? '<p class="calc">附近還沒有同業。生意做起來之後，可能會有人來開店搶客人。</p>'
      : r.closed
        ? `<p class="calc">🏳️ 隔壁的「${esc(r.name)}」已經收起來了。</p>`
        : `<div class="rival-row"><span class="rival-sign" style="background:${r.color}">${esc(r.name)}</span><div class="bar"><div class="bar-fill jerk" style="width:${Math.round(r.strength * 100)}%"></div></div><small>搶走約 ${Math.round(r.strength * 22 + (s.day - r.opened < 10 ? 12 : 0))}% 的客人</small></div>`;
    return `<div class="rival-card">${status}
      <div class="insp-actions">
        <button data-action="flyers" ${s.cash < 3000 ? 'disabled' : ''}>📄 發傳單（$3,000）</button>
        <button data-action="promo" ${s.promoOn ? 'disabled' : ''}>🎉 九折優惠一週${s.promoOn ? '（進行中）' : ''}</button>
        <button data-action="loyalty" ${s.loyalty || s.cash < 8000 ? 'disabled' : ''}>💳 ${s.loyalty ? '已經有集點卡' : '印集點卡（$8,000）'}</button>
        <button data-action="open-hub" data-id="schemes">🕵️ 陰謀計畫</button>
        <button data-action="open-hub" data-id="collabs">🤝 聯名合作</button>
      </div>
      ${s.collabs.length ? `<p class="calc">進行中的聯名：${s.collabs.map((c) => `${c.icon}${esc(c.name)}（到第 ${c.until} 天）`).join('、')}</p>` : ''}
      ${r && !r.closed && r.grudge ? `<p class="calc neg">對方記仇程度：${'😤'.repeat(Math.min(5, r.grudge))}</p>` : ''}</div>`;
  }

  // 分店：小插圖＋可以調整的設定
  function branchArt(b) {
    const s = ui.sim;
    const color = s.ind.signColor;
    const mood = b.morale >= 65 ? '😊' : b.morale >= 40 ? '😐' : '😫';
    const people = Array.from({ length: Math.min(6, b.staff) }, (_, i) => `<text x="${34 + i * 18}" y="96" font-size="15">${mood}</text>`).join('');
    const plants = Array.from({ length: b.reno }, (_, i) => `<text x="${i % 2 ? 136 : 6}" y="${108 - Math.floor(i / 2) * 18}" font-size="14">🪴</text>`).join('');
    const guests = Math.round(Math.max(0, (b.rating - 2.5) * 2));
    const queue = Array.from({ length: guests }, (_, i) => `<circle cx="${150 - i * 9}" cy="116" r="3.5" fill="#5a4a3a"/>`).join('');
    return `<svg viewBox="0 0 160 124" class="branch-art" aria-hidden="true">
      <rect width="160" height="124" fill="#cfdde8"/>
      <rect x="10" y="14" width="140" height="104" fill="#efe7da"/>
      <rect x="14" y="20" width="132" height="22" rx="3" fill="${color}"/>
      <text x="80" y="36" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">${esc(s.shopName)}・${esc(b.district)}店</text>
      ${Array.from({ length: 11 }, (_, i) => `<rect x="${12 + i * 12.4}" y="44" width="12.4" height="8" fill="${i % 2 ? '#ffffff' : color}"/>`).join('')}
      <rect x="22" y="58" width="116" height="52" fill="${b.rating >= 3.5 ? '#fff1c9' : '#e6e1d6'}" stroke="#9a8572" stroke-width="2"/>
      ${people}${plants}${queue}
    </svg>`;
  }

  function branchCard(b, i) {
    const s = ui.sim;
    const seg = (key, opts) => `<div class="segmented tiny">${opts.map(([v, l]) => `<button data-action="branch-set" data-i="${i}" data-key="${key}" data-value="${v}" class="${b[key] === v ? 'active' : ''}">${l}</button>`).join('')}</div>`;
    const hist = b.hist || [];
    const max = Math.max(1, ...hist.map((v) => Math.abs(v)));
    const info = DISTRICT_INFO[b.district] || { traffic: 1, rent: 1 };
    return `<div class="branch-card">
      ${branchArt(b)}
      <div class="branch-body">
        <div class="branch-title"><b>${esc(b.district)}店</b><small>人潮 ${info.traffic >= 1.05 ? '多' : info.traffic <= 0.92 ? '少' : '普通'}・房租 ${info.rent >= 1.05 ? '貴' : info.rent <= 0.85 ? '便宜' : '普通'}</small></div>
        <div class="branch-stats">
          <span>★ ${b.rating.toFixed(1)}</span><span>士氣 ${Math.round(b.morale)}</span><span>上週 <b class="${b.last < 0 ? 'neg' : 'pos'}">${signedMoney(b.last)}</b></span>
        </div>
        ${hist.length ? `<div class="spark mini">${hist.map((v) => `<div class="spark-col"><i class="${v < 0 ? 'neg' : 'pos'}" style="height:${(Math.abs(v) / max) * 100}%"></i></div>`).join('')}</div>` : ''}
        <label>時薪 ${seg('wage', [['low', '低於行情'], ['market', '行情價'], ['high', '高於行情']])}</label>
        <label>定價 ${seg('price', [['cheap', '便宜'], ['normal', '一般'], ['premium', '高價']])}</label>
        <div class="branch-ctl">
          <span>人手 <span class="price-ctl"><button data-action="branch-staff" data-i="${i}" data-d="-1">－</button><b class="${b.staff < s.branchNeed ? 'neg' : ''}">${b.staff}</b><button data-action="branch-staff" data-i="${i}" data-d="1">＋</button></span><small>建議 ${s.branchNeed} 人</small></span>
          <button data-action="branch-reno" data-i="${i}" ${b.reno >= 3 || s.cash < s.renoCost ? 'disabled' : ''}>🔨 改裝 ${b.reno}/3（${money(s.renoCost)}）</button>
          <button data-action="sell-branch" data-i="${i}" class="warn">頂讓</button>
        </div>
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
           <li>🕹️ <b>老闆下場</b>：右下角的按鈕（或 G 鍵）可以自己操控老闆，在店裡和街上走動、顧櫃台、拖地、發傳單、騎機車、出門去夜市和廟裡</li>
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
         ${r.choice.tip ? `<div class="tip">📘 <strong>法律小知識：</strong>${r.choice.tip}</div>` : ''}
         <button class="primary" data-action="close-dialog">回去顧店（Enter）</button>`
      );
    } else if (d.type === 'week') {
      inner = weekReport(d.report);
    } else if (d.type === 'boss-menu') {
      inner = `<div class="card menu-card boss-menu">
        <button class="x" data-action="close-dialog" aria-label="關閉">✕</button>
        <h2>要做什麼？</h2>
        ${d.targets.map((t, i) => `<h3>${esc(t.label)}</h3><div class="boss-menu-list">${t.actions.map(([a, l]) => `<button data-action="boss-do" data-t="${i}" data-act="${a}">${l}</button>`).join('')}</div>`).join('')}
      </div>`;
    } else if (d.type === 'city') {
      const b = s.boss;
      inner = `<div class="card menu-card city-card">
        <button class="x" data-action="close-dialog" aria-label="關閉">✕</button>
        <h2>🗺️ 出門去哪？</h2>
        <p class="calc">出門會花遊戲時間，這段時間老闆不在店裡（員工照常營業）。現在 ${s.clockLabel}・老闆體力 ${Math.round(b.energy)}</p>
        <div class="city-map">
          <div class="city-home" style="left:46%;top:58%">🏪<small>你的店</small></div>
          ${window.BossFun.PLACES.map((p) => `<button class="city-pin ${p.hub ? 'hub' : ''}" style="left:${p.x}%;top:${p.y}%" data-action="${p.hub ? 'open-hub' : 'go-out'}" data-id="${p.hub || p.id}" ${b.away || s.cash < p.cost ? 'disabled' : ''}><span>${p.icon}</span><b>${p.name}</b><small>${p.hub ? (p.hub === 'schemes' ? '陰謀計畫' : '聯名合作') : `${p.minutes} 分鐘${p.cost ? `・${money(p.cost)}` : ''}`}</small></button>`).join('')}
        </div>
        <div class="city-list">${window.BossFun.PLACES.map((p) => `<div><b>${p.icon} ${p.name}</b>：${p.desc}</div>`).join('')}</div>
      </div>`;
    } else if (d.type === 'schemes') {
      const r = s.rival;
      const L = window.BossFun.LEGAL_LABEL;
      inner = `<div class="card menu-card plot-card">
        <button class="x" data-action="close-dialog" aria-label="關閉">✕</button>
        <h2>🕵️ 徵信社：對付隔壁</h2>
        ${
          !r || r.closed
            ? '<p class="calc">附近目前沒有競爭對手，徵信社老闆說：「沒有敵人，是你的福氣。」</p>'
            : `<p class="calc">隔壁的「${esc(r.name)}」目前搶走約 ${Math.round(r.strength * 22)}% 的客人・記仇程度 ${'😤'.repeat(Math.min(5, r.grudge || 0)) || '還沒結仇'}${r.truceUntil >= s.day ? '・🕊️ 休戰中' : ''}</p>
               <p class="drawer-tip">違法的手段被抓到會罰錢、上新聞；記仇越深，對方越會報復，被抓包的機率也越高。</p>
               <div class="plot-list">${window.BossFun.SCHEMES.map((sc) => {
                 const o = s.schemeOdds(sc);
                 return `<div class="plot ${sc.legal}">
                   <div class="plot-head"><span>${sc.icon}</span><div><b>${sc.name}</b><small>${sc.desc}</small></div></div>
                   <div class="plot-meta"><span class="legal ${sc.legal}">${L[sc.legal]}</span><span>成功率 ${Math.round(o.p * 100)}%</span><span class="neg">被抓包 ${Math.round(o.risk * 100)}%</span><span>${sc.minutes} 分鐘</span></div>
                   <button data-action="scheme" data-id="${sc.id}" ${s.boss.away || s.cash < sc.cost || r.truceUntil >= s.day ? 'disabled' : ''}>執行（${sc.cost ? money(sc.cost) : '免費'}）</button>
                 </div>`;
               }).join('')}</div>`
        }
      </div>`;
    } else if (d.type === 'collabs') {
      inner = `<div class="card menu-card plot-card">
        <button class="x" data-action="close-dialog" aria-label="關閉">✕</button>
        <h2>🤝 商圈聯誼會：聯名合作</h2>
        ${s.collabs.length ? `<p class="calc">進行中：${s.collabs.map((c) => `${c.icon} ${esc(c.name)}「${esc(c.collab)}」到第 ${c.until} 天`).join('、')}</p>` : '<p class="calc">跟附近的店家一起辦活動，期間會吸引更多客人。評價越高，越容易談成。</p>'}
        <div class="plot-list">${window.BossFun.PARTNERS.map((pt) => {
          const why = s.collabReady(pt);
          const T = window.BossSim.CUSTOMER_TYPES;
          return `<div class="plot collab ${pt.rival ? 'truce' : ''}">
            <div class="plot-head"><span>${pt.icon}</span><div><b>${pt.name}</b><small>${pt.desc}</small></div></div>
            <p class="plot-collab">「${esc(pt.collab)}」</p>
            <div class="plot-meta"><span>客人 +${Math.round((pt.mult - 1) * 100)}%・${pt.days} 天</span><span>吸引：${pt.types.map((t) => (T[t] ? T[t].icon + T[t].name : t)).join('、')}</span><span>${pt.minutes} 分鐘</span></div>
            <button class="primary" data-action="collab" data-id="${pt.id}" ${why || s.boss.away || s.cash < pt.cost ? 'disabled' : ''}>${why || `去談合作（${money(pt.cost)}）`}</button>
          </div>`;
        }).join('')}</div>
      </div>`;
    } else if (d.type === 'trip') {
      const r = d.result;
      const J = window.BossFun.JIAOBEI;
      inner = `<div class="card menu-card act-result">
        <div class="event-kicker">${r.place.icon} 老闆回來了${r.outcome ? `・${{ win: '✅ 成功', lose: '😐 沒成功', caught: '🚨 被抓包', 'win-caught': '✅ 成功但 🚨 被抓包' }[r.outcome]}` : ''}</div>
        <h2>${r.place.name}</h2>
        ${r.jiaobei ? `<div class="jiaobei">${r.jiaobei.map((j) => `<div><span>${J[j].icon}</span><b>${J[j].name}</b><small>${J[j].text}</small></div>`).join('')}</div>` : ''}
        <ul class="act-lines">${r.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
        ${r.chips.length ? `<div class="chips">${r.chips.map((c) => `<span class="chip ${/^[💸📉]/u.test(c) ? 'bad' : 'good'}">${esc(c)}</span>`).join('')}</div>` : ''}
        ${r.tip ? `<div class="tip">📘 <strong>法律小知識：</strong>${r.tip}</div>` : ''}
        <button class="primary" data-action="close-dialog">回店裡</button>
      </div>`;
    } else if (d.type === 'rival-visit') {
      const r = d.result;
      inner = `<div class="card menu-card act-result">
        <div class="event-kicker">🕵️ 探班</div>
        <h2>隔壁的「${esc(r.name)}」</h2>
        <ul class="act-lines">${r.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
        <p class="calc">他們大約搶走了 ${Math.round(r.strength * 22)}% 的客人。</p>
        <div class="insp-actions"><button data-action="open-hub" data-id="schemes">🕵️ 想點辦法對付他</button><button data-action="open-hub" data-id="collabs">🤝 提議休戰聯名</button><button class="primary" data-action="close-dialog">回去自己的店</button></div>
      </div>`;
    } else if (d.type === 'activity') {
      const r = d.result;
      inner = `<div class="card menu-card act-result">
        <div class="event-kicker">${r.activity.icon} 員工活動・花了 ${money(r.cost)}</div>
        <h2>${r.activity.name}</h2>
        <ul class="act-lines">${r.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
        <div class="chips">${r.changes.map((c) => `<span class="chip ${c.d >= 0 ? 'good' : 'bad'}">${c.like === 'like' ? '😍' : c.like === 'dislike' ? '😒' : '🙂'} ${esc(c.name)} 心情 ${c.d >= 0 ? '+' : ''}${c.d}</span>`).join('')}</div>
        ${r.activity.tip ? `<div class="tip">📘 <strong>法律小知識：</strong>${r.activity.tip}</div>` : ''}
        <button class="primary" data-action="close-dialog">回去顧店</button>
      </div>`;
    } else if (d.type === 'advice') {
      const list = s.advice();
      inner = `<div class="card menu-card">
        <button class="x" data-action="close-dialog" aria-label="關閉">✕</button>
        <h2>💡 店長建議</h2>
        ${list.length ? `<div class="advice-list">${list.map((a) => `<div class="advice"><span>${a.icon}</span><p>${a.text}</p>${a.tab ? `<button data-action="advice-go" data-tab="${a.tab}">前往</button>` : ''}</div>`).join('')}</div>` : '<p class="calc">目前一切順利，繼續保持！</p>'}
      </div>`;
    } else if (d.type === 'menu') {
      const infos = Object.fromEntries(SLOTS.map((n) => [n, slotInfo(n)]));
      const q = ui.quality;
      inner = `<div class="card menu-card">
        <button class="x" data-action="close-dialog" aria-label="關閉">✕</button>
        <h2>☰ 選單</h2>
        <h3>存檔 <small>現在用第 ${ui.slot} 格；每週結算會自動存檔</small></h3>
        <div class="slot-list compact">
          ${SLOTS.map((n) => `<div class="slot ${n === ui.slot ? 'current' : ''}"><span class="slot-no">${n}</span><div class="slot-info"><b>${infos[n] ? `${infos[n].icon} ${esc(infos[n].shop)}` : '空的'}</b><small>${infos[n] ? `第 ${infos[n].day} 天・${money(infos[n].cash)}` : ''}</small></div><button data-action="save-slot" data-slot="${n}">${n === ui.slot ? '💾 存檔' : '存到這格'}</button></div>`).join('')}
        </div>
        <div class="insp-actions"><button data-action="export-current">📤 匯出成檔案</button><label class="file-btn">📥 匯入到第 ${ui.slot} 格<input type="file" accept=".json,application/json" data-action="import-file-game" hidden /></label></div>
        <h3>畫質 <small>目前 ${ui.view ? Math.round(ui.view.fps) : '—'} fps</small></h3>
        <div class="segmented small">
          ${[['auto', '自動'], ['high', '高'], ['medium', '中'], ['low', '低（省電）']].map(([v, l]) => `<button data-action="quality" data-value="${v}" class="${q === v ? 'active' : ''}">${l}</button>`).join('')}
        </div>
        <h3>操作</h3>
        <button class="toggle ${ui.autoPause ? 'on' : 'off'} neutral" data-action="autopause"><span class="knob"></span><span>${ui.autoPause ? '打開員工、庫存、經營等面板時，時間自動暫停' : '打開面板時時間照走'}</span></button>
        <p class="calc">🎵 正在播放：${window.BossAudio.trackName ? window.BossAudio.trackName() : ''}（會跟著時段、天氣和忙碌程度換曲）</p>
        <div class="insp-actions"><button data-action="tut-restart">📘 重新看新手教學</button><button data-action="quit" class="warn">🚪 存檔並回主選單</button></div>
      </div>`;
    } else if (d.type === 'victory') {
      const v = d.report.victory;
      const diff = window.BossIndustries.DIFFICULTY[v.mode];
      inner = `<div class="card ending win">
        <div class="ending-face">${portraitSVG(bossLook(ui.settings.gender), 'happy')}<span>${v.medal}</span></div>
        <div class="event-kicker">🎉 破關！${esc(s.shopName)}撐過了一整年・${v.ind}・${diff ? diff.name : ''}模式</div>
        <h2>${v.title}</h2>
        <table class="ledger">${v.parts.map(([k, pts, txt]) => `<tr><th>${k}<small>（${txt}）</small></th><td class="${pts < 0 ? 'neg' : 'pos'}">${pts > 0 ? '+' : ''}${pts}</td></tr>`).join('')}
          <tr class="total"><th>總分</th><td>${v.score}</td></tr></table>
        <p class="calc">🥇 120 分以上・🥈 85 分以上・🥉 50 分以上。遊戲可以繼續玩，看看第二年能不能拿更好的評價。</p>
        <div class="ending-actions"><button class="primary" data-action="close-dialog">繼續經營</button><button data-action="quit">回主選單</button></div>
      </div>`;
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
    box.innerHTML = d.type === 'minigame' ? '' : `<div class="dialog-backdrop ${['week', 'ending', 'victory', 'menu', 'advice', 'activity', 'boss-menu', 'city', 'trip', 'rival-visit', 'schemes', 'collabs'].includes(d.type) ? 'center' : ''}">${inner}</div>`;
    ui.dialogShownAt = performance.now();
  }

  function weekReport(r) {
    const s = ui.sim;
    const rows = ledgerRows(r);
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
      ${r.hygiene ? `<div class="alert ${r.hygiene.fine || r.hygiene.grade === '限期改善' ? 'bad' : 'good'}">🕵️ ${esc(r.hygiene.text)}</div>` : ''}
      ${r.waste ? `<p class="calc">這週過期報廢的食材：${money(r.waste)}</p>` : ''}
      ${r.rival && !r.rival.closed ? `<p class="calc">🏪 隔壁的「${esc(r.rival.name)}」大約搶走了 ${Math.round(r.rival.strength * 22)}% 的客人。</p>` : ''}
      ${r.inspection ? (r.inspection.violations.length ? `<div class="alert bad">🔍 <b>勞動檢查！</b>查到：${r.inspection.violations.join('、')}，罰鍰 ${money(r.inspection.fine)}。</div>` : '<div class="alert good">🔍 勞動檢查：沒有發現違規。</div>') : ''}
      ${s.cash < 0 ? `<div class="alert bad">⚠️ 現金是負的！下週結算前要轉正，不然只能跟銀行借錢（目前借了 ${money(s.loan)}，上限 $600,000）。</div>` : ''}
      ${r.news.length ? `<ul class="news-list">${r.news.map((n) => `<li>${n}</li>`).join('')}</ul>` : ''}
      ${r.headlines ? `<div class="headlines"><small>📰 本週網路熱門</small>${r.headlines.map((h) => `<p>${esc(h)}</p>`).join('')}</div>` : ''}
      <p class="calc">📱 粉絲 ${(r.followers || 0).toLocaleString()} 人・下週時事：${s.social.trend ? `${s.social.trend.icon} ${s.social.trend.name}` : '—'}</p>
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

  function save(slot = ui.slot) {
    if (!ui.sim || ui.sim.over) return false;
    return store.set(slotKey(slot), ui.sim.serialize());
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
        ui.settings[btn.dataset.key] = btn.dataset.key === 'slot' ? Number(btn.dataset.value) : btn.dataset.value;
        renderStart();
        break;
      case 'start': {
        keepName();
        const ind = INDUSTRIES.find((i) => i.id === ui.settings.industry);
        startGame(new Sim(ind.id, { shopName: ui.settings.shopName.trim() || ind.shopName, mode: ui.settings.mode }), ui.settings.slot);
        save();
        break;
      }
      case 'continue': {
        const n = Number(btn.dataset.slot);
        try {
          ui.settings.tutorial = false;
          startGame(Sim.load(loadSlot(n), {}), n);
        } catch (err) {
          flash('存檔讀取失敗', true);
        }
        break;
      }
      case 'export-slot': {
        const n = Number(btn.dataset.slot);
        const i = slotInfo(n);
        if (i) exportSave(loadSlot(n), `不當慣老闆-${i.shop}-第${i.day}天`);
        break;
      }
      case 'delete-slot': {
        const n = Number(btn.dataset.slot);
        if (ui.confirmDelete === n) {
          store.del(slotKey(n));
          ui.confirmDelete = null;
          ui.settings.slot = null;
        } else ui.confirmDelete = n;
        renderStart();
        break;
      }
      case 'sys-menu':
        save();
        ui.dialog = { type: 'menu' };
        renderDialog();
        break;
      case 'save-slot': {
        const n = Number(btn.dataset.slot);
        ui.slot = n;
        const ok = save(n);
        toast(ok ? `💾 存到第 ${n} 格了` : '這個瀏覽器不能存檔', ok ? '' : 'bad');
        renderDialog();
        break;
      }
      case 'export-current':
        exportSave(s.serialize(), `不當慣老闆-${s.shopName}-第${s.day}天`);
        break;
      case 'quality':
        ui.quality = btn.dataset.value;
        store.set(QUALITY_KEY, ui.quality);
        ui.view.setQuality(effectiveQuality());
        renderDialog();
        break;
      case 'tut-restart':
        ui.dialog = null;
        renderDialog();
        startTutorial();
        break;
      case 'tut-next':
        if (ui.tut.step >= TUT.length - 1) endTutorial();
        else {
          ui.tut.step++;
          renderTutorial();
        }
        break;
      case 'tut-skip':
        endTutorial();
        break;
      case 'par': {
        const id = btn.dataset.id;
        s.par[id] = Math.max(0, s.par[id] + Number(btn.dataset.d));
        ui.tutFlags.par = true;
        renderDrawer();
        break;
      }
      case 'rush': {
        const gid = btn.dataset.gid || btn.dataset.id;
        if (!s.rushOrder(gid)) toast('錢不夠叫急件', 'bad');
        renderInbox();
        if (ui.tab === 'stock') renderDrawer();
        break;
      }
      case 'rush-clean':
        s.rushClean();
        toast('🧹 「大家先放下手邊的事，把店裡整理一下！」');
        renderInbox();
        break;
      case 'deep-clean':
        s.deepClean();
        renderDrawer();
        break;
      case 'flyers':
        if (!s.flyers()) toast('錢不夠', 'bad');
        renderDrawer();
        break;
      case 'promo':
        s.startPromo(7);
        renderDrawer();
        break;
      case 'loyalty':
        s.buyLoyalty();
        renderDrawer();
        break;
      case 'branch-set':
        s.setBranch(Number(btn.dataset.i), btn.dataset.key, btn.dataset.value);
        renderDrawer();
        break;
      case 'branch-staff':
        s.setBranch(Number(btn.dataset.i), 'staff', Number(btn.dataset.d));
        renderDrawer();
        break;
      case 'branch-reno':
        s.setBranch(Number(btn.dataset.i), 'reno');
        renderDrawer();
        break;
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
        if (ui.tab === 'staff') renderDrawer();
        break;
      case 'raise': {
        const who = staffOf(btn);
        if (who) {
          s.raise(who);
          toast(`💵 ${who.name} 時薪調到 ${money(who.wage)}`);
        }
        refreshStaffViews();
        break;
      }
      case 'wage-market': {
        const who = staffOf(btn);
        if (who) s.setWage(who, s.marketWage);
        refreshStaffViews();
        break;
      }
      case 'rest-now': {
        const who = staffOf(btn);
        if (who) {
          const ok = s.restNow(who);
          toast(ok ? `☕ ${who.name} 去休息了` : `${who.name} 正在服務客人，等一下再去`, ok ? '' : 'bad');
        }
        refreshStaffViews();
        break;
      }
      case 'boss-mode':
        setBossMode(!ui.bossMode);
        break;
      case 'boss-act':
        bossInteract();
        break;
      case 'boss-do': {
        const t = ui.dialog && ui.dialog.targets && ui.dialog.targets[Number(btn.dataset.t)];
        closeDialog();
        if (t) bossAction(t, btn.dataset.act);
        break;
      }
      case 'boss-city':
        if (!ui.bossMode) setBossMode(true);
        ui.dialog = { type: 'city' };
        renderDialog();
        break;
      case 'open-hub':
        ui.dialog = { type: btn.dataset.id };
        renderDialog();
        break;
      case 'scheme':
        if (s.startScheme(btn.dataset.id)) {
          closeDialog();
          renderBossHud();
        }
        break;
      case 'collab':
        if (s.startCollab(btn.dataset.id)) {
          closeDialog();
          renderBossHud();
        }
        break;
      case 'go-out':
        if (s.goOut(btn.dataset.id)) {
          closeDialog();
          renderBossHud();
        }
        break;
      case 'chat': {
        const who = staffOf(btn);
        const t = who && s.chat(who);
        if (t) toast(`💬 ${who.name}：「${t}」`);
        refreshStaffViews();
        break;
      }
      case 'treat': {
        const who = staffOf(btn);
        if (who && s.treat(who)) toast(`🧋 請${who.name}喝了一杯飲料`);
        refreshStaffViews();
        break;
      }
      case 'train': {
        const who = staffOf(btn);
        if (who && s.train(who)) toast(`🎓 ${who.name} 去上了一堂課，技能提升到 ${Math.round(who.skill)}`);
        refreshStaffViews();
        break;
      }
      case 'promote': {
        const who = staffOf(btn);
        if (who) s.promote(who, btn.dataset.rank);
        refreshStaffViews();
        break;
      }
      case 'demote': {
        const who = staffOf(btn);
        if (who && s.demote(who)) toast(`⬇️ ${who.name} 被降職了`, 'bad');
        refreshStaffViews();
        break;
      }
      case 'act-who': {
        const id = Number(btn.dataset.id);
        if (ui.actPick.has(id)) ui.actPick.delete(id);
        else ui.actPick.add(id);
        renderDrawer();
        break;
      }
      case 'act-all':
        ui.actPick = ui.actPick.size === s.staff.length ? new Set() : new Set(s.staff.map((e) => e.id));
        renderDrawer();
        break;
      case 'activity': {
        const r = s.holdActivity(btn.dataset.id, [...ui.actPick]);
        if (r) {
          ui.dialog = { type: 'activity', result: r };
          renderDialog();
          renderDrawer();
        }
        break;
      }
      case 'staff-open': {
        const id = Number(btn.dataset.id);
        ui.staffOpen = ui.staffOpen === id ? null : id;
        renderDrawer();
        break;
      }
      case 'praise': {
        const who = btn.dataset.id ? s.staff.find((x) => String(x.id) === btn.dataset.id) : ui.inspect.ref;
        if (who && s.praise(who)) toast(`👍 稱讚了${who.name}`);
        if (ui.inspect) renderInspector();
        if (ui.tab === 'staff') renderDrawer();
        break;
      }
      case 'wage': {
        const who = s.staff.find((x) => String(x.id) === btn.dataset.id);
        if (who) s.setWage(who, who.wage + Number(btn.dataset.d));
        renderDrawer();
        break;
      }
      case 'staff-tab':
        ui.staffTab = btn.dataset.v;
        renderDrawer();
        break;
      case 'rest-day': {
        const who = s.staff.find((x) => String(x.id) === btn.dataset.id);
        if (who) s.setSchedule(who, 'restDay', btn.dataset.d);
        renderDrawer();
        break;
      }
      case 'rest-auto': {
        const who = s.staff.find((x) => String(x.id) === btn.dataset.id);
        if (who) s.setSchedule(who, 'restAuto');
        renderDrawer();
        break;
      }
      case 'research':
        s.research(btn.dataset.id);
        renderDrawer();
        break;
      case 'style':
        if (!s.setStyle(btn.dataset.kind, btn.dataset.value)) toast('錢不夠', 'bad');
        renderDrawer();
        break;
      case 'post-part':
        ui.post[btn.dataset.key] = btn.dataset.value;
        renderDrawer();
        break;
      case 'post': {
        const r = s.post(ui.post.hook, ui.post.body, ui.post.end);
        if (r) renderDrawer();
        break;
      }
      case 'advice':
        ui.dialog = { type: 'advice' };
        renderDialog();
        break;
      case 'advice-go':
        closeDialog();
        if (ui.tab !== btn.dataset.tab) openTab(btn.dataset.tab);
        break;
      case 'autopause':
        ui.autoPause = !ui.autoPause;
        store.set('boss-sim-autopause', ui.autoPause ? '1' : '0');
        renderDialog();
        break;
      case 'scold': {
        const who = staffOf(btn);
        if (who) {
          s.scold(who);
          toast(`😠 你罵了${who.name}（慣老闆指數上升）`, 'bad');
        }
        refreshStaffViews();
        break;
      }
      case 'sendhome': {
        const who = btn.dataset.id ? s.staff.find((x) => String(x.id) === btn.dataset.id) : ui.inspect.ref;
        if (!who) break;
        s.sendHome(who);
        toast(`🏠 ${who.name} 今天先下班了`);
        if (ui.tab === 'staff') renderDrawer();
        break;
      }
      case 'fire': {
        const who = staffOf(btn);
        if (!who) break;
        if (ui.confirmFire === who) {
          s.fire(who);
          ui.confirmFire = null;
          if (ui.inspect && ui.inspect.ref === who) closeInspector();
        } else {
          ui.confirmFire = who;
          // 三秒內沒按第二次就取消，免得誤按
          clearTimeout(ui.fireT);
          ui.fireT = setTimeout(() => {
            ui.confirmFire = null;
            refreshStaffViews();
          }, 3000);
        }
        refreshStaffViews();
        break;
      }
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
        ui.tutFlags.price = true;
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
        closeDialog();
        break;
    }
  });

  // 按鈕上有 data-id 就用它（員工總覽），沒有就用檢視面板裡的那個人
  function staffOf(btn) {
    const s = ui.sim;
    if (btn.dataset.id) return s.staff.find((x) => String(x.id) === btn.dataset.id) || null;
    return ui.inspect && ui.inspect.kind === 'staff' ? ui.inspect.ref : null;
  }

  function refreshStaffViews() {
    if (ui.inspect) renderInspector();
    if (ui.tab === 'staff') renderDrawer();
  }

  function closeDialog() {
    const wasWelcome = ui.dialog && ui.dialog.type === 'welcome';
    ui.dialog = null;
    renderDialog();
    if (wasWelcome && ui.tutPending) {
      ui.tutPending = false;
      startTutorial();
    }
  }

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
    } else if (t.dataset.action === 'sched') {
      const who = s.staff.find((x) => String(x.id) === t.dataset.id);
      if (who) s.setSchedule(who, t.dataset.key, t.value);
      renderDrawer();
    }
  });

  // 開始畫面的勾選和檔案（遊戲還沒開始，ui.sim 是 null）
  app.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.action === 'tut-toggle') ui.settings.tutorial = t.checked;
    else if (t.dataset.action === 'import-file' && t.files[0]) importSave(t.files[0], ui.settings.slot || firstEmptySlot());
    else if (t.dataset.action === 'import-file-game' && t.files[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const sim = Sim.load(reader.result, {});
          store.set(slotKey(ui.slot), reader.result);
          cancelAnimationFrame(ui.raf);
          if (ui.view) ui.view.destroy();
          ui.settings.tutorial = false;
          startGame(sim, ui.slot);
          toast('📥 匯入成功');
        } catch (err) {
          toast('這個檔案不是遊戲存檔', 'bad');
        }
      };
      reader.readAsText(t.files[0]);
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
        closeDialog();
      }
      return;
    }
    const k = e.key.toLowerCase();
    if (ui.bossMode) {
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        e.preventDefault();
        ui.keys.add(k);
        return;
      }
      if (k === 'e' || k === 'f') return bossInteract();
      if (k === 'c') return ui.view.rotate(1);
      if (k === 'm') return clickAction('boss-city', {});
    }
    if (k === 'g') return setBossMode(!ui.bossMode);
    if (k === ' ') {
      e.preventDefault();
      if (ui.speed > 0) {
        ui.prevSpeed = ui.speed;
        ui.speed = 0;
      } else ui.speed = ui.prevSpeed || 2;
      renderTopbar();
    } else if (k === '1' || k === '2' || k === '3') {
      ui.speed = { 1: 2, 2: 5, 3: 12 }[k];
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

  window.addEventListener('keyup', (e) => ui.keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => ui.keys.clear());

  // 手機的虛擬搖桿
  app.addEventListener('pointerdown', (e) => {
    const joy = e.target.closest('#joy');
    if (!joy) return;
    e.preventDefault();
    const r = joy.getBoundingClientRect();
    const knob = joy.querySelector('.joy-knob');
    const move = (ev) => {
      const dx = ev.clientX - (r.left + r.width / 2);
      const dy = ev.clientY - (r.top + r.height / 2);
      const max = r.width / 2;
      const len = Math.min(max, Math.hypot(dx, dy));
      const ang = Math.atan2(dy, dx);
      ui.joy = { x: (Math.cos(ang) * len) / max, y: (Math.sin(ang) * len) / max };
      knob.style.transform = `translate(${Math.cos(ang) * len}px, ${Math.sin(ang) * len}px)`;
    };
    const up = () => {
      ui.joy = null;
      knob.style.transform = '';
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    move(e);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  });

  // 自動化測試用：網址加上 #debug 才會開放
  if (location.hash === '#debug') window.BossDebug = { ui, renderDialog, renderDrawer, setBossMode, bossInteract };

  renderStart();
})();
