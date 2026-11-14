"""產生遊戲用的資料檔：../skilldata.js、../bestiary.js（不要手改，改 design/ 裡的來源再重跑）"""
import json, skilldb
from builds import BUILDS
from monsters import build
H = '// 由 design/gen_js.py 自動產生，請勿手改\n'
db = [{k: v for k, v in s.items()} for s in skilldb.DB]
for s in db:
    for f in ('buff', 'pb', 'db'):
        if f in s: s[f] = list(s[f])
    s['pre'] = [list(p) for p in s['pre']]
open('../skilldata.js', 'w').write(H + 'export const SKILLS = ' + json.dumps(db, ensure_ascii=False) + ';\n'
    + 'export const ROUTES = ' + json.dumps({c: [{'id': i, 'name': n} for i, n in rs] for c, rs in skilldb.ROUTES.items()}, ensure_ascii=False) + ';\n'
    + 'export const RES = ' + json.dumps({c: {'name': n, 'max': m} for c, (n, m) in skilldb.RES.items()}, ensure_ascii=False) + ';\n'
    + 'export const CLASS_NAME = ' + json.dumps(skilldb.CLASS_NAME, ensure_ascii=False) + ';\n'
    + 'export const BUILDS = ' + json.dumps({k: v for k, v in BUILDS.items()}) + ';\n')
ms = build()
keep = ('id', 'name', 'lv', 'elem', 'el', 'race', 'size', 'arch', 'archName', 'hp', 'atk', 'df', 'mdf', 'hit', 'flee', 'iv', 'exp', 'jexp', 'coin', 'trait', 'matA', 'matB', 'cardSlot', 'cardEff', 'night', 'region')
open('../bestiary.js', 'w').write(H + 'export const BESTIARY = ' + json.dumps({m['id']: {k: m[k] for k in keep} | {'drops': m['drops']} for m in ms}, ensure_ascii=False) + ';\n')
print('ok', len(db), len(ms))
