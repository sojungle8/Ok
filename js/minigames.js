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
    breakfast: [['🌯', '蛋餅'], ['🍔', '漢堡'], ['🥓', '培根'], ['🥤', '大冰奶'], ['🥛', '豆漿']],
    noodle: [['🍜', '下麵'], ['🥩', '牛肉'], ['🥟', '餛飩'], ['🥬', '青菜'], ['🧂', '撒蔥花']],
    barber: [['✂️', '剪髮'], ['🧴', '洗髮'], ['💨', '吹乾'], ['🪮', '梳整'], ['🧽', '清頭皮屑']],
    scooter: [['🔩', '拆螺絲'], ['🛢️', '換機油'], ['🛞', '補胎'], ['🔋', '換電瓶'], ['🧰', '鎖回去']],
  };

  const isTouch = () => window.matchMedia('(hover: none)').matches;

  function shell(host, spec, inner) {
    const wrap = document.createElement('div');
    wrap.className = 'mg-backdrop';
    wrap.innerHTML = `
      <div class="mg card" role="dialog" aria-label="${spec.title}">
        <div class="mg-head">
          <span class="mg-kicker">${spec.kicker || `老闆親自下場・精力 -${spec.energy}`}</span>
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

  // ───── 奧客擂台：三回合，每回合從三句回嘴挑一句；觀眾笑聲夠多就贏 ─────
  function roast(host, spec) {
    return new Promise((resolve) => {
      const k = (root.BossFun.KARENS || []).find((x) => x.id === spec.karen) || root.BossFun.KARENS[0];
      const need = spec.need || 4;
      const secs = spec.seconds || 9;
      const wrap = shell(
        host,
        { ...spec, kicker: spec.kicker || '奧客擂台・用嘴巴贏回尊嚴' },
        `<p class="mg-help">選一句回嘴：<b>又好笑又有分寸</b>的觀眾最買單；太超過反而會被錄下來罵。每回合 ${secs} 秒。</p>
         <div class="roast-stage">
           <div class="roast-karen"><span class="roast-icon">${k.icon}</span><div class="roast-bubble"></div></div>
           <div class="roast-meter"><span>😂 觀眾笑聲</span><div class="bar"><div class="bar-fill morale roast-fill"></div></div><b class="roast-score">0</b>/${need}</div>
           <div class="roast-react"></div>
         </div>
         <div class="roast-options"></div>`
      );
      const bubble = wrap.querySelector('.roast-bubble');
      const opts = wrap.querySelector('.roast-options');
      const react = wrap.querySelector('.roast-react');
      let round = 0;
      let score = 0;
      let timer = null;
      let locked = false;
      const pts = { great: 2, ok: 1, over: 0 };
      const reactions = {
        great: ['全店爆笑！有人開始拍手 👏', '排隊的客人笑到蹲下 🤣', '有人大喊「老闆說得好！」'],
        ok: ['幾個客人點點頭', '還算得體', '奧客愣了一下'],
        over: ['全場倒抽一口氣……😬', '有人小聲說「這樣講有點過分」', '前排的客人默默把手機轉過來錄'],
        slow: ['你愣住了，奧客更得意了 😤'],
      };
      const keys = (e) => {
        const n = Number(e.key);
        if (n >= 1 && n <= 3) pick(n - 1);
      };
      const cleanup = () => {
        if (timer) timer.stop();
        window.removeEventListener('keydown', keys);
      };
      let order = [];
      function show() {
        const r = k.rounds[round];
        bubble.textContent = `「${r.line}」`;
        order = ['great', 'ok', 'over'].sort(() => Math.random() - 0.5);
        opts.innerHTML = order.map((t, i) => `<button class="roast-opt" data-i="${i}"><kbd>${i + 1}</kbd>${r[t]}</button>`).join('');
        locked = false;
        timer = countdown(wrap, secs, null, () => answer(null));
      }
      function pick(i) {
        if (locked || !order[i]) return;
        answer(order[i], i);
      }
      function answer(type, i) {
        if (locked) return;
        locked = true;
        timer.stop();
        const t = type || 'slow';
        score += pts[type] || 0;
        wrap.querySelector('.roast-score').textContent = score;
        wrap.querySelector('.roast-fill').style.width = `${Math.min(100, (score / need) * 100)}%`;
        const list = reactions[t];
        react.textContent = list[Math.floor(Math.random() * list.length)];
        react.className = `roast-react ${t}`;
        opts.querySelectorAll('.roast-opt').forEach((b, j) => {
          b.disabled = true;
          b.classList.add(order[j]);
          if (j === i) b.classList.add('picked');
        });
        if (root.BossAudio) root.BossAudio.play(t === 'great' ? 'level' : t === 'over' || t === 'slow' ? 'bad' : 'click');
        setTimeout(() => {
          round++;
          if (round >= k.rounds.length || score >= need + 2) {
            const ok = score >= need;
            return finish(wrap, ok, ok ? `嗆贏了！觀眾笑聲 ${score} 分` : `觀眾笑聲只有 ${score} 分……`, cleanup, resolve);
          }
          show();
        }, 1500);
      }
      opts.addEventListener('click', (e) => {
        const b = e.target.closest('.roast-opt');
        if (b) pick(Number(b.dataset.i));
      });
      window.addEventListener('keydown', keys);
      show();
    });
  }

  function run(host, spec, industryId) {
    if (spec.type === 'roast') return roast(host, spec);
    if (spec.type === 'orders') return orders(host, spec, industryId);
    if (spec.type === 'needle') return needle(host, spec);
    return mash(host, spec);
  }

  root.BossMinigames = { run };
})(typeof window !== 'undefined' ? window : globalThis);
