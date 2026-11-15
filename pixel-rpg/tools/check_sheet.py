#!/usr/bin/env python3
"""檢查第五批逐格像素動畫：python3 tools/check_sheet.py assets/sprite/hero/sword.png ...
規格來源：art/batch5/request.json（由 tools/art_batch5.mjs 產生，格式定義在 spritesheet.js）"""
import json, sys, os
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
REQ = json.load(open(os.path.join(ROOT, 'art', 'batch5', 'request.json'), encoding='utf-8'))
KINDS = REQ['kinds']
BY_PATH = {a['path']: a for a in REQ['assets']}
NO_FOOT = {'down', 'die', 'hurt'}  # 這些動作腳可以離開腳底線


def find_spec(path):
    rel = os.path.relpath(os.path.abspath(path), os.path.join(ROOT, 'assets')).replace(os.sep, '/')
    if rel in BY_PATH:
        return BY_PATH[rel]
    # 已交付過、清單已跳過的檔案：依資料夾推類別
    kind = 'hero' if '/hero/' in '/' + rel else 'npc' if '/npc/' in '/' + rel else None
    return {'kind': kind, 'path': rel} if kind else None


def check(path):
    errs, warns = [], []
    spec = find_spec(path)
    if not spec or not spec.get('kind'):
        return [f'找不到 {path} 的規格（檔名要和 art/batch5/README.md 一致）'], []
    K = KINDS[spec['kind']]
    cw, ch = K['cell']
    im = Image.open(path)
    if im.mode != 'RGBA':
        errs.append(f'要 RGBA 透明背景（現在是 {im.mode}）')
        im = im.convert('RGBA')
    if im.size != (K['w'], K['h']):
        errs.append(f"尺寸要 {K['w']}×{K['h']}（現在 {im.size[0]}×{im.size[1]}）")
        return errs, warns
    px = im.load()
    alphas = set()
    colors = set()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            r, g, b, a = px[x, y]
            alphas.add(a)
            if a:
                colors.add((r, g, b))
    semi = [a for a in alphas if 0 < a < 255]
    if semi:
        errs.append(f'有半透明像素（{len(semi)} 種透明度）：像素畫只能全透明或不透明')
    if len(colors) > 48:
        errs.append(f'顏色 {len(colors)} 種，上限 48')
    anim_of = {}
    for name, a in K['anims'].items():
        for i in range(a['n']):
            anim_of[K['col'][name] + i] = (name, i)
    sizes = []
    for row in range(5):
        for col in range(K['cols']):
            x0, y0 = col * cw, row * ch
            box = im.crop((x0, y0, x0 + cw, y0 + ch)).getbbox()
            name, i = anim_of[col]
            where = f'第 {row + 1} 列第 {col + 1} 欄（{name} 第 {i + 1} 格）'
            if not box:
                errs.append(f'{where} 是空的')
                continue
            l, t, r, b = box
            if l == 0 or t == 0 or r == cw or b == ch:
                errs.append(f'{where} 碰到格子邊緣')
            if name not in NO_FOOT and abs(b - K['foot']) > 2:
                errs.append(f"{where} 腳底在第 {b} 像素，要在 {K['foot']}±2")
            cx = (l + r) / 2
            if name in ('idle', 'walk') and abs(cx - cw / 2) > cw * 0.12:
                warns.append(f'{where} 沒有水平置中（中心 {cx:.0f}，格子中線 {cw / 2:.0f}）')
            if name == 'idle':
                sizes.append(b - t)
    if sizes and max(sizes) - min(sizes) > 4:
        warns.append(f'待機各格高度差 {max(sizes) - min(sizes)} 像素，呼吸只要 1～2 像素')
    if sizes:
        hgt = sum(sizes) / len(sizes)
        if abs(hgt - K['height']) > K['height'] * 0.15:
            warns.append(f"角色高度約 {hgt:.0f} 像素，建議 {K['height']}")
    if spec['kind'] == 'hero' and spec.get('extra'):
        want = [c for c in spec['extra'].split() if c.startswith('#') and len(c) == 7]
        hexes = {'#%02x%02x%02x' % c for c in colors}
        missing = [c for c in want[:8] if c not in hexes]
        if len(missing) > 3:
            errs.append(f"衣服沒有用規定的換色色碼（缺 {' '.join(missing)}），程式換不了稀有度顏色")
    return errs, warns


def main(paths):
    bad = 0
    for p in paths:
        errs, warns = check(p)
        print(('✗ ' if errs else '✓ ') + p)
        for e in errs[:20]:
            print('   錯誤：' + e)
        if len(errs) > 20:
            print(f'   ……還有 {len(errs) - 20} 個錯誤')
        for w in warns[:10]:
            print('   提醒：' + w)
        bad += bool(errs)
    print('✓ 全部通過' if not bad else f'✗ {bad} 個檔案沒通過')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
