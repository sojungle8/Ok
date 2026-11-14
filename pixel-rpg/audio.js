// 微光大陸：程式合成的背景音樂與音效（Web Audio，不需要音檔）
let meter = null;
// 測試用：目前輸出音量（0～1）
export function audioLevel() { if (!meter) return -1; const a = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(a); return Math.sqrt(a.reduce((x, v) => x + v * v, 0) / a.length); }
let ac = null, master, bgmBus, sfxBus, verb, noiseBuf;
export const audioOpt = { bgm: 0.55, sfx: 0.8 };
try { Object.assign(audioOpt, JSON.parse(localStorage.getItem('glimmer-audio') || '{}')); } catch { /* 忽略 */ }
export function saveAudioOpt() { try { localStorage.setItem('glimmer-audio', JSON.stringify(audioOpt)); } catch { /* 忽略 */ } applyVol(); }
function applyVol() {
  if (!ac) return;
  bgmBus.gain.setTargetAtTime(audioOpt.bgm * 0.32, ac.currentTime, 0.1);
  sfxBus.gain.setTargetAtTime(audioOpt.sfx * 0.55, ac.currentTime, 0.05);
}

// 第一次點擊畫面時呼叫（瀏覽器規定要使用者操作後才能出聲）
export function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
  master = ac.createGain(); master.gain.value = 0.9; master.connect(comp); comp.connect(ac.destination);
  meter = ac.createAnalyser(); meter.fftSize = 2048; comp.connect(meter);
  bgmBus = ac.createGain(); sfxBus = ac.createGain(); bgmBus.connect(master); sfxBus.connect(master);
  // 簡單殘響：讓音樂比較有空間感
  verb = ac.createConvolver();
  const len = ac.sampleRate * 1.6, ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
  verb.buffer = ir; const vg = ac.createGain(); vg.gain.value = 0.22; verb.connect(vg); vg.connect(master);
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  applyVol();
  setInterval(tick, 25);
  document.addEventListener('visibilitychange', () => { if (document.hidden) ac.suspend(); else ac.resume(); });
}

// ---- 基本樂器 ----
const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
function tone(dest, f, t, dur, { type = 'triangle', vol = 0.3, a = 0.005, r = 0.08, f2, wet = 0, cutoff } = {}) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a);
  g.gain.setValueAtTime(vol, t + Math.max(a, dur - r)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + r);
  let node = o;
  if (cutoff) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = cutoff; o.connect(fl); node = fl; }
  node.connect(g); g.connect(dest); if (wet) { const w = ac.createGain(); w.gain.value = wet; g.connect(w); w.connect(verb); }
  o.start(t); o.stop(t + dur + r + 0.05);
}
function noise(dest, t, dur, { vol = 0.3, type = 'bandpass', f = 1200, f2, q = 1, a = 0.002, wet = 0 } = {}) {
  const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseBuf; fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(dest); if (wet) { const w = ac.createGain(); w.gain.value = wet; g.connect(w); w.connect(verb); }
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}

// ---- 音效 ----
const last = {};
const SFX = {
  swing: (t) => noise(sfxBus, t, 0.13, { vol: 0.22, f: 2600, f2: 700, q: 1.4 }),
  hit: (t) => { tone(sfxBus, 170, t, 0.08, { type: 'sine', vol: 0.5, f2: 60 }); noise(sfxBus, t, 0.05, { vol: 0.25, f: 1800, q: 0.8 }); },
  crit: (t) => { SFX.hit(t); tone(sfxBus, 1400, t, 0.06, { type: 'square', vol: 0.09, f2: 2200 }); noise(sfxBus, t, 0.12, { vol: 0.2, type: 'highpass', f: 3000 }); },
  kill: (t) => { tone(sfxBus, 520, t, 0.07, { type: 'triangle', vol: 0.22, f2: 980 }); noise(sfxBus, t + 0.02, 0.18, { vol: 0.15, f: 900, f2: 300 }); },
  coin: (t) => { tone(sfxBus, 988, t, 0.05, { type: 'square', vol: 0.07 }); tone(sfxBus, 1319, t + 0.05, 0.12, { type: 'square', vol: 0.07 }); },
  pickup: (t) => { tone(sfxBus, 660, t, 0.06, { type: 'triangle', vol: 0.18 }); tone(sfxBus, 990, t + 0.06, 0.1, { type: 'triangle', vol: 0.16 }); },
  levelup: (t) => [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tone(sfxBus, hz(n + 12), t + i * 0.06, 0.25, { type: 'triangle', vol: 0.16, wet: 0.5 })),
  slash: (t) => { noise(sfxBus, t, 0.25, { vol: 0.3, f: 3500, f2: 500, q: 2, wet: 0.2 }); tone(sfxBus, 300, t, 0.2, { type: 'sawtooth', vol: 0.06, f2: 120, cutoff: 1200 }); },
  magic: (t) => { tone(sfxBus, 400, t, 0.35, { type: 'sine', vol: 0.2, f2: 1600, wet: 0.5 }); [0, 0.05, 0.1].forEach((d, i) => tone(sfxBus, hz(84 + i * 4), t + d, 0.15, { type: 'triangle', vol: 0.06, wet: 0.6 })); },
  bolt: (t) => { tone(sfxBus, 500, t, 0.12, { type: 'sine', vol: 0.18, f2: 1300, wet: 0.3 }); tone(sfxBus, 1500, t + 0.03, 0.06, { type: 'triangle', vol: 0.05 }); },
  arrow: (t) => { tone(sfxBus, 700, t, 0.08, { type: 'sawtooth', vol: 0.08, f2: 200, cutoff: 2500 }); noise(sfxBus, t + 0.02, 0.18, { vol: 0.15, type: 'highpass', f: 4000, f2: 1500 }); },
  punch: (t) => { tone(sfxBus, 120, t, 0.12, { type: 'sine', vol: 0.6, f2: 45 }); noise(sfxBus, t, 0.08, { vol: 0.3, f: 900, q: 0.7 }); },
  ult: (t) => { noise(sfxBus, t, 1.0, { vol: 0.4, type: 'lowpass', f: 2500, f2: 120, wet: 0.4 }); tone(sfxBus, 110, t, 0.8, { type: 'sine', vol: 0.6, f2: 35 }); [57, 64, 69].forEach((n) => tone(sfxBus, hz(n), t, 0.9, { type: 'sawtooth', vol: 0.05, cutoff: 1800, wet: 0.5 })); },
  cutin: (t) => { noise(sfxBus, t, 0.5, { vol: 0.25, type: 'highpass', f: 1500, f2: 6000, wet: 0.3 }); tone(sfxBus, hz(76), t + 0.05, 0.3, { type: 'square', vol: 0.06, wet: 0.5 }); },
  hurt: (t) => { tone(sfxBus, 240, t, 0.14, { type: 'square', vol: 0.12, f2: 90, cutoff: 1500 }); noise(sfxBus, t, 0.08, { vol: 0.2, f: 600 }); },
  potion: (t) => [0, 0.06, 0.12, 0.2].forEach((d, i) => tone(sfxBus, 500 + i * 180, t + d, 0.07, { type: 'sine', vol: 0.18, f2: 900 + i * 200 })),
  dodge: (t) => noise(sfxBus, t, 0.22, { vol: 0.25, type: 'highpass', f: 1200, f2: 5000 }),
  ui: (t) => tone(sfxBus, 880, t, 0.03, { type: 'sine', vol: 0.12 }),
  quest: (t) => { tone(sfxBus, hz(79), t, 0.15, { type: 'triangle', vol: 0.15, wet: 0.4 }); tone(sfxBus, hz(84), t + 0.12, 0.3, { type: 'triangle', vol: 0.15, wet: 0.4 }); },
  reward: (t) => [72, 76, 79, 84, 88].forEach((n, i) => tone(sfxBus, hz(n), t + i * 0.05, 0.2, { type: 'triangle', vol: 0.12, wet: 0.5 })),
  boss: (t) => { [45, 52, 57].forEach((n) => tone(sfxBus, hz(n), t, 1.1, { type: 'sawtooth', vol: 0.09, cutoff: 900, a: 0.02, wet: 0.5 })); tone(sfxBus, 70, t, 0.6, { type: 'sine', vol: 0.6, f2: 40 }); noise(sfxBus, t, 0.5, { vol: 0.2, type: 'lowpass', f: 400 }); },
  refineOk: (t) => { tone(sfxBus, 2000, t, 0.05, { type: 'square', vol: 0.06 }); SFX.reward(t + 0.05); },
  refineFail: (t) => { [64, 61, 57].forEach((n, i) => tone(sfxBus, hz(n), t + i * 0.12, 0.18, { type: 'square', vol: 0.07, cutoff: 1500 })); noise(sfxBus, t, 0.2, { vol: 0.15, f: 500 }); },
  clear: (t) => [67, 72, 76, 79, 84].forEach((n, i) => tone(sfxBus, hz(n), t + i * 0.09, i === 4 ? 0.6 : 0.15, { type: 'square', vol: 0.08, wet: 0.4, cutoff: 3000 })),
  splash: (t) => noise(sfxBus, t, 0.3, { vol: 0.25, f: 800, f2: 2500, q: 0.6 }),
  boom: (t) => { tone(sfxBus, 90, t, 0.35, { type: 'sine', vol: 0.5, f2: 30 }); noise(sfxBus, t, 0.4, { vol: 0.3, type: 'lowpass', f: 1500, f2: 100 }); },
};
const GAP = { hit: 0.045, crit: 0.06, swing: 0.06, coin: 0.05, kill: 0.04, hurt: 0.12, pickup: 0.06, ui: 0.05 };
export function sfx(name) {
  if (!ac || ac.state !== 'running' || !SFX[name] || audioOpt.sfx <= 0) return;
  const t = ac.currentTime;
  if (last[name] && t - last[name] < (GAP[name] ?? 0.03)) return;
  last[name] = t; SFX[name](t + 0.005);
}

// ---- 背景音樂：小型編曲器（16 分音符一步，一小節 16 步）----
// 每首歌：速度、和弦進行（根音 MIDI）、和弦性質、各樂器風格。旋律依和弦內音與音階用固定種子產生，每次都一樣
const MAJ = [0, 2, 4, 5, 7, 9, 11], MIN = [0, 2, 3, 5, 7, 8, 10];
const SONGS = {
  town: { bpm: 92, scale: MAJ, key: 60, prog: [[0, 'M'], [9, 'm'], [5, 'M'], [7, 'M']], lead: 'triangle', drums: 'soft', bass: 'half', seed: 3, density: 0.45 },
  field1: { bpm: 118, scale: MAJ, key: 62, prog: [[0, 'M'], [9, 'm'], [7, 'M'], [5, 'M']], lead: 'square', drums: 'beat', bass: 'eighth', seed: 7, density: 0.6 },
  field2: { bpm: 112, scale: MIN, key: 57, prog: [[0, 'm'], [7, 'm'], [8, 'M'], [10, 'M']], lead: 'triangle', drums: 'beat', bass: 'eighth', seed: 11, density: 0.55 },
  field3: { bpm: 126, scale: MIN, key: 59, prog: [[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M']], lead: 'square', drums: 'mech', bass: 'sixteenth', seed: 13, density: 0.6 },
  field4: { bpm: 100, scale: MIN, key: 62, prog: [[0, 'm'], [5, 'm'], [10, 'M'], [3, 'M']], lead: 'sine', drums: 'soft', bass: 'half', seed: 17, density: 0.4 },
  field5: { bpm: 116, scale: MAJ, key: 65, prog: [[0, 'M'], [4, 'm'], [9, 'm'], [7, 'M']], lead: 'triangle', drums: 'beat', bass: 'eighth', seed: 19, density: 0.55 },
  field6: { bpm: 108, scale: MIN, key: 56, prog: [[0, 'm'], [8, 'M'], [10, 'M'], [7, 'M']], lead: 'sawtooth', drums: 'beat', bass: 'eighth', seed: 23, density: 0.5 },
  boss: { bpm: 152, scale: MIN, key: 57, prog: [[0, 'm'], [8, 'M'], [10, 'M'], [7, 'M']], lead: 'sawtooth', drums: 'battle', bass: 'sixteenth', seed: 29, density: 0.7 },
  tower: { bpm: 134, scale: MIN, key: 64, prog: [[0, 'm'], [8, 'M'], [10, 'M'], [11, 'M']], lead: 'square', drums: 'battle', bass: 'eighth', seed: 31, density: 0.65 },
};
const CH = { M: [0, 4, 7], m: [0, 3, 7] };
function rnd(seed) { let s = seed * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); }
// 產生 8 小節旋律（A A' B A''），每步是 MIDI 音或 null
function compose(song) {
  const r = rnd(song.seed), scale = (deg) => song.key + 12 + song.scale[((deg % 7) + 7) % 7] + 12 * Math.floor(deg / 7);
  const bar = (chord, varied) => {
    const out = Array(16).fill(null);
    const tones = CH[chord[1]].map((x) => song.key + 12 + chord[0] + x);
    let deg = Math.floor(r() * 5);
    for (let s = 0; s < 16; s += 2) {
      const strong = s % 4 === 0;
      if (!strong && r() > song.density) continue;
      if (strong) { const tn = tones[Math.floor(r() * 3)]; out[s] = tn + (tn < song.key + 12 ? 12 : 0); deg = song.scale.indexOf((out[s] - song.key) % 12); if (deg < 0) deg = 0; }
      else { deg += r() < 0.5 ? 1 : -1; out[s] = scale(deg); }
      if (varied && r() < 0.25 && s < 15) out[s + 1] = scale(deg + 1);
    }
    return out;
  };
  const A = song.prog.map((c) => bar(c, false)), A2 = A.map((b, i) => (i === 3 ? bar(song.prog[3], true) : b)), B = song.prog.map((c) => bar(c, true));
  return [...A, ...A2, ...B, ...A];
}
let cur = null, nextT = 0, step = 0, total = 0, melody = null, songGain = null;
export function playSong(name) {
  if (!ac || !SONGS[name] || cur === name) return;
  if (songGain) { const g = songGain; g.gain.setTargetAtTime(0.0001, ac.currentTime, 0.4); setTimeout(() => g.disconnect(), 2500); }
  cur = name; melody = compose(SONGS[name]); step = 0; total = 0; nextT = ac.currentTime + 0.15;
  songGain = ac.createGain(); songGain.gain.setValueAtTime(0.0001, ac.currentTime); songGain.gain.setTargetAtTime(1, ac.currentTime, 0.6); songGain.connect(bgmBus);
}
export const currentSong = () => cur;
export const audioRunning = () => !!ac && ac.state === 'running';
function tick() {
  if (!ac || !cur || ac.state !== 'running') return;
  const song = SONGS[cur], sp = 60 / song.bpm / 4;
  if (nextT < ac.currentTime - 0.2) nextT = ac.currentTime + 0.05;
  while (nextT < ac.currentTime + 0.12) { playStep(song, step, nextT, sp); step = (step + 1) % (16 * 16); total++; nextT += sp; }
}
function playStep(song, st, t, sp) {
  const d = songGain, s = st % 16, barI = Math.floor(st / 16) % 16, chord = song.prog[barI % 4];
  const root = song.key - 12 + chord[0], tones = CH[chord[1]];
  // 和弦墊音（每小節開頭）
  if (s === 0) tones.forEach((x) => tone(d, hz(song.key + chord[0] + x), t, sp * 15, { type: 'sine', vol: 0.05, a: 0.15, r: 0.3, wet: 0.6 }));
  // 低音
  const bassHit = song.bass === 'half' ? s % 8 === 0 : song.bass === 'eighth' ? s % 2 === 0 : true;
  if (bassHit) tone(d, hz(root + (song.bass === 'sixteenth' && s % 4 === 2 ? 12 : 0)), t, sp * (song.bass === 'half' ? 7 : 1.6), { type: song.bass === 'sixteenth' ? 'sawtooth' : 'triangle', vol: song.bass === 'sixteenth' ? 0.09 : 0.2, cutoff: 700 });
  // 琶音（輕快歌曲才有）
  if (song.drums !== 'soft' && s % 2 === 1) tone(d, hz(song.key + 12 + chord[0] + tones[(s >> 1) % 3]), t, sp * 0.9, { type: 'triangle', vol: 0.035, wet: 0.3 });
  // 旋律（第 2 輪起才進來，前 4 小節當前奏）
  const n = melody[barI % melody.length]?.[s];
  if (n != null && total >= 64) tone(d, hz(n), t, sp * 1.8, { type: song.lead, vol: song.lead === 'square' || song.lead === 'sawtooth' ? 0.045 : 0.1, cutoff: song.lead === 'sawtooth' ? 2200 : undefined, wet: 0.35 });
  // 鼓
  const dr = song.drums;
  if (dr === 'soft') { if (s % 4 === 2) noise(d, t, 0.05, { vol: 0.04, type: 'highpass', f: 6000 }); return; }
  if (s % 8 === 0 || (dr === 'battle' && s % 8 === 6)) tone(d, 140, t, 0.1, { type: 'sine', vol: 0.4, f2: 45 });
  if (s % 8 === 4) noise(d, t, 0.12, { vol: dr === 'battle' ? 0.16 : 0.11, f: 1800, q: 0.6 });
  if (s % 2 === 0 || dr === 'battle') noise(d, t, 0.03, { vol: 0.035, type: 'highpass', f: 7000 });
  if (dr === 'mech' && s % 4 === 3) tone(d, 900, t, 0.03, { type: 'square', vol: 0.03 });
}
