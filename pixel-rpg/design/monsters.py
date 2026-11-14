"""長夜燈火：怪物圖鑑產生器。所有數值由公式算出，改公式重跑即可。"""
import csv, json
from roster import REGIONS
from levels import mon_exp

# 原型倍率：生命、攻擊、防禦、魔防、迴避、經驗、攻擊間隔(秒)、移動
ARCH = {
 'swarm':  dict(name='群聚', hp=.6, atk=.7, df=.8, mdf=.8, flee=1.0, exp=.6, iv=1.6, mv='快'),
 'normal': dict(name='一般', hp=1, atk=1, df=1, mdf=1, flee=1, exp=1, iv=2.0, mv='普通'),
 'tank':   dict(name='硬殼', hp=1.5, atk=.9, df=1.8, mdf=1.2, flee=.6, exp=1.35, iv=2.2, mv='慢'),
 'agile':  dict(name='敏捷', hp=.8, atk=1, df=.8, mdf=.8, flee=1.8, exp=1.0, iv=1.4, mv='快'),
 'caster': dict(name='法術', hp=.8, atk=1.2, df=.7, mdf=1.6, flee=1, exp=1.05, iv=2.4, mv='普通'),
 'ranged': dict(name='遠程', hp=.85, atk=1.1, df=.8, mdf=.9, flee=1.1, exp=1.0, iv=2.0, mv='普通'),
 'big':    dict(name='大型', hp=2.2, atk=1.5, df=1.3, mdf=1.1, flee=.6, exp=2.0, iv=2.6, mv='慢'),
 'boss':   dict(name='野外魔王', hp=60, atk=3.0, df=2.0, mdf=2.0, flee=1.2, exp=40, iv=2.0, mv='普通'),
}
# 基準：同等級標準配裝的玩家約 4 秒打倒一隻「一般」原型
base_hp = lambda L: round(30 + 9 * L ** 1.5 * 1.012 ** L)
base_atk = lambda L: round(8 + 2.2 * L * 1.004 ** L)
base_def = lambda L: round(L * 1.2)
base_mdef = lambda L: round(L * 0.8)
base_hit = lambda L: round(40 + L * 2.2)
base_flee = lambda L: round(15 + L * 1.6)
coin = lambda L: max(1, round(L / 3))      # 每隻平均金幣（經濟表：在線每小時約 L×200）

CARD_SLOT = {'swarm': '頭', 'normal': '武器', 'tank': '身體', 'agile': '鞋', 'caster': '飾品', 'ranged': '披風', 'big': '武器', 'boss': '飾品'}
CASTER_STAT = {'水': '智力', '火': '力量', '風': '敏捷', '地': '體質', '念': '智力', '暗': '幸運', '毒': '敏捷', '聖': '智力', '不死': '體質', '無': '靈巧'}

def card(m, tier, night):
    k = 1.6 if night else 1.0
    s = CARD_SLOT[m['arch']]
    if m['arch'] == 'boss':
        return s, f"全能力 +{round((3 + tier) * k)}，{m['elem']}屬性攻擊 +{round((10 + 2 * tier) * k)}%"
    v = {'武器': f"對{m['race']}族 +{round((15 + 3 * tier) * k)}%",
         '身體': f"受{m['elem']}屬性傷害 −{round((10 + 2 * tier) * k)}%、生命 +{round(3 * k)}%",
         '頭': f"每秒回復生命 +{round(0.3 * k + 0.05 * tier, 2)}%",
         '鞋': f"迴避 +{round((5 + tier) * k)}、移速 +{round(3 * k)}%",
         '飾品': f"{CASTER_STAT[m['elem']]} +{round((2 + tier) * k)}",
         '披風': f"受遠程攻擊傷害 −{round((8 + 2 * tier) * k)}%"}[s]
    return s, v

def drops(m, reg, night):
    a = m['arch']
    if a == 'boss':
        d = [(m['matA'], 100), (m['matB'], 30), ('稀有以上裝備（該區）', 100), (f"{reg['name']}魂像碎片 ×3～5", 100), ('精煉石 ×5', 100), ('卡片', 1)]
    else:
        d = [(m['matA'], 55 if a == 'swarm' else 40), (m['matB'], 6), (reg['drop'] if a in ('swarm', 'agile', 'caster') else reg['ore'], 8),
             ('回復藥水', 2), ('該區裝備', 1.5 if a in ('tank', 'big') else 1.0), ('卡片', 0.02)]
    if night:
        d += [('名字碎片', 0.25 if a != 'boss' else 100), ('封名匣', 1 / 120 if a != 'boss' else 10)]
    return d

def build():
    out = []
    for ti, reg in enumerate(REGIONS):
        for night in (False, True):
            L0, L1 = reg['night'] if night else reg['day']
            mons = reg['mons']
            for i, t in enumerate(mons + [reg['boss']]):
                boss = i == len(mons)
                mid, name, elem, el, race, size = t[0], t[1], t[2], t[3], t[4], t[5]
                arch = 'boss' if boss else t[6]
                trait = t[6] if boss else t[7]
                matA, matB = (t[7], t[8]) if boss else (t[8], t[9])
                L = L1 + 2 if boss else round(L0 + (L1 - L0) * i / (len(mons) - 1))
                if night:
                    name = ('深夜・' if boss else '蝕・') + name
                    el = min(4, el + 1)
                    trait = trait + '；蝕化：生命低於 30% 時攻擊 +30%'
                A = ARCH[arch]
                m = dict(region=reg['name'], night=night, id=mid + ('_n' if night else ''), name=name, lv=L, elem=elem, el=el, race=race, size=size,
                         arch=arch, archName=A['name'], trait=trait, matA=matA, matB=matB,
                         hp=round(base_hp(L) * A['hp']), atk=round(base_atk(L) * A['atk']), df=round(base_def(L) * A['df']), mdf=round(base_mdef(L) * A['mdf']),
                         hit=base_hit(L), flee=round(base_flee(L) * A['flee']), iv=A['iv'], mv=A['mv'],
                         exp=round(mon_exp(L) * A['exp']), coin=coin(L) * (30 if boss else 1),
                         respawn=('120 分' if night else '60 分') if boss else '20 秒')
                m['jexp'] = round(m['exp'] * 0.75)
                m['cardSlot'], m['cardEff'] = card(m, ti, night)
                m['drops'] = drops(m, reg, night)
                out.append(m)
    return out

def fmt_rate(r):
    if r >= 1: return f'{r:g}%'
    return f'1/{round(100 / r):,}'

if __name__ == '__main__':
    ms = build()
    with open('monsters.csv', 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(['地區', '深夜', 'id', '名稱', '等級', '屬性', '屬性等級', '種族', '體型', '原型', '生命', '攻擊', '防禦', '魔防', '命中', '迴避', '攻擊間隔', '移動', '經驗', '職業經驗', '金幣', '重生', '特性', '卡片欄位', '卡片效果', '掉落'])
        for m in ms:
            w.writerow([m['region'], '是' if m['night'] else '', m['id'], m['name'], m['lv'], m['elem'], m['el'], m['race'], m['size'], m['archName'], m['hp'], m['atk'], m['df'], m['mdf'], m['hit'], m['flee'], m['iv'], m['mv'], m['exp'], m['jexp'], m['coin'], m['respawn'], m['trait'], m['cardSlot'], m['cardEff'], '；'.join(f'{a} {fmt_rate(b)}' for a, b in m['drops'])])
    json.dump(ms, open('monsters.json', 'w'), ensure_ascii=False)
    # 檢查：每區至少 3 種屬性、4 種種族
    for reg in REGIONS:
        es = {t[2] for t in reg['mons']}; rs = {t[4] for t in reg['mons']}
        print(f"{reg['name']}: 怪物 {len(reg['mons'])} 種、屬性 {len(es)} 種、種族 {len(rs)} 種", '' if len(es) >= 3 and len(rs) >= 4 else '← 不足')
    print('總數', len(ms))
    for m in ms[:3] + ms[13:15] + [x for x in ms if x['lv'] in (99, 101, 200)]:
        print(m['name'], m['lv'], m['hp'], m['atk'], m['exp'], m['cardSlot'], m['cardEff'])
