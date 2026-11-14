"""長夜燈火：技能數值與平衡模擬。
基準：Lv100、二轉職業 Lv70（一轉 49＋二轉 69＝118 技能點），裝備相同，攻擊／魔攻＝100。
每條路線一個「代表配點」，先檢查點數不超過 118，再模擬 120 秒：
  單體＝打 1 隻首領（首領減傷 30%）；群體＝同時打 5 隻一般怪（減傷 15%）。
輸出單位：每秒造成「攻擊力 100%」的幾倍。最後以六條主輸出路線的單體平均＝100 正規化。
規則：技能之間有 0.5 秒共用間隔；沒有技能可放時普攻；暴擊率 20%＋配點，暴擊傷害 1.5 倍（魔法不暴擊）。
"""
GCD, CRIT, CRITD = 0.5, 0.20, 1.5
POINTS = 118

def S(n, lv, cd=0, ct=0.0, mp=0, c=0, t=1, **k):
    return dict(n=n, lv=lv, cd=cd, ct=ct, mp=mp, c=c, t=t, **k)

# 欄位：c＝每個目標的總傷害％；t＝最多打幾個目標；gen＝獲得資源；genAoe＝打到 3 隻以上才得；use＝消耗全部資源、每層加 ps％；
#       need＝至少要幾層；pierce＝無視防禦比例；crit＝必定暴擊；mag＝魔法；buff＝自身增益；pb＝隊伍增益；db＝目標減益；heal＝治療％；pas＝被動
R = {}
# ===================== 戰士 =====================
R['盾衛'] = dict(cls='戰士', role='坦', res='誓約', resMax=5, aspd=1.0, mp=600, mpr=6, hp=1.4,
  build=[S('守燈劍術', 4, pas=dict(dmg=.08)), S('堅毅之身', 10, pas=dict(hp=.20)), S('守燈斬', 10, cd=3, mp=18, c=320, use1=50),
         S('燈環斬', 10, cd=5, mp=22, c=200, t=8, genAoe=1), S('立誓', 5, cd=8, mp=10, gen=1, db=('防禦降低', .075, 10)),
         S('燈盾', 5, cd=30, mp=20, buff=('dr', .20, 15)), S('不滅燈芯', 5),
         S('盾術精通', 10, pas=dict(block=.20)), S('燈盾擊', 10, cd=6, mp=20, c=300), S('萬燈守望', 10, cd=10, mp=25),
         S('代誓', 10, cd=20, mp=30), S('光之壁壘', 10, cd=25, mp=40, pb=('減傷', .15, 10)), S('守燈光環', 10, pb=('防禦', .20, 999)),
         S('長明', 5, cd=60, mp=20), S('永不熄滅', 4, cd=120, mp=30)])
R['重劍士'] = dict(cls='戰士', role='輸出', res='誓約', resMax=5, aspd=1.0, mp=600, mpr=6, hp=1.4,
  build=[S('守燈劍術', 10, pas=dict(dmg=.20)), S('守燈斬', 10, cd=3, mp=18, c=320, use1=50), S('燈環斬', 10, cd=5, mp=22, c=200, t=8, genAoe=1),
         S('光刃', 10, cd=6, mp=15, c=250, t=4), S('誓約解放', 5, cd=20, mp=30, c=200, t=8, use=60, need=2), S('立誓', 4, cd=8, mp=10, gen=1, db=('防禦降低', .06, 10)),
         S('雙手劍術', 10, pas=dict(dmg=.20, aspd=.10)), S('碎甲斬', 10, cd=5, mp=20, c=380, pierce=.6), S('蓄光斬', 10, cd=8, ct=1.0, mp=25, c=650),
         S('千刃', 10, cd=12, ct=1.0, mp=30, c=650), S('光刃風暴', 4, cd=15, ct=1.5, mp=35, c=360, t=8), S('戰意', 10, pas=dict(crit=.10)),
         S('破誓', 5, cd=45, mp=20, need=3, buff=('dmgPerStack', .10, 15)), S('斬鐵', 4, pas=dict(boss=.08)), S('一閃', 5, cd=60, mp=40, c=1100, t=4, crit=True),
         S('破陣', 1, cd=18, mp=30, c=165, t=8, db=('防禦降低', .015, 8))])
# ===================== 治療師 =====================
R['聖療師'] = dict(cls='治療師', role='補', res='燭火', resMax=3, aspd=.9, mp=1400, mpr=14, mag=True, hp=1.0,
  build=[S('燭光祈願', 10, pas=dict(heal=.50)), S('點燭', 10, cd=2, ct=0.8, mp=30, heal=400, candle=1), S('喚名祝禱', 10, pb=('能力', .05, 240)),
         S('重燃', 4, cd=10, ct=2, mp=60), S('拂塵', 1, cd=5, mp=10), S('燭幕', 9, pb=('防禦', .18, 240)), S('燭陣', 5, cd=20, mp=50, healAoe=300),
         S('大燭光', 10, cd=6, ct=1.5, mp=80, healAoe=350, perCandle=.10), S('群燭重燃', 5, cd=150, ct=3, mp=200), S('靜心燭', 10, pb=('耗魔', .15, 999)),
         S('燭光聖域', 10, cd=30, mp=90, pb=('減傷', .15, 12)), S('光之帷幕', 10, cd=8, mp=60, shield=1400), S('淨燭', 3, cd=20, mp=40),
         S('恩典', 10, pas=dict(heal=.20)), S('守護燭火', 3, cd=120), S('名之言', 8, pas=dict(heal=.16))])
R['驅魔師'] = dict(cls='治療師', role='輸出', res='燭火', resMax=3, aspd=.9, mp=1400, mpr=14, mag=True, hp=1.0,
  build=[S('燭光祈願', 5, pas=dict(heal=.25)), S('點燭', 5, cd=2, ct=0.8, mp=25, heal=250, candle=1), S('喚名祝禱', 5, pb=('能力', .025, 240)),
         S('燭焰矢', 10, cd=1.5, ct=0.8, mp=20, c=380, mag=True, candle=1), S('燭幕', 5, pb=('防禦', .10, 240)), S('燭陣', 5, cd=20, mp=50, healAoe=300),
         S('拂塵', 1), S('重燃', 4),
         S('驅邪燭焰', 10, cd=3, ct=0.8, mp=35, c=620, mag=True), S('聖燭火海', 10, cd=10, mp=50, c=500, t=8, mag=True, useCandle=80),
         S('封名', 5, cd=30, mp=40), S('照見', 10, cd=10, mp=30, db=('受傷提高', .06, 10)), S('燭台錘術', 10, pas=dict(dmg=.20)),
         S('以光為刃', 10, cd=8, mp=30, c=500, mag=True, healFrac=.20), S('驅魔', 10, pas=dict(dmg=.15)), S('燃身', 5, cd=60, buff=('dmg', .25, 15)),
         S('天光', 3, cd=45, ct=1.0, mp=80, c=1000, t=8, mag=True)])
# ===================== 射手 =====================
R['鷹眼射手'] = dict(cls='射手', role='輸出', res='星點', resMax=5, aspd=1.1, mp=700, mpr=7, hp=0.9,
  build=[S('夜視', 10), S('弦術', 10, pas=dict(dmg=.30)), S('雙星矢', 10, cd=2, mp=12, c=240, star=1), S('散星', 5, cd=5, mp=18, c=150, t=3, star=1),
         S('觀星', 5, cd=60, mp=20, buff=('crit', .15, 30)), S('流星貫', 5, cd=6, mp=20, c=260, t=4), S('連星', 3, cd=15, mp=30, c=250, t=5, use=40, need=3),
         S('星眼狙擊', 10, cd=6, ct=1.0, mp=30, c=520), S('破甲星矢', 10, cd=8, mp=25, c=330, pierce=.55), S('致命星位', 10, pas=dict(critd=.25)),
         S('天狼之眼', 10, pas=dict(crit=.10)), S('定星', 5, pas=dict(dmg=.10)), S('連珠', 10, cd=8, mp=30, c=560, star=1),
         S('爆星矢', 4, cd=10, mp=30, c=320, t=4, use=30, need=1), S('隕星終結', 10, cd=12, mp=40, exec_=1000)])
R['陷阱師'] = dict(cls='射手', role='控場', res='星點', resMax=5, aspd=1.1, mp=700, mpr=7, hp=0.9,
  build=[S('夜視', 10), S('弦術', 6, pas=dict(dmg=.18)), S('雙星矢', 10, cd=2, mp=12, c=240, star=1), S('散星', 5, cd=5, mp=18, c=150, t=3, star=1),
         S('星落', 10, cd=8, mp=30, c=280, t=8, star=1), S('連星', 5, cd=15, mp=30, c=280, t=8, use=40, need=3, db=('減速', .30, 6)), S('躍步', 3),
         S('霜星陷阱', 10, cd=10, mp=25, c=150, t=4, star=1), S('爆裂陷阱', 10, cd=8, mp=30, c=420, t=6, star=1), S('陷阱精通', 10, pas=dict(dmg=.25)),
         S('星網', 10, cd=20, mp=40, db=('受傷提高', .08, 10)), S('照夜', 5, cd=30, mp=20), S('夜鷹', 4, pas=dict(proc=.13)), S('星雨', 10, cd=18, ct=2.0, mp=60, c=800, t=10),
         S('風之加護', 10, pb=('迴避', .10, 999))])
# ===================== 魔法使 =====================
R['毀滅法師'] = dict(cls='魔法使', role='群體輸出', res='共鳴', resMax=4, aspd=.8, mp=1600, mpr=16, mag=True, hp=0.8,
  build=[S('魂像學', 10, pas=dict(dmg=.30)), S('快詠', 5, pas=dict(cast=.10)), S('餘燼之種', 10, cd=4, ct=0.8, mp=30, c=300, mag=True, elem='火'),
         S('霜之息', 10, cd=6, ct=0.8, mp=35, c=250, t=8, mag=True, elem='水'), S('雷絲', 10, cd=5, ct=1.0, mp=35, c=320, t=3, mag=True, elem='風'),
         S('岩棘', 5, cd=5, ct=1.0, mp=35, c=330, mag=True, elem='地'), S('四象共鳴', 2, cd=20, ct=1.0, mp=60, c=400, t=8, mag=True, use=0, need=4),
         S('熔星', 10, cd=10, ct=2.0, mp=65, c=700, t=8, mag=True, elem='火'), S('永凍風暴', 10, cd=12, ct=2.0, mp=75, c=560, t=10, mag=True, elem='水'),
         S('雷霆網', 10, cd=10, ct=1.5, mp=70, c=550, t=8, mag=True, elem='風'), S('詠唱精通', 10, pas=dict(cast=.30)), S('共鳴增幅', 10, pas=dict(dmg=.10)),
         S('雙重詠唱', 5, pas=dict(double=.10)), S('魂像爆發', 5, cd=60, buff=('dmg', .25, 10)), S('屬性轉調', 5, pas=dict(dmg=.06))])
R['附魔師'] = dict(cls='魔法使', role='增益控場', res='共鳴', resMax=4, aspd=.8, mp=1600, mpr=16, mag=True, hp=0.8,
  build=[S('魂像學', 10, pas=dict(dmg=.30)), S('快詠', 5, pas=dict(cast=.10)), S('餘燼之種', 5, cd=4, ct=0.8, mp=25, c=250, mag=True, elem='火'),
         S('霜之息', 10, cd=6, ct=0.8, mp=35, c=250, t=8, mag=True, elem='水'), S('雷絲', 5, cd=5, ct=1.0, mp=30, c=270, t=3, mag=True, elem='風'), S('岩棘', 5, cd=5, ct=1.0, mp=30, c=330, mag=True, elem='地'),
         S('魂障', 3), S('四象共鳴', 4, cd=20, ct=1.0, mp=60, c=450, t=8, mag=True, use=0, need=4),
         S('屬性賦予', 10, pb=('屬性', .12, 360)), S('冰封', 10, cd=15, mp=40, db=('冰封暴擊', .10, 4)), S('元素屏障', 10, pb=('屬性減傷', .30, 60)),
         S('魔力共享', 5), S('屬性看破', 5, pb=('屬性', .03, 999)), S('共鳴精靈', 10, cd=40, mp=50, c=1200, mag=True), S('大地束縛', 4),
         S('屬性場', 10, cd=25, mp=50, db=('受傷提高', .05, 12)), S('元素調和', 5)])
# ===================== 拳師 =====================
R['武鬥家'] = dict(cls='拳師', role='輸出', res='鐘聲', resMax=3, aspd=1.3, mp=650, mpr=7, hp=1.2,
  build=[S('晨功', 10, pas=dict(dmg=.20, aspd=.10)), S('撞鐘掌', 10, cd=3, mp=15, c=260, gen=1), S('連鐘拳', 10, cd=4, mp=20, c=340, gen=1),
         S('震鐘', 6, cd=7, mp=25, c=220, t=8), S('鐘鳴', 5, pas=dict(crit=.10)), S('破曉一擊', 5, cd=15, mp=40, c=300, use=100, need=1),
         S('武道', 10, pas=dict(dmg=.10)), S('晨鐘連環腿', 10, cd=6, mp=25, c=340, gen=1, combo=1), S('擺鐘', 10, cd=6, mp=25, c=300, t=4, gen=1, combo=2),
         S('洪鐘炮', 10, cd=6, mp=30, c=380, gen=1, combo=3), S('節拍強化', 10, pas=dict(dmg=.08)), S('止鐘拳', 5, cd=10, mp=20, c=200),
         S('燃鐘', 5, cd=60, buff=('dmg', .15, 30)), S('黎明之鐘', 5, cd=90, c=1500, need=3, use=0), S('鐘波', 4, cd=8, mp=20, c=250)])
R['氣功師'] = dict(cls='拳師', role='增益副坦', res='鐘聲', resMax=3, aspd=1.3, mp=650, mpr=7, hp=1.2,
  build=[S('晨功', 10, pas=dict(dmg=.20, aspd=.10)), S('撞鐘掌', 10, cd=3, mp=15, c=260, gen=1), S('連鐘拳', 10, cd=4, mp=20, c=340, gen=1),
         S('震鐘', 2, cd=7, mp=25, c=140, t=8), S('鐘鳴', 5, pas=dict(crit=.10)), S('金鐘身', 5, pas=dict(dr=.075)), S('輕身', 5),
         S('鐘韻光環', 10, pb=('攻速', .10, 999)), S('餘韻', 5), S('應鐘反擊', 10, cd=12, mp=25, c=400, gen=1), S('鐘壁', 10, cd=30, mp=30, buff=('dr', .15, 10)),
         S('調息', 10, cd=15, mp=30), S('清心', 5), S('點穴', 5, cd=15, mp=20, db=('攻擊降低', .15, 10)), S('靜心', 4), S('流水', 5, pas=dict(dmg=.05)), S('不動鐘', 5, cd=90)])
# ===================== 斥候 =====================
R['毒刃師'] = dict(cls='斥候', role='輸出', res='影', resMax=1, aspd=1.25, mp=600, mpr=6, hp=1.0,
  build=[S('短刃術', 10, pas=dict(dmg=.20)), S('雙刃', 10, pas=dict(double=.20)), S('影刺', 10, cd=4, mp=20, c=320, shadowX=2.0),
         S('淬毒', 10, dot=.30), S('夜幕', 5, cd=20, mp=30, shadow=8), S('潛影', 4, cd=15, mp=25, crit=True, shadow=4),
         S('夜毒', 10, dot=.40), S('毒夜幕', 5, cd=20, mp=40, c=150, t=8, shadow=8), S('毒師', 5, dot=.10),
         S('影步', 5, cd=10, mp=20, shadow=2), S('影襲', 10, cd=8, mp=30, c=450, shadowX=1.0), S('致命影刺', 10, pas=dict(shadowStab=.5)),
         S('雙刃精通', 10, pas=dict(dmg=.10)), S('夜之本能', 10, pas=dict(critd=.30)), S('無名之刃', 4, cd=30, mp=50, c=900)])
R['神偷'] = dict(cls='斥候', role='減益', res='影', resMax=1, aspd=1.25, mp=600, mpr=6, hp=1.0,
  build=[S('短刃術', 10, pas=dict(dmg=.20)), S('雙刃', 10, pas=dict(double=.20)), S('影刺', 10, cd=4, mp=20, c=320, shadowX=2.0),
         S('淬毒', 10, dot=.30), S('夜幕', 5, cd=20, mp=30, shadow=8), S('潛影', 4, cd=15, mp=25, crit=True, shadow=4), S('順手', 10), S('看破', 5),
         S('破綻標記', 10, cd=15, mp=30, db=('受傷提高', .10, 15)), S('卸力', 10, cd=15, mp=25, db=('攻擊降低', .20, 10)),
         S('蝕甲毒', 10, cd=12, mp=25, db=('防禦降低', .04, 12)), S('纏影', 10, pas=dict(debuffDur=.5)), S('迷霧', 4), S('妙手', 5), S('幸運星', 5)])

def points(build):
    return sum(s['lv'] for s in build if s['lv'] > 0)

def simulate(route, targets, T=120.0):
    d = R[route]; build = d['build']; mag = d.get('mag', False)
    P = {}
    for s in build:
        for k, v in (s.get('pas') or {}).items(): P[k] = P.get(k, 0) + v
    crit = CRIT + P.get('crit', 0); critd = CRITD + P.get('critd', 0)
    armor = .30 if targets == 1 else .15
    dmgm = 1 + P.get('dmg', 0); bossm = 1 + (P.get('boss', 0) if targets == 1 else 0)
    aspd = d['aspd'] * 1.6 * (1 + P.get('aspd', 0))
    cast = 1 - P.get('cast', 0)
    double = P.get('double', 0)
    acts = [s for s in build if s['lv'] > 0 and (s.get('c') or s.get('gen') or s.get('buff') or s.get('exec_')) and s.get('cd', 0) >= 0 and not s.get('pas')]
    ready = {s['n']: 0.0 for s in acts}
    last_elem = None; t = 0.0; total = 0.0; res = 0; buffs = {}; shadow_until = 0.0; combo_next = 1; mpu = 0.0
    log = {}
    def hit(c, tg, s=None):
        nonlocal total
        tg = min(tg, targets)
        pierce = s.get('pierce', 0) if s else 0
        arm = armor * (1 - pierce)
        cm = 1 if mag else (critd if (s and s.get('crit')) else 1 + crit * (critd - 1))
        bm = 1 + sum(v for k, (v, e) in buffs.items() if k == 'dmg' and e > t) + sum(v * res_snap for k, (v, e) in buffs.items() if k == 'dmgPerStack' and e > t)
        x = c / 100 * tg * (1 - arm) * cm * dmgm * bossm * bm * (1 + double)
        total += x; return x
    res_snap = 0
    while t < T:
        # 選技能：可用、資源足夠，挑「傷害／時間」最高的
        best, bv = None, 0
        for s in acts:
            if ready[s['n']] > t: continue
            if s.get('need') and res < s['need']: continue
            if s.get('combo') and s['combo'] != combo_next: continue
            if s.get('buff') and s['n'] in buffs and buffs[s['n']][1] > t: continue
            ct = max(GCD, s.get('ct', 0) * cast)
            c = s.get('c', 0) + s.get('use', 0) * (res if s.get('use') is not None else 0) + (s.get('exec_', 0) * 0.3)
            if s.get('use1') and res >= 1: c += s['use1'] * s['c'] / 100
            if s.get('shadowX') and shadow_until > t: c *= s['shadowX'] * (1 + P.get('shadowStab', 0))
            if s.get('useCandle'): c += s['useCandle'] * min(res, d['resMax'])
            v = c * min(s.get('t', 1), targets) / ct
            if s.get('buff'): v = 9e9
            if s.get('gen') and res < d['resMax'] and not c: v = 50 / ct
            if s.get('shadow') and shadow_until <= t: v = max(v, 400 / ct)
            if v > bv: best, bv = s, v
        aa_time = 1 / aspd
        if best is None or bv < (100 * (1 + (.3 if not mag else 0))) / aa_time * 0.999:
            # 普攻
            if best is None or bv * 1 < 100 / aa_time:
                c = 100 * (1 + P.get('proc', 0))
                if mag: c = 100
                x = hit(c, 1); log['普攻'] = log.get('普攻', 0) + x
                t += aa_time; continue
        s = best; ct = max(GCD, s.get('ct', 0) * cast)
        res_snap = res
        c = s.get('c', 0)
        if s.get('use1') and res >= 1: c += s['use1'] * s['c'] / 100; res -= 1
        if s.get('use') is not None and s.get('need') is not None:
            c += s['use'] * res; res = 0
        if s.get('useCandle'): c += s['useCandle'] * min(res, d['resMax'])
        if s.get('shadowX') and shadow_until > t: c *= s['shadowX'] * (1 + P.get('shadowStab', 0))
        if s.get('exec_'): c += s['exec_'] * 0.3   # 只有生命 30% 以下能放 → 平均 30% 時間
        if c: log[s['n']] = log.get(s['n'], 0) + hit(c, s.get('t', 1), s)
        if s.get('buff'):
            k, v, dur = s['buff']; buffs[k if k != 'dmgPerStack' else 'dmgPerStack'] = (v, t + dur)
            if k == 'dmgPerStack': res_snap = res; res = 0
        if s.get('gen'): res = min(d['resMax'], res + s['gen'])
        if s.get('genAoe') and targets >= 3: res = min(d['resMax'], res + s['genAoe'])
        if s.get('star') or s.get('candle'): res = min(d['resMax'], res + 1)
        if s.get('shadow'): shadow_until = t + s['shadow']
        if s.get('elem'):
            if s['elem'] != last_elem: res = min(d['resMax'], res + 1)
            else: res = max(0, res - 1)
            last_elem = s['elem']
        if s.get('combo'): combo_next = s['combo'] % 3 + 1
        mpu += s.get('mp', 0)
        ready[s['n']] = t + s.get('cd', 0); t += ct
    # 毒：每秒持續傷害＝普攻的 dot 比例
    dot = sum(x.get('dot', 0) for x in build if x['lv'] > 0)
    if dot: total += dot * T * min(targets, 3 if targets > 1 else 1) * (1 - armor)
    return total / T, mpu / T, log

def party_value(route, ally_dps):
    """隊伍增益與目標減益換算成等效輸出（假設另外 4 個隊友每人 ally_dps）；同一類只取最高"""
    best = {}
    ext = sum((x.get('pas') or {}).get('debuffDur', 0) for x in R[route]['build'])
    for s in R[route]['build']:
        if s['lv'] <= 0: continue
        if s.get('pb'):
            k, val, dur = s['pb']; cd = s.get('cd', 0) or dur
            up = min(1, dur / max(cd, dur))
            if k in ('能力', '攻速', '屬性'): best[k] = max(best.get(k, 0), val * up * ally_dps * 4)
        if s.get('db'):
            k, val, dur = s['db']; up = min(1, dur * (1 + ext) / max(s.get('cd', dur), dur))
            if k in ('受傷提高', '防禦降低', '冰封暴擊'): best[k] = max(best.get(k, 0), val * up * ally_dps * 5)
    return sum(best.values())

def ehp(route):
    """有效生命（相對值）：職業生命係數 ×(1＋生命加成) ÷ (1−平均減傷)，格擋與迴避也算成減傷"""
    d = R[route]; P = {}
    for x in d['build']:
        for k, v in (x.get('pas') or {}).items(): P[k] = P.get(k, 0) + v
    dr = P.get('dr', 0)
    for x in d['build']:
        if x.get('buff') and x['buff'][0] == 'dr': dr += x['buff'][1] * min(1, x['buff'][2] / x['cd'])
        if x.get('pb') and x['pb'][0] == '減傷': dr += x['pb'][1] * min(1, x['pb'][2] / x['cd'])
    dr += P.get('block', 0) * 0.5
    if d['cls'] == '斥候': dr += 0.15            # 迴避
    return d['hp'] * (1 + P.get('hp', 0)) / (1 - min(dr, .7))

def hps(route, T=120.0):
    """每秒治療量（相對魔攻 100%，全隊合計）：貪婪挑「治療量／施法時間」最高的技能"""
    d = R[route]; P = {}
    for x in d['build']:
        for k, v in (x.get('pas') or {}).items(): P[k] = P.get(k, 0) + v
    hm = 1 + P.get('heal', 0)
    heals = [x for x in d['build'] if x['lv'] > 0 and (x.get('heal') or x.get('healAoe') or x.get('shield'))]
    ready = {x['n']: 0 for x in heals}; t = 0; tot = 0; candles = 0
    while t < T:
        best, bv = None, 0
        for x in heals:
            if ready[x['n']] > t: continue
            amt = x.get('heal', 0) + x.get('healAoe', 0) * 5 * (1 + x.get('perCandle', 0) * candles) + x.get('shield', 0) / 2
            v = amt / max(GCD, x.get('ct', 0))
            if v > bv: best, bv = x, v
        if not best: t += 0.5; continue
        x = best; amt = x.get('heal', 0) + x.get('healAoe', 0) * 5 * (1 + x.get('perCandle', 0) * candles) + x.get('shield', 0) / 2
        tot += amt * hm; candles = min(3, candles + x.get('candle', 0))
        ready[x['n']] = t + x.get('cd', 0); t += max(GCD, x.get('ct', 0))
    return tot / T / 100

if __name__ == '__main__':
    rows = {}
    for r in R:
        p = points(R[r]['build'])
        st, mps, _ = simulate(r, 1); aoe, _, _ = simulate(r, 5)
        rows[r] = (p, st, aoe, mps)
    dps_routes = ['重劍士', '鷹眼射手', '毀滅法師', '武鬥家', '毒刃師', '驅魔師']
    base = sum(rows[r][1] for r in dps_routes) / len(dps_routes)
    print(f'{"路線":6} 點數  單體  群體(5隻) 隊伍增益  總貢獻  耗魔/秒')
    for r, (p, st, aoe, mps) in rows.items():
        pv = party_value(r, 100)
        print(f'{r:6} {p:>4} {st / base * 100:6.0f} {aoe / base * 100:8.0f} {pv:8.0f} {st / base * 100 + pv:7.0f} {mps:7.1f}  有效生命 {ehp(r):.2f}  治療 {hps(r):.1f}', '' if p <= POINTS else '← 點數超過')


def describe(x, res='資源'):
    out = []
    if x.get('c'): out.append(f"{'魔法' if x.get('mag') else '物理'} {x['c']}%" + (f"×最多 {x['t']} 隻" if x.get('t', 1) > 1 else ''))
    if x.get('exec_'): out.append(f"對生命 30% 以下的目標 {x['exec_']}%")
    if x.get('use1'): out.append(f"消耗 1 層多 {x['use1']}%")
    if x.get('use') and x.get('need') is not None: out.append(f"消耗全部{res}，每層 +{x['use']}%")
    if x.get('need') and not x.get('use'): out.append(f"需要 {x['need']} 層{res}")
    if x.get('useCandle'): out.append(f"每根燭火 +{x['useCandle']}%")
    if x.get('pierce'): out.append(f"無視防禦 {round(x['pierce'] * 100)}%")
    if x.get('crit'): out.append('必定暴擊')
    if x.get('shadowX') and x['shadowX'] > 1: out.append(f"影狀態或背後 ×{x['shadowX']}")
    elif x.get('shadowX'): out.append('一定算背刺')
    if x.get('shadow'): out.append(f"進入影狀態 {x['shadow']} 秒")
    if x.get('gen') or x.get('genAoe'): out.append(f'得 1 層{res}' + ('（打到 3 隻以上）' if x.get('genAoe') else ''))
    if x.get('star'): out.append('留 1 個星點')
    if x.get('candle'): out.append('留 1 根燭火')
    if x.get('elem'): out.append(f"{x['elem']}屬性，換屬性施放得 1 層共鳴")
    if x.get('combo'): out.append(f"連段第 {x['combo']} 招")
    if x.get('heal'): out.append(f"治療 {x['heal']}%")
    if x.get('healAoe'): out.append(f"全隊治療 {x['healAoe']}%" + (f"，每根燭火 +{round(x['perCandle'] * 100)}%" if x.get('perCandle') else ''))
    if x.get('shield'): out.append(f"護盾 {x['shield']}%")
    if x.get('healFrac'): out.append(f"傷害的 {round(x['healFrac'] * 100)}% 治療隊友")
    if x.get('dot'): out.append(f"持續毒傷（每秒普攻的 {round(x['dot'] * 100)}%）")
    if x.get('buff'):
        k, v, dur = x['buff']; nm = {'dr': '減傷', 'dmg': '傷害', 'crit': '暴擊率', 'dmgPerStack': '每層攻擊'}[k]
        out.append(f"自身{nm} +{round(v * 100)}%，{dur} 秒")
    if x.get('pb'):
        k, v, dur = x['pb']; out.append(f"隊伍{k} {'−' if k == '耗魔' else '+'}{round(v * 100)}%" + ('（常駐）' if dur >= 999 else f"，{dur} 秒"))
    if x.get('db'):
        k, v, dur = x['db']; out.append(f"目標{k} {round(v * 100)}%，{dur} 秒")
    for k, v in (x.get('pas') or {}).items():
        nm = {'dmg': '傷害', 'aspd': '攻速', 'crit': '暴擊率', 'critd': '暴擊傷害', 'boss': '對首領傷害', 'hp': '生命', 'heal': '治療量', 'cast': '詠唱時間 −',
              'block': '格擋率', 'double': '兩連擊機率', 'proc': '追擊機率', 'shadowStab': '影刺傷害', 'debuffDur': '減益持續', 'dr': '減傷'}.get(k, k)
        out.append(f"被動：{nm}{'' if nm.endswith('−') else ' +'}{round(v * 100)}%")
    return '；'.join(out) or '功能技（不計入輸出）'

def report_md():
    rows = {r: (points(R[r]['build']),) + simulate(r, 1)[:2] + (simulate(r, 5)[0],) for r in R}
    dps = ['重劍士', '鷹眼射手', '毀滅法師', '武鬥家', '毒刃師', '驅魔師']
    base = sum(rows[r][1] for r in dps) / len(dps)
    L = ['| 路線 | 一轉 | 定位 | 點數 | 單體輸出 | 群體輸出（5 隻） | 隊伍增益換算 | 總貢獻 | 耗魔／秒 | 有效生命 | 治療／秒 |', '|---|---|---|---|---|---|---|---|---|---|---|']
    for r, (p, st, mps, aoe) in rows.items():
        pv = party_value(r, 100)
        L.append(f"| {r} | {R[r]['cls']} | {R[r]['role']} | {p} | {st / base * 100:.0f} | {aoe / base * 100:.0f} | {pv:.0f} | {st / base * 100 + pv:.0f} | {mps:.1f} | {ehp(r):.2f} | {hps(r):.1f} |")
    detail = []
    for r in R:
        detail.append(f"**{r}**（代表配點 {points(R[r]['build'])} 點）\n\n| 技能 | 等級 | 冷卻 | 詠唱 | 耗魔 | 數值（該等級） |\n|---|---|---|---|---|---|")
        for x in R[r]['build']:
            if x['lv'] <= 0: continue
            detail.append(f"| {x['n']} | {x['lv']} | {str(x['cd']) + ' 秒' if x.get('cd') else '—'} | {str(x['ct']) + ' 秒' if x.get('ct') else '瞬發'} | {x.get('mp') or '—'} | {describe(x, R[r]['res'])} |")
        detail.append('')
    return '\n'.join(L), '\n'.join(detail)
