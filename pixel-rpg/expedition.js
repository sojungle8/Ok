// 遠征（主玩法）：選關卡 → 一波波怪潮 → 小王／魔王 → 結算。刷裝備、練等、爬難度。
// 只有規則與數值（不碰畫面），給 game.js 呼叫，也給 test/expedition.test.mjs 測。
import { CHAPTERS, MONSTERS, SLOTS, stdItemVal, gearScore } from './world.js';

export const STAGE_PART = ['外圍', '深處', '魔王巢'];
export const DIFF_MAX = 20, GEAR_CAP = 100, WAVES = 5;
// 每章 3 關：外圍（最弱 5 種）→ 深處（中間 5 種）→ 魔王巢（最強 5 種＋地區魔王）
export const STAGES = CHAPTERS.flatMap((c) => STAGE_PART.map((part, i) => {
  const mons = c.mons.slice([0, 4, 8][i], [5, 9, 13][i]), lvs = mons.map((id) => MONSTERS[id].lv);
  return { id: `${c.n}-${i + 1}`, ch: c.n, idx: i, name: `${c.name}・${part}`, mons, lvLo: Math.min(...lvs), lvHi: Math.max(...lvs), mini: mons[mons.length - 1], mvp: i === 2 ? c.boss : null };
}));
export const stageById = (id) => STAGES.find((s) => s.id === id);
const prevOf = (st) => STAGES[STAGES.indexOf(st) - 1] || null;
// 裝備分數門檻：該關最低等級的「全身優良」裝備分數的 55%（第一關沒有門檻）
export const stdGearScore = (lv) => SLOTS.reduce((a, s) => a + stdItemVal(s, lv, 'good'), 0);
export const gateOf = (st) => (STAGES.indexOf(st) === 0 ? 0 : Math.round(stdGearScore(st.lvLo) * 0.55));

export function ensureExped(p) { p.exped ??= {}; p.exped.cleared ??= {}; p.exped.runs ??= 0; return p.exped; }
// 這關開了沒：前一關要打過、裝備分數要夠
export function stageLock(p, st) {
  const e = ensureExped(p), prev = prevOf(st);
  if (prev && !e.cleared[prev.id]) return `先打過「${prev.name}」`;
  const gs = gearScore(p), gate = gateOf(st);
  if (gs < gate) return `裝備分數 ${gs} / ${gate}`;
  return null;
}
// 刷關難度：打過第 N 級，就能挑第 N+1 級
export const maxDiff = (p, st) => Math.min(DIFF_MAX, (ensureExped(p).cleared[st.id] || 0) + 1);
export function diffMods(d) {
  const k = Math.max(1, Math.min(DIFF_MAX, d | 0)) - 1;
  // 關卡是一群一起上：難度 1 時單隻血量 0.45、攻擊 0.3（平衡試玩：用野外數值 Lv1 撐不過 12 秒）
  return { hp: 0.45 * (1 + 0.3 * k), atk: 0.3 * (1 + 0.12 * k), drop: 1 + 0.25 * k, luck: 1 + 0.35 * k, exp: 1 + 0.1 * k, coin: 1 + 0.25 * k };
}
// 一波幾隻；最後一波出小王（外圍、深處）或地區魔王（魔王巢）
export const waveSize = (st, w) => 8 + 2 * st.idx + 2 * w;
export const gearChance = (d) => Math.min(0.6, 0.1 * diffMods(d).drop);
// 結算
export function stageReward(p, st, d, cleared, first) {
  const m = diffMods(d), base = st.lvHi;
  return {
    coins: Math.round(base * 25 * m.coin * (cleared ? 1 : 0.3) * (first ? 2 : 1)),
    shards: cleared && st.mvp ? 3 + Math.floor(d / 4) : 0,
    gear: cleared ? (st.mvp ? 3 : 1) + Math.floor(d / 5) : 0,
  };
}
// 打過一關：記錄最高難度；打過魔王巢就開下一章
export function clearStage(p, st, d) {
  const e = ensureExped(p), first = !e.cleared[st.id];
  e.cleared[st.id] = Math.max(e.cleared[st.id] || 0, d);
  if (st.mvp) p.ch = Math.max(p.ch || 1, Math.min(7, st.ch + 1));
  return first;
}
