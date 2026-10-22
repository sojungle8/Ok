// 新玩家實玩：清空存檔，從主選單開始、不跳過教學，用真的觸控點擊一步一步照教學做，接著正常速度玩一段
// 記錄：每一步要點幾下、按鈕有沒有被擋住或在畫面外、看到多少字、跳出多少通知和事件，並存截圖
// 用法：node tools/newplayer.js [產業] [phone|desk] [實玩秒數]（需要 playwright；截圖存在 $OUT）
const { chromium } = require('playwright');
const path = require('path');
const ind = process.argv[2] || 'drinks';
const dev = process.argv[3] || 'phone';
const playSec = Number(process.argv[4]) || 120;
const OUT = process.env.OUT || require('os').tmpdir() + '/boss-newplayer';
require('fs').mkdirSync(OUT, { recursive: true });

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext(dev === 'phone' ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  const log = [];
  const issues = [];
  const say = (t) => { log.push(t); console.log(t); };
  p.on('pageerror', (e) => issues.push(`例外：${e.message.split('\n')[0]}`));
  let shot = 0;
  const snap = async (name) => p.screenshot({ path: `${OUT}/${dev}-${ind}-${String(++shot).padStart(2, '0')}-${name}.png` });
  const tapXY = async (x, y) => (dev === 'phone' ? p.touchscreen.tap(x, y) : p.mouse.click(x, y));
  // 像真人一樣點：先確認按鈕在畫面裡、沒被別的東西蓋住
  let taps = 0;
  const tap = async (sel, label) => {
    const r = await p.evaluate((sel) => {
      const e = [...document.querySelectorAll(sel)].find((x) => x.offsetParent !== null && !x.disabled);
      if (!e) return { miss: true };
      e.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const b = e.getBoundingClientRect();
      const cx = b.left + b.width / 2;
      const cy = b.top + b.height / 2;
      const top = document.elementFromPoint(cx, cy);
      const off = cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight;
      return { cx, cy, w: b.width, h: b.height, off, covered: !off && top && !e.contains(top) ? (top.className || top.tagName) + ':' + (top.textContent || '').trim().slice(0, 16) : null };
    }, sel);
    if (r.miss) { issues.push(`找不到可以按的「${label || sel}」`); return false; }
    if (r.off) issues.push(`「${label || sel}」在畫面外`);
    if (r.covered) issues.push(`「${label || sel}」被擋住（${r.covered}）`);
    if (dev === 'phone' && (r.w < 32 || r.h < 32)) issues.push(`「${label || sel}」太小，手指不好按（${Math.round(r.w)}×${Math.round(r.h)}）`);
    await tapXY(r.cx, r.cy);
    taps++;
    await p.waitForTimeout(350);
    return true;
  };
  // 3D 世界座標 → 螢幕座標
  const screenOf = (x, y, z) => p.evaluate(([x, y, z]) => {
    const v = window.BossDebug.ui.view;
    const r = v.dom.getBoundingClientRect();
    const q = new window.THREE.Vector3(x, y, z).project(v.camera);
    return { x: r.left + ((q.x + 1) / 2) * r.width, y: r.top + ((1 - q.y) / 2) * r.height };
  }, [x, y, z]);
  const visibleText = () => p.evaluate(() => {
    let n = 0;
    const walk = (el) => {
      if (!el || el.hidden || (el.offsetParent === null && el !== document.body)) return;
      for (const c of el.childNodes) if (c.nodeType === 3) n += c.textContent.replace(/\s/g, '').length; else if (c.nodeType === 1) walk(c);
    };
    walk(document.body);
    return n;
  });

  await p.goto('file://' + path.resolve(__dirname, '../index.html') + '#debug');
  await p.waitForFunction(() => window.THREE);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.waitForFunction(() => window.THREE);
  await p.waitForTimeout(800);
  await snap('menu');
  say(`主選單：畫面上 ${await visibleText()} 個字`);
  await tap(`[data-action="pick-ind"][data-id="${ind}"]`, `選產業 ${ind}`);
  await snap('picked');
  await tap('[data-action="start"]', '開店！');
  await p.waitForTimeout(1200);
  await snap('welcome');
  const welcome = await p.evaluate(() => (document.querySelector('#dialog') || {}).innerText || '');
  say(`開場對話框：${welcome.replace(/\s/g, '').length} 個字`);
  // 開場對話框的按鈕（可能有好幾頁）
  for (let k = 0; k < 6; k++) {
    const has = await p.evaluate(() => { const d = document.querySelector('#dialog'); return !!(d && d.innerHTML.trim() && d.querySelector('button')); });
    if (!has) break;
    const btns = await p.evaluate(() => [...document.querySelectorAll('#dialog button')].map((x) => x.textContent.trim()));
    say(`  對話框按鈕：${btns.join('／')}`);
    await tap('#dialog button.primary, #dialog [data-action="close-dialog"], #dialog button', '對話框按鈕');
    await p.waitForTimeout(500);
  }

  // ───── 教學 ─────
  const t0 = Date.now();
  let lastStep = -1;
  let stuck = 0;
  for (let guard = 0; guard < 40; guard++) {
    const tut = await p.evaluate(() => { const u = window.BossDebug.ui; return u.tut ? { step: u.tut.step, title: document.querySelector('#tut b') ? document.querySelector('#tut b').textContent : '', text: (document.querySelector('#tut') || {}).innerText || '' } : null; });
    if (!tut) break;
    if (tut.step !== lastStep) {
      if (lastStep >= 0) say(`  完成（點了 ${taps} 下）`);
      taps = 0;
      stuck = 0;
      lastStep = tut.step;
      say(`教學 ${tut.step + 1}：${tut.title}（說明 ${tut.text.replace(/\s/g, '').length} 字）`);
      await snap(`tut${tut.step + 1}`);
    } else if (++stuck > (/開門營業/.test(tut.title) ? 40 : 5)) {
      issues.push(`教學「${tut.title}」照說明做了還是過不去`);
      await snap(`stuck${tut.step + 1}`);
      await tap('[data-action="tut-skip"]', '跳過教學');
      break;
    }
    const T = tut.title;
    const tabOpen = (t) => p.evaluate((t) => window.BossDebug.ui.tab === t, t);
    const hasNext = await p.evaluate(() => !!document.querySelector('#tut [data-action="tut-next"]'));
    if (hasNext) await tap('#tut [data-action="tut-next"]', '下一步');
    else if (/看看庫存/.test(T)) await tap('#toolbar [data-tab="stock"]', '📦 庫存');
    else if (/進貨量/.test(T)) await tap('#drawer [data-action="par"]', '進貨量＋');
    else if (/定價/.test(T)) {
      if (!(await tabOpen('manage'))) await tap('#toolbar [data-tab="manage"]', '⚙️ 經營');
      else await tap('#drawer [data-action="price"]', '價格＋');
    } else if (/擺設/.test(T)) {
      if (!(await tabOpen('build')) && !(await p.evaluate(() => !!window.BossDebug.ui.build))) await tap('#toolbar [data-tab="build"]', '🏗️ 建造');
      else if (!(await p.evaluate(() => !!window.BossDebug.ui.build))) {
        // 照教學買盆栽：先切到有盆栽的分類
        const ok = await p.evaluate(() => !!document.querySelector('#drawer [data-action="pick-build"][data-type="plant"]'));
        if (!ok) {
          const cats = await p.evaluate(() => [...document.querySelectorAll('#drawer [data-action="build-cat"]')].map((x) => x.dataset.cat));
          for (const c of cats) {
            await tap(`#drawer [data-action="build-cat"][data-cat="${c}"]`, `分類 ${c}`);
            if (await p.evaluate(() => !!document.querySelector('#drawer [data-action="pick-build"][data-type="plant"]'))) break;
          }
        }
        await tap('#drawer [data-action="pick-build"][data-type="plant"]', '盆栽');
      } else {
        // 找一格能放的地板點下去（觸控要點兩下：先預覽再確認）
        const cell = await p.evaluate(() => { const s = window.BossDebug.ui.sim; for (let z = s.H - 2; z > 1; z--) for (let x = 1; x < s.W - 1; x++) if (s.canPlace('plant', x, z, 0)) return { x, z }; return null; });
        if (!cell) { issues.push('找不到能放盆栽的地板'); break; }
        const sp = await screenOf(cell.x + 0.5, 0, cell.z + 0.5);
        await tapXY(sp.x, sp.y); taps++;
        await p.waitForTimeout(400);
        if (await p.evaluate(() => !!window.BossDebug.ui.build)) {
          const hint = await p.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.offsetParent && /確定|放這裡|放下/.test(b.textContent)).map((b) => b.textContent.trim()));
          if (hint.length) await tap('button.primary', hint[0]);
          else { await tapXY(sp.x, sp.y); taps++; }
          await p.waitForTimeout(400);
        }
      }
    } else if (/招人/.test(T)) {
      if (!(await tabOpen('staff'))) await tap('#toolbar [data-tab="staff"]', '👥 員工');
      else if (!(await p.evaluate(() => !!document.querySelector('#drawer [data-action="hire"]')))) await tap('#drawer [data-action="staff-tab"][data-v="hire"]', '🙋 應徵者');
      else await tap('#drawer [data-action="hire"]', '錄取');
    } else if (/開門營業/.test(T)) {
      if (await p.evaluate(() => !document.querySelector('#drawer').hidden)) await tap('#drawer .drawer-x', '關閉面板');
      else if (await p.evaluate(() => window.BossDebug.ui.speed === 0)) await tap('[data-action="speed"][data-v="2"]', '▶');
      else if (stuck === 3) await snap('waiting-first-customer');
      await p.waitForTimeout(1500);
    } else if (/看看員工/.test(T)) {
      await p.waitForTimeout(1500);
      const sp = await p.evaluate(() => { const s = window.BossDebug.ui.sim; const e = s.staff.find((x) => x.state !== 'off' && x.x != null); return e ? { x: e.x + 0.5, z: e.z + 0.5 } : null; });
      if (sp) { const q = await screenOf(sp.x, 0.8, sp.z); await tapXY(q.x, q.y); taps++; await p.waitForTimeout(500); }
    } else { issues.push(`沒預料到的教學步驟「${T}」`); await tap('[data-action="tut-next"], [data-action="tut-skip"]', '下一步'); }
  }
  say(`  完成（點了 ${taps} 下）`);
  say(`教學總共花了 ${((Date.now() - t0) / 1000).toFixed(0)} 秒（自動化的速度，真人會更久）`);
  await snap('after-tut');

  // ───── 正常速度玩一段 ─────
  await p.evaluate(() => {
    window.__toasts = [];
    const box = document.getElementById('toasts');
    new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) window.__toasts.push({ t: performance.now(), text: n.textContent, kind: n.className }); }).observe(box, { childList: true });
  });
  if (await p.evaluate(() => !document.querySelector('#drawer').hidden)) await tap('#drawer .drawer-x', '關閉面板');
  await tap('[data-action="speed"][data-v="2"]', '▶');
  const m0 = await p.evaluate(() => { const s = window.BossDebug.ui.sim; return s.day * 1440 + s.minute; });
  const start = Date.now();
  let evN = 0;
  let next = 15;
  while ((Date.now() - start) / 1000 < playSec) {
    await p.waitForTimeout(500);
    const dlg = await p.evaluate(() => { const d = document.querySelector('#dialog'); return d && d.innerHTML.trim() ? { text: d.innerText, choices: d.querySelectorAll('[data-action="choose"]').length } : null; });
    if (dlg) {
      evN++;
      if (evN <= 4) { await snap(`event${evN}`); say(`事件 ${evN}：${dlg.text.split('\n').filter(Boolean).slice(0, 2).join('｜').slice(0, 60)}…（${dlg.text.replace(/\s/g, '').length} 字、${dlg.choices} 個選項）`); }
      if (dlg.choices) {
        const k = Math.floor(Math.random() * dlg.choices);
        await tap(`#dialog [data-action="choose"]:nth-of-type(${k + 1}), #dialog [data-action="choose"]`, '事件選項');
      }
      await p.waitForTimeout(400);
      for (let j = 0; j < 3; j++) if (await p.evaluate(() => !!document.querySelector('#dialog [data-action="close-dialog"], #dialog [data-action="continue"]'))) await tap('#dialog [data-action="close-dialog"], #dialog [data-action="continue"]', '關閉結果');
    }
    // 頭頂的事件泡泡：有人找你就點開
    const bubble = await p.evaluate(() => !!document.querySelector('[data-action="open-event"]'));
    if (bubble) await tap('[data-action="open-event"]', '事件泡泡');
    if ((Date.now() - start) / 1000 > next) { await snap(`play${next}`); next += 30; }
  }
  const m1 = await p.evaluate(() => { const s = window.BossDebug.ui.sim; return s.day * 1440 + s.minute; });
  const toasts = await p.evaluate(() => window.__toasts);
  const st = await p.evaluate(() => { const s = window.BossDebug.ui.sim; return { day: s.day, clock: s.clockLabel, cash: Math.round(s.cash), served: s.today.served, angry: s.today.angry, fps: window.BossDebug.ui.view.fps }; });
  say(`正常速度實玩 ${playSec} 秒：遊戲時間前進 ${Math.round(m1 - m0)} 分鐘（約 ${((m1 - m0) / playSec).toFixed(1)} 遊戲分鐘／秒；測試機 FPS ${Math.round(st.fps || 0)}，真機會比較順）`);
  say(`這段時間：通知 ${toasts.length} 則（平均每 ${(playSec / Math.max(1, toasts.length)).toFixed(1)} 秒一則）、事件 ${evN} 件`);
  const kinds = {};
  for (const t of toasts) kinds[t.kind.replace('toast', '').trim() || '一般'] = (kinds[t.kind.replace('toast', '').trim() || '一般'] || 0) + 1;
  say(`通知種類：${JSON.stringify(kinds)}`);
  say(`前 12 則通知：\n  ${toasts.slice(0, 12).map((t) => t.text.slice(0, 50)).join('\n  ')}`);
  say(`狀態：第 ${st.day} 天 ${st.clock}・現金 $${st.cash.toLocaleString()}・今天服務 ${st.served}・生氣離開 ${st.angry}`);
  await snap('end');
  say(issues.length ? `問題：\n  ${[...new Set(issues)].join('\n  ')}` : '沒有發現操作上的問題');
  await b.close();
})();
