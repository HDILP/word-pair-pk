#!/usr/bin/env python3
"""
build.py — 将 src/style.css + src/app.js 内联后嵌入词库数据，生成 index.html

词库目录结构：
  words/
    人教版高中英语必修一/
      Welcome Unit.json
      ...

用法：
  python3 build.py              # 默认 → index.html
  python3 build.py output.html   # 自定义输出文件名
"""

import json
import os
import sys
import glob

TEMPLATE = 'word-pair-pk.html'
OUTPUT = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
WORDS_DIR = 'words'

# ── 中文数字 → 整数，用于课本排序 ──────────────────────────
_CN_NUM = {'一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
           '六': 6, '七': 7, '八': 8, '九': 9, '十': 10}
_CN_TYPES = {'必修': 0, '选必': 1}

def _book_sort_key(name):
    for t, tidx in _CN_TYPES.items():
        if t in name:
            for cn, num in _CN_NUM.items():
                if cn in name:
                    return (tidx, num)
    return (99, 99)

# ── 1. 扫描词库文件 ──────────────────────────────────────────
word_files = sorted(
    glob.glob(os.path.join(WORDS_DIR, '**', '*.json'), recursive=True)
)
if not word_files:
    print(f'❌ 未在 {WORDS_DIR}/ 找到词库 JSON 文件')
    sys.exit(1)

# ── 2. 按课本目录分组 ────────────────────────────────────────
files_by_dir = {}
for fpath in word_files:
    rel = os.path.relpath(fpath, WORDS_DIR)
    dirname = os.path.dirname(rel)
    dirname = os.path.basename(dirname)
    files_by_dir.setdefault(dirname, []).append(fpath)

books = []
total_words = 0

for book_name in sorted(files_by_dir.keys(), key=_book_sort_key):
    unit_files = sorted(files_by_dir[book_name])
    units = []
    for fpath in unit_files:
        with open(fpath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if isinstance(data, list):
            unit_name = os.path.splitext(os.path.basename(fpath))[0]
            units.append({"name": unit_name, "words": data})
            total_words += len(data)
        elif 'units' in data:
            unit_name = data.get('name') or os.path.splitext(os.path.basename(fpath))[0]
            for u in data['units']:
                u.setdefault('name', unit_name)
                units.append(u)
                total_words += len(u.get('words', []))
        elif 'words' in data:
            unit_name = data.get('name') or os.path.splitext(os.path.basename(fpath))[0]
            units.append({"name": unit_name, "words": data['words']})
            total_words += len(data['words'])
        else:
            print(f'⚠️  跳过 {fpath}：未知格式')
            continue
    if units:
        books.append({"name": book_name, "units": units})

print(f'📚 读取 {len(books)} 册课本')
for b in books:
    unit_count = len(b['units'])
    word_count = sum(len(u['words']) for u in b['units'])
    print(f'   {b["name"]}: {unit_count} 单元, {word_count} 词')
print(f'📝 共 {total_words} 词')

# ── 3. 读取模板 + src/ 文件 ─────────────────────────────────
with open(TEMPLATE, 'r', encoding='utf-8') as f:
    html = f.read()

src_dir = os.path.join(os.path.dirname(TEMPLATE), 'src')

# 内联 CSS
css_path = os.path.join(src_dir, 'style.css')
with open(css_path, 'r', encoding='utf-8') as f:
    css_content = f.read()
html = html.replace(
    '<link rel="stylesheet" href="src/style.css" />',
    f'<style>\n{css_content}\n  </style>',
    1
)

# 内联 JS
js_path = os.path.join(src_dir, 'app.js')
with open(js_path, 'r', encoding='utf-8') as f:
    js_content = f.read()
html = html.replace(
    '<script src="src/app.js"></script>',
    f'  <script>\n{js_content}\n  </script>',
    1
)

# ── 4. 注入词库和构建版本号 ────────────────────────────
data_json = json.dumps({'books': books}, ensure_ascii=False)
placeholder = 'const ALL_WORDS_DATA = null; // 🏗️ Running'
new = f'const ALL_WORDS_DATA = {data_json}; // 💉 built by build.py'
if placeholder not in html:
    print('❌ 模板中未找到占位符，请确认 word-pair-pk.html 未被修改')
    sys.exit(1)
html = html.replace(placeholder, new, 1)

# 注入构建版本号（东八区）
import datetime as _dt
now = _dt.datetime.now(_dt.timezone(_dt.timedelta(hours=8)))
ver = now.strftime('%Y%m%d%H%M%S')
html = html.replace('<!-- BUILD_VER -->', ver, 1)

# ── 5. 写入输出 ──────────────────────────────────────────────
with open(OUTPUT, 'w', encoding='utf-8') as f:
    f.write(html)

# ── 6. 写入 version.json + version.js ──────────────────────
VERJSON = 'version.json'
with open(VERJSON, 'w', encoding='utf-8') as f:
    f.write(f'{{"revision":"{ver}"}}\n')
VERJS = 'version.js'
with open(VERJS, 'w', encoding='utf-8') as f:
    f.write(f'window.__remoteRevision = "{ver}";\n')

size_kb = os.path.getsize(OUTPUT) / 1024
print(f'✅ 已生成 {OUTPUT}  ({size_kb:.0f} KB)')
print(f'   双击 {OUTPUT} 即可运行')
