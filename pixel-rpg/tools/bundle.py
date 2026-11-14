# 把所有模組打包成單一 HTML（給 Claude Artifact 用）。用法：python3 tools/bundle.py 輸出路徑
import re, sys
out = sys.argv[1]
strip = lambda s: re.sub(r"^import \{.*?\} from '\./\w+\.js';\n", '', re.sub(r'^export ', '', s, flags=re.M), flags=re.S | re.M)
def names(path):
    src = open(path).read(); found = []
    for m in re.finditer(r'^export (?:const|let|function) (.+)$', src, flags=re.M):
        line = m.group(1)
        if line.startswith(('function', 'async')) or re.match(r'\w+\s*\(', line): found.append(re.match(r'(\w+)', line).group(1))
        else:
            flat = line
            while True:  # 去掉括號內容，避免把函式預設參數當成匯出名稱
                nxt = re.sub(r'\([^()]*\)|\[[^\[\]]*\]|\{[^{}]*\}', '', flat)
                if nxt == flat: break
                flat = nxt
            found += re.findall(r'(?:^|,\s*)(\w+)\s*=', flat)
    return found
def block(path):
    n = names(path); return "const { " + ", ".join(n) + " } = (() => {\n" + strip(open(path).read()) + "\nreturn { " + ", ".join(n) + " };\n})();"
parts = [strip(open('world.js').read()), strip(open('sprites.js').read())] + [block(f) for f in ['assets.js', 'pixelize.js', 'cutout.js', 'avatar.js', 'soul.js', 'items.js', 'icons.js', 'party.js', 'meta.js', 'audio.js']] + [strip(open('game.js').read())]
css = open('style.css').read(); html = open('index.html').read()
body = html.split('<body>')[1].split('<script type="module"')[0]
open(out, 'w').write(f'''<meta charset="utf-8"><title>微光大陸</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Huninn&family=Silkscreen&display=swap">
<style>
{css}
</style>
{body}<script type="module">
{chr(10).join(parts)}
</script>
''')
print('bundled', out)
