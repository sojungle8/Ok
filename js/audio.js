// 音效與背景音樂：全部用 WebAudio 即時合成，不需要音檔
(function (root) {
  const KEY = 'boss-sim-audio';
  let ctx = null;
  let master;
  let sfxGain;
  let musicGain;
  let ambGain;
  let rainGain;
  let musicTimer = null;
  const last = {};
  const prefs = (() => {
    try {
      return { music: true, sfx: true, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    } catch (e) {
      return { music: true, sfx: true };
    }
  })();

  function savePrefs() {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch (e) {
      /* 不能存就算了 */
    }
  }

  // 瀏覽器規定要在使用者點擊之後才能出聲
  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = prefs.sfx ? 0.5 : 0;
    sfxGain.connect(master);
    musicGain = ctx.createGain();
    musicGain.gain.value = prefs.music ? 0.13 : 0;
    musicGain.connect(master);
    ambGain = ctx.createGain();
    ambGain.gain.value = prefs.sfx ? 0.05 : 0;
    ambGain.connect(master);
    rainGain = ctx.createGain();
    rainGain.gain.value = 0;
    rainGain.connect(master);
    startAmbience();
    startMusic();
  }

  function tone(freq, start, dur, { type = 'sine', vol = 0.3, attack = 0.005, out = sfxGain, slide = 0 } = {}) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(out);
    o.start(start);
    o.stop(start + dur + 0.02);
  }

  const SOUNDS = {
    coin: (t) => {
      tone(1568, t, 0.09, { type: 'square', vol: 0.06 });
      tone(2093, t + 0.06, 0.22, { type: 'square', vol: 0.06 });
    },
    door: (t) => {
      tone(988, t, 0.5, { type: 'sine', vol: 0.14 });
      tone(784, t + 0.22, 0.7, { type: 'sine', vol: 0.12 });
    },
    angry: (t) => tone(220, t, 0.35, { type: 'sawtooth', vol: 0.05, slide: 0.6 }),
    alert: (t) => [659, 880, 1175].forEach((f, i) => tone(f, t + i * 0.09, 0.18, { type: 'triangle', vol: 0.14 })),
    level: (t) => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * 0.08, 0.3, { type: 'triangle', vol: 0.13 })),
    click: (t) => tone(1200, t, 0.04, { type: 'square', vol: 0.03 }),
    pop: (t) => tone(660, t, 0.06, { type: 'sine', vol: 0.12, slide: 1.8 }),
    combo: (t) => [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.05, 0.16, { type: 'square', vol: 0.05 })),
    cheer: (t) => {
      tone(880, t, 0.08, { type: 'triangle', vol: 0.12 });
      tone(1320, t + 0.08, 0.14, { type: 'triangle', vol: 0.12 });
    },
    // 鴿子拍翅膀
    flap: (t) => {
      for (let i = 0; i < 6; i++) tone(140 + Math.random() * 80, t + i * 0.045, 0.04, { type: 'sawtooth', vol: 0.03 });
    },
    place: (t) => {
      tone(180, t, 0.12, { type: 'triangle', vol: 0.2, slide: 0.7 });
      tone(360, t + 0.02, 0.08, { type: 'square', vol: 0.04 });
    },
    bad: (t) => [392, 311].forEach((f, i) => tone(f, t + i * 0.16, 0.3, { type: 'triangle', vol: 0.12 })),
    // 垃圾車：〈給愛麗絲〉開頭（貝多芬，公有領域）
    garbage: (t) => {
      const notes = [659.25, 622.25, 659.25, 622.25, 659.25, 493.88, 587.33, 523.25, 440];
      notes.forEach((f, i) => tone(f, t + i * 0.22, i === notes.length - 1 ? 0.8 : 0.24, { type: 'square', vol: 0.05 }));
    },
    // 警笛：高低兩個音來回
    siren: (t) => {
      for (let i = 0; i < 6; i++) tone(i % 2 ? 660 : 880, t + i * 0.32, 0.3, { type: 'sawtooth', vol: 0.035 });
    },
    // 打雷：低沉的隆隆聲（一串往下滑的鋸齒波）
    thunder: (t) => {
      for (let i = 0; i < 8; i++) tone(70 - i * 4, t + i * 0.09 + Math.random() * 0.05, 0.5, { type: 'sawtooth', vol: 0.06 - i * 0.006, slide: 0.5 });
    },
        // 鐵捲門：一連串金屬喀啦聲
    shutter: (t) => {
      for (let i = 0; i < 14; i++) tone(90 + (i % 3) * 25, t + i * 0.07, 0.08, { type: 'sawtooth', vol: 0.05, slide: 0.7 });
    },
  };

  function play(name) {
    if (!ctx || !prefs.sfx || !SOUNDS[name]) return;
    const now = ctx.currentTime;
    const gap = name === 'thunder' ? 4 : name === 'coin' ? 0.12 : name === 'door' ? 0.9 : name === 'shutter' ? 1.5 : name === 'garbage' ? 5 : 0.25;
    if (last[name] && now - last[name] < gap) return;
    last[name] = now;
    SOUNDS[name](now + 0.01);
  }

  // ───── 環境音：街道和雨聲 ─────
  function noiseBuffer(seconds, brown) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      if (brown) {
        lastOut = (lastOut + 0.02 * white) / 1.02;
        d[i] = lastOut * 3.5;
      } else d[i] = white;
    }
    return buf;
  }

  function startAmbience() {
    const street = ctx.createBufferSource();
    street.buffer = noiseBuffer(4, true);
    street.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    street.connect(lp).connect(ambGain);
    street.start();
    const rain = ctx.createBufferSource();
    rain.buffer = noiseBuffer(3, false);
    rain.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 2500;
    hp.Q.value = 0.4;
    rain.connect(hp).connect(rainGain);
    rain.start();
  }

  function setWeather(id) {
    if (!ctx) return;
    const v = !prefs.sfx ? 0 : id === 'typhoon' ? 0.16 : id === 'rain' ? 0.08 : 0;
    rainGain.gain.setTargetAtTime(v, ctx.currentTime, 0.8);
  }

  // ───── 背景音樂：好幾首曲子，依時段和店裡的狀況切換 ─────
  const N = (name) => {
    const i = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(name.slice(0, -1));
    return 440 * Math.pow(2, (i - 9) / 12 + (Number(name.slice(-1)) - 4));
  };
  const chord = (...names) => names.map(N);
  // 每首曲子：速度、和弦進行、旋律（音階的第幾個音，-1 是休止）、音色
  const TRACKS = {
    morning: {
      name: '早安，開店囉',
      bpm: 96,
      chords: [chord('C3', 'E3', 'G3'), chord('G2', 'B2', 'D3'), chord('A2', 'C3', 'E3'), chord('F2', 'A2', 'C3')],
      scale: ['C5', 'D5', 'E5', 'G5', 'A5', 'C6'].map(N),
      melody: [0, 2, 3, 2, 4, 3, 2, -1, 1, 2, 3, 5, 4, 3, 2, -1],
      lead: 'triangle',
      bass: 'pulse',
    },
    afternoon: {
      name: '午後的騎樓',
      bpm: 80,
      chords: [chord('F2', 'A2', 'C3', 'E3'), chord('E2', 'G2', 'B2', 'D3'), chord('D2', 'F2', 'A2', 'C3'), chord('G2', 'B2', 'D3', 'F3')],
      scale: ['F4', 'G4', 'A4', 'C5', 'D5', 'F5'].map(N),
      melody: [2, -1, 3, 4, 3, -1, 2, 1, 0, -1, 1, 2, 4, 3, -1, -1],
      lead: 'sine',
      bass: 'walk',
    },
    rush: {
      name: '尖峰時刻',
      bpm: 132,
      chords: [chord('A2', 'C3', 'E3'), chord('F2', 'A2', 'C3'), chord('G2', 'B2', 'D3'), chord('E2', 'G#2', 'B2')],
      scale: ['A4', 'C5', 'D5', 'E5', 'G5', 'A5'].map(N),
      melody: [0, 3, 2, 3, 4, 3, 2, 0, 1, 2, 3, 2, 4, 5, 4, 3],
      lead: 'square',
      bass: 'drive',
    },
    night: {
      name: '晚班的街燈',
      bpm: 70,
      chords: [chord('A2', 'C3', 'E3', 'G3'), chord('D2', 'F2', 'A2', 'C3'), chord('G2', 'B2', 'D3', 'F3'), chord('C3', 'E3', 'G3', 'B3')],
      scale: ['A4', 'C5', 'D5', 'E5', 'G5', 'A5'].map(N),
      melody: [4, -1, 3, -1, 2, 3, -1, -1, 1, -1, 2, 0, -1, -1, -1, -1],
      lead: 'sine',
      bass: 'soft',
    },
    rain: {
      name: '雨天的玻璃窗',
      bpm: 64,
      chords: [chord('D3', 'F3', 'A3', 'C4'), chord('G2', 'B2', 'D3', 'F3'), chord('C3', 'E3', 'G3', 'B3'), chord('A2', 'C3', 'E3', 'G3')],
      scale: ['D5', 'E5', 'F5', 'A5', 'C6', 'D6'].map(N),
      melody: [3, -1, -1, 2, -1, 1, -1, -1, 4, -1, 3, -1, 0, -1, -1, -1],
      lead: 'box',
      bass: 'soft',
    },
    closed: {
      name: '打烊後',
      bpm: 58,
      chords: [chord('C3', 'G3', 'E4'), chord('A2', 'E3', 'C4'), chord('F2', 'C3', 'A3'), chord('G2', 'D3', 'B3')],
      scale: ['C6', 'D6', 'E6', 'G6', 'A6', 'C7'].map(N),
      melody: [2, -1, 1, -1, 0, -1, -1, -1, 3, -1, 2, -1, 1, -1, -1, -1],
      lead: 'box',
      bass: 'none',
    },
  };
  let track = 'morning';
  let wanted = 'morning';

  function setMood(name) {
    if (TRACKS[name]) wanted = name;
  }

  function startMusic() {
    let step = 0;
    let next = ctx.currentTime + 0.2;
    const schedule = () => {
      if (!ctx) return;
      while (next < ctx.currentTime + 0.6) {
        // 換曲只在小節開頭換，聽起來比較自然
        if (step % 16 === 0 && wanted !== track) {
          track = wanted;
          step = 0;
        }
        const T = TRACKS[track];
        const beat = 60 / T.bpm;
        const bar = Math.floor(step / 4) % T.chords.length;
        const ch = T.chords[bar];
        const b = step % 4;
        // 和弦墊底
        if (b === 0) ch.forEach((f, i) => tone(f, next + i * 0.025, beat * 3.6, { type: 'triangle', vol: track === 'rush' ? 0.1 : 0.15, attack: 0.06, out: musicGain }));
        // 低音
        if (T.bass === 'pulse') tone(ch[0] / 2, next, beat * 0.5, { type: 'triangle', vol: 0.16, out: musicGain });
        else if (T.bass === 'walk') tone((b === 3 ? ch[2] : ch[b % ch.length]) / 2, next, beat * 0.9, { type: 'sine', vol: 0.16, out: musicGain });
        else if (T.bass === 'drive') {
          tone(ch[0] / 2, next, beat * 0.4, { type: 'sawtooth', vol: 0.05, out: musicGain });
          tone(ch[0] / 2, next + beat / 2, beat * 0.3, { type: 'sawtooth', vol: 0.04, out: musicGain });
          // 輕輕的打點
          tone(b % 2 ? 1800 : 120, next, 0.05, { type: b % 2 ? 'square' : 'sine', vol: b % 2 ? 0.015 : 0.2, slide: b % 2 ? 1 : 0.4, out: musicGain });
        } else if (T.bass === 'soft' && b === 0) tone(ch[0] / 2, next, beat * 3, { type: 'sine', vol: 0.14, attack: 0.08, out: musicGain });
        // 旋律
        const m = T.melody[step % T.melody.length];
        if (m >= 0) {
          if (T.lead === 'box') {
            // 音樂盒：高音、快速衰減
            tone(T.scale[m], next, beat * 1.6, { type: 'sine', vol: 0.1, attack: 0.003, out: musicGain });
            tone(T.scale[m] * 2, next, beat * 0.6, { type: 'sine', vol: 0.025, attack: 0.003, out: musicGain });
          } else tone(T.scale[m], next + beat * 0.02, beat * (T.lead === 'square' ? 0.45 : 0.85), { type: T.lead, vol: T.lead === 'square' ? 0.035 : 0.09, attack: 0.01, out: musicGain });
        }
        next += beat;
        step++;
      }
    };
    musicTimer = setInterval(schedule, 200);
    schedule();
  }

  function trackName() {
    return TRACKS[track].name;
  }

  function toggle(kind) {
    prefs[kind] = !prefs[kind];
    savePrefs();
    if (!ctx) return prefs[kind];
    if (kind === 'music') musicGain.gain.setTargetAtTime(prefs.music ? 0.13 : 0, ctx.currentTime, 0.1);
    if (kind === 'sfx') {
      sfxGain.gain.setTargetAtTime(prefs.sfx ? 0.5 : 0, ctx.currentTime, 0.1);
      ambGain.gain.setTargetAtTime(prefs.sfx ? 0.05 : 0, ctx.currentTime, 0.1);
      if (!prefs.sfx) rainGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    }
    return prefs[kind];
  }

  root.BossAudio = { init, play, toggle, setWeather, setMood, trackName, prefs, tracks: TRACKS };
})(typeof window !== 'undefined' ? window : globalThis);
