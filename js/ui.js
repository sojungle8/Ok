// 介面：開始畫面、上方資訊列、底部工具列與抽屜、檢視面板、事件對話、週報、結局
(function () {
  const { Sim, CATALOG, catalogById, ACHIEVEMENTS, MIN_WAGE, WEEKDAYS, INS, TAX_LABEL, CUSTOMER_TYPES } = window.BossSim;
  const { DECOR_THEMES, INDUSTRIES, CAT_LABELS, LOTS, TRAITS, LEVELS, DISTRICTS, DISTRICT_INFO, DIFFICULTY, FLOORS, WALLS, SIGNS, BRANCH_SITES, BRANCH_SIZES } = window.BossIndustries;
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
    settings: { industry: 'breakfast', gender: 'm', mode: 'rookie', shopName: '' },
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
      return { icon: si ? si.icon : '🏪', ind: si ? si.name : '', shop: d.shopName, day: d.day, cash: d.cash, month: Math.floor((d.day - 1) / 28) + 1, week: Math.floor((d.day - 1) / 7) + 1, branches: (d.branches || []).length, savedAt: d.savedAt || null };
    } catch (e) {
      return null;
    }
  }
  // 存檔時間：今天顯示幾點幾分，其他天顯示日期
  function savedLabel(t) {
    const d = new Date(t);
    const pad = (n) => String(n).padStart(2, '0');
    const today = new Date().toDateString() === d.toDateString();
    return today ? `今天 ${pad(d.getHours())}:${pad(d.getMinutes())}` : `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
              ? `<div class="slot card"><span class="slot-no">${n}</span><div class="slot-info"><b>${i.icon} ${esc(i.shop)}</b><small>${i.ind}・第 ${i.week} 週（第 ${i.day} 天）・現金 ${money(i.cash)}${i.branches ? `・分店 ${i.branches} 間` : ''}${i.savedAt ? `・存於 ${savedLabel(i.savedAt)}` : ''}</small></div>
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
            <span class="name-row"><input id="shop-name" maxlength="10" placeholder="${esc(ind.shopName)}" value="${esc(st.shopName)}" /><button data-action="name-dice" title="隨機取個惡搞店名">🎲</button></span>
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
              ${Object.entries(DIFFICULTY).map(([id, d]) => `<button data-action="set" data-key="mode" data-value="${id}" class="${st.mode === id ? 'active' : ''}">${id === 'hell' ? '🔥 ' : id === 'easy' ? '🌱 ' : id === 'rookie' ? '🌸 ' : ''}${d.name}<small>${d.desc}</small></button>`).join('')}
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
          <button class="quest-chip" id="quest-chip" data-action="tab" data-tab="quests"></button>
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
            <button data-action="cam-reset" title="鏡頭回到預設（雙擊地板可以拉近）">⌖</button>
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
        // 快轉中有事找你：先把速度調回正常，不然一眨眼事件就過期了
        if (ui.autoPause && ui.speed > 2) {
          ui.speed = 2;
          renderTopbar();
          text += '（先調回正常速度）';
        }
        toast(text, 'event');
        renderInbox();
      },
      ignored: (r) => {
        toast(sim.w(`😤 ${r.event.title}：你沒處理`), 'bad');
        renderInbox();
      },
      dayEnd: (r) => {
        // 等這一輪結算完（日期換到隔天）再存，不然讀檔會把同一天再玩一次
        setTimeout(() => save(), 0);
        toast(`🌙 今天服務 ${r.served} 位客人，營收 ${money(r.revenue)}${r.angry ? `，${r.angry} 位等到生氣離開` : ''}${r.holiday ? '（國定假日薪水加倍）' : ''}`);
      },
      festival: (f) => toast(f.news, 'event'),
      helped: () => renderInbox(),
      delegated: (r, ev, m) => {
        toast(sim.w(`👑 ${m.name} 幫你處理了「${r.event.title}」：${r.choice.label}`), (r.delta && r.delta.jerk > 0) || (r.choice.effects && r.choice.effects.jerk > 0) ? 'bad' : '');
        renderInbox();
      },
      tripDone: (r) => {
        ui.dialog = { type: 'trip', result: r };
        renderDialog();
      },
      hygiene: () => {
        if (ui.tab === 'stock') renderDrawer();
      },
      chapter: (c) => {
        confetti(90);
        ui.dialog = { type: 'chapter', ...c };
        renderDialog();
        renderQuestChip();
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
        confetti(60);
        buzz([20, 40, 30]);
      },
      combo: (n) => {
        confetti(n >= 50 ? 70 : 36);
        buzz([15, 30, 15]);
      },
      weekEnd: (r) => {
        save();
        ui.dialog = r.victory ? { type: 'victory', report: r } : { type: 'week', report: r };
        renderDialog();
      },
    };
    if (ui.place) ui.place.destroy();
    ui.place = null;
    ui.view = new window.BossShop3D(document.getElementById('view'), sim, {
      onClick: onViewClick,
      onHover: (t) => {
        ui.hover = t;
      },
      dragLocked: () => !!ui.build || !!ui.place,
      // 車流、鴿子跟著遊戲速度走，暫停時也停
      timeScale: () => (ui.dialog || ui.panelPause || ui.speed === 0 ? 0 : Math.min(2.5, ui.speed / 2)),
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
    { title: '調整進貨量', short: '按＋或－改一種{w:supplies}的進貨量',  text: () => '按「＋」或「－」改一種{w:supplies}的每天進貨量。也可以打開「依昨天用量自動調整」。', target: '[data-action="par"]', done: () => ui.tutFlags.par || ui.sim.policy.autoStock },
    { title: '定價', short: '在「{w:menu}與價格」按＋或－改一個價格',  text: () => '打開「⚙️ 經營」，在「{w:menu}與價格」按＋／－改一個品項的價格。太貴學生和長輩會不想來，太便宜又賺不到錢。', target: '[data-tab="manage"], [data-action="price"]', done: () => ui.tutFlags.price },
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
      <b>${st.title}</b><span class="tut-short">${ui.sim.w(st.short || '')}</span><p>${ui.sim.w(st.text())}</p>
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
    if (st.target) document.querySelectorAll(st.target).forEach((n) => !n.classList.contains('drawer-x') && n.classList.add('tut-glow'));
  }

  function loop(now) {
    const dt = Math.min(0.1, (now - ui.last) / 1000);
    ui.last = now;
    const sim = ui.sim;
    if (!sim) return;
    // 打開員工、庫存、經營這些面板時自動暫停（可以在選單關掉）
    ui.panelPause = ui.autoPause && ['staff', 'stock', 'manage', 'social', 'goals', 'ledger', 'reviews', 'build', 'quests'].includes(ui.tab);
    const blocked = !!ui.dialog || ui.panelPause;
    if (!blocked && ui.speed > 0 && !sim.over) {
      // 打烊、沒人在店裡時自動快轉
      const empty = !sim.isOpen && !sim.customers.length && !sim.staff.some((e) => e.state !== 'off') && !sim.activeEvents.length;
      const mult = empty ? 150 : ui.speed;
      ui.nightSkip = empty;
      sim.tick(dt * mult);
    }
    feedbackLoop(sim);
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
    if (ui.place) {
      ui.place.update(dt, now);
      ui.place.render();
    } else ui.view.render(now);
    ui.hudT = (ui.hudT || 0) + dt;
    if (ui.hudT > 0.25) {
      ui.hudT = 0;
      renderTopbar();
      if (ui.inspect) renderInspector();
      renderInbox();
      if (ui.tut) renderTutorial();
      renderQuestChip();
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
      if (ui.place) leavePlace();
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
    if (ui.place) return updatePlaceControl(ix, iy, dt);
    if (ix || iy) {
      b.path = [];
      // 螢幕的上下左右換成地面方向（跟著鏡頭旋轉）
      const az = ui.view.camAz;
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

  // ───── 走進去的小場景 ─────
  function updatePlaceControl(ix, iy, dt) {
    const pl = ui.place;
    let vx = 0;
    let vz = 0;
    if (ix || iy) {
      const az = ui.view.camAz;
      vx = Math.cos(az) * ix + Math.sin(az) * iy;
      vz = -Math.sin(az) * ix + Math.cos(az) * iy;
    }
    pl.move(vx, vz, dt);
    ui.bossT = (ui.bossT || 0) + dt;
    if (ui.bossT > 0.15) {
      ui.bossT = 0;
      const t = pl.targets()[0];
      const btn = document.getElementById('boss-act');
      if (btn) {
        btn.hidden = !t;
        const txt = t ? `${t.icon} ${t.label}` : '';
        if (btn.textContent !== txt) btn.textContent = txt;
      }
      renderBossHud();
    }
  }

  function enterPlace(id) {
    const s = ui.sim;
    if (!window.BossPlace3D) return false;
    if (!ui.bossMode) setBossMode(true);
    if (!s.enterPlace(id)) {
      toast(s.boss.away ? '老闆已經在外面了' : '錢不夠', 'bad');
      return false;
    }
    closeInspector();
    ui.place = new window.BossPlace3D(ui.view, s, id, { gender: ui.settings.gender, touch: isTouch });
    if (ui.place.intro) ui.place.showLog(ui.place.intro);
    ui.view.overlay.hidden = true;
    ui.keys.clear();
    closeDialog();
    toast(isTouch ? '🚶 走到攤位或人旁邊，按右下角的按鈕互動；走到綠色圈圈回店裡' : '🚶 走到攤位或人旁邊按 E 互動；走到綠色圈圈按 E 回店裡（店裡照常營業）');
    renderBossHud();
    return true;
  }

  function placeDo(t) {
    const s = ui.sim;
    const pl = ui.place;
    if (t.id === 'exit') return leavePlace(true);
    const r = s.placeAction(t.id);
    if (!r) return;
    if (!r.fail) pl.done.add(t.id);
    if (r.dance) pl.dancing = performance.now() + 2600;
    pl.showLog(`${t.icon} ${r.text}`, r.chips, r.fail);
    window.BossAudio.play(r.fail ? 'click' : r.outcome === 'caught' || r.outcome === 'win-caught' ? 'bad' : 'coin');
    renderTopbar();
  }

  function leavePlace(summary) {
    const s = ui.sim;
    const r = s.leavePlace();
    if (ui.place) ui.place.destroy();
    ui.place = null;
    if (!ui.view) return;
    ui.view.overlay.hidden = false;
    ui.view.updateCamera();
    ui.view.renderer.shadowMap.needsUpdate = true;
    renderBossHud();
    if (summary && r) {
      ui.dialog = { type: 'trip', result: r };
      renderDialog();
    }
  }

  function renderBossHud() {
    const el = document.getElementById('boss-hud');
    if (!el) return;
    const s = ui.sim;
    const b = s.boss;
    el.hidden = !ui.bossMode;
    if (!ui.bossMode) return;
    const st = b.away && b.away.scene ? `🚶 在外面逛・店裡照常營業（${s.clockLabel}）` : b.away ? `${(window.BossFun.PLACES.find((p) => p.id === b.away.id) || {}).icon || ''} 出門中・還要 ${Math.max(0, Math.round(b.away.until - s.minute))} 分鐘` : b.lane ? '🧑‍🍳 親自顧櫃台中' : b.ride ? '🛵 騎機車中' : '🚶 巡店中';
    const html = `<b>👑 老闆</b><small>${st}</small><div class="ibar"><span>體力</span><div class="bar"><div class="bar-fill energy" style="width:${Math.round(b.energy)}%"></div></div><b>${Math.round(b.energy)}</b></div>${b.away && b.away.scene ? '<button data-action="place-leave">🚪 回店裡</button>' : `<button data-action="boss-city" ${b.away ? 'disabled' : ''}>🗺️ 出門</button>`}`;
    if (el.dataset.html !== html) {
      morph(el, html);
      el.dataset.html = html;
    }
  }

  // 按 E 或右下角按鈕：一個動作直接做，多個動作就跳出選單
  function bossInteract() {
    if (ui.place) {
      const t = ui.place.targets()[0];
      if (!t) return toast('附近沒有可以互動的東西（走到攤位、人或綠色出口旁邊）');
      return placeDo(t);
    }
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
      case 'boss-toilet':
        if (s.bossCleanToilet()) {
          toast('🧽 廁所亮晶晶', 'good');
          window.BossAudio.play('cheer');
        }
        break;
      case 'boss-office':
        if (s.bossOfficeRest()) toast('💼 在辦公室休息了一下，體力恢復', 'good');
        else toast('剛剛才休息過', 'bad');
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
      case 'boss-rival':
        if (window.BossPlace3D) enterPlace('rival');
        else {
          const r = s.visitRival();
          if (r) {
            ui.dialog = { type: 'rival-visit', result: r };
            renderDialog();
          }
        }
        break;
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
    // 時間狀態和店的狀態分開寫，不會暫停了還寫「營業中」讓人以為時間在跑
    const clock = ui.dialog ? '⏸ 暫停' : ui.panelPause ? '⏸ 看面板暫停' : ui.speed === 0 ? '⏸ 已暫停' : ui.nightSkip ? '⏩ 打烊快轉' : { 2: '▶ 正常速度', 5: '▶▶ 快轉', 12: '▶▶▶ 超快' }[ui.speed] || '▶';
    const shop = s.shutDay === s.day ? '🌀 今天停業' : s.isOpen ? '營業中' : s.openToday ? '休息中' : '今天公休';
    txt('status', `${clock}・${shop}`);
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
    el.textContent = ui.sim ? ui.sim.w(text) : text;
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
        b.innerHTML = `<span>${ev.ev.icon}</span><div><b>${esc(s.w(ev.ev.title))}</b><small></small></div>`;
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
  function onViewClick(hit, e) {
    const s = ui.sim;
    if (ui.place) {
      if (e) ui.place.tapWalk(e.clientX, e.clientY);
      return;
    }
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
    // 點到哪裡都有一圈漣漪；附近的鴿子會被嚇飛
    if (hit.kind === 'tile' && ui.view.ripple) {
      ui.view.ripple(hit.x + 0.5, hit.z + 0.5);
      if (ui.view.scareAt(hit.x + 0.5, hit.z + 0.5, 1.6)) window.BossAudio.play('flap');
    }
    if (ui.bossMode && hit.kind === 'tile' && !s.boss.away) {
      const path = s.findPath(s.boss, { x: hit.x, z: hit.z });
      if (path) s.boss.path = path;
      return;
    }
    if (hit.kind !== 'tile') {
      window.BossAudio.play('pop');
      buzz(8);
    }
    if (hit.kind === 'staff') return inspect('staff', hit.staff);
    if (hit.kind === 'customer') return inspect('customer', hit.customer);
    if (hit.kind === 'object') return inspect('object', hit.obj);
    if (hit.kind === 'pet') return inspect('pet', hit.pet);
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
            <div class="chips">${e.traits.map((t) => `<span class="chip" title="${TRAITS[t].desc}">${TRAITS[t].name}</span>`).join('')}${sideChip(e)}</div>
            <small>${stateLabel}・${sh ? `今天 ${hhmm(sh.start)}～${hhmm(sh.end)}` : '今天休假'}</small>
          </div>
          <button class="x" data-action="close-insp" aria-label="關閉">✕</button>
        </div>
        ${e.thought && e.thought.until > s.minute ? `<p class="insp-thought">💭 ${esc(e.thought.text)}</p>` : ''}
        ${bar('心情', e.mood, 'morale')}${bar('精力', e.energy, 'energy')}${bar('飽足', e.hunger, 'hunger')}${bar('技能', e.skill, 'skill')}
        <p class="insp-meta">時薪 <b>${money(e.wage)}</b>（行情 ${money(s.marketWage)}）・今天服務 ${e.served} 人</p>
        ${relationsHtml(e)}
        ${skillsHtml(e)}
        <div class="insp-actions">
          <button data-action="raise">💵 加薪 $10</button>
          <button data-action="cheer" ${(e.state !== 'working' && e.state !== 'break') || (e.cheerAt && s.minute - e.cheerAt < 120) ? 'disabled' : ''} title="做事快一點、心情 +2（每人每兩小時一次）">💪 加油</button>
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
        ${bar('耐心', 100 - (c.waited / c.patience) * 100, 'morale')}
        ${c.state !== 'leaving' && !s.boss.away ? `<div class="insp-actions"><button data-action="cust-greet" ${c.greeted ? 'disabled' : ''}>😊 打招呼<small>耐心 +</small></button><button data-action="cust-gift" ${c.gifted || s.cash < 30 ? 'disabled' : ''}>🎁 招待小菜<small>$30・評價 +</small></button></div>` : ''}`;
      }
    } else if (kind === 'pet') {
      const p = ref;
      if (!s.pets.includes(p)) return closeInspector();
      const d = Fun.PETS[p.kind];
      const T = Fun.PET_TRAITS[p.trait] || { name: '', desc: '' };
      html = `
        <div class="insp-head">
          <div class="insp-icon">${d.icon}</div>
          <div><h3>${esc(p.name)}</h3><small>${d.name}・${T.name}：${T.desc}</small></div>
          <button class="x" data-action="close-insp" aria-label="關閉">✕</button>
        </div>
        ${bar('開心', p.joy, 'morale')}${bar('健康', p.health, 'skill')}
        <p class="insp-meta">${d.desc}</p>
        <div class="insp-actions"><button data-action="pet-play" data-id="${p.id}" ${p.playDay === s.day ? 'disabled' : ''}>🤗 陪牠玩</button><button data-action="pet-vet" data-id="${p.id}" ${s.cash < d.vet || p.vetDay === s.day ? 'disabled' : ''}>🩺 看獸醫 ${money(d.vet)}</button></div>`;
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
    renderQuestChip();
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
    const fn = { build: drawerBuild, staff: drawerStaff, stock: drawerStock, manage: drawerManage, ledger: drawerLedger, reviews: drawerReviews, goals: drawerGoals, social: drawerSocial, quests: drawerQuests }[ui.tab];
    ui.drawerHtml = ui.sim.w(fn());
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
    const html = ui.sim.w(fn());
    if (html === ui.drawerHtml) return;
    renderDrawer();
  }

  function drawerBuild() {
    const s = ui.sim;
    const mine = (d) => !d.industries || d.industries.includes(s.ind.id);
    const cats = Object.keys(CAT_LABELS).filter((c) => CATALOG.some((d) => d.cat === c && mine(d)));
    // 兼營業務的設備另外一個分頁
    if (CATALOG.some((d) => d.side && mine(d))) cats.splice(1, 0, 'side');
    const items = ui.buildCat === 'side' ? CATALOG.filter((d) => d.side && mine(d)) : CATALOG.filter((d) => d.cat === ui.buildCat && !d.side && mine(d));
    const lotNext = LOTS[s.lotIdx + 1];
    return `
      <div class="drawer-tabs">
        ${cats.map((c) => `<button data-action="build-cat" data-cat="${c}" class="${ui.buildCat === c ? 'active' : ''}">${c === 'side' ? '🧰 兼營業務' : CAT_LABELS[c]}</button>`).join('')}
        <button data-action="build-cat" data-cat="back" class="${ui.buildCat === 'back' ? 'active' : ''}">🚪 後場</button>
        <button data-action="build-cat" data-cat="pets" class="${ui.buildCat === 'pets' ? 'active' : ''}">🐾 寵物</button>
        <button data-action="build-cat" data-cat="lot" class="${ui.buildCat === 'lot' ? 'active' : ''}">店面與裝潢</button>
      </div>
      <div class="drawer-body">
        ${
          ui.buildCat === 'back'
            ? backroomPanel()
            : ui.buildCat === 'pets'
            ? petsPanel()
            : ui.buildCat === 'lot'
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
            : `${ui.buildCat === 'decor' ? decorSummary() : ''}<div class="catalog">${items
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
                  if (d.theme && DECOR_THEMES[d.theme]) tags.unshift(`${DECOR_THEMES[d.theme].icon}${DECOR_THEMES[d.theme].name}風`);
                  const sb = d.side && s.ind.products.find((p) => p.id === d.side);
                  if (sb) {
                    const b = sb.side;
                    tags.length = 0;
                    tags.push(b.desc);
                    tags.push(`尖峰每小時約 ${b.rate} 位客人`);
                    tags.push(b.price ? `每次收 $${b.price}${b.cost ? `（成本 $${b.cost}）` : ''}` : '不收錢（做口碑）');
                    if (b.impulse) tags.push(`${Math.round(b.impulse * 100)}% 會順便買東西`);
                    tags.push(d.selfServe ? '自助設備，不用店員' : '員工要學過才做得快');
                  }
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
    const tab = ui.staffTab === 'lead' && !s.feature('career') ? 'overview' : ui.staffTab || 'overview';
    const tabs = [['overview', `👥 總覽（${s.staff.length}）`], ...(s.feature('career') ? [['lead', '👑 主管']] : []), ['activity', '🎉 活動'], ['schedule', '📅 排班與崗位'], ['hire', `🙋 應徵者（${s.candidates.length}）`]];
    const head = `<div class="drawer-tabs">${tabs.map(([id, l]) => `<button data-action="staff-tab" data-v="${id}" class="${tab === id ? 'active' : ''}">${l}</button>`).join('')}</div>`;
    if (tab === 'schedule') return head + staffSchedule();
    if (tab === 'activity') return head + staffActivity();
    if (tab === 'hire') return head + staffHire();
    if (tab === 'lead') return head + staffLeaders();
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
                <button class="st-who" data-action="insp-staff" data-id="${e.id}"><span class="mini-face">${portraitSVG(e.look, moodOf(e))}</span><span><b>${e.rank && Fun.RANKS[e.rank] ? `${Fun.RANKS[e.rank].icon} ` : ''}${e.senior ? '⭐' : ''}${esc(e.name)}${e.rank && Fun.RANKS[e.rank] ? `<em class="rank">${Fun.RANKS[e.rank].name}${e.revealed && Fun.STYLES[e.style] ? `・${Fun.STYLES[e.style].icon}${Fun.STYLES[e.style].name}` : '・試用中'}</em>` : ''}</b><small>${e.side && Fun.SIDE_JOBS && Fun.SIDE_JOBS[e.side] ? `${Fun.SIDE_JOBS[e.side].icon}` : ''}${e.traits.map((t) => TRAITS[t].name).join('・')}${e.hangoverDay === s.day ? '・🤢宿醉' : ''}</small><small>${sh ? `${hhmm(sh.start)}～${hhmm(sh.end)}` : '今天休假'}</small></span></button>
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
      </div>
      ${s.feature('career') ? careerRow(e) : ''}
      <div class="st-detail-row muted">
        <span>${e.traits.map((t) => `${TRAITS[t].name}：${TRAITS[t].desc}`).join('；')}${e.side && Fun.SIDE_JOBS && Fun.SIDE_JOBS[e.side] ? `；${Fun.SIDE_JOBS[e.side].icon} 斜槓${Fun.SIDE_JOBS[e.side].name}：${Fun.SIDE_JOBS[e.side].perk}，但偶爾會因為副業請假或早退` : ''}</span>
        <span>到職 ${weeks} 週・資遣費約 ${money(s.severanceOf(e))}</span>
      </div>
      ${relationsHtml(e)}
    </div>`;
  }

  // 領導力：知道真正的數字就顯示數字，不然只顯示「看起來」的星星
  const leadStars = (v) => {
    const n = Math.max(1, Math.min(5, Math.round(v / 20)));
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  };
  function leadText(e) {
    const s = ui.sim;
    const k = s.leadKnown(e);
    return k != null ? `領導力 <b>${k}</b>` : `領導力 <span title="看起來的印象，升上去三天後才知道真正的數字">${leadStars(e.leadSeen)}？</span>`;
  }
  function styleText(e) {
    const st = Fun.STYLES[e.style];
    if (e.revealed && st) return `<span class="style-tag" title="${esc(st.desc)}">${st.icon} ${st.name}</span>`;
    return `<span class="muted">同事說：「${esc(e.hint || '……')}」</span>`;
  }

  // 員工設定裡的升遷那一行
  function careerRow(e) {
    const s = ui.sim;
    const R = Fun.RANKS;
    const blockL = s.promoteBlock(e, 'leader');
    const trial = s.inTrial(e);
    const freeBranches = s.branches.map((b, i) => [b, i]).filter(([b]) => !b.manager);
    return `<div class="st-detail-row career-row">
        <span>升遷</span>
        <span class="career-info">${leadText(e)}・${Fun.AMBITION_LABEL(e.ambition)}・${styleText(e)}${e.senior ? '・⭐ 資深' : ''}</span>
        <span class="career-info muted">升組長建議：到職 2 週、技能 50 以上（不到就升，資深的同事會不服）・升資深：到職 3 週、技能 60 以上，不用帶人${e.rank && e.trialBase ? `・試用期 ${s.inTrial(e) ? `還有 ${14 - (s.day - e.rankDay)} 天，期滿會看帶班成績` : '已結束'}` : ''}</span>
        ${e.rank !== 'leader' ? `<button class="act-btn" data-action="promote" data-id="${e.id}" data-rank="leader" ${blockL ? `disabled title="${esc(blockL)}"` : ''}>🎖️ 升組長 +$${R.leader.wage}${blockL ? `<small>${esc(blockL)}</small>` : ''}</button>` : ''}
        ${e.rank !== 'manager' ? `<button class="act-btn" data-action="promote" data-id="${e.id}" data-rank="manager">👑 升店長 +$${R.manager.wage}${s.staff.some((o) => o.rank === 'manager') ? '<small>現任店長會變組長</small>' : ''}</button>` : ''}
        ${e.rank ? `<button class="act-btn warn" data-action="demote" data-id="${e.id}">⬇️ 降職<small>${trial ? '試用期內，不傷感情' : '心情大跌、慣老闆 +1'}</small></button>` : ''}
        ${!e.senior ? `<button class="act-btn" data-action="senior" data-id="${e.id}" ${s.seniorBlock(e) ? `disabled title="${esc(s.seniorBlock(e))}"` : ''}>⭐ 升資深 +$15<small>${esc(s.seniorBlock(e) || '技術職，不用帶人')}</small></button>` : ''}
        <button class="act-btn" data-action="lead-train" data-id="${e.id}" ${e.leadTrainWeek === s.week || s.cash < s.leadTrainCost || e.lead >= 100 ? 'disabled' : ''}>📚 主管培訓 ${money(s.leadTrainCost)}<small>${e.leadTrainWeek === s.week ? '這週上過了' : '領導力 +8'}</small></button>
        ${freeBranches.length ? `<label class="act-btn">🏙️ 派去當分店店長 <select data-action="assign-branch" data-id="${e.id}"><option value="">選分店</option>${freeBranches.map(([b, i]) => `<option value="${i}">${esc(s.siteOf(b).city)}${esc(b.district)}店</option>`).join('')}</select></label>` : ''}
      </div>`;
  }

  // 主管分頁：一眼看完誰在帶人、帶得怎樣、誰有潛力
  function staffLeaders() {
    const s = ui.sim;
    const R = Fun.RANKS;
    const ST = Fun.STYLES;
    const mgr = s.staff.find((e) => e.rank === 'manager');
    const leaders = s.staff.filter((e) => e.rank === 'leader');
    const others = s.staff.filter((e) => !e.rank).sort((a, b) => b.leadSeen - a.leadSeen);
    const fx = s.teamFx();
    const pct = (v) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;
    const now = [];
    if (fx.speed !== 1) now.push(`做事速度 ${pct(fx.speed - 1)}`);
    if (fx.calm !== 1) now.push(`客人耐心 ${pct(1 / fx.calm - 1)}`);
    if (fx.learn !== 1) now.push(`學習 ${pct(fx.learn - 1)}`);
    const moodSum = [...fx.mood.values()].reduce((a, b) => a + b, 0);
    if (fx.mood.size) now.push(`同事心情 ${moodSum >= 0 ? '+' : ''}${Math.round(moodSum)}`);
    if (s.wasteMult < 1) now.push(`{w:supplies}報廢 ${pct(s.wasteMult - 1)}`);
    const kpi = (e) => (e.kpi && e.kpi.days ? `帶班 ${e.kpi.days} 天・客人生氣率 ${((e.kpi.angry / Math.max(1, e.kpi.visitors)) * 100).toFixed(1)}%` : '還沒帶過班');
    const card = (e) => {
      const st = ST[e.style];
      const on = e.state === 'working' || e.state === 'break';
      return `<div class="lead-card ${e.rank}">
        <span class="mini-face">${portraitSVG(e.look, moodOf(e))}</span>
        <div>
          <b>${R[e.rank].icon} ${esc(e.name)}</b> <small>${R[e.rank].name}${s.inTrial(e) ? `・試用中（還有 ${14 - (s.day - e.rankDay)} 天）` : ''}${on ? '・🟢 在班' : ''}</small>
          <div>${e.revealed && st ? `<span class="style-tag">${st.icon} ${st.name}</span> <small>${esc(st.desc)}</small>` : '<small class="muted">🔍 風格還在觀察中（升上去三天後揭曉）</small>'}</div>
          <small>${leadText(e)}・${Fun.AMBITION_LABEL(e.ambition)}・心情 ${Math.round(e.mood)}・${kpi(e)}</small>
        </div>
        <span class="lead-btns">
          <button data-action="lead-train" data-id="${e.id}" ${e.leadTrainWeek === s.week || s.cash < s.leadTrainCost || e.lead >= 100 ? 'disabled' : ''} title="主管培訓：領導力 +8">📚<small>培訓</small></button>
          ${e.rank === 'leader' ? `<button data-action="promote" data-id="${e.id}" data-rank="manager" title="升店長">👑<small>升店長</small></button>` : ''}
          <button data-action="demote" data-id="${e.id}" class="warn" title="${s.inTrial(e) ? '試用期內降職不傷感情' : '降職：心情大跌、慣老闆 +1'}">⬇️<small>降職</small></button>
        </span>
      </div>`;
    };
    return `<div class="drawer-body">
      <div class="staff-sum">
        <span>👑 店長 <b>${mgr ? esc(mgr.name) : '從缺'}</b></span>
        <span>🎖️ 組長 <b>${leaders.length}/${s.leaderCap()}</b></span>
        <span>現在在班的主管：${fx.list.length ? fx.list.map((e) => esc(e.name)).join('、') : '沒有'}</span>
        ${now.length ? `<span class="pos">效果：${now.join('・')}</span>` : ''}
      </div>
      <label class="toggle-row"><input type="checkbox" data-action="delegate" ${s.policy.delegate ? 'checked' : ''} /> <span><b>店長代理處理事件</b><small>你來不及處理（或出門在外）的事件，在班上的店長（沒有店長就找領導力 60 以上的組長）會照他的風格幫你決定：暖心型顧員工、鐵血型顧業績（領導力低的話可能做出慣老闆的選擇）、摸魚型有一半會忘記。</small></span></label>
      <h3>👑 店長</h3>
      ${mgr ? card(mgr) : '<p class="muted">還沒有店長。店長在班上時大家做事快一點、心情好一點，也能幫你處理事件；全店只能有一位。</p>'}
      <h3>🎖️ 組長（每 3 個員工可以有 1 位）</h3>
      ${leaders.map(card).join('') || '<p class="muted">還沒有組長。組長在班上時，一般員工心情會好一點，效果看他的風格。</p>'}
      <h3>🌱 潛力名單</h3>
      <div class="pot-list">${others
        .map(
          (e) => `<div class="pot-row">
          <span class="mini-face">${portraitSVG(e.look, moodOf(e))}</span>
          <span><b>${esc(e.name)}</b><small>技能 ${Math.round(e.skill)}・到職 ${Math.max(0, Math.floor((s.day - e.hiredDay) / 7))} 週・${e.traits.map((t) => TRAITS[t].name).join('、')}</small><small>${leadText(e)}・${Fun.AMBITION_LABEL(e.ambition)}</small><small class="muted">同事說：「${esc(e.hint || '……')}」</small></span>
          <span class="lead-btns">
            <button data-action="promote" data-id="${e.id}" data-rank="leader" ${s.promoteBlock(e, 'leader') ? 'disabled' : ''} title="${esc(s.promoteBlock(e, 'leader') || '升組長')}">🎖️<small>升組長</small></button>
            <button data-action="promote" data-id="${e.id}" data-rank="manager" title="升店長">👑<small>升店長</small></button>
            ${!e.senior ? `<button data-action="senior" data-id="${e.id}" ${s.seniorBlock(e) ? 'disabled' : ''} title="${esc(s.seniorBlock(e) || '升資深：技術職，不用帶人，時薪 +$15')}">⭐<small>升資深</small></button>` : ''}
          </span>
        </div>`
        )
        .join('') || '<p class="muted">大家都是主管了（？）</p>'}</div>
      ${
        s.branches.length
          ? `<h3>🏙️ 分店店長</h3><div class="pot-list">${s.branches
              .map((b, i) => {
                const m = b.manager;
                const st = m && ST[m.style];
                return `<div class="pot-row"><span class="mini-face">${m ? portraitSVG(m.look, 'happy') : '🏪'}</span><span><b>${esc(s.siteOf(b).city)}${esc(b.district)}店</b><small>${m ? `店長 ${esc(m.name)}・${st ? `${st.icon}${st.name}` : ''}・領導力 ${m.lead}・時薪 ${money(m.wage)}` : '沒有店長：到員工設定的「派去當分店店長」指派'}</small><small>士氣 ${Math.round(b.morale)}・★ ${b.rating.toFixed(1)}</small></span>${m ? `<span class="lead-btns"><button data-action="recall-mgr" data-i="${i}">🏪<small>調回本店</small></button></span>` : ''}</div>`;
              })
              .join('')}</div>`
          : ''
      }
      ${authPanel()}
      <p class="drawer-tip">每個人都有看不到的「領導力」和「企圖心」：技能好不一定會帶人（彼得原理），企圖心太低的人被升上去會壓力很大，企圖心高的人等太久會主動來要求升遷。升職後有 14 天試用期。</p>
    </div>`;
  }

  // 🎨 裝潢狀態：美觀分、風格、流行、新舊
  function decorSummary() {
    const s = ui.sim;
    const D = s.decor;
    const th = s.themeInfo;
    const tr = s.decorTrend && s.decorTrend.until >= s.day ? DECOR_THEMES[s.decorTrend.theme] : null;
    const pct = (v) => `${Math.round(v * 100)}%`;
    const counts = Object.entries(D.counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${DECOR_THEMES[k].icon}${DECOR_THEMES[k].name} ${n} 件`).join('・');
    return `<div class="decor-sum">
      <div><span>美觀分</span><b>${Math.round(D.A)}</b><small>來客 +${pct(0.3 * (1 - Math.exp(-D.A / 35)))}・評價 +${(0.55 * (1 - Math.exp(-D.A / 30))).toFixed(2)}・可以多收 ${pct(s.priceTolerance)} 不掉客</small></div>
      <div><span>風格</span><b>${th ? `${th.icon}${th.name}` : D.mixed ? '😵 太雜' : '還沒成形'}</b><small>${th ? th.desc : D.mixed ? '兩種風格都很多、又都不夠突出：美觀分 -10%' : '同一種風格放 3 件以上、佔一半以上的美觀分，就會有風格加成'}${counts ? `<br>${counts}` : ''}</small></div>
      <div><span>新舊</span><b>${pct(D.fresh)}</b><small>裝潢放久了會舊（最多 -35%）${tr ? `<br>🔥 最近流行${tr.icon}${tr.name}風（效果 +25%）` : ''}</small>${D.fresh < 0.9 ? `<button data-action="refresh-decor" ${s.cash < s.refreshCost ? 'disabled' : ''}>🧽 翻新（${money(s.refreshCost)}）</button>` : ''}</div>
    </div>`;
  }

  // 🐾 寵物：店寵和寵物友善
  function petsPanel() {
    const s = ui.sim;
    const P = Fun.PETS || {};
    const T = Fun.PET_TRAITS || {};
    const mine = s.pets.map((p) => {
      const d = P[p.kind];
      return `<div class="pet-card">
        <div class="room-head"><span class="room-icon">${d.icon}</span><div><b>${esc(p.name)}</b><small>${d.name}・${T[p.trait] ? T[p.trait].name : ''}・來店第 ${s.day - p.since + 1} 天${p.calm ? '・有圍欄' : ''}</small></div></div>
        <div class="ibar"><span>開心</span><div class="bar"><div class="bar-fill morale" style="width:${Math.round(p.joy)}%"></div></div><b>${Math.round(p.joy)}</b></div>
        <div class="ibar"><span>健康</span><div class="bar"><div class="bar-fill ${p.health < 55 ? 'jerk' : 'skill'}" style="width:${Math.round(p.health)}%"></div></div><b>${Math.round(p.health)}</b></div>
        <div class="insp-actions"><button data-action="pet-play" data-id="${p.id}" ${p.playDay === s.day ? 'disabled' : ''}>🤗 陪牠玩</button><button data-action="pet-vet" data-id="${p.id}" ${s.cash < d.vet || p.vetDay === s.day ? 'disabled' : ''}>🩺 看獸醫 ${money(d.vet)}</button><button data-action="pet-rehome" data-id="${p.id}" class="warn">🏡 送養</button></div>
      </div>`;
    });
    return `<p class="calc">寵物越開心，吸引力越強；但每天要飼料錢，餐飲業養寵物要注意衛生（稽查會扣分，裝圍欄可以降低），對貓狗過敏的客人和員工也會不開心。最多養 3 隻。</p>
      ${mine.length ? `<div class="room-list">${mine.join('')}</div>` : '<p class="muted">店裡還沒有寵物。</p>'}
      ${s.pets.length < 3 ? `<h3>領養</h3><div class="catalog">${Object.entries(P)
        .map(([k, d]) => `<button class="cat-item" data-action="pet-adopt" data-kind="${k}" ${s.cash < d.adopt ? 'disabled' : ''}><span class="cat-icon">${d.icon}</span><b>${d.name}</b><span class="cat-price">${money(d.adopt)}</span><small>${d.desc}・每週約 ${money(d.weekly)}</small></button>`)
        .join('')}</div>` : ''}
      <h3>🐾 寵物友善</h3>
      <label class="toggle-row"><input type="checkbox" data-action="pet-friendly" ${s.policy.petFriendly ? 'checked' : ''} /> <span><b>歡迎客人帶毛孩</b><small>帶毛孩的客人會來、常順便買點心、粉絲變多；但會有狗打架、尿尿、過敏客人抗議${s.isFood ? '，衛生稽查也會比較嚴' : ''}。${s.policy.petStrict ? '目前有「牽繩守則」：問題少一點，客人也少一點。' : ''}${s.flags.has('petZone') ? '已經劃了無毛孩區。' : ''}</small></span></label>`;
  }

  // 🚪 後場：四個房間，各三級
  function backroomPanel() {
    const s = ui.sim;
    const R = Fun.ROOMS || {};
    const door = s.backDoorCell();
    return `<p class="calc">後場在店面後方，客人看不到（廁所除外）。門開在後牆最右邊那一格，不要擺東西擋住。轉到店的背面就看得到裡面${ui.view ? '：<button class="link" data-action="cam-back">👀 看後場</button>' : ''}。</p>
      ${door ? '' : '<p class="calc warn">⚠️ 後牆那一排都被擋住了，要空出一格當後場的門。</p>'}
      <div class="room-list">${Object.entries(R)
        .map(([id, r]) => {
          const lv = s.roomLv(id);
          const next = r.levels[lv];
          const cost = s.roomCost(id);
          const locked = s.level < r.lv;
          return `<div class="room-card ${lv ? 'built' : ''}">
            <div class="room-head"><span class="room-icon">${r.icon}</span><div><b>${r.name}</b><small>${lv ? `第 ${lv} 級：${r.levels[lv - 1].name}` : '還沒蓋'}</small></div></div>
            <p class="room-now">${lv ? r.levels[lv - 1].desc : r.intro}</p>
            ${id === 'toilet' && lv ? `<div class="ibar"><span>乾淨度</span><div class="bar"><div class="bar-fill ${s.toiletClean < 50 ? 'jerk' : 'morale'}" style="width:${Math.round(s.toiletClean)}%"></div></div><b>${Math.round(s.toiletClean)}</b></div>
              <label class="toggle-row small"><input type="checkbox" data-action="toilet-open" ${s.policy.toiletOpen ? 'checked' : ''} /> <span><b>開放路人借廁所</b><small>會帶來一些順便消費的人，但廁所髒得比較快、事件也比較多</small></span></label>
              ${s.toiletDownUntil >= s.day ? '<p class="calc warn">🔧 廁所維修中，暫停使用</p>' : ''}` : ''}
            ${next ? `<button class="primary" data-action="build-room" data-id="${id}" ${locked || s.cash < cost || !door ? 'disabled' : ''}>${locked ? `🔒 Lv.${r.lv} 解鎖` : `${lv ? '升級成' : '蓋'}「${next.name}」${money(cost)}`}</button><small class="muted">${next.desc}</small>` : '<small class="muted">已經是最高級</small>'}
          </div>`;
        })
        .join('')}</div>`;
  }

  // 🧰 會做哪些兼營業務；沒學過的可以花錢送去上課
  function skillsHtml(e) {
    const s = ui.sim;
    const owned = s.ownedSide().filter((b) => !b.self);
    if (!owned.length) return '';
    const known = owned.filter((b) => s.knows(e, b.id)).length;
    return `<div class="skill-row"><small>🧰 兼營技能 ${known}/${owned.length}${owned.length - known >= 2 ? '・<span class="neg">業務太雜，心情會變差</span>' : ''}</small><div>${owned
      .map((b) => (s.knows(e, b.id) ? `<span class="chip ok">${b.icon} ${b.name} ✓</span>` : `<button class="chip-btn" data-action="train" data-id="${b.id}" ${s.cash < s.trainCost || e.trainDay === s.day ? 'disabled' : ''} title="送去上課學會（$${s.trainCost.toLocaleString()}，每人每天一門）">${b.icon} ${b.name}・📚 $${s.trainCost.toLocaleString()}</button>`))
      .join('')}</div></div>`;
  }

  // 🔀 斜槓員工的副業標籤
  function sideChip(x) {
    const j = x && x.side && Fun.SIDE_JOBS && Fun.SIDE_JOBS[x.side];
    return j ? `<span class="chip side" title="${esc(j.perk)}">${j.icon} 斜槓・${j.name}</span>` : '';
  }

  // 📋 授權制度＋🗺️ 區經理（章節解鎖後才出現）
  function authPanel() {
    const s = ui.sim;
    let out = '';
    if (s.feature('auth')) {
      const A = s.policy.auth;
      const agent = s.authAgent;
      const RULES = [
        ['complaint', '😤 客訴', [['off', '要問我'], ['fix', '照合理的方式處理（退費、補償）']]],
        ['karen', '🤬 奧客', [['off', '要問我'], ['staff', '站在員工這邊，必要時請他離開']]],
        ['fight', '💢 員工吵架', [['off', '要問我'], ['mediate', '主管出面調解'], ['course', '送去上溝通課']]],
        ['branch', '🏙️ 分店狀況', [['off', '要問我'], ['fix', '照建議處理']]],
        ['misc', '📦 其他小事', [['off', '要問我'], ['kind', '選對員工和客人好的']]],
      ];
      const sel = (key, opts, v) => `<select data-action="auth-set" data-key="${key}">${opts.map(([id, l]) => `<option value="${id}" ${v === id ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
      out += `<h3>📋 授權制度</h3>
      <p class="muted">${agent ? `現在由 <b>${esc(agent.title)}${esc(agent.name)}</b> 依規則處理。` : '⚠️ 現在沒有人可以代你處理：要有店長在班，或任命區經理。'}升遷、外人上門的事情，一定會交給你。已代處理 ${s.authCount || 0} 件。</p>
      <div class="auth-grid">${RULES.map(([k, l, o]) => `<label><span>${l}</span>${sel(k, o, A[k] || 'off')}</label>`).join('')}
        <label><span>💰 單件預算上限</span>${sel('budget', [1000, 5000, 20000, 50000].map((v) => [String(v), money(v)]), String(A.budget || 0))}</label>
      </div>`;
    }
    if (s.feature('area')) {
      const am = s.areaManager;
      out += `<h3>🗺️ 區經理</h3>`;
      if (am) {
        const st = Fun.STYLES[am.style];
        out += `<div class="lead-card manager"><span class="mini-face">${portraitSVG(am.look, 'happy')}</span><div><b>🗺️ ${esc(am.name)}</b> <small>區經理・第 ${am.since} 週上任</small><div><small>${st ? `${st.icon}${st.name}・` : ''}領導力 ${am.lead}・時薪 ${money(am.wage)}</small></div><small>所有分店士氣 +${Math.round(3 + (am.lead - 50) / 10)}／週、總部管理費 -30%，也會代你處理授權事件。</small></div></div>`;
      } else {
        const cands = s.branches.map((b, i) => [b, i]).filter(([b]) => b.manager);
        out += cands.length
          ? `<p class="muted">從分店店長裡挑一位升區經理：他會離開原本的分店，改成巡所有分店。</p><div class="pot-list">${cands
              .map(([b, i]) => `<div class="pot-row"><span class="mini-face">${portraitSVG(b.manager.look, 'happy')}</span><span><b>${esc(b.manager.name)}</b><small>${esc(s.siteOf(b).city)}${esc(b.district)}店店長・領導力 ${b.manager.lead}</small></span><span class="lead-btns"><button data-action="appoint-area" data-i="${i}">🗺️<small>升區經理</small></button></span></div>`)
              .join('')}</div>`
          : '<p class="muted">要先有分店店長，才能從裡面挑一位升區經理。</p>';
      }
    }
    return out;
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
        ${(() => {
          const cov = s.coverage();
          const cells = cov.days.map((per) => (per ? `<span class="sc-cover ${Math.min(...per) < cov.lanes ? 'neg' : 'pos'}" title="${shiftNames.map((nm, k) => `${nm} ${per[k]} 人`).join('、')}">${per.join('／')}</span>` : '<span class="muted">—</span>'));
          return `<div class="sc-row sc-foot"><span><b>每班人數</b></span><span><small>服務位 ${cov.lanes} 個</small></span>${cells.join('')}<span></span><span class="muted"><small>${n > 1 ? `${shiftNames.join('／')}的人數；` : ''}比服務位少（紅色）尖峰時客人會等很久</small></span></div>`;
        })()}
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
              <div><b>${esc(c.name)}</b><div class="chips">${c.traits.map((t) => `<span class="chip" title="${TRAITS[t].desc}">${TRAITS[t].name}</span>`).join('')}${sideChip(c)}</div>
              ${c.side && Fun.SIDE_JOBS[c.side] ? `<small class="pos">${Fun.SIDE_JOBS[c.side].icon} ${Fun.SIDE_JOBS[c.side].perk}；會因為副業請假或早退</small>` : ''}<small>技能 ${c.skill}・希望時薪 ${money(c.wage)}</small><small>面試印象：領導力 ${leadStars(c.leadSeen || 50)}？・${Fun.AMBITION_LABEL(c.ambition ?? 50)}</small><small class="muted">${c.traits.map((t) => TRAITS[t].desc).join('；')}</small></div>
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
    const bodies = Fun.POST_BODIES.filter((b) => (!b.trend || b.trend === (t && t.id)) && (!b.ind || b.ind.includes(s.ind.id)));
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
          <h3>{w:supplies}庫存 <small>每天開門前送貨；急件約 40 分鐘到，貴三成</small></h3>
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
          ${s.lastDay && s.lastDay.waste ? `<p class="calc">昨晚報廢了 ${money(s.lastDay.waste)} 的{w:supplies}。</p>` : ''}
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

  function seasonalCard() {
    const s = ui.sim;
    const it = s.seasonalItem;
    const on = s.seasonal && s.seasonal.until >= s.day;
    return `<div class="seasonal-card">
      <b>🍂 季節限定</b>
      ${on ? `<p>「${esc(s.seasonal.name)}」販售中，到第 ${s.seasonal.until} 天${s.branches.length ? '（分店也一起賣，來客 +6%）' : ''}。</p>` : `<p>現在是${it.season}：推出「${esc(it.name)}」四週，客人 +12%${s.branches.length ? '、分店 +6%' : ''}。同一個品項連續推，效果會變差。</p><button class="primary" data-action="seasonal" ${s.cash < s.seasonalCost ? 'disabled' : ''}>推出（研發＋行銷 ${money(s.seasonalCost)}）</button>`}
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
          <h3>{w:menu}與價格 <small>建議價會跟著物價漲</small></h3>
          <div class="price-list">
            ${s.ind.products
              .filter((pr) => !pr.side || s.stations.some((o) => o.def.serves.includes(pr.id)))
              .map((pr) => {
                if (pr.rd && !s.recipes.has(pr.id)) {
                  const can = s.level >= (pr.lv || 1);
                  return `<div class="price-row locked"><span class="price-name">🧪 ${pr.icon} ${pr.name}</span><button data-action="research" data-id="${pr.id}" ${!can || s.cash < s.rdCost(pr) ? 'disabled' : ''}>${can ? `研發 ${money(s.rdCost(pr))}` : `Lv.${pr.lv} 才能研發`}</button><small>新品・建議價 $${Math.round((pr.price * s.idx.cpi) / 5) * 5}・菜單越豐富，客人越多</small></div>`;
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
          ${s.feature('seasonal') ? seasonalCard() : ''}
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
      ['{w:supplies}進貨', -L.materials],
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
      ['加盟權利金、中央廚房', L.group || 0],
      ['成就獎金', L.rewards || 0],
      ['設備、研發與其他', L.other],
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
            <tr class="total"><th>合計</th><td class="${net < 0 ? 'neg' : 'pos'}">${signedMoney(net)}</td></tr>
            ${s.branches.length ? `<tr><th>　其中本店</th><td class="${net - (L.branches || 0) < 0 ? 'neg' : 'pos'}">${signedMoney(net - (L.branches || 0))}</td></tr><tr><th>　其中分店（週末結算）</th><td>${L.branches ? signedMoney(L.branches) : '上週 ' + signedMoney(s.branches.reduce((t, b) => t + (b.last || 0), 0))}</td></tr>` : ''}</table>
          ${L.waste ? `<p class="calc">{w:supplies}進貨裡有 ${money(L.waste)} 是過期報廢掉的。</p>` : ''}
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
          <h3>📜 事件紀錄 <small>最近 ${Math.min(15, (s.eventLog || []).length)} 件</small></h3>
          ${(s.eventLog || []).length ? `<div class="event-log">${s.eventLog.slice(0, 15).map((l) => `<div class="${l.by === '逾時沒處理' ? 'late' : ''}"><small>第 ${l.day} 天 ${l.time}・${esc(l.by)}</small><b>${l.icon} ${esc(l.title)}</b><span>→ ${esc(l.choice)}${l.left && l.left.length ? `　👋 ${l.left.map((x) => esc(x.name)).join('、')} 離開` : ''}${l.delta ? ['cash', 'morale', 'jerk'].filter((k) => l.delta[k]).map((k) => `　${{ cash: '💰', morale: '😊', jerk: '😈' }[k]}${l.delta[k] > 0 ? '+' : ''}${k === 'cash' ? '$' + l.delta[k].toLocaleString() : l.delta[k]}`).join('') : ''}</span></div>`).join('')}</div>` : '<p class="muted">還沒有處理過事件。</p>'}
        </div>
      </div>`;
  }

  // 評論：跟評價用同一批（最近 100 則），低分的原因分類統計，知道該改善什麼
  const WHY = {
    wait: ['⏳', '排太久', '人手或設備不夠：多請人、多買一台設備，或在尖峰多排人'],
    price: ['💲', '價格太貴', '價格比建議價高太多，學生和長輩最在意'],
    service: ['😮‍💨', '服務態度', '員工心情或精力太差：讓他們休息、加薪、稱讚'],
    hot: ['🥵', '太熱', '夏天要有冷氣或電風扇'],
    clean: ['🧽', '衛生', '叫大家打掃，油垢太多要請清潔公司大掃除'],
    soldout: ['📦', '賣完了', '進貨量調高，或打開自動進貨'],
    image: ['📰', '形象', '炎上、負面新聞、對員工太刻薄'],
    rival: ['🏪', '對手', '隔壁搞小動作'],
    event: ['⚡', '事件', '事件的選擇造成的'],
    pet: ['🐾', '毛孩', '對貓狗過敏的客人：劃無毛孩區、店寵裝圍欄，或關掉寵物友善'],
    toilet: ['🚽', '廁所', '沒有廁所、廁所太髒或要排很久：到「建造 → 後場」蓋廁所，記得有人打掃'],
  };
  // 長期目標的進度
  function longProgress(id) {
    const s = ui.sim;
    const br = s.branches;
    if (id === 'chain5') return `現在 ${br.length}/5 間，${br.filter((b) => b.rating >= 4.5).length} 間在 4.5 星以上`;
    if (id === 'mentor3') return `現在 ${br.filter((b) => b.manager).length}/3 間有店長`;
    if (id === 'week500') return `最高一週 ${money(Math.max(0, ...s.history.map((h) => h.profit)))}`;
    if (id === 'allhappy') return `本店心情 ${Math.round(s.morale)}・分店最低士氣 ${br.length ? Math.round(Math.min(...br.map((b) => b.morale))) : '—'}`;
    if (id === 'year2') return `現在第 ${s.week} 週`;
    return '';
  }

  // ───── 📜 章節任務 ─────
  function renderQuestChip() {
    const el = document.getElementById('quest-chip');
    if (!el || !ui.sim) return;
    const s = ui.sim;
    const ch = s.chapter;
    const p = s.progress;
    let html;
    if (p.ended) html = '<span class="qi">📜</span><span><b>全部完成</b></span>';
    else if (!ch && s.feature('route')) html = '<span class="qi">🛤️</span><span><b>選擇第二幕的路線</b><small>點這裡做決定</small></span>';
    else if (!ch) html = '';
    else {
      const n = ch.quests.filter((q) => p.done.includes(q.id)).length;
      const next = ch.quests.find((q) => !p.done.includes(q.id));
      html = `<span class="qi">${ch.icon}</span><span><b>${esc(ch.name.split('：')[0])} ${n}/${ch.quests.length}</b><small>${next ? esc(next.text) : ''}</small></span>`;
    }
    el.hidden = !html || !!ui.tab;
    if (el.dataset.html !== html) {
      el.innerHTML = html;
      el.dataset.html = html;
    }
  }

  function questList(ch) {
    const s = ui.sim;
    const p = s.progress;
    return `<ul class="quest-list">${ch.quests.map((q) => {
      const done = p.done.includes(q.id);
      return `<li class="${done ? 'done' : ''}"><span>${done ? '✅' : '⬜'}</span><div><b>${esc(q.text)}</b>${!done && q.prog ? `<small>${esc(q.prog(s))}</small>` : ''}</div></li>`;
    }).join('')}</ul>`;
  }

  function drawerQuests() {
    const s = ui.sim;
    const C = Fun.CHAPTERS || [];
    const p = s.progress;
    const ch = s.chapter;
    const feat = (ids) => ids.map((f) => `<span class="feat">${Fun.FEATURES[f].icon} ${Fun.FEATURES[f].name}</span>`).join('');
    let main = '';
    if (ch) {
      main = `<div class="chapter-card">
        <div class="chapter-head"><span>${ch.icon}</span><div><b>${esc(ch.name)}</b><small>${esc(ch.story)}</small></div></div>
        ${questList(ch)}
        ${ch.route ? '' : `<p class="calc">完成獎勵：${money(ch.reward.cash)}＋經驗 ${ch.reward.xp.toLocaleString()}</p><div class="feat-row"><small>解鎖：</small>${feat(ch.unlock)}</div>`}
      </div>`;
    } else if (s.feature('route') && !p.route) {
      main = `<div class="chapter-card"><div class="chapter-head"><span>🛤️</span><div><b>第二幕：你想讓這間店變成什麼樣子？</b><small>兩條路都能走到最後，選了就不能換。</small></div></div>
        <div class="route-pick">${Object.entries(Fun.ROUTES).map(([id, r]) => `<div class="route"><b>${r.icon} ${r.name}</b><p>${r.desc}</p><ul>${r.quests.map((q) => `<li>${esc(q.text)}</li>`).join('')}</ul><button class="primary" data-action="route" data-id="${id}">走這條路</button></div>`).join('')}</div></div>`;
    } else if (p.ended) {
      const R = Fun.ROUTES[p.route];
      main = `<div class="chapter-card"><div class="chapter-head"><span>${R.ending.medal}</span><div><b>${R.ending.title}</b><small>${R.ending.text}</small></div></div><p class="calc">故事結束了，但店會一直開下去。你可以繼續經營、挑戰長期目標。</p></div>`;
    }
    const past = C.filter((c) => p.chapters.includes(c.id));
    const future = C.slice(p.chapter + 1);
    return `<div class="drawer-body two-col">
      <div>${main}</div>
      <div>
        <h3>已解鎖的玩法</h3>
        <div class="feat-row">${p.features.length ? feat(p.features) : '<small class="muted">完成第一章就會開始解鎖新玩法。</small>'}</div>
        ${past.length ? `<h3>完成的章節</h3>${past.map((c) => `<p class="calc">${c.icon} ${esc(c.name)} ✅</p>`).join('')}` : ''}
        ${future.length ? `<h3>接下來</h3>${future.map((c) => `<p class="calc muted">🔒 ${esc(c.name)}</p>`).join('')}` : ''}
        <p class="drawer-tip">玩法會一章一章開放，不用一次學全部。任務每天打烊後檢查一次。</p>
      </div>
    </div>`;
  }

  function drawerReviews() {
    const s = ui.sim;
    const r = s.rating;
    const recent = s.reviews.slice(-100);
    const low = recent.filter((v) => v.stars <= 3);
    const count = {};
    for (const v of low) count[v.why || 'event'] = (count[v.why || 'event'] || 0) + 1;
    const top = Object.entries(count).sort((a, b) => b[1] - a[1]);
    const dist = [5, 4, 3, 2, 1].map((n) => recent.filter((v) => Math.round(v.stars) === n).length);
    const list = (ui.reviewLow ? low : recent).slice(-40).reverse();
    return `
      <div class="drawer-body two-col">
        <div>
          <div class="rating-big"><b>${r.toFixed(1)}</b><span class="stars">${stars(r)}</span><small>評價＝最近 ${recent.length} 則評論的平均・評價越高，路過的人越願意進來</small></div>
          <div class="rating-dist">${dist.map((n, i) => `<div><span>${5 - i}★</span><i style="width:${recent.length ? (n / recent.length) * 100 : 0}%"></i><b>${n}</b></div>`).join('')}</div>
          <h3>低分的原因 <small>最近 ${recent.length} 則裡有 ${low.length} 則三星以下</small></h3>
          ${top.length ? `<div class="why-list">${top.map(([k, n]) => `<div><b>${WHY[k][0]} ${WHY[k][1]}</b><span>${n} 則</span><small>${WHY[k][2]}</small></div>`).join('')}</div>` : '<p class="muted">最近沒有低分評論，繼續保持！</p>'}
        </div>
        <div>
          <div class="segmented tiny"><button data-action="review-filter" data-value="" class="${ui.reviewLow ? '' : 'active'}">全部</button><button data-action="review-filter" data-value="low" class="${ui.reviewLow ? 'active' : ''}">只看三星以下</button></div>
          <div class="review-list">
            ${list.map((v) => `<div class="review"><span class="stars">${stars(v.stars)}</span><p>${esc(v.text)}</p><small>第 ${v.day} 天${v.stars <= 3 && WHY[v.why || 'event'] ? `・${WHY[v.why || 'event'][0]} ${WHY[v.why || 'event'][1]}` : ''}</small></div>`).join('') || '<p class="muted">還沒有人留評論。</p>'}
          </div>
        </div>
      </div>`;
  }

  function drawerGoals() {
    const s = ui.sim;
    const lv = s.level;
    const next = LEVELS[lv];
    const upcoming = CATALOG.filter((d) => d.lv && d.lv > lv && (!d.industries || d.industries.includes(s.ind.id))).sort((a, b) => a.lv - b.lv).slice(0, 6);
    const canBranch = lv >= 5 && s.branches.length < BRANCH_SITES.length;
    return `
      <div class="drawer-body two-col">
        <div>
          <h3>店家等級 <small>賺的毛利越多，經驗越高</small></h3>
          <div class="level-card"><b>Lv.${lv}</b><div class="bar"><div class="bar-fill skill" style="width:${Math.round(s.levelProgress * 100)}%"></div></div><small>${next ? `${Math.round(s.xp).toLocaleString()} / ${next.toLocaleString()}` : '已經是最高等級'}</small></div>
          ${upcoming.length ? `<p class="calc">即將解鎖：${upcoming.map((d) => `${d.icon}${d.name}（Lv.${d.lv}）`).join('、')}</p>` : ''}
          ${(() => { const perks = Object.entries(Fun.LEVEL_PERKS || {}).filter(([l]) => Number(l) > lv).slice(0, 3); return perks.length ? `<p class="calc">等級獎勵：${perks.map(([l, t]) => `Lv.${l} ${t}`).join('・')}</p>` : ''; })()}
          <h3>🏢 公司與老闆 <small>公司的錢不等於老闆的錢</small></h3>
          <div class="company-card">
            <div><span>公司現金</span><b>${money(s.cash)}</b></div>
            <div><span>公司估值</span><b>${money(s.valuation)}</b><small>最近 8 週本業淨利 × 本益比＋資產</small></div>
            <div><span>老闆個人財富</span><b>${money(s.owner.wealth)}</b><small>領分紅才會進來（扣 20% 稅）</small></div>
          </div>
          <div class="branch-ctl"><button data-action="dividend" data-p="0.1" ${s.cash * 0.9 < 100000 ? 'disabled' : ''}>💰 領分紅 10%（${money(Math.round(s.cash * 0.1))}）</button><button data-action="dividend" data-p="0.3" ${s.cash * 0.7 < 100000 ? 'disabled' : ''}>💰 領 30%</button></div>
          <p class="drawer-tip">員工時薪還低於行情就領分紅，大家會不爽、慣老闆指數上升。</p>
          <h3>附近的競爭 <small>評價、價格、乾淨程度決定客人選誰</small></h3>
          ${rivalCard()}
          <h3>分店 <small>${lv >= 5 ? '每間分店可以調時薪、定價、人手和改裝' : '店家 Lv.5 才能開分店'}</small></h3>
          <div class="branch-list">
            ${s.branches.map((b, i) => branchCard(b, i)).join('') || '<p class="muted">還沒有分店。</p>'}
          </div>
          ${canBranch && s.feature('branch') ? `<button class="primary" data-action="branch-sites">🗺️ 挑地點開分店</button>` : canBranch ? '<p class="calc">🔒 完成「📜 第二章：站穩腳步」就能開分店。</p>' : ''}
          ${groupPanel()}
          ${s.awards.length ? `<h3>年度好店評選</h3>${s.awards.map((a) => `<p class="calc">${a.medal} 第 ${a.year} 年：${a.title}（${a.score} 分）</p>`).join('')}` : '<p class="drawer-tip">每年 12 月最後一週結束時，會舉辦年度好店評選。</p>'}
        </div>
        <div>
          <h3>🎯 長期目標 <small>拿到金獎之後的下一步</small></h3>
          <div class="goal-list">
            ${ACHIEVEMENTS.filter((a) => a.long).map((a) => `<div class="goal ${s.achievements.has(a.id) ? 'done' : ''}"><span>${s.achievements.has(a.id) ? '🏆' : '🎯'}</span><div><b>${a.name}</b><small>${a.desc}${s.achievements.has(a.id) ? '' : `・${longProgress(a.id)}`}</small></div><em>${money(a.reward)}</em></div>`).join('')}
          </div>
          <h3>成就</h3>
          <div class="goal-list">
            ${ACHIEVEMENTS.filter((a) => !a.long).map((a) => `<div class="goal ${s.achievements.has(a.id) ? 'done' : ''}"><span>${s.achievements.has(a.id) ? '🏆' : '🔒'}</span><div><b>${a.name}</b><small>${a.desc}</small></div>${a.reward ? `<em>${money(a.reward)}</em>` : ''}</div>`).join('')}
          </div>
          <p class="drawer-tip">沙盒遊戲沒有時間限制。慣老闆指數到 100，或現金是負的又借不到錢，店就會收起來。</p>
        </div>
      </div>`;
  }

  // 章節解鎖的集團玩法：中央廚房、加盟、第二幕路線
  function groupPanel() {
    const s = ui.sim;
    let out = '';
    if (s.feature('kitchen')) {
      const K = s.kitchenName;
      out += `<h3>🏭 ${K} <small>所有店一起降成本，也一起承擔風險</small></h3>`;
      out += s.kitchen
        ? `<div class="group-card"><p class="calc">✅ 運作中${s.kitchen.downUntil >= s.day ? `（<span class="neg">停工檢查到第 ${s.kitchen.downUntil} 天</span>）` : ''}：本店進貨 -10%、分店 -15%・每週維護 ${money(s.kitchenUpkeep)}・出過 ${s.kitchen.issues} 次狀況</p>
          ${s.kitchen.backup ? '<p class="calc">🤝 已簽備援{w:supplier}：出狀況時可以馬上切換</p>' : `<button data-action="kitchen-backup" ${s.cash < s.backupCost ? 'disabled' : ''}>🤝 簽備援{w:supplier}（${money(s.backupCost)}）</button><small class="muted">出包的機率變低，出事時多一個安全的選項</small>`}</div>`
        : `<div class="group-card"><p class="calc">蓋一座${K}：本店進貨成本 -10%、分店 -15%，每週維護 ${money(s.kitchenUpkeep)}。偶爾會出包，一出包就是所有店一起。</p><button class="primary" data-action="build-kitchen" ${s.cash < s.kitchenCost ? 'disabled' : ''}>🏗️ 蓋${K}（${money(s.kitchenCost)}）</button></div>`;
    }
    if (s.feature('franchise')) {
      const F = s.franchises || [];
      if (!s.franchiseApps) s.rollFranchiseApps();
      out += `<h3>🤝 加盟 <small>${F.length}/${s.franchiseCap} 間・每間收加盟金 ${money(s.franchiseFee)}＋營收 6% 權利金</small></h3>`;
      out += F.length ? `<div class="pot-list">${F.map((f) => `<div class="pot-row"><span class="mini-face">🏪</span><span><b>${esc(f.city)}${esc(f.district)}加盟店</b><small>加盟主 ${esc(f.name)}・★ ${f.rating.toFixed(1)}・上週權利金 ${money(f.last || 0)}</small></span></div>`).join('')}</div>` : '';
      out += F.length < s.franchiseCap
        ? `<p class="calc">想加盟的人（每兩週換一批）：面談印象不一定準，加盟主怎麼對員工，會算在你的品牌上。</p><div class="pot-list">${(s.franchiseApps || []).map((a) => `<div class="pot-row"><span class="mini-face">🙋</span><span><b>${esc(a.name)}・想開在${esc(a.city)}${esc(a.district)}</b><small class="muted">面談印象：「${esc(a.note)}」</small></span><span class="lead-btns"><button data-action="franchise-accept" data-id="${a.id}">🤝<small>簽約</small></button></span></div>`).join('')}</div>`
        : '<p class="calc">加盟店數量到上限了：多開直營分店，才有能力管更多加盟店。</p>';
    }
    const route = s.progress && s.progress.route;
    if (route === 'ipo') {
      const I = s.ipo;
      out += `<h3>🔔 上市之路</h3><div class="group-card">`;
      if (!I) out += `<p class="calc">公司估值達到 ${money(s.raiseNeed)} 就能找投資人（現在 ${money(s.valuation)}）。募資會拿到估值 15% 的現金，之後每季要交成績單。</p><button class="primary" data-action="ipo-raise" ${s.valuation < s.raiseNeed ? 'disabled' : ''}>💼 引進投資人</button>`;
      else if (!I.listed) out += `<p class="calc">這一季（還有 ${Math.max(0, 13 - (s.week - I.qWeek))} 週）：淨利 ${money(Math.round(I.qProfit))} / 目標 ${money(I.target)}・連續達標 ${I.streak} 季</p><div class="bar"><div class="bar-fill skill" style="width:${Math.min(100, Math.round((I.qProfit / Math.max(1, I.target)) * 100))}%"></div></div><button class="primary" data-action="ipo-list" ${I.streak < 3 || s.jerk >= 20 ? 'disabled' : ''}>🔔 申請掛牌${I.streak < 3 ? `（要連續 3 季達標）` : s.jerk >= 20 ? '（慣老闆指數要低於 20）' : ''}</button>`;
      else out += '<p class="calc">🔔 已經掛牌上市。</p>';
      out += '</div>';
    } else if (route === 'coop') {
      const C = s.coop;
      out += `<h3>🤲 員工持股・百年老店</h3><div class="group-card">`;
      if (!C) out += `<p class="calc">拿出 ${money(s.sharesCost)} 的股份分給員工：所有人心情 +15、之後每週慢慢變好，分店士氣也會更穩。</p><button class="primary" data-action="coop-shares" ${s.cash < s.sharesCost ? 'disabled' : ''}>🤲 推出員工持股計畫</button>`;
      else if (!C.heir) {
        const H = s.heirCandidates();
        out += `<p class="calc">✅ 員工持股上路中。接下來要指定接班人：領導力 70 以上的店長、分店店長或區經理。</p>${H.length ? `<div class="pot-list">${H.map((h) => `<div class="pot-row"><span class="mini-face">🏮</span><span><b>${esc(h.name)}</b><small>${esc(h.where)}・領導力 ${h.lead}</small></span><span class="lead-btns"><button data-action="coop-heir" data-name="${esc(h.name)}">🏮<small>指定</small></button></span></div>`).join('')}</div>` : '<p class="muted">目前還沒有領導力 70 以上的店長：送去上主管課，或多帶幾個人。</p>'}`;
      } else out += `<p class="calc">🏮 接班人：${esc(C.heir)}</p>`;
      out += '</div>';
    }
    return out;
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
    const site = s.siteOf(b);
    const size = BRANCH_SIZES[b.size || 'medium'];
    const need = s.branchNeedOf(b.size || 'medium');
    const ex = s.expandCost(b);
    return `<div class="branch-card">
      ${branchArt(b)}
      <div class="branch-body">
        <div class="branch-title"><b>${site.icon} ${esc(site.city)}${esc(b.district)}店</b><small>${b.type && b.type !== 'standard' && Fun.STORE_TYPES[b.type] ? `${Fun.STORE_TYPES[b.type].icon}${Fun.STORE_TYPES[b.type].name}・` : ''}${size.name}・人潮 ${site.traffic >= 1.3 ? '超多' : site.traffic >= 1.05 ? '多' : site.traffic <= 0.9 ? '少' : '普通'}・房租 ${site.rent >= 1.5 ? '很貴' : site.rent >= 1.05 ? '貴' : site.rent <= 0.8 ? '便宜' : '普通'}${s.siteSeason(site) > 1 ? '・🔥 旺季' : s.siteSeason(site) < 1 ? '・🥶 淡季' : ''}</small></div>
        ${b.wantN ? `<p class="calc">上週：想來 ${b.wantN.toLocaleString()} 人・服務 ${b.servedN.toLocaleString()} 人${b.lostN ? `・<span class="neg">流失 ${b.lostN.toLocaleString()} 人</span>` : ''}・容量用了 ${Math.round(b.util * 100)}%${b.fee ? `・總部管理費 ${money(b.fee)}` : ''}</p>` : ''}
        ${b.busy ? `<p class="calc warn">客人多到做不完：加 1 個人大約能多服務 ${Math.round((b.servedN || 0) / Math.max(1, b.staff + (b.manager ? 1 : 0)))} 人，或擴建店面</p>` : ''}
        ${b.morale < 55 ? `<p class="calc warn">⚠️ 士氣 ${Math.round(b.morale)}：再低下去分店會打電話來求救（加薪、加人、改裝都有幫助）</p>` : ''}
        ${b.rating < 3.8 ? `<p class="calc warn">⚠️ 評價 ${b.rating.toFixed(1)}：人手不夠或士氣差都會拉低評價</p>` : ''}
        ${b.broken > 0 ? `<p class="calc warn">🔧 設備故障中：容量少兩成（還要 ${b.broken} 週）</p>` : ''}
        <p class="calc">${b.manager ? `👑 店長 ${esc(b.manager.name)}（${Fun.STYLES[b.manager.style] ? Fun.STYLES[b.manager.style].icon + Fun.STYLES[b.manager.style].name : ''}・領導力 ${b.manager.lead}）<button class="link" data-action="recall-mgr" data-i="${i}">調回本店</button>` : '👑 沒有店長：到「員工 → 主管」派一位過來，會照他的風格影響士氣、評價和成本'}</p>
        <div class="branch-stats">
          <span>★ ${b.rating.toFixed(1)}</span><span>士氣 ${Math.round(b.morale)}</span><span>上週 <b class="${b.last < 0 ? 'neg' : 'pos'}">${signedMoney(b.last)}</b></span>
        </div>
        ${hist.length ? `<div class="spark mini">${hist.map((v) => `<div class="spark-col"><i class="${v < 0 ? 'neg' : 'pos'}" style="height:${(Math.abs(v) / max) * 100}%"></i></div>`).join('')}</div>` : ''}
        <label>時薪 ${seg('wage', [['low', '低於行情'], ['market', '行情價'], ['high', '高於行情']])}</label>
        <label>定價 ${seg('price', [['cheap', '便宜'], ['normal', '一般'], ['premium', '高價']])}</label>
        <div class="branch-ctl">
          <span>人手 <span class="price-ctl"><button data-action="branch-staff" data-i="${i}" data-d="-1">－</button><b class="${b.staff < need ? 'neg' : ''}">${b.staff}</b><button data-action="branch-staff" data-i="${i}" data-d="1">＋</button></span><small>建議 ${need} 人</small></span>
          ${ex ? `<button data-action="branch-expand" data-i="${i}" ${s.cash < ex.cost ? 'disabled' : ''}>🏗️ 擴建成${BRANCH_SIZES[ex.next].name}（${money(ex.cost)}）</button>` : ''}
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
         ${s.policy.helper ? '<div class="tip helper-tip">🤖 <b>經營小幫手已經上工了</b>：人手、薪水、價格、休息區這些基本的事它會幫你顧，放太久的事件也會幫你處理，做了什麼都會用藍色訊息告訴你。你可以先只看它怎麼經營，想自己來的時候到 💡 或 ☰ 把它關掉。</div>' : ''}
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
         <h2>${ev.ev.icon} ${pron(ev, ev.ev.title)}</h2>
         <p class="event-text">${pron(ev, ev.ev.text)}</p>
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
                 <span class="choice-label"><kbd>${i + 1}</kbd>${pron(ev, c.label)}</span>
                 ${c.quote ? `<span class="quote">「${pron(ev, c.quote)}」</span>` : ''}
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
         <h2>${pron(d.ev, r.choice.label)}</h2>
         <p class="event-text">${pron(d.ev, r.choice.result)}</p>
         ${deltaChips(r.delta)}
         ${r.left && r.left.length ? `<p class="left-note">👋 <b>離開：</b>${r.left.map((l) => `${esc(l.name)}${l.rank ? `（${l.rank}）` : ''}・到職 ${l.days < 7 ? `${Math.max(1, l.days)} 天` : `${Math.floor(l.days / 7)} 週`}・${l.why}`).join('、')}${r.delta.morale < 0 ? '<br><small>員工心情下降，是因為同事離開大家會難過（好朋友更明顯）。記得補人，排班才不會缺。</small>' : '<br><small>記得到「員工 → 應徵者」補人。</small>'}</p>` : ''}
         ${d.result.by && d.result.by !== '你' ? `<p class="calc">處理者：${esc(d.result.by)}</p>` : ''}
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
        <p class="calc">標「🚶 走進去逛」的地方會切到那裡的 3D 場景，自己走過去跟攤位、人互動，走到綠色出口回店裡；其他地方是出門一段時間再回來。老闆不在時員工照常營業。現在 ${s.clockLabel}・老闆體力 ${Math.round(b.energy)}</p>
        <div class="city-map">
          <div class="city-home" style="left:46%;top:58%">🏪<small>你的店</small></div>
          ${window.BossFun.PLACES.map((p) => {
            const walk = window.BossPlace3D && window.BossPlace3D.SCENES.includes(p.id);
            const fee = walk ? (p.id === 'club' ? 500 : 0) : p.cost;
            return `<button class="city-pin ${p.hub ? 'hub' : ''} ${walk ? 'walk' : ''}" style="left:${p.x}%;top:${p.y}%" data-action="${p.hub ? 'open-hub' : walk ? 'enter-place' : 'go-out'}" data-id="${p.hub || p.id}" ${b.away || s.cash < fee ? 'disabled' : ''}><span>${p.icon}</span><b>${p.name}</b><small>${p.hub ? (p.hub === 'schemes' ? '陰謀計畫' : '聯名合作') : walk ? `🚶 走進去逛${fee ? `・入場 ${money(fee)}` : ''}` : `${p.minutes} 分鐘${p.cost ? `・${money(p.cost)}` : ''}`}</small></button>`;
          }).join('')}
        </div>
        <div class="city-list">${window.BossFun.PLACES.map((p) => `<div><b>${p.icon} ${p.name}</b>：${p.desc}</div>`).join('')}</div>
      </div>`;
    } else if (d.type === 'sites') {
      const sz = ui.siteSize || 'medium';
      const ty = s.feature('storetype') ? ui.siteType || 'standard' : 'standard';
      const T = window.BossSim.CUSTOMER_TYPES;
      const mixLabel = { student: '🎒學生', office: '💼上班族', elderly: '🧓長輩', family: '🙂家庭', tourist: '📸觀光客' };
      const fitN = (f) => Math.max(1, Math.min(5, Math.round((f - 0.6) / 0.15)));
      const fitStars = (f) => "★".repeat(fitN(f)) + "☆".repeat(5 - fitN(f));
      inner = `<div class="card menu-card plot-card">
        <button class="x" data-action="close-dialog" aria-label="關閉">✕</button>
        <h2>🗺️ 分店要開在哪裡？</h2>
        <p class="calc">每個地點的人潮、房租和客群都不一樣：客群跟你的產業（${s.ind.name}）合不合，看「適合度」。估算是照行情時薪、一般定價、建議人手算的。</p>
        <div class="segmented small">${Object.entries(BRANCH_SIZES).map(([id, z]) => `<button data-action="site-size" data-value="${id}" class="${sz === id ? 'active' : ''}">${z.name}<small>容量 ×${z.cap}・房租 ×${z.rent}</small></button>`).join('')}</div>
        ${s.feature('storetype') ? `<div class="segmented small store-types">${Object.entries(Fun.STORE_TYPES).map(([id, t]) => `<button data-action="site-type" data-value="${id}" class="${ty === id ? 'active' : ''}">${t.icon} ${t.name}<small>${t.desc}</small></button>`).join('')}</div>` : ''}
        <div class="plot-list">${BRANCH_SITES.map((st) => {
          const opened = s.branches.some((b) => b.site === st.id) || (s.franchises || []).some((f) => f.site === st.id);
          const cost = s.siteCost(st, sz, ty);
          const est = s.estimateSite(st, sz, ty);
          const fit = s.siteFit(st);
          const top = Object.entries(st.mix).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${mixLabel[k]} ${Math.round(v * 100)}%`).join('・');
          return `<div class="plot site ${opened ? 'opened' : ''}">
            <div class="plot-head"><span>${st.icon}</span><div><b>${st.city}・${st.name}</b><small>${st.desc}</small></div></div>
            <div class="site-bars">
              <div class="ibar"><span>人潮</span><div class="bar"><div class="bar-fill morale" style="width:${Math.min(100, st.traffic * 55)}%"></div></div><b>×${st.traffic}</b></div>
              <div class="ibar"><span>房租</span><div class="bar"><div class="bar-fill jerk" style="width:${Math.min(100, st.rent * 40)}%"></div></div><b>×${st.rent}</b></div>
            </div>
            <div class="plot-meta"><span>客群：${top}</span>${st.rich ? '<span>💎 不太在意價格</span>' : ''}${st.season ? '<span>🌊 有淡旺季</span>' : ''}${st.weekdayOnly ? '<span>📅 週末冷清</span>' : ''}</div>
            <div class="plot-meta"><span>適合度 <b class="stars">${fitStars(fit)}</b></span><span>估計每週營收 ${money(est.revenue)}</span><span class="${est.profit < 0 ? 'neg' : 'pos'}">淨利約 ${signedMoney(est.profit)}</span></div>
            ${est.full ? `<p class="calc warn">客人比${BRANCH_SIZES[sz].name}做得完的還多（營收卡在容量上限）${sz !== 'large' ? '：開大一點的店面更划算' : ''}</p>` : ''}
            <button class="primary" data-action="open-branch" data-site="${st.id}" ${opened || s.cash < cost ? 'disabled' : ''}>${opened ? '已經開了' : `開${BRANCH_SIZES[sz].name}（${money(cost)}）`}</button>
          </div>`;
        }).join('')}</div>
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
        <div class="plot-list">${window.BossFun.PARTNERS.filter((pt) => !pt.ind || pt.ind.includes(s.ind.id)).map((pt) => {
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
    } else if (d.type === 'chapter') {
      inner = d.ending
        ? `<div class="card menu-card chapter-done"><div class="big-medal">${d.ending.medal}</div><h2>${d.ending.title}</h2><p>${d.ending.text}</p><button class="primary" data-action="close-dialog">繼續經營</button></div>`
        : `<div class="card menu-card chapter-done">
        <div class="event-kicker">📜 章節完成</div>
        <h2>${d.done.icon} ${esc(d.done.name)}</h2>
        <p class="calc">獎勵：${money(d.done.reward.cash)}＋經驗 ${d.done.reward.xp.toLocaleString()}</p>
        <h3>🔓 解鎖新玩法</h3>
        <div class="unlock-list">${d.unlocked.map((f) => `<div><span>${f.icon}</span><div><b>${f.name}</b><small>${f.desc}</small></div></div>`).join('')}</div>
        ${d.next ? `<p class="calc">下一章：${d.next.icon} ${esc(d.next.name)}・${esc(d.next.story)}</p>` : ''}
        <button class="primary" data-action="close-dialog">好！</button>
      </div>`;
    } else if (d.type === 'advice') {
      const list = s.advice();
      inner = `<div class="card menu-card">
        <button class="x" data-action="close-dialog" aria-label="關閉">✕</button>
        <h2>💡 店長建議</h2>
        ${helperToggle()}
        ${list.length ? `<div class="advice-list">${list.map((a) => `<div class="advice"><span>${a.icon}</span><p>${a.text}</p>${a.tab ? `<button data-action="advice-go" data-tab="${a.tab}">前往</button>` : ''}</div>`).join('')}</div>` : '<p class="calc">目前一切順利，繼續保持！</p>'}
      </div>`;
    } else if (d.type === 'menu') {
      const infos = Object.fromEntries(SLOTS.map((n) => [n, slotInfo(n)]));
      const q = ui.quality;
      inner = `<div class="card menu-card">
        <button class="x" data-action="close-dialog" aria-label="關閉">✕</button>
        <h2>☰ 選單</h2>
        ${helperToggle()}
        <h3>存檔 <small>現在用第 ${ui.slot} 格；每天打烊後自動存檔</small></h3>
        <div class="slot-list compact">
          ${SLOTS.map((n) => `<div class="slot ${n === ui.slot ? 'current' : ''}"><span class="slot-no">${n}</span><div class="slot-info"><b>${infos[n] ? `${infos[n].icon} ${esc(infos[n].shop)}` : '空的'}</b><small>${infos[n] ? `第 ${infos[n].week} 週・${money(infos[n].cash)}${infos[n].savedAt ? `・存於 ${savedLabel(infos[n].savedAt)}` : ''}` : ''}</small></div><button data-action="save-slot" data-slot="${n}">${n === ui.slot ? '💾 存檔' : '存到這格'}</button></div>`).join('')}
        </div>
        <div class="insp-actions"><button data-action="export-current">📤 匯出成檔案</button><label class="file-btn">📥 匯入到第 ${ui.slot} 格<input type="file" accept=".json,application/json" data-action="import-file-game" hidden /></label></div>
        <h3>畫質 <small>目前 ${ui.view ? Math.round(ui.view.fps) : '—'} fps</small></h3>
        <div class="segmented small">
          ${[['auto', '自動'], ['high', '高'], ['medium', '中'], ['low', '低（省電）']].map(([v, l]) => `<button data-action="quality" data-value="${v}" class="${q === v ? 'active' : ''}">${l}</button>`).join('')}
        </div>
        <h3>操作</h3>
        <button class="toggle ${ui.autoPause ? 'on' : 'off'} neutral" data-action="autopause"><span class="knob"></span><span>${ui.autoPause ? '打開任何面板時時間都會暫停；快轉中有事找你會調回正常速度' : '打開面板、有事找你時，時間照走'}</span></button>
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
    if (ui.sim) inner = ui.sim.w(inner);
    box.innerHTML = d.type === 'minigame' ? '' : `<div class="dialog-backdrop ${['week', 'ending', 'victory', 'menu', 'advice', 'activity', 'boss-menu', 'city', 'trip', 'rival-visit', 'schemes', 'collabs', 'sites', 'chapter'].includes(d.type) ? 'center' : ''}">${inner}</div>`;
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
      ${r.branchDetail && r.branchDetail.length ? `<div class="split"><div><span>🏪 本店</span><b class="${r.home < 0 ? 'neg' : 'pos'}">${signedMoney(r.home)}</b><small>含事件、成就、設備等其他收支</small></div><div><span>🏙️ 分店合計</span><b class="${r.branches < 0 ? 'neg' : 'pos'}">${signedMoney(r.branches)}</b><small>${r.branchDetail.map((b) => `${esc(b.name)} ${signedMoney(b.last)}${b.lostN ? `（流失 ${b.lostN} 人）` : ''}`).join('・')}</small></div></div>` : ''}
      <table class="ledger">${rows.map(([k, v]) => `<tr><th>${k}</th><td class="${v < 0 ? 'neg' : 'pos'}">${signedMoney(v)}</td></tr>`).join('')}</table>
      <div class="week-stats">
        <div><span>評價</span><b>${r.rating.toFixed(1)} ★</b></div>
        <div><span>員工心情</span><b>${Math.round(r.morale)}</b></div>
        <div><span>慣老闆指數</span><b>${Math.round(r.jerk)}</b></div>
        <div><span>現金</span><b class="${s.cash < 0 ? 'neg' : ''}">${money(s.cash)}</b><small>明早進貨會再扣</small></div>
      </div>
      ${r.hygiene ? `<div class="alert ${r.hygiene.fine || r.hygiene.grade === '限期改善' ? 'bad' : 'good'}">🕵️ ${esc(r.hygiene.text)}</div>` : ''}
      ${r.waste ? `<p class="calc">這週過期報廢的{w:supplies}：${money(r.waste)}</p>` : ''}
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

  // 🤖 經營小幫手的開關：幫忙顧人手、薪水、價格、設備，放太久的事件也會幫你處理
  function helperToggle() {
    const on = ui.sim && ui.sim.policy.helper;
    return `<button class="toggle ${on ? 'on' : 'off'} helper-toggle" data-action="helper"><span class="knob"></span><span><b>🤖 經營小幫手${on ? '：開' : '：關'}</b><small>${on ? '人手不夠會幫你招人、薪水跟上行情、心情差的員工會去關心、缺休息桌或冷氣會幫你買、物價漲了會調價格；事件放太久會幫你選對員工好的選項。每做一件事都會跟你說。' : '覺得事情太多、顧不過來？打開小幫手，基本的事交給它，你只要做想做的事。'}</small></span></button>`;
  }

  // 事件裡的「他」指的是來找你的那位員工時，女生要寫「她」
  const SHE_EVENTS = new Set(['raise', 'leave', 'injury', 'resign', 'n_burn', 'n_broth', 't_burnout', 's_robbery', 'r_chef', 'f_concert', 'w_excuse', 'w_audition', 'w_pua', 'w_birthday']);
  function pron(ev, text) {
    if (ui.sim && typeof text === 'string') text = ui.sim.w(text);
    const who = ev && (ev.subject || ev.staff);
    if (typeof text === 'string' && text.includes('{who}')) text = text.replace(/\{who\}/g, who ? who.name : '員工');
    if (!ev || !who || who.gender !== 'f' || !(SHE_EVENTS.has(ev.ev.id) || ev.subject)) return text;
    return text.replace(/(?<![其吉])他(?!們)/g, '她');
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

  // 關掉分頁或切到背景時也存一下（只在開門前存：存檔不記時間，營業中存會讓同一天重玩一次）
  const saveIfMorning = () => ui.sim && ui.sim.minute < ui.sim.hours.open && !ui.sim.today.served && save();
  window.addEventListener('pagehide', saveIfMorning);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveIfMorning();
  });

  function save(slot = ui.slot) {
    if (!ui.sim || ui.sim.over) return false;
    return store.set(slotKey(slot), ui.sim.serialize());
  }

  function quit() {
    cancelAnimationFrame(ui.raf);
    if (ui.place) ui.place.destroy();
    ui.place = null;
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
      case 'name-dice': {
        const ind = INDUSTRIES.find((i) => i.id === ui.settings.industry);
        const ideas = (ind && ind.nameIdeas) || [];
        const n = document.getElementById('shop-name');
        if (n && ideas.length) {
          const cur = n.value || ind.shopName;
          const pool = ideas.filter((x) => x !== cur);
          n.value = pool[Math.floor(Math.random() * pool.length)];
          ui.settings.shopName = n.value;
        }
        break;
      }
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
      case 'cam-reset':
        ui.view.resetView();
        break;
      case 'zoom':
        ui.view.setZoom(ui.view.zoomT * (btn.dataset.dir === '1' ? 1.25 : 0.8), true);
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
      case 'enter-place':
        enterPlace(btn.dataset.id);
        break;
      case 'place-leave':
        if (ui.place) leavePlace(true);
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
      case 'refresh-decor':
        if (s.refreshDecor()) window.BossAudio.play('place');
        renderDrawer();
        break;
      case 'pet-adopt':
        if (s.adoptPet(btn.dataset.kind)) {
          confetti(30);
          window.BossAudio.play('cheer');
        }
        renderDrawer();
        break;
      case 'pet-play':
        if (s.playPet(Number(btn.dataset.id))) window.BossAudio.play('pop');
        if (ui.tab === 'build') renderDrawer();
        if (ui.inspect) renderInspector();
        break;
      case 'pet-vet':
        if (s.vetPet(Number(btn.dataset.id))) toast('🩺 看完獸醫，健康滿分', 'good');
        if (ui.tab === 'build') renderDrawer();
        if (ui.inspect) renderInspector();
        break;
      case 'pet-rehome':
        s.rehomePet(Number(btn.dataset.id));
        if (ui.inspect && ui.inspect.kind === 'pet') closeInspector();
        renderDrawer();
        break;
      case 'build-room':
        if (s.buildRoom(btn.dataset.id)) {
          window.BossAudio.play('place');
          confetti(30);
        }
        renderDrawer();
        break;
      case 'cam-back':
        if (ui.view) {
          ui.view.camAzT = ui.view.camAz + Math.PI;
          ui.view.zoomT = Math.max(ui.view.zoomT, 1.3);
        }
        break;
      case 'train': {
        const who = staffOf(btn);
        if (who && s.train(who)) toast(`🎓 ${who.name} 去上了一堂課，技能提升到 ${Math.round(who.skill)}`);
        refreshStaffViews();
        break;
      }
      case 'promote': {
        const who = staffOf(btn);
        const why = who && s.promoteBlock(who, btn.dataset.rank);
        if (why) toast(why, 'bad');
        else if (who) s.promote(who, btn.dataset.rank);
        refreshStaffViews();
        break;
      }
      case 'senior': {
        const who = staffOf(btn);
        const why = who && s.seniorBlock(who);
        if (why) toast(why, 'bad');
        else if (who) s.promoteSenior(who);
        refreshStaffViews();
        break;
      }
      case 'lead-train': {
        const who = staffOf(btn);
        if (who && s.leadTrain(who)) toast(`📚 ${who.name} 去上了主管培訓課，領導力 +8`);
        else toast('這週上過了，或錢不夠', 'bad');
        refreshStaffViews();
        break;
      }
      case 'appoint-area':
        if (s.appointArea(Number(btn.dataset.i))) s.checkProgress();
        renderDrawer();
        break;
      case 'recall-mgr':
        s.recallBranchManager(Number(btn.dataset.i));
        renderDrawer();
        break;
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
      case 'train': {
        const who = ui.inspect && ui.inspect.ref;
        if (who && s.trainSkill(who, btn.dataset.id)) {
          toast(`📚 ${who.name} 學會了新業務`, 'good');
          window.BossAudio.play('cheer');
        }
        renderInspector();
        break;
      }
      case 'cheer': {
        const who = ui.inspect && ui.inspect.ref;
        if (who && s.cheer(who)) buzz(12);
        renderInspector();
        break;
      }
      case 'cust-greet':
        if (ui.inspect && s.bossGreet(ui.inspect.ref) !== false) {
          window.BossAudio.play('cheer');
          buzz(8);
        }
        renderInspector();
        break;
      case 'cust-gift':
        if (ui.inspect && s.bossGift(ui.inspect.ref)) {
          window.BossAudio.play('coin');
          buzz(8);
        }
        renderInspector();
        break;
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
      case 'dividend':
        s.takeDividend(s.cash * Number(btn.dataset.p));
        renderDrawer();
        break;
      case 'route':
        if (s.chooseRoute(btn.dataset.id)) renderDrawer();
        renderQuestChip();
        break;
      case 'review-filter':
        ui.reviewLow = !!btn.dataset.value;
        renderDrawer();
        break;
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
      case 'helper':
        s.policy.helper = !s.policy.helper;
        toast(s.policy.helper ? '🤖 小幫手上工了！它做了什麼都會跟你說' : '🤖 小幫手下班了，接下來你自己來');
        renderDialog();
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
      case 'branch-sites':
        ui.dialog = { type: 'sites' };
        renderDialog();
        break;
      case 'site-size':
        ui.siteSize = btn.dataset.value;
        renderDialog();
        break;
      case 'site-type':
        ui.siteType = btn.dataset.value;
        renderDialog();
        break;
      case 'build-kitchen':
        s.buildKitchen();
        renderDrawer();
        break;
      case 'kitchen-backup':
        s.buyBackup();
        renderDrawer();
        break;
      case 'franchise-accept':
        s.acceptFranchise(Number(btn.dataset.id));
        renderDrawer();
        break;
      case 'ipo-raise':
        s.raiseFunds();
        renderDrawer();
        break;
      case 'ipo-list':
        s.listCompany();
        renderDrawer();
        break;
      case 'coop-shares':
        s.launchShares();
        renderDrawer();
        break;
      case 'coop-heir':
        s.setHeir(btn.dataset.name);
        renderDrawer();
        break;
      case 'seasonal':
        if (s.launchSeasonal()) toast(`🍂 季節限定「${s.seasonal.name}」上市！`, 'good');
        renderDrawer();
        break;
      case 'open-branch':
        if (s.openBranch(btn.dataset.site, ui.siteSize || 'medium', ui.siteType || 'standard')) {
          closeDialog();
          if (ui.tab === 'goals') renderDrawer();
        }
        break;
      case 'branch-expand':
        s.expandBranch(Number(btn.dataset.i));
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
    } else if (t.dataset.action === 'auth-set') {
      s.policy.auth[t.dataset.key] = t.dataset.key === 'budget' ? Number(t.value) : t.value;
      s.checkProgress();
      renderDrawer();
    } else if (t.dataset.action === 'pet-friendly') {
      s.policy.petFriendly = t.checked;
      renderDrawer();
    } else if (t.dataset.action === 'toilet-open') {
      s.policy.toiletOpen = t.checked;
      renderDrawer();
    } else if (t.dataset.action === 'delegate') {
      s.policy.delegate = t.checked;
      renderDrawer();
    } else if (t.dataset.action === 'assign-branch') {
      const who = s.staff.find((x) => String(x.id) === t.dataset.id);
      if (who && t.value !== '' && s.assignBranchManager(who, Number(t.value))) {
        if (ui.inspect && ui.inspect.ref === who) closeInspector();
        ui.staffOpen = null;
      }
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
          if (ui.place) ui.place.destroy();
          ui.place = null;
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

  // ───── 回饋：手機震動、彩帶、金幣飛進錢包、現金跳動、連續好評 ─────
  function buzz(p) {
    try {
      if (isTouch && navigator.vibrate) navigator.vibrate(p);
    } catch (e) {
      /* 不支援就算了 */
    }
  }

  function confetti(n = 50) {
    const vp = document.querySelector('.viewport');
    if (!vp || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = document.createElement('div');
    box.className = 'confetti';
    const cols = ['#d9482b', '#f2c14e', '#2c8a57', '#4f7cac', '#e0478a', '#8e44ad'];
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      p.style.left = `${Math.random() * 100}%`;
      p.style.background = cols[i % cols.length];
      p.style.animationDelay = `${Math.random() * 0.4}s`;
      p.style.animationDuration = `${1.6 + Math.random() * 1.4}s`;
      p.style.setProperty('--dx', `${(Math.random() - 0.5) * 160}px`);
      p.style.setProperty('--rot', `${Math.random() * 720 - 360}deg`);
      box.appendChild(p);
    }
    vp.appendChild(box);
    setTimeout(() => box.remove(), 3400);
  }

  function feedbackLoop(sim) {
    const vp = document.querySelector('.viewport');
    const cashEl = document.querySelector('[data-f="cash"]');
    if (!vp || !ui.view) return;
    // 每一筆收入：一枚金幣從客人頭上飛到右上角的現金
    const last = ui.lastPopup || 0;
    let flying = vp.querySelectorAll('.coin-fly').length;
    for (const p of sim.popups) {
      if (p.id <= last) continue;
      ui.lastPopup = Math.max(ui.lastPopup || 0, p.id);
      if (p.kind !== 'money' || flying >= 6 || !cashEl || ui.speed > 5) continue;
      const pt = ui.view.project(p.x + 0.5, 1.4, p.z + 0.5);
      const vr = vp.getBoundingClientRect();
      const cr = cashEl.getBoundingClientRect();
      if (!pt || pt.x < 0 || pt.y < 0) continue;
      const c = document.createElement('div');
      c.className = 'coin-fly';
      c.textContent = '🪙';
      c.style.left = `${pt.x}px`;
      c.style.top = `${pt.y}px`;
      c.style.setProperty('--tx', `${cr.left + cr.width / 2 - vr.left - pt.x}px`);
      c.style.setProperty('--ty', `${cr.top + cr.height / 2 - vr.top - pt.y}px`);
      vp.appendChild(c);
      flying++;
      setTimeout(() => c.remove(), 900);
    }
    // 現金變多跳一下（綠），變少（花錢）抖一下（紅）
    if (cashEl) {
      const prev = ui.prevCash ?? sim.cash;
      const d = sim.cash - prev;
      ui.prevCash = sim.cash;
      if (d > 0 && !cashEl.classList.contains('bump')) {
        cashEl.classList.add('bump');
        setTimeout(() => cashEl.classList.remove('bump'), 350);
      } else if (d < -300 && !cashEl.classList.contains('drop')) {
        cashEl.classList.add('drop');
        setTimeout(() => cashEl.classList.remove('drop'), 450);
      }
    }
    // 連續好評徽章
    let cb = document.getElementById('combo-badge');
    if (!cb) {
      cb = document.createElement('div');
      cb.id = 'combo-badge';
      cb.className = 'combo-badge';
      cb.hidden = true;
      vp.appendChild(cb);
    }
    const n = sim.combo || 0;
    const show = n >= 3 && !ui.place;
    if (cb.hidden === show) cb.hidden = !show;
    if (show && cb.dataset.n !== String(n)) {
      cb.dataset.n = String(n);
      cb.innerHTML = `🔥 <b>${n}</b> 連續好評<small>${n < 10 ? '10' : n < 25 ? '25' : n < 50 ? '50' : n < 100 ? '100' : n < 200 ? '200' : '500'} 位有獎勵・最佳 ${sim.bestCombo || n}</small>`;
      cb.classList.remove('pulse');
      void cb.offsetWidth;
      cb.classList.add('pulse');
      cb.classList.toggle('hot', n >= 25);
    }
  }

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
      // 對話框開著時，Enter／空白鍵不要順便按到後面還有焦點的按鈕
      const box = document.getElementById('dialog');
      if ((e.key === 'Enter' || e.key === ' ') && !(box && box.contains(document.activeElement))) e.preventDefault();
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
  if (location.hash === '#debug') window.BossDebug = { ui, renderDialog, renderDrawer, setBossMode, bossInteract, enterPlace, leavePlace };

  renderStart();
})();
