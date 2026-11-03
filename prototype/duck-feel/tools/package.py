"""打包成 itch.io 的 HTML5 包：dist/duck-shift-web.zip，index.html 在压缩包根目录。
只放运行时需要的文件（不含 tools/、原始 MIDI）。用法：python3 tools/package.py"""
import os, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INCLUDE = ['index.html', 'art.js', 'stylize.js', 'notebook.js', 'fonts', 'vendor', 'audio/piano', 'audio/sfx', 'audio/score.json', 'audio/CREDITS.md']
OUT = os.path.join(ROOT, '..', '..', 'dist', 'duck-shift-web.zip')

def files():
    for item in INCLUDE:
        p = os.path.join(ROOT, item)
        if os.path.isfile(p): yield item
        else:
            for d, _, fs in os.walk(p):
                for f in sorted(fs):
                    if not f.startswith('.'): yield os.path.relpath(os.path.join(d, f), ROOT)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as z:
    for f in files(): z.write(os.path.join(ROOT, f), f)
with zipfile.ZipFile(OUT) as z: n = len(z.namelist())
print(os.path.normpath(OUT), n, 'files', round(os.path.getsize(OUT) / 1e6, 2), 'MB')
