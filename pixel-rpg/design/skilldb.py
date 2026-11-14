"""長夜燈火：技能資料庫（唯一來源）。遊戲用的 skilldata.js 與平衡模擬都從這裡產生。
數值規則：
  主動技能的傷害／治療係數，Lv1＝滿級值的 (0.5 + 0.5/最高等級)，之後每級線性增加到滿級值。
  被動、增益、減益的數值從 0 線性增加：每級＝滿級值 ÷ 最高等級。
  耗魔：Lv1＝滿級耗魔的 60%，線性增加到滿級。
欄位：c＝每個目標的總傷害％（滿級）；t＝最多目標數；shape＝遊戲裡的施放方式（見 skilldata.js）。
"""
def K(id, name, owner, mx, kind, pre=(), **kw):
    return dict(id=id, name=name, owner=owner, max=mx, kind=kind, pre=list(pre), **kw)

# owner：一轉用遊戲職業 id（sword, priest, archer, mage, monk, scout），二轉用路線 id
ROUTES = {
    'sword': [('guard', '盾衛'), ('heavy', '重劍士')],
    'priest': [('healer', '聖療師'), ('exorcist', '驅魔師')],
    'archer': [('hawk', '鷹眼射手'), ('trapper', '陷阱師')],
    'mage': [('destroyer', '毀滅法師'), ('enchanter', '附魔師')],
    'monk': [('brawler', '武鬥家'), ('qigong', '氣功師')],
    'scout': [('venom', '毒刃師'), ('thief', '神偷')],
}
CLASS_NAME = {'sword': '戰士', 'priest': '治療師', 'archer': '射手', 'mage': '魔法使', 'monk': '拳師', 'scout': '斥候'}
RES = {'sword': ('誓約', 5), 'priest': ('燭火', 3), 'archer': ('星點', 5), 'mage': ('共鳴', 4), 'monk': ('鐘聲', 3), 'scout': ('影', 1)}

DB = [
 # ===== 戰士（守燈人・誓約） =====
 K('lampSword', '守燈劍術', 'sword', 10, 'pas', pas=dict(dmg=.20)),
 K('steadfast', '堅毅之身', 'sword', 10, 'pas', pas=dict(hp=.20)),
 K('lampSlash', '守燈斬', 'sword', 10, 'act', shape='melee', cd=3, mp=18, c=320, use1=50),
 K('ringSlash', '燈環斬', 'sword', 10, 'act', pre=[('lampSlash', 3)], shape='spin', cd=5, mp=22, c=200, t=8, genAoe=1),
 K('lightBlade', '光刃', 'sword', 10, 'act', pre=[('lampSword', 5)], shape='wave', cd=6, mp=15, c=250, t=4, elem='聖'),
 K('vow', '立誓', 'sword', 5, 'debuff', shape='taunt', cd=8, mp=10, gen=1, db=('防禦降低', .075, 10)),
 K('lampShield', '燈盾', 'sword', 5, 'buff', pre=[('steadfast', 3)], cd=30, mp=20, buff=('dr', .20, 15)),
 K('wick', '不滅燈芯', 'sword', 5, 'pas', pre=[('steadfast', 5)], pas=dict(lowDr=.25)),
 K('vowRelease', '誓約解放', 'sword', 5, 'act', pre=[('ringSlash', 5), ('lightBlade', 3)], shape='quake', cd=20, mp=30, c=200, t=8, use=60, need=2, elem='聖'),
 # 盾衛
 K('shieldMastery', '盾術精通', 'guard', 10, 'pas', pas=dict(block=.20)),
 K('lampBash', '燈盾擊', 'guard', 10, 'act', pre=[('lampSlash', 5)], shape='melee', cd=6, mp=20, c=300, stun=1.5),
 K('allLamps', '萬燈守望', 'guard', 10, 'util', pre=[('vow', 5)], shape='taunt', cd=10, mp=25, t=10, genPer2=1, desc='半徑 3 格怪物全部轉向自己，每吸引 2 隻得 1 層誓約'),
 K('proxyVow', '代誓', 'guard', 10, 'buff', pre=[('lampShield', 5)], cd=20, mp=30, buff=('dr', .30, 8), desc='替隊友承受 50% 傷害（單人時：自身減傷）'),
 K('lightWall', '光之壁壘', 'guard', 10, 'pbuff', pre=[('shieldMastery', 5)], cd=25, mp=40, pb=('減傷', .15, 10)),
 K('lampAura', '守燈光環', 'guard', 10, 'pas', pre=[('proxyVow', 3)], pb=('防禦', .20, 999)),
 K('vowCounter', '誓約反擊', 'guard', 10, 'pas', pre=[('shieldMastery', 3)], pas=dict(counter=1.4)),
 K('everLight', '長明', 'guard', 5, 'buff', pre=[('lampBash', 5)], cd=60, mp=20, buff=('holy', .30, 30)),
 K('neverOut', '永不熄滅', 'guard', 5, 'buff', pre=[('wick', 5)], cd=120, mp=30, buff=('undying', 10, 10)),
 K('lampCharge', '燈火衝鋒', 'guard', 10, 'act', pre=[('lampBash', 3)], shape='dash', cd=12, mp=25, c=250, t=4, stun=1),
 # 重劍士
 K('greatsword', '雙手劍術', 'heavy', 10, 'pas', pas=dict(dmg=.20, aspd=.10)),
 K('armorBreak', '碎甲斬', 'heavy', 10, 'act', pre=[('lampSword', 10)], shape='melee', cd=5, mp=20, c=380, pierce=.6),
 K('chargeSlash', '蓄光斬', 'heavy', 10, 'act', pre=[('lampSlash', 5)], shape='melee', cd=8, ct=1.0, mp=25, c=650, sure=1),
 K('thousand', '千刃', 'heavy', 10, 'act', pre=[('armorBreak', 3)], shape='barrage', cd=12, ct=1.0, mp=30, c=650),
 K('bladeStorm', '光刃風暴', 'heavy', 10, 'act', pre=[('ringSlash', 5)], shape='spin', cd=15, ct=1.5, mp=35, c=520, t=8, elem='風'),
 K('warSpirit', '戰意', 'heavy', 10, 'pas', pas=dict(crit=.10)),
 K('breakVow', '破誓', 'heavy', 5, 'buff', pre=[('greatsword', 5)], cd=45, mp=20, need=3, buff=('dmgPerStack', .10, 15)),
 K('ironCut', '斬鐵', 'heavy', 10, 'pas', pre=[('armorBreak', 5)], pas=dict(boss=.20)),
 K('flash', '一閃', 'heavy', 5, 'act', pre=[('chargeSlash', 5), ('warSpirit', 5)], shape='dash', cd=60, mp=40, c=1100, t=4, crit=True),
 K('breakRank', '破陣', 'heavy', 10, 'act', pre=[('vowRelease', 3)], shape='quake', cd=18, mp=30, c=300, t=8, db=('防禦降低', .06, 8)),
 # ===== 治療師（點燭者・燭火） =====
 K('candlePrayer', '燭光祈願', 'priest', 10, 'pas', pas=dict(heal=.50)),
 K('lightCandle', '點燭', 'priest', 10, 'heal', shape='heal', cd=2, ct=0.8, mp=30, heal=400, candle=1),
 K('callName', '喚名祝禱', 'priest', 10, 'pbuff', cd=0, mp=40, pb=('能力', .05, 240)),
 K('candleShadow', '輕盈燭影', 'priest', 10, 'pbuff', pre=[('callName', 3)], mp=40, pb=('攻速', .20, 240)),
 K('candleVeil', '燭幕', 'priest', 10, 'pbuff', mp=40, pb=('防禦', .20, 240)),
 K('candleArrow', '燭焰矢', 'priest', 10, 'act', shape='shot', cd=1.5, ct=0.8, mp=20, c=380, mag=True, elem='聖', candle=1),
 K('dust', '拂塵', 'priest', 1, 'util', pre=[('candlePrayer', 3)], cd=5, mp=10, desc='解除異常狀態'),
 K('rekindle', '重燃', 'priest', 4, 'util', pre=[('lightCandle', 5)], cd=10, ct=2, mp=60, desc='救起倒地的隊友，身邊燭火越多施法越快'),
 K('candleArray', '燭陣', 'priest', 5, 'heal', pre=[('candlePrayer', 5), ('candleVeil', 3)], shape='healAoe', cd=20, mp=50, healAoe=300),
 # 聖療師
 K('greatCandle', '大燭光', 'healer', 10, 'heal', pre=[('lightCandle', 10)], shape='healAoe', cd=6, ct=1.5, mp=80, healAoe=350, perCandle=.10),
 K('massRekindle', '群燭重燃', 'healer', 5, 'util', pre=[('rekindle', 4)], cd=150, ct=3, mp=200, desc='範圍內倒地隊友全部救起'),
 K('calmCandle', '靜心燭', 'healer', 10, 'pas', pre=[('candlePrayer', 5)], pb=('耗魔', .15, 999)),
 K('sanctum', '燭光聖域', 'healer', 10, 'pbuff', pre=[('candleArray', 5)], cd=30, mp=90, pb=('減傷', .15, 12)),
 K('lightCurtain', '光之帷幕', 'healer', 10, 'heal', pre=[('candleVeil', 5)], shape='shield', cd=8, mp=60, shield=1400),
 K('pureCandle', '淨燭', 'healer', 5, 'util', pre=[('dust', 1)], cd=20, mp=40, desc='範圍淨化，3 秒免疫異常'),
 K('grace', '恩典', 'healer', 10, 'pas', pre=[('candlePrayer', 10)], pas=dict(heal=.20)),
 K('guardCandle', '守護燭火', 'healer', 5, 'buff', pre=[('massRekindle', 1)], cd=120, buff=('undying', 1, 120), desc='隊友受到致命傷時保留 1 點生命'),
 K('nameWord', '名之言', 'healer', 10, 'pas', pas=dict(heal=.20)),
 K('mercy', '慈光', 'healer', 10, 'pas', pre=[('callName', 5)], pas=dict(heal=.20)),
 # 驅魔師
 K('purgeFlame', '驅邪燭焰', 'exorcist', 10, 'act', pre=[('candleArrow', 5)], shape='shot', cd=3, ct=0.8, mp=35, c=700, mag=True, elem='聖'),
 K('flameSea', '聖燭火海', 'exorcist', 10, 'act', pre=[('purgeFlame', 3)], shape='ground', cd=10, mp=50, c=500, t=8, mag=True, elem='聖', useCandle=80),
 K('sealName', '封名', 'exorcist', 5, 'debuff', pre=[('candleArrow', 5)], cd=30, mp=40, db=('封印', 4.5, 4.5)),
 K('reveal', '照見', 'exorcist', 10, 'debuff', pre=[('sealName', 1)], cd=10, mp=30, db=('受傷提高', .06, 10)),
 K('candleHammer', '燭台錘術', 'exorcist', 10, 'pas', pas=dict(dmg=.20)),
 K('lightEdge', '以光為刃', 'exorcist', 10, 'act', pre=[('purgeFlame', 5)], shape='shot', cd=8, mp=30, c=500, mag=True, elem='聖', healFrac=.20),
 K('exorcism', '驅魔', 'exorcist', 10, 'pas', pre=[('candleHammer', 3)], pas=dict(dmg=.15)),
 K('burnSelf', '燃身', 'exorcist', 5, 'buff', pre=[('flameSea', 5)], cd=60, buff=('dmg', .25, 15)),
 K('holySeal', '聖燭印', 'exorcist', 10, 'pbuff', pre=[('callName', 5)], mp=50, pb=('屬性', .10, 240)),
 K('skyLight', '天光', 'exorcist', 5, 'act', pre=[('reveal', 5), ('flameSea', 5)], shape='ground', cd=45, ct=1.0, mp=80, c=1400, t=8, mag=True, elem='聖'),
 # ===== 射手（觀星人・星點） =====
 K('nightSight', '夜視', 'archer', 10, 'pas', pas=dict(hit=10, range=1)),
 K('stringArt', '弦術', 'archer', 10, 'pas', pas=dict(dmg=.30)),
 K('twinStar', '雙星矢', 'archer', 10, 'act', shape='shot', cd=2, mp=12, c=240, star=1, hits=2),
 K('scatterStar', '散星', 'archer', 10, 'act', pre=[('twinStar', 3)], shape='fan', cd=5, mp=18, c=200, t=3, star=1),
 K('starfall', '星落', 'archer', 10, 'act', pre=[('nightSight', 3)], shape='rain', cd=8, mp=30, c=280, t=8, star=1),
 K('meteorPierce', '流星貫', 'archer', 10, 'act', pre=[('scatterStar', 5)], shape='bigshot', cd=6, mp=20, c=350, t=4, elem='風'),
 K('linkStars', '連星', 'archer', 5, 'act', pre=[('scatterStar', 3)], shape='ground', cd=15, mp=30, c=280, t=8, use=40, need=3, db=('減速', .30, 6)),
 K('stargaze', '觀星', 'archer', 5, 'buff', pre=[('nightSight', 5)], cd=60, mp=20, buff=('crit', .15, 30)),
 K('leap', '躍步', 'archer', 5, 'util', shape='leap', cd=10, mp=15, star=1, desc='向後跳開，原地留 1 個星點'),
 # 鷹眼射手
 K('starEye', '星眼狙擊', 'hawk', 10, 'act', pre=[('stargaze', 5)], shape='bigshot', cd=6, ct=1.0, mp=30, c=520),
 K('pierceStar', '破甲星矢', 'hawk', 10, 'act', pre=[('stringArt', 5)], shape='shot', cd=8, mp=25, c=330, pierce=.55),
 K('fatalStar', '致命星位', 'hawk', 10, 'pas', pre=[('stargaze', 3)], pas=dict(critd=.25)),
 K('siriusEye', '天狼之眼', 'hawk', 10, 'pas', pre=[('nightSight', 10)], pas=dict(crit=.10)),
 K('fixStar', '定星', 'hawk', 5, 'pas', pre=[('starEye', 3)], pas=dict(dmg=.10)),
 K('pearlString', '連珠', 'hawk', 10, 'act', pre=[('twinStar', 10)], shape='shot', cd=8, mp=30, c=560, star=1, hits=4),
 K('heartStar', '心宿', 'hawk', 10, 'pas', pre=[('fatalStar', 5)], pas=dict(boss=.10)),
 K('burstStar', '爆星矢', 'hawk', 10, 'act', pre=[('meteorPierce', 3)], shape='fireball', cd=10, mp=30, c=460, t=4, use=30, need=1, elem='火'),
 K('calm', '冷靜', 'hawk', 5, 'pas', pre=[('fixStar', 3)], pas=dict(flee=10)),
 K('finisher', '隕星終結', 'hawk', 10, 'act', pre=[('starEye', 5), ('heartStar', 3)], shape='bigshot', cd=12, mp=40, exec_=1000),
 # 陷阱師
 K('frostTrap', '霜星陷阱', 'trapper', 10, 'act', pre=[('leap', 3)], shape='trap', cd=10, mp=25, c=150, t=4, star=1, freeze=3, elem='水'),
 K('blastTrap', '爆裂陷阱', 'trapper', 10, 'act', pre=[('frostTrap', 3)], shape='trap', cd=8, mp=30, c=420, t=6, star=1, elem='火'),
 K('trapMastery', '陷阱精通', 'trapper', 10, 'pas', pre=[('frostTrap', 1)], pas=dict(dmg=.25)),
 K('starNet', '星網', 'trapper', 10, 'debuff', pre=[('linkStars', 3)], cd=20, mp=40, db=('受傷提高', .08, 10)),
 K('nightLight', '照夜', 'trapper', 5, 'util', pre=[('nightSight', 3)], cd=30, mp=20, desc='揭露隱形敵人，全隊命中 +5%／級'),
 K('nightHawk', '夜鷹', 'trapper', 10, 'pas', pre=[('nightSight', 5)], pas=dict(proc=.25)),
 K('hunterSense', '獵手本能', 'trapper', 5, 'pas', pre=[('nightHawk', 5)], pas=dict(dmg=.10)),
 K('starRain', '星雨', 'trapper', 10, 'act', pre=[('starfall', 10)], shape='rain', cd=18, ct=2.0, mp=60, c=800, t=10),
 K('galeStep', '疾風步', 'trapper', 10, 'buff', pre=[('leap', 5)], cd=30, mp=20, buff=('aspd', .15, 20)),
 K('windGrace', '風之加護', 'trapper', 10, 'pas', pre=[('galeStep', 3)], pb=('迴避', .10, 999)),
 # ===== 魔法使（共鳴者・共鳴） =====
 K('soulLore', '魂像學', 'mage', 10, 'pas', pas=dict(dmg=.30)),
 K('quickCast', '快詠', 'mage', 10, 'pas', pre=[('soulLore', 3)], pas=dict(cast=.20)),
 K('emberSeed', '餘燼之種', 'mage', 10, 'act', shape='fireball', cd=4, ct=0.8, mp=30, c=300, t=3, mag=True, elem='火'),
 K('frostBreath', '霜之息', 'mage', 10, 'act', shape='nova', cd=6, ct=0.8, mp=35, c=250, t=8, mag=True, elem='水', freeze=1),
 K('thunderThread', '雷絲', 'mage', 10, 'act', pre=[('emberSeed', 3)], shape='chain', cd=5, ct=1.0, mp=35, c=320, t=3, mag=True, elem='風'),
 K('rockThorn', '岩棘', 'mage', 10, 'act', pre=[('frostBreath', 3)], shape='shot', cd=5, ct=1.0, mp=35, c=380, mag=True, elem='地'),
 K('soulBarrier', '魂障', 'mage', 5, 'buff', pre=[('soulLore', 5)], cd=30, mp=30, buff=('manaShield', .5, 20)),
 K('fourResonance', '四象共鳴', 'mage', 5, 'act', pre=[('emberSeed', 5), ('frostBreath', 5)], shape='nova', cd=20, ct=1.0, mp=60, c=500, t=8, mag=True, need=4, use=0),
 # 毀滅法師
 K('moltenStar', '熔星', 'destroyer', 10, 'act', pre=[('emberSeed', 10)], shape='ground', cd=10, ct=2.0, mp=65, c=700, t=8, mag=True, elem='火'),
 K('frostStorm', '永凍風暴', 'destroyer', 10, 'act', pre=[('frostBreath', 10)], shape='ground', cd=12, ct=2.0, mp=75, c=560, t=10, mag=True, elem='水', freeze=1),
 K('thunderNet', '雷霆網', 'destroyer', 10, 'act', pre=[('thunderThread', 10)], shape='chain', cd=10, ct=1.5, mp=70, c=550, t=8, mag=True, elem='風'),
 K('earthCollapse', '大地崩', 'destroyer', 10, 'act', pre=[('rockThorn', 10)], shape='wave', cd=10, ct=1.5, mp=70, c=600, t=6, mag=True, elem='地'),
 K('castMastery', '詠唱精通', 'destroyer', 10, 'pas', pre=[('quickCast', 5)], pas=dict(cast=.30)),
 K('resonanceAmp', '共鳴增幅', 'destroyer', 10, 'pas', pre=[('soulLore', 5)], pas=dict(dmg=.10)),
 K('doubleCast', '雙重詠唱', 'destroyer', 10, 'pas', pre=[('castMastery', 5)], pas=dict(double=.20)),
 K('elemShift', '屬性轉調', 'destroyer', 5, 'pas', pre=[('moltenStar', 3)], pas=dict(dmg=.06)),
 K('soulBurst', '魂像爆發', 'destroyer', 5, 'buff', pre=[('soulLore', 10)], cd=60, buff=('dmg', .25, 10)),
 K('allInOne', '萬象歸一', 'destroyer', 5, 'act', pre=[('fourResonance', 5), ('soulBurst', 5)], shape='screen', cd=180, ct=1.5, mp=200, c=2000, t=99, mag=True, need=4, use=0),
 # 附魔師
 K('elemGrant', '屬性賦予', 'enchanter', 10, 'pbuff', pre=[('emberSeed', 5)], mp=60, pb=('屬性', .12, 360)),
 K('iceSeal', '冰封', 'enchanter', 10, 'debuff', pre=[('frostBreath', 5)], cd=15, mp=40, db=('冰封暴擊', .10, 4), freeze=4),
 K('elemBarrier', '元素屏障', 'enchanter', 10, 'pbuff', pre=[('soulBarrier', 3)], mp=50, pb=('屬性減傷', .30, 60)),
 K('manaShare', '魔力共享', 'enchanter', 5, 'util', pre=[('soulLore', 5)], cd=30, desc='把自己 10%／級 的魔力分給隊友'),
 K('elemSight', '屬性看破', 'enchanter', 5, 'pas', pre=[('elemGrant', 3)], pb=('屬性', .05, 999)),
 K('resSpirit', '共鳴精靈', 'enchanter', 10, 'act', pre=[('emberSeed', 5)], shape='shot', cd=40, mp=50, c=1200, mag=True),
 K('earthBind', '大地束縛', 'enchanter', 10, 'debuff', pre=[('rockThorn', 3)], cd=20, mp=30, db=('定身', 2, 2)),
 K('elemField', '屬性場', 'enchanter', 10, 'debuff', pre=[('elemBarrier', 3)], cd=25, mp=50, db=('受傷提高', .05, 12)),
 K('iceArmor', '冰晶護甲', 'enchanter', 10, 'buff', pre=[('iceSeal', 3)], cd=30, mp=40, buff=('dr', .15, 20)),
 K('elemHarmony', '元素調和', 'enchanter', 10, 'pas', pas=dict(buffDur=.50)),
 # ===== 拳師（撞鐘人・鐘聲） =====
 K('dawnArt', '晨功', 'monk', 10, 'pas', pas=dict(dmg=.20, aspd=.10)),
 K('bellPalm', '撞鐘掌', 'monk', 10, 'act', shape='melee', cd=3, mp=15, c=260, gen=1),
 K('bellFists', '連鐘拳', 'monk', 10, 'act', pre=[('bellPalm', 3)], shape='barrage', cd=4, mp=20, c=340, gen=1),
 K('bellQuake', '震鐘', 'monk', 10, 'act', pre=[('dawnArt', 3)], shape='shock', cd=7, mp=25, c=300, t=8, elem='地'),
 K('bellRing', '鐘鳴', 'monk', 5, 'pas', pre=[('dawnArt', 5)], pas=dict(crit=.10)),
 K('goldBell', '金鐘身', 'monk', 10, 'pas', pas=dict(dr=.15)),
 K('lightBody', '輕身', 'monk', 5, 'pas', pre=[('dawnArt', 3)], pas=dict(flee=10)),
 K('dawnStrike', '破曉一擊', 'monk', 5, 'act', pre=[('bellFists', 5), ('bellQuake', 3)], shape='dash', cd=15, mp=40, c=300, use=100, need=1, elem='火'),
 # 武鬥家
 K('martialWay', '武道', 'brawler', 10, 'pas', pas=dict(dmg=.10)),
 K('dawnKicks', '晨鐘連環腿', 'brawler', 10, 'act', pre=[('bellFists', 3)], shape='barrage', cd=6, mp=25, c=340, gen=1, combo=1),
 K('pendulum', '擺鐘', 'brawler', 10, 'act', pre=[('dawnStrike', 3)], shape='shock', cd=6, mp=25, c=300, t=4, gen=1, combo=2),
 K('bellCannon', '洪鐘炮', 'brawler', 10, 'act', pre=[('stopBell', 3)], shape='melee', cd=6, mp=30, c=380, gen=1, combo=3),
 K('beatAmp', '節拍強化', 'brawler', 10, 'pas', pre=[('bellFists', 5)], pas=dict(dmg=.08)),
 K('stopBell', '止鐘拳', 'brawler', 10, 'act', pre=[('bellPalm', 5)], shape='melee', cd=10, mp=20, c=300, interrupt=1),
 K('bellWave', '鐘波', 'brawler', 10, 'act', pre=[('dawnArt', 5)], shape='shot', cd=8, mp=20, c=400),
 K('burnBell', '燃鐘', 'brawler', 5, 'buff', pre=[('bellRing', 5)], cd=60, buff=('dmg', .15, 30)),
 K('bellGuard', '金鐘罩', 'brawler', 5, 'buff', pre=[('goldBell', 10)], cd=30, mp=20, buff=('dr', .40, 5)),
 K('dawnBell', '黎明之鐘', 'brawler', 5, 'act', pre=[('burnBell', 5), ('bellCannon', 5)], shape='quake', cd=90, c=1500, t=6, need=3, use=0),
 # 氣功師
 K('bellAura', '鐘韻光環', 'qigong', 10, 'pas', pre=[('bellRing', 5)], pb=('攻速', .10, 999)),
 K('echoAura', '餘韻', 'qigong', 10, 'pas', pre=[('bellAura', 3)], pas=dict(auraRange=3)),
 K('bellCounter', '應鐘反擊', 'qigong', 10, 'act', pre=[('lightBody', 3)], shape='melee', cd=12, mp=25, c=400, gen=1),
 K('bellWall', '鐘壁', 'qigong', 10, 'buff', pre=[('goldBell', 5)], cd=30, mp=30, buff=('dr', .15, 10)),
 K('breathe', '調息', 'qigong', 10, 'heal', pre=[('dawnArt', 5)], shape='heal', cd=15, mp=30, heal=300),
 K('clearMind', '清心', 'qigong', 10, 'util', pre=[('breathe', 3)], cd=20, mp=20, desc='解除一名隊友的異常並回復'),
 K('pressPoint', '點穴', 'qigong', 5, 'debuff', pre=[('bellPalm', 5)], cd=15, mp=20, db=('攻擊降低', .15, 10)),
 K('stillHeart', '靜心', 'qigong', 10, 'pas', pas=dict(status=.30)),
 K('flowWater', '流水', 'qigong', 10, 'pas', pre=[('lightBody', 5)], pas=dict(dmg=.10)),
 K('unmovedBell', '不動鐘', 'qigong', 5, 'pbuff', pre=[('bellWall', 5)], cd=90, pb=('免控', 1, 8)),
 # ===== 斥候（夜行者・影域） =====
 K('shortBlade', '短刃術', 'scout', 10, 'pas', pas=dict(dmg=.20)),
 K('twinBlade', '雙刃', 'scout', 10, 'pas', pas=dict(double=.20)),
 K('shadowStab', '影刺', 'scout', 10, 'act', pre=[('shortBlade', 3)], shape='melee', cd=4, mp=20, c=320, shadowX=2.0),
 K('poisonCoat', '淬毒', 'scout', 10, 'pas', dot=.30),
 K('nightVeil', '夜幕', 'scout', 5, 'act', pre=[('poisonCoat', 3)], shape='veil', cd=20, mp=30, shadow=8),
 K('hide', '潛影', 'scout', 10, 'buff', cd=15, mp=25, crit=True, shadow=4, buff=('stealth', 1, 4)),
 K('pickpocket', '順手', 'scout', 10, 'util', cd=10, mp=15, desc='偷竊：機率從怪物身上多拿一件掉落'),
 K('seeThrough', '看破', 'scout', 5, 'debuff', pre=[('pickpocket', 3), ('nightVeil', 1)], cd=15, mp=20, db=('受傷提高', .10, 10)),
 # 毒刃師
 K('nightPoison', '夜毒', 'venom', 10, 'pas', pre=[('poisonCoat', 10)], dot=.40),
 K('poisonVeil', '毒夜幕', 'venom', 5, 'act', pre=[('nightVeil', 3)], shape='veil', cd=20, mp=40, c=150, t=8, shadow=8),
 K('poisonMaster', '毒師', 'venom', 10, 'pas', pre=[('poisonCoat', 3)], dot=.20),
 K('shadowStep', '影步', 'venom', 10, 'act', pre=[('hide', 1)], shape='blink', cd=10, mp=20, shadow=2),
 K('shadowRaid', '影襲', 'venom', 10, 'act', pre=[('hide', 3)], shape='melee', cd=8, mp=30, c=450, backstab=1),
 K('fatalStab', '致命影刺', 'venom', 10, 'pas', pre=[('shadowStab', 10)], pas=dict(shadowStab=.50)),
 K('dualMastery', '雙刃精通', 'venom', 10, 'pas', pre=[('twinBlade', 5)], pas=dict(dmg=.10)),
 K('nightInstinct', '夜之本能', 'venom', 10, 'pas', pas=dict(critd=.30)),
 K('shadowClone', '影分身', 'venom', 5, 'util', pre=[('hide', 5)], cd=40, mp=40, desc='召喚兩個影子吸引攻擊 8 秒'),
 K('namelessBlade', '無名之刃', 'venom', 5, 'act', pre=[('fatalStab', 5), ('nightPoison', 5)], shape='melee', cd=30, mp=50, c=1100),
 # 神偷
 K('flawMark', '破綻標記', 'thief', 10, 'debuff', pre=[('seeThrough', 5)], cd=15, mp=30, db=('受傷提高', .10, 15)),
 K('disarm', '卸力', 'thief', 10, 'debuff', pre=[('flawMark', 3)], cd=15, mp=25, db=('攻擊降低', .20, 10)),
 K('rustPoison', '蝕甲毒', 'thief', 10, 'debuff', pre=[('poisonCoat', 5)], cd=12, mp=25, db=('防禦降低', .04, 12)),
 K('entangle', '纏影', 'thief', 10, 'pas', pre=[('disarm', 3)], pas=dict(debuffDur=.50)),
 K('mist', '迷霧', 'thief', 10, 'act', pre=[('nightVeil', 3)], shape='veil', cd=20, mp=30, shadow=8, confuse=2),
 K('shadowWalk', '影中同行', 'thief', 5, 'buff', pre=[('mist', 3)], cd=40, mp=30, shadow=3, buff=('stealth', 1, 3)),
 K('deftHand', '妙手', 'thief', 10, 'pas', pre=[('pickpocket', 10)], pas=dict(stealGold=1)),
 K('lockpick', '開鎖術', 'thief', 5, 'pas', pre=[('pickpocket', 5)], pas=dict(chest=.20)),
 K('luckyStar', '幸運星', 'thief', 10, 'pas', pas=dict(drop=.10)),
 K('switcheroo', '偷天換日', 'thief', 10, 'util', pre=[('flawMark', 5), ('deftHand', 3)], cd=30, mp=40, desc='偷走目標身上一個增益，轉給全隊'),
]
BY_ID = {s['id']: s for s in DB}

def at(s, field, lv):
    """技能在某等級的數值"""
    mx = s['max']; lv = max(0, min(mx, lv))
    if field in ('c', 'heal', 'healAoe', 'shield', 'exec_'):
        v = s.get(field, 0)
        return round(v * (0.5 + 0.5 * lv / mx)) if lv else 0
    if field == 'mp':
        return round(s.get('mp', 0) * (0.6 + 0.4 * lv / mx)) if lv else 0
    return s.get(field)

def scaled(val, s, lv):
    return val * lv / s['max']

def check():
    errs = []
    for s in DB:
        for p, plv in s['pre']:
            if p not in BY_ID: errs.append(f"{s['name']} 的前置 {p} 不存在")
            elif plv > BY_ID[p]['max']: errs.append(f"{s['name']} 的前置等級超過上限")
    ids = [s['id'] for s in DB]; assert len(ids) == len(set(ids))
    # 每條二轉 10 招、每個一轉 8～9 招
    from collections import Counter
    cnt = Counter(s['owner'] for s in DB)
    for o, n in cnt.items():
        if o in RES and not 8 <= n <= 9: errs.append(f'{o} 一轉 {n} 招')
        if o not in RES and n != 10: errs.append(f'{o} 二轉 {n} 招')
    return errs

if __name__ == '__main__':
    print(check() or '技能資料庫檢查通過', len(DB))
