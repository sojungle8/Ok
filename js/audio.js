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
    place: (t) => {
      tone(180, t, 0.12, { type: 'triangle', vol: 0.2, slide: 0.7 });
      tone(360, t + 0.02, 0.08, { type: 'square', vol: 0.04 });
    },
    bad: (t) => [392, 311].forEach((f, i) => tone(f, t + i * 0.16, 0.3, { type: 'triangle', vol: 0.12 })),
  };

  function play(name) {
    if (!ctx || !prefs.sfx || !SOUNDS[name]) return;
    const now = ctx.currentTime;
    const gap = name === 'coin' ? 0.12 : name === 'door' ? 0.9 : 0.25;
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

  // ───── 背景音樂：慢板的五聲音階小曲 ─────
  const CHORDS = [
    [261.63, 329.63, 392.0], // C
    [220.0, 261.63, 329.63], // Am
    [174.61, 220.0, 261.63], // F
    [196.0, 246.94, 293.66], // G
  ];
  const MELODY = [0, 2, 4, 2, 1, 4, 3, 2, 0, 1, 2, 4, 3, 2, 1, 0];
  const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0];

  function startMusic() {
    const beat = 60 / 84;
    let step = 0;
    let next = ctx.currentTime + 0.2;
    const schedule = () => {
      if (!ctx) return;
      while (next < ctx.currentTime + 0.6) {
        const bar = Math.floor(step / 4) % CHORDS.length;
        const chord = CHORDS[bar];
        if (step % 4 === 0) chord.forEach((f, i) => tone(f / 2, next + i * 0.02, beat * 3.6, { type: 'triangle', vol: 0.18, attack: 0.05, out: musicGain }));
        tone(chord[step % 3] / 2, next, beat * 0.9, { type: 'sine', vol: 0.12, out: musicGain });
        const m = MELODY[step % MELODY.length];
        if (step % 2 === 0 || Math.random() < 0.3) tone(SCALE[m], next + beat * 0.02, beat * 0.8, { type: 'triangle', vol: 0.09, attack: 0.01, out: musicGain });
        next += beat;
        step++;
      }
    };
    musicTimer = setInterval(schedule, 200);
    schedule();
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

  root.BossAudio = { init, play, toggle, setWeather, prefs };
})(typeof window !== 'undefined' ? window : globalThis);
