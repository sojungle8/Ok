// 老闆親自下場的小遊戲：照單出貨、抓準時機、連打
// run(host, spec, industryId) 回傳 Promise<boolean>（成功或失敗）
(function (root) {
  // 各產業出貨用的材料／步驟
  const ITEMS = {
    drinks: [['🍵', '綠茶'], ['🫖', '紅茶'], ['⚫', '珍珠'], ['🧊', '冰塊'], ['🥛', '鮮奶']],
    restaurant: [['🍜', '麵'], ['🍚', '白飯'], ['🍳', '煎蛋'], ['🥬', '青菜'], ['🍖', '滷肉']],
    store: [['🍙', '飯糰'], ['🥤', '飲料'], ['🧾', '繳費單'], ['📦', '包裹'], ['🔥', '微波']],
    tech: [['🐛', '抓 bug'], ['🧪', '跑測試'], ['💾', 'commit'], ['🔍', 'review'], ['🚀', 'deploy']],
    cram: [['📝', '改考卷'], ['📖', '講解'], ['✏️', '出題'], ['📋', '點名'], ['📞', '回家長']],
  };

  const isTouch = () => window.matchMedia('(hover: none)').matches;

  function shell(host, spec, inner) {
    const wrap = document.createElement('div');
    wrap.className = 'mg-backdrop';
    wrap.innerHTML = `
      <div class="mg card" role="dialog" aria-label="${spec.title}">
        <div class="mg-head">
          <span class="mg-kicker">老闆親自下場・精力 -${spec.energy}</span>
          <h2>${spec.title}</h2>
        </div>
        <div class="mg-timer"><div class="mg-timer-fill"></div></div>
        <div class="mg-body">${inner}</div>
        <div class="mg-foot"></div>
      </div>`;
    host.appendChild(wrap);
    return wrap;
  }

  function finish(wrap, ok, msg, cleanup, resolve) {
    cleanup();
    const foot = wrap.querySelector('.mg-foot');
    wrap.querySelector('.mg').classList.add(ok ? 'mg-win' : 'mg-lose');
    foot.innerHTML = `<div class="mg-result">${ok ? '✅ ' : '❌ '}${msg}</div>`;
    setTimeout(() => {
      wrap.remove();
      resolve(ok);
    }, 1300);
  }

  // 倒數計時：回傳停止函式
  function countdown(wrap, seconds, onTick, onDone) {
    const fill = wrap.querySelector('.mg-timer-fill');
    const start = performance.now();
    let extra = 0;
    let raf;
    const step = (now) => {
      const left = seconds - (now - start) / 1000 - extra;
      fill.style.width = `${Math.max(0, (left / seconds) * 100)}%`;
      fill.classList.toggle('low', left < seconds * 0.25);
      if (onTick) onTick(now);
      if (left <= 0) return onDone();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return {
      stop: () => cancelAnimationFrame(raf),
      penalty: (s) => (extra += s),
    };
  }

  // ───── 照單出貨：照順序按下訂單上的材料 ─────
  function orders(host, spec, industryId) {
    return new Promise((resolve) => {
      const items = ITEMS[industryId] || ITEMS.drinks;
      const target = spec.target || 5;
      const wrap = shell(
        host,
        spec,
        `<p class="mg-help">照訂單順序按下材料（數字鍵 1～5 或直接點）。按錯會扣時間。完成 <b>${target}</b> 單就成功！</p>
         <div class="mg-score">已完成 <b class="mg-done">0</b> / ${target} 單</div>
         <div class="mg-ticket"></div>
         <div class="mg-items">${items
           .map(([ic, name], i) => `<button class="mg-item" data-i="${i}"><span class="mg-ic">${ic}</span><span>${name}</span><kbd>${i + 1}</kbd></button>`)
           .join('')}</div>`
      );
      const ticket = wrap.querySelector('.mg-ticket');
      const doneEl = wrap.querySelector('.mg-done');
      let done = 0;
      let order = [];
      let pos = 0;
      const newOrder = () => {
        order = Array.from({ length: 3 }, () => Math.floor(Math.random() * items.length));
        pos = 0;
        draw();
      };
      const draw = () => {
        ticket.innerHTML = `<span class="mg-ticket-no">#${String(101 + done)}</span>${order
          .map((i, k) => `<span class="mg-step ${k < pos ? 'ok' : k === pos ? 'now' : ''}">${items[i][0]}<small>${items[i][1]}</small></span>`)
          .join('<span class="mg-arrow">→</span>')}`;
      };
      const press = (i) => {
        if (i === order[pos]) {
          pos++;
          if (pos >= order.length) {
            done++;
            doneEl.textContent = done;
            ticket.classList.remove('pop');
            void ticket.offsetWidth;
            ticket.classList.add('pop');
            if (done >= target) return end(true);
            newOrder();
          } else draw();
        } else {
          timer.penalty(1.2);
          ticket.classList.remove('shake');
          void ticket.offsetWidth;
          ticket.classList.add('shake');
        }
      };
      const onClick = (e) => {
        const b = e.target.closest('.mg-item');
        if (b) press(Number(b.dataset.i));
      };
      const onKey = (e) => {
        const n = Number(e.key);
        if (n >= 1 && n <= items.length) {
          e.preventDefault();
          press(n - 1);
        }
      };
      wrap.addEventListener('click', onClick);
      window.addEventListener('keydown', onKey);
      let ended = false;
      const end = (ok) => {
        if (ended) return;
        ended = true;
        finish(wrap, ok, ok ? `完成 ${done} 單，漂亮！` : `時間到，只完成 ${done} 單`, cleanup, resolve);
      };
      const cleanup = () => {
        timer.stop();
        window.removeEventListener('keydown', onKey);
        wrap.removeEventListener('click', onClick);
      };
      const timer = countdown(wrap, spec.time || 20, null, () => end(false));
      newOrder();
    });
  }

  // ───── 抓準時機：指針進到綠色區時按下 ─────
  function needle(host, spec) {
    return new Promise((resolve) => {
      const rounds = spec.rounds || 3;
      const need = spec.need || 2;
      const wrap = shell(
        host,
        spec,
        `<p class="mg-line"></p>
         <div class="mg-track"><div class="mg-zone"></div><div class="mg-needle"></div></div>
         <div class="mg-score">第 <b class="mg-round">1</b> / ${rounds} 回合・成功 <b class="mg-hits">0</b> 次（需要 ${need} 次）</div>
         <button class="primary mg-hit">${isTouch() ? '就是現在！' : '就是現在！（空白鍵）'}</button>`
      );
      wrap.querySelector('.mg-timer').hidden = true;
      const zone = wrap.querySelector('.mg-zone');
      const ndl = wrap.querySelector('.mg-needle');
      const line = wrap.querySelector('.mg-line');
      let round = 0;
      let hits = 0;
      let x = 0;
      let dir = 1;
      let speed = 0.9;
      let zoneAt = 0;
      let zoneW = 0.2;
      let locked = false;
      let raf;
      let last = performance.now();
      const setup = () => {
        zoneW = 0.22 - round * 0.04;
        zoneAt = 0.1 + Math.random() * (0.8 - zoneW);
        zone.style.left = `${zoneAt * 100}%`;
        zone.style.width = `${zoneW * 100}%`;
        speed = 0.9 + round * 0.35;
        line.textContent = (spec.lines && spec.lines[round]) || '';
        wrap.querySelector('.mg-round').textContent = round + 1;
        locked = false;
      };
      const loop = (now) => {
        const dt = (now - last) / 1000;
        last = now;
        if (!locked) {
          x += dir * speed * dt;
          if (x > 1) (x = 1), (dir = -1);
          if (x < 0) (x = 0), (dir = 1);
          ndl.style.left = `${x * 100}%`;
        }
        raf = requestAnimationFrame(loop);
      };
      const hit = () => {
        if (locked) return;
        locked = true;
        const ok = x >= zoneAt && x <= zoneAt + zoneW;
        if (ok) hits++;
        wrap.querySelector('.mg-hits').textContent = hits;
        zone.classList.add(ok ? 'hit' : 'miss');
        setTimeout(() => {
          zone.classList.remove('hit', 'miss');
          round++;
          if (hits >= need) return end(true);
          if (round >= rounds || rounds - round + hits < need) return end(false);
          setup();
        }, 550);
      };
      const onKey = (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          hit();
        }
      };
      const onClick = (e) => {
        if (e.target.closest('.mg-hit') || e.target.closest('.mg-track')) hit();
      };
      window.addEventListener('keydown', onKey);
      wrap.addEventListener('click', onClick);
      const cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('keydown', onKey);
        wrap.removeEventListener('click', onClick);
      };
      const end = (ok) => finish(wrap, ok, ok ? '漂亮！你穩住了場面' : '時機沒抓好……', cleanup, resolve);
      setup();
      raf = requestAnimationFrame(loop);
    });
  }

  // ───── 連打：在時間內把量表打滿 ─────
  function mash(host, spec) {
    return new Promise((resolve) => {
      const wrap = shell(
        host,
        spec,
        `<p class="mg-help">${isTouch() ? '一直點下面的按鈕' : '一直按 E 或空白鍵'}，在時間內把量表填滿！</p>
         <div class="mg-power"><div class="mg-power-fill"></div></div>
         <button class="primary mg-push">💪 用力！</button>`
      );
      const fill = wrap.querySelector('.mg-power-fill');
      let power = 0;
      let last = performance.now();
      const push = () => {
        power = Math.min(100, power + 7);
        wrap.querySelector('.mg-push').classList.remove('bump');
        void wrap.offsetWidth;
        wrap.querySelector('.mg-push').classList.add('bump');
        if (power >= 100) end(true);
      };
      const onKey = (e) => {
        if (e.repeat) return;
        if (e.key === ' ' || e.key.toLowerCase() === 'e' || e.key === 'Enter') {
          e.preventDefault();
          push();
        }
      };
      const onClick = (e) => {
        if (e.target.closest('.mg-push')) push();
      };
      window.addEventListener('keydown', onKey);
      wrap.addEventListener('click', onClick);
      let ended = false;
      const end = (ok) => {
        if (ended) return;
        ended = true;
        finish(wrap, ok, ok ? '成功了！' : '力氣不夠……', cleanup, resolve);
      };
      const cleanup = () => {
        timer.stop();
        window.removeEventListener('keydown', onKey);
        wrap.removeEventListener('click', onClick);
      };
      const timer = countdown(
        wrap,
        spec.time || 6,
        (now) => {
          const dt = (now - last) / 1000;
          last = now;
          power = Math.max(0, power - dt * 16);
          fill.style.width = `${power}%`;
        },
        () => end(false)
      );
    });
  }

  function run(host, spec, industryId) {
    if (spec.type === 'orders') return orders(host, spec, industryId);
    if (spec.type === 'needle') return needle(host, spec);
    return mash(host, spec);
  }

  root.BossMinigames = { run };
})(typeof window !== 'undefined' ? window : globalThis);
