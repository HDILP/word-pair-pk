#!/usr/bin/env python3
"""
build.py — 将 words/<教材>/<单元>.json 词库嵌入 HTML 模板，生成可双击运行的 index.html

词库目录结构：
  words/
    人教版高中英语必修一/
      Welcome Unit.json
      Unit 1 Teenage Life.json
      ...

构建后会按教材名合并，每个教材下 units 数组包含各单元，
形如：{ name: "人教版高中英语必修一", units: [{ name: "Welcome Unit", words: [...] }, ...] }

用法：
  python3 build.py              # 默认从 word-pair-pk.html → index.html
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
    """自定义排序：必修 < 选必，且按中文数字顺序排列"""
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
# files_by_dir: { "人教版高中英语必修一": ["必修一/Welcome Unit.json", ...], ... }
files_by_dir = {}
for fpath in word_files:
    rel = os.path.relpath(fpath, WORDS_DIR)
    dirname = os.path.dirname(rel)  # e.g. "人教版高中英语必修一"
    dirname = os.path.basename(dirname)  # keep just the dir name
    files_by_dir.setdefault(dirname, []).append(fpath)

books = []
total_words = 0

for book_name in sorted(files_by_dir.keys(), key=_book_sort_key):
    unit_files = sorted(files_by_dir[book_name])
    units = []
    for fpath in unit_files:
        with open(fpath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        # 兼容两种格式：
        #   格式1: { "name": "...", "words": [...] }
        #   格式2: { "name": "...", "units": [{"name": "...", "words": [...]}, ...] }
        #   格式3: 纯数组 [{}, ...]
        if isinstance(data, list):
            # 纯单词数组 → 用文件名当 unit 名
            unit_name = os.path.splitext(os.path.basename(fpath))[0]
            units.append({"name": unit_name, "words": data})
            total_words += len(data)
        elif 'units' in data:
            # 已经分好 units 了（格式2）
            unit_name = data.get('name') or os.path.splitext(os.path.basename(fpath))[0]
            for u in data['units']:
                u.setdefault('name', unit_name)
                units.append(u)
                total_words += len(u.get('words', []))
        elif 'words' in data:
            # 标准单元文件格式（格式1）
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

# ── 3. 读模板 ──────────────────────────────────────────────
with open(TEMPLATE, 'r', encoding='utf-8') as f:
    html = f.read()

# ── 4. 注入词库和构建版本号 ────────────────────────────
data_json = json.dumps({'books': books}, ensure_ascii=False)
placeholder = 'const ALL_WORDS_DATA = null; // 🏗️ Running'

new = f'const ALL_WORDS_DATA = {data_json}; // 💉 built by build.py'

if placeholder not in html:
    print('❌ 模板中未找到占位符，请确认 word-pair-pk.html 未被修改')
    sys.exit(1)

html = html.replace(placeholder, new, 1)

# 注入构建版本号（精确到秒，无符号紧凑格式 e.g. 20260620144233）
now = __import__('datetime').datetime.now()
ver = now.strftime('%Y%m%d%H%M%S')
html = html.replace('<!-- BUILD_VER -->', ver, 1)

# ── 5. 写入输出 ──────────────────────────────────────────────
with open(OUTPUT, 'w', encoding='utf-8') as f:
    f.write(html)

size_kb = os.path.getsize(OUTPUT) / 1024
print(f'✅ 已生成 {OUTPUT}  ({size_kb:.0f} KB)')
print(f'   双击 {OUTPUT} 即可运行')
