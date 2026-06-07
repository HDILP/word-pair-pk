#!/usr/bin/env python3
"""
build.py — 将 words/*.json 词库嵌入 HTML 模板，生成可双击运行的 index.html

用法：
  python3 build.py              # 默认从 word-pair-pk.html → index.html
  python3 build.py output.html   # 自定义输出文件名

工作流：
  1. 在 words/ 里改/增词库 JSON（支持 words 或 units 格式）
  2. 运行 python3 build.py
  3. 发 index.html 给班主任 / 部署到 GitHub+Vercel
"""

import json
import os
import sys
import glob

TEMPLATE = 'word-pair-pk.html'
OUTPUT = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
WORDS_DIR = 'words'

# ── 1. 读词库 ──────────────────────────────────────────────
word_files = sorted(glob.glob(os.path.join(WORDS_DIR, '*.json')))
if not word_files:
    print(f'❌ 未在 {WORDS_DIR}/ 找到词库 JSON 文件')
    sys.exit(1)

books = []
for fpath in word_files:
    with open(fpath, 'r', encoding='utf-8') as f:
        book = json.load(f)
    # 兼容旧格式 (words) 和新格式 (units)
    if 'words' in book or 'units' in book:
        books.append(book)
    else:
        print(f'⚠️  跳过 {fpath}：缺少 words 或 units 字段')

print(f'📚 读取 {len(books)} 册词库')
total = sum(
    len(b.get('words', [])) + sum(len(u.get('words', [])) for u in b.get('units', []))
    for b in books
)
print(f'📝 共 {total} 词')

# ── 2. 读模板 ──────────────────────────────────────────────
with open(TEMPLATE, 'r', encoding='utf-8') as f:
    html = f.read()

# ── 3. 注入词库 ────────────────────────────────────────────
data_json = json.dumps({'books': books}, ensure_ascii=False)
placeholder = 'const ALL_WORDS_DATA = null; // 🏗️ Running'

old = f'{placeholder}'
new = f'const ALL_WORDS_DATA = {data_json}; // 💉 built by build.py'

if placeholder not in html:
    print('❌ 模板中未找到占位符，请确认 word-pair-pk.html 未被修改')
    sys.exit(1)

html = html.replace(old, new, 1)
# Also clean up the rest of that line if there's residual content
# (the placeholder comment is followed by C-style line content)
idx = html.find(new)
if idx >= 0:
    end_of_line = html.find('\n', idx)
    line_content = html[idx:end_of_line]
    # Check if there's leftover data after the comment
    if '};' not in line_content and line_content.strip().endswith('here'):
        # The line is clean, good
        pass

# ── 4. 写入输出 ──────────────────────────────────────────────
with open(OUTPUT, 'w', encoding='utf-8') as f:
    f.write(html)

size_kb = os.path.getsize(OUTPUT) / 1024
print(f'✅ 已生成 {OUTPUT}  ({size_kb:.0f} KB)')
print(f'   双击 {OUTPUT} 即可运行')
