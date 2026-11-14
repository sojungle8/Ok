# 動作姿勢立繪檢查（攻擊 *_attack.png、走路 *_walk1.png／*_walk2.png）：
#   python3 tools/check_attack.py assets/hero/sword_common_side_attack.png assets/hero/sword_common_side_walk1.png ...（可用萬用字元）
# 每張都要和同名站姿圖（去掉 _attack／_walk1／_walk2）畫在同一張畫布、同一比例、腳底同一高度。
# 會輸出對照表 assets/_attack_sheet.png：左邊站姿、右邊攻擊姿勢，紅線是站姿的腳底
import sys, os, re
POSE = re.compile(r'_(attack|walk1|walk2|walk)\.png$')
from PIL import Image, ImageDraw

def bbox(im):
    return im.getchannel('A').point(lambda a: 255 if a > 40 else 0).getbbox()

def check(path, errs, warns):
    base = POSE.sub('.png', path)
    name = os.path.basename(path)
    if not os.path.exists(base): errs.append(f'{name}：找不到對應的站姿圖 {os.path.basename(base)}'); return None
    a, s = Image.open(path).convert('RGBA'), Image.open(base).convert('RGBA')
    if path.endswith('_walk.png'):  # 走路圖：左右並排兩格，每格和站姿一樣大
        if a.size != (s.width * 2, s.height): errs.append(f'{name}：尺寸 {a.size}，應為站姿寬度 ×2（{s.width * 2}×{s.height}），左右各一格'); return None
        r1 = check_pair(name + '［左格］', a.crop((0, 0, s.width, s.height)), s, errs, warns)
        r2 = check_pair(name + '［右格］', a.crop((s.width, 0, s.width * 2, s.height)), s, errs, warns)
        if r1 and r2 and a.crop((0, 0, s.width, s.height)).tobytes() == a.crop((s.width, 0, s.width * 2, s.height)).tobytes(): errs.append(f'{name}：左右兩格一模一樣，要畫成相反的腳')
        return r1 and (r1[0], a.crop((0, 0, s.width, s.height)), r1[2])
    if a.size != s.size: errs.append(f'{name}：尺寸 {a.size} 和站姿圖 {s.size} 不同'); return None
    return check_pair(name, a, s, errs, warns)

def check_pair(name, a, s, errs, warns):
    W, H = a.size
    if any(a.getpixel(c)[3] > 10 for c in [(0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1)]): errs.append(f'{name}：背景不是透明的')
    ba, bs = bbox(a), bbox(s)
    if not ba: errs.append(f'{name}：空白圖'); return None
    tol = round(H * 0.025)
    if abs(ba[3] - bs[3]) > tol: errs.append(f'{name}：腳底高度 {ba[3]}，站姿是 {bs[3]}（誤差要在 {tol} 以內），角色會上下跳')
    hs, ha = bs[3] - bs[1], ba[3] - ba[1]
    if ha > hs * 1.25 or ha < hs * 0.7: warns.append(f'{name}：角色高度 {ha}（站姿 {hs}），請確認比例相同、不是放大或縮小')
    if ba[0] <= 1 or ba[2] >= W - 1 or ba[1] <= 1: warns.append(f'{name}：碰到畫布邊緣，武器或身體可能被裁切')
    return s, a, bs[3]

if __name__ == '__main__':
    files = [f for f in sys.argv[1:] if POSE.search(f)]
    errs, warns, pairs = [], [], []
    for f in files:
        r = check(f, errs, warns)
        if r: pairs.append((os.path.basename(f), *r))
    if pairs:
        S = 160
        sheet = Image.new('RGBA', (S * 2 * 3, (S + 18) * ((len(pairs) + 2) // 3)), (52, 48, 72, 255))
        d = ImageDraw.Draw(sheet)
        for i, (n, s, a, foot) in enumerate(pairs):
            x, y = (i % 3) * S * 2, (i // 3) * (S + 18)
            k = S / s.height
            sheet.alpha_composite(s.resize((S, S), Image.LANCZOS), (x, y + 18)); sheet.alpha_composite(a.resize((S, S), Image.LANCZOS), (x + S, y + 18))
            d.line((x, y + 18 + foot * k, x + 2 * S, y + 18 + foot * k), fill='#ff5a6e')
            d.text((x + 4, y + 3), n.replace('.png', ''), fill='#fff')
        os.makedirs('assets', exist_ok=True); sheet.save('assets/_attack_sheet.png')
    print(f'== 動作姿勢 {len(files)} 張')
    for e in errs: print('  ✗', e)
    for w in warns: print('  △', w)
    print('  ✓ 全部通過' if not errs else f'  共 {len(errs)} 個錯誤', '｜對照表：assets/_attack_sheet.png' if pairs else '')
    sys.exit(0 if not errs and files else 1)
