# 冒險者精緻立繪檢查：python3 tools/check_hero.py sword   （或不加參數＝檢查全部職業）
# 檢查 assets/hero/{class}_{tier}_{view}.png：512×512、透明背景、腳底高度一致、大小一致，
# 並輸出對照表 assets/hero/_sheet_{class}.png（5 等級 × 3 朝向＋隊友蕾娜當品質標準）
import sys, os
from PIL import Image, ImageDraw

TIERS = ['common', 'good', 'rare', 'epic', 'legend']
VIEWS = ['front', 'side', 'back']
D = os.path.join(os.path.dirname(__file__), '..', 'assets')

def check(cls):
    errs, warns, cells = [], [], {}
    for t in TIERS:
        for v in VIEWS:
            p = f'{D}/hero/{cls}_{t}_{v}.png'
            name = f'{t}・{v}'
            if not os.path.exists(p):
                errs.append(f'缺少 hero/{cls}_{t}_{v}.png'); continue
            im = Image.open(p).convert('RGBA')
            if im.size != (512, 512): errs.append(f'{name} 尺寸 {im.size}，應為 512×512')
            im = im.resize((512, 512))
            a = im.getchannel('A')
            if any(a.getpixel(c) > 10 for c in [(0, 0), (511, 0), (0, 511), (511, 511), (256, 2)]):
                errs.append(f'{name} 背景不是透明的')
            bb = a.point(lambda x: 255 if x > 40 else 0).getbbox()
            if not bb: errs.append(f'{name} 是空白圖'); continue
            x0, y0, x1, y1 = bb
            if y0 < 4 or x0 < 2 or x1 > 510: warns.append(f'{name} 貼到畫布邊緣，可能被裁切')
            cells[(t, v)] = (im, y1, y1 - y0)
    if cells:
        feet = [c[1] for c in cells.values()]
        if max(feet) - min(feet) > 12:
            errs.append(f'腳底高度不一致（{min(feet)}～{max(feet)}），應全部約在 471（底部往上 8%）')
        hs = [c[2] for (t, v), c in cells.items() if v != 'back']
        if hs and max(hs) - min(hs) > 60:
            warns.append(f'身高差太多（{min(hs)}～{max(hs)} 像素），同一個人換裝身高應該一樣（頭飾、翅膀除外）')
    S = 200
    sheet = Image.new('RGBA', (S * 4, S * 5 + 24), (52, 48, 72, 255))
    dr = ImageDraw.Draw(sheet)
    lena = f'{D}/npc/ally_lena.png'
    if os.path.exists(lena): sheet.alpha_composite(Image.open(lena).convert('RGBA').resize((S, S)), (S * 3, 24))
    dr.text((S * 3 + 4, 4), 'quality target: ally_lena', fill='#fff')
    for i, v in enumerate(VIEWS): dr.text((i * S + 4, 4), v, fill='#fff')
    for r, t in enumerate(TIERS):
        for i, v in enumerate(VIEWS):
            if (t, v) in cells: sheet.alpha_composite(cells[(t, v)][0].resize((S, S), Image.LANCZOS), (i * S, 24 + r * S))
            dr.text((i * S + 4, 24 + r * S + 4), t, fill='#ffe')
    out = f'{D}/hero/_sheet_{cls}.png'
    os.makedirs(os.path.dirname(out), exist_ok=True); sheet.save(out)
    print(f'== {cls}：{len(cells)}/15 張')
    for e in errs: print('  ✗', e)
    for w in warns: print('  △', w)
    print('  ✓ 全部通過' if not errs else f'  共 {len(errs)} 個錯誤', f'｜對照表：assets/hero/_sheet_{cls}.png')
    return not errs

if __name__ == '__main__':
    clss = sys.argv[1:] or ['sword', 'archer', 'mage', 'monk']
    ok = all([check(c) for c in clss])
    sys.exit(0 if ok else 1)
