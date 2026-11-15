#!/usr/bin/env python3
"""發佈用素材：python3 tools/pack_publish.py <輸出資料夾>
線上版一個版本最多 511 個檔案，所以把小圖（道具圖示、技能圖示、一般怪物）拼成幾張合併圖，
其他圖照原樣複製。遊戲讀 manifest 的 atlas 欄位，載入時切回一張一張（assets.js）。repo 裡的 assets/ 不動。"""
import json, os, shutil, sys
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets')
OUT = os.path.join(sys.argv[1], 'assets')
SKIP_DIRS = ('char/', 'gear/', 'px/', 'soul/', 'sprite/')  # 舊零件與目前沒用到的
MAX_W, MAX_H = 4096, 2048

man = json.load(open(os.path.join(ROOT, 'manifest.json'), encoding='utf-8'))
files = [f for f in man['files'] if not f.startswith(SKIP_DIRS) and not os.path.basename(f).startswith('_') and not f.endswith('_preview.png')]
size = {f: Image.open(os.path.join(ROOT, f)).size for f in files}
groups = {
    'icon': [f for f in files if f.startswith('icon/') and size[f] == (128, 128)],
    'skill': [f for f in files if f.startswith('ui/skill_') and size[f] == (128, 128)],
    'mon': [f for f in files if f.startswith('monster/') and size[f] == (256, 256)],
}
packed = {f for g in groups.values() for f in g}
if os.path.isdir(OUT):
    shutil.rmtree(OUT)
os.makedirs(os.path.join(OUT, 'atlas'))
atlas, pages = {}, []
for name, fs in groups.items():
    if not fs:
        continue
    w, h = size[fs[0]]
    per_row, per_col = MAX_W // w, MAX_H // h
    per_page = per_row * per_col
    for p in range(0, len(fs), per_page):
        chunk = fs[p:p + per_page]
        rows = (len(chunk) + per_row - 1) // per_row
        page = Image.new('RGBA', (min(len(chunk), per_row) * w, rows * h), (0, 0, 0, 0))
        pid = f'atlas/{name}_{p // per_page}.png'
        for i, f in enumerate(chunk):
            x, y = (i % per_row) * w, (i // per_row) * h
            page.paste(Image.open(os.path.join(ROOT, f)).convert('RGBA'), (x, y))
            atlas[f[:-4]] = [len(pages), x, y, w, h]
        page.save(os.path.join(OUT, pid), optimize=True)
        pages.append(pid)
plain = [f for f in files if f not in packed]
for f in plain:
    os.makedirs(os.path.dirname(os.path.join(OUT, f)), exist_ok=True)
    shutil.copy2(os.path.join(ROOT, f), os.path.join(OUT, f))
json.dump({'pages': pages, 'map': atlas}, open(os.path.join(OUT, 'atlas.json'), 'w'), ensure_ascii=False)
v = man.get('v', {})
json.dump({'version': man.get('version'), 'files': plain, 'v': {k: v[k] for k in plain if k in v}, 'atlas': 'atlas.json'}, open(os.path.join(OUT, 'manifest.json'), 'w'), ensure_ascii=False)
n = sum(len(fs) for _, _, fs in os.walk(OUT))
mb = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(OUT) for f in fs) / 1e6
print(f'packed {len(packed)} images into {len(pages)} atlas pages; {len(plain)} plain files; total {n} files, {mb:.1f} MB')
for p in pages:
    print(' ', p, f'{os.path.getsize(os.path.join(OUT, p)) / 1e6:.1f} MB')
