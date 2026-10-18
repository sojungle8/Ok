// 即時辦公室場景：地圖、移動、時鐘、老闆的精力與肚子、事件在場景中出現
(function (root) {
  const { MAP } = root.BossData;

  const TILE = 40;
  const DPR = 2; // 畫布用兩倍解析度，高解析螢幕比較清楚
  const DAY_START = 9 * 60;
  const DAY_END = 18 * 60;
  const SOLID = new Set(['#', 'D', 'B', 'C', 'F', 'S', 'T', 'P']);

  const MODES = {
    normal: { label: '普通模式', events: 3, minPerSec: 3, energyDrain: 0.1 },
    hell: { label: '爆肝模式', events: 4, minPerSec: 3, energyDrain: 0.15 },
  };

  // 事件從出現到被當作「無視」的時限（遊戲分鐘）
  const DEADLINE = { staff: 110, phone: 45, door: 70 };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const fmtClock = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;

  function findTiles(ch) {
    const out = [];
    MAP.forEach((row, y) => [...row].forEach((c, x) => c === ch && out.push({ x, y })));
    return out;
  }

  class DayScene {
    constructor(game, { container, mode, gender, callbacks }) {
      this.game = game;
      this.mode = MODES[mode] || MODES.normal;
      this.gender = gender;
      this.cb = callbacks;
      this.cols = MAP[0].length;
      this.rows = MAP.length;

      this.clock = DAY_START;
      this.energy = 100;
      this.hunger = 80;
      this.coffees = 0;
      this.paused = false;
      this.dialogOpen = false;
      this.busy = null; // { label, until, onDone }
      this.ended = false;
      this.keys = new Set();
      this.path = [];
      this.toastCooldown = 0;

      const door = findTiles('E');
      this.boss = { x: door[0].x + 0.5, y: door[0].y - 0.5, facing: 1 };
      this.seats = findTiles('D');
      this.phoneTile = findTiles('B')[0];
      this.doorTiles = door;
      this.stations = [
        { type: 'coffee', tile: findTiles('C')[0], label: '喝咖啡' },
        { type: 'food', tile: findTiles('F')[0], label: '吃便當' },
        { type: 'sofa', tile: findTiles('S')[0], label: '在沙發睡午覺' },
      ];
      this.syncStaff();
      this.planEvents();

      // 優先用 3D 辦公室；瀏覽器不支援 WebGL 或 three.js 沒載入時，退回平面地圖
      try {
        if (root.THREE && root.BossOffice3D) this.view = new root.BossOffice3D(container, this);
      } catch (e) {
        console.warn('3D 場景無法啟動，改用平面地圖', e);
        this.view = null;
        container.innerHTML = '';
      }
      if (!this.view) {
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'flat-map';
        this.canvas.width = this.cols * TILE * DPR;
        this.canvas.height = this.rows * TILE * DPR;
        this.ctx = this.canvas.getContext('2d');
        container.appendChild(this.canvas);
      }
      this.pointerEl = this.view ? this.view.dom : this.canvas;

      this.onKeyDown = this.onKeyDown.bind(this);
      this.onKeyUp = this.onKeyUp.bind(this);
      this.onPointer = this.onPointer.bind(this);
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
      this.pointerEl.addEventListener('pointerdown', this.onPointer);
      this.last = performance.now();
      this.frame = this.frame.bind(this);
      this.raf = requestAnimationFrame(this.frame);
    }

    destroy() {
      cancelAnimationFrame(this.raf);
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
      this.pointerEl.removeEventListener('pointerdown', this.onPointer);
      if (this.view) this.view.destroy();
    }

    // ───── 員工與事件 ─────
    syncStaff() {
      const g = this.game;
      const prev = this.staff || [];
      this.staff = this.seats.slice(0, g.staff).map((seat, i) => ({
        seat,
        look: root.BossLooks.staffLook(i, g.industry.id),
        name: root.BossLooks.staffLook(i, g.industry.id).name,
        sprite: g.industry.workers[i % g.industry.workers.length],
        moodOffset: prev[i] ? prev[i].moodOffset : Math.round((g.rng() - 0.5) * 24),
        bob: g.rng() * Math.PI * 2,
      }));
    }

    planEvents() {
      const g = this.game;
      const evs = g.queue.slice();
      const span = 17 * 60 - (DAY_START + 20);
      this.pending = evs.map((ev, i) => {
        const slot = DAY_START + 20 + (span * (i + 0.15 + g.rng() * 0.7)) / evs.length;
        return { ev, at: ev.forced ? 16 * 60 : Math.round(slot), where: ev.where || 'staff' };
      });
      this.pending.sort((a, b) => a.at - b.at);
      this.active = [];
    }

    spawn(p) {
      if (p.where === 'staff') {
        const busy = new Set(this.active.filter((a) => a.where === 'staff').map((a) => a.staffIdx));
        const free = this.staff.map((_, i) => i).filter((i) => !busy.has(i));
        const pool = free.length ? free : this.staff.map((_, i) => i);
        p.staffIdx = pool[Math.floor(this.game.rng() * pool.length)];
      }
      p.spawnedAt = this.clock;
      p.deadline = this.clock + DEADLINE[p.where];
      this.active.push(p);
      if (p.where === 'phone') this.ring();
      const who = { staff: `${this.staff[p.staffIdx]?.name || '員工'}好像有事找你`, phone: '☎️ 電話響了！', door: '🚪 門口有人找你' }[p.where];
      this.cb.toast(`${p.ev.icon} ${who}`);
    }

    actorLabel(p) {
      if (p.where === 'phone') return '☎️ 老闆桌上的電話';
      if (p.where === 'door') return '🚪 大門口';
      const s = this.staff[p.staffIdx];
      return s ? `${s.sprite} ${s.name}` : '👤 員工';
    }

    // 處理完或無視後由 UI 呼叫
    removeActive(p) {
      this.active = this.active.filter((a) => a !== p);
      // 有人離職的話重新排座位，被指派的事件改找其他人
      if (this.staff.length !== this.game.staff) {
        this.syncStaff();
        this.active.forEach((a) => {
          if (a.where === 'staff' && a.staffIdx >= this.staff.length) a.staffIdx = Math.max(0, this.staff.length - 1);
        });
      }
    }

    ignoreEvent(p) {
      const result = this.game.ignore(p.ev);
      this.removeActive(p);
      if (result) this.cb.ignored(result, p);
    }

    ring() {
      try {
        const ac = this.audio || (this.audio = new (window.AudioContext || window.webkitAudioContext)());
        if (this.cb.muted()) return;
        [0, 0.18].forEach((t) => {
          const o = ac.createOscillator();
          const gain = ac.createGain();
          o.frequency.value = 880;
          o.connect(gain).connect(ac.destination);
          gain.gain.setValueAtTime(0.06, ac.currentTime + t);
          gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t + 0.15);
          o.start(ac.currentTime + t);
          o.stop(ac.currentTime + t + 0.16);
        });
      } catch (e) {
        /* 沒有音效也沒關係 */
      }
    }

    // ───── 輸入 ─────
    onKeyDown(e) {
      if (this.ended) return;
      const k = e.key.toLowerCase();
      if (this.dialogOpen) return; // 對話框的按鍵由 UI 處理
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      if (k === 'p') {
        this.togglePause();
        return;
      }
      if (k === 'e' || k === 'enter' || k === ' ') {
        this.interact();
        return;
      }
      this.keys.add(k);
      if (k === 'shift') this.keys.add('shift');
      this.path = [];
    }

    onKeyUp(e) {
      this.keys.delete(e.key.toLowerCase());
    }

    togglePause() {
      this.paused = !this.paused;
      this.cb.hud(this.hudState());
    }

    onPointer(e) {
      if (this.dialogOpen || this.paused || this.busy || this.ended) return;
      let x;
      let y;
      if (this.view) {
        const t = this.view.pickTile(e.clientX, e.clientY);
        if (!t) return;
        ({ x, y } = t);
      } else {
        const rect = this.canvas.getBoundingClientRect();
        x = Math.floor(((e.clientX - rect.left) / rect.width) * this.cols);
        y = Math.floor(((e.clientY - rect.top) / rect.height) * this.rows);
      }
      const target = this.targetAt(x, y);
      const goal = target ? target.tile : { x, y };
      const path = this.findPath(goal, !!target || SOLID.has(MAP[y]?.[x]));
      if (path && !path.length && target) {
        this.interact(target);
      } else if (path) {
        this.path = path;
        this.pathTarget = target;
      }
    }

    targetAt(x, y) {
      return this.interactables().find((t) => t.tiles.some((tt) => tt.x === x && tt.y === y)) || null;
    }

    // 走到目標格（或目標旁邊）的最短路徑
    findPath(goal, adjacent) {
      const start = { x: Math.floor(this.boss.x), y: Math.floor(this.boss.y) };
      const key = (p) => `${p.x},${p.y}`;
      const isGoal = (p) =>
        adjacent ? Math.abs(p.x - goal.x) + Math.abs(p.y - goal.y) === 1 : p.x === goal.x && p.y === goal.y;
      const prev = new Map([[key(start), null]]);
      const q = [start];
      while (q.length) {
        const cur = q.shift();
        if (isGoal(cur)) {
          const out = [];
          for (let p = cur; p; p = prev.get(key(p))) out.unshift(p);
          return out.slice(1);
        }
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = { x: cur.x + dx, y: cur.y + dy };
          if (n.y < 0 || n.y >= this.rows || n.x < 0 || n.x >= this.cols) continue;
          if (SOLID.has(MAP[n.y][n.x]) || MAP[n.y][n.x] === 'E' || prev.has(key(n))) continue;
          prev.set(key(n), cur);
          q.push(n);
        }
      }
      return null;
    }

    // ───── 互動 ─────
    interactables() {
      const list = [];
      for (const p of this.active) {
        if (p.where === 'staff') {
          const s = this.staff[p.staffIdx];
          if (s) list.push({ kind: 'event', p, tile: s.seat, tiles: [s.seat], label: `處理 ${s.name} 的事` });
        } else if (p.where === 'phone') {
          list.push({ kind: 'event', p, tile: this.phoneTile, tiles: [this.phoneTile], label: '接電話' });
        } else {
          const t = { x: this.doorTiles[0].x, y: this.doorTiles[0].y - 1 };
          list.push({ kind: 'event', p, tile: this.doorTiles[0], tiles: [...this.doorTiles, t], label: '看看門口是誰' });
        }
      }
      for (const st of this.stations) list.push({ kind: 'station', st, tile: st.tile, tiles: [st.tile], label: st.label });
      return list;
    }

    nearest() {
      let best = null;
      let bestD = 1.6;
      for (const it of this.interactables()) {
        for (const t of it.tiles) {
          const d = Math.hypot(t.x + 0.5 - this.boss.x, t.y + 0.5 - this.boss.y);
          // 事件優先於設施
          const score = d - (it.kind === 'event' ? 0.3 : 0);
          if (score < bestD) {
            bestD = score;
            best = it;
          }
        }
      }
      return best;
    }

    interact(target = this.nearest()) {
      if (!target || this.paused || this.busy || this.dialogOpen || this.ended) return;
      if (target.kind === 'event') {
        this.dialogOpen = true;
        this.keys.clear();
        this.cb.openEvent(target.p);
      } else {
        this.useStation(target.st);
      }
    }

    useStation(st) {
      if (st.type === 'coffee') {
        const gain = Math.max(4, 18 - this.coffees * 6);
        this.coffees++;
        this.startBusy('☕ 喝咖啡中…', 6, () => {
          this.energy = clamp(this.energy + gain, 0, 100);
          this.cb.toast(this.coffees > 2 ? '☕ 第三杯了，手開始有點抖……' : `☕ 精力 +${gain}`);
        });
      } else if (st.type === 'food') {
        if (this.hunger > 85) {
          this.cb.toast('🍱 你還不餓。');
          return;
        }
        this.startBusy('🍱 扒便當中…', 20, () => {
          this.hunger = 100;
          this.energy = clamp(this.energy + 5, 0, 100);
          this.cb.toast('🍱 吃飽了，精神好一點。');
        });
      } else if (st.type === 'sofa') {
        this.startBusy('😴 在沙發上睡午覺…（事件不會等你）', 45, () => {
          this.energy = clamp(this.energy + 35, 0, 100);
          this.cb.toast('😴 睡飽了！精力 +35');
        });
      }
    }

    // 做事情的時候時間跑得比較快
    startBusy(label, minutes, onDone) {
      this.busy = { label, until: this.clock + minutes, onDone };
      this.keys.clear();
      this.path = [];
    }

    closeDialog() {
      this.dialogOpen = false;
      this.last = performance.now();
    }

    // ───── 每一幀 ─────
    frame(now) {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (!this.ended && !this.paused && !this.dialogOpen) this.update(dt);
      if (this.view) this.view.render(now);
      else this.draw(now);
      if (!this.ended) this.raf = requestAnimationFrame(this.frame);
    }

    update(dt) {
      const speedUp = this.busy ? 6 : 1;
      const mins = dt * this.mode.minPerSec * speedUp;
      this.clock += mins;

      // 老闆的身體
      const running = this.keys.has('shift') && this.isMoving;
      let drain = this.mode.energyDrain + (running ? 0.25 : 0);
      if (this.hunger < 25) drain *= 1.6;
      if (this.busy && this.busy.label.startsWith('😴')) drain = 0;
      this.energy = clamp(this.energy - drain * mins, 0, 100);
      this.hunger = clamp(this.hunger - 0.15 * mins, 0, 100);

      if (this.busy && this.clock >= this.busy.until) {
        const done = this.busy.onDone;
        this.busy = null;
        done();
      }
      if (!this.busy) this.move(dt);

      // 事件出現與逾時
      while (this.pending.length && this.pending[0].at <= this.clock) this.spawn(this.pending.shift());
      for (const p of this.active.slice()) {
        if (this.clock >= p.deadline) this.ignoreEvent(p);
        if (this.game.over) return this.finish('over');
      }

      if (this.energy <= 0) return this.finish('collapse');
      if (this.clock >= DAY_END) return this.finish('done');

      this.hudTick = (this.hudTick || 0) + dt;
      if (this.hudTick > 0.1) {
        this.hudTick = 0;
        this.cb.hud(this.hudState());
      }
    }

    move(dt) {
      let dx = 0;
      let dy = 0;
      const k = this.keys;
      if (k.has('arrowleft') || k.has('a')) dx -= 1;
      if (k.has('arrowright') || k.has('d')) dx += 1;
      if (k.has('arrowup') || k.has('w')) dy -= 1;
      if (k.has('arrowdown') || k.has('s')) dy += 1;

      if (!dx && !dy && this.path.length) {
        const next = this.path[0];
        const tx = next.x + 0.5 - this.boss.x;
        const ty = next.y + 0.5 - this.boss.y;
        const d = Math.hypot(tx, ty);
        if (d < 0.08) {
          this.path.shift();
          if (!this.path.length && this.pathTarget) {
            const t = this.pathTarget;
            this.pathTarget = null;
            // 目標可能已經消失（被無視了）
            if (t.kind === 'station' || this.active.includes(t.p)) this.interact(t);
          }
          this.isMoving = false;
          return;
        }
        dx = tx / d;
        dy = ty / d;
      } else if (dx && dy) {
        dx *= Math.SQRT1_2;
        dy *= Math.SQRT1_2;
      }
      this.isMoving = !!(dx || dy);
      if (!this.isMoving) return;
      if (dx) this.boss.facing = dx > 0 ? 1 : -1;
      this.boss.angle = Math.atan2(dx, dy);

      let speed = this.keys.has('shift') ? 6.5 : 4;
      if (this.energy < 20) speed *= 0.5;
      const nx = this.boss.x + dx * speed * dt;
      const ny = this.boss.y + dy * speed * dt;
      if (this.walkable(nx, this.boss.y)) this.boss.x = nx;
      if (this.walkable(this.boss.x, ny)) this.boss.y = ny;
    }

    walkable(x, y) {
      const r = 0.3;
      for (const [cx, cy] of [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]]) {
        const c = MAP[Math.floor(cy)]?.[Math.floor(cx)];
        if (!c || SOLID.has(c) || c === 'E') return false;
      }
      return true;
    }

    finish(reason) {
      if (this.ended) return;
      // 時間到或昏倒：還沒處理和還沒發生的事件都算無視
      if (reason !== 'over') {
        for (const p of [...this.active, ...this.pending]) {
          if (this.game.over) break;
          const r = this.game.ignore(p.ev);
          if (r) this.cb.ignored(r, p, true);
        }
      }
      this.active = [];
      this.pending = [];
      this.ended = true;
      this.cb.hud(this.hudState());
      this.cb.dayEnd(reason);
    }

    hudState() {
      const near = !this.dialogOpen && !this.busy ? this.nearest() : null;
      return {
        clock: fmtClock(this.clock),
        hoursLeft: Math.max(0, (DAY_END - this.clock) / 60),
        energy: this.energy,
        hunger: this.hunger,
        paused: this.paused,
        busy: this.busy && this.busy.label,
        hint: near ? near.label : null,
        pending: this.active.length,
      };
    }

    // ───── 繪圖 ─────
    draw(now) {
      const ctx = this.ctx;
      const g = this.game;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, this.cols * TILE, this.rows * TILE);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          const c = MAP[y][x];
          const px = x * TILE;
          const py = y * TILE;
          if (c === '#') {
            ctx.fillStyle = '#6b5e55';
            ctx.fillRect(px, py, TILE, TILE);
            ctx.fillStyle = '#7d6f65';
            ctx.fillRect(px, py, TILE, TILE - 8);
            continue;
          }
          ctx.fillStyle = (x + y) % 2 ? g.industry.theme : shade(g.industry.theme);
          ctx.fillRect(px, py, TILE, TILE);
          if (c === 'E') {
            ctx.fillStyle = '#b98b5e';
            ctx.fillRect(px + 2, py + 4, TILE - 4, TILE - 4);
            this.emoji('🚪', px + TILE / 2, py + TILE / 2, 22);
          } else if (c === 'T') {
            roundRect(ctx, px + 2, py + 6, TILE - 4, TILE - 12, 6, '#c9a27c');
          } else if (c === 'P') {
            this.emoji('🪴', px + TILE / 2, py + TILE / 2, 26);
          } else if (c === 'C') {
            roundRect(ctx, px + 3, py + 3, TILE - 6, TILE - 6, 8, '#ffffff');
            this.emoji('☕', px + TILE / 2, py + TILE / 2, 24);
          } else if (c === 'F') {
            roundRect(ctx, px + 3, py + 3, TILE - 6, TILE - 6, 8, '#ffffff');
            this.emoji('🍱', px + TILE / 2, py + TILE / 2, 24);
          } else if (c === 'S') {
            roundRect(ctx, px + 2, py + 4, TILE - 4, TILE - 8, 10, '#8fb3d9');
            this.emoji('🛋️', px + TILE / 2, py + TILE / 2, 26);
          } else if (c === 'B') {
            roundRect(ctx, px + 2, py + 4, TILE - 4, TILE - 8, 6, '#8b6b4a');
            this.emoji('☎️', px + TILE / 2, py + TILE / 2, 22);
          }
        }
      }

      // 員工
      const moodFace = (m) => (m >= 70 ? '😄' : m >= 50 ? '🙂' : m >= 35 ? '😐' : m >= 20 ? '😟' : '😫');
      this.staff.forEach((s, i) => {
        const px = s.seat.x * TILE + TILE / 2;
        const py = s.seat.y * TILE + TILE / 2;
        roundRect(ctx, px - 16, py + 6, 32, 12, 4, '#c9a27c');
        this.emoji(g.industry.desk, px + 12, py + 10, 14);
        const bob = Math.sin(now / 500 + s.bob) * 1.5;
        this.emoji(s.sprite, px, py - 2 + bob, 26);
        this.emoji(moodFace(clamp(g.morale + s.moodOffset, 0, 100)), px - 14, py - 14, 13);
        ctx.font = '600 10px system-ui, sans-serif';
        ctx.fillStyle = '#5a4d44';
        ctx.fillText(s.name, px, py + 26);
      });

      // 門口訪客
      if (this.active.some((p) => p.where === 'door')) {
        const d = this.doorTiles[0];
        this.emoji('🧍', d.x * TILE + TILE, (d.y - 1) * TILE + TILE / 2, 26);
      }

      // 事件提示泡泡（含倒數圈）
      for (const p of this.active) {
        let bx;
        let by;
        if (p.where === 'staff') {
          const s = this.staff[p.staffIdx];
          if (!s) continue;
          bx = s.seat.x * TILE + TILE / 2;
          by = s.seat.y * TILE - 16;
        } else if (p.where === 'phone') {
          bx = this.phoneTile.x * TILE + TILE / 2;
          by = this.phoneTile.y * TILE - 14;
        } else {
          bx = this.doorTiles[0].x * TILE + TILE;
          by = (this.doorTiles[0].y - 1) * TILE - 14;
        }
        const left = clamp((p.deadline - this.clock) / (p.deadline - p.spawnedAt), 0, 1);
        const pulse = 1 + Math.sin(now / 150) * 0.08;
        ctx.beginPath();
        ctx.arc(bx, by, 14 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = left < 0.3 ? '#d9473f' : '#ffffff';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(bx, by, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
        ctx.strokeStyle = left < 0.3 ? '#d9473f' : '#e0703a';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.font = '700 16px system-ui, sans-serif';
        ctx.fillStyle = left < 0.3 ? '#ffffff' : '#d9473f';
        ctx.fillText(p.where === 'phone' ? '☎' : '!', bx, by + 1);
      }

      // 點擊移動的目的地
      if (this.path.length) {
        const t = this.path[this.path.length - 1];
        ctx.strokeStyle = 'rgba(224,112,58,0.7)';
        ctx.lineWidth = 2;
        ctx.strokeRect(t.x * TILE + 8, t.y * TILE + 8, TILE - 16, TILE - 16);
      }

      // 老闆
      const bx = this.boss.x * TILE;
      const by = this.boss.y * TILE;
      ctx.beginPath();
      ctx.ellipse(bx, by + 14, 12, 4, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fill();
      const walkBob = this.isMoving && !this.paused && !this.dialogOpen ? Math.abs(Math.sin(now / 90)) * 3 : 0;
      ctx.save();
      ctx.translate(bx, by - walkBob);
      ctx.scale(this.boss.facing, 1);
      this.emoji(this.gender === 'f' ? '👩‍💼' : '🧑‍💼', 0, 0, 30);
      ctx.restore();
      if (this.busy) this.emoji([...this.busy.label][0], bx + 14, by - 18, 16);
      else if (this.energy < 20) this.emoji('💦', bx + 14, by - 16, 14);

      if (this.paused) {
        ctx.fillStyle = 'rgba(20,15,10,0.45)';
        const w = this.cols * TILE;
        const h = this.rows * TILE;
        ctx.fillRect(0, 0, w, h);
        ctx.font = '700 28px system-ui, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText('⏸ 暫停中', w / 2, h / 2 - 14);
        ctx.font = '16px system-ui, sans-serif';
        ctx.fillText('時間停住了：事件不會倒數，電話也不會響', w / 2, h / 2 + 18);
      }
    }

    emoji(ch, x, y, size) {
      // 彩色 emoji 會吃到 fillStyle 的透明度，先重設成不透明
      this.ctx.fillStyle = '#000';
      this.ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      this.ctx.fillText(ch, x, y);
    }
  }

  function roundRect(ctx, x, y, w, h, r, fill) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function shade(hex) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, v - 10);
    return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
  }

  root.BossWorld = { DayScene, MODES, fmtClock, DAY_START, DAY_END };
})(typeof window !== 'undefined' ? window : globalThis);
