# 像素圖檢查工具：python3 tools/check_pixel.py assets/px/hero/sword_common.png
# 檢查原生像素、尺寸、顏色數、外框、每格對齊，並輸出放大 4 倍的預覽圖（*_preview.png）
import sys
from PIL import Image

OUTLINE = (42, 29, 46)
FW = FH = 48

def check(path):
    im = Image.open(path).convert('RGBA')
    W, H = im.size
    px = im.load()
    errs, warns = [], []
    is_sheet = '/hero/' in path.replace('\\', '/')
    if is_sheet and (W, H) != (432, 144):
        errs.append(f'尺寸 {W}×{H}，應為 432×144（9 欄 × 3 列，每格 48×48）')
    alphas = {px[x, y][3] for y in range(H) for x in range(W)}
    bad_alpha = sorted(a for a in alphas if a not in (0, 255))
    if bad_alpha:
        errs.append(f'有半透明像素（alpha {bad_alpha[:5]}…）：像素圖只能完全透明或完全不透明')
    colors = {px[x, y][:3] for y in range(H) for x in range(W) if px[x, y][3] == 255}
    if len(colors) > 25:
        errs.append(f'用了 {len(colors)} 種顏色，上限 24 色＋外框色')
    if OUTLINE not in colors:
        errs.append('找不到外框色 #2a1d2e')
    # 偵測假像素圖（放大過的圖）：如果每 2×2 或 3×3 區塊都同色，代表被放大了
    for k in (2, 3, 4):
        if W % k == 0 and H % k == 0:
            same = all(px[x, y] == px[x - x % k, y - y % k] for y in range(0, H, 1) for x in range(0, W, 1))
            if same:
                errs.append(f'整張圖是放大 {k} 倍的結果，請交原生尺寸')
                break
    if is_sheet and W == 432 and H == 144:
        rows = ['front', 'back', 'side']
        cols = ['待機', '走1', '走2', '走3', '走4', '攻1', '攻2', '攻3', '攻4']
        feet, heights = {}, []
        for r in range(3):
            for c in range(9):
                box = (c * FW, r * FH, c * FW + FW, r * FH + FH)
                bb = im.crop(box).getbbox()
                name = f'{rows[r]}・{cols[c]}'
                if not bb:
                    errs.append(f'{name} 是空白格'); continue
                x0, y0, x1, y1 = bb
                if x0 == 0 or y0 == 0 or x1 == FW or y1 == FH:
                    warns.append(f'{name} 貼到格子邊緣，可能被裁切')
                feet.setdefault(r, []).append(y1)
                if c < 5: heights.append(y1 - y0)
        for r, ys in feet.items():
            if max(ys[:5]) - min(ys[:5]) > 1:
                errs.append(f'{rows[r]} 列的待機與走路格，腳底高度不一致（{ys[:5]}），播放時角色會上下跳')
        if heights and not (32 <= sum(heights) / len(heights) <= 40):
            warns.append(f'角色平均高度 {sum(heights) / len(heights):.0f} 像素，目標約 36')
    prev = im.resize((W * 4, H * 4), Image.NEAREST)
    bg = Image.new('RGBA', prev.size, (108, 192, 74, 255)); bg.alpha_composite(prev)
    out = path.rsplit('.', 1)[0] + '_preview.png'
    bg.save(out)
    print(f'== {path}  {W}×{H}  {len(colors)} 色')
    for e in errs: print('  ✗', e)
    for w in warns: print('  △', w)
    print('  ✓ 全部通過' if not errs else f'  共 {len(errs)} 個錯誤', f'｜預覽：{out}')
    return not errs

if __name__ == '__main__':
    ok = all([check(p) for p in sys.argv[1:]])
    sys.exit(0 if ok else 1)
