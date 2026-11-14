# 產生網頁用的縮小版素材（原檔不動）：python3 tools/web_assets.py 輸出資料夾
# 畫面上用不到原尺寸的圖先縮小，手機下載量大約少一半以上
import sys, os, shutil, json
from PIL import Image
SRC = os.path.join(os.path.dirname(__file__), '..', 'assets')
OUT = sys.argv[1]
MAXS = {'hero/': 320, 'portrait/': 320, 'soul_art/': 640, 'vfx/': 256, 'ui/title_bg': 1280, 'ui/logo': 640, 'icon/': 96}
# 網頁版不放的舊素材：零件拼裝的角色（所有職業都已有完整立繪）
SKIP = ('char/', 'gear/', 'px/')  # px/：像素風切換用，網頁版改用即時轉換，省檔案數
files = [f for f in json.load(open(f'{SRC}/manifest.json'))['files'] if not f.startswith(SKIP)]
before = after = 0
for f in files:
    src, dst = f'{SRC}/{f}', f'{OUT}/assets/{f}'
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    lim = next((v for k, v in MAXS.items() if f.startswith(k)), None)
    im = Image.open(src)
    if lim and max(im.size) > lim:
        k = lim / max(im.size)
        im = im.convert('RGBA').resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        if f == 'ui/title_bg.png': im = im.convert('RGB').quantize(256, method=Image.MEDIANCUT, dither=Image.FLOYDSTEINBERG)
        im.save(dst, optimize=True)
    else:
        shutil.copyfile(src, dst)
    before += os.path.getsize(src); after += os.path.getsize(dst)
import hashlib
v = {f: hashlib.md5(open(f'{OUT}/assets/{f}', 'rb').read()).hexdigest()[:8] for f in files}
json.dump({'version': 1, 'files': files, 'v': v}, open(f'{OUT}/assets/manifest.json', 'w'), indent=1)
print(f'{len(files)} 張：{before / 1e6:.1f} MB → {after / 1e6:.1f} MB')
