"""用技能資料庫（skilldb.py）＋代表配點（builds.py）做平衡模擬，並檢查點數與前置條件。"""
import skills, skilldb
from builds import BUILDS
DB = skilldb.BY_ID
ROUTE_CLASS = {rid: c for c, rs in skilldb.ROUTES.items() for rid, _ in rs}
ROUTE_NAME = {rid: n for c, rs in skilldb.ROUTES.items() for rid, n in rs}
META = {  # 職業基本資料（和設計文件「職業基礎數值」一致）
    'sword': dict(aspd=1.0, mp=600, mpr=6, hp=1.4), 'priest': dict(aspd=.9, mp=1400, mpr=14, hp=1.0, mag=True),
    'archer': dict(aspd=1.1, mp=700, mpr=7, hp=.9), 'mage': dict(aspd=.8, mp=1600, mpr=16, hp=.8, mag=True),
    'monk': dict(aspd=1.3, mp=650, mpr=7, hp=1.2), 'scout': dict(aspd=1.25, mp=600, mpr=6, hp=1.0)}
ROLE = {'guard': '坦', 'heavy': '輸出', 'healer': '補', 'exorcist': '輸出', 'hawk': '輸出', 'trapper': '控場', 'destroyer': '群體輸出',
        'enchanter': '增益控場', 'brawler': '輸出', 'qigong': '增益副坦', 'venom': '輸出', 'thief': '減益'}

def check_build(rid):
    lv = dict(BUILDS[rid]); errs = []
    c = ROUTE_CLASS[rid]
    for sid, l in lv.items():
        s = DB[sid]
        if s['owner'] not in (c, rid): errs.append(f'{s["name"]} 不屬於這條路線')
        if l > s['max']: errs.append(f'{s["name"]} 超過上限')
        for p, pl in s['pre']:
            if lv.get(p, 0) < pl: errs.append(f'{s["name"]} 需要 {DB[p]["name"]} {pl}')
    p2 = sum(l for sid, l in lv.items() if DB[sid]['owner'] == rid)
    tot = sum(lv.values())
    if p2 > 69: errs.append(f'二轉技能 {p2} 點 > 69')
    if tot > 118: errs.append(f'總點數 {tot} > 118')
    return errs, tot

def to_sim(sid, lv):
    s = DB[sid]; k = lambda v: v * lv / s['max']
    d = dict(n=s['name'], lv=lv)
    for f in ('cd', 'ct', 't', 'gen', 'genAoe', 'use1', 'use', 'need', 'pierce', 'crit', 'mag', 'perCandle', 'healFrac', 'shadow', 'shadowX',
              'star', 'candle', 'combo', 'useCandle', 'elem'):
        if f in s: d[f] = s[f]
    for f in ('c', 'heal', 'healAoe', 'shield', 'exec_'):
        if s.get(f): d[f] = skilldb.at(s, f, lv)
    if s.get('mp'): d['mp'] = skilldb.at(s, 'mp', lv)
    if s.get('dot'): d['dot'] = k(s['dot'])
    for f in ('buff', 'pb', 'db'):
        if s.get(f):
            name, v, dur = s[f]
            d[f] = (name, v if name in ('封印', '定身', 'undying', 'stealth', '免控') else k(v), dur)
    if s.get('pas'): d['pas'] = {a: k(v) for a, v in s['pas'].items()}
    return d

def load():
    skills.R.clear()
    for rid, pairs in BUILDS.items():
        c = ROUTE_CLASS[rid]; m = META[c]
        skills.R[ROUTE_NAME[rid]] = dict(cls=skilldb.CLASS_NAME[c], role=ROLE[rid], res=skilldb.RES[c][0], resMax=skilldb.RES[c][1],
                                         build=[to_sim(sid, lv) for sid, lv in pairs], **m)

if __name__ == '__main__':
    bad = False
    for rid in BUILDS:
        e, tot = check_build(rid)
        if e: bad = True; print(ROUTE_NAME[rid], e)
    load()
    rows = {r: (skills.points(skills.R[r]['build']), skills.simulate(r, 1)[0], skills.simulate(r, 5)[0], skills.simulate(r, 1)[1]) for r in skills.R}
    base = sum(rows[ROUTE_NAME[x]][1] for x in ('heavy', 'hawk', 'destroyer', 'brawler', 'venom', 'exorcist')) / 6
    print(f'{"路線":6} 點數 單體 群體 增益 總貢獻 耗魔  有效生命 治療')
    for r, (p, st, aoe, mps) in rows.items():
        pv = skills.party_value(r, 100)
        print(f'{r:6} {p:>4} {st / base * 100:4.0f} {aoe / base * 100:4.0f} {pv:4.0f} {st / base * 100 + pv:5.0f} {mps:5.1f}  {skills.ehp(r):.2f}  {skills.hps(r):.1f}')
    print('原始基準（每秒 攻擊力%）', round(base))
    if bad: raise SystemExit(1)
