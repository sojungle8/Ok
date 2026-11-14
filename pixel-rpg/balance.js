// 長夜燈火：等級與經驗（Lv1～200）。和 design/levels.py 同一套公式，測試會比對兩邊的數字。
export const LV_MAX = 200, LV_LAUNCH = 150;            // 設計上限 200，上線先開到 150
export const KPH_STD = 600;                              // 標準效率：同等級一般怪每小時 600 隻
export const monExp = (L) => Math.round(6 * L ** 1.55 + 4);

// 標準效率下的累計時數（單調三次內插，每級時數平滑增加）
const MS = [[1, 0], [20, 3], [45, 20], [70, 60], [100, 160], [125, 320], [150, 560], [175, 950], [200, 1600]];
const XS = MS.map((m) => m[0]), YS = MS.map((m) => m[1]);
const SLOPES = (() => {
  const h = XS.slice(1).map((x, i) => x - XS[i]), d = h.map((hi, i) => (YS[i + 1] - YS[i]) / hi);
  const m = [d[0] * 0.3, ...Array(XS.length - 2).fill(0), d[d.length - 1] * 1.4];
  for (let i = 1; i < XS.length - 1; i++) if (d[i - 1] * d[i] > 0) {
    const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
    m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
  }
  return m;
})();
export function cumHours(L) {
  for (let i = 0; i < XS.length - 1; i++) {
    const a = XS[i], b = XS[i + 1];
    if (L >= a && L <= b) {
      const h = b - a, t = (L - a) / h;
      return (2 * t ** 3 - 3 * t ** 2 + 1) * YS[i] + (t ** 3 - 2 * t ** 2 + t) * h * SLOPES[i] + (-2 * t ** 3 + 3 * t ** 2) * YS[i + 1] + (t ** 3 - t ** 2) * h * SLOPES[i + 1];
    }
  }
  return YS[YS.length - 1];
}
export const hoursForLevel = (L) => cumHours(L + 1) - cumHours(L);
const EXP = Array.from({ length: LV_MAX + 1 }, (_, L) => (L < 1 ? 0 : Math.round(monExp(L) * KPH_STD * hoursForLevel(L))));
export const levelExp = (L) => EXP[Math.max(1, Math.min(LV_MAX - 1, L))];

// 等級差：打低 10 級以上的怪每級 −10%（最低 10%）；打高 10 級以上每級 −5%（最低 30%）
export function levelGapMult(player, mon) {
  const d = mon - player;
  if (d >= 0) return d <= 10 ? 1 : Math.max(0.3, 1 - 0.05 * (d - 10));
  return d >= -10 ? 1 : Math.max(0.1, 1 - 0.1 * (-d - 10));
}
// 組隊：每多一人總經驗 +15%，平均分
export const partyShare = (n) => (1 + 0.15 * (Math.max(1, n) - 1)) / Math.max(1, n);
export const EXP_BONUS_CAP = 0.5;

// 效率保護：以「本小時」和標準時速比，2 倍內全拿、2～4 倍拿 25%、超過 4 倍不給（上限 2.5 倍）
export const GUARD_FULL = 2, GUARD_STOP = 4, GUARD_RATE = 0.25;
export const guardedRatio = (r) => (r <= GUARD_FULL ? r : GUARD_FULL + (Math.min(r, GUARD_STOP) - GUARD_FULL) * GUARD_RATE);
// 新手保護：Lv30 以前經驗 ×2（效率保護的標準也跟著 ×2）
export const newbieMult = (L) => (L <= 30 ? 2 : 1);
export const stdExpPerHour = (L) => monExp(L) * KPH_STD * newbieMult(L);
// 回傳這次實際拿到的經驗，並把紀錄寫回 p.eff（每個整點重算）
export function guardExp(p, raw, now = Date.now()) {
  const hour = Math.floor(now / 3600000);
  if (!p.eff || p.eff.hour !== hour) p.eff = { hour, raw: 0, got: 0 };
  const std = stdExpPerHour(Math.max(1, p.lv | 0));
  const before = p.eff.raw / std, after = (p.eff.raw + raw) / std;
  const gain = Math.max(0, Math.round((guardedRatio(after) - guardedRatio(before)) * std));
  p.eff.raw += raw; p.eff.got += gain;
  return gain;
}
export const effRatio = (p, now = Date.now()) => (p.eff && p.eff.hour === Math.floor(now / 3600000) ? p.eff.raw / stdExpPerHour(Math.max(1, p.lv | 0)) : 0);

// 離線：標準效率的 40%，最多 12 小時（月卡 16 小時）
export const OFFLINE_RATE = 0.4, OFFLINE_CAP_H = 12, OFFLINE_CAP_MONTH_H = 16;

// ---- 角色與怪物的強度對齊 ----
// 怪物（「一般」原型）公式，和 design/monsters.py 一樣
export const monHpStd = (L) => Math.round(30 + 9 * L ** 1.5 * 1.012 ** L);
export const monAtkStd = (L) => Math.round(8 + 2.2 * L * 1.004 ** L);
// 標準配裝的玩家：同等級一般怪約 4 秒打倒、被同等級一般怪打約 25 下才倒
const kSkill = (L) => 4.5 + 4 * Math.min(1, L / 100);            // 普攻＋技能每秒造成「攻擊力的幾倍」
const defF = (L) => (150 / (150 + 1.2 * L)) * 1.1 * 0.92;          // 怪物防禦、傷害修正、命中
const pctF = (L) => 1 + 0.6 * Math.min(1, L / 100);                 // 能力值與技能被動的百分比加成
export const stdAtk = (L) => monHpStd(L) / (4 * kSkill(L) * defF(L));
export const stdHp = (L) => 25 * monAtkStd(L) * 0.85;
export const GEAR_STD_MULT = 1.4;                                   // 「優良」裝備
export const playerBaseAtk = (L) => 0.5 * stdAtk(L) / pctF(L);
export const playerBaseHp = (L) => 0.5 * stdHp(L) / (1 + 0.3 * Math.min(1, L / 100));
export const gearScaleAtk = (L) => 0.5 * stdAtk(L) / pctF(L) / (4.2 * GEAR_STD_MULT);   // 武器 2＋手部 1.2＋飾品 1
export const gearScaleHp = (L) => 0.5 * stdHp(L) / (1 + 0.3 * Math.min(1, L / 100)) / (17 * GEAR_STD_MULT); // 頭 5＋身體 8＋腳 4
