// 介面點擊測試：每個產業 × 手機／桌機，打開每個分頁、子分頁，按遍裡面的按鈕，跑幾天，抓錯誤與版面溢出
// 用法：node tools/uitest.js [產業,...] [phone,desk]（需要 playwright；截圖存在 $OUT）
const { chromium } = require('playwright');
const SKIP = /^(quit|delete-slot|export-current|export-slot|enter-place|boss-mode|pick-build|move-obj|tut-restart|place-leave|go-out|speed|tab)$/;
const OUT = process.env.OUT || require('os').tmpdir() + '/boss-ui';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const inds = (process.argv[2] || 'breakfast,noodle,drinks,barber,scooter,store').split(',');
  const devs = (process.argv[3] || 'phone,desk').split(',');
  const problems = []; const _push = problems.push.bind(problems); problems.push = (x) => { if (!problems.includes(x)) console.log("⚠️ " + x); return _push(x); };
  let clicks = 0;
  for (const dev of devs) for (const ind of inds) {
    const ctx = await b.newContext(dev === 'phone' ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { viewport: { width: 1280, height: 800 } });
    const p = await ctx.newPage();
    const tag = `${dev}-${ind}`;
    let where = 'start';
    p.on('pageerror', (e) => problems.push(`${tag} [${where}] 例外：${e.message.split('\n')[0]}`));
    p.on('console', (m) => { if (m.type() === 'error') problems.push(`${tag} [${where}] console：${m.text().slice(0, 160)}`); });
    await p.goto('file://' + require('path').resolve(__dirname, '../index.html') + '#debug'); await p.waitForFunction(() => window.THREE);
    await p.evaluate(() => { localStorage.clear(); localStorage.setItem('boss-sim-tutorial-done', '1'); });
    await p.reload(); await p.waitForFunction(() => window.THREE);
    for (const sel of [`[data-id="${ind}"]`, '[data-action="start"]', '[data-action="close-dialog"]']) { await p.evaluate((sel) => { const e = document.querySelector(sel); e && e.click(); }, sel); await p.waitForTimeout(300); }
    // 給錢、給經驗，讓後期功能（分店、加盟、上市、兼營）都打得開
    await p.evaluate(() => { const s = window.BossDebug.ui.sim; s.cash = 5e7; s.xp = 2e6; s.addXp && s.addXp(0); window.BossDebug.ui.speed = 0; });
    const dismiss = async () => {
      // 有對話框就選第一個選項或關掉
      for (let k = 0; k < 6; k++) {
        const any = await p.evaluate(() => {
          const d = document.querySelector('#dialog');
          if (!d || !d.innerHTML.trim()) return false;
          const btn = d.querySelector('[data-action="choose"], [data-action="close-dialog"], [data-action="continue"], [data-action="tut-skip"]');
          if (btn) { btn.click(); return true; }
          return false;
        });
        if (!any) return;
        await p.waitForTimeout(80);
      }
    };
    const tabs = await p.evaluate(() => [...document.querySelectorAll('#toolbar [data-action="tab"]')].map((e) => e.dataset.tab));
    for (const t of tabs) {
      const openTab = async () => p.evaluate((t) => { const ui = window.BossDebug.ui; if (ui.tab !== t) document.querySelector(`#toolbar [data-tab="${t}"]`).click(); }, t);
      where = t; await openTab(); await p.waitForTimeout(150);
      const subs = await p.evaluate(() => [...document.querySelectorAll('#drawer .drawer-tabs button')].map((e, i) => i));
      for (const si of subs.length ? subs : [-1]) {
        if (si >= 0) await p.evaluate((si) => document.querySelectorAll('#drawer .drawer-tabs button')[si].click(), si);
        await p.waitForTimeout(150);
        const subName = si >= 0 ? await p.evaluate((si) => document.querySelectorAll('#drawer .drawer-tabs button')[si]?.textContent.trim().slice(0, 8), si) : '';
        where = `${t}/${subName}`;
        await p.screenshot({ path: `${OUT}/${tag}-${t}-${si}.png` });
        // 版面：手機不能有橫向捲動、抽屜不能超出螢幕
        const lay = await p.evaluate(() => {
          const w = innerWidth; const bad = [];
          if (document.documentElement.scrollWidth > w + 2) bad.push(`整頁橫向溢出 ${document.documentElement.scrollWidth}>${w}`);
          const dr = document.querySelector('#drawer'); if (dr && !dr.hidden) { const r = dr.getBoundingClientRect(); if (r.right > w + 2 || r.left < -2) bad.push(`抽屜超出 ${Math.round(r.left)}~${Math.round(r.right)}`); }
          for (const e of document.querySelectorAll('#drawer button, #drawer .card, #drawer table')) { const r = e.getBoundingClientRect(); if (r.width && r.right > w + 2) { bad.push(`元素超出：${(e.textContent || e.className).trim().slice(0, 20)}`); break; } }
          // 文字擠成一條直線（寬度太小）
          for (const e of document.querySelectorAll('#drawer button')) { const r = e.getBoundingClientRect(); if (r.width && r.width < 24 && e.textContent.trim().length > 2) { bad.push(`按鈕被擠扁：${e.textContent.trim().slice(0, 12)}`); break; } }
          return bad;
        });
        for (const x of lay) problems.push(`${tag} [${where}] 版面：${x}`);
        // 按遍抽屜裡的按鈕（每次重新抓，按完回到同一個分頁）
        const n = await p.evaluate(() => document.querySelectorAll('#drawer .drawer-body button, #drawer > button:not(.drawer-x)').length);
        for (let i = 0; i < Math.min(n, 45); i++) {
          const info = await p.evaluate(({ i, SK }) => {
            const list = [...document.querySelectorAll('#drawer .drawer-body button, #drawer > button:not(.drawer-x)')];
            const e = list[i]; if (!e || e.disabled) return null;
            const a = e.dataset.action || '';
            if (new RegExp(SK).test(a)) return null;
            e.click(); return a + ':' + e.textContent.trim().slice(0, 10);
          }, { i, SK: SKIP.source });
          if (!info) continue;
          clicks++;
          where = `${t}/${subName}/${info}`;
          await p.waitForTimeout(40);
          await dismiss();
          // 被帶去別的分頁或放置模式就回來
          await p.evaluate(() => { const ui = window.BossDebug.ui; if (ui.place && ui.place.cancel) ui.place.cancel(); });
          await openTab();
          if (si >= 0) await p.evaluate((si) => { const e = document.querySelectorAll('#drawer .drawer-tabs button')[si]; if (e && !e.classList.contains('active')) e.click(); }, si);
        }
      }
      // 關掉抽屜
      await p.evaluate(() => { const x = document.querySelector('#drawer .drawer-x'); x && x.click(); });
    }
    // 開著畫面跑幾天，事件自動選
    where = 'run';
    await p.evaluate(() => { const ui = window.BossDebug.ui; ui.speed = 3; });
    for (let k = 0; k < 40; k++) { await p.waitForTimeout(250); await dismiss(); await p.evaluate(() => { const s = window.BossDebug.ui.sim; for (let j = 0; j < 30; j++) s.tick(1); }); }
    const st = await p.evaluate(() => { const s = window.BossDebug.ui.sim; return { day: s.day, cash: Math.round(s.cash), fps: window.BossDebug.ui.view && window.BossDebug.ui.view.fps }; });
    await p.screenshot({ path: `${OUT}/${tag}-run.png` });
    console.log(tag, '完成', JSON.stringify(st));
    await ctx.close();
  }
  console.log(`按了 ${clicks} 個按鈕`);
  const uniq = [...new Set(problems)];
  console.log(uniq.length ? uniq.join('\n') : '沒有錯誤');
  await b.close();
})();
