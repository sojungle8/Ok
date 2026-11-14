"""長夜燈火：等級與經驗模型（Lv1–200）。
做法（記取「用平均效率設計會被玩家打爆」的教訓）：
1. 先定「標準效率」＝單人在線手動、配裝合理的玩家每小時打怪數。
2. 用累計時數目標反推每級所需經驗。
3. 用「最快的人」（最佳 5 人隊＋全部加成）檢查上限，必須守住 2 倍標準。
"""
import math, json

# ---- 標準效率 ----
KILL_COMBAT_S = 4.0     # 同等級一般怪，標準配裝約 4 秒打倒
KILL_TRAVEL_S = 2.0     # 找怪、走位
KPH_STD = 3600 / (KILL_COMBAT_S + KILL_TRAVEL_S)   # 600 隻／小時

def mon_exp(L):
    """同等級一般怪的基本經驗（圖鑑上的數字）"""
    return round(6 * L ** 1.55 + 4)

# ---- 時程目標：標準效率下的累計小時數 ----
MILESTONES = [(1, 0), (20, 3), (45, 20), (70, 60), (100, 160), (125, 320), (150, 560), (175, 950), (200, 1600)]

def _pchip_slopes(xs, ys):
    h = [xs[i + 1] - xs[i] for i in range(len(xs) - 1)]
    d = [(ys[i + 1] - ys[i]) / h[i] for i in range(len(h))]
    m = [d[0] * 0.3] + [0.0] * (len(xs) - 2) + [d[-1] * 1.4]   # 開頭平緩、結尾持續變陡
    for i in range(1, len(xs) - 1):
        if d[i - 1] * d[i] > 0:
            w1, w2 = 2 * h[i] + h[i - 1], h[i] + 2 * h[i - 1]
            m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i])
    return m
_XS = [a for a, _ in MILESTONES]; _YS = [b for _, b in MILESTONES]; _MS = _pchip_slopes(_XS, _YS)
def cum_hours(L):
    """單調三次內插（PCHIP）：累計時數平滑、每級時數不會忽高忽低"""
    for i in range(len(_XS) - 1):
        a, b = _XS[i], _XS[i + 1]
        if a <= L <= b:
            h = b - a; t = (L - a) / h
            h00, h10, h01, h11 = 2*t**3 - 3*t**2 + 1, t**3 - 2*t**2 + t, -2*t**3 + 3*t**2, t**3 - t**2
            return h00 * _YS[i] + h10 * h * _MS[i] + h01 * _YS[i + 1] + h11 * h * _MS[i + 1]
    return _YS[-1]

def hours_for_level(L):          # 從 L 升到 L+1 的標準時數
    return cum_hours(L + 1) - cum_hours(L)

def exp_need(L):                 # 從 L 升到 L+1 所需經驗
    return round(mon_exp(L) * KPH_STD * hours_for_level(L))

# ---- 等級差修正（防止打低等怪、防止帶練）----
def level_gap_mult(player, mon):
    d = mon - player
    if d >= 0:
        return 1.0 if d <= 10 else max(0.3, 1 - 0.05 * (d - 10))   # 打太高的怪：命中低、也不多給
    return 1.0 if d >= -10 else max(0.1, 1 - 0.1 * (-d - 10))      # 打低 10 級以上每級 −10%，最低 10%

# ---- 組隊 ----
PARTY_BONUS = 0.15            # 每多一人總經驗 +15%
def party_share(n):           # 每人分到的「每隻怪經驗」比例
    return (1 + PARTY_BONUS * (n - 1)) / n

# ---- 加成上限 ----
EXP_BONUS_CAP = 0.5           # 卡片、料理、活動等經驗加成合計最多 +50%（月卡不加經驗）

# ---- 效率保護（公開規則）----
# 以「每小時」為單位，和該等級的標準時速比：2 倍以內全拿；2～4 倍的部分拿 25%；超過 4 倍的部分不給。
# 所以任何打法的上限是標準的 2.5 倍。整點重算，介面上有「本小時效率」條讓玩家看得到。
GUARD_FULL, GUARD_STOP, GUARD_RATE = 2.0, 4.0, 0.25
def guarded(r):
    if r <= GUARD_FULL: return r
    return GUARD_FULL + (min(r, GUARD_STOP) - GUARD_FULL) * GUARD_RATE

# ---- 情境 ----
def scenario(pull, combat_s, travel_s, party_n, bonus):
    """pull：一次拉幾隻；combat_s：打完這一團要幾秒；travel_s：找下一團的時間"""
    kph = pull * 3600 / (combat_s + travel_s)
    raw = kph / KPH_STD * party_share(party_n) * (1 + min(bonus, EXP_BONUS_CAP))
    return raw, guarded(raw)

SCENARIOS = {
    '單人掛機（自動、無加成）': (1, 5.0, 2.5, 1, 0),
    '單人手動（標準）': (1, 4.0, 2.0, 1, 0),
    '單人手動＋經驗加成滿 50%': (1, 4.0, 2.0, 1, 0.5),
    '3 人隊（坦補輸出，一次拉 3 隻）': (3, 3.0, 2.5, 3, 0.2),
    '最佳 5 人隊（輔助＋群體技，一次拉 6 隻）': (6, 2.0, 2.5, 5, 0.5),
    '極端：沒預料到的組合（一次 10 隻、0.5 秒清完）': (10, 0.5, 2.0, 5, 0.5),
}

OFFLINE_RATE, OFFLINE_CAP_H, OFFLINE_CAP_MONTH = 0.4, 12, 16

def days_to(L, online_h, eff, offline_h):
    per_day = online_h * eff + min(offline_h, 24) * OFFLINE_RATE
    return cum_hours(L) / per_day

if __name__ == '__main__':
    print('等級  每級經驗   該級標準時數  累計時數  同級怪經驗')
    for L in [1, 10, 20, 30, 45, 60, 70, 85, 99, 100, 110, 125, 140, 150, 160, 175, 190, 199]:
        print(f'{L:>4} {exp_need(L):>11,} {hours_for_level(L):>10.2f} {cum_hours(L):>9.1f} {mon_exp(L):>8,}')
    print('\n情境（相對標準效率的倍數：原始 → 效率保護後）')
    for k, v in SCENARIOS.items():
        raw, g = scenario(*v); print(f'  {k}: {raw:.2f} → {g:.2f}')
    print('\n到達天數（每天在線 h、效率、離線 h）')
    for name, (on, eff, off) in {'輕度：在線 1h＋離線 12h': (1, 1, 12), '一般：在線 2h＋離線 12h': (2, 1, 12),
                                  '月卡一般：在線 2h＋離線 16h': (2, 1, 16), '重度：在線 6h 三人隊＋離線 12h': (6, scenario(3, 3.0, 2.5, 3, .2)[1], 12),
                                  '極限：在線 12h 都在最佳隊＋離線 12h': (12, scenario(6, 2.0, 2.5, 5, .5)[1], 12)}.items():
        print(f'  {name}: ' + '、'.join(f'Lv{L} {days_to(L, on, eff, off):.0f} 天' for L in (45, 100, 150, 200)))
    total = sum(exp_need(L) for L in range(1, 200))
    print(f'\n1→200 總經驗 {total:,}')
    json.dump({'expNeed': [exp_need(L) for L in range(1, 200)], 'monExp': [mon_exp(L) for L in range(1, 201)]}, open('levels.json', 'w'))
